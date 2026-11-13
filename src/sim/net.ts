// L2 reachability and L3 forwarding on top of the derived state.

import { crossVlan, egress, ingress, peerOf, portForwards, type Derived, type DupIp, type LPort } from './engine'
import { aclDecide, l3OptsOf, type Packet } from './acl'
import { natAliases, natInbound, natOutbound, type NatEntry } from './nat'
import { psAdmits } from './portsec'
import { pk } from './topology'
import type { PcDef, SwitchDef } from './types'
import { ifType, ipToInt, macAdd, maskToPrefix, prefixMaskInt, sameSubnet } from './util'

export interface Node {
  dev: string
  vlan: number
}
const nk = (n: Node) => `${n.dev}|${n.vlan}`

/**
 * A routed port is its own segment; encoded as a negative pseudo-VLAN. L5-a: 802.1Q
 * frames on a routed port (router subinterfaces) are separate segments of the same wire:
 * -(tag * ROUTED_TAG + port index + 1); tag 0 = untagged (the physical interface or a
 * `native` subinterface).
 */
const ROUTED_TAG = 1000
export function routedNode(d: Derived, dev: string, port: string, tag = 0): Node {
  const sw = d.topo.devices[dev] as SwitchDef
  return { dev, vlan: -(tag * ROUTED_TAG + sw.ports.indexOf(port) + 1) }
}
export function routedPortOf(d: Derived, n: Node): string | null {
  if (n.vlan >= 0) return null
  return (d.topo.devices[n.dev] as SwitchDef).ports[((-n.vlan) % ROUTED_TAG) - 1] ?? null
}
/** 802.1Q tag of a routed-port segment (0 = untagged); null for a switch VLAN node. */
export function routedTagOf(n: Node): number | null {
  return n.vlan >= 0 ? null : Math.floor(-n.vlan / ROUTED_TAG)
}
/** VLAN shown for a segment: the switch VLAN or the routed-port tag (0 = untagged). */
export function nodeVlan(n: Node): number {
  return n.vlan >= 0 ? n.vlan : routedTagOf(n)!
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
      // routed port: the frame (untagged, or 802.1Q-tagged by a subinterface) goes straight
      // to whatever is on the other end
      const tag = routedTagOf(n)!
      const lp = d.lportByName[pk(n.dev, rport)]
      const p = lp?.active ? peerOf(d, lp) : null
      if (!p || !p.active) continue
      if (p.routed) add(routedNode(d, p.dev, p.name, tag), n, lp!.name, p.name)
      else {
        const v2 = ingress(d, p, tag ? 't' : 'u', tag)
        if (v2 !== null && portForwards(d, p.dev, p, v2)) add({ dev: p.dev, vlan: v2 }, n, lp!.name, p.name)
      }
      continue
    }
    for (const lp of d.lports[n.dev] ?? []) {
      if (!portForwards(d, n.dev, lp, n.vlan)) continue
      const p = peerOf(d, lp)
      if (!p) continue
      if (p.routed) {
        // untagged → the router's physical/native segment; tagged → its 802.1Q segment
        const tag = p.active ? egress(d, lp, n.vlan) : null
        if (tag) add(routedNode(d, p.dev, p.name, tag === 'u' ? 0 : n.vlan), n, lp.name, p.name)
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
  // L5-e: port security drops every frame of a violating source MAC at the ingress port
  if (!psAdmits(d, at.dev, at.port, (d.topo.devices[pc] as PcDef).mac)) return null
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
  // a powered-off device has no addresses on the network
  if (d.hw.off.has(dev)) return []
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
  // L5-a: router subinterfaces (`interface Gi0/0.N`, `encapsulation dot1Q N [native]`); they
  // share the parent's MAC and are up only while the parent port is up
  for (const [name, si] of Object.entries(cfg.subifs ?? {})) {
    if (si.shutdown || !si.ip || si.vlan === null) continue
    const lp = d.lportByName[pk(dev, si.parent)]
    if (!lp?.active) continue
    out.push({ dev, kind: 'routed', name, ip: si.ip.addr, prefix: maskToPrefix(si.ip.mask)!, mac: macAdd(sw.mac, sw.ports.indexOf(si.parent) + 1), node: routedNode(d, dev, si.parent, si.native ? 0 : si.vlan) })
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
  return def.kind === 'switch' && !!(def.l3 || def.router) && d.cfgs[dev]!.ipRouting
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
  /** static: administrative distance (undefined = 1) */
  ad?: number
  /** static: directly connected next hop the packet is handed to (recursive resolution) */
  via?: string
}

const OSPF_AD = 110

interface Candidate {
  code: RouteCode
  net: string
  prefix: number
  ad: number
  /** static route index in the configuration (resolution guard) */
  idx?: number
  nh: string | null
  ifname: string
  metric?: number
  paths?: { nh: string; ifname: string }[]
}

const inPrefix = (ip: string, net: string, prefix: number) => {
  const m = prefixMaskInt(prefix)
  return ((ipToInt(ip)! & m) >>> 0) === ((ipToInt(net)! & m) >>> 0)
}

/**
 * Routing table of a routing device: connected, then for every prefix the installed route
 * with the lowest administrative distance (static `ad`, default 1; OSPF 110).
 *
 * A static route is installed only if its next hop resolves: directly connected, or
 * recursively through another route (L4, same rule as the src/engine/routing.js oracle:
 * longest match first; a candidate that does not resolve is skipped and the next one is
 * tried; a route never resolves through itself, so mutually dependent routes stay out).
 * With equal distance the route configured first wins (the oracle does not load-balance).
 */
export function routeTable(d: Derived, dev: string): RouteEntry[] {
  const ifs = l3Ifs(d, dev)
  const out: RouteEntry[] = []
  for (const i of ifs) {
    const m = prefixMaskInt(i.prefix)
    out.push({ code: 'C', net: intTo((ipToInt(i.ip)! & m) >>> 0), prefix: i.prefix, nh: null, ifname: i.name })
    if (i.prefix < 32) out.push({ code: 'L', net: i.ip, prefix: 32, nh: null, ifname: i.name })
  }
  if (!isRouter(d, dev)) return out
  const connected = out.filter((e) => e.code === 'C' && ifs.find((i) => i.name === e.ifname)?.node)
  const statics: Candidate[] = d.cfgs[dev]!.routes.flatMap((r, idx) => {
    const prefix = maskToPrefix(r.mask)
    return prefix === null ? [] : [{ code: 'S' as const, net: r.net, prefix, ad: r.ad ?? 1, idx, nh: r.nh, ifname: '' }]
  })
  const ospf: Candidate[] = (d.ospf[dev]?.routes ?? [])
    .filter((r) => r.paths.length)
    .map((r) => ({ code: r.code, net: r.net, prefix: r.prefix, ad: OSPF_AD, nh: r.paths[0]!.nh, ifname: r.paths[0]!.ifname, metric: r.metric, paths: r.paths }))

  // next hop → (outgoing interface, directly connected next hop)
  type Res = { ifname: string; via: string }
  const lookupFor = (dst: string, seen: Set<number>): Res | null => {
    const matches: Candidate[] = [
      ...connected.filter((c) => inPrefix(dst, c.net, c.prefix)).map((c) => ({ ...c, ad: 0 }) as Candidate),
      ...statics.filter((c) => !seen.has(c.idx!) && inPrefix(dst, c.net, c.prefix)),
      ...ospf.filter((c) => inPrefix(dst, c.net, c.prefix)),
    ].sort((a, b) => b.prefix - a.prefix || a.ad - b.ad || (a.code === 'S' ? 0 : 1) - (b.code === 'S' ? 0 : 1))
    for (const m of matches) {
      if (m.code === 'C') return { ifname: m.ifname, via: dst }
      if (m.code !== 'S') return { ifname: m.ifname, via: m.nh! }
      const r = resolve(m, seen)
      if (r) return r
    }
    return null
  }
  const resolve = (s: Candidate, seen: Set<number>): Res | null => {
    const direct = connected.find((c) => inPrefix(s.nh!, c.net, c.prefix))
    if (direct) return { ifname: direct.ifname, via: s.nh! }
    return lookupFor(s.nh!, new Set([...seen, s.idx!]))
  }

  const best = new Map<string, RouteEntry & { rank: number }>()
  const consider = (e: RouteEntry, rank: number) => {
    const key = `${e.net}/${e.prefix}`
    if (out.some((c) => c.code === 'C' && `${c.net}/${c.prefix}` === key)) return
    const cur = best.get(key)
    if (!cur || rank < cur.rank) best.set(key, { ...e, rank })
  }
  for (const s of statics) {
    const r = resolve(s, new Set())
    if (!r) continue
    // equal distance: static before OSPF, earlier configuration line first (strict <)
    consider({ code: 'S', net: s.net, prefix: s.prefix, nh: s.nh, ifname: r.ifname, ...(s.ad !== 1 ? { ad: s.ad } : {}), via: r.via }, s.ad * 2)
  }
  for (const r of ospf) consider({ code: r.code, net: r.net, prefix: r.prefix, nh: r.nh, ifname: r.ifname, metric: r.metric, paths: r.paths }, r.ad * 2 + 1)
  for (const e of best.values()) {
    const { rank: _rank, ...entry } = e
    out.push(entry)
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
  // one installed entry per prefix (connected before anything else): plain LPM
  let best: { e: RouteEntry; out: L3If } | null = null
  for (const e of routeTable(d, dev)) {
    if (e.code === 'L' || !inPrefix(dst, e.net, e.prefix)) continue
    if (best && best.e.prefix >= e.prefix) continue
    const out = ifs.find((i) => i.name === e.ifname)!
    best = { e, out }
  }
  if (!best) return null
  return { out: best.out, nh: best.e.code === 'C' ? dst : (best.e.via ?? best.e.nh!) }
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
  // L5-d: a NAT router answers ARP for its global addresses on the connected subnet
  for (const i of allL3Ifs(d)) {
    if (!i.node || !dom.nodes.has(nk(i.node)) || !sameSubnet(i.ip, ip, i.prefix)) continue
    if (natAliases(d.cfgs[i.dev]).includes(ip)) return { ...i, ip }
  }
  return null
}

export interface Hop {
  dev: string
  ip: string
  /** L5-d: interface the packet entered this device on */
  inIf?: string
  /** L5-d: IP addresses on this hop's wire (after NAT on earlier routers) */
  src?: string
  dst?: string
  /** interface used to leave the previous device */
  outIf: L3If
}

/** L5-c: an ACL evaluated on the way ('dev|acl|seq' counter key; seq null = implicit deny). */
export interface AclHit {
  dev: string
  acl: string
  seq: number | null
  dir: 'in' | 'out'
  ifname: string
}

export type Delivery = (
  | { kind: 'ok'; hops: Hop[]; routersCrossed: number }
  | { kind: 'noroute'; hops: Hop[] }
  | { kind: 'unreach'; at: string; atIp: string; hops: Hop[]; filtered?: AclHit }
  /** suppressedAt: ICMP hatası RFC 1812 gereği üretilmedi (çok yöncü/yayın hedef) */
  | { kind: 'timeout'; hops: Hop[]; suppressedAt?: string }
  | { kind: 'noip'; hops: Hop[] }
  /** L5-i: TTL ran out on a router (it answers ICMP Time Exceeded from its ingress address) */
  | { kind: 'expired'; at: string; atIp: string; hops: Hop[] }
) & {
  acl?: AclHit[]
  /** L5-d: the packet as it arrived (addresses after NAT) and the NAT entries it created */
  pkt?: Packet
  nat?: NatEntry[]
  /** L5-d: a matching dynamic NAT rule had no free address (pool exhausted) */
  natMiss?: boolean
  /** L5-d: translations applied to this packet (show ip nat statistics "Hits") */
  natted?: number
}

/** L5-c: what is being carried; defaults to an ICMP echo (id 1) from the egress address. */
export type PacketSpec = Partial<Packet> & {
  natPending?: NatEntry[]
  /** L5-i: IP TTL at the sender (undefined: never expires within the hop limit) */
  ttl?: number
}

/** `ip access-group` decision on one interface of a routing device. */
function aclCheck(d: Derived, dev: string, ifname: string, dir: 'in' | 'out', pkt: Packet, hits: AclHit[]): AclHit | null {
  const opts = l3OptsOf(d.cfgs[dev], ifname)
  const name = dir === 'in' ? opts?.aclIn : opts?.aclOut
  if (!name) return null
  const r = aclDecide(d.cfgs[dev]!.acls?.[name], pkt)
  const hit: AclHit = { dev, acl: name, seq: r.seq, dir, ifname }
  if (r.seq !== null) hits.push(hit)
  return r.permit ? null : hit
}

/**
 * Walk a packet from dev toward dst. L5-c: on each routing device the inbound ACL of the
 * interface the packet arrives on and the outbound ACL of the interface it leaves by are
 * applied (traffic the device originates itself is not subject to its outbound ACL, IOS).
 * A denied packet is answered with an ICMP unreachable from the filtering device.
 */
export function deliver(d: Derived, from: string, dst: string, spec: PacketSpec = {}): Delivery {
  let cur = from
  const hops: Hop[] = []
  const acl: AclHit[] = []
  const nat: NatEntry[] = []
  let routers = 0
  if (!l3Ifs(d, from).length) return { kind: 'noip', hops }
  const { natPending, ttl: ttl0, ...fields } = spec
  // varsayılan: IP TTL üst değeri (döngüde paket TTL'le biter; tur sınırı aşağıda)
  let ipTtl = ttl0 ?? 255
  let pkt: Packet = { proto: 'icmp', icmpType: 'echo', ...fields, src: fields.src ?? sourceIp(d, from, dst) ?? l3Ifs(d, from)[0]!.ip, dst } as Packet
  if (pkt.proto === 'icmp' && pkt.sport === undefined && pkt.icmpType === 'echo') pkt.sport = 1
  const table = () => [...(d.natTable ?? []), ...(natPending ?? []), ...nat]
  const routing = (dev: string) => d.topo.devices[dev]?.kind === 'switch'
  let inIf: string | null = null
  let natted = 0
  const end = <T extends Delivery>(r: T): T => ({ ...r, acl, pkt, nat, natted })
  for (let ttl = 0; ttl < 256; ttl++) {
    // L5-d: outside → inside: destination translated back on arrival (before routing)
    if (cur !== from && inIf && routing(cur)) {
      const back = natInbound(d, cur, inIf, pkt, table())
      if (back) {
        pkt = back
        natted++
      }
    }
    if (owns(d, cur, pkt.dst)) return end({ kind: 'ok', hops, routersCrossed: routers })
    // a global address with no translation: nothing to forward to
    if (cur !== from && natAliases(d.cfgs[cur]).includes(pkt.dst)) return end({ kind: 'timeout', hops })
    // L5-i: a router forwarding the packet decrements TTL; at 0 it drops it (Time Exceeded)
    if (cur !== from && routing(cur)) {
      if (ipTtl <= 1) return end({ kind: 'expired', at: cur, atIp: hops[hops.length - 1]!.ip, hops })
      ipTtl--
    }
    if (cur !== from && !isRouter(d, cur)) return end({ kind: 'timeout', hops })
    const r = lookup(d, cur, pkt.dst)
    if (!r) {
      if (cur === from) return end({ kind: 'noroute', hops })
      // RFC 1812 / IOS: çok yöncü ve yayın hedefleri için ICMP hatası üretilmez
      if (noIcmpError(d, cur, pkt.dst)) return end({ kind: 'timeout', hops, suppressedAt: cur })
      const at = hops[hops.length - 1]!
      return end({ kind: 'unreach', at: cur, atIp: at.ip, hops })
    }
    const target = arpResolve(d, r.out, r.nh)
    if (!target) {
      // MotorBulgusu (I-1): router bağlı ağda ARP'yi çözemezse kaynağa ICMP host unreachable
      // döner (IOS). ARP girdisi önbellekteyse (hedef sonradan kapandı) çerçeve gönderilir ve
      // yanıt gelmez (sessiz). Kaynağın kendi ARP başarısızlığı her zaman sessizdir.
      if (cur !== from && routing(cur) && !noIcmpError(d, cur, pkt.dst) && !d.arpCache?.has(`${cur}>${r.nh}`))
        return end({ kind: 'unreach', at: cur, atIp: hops[hops.length - 1]!.ip, hops })
      return end({ kind: 'timeout', hops, ...(cur !== from && routing(cur) && noIcmpError(d, cur, pkt.dst) ? { suppressedAt: cur } : {}) })
    }
    if (cur !== from && routing(cur) && inIf) {
      // L5-d: inside → outside: source translated after routing, before the outbound ACL
      const o = natOutbound(d, cur, inIf, r.out.name, pkt, table())
      if (o === 'drop') return end({ kind: 'timeout', hops, natMiss: true })
      if (o) {
        pkt = o.pkt
        nat.push(...o.entries)
        natted++
      }
      const denied = aclCheck(d, cur, r.out.name, 'out', pkt, acl)
      if (denied) return end({ kind: 'unreach', at: cur, atIp: hops[hops.length - 1]!.ip, hops, filtered: denied })
    }
    if (routing(target.dev)) {
      const denied = aclCheck(d, target.dev, target.name, 'in', pkt, acl)
      if (denied) return end({ kind: 'unreach', at: target.dev, atIp: target.ip, hops: [...hops, { dev: target.dev, ip: target.ip, outIf: r.out, inIf: target.name }], filtered: denied })
    }
    if (cur !== from) routers++
    hops.push({ dev: target.dev, ip: target.ip, outIf: r.out, inIf: target.name, src: pkt.src, dst: pkt.dst })
    inIf = target.name
    cur = target.dev
  }
  return end({ kind: 'timeout', hops })
}

/** RFC 1812: çok yöncü, sınırlı yayın ve bu router'ın bağlı ağlarından birinin yayın adresi. */
export function noIcmpError(d: Derived, dev: string, dst: string): boolean {
  const n = ipToInt(dst)
  if (n === null) return false
  if (n >>> 0 >= 0xe0000000) return true // 224.0.0.0/4 ve üstü (255.255.255.255 dahil)
  return l3Ifs(d, dev).some((i) => i.prefix < 31 && ((ipToInt(i.ip)! | ~prefixMaskInt(i.prefix)) >>> 0) === n >>> 0)
}

/** Route choice for dst: outgoing interface and the next hop it is handed to (no ARP). */
export function routeOut(d: Derived, dev: string, dst: string): { ifname: string; nh: string } | null {
  const r = lookup(d, dev, dst)
  return r ? { ifname: r.out.name, nh: r.nh } : null
}

/** Next hop the device would ARP for to reach dst (dst itself when on-link). */
export function nextHop(d: Derived, dev: string, dst: string): string | null {
  return lookup(d, dev, dst)?.nh ?? null
}

/**
 * Addresses used more than once inside one broadcast domain. The same address in
 * separate domains (other VLAN, other routed segment) is not a conflict.
 */
export function duplicateIps(d: Derived): DupIp[] {
  const byIp = new Map<string, L3If[]>()
  for (const i of allL3Ifs(d)) {
    if (!i.node) continue
    const g = byIp.get(i.ip)
    if (g) g.push(i)
    else byIp.set(i.ip, [i])
  }
  const out: DupIp[] = []
  for (const [ip, group] of byIp) {
    if (group.length < 2) continue
    const left = [...group]
    while (left.length > 1) {
      const first = left.shift()!
      const dom = domainOf(d, first.node!)
      const same = left.filter((i) => dom.nodes.has(nk(i.node!)))
      if (!same.length) continue
      for (const i of same) left.splice(left.indexOf(i), 1)
      out.push({ ip, owners: [first, ...same].map((i) => ({ dev: i.dev, kind: i.kind, name: i.name, mac: i.mac })) })
    }
  }
  return out
}

/** MAC that dev's ARP entry for ip resolves to now (null when nothing answers). */
export function arpMac(d: Derived, dev: string, ip: string): { mac: string; via: string } | null {
  const via = l3Ifs(d, dev).find((i) => i.node && sameSubnet(i.ip, ip, i.prefix))
  if (!via) return null
  const owner = arpResolve(d, via, ip)
  return owner ? { mac: owner.mac, via: via.name } : null
}

export function sourceIp(d: Derived, dev: string, dst: string): string | null {
  return lookup(d, dev, dst)?.out.ip ?? null
}

export interface PingResult {
  ok: boolean
  /** what the sender sees when it fails */
  /** 'off': the sender itself is powered off (no console, nothing is sent) */
  reason?: 'noip' | 'noroute' | 'timeout' | 'unreach' | 'off' | 'expired'
  /** L5-i: router that answered ICMP Time Exceeded */
  expiredFrom?: string
  unreachFrom?: string
  ttl?: number
  /** device that answered (ok only); with a duplicate address, the ARP winner */
  replier?: string
  firstHopArp?: { dev: string; ip: string }
  /** the sender's own ARP request for its first hop went unanswered */
  arpIncomplete?: { dev: string; ip: string }
  forward?: Delivery
  /** L5-c: the reply (or ICMP unreachable) on its way back */
  back?: Delivery
}

export function ping(d: Derived, from: string, dst: string, opts: { ttl?: number; src?: string } = {}): PingResult {
  if (d.hw.off.has(from)) return { ok: false, reason: 'off' }
  if (!isValidIp(dst)) return { ok: false, reason: 'noroute' }
  const fwd = deliver(d, from, dst, { ...(opts.ttl !== undefined ? { ttl: opts.ttl } : {}), ...(opts.src ? { src: opts.src } : {}) })
  const firstHopArp = fwd.hops[0] ? { dev: from, ip: fwd.hops[0].ip } : undefined
  if (fwd.kind === 'noip') return { ok: false, reason: 'noip', forward: fwd }
  if (fwd.kind === 'noroute') return { ok: false, reason: 'noroute', forward: fwd }
  if (fwd.kind === 'unreach') {
    // the ICMP unreachable comes from the router (its own traffic: not filtered on the way out);
    // it goes to the (possibly NAT-translated) source and is translated back on the way in
    const back = deliver(d, fwd.at, fwd.pkt?.src ?? sourceIp(d, from, dst)!, { proto: 'icmp', icmpType: 'unreachable', src: fwd.atIp, dport: fwd.pkt?.sport, natPending: fwd.nat })
    return back.kind === 'ok'
      ? { ok: false, reason: 'unreach', unreachFrom: fwd.atIp, forward: fwd, back, firstHopArp }
      : { ok: false, reason: 'timeout', forward: fwd, back, firstHopArp }
  }
  if (fwd.kind === 'expired') {
    // L5-i: ICMP Time Exceeded from the router where TTL ran out, back to the (translated) source
    const back = deliver(d, fwd.at, fwd.pkt?.src ?? sourceIp(d, from, dst)!, { proto: 'icmp', icmpType: 'time-exceeded', src: fwd.atIp, dport: fwd.pkt?.sport, natPending: fwd.nat })
    return back.kind === 'ok'
      ? { ok: false, reason: 'expired', expiredFrom: fwd.atIp, forward: fwd, back, firstHopArp }
      : { ok: false, reason: 'timeout', forward: fwd, back, firstHopArp }
  }
  if (fwd.kind !== 'ok') {
    const nh = fwd.hops.length ? null : nextHop(d, from, dst)
    return { ok: false, reason: 'timeout', forward: fwd, firstHopArp, ...(nh ? { arpIncomplete: { dev: from, ip: nh } } : {}) }
  }
  // the device the request reached answers; the reply must come back to the sender
  // (with a duplicate source address it goes to whoever wins ARP for that address).
  // L5-d: it is addressed to the source as the replier saw it (after NAT) and translated back.
  const src = fwd.pkt?.src ?? sourceIp(d, from, dst)!
  const replier = fwd.hops[fwd.hops.length - 1]?.dev ?? from
  const back = deliver(d, replier, src, { proto: 'icmp', icmpType: 'echo-reply', src: dst, dport: fwd.pkt?.sport, natPending: fwd.nat })
  const backTo = back.hops[back.hops.length - 1]?.dev ?? replier
  if (back.kind !== 'ok' || backTo !== from) return { ok: false, reason: 'timeout', forward: fwd, back, firstHopArp }
  const base = d.topo.devices[replier]!.kind === 'pc' ? 64 : 255
  return { ok: true, ttl: base - back.routersCrossed, replier, forward: fwd, back, firstHopArp }
}

/** L5-i: one traceroute probe (UDP) with the given TTL and what came back to the sender. */
export type ProbeResult =
  | { kind: 'hop'; ip: string }
  | { kind: 'dest'; ip: string }
  | { kind: 'unreach'; ip: string; code: 'H' | 'A' }
  | { kind: 'none' }

export function traceProbe(d: Derived, from: string, dst: string, ttl: number, dport: number, sport = 49152): { result: ProbeResult; forward: Delivery; back?: Delivery } {
  const fwd = deliver(d, from, dst, { proto: 'udp', sport, dport, ttl })
  const src = fwd.pkt?.src ?? sourceIp(d, from, dst)
  if (!src) return { result: { kind: 'none' }, forward: fwd }
  const answer = (at: string, ip: string, icmpType: 'time-exceeded' | 'unreachable') =>
    deliver(d, at, src, { proto: 'icmp', icmpType, src: ip, dport: fwd.pkt?.sport, natPending: fwd.nat })
  const home = (b: Delivery) => b.kind === 'ok' && (b.hops[b.hops.length - 1]?.dev ?? from) === from
  if (fwd.kind === 'expired') {
    const back = answer(fwd.at, fwd.atIp, 'time-exceeded')
    return { result: home(back) ? { kind: 'hop', ip: fwd.atIp } : { kind: 'none' }, forward: fwd, back }
  }
  if (fwd.kind === 'unreach') {
    const back = answer(fwd.at, fwd.atIp, 'unreachable')
    return { result: home(back) ? { kind: 'unreach', ip: fwd.atIp, code: fwd.filtered ? 'A' : 'H' } : { kind: 'none' }, forward: fwd, back }
  }
  if (fwd.kind !== 'ok') return { result: { kind: 'none' }, forward: fwd }
  // the destination answers ICMP port unreachable (nothing listens on 33434+)
  const replier = fwd.hops[fwd.hops.length - 1]?.dev ?? from
  const back = answer(replier, fwd.pkt?.dst ?? dst, 'unreachable')
  return { result: home(back) ? { kind: 'dest', ip: dst } : { kind: 'none' }, forward: fwd, back }
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
