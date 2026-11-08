// L1 oracle paritesi (Node): Labber motoru ile src/engine oracle'ı.
//
// - VLAN'ın bir switch–switch bağlantısından geçmesi (trunk/access taşıma):
//     oracle stpLinkEligible  ⇄  Labber egress() iki uçta ve VLAN iki uçta var
// - STP: her switch'in bileşen kökü ve bloklanan bağlantılar
//     oracle stpTreeInfo/stpIsBlocked  ⇄  Labber derived.stp
// - Statik rota (sentetik router zincirleri; köprü Router'ı desteklemediği için test içi
//   eşdeğer kurulum): oracle routeLookup  ⇄  Labber routeTable + ilk atlama
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
import { deliver, routeTable } from '../../src/sim/net'
import { createLab, runScript } from '../../src/sim/index'
import { ports } from '../../src/sim/util'
import type { LabDef } from '../../src/sim/types'
import { randomTopology } from './bridge.test'

const require_ = createRequire(import.meta.url)
const ROOT = join(__dirname, '..', '..')
const stp = require_(join(ROOT, 'src/engine/stp.js'))
const routing = require_(join(ROOT, 'src/engine/routing.js'))

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
  // Labber statik rotası yalnız doğrudan bağlı next-hop ile kurulur (özyineleme yok).
  'route-recursive-next-hop',
  // Native VLAN uyuşmazlığı: oracle'ın STP uygunluk kuralı native'i yok sayar; Labber
  // (ve AğLab'ın ping yolundaki linkCarriesVlan) native VLAN trafiğini geçirmez.
  'vlan-carry-native-mismatch',
])

