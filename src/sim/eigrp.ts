// Klasik EIGRP (IPv4, AS kipi): komşuluk, bileşik metrik, DUAL (FD/RD, successor, feasible
// successor), variance, özetleme (auto-summary, ip summary-address), dış rotalar (redistribute
// static|connected), stub. Yapılandırma + türetilmiş L2/L3 durumundan hesaplanır; lab başına betik yok.
//
// Model:
// - Komşuluk: iki uçta aynı AS, aynı K değerleri, karşı adres kendi arayüz alt ağında (birincil
//   adres), kimlik doğrulama (md5 kipi + gönderenin en küçük geçerli anahtarı alıcıda aynı numara
//   ve metinle) tutmalı; arayüz passive olmamalı. Hello/hold eşleşmek zorunda değil.
// - Metrik: 256 × (K1·10^7/en düşük bw + K2·(…)/(256−load) + K3·toplam delay) [× K5/(rel+K4)];
//   delay onlarca µs. Yük 1/255, güvenilirlik 255/255 sabittir.
// - Yakınsama anlıktır: her değişiklikte uzaklık vektörü başlangıçtan (yalnız yerel kaynaklar)
//   eşzamanlı turlarla, bölünmüş ufuk (split horizon) uygulanarak sabit noktaya kadar hesaplanır.
//   DUAL sorgu/yanıt, Active durum, stuck-in-active ve zamanlayıcılar modellenmez.
// - Topoloji tablosu: her komşunun son duyurusu (RD) ve bu router üzerinden uzaklığı. FD = en
//   iyi uzaklık; successor'lar FD'ye eşit olanlar (maximum-paths kadar); feasible successor
//   RD < FD koşulunu sağlayan diğerleri. variance > 1 iken yalnız FS'ler (uzaklık < variance × FD)
//   eşit olmayan maliyetle tabloya girer. İç rota dış rotaya her zaman yeğlenir.
// - Özet: `ip summary-address eigrp` yalnız o arayüzden bileşenlerin yerine duyurulur (metrik:
//   en küçük bileşen); auto-summary sınıflı sınırı geçen iç rotaları sınıflı ağa özetler. Özet
//   etkinse yerelde Null0 rotası (AD 5) kurulur. Dış rotalar auto-summary ile özetlenmez.
// - Stub: yalnız izin verilen yerel türler (connected / summary / static; receive-only: hiçbiri)
//   duyurulur, öğrenilen rotalar duyurulmaz (transit olmaz). Hub'ın stub'a sorgu göndermemesi
//   (sorgular modellenmediği için) ayrıca modellenmez.

import type { Derived } from './engine'
import { ifBandwidth, l2Domain, l3Ifs, routeTable, type L3If } from './net'
import type { EigrpConfig, EigrpSeedMetric, L3Opts, SwitchConfig, SwitchDef } from './types'
import { ipToInt, maskToPrefix, networkOf, pad, padL, prefixMaskInt, sameSubnet, shortIf } from './util'

export const EIGRP_AD = 90
export const EIGRP_EX_AD = 170
export const EIGRP_SUMMARY_AD = 5
export const DEFAULT_K: EigrpConfig['k'] = [1, 0, 1, 0, 0]

export type EigrpNbrReason = 'as' | 'k' | 'subnet' | 'auth' | 'passive'

export interface EigrpIf {
  name: string
  ip: string
  prefix: number
  /** kbit/s */
  bw: number
  /** onlarca µs */
  delay: number
  passive: boolean
  hello: number
  hold: number
  md5: boolean
  keyChain: string | null
  l3: L3If
}

export interface EigrpNbr {
  peerDev: string
  ifname: string
  peerIf: string
  /** komşunun adresi */
  ip: string
  ok: boolean
  reason?: EigrpNbrReason
  /** komşunun ilan ettiği hold süresi */
  hold: number
}

/** Topoloji tablosunda bir komşu üzerinden yol. */
export interface EigrpPath {
  nh: string
  ifname: string
  peerDev: string
  /** bu router üzerinden uzaklık */
  metric: number
  /** komşunun bildirdiği uzaklık (RD) */
  rd: number
  bw: number
  delay: number
  hops: number
  external: boolean
  origin: string
}

export interface EigrpTopoEntry {
  net: string
  prefix: number
  external: boolean
  fd: number
  successors: EigrpPath[]
  feasibleSuccessors: EigrpPath[]
  /** komşulardan gelen bütün yollar (all-links) */
  all: EigrpPath[]
  /** yerel kaynak: bağlı ağ, aktarılan rota ya da özet (Null0) */
  local?: { kind: 'connected' | 'redistributed' | 'summary'; ifname?: string; bw: number; delay: number }
}

export interface EigrpRoutePath {
  nh: string
  ifname: string
  metric: number
}

