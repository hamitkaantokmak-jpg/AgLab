// eBGP testlerinin ortak topolojileri ve yardımcıları (bgp.test.ts, bgp-policy.test.ts).
import { runScript } from '../../../src/sim'
import type { LabRuntime } from '../../../src/sim/runtime'
import type { DeviceDef, LabDef, LinkDef } from '../../../src/sim/types'
import { ports } from '../../../src/sim/util'

export const router = (id: string, n: number): DeviceDef => ({ id, kind: 'switch', router: true, model: 'ISR4331', mac: `5254.00${n}0.0000`, ports: ports('Gi0/0-3'), x: 0, y: 0 })
export const pc = (id: string, n: number): DeviceDef => ({ id, kind: 'pc', mac: `0050.0000.00${n}0`, x: 0, y: 0 })
export const ifc = (name: string, ip: string, mask: string) => [`interface ${name}`, `ip address ${ip} ${mask}`, 'no shutdown', 'exit']
export const j = (...xs: (string | string[])[]) => xs.flat().join('\n')
export const P30 = '255.255.255.252'
export const P24 = '255.255.255.0'

export function lab(devices: DeviceDef[], links: [string, string, string, string][], cfg: Record<string, string>, pcs: LabDef['initialPcs'] = {}): LabDef {
  return {
    id: 'bgp', title: '', summary: '', level: 'İleri', tags: [], brief: [], objectives: [], solution: {}, view: { w: 1, h: 1 },
    devices,
    links: links.map(([a, ap, b, bp]): LinkDef => ({ a: [a, ap], b: [b, bp] })),
    initialConfig: cfg,
    initialPcs: pcs,
  }
}

/**
 * Şube R1 (AS 65010, LAN 198.51.100.0/24) iki ISP'ye bağlı: R2 (ISP-A, AS 64500) ve R3 (ISP-B,
 * AS 64600); ikisi de uzak ağ R4'e (AS 64700, LAN 203.0.114.0/24) bağlı.
 *   R1 g0/1 203.0.113.2/30 — R2 g0/1 .1      R1 g0/2 192.0.2.2/30 — R3 g0/1 .1
 *   R2 g0/2 10.24.0.1/30 — R4 g0/1 .2        R3 g0/2 10.34.0.1/30 — R4 g0/2 .2
 * Router ID'ler 1.1.1.1 … 4.4.4.4. `extra` her router'ın BGP bloğuna eklenir (router bgp içinde).
 */
export function isp(extra: Partial<Record<'R1' | 'R2' | 'R3' | 'R4', string[]>> = {}, global: Partial<Record<'R1' | 'R2' | 'R3' | 'R4', string[]>> = {}, as: Partial<Record<'R2' | 'R3', number>> = {}): LabDef {
  const a2 = as.R2 ?? 64500,
    a3 = as.R3 ?? 64600
  return lab(
    [router('R1', 1), router('R2', 2), router('R3', 3), router('R4', 4), pc('H1', 1), pc('H4', 4)],
    [
      ['H1', 'eth0', 'R1', 'GigabitEthernet0/0'],
      ['R1', 'GigabitEthernet0/1', 'R2', 'GigabitEthernet0/1'],
      ['R1', 'GigabitEthernet0/2', 'R3', 'GigabitEthernet0/1'],
      ['R2', 'GigabitEthernet0/2', 'R4', 'GigabitEthernet0/1'],
      ['R3', 'GigabitEthernet0/2', 'R4', 'GigabitEthernet0/2'],
      ['R4', 'GigabitEthernet0/0', 'H4', 'eth0'],
    ],
    {
      R1: j(ifc('g0/0', '198.51.100.1', P24), ifc('g0/1', '203.0.113.2', P30), ifc('g0/2', '192.0.2.2', P30), global.R1 ?? [], [
        'router bgp 65010', 'bgp router-id 1.1.1.1', 'network 198.51.100.0', `neighbor 203.0.113.1 remote-as ${a2}`, `neighbor 192.0.2.1 remote-as ${a3}`, ...(extra.R1 ?? []), 'exit',
      ]),
      R2: j(ifc('g0/1', '203.0.113.1', P30), ifc('g0/2', '10.24.0.1', P30), global.R2 ?? [], [
        `router bgp ${a2}`, 'bgp router-id 2.2.2.2', 'neighbor 203.0.113.2 remote-as 65010', 'neighbor 10.24.0.2 remote-as 64700', ...(extra.R2 ?? []), 'exit',
      ]),
      R3: j(ifc('g0/1', '192.0.2.1', P30), ifc('g0/2', '10.34.0.1', P30), global.R3 ?? [], [
        `router bgp ${a3}`, 'bgp router-id 3.3.3.3', 'neighbor 192.0.2.2 remote-as 65010', 'neighbor 10.34.0.2 remote-as 64700', ...(extra.R3 ?? []), 'exit',
      ]),
      R4: j(ifc('g0/0', '203.0.114.1', P24), ifc('g0/1', '10.24.0.2', P30), ifc('g0/2', '10.34.0.2', P30), global.R4 ?? [], [
        'router bgp 64700', 'bgp router-id 4.4.4.4', 'network 203.0.114.0', `neighbor 10.24.0.1 remote-as ${a2}`, `neighbor 10.34.0.1 remote-as ${a3}`, ...(extra.R4 ?? []), 'exit',
      ]),
    },
    { H1: { ip: '198.51.100.10', prefix: 24, gw: '198.51.100.1' }, H4: { ip: '203.0.114.10', prefix: 24, gw: '203.0.114.1' } },
  )
}

/** İki router: R1 (AS 65010) g0/1 10.0.12.1/30 — R2 (AS 64500) g0/1 .2; loopback 1.1.1.1 / 2.2.2.2. */
export function pair(r1: string[] = [], r2: string[] = [], r1Bgp?: string[], r2Bgp?: string[]): LabDef {
  return lab([router('R1', 1), router('R2', 2)], [['R1', 'GigabitEthernet0/1', 'R2', 'GigabitEthernet0/1']], {
    R1: j(ifc('g0/1', '10.0.12.1', P30), ['interface loopback0', 'ip address 1.1.1.1 255.255.255.255', 'exit'], r1, r1Bgp ?? ['router bgp 65010', 'neighbor 10.0.12.2 remote-as 64500', 'exit']),
    R2: j(ifc('g0/1', '10.0.12.2', P30), ['interface loopback0', 'ip address 2.2.2.2 255.255.255.255', 'exit'], r2, r2Bgp ?? ['router bgp 64500', 'neighbor 10.0.12.1 remote-as 65010', 'exit']),
  })
}

export const conf = (rt: LabRuntime, dev: string, s: string) => runScript(rt, dev, 'configure terminal\n' + s + '\nend')
export const run = (rt: LabRuntime, dev: string, cmd: string) => runScript(rt, dev, cmd).slice(1).join('\n')
export const sess = (rt: LabRuntime, dev: string, ip: string) => rt.query().bgpSession(dev, ip)!
export const paths = (rt: LabRuntime, dev: string, net: string, prefix: number) => rt.query().bgpPaths(dev, net, prefix) ?? []
export const best = (rt: LabRuntime, dev: string, net: string, prefix: number) => paths(rt, dev, net, prefix).find((p) => p.best)
export const logs = (rt: LabRuntime, dev: string) => rt.logs.filter((l) => l.dev === dev).map((l) => l.text).join('\n')

