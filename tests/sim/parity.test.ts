// L1 oracle paritesi (Node): Labber motoru ile src/engine oracle'ı.
//
// - VLAN'ın bir switch–switch bağlantısından geçmesi (trunk/access taşıma):
//     oracle stpLinkEligible  ⇄  Labber egress() iki uçta ve VLAN iki uçta var
// - STP: her switch'in bileşen kökü ve bloklanan bağlantılar
//     oracle stpTreeInfo/stpIsBlocked  ⇄  Labber derived.stp
// - Bağlantı durumu (L2: kopuk kablo, kapalı cihaz, kapalı port/NIC):
//     oracle topology.linkUp  ⇄  Labber derived.phys[].up (switch ucu) / LabQuery.linkUp (PC)
// - Statik rota (L4: sentetik router zincirleri köprüden gerçek Router olarak; AD ve
//   özyinelemeli next-hop dahil): oracle routeLookup  ⇄  Labber deliver() ilk atlaması
// - tests/node/test_engine_routing.cjs senaryoları birebir (LPM, AD, özyineleme, döngü,
//   kısa önek geri dönüşü, kopan bağlantı, eski `route` alanı)
//
// Farklar SESSİZCE eşitlenmez: fark türleri sayılır, örnekleriyle sim-parity-node.json'a
// yazılır ve KNOWN_DIFFS ile karşılaştırılır. Yeni bir fark türü testi düşürür; bilinen
// farkların kararı kullanıcıya bırakılmıştır (PR açıklaması).
import { describe, expect, it } from 'vitest'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { createRuntime, toLabber } from '../../src/sim-bridge/bridge'
import type { AglabTopology } from '../../src/sim-bridge/aglab'
import { crossVlan, egress, vlanExists } from '../../src/sim/engine'
import { deliver, pcNode, routeOut, routeTable } from '../../src/sim/net'
import { aclDecide } from '../../src/sim/acl'
import { randomTopology, withHardwareFaults } from './bridge.test'
import { LabQuery } from '../../src/sim/query'

const require_ = createRequire(import.meta.url)
const ROOT = join(__dirname, '..', '..')
const stp = require_(join(ROOT, 'src/engine/stp.js'))
const routing = require_(join(ROOT, 'src/engine/routing.js'))
const topology = require_(join(ROOT, 'src/engine/topology.js'))

/** Bilinen ve kararı kullanıcıya bırakılan fark türleri (PR açıklamasında gerekçeli). */
const KNOWN_DIFFS = new Set([
  // Aynı VLAN'da aynı sayıda bağlantı bloklanıyor ama farklı bağlantı: oracle BFS sırası,
  // Labber gerçek STP (yol maliyeti, port kimliği).
  'stp-blocked-link-choice',
  // AğLab'da arayüz kaydı olmayan switch portu trafik taşımaz ("portu bulunamadı");
  // köprü bunu Cisco varsayılanı access VLAN 1 olarak eşler.
  'vlan-carry-unconfigured-port',
  // Bir uç trunk, diğer uç access: AğLab access VLAN'ı trunk izinli listesindeyse taşır;
  // Cisco/Labber etiketli çerçeveyi access tarafında düşürür (yalnız native VLAN geçer).
  'vlan-carry-trunk-access-mismatch',
  // Native VLAN uyuşmazlığı: oracle'ın STP uygunluk kuralı native'i yok sayar; Labber
  // (ve AğLab'ın ping yolundaki linkCarriesVlan) native VLAN trafiğini geçirmez.
  'vlan-carry-native-mismatch',
])

// Gerçek içerikte bilerek öğretilen bilinen farklar: senaryo kimliği → fark türü. Senaryo
// Labber kararındadır ve arızanın kendisi bu farktır; içerik için "fark yok" kuralının tek istisnası.
// cdp-native-mismatch (Konu #12): trunk'ın iki ucunda native VLAN farklı; Labber (Cisco gibi)
// native VLAN trafiğini geçirmez, oracle'ın STP uygunluk kuralı native'i yok sayar.
// native-vlan (L7a: kodla kurulumdan tarife taşındı): aynı arıza, SW-01 gi0/1 native 10 ⇄ SW-02 native 1.
const CONTENT_INTENDED: ReadonlyMap<string, string> = new Map([
  ['cdp-native-mismatch', 'vlan-carry-native-mismatch'],
  ['native-vlan', 'vlan-carry-native-mismatch'],
])

