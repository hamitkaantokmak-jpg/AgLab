// L5-i: TTL, ICMP Time Exceeded, traceroute (IOS ve VPCS) ve extended ping. Her davranış
// başarılı ve başarısız durumla sınanır.
import { describe, expect, it } from 'vitest'
import { createLab, createSession, runScript, type IosSession, type VpcsSession } from '../../src/sim'
import { pingTrace } from '../../src/sim-bridge/events'
import type { LabRuntime } from '../../src/sim/runtime'
import type { LabDef } from '../../src/sim/types'
import { ports } from '../../src/sim/util'

/** PC1 192.168.1.10 — R1 — 10.0.12.0/30 — R2 — 10.0.23.0/30 — R3 — PC2 192.168.3.10 */
function lab(extra: Record<string, string[]> = {}): LabDef {
  const r = (id: string, mac: string) => ({ id, kind: 'switch' as const, router: true, model: 'ISR4331', mac, ports: ports('Gi0/0-1'), x: 0, y: 0 })
  return {
    id: 'l5i', title: '', summary: '', level: 'İleri', tags: [], brief: [], objectives: [], solution: {}, view: { w: 1, h: 1 },
    devices: [r('R1', '5254.0010.0000'), r('R2', '5254.0020.0000'), r('R3', '5254.0030.0000'), { id: 'PC1', kind: 'pc', mac: '0050.0000.0010', x: 0, y: 0 }, { id: 'PC2', kind: 'pc', mac: '0050.0000.0020', x: 0, y: 0 }],
    links: [
      { a: ['PC1', 'eth0'], b: ['R1', 'GigabitEthernet0/0'] },
      { a: ['R1', 'GigabitEthernet0/1'], b: ['R2', 'GigabitEthernet0/0'] },
      { a: ['R2', 'GigabitEthernet0/1'], b: ['R3', 'GigabitEthernet0/0'] },
      { a: ['R3', 'GigabitEthernet0/1'], b: ['PC2', 'eth0'] },
    ],
    initialConfig: {
      R1: ['interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.12.1 255.255.255.252', 'no shutdown', 'exit', 'ip route 0.0.0.0 0.0.0.0 10.0.12.2', ...(extra['R1'] ?? [])].join('\n'),
      R2: ['interface g0/0', 'ip address 10.0.12.2 255.255.255.252', 'no shutdown', 'interface g0/1', 'ip address 10.0.23.1 255.255.255.252', 'no shutdown', 'exit', 'ip route 192.168.1.0 255.255.255.0 10.0.12.1', 'ip route 192.168.3.0 255.255.255.0 10.0.23.2', ...(extra['R2'] ?? [])].join('\n'),
      R3: ['interface g0/0', 'ip address 10.0.23.2 255.255.255.252', 'no shutdown', 'interface g0/1', 'ip address 192.168.3.1 255.255.255.0', 'no shutdown', 'exit', 'ip route 0.0.0.0 0.0.0.0 10.0.23.1', ...(extra['R3'] ?? [])].join('\n'),
    },
    initialPcs: { PC1: { ip: '192.168.1.10', prefix: 24, gw: '192.168.1.1' }, PC2: { ip: '192.168.3.10', prefix: 24, gw: '192.168.3.1' } },
  }
}
const vpcs = (rt: LabRuntime, dev: string, cmd: string) => (createSession(rt, dev) as VpcsSession).exec(cmd).join('\n')
const ios = (rt: LabRuntime, dev: string, cmd: string) => runScript(rt, dev, cmd).join('\n')
const hops = (out: string) => [...out.matchAll(/^ {0,2}(\d+) (\S+)/gm)].map((m) => `${m[1]} ${m[2]}`)

