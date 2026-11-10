import type { L2IfConfig, PhysIfConfig, SviConfig, SwitchConfig, SwitchDef } from './types'

export function defaultL2(): L2IfConfig {
  return {
    shutdown: false,
    description: '',
    mode: 'dynamic-auto',
    accessVlan: 1,
    nativeVlan: 1,
    allowed: null,
    nonegotiate: false,
    encapDot1q: false,
    portfast: false,
  }
}

export function defaultPhys(): PhysIfConfig {
  return { ...defaultL2(), channel: null }
}

export function defaultSvi(vlan: number): SviConfig {
  // Vlan1 ships shut on most Catalyst images; new SVIs come up enabled.
  return { shutdown: vlan === 1, description: '', ip: null }
}

export function defaultSwitchConfig(def: SwitchDef): SwitchConfig {
  const ifaces: Record<string, PhysIfConfig> = {}
  if (def.router) {
    // IOS router: routed ports, administratively down until `no shutdown`; routing on.
    for (const p of def.ports) ifaces[p] = { ...defaultPhys(), routed: true, ip: null, shutdown: true }
    return {
      hostname: 'Router',
      vlans: {},
      ifaces,
      pos: {},
      svis: {},
      stpMode: 'pvst',
      stpPriority: {},
      ipRouting: true,
      routes: [],
      defaultGateway: null,
    }
  }
  for (const p of def.ports) ifaces[p] = defaultPhys()
  return {
    hostname: 'Switch',
    vlans: {
      '1': 'default',
      '1002': 'fddi-default',
      '1003': 'token-ring-default',
      '1004': 'fddinet-default',
      '1005': 'trnet-default',
    },
    ifaces,
    pos: {},
    svis: { '1': defaultSvi(1) },
    stpMode: 'pvst',
    stpPriority: {},
    ipRouting: false,
    routes: [],
    defaultGateway: null,
  }
}

export const RESERVED_VLANS = [1, 1002, 1003, 1004, 1005]

export function defaultVlanName(id: number): string {
  return 'VLAN' + String(id).padStart(4, '0')
}

/** Fields that must match across EtherChannel members and the port-channel. */
export function l2Signature(c: L2IfConfig): string {
  return JSON.stringify([c.mode, c.accessVlan, c.nativeVlan, c.allowed, c.nonegotiate])
}

export function pickL2(c: L2IfConfig): L2IfConfig {
  return {
    shutdown: c.shutdown,
    description: c.description,
    mode: c.mode,
    accessVlan: c.accessVlan,
    nativeVlan: c.nativeVlan,
    allowed: c.allowed ? [...c.allowed] : null,
    nonegotiate: c.nonegotiate,
    encapDot1q: c.encapDot1q,
    portfast: c.portfast,
  }
}
