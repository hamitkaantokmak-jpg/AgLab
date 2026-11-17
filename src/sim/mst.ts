// MST (IEEE 802.1s), Catalyst IOS 15 davranışı.
//
// Bölge: ad + revizyon + VLAN→örnek eşlemesi (özet: HMAC-MD5, 802.1s 13.7). Doğrudan bağlı ve
// aynı bölge yapılandırmasındaki MST switch'leri bir bölgedir. Eşlenmemiş VLAN'lar örnek 0'dadır
// (IST/CIST).
//
// Hesap (zamanlayıcı yok; Rapid PVST+ gibi anlık yakınsama):
// - MST kipinde en az bir switch içeren her L2 bileşeni burada hesaplanır; içindeki PVST+/Rapid
//   PVST+ switch'leri tek köprülük "bölge" sayılır. Diğer bileşenler engine.ts'te VLAN başına.
// - CIST: öncelik vektörü {kök, dış maliyet, bölge kökü, iç maliyet, gönderen köprü, gönderen
//   port}. Bölge içi bağlantıda iç maliyet, sınırda dış maliyet artar ve bölge kökü alan köprüye
//   geçer: bölge dışarıya tek köprü gibi görünür, sınırda tek kök portu (Mstr) kalır.
// - MSTI: her bölgede, yalnız bölge içi bağlantılarla, örneğin kendi öncelik/maliyetleriyle ayrı
//   ağaç (bölgesel kök). Sınır portlarında MSTI'ler CIST rolünü izler (CIST kök portu → Mstr).
// - Bir VLAN'ın iletim durumu, eşlendiği örneğin port durumudur (d.stp[vlan] buradan yazılır).
//   PVST+ switch'lerinde bütün VLAN'lar CIST kararını izler (PVST simülasyonunun ayrıntısı —
//   VLAN başına PVST BPDU'larının tutarlılık denetimi — modellenmez).

import type { Derived, LPort, StpBridge, StpPort } from './engine'
import { egress, peerOf, vlanExists } from './engine'
import type { MstConfig, SwitchConfig, SwitchDef } from './types'

export interface MstInstanceState {
  id: number
  /** eşlenen VLAN'lar (örnek 0: başka örneğe eşlenmemiş 1-4094) */
  vlans: number[]
  /** köprü önceliği (sys-id-ext = örnek no dahil) */
  prio: number
  mac: string
  /** örnek kökü: örnek 0'da CIST kökü, MSTI'de bölgesel kök */
  rootPrio: number
  rootMac: string
  rootDev: string | null
  rootPort: string | null
  isRoot: boolean
  /** CIST dış kök yol maliyeti (MSTI'de 0) */
  extCost: number
  /** bölge kökü (CIST'te CIST bölgesel kökü; MSTI'de örnek kökü) ve ona iç maliyet */
  rrPrio: number
  rrMac: string
  rrDev: string | null
  intCost: number
  ports: Record<string, StpPort>
}

export interface MstState {
  region: { name: string; revision: number; digest: string }
  instances: MstInstanceState[]
}

// ---------------- yapılandırma ----------------

export const defaultMst = (): MstConfig => ({ name: '', revision: 0, instances: {}, priority: {} })
export const mstOf = (cfg: SwitchConfig): MstConfig => cfg.mst ?? defaultMst()

/** VLAN'ın eşlendiği örnek (eşlenmemişse 0). */
export function instanceOf(m: MstConfig, v: number): number {
  for (const [i, vs] of Object.entries(m.instances)) if (vs.includes(v)) return Number(i)
  return 0
}

/** Örneğe eşlenen VLAN'lar; örnek 0 için başka örneğe eşlenmemiş 1-4094. */
export function vlansOf(m: MstConfig, inst: number): number[] {
  if (inst !== 0) return [...(m.instances[String(inst)] ?? [])].sort((a, b) => a - b)
  const used = new Set(Object.values(m.instances).flat())
  const out: number[] = []
  for (let v = 1; v <= 4094; v++) if (!used.has(v)) out.push(v)
  return out
}

/** Yapılandırılmış örnekler (0 dahil, artan). */
export const instanceIds = (m: MstConfig): number[] => [0, ...Object.keys(m.instances).map(Number).sort((a, b) => a - b)]

// ---------------- 802.1s bölge özeti (HMAC-MD5) ----------------

