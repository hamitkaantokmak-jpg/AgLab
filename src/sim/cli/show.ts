// IOS-format show output generated from config + derived state.

import { allows, bpduGuardOn, egress, portForwards, vlanExists, type LPort } from '../engine'
import { macTable, routeTable, type RouteEntry } from '../net'
import type { OspfIf } from '../ospf'
import type { LabRuntime } from '../runtime'
import { pk } from '../topology'
import type { IpAddr, L2IfConfig, L3Opts, SwitchConfig, SwitchDef } from '../types'
import { formatVlanList, ifType, ipToInt, macAdd, maskToPrefix, pad, padL, prefixMaskInt, shortIf } from '../util'

const sortIfs = (sw: SwitchDef, names: string[]) =>
  [...names].sort((a, b) => sw.ports.indexOf(a) - sw.ports.indexOf(b))

const modeLine = (c: L2IfConfig) =>
  c.mode === 'access' ? 'access' : c.mode === 'trunk' ? 'trunk' : c.mode === 'dynamic-desirable' ? 'dynamic desirable' : null

function l2Lines(c: L2IfConfig, needsEncap: boolean): string[] {
  const out: string[] = []
  if (c.description) out.push(' description ' + c.description)
  if (c.accessVlan !== 1) out.push(' switchport access vlan ' + c.accessVlan)
  if (c.allowed !== null) out.push(' switchport trunk allowed vlan ' + (c.allowed.length ? formatVlanList(c.allowed) : 'none'))
  if (needsEncap && c.encapDot1q) out.push(' switchport trunk encapsulation dot1q')
  if (c.nativeVlan !== 1) out.push(' switchport trunk native vlan ' + c.nativeVlan)
  const m = modeLine(c)
  if (m) out.push(' switchport mode ' + m)
  if (c.nonegotiate) out.push(' switchport nonegotiate')
  if (c.shutdown) out.push(' shutdown')
  if (c.portfast) out.push(' spanning-tree portfast')
  return out
}

/** `ip address` and OSPF/L3 interface lines in IOS order. */
function l3Lines(ip: IpAddr | null | undefined, o: L3Opts | undefined, noIpLine: boolean): string[] {
  const out: string[] = []
  if (o?.bandwidth) out.push(' bandwidth ' + o.bandwidth)
  if (ip) out.push(` ip address ${ip.addr} ${ip.mask}`)
  else if (noIpLine) out.push(' no ip address')
  if (o?.mtu) out.push(' ip mtu ' + o.mtu)
  if (o?.ospfNet) out.push(' ip ospf network ' + o.ospfNet)
  if (o?.ospfHello) out.push(' ip ospf hello-interval ' + o.ospfHello)
  if (o?.ospfDead) out.push(' ip ospf dead-interval ' + o.ospfDead)
  if (o?.ospfPrio !== undefined) out.push(' ip ospf priority ' + o.ospfPrio)
  if (o?.ospfArea) out.push(` ip ospf ${o.ospfArea.pid} area ${o.ospfArea.area}`)
  if (o?.ospfCost) out.push(' ip ospf cost ' + o.ospfCost)
  return out
}

/** `ip route` line; the distance is shown only when it is not the default 1. */
const routeLine = (r: SwitchConfig['routes'][number]) => `ip route ${r.net} ${r.mask} ${r.nh}` + (r.ad && r.ad !== 1 ? ' ' + r.ad : '')

/** Router (L4): no VLAN/VTP/STP sections, routed ports without `no switchport`. */
function routerRunningConfig(sw: SwitchDef, c: SwitchConfig): string[] {
  const o: string[] = []
  o.push('!', 'version 15.4', 'service timestamps debug datetime msec', 'service timestamps log datetime msec', 'no service password-encryption', '!')
  o.push('hostname ' + c.hostname, '!', 'boot-start-marker', 'boot-end-marker', '!', 'no aaa new-model')
  if (!c.ipRouting) o.push('no ip routing')
  o.push('!', '!')
  for (const n of Object.keys(c.loopbacks ?? {}).map(Number).sort((a, b) => a - b)) {
    const l = c.loopbacks![String(n)]!
    o.push('interface Loopback' + n)
    if (l.description) o.push(' description ' + l.description)
    o.push(...l3Lines(l.ip, l.l3, true))
    if (l.shutdown) o.push(' shutdown')
    o.push('!')
  }
  for (const p of sw.ports) {
    const ic = c.ifaces[p]!
    o.push('interface ' + p)
    if (ic.description) o.push(' description ' + ic.description)
    o.push(...l3Lines(ic.ip, ic.l3, true))
    if (ic.helper) o.push(' ip helper-address ' + ic.helper)
    if (ic.shutdown) o.push(' shutdown')
    o.push('!')
    for (const [name, si] of subifsOf(c, p)) {
      o.push('interface ' + name)
      if (si.description) o.push(' description ' + si.description)
      if (si.vlan !== null) o.push(` encapsulation dot1Q ${si.vlan}${si.native ? ' native' : ''}`)
      o.push(...l3Lines(si.ip, si.l3, true))
      if (si.helper) o.push(' ip helper-address ' + si.helper)
      if (si.shutdown) o.push(' shutdown')
      o.push('!')
    }
  }
  if (c.ospf) o.push(...ospfLines(c))
  o.push('ip forward-protocol nd', 'no ip http server', '!')
  for (const r of c.routes) o.push(routeLine(r))
  o.push('!', 'line con 0', 'line aux 0', 'line vty 0 4', ' login', '!', 'end')
  return o
}

/** Subinterfaces of one parent port, in numeric order (L5-a). */
export function subifsOf(c: SwitchConfig, parent: string): [string, NonNullable<SwitchConfig['subifs']>[string]][] {
  return Object.entries(c.subifs ?? {})
    .filter(([, s]) => s.parent === parent)
    .sort((a, b) => Number(a[0].split('.')[1]) - Number(b[0].split('.')[1]))
}

