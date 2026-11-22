// eBGP politikası (kademe 1b): ip prefix-list, route-map (match/set), neighbor … in|out ve
// soft clear. Politika oturum kurulunca ya da clear ip bgp ile dondurulur; sonraki değişiklik
// soft clear'a kadar etkisizdir. Her davranış hem başarılı hem başarısız durumla sınanır.
import { describe, expect, it } from 'vitest'
import { createLab, runScript } from '../../src/sim'
import { applyPolicy, parsePrefixListLine, plEntryMatches, prefixListPermits, type BgpPolicy } from '../../src/sim/bgp-policy'
import type { PrefixListEntry, RouteMapEntry } from '../../src/sim/types'
import { createRuntime, toAglab, toLabber, BridgeError } from '../../src/sim-bridge/bridge'
import type { AglabTopology } from '../../src/sim-bridge/aglab'
import { best, conf, isp, paths, run, sess } from './fixtures/bgp'

const pl = (o: Partial<PrefixListEntry>): PrefixListEntry => ({ seq: 5, action: 'permit', net: '10.0.0.0', len: 8, ...o })
const rm = (o: Partial<RouteMapEntry>): RouteMapEntry => ({ seq: 10, action: 'permit', matchPrefixLists: [], matchAcls: [], set: {}, ...o })
const pol = (o: Partial<BgpPolicy>): BgpPolicy => ({ prefixList: null, routeMap: null, ...o })

describe('prefix-list', () => {
  it('ge/le yoksa uzunluk tam eşit; ge/le aralığı; ağ bitleri eşleşmeli', () => {
    expect(plEntryMatches(pl({}), '10.0.0.0', 8)).toBe(true)
    expect(plEntryMatches(pl({}), '10.1.0.0', 16)).toBe(false)
    expect(plEntryMatches(pl({ le: 24 }), '10.1.0.0', 16)).toBe(true)
    expect(plEntryMatches(pl({ le: 24 }), '10.1.1.0', 25)).toBe(false)
    expect(plEntryMatches(pl({ ge: 24 }), '10.1.1.0', 24)).toBe(true)
    expect(plEntryMatches(pl({ ge: 24 }), '10.1.0.0', 16)).toBe(false)
    expect(plEntryMatches(pl({ net: '0.0.0.0', len: 0, le: 32 }), '203.0.114.0', 24)).toBe(true)
    expect(plEntryMatches(pl({ le: 32 }), '11.0.0.0', 8)).toBe(false)
  })

  it('ilk eşleşen satır karar verir; hiçbiri eşleşmezse ret; liste yoksa izin', () => {
    const list = [pl({ seq: 5, action: 'deny', net: '10.1.0.0', len: 16 }), pl({ seq: 10, le: 24 })]
    expect(prefixListPermits(list, '10.1.0.0', 16)).toBe(false)
    expect(prefixListPermits(list, '10.2.0.0', 16)).toBe(true)
    expect(prefixListPermits(list, '172.16.0.0', 16)).toBe(false)
    expect(prefixListPermits(null, '172.16.0.0', 16)).toBe(true)
  })

  it('satır çözümleme: otomatik sıra (+5), geçersiz önek ve aralık reddedilir', () => {
    const list: PrefixListEntry[] = []
    const a = parsePrefixListLine('permit 10.0.0.0/8 le 24', list) as PrefixListEntry
    expect(a).toMatchObject({ seq: 5, action: 'permit', net: '10.0.0.0', len: 8, le: 24 })
    list.push(a)
    expect(parsePrefixListLine('deny 0.0.0.0/0 le 32', list)).toMatchObject({ seq: 10 })
    expect(parsePrefixListLine('seq 7 permit 10.0.0.0/8', list)).toMatchObject({ seq: 7 })
    expect(parsePrefixListLine('permit 10.1.0.0/8', list)).toMatch(/Invalid prefix range/)
    expect(parsePrefixListLine('permit 10.0.0.0/8 ge 8', list)).toMatch(/Invalid prefix range/)
    expect(parsePrefixListLine('allow 10.0.0.0/8', list)).toMatch(/permit or deny/)
  })
})