type Diff = { kind: string; where: string; oracle: unknown; labber: unknown }
const diffs: Diff[] = []
const counts: Record<string, number> = {}
const bySource: Record<string, Record<string, number>> = { content: {}, synthetic: {} }
const note = (kind: string, where: string, oracle: unknown, labber: unknown) => {
  counts[kind] = (counts[kind] ?? 0) + 1
  const src = /^(loop-|seed )/.test(where) ? 'synthetic' : 'content'
  bySource[src]![kind] = (bySource[src]![kind] ?? 0) + 1
  if (diffs.filter((d) => d.kind === kind).length < 5) diffs.push({ kind, where, oracle, labber })
}
let compared = { links: 0, roots: 0, blocked: 0, routes: 0, topologies: 0 }
let skippedStp = 0
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
  if (r.report.engineDecision !== 'labber') return
  compared.topologies++
  const rt = createRuntime(r)
  const d = rt.derived
  const topo = { devices: t.devices, links: t.links }
  const canon = (dev: string, port: string) =>
    Object.entries(r.report.portNames[dev] ?? {}).find(([, o]) => o === port)?.[0] ?? port
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
  const labDevices: LabDef['devices'] = []
  const labLinks: LabDef['links'] = []
  const initialConfig: Record<string, string> = {}
  const cmds: string[][] = []
  for (let i = 0; i < n; i++) {
    const ifs: Record<string, any> = { 'g0/2': { ip: `10.${100 + i}.0.1`, mask: '255.255.255.0', enabled: true } }
    cmds[i] = ['ip routing', 'interface gi0/2', 'no switchport', `ip address 10.${100 + i}.0.1 255.255.255.0`, 'exit']
    if (i > 0) {
      ifs['g0/0'] = { ip: `172.16.${i}.2`, mask: '255.255.255.252', enabled: true }
      cmds[i]!.push('interface gi0/0', 'no switchport', `ip address 172.16.${i}.2 255.255.255.252`, 'exit')
    }
    if (i < n - 1) {
      ifs['g0/1'] = { ip: `172.16.${i + 1}.1`, mask: '255.255.255.252', enabled: true }
      cmds[i]!.push('interface gi0/1', 'no switchport', `ip address 172.16.${i + 1}.1 255.255.255.252`, 'exit')
    }
    routers.push({ id: `R${i}`, name: `R${i}`, type: 'Router', enabled: true, interfaces: ifs, staticRoutes: [] })
    labDevices.push({ id: `R${i}`, kind: 'switch', model: 'WS-C3650-24PS', l3: true, mac: `5254.00${(i + 1).toString(16).padStart(2, '0')}.0000`, ports: ports('Gi0/0-3'), x: 0, y: 0 })
    // LAN portuna bir PC bağla ki bağlı rota "up" olsun
    labDevices.push({ id: `H${i}`, kind: 'pc', mac: `0050.0000.00${(i + 1).toString(16).padStart(2, '0')}`, x: 0, y: 0 })
    labLinks.push({ a: [`H${i}`, 'eth0'], b: [`R${i}`, 'GigabitEthernet0/2'] })
    links.push({ a: `H${i}`, portA: 'eth0', b: `R${i}`, portB: 'g0/2', up: true })
    routers.push({ id: `H${i}`, name: `H${i}`, type: 'PC', enabled: true, ip: `10.${100 + i}.0.10`, mask: '255.255.255.0' })
    if (i > 0) {
      links.push({ a: `R${i - 1}`, portA: 'g0/1', b: `R${i}`, portB: 'g0/0', up: true })
      labLinks.push({ a: [`R${i - 1}`, 'GigabitEthernet0/1'], b: [`R${i}`, 'GigabitEthernet0/0'] })
    }
  }
  // statik rotalar: doğrudan next-hop, özyinelemeli next-hop, yedek (AD) rota, varsayılan
  for (let i = 0; i < n; i++) {
    const R = routers.find((x) => x.id === `R${i}`)
    for (let k = r(4); k > 0; k--) {
      const target = r(n)
      if (target === i) continue
      const dir = target > i ? 1 : -1
      const nh = dir > 0 ? (i < n - 1 ? `172.16.${i + 1}.2` : null) : i > 0 ? `172.16.${i}.1` : null
      if (!nh) continue
      const kind = r(4)
      const net = `10.${100 + target}.0.0`
      if (kind === 0) R.staticRoutes.push({ network: net, mask: '255.255.255.0', nextHop: nh, distance: 1 })
      else if (kind === 1) R.staticRoutes.push({ network: net, mask: '255.255.0.0', nextHop: nh, distance: 1 })
      else if (kind === 2) {
        // özyinelemeli: next-hop uzak LAN'daki bir adres (önce ona rota gerekir)
        const far = dir > 0 ? Math.min(n - 1, i + 2) : Math.max(0, i - 2)
        R.staticRoutes.push({ network: `10.${100 + far}.0.0`, mask: '255.255.255.0', nextHop: nh, distance: 1 })
        R.staticRoutes.push({ network: net, mask: '255.255.255.0', nextHop: `10.${100 + far}.0.99`, distance: 1 })
      } else {
        R.staticRoutes.push({ network: net, mask: '255.255.255.0', nextHop: nh, distance: 1 })
        const other = dir > 0 ? (i > 0 ? `172.16.${i}.1` : null) : i < n - 1 ? `172.16.${i + 1}.2` : null
        if (other) R.staticRoutes.push({ network: net, mask: '255.255.255.0', nextHop: other, distance: 200 })
      }
    }
    // AD > 1 olduğu gibi verilir; Labber bu sözdizimini reddeder (AD desteği yok, L4).
    for (const s of R.staticRoutes)
      cmds[i]!.push(`ip route ${s.network} ${s.mask} ${s.nextHop}` + (s.distance > 1 ? ` ${s.distance}` : ''))
  }
  for (let i = 0; i < n; i++) initialConfig[`R${i}`] = cmds[i]!.join('\n')
  const pcs: LabDef['initialPcs'] = {}
  for (let i = 0; i < n; i++) pcs[`H${i}`] = { ip: `10.${100 + i}.0.10`, prefix: 24, gw: `10.${100 + i}.0.1` }
  const lab: LabDef = {
    id: 'parity-routes', title: '', summary: '', level: 'İleri', tags: [], brief: [], devices: labDevices, links: labLinks,
    initialConfig, initialPcs: pcs, objectives: [], solution: {}, view: { w: 1, h: 1 },
  }
  // createLab geçersiz ilk yapılandırmada istisna atar; AD satırlarını ayrıca uygula.
  const adLines: Record<string, string[]> = {}
  for (const [dev, text] of Object.entries(initialConfig)) {
    const lines = text.split('\n')
    adLines[dev] = lines.filter((l) => / \d+$/.test(l) && l.startsWith('ip route'))
    initialConfig[dev] = lines.filter((l) => !adLines[dev]!.includes(l)).join('\n')
  }
  const rt = createLab(lab)
  for (const [dev, lines] of Object.entries(adLines))
    for (const line of lines) {
      const out = runScript(rt, dev, 'configure terminal\n' + line + '\nend')
      if (out.some((l) => l.startsWith('% Invalid'))) adRejected++
    }
  const topo = { devices: routers, links }
  for (let i = 0; i < n; i++) {
    const R = routers.find((x) => x.id === `R${i}`)
    for (let target = 0; target < n; target++) {
      if (target === i) continue
      const dst = `10.${100 + target}.0.10`
      const ora = routing.routeLookup(topo, R, dst)
      const table = routeTable(rt.derived, `R${i}`)
      const del = deliver(rt.derived, `R${i}`, dst)
      const labIf = del.hops[0]?.outIf.name ?? null
      const oraIf = ora.ok ? ({ 'g0/0': 'GigabitEthernet0/0', 'g0/1': 'GigabitEthernet0/1', 'g0/2': 'GigabitEthernet0/2' } as any)[ora.route.iface] : null
      compared.routes++
      if (oraIf !== labIf) {
        const kind = ora.ok && ora.route.resolvedVia === 'recursive' ? 'route-recursive-next-hop' : 'route-other'
        note(kind, `seed ${seed} R${i} → ${dst}`, ora.ok ? `${ora.route.network}/${ora.route.prefix} ${ora.route.iface}` : ora.why, { egress: labIf, table: table.filter((e) => e.code === 'S').map((e) => `${e.net}/${e.prefix} via ${e.nh}`) })
      }
    }
  }
}

