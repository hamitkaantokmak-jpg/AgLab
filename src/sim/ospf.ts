// OSPFv2 model: neighbours, DR/BDR, SPF per area, inter-area summaries, stub areas, external default.
// Computed from config + derived L2/L3 state; nothing is scripted per lab.

import { derive, type Derived } from './engine'
import { duplicateIps, ifBandwidth, l2Domain, l3Ifs, routeTable, type L3If, type RouteCode } from './net'
import type { Topo } from './topology'
import type { Hardware, L3Opts, OspfConfig, PcConfig, SwitchConfig, SwitchDef } from './types'
import { ipToInt, maskToPrefix, networkOf, sameSubnet } from './util'

export type OspfNetType = 'broadcast' | 'point-to-point' | 'loopback'
export type IfRole = 'DR' | 'BDR' | 'DROTHER' | 'P2P' | 'LOOP' | 'DOWN'

export interface OspfIf {
  dev: string
  name: string
  ip: string
  prefix: number
  area: number
  cost: number
  hello: number
  dead: number
  prio: number
  net: OspfNetType
  passive: boolean
  mtu: number
  up: boolean
  role: IfRole
  dr: { rid: string; ip: string } | null
  bdr: { rid: string; ip: string } | null
  l3: L3If | null
}

export type NbrState = 'FULL' | '2WAY' | 'EXSTART'

export interface OspfNbr {
  rid: string
  prio: number
  state: NbrState
  /** neighbour's role as seen on this segment */
  role: 'DR' | 'BDR' | 'DROTHER' | '-'
  ip: string
  ifname: string
  peerDev: string
  peerIf: string
  /** adjacency usable for SPF (FULL and same network type) */
  spf: boolean
}

export type MismatchKind = 'area' | 'hello' | 'dead' | 'subnet' | 'stub' | 'rid'

export interface OspfMismatch {
  dev: string
  ifname: string
  peerIp: string
  peerDev: string
  kind: MismatchKind
}

export interface OspfPath {
  nh: string
  ifname: string
}

export interface OspfRoute {
  code: Exclude<RouteCode, 'C' | 'S' | 'L'>
  net: string
  prefix: number
  metric: number
  paths: OspfPath[]
}

export interface OspfState {
  pid: number
  /** null: process configured but has no router ID (cannot start) */
  rid: string | null
  ifs: OspfIf[]
  nbrs: OspfNbr[]
  routes: OspfRoute[]
  areas: number[]
  abr: boolean
  asbr: boolean
  mismatches: OspfMismatch[]
}

/** Full derivation: L2/L3 state plus OSPF. */
export function computeState(
  topo: Topo,
  cfgs: Record<string, SwitchConfig>,
  pcs: Record<string, PcConfig>,
  errdis?: Set<string>,
  hw?: Hardware,
): Derived {
  const d = derive(topo, cfgs, pcs, errdis, hw)
  d.ospf = computeOspf(d)
  d.dups = duplicateIps(d)
  return d
}

const ridInt = (r: string) => ipToInt(r) ?? 0

/** Router ID IOS would pick now: highest up loopback, else highest up interface address. */
export function candidateRid(d: Derived, dev: string): string | null {
  const c = d.cfgs[dev]!.ospf
  if (c?.routerId) return c.routerId
  const ifs = l3Ifs(d, dev)
  const pick = (list: L3If[]) => (list.length ? list.map((i) => i.ip).sort((a, b) => ridInt(b) - ridInt(a))[0]! : null)
  return pick(ifs.filter((i) => i.kind === 'loop')) ?? pick(ifs)
}

export function ospfRunning(d: Derived, dev: string): boolean {
  const def = d.topo.devices[dev]
  const c = d.cfgs[dev]
  return def?.kind === 'switch' && !!(def.l3 || def.router) && !!c?.ipRouting && !!c.ospf && !d.hw.off.has(dev)
}