export interface EigrpRoute {
  code: 'D' | 'D EX'
  net: string
  prefix: number
  metric: number
  ad: number
  /** boş: Null0 özeti */
  paths: EigrpRoutePath[]
}

export interface EigrpState {
  as: number
  rid: string | null
  ifs: EigrpIf[]
  nbrs: EigrpNbr[]
  topo: EigrpTopoEntry[]
  routes: EigrpRoute[]
}

interface Vec {
  bw: number
  delay: number
  hops: number
  external: boolean
  origin: string
}

/** Yerel kaynak (bağlı ağ / aktarılan rota) */
interface Origin extends Vec {
  net: string
  prefix: number
  kind: 'connected' | 'redistributed'
  /** stub süzgeci: connected (bağlı ağ ya da redistribute connected) ya da static */
  stubType: 'connected' | 'static'
  ifname?: string
}

// ---------------- yardımcılar ----------------

/** IOS arayüz gecikmesi (onlarca µs): GigE 1, FastEthernet 10, Loopback 500, SVI 1. */
export function ifDelay(name: string, override?: number): number {
  if (override !== undefined) return override
  if (name.startsWith('Loopback')) return 500
  if (name.startsWith('Vlan')) return 1
  const bw = ifBandwidth(name)
  return bw >= 1_000_000 ? 1 : bw >= 100_000 ? 10 : 100
}

/** Bileşik metrik (yük 1, güvenilirlik 255). */
export function compositeMetric(bw: number, delay: number, k: EigrpConfig['k'] = DEFAULT_K, load = 1, rel = 255): number {
  const [k1, k2, k3, k4, k5] = k
  const b = Math.floor(10_000_000 / Math.max(1, bw))
  let m = k1 * b + Math.floor((k2 * b) / (256 - load)) + k3 * delay
  if (k5) m = Math.floor((m * k5) / (rel + k4))
  return m * 256
}

/** Sınıflı önek uzunluğu (A /8, B /16, C /24). */
export function classfulPrefix(net: string): number {
  const first = Number(net.split('.')[0])
  return first < 128 ? 8 : first < 192 ? 16 : first < 224 ? 24 : 32
}
const majorOf = (net: string) => {
  const p = classfulPrefix(net)
  return { net: networkOf(net, p), prefix: p }
}

const pkey = (net: string, prefix: number) => `${net}/${prefix}`
const ipInt = (ip: string) => ipToInt(ip) ?? 0
const within = (net: string, prefix: number, sNet: string, sPrefix: number) =>
  prefix >= sPrefix && ((ipInt(net) & prefixMaskInt(sPrefix)) >>> 0) === ipInt(sNet)

/** `network` satırı bu adresi kapsıyor mu (wildcard yoksa sınıflı ağ). */
export function eigrpNetMatches(n: EigrpConfig['networks'][number], ip: string): boolean {
  const a = ipInt(ip)
  if (n.wildcard === null) {
    const p = classfulPrefix(n.addr)
    return networkOf(ip, p) === networkOf(n.addr, p)
  }
  const care = ~ipInt(n.wildcard) >>> 0
  return ((a & care) >>> 0) === ((ipInt(n.addr) & care) >>> 0)
}

export function eigrpL3Opts(cfg: SwitchConfig, ifname: string): L3Opts | undefined {
  if (ifname.startsWith('Vlan')) return cfg.svis[ifname.slice(4)]?.l3
  if (ifname.startsWith('Loopback')) return cfg.loopbacks?.[ifname.slice(8)]?.l3
  if (ifname.includes('.')) return cfg.subifs?.[ifname]?.l3
  return cfg.ifaces[ifname]?.l3
}

export function eigrpRunning(d: Derived, dev: string): boolean {
  const def = d.topo.devices[dev]
  const c = d.cfgs[dev]
  return def?.kind === 'switch' && !!(def.l3 || def.router) && !!c?.ipRouting && !!c.eigrp && !d.hw.off.has(dev)
}

const isPassive = (e: EigrpConfig, name: string) => (e.passiveDefault ? !e.passive.includes(name) : e.passive.includes(name))

/** Router ID: `eigrp router-id`, yoksa en yüksek loopback, yoksa en yüksek arayüz adresi. */
function eigrpRid(d: Derived, dev: string): string | null {
  const e = d.cfgs[dev]!.eigrp!
  if (e.routerId) return e.routerId
  const ifs = l3Ifs(d, dev)
  const pick = (list: L3If[]) => (list.length ? list.map((i) => i.ip).sort((a, b) => ipInt(b) - ipInt(a))[0]! : null)
  return pick(ifs.filter((i) => i.kind === 'loop')) ?? pick(ifs)
}