type Diff = { kind: string; where: string; oracle: unknown; labber: unknown }
const diffs: Diff[] = []
const counts: Record<string, number> = {}
const bySource: Record<string, Record<string, number>> = { content: {}, 'content-intended': {}, synthetic: {} }
const note = (kind: string, where: string, oracle: unknown, labber: unknown) => {
  counts[kind] = (counts[kind] ?? 0) + 1
  const intended = [...CONTENT_INTENDED].some(([id, k]) => k === kind && where.startsWith(`${id} `))
  const src = /^(loop-|seed )/.test(where) ? 'synthetic' : intended ? 'content-intended' : 'content'
  bySource[src]![kind] = (bySource[src]![kind] ?? 0) + 1
  if (diffs.filter((d) => d.kind === kind).length < 5) diffs.push({ kind, where, oracle, labber })
}
let compared = { links: 0, roots: 0, blocked: 0, routes: 0, recursive: 0, floating: 0, topologies: 0, linkStates: 0, linksDown: 0 }
let skippedStp = 0
/** EtherChannel içeren, L2 karşılaştırması atlanan topolojiler (oracle kanal modellemez) */
const skippedEtherchannel: string[] = []
/** köprüden geçemeyen (legacy kararlı) rastgele router zinciri sayısı; L4'te 0 olmalı */
let adRejected = 0

function content(): [string, AglabTopology][] {
  const out: [string, AglabTopology][] = []
  for (const f of readdirSync(join(ROOT, 'academy/student')).filter((x) => x.endsWith('.json')).sort()) {
    const id = f.replace('.json', '')
    out.push([id + '/initial', JSON.parse(readFileSync(join(ROOT, 'academy/student', f), 'utf8')).initial_topology])
    out.push([id + '/target', JSON.parse(readFileSync(join(ROOT, 'academy/teacher', f), 'utf8')).target_topology])
  }
  for (const s of JSON.parse(readFileSync(join(ROOT, 'simulator/network-scenarios.json'), 'utf8')))
    if (s.topology) out.push([s.id, s.topology])
  return out
}

/** Rastgele topolojiye switch–switch döngüleri ekler (STP'yi zorlamak için). */
function loopTopology(seed: number): AglabTopology {
  const t = randomTopology(seed)
  const sws = t.devices.filter((d) => d.type === 'Switch')
  const used = new Set(t.links.flatMap((l) => [`${l.a}|${l.portA}`, `${l.b}|${l.portB}`]))
  const freePort = (d: (typeof sws)[number]) => d.ports!.find((p) => !used.has(`${d.id}|${p}`))
  for (let i = 0; i < sws.length; i++) {
    const a = sws[i]!, b = sws[(i + 1) % sws.length]!
    if (a === b) continue
    for (const d of [a, b]) {
      // döngü portları trunk ve VLAN listesinin tamamını taşır
      const p = freePort(d)
      if (p) d.interfaces![p] = { mode: 'trunk', vlan: 1, allowed: [...(d.vlans ?? [1])], nativeVlan: 1, enabled: true }
    }
    const pa = freePort(a), pb = freePort(b)
    if (pa && pb && !(pa === undefined)) {
      // freePort yukarıda trunk yaptığımız portu döndürür (henüz bağlı değil)
      t.links.push({ a: a.id, portA: pa, b: b.id, portB: pb, up: true })
      used.add(`${a.id}|${pa}`)
      used.add(`${b.id}|${pb}`)
    }
  }
  return t
}

