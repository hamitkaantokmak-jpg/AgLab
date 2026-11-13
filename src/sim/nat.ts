// L5-d: NAT/PAT (IOS `ip nat inside source …`). Yalnız inside → outside geçişinde kaynak
// çevrilir, outside → inside geçişinde hedef geri çevrilir. Eşleşmeyen trafik çevrilmeden
// iletilir (IOS); başarısızlık dönüş yolunun olmamasından gelir. Dinamik çeviriler yalnız
// gerçek trafikte (CLI ping) tabloya yazılır; değerlendirme ping'i (LabQuery) aynı kararı
// tablo yazmadan verir (bekleyen girdiler `natPending` ile dönüş yoluna taşınır).
//
// IOS sırası: inside→outside: giriş ACL'i, yönlendirme, NAT, çıkış ACL'i;
// outside→inside: giriş ACL'i, NAT, yönlendirme.

import { aclDecide, l3OptsOf, type Packet } from './acl'
import type { Derived } from './engine'
import type { NatConfig, SwitchConfig } from './types'
import { ipToInt, pad } from './util'

export interface NatEntry {
  dev: string
  /** null = simple (address-only) entry of a dynamic pool translation */
  proto: 'icmp' | 'tcp' | 'udp' | null
  insideLocal: string
  insideGlobal: string
  outsideLocal?: string
  lport?: number
  gport?: number
  /** outside port (ICMP: the query id) */
  oport?: number
}

export function emptyNat(): NatConfig {
  return { statics: [], pools: {}, rules: [] }
}

const u32 = (ip: string) => ipToInt(ip)! >>> 0
const ip4 = (n: number) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
const role = (cfg: SwitchConfig | undefined, ifname: string) => l3OptsOf(cfg, ifname)?.nat

/** Pool addresses start..end. */
export function poolAddrs(p: { start: string; end: string }): string[] {
  const out: string[] = []
  for (let n = u32(p.start); n <= u32(p.end) && out.length < 4096; n++) out.push(ip4(n))
  return out
}

const sameFlow = (e: NatEntry, dev: string, pkt: Packet) =>
  e.dev === dev && e.proto === pkt.proto && e.insideLocal === pkt.src && e.lport === pkt.sport && e.outsideLocal === pkt.dst

/**
 * inside → outside: translated packet and the new table entries; 'drop' when a matching
 * dynamic rule has no free address (pool exhausted, no overload); null = forwarded as is.
 */
export function natOutbound(
  d: Derived, dev: string, inIf: string, outIf: string, pkt: Packet, table: NatEntry[],
): { pkt: Packet; entries: NatEntry[] } | 'drop' | null {
  const cfg = d.cfgs[dev]
  if (!cfg?.nat || role(cfg, inIf) !== 'inside' || role(cfg, outIf) !== 'outside') return null
  for (const s of cfg.nat.statics) {
    if (s.proto ? s.proto === pkt.proto && s.local === pkt.src && s.lport === pkt.sport : s.local === pkt.src)
      return { pkt: { ...pkt, src: s.global, ...(s.proto ? { sport: s.gport } : {}) }, entries: [] }
  }
  const known = table.find((e) => sameFlow(e, dev, pkt))
  if (known) return { pkt: { ...pkt, src: known.insideGlobal, sport: known.gport }, entries: [] }
  for (const rule of cfg.nat.rules) {
    const acl = cfg.acls?.[rule.acl]
    // NAT matches only explicit permit lines (an undefined list translates nothing)
    const m = acl ? aclDecide(acl, pkt) : null
    if (!m || !m.permit || m.seq === null) continue
    // interface rule: the interface's current address is a one-address pool
    const ifIp = rule.iface ? ifAddr(d, dev, rule.iface) : undefined
    const pool = rule.pool ? cfg.nat.pools[rule.pool] : undefined
    const addrs = rule.iface ? (ifIp ? [ifIp] : []) : pool ? poolAddrs(pool) : []
    // no address (undefined pool, interface without an address): not translated (doğrulanmadı)
    if (!addrs.length) continue
    let global: string
    if (rule.overload) global = addrs[0]!
    else {
      const mine = table.find((e) => e.dev === dev && e.proto === null && e.insideLocal === pkt.src)
      const used = new Set(table.filter((e) => e.dev === dev && e.proto === null).map((e) => e.insideGlobal))
      const free = mine?.insideGlobal ?? addrs.find((x) => !used.has(x))
      // pool exhausted without overload: IOS drops the packet (NAT miss)
      if (!free) return 'drop'
      global = free
    }
    let gport = pkt.sport
    if (rule.overload) {
      // PAT: keep the source port/ICMP id unless another flow already uses it (doğrulanmadı: IOS port seçimi)
      const taken = (p: number | undefined) => table.some((e) => e.dev === dev && e.proto === pkt.proto && e.insideGlobal === global && e.gport === p && e.insideLocal !== pkt.src)
      while (taken(gport)) gport = (gport ?? 0) + 1
    }
    const entries: NatEntry[] = []
    if (!rule.overload && !table.some((e) => e.dev === dev && e.proto === null && e.insideLocal === pkt.src))
      entries.push({ dev, proto: null, insideLocal: pkt.src, insideGlobal: global })
    entries.push({ dev, proto: pkt.proto, insideLocal: pkt.src, insideGlobal: global, outsideLocal: pkt.dst, lport: pkt.sport, gport, oport: pkt.proto === 'icmp' ? pkt.sport : pkt.dport })
    return { pkt: { ...pkt, src: global, sport: gport }, entries }
  }
  return null
}

