// eBGP (kademe 1; IPv4 unicast): oturum, önek duyurma, yol özellikleri ve en iyi yol seçimi.
// Yapılandırma + türetilmiş L2/L3 durumundan hesaplanır; lab başına betik yok.
//
// Model:
// - Oturum (komşu başına): iki uçta `neighbor` tanımı, karşılıklı doğru `remote-as`, aynı MD5
//   parolası, komşu adresine rota, eBGP tek atlama için doğrudan bağlı komşu (yoksa
//   `ebgp-multihop`), TCP 179'un iki yönde de iletilmesi (ACL dahil) ve karşı tarafın bağlantıyı
//   beklenen kaynak adresten görmesi (`update-source`) gerekir. Kurulmama nedeni ayrı ayrı tutulur
//   (BgpReason); show çıktısı ve günlük (%BGP-5-ADJCHANGE, %BGP-3-NOTIFICATION,
//   %TCP-6-BADAUTH) bu nedenden üretilir.
//   Durum: `neighbor shutdown` → Idle (Admin); komşuya rota yok, doğrudan bağlı değil (multihop
//   yok), update-source arayüzü yok → Idle; diğerleri (karşıda tanım yok, ACL, parola, yanlış AS,
//   karşı taraf reddediyor) → Active. Yanlış AS'te gerçek IOS Idle ile Active arasında gidip
//   gelir; model Active gösterir, nedeni günlük ve `show ip bgp neighbors` söyler.
// - Hold/keepalive zamanlayıcıları, route refresh mesajları ve TCP oturumunun kendisi
//   modellenmez: yakınsama anlıktır (her değişiklikte sabit noktaya kadar yeniden hesaplanır).
//   Show çıktısındaki Up/Down süresi (00:12:34), MsgRcvd/MsgSent ve bellek satırları sabittir.
// - Yerel yollar: `network` RIB'de (BGP dışı; bağlı, statik, OSPF, EIGRP) TAM eşleşen önek
//   ister (ör. /23 duyurmak için `ip route … Null0`); `redistribute static|connected`
//   (varsayılan rota hariç). Yerel yol: next hop 0.0.0.0, weight 32768, ORIGIN i (network) ya da
//   ? (redistribute), MED: tablodaki metrik (bağlı/statik 0) ya da redistribute metric /
//   default-metric.
// - Duyuru (eBGP): her komşuya en iyi yol (o komşudan öğrenilen hariç); AS_PATH'in başına kendi
//   AS eklenir, NEXT_HOP oturumun yerel adresidir; MED yalnız yerel kaynaklı yolda gönderilir
//   (komşu AS'den gelen MED başka AS'e aktarılmaz); Local Preference ve Weight gönderilmez.
//   Alan: AS_PATH'inde kendi AS'ini gören yol reddedilir (döngü önleme). LP alıcıda
//   `bgp default local-preference` (yoksa 100), Weight `neighbor … weight` (yoksa 0).
// - En iyi yol (Cisco sırası): geçerli (next hop BGP dışı tabloyla çözülüyor) → en yüksek Weight
//   → en yüksek Local Preference → yerel kaynaklı → en kısa AS_PATH → en düşük ORIGIN (i < ?) →
//   en düşük MED (yalnız aynı komşu AS'den gelenler arasında; `bgp deterministic-med` açıkmış
//   gibi: önce AS gruplarında) → eBGP > iBGP (kademe 1'de hep eBGP) → en düşük komşu router-id
//   → en düşük komşu adresi. IGP metriği ve "en eski eBGP yolu" adımları modellenmez. Seçimi
//   belirleyen adım yolda saklanır (`decidedBy`).
// - Tabloya kurulum: en iyi (yerel olmayan) yol AD 20 ile rota tablosuna aday olur (statik,
//   OSPF, EIGRP ile AD'ye göre yarışır; next hop özyinelemeli çözülür). Daha düşük AD'li bir rota
//   kazanırsa yol `show ip bgp`'de `r` (RIB-failure) ile işaretlenir.
// - Modellenmeyenler: iBGP, route reflector, confederation, community, aggregate-address,
//   MP-BGP/IPv6, dampening, graceful restart, BFD, zamanlayıcılar, route-map/prefix-list ve
//   `neighbor … default-originate`, `maximum-paths`.
// - Politika (kademe 1b, bgp-policy.ts): gönderenin çıkış (prefix-list, route-map: metric,
//   as-path prepend) ve alıcının giriş politikası (prefix-list, route-map: local-preference,
//   weight, metric, prepend) her yolda uygulanır. Politika komşu başına oturum kurulduğunda ya da
//   `clear ip bgp` ile dondurulur (Derived.bgpApplied); sonraki değişiklik soft clear'a kadar
//   etkisizdir.

import { applyPolicy, resolvePolicy, samePolicy, type BgpPolicy, type PolicyDir } from './bgp-policy'
import type { Derived } from './engine'
import { deliver, l3Ifs, routeTable, sourceIp, type L3If } from './net'
import type { BgpNeighborConfig, SwitchConfig } from './types'
import { ipToInt, maskToPrefix, pad, padL, sameSubnet } from './util'

export const BGP_AD = 20
/** IOS: kendi duyurduğu yolun Weight değeri */
export const LOCAL_WEIGHT = 32768
const BGP_PORT = 179
const CLIENT_PORT = 11000