function ospfLines(c: SwitchConfig): string[] {
  const o: string[] = []
  const r = c.ospf!
  o.push('router ospf ' + r.pid)
  if (r.routerId) o.push(' router-id ' + r.routerId)
  if (r.refBw !== 100) o.push(' auto-cost reference-bandwidth ' + r.refBw)
  for (const [a, st] of Object.entries(r.stubs).sort((x, y) => Number(x[0]) - Number(y[0]))) o.push(` area ${a} stub${st.noSummary ? ' no-summary' : ''}`)
  if (r.passiveDefault) o.push(' passive-interface default')
  for (const p of r.passive) o.push(`${r.passiveDefault ? ' no' : ''} passive-interface ${p}`)
  for (const n of r.networks) o.push(` network ${n.addr} ${n.wildcard} area ${n.area}`)
  if (r.defaultOriginate) o.push(' default-information originate' + (r.defaultOriginate.always ? ' always' : ''))
  o.push('!')
  return o
}

export function runningConfig(sw: SwitchDef, c: SwitchConfig): string[] {
  if (sw.router) return routerRunningConfig(sw, c)
  const o: string[] = []
  o.push('!', 'version 15.2', 'no service pad', 'service timestamps debug datetime msec', 'service timestamps log datetime msec', 'no service password-encryption', '!')
  o.push('hostname ' + c.hostname, '!', 'boot-start-marker', 'boot-end-marker', '!', 'no aaa new-model')
  o.push('system mtu routing 1500')
  if (c.ipRouting) o.push('ip routing')
  o.push('!', '!', 'vtp mode transparent', '!')
  o.push('spanning-tree mode ' + c.stpMode, 'spanning-tree extend system-id')
  const byPrio = new Map<number, number[]>()
  for (const [v, p] of Object.entries(c.stpPriority)) byPrio.set(p, [...(byPrio.get(p) ?? []), Number(v)])
  for (const [p, vs] of [...byPrio].sort((a, b) => a[1][0]! - b[1][0]!)) o.push(`spanning-tree vlan ${formatVlanList(vs)} priority ${p}`)
  if (c.bpduguardDefault) o.push('spanning-tree portfast bpduguard default')
  if (c.errRecoveryBpdu) o.push('errdisable recovery cause bpduguard')
  if (c.errRecoveryInterval) o.push('errdisable recovery interval ' + c.errRecoveryInterval)
  o.push('!', 'vlan internal allocation policy ascending', '!')
  for (const v of Object.keys(c.vlans).map(Number).sort((a, b) => a - b)) {
    if (v === 1 || (v >= 1002 && v <= 1005)) continue
    o.push('vlan ' + v)
    if (c.vlans[String(v)] !== 'VLAN' + String(v).padStart(4, '0')) o.push(' name ' + c.vlans[String(v)])
    o.push('!')
  }
  o.push('!')
  for (const n of Object.keys(c.loopbacks ?? {}).map(Number).sort((a, b) => a - b)) {
    const l = c.loopbacks![String(n)]!
    o.push('interface Loopback' + n)
    if (l.description) o.push(' description ' + l.description)
    o.push(...l3Lines(l.ip, l.l3, true))
    if (l.shutdown) o.push(' shutdown')
    o.push('!')
  }
  for (const id of Object.keys(c.pos).map(Number).sort((a, b) => a - b)) {
    o.push('interface Port-channel' + id, ...l2Lines(c.pos[String(id)]!, !!sw.needsEncap), '!')
  }
  for (const p of sw.ports) {
    const ic = c.ifaces[p]!
    if (ic.routed) {
      o.push('interface ' + p)
      if (ic.description) o.push(' description ' + ic.description)
      o.push(' no switchport', ...l3Lines(ic.ip, ic.l3, true))
      if (ic.shutdown) o.push(' shutdown')
    } else {
      o.push('interface ' + p, ...l2Lines(ic, !!sw.needsEncap))
      if (ic.bpduguard !== undefined) o.push(` spanning-tree bpduguard ${ic.bpduguard ? 'enable' : 'disable'}`)
      if (ic.channel) o.push(` channel-group ${ic.channel.id} mode ${ic.channel.mode}`)
    }
    o.push('!')
  }
  for (const v of Object.keys(c.svis).map(Number).sort((a, b) => a - b)) {
    const s = c.svis[String(v)]!
    o.push('interface Vlan' + v)
    if (s.description) o.push(' description ' + s.description)
    o.push(...l3Lines(s.ip, s.l3, true))
    if (s.shutdown) o.push(' shutdown')
    o.push('!')
  }
  if (c.ospf) o.push(...ospfLines(c))
  if (c.defaultGateway) o.push('ip default-gateway ' + c.defaultGateway)
  o.push('ip forward-protocol nd', 'no ip http server', '!')
  for (const r of c.routes) o.push(routeLine(r))
  o.push('!', 'line con 0', 'line vty 0 4', ' login', 'line vty 5 15', ' login', '!', 'end')
  return o
}

export function showRun(rt: LabRuntime, dev: string, which: 'running' | 'startup'): string[] {
  const sw = rt.topo.devices[dev] as SwitchDef
  const c = which === 'running' ? rt.running[dev]! : rt.startup[dev]
  if (!c) return ['startup-config is not present']
  const body = runningConfig(sw, c)
  const bytes = body.join('\n').length + 1
  return which === 'running'
    ? ['Building configuration...', '', `Current configuration : ${bytes} bytes`, ...body]
    : [`Using ${bytes} out of 524288 bytes`, ...body]
}

// ---- show vlan ----

