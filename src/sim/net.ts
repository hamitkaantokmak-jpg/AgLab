// L2 reachability and L3 forwarding on top of the derived state.

import { crossVlan, egress, ingress, peerOf, portForwards, type Derived, type LPort } from './engine'
import { pk } from './topology'
import type { SwitchDef } from './types'
import { ifType, ipToInt, macAdd, maskToPrefix, prefixMaskInt, sameSubnet } from './util'

export interface Node {
  dev: string
  vlan: number
}
const nk = (n: Node) => `${n.dev}|${n.vlan}`

/** A routed port is its own segment; encoded as a negative pseudo-VLAN. */
export function routedNode(d: Derived, dev: string, port: string): Node {
  const sw = d.topo.devices[dev] as SwitchDef
  return { dev, vlan: -(sw.ports.indexOf(port) + 1) }
}
export function routedPortOf(d: Derived, n: Node): string | null {
  if (n.vlan >= 0) return null
  return (d.topo.devices[n.dev] as SwitchDef).ports[-n.vlan - 1] ?? null
}

export interface L3If {
  dev: string
  kind: 'pc' | 'svi' | 'routed' | 'loop'
  name: string
  ip: string
  prefix: number
  mac: string
  node: Node | null
}

export interface Domain {
  nodes: Map<string, { node: Node; via: { from: string; out: string; in: string } | null }>
}

/** Every switch/VLAN segment reachable from a start segment. */
export function l2Domain(d: Derived, start: Node): Domain {
  const nodes: Domain['nodes'] = new Map()
  nodes.set(nk(start), { node: start, via: null })
  const queue = [start]
  const add = (next: Node, from: Node, out: string, inn: string) => {
    if (nodes.has(nk(next))) return
    nodes.set(nk(next), { node: next, via: { from: nk(from), out, in: inn } })
    queue.push(next)
  }
  while (queue.length) {
    const n = queue.shift()!
    const rport = routedPortOf(d, n)
    if (rport) {
      // routed port: untagged frames straight to whatever is on the other end
      const lp = d.lportByName[pk(n.dev, rport)]
      const p = lp?.active ? peerOf(d, lp) : null
      if (!p || !p.active) continue
      if (p.routed) add(routedNode(d, p.dev, p.name), n, lp!.name, p.name)
      else {
        const v2 = ingress(d, p, 'u', 0)
        if (v2 !== null && portForwards(d, p.dev, p, v2)) add({ dev: p.dev, vlan: v2 }, n, lp!.name, p.name)
      }
      continue
    }
    for (const lp of d.lports[n.dev] ?? []) {
      if (!portForwards(d, n.dev, lp, n.vlan)) continue
      const p = peerOf(d, lp)
      if (!p) continue
      if (p.routed) {
        if (p.active && egress(d, lp, n.vlan) === 'u') add(routedNode(d, p.dev, p.name), n, lp.name, p.name)
        continue
      }
      const v2 = crossVlan(d, lp, n.vlan)
      if (v2 === null || !portForwards(d, p.dev, p, v2)) continue
      const next = { dev: p.dev, vlan: v2 }
      if (nodes.has(nk(next))) continue
      nodes.set(nk(next), { node: next, via: { from: nk(n), out: lp.name, in: p.name } })
      queue.push(next)
    }
  }
  return { nodes }
}

/** Segment a PC lands in through its access port. */
export function pcNode(d: Derived, pc: string): Node | null {
  const at = d.topo.pcAttach[pc]
  if (!at) return null
  const lp = d.lportOfPhys[pk(at.dev, at.port)]
  if (!lp || !lp.active) return null
  if (lp.routed) return routedNode(d, at.dev, at.port)
  const v = ingress(d, lp, 'u', 0)
  if (v === null || !portForwards(d, at.dev, lp, v)) return null
  return { dev: at.dev, vlan: v }
}

