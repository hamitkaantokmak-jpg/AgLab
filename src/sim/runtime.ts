// Lab runtime: owns configs, recomputes derived state, emits syslog on state changes.

import { defaultSwitchConfig } from './config'
import { bpduViolations, type Derived } from './engine'
import { l3Ifs, type Hop } from './net'
import { candidateRid, computeState } from './ospf'
import { LabQuery } from './query'
import { buildTopo, pk, type Topo } from './topology'
import type { LabDef, ObjectiveResult, PcConfig, SwitchConfig } from './types'
import { clone, shortIf } from './util'

export interface LogLine {
  dev: string
  text: string
  seq: number
}

export interface ObjectiveStatus {
  id: string
  title: string
  hint: string
  ok: boolean
  detail?: string
}

export interface SavedState {
  v: 1
  running: Record<string, SwitchConfig>
  startup: Record<string, SwitchConfig | null>
  pcs: Record<string, PcConfig>
  seen: string[]
  arp: string[]
  errdis?: string[]
}

export class LabRuntime {
  topo: Topo
  running: Record<string, SwitchConfig> = {}
  startup: Record<string, SwitchConfig | null> = {}
  pcs: Record<string, PcConfig> = {}
  derived!: Derived
  logs: LogLine[] = []
  seen = new Set<string>()
  arp = new Set<string>()
  /** err-disabled ports ('dev|port'); sticky until shutdown or errdisable recovery */
  errdis = new Set<string>()
  private seq = 0
  private t0 = Date.now()
  private listeners = new Set<() => void>()
  constructor(
    public def: LabDef,
    /** applies the lab's initial config (runs IOS commands against this runtime) */
    private applyInitial: (rt: LabRuntime) => void,
  ) {
    this.topo = buildTopo(def)
    this.reset()
  }

  /** Factory defaults plus the lab's initial config; nothing saved. */
  reset() {
    for (const sw of this.topo.switches) {
      this.running[sw.id] = defaultSwitchConfig(sw)
      this.running[sw.id]!.hostname = sw.id
    }
    for (const pc of this.topo.pcs) this.pcs[pc.id] = clone(this.def.initialPcs?.[pc.id] ?? { ip: null, prefix: 24, gw: null })
    this.errdis.clear()
    this.derived = computeState(this.topo, this.running, this.pcs, this.errdis)
    this.applyInitial(this)
    this.derived = this.recompute()
    for (const sw of this.topo.switches) this.startup[sw.id] = clone(this.running[sw.id]!)
    this.seen.clear()
    this.arp.clear()
    this.logs = []
    this.emit()
  }

