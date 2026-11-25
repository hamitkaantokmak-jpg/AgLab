// Yapılandırma karşılaştırması (motor/syslog-zaman-diff, aşama 3).
//
// rt.configSnapshot(devs?) running-config'i kanonik satırlara çevirir (boşluk/sıra normal,
// `!`/`end` yok); rt.configDiff(before, after?) cihaz başına eklenen/silinen satırları ve değişen
// bölümleri (interface/router/vlan… bloğu, üst düzey satırlar için "(global)") verir. Katman 1
// değişiklikleri (SFP, kablo, konnektör) ayrı listededir. Anlamsal gürültü yok: aynı değeri yeniden
// yazmak ya da `no x` ile eski değere dönmek fark üretmez.
import { describe, expect, it } from 'vitest'
import { createLab, runScript } from '../../src/sim/index'
import type { LabRuntime } from '../../src/sim/runtime'
import { fiber, G1, twoSwitchLab } from './fixtures/phys-lab'

const cfg = (rt: LabRuntime, dev: string, script: string) => runScript(rt, dev, 'configure terminal\n' + script + '\nend')

describe('configSnapshot / configDiff', () => {
  it('tek interface değişikliği: eklenen satır ve değişen bölüm', () => {
    const rt = createLab(twoSwitchLab())
    const before = rt.configSnapshot()
    expect(Object.keys(before.devices).sort()).toEqual(['SW1', 'SW2'])
    cfg(rt, 'SW1', 'interface fa0/2\ndescription Yazici')
    const d = rt.configDiff(before)
    expect(d.devices['SW1']).toMatchObject({ added: ['interface FastEthernet0/2 > description Yazici'], removed: [], changedSections: ['interface FastEthernet0/2'] })
    expect(d.devices['SW2']).toMatchObject({ added: [], removed: [], changedSections: [] })
    expect(d.phys).toEqual([])
    expect(rt.query().changedDevices(before)).toEqual(['SW1'])
  })

  it('değiştirilen değer: eski satır silinmiş, yeni satır eklenmiş görünür', () => {
    const rt = createLab(twoSwitchLab())
    cfg(rt, 'SW1', 'interface fa0/2\ndescription Eski')
    const before = rt.configSnapshot()
    cfg(rt, 'SW1', 'interface fa0/2\ndescription Yeni')
    expect(rt.configDiff(before).devices['SW1']).toMatchObject({
      added: ['interface FastEthernet0/2 > description Yeni'],
      removed: ['interface FastEthernet0/2 > description Eski'],
      changedSections: ['interface FastEthernet0/2'],
    })
  })

  it('geri alma (no x) ve aynı değeri yeniden yazmak fark üretmez', () => {
    const rt = createLab(twoSwitchLab())
    cfg(rt, 'SW1', 'interface fa0/2\nswitchport mode access')
    const before = rt.configSnapshot()
    cfg(rt, 'SW1', 'interface fa0/2\nswitchport mode access\ndescription gecici\nno description\nshutdown\nno shutdown')
    expect(rt.configDiff(before).devices['SW1']).toMatchObject({ added: [], removed: [], changedSections: [] })
    expect(rt.query().changedDevices(before)).toEqual([])
  })

  it('boş değişiklik: hiçbir şey yapılmadıysa fark yok; iki anlık görüntü arasında da çalışır', () => {
    const rt = createLab(twoSwitchLab())
    const a = rt.configSnapshot()
    const b = rt.configSnapshot()
    expect(rt.configDiff(a, b).devices['SW1']!.added).toEqual([])
    expect(rt.configDiff(a).devices['SW2']!.removed).toEqual([])
    // anlık görüntü sonradan değişmez ve JSON'a yazılabilir
    cfg(rt, 'SW1', 'hostname KAT1')
    expect(JSON.parse(JSON.stringify(a))).toEqual(a)
    expect(rt.configDiff(a, b).devices['SW1']!.added).toEqual([])
    expect(rt.configDiff(a).devices['SW1']).toMatchObject({ added: ['hostname KAT1'], removed: ['hostname SW1'], changedSections: ['(global)'] })
  })

  it('çoklu cihaz ve cihaz alt kümesi', () => {
    const rt = createLab(twoSwitchLab())
    const all = rt.configSnapshot()
    const only = rt.configSnapshot(['SW2'])
    expect(Object.keys(only.devices)).toEqual(['SW2'])
    cfg(rt, 'SW1', 'vlan 10\nname Satis')
    cfg(rt, 'SW2', 'spanning-tree vlan 1 priority 4096')
    const d = rt.configDiff(all)
    expect(d.devices['SW1']!.changedSections).toEqual(['vlan 10'])
    expect(d.devices['SW1']!.added).toContain('vlan 10 > name Satis')
    expect(d.devices['SW2']!.changedSections).toEqual(['(global)'])
    expect(rt.query().changedDevices(all)).toEqual(['SW1', 'SW2'])
    expect(Object.keys(rt.configDiff(only).devices)).toEqual(['SW2'])
    expect(rt.query().changedDevices(only)).toEqual(['SW2'])
    expect(() => rt.configSnapshot(['YOK'])).toThrow()
  })

  it('router bloğu bölüm olarak görünür', () => {
    const rt = createLab(twoSwitchLab())
    const before = rt.configSnapshot()
    cfg(rt, 'SW1', 'interface vlan 1\nip address 192.168.1.250 255.255.255.0')
    const d = rt.configDiff(before).devices['SW1']!
    expect(d.changedSections).toEqual(['interface Vlan1'])
    expect(d.added).toContain('interface Vlan1 > ip address 192.168.1.250 255.255.255.0')
    expect(d.removed).toContain('interface Vlan1 > no ip address')
  })

  it('running vs startup: unsaved bayrağı q.saved ile tutarlı', () => {
    const rt = createLab(twoSwitchLab())
    const before = rt.configSnapshot()
    expect(rt.unsavedChanges('SW1')).toBe(false)
    expect(rt.configDiff(before).devices['SW1']!.unsaved).toBe(false)
    cfg(rt, 'SW1', 'interface fa0/2\ndescription x')
    expect(rt.unsavedChanges('SW1')).toBe(true)
    expect(rt.query().saved('SW1')).toBe(false)
    expect(rt.configDiff(before).devices['SW1']!.unsaved).toBe(true)
    runScript(rt, 'SW1', 'write memory')
    expect(rt.unsavedChanges('SW1')).toBe(false)
    expect(rt.query().saved('SW1')).toBe(true)
    const d = rt.configDiff(before).devices['SW1']!
    expect(d.unsaved).toBe(false)
    expect(d.added).toEqual(['interface FastEthernet0/2 > description x'])
  })
})