export function showVlan(rt: LabRuntime, dev: string, brief: boolean): string[] {
  const d = rt.derived
  const c = rt.running[dev]!
  const sw = rt.topo.devices[dev] as SwitchDef
  const o = ['', 'VLAN Name                             Status    Ports', '---- -------------------------------- --------- -------------------------------']
  const accessPorts = (v: number) =>
    sortIfs(
      sw,
      (d.lports[dev] ?? [])
        .filter((lp) => !lp.isPo && !lp.routed && lp.opMode === 'access' && lp.cfg.accessVlan === v)
        .map((lp) => lp.name),
    ).map(shortIf)
  for (const vs of Object.keys(c.vlans).map(Number).sort((a, b) => a - b)) {
    const ports = vs >= 1002 && vs <= 1005 ? [] : accessPorts(vs)
    const status = vs >= 1002 && vs <= 1005 ? 'act/unsup' : 'active'
    const chunks: string[] = []
    for (let i = 0; i < ports.length; i += 4) chunks.push(ports.slice(i, i + 4).join(', '))
    o.push((pad(vs, 5) + pad(c.vlans[String(vs)]!, 33) + pad(status, 10) + (chunks[0] ?? '')).trimEnd())
    for (const ch of chunks.slice(1)) o.push(' '.repeat(48) + ch)
  }
  if (!brief) {
    o.push('', 'VLAN Type  SAID       MTU   Parent RingNo BridgeNo Stp  BrdgMode Trans1 Trans2', '---- ----- ---------- ----- ------ ------ -------- ---- -------- ------ ------')
    for (const vs of Object.keys(c.vlans).map(Number).sort((a, b) => a - b)) {
      if (vs >= 1002) continue
      o.push(`${pad(vs, 4)}enet  ${String(100000 + vs).padEnd(10)} 1500  -      -      -        -    -        0      0`)
    }
  }
  return o
}

// ---- show interfaces ----

function vlanCol(lp: LPort): string {
  if (lp.opMode === 'trunk') return 'trunk'
  if (lp.inactive) return String(lp.cfg.accessVlan)
  return String(lp.cfg.accessVlan)
}

export function showIntStatus(rt: LabRuntime, dev: string): string[] {
  const d = rt.derived
  const sw = rt.topo.devices[dev] as SwitchDef
  const o = ['', 'Port      Name               Status       Vlan       Duplex  Speed Type']
  const row = (name: string, desc: string, status: string, vlan: string, speed: string, type: string, up: boolean) =>
    pad(shortIf(name), 10) + pad(desc.slice(0, 18), 19) + pad(status, 13) + pad(vlan, 11) + pad(up ? 'a-full' : 'auto', 8) + padL(up ? speed : 'auto', 5) + ' ' + type
  for (const p of sw.ports) {
    const ps = d.phys[pk(dev, p)]!
    const lp = d.lportOfPhys[pk(dev, p)]
    const cfg = rt.running[dev]!.ifaces[p]!
    let status: string = ps.adminDown ? 'disabled' : ps.errDisabled ? 'err-disabled' : ps.up ? 'connected' : 'notconnect'
    if (ps.ec?.flag === 's') status = 'suspended'
    else if (lp && !lp.isPo && lp.status === 'inactive') status = 'inactive'
    const vlan = cfg.routed ? 'routed' : lp && ps.up ? vlanCol(lp) : cfg.mode === 'trunk' ? 'trunk' : String(cfg.accessVlan)
    const fast = ifType(p)?.speed === 100
    o.push(row(p, cfg.description, status, vlan, fast ? 'a-100' : 'a-1000', fast ? '10/100BaseTX' : '10/100/1000BaseTX', ps.up))
  }
  for (const lp of (d.lports[dev] ?? []).filter((x) => x.isPo)) {
    o.push(row(lp.name, lp.cfg.description, lp.status, lp.active ? vlanCol(lp) : 'unassigned', lp.active ? 'a-1000' : 'auto', '', lp.active))
  }
  return o
}

function trunkMode(c: L2IfConfig): string {
  return c.mode === 'trunk' ? 'on' : c.mode === 'dynamic-desirable' ? 'desirable' : c.mode === 'dynamic-auto' ? 'auto' : 'off'
}

export function showIntTrunk(rt: LabRuntime, dev: string): string[] {
  const d = rt.derived
  const trunks = (d.lports[dev] ?? []).filter((lp) => lp.active && lp.opMode === 'trunk')
  if (!trunks.length) return ['']
  const c = rt.running[dev]!
  const o = ['', 'Port        Mode             Encapsulation  Status        Native vlan']
  for (const lp of trunks)
    o.push(pad(shortIf(lp.name), 12) + pad(trunkMode(lp.cfg), 17) + pad('802.1q', 15) + pad('trunking', 14) + lp.cfg.nativeVlan)
  const allowedList = (lp: LPort) => (lp.cfg.allowed === null ? '1-4094' : lp.cfg.allowed.length ? formatVlanList(lp.cfg.allowed) : 'none')
  const active = (lp: LPort) => {
    const vs = Object.keys(c.vlans).map(Number).filter((v) => allows(lp.cfg, v) && vlanExists(c, v))
    return vs.length ? formatVlanList(vs) : 'none'
  }
  const fwd = (lp: LPort) => {
    const vs = Object.keys(c.vlans)
      .map(Number)
      .filter((v) => egress(d, lp, v) && portForwards(d, dev, lp, v))
    return vs.length ? formatVlanList(vs) : 'none'
  }
  o.push('', 'Port        Vlans allowed on trunk')
  for (const lp of trunks) o.push(pad(shortIf(lp.name), 12) + allowedList(lp))
  o.push('', 'Port        Vlans allowed and active in management domain')
  for (const lp of trunks) o.push(pad(shortIf(lp.name), 12) + active(lp))
  o.push('', 'Port        Vlans in spanning tree forwarding state and not pruned')
  for (const lp of trunks) o.push(pad(shortIf(lp.name), 12) + fwd(lp))
  return o
}

