// L5-c: IPv4 erişim listeleri (IOS). Numaralı standart (1-99) ve genişletilmiş (100-199),
// isimli (`ip access-list standard|extended NAME`). İlk eşleşen satır uygulanır; hiçbiri
// eşleşmezse örtük deny. Uygulanmış ama tanımsız (ya da boş) liste her şeye izin verir (IOS).
// Değerlendirme saf; eşleşme sayaçları yalnız gerçek trafikte (CLI ping/trace) artar.

import type { Acl, AclAddr, AclEntry, AclPort, L3Opts, SwitchConfig } from './types'
import { ipToInt, isIp } from './util'

export const ANY: AclAddr = { addr: '0.0.0.0', wild: '255.255.255.255' }
export const hostAddr = (ip: string): AclAddr => ({ addr: ip, wild: '0.0.0.0' })

export interface Packet {
  src: string
  dst: string
  proto: 'icmp' | 'tcp' | 'udp'
  icmpType?: 'echo' | 'echo-reply' | 'unreachable' | 'time-exceeded'
  sport?: number
  dport?: number
}

/** Well-known port names IOS prints and accepts (tcp/udp). */
const TCP_NAMES: Record<string, number> = { ftp: 21, telnet: 23, smtp: 25, www: 80, pop3: 110 }
const UDP_NAMES: Record<string, number> = { domain: 53, bootps: 67, bootpc: 68, tftp: 69, snmp: 161 }
const BOTH: Record<string, number> = { domain: 53 }
export const ICMP_TYPES = ['echo', 'echo-reply', 'unreachable', 'time-exceeded'] as const

export function aclKind(name: string): 'standard' | 'extended' | null {
  if (!/^\d+$/.test(name)) return null
  const n = Number(name)
  return n >= 1 && n <= 99 ? 'standard' : n >= 100 && n <= 199 ? 'extended' : null
}

const u32 = (ip: string) => ipToInt(ip)! >>> 0
/** IOS stores the address with the wildcard bits cleared. */
export function normAddr(addr: string, wild: string): AclAddr {
  return { addr: intToIp((u32(addr) & ~u32(wild)) >>> 0), wild }
}
function intToIp(n: number): string {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
}
export function addrMatches(a: AclAddr, ip: string): boolean {
  const w = u32(a.wild)
  return ((u32(ip) & ~w) >>> 0) === ((u32(a.addr) & ~w) >>> 0)
}
function portMatches(p: AclPort | undefined, v: number | undefined): boolean {
  if (!p) return true
  if (v === undefined) return false
  switch (p.op) {
    case 'eq':
      return v === p.a
    case 'neq':
      return v !== p.a
    case 'gt':
      return v > p.a
    case 'lt':
      return v < p.a
    case 'range':
      return v >= p.a && v <= p.b!
  }
}

export function entryMatches(e: AclEntry, pkt: Packet): boolean {
  if (e.proto !== 'ip' && e.proto !== pkt.proto) return false
  if (!addrMatches(e.src, pkt.src)) return false
  if (e.dst && !addrMatches(e.dst, pkt.dst)) return false
  if (e.icmpType && e.icmpType !== pkt.icmpType) return false
  if (!portMatches(e.srcPort, pkt.sport) || !portMatches(e.dstPort, pkt.dport)) return false
  return true
}

/** First matching entry; null seq = implicit deny. Undefined or empty list permits (IOS). */
export function aclDecide(acl: Acl | undefined, pkt: Packet): { permit: boolean; seq: number | null } {
  if (!acl || !acl.entries.length) return { permit: true, seq: null }
  for (const e of acl.entries) if (entryMatches(e, pkt)) return { permit: e.action === 'permit', seq: e.seq }
  return { permit: false, seq: null }
}

/** L3 interface options (`ip access-group` lives there) for an interface name. */
export function l3OptsOf(cfg: SwitchConfig | undefined, ifname: string): L3Opts | undefined {
  if (!cfg) return undefined
  if (ifname.startsWith('Vlan')) return cfg.svis[ifname.slice(4)]?.l3
  if (ifname.includes('.')) return cfg.subifs?.[ifname]?.l3
  return cfg.ifaces[ifname]?.l3
}

// ---- parsing (`access-list …`, named-list lines) ----

export class AclSyntax {
  constructor(public token: number) {}
}

