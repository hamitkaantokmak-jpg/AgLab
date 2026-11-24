// Shared types for the switch lab simulator.
// Config types are plain JSON so they can be cloned and stored in localStorage.

export type SwitchportMode = 'access' | 'trunk' | 'dynamic-auto' | 'dynamic-desirable'
export type ChannelMode = 'on' | 'active' | 'passive' | 'desirable' | 'auto'
export type StpMode = 'pvst' | 'rapid-pvst' | 'mst'

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
  /** MST: `spanning-tree mst <örnek> cost <n>` (örnek → maliyet) */
  mstCost?: Record<string, number>
  /** MST: `spanning-tree mst <örnek> port-priority <n>` (örnek → öncelik; varsayılan 128) */
  mstPortPriority?: Record<string, number>
}

/**
 * MST (802.1s) bölge yapılandırması (`spanning-tree mst configuration`) ve örnek öncelikleri.
 * Bölge = ad + revizyon + VLAN→örnek eşlemesi; eşlenmemiş VLAN'lar örnek 0'dadır (IST).
 */
export interface MstConfig {
  name: string
  revision: number
  /** örnek no (1-4094) → eşlenen VLAN'lar (artan) */
  instances: Record<string, number[]>
  /** örnek no (0 dahil) → köprü önceliği (sys-id-ext hariç; varsayılan 32768) */
  priority: Record<string, number>
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
  /** L5-d: `ip nat inside|outside` */
  nat?: 'inside' | 'outside'
  /** L5-c: `ip access-group <acl> in|out` (routed port, subinterface, SVI) */
  aclIn?: string
  aclOut?: string
  /** L5-b: `ip helper-address` list (DHCP relay), in configuration order */
  helpers?: string[]
  /** FHRP: HSRP groups (`standby <grp> …`), in group order */
  hsrp?: HsrpGroup[]
  /** FHRP: VRRP groups (`vrrp <grp> …`), in group order */
  vrrp?: VrrpGroup[]
  /** EIGRP: `delay` (onlarca µs); undefined = arayüz türünün varsayılanı */
  delay?: number
  /** EIGRP: `ip summary-address eigrp <AS> <ağ> <maske>` (yapılandırma sırasıyla) */
  eigrpSummaries?: { as: number; net: string; mask: string }[]
  /** EIGRP: `ip hello-interval eigrp <AS> <s>` (komşuluk şartı değil) */
  eigrpHello?: { as: number; sec: number }
  /** EIGRP: `ip hold-time eigrp <AS> <s>` (komşuluk şartı değil) */
  eigrpHold?: { as: number; sec: number }
  /** EIGRP: `ip authentication mode eigrp <AS> md5` */
  eigrpAuthMd5?: { as: number }
  /** EIGRP: `ip authentication key-chain eigrp <AS> <ad>` */
  eigrpKeyChain?: { as: number; name: string }
}

/** FHRP: `standby <grp> track <obj> [decrement N]` or `standby <grp> track <if> [N]` */
export interface FhrpTrack {
  /** tracked object number (`track N interface … line-protocol`) */
  obj?: number
  /** canonical interface name (interface tracking, no object) */
  iface?: string
  /** priority decrement; undefined = 10 (IOS default) */
  decrement?: number
}

/** FHRP: HSRP version 1 group on an interface. */
export interface HsrpGroup {
  /** 0-255 */
  group: number
  /** `standby <grp> ip <vip>`; null when only other options are configured */
  ip: string | null
  /** `standby <grp> priority N`; undefined = 100 */
  priority?: number
  /** `standby <grp> preempt` (IOS default: off) */
  preempt?: boolean
  tracks?: FhrpTrack[]
}

