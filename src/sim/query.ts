// Read-only helpers for lab objectives. Objectives look at derived behaviour, never config text.

import { httpGet, type HttpResult } from './http'
import { egress, portForwards, vlanExists, type Derived, type LPort } from './engine'
import { dnsLookup, isApipa, type DnsResult } from './dhcp'
import { macTable, ping, pcNode, routeTable, type MacEntry, type PingResult, type RouteEntry } from './net'
import type { DhcpBinding, SwitchConfig } from './types'
import type { LogEntry } from './syslog'
import { pk } from './topology'
import { objectUp } from './track'
import { instanceOf, mstDigest, mstOf } from './mst'
import { canonIf, ipToInt, normalizeMac, prefixMaskInt } from './util'

const OSPF_AD = 110

/** `LabQuery.routeFor` sonucu: rota tablosu girdisi + senaryo hedefleri için özet alanlar. */
export type RouteLookup = Omit<RouteEntry, 'prefix' | 'ad'> & {
  prefix: string
  prefixLength: number
  nextHop: string | null
  ad: number
  source: 'C' | 'S' | 'O' | 'D' | 'B' | 'default'
}

export class LabQuery {
  constructor(
    public d: Derived,
    private startup: Record<string, SwitchConfig | null> = {},
    /** MACs that sent or answered traffic; empty = nothing learned yet (see LabRuntime.query()) */
    private learned: Set<string> = new Set(),
    /** L5-b: DHCP leases (see LabRuntime.query()) */
    private leases: DhcpBinding[] = [],
    /** syslog tamponları (bkz. LabRuntime.query()) */
    private logs: Map<string, LogEntry[]> = new Map(),
  ) {}

  /**
   * Cihazın günlük tamponunda anahtar var mı. `mnemonic`: yalnız anahtar (`UPDOWN`) ya da
   * tesis-seviye-anahtar (`LINK-3-UPDOWN`).
   */
  logHas(dev: string, mnemonic: string): boolean {
    return this.logCount(dev, mnemonic) > 0
  }

  logCount(dev: string, mnemonic: string): number {
    const m = mnemonic.replace(/^%/, '')
    return (this.logs.get(dev) ?? []).filter((e) => e.mnemonic === m || `${e.facility}-${e.sev}-${e.mnemonic}` === m).length
  }

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

  /**
   * EIGRP durumu: AS, router ID, komşu adayları (`ok`: komşuluk kuruldu; değilse `reason`:
   * 'as' | 'k' | 'subnet' | 'auth' | 'passive'), arayüzler, topoloji ve rotalar; EIGRP yoksa null.
   */
  eigrp(dev: string) {
    const s = this.d.eigrp[dev]
    if (!s) return null
    return {
      as: s.as,
      rid: s.rid,
      nbrs: s.nbrs.map((n) => ({ peerDev: n.peerDev, ifname: n.ifname, ip: n.ip, ok: n.ok, ...(n.reason ? { reason: n.reason } : {}) })),
      ifs: s.ifs.map((i) => ({ name: i.name, passive: i.passive, bw: i.bw, delay: i.delay })),
      topo: s.topo,
      routes: s.routes,
    }
  }

  /**
   * eBGP durumu: AS, router ID, oturumlar (state, reason, peerAs, pfxRcd), BGP tablosu (önek →
   * yollar; en iyi önce, `decidedBy` seçimi belirleyen adım) ve tabloya aday rotalar; yoksa null.
   */
  bgp(dev: string) {
    const s = this.d.bgp?.[dev]
    if (!s) return null
    return { as: s.as, rid: s.rid, sessions: s.sessions, table: s.table, rib: s.rib, advertised: s.advertised, received: s.received, loopRejected: s.loopRejected }
  }

  /** eBGP oturumu (komşu adresiyle); yoksa null. */
  bgpSession(dev: string, ip: string) {
    return this.d.bgp?.[dev]?.sessions.find((x) => x.ip === ip) ?? null
  }

  /** Bir önek için BGP yolları (en iyi önce) ya da null. */
  bgpPaths(dev: string, net: string, prefix: number) {
    return this.d.bgp?.[dev]?.table.find((e) => e.net === net && e.prefix === prefix)?.paths ?? null
  }

  /** EIGRP topoloji girdisi: FD, successor'lar ve feasible successor'lar (yollar: nh, ifname, metric, rd); yoksa null. */
  eigrpTopo(dev: string, net: string, prefix: number) {
    const t = this.d.eigrp[dev]?.topo.find((x) => x.net === net && x.prefix === prefix)
    return t ? { fd: t.fd, external: t.external, local: t.local?.kind ?? null, successors: t.successors, feasibleSuccessors: t.feasibleSuccessors } : null
  }

  /** OSPF neighbours in FULL state on this router. */
  ospfFull(dev: string) {
    return (this.d.ospf[dev]?.nbrs ?? []).filter((n) => n.state === 'FULL')
  }