/** Gönderenin kullandığı anahtar: anahtar zincirindeki en küçük numaralı, metni olan anahtar. */
function sendKey(cfg: SwitchConfig, chain: string | null): { id: string; str: string } | null {
  const c = chain ? cfg.keyChains?.[chain] : undefined
  if (!c) return null
  const id = Object.keys(c)
    .filter((k) => c[k] !== null)
    .sort((a, b) => Number(a) - Number(b))[0]
  return id === undefined ? null : { id, str: c[id]! }
}

/** Alıcı (rx) gönderenin (tx) paketlerini kabul eder mi. */
function authOk(d: Derived, rx: { dev: string; i: EigrpIf }, tx: { dev: string; i: EigrpIf }): boolean {
  if (!rx.i.md5 && !tx.i.md5) return true
  if (rx.i.md5 !== tx.i.md5) return false
  const k = sendKey(d.cfgs[tx.dev]!, tx.i.keyChain)
  if (!k) return false
  const mine = rx.i.keyChain ? d.cfgs[rx.dev]!.keyChains?.[rx.i.keyChain] : undefined
  return !!mine && mine[k.id] === k.str
}

// ---------------- hesap ----------------

/** EIGRP'i (yeniden) hesaplar: track.ts, nesne durumları yazıldıktan sonra da çağırır. */
export function recomputeEigrp(d: Derived): void {
  d.eigrp = {}
  d.eigrp = computeEigrp(d)
}

/** Bu router'ın EIGRP dış duyurusu rota tablosuna bağlı mı (redistribute static). */
export function eigrpExternalsFromTable(d: Derived, dev: string): boolean {
  return !!d.cfgs[dev]?.eigrp?.redistribute.static
}