/** FHRP: VRRP (v2) group on an interface. */
export interface VrrpGroup {
  /** 1-255 */
  group: number
  ip: string | null
  /** `vrrp <grp> priority N` (1-254); undefined = 100; the address owner always uses 255 */
  priority?: number
  /** `no vrrp <grp> preempt` → false (IOS default: on) */
  preempt?: boolean
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

/** L5-c: IPv4 access list. `wild` is the IOS wildcard (any = 0.0.0.0 255.255.255.255). */
export interface AclAddr {
  addr: string
  wild: string
}
export interface AclPort {
  op: 'eq' | 'neq' | 'gt' | 'lt' | 'range'
  a: number
  b?: number
}
export interface AclEntry {
  seq: number
  action: 'permit' | 'deny'
  /** standard lists: 'ip' */
  proto: 'ip' | 'icmp' | 'tcp' | 'udp'
  src: AclAddr
  srcPort?: AclPort
  /** extended lists only (standard lists match the source address) */
  dst?: AclAddr
  dstPort?: AclPort
  /** icmp message type keyword (echo, echo-reply, unreachable, time-exceeded) */
  icmpType?: string
}
export interface Acl {
  type: 'standard' | 'extended'
  entries: AclEntry[]
}

/** L5-d: `ip nat inside source static [tcp|udp] L G [lport gport]` */
export interface NatStatic {
  proto?: 'tcp' | 'udp'
  local: string
  global: string
  lport?: number
  gport?: number
}
/** L5-d: `ip nat inside source list ACL pool NAME|interface IF [overload]` */
export interface NatRule {
  acl: string
  pool?: string
  iface?: string
  overload: boolean
}
export interface NatConfig {
  statics: NatStatic[]
  /** `ip nat pool NAME start end netmask M` */
  pools: Record<string, { start: string; end: string; mask: string }>
  rules: NatRule[]
}

/** L5-e: `switchport port-security …` on an access port. */
export interface PortSecurityConfig {
  /** `switchport port-security` (the other lines may be configured while it is off) */
  enabled: boolean
  /** `maximum N` (default 1) */
  max: number
  violation: 'shutdown' | 'restrict' | 'protect'
  /** `mac-address sticky`: learned addresses become sticky (written to running-config) */
  sticky: boolean
  /** `mac-address H.H.H` (SecureConfigured), canonical dotted */
  macs: string[]
  /** sticky addresses (SecureSticky), canonical dotted */
  stickyMacs: string[]
}

export interface PhysIfConfig extends L2IfConfig {
  /** L5-e: port security (access ports only) */
  portSecurity?: PortSecurityConfig
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
  /** `redistribute static|connected [metric N] [subnets]` (E2 externals; without `subnets` only classful networks) */
  redistribute?: { static?: OspfRedist; connected?: OspfRedist }
  /** area id -> stub settings */
  stubs: Record<string, { noSummary: boolean }>
}

export interface OspfRedist {
  subnets: boolean
  /** E2 metric; undefined = 20 */
  metric?: number
}

/** EIGRP vektör metriği tohum değeri: `default-metric` / `redistribute … metric` */
export interface EigrpSeedMetric {
  /** kbit/s */
  bw: number
  /** onlarca µs */
  delay: number
  rel: number
  load: number
  mtu: number
}

/** Klasik EIGRP (IPv4, AS kipi): `router eigrp <AS>`. */
export interface EigrpConfig {
  as: number
  /** `eigrp router-id` */
  routerId: string | null
  /** `network <ağ> [<wildcard>]`; wildcard null = sınıflı ağ */
  networks: { addr: string; wildcard: string | null }[]
  passiveDefault: boolean
  /** passiveDefault=false: passive arayüzler; true: `no passive-interface` istisnaları */
  passive: string[]
  /** `auto-summary` (oluşturulurken model varsayılanı: Catalyst 12.2 açık, ISR IOS 15 kapalı) */
  autoSummary: boolean
  /** `metric weights 0 k1 k2 k3 k4 k5`; varsayılan [1, 0, 1, 0, 0] */
  k: [number, number, number, number, number]
  /** `variance` (varsayılan 1) */
  variance: number
  /** `maximum-paths` (varsayılan 4) */
  maxPaths: number
  /** `eigrp stub …`; null = stub değil */
  stub: { connected: boolean; summary: boolean; static: boolean; receiveOnly: boolean } | null
  /** `redistribute static|connected [metric …]` */
  redistribute: { static?: { metric?: EigrpSeedMetric }; connected?: { metric?: EigrpSeedMetric } }
  /** `default-metric` */
  defaultMetric: EigrpSeedMetric | null
}

/** `neighbor <ip> …` (router bgp altında; yapılandırma sırası korunur). */
export interface BgpNeighborConfig {
  ip: string
  remoteAs: number
  description?: string
  /** `neighbor … password` (MD5; düz metin saklanır) */
  password?: string
  /** `neighbor … ebgp-multihop [ttl]` (varsayılan 255) */
  ebgpMultihop?: number
  /** `neighbor … update-source <arayüz>` (kanonik ad) */
  updateSource?: string
  /** `neighbor … shutdown` */
  shutdown?: boolean
  /** `neighbor … weight` (bu komşudan öğrenilen yollar) */
  weight?: number
  /** `neighbor … route-map <ad> in|out` (kademe 1b) */
  routeMapIn?: string
  routeMapOut?: string
  /** `neighbor … prefix-list <ad> in|out` (kademe 1b) */
  prefixListIn?: string
  prefixListOut?: string
}

/** `ip prefix-list <ad> [seq N] permit|deny A.B.C.D/n [ge N] [le N]` satırı. */
export interface PrefixListEntry {
  seq: number
  action: 'permit' | 'deny'
  net: string
  len: number
  ge?: number
  le?: number
}

/** `route-map <ad> permit|deny <sıra>` girdisi (BGP politikası için match/set alt kümesi). */
export interface RouteMapEntry {
  seq: number
  action: 'permit' | 'deny'
  /** `match ip address prefix-list <ad>…` */
  matchPrefixLists: string[]
  /** `match ip address <acl>…` (standart: ağ adresi; genişletilmiş: kaynak ağ, hedef maske) */
  matchAcls: string[]
  set: { localPref?: number; metric?: number; weight?: number; prepend?: number[] }
}

/** `router bgp <AS>`: eBGP, IPv4 unicast (kademe 1). */
export interface BgpConfig {
  as: number
  /** `bgp router-id` */
  routerId: string | null
  /** `bgp log-neighbor-changes` (IOS varsayılanı açık; yalnız yazılır) */
  logNeighborChanges: boolean
  /** `bgp default local-preference` (varsayılan 100) */
  defaultLocalPref: number | null
  /** `network <ağ> [mask <maske>]` (sınıflı maske mask'sız yazılır) */
  networks: { net: string; mask: string }[]
  /** `redistribute static|connected [metric N]` (metric: MED) */
  redistribute: { static?: { metric?: number }; connected?: { metric?: number } }
  /** `default-metric` (yeniden dağıtılan yolların MED'i) */
  defaultMetric: number | null
  neighbors: BgpNeighborConfig[]
}

export interface StaticRoute {
  net: string
  mask: string
  /** next hop adresi ya da `Null0` (atılır; özet/duyuru için) */
  nh: string
  /** administrative distance (`ip route … <1-255>`); undefined = 1 */
  ad?: number
  /** `ip route … track <n>`: kurulur yalnız izlenen nesne Up iken */
  track?: number
}

/** IP SLA işlemi (`ip sla <n>`); yalnız icmp-echo modellenir. */
export interface IpSlaConfig {
  /** `icmp-echo <hedef> [source-interface <if> | source-ip <ip>]` (tür girilmeden boş) */
  icmp?: { target: string; srcIf?: string; srcIp?: string }
  /** `frequency <s>` (saklanır; zaman modellenmez) */
  frequency?: number
  /** `ip sla schedule <n> life forever start-time now` */
  scheduled?: boolean
}

/**
 * İzlenen nesne (`track <n> …`): arayüz line-protocol'ü ya da bir IP SLA işlemi.
 * `delay` saklanır ve show'da yazılır; zaman modellenmez.
 */
export interface TrackConfig {
  /** `track <n> interface <if> line-protocol` (kanonik arayüz adı) */
  iface?: string
  /** `track <n> ip sla <sla> [reachability | state]` */
  sla?: number
  kind?: 'reachability' | 'state'
  delayUp?: number
  delayDown?: number
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
  /** MST bölge yapılandırması ve örnek öncelikleri (yapılandırılmadıysa yok) */
  mst?: MstConfig
  ipRouting: boolean
  routes: StaticRoute[]
  defaultGateway: string | null
  loopbacks?: Record<string, LoopbackConfig>
  /** L5-a, routers only: full subinterface name (e.g. GigabitEthernet0/0.10) -> config */
  subifs?: Record<string, SubIfConfig>
  ospf?: OspfConfig | null
  /** klasik EIGRP (tek AS modellenir) */
  eigrp?: EigrpConfig | null
  /** eBGP (kademe 1; bgp.ts) */
  bgp?: BgpConfig | null
  /** `ip prefix-list` (ad → girdiler, sıra numarasına göre) */
  prefixLists?: Record<string, PrefixListEntry[]>
  /** `route-map` (ad → girdiler, sıra numarasına göre) */
  routeMaps?: Record<string, RouteMapEntry[]>
  /** `key chain <ad>` → anahtar no → `key-string` (null: anahtar var, metin yok) */
  keyChains?: Record<string, Record<string, string | null>>
  /** L5-d: NAT (`ip nat inside source …`, `ip nat pool`) */
  nat?: NatConfig
  /** L5-c: access lists by number or name */
  acls?: Record<string, Acl>
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
  /** izlenen nesneler: `track <n> interface <if> line-protocol` | `track <n> ip sla <sla> …` */
  tracks?: Record<string, TrackConfig>
  /** IP SLA işlemleri (`ip sla <n>`) */
  ipSla?: Record<string, IpSlaConfig>
}

export interface PcConfig {
  ip: string | null
  prefix: number
  gw: string | null
  /** L5-b: the address was requested from DHCP (`ip dhcp`); with an APIPA address: no lease */
  dhcp?: boolean
  /** L5-b: DNS server (`ip dns`, or handed out by DHCP) */
  dns?: string | null
  /** L5-b: services of a server (PcDef.server): DHCP (implicit pool) and DNS (lab host names);
   *  L5-g: HTTP (TCP 80) */
  services?: { dhcp?: boolean; dns?: boolean; http?: boolean }
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
  /**
   * Katman 1 modeli (isteğe bağlı): kablo, iki ucun SFP'si, konnektör, fiber yönü. Verilmezse
   * link eskisi gibi yalnız takılı/kopuk olarak değerlendirilir (bkz. phys.ts).
   */
  phys?: LinkPhysSpec
}

// ---- Katman 1 (fiziksel katman; phys.ts) ----

export type CableKind = 'utp-cat5e' | 'utp-cat6' | 'dac' | 'fiber-mm' | 'fiber-sm'
export type SfpType = '1000base-t' | '1000base-sx' | '1000base-lx' | '1000base-zx' | 'dac'

export interface CableSpec {
  kind: CableKind
  lengthM: number
  /** ezilmiş/kesilmiş damar: bakırda hata; fiberde kırık (ışık geçmez) */
  damaged?: boolean
  /** bükülme yarıçapının altında: fiberde ek kayıp (bakırda modellenmez) */
  bent?: boolean
}

export interface SfpSpec {
  type: SfpType
  /** 'third-party': IOS desteklenmeyen modül sayar (port err-disabled, gbic-invalid) */
  vendor?: 'cisco' | 'third-party'
  /** arızalı modül: ışık/sinyal üretmez */
  dead?: boolean
}

export interface PhysEndSpec {
  sfp?: SfpSpec
  /** kirli konnektör: bu ucun alıcısına gelen ışığa ek kayıp (yalnız fiber) */
  connectorDirty?: boolean
}

/** Lab yazarının LinkDef.phys alanı: uçlar LinkDef'in a/b sırasıyla. */
export interface LinkPhysSpec {
  cable: CableSpec
  ends?: { a?: PhysEndSpec; b?: PhysEndSpec }
  /** fiber çiftinin TX/RX'i ters takılmış (bakırda Auto-MDIX: etkisiz) */
  txRxSwapped?: boolean
}

/** Çalışma anındaki biçim: uçlar 'dev|port' anahtarıyla (kablo taşınsa da yön karışmaz). */
export interface LinkPhys {
  cable: CableSpec
  ends: Record<string, PhysEndSpec>
  txRxSwapped?: boolean
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
  /**
   * Katman 1: `phys` tanımlı bağlantıların güncel fiziksel durumu (anahtar: linkKey, iki ucun
   * sıralı 'dev|port' anahtarları). Yok ya da boşsa hiçbir link fiziksel modelle değerlendirilmez.
   */
  phys?: Map<string, LinkPhys>
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