export type BgpReason =
  | 'admin' // neighbor shutdown
  | 'nosource' // update-source arayüzü yok ya da adressiz
  | 'noroute' // komşu adresine rota yok
  | 'multihop' // eBGP komşu doğrudan bağlı değil (ebgp-multihop yok ya da TTL yetmiyor)
  | 'ibgp' // remote-as kendi AS'i: iBGP kademe 2
  | 'unreach' // TCP 179 karşıya ulaşmıyor ya da dönmüyor
  | 'acl' // TCP 179 bir ACL'ye takılıyor
  | 'nopeer' // karşı tarafta BGP ya da bu adres için neighbor tanımı yok
  | 'peeradmin' // karşı taraf komşuyu kapatmış
  | 'peer' // karşı taraf kendi denetiminde reddediyor (peerReason)
  | 'source' // karşı taraf bağlantıyı beklemediği kaynak adresten görüyor (update-source)
  | 'auth' // MD5 parolası uyuşmuyor
  | 'badas' // remote-as uyuşmuyor (peer in wrong AS)

export type BgpSessionState = 'Established' | 'Active' | 'Idle' | 'Idle (Admin)'

export interface BgpSession {
  ip: string
  remoteAs: number
  state: BgpSessionState
  reason?: BgpReason
  /** 'peer' nedeninde karşı tarafın kendi nedeni */
  peerReason?: BgpReason
  /** yanlış AS: OPEN'ı biz mi reddettik (NOTIFICATION gönderdik), karşı mı */
  notification?: 'sent' | 'received'
  /** MD5: bizde parola var, karşı farklı parola (invalid) ya da hiç (none) kullanıyor; bizde yok (unexpected) */
  auth?: 'invalid' | 'none' | 'unexpected'
  /** komşu adresinin sahibi (bulunduysa) */
  peerDev: string | null
  /** oturumun yerel adresi (update-source ya da çıkış arayüzü) */
  localIp: string | null
  peerRid: string | null
  peerAs: number | null
  /** kabul edilen önek sayısı (Established) */
  pfxRcd: number
}

export type BgpStep = 'only' | 'weight' | 'localpref' | 'local' | 'aspath' | 'origin' | 'med' | 'ebgp' | 'routerid' | 'neighbor'

export interface BgpPath {
  net: string
  prefix: number
  /** next hop; yerel yolda 0.0.0.0 */
  nh: string
  /** öğrenildiği komşu adresi; yerel yolda null */
  from: string | null
  peerRid: string | null
  asPath: number[]
  origin: 'i' | '?'
  med: number | null
  lp: number
  weight: number
  local: boolean
  sourced: 'network' | 'redistribute' | null
  valid: boolean
  best: boolean
  /** en iyi yolu belirleyen karar adımı */
  decidedBy?: BgpStep
  /** daha düşük AD'li rota kazandı (show ip bgp `r`) */
  ribFailure?: boolean
}

export interface BgpEntry {
  net: string
  prefix: number
  /** en iyi önce, sonra geliş sırası */
  paths: BgpPath[]
}

export interface BgpState {
  as: number
  rid: string | null
  sessions: BgpSession[]
  table: BgpEntry[]
  /** rota tablosuna aday en iyi yollar (AD 20) */
  rib: { net: string; prefix: number; nh: string; metric: number; ad: number }[]
  /** komşuya duyurulan yollar (yerel görünümle) */
  advertised: Record<string, BgpPath[]>
  /** komşudan alınıp kabul edilen yollar */
  received: Record<string, BgpPath[]>
  /** AS_PATH'te kendi AS'ini gördüğü için reddedilen yollar (komşu → önekler) */
  loopRejected: Record<string, string[]>
  /** giriş politikasının reddettiği yollar (komşu → önekler) */
  policyDenied: Record<string, string[]>
}

const ipInt = (ip: string) => ipToInt(ip) ?? 0

/** Komşunun etkin politikası: dondurulmuşsa o, yoksa yapılandırmadaki. */
export function effectivePolicy(d: Derived, dev: string, n: BgpNeighborConfig, dir: PolicyDir): BgpPolicy {
  return d.bgpApplied?.[dev + '|' + n.ip]?.[dir] ?? resolvePolicy(d.cfgs[dev]!, n, dir)
}

/** Yapılandırmadaki politika uygulanandan farklı mı (soft clear bekliyor). */
export function policyPending(d: Derived, dev: string, n: BgpNeighborConfig, dir: PolicyDir): boolean {
  const applied = d.bgpApplied?.[dev + '|' + n.ip]?.[dir]
  return !!applied && !samePolicy(applied, resolvePolicy(d.cfgs[dev]!, n, dir))
}
const keyOf = (net: string, prefix: number) => `${net}/${prefix}`

export function bgpRunning(d: Derived, dev: string): boolean {
  const def = d.topo.devices[dev]
  const c = d.cfgs[dev]
  return def?.kind === 'switch' && !!(def.l3 || def.router) && !!c?.ipRouting && !!c.bgp && !d.hw.off.has(dev)
}