interface IfCfgRef {
  name: string
  ip: { addr: string; mask: string }
  l3: L3Opts
}

function configuredL3(cfg: SwitchConfig, sw: SwitchDef): IfCfgRef[] {
  const out: IfCfgRef[] = []
  for (const [v, s] of Object.entries(cfg.svis)) if (s.ip) out.push({ name: 'Vlan' + v, ip: s.ip, l3: s.l3 ?? {} })
  for (const p of sw.ports) {
    const c = cfg.ifaces[p]!
    if (c.routed && c.ip) out.push({ name: p, ip: c.ip, l3: c.l3 ?? {} })
  }
  for (const [n, l] of Object.entries(cfg.loopbacks ?? {})) if (l.ip) out.push({ name: 'Loopback' + n, ip: l.ip, l3: l.l3 ?? {} })
  return out
}

/** Area an interface lands in: `ip ospf N area A` first, then the most specific network statement. */
export function areaFor(o: OspfConfig, ip: string, l3: L3Opts): number | null {
  if (l3.ospfArea && l3.ospfArea.pid === o.pid) return l3.ospfArea.area
  const a = ipToInt(ip)!
  let best: { bits: number; area: number } | null = null
  for (const n of o.networks) {
    const wc = ipToInt(n.wildcard)!
    const care = ~wc >>> 0
    if (((a & care) >>> 0) !== ((ipToInt(n.addr)! & care) >>> 0)) continue
    const bits = popcount(wc)
    if (!best || bits < best.bits) best = { bits, area: n.area }
  }
  return best?.area ?? null
}

function popcount(n: number): number {
  let c = 0
  for (let x = n >>> 0; x; x >>>= 1) c += x & 1
  return c
}

function isPassive(o: OspfConfig, name: string): boolean {
  return o.passiveDefault ? !o.passive.includes(name) : o.passive.includes(name)
}

const isStub = (o: OspfConfig, area: number) => !!o.stubs[String(area)]

