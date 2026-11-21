// Klasik EIGRP (IPv4, AS kipi): komşuluk şartları, bileşik metrik, DUAL (FD/RD, successor,
// feasible successor), variance, özetleme (auto-summary, ip summary-address), dış rotalar,
// stub, track ve OSPF ile AD seçimi. Her davranış hem başarılı hem başarısız durumla sınanır.
import { describe, expect, it } from 'vitest'
import { createLab, runScript } from '../../src/sim'
import { applyConfigText } from '../../src/sim/config-text'
import { routeTable } from '../../src/sim/net'
import type { LabRuntime } from '../../src/sim/runtime'
import type { DeviceDef, LabDef, LinkDef } from '../../src/sim/types'
import { ports } from '../../src/sim/util'
import { createRuntime, toAglab, toLabber, BridgeError } from '../../src/sim-bridge/bridge'
import type { AglabTopology } from '../../src/sim-bridge/aglab'

const router = (id: string, n: number): DeviceDef => ({ id, kind: 'switch', router: true, model: 'ISR4331', mac: `5254.00${n}0.0000`, ports: ports('Gi0/0-2'), x: 0, y: 0 })
/** Catalyst 3560 (IOS 12.2): EIGRP auto-summary varsayılan açık */
const l3sw = (id: string, n: number): DeviceDef => ({ id, kind: 'switch', l3: true, needsEncap: true, model: 'WS-C3560-24PS', mac: `5254.00${n}0.0000`, ports: ports('Fa0/1-24', 'Gi0/1-2'), x: 0, y: 0 })
const pc = (id: string, n: number): DeviceDef => ({ id, kind: 'pc', mac: `0050.0000.00${n}0`, x: 0, y: 0 })

function lab(devices: DeviceDef[], links: [string, string, string, string][], cfg: Record<string, string>, pcs: LabDef['initialPcs'] = {}): LabDef {
  return {
    id: 'eigrp', title: '', summary: '', level: 'İleri', tags: [], brief: [], objectives: [], solution: {}, view: { w: 1, h: 1 },
    devices,
    links: links.map(([a, ap, b, bp]): LinkDef => ({ a: [a, ap], b: [b, bp] })),
    initialConfig: cfg,
    initialPcs: pcs,
  }
}

const ifc = (name: string, ip: string, mask: string, pre: string[] = []) => [`interface ${name}`, ...pre, `ip address ${ip} ${mask}`, 'no shutdown', 'exit']
const j = (...xs: (string | string[])[]) => xs.flat().join('\n')

/** H1 — R1 ═ R2 — H2 (10.0.12.0/30); iki uçta EIGRP AS 1. */
function two(r1: string[] = [], r2: string[] = [], r1Eigrp = ['router eigrp 1', 'network 10.0.0.0', 'network 192.168.1.0', 'exit'], r2Eigrp = ['router eigrp 1', 'network 10.0.0.0', 'network 192.168.2.0', 'exit']): LabDef {
  return lab(
    [router('R1', 1), router('R2', 2), pc('H1', 1), pc('H2', 2), router('R3', 3)],
    [['H1', 'eth0', 'R1', 'GigabitEthernet0/0'], ['R1', 'GigabitEthernet0/1', 'R2', 'GigabitEthernet0/1'], ['R2', 'GigabitEthernet0/0', 'H2', 'eth0'], ['R1', 'GigabitEthernet0/2', 'R3', 'GigabitEthernet0/2']],
    {
      R1: j(ifc('g0/0', '192.168.1.1', '255.255.255.0'), ifc('g0/1', '10.0.12.1', '255.255.255.252'), ifc('g0/2', '172.31.13.1', '255.255.255.0'), r1Eigrp, r1),
      R2: j(ifc('g0/0', '192.168.2.1', '255.255.255.0'), ifc('g0/1', '10.0.12.2', '255.255.255.252'), r2Eigrp, r2),
      R3: j(ifc('g0/2', '172.31.13.3', '255.255.255.0')),
    },
    { H1: { ip: '192.168.1.10', prefix: 24, gw: '192.168.1.1' }, H2: { ip: '192.168.2.20', prefix: 24, gw: '192.168.2.1' } },
  )
}

/**
 * Elmas: R1 Gi0/1 — R2 — R4, R1 Gi0/2 — R3 — R4; R4 LAN 192.168.4.0/24.
 * Gecikmeler (onlarca µs) ve bant genişlikleri parametreyle verilir.
 */