export function computeEigrp(d: Derived): Record<string, EigrpState> {
  const out: Record<string, EigrpState> = {}
  const devs = d.topo.switches.filter((s) => eigrpRunning(d, s.id)).map((s) => s.id)

  // 1. arayüzler (yalnız açık ve network satırıyla eşleşen)
  for (const dev of devs) {
    const cfg = d.cfgs[dev]!
    const e = cfg.eigrp!
    const ifs: EigrpIf[] = []
    for (const l3 of l3Ifs(d, dev)) {
      if (!e.networks.some((n) => eigrpNetMatches(n, l3.ip))) continue
      const o = eigrpL3Opts(cfg, l3.name) ?? {}
      const forAs = <T extends { as: number }>(x: T | undefined) => (x && x.as === e.as ? x : undefined)
      ifs.push({
        name: l3.name,
        ip: l3.ip,
        prefix: l3.prefix,
        bw: ifBandwidth(l3.name, o.bandwidth),
        delay: ifDelay(l3.name, o.delay),
        passive: isPassive(e, l3.name),
        hello: forAs(o.eigrpHello)?.sec ?? 5,
        hold: forAs(o.eigrpHold)?.sec ?? 15,
        md5: !!forAs(o.eigrpAuthMd5),
        keyChain: forAs(o.eigrpKeyChain)?.name ?? null,
        l3,
      })
    }
    out[dev] = { as: e.as, rid: eigrpRid(d, dev), ifs, nbrs: [], topo: [], routes: [] }
  }

  // 2. hello: aynı yayın alanındaki EIGRP arayüzleri
  type Talker = { dev: string; i: EigrpIf }
  const talkers: Talker[] = Object.entries(out).flatMap(([dev, s]) => s.ifs.filter((i) => i.l3.node && i.l3.kind !== 'loop').map((i) => ({ dev, i })))
  const nk = (t: Talker) => `${t.i.l3.node!.dev}|${t.i.l3.node!.vlan}`
  const domOf = new Map<Talker, Set<string>>()
  for (const t of talkers) domOf.set(t, new Set([...l2Domain(d, t.i.l3.node!).nodes.keys()]))
  const cfgOf = (dev: string) => d.cfgs[dev]!.eigrp!
  /** a'nın b'den gelen hello'yu reddetme nedeni (a'nın gözünden) */
  const reject = (a: Talker, b: Talker): EigrpNbrReason | null => {
    if (a.i.passive || b.i.passive) return 'passive'
    if (cfgOf(a.dev).as !== cfgOf(b.dev).as) return 'as'
    if (cfgOf(a.dev).k.join() !== cfgOf(b.dev).k.join()) return 'k'
    if (!sameSubnet(a.i.ip, b.i.ip, a.i.prefix)) return 'subnet'
    if (!authOk(d, a, b)) return 'auth'
    return null
  }
  const adj: { a: Talker; b: Talker }[] = []
  for (const a of talkers) {
    for (const b of talkers) {
      if (b.dev === a.dev || !domOf.get(a)!.has(nk(b))) continue
      const reason = reject(a, b) ?? reject(b, a)
      out[a.dev]!.nbrs.push({ peerDev: b.dev, ifname: a.i.name, peerIf: b.i.name, ip: b.i.ip, ok: !reason, ...(reason ? { reason } : {}), hold: b.i.hold })
      if (!reason) adj.push({ a, b })
    }
  }

  // 3. yerel kaynaklar
  const origins = new Map<string, Map<string, Origin>>()
  for (const dev of devs) {
    const e = cfgOf(dev)
    const s = out[dev]!
    const m = new Map<string, Origin>()
    const rid = s.rid ?? '0.0.0.0'
    for (const i of s.ifs) {
      const net = networkOf(i.ip, i.prefix)
      if (!m.has(pkey(net, i.prefix)))
        m.set(pkey(net, i.prefix), { net, prefix: i.prefix, bw: i.bw, delay: i.delay, hops: 0, external: false, origin: rid, kind: 'connected', stubType: 'connected', ifname: i.name })
    }
    // redistribute static|connected: tohum metrik yoksa (metric / default-metric) aktarılmaz
    const table = e.redistribute.static || e.redistribute.connected ? routeTable(d, dev) : []
    const own = new Set(s.ifs.map((i) => i.name))
    for (const src of ['static', 'connected'] as const) {
      const rd = e.redistribute[src]
      const seed: EigrpSeedMetric | null = rd?.metric ?? e.defaultMetric
      if (!rd || !seed) continue
      for (const r of table) {
        if (src === 'static' ? r.code !== 'S' : r.code !== 'C' || own.has(r.ifname)) continue
        const k = pkey(r.net, r.prefix)
        if (!m.has(k)) m.set(k, { net: r.net, prefix: r.prefix, bw: seed.bw, delay: seed.delay, hops: 0, external: true, origin: rid, kind: 'redistributed', stubType: src })
      }
    }
    origins.set(dev, m)
  }

  // 4. uzaklık vektörü: eşzamanlı turlar, bölünmüş ufuk; özetler arayüz başına
  type Best = { vec: Vec; metric: number; ifs: Set<string>; local: boolean }
  const metricOf = (dev: string, v: Vec) => compositeMetric(v.bw, v.delay, cfgOf(dev).k)
  const best = new Map<string, Map<string, Best>>()
  for (const dev of devs) {
    const m = new Map<string, Best>()
    for (const [k, o] of origins.get(dev)!) m.set(k, { vec: o, metric: metricOf(dev, o), ifs: new Set(), local: true })
    best.set(dev, m)
  }
  type Adv = Map<string, Vec>
  /** dev'in ifname üzerinden duyurduğu rotalar + o arayüzde etkin özetler (özet → metrik) */
  const advertise = (dev: string, i: EigrpIf): { adv: Adv; summaries: Map<string, Vec> } => {
    const e = cfgOf(dev)
    const adv: Adv = new Map()
    const summaries = new Map<string, Vec>()
    const rid = out[dev]!.rid ?? '0.0.0.0'
    if (e.stub?.receiveOnly) return { adv, summaries }
    const ifSum = (eigrpL3Opts(d.cfgs[dev]!, i.name)?.eigrpSummaries ?? [])
      .filter((x) => x.as === e.as)
      .map((x) => ({ net: x.net, prefix: maskToPrefix(x.mask) ?? 32 }))
    const ifMajor = majorOf(networkOf(i.ip, i.prefix))
    const addSum = (k: string, v: Vec) => {
      const prev = summaries.get(k)
      if (!prev || metricOf(dev, v) < metricOf(dev, prev)) summaries.set(k, { ...v, external: false, origin: rid })
    }
    for (const [k, b] of best.get(dev)!) {
      const [net, p] = k.split('/') as [string, string]
      const prefix = Number(p)
      // stub: yalnız izin verilen yerel türler; öğrenilen rotalar duyurulmaz
      if (e.stub) {
        if (!b.local) continue
        const o = origins.get(dev)!.get(k)!
        if (o.stubType === 'connected' ? !e.stub.connected : !e.stub.static) continue
      }
      // bölünmüş ufuk
      if (!b.local && b.ifs.has(i.name)) continue
      const s = ifSum.find((x) => within(net, prefix, x.net, x.prefix))
      if (s) {
        if (s.prefix !== prefix) {
          addSum(pkey(s.net, s.prefix), b.vec)
          continue
        }
      }
      if (e.autoSummary && !b.vec.external && prefix > classfulPrefix(net)) {
        const mj = majorOf(net)
        if (mj.net !== ifMajor.net) {
          addSum(pkey(mj.net, mj.prefix), b.vec)
          continue
        }
      }
      adv.set(k, b.vec)
    }
    // stub: özetler yalnız `summary` ile duyurulur (yine de yerelde kurulur)
    if (!e.stub || e.stub.summary) for (const [k, v] of summaries) adv.set(k, v)
    return { adv, summaries }
  }

  const advs = new Map<string, Adv>()
  const recv = (dev: string): Map<string, { b: Talker; a: Talker; vec: Vec; rd: number }[]> => {
    const m = new Map<string, { b: Talker; a: Talker; vec: Vec; rd: number }[]>()
    for (const { a, b } of adj) {
      if (a.dev !== dev) continue
      const adv = advs.get(`${b.dev}|${b.i.name}`)
      if (!adv) continue
      for (const [k, v] of adv) {
        const vec: Vec = { bw: Math.min(v.bw, a.i.bw), delay: v.delay + a.i.delay, hops: v.hops + 1, external: v.external, origin: v.origin }
        const list = m.get(k) ?? []
        list.push({ a, b, vec, rd: metricOf(b.dev, v) })
        m.set(k, list)
      }
    }
    return m
  }
  const sig = () => JSON.stringify([...best].map(([dev, m]) => [dev, [...m].map(([k, b]) => [k, b.metric, b.vec.external, [...b.ifs].sort()])]))
  let prev = ''
  for (let round = 0; round < 128; round++) {
    advs.clear()
    for (const dev of devs) for (const i of out[dev]!.ifs) advs.set(`${dev}|${i.name}`, advertise(dev, i).adv)
    for (const dev of devs) {
      const m = new Map<string, Best>()
      for (const [k, o] of origins.get(dev)!) m.set(k, { vec: o, metric: metricOf(dev, o), ifs: new Set(), local: true })
      for (const [k, list] of recv(dev)) {
        if (m.has(k)) continue
        const pool = list.some((x) => !x.vec.external) ? list.filter((x) => !x.vec.external) : list
        const min = Math.min(...pool.map((x) => metricOf(dev, x.vec)))
        const win = pool.filter((x) => metricOf(dev, x.vec) === min)
        m.set(k, { vec: win[0]!.vec, metric: min, ifs: new Set(win.map((x) => x.a.i.name)), local: false })
      }
      best.set(dev, m)
    }
    const now = sig()
    if (now === prev) break
    prev = now
  }

  // 5. topoloji tablosu ve rotalar
  for (const dev of devs) {
    const e = cfgOf(dev)
    const s = out[dev]!
    const got = recv(dev)
    const entries = new Map<string, EigrpTopoEntry>()
    const pathOf = (x: { a: Talker; b: Talker; vec: Vec; rd: number }): EigrpPath => ({
      nh: x.b.i.ip,
      ifname: x.a.i.name,
      peerDev: x.b.dev,
      metric: metricOf(dev, x.vec),
      rd: x.rd,
      bw: x.vec.bw,
      delay: x.vec.delay,
      hops: x.vec.hops,
      external: x.vec.external,
      origin: x.vec.origin,
    })
    const byMetric = (p: EigrpPath, q: EigrpPath) => p.metric - q.metric || ipInt(p.nh) - ipInt(q.nh)
    for (const [k, b] of best.get(dev)!) {
      const [net, p] = k.split('/') as [string, string]
      const all = (got.get(k) ?? []).map(pathOf).sort(byMetric)
      const pool = all.some((x) => !x.external) ? all.filter((x) => !x.external) : all
      if (b.local) {
        const o = origins.get(dev)!.get(k)!
        entries.set(k, { net, prefix: Number(p), external: o.external, fd: b.metric, successors: [], feasibleSuccessors: [], all, local: { kind: o.kind, ...(o.ifname ? { ifname: o.ifname } : {}), bw: o.bw, delay: o.delay } })
        continue
      }
      const successors = pool.filter((x) => x.metric === b.metric).slice(0, e.maxPaths)
      const fs = pool.filter((x) => !successors.includes(x) && x.rd < b.metric)
      entries.set(k, { net, prefix: Number(p), external: b.vec.external, fd: b.metric, successors, feasibleSuccessors: fs, all })
      const extra = e.variance > 1 ? fs.filter((x) => x.metric < e.variance * b.metric) : []
      const paths = [...successors, ...extra].slice(0, e.maxPaths).map((x) => ({ nh: x.nh, ifname: x.ifname, metric: x.metric }))
      s.routes.push({ code: b.vec.external ? 'D EX' : 'D', net, prefix: Number(p), metric: b.metric, ad: b.vec.external ? EIGRP_EX_AD : EIGRP_AD, paths })
    }
    // etkin özetler (herhangi bir EIGRP arayüzünde): yerelde Null0, AD 5
    const sums = new Map<string, Vec>()
    for (const i of s.ifs)
      for (const [k, v] of advertise(dev, i).summaries) {
        const pv = sums.get(k)
        if (!pv || metricOf(dev, v) < metricOf(dev, pv)) sums.set(k, v)
      }
    for (const [k, v] of sums) {
      const [net, p] = k.split('/') as [string, string]
      const metric = metricOf(dev, v)
      const learned = entries.get(k)
      entries.set(k, { net, prefix: Number(p), external: false, fd: metric, successors: [], feasibleSuccessors: [], all: learned?.all ?? [], local: { kind: 'summary', bw: v.bw, delay: v.delay } })
      s.routes = s.routes.filter((r) => pkey(r.net, r.prefix) !== k)
      s.routes.push({ code: 'D', net, prefix: Number(p), metric, ad: EIGRP_SUMMARY_AD, paths: [] })
    }
    s.topo = [...entries.values()].sort((x, y) => ipInt(x.net) - ipInt(y.net) || x.prefix - y.prefix)
    s.routes.sort((x, y) => ipInt(x.net) - ipInt(y.net) || x.prefix - y.prefix)
  }
  return out
}