export function showIntSwitchport(rt: LabRuntime, dev: string, only?: string): string[] {
  const d = rt.derived
  const sw = rt.topo.devices[dev] as SwitchDef
  const c = rt.running[dev]!
  const names = only ? [only] : [...sw.ports, ...Object.keys(c.pos).map((n) => 'Port-channel' + n)]
  const o: string[] = []
  for (const name of names) {
    const isPo = name.startsWith('Port-channel')
    const cfg = isPo ? c.pos[name.slice(12)] : c.ifaces[name]
    if (!cfg) continue
    if (!isPo && c.ifaces[name]!.routed) {
      o.push(`Name: ${shortIf(name)}`, 'Switchport: Disabled', '')
      continue
    }
    const lp = d.lportByName[pk(dev, name)] ?? d.lportOfPhys[pk(dev, name)]
    const adminMode = cfg.mode === 'access' ? 'static access' : cfg.mode === 'trunk' ? 'trunk' : cfg.mode === 'dynamic-auto' ? 'dynamic auto' : 'dynamic desirable'
    const up = !!lp?.active
    const oper = !up ? 'down' : lp!.opMode === 'trunk' ? 'trunk' : 'static access'
    const vname = (v: number) => (vlanExists(c, v) ? c.vlans[String(v)] : 'Inactive')
    o.push(
      `Name: ${shortIf(name)}`,
      'Switchport: Enabled',
      `Administrative Mode: ${adminMode}`,
      `Operational Mode: ${oper}`,
      'Administrative Trunking Encapsulation: ' + (cfg.encapDot1q ? 'dot1q' : (rt.topo.devices[dev] as SwitchDef).needsEncap ? 'negotiate' : 'dot1q'),
      ...(up && lp!.opMode === 'trunk' ? ['Operational Trunking Encapsulation: dot1q'] : []),
      `Negotiation of Trunking: ${cfg.nonegotiate ? 'Off' : 'On'}`,
      `Access Mode VLAN: ${cfg.accessVlan} (${vname(cfg.accessVlan)})`,
      `Trunking Native Mode VLAN: ${cfg.nativeVlan} (${vname(cfg.nativeVlan)})`,
      'Administrative Native VLAN tagging: enabled',
      'Voice VLAN: none',
      `Trunking VLANs Enabled: ${cfg.allowed === null ? 'ALL' : cfg.allowed.length ? formatVlanList(cfg.allowed) : 'NONE'}`,
      'Pruning VLANs Enabled: 2-1001',
      'Capture Mode Disabled',
      'Capture VLANs Allowed: ALL',
      '',
      'Protected: false',
      'Unknown unicast blocked: disabled',
      'Unknown multicast blocked: disabled',
      'Appliance trust: none',
      '',
    )
  }
  return o
}

export function showIpIntBrief(rt: LabRuntime, dev: string): string[] {
  const d = rt.derived
  const sw = rt.topo.devices[dev] as SwitchDef
  const c = rt.running[dev]!
  const o = ['Interface              IP-Address      OK? Method Status                Protocol']
  const row = (n: string, ip: string, status: string, proto: string) =>
    pad(n, 23) + pad(ip, 16) + 'YES ' + pad(ip === 'unassigned' ? 'unset' : 'manual', 7) + pad(status, 22) + proto
  for (const s of d.svis[dev] ?? [])
    o.push(row('Vlan' + s.vlan, s.ip ?? 'unassigned', s.status, s.up ? 'up' : 'down'))
  for (const p of sw.ports) {
    const ps = d.phys[pk(dev, p)]!
    const proto = ps.up && ps.ec?.flag !== 's' ? 'up' : 'down'
    const ip = c.ifaces[p]!.routed ? (c.ifaces[p]!.ip?.addr ?? 'unassigned') : 'unassigned'
    o.push(row(p, ip, ps.adminDown ? 'administratively down' : ps.up ? 'up' : 'down', proto))
    // L5-a: a subinterface follows its parent; its own shutdown shows as administratively down
    for (const [name, si] of subifsOf(c, p)) {
      const up = !si.shutdown && ps.up
      o.push(row(name, si.ip?.addr ?? 'unassigned', si.shutdown ? 'administratively down' : up ? 'up' : 'down', up ? 'up' : 'down'))
    }
  }
  for (const [n, l] of Object.entries(c.loopbacks ?? {}).sort((a, b) => Number(a[0]) - Number(b[0])))
    o.push(row('Loopback' + n, l.ip?.addr ?? 'unassigned', l.shutdown ? 'administratively down' : 'up', l.shutdown ? 'down' : 'up'))
  for (const id of Object.keys(c.pos)) {
    const lp = d.lportByName[pk(dev, 'Port-channel' + id)]!
    o.push(row('Port-channel' + id, 'unassigned', lp.cfg.shutdown ? 'administratively down' : lp.active ? 'up' : 'down', lp.active ? 'up' : 'down'))
  }
  return o
}

export function showIpRoute(rt: LabRuntime, dev: string, only?: 'O' | 'S' | 'C'): string[] {
  const d = rt.derived
  const c = rt.running[dev]!
  const sw = rt.topo.devices[dev] as SwitchDef
  if (!(sw.l3 || sw.router) || !c.ipRouting) {
    return [c.defaultGateway ? `Default gateway is ${c.defaultGateway}` : 'Default gateway is not set', '', 'Host               Gateway           Last Use    Total Uses  Interface', 'ICMP redirect cache is empty']
  }
  const o = [
    'Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP',
    '       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area',
    '       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2',
    '       E1 - OSPF external type 1, E2 - OSPF external type 2',
    '       i - IS-IS, su - IS-IS summary, L1 - IS-IS level-1, L2 - IS-IS level-2',
    '       ia - IS-IS inter area, * - candidate default, U - per-user static route',
    '       o - ODR, P - periodic downloaded static route, H - NHRP, l - LISP',
    '       + - replicated route, % - next hop override',
    '',
  ]
  const all = routeTable(d, dev)
  const def = all.find((e) => e.prefix === 0)
  o.push(def ? `Gateway of last resort is ${def.nh} to network 0.0.0.0` : 'Gateway of last resort is not set', '')
  const keep = (e: RouteEntry) => !only || (only === 'C' ? e.code === 'C' || e.code === 'L' : e.code.startsWith(only))
  const line = (e: RouteEntry, codeCol: string, width = 9) => {
    const head = `${codeCol.padEnd(width)}${e.net}/${e.prefix}`
    if (e.code === 'S') return [`${head} [${e.ad ?? 1}/0] via ${e.nh}`]
    if (e.code === 'C' || e.code === 'L') return [`${head} is directly connected, ${e.ifname}`]
    const paths = e.paths ?? [{ nh: e.nh!, ifname: e.ifname }]
    const pad0 = ' '.repeat(head.length + 1)
    return paths.map((p, i) => `${i === 0 ? head + ' ' : pad0}[110/${e.metric}] via ${p.nh}, 00:12:34, ${p.ifname}`)
  }
  if (def && keep(def)) o.push(...line(def, def.code === 'S' ? 'S*' : def.code === 'O E2' ? 'O*E2' : def.code === 'O IA' ? 'O*IA' : def.code + '*', 6))
  const sorted = all
    .filter((e) => e !== def && keep(e))
    .sort((a, b) => a.net.localeCompare(b.net, undefined, { numeric: true }) || a.prefix - b.prefix)
  const majors = new Map<string, typeof sorted>()
  for (const e of sorted) {
    const parts = e.net.split('.')
    const first = Number(parts[0])
    const cls = first < 128 ? `${parts[0]}.0.0.0/8` : first < 192 ? `${parts[0]}.${parts[1]}.0.0/16` : `${parts[0]}.${parts[1]}.${parts[2]}.0/24`
    majors.set(cls, [...(majors.get(cls) ?? []), e])
  }
  for (const [cls, list] of majors) {
    const masks = new Set(list.map((e) => e.prefix)).size
    o.push(masks > 1 ? `      ${cls} is variably subnetted, ${list.length} subnets, ${masks} masks` : `      ${cls.split('/')[0]}/${list[0]!.prefix} is subnetted, ${list.length} subnets`)
    for (const e of list) o.push(...line(e, e.code))
  }
  return o
}