function diamond(extra: Partial<Record<'R1' | 'R2' | 'R3' | 'R4', string[]>> = {}): LabDef {
  const eigrp = ['router eigrp 10', 'network 10.0.0.0', 'network 192.168.0.0 0.0.255.255', 'exit']
  return lab(
    [router('R1', 1), router('R2', 2), router('R3', 3), router('R4', 4), pc('H1', 1), pc('H4', 4)],
    [
      ['H1', 'eth0', 'R1', 'GigabitEthernet0/0'],
      ['R1', 'GigabitEthernet0/1', 'R2', 'GigabitEthernet0/1'],
      ['R1', 'GigabitEthernet0/2', 'R3', 'GigabitEthernet0/1'],
      ['R2', 'GigabitEthernet0/2', 'R4', 'GigabitEthernet0/1'],
      ['R3', 'GigabitEthernet0/2', 'R4', 'GigabitEthernet0/2'],
      ['R4', 'GigabitEthernet0/0', 'H4', 'eth0'],
    ],
    {
      R1: j(ifc('g0/0', '192.168.1.1', '255.255.255.0'), ifc('g0/1', '10.0.12.1', '255.255.255.252'), ifc('g0/2', '10.0.13.1', '255.255.255.252'), eigrp, extra.R1 ?? []),
      R2: j(ifc('g0/1', '10.0.12.2', '255.255.255.252'), ifc('g0/2', '10.0.24.1', '255.255.255.252'), eigrp, extra.R2 ?? []),
      R3: j(ifc('g0/1', '10.0.13.2', '255.255.255.252'), ifc('g0/2', '10.0.34.1', '255.255.255.252'), eigrp, extra.R3 ?? []),
      R4: j(ifc('g0/0', '192.168.4.1', '255.255.255.0'), ifc('g0/1', '10.0.24.2', '255.255.255.252'), ifc('g0/2', '10.0.34.2', '255.255.255.252'), eigrp, extra.R4 ?? []),
    },
    { H1: { ip: '192.168.1.10', prefix: 24, gw: '192.168.1.1' }, H4: { ip: '192.168.4.40', prefix: 24, gw: '192.168.4.1' } },
  )
}

const run = (rt: LabRuntime, dev: string, cmd: string) => runScript(rt, dev, cmd).join('\n')
const conf = (rt: LabRuntime, dev: string, script: string) => runScript(rt, dev, 'configure terminal\n' + script + '\nend')
const logs = (rt: LabRuntime, dev: string) => rt.logs.filter((l) => l.dev === dev).map((l) => l.text).join('\n')
const okNbrs = (rt: LabRuntime, dev: string) => rt.query().eigrp(dev)?.nbrs.filter((n) => n.ok).map((n) => n.peerDev) ?? []
const route = (rt: LabRuntime, dev: string, net: string, prefix: number) => routeTable(rt.derived, dev).find((e) => e.net === net && e.prefix === prefix)

