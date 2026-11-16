// IP SLA (icmp-echo) ve nesne izleme (track): IOS 15 davranışı. Statik rota bir track'e
// bağlanabilir; track Down iken rota kurulmaz, aynı hedefe yüksek AD'li yedek (floating static)
// devreye girer. Her davranış hem başarılı hem başarısız durumla sınanır.
import { describe, expect, it } from 'vitest'
import { createLab, createSession, runScript, type VpcsSession } from '../../src/sim'
import { applyConfigText } from '../../src/sim/config-text'
import { routeTable, traceProbe } from '../../src/sim/net'
import { LabQuery } from '../../src/sim/query'
import type { LabRuntime } from '../../src/sim/runtime'
import type { LabDef } from '../../src/sim/types'
import { ports } from '../../src/sim/util'

const router = (id: string, n: number) => ({ id, kind: 'switch' as const, router: true, model: 'ISR4331', mac: `5254.00${n}0.0000`, ports: ports('Gi0/0-2'), x: 0, y: 0 })
const pc = (id: string, n: number) => ({ id, kind: 'pc' as const, mac: `0050.0000.00${n}0`, x: 0, y: 0 })

/**
 * H1 — R1 — ISP (switch) — R2 — H2: birincil hat (10.0.12.0/30). R1'in Gi0/1'i switch'e bağlı
 * olduğu için switch–R2 kablosu kopunca R1 tarafı up/up kalır (arayüz izleme bunu görmez).
 * Yedek yol R1 — R3 — R2 (10.0.13.0/30, 10.0.23.0/30).
 */
