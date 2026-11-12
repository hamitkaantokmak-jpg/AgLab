// L5-f: CDP ve LLDP komşulukları ve IOS biçimli `show` çıktıları.
//
// Komşu tablosu türetilmiş durumdan anında hesaplanır: kablo, güç, shutdown, err-disable
// ya da cdp/lldp ayarı değişince bir sonraki `show` yeni durumu gösterir. Holdtime sayacı
// simüle edilmez (UYUMLULUK_MATRISI "L5-f"): Holdtme sütunu yapılandırılmış süreyi gösterir.
// PC'ler (VPCS) CDP/LLDP göndermez.

import type { Derived } from './engine'
import { l3Ifs } from './net'
import type { LabRuntime } from './runtime'
import { pk } from './topology'
import type { PhysIfConfig, SwitchConfig, SwitchDef } from './types'
import { pad, shortIf } from './util'

export const CDP_HOLDTIME = 180
export const LLDP_HOLDTIME = 120

export const cdpOn = (c: SwitchConfig) => c.cdpRun !== false
export const lldpOn = (c: SwitchConfig) => c.lldpRun === true
const cdpPort = (c: PhysIfConfig | undefined) => !!c && c.cdp !== false
const lldpTx = (c: PhysIfConfig | undefined) => !!c && c.lldpTx !== false
const lldpRx = (c: PhysIfConfig | undefined) => !!c && c.lldpRx !== false

export interface Neighbor {
  /** local physical port (canonical) */
  port: string
  dev: string
  /** neighbour's port (canonical) */
  peerPort: string
}

/** Physical links that are up towards another IOS device (PCs send nothing). */
function upLinks(d: Derived, dev: string): Neighbor[] {
  const sw = d.topo.devices[dev] as SwitchDef
  if (!sw || sw.kind !== 'switch' || d.hw.off.has(dev)) return []
  const out: Neighbor[] = []
  for (const port of sw.ports) {
    const ps = d.phys[pk(dev, port)]
    if (!ps?.up || !ps.peer || ps.peerIsPc) continue
    out.push({ port, dev: ps.peer.dev, peerPort: ps.peer.port })
  }
  return out
}

/** CDP: both ends run CDP globally and on the port (`no cdp enable` stops send and receive). */
export function cdpNeighbors(d: Derived, dev: string): Neighbor[] {
  const me = d.cfgs[dev]
  if (!me || !cdpOn(me)) return []
  return upLinks(d, dev).filter((n) => {
    const peer = d.cfgs[n.dev]!
    return cdpPort(me.ifaces[n.port]) && cdpOn(peer) && cdpPort(peer.ifaces[n.peerPort])
  })
}

/** LLDP: both ends run LLDP; the neighbour transmits on its port and we receive on ours. */
export function lldpNeighbors(d: Derived, dev: string): Neighbor[] {
  const me = d.cfgs[dev]
  if (!me || !lldpOn(me)) return []
  return upLinks(d, dev).filter((n) => {
    const peer = d.cfgs[n.dev]!
    return lldpRx(me.ifaces[n.port]) && lldpOn(peer) && lldpTx(peer.ifaces[n.peerPort])
  })
}

/**
 * CDP runs between these two (logical) ports: CDP on both devices and, for physical ports,
 * on both ports. `%CDP-4-NATIVE_VLAN_MISMATCH` is a CDP message: with CDP off it is not
 * logged (the mismatch itself still breaks traffic).
 */
export function cdpBetween(d: Derived, dev: string, port: string, peerDev: string, peerPort: string): boolean {
  const a = d.cfgs[dev], b = d.cfgs[peerDev]
  if (!a || !b || !cdpOn(a) || !cdpOn(b)) return false
  const phys = (c: SwitchConfig, p: string) => (c.ifaces[p] ? cdpPort(c.ifaces[p]) : true)
  return phys(a, port) && phys(b, peerPort)
}

/** `Gig 0/1`, `Fas 0/1` (CDP's three-letter interface column). */
function cdpIf(name: string): string {
  const m = /^([A-Za-z]+?)(?:Ethernet|-channel)?(\d.*)$/.exec(name)
  if (!m) return name
  return m[1]!.slice(0, 3) + ' ' + m[2]!
}

function cdpCaps(sw: SwitchDef): string {
  // doğrulanmadı: ISR ve 3650 platformlarının tam yetenek listesi
  return sw.router ? 'R I' : sw.l3 ? 'R S I' : 'S I'
}
function cdpCapWords(sw: SwitchDef): string {
  return sw.router ? 'Router IGMP' : sw.l3 ? 'Router Switch IGMP' : 'Switch IGMP'
}
function lldpCaps(sw: SwitchDef): string {
  return sw.router ? 'R' : sw.l3 ? 'B,R' : 'B'
}

/** Address the neighbour advertises: the routed port's own address, else the first SVI. */
function mgmtIp(rt: LabRuntime, dev: string, port: string): string | null {
  const ifs = l3Ifs(rt.derived, dev)
  return ifs.find((i) => i.name === port)?.ip ?? ifs.find((i) => i.kind === 'svi')?.ip ?? null
}

function versionLine(sw: SwitchDef): string {
  return sw.router
    ? `Cisco IOS Software, ISR Software (${sw.model}), Version 15.4(3)M (Labber Simulated), RELEASE SOFTWARE`
    : `Cisco IOS Software, ${sw.model} Software (Labber Simulated), Version 15.2(7)E, RELEASE SOFTWARE`
}