describe('oracle paritesi', () => {
  it('VLAN taşıma, STP ve statik rota farkları yalnızca bilinen türlerde', () => {
    for (const [name, t] of content()) compareL2(name, t)
    for (let seed = 1; seed <= 300; seed++) compareL2(`loop-${seed}`, loopTopology(seed))
    for (let seed = 1; seed <= 300; seed++) compareRoutes(seed)
    const result = { compared, skippedStpVlans: skippedStp, labberRejectedAdRoutes: adRejected, counts, bySource, examples: diffs, known: [...KNOWN_DIFFS] }
    const out = process.env.AGLAB_TEST_ARTIFACT_DIR
    if (out) {
      mkdirSync(out, { recursive: true })
      writeFileSync(join(out, 'sim-parity-node.json'), JSON.stringify(result, null, 2) + '\n')
    }
    console.log('SIM_PARITY ' + JSON.stringify({ compared, skippedStp, adRejected, counts }))
    // Gerçek içerikte (40 Akademi labı başlangıç/hedef + JSON senaryoları) fark yok.
    expect(bySource['content']).toEqual({})
    expect(compared.topologies).toBeGreaterThan(300)
    expect(compared.routes).toBeGreaterThan(500)
    const unknown = Object.keys(counts).filter((k) => !KNOWN_DIFFS.has(k))
    expect(unknown, JSON.stringify(diffs.filter((x) => unknown.includes(x.kind)), null, 1)).toEqual([])
  })
})
