// Lab runtime: owns configs, recomputes derived state, emits syslog on state changes.

import { computeTrack, type TrackState } from './track'
import { computeFhrp, memberId, type FhrpState } from './fhrp'
import type { ConfigLine } from './config-text'
import type { NatEntry } from './nat'
import { cdpBetween } from './discovery'
import { activePs, secureCount } from './portsec'
import { defaultSwitchConfig } from './config'
import { apipaFor, dhcpDiscover, isApipa, type DhcpResult } from './dhcp'
import { bpduViolations, type Derived } from './engine'
import { formatStamp, parseMessage, trimBuffer, type LogEntry } from './syslog'
import { canonicalConfig, diffSnapshots, type ConfigDiff, type ConfigSnapshot } from './configdiff'
import { runningConfig } from './cli/show'
import type { SwitchDef } from './types'
import { BACKGROUND_FPS, flapUp, nextFlapEdge, roundT, validFlap, type FlapSpec, type ScheduledAction, type ScheduledEvent } from './clock'
import { BOOT_FRAMES, linkKey, normalizePhys, receive, zeroCounters, type PortCounters } from './phys'
import { l3Ifs, macTable, physicalPath, type Delivery, type Hop } from './net'
import { fhrpOwns, fhrpTarget } from './fhrp'
import { candidateRid, computeState } from './ospf'
import { asHex } from './bgp'
import { resolvePolicy, type BgpPolicy } from './bgp-policy'
import { eigrpTag } from './eigrp'
import { LabQuery } from './query'
import { buildTopo, pk, type Topo } from './topology'
import { noHardwareFaults, type CableSpec, type LinkPhys, type SfpSpec, type DhcpBinding, type Hardware, type LabDef, type ObjectiveResult, type PcConfig, type SwitchConfig } from './types'
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
  hw?: { cut: string[]; off: string[]; nicDown: string[]; phys?: [string, LinkPhys][] }
  /** Katman 1: phys portlarının hata sayaçları (yalnız phys tanımlı labda yazılır) */
  physCounters?: [string, PortCounters][]
  /** L5-b: DHCP leases */
  dhcp?: DhcpBinding[]
  /** L5-e: err-disable cause per port, dynamic secure MACs, violation counters, last source */
  errCause?: [string, string][]
  psDynamic?: [string, string[]][]
  psViolations?: [string, number][]
  psLast?: [string, string][]
  aclHits?: [string, number][]
  /** L5-d: dynamic NAT translations and hit counter */
  nat?: NatEntry[]
  natHits?: number
  natMisses?: number
  /** eBGP: komşu başına dondurulmuş politika (soft clear bekleyen değişiklik kayıttan sonra da bekler) */
  bgpApplied?: Record<string, { in?: BgpPolicy; out?: BgpPolicy }>
  /** sanal zaman (yalnız zamanlı kipte yazılır) */
  time?: {
    clock: number
    bgAcc: number
    flaps: [string, FlapSpec][]
    sched: ScheduledEvent[]
    schedSeq: number
    booting: [string, number][]
    errSince: [string, number][]
    okSince: [string, number | null][]
  }
  /** syslog tamponu: cihaz başına satırlar, toplam yazılan, damga sayacı (yalnız satır varsa) */
  syslog?: { buf: [string, LogEntry[]][]; logged: [string, number][]; n: number }
}

/** IOS `mac address-table aging-time` varsayılanı (saniye). */
export const MAC_AGING_SECONDS = 300

/**
 * MotorBulgusu (I-1, test_aglab_mac_learning): Labber'da dinamik MAC girdileri yaşlanmıyordu.
 * IOS dinamik girdiyi son çerçeveden 300 s sonra siler; girdi her trafikte tazelenir.
 */
export class AgingSet extends Set<string> {
  private at = new Map<string, number>()
  /** milisaniye saati: zamanlı kipte runtime sanal saate bağlar (rebase) */
  now: () => number = () => Date.now()
  override add(mac: string): this {
    this.at?.set(mac, this.now?.() ?? Date.now())
    return super.add(mac)
  }
  override delete(mac: string): boolean {
    this.at.delete(mac)
    return super.delete(mac)
  }
  override clear(): void {
    this.at?.clear()
    super.clear()
  }
  /** Süresi dolan dinamik girdileri siler (okunurken: show mac, değerlendirme). */
  /** Bütün girdilerin yaşını `now`dan başlatır (saat kaynağı değişince). */
  rebase(now: number) {
    for (const mac of this) this.at.set(mac, now)
  }
  expire(now = this.now()): void {
    for (const mac of [...this]) {
      const t = this.at.get(mac)
      // kayıttan yüklenen girdinin zamanı yok: yükleme anından sayılır
      if (t === undefined) this.at.set(mac, now)
      else if (now - t >= MAC_AGING_SECONDS * 1000) this.delete(mac)
    }
  }
}

export class LabRuntime {
  topo: Topo
  running: Record<string, SwitchConfig> = {}
  startup: Record<string, SwitchConfig | null> = {}
  pcs: Record<string, PcConfig> = {}
  derived!: Derived
  logs: LogLine[] = []
  /** MACs learned by switches (sources of real traffic); dynamic entries age out (IOS: 300 s) */
  seen = new AgingSet()
  /** I-1: switch başına `clear mac address-table dynamic` ile gizlenen adresler */
  clearedOn = new Map<string, Set<string>>()
  arp = new Set<string>()
  /** 'dev>ip' ARP requests that went unanswered (shown as Incomplete) */
  arpIncomplete = new Set<string>()
  /** err-disabled ports ('dev|port'); sticky until shutdown or errdisable recovery */
  errdis = new Set<string>()
  /** cut cables, powered-off devices, disabled PC NICs (see Hardware) */
  hw: Hardware = noHardwareFaults()
  /**
   * Katman 1: `phys` tanımlı bağlantılardaki switch portlarının sayaçları ('dev|port'). Lab
   * açılışında BOOT_FRAMES arka plan çerçevesi, sonra gerçek trafik (countFrames) ve
   * backgroundTraffic ile deterministik artar; `clear counters` sıfırlar.
   */
  physCounters = new Map<string, PortCounters>()
  /** syslog: cihaz başına günlük tamponu (`show logging`); PC'de yok */
  logBuf = new Map<string, LogEntry[]>()
  /** syslog: cihaz başına yazılan satır sayısı (tampondan düşenler dahil; `show logging`) */
  logLogged = new Map<string, number>()
  /** syslog: zaman damgası sayacı (aynı ana düşen satırlar sırayla ms alır) */
  private logN = 0
  /** syslog: logN'in ait olduğu saat değeri */
  private logAt = 0