function compareL2(name: string, t: AglabTopology) {
  const r = toLabber(t)
  if (!r.report.expressible) return
  compared.topologies++
  const rt = createRuntime(r)
  const d = rt.derived
  const topo = { devices: t.devices, links: t.links }
  const canon = (dev: string, port: string) =>
    Object.entries(r.report.portNames[dev] ?? {}).find(([, o]) => o === port)?.[0] ?? port
  // Bağlantı durumu: her bağlantının switch ucu (PC–PC bağlantısı köprüde yok)
  const q = new LabQuery(d, rt.startup)
  for (const l of t.links) {
    const sw = t.devices.find((x) => x.id === l.a)?.type === 'Switch' ? [l.a, l.portA] : [l.b, l.portB]
    if (t.devices.find((x) => x.id === sw[0])?.type !== 'Switch') continue
    const lab = q.linkUp(sw[0]!, canon(sw[0]!, sw[1]!))
    const ora = !!topology.linkUp(topo, l)
    compared.linkStates++
    if (!ora) compared.linksDown++
    if (lab !== ora) note('link-up', `${name} ${l.a}:${l.portA}-${l.b}:${l.portB}`, ora, lab)
  }
  // EtherChannel (#80): oracle Port-channel modellemez; üye kabloları ayrı bağlantı sayar (STP birini
  // bloklar, üyeye göre taşır). Labber kanalı tek mantıksal port (Po) görür. Kanallı topolojide VLAN
  // taşıma ve STP karşılaştırması anlamsızdır: atlanır ve sayılır (bağlantı durumu yukarıda karşılaştırıldı).
  if (t.devices.some((x) => Object.values(x.interfaces ?? {}).some((i) => (i as { channelGroup?: unknown }).channelGroup))) {
    skippedEtherchannel.push(name)
    return
  }
  const lport = (dev: string, port: string) => d.lportOfPhys[`${dev}|${canon(dev, port)}`]
  const macToDev = new Map(Object.values(d.stp).flatMap((bs) => Object.entries(bs).map(([dev, b]) => [b.mac, dev])))
  const vlans = new Set(t.devices.flatMap((x) => (x.type === 'Switch' ? x.vlans ?? [1] : [])).map(Number))
  const swLinks = t.links.filter(
    (l) => t.devices.find((x) => x.id === l.a)?.type === 'Switch' && t.devices.find((x) => x.id === l.b)?.type === 'Switch',
  )
  const carryDiff = new Set<number>()
  for (const v of vlans) {
    // VLAN taşıma
    for (const l of swLinks) {
      const la = lport(l.a, l.portA), lb = lport(l.b, l.portB)
      // Labber: VLAN v'deki çerçeve iki yönde de karşı tarafta yine v'ye düşüyor mu
      const lab = !!(la && lb && egress(d, la, v) && egress(d, lb, v) && crossVlan(d, la, v) === v && crossVlan(d, lb, v) === v)
      const ora = !!stp.stpLinkEligible(topo, l, v)
      compared.links++
      if (lab !== ora) {
        const ia = t.devices.find((x) => x.id === l.a)?.interfaces?.[l.portA]
        const ib = t.devices.find((x) => x.id === l.b)?.interfaces?.[l.portB]
        const kind = !ia || !ib
          ? 'vlan-carry-unconfigured-port'
          : (ia.mode ?? 'access') !== (ib.mode ?? 'access')
            ? 'vlan-carry-trunk-access-mismatch'
            : ia.mode === 'trunk' && (ia.nativeVlan ?? 1) !== (ib.nativeVlan ?? 1)
              ? 'vlan-carry-native-mismatch'
              : 'vlan-carry'
        note(kind, `${name} v${v} ${l.a}:${l.portA}(${ia?.mode ?? '-'})-${l.b}:${l.portB}(${ib?.mode ?? '-'})`, ora, lab)
        carryDiff.add(v)
      }
    }
    if (carryDiff.has(v)) {
      skippedStp++
      continue
    }
    // STP kökü (bileşen başına) ve bloklanan bağlantılar
    for (const sw of t.devices.filter((x) => x.type === 'Switch' && vlanExists(d.cfgs[x.id]!, v))) {
      const info = stp.stpTreeInfo(topo, v, sw.id)
      const b = d.stp[v]?.[sw.id]
      if (!b) continue
      compared.roots++
      const labRoot = macToDev.get(b.rootMac) ?? b.rootMac
      if ((info.root?.id ?? null) !== labRoot) note('stp-root', `${name} v${v} ${sw.id}`, info.root?.id ?? null, labRoot)
    }
    const eligible = swLinks.filter((x) => stp.stpLinkEligible(topo, x, v))
    const st = (lp: ReturnType<typeof lport>) => (lp ? d.stp[v]?.[lp.dev]?.ports[lp.name]?.state : undefined)
    const labBlocked = eligible.filter((l) => st(lport(l.a, l.portA)) === 'BLK' || st(lport(l.b, l.portB)) === 'BLK')
    const oraBlocked = eligible.filter((l) => stp.stpIsBlocked(topo, l, v))
    compared.blocked += eligible.length
    const key = (l: (typeof eligible)[number]) => `${l.a}:${l.portA}-${l.b}:${l.portB}`
    if (labBlocked.map(key).join() !== oraBlocked.map(key).join())
      note(
        labBlocked.length === oraBlocked.length ? 'stp-blocked-link-choice' : 'stp-blocked-count',
        `${name} v${v}`,
        oraBlocked.map(key),
        labBlocked.map(key),
      )
  }
}

