// L5-h: PKT içe aktarımı için IOS metin yolu.
//
// Packet Tracer dönüştürücüsü (convert_pkt_to_aglab.py) cihaz başına `config.runningConfig`
// metnini saklar. Bu yol, aynı topolojiyi iki biçimde kurar:
//   yapısal — köprü (`toLabber`) AğLab alanlarından (dönüştürücünün eşlediği alanlar)
//   CLI     — her switch/router fabrika durumundan başlar, runningConfig hoşgörülü modda
//             Labber CLI'sine uygulanır (config-text.ts); metni olmayan cihaz yapısal kalır
// Sonra dönüştürücünün modellediği alanlar karşılaştırılır (`modeledDiffs`). Fark bir
// dönüştürücü/köprü hatasıdır ve testte hata sayılır. Satır sonuçları içe aktarma raporuna
// eklenir (`importReportWithCli`): reddedilen satırlar "modellenmedi", zararsız olanlar ayrı.

import { applyConfigText, summarize, type ConfigLine } from '../sim/config-text'
import { LabRuntime } from '../sim/runtime'
import type { PhysIfConfig, SwitchConfig, SwitchDef } from '../sim/types'
import { canonIf, clone } from '../sim/util'
import type { AglabTopology } from './aglab'
import { toLabber, type BridgeResult } from './bridge'

export interface ModeledDiff {
  device: string
  field: string
  structural: unknown
  cli: unknown
}

export interface CliImport {
  /** yapısal köprü sonucu (motor kararı ve rapor bundan) */
  bridge: BridgeResult
  /** CLI yoluyla kurulmuş çalışma zamanı */
  runtime: LabRuntime
  lines: ConfigLine[]
  /** sessiz fark: dönüştürücü alanı modelledi ama CLI yolu başka sonuç verdi (hata) */
  diffs: ModeledDiff[]
  /**
   * açık fark: dönüştürücünün raporunda "modellenmedi" olan bir satırı Labber CLI'si (IOS gibi)
   * uyguladı; o arayüzün (ya da global satırda cihazın global) alanı CLI yolunda daha kapsamlı
   */
  extended: ModeledDiff[]
}

/** AğLab cihaz kimliği → runningConfig metni (yalnız switch ve router). */
function configTexts(t: AglabTopology): Record<string, string> {
  const out: Record<string, string> = {}
  for (const d of t.devices ?? []) {
    const text = (d.config as Record<string, unknown> | undefined)?.['runningConfig']
    if ((d.type === 'Switch' || d.type === 'Router') && typeof text === 'string' && text.trim()) out[String(d.id)] = text
  }
  return out
}

export function cliImport(t: AglabTopology): CliImport {
  const bridge = toLabber(t)
  const texts = configTexts(t)
  const lines: ConfigLine[] = []
  const runtime = new LabRuntime(bridge.def, (rt) => {
    for (const [id, pc] of Object.entries(bridge.pcs)) rt.pcs[id] = clone(pc)
    for (const sw of rt.topo.switches) {
      const text = texts[sw.id]
      if (text === undefined) {
        if (bridge.running[sw.id]) rt.running[sw.id] = clone(bridge.running[sw.id]!)
        continue
      }
      lines.push(...applyConfigText(rt, sw.id, text))
    }
    rt.natTable = clone(bridge.nat ?? [])
    rt.configReport = lines
  })
  const diffs: ModeledDiff[] = []
  const extended: ModeledDiff[] = []
  const converterUnmodeled = new Set(
    ((t.importReport as { unmodeledConfigLines?: { device: string; line: number }[] } | undefined)?.unmodeledConfigLines ?? []).map((r) => `${r.device}|${r.line}`),
  )
  for (const id of Object.keys(texts)) {
    const def = runtime.topo.devices[id] as SwitchDef | undefined
    if (!def || def.kind !== 'switch' || !bridge.running[id]) continue
    // metinde `interface` satırı olan portlar: dönüştürücü yalnız bunları metinden modeller
    // (router'ın metinde geçmeyen portuna varsayılan `enabled: true` yazar; o alan modellenmemiştir)
    const name = String(t.devices.find((d) => String(d.id) === id)?.name ?? id)
    // dönüştürücünün modellemediği ama CLI'nin uyguladığı satırların dokunduğu arayüzler
    const touched = new Set<string>()
    const globals: string[] = []
    for (const l of lines)
      if (l.device === id && l.status === 'applied' && converterUnmodeled.has(`${name}|${l.line}`)) {
        if (l.ifs?.length) for (const x of l.ifs) touched.add(x)
        else globals.push(l.command)
      }
    for (const diff of modeledDiffs(id, def, bridge.running[id]!, runtime.running[id]!, interfacesIn(texts[id]!))) {
      const dot = diff.field.lastIndexOf('.')
      const iface = dot > 0 && !['routes', 'vlans', 'defaultGateway', 'stpPriority'].includes(diff.field) ? diff.field.slice(0, dot) : null
      if (iface ? touched.has(iface) : globals.some((c) => GLOBAL_FIELD[diff.field]?.test(c))) extended.push(diff)
      else diffs.push(diff)
    }
  }
  return { bridge, runtime, lines, diffs, extended }
}

/** Global alanı değiştiren komutlar (açık fark yalnız ilgili komut uygulanmışsa). */
const GLOBAL_FIELD: Record<string, RegExp> = {
  routes: /^(no\s+)?ip\s+route\s/i,
  vlans: /^(no\s+)?vlan\s|^name\s|switchport\s+access\s+vlan\s/i,
  defaultGateway: /^(no\s+)?ip\s+default-gateway\s/i,
  stpPriority: /^(no\s+)?spanning-tree\s+vlan\s/i,
}

