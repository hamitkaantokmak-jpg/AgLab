// L5-b: DHCP (server on IOS devices and lab servers, relay through `ip helper-address`,
// client on PCs) and DNS name lookup. Pure functions over the derived state; leases are
// runtime state (LabRuntime.dhcp) and are passed in.

import type { Derived } from './engine'
import { allL3Ifs, deliver, l2Domain, l3Ifs, pcNode, ping, type L3If } from './net'
import type { DhcpBinding, DhcpPool, L3Opts, PcDef, SwitchConfig } from './types'
import { ifNum, intToIp, ipToInt, maskToPrefix, prefixMaskInt, sameSubnet } from './util'

export const isApipa = (ip: string) => sameSubnet(ip, '169.254.0.0', 16)

/** Link-local address a client gives itself when no DHCP server answers (stable per MAC). */
export function apipaFor(mac: string): string {
  const hex = mac.replace(/\./g, '')
  const b5 = parseInt(hex.slice(8, 10), 16)
  const b6 = parseInt(hex.slice(10, 12), 16)
  return `169.254.${1 + (b5 % 254)}.${b6}`
}

export interface DhcpOffer {
  ok: true
  /** device that leases the address and the address it answers from */
  server: string
  serverIp: string
  /** pool name ('' = a server's implicit pool) */
  pool: string
  /** relay agent that forwarded the request, if any */
  relay: { dev: string; ifname: string; giaddr: string } | null
  ip: string
  prefix: number
  gw: string | null
  dns: string | null
}

export type DhcpFailReason =
  /** the client has no working link */
  | 'nolink'
  /** nothing in the broadcast domain serves or relays DHCP */
  | 'noserver'
  /** a relay is there, but its helper address is unreachable (or the reply has no way back) */
  | 'relay-unreachable'
  /** the helper address is reachable but is not a DHCP server */
  | 'relay-noserver'
  /** the server has no pool for the client's subnet */
  | 'nopool'
  /** the pool has no free address */
  | 'exhausted'

export interface DhcpFail {
  ok: false
  reason: DhcpFailReason
  /** relay / helper involved in the failure */
  relay?: { dev: string; ifname: string; helper: string }
  server?: string
}

export type DhcpResult = DhcpOffer | DhcpFail

const nk = (n: { dev: string; vlan: number }) => `${n.dev}|${n.vlan}`

/** L3 options of an interface by name (routed port, subinterface, SVI). */
function l3OptsOf(cfg: SwitchConfig, name: string): L3Opts | undefined {
  if (name.startsWith('Vlan')) return cfg.svis[ifNum(name)]?.l3
  if (name.startsWith('Loopback')) return cfg.loopbacks?.[ifNum(name)]?.l3
  if (name.includes('.')) return cfg.subifs?.[name]?.l3
  return cfg.ifaces[name]?.l3
}

export function helpersOf(cfg: SwitchConfig, name: string): string[] {
  return l3OptsOf(cfg, name)?.helpers ?? []
}

/** Pool whose network contains the address (most specific first). */
export function poolFor(cfg: SwitchConfig, addr: string): { name: string; pool: DhcpPool; prefix: number } | null {
  let best: { name: string; pool: DhcpPool; prefix: number } | null = null
  for (const [name, pool] of Object.entries(cfg.dhcpPools ?? {})) {
    if (!pool.net) continue
    const prefix = maskToPrefix(pool.net.mask)
    if (prefix === null || !sameSubnet(pool.net.addr, addr, prefix)) continue
    if (!best || prefix > best.prefix) best = { name, pool, prefix }
  }
  return best
}

/** Every address configured on a device other than `except` (conflict detection). */
function configuredIps(d: Derived, except: string): Set<number> {
  const out = new Set<number>()
  const add = (ip: string | null | undefined) => {
    const n = ip ? ipToInt(ip) : null
    if (n !== null) out.add(n)
  }
  for (const [id, pc] of Object.entries(d.pcs)) if (id !== except) add(pc.ip)
  for (const [id, cfg] of Object.entries(d.cfgs)) {
    if (id === except) continue
    for (const c of Object.values(cfg.ifaces)) add(c.ip?.addr)
    for (const s of Object.values(cfg.svis)) add(s.ip?.addr)
    for (const s of Object.values(cfg.subifs ?? {})) add(s.ip?.addr)
    for (const l of Object.values(cfg.loopbacks ?? {})) add(l.ip?.addr)
  }
  return out
}