// ---- Statik rota: R0 — R1 — … zinciri, her router'da bir LAN, rastgele statik rotalar ----
function rng(seed: number) {
  return (n: number) => {
    seed = (seed + 0x6d2b79f5) | 0
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) % n
  }
}

function compareRoutes(seed: number) {
  const r = rng(seed)
  const n = 2 + r(3)
  const routers: any[] = []
  const links: any[] = []
  for (let i = 0; i < n; i++) {
    const ifs: Record<string, any> = { 'g0/2': { ip: `10.${100 + i}.0.1`, mask: '255.255.255.0', enabled: true } }
    if (i > 0) ifs['g0/0'] = { ip: `172.16.${i}.2`, mask: '255.255.255.252', enabled: true }
    if (i < n - 1) ifs['g0/1'] = { ip: `172.16.${i + 1}.1`, mask: '255.255.255.252', enabled: true }
    routers.push({ id: `R${i}`, name: `R${i}`, type: 'Router', enabled: true, ports: ['g0/0', 'g0/1', 'g0/2'], interfaces: ifs, staticRoutes: [] })
    // LAN portuna bir PC bağla ki bağlı rota "up" olsun
    links.push({ a: `H${i}`, portA: 'eth0', b: `R${i}`, portB: 'g0/2', up: true })
    routers.push({ id: `H${i}`, name: `H${i}`, type: 'PC', enabled: true, ip: `10.${100 + i}.0.10`, mask: '255.255.255.0', gateway: `10.${100 + i}.0.1` })
    if (i > 0) links.push({ a: `R${i - 1}`, portA: 'g0/1', b: `R${i}`, portB: 'g0/0', up: true })
  }
  // statik rotalar: doğrudan next-hop, özyinelemeli next-hop, yedek (AD) rota, varsayılan
  for (let i = 0; i < n; i++) {
    const R = routers.find((x) => x.id === `R${i}`)
    const add = (network: string, mask: string, nextHop: string, distance: number) => {
      // köprü aynı ağ + next-hop ile yinelenen rotayı reddeder (IOS'ta ikincisi AD'yi değiştirir)
      if (!R.staticRoutes.some((x: any) => x.network === network && x.mask === mask && x.nextHop === nextHop))
        R.staticRoutes.push({ network, mask, nextHop, distance })
    }
    for (let k = r(4); k > 0; k--) {
      const target = r(n)
      if (target === i) continue
      const dir = target > i ? 1 : -1
      const nh = dir > 0 ? (i < n - 1 ? `172.16.${i + 1}.2` : null) : i > 0 ? `172.16.${i}.1` : null
      if (!nh) continue
      const kind = r(4)
      const net = `10.${100 + target}.0.0`
      if (kind === 0) add(net, '255.255.255.0', nh, 1)
      else if (kind === 1) add(net, '255.255.0.0', nh, 1)
      else if (kind === 2) {
        // özyinelemeli: next-hop uzak LAN'daki bir adres (önce ona rota gerekir)
        const far = dir > 0 ? Math.min(n - 1, i + 2) : Math.max(0, i - 2)
        add(`10.${100 + far}.0.0`, '255.255.255.0', nh, 1)
        add(net, '255.255.255.0', `10.${100 + far}.0.99`, 1)
      } else {
        // yedek (AD 200) rota; birincil yarı yarıya çözümlenemeyen bir next-hop'a gider
        add(net, '255.255.255.0', r(2) ? nh : `192.0.2.${1 + i}`, 1)
        const other = dir > 0 ? (i > 0 ? `172.16.${i}.1` : null) : i < n - 1 ? `172.16.${i + 1}.2` : null
        if (other) add(net, '255.255.255.0', other, 200)
      }
    }
  }
  const topo = { devices: routers, links }
  const bridged = toLabber(topo as AglabTopology)
  if (!bridged.report.expressible) {
    adRejected++
    return
  }
  const rt = createRuntime(bridged)
  for (let i = 0; i < n; i++) {
    const R = routers.find((x) => x.id === `R${i}`)
    for (let target = 0; target < n; target++) {
      if (target === i) continue
      const dst = `10.${100 + target}.0.10`
      const ora = routing.routeLookup(topo, R, dst)
      const del = deliver(rt.derived, `R${i}`, dst)
      const labIf = del.hops[0]?.outIf.name ?? null
      const oraIf = ora.ok ? CANON[ora.route.iface] : null
      compared.routes++
      if (ora.ok && ora.route.resolvedVia === 'recursive') compared.recursive++
      if (ora.ok && (ora.route.distance ?? 1) > 1) compared.floating++
      if (oraIf !== labIf) {
        const kind = ora.ok && ora.route.resolvedVia === 'recursive' ? 'route-recursive-next-hop' : 'route-other'
        note(kind, `seed ${seed} R${i} → ${dst}`, ora.ok ? `${ora.route.network}/${ora.route.prefix} ${ora.route.iface}` : ora.why, { egress: labIf, table: routeTable(rt.derived, `R${i}`).filter((e) => e.code === 'S').map((e) => `${e.net}/${e.prefix} via ${e.nh}`) })
      }
    }
  }
}

