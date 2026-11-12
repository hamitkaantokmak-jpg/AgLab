// L5-e: port security (IOS `switchport port-security`), access portlarında.
//
// Kabul kararı yapılandırmadan türetilir: kaynak MAC yapılandırılmış ya da sticky listede ise
// ya da güvenli adres sayısı `maximum`'un altındaysa (ilk çerçevede öğrenilir) uç ağa çıkabilir;
// değilse çerçeveleri portta düşer (shutdown, restrict ve protect modlarında aynı). Dinamik
// güvenli adresler port düşünce silinir (IOS): tek uçlu access portta kabul için yapılandırma
// yeterlidir. İhlalin yan etkileri (err-disable, sayaç, syslog) uç trafik gönderdiğinde
// LabRuntime.hostSends'te uygulanır.

import type { Derived } from './engine'
import type { LabRuntime } from './runtime'
import { pk } from './topology'
import type { PortSecurityConfig, SwitchConfig, SwitchDef } from './types'
import { pad, padL, shortIf } from './util'

export const PS_MAX_LIMIT = 8192

export function defaultPortSecurity(): PortSecurityConfig {
  return { enabled: false, max: 1, violation: 'shutdown', sticky: false, macs: [], stickyMacs: [] }
}

/** Port security of an access port that is switched on; null otherwise. */
export function activePs(cfg: SwitchConfig | undefined, port: string): PortSecurityConfig | null {
  const c = cfg?.ifaces[port]
  if (!c?.portSecurity?.enabled || c.routed || c.mode !== 'access') return null
  return c.portSecurity
}

/** Secure addresses that count against `maximum`. */
export function secureCount(ps: PortSecurityConfig, dynamic: string[] = []): number {
  return ps.macs.length + ps.stickyMacs.length + dynamic.length
}

/** Whether frames from `mac` are accepted on dev/port (a new MAC is learned while room is left). */
export function psAdmits(d: Derived, dev: string, port: string, mac: string): boolean {
  const ps = activePs(d.cfgs[dev], port)
  if (!ps) return true
  if (ps.macs.includes(mac) || ps.stickyMacs.includes(mac)) return true
  return secureCount(ps) < ps.max
}

// ---- running-config ve show ----


/** Interface lines in IOS order (only what differs from the defaults). */
export function psConfigLines(ps: PortSecurityConfig | undefined): string[] {
  if (!ps) return []
  const o: string[] = []
  if (ps.max !== 1) o.push(` switchport port-security maximum ${ps.max}`)
  if (ps.enabled) o.push(' switchport port-security')
  if (ps.violation !== 'shutdown') o.push(` switchport port-security violation ${ps.violation}`)
  if (ps.sticky) o.push(' switchport port-security mac-address sticky')
  for (const m of ps.stickyMacs) o.push(` switchport port-security mac-address sticky ${m}`)
  for (const m of ps.macs) o.push(` switchport port-security mac-address ${m}`)
  return o
}

const ACTION: Record<PortSecurityConfig['violation'], string> = { shutdown: 'Shutdown', restrict: 'Restrict', protect: 'Protect' }
const FOOTER = [
  '---------------------------------------------------------------------------',
  'Total Addresses in System (excluding one mac per port)     : ',
  'Max Addresses limit in System (excluding one mac per port) : 4096',
]

function securePorts(rt: LabRuntime, dev: string): [string, PortSecurityConfig][] {
  const sw = rt.topo.devices[dev] as SwitchDef
  return sw.ports.flatMap((p) => {
    const ps = activePs(rt.running[dev], p)
    return ps ? [[p, ps] as [string, PortSecurityConfig]] : []
  })
}
const dynOf = (rt: LabRuntime, dev: string, port: string) => rt.psDynamic.get(pk(dev, port)) ?? []
/** Addresses beyond the first one per port (IOS footer). */
function extraTotal(rt: LabRuntime, dev: string): number {
  return securePorts(rt, dev).reduce((n, [p, ps]) => n + Math.max(0, secureCount(ps, dynOf(rt, dev, p)) - 1), 0)
}

export function showPortSecurity(rt: LabRuntime, dev: string): string[] {
  const o = [
    'Secure Port  MaxSecureAddr  CurrentAddr  SecurityViolation  Security Action',
    '                (Count)       (Count)          (Count)',
    '---------------------------------------------------------------------------',
  ]
  for (const [p, ps] of securePorts(rt, dev))
    o.push(padL(shortIf(p), 11) + padL(ps.max, 15) + padL(secureCount(ps, dynOf(rt, dev, p)), 13) + padL(rt.psViolations.get(pk(dev, p)) ?? 0, 19) + padL(ACTION[ps.violation], 17))
  o.push(FOOTER[0]!, FOOTER[1]! + extraTotal(rt, dev), FOOTER[2]!)
  return o
}

export function showPortSecurityInterface(rt: LabRuntime, dev: string, port: string): string[] {
  const ps = rt.running[dev]!.ifaces[port]?.portSecurity
  const on = activePs(rt.running[dev], port)
  const key = pk(dev, port)
  const phys = rt.derived.phys[key]
  const status = !on ? 'Secure-down' : phys?.errDisabled ? 'Secure-shutdown' : phys?.up ? 'Secure-up' : 'Secure-down'
  const p = ps ?? { max: 1, violation: 'shutdown' as const, macs: [], stickyMacs: [], sticky: false, enabled: false }
  const dyn = dynOf(rt, dev, port)
  const last = rt.psLast.get(key)
  const vlan = rt.running[dev]!.ifaces[port]?.accessVlan ?? 1
  return [
    `Port Security              : ${on ? 'Enabled' : 'Disabled'}`,
    `Port Status                : ${status}`,
    `Violation Mode             : ${ACTION[p.violation]}`,
    'Aging Time                 : 0 mins',
    'Aging Type                 : Absolute',
    'SecureStatic Address Aging : Disabled',
    `Maximum MAC Addresses      : ${p.max}`,
    `Total MAC Addresses        : ${on ? secureCount(p, dyn) : 0}`,
    `Configured MAC Addresses   : ${p.macs.length}`,
    `Sticky MAC Addresses       : ${p.stickyMacs.length}`,
    `Last Source Address:Vlan   : ${last ? `${last}:${vlan}` : '0000.0000.0000:0'}`,
    `Security Violation Count   : ${rt.psViolations.get(key) ?? 0}`,
  ]
}

export function showPortSecurityAddress(rt: LabRuntime, dev: string): string[] {
  const o = [
    '               Secure Mac Address Table',
    '-----------------------------------------------------------------------------',
    'Vlan    Mac Address       Type                          Ports   Remaining Age',
    '                                                                   (mins)',
    '----    -----------       ----                          -----   -------------',
  ]
  for (const [p, ps] of securePorts(rt, dev)) {
    const vlan = rt.running[dev]!.ifaces[p]!.accessVlan
    const row = (mac: string, type: string) => o.push(padL(vlan, 4) + '    ' + pad(mac, 18) + pad(type, 30) + pad(shortIf(p), 8) + '    -')
    for (const m of ps.macs) row(m, 'SecureConfigured')
    for (const m of ps.stickyMacs) row(m, 'SecureSticky')
    for (const m of dynOf(rt, dev, p)) row(m, 'SecureDynamic')
  }
  o.push('-----------------------------------------------------------------------------', FOOTER[1]! + extraTotal(rt, dev), FOOTER[2]!)
  return o
}
