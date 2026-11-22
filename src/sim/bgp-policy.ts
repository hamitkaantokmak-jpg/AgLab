// eBGP politikası (kademe 1b): ip prefix-list, route-map (match/set alt kümesi) ve komşu başına
// giriş/çıkış uygulaması. Saf işlevler; bgp.ts duyuru ve alımda kullanır.
//
// Model:
// - prefix-list: sıra numarasına göre ilk eşleşen satır karar verir, hiçbiri eşleşmezse ret.
//   `ge`/`le` yoksa önek uzunluğu tam eşit olmalı; varsa uzunluk [ge (yoksa n), le (yoksa 32)]
//   aralığında olmalı. Tanımsız prefix-list'e başvuran komşu filtresi her şeye izin verir.
// - route-map: sıra numarasına göre ilk eşleşen girdi karar verir (deny: ret; permit: set'ler
//   uygulanır), hiçbiri eşleşmezse örtük ret. Eşleşme: girdideki match satırlarının hepsi
//   (aynı satırdaki adlar arasında VEYA). match'siz girdi her şeyi eşler. Tanımsız route-map'e
//   başvuran komşu her şeyi reddeder; match'te tanımsız prefix-list/ACL eşleşmez.
//   ACL eşleşmesi: standart ACL ağ adresine bakar; genişletilmiş ACL kaynakta ağ adresine,
//   hedefte maskeye (IOS'un BGP'deki kullanımı).
// - set: local-preference, metric (MED), weight, as-path prepend. Çıkışta LP ve weight
//   gönderilmez (etkisiz); prepend, kendi AS'in önüne eklenir.
// - Uygulama zamanı (soft clear): komşunun politikası oturum kurulduğunda ya da
//   `clear ip bgp` (sert ya da soft in/out) yapıldığında anlık görüntü olarak alınır. Sonraki
//   değişiklik o ana kadar etkisizdir; `show ip bgp neighbors` bunu "AğLab: … not applied"
//   satırıyla söyler. Gerçek IOS'ta da giriş politikası route refresh / soft clear ister;
//   çıkış politikası da `clear ip bgp … soft out` ile duyurulur (model ikisini aynı tutar).

import { aclDecide } from './acl'
import type { Acl, BgpNeighborConfig, PrefixListEntry, RouteMapEntry, SwitchConfig } from './types'
import { ipToInt, prefixMaskInt, prefixToMask } from './util'

/** Komşunun bir yöndeki çözülmüş politikası (başvurulan nesnelerin o anki içeriği). */
export interface BgpPolicy {
  prefixList: { name: string; entries: PrefixListEntry[] | null } | null
  routeMap: {
    name: string
    entries: RouteMapEntry[] | null
    lists: Record<string, PrefixListEntry[] | null>
    acls: Record<string, Acl | null>
  } | null
}

export type PolicyDir = 'in' | 'out'

export function resolvePolicy(cfg: SwitchConfig, n: BgpNeighborConfig, dir: PolicyDir): BgpPolicy {
  const plName = dir === 'in' ? n.prefixListIn : n.prefixListOut
  const rmName = dir === 'in' ? n.routeMapIn : n.routeMapOut
  let routeMap: BgpPolicy['routeMap'] = null
  if (rmName) {
    const entries = cfg.routeMaps?.[rmName] ?? null
    const lists: Record<string, PrefixListEntry[] | null> = {}
    const acls: Record<string, Acl | null> = {}
    for (const e of entries ?? []) {
      for (const l of e.matchPrefixLists) lists[l] = clone(cfg.prefixLists?.[l] ?? null)
      for (const a of e.matchAcls) acls[a] = clone(cfg.acls?.[a] ?? null)
    }
    routeMap = { name: rmName, entries: clone(entries), lists, acls }
  }
  return {
    prefixList: plName ? { name: plName, entries: clone(cfg.prefixLists?.[plName] ?? null) } : null,
    routeMap,
  }
}

const clone = <T>(v: T): T => (v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)))

export function samePolicy(a: BgpPolicy | undefined, b: BgpPolicy): boolean {
  return !!a && JSON.stringify(a) === JSON.stringify(b)
}

/** Önek prefix-list satırını eşler mi. */
export function plEntryMatches(e: PrefixListEntry, net: string, len: number): boolean {
  if (len < e.len) return false
  const m = prefixMaskInt(e.len)
  if (((ipToInt(net)! & m) >>> 0) !== ((ipToInt(e.net)! & m) >>> 0)) return false
  if (e.ge === undefined && e.le === undefined) return len === e.len
  return len >= (e.ge ?? e.len) && len <= (e.le ?? 32)
}

/** prefix-list kararı; liste yoksa (null) izin. */
export function prefixListPermits(entries: PrefixListEntry[] | null, net: string, len: number): boolean {
  if (!entries) return true
  const e = [...entries].sort((a, b) => a.seq - b.seq).find((x) => plEntryMatches(x, net, len))
  return e?.action === 'permit'
}

export interface PolicyResult {
  /** null: reddedildi */
  set: RouteMapEntry['set'] | null
}

/** Önek politikadan geçer mi; geçerse route-map set'leri. */
export function applyPolicy(pol: BgpPolicy | undefined, net: string, len: number): PolicyResult {
  if (!pol) return { set: {} }
  if (pol.prefixList && !prefixListPermits(pol.prefixList.entries, net, len)) return { set: null }
  const rm = pol.routeMap
  if (!rm) return { set: {} }
  if (!rm.entries) return { set: null }
  for (const e of [...rm.entries].sort((a, b) => a.seq - b.seq)) {
    const plOk = !e.matchPrefixLists.length || e.matchPrefixLists.some((l) => !!rm.lists[l] && prefixListPermits(rm.lists[l]!, net, len))
    const aclOk =
      !e.matchAcls.length ||
      e.matchAcls.some((a) => {
        const acl = rm.acls[a]
        if (!acl) return false
        // ACL'de `ip` satırı her protokolü eşler; önek/maske kaynak/hedef adresi gibi denenir
        return aclDecide(acl, { proto: 'icmp', icmpType: 'echo', src: net, dst: prefixToMask(len) } as unknown as Parameters<typeof aclDecide>[1]).permit
      })
    if (!plOk || !aclOk) continue
    return { set: e.action === 'permit' ? e.set : null }
  }
  return { set: null }
}

