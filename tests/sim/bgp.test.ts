// eBGP (kademe 1): oturum kurulma şartları ve kurulmama nedenleri, network tam eşleşme,
// redistribute, AS_PATH döngü önleme, en iyi yol seçimi (Cisco sırası), AD yarışı, show
// çıktıları, günlük ve köprü raporu. Her davranış hem başarılı hem başarısız durumla sınanır.
import { describe, expect, it } from 'vitest'
import { createLab, runScript } from '../../src/sim'
import { selectBest, type BgpPath } from '../../src/sim/bgp'
import { routeTable } from '../../src/sim/net'
import type { LabRuntime } from '../../src/sim/runtime'
import type { DeviceDef, LabDef, LinkDef } from '../../src/sim/types'
import { ports } from '../../src/sim/util'
import { createRuntime, toAglab, toLabber, BridgeError } from '../../src/sim-bridge/bridge'
import type { AglabTopology } from '../../src/sim-bridge/aglab'

const router = (id: string, n: number): DeviceDef => ({ id, kind: 'switch', router: true, model: 'ISR4331', mac: `5254.00${n}0.0000`, ports: ports('Gi0/0-3'), x: 0, y: 0 })
const pc = (id: string, n: number): DeviceDef => ({ id, kind: 'pc', mac: `0050.0000.00${n}0`, x: 0, y: 0 })
const ifc = (name: string, ip: string, mask: string) => [`interface ${name}`, `ip address ${ip} ${mask}`, 'no shutdown', 'exit']
const j = (...xs: (string | string[])[]) => xs.flat().join('\n')
const P30 = '255.255.255.252'
const P24 = '255.255.255.0'

function lab(devices: DeviceDef[], links: [string, string, string, string][], cfg: Record<string, string>, pcs: LabDef['initialPcs'] = {}): LabDef {
  return {
    id: 'bgp', title: '', summary: '', level: 'İleri', tags: [], brief: [], objectives: [], solution: {}, view: { w: 1, h: 1 },
    devices,
    links: links.map(([a, ap, b, bp]): LinkDef => ({ a: [a, ap], b: [b, bp] })),
    initialConfig: cfg,
    initialPcs: pcs,
  }
}

/**
 * Şube R1 (AS 65010, LAN 198.51.100.0/24) iki ISP'ye bağlı: R2 (ISP-A, AS 64500) ve R3 (ISP-B,
 * AS 64600); ikisi de uzak ağ R4'e (AS 64700, LAN 203.0.114.0/24) bağlı.
 *   R1 g0/1 203.0.113.2/30 — R2 g0/1 .1      R1 g0/2 192.0.2.2/30 — R3 g0/1 .1
 *   R2 g0/2 10.24.0.1/30 — R4 g0/1 .2        R3 g0/2 10.34.0.1/30 — R4 g0/2 .2
 * Router ID'ler 1.1.1.1 … 4.4.4.4. `extra` her router'ın BGP bloğuna eklenir (router bgp içinde).
 */
function isp(extra: Partial<Record<'R1' | 'R2' | 'R3' | 'R4', string[]>> = {}, global: Partial<Record<'R1' | 'R2' | 'R3' | 'R4', string[]>> = {}, as: Partial<Record<'R2' | 'R3', number>> = {}): LabDef {
  const a2 = as.R2 ?? 64500,
    a3 = as.R3 ?? 64600
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
      R1: j(ifc('g0/0', '198.51.100.1', P24), ifc('g0/1', '203.0.113.2', P30), ifc('g0/2', '192.0.2.2', P30), global.R1 ?? [], [
        'router bgp 65010', 'bgp router-id 1.1.1.1', 'network 198.51.100.0', `neighbor 203.0.113.1 remote-as ${a2}`, `neighbor 192.0.2.1 remote-as ${a3}`, ...(extra.R1 ?? []), 'exit',
      ]),
      R2: j(ifc('g0/1', '203.0.113.1', P30), ifc('g0/2', '10.24.0.1', P30), global.R2 ?? [], [
        `router bgp ${a2}`, 'bgp router-id 2.2.2.2', 'neighbor 203.0.113.2 remote-as 65010', 'neighbor 10.24.0.2 remote-as 64700', ...(extra.R2 ?? []), 'exit',
      ]),
      R3: j(ifc('g0/1', '192.0.2.1', P30), ifc('g0/2', '10.34.0.1', P30), global.R3 ?? [], [
        `router bgp ${a3}`, 'bgp router-id 3.3.3.3', 'neighbor 192.0.2.2 remote-as 65010', 'neighbor 10.34.0.2 remote-as 64700', ...(extra.R3 ?? []), 'exit',
      ]),
      R4: j(ifc('g0/0', '203.0.114.1', P24), ifc('g0/1', '10.24.0.2', P30), ifc('g0/2', '10.34.0.2', P30), global.R4 ?? [], [
        'router bgp 64700', 'bgp router-id 4.4.4.4', 'network 203.0.114.0', `neighbor 10.24.0.1 remote-as ${a2}`, `neighbor 10.34.0.1 remote-as ${a3}`, ...(extra.R4 ?? []), 'exit',
      ]),
    },
    { H1: { ip: '198.51.100.10', prefix: 24, gw: '198.51.100.1' }, H4: { ip: '203.0.114.10', prefix: 24, gw: '203.0.114.1' } },
  )
}

