// L1 köprü testleri: AğLab JSON ⇄ Labber (toLabber / toAglab / rapor).
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BridgeError, canonPort, createRuntime, MODEL_L2, MODEL_L3, toAglab, toLabber,
} from '../../src/sim-bridge/bridge'
import type { AglabTopology } from '../../src/sim-bridge/aglab'
import { LabQuery } from '../../src/sim/query'
import { runScript } from '../../src/sim/index'

const ROOT = join(__dirname, '..', '..')
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))

function content(): [string, AglabTopology][] {
  const out: [string, AglabTopology][] = []
  for (const f of readdirSync(join(ROOT, 'academy/student')).filter((x) => x.endsWith('.json')).sort())
    out.push([f.replace('.json', ''), JSON.parse(readFileSync(join(ROOT, 'academy/student', f), 'utf8')).initial_topology])
  for (const s of JSON.parse(readFileSync(join(ROOT, 'simulator/network-scenarios.json'), 'utf8')))
    if (s.topology) out.push([s.id, s.topology])
  return out
}

function roundTrip(t: AglabTopology): AglabTopology {
  const r = toLabber(t)
  expect(r.report.engineDecision, JSON.stringify(r.report.reasons)).toBe('labber')
  return toAglab(createRuntime(r), t)
}

// Küçük, desteklenen alt kümede bir topoloji.
function lan(): AglabTopology {
  return {
    app: 'AgLab', version: 23, nextId: 9, selected: '',
    devices: [
      { id: 'd1', name: 'PC-01', type: 'PC', x: 10, y: 20, w: 104, h: 72, mode: 'user', config: {}, enabled: true,
        ip: '192.168.10.11', mask: '255.255.255.0', gateway: '', vlan: 10, ports: ['eth0'], interfaces: { eth0: { enabled: true } } },
      { id: 'd2', name: 'PC-02', type: 'PC', x: 10, y: 20, enabled: true, ip: '192.168.10.12', mask: '255.255.255.0', gateway: '192.168.10.1',
        ports: ['eth0'], interfaces: { eth0: { enabled: true } } },
      { id: 'd3', name: 'SW1', type: 'Switch', x: 1, y: 2, enabled: true, ports: ['fa0/1', 'fa0/2', 'gi0/1'], vlans: [1, 10, 20],
        interfaces: {
          'fa0/1': { mode: 'access', vlan: 10, allowed: [1], nativeVlan: 1, enabled: true },
          'fa0/2': { mode: 'access', vlan: 10, allowed: [1], nativeVlan: 1, enabled: true },
          'gi0/1': { mode: 'trunk', vlan: 1, allowed: [10, 20], nativeVlan: 1, enabled: true },
        } },
    ],
    links: [
      { a: 'd1', portA: 'eth0', b: 'd3', portB: 'fa0/1', up: true },
      { a: 'd2', portA: 'eth0', b: 'd3', portB: 'fa0/2', up: true },
    ],
  }
}

describe('köprü: gerçek içerik', () => {
  for (const [id, t] of content()) {
    const decision = toLabber(t).report.engineDecision
    if (decision !== 'labber') continue
    it(`${id}: gidiş-dönüş birebir`, () => {
      expect(roundTrip(t)).toEqual(t)
    })
  }
})