/** Router ID: `bgp router-id`, yoksa en yüksek loopback, yoksa en yüksek arayüz adresi. */
export function bgpRid(d: Derived, dev: string): string | null {
  const b = d.cfgs[dev]!.bgp!
  if (b.routerId) return b.routerId
  const ifs = l3Ifs(d, dev)
  const pick = (list: L3If[]) => (list.length ? list.map((i) => i.ip).sort((a, z) => ipInt(z) - ipInt(a))[0]! : null)
  return pick(ifs.filter((i) => i.kind === 'loop')) ?? pick(ifs)
}

/** Sınıflı önek uzunluğu (A /8, B /16, C /24, diğer 32). */
export function classful(net: string): number {
  const f = Number(net.split('.')[0])
  return f < 128 ? 8 : f < 192 ? 16 : f < 224 ? 24 : 32
}

export function recomputeBgp(d: Derived): void {
  d.bgp = {}
  d.bgp = computeBgp(d)
  markRibFailures(d)
}

/** BGP'nin yerel duyurusu rota tablosuna (statik) bağlı mı (track.ts). */
export function bgpUsesStatics(d: Derived, dev: string): boolean {
  const b = d.cfgs[dev]?.bgp
  return !!b && (!!b.redistribute.static || b.networks.length > 0)
}

// ---------------- oturum ----------------

interface SideResult {
  reason?: BgpReason
  src: string | null
  peerDev: string | null
}

/** Bir uçtan bakış: kendi yapılandırması ve yol (TCP 179) uygun mu. */
function sideCheck(d: Derived, dev: string, n: BgpNeighborConfig): SideResult {
  const own = d.cfgs[dev]!.bgp!
  if (n.shutdown) return { reason: 'admin', src: null, peerDev: null }
  if (n.remoteAs === own.as) return { reason: 'ibgp', src: null, peerDev: null }
  let src: string | null = null
  if (n.updateSource) {
    const i = l3Ifs(d, dev).find((x) => x.name === n.updateSource)
    if (!i) return { reason: 'nosource', src: null, peerDev: null }
    src = i.ip
  }
  const out = sourceIp(d, dev, n.ip)
  if (!out) return { reason: 'noroute', src, peerDev: null }
  src = src ?? out
  // eBGP tek atlama: komşu doğrudan bağlı ağda olmalı (multihop yoksa)
  const connected = l3Ifs(d, dev).some((i) => i.kind !== 'loop' && i.node && sameSubnet(i.ip, n.ip, i.prefix))
  if (!n.ebgpMultihop && !connected) return { reason: 'multihop', src, peerDev: null }
  // IOS: tek atlamada TTL 1, multihop'ta yapılandırılan TTL (karşıya en çok ttl−1 router geçilir)
  const ttl = n.ebgpMultihop ?? 1
  const fwd = deliver(d, dev, n.ip, { proto: 'tcp', src, sport: CLIENT_PORT, dport: BGP_PORT, ttl })
  if (fwd.kind === 'expired') return { reason: 'multihop', src, peerDev: null }
  if (fwd.kind !== 'ok') return { reason: fwd.kind === 'unreach' && fwd.filtered ? 'acl' : 'unreach', src, peerDev: null }
  const peerDev = fwd.hops[fwd.hops.length - 1]?.dev ?? null
  if (!peerDev || !l3Ifs(d, peerDev).some((i) => i.ip === n.ip)) return { reason: 'unreach', src, peerDev: null }
  const back = deliver(d, peerDev, src, { proto: 'tcp', src: n.ip, sport: BGP_PORT, dport: CLIENT_PORT, ttl })
  if (back.kind !== 'ok' || back.hops[back.hops.length - 1]?.dev !== dev)
    return { reason: back.kind === 'unreach' && back.filtered ? 'acl' : 'unreach', src, peerDev }
  return { src, peerDev }
}

const IDLE: BgpReason[] = ['noroute', 'multihop', 'nosource', 'ibgp']

function session(d: Derived, dev: string, n: BgpNeighborConfig): BgpSession {
  const own = d.cfgs[dev]!.bgp!
  const s: BgpSession = { ip: n.ip, remoteAs: n.remoteAs, state: 'Active', peerDev: null, localIp: null, peerRid: null, peerAs: null, pfxRcd: 0 }
  const fail = (reason: BgpReason, extra: Partial<BgpSession> = {}): BgpSession => ({
    ...s,
    ...extra,
    reason,
    state: reason === 'admin' ? 'Idle (Admin)' : IDLE.includes(reason) ? 'Idle' : 'Active',
  })
  const a = sideCheck(d, dev, n)
  s.localIp = a.src
  s.peerDev = a.peerDev
  if (a.reason) return fail(a.reason)
  const peer = a.peerDev!
  const pb = bgpRunning(d, peer) ? d.cfgs[peer]!.bgp! : null
  const pn = pb?.neighbors.find((x) => x.ip === a.src)
  if (!pb || !pn) return fail('nopeer')
  s.peerAs = pb.as
  if (pn.shutdown) return fail('peeradmin')
  const b = sideCheck(d, peer, pn)
  if (b.reason) return fail(b.reason === 'acl' ? 'acl' : 'peer', { peerReason: b.reason })
  if (b.src !== n.ip) return fail('source')
  if ((n.password ?? '') !== (pn.password ?? '')) return fail('auth', { auth: n.password ? (pn.password ? 'invalid' : 'none') : 'unexpected' })
  if (n.remoteAs !== pb.as) return fail('badas', { notification: 'sent' })
  if (pn.remoteAs !== own.as) return fail('badas', { notification: 'received' })
  return { ...s, state: 'Established', peerRid: bgpRid(d, peer) }
}