function md5(bytes: Uint8Array): Uint8Array {
  const K = new Uint32Array(64)
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21]
  const len = bytes.length
  const total = ((len + 8) >> 6) + 1
  const buf = new Uint8Array(total * 64)
  buf.set(bytes)
  buf[len] = 0x80
  const bits = len * 8
  for (let i = 0; i < 4; i++) buf[total * 64 - 8 + i] = (bits >>> (8 * i)) & 0xff
  buf[total * 64 - 4] = Math.floor(len / 2 ** 29) & 0xff
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476
  const M = new Uint32Array(16)
  for (let blk = 0; blk < total; blk++) {
    for (let i = 0; i < 16; i++) {
      const o = blk * 64 + i * 4
      M[i] = (buf[o]! | (buf[o + 1]! << 8) | (buf[o + 2]! << 16) | (buf[o + 3]! << 24)) >>> 0
    }
    let A = a0, B = b0, C = c0, D = d0
    for (let i = 0; i < 64; i++) {
      let F: number, g: number
      if (i < 16) [F, g] = [(B & C) | (~B & D), i]
      else if (i < 32) [F, g] = [(D & B) | (~D & C), (5 * i + 1) % 16]
      else if (i < 48) [F, g] = [B ^ C ^ D, (3 * i + 5) % 16]
      else [F, g] = [C ^ (B | ~D), (7 * i) % 16]
      F = (F + A + K[i]! + M[g]!) >>> 0
      A = D
      D = C
      C = B
      const s = S[(i >> 4) * 4 + (i % 4)]!
      B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0
    }
    a0 = (a0 + A) >>> 0
    b0 = (b0 + B) >>> 0
    c0 = (c0 + C) >>> 0
    d0 = (d0 + D) >>> 0
  }
  const out = new Uint8Array(16)
  ;[a0, b0, c0, d0].forEach((w, i) => {
    for (let j = 0; j < 4; j++) out[i * 4 + j] = (w >>> (8 * j)) & 0xff
  })
  return out
}

const DIGEST_KEY = [0x13, 0xac, 0x06, 0xa6, 0x2e, 0x47, 0xfd, 0x51, 0xf9, 0x5d, 0x2b, 0xa2, 0x43, 0xcd, 0x03, 0x46]

