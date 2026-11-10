// L5-a: router alt arayüzü / 802.1Q (router-on-a-stick). Her davranış başarılı ve başarısız
// durumla sınanır.
import { describe, expect, it } from 'vitest'
import { createLab, createSession, runScript, type VpcsSession } from '../../src/sim'
import { routeTable } from '../../src/sim/net'
import { pingTrace } from '../../src/sim-bridge/events'
import type { LabRuntime } from '../../src/sim/runtime'
import type { LabDef } from '../../src/sim/types'
import { ports } from '../../src/sim/util'

const pc = (id: string, n: number) => ({ id, kind: 'pc' as const, mac: `0050.0000.00${n}0`, x: 0, y: 0 })

/** PC10 (VLAN 10), PC20 (VLAN 20), PC99 (VLAN 99) — SW1 — trunk — R1 Gi0/0. */
function lab(r1: string[], sw1: string[] = []): LabDef {
  return {
    id: 'l5a', title: '', summary: '', level: 'İleri', tags: [], brief: [], objectives: [], solution: {}, view: { w: 1, h: 1 },
    devices: [
      { id: 'R1', kind: 'switch', router: true, model: 'ISR4331', mac: '5254.0010.0000', ports: ports('Gi0/0-1'), x: 0, y: 0 },
      { id: 'SW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0020.0000', ports: [...ports('Fa0/1-3'), ...ports('Gi0/1-2')], x: 0, y: 0 },
      pc('PC10', 1), pc('PC20', 2), pc('PC99', 3),
    ],
    links: [
      { a: ['PC10', 'eth0'], b: ['SW1', 'FastEthernet0/1'] },
      { a: ['PC20', 'eth0'], b: ['SW1', 'FastEthernet0/2'] },
      { a: ['PC99', 'eth0'], b: ['SW1', 'FastEthernet0/3'] },
      { a: ['SW1', 'GigabitEthernet0/1'], b: ['R1', 'GigabitEthernet0/0'] },
    ],
    initialConfig: {
      SW1: [
        'vlan 10', 'vlan 20', 'vlan 99', 'exit',
        'interface fa0/1', 'switchport mode access', 'switchport access vlan 10',
        'interface fa0/2', 'switchport mode access', 'switchport access vlan 20',
        'interface fa0/3', 'switchport mode access', 'switchport access vlan 99',
        'interface gi0/1', 'switchport mode trunk', 'switchport trunk allowed vlan 10,20,99',
        ...sw1,
      ].join('\n'),
      R1: ['interface g0/0', 'no shutdown', ...r1].join('\n'),
    },
    initialPcs: {
      PC10: { ip: '192.168.10.10', prefix: 24, gw: '192.168.10.1' },
      PC20: { ip: '192.168.20.20', prefix: 24, gw: '192.168.20.1' },
      PC99: { ip: '192.168.99.99', prefix: 24, gw: '192.168.99.1' },
    },
  }
}
const SUB10 = ['interface g0/0.10', 'encapsulation dot1Q 10', 'ip address 192.168.10.1 255.255.255.0']
const SUB20 = ['interface g0/0.20', 'encapsulation dot1Q 20', 'ip address 192.168.20.1 255.255.255.0']

const cfg = (rt: LabRuntime, dev: string, script: string) => runScript(rt, dev, 'configure terminal\n' + script + '\nend')
const ok = (rt: LabRuntime, from: string, ip: string) => /bytes from/.test((createSession(rt, from) as VpcsSession).exec('ping ' + ip).join('\n'))
const bad = (out: string[]) => out.filter((l) => /^% ?(Invalid|Incomplete|Ambiguous)/.test(l))