const CANON: Record<string, string> = { 'g0/0': 'GigabitEthernet0/0', 'g0/1': 'GigabitEthernet0/1', 'g0/2': 'GigabitEthernet0/2' }

/**
 * tests/node/test_engine_routing.cjs'in rota senaryoları: aynı AğLab nesneleri hem oracle'a
 * hem köprü üzerinden Labber'a verilir; seçilen çıkış arayüzü (ya da "rota yok") aynı olmalı.
 */
function oracleLab() {
  const R1: any = {
    id: 'r1', name: 'R1', type: 'Router', enabled: true, ports: ['g0/0', 'g0/1', 'g0/2'],
    interfaces: {
      'g0/0': { ip: '192.168.1.1', mask: '255.255.255.0', enabled: true },
      'g0/1': { ip: '10.0.0.1', mask: '255.255.255.252', enabled: true },
      'g0/2': { ip: '172.16.0.1', mask: '255.255.0.0', enabled: true },
    },
    staticRoutes: [],
  }
  const R2 = { id: 'r2', name: 'R2', type: 'Router', enabled: true, ports: ['g0/1'], interfaces: { 'g0/1': { ip: '10.0.0.2', mask: '255.255.255.252', enabled: true } } }
  const SW1 = { id: 's1', name: 'SW1', type: 'Switch', enabled: true, ports: ['fa0/1', 'fa0/2'] }
  const topo = { devices: [R1, R2, SW1], links: [{ a: 'r1', portA: 'g0/0', b: 's1', portB: 'fa0/1', up: true }, { a: 'r1', portA: 'g0/1', b: 'r2', portB: 'g0/1', up: true }] }
  return { R1, topo }
}

const ORACLE_CASES: { name: string; routes: any[]; route?: string; linkDown?: number; dst: string[] }[] = [
  {
    // Oracle'daki AD 0 satırı burada yok: oracle onu sessizce yok sayar, köprü reddeder
    // (motor kararı eski motor; UYUMLULUK_MATRISI "AD 0").
    name: 'LPM, AD, özyineleme, varsayılan rota',
    routes: [
      { network: '0.0.0.0', mask: '0.0.0.0', nextHop: '10.0.0.2' },
      { network: '8.8.0.0', mask: '255.255.0.0', nextHop: '10.0.0.2', distance: 1 },
      { network: '8.8.8.0', mask: '255.255.255.0', nextHop: '192.168.1.254', distance: 1 },
      { network: '9.9.9.0', mask: '255.255.255.0', nextHop: '10.0.0.2', distance: 200 },
      { network: '9.9.9.0', mask: '255.255.255.0', nextHop: '192.168.1.254', distance: 5 },
      { network: '7.7.7.0', mask: '255.255.255.0', nextHop: '8.8.1.1' },
    ],
    dst: ['8.8.8.8', '8.8.4.4', '9.9.9.9', '7.7.7.7', '6.6.6.6', '192.168.1.50', '1.1.1.1'],
  },
  {
    name: 'birbirine dayanan rotalar ve rota yok',
    routes: [
      { network: '5.5.5.0', mask: '255.255.255.0', nextHop: '4.4.4.4' },
      { network: '4.4.4.0', mask: '255.255.255.0', nextHop: '5.5.5.5' },
    ],
    dst: ['5.5.5.1', '4.4.4.1', '1.1.1.1'],
  },
  {
    name: 'uzun önek çözülemezse kısa aday',
    routes: [
      { network: '3.3.3.0', mask: '255.255.255.0', nextHop: '2.2.2.2' },
      { network: '3.3.0.0', mask: '255.255.0.0', nextHop: '10.0.0.2' },
    ],
    dst: ['3.3.3.3'],
  },
  {
    name: 'kopan bağlantının next-hop\'u kullanılamaz',
    routes: [
      { network: '3.3.3.0', mask: '255.255.255.0', nextHop: '2.2.2.2' },
      { network: '3.3.0.0', mask: '255.255.0.0', nextHop: '10.0.0.2' },
    ],
    linkDown: 1,
    dst: ['3.3.3.3', '192.168.1.9'],
  },
  { name: 'eski route alanı varsayılan rota', routes: [], route: '10.0.0.2', dst: ['4.1.1.1', '10.0.0.2'] },
]