/** İki router: R1 (AS 65010) g0/1 10.0.12.1/30 — R2 (AS 64500) g0/1 .2; loopback 1.1.1.1 / 2.2.2.2. */
function pair(r1: string[] = [], r2: string[] = [], r1Bgp?: string[], r2Bgp?: string[]): LabDef {
  return lab([router('R1', 1), router('R2', 2)], [['R1', 'GigabitEthernet0/1', 'R2', 'GigabitEthernet0/1']], {
    R1: j(ifc('g0/1', '10.0.12.1', P30), ['interface loopback0', 'ip address 1.1.1.1 255.255.255.255', 'exit'], r1, r1Bgp ?? ['router bgp 65010', 'neighbor 10.0.12.2 remote-as 64500', 'exit']),
    R2: j(ifc('g0/1', '10.0.12.2', P30), ['interface loopback0', 'ip address 2.2.2.2 255.255.255.255', 'exit'], r2, r2Bgp ?? ['router bgp 64500', 'neighbor 10.0.12.1 remote-as 65010', 'exit']),
  })
}

const conf = (rt: LabRuntime, dev: string, s: string) => runScript(rt, dev, 'configure terminal\n' + s + '\nend')
const run = (rt: LabRuntime, dev: string, cmd: string) => runScript(rt, dev, cmd).slice(1).join('\n')
const sess = (rt: LabRuntime, dev: string, ip: string) => rt.query().bgpSession(dev, ip)!
const paths = (rt: LabRuntime, dev: string, net: string, prefix: number) => rt.query().bgpPaths(dev, net, prefix) ?? []
const best = (rt: LabRuntime, dev: string, net: string, prefix: number) => paths(rt, dev, net, prefix).find((p) => p.best)
const logs = (rt: LabRuntime, dev: string) => rt.logs.filter((l) => l.dev === dev).map((l) => l.text).join('\n')