describe('route-map', () => {
  const lists = { PL: [pl({ net: '203.0.114.0', len: 24 })] }
  it('ilk eşleşen girdi: permit set\'leri uygular, deny reddeder; hiçbiri eşleşmezse örtük ret', () => {
    const p = pol({
      routeMap: {
        name: 'RM',
        entries: [rm({ seq: 10, action: 'deny', matchPrefixLists: ['PL'] }), rm({ seq: 20, set: { localPref: 300 } })],
        lists,
        acls: {},
      },
    })
    expect(applyPolicy(p, '203.0.114.0', 24).set).toBeNull()
    expect(applyPolicy(p, '10.0.0.0', 8).set).toEqual({ localPref: 300 })
    const onlyMatch = pol({ routeMap: { name: 'RM', entries: [rm({ matchPrefixLists: ['PL'], set: { weight: 7 } })], lists, acls: {} } })
    expect(applyPolicy(onlyMatch, '10.0.0.0', 8).set).toBeNull()
    expect(applyPolicy(onlyMatch, '203.0.114.0', 24).set).toEqual({ weight: 7 })
  })

  it('tanımsız route-map her şeyi reddeder; match\'te tanımsız prefix-list eşleşmez; ACL eşleşmesi', () => {
    expect(applyPolicy(pol({ routeMap: { name: 'X', entries: null, lists: {}, acls: {} } }), '10.0.0.0', 8).set).toBeNull()
    expect(applyPolicy(pol({ routeMap: { name: 'RM', entries: [rm({ matchPrefixLists: ['YOK'] })], lists: { YOK: null }, acls: {} } }), '10.0.0.0', 8).set).toBeNull()
    const acl = { type: 'standard' as const, entries: [{ seq: 10, action: 'permit' as const, proto: 'ip' as const, src: { addr: '203.0.114.0', wild: '0.0.0.255' } }] }
    const p = pol({ routeMap: { name: 'RM', entries: [rm({ matchAcls: ['1'], set: { metric: 5 } })], lists: {}, acls: { '1': acl as never } } })
    expect(applyPolicy(p, '203.0.114.0', 24).set).toEqual({ metric: 5 })
    expect(applyPolicy(p, '10.0.0.0', 8).set).toBeNull()
  })
})