// ---- L5-e: port security (oracle: src/engine/portsec.js; L7b'de üründen taşındı) ----
function legacyPortSecurity() {
  const { createPortSecurity } = require_(join(ROOT, 'src/engine/portsec.js'))
  const ps = createPortSecurity({ macOf: (x: { mac: string }) => x.mac })
  return (sw: unknown, port: string, mac: string) => ps.allows(sw, port, { mac }) as boolean
}

describe('oracle paritesi: port security (L5-e, src/engine/portsec.js)', () => {
  // Bilinen fark: protect modunda eski motor ihlal sayacını artırır; IOS (Labber) saymaz.
  it('ilk çerçeve kararı, err-disable ve sayaç rastgele yapılandırmalarda eski motorla aynı', () => {
    const allows = legacyPortSecurity()
    const pool = ['02:00:00:00:00:01', '02:00:00:00:00:02', '02:00:00:00:00:03', '02:00:00:00:00:04']
    let denied = 0
    let admitted = 0
    for (let seed = 1; seed <= 200; seed++) {
      const r = rng(seed)
      const max = 1 + r(3)
      const macs = pool.filter(() => r(3) === 0).slice(0, max)
      const violation = (['shutdown', 'restrict', 'protect'] as const)[r(3)]!
      const hostMac = pool[r(pool.length)]!
      const ps = { enabled: true, max, violation, macs }
      // eski motor
      const legacyIf: Record<string, unknown> = { mode: 'access', vlan: 1, enabled: true, portSecurity: JSON.parse(JSON.stringify(ps)) }
      const legacyOk = allows({ id: 'sw', interfaces: { 'fa0/1': legacyIf } }, 'fa0/1', hostMac)
      const legacyErr = legacyIf['errdisabled'] === true
      // Labber (köprü)
      const t: AglabTopology = {
        devices: [
          { id: 'pc', name: 'PC', type: 'PC', enabled: true, ip: '10.0.0.1', mask: '255.255.255.0', mac: hostMac, ports: ['eth0'] },
          { id: 'sw', name: 'SW', type: 'Switch', enabled: true, ports: ['fa0/1'], vlans: [1], interfaces: { 'fa0/1': { mode: 'access', vlan: 1, enabled: true, portSecurity: ps } } },
        ],
        links: [{ a: 'pc', portA: 'eth0', b: 'sw', portB: 'fa0/1', up: true }],
      }
      const bridged = toLabber(t)
      expect(bridged.report.expressible, `seed ${seed} ${JSON.stringify(bridged.report.reasons)}`).toBe(true)
      const rt = createRuntime(bridged)
      const labOk = pcNode(rt.derived, 'pc') !== null
      rt.hostSends('pc')
      const labErr = rt.errdis.has('sw|FastEthernet0/1')
      const labCount = rt.psViolations.get('sw|FastEthernet0/1') ?? 0
      const legacyCount = legacyOk ? 0 : violation === 'protect' ? 0 : 1
      expect([labOk, labErr, labCount], `seed ${seed} ${JSON.stringify(ps)} ${hostMac}`).toEqual([legacyOk, legacyErr, legacyCount])
      if (legacyOk) admitted++
      else denied++
    }
    expect(admitted).toBeGreaterThan(20)
    expect(denied).toBeGreaterThan(20)
  })
})

// ---- L5-c: ACL (src/engine/acl.js aclEvaluate) ----
const aclOracle = require_(join(ROOT, 'src/engine/acl.js'))