// ---------------- yollar ----------------

function localPaths(d: Derived, dev: string): BgpPath[] {
  const b = d.cfgs[dev]!.bgp!
  const lp = b.defaultLocalPref ?? 100
  const table = routeTable(d, dev).filter((e) => e.code !== 'L')
  const out: BgpPath[] = []
  const base = { nh: '0.0.0.0', from: null, peerRid: null, asPath: [], lp, weight: LOCAL_WEIGHT, local: true, valid: true, best: false }
  for (const n of b.networks) {
    const prefix = maskToPrefix(n.mask)!
    const e = table.find((x) => x.net === n.net && x.prefix === prefix)
    if (!e || out.some((p) => p.net === n.net && p.prefix === prefix)) continue
    const med = e.code === 'C' || e.code === 'S' ? 0 : (e.metric ?? 0)
    out.push({ ...base, net: n.net, prefix, origin: 'i', med, sourced: 'network' })
  }
  for (const [src, code] of [
    ['connected', 'C'],
    ['static', 'S'],
  ] as const) {
    const r = b.redistribute[src]
    if (!r) continue
    for (const e of table) {
      if (e.code !== code || e.prefix === 0 || out.some((p) => p.net === e.net && p.prefix === e.prefix)) continue
      out.push({ ...base, net: e.net, prefix: e.prefix, origin: '?', med: r.metric ?? b.defaultMetric ?? 0, sourced: 'redistribute' })
    }
  }
  return out
}

const ORIGIN_RANK = { i: 0, '?': 2 } as const

/** Cisco sırasıyla en iyi yol; seçimi belirleyen adımla. */
export function selectBest(paths: BgpPath[]): { best: BgpPath | null; step: BgpStep } {
  let set = paths.filter((p) => p.valid)
  if (!set.length) return { best: null, step: 'only' }
  if (set.length === 1) return { best: set[0]!, step: 'only' }
  const steps: [BgpStep, (s: BgpPath[]) => BgpPath[]][] = [
    ['weight', (s) => keepMax(s, (p) => p.weight)],
    ['localpref', (s) => keepMax(s, (p) => p.lp)],
    ['local', (s) => (s.some((p) => p.local) ? s.filter((p) => p.local) : s)],
    ['aspath', (s) => keepMax(s, (p) => -p.asPath.length)],
    ['origin', (s) => keepMax(s, (p) => -ORIGIN_RANK[p.origin])],
    [
      'med',
      // yalnız aynı komşu AS'den gelen yollar karşılaştırılır (MED yoksa 0)
      (s) => s.filter((p) => !s.some((q) => q !== p && q.asPath[0] === p.asPath[0] && (q.med ?? 0) < (p.med ?? 0))),
    ],
    ['ebgp', (s) => s],
    ['routerid', (s) => keepMax(s, (p) => -ipInt(p.peerRid ?? '255.255.255.255'))],
    ['neighbor', (s) => keepMax(s, (p) => -ipInt(p.from ?? '255.255.255.255'))],
  ]
  for (const [step, f] of steps) {
    set = f(set)
    if (set.length === 1) return { best: set[0]!, step }
  }
  return { best: set[0]!, step: 'neighbor' }
}

function keepMax(s: BgpPath[], v: (p: BgpPath) => number): BgpPath[] {
  const m = Math.max(...s.map(v))
  return s.filter((p) => v(p) === m)
}

// ---------------- hesap ----------------