describe('eBGP: oturum', () => {
  it('iki uçta doğru tanım: Established, PfxRcd, günlükte ADJCHANGE Up', () => {
    const rt = createLab(isp())
    expect(sess(rt, 'R1', '203.0.113.1').state).toBe('Established')
    expect(sess(rt, 'R1', '192.0.2.1').state).toBe('Established')
    expect(sess(rt, 'R1', '203.0.113.1').pfxRcd).toBeGreaterThan(0)
    expect(sess(rt, 'R1', '203.0.113.1').peerAs).toBe(64500)
    const r = createLab(pair([], [], ['router bgp 65010', 'exit'], ['router bgp 64500', 'neighbor 10.0.12.1 remote-as 65010', 'exit']))
    conf(r, 'R1', 'router bgp 65010\nneighbor 10.0.12.2 remote-as 64500')
    expect(logs(r, 'R1')).toMatch(/%BGP-5-ADJCHANGE: neighbor 10.0.12.2 Up/)
    expect(logs(r, 'R2')).toMatch(/%BGP-5-ADJCHANGE: neighbor 10.0.12.1 Up/)
  })

  it('yanlış remote-as (S1): Active, NOTIFICATION gönderen ve alan tarafta günlük', () => {
    const rt = createLab(pair())
    conf(rt, 'R1', 'router bgp 65010\nneighbor 10.0.12.2 remote-as 64501')
    const s = sess(rt, 'R1', '10.0.12.2')
    expect(s).toMatchObject({ state: 'Active', reason: 'badas', notification: 'sent' })
    expect(logs(rt, 'R1')).toMatch(/%BGP-5-ADJCHANGE: neighbor 10.0.12.2 Down BGP Notification sent/)
    expect(logs(rt, 'R1')).toMatch(/%BGP-3-NOTIFICATION: sent to neighbor 10.0.12.2 2\/2 \(peer in wrong AS\) 2 bytes FBF4/)
    expect(sess(rt, 'R2', '10.0.12.1')).toMatchObject({ state: 'Active', reason: 'badas', notification: 'received' })
    expect(logs(rt, 'R2')).toMatch(/%BGP-3-NOTIFICATION: received from neighbor 10.0.12.1 2\/2 \(peer in wrong AS\)/)
    expect(run(rt, 'R1', 'show ip bgp summary')).toMatch(/10\.0\.12\.2\s+4\s+64501\s+0\s+0\s+1\s+0\s+0 never\s+Active/)
    expect(run(rt, 'R1', 'show ip bgp neighbors 10.0.12.2')).toMatch(/peer in wrong AS/)
    conf(rt, 'R1', 'router bgp 65010\nneighbor 10.0.12.2 remote-as 64500')
    expect(sess(rt, 'R1', '10.0.12.2').state).toBe('Established')
  })

  it('karşıda neighbor tanımı yok: Active (nopeer)', () => {
    const rt = createLab(pair([], [], undefined, ['router bgp 64500', 'exit']))
    expect(sess(rt, 'R1', '10.0.12.2')).toMatchObject({ state: 'Active', reason: 'nopeer' })
    const rt2 = createLab(pair([], [], undefined, []))
    expect(sess(rt2, 'R1', '10.0.12.2')).toMatchObject({ state: 'Active', reason: 'nopeer' })
  })

  it('komşuya rota yok: Idle (noroute)', () => {
    const rt = createLab(pair())
    conf(rt, 'R1', 'router bgp 65010\nneighbor 9.9.9.9 remote-as 64999')
    expect(sess(rt, 'R1', '9.9.9.9')).toMatchObject({ state: 'Idle', reason: 'noroute' })
    expect(run(rt, 'R1', 'show ip bgp summary')).toMatch(/9\.9\.9\.9\s+4\s+64999 .* never\s+Idle/)
  })

  it('loopback üzerinden eBGP: multihop yoksa Idle; ebgp-multihop + update-source ile Established', () => {
    const statics1 = ['ip route 2.2.2.2 255.255.255.255 10.0.12.2']
    const statics2 = ['ip route 1.1.1.1 255.255.255.255 10.0.12.1']
    const b1 = ['router bgp 65010', 'neighbor 2.2.2.2 remote-as 64500', 'neighbor 2.2.2.2 update-source loopback0', 'exit']
    const b2 = ['router bgp 64500', 'neighbor 1.1.1.1 remote-as 65010', 'neighbor 1.1.1.1 update-source loopback0', 'exit']
    const rt = createLab(pair(statics1, statics2, b1, b2))
    expect(sess(rt, 'R1', '2.2.2.2')).toMatchObject({ state: 'Idle', reason: 'multihop' })
    expect(run(rt, 'R1', 'show ip bgp neighbors 2.2.2.2')).toMatch(/not directly connected/)
    conf(rt, 'R1', 'router bgp 65010\nneighbor 2.2.2.2 ebgp-multihop 2')
    // karşı uç da multihop istemiyorsa R1 Active kalır (karşı reddediyor)
    expect(sess(rt, 'R1', '2.2.2.2')).toMatchObject({ state: 'Active', reason: 'peer', peerReason: 'multihop' })
    conf(rt, 'R2', 'router bgp 64500\nneighbor 1.1.1.1 ebgp-multihop 2')
    expect(sess(rt, 'R1', '2.2.2.2').state).toBe('Established')
    expect(sess(rt, 'R1', '2.2.2.2').localIp).toBe('1.1.1.1')
  })

  it('update-source eksik: karşı bağlantıyı beklemediği adresten görür (nopeer / source)', () => {
    const b1 = ['router bgp 65010', 'neighbor 2.2.2.2 remote-as 64500', 'neighbor 2.2.2.2 ebgp-multihop 2', 'exit']
    const b2 = ['router bgp 64500', 'neighbor 1.1.1.1 remote-as 65010', 'neighbor 1.1.1.1 ebgp-multihop 2', 'neighbor 1.1.1.1 update-source loopback0', 'exit']
    const rt = createLab(pair(['ip route 2.2.2.2 255.255.255.255 10.0.12.2'], ['ip route 1.1.1.1 255.255.255.255 10.0.12.1'], b1, b2))
    // R1 10.0.12.1'den bağlanır; R2'de bu adres için komşu yok
    expect(sess(rt, 'R1', '2.2.2.2')).toMatchObject({ state: 'Active', reason: 'nopeer' })
    // R2 2.2.2.2'den bağlanır; R1 1.1.1.1 yerine 10.0.12.1 kaynağını kullanıyor
    expect(sess(rt, 'R2', '1.1.1.1')).toMatchObject({ state: 'Active', reason: 'source' })
    conf(rt, 'R1', 'router bgp 65010\nneighbor 2.2.2.2 update-source loopback0')
    expect(sess(rt, 'R1', '2.2.2.2').state).toBe('Established')
    expect(sess(rt, 'R2', '1.1.1.1').state).toBe('Established')
  })

  it('TCP 179\'u engelleyen ACL: Active (acl); izin verilince Established', () => {
    const rt = createLab(pair([], ['access-list 101 deny tcp any any eq bgp', 'access-list 101 permit ip any any', 'interface g0/1', 'ip access-group 101 in', 'exit']))
    expect(sess(rt, 'R1', '10.0.12.2')).toMatchObject({ state: 'Active', reason: 'acl' })
    expect(rt.query().ping('R1', '10.0.12.2').ok).toBe(true) // ICMP geçiyor: sorun yalnız TCP 179
    conf(rt, 'R2', 'interface g0/1\nno ip access-group 101 in')
    expect(sess(rt, 'R1', '10.0.12.2').state).toBe('Established')
  })

  it('MD5 parola uyuşmazlığı: Active (auth), %TCP-6-BADAUTH; aynı parolayla Established', () => {
    const rt = createLab(pair())
    conf(rt, 'R1', 'router bgp 65010\nneighbor 10.0.12.2 password CISCO')
    expect(sess(rt, 'R1', '10.0.12.2')).toMatchObject({ state: 'Active', reason: 'auth' })
    expect(logs(rt, 'R1')).toMatch(/%TCP-6-BADAUTH: No MD5 digest from 10\.0\.12\.2\(179\)/)
    conf(rt, 'R2', 'router bgp 64500\nneighbor 10.0.12.1 password OTHER')
    expect(logs(rt, 'R1')).toMatch(/%TCP-6-BADAUTH: Invalid MD5 digest from 10\.0\.12\.2/)
    conf(rt, 'R2', 'router bgp 64500\nneighbor 10.0.12.1 password CISCO')
    expect(sess(rt, 'R1', '10.0.12.2').state).toBe('Established')
    expect(run(rt, 'R1', 'show ip bgp neighbors 10.0.12.2')).toMatch(/MD5 authenticated/)
  })

  it('neighbor shutdown: Idle (Admin); karşı uç Active (peeradmin); günlükte Admin. shutdown', () => {
    const rt = createLab(pair())
    conf(rt, 'R1', 'router bgp 65010\nneighbor 10.0.12.2 shutdown')
    expect(sess(rt, 'R1', '10.0.12.2')).toMatchObject({ state: 'Idle (Admin)', reason: 'admin' })
    expect(sess(rt, 'R2', '10.0.12.1')).toMatchObject({ state: 'Active', reason: 'peeradmin' })
    expect(logs(rt, 'R1')).toMatch(/neighbor 10\.0\.12\.2 Down Admin\. shutdown/)
    expect(run(rt, 'R1', 'show ip bgp summary')).toMatch(/Idle \(Admin\)/)
    conf(rt, 'R1', 'router bgp 65010\nno neighbor 10.0.12.2 shutdown')
    expect(sess(rt, 'R1', '10.0.12.2').state).toBe('Established')
  })

  it('remote-as kendi AS\'i (iBGP) kademe 1\'de modellenmez: Idle', () => {
    const rt = createLab(pair([], [], ['router bgp 65010', 'neighbor 10.0.12.2 remote-as 65010', 'exit'], ['router bgp 65010', 'neighbor 10.0.12.1 remote-as 65010', 'exit']))
    expect(sess(rt, 'R1', '10.0.12.2')).toMatchObject({ state: 'Idle', reason: 'ibgp' })
  })

  it('arayüz kapanınca oturum düşer (Down), açılınca geri gelir', () => {
    const rt = createLab(pair())
    conf(rt, 'R2', 'interface g0/1\nshutdown')
    expect(sess(rt, 'R1', '10.0.12.2').state).not.toBe('Established')
    expect(logs(rt, 'R1')).toMatch(/neighbor 10\.0\.12\.2 Down/)
    conf(rt, 'R2', 'interface g0/1\nno shutdown')
    expect(sess(rt, 'R1', '10.0.12.2').state).toBe('Established')
  })

  it('CLI: önce remote-as gerekir, kendi adresi komşu olamaz, tek BGP süreci', () => {
    const rt = createLab(pair())
    expect(conf(rt, 'R1', 'router bgp 65010\nneighbor 10.9.9.9 shutdown').join('\n')).toMatch(/Specify remote-as/)
    expect(conf(rt, 'R1', 'router bgp 65010\nneighbor 10.0.12.1 remote-as 1').join('\n')).toMatch(/local system/)
    expect(conf(rt, 'R1', 'router bgp 1').join('\n')).toMatch(/already running; AS is 65010/)
    expect(run(rt, 'R1', 'show running-config')).toMatch(/router bgp 65010\n bgp log-neighbor-changes\n neighbor 10\.0\.12\.2 remote-as 64500\n!/)
  })
})

