// IOS-like CLI session for one switch.

import { defaultSvi, defaultSwitchConfig, defaultVlanName, pickL2, RESERVED_VLANS } from '../config'
import { arpMac, deliver, l3Ifs, ping, traceProbe } from '../net'
import type { LabRuntime } from '../runtime'
import type { ChannelMode, DhcpPool, NatRule, NatStatic, IpAddr, L2IfConfig, L3Opts, OspfConfig, PhysIfConfig, PortSecurityConfig, SubIfConfig, SwitchConfig, SwitchDef } from '../types'
import { canonIf, clone, ifNum, ipToInt, maskToPrefix, networkOf, normalizeMac, parseVlanList, prefixMaskInt, shortIf } from '../util'
import { buildTrie, complete, help, parse, type Pattern, type TrieNode } from './parser'
import * as show from './show'
import * as disc from '../discovery'
import * as psec from '../portsec'
import * as acl from '../acl'
import * as nat from '../nat'

export type Mode = 'user' | 'priv' | 'config' | 'if' | 'vlan' | 'router' | 'dhcp' | 'acl'

type P = Pattern<IosSession>
type Out = string[] | void

class CliError {
  constructor(public lines: string[]) {}
}
class InvalidAt {
  constructor(public argIndex: number) {}
}

const ALL_VLANS = Array.from({ length: 4094 }, (_, i) => i + 1)
const protoOf = (m: ChannelMode) => (m === 'on' ? 'on' : m === 'active' || m === 'passive' ? 'LACP' : 'PAgP')

// ---------------- command tables ----------------

const showPatterns = (privOnly: boolean): P[] => {
  const s: P[] = [
    { p: 'show version', run: (x) => show.showVersion(x.rt, x.dev) },
    { p: 'show vlan', run: (x) => show.showVlan(x.rt, x.dev, false) },
    { p: 'show vlan brief', run: (x) => show.showVlan(x.rt, x.dev, true) },
    { p: 'show interfaces', run: (x) => x.allInterfaces() },
    { p: 'show interfaces status', run: (x) => show.showIntStatus(x.rt, x.dev) },
    { p: 'show interfaces trunk', run: (x) => show.showIntTrunk(x.rt, x.dev) },
    { p: 'show interfaces switchport', run: (x) => show.showIntSwitchport(x.rt, x.dev) },
    { p: 'show interfaces <if>', run: (x, a) => x.showOneIf(a, false) },
    { p: 'show interfaces <if> switchport', run: (x, a) => x.showOneIf(a, true), ifTypes: ['FastEthernet', 'GigabitEthernet', 'Port-channel'] },
    { p: 'show ip interface brief', run: (x) => show.showIpIntBrief(x.rt, x.dev) },
    { p: 'show ip route', run: (x) => show.showIpRoute(x.rt, x.dev) },
    { p: 'show ip route ospf', run: (x) => show.showIpRoute(x.rt, x.dev, 'O') },
    { p: 'show ip route <A.B.C.D:Network to display information about or host>', run: (x, a) => show.showIpRouteFor(x.rt, x.dev, a[3]!) },
    { p: 'show ip route static', run: (x) => show.showIpRoute(x.rt, x.dev, 'S') },
    { p: 'show ip route connected', run: (x) => show.showIpRoute(x.rt, x.dev, 'C') },
    { p: 'show ip ospf', run: (x) => show.showIpOspf(x.rt, x.dev) },
    { p: 'show ip ospf neighbor', run: (x) => show.showOspfNbr(x.rt, x.dev) },
    { p: 'show ip ospf interface', run: (x) => show.showOspfIf(x.rt, x.dev) },
    { p: 'show ip ospf interface brief', run: (x) => show.showOspfIfBrief(x.rt, x.dev) },
    { p: 'show ip ospf interface <if>', run: (x, a) => show.showOspfIf(x.rt, x.dev, x.resolveName(a[4]!, a[5]!, 4)), ifTypes: ['FastEthernet', 'GigabitEthernet', 'Vlan', 'Loopback'] },
    { p: 'show ip protocols', run: (x) => show.showIpProtocols(x.rt, x.dev) },
    { p: 'show interfaces status err-disabled', run: (x) => show.showErrDisabled(x.rt, x.dev) },
    { p: 'show errdisable recovery', run: (x) => show.showErrRecovery(x.rt, x.dev) },
    { p: 'show ip arp', run: (x) => x.showArp() },
    { p: 'show spanning-tree', run: (x) => show.showSpanningTree(x.rt, x.dev) },
    { p: 'show spanning-tree vlan <1-4094:VLAN Switch Spanning Trees>', run: (x, a) => show.showSpanningTree(x.rt, x.dev, Number(a[3])) },
    { p: 'show etherchannel summary', run: (x) => show.showEtherchannelSummary(x.rt, x.dev) },
    { p: 'show mac address-table', run: (x) => show.showMac(x.rt, x.dev) },
    { p: 'show mac address-table address <H.H.H:48 bit mac address>', run: (x, a) => show.showMac(x.rt, x.dev, normalizeMac(a[4]!)!) },
    { p: 'show cdp neighbors', run: (x) => disc.showCdpNeighbors(x.rt, x.dev, false) },
    { p: 'show cdp neighbors detail', run: (x) => disc.showCdpNeighbors(x.rt, x.dev, true) },
    { p: 'show cdp interface', run: (x) => disc.showCdpInterface(x.rt, x.dev) },
    { p: 'show cdp interface <if>', run: (x, a) => disc.showCdpInterface(x.rt, x.dev, x.physName(a[3]!, a[4]!, 3)), ifTypes: ['FastEthernet', 'GigabitEthernet'] },
    { p: 'show lldp neighbors', run: (x) => disc.showLldpNeighbors(x.rt, x.dev, false) },
    { p: 'show lldp neighbors detail', run: (x) => disc.showLldpNeighbors(x.rt, x.dev, true) },
    { p: 'show port-security', run: (x) => psec.showPortSecurity(x.rt, x.dev) },
    { p: 'show access-lists', run: (x) => acl.showAccessLists(x.cfg, x.dev, x.rt.aclHits) },
    { p: 'show access-lists <WORD:ACL name or number>', run: (x, a) => acl.showAccessLists(x.cfg, x.dev, x.rt.aclHits, a[2]!) },
    { p: 'show ip access-lists', run: (x) => acl.showAccessLists(x.cfg, x.dev, x.rt.aclHits) },
    { p: 'show ip access-lists <WORD:ACL name or number>', run: (x, a) => acl.showAccessLists(x.cfg, x.dev, x.rt.aclHits, a[3]!) },
    { p: 'show ip interface', run: (x) => show.showIpInterface(x.rt, x.dev) },
    // L5-d: NAT (yalnız router; switch'te gizli)
    { p: 'show ip nat translations', run: (x) => nat.showNatTranslations(x.cfg, x.dev, x.rt.natTable) },
    { p: 'show ip nat statistics', run: (x) => x.natStatistics() },
    { p: 'show ip interface <if>', run: (x, a) => show.showIpInterface(x.rt, x.dev, x.resolveL3(a[3]!, a[4]!, 3)) },
    { p: 'show port-security address', run: (x) => psec.showPortSecurityAddress(x.rt, x.dev) },
    { p: 'show port-security interface <if>', run: (x, a) => psec.showPortSecurityInterface(x.rt, x.dev, x.physName(a[3]!, a[4]!, 3)), ifTypes: ['FastEthernet', 'GigabitEthernet'] },
    { p: 'show history', run: (x) => x.history.slice(-20).map((h) => '  ' + h) },
    // L5-b: DHCP server
    { p: 'show ip dhcp binding', run: (x) => show.showDhcpBinding(x.rt, x.dev) },
    { p: 'show ip dhcp pool', run: (x) => show.showDhcpPool(x.rt, x.dev) },
    { p: 'show ip dhcp pool <WORD:Pool name>', run: (x, a) => show.showDhcpPool(x.rt, x.dev, a[4]!) },
  ]
  if (privOnly) {
    s.push(
      { p: 'show running-config', run: (x) => show.showRun(x.rt, x.dev, 'running') },
      { p: 'show running-config interface <if>', run: (x, a) => x.showRunIf(a) },
      { p: 'show startup-config', run: (x) => show.showRun(x.rt, x.dev, 'startup') },
    )
  }
  return s
}

const userPatterns: P[] = [
  { p: 'enable', run: (x) => void (x.mode = 'priv') },
  { p: 'exit', run: (x) => x.logout() },
  { p: 'logout', run: (x) => x.logout() },
  { p: 'ping <A.B.C.D:Ping destination address>', run: (x, a) => x.ping(a[1]!) },
  // L5-i: tek satırlık seçenekler ve etkileşimli extended ping
  { p: 'ping <A.B.C.D:Ping destination address> <LINE:repeat | size | source | timeout …>', run: (x, a) => x.pingOptions(a[1]!, a[2]!) },
  { p: 'ping', run: (x) => x.extendedPing() },
  { p: 'traceroute <A.B.C.D:Trace route to destination address>', run: (x, a) => x.traceroute(a[1]!) },
  { p: 'terminal length <0-512:Number of lines on screen (0 for no pausing)>', run: () => {} },
  ...showPatterns(false),
]

const privPatterns: P[] = [
  ...userPatterns.filter((p) => p.p !== 'enable' && !p.p.startsWith('show')),
  { p: 'enable', run: () => {} },
  { p: 'disable', run: (x) => void (x.mode = 'user') },
  { p: 'configure terminal', run: (x) => x.enterConfig() },
  {
    p: 'configure',
    run: (x) =>
      x.ask('Configuring from terminal, memory, or network [terminal]? ', (ans) =>
        ans.trim() === '' || 'terminal'.startsWith(ans.trim().toLowerCase()) ? (x.enterConfig() ?? []) : ['?Must be "terminal", "memory" or "network"'],
      ),
  },
  { p: 'write', run: (x) => x.save() },
  { p: 'write memory', run: (x) => x.save() },
  { p: 'write erase', run: (x) => x.erase() },
  {
    p: 'copy running-config startup-config',
    run: (x) => x.ask('Destination filename [startup-config]? ', () => x.save()),
  },
  { p: 'erase startup-config', run: (x) => x.erase() },
  { p: 'reload', run: (x) => x.reload() },
  { p: 'clear ip nat translation *', run: (x) => x.clearNat() },
  {
    p: 'clear access-list counters',
    run: (x) => {
      for (const k of [...x.rt.aclHits.keys()]) if (k.startsWith(x.dev + '|')) x.rt.aclHits.delete(k)
    },
  },
  {
    p: 'clear mac address-table dynamic',
    run: (x) => {
      x.rt.clearMacs(x.dev)
      x.rt.emit()
    },
  },
  {
    p: 'clear ip ospf process',
    run: (x) => x.clearOspf(),
  },
  {
    p: 'clear arp-cache',
    run: (x) => {
      for (const k of [...x.rt.arp]) if (k.startsWith(x.dev + '>')) x.rt.arp.delete(k)
      for (const k of [...x.rt.arpIncomplete]) if (k.startsWith(x.dev + '>')) x.rt.arpIncomplete.delete(k)
    },
  },
  { p: 'clear ip dhcp binding *', run: (x) => void x.rt.dhcpClear(x.dev) },
  {
    p: 'clear ip dhcp binding <A.B.C.D:IP address of the binding>',
    run: (x, a) => (x.rt.dhcpClear(x.dev, a[4]!) ? [] : [`% Binding ${a[4]} not found`]),
  },
  ...showPatterns(true),
]

const commonSub: P[] = [
  { p: 'exit', run: (x) => x.exitMode() },
  { p: 'end', run: (x) => x.end() },
  { p: 'do <LINE:Exec Command>', run: (x, a) => x.doCmd(a[1]!) },
]