describe('EIGRP komşuluk', () => {
  it('iki router komşu olur ve D rotası (AD 90) kurulur; ping geçer', () => {
    const rt = createLab(two())
    expect(okNbrs(rt, 'R1')).toEqual(['R2'])
    expect(okNbrs(rt, 'R2')).toEqual(['R1'])
    const r = rt.query().route('R2', '192.168.1.0', 24)
    expect(r).toMatchObject({ code: 'D', nh: '10.0.12.1', ifname: 'GigabitEthernet0/1', metric: 3072 })
    expect(rt.query().routeFor('R2', '192.168.1.10')).toMatchObject({ ad: 90, source: 'D' })
    expect(rt.query().ping('H1', '192.168.2.20').ok).toBe(true)
    // açılış günlükleri temizlenir: süreci kaldırıp yeniden kurunca komşuluk günlüğü
    conf(rt, 'R2', 'no router eigrp 1')
    expect(logs(rt, 'R1')).toMatch(/%DUAL-5-NBRCHANGE: EIGRP-IPv4 1: Neighbor 10\.0\.12\.2 \(GigabitEthernet0\/1\) is down: holding time expired/)
    conf(rt, 'R2', 'router eigrp 1\nnetwork 10.0.0.0\nnetwork 192.168.2.0')
    expect(logs(rt, 'R1')).toMatch(/%DUAL-5-NBRCHANGE: EIGRP-IPv4 1: Neighbor 10\.0\.12\.2 \(GigabitEthernet0\/1\) is up: new adjacency/)
    const nb = run(rt, 'R1', 'show ip eigrp neighbors')
    expect(nb).toContain('EIGRP-IPv4 Neighbors for AS(1)')
    expect(nb).toMatch(/0\s+10\.0\.12\.2\s+Gi0\/1\s+1[0-4]/)
    expect(run(rt, 'R2', 'show ip route eigrp')).toMatch(/D\s+192\.168\.1\.0\/24 \[90\/3072\] via 10\.0\.12\.1, \d\d:\d\d:\d\d, GigabitEthernet0\/1/)
  })

  it('AS uyuşmazlığında komşuluk yok, rota yok', () => {
    const rt = createLab(two([], [], undefined, ['router eigrp 2', 'network 10.0.0.0', 'network 192.168.2.0', 'exit']))
    expect(okNbrs(rt, 'R1')).toEqual([])
    expect(rt.query().eigrp('R1')!.nbrs.find((n) => n.peerDev === 'R2')).toMatchObject({ ok: false, reason: 'as' })
    expect(route(rt, 'R2', '192.168.1.0', 24)).toBeUndefined()
    expect(rt.query().ping('H1', '192.168.2.20').ok).toBe(false)
  })

  it('K değeri uyuşmazlığı: komşuluk yok + %DUAL-5-NBRCHANGE K-value mismatch', () => {
    const rt = createLab(two())
    expect(okNbrs(rt, 'R1')).toEqual(['R2'])
    conf(rt, 'R2', 'router eigrp 1\nmetric weights 0 1 1 1 0 0')
    expect(okNbrs(rt, 'R1')).toEqual([])
    expect(rt.query().eigrp('R1')!.nbrs[0]).toMatchObject({ peerDev: 'R2', ok: false, reason: 'k' })
    expect(logs(rt, 'R1')).toMatch(/%DUAL-5-NBRCHANGE: EIGRP-IPv4 1: Neighbor 10\.0\.12\.2 \(GigabitEthernet0\/1\) is down: K-value mismatch/)
    expect(run(rt, 'R1', 'show ip eigrp neighbors')).not.toContain('10.0.12.2')
    expect(run(rt, 'R2', 'show ip protocols')).toContain('EIGRP metric weight K1=1, K2=1, K3=1, K4=0, K5=0')
    conf(rt, 'R2', 'router eigrp 1\nmetric weights 0 1 0 1 0 0')
    expect(okNbrs(rt, 'R1')).toEqual(['R2'])
  })

  it('alt ağ uyuşmazlığı: komşuluk yok + not on common subnet', () => {
    const rt = createLab(two())
    conf(rt, 'R1', 'interface g0/1\nip address 10.0.21.1 255.255.255.252')
    expect(okNbrs(rt, 'R1')).toEqual([])
    expect(rt.query().eigrp('R2')!.nbrs[0]).toMatchObject({ peerDev: 'R1', ok: false, reason: 'subnet' })
    expect(logs(rt, 'R2')).toMatch(/Neighbor 10\.0\.21\.1 not on common subnet for GigabitEthernet0\/1/)
  })

  it('kimlik doğrulama: anahtar metni farklıysa ya da tek taraf md5 ise komşuluk yok', () => {
    const auth = (key: string) => ['key chain KC', 'key 1', `key-string ${key}`, 'exit', 'exit', 'interface g0/1', 'ip authentication mode eigrp 1 md5', 'ip authentication key-chain eigrp 1 KC', 'exit']
    const good = createLab(two(auth('cisco123'), auth('cisco123')))
    expect(okNbrs(good, 'R1')).toEqual(['R2'])
    const bad = createLab(two(auth('cisco123'), auth('cisco123')))
    conf(bad, 'R2', 'key chain KC\nkey 1\nkey-string yanlis')
    expect(okNbrs(bad, 'R1')).toEqual([])
    expect(bad.query().eigrp('R1')!.nbrs[0]).toMatchObject({ ok: false, reason: 'auth' })
    expect(logs(bad, 'R1')).toMatch(/Neighbor 10\.0\.12\.2 \(GigabitEthernet0\/1\) is down: Authentication failure/)
    const one = createLab(two(auth('cisco123')))
    expect(okNbrs(one, 'R1')).toEqual([])
    // hello/hold eşleşmek zorunda değil
    const timers = createLab(two(['interface g0/1', 'ip hello-interval eigrp 1 30', 'ip hold-time eigrp 1 90', 'exit']))
    expect(okNbrs(timers, 'R1')).toEqual(['R2'])
    expect(run(timers, 'R1', 'show ip eigrp interfaces detail')).toMatch(/Hello-interval is 30, Hold-time is 90/)
  })

  it('passive arayüzde komşuluk yok ama ağ duyuruluyor', () => {
    const base = two([], [], ['router eigrp 1', 'network 10.0.0.0', 'network 192.168.1.0', 'network 172.31.0.0', 'exit'])
    base.initialConfig!.R3 += '\n' + j('router eigrp 1', 'network 172.31.0.0', 'exit')
    const rt = createLab(base)
    expect(okNbrs(rt, 'R1').sort()).toEqual(['R2', 'R3'])
    conf(rt, 'R1', 'router eigrp 1\npassive-interface g0/2')
    expect(okNbrs(rt, 'R1')).toEqual(['R2'])
    expect(rt.query().eigrp('R1')!.nbrs.find((n) => n.peerDev === 'R3')).toMatchObject({ ok: false, reason: 'passive' })
    expect(route(rt, 'R2', '172.31.13.0', 24)).toMatchObject({ code: 'D' })
    expect(run(rt, 'R1', 'show ip protocols')).toMatch(/Passive Interface\(s\):\n\s+GigabitEthernet0\/2/)
    expect(run(rt, 'R1', 'show ip eigrp interfaces')).not.toContain('Gi0/2')
    // passive-interface default + no passive-interface
    conf(rt, 'R1', 'router eigrp 1\npassive-interface default\nno passive-interface g0/1')
    expect(okNbrs(rt, 'R1')).toEqual(['R2'])
  })
})

