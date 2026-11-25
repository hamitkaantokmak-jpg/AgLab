// Yapılandırma karşılaştırması (motor/syslog-zaman-diff, aşama 3).
//
// running-config metni kanonik satırlara çevrilir: `!`, boş satır ve `end` atılır, boşluklar
// tekleştirilir, girintili satır bölüm başlığıyla birleştirilir (`interface Gi0/1 > description x`),
// satırlar sıralanır. Karşılaştırma metin üzerinden yapıldığı için anlamsal gürültü yoktur: aynı
// değeri yeniden yazmak ya da `no x` ile varsayılana dönmek aynı metni üretir. Sayaç/zaman gibi
// dalgalanan alanlar running-config'de yoktur (Labber'ın running-config'inde "Current configuration
// : N bytes" başlığı da kullanılmaz).

import type { LinkPhys } from './types'

export interface DeviceConfig {
  /** kanonik running-config satırları (sıralı) */
  lines: string[]
  /** running = startup (q.saved ile aynı ölçüt) */
  saved: boolean
}

export interface ConfigSnapshot {
  /** anlık görüntünün sanal saati */
  clock: number
  devices: Record<string, DeviceConfig>
  /** Katman 1: phys tanımlı bağlantılar (linkKey → durum) */
  phys: Record<string, LinkPhys>
}

export interface DeviceDiff {
  added: string[]
  removed: string[]
  /** değişen bölüm başlıkları (interface/router/vlan/line …); üst düzey satırlar: "(global)" */
  changedSections: string[]
  /** karşılaştırılan son durumda running-config kaydedilmemiş (startup'tan farklı) */
  unsaved: boolean
}

export interface PhysChange {
  link: string
  before: LinkPhys | null
  after: LinkPhys | null
}

export interface ConfigDiff {
  devices: Record<string, DeviceDiff>
  phys: PhysChange[]
}

export const SEP = ' > '
export const GLOBAL = '(global)'

/** running-config satırları → kanonik satırlar. */
export function canonicalConfig(text: string[]): string[] {
  const out: string[] = []
  let header: string | null = null
  for (const raw of text) {
    if (!raw.trim() || raw.trim() === '!' || raw.trim() === 'end') {
      if (raw.trim() === '!') header = null
      continue
    }
    const line = raw.trim().replace(/\s+/g, ' ')
    if (/^\s/.test(raw) && header) out.push(header + SEP + line)
    else {
      header = line
      out.push(line)
    }
  }
  return out.sort()
}

/** Bir satırın bölümü: girintili satırda başlık; başlık satırında kendisi (alt satırı varsa); diğer üst düzey satırda "(global)". */
function sectionOf(line: string, headers: Set<string>): string {
  const i = line.indexOf(SEP)
  if (i >= 0) return line.slice(0, i)
  return headers.has(line) ? line : GLOBAL
}

/** Çoklu küme farkı (a − b). */
function minus(a: string[], b: string[]): string[] {
  const n = new Map<string, number>()
  for (const x of b) n.set(x, (n.get(x) ?? 0) + 1)
  const out: string[] = []
  for (const x of a) {
    const c = n.get(x) ?? 0
    if (c) n.set(x, c - 1)
    else out.push(x)
  }
  return out
}

/** İki anlık görüntü (aynı cihaz kümesi: `before`ın cihazları) arasındaki fark. */
export function diffSnapshots(before: ConfigSnapshot, after: ConfigSnapshot): ConfigDiff {
  const devices: Record<string, DeviceDiff> = {}
  for (const dev of Object.keys(before.devices).sort()) {
    const a = before.devices[dev]!.lines
    const b = after.devices[dev]?.lines ?? []
    const added = minus(b, a)
    const removed = minus(a, b)
    const headers = new Set([...a, ...b].filter((l) => l.includes(SEP)).map((l) => l.slice(0, l.indexOf(SEP))))
    const changedSections = [...new Set([...added, ...removed].map((l) => sectionOf(l, headers)))].sort()
    devices[dev] = { added, removed, changedSections, unsaved: !(after.devices[dev]?.saved ?? before.devices[dev]!.saved) }
  }
  const phys: PhysChange[] = []
  for (const link of [...new Set([...Object.keys(before.phys), ...Object.keys(after.phys)])].sort()) {
    const x = before.phys[link] ?? null
    const y = after.phys[link] ?? null
    if (canonJson(x) !== canonJson(y)) phys.push({ link, before: x, after: y })
  }
  return { devices, phys }
}

/** Anahtar sırasından bağımsız JSON (fiziksel durum karşılaştırması). */
export function canonJson(x: unknown): string {
  if (x === null || typeof x !== 'object') return JSON.stringify(x)
  if (Array.isArray(x)) return '[' + x.map(canonJson).join(',') + ']'
  const o = x as Record<string, unknown>
  return '{' + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canonJson(o[k])).join(',') + '}'
}

/** Değişen cihazlar: yapılandırması değişen + fiziksel parçası değişen uçlar (kablo/fiber yönü: iki uç). */
export function changedDevicesOf(d: ConfigDiff): string[] {
  const out = new Set<string>()
  for (const [dev, x] of Object.entries(d.devices)) if (x.added.length || x.removed.length) out.add(dev)
  for (const p of d.phys) {
    const ends = p.link.split('~')
    const devOf = (k: string) => k.slice(0, k.indexOf('|'))
    const cableChanged = !p.before || !p.after || canonJson(p.before.cable) !== canonJson(p.after.cable) || !!p.before.txRxSwapped !== !!p.after.txRxSwapped
    for (const k of ends) if (cableChanged || canonJson(p.before?.ends[k] ?? null) !== canonJson(p.after?.ends[k] ?? null)) out.add(devOf(k))
  }
  return [...out].sort()
}