const configPatterns = (def: SwitchDef): P[] => {
  const p: P[] = [
    ...commonSub,
    {
      p: 'hostname <WORD:This system\'s network name>',
      run: (x, a) => {
        if (!/^[A-Za-z][A-Za-z0-9-]{0,62}$/.test(a[1]!)) return ['% Hostname contains one or more illegal characters.']
        x.cfg.hostname = a[1]!
      },
    },
    { p: 'vlan <vlist:ISL VLAN IDs 1-4094>', run: (x, a) => x.enterVlan(a[1]!) },
    { p: 'no vlan <vlist:ISL VLAN IDs 1-4094>', run: (x, a) => x.deleteVlan(a[2]!) },
    { p: 'interface <if>', run: (x, a) => x.enterIf(a[1]!, a[2]!) },
    { p: 'interface range <LINE:Interface range, e.g. fa0/1 - 4, gi0/1>', run: (x, a) => x.enterRange(a[2]!) },
    {
      p: 'no interface <if>',
      run: (x, a) => x.deleteIf(a[2]!, a[3]!),
      // router: loopback or a subinterface (`no interface Gi0/0.10`)
      ifTypes: def.router ? ['Loopback', 'FastEthernet', 'GigabitEthernet'] : ['Port-channel', 'Vlan', 'Loopback'],
    },
    { p: 'spanning-tree mode pvst', run: (x) => void (x.cfg.stpMode = 'pvst') },
    { p: 'spanning-tree mode rapid-pvst', run: (x) => void (x.cfg.stpMode = 'rapid-pvst') },
    { p: 'no spanning-tree mode', run: (x) => void (x.cfg.stpMode = 'pvst') },
    { p: 'spanning-tree vlan <vlist:VLAN range, example: 1,3-5,7,9-11> priority <0-61440:bridge priority in increments of 4096>', run: (x, a) => x.stpPriority(a[2]!, Number(a[4])) },
    { p: 'spanning-tree vlan <vlist:VLAN range, example: 1,3-5,7,9-11> root primary', run: (x, a) => x.stpRoot(a[2]!, 'primary') },
    { p: 'spanning-tree vlan <vlist:VLAN range, example: 1,3-5,7,9-11> root secondary', run: (x, a) => x.stpRoot(a[2]!, 'secondary') },
    { p: 'no spanning-tree vlan <vlist:VLAN range, example: 1,3-5,7,9-11> priority', run: (x, a) => x.stpClear(a[3]!) },
    { p: 'no spanning-tree vlan <vlist:VLAN range, example: 1,3-5,7,9-11> priority <0-61440:bridge priority>', run: (x, a) => x.stpClear(a[3]!) },
    { p: 'no spanning-tree vlan <vlist:VLAN range, example: 1,3-5,7,9-11> root', run: (x, a) => x.stpClear(a[3]!) },
    { p: 'ip default-gateway <A.B.C.D:IP address of default gateway>', run: (x, a) => void (x.cfg.defaultGateway = a[2]!) },
    { p: 'no ip default-gateway', run: (x) => void (x.cfg.defaultGateway = null) },
    // L5-b: DHCP server
    { p: 'ip dhcp pool <WORD:Pool name>', run: (x, a) => x.enterPool(a[3]!) },
    { p: 'no ip dhcp pool <WORD:Pool name>', run: (x, a) => x.deletePool(a[4]!) },
    { p: 'ip dhcp excluded-address <A.B.C.D:Low IP address>', run: (x, a) => x.dhcpExclude(a[3]!, a[3]!, true) },
    { p: 'ip dhcp excluded-address <A.B.C.D:Low IP address> <A.B.C.D:High IP address>', run: (x, a) => x.dhcpExclude(a[3]!, a[4]!, true) },
    { p: 'no ip dhcp excluded-address <A.B.C.D:Low IP address>', run: (x, a) => x.dhcpExclude(a[4]!, a[4]!, false) },
    { p: 'no ip dhcp excluded-address <A.B.C.D:Low IP address> <A.B.C.D:High IP address>', run: (x, a) => x.dhcpExclude(a[4]!, a[5]!, false) },
    { p: 'no ip domain-lookup', run: () => {} },
    // L5-c: access lists
    { p: 'access-list <1-199:IP access list number> <LINE:permit | deny …>', run: (x, a) => x.aclNumbered(a[1]!, a[2]!) },
    { p: 'no access-list <1-199:IP access list number>', run: (x, a) => void delete x.cfg.acls?.[a[2]!] },
    { p: 'ip access-list standard <WORD:Access-list name>', run: (x, a) => x.enterAcl(a[3]!, 'standard') },
    { p: 'ip access-list extended <WORD:Access-list name>', run: (x, a) => x.enterAcl(a[3]!, 'extended') },
    { p: 'no ip access-list standard <WORD:Access-list name>', run: (x, a) => x.deleteAcl(a[4]!, 'standard') },
    { p: 'no ip access-list extended <WORD:Access-list name>', run: (x, a) => x.deleteAcl(a[4]!, 'extended') },
    // L5-f: CDP (IOS: varsayılan açık), LLDP (varsayılan kapalı)
    { p: 'cdp run', run: (x) => void delete x.cfg.cdpRun },
    { p: 'no cdp run', run: (x) => void (x.cfg.cdpRun = false) },
    { p: 'lldp run', run: (x) => void (x.cfg.lldpRun = true) },
    { p: 'no lldp run', run: (x) => void delete x.cfg.lldpRun },
    { p: 'ip domain-lookup', run: () => {} },
    { p: 'spanning-tree portfast bpduguard default', run: (x) => void (x.cfg.bpduguardDefault = true) },
    { p: 'no spanning-tree portfast bpduguard default', run: (x) => void (x.cfg.bpduguardDefault = false) },
    { p: 'no spanning-tree portfast bpduguard', run: (x) => void (x.cfg.bpduguardDefault = false) },
    { p: 'errdisable recovery cause bpduguard', run: (x) => void (x.cfg.errRecoveryBpdu = true) },
    { p: 'no errdisable recovery cause bpduguard', run: (x) => void (x.cfg.errRecoveryBpdu = false) },
    { p: 'errdisable recovery interval <30-86400:timer-interval(sec)>', run: (x, a) => void (x.cfg.errRecoveryInterval = Number(a[3])) },
    { p: 'no errdisable recovery interval', run: (x) => void delete x.cfg.errRecoveryInterval },
  ]
  if (def.l3 || def.router) {
    p.push(
      { p: 'ip routing', run: (x) => void (x.cfg.ipRouting = true) },
      {
        p: 'no ip routing',
        run: (x) => {
          // IOS drops routing protocol configuration together with ip routing
          x.cfg.ipRouting = false
          x.cfg.ospf = null
        },
      },
      { p: 'router ospf <1-65535:Process ID>', run: (x, a) => x.enterOspf(Number(a[2])) },
      {
        p: 'no router ospf <1-65535:Process ID>',
        run: (x, a) => {
          if (x.cfg.ospf?.pid === Number(a[3])) x.cfg.ospf = null
        },
      },
      { p: 'ip route <A.B.C.D:Destination prefix> <A.B.C.D:Destination prefix mask> <A.B.C.D:Forwarding router\'s address>', run: (x, a) => x.addRoute(a[2]!, a[3]!, a[4]!) },
      {
        p: 'ip route <A.B.C.D:Destination prefix> <A.B.C.D:Destination prefix mask> <A.B.C.D:Forwarding router\'s address> <1-255:Distance metric for this route>',
        run: (x, a) => x.addRoute(a[2]!, a[3]!, a[4]!, Number(a[5])),
      },
      {
        p: 'no ip route <A.B.C.D:Destination prefix> <A.B.C.D:Destination prefix mask>',
        run: (x, a) => x.removeRoute(a[3]!, a[4]!, null),
      },
      {
        p: 'no ip route <A.B.C.D:Destination prefix> <A.B.C.D:Destination prefix mask> <A.B.C.D:Forwarding router\'s address>',
        run: (x, a) => x.removeRoute(a[3]!, a[4]!, a[5]!),
      },
      {
        p: 'no ip route <A.B.C.D:Destination prefix> <A.B.C.D:Destination prefix mask> <A.B.C.D:Forwarding router\'s address> <1-255:Distance metric for this route>',
        run: (x, a) => x.removeRoute(a[3]!, a[4]!, a[5]!),
      },
    )
  }
  if (def.router) {
    // L5-d: NAT/PAT
    const L = '<A.B.C.D:Inside local IP address>', G = '<A.B.C.D:Inside global IP address>'
    const LP = '<1-65535:Local UDP/TCP port>', GP = '<1-65535:Global UDP/TCP port>'
    const ACL = '<WORD:Access list number or name for local addresses>', POOL = '<WORD:Name pool of global addresses>'
    p.push(
      { p: `ip nat inside source static ${L} ${G}`, run: (x, a) => x.natStatic(true, { local: a[5]!, global: a[6]! }) },
      { p: `no ip nat inside source static ${L} ${G}`, run: (x, a) => x.natStatic(false, { local: a[6]!, global: a[7]! }) },
      ...(['tcp', 'udp'] as const).flatMap((pr): P[] => [
        { p: `ip nat inside source static ${pr} ${L} ${LP} ${G} ${GP}`, run: (x, a) => x.natStatic(true, { proto: pr, local: a[6]!, lport: Number(a[7]), global: a[8]!, gport: Number(a[9]) }) },
        { p: `no ip nat inside source static ${pr} ${L} ${LP} ${G} ${GP}`, run: (x, a) => x.natStatic(false, { proto: pr, local: a[7]!, lport: Number(a[8]), global: a[9]!, gport: Number(a[10]) }) },
      ]),
      { p: `ip nat pool ${POOL} <A.B.C.D:Start IP address> <A.B.C.D:End IP address> netmask <A.B.C.D:Network mask>`, run: (x, a) => x.natPool(a[3]!, a[4]!, a[5]!, a[7]!) },
      { p: `no ip nat pool ${POOL}`, run: (x, a) => x.natNoPool(a[4]!) },
      { p: `no ip nat pool ${POOL} <A.B.C.D:Start IP address> <A.B.C.D:End IP address> netmask <A.B.C.D:Network mask>`, run: (x, a) => x.natNoPool(a[4]!) },
      { p: `ip nat inside source list ${ACL} pool ${POOL}`, run: (x, a) => x.natRule({ acl: a[5]!, pool: a[7]!, overload: false }) },
      { p: `ip nat inside source list ${ACL} pool ${POOL} overload`, run: (x, a) => x.natRule({ acl: a[5]!, pool: a[7]!, overload: true }) },
      { p: `ip nat inside source list ${ACL} interface <if>`, run: (x, a) => x.natRule({ acl: a[5]!, iface: x.resolveL3(a[7]!, a[8]!, 7), overload: false }), ifTypes: ['FastEthernet', 'GigabitEthernet'] },
      { p: `ip nat inside source list ${ACL} interface <if> overload`, run: (x, a) => x.natRule({ acl: a[5]!, iface: x.resolveL3(a[7]!, a[8]!, 7), overload: true }), ifTypes: ['FastEthernet', 'GigabitEthernet'] },
      { p: `no ip nat inside source list ${ACL}`, run: (x, a) => x.natNoRule(a[6]!) },
      { p: `no ip nat inside source list ${ACL} pool ${POOL}`, run: (x, a) => x.natNoRule(a[6]!) },
      { p: `no ip nat inside source list ${ACL} pool ${POOL} overload`, run: (x, a) => x.natNoRule(a[6]!) },
      { p: `no ip nat inside source list ${ACL} interface <if>`, run: (x, a) => x.natNoRule(a[6]!), ifTypes: ['FastEthernet', 'GigabitEthernet'] },
      { p: `no ip nat inside source list ${ACL} interface <if> overload`, run: (x, a) => x.natNoRule(a[6]!), ifTypes: ['FastEthernet', 'GigabitEthernet'] },
    )
  }
  // A router has no VLAN database, spanning tree or err-disable recovery (L4).
  return def.router ? p.filter((x) => !ROUTER_HIDDEN_CONFIG.test(x.p)) : p
}

const ROUTER_HIDDEN_CONFIG = /^(no )?(vlan|spanning-tree|errdisable) /
/** Exec commands about L2 switching state that a router does not have. */
/** L5-d: NAT is a router feature (Catalyst access/L3 switches here have no NAT). */
const SWITCH_HIDDEN_SHOW = /^(show|clear) ip nat /
const ROUTER_HIDDEN_SHOW = /^show (vlan|spanning-tree|mac address-table|interfaces (trunk|status|switchport)|interfaces <if> switchport|etherchannel|errdisable|vtp|port-security)/

