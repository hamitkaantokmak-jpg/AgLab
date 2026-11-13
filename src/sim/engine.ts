// Derivation engine: turns switch configs into operational state.
// Nothing here is scripted per lab; wrong config yields wrong behaviour on its own.

import type { NatEntry } from './nat'
import { noHardwareFaults, type ChannelMode, type Hardware, type L2IfConfig, type PcConfig, type SwitchConfig, type SwitchDef } from './types'
import type { OspfState } from './ospf'
import { l2Signature } from './config'
import { ifType, macAdd } from './util'
import { pk, type Topo } from './topology'

export type EcFlag = 'P' | 's' | 'I' | 'D'

export interface PhysState {
  dev: string
  port: string
  peer: { dev: string; port: string } | null
  peerIsPc: boolean
  adminDown: boolean
  /** err-disabled (BPDU guard) */
  errDisabled: boolean
  up: boolean
  ec?: { id: number; mode: ChannelMode; flag: EcFlag }
}

export interface LPort {
  dev: string
  /** canonical physical name or Port-channelN */
  name: string
  isPo: boolean
  /** `no switchport`: carries no VLANs, takes part in no STP */
  routed: boolean
  members: string[]
  cfg: L2IfConfig
  /** line protocol up and allowed to pass frames */
  active: boolean
  peerDev: string | null
  peerPort: string | null
  peerIsPc: boolean
  opMode: 'access' | 'trunk'
  /** access VLAN missing from VLAN DB */
  inactive: boolean
  cost: number
  portNum: number
  status: 'connected' | 'notconnect' | 'disabled' | 'suspended' | 'inactive' | 'err-disabled'
}

export interface EcGroup {
  dev: string
  id: number
  protocol: 'LACP' | 'PAgP' | '-'
  members: { port: string; flag: EcFlag }[]
  up: boolean
}

export interface StpPort {
  role: 'Root' | 'Desg' | 'Altn'
  state: 'FWD' | 'BLK' | 'BKN'
  cost: number
  portNum: number
  edge: boolean
  inconsistent?: 'PVID_Inc'
}

export interface StpBridge {
  prio: number
  mac: string
  rootPrio: number
  rootMac: string
  rootCost: number
  rootPort: string | null
  isRoot: boolean
  ports: Record<string, StpPort>
}

export interface SviState {
  dev: string
  vlan: number
  adminDown: boolean
  up: boolean
  status: 'up' | 'down' | 'administratively down'
  ip: string | null
  mask: string | null
  mac: string
}

export interface NativeMismatch {
  dev: string
  port: string
  native: number
  peerDev: string
  peerPort: string
  peerNative: number
}

/** One IP used by several interfaces in the same broadcast domain (filled in ospf.ts computeState). */
export interface DupIp {
  ip: string
  /** in lab device order; the first one answers ARP */
  owners: { dev: string; kind: 'pc' | 'svi' | 'routed' | 'loop'; name: string; mac: string }[]
}

export interface Derived {
  topo: Topo
  cfgs: Record<string, SwitchConfig>
  pcs: Record<string, PcConfig>
  phys: Record<string, PhysState>
  lports: Record<string, LPort[]>
  /** 'dev|logicalName' -> LPort */
  lportByName: Record<string, LPort>
  /** 'dev|phys' -> logical port that carries it (Po for bundled members) */
  lportOfPhys: Record<string, LPort>
  ec: Record<string, EcGroup[]>
  stp: Record<number, Record<string, StpBridge>>
  svis: Record<string, SviState[]>
  nativeMismatch: NativeMismatch[]
  /** err-disabled physical ports ('dev|port') used for this derivation */
  errdis: Set<string>
  /** cut cables, powered-off devices, disabled PC NICs used for this derivation */
  hw: Hardware
  /** filled by computeState() in ospf.ts */
  ospf: Record<string, OspfState>
  /** duplicate addresses; filled by computeState() in ospf.ts */
  dups: DupIp[]
  /** L5-d: dynamic NAT translations (owned by the runtime; read by deliver()) */
  natTable?: NatEntry[]
}

const protoOf = (m: ChannelMode): 'LACP' | 'PAgP' | '-' =>
  m === 'on' ? '-' : m === 'active' || m === 'passive' ? 'LACP' : 'PAgP'