function computeOspf(d: Derived): Record<string, OspfState> {
  const out: Record<string, OspfState> = {}
  const devs = d.topo.switches.filter((s) => ospfRunning(d, s.id))

  // 1. interfaces
  for (const sw of devs) {
    const cfg = d.cfgs[sw.id]!
    const o = cfg.ospf!
    const rid = o.activeRid ?? null
    const up = new Map(l3Ifs(d, sw.id).map((i) => [i.name, i]))
    const ifs: OspfIf[] = []
    for (const c of configuredL3(cfg, sw)) {
      const area = areaFor(o, c.ip.addr, c.l3)
      if (area === null) continue
      const isLoop = c.name.startsWith('Loopback')
      const net: OspfNetType = c.l3.ospfNet ?? (isLoop ? 'loopback' : 'broadcast')
      const hello = c.l3.ospfHello ?? 10
      const bw = ifBandwidth(c.name, c.l3.bandwidth)
      const l3 = up.get(c.name) ?? null
      ifs.push({
        dev: sw.id,
        name: c.name,
        ip: c.ip.addr,
        prefix: maskToPrefix(c.ip.mask)!,
        area,
        cost: c.l3.ospfCost ?? Math.max(1, Math.floor((o.refBw * 1000) / bw)),
        hello,
        dead: c.l3.ospfDead ?? hello * 4,
        prio: c.l3.ospfPrio ?? 1,
        net: isLoop && net === 'broadcast' ? 'loopback' : net,
        passive: isPassive(o, c.name),
        mtu: c.l3.mtu ?? 1500,
        up: !!l3 && !!rid,
        role: 'DOWN',
        dr: null,
        bdr: null,
        l3,
      })
    }
    const areas = [...new Set(ifs.filter((i) => i.up).map((i) => i.area))].sort((a, b) => a - b)
    out[sw.id] = { pid: o.pid, rid, ifs, nbrs: [], routes: [], areas, abr: areas.includes(0) && areas.length > 1, asbr: false, mismatches: [] }
  }

  // 2. hello exchange on each segment
  const talkers = Object.values(out).flatMap((s) => s.ifs.filter((i) => i.up && !i.passive && i.net !== 'loopback' && i.l3?.node))
  const domCache = new Map<string, Set<string>>()
  const domOf = (i: OspfIf) => {
    const key = `${i.dev}|${i.name}`
    let s = domCache.get(key)
    if (!s) {
      s = new Set([...l2Domain(d, i.l3!.node!).nodes.keys()])
      domCache.set(key, s)
    }
    return s
  }
  const nk = (i: OspfIf) => `${i.l3!.node!.dev}|${i.l3!.node!.vlan}`
  const peersOf = new Map<OspfIf, OspfIf[]>()
  const compat = new Map<OspfIf, OspfIf[]>()
  for (const a of talkers) {
    const dom = domOf(a)
    const peers = talkers.filter((b) => b.dev !== a.dev && dom.has(nk(b)))
    peersOf.set(a, peers)
    const ok: OspfIf[] = []
    for (const b of peers) {
      const kind = mismatch(d, out, a, b)
      if (kind) out[a.dev]!.mismatches.push({ dev: a.dev, ifname: a.name, peerIp: b.ip, peerDev: b.dev, kind })
      else ok.push(b)
    }
    compat.set(a, ok)
  }

  // 3. DR/BDR election (each router's own view; non-preemption not modelled)
  for (const a of talkers) {
    if (a.net === 'point-to-point') {
      a.role = 'P2P'
      continue
    }
    const cands = [a, ...compat.get(a)!].filter((x) => x.net === 'broadcast' && x.prio > 0)
    cands.sort((x, y) => y.prio - x.prio || ridInt(out[y.dev]!.rid!) - ridInt(out[x.dev]!.rid!))
    const dr = cands[0]
    const bdr = cands[1]
    a.dr = dr ? { rid: out[dr.dev]!.rid!, ip: dr.ip } : null
    a.bdr = bdr ? { rid: out[bdr.dev]!.rid!, ip: bdr.ip } : null
    a.role = dr === a ? 'DR' : bdr === a ? 'BDR' : 'DROTHER'
  }
  for (const s of Object.values(out)) {
    for (const i of s.ifs) {
      if (!i.up) i.role = 'DOWN'
      else if (i.net === 'loopback') i.role = 'LOOP'
      else if (i.role === 'DOWN') i.role = i.net === 'point-to-point' ? 'P2P' : 'DR' // passive / alone
    }
  }

  // 4. neighbour states
  for (const a of talkers) {
    for (const b of compat.get(a)!) {
      const bothP2p = a.net === 'point-to-point' && b.net === 'point-to-point'
      const sameType = a.net === b.net
      let state: NbrState
      let role: OspfNbr['role'] = '-'
      if (bothP2p || !sameType) state = 'FULL'
      else {
        role = a.dr?.ip === b.ip ? 'DR' : a.bdr?.ip === b.ip ? 'BDR' : 'DROTHER'
        const adj = a.role === 'DR' || a.role === 'BDR' || role === 'DR' || role === 'BDR'
        state = adj ? 'FULL' : '2WAY'
      }
      if (state === 'FULL' && a.mtu !== b.mtu) state = 'EXSTART'
      out[a.dev]!.nbrs.push({
        rid: out[b.dev]!.rid!,
        prio: b.prio,
        state,
        role,
        ip: b.ip,
        ifname: a.name,
        peerDev: b.dev,
        peerIf: b.name,
        spf: state === 'FULL' && sameType,
      })
    }
  }

  // 5. per-area SPF
  type Reach = { cost: number; paths: OspfPath[] }
  const ifsIn = (dev: string, area: number) => out[dev]!.ifs.filter((i) => i.up && i.area === area)
  const devsIn = (area: number) => Object.keys(out).filter((dev) => out[dev]!.areas.includes(area))
  const allAreas = [...new Set(Object.values(out).flatMap((s) => s.areas))]

  /** router -> router edges inside an area (transit segments collapse to cost-in, zero-out) */
  const edges = new Map<string, { to: string; cost: number; path: OspfPath }[]>()
  const ekey = (dev: string, area: number) => `${dev}#${area}`
  for (const area of allAreas) {
    for (const dev of devsIn(area)) {
      const list: { to: string; cost: number; path: OspfPath }[] = []
      for (const a of ifsIn(dev, area)) {
        if (!talkers.includes(a)) continue
        const full = out[dev]!.nbrs.filter((n) => n.ifname === a.name && n.spf)
        if (a.net === 'point-to-point') {
          for (const n of full) list.push({ to: n.peerDev, cost: a.cost, path: { nh: n.ip, ifname: a.name } })
          continue
        }
        // broadcast: attached = routers fully adjacent with the DR (as this router sees it)
        if (!a.dr) continue
        const amAttached = a.role === 'DR' ? full.length > 0 : full.some((n) => n.ip === a.dr!.ip)
        if (!amAttached) continue
        for (const b of peersOf.get(a)!) {
          if (b.area !== area || !compat.get(a)!.includes(b) || b.net !== 'broadcast') continue
          const bFull = out[b.dev]!.nbrs.filter((n) => n.ifname === b.name && n.spf)
          const bAttached = b.role === 'DR' ? bFull.length > 0 : bFull.some((n) => n.ip === a.dr!.ip)
          if (bAttached) list.push({ to: b.dev, cost: a.cost, path: { nh: b.ip, ifname: a.name } })
        }
      }
      edges.set(ekey(dev, area), list)
    }
  }

  const spf = (root: string, area: number): Map<string, Reach> => {
    const dist = new Map<string, Reach>([[root, { cost: 0, paths: [] }]])
    const done = new Set<string>()
    for (;;) {
      let cur: string | null = null
      for (const [k, v] of dist) if (!done.has(k) && (cur === null || v.cost < dist.get(cur)!.cost)) cur = k
      if (cur === null) break
      done.add(cur)
      const base = dist.get(cur)!
      for (const e of edges.get(ekey(cur, area)) ?? []) {
        if (done.has(e.to)) continue
        const cost = base.cost + e.cost
        const paths = cur === root ? [e.path] : base.paths
        const prev = dist.get(e.to)
        if (!prev || cost < prev.cost) dist.set(e.to, { cost, paths: [...paths] })
        else if (cost === prev.cost) prev.paths = mergePaths(prev.paths, paths)
      }
    }
    return dist
  }

  const pkey = (net: string, prefix: number) => `${net}/${prefix}`
  const asbrKey = (dev: string) => `asbr:${dev}`

  // ASBRs: default-information originate (needs a default route unless `always`)
  const externals = new Map<string, { net: string; prefix: number; metric: number }[]>()
  for (const dev of Object.keys(out)) {
    const o = d.cfgs[dev]!.ospf!
    if (!o.defaultOriginate || !out[dev]!.rid) continue
    const hasDefault = routeTable(d, dev).some((e) => e.prefix === 0 && e.code === 'S')
    if (!o.defaultOriginate.always && !hasDefault) continue
    out[dev]!.asbr = true
    externals.set(dev, [{ net: '0.0.0.0', prefix: 0, metric: 1 }])
  }

  // intra-area: dist[dev][area], intra[dev][area] = prefix -> reach
  const dist: Record<string, Record<number, Map<string, Reach>>> = {}
  const intra: Record<string, Record<number, Map<string, Reach>>> = {}
  for (const dev of Object.keys(out)) {
    dist[dev] = {}
    intra[dev] = {}
    for (const area of out[dev]!.areas) {
      const dm = spf(dev, area)
      dist[dev]![area] = dm
      const pm = new Map<string, Reach>()
      for (const [x, r] of dm) {
        for (const i of ifsIn(x, area)) {
          const host = i.net === 'loopback'
          const net = host ? i.ip : networkOf(i.ip, i.prefix)
          const prefix = host ? 32 : i.prefix
          addReach(pm, pkey(net, prefix), { cost: r.cost + i.cost, paths: r.paths })
        }
        if (out[x]!.asbr) addReach(pm, asbrKey(x), { cost: r.cost, paths: r.paths })
      }
      intra[dev]![area] = pm
    }
  }

  const stubCfg = (dev: string, area: number) => d.cfgs[dev]!.ospf!.stubs[String(area)]

  /** Summary LSAs an ABR originates into an area. */
  const summariesInto = (abr: string, area: number, backboneInter: Map<string, Reach> | null): Map<string, number> => {
    const m = new Map<string, number>()
    const stub = stubCfg(abr, area)
    if (stub) m.set(pkey('0.0.0.0', 0), 1)
    if (stub?.noSummary) return m
    const put = (k: string, c: number) => {
      if (stub && k.startsWith('asbr:')) return // no type-4 into stub areas
      if (k === pkey('0.0.0.0', 0)) return
      if (!m.has(k) || m.get(k)! > c) m.set(k, c)
    }
    for (const y of out[abr]!.areas) {
      if (y === area) continue
      for (const [k, r] of intra[abr]![y]!) put(k, r.cost)
    }
    if (area !== 0 && backboneInter) for (const [k, r] of backboneInter) put(k, r.cost)
    return m
  }

  const abrs = (area: number) => devsIn(area).filter((x) => out[x]!.abr)

  // inter-area learned over the backbone
  const interBB: Record<string, Map<string, Reach>> = {}
  for (const dev of devsIn(0)) {
    const m = new Map<string, Reach>()
    for (const b of abrs(0)) {
      if (b === dev) continue
      const rb = dist[dev]![0]!.get(b)
      if (!rb) continue
      for (const [k, c] of summariesInto(b, 0, null)) addReach(m, k, { cost: rb.cost + c, paths: rb.paths })
    }
    interBB[dev] = m
  }
  // inter-area inside non-backbone areas (ABRs only listen to the backbone)
  const interNB: Record<string, Map<string, Reach>> = {}
  for (const dev of Object.keys(out)) {
    if (out[dev]!.abr) continue
    const m = new Map<string, Reach>()
    for (const area of out[dev]!.areas) {
      if (area === 0) continue
      for (const b of abrs(area)) {
        const rb = dist[dev]![area]!.get(b)
        if (!rb) continue
        for (const [k, c] of summariesInto(b, area, interBB[b] ?? null)) addReach(m, k, { cost: rb.cost + c, paths: rb.paths })
      }
    }
    interNB[dev] = m
  }

  // 6. install
  for (const dev of Object.keys(out)) {
    const s = out[dev]!
    if (!s.rid) continue
    const connected = new Set(l3Ifs(d, dev).map((i) => pkey(networkOf(i.ip, i.prefix), i.prefix)))
    const best = new Map<string, { code: OspfRoute['code']; r: Reach }>()
    for (const area of s.areas) {
      for (const [k, r] of intra[dev]![area]!) {
        if (k.startsWith('asbr:') || !r.paths.length) continue
        upsert(best, k, 'O', r)
      }
    }
    const inter = new Map<string, Reach>()
    for (const [k, r] of interBB[dev] ?? []) addReach(inter, k, r)
    for (const [k, r] of interNB[dev] ?? []) addReach(inter, k, r)
    for (const [k, r] of inter) {
      if (k.startsWith('asbr:') || !r.paths.length) continue
      if (best.get(k)?.code === 'O') continue
      upsert(best, k, 'O IA', r)
    }
    // externals: flooded into non-stub areas only
    const inNonStub = s.areas.some((a) => !stubCfg(dev, a))
    const ext = new Map<string, { metric: number; fwd: number; paths: OspfPath[] }>()
    if (inNonStub) {
      for (const [asbr, list] of externals) {
        if (asbr === dev) continue
        let toAsbr: Reach | undefined
        for (const area of s.areas) {
          if (stubCfg(dev, area)) continue
          const r = intra[dev]![area]!.get(asbrKey(asbr))
          if (r && (!toAsbr || r.cost < toAsbr.cost)) toAsbr = r
        }
        if (!toAsbr) toAsbr = inter.get(asbrKey(asbr))
        if (!toAsbr || !toAsbr.paths.length) continue
        for (const e of list) {
          const k = pkey(e.net, e.prefix)
          const prev = ext.get(k)
          // E2: lowest external metric, then lowest forwarding cost to the ASBR
          if (!prev || e.metric < prev.metric || (e.metric === prev.metric && toAsbr.cost < prev.fwd))
            ext.set(k, { metric: e.metric, fwd: toAsbr.cost, paths: [...toAsbr.paths] })
          else if (e.metric === prev.metric && toAsbr.cost === prev.fwd) prev.paths = mergePaths(prev.paths, toAsbr.paths)
        }
      }
    }
    for (const [k, e] of ext) if (!best.has(k)) best.set(k, { code: 'O E2', r: { cost: e.metric, paths: e.paths } })
    for (const [k, { code, r }] of best) {
      if (connected.has(k)) continue
      const [net, p] = k.split('/')
      s.routes.push({ code, net: net!, prefix: Number(p), metric: r.cost, paths: r.paths })
    }
    s.routes.sort((a, b) => ridInt(a.net) - ridInt(b.net) || a.prefix - b.prefix)
  }
  return out
}