// ---------------- show ----------------

/** Günlük/çıktı başlığı: ISR (IOS 15) `EIGRP-IPv4 <AS>`, Catalyst (12.2) `IP-EIGRP(0) <AS>`. */
export function eigrpTag(d: Derived, dev: string, as: number): string {
  return (d.topo.devices[dev] as SwitchDef).router ? `EIGRP-IPv4 ${as}` : `IP-EIGRP(0) ${as}`
}

const kLine = (k: EigrpConfig['k']) => `K1=${k[0]}, K2=${k[1]}, K3=${k[2]}, K4=${k[3]}, K5=${k[4]}`
const isRouterDev = (d: Derived, dev: string) => !!(d.topo.devices[dev] as SwitchDef).router

export function showEigrpNeighbors(d: Derived, dev: string, detail: boolean): string[] {
  const s = d.eigrp[dev]
  if (!s) return []
  const o = [isRouterDev(d, dev) ? `EIGRP-IPv4 Neighbors for AS(${s.as})` : `IP-EIGRP neighbors for process ${s.as}`]
  o.push('H   Address                 Interface              Hold Uptime   SRTT   RTO  Q  Seq', '                                                   (sec)         (ms)       Cnt Num')
  s.nbrs
    .filter((n) => n.ok)
    .forEach((n, h) => {
      o.push(pad(h, 4) + pad(n.ip, 24) + pad(shortIf(n.ifname), 23) + padL(Math.max(1, n.hold - 2), 4) + ' 00:12:34    1   100  0  ' + (h + 3))
      if (!detail) return
      const peer = d.cfgs[n.peerDev]?.eigrp
      const pfx = d.eigrp[n.peerDev] ? s.topo.filter((t) => t.successors.some((x) => x.peerDev === n.peerDev) || t.all.some((x) => x.peerDev === n.peerDev)).length : 0
      o.push('   Version 11.0/2.0, Retrans: 0, Retries: 0, Prefixes: ' + pfx)
      if (peer?.stub) {
        const st = peer.stub
        const kinds = st.receiveOnly ? 'RECEIVE-ONLY' : [st.connected ? 'CONNECTED' : '', st.static ? 'STATIC' : '', st.summary ? 'SUMMARY' : ''].filter(Boolean).join(' ')
        o.push(`   Stub Peer Advertising (${kinds} ) Routes`, '   Suppressing queries')
      }
    })
  return o
}