/** Flag for the local member given the peer member's mode (null: peer not in a channel). */
function negotiate(local: ChannelMode, peer: ChannelMode | null): EcFlag {
  if (peer === null) return local === 'on' ? 's' : 'I'
  if (local === 'on' && peer === 'on') return 'P'
  if (local === 'on') return 's'
  if (peer === 'on') return 'I'
  if (protoOf(local) !== protoOf(peer)) return 'I'
  if (protoOf(local) === 'LACP') return local === 'active' || peer === 'active' ? 'P' : 'I'
  return local === 'desirable' || peer === 'desirable' ? 'P' : 'I'
}

export function speedCost(mbps: number): number {
  if (mbps >= 10000) return 2
  if (mbps >= 2000) return 3
  if (mbps >= 1000) return 4
  if (mbps >= 200) return 12
  if (mbps >= 100) return 19
  return 100
}

export function vlanExists(cfg: SwitchConfig, v: number): boolean {
  return cfg.vlans[String(v)] !== undefined
}

export function allows(c: L2IfConfig, v: number): boolean {
  return c.allowed === null || c.allowed.includes(v)
}

export const isRoutedPort = (cfgs: Record<string, SwitchConfig>, dev: string, port: string) => !!cfgs[dev]?.ifaces[port]?.routed