describe('oracle paritesi: ACL (L5-c, acl.js aclEvaluate)', () => {
  it('rastgele kural ve paketlerde ilk eşleşme ve örtük deny eski motorla aynı', () => {
    const ips = ['10.0.0.5', '10.0.0.9', '10.0.1.9', '192.168.1.10', '192.168.1.200', '8.8.8.8']
    let permits = 0
    let denies = 0
    for (let seed = 1; seed <= 300; seed++) {
      const r = rng(seed)
      const id = r(2) ? 110 : 'NAMED'
      const rules: Record<string, unknown>[] = []
      for (let k = 1 + r(4); k > 0; k--) {
        const proto = ['ip', 'icmp', 'tcp', 'udp'][r(4)]!
        const side = (pre: 'src' | 'dst') => {
          const t = ['any', 'host', 'network'][r(3)]!
          if (t === 'any') return { [pre + 'Type']: 'any', [pre]: '' }
          if (t === 'host') return { [pre + 'Type']: 'host', [pre]: ips[r(ips.length)] }
          const [net, w] = [['10.0.0.0', '0.0.0.255'], ['10.0.0.0', '0.0.255.255'], ['192.168.1.0', '0.0.0.127'], ['0.0.0.0', '255.255.255.255']][r(4)]!
          return { [pre + 'Type']: 'network', [pre]: net, [pre === 'src' ? 'wildcard' : 'dstWildcard']: w }
        }
        rules.push({ id, action: r(2) ? 'permit' : 'deny', protocol: proto, ...side('src'), ...side('dst'), ...((proto === 'tcp' || proto === 'udp') && r(2) ? { port: [23, 80, 443][r(3)] } : {}) })
      }
      const t: AglabTopology = { devices: [{ id: 'r', name: 'R', type: 'Router', enabled: true, ports: ['g0/0'], interfaces: {}, acls: rules }], links: [] }
      const bridged = toLabber(t)
      expect(bridged.report.expressible, `seed ${seed} ${JSON.stringify(bridged.report.reasons)}`).toBe(true)
      const list = bridged.running['r']!.acls![String(id)]
      for (let p = 0; p < 6; p++) {
        const proto = (['icmp', 'tcp', 'udp'] as const)[r(3)]
        const pkt = { src: ips[r(ips.length)]!, dst: ips[r(ips.length)]!, proto, ...(proto !== 'icmp' ? { dport: [23, 80, 443, 8080][r(4)] } : {}) }
        const ora = aclOracle.aclEvaluate({ acls: rules }, id, pkt.src, pkt.dst, proto, pkt.dport).action
        const lab = aclDecide(list, pkt).permit ? 'permit' : 'deny'
        expect(lab, `seed ${seed} ${JSON.stringify(pkt)} ${JSON.stringify(rules)}`).toBe(ora)
        if (ora === 'permit') permits++
        else denies++
      }
    }
    expect(permits).toBeGreaterThan(100)
    expect(denies).toBeGreaterThan(100)
  })

  it('bilinen fark: tanımsız liste — eski motor engeller, IOS (Labber) izin verir', () => {
    expect(aclOracle.aclEvaluate({ acls: [] }, 99, '10.0.0.1', '10.0.0.2', 'icmp').action).toBe('deny')
    expect(aclDecide(undefined, { src: '10.0.0.1', dst: '10.0.0.2', proto: 'icmp' }).permit).toBe(true)
  })
})

describe('oracle paritesi: dot1q alt arayüzleri (L5-a, test_engine_routing.cjs)', () => {
  const withSub = (extra: Record<string, any> = {}) => {
    const { R1, topo } = oracleLab()
    R1.interfaces['g0/0.10'] = { ip: '10.10.0.1', mask: '255.255.255.0', parent: 'g0/0', encapsulation: 'dot1q', vlan: 10, enabled: true, ...extra }
    return { R1, topo }
  }
  const both = (R1: any, topo: any, dst: string) => {
    const ora = routing.routeLookup(topo, R1, dst)
    const bridged = toLabber(topo as AglabTopology)
    expect(bridged.report.expressible, JSON.stringify(bridged.report.reasons)).toBe(true)
    const lab = routeOut(createRuntime(bridged).derived, 'r1', dst)?.ifname ?? null
    return { oracle: ora.ok ? ora.route.iface : null, labber: lab }
  }
  it('alt arayüzün bağlı ağı alt arayüzden çıkar', () => {
    const { R1, topo } = withSub()
    expect(both(R1, topo, '10.10.0.9')).toEqual({ oracle: 'g0/0.10', labber: 'GigabitEthernet0/0.10' })
  })
  it('üst arayüz kapalıysa alt arayüz de kapalı', () => {
    const { R1, topo } = withSub()
    R1.interfaces['g0/0'].enabled = false
    expect(both(R1, topo, '10.10.0.9')).toEqual({ oracle: null, labber: null })
  })
  it('alt arayüzün kendi enabled:false\'u yalnız onu kapatır', () => {
    const { R1, topo } = withSub({ enabled: false })
    expect(both(R1, topo, '10.10.0.9')).toEqual({ oracle: null, labber: null })
    expect(both(R1, topo, '192.168.1.9')).toEqual({ oracle: 'g0/0', labber: 'GigabitEthernet0/0' })
  })
  it('kablosu kopuk üst arayüzün alt arayüzü bağlı rota üretmez', () => {
    const { R1, topo } = withSub()
    topo.links[0]!.up = false
    expect(both(R1, topo, '10.10.0.9')).toEqual({ oracle: null, labber: null })
  })
  it('encapsulation olmadan IP\'li alt arayüz: oracle sessizce etkisiz sayar, köprü reddeder (IOS kabul etmez)', () => {
    const { R1, topo } = oracleLab()
    R1.interfaces['g0/0.20'] = { ip: '10.20.0.1', mask: '255.255.255.0', parent: 'g0/0' }
    expect(routing.routeLookup(topo, R1, '10.20.0.9').ok).toBe(false)
    expect(toLabber(topo as AglabTopology).report.expressible).toBe(false)
  })
})