export function pcPort(d: Derived, pc: string): LPort | null {
  const at = d.topo.pcAttach[pc]
  return at ? (d.lportOfPhys[pk(at.dev, at.port)] ?? null) : null
}

export function l3Ifs(d: Derived, dev: string): L3If[] {
  const def = d.topo.devices[dev]!
  if (def.kind === 'pc') {
    const c = d.pcs[dev]
    if (!c?.ip) return []
    return [{ dev, kind: 'pc', name: 'eth0', ip: c.ip, prefix: c.prefix, mac: def.mac, node: pcNode(d, dev) }]
  }
  const out: L3If[] = []
  for (const s of d.svis[dev] ?? []) {
    if (!s.up || !s.ip || !s.mask) continue
    out.push({ dev, kind: 'svi', name: 'Vlan' + s.vlan, ip: s.ip, prefix: maskToPrefix(s.mask)!, mac: s.mac, node: { dev, vlan: s.vlan } })
  }
  const cfg = d.cfgs[dev]!
  const sw = def as SwitchDef
  for (const port of sw.ports) {
    const c = cfg.ifaces[port]!
    if (!c.routed || !c.ip) continue
    const lp = d.lportByName[pk(dev, port)]
    if (!lp?.active) continue
    out.push({ dev, kind: 'routed', name: port, ip: c.ip.addr, prefix: maskToPrefix(c.ip.mask)!, mac: macAdd(sw.mac, sw.ports.indexOf(port) + 1), node: routedNode(d, dev, port) })
  }
  for (const [n, l] of Object.entries(cfg.loopbacks ?? {})) {
    if (l.shutdown || !l.ip) continue
    out.push({ dev, kind: 'loop', name: 'Loopback' + n, ip: l.ip.addr, prefix: maskToPrefix(l.ip.mask)!, mac: '0000.0000.0000', node: null })
  }
  return out
}

/** Interface bandwidth in kbit/s (IOS defaults). */
export function ifBandwidth(name: string, override?: number): number {
  if (override) return override
  if (name.startsWith('Loopback')) return 8_000_000
  if (name.startsWith('Vlan')) return 1_000_000
  return (ifType(name)?.speed ?? 100) * 1000
}

export function allL3Ifs(d: Derived): L3If[] {
  return d.topo.lab.devices.flatMap((x) => l3Ifs(d, x.id))
}

export function isRouter(d: Derived, dev: string): boolean {
  const def = d.topo.devices[dev]!
  return def.kind === 'switch' && !!def.l3 && d.cfgs[dev]!.ipRouting
}

export type RouteCode = 'C' | 'S' | 'L' | 'O' | 'O IA' | 'O E2'

export interface RouteEntry {
  code: RouteCode
  net: string
  prefix: number
  nh: string | null
  ifname: string
  /** OSPF: [110/metric] and all equal-cost paths */
  metric?: number
  paths?: { nh: string; ifname: string }[]
}

const RANK: Record<RouteCode, number> = { L: 0, C: 0, S: 1, O: 2, 'O IA': 2, 'O E2': 2 }

/** Routing table of a routing switch (connected + resolvable static). */
export function routeTable(d: Derived, dev: string): RouteEntry[] {
  const ifs = l3Ifs(d, dev)
  const out: RouteEntry[] = []
  for (const i of ifs) {
    const m = prefixMaskInt(i.prefix)
    out.push({ code: 'C', net: intTo((ipToInt(i.ip)! & m) >>> 0), prefix: i.prefix, nh: null, ifname: i.name })
    if (i.prefix < 32) out.push({ code: 'L', net: i.ip, prefix: 32, nh: null, ifname: i.name })
  }
  if (isRouter(d, dev)) {
    const have = (net: string, prefix: number) => out.some((e) => e.net === net && e.prefix === prefix)
    for (const r of d.cfgs[dev]!.routes) {
      const outIf = ifs.find((i) => i.node && sameSubnet(i.ip, r.nh, i.prefix))
      if (!outIf) continue
      out.push({ code: 'S', net: r.net, prefix: maskToPrefix(r.mask)!, nh: r.nh, ifname: outIf.name })
    }
    for (const r of d.ospf[dev]?.routes ?? []) {
      // lower administrative distance wins: connected (0), static (1), OSPF (110)
      if (have(r.net, r.prefix) || !r.paths.length) continue
      out.push({ code: r.code, net: r.net, prefix: r.prefix, nh: r.paths[0]!.nh, ifname: r.paths[0]!.ifname, metric: r.metric, paths: r.paths })
    }
  }
  return out
}