export function derive(
  topo: Topo,
  cfgs: Record<string, SwitchConfig>,
  pcs: Record<string, PcConfig>,
  errdis: Set<string> = new Set(),
  hw: Hardware = noHardwareFaults(),
): Derived {
  const phys: Record<string, PhysState> = {}

  // 0. hardware: a cable end carries signal only if the cable is intact, the device is
  //    powered and (for a PC) its NIC is enabled
  const endPowered = (dev: string, port: string): boolean =>
    !hw.off.has(dev) && !hw.cut.has(pk(dev, port)) && !(topo.devices[dev]?.kind === 'pc' && hw.nicDown.has(dev))

  // 1. physical links (a shut port-channel takes its members down)
  const adminDown = (dev: string, port: string): boolean => {
    const c = cfgs[dev]?.ifaces[port]
    if (!c) return false
    if (c.shutdown) return true
    if (c.channel) {
      const po = cfgs[dev]!.pos[String(c.channel.id)]
      if (po?.shutdown) return true
    }
    return false
  }
  for (const sw of topo.switches) {
    for (const port of sw.ports) {
      const key = pk(sw.id, port)
      const peer = topo.peer[key] ?? null
      const peerIsPc = !!peer && topo.devices[peer.dev]?.kind === 'pc'
      const down = adminDown(sw.id, port)
      const err = errdis.has(key)
      const peerUp =
        !!peer && endPowered(peer.dev, peer.port) && (peerIsPc || (!adminDown(peer.dev, peer.port) && !errdis.has(pk(peer.dev, peer.port))))
      const up = !down && !err && endPowered(sw.id, port) && peerUp
      phys[key] = { dev: sw.id, port, peer, peerIsPc, adminDown: down, errDisabled: err, up }
    }
  }

  // 2. EtherChannel negotiation
  const chanOf = (dev: string, port: string) => (isRoutedPort(cfgs, dev, port) ? null : (cfgs[dev]?.ifaces[port]?.channel ?? null))
  for (const ps of Object.values(phys)) {
    const ch = chanOf(ps.dev, ps.port)
    if (!ch) continue
    let flag: EcFlag
    if (!ps.up) flag = 'D'
    else {
      const peerCh = ps.peer && !ps.peerIsPc ? chanOf(ps.peer.dev, ps.peer.port) : null
      flag = negotiate(ch.mode, peerCh ? peerCh.mode : null)
    }
    ps.ec = { id: ch.id, mode: ch.mode, flag }
  }
  // consistency passes: same peer bundle, matching config, symmetric bundling
  for (let iter = 0; iter < 6; iter++) {
    let changed = false
    for (const sw of topo.switches) {
      const groups = new Map<number, PhysState[]>()
      for (const port of sw.ports) {
        const ps = phys[pk(sw.id, port)]!
        if (ps.ec) groups.set(ps.ec.id, [...(groups.get(ps.ec.id) ?? []), ps])
      }
      for (const [id, members] of groups) {
        const poCfg = cfgs[sw.id]!.pos[String(id)]
        const poSig = poCfg ? l2Signature(poCfg) : null
        let ref: string | null = null
        for (const m of members) {
          if (m.ec!.flag !== 'P') continue
          const peerPs = phys[pk(m.peer!.dev, m.peer!.port)]
          const peerRef = peerPs?.ec ? `${m.peer!.dev}#${peerPs.ec.id}` : null
          const memberCfg = cfgs[sw.id]!.ifaces[m.port]!
          let bad = false
          if (!peerPs?.ec || peerPs.ec.flag !== 'P') bad = true
          if (poSig !== null && l2Signature(memberCfg) !== poSig) bad = true
          if (ref === null && !bad) ref = peerRef
          else if (peerRef !== ref) bad = true
          if (bad) {
            m.ec!.flag = 's'
            changed = true
          }
        }
      }
    }
    if (!changed) break
  }

  // 3. logical ports
  const lports: Record<string, LPort[]> = {}
  const lportByName: Record<string, LPort> = {}
  const lportOfPhys: Record<string, LPort> = {}
  const ec: Record<string, EcGroup[]> = {}
  const speedOf = (port: string) => ifType(port)?.speed ?? 100
  const portIndex = (sw: SwitchDef, port: string) => sw.ports.indexOf(port) + 1

  for (const sw of topo.switches) {
    const cfg = cfgs[sw.id]!
    const list: LPort[] = []
    const groups: EcGroup[] = []
    const ids = new Set<number>(Object.keys(cfg.pos).map(Number))
    for (const port of sw.ports) {
      const ch = chanOf(sw.id, port)
      if (ch) ids.add(ch.id)
    }
    for (const id of [...ids].sort((a, b) => a - b)) {
      const members = sw.ports.filter((p) => chanOf(sw.id, p)?.id === id)
      const memberStates = members.map((p) => ({ port: p, flag: phys[pk(sw.id, p)]!.ec!.flag }))
      const bundled = memberStates.filter((m) => m.flag === 'P').map((m) => m.port)
      const firstMode = members.length ? cfg.ifaces[members[0]!]!.channel!.mode : 'on'
      groups.push({ dev: sw.id, id, protocol: protoOf(firstMode), members: memberStates, up: bundled.length > 0 })
      const poCfg = cfg.pos[String(id)]
      if (!poCfg) continue
      let peerDev: string | null = null
      let peerPort: string | null = null
      if (bundled.length) {
        const peer = phys[pk(sw.id, bundled[0]!)]!.peer!
        const peerEc = phys[pk(peer.dev, peer.port)]!.ec!
        peerDev = peer.dev
        peerPort = 'Port-channel' + peerEc.id
      }
      const lp: LPort = {
        dev: sw.id,
        name: 'Port-channel' + id,
        isPo: true,
        routed: false,
        members: bundled,
        cfg: poCfg,
        active: bundled.length > 0 && !poCfg.shutdown,
        peerDev,
        peerPort,
        peerIsPc: false,
        opMode: 'access',
        inactive: false,
        cost: speedCost(bundled.reduce((s, p) => s + speedOf(p), 0)),
        portNum: 64 + id,
        status: poCfg.shutdown ? 'disabled' : bundled.length ? 'connected' : 'notconnect',
      }
      list.push(lp)
      for (const p of bundled) lportOfPhys[pk(sw.id, p)] = lp
    }
    for (const port of sw.ports) {
      const ps = phys[pk(sw.id, port)]!
      if (ps.ec?.flag === 'P') continue
      const suspended = ps.ec?.flag === 's'
      const lp: LPort = {
        dev: sw.id,
        name: port,
        isPo: false,
        routed: !!cfg.ifaces[port]!.routed,
        members: [port],
        cfg: cfg.ifaces[port]!,
        active: ps.up && !suspended,
        peerDev: ps.peer?.dev ?? null,
        peerPort: ps.peer?.port ?? null,
        peerIsPc: ps.peerIsPc,
        opMode: 'access',
        inactive: false,
        cost: speedCost(speedOf(port)),
        portNum: portIndex(sw, port),
        status: ps.adminDown ? 'disabled' : ps.errDisabled ? 'err-disabled' : suspended ? 'suspended' : ps.up ? 'connected' : 'notconnect',
      }
      list.push(lp)
      lportOfPhys[pk(sw.id, port)] = lp
    }
    for (const lp of list) lportByName[pk(sw.id, lp.name)] = lp
    lports[sw.id] = list
    ec[sw.id] = groups
  }
  // a link only works if the peer's logical port is active too
  const peerLp = (lp: LPort): LPort | null =>
    lp.peerDev && !lp.peerIsPc ? (lportByName[pk(lp.peerDev, lp.peerPort!)] ?? null) : null
  for (const list of Object.values(lports)) {
    for (const lp of list) {
      if (lp.active && !lp.peerIsPc) {
        const p = peerLp(lp)
        if (!p || !p.active) lp.active = lp.active && !!p && p.active
      }
    }
  }

  // 4. DTP / operational mode
  const sendsDtpTrunk = (p: LPort) => !p.routed && ((p.cfg.mode === 'trunk' && !p.cfg.nonegotiate) || p.cfg.mode === 'dynamic-desirable')
  for (const list of Object.values(lports)) {
    for (const lp of list) {
      const c = lp.cfg
      if (lp.routed) lp.opMode = 'access'
      else if (c.mode === 'access') lp.opMode = 'access'
      else if (c.mode === 'trunk') lp.opMode = 'trunk'
      else {
        const p = peerLp(lp)
        if (!p || !lp.active) lp.opMode = 'access'
        else if (sendsDtpTrunk(p)) lp.opMode = 'trunk'
        else if (c.mode === 'dynamic-desirable' && p.cfg.mode === 'dynamic-auto' && !p.routed) lp.opMode = 'trunk'
        else lp.opMode = 'access'
      }
      lp.inactive = !lp.routed && lp.opMode === 'access' && !vlanExists(cfgs[lp.dev]!, c.accessVlan)
      if (lp.inactive && lp.status === 'connected') lp.status = 'inactive'
    }
  }

  const d: Derived = {
    topo,
    cfgs,
    pcs,
    phys,
    lports,
    lportByName,
    lportOfPhys,
    ec,
    stp: {},
    svis: {},
    nativeMismatch: [],
    errdis,
    hw,
    ospf: {},
    dups: [],
  }

  // 5. STP per VLAN
  const allVlans = new Set<number>()
  for (const c of Object.values(cfgs))
    for (const v of Object.keys(c.vlans)) if (Number(v) < 1002 || Number(v) > 1005) allVlans.add(Number(v))
  for (const v of [...allVlans].sort((a, b) => a - b)) d.stp[v] = computeStp(d, v)

  // 6. SVIs
  for (const sw of topo.switches) {
    const cfg = cfgs[sw.id]!
    const out: SviState[] = []
    for (const [vs, svi] of Object.entries(cfg.svis)) {
      const v = Number(vs)
      const hasFwd = (d.lports[sw.id] ?? []).some((lp) => portForwards(d, sw.id, lp, v))
      const up = !svi.shutdown && vlanExists(cfg, v) && hasFwd && !hw.off.has(sw.id)
      out.push({
        dev: sw.id,
        vlan: v,
        adminDown: svi.shutdown,
        up,
        status: svi.shutdown ? 'administratively down' : vlanExists(cfg, v) ? 'up' : 'down',
        ip: svi.ip?.addr ?? null,
        mask: svi.ip?.mask ?? null,
        mac: macAdd(sw.mac, 0x40 + 0),
      })
    }
    out.sort((a, b) => a.vlan - b.vlan)
    d.svis[sw.id] = out
  }

  // 7. CDP native VLAN mismatch
  const nativeOf = (lp: LPort) => (lp.opMode === 'trunk' ? lp.cfg.nativeVlan : lp.cfg.accessVlan)
  for (const ps of Object.values(phys)) {
    if (!ps.up || !ps.peer || ps.peerIsPc) continue
    const a = lportOfPhys[pk(ps.dev, ps.port)]
    const b = lportOfPhys[pk(ps.peer.dev, ps.peer.port)]
    if (!a || !b || a.routed || b.routed) continue
    const na = nativeOf(a)
    const nb = nativeOf(b)
    if (na !== nb)
      d.nativeMismatch.push({ dev: ps.dev, port: ps.port, native: na, peerDev: ps.peer.dev, peerPort: ps.peer.port, peerNative: nb })
  }
  return d
}

