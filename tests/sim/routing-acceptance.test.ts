// L4/L5-a kabul paritesi: L4'ün kabul testleri (tests/test_aglab_next_hop.py, v11, v13,
// traceroute, icmp_unreachable) içe aktarılan topolojilerde eski motoru sınar. Aynı
// topolojiler burada köprüden Labber'a verilir ve iletim sonucu (başarılı/başarısız) aynı
// beklenir. L5'e kalan parçalar (ACL) köprüde eski motor kararı alır; o
// adımlar burada kararın "legacy" olduğu doğrulanarak geçilir. Eski motorla bilerek
// ayrışan ICMP ayrıntıları ayrı blokta, gerekçesiyle (UYUMLULUK_MATRISI) sınanır.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRuntime, toLabber } from '../../src/sim-bridge/bridge'
import type { AglabDevice, AglabTopology } from '../../src/sim-bridge/aglab'
import { deliver, routeTable } from '../../src/sim/net'
import { runScript } from '../../src/sim/index'

const ROOT = join(__dirname, '..', '..')
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

function runtime(t: AglabTopology) {
  const r = toLabber(t)
  expect(r.report.expressible, JSON.stringify(r.report.reasons)).toBe(true)
  return createRuntime(r)
}
const ping = (t: AglabTopology, from: string, ip: string) => runtime(t).query().ping(from, ip)

// ---- tests/test_aglab_next_hop.py topolojisi (ortak transit LAN, üç router) ----
const iface = (ip: string) => ({ ip, mask: '255.255.255.0', enabled: true })
const route = (network: string, nextHop: string, distance = 1, mask = '255.255.255.0') => ({ network, mask, nextHop, distance })
const node = (id: string, type: string, interfaces: Record<string, Record<string, unknown>>, extra: Record<string, unknown> = {}): AglabDevice => ({
  id, name: id, type, x: 100, y: 100, w: 108, h: 72, enabled: true, ports: Object.keys(interfaces), interfaces, ip: '', mask: '', gateway: '', ...extra,
})
function nextHopBase(): AglabTopology {
  const a = node('d1', 'PC', { eth0: { enabled: true } }, { vlan: 77, ip: '192.168.1.2', mask: '255.255.255.0', gateway: '192.168.1.1' })
  const b = node('d2', 'PC', { eth0: { enabled: true } }, { vlan: 77, ip: '192.168.2.2', mask: '255.255.255.0', gateway: '192.168.2.1' })
  const r1 = node('d3', 'Router', { 'g0/0': iface('192.168.1.1'), 'g0/1': iface('10.0.0.1') }, { staticRoutes: [route('192.168.2.0', '10.0.0.3')] })
  const r2 = node('d4', 'Router', { 'g0/0': iface('10.0.0.2'), 'g0/1': iface('192.168.2.1') }, { staticRoutes: [route('192.168.1.0', '10.0.0.1')] })
  const r3 = node('d5', 'Router', { 'g0/0': iface('10.0.0.3') }, { staticRoutes: [] })
  const sw = node('d6', 'Switch', Object.fromEntries([1, 2, 3].map((i) => [`fa0/${i}`, { mode: 'access', vlan: 77, allowed: [77], enabled: true }])), { vlans: [1, 77] })
  const link = (x: string, px: string, y: string, py: string) => ({ a: x, portA: px, b: y, portB: py, up: true })
  return {
    app: 'AgLab', version: 23, nextId: 7,
    devices: [a, b, r1, r2, r3, sw],
    links: [link('d1', 'eth0', 'd3', 'g0/0'), link('d3', 'g0/1', 'd6', 'fa0/1'), link('d4', 'g0/0', 'd6', 'fa0/2'), link('d5', 'g0/0', 'd6', 'fa0/3'), link('d4', 'g0/1', 'd2', 'eth0')],
  }
}
const dev = (t: AglabTopology, id: string) => t.devices.find((d) => d.id === id)!