export function computeBgp(d: Derived): Record<string, BgpState> {
  const devs = d.topo.switches.filter((s) => bgpRunning(d, s.id)).map((s) => s.id)
  const out: Record<string, BgpState> = {}
  for (const dev of devs) {
    const b = d.cfgs[dev]!.bgp!
    out[dev] = {
      as: b.as,
      rid: bgpRid(d, dev),
      sessions: b.neighbors.map((n) => session(d, dev, n)),
      table: [],
      rib: [],
      advertised: {},
      received: {},
      loopRejected: {},
      policyDenied: {},
    }
  }
  const local = Object.fromEntries(devs.map((dev) => [dev, localPaths(d, dev)]))
  // next hop geçerliliği: BGP dışı tabloyla çözülüyor mu (aynı sorgu tekrar tekrar sorulur)
  const nhCache = new Map<string, boolean>()
  const nhOk = (dev: string, nh: string) => {
    const k = dev + '|' + nh
    if (!nhCache.has(k)) nhCache.set(k, !!sourceIp(d, dev, nh))
    return nhCache.get(k)!
  }
  let best: Record<string, Map<string, BgpPath>> = Object.fromEntries(devs.map((dev) => [dev, new Map()]))
  let prev = ''
  for (let round = 0; round < 64; round++) {
    const next: Record<string, Map<string, BgpPath>> = {}
    for (const dev of devs) {
      const st = out[dev]!
      const b = d.cfgs[dev]!.bgp!
      const lp = b.defaultLocalPref ?? 100
      const cands = new Map<string, BgpPath[]>()
      const add = (p: BgpPath) => cands.set(keyOf(p.net, p.prefix), [...(cands.get(keyOf(p.net, p.prefix)) ?? []), p])
      for (const p of local[dev]!) add({ ...p })
      st.received = {}
      st.advertised = {}
      st.loopRejected = {}
      st.policyDenied = {}
      for (const s of st.sessions) {
        s.pfxRcd = 0
        if (s.state !== 'Established' || !s.peerDev || !out[s.peerDev]) continue
        const peer = s.peerDev
        const n = b.neighbors.find((x) => x.ip === s.ip)!
        const peerAs = out[peer]!.as
        const pn = d.cfgs[peer]!.bgp!.neighbors.find((x) => x.ip === s.localIp)!
        const outPol = effectivePolicy(d, peer, pn, 'out')
        const inPol = effectivePolicy(d, dev, n, 'in')
        const rx: BgpPath[] = []
        for (const p of best[peer]!.values()) {
          // komşu, bizden öğrendiğini bize geri duyurmaz
          if (p.from === s.localIp) continue
          // gönderenin çıkış politikası (LP ve weight gönderilmez)
          const o = applyPolicy(outPol, p.net, p.prefix).set
          if (!o) continue
          const asPath0 = [peerAs, ...(o.prepend ?? []), ...p.asPath]
          if (asPath0.includes(st.as)) {
            ;(st.loopRejected[s.ip] ??= []).push(keyOf(p.net, p.prefix))
            continue
          }
          // alıcının giriş politikası
          const i = applyPolicy(inPol, p.net, p.prefix).set
          if (!i) {
            ;(st.policyDenied[s.ip] ??= []).push(keyOf(p.net, p.prefix))
            continue
          }
          const path: BgpPath = {
            net: p.net,
            prefix: p.prefix,
            nh: s.ip,
            from: s.ip,
            peerRid: s.peerRid,
            asPath: [...(i.prepend ?? []), ...asPath0],
            origin: p.origin,
            med: i.metric ?? o.metric ?? (p.local ? p.med : null),
            lp: i.localPref ?? lp,
            weight: i.weight ?? n.weight ?? 0,
            local: false,
            sourced: null,
            valid: nhOk(dev, s.ip),
            best: false,
          }
          rx.push(path)
          add(path)
        }
        st.received[s.ip] = rx
        s.pfxRcd = rx.length
      }
      const m = new Map<string, BgpPath>()
      const table: BgpEntry[] = []
      for (const [k, paths] of cands) {
        const { best: w, step } = selectBest(paths)
        for (const p of paths) {
          p.best = p === w
          if (p === w) p.decidedBy = step
          else delete p.decidedBy
        }
        if (w) m.set(k, w)
        table.push({ net: paths[0]!.net, prefix: paths[0]!.prefix, paths: [...paths].sort((a, z) => Number(z.best) - Number(a.best)) })
      }
      table.sort((a, z) => ipInt(a.net) - ipInt(z.net) || a.prefix - z.prefix)
      st.table = table
      next[dev] = m
    }
    best = next
    const sig = JSON.stringify(devs.map((dev) => [...best[dev]!.values()].map((p) => [p.net, p.prefix, p.from, p.asPath, p.med])))
    if (sig === prev) break
    prev = sig
  }
  // duyurulan yollar (show … advertised-routes): komşudan öğrenilen hariç en iyi yollar
  for (const dev of devs) {
    const st = out[dev]!
    const b = d.cfgs[dev]!.bgp!
    for (const s of st.sessions) {
      if (s.state !== 'Established') continue
      const pol = effectivePolicy(d, dev, b.neighbors.find((x) => x.ip === s.ip)!, 'out')
      st.advertised[s.ip] = [...best[dev]!.values()].flatMap((p) => {
        if (p.from === s.ip) return []
        const o = applyPolicy(pol, p.net, p.prefix).set
        return o ? [{ ...p, ...(o.metric !== undefined ? { med: o.metric } : {}) }] : []
      })
    }
    st.rib = [...best[dev]!.values()].filter((p) => !p.local).map((p) => ({ net: p.net, prefix: p.prefix, nh: p.nh, metric: p.med ?? 0, ad: BGP_AD }))
  }
  return out
}

/** Tabloda BGP'yi yenen (daha düşük AD'li) rota varsa en iyi yol RIB-failure (show ip bgp `r`). */
export function markRibFailures(d: Derived): void {
  for (const [dev, st] of Object.entries(d.bgp ?? {})) {
    const table = routeTable(d, dev)
    for (const e of st.table)
      for (const p of e.paths) {
        if (!p.best || p.local) continue
        const r = table.find((x) => x.net === e.net && x.prefix === e.prefix && x.code !== 'L')
        if (r && r.code !== 'B') p.ribFailure = true
        else delete p.ribFailure
      }
  }
}

// ---------------- show ----------------