describe('EIGRP metrik ve DUAL', () => {
  it('bileşik metrik: 256 × (10^7/en düşük bw + toplam delay/10)', () => {
    const rt = createLab(two(['interface g0/1', 'bandwidth 10000', 'delay 100', 'exit']))
    // R2 → 192.168.1.0/24: en düşük bw R2 Gi0/1 (1 Gb/s; R1'in bandwidth'i R1 yönünü etkiler)
    expect(rt.query().eigrpTopo('R2', '192.168.1.0', 24)!.fd).toBe(3072)
    // R1 → 192.168.2.0/24: 10^7/10000 = 1000; delay 100 + 1 = 101 → 256 × 1101
    expect(rt.query().eigrpTopo('R1', '192.168.2.0', 24)!.fd).toBe(281856)
    expect(run(rt, 'R1', 'show ip eigrp topology 192.168.2.0 255.255.255.0')).toMatch(/Minimum bandwidth is 10000 Kbit\n\s+Total delay is 1010 microseconds/)
  })

  it('eşit maliyette iki successor; bandwidth/delay değişince yol değişir', () => {
    const rt = createLab(diamond())
    const t = rt.query().eigrpTopo('R1', '192.168.4.0', 24)!
    expect(t.fd).toBe(256 * (10 + 3))
    expect(t.successors.map((s) => s.nh).sort()).toEqual(['10.0.12.2', '10.0.13.2'])
    expect(route(rt, 'R1', '192.168.4.0', 24)!.paths!.length).toBe(2)
    conf(rt, 'R1', 'interface g0/1\nbandwidth 10000')
    expect(rt.query().eigrpTopo('R1', '192.168.4.0', 24)!.successors.map((s) => s.nh)).toEqual(['10.0.13.2'])
    conf(rt, 'R1', 'interface g0/1\nno bandwidth\ninterface g0/2\ndelay 50')
    expect(rt.query().eigrpTopo('R1', '192.168.4.0', 24)!.successors.map((s) => s.nh)).toEqual(['10.0.12.2'])
    expect(rt.query().routeFor('R1', '192.168.4.40')).toMatchObject({ nextHop: '10.0.12.2', source: 'D' })
    expect(rt.query().ping('H1', '192.168.4.40').ok).toBe(true)
  })

  it('feasible successor: RD < FD olan yedek FS; olmayan değil; variance 2 yalnız FS\'yi ekler', () => {
    // via R2: FD = 256 × (10 + 1 + 1 + 8) = 5120
    // FS durumu: R3'ün RD'si 256 × (10 + 1 + 8) = 4864 < 5120; R1 üzerinden 256 × 24 = 6144
    const fs = createLab(diamond({ R1: ['interface g0/1', 'delay 8', 'interface g0/2', 'delay 5', 'exit'], R3: ['interface g0/2', 'delay 8', 'exit'] }))
    let t = fs.query().eigrpTopo('R1', '192.168.4.0', 24)!
    expect(t.fd).toBe(5120)
    expect(t.successors.map((s) => s.nh)).toEqual(['10.0.12.2'])
    expect(t.feasibleSuccessors).toEqual([expect.objectContaining({ nh: '10.0.13.2', metric: 6144, rd: 4864 })])
    expect(run(fs, 'R1', 'show ip eigrp topology')).toMatch(/P 192\.168\.4\.0\/24, 1 successors, FD is 5120\n\s+via 10\.0\.12\.2 \(5120\/3072\), GigabitEthernet0\/1\n\s+via 10\.0\.13\.2 \(6144\/4864\), GigabitEthernet0\/2/)
    expect(route(fs, 'R1', '192.168.4.0', 24)!.paths!.length).toBe(1)
    conf(fs, 'R1', 'router eigrp 10\nvariance 2')
    const r = route(fs, 'R1', '192.168.4.0', 24)!
    expect(r.paths!.map((p) => p.nh)).toEqual(['10.0.12.2', '10.0.13.2'])
    expect(run(fs, 'R1', 'show ip route 192.168.4.0')).toContain('Known via "eigrp 10", distance 90, metric 5120')
    expect(run(fs, 'R1', 'show ip route eigrp')).toMatch(/\[90\/5120\] via 10\.0\.12\.2.*\n\s+\[90\/6144\] via 10\.0\.13\.2/)

    // FS olmayan: R3'ün RD'si 256 × (10 + 1 + 9) = 5120 = FD (koşul RD < FD sağlanmaz)
    const nofs = createLab(diamond({ R1: ['interface g0/1', 'delay 8', 'exit'], R3: ['interface g0/2', 'delay 9', 'exit'] }))
    t = nofs.query().eigrpTopo('R1', '192.168.4.0', 24)!
    expect(t.fd).toBe(5120)
    expect(t.feasibleSuccessors).toEqual([])
    // 192.168.4.0/24 girdisinde yalnız successor (sonraki satır yeni girdi)
    expect(run(nofs, 'R1', 'show ip eigrp topology')).toMatch(/P 192\.168\.4\.0\/24, 1 successors, FD is 5120\n\s+via 10\.0\.12\.2 \(5120\/3072\), GigabitEthernet0\/1(\n|$)(?!\s+via)/)
    expect(run(nofs, 'R1', 'show ip eigrp topology all-links')).toMatch(/via 10\.0\.13\.2 \(5376\/5120\), GigabitEthernet0\/2/)
    conf(nofs, 'R1', 'router eigrp 10\nvariance 2')
    expect(route(nofs, 'R1', '192.168.4.0', 24)!.paths!.map((p) => p.nh)).toEqual(['10.0.12.2'])
  })

  it('maximum-paths 1 eşit maliyetli yolları teke indirir', () => {
    const rt = createLab(diamond({ R1: ['router eigrp 10', 'maximum-paths 1', 'exit'] }))
    expect(route(rt, 'R1', '192.168.4.0', 24)!.paths!.length).toBe(1)
  })
})