export function showEigrpInterfaces(d: Derived, dev: string, detail: boolean): string[] {
  const s = d.eigrp[dev]
  if (!s) return []
  const o = [
    isRouterDev(d, dev) ? `EIGRP-IPv4 Interfaces for AS(${s.as})` : `IP-EIGRP interfaces for process ${s.as}`,
    '',
    '                              Xmit Queue   PeerQ        Mean   Pacing Time   Multicast    Pending',
    'Interface              Peers  Un/Reliable  Un/Reliable  SRTT   Un/Reliable   Flow Timer   Routes',
  ]
  for (const i of s.ifs) {
    if (i.passive) continue
    const peers = s.nbrs.filter((n) => n.ok && n.ifname === i.name).length
    o.push(pad(shortIf(i.name), 23) + padL(peers, 5) + '        0/0       0/0           1       0/0           50           0')
    if (detail) {
      o.push(`  Hello-interval is ${i.hello}, Hold-time is ${i.hold}`, '  Split-horizon is enabled', '  Next xmit serial <none>')
      o.push(i.md5 ? `  Authentication mode is md5,  key-chain is "${i.keyChain ?? ''}"` : '  Authentication mode is not set')
    }
  }
  return o
}

const sumHead = (d: Derived, dev: string, s: EigrpState) =>
  isRouterDev(d, dev) ? `EIGRP-IPv4 Topology Table for AS(${s.as})/ID(${s.rid ?? '0.0.0.0'})` : `IP-EIGRP Topology Table for AS(${s.as})/ID(${s.rid ?? '0.0.0.0'})`