/** Parse `permit|deny …` tokens (after the list number / sequence). Throws AclSyntax(i). */
export function parseEntry(tok: string[], type: 'standard' | 'extended', seq: number): AclEntry {
  let i = 0
  const need = () => {
    if (i >= tok.length) throw new AclSyntax(-1)
    return tok[i++]!
  }
  const action = need().toLowerCase()
  if (action !== 'permit' && action !== 'deny') throw new AclSyntax(0)
  const addr = (wildRequired: boolean): AclAddr => {
    const t = need().toLowerCase()
    if (t === 'any') return { ...ANY }
    if (t === 'host') {
      const h = need()
      if (!isIp(h)) throw new AclSyntax(i - 1)
      return hostAddr(h)
    }
    if (!isIp(t)) throw new AclSyntax(i - 1)
    const w = tok[i]
    if (w && isIp(w)) {
      i++
      return normAddr(t, w)
    }
    if (wildRequired) throw new AclSyntax(i)
    return hostAddr(t)
  }
  if (type === 'standard') {
    const src = addr(false)
    if (i < tok.length) throw new AclSyntax(i)
    return { seq, action, proto: 'ip', src }
  }
  const proto = need().toLowerCase()
  if (!['ip', 'icmp', 'tcp', 'udp'].includes(proto)) throw new AclSyntax(i - 1)
  const port = (): AclPort | undefined => {
    if (proto !== 'tcp' && proto !== 'udp') return undefined
    const op = tok[i]?.toLowerCase()
    if (!op || !['eq', 'neq', 'gt', 'lt', 'range'].includes(op)) return undefined
    i++
    const num = () => {
      const t = need().toLowerCase()
      const names = proto === 'tcp' ? { ...TCP_NAMES, ...BOTH } : UDP_NAMES
      const v = /^\d+$/.test(t) ? Number(t) : names[t]
      if (v === undefined || v < 0 || v > 65535) throw new AclSyntax(i - 1)
      return v
    }
    const a = num()
    return op === 'range' ? { op: 'range', a, b: num() } : { op: op as AclPort['op'], a }
  }
  const src = addr(true)
  const srcPort = port()
  const dst = addr(true)
  const dstPort = port()
  let icmpType: string | undefined
  if (proto === 'icmp' && i < tok.length && (ICMP_TYPES as readonly string[]).includes(tok[i]!.toLowerCase())) icmpType = tok[i++]!.toLowerCase()
  if (i < tok.length) throw new AclSyntax(i)
  return {
    seq, action, proto: proto as AclEntry['proto'], src, dst,
    ...(srcPort ? { srcPort } : {}), ...(dstPort ? { dstPort } : {}), ...(icmpType ? { icmpType } : {}),
  }
}

/** Next sequence number (last + 10, IOS). */
export function nextSeq(acl: Acl): number {
  return (acl.entries.at(-1)?.seq ?? 0) + 10
}
export function insertEntry(acl: Acl, e: AclEntry): string[] | void {
  if (acl.entries.some((x) => x.seq === e.seq)) return [`% Duplicate sequence number`]
  acl.entries.push(e)
  acl.entries.sort((a, b) => a.seq - b.seq)
}

// ---- output ----

const PORT_NAME: Record<number, string> = { 21: 'ftp', 23: 'telnet', 25: 'smtp', 53: 'domain', 80: 'www', 110: 'pop3', 67: 'bootps', 68: 'bootpc', 69: 'tftp', 161: 'snmp' }
function fmtPort(p: AclPort | undefined, proto: string): string {
  if (!p) return ''
  const n = (v: number) => (proto === 'udp' && v === 80 ? '80' : (PORT_NAME[v] ?? String(v)))
  return p.op === 'range' ? ` range ${n(p.a)} ${n(p.b!)}` : ` ${p.op} ${n(p.a)}`
}
/** `any`, `host A`, `A W` (extended) / standard list style for show access-lists. */
function fmtAddr(a: AclAddr, standardShow = false): string {
  if (a.wild === '255.255.255.255') return 'any'
  if (a.wild === '0.0.0.0') return standardShow ? a.addr : `host ${a.addr}`
  return standardShow ? `${a.addr}, wildcard bits ${a.wild}` : `${a.addr} ${a.wild}`
}
/** Entry body as in running-config (`permit tcp any host 10.0.0.1 eq www`). */
export function entryText(e: AclEntry, type: 'standard' | 'extended'): string {
  const act = e.action === 'deny' ? 'deny  ' : 'permit'
  if (type === 'standard') {
    const src = e.src.wild === '255.255.255.255' ? 'any' : e.src.wild === '0.0.0.0' ? e.src.addr : `${e.src.addr} ${e.src.wild}`
    return `${act} ${src}`
  }
  return `${act} ${e.proto} ${fmtAddr(e.src)}${fmtPort(e.srcPort, e.proto)} ${fmtAddr(e.dst!)}${fmtPort(e.dstPort, e.proto)}${e.icmpType ? ' ' + e.icmpType : ''}`
}

/** Global running-config lines for every list (numbered first, then named). */
export function aclConfigLines(cfg: SwitchConfig): string[] {
  const o: string[] = []
  const names = Object.keys(cfg.acls ?? {})
  const numbered = names.filter((n) => aclKind(n)).sort((a, b) => Number(a) - Number(b))
  for (const n of numbered) for (const e of cfg.acls![n]!.entries) o.push(`access-list ${n} ${entryText(e, cfg.acls![n]!.type)}`)
  for (const n of names.filter((x) => !aclKind(x)).sort()) {
    const acl = cfg.acls![n]!
    o.push(`ip access-list ${acl.type} ${n}`, ...acl.entries.map((e) => ' ' + entryText(e, acl.type)))
  }
  return o.length ? ['!', ...o] : []
}

/** `show access-lists [name]` with match counters ('dev|acl|seq' → count). */
export function showAccessLists(cfg: SwitchConfig, dev: string, hits: Map<string, number>, only?: string): string[] {
  const o: string[] = []
  const names = Object.keys(cfg.acls ?? {}).filter((n) => !only || n === only)
  names.sort((a, b) => (aclKind(a) && aclKind(b) ? Number(a) - Number(b) : aclKind(a) ? -1 : aclKind(b) ? 1 : a.localeCompare(b)))
  for (const n of names) {
    const acl = cfg.acls![n]!
    o.push(`${acl.type === 'standard' ? 'Standard' : 'Extended'} IP access list ${n}`)
    for (const e of acl.entries) {
      const c = hits.get(`${dev}|${n}|${e.seq}`) ?? 0
      const body =
        acl.type === 'standard'
          ? `${e.action === 'deny' ? 'deny  ' : 'permit'} ${fmtAddr(e.src, true)}`
          : entryText(e, 'extended')
      o.push(`    ${e.seq} ${body}${c ? ` (${c} match${c === 1 ? '' : 'es'})` : ''}`)
    }
  }
  return o
}
