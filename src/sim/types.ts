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
  /** L5-b: `ip helper-address` list (DHCP relay), in configuration order */
  helpers?: string[]
}

/** L5-b: `ip dhcp pool <name>` on a router or multilayer switch. */
export interface DhcpPool {
  /** `network A.B.C.D mask`; null until configured (the pool serves nothing) */
  net: IpAddr | null
  /** `default-router` */
  defaultRouter: string | null
  /** `dns-server` */
  dns: string | null
}

/** L5-b: a DHCP lease handed out by a server (runtime state, not configuration). */
export interface DhcpBinding {
  /** device that leased the address (router/switch or server) */
  server: string
  /** address the server answered from (the helper address when relayed) */
  serverIp: string
  /** pool name on an IOS device; '' for a server's implicit pool */
  pool: string
  ip: string
  /** client device and its MAC */
  client: string
  mac: string
  /** lease expiration as printed by `show ip dhcp binding` */
  expires: string
}

export interface PhysIfConfig extends L2IfConfig {
  /** L5-f: `no cdp enable` → false (undefined = CDP on the port) */
  cdp?: boolean
  /** L5-f: `no lldp transmit` / `no lldp receive` → false (undefined = on) */
  lldpTx?: boolean
  lldpRx?: boolean
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

/** L5-a: router subinterface (`interface GigabitEthernet0/0.N`). */
export interface SubIfConfig {
  /** canonical physical parent port */
  parent: string
  /** `encapsulation dot1Q <vlan>`; null until configured (IOS refuses `ip address` before it) */
  vlan: number | null
  /** `encapsulation dot1Q <vlan> native`: the subinterface sends and receives untagged */
  native: boolean
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
  /** administrative distance (`ip route … <1-255>`); undefined = 1 */
  ad?: number
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
  /** L5-a, routers only: full subinterface name (e.g. GigabitEthernet0/0.10) -> config */
  subifs?: Record<string, SubIfConfig>
  ospf?: OspfConfig | null
  /** L5-f: `no cdp run` → false (undefined = CDP on, IOS default) */
  cdpRun?: boolean
  /** L5-f: `lldp run` → true (undefined = LLDP off, IOS default) */
  lldpRun?: boolean
  /** `spanning-tree portfast bpduguard default` */
  bpduguardDefault?: boolean
  /** `errdisable recovery cause bpduguard` */
  errRecoveryBpdu?: boolean
  /** `errdisable recovery interval` (seconds) */
  errRecoveryInterval?: number
  /** L5-b: `ip dhcp pool <name>` (configuration order) */
  dhcpPools?: Record<string, DhcpPool>
  /** L5-b: `ip dhcp excluded-address low [high]` */
  dhcpExcluded?: { lo: string; hi: string }[]
}

export interface PcConfig {
  ip: string | null
  prefix: number
  gw: string | null
  /** L5-b: the address was requested from DHCP (`ip dhcp`); with an APIPA address: no lease */
  dhcp?: boolean
  /** L5-b: DNS server (`ip dns`, or handed out by DHCP) */
  dns?: string | null
  /** L5-b: services of a server (PcDef.server): DHCP (implicit pool) and DNS (lab host names) */
  services?: { dhcp?: boolean; dns?: boolean }
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
  /**
   * Router (ISR-style, L4): every port is a routed port, `ip routing` is on by default and
   * there is no VLAN database, STP or switchport configuration. Implies `l3`.
   */
  router?: boolean
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
  /** L5-b: host name (DNS, prompt); the id when missing */
  name?: string
  /** L5-b: a server: may run the DHCP and DNS services (PcConfig.services) */
  server?: boolean
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
