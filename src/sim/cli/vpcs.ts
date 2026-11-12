// VPCS-style console for a lab PC.

import { dnsLookup, dnsRecords, isApipa } from '../dhcp'
import { arpMac, deliver, ping } from '../net'
import type { LabRuntime } from '../runtime'
import type { PcDef } from '../types'
import { ipToInt, isIp, macToColon, maskToPrefix, prefixToMask, sameSubnet } from '../util'

const HELP = [
  '',
  'ip ARG ... [OPTION]      Configure the current VPC\'s IP settings',
  '  ip <address>/<len> [gateway]',
  '  ip <address> <mask> [gateway]',
  '  ip dhcp [-r|-x]        Get an address from a DHCP server (-r renew, -x release)',
  '  ip dns <address>       Set the DNS server (0.0.0.0 clears it)',
  'clear ip                 Clear IP address, mask and gateway',
  'show [arp|ip]            Print the information of the VPC',
  'ping <address>           Ping the network host',
  'trace <address>          Print the path packets take to network host',
  'nslookup <name>          Ask the DNS server for the address of a host name',
  'help, ?                  Print help',
  '',
]

/** Extra commands of a lab server (PcDef.server). */
const SERVER_HELP = [
  'service dhcp|dns on|off  Start or stop a service of this server',
  'show services            Print the services and their state',
  'show ip dhcp binding     Print the addresses this server leased',
  'show dns                 Print the host names this server resolves',
  '',
]

export class VpcsSession {
  history: string[] = []
  /** shown name (prompt, `show ip`); the host app may set its own device label */
  name: string
  constructor(
    public rt: LabRuntime,
    public dev: string,
  ) {
    this.name = dev
  }

  get def(): PcDef {
    return this.rt.topo.devices[this.dev] as PcDef
  }

  prompt(): string {
    return this.name + '> '
  }

  complete(line: string): string | null {
    const cmds = ['ip', 'clear', 'show', 'ping', 'trace', 'nslookup', 'help', ...(this.def.server ? ['service'] : [])]
    const t = line.trim()
    if (!t || t.includes(' ')) return null
    const m = cmds.filter((c) => c.startsWith(t))
    return m.length === 1 ? m[0] + ' ' : null
  }

  help(): string[] {
    return this.def.server ? [...HELP, ...SERVER_HELP] : HELP
  }

  ctrlZ(): string[] {
    return []
  }

  exec(raw: string): string[] {
    const line = raw.trim()
    if (!line) return []
    this.history.push(line)
    const [cmd, ...args] = line.split(/\s+/)
    const c = cmd!.toLowerCase()
    if (c === '?' || c === 'help') return this.help()
    if (c === 'ip' && args[0]?.toLowerCase() === 'dhcp') return this.dhcp(args.slice(1))
    if (c === 'dhcp') return this.dhcp(args)
    if (c === 'ip' && args[0]?.toLowerCase() === 'dns') return this.setDns(args[1])
    if (c === 'ip') return this.ip(args)
    if (c === 'clear' && args[0] === 'ip') {
      // the lease is given back; a server keeps its services
      this.rt.dhcpRelease(this.dev)
      return ['IPv4 address/mask, gateway, DNS, and DHCP cleared']
    }
    if (c === 'nslookup') return args[0] ? this.nslookup(args[0]) : ['Incomplete command.']
    if (this.def.server) {
      const srv = this.server(c, args)
      if (srv) return srv
    }
    if (c === 'show' && (!args[0] || args[0] === 'ip')) return this.showIp()
    if (c === 'show' && args[0] === 'arp') return this.showArp()
    if (c === 'ping' && args[0]) return this.ping(args[0])
    if ((c === 'trace' || c === 'tracert' || c === 'traceroute') && args[0]) return this.trace(args[0])
    return ['Bad command: "' + line + '". Use ? for help.']
  }