describe('EIGRP özetleme', () => {
  /** S1 (3560, Lo 10.1.1.0/24) — R2 (ISR) — S3 (3560, Lo 10.3.3.0/24); taşıma 172.16.x */
  const disc = (s1: string[] = [], s3: string[] = []) =>
    lab(
      [l3sw('S1', 1), router('R2', 2), l3sw('S3', 3)],
      [['S1', 'GigabitEthernet0/1', 'R2', 'GigabitEthernet0/1'], ['R2', 'GigabitEthernet0/2', 'S3', 'GigabitEthernet0/1']],
      {
        S1: j('ip routing', ifc('g0/1', '172.16.12.1', '255.255.255.0', ['no switchport']), ifc('loopback 0', '10.1.1.1', '255.255.255.0'), 'router eigrp 1', 'network 10.0.0.0', 'network 172.16.0.0', 'exit', s1),
        R2: j(ifc('g0/1', '172.16.12.2', '255.255.255.0'), ifc('g0/2', '172.16.23.2', '255.255.255.0'), 'router eigrp 1', 'network 172.16.0.0', 'exit'),
        S3: j('ip routing', ifc('g0/1', '172.16.23.3', '255.255.255.0', ['no switchport']), ifc('loopback 0', '10.3.3.3', '255.255.255.0'), 'router eigrp 1', 'network 10.0.0.0', 'network 172.16.0.0', 'exit', s3),
      },
    )

  it('auto-summary: 3560 (12.2) varsayılan açık, ISR (15) kapalı; süreksiz ağ yanlış yönlendirir', () => {
    const rt = createLab(disc())
    expect(run(rt, 'S1', 'show running-config')).toMatch(/router eigrp 1\n( .*\n)* auto-summary\n/)
    expect(run(rt, 'R2', 'show running-config')).toMatch(/router eigrp 1\n( .*\n)* no auto-summary\n/)
    expect(run(rt, 'S1', 'show ip protocols')).toContain('Automatic network summarization is in effect')
    expect(run(rt, 'R2', 'show ip protocols')).toContain('Automatic network summarization is not in effect')
    // R2 iki taraftan da 10.0.0.0/8 öğrenir; alt ağlar yok
    const r = route(rt, 'R2', '10.0.0.0', 8)!
    expect(r.code).toBe('D')
    expect(r.paths!.map((p) => p.nh).sort()).toEqual(['172.16.12.1', '172.16.23.3'])
    expect(route(rt, 'R2', '10.3.3.0', 24)).toBeUndefined()
    // yerelde Null0 özeti (AD 5): S1, S3'ün ağına ulaşamaz
    expect(rt.query().routeFor('S1', '10.3.3.3')).toMatchObject({ ifname: 'Null0', ad: 5, source: 'D' })
    expect(run(rt, 'S1', 'show ip route eigrp')).toMatch(/D\s+10\.0\.0\.0\/8 is a summary, \d\d:\d\d:\d\d, Null0/)
    expect(rt.query().ping('S1', '10.3.3.3').ok).toBe(false)
    // R2 de yalnız bir yöne doğru gönderir
    const okFromR2 = ['10.1.1.1', '10.3.3.3'].filter((ip) => rt.query().ping('R2', ip).ok)
    expect(okFromR2.length).toBe(1)

    conf(rt, 'S1', 'router eigrp 1\nno auto-summary')
    conf(rt, 'S3', 'router eigrp 1\nno auto-summary')
    expect(route(rt, 'R2', '10.0.0.0', 8)).toBeUndefined()
    expect(route(rt, 'R2', '10.1.1.0', 24)).toMatchObject({ code: 'D', nh: '172.16.12.1' })
    expect(route(rt, 'R2', '10.3.3.0', 24)).toMatchObject({ code: 'D', nh: '172.16.23.3' })
    expect(rt.query().ping('S1', '10.3.3.3').ok).toBe(true)
    expect(rt.query().ping('R2', '10.1.1.1').ok).toBe(true)
    expect(rt.query().ping('R2', '10.3.3.3').ok).toBe(true)
  })

  it('ip summary-address: komşuda tek özet rota, yerelde Null0 (AD 5)', () => {
    const rt = createLab(
      two(
        [...ifc('loopback 1', '10.1.0.1', '255.255.255.0'), ...ifc('loopback 2', '10.1.1.1', '255.255.255.0'), 'interface g0/1', 'ip summary-address eigrp 1 10.1.0.0 255.255.252.0', 'exit'],
      ),
    )
    expect(route(rt, 'R2', '10.1.0.0', 22)).toMatchObject({ code: 'D', nh: '10.0.12.1', metric: 130816 })
    expect(route(rt, 'R2', '10.1.0.0', 24)).toBeUndefined()
    expect(route(rt, 'R2', '10.1.1.0', 24)).toBeUndefined()
    expect(rt.query().routeFor('R1', '10.1.2.5')).toMatchObject({ ifname: 'Null0', ad: 5 })
    expect(rt.query().ping('R2', '10.1.1.1').ok).toBe(true)
    expect(run(rt, 'R1', 'show ip eigrp topology')).toMatch(/P 10\.1\.0\.0\/22, 1 successors, FD is 128256\n\s+via Summary \(128256\/0\), Null0/)
    conf(rt, 'R1', 'interface g0/1\nno ip summary-address eigrp 1 10.1.0.0 255.255.252.0')
    expect(route(rt, 'R2', '10.1.0.0', 22)).toBeUndefined()
    expect(route(rt, 'R2', '10.1.1.0', 24)).toMatchObject({ code: 'D' })
  })
})

