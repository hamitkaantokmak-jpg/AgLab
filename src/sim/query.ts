// Read-only helpers for lab objectives. Objectives look at derived behaviour, never config text.

import { httpGet, type HttpResult } from './http'
import { egress, portForwards, vlanExists, type Derived, type LPort } from './engine'
import { dnsLookup, isApipa, type DnsResult } from './dhcp'
import { macTable, ping, pcNode, routeTable, type MacEntry, type PingResult, type RouteEntry } from './net'
import type { DhcpBinding, SwitchConfig } from './types'
import { pk } from './topology'
import { canonIf, ipToInt, normalizeMac, prefixMaskInt } from './util'

export class LabQuery {
  constructor(
    public d: Derived,
    private startup: Record<string, SwitchConfig | null> = {},
    /** MACs that sent or answered traffic; empty = nothing learned yet (see LabRuntime.query()) */
    private learned: Set<string> = new Set(),
    /** L5-b: DHCP leases (see LabRuntime.query()) */
    private leases: DhcpBinding[] = [],
  ) {}

  /** L5-b: the lease the PC currently uses ({server, pool, ip, …}), or null. */
  dhcpLease(pc: string): DhcpBinding | null {
    const c = this.d.pcs[pc]
    if (!c?.dhcp || !c.ip || isApipa(c.ip)) return null
    return this.leases.find((b) => b.client === pc && b.ip === c.ip) ?? null
  }

  /** L5-b: leases a DHCP server (router, switch or lab server) handed out. */
  dhcpBindings(server: string): DhcpBinding[] {
    return this.leases.filter((b) => b.server === server)
  }

  /** L5-b: DNS lookup from a PC through its configured DNS server. */
  dnsLookup(pc: string, name: string): DnsResult {
    return dnsLookup(this.d, pc, name)
  }

  /** Dynamic MAC address table of a switch (learned addresses only). */
  macTable(dev: string): MacEntry[] {
    return macTable(this.d, dev, this.learned)
  }

  private macEntry(dev: string, mac: string): MacEntry | undefined {
    const m = normalizeMac(mac)
    return m ? this.macTable(dev).find((e) => e.mac === m) : undefined
  }

  /** Port (canonical name, or Port-channelN) the switch learned this MAC on, or null. */
  macPort(dev: string, mac: string): string | null {
    return this.macEntry(dev, mac)?.port ?? null
  }

  /** VLAN the switch learned this MAC in, or null. */
  macVlan(dev: string, mac: string): number | null {
    return this.macEntry(dev, mac)?.vlan ?? null
  }

  /** No two interfaces share this address inside one broadcast domain. */
  ipUnique(ip: string): boolean {
    return !this.d.dups.some((x) => x.ip === ip)
  }

  /** Devices that share this address in one broadcast domain (lab order; first answers ARP), else []. */
  duplicates(ip: string): string[] {
    return this.d.dups.find((x) => x.ip === ip)?.owners.map((o) => o.dev) ?? []
  }

  /** Running config saved to NVRAM (startup matches running). */
  saved(dev: string): boolean {
    const s = this.startup[dev]
    return !!s && JSON.stringify(s) === JSON.stringify(this.d.cfgs[dev])
  }

  /** OSPF state of a router (process, interfaces, neighbours, routes) or undefined. */
  ospf(dev: string) {
    return this.d.ospf[dev]
  }

  /** OSPF neighbours in FULL state on this router. */
  ospfFull(dev: string) {
    return (this.d.ospf[dev]?.nbrs ?? []).filter((n) => n.state === 'FULL')
  }

  /** FULL adjacency between two routers (seen from both ends). */
  ospfAdjacent(a: string, b: string): boolean {
    return this.ospfFull(a).some((n) => n.peerDev === b) && this.ospfFull(b).some((n) => n.peerDev === a)
  }

  /** Installed routing table (C/L/S/O...). */
  routes(dev: string) {
    return routeTable(this.d, dev)
  }

  /** Installed route for exactly net/prefix. */
  route(dev: string, net: string, prefix: number) {
    return routeTable(this.d, dev).find((e) => e.net === net && e.prefix === prefix)
  }

  /**
   * Route the device would use for dst (longest match over the installed table), or null.
   * L4: Akademi kaynak arayüzlü ICMP ölçütü bunu eski motorun routeLookup'ı gibi kullanır.
   */
  routeFor(dev: string, dst: string): RouteEntry | null {
    const n = ipToInt(dst)
    if (n === null) return null
    let best: RouteEntry | null = null
    for (const e of routeTable(this.d, dev)) {
      if (e.code === 'L') continue
      const m = prefixMaskInt(e.prefix)
      if (((n & m) >>> 0) !== ((ipToInt(e.net)! & m) >>> 0)) continue
      if (!best || e.prefix > best.prefix) best = e
    }
    return best
  }

  errDisabled(dev: string, port: string): boolean {
    return !!this.d.phys[pk(dev, this.canon(port))]?.errDisabled
  }

  private canon(port: string): string {
    const m = /^([A-Za-z-]+)\s*(\d.*)$/.exec(port)
    return (m && canonIf(m[1]!, m[2]!)) || port
  }