const l3OptPatterns: P[] = [
  { p: 'ip ospf cost <1-65535:Cost>', run: (x, a) => x.eachL3((o) => void (o.ospfCost = Number(a[3]))) },
  { p: 'no ip ospf cost', run: (x) => x.eachL3((o) => void delete o.ospfCost) },
  { p: 'ip ospf hello-interval <1-65535:Seconds>', run: (x, a) => x.eachL3((o) => void (o.ospfHello = Number(a[3]))) },
  { p: 'no ip ospf hello-interval', run: (x) => x.eachL3((o) => void delete o.ospfHello) },
  { p: 'ip ospf dead-interval <1-65535:Seconds>', run: (x, a) => x.eachL3((o) => void (o.ospfDead = Number(a[3]))) },
  { p: 'no ip ospf dead-interval', run: (x) => x.eachL3((o) => void delete o.ospfDead) },
  { p: 'ip ospf priority <0-255:Priority>', run: (x, a) => x.eachL3((o) => void (o.ospfPrio = Number(a[3]))) },
  { p: 'no ip ospf priority', run: (x) => x.eachL3((o) => void delete o.ospfPrio) },
  { p: 'ip ospf network point-to-point', run: (x) => x.eachL3((o) => void (o.ospfNet = 'point-to-point')) },
  { p: 'ip ospf network broadcast', run: (x) => x.eachL3((o) => void (o.ospfNet = 'broadcast')) },
  { p: 'no ip ospf network', run: (x) => x.eachL3((o) => void delete o.ospfNet) },
  { p: 'ip ospf <1-65535:Process ID> area <0-4294967295:OSPF area ID as a decimal value>', run: (x, a) => x.eachL3((o) => void (o.ospfArea = { pid: Number(a[2]), area: Number(a[4]) })) },
  { p: 'no ip ospf <1-65535:Process ID> area <0-4294967295:OSPF area ID as a decimal value>', run: (x) => x.eachL3((o) => void delete o.ospfArea) },
  { p: 'ip mtu <68-1500:MTU (bytes)>', run: (x, a) => x.eachL3((o) => void (o.mtu = Number(a[2]))) },
  { p: 'no ip mtu', run: (x) => x.eachL3((o) => void delete o.mtu) },
  { p: 'bandwidth <1-10000000:Bandwidth in kilobits>', run: (x, a) => x.eachL3((o) => void (o.bandwidth = Number(a[1]))) },
  { p: 'no bandwidth', run: (x) => x.eachL3((o) => void delete o.bandwidth) },
  // L5-b: DHCP relay
  {
    p: 'ip helper-address <A.B.C.D:IP destination address>',
    run: (x, a) =>
      x.eachL3((o) => {
        const h = (o.helpers ??= [])
        if (!h.includes(a[2]!)) h.push(a[2]!)
      }),
  },
  {
    p: 'no ip helper-address <A.B.C.D:IP destination address>',
    run: (x, a) =>
      x.eachL3((o) => {
        o.helpers = (o.helpers ?? []).filter((h) => h !== a[3])
        if (!o.helpers.length) delete o.helpers
      }),
  },
  { p: 'no ip helper-address', run: (x) => x.eachL3((o) => void delete o.helpers) },
  // L5-c: `ip access-group` (routed port, subinterface, SVI)
  { p: 'ip access-group <WORD:IP access list (standard or extended)> in', run: (x, a) => x.eachL3((o) => void (o.aclIn = a[2]!)) },
  { p: 'ip access-group <WORD:IP access list (standard or extended)> out', run: (x, a) => x.eachL3((o) => void (o.aclOut = a[2]!)) },
  { p: 'no ip access-group <WORD:IP access list (standard or extended)> in', run: (x) => x.eachL3((o) => void delete o.aclIn) },
  { p: 'no ip access-group <WORD:IP access list (standard or extended)> out', run: (x) => x.eachL3((o) => void delete o.aclOut) },
  { p: 'no ip access-group in', run: (x) => x.eachL3((o) => void delete o.aclIn) },
  { p: 'no ip access-group out', run: (x) => x.eachL3((o) => void delete o.aclOut) },
]

const routerPatterns: P[] = [
  ...[
    { p: 'exit', run: (x: IosSession) => x.exitMode() },
    { p: 'end', run: (x: IosSession) => x.end() },
    { p: 'do <LINE:Exec Command>', run: (x: IosSession, a: string[]) => x.doCmd(a[1]!) },
  ],
  { p: 'router-id <A.B.C.D:OSPF router-id in IP address format>', run: (x, a) => x.routerId(a[1]!) },
  { p: 'no router-id', run: (x) => x.routerId(null) },
  {
    p: 'network <A.B.C.D:Network number> <A.B.C.D:OSPF wild card bits> area <0-4294967295:OSPF area ID as a decimal value>',
    run: (x, a) => {
      const o = x.ospf
      const n = { addr: a[1]!, wildcard: a[2]!, area: Number(a[4]) }
      const same = o.networks.find((m) => m.addr === n.addr && m.wildcard === n.wildcard)
      if (same && same.area !== n.area) return [`% OSPF: "network ${n.addr} ${n.wildcard} area ${same.area}" is already configured`]
      if (!same) o.networks.push(n)
    },
  },
  {
    p: 'no network <A.B.C.D:Network number> <A.B.C.D:OSPF wild card bits> area <0-4294967295:OSPF area ID as a decimal value>',
    run: (x, a) => {
      x.ospf.networks = x.ospf.networks.filter((m) => !(m.addr === a[2] && m.wildcard === a[3] && m.area === Number(a[5])))
    },
  },
  { p: 'passive-interface default', run: (x) => void Object.assign(x.ospf, { passiveDefault: true, passive: [] }) },
  { p: 'no passive-interface default', run: (x) => void Object.assign(x.ospf, { passiveDefault: false, passive: [] }) },
  { p: 'passive-interface <if>', run: (x, a) => x.passive(x.resolveName(a[1]!, a[2]!, 1), true), ifTypes: ['FastEthernet', 'GigabitEthernet', 'Vlan', 'Loopback'] },
  { p: 'no passive-interface <if>', run: (x, a) => x.passive(x.resolveName(a[2]!, a[3]!, 2), false), ifTypes: ['FastEthernet', 'GigabitEthernet', 'Vlan', 'Loopback'] },
  {
    p: 'auto-cost reference-bandwidth <1-4294967:The reference bandwidth in terms of Mbits per second>',
    run: (x, a) => {
      x.ospf.refBw = Number(a[2])
      return ['% OSPF: Reference bandwidth is changed.', '        Please ensure reference bandwidth is consistent across all routers.']
    },
  },
  { p: 'no auto-cost reference-bandwidth', run: (x) => void (x.ospf.refBw = 100) },
  { p: 'default-information originate', run: (x) => void (x.ospf.defaultOriginate = { always: false }) },
  { p: 'default-information originate always', run: (x) => void (x.ospf.defaultOriginate = { always: true }) },
  { p: 'no default-information originate', run: (x) => void (x.ospf.defaultOriginate = null) },
  { p: 'area <0-4294967295:OSPF area ID as a decimal value> stub', run: (x, a) => x.stubArea(Number(a[1]), false) },
  { p: 'area <0-4294967295:OSPF area ID as a decimal value> stub no-summary', run: (x, a) => x.stubArea(Number(a[1]), true) },
  {
    p: 'no area <0-4294967295:OSPF area ID as a decimal value> stub',
    run: (x, a) => void delete x.ospf.stubs[a[2]!],
  },
  {
    p: 'no area <0-4294967295:OSPF area ID as a decimal value> stub no-summary',
    run: (x, a) => {
      const st = x.ospf.stubs[a[2]!]
      if (st) st.noSummary = false
    },
  },
]

/** L5-f: CDP/LLDP per physical port (switch and router). */
const discoveryIfPatterns: P[] = [
  { p: 'cdp enable', run: (x) => x.eachPhys((c) => void delete c.cdp) },
  { p: 'no cdp enable', run: (x) => x.eachPhys((c) => void (c.cdp = false)) },
  { p: 'lldp transmit', run: (x) => x.eachPhys((c) => void delete c.lldpTx) },
  { p: 'no lldp transmit', run: (x) => x.eachPhys((c) => void (c.lldpTx = false)) },
  { p: 'lldp receive', run: (x) => x.eachPhys((c) => void delete c.lldpRx) },
  { p: 'no lldp receive', run: (x) => x.eachPhys((c) => void (c.lldpRx = false)) },
]

/** L5-d: `ip nat inside|outside` (router ports and subinterfaces). */
const natIfPatterns: P[] = [
  { p: 'ip nat inside', run: (x) => x.eachL3((o) => void (o.nat = 'inside')) },
  { p: 'ip nat outside', run: (x) => x.eachL3((o) => void (o.nat = 'outside')) },
  { p: 'no ip nat inside', run: (x) => x.eachL3((o) => void (o.nat === 'inside' && delete o.nat)) },
  { p: 'no ip nat outside', run: (x) => x.eachL3((o) => void (o.nat === 'outside' && delete o.nat)) },
]

/** Router port (always routed): no switchport, STP or channel commands. */
const routerIfPatterns: P[] = [
  ...commonSub,
  { p: 'shutdown', run: (x) => x.eachPhys((c) => void (c.shutdown = true)) },
  { p: 'no shutdown', run: (x) => x.eachPhys((c) => void (c.shutdown = false)) },
  { p: 'description <LINE:Up to 240 characters describing this interface>', run: (x, a) => x.eachPhys((c) => void (c.description = a[1]!.slice(0, 240))) },
  { p: 'no description', run: (x) => x.eachPhys((c) => void (c.description = '')) },
  { p: 'ip address <A.B.C.D:IP address> <A.B.C.D:IP subnet mask>', run: (x, a) => x.setIp(a[2]!, a[3]!) },
  { p: 'no ip address', run: (x) => x.eachPhys((c) => void (c.ip = null)) },
  ...l3OptPatterns,
  ...natIfPatterns,
  ...discoveryIfPatterns,
]

/** L5-a: router subinterface (`interface Gi0/0.N`). */
const subIfPatterns: P[] = [
  ...commonSub,
  { p: 'encapsulation dot1Q <1-4094:IEEE 802.1Q VLAN ID>', run: (x, a) => x.encapsulation(Number(a[2]), false) },
  { p: 'encapsulation dot1Q <1-4094:IEEE 802.1Q VLAN ID> native', run: (x, a) => x.encapsulation(Number(a[2]), true) },
  { p: 'no encapsulation dot1Q', run: (x) => x.eachSub((c) => Object.assign(c, { vlan: null, native: false, ip: null })) },
  { p: 'shutdown', run: (x) => x.eachSub((c) => void (c.shutdown = true)) },
  { p: 'no shutdown', run: (x) => x.eachSub((c) => void (c.shutdown = false)) },
  { p: 'description <LINE:Up to 240 characters describing this interface>', run: (x, a) => x.eachSub((c) => void (c.description = a[1]!.slice(0, 240))) },
  { p: 'no description', run: (x) => x.eachSub((c) => void (c.description = '')) },
  { p: 'ip address <A.B.C.D:IP address> <A.B.C.D:IP subnet mask>', run: (x, a) => x.setIp(a[2]!, a[3]!) },
  { p: 'no ip address', run: (x) => x.eachSub((c) => void (c.ip = null)) },
  ...l3OptPatterns,
  ...natIfPatterns,
]