export function showEigrpTopology(d: Derived, dev: string, allLinks: boolean): string[] {
  const s = d.eigrp[dev]
  if (!s) return []
  const o = [sumHead(d, dev, s), '', 'Codes: P - Passive, A - Active, U - Update, Q - Query, R - Reply,', '       r - reply Status, s - sia Status ', '']
  for (const t of s.topo) {
    const n = t.local ? 1 : t.successors.length
    o.push(`P ${t.net}/${t.prefix}, ${n} successors, FD is ${t.fd}`)
    if (t.local?.kind === 'connected') o.push(`        via Connected, ${t.local.ifname}`)
    else if (t.local?.kind === 'redistributed') o.push(`        via Rstatic (${t.fd}/0)`)
    else if (t.local?.kind === 'summary') o.push(`        via Summary (${t.fd}/0), Null0`)
    const shown = allLinks ? t.all : [...t.successors, ...t.feasibleSuccessors]
    for (const p of shown) o.push(`        via ${p.nh} (${p.metric}/${p.rd}), ${p.ifname}`)
  }
  return o
}

export function showEigrpTopologyEntry(d: Derived, dev: string, net: string, mask: string): string[] {
  const s = d.eigrp[dev]
  if (!s) return []
  const prefix = maskToPrefix(mask) ?? 32
  const t = s.topo.find((x) => x.net === net && x.prefix === prefix)
  if (!t) return ['% Route not in topology table']
  const o = [
    `${isRouterDev(d, dev) ? 'EIGRP-IPv4' : 'IP-EIGRP'} Topology Entry for AS(${s.as})/ID(${s.rid ?? '0.0.0.0'}) for ${t.net}/${t.prefix}`,
    `  State is Passive, Query origin flag is 1, ${t.local ? 1 : t.successors.length} Successor(s), FD is ${t.fd}`,
    '  Descriptor Blocks:',
  ]
  const vec = (bw: number, delay: number, hops: number, ext: boolean, origin: string, rd: number, metric: number) => [
    `      Composite metric is (${metric}/${rd}), route is ${ext ? 'External' : 'Internal'}`,
    '      Vector metric:',
    `        Minimum bandwidth is ${bw} Kbit`,
    `        Total delay is ${delay * 10} microseconds`,
    '        Reliability is 255/255',
    '        Load is 1/255',
    '        Minimum MTU is 1500',
    `        Hop count is ${hops}`,
    `        Originating router is ${origin}`,
  ]
  if (t.local) {
    o.push(`  ${t.local.kind === 'summary' ? '0.0.0.0 (Null0)' : t.local.kind === 'connected' ? `0.0.0.0 (${t.local.ifname})` : '0.0.0.0'}, from ${t.local.kind === 'summary' ? '0.0.0.0' : 'Connected'}, Send flag is 0x0`)
    o.push(...vec(t.local.bw, t.local.delay, 0, t.external, s.rid ?? '0.0.0.0', 0, t.fd))
  }
  for (const p of [...t.successors, ...t.feasibleSuccessors]) {
    o.push(`  ${p.nh} (${p.ifname}), from ${p.nh}, Send flag is 0x0`)
    o.push(...vec(p.bw, p.delay, p.hops, p.external, p.origin, p.rd, p.metric))
  }
  return o
}

/** `show ip protocols` EIGRP bölümü. */
export function eigrpProtocolLines(d: Derived, dev: string): string[] {
  const s = d.eigrp[dev]
  const e = d.cfgs[dev]?.eigrp
  if (!s || !e) return []
  const o = [
    `Routing Protocol is "eigrp ${e.as}"`,
    '  Outgoing update filter list for all interfaces is not set',
    '  Incoming update filter list for all interfaces is not set',
    '  Default networks flagged in outgoing updates',
    '  Default networks accepted from incoming updates',
  ]
  if (e.redistribute.static || e.redistribute.connected)
    o.push(`  Redistributing: ${['connected', 'static'].filter((x) => e.redistribute[x as 'static' | 'connected']).join(', ')}`)
  o.push(`  ${isRouterDev(d, dev) ? 'EIGRP-IPv4' : 'IP-EIGRP'} Protocol for AS(${e.as})`)
  o.push(`    EIGRP metric weight ${kLine(e.k)}`)
  o.push(`    Router-ID: ${s.rid ?? '0.0.0.0'}`)
  if (e.stub) {
    const st = e.stub
    o.push(`    Stub, ${st.receiveOnly ? 'receive-only' : [st.connected ? 'connected' : '', st.static ? 'static' : '', st.summary ? 'summary' : ''].filter(Boolean).join(', ')}`)
  }
  o.push('    Topology : 0 (base) ')
  o.push('      Active Timer: 3 min')
  o.push(`      Distance: internal ${EIGRP_AD} external ${EIGRP_EX_AD}`)
  o.push(`      Maximum path: ${e.maxPaths}`)
  o.push('      Maximum hopcount 100')
  o.push(`      Maximum metric variance ${e.variance}`)
  o.push('')
  o.push(`  Automatic network summarization is ${e.autoSummary ? '' : 'not '}in effect`)
  if (e.autoSummary)
    for (const r of s.routes.filter((x) => !x.paths.length && classfulPrefix(x.net) === x.prefix)) o.push(`    ${r.net}/${r.prefix} for ${s.ifs.filter((i) => majorOf(networkOf(i.ip, i.prefix)).net !== r.net).map((i) => shortIf(i.name)).join(', ')}`)
  o.push('  Routing for Networks:')
  for (const n of e.networks) o.push(`    ${n.addr}${n.wildcard !== null ? '/' + (32 - popcount(ipInt(n.wildcard))) : ''}`)
  const passive = s.ifs.filter((i) => i.passive).map((i) => i.name)
  if (passive.length) {
    o.push('  Passive Interface(s):')
    for (const p of passive) o.push(`    ${p}`)
  }
  o.push('  Routing Information Sources:', '    Gateway         Distance      Last Update')
  for (const ip of [...new Set(s.nbrs.filter((n) => n.ok).map((n) => n.ip))].sort((a, b) => ipInt(a) - ipInt(b))) o.push(`    ${pad(ip, 16)}${padL(EIGRP_AD, 8)}      00:12:34`)
  o.push(`  Distance: internal ${EIGRP_AD} external ${EIGRP_EX_AD}`, '')
  return o
}