describe('eBGP: önek duyurma', () => {
  it('network RIB\'de tam eşleşme ister; /23 için Null0 statik (S2)', () => {
    const rt = createLab(isp())
    conf(rt, 'R1', 'interface g0/0\nip address 198.51.100.1 255.255.255.0\nexit\ninterface g0/3\nip address 198.51.101.1 255.255.255.0\nno shutdown\nexit\nrouter bgp 65010\nnetwork 198.51.100.0 mask 255.255.254.0')
    expect(paths(rt, 'R1', '198.51.100.0', 23)).toEqual([])
    expect(paths(rt, 'R4', '198.51.100.0', 23)).toEqual([])
    conf(rt, 'R1', 'ip route 198.51.100.0 255.255.254.0 Null0')
    expect(best(rt, 'R1', '198.51.100.0', 23)).toMatchObject({ local: true, nh: '0.0.0.0', weight: 32768, origin: 'i' })
    expect(best(rt, 'R4', '198.51.100.0', 23)!.asPath).toEqual([64500, 65010])
    expect(run(rt, 'R1', 'show ip route')).toMatch(/S\s+198\.51\.100\.0\/23 is directly connected, Null0/)
    expect(run(rt, 'R1', 'show running-config')).toMatch(/ip route 198\.51\.100\.0 255\.255\.254\.0 Null0/)
    expect(run(rt, 'R1', 'show running-config')).toMatch(/ network 198\.51\.100\.0 mask 255\.255\.254\.0/)
    // g0/3'te kablo yok: bağlı ağ tabloda değil, paket /23 Null0 rotasına düşer ve atılır
    expect(rt.query().routeFor('R1', '198.51.101.200')).toMatchObject({ code: 'S', ifname: 'Null0' })
    expect(rt.query().ping('H1', '198.51.101.200').ok).toBe(false)
  })

  it('maskesiz network sınıflı maske demektir: /24 bağlı ağ için 203.0.114.0 yeter, 10.24.0.0 (sınıf A) yetmez', () => {
    const rt = createLab(isp({ R2: ['network 10.24.0.0'] }))
    expect(best(rt, 'R4', '203.0.114.0', 24)!.local).toBe(true)
    expect(paths(rt, 'R2', '10.0.0.0', 8)).toEqual([])
    conf(rt, 'R2', 'router bgp 64500\nno network 10.24.0.0\nnetwork 10.24.0.0 mask 255.255.255.252')
    expect(best(rt, 'R1', '10.24.0.0', 30)!.asPath).toEqual([64500])
  })

  it('redistribute connected/static: ORIGIN ?, MED redistribute metric ya da default-metric', () => {
    const rt = createLab(isp({ R2: ['redistribute static metric 70'], R3: ['redistribute connected', 'default-metric 9'] }, { R2: ['ip route 172.16.0.0 255.255.0.0 Null0', 'ip route 0.0.0.0 0.0.0.0 10.24.0.2'] }))
    const s = best(rt, 'R1', '172.16.0.0', 16)!
    expect(s).toMatchObject({ origin: '?', med: 70, asPath: [64500] })
    // varsayılan rota redistribute ile duyurulmaz
    expect(paths(rt, 'R1', '0.0.0.0', 0)).toEqual([])
    expect(best(rt, 'R1', '10.34.0.0', 30)).toMatchObject({ origin: '?', med: 9, asPath: [64600] })
    expect(run(rt, 'R1', 'show ip bgp')).toMatch(/\*>\s+172\.16\.0\.0\s+203\.0\.113\.1\s+70\s+0 64500 \?/)
  })

  it('AS_PATH: duyururken kendi AS eklenir, next hop duyuran router; kendi AS\'ini gören yol reddedilir', () => {
    const rt = createLab(isp({ R3: ['neighbor 10.34.0.2 weight 500'] }))
    expect(best(rt, 'R4', '198.51.100.0', 24)).toMatchObject({ asPath: [64500, 65010], nh: '10.24.0.1' })
    // R3, R1'in LAN'ını R4 üzerinden seçer ve R1'e geri duyurur: R1 kendi AS'ini görüp reddeder
    expect(best(rt, 'R3', '198.51.100.0', 24)!.asPath).toEqual([64700, 64500, 65010])
    expect(rt.query().bgp('R1')!.loopRejected['192.0.2.1']).toContain('198.51.100.0/24')
    expect(paths(rt, 'R1', '198.51.100.0', 24).every((p) => p.local)).toBe(true)
    expect(run(rt, 'R1', 'show ip bgp neighbors 192.0.2.1')).toMatch(/AS_PATH loop: 1 prefix/)
  })

  it('MED yalnız yerel kaynaklı yolda gönderilir (komşu AS\'in MED\'i başka AS\'e aktarılmaz)', () => {
    const rt = createLab(isp({ R4: ['redistribute static metric 33'] }, { R4: ['ip route 172.30.0.0 255.255.0.0 Null0'] }))
    expect(best(rt, 'R2', '172.30.0.0', 16)!.med).toBe(33)
    expect(best(rt, 'R1', '172.30.0.0', 16)!.med).toBeNull()
  })

  it('uçtan uca: H1 → H4 ping BGP rotalarıyla; rota tablosunda B [20/0]', () => {
    const rt = createLab(isp())
    expect(rt.query().ping('H1', '203.0.114.10').ok).toBe(true)
    expect(rt.query().routeFor('R1', '203.0.114.10')).toMatchObject({ source: 'B', ad: 20 })
    expect(run(rt, 'R1', 'show ip route bgp')).toMatch(/B\s+203\.0\.114\.0\/24 \[20\/0\] via 203\.0\.113\.1, 00:12:34/)
    expect(run(rt, 'R1', 'show ip route 203.0.114.10')).toMatch(/Known via "bgp 65010", distance 20, metric 0\n {2}Tag 64500, type external/)
    // ISP-A oturumu düşünce yedek yol (ISP-B) kurulur
    conf(rt, 'R1', 'router bgp 65010\nneighbor 203.0.113.1 shutdown')
    expect(rt.query().routeFor('R1', '203.0.114.10')!.nextHop).toBe('192.0.2.1')
    expect(rt.query().ping('H1', '203.0.114.10').ok).toBe(true)
  })
})