  /** FHRP: the router's interface is HSRP Active / VRRP Master for this group. */
  fhrpActive(dev: string, iface: string, group: number): boolean {
    const name = this.canon(iface)
    return (this.d.fhrp?.groups ?? []).some((g) => g.group === Number(group) && g.active?.dev === dev && g.active.ifname === name)
  }

  vlanExists(dev: string, vlan: number): boolean {
    return vlanExists(this.d.cfgs[dev]!, vlan)
  }

  vlanName(dev: string, vlan: number): string | undefined {
    return this.d.cfgs[dev]!.vlans[String(vlan)]
  }

  /** Logical port that carries a physical port (Po for bundle members). */
  port(dev: string, port: string): LPort | undefined {
    return this.d.lportOfPhys[pk(dev, this.canon(port))] ?? this.d.lportByName[pk(dev, this.canon(port))]
  }

  /** Operational trunk carrying the VLAN in forwarding state on this end. */
  trunkCarries(dev: string, port: string, vlan: number): boolean {
    const lp = this.port(dev, port)
    if (!lp || lp.opMode !== 'trunk') return false
    return !!egress(this.d, lp, vlan) && portForwards(this.d, dev, lp, vlan)
  }

  /** Operational trunk that lets the VLAN through (ignores STP state). */
  trunkAllows(dev: string, port: string, vlan: number): boolean {
    const lp = this.port(dev, port)
    return !!lp && lp.opMode === 'trunk' && !!egress(this.d, lp, vlan)
  }

  isTrunk(dev: string, port: string): boolean {
    const lp = this.port(dev, port)
    return !!lp && lp.active && lp.opMode === 'trunk'
  }

  /** PC sits in this VLAN (through its access port). */
  pcVlan(pc: string): number | null {
    return pcNode(this.d, pc)?.vlan ?? null
  }

  ping(from: string, ip: string): PingResult {
    return ping(this.d, from, ip)
  }

  /** L5-g: HTTP (TCP 80) isteği; tabloya/sayaçlara yazmaz. */
  http(from: string, ip: string, port?: number): HttpResult {
    return httpGet(this.d, from, ip, port)
  }

  pcIp(pc: string): string | null {
    return this.d.pcs[pc]?.ip ?? null
  }

  stpRoot(vlan: number): string | null {
    const bridges = this.d.stp[vlan]
    if (!bridges) return null
    for (const [dev, b] of Object.entries(bridges)) if (b.isRoot) {
      // a lone bridge is "root" of nothing; require it to be root for someone else too
      if (Object.values(bridges).some((o) => o !== b && o.rootMac === b.mac)) return dev
    }
    return null
  }

  etherchannel(dev: string, id: number) {
    const g = this.d.ec[dev]?.find((x) => x.id === id)
    return g ? { up: g.up, protocol: g.protocol, bundled: g.members.filter((m) => m.flag === 'P').length } : null
  }

  nativeMismatches() {
    return this.d.nativeMismatch
  }

  /** All operational trunks between switches. */
  trunks(): LPort[] {
    return Object.values(this.d.lports)
      .flat()
      .filter((lp) => lp.active && lp.opMode === 'trunk' && !lp.peerIsPc)
  }

  /** Running config of a switch (read-only use). */
  cfg(dev: string) {
    return this.d.cfgs[dev]!
  }

  hostname(dev: string): string {
    return this.d.cfgs[dev]!.hostname
  }

  /** Physical port state (admin down, link up, EtherChannel flag). */
  phys(dev: string, port: string) {
    return this.d.phys[pk(dev, this.canon(port))]
  }

  /** Physical port config (mode, access VLAN, portfast, nonegotiate...). */
  portCfg(dev: string, port: string) {
    return this.d.cfgs[dev]!.ifaces[this.canon(port)]
  }

  /** STP state of the port that carries this physical port: FWD, BLK, BKN or null when not in the VLAN. */
  stpState(dev: string, port: string, vlan: number): 'FWD' | 'BLK' | 'BKN' | null {
    const lp = this.port(dev, port)
    if (!lp) return null
    return this.d.stp[vlan]?.[dev]?.ports[lp.name]?.state ?? null
  }

  /** Bridge priority including the VLAN id (sys-id-ext), or null if the VLAN is not on this switch. */
  bridgePriority(dev: string, vlan: number): number | null {
    return this.d.stp[vlan]?.[dev]?.prio ?? null
  }

  /** Device is powered on. */
  powered(dev: string): boolean {
    return !!this.d.topo.devices[dev] && !this.d.hw.off.has(dev)
  }

  /**
   * The link on this port is up: cable intact, both ends powered, neither end shut,
   * err-disabled or (PC) NIC-disabled. For a PC the port is its eth0.
   */
  linkUp(dev: string, port = 'eth0'): boolean {
    if (this.d.topo.devices[dev]?.kind === 'pc') {
      const at = this.d.topo.pcAttach[dev]
      return !!at && !!this.d.phys[pk(at.dev, at.port)]?.up
    }
    return !!this.phys(dev, port)?.up
  }

  sviUp(dev: string, vlan: number): boolean {
    return !!this.d.svis[dev]?.find((s) => s.vlan === vlan && s.up)
  }
}
