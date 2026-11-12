// Lab runtime: owns configs, recomputes derived state, emits syslog on state changes.

import { cdpBetween } from './discovery'
import { activePs, secureCount } from './portsec'
import { defaultSwitchConfig } from './config'
import { apipaFor, dhcpDiscover, isApipa, type DhcpResult } from './dhcp'
import { bpduViolations, type Derived } from './engine'
import { l3Ifs, macTable, type Delivery, type Hop } from './net'
import { candidateRid, computeState } from './ospf'
import { LabQuery } from './query'
import { buildTopo, pk, type Topo } from './topology'
import { noHardwareFaults, type DhcpBinding, type Hardware, type LabDef, type ObjectiveResult, type PcConfig, type SwitchConfig } from './types'
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
  /** 'dev>ip' ARP requests that went unanswered (IOS "Incomplete") */
  arpIncomplete?: string[]
  errdis?: string[]
  /** cut cables ('dev|port', both ends), powered-off devices, PCs with a disabled NIC */
  hw?: { cut: string[]; off: string[]; nicDown: string[] }
  /** L5-b: DHCP leases */
  dhcp?: DhcpBinding[]
  /** L5-e: err-disable cause per port, dynamic secure MACs, violation counters, last source */
  errCause?: [string, string][]
  psDynamic?: [string, string[]][]
  psViolations?: [string, number][]
  psLast?: [string, string][]
  aclHits?: [string, number][]
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
  /** 'dev>ip' ARP requests that went unanswered (shown as Incomplete) */
  arpIncomplete = new Set<string>()
  /** err-disabled ports ('dev|port'); sticky until shutdown or errdisable recovery */
  errdis = new Set<string>()
  /** cut cables, powered-off devices, disabled PC NICs (see Hardware) */
  hw: Hardware = noHardwareFaults()
  /** L5-b: DHCP leases handed out by the lab's servers (kept in RAM: lost on reload) */
  dhcp: DhcpBinding[] = []
  /** L5-e: why a port is err-disabled ('bpduguard' | 'psecure-violation'); missing = bpduguard */
  errCause = new Map<string, string>()
  /** L5-e: dynamically learned secure MACs per port ('dev|port'); cleared when the port goes down */
  psDynamic = new Map<string, string[]>()
  /** L5-e: security violation counters per port */
  psViolations = new Map<string, number>()
  /** L5-e: last source MAC seen on a secure port */
  psLast = new Map<string, string>()
  /** L5-c: ACL match counters ('dev|acl|seq'); `clear access-list counters` resets them */
  aclHits = new Map<string, number>()
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
    this.errCause.clear()
    this.psDynamic.clear()
    this.psViolations.clear()
    this.psLast.clear()
    this.aclHits.clear()
    this.dhcp = []
    this.hw = noHardwareFaults()
    for (const l of this.def.links)
      if (l.up === false) for (const [dev, port] of [l.a, l.b]) this.hw.cut.add(pk(dev, port))
    for (const dv of this.def.devices) {
      if (dv.off) this.hw.off.add(dv.id)
      if (dv.kind === 'pc' && dv.nicDown) this.hw.nicDown.add(dv.id)
    }
    this.derived = computeState(this.topo, this.running, this.pcs, this.errdis, this.hw)
    this.applyInitial(this)
    this.derived = this.recompute()
    for (const sw of this.topo.switches) this.startup[sw.id] = clone(this.running[sw.id]!)
    this.seen.clear()
    this.arp.clear()
    this.arpIncomplete.clear()
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
    if (this.hw.off.has(dev)) return // a powered-off device prints nothing
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
    let d = computeState(this.topo, this.running, this.pcs, this.errdis, this.hw)
    for (let i = 0; i < 4; i++) {
      let changed = false
      // a shut port leaves err-disabled state (shutdown / no shutdown recovers it)
      for (const k of [...this.errdis]) {
        if (d.phys[k]?.adminDown) {
          this.errdis.delete(k)
          this.errCause.delete(k)
          changed = true
        }
      }
      const viol = new Set(bpduViolations(d))
      for (const k of viol) {
        if (this.errdis.has(k)) continue
        const [dev, port] = k.split('|') as [string, string]
        this.errdis.add(k)
        this.errCause.set(k, 'bpduguard')
        this.log(dev, `%SPANTREE-2-BLOCK_BPDUGUARD: Received BPDU on port ${port} with BPDU Guard enabled. Disabling port.`)
        this.log(dev, `%PM-4-ERR_DISABLE: bpduguard error detected on ${shortIf(port)}, putting ${shortIf(port)} in err-disable state`)
        changed = true
      }
      for (const k of [...this.errdis]) {
        const [dev, port] = k.split('|') as [string, string]
        // only bpduguard recovery is modelled (`errdisable recovery cause bpduguard`)
        if (viol.has(k) || !this.running[dev]?.errRecoveryBpdu || (this.errCause.get(k) ?? 'bpduguard') !== 'bpduguard') continue
        this.errdis.delete(k)
        this.errCause.delete(k)
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
      // L5-e: dynamic secure addresses go away when the port goes down or security is off
      for (const k of [...this.psDynamic.keys()]) {
        const [dev, port] = k.split('|') as [string, string]
        if (d.phys[k]?.up && activePs(this.running[dev], port)) continue
        this.psDynamic.delete(k)
      }
      if (!changed) break
      d = computeState(this.topo, this.running, this.pcs, this.errdis, this.hw)
    }
    return d
  }

  /**
   * L5-e: a PC puts frames on the wire (ping, trace, DHCP). On a secure access port its source
   * MAC is learned (sticky → running-config) or, past `maximum`, triggers the violation mode:
   * shutdown → err-disable + syslog, restrict → counter + syslog, protect → silent drop.
   */
  hostSends(pc: string) {
    const at = this.topo.pcAttach[pc]
    const def = this.topo.devices[pc]
    if (!at || !def || this.hw.off.has(pc) || this.hw.nicDown.has(pc)) return
    const key = pk(at.dev, at.port)
    const ps = activePs(this.running[at.dev], at.port)
    if (!ps || !this.derived.phys[key]?.up) return
    const mac = def.mac
    this.psLast.set(key, mac)
    const dyn = this.psDynamic.get(key) ?? []
    if (ps.macs.includes(mac) || ps.stickyMacs.includes(mac) || dyn.includes(mac)) return
    if (secureCount(ps, dyn) < ps.max) {
      if (ps.sticky) ps.stickyMacs.push(mac)
      else this.psDynamic.set(key, [...dyn, mac])
      this.commit()
      return
    }
    if (ps.violation === 'protect') return
    this.psViolations.set(key, (this.psViolations.get(key) ?? 0) + 1)
    this.log(at.dev, `%PORT_SECURITY-2-PSECURE_VIOLATION: Security violation occurred, caused by MAC address ${mac} on port ${at.port}.`)
    if (ps.violation === 'shutdown' && !this.errdis.has(key)) {
      this.errdis.add(key)
      this.errCause.set(key, 'psecure-violation')
      this.log(at.dev, `%PM-4-ERR_DISABLE: psecure-violation error detected on ${shortIf(at.port)}, putting ${shortIf(at.port)} in err-disable state`)
    }
    this.commit()
  }

  /** Plug in (up) or unplug / cut (down) the cable on this port. False when no cable is there. */
  setLink(dev: string, port: string, up: boolean): boolean {
    const peer = this.topo.peer[pk(dev, port)]
    if (!peer) return false
    if (!up) {
      // link down flushes the dynamic MAC entries learned on that port
      this.flushPortMacs(dev, port)
      this.flushPortMacs(peer.dev, peer.port)
    }
    for (const k of [pk(dev, port), pk(peer.dev, peer.port)]) {
      if (up) this.hw.cut.delete(k)
      else this.hw.cut.add(k)
    }
    this.commit()
    return true
  }

  /**
   * Forget MACs a switch learned on this port. The learned set is lab-wide, so those
   * addresses are relearned everywhere on their next frame (real switches age the
   * entries on other switches out after 300 s).
   */
  private flushPortMacs(dev: string, port: string) {
    if (this.topo.devices[dev]?.kind !== 'switch') return
    const name = this.derived.lportOfPhys[pk(dev, port)]?.name ?? port
    for (const e of macTable(this.derived, dev, this.seen)) if (e.port === name) this.seen.delete(e.mac)
  }

  /**
   * Move the cable end plugged into fromDev/fromPort to toDev/toPort (a free port).
   * The topology is rebuilt; MACs learned on the old port are flushed.
   * False when there is no cable there or the target port is missing or taken.
   */
  moveCable(fromDev: string, fromPort: string, toDev: string, toPort: string): boolean {
    const peer = this.topo.peer[pk(fromDev, fromPort)]
    const target = this.topo.devices[toDev]
    if (!peer || !target) return false
    const exists = target.kind === 'pc' ? toPort === 'eth0' : target.ports.includes(toPort)
    if (!exists || this.topo.peer[pk(toDev, toPort)] || (toDev === peer.dev && toPort === peer.port)) return false
    if (target.kind === 'pc' && this.topo.devices[peer.dev]?.kind === 'pc') return false
    this.flushPortMacs(fromDev, fromPort)
    this.flushPortMacs(peer.dev, peer.port)
    const at = (e: [string, string]) => e[0] === fromDev && e[1] === fromPort
    const links = this.def.links.map((l) => {
      if (at(l.a)) return { ...l, a: [toDev, toPort] as [string, string] }
      if (at(l.b)) return { ...l, b: [toDev, toPort] as [string, string] }
      return l
    })
    this.def = { ...this.def, links }
    this.topo = buildTopo(this.def)
    if (this.hw.cut.delete(pk(fromDev, fromPort))) this.hw.cut.add(pk(toDev, toPort))
    this.commit()
    return true
  }

  /** Read-only queries on the current state, including learned MAC addresses. */
  query(): LabQuery {
    return new LabQuery(this.derived, this.startup, this.seen, this.dhcp)
  }

  /**
   * L5-b: the PC asks for an address (DHCP DISCOVER … ACK). On success its address, mask,
   * gateway and DNS server come from the lease. When nothing answers it keeps the
   * link-local (169.254/16) address it already has, or gives itself one; the gateway is
   * cleared and an earlier lease of this client is dropped.
   */
  dhcpRequest(pc: string): DhcpResult {
    const def = this.topo.devices[pc]
    if (!def || def.kind !== 'pc') return { ok: false, reason: 'nolink' }
    const old = this.pcs[pc]!
    const keep = { ...(old.services ? { services: old.services } : {}) }
    const r = dhcpDiscover(this.derived, pc, this.dhcp)
    this.dhcp = this.dhcp.filter((b) => b.client !== pc)
    if (r.ok) {
      this.pcs[pc] = { ip: r.ip, prefix: r.prefix, gw: r.gw, dhcp: true, dns: r.dns, ...keep }
      this.dhcp.push({ server: r.server, serverIp: r.serverIp, pool: r.pool, ip: r.ip, client: pc, mac: def.mac, expires: this.leaseExpiry() })
      this.seen.add(def.mac)
    } else {
      // already on a link-local address: nothing changes (the client keeps retrying)
      if (old.ip && isApipa(old.ip)) this.pcs[pc] = { ...old, dhcp: true }
      else this.pcs[pc] = { ip: apipaFor(def.mac), prefix: 16, gw: null, dhcp: true, ...(old.dns && !old.dhcp ? { dns: old.dns } : {}), ...keep }
    }
    this.commit()
    return r
  }

  /** L5-b: DHCP release: the client gives its address back and has none. */
  dhcpRelease(pc: string) {
    const old = this.pcs[pc]
    if (!old) return
    this.dhcp = this.dhcp.filter((b) => b.client !== pc)
    this.pcs[pc] = { ip: null, prefix: 24, gw: null, ...(old.services ? { services: old.services } : {}) }
    this.commit()
  }

  /** L5-b: lease of this PC that is still in use (address obtained from DHCP), or null. */
  dhcpLeaseOf(pc: string): DhcpBinding | null {
    const c = this.pcs[pc]
    return (c?.dhcp && this.dhcp.find((b) => b.client === pc && b.ip === c.ip)) || null
  }

  /** `clear ip dhcp binding *` / reload: the server forgets its leases. */
  dhcpClear(server: string, ip?: string): number {
    const before = this.dhcp.length
    this.dhcp = this.dhcp.filter((b) => b.server !== server || (ip !== undefined && b.ip !== ip))
    return before - this.dhcp.length
  }

  /** Default lease is one day: expiration on the lab clock (starts on Mar 1). */
  private leaseExpiry(): string {
    const ms = Date.now() - this.t0 + 3_723_000
    const h = Math.floor(ms / 3_600_000) % 24
    const m = Math.floor(ms / 60_000) % 60
    const two = (n: number) => String(n).padStart(2, '0')
    return `Mar 02 1993 ${two(h % 12 === 0 ? 12 : h % 12)}:${two(m)} ${h < 12 ? 'AM' : 'PM'}`
  }

  /** Cable on this port is plugged in and intact (says nothing about the far device). */
  cableIntact(dev: string, port: string): boolean {
    return !!this.topo.peer[pk(dev, port)] && !this.hw.cut.has(pk(dev, port))
  }

  /**
   * Power a device off or on. Powering a switch on is a reload: the running config
   * comes back from startup-config (factory defaults when nothing was saved) and
   * err-disabled ports recover.
   */
  setPower(dev: string, on: boolean) {
    const def = this.topo.devices[dev]
    if (!def || on === !this.hw.off.has(dev)) return
    if (!on) {
      this.hw.off.add(dev)
    } else {
      this.hw.off.delete(dev)
      if (def.kind === 'switch') {
        const saved = this.startup[dev]
        this.running[dev] = saved ? clone(saved) : Object.assign(defaultSwitchConfig(def), { hostname: dev })
        // like `reload`: OSPF picks its router ID again
        const o = this.running[dev]!.ospf
        if (o) o.activeRid = null
        for (const k of [...this.errdis]) if (k.startsWith(dev + '|')) this.errdis.delete(k)
        for (const k of [...this.arp]) if (k.startsWith(dev + '>')) this.arp.delete(k)
        for (const k of [...this.arpIncomplete]) if (k.startsWith(dev + '>')) this.arpIncomplete.delete(k)
      }
      // DHCP bindings live in RAM: a restarted server has none
      this.dhcpClear(dev)
    }
    this.commit()
  }

  powered(dev: string): boolean {
    return !!this.topo.devices[dev] && !this.hw.off.has(dev)
  }

  /** Enable or disable a PC's network card. */
  setNic(pc: string, up: boolean) {
    if (this.topo.devices[pc]?.kind !== 'pc') return
    if (up) this.hw.nicDown.delete(pc)
    else this.hw.nicDown.add(pc)
    this.commit()
  }

  /** Hosts that sent or answered traffic become visible in MAC tables. */
  /** L5-c: count ACL entries matched by real traffic; `packets` per delivery (ping sends 5). */
  countAcl(packets: number, ...ds: (Delivery | undefined)[]) {
    for (const d of ds)
      for (const h of d?.acl ?? []) {
        const k = `${h.dev}|${h.acl}|${h.seq}`
        this.aclHits.set(k, (this.aclHits.get(k) ?? 0) + packets)
      }
  }

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
    const q = this.query()
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
      arpIncomplete: [...this.arpIncomplete],
      errdis: [...this.errdis],
      errCause: [...this.errCause],
      psDynamic: [...this.psDynamic],
      psViolations: [...this.psViolations],
      psLast: [...this.psLast],
      aclHits: [...this.aclHits],
      hw: { cut: [...this.hw.cut], off: [...this.hw.off], nicDown: [...this.hw.nicDown] },
      dhcp: clone(this.dhcp),
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
    this.arpIncomplete = new Set(s.arpIncomplete ?? [])
    this.errdis = new Set(s.errdis ?? [])
    this.errCause = new Map(s.errCause ?? [])
    this.psDynamic = new Map(s.psDynamic ?? [])
    this.psViolations = new Map(s.psViolations ?? [])
    this.psLast = new Map(s.psLast ?? [])
    this.aclHits = new Map(s.aclHits ?? [])
    if (s.hw) this.hw = { cut: new Set(s.hw.cut), off: new Set(s.hw.off), nicDown: new Set(s.hw.nicDown) }
    this.dhcp = clone(s.dhcp ?? [])
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
      if (!cdpBetween(b, m.dev, m.port, m.peerDev, m.peerPort)) continue
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
    // duplicate addresses: a switch reports another device using its own address
    const dupKeys = (x: Derived) =>
      new Map(
        x.dups.flatMap((g) =>
          g.owners
            .filter((o) => o.kind === 'svi' || o.kind === 'routed')
            .map((o) => {
              const other = g.owners.find((p) => p.dev !== o.dev)
              return [`${g.ip}|${o.dev}|${o.name}|${other?.mac}`, { ip: g.ip, o, other }] as const
            })
            .filter(([, v]) => !!v.other),
        ),
      )
    const oldDup = dupKeys(a)
    for (const [k, v] of dupKeys(b))
      if (!oldDup.has(k)) this.log(v.o.dev, `%IP-4-DUPADDR: Duplicate address ${v.ip} on ${v.o.name}, sourced by ${v.other!.mac}`)
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
