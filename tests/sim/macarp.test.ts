// L2-C: MAC/ARP eksikleri (plan L3 tablosu sıra 10–14) ve `show ip arp` Incomplete satırı.
//
// Her başlık için hem başarılı hem başarısız durum denenir. MAC tablosu yalnız trafik
// görmüş (öğrenilmiş) adresleri içerir; LabRuntime.query() öğrenilmiş kümeyle sorgu verir.
import { describe, expect, it } from 'vitest'
import { createLab, createSession, runScript } from '../../src/sim/index'
import { IosSession } from '../../src/sim/cli/ios'
import { VpcsSession } from '../../src/sim/cli/vpcs'
import { createRuntime, toAglab, toLabber } from '../../src/sim-bridge/bridge'
import type { AglabTopology } from '../../src/sim-bridge/aglab'
import { ports } from '../../src/sim/util'
import type { LabDef } from '../../src/sim/types'

const PC1_MAC = '0050.7966.0001'
const PC2_MAC = '0050.7966.0002'
const SVI_MAC = '5254.0001.0040' // taban + 0x40

// SW1 (L3): VLAN 10 = PC1 Fa0/1, PC2 Fa0/2 ; VLAN 20 = PC3 Fa0/4 ; Fa0/3, Fa0/5 boş (VLAN 10).
function lab(): LabDef {
  return {
    id: 'macarp', title: '', summary: '', level: 'Başlangıç', tags: [], brief: [], view: { w: 1, h: 1 },
    devices: [
      { id: 'SW1', kind: 'switch', model: 'WS-C3560-24PS', l3: true, mac: '5254.0001.0000', ports: ports('Fa0/1-6'), x: 0, y: 0 },
      { id: 'PC1', kind: 'pc', mac: PC1_MAC, x: 0, y: 0 },
      { id: 'PC2', kind: 'pc', mac: PC2_MAC, x: 0, y: 0 },
      { id: 'PC3', kind: 'pc', mac: '0050.7966.0003', x: 0, y: 0 },
    ],
    links: [
      { a: ['PC1', 'eth0'], b: ['SW1', 'FastEthernet0/1'] },
      { a: ['PC2', 'eth0'], b: ['SW1', 'FastEthernet0/2'] },
      { a: ['PC3', 'eth0'], b: ['SW1', 'FastEthernet0/4'] },
    ],
    initialConfig: {
      SW1: [
        'ip routing', 'vlan 10', 'vlan 20',
        'interface range fa0/1 - 3', 'switchport mode access', 'switchport access vlan 10',
        'interface fa0/4', 'switchport mode access', 'switchport access vlan 20',
        'interface vlan 10', 'ip address 192.168.10.1 255.255.255.0', 'no shutdown',
        'interface vlan 20', 'ip address 192.168.20.1 255.255.255.0', 'no shutdown',
      ].join('\n'),
    },
    initialPcs: {
      PC1: { ip: '192.168.10.11', prefix: 24, gw: '192.168.10.1' },
      PC2: { ip: '192.168.10.12', prefix: 24, gw: '192.168.10.1' },
      PC3: { ip: '192.168.20.13', prefix: 24, gw: '192.168.20.1' },
    },
    objectives: [], solution: {},
  }
}

type Rt = ReturnType<typeof createLab>
const ios = (rt: Rt, cmd: string) => {
  const s = new IosSession(rt, 'SW1')
  s.mode = 'priv'
  return s.exec(cmd)
}
const vpcs = (rt: Rt, pc: string, cmd: string) => (createSession(rt, pc) as VpcsSession).exec(cmd)
const syslog = (rt: Rt) => rt.logs.map((l) => `${l.dev} ${l.text.replace(/^\*\S+ +\S+ \S+: /, '')}`)

