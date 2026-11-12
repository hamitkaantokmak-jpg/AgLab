// L5-b: DHCP sunucusu, relay (`ip helper-address`) ve PC DHCP istemcisi (VPCS `ip dhcp`).
// Kiralama kuralı src/engine/dhcp.js oracle'ı ile aynıdır; her davranış başarılı ve başarısız
// durumla sınanır.
import { describe, expect, it } from 'vitest'
import { createLab, createSession, runScript, type VpcsSession } from '../../src/sim'
import { dhcpLease } from '../../src/sim/net'
import type { LabRuntime } from '../../src/sim/runtime'
import type { LabDef, PcConfig } from '../../src/sim/types'
import { ports } from '../../src/sim/util'

/**
 * PC1 (VLAN 10) — SW1 — trunk — SW2 — R1 Gi0/0 (192.168.1.1, relay) ; R1 Gi0/1 — SRV
 * (10.10.20.2, DHCP). LOCAL: VLAN 10'da ikinci bir DHCP sunucusu (SW1 Fa0/3) isteğe bağlı.
 */
function lab(o: { r1?: string[]; sw1?: string[]; local?: boolean; pcs?: Record<string, PcConfig> } = {}): LabDef {
  return {
    id: 'l5b', title: '', summary: '', level: 'İleri', tags: [], brief: [], objectives: [], solution: {}, view: { w: 1, h: 1 },
    devices: [
      { id: 'SW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0020.0000', ports: [...ports('Fa0/1-3'), ...ports('Gi0/1-2')], x: 0, y: 0 },
      { id: 'SW2', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0030.0000', ports: [...ports('Fa0/1-3'), ...ports('Gi0/1-2')], x: 0, y: 0 },
      { id: 'R1', kind: 'switch', router: true, model: 'ISR4331', mac: '5254.0010.0000', ports: ports('Gi0/0-1'), x: 0, y: 0 },
      { id: 'PC1', kind: 'pc', mac: '0050.0000.0010', x: 0, y: 0 },
      { id: 'PC2', kind: 'pc', mac: '0050.0000.0020', x: 0, y: 0 },
      { id: 'SRV', kind: 'pc', mac: '0050.0000.0030', dhcpServer: true, x: 0, y: 0 },
      { id: 'LSRV', kind: 'pc', mac: '0050.0000.0040', dhcpServer: !!o.local, x: 0, y: 0 },
    ],
    links: [
      { a: ['PC1', 'eth0'], b: ['SW1', 'FastEthernet0/1'] },
      { a: ['PC2', 'eth0'], b: ['SW1', 'FastEthernet0/2'] },
      { a: ['LSRV', 'eth0'], b: ['SW1', 'FastEthernet0/3'] },
      { a: ['SW1', 'GigabitEthernet0/1'], b: ['SW2', 'GigabitEthernet0/1'] },
      { a: ['SW2', 'FastEthernet0/1'], b: ['R1', 'GigabitEthernet0/0'] },
      { a: ['R1', 'GigabitEthernet0/1'], b: ['SRV', 'eth0'] },
    ],
    initialConfig: {
      SW1: ['vlan 10', 'vlan 20', 'exit', 'interface range fa0/1 - 3', 'switchport mode access', 'switchport access vlan 10', 'interface gi0/1', 'switchport mode trunk', 'switchport trunk allowed vlan 10,20', ...(o.sw1 ?? [])].join('\n'),
      SW2: ['vlan 10', 'vlan 20', 'exit', 'interface fa0/1', 'switchport mode access', 'switchport access vlan 10', 'interface gi0/1', 'switchport mode trunk', 'switchport trunk allowed vlan 10,20'].join('\n'),
      R1: ['interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', ...(o.r1 ?? ['ip helper-address 10.10.20.2']), 'interface g0/1', 'ip address 10.10.20.1 255.255.255.0', 'no shutdown'].join('\n'),
    },
    initialPcs: {
      PC1: { ip: '169.254.30.8', prefix: 16, gw: null },
      SRV: { ip: '10.10.20.2', prefix: 24, gw: '10.10.20.1' },
      ...(o.local ? { LSRV: { ip: '192.168.1.5', prefix: 24, gw: '192.168.1.254' } } : {}),
      ...(o.pcs ?? {}),
    },
  }
}

const vpcs = (rt: LabRuntime, pc: string, line: string) => (createSession(rt, pc) as VpcsSession).exec(line).join('\n')
const cfg = (rt: LabRuntime, dev: string, script: string) => runScript(rt, dev, 'configure terminal\n' + script + '\nend')

describe('DHCP relay (ip helper-address)', () => {
  it('relay arayüzünün ağından ilk boş adres (100. host), ağ geçidi relay adresi; sunucuya ping', () => {
    const rt = createLab(lab())
    expect(vpcs(rt, 'PC1', 'ip dhcp')).toContain('DDORA IP 192.168.1.100/24 GW 192.168.1.1')
    expect(rt.pcs['PC1']).toEqual({ ip: '192.168.1.100', prefix: 24, gw: '192.168.1.1', dhcp: true })
    expect(vpcs(rt, 'PC1', 'ping 10.10.20.2')).toMatch(/bytes from 10\.10\.20\.2/)
    expect(runScript(rt, 'R1', 'show running-config').join('\n')).toContain(' ip address 192.168.1.1 255.255.255.0\n ip helper-address 10.10.20.2')
  })

  it('trunk VLAN 10\'u taşımıyorsa sunucu bulunamaz; düzeltilince kiralanır', () => {
    const rt = createLab(lab({ sw1: ['interface gi0/1', 'switchport trunk allowed vlan 20'] }))
    expect(vpcs(rt, 'PC1', 'ip dhcp')).toContain("Can't find dhcp server")
    expect(rt.pcs['PC1']!.ip).toBe('169.254.30.8')
    cfg(rt, 'SW1', 'interface gi0/1\nswitchport trunk allowed vlan 10,20')
    expect(vpcs(rt, 'PC1', 'ip dhcp')).toContain('DDORA IP 192.168.1.100/24')
  })

  it('helper yok ya da yanlış adres: kiralama yok; no ip helper-address siler', () => {
    for (const r1 of [[], ['ip helper-address 10.10.20.99']]) {
      const rt = createLab(lab({ r1 }))
      expect(vpcs(rt, 'PC1', 'ip dhcp'), JSON.stringify(r1)).toContain("Can't find dhcp server")
    }
    const rt = createLab(lab())
    cfg(rt, 'R1', 'interface g0/0\nno ip helper-address')
    expect(rt.running['R1']!.ifaces['GigabitEthernet0/0']!.helper).toBeUndefined()
    expect(vpcs(rt, 'PC1', 'ip dhcp')).toContain("Can't find dhcp server")
  })

  it('relay sunucuya ulaşamazsa (sunucu kapalı / rota yok) kiralama yok', () => {
    const rt = createLab(lab())
    rt.setPower('SRV', false)
    expect(vpcs(rt, 'PC1', 'ip dhcp')).toContain("Can't find dhcp server")
    const rt2 = createLab(lab())
    cfg(rt2, 'R1', 'interface g0/1\nshutdown')
    expect(dhcpLease(rt2.derived, 'PC1')).toEqual({ ok: false, reason: 'nopath' })
  })

  it('dolu adresler atlanır; elle verilen adres DHCP işaretini kaldırır', () => {
    const rt = createLab(lab({ pcs: { PC2: { ip: '192.168.1.100', prefix: 24, gw: '192.168.1.1' } } }))
    expect(vpcs(rt, 'PC1', 'ip dhcp')).toContain('DDORA IP 192.168.1.101/24')
    vpcs(rt, 'PC1', 'ip 192.168.1.50 255.255.255.0 192.168.1.1')
    expect(rt.pcs['PC1']!.dhcp).toBeUndefined()
  })
})

describe('yerel DHCP sunucusu', () => {
  it('aynı yayın alanındaki sunucu kendi ağından kiralar (ağ geçidi = sunucunun ağ geçidi), relay\'e gerek yok', () => {
    const rt = createLab(lab({ local: true, r1: [] }))
    expect(vpcs(rt, 'PC1', 'ip dhcp')).toContain('DDORA IP 192.168.1.100/24 GW 192.168.1.254')
  })
  it('DHCP sunucusu yoksa kiralama yok', () => {
    const def = lab()
    def.devices = def.devices.map((d) => (d.kind === 'pc' ? { ...d, dhcpServer: false } : d))
    expect(dhcpLease(createLab(def).derived, 'PC1')).toEqual({ ok: false, reason: 'noserver' })
  })
})

describe('router-on-a-stick alt arayüzünde relay', () => {
  it('Gi0/0.10 üzerindeki helper VLAN 10 istemcisine kiralar', () => {
    const rt = createLab(lab({ r1: ['no ip address', 'interface g0/0.10', 'encapsulation dot1Q 10', 'ip address 192.168.1.1 255.255.255.0', 'ip helper-address 10.10.20.2'] }))
    cfg(rt, 'SW2', 'interface fa0/1\nswitchport mode trunk\nswitchport trunk allowed vlan 10,20')
    expect(vpcs(rt, 'PC1', 'ip dhcp')).toContain('DDORA IP 192.168.1.100/24 GW 192.168.1.1')
    expect(runScript(rt, 'R1', 'show running-config').join('\n')).toContain('interface GigabitEthernet0/0.10\n encapsulation dot1Q 10\n ip address 192.168.1.1 255.255.255.0\n ip helper-address 10.10.20.2')
  })
})