const STATE_TEXT: Record<BgpReason, string> = {
  admin: 'Administratively shut down',
  nosource: 'update-source interface has no usable address',
  noroute: 'No route to peer',
  multihop: 'External BGP neighbor not directly connected (ebgp-multihop not configured)',
  ibgp: 'Internal BGP (iBGP) is not modelled',
  unreach: 'TCP connection to peer port 179 not established',
  acl: 'TCP port 179 to/from peer is filtered by an access list',
  nopeer: 'Peer has no neighbor statement for this address (connection refused)',
  peeradmin: 'Peer has shut down this neighbor',
  peer: 'Peer rejects the connection',
  source: 'Peer expects another source address (check update-source)',
  auth: 'MD5 authentication mismatch',
  badas: 'BGP Notification, peer in wrong AS',
}

function notActive(d: Derived, dev: string): string[] | null {
  return d.bgp[dev] ? null : ['% BGP not active']
}

function netText(net: string, prefix: number): string {
  return prefix === classful(net) || (net === '0.0.0.0' && prefix === 0) ? net : `${net}/${prefix}`
}

const HEADER = [
  'Status codes: s suppressed, d damped, h history, * valid, > best, i - internal,',
  '              r RIB-failure, S Stale, m multipath, b backup-path, f RT-Filter,',
  '              x best-external, a additional-path, c RIB-compressed,',
  '              t secondary path, L long-lived-stale,',
  'Origin codes: i - IGP, e - EGP, ? - incomplete',
  'RPKI validation codes: V valid, I invalid, N Not found',
  '',
  '     Network          Next Hop            Metric LocPrf Weight Path',
]

function pathRow(p: BgpPath, first: boolean): string {
  const status = (p.valid ? (p.ribFailure ? 'r' : '*') : ' ') + (p.best ? '>' : ' ')
  const net = first ? pad(netText(p.net, p.prefix), 17) : ' '.repeat(17)
  const med = p.med === null ? '' : String(p.med)
  const lp = p.lp !== 100 ? String(p.lp) : ''
  return ` ${status}  ${net}${pad(p.nh, 20)}${padL(med, 6)} ${padL(lp, 6)} ${padL(p.weight, 6)} ${[...p.asPath, p.origin].join(' ')}`
}

function tableRows(paths: BgpPath[]): string[] {
  const o: string[] = []
  let last = ''
  for (const p of paths) {
    const k = keyOf(p.net, p.prefix)
    o.push(pathRow(p, k !== last))
    last = k
  }
  return o
}

function tableVersion(st: BgpState): number {
  return 1 + st.table.length
}

/** `show ip bgp` */
export function showBgp(d: Derived, dev: string): string[] {
  const na = notActive(d, dev)
  if (na) return na
  const st = d.bgp[dev]!
  const o = [`BGP table version is ${tableVersion(st)}, local router ID is ${st.rid ?? '0.0.0.0'}`, ...HEADER]
  o.push(...tableRows(st.table.flatMap((e) => e.paths)))
  return o
}

/** `show ip bgp <ağ> [<maske>]`: önek ayrıntısı (adaylar ve seçilen). */
export function showBgpPrefix(d: Derived, dev: string, net: string, mask?: string): string[] {
  const na = notActive(d, dev)
  if (na) return na
  const st = d.bgp[dev]!
  const n = ipInt(net)
  const e = mask
    ? st.table.find((x) => x.net === net && x.prefix === maskToPrefix(mask))
    : st.table
        .filter((x) => {
          const m = x.prefix ? (0xffffffff << (32 - x.prefix)) >>> 0 : 0
          return ((n & m) >>> 0) === ipInt(x.net)
        })
        .sort((a, z) => z.prefix - a.prefix)[0]
  if (!e) return ['% Network not in table']
  const bestIdx = e.paths.findIndex((p) => p.best)
  const o = [
    `BGP routing table entry for ${e.net}/${e.prefix}, version ${tableVersion(st)}`,
    `Paths: (${e.paths.length} available, ${bestIdx >= 0 ? 'best #' + (bestIdx + 1) : 'no best path'}, table default)`,
  ]
  const adv = st.sessions.filter((s) => s.state === 'Established' && (st.advertised[s.ip] ?? []).some((p) => p.net === e.net && p.prefix === e.prefix))
  o.push(adv.length ? '  Advertised to update-groups:' : '  Not advertised to any peer')
  if (adv.length) o.push('     1')
  for (const p of e.paths) {
    o.push('  Refresh Epoch 1')
    o.push('  ' + (p.asPath.length ? p.asPath.join(' ') : 'Local'))
    o.push(p.local ? `    0.0.0.0 from 0.0.0.0 (${st.rid ?? '0.0.0.0'})` : `    ${p.nh} from ${p.from} (${p.peerRid ?? p.from})`)
    const attrs = [
      `Origin ${p.origin === 'i' ? 'IGP' : 'incomplete'}`,
      ...(p.med === null ? [] : [`metric ${p.med}`]),
      `localpref ${p.lp}`,
      ...(p.weight ? [`weight ${p.weight}`] : []),
      p.valid ? 'valid' : 'invalid (next hop inaccessible)',
      ...(p.local ? ['sourced', 'local'] : ['external']),
      ...(p.best ? ['best'] : []),
    ]
    o.push('      ' + attrs.join(', '))
    if (p.ribFailure) o.push('      RIB-failure: Higher admin distance')
    // IOS'ta olmayan öğretici satır (AğLab modelinin karar adımı)
    if (p.best) o.push(`      AğLab: best path selected by ${STEP_TEXT[p.decidedBy ?? 'only']}`)
  }
  return o
}