/** outside → inside: destination translated back (static, then table); null = unchanged. */
export function natInbound(d: Derived, dev: string, inIf: string, pkt: Packet, table: NatEntry[]): Packet | null {
  const cfg = d.cfgs[dev]
  if (!cfg?.nat || role(cfg, inIf) !== 'outside') return null
  for (const s of cfg.nat.statics) {
    if (s.proto ? s.proto === pkt.proto && s.global === pkt.dst && s.gport === pkt.dport : s.global === pkt.dst)
      return { ...pkt, dst: s.local, ...(s.proto ? { dport: s.lport } : {}) }
  }
  // MotorBulgusu (I-1): ICMP hata iletisi (Time Exceeded, unreachable) içindeki özgün UDP/TCP
  // başlığına göre çevrilir (RFC 5508); dport = özgün kaynak portu/kimliği
  const icmpError = pkt.proto === 'icmp' && (pkt.icmpType === 'time-exceeded' || pkt.icmpType === 'unreachable')
  const ext = table.find((e) => e.dev === dev && (icmpError ? e.proto !== null : e.proto === pkt.proto) && e.insideGlobal === pkt.dst && e.gport === pkt.dport)
  if (ext) return { ...pkt, dst: ext.insideLocal, dport: ext.lport }
  const simple = table.find((e) => e.dev === dev && e.proto === null && e.insideGlobal === pkt.dst)
  return simple ? { ...pkt, dst: simple.insideLocal } : null
}

/**
 * Global addresses the router answers ARP for (IOS adds an alias for static globals and pool
 * addresses that fall in a connected subnet; doğrulanmadı: havuz adresleri için ayrıntı).
 */
export function natAliases(cfg: SwitchConfig | undefined): string[] {
  if (!cfg?.nat) return []
  return [...cfg.nat.statics.map((s) => s.global), ...Object.values(cfg.nat.pools).flatMap((p) => poolAddrs(p))]
}

function ifAddr(d: Derived, dev: string, ifname: string): string | undefined {
  const c = d.cfgs[dev]!
  if (ifname.includes('.')) return c.subifs?.[ifname]?.ip?.addr
  return c.ifaces[ifname]?.ip?.addr
}

// ---- CLI çıktıları ----

const col = (ip: string, port?: number) => (port === undefined ? ip : `${ip}:${port}`)

/** `show ip nat translations`: static entries from the configuration, then dynamic ones. */
export function showNatTranslations(cfg: SwitchConfig, dev: string, table: NatEntry[]): string[] {
  const row = (pro: string, ig: string, il: string, ol: string, og: string) => pad(pro, 5) + pad(ig, 22) + pad(il, 22) + pad(ol, 22) + og
  const o = [row('Pro', 'Inside global', 'Inside local', 'Outside local', 'Outside global')]
  for (const s of cfg.nat?.statics ?? [])
    o.push(s.proto ? row(s.proto, col(s.global, s.gport), col(s.local, s.lport), '---', '---') : row('---', s.global, s.local, '---', '---'))
  for (const e of table.filter((x) => x.dev === dev)) {
    if (e.proto === null) o.push(row('---', e.insideGlobal, e.insideLocal, '---', '---'))
    else o.push(row(e.proto, col(e.insideGlobal, e.gport), col(e.insideLocal, e.lport), col(e.outsideLocal!, e.oport), col(e.outsideLocal!, e.oport)))
  }
  return o
}

export function showNatStatistics(cfg: SwitchConfig, dev: string, table: NatEntry[], hits: number, misses: number, ifNames: { inside: string[]; outside: string[] }): string[] {
  const mine = table.filter((e) => e.dev === dev)
  const statics = cfg.nat?.statics.length ?? 0
  const o = [
    `Total active translations: ${statics + mine.length} (${statics} static, ${mine.length} dynamic; ${mine.filter((e) => e.proto !== null).length} extended)`,
    'Outside interfaces:',
    ...ifNames.outside.map((n) => '  ' + n),
    'Inside interfaces:',
    ...ifNames.inside.map((n) => '  ' + n),
    `Hits: ${hits}  Misses: ${misses}`,
    'Expired translations: 0',
    'Dynamic mappings:',
  ]
  if (cfg.nat?.rules.length) o.push('-- Inside Source')
  cfg.nat?.rules.forEach((r, i) => {
    const target = r.iface ? `interface ${r.iface}` : `pool ${r.pool}`
    o.push(`[Id: ${i + 1}] access-list ${r.acl} ${target}${r.overload ? ' overload' : ''} refcount ${mine.filter((e) => e.proto !== null).length}`)
    if (r.pool && cfg.nat!.pools[r.pool]) {
      const p = cfg.nat!.pools[r.pool]!
      const total = poolAddrs(p).length
      const alloc = new Set(mine.filter((e) => e.proto === null).map((e) => e.insideGlobal)).size
      o.push(` pool ${r.pool}: netmask ${p.mask}`, `\tstart ${p.start} end ${p.end}`, `\ttype generic, total addresses ${total}, allocated ${alloc} (${Math.floor((alloc * 100) / total)}%), misses ${misses}`)
    }
  })
  return o
}

/** Global running-config lines (`ip nat pool`, `ip nat inside source …`). */
export function natConfigLines(cfg: SwitchConfig): string[] {
  const n = cfg.nat
  if (!n) return []
  const o: string[] = []
  for (const [name, p] of Object.entries(n.pools)) o.push(`ip nat pool ${name} ${p.start} ${p.end} netmask ${p.mask}`)
  for (const r of n.rules) o.push(`ip nat inside source list ${r.acl} ${r.iface ? `interface ${r.iface}` : `pool ${r.pool}`}${r.overload ? ' overload' : ''}`)
  for (const s of n.statics) o.push(s.proto ? `ip nat inside source static ${s.proto} ${s.local} ${s.lport} ${s.global} ${s.gport}` : `ip nat inside source static ${s.local} ${s.global}`)
  return o
}