describe('10: show mac address-table address <mac>', () => {
  it('öğrenilmemiş adres 0 kayıt; öğrenilince IOS biçiminde tek satır', () => {
    const rt = createLab(lab())
    const header = ['          Mac Address Table', '-------------------------------------------', '', 'Vlan    Mac Address       Type        Ports', '----    -----------       --------    -----']
    expect(ios(rt, `show mac address-table address ${PC1_MAC}`)).toEqual([...header, 'Total Mac Addresses for this criterion: 0'])
    vpcs(rt, 'PC1', 'ping 192.168.10.12')
    expect(ios(rt, `show mac address-table address ${PC1_MAC}`)).toEqual([
      ...header,
      '  10    0050.7966.0001    DYNAMIC     Fa0/1',
      'Total Mac Addresses for this criterion: 1',
    ])
    // kısa gruplu yazım da kabul edilir (IOS H.H.H)
    expect(ios(rt, 'show mac address-table address 50.7966.1')).toContain('  10    0050.7966.0001    DYNAMIC     Fa0/1')
    // tabloda olmayan adres
    expect(ios(rt, 'show mac address-table address 0050.7966.00ff').at(-1)).toBe('Total Mac Addresses for this criterion: 0')
  })

  it('geçersiz MAC reddedilir, yardım H.H.H gösterir', () => {
    const rt = createLab(lab())
    expect(ios(rt, 'show mac address-table address zzzz.0000.0001').join('\n')).toMatch(/% Invalid input/)
    expect(ios(rt, 'show mac address-table address 0050.7966').join('\n')).toMatch(/% Invalid input/)
    expect(ios(rt, 'show mac address-table ?').join('\n')).toMatch(/^  address\b/m)
    expect(ios(rt, 'show mac address-table address ?').join('\n')).toMatch(/H\.H\.H +48 bit mac address/)
  })
})

describe('11: PC show arp', () => {
  it('ping öncesi boş, sonra dolu; başka alt ağ için ağ geçidinin MAC adresi', () => {
    const rt = createLab(lab())
    expect(vpcs(rt, 'PC1', 'show arp')).toEqual(['', 'arp table is empty', ''])
    vpcs(rt, 'PC1', 'ping 192.168.10.12')
    expect(vpcs(rt, 'PC1', 'show arp')).toEqual(['', '00:50:79:66:00:02  192.168.10.12 expires in 120 seconds ', ''])
    // VLAN 20'deki PC3: kayıt hedefin değil ağ geçidinin (SVI) MAC'i
    expect(vpcs(rt, 'PC1', 'ping 192.168.20.13').join('\n')).toMatch(/84 bytes from 192\.168\.20\.13/)
    const arp = vpcs(rt, 'PC1', 'show arp').join('\n')
    expect(arp).toContain('52:54:00:01:00:40  192.168.10.1 expires in 120 seconds')
    expect(arp).not.toContain('192.168.20.13')
    // diğer PC'nin tablosu etkilenmez
    expect(vpcs(rt, 'PC2', 'show arp')).toEqual(['', 'arp table is empty', ''])
  })

  it('yanıtsız hedef ARP tablosuna girmez', () => {
    const rt = createLab(lab())
    expect(vpcs(rt, 'PC1', 'ping 192.168.10.99').join('\n')).toMatch(/timeout/)
    expect(vpcs(rt, 'PC1', 'show arp')).toEqual(['', 'arp table is empty', ''])
  })
})

describe('show ip arp: Incomplete', () => {
  it('yanıtsız komşu Incomplete; adres gelince gerçek kayıt; clear arp-cache temizler', () => {
    const rt = createLab(lab())
    expect(ios(rt, 'ping 192.168.10.99').join('\n')).toMatch(/Success rate is 0 percent/)
    expect(ios(rt, 'show ip arp')).toContain('Internet  192.168.10.99    0          Incomplete      ARPA')
    // ulaşılan adres Incomplete olmaz
    ios(rt, 'ping 192.168.10.11')
    const arp = ios(rt, 'show ip arp')
    expect(arp).toContain(`Internet  192.168.10.11    0          ${PC1_MAC}  ARPA   Vlan10`)
    expect(arp.filter((l) => l.includes('Incomplete'))).toEqual(['Internet  192.168.10.99    0          Incomplete      ARPA'])
    // adres sonradan kullanılınca Incomplete kalkar
    vpcs(rt, 'PC2', 'ip 192.168.10.99 255.255.255.0 192.168.10.1')
    ios(rt, 'ping 192.168.10.99')
    expect(ios(rt, 'show ip arp').filter((l) => l.includes('Incomplete'))).toEqual([])
    ios(rt, 'ping 192.168.10.77')
    ios(rt, 'clear arp-cache')
    expect(ios(rt, 'show ip arp').filter((l) => l.includes('Incomplete') || l.includes('192.168.10.11'))).toEqual([])
  })
})