/** Modelin karar adımı (IOS'ta yok; öğretici satır, açıkça işaretli). */
const STEP_TEXT: Record<BgpStep, string> = {
  only: 'only valid path',
  weight: 'weight',
  localpref: 'local preference',
  local: 'locally originated',
  aspath: 'AS_PATH length',
  origin: 'origin',
  med: 'MED (same neighbor AS)',
  ebgp: 'eBGP over iBGP',
  routerid: 'lowest neighbor router ID',
  neighbor: 'lowest neighbor address',
}

/** `show ip bgp summary` */
export function showBgpSummary(d: Derived, dev: string): string[] {
  const na = notActive(d, dev)
  if (na) return na
  const st = d.bgp[dev]!
  const paths = st.table.reduce((n, e) => n + e.paths.length, 0)
  const v = tableVersion(st)
  const o = [
    `BGP router identifier ${st.rid ?? '0.0.0.0'}, local AS number ${st.as}`,
    `BGP table version is ${v}, main routing table version ${v}`,
  ]
  if (st.table.length) {
    o.push(`${st.table.length} network entries using ${st.table.length * 144} bytes of memory`)
    o.push(`${paths} path entries using ${paths * 84} bytes of memory`)
  }
  o.push('', 'Neighbor        V           AS MsgRcvd MsgSent   TblVer  InQ OutQ Up/Down  State/PfxRcd')
  for (const s of [...st.sessions].sort((a, z) => ipInt(a.ip) - ipInt(z.ip))) {
    const up = s.state === 'Established'
    o.push(
      `${pad(s.ip, 16)}4 ${padL(s.remoteAs, 12)} ${padL(up ? 12 : 0, 7)} ${padL(up ? 10 : 0, 7)} ${padL(up ? v : 1, 8)}    0    0 ${pad(up ? '00:12:34' : 'never', 8)} ${up ? padL(s.pfxRcd, 12) : s.state}`,
    )
  }
  return o
}

/** `show ip bgp neighbors [<ip>]` */
export function showBgpNeighbors(d: Derived, dev: string, ip?: string): string[] {
  const na = notActive(d, dev)
  if (na) return na
  const st = d.bgp[dev]!
  const b = d.cfgs[dev]!.bgp!
  const list = st.sessions.filter((s) => !ip || s.ip === ip)
  if (ip && !list.length) return ['% No such neighbor or address family']
  const o: string[] = []
  for (const s of list) {
    const n = b.neighbors.find((x) => x.ip === s.ip)!
    const up = s.state === 'Established'
    o.push(`BGP neighbor is ${s.ip},  remote AS ${s.remoteAs}, external link`)
    if (n.description) o.push(` Description: ${n.description}`)
    o.push(`  BGP version 4, remote router ID ${up ? s.peerRid : '0.0.0.0'}`)
    o.push(`  BGP state = ${s.state === 'Idle (Admin)' ? 'Idle' : s.state}${up ? ', up for 00:12:34' : ''}`)
    if (s.state === 'Idle (Admin)') o.push('  Administratively shut down')
    if (up) {
      o.push('  Neighbor sessions:', '    1 active, is not multisession capable (disabled)')
      o.push('  For address family: IPv4 Unicast')
      o.push(`    Prefixes Current: ${(st.advertised[s.ip] ?? []).length} sent, ${s.pfxRcd} received`)
      const loops = st.loopRejected[s.ip]?.length ?? 0
      if (loops) o.push(`    AS_PATH loop: ${loops} prefix(es) denied (own AS ${st.as} in path)`)
      const denied = st.policyDenied[s.ip]?.length ?? 0
      if (denied) o.push(`    Inbound policy: ${denied} prefix(es) denied`)
    }
    if (n.prefixListIn || n.routeMapIn) o.push('  Inbound path policy configured')
    if (n.prefixListOut || n.routeMapOut) o.push('  Outbound path policy configured')
    if (n.prefixListIn) o.push(`  Incoming update prefix filter list is ${n.prefixListIn}`)
    if (n.prefixListOut) o.push(`  Outgoing update prefix filter list is ${n.prefixListOut}`)
    if (n.routeMapIn) o.push(`  Route map for incoming advertisements is ${n.routeMapIn}`)
    if (n.routeMapOut) o.push(`  Route map for outgoing advertisements is ${n.routeMapOut}`)
    for (const dir of ['in', 'out'] as const)
      if (up && policyPending(d, dev, n, dir))
        o.push(`  AğLab: ${dir === 'in' ? 'inbound' : 'outbound'} policy changed; not applied until "clear ip bgp ${s.ip} soft ${dir}"`)
    if (n.weight !== undefined) o.push(`  Default weight ${n.weight}`)
    if (!up && s.reason && s.reason !== 'admin') {
      o.push(`  Last reset never${s.reason === 'badas' ? ', due to BGP Notification ' + (s.notification ?? 'sent') + ', peer in wrong AS' : ''}`)
      o.push(`  AğLab: ${STATE_TEXT[s.reason]}${s.peerReason ? ' (' + STATE_TEXT[s.peerReason] + ')' : ''}`)
    } else if (up) o.push('  Last reset never')
    o.push(
      n.ebgpMultihop
        ? `  External BGP neighbor may be up to ${n.ebgpMultihop} hops away.`
        : s.reason === 'multihop'
          ? '  External BGP neighbor not directly connected.'
          : '  External BGP neighbor may be up to 1 hop away.',
    )
    if (n.password) o.push('  Connection is MD5 authenticated.')
    if (up) {
      o.push(`  Connections established 1; dropped 0`)
      o.push(`Local host: ${s.localIp}, Local port: ${BGP_PORT}`)
      o.push(`Foreign host: ${s.ip}, Foreign port: ${CLIENT_PORT}`)
    } else o.push('  No active TCP connection')
    o.push('')
  }
  return o
}

