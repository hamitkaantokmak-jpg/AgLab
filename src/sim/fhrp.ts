// FHRP: HSRP (version 1) and VRRP (version 2) on L3 interfaces.
//
// A group is the set of interfaces in one broadcast domain configured with the same protocol,
// group number and virtual address. The highest priority (ties: highest interface address)
// becomes Active (HSRP) / Master (VRRP). An Active/Master keeps its role when a router with a
// higher priority joins unless that router preempts (HSRP: `standby N preempt`, off by default;
// VRRP: on by default, `no vrrp N preempt`). The VRRP address owner (virtual address = its own
// interface address) always uses priority 255 and takes over. HSRP interface/object tracking
// lowers the priority while the tracked line protocol is down.
//
// Who is Active depends on history (preemption), so the runtime keeps the previous Active per
// group and passes it in; without history (lab start, reload of every member) the highest
// priority wins, as when all members boot together.

import type { Derived } from './engine'
import { l2Domain, l3Ifs, type L3If, type Node } from './net'
import { pk } from './topology'
import type { FhrpTrack, L3Opts } from './types'
import { ipToInt, shortIf } from './util'

export type FhrpProto = 'hsrp' | 'vrrp'
export type HsrpState = 'Init' | 'Listen' | 'Standby' | 'Active'
export type VrrpState = 'Init' | 'Backup' | 'Master'

export interface FhrpTrackState {
  obj?: number
  iface: string | null
  decrement: number
  up: boolean
}

export interface FhrpMember {
  proto: FhrpProto
  dev: string
  /** interface name as in l3Ifs (canonical physical, subinterface, VlanN) */
  ifname: string
  group: number
  vip: string | null
  /** interface address (null while the interface has no address or is down) */
  ip: string | null
  /** configured priority (HSRP/VRRP default 100) */
  cfgPriority: number
  /** priority in use: tracking decrements (HSRP), 255 for the VRRP address owner */
  priority: number
  preempt: boolean
  /** VRRP: the virtual address is this interface's own address */
  owner: boolean
  tracks: FhrpTrackState[]
  state: HsrpState | VrrpState
  /** group key ('' while Init: not participating) */
  key: string
}

export interface FhrpGroup {
  key: string
  proto: FhrpProto
  group: number
  vip: string
  members: FhrpMember[]
  active: FhrpMember | null
  /** HSRP only */
  standby: FhrpMember | null
}

export interface FhrpState {
  members: FhrpMember[]
  groups: FhrpGroup[]
}

export const memberId = (m: { proto: FhrpProto; dev: string; ifname: string; group: number }) =>
  `${m.proto}|${m.dev}|${m.ifname}|${m.group}`

export const hsrpMac = (group: number) => '0000.0c07.ac' + group.toString(16).padStart(2, '0')
export const vrrpMac = (group: number) => '0000.5e00.01' + group.toString(16).padStart(2, '0')
export const virtualMac = (m: { proto: FhrpProto; group: number }) => (m.proto === 'hsrp' ? hsrpMac(m.group) : vrrpMac(m.group))

/** Every L3 interface configuration with its l3 options: [name, opts, configured address]. */
function l3Configs(d: Derived, dev: string): [string, L3Opts | undefined][] {
  const cfg = d.cfgs[dev]
  if (!cfg) return []
  const out: [string, L3Opts | undefined][] = []
  for (const [port, c] of Object.entries(cfg.ifaces)) if (c.routed) out.push([port, c.l3])
  for (const [name, si] of Object.entries(cfg.subifs ?? {})) out.push([name, si.l3])
  for (const [v, s] of Object.entries(cfg.svis)) out.push(['Vlan' + v, s.l3])
  return out
}

/** Line protocol of an interface (IOS `track … line-protocol`). */
export function lineProtocolUp(d: Derived, dev: string, ifname: string): boolean {
  if (d.hw.off.has(dev)) return false
  const cfg = d.cfgs[dev]
  if (!cfg) return false
  if (ifname.startsWith('Vlan')) return !!d.svis[dev]?.find((s) => 'Vlan' + s.vlan === ifname)?.up
  if (ifname.includes('.')) {
    const si = cfg.subifs?.[ifname]
    return !!si && !si.shutdown && !!d.lportByName[pk(dev, si.parent)]?.active
  }
  return !!d.lportByName[pk(dev, ifname)]?.active
}