function mismatch(d: Derived, out: Record<string, OspfState>, a: OspfIf, b: OspfIf): MismatchKind | null {
  if (a.prefix !== b.prefix || !sameSubnet(a.ip, b.ip, a.prefix)) return 'subnet'
  if (a.area !== b.area) return 'area'
  if (a.hello !== b.hello) return 'hello'
  if (a.dead !== b.dead) return 'dead'
  if (isStub(d.cfgs[a.dev]!.ospf!, a.area) !== isStub(d.cfgs[b.dev]!.ospf!, b.area)) return 'stub'
  if (out[a.dev]!.rid === out[b.dev]!.rid) return 'rid'
  return null
}

function mergePaths(a: OspfPath[], b: OspfPath[]): OspfPath[] {
  const m = [...a]
  for (const p of b) if (!m.some((x) => x.nh === p.nh && x.ifname === p.ifname)) m.push(p)
  return m.sort((x, y) => ridInt(x.nh) - ridInt(y.nh))
}

function addReach(m: Map<string, { cost: number; paths: OspfPath[] }>, k: string, r: { cost: number; paths: OspfPath[] }) {
  const prev = m.get(k)
  if (!prev || r.cost < prev.cost) m.set(k, { cost: r.cost, paths: [...r.paths] })
  else if (r.cost === prev.cost) prev.paths = mergePaths(prev.paths, r.paths)
}

function upsert(
  best: Map<string, { code: OspfRoute['code']; r: { cost: number; paths: OspfPath[] } }>,
  k: string,
  code: OspfRoute['code'],
  r: { cost: number; paths: OspfPath[] },
) {
  const prev = best.get(k)
  // intra-area always beats inter-area, whatever the cost
  if (prev && prev.code === 'O' && code !== 'O') return
  if (!prev || prev.code !== code || r.cost < prev.r.cost) best.set(k, { code, r: { cost: r.cost, paths: [...r.paths] } })
  else if (r.cost === prev.r.cost) prev.r.paths = mergePaths(prev.r.paths, r.paths)
}