function popcount(n: number): number {
  let c = 0
  for (let x = n >>> 0; x; x >>>= 1) c += x & 1
  return c
}

/** running-config `router eigrp` bloğu (IOS sırası). */
export function eigrpConfigLines(c: SwitchConfig): string[] {
  const e = c.eigrp
  if (!e) return []
  const m = (x: EigrpSeedMetric) => `${x.bw} ${x.delay} ${x.rel} ${x.load} ${x.mtu}`
  const o = ['router eigrp ' + e.as]
  if (e.k.join() !== DEFAULT_K.join()) o.push(` metric weights 0 ${e.k.join(' ')}`)
  if (e.variance !== 1) o.push(' variance ' + e.variance)
  for (const src of ['connected', 'static'] as const) {
    const r = e.redistribute[src]
    if (r) o.push(` redistribute ${src}${r.metric ? ' metric ' + m(r.metric) : ''}`)
  }
  if (e.passiveDefault) o.push(' passive-interface default')
  for (const p of e.passive) o.push(`${e.passiveDefault ? ' no' : ''} passive-interface ${p}`)
  for (const n of e.networks) o.push(` network ${n.addr}${n.wildcard !== null ? ' ' + n.wildcard : ''}`)
  if (e.defaultMetric) o.push(' default-metric ' + m(e.defaultMetric))
  if (e.maxPaths !== 4) o.push(' maximum-paths ' + e.maxPaths)
  o.push(e.autoSummary ? ' auto-summary' : ' no auto-summary')
  if (e.routerId) o.push(' eigrp router-id ' + e.routerId)
  if (e.stub) {
    const st = e.stub
    o.push(' eigrp stub' + (st.receiveOnly ? ' receive-only' : [st.connected ? ' connected' : '', st.summary ? ' summary' : '', st.static ? ' static' : ''].join('')))
  }
  o.push('!')
  return o
}

/** `key chain` blokları (global, arayüzlerden önce). */
export function keyChainLines(c: SwitchConfig): string[] {
  const o: string[] = []
  for (const name of Object.keys(c.keyChains ?? {}).sort()) {
    o.push('key chain ' + name)
    const ch = c.keyChains![name]!
    for (const id of Object.keys(ch).sort((a, b) => Number(a) - Number(b))) {
      o.push(' key ' + id)
      if (ch[id] !== null) o.push('  key-string ' + ch[id])
    }
    o.push('!')
  }
  return o
}

/** Arayüz EIGRP satırları (ip address satırından sonra). */
export function eigrpIfLines(l: L3Opts | undefined): string[] {
  const o: string[] = []
  if (!l) return o
  if (l.eigrpAuthMd5) o.push(` ip authentication mode eigrp ${l.eigrpAuthMd5.as} md5`)
  if (l.eigrpKeyChain) o.push(` ip authentication key-chain eigrp ${l.eigrpKeyChain.as} ${l.eigrpKeyChain.name}`)
  if (l.eigrpHello) o.push(` ip hello-interval eigrp ${l.eigrpHello.as} ${l.eigrpHello.sec}`)
  if (l.eigrpHold) o.push(` ip hold-time eigrp ${l.eigrpHold.as} ${l.eigrpHold.sec}`)
  for (const s of l.eigrpSummaries ?? []) o.push(` ip summary-address eigrp ${s.as} ${s.net} ${s.mask}`)
  return o
}