describe('eBGP: en iyi yol seçimi', () => {
  const P = (o: Partial<BgpPath>): BgpPath => ({
    net: '10.0.0.0', prefix: 8, nh: '1.1.1.1', from: '1.1.1.1', peerRid: '9.9.9.9', asPath: [100], origin: 'i', med: null, lp: 100, weight: 0, local: false, sourced: null, valid: true, best: false, ...o,
  })
  const pick = (ps: BgpPath[]) => {
    const r = selectBest(ps)
    return { i: ps.indexOf(r.best!), step: r.step }
  }

  it('her adım tek başına ve Cisco sırasıyla (yapay yollar)', () => {
    // geçersiz (next hop çözülmüyor) yol aday değil
    expect(pick([P({ valid: false, weight: 9 }), P({ from: '2.2.2.2' })])).toEqual({ i: 1, step: 'only' })
    expect(pick([P({}), P({ weight: 1, asPath: [1, 2, 3] })])).toEqual({ i: 1, step: 'weight' })
    expect(pick([P({ lp: 100 }), P({ lp: 200, asPath: [1, 2, 3] })])).toEqual({ i: 1, step: 'localpref' })
    expect(pick([P({}), P({ local: true, nh: '0.0.0.0', from: null, asPath: [1, 2] })])).toEqual({ i: 1, step: 'local' })
    expect(pick([P({ asPath: [1, 2] }), P({ asPath: [3], origin: '?' })])).toEqual({ i: 1, step: 'aspath' })
    expect(pick([P({ origin: '?' }), P({ origin: 'i', med: 999 })])).toEqual({ i: 1, step: 'origin' })
    expect(pick([P({ med: 50 }), P({ med: 10, peerRid: '99.9.9.9' })])).toEqual({ i: 1, step: 'med' })
    expect(pick([P({ peerRid: '5.5.5.5' }), P({ peerRid: '4.4.4.4' })])).toEqual({ i: 1, step: 'routerid' })
    expect(pick([P({ from: '10.0.0.9' }), P({ from: '10.0.0.2' })])).toEqual({ i: 1, step: 'neighbor' })
  })

  it('sıra: Weight > LP > yerel > AS_PATH > ORIGIN > MED > router-id', () => {
    expect(pick([P({ weight: 10, lp: 50 }), P({ lp: 900 })]).i).toBe(0)
    expect(pick([P({ lp: 200, asPath: [1, 2, 3, 4] }), P({ local: true, from: null })]).i).toBe(0)
    expect(pick([P({ local: true, from: null, asPath: [1, 2, 3] }), P({ asPath: [] })]).i).toBe(0)
    expect(pick([P({ asPath: [1], origin: '?' }), P({ asPath: [1, 2], origin: 'i' })]).i).toBe(0)
    expect(pick([P({ origin: 'i', med: 900 }), P({ origin: '?', med: 0 })]).i).toBe(0)
    expect(pick([P({ med: 1, peerRid: '9.9.9.9' }), P({ med: 2, peerRid: '1.1.1.1' })]).i).toBe(0)
  })

  it('MED yalnız aynı komşu AS\'den gelen yollar arasında karşılaştırılır (MED yoksa 0)', () => {
    // farklı AS: MED atlanır, router-id karar verir
    expect(pick([P({ asPath: [100], med: 50, peerRid: '1.1.1.1' }), P({ asPath: [200], med: 10, peerRid: '2.2.2.2' })])).toEqual({ i: 0, step: 'routerid' })
    // eksik MED 0 sayılır
    expect(pick([P({ med: 5 }), P({ med: null, peerRid: '99.9.9.9' })])).toEqual({ i: 1, step: 'med' })
  })

  it('topolojide: kısa AS_PATH; yedek yol tabloda kalır (* ve *>)', () => {
    // R3 eşit uzunlukta (R1 ve R4 üzerinden) R4 yolunu seçsin ki R1'e 3 AS'lik yedek gelsin
    const rt = createLab(isp({ R2: ['network 10.24.0.0 mask 255.255.255.252'], R3: ['neighbor 10.34.0.2 weight 10'] }))
    const b = best(rt, 'R1', '10.24.0.0', 30)!
    expect(b).toMatchObject({ asPath: [64500], decidedBy: 'aspath' })
    expect(paths(rt, 'R1', '10.24.0.0', 30)).toHaveLength(2)
    const out = run(rt, 'R1', 'show ip bgp')
    expect(out).toMatch(/ \*>\s+10\.24\.0\.0\/30\s+203\.0\.113\.1\s+0\s+0 64500 i/)
    expect(out).toMatch(/ \* {2}\s+192\.0\.2\.1\s+0 64600 64700 64500 i/)
  })

  it('topolojide: neighbor weight AS_PATH\'ten önce gelir', () => {
    const rt = createLab(isp({ R2: ['network 10.24.0.0 mask 255.255.255.252'], R1: ['neighbor 192.0.2.1 weight 100'], R3: ['neighbor 10.34.0.2 weight 10'] }))
    expect(best(rt, 'R1', '10.24.0.0', 30)).toMatchObject({ from: '192.0.2.1', weight: 100, decidedBy: 'weight' })
    expect(run(rt, 'R1', 'show ip bgp neighbors 192.0.2.1')).toMatch(/Default weight 100/)
  })

  it('topolojide: aynı AS_PATH uzunluğunda ORIGIN i, ? \'den iyidir', () => {
    const rt = createLab(isp({ R2: ['network 172.16.0.0'], R3: ['redistribute static'] }, { R2: ['ip route 172.16.0.0 255.255.0.0 Null0'], R3: ['ip route 172.16.0.0 255.255.0.0 Null0'] }))
    expect(best(rt, 'R1', '172.16.0.0', 16)).toMatchObject({ from: '203.0.113.1', origin: 'i', decidedBy: 'origin' })
  })

  it('topolojide: aynı komşu AS\'den iki yolda düşük MED; farklı AS\'te MED atlanır', () => {
    const extra = { R2: ['redistribute static metric 50'], R3: ['redistribute static metric 10'] }
    const statics = { R2: ['ip route 172.16.0.0 255.255.0.0 Null0'], R3: ['ip route 172.16.0.0 255.255.0.0 Null0'] }
    const same = createLab(isp(extra, statics, { R3: 64500 }))
    expect(best(same, 'R1', '172.16.0.0', 16)).toMatchObject({ from: '192.0.2.1', med: 10, decidedBy: 'med' })
    const diff = createLab(isp(extra, statics))
    // farklı AS: MED karşılaştırılmaz, düşük router-id (R2 2.2.2.2) kazanır
    expect(best(diff, 'R1', '172.16.0.0', 16)).toMatchObject({ from: '203.0.113.1', med: 50, decidedBy: 'routerid' })
  })

  it('topolojide: eşit yollarda en düşük komşu router-id', () => {
    const rt = createLab(isp())
    expect(best(rt, 'R1', '203.0.114.0', 24)).toMatchObject({ from: '203.0.113.1', peerRid: '2.2.2.2', decidedBy: 'routerid' })
    conf(rt, 'R3', 'router bgp 64600\nbgp router-id 1.0.0.1')
    expect(best(rt, 'R1', '203.0.114.0', 24)).toMatchObject({ from: '192.0.2.1', decidedBy: 'routerid' })
  })

  it('bgp default local-preference: yollar bu değeri alır ve tabloda görünür', () => {
    const rt = createLab(isp({ R1: ['bgp default local-preference 150'] }))
    expect(best(rt, 'R1', '203.0.114.0', 24)!.lp).toBe(150)
    expect(run(rt, 'R1', 'show ip bgp')).toMatch(/203\.0\.114\.0\s+203\.0\.113\.1\s+150\s+0 64500 64700 i/)
  })
})