/** `show ip route A.B.C.D`: longest-match entry in IOS detail format. */
export function showIpRouteFor(rt: LabRuntime, dev: string, ip: string): string[] {
  const c = rt.running[dev]!
  const sw = rt.topo.devices[dev] as SwitchDef
  if (!(sw.l3 || sw.router) || !c.ipRouting) return ['% Network not in table']
  const dn = ipToInt(ip)!
  let best: RouteEntry | null = null
  // the table holds one entry per prefix (the installed route), so LPM alone decides
  for (const e of routeTable(rt.derived, dev)) {
    if (e.code === 'L') continue
    const m = prefixMaskInt(e.prefix)
    if (((dn & m) >>> 0) !== ((ipToInt(e.net)! & m) >>> 0)) continue
    if (best && best.prefix >= e.prefix) continue
    best = e
  }
  if (!best) return ['% Network not in table']
  const e = best
  const o = [`Routing entry for ${e.net}/${e.prefix}${e.prefix === 0 ? ', supernet' : ''}`]
  if (e.code === 'C') {
    o.push('  Known via "connected", distance 0, metric 0 (connected, via interface)', '  Routing Descriptor Blocks:', `  * directly connected, via ${e.ifname}`, '      Route metric is 0, traffic share count is 1')
    return o
  }
  if (e.code === 'S') {
    o.push(`  Known via "static", distance ${e.ad ?? 1}, metric 0` + (e.prefix === 0 ? ', candidate default path' : ''), '  Routing Descriptor Blocks:', `  * ${e.nh}`, '      Route metric is 0, traffic share count is 1')
    return o
  }
  const type = e.code === 'O' ? 'intra area' : e.code === 'O IA' ? 'inter area' : 'extern 2, forward metric 1'
  const pid = rt.derived.ospf[dev]?.pid ?? 1
  o.push(`  Known via "ospf ${pid}", distance 110, metric ${e.metric}, type ${type}${e.prefix === 0 ? ', candidate default path' : ''}`)
  o.push(`  Last update from ${e.nh} on ${e.ifname}, 00:12:34 ago`, '  Routing Descriptor Blocks:')
  ;(e.paths ?? []).forEach((p, i) => o.push(`  ${i === 0 ? '*' : ' '} ${p.nh}, 00:12:34 ago, via ${p.ifname}`, `      Route metric is ${e.metric}, traffic share count is 1`))
  return o
}

// ---- OSPF ----

const ospfOf = (rt: LabRuntime, dev: string) => rt.derived.ospf[dev]
const noOspf = ['%OSPF: Router process not running']
const roleShort = (r: OspfIf['role']) => (r === 'DROTHER' ? 'DROTH' : r)

export function showOspfNbr(rt: LabRuntime, dev: string): string[] {
  const s = ospfOf(rt, dev)
  if (!s) return []
  const o = ['', 'Neighbor ID     Pri   State           Dead Time   Address         Interface']
  for (const n of s.nbrs) {
    const i = s.ifs.find((x) => x.name === n.ifname)!
    const st = `${n.state}/${n.role === '-' ? ' -' : n.role}`
    o.push(pad(n.rid, 16) + padL(n.prio, 3) + '   ' + pad(st, 16) + pad(`00:00:${String(Math.min(59, i.dead - 5)).padStart(2, '0')}`, 12) + pad(n.ip, 16) + n.ifname)
  }
  return o
}

export function showOspfIfBrief(rt: LabRuntime, dev: string): string[] {
  const s = ospfOf(rt, dev)
  if (!s) return noOspf
  const o = ['Interface    PID   Area            IP Address/Mask    Cost  State Nbrs F/C']
  for (const i of s.ifs) {
    const nb = s.nbrs.filter((n) => n.ifname === i.name)
    const f = nb.filter((n) => n.state === 'FULL').length
    o.push(pad(shortIf(i.name), 13) + pad(s.pid, 6) + pad(i.area, 16) + pad(`${i.ip}/${i.prefix}`, 19) + pad(i.cost, 6) + pad(roleShort(i.role), 6) + `${f}/${nb.length}`)
  }
  return o
}