describe('eBGP politikası: komşuya uygulama ve soft clear', () => {
  const LP = ['ip prefix-list ALL seq 5 permit 0.0.0.0/0 le 32', 'route-map LP200 permit 10', 'match ip address prefix-list ALL', 'set local-preference 200', 'exit']

  it('S3: LP 200 yanlış komşunun girişinde; taşıyınca soft clear\'a kadar değişmez, sonra ISP-A seçilir', () => {
    const rt = createLab(isp({ R1: ['neighbor 192.0.2.1 route-map LP200 in'] }, { R1: LP }))
    expect(best(rt, 'R1', '203.0.114.0', 24)).toMatchObject({ from: '192.0.2.1', lp: 200, decidedBy: 'localpref' })
    expect(rt.query().routeFor('R1', '203.0.114.10')!.nextHop).toBe('192.0.2.1')
    conf(rt, 'R1', 'router bgp 65010\nno neighbor 192.0.2.1 route-map LP200 in\nneighbor 203.0.113.1 route-map LP200 in')
    // politika değişti ama uygulanmadı
    expect(best(rt, 'R1', '203.0.114.0', 24)).toMatchObject({ from: '192.0.2.1', lp: 200 })
    expect(run(rt, 'R1', 'show ip bgp neighbors 203.0.113.1')).toMatch(/AğLab: inbound policy changed; not applied until "clear ip bgp 203\.0\.113\.1 soft in"/)
    expect(run(rt, 'R1', 'show ip bgp neighbors 192.0.2.1')).toMatch(/inbound policy changed/)
    runScript(rt, 'R1', 'clear ip bgp * soft')
    expect(best(rt, 'R1', '203.0.114.0', 24)).toMatchObject({ from: '203.0.113.1', lp: 200, decidedBy: 'localpref' })
    expect(paths(rt, 'R1', '203.0.114.0', 24).find((p) => p.from === '192.0.2.1')!.lp).toBe(100)
    expect(rt.query().routeFor('R1', '203.0.114.10')!.nextHop).toBe('203.0.113.1')
    expect(run(rt, 'R1', 'show ip bgp neighbors 203.0.113.1')).not.toMatch(/not applied/)
    expect(run(rt, 'R1', 'show ip bgp neighbors 203.0.113.1')).toMatch(/Route map for incoming advertisements is LP200/)
  })

  it('soft in yalnız girişi, soft out yalnız çıkışı uygular; sert clear ikisini', () => {
    const rt = createLab(isp({}, { R1: ['route-map PRE permit 10', 'set as-path prepend 65010 65010', 'exit', ...LP] }))
    conf(rt, 'R1', 'router bgp 65010\nneighbor 203.0.113.1 route-map PRE out\nneighbor 203.0.113.1 route-map LP200 in')
    expect(best(rt, 'R2', '198.51.100.0', 24)!.asPath).toEqual([65010])
    expect(best(rt, 'R1', '203.0.114.0', 24)!.lp).toBe(100)
    runScript(rt, 'R1', 'clear ip bgp 203.0.113.1 soft in')
    expect(best(rt, 'R1', '203.0.114.0', 24)).toMatchObject({ lp: 200, from: '203.0.113.1' })
    expect(best(rt, 'R2', '198.51.100.0', 24)!.asPath).toEqual([65010])
    runScript(rt, 'R1', 'clear ip bgp 203.0.113.1 soft out')
    expect(paths(rt, 'R2', '198.51.100.0', 24).find((p) => p.from === '203.0.113.2')!.asPath).toEqual([65010, 65010, 65010])
    // sert sıfırlama da uygular
    const rt2 = createLab(isp({}, { R1: ['route-map PRE permit 10', 'set as-path prepend 65010 65010', 'exit'] }))
    conf(rt2, 'R1', 'router bgp 65010\nneighbor 203.0.113.1 route-map PRE out')
    runScript(rt2, 'R1', 'clear ip bgp 203.0.113.1')
    expect(paths(rt2, 'R2', '198.51.100.0', 24).find((p) => p.from === '203.0.113.2')!.asPath).toEqual([65010, 65010, 65010])
  })

  it('oturum düşüp yeniden kurulunca güncel politika uygulanır', () => {
    const rt = createLab(isp({}, { R1: LP }))
    conf(rt, 'R1', 'router bgp 65010\nneighbor 192.0.2.1 route-map LP200 in')
    expect(best(rt, 'R1', '203.0.114.0', 24)!.lp).toBe(100)
    conf(rt, 'R1', 'router bgp 65010\nneighbor 192.0.2.1 shutdown')
    conf(rt, 'R1', 'router bgp 65010\nno neighbor 192.0.2.1 shutdown')
    expect(best(rt, 'R1', '203.0.114.0', 24)).toMatchObject({ from: '192.0.2.1', lp: 200 })
  })

  it('route-map\'in içeriği değişince de soft clear gerekir (anlık görüntü içeriği tutar)', () => {
    const rt = createLab(isp({ R1: ['neighbor 192.0.2.1 route-map LP200 in'] }, { R1: LP }))
    conf(rt, 'R1', 'route-map LP200 permit 10\nset local-preference 50')
    expect(best(rt, 'R1', '203.0.114.0', 24)).toMatchObject({ from: '192.0.2.1', lp: 200 })
    runScript(rt, 'R1', 'clear ip bgp 192.0.2.1 soft in')
    expect(best(rt, 'R1', '203.0.114.0', 24)).toMatchObject({ from: '203.0.113.1', lp: 100, decidedBy: 'localpref' })
  })

  it('prefix-list out: komşuya duyurulmaz (advertised-routes); prefix-list in: alınmaz', () => {
    const lists = ['ip prefix-list NOLAN seq 5 deny 198.51.100.0/24', 'ip prefix-list NOLAN seq 10 permit 0.0.0.0/0 le 32', 'ip prefix-list ONLY114 permit 203.0.114.0/24']
    const rt = createLab(isp({ R1: ['neighbor 192.0.2.1 prefix-list NOLAN out', 'neighbor 203.0.113.1 prefix-list ONLY114 in'] }, { R1: lists, R2: ['ip route 172.16.0.0 255.255.0.0 Null0'] }))
    conf(rt, 'R2', 'router bgp 64500\nnetwork 172.16.0.0')
    // R3 R1'in LAN'ını doğrudan R1'den almaz (yalnız R4 üzerinden)
    expect(paths(rt, 'R3', '198.51.100.0', 24).some((p) => p.from === '192.0.2.2')).toBe(false)
    expect(run(rt, 'R1', 'show ip bgp neighbors 192.0.2.1 advertised-routes')).not.toMatch(/198\.51\.100\.0/)
    // R1, R2'den yalnız 203.0.114.0/24'ü alır
    expect(paths(rt, 'R1', '172.16.0.0', 16).some((p) => p.from === '203.0.113.1')).toBe(false)
    expect(run(rt, 'R1', 'show ip bgp neighbors 203.0.113.1')).toMatch(/Inbound policy: 1 prefix\(es\) denied/)
    expect(run(rt, 'R1', 'show ip bgp neighbors 203.0.113.1')).toMatch(/Incoming update prefix filter list is ONLY114/)
  })

  it('set metric (çıkış) MED olur; set weight (giriş) weight olur; tanımsız route-map her şeyi reddeder', () => {
    const rt = createLab(isp({ R2: ['neighbor 203.0.113.2 route-map MED out'], R1: ['neighbor 192.0.2.1 route-map W in'] }, { R2: ['route-map MED permit 10', 'set metric 77', 'exit'], R1: ['route-map W permit 10', 'set weight 300', 'exit'] }))
    expect(paths(rt, 'R1', '203.0.114.0', 24).find((p) => p.from === '203.0.113.1')!.med).toBe(77)
    expect(best(rt, 'R1', '203.0.114.0', 24)).toMatchObject({ from: '192.0.2.1', weight: 300, decidedBy: 'weight' })
    const none = createLab(isp({ R1: ['neighbor 192.0.2.1 route-map YOK in'] }))
    expect(paths(none, 'R1', '203.0.114.0', 24).every((p) => p.from !== '192.0.2.1')).toBe(true)
    expect(sess(none, 'R1', '192.0.2.1').state).toBe('Established')
  })

  it('route-map ACL eşleşmesi (standart ACL ağ adresine bakar)', () => {
    const rt = createLab(isp({ R1: ['neighbor 192.0.2.1 route-map A in'] }, { R1: ['access-list 10 permit 203.0.114.0 0.0.0.255', 'route-map A permit 10', 'match ip address 10', 'set local-preference 250', 'exit', 'route-map A permit 20', 'exit'] }))
    expect(best(rt, 'R1', '203.0.114.0', 24)).toMatchObject({ from: '192.0.2.1', lp: 250 })
  })

  it('show ip prefix-list, show route-map, running-config ve geri kurma', () => {
    const rt = createLab(isp({ R1: ['neighbor 203.0.113.1 prefix-list ONLY in', 'neighbor 203.0.113.1 route-map LP200 in'] }, { R1: [...LP, 'ip prefix-list ONLY permit 203.0.114.0/24 le 32'] }))
    expect(run(rt, 'R1', 'show ip prefix-list')).toMatch(/ip prefix-list ALL: 1 entries\n {3}seq 5 permit 0\.0\.0\.0\/0 le 32\nip prefix-list ONLY: 1 entries\n {3}seq 5 permit 203\.0\.114\.0\/24 le 32/)
    expect(run(rt, 'R1', 'show route-map LP200')).toMatch(/route-map LP200, permit, sequence 10\n {2}Match clauses:\n {4}ip address prefix-lists: ALL \n {2}Set clauses:\n {4}local-preference 200/)
    const rc = run(rt, 'R1', 'show running-config')
    expect(rc).toMatch(/ neighbor 203\.0\.113\.1 prefix-list ONLY in\n neighbor 203\.0\.113\.1 route-map LP200 in/)
    expect(rc).toMatch(/ip prefix-list ALL seq 5 permit 0\.0\.0\.0\/0 le 32\nip prefix-list ONLY seq 5 permit 203\.0\.114\.0\/24 le 32\n!\nroute-map LP200 permit 10\n match ip address prefix-list ALL\n set local-preference 200\n!/)
    const back = createLab(isp())
    conf(back, 'R1', 'no router bgp 65010')
    runScript(back, 'R1', 'configure terminal\n' + rc.split('\n').filter((l) => !/^(Building|Current configuration|!|end|version|$)/.test(l)).join('\n') + '\nend')
    expect(run(back, 'R1', 'show running-config')).toBe(rc)
  })

  it('CLI: route-map sıra numarası, no route-map, no ip prefix-list seq', () => {
    const rt = createLab(isp())
    conf(rt, 'R1', 'route-map M permit 10\nset weight 1\nexit\nroute-map M deny 20\nexit')
    expect(conf(rt, 'R1', 'route-map M').join('\n')).toMatch(/specify the entry/)
    conf(rt, 'R1', 'no route-map M deny 20')
    expect(rt.running['R1']!.routeMaps!['M']!.map((e) => e.seq)).toEqual([10])
    conf(rt, 'R1', 'no route-map M')
    expect(rt.running['R1']!.routeMaps!['M']).toBeUndefined()
    conf(rt, 'R1', 'ip prefix-list P permit 10.0.0.0/8\nip prefix-list P permit 11.0.0.0/8\nno ip prefix-list P seq 5')
    expect(rt.running['R1']!.prefixLists!['P']!.map((e) => e.seq)).toEqual([10])
    expect(conf(rt, 'R1', 'ip prefix-list P permit 10.1.0.0/8').join('\n')).toMatch(/Invalid prefix range/)
    expect(run(rt, 'R1', 'show route-map M')).toBe('')
  })

  it('ders 2.6 yapılandırması: ISP-A girişinde LP 200, ISP-B çıkışında prepend', () => {
    const cfg = ['route-map ISP-A-IN permit 10', 'set local-preference 200', 'route-map ISP-B-OUT permit 10', 'set as-path prepend 65010 65010', 'exit']
    const rt = createLab(isp({ R1: ['neighbor 203.0.113.1 route-map ISP-A-IN in', 'neighbor 192.0.2.1 route-map ISP-B-OUT out'] }, { R1: cfg }))
    expect(best(rt, 'R1', '203.0.114.0', 24)).toMatchObject({ from: '203.0.113.1', lp: 200, decidedBy: 'localpref' })
    expect(paths(rt, 'R3', '198.51.100.0', 24).find((p) => p.from === '192.0.2.2')!.asPath).toEqual([65010, 65010, 65010])
    // R4 şubeye giden kısa yolu (ISP-A) seçer: gelen trafik de ISP-A'dan
    expect(best(rt, 'R4', '198.51.100.0', 24)!.asPath).toEqual([64500, 65010])
  })

  it('kayıt/yükleme: soft clear bekleyen değişiklik kayıttan sonra da bekler', () => {
    const rt = createLab(isp({}, { R1: LP }))
    conf(rt, 'R1', 'router bgp 65010\nneighbor 192.0.2.1 route-map LP200 in')
    const saved = rt.save()
    const back = createLab(isp({}, { R1: LP }))
    expect(back.load(saved)).toBe(true)
    expect(best(back, 'R1', '203.0.114.0', 24)!.lp).toBe(100)
    runScript(back, 'R1', 'clear ip bgp * soft in')
    expect(best(back, 'R1', '203.0.114.0', 24)).toMatchObject({ from: '192.0.2.1', lp: 200 })
  })

  it('köprü: prefix-list ve route-map AğLab\'a dönüşte "desteklenmiyor"', () => {
    const t: AglabTopology = {
      app: 'AgLab', version: 23,
      devices: [{ id: 'r1', name: 'R1', type: 'Router', x: 0, y: 0, enabled: true, ip: '', mask: '', gateway: '', route: '', ports: ['g0/0'], interfaces: { 'g0/0': { enabled: true, ip: '10.0.12.1', mask: '255.255.255.252' } }, staticRoutes: [] }],
      links: [],
    }
    for (const [script, msg] of [
      ['ip prefix-list P permit 10.0.0.0/8', /ip prefix-list P \(desteklenmiyor\)/],
      ['route-map M permit 10\nset weight 5', /route-map M \(desteklenmiyor\)/],
    ] as const) {
      const rt = createRuntime(toLabber(t))
      runScript(rt, 'r1', 'configure terminal\n' + script + '\nend')
      expect(() => toAglab(rt, t), script).toThrow(BridgeError)
      expect(() => toAglab(rt, t), script).toThrow(msg)
    }
  })
})