const intTo = (n: number) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')

function lookup(d: Derived, dev: string, dst: string): { out: L3If; nh: string } | null {
  const ifs = l3Ifs(d, dev)
  const def = d.topo.devices[dev]!
  if (def.kind === 'pc') {
    const i = ifs[0]
    if (!i) return null
    if (sameSubnet(i.ip, dst, i.prefix)) return { out: i, nh: dst }
    const gw = d.pcs[dev]!.gw
    if (gw && sameSubnet(i.ip, gw, i.prefix)) return { out: i, nh: gw }
    return null
  }
  if (!isRouter(d, dev)) {
    const c = ifs.find((i) => sameSubnet(i.ip, dst, i.prefix))
    if (c) return { out: c, nh: dst }
    const gw = d.cfgs[dev]!.defaultGateway
    const gi = gw ? ifs.find((i) => sameSubnet(i.ip, gw, i.prefix)) : undefined
    return gw && gi ? { out: gi, nh: gw } : null
  }
  let best: { e: RouteEntry; out: L3If } | null = null
  const dn = ipToInt(dst)!
  for (const e of routeTable(d, dev)) {
    if (e.code === 'L') continue
    const m = prefixMaskInt(e.prefix)
    if (((dn & m) >>> 0) !== ((ipToInt(e.net)! & m) >>> 0)) continue
    if (best && best.e.prefix > e.prefix) continue
    if (best && best.e.prefix === e.prefix && RANK[best.e.code] <= RANK[e.code]) continue
    const out = ifs.find((i) => i.name === e.ifname)!
    best = { e, out }
  }
  if (!best) return null
  return { out: best.out, nh: best.e.code === 'C' ? dst : best.e.nh! }
}

export function owns(d: Derived, dev: string, ip: string): boolean {
  return l3Ifs(d, dev).some((i) => i.ip === ip)
}

const domainCache = new WeakMap<Derived, Map<string, Domain>>()
function domainOf(d: Derived, n: Node): Domain {
  let m = domainCache.get(d)
  if (!m) domainCache.set(d, (m = new Map()))
  let dom = m.get(nk(n))
  if (!dom) m.set(nk(n), (dom = l2Domain(d, n)))
  return dom
}

/** ARP: find the L3 interface owning ip in the same broadcast domain. */
export function arpResolve(d: Derived, from: L3If, ip: string): L3If | null {
  if (!from.node) return null
  const dom = domainOf(d, from.node)
  for (const i of allL3Ifs(d)) {
    if (i.ip !== ip || !i.node) continue
    if (dom.nodes.has(nk(i.node))) return i
  }
  return null
}

export interface Hop {
  dev: string
  ip: string
  /** interface used to leave the previous device */
  outIf: L3If
}

export type Delivery =
  | { kind: 'ok'; hops: Hop[]; routersCrossed: number }
  | { kind: 'noroute'; hops: Hop[] }
  | { kind: 'unreach'; at: string; atIp: string; hops: Hop[] }
  | { kind: 'timeout'; hops: Hop[] }
  | { kind: 'noip'; hops: Hop[] }