export function showOspfIf(rt: LabRuntime, dev: string, only?: string): string[] {
  const s = ospfOf(rt, dev)
  if (!s) return noOspf
  const c = rt.running[dev]!.ospf!
  const ifs = s.ifs.filter((i) => !only || i.name === only)
  if (only && !ifs.length) return [`%OSPF: OSPF not enabled on ${only}`]
  const o: string[] = []
  for (const i of ifs) {
    const nb = s.nbrs.filter((n) => n.ifname === i.name)
    const full = nb.filter((n) => n.state === 'FULL')
    const how = i.l3 && rt.running[dev]!.svis ? (configuredArea(rt, dev, i.name) ? 'Interface Config' : 'Network Statement') : 'Network Statement'
    o.push(
      `${i.name} is ${i.up ? 'up' : 'down'}, line protocol is ${i.up ? 'up' : 'down'} `,
      `  Internet Address ${i.ip}/${i.prefix}, Area ${i.area}, Attached via ${how}`,
      `  Process ID ${s.pid}, Router ID ${s.rid ?? '0.0.0.0'}, Network Type ${i.net === 'point-to-point' ? 'POINT_TO_POINT' : i.net === 'loopback' ? 'LOOPBACK' : 'BROADCAST'}, Cost: ${i.cost}`,
    )
    if (i.net === 'loopback') {
      o.push('  Loopback interface is treated as a stub Host')
      continue
    }
    if (!i.up) continue
    o.push(`  Transmit Delay is 1 sec, State ${i.role === 'P2P' ? 'POINT_TO_POINT' : i.role}${i.net === 'broadcast' ? `, Priority ${i.prio}` : ''}`)
    if (i.net === 'broadcast') {
      if (i.dr) o.push(`  Designated Router (ID) ${i.dr.rid}, Interface address ${i.dr.ip}`)
      else o.push('  No designated router on this network')
      if (i.bdr) o.push(`  Backup Designated router (ID) ${i.bdr.rid}, Interface address ${i.bdr.ip}`)
      else o.push('  No backup designated router on this network')
    }
    o.push(`  Timer intervals configured, Hello ${i.hello}, Dead ${i.dead}, Wait ${i.dead}, Retransmit 5`)
    if (i.passive) {
      o.push('    No Hellos (Passive interface) ')
      continue
    }
    o.push(`    Hello due in 00:00:0${Math.min(9, i.hello - 1)}`, `  Neighbor Count is ${nb.length}, Adjacent neighbor count is ${full.length} `)
    for (const n of full) o.push(`    Adjacent with neighbor ${n.rid}${n.role === 'DR' ? '  (Designated Router)' : n.role === 'BDR' ? '  (Backup Designated Router)' : ''}`)
    o.push('  Suppress hello for 0 neighbor(s)')
  }
  void c
  return o
}

function configuredArea(rt: LabRuntime, dev: string, name: string): boolean {
  const c = rt.running[dev]!
  const opts = name.startsWith('Vlan')
    ? c.svis[name.slice(4)]?.l3
    : name.startsWith('Loopback')
      ? c.loopbacks?.[name.slice(8)]?.l3
      : c.ifaces[name]?.l3
  return !!opts?.ospfArea
}

export function showIpOspf(rt: LabRuntime, dev: string): string[] {
  const s = ospfOf(rt, dev)
  if (!s) return noOspf
  const c = rt.running[dev]!.ospf!
  if (!s.rid) return [`%OSPF-4-NORTRID: OSPF process ${s.pid} failed to allocate unique router-id and cannot start`]
  const o = [` Routing Process "ospf ${s.pid}" with ID ${s.rid}`, ' Start time: 00:00:12.345, Time elapsed: 01:02:03.456', ' Supports only single TOS(TOS0) routes', ' Supports opaque LSA']
  if (s.abr) o.push(' It is an area border router')
  if (s.asbr) o.push(' It is an autonomous system boundary router')
  o.push(' Router is not originating router-LSAs with maximum metric', ` Number of areas in this router is ${s.areas.length}. ${s.areas.filter((a) => !c.stubs[String(a)]).length} normal ${s.areas.filter((a) => c.stubs[String(a)]).length} stub 0 nssa`)
  o.push(` Reference bandwidth unit is ${c.refBw} mbps`)
  for (const a of s.areas) {
    const ifs = s.ifs.filter((i) => i.up && i.area === a)
    const loops = ifs.filter((i) => i.net === 'loopback').length
    o.push(`    Area ${a === 0 ? 'BACKBONE(0)' : a}`, `        Number of interfaces in this area is ${ifs.length}${loops ? ` (${loops} loopback)` : ''}`)
    const st = c.stubs[String(a)]
    if (st) o.push(`        It is a stub area${st.noSummary ? ', no summary LSA in this area' : ''}`)
    if (st && s.abr) o.push('          generates stub default route with cost 1')
    o.push('        Area has no authentication')
  }
  return o
}

export function showIpProtocols(rt: LabRuntime, dev: string): string[] {
  const s = ospfOf(rt, dev)
  const c = rt.running[dev]!
  if (!s || !c.ospf) return ['*** IP Routing is NSF aware ***', '']
  const r = c.ospf
  const o = ['*** IP Routing is NSF aware ***', '', `Routing Protocol is "ospf ${s.pid}"`, '  Outgoing update filter list for all interfaces is not set', '  Incoming update filter list for all interfaces is not set', `  Router ID ${s.rid ?? '0.0.0.0'}`]
  if (s.abr) o.push('  It is an area border router')
  if (s.asbr) o.push('  It is an autonomous system boundary router')
  o.push(`  Number of areas in this router is ${s.areas.length}. ${s.areas.filter((a) => !r.stubs[String(a)]).length} normal ${s.areas.filter((a) => r.stubs[String(a)]).length} stub 0 nssa`, '  Maximum path: 4', '  Routing for Networks:')
  for (const n of r.networks) o.push(`    ${n.addr} ${n.wildcard} area ${n.area}`)
  const explicit = s.ifs.filter((i) => configuredArea(rt, dev, i.name))
  if (explicit.length) {
    o.push('  Routing on Interfaces Configured Explicitly:')
    for (const i of explicit) o.push(`    ${i.name}`)
  }
  const passive = s.ifs.filter((i) => i.passive).map((i) => i.name)
  if (passive.length) {
    o.push('  Passive Interface(s):')
    for (const p of passive) o.push(`    ${p}`)
  }
  o.push('  Routing Information Sources:', '    Gateway         Distance      Last Update')
  const srcs = new Set<string>()
  for (const dv of Object.keys(rt.derived.ospf)) if (dv !== dev && rt.derived.ospf[dv]!.rid) srcs.add(rt.derived.ospf[dv]!.rid!)
  const used = new Set(s.nbrs.filter((n) => n.state === 'FULL').map((n) => n.rid))
  for (const rid of [...srcs].filter((x) => used.has(x) || s.routes.length).sort()) o.push(`    ${pad(rid, 16)}${padL(110, 8)}      00:12:34`)
  o.push('  Distance: (default is 110)', '')
  return o
}

// ---- err-disable ----