// ---- frame carriage ----

export type Tag = 'u' | 't'

/** How VLAN v leaves lp, or null if it does not. */
export function egress(d: Derived, lp: LPort, v: number): Tag | null {
  if (!lp.active || lp.inactive || lp.routed) return null
  if (!vlanExists(d.cfgs[lp.dev]!, v)) return null
  if (lp.opMode === 'access') return lp.cfg.accessVlan === v ? 'u' : null
  if (!allows(lp.cfg, v)) return null
  return v === lp.cfg.nativeVlan ? 'u' : 't'
}

/** Which VLAN a frame entering lp lands in. */
export function ingress(d: Derived, lp: LPort, tag: Tag, v: number): number | null {
  if (!lp.active || lp.inactive || lp.routed) return null
  const cfg = d.cfgs[lp.dev]!
  if (lp.opMode === 'access') {
    if (tag === 't') return null
    return vlanExists(cfg, lp.cfg.accessVlan) ? lp.cfg.accessVlan : null
  }
  const vin = tag === 'u' ? lp.cfg.nativeVlan : v
  return allows(lp.cfg, vin) && vlanExists(cfg, vin) ? vin : null
}

export function peerOf(d: Derived, lp: LPort): LPort | null {
  if (!lp.peerDev || lp.peerIsPc) return null
  return d.lportByName[pk(lp.peerDev, lp.peerPort!)] ?? null
}