describe('TTL ve ICMP Time Exceeded', () => {
  it('VPCS ping -T: TTL biten router Time Exceeded döner; yeterli TTL ile hedef yanıt verir', () => {
    const rt = createLab(lab())
    expect(vpcs(rt, 'PC1', 'ping 192.168.3.10 -T 1 -c 2')).toMatch(/^\*192\.168\.1\.1 icmp_seq=1 ttl=255 .*\(ICMP type:11, code:0, TTL expired in transit\)$/m)
    expect(vpcs(rt, 'PC1', 'ping 192.168.3.10 -T 2')).toContain('*10.0.12.2 icmp_seq=1')
    expect(vpcs(rt, 'PC1', 'ping 192.168.3.10 -T 3')).toContain('*10.0.23.2 icmp_seq=5')
    const ok = vpcs(rt, 'PC1', 'ping 192.168.3.10 -T 4 -c 3')
    expect(ok.match(/bytes from 192\.168\.3\.10/g)).toHaveLength(3)
    expect(ok).toContain('ttl=61')
    expect(vpcs(rt, 'PC1', 'ping 192.168.3.10 -T 0')).toContain('Invalid options')
  })

  it('Time Exceeded dönüş yolu yoksa yanıt gelmez (zaman aşımı); ACL time-exceeded\'i süzebilir', () => {
    // R2'de 192.168.1.0/24 rotası yok: TTL R2'de biterse Time Exceeded PC1'e dönemez
    const rt = createLab(lab({ R2: ['no ip route 192.168.1.0 255.255.255.0 10.0.12.1'] }))
    expect(vpcs(rt, 'PC1', 'ping 192.168.3.10 -T 2')).toMatch(/icmp_seq=1 timeout/)
    expect(vpcs(rt, 'PC1', 'ping 192.168.3.10 -T 1')).toContain('TTL expired in transit')
    const acl = createLab(lab({ R1: ['access-list 101 deny icmp any any time-exceeded', 'access-list 101 permit ip any any', 'interface g0/1', 'ip access-group 101 in'] }))
    expect(vpcs(acl, 'PC1', 'ping 192.168.3.10 -T 2')).toMatch(/icmp_seq=1 timeout/)
    expect(vpcs(acl, 'PC1', 'ping 192.168.3.10')).toContain('bytes from 192.168.3.10')
  })

  it('Simulation Mode izi: TTL azalır, router Time Exceeded üretir', () => {
    const rt = createLab(lab())
    const t = pingTrace(rt, 'PC1', '192.168.3.10', undefined, { ttl: 2 })
    expect(t.ok).toBe(false)
    const raw = t.records.map((r) => r.raw)
    expect(raw).toContain('ttl-expired R2')
    expect(raw).toContain('ttl-forward R1 2 -> 1')
    expect(raw).toContain('icmp-time-exceeded PC1 from R2')
    const te = t.records.find((r) => r.frame?.kind === 'icmp-time-exceeded')!.frame!
    expect([te.ipv4.sourceIp, te.ipv4.destinationIp, te.icmp.type]).toEqual(['10.0.12.2', '192.168.1.10', 11])
  })
})