export function showErrDisabled(rt: LabRuntime, dev: string): string[] {
  const d = rt.derived
  const sw = rt.topo.devices[dev] as SwitchDef
  const o = ['', 'Port      Name               Status       Reason               Err-disabled Vlans']
  for (const p of sw.ports) {
    if (!d.phys[pk(dev, p)]?.errDisabled) continue
    o.push(pad(shortIf(p), 10) + pad(rt.running[dev]!.ifaces[p]!.description.slice(0, 18), 19) + pad('err-disabled', 13) + 'bpduguard')
  }
  return o
}

export function showErrRecovery(rt: LabRuntime, dev: string): string[] {
  const c = rt.running[dev]!
  const sw = rt.topo.devices[dev] as SwitchDef
  const o = ['ErrDisable Reason            Timer Status', '-----------------            --------------']
  for (const r of ['arp-inspection', 'bpduguard', 'channel-misconfig (STP)', 'dhcp-rate-limit', 'link-flap', 'psecure-violation', 'udld'])
    o.push(pad(r, 29) + (r === 'bpduguard' && c.errRecoveryBpdu ? 'Enabled' : 'Disabled'))
  o.push('', `Timer interval: ${c.errRecoveryInterval ?? 300} seconds`, '', 'Interfaces that will be enabled at the next timeout:', '')
  if (c.errRecoveryBpdu) {
    const ports = sw.ports.filter((p) => rt.derived.phys[pk(dev, p)]?.errDisabled)
    if (ports.length) {
      o.push('Interface       Errdisable reason       Time left(sec)', '---------       -----------------       --------------')
      for (const p of ports) o.push(pad(shortIf(p), 16) + pad('bpduguard', 24) + (c.errRecoveryInterval ?? 300))
    }
  }
  void bpduGuardOn
  return o
}

// ---- spanning tree ----

const fmtBid = (mac: string) => mac

export function showSpanningTree(rt: LabRuntime, dev: string, only?: number): string[] {
  const d = rt.derived
  const c = rt.running[dev]!
  const vlans = Object.keys(d.stp)
    .map(Number)
    .filter((v) => d.stp[v]![dev] && (only === undefined || v === only))
  if (only !== undefined && !vlans.length) return [`Spanning tree instance(s) for vlan ${only} does not exist.`]
  if (!vlans.length) return ['No spanning tree instance exists.']
  const o: string[] = []
  for (const v of vlans) {
    const b = d.stp[v]![dev]!
    const ports = Object.entries(b.ports)
    if (!ports.length && only === undefined) continue
    const sysPrio = b.prio
    const rootPortLp = b.rootPort ? d.lportByName[pk(dev, b.rootPort)] : null
    o.push('', `VLAN${String(v).padStart(4, '0')}`, `  Spanning tree enabled protocol ${c.stpMode === 'rapid-pvst' ? 'rstp' : 'ieee'}`)
    o.push(`  Root ID    Priority    ${b.rootPrio}`, `             Address     ${fmtBid(b.rootMac)}`)
    if (b.isRoot) o.push('             This bridge is the root')
    else o.push(`             Cost        ${b.rootCost}`, `             Port        ${rootPortLp?.portNum ?? 0} (${b.rootPort})`)
    o.push('             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec', '')
    o.push(`  Bridge ID  Priority    ${sysPrio}  (priority ${sysPrio - v} sys-id-ext ${v})`, `             Address     ${b.mac}`)
    o.push('             Hello Time   2 sec  Max Age 20 sec  Forward Delay 15 sec', '             Aging Time  300 sec', '')
    o.push('Interface           Role Sts Cost      Prio.Nbr Type', '------------------- ---- --- --------- -------- --------------------------------')
    const sw = rt.topo.devices[dev] as SwitchDef
    const order = (n: string) => (n.startsWith('Port-channel') ? 1000 + Number(n.slice(12)) : sw.ports.indexOf(n))
    for (const [name, p] of ports.sort((a, b2) => order(a[0]) - order(b2[0]))) {
      const type = (p.edge ? 'P2p Edge' : 'P2p') + (p.inconsistent ? ' *PVID_Inc' : '')
      o.push(pad(shortIf(name), 20) + pad(p.role, 5) + pad(p.state === 'BKN' ? 'BKN*' : p.state, 4) + pad(p.cost, 10) + pad('128.' + p.portNum, 9) + type)
    }
  }
  return o
}

// ---- etherchannel ----

export function showEtherchannelSummary(rt: LabRuntime, dev: string): string[] {
  const groups = rt.derived.ec[dev] ?? []
  const o = [
    'Flags:  D - down        P - bundled in port-channel',
    '        I - stand-alone s - suspended',
    '        H - Hot-standby (LACP only)',
    '        R - Layer3      S - Layer2',
    '        U - in use      f - failed to allocate aggregator',
    '',
    '        M - not in use, minimum links not met',
    '        u - unsuitable for bundling',
    '        w - waiting to be aggregated',
    '        d - default port',
    '',
    '',
    `Number of channel-groups in use: ${groups.length}`,
    `Number of aggregators:           ${groups.length}`,
    '',
    'Group  Port-channel  Protocol    Ports',
    '------+-------------+-----------+-----------------------------------------------',
  ]
  for (const g of groups) {
    const po = `Po${g.id}(S${g.up ? 'U' : 'D'})`
    const members = g.members.map((m) => `${shortIf(m.port)}(${m.flag})`).join(' ')
    o.push(pad(g.id, 7) + pad(po, 14) + pad(g.protocol, 12) + members)
  }
  return o
}

// ---- mac table, cdp, version ----

/** `show mac address-table [address <mac>]`; `only` is a canonical dotted MAC. */
export function showMac(rt: LabRuntime, dev: string, only?: string): string[] {
  const d = rt.derived
  const o = ['          Mac Address Table', '-------------------------------------------', '', 'Vlan    Mac Address       Type        Ports', '----    -----------       --------    -----']
  const rows: { mac: string; line: string }[] = ['0100.0ccc.cccc', '0100.0ccc.cccd', '0180.c200.0000'].map((mac) => ({
    mac,
    line: ` All    ${mac}    STATIC      CPU`,
  }))
  for (const e of macTable(d, dev, rt.seen))
    rows.push({ mac: e.mac, line: padL(e.vlan, 4) + '    ' + pad(e.mac, 18) + pad('DYNAMIC', 12) + shortIf(e.port) })
  const shown = only ? rows.filter((r) => r.mac === only) : rows
  o.push(...shown.map((r) => r.line))
  o.push(`Total Mac Addresses for this criterion: ${shown.length}`)
  return o
}

