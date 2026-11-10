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

function router(interfaces: Record<string, Record<string, unknown>>, id = 'r1'): AglabTopology['devices'][number] {
  return { id, name: id.toUpperCase(), type: 'Router', x: 0, y: 0, enabled: true, ip: '', mask: '', gateway: '', route: '', ports: ['g0/0', 'g0/1', 'g0/2'], interfaces, staticRoutes: [] }
}

/** PC1 — R1 — R2 — SRV (servissiz sunucu); AğLab Akademi M4 biçiminde. */
function routed(): AglabTopology {
  const r1 = router({ 'g0/0': { enabled: true, ip: '192.168.10.1', mask: '255.255.255.0' }, 'g0/1': { enabled: true, ip: '10.0.12.1', mask: '255.255.255.252' }, 'g0/2': { enabled: true } }, 'r1')
  const r2 = router({ 'g0/0': { enabled: true, ip: '192.168.20.1', mask: '255.255.255.0' }, 'g0/1': { enabled: true, ip: '10.0.12.2', mask: '255.255.255.252' } }, 'r2')
  r1.staticRoutes = [{ network: '192.168.20.0', mask: '255.255.255.0', nextHop: '10.0.12.2', distance: 1 }]
  return {
    app: 'AgLab', version: 23,
    devices: [
      { id: 'pc1', name: 'PC1', type: 'PC', x: 0, y: 0, enabled: true, ip: '192.168.10.10', mask: '255.255.255.0', gateway: '192.168.10.1', ports: ['eth0'], interfaces: { eth0: { enabled: true } } },
      r1, r2,
      { id: 'srv', name: 'SRV', type: 'Server', x: 0, y: 0, enabled: true, ip: '192.168.20.20', mask: '255.255.255.0', gateway: '192.168.20.1', ports: ['eth0'], services: {} },
    ],
    links: [
      { a: 'pc1', portA: 'eth0', b: 'r1', portB: 'g0/0', up: true },
      { a: 'r1', portA: 'g0/1', b: 'r2', portB: 'g0/1', up: true },
      { a: 'r2', portA: 'g0/0', b: 'srv', portB: 'eth0', up: true },
    ],
  }
}