/** Usable addresses of an IOS pool: network range minus excluded ranges. */
export function poolRange(cfg: SwitchConfig, pool: DhcpPool): { first: number; last: number; excluded: (n: number) => boolean } | null {
  if (!pool.net) return null
  const prefix = maskToPrefix(pool.net.mask)
  if (prefix === null || prefix > 30) return null
  const net = (ipToInt(pool.net.addr)! & prefixMaskInt(prefix)) >>> 0
  const size = 2 ** (32 - prefix)
  const ranges = (cfg.dhcpExcluded ?? []).map((r) => [ipToInt(r.lo)!, ipToInt(r.hi)!] as const)
  return { first: net + 1, last: net + size - 2, excluded: (n) => ranges.some(([lo, hi]) => n >= lo && n <= hi) }
}

/** IOS pool: the client's previous address if still free, else the lowest free one. */
function allocateIos(d: Derived, cfg: SwitchConfig, server: string, pool: DhcpPool, client: string, mac: string, bindings: DhcpBinding[]): string | null {
  const range = poolRange(cfg, pool)
  if (!range) return null
  const inUse = configuredIps(d, client)
  const leased = new Map(bindings.filter((b) => b.server === server).map((b) => [ipToInt(b.ip)!, b.mac]))
  const free = (n: number) => !range.excluded(n) && !inUse.has(n) && (leased.get(n) ?? mac) === mac
  const mine = bindings.find((b) => b.server === server && b.mac === mac)
  const prev = mine ? ipToInt(mine.ip)! : null
  if (prev !== null && prev >= range.first && prev <= range.last && free(prev)) return intToIp(prev)
  for (let n = range.first; n <= range.last; n++) if (free(n)) return intToIp(n)
  return null
}

/**
 * Lab server (AğLab model): one implicit pool for the subnet the request came from. Same
 * rule as the src/engine/dhcp.js oracle: start at the 100th address of the network (the
 * last usable one in smaller networks), go up, then wrap to the first addresses; the
 * gateway, the server and every configured address are taken.
 */
function allocateServer(d: Derived, network: string, prefix: number, gw: string | null, serverIp: string, client: string): string | null | 'invalid' {
  if (prefix < 1 || prefix >= 31) return 'invalid'
  const net = (ipToInt(network)! & prefixMaskInt(prefix)) >>> 0
  const broadcast = net + 2 ** (32 - prefix) - 1
  const taken = configuredIps(d, client)
  for (const ip of [gw, serverIp]) if (ip) taken.add(ipToInt(ip)!)
  const start = Math.min(100, Math.max(1, broadcast - net - 1))
  const offsets = [...Array.from({ length: 4096 }, (_, i) => start + i), ...Array.from({ length: Math.max(0, start - 1) }, (_, i) => i + 1)]
  for (const off of offsets) {
    const n = net + off
    if (n >= broadcast) continue
    if (!taken.has(n)) return intToIp(n)
  }
  return null
}

function isDhcpServerPc(d: Derived, dev: string): boolean {
  const def = d.topo.devices[dev]
  return !!def && def.kind === 'pc' && !!def.server && !!d.pcs[dev]?.services?.dhcp && !d.hw.off.has(dev)
}

/**
 * DHCP DISCOVER from a PC: a server in its broadcast domain answers first (lab order);
 * otherwise an interface with `ip helper-address` in that domain relays the request to
 * the helper, which must be reachable, be a DHCP server with a pool for the relay's
 * subnet (giaddr) and be able to reach the relay again.
 */