function trackStates(d: Derived, dev: string, tracks: FhrpTrack[] | undefined): FhrpTrackState[] {
  return (tracks ?? []).map((t) => {
    const iface = t.obj !== undefined ? (d.cfgs[dev]?.tracks?.[String(t.obj)]?.iface ?? null) : (t.iface ?? null)
    // an object that is not configured is down (IOS: tracked object does not exist)
    return { ...(t.obj !== undefined ? { obj: t.obj } : {}), iface, decrement: t.decrement ?? 10, up: !!iface && lineProtocolUp(d, dev, iface) }
  })
}

/** Stable id of a broadcast domain: its first switch segment (members coming and going do not
 *  change it); a router-to-router link without a switch falls back to its first node. */
function domainKey(d: Derived, node: Node): string {
  const nodes = [...l2Domain(d, node).nodes.values()].map((x) => x.node)
  const segs = nodes.filter((n) => d.topo.devices[n.dev]?.kind === 'switch' && !(d.topo.devices[n.dev] as { router?: boolean }).router)
  const keys = (segs.length ? segs : nodes).map((n) => `${n.dev}|${n.vlan}`).sort()
  return keys[0]!
}

const rank = (a: FhrpMember, b: FhrpMember) => b.priority - a.priority || (ipToInt(b.ip!) ?? 0) - (ipToInt(a.ip!) ?? 0)

/**
 * Election. `prevActive`: group key → member id of the previous Active/Master (updated in
 * place). Returns every configured member with its state.
 */
export function computeFhrp(d: Derived, prevActive: Map<string, string>): FhrpState {
  const members: FhrpMember[] = []
  for (const sw of d.topo.switches) {
    const up = new Map<string, L3If>(l3Ifs(d, sw.id).map((i) => [i.name, i]))
    for (const [ifname, l3] of l3Configs(d, sw.id)) {
      const iface = up.get(ifname)
      const node = iface?.node ?? null
      for (const proto of ['hsrp', 'vrrp'] as const) {
        for (const g of (proto === 'hsrp' ? l3?.hsrp : l3?.vrrp) ?? []) {
          const tracks = proto === 'hsrp' ? trackStates(d, sw.id, (g as { tracks?: FhrpTrack[] }).tracks) : []
          const cfgPriority = g.priority ?? 100
          const owner = proto === 'vrrp' && !!iface && g.ip === iface.ip
          const priority = owner ? 255 : Math.max(0, cfgPriority - tracks.filter((t) => !t.up).reduce((s, t) => s + t.decrement, 0))
          const m: FhrpMember = {
            proto, dev: sw.id, ifname, group: g.group, vip: g.ip, ip: iface?.ip ?? null, cfgPriority, priority,
            preempt: owner || (proto === 'hsrp' ? !!g.preempt : g.preempt !== false), owner, tracks, state: 'Init', key: '',
          }
          // participates only with an address, a virtual address and a working interface
          // HSRP: aynı yayın alanı + grup numarası bir gruptur; VIP'i farklı olan router hello'ları
          // kabul eder, seçime katılır ve %HSRP-4-DIFFVIP1 yazar. VRRP: VIP listesi uyuşmayan ilan
          // düşürülür (RFC 3768 7.1), VIP grup anahtarının parçasıdır.
          if (iface && node && g.ip) m.key = proto === 'hsrp' ? `hsrp|${g.group}|${domainKey(d, node)}` : `vrrp|${g.group}|${g.ip}|${domainKey(d, node)}`
          members.push(m)
        }
      }
    }
  }
  const byKey = new Map<string, FhrpMember[]>()
  for (const m of members) if (m.key) byKey.set(m.key, [...(byKey.get(m.key) ?? []), m])
  const groups: FhrpGroup[] = []
  for (const [key, list] of byKey) {
    const sorted = [...list].sort(rank)
    const best = sorted[0]!
    const prev = list.find((m) => memberId(m) === prevActive.get(key))
    // an Active keeps its role unless a higher-priority member preempts
    const active = prev && !(best !== prev && best.preempt && best.priority > prev.priority) ? prev : best
    prevActive.set(key, memberId(active))
    const proto = best.proto
    let standby: FhrpMember | null = null
    for (const m of sorted) {
      if (m === active) m.state = proto === 'hsrp' ? 'Active' : 'Master'
      else if (proto === 'hsrp' && !standby) {
        standby = m
        m.state = 'Standby'
      } else m.state = proto === 'hsrp' ? 'Listen' : 'Backup'
    }
    // grubun VIP'i Active'inkidir (VIP ARP'sini ve ping'ini Active yanıtlar)
    groups.push({ key, proto, group: best.group, vip: active.vip!, members: list, active, standby })
  }
  for (const k of [...prevActive.keys()]) if (!byKey.has(k)) prevActive.delete(k)
  return { members, groups }
}