  onChange(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  emit() {
    for (const fn of this.listeners) fn()
  }

  timestamp(): string {
    const ms = Date.now() - this.t0 + 3_723_000
    const h = Math.floor(ms / 3_600_000)
    const m = Math.floor(ms / 60_000) % 60
    const s = Math.floor(ms / 1000) % 60
    const f = ms % 1000
    const two = (n: number) => String(n).padStart(2, '0')
    return `*Mar  1 ${two(h)}:${two(m)}:${two(s)}.${String(f).padStart(3, '0')}`
  }

  log(dev: string, msg: string) {
    this.logs.push({ dev, text: `${this.timestamp()}: ${msg}`, seq: ++this.seq })
    if (this.logs.length > 400) this.logs.splice(0, this.logs.length - 400)
  }

  /** Recompute after a config change and log what changed. */
  commit() {
    const prev = this.derived
    this.derived = this.recompute()
    this.diffLogs(prev, this.derived)
    this.emit()
  }

  /** Derive, then settle err-disable (BPDU guard) and OSPF router-id selection. */
  private recompute(): Derived {
    let d = computeState(this.topo, this.running, this.pcs, this.errdis)
    for (let i = 0; i < 4; i++) {
      let changed = false
      // a shut port leaves err-disabled state (shutdown / no shutdown recovers it)
      for (const k of [...this.errdis]) {
        if (d.phys[k]?.adminDown) {
          this.errdis.delete(k)
          changed = true
        }
      }
      const viol = new Set(bpduViolations(d))
      for (const k of viol) {
        if (this.errdis.has(k)) continue
        const [dev, port] = k.split('|') as [string, string]
        this.errdis.add(k)
        this.log(dev, `%SPANTREE-2-BLOCK_BPDUGUARD: Received BPDU on port ${port} with BPDU Guard enabled. Disabling port.`)
        this.log(dev, `%PM-4-ERR_DISABLE: bpduguard error detected on ${shortIf(port)}, putting ${shortIf(port)} in err-disable state`)
        changed = true
      }
      for (const k of [...this.errdis]) {
        const [dev, port] = k.split('|') as [string, string]
        if (viol.has(k) || !this.running[dev]?.errRecoveryBpdu) continue
        this.errdis.delete(k)
        this.log(dev, `%PM-4-ERR_RECOVER: Attempting to recover from bpduguard err-disable state on ${shortIf(port)}`)
        changed = true
      }
      // OSPF picks its router ID once, when the process first has one available
      for (const sw of this.topo.switches) {
        const o = this.running[sw.id]!.ospf
        if (!o || o.activeRid || !d.ospf[sw.id]) continue
        const rid = candidateRid(d, sw.id)
        if (rid) {
          o.activeRid = rid
          changed = true
        }
      }
      if (!changed) break
      d = computeState(this.topo, this.running, this.pcs, this.errdis)
    }
    return d
  }

  /** Hosts that sent or answered traffic become visible in MAC tables. */
  markSeen(hops: Hop[], from: string) {
    if (!hops.length) return
    for (const h of hops) {
      this.seen.add(h.outIf.mac)
      const owner = l3Ifs(this.derived, h.dev).find((i) => i.ip === h.ip)
      if (owner) this.seen.add(owner.mac)
    }
    void from
  }

  hostname(dev: string): string {
    return this.running[dev]?.hostname ?? dev
  }

  objectives(): ObjectiveStatus[] {
    const q = new LabQuery(this.derived, this.startup)
    return this.def.objectives.map((o) => {
      let r: boolean | ObjectiveResult
      try {
        r = o.check(q)
      } catch {
        r = false
      }
      const res = typeof r === 'boolean' ? { ok: r } : r
      return { id: o.id, title: o.title, hint: o.hint, ok: res.ok, detail: res.detail }
    })
  }

  save(): SavedState {
    return {
      v: 1,
      running: clone(this.running),
      startup: clone(this.startup),
      pcs: clone(this.pcs),
      seen: [...this.seen],
      arp: [...this.arp],
      errdis: [...this.errdis],
    }
  }

  load(s: SavedState) {
    if (s?.v !== 1) return false
    for (const sw of this.topo.switches) {
      if (!s.running[sw.id]) return false
      // ports defined by the lab win over stale saved state
      for (const p of sw.ports) if (!s.running[sw.id]!.ifaces[p]) return false
    }
    this.running = clone(s.running)
    this.startup = clone(s.startup)
    this.pcs = clone(s.pcs)
    this.seen = new Set(s.seen)
    this.arp = new Set(s.arp)
    this.errdis = new Set(s.errdis ?? [])
    this.derived = this.recompute()
    this.emit()
    return true
  }

  private diffLogs(a: Derived, b: Derived) {
    const updown = (dev: string, name: string, was: boolean, is: boolean, admin: boolean) => {
      if (was === is) return
      if (!is && admin) this.log(dev, `%LINK-5-CHANGED: Interface ${name}, changed state to administratively down`)
      else this.log(dev, `%LINK-3-UPDOWN: Interface ${name}, changed state to ${is ? 'up' : 'down'}`)
      this.log(dev, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${name}, changed state to ${is ? 'up' : 'down'}`)
    }
    for (const [key, ps] of Object.entries(b.phys)) {
      const old = a.phys[key]
      if (old) updown(ps.dev, ps.port, old.up, ps.up, ps.adminDown)
      const of = old?.ec?.flag
      const nf = ps.ec?.flag
      const po = ps.ec ? 'Po' + ps.ec.id : old?.ec ? 'Po' + old.ec.id : ''
      if (of !== 'P' && nf === 'P') this.log(ps.dev, `%EC-5-BUNDLE: Interface ${shortIf(ps.port)} joined port-channel ${po}`)
      if (of === 'P' && nf !== 'P' && nf !== 'D') this.log(ps.dev, `%EC-5-UNBUNDLE: Interface ${shortIf(ps.port)} left the port-channel ${po}`)
      if (of !== 's' && nf === 's') this.log(ps.dev, `%EC-5-CANNOT_BUNDLE2: ${shortIf(ps.port)} is not compatible with ${po} and will be suspended`)
    }
    for (const [dev, list] of Object.entries(b.lports)) {
      for (const lp of list) {
        if (!lp.isPo) continue
        const old = a.lportByName[pk(dev, lp.name)]
        updown(dev, lp.name, old?.active ?? false, lp.active, lp.cfg.shutdown)
      }
    }
    for (const [dev, list] of Object.entries(b.svis)) {
      for (const s of list) {
        const old = a.svis[dev]?.find((x) => x.vlan === s.vlan)
        const wasUp = old?.up ?? false
        if (wasUp !== s.up || (old && old.adminDown !== s.adminDown)) {
          const name = 'Vlan' + s.vlan
          if (old && old.adminDown !== s.adminDown)
            this.log(dev, s.adminDown ? `%LINK-5-CHANGED: Interface ${name}, changed state to administratively down` : `%LINK-3-UPDOWN: Interface ${name}, changed state to up`)
          if (wasUp !== s.up) this.log(dev, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${name}, changed state to ${s.up ? 'up' : 'down'}`)
        }
      }
    }
    const mm = (x: { dev: string; port: string }) => `${x.dev}|${x.port}`
    const oldMm = new Set(a.nativeMismatch.map(mm))
    for (const m of b.nativeMismatch) {
      if (oldMm.has(mm(m))) continue
      this.log(
        m.dev,
        `%CDP-4-NATIVE_VLAN_MISMATCH: Native VLAN mismatch discovered on ${m.port} (${m.native}), with ${this.hostname(m.peerDev)} ${m.peerPort} (${m.peerNative}).`,
      )
    }
    // OSPF adjacencies and hello problems
    const nbrKey = (n: { ifname: string; rid: string }) => `${n.ifname}|${n.rid}`
    for (const dev of new Set([...Object.keys(a.ospf), ...Object.keys(b.ospf)])) {
      const pid = b.ospf[dev]?.pid ?? a.ospf[dev]?.pid
      const oldFull = new Map((a.ospf[dev]?.nbrs ?? []).filter((n) => n.state === 'FULL').map((n) => [nbrKey(n), n]))
      const newFull = new Map((b.ospf[dev]?.nbrs ?? []).filter((n) => n.state === 'FULL').map((n) => [nbrKey(n), n]))
      for (const [k, n] of newFull)
        if (!oldFull.has(k)) this.log(dev, `%OSPF-5-ADJCHG: Process ${pid}, Nbr ${n.rid} on ${n.ifname} from LOADING to FULL, Loading Done`)
      for (const [k, n] of oldFull) {
        if (newFull.has(k)) continue
        const ifUp = b.ospf[dev]?.ifs.some((i) => i.name === n.ifname && i.up)
        this.log(dev, `%OSPF-5-ADJCHG: Process ${pid}, Nbr ${n.rid} on ${n.ifname} from FULL to DOWN, Neighbor Down: ${ifUp ? 'Dead timer expired' : 'Interface down or detached'}`)
      }
      const mk = (m: { ifname: string; peerIp: string; kind: string }) => `${m.ifname}|${m.peerIp}|${m.kind}`
      const oldMm = new Set((a.ospf[dev]?.mismatches ?? []).map(mk))
      for (const m of b.ospf[dev]?.mismatches ?? []) {
        if (oldMm.has(mk(m))) continue
        if (m.kind === 'area') this.log(dev, `%OSPF-4-ERRRCV: Received invalid packet: mismatched area ID from ${m.peerIp}, ${m.ifname}`)
        if (m.kind === 'rid') this.log(dev, `%OSPF-4-DUP_RTRID_NBR: OSPF detected duplicate router-id ${b.ospf[dev]!.rid} from ${m.peerIp} on interface ${m.ifname}`)
      }
    }
    for (const [vs, bridges] of Object.entries(b.stp)) {
      for (const [dev, br] of Object.entries(bridges)) {
        for (const [port, st] of Object.entries(br.ports)) {
          const was = a.stp[Number(vs)]?.[dev]?.ports[port]?.inconsistent
          if (st.inconsistent && !was)
            this.log(dev, `%SPANTREE-2-BLOCK_PVID_LOCAL: Blocking ${port} on VLAN${vs.padStart(4, '0')}. Inconsistent local vlan.`)
          if (!st.inconsistent && was)
            this.log(dev, `%SPANTREE-2-UNBLOCK_CONSIST_PORT: Unblocking ${port} on VLAN${vs.padStart(4, '0')}. Port consistency restored.`)
        }
      }
    }
  }
}