const CDP_HEADER = [
  'Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge',
  '                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone,',
  '                  D - Remote, C - CVTA, M - Two-port Mac Relay',
  '',
]

export function showCdpNeighbors(rt: LabRuntime, dev: string, detail: boolean): string[] {
  if (!cdpOn(rt.running[dev]!)) return ['% CDP is not enabled']
  const ns = cdpNeighbors(rt.derived, dev)
  if (detail) {
    const o: string[] = []
    for (const n of ns) {
      const peer = rt.topo.devices[n.dev] as SwitchDef
      const ip = mgmtIp(rt, n.dev, n.peerPort)
      o.push(
        '-------------------------',
        `Device ID: ${rt.hostname(n.dev)}`,
        'Entry address(es): ',
        ...(ip ? [`  IP address: ${ip}`] : []),
        `Platform: cisco ${peer.model},  Capabilities: ${cdpCapWords(peer)} `,
        `Interface: ${n.port},  Port ID (outgoing port): ${n.peerPort}`,
        `Holdtime : ${CDP_HOLDTIME} sec`,
        '',
        'Version :',
        versionLine(peer),
        'Technical Support: http://www.cisco.com/techsupport',
        '',
        'advertisement version: 2',
        'Duplex: full',
        'Management address(es): ',
        ...(ip ? [`  IP address: ${ip}`] : []),
        '',
      )
    }
    o.push('', `Total cdp entries displayed : ${ns.length}`)
    return o
  }
  const o = [...CDP_HEADER, 'Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID']
  for (const n of ns) {
    const peer = rt.topo.devices[n.dev] as SwitchDef
    o.push(pad(rt.hostname(n.dev), 17) + pad(cdpIf(n.port), 18) + pad(CDP_HOLDTIME, 11) + pad(cdpCaps(peer), 12) + pad(peer.model.slice(0, 9), 10) + cdpIf(n.peerPort))
  }
  o.push('', `Total cdp entries displayed : ${ns.length}`)
  return o
}

/** `show cdp interface [<if>]`: ports where CDP runs (`no cdp enable` ports are left out). */
export function showCdpInterface(rt: LabRuntime, dev: string, only?: string): string[] {
  const c = rt.running[dev]!
  if (!cdpOn(c)) return ['% CDP is not enabled']
  const sw = rt.topo.devices[dev] as SwitchDef
  const o: string[] = []
  let up = 0
  let total = 0
  for (const port of sw.ports) {
    if (only && port !== only) continue
    if (!cdpPort(c.ifaces[port])) continue
    const ps = rt.derived.phys[pk(dev, port)]!
    total++
    if (ps.up) up++
    o.push(
      `${port} is ${ps.adminDown ? 'administratively down' : ps.up ? 'up' : 'down'}, line protocol is ${ps.up ? 'up' : 'down'}`,
      '  Encapsulation ARPA',
      '  Sending CDP packets every 60 seconds',
      `  Holdtime is ${CDP_HOLDTIME} seconds`,
    )
  }
  if (!only) o.push('', ` cdp enabled interfaces : ${total}`, ` interfaces up          : ${up}`, ` interfaces down        : ${total - up}`)
  return o
}

export function showLldpNeighbors(rt: LabRuntime, dev: string, detail: boolean): string[] {
  if (!lldpOn(rt.running[dev]!)) return ['% LLDP is not enabled']
  const ns = lldpNeighbors(rt.derived, dev)
  if (detail) {
    const o: string[] = []
    for (const n of ns) {
      const peer = rt.topo.devices[n.dev] as SwitchDef
      const ip = mgmtIp(rt, n.dev, n.peerPort)
      const caps = lldpCaps(peer)
      o.push(
        '------------------------------------------------',
        `Local Intf: ${shortIf(n.port)}`,
        `Chassis id: ${peer.mac}`,
        `Port id: ${shortIf(n.peerPort)}`,
        `Port Description: ${n.peerPort}`,
        `System Name: ${rt.hostname(n.dev)}`,
        '',
        'System Description: ',
        versionLine(peer),
        'Technical Support: http://www.cisco.com/techsupport',
        '',
        `Time remaining: ${LLDP_HOLDTIME} seconds`,
        `System Capabilities: ${caps}`,
        `Enabled Capabilities: ${caps}`,
        'Management Addresses:',
        ...(ip ? [`    IP: ${ip}`] : ['    - not advertised']),
        'Auto Negotiation - supported, enabled',
        '',
      )
    }
    o.push('', `Total entries displayed: ${ns.length}`)
    return o
  }
  const o = [
    'Capability codes:',
    '    (R) Router, (B) Bridge, (T) Telephone, (C) DOCSIS Cable Device',
    '    (W) WLAN Access Point, (P) Repeater, (S) Station, (O) Other',
    '',
    'Device ID           Local Intf     Hold-time  Capability      Port ID',
  ]
  for (const n of ns) {
    const peer = rt.topo.devices[n.dev] as SwitchDef
    o.push(pad(rt.hostname(n.dev).slice(0, 19), 20) + pad(shortIf(n.port), 15) + pad(LLDP_HOLDTIME, 11) + pad(lldpCaps(peer), 16) + shortIf(n.peerPort))
  }
  o.push('', `Total entries displayed: ${ns.length}`)
  return o
}