/** The Active/Master interface answering for a virtual address in the domain of `node`. */
export function fhrpTarget(d: Derived, ip: string, inDomain: (n: Node) => boolean): L3If | null {
  for (const g of d.fhrp?.groups ?? []) {
    const a = g.active
    if (!a || g.vip !== ip) continue
    const base = l3Ifs(d, a.dev).find((i) => i.name === a.ifname)
    if (base?.node && inDomain(base.node)) return { ...base, ip, mac: virtualMac(a) }
  }
  return null
}

/** The router is Active/Master for this virtual address (answers pings to it). */
export function fhrpOwns(d: Derived, dev: string, ip: string): boolean {
  return (d.fhrp?.groups ?? []).some((g) => g.vip === ip && g.active?.dev === dev)
}

// ---------------- show commands ----------------

function membersOf(d: Derived, dev: string, proto: FhrpProto): FhrpMember[] {
  return (d.fhrp?.members ?? []).filter((m) => m.dev === dev && m.proto === proto)
}
const groupOf = (d: Derived, m: FhrpMember) => d.fhrp?.groups.find((g) => g.key === m.key && !!m.key) ?? null
const padR = (s: string | number, n: number) => (String(s).length >= n ? String(s) + ' ' : String(s) + ' '.repeat(n - String(s).length))

/** `show standby brief` (IOS 15). */
export function showStandbyBrief(d: Derived, dev: string): string[] {
  const ms = membersOf(d, dev, 'hsrp')
  if (!ms.length) return []
  const o = ['                     P indicates configured to preempt.', '                     |']
  o.push('Interface   Grp  Pri P State   Active          Standby         Virtual IP')
  for (const m of ms) {
    const g = groupOf(d, m)
    const active = !g?.active ? 'unknown' : g.active === m ? 'local' : g.active.ip!
    const standby = !g?.standby ? 'unknown' : g.standby === m ? 'local' : g.standby.ip!
    o.push(
      padR(shortIf(m.ifname), 12) + padR(m.group, 5) + String(m.priority).padStart(3) + ' ' + (m.preempt ? 'P ' : '  ') +
        padR(m.state, 8) + padR(active, 16) + padR(standby, 16) + (m.vip ?? 'unknown'),
    )
  }
  return o
}