/** VLAN that v on lp maps to on the neighbouring switch. */
export function crossVlan(d: Derived, lp: LPort, v: number): number | null {
  const p = peerOf(d, lp)
  if (!p) return null
  const tag = egress(d, lp, v)
  if (!tag) return null
  return ingress(d, p, tag, v)
}

export function portForwards(d: Derived, dev: string, lp: LPort, v: number): boolean {
  const st = d.stp[v]?.[dev]?.ports[lp.name]
  return !!st && st.state === 'FWD'
}

// ---- spanning tree ----

interface Vec {
  rootPrio: number
  rootMac: string
  cost: number
  sPrio: number
  sMac: string
  sPort: number
}

function cmpVec(a: Vec, b: Vec): number {
  return (
    a.rootPrio - b.rootPrio ||
    a.rootMac.localeCompare(b.rootMac) ||
    a.cost - b.cost ||
    a.sPrio - b.sPrio ||
    a.sMac.localeCompare(b.sMac) ||
    a.sPort - b.sPort
  )
}

function computeStp(d: Derived, v: number): Record<string, StpBridge> {
  const bridges: Record<string, StpBridge> = {}
  interface Edge {
    lp: LPort
    peerDev: string
    peerLp: LPort
  }
  const edges: Record<string, Edge[]> = {}
  for (const sw of d.topo.switches) {
    const cfg = d.cfgs[sw.id]!
    if (!vlanExists(cfg, v) || d.hw.off.has(sw.id)) continue
    const prio = (cfg.stpPriority[String(v)] ?? 32768) + v
    const mac = sw.mac
    const b: StpBridge = { prio, mac, rootPrio: prio, rootMac: mac, rootCost: 0, rootPort: null, isRoot: true, ports: {} }
    edges[sw.id] = []
    for (const lp of d.lports[sw.id] ?? []) {
      if (!egress(d, lp, v)) continue
      const port: StpPort = { role: 'Desg', state: 'FWD', cost: lp.cost, portNum: lp.portNum, edge: lp.peerIsPc }
      b.ports[lp.name] = port
      const p = peerOf(d, lp)
      if (!p) continue
      const there = crossVlan(d, lp, v)
      if (there === null) continue
      if (there !== v || crossVlan(d, p, there) !== v) {
        port.state = 'BKN'
        port.inconsistent = 'PVID_Inc'
        continue
      }
      edges[sw.id]!.push({ lp, peerDev: p.dev, peerLp: p })
    }
    bridges[sw.id] = b
  }
  // also catch the reverse direction of a PVID inconsistency
  for (const [dev, b] of Object.entries(bridges)) {
    for (const e of edges[dev]!) {
      const pb = bridges[e.peerDev]
      if (pb?.ports[e.peerLp.name]?.state === 'BKN') {
        b.ports[e.lp.name]!.state = 'BKN'
        b.ports[e.lp.name]!.inconsistent = 'PVID_Inc'
      }
    }
    edges[dev] = edges[dev]!.filter((e) => b.ports[e.lp.name]!.state !== 'BKN' && !!bridges[e.peerDev])
  }

  const self = (b: StpBridge): Vec => ({ rootPrio: b.prio, rootMac: b.mac, cost: 0, sPrio: b.prio, sMac: b.mac, sPort: 0 })
  const best: Record<string, { vec: Vec; via: string | null }> = {}
  for (const [dev, b] of Object.entries(bridges)) best[dev] = { vec: self(b), via: null }
  // MotorBulgusu (I-1, test_aglab_large_topology): tur sayısı 64'le sınırlıydı; 64'ten uzun
  // zincirde kök bilgisi sona ulaşmıyor, döngüsüz zincirde iki kök ve bloklu port çıkıyordu.
  // Kök vektörü her turda bir atlama ilerler: köprü sayısı + 1 tur yeter (doğrulanmadı: IOS'ta
  // max-age/mesaj yaşı 802.1D çapını ~7 köprüyle sınırlar; Labber zamanlayıcı modellemez).
  const rounds = Object.keys(bridges).length + 1
  for (let iter = 0; iter < rounds; iter++) {
    let changed = false
    const next: typeof best = {}
    for (const [dev, b] of Object.entries(bridges)) {
      let cur = { vec: self(b), via: null as string | null }
      for (const e of edges[dev]!) {
        const nb = best[e.peerDev]!.vec
        const peerB = bridges[e.peerDev]!
        const cand: Vec = {
          rootPrio: nb.rootPrio,
          rootMac: nb.rootMac,
          cost: nb.cost + e.lp.cost,
          sPrio: peerB.prio,
          sMac: peerB.mac,
          sPort: e.peerLp.portNum,
        }
        if (cmpVec(cand, cur.vec) < 0) cur = { vec: cand, via: e.lp.name }
      }
      next[dev] = cur
      if (cmpVec(cur.vec, best[dev]!.vec) !== 0 || cur.via !== best[dev]!.via) changed = true
    }
    Object.assign(best, next)
    if (!changed) break
  }

  for (const [dev, b] of Object.entries(bridges)) {
    const bv = best[dev]!
    b.rootPrio = bv.vec.rootPrio
    b.rootMac = bv.vec.rootMac
    b.rootCost = bv.vec.cost
    b.rootPort = bv.via
    b.isRoot = bv.via === null
  }
  for (const [dev, b] of Object.entries(bridges)) {
    for (const e of edges[dev]!) {
      const port = b.ports[e.lp.name]!
      if (e.lp.name === b.rootPort) {
        port.role = 'Root'
        port.state = 'FWD'
        continue
      }
      const pb = bridges[e.peerDev]!
      const mine = [b.rootCost, b.prio, b.mac, e.lp.portNum] as const
      const theirs = [pb.rootCost, pb.prio, pb.mac, e.peerLp.portNum] as const
      const cmp = mine[0] - theirs[0] || mine[1] - theirs[1] || mine[2].localeCompare(theirs[2]) || mine[3] - theirs[3]
      if (cmp < 0) {
        port.role = 'Desg'
        port.state = 'FWD'
      } else {
        port.role = 'Altn'
        port.state = 'BLK'
      }
    }
  }
  return bridges
}