export function showCdp(rt: LabRuntime, dev: string): string[] {
  const d = rt.derived
  const sw = rt.topo.devices[dev] as SwitchDef
  const o = [
    'Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge',
    '                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone,',
    '                  D - Remote, C - CVTA, M - Two-port Mac Relay',
    '',
    'Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID',
  ]
  for (const p of sw.ports) {
    const ps = d.phys[pk(dev, p)]!
    if (!ps.up || !ps.peer || ps.peerIsPc) continue
    const peer = rt.topo.devices[ps.peer.dev] as SwitchDef
    const caps = peer.router ? 'R B' : peer.l3 ? 'R S I' : 'S I'
    o.push(pad(rt.hostname(peer.id), 17) + pad(shortIf(p).replace(/^(\w\w)/, '$1 '), 18) + pad('163', 11) + pad(caps, 12) + pad(peer.model.split(' ')[0]!.slice(0, 9), 10) + shortIf(ps.peer.port).replace(/^(\w\w)/, '$1 '))
  }
  const n = o.length - 5
  o.push('', `Total cdp entries displayed : ${n}`)
  return o
}

export function showVersion(rt: LabRuntime, dev: string): string[] {
  const sw = rt.topo.devices[dev] as SwitchDef
  const fa = sw.ports.filter((p) => p.startsWith('Fast')).length
  const gi = sw.ports.filter((p) => p.startsWith('Gigabit')).length
  return [
    `Cisco IOS Software, ${sw.model} Software (Labber Simulated), Version 15.2(7)E, RELEASE SOFTWARE`,
    'Technical Support: http://www.cisco.com/techsupport',
    '',
    'ROM: Bootstrap program is simulated',
    '',
    `${rt.hostname(dev)} uptime is 1 hour, 2 minutes`,
    'System image file is "flash:labber-sim.bin"',
    '',
    `cisco ${sw.model} (simulated) processor with 524288K bytes of memory.`,
    ...(fa ? [`${fa} FastEthernet interfaces`] : []),
    ...(gi ? [`${gi} Gigabit Ethernet interfaces`] : []),
    '',
    `Base ethernet MAC Address       : ${sw.mac.replace(/\./g, '').match(/../g)!.join(':').toUpperCase()}`,
    `Model number                    : ${sw.model}`,
    '',
    'Configuration register is 0xF',
  ]
}

export function showInterface(rt: LabRuntime, dev: string, name: string): string[] {
  const d = rt.derived
  if (name.startsWith('Loopback')) {
    const l = rt.running[dev]!.loopbacks?.[name.slice(8)]
    if (!l) return []
    const st = l.shutdown ? 'administratively down' : 'up'
    return [
      `${name} is ${st}, line protocol is ${l.shutdown ? 'down' : 'up'} `,
      '  Hardware is Loopback',
      ...(l.description ? [`  Description: ${l.description}`] : []),
      ...(l.ip ? [`  Internet address is ${l.ip.addr}/${maskToPrefix(l.ip.mask)}`] : []),
      '  MTU 1514 bytes, BW 8000000 Kbit/sec, DLY 5000 usec,',
      '  Encapsulation LOOPBACK, loopback not set',
    ]
  }
  if (name.startsWith('Vlan')) {
    const v = Number(name.slice(4))
    const s = d.svis[dev]?.find((x) => x.vlan === v)
    if (!s) return ['                                                   ^', "% Invalid input detected at '^' marker."]
    return [
      `${name} is ${s.status}, line protocol is ${s.up ? 'up' : 'down'}`,
      `  Hardware is EtherSVI, address is ${s.mac} (bia ${s.mac})`,
      ...(s.ip ? [`  Internet address is ${s.ip}/${maskToPrefix(s.mask!)}`] : []),
      '  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec,',
      '  Encapsulation ARPA, loopback not set',
    ]
  }
  const lp = d.lportByName[pk(dev, name)]
  const ps = d.phys[pk(dev, name)]
  const isPo = name.startsWith('Port-channel')
  if (!lp && !ps) return []
  const sw = rt.topo.devices[dev] as SwitchDef
  const admin = isPo ? lp!.cfg.shutdown : ps!.adminDown
  const up = isPo ? lp!.active : ps!.up
  const proto = isPo ? lp!.active : ps!.up && ps!.ec?.flag !== 's'
  const idx = isPo ? 60 + Number(name.slice(12)) : sw.ports.indexOf(name) + 1
  const mac = macAdd(sw.mac, idx)
  const speed = isPo ? (lp!.members.length * 1000 || 1000) * 1000 : (ifType(name)?.speed ?? 100) * 1000
  const out = [
    `${name} is ${admin ? 'administratively down' : up ? 'up' : 'down'}, line protocol is ${proto ? 'up (connected)' : admin ? 'down (disabled)' : ps?.errDisabled ? 'down (err-disabled)' : ps?.ec?.flag === 's' ? 'down (suspended)' : 'down (notconnect)'}`,
    `  Hardware is ${isPo ? 'EtherChannel' : ifType(name)?.speed === 100 ? 'Fast Ethernet' : 'Gigabit Ethernet'}, address is ${mac} (bia ${mac})`,
  ]
  const desc = isPo ? lp!.cfg.description : rt.running[dev]!.ifaces[name]?.description
  if (desc) out.push(`  Description: ${desc}`)
  const rip = !isPo ? rt.running[dev]!.ifaces[name]?.ip : null
  if (rip && rt.running[dev]!.ifaces[name]?.routed) out.push(`  Internet address is ${rip.addr}/${maskToPrefix(rip.mask)}`)
  out.push(`  MTU 1500 bytes, BW ${speed} Kbit/sec, DLY 100 usec,`, '     reliability 255/255, txload 1/255, rxload 1/255', '  Encapsulation ARPA, loopback not set')
  if (isPo) out.push(`  Members in this channel: ${lp!.members.map(shortIf).join(' ') || 'none'}`)
  else if (ps?.ec) out.push(`  Member of Port-channel${ps.ec.id} (${ps.ec.flag})`)
  return out
}