  private ip(args: string[]): string[] {
    if (!args.length) return ['Incomplete command.']
    let addr: string
    let prefix: number
    let gw: string | null = null
    const slash = /^(\S+)\/(\d+)$/.exec(args[0]!)
    if (slash) {
      addr = slash[1]!
      prefix = Number(slash[2])
      gw = args[1] ?? null
    } else if (args[1] && isIp(args[1])) {
      const m = maskToPrefix(args[1])
      if (m === null) return ['Invalid netmask']
      addr = args[0]!
      prefix = m
      gw = args[2] ?? null
    } else if (args[1] && /^\d+$/.test(args[1])) {
      addr = args[0]!
      prefix = Number(args[1])
      gw = args[2] ?? null
    } else {
      addr = args[0]!
      prefix = 24
    }
    if (!isIp(addr) || prefix < 1 || prefix > 30) return ['Invalid address']
    if (gw && !isIp(gw)) return ['Invalid gateway']
    if (gw && !sameSubnet(addr, gw, prefix)) return ['Gateway is not in the same subnet']
    // a static address replaces a DHCP one; the DNS server and a server's services stay
    const old = this.rt.pcs[this.dev]!
    this.rt.pcs[this.dev] = { ip: addr, prefix, gw, ...(old.dns ? { dns: old.dns } : {}), ...(old.services ? { services: old.services } : {}) }
    this.rt.commit()
    return ['Checking for duplicate address...', `${this.name} : ${addr} ${prefixToMask(prefix)}${gw ? ' gateway ' + gw : ''}`, '']
  }

  /** `ip dhcp` (also `dhcp`): -x releases, anything else asks for a (new) lease. */
  private dhcp(args: string[]): string[] {
    const opt = args[0]?.toLowerCase()
    if (opt && opt !== '-r' && opt !== '-x') return ['Invalid options']
    this.rt.hostSends(this.dev)
    if (opt === '-x') {
      this.rt.dhcpRelease(this.dev)
      return []
    }
    const r = this.rt.dhcpRequest(this.dev)
    const c = this.rt.pcs[this.dev]!
    if (r.ok) return [`DDORA IP ${c.ip}/${c.prefix}` + (c.gw ? ` GW ${c.gw}` : ''), '']
    return ['DDD', "Can't find dhcp server", `Autoconfiguration IPv4 address ${c.ip}/${c.prefix} (no DHCP lease)`, '']
  }

  private setDns(addr: string | undefined): string[] {
    if (!addr) return ['Incomplete command.']
    if (!isIp(addr)) return ['Invalid address']
    const c = this.rt.pcs[this.dev]!
    if (addr === '0.0.0.0') delete c.dns
    else c.dns = addr
    this.rt.commit()
    return []
  }

  /** Windows-style `nslookup <name>` through the configured DNS server. */
  private nslookup(name: string): string[] {
    const r = dnsLookup(this.rt.derived, this.dev, name)
    if (r.ok) return ['Server:  UnKnown', `Address:  ${r.server}`, '', `Name:    ${r.name}`, `Address:  ${r.address}`, '']
    if (r.reason === 'noserver') return ['*** Default servers are not available', '']
    if (r.reason === 'timeout') return ['DNS request timed out.', '    timeout was 2 seconds.', '*** Request to UnKnown timed-out', '']
    return ['Server:  UnKnown', `Address:  ${r.server}`, '', `*** UnKnown can't find ${name}: Non-existent domain`, '']
  }

  /** Server-only commands; null when the line is not one of them. */
  private server(c: string, args: string[]): string[] | null {
    const cfg = this.rt.pcs[this.dev]!
    const a = args.map((x) => x.toLowerCase())
    if (c === 'service') {
      if ((a[0] !== 'dhcp' && a[0] !== 'dns') || (a[1] !== 'on' && a[1] !== 'off')) return ['Usage: service dhcp|dns on|off']
      cfg.services = { ...(cfg.services ?? {}), [a[0]]: a[1] === 'on' }
      // a stopped DHCP service forgets its leases
      if (a[0] === 'dhcp' && a[1] === 'off') this.rt.dhcpClear(this.dev)
      this.rt.commit()
      return [`${a[0].toUpperCase()} service is ${a[1]}`]
    }
    if (c !== 'show') return null
    if (a[0] === 'services') return ['Service     Status', ...(['dhcp', 'dns'] as const).map((k) => k.padEnd(12) + (cfg.services?.[k] ? 'on' : 'off')), '']
    if (a[0] === 'ip' && a[1] === 'dhcp' && a[2] === 'binding') {
      const rows = this.rt.dhcp.filter((b) => b.server === this.dev)
      return ['IP address       Hardware address     Lease expiration', ...rows.map((b) => b.ip.padEnd(17) + b.mac.padEnd(21) + b.expires), '']
    }
    if (a[0] === 'dns') {
      if (!cfg.services?.dns) return ['DNS service is off', '']
      return ['Name                 Address', ...dnsRecords(this.rt.derived).map((x) => x.name.padEnd(21) + x.address), '']
    }
    return null
  }