describe('köprü: alan eşlemesi', () => {
  it('port adları kanonik hale gelir, özgün adlar raporda tutulur', () => {
    expect(canonPort('fa0/1')).toBe('FastEthernet0/1')
    expect(canonPort('g0/1')).toBe('GigabitEthernet0/1')
    expect(canonPort('gi1/0/24')).toBe('GigabitEthernet1/0/24')
    expect(canonPort('GigabitEthernet0/0')).toBe('GigabitEthernet0/0')
    for (const bad of ['se0/0/0', 'Serial0/0/0', 'Ethernet0', 'vlan10', 'Port-channel1', 'eth0', 'x'])
      expect(canonPort(bad), bad).toBeNull()
    const r = toLabber(lan())
    expect(r.report.portNames['d3']).toEqual({ 'FastEthernet0/1': 'fa0/1', 'FastEthernet0/2': 'fa0/2', 'GigabitEthernet0/1': 'gi0/1' })
    expect(r.def.links).toEqual([
      { a: ['d1', 'eth0'], b: ['d3', 'FastEthernet0/1'] },
      { a: ['d2', 'eth0'], b: ['d3', 'FastEthernet0/2'] },
    ])
  })

  it('PC adresleri ve ağ geçidi', () => {
    const r = toLabber(lan())
    expect(r.pcs['d1']).toEqual({ ip: '192.168.10.11', prefix: 24, gw: null })
    expect(r.pcs['d2']).toEqual({ ip: '192.168.10.12', prefix: 24, gw: '192.168.10.1' })
  })

  it('switch modeli: L2 → 2960, SVI\'da IP → 3650 + l3; PKT modeli korunur; needsEncap yalnız 3560', () => {
    const t = lan()
    let sw = toLabber(t).def.devices.find((d) => d.id === 'd3')!
    expect(sw).toMatchObject({ kind: 'switch', model: MODEL_L2 })
    expect('l3' in sw || 'needsEncap' in sw).toBe(false)
    t.devices[2]!.interfaces!['vlan10'] = { ip: '192.168.10.2', mask: '255.255.255.0', enabled: true, vlan: 10 }
    sw = toLabber(t).def.devices.find((d) => d.id === 'd3')!
    expect(sw).toMatchObject({ model: MODEL_L3, l3: true })
    t.devices[2]!.config = { packetTracerModel: '2960-24TT' }
    expect(toLabber(t).def.devices.find((d) => d.id === 'd3')).toMatchObject({ model: '2960-24TT' })
    t.devices[2]!.config = { packetTracerModel: '3560-24PS' }
    const r = toLabber(t)
    expect(r.def.devices.find((d) => d.id === 'd3')).toMatchObject({ model: '3560-24PS', needsEncap: true })
    expect(r.running['d3']!.ifaces['GigabitEthernet0/1']!.encapDot1q).toBe(true)
  })

  it('port listesi yoksa model şablonu kullanılır', () => {
    const t = lan()
    delete t.devices[2]!.ports
    const r = toLabber(t)
    const sw = r.def.devices.find((d) => d.id === 'd3')!
    expect(sw.kind === 'switch' && sw.ports.length).toBe(26)
    expect(r.report.engineDecision).toBe('labber')
  })

  it('trunk: AğLab\'da allowed yoksa hiçbir VLAN taşınmaz (Labber null=tümü değil, [] olur)', () => {
    const t = lan()
    delete t.devices[2]!.interfaces!['gi0/1']!.allowed
    const r = toLabber(t)
    expect(r.running['d3']!.ifaces['GigabitEthernet0/1']!.allowed).toEqual([])
    expect(toAglab(createRuntime(r), t)).toEqual(t)
  })

  it('arayüz kaydı olmayan port access VLAN 1 olur (dynamic-auto değil)', () => {
    const t = lan()
    t.devices[2]!.ports!.push('fa0/3')
    const r = toLabber(t)
    expect(r.running['d3']!.ifaces['FastEthernet0/3']).toMatchObject({ mode: 'access', accessVlan: 1 })
    expect(toAglab(createRuntime(r), t)).toEqual(t)
  })

  it('STP: AğLab önceliği sys-id-ext içermez; Labber bridgePriority VLAN kimliğini ekler', () => {
    const t = lan()
    t.devices[2]!.stpPriorities = { '10': 4096 }
    const r = toLabber(t)
    expect(r.running['d3']!.stpPriority['10']).toBe(4096)
    const rt = createRuntime(r)
    expect(new LabQuery(rt.derived, rt.startup).bridgePriority('d3', 10)).toBe(4096 + 10)
    expect(new LabQuery(rt.derived, rt.startup).bridgePriority('d3', 20)).toBe(32768 + 20)
    expect(toAglab(rt, t)).toEqual(t)
    // Global öncelik her VLAN'a uygulanır, VLAN başına değer üstün gelir.
    t.devices[2]!.stpPriority = 8192
    const r2 = toLabber(t)
    expect(r2.running['d3']!.stpPriority).toMatchObject({ '1': 8192, '10': 4096, '20': 8192 })
    expect(toAglab(createRuntime(r2), t)).toEqual(t)
  })

  it('MAC: AgLabMacAddress çözücüsü; açık PC MAC\'i korunur, switch tabanları 0x100 aralıklı', () => {
    const t = lan()
    t.devices[0]!.mac = '00:d0:58:e2:24:08'
    t.devices.push({ id: 'd4', name: 'SW2', type: 'Switch', ports: ['fa0/1'], vlans: [1], interfaces: {} })
    const r = toLabber(t)
    expect(r.def.devices.find((d) => d.id === 'd1')!.mac).toBe('00d0.58e2.2408')
    const macs = r.def.devices.filter((d) => d.kind === 'switch').map((d) => BigInt('0x' + d.mac.replace(/\./g, '')))
    expect(macs.every((m) => (m & 0xffn) === 0n)).toBe(true)
    expect(new Set(macs).size).toBe(macs.length)
  })

  it('opak alanlar (sourceArchive, config.runningConfig, arayüz durumu) olduğu gibi geri yazılır', () => {
    const t = lan() as AglabTopology & Record<string, unknown>
    t.sourceArchive = { originalPacketBase64: 'AAAA', decodedXmlSha256: 'x' }
    t.importReport = { sourceDeviceCount: 3 }
    t.devices[2]!.config = { packetTracerModel: '2960-24TT', runningConfig: ['hostname SW1', 'interface fa0/1'] }
    expect(roundTrip(t)).toEqual(t)
  })

  it('CLI değişikliği AğLab JSON\'a yansır', () => {
    const t = lan()
    const r = toLabber(t)
    const rt = createRuntime(r)
    const out = runScript(rt, 'd3', 'configure terminal\ninterface fa0/2\nswitchport access vlan 20\nexit\nvlan 30\nname MISAFIR\nend')
    expect(out.filter((l) => /^% /.test(l))).toEqual([])
    const back = toAglab(rt, t)
    expect(back.devices[2]!.interfaces!['fa0/2']!.vlan).toBe(20)
    expect(back.devices[2]!.vlans).toEqual([1, 10, 20, 30])
    expect(back.devices[2]!.vlanNames).toEqual({ '30': 'MISAFIR' })
  })

  it('AğLab\'da ifade edilemeyen Labber durumu açık hata verir (sessiz kayıp yok)', () => {
    const t = lan()
    for (const script of [
      'interface fa0/2\nswitchport mode dynamic desirable',
      'interface gi0/1\nswitchport trunk allowed vlan all',
      'spanning-tree mode rapid-pvst',
      'interface fa0/1\nspanning-tree portfast',
      'interface fa0/1\ndescription muhasebe',
      'interface gi0/1\nswitchport nonegotiate',
    ]) {
      const rt = createRuntime(toLabber(t))
      runScript(rt, 'd3', 'configure terminal\n' + script + '\nend')
      expect(() => toAglab(rt, t), script).toThrow(BridgeError)
    }
  })
})