describe('köprü: Router (L4)', () => {
  it('Router → router:true SwitchDef; arayüz, rota, AD eşlenir; gidiş-dönüş birebir', () => {
    const t = routed()
    t.devices[2]!.staticRoutes = [{ network: '192.168.10.0', mask: '255.255.255.0', nextHop: '10.0.12.1' }, { network: '0.0.0.0', mask: '0.0.0.0', nextHop: '10.0.12.1', distance: 250 }]
    const r = toLabber(t)
    expect(r.report.engineDecision, JSON.stringify(r.report)).toBe('labber')
    const def = r.def.devices.find((d) => d.id === 'r1')!
    expect(def).toMatchObject({ kind: 'switch', router: true, l3: true, model: 'ISR4331', ports: ['GigabitEthernet0/0', 'GigabitEthernet0/1', 'GigabitEthernet0/2'] })
    expect(r.running['r1']!.ifaces['GigabitEthernet0/1']).toMatchObject({ routed: true, shutdown: false, ip: { addr: '10.0.12.1', mask: '255.255.255.252' } })
    expect(r.running['r2']!.routes).toEqual([{ net: '192.168.10.0', mask: '255.255.255.0', nh: '10.0.12.1' }, { net: '0.0.0.0', mask: '0.0.0.0', nh: '10.0.12.1', ad: 250 }])
    expect(r.def.devices.find((d) => d.id === 'srv')!.kind).toBe('pc')
    expect(roundTrip(t)).toEqual(t)
  })

  it('başlangıçta dönüş rotası yok: ping başarısız; R2 CLI ile eklenince başarılı ve JSON\'a yazılır', () => {
    const t = routed()
    const rt = createRuntime(toLabber(t))
    const q = () => new LabQuery(rt.derived, rt.startup)
    expect(q().ping('pc1', '192.168.20.20').ok).toBe(false)
    const out = runScript(rt, 'r2', 'configure terminal\nip route 192.168.10.0 255.255.255.0 10.0.12.1\nend')
    expect(out.filter((l) => /^% /.test(l))).toEqual([])
    expect(q().ping('pc1', '192.168.20.20').ok).toBe(true)
    const back = toAglab(rt, t)
    expect(back.devices[2]!.staticRoutes).toEqual([{ network: '192.168.10.0', mask: '255.255.255.0', nextHop: '10.0.12.1', distance: 1 }])
  })

  it('arayüz IP/no shutdown ve rota silme JSON\'a yazılır; kayıtsız port eklenmez', () => {
    const t = routed()
    t.devices[1]!.interfaces = { 'g0/0': { enabled: false } }
    const rt = createRuntime(toLabber(t))
    runScript(rt, 'r1', 'configure terminal\ninterface g0/0\nip address 192.168.10.1 255.255.255.0\nno shutdown\nexit\nno ip route 192.168.20.0 255.255.255.0 10.0.12.2\nip route 192.168.20.0 255.255.255.0 10.0.12.2 5\nend')
    const back = toAglab(rt, t).devices[1]!
    expect(back.interfaces).toEqual({ 'g0/0': { enabled: true, ip: '192.168.10.1', mask: '255.255.255.0' } })
    expect(back.staticRoutes).toEqual([{ network: '192.168.20.0', mask: '255.255.255.0', nextHop: '10.0.12.2', distance: 5 }])
    runScript(rt, 'r1', 'configure terminal\ninterface g0/0\nno ip address\nshutdown\nend')
    expect(toAglab(rt, t).devices[1]!.interfaces!['g0/0']).toEqual({ enabled: false })
  })

  it('eski `route` alanı varsayılan rotadır; silinince boşalır', () => {
    const t = routed()
    t.devices[1]!.route = '10.0.12.2'
    const r = toLabber(t)
    expect(r.running['r1']!.routes.at(-1)).toEqual({ net: '0.0.0.0', mask: '0.0.0.0', nh: '10.0.12.2' })
    expect(roundTrip(t)).toEqual(t)
    const rt = createRuntime(r)
    runScript(rt, 'r1', 'configure terminal\nno ip route 0.0.0.0 0.0.0.0 10.0.12.2\nend')
    const back = toAglab(rt, t).devices[1]!
    expect([back.route, back.staticRoutes]).toEqual(['', t.devices[1]!.staticRoutes])
  })

  it('OSPF (pid, routerId, networks) eşlenir, gidiş-dönüş birebir; komşuluk area\'ya bağlı', () => {
    const t = routed()
    t.devices[1]!.staticRoutes = []
    t.devices[1]!.ospf = { pid: 1, routerId: '1.1.1.1', networks: [{ network: '10.0.12.0', wildcard: '0.0.0.3', area: 0 }, { network: '192.168.10.0', wildcard: '0.0.0.255', area: 0 }] }
    t.devices[2]!.ospf = { pid: 1, routerId: '2.2.2.2', networks: [{ network: '10.0.12.0', wildcard: '0.0.0.3', area: 1 }, { network: '192.168.20.0', wildcard: '0.0.0.255', area: 0 }] }
    expect(roundTrip(t)).toEqual(t)
    const rt = createRuntime(toLabber(t))
    const q = () => new LabQuery(rt.derived, rt.startup)
    expect(q().ping('pc1', '192.168.20.20').ok).toBe(false)
    runScript(rt, 'r2', 'configure terminal\nrouter ospf 1\nno network 10.0.12.0 0.0.0.3 area 1\nnetwork 10.0.12.0 0.0.0.3 area 0\nend')
    expect(q().ping('pc1', '192.168.20.20').ok).toBe(true)
    expect((toAglab(rt, t).devices[2]!.ospf as { networks: unknown[] }).networks).toEqual([
      { network: '192.168.20.0', wildcard: '0.0.0.255', area: 0 },
      { network: '10.0.12.0', wildcard: '0.0.0.3', area: 0 },
    ])
  })

  it('AğLab Router modelinde olmayan durum açık hata verir', () => {
    const t = routed()
    for (const script of ['interface loopback 0\nip address 1.1.1.1 255.255.255.255', 'interface g0/0\ndescription LAN', 'no ip routing', 'interface g0/0\nip ospf cost 5', 'router ospf 1\npassive-interface g0/0']) {
      const rt = createRuntime(toLabber(t))
      runScript(rt, 'r1', 'configure terminal\n' + script + '\nend')
      expect(() => toAglab(rt, t), script).toThrow(BridgeError)
    }
  })

  it('kayıtsız router portu açık sayılır (eski motor: enabled !== false)', () => {
    const t = routed()
    delete t.devices[2]!.interfaces!['g0/0']
    t.devices[2]!.interfaces!['g0/2'] = { ip: '192.168.20.1', mask: '255.255.255.0' }
    t.links[2]!.portA = 'g0/2'
    const r = toLabber(t)
    expect(r.running['r2']!.ifaces['GigabitEthernet0/0']!.shutdown).toBe(false)
    expect(roundTrip(t)).toEqual(t)
  })
})

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
    // L4: Router ve servissiz Server desteklenir (bkz. "köprü: Router (L4)"); bu türlerin
    // L5'e kalan alanları raporlanır.
    ['router alt arayüzü', (t) => t.devices.push(router({ 'g0/0.10': { ip: '10.0.10.1', mask: '255.255.255.0', encapsulation: 'dot1q', vlan: 10 } })), /Alt arayüz/],
    ['router ACL', (t) => t.devices.push(router({ 'g0/0': { ip: '10.0.0.1', mask: '255.255.255.0', aclIn: '1' } })), /ACL/],
    ['servisi açık Server', (t) => t.devices.push({ id: 's1', name: 'S1', type: 'Server', ports: ['eth0'], services: { http: true } }), /servisleri/],
    ['bilinmeyen cihaz tipi', (t) => t.devices.push({ id: 'c1', name: 'C1', type: 'Cloud', ports: [] }), /Cloud cihaz tipi/],
    ['switch\'te statik rota', (t) => (t.devices[2]!.staticRoutes = [{ network: '0.0.0.0', mask: '0.0.0.0', nextHop: '1.1.1.1', distance: 5 }]), /statik rota/],
    ['router OSPF passive', (t) => t.devices.push({ ...router({}), ospf: { pid: 1, networks: [], passive: ['g0/0'] } }), /OSPF alanı/],
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
    ['geçersiz statik rota', (t) => t.devices.push({ ...router({}), staticRoutes: [{ network: '10.0.0.0', mask: '255.0.255.0', nextHop: '1.1.1.1' }] }), /Geçersiz statik rota/],
    ['hizasız statik rota', (t) => t.devices.push({ ...router({}), staticRoutes: [{ network: '10.20.1.5', mask: '255.255.255.0', nextHop: '1.1.1.1' }] }), /hizalı değil/],
    ['statik rota AD 0', (t) => t.devices.push({ ...router({}), staticRoutes: [{ network: '10.0.0.0', mask: '255.0.0.0', nextHop: '1.1.1.1', distance: 0 }] }), /AD 1-255/],
    ['yinelenen statik rota', (t) => t.devices.push({ ...router({}), staticRoutes: [{ network: '10.0.0.0', mask: '255.0.0.0', nextHop: '1.1.1.1' }, { network: '10.0.0.0', mask: '255.0.0.0', nextHop: '1.1.1.1', distance: 9 }] }), /yinelenen/],
    ['geçersiz router arayüz maskesi', (t) => t.devices.push(router({ 'g0/0': { ip: '10.0.0.1', mask: '255.0.255.0' } })), /router arayüzü/],
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