describe('kabul paritesi: test_aglab_next_hop.py (Labber)', () => {
  const ok = (t: AglabTopology, from = 'd1', ip = '192.168.2.2') => ping(t, from, ip).ok

  it('seçili ölü next-hop reddedilir; geçerli yol ve aynı LAN\'da saç tokası izlenir', () => {
    const base = nextHopBase()
    expect([ok(base), ok(base, 'd3')]).toEqual([false, false])
    const good = clone(base)
    dev(good, 'd3').staticRoutes = [route('192.168.2.0', '10.0.0.2')]
    expect(ok(good)).toBe(true)
    const hairpin = clone(base)
    dev(hairpin, 'd5').staticRoutes = [route('192.168.2.0', '10.0.0.2')]
    expect(ok(hairpin)).toBe(true)
    // R1 → R3 → R2: iki router atlaması
    expect(deliver(runtime(hairpin).derived, 'd1', '192.168.2.2').hops.map((h) => h.dev)).toEqual(['d3', 'd5', 'd4', 'd2'])
  })

  it('asimetrik dönüş yolu ve özyinelemeli next-hop gerçek komşuya gider', () => {
    const good = nextHopBase()
    dev(good, 'd3').staticRoutes = [route('192.168.2.0', '10.0.0.2')]
    const reverse = clone(good)
    dev(reverse, 'd4').staticRoutes = [route('192.168.1.0', '10.0.0.3')]
    expect(ok(reverse)).toBe(false)
    dev(reverse, 'd5').staticRoutes = [route('192.168.1.0', '10.0.0.1')]
    expect(ok(reverse)).toBe(true)
    // L5-c: yalnız dönüş yolundaki R3'te ACL asimetrik yanıtı keser (Labber'da)
    const acl = clone(reverse)
    dev(acl, 'd5').acls = [{ id: 101, action: 'deny', protocol: 'icmp', srcType: 'any', src: '', dstType: 'any', dst: '' }]
    ;(dev(acl, 'd5').interfaces!['g0/0'] as Record<string, unknown>)['aclIn'] = '101'
    expect(ok(acl)).toBe(false)
    delete (dev(acl, 'd5').interfaces!['g0/0'] as Record<string, unknown>)['aclIn']
    expect(ok(acl)).toBe(true)
    for (const [hop, expected] of [['10.0.0.3', false], ['10.0.0.2', true]] as const) {
      const recursive = nextHopBase()
      dev(recursive, 'd3').staticRoutes = [route('192.168.2.0', '203.0.113.9'), route('203.0.113.9', hop, 1, '255.255.255.255')]
      expect(ok(recursive), hop).toBe(expected)
    }
  })

  it('AD, en uzun önek, sessiz geri dönüş yok ve yönlendirme döngüsü sonlanır', () => {
    const preferred = nextHopBase()
    dev(preferred, 'd3').staticRoutes = [route('192.168.2.0', '10.0.0.3', 1), route('192.168.2.0', '10.0.0.2', 10)]
    expect(ok(preferred)).toBe(false)
    dev(preferred, 'd3').staticRoutes!.shift()
    expect(ok(preferred)).toBe(true)
    const lpm = nextHopBase()
    dev(lpm, 'd3').staticRoutes = [route('0.0.0.0', '10.0.0.2', 1, '0.0.0.0'), route('192.168.2.0', '10.0.0.3')]
    expect(ok(lpm)).toBe(false)
    dev(lpm, 'd3').staticRoutes!.pop()
    expect(ok(lpm)).toBe(true)
    const loop = nextHopBase()
    dev(loop, 'd5').staticRoutes = [route('192.168.2.0', '10.0.0.1')]
    expect(ok(loop)).toBe(false)
  })

  it('kaynak ağ geçidi; router kaynaklı ping çıkış arayüzünün adresini kullanır', () => {
    const good = nextHopBase()
    dev(good, 'd3').staticRoutes = [route('192.168.2.0', '10.0.0.2')]
    const gateway = clone(good)
    dev(gateway, 'd1').gateway = ''
    expect([ok(gateway, 'd1', '10.0.0.2'), ok(gateway, 'd1', '192.168.1.1')]).toEqual([false, true])
    dev(gateway, 'd1').gateway = '10.0.0.2'
    expect(ok(gateway, 'd1', '10.0.0.2')).toBe(false)
    // L5-a: alt arayüz numarası 802.1Q VLAN'ı ya da fiziksel giriş portu değildir
    // (test_aglab_next_hop.py "arbitrary dot1Q subinterface IDs" adımı, Labber'da)
    const tagged = clone(good)
    for (const [id, physical, logical, ip] of [['d3', 'g0/1', 'g0/1.5000', '10.0.0.1'], ['d4', 'g0/0', 'g0/0.9000', '10.0.0.2'], ['d5', 'g0/0', 'g0/0.12345', '10.0.0.3']] as const) {
      ;(dev(tagged, id).interfaces![physical] as Record<string, unknown>)['ip'] = ''
      dev(tagged, id).interfaces![logical] = { ip, mask: '255.255.255.0', enabled: true, parent: physical, encapsulation: 'dot1q', vlan: 77 }
    }
    for (const i of Object.values(dev(tagged, 'd6').interfaces!)) Object.assign(i, { mode: 'trunk', nativeVlan: 1 })
    expect(ok(tagged)).toBe(true)
    dev(tagged, 'd3').staticRoutes = [route('192.168.2.0', '10.0.0.3')]
    expect(ok(tagged)).toBe(false)
    // CLI'de rota düzeltilince akış geri gelir
    const rt = runtime(tagged)
    runScript(rt, 'd3', 'configure terminal\nno ip route 192.168.2.0 255.255.255.0 10.0.0.3\nip route 192.168.2.0 255.255.255.0 10.0.0.2\nend')
    expect(rt.query().ping('d1', '192.168.2.2').ok).toBe(true)
    const origin = clone(good)
    dev(origin, 'd4').staticRoutes = []
    expect([ok(origin, 'd3'), ok(origin)]).toEqual([true, false])
  })

  it('yönetim SVI\'ı ağ geçidi olarak R3\'ü kullanır (asimetrik)', () => {
    const svi = nextHopBase()
    dev(svi, 'd3').staticRoutes = [route('192.168.2.0', '10.0.0.2')]
    dev(svi, 'd6').interfaces!['vlan77'] = { ip: '10.0.0.6', mask: '255.255.255.0', enabled: true, vlan: 77 }
    dev(svi, 'd6').gateway = '10.0.0.3'
    dev(svi, 'd5').staticRoutes = [route('192.168.2.0', '10.0.0.2')]
    expect([ok(svi, 'd2', '10.0.0.6'), ok(svi, 'd6')]).toEqual([true, true])
  })
})