describe('köprü: fiziksel durum (L2)', () => {
  // PC-01 (d1), PC-02 (d2) aynı VLAN'da SW1'e (d3) bağlı.
  const ping = (t: AglabTopology | ReturnType<typeof createRuntime>) => {
    const rt = 'derived' in t ? t : createRuntime(toLabber(t))
    return new LabQuery(rt.derived, rt.startup).ping('d1', '192.168.10.12').ok
  }

  it('up:false, enabled:false ve kapalı PC NIC Labber durumuna eşlenir; motor labber', () => {
    expect(ping(lan())).toBe(true)
    const cases: [string, (t: AglabTopology) => void, (r: ReturnType<typeof toLabber>) => unknown, unknown][] = [
      ['kopuk kablo', (t) => (t.links[1]!.up = false), (r) => r.def.links[1], { a: ['d2', 'eth0'], b: ['d3', 'FastEthernet0/2'], up: false }],
      ['kapalı PC', (t) => (t.devices[1]!.enabled = false), (r) => r.def.devices[1]!.off, true],
      ['kapalı switch', (t) => (t.devices[2]!.enabled = false), (r) => r.def.devices[2]!.off, true],
      ['kapalı PC NIC', (t) => (t.devices[1]!.interfaces!['eth0']!.enabled = false), (r) => (r.def.devices[1] as { nicDown?: boolean }).nicDown, true],
    ]
    for (const [name, mutate, pick, want] of cases) {
      const t = lan()
      mutate(t)
      const r = toLabber(t)
      expect(r.report.engineDecision, name + ': ' + r.report.reasons.join('; ')).toBe('labber')
      expect(r.report.unsupported, name).toEqual([])
      expect(pick(r), name).toEqual(want)
      expect(ping(t), name + ': ping başarısız olmalı').toBe(false)
      expect(roundTrip(t), name + ': gidiş-dönüş').toEqual(t)
    }
  })

  it('eksik up / enabled alanı açık sayılır ve geri yazılmaz (karar: yalnız açık false kapalıdır)', () => {
    const t = lan()
    delete t.links[1]!.up
    delete t.devices[1]!.enabled
    delete t.devices[2]!.enabled
    const r = toLabber(t)
    expect(r.def.links[1]).toEqual({ a: ['d2', 'eth0'], b: ['d3', 'FastEthernet0/2'] })
    expect(r.def.devices.map((d) => d.off)).toEqual([undefined, undefined, undefined])
    expect(ping(t)).toBe(true)
    expect(roundTrip(t)).toEqual(t)
  })

  it('çalışırken değişen kablo/güç/NIC durumu AğLab JSON\'una geri yazılır', () => {
    const t = lan()
    const rt = createRuntime(toLabber(t))
    rt.setLink('d3', 'FastEthernet0/2', false)
    rt.setPower('d1', false)
    rt.setNic('d2', false)
    expect(ping(rt)).toBe(false)
    const back = toAglab(rt, t)
    expect(back.links.map((l) => l.up)).toEqual([true, false])
    expect(back.devices.map((d) => d.enabled)).toEqual([false, true, true])
    expect(back.devices[1]!.interfaces!['eth0']).toEqual({ enabled: false })
    // geri yazılan JSON yeniden yüklenince aynı durum
    const again = createRuntime(toLabber(back))
    expect([...again.hw.cut].sort()).toEqual([...rt.hw.cut].sort())
    expect([...again.hw.off]).toEqual(['d1'])
    expect([...again.hw.nicDown]).toEqual(['d2'])
    // geri alınınca özgün JSON birebir
    rt.setLink('d2', 'eth0', true)
    rt.setPower('d1', true)
    rt.setNic('d2', true)
    expect(ping(rt)).toBe(true)
    expect(toAglab(rt, t)).toEqual(t)
  })

  it('özgünde alan yoksa kapalı durum yine yazılır, açık durum eklenmez', () => {
    const t = lan()
    delete t.links[0]!.up
    delete t.devices[0]!.enabled
    delete t.devices[0]!.interfaces
    const rt = createRuntime(toLabber(t))
    expect(toAglab(rt, t)).toEqual(t)
    rt.setLink('d1', 'eth0', false)
    rt.setNic('d1', false)
    rt.setPower('d1', false)
    const back = toAglab(rt, t)
    expect(back.links[0]!.up).toBe(false)
    expect(back.devices[0]!.enabled).toBe(false)
    expect(back.devices[0]!.interfaces).toEqual({ eth0: { enabled: false } })
  })
})