/** `show standby` (IOS 15; zamanlayıcı geri sayımları ve durum değişikliği sayaçları yazılmaz). */
export function showStandby(d: Derived, dev: string): string[] {
  const o: string[] = []
  for (const m of membersOf(d, dev, 'hsrp')) {
    const g = groupOf(d, m)
    const mac = hsrpMac(m.group)
    o.push(`${m.ifname} - Group ${m.group}`)
    o.push(`  State is ${m.state}` + (m.state === 'Init' && !m.ip ? ' (interface down)' : m.state === 'Init' && !m.vip ? ' (virtual IP not configured)' : ''))
    o.push(`  Virtual IP address is ${m.vip ?? 'unknown'}`)
    o.push(`  Active virtual MAC address is ${g?.active ? mac : 'unknown'}` + (g?.active ? (g.active === m ? ' (MAC In Use)' : ' (MAC Not In Use)') : ''))
    o.push(`    Local virtual MAC address is ${mac} (v1 default)`)
    o.push('  Hello time 3 sec, hold time 10 sec')
    o.push(`  Preemption ${m.preempt ? 'enabled' : 'disabled'}`)
    o.push('  Active router is ' + (!g?.active ? 'unknown' : g.active === m ? 'local' : `${g.active.ip}, priority ${g.active.priority}`))
    o.push('  Standby router is ' + (!g?.standby ? 'unknown' : g.standby === m ? 'local' : `${g.standby.ip}, priority ${g.standby.priority}`))
    o.push(`  Priority ${m.priority} (configured ${m.cfgPriority})`)
    for (const t of m.tracks)
      o.push(
        (t.obj !== undefined ? `    Track object ${t.obj}` : `    Track interface ${t.iface}`) +
          ` state ${t.up ? 'Up' : 'Down'} decrement ${t.decrement}`,
      )
    o.push(`  Group name is "hsrp-${shortIf(m.ifname)}-${m.group}" (default)`)
  }
  return o
}

/** VRRP Master Down interval (ms): 3 × advertisement interval + skew time (RFC 3768). */
const downMs = (prio: number) => 3000 + Math.floor(((256 - prio) * 1000) / 256)

/** `show vrrp brief` (IOS 15). */
export function showVrrpBrief(d: Derived, dev: string): string[] {
  const ms = membersOf(d, dev, 'vrrp')
  if (!ms.length) return []
  const o = ['Interface          Grp Pri Time  Own Pre State   Master addr     Group addr']
  for (const m of ms) {
    const g = groupOf(d, m)
    o.push(
      padR(shortIf(m.ifname), 19) + padR(m.group, 4) + padR(m.priority, 4) + padR(downMs(m.priority), 6) + padR(m.owner ? 'Y' : '', 4) +
        padR(m.preempt ? 'Y' : '', 4) + padR(m.state, 8) + padR(g?.active?.ip ?? '0.0.0.0', 16) + (m.vip ?? '0.0.0.0'),
    )
  }
  return o
}

/** `show vrrp` (IOS 15; geri sayımlar yazılmaz). */
export function showVrrp(d: Derived, dev: string): string[] {
  const o: string[] = []
  for (const m of membersOf(d, dev, 'vrrp')) {
    const g = groupOf(d, m)
    o.push(`${m.ifname} - Group ${m.group}`)
    o.push(`  State is ${m.state}`)
    o.push(`  Virtual IP address is ${m.vip ?? '0.0.0.0'}`)
    o.push(`  Virtual MAC address is ${vrrpMac(m.group)}`)
    o.push('  Advertisement interval is 1.000 sec')
    o.push(`  Preemption ${m.preempt ? 'enabled' : 'disabled'}`)
    o.push(`  Priority is ${m.priority}` + (m.owner ? ' (owner)' : ''))
    const master = g?.active
    o.push(
      '  Master Router is ' +
        (!master ? 'unknown' : master === m ? `${m.ip} (local), priority is ${m.priority}` : `${master.ip}, priority is ${master.priority}`),
    )
    o.push('  Master Advertisement interval is 1.000 sec')
    o.push(`  Master Down interval is ${(downMs(m.priority) / 1000).toFixed(3)} sec`)
  }
  return o
}

/** `show track` (line-protocol objects). */
export function showTrack(d: Derived, dev: string): string[] {
  const o: string[] = []
  const tracks = d.cfgs[dev]?.tracks ?? {}
  for (const n of Object.keys(tracks).map(Number).sort((a, b) => a - b)) {
    const iface = tracks[String(n)]!.iface
    const up = lineProtocolUp(d, dev, iface)
    o.push(`Track ${n}`, `  Interface ${iface} line-protocol`, `  Line protocol is ${up ? 'Up' : 'Down'}`)
    const users = (d.fhrp?.members ?? []).filter((m) => m.dev === dev && m.tracks.some((t) => t.obj === n))
    if (users.length) {
      o.push('Tracked by:')
      for (const m of users) o.push(`  HSRP ${m.ifname} ${m.group}`)
    }
  }
  return o
}
