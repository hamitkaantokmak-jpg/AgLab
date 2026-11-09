// Konu #11 (Cihaz yönetimi ve yedekleme): arıza senaryoları Labber'da.
//
// Motorun kendisinde doğrulama. Aynı S1–S5 PR F'den beri Sorun Çöz'de de var
// (simulator/network-scenarios.json `mgmt-*`; terminal L3-a ile Labber'da,
// tests/test_aglab_lesson_scenarios.py). Ders belgesindeki S1–S5 ile birebir aynıdır. Her senaryoda: başlangıçta hedef başarısız, çözümden sonra
// başarılı ve kaydedilmiş, switch kapatılıp açıldıktan sonra da başarılı. Kaydedilmeyen
// çözüm güç döngüsünde düşer; bu da ayrıca denenir.
import { describe, expect, it } from 'vitest'
import { createLab, runScript } from '../../src/sim/index'
import { ports } from '../../src/sim/util'
import type { LabDef } from '../../src/sim/types'

// PC-01, PC-02 (VLAN 10) ve ADMIN (VLAN 99) tek switch'te; yönetim adresi 192.168.99.2.
function lab(config: string[]): LabDef {
  return {
    id: 'mgmt', title: '', summary: '', level: 'Başlangıç', tags: [], brief: [], view: { w: 1, h: 1 },
    devices: [
      { id: 'SW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0001.0000', ports: ports('Fa0/1-24', 'Gi0/1-2'), x: 0, y: 0 },
      { id: 'PC-01', kind: 'pc', mac: '0050.7966.0001', x: 0, y: 0 },
      { id: 'PC-02', kind: 'pc', mac: '0050.7966.0002', x: 0, y: 0 },
      { id: 'ADMIN', kind: 'pc', mac: '0050.7966.0009', x: 0, y: 0 },
    ],
    links: [
      { a: ['PC-01', 'eth0'], b: ['SW1', 'FastEthernet0/1'] },
      { a: ['PC-02', 'eth0'], b: ['SW1', 'FastEthernet0/2'] },
      { a: ['ADMIN', 'eth0'], b: ['SW1', 'FastEthernet0/3'] },
    ],
    initialConfig: { SW1: config.join('\n') },
    initialPcs: {
      'PC-01': { ip: '192.168.10.11', prefix: 24, gw: null },
      'PC-02': { ip: '192.168.10.12', prefix: 24, gw: null },
      ADMIN: { ip: '192.168.99.10', prefix: 24, gw: null },
    },
    objectives: [], solution: {},
  }
}

const VLANS = [
  'vlan 10', 'vlan 99',
  'interface range fa0/1 - 2', 'switchport mode access', 'switchport access vlan 10',
  'interface fa0/3', 'switchport mode access', 'switchport access vlan 99',
]
const MGMT = ['interface vlan 99', 'ip address 192.168.99.2 255.255.255.0', 'no shutdown']
const BASE = [...VLANS, ...MGMT]

type Rt = ReturnType<typeof createLab>
const users = (rt: Rt) => rt.query().ping('PC-01', '192.168.10.12').ok
const admin = (rt: Rt) => rt.query().ping('ADMIN', '192.168.99.2').ok
const saved = (rt: Rt) => rt.query().saved('SW1')
const powerCycle = (rt: Rt) => {
  rt.setPower('SW1', false)
  rt.setPower('SW1', true)
}
/** Ayrıcalıklı moddan komutlar; IOS hata satırı (%) varsa testi düşürür. */
function cli(rt: Rt, script: string): string[] {
  const out = runScript(rt, 'SW1', script)
  expect(out.filter((l) => /^% (Invalid|Incomplete|Ambiguous)/.test(l))).toEqual([])
  return out
}
const SAVE_MGMT = `configure terminal\n${MGMT.join('\n')}\nend\nwrite memory`