// ---- BPDU guard ----

/** Effective BPDU guard: per-port setting, else the global default on PortFast ports. */
export function bpduGuardOn(cfg: SwitchConfig, port: string): boolean {
  const c = cfg.ifaces[port]
  if (!c || c.routed) return false
  if (c.bpduguard !== undefined) return c.bpduguard
  return !!cfg.bpduguardDefault && c.portfast
}

/**
 * Ports with BPDU guard that hear BPDUs: the far end is an L2 switch port that is not shut.
 * Err-disable state itself is ignored so the result does not flap.
 */
export function bpduViolations(d: Derived): string[] {
  const out: string[] = []
  for (const [key, ps] of Object.entries(d.phys)) {
    if (ps.adminDown || !ps.peer || ps.peerIsPc) continue
    // no BPDUs over a cut cable or from / to a powered-off switch
    if (d.hw.cut.has(key) || d.hw.off.has(ps.dev) || d.hw.off.has(ps.peer.dev)) continue
    if (!bpduGuardOn(d.cfgs[ps.dev]!, ps.port)) continue
    const peer = d.phys[pk(ps.peer.dev, ps.peer.port)]
    if (!peer || peer.adminDown || isRoutedPort(d.cfgs, ps.peer.dev, ps.peer.port)) continue
    out.push(key)
  }
  return out
}
