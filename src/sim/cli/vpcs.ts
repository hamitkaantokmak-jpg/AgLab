// VPCS-style console for a lab PC.

import { arpMac, deliver, ping } from '../net'
import type { LabRuntime } from '../runtime'
import type { PcDef } from '../types'
import { ipToInt, isIp, macToColon, maskToPrefix, prefixToMask, sameSubnet } from '../util'

const HELP = [
  '',
  'ip ARG ... [OPTION]      Configure the current VPC\'s IP settings',
  '  ip <address>/<len> [gateway]',
  '  ip <address> <mask> [gateway]',
  'clear ip                 Clear IP address, mask and gateway',
  'show [arp|ip]            Print the information of the VPC',
  'ping <address>           Ping the network host',
  'trace <address>          Print the path packets take to network host',
  'help, ?                  Print help',
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
    const cmds = ['ip', 'clear', 'show', 'ping', 'trace', 'help']
    const t = line.trim()
    if (!t || t.includes(' ')) return null
    const m = cmds.filter((c) => c.startsWith(t))
    return m.length === 1 ? m[0] + ' ' : null
  }

  help(): string[] {
    return HELP
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
    if (c === '?' || c === 'help') return HELP
    if (c === 'ip') return this.ip(args)
    if (c === 'clear' && args[0] === 'ip') {
      this.rt.pcs[this.dev] = { ip: null, prefix: 24, gw: null }
      this.rt.commit()
      return ['IPv4 address/mask, gateway, DNS, and DHCP cleared']
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
    this.rt.pcs[this.dev] = { ip: addr, prefix, gw }
    this.rt.commit()
    return ['Checking for duplicate address...', `${this.name} : ${addr} ${prefixToMask(prefix)}${gw ? ' gateway ' + gw : ''}`, '']
  }

  private showIp(): string[] {
    const c = this.rt.pcs[this.dev]!
    return [
      '',
      `NAME        : ${this.name}[1]`,
      `IP/MASK     : ${c.ip ? `${c.ip}/${c.prefix}` : '0.0.0.0/0'}`,
      `GATEWAY     : ${c.gw ?? '0.0.0.0'}`,
      'DNS         : ',
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
    const d = this.rt.derived
    const r = ping(d, this.dev, dst)
    this.rt.markSeen(r.forward?.hops ?? [], this.dev)
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
    const r = deliver(this.rt.derived, this.dev, dst)
    this.rt.markSeen(r.hops, this.dev)
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