describe('oracle paritesi: test_engine_routing.cjs senaryoları (L4)', () => {
  for (const c of ORACLE_CASES)
    it(c.name, () => {
      const { R1, topo } = oracleLab()
      R1.staticRoutes = c.routes
      if (c.route) R1.route = c.route
      if (c.linkDown !== undefined) topo.links[c.linkDown]!.up = false
      const bridged = toLabber(topo as AglabTopology)
      expect(bridged.report.expressible, JSON.stringify(bridged.report.reasons)).toBe(true)
      const rt = createRuntime(bridged)
      for (const dst of c.dst) {
        const ora = routing.routeLookup(topo, R1, dst)
          // oracle yalnız rota seçer (ARP'a bakmaz): Labber'ın rota seçimi (çıkış arayüzü)
        const labIf = routeOut(rt.derived, 'r1', dst)?.ifname ?? null
        expect([dst, labIf], JSON.stringify(routeTable(rt.derived, 'r1'))).toEqual([dst, ora.ok ? CANON[ora.route.iface] : null])
      }
    })
})

describe('oracle paritesi', () => {
  it('VLAN taşıma, STP ve statik rota farkları yalnızca bilinen türlerde', () => {
    for (const [name, t] of content()) compareL2(name, t)
    for (let seed = 1; seed <= 300; seed++) compareL2(`loop-${seed}`, loopTopology(seed))
    for (let seed = 1; seed <= 300; seed++) compareL2(`loop-hw-${seed}`, withHardwareFaults(loopTopology(seed), seed))
    for (let seed = 1; seed <= 300; seed++) compareRoutes(seed)
    const result = { compared, skippedStpVlans: skippedStp, skippedEtherchannel, bridgeRejectedRouteTopologies: adRejected, counts, bySource, examples: diffs, known: [...KNOWN_DIFFS] }
    const out = process.env.AGLAB_TEST_ARTIFACT_DIR
    if (out) {
      mkdirSync(out, { recursive: true })
      writeFileSync(join(out, 'sim-parity-node.json'), JSON.stringify(result, null, 2) + '\n')
    }
    console.log('SIM_PARITY ' + JSON.stringify({ compared, skippedStp, adRejected, counts }))
    // Gerçek içerikte (40 Akademi labı başlangıç/hedef + JSON senaryoları) fark yok.
    expect(bySource['content']).toEqual({})
    // Atlanan topolojilerin hepsi gerçek içerik (ec-* senaryoları); rastgele topolojide kanal yok
    expect(skippedEtherchannel.filter((n) => /^(loop-|seed )/.test(n))).toEqual([])
    expect(compared.topologies).toBeGreaterThan(300)
    expect(compared.routes).toBeGreaterThan(500)
    // L4: rastgele zincirlerin hepsi köprüden geçer; özyinelemeli ve yedek (AD) rotalar gerçekten sınanır
    expect(adRejected).toBe(0)
    expect(compared.recursive).toBeGreaterThan(50)
    expect(compared.floating).toBeGreaterThan(10)
    // bağlantı durumu hem açık hem kapalı örneklerle karşılaştırılmış olmalı
    expect(compared.linksDown).toBeGreaterThan(200)
    expect(compared.linkStates - compared.linksDown).toBeGreaterThan(1000)
    const unknown = Object.keys(counts).filter((k) => !KNOWN_DIFFS.has(k))
    expect(unknown, JSON.stringify(diffs.filter((x) => unknown.includes(x.kind)), null, 1)).toEqual([])
  })
})