/** Metindeki `interface X` satırlarının kanonik adları. */
function interfacesIn(text: string): Set<string> {
  const out = new Set<string>()
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*interface\s+([A-Za-z-]+)\s*([\d/.:]+)\s*$/i.exec(line)
    const name = m ? canonIf(m[1]!, m[2]!) : null
    if (name) out.add(name)
  }
  return out
}

const ip = (x: { addr: string; mask: string } | null | undefined) => (x ? `${x.addr} ${x.mask}` : null)
const helpers = (o: { l3?: { helpers?: string[] } } | undefined) => o?.l3?.helpers ?? []

/**
 * Dönüştürücünün eşlediği alanların izdüşümü (convert_pkt_to_aglab.py `simulationCoverage`
 * "modeled"): switch VLAN veritabanı ve adları, port modu/access/trunk/native/allowed VLAN,
 * shutdown, temel port-security, yönetim SVI'si, default-gateway, STP önceliği; router fiziksel
 * ve alt arayüz IPv4/shutdown, alt arayüz VLAN'ı, statik rotalar, DHCP relay.
 */
export function modeledProjection(def: SwitchDef, c: SwitchConfig, recorded?: Set<string>): Record<string, unknown> {
  const p: Record<string, unknown> = {}
  if (def.router) {
    for (const [n, i] of Object.entries(c.ifaces)) {
      if (recorded && !recorded.has(n)) continue
      p[`${n}.ip`] = ip(i.ip)
      p[`${n}.shutdown`] = i.shutdown
      p[`${n}.helpers`] = helpers(i)
    }
    for (const [n, s] of Object.entries(c.subifs ?? {})) {
      p[`${n}.vlan`] = s.vlan
      p[`${n}.ip`] = ip(s.ip)
      p[`${n}.shutdown`] = s.shutdown
      p[`${n}.helpers`] = helpers(s)
    }
    p['routes'] = c.routes.map((r) => `${r.net} ${r.mask} ${r.nh} ${r.ad ?? 1}`).sort()
    return p
  }
  p['vlans'] = Object.fromEntries(Object.entries(c.vlans).sort(([a], [b]) => Number(a) - Number(b)))
  for (const [n, i] of Object.entries(c.ifaces) as [string, PhysIfConfig][]) {
    // AğLab modelinde DTP yok: dönüştürücü `switchport mode` satırı olmayan portu `access`
    // yazar; IOS'ta (Labber'da) bu port `dynamic auto`dur. Karşılaştırmada yalnız bu eşleme
    // yapılır; `dynamic desirable` gibi açık satırlar normalleştirilmez (fark görünür).
    const mode = i.mode === 'dynamic-auto' ? 'access' : i.mode
    p[`${n}.mode`] = mode
    p[`${n}.accessVlan`] = i.accessVlan
    p[`${n}.nativeVlan`] = i.nativeVlan
    // allowed listesi yalnız trunk'ta anlamlı (access portta etkisiz)
    // "hepsi": Labber null, AğLab 1–4094 listesi
    const all = i.allowed === null || (i.allowed.length === 4094 && i.allowed[0] === 1 && i.allowed[4093] === 4094)
    p[`${n}.allowed`] = mode === 'trunk' ? (all ? 'all' : i.allowed) : null
    p[`${n}.shutdown`] = i.shutdown
    const ps = i.portSecurity
    p[`${n}.portSecurity`] = ps?.enabled ? { max: ps.max, violation: ps.violation, macs: [...ps.macs].sort() } : null
  }
  for (const [v, s] of Object.entries(c.svis)) {
    p[`Vlan${v}.ip`] = ip(s.ip)
    if (s.ip) p[`Vlan${v}.shutdown`] = s.shutdown
  }
  p['defaultGateway'] = c.defaultGateway
  p['stpPriority'] = c.stpPriority
  return p
}

export function modeledDiffs(id: string, def: SwitchDef, structural: SwitchConfig, cli: SwitchConfig, recorded?: Set<string>): ModeledDiff[] {
  const a = modeledProjection(def, structural, recorded)
  const b = modeledProjection(def, cli, recorded)
  const out: ModeledDiff[] = []
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])]) {
    if (JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null)) out.push({ device: id, field: k, structural: a[k] ?? null, cli: b[k] ?? null })
  }
  return out
}

/**
 * İçe aktarma raporuna Labber CLI sonucunu ekler. `unmodeledConfigLines` artık Labber'ın
 * reddettiği ve davranışı etkileyebilecek satırlardır; zararsız satırlar
 * `ignoredConfigLines`'a ayrılır. Dönüştürücünün özgün listesi kaybolmaz:
 * `converterUnmodeledConfigLines`.
 */
export function importReportWithCli(report: Record<string, unknown> | null | undefined, t: AglabTopology, lines: ConfigLine[]): Record<string, unknown> {
  const name = (id: string) => String(t.devices.find((d) => String(d.id) === id)?.name ?? id)
  const row = (l: ConfigLine) => ({ device: name(l.device), line: l.line, command: l.command, ...(l.reason ? { reason: l.reason } : {}) })
  const base = { ...(report ?? {}) }
  const out: Record<string, unknown> = {
    ...base,
    converterUnmodeledConfigLines: base['converterUnmodeledConfigLines'] ?? base['unmodeledConfigLines'] ?? [],
    unmodeledConfigLines: lines.filter((l) => l.status === 'unmodeled').map(row),
    ignoredConfigLines: lines.filter((l) => l.status === 'ignored').map(row),
    labberCli: summarize(lines),
  }
  out['unmodeledConfigLineCount'] = (out['unmodeledConfigLines'] as unknown[]).length
  out['ignoredConfigLineCount'] = (out['ignoredConfigLines'] as unknown[]).length
  return out
}