describe('eBGP: rota tablosunda AD yarışı', () => {
  it('statik (AD 1) BGP\'yi yener: show ip bgp\'de r (RIB-failure); floating statik (AD 250) yenemez', () => {
    const rt = createLab(isp({}, { R1: ['ip route 203.0.114.0 255.255.255.0 192.0.2.1'] }))
    expect(rt.query().routeFor('R1', '203.0.114.10')!.source).toBe('S')
    expect(best(rt, 'R1', '203.0.114.0', 24)!.ribFailure).toBe(true)
    expect(run(rt, 'R1', 'show ip bgp')).toMatch(/ r>\s+203\.0\.114\.0/)
    conf(rt, 'R1', 'no ip route 203.0.114.0 255.255.255.0 192.0.2.1\nip route 203.0.114.0 255.255.255.0 192.0.2.1 250')
    expect(rt.query().routeFor('R1', '203.0.114.10')!.source).toBe('B')
    expect(best(rt, 'R1', '203.0.114.0', 24)!.ribFailure).toBeUndefined()
  })

  it('eBGP (20) OSPF\'i (110) ve EIGRP\'yi (170, dış) yener; BGP çekilince IGP rotası kurulur', () => {
    // R2 aynı /24'ü hem IGP'ye (redistribute static) hem BGP'ye verir
    const st = 'ip route 172.20.0.0 255.255.255.0 Null0'
    const ospf = createLab(isp({ R2: ['network 172.20.0.0 mask 255.255.255.0'] }, {
      R2: [st, 'router ospf 1', 'redistribute static subnets', 'network 203.0.113.0 0.0.0.3 area 0', 'exit'],
      R1: ['router ospf 1', 'network 203.0.113.0 0.0.0.3 area 0', 'exit'],
    }))
    const r172 = (rt: LabRuntime) => routeTable(rt.derived, 'R1').find((e) => e.net === '172.20.0.0' && e.prefix === 24)
    expect(r172(ospf)!.code).toBe('B')
    conf(ospf, 'R2', 'router bgp 64500\nno network 172.20.0.0 mask 255.255.255.0')
    expect(r172(ospf)!.code).toBe('O E2')
    const eigrp = createLab(isp({ R2: ['network 172.20.0.0 mask 255.255.255.0'] }, {
      R2: [st, 'router eigrp 1', 'redistribute static metric 100000 10 255 1 1500', 'network 203.0.113.0 0.0.0.3', 'exit'],
      R1: ['router eigrp 1', 'network 203.0.113.0 0.0.0.3', 'exit'],
    }))
    expect(r172(eigrp)!.code).toBe('B')
    conf(eigrp, 'R2', 'router bgp 64500\nno network 172.20.0.0 mask 255.255.255.0')
    expect(r172(eigrp)!.code).toBe('D EX')
  })

  it('multihop: next hop (karşı loopback) statik rotayla özyinelemeli çözülür', () => {
    const b1 = ['router bgp 65010', 'neighbor 2.2.2.2 remote-as 64500', 'neighbor 2.2.2.2 update-source loopback0', 'neighbor 2.2.2.2 ebgp-multihop 2', 'exit']
    const b2 = ['router bgp 64500', 'network 172.22.0.0', 'neighbor 1.1.1.1 remote-as 65010', 'neighbor 1.1.1.1 update-source loopback0', 'neighbor 1.1.1.1 ebgp-multihop 2', 'exit']
    const rt = createLab(pair(['ip route 2.2.2.2 255.255.255.255 10.0.12.2'], ['ip route 1.1.1.1 255.255.255.255 10.0.12.1', 'interface loopback2', 'ip address 172.22.0.1 255.255.0.0', 'exit'], b1, b2))
    const r = routeTable(rt.derived, 'R1').find((e) => e.net === '172.22.0.0')!
    expect(r).toMatchObject({ code: 'B', nh: '2.2.2.2', via: '10.0.12.2', ifname: 'GigabitEthernet0/1' })
    expect(rt.query().ping('R1', '172.22.0.1', { src: '1.1.1.1' } as never).ok ?? true).toBe(true)
  })
})