const l2IfPatterns = (def: SwitchDef): P[] => {
  if (def.router) return routerIfPatterns
  const p: P[] = [
    ...commonSub,
    { p: 'shutdown', run: (x) => x.eachL2((c) => void (c.shutdown = true)) },
    { p: 'no shutdown', run: (x) => x.eachL2((c) => void (c.shutdown = false)) },
    { p: 'description <LINE:Up to 240 characters describing this interface>', run: (x, a) => x.eachL2((c) => void (c.description = a[1]!.slice(0, 240)), false) },
    { p: 'no description', run: (x) => x.eachL2((c) => void (c.description = ''), false) },
    { p: 'switchport', run: (x) => x.setRouted(false) },
    { p: 'spanning-tree bpduguard enable', run: (x) => x.eachPhys((c) => void (c.bpduguard = true)) },
    { p: 'spanning-tree bpduguard disable', run: (x) => x.eachPhys((c) => void (c.bpduguard = false)) },
    { p: 'no spanning-tree bpduguard', run: (x) => x.eachPhys((c) => void delete c.bpduguard) },
    { p: 'switchport mode access', run: (x) => x.setMode('access') },
    { p: 'switchport mode trunk', run: (x) => x.setMode('trunk') },
    { p: 'switchport mode dynamic auto', run: (x) => x.setMode('dynamic-auto') },
    { p: 'switchport mode dynamic desirable', run: (x) => x.setMode('dynamic-desirable') },
    { p: 'no switchport mode', run: (x) => x.setMode('dynamic-auto') },
    { p: 'switchport access vlan <1-4094:VLAN ID of the VLAN when this port is in access mode>', run: (x, a) => x.accessVlan(Number(a[3])) },
    { p: 'no switchport access vlan', run: (x) => x.eachL2((c) => void (c.accessVlan = 1)) },
    { p: 'switchport trunk native vlan <1-4094:VLAN ID of the native VLAN when this port is in trunking mode>', run: (x, a) => x.eachL2((c) => void (c.nativeVlan = Number(a[4]))) },
    { p: 'no switchport trunk native vlan', run: (x) => x.eachL2((c) => void (c.nativeVlan = 1)) },
    { p: 'switchport trunk allowed vlan <vlist:VLAN IDs of the allowed VLANs when this port is in trunking mode>', run: (x, a) => x.allowed('set', a[4]!) },
    { p: 'switchport trunk allowed vlan add <vlist:VLAN IDs of the allowed VLANs when this port is in trunking mode>', run: (x, a) => x.allowed('add', a[5]!) },
    { p: 'switchport trunk allowed vlan remove <vlist:VLAN IDs of the allowed VLANs when this port is in trunking mode>', run: (x, a) => x.allowed('remove', a[5]!) },
    { p: 'switchport trunk allowed vlan except <vlist:VLAN IDs of the allowed VLANs when this port is in trunking mode>', run: (x, a) => x.allowed('except', a[5]!) },
    { p: 'switchport trunk allowed vlan all', run: (x) => x.allowed('all', '') },
    { p: 'switchport trunk allowed vlan none', run: (x) => x.allowed('none', '') },
    { p: 'no switchport trunk allowed vlan', run: (x) => x.allowed('all', '') },
    {
      p: 'switchport nonegotiate',
      run: (x) =>
        x.eachL2((c) => {
          if (c.mode.startsWith('dynamic')) throw new CliError(["Command rejected: Conflict between 'nonegotiate' and 'dynamic' status."])
          c.nonegotiate = true
        }),
    },
    { p: 'no switchport nonegotiate', run: (x) => x.eachL2((c) => void (c.nonegotiate = false)) },
    { p: 'spanning-tree portfast', run: (x) => x.eachL2((c) => void (c.portfast = true), false) },
    { p: 'no spanning-tree portfast', run: (x) => x.eachL2((c) => void (c.portfast = false), false) },
    { p: 'channel-group <1-48:Channel group number> mode on', run: (x, a) => x.channelGroup(Number(a[1]), 'on') },
    { p: 'channel-group <1-48:Channel group number> mode active', run: (x, a) => x.channelGroup(Number(a[1]), 'active') },
    { p: 'channel-group <1-48:Channel group number> mode passive', run: (x, a) => x.channelGroup(Number(a[1]), 'passive') },
    { p: 'channel-group <1-48:Channel group number> mode desirable', run: (x, a) => x.channelGroup(Number(a[1]), 'desirable') },
    { p: 'channel-group <1-48:Channel group number> mode auto', run: (x, a) => x.channelGroup(Number(a[1]), 'auto') },
    { p: 'no channel-group', run: (x) => x.noChannelGroup() },
    ...discoveryIfPatterns,
    // L5-e: port security (access ports)
    { p: 'switchport port-security', run: (x) => x.portSec((ps) => void (ps.enabled = true)) },
    { p: 'no switchport port-security', run: (x) => x.portSec((ps) => void (ps.enabled = false)) },
    { p: 'switchport port-security maximum <1-1024:Maximum addresses>', run: (x, a) => x.portSecMax(Number(a[3])) },
    { p: 'no switchport port-security maximum', run: (x) => x.portSecMax(1) },
    { p: 'switchport port-security violation shutdown', run: (x) => x.portSec((ps) => void (ps.violation = 'shutdown')) },
    { p: 'switchport port-security violation restrict', run: (x) => x.portSec((ps) => void (ps.violation = 'restrict')) },
    { p: 'switchport port-security violation protect', run: (x) => x.portSec((ps) => void (ps.violation = 'protect')) },
    { p: 'no switchport port-security violation', run: (x) => x.portSec((ps) => void (ps.violation = 'shutdown')) },
    { p: 'switchport port-security mac-address <H.H.H:48 bit mac address>', run: (x, a) => x.portSecMac(a[3]!, false, true) },
    { p: 'no switchport port-security mac-address <H.H.H:48 bit mac address>', run: (x, a) => x.portSecMac(a[4]!, false, false) },
    { p: 'switchport port-security mac-address sticky', run: (x) => x.portSecSticky(true) },
    { p: 'no switchport port-security mac-address sticky', run: (x) => x.portSecSticky(false) },
    { p: 'switchport port-security mac-address sticky <H.H.H:48 bit mac address>', run: (x, a) => x.portSecMac(a[4]!, true, true) },
    { p: 'no switchport port-security mac-address sticky <H.H.H:48 bit mac address>', run: (x, a) => x.portSecMac(a[5]!, true, false) },
  ]
  if (def.l3) {
    p.push(
      { p: 'no switchport', run: (x) => x.setRouted(true) },
      { p: 'ip address <A.B.C.D:IP address> <A.B.C.D:IP subnet mask>', run: (x, a) => x.setIp(a[2]!, a[3]!) },
      { p: 'no ip address', run: (x) => x.eachPhys((c) => void (c.ip = null)) },
      ...l3OptPatterns,
    )
  }
  if (def.needsEncap) {
    p.push(
      { p: 'switchport trunk encapsulation dot1q', run: (x) => x.eachL2((c) => void (c.encapDot1q = true)) },
      {
        p: 'no switchport trunk encapsulation',
        run: (x) =>
          x.eachL2((c) => {
            if (c.mode === 'trunk') throw new CliError(['Command rejected: An interface whose trunk encapsulation is "Auto" can not be configured to "trunk" mode.'])
            c.encapDot1q = false
          }),
      },
    )
  }
  return p
}

/** L5-c: named access-list sub-mode (`ip access-list standard|extended NAME`). */
const aclPatterns: P[] = [
  ...commonSub,
  { p: 'permit <LINE:permit conditions>', run: (x, a) => x.aclLine(null, 'permit ' + a[1]!, 1) },
  { p: 'deny <LINE:deny conditions>', run: (x, a) => x.aclLine(null, 'deny ' + a[1]!, 1) },
  { p: '<1-2147483647:Sequence Number> permit <LINE:permit conditions>', run: (x, a) => x.aclLine(Number(a[0]), 'permit ' + a[2]!, 2) },
  { p: '<1-2147483647:Sequence Number> deny <LINE:deny conditions>', run: (x, a) => x.aclLine(Number(a[0]), 'deny ' + a[2]!, 2) },
  { p: 'no <1-2147483647:Sequence Number>', run: (x, a) => x.aclNoSeq(Number(a[1])) },
]

const sviPatterns: P[] = [
  ...commonSub,
  { p: 'shutdown', run: (x) => x.eachSvi((s) => void (s.shutdown = true)) },
  { p: 'no shutdown', run: (x) => x.eachSvi((s) => void (s.shutdown = false)) },
  { p: 'description <LINE:Up to 240 characters describing this interface>', run: (x, a) => x.eachSvi((s) => void (s.description = a[1]!)) },
  { p: 'no description', run: (x) => x.eachSvi((s) => void (s.description = '')) },
  { p: 'ip address <A.B.C.D:IP address> <A.B.C.D:IP subnet mask>', run: (x, a) => x.setIp(a[2]!, a[3]!) },
  { p: 'no ip address', run: (x) => x.eachSvi((s) => void (s.ip = null)) },
  ...l3OptPatterns,
]

/** L5-b: `ip dhcp pool <name>` sub-mode. */
const dhcpPoolPatterns: P[] = [
  ...commonSub,
  { p: 'network <A.B.C.D:Network number in dotted-decimal notation> <A.B.C.D:Network mask>', run: (x, a) => x.poolNetwork(a[1]!, a[2]!) },
  { p: 'network <A.B.C.D:Network number in dotted-decimal notation> <WORD:Network mask or prefix length (/nn)>', run: (x, a) => x.poolNetwork(a[1]!, a[2]!) },
  { p: 'no network', run: (x) => void (x.poolCfg.net = null) },
  { p: "default-router <A.B.C.D:Router's IP address>", run: (x, a) => void (x.poolCfg.defaultRouter = a[1]!) },
  { p: 'no default-router', run: (x) => void (x.poolCfg.defaultRouter = null) },
  { p: "dns-server <A.B.C.D:Server's IP address>", run: (x, a) => void (x.poolCfg.dns = a[1]!) },
  { p: 'no dns-server', run: (x) => void (x.poolCfg.dns = null) },
]

const vlanPatterns: P[] = [
  ...commonSub,
  { p: 'name <WORD:The ascii name for the VLAN>', run: (x, a) => x.vlanName(a[1]!) },
  { p: 'no name', run: (x) => x.vlanName(null) },
]

// tries are built once per switch definition
const trieCache = new WeakMap<SwitchDef, Record<Mode | 'svi' | 'subif', TrieNode<IosSession>>>()
function tries(def: SwitchDef) {
  let t = trieCache.get(def)
  if (!t) {
    const exec = (ps: P[]) => ps.filter((x) => !(def.router ? ROUTER_HIDDEN_SHOW : SWITCH_HIDDEN_SHOW).test(x.p))
    t = {
      user: buildTrie(exec(userPatterns)),
      priv: buildTrie(exec(privPatterns)),
      config: buildTrie(configPatterns(def)),
      if: buildTrie(l2IfPatterns(def)),
      svi: buildTrie(sviPatterns),
      subif: buildTrie(subIfPatterns),
      vlan: buildTrie(vlanPatterns),
      router: buildTrie(routerPatterns),
      dhcp: buildTrie(dhcpPoolPatterns),
      acl: buildTrie(aclPatterns),
    }
    trieCache.set(def, t)
  }
  return t
}

// ---------------- session ----------------

export class IosSession {
  mode: Mode = 'user'
  ifs: string[] = []
  range = false
  vlanIds: number[] = []
  /** L5-c: list being edited in `(config-std-nacl)` / `(config-ext-nacl)` */
  aclName = ''
  /** L5-b: pool under `ip dhcp pool <name>` */
  pool = ''
  history: string[] = []
  private pending: { prompt: string; fn: (line: string) => Out } | null = null
  private starts: number[] = []

  constructor(
    public rt: LabRuntime,
    public dev: string,
  ) {}

  get cfg(): SwitchConfig {
    return this.rt.running[this.dev]!
  }
  get def(): SwitchDef {
    return this.rt.topo.devices[this.dev] as SwitchDef
  }

  prompt(): string {
    if (this.pending) return this.pending.prompt
    const h = this.cfg.hostname
    switch (this.mode) {
      case 'user':
        return h + '>'
      case 'priv':
        return h + '#'
      case 'config':
        return h + '(config)#'
      case 'if':
        return h + (this.range ? '(config-if-range)#' : '(config-if)#')
      case 'vlan':
        return h + '(config-vlan)#'
      case 'router':
        return h + '(config-router)#'
      case 'dhcp':
        return h + '(dhcp-config)#'
      case 'acl':
        return h + (this.cfg.acls?.[this.aclName]?.type === 'extended' ? '(config-ext-nacl)#' : '(config-std-nacl)#')
    }
  }

  get inConfig() {
    return this.mode === 'config' || this.mode === 'if' || this.mode === 'vlan' || this.mode === 'router' || this.mode === 'dhcp' || this.mode === 'acl'
  }

  private trie(): TrieNode<IosSession> {
    const t = tries(this.def)
    if (this.mode === 'if' && (this.ifs[0]?.startsWith('Vlan') || this.ifs[0]?.startsWith('Loopback'))) return t.svi
    if (this.mode === 'if' && this.ifs[0]?.includes('.')) return t.subif
    return t[this.mode]
  }