describe('Konu #11: kaydetme ve yeniden başlatma', () => {
  it('S1: kaydedilmemiş yönetim ayarı kesintide kaybolur; kurup kaydedince kalır', () => {
    const rt = createLab(lab(VLANS))
    expect(admin(rt)).toBe(false)
    cli(rt, `configure terminal\n${MGMT.join('\n')}\nend`)
    expect(admin(rt)).toBe(true)
    expect(saved(rt)).toBe(false)
    powerCycle(rt) // gece elektrik kesintisi: senaryonun başlangıç durumu
    expect(admin(rt)).toBe(false)
    cli(rt, SAVE_MGMT)
    expect(admin(rt)).toBe(true)
    expect(saved(rt)).toBe(true)
    powerCycle(rt)
    expect(admin(rt)).toBe(true)
  })

  it('S2: kaydedilmemiş hatalı değişiklik reload (Save? no) ile geri alınır', () => {
    const rt = createLab(lab(BASE))
    cli(rt, 'configure terminal\ninterface fa0/2\nswitchport access vlan 20\nend')
    expect(users(rt)).toBe(false)
    const out = cli(rt, 'reload\nno\n')
    expect(out.join('\n')).toContain('System configuration has been modified. Save? [yes/no]')
    expect(users(rt)).toBe(true)
    expect(saved(rt)).toBe(true)
    powerCycle(rt)
    expect(users(rt)).toBe(true)
  })

  it('S2 tuzağı: reload sorusuna "yes" demek hatayı kalıcı yapar', () => {
    const rt = createLab(lab(BASE))
    cli(rt, 'configure terminal\ninterface fa0/2\nswitchport access vlan 20\nend')
    cli(rt, 'reload\nyes\n')
    expect(users(rt)).toBe(false)
    expect(saved(rt)).toBe(true)
    powerCycle(rt)
    expect(users(rt)).toBe(false)
  })

  it('S3: kaydedilmiş hata yeniden başlatmayla düzelmez; düzeltip kaydetmek gerekir', () => {
    const rt = createLab(lab(BASE))
    cli(rt, 'configure terminal\ninterface fa0/2\nshutdown\nend\nwrite memory')
    expect(users(rt)).toBe(false)
    powerCycle(rt)
    expect(users(rt)).toBe(false)
    cli(rt, 'configure terminal\ninterface fa0/2\nno shutdown\nend\nwrite memory')
    expect(users(rt)).toBe(true)
    expect(saved(rt)).toBe(true)
    powerCycle(rt)
    expect(users(rt)).toBe(true)
  })

  it('kaydedilmeyen düzeltme güç döngüsünde düşer (değerlendirici bunu yakalamalı)', () => {
    const rt = createLab(lab(BASE))
    cli(rt, 'configure terminal\ninterface fa0/2\nshutdown\nend\nwrite memory')
    cli(rt, 'configure terminal\ninterface fa0/2\nno shutdown\nend')
    expect(users(rt)).toBe(true)
    expect(saved(rt)).toBe(false)
    powerCycle(rt)
    expect(users(rt)).toBe(false)
  })
})

describe('Konu #11: yönetim adresi', () => {
  it('S4: yönetim SVI kapalıyken kullanıcılar çalışır ama switch yönetilemez', () => {
    const rt = createLab(lab([...BASE, 'interface vlan 99', 'shutdown']))
    expect(users(rt)).toBe(true)
    expect(admin(rt)).toBe(false)
    cli(rt, 'configure terminal\ninterface vlan 99\nno shutdown\nend\nwrite memory')
    expect(admin(rt)).toBe(true)
    expect(saved(rt)).toBe(true)
    powerCycle(rt)
    expect(admin(rt)).toBe(true)
  })

  it('S5: adres doğru ama yanlış VLAN arayüzünde (Vlan1); Vlan99\'a taşınınca ulaşılır', () => {
    const rt = createLab(
      lab([...VLANS, 'interface vlan 1', 'ip address 192.168.99.2 255.255.255.0', 'no shutdown']),
    )
    expect(admin(rt)).toBe(false)
    cli(
      rt,
      'configure terminal\ninterface vlan 1\nno ip address\nshutdown\n' +
        `${MGMT.join('\n')}\nend\nwrite memory`,
    )
    expect(admin(rt)).toBe(true)
    expect(saved(rt)).toBe(true)
    powerCycle(rt)
    expect(admin(rt)).toBe(true)
  })
})