describe('traceroute', () => {
  it('IOS: her atlama Time Exceeded ile, hedef port unreachable ile; çıktı IOS biçiminde', () => {
    const rt = createLab(lab())
    const out = ios(rt, 'R1', 'traceroute 192.168.3.10')
    expect(out).toContain('Tracing the route to 192.168.3.10')
    expect(hops(out)).toEqual(['1 10.0.12.2', '2 10.0.23.2', '3 192.168.3.10'])
    expect(out).toMatch(/^ {2}1 10\.0\.12\.2 1 msec 0 msec 1 msec$/m)
  })

  it('IOS: rota yok → !H; ACL → !A; dönüş yolu yok → * * * (30 atlamaya kadar)', () => {
    const noroute = createLab(lab({ R2: ['no ip route 192.168.3.0 255.255.255.0 10.0.23.2'] }))
    // TTL 1: R2'de TTL biter (1. atlama); TTL 2: R2'ye ulaşır, rota yok → !H (yine R2)
    const nr = ios(noroute, 'R1', 'traceroute 192.168.3.10')
    expect(hops(nr)).toEqual(['1 10.0.12.2', '2 10.0.12.2'])
    expect(nr).toMatch(/^ {2}2 10\.0\.12\.2 !H {2}!H {2}!H $/m)
    const acl = createLab(lab({ R3: ['access-list 101 deny udp any any', 'access-list 101 permit ip any any', 'interface g0/0', 'ip access-group 101 in'] }))
    const a = ios(acl, 'R1', 'traceroute 192.168.3.10')
    expect(hops(a)).toEqual(['1 10.0.12.2', '2 10.0.23.2'])
    expect(a).toMatch(/^ {2}2 10\.0\.23\.2 !A {2}!A {2}!A $/m)
    // R3'ün 192.168.1.0/24'e dönüşü yok (varsayılan rota kaldırıldı): R3 ve hedef yanıt veremez
    const hole = createLab(lab({ R3: ['no ip route 0.0.0.0 0.0.0.0 10.0.23.1'] }))
    const h = ios(hole, 'R1', 'traceroute 192.168.3.10')
    expect(hops(h)[0]).toBe('1 10.0.12.2')
    const stars = h.split('\n').filter((l) => /^ *\d+ {2}\* {2}\* {2}\* $/.test(l))
    expect(stars.length + 1).toBe(30)
  })

  it('VPCS trace: en çok 8 atlama; hedef port unreachable ile biter', () => {
    const rt = createLab(lab())
    const out = vpcs(rt, 'PC1', 'trace 192.168.3.10')
    expect(out).toContain('trace to 192.168.3.10, 8 hops max')
    expect(out).toMatch(/^ 1 {3}192\.168\.1\.1 /m)
    expect(out).toMatch(/^ 4 {3}\*192\.168\.3\.10 .*Destination port unreachable\)$/m)
    const hole = createLab(lab({ R3: ['no ip route 0.0.0.0 0.0.0.0 10.0.23.1'] }))
    const h = vpcs(hole, 'PC1', 'trace 192.168.3.10')
    expect(h).toMatch(/^ 8 {5}\* {2}\* {2}\*$/m)
    expect(h).not.toMatch(/^ 9 /m)
  })
})

describe('IOS ping seçenekleri ve extended ping', () => {
  it('tek satır: repeat, size, source (adres ya da arayüz); geçersiz kaynak reddedilir', () => {
    const rt = createLab(lab())
    const r = ios(rt, 'R1', 'ping 192.168.3.10 repeat 10 size 200 source g0/0')
    expect(r).toContain('Sending 10, 200-byte ICMP Echos to 192.168.3.10, timeout is 2 seconds:')
    expect(r).toContain('Packet sent with a source address of 192.168.1.1')
    expect(r).toMatch(/Success rate is (90|100) percent \((9|10)\/10\)/)
    expect(ios(rt, 'R1', 'ping 192.168.3.10 source 8.8.8.8')).toContain('% Invalid source address')
  })

  it('kaynak adresin dönüş rotası yoksa extended ping başarısız, varsayılan kaynakla başarılı', () => {
    // R3'te yalnız 10.0.12.0/30'a rota: R1'in Gi0/1 adresiyle yanıt döner, Gi0/0 (192.168.1.1) ile dönmez
    const rt = createLab(lab({ R3: ['no ip route 0.0.0.0 0.0.0.0 10.0.23.1', 'ip route 10.0.12.0 255.255.255.252 10.0.23.1'] }))
    expect(ios(rt, 'R1', 'ping 192.168.3.10')).toMatch(/Success rate is [1-9]\d* percent/)
    const s = createSession(rt, 'R1') as IosSession
    s.exec('enable')
    s.exec('ping')
    const answers = ['', '192.168.3.10', '', '', '', 'y', '192.168.1.1', '', '', '', '', '', '']
    let out: string[] = []
    for (const a of answers) {
      expect(s.pendingPrompt).toBe(true)
      out = s.exec(a)
    }
    expect(s.pendingPrompt).toBe(false)
    expect(out.join('\n')).toContain('Packet sent with a source address of 192.168.1.1')
    expect(out.join('\n')).toContain('Success rate is 0 percent (0/5)')
  })

  it('extended ping soruları IOS sırasında; geçersiz hedef açık hata', () => {
    const rt = createLab(lab())
    const s = createSession(rt, 'R1') as IosSession
    s.exec('enable')
    s.exec('ping')
    expect(s.prompt()).toBe('Protocol [ip]: ')
    s.exec('')
    expect(s.prompt()).toBe('Target IP address: ')
    expect(s.exec('bad').join('')).toContain('% Bad IP address')
  })
})