describe('köprü: desteklenmeyen ve reddedilen', () => {
  const cases: [string, (t: AglabTopology) => void, RegExp][] = [
    ['Router', (t) => t.devices.push({ id: 'r1', name: 'R1', type: 'Router', ports: ['g0/0'], interfaces: {} }), /Router cihaz tipi/],
    ['Server', (t) => t.devices.push({ id: 's1', name: 'S1', type: 'Server', ports: ['eth0'] }), /Server cihaz tipi/],
    ['statik rota AD', (t) => (t.devices[2]!.staticRoutes = [{ network: '0.0.0.0', mask: '0.0.0.0', nextHop: '1.1.1.1', distance: 5 }]), /Statik rota/],
    ['alt arayüz', (t) => (t.devices[2]!.interfaces!['gi0/1']!.encapsulation = 'dot1q'), /Alt arayüz/],
    ['DHCP relay', (t) => (t.devices[2]!.interfaces!['gi0/1']!.helperAddress = '10.0.0.1'), /DHCP relay/],
    ['DHCP sunucu', (t) => (t.devices[0]!.services = { dhcp: true }), /servisleri/],
    ['ACL', (t) => (t.devices[2]!.acls = []), /ACL/],
    ['NAT', (t) => (t.devices[2]!.natOverload = { aclId: 1, outsideInterface: 'gi0/1' }), /NAT/],
    ['port security', (t) => (t.devices[2]!.interfaces!['fa0/1']!.portSecurity = { enabled: true }), /Port security/],
    ['BGP', (t) => (t.devices[2]!.bgp = { asn: 65001 }), /BGP/],
    ['routed switch portu', (t) => (t.devices[2]!.interfaces!['gi0/1']!.ip = '10.0.0.1'), /routed port/],
    ['tanınmayan alan', (t) => (t.devices[2]!.foo = 1), /karşılığı olmayan/],
  ]
  for (const [name, mutate, reason] of cases)
    it(`${name} → unsupported, motor legacy`, () => {
      const t = lan()
      mutate(t)
      const r = toLabber(t)
      expect(r.report.engineDecision).toBe('legacy')
      expect(r.report.unsupported.map((u) => u.reason).join('\n')).toMatch(reason)
      expect(r.report.reasons.join('\n')).toMatch(reason)
    })

  const rejects: [string, (t: AglabTopology) => void, RegExp][] = [
    ['bilinmeyen port adı', (t) => t.devices[2]!.ports!.push('se0/0/0'), /Eşlenemeyen port adı/],
    ['listede olmayan arayüz', (t) => (t.devices[2]!.interfaces!['fa0/9'] = { mode: 'access', vlan: 1 }), /port listesinde yok/],
    ['bağlantı portu yok', (t) => (t.links[0]!.portB = 'fa0/7'), /cihazda yok/],
    ['bilinmeyen cihaza bağlantı', (t) => t.links.push({ a: 'd1', portA: 'eth0', b: 'd99', portB: 'fa0/1', up: true }), /bilinmeyen cihaz/],
    ['aynı port iki bağlantıda', (t) => t.links.push({ a: 'd2', portA: 'eth0', b: 'd3', portB: 'fa0/1', up: true }), /birden çok/],
    ['geçersiz VLAN', (t) => t.devices[2]!.vlans!.push(5000), /Geçersiz VLAN/],
    ['geçersiz STP önceliği', (t) => (t.devices[2]!.stpPriorities = { '10': 5000 }), /4096/],
    ['geçersiz PC maskesi', (t) => (t.devices[0]!.mask = '255.0.255.0'), /maske/],
    ['geçersiz PC MAC', (t) => (t.devices[0]!.mac = '01:00:5e:00:00:01'), /MAC/],
    ['bilinmeyen port modu', (t) => (t.devices[2]!.interfaces!['fa0/1']!.mode = 'dynamic'), /port modu/],
  ]
  for (const [name, mutate, reason] of rejects)
    it(`${name} → rejected, motor legacy`, () => {
      const t = lan()
      mutate(t)
      const r = toLabber(t)
      expect(r.report.engineDecision).toBe('legacy')
      expect(r.report.rejected.map((x) => x.reason).join('\n')).toMatch(reason)
    })
})