/** Yapılandırma özeti: VLAN 0-4095 → örnek no tablosunun (2 bayt, büyük uçlu) HMAC-MD5'i. */
export function mstDigest(m: MstConfig): string {
  const table = new Uint8Array(4096 * 2)
  for (const [i, vs] of Object.entries(m.instances))
    for (const v of vs) {
      table[v * 2] = (Number(i) >> 8) & 0xff
      table[v * 2 + 1] = Number(i) & 0xff
    }
  const key = new Uint8Array(64)
  key.set(DIGEST_KEY)
  const ipad = key.map((b) => b ^ 0x36)
  const opad = key.map((b) => b ^ 0x5c)
  const inner = new Uint8Array(64 + table.length)
  inner.set(ipad)
  inner.set(table, 64)
  const ih = md5(inner)
  const outer = new Uint8Array(64 + 16)
  outer.set(opad)
  outer.set(ih, 64)
  return [...md5(outer)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

// ---------------- topoloji ----------------

/** STP'ye katılan port: açık, routed değil, erişim VLAN'ı eksik değil. */
const stpPort = (lp: LPort) => lp.active && !lp.routed && !lp.inactive

interface L2Link {
  lp: LPort
  peer: string
  plp: LPort
}

function l2Links(d: Derived): Record<string, L2Link[]> {
  const out: Record<string, L2Link[]> = {}
  for (const sw of d.topo.switches) {
    if ((sw as SwitchDef).router || d.hw.off.has(sw.id)) continue
    const list: L2Link[] = []
    for (const lp of d.lports[sw.id] ?? []) {
      if (!stpPort(lp)) continue
      const p = peerOf(d, lp)
      if (!p || !stpPort(p) || d.hw.off.has(p.dev) || (d.topo.devices[p.dev] as SwitchDef).router) continue
      list.push({ lp, peer: p.dev, plp: p })
    }
    out[sw.id] = list
  }
  return out
}

/** MST kipinde en az bir switch içeren L2 bileşenlerinin switch'leri (boşsa MST yok). */
export function mstComponents(d: Derived): Set<string> {
  const mstAny = d.topo.switches.some((s) => d.cfgs[s.id]?.stpMode === 'mst' && !(s as SwitchDef).router)
  if (!mstAny) return new Set()
  const links = l2Links(d)
  const out = new Set<string>()
  const seen = new Set<string>()
  for (const start of Object.keys(links)) {
    if (seen.has(start)) continue
    const comp: string[] = []
    const stack = [start]
    seen.add(start)
    while (stack.length) {
      const x = stack.pop()!
      comp.push(x)
      for (const l of links[x] ?? [])
        if (!seen.has(l.peer)) {
          seen.add(l.peer)
          stack.push(l.peer)
        }
    }
    if (comp.some((x) => d.cfgs[x]!.stpMode === 'mst')) for (const x of comp) out.add(x)
  }
  return out
}

/** IEEE 802.1t uzun yol maliyeti (MST varsayılanı). */
export const longCost = (mbps: number) => Math.max(1, Math.min(200000000, Math.round(20000000 / Math.max(1, mbps))))

type Vec = (number | string)[]
const cmpVec = (a: Vec, b: Vec): number => {
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!, y = b[i]!
    const c = typeof x === 'number' ? x - (y as number) : x.localeCompare(y as string)
    if (c) return c
  }
  return 0
}

/**
 * MST bileşenlerini hesaplar: d.mst[dev] (MST switch'leri) ve bu switch'lerin d.stp[vlan]
 * kayıtları (VLAN → örnek port durumu).
 */
export function computeMst(d: Derived, devs: Set<string>, vlans: number[]): void {
  const links = l2Links(d)
  const nodes = [...devs].filter((x) => links[x])
  const isMst = (x: string) => d.cfgs[x]!.stpMode === 'mst'
  const cfgM = (x: string) => mstOf(d.cfgs[x]!)
  const digest: Record<string, string> = {}
  const key: Record<string, string> = {}
  for (const x of nodes) {
    digest[x] = mstDigest(cfgM(x))
    key[x] = isMst(x) ? `${cfgM(x).name}|${cfgM(x).revision}|${digest[x]}` : '#' + x
  }
  // bölgeler: aynı anahtarlı MST switch'lerinin bağlantıyla birleşen kümeleri
  const region: Record<string, string> = {}
  for (const x of nodes) {
    if (region[x]) continue
    region[x] = x
    if (!isMst(x)) continue
    const stack = [x]
    while (stack.length) {
      const y = stack.pop()!
      for (const l of links[y]!)
        if (!region[l.peer] && isMst(l.peer) && key[l.peer] === key[x]) {
          region[l.peer] = x
          stack.push(l.peer)
        }
    }
  }
  const same = (a: string, b: string) => region[a] === region[b]
  const mac = (x: string) => (d.topo.devices[x] as SwitchDef).mac
  const portPrio = (x: string, lp: LPort, inst: number) => (isMst(x) ? (lp.cfg.mstPortPriority?.[String(inst)] ?? 128) : 128)
  const portId = (x: string, lp: LPort, inst: number) => portPrio(x, lp, inst) * 4096 + lp.portNum
  const cost = (x: string, lp: LPort, inst: number) => (isMst(x) ? (lp.cfg.mstCost?.[String(inst)] ?? longCost(lp.speed)) : lp.cost)
  const prioOf = (x: string, inst: number) =>
    isMst(x) ? (cfgM(x).priority[String(inst)] ?? 32768) + inst : (d.cfgs[x]!.stpPriority['1'] ?? 32768) + 1
  const devOf = (p: number, m: string, among: string[]) => among.find((x) => mac(x) === m && prioOf(x, 0) === p) ?? null
  const rounds = nodes.length + 1

  // ---- CIST: [kökPri, kökMAC, dış, bölgeKökPri, bölgeKökMAC, iç, gönderenPri, gönderenMAC, gönderenPort]
  const self = (x: string): Vec => [prioOf(x, 0), mac(x), 0, prioOf(x, 0), mac(x), 0, prioOf(x, 0), mac(x), 0]
  const best: Record<string, { v: Vec; via: string | null }> = {}
  for (const x of nodes) best[x] = { v: self(x), via: null }
  for (let r = 0; r < rounds; r++) {
    let changed = false
    const next: typeof best = {}
    for (const x of nodes) {
      let cur = { v: self(x), via: null as string | null }
      for (const l of links[x]!) {
        const nb = best[l.peer]!.v
        const c = cost(x, l.lp, 0)
        const cand: Vec = same(x, l.peer)
          ? [nb[0]!, nb[1]!, nb[2]!, nb[3]!, nb[4]!, (nb[5] as number) + c, prioOf(l.peer, 0), mac(l.peer), portId(l.peer, l.plp, 0)]
          : [nb[0]!, nb[1]!, (nb[2] as number) + c, prioOf(x, 0), mac(x), 0, prioOf(l.peer, 0), mac(l.peer), portId(l.peer, l.plp, 0)]
        if (cmpVec(cand, cur.v) < 0) cur = { v: cand, via: l.lp.name }
      }
      next[x] = cur
      if (cmpVec(cur.v, best[x]!.v) !== 0 || cur.via !== best[x]!.via) changed = true
    }
    Object.assign(best, next)
    if (!changed) break
  }
  const sent = (x: string, lp: LPort): Vec => [...best[x]!.v.slice(0, 6), prioOf(x, 0), mac(x), portId(x, lp, 0)]
  const boundaryOf = (x: string, l: L2Link): StpPort['boundary'] =>
    same(x, l.peer) ? undefined : isMst(x) ? (isMst(l.peer) ? 'RSTP' : 'PVST') : isMst(l.peer) ? 'Peer' : undefined

  const edgePort = (x: string, lp: LPort, inst: number): StpPort => ({
    role: 'Desg', state: 'FWD', cost: cost(x, lp, inst), portNum: lp.portNum, edge: lp.peerIsPc, prio: portPrio(x, lp, inst),
  })
  const cist: Record<string, MstInstanceState> = {}
  for (const x of nodes) {
    const v = best[x]!.v
    const ports: Record<string, StpPort> = {}
    for (const lp of d.lports[x] ?? []) if (stpPort(lp)) ports[lp.name] = edgePort(x, lp, 0)
    for (const l of links[x]!) {
      const p = ports[l.lp.name]!
      p.edge = false
      const b = boundaryOf(x, l)
      if (b) p.boundary = b
      if (l.lp.name === best[x]!.via) [p.role, p.state] = ['Root', 'FWD']
      else if (cmpVec(sent(x, l.lp), sent(l.peer, l.plp)) < 0) [p.role, p.state] = ['Desg', 'FWD']
      else [p.role, p.state] = ['Altn', 'BLK']
    }
    cist[x] = {
      id: 0, vlans: isMst(x) ? vlansOf(cfgM(x), 0) : [], prio: prioOf(x, 0), mac: mac(x),
      rootPrio: v[0] as number, rootMac: v[1] as string, rootDev: devOf(v[0] as number, v[1] as string, nodes),
      rootPort: best[x]!.via, isRoot: v[1] === mac(x) && v[0] === prioOf(x, 0),
      extCost: v[2] as number, rrPrio: v[3] as number, rrMac: v[4] as string, rrDev: devOf(v[3] as number, v[4] as string, nodes), intCost: v[5] as number,
      ports,
    }
  }

  // ---- MSTI: bölge başına, yalnız bölge içi bağlantılar
  const msti: Record<string, Record<number, MstInstanceState>> = {}
  const regions = new Map<string, string[]>()
  for (const x of nodes) if (isMst(x)) regions.set(region[x]!, [...(regions.get(region[x]!) ?? []), x])
  for (const members of regions.values()) {
    const ids = instanceIds(cfgM(members[0]!)).filter((i) => i !== 0)
    for (const inst of ids) {
      const me = (x: string): Vec => [prioOf(x, inst), mac(x), 0, prioOf(x, inst), mac(x), 0]
      const b: Record<string, { v: Vec; via: string | null }> = {}
      for (const x of members) b[x] = { v: me(x), via: null }
      for (let r = 0; r < members.length + 1; r++) {
        let changed = false
        const next: typeof b = {}
        for (const x of members) {
          let cur = { v: me(x), via: null as string | null }
          for (const l of links[x]!) {
            if (!same(x, l.peer)) continue
            const nb = b[l.peer]!.v
            const cand: Vec = [nb[0]!, nb[1]!, (nb[2] as number) + cost(x, l.lp, inst), prioOf(l.peer, inst), mac(l.peer), portId(l.peer, l.plp, inst)]
            if (cmpVec(cand, cur.v) < 0) cur = { v: cand, via: l.lp.name }
          }
          next[x] = cur
          if (cmpVec(cur.v, b[x]!.v) !== 0 || cur.via !== b[x]!.via) changed = true
        }
        Object.assign(b, next)
        if (!changed) break
      }
      const sentI = (x: string, lp: LPort): Vec => [...b[x]!.v.slice(0, 3), prioOf(x, inst), mac(x), portId(x, lp, inst)]
      for (const x of members) {
        const v = b[x]!.v
        const ports: Record<string, StpPort> = {}
        for (const lp of d.lports[x] ?? []) if (stpPort(lp)) ports[lp.name] = edgePort(x, lp, inst)
        for (const l of links[x]!) {
          const p = ports[l.lp.name]!
          p.edge = false
          if (!same(x, l.peer)) {
            // sınır: MSTI, CIST rolünü izler; bölgenin CIST kök portu Mstr
            const c = cist[x]!.ports[l.lp.name]!
            p.boundary = c.boundary
            if (c.role === 'Root') [p.role, p.state] = ['Mstr', 'FWD']
            else [p.role, p.state] = [c.role, c.state]
            continue
          }
          if (l.lp.name === b[x]!.via) [p.role, p.state] = ['Root', 'FWD']
          else if (cmpVec(sentI(x, l.lp), sentI(l.peer, l.plp)) < 0) [p.role, p.state] = ['Desg', 'FWD']
          else [p.role, p.state] = ['Altn', 'BLK']
        }
        const rootDev = members.find((y) => mac(y) === v[1] && prioOf(y, inst) === v[0]) ?? null
        ;(msti[x] ??= {})[inst] = {
          id: inst, vlans: vlansOf(cfgM(x), inst), prio: prioOf(x, inst), mac: mac(x),
          rootPrio: v[0] as number, rootMac: v[1] as string, rootDev, rootPort: b[x]!.via, isRoot: rootDev === x,
          extCost: 0, rrPrio: v[0] as number, rrMac: v[1] as string, rrDev: rootDev, intCost: v[2] as number,
          ports,
        }
      }
    }
  }

  // ---- d.mst ve d.stp[vlan]
  for (const x of nodes) {
    if (isMst(x)) {
      const m = cfgM(x)
      // gösterim (show): örnekte yalnız o örneğin (switch'te var olan) VLAN'larından birini
      // taşıyan portlar listelenir (IOS); hesap bütün STP portlarıyla yapılır
      const cfgX = d.cfgs[x]!
      const shown = (st: MstInstanceState): MstInstanceState => {
        const vs = Object.keys(cfgX.vlans).map(Number).filter((v) => vlanExists(cfgX, v) && instanceOf(m, v) === st.id)
        const ports: Record<string, StpPort> = {}
        for (const lp of d.lports[x] ?? []) if (st.ports[lp.name] && vs.some((v) => egress(d, lp, v))) ports[lp.name] = st.ports[lp.name]!
        return { ...st, ports }
      }
      d.mst[x] = {
        region: { name: m.name, revision: m.revision, digest: digest[x]! },
        instances: [cist[x]!, ...instanceIds(m).filter((i) => i !== 0).map((i) => msti[x]![i]!)].map(shown),
      }
    }
    const cfg = d.cfgs[x]!
    for (const v of vlans) {
      if (!vlanExists(cfg, v)) continue
      const inst = isMst(x) ? instanceOf(cfgM(x), v) : 0
      const src = inst === 0 ? cist[x]! : msti[x]![inst]!
      // PVST+ switch'i: gösterim için VLAN'ın kendi önceliği; karar CIST'ten
      const prio = isMst(x) ? src.prio : (cfg.stpPriority[String(v)] ?? 32768) + v
      const bridge: StpBridge = {
        prio, mac: mac(x), rootPrio: src.rootPrio, rootMac: src.rootMac, rootCost: inst === 0 ? src.extCost : src.intCost,
        rootPort: src.rootPort, isRoot: src.isRoot, ports: {},
      }
      for (const lp of d.lports[x] ?? []) {
        if (!egress(d, lp, v)) continue
        bridge.ports[lp.name] = { ...(src.ports[lp.name] ?? edgePort(x, lp, inst)) }
      }
      ;(d.stp[v] ??= {})[x] = bridge
    }
  }
}

/** `show spanning-tree mst configuration` örnek satırları (VLAN listesi 63 karakterde kırılır). */
export function formatVlans(vs: number[]): string {
  const parts: string[] = []
  for (let i = 0; i < vs.length; ) {
    let j = i
    while (j + 1 < vs.length && vs[j + 1] === vs[j]! + 1) j++
    parts.push(j > i ? `${vs[i]}-${vs[j]}` : `${vs[i]}`)
    i = j + 1
  }
  return parts.join(',')
}

export type { MstConfig }