describe('12: aynı IP iki cihazda', () => {
  it('SVI ile çakışma: %IP-4-DUPADDR bir kez, ipUnique false, yanıtlayan belirli; çakışma kalkınca kesilir', () => {
    const rt = createLab(lab())
    expect(rt.query().ipUnique('192.168.10.1')).toBe(true)
    vpcs(rt, 'PC2', 'ip 192.168.10.1 255.255.255.0')
    const dup = `SW1 %IP-4-DUPADDR: Duplicate address 192.168.10.1 on Vlan10, sourced by ${PC2_MAC}`
    expect(syslog(rt)).toContain(dup)
    expect(rt.query().ipUnique('192.168.10.1')).toBe(false)
    expect(rt.query().duplicates('192.168.10.1')).toEqual(['SW1', 'PC2'])
    // belirli yanıtlayan: tanım sırasında ilk cihaz (SW1); tekrar denemede değişmez
    for (let i = 0; i < 3; i++) {
      const r = rt.query().ping('PC1', '192.168.10.1')
      expect(r.ok).toBe(true)
      expect(r.replier).toBe('SW1')
    }
    // başka bir yapılandırma değişikliği yeni syslog üretmez
    runScript(rt, 'SW1', 'configure terminal\nhostname CORE\nend')
    expect(syslog(rt).filter((l) => l.includes('DUPADDR'))).toEqual([dup])
    // çakışma kalkar
    vpcs(rt, 'PC2', 'ip 192.168.10.12 255.255.255.0 192.168.10.1')
    expect(rt.query().ipUnique('192.168.10.1')).toBe(true)
    expect(syslog(rt).filter((l) => l.includes('DUPADDR'))).toEqual([dup])
    // yeniden çakışınca yeniden bildirilir
    vpcs(rt, 'PC2', 'ip 192.168.10.1 255.255.255.0')
    expect(syslog(rt).filter((l) => l.includes('DUPADDR'))).toEqual([dup, dup])
  })

  it('iki PC çakışır: switch syslog yazmaz, ilk PC yanıtlar, diğerinin ping yanıtı ona gitmez', () => {
    const rt = createLab(lab())
    vpcs(rt, 'PC2', 'ip 192.168.10.11 255.255.255.0 192.168.10.1')
    expect(rt.query().ipUnique('192.168.10.11')).toBe(false)
    expect(syslog(rt).filter((l) => l.includes('DUPADDR'))).toEqual([])
    const r = rt.query().ping('SW1', '192.168.10.11')
    expect(r.ok).toBe(true)
    expect(r.replier).toBe('PC1')
    // PC2 ağ geçidine ping atar ama yanıt aynı IP'nin ARP sahibine (PC1) gider
    expect(rt.query().ping('PC2', '192.168.10.1').ok).toBe(false)
    expect(rt.query().ping('PC1', '192.168.10.1').ok).toBe(true)
  })

  it('farklı yayın alanlarında aynı IP çakışma sayılmaz', () => {
    const rt = createLab(lab())
    runScript(rt, 'SW1', 'configure terminal\ninterface fa0/2\nswitchport access vlan 20\nend')
    vpcs(rt, 'PC2', 'ip 192.168.10.11 255.255.255.0')
    expect(rt.query().ipUnique('192.168.10.11')).toBe(true)
  })
})