// ---- 200 rastgele topoloji (seed'li) ----
function rng(seed: number) {
  return (n: number) => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) % n
  }
}

export function randomTopology(seed: number): AglabTopology {
  const r = rng(seed)
  const pick = <T>(a: T[]): T => a[r(a.length)]!
  const devices: AglabTopology['devices'] = []
  const links: AglabTopology['links'] = []
  const swCount = 1 + r(4)
  const free: [string, string][] = []
  for (let s = 0; s < swCount; s++) {
    const id = `d${s + 1}`
    const style = pick(['short', 'long', 'g'])
    const name = (n: string, k: number) =>
      style === 'long' ? (n === 'fa' ? 'FastEthernet0/' : 'GigabitEthernet0/') + k : style === 'g' && n === 'gi' ? 'g0/' + k : `${n}0/${k}`
    const ports = [1, 2, 3, 4, 5, 6].map((k) => name('fa', k)).concat([1, 2].map((k) => name('gi', k)))
    const vlans = [1, ...[10, 20, 30, 99].filter(() => r(2))]
    const interfaces: Record<string, any> = {}
    for (const p of ports) {
      if (!r(4)) continue
      const trunk = !r(3)
      const iface: any = { mode: trunk ? 'trunk' : 'access', vlan: pick(vlans) }
      if (r(3)) iface.allowed = vlans.filter(() => r(2))
      if (r(2)) iface.nativeVlan = pick([1, ...vlans])
      if (r(2)) iface.enabled = r(5) !== 0
      interfaces[p] = iface
    }
    for (const v of vlans) if (!r(4)) interfaces['vlan' + v] = { ip: `10.${v}.0.${s + 1}`, mask: '255.255.255.0', enabled: r(5) !== 0, vlan: v }
    const dev: any = { id, name: `SW${s + 1}`, type: 'Switch', x: r(800), y: r(500), w: 112, h: 72, enabled: true, mode: 'user', config: {}, ports, vlans, interfaces }
    if (r(3)) dev.vlanNames = Object.fromEntries(vlans.filter((v) => v !== 1 && r(2)).map((v) => [String(v), 'V' + v]))
    if (r(3)) dev.stpPriorities = Object.fromEntries(vlans.filter(() => r(2)).map((v) => [String(v), 4096 * r(16)]))
    if (!r(4)) dev.stpPriority = 4096 * r(16)
    if (r(3)) dev.gateway = r(2) ? '' : `10.1.0.254`
    devices.push(dev)
    for (const p of ports) free.push([id, p])
  }
  // switch–switch bağlantıları
  const take = (dev?: string) => {
    const i = free.findIndex(([d]) => (dev ? d === dev : true))
    return i < 0 ? null : free.splice(i, 1)[0]!
  }
  for (let s = 1; s < swCount; s++) {
    const a = take(`d${s}`), b = take(`d${s + 1}`)
    if (a && b) links.push({ a: a[0], portA: a[1], b: b[0], portB: b[1], up: true })
  }
  const pcCount = r(6)
  for (let p = 0; p < pcCount; p++) {
    const id = `d${swCount + p + 1}`
    const pc: any = { id, name: `PC-${p + 1}`, type: 'PC', x: r(800), y: r(500), enabled: true, ports: ['eth0'], interfaces: { eth0: { enabled: true } } }
    if (r(5)) {
      pc.ip = `10.${pick([10, 20])}.0.${10 + p}`
      pc.mask = pick(['255.255.255.0', '255.255.0.0'])
    } else pc.ip = ''
    if (r(2)) pc.gateway = r(2) ? '' : '10.10.0.1'
    if (r(3)) pc.vlan = pick([1, 10, 20])
    if (!r(4)) pc.mac = `02:aa:00:00:00:${(16 + p).toString(16)}`
    devices.push(pc)
    const port = free.length ? free.splice(r(free.length), 1)[0]! : null
    if (port) links.push({ a: id, portA: 'eth0', b: port[0], portB: port[1], up: true })
  }
  return { app: 'AgLab', version: 23, nextId: devices.length + 1, selected: '', devices, links }
}