  /** Run one line; returns output lines. */
  exec(raw: string): string[] {
    if (this.pending) {
      const p = this.pending
      this.pending = null
      const out = p.fn(raw) ?? []
      this.rt.commit()
      return out
    }
    const line = raw.replace(/\s+$/, '')
    if (!line.trim() || line.trim().startsWith('!')) return []
    if (line.endsWith('?')) return this.help(line.slice(0, -1))
    this.history.push(line.trim())
    if (this.history.length > 100) this.history.shift()

    // output filter
    let cmd = line
    let filter: ((lines: string[]) => string[]) | null = null
    const bar = line.indexOf('|')
    if (bar >= 0) {
      cmd = line.slice(0, bar)
      const f = /^\s*(\S+)\s+(.+)$/.exec(line.slice(bar + 1))
      const kind = f && ['include', 'exclude', 'begin', 'section'].filter((k) => k.startsWith(f[1]!.toLowerCase()))
      if (!f || !kind || kind.length !== 1) return this.caret(bar + 1 + (line.slice(bar + 1).length - line.slice(bar + 1).trimStart().length))
      let re: RegExp
      try {
        re = new RegExp(f[2]!.trim())
      } catch {
        re = new RegExp(f[2]!.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      }
      filter = (ls) => applyFilter(kind[0]!, re, ls)
    }
    const out = this.run(cmd)
    return filter ? filter(out) : out
  }

  private run(cmd: string): string[] {
    let r = parse(this.trie(), cmd)
    // in a sub-mode, a global config command drops back to config mode (as IOS does)
    if (!r.ok && (this.mode === 'if' || this.mode === 'vlan' || this.mode === 'router' || this.mode === 'dhcp' || this.mode === 'acl') && r.err !== 'empty') {
      const g = parse(tries(this.def).config, cmd)
      if (g.ok) {
        this.mode = 'config'
        this.ifs = []
        this.vlanIds = []
        r = g
      }
    }
    if (!r.ok) {
      if (r.err === 'ambiguous') return [`% Ambiguous command:  "${cmd.trim()}"`]
      if (r.err === 'incomplete') return ['% Incomplete command.', '']
      if (r.err === 'invalid') {
        if (r.at === cmd.length - cmd.trimStart().length && !this.inConfig)
          return ['Translating "' + cmd.trim().split(/\s+/)[0] + '"', '% Unknown command or computer name, or unable to find computer address']
        return this.caret(r.at)
      }
      return []
    }
    this.starts = r.starts
    const before = JSON.stringify([this.rt.running[this.dev], this.rt.startup[this.dev]])
    let out: string[] = []
    try {
      out = r.node.run!(this, r.args) ?? []
    } catch (e) {
      if (e instanceof CliError) out = e.lines
      else if (e instanceof InvalidAt) out = this.caret(this.starts[e.argIndex] ?? 0)
      else throw e
    }
    if (JSON.stringify([this.rt.running[this.dev], this.rt.startup[this.dev]]) !== before) this.rt.commit()
    return out
  }

  private caret(at: number): string[] {
    return [' '.repeat(this.prompt().length + at) + '^', "% Invalid input detected at '^' marker.", '']
  }

  help(line: string): string[] {
    const h = help(this.trie(), line)
    if (Array.isArray(h)) return h
    return this.caret(h.invalidAt)
  }

  complete(line: string): string | null {
    return complete(this.trie(), line)
  }

  /** Ctrl+Z */
  ctrlZ(): string[] {
    if (this.inConfig) {
      this.end()
      this.rt.commit()
    }
    return []
  }

  ask(prompt: string, fn: (line: string) => Out): Out {
    this.pending = { prompt, fn }
  }

  get pendingPrompt(): boolean {
    return !!this.pending
  }

  // ---- mode changes ----

  enterConfig(): Out {
    this.mode = 'config'
    return ['Enter configuration commands, one per line.  End with CNTL/Z.']
  }

  logout(): Out {
    this.mode = 'user'
    return ['', `${this.cfg.hostname} con0 is now available`, '', '', '', '', '', 'Press RETURN to get started.', '']
  }

  exitMode(): Out {
    if (this.mode === 'config') {
      this.mode = 'priv'
      this.rt.log(this.dev, '%SYS-5-CONFIG_I: Configured from console by console')
    } else {
      this.mode = 'config'
      this.ifs = []
      this.vlanIds = []
    }
  }


  end(): Out {
    this.mode = 'priv'
    this.ifs = []
    this.vlanIds = []
    this.rt.log(this.dev, '%SYS-5-CONFIG_I: Configured from console by console')
  }

  doCmd(line: string): Out {
    const shownPrompt = this.prompt().length + (this.starts[1] ?? 3)
    const saved = this.mode
    const savedIfs = this.ifs
    const savedV = this.vlanIds
    const savedRange = this.range
    this.mode = 'priv'
    const shift = shownPrompt - this.prompt().length
    let out: string[]
    try {
      out = this.run(line)
    } finally {
      // `do` never changes the mode, except for commands that leave config entirely
      if (this.mode === 'priv') {
        this.mode = saved
        this.ifs = savedIfs
        this.vlanIds = savedV
        this.range = savedRange
      }
    }
    return out.map((l) => (l.endsWith('^') && !l.trim().slice(0, -1) ? ' '.repeat(shift) + l : l))
  }

  // ---- vlans ----

  enterVlan(list: string): Out {
    const ids = parseVlanList(list)
    if (!ids) throw new InvalidAt(1)
    for (const v of ids) if (this.cfg.vlans[String(v)] === undefined) this.cfg.vlans[String(v)] = defaultVlanName(v)
    this.vlanIds = ids
    this.mode = 'vlan'
  }

  /**
   * `switchport access vlan N`. IOS (VTP server/transparent) creates a missing VLAN:
   * `% Access VLAN does not exist. Creating vlan N`. A VLAN deleted later (`no vlan N`)
   * leaves the port inactive.
   */
  accessVlan(v: number): Out {
    this.eachL2((c) => void (c.accessVlan = v))
    if (this.cfg.vlans[String(v)] !== undefined) return
    this.cfg.vlans[String(v)] = defaultVlanName(v)
    return [`% Access VLAN does not exist. Creating vlan ${v}`]
  }

  deleteVlan(list: string): Out {
    const ids = parseVlanList(list)
    if (!ids) throw new InvalidAt(2)
    const out: string[] = []
    for (const v of ids) {
      if (RESERVED_VLANS.includes(v)) {
        out.push(`%Default VLAN ${v} may not be deleted.`)
        continue
      }
      delete this.cfg.vlans[String(v)]
    }
    return out
  }

  vlanName(name: string | null): Out {
    const out: string[] = []
    for (const v of this.vlanIds) {
      if (RESERVED_VLANS.includes(v)) {
        out.push(`Default VLAN ${v} may not have its name changed.`)
        continue
      }
      this.cfg.vlans[String(v)] = name ? name.slice(0, 32) : defaultVlanName(v)
    }
    return out
  }

  // ---- interfaces ----

  private resolveIf(type: string, num: string, argIndex: number, create: boolean): string {
    const name = canonIf(type, num)
    if (!name) throw new InvalidAt(argIndex)
    // a router has no SVIs or port-channels (L4)
    if (this.def.router && (name.startsWith('Vlan') || name.startsWith('Port-channel'))) throw new InvalidAt(argIndex)
    // L5-a: subinterface Gi0/0.N — routers only, on an existing physical port
    if (name.includes('.')) {
      const [parent, sub] = [name.slice(0, name.indexOf('.')), name.slice(name.indexOf('.') + 1)]
      if (!this.def.router || !this.cfg.ifaces[parent] || !/^\d+$/.test(sub) || Number(sub) < 1 || Number(sub) > 4294967295)
        throw new InvalidAt(argIndex + 1)
      const full = parent + '.' + Number(sub)
      const subs = (this.cfg.subifs ??= {})
      if (create && !subs[full]) subs[full] = { parent, vlan: null, native: false, shutdown: false, description: '', ip: null }
      if (!subs[full]) throw new InvalidAt(argIndex + 1)
      return full
    }
    if (name.startsWith('Vlan')) {
      const v = Number(num)
      if (!/^\d+$/.test(num) || v < 1 || v > 4094) throw new InvalidAt(argIndex + 1)
      if (create && !this.cfg.svis[String(v)]) this.cfg.svis[String(v)] = defaultSvi(v)
      return name
    }
    if (name.startsWith('Loopback')) {
      const n = Number(num)
      if (!/^\d+$/.test(num) || n > 2147483647) throw new InvalidAt(argIndex + 1)
      const lbs = (this.cfg.loopbacks ??= {})
      if (create && !lbs[String(n)]) lbs[String(n)] = { shutdown: false, description: '', ip: null }
      if (!create && !lbs[String(n)]) throw new InvalidAt(argIndex + 1)
      return 'Loopback' + n
    }
    if (name.startsWith('Port-channel')) {
      const n = Number(num)
      if (!/^\d+$/.test(num) || n < 1 || n > 48) throw new InvalidAt(argIndex + 1)
      if (create && !this.cfg.pos[String(n)]) this.cfg.pos[String(n)] = this.newPo()
      return name
    }
    if (!this.cfg.ifaces[name]) throw new InvalidAt(argIndex + 1)
    return name
  }

  private newPo(from?: L2IfConfig): L2IfConfig {
    const base: L2IfConfig = from
      ? pickL2(from)
      : { shutdown: false, description: '', mode: 'dynamic-auto', accessVlan: 1, nativeVlan: 1, allowed: null, nonegotiate: false, encapDot1q: false, portfast: false }
    base.shutdown = false
    base.description = ''
    return base
  }

  // ---- L5-c: access lists ----

  private aclSyntax(e: unknown, argIndex: number): never {
    if (e instanceof acl.AclSyntax) throw new InvalidAt(argIndex)
    throw e
  }

  /** `access-list N permit|deny …`: appended with the next sequence number. */
  // ---- L5-d: NAT ----

  private natCfg() {
    return (this.cfg.nat ??= nat.emptyNat())
  }

  natStatic(add: boolean, s: NatStatic): Out {
    const n = this.natCfg()
    const same = (x: NatStatic) => x.proto === s.proto && x.local === s.local && x.global === s.global && x.lport === s.lport && x.gport === s.gport
    if (!add) {
      const i = n.statics.findIndex(same)
      if (i < 0) return ['%Translation not found']
      n.statics.splice(i, 1)
      return
    }
    if (n.statics.some(same)) return
    const clash = n.statics.find((x) => x.proto === s.proto && (s.proto ? (x.local === s.local && x.lport === s.lport) || (x.global === s.global && x.gport === s.gport) : x.local === s.local || x.global === s.global))
    if (clash) return [`% similar static entry (${clash.local} -> ${clash.global}) already exists`]
    n.statics.push(s)
  }

  natPool(name: string, start: string, end: string, mask: string): Out {
    const m = ipToInt(mask)
    if (maskToPrefix(mask) === null || m === null) throw new InvalidAt(7)
    if ((ipToInt(end)! >>> 0) < (ipToInt(start)! >>> 0)) return ['%End address less than starting address']
    if (((ipToInt(start)! & m) >>> 0) !== ((ipToInt(end)! & m) >>> 0)) return ['%Start and end addresses on different subnets']
    this.natCfg().pools[name] = { start, end, mask }
  }

  natNoPool(name: string): Out {
    const n = this.natCfg()
    if (!n.pools[name]) return [`%Pool ${name} not found`]
    if (n.rules.some((r) => r.pool === name)) return [`%Pool ${name} in use, cannot destroy`]
    delete n.pools[name]
  }

  natRule(r: NatRule): Out {
    const n = this.natCfg()
    const i = n.rules.findIndex((x) => x.acl === r.acl)
    if (i >= 0) n.rules[i] = r
    else n.rules.push(r)
  }

  natNoRule(aclName: string): Out {
    const n = this.natCfg()
    const i = n.rules.findIndex((x) => x.acl === aclName)
    if (i < 0) return ['%Dynamic mapping not found']
    const drop = () => {
      n.rules.splice(i, 1)
      this.rt.natTable.splice(0, this.rt.natTable.length, ...this.rt.natTable.filter((e) => e.dev !== this.dev))
    }
    if (!this.rt.natTable.some((e) => e.dev === this.dev)) return void n.rules.splice(i, 1)
    // IOS asks before removing a mapping with active translations
    return this.ask('%Dynamic mapping in use, do you want to delete all entries? [no]: ', (line) => {
      if (/^y(es?)?$/i.test(line.trim())) drop()
    })
  }

  clearNat(): Out {
    this.rt.natTable.splice(0, this.rt.natTable.length, ...this.rt.natTable.filter((e) => e.dev !== this.dev))
    this.rt.emit()
  }

  natStatistics(): Out {
    const names = (role: 'inside' | 'outside') => {
      const o: string[] = []
      for (const [n, c] of Object.entries(this.cfg.ifaces)) if (c.l3?.nat === role) o.push(n)
      for (const [n, c] of Object.entries(this.cfg.subifs ?? {})) if (c.l3?.nat === role) o.push(n)
      return o
    }
    return nat.showNatStatistics(this.cfg, this.dev, this.rt.natTable, this.rt.natHits, this.rt.natMisses, { inside: names('inside'), outside: names('outside') })
  }

  aclNumbered(num: string, rest: string): Out {
    const kind = acl.aclKind(num)!
    const lists = (this.cfg.acls ??= {})
    const list = (lists[num] ??= { type: kind, entries: [] })
    try {
      return acl.insertEntry(list, acl.parseEntry(rest.trim().split(/\s+/), kind, acl.nextSeq(list)))
    } catch (e) {
      if (!list.entries.length) delete lists[num]
      this.aclSyntax(e, 2)
    }
  }

  enterAcl(name: string, type: 'standard' | 'extended'): Out {
    const num = acl.aclKind(name)
    if (num && num !== type) return [`% Invalid access list number for ${type} list`]
    const lists = (this.cfg.acls ??= {})
    const cur = lists[name]
    if (cur && cur.type !== type) return [`% A named ${cur.type} IP access list with this name already exists`]
    lists[name] ??= { type, entries: [] }
    this.aclName = name
    this.mode = 'acl'
  }

  deleteAcl(name: string, type: 'standard' | 'extended'): Out {
    if (this.cfg.acls?.[name]?.type === type) delete this.cfg.acls[name]
  }

  aclLine(seq: number | null, text: string, argIndex: number): Out {
    const list = this.cfg.acls![this.aclName]!
    try {
      return acl.insertEntry(list, acl.parseEntry(text.trim().split(/\s+/), list.type, seq ?? acl.nextSeq(list)))
    } catch (e) {
      this.aclSyntax(e, argIndex)
    }
  }

  aclNoSeq(seq: number): Out {
    const list = this.cfg.acls![this.aclName]!
    list.entries = list.entries.filter((e) => e.seq !== seq)
  }

  /** An L3 interface name for show commands (physical, subinterface, SVI, loopback). */
  resolveL3(type: string, num: string, argIndex: number): string {
    return this.resolveIf(type, num, argIndex, false)
  }

  // ---- L5-e: port security ----

  /** Apply to the selected ports; IOS rejects port security on trunk and dynamic ports. */
  portSec(fn: (ps: PortSecurityConfig, name: string) => Out): Out {
    const out: string[] = []
    for (const name of this.ifs) {
      const c = this.cfg.ifaces[name]
      if (!c) continue
      if (c.mode !== 'access') throw new CliError([`Command rejected: ${name} is a ${c.mode === 'trunk' ? 'trunk' : 'dynamic'} port.`])
      const r = fn((c.portSecurity ??= psec.defaultPortSecurity()), name)
      if (r) out.push(...r)
    }
    return out.length ? out : undefined
  }

  portSecMax(n: number): Out {
    return this.portSec((ps, name) => {
      const dyn = this.rt.psDynamic.get(`${this.dev}|${name}`) ?? []
      if (n < psec.secureCount(ps, dyn)) return ['Maximum is less than number of currently secured mac-addresses.']
      ps.max = n
    })
  }

  portSecMac(raw: string, sticky: boolean, add: boolean): Out {
    const mac = normalizeMac(raw)
    if (!mac || parseInt(mac.slice(0, 2), 16) % 2 === 1) return ['% Invalid MAC address']
    return this.portSec((ps, name) => {
      const list = sticky ? ps.stickyMacs : ps.macs
      if (!add) {
        const i = list.indexOf(mac)
        if (i >= 0) list.splice(i, 1)
        return
      }
      if (ps.macs.includes(mac) || ps.stickyMacs.includes(mac)) return
      if (ps.macs.length + ps.stickyMacs.length >= ps.max)
        return [`Total secure mac-addresses on interface ${name} has reached maximum limit.`]
      if (sticky) ps.sticky = true
      list.push(mac)
    })
  }

  /** `mac-address sticky`: dynamic addresses become sticky; `no …` turns sticky ones dynamic. */
  portSecSticky(on: boolean): Out {
    return this.portSec((ps, name) => {
      const key = `${this.dev}|${name}`
      if (on) {
        ps.sticky = true
        ps.stickyMacs.push(...(this.rt.psDynamic.get(key) ?? []))
        this.rt.psDynamic.delete(key)
      } else {
        ps.sticky = false
        this.rt.psDynamic.set(key, [...(this.rt.psDynamic.get(key) ?? []), ...ps.stickyMacs])
        ps.stickyMacs = []
      }
    })
  }

  /** A physical port of this device (show commands); anything else is invalid input. */
  physName(type: string, num: string, argIndex: number): string {
    const name = canonIf(type, num)
    if (!name || !this.cfg.ifaces[name]) throw new InvalidAt(argIndex + 1)
    return name
  }

  enterIf(type: string, num: string): Out {
    const name = this.resolveIf(type, num, 1, true)
    this.ifs = [name]
    this.range = false
    this.mode = 'if'
  }

  enterRange(spec: string): Out {
    const names: string[] = []
    const cleaned = spec.replace(/\s*-\s*/g, '-').replace(/\s*,\s*/g, ',')
    for (const part of cleaned.split(',')) {
      // bitiş yalnız numara (`Fa0/1 - 3`) ya da aynı tür ve yuvayla tam ad (`Gi0/1 - Gi0/2`;
      // doğrulanmadı: IOS sürümüne göre)
      const m = /^([A-Za-z-]+)\s*(\d+\/)?(\d+)(?:-(?:([A-Za-z-]+)\s*(\d+\/)?)?(\d+))?$/.exec(part.trim())
      if (!m) throw new InvalidAt(2)
      if (m[4] && (canonIf(m[4], (m[5] ?? '') + m[6]) !== canonIf(m[1]!, (m[2] ?? '') + m[6]) || (m[5] ?? '') !== (m[2] ?? '')))
        throw new InvalidAt(2)
      const from = Number(m[3])
      const to = m[6] ? Number(m[6]) : from
      if (to < from) throw new InvalidAt(2)
      for (let i = from; i <= to; i++) {
        const name = canonIf(m[1]!, (m[2] ?? '') + i)
        if (!name || name.startsWith('Vlan') || name.startsWith('Port-channel') || !this.cfg.ifaces[name]) throw new InvalidAt(2)
        names.push(name)
      }
    }
    this.ifs = names
    this.range = true
    this.mode = 'if'
  }

  deleteIf(type: string, num: string): Out {
    const name = this.resolveIf(type, num, 2, false)
    if (name.startsWith('Vlan')) {
      if (num === '1') return ['% Not allowed to remove Vlan1']
      delete this.cfg.svis[num]
    } else if (name.startsWith('Loopback')) {
      delete this.cfg.loopbacks?.[ifNum(name)]
    } else if (name.includes('.')) {
      delete this.cfg.subifs?.[name]
    } else if (this.def.router) {
      // a router's physical port cannot be deleted
      return ['% Removal of physical interfaces is not permitted']
    } else {
      delete this.cfg.pos[num]
      for (const c of Object.values(this.cfg.ifaces)) if (c.channel?.id === Number(num)) c.channel = null
    }
  }

  /** Apply to selected L2 interfaces; port-channel changes propagate to members. */
  eachL2(fn: (c: L2IfConfig, name: string) => void, propagate = true): Out {
    for (const name of this.ifs) {
      if (name.startsWith('Port-channel')) {
        const id = ifNum(name)
        fn(this.cfg.pos[id]!, name)
        if (propagate)
          for (const [m, c] of Object.entries(this.cfg.ifaces)) if (c.channel?.id === Number(id)) fn(c, m)
      } else fn(this.cfg.ifaces[name]!, name)
    }
  }

  /** SVI or loopback under the cursor (same shape). */
  eachSvi(fn: (s: { shutdown: boolean; description: string; ip: IpAddr | null; l3?: L3Opts }) => void): Out {
    for (const name of this.ifs) fn(name.startsWith('Loopback') ? this.cfg.loopbacks![ifNum(name)]! : this.cfg.svis[ifNum(name)]!)
  }

  /** Physical ports only (port-channels are skipped). */
  eachPhys(fn: (c: PhysIfConfig, name: string) => void): Out {
    for (const name of this.ifs) {
      const c = this.cfg.ifaces[name]
      if (c) fn(c, name)
    }
  }

  /** L3 options of the selected interfaces; physical ports must be routed. */
  /** L5-a: subinterface under the cursor. */
  eachSub(fn: (c: SubIfConfig) => void): Out {
    for (const name of this.ifs) {
      const c = this.cfg.subifs?.[name]
      if (c) fn(c)
    }
  }

  /** `encapsulation dot1Q <vlan> [native]`: one VLAN per subinterface and per parent. */
  encapsulation(vlan: number, native: boolean): Out {
    const name = this.ifs[0]!
    const me = this.cfg.subifs![name]!
    for (const [other, c] of Object.entries(this.cfg.subifs ?? {})) {
      if (other === name || c.parent !== me.parent) continue
      if (c.vlan === vlan)
        return [`% Configuration of multiple subinterfaces of the same main interface with the same VID (${vlan}) is not permitted.`, `This VID is already configured on ${other}.`]
      if (native && c.native) return [`% Native VLAN is already configured on ${other}.`]
    }
    me.vlan = vlan
    me.native = native
  }

  eachL3(fn: (o: L3Opts) => void): Out {
    for (const name of this.ifs) {
      if (name.includes('.')) {
        this.eachSub((c) => fn((c.l3 ??= {})))
        return
      }
      if (name.startsWith('Vlan') || name.startsWith('Loopback')) {
        this.eachSvi((s) => fn((s.l3 ??= {})))
        return
      }
      const c = this.cfg.ifaces[name]
      if (!c) continue
      if (!c.routed) throw new CliError(['% IP addresses may not be configured on L2 links.'])
      fn((c.l3 ??= {}))
    }
  }

  setRouted(on: boolean): Out {
    for (const name of this.ifs) {
      if (name.startsWith('Port-channel')) return ['% Routed EtherChannel is not modelled in this lab.']
    }
    this.eachPhys((c) => {
      if (on && c.channel) throw new CliError(['% Remove the channel-group first (routed EtherChannel is not modelled).'])
      if (on === !!c.routed) return
      c.routed = on
      // changing the port type wipes its L3 settings (as IOS does)
      c.ip = null
      delete c.l3
    })
  }

  resolveName(type: string, num: string, argIndex: number): string {
    return this.resolveIf(type, num, argIndex, false)
  }

  setMode(mode: L2IfConfig['mode']): Out {
    this.eachL2((c) => {
      if (mode === 'trunk' && this.def.needsEncap && !c.encapDot1q)
        throw new CliError(['Command rejected: An interface whose trunk encapsulation is "Auto" can not be configured to "trunk" mode.'])
      if (mode.startsWith('dynamic') && c.nonegotiate) throw new CliError(["Command rejected: Conflict between 'nonegotiate' and 'dynamic' status."])
      c.mode = mode
    })
  }

  allowed(op: 'set' | 'add' | 'remove' | 'except' | 'all' | 'none', list: string): Out {
    const ids = op === 'all' || op === 'none' ? [] : parseVlanList(list)
    if (!ids) throw new InvalidAt(op === 'set' ? 4 : 5)
    this.eachL2((c) => {
      const cur = c.allowed ?? ALL_VLANS
      let next: number[] | null
      if (op === 'set') next = ids
      else if (op === 'add') next = c.allowed === null ? null : [...new Set([...cur, ...ids])].sort((a, b) => a - b)
      else if (op === 'remove') next = cur.filter((v) => !ids.includes(v))
      else if (op === 'except') next = ALL_VLANS.filter((v) => !ids.includes(v))
      else if (op === 'all') next = null
      else next = []
      if (next && next.length === 4094) next = null
      c.allowed = next
    })
  }

  channelGroup(id: number, mode: ChannelMode): Out {
    const out: string[] = []
    for (const name of this.ifs) {
      if (!this.cfg.ifaces[name]) return this.caretAt(0)
      if (this.cfg.ifaces[name]!.routed) return ['% Routed EtherChannel is not modelled in this lab; use switchport first.']
      const others = Object.entries(this.cfg.ifaces).filter(([n, c]) => n !== name && c.channel?.id === id)
      if (others.length && protoOf(others[0]![1].channel!.mode) !== protoOf(mode)) {
        out.push(`Command rejected (Channel protocol mismatch for interface ${shortIf(name)} in group ${id}): the interface can not be added to the channel group`)
        continue
      }
      const c: PhysIfConfig = this.cfg.ifaces[name]!
      if (!this.cfg.pos[String(id)]) {
        this.cfg.pos[String(id)] = this.newPo(c)
        out.push(`Creating a port-channel interface Port-channel ${id}`, '')
      }
      c.channel = { id, mode }
    }
    return out
  }

  private caretAt(i: number): string[] {
    return this.caret(this.starts[i] ?? 0)
  }

  noChannelGroup(): Out {
    for (const name of this.ifs) {
      const c = this.cfg.ifaces[name]
      if (c) c.channel = null
    }
  }

  /** All configured IP interfaces of this switch: name -> address. */
  private ipIfs(): [string, IpAddr][] {
    const out: [string, IpAddr][] = []
    for (const [v, s] of Object.entries(this.cfg.svis)) if (s.ip) out.push(['Vlan' + v, s.ip])
    for (const [p, c] of Object.entries(this.cfg.ifaces)) if (c.routed && c.ip) out.push([p, c.ip])
    for (const [n, l] of Object.entries(this.cfg.loopbacks ?? {})) if (l.ip) out.push(['Loopback' + n, l.ip])
    for (const [n, c] of Object.entries(this.cfg.subifs ?? {})) if (c.ip) out.push([n, c.ip])
    return out
  }

  setIp(addr: string, mask: string): Out {
    const len = maskToPrefix(mask)
    const a = ipToInt(addr)!
    if (len === null || len === 0) return [`Bad mask 0x${(ipToInt(mask)! >>> 0).toString(16).toUpperCase()} for address ${addr}`]
    const host = (a & ~prefixMaskInt(len)) >>> 0
    if (len < 31 && (host === 0 || host === (~prefixMaskInt(len) >>> 0))) return [`Bad mask /${len} for address ${addr}`]
    if (this.ifs.length > 1) return ['% IP address may not be configured on an interface range.']
    const name = this.ifs[0]!
    for (const [other, ip] of this.ipIfs()) {
      if (other === name) continue
      const l = Math.min(maskToPrefix(ip.mask)!, len)
      if (networkOf(ip.addr, l) === networkOf(addr, l)) return [`% ${networkOf(addr, len)} overlaps with ${other}`]
    }
    if (name.startsWith('Vlan') || name.startsWith('Loopback')) this.eachSvi((s) => void (s.ip = { addr, mask }))
    else if (name.includes('.')) {
      const c = this.cfg.subifs![name]!
      if (c.vlan === null)
        return [
          '% Configuring IP routing on a LAN subinterface is only allowed if that',
          'subinterface is already configured as part of an IEEE 802.10, IEEE 802.1Q,',
          'or ISL vLAN.',
        ]
      c.ip = { addr, mask }
    } else {
      const c = this.cfg.ifaces[name]!
      if (!c.routed) return ['% IP addresses may not be configured on L2 links.']
      c.ip = { addr, mask }
    }
  }

  // ---- DHCP server (L5-b) ----

  get poolCfg(): DhcpPool {
    return this.cfg.dhcpPools![this.pool]!
  }

  enterPool(name: string): Out {
    const pools = (this.cfg.dhcpPools ??= {})
    if (!pools[name]) pools[name] = { net: null, defaultRouter: null, dns: null }
    this.pool = name
    this.mode = 'dhcp'
  }

  deletePool(name: string): Out {
    if (!this.cfg.dhcpPools?.[name]) return [`% Pool ${name} not found`]
    delete this.cfg.dhcpPools[name]
    if (!Object.keys(this.cfg.dhcpPools).length) delete this.cfg.dhcpPools
    // the pool's leases go with it
    this.rt.dhcp = this.rt.dhcp.filter((b) => b.server !== this.dev || b.pool !== name)
    this.rt.commit()
  }

  /** `network A.B.C.D mask|/len`: stored as the network address; one pool per network. */
  poolNetwork(addr: string, maskOrLen: string): Out {
    const len = /^\/\d+$/.test(maskOrLen) ? Number(maskOrLen.slice(1)) : maskToPrefix(maskOrLen)
    if (len === null || !Number.isInteger(len) || len < 1 || len > 30) throw new InvalidAt(2)
    const net = networkOf(addr, len)
    const mask = [24, 16, 8, 0].map((sh) => (prefixMaskInt(len) >>> sh) & 255).join('.')
    for (const [other, p] of Object.entries(this.cfg.dhcpPools ?? {}))
      if (other !== this.pool && p.net && p.net.addr === net && p.net.mask === mask) return [`% A pool already exists for network ${net} / ${mask}`]
    this.poolCfg.net = { addr: net, mask }
  }

  dhcpExclude(lo: string, hi: string, add: boolean): Out {
    if (ipToInt(hi)! < ipToInt(lo)!) return ['% Invalid range of IP addresses']
    const list = (this.cfg.dhcpExcluded ??= [])
    const i = list.findIndex((r) => r.lo === lo && r.hi === hi)
    if (add) {
      if (i < 0) list.push({ lo, hi })
    } else {
      if (i < 0) {
        if (!list.length) delete this.cfg.dhcpExcluded
        return [`% Range [${lo}, ${hi}] is not in the database.`]
      }
      list.splice(i, 1)
    }
    if (!list.length) delete this.cfg.dhcpExcluded
  }

  // ---- OSPF ----

  get ospf(): OspfConfig {
    return this.cfg.ospf!
  }

  enterOspf(pid: number): Out {
    if (!this.cfg.ipRouting) return ['% IP routing not enabled']
    if (this.cfg.ospf && this.cfg.ospf.pid !== pid) return [`% Only one OSPF process is modelled; remove "router ospf ${this.cfg.ospf.pid}" first.`]
    if (!this.cfg.ospf)
      this.cfg.ospf = { pid, routerId: null, activeRid: null, networks: [], passiveDefault: false, passive: [], refBw: 100, defaultOriginate: null, stubs: {} }
    this.mode = 'router'
  }

  private hasNeighbors(): boolean {
    return (this.rt.derived.ospf[this.dev]?.nbrs.length ?? 0) > 0
  }

  routerId(rid: string | null): Out {
    const o = this.ospf
    o.routerId = rid
    if (this.hasNeighbors()) {
      if ((rid ?? null) !== o.activeRid) return ['% OSPF: Reload or use "clear ip ospf process" command, for this to take effect']
      return
    }
    // no adjacencies yet: the new ID takes effect immediately
    o.activeRid = rid
  }

  passive(name: string, on: boolean): Out {
    const o = this.ospf
    const set = new Set(o.passive)
    // with passive-interface default the list holds the exceptions
    if (on !== o.passiveDefault) set.add(name)
    else set.delete(name)
    o.passive = [...set]
  }

  stubArea(area: number, noSummary: boolean): Out {
    if (area === 0) return ['% OSPF: Backbone can not be configured as stub area']
    this.ospf.stubs[String(area)] = { noSummary }
  }

  clearOspf(): Out {
    if (!this.cfg.ospf) return
    return this.ask('Reset ALL OSPF processes? [no]: ', (ans) => {
      if (!/^y/i.test(ans.trim())) return []
      this.cfg.ospf!.activeRid = null
      return []
    })
  }

  addRoute(net: string, mask: string, nh: string, ad = 1): Out {
    const len = maskToPrefix(mask)
    if (len === null) return ['%Inconsistent address and mask']
    if (networkOf(net, len) !== net) return ['%Inconsistent address and mask']
    if (nh === '0.0.0.0' || this.ipIfs().some(([, ip]) => ip.addr === nh)) return ['%Invalid next hop address (it\'s this router)']
    // IOS: the same prefix + next hop again replaces the distance; a new next hop adds a route
    const same = this.cfg.routes.find((r) => r.net === net && r.mask === mask && r.nh === nh)
    if (same) {
      if (ad === 1) delete same.ad
      else same.ad = ad
    } else this.cfg.routes.push(ad === 1 ? { net, mask, nh } : { net, mask, nh, ad })
  }

  /** `no ip route net mask [nh [ad]]`: without a next hop every route to the prefix goes. */
  removeRoute(net: string, mask: string, nh: string | null): Out {
    const before = this.cfg.routes.length
    this.cfg.routes = this.cfg.routes.filter((r) => !(r.net === net && r.mask === mask && (nh === null || r.nh === nh)))
    if (this.cfg.routes.length === before) return ['%No matching route to delete']
  }

  // ---- spanning tree ----

  stpPriority(list: string, prio: number): Out {
    const ids = parseVlanList(list)
    if (!ids) throw new InvalidAt(2)
    if (prio % 4096 !== 0)
      return [
        '% Bridge Priority must be in increments of 4096.',
        '% Allowed values are:',
        '  0     4096  8192  12288 16384 20480 24576 28672',
        '  32768 36864 40960 45056 49152 53248 57344 61440',
      ]
    for (const v of ids) this.cfg.stpPriority[String(v)] = prio
  }

  stpRoot(list: string, kind: 'primary' | 'secondary'): Out {
    const ids = parseVlanList(list)
    if (!ids) throw new InvalidAt(2)
    for (const v of ids) {
      if (kind === 'secondary') {
        this.cfg.stpPriority[String(v)] = 28672
        continue
      }
      const bridges = this.rt.derived.stp[v]
      const me = bridges?.[this.dev]
      let prio = 24576
      if (me && !me.isRoot) {
        const rootPrio = me.rootPrio - v
        if (rootPrio <= 24576) prio = rootPrio - 4096
        if (prio < 0) return [`% Failed to make the bridge root for vlan ${v}`, '% It may be possible to make the bridge root by setting the priority', '% for some (or all) of these instances to zero.']
      } else if (me) prio = Math.min(24576, me.prio - v)
      this.cfg.stpPriority[String(v)] = prio
    }
  }

  stpClear(list: string): Out {
    const ids = parseVlanList(list)
    if (!ids) throw new InvalidAt(3)
    for (const v of ids) delete this.cfg.stpPriority[String(v)]
  }

  // ---- exec ----

  save(): string[] {
    this.rt.startup[this.dev] = clone(this.cfg)
    return ['Building configuration...', '[OK]']
  }

  erase(): Out {
    return this.ask('Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]', (ans) => {
      if (ans.trim() && !/^y/i.test(ans.trim())) return []
      this.rt.startup[this.dev] = null
      return ['[OK]', 'Erase of nvram: complete']
    })
  }

  reload(): Out {
    const proceed = () =>
      this.ask('Proceed with reload? [confirm]', (ans) => {
        if (ans.trim() && !/^y/i.test(ans.trim())) return []
        return this.doReload()
      })
    const modified = JSON.stringify(this.rt.startup[this.dev]) !== JSON.stringify(this.cfg)
    if (modified) {
      return this.ask('System configuration has been modified. Save? [yes/no]: ', (ans) => {
        const a = ans.trim().toLowerCase()
        if (a.startsWith('y')) {
          const o = this.save()
          proceed()
          return o
        }
        if (a.startsWith('n')) return proceed() ?? []
        return ['% Please answer \'yes\' or \'no\'.']
      })
    }
    return proceed()
  }

  private doReload(): string[] {
    const start = this.rt.startup[this.dev]
    const fresh = defaultSwitchConfig(this.def)
    this.rt.running[this.dev] = start ? clone(start) : fresh
    const o = this.rt.running[this.dev]!.ospf
    if (o) o.activeRid = null
    this.mode = 'user'
    this.ifs = []
    for (const k of [...this.rt.arp]) if (k.startsWith(this.dev + '>')) this.rt.arp.delete(k)
    for (const k of [...this.rt.arpIncomplete]) if (k.startsWith(this.dev + '>')) this.rt.arpIncomplete.delete(k)
    return [
      '',
      'System Bootstrap, Version 15.2(7)E, RELEASE SOFTWARE (simulated)',
      'Loading "flash:labber-sim.bin"...@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ [OK]',
      '',
      start ? '' : '         --- System Configuration Dialog ---  (skipped)',
      '',
      'Press RETURN to get started!',
      '',
    ]
  }

  ping(ip: string, o: { repeat?: number; size?: number; timeout?: number; src?: string } = {}): string[] {
    const d = this.rt.derived
    const repeat = o.repeat ?? 5
    const r = ping(d, this.dev, ip, o.src ? { src: o.src } : {})
    // ilk atlamanın ARP durumu gönderimden önce (markSeen ARP girdisini ekler)
    const firstKey = `${this.dev}>${r.firstHopArp?.ip ?? ip}`
    const coldArp = !this.rt.arp.has(firstKey)
    this.rt.markSeen(r.forward?.hops ?? [], this.dev)
    this.rt.countAcl(repeat, r.forward, r.back)
    this.rt.recordNat(repeat, r.forward, r.back)
    const head = ['Type escape sequence to abort.', `Sending ${repeat}, ${o.size ?? 100}-byte ICMP Echos to ${ip}, timeout is ${o.timeout ?? 2} seconds:`]
    if (o.src) head.push(`Packet sent with a source address of ${o.src} `)
    if (r.reason === 'noip' && !l3Ifs(d, this.dev).length) return [...head, '.'.repeat(repeat), `Success rate is 0 percent (0/${repeat})`]
    let marks: string
    let ok = 0
    if (r.ok) {
      const key = firstKey
      const cold = coldArp
      this.rt.arp.add(key)
      this.rt.arpIncomplete.delete(key)
      marks = (cold ? '.' : '!') + '!'.repeat(repeat - 1)
      ok = cold ? repeat - 1 : repeat
    } else {
      if (r.firstHopArp) {
        this.rt.arp.add(`${this.dev}>${r.firstHopArp.ip}`)
        this.rt.arpIncomplete.delete(`${this.dev}>${r.firstHopArp.ip}`)
      }
      if (r.arpIncomplete) this.rt.arpIncomplete.add(`${this.dev}>${r.arpIncomplete.ip}`)
      // U: unreachable, &: TTL expired (IOS ping çıktı kodları)
      const c = r.reason === 'unreach' ? 'U' : r.reason === 'expired' ? '&' : '.'
      marks = Array.from({ length: repeat }, (_, i) => (c === 'U' && i % 2 ? '.' : c)).join('')
    }
    this.rt.emit()
    return [
      ...head,
      marks,
      `Success rate is ${Math.floor((ok * 100) / repeat)} percent (${ok}/${repeat})` + (ok ? ', round-trip min/avg/max = 1/2/4 ms' : ''),
    ]
  }

  /** L5-i: `ping A.B.C.D [repeat N] [size N] [timeout N] [source A.B.C.D|<if>]` */
  pingOptions(ip: string, rest: string): string[] {
    const t = rest.trim().split(/\s+/)
    const o: { repeat?: number; size?: number; timeout?: number; src?: string } = {}
    for (let i = 0; i < t.length; i += 2) {
      const k = t[i]!.toLowerCase()
      const v = t[i + 1]
      if (v === undefined) throw new CliError(['% Incomplete command.'])
      const num = (lo: number, hi: number) => {
        const n = Number(v)
        if (!/^\d+$/.test(v) || n < lo || n > hi) throw new CliError(["% Invalid input detected at '^' marker."])
        return n
      }
      if ('repeat'.startsWith(k) && k.length >= 1) o.repeat = num(1, 2147483647)
      else if ('size'.startsWith(k) && k.length >= 2) o.size = num(36, 18024)
      else if ('timeout'.startsWith(k) && k.length >= 1) o.timeout = num(0, 3600)
      else if ('source'.startsWith(k) && k.length >= 2) {
        const src = this.sourceAddr(v + (t[i + 2] && /^\d/.test(t[i + 2]!) ? t[++i]! : ''))
        if (!src) throw new CliError(['% Invalid source address- IP address not on any of our up interfaces'])
        o.src = src
      } else throw new CliError(["% Invalid input detected at '^' marker."])
    }
    return this.ping(ip, o)
  }

  /** Kaynak: bu cihazın açık bir arayüzünün adresi ya da arayüz adı. */
  private sourceAddr(v: string): string | null {
    const ifs = l3Ifs(this.rt.derived, this.dev)
    if (ipToInt(v) !== null) return ifs.some((i) => i.ip === v) ? v : null
    const m = /^([A-Za-z-]+)\s*([\d/.:]+)$/.exec(v)
    const name = m ? canonIf(m[1]!, m[2]!) : null
    return ifs.find((i) => i.name === name)?.ip ?? null
  }

  /** L5-i: etkileşimli extended ping (IOS soruları; boş yanıt = köşeli parantezdeki varsayılan). */
  extendedPing(): Out {
    const o: { repeat?: number; size?: number; timeout?: number; src?: string } = {}
    let target = ''
    const bad = (msg: string): Out => [msg]
    const steps: [string, (v: string) => Out | 'next' | 'run'][] = [
      ['Protocol [ip]: ', (v) => (!v || v.toLowerCase() === 'ip' ? 'next' : bad('% Unknown protocol - "' + v + '", type "ping ?" for help'))],
      ['Target IP address: ', (v) => (ipToInt(v) !== null ? ((target = v), 'next') : bad('% Bad IP address'))],
      ['Repeat count [5]: ', (v) => (!v ? 'next' : /^\d+$/.test(v) && Number(v) >= 1 ? ((o.repeat = Number(v)), 'next') : bad('% A decimal number between 1 and 2147483647.'))],
      ['Datagram size [100]: ', (v) => (!v ? 'next' : /^\d+$/.test(v) && Number(v) >= 36 && Number(v) <= 18024 ? ((o.size = Number(v)), 'next') : bad('% A decimal number between 36 and 18024.'))],
      ['Timeout in seconds [2]: ', (v) => (!v ? 'next' : /^\d+$/.test(v) ? ((o.timeout = Number(v)), 'next') : bad('% A decimal number between 0 and 3600.'))],
      ['Extended commands [n]: ', (v) => (/^y/i.test(v) ? 'next' : 'run')],
      ['Source address or interface: ', (v) => {
        if (!v) return 'next'
        const src = this.sourceAddr(v.replace(/\s+/g, ''))
        if (!src) return bad('% Invalid source address- IP address not on any of our up interfaces')
        o.src = src
        return 'next'
      }],
      // modellenmeyen ayrıntılar: varsayılan kabul edilir (doğrulanmadı: değiştirilmiş değerlerin etkisi)
      ['Type of service [0]: ', () => 'next'],
      ['Set DF bit in IP header? [no]: ', () => 'next'],
      ['Validate reply data? [no]: ', () => 'next'],
      ['Data pattern [0x0000ABCD]: ', () => 'next'],
      ['Loose, Strict, Record, Timestamp, Verbose[none]: ', () => 'next'],
      ['Sweep range of sizes [n]: ', () => 'run'],
    ]
    const step = (i: number): Out =>
      this.ask(steps[i]![0], (line) => {
        const r = steps[i]![1](line.trim())
        if (r === 'run') return this.ping(target, o)
        if (r === 'next') return step(i + 1)
        return r
      })
    return step(0)
  }

  traceroute(ip: string): string[] {
    const d = this.rt.derived
    // L5-i: IOS traceroute: her TTL için 3 UDP sondası (hedef port 33434'ten artar); router
    // ICMP Time Exceeded, hedef port unreachable döner; en çok 30 atlama
    const out = ['Type escape sequence to abort.', `Tracing the route to ${ip}`, 'VRF info: (vrf in name/id, vrf out name/id)']
    for (let ttl = 1; ttl <= 30; ttl++) {
      const p = traceProbe(d, this.dev, ip, ttl, 33434 + (ttl - 1) * 3)
      this.rt.markSeen(p.forward.hops, this.dev)
      this.rt.countAcl(3, p.forward, p.back)
      this.rt.recordNat(3, p.forward, p.back)
      const r = p.result
      const t = String(ttl).padStart(3)
      if (r.kind === 'none') out.push(`${t}  *  *  * `)
      else if (r.kind === 'unreach') out.push(`${t} ${r.ip} !${r.code}  !${r.code}  !${r.code} `)
      else out.push(`${t} ${r.ip} ${ttl} msec ${ttl - 1} msec ${ttl} msec`)
      if (r.kind === 'dest' || r.kind === 'unreach') break
    }
    this.rt.emit()
    return out
  }

  // ---- show helpers ----

  allInterfaces(): string[] {
    const names = [
      ...this.def.ports,
      ...Object.keys(this.cfg.pos).map((n) => 'Port-channel' + n),
      ...Object.keys(this.cfg.svis).map((v) => 'Vlan' + v),
      ...Object.keys(this.cfg.loopbacks ?? {}).map((n) => 'Loopback' + n),
    ]
    return names.flatMap((n) => [...show.showInterface(this.rt, this.dev, n)])
  }

  showOneIf(a: string[], sw: boolean): string[] {
    const name = this.resolveIf(a[2]!, a[3]!, 2, false)
    // `show interfaces` detail for subinterfaces is not modelled (show ip interface brief is)
    if (name.includes('.')) throw new InvalidAt(3)
    if (name.startsWith('Port-channel') && !this.cfg.pos[ifNum(name)]) throw new InvalidAt(3)
    if (name.startsWith('Vlan') && !this.cfg.svis[ifNum(name)]) throw new InvalidAt(3)
    return sw ? show.showIntSwitchport(this.rt, this.dev, name) : show.showInterface(this.rt, this.dev, name)
  }

  showRunIf(a: string[]): string[] {
    const name = this.resolveIf(a[3]!, a[4]!, 3, false)
    const all = show.showRun(this.rt, this.dev, 'running')
    const i = all.indexOf('interface ' + name)
    if (i < 0) throw new InvalidAt(4)
    const body: string[] = [all[i]!]
    for (let j = i + 1; j < all.length && all[j]!.startsWith(' '); j++) body.push(all[j]!)
    return ['Building configuration...', '', `Current configuration : ${body.join('\n').length + 1} bytes`, '!', ...body, 'end', '']
  }

  showArp(): string[] {
    const d = this.rt.derived
    const out = ['Protocol  Address          Age (min)  Hardware Addr   Type   Interface']
    for (const i of l3Ifs(d, this.dev)) out.push(`Internet  ${i.ip.padEnd(17)}-          ${i.mac}  ARPA   ${i.name}`)
    for (const k of this.rt.arp) {
      if (!k.startsWith(this.dev + '>')) continue
      const ip = k.split('>')[1]!
      // the address that answers ARP now (duplicate address: the ARP winner)
      const now = arpMac(d, this.dev, ip)
      if (now) {
        out.push(`Internet  ${ip.padEnd(17)}0          ${now.mac}  ARPA   ${now.via}`)
        continue
      }
      const owner = d.topo.lab.devices.flatMap((x) => l3Ifs(d, x.id)).find((x) => x.ip === ip)
      const via = l3Ifs(d, this.dev).find((i) => owner && i.node && networkOf(i.ip, i.prefix) === networkOf(ip, i.prefix))
      if (owner && via) out.push(`Internet  ${ip.padEnd(17)}0          ${owner.mac}  ARPA   ${via.name}`)
    }
    for (const k of this.rt.arpIncomplete) {
      if (!k.startsWith(this.dev + '>') || this.rt.arp.has(k)) continue
      out.push(`Internet  ${k.split('>')[1]!.padEnd(17)}0          Incomplete      ARPA`)
    }
    return out
  }
}

function applyFilter(kind: string, re: RegExp, lines: string[]): string[] {
  if (kind === 'include') return lines.filter((l) => re.test(l))
  if (kind === 'exclude') return lines.filter((l) => !re.test(l))
  if (kind === 'begin') {
    const i = lines.findIndex((l) => re.test(l))
    return i < 0 ? [] : lines.slice(i)
  }
  // section: a matching top-level line plus its indented children
  const out: string[] = []
  let inSec = false
  for (const l of lines) {
    if (!l.startsWith(' ')) inSec = re.test(l)
    else if (!inSec && re.test(l)) {
      out.push(l)
      continue
    }
    if (inSec) out.push(l)
  }
  return out
}

export { shortIf }