describe('13: kablonun başka porta taşınması', () => {
  it('eski porttaki MAC kaydı kalmaz; yeni port yanlış VLAN\'da ping başarısız, düzeltilince başarılı', () => {
    const rt = createLab(lab())
    vpcs(rt, 'PC1', 'ping 192.168.10.12')
    expect(rt.query().macPort('SW1', PC1_MAC)).toBe('FastEthernet0/1')
    // VLAN 20'deki Fa0/4 dolu; boş Fa0/6 VLAN 1'de
    expect(rt.moveCable('SW1', 'FastEthernet0/1', 'SW1', 'FastEthernet0/4')).toBe(false)
    expect(rt.moveCable('SW1', 'FastEthernet0/1', 'SW1', 'FastEthernet0/6')).toBe(true)
    expect(rt.query().macPort('SW1', PC1_MAC)).toBeNull()
    expect(ios(rt, 'show mac address-table').join('\n')).not.toContain(PC1_MAC)
    expect(rt.query().linkUp('SW1', 'Fa0/1')).toBe(false)
    expect(rt.query().linkUp('SW1', 'Fa0/6')).toBe(true)
    expect(vpcs(rt, 'PC1', 'ping 192.168.10.12').join('\n')).toMatch(/timeout/)
    expect(rt.query().macPort('SW1', PC1_MAC)).toBeNull()
    runScript(rt, 'SW1', 'configure terminal\ninterface fa0/6\nswitchport mode access\nswitchport access vlan 10\nend')
    expect(vpcs(rt, 'PC1', 'ping 192.168.10.12').join('\n')).toMatch(/84 bytes/)
    expect(rt.query().macPort('SW1', PC1_MAC)).toBe('FastEthernet0/6')
    expect(rt.query().macVlan('SW1', PC1_MAC)).toBe(10)
  })

  it('kablo çıkarılınca o porttaki MAC kaydı silinir; takılınca trafik olana kadar boş kalır', () => {
    const rt = createLab(lab())
    vpcs(rt, 'PC1', 'ping 192.168.10.12')
    expect(rt.query().macPort('SW1', PC2_MAC)).toBe('FastEthernet0/2')
    rt.setLink('PC2', 'eth0', false)
    rt.setLink('PC2', 'eth0', true)
    expect(rt.query().macPort('SW1', PC2_MAC)).toBeNull()
    expect(rt.query().macPort('SW1', PC1_MAC)).toBe('FastEthernet0/1')
    vpcs(rt, 'PC1', 'ping 192.168.10.12')
    expect(rt.query().macPort('SW1', PC2_MAC)).toBe('FastEthernet0/2')
  })

  it('köprü taşınan kabloyu AğLab JSON\'una özgün port adıyla geri yazar', () => {
    const t: AglabTopology = {
      devices: [
        { id: 'p1', name: 'PC1', type: 'PC', enabled: true, ip: '10.0.0.1', mask: '255.255.255.0', ports: ['eth0'], interfaces: { eth0: { enabled: true } } },
        { id: 's1', name: 'SW1', type: 'Switch', enabled: true, ports: ['fa0/1', 'fa0/2'], vlans: [1],
          interfaces: { 'fa0/1': { mode: 'access', vlan: 1 }, 'fa0/2': { mode: 'access', vlan: 1 } } },
      ],
      links: [{ a: 'p1', portA: 'eth0', b: 's1', portB: 'fa0/1', up: true }],
    }
    const rt = createRuntime(toLabber(t))
    expect(toAglab(rt, t)).toEqual(t)
    expect(rt.moveCable('s1', 'FastEthernet0/1', 's1', 'FastEthernet0/2')).toBe(true)
    expect(toAglab(rt, t).links).toEqual([{ a: 'p1', portA: 'eth0', b: 's1', portB: 'fa0/2', up: true }])
  })
})

describe('14: LabQuery yardımcıları', () => {
  it('macTable / macPort / macVlan: öğrenilmeden boş, öğrenilince dolu', () => {
    const rt = createLab(lab())
    expect(rt.query().macTable('SW1')).toEqual([])
    expect(rt.query().macPort('SW1', PC1_MAC)).toBeNull()
    expect(rt.query().macVlan('SW1', PC1_MAC)).toBeNull()
    vpcs(rt, 'PC1', 'ping 192.168.20.13')
    expect(rt.query().macTable('SW1')).toEqual([
      { vlan: 10, mac: PC1_MAC, port: 'FastEthernet0/1' },
      { vlan: 20, mac: '0050.7966.0003', port: 'FastEthernet0/4' },
    ])
    // MAC yazımı serbest: 0050.7966.0001, 00:50:79:66:00:01, 0050.7966.1
    expect(rt.query().macPort('SW1', '00:50:79:66:00:01')).toBe('FastEthernet0/1')
    expect(rt.query().macVlan('SW1', '0050.7966.3')).toBe(20)
    expect(rt.query().macPort('SW1', SVI_MAC), 'switch kendi SVI MAC adresini öğrenmez').toBeNull()
  })

  it('ping().replier: başarılı ping yanıtlayanı verir, başarısızda yoktur', () => {
    const rt = createLab(lab())
    expect(rt.query().ping('PC1', '192.168.20.13').replier).toBe('PC3')
    expect(rt.query().ping('PC1', '192.168.10.1').replier).toBe('SW1')
    expect(rt.query().ping('PC1', '192.168.10.99').replier).toBeUndefined()
  })
})