describe('EIGRP dış rotalar, track, stub, OSPF', () => {
  const STATIC = 'ip route 172.30.0.0 255.255.0.0 192.168.1.50'

  it('redistribute static: metrik yoksa aktarılmaz; default-metric ya da metric ile D EX (AD 170)', () => {
    const rt = createLab(two([STATIC, 'router eigrp 1', 'redistribute static', 'exit']))
    expect(route(rt, 'R2', '172.30.0.0', 16)).toBeUndefined()
    conf(rt, 'R1', 'router eigrp 1\ndefault-metric 10000 100 255 1 1500')
    expect(route(rt, 'R2', '172.30.0.0', 16)).toMatchObject({ code: 'D EX', metric: 256 * (1000 + 101) })
    expect(rt.query().routeFor('R2', '172.30.1.1')).toMatchObject({ ad: 170, source: 'D' })
    expect(run(rt, 'R2', 'show ip route eigrp')).toMatch(/D EX\s+172\.30\.0\.0\/16 \[170\/281856\] via 10\.0\.12\.1/)
    conf(rt, 'R1', 'router eigrp 1\nno default-metric\nredistribute static metric 100000 10 255 1 1500')
    expect(route(rt, 'R2', '172.30.0.0', 16)).toMatchObject({ code: 'D EX', metric: 256 * (100 + 11) })
    expect(run(rt, 'R2', 'show ip eigrp topology 172.30.0.0 255.255.0.0')).toContain('route is External')
  })

  it('track Down olunca aktarılan statik rota komşudan kalkar', () => {
    const rt = createLab(
      two(['track 1 interface g0/2 line-protocol', 'exit', STATIC + ' track 1', 'router eigrp 1', 'redistribute static metric 100000 10 255 1 1500', 'exit']),
    )
    expect(route(rt, 'R2', '172.30.0.0', 16)).toMatchObject({ code: 'D EX' })
    rt.setLink('R1', 'GigabitEthernet0/2', false)
    expect(rt.query().track('R1', 1).up).toBe(false)
    expect(route(rt, 'R2', '172.30.0.0', 16)).toBeUndefined()
    rt.setLink('R1', 'GigabitEthernet0/2', true)
    expect(route(rt, 'R2', '172.30.0.0', 16)).toMatchObject({ code: 'D EX' })
  })

  it('eigrp stub: hub yalnız stub\'ın bağlı ağlarını öğrenir; stub transit olmaz', () => {
    // R1 (hub) — R2 (stub) — R3; R3 Lo 10.3.3.0/24
    const base = (stub: string[]) =>
      lab(
        [router('R1', 1), router('R2', 2), router('R3', 3)],
        [['R1', 'GigabitEthernet0/1', 'R2', 'GigabitEthernet0/1'], ['R2', 'GigabitEthernet0/2', 'R3', 'GigabitEthernet0/2']],
        {
          R1: j(ifc('g0/1', '10.0.12.1', '255.255.255.252'), ifc('loopback 0', '10.1.1.1', '255.255.255.0'), 'router eigrp 1', 'network 10.0.0.0', 'exit'),
          R2: j(ifc('g0/1', '10.0.12.2', '255.255.255.252'), ifc('g0/2', '10.0.23.1', '255.255.255.252'), ifc('loopback 0', '10.2.2.2', '255.255.255.0'), 'router eigrp 1', 'network 10.0.0.0', ...stub, 'exit'),
          R3: j(ifc('g0/2', '10.0.23.2', '255.255.255.252'), ifc('loopback 0', '10.3.3.3', '255.255.255.0'), 'router eigrp 1', 'network 10.0.0.0', 'exit'),
        },
      )
    const plain = createLab(base([]))
    expect(route(plain, 'R1', '10.3.3.0', 24)).toMatchObject({ code: 'D' })
    const rt = createLab(base(['eigrp stub']))
    expect(route(rt, 'R1', '10.2.2.0', 24)).toMatchObject({ code: 'D' })
    expect(route(rt, 'R1', '10.0.23.0', 30)).toMatchObject({ code: 'D' })
    expect(route(rt, 'R1', '10.3.3.0', 24)).toBeUndefined()
    expect(route(rt, 'R3', '10.1.1.0', 24)).toBeUndefined()
    // stub da komşularından öğrenir
    expect(route(rt, 'R2', '10.3.3.0', 24)).toMatchObject({ code: 'D' })
    expect(run(rt, 'R1', 'show ip eigrp neighbors detail')).toMatch(/Stub Peer Advertising \(CONNECTED SUMMARY \) Routes/)
    const ro = createLab(base(['eigrp stub receive-only']))
    expect(route(ro, 'R1', '10.2.2.0', 24)).toBeUndefined()
    expect(route(ro, 'R2', '10.1.1.0', 24)).toMatchObject({ code: 'D' })
  })

  it('OSPF ve EIGRP aynı öneki öğrenince D (90) seçilir; EIGRP kalkınca O (110)', () => {
    const ospf = ['router ospf 1', 'network 10.0.12.0 0.0.0.3 area 0', 'network 192.168.1.0 0.0.0.255 area 0', 'exit']
    const ospf2 = ['router ospf 1', 'network 10.0.12.0 0.0.0.3 area 0', 'network 192.168.2.0 0.0.0.255 area 0', 'exit']
    const rt = createLab(two(ospf, ospf2))
    expect(rt.query().ospfAdjacent('R1', 'R2')).toBe(true)
    expect(rt.query().routeFor('R2', '192.168.1.10')).toMatchObject({ code: 'D', ad: 90 })
    conf(rt, 'R1', 'no router eigrp 1')
    expect(rt.query().routeFor('R2', '192.168.1.10')).toMatchObject({ code: 'O', ad: 110 })
  })
})