  /** FULL adjacency between two routers (seen from both ends). */
  ospfAdjacent(a: string, b: string): boolean {
    return this.ospfFull(a).some((n) => n.peerDev === b) && this.ospfFull(b).some((n) => n.peerDev === a)
  }

  /**
   * IP SLA işlemi: yapılandırıldı mı, zamanlandı mı, son yoklama başarılı mı; `flapping`:
   * nesne Down iken yoklama yedek yoldan başarılı (gerçek IOS'ta dalgalanır; track.ts).
   */
  ipSla(dev: string, n: number): { configured: boolean; scheduled: boolean; ok: boolean; flapping: boolean } {
    const c = this.d.cfgs[dev]?.ipSla?.[String(n)]
    const r = this.d.track?.sla[dev]?.[String(n)]
    return { configured: !!c, scheduled: !!c?.scheduled, ok: !!c && !!r?.ok, flapping: !!c && !!r?.flapping }
  }

  /** İzlenen nesne: Up mı ve türü ('interface' | 'ip sla'; tanımsızsa null ve Down). */
  track(dev: string, n: number): { up: boolean; type: 'interface' | 'ip sla' | null } {
    const t = this.d.cfgs[dev]?.tracks?.[String(n)]
    if (!t) return { up: false, type: null }
    return { up: objectUp(this.d, dev, n), type: t.sla !== undefined ? 'ip sla' : 'interface' }
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
   *
   * Arayüz PR 3: senaryo hedefleri için özet alanlar da döner (rota tablosu girdisinin alanları
   * — code, net, nh, ifname, paths, via — korunur):
   * - `prefix`: "ağ/uzunluk" (ör. "10.20.0.0/24"); `prefixLength` sayı olarak
   * - `nextHop`: yapılandırılmış next-hop (bağlı ağda null)
   * - `ad`: yönetimsel uzaklık (bağlı 0, statik yapılandırılan ya da 1, OSPF 110, EIGRP 90 /
   *   dış 170 / özet Null0 5)
   * - `source`: 'C' | 'S' | 'O' | 'D' | 'default' (0.0.0.0/0 ne kaynaktan gelirse gelsin 'default')
   */
  routeFor(dev: string, dst: string): RouteLookup | null {
    const n = ipToInt(dst)
    if (n === null) return null
    let best: RouteEntry | null = null
    for (const e of routeTable(this.d, dev)) {
      if (e.code === 'L') continue
      const m = prefixMaskInt(e.prefix)
      if (((n & m) >>> 0) !== ((ipToInt(e.net)! & m) >>> 0)) continue
      if (!best || e.prefix > best.prefix) best = e
    }
    if (!best) return null
    const source: RouteLookup['source'] =
      best.prefix === 0 ? 'default' : best.code === 'C' ? 'C' : best.code === 'S' ? 'S' : best.code === 'B' ? 'B' : best.code.startsWith('D') ? 'D' : 'O'
    const ad = best.code === 'C' ? 0 : best.code === 'S' ? (best.ad ?? 1) : best.code === 'B' || best.code.startsWith('D') ? best.ad! : OSPF_AD
    return { ...best, prefix: `${best.net}/${best.prefix}`, prefixLength: best.prefix, nextHop: best.code === 'C' ? null : best.nh, ad, source }
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

  /** FHRP: priority in use on this router's interface for the group (track decrements applied); null if not a member. */
  fhrpPriority(dev: string, iface: string, group: number): number | null {
    const name = this.canon(iface)
    const m = (this.d.fhrp?.members ?? []).find((x) => x.dev === dev && x.ifname === name && x.group === Number(group))
    return m ? m.priority : null
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

  /** MST: VLAN'ın eşlendiği örnek (eşlenmemiş: 0); switch MST kipinde değilse null. */
  mstInstance(dev: string, vlan: number): number | null {
    const c = this.d.cfgs[dev]
    return c?.stpMode === 'mst' ? instanceOf(mstOf(c), vlan) : null
  }

  /**
   * MST: örneğin kökü bu switch'in gözünden (örnek 0: CIST kökü; MSTI: bölgesel kök):
   * { dev, prio (sys-id-ext dahil), mac } ya da (MST değil / örnek yok) null.
   */
  mstRoot(dev: string, inst: number): { dev: string | null; prio: number; mac: string } | null {
    const x = this.d.mst[dev]?.instances.find((i) => i.id === inst)
    return x ? { dev: x.rootDev, prio: x.rootPrio, mac: x.rootMac } : null
  }

  /** MST bölge kimliği: ad, revizyon ve 802.1s yapılandırma özeti (onaltılık). */
  mstRegion(dev: string): { name: string; revision: number; digest: string } {
    const m = mstOf(this.d.cfgs[dev]!)
    return { name: m.name, revision: m.revision, digest: mstDigest(m) }
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
