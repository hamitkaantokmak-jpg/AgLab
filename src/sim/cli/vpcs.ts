// VPCS-style console for a lab PC.

import { httpGet, HTTP_PORT } from '../http'
import { dnsLookup, dnsRecords, isApipa } from '../dhcp'
import { arpMac, ping, traceProbe } from '../net'
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
  'ping <address> [-c count] [-T ttl]  Ping the network host',
  'trace <address> [-m ttl] Print the path packets take to network host',
  'nslookup <name>          Ask the DNS server for the address of a host name',
  'curl [http://]<host>[:port][/path]  Fetch a web page (Labber addition: VPCS has no HTTP client)',
  'help, ?                  Print help',
  '',
]

/** Extra commands of a lab server (PcDef.server). */
const SERVER_HELP = [
  'service dhcp|dns|http on|off  Start or stop a service of this server',
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
    const cmds = ['ip', 'clear', 'show', 'ping', 'trace', 'nslookup', 'curl', 'help', ...(this.def.server ? ['service'] : [])]
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
    if (c === 'curl') return args.length ? this.curl(args) : ["curl: try 'curl --help' for more information"]
    if (this.def.server) {
      const srv = this.server(c, args)
      if (srv) return srv
    }
    if (c === 'show' && (!args[0] || args[0] === 'ip')) return this.showIp()
    if (c === 'show' && args[0] === 'arp') return this.showArp()
    if (c === 'ping' && args[0]) return this.pingCmd(args)
    if ((c === 'trace' || c === 'tracert' || c === 'traceroute') && args[0]) {
      // VPCS: `trace <hedef> [-m ttl]` (en çok atlama; varsayılan 8)
      if (args.length === 1) return this.trace(args[0])
      const m = args[1] === '-m' && /^\d+$/.test(args[2] ?? '') && args.length === 3 ? Number(args[2]) : NaN
      if (!(m >= 1 && m <= 255)) return [`Invalid options: ${args.slice(1).join(' ')}`]
      return this.trace(args[0], m)
    }
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

  /**
   * L5-g: `curl [http://]host[:port][/path]` (VPCS'te HTTP istemcisi yok; Labber eki). Çıktı
   * curl biçiminde: sayfa gövdesi ya da `curl: (N) …` hatası. Ad DNS ile çözülür.
   */
  private curl(args: string[]): string[] {
    const url = args.filter((a) => !a.startsWith('-')).pop()
    if (!url) return ["curl: no URL specified!"]
    const m = /^(?:(https?):\/\/)?([^/:]+)(?::(\d+))?(\/.*)?$/i.exec(url)
    if (!m) return [`curl: (3) URL rejected: Malformed input to a URL function`]
    if (m[1] && m[1].toLowerCase() === 'https') return ['curl: (1) Protocol "https" not supported (Labber: yalnız HTTP)']
    const port = m[3] ? Number(m[3]) : HTTP_PORT
    if (port < 1 || port > 65535) return [`curl: (3) URL rejected: Port number was not a decimal number between 0 and 65535`]
    let host = m[2]!
    if (ipToInt(host) === null) {
      const r = dnsLookup(this.rt.derived, this.dev, host)
      if (!r.ok) return [`curl: (6) Could not resolve host: ${host}`]
      host = r.address
    }
    const c = this.rt.pcs[this.dev]!
    if (!c.ip) return [`curl: (7) Failed to connect to ${host} port ${port}: Network is unreachable`]
    this.rt.hostSends(this.dev)
    const r = httpGet(this.rt.derived, this.dev, host, port)
    this.rt.markSeen(r.forward?.hops ?? [], this.dev)
    this.rt.countAcl(1, r.forward, r.back)
    this.rt.recordNat(1, r.forward, r.back)
    this.rt.emit()
    if (r.ok) {
      const name = (this.rt.topo.devices[r.server] as PcDef).name ?? r.server
      return [`<html><head><title>${name}</title></head><body><h1>${name}</h1><p>Labber web server</p></body></html>`]
    }
    // doğrulanmadı: curl'ün süre değerleri ve ICMP unreachable karşılığı
    if (r.reason === 'refused') return [`curl: (7) Failed to connect to ${host} port ${port} after 1 ms: Connection refused`]
    if (r.reason === 'unreach') return [`curl: (7) Failed to connect to ${host} port ${port} after 1 ms: No route to host`]
    if (r.reason === 'noroute' || r.reason === 'noip') return [`curl: (7) Failed to connect to ${host} port ${port} after 0 ms: Network is unreachable`]
    return [`curl: (28) Failed to connect to ${host} port ${port} after 75000 ms: Connection timed out`]
  }

  /** Server-only commands; null when the line is not one of them. */
  private server(c: string, args: string[]): string[] | null {
    const cfg = this.rt.pcs[this.dev]!
    const a = args.map((x) => x.toLowerCase())
    if (c === 'service') {
      if ((a[0] !== 'dhcp' && a[0] !== 'dns' && a[0] !== 'http') || (a[1] !== 'on' && a[1] !== 'off')) return ['Usage: service dhcp|dns|http on|off']
      cfg.services = { ...(cfg.services ?? {}), [a[0]]: a[1] === 'on' }
      // a stopped DHCP service forgets its leases
      if (a[0] === 'dhcp' && a[1] === 'off') this.rt.dhcpClear(this.dev)
      this.rt.commit()
      return [`${a[0].toUpperCase()} service is ${a[1]}`]
    }
    if (c !== 'show') return null
    if (a[0] === 'services') return ['Service     Status', ...(['dhcp', 'dns', 'http'] as const).map((k) => k.padEnd(12) + (cfg.services?.[k] ? 'on' : 'off')), '']
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

  /** L5-i: VPCS `ping host [-c count] [-T ttl]` (diğer VPCS seçenekleri modellenmez). */
  private pingCmd(args: string[]): string[] {
    let count = 5
    let ttl: number | undefined
    for (let i = 1; i < args.length; i++) {
      const v = args[i + 1]
      const n = v !== undefined && /^\d+$/.test(v) ? Number(v) : NaN
      if (args[i] === '-c' && n >= 1) count = n
      else if (args[i] === '-T' && n >= 1 && n <= 255) ttl = n
      else return [`Invalid options: ${args.slice(i).join(' ')}`]
      i++
    }
    return this.ping(args[0]!, count, ttl)
  }

  private ping(dst: string, count = 5, ttlOut?: number): string[] {
    if (ipToInt(dst) === null) return [`Cannot resolve ${dst}`]
    const c = this.rt.pcs[this.dev]!
    if (!c.ip) return ['No gateway found']
    if (!sameSubnet(c.ip, dst, c.prefix) && !c.gw) return [`host (${dst}) not reachable`, '']
    // L5-e: the PC sends (ARP/ICMP): port security learns or flags its source MAC first
    this.rt.hostSends(this.dev)
    const d = this.rt.derived
    // VPCS varsayılan IP TTL'i 64
    const r = ping(d, this.dev, dst, { ttl: ttlOut ?? 64 })
    this.rt.markSeen(r.forward?.hops ?? [], this.dev)
    this.rt.countAcl(count, r.forward, r.back)
    this.rt.recordNat(count, r.forward, r.back)
    // the first hop answered ARP (target on-link, else the gateway)
    if (r.firstHopArp) this.rt.arp.add(`${this.dev}>${r.firstHopArp.ip}`)
    this.rt.emit()
    const out: string[] = []
    for (let i = 1; i <= count; i++) {
      const t = (0.4 + ((i * 37) % 10) / 10 + (r.ttl && r.ttl < 64 ? 0.8 : 0)).toFixed(3)
      if (r.ok) out.push(`84 bytes from ${dst} icmp_seq=${i} ttl=${r.ttl} time=${t} ms`)
      else if (r.reason === 'expired') out.push(`*${r.expiredFrom} icmp_seq=${i} ttl=255 time=${t} ms (ICMP type:11, code:0, TTL expired in transit)`)
      else if (r.reason === 'unreach') out.push(`*${r.unreachFrom} icmp_seq=${i} ttl=255 time=${t} ms (ICMP type:3, code:1, Destination host unreachable)`)
      else if (r.reason === 'noroute' && !r.forward?.hops.length && c.gw && !sameSubnet(c.ip, dst, c.prefix)) out.push(`host (${c.gw}) not reachable`)
      else out.push(`${dst} icmp_seq=${i} timeout`)
      if (r.reason === 'noroute' && out[out.length - 1]!.startsWith('host')) break
    }
    return ['', ...out, '']
  }

  private trace(dst: string, maxHops = 8): string[] {
    if (ipToInt(dst) === null) return [`Cannot resolve ${dst}`]
    const c = this.rt.pcs[this.dev]!
    if (!c.ip) return ['No gateway found']
    this.rt.hostSends(this.dev)
    // L5-i: VPCS trace: her TTL için UDP sondası (doğrulanmadı: kaynak/hedef port), en çok 8 atlama
    const out = [`trace to ${dst}, ${maxHops} hops max, press Ctrl+C to stop`]
    for (let ttl = 1; ttl <= maxHops; ttl++) {
      const p = traceProbe(this.rt.derived, this.dev, dst, ttl, 33434 + ttl - 1)
      this.rt.markSeen(p.forward.hops, this.dev)
      this.rt.countAcl(1, p.forward, p.back)
      this.rt.recordNat(1, p.forward, p.back)
      const r = p.result
      const ms = (x: number) => (x + ttl * 0.5).toFixed(3) + ' ms'
      if (r.kind === 'none') out.push(` ${ttl}     *  *  *`)
      else if (r.kind === 'hop') out.push(` ${ttl}   ${r.ip}   ${ms(0.1)}  ${ms(0.05)}  ${ms(0.08)}`)
      else if (r.kind === 'dest') out.push(` ${ttl}   *${r.ip}   ${ms(0.2)} (ICMP type:3, code:3, Destination port unreachable)`)
      else
        out.push(` ${ttl}   *${r.ip}   ${ms(0.2)} (ICMP type:3, code:${r.code === 'A' ? 13 : 1}, ${r.code === 'A' ? 'Communication administratively prohibited' : 'Destination host unreachable'})`)
      if (r.kind === 'dest' || r.kind === 'unreach') break
    }
    this.rt.emit()
    return [...out, '']
  }

}