/** Walk a packet from dev toward dst. */
export function deliver(d: Derived, from: string, dst: string): Delivery {
  let cur = from
  const hops: Hop[] = []
  let routers = 0
  if (!l3Ifs(d, from).length) return { kind: 'noip', hops }
  for (let ttl = 0; ttl < 32; ttl++) {
    if (owns(d, cur, dst)) return { kind: 'ok', hops, routersCrossed: routers }
    if (cur !== from && !isRouter(d, cur)) return { kind: 'timeout', hops }
    const r = lookup(d, cur, dst)
    if (!r) {
      if (cur === from) return { kind: 'noroute', hops }
      const at = hops[hops.length - 1]!
      return { kind: 'unreach', at: cur, atIp: at.ip, hops }
    }
    const target = arpResolve(d, r.out, r.nh)
    if (!target) return { kind: 'timeout', hops }
    if (cur !== from) routers++
    hops.push({ dev: target.dev, ip: target.ip, outIf: r.out })
    cur = target.dev
  }
  return { kind: 'timeout', hops }
}

export function sourceIp(d: Derived, dev: string, dst: string): string | null {
  return lookup(d, dev, dst)?.out.ip ?? null
}

export interface PingResult {
  ok: boolean
  /** what the sender sees when it fails */
  reason?: 'noip' | 'noroute' | 'timeout' | 'unreach'
  unreachFrom?: string
  ttl?: number
  firstHopArp?: { dev: string; ip: string }
  forward?: Delivery
}

export function ping(d: Derived, from: string, dst: string): PingResult {
  if (!isValidIp(dst)) return { ok: false, reason: 'noroute' }
  const fwd = deliver(d, from, dst)
  const firstHopArp = fwd.hops[0] ? { dev: from, ip: fwd.hops[0].ip } : undefined
  if (fwd.kind === 'noip') return { ok: false, reason: 'noip', forward: fwd }
  if (fwd.kind === 'noroute') return { ok: false, reason: 'noroute', forward: fwd }
  if (fwd.kind === 'unreach') {
    const back = deliver(d, fwd.at, sourceIp(d, from, dst)!)
    return back.kind === 'ok'
      ? { ok: false, reason: 'unreach', unreachFrom: fwd.atIp, forward: fwd, firstHopArp }
      : { ok: false, reason: 'timeout', forward: fwd, firstHopArp }
  }
  if (fwd.kind !== 'ok') return { ok: false, reason: 'timeout', forward: fwd, firstHopArp }
  const src = sourceIp(d, from, dst)!
  const owner = d.topo.lab.devices.find((x) => owns(d, x.id, dst))!.id
  const back = deliver(d, owner, src)
  if (back.kind !== 'ok') return { ok: false, reason: 'timeout', forward: fwd, firstHopArp }
  const base = d.topo.devices[owner]!.kind === 'pc' ? 64 : 255
  return { ok: true, ttl: base - back.routersCrossed, forward: fwd, firstHopArp }
}

function isValidIp(s: string) {
  return ipToInt(s) !== null
}

// ---- MAC address table (only for hosts that have sent traffic) ----

export interface MacEntry {
  vlan: number
  mac: string
  port: string
}

export function macTable(d: Derived, dev: string, seen: Set<string>): MacEntry[] {
  const out: MacEntry[] = []
  for (const i of allL3Ifs(d)) {
    if (!seen.has(i.mac) || !i.node || i.dev === dev) continue
    const dom = domainOf(d, i.node)
    // walk BFS parents from the owner's segment: find this switch's entry
    for (const [, entry] of dom.nodes) {
      if (entry.node.dev !== dev || entry.node.vlan < 0) continue
      let port: string | null = null
      if (entry.via) port = entry.via.in
      else if (i.kind === 'pc') {
        const lp = pcPort(d, i.dev)
        port = lp?.name ?? null
      }
      if (port) out.push({ vlan: entry.node.vlan, mac: i.mac, port })
    }
  }
  return out.sort((a, b) => a.vlan - b.vlan || a.mac.localeCompare(b.mac))
}

export { egress }