// ---------------- CLI yardımcıları ----------------

/** `[seq N] permit|deny A.B.C.D/n [ge N] [le N]` çözümlemesi; hata metni ya da girdi. */
export function parsePrefixListLine(rest: string, list: PrefixListEntry[]): PrefixListEntry | string {
  const t = rest.trim().split(/\s+/)
  let i = 0
  let seq: number | null = null
  if (t[i] === 'seq') {
    seq = Number(t[i + 1])
    if (!Number.isInteger(seq) || seq < 1 || seq > 4294967294) return '% Invalid sequence number'
    i += 2
  }
  const action = t[i++]
  if (action !== 'permit' && action !== 'deny') return '% Invalid input: expected permit or deny'
  const m = /^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/.exec(t[i++] ?? '')
  if (!m || ipToInt(m[1]!) === null || Number(m[2]) > 32) return '% Invalid prefix (A.B.C.D/n)'
  const len = Number(m[2])
  const net = m[1]!
  if (((ipToInt(net)! & prefixMaskInt(len)) >>> 0) !== ipToInt(net)) return '% Invalid prefix range, make sure: len < ge-value <= le-value (host bits must be zero)'
  const e: PrefixListEntry = { seq: seq ?? (list.length ? Math.max(...list.map((x) => x.seq)) + 5 : 5), action, net, len }
  while (i < t.length) {
    const k = t[i++]
    const v = Number(t[i++])
    if ((k !== 'ge' && k !== 'le') || !Number.isInteger(v) || v < 1 || v > 32) return '% Invalid input: ge/le <1-32>'
    e[k] = v
  }
  if ((e.ge !== undefined && e.ge <= len) || (e.le !== undefined && e.le < (e.ge ?? len)) || (e.le !== undefined && e.ge === undefined && e.le <= len))
    return '% Invalid prefix range, make sure: len < ge-value <= le-value'
  return e
}

export function prefixListLines(c: SwitchConfig): string[] {
  const o: string[] = []
  for (const [name, list] of Object.entries(c.prefixLists ?? {}))
    for (const e of [...list].sort((a, b) => a.seq - b.seq)) o.push(`ip prefix-list ${name} ${plEntryText(e)}`)
  if (o.length) o.push('!')
  return o
}

function plEntryText(e: PrefixListEntry): string {
  return `seq ${e.seq} ${e.action} ${e.net}/${e.len}${e.ge !== undefined ? ' ge ' + e.ge : ''}${e.le !== undefined ? ' le ' + e.le : ''}`
}

export function routeMapLines(c: SwitchConfig): string[] {
  const o: string[] = []
  for (const [name, list] of Object.entries(c.routeMaps ?? {}))
    for (const e of [...list].sort((a, b) => a.seq - b.seq)) {
      o.push(`route-map ${name} ${e.action} ${e.seq}`)
      if (e.matchPrefixLists.length) o.push(` match ip address prefix-list ${e.matchPrefixLists.join(' ')}`)
      if (e.matchAcls.length) o.push(` match ip address ${e.matchAcls.join(' ')}`)
      if (e.set.prepend) o.push(` set as-path prepend ${e.set.prepend.join(' ')}`)
      if (e.set.localPref !== undefined) o.push(` set local-preference ${e.set.localPref}`)
      if (e.set.metric !== undefined) o.push(` set metric ${e.set.metric}`)
      if (e.set.weight !== undefined) o.push(` set weight ${e.set.weight}`)
      o.push('!')
    }
  return o
}

/** `show ip prefix-list [ad]` */
export function showPrefixLists(c: SwitchConfig, name?: string): string[] {
  const o: string[] = []
  for (const [n, list] of Object.entries(c.prefixLists ?? {})) {
    if (name && n !== name) continue
    o.push(`ip prefix-list ${n}: ${list.length} entries`)
    for (const e of [...list].sort((a, b) => a.seq - b.seq)) o.push(`   ${plEntryText(e)}`)
  }
  return o
}

/** `show route-map [ad]` */
export function showRouteMaps(c: SwitchConfig, name?: string): string[] {
  const o: string[] = []
  for (const [n, list] of Object.entries(c.routeMaps ?? {})) {
    if (name && n !== name) continue
    for (const e of [...list].sort((a, b) => a.seq - b.seq)) {
      o.push(`route-map ${n}, ${e.action}, sequence ${e.seq}`, '  Match clauses:')
      if (e.matchPrefixLists.length) o.push(`    ip address prefix-lists: ${e.matchPrefixLists.join(' ')} `)
      if (e.matchAcls.length) o.push(`    ip address (access-lists): ${e.matchAcls.join(' ')} `)
      o.push('  Set clauses:')
      if (e.set.prepend) o.push(`    as-path prepend ${e.set.prepend.join(' ')}`)
      if (e.set.localPref !== undefined) o.push(`    local-preference ${e.set.localPref}`)
      if (e.set.metric !== undefined) o.push(`    metric ${e.set.metric}`)
      if (e.set.weight !== undefined) o.push(`    weight ${e.set.weight}`)
      o.push('  Policy routing matches: 0 packets, 0 bytes')
    }
  }
  return o
}