  // ---- sanal zaman (aşama 2) ----
  /** sanal saat (saniye); LabDef.clock.start ya da 0 */
  clock = 0
  /**
   * Zamanlı kip: LabDef.clock verilmişse ya da tick/setFlap/schedule/powerOn(bootS) bir kez
   * kullanılmışsa true. Kapalıyken davranış zaman öncesiyle aynıdır (errdisable kurtarması anlık,
   * konsol damgası ve MAC yaşlanması eski kaynaktan).
   */
  timed = false
  /** flap eden linkler ('dev|port' verilen uç) */
  flaps = new Map<string, FlapSpec>()
  /** zamanlanmış olaylar (at, id sırasıyla) */
  private sched: ScheduledEvent[] = []
  private schedSeq = 0
  /** açılış süresindeki cihazlar → hazır olma saati */
  private booting = new Map<string, number>()
  /** err-disable olduğu saat (zamanlı kurtarma) */
  private errSince = new Map<string, number>()
  /** arka plan trafiği kesir birikimi (çerçeve) */
  private bgAcc = 0
  /** hedef id → OK olduğu saat (null: şu an OK değil) */
  private okState = new Map<string, number | null>()
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
  /** L5-d: dynamic NAT translations (no timeout; `clear ip nat translation *` empties it) */
  natTable: NatEntry[] = []
  /** eBGP: komşu başına dondurulmuş politika ('dev|komşu'); oturum kurulunca / clear ip bgp ile alınır */
  bgpApplied: Record<string, { in?: BgpPolicy; out?: BgpPolicy }> = {}
  /** L5-d: packets translated (show ip nat statistics "Hits") */
  natHits = 0
  /** L5-d: packets dropped because the pool had no free address */
  natMisses = 0
  /** FHRP: group key → member id of the current Active/Master (preemption needs history) */
  fhrpActive = new Map<string, string>()
  /** FHRP: member id → last state (for %HSRP/%VRRP state change syslog) */
  fhrpStates = new Map<string, string>()
  /** L5-h: per-line result of a lenient (running-config) initial configuration */
  configReport?: ConfigLine[]
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
    this.natTable = []
    this.bgpApplied = {}
    this.natHits = 0
    this.natMisses = 0
    this.dhcp = []
    this.fhrpActive.clear()
    this.fhrpStates.clear()
    this.hw = noHardwareFaults()
    this.clock = roundT(this.def.clock?.start ?? 0)
    this.timed = !!this.def.clock
    this.flaps.clear()
    this.sched = []
    this.schedSeq = 0
    this.booting.clear()
    this.errSince.clear()
    this.bgAcc = 0
    this.okState.clear()
    this.seen.now = () => (this.timed ? this.clock * 1000 : Date.now())
    for (const l of this.def.links)
      if (l.up === false) for (const [dev, port] of [l.a, l.b]) this.hw.cut.add(pk(dev, port))
    this.initPhys()
    for (const dv of this.def.devices) {
      if (dv.off) this.hw.off.add(dv.id)
      if (dv.kind === 'pc' && dv.nicDown) this.hw.nicDown.add(dv.id)
    }
    this.derived = computeState(this.topo, this.running, this.pcs, this.errdis, this.hw, this.bgpApplied)
    this.applyInitial(this)
    // FHRP: lab başlangıcı bütün üyelerin birlikte açılışıdır (seçim önceliğe göre)
    this.fhrpActive.clear()
    // eBGP: lab başlangıcı açılıştır; oturumlar bütün yapılandırmayla kurulur (satır satır
    // uygulanırken dondurulan politika görüntüleri atılır)
    this.bgpApplied = {}
    this.derived = this.recompute()
    for (const sw of this.topo.switches) this.startup[sw.id] = clone(this.running[sw.id]!)
    this.seen.clear()
    this.clearedOn.clear()
    this.arp.clear()
    this.arpIncomplete.clear()
    this.physCounters.clear()
    this.backgroundTraffic(BOOT_FRAMES, false)
    this.logs = []
    this.logBuf.clear()
    this.logLogged.clear()
    this.logN = 0
    this.logAt = this.clock
    this.emit()
  }

  // ---- Katman 1: hata sayaçları ----

  private counterOf(key: string): PortCounters {
    let c = this.physCounters.get(key)
    if (!c) this.physCounters.set(key, (c = zeroCounters()))
    return c
  }

  /** Bir phys switch portundan çerçeve çıkar / girer (PC ucu sayılmaz). */
  private frame(n: number, from: string, out: string, to: string, inn: string) {
    const tx = this.derived.phys[pk(from, out)]
    if (tx?.l1) this.counterOf(pk(from, out)).tx += n
    const rx = this.derived.phys[pk(to, inn)]
    if (rx?.l1) receive(this.counterOf(pk(to, inn)), n, rx.l1.errPer10k)
  }

  /**
   * Arka plan trafiği (CDP, STP, keepalive): up olan her phys linkinde iki yönde `frames`
   * çerçeve. Lab açılışı BOOT_FRAMES sayar; oyun/arayüz zaman geçişini bununla gösterebilir.
   */
  backgroundTraffic(frames: number, notify = true) {
    if (!this.hw.phys?.size) return
    for (const ps of Object.values(this.derived.phys)) {
      if (!ps.l1 || !ps.up || !ps.peer) continue
      this.frame(frames, ps.peer.dev, ps.peer.port, ps.dev, ps.port)
      if (ps.peerIsPc) this.counterOf(pk(ps.dev, ps.port)).tx += frames
    }
    if (notify) this.emit()
  }

  /**
   * Gerçek trafik (ping, curl): teslimatın her atlamasında geçilen fiziksel kablolar sayılır;
   * `packets` çerçeve başına. Alıcı uçta hata oranına göre CRC artar. Atlamanın çıkış
   * arayüzü (Hop.outIf) göndereni verir. Hatalı çerçevenin düşmesi ping sonucuna yansımaz.
   */
  countFrames(packets: number, forward?: Delivery, back?: Delivery) {
    if (!this.hw.phys?.size || packets <= 0) return
    const d = this.derived
    for (const del of [forward, back])
      for (const h of del?.hops ?? []) {
        const target = l3Ifs(d, h.dev).find((x) => x.ip === h.ip) ?? (fhrpOwns(d, h.dev, h.ip) ? fhrpTarget(d, h.ip, () => true) : null)
        if (!target) continue
        for (const st of physicalPath(d, h.outIf, target) ?? []) this.frame(packets, st.from, st.out, st.to, st.in)
      }
  }

  /** `clear counters [<if>]`: switch'in (ya da tek portun) sayaçları sıfırlanır. */
  clearCounters(dev: string, port?: string) {
    for (const k of [...this.physCounters.keys()]) if (port ? k === pk(dev, port) : k.startsWith(dev + '|')) this.physCounters.set(k, zeroCounters())
    this.log(dev, `%CLEAR-5-COUNTERS: Clear counter on ${port ? 'interface ' + port : 'all interfaces'} by console`)
    this.emit()
  }

  /** Bir portun sayaçları (phys tanımsız portta sıfır). */
  counters(dev: string, port: string): PortCounters {
    return this.physCounters.get(pk(dev, port)) ?? zeroCounters()
  }

  /**
   * Katman 1: LinkDef.phys → hw.phys (yalnız phys tanımlı bağlantılar). SFP yalnız
   * GigabitEthernet portuna takılabilir (Fa portunda SFP yuvası yok: lab yazım hatası).
   */
  private initPhys() {
    for (const l of this.def.links) {
      if (!l.phys) continue
      for (const [side, [dev, port]] of [['a', l.a], ['b', l.b]] as const) {
        const sfp = l.phys.ends?.[side]?.sfp
        if (sfp && this.topo.devices[dev]?.kind === 'switch' && !port.startsWith('GigabitEthernet'))
          throw new Error(`${dev} ${port}: SFP yalnız GigabitEthernet portuna takılabilir`)
      }
      const ka = pk(l.a[0], l.a[1])
      const kb = pk(l.b[0], l.b[1])
      ;(this.hw.phys ??= new Map()).set(linkKey(ka, kb), normalizePhys(l.phys, ka, kb))
    }
  }

  onChange(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  emit() {
    for (const fn of this.listeners) fn()
  }

  timestamp(): string {
    if (this.timed) return this.stampAt(this.clock).stamp
    const ms = Date.now() - this.t0 + 3_723_000
    const h = Math.floor(ms / 3_600_000)
    const m = Math.floor(ms / 60_000) % 60
    const s = Math.floor(ms / 1000) % 60
    const f = ms % 1000
    const two = (n: number) => String(n).padStart(2, '0')
    return `*Mar  1 ${two(h)}:${two(m)}:${two(s)}.${String(f).padStart(3, '0')}`
  }

  /**
   * `log(dev)`: cihazın günlük tamponu (eskiden yeniye, kopya). `log(dev, msg)`: bir syslog
   * satırı yazar: konsol akışına (`rt.logs`, `toConsole` false değilse) ve switch/router'ın
   * tamponuna. Kapalı cihaz yazmaz.
   */
  log(dev: string): LogEntry[]
  log(dev: string, msg: string, toConsole?: boolean): void
  log(dev: string, msg?: string, toConsole = true): LogEntry[] | void {
    if (msg === undefined) return [...(this.logBuf.get(dev) ?? [])]
    if (this.hw.off.has(dev)) return // a powered-off device prints nothing
    if (toConsole) {
      this.logs.push({ dev, text: `${this.timestamp()}: ${msg}`, seq: ++this.seq })
      if (this.logs.length > 400) this.logs.splice(0, this.logs.length - 400)
    }
    if (this.topo.devices[dev]?.kind !== 'switch') return
    const p = parseMessage(msg)
    const { t, stamp } = this.logStamp()
    const buf = this.logBuf.get(dev) ?? []
    buf.push({ t, ...p, line: `${stamp}: ${msg}` })
    trimBuffer(buf, this.running[dev]?.logBufferBytes)
    this.logBuf.set(dev, buf)
    this.logLogged.set(dev, (this.logLogged.get(dev) ?? 0) + 1)
  }

  /**
   * Sanal zaman damgası: saat + aynı ana düşen satırların sırası (ms). Saniyenin kesri ms'e
   * eklenir; 999'da durur. Gerçek saat kullanılmaz.
   */
  private logStamp(): { t: number; stamp: string } {
    const r = this.stampAt(this.clock)
    this.logN++
    return r
  }

  private stampAt(t: number): { t: number; stamp: string } {
    if (t !== this.logAt) {
      this.logAt = t
      this.logN = 0
    }
    const sec = Math.floor(t)
    return { t, stamp: formatStamp(sec, Math.floor(roundT(t - sec) * 1000) + this.logN) }
  }

  /** `clear logging`: cihazın tamponunu boşaltır (yazılan sayacı da sıfırlanır). */
  clearLog(dev: string) {
    this.logBuf.delete(dev)
    this.logLogged.delete(dev)
  }

  /**
   * `clear ip bgp <*|komşu> [soft [in|out]]`: sert sıfırlama kurulu oturumu düşürür ve (yakınsama
   * anlık olduğundan) hemen yeniden kurar; günlükte Down/Up görünür. Soft: oturum düşmez.
   * Kademe 1'de politika (route-map/prefix-list) olmadığından soft sıfırlama tabloyu değiştirmez.
   * Dönüş: eşleşen komşu sayısı (0: böyle komşu yok).
   */
  clearBgp(dev: string, target: string, mode: 'hard' | 'soft' | 'in' | 'out'): number {
    const st = this.derived.bgp?.[dev]
    const cfg = this.running[dev]?.bgp
    if (!st || !cfg) return 0
    const list = st.sessions.filter((s) => target === '*' || s.ip === target)
    const log = cfg.logNeighborChanges ?? true
    for (const s of list.filter((x) => x.state === 'Established')) {
      if (mode === 'hard' && log) {
        this.log(dev, `%BGP-5-ADJCHANGE: neighbor ${s.ip} Down User reset`)
        this.log(dev, `%BGP-5-ADJCHANGE: neighbor ${s.ip} Up `)
      }
      // güncel politika uygulanır: sert sıfırlama ve soft (iki yön) ikisini, soft in/out birini
      const n = cfg.neighbors.find((x) => x.ip === s.ip)!
      const k = dev + '|' + s.ip
      const cur = (this.bgpApplied[k] ??= {})
      if (mode !== 'out') cur.in = resolvePolicy(this.running[dev]!, n, 'in')
      if (mode !== 'in') cur.out = resolvePolicy(this.running[dev]!, n, 'out')
    }
    if (list.length) this.commit()
    return list.length
  }

  /** Recompute after a config change and log what changed. */
  commit() {
    const prev = this.derived
    this.derived = this.recompute()
    this.flushRevlannedPorts(prev)
    this.diffLogs(prev, this.derived)
    this.emit()
  }

  /** Derive, then settle err-disable (BPDU guard) and OSPF router-id selection. */
  private recompute(): Derived {
    let d = computeState(this.topo, this.running, this.pcs, this.errdis, this.hw, this.bgpApplied)
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
      // Katman 1: desteklenmeyen (third-party) modül → gbic-invalid err-disable (IOS: modül
      // takılıyken port açık olduğu sürece; shutdown / no shutdown ile yeniden denetlenir)
      for (const [k, ps] of Object.entries(d.phys)) {
        if (!ps.l1?.unsupported || ps.adminDown || this.errdis.has(k) || this.hw.off.has(ps.dev)) continue
        this.errdis.add(k)
        this.errCause.set(k, 'gbic-invalid')
        this.log(ps.dev, `%PHY-4-UNSUPPORTED_TRANSCEIVER: Unsupported transceiver found in ${shortIf(ps.port)}`)
        this.log(ps.dev, `%PM-4-ERR_DISABLE: gbic-invalid error detected on ${shortIf(ps.port)}, putting ${shortIf(ps.port)} in err-disable state`)
        changed = true
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
        // zaman kullanılmayan labda: bpduguard kurtarması anlık (eski davranış); zamanlı kipte
        // süre dolunca tick() kurtarır (recoverExpired)
        if (this.timed) continue
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
      d = computeState(this.topo, this.running, this.pcs, this.errdis, this.hw, this.bgpApplied)
    }
    // zamanlı kurtarma için err-disable anı
    for (const k of this.errdis) if (!this.errSince.has(k)) this.errSince.set(k, this.clock)
    for (const k of [...this.errSince.keys()]) if (!this.errdis.has(k)) this.errSince.delete(k)
    d.natTable = this.natTable
    d.arpCache = this.arp
    this.freezeBgpPolicy(d)
    // IP SLA + izlenen nesneler (FHRP'den önce: HSRP track'leri nesne durumunu kullanır)
    this.trackChanges(computeTrack(d))
    d.fhrp = computeFhrp(d, this.fhrpActive)
    this.fhrpLog(d.fhrp)
    return d
  }

  /**
   * eBGP politika anlık görüntüsü: kurulu oturumda yoksa yapılandırmadaki politika alınır
   * (oturum açılışı politikayı uygular); kurulu olmayan oturumun görüntüsü silinir (yeniden
   * açılışta güncel politika uygulanır). Kurulu oturumda politika değişirse görüntü değişmez:
   * değişiklik `clear ip bgp` ile uygulanır. Görüntü alınması hesabı değiştirmez (aynı içerik).
   */
  private freezeBgpPolicy(d: Derived) {
    const keep = new Set<string>()
    for (const [dev, st] of Object.entries(d.bgp ?? {}))
      for (const s of st.sessions) {
        const k = dev + '|' + s.ip
        if (s.state !== 'Established') continue
        keep.add(k)
        const n = this.running[dev]!.bgp!.neighbors.find((x) => x.ip === s.ip)!
        if (!this.bgpApplied[k]) this.bgpApplied[k] = { in: resolvePolicy(this.running[dev]!, n, 'in'), out: resolvePolicy(this.running[dev]!, n, 'out') }
      }
    for (const k of Object.keys(this.bgpApplied)) if (!keep.has(k)) delete this.bgpApplied[k]
    d.bgpApplied = this.bgpApplied
  }

  /** İzlenen nesne durum değişikliği sayaçları ('dev|n' → son durum, değişim sayısı). */
  private trackHist = new Map<string, { up: boolean; changes: number }>()
  private trackChanges(t: TrackState) {
    const seen = new Set<string>()
    for (const [dev, objs] of Object.entries(t.objects))
      for (const [n, o] of Object.entries(objs)) {
        const k = dev + '|' + n
        seen.add(k)
        // nesne Down başlar (IOS): ilk Up bir değişikliktir
        const prev = this.trackHist.get(k) ?? { up: false, changes: 0 }
        const changes = prev.changes + (prev.up !== o.up ? 1 : 0)
        this.trackHist.set(k, { up: o.up, changes })
        o.changes = changes
      }
    for (const k of [...this.trackHist.keys()]) if (!seen.has(k)) this.trackHist.delete(k)
  }

  /** FHRP state changes (IOS 15 biçimi; ara Speak/Learn durumları modellenmez). */
  private fhrpQuiet = false
  private fhrpLog(f: FhrpState) {
    const now = new Map<string, string>()
    for (const m of f.members) {
      const id = memberId(m)
      now.set(id, m.state)
      // HSRP: Active'in VIP'i yerel yapılandırmadan farklıysa (koşul yeni oluştuğunda bir kez)
      const g = m.proto === 'hsrp' && m.key ? f.groups.find((x) => x.key === m.key) : undefined
      const diff = g?.active && g.active !== m && g.active.vip !== m.vip ? `diffvip:${g.active.vip}` : ''
      if (diff) now.set(id + '|diffvip', diff)
      if (diff && this.fhrpStates.get(id + '|diffvip') !== diff && !this.fhrpQuiet)
        this.log(m.dev, `%HSRP-4-DIFFVIP1: ${shortIf(m.ifname)} Grp ${m.group} active routers virtual IP address ${g!.active!.vip} is different to the locally configured address ${m.vip}`)
      const was = this.fhrpStates.get(id) ?? 'Init'
      if (was === m.state || this.fhrpQuiet) continue
      const tag = m.proto === 'hsrp' ? '%HSRP-5-STATECHANGE' : '%VRRP-6-STATECHANGE'
      this.log(m.dev, `${tag}: ${shortIf(m.ifname)} Grp ${m.group} state ${was} -> ${m.state}`)
    }
    this.fhrpStates = now
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
   * MotorBulgusu (I-1, test_aglab_mac_learning): IOS, portun access/native VLAN'ı ya da
   * çalışma kipi değişince o portta öğrenilmiş dinamik girdileri siler; adres yeni VLAN'da
   * ancak yeniden trafik gönderince öğrenilir. Labber eski girdiyi yeni VLAN'da gösteriyordu.
   */
  private portSig = new Map<string, string>()
  private flushRevlannedPorts(_prev: Derived) {
    const next = new Map<string, string>()
    for (const [dev, lps] of Object.entries(this.derived.lports))
      for (const lp of lps) next.set(`${dev}|${lp.name}`, `${lp.opMode}/${lp.cfg.accessVlan}/${lp.cfg.nativeVlan}`)
    for (const [k, v] of next) {
      const old = this.portSig.get(k)
      if (old === undefined || old === v) continue
      const [dev, name] = k.split('|') as [string, string]
      for (const e of macTable(this.derived, dev, this.seen)) if (e.port === name) this.seen.delete(e.mac)
    }
    this.portSig = next
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
    // Katman 1: kablonun fiziksel durumu kabloyla gider; taşınan uçtaki modül kabloyla değil
    // porttadır ama modelde uç özelliği kablo ucuna bağlıdır (bkz. UYUMLULUK_MATRISI "Katman 1")
    const peerKey = pk(peer.dev, peer.port)
    const oldKey = linkKey(pk(fromDev, fromPort), peerKey)
    const ph = this.hw.phys?.get(oldKey)
    if (ph) {
      this.hw.phys!.delete(oldKey)
      const ends = { ...ph.ends }
      const moved = ends[pk(fromDev, fromPort)]
      delete ends[pk(fromDev, fromPort)]
      if (moved) ends[pk(toDev, toPort)] = moved
      this.hw.phys!.set(linkKey(pk(toDev, toPort), peerKey), { ...ph, ends })
    }
    this.commit()
    return true
  }

  /** Read-only queries on the current state, including learned MAC addresses. */
  query(): LabQuery {
    this.seen.expire()
    return new LabQuery(this.derived, this.startup, this.seen, this.dhcp, this.logBuf, (devs) => this.configSnapshot(devs))
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
    const ms = this.timed ? Math.floor(this.clock * 1000) : Date.now() - this.t0 + 3_723_000
    const h = Math.floor(ms / 3_600_000) % 24
    const m = Math.floor(ms / 60_000) % 60
    const two = (n: number) => String(n).padStart(2, '0')
    return `Mar 02 1993 ${two(h % 12 === 0 ? 12 : h % 12)}:${two(m)} ${h < 12 ? 'AM' : 'PM'}`
  }

  // ---- Katman 1: teknisyen eylemleri ----

  /** Bu porttaki kablonun fiziksel tanımı (yoksa null). `phys.ends` 'dev|port' anahtarlıdır. */
  physLink(dev: string, port: string): { key: string; here: string; peer: string; phys: LinkPhys } | null {
    const peer = this.topo.peer[pk(dev, port)]
    if (!peer) return null
    const here = pk(dev, port)
    const there = pk(peer.dev, peer.port)
    const key = linkKey(here, there)
    const phys = this.hw.phys?.get(key)
    return phys ? { key, here, peer: there, phys } : null
  }

  private physChange(dev: string, port: string, fn: (p: LinkPhys, here: string) => void): boolean {
    const l = this.physLink(dev, port)
    if (!l) return false
    fn(l.phys, l.here)
    this.commit()
    return true
  }

  /**
   * Kabloyu yenisiyle değiştir (tür/uzunluk; varsayılan sağlam). Yeni kablo takılı gelir,
   * iki ucun konnektörü temizdir ve fiber çifti doğru yöndedir; uçlardaki modüller kalır.
   * phys tanımsız bağlantıda bağlantı fiziksel modele alınır.
   */
  replaceCable(dev: string, port: string, cable: CableSpec): boolean {
    const peer = this.topo.peer[pk(dev, port)]
    if (!peer) return false
    const here = pk(dev, port)
    const there = pk(peer.dev, peer.port)
    const key = linkKey(here, there)
    const old = this.hw.phys?.get(key)
    const ends: LinkPhys['ends'] = {}
    for (const k of [here, there]) {
      const sfp = old?.ends[k]?.sfp
      if (sfp) ends[k] = { sfp: { ...sfp } }
    }
    ;(this.hw.phys ??= new Map()).set(key, { cable: { kind: cable.kind, lengthM: cable.lengthM, ...(cable.damaged ? { damaged: true } : {}), ...(cable.bent ? { bent: true } : {}) }, ends })
    this.hw.cut.delete(here)
    this.hw.cut.delete(there)
    this.commit()
    return true
  }

  /** Bu uçtaki konnektörü temizle (fiber alıcısının ek kaybı kalkar). */
  cleanConnector(dev: string, port: string): boolean {
    return this.physChange(dev, port, (p, here) => {
      if (p.ends[here]) delete p.ends[here]!.connectorDirty
    })
  }

  /**
   * SFP'yi değiştir / tak (`sfp`) ya da çıkar (`null`). Yalnız switch'in GigabitEthernet
   * portunda. gbic-invalid err-disable kendiliğinden kalkmaz (IOS): shutdown / no shutdown.
   */
  replaceSfp(dev: string, port: string, sfp: SfpSpec | null): boolean {
    if (this.topo.devices[dev]?.kind !== 'switch' || !port.startsWith('GigabitEthernet')) return false
    return this.physChange(dev, port, (p, here) => {
      const end = (p.ends[here] ??= {})
      if (sfp) end.sfp = { ...sfp }
      else delete end.sfp
      // modül değişince ferrule yeniden takılır; konnektörün kendisi kirli kalır
    })
  }

  /** Fiber çiftinin TX/RX uçlarını bu uçta çaprazla (ters takılı ise düzelir, düzse bozulur). */
  flipFiber(dev: string, port: string): boolean {
    return this.physChange(dev, port, (p) => {
      if (p.txRxSwapped) delete p.txRxSwapped
      else p.txRxSwapped = true
    })
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
    // açılış süresindeki cihaz: kapatma açılışı iptal eder; açma açılışı hemen bitirir
    if (this.booting.delete(dev) && !on) return void this.commit()
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
      // yeniden başlayan cihazın günlük tamponu RAM'dedir: boşalır
      this.clearLog(dev)
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

  /** L5-d: record translations created by real traffic; `packets` per delivery. */
  recordNat(packets: number, ...ds: (Delivery | undefined)[]) {
    for (const d of ds) {
      if (d?.natMiss) this.natMisses += packets
      this.natHits += packets * (d?.natted ?? 0)
      for (const e of d?.nat ?? [])
        if (!this.natTable.some((x) => JSON.stringify(x) === JSON.stringify(e))) this.natTable.push(e)
    }
    this.derived.natTable = this.natTable
  }

  markSeen(hops: Hop[], from: string) {
    if (!hops.length) return
    hops.forEach((h, i) => {
      this.learn(h.outIf.mac)
      const owner = l3Ifs(this.derived, h.dev).find((x) => x.ip === h.ip)
      if (owner) this.learn(owner.mac)
      // I-1: gönderen (kaynak ya da önceki router) bu atlamanın adresini ARP ile çözdü
      const prev = i === 0 ? from : hops[i - 1]!.dev
      this.arp.add(`${prev}>${h.ip}`)
      this.arpIncomplete.delete(`${prev}>${h.ip}`)
    })
  }

  /**
   * MotorBulgusu (I-1, test_aglab_next_hop): switch'ler yalnız gidiş çerçevelerinden öğreniyordu.
   * Gerçek switch dönüş çerçevelerinin kaynak MAC'ini de öğrenir (asimetrik yolda farklı router).
   */
  markExchange(from: string, forward?: Delivery, back?: Delivery) {
    if (forward) this.markSeen(forward.hops, from)
    if (!back) return
    const replier =
      forward?.kind === 'ok' ? (forward.hops[forward.hops.length - 1]?.dev ?? from) : forward && 'at' in forward ? forward.at : null
    if (replier) this.markSeen(back.hops, replier)
  }

  /** Yeni çerçeve: adres yeniden öğrenilir (temizlenmiş switch'lerde de). */
  private learn(mac: string) {
    this.seen.add(mac)
    for (const hidden of this.clearedOn.values()) hidden.delete(mac)
  }

  /**
   * MotorBulgusu (I-1): `clear mac address-table dynamic` yalnız o switch'in tablosunu
   * temizler (IOS); öğrenilmiş küme lab geneli olduğu için switch başına gizlenir, adres yeni
   * trafikte yeniden görünür (doğrulanmadı: trafiğin o switch'ten geçip geçmediği ayrımı yok).
   */
  clearMacs(dev: string) {
    this.clearedOn.set(dev, new Set(this.seen))
  }

  /** Bir switch'in gördüğü öğrenilmiş adresler (temizlenenler hariç). */
  seenOn(dev: string): Set<string> {
    this.seen.expire()
    const hidden = this.clearedOn.get(dev)
    return hidden?.size ? new Set([...this.seen].filter((m) => !hidden.has(m))) : this.seen
  }

  hostname(dev: string): string {
    return this.running[dev]?.hostname ?? dev
  }

  objectives(): ObjectiveStatus[] {
    const q = this.query()
    const out = this.def.objectives.map((o) => {
      let r: boolean | ObjectiveResult
      try {
        r = o.check(q)
      } catch {
        r = false
      }
      const res = typeof r === 'boolean' ? { ok: r } : r
      return { id: o.id, title: o.title, hint: o.hint, ok: res.ok, detail: res.detail }
    })
    // SLA verisi: OK serisinin başladığı sanal an
    for (const o of out) {
      if (!o.ok) this.okState.set(o.id, null)
      else if ((this.okState.get(o.id) ?? null) === null) this.okState.set(o.id, this.clock)
    }
    return out
  }

  /**
   * Hedef şu an OK ise OK olduğu andan beri kesintisiz geçen sürenin başladığı sanal saat
   * (saniye); OK değilse ya da böyle hedef yoksa null. Değerlendirme tick başında/sonunda, tick
   * içindeki her olaydan sonra ve objectives() çağrısında yapılır (skor oyunun işidir).
   */
  okSince(id: string): number | null {
    if (!this.def.objectives.some((o) => o.id === id)) return null
    if (!this.okState.has(id)) this.objectives()
    return this.okState.get(id) ?? null
  }

  // ---- sanal zaman: tick, flap, zamanlanmış olaylar, açılış ----

  private enterTimed() {
    if (this.timed) return
    this.timed = true
    this.seen.rebase(this.clock * 1000)
    this.logAt = this.clock
    this.logN = 0
  }

  /**
   * Saati `seconds` ilerletir. Aradaki olaylar (zamanlanmış eylemler, flap geçişleri, errdisable
   * kurtarma süreleri, açılış bitişleri) zaman sırasıyla, tam anlarında işlenir; arka plan trafiği
   * (Katman 1 sayaçları) geçen süreyle orantılı sayılır. Hedefler her olaydan sonra değerlendirilir.
   */
  tick(seconds: number) {
    if (!(seconds >= 0) || !Number.isFinite(seconds)) throw new Error('tick: süre negatif olmayan bir sayı olmalı')
    this.enterTimed()
    const end = roundT(this.clock + seconds)
    this.evalObjectives()
    for (let guard = 0; guard < 100000; guard++) {
      const next = this.nextEventAt(end)
      const t = next ?? end
      this.advanceTraffic(t - this.clock)
      this.clock = t
      if (this.runDue()) this.evalObjectives()
      if (next === null) break
    }
    this.evalObjectives()
    this.emit()
  }

  private evalObjectives() {
    if (this.def.objectives.length) this.objectives()
  }

  private advanceTraffic(dt: number) {
    if (dt <= 0 || !this.hw.phys?.size) return
    this.bgAcc += dt * BACKGROUND_FPS
    const n = Math.floor(this.bgAcc + 1e-9)
    this.bgAcc = roundT(this.bgAcc - n)
    if (n > 0) this.backgroundTraffic(n, false)
  }

  /** Vadesi gelmiş iş varsa şimdiki an; yoksa (clock, end] aralığındaki ilk olay anı; yoksa null. */
  private nextEventAt(end: number): number | null {
    if (this.dueNow()) return this.clock
    let best: number | null = null
    const take = (t: number | null) => {
      if (t !== null && t > this.clock && t <= end && (best === null || t < best)) best = t
    }
    for (const e of this.sched) take(e.at)
    for (const t of this.booting.values()) take(t)
    for (const f of this.flaps.values()) take(nextFlapEdge(f, this.clock))
    for (const [k, since] of this.errSince) take(this.recoveryAt(k, since))
    return best
  }

  private dueNow(): boolean {
    const now = this.clock + 1e-9
    if (this.sched.some((e) => e.at <= now)) return true
    if ([...this.booting.values()].some((t) => t <= now)) return true
    for (const [k, since] of this.errSince) {
      const t = this.recoveryAt(k, since)
      if (t !== null && t <= now) return true
    }
    return this.flapMismatch()
  }

  private flapMismatch(): boolean {
    for (const [k, f] of this.flaps) {
      const want = !flapUp(f, this.clock)
      if (want !== !!this.hw.flapDown?.has(k)) return true
    }
    return false
  }

  /** Kurtarma anı: neden kurtarılabilirse err-disable anı + aralık; değilse null. */
  private recoveryAt(k: string, since: number): number | null {
    const dev = k.slice(0, k.indexOf('|'))
    const c = this.running[dev]
    const cause = this.errCause.get(k) ?? 'bpduguard'
    const on = (cause === 'bpduguard' && c?.errRecoveryBpdu) || (cause === 'psecure-violation' && c?.errRecoveryPsecure)
    return on ? roundT(since + (c!.errRecoveryInterval ?? 300)) : null
  }

  /** Vadesi gelen her şeyi işler; değişiklik olduysa true. */
  private runDue(): boolean {
    let did = false
    const now = this.clock + 1e-9
    // 1. açılışı biten cihazlar
    for (const [dev, t] of [...this.booting].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1))) {
      if (t > now) continue
      this.booting.delete(dev)
      this.setPower(dev, true)
      did = true
    }
    // 2. zamanlanmış olaylar (at, id sırası)
    const due = this.sched.filter((e) => e.at <= now)
    if (due.length) {
      this.sched = this.sched.filter((e) => e.at > now)
      for (const e of due) this.apply(e.action)
      did = true
    }
    // 3. errdisable kurtarma süreleri
    for (const [k, since] of [...this.errSince]) {
      const t = this.recoveryAt(k, since)
      if (t === null || t > now || !this.errdis.has(k)) continue
      const [dev, port] = k.split('|') as [string, string]
      const cause = this.errCause.get(k) ?? 'bpduguard'
      this.errdis.delete(k)
      this.errCause.delete(k)
      this.errSince.delete(k)
      this.log(dev, `%PM-4-ERR_RECOVER: Attempting to recover from ${cause} err-disable state on ${shortIf(port)}`)
      this.commit()
      did = true
    }
    // 4. flap fazı
    if (this.flapMismatch()) {
      this.syncFlaps()
      this.commit()
      did = true
    }
    return did
  }

  private apply(a: ScheduledAction) {
    switch (a.type) {
      case 'link':
        return void this.setLink(a.dev, a.port, a.up)
      case 'power':
        return a.on ? this.powerOn(a.dev, a.bootS ? { bootS: a.bootS } : {}) : this.setPower(a.dev, false)
      case 'flap':
        return void this.setFlap(a.dev, a.port, a.flap)
      case 'sfp':
        return void this.replaceSfp(a.dev, a.port, a.sfp)
      case 'cable':
        return void this.replaceCable(a.dev, a.port, a.cable)
    }
  }

  /** flapDown kümesini saatin fazına göre kurar (iki uç). */
  private syncFlaps() {
    const down = new Set<string>()
    for (const [k, f] of this.flaps) {
      if (flapUp(f, this.clock)) continue
      const [dev, port] = k.split('|') as [string, string]
      const peer = this.topo.peer[k]
      down.add(pk(dev, port))
      if (peer) down.add(pk(peer.dev, peer.port))
    }
    if (down.size) this.hw.flapDown = down
    else delete this.hw.flapDown
    // flapDown'ı yalnız flap eden uç anahtarıyla karşılaştırırız (flapMismatch)
  }

  /**
   * Linki periyodik olarak düşür (`flap`) ya da durdur (null). Faz saatten gelir: her periyodun
   * ilk `upS` saniyesi up. Kablo yoksa false.
   */
  setFlap(dev: string, port: string, flap: FlapSpec | null): boolean {
    const k = pk(dev, port)
    const peer = this.topo.peer[k]
    if (!peer) return false
    if (flap && !validFlap(flap)) throw new Error('setFlap: 0 < periodS, 0 ≤ upS ≤ periodS olmalı')
    this.enterTimed()
    this.flaps.delete(k)
    this.flaps.delete(pk(peer.dev, peer.port))
    if (flap) this.flaps.set(k, { periodS: flap.periodS, upS: flap.upS })
    this.syncFlaps()
    this.commit()
    return true
  }

  /** Belirtilen sanal anda bir eylem kur (kaos olayı). Geçmiş an: bir sonraki tick'te çalışır. */
  schedule(at: number, action: ScheduledAction): string {
    if (!Number.isFinite(at)) throw new Error('schedule: geçersiz zaman')
    this.enterTimed()
    const id = 'e' + ++this.schedSeq
    this.sched.push({ id, at: roundT(at), action: JSON.parse(JSON.stringify(action)) as ScheduledAction })
    this.sched.sort((a, b) => a.at - b.at || Number(a.id.slice(1)) - Number(b.id.slice(1)))
    return id
  }

  /** Bekleyen zamanlanmış olaylar (kopya, sıralı). */
  scheduled(): ScheduledEvent[] {
    return JSON.parse(JSON.stringify(this.sched)) as ScheduledEvent[]
  }

  unschedule(id: string): boolean {
    const n = this.sched.length
    this.sched = this.sched.filter((e) => e.id !== id)
    return this.sched.length < n
  }

  /**
   * Cihazı aç. `bootS` verilirse açılış o kadar sürer: cihaz bu sürede kapalı sayılır (konsol
   * cevap vermez, link yok), süre bitince setPower(dev, true) gibi açılır.
   */
  powerOn(dev: string, opts: { bootS?: number } = {}) {
    if (!this.topo.devices[dev]) return
    if (!opts.bootS || opts.bootS <= 0) return this.setPower(dev, true)
    if (!this.hw.off.has(dev) || this.booting.has(dev)) return
    this.enterTimed()
    this.booting.set(dev, roundT(this.clock + opts.bootS))
    this.emit()
  }

  // ---- yapılandırma karşılaştırması (aşama 3) ----

  /**
   * Verilen (ya da bütün) switch/router'ların kanonik running-config'i, kayıt durumu ve Katman 1
   * durumu. Sonuç bağımsız bir kopyadır (JSON'a yazılabilir). Bilinmeyen cihaz: hata.
   */
  configSnapshot(devs?: string[]): ConfigSnapshot {
    const ids = devs ?? this.topo.switches.map((s) => s.id)
    const devices: ConfigSnapshot['devices'] = {}
    for (const id of ids) {
      const def = this.topo.devices[id]
      if (def?.kind !== 'switch') throw new Error(`configSnapshot: ${id} bir switch/router değil`)
      devices[id] = { lines: canonicalConfig(runningConfig(def as SwitchDef, this.running[id]!)), saved: !this.unsavedChanges(id) }
    }
    const phys: ConfigSnapshot['phys'] = {}
    for (const [k, p] of this.hw.phys ?? []) {
      const c = clone(p)
      for (const [e, v] of Object.entries(c.ends)) if (!Object.keys(v).length) delete c.ends[e]
      phys[k] = c
    }
    return { clock: this.clock, devices, phys }
  }

  /** `before` ile `after` (verilmezse şimdiki durum, aynı cihazlar) arasındaki fark. */
  configDiff(before: ConfigSnapshot, after?: ConfigSnapshot): ConfigDiff {
    return diffSnapshots(before, after ?? this.configSnapshot(Object.keys(before.devices)))
  }

  /** running-config startup-config'ten farklı mı (LabQuery.saved'in tersi; startup yoksa true). */
  unsavedChanges(dev: string): boolean {
    const s = this.startup[dev]
    return !s || JSON.stringify(s) !== JSON.stringify(this.running[dev])
  }

  /** Portun err-disable olduğu sanal an (zamanlı kurtarma; yoksa null). */
  errDisabledAt(dev: string, port: string): number | null {
    return this.errSince.get(pk(dev, port)) ?? null
  }

  isBooting(dev: string): boolean {
    return this.booting.has(dev)
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
      nat: clone(this.natTable),
      natHits: this.natHits,
      natMisses: this.natMisses,
      hw: { cut: [...this.hw.cut], off: [...this.hw.off], nicDown: [...this.hw.nicDown], ...(this.hw.phys?.size ? { phys: clone([...this.hw.phys]) } : {}) },
      dhcp: clone(this.dhcp),
      bgpApplied: clone(this.bgpApplied),
      ...(this.physCounters.size ? { physCounters: clone([...this.physCounters]) } : {}),
      ...(this.timed
        ? {
            time: {
              clock: this.clock,
              bgAcc: this.bgAcc,
              flaps: [...this.flaps],
              sched: clone(this.sched),
              schedSeq: this.schedSeq,
              booting: [...this.booting],
              errSince: [...this.errSince],
              okSince: [...this.okState],
            },
          }
        : {}),
      ...(this.logBuf.size ? { syslog: { buf: clone([...this.logBuf]), logged: [...this.logLogged], n: this.logN } } : {}),
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
    this.seen = new AgingSet(s.seen)
    this.arp = new Set(s.arp)
    this.arpIncomplete = new Set(s.arpIncomplete ?? [])
    this.errdis = new Set(s.errdis ?? [])
    this.errCause = new Map(s.errCause ?? [])
    this.psDynamic = new Map(s.psDynamic ?? [])
    this.psViolations = new Map(s.psViolations ?? [])
    this.psLast = new Map(s.psLast ?? [])
    this.aclHits = new Map(s.aclHits ?? [])
    this.natTable = clone(s.nat ?? [])
    this.natHits = s.natHits ?? 0
    this.natMisses = s.natMisses ?? 0
    // Katman 1: kayıtta fiziksel durum yoksa labın tanımındaki (reset) korunur
    if (s.hw) {
      const phys = s.hw.phys ? new Map(clone(s.hw.phys)) : this.hw.phys
      this.hw = { cut: new Set(s.hw.cut), off: new Set(s.hw.off), nicDown: new Set(s.hw.nicDown), ...(phys ? { phys } : {}) }
    }
    this.dhcp = clone(s.dhcp ?? [])
    this.bgpApplied = clone(s.bgpApplied ?? {})
    this.physCounters = new Map(clone(s.physCounters ?? []))
    this.logBuf = new Map(clone(s.syslog?.buf ?? []))
    this.logLogged = new Map(s.syslog?.logged ?? [])
    this.logN = s.syslog?.n ?? 0
    // damga sayacı (n) en son yazılan satırın anına aittir
    this.logAt = Math.max(this.clock, ...[...this.logBuf.values()].flatMap((b) => (b.length ? [b[b.length - 1]!.t] : [])))
    this.seen.now = () => (this.timed ? this.clock * 1000 : Date.now())
    if (s.time) {
      this.timed = true
      this.clock = s.time.clock
      this.bgAcc = s.time.bgAcc
      this.flaps = new Map(s.time.flaps)
      this.sched = clone(s.time.sched)
      this.schedSeq = s.time.schedSeq
      this.booting = new Map(s.time.booting)
      this.errSince = new Map(s.time.errSince)
      this.okState = new Map(s.time.okSince)
      this.seen.rebase(this.clock * 1000)
      this.syncFlaps()
    }
    // FHRP: kayıttan açılış bütün üyelerin birlikte açılışıdır (en yüksek öncelik); log yazılmaz
    this.fhrpActive.clear()
    this.fhrpStates.clear()
    this.fhrpQuiet = true
    this.derived = this.recompute()
    this.fhrpQuiet = false
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
    // STP yeniden yakınsaması (kök, kök portu ya da bloklu portlar değişti): yalnız tampona
    // (konsol akışı eskisi gibi kalır). Yeni görünen VLAN/köprü olay sayılmaz.
    const stpSig = (br: { rootMac: string; rootPort: string | null; ports: Record<string, { state: string }> }) =>
      `${br.rootMac}|${br.rootPort}|${Object.entries(br.ports).filter(([, p]) => p.state === 'BLK').map(([n]) => n).sort().join(',')}`
    for (const [vs, bridges] of Object.entries(b.stp))
      for (const [dev, br] of Object.entries(bridges)) {
        const old = a.stp[Number(vs)]?.[dev]
        if (old && stpSig(old) !== stpSig(br)) this.log(dev, `%SPANTREE-5-TOPOTRAP: Topology Change Trap for vlan ${vs}`, false)
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
    // EIGRP komşulukları ve hello sorunları (IOS 15: EIGRP-IPv4 <AS>; 12.2: IP-EIGRP(0) <AS>)
    for (const dev of new Set([...Object.keys(a.eigrp ?? {}), ...Object.keys(b.eigrp ?? {})])) {
      const as = b.eigrp[dev]?.as ?? a.eigrp[dev]!.as
      const tag = eigrpTag(b, dev, as)
      const key = (n: { ifname: string; ip: string }) => `${n.ifname}|${n.ip}`
      const oldNb = new Map((a.eigrp[dev]?.nbrs ?? []).map((n) => [key(n), n]))
      const newNb = new Map((b.eigrp[dev]?.nbrs ?? []).map((n) => [key(n), n]))
      const why: Record<string, string> = { k: 'K-value mismatch', auth: 'Authentication failure' }
      for (const [k, n] of newNb) {
        const was = oldNb.get(k)
        if (n.ok && !was?.ok) this.log(dev, `%DUAL-5-NBRCHANGE: ${tag}: Neighbor ${n.ip} (${n.ifname}) is up: new adjacency`)
        if (n.ok || (was && !was.ok && was.reason === n.reason)) continue
        if (n.reason === 'k' || n.reason === 'auth') this.log(dev, `%DUAL-5-NBRCHANGE: ${tag}: Neighbor ${n.ip} (${n.ifname}) is down: ${why[n.reason]}`)
        else if (n.reason === 'subnet') this.log(dev, `%DUAL-6-NBRINFO: ${tag}: Neighbor ${n.ip} not on common subnet for ${n.ifname}`)
        else if (was?.ok) this.log(dev, `%DUAL-5-NBRCHANGE: ${tag}: Neighbor ${n.ip} (${n.ifname}) is down: ${n.reason === 'passive' ? 'interface passive' : 'peer restarted'}`)
      }
      for (const [k, n] of oldNb) {
        if (!n.ok || newNb.has(k)) continue
        const ifUp = b.eigrp[dev]?.ifs.some((i) => i.name === n.ifname)
        this.log(dev, `%DUAL-5-NBRCHANGE: ${tag}: Neighbor ${n.ip} (${n.ifname}) is down: ${ifUp ? 'holding time expired' : 'interface down'}`)
      }
    }
    // eBGP oturumları (bgp log-neighbor-changes), OPEN reddi ve MD5 uyuşmazlığı
    for (const dev of new Set([...Object.keys(a.bgp ?? {}), ...Object.keys(b.bgp ?? {})])) {
      const cfg = b.cfgs[dev]?.bgp
      const logChanges = cfg?.logNeighborChanges ?? true
      const old = new Map((a.bgp?.[dev]?.sessions ?? []).map((s) => [s.ip, s]))
      const now = new Map((b.bgp?.[dev]?.sessions ?? []).map((s) => [s.ip, s]))
      const DOWN: Record<string, string> = { admin: 'Admin. shutdown', badas: 'BGP Notification sent', peeradmin: 'BGP Notification received', auth: 'Peer closed the session' }
      for (const [ip, s] of now) {
        const was = old.get(ip)
        if (s.state === 'Established') {
          if (was?.state !== 'Established' && logChanges) this.log(dev, `%BGP-5-ADJCHANGE: neighbor ${ip} Up `)
          continue
        }
        if (was?.state === 'Established' && logChanges) this.log(dev, `%BGP-5-ADJCHANGE: neighbor ${ip} Down ${DOWN[s.reason ?? ''] ?? 'Peer closed the session'}`)
        if (was && was.reason === s.reason && was.notification === s.notification && was.auth === s.auth) continue
        if (s.reason === 'badas') {
          // gönderen: karşının OPEN'ındaki AS bizim remote-as ile uyuşmuyor; alan: tersi
          if (s.notification === 'sent') this.log(dev, `%BGP-3-NOTIFICATION: sent to neighbor ${ip} 2/2 (peer in wrong AS) 2 bytes ${asHex(s.peerAs ?? 0)}`)
          else this.log(dev, `%BGP-3-NOTIFICATION: received from neighbor ${ip} 2/2 (peer in wrong AS) 2 bytes ${asHex(cfg?.as ?? 0)}`)
        }
        // parolası olan uç yazar: karşı başka parola kullanıyorsa Invalid, hiç kullanmıyorsa No
        if (s.reason === 'auth' && s.localIp && s.auth !== 'unexpected')
          this.log(dev, `%TCP-6-BADAUTH: ${s.auth === 'invalid' ? 'Invalid' : 'No'} MD5 digest from ${ip}(179) to ${s.localIp}(11000) tableid - 0`)
      }
      for (const [ip, s] of old) if (!now.has(ip) && s.state === 'Established' && logChanges) this.log(dev, `%BGP-5-ADJCHANGE: neighbor ${ip} Down Neighbor deleted`)
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