/** Topolojinin kopyasında rastgele kablo kopar, cihaz kapatır, PC NIC'i kapatır. */
export function withHardwareFaults(t: AglabTopology, seed: number): AglabTopology {
  const r = rng(seed * 7919 + 13)
  const out = clone(t)
  for (const l of out.links) if (!r(4)) l.up = false
  for (const d of out.devices) {
    if (!r(6)) d.enabled = false
    if (d.type === 'PC' && !r(5)) d.interfaces = { eth0: { enabled: false } }
  }
  return out
}

describe('köprü: 200 rastgele topoloji (seed\'li)', () => {
  it('desteklenen alt kümede hepsi labber kararı alır ve gidiş-dönüş birebir', () => {
    let checked = 0
    for (let seed = 1; seed <= 200; seed++) {
      const t = randomTopology(seed)
      const r = toLabber(clone(t))
      expect(r.report.engineDecision, `seed ${seed}: ${r.report.reasons.join('; ')}`).toBe('labber')
      expect(toAglab(createRuntime(r), t), `seed ${seed}`).toEqual(t)
      // aynı topoloji fiziksel arızalarla (kopuk kablo, kapalı cihaz, kapalı NIC)
      const h = withHardwareFaults(t, seed)
      const rh = toLabber(clone(h))
      expect(rh.report.engineDecision, `seed ${seed} hw: ${rh.report.reasons.join('; ')}`).toBe('labber')
      expect(toAglab(createRuntime(rh), h), `seed ${seed} hw`).toEqual(h)
      checked++
    }
    expect(checked).toBe(200)
  })
})