describe('eBGP: show ve CLI', () => {
  it('show ip bgp summary, show ip bgp <önek>, advertised-routes, routes', () => {
    const rt = createLab(isp({ R2: ['network 10.24.0.0 mask 255.255.255.252'], R3: ['neighbor 10.34.0.2 weight 10'] }))
    const sum = run(rt, 'R1', 'show ip bgp summary')
    expect(sum).toMatch(/^BGP router identifier 1\.1\.1\.1, local AS number 65010/)
    expect(sum).toMatch(/Neighbor {8}V {11}AS MsgRcvd MsgSent {3}TblVer {2}InQ OutQ Up\/Down {2}State\/PfxRcd/)
    expect(sum).toMatch(/203\.0\.113\.1\s+4\s+64500\s+12\s+10\s+\d+\s+0\s+0 00:12:34\s+2/)
    const pfx = run(rt, 'R1', 'show ip bgp 10.24.0.0 255.255.255.252')
    expect(pfx).toMatch(/BGP routing table entry for 10\.24\.0\.0\/30/)
    expect(pfx).toMatch(/Paths: \(2 available, best #1, table default\)/)
    expect(pfx).toMatch(/203\.0\.113\.1 from 203\.0\.113\.1 \(2\.2\.2\.2\)\n {6}Origin IGP, metric 0, localpref 100, valid, external, best/)
    expect(pfx).toMatch(/AğLab: best path selected by AS_PATH length/)
    expect(run(rt, 'R1', 'show ip bgp 10.24.0.1')).toMatch(/entry for 10\.24\.0\.0\/30/)
    expect(run(rt, 'R1', 'show ip bgp 9.9.9.0 255.255.255.0')).toMatch(/Network not in table/)
    const adv = run(rt, 'R1', 'show ip bgp neighbors 203.0.113.1 advertised-routes')
    expect(adv).toMatch(/\*>\s+198\.51\.100\.0\s+0\.0\.0\.0\s+0\s+32768 i/)
    expect(adv).not.toMatch(/10\.24\.0\.0/) // ondan öğrenileni ona duyurmaz
    expect(run(rt, 'R1', 'show ip bgp neighbors 203.0.113.1 routes')).toMatch(/Total number of prefixes 2/)
    const own = run(rt, 'R1', 'show ip bgp 198.51.100.0')
    expect(own).toMatch(/Local\n {4}0\.0\.0\.0 from 0\.0\.0\.0 \(1\.1\.1\.1\)\n {6}Origin IGP, metric 0, localpref 100, weight 32768, valid, sourced, local, best/)
  })

  it('show ip bgp neighbors: durum, uzak router ID, önek sayıları', () => {
    const rt = createLab(isp({ R1: ['neighbor 203.0.113.1 description ISP-A'] }))
    const out = run(rt, 'R1', 'show ip bgp neighbors 203.0.113.1')
    expect(out).toMatch(/BGP neighbor is 203\.0\.113\.1, {2}remote AS 64500, external link\n Description: ISP-A\n {2}BGP version 4, remote router ID 2\.2\.2\.2\n {2}BGP state = Established, up for 00:12:34/)
    expect(out).toMatch(/Prefixes Current: 1 sent, 1 received/)
    expect(out).toMatch(/Local host: 203\.0\.113\.2, Local port: 179/)
    expect(run(rt, 'R1', 'show ip bgp neighbors 9.9.9.9')).toMatch(/No such neighbor/)
  })

  it('BGP yoksa show komutları "% BGP not active"', () => {
    const rt = createLab(pair([], [], [], []))
    for (const c of ['show ip bgp', 'show ip bgp summary', 'show ip bgp neighbors']) expect(run(rt, 'R1', c)).toBe('% BGP not active')
  })

  it('running-config bloğu ve | section bgp; show ip protocols', () => {
    const rt = createLab(isp({ R1: ['neighbor 203.0.113.1 description ISP-A', 'neighbor 203.0.113.1 password S3cr', 'neighbor 192.0.2.1 weight 50', 'redistribute static metric 5', 'bgp default local-preference 120', 'default-metric 7'] }))
    const sec = run(rt, 'R1', 'show running-config | section bgp')
    expect(sec).toBe(
      [
        'router bgp 65010',
        ' bgp router-id 1.1.1.1',
        ' bgp log-neighbor-changes',
        ' bgp default local-preference 120',
        ' network 198.51.100.0',
        ' redistribute static metric 5',
        ' neighbor 203.0.113.1 remote-as 64500',
        ' neighbor 203.0.113.1 description ISP-A',
        ' neighbor 203.0.113.1 password S3cr',
        ' neighbor 192.0.2.1 remote-as 64600',
        ' neighbor 192.0.2.1 weight 50',
        ' default-metric 7',
      ].join('\n'),
    )
    expect(run(rt, 'R1', 'show ip protocols')).toMatch(/Routing Protocol is "bgp 65010"[\s\S]*Distance: external 20 internal 200 local 200/)
    // running-config'ten aynı durum geri kurulur
    const rc = run(rt, 'R1', 'show running-config')
    const back = createLab(isp())
    conf(back, 'R1', 'no router bgp 65010')
    runScript(back, 'R1', 'configure terminal\n' + rc.split('\n').filter((l) => !/^(Building|Current configuration|!|end|version|$)/.test(l)).join('\n') + '\nend')
    expect(run(back, 'R1', 'show running-config | section bgp')).toBe(sec)
  })

  it('clear ip bgp: sert sıfırlama günlükte Down/Up; soft sıfırlama oturumu düşürmez', () => {
    const rt = createLab(isp())
    const n0 = rt.logs.length
    runScript(rt, 'R1', 'clear ip bgp 203.0.113.1 soft')
    expect(rt.logs.length).toBe(n0)
    runScript(rt, 'R1', 'clear ip bgp *')
    expect(logs(rt, 'R1')).toMatch(/neighbor 203\.0\.113\.1 Down User reset[\s\S]*neighbor 203\.0\.113\.1 Up/)
    expect(sess(rt, 'R1', '203.0.113.1').state).toBe('Established')
    expect(run(rt, 'R1', 'clear ip bgp 9.9.9.9')).toMatch(/No such neighbor/)
  })

  it('no router bgp ve no ip routing BGP\'yi kaldırır; komşu rotaları tablodan çıkar', () => {
    const rt = createLab(isp())
    conf(rt, 'R2', 'no router bgp 64500')
    expect(sess(rt, 'R1', '203.0.113.1')).toMatchObject({ state: 'Active', reason: 'nopeer' })
    expect(best(rt, 'R1', '203.0.114.0', 24)!.from).toBe('192.0.2.1')
    conf(rt, 'R3', 'no ip routing')
    expect(rt.running['R3']!.bgp).toBeNull()
    expect(rt.query().routeFor('R1', '203.0.114.10')).toBeNull()
  })
})

describe('eBGP: köprü', () => {
  it('BGP ve Null0 statik rota AğLab\'a dönüşte "desteklenmiyor" olarak raporlanır', () => {
    const t: AglabTopology = {
      app: 'AgLab', version: 23,
      devices: [
        { id: 'r1', name: 'R1', type: 'Router', x: 0, y: 0, enabled: true, ip: '', mask: '', gateway: '', route: '', ports: ['g0/0', 'g0/1'], interfaces: { 'g0/0': { enabled: true, ip: '10.0.12.1', mask: '255.255.255.252' } }, staticRoutes: [] },
      ],
      links: [],
    }
    for (const [script, msg] of [
      ['router bgp 65010\nneighbor 10.0.12.2 remote-as 64500', /BGP yapılandırması \(router bgp 65010; desteklenmiyor\)/],
      ['ip route 10.9.0.0 255.255.0.0 Null0', /Null0 statik rota .*desteklenmiyor/],
    ] as const) {
      const rt = createRuntime(toLabber(t))
      runScript(rt, 'r1', 'configure terminal\n' + script + '\nend')
      expect(() => toAglab(rt, t), script).toThrow(BridgeError)
      expect(() => toAglab(rt, t), script).toThrow(msg)
    }
  })

  it('AğLab modelinin eski bgp alanı Labber\'a çevrilmez (gerekçeyle)', () => {
    const t: AglabTopology = {
      app: 'AgLab', version: 23,
      devices: [{ id: 'r1', name: 'R1', type: 'Router', x: 0, y: 0, enabled: true, ip: '', mask: '', gateway: '', route: '', ports: ['g0/0'], interfaces: {}, staticRoutes: [], bgp: { asn: 65001 } }],
      links: [],
    }
    const r = toLabber(t)
    expect(r.report.expressible).toBe(false)
    expect(r.report.reasons.join('\n')).toMatch(/bgp alanı Labber'a çevrilmez/)
  })
})