describe('EIGRP show, yapılandırma metni ve köprü', () => {
  const FULL = [
    'key chain KC', 'key 1', 'key-string cisco123', 'exit', 'exit',
    'interface g0/1', 'bandwidth 50000', 'delay 20', 'ip authentication mode eigrp 1 md5', 'ip authentication key-chain eigrp 1 KC',
    'ip hello-interval eigrp 1 10', 'ip hold-time eigrp 1 30', 'ip summary-address eigrp 1 192.168.0.0 255.255.252.0', 'exit',
    'router eigrp 1', 'eigrp router-id 1.1.1.1', 'passive-interface g0/0', 'metric weights 0 1 1 1 0 0', 'variance 3', 'maximum-paths 6',
    'redistribute connected', 'default-metric 100000 10 255 1 1500', 'eigrp stub connected summary', 'network 172.31.13.0 0.0.0.255', 'exit',
  ]

  it('show ip protocols, interfaces, topology, neighbors', () => {
    const rt = createLab(two())
    const p = run(rt, 'R1', 'show ip protocols')
    expect(p).toContain('Routing Protocol is "eigrp 1"')
    expect(p).toContain('EIGRP metric weight K1=1, K2=0, K3=1, K4=0, K5=0')
    expect(p).toMatch(/Routing for Networks:\n\s+10\.0\.0\.0\n\s+192\.168\.1\.0/)
    expect(p).toContain('Maximum path: 4')
    expect(p).toContain('Maximum metric variance 1')
    expect(p).toMatch(/Distance: internal 90 external 170/)
    expect(run(rt, 'R1', 'show ip eigrp interfaces')).toMatch(/EIGRP-IPv4 Interfaces for AS\(1\)[\s\S]*Gi0\/1\s+1\s/)
    expect(run(rt, 'R1', 'show ip eigrp topology')).toMatch(/EIGRP-IPv4 Topology Table for AS\(1\)\/ID\(192\.168\.1\.1\)/)
    expect(run(rt, 'R1', 'show ip eigrp topology')).toMatch(/P 192\.168\.1\.0\/24, 1 successors, FD is 2816\n\s+via Connected, GigabitEthernet0\/0/)
    expect(rt.query().eigrp('R1')).toMatchObject({ as: 1, rid: '192.168.1.1' })
  })

  it('show running-config → config-text gidiş-dönüşü EIGRP ve key chain satırlarını korur', () => {
    const rt = createLab(two(FULL))
    const rc = run(rt, 'R1', 'show running-config')
    expect(rc).toContain('key chain KC\n key 1\n  key-string cisco123\n!')
    expect(rc).toMatch(/interface GigabitEthernet0\/1\n bandwidth 50000\n ip address 10\.0\.12\.1 255\.255\.255\.252\n ip authentication mode eigrp 1 md5\n ip authentication key-chain eigrp 1 KC\n ip hello-interval eigrp 1 10\n ip hold-time eigrp 1 30\n ip summary-address eigrp 1 192\.168\.0\.0 255\.255\.252\.0\n delay 20\n/)
    expect(rc).toContain(' network 192.168.1.0\n')
    expect(rc).toContain(' network 172.31.13.0 0.0.0.255\n')
    for (const l of [' metric weights 0 1 1 1 0 0', ' variance 3', ' maximum-paths 6', ' redistribute connected', ' default-metric 100000 10 255 1 1500', ' passive-interface GigabitEthernet0/0', ' no auto-summary', ' eigrp router-id 1.1.1.1', ' eigrp stub connected summary'])
      expect(rc.split('\n')).toContain(l)
    const back = createLab(two([], [], []))
    const lines = applyConfigText(back, 'R1', rc.slice(rc.indexOf('\n!') + 1))
    const ours = lines.filter((l) => /eigrp|key|network|variance|maximum-paths|metric|redistribute|passive|summary|delay|bandwidth/.test(l.command))
    expect(ours.length).toBeGreaterThanOrEqual(20)
    expect(ours.filter((l) => l.status !== 'applied')).toEqual([])
    expect(back.running['R1']!.eigrp).toEqual(rt.running['R1']!.eigrp)
    expect(back.running['R1']!.keyChains).toEqual(rt.running['R1']!.keyChains)
    expect(back.running['R1']!.ifaces['GigabitEthernet0/1']!.l3).toEqual(rt.running['R1']!.ifaces['GigabitEthernet0/1']!.l3)
    expect(run(back, 'R1', 'show running-config').split('\n').slice(3)).toEqual(rc.split('\n').slice(3))
  })

  it('geçersiz girdiler reddedilir', () => {
    const rt = createLab(two())
    expect(conf(rt, 'R1', 'router eigrp 1\nvariance 0').join('\n')).toMatch(/%/)
    expect(conf(rt, 'R1', 'router eigrp 1\nmetric weights 1 1 0 1 0 0').join('\n')).toMatch(/%/)
    expect(conf(rt, 'R1', 'router eigrp 2').join('\n')).toMatch(/% .*EIGRP/)
    expect(conf(rt, 'R1', 'interface g0/1\nip summary-address eigrp 1 10.1.1.0 255.255.0.0').join('\n')).toMatch(/%/)
  })

  it('köprü: EIGRP yapılandırması AğLab\'a dönüşte "desteklenmiyor" olarak raporlanır', () => {
    const t: AglabTopology = {
      app: 'AgLab', version: 23,
      devices: [
        { id: 'r1', name: 'R1', type: 'Router', x: 0, y: 0, enabled: true, ip: '', mask: '', gateway: '', route: '', ports: ['g0/0', 'g0/1'], interfaces: { 'g0/0': { enabled: true, ip: '10.0.12.1', mask: '255.255.255.252' } }, staticRoutes: [] },
      ],
      links: [],
    }
    for (const [script, msg] of [
      ['router eigrp 1\nnetwork 10.0.0.0', /EIGRP.*desteklenmiyor/],
      ['key chain KC\nkey 1\nkey-string x', /key chain.*desteklenmiyor/],
      ['interface g0/0\ndelay 20', /arayüz OSPF\/L3 ayarı|EIGRP/],
    ] as const) {
      const rt = createRuntime(toLabber(t))
      runScript(rt, 'r1', 'configure terminal\n' + script + '\nend')
      expect(() => toAglab(rt, t), script).toThrow(BridgeError)
      expect(() => toAglab(rt, t), script).toThrow(msg)
    }
  })
})