function lab(extra: Record<string, string> = {}): LabDef {
  const lines = (dev: string, base: string[]) => [...base, ...(extra[dev] ? extra[dev]!.split('\n') : [])].join('\n')
  return {
    id: 'ip-sla', title: '', summary: '', level: 'İleri', tags: [], brief: [], objectives: [], solution: {}, view: { w: 1, h: 1 },
    devices: [
      { id: 'ISP', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0090.0000', ports: ports('Fa0/1-24', 'Gi0/1-2'), x: 0, y: 0 },
      router('R1', 1), router('R2', 2), router('R3', 3), pc('H1', 1), pc('H2', 2),
    ],
    links: [
      { a: ['H1', 'eth0'], b: ['R1', 'GigabitEthernet0/0'] },
      { a: ['R1', 'GigabitEthernet0/1'], b: ['ISP', 'FastEthernet0/1'] },
      { a: ['ISP', 'FastEthernet0/2'], b: ['R2', 'GigabitEthernet0/1'] },
      { a: ['R1', 'GigabitEthernet0/2'], b: ['R3', 'GigabitEthernet0/2'] },
      { a: ['R3', 'GigabitEthernet0/1'], b: ['R2', 'GigabitEthernet0/2'] },
      { a: ['R2', 'GigabitEthernet0/0'], b: ['H2', 'eth0'] },
    ],
    initialConfig: {
      R1: lines('R1', [
        'interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown',
        'interface g0/1', 'ip address 10.0.12.1 255.255.255.252', 'no shutdown',
        'interface g0/2', 'ip address 10.0.13.1 255.255.255.252', 'no shutdown',
        'exit',
      ]),
      R2: [
        'interface g0/0', 'ip address 192.168.2.1 255.255.255.0', 'no shutdown',
        'interface g0/1', 'ip address 10.0.12.2 255.255.255.252', 'no shutdown',
        'interface g0/2', 'ip address 10.0.23.2 255.255.255.252', 'no shutdown',
        'exit', 'ip route 0.0.0.0 0.0.0.0 10.0.12.1', 'ip route 0.0.0.0 0.0.0.0 10.0.23.1 250',
      ].join('\n'),
      R3: [
        'interface g0/2', 'ip address 10.0.13.2 255.255.255.252', 'no shutdown',
        'interface g0/1', 'ip address 10.0.23.1 255.255.255.252', 'no shutdown',
        'exit', 'ip route 192.168.1.0 255.255.255.0 10.0.13.1', 'ip route 192.168.2.0 255.255.255.0 10.0.23.2',
      ].join('\n'),
    },
    initialPcs: { H1: { ip: '192.168.1.10', prefix: 24, gw: '192.168.1.1' }, H2: { ip: '192.168.2.20', prefix: 24, gw: '192.168.2.1' } },
  }
}

/** Birincil varsayılan rota track 1'e bağlı; yedek AD 250. */
const TRACKED = [
  'ip sla 1', 'icmp-echo 10.0.12.2 source-interface g0/1', 'frequency 10', 'exit',
  'ip sla schedule 1 life forever start-time now',
  'track 1 ip sla 1 reachability', 'delay down 10 up 5', 'exit',
  'ip route 0.0.0.0 0.0.0.0 10.0.12.2 track 1',
  'ip route 0.0.0.0 0.0.0.0 10.0.13.2 250',
].join('\n')

const run = (rt: LabRuntime, dev: string, cmd: string) => runScript(rt, dev, cmd).join('\n')
const cfg = (rt: LabRuntime, dev: string, script: string) => runScript(rt, dev, 'configure terminal\n' + script + '\nend')
const bad = (out: string[]) => out.filter((l) => /^%/.test(l.trim()))
const q = (rt: LabRuntime) => rt.query()
const defaults = (rt: LabRuntime) =>
  routeTable(rt.derived, 'R1')
    .filter((e) => e.code === 'S' && e.prefix === 0)
    .map((e) => `${e.nh} ${e.ad ?? 1}`)
const h1Ping = (rt: LabRuntime) => (createSession(rt, 'H1') as VpcsSession).exec('ping 192.168.2.20').join('\n')
/** ISP–R2 kablosu kopar: R1 Gi0/1 up/up kalır, ötesi ulaşılmaz. */
const cutBeyond = (rt: LabRuntime) => rt.setLink('ISP', 'FastEthernet0/2', false)

describe('IP SLA + track + statik rota', () => {
  it('yapılandırma komutları hatasız; kipler ve istemler IOS gibi', () => {
    const rt = createLab(lab())
    const s = createSession(rt, 'R1')
    const out: string[] = []
    for (const l of ['enable', 'configure terminal', 'ip sla 1']) out.push(...s.exec(l))
    expect(s.prompt()).toBe('R1(config-ip-sla)#')
    out.push(...s.exec('icmp-echo 10.0.12.2 source-interface g0/1'))
    expect(s.prompt()).toBe('R1(config-ip-sla-echo)#')
    out.push(...s.exec('frequency 10'), ...s.exec('exit'), ...s.exec('ip sla schedule 1 life forever start-time now'))
    out.push(...s.exec('track 1 ip sla 1 reachability'))
    expect(s.prompt()).toBe('R1(config-track)#')
    out.push(...s.exec('delay down 10 up 5'), ...s.exec('exit'), ...s.exec('ip route 0.0.0.0 0.0.0.0 10.0.12.2 track 1'))
    expect(bad(out)).toEqual([])
    // çalışan SLA değiştirilemez (IOS: silip yeniden kurulur)
    expect(s.exec('ip sla 1').join('\n')).toMatch(/already running and cannot be modified/)
  })

  it('SLA hedefe ulaşıyor → track Up → birincil statik rota tabloda', () => {
    const rt = createLab(lab({ R1: TRACKED }))
    expect(q(rt).ipSla('R1', 1)).toEqual({ configured: true, scheduled: true, ok: true, flapping: false })
    expect(q(rt).track('R1', 1)).toEqual({ up: true, type: 'ip sla' })
    expect(defaults(rt)).toEqual(['10.0.12.2 1'])
    expect(q(rt).route('R1', '0.0.0.0', 0)?.nh).toBe('10.0.12.2')
    expect(h1Ping(rt)).toMatch(/bytes from 192\.168\.2\.20/)
    const show = run(rt, 'R1', 'show track 1')
    expect(show).toContain('Track 1\n  IP SLA 1 reachability\n  Reachability is Up')
    expect(show).toContain('  Delay up 5 secs, down 10 secs')
    expect(show).toMatch(/Tracked by:\n\s+Static IP Routing 0/)
    expect(run(rt, 'R1', 'show ip sla statistics 1')).toContain('Latest operation return code: OK')
    expect(run(rt, 'R1', 'show ip route static')).toContain('S*    0.0.0.0/0 [1/0] via 10.0.12.2')
  })

  it('birincil hattın ötesi kopuk (Gi0/1 up/up) → track Down → AD 250 yedek; ping yedek yoldan', () => {
    const rt = createLab(lab({ R1: TRACKED }))
    cutBeyond(rt)
    expect(run(rt, 'R1', 'show ip interface brief')).toMatch(/GigabitEthernet0\/1\s+10\.0\.12\.1\s+YES \S+\s+up\s+up/)
    expect(q(rt).ipSla('R1', 1)).toEqual({ configured: true, scheduled: true, ok: false, flapping: false })
    expect(q(rt).track('R1', 1)).toEqual({ up: false, type: 'ip sla' })
    expect(defaults(rt)).toEqual(['10.0.13.2 250'])
    expect(h1Ping(rt)).toMatch(/bytes from 192\.168\.2\.20/)
    // traceroute: ikinci atlama yedek next-hop (R3)
    const hop2 = traceProbe(rt.derived, 'H1', '192.168.2.20', 2, 33434).result
    expect(hop2).toEqual({ kind: 'hop', ip: '10.0.13.2' })
    expect(run(rt, 'R1', 'show track 1')).toContain('  Reachability is Down')
    expect(run(rt, 'R1', 'show ip sla statistics 1')).toMatch(/Latest operation return code: (Timeout|No connection)/)
    expect(run(rt, 'R1', 'show ip route static')).not.toContain('via 10.0.12.2')
    // hat geri gelince birincil yeniden kurulur; değişim sayacı artar
    rt.setLink('ISP', 'FastEthernet0/2', true)
    expect(defaults(rt)).toEqual(['10.0.12.2 1'])
    expect(run(rt, 'R1', 'show track 1')).toMatch(/Reachability is Up\n\s+3 changes, last change/)
  })

  it('track\'siz statik rota aynı durumda tabloda kalır (trafik kara deliğe gider)', () => {
    const rt = createLab(lab({ R1: 'ip route 0.0.0.0 0.0.0.0 10.0.12.2\nip route 0.0.0.0 0.0.0.0 10.0.13.2 250' }))
    cutBeyond(rt)
    expect(defaults(rt)).toEqual(['10.0.12.2 1'])
    expect(h1Ping(rt)).not.toMatch(/bytes from/)
  })

  it('zamanlanmamış SLA çalışmaz → track Down; no ip sla schedule ile de', () => {
    const unscheduled = TRACKED.replace('ip sla schedule 1 life forever start-time now\n', '')
    const rt = createLab(lab({ R1: unscheduled }))
    expect(q(rt).ipSla('R1', 1)).toEqual({ configured: true, scheduled: false, ok: false, flapping: false })
    expect(q(rt).track('R1', 1)).toEqual({ up: false, type: 'ip sla' })
    expect(defaults(rt)).toEqual(['10.0.13.2 250'])
    expect(run(rt, 'R1', 'show ip sla summary')).toMatch(/~1\s+icmp-echo\s+10\.0\.12\.2/)
    cfg(rt, 'R1', 'ip sla schedule 1 life forever start-time now')
    expect(q(rt).track('R1', 1).up).toBe(true)
    expect(run(rt, 'R1', 'show ip sla summary')).toMatch(/\*1\s+icmp-echo\s+10\.0\.12\.2\s+RTT=\d+\s+OK/)
    cfg(rt, 'R1', 'no ip sla schedule 1')
    expect(q(rt).track('R1', 1).up).toBe(false)
    cfg(rt, 'R1', 'ip sla schedule 1 life forever start-time now\nno ip sla 1')
    expect(q(rt).ipSla('R1', 1)).toEqual({ configured: false, scheduled: false, ok: false, flapping: false })
    expect(q(rt).track('R1', 1).up).toBe(false)
  })

  it('track state anahtar sözcüğü de başarılıyı Up sayar; tanımsız track\'e bağlı rota kurulmaz', () => {
    const rt = createLab(lab({ R1: TRACKED.replace('track 1 ip sla 1 reachability', 'track 1 ip sla 1 state') }))
    expect(q(rt).track('R1', 1)).toEqual({ up: true, type: 'ip sla' })
    expect(run(rt, 'R1', 'show track 1')).toContain('  IP SLA 1 state\n  State is Up')
    cfg(rt, 'R1', 'ip route 172.16.0.0 255.255.0.0 10.0.12.2 track 9')
    expect(q(rt).route('R1', '172.16.0.0', 16)).toBeUndefined()
  })

  it('yoklama hedefine birincil hattan host rotası yoksa dalgalanma; /32 eklenince kalkar', () => {
    // hedef uzak LAN (192.168.2.1): track Down olunca yoklama yedek varsayılan rotadan başarılı olur
    const flappy = TRACKED.replace('icmp-echo 10.0.12.2 source-interface g0/1', 'icmp-echo 192.168.2.1')
    const rt = createLab(lab({ R1: flappy }))
    expect(q(rt).ipSla('R1', 1).ok).toBe(true)
    cutBeyond(rt)
    expect(q(rt).ipSla('R1', 1)).toEqual({ configured: true, scheduled: true, ok: false, flapping: true })
    expect(q(rt).track('R1', 1).up).toBe(false)
    expect(defaults(rt)).toEqual(['10.0.13.2 250'])
    expect(run(rt, 'R1', 'show track 1')).toMatch(/flapping/i)
    cfg(rt, 'R1', 'ip route 192.168.2.1 255.255.255.255 10.0.12.2')
    expect(q(rt).ipSla('R1', 1)).toEqual({ configured: true, scheduled: true, ok: false, flapping: false })
    expect(run(rt, 'R1', 'show track 1')).not.toMatch(/flapping/i)
    expect(defaults(rt)).toEqual(['10.0.13.2 250'])
  })

  it('track interface line-protocol de statik rotayı yönetir; FHRP track yeni tiple çalışır', () => {
    const rt = createLab(lab({ R1: 'track 2 interface g0/1 line-protocol\nexit\nip route 0.0.0.0 0.0.0.0 10.0.12.2 track 2\nip route 0.0.0.0 0.0.0.0 10.0.13.2 250' }))
    expect(q(rt).track('R1', 2)).toEqual({ up: true, type: 'interface' })
    expect(defaults(rt)).toEqual(['10.0.12.2 1'])
    cutBeyond(rt) // arayüz up/up: line-protocol izleme kopukluğu görmez
    expect(defaults(rt)).toEqual(['10.0.12.2 1'])
    rt.setLink('R1', 'GigabitEthernet0/1', false)
    expect(q(rt).track('R1', 2).up).toBe(false)
    expect(defaults(rt)).toEqual(['10.0.13.2 250'])
    // HSRP: standby … track <ip sla nesnesi>
    const fh = createLab(lab({ R1: TRACKED + '\ninterface g0/0\nstandby 1 ip 192.168.1.254\nstandby 1 priority 110\nstandby 1 track 1 decrement 20' }))
    expect(run(fh, 'R1', 'show standby')).toContain('  Priority 110 (configured 110)\n    Track object 1 state Up decrement 20')
    cutBeyond(fh)
    expect(run(fh, 'R1', 'show standby')).toContain('  Priority 90 (configured 110)\n    Track object 1 state Down decrement 20')
    expect(run(fh, 'R1', 'show track 1')).toMatch(/Tracked by:\n(\s+.*\n)*\s+HSRP GigabitEthernet0\/0 1/)
  })

  it('show ip sla configuration, running-config ve config-text gidiş-dönüşü', () => {
    const rt = createLab(lab({ R1: TRACKED.replace('icmp-echo 10.0.12.2 source-interface g0/1', 'icmp-echo 10.0.12.2 source-ip 10.0.12.1') }))
    const conf = run(rt, 'R1', 'show ip sla configuration 1')
    expect(conf).toContain('Type of operation to perform: icmp-echo')
    expect(conf).toContain('Target address/Source address: 10.0.12.2/10.0.12.1')
    expect(conf).toContain('Operation frequency (seconds): 10')
    const rc = run(rt, 'R1', 'show running-config')
    expect(rc).toContain('track 1 ip sla 1 reachability\n delay down 10 up 5\n!')
    expect(rc).toContain('ip route 0.0.0.0 0.0.0.0 10.0.12.2 track 1\nip route 0.0.0.0 0.0.0.0 10.0.13.2 250')
    expect(rc).toContain('ip sla 1\n icmp-echo 10.0.12.2 source-ip 10.0.12.1\n frequency 10\nip sla schedule 1 life forever start-time now')
    // running-config başka bir router'a metin olarak uygulanır: aynı satırlar geri gelir
    const back = createLab(lab())
    // istem ve "Building configuration..." başlığı dışında, ilk `!` satırından itibaren
    const lines = applyConfigText(back, 'R1', rc.slice(rc.indexOf('\n!') + 1))
    // (Labber'ın kendi `no aaa new-model`, `ip forward-protocol nd` … satırları bu işin kapsamı dışında)
    const ours = lines.filter((l) => /sla|track|ip route|delay|icmp-echo|frequency/.test(l.command))
    expect(ours.length).toBeGreaterThanOrEqual(7)
    expect(ours.filter((l) => l.status !== 'applied')).toEqual([])
    const rc2 = run(back, 'R1', 'show running-config')
    for (const l of ['ip sla 1', ' icmp-echo 10.0.12.2 source-ip 10.0.12.1', ' frequency 10', 'ip sla schedule 1 life forever start-time now', 'track 1 ip sla 1 reachability', ' delay down 10 up 5', 'ip route 0.0.0.0 0.0.0.0 10.0.12.2 track 1'])
      expect(rc2.split('\n')).toContain(l)
    expect(new LabQuery(back.derived).track('R1', 1)).toEqual({ up: true, type: 'ip sla' })
  })

  it('geçersiz girdiler reddedilir', () => {
    const rt = createLab(lab())
    expect(cfg(rt, 'R1', 'ip sla schedule 7 life forever start-time now').join('\n')).toMatch(/%/)
    expect(cfg(rt, 'R1', 'ip sla 2\nicmp-echo 10.0.12.2 source-interface g0/5').join('\n')).toMatch(/%/)
    expect(q(rt).ipSla('R1', 2).configured).toBe(true)
  })
})

/**
 * OSPF + track: iki ASBR. R1 (birincil) internete ISP switch'i üzerinden, R2 (yedek) doğrudan
 * bağlı; iç router R3 OSPF ile ikisinden varsayılan rota öğrenir. R3–R2 maliyeti yüksek: E2
 * eşitliğinde R1 seçilir. NET internet router'ı, WEB 8.8.8.8.
 */
function ospfLab(extra: Record<string, string> = {}): LabDef {
  const lines = (dev: string, base: string[]) => [...base, ...(extra[dev] ? extra[dev]!.split('\n') : [])].join('\n')
  return {
    id: 'ospf-track', title: '', summary: '', level: 'İleri', tags: [], brief: [], objectives: [], solution: {}, view: { w: 1, h: 1 },
    devices: [
      { id: 'ISP', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0090.0000', ports: ports('Fa0/1-24', 'Gi0/1-2'), x: 0, y: 0 },
      router('R1', 1), router('R2', 2), router('R3', 3), router('NET', 4), pc('H3', 3), pc('WEB', 4),
    ],
    links: [
      { a: ['H3', 'eth0'], b: ['R3', 'GigabitEthernet0/0'] },
      { a: ['R3', 'GigabitEthernet0/1'], b: ['R1', 'GigabitEthernet0/0'] },
      { a: ['R3', 'GigabitEthernet0/2'], b: ['R2', 'GigabitEthernet0/0'] },
      { a: ['R1', 'GigabitEthernet0/1'], b: ['ISP', 'FastEthernet0/1'] },
      { a: ['ISP', 'FastEthernet0/2'], b: ['NET', 'GigabitEthernet0/1'] },
      { a: ['R2', 'GigabitEthernet0/1'], b: ['NET', 'GigabitEthernet0/2'] },
      { a: ['NET', 'GigabitEthernet0/0'], b: ['WEB', 'eth0'] },
    ],
    initialConfig: {
      R3: [
        'interface g0/0', 'ip address 192.168.3.1 255.255.255.0', 'no shutdown',
        'interface g0/1', 'ip address 10.0.13.2 255.255.255.252', 'no shutdown',
        'interface g0/2', 'ip address 10.0.23.2 255.255.255.252', 'ip ospf cost 100', 'no shutdown',
        'router ospf 1', 'router-id 3.3.3.3', 'network 10.0.0.0 0.255.255.255 area 0', 'network 192.168.3.0 0.0.0.255 area 0',
      ].join('\n'),
      R1: lines('R1', [
        'interface g0/0', 'ip address 10.0.13.1 255.255.255.252', 'no shutdown',
        'interface g0/1', 'ip address 203.0.113.1 255.255.255.252', 'no shutdown',
        'exit',
        'ip sla 1', 'icmp-echo 203.0.113.2 source-interface g0/1', 'exit',
        'ip sla schedule 1 life forever start-time now',
        'track 1 ip sla 1 reachability', 'exit',
        'ip route 0.0.0.0 0.0.0.0 203.0.113.2 track 1',
        'router ospf 1', 'router-id 1.1.1.1', 'network 10.0.0.0 0.255.255.255 area 0',
      ]),
      R2: [
        'interface g0/0', 'ip address 10.0.23.1 255.255.255.252', 'ip ospf cost 100', 'no shutdown',
        'interface g0/1', 'ip address 198.51.100.1 255.255.255.252', 'no shutdown',
        'exit', 'ip route 0.0.0.0 0.0.0.0 198.51.100.2',
        'router ospf 1', 'router-id 2.2.2.2', 'network 10.0.0.0 0.255.255.255 area 0', 'default-information originate',
      ].join('\n'),
      NET: [
        'interface g0/0', 'ip address 8.8.8.1 255.255.255.0', 'no shutdown',
        'interface g0/1', 'ip address 203.0.113.2 255.255.255.252', 'no shutdown',
        'interface g0/2', 'ip address 198.51.100.2 255.255.255.252', 'no shutdown',
        'exit', 'ip route 192.168.3.0 255.255.255.0 203.0.113.1', 'ip route 192.168.3.0 255.255.255.0 198.51.100.1 250',
      ].join('\n'),
    },
    initialPcs: { H3: { ip: '192.168.3.10', prefix: 24, gw: '192.168.3.1' }, WEB: { ip: '8.8.8.8', prefix: 24, gw: '8.8.8.1' } },
  }
}

/** ISP–NET kablosu kopar: R1 Gi0/1 up/up kalır, R1'in SLA'sı Down olur. */
const cutR1Uplink = (rt: LabRuntime, up = false) => rt.setLink('ISP', 'FastEthernet0/2', up)
const r3Default = (rt: LabRuntime) => {
  const e = rt.query().route('R3', '0.0.0.0', 0)
  return e ? `${e.code} ${(e.paths ?? [{ nh: e.nh }]).map((p) => p.nh).join(',')}` : null
}
const h3Web = (rt: LabRuntime) => (createSession(rt, 'H3') as VpcsSession).exec('ping 8.8.8.8').join('\n')

describe('OSPF dış rotaları track\'e uyar', () => {
  it('default-information originate: R1 track Down → R3 varsayılanı R2\'ye geçer; Up → R1\'e döner', () => {
    const rt = createLab(ospfLab({ R1: 'default-information originate' }))
    expect(q(rt).track('R1', 1).up).toBe(true)
    expect(r3Default(rt)).toBe('O E2 10.0.13.1')
    expect(h3Web(rt)).toMatch(/bytes from 8\.8\.8\.8/)
    expect(run(rt, 'R1', 'show ip ospf')).toContain('It is an autonomous system boundary router')
    cutR1Uplink(rt)
    expect(q(rt).track('R1', 1).up).toBe(false)
    expect(r3Default(rt)).toBe('O E2 10.0.23.1')
    expect(run(rt, 'R3', 'show ip route')).toContain('O*E2  0.0.0.0/0 [110/1] via 10.0.23.1')
    expect(run(rt, 'R3', 'show ip route')).not.toContain('via 10.0.13.1, 00:')
    // R1 artık ASBR değil: varsayılanı R2'den öğrenir
    expect(run(rt, 'R1', 'show ip ospf')).not.toContain('autonomous system boundary router')
    expect(rt.query().route('R1', '0.0.0.0', 0)?.code).toBe('O E2')
    expect(h3Web(rt)).toMatch(/bytes from 8\.8\.8\.8/)
    cutR1Uplink(rt, true)
    expect(q(rt).track('R1', 1).up).toBe(true)
    expect(r3Default(rt)).toBe('O E2 10.0.13.1')
    expect(run(rt, 'R1', 'show ip ospf')).toContain('It is an autonomous system boundary router')
    expect(h3Web(rt)).toMatch(/bytes from 8\.8\.8\.8/)
  })

  it('redistribute static subnets: track Down → R3\'te O E2 yok; Up → geri gelir', () => {
    const rt = createLab(ospfLab({ R1: 'exit\nip route 172.16.0.0 255.255.0.0 203.0.113.2 track 1\nrouter ospf 1\nredistribute static subnets' }))
    expect(rt.query().route('R3', '172.16.0.0', 16)?.code).toBe('O E2')
    expect(run(rt, 'R3', 'show ip route')).toContain('O E2     172.16.0.0/16 [110/20] via 10.0.13.1')
    cutR1Uplink(rt)
    expect(rt.query().route('R3', '172.16.0.0', 16)).toBeUndefined()
    expect(run(rt, 'R3', 'show ip route')).not.toContain('172.16.0.0')
    cutR1Uplink(rt, true)
    expect(rt.query().route('R3', '172.16.0.0', 16)?.code).toBe('O E2')
  })

  it('default-information originate always: track Down olsa da duyuru sürer', () => {
    const rt = createLab(ospfLab({ R1: 'default-information originate always' }))
    cutR1Uplink(rt)
    expect(q(rt).track('R1', 1).up).toBe(false)
    expect(r3Default(rt)).toBe('O E2 10.0.13.1')
    expect(run(rt, 'R1', 'show ip ospf')).toContain('It is an autonomous system boundary router')
  })

  it('track\'siz statik + default-information originate: kopuk hatta da duyuru sürer (track olmadan IOS da çekmez)', () => {
    const rt = createLab(ospfLab({ R1: 'exit\nno ip route 0.0.0.0 0.0.0.0 203.0.113.2\nip route 0.0.0.0 0.0.0.0 203.0.113.2\nrouter ospf 1\ndefault-information originate' }))
    cutR1Uplink(rt)
    expect(r3Default(rt)).toBe('O E2 10.0.13.1')
  })
})
