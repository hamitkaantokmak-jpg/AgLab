// Shared types for the switch lab simulator.
// Config types are plain JSON so they can be cloned and stored in localStorage.

export type SwitchportMode = 'access' | 'trunk' | 'dynamic-auto' | 'dynamic-desirable'
export type ChannelMode = 'on' | 'active' | 'passive' | 'desirable' | 'auto'
export type StpMode = 'pvst' | 'rapid-pvst'

export interface L2IfConfig {
  shutdown: boolean
  description: string
  mode: SwitchportMode
  accessVlan: number
  nativeVlan: number
  /** null = all VLANs allowed */
  allowed: number[] | null
  nonegotiate: boolean
  encapDot1q: boolean
  portfast: boolean
}

export interface IpAddr {
  addr: string
  mask: string
}

/** Per-interface L3 / OSPF settings (routed ports, SVIs, loopbacks). All optional so old saves load. */
export interface L3Opts {
  /** `ip ospf cost` */
  ospfCost?: number
  ospfHello?: number
  ospfDead?: number
  ospfPrio?: number
  ospfNet?: 'point-to-point' | 'broadcast'
  /** `ip ospf <pid> area <a>` */
  ospfArea?: { pid: number; area: number }
  /** `ip mtu` */
  mtu?: number
  /** `bandwidth` in kbit/s */
  bandwidth?: number
}

export interface PhysIfConfig extends L2IfConfig {
  channel: { id: number; mode: ChannelMode } | null
  /** `no switchport` (L3 switches only) */
  routed?: boolean
  /** IP of a routed port */
  ip?: IpAddr | null
  l3?: L3Opts
  /** `spanning-tree bpduguard enable|disable`; undefined = follow the global default */
  bpduguard?: boolean
}

export interface SviConfig {
  shutdown: boolean
  description: string
  ip: IpAddr | null
  l3?: L3Opts
}

export interface LoopbackConfig {
  shutdown: boolean
  description: string
  ip: IpAddr | null
  l3?: L3Opts
}

export interface OspfConfig {
  pid: number
  routerId: string | null
  /** router ID in use; changes only on process start, `clear ip ospf process` or reload */
  activeRid?: string | null
  networks: { addr: string; wildcard: string; area: number }[]
  passiveDefault: boolean
  /** with passiveDefault=false: passive interfaces; with true: `no passive-interface` exceptions */
  passive: string[]
  /** Mbps */
  refBw: number
  defaultOriginate: null | { always: boolean }
  /** area id -> stub settings */
  stubs: Record<string, { noSummary: boolean }>
}

export interface StaticRoute {
  net: string
  mask: string
  nh: string
}

export interface SwitchConfig {
  hostname: string
  /** vlan id -> name */
  vlans: Record<string, string>
  /** canonical physical name -> config */
  ifaces: Record<string, PhysIfConfig>
  /** port-channel number -> config */
  pos: Record<string, L2IfConfig>
  /** vlan id -> SVI config */
  svis: Record<string, SviConfig>
  stpMode: StpMode
  /** vlan id -> bridge priority (without the vlan id added) */
  stpPriority: Record<string, number>
  ipRouting: boolean
  routes: StaticRoute[]
  defaultGateway: string | null
  loopbacks?: Record<string, LoopbackConfig>
  ospf?: OspfConfig | null
  /** `spanning-tree portfast bpduguard default` */
  bpduguardDefault?: boolean
  /** `errdisable recovery cause bpduguard` */
  errRecoveryBpdu?: boolean
  /** `errdisable recovery interval` (seconds) */
  errRecoveryInterval?: number
}

export interface PcConfig {
  ip: string | null
  prefix: number
  gw: string | null
}

// ---- Lab definition (authored by lab writers) ----

export interface SwitchDef {
  id: string
  kind: 'switch'
  /** shown in `show version` and CDP */
  model: string
  /** base MAC, dotted Cisco format, e.g. 5254.0010.0100 */
  mac: string
  /** canonical port names, see ports() helper */
  ports: string[]
  /** multilayer switch: supports `ip routing` */
  l3?: boolean
  /** trunk needs `switchport trunk encapsulation dot1q` first (Catalyst 3560 style) */
  needsEncap?: boolean
  /** powered off at lab start */
  off?: boolean
  x: number
  y: number
}

export interface PcDef {
  id: string
  kind: 'pc'
  mac: string
  /** powered off at lab start */
  off?: boolean
  /** NIC disabled at lab start */
  nicDown?: boolean
  x: number
  y: number
}

export type DeviceDef = SwitchDef | PcDef

export interface LinkDef {
  a: [string, string]
  b: [string, string]
  /** false: cable unplugged / cut at lab start */
  up?: boolean
}

/**
 * Physical state outside the device configs: cut cables, powered-off devices and
 * disabled PC NICs. Changed at runtime by the lab UI, never by CLI commands.
 */
export interface Hardware {
  /** both ends ('dev|port') of every cut cable */
  cut: Set<string>
  /** powered-off devices */
  off: Set<string>
  /** PCs whose NIC is disabled */
  nicDown: Set<string>
}

export const noHardwareFaults = (): Hardware => ({ cut: new Set(), off: new Set(), nicDown: new Set() })

export interface ObjectiveResult {
  ok: boolean
  detail?: string
}

export interface Objective {
  id: string
  title: string
  hint: string
  check: (q: import('./query').LabQuery) => boolean | ObjectiveResult
}

export interface LabDef {
  id: string
  title: string
  summary: string
  level: 'Başlangıç' | 'Orta' | 'İleri'
  tags: string[]
  /** task description paragraphs */
  brief: string[]
  devices: DeviceDef[]
  links: LinkDef[]
  /** IOS commands run in global config mode before the user starts */
  initialConfig?: Record<string, string>
  /** PC addressing at start */
  initialPcs?: Record<string, PcConfig>
  objectives: Objective[]
  /** reference solution as IOS commands per switch (entered from privileged mode) */
  solution: Record<string, string>
  /** SVG viewBox size */
  view: { w: number; h: number }
}