// ---- static-routing-two-routers.aglab.json (v11, v13, traceroute, icmp_*) ----
const sample = (): AglabTopology => JSON.parse(readFileSync(join(ROOT, 'static-routing-two-routers.aglab.json'), 'utf8'))

describe('kabul paritesi: iki router örneği (v11, v13, traceroute, icmp)', () => {
  it('v11: kopan bağlantının bağlı rotası tablodan çıkar', () => {
    const t = sample()
    const connected = (x: AglabTopology) => routeTable(runtime(x).derived, 'd1').filter((e) => e.code === 'C').map((e) => `${e.net}/${e.prefix}`)
    expect(connected(t)).toContain('192.168.1.0/24')
    const broken = clone(t)
    broken.links.find((l) => (l.a === 'd1' && l.portA === 'g0/0') || (l.b === 'd1' && l.portB === 'g0/0'))!.up = false
    expect(connected(broken)).not.toContain('192.168.1.0/24')
  })

  it('v13: router kaynaklı geçerli rota, eksik ileri rota, eksik dönüş rotası', () => {
    const t = sample()
    expect(ping(t, 'd1', '192.168.2.2').ok).toBe(true)
    const noRoute = clone(t)
    dev(noRoute, 'd1').staticRoutes = []
    expect(ping(noRoute, 'd1', '192.168.2.2')).toMatchObject({ ok: false, reason: 'noroute' })
    const noReturn = clone(t)
    dev(noReturn, 'd2').staticRoutes = []
    expect(ping(noReturn, 'd3', '10.0.0.2')).toMatchObject({ ok: false, reason: 'timeout' })
  })

  it('traceroute: yanıt veren atlamalar sırayla; hedef son atlama', () => {
    const rt = runtime(sample())
    const hops = deliver(rt.derived, 'd3', '192.168.2.2')
    expect(hops.kind).toBe('ok')
    expect(hops.hops.map((h) => h.ip)).toEqual(['192.168.1.1', '10.0.0.2', '192.168.2.2'])
    expect(deliver(rt.derived, 'd3', '192.168.1.3').hops.map((h) => h.ip)).toEqual(['192.168.1.3'])
  })

  it('icmp: rota yoksa ilk router "unreachable" döner (ping U, traceroute !H)', () => {
    const missing = sample()
    dev(missing, 'd1').staticRoutes = []
    const r = ping(missing, 'd3', '192.168.2.2')
    expect(r).toMatchObject({ ok: false, reason: 'unreach', unreachFrom: '192.168.1.1' })
  })
})

describe('bilinen farklar (UYUMLULUK_MATRISI, L4)', () => {
  it('olmayan host: son router ARP\'yi çözemez, ICMP Host Unreachable döner (IOS; eski motorla aynı)', () => {
    // I-1 motor bulgusu: Labber önceden paketi sessizce düşürüyordu (zaman aşımı). IOS bağlı ağda
    // ARP çözülemeyince kaynağa host unreachable (kod 1) gönderir (test_aglab_icmp_unreachable.py).
    expect(ping(sample(), 'd3', '192.168.2.99')).toMatchObject({ ok: false, reason: 'unreach', unreachFrom: '10.0.0.2' })
  })
})