export function dhcpDiscover(d: Derived, pc: string, bindings: DhcpBinding[]): DhcpResult {
  const def = d.topo.devices[pc] as PcDef | undefined
  const node = def && !d.hw.off.has(pc) ? pcNode(d, pc) : null
  if (!def || !node) return { ok: false, reason: 'nolink' }
  const dom = l2Domain(d, node)
  const onLink = allL3Ifs(d).filter((i) => i.dev !== pc && i.node && dom.nodes.has(nk(i.node)))
  let fail: DhcpFail = { ok: false, reason: 'noserver' }
  const offerFrom = (server: string, via: L3If | null, giaddr: string, giPrefix: number, relay: DhcpOffer['relay']): DhcpResult | null => {
    const sdef = d.topo.devices[server]!
    if (sdef.kind === 'switch') {
      const cfg = d.cfgs[server]!
      if (!Object.keys(cfg.dhcpPools ?? {}).length) return null
      const p = poolFor(cfg, giaddr)
      if (!p) return { ok: false, reason: 'nopool', server }
      const ip = allocateIos(d, cfg, server, p.pool, pc, def.mac, bindings)
      if (!ip) return { ok: false, reason: 'exhausted', server }
      const serverIp = via?.ip ?? l3Ifs(d, server).find((i) => i.node)?.ip ?? giaddr
      return { ok: true, server, serverIp, pool: p.name, relay, ip, prefix: p.prefix, gw: p.pool.defaultRouter, dns: p.pool.dns }
    }
    if (!isDhcpServerPc(d, server)) return null
    const sc = d.pcs[server]!
    if (!sc.ip) return null
    // local request: the server's own subnet and gateway; relayed: the relay's subnet, relay as gateway
    const network = relay ? giaddr : sc.ip
    const prefix = relay ? giPrefix : sc.prefix
    const gw = relay ? giaddr : sc.gw
    const ip = allocateServer(d, network, prefix, gw, sc.ip, pc)
    if (ip === 'invalid') return { ok: false, reason: 'nopool', server }
    if (!ip) return { ok: false, reason: 'exhausted', server }
    return { ok: true, server, serverIp: sc.ip, pool: '', relay, ip, prefix, gw, dns: sc.services?.dns ? sc.ip : null }
  }
  // 1) servers in the client's broadcast domain
  for (const i of onLink) {
    const r = offerFrom(i.dev, i, i.ip, i.prefix, null)
    if (!r) continue
    if (r.ok) return r
    fail = r
  }
  // 2) relay agents
  for (const i of onLink) {
    if (d.topo.devices[i.dev]!.kind !== 'switch') continue
    for (const helper of helpersOf(d.cfgs[i.dev]!, i.name)) {
      const relayInfo = { dev: i.dev, ifname: i.name, helper }
      if (l3Ifs(d, i.dev).some((x) => x.ip === helper)) continue
      const fwd = deliver(d, i.dev, helper)
      const target = fwd.kind === 'ok' ? fwd.hops[fwd.hops.length - 1]?.dev : undefined
      if (!target) {
        fail = { ok: false, reason: 'relay-unreachable', relay: relayInfo }
        continue
      }
      const back = deliver(d, target, i.ip)
      if (back.kind !== 'ok' || (back.hops[back.hops.length - 1]?.dev ?? target) !== i.dev) {
        fail = { ok: false, reason: 'relay-unreachable', relay: relayInfo, server: target }
        continue
      }
      const r = offerFrom(target, null, i.ip, i.prefix, { dev: i.dev, ifname: i.name, giaddr: i.ip })
      if (!r) {
        fail = { ok: false, reason: 'relay-noserver', relay: relayInfo, server: target }
        continue
      }
      if (r.ok) return r.server === target ? { ...r, serverIp: helper } : r
      fail = { ...r, relay: relayInfo }
    }
  }
  return fail
}

// ---- DNS ----

export type DnsResult =
  | { ok: true; server: string; name: string; address: string }
  | { ok: false; reason: 'noserver' | 'timeout' | 'nxdomain'; server?: string }

/** Host names a lab DNS server knows: every device's name and its first address. */
export function dnsRecords(d: Derived): { name: string; address: string }[] {
  const out: { name: string; address: string }[] = []
  for (const dev of d.topo.lab.devices) {
    if (dev.kind === 'pc') {
      const ip = d.pcs[dev.id]?.ip
      if (ip) out.push({ name: dev.name ?? dev.id, address: ip })
    } else {
      const first = l3Ifs(d, dev.id)[0]
      if (first) out.push({ name: d.cfgs[dev.id]!.hostname, address: first.ip })
    }
  }
  return out
}

/** `nslookup` from a PC: its DNS server must be reachable and run the DNS service. */
export function dnsLookup(d: Derived, pc: string, name: string): DnsResult {
  const server = d.pcs[pc]?.dns
  if (!server) return { ok: false, reason: 'noserver' }
  const r = ping(d, pc, server)
  const target = r.ok ? r.replier : undefined
  const tdef = target ? d.topo.devices[target] : undefined
  if (!target || !tdef || tdef.kind !== 'pc' || !tdef.server || !d.pcs[target]?.services?.dns) return { ok: false, reason: 'timeout', server }
  const rec = dnsRecords(d).find((x) => x.name.toLowerCase() === name.toLowerCase())
  return rec ? { ok: true, server, name: rec.name, address: rec.address } : { ok: false, reason: 'nxdomain', server }
}