describe('router alt arayüzü (router-on-a-stick)', () => {
  it('eksik alt arayüz VLAN\'lar arası erişimi keser; eklenince iki yön çalışır', () => {
    const rt = createLab(lab(SUB10))
    expect(ok(rt, 'PC10', '192.168.10.1')).toBe(true)
    expect(ok(rt, 'PC10', '192.168.20.20')).toBe(false)
    expect(bad(cfg(rt, 'R1', SUB20.join('\n')))).toEqual([])
    expect(ok(rt, 'PC10', '192.168.20.20')).toBe(true)
    expect(ok(rt, 'PC20', '192.168.10.10')).toBe(true)
    expect(routeTable(rt.derived, 'R1').filter((e) => e.code === 'C').map((e) => `${e.net}/${e.prefix} ${e.ifname}`)).toEqual([
      '192.168.10.0/24 GigabitEthernet0/0.10',
      '192.168.20.0/24 GigabitEthernet0/0.20',
    ])
    const run = runScript(rt, 'R1', 'show running-config').join('\n')
    expect(run).toContain('interface GigabitEthernet0/0.20\n encapsulation dot1Q 20\n ip address 192.168.20.1 255.255.255.0\n!')
  })

  it('yanlış etiket (dot1Q 30) VLAN 20 çerçevelerini almaz; düzeltilince çalışır', () => {
    const rt = createLab(lab([...SUB10, 'interface g0/0.20', 'encapsulation dot1Q 30', 'ip address 192.168.20.1 255.255.255.0']))
    expect(ok(rt, 'PC20', '192.168.20.1')).toBe(false)
    expect(ok(rt, 'PC10', '192.168.20.20')).toBe(false)
    cfg(rt, 'R1', 'interface g0/0.20\nencapsulation dot1Q 20')
    expect(ok(rt, 'PC10', '192.168.20.20')).toBe(true)
  })

  it('fiziksel arayüz kapalıysa bütün alt arayüzler düşer', () => {
    const rt = createLab(lab([...SUB10, ...SUB20, 'interface g0/0', 'shutdown']))
    expect(ok(rt, 'PC10', '192.168.10.1')).toBe(false)
    expect(routeTable(rt.derived, 'R1').some((e) => e.code === 'C')).toBe(false)
    expect(runScript(rt, 'R1', 'show ip interface brief').join('\n')).toMatch(/GigabitEthernet0\/0\.20\s+192\.168\.20\.1\s+YES manual down\s+down/)
    cfg(rt, 'R1', 'interface g0/0\nno shutdown')
    expect(ok(rt, 'PC10', '192.168.20.20')).toBe(true)
    // alt arayüzün kendi shutdown'ı yalnız onu düşürür
    cfg(rt, 'R1', 'interface g0/0.20\nshutdown')
    expect([ok(rt, 'PC10', '192.168.10.1'), ok(rt, 'PC20', '192.168.20.1')]).toEqual([true, false])
    expect(runScript(rt, 'R1', 'show ip interface brief').join('\n')).toMatch(/GigabitEthernet0\/0\.20\s+192\.168\.20\.1\s+YES manual administratively down down/)
  })

  it('switch portu trunk değilse etiketli çerçeveler düşer (access port)', () => {
    const rt = createLab(lab([...SUB10, ...SUB20], ['interface gi0/1', 'switchport mode access', 'switchport access vlan 10']))
    expect(ok(rt, 'PC10', '192.168.20.20')).toBe(false)
    expect(ok(rt, 'PC10', '192.168.10.1')).toBe(false)
    cfg(rt, 'SW1', 'interface gi0/1\nswitchport mode trunk')
    expect(ok(rt, 'PC10', '192.168.20.20')).toBe(true)
  })

  it('native alt arayüz etiketsiz çerçeveyi alır; switch native VLAN\'ı uyuşmalı', () => {
    const native = ['interface g0/0.99', 'encapsulation dot1Q 99 native', 'ip address 192.168.99.1 255.255.255.0']
    const rt = createLab(lab([...SUB10, ...native]))
    expect(ok(rt, 'PC99', '192.168.99.1')).toBe(false)
    cfg(rt, 'SW1', 'interface gi0/1\nswitchport trunk native vlan 99')
    expect(ok(rt, 'PC99', '192.168.99.1')).toBe(true)
    expect(ok(rt, 'PC99', '192.168.10.10')).toBe(true)
    expect(runScript(rt, 'R1', 'show running-config').join('\n')).toContain(' encapsulation dot1Q 99 native')
  })

  it('IOS kuralları: önce encapsulation, aynı VID iki alt arayüzde olmaz, switch\'te alt arayüz yok', () => {
    const rt = createLab(lab([]))
    const early = cfg(rt, 'R1', 'interface g0/0.10\nip address 192.168.10.1 255.255.255.0').join('\n')
    expect(early).toContain('% Configuring IP routing on a LAN subinterface is only allowed')
    expect(rt.running['R1']!.subifs!['GigabitEthernet0/0.10']!.ip).toBe(null)
    cfg(rt, 'R1', SUB10.join('\n'))
    const dup = cfg(rt, 'R1', 'interface g0/0.11\nencapsulation dot1Q 10').join('\n')
    expect(dup).toContain('same VID (10) is not permitted')
    expect(bad(cfg(rt, 'SW1', 'interface fa0/1.10'))).not.toEqual([])
    expect(bad(cfg(rt, 'R1', 'interface g0/9.10'))).not.toEqual([])
  })

  it('no interface alt arayüzü siler; fiziksel port silinemez', () => {
    const rt = createLab(lab([...SUB10, ...SUB20]))
    expect(ok(rt, 'PC10', '192.168.20.20')).toBe(true)
    cfg(rt, 'R1', 'no interface g0/0.20')
    expect(Object.keys(rt.running['R1']!.subifs!)).toEqual(['GigabitEthernet0/0.10'])
    expect(ok(rt, 'PC10', '192.168.20.20')).toBe(false)
    expect(cfg(rt, 'R1', 'no interface g0/0').join('\n')).toContain('% Removal of physical interfaces is not permitted')
  })

  it('Simulation Mode izi: trunk kablosunda 802.1Q etiketi, router geçişinde TTL azalır', () => {
    const rt = createLab(lab([...SUB10, ...SUB20]))
    const t = pingTrace(rt, 'PC10', '192.168.20.20')
    expect([t.ok, t.l2]).toEqual([true, true])
    const wires = t.records.filter((r) => r.kind === 'wire').map((r) => `${r.frame!.kind} ${r.edge!.a}>${r.edge!.b} v${r.frame!.vlan} ttl${r.frame!.ipv4.ttl}`)
    expect(wires.slice(0, 4)).toEqual([
      'icmp-request PC10>SW1 v10 ttl64',
      'icmp-request SW1>R1 v10 ttl64',
      'icmp-request R1>SW1 v20 ttl63',
      'icmp-request SW1>PC20 v20 ttl63',
    ])
  })
})