/** `show ip bgp neighbors <ip> advertised-routes | routes` */
export function showBgpNeighborRoutes(d: Derived, dev: string, ip: string, which: 'advertised' | 'received'): string[] {
  const na = notActive(d, dev)
  if (na) return na
  const st = d.bgp[dev]!
  if (!st.sessions.some((s) => s.ip === ip)) return ['% No such neighbor or address family']
  const paths = (which === 'advertised' ? st.advertised[ip] : st.received[ip]) ?? []
  const o = [`BGP table version is ${tableVersion(st)}, local router ID is ${st.rid ?? '0.0.0.0'}`, ...HEADER, ...tableRows(paths)]
  o.push('', `Total number of prefixes ${paths.length} `)
  return o
}

/** `show ip protocols` BGP bölümü. */
export function bgpProtocolLines(d: Derived, dev: string): string[] {
  const st = d.bgp[dev]
  const b = d.cfgs[dev]?.bgp
  if (!st || !b) return []
  const o = [
    `Routing Protocol is "bgp ${b.as}"`,
    '  Outgoing update filter list for all interfaces is not set',
    '  Incoming update filter list for all interfaces is not set',
    '  IGP synchronization is disabled',
    '  Automatic route summarization is disabled',
  ]
  if (b.redistribute.static || b.redistribute.connected)
    o.push(`  Redistributing: ${(['connected', 'static'] as const).filter((x) => b.redistribute[x]).join(', ')}`)
  o.push('  Neighbor(s):', '    Address          FiltIn FiltOut DistIn DistOut Weight RouteMap')
  for (const n of b.neighbors) o.push(`    ${pad(n.ip, 17)}${' '.repeat(36)}${n.weight !== undefined ? padL(n.weight, 6) : ''}`)
  o.push('  Maximum path: 1', '  Routing Information Sources:', '    Gateway         Distance      Last Update')
  for (const s of st.sessions.filter((x) => x.state === 'Established' && x.pfxRcd)) o.push(`    ${pad(s.ip, 16)}${padL(BGP_AD, 8)}      00:12:34`)
  o.push(`  Distance: external ${BGP_AD} internal 200 local 200`, '')
  return o
}

/** running-config `router bgp` bloğu (IOS sırası). */
export function bgpConfigLines(c: SwitchConfig): string[] {
  const b = c.bgp
  if (!b) return []
  const o = ['router bgp ' + b.as]
  if (b.routerId) o.push(' bgp router-id ' + b.routerId)
  if (b.logNeighborChanges) o.push(' bgp log-neighbor-changes')
  if (b.defaultLocalPref !== null) o.push(' bgp default local-preference ' + b.defaultLocalPref)
  for (const n of b.networks) o.push(` network ${n.net}${maskToPrefix(n.mask) === classful(n.net) ? '' : ' mask ' + n.mask}`)
  for (const src of ['connected', 'static'] as const) {
    const r = b.redistribute[src]
    if (r) o.push(` redistribute ${src}${r.metric !== undefined ? ' metric ' + r.metric : ''}`)
  }
  for (const n of b.neighbors) o.push(...neighborLines(n))
  if (b.defaultMetric !== null) o.push(' default-metric ' + b.defaultMetric)
  o.push('!')
  return o
}

function neighborLines(n: BgpNeighborConfig): string[] {
  const p = ` neighbor ${n.ip} `
  const o = [p + 'remote-as ' + n.remoteAs]
  if (n.description) o.push(p + 'description ' + n.description)
  if (n.password) o.push(p + 'password ' + n.password)
  if (n.ebgpMultihop) o.push(p + 'ebgp-multihop ' + n.ebgpMultihop)
  if (n.updateSource) o.push(p + 'update-source ' + n.updateSource)
  if (n.shutdown) o.push(p + 'shutdown')
  if (n.weight !== undefined) o.push(p + 'weight ' + n.weight)
  if (n.prefixListIn) o.push(p + 'prefix-list ' + n.prefixListIn + ' in')
  if (n.prefixListOut) o.push(p + 'prefix-list ' + n.prefixListOut + ' out')
  if (n.routeMapIn) o.push(p + 'route-map ' + n.routeMapIn + ' in')
  if (n.routeMapOut) o.push(p + 'route-map ' + n.routeMapOut + ' out')
  return o
}

/** IOS: `%BGP-3-NOTIFICATION` iletisinin AS baytları (iki bayt, onaltılı). */
export function asHex(as: number): string {
  return (as & 0xffff).toString(16).toUpperCase().padStart(4, '0')
}