describe('configDiff.phys (Katman 1 parça değişimi)', () => {
  it('SFP değişimi listede, yalnız o ucun cihazı değişmiş sayılır; geri takınca fark yok', () => {
    const rt = createLab(twoSwitchLab(fiber('lx', 1000)))
    const before = rt.configSnapshot()
    rt.replaceSfp('SW2', G1, { type: '1000base-sx' })
    const d = rt.configDiff(before)
    expect(d.phys).toHaveLength(1)
    expect(d.phys[0]!.link).toBe('SW1|GigabitEthernet0/1~SW2|GigabitEthernet0/1')
    expect(d.phys[0]!.before!.ends['SW2|' + G1]!.sfp!.type).toBe('1000base-lx')
    expect(d.phys[0]!.after!.ends['SW2|' + G1]!.sfp!.type).toBe('1000base-sx')
    expect(d.devices['SW2']!.added).toEqual([])
    expect(rt.query().changedDevices(before)).toEqual(['SW2'])
    rt.replaceSfp('SW2', G1, { type: '1000base-lx' })
    expect(rt.configDiff(before).phys).toEqual([])
  })

  it('kablo değişimi iki ucu, konnektör temizliği yalnız o ucu etkiler', () => {
    const rt = createLab(twoSwitchLab(fiber('sx', 300, { ends: { a: { sfp: { type: '1000base-sx' } }, b: { sfp: { type: '1000base-sx' }, connectorDirty: true } } })))
    const before = rt.configSnapshot()
    rt.cleanConnector('SW2', G1)
    expect(rt.query().changedDevices(before)).toEqual(['SW2'])
    rt.replaceCable('SW1', G1, { kind: 'fiber-mm', lengthM: 100 })
    expect(rt.query().changedDevices(before)).toEqual(['SW1', 'SW2'])
    expect(rt.configDiff(before).phys[0]!.after!.cable.lengthM).toBe(100)
  })

  it('phys tanımsız linke kablo takmak (replaceCable) yeni kayıt olarak görünür (before null)', () => {
    const rt = createLab(twoSwitchLab())
    const before = rt.configSnapshot()
    rt.replaceCable('SW1', G1, { kind: 'utp-cat6', lengthM: 5 })
    const p = rt.configDiff(before).phys
    expect(p).toHaveLength(1)
    expect(p[0]!.before).toBeNull()
    expect(p[0]!.after!.cable.kind).toBe('utp-cat6')
  })
})
