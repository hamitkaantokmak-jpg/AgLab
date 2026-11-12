// L5-f: CDP (varsayılan açık) ve LLDP (varsayılan kapalı) komşulukları. Komşu tablosu kablo,
// güç, shutdown ve cdp/lldp ayarına göre anında güncellenir; PC'ler CDP göndermez.
import { describe, expect, it } from 'vitest'
import { createLab, runScript } from '../../src/sim'
import { cdpNeighbors, lldpNeighbors } from '../../src/sim/discovery'
import type { LabRuntime } from '../../src/sim/runtime'
import type { LabDef } from '../../src/sim/types'
import { ports } from '../../src/sim/util'

/** PC1 — SW1 Fa0/1 ; SW1 Gi0/1 — SW2 Gi0/1 ; SW1 Gi0/2 — R1 Gi0/0 (10.0.0.1/24). SW2 Vlan1 10.0.0.2. */
function lab(): LabDef {
  return {
    id: 'l5f', title: '', summary: '', level: 'Orta', tags: [], brief: [], objectives: [], solution: {}, view: { w: 1, h: 1 },
    devices: [
      { id: 'SW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0010.0000', ports: [...ports('Fa0/1-2'), ...ports('Gi0/1-2')], x: 0, y: 0 },
      { id: 'SW2', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0020.0000', ports: [...ports('Fa0/1-2'), ...ports('Gi0/1-2')], x: 0, y: 0 },
      { id: 'R1', kind: 'switch', router: true, model: 'ISR4331', mac: '5254.0030.0000', ports: ports('Gi0/0-1'), x: 0, y: 0 },
      { id: 'PC1', kind: 'pc', mac: '0050.0000.0010', x: 0, y: 0 },
    ],
    links: [
      { a: ['PC1', 'eth0'], b: ['SW1', 'FastEthernet0/1'] },
      { a: ['SW1', 'GigabitEthernet0/1'], b: ['SW2', 'GigabitEthernet0/1'] },
      { a: ['SW1', 'GigabitEthernet0/2'], b: ['R1', 'GigabitEthernet0/0'] },
    ],
    initialConfig: {
      SW1: 'hostname SW1',
      SW2: 'hostname SW2\ninterface vlan 1\nip address 10.0.0.2 255.255.255.0\nno shutdown',
      R1: 'hostname R1\ninterface g0/0\nip address 10.0.0.1 255.255.255.0\nno shutdown',
    },
    initialPcs: { PC1: { ip: '10.0.0.10', prefix: 24, gw: null } },
  }
}
const run = (rt: LabRuntime, dev: string, line: string) => runScript(rt, dev, line).slice(1).join('\n')
const cfg = (rt: LabRuntime, dev: string, script: string) => runScript(rt, dev, 'configure terminal\n' + script + '\nend')
const cdpOf = (rt: LabRuntime, dev: string) => cdpNeighbors(rt.derived, dev).map((n) => `${n.port}>${n.dev}:${n.peerPort}`)

describe('CDP', () => {
  it('varsayılan açık: switch ve router komşuları IOS sütunlarıyla; PC görünmez', () => {
    const rt = createLab(lab())
    const out = run(rt, 'SW1', 'show cdp neighbors')
    expect(out).toContain('Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID')
    expect(out).toContain('SW2              Gig 0/1           180        S I         WS-C2960- Gig 0/1')
    expect(out).toContain('R1               Gig 0/2           180        R I         ISR4331   Gig 0/0')
    expect(out).toContain('Total cdp entries displayed : 2')
    expect(out).not.toContain('PC1')
    expect(cdpOf(rt, 'R1')).toEqual(['GigabitEthernet0/0>SW1:GigabitEthernet0/2'])
  })

  it('detail: IP adresi, platform ve IOS sürümü', () => {
    const rt = createLab(lab())
    const out = run(rt, 'SW1', 'show cdp neighbors detail')
    expect(out).toContain('Device ID: R1\nEntry address(es): \n  IP address: 10.0.0.1\nPlatform: cisco ISR4331,  Capabilities: Router IGMP ')
    expect(out).toContain('Interface: GigabitEthernet0/2,  Port ID (outgoing port): GigabitEthernet0/0')
    expect(out).toContain('Device ID: SW2\nEntry address(es): \n  IP address: 10.0.0.2')
    expect(out).toMatch(/Version :\nCisco IOS Software, WS-C2960-24TT-L Software/)
  })

  it('kablo çıkınca, karşı cihaz kapanınca ya da port shutdown olunca komşu anında düşer', () => {
    const rt = createLab(lab())
    rt.setLink('SW1', 'GigabitEthernet0/1', false)
    expect(cdpOf(rt, 'SW1')).toEqual(['GigabitEthernet0/2>R1:GigabitEthernet0/0'])
    expect(cdpOf(rt, 'SW2')).toEqual([])
    rt.setLink('SW1', 'GigabitEthernet0/1', true)
    expect(cdpOf(rt, 'SW1')).toHaveLength(2)
    rt.setPower('R1', false)
    expect(cdpOf(rt, 'SW1')).toEqual(['GigabitEthernet0/1>SW2:GigabitEthernet0/1'])
    rt.setPower('R1', true)
    cfg(rt, 'SW1', 'interface gi0/1\nshutdown')
    expect(cdpOf(rt, 'SW1')).toEqual(['GigabitEthernet0/2>R1:GigabitEthernet0/0'])
  })

  it('no cdp enable portunda komşu iki yönde de görünmez; show cdp interface o portu listelemez', () => {
    const rt = createLab(lab())
    cfg(rt, 'SW1', 'interface gi0/1\nno cdp enable')
    expect(cdpOf(rt, 'SW1')).toEqual(['GigabitEthernet0/2>R1:GigabitEthernet0/0'])
    expect(cdpOf(rt, 'SW2')).toEqual([])
    const ifs = run(rt, 'SW1', 'show cdp interface')
    expect(ifs).not.toContain('GigabitEthernet0/1 is')
    expect(ifs).toContain('GigabitEthernet0/2 is up, line protocol is up\n  Encapsulation ARPA\n  Sending CDP packets every 60 seconds\n  Holdtime is 180 seconds')
    expect(run(rt, 'SW1', 'show running-config')).toContain('interface GigabitEthernet0/1\n no cdp enable\n!')
    cfg(rt, 'SW1', 'interface gi0/1\ncdp enable')
    expect(cdpOf(rt, 'SW2')).toEqual(['GigabitEthernet0/1>SW1:GigabitEthernet0/1'])
  })

  it('no cdp run: kendi tablosu "% CDP is not enabled", komşular da onu görmez', () => {
    const rt = createLab(lab())
    cfg(rt, 'SW2', 'no cdp run')
    expect(run(rt, 'SW2', 'show cdp neighbors')).toBe('% CDP is not enabled')
    expect(run(rt, 'SW2', 'show cdp interface')).toBe('% CDP is not enabled')
    expect(cdpOf(rt, 'SW1')).toEqual(['GigabitEthernet0/2>R1:GigabitEthernet0/0'])
    expect(run(rt, 'SW2', 'show running-config')).toMatch(/\nno cdp run\n/)
    cfg(rt, 'SW2', 'cdp run')
    expect(cdpOf(rt, 'SW1')).toHaveLength(2)
  })

  it('native VLAN uyuşmazlığı syslog\'u CDP iletisidir: CDP kapalıyken yazılmaz', () => {
    const on = createLab(lab())
    cfg(on, 'SW1', 'interface gi0/1\nswitchport mode trunk')
    cfg(on, 'SW2', 'interface gi0/1\nswitchport mode trunk\nswitchport trunk native vlan 99')
    expect(on.logs.some((l) => l.text.includes('%CDP-4-NATIVE_VLAN_MISMATCH'))).toBe(true)
    const off = createLab(lab())
    cfg(off, 'SW1', 'no cdp run\ninterface gi0/1\nswitchport mode trunk')
    cfg(off, 'SW2', 'interface gi0/1\nswitchport mode trunk\nswitchport trunk native vlan 99')
    expect(off.logs.some((l) => l.text.includes('%CDP-4-NATIVE_VLAN_MISMATCH'))).toBe(false)
  })
})

describe('LLDP', () => {
  it('lldp run olmadan "% LLDP is not enabled"; yalnız bir uçta açıkken tablo boş', () => {
    const rt = createLab(lab())
    expect(run(rt, 'SW1', 'show lldp neighbors')).toBe('% LLDP is not enabled')
    cfg(rt, 'SW1', 'lldp run')
    expect(run(rt, 'SW1', 'show lldp neighbors')).toContain('Total entries displayed: 0')
    expect(lldpNeighbors(rt.derived, 'SW1')).toEqual([])
  })

  it('iki uçta açıkken komşu; detail; no lldp transmit / receive yönü keser', () => {
    const rt = createLab(lab())
    for (const d of ['SW1', 'SW2', 'R1']) cfg(rt, d, 'lldp run')
    const out = run(rt, 'SW1', 'show lldp neighbors')
    expect(out).toContain('Device ID           Local Intf     Hold-time  Capability      Port ID')
    expect(out).toContain('SW2                 Gi0/1          120        B               Gi0/1')
    expect(out).toContain('R1                  Gi0/2          120        R               Gi0/0')
    expect(out).toContain('Total entries displayed: 2')
    const det = run(rt, 'SW1', 'show lldp neighbors detail')
    expect(det).toContain('Local Intf: Gi0/2\nChassis id: 5254.0030.0000\nPort id: Gi0/0\nPort Description: GigabitEthernet0/0\nSystem Name: R1')
    expect(det).toContain('Management Addresses:\n    IP: 10.0.0.1')
    // SW2 göndermezse SW1 onu görmez, SW2 ise SW1'i görmeye devam eder
    cfg(rt, 'SW2', 'interface gi0/1\nno lldp transmit')
    expect(lldpNeighbors(rt.derived, 'SW1').map((n) => n.dev)).toEqual(['R1'])
    expect(lldpNeighbors(rt.derived, 'SW2').map((n) => n.dev)).toEqual(['SW1'])
    cfg(rt, 'SW2', 'interface gi0/1\nlldp transmit\nno lldp receive')
    expect(lldpNeighbors(rt.derived, 'SW2')).toEqual([])
    expect(run(rt, 'SW2', 'show running-config')).toMatch(/interface GigabitEthernet0\/1\n no lldp receive\n![\s\S]*\nlldp run\n/)
    rt.setLink('SW1', 'GigabitEthernet0/2', false)
    expect(lldpNeighbors(rt.derived, 'SW1').map((n) => n.dev)).toEqual(['SW2'])
  })
})