  private showIp(): string[] {
    const c = this.rt.pcs[this.dev]!
    const lease = this.rt.dhcpLeaseOf(this.dev)
    return [
      '',
      `NAME        : ${this.name}[1]`,
      `IP/MASK     : ${c.ip ? `${c.ip}/${c.prefix}` : '0.0.0.0/0'}`,
      `GATEWAY     : ${c.gw ?? '0.0.0.0'}`,
      `DNS         : ${c.dns ?? ''}`,
      ...(lease ? [`DHCP SERVER : ${lease.serverIp}`] : c.dhcp && c.ip && isApipa(c.ip) ? ['DHCP SERVER : none (autoconfiguration address)'] : []),
      `MAC         : ${macToColon(this.def.mac)}`,
      'LPORT       : 20000',
      'RHOST:PORT  : 127.0.0.1:30000',
      'MTU         : 1500',
      '',
    ]
  }

  /** VPCS `show arp`: entries the PC resolved itself (120 s lifetime, shown fresh). */
  private showArp(): string[] {
    const d = this.rt.derived
    const out: string[] = []
    for (const k of this.rt.arp) {
      if (!k.startsWith(this.dev + '>')) continue
      const ip = k.split('>')[1]!
      const now = arpMac(d, this.dev, ip)
      if (now) out.push(`${macToColon(now.mac)}  ${ip} expires in 120 seconds `)
    }
    return ['', ...(out.length ? out : ['arp table is empty']), '']
  }

  private ping(dst: string): string[] {
    if (ipToInt(dst) === null) return [`Cannot resolve ${dst}`]
    const c = this.rt.pcs[this.dev]!
    if (!c.ip) return ['No gateway found']
    if (!sameSubnet(c.ip, dst, c.prefix) && !c.gw) return [`host (${dst}) not reachable`, '']
    // L5-e: the PC sends (ARP/ICMP): port security learns or flags its source MAC first
    this.rt.hostSends(this.dev)
    const d = this.rt.derived
    const r = ping(d, this.dev, dst)
    this.rt.markSeen(r.forward?.hops ?? [], this.dev)
    this.rt.countAcl(5, r.forward, r.back)
    this.rt.recordNat(5, r.forward, r.back)
    // the first hop answered ARP (target on-link, else the gateway)
    if (r.firstHopArp) this.rt.arp.add(`${this.dev}>${r.firstHopArp.ip}`)
    this.rt.emit()
    const out: string[] = []
    for (let i = 1; i <= 5; i++) {
      const t = (0.4 + ((i * 37) % 10) / 10 + (r.ttl && r.ttl < 64 ? 0.8 : 0)).toFixed(3)
      if (r.ok) out.push(`84 bytes from ${dst} icmp_seq=${i} ttl=${r.ttl} time=${t} ms`)
      else if (r.reason === 'unreach') out.push(`*${r.unreachFrom} icmp_seq=${i} ttl=255 time=${t} ms (ICMP type:3, code:1, Destination host unreachable)`)
      else if (r.reason === 'noroute' && !r.forward?.hops.length && c.gw && !sameSubnet(c.ip, dst, c.prefix)) out.push(`host (${c.gw}) not reachable`)
      else out.push(`${dst} icmp_seq=${i} timeout`)
      if (r.reason === 'noroute' && out[out.length - 1]!.startsWith('host')) break
    }
    return ['', ...out, '']
  }

  private trace(dst: string): string[] {
    if (ipToInt(dst) === null) return [`Cannot resolve ${dst}`]
    const c = this.rt.pcs[this.dev]!
    if (!c.ip) return ['No gateway found']
    this.rt.hostSends(this.dev)
    // VPCS trace: UDP probes by default (doğrulanmadı: kaynak ve hedef port)
    const r = deliver(this.rt.derived, this.dev, dst, { proto: 'udp', sport: 49152, dport: 33434 })
    this.rt.markSeen(r.hops, this.dev)
    this.rt.countAcl(1, r)
    this.rt.recordNat(1, r)
    const out = [`trace to ${dst}, 8 hops max, press Ctrl+C to stop`]
    r.hops.forEach((h, i) => {
      const last = r.kind === 'ok' && i === r.hops.length - 1
      out.push(` ${i + 1}   ${last ? '*' : ''}${h.ip}   ${(0.5 + i).toFixed(3)} ms  ${(0.4 + i).toFixed(3)} ms  ${(0.6 + i).toFixed(3)} ms`)
    })
    if (r.kind === 'unreach') out.push(` ${r.hops.length + 1}   *${r.atIp}   1.000 ms (ICMP type:3, code:1, Destination host unreachable)`)
    else if (r.kind !== 'ok') for (let i = r.hops.length + 1; i <= Math.min(8, r.hops.length + 3); i++) out.push(` ${i}     *  *  *`)
    return [...out, '']
  }
}
