// Katman 1 (fiziksel katman) modeli.
//
// `LinkDef.phys` tanımlı bir bağlantının iki ucu için link durumunu, hızı, port tipini, optik
// gücü (dBm) ve hata oranını türetir. Hesap tek yerdedir: engine.ts derive() bu dosyadaki
// evaluateLink'i çağırır; port durumları (connected / notconnect / err-disabled), hız/duplex,
// show çıktıları ve hata sayaçları bu sonucu okur. Rastgelelik yoktur: aynı girdi her zaman
// aynı sonucu verir.
//
// Sayılar öğretim amaçlı, tipik değerlerdir (Cisco GLC-SX-MMD / GLC-LH-SMD / GLC-ZX-SMD veri
// sayfalarındaki aralıkların içinden seçildi). Gerçek modüllerin DOM eşikleri, sıcaklık, voltaj,
// akım ve üretim farkları modellenmez.

import type { CableKind, CableSpec, LinkPhys, PhysEndSpec, SfpSpec, SfpType } from './types'
import { ifType } from './util'

export type L1Fault =
  /** sorun yok */
  | 'none'
  /** kablo bu uca takılamaz (fiber → RJ45 port, UTP → optik SFP, DAC → SFP'siz port) */
  | 'media'
  /** modül arızalı */
  | 'sfp-dead'
  /** iki ucun optik tipi farklı (SX ↔ LX …) */
  | 'type-mismatch'
  /** TX/RX ters: iki alıcıya da ışık gelmiyor */
  | 'swapped'
  /** alıcı gücü duyarlılığın altında (loss of signal) */
  | 'los'
  /** alıcı gücü eşiğe yakın: link up, hatalı çerçeve */
  | 'marginal'
  /** alıcı doymuş (kısa linkte güçlü optik): link up, hatalı çerçeve */
  | 'overload'
  /** kablo uzunluğu standardın üstünde (hatalı ya da link yok) */
  | 'length'
  /** hasarlı kablo: link up, hatalı çerçeve */
  | 'errors'
  /** bu uç sağlam ama karşı uç linki kuramıyor */
  | 'remote'

export interface L1End {
  /** katman 1 linke izin veriyor (iki yön de çalışıyor) */
  link: boolean
  /** bu ucun ana nedeni (birden çok sorun varsa en ağırı) */
  fault: L1Fault
  /** anlaşılan hız (Mbit/s) */
  speed: number
  /** `show interfaces status` Type sütunu */
  type: string
  media: 'copper' | 'fiber'
  /** takılı modül (yoksa null) */
  sfp: SfpSpec | null
  /** desteklenmeyen modül (third-party): runtime portu err-disable eder (gbic-invalid) */
  unsupported: boolean
  /** optik TX/RX gücü (dBm, 0,1 hassasiyet); bakırda ve ölü modülde null; ışık yoksa -40 */
  txDbm: number | null
  rxDbm: number | null
  /** alınan 10 000 çerçevede hatalı (CRC) çerçeve sayısı; 0 = temiz */
  errPer10k: number
}

export interface OpticSpec {
  label: string
  wavelengthNm: number
  txDbm: number
  /** alıcı duyarlılığı: altında ışık yok sayılır */
  sensDbm: number
  /** alıcı doyma sınırı: üstünde hatalı alım */
  overloadDbm: number
  /** kablo türüne göre erişim ve kuplaj cezası (uyumluluk tablosu: tek yer) */
  fiber: Record<'fiber-mm' | 'fiber-sm', { reachM: number; penaltyDb: number }>
}

/**
 * Optik modüller ve kablo uyumluluğu. SX çok modlu içindir; tek modlu kabloya 850 nm ışık
 * neredeyse hiç girmez (ceza 20 dB → link yok). LX çok modlu kabloda mod koşullandırma kablosu
 * olmadan kısa mesafede zayıf sinyal verir (ceza 11 dB → marjinal). ZX yalnız tek modlu.
 */
export const OPTICS: Record<'1000base-sx' | '1000base-lx' | '1000base-zx', OpticSpec> = {
  '1000base-sx': { label: '1000BaseSX SFP', wavelengthNm: 850, txDbm: -5, sensDbm: -17, overloadDbm: 0, fiber: { 'fiber-mm': { reachM: 550, penaltyDb: 0 }, 'fiber-sm': { reachM: 550, penaltyDb: 20 } } },
  '1000base-lx': { label: '1000BaseLX SFP', wavelengthNm: 1310, txDbm: -6, sensDbm: -19, overloadDbm: -3, fiber: { 'fiber-sm': { reachM: 10000, penaltyDb: 0 }, 'fiber-mm': { reachM: 550, penaltyDb: 11 } } },
  '1000base-zx': { label: '1000BaseZX SFP', wavelengthNm: 1550, txDbm: 2, sensDbm: -23, overloadDbm: -3, fiber: { 'fiber-sm': { reachM: 70000, penaltyDb: 0 }, 'fiber-mm': { reachM: 550, penaltyDb: 20 } } },
}

/** Fiber zayıflaması (dB/km), kablo × dalga boyu. */
export const FIBER_DB_PER_KM: Record<'fiber-mm' | 'fiber-sm', Record<number, number>> = {
  'fiber-mm': { 850: 3.5, 1310: 1.5, 1550: 1.5 },
  'fiber-sm': { 850: 3.5, 1310: 0.4, 1550: 0.25 },
}

/** Uç başına (eşlenmiş konnektör) kayıp; kirli konnektörün alıcıya ek kaybı; bükülme kaybı. */
export const CONNECTOR_DB = 0.5
export const DIRTY_DB = 9
export const BEND_DB = 5
/** duyarlılığın bu kadar üstüne kadar marjinal bölge (dB) */
export const MARGIN_DB = 3
/** ışık yokken gösterilen güç (IOS DOM alt sınırı) */
export const NO_LIGHT_DBM = -40
/** bakır: standart en uzun kanal; bunun üstünde hatalı, COPPER_MAX_M üstünde link yok */
export const UTP_MAX_M = 100
export const COPPER_MAX_M = 150
/** pasif DAC en uzun */
export const DAC_MAX_M = 7
/** 10 000 çerçevede hata: hasarlı kablo, metre başına aşım (bakır), marjinal/doyma tavanı */
export const DAMAGED_ERR = 200
export const COPPER_ERR_PER_M = 6
export const OPTIC_ERR_MAX = 500

export const isFiber = (k: CableKind) => k === 'fiber-mm' || k === 'fiber-sm'
const isOptic = (t: SfpType): t is keyof typeof OPTICS => t in OPTICS
const r1 = (x: number) => Math.round(x * 10) / 10

/** Bağlantının anahtarı: iki ucun 'dev|port' anahtarları sıralı. */
export const linkKey = (a: string, b: string) => (a < b ? `${a}~${b}` : `${b}~${a}`)

export interface EndRef {
  /** 'dev|port' */
  key: string
  /** kanonik port adı (PC'de eth0) */
  port: string
  pc: boolean
}

/** Uçtaki modülün ya da yerleşik portun ortamı. */
function endMedia(end: EndRef, spec: PhysEndSpec | undefined): { kind: 'rj45' | 'optic' | 'dac' | 'tsfp'; speed: number } {
  const sfp = end.pc ? undefined : spec?.sfp
  if (!sfp) return { kind: 'rj45', speed: end.pc ? 1000 : (ifType(end.port)?.speed ?? 100) }
  if (sfp.type === 'dac') return { kind: 'dac', speed: 1000 }
  if (sfp.type === '1000base-t') return { kind: 'tsfp', speed: 1000 }
  return { kind: 'optic', speed: 1000 }
}

function typeLabel(end: EndRef, spec: PhysEndSpec | undefined, cable: CableSpec): string {
  const sfp = end.pc ? undefined : spec?.sfp
  if (sfp) {
    if (isOptic(sfp.type)) return OPTICS[sfp.type].label
    if (sfp.type === '1000base-t') return '10/100/1000BaseTX SFP'
    return '1000BaseCX SFP'
  }
  // fiber/DAC kablo yerleşik porta: modül yuvası boş
  if (isFiber(cable.kind) || cable.kind === 'dac') return 'Not Present'
  return (ifType(end.port)?.speed ?? 1000) === 100 ? '10/100BaseTX' : '10/100/1000BaseTX'
}

/** Kablonun bu uca takılıp takılamayacağı. */
function fits(cable: CableKind, m: ReturnType<typeof endMedia>['kind']): boolean {
  if (isFiber(cable)) return m === 'optic'
  if (cable === 'dac') return m === 'dac'
  return m === 'rj45' || m === 'tsfp'
}

const SEVERITY: L1Fault[] = ['media', 'sfp-dead', 'type-mismatch', 'swapped', 'los', 'length', 'remote', 'overload', 'marginal', 'errors', 'none']
const worse = (x: L1Fault, y: L1Fault) => (SEVERITY.indexOf(x) <= SEVERITY.indexOf(y) ? x : y)

/**
 * Bir bağlantının iki ucunu değerlendirir. `phys.ends` uçları 'dev|port' anahtarıyla tutar.
 * Kurallar (özet; ayrıntı docs/UYUMLULUK_MATRISI.md "Katman 1"):
 * - kablo uca takılamıyorsa (ortam) ya da modül ölüyse link yok;
 * - bakır: ≤ 100 m temiz, 100–150 m hatalı, > 150 m link yok; hasarlı kablo hatalı;
 * - DAC: ≤ 7 m; hasarlı kablo hatalı;
 * - fiber: iki uç aynı optik tip olmalı; TX/RX ters ise ışık yok; alıcı gücü
 *   = karşı TX − fiber kaybı − 2 × konnektör − bükülme − kuplaj cezası − bu ucun kirli konnektörü;
 *   duyarlılığın altında link yok, MARGIN_DB içinde marjinal (hatalı), doyma üstünde hatalı;
 *   kablo erişimi aşılırsa (≤ 1,2 ×) hatalı, daha uzunsa link yok; hasarlı fiber ışık geçirmez.
 * Link iki yönün de çalışmasını ister (bir alıcı ışık görmüyorsa iki uç da düşer).
 */
export function evaluateLink(phys: LinkPhys, a: EndRef, b: EndRef): { a: L1End; b: L1End } {
  const cable = phys.cable
  const specA = phys.ends[a.key]
  const specB = phys.ends[b.key]
  const mA = endMedia(a, specA)
  const mB = endMedia(b, specB)
  const sfpA = a.pc ? null : (specA?.sfp ?? null)
  const sfpB = b.pc ? null : (specB?.sfp ?? null)
  const speed = Math.min(mA.speed, mB.speed)
  const fiber = isFiber(cable.kind)
  const base = (end: EndRef, spec: PhysEndSpec | undefined, sfp: SfpSpec | null): L1End => ({
    link: false,
    fault: 'none',
    speed,
    type: typeLabel(end, spec, cable),
    media: fiber ? 'fiber' : 'copper',
    sfp,
    unsupported: !!sfp && sfp.vendor === 'third-party',
    txDbm: null,
    rxDbm: null,
    errPer10k: 0,
  })
  const A = base(a, specA, sfpA)
  const B = base(b, specB, sfpB)
  const both = (f: L1Fault, err = 0) => {
    A.fault = worse(A.fault, f)
    B.fault = worse(B.fault, f)
    A.errPer10k = Math.max(A.errPer10k, err)
    B.errPer10k = Math.max(B.errPer10k, err)
  }

  // 1. kablo uca takılabiliyor mu, modül canlı mı
  let blocked = false
  for (const [E, m, sfp] of [
    [A, mA, sfpA],
    [B, mB, sfpB],
  ] as const) {
    if (!fits(cable.kind, m.kind)) {
      E.fault = 'media'
      blocked = true
    } else if (sfp?.dead) {
      E.fault = 'sfp-dead'
      blocked = true
    }
  }

  if (!fiber) {
    if (blocked) return finish(A, B, false)
    const max = cable.kind === 'dac' ? DAC_MAX_M : COPPER_MAX_M
    if (cable.lengthM > max) {
      both('length')
      return finish(A, B, false)
    }
    if (cable.kind !== 'dac' && cable.lengthM > UTP_MAX_M) both('length', Math.round((cable.lengthM - UTP_MAX_M) * COPPER_ERR_PER_M))
    if (cable.damaged) both('errors', DAMAGED_ERR)
    return finish(A, B, true)
  }

  // 2. fiber: optik güç bütçesi
  const optA = sfpA && isOptic(sfpA.type) ? OPTICS[sfpA.type] : null
  const optB = sfpB && isOptic(sfpB.type) ? OPTICS[sfpB.type] : null
  if (optA && !sfpA!.dead) A.txDbm = optA.txDbm
  if (optB && !sfpB!.dead) B.txDbm = optB.txDbm
  if (blocked || !optA || !optB) {
    // karşı uç ışık üretmiyor (modül yok/ölü/optik değil): canlı alıcı ışık görmez
    if (optA && !sfpA!.dead) A.rxDbm = NO_LIGHT_DBM
    if (optB && !sfpB!.dead) B.rxDbm = NO_LIGHT_DBM
    if (A.fault === 'none') A.fault = 'los'
    if (B.fault === 'none') B.fault = 'los'
    return finish(A, B, false)
  }
  if (optA !== optB) {
    A.rxDbm = NO_LIGHT_DBM
    B.rxDbm = NO_LIGHT_DBM
    both('type-mismatch')
    return finish(A, B, false)
  }
  if (phys.txRxSwapped || cable.damaged) {
    A.rxDbm = NO_LIGHT_DBM
    B.rxDbm = NO_LIGHT_DBM
    both(phys.txRxSwapped ? 'swapped' : 'los')
    return finish(A, B, false)
  }
  const opt = optA
  const fk = cable.kind as 'fiber-mm' | 'fiber-sm'
  const fit = opt.fiber[fk]
  const pathLoss = (cable.lengthM / 1000) * FIBER_DB_PER_KM[fk][opt.wavelengthNm]! + 2 * CONNECTOR_DB + (cable.bent ? BEND_DB : 0) + fit.penaltyDb
  let ok = true
  for (const [E, spec, peerTx] of [
    [A, specA, optB.txDbm],
    [B, specB, optA.txDbm],
  ] as const) {
    const rx = r1(peerTx - pathLoss - (spec?.connectorDirty ? DIRTY_DB : 0))
    E.rxDbm = rx
    if (rx < opt.sensDbm) {
      E.fault = 'los'
      ok = false
    } else if (rx > opt.overloadDbm) {
      E.fault = 'overload'
      E.errPer10k = Math.min(OPTIC_ERR_MAX, Math.round((rx - opt.overloadDbm) * 100) + 50)
    } else if (rx < opt.sensDbm + MARGIN_DB) {
      E.fault = 'marginal'
      E.errPer10k = Math.round(((opt.sensDbm + MARGIN_DB - rx) / MARGIN_DB) * OPTIC_ERR_MAX)
    }
  }
  if (!ok) {
    // ışığı alan uç da düşer (karşı uç uzak hata bildirir)
    for (const E of [A, B]) if (E.fault !== 'los') E.fault = 'remote'
    return finish(A, B, false)
  }
  if (cable.lengthM > fit.reachM * 1.2) {
    both('length')
    return finish(A, B, false)
  }
  if (cable.lengthM > fit.reachM) both('length', Math.round(((cable.lengthM - fit.reachM) / fit.reachM) * 2 * OPTIC_ERR_MAX))
  return finish(A, B, true)
}

function finish(A: L1End, B: L1End, link: boolean): { a: L1End; b: L1End } {
  A.link = link
  B.link = link
  if (!link) {
    A.errPer10k = 0
    B.errPer10k = 0
  }
  return { a: A, b: B }
}

/** LinkDef.phys (a/b) → çalışma anı biçimi ('dev|port'). */
export function normalizePhys(spec: { cable: CableSpec; ends?: { a?: PhysEndSpec; b?: PhysEndSpec }; txRxSwapped?: boolean }, aKey: string, bKey: string): LinkPhys {
  const ends: Record<string, PhysEndSpec> = {}
  if (spec.ends?.a) ends[aKey] = structuredCopy(spec.ends.a)
  if (spec.ends?.b) ends[bKey] = structuredCopy(spec.ends.b)
  return { cable: { ...spec.cable }, ends, ...(spec.txRxSwapped ? { txRxSwapped: true } : {}) }
}

const structuredCopy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

// ---- hata sayaçları (runtime tutar; deterministik) ----

export interface PortCounters {
  /** alınan / gönderilen çerçeve */
  rx: number
  tx: number
  /** input errors (modelde hepsi CRC) */
  inErr: number
  crc: number
  /** hata birikimi kalanı (10 000'de bir birimi) */
  acc: number
}

export const zeroCounters = (): PortCounters => ({ rx: 0, tx: 0, inErr: 0, crc: 0, acc: 0 })

/** n çerçeve alındı: hata oranına göre CRC sayacı deterministik artar. */
export function receive(c: PortCounters, n: number, errPer10k: number) {
  c.rx += n
  if (!errPer10k) return
  c.acc += n * errPer10k
  const e = Math.floor(c.acc / 10000)
  c.acc -= e * 10000
  c.inErr += e
  c.crc += e
}

/** Lab açılışında her up phys portu için sayılan arka plan çerçevesi (CDP/STP/keepalive). */
export const BOOT_FRAMES = 1000

// ---- doğrulama (köprü: AgLab JSON'undan gelen phys) ----

const CABLE_KINDS: CableKind[] = ['utp-cat5e', 'utp-cat6', 'dac', 'fiber-mm', 'fiber-sm']
const SFP_TYPES: SfpType[] = ['1000base-t', '1000base-sx', '1000base-lx', '1000base-zx', 'dac']

/**
 * LinkDef.phys biçimini doğrular; hata metni ya da null. `gigabit(side)`: o uç SFP alabilir mi
 * (switch'in GigabitEthernet portu). Yalnız bilinen alanlar kabul edilir.
 */
export function validatePhysSpec(x: unknown, gigabit: (side: 'a' | 'b') => boolean): string | null {
  const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
  const only = (o: Record<string, unknown>, keys: string[], where: string) => {
    const extra = Object.keys(o).filter((k) => !keys.includes(k))
    return extra.length ? `${where}: bilinmeyen alan ${extra.join(', ')}` : null
  }
  if (!obj(x)) return 'phys bir nesne olmalı'
  let e = only(x, ['cable', 'ends', 'txRxSwapped'], 'phys')
  if (e) return e
  const c = x['cable']
  if (!obj(c)) return 'phys.cable gerekli'
  if ((e = only(c, ['kind', 'lengthM', 'damaged', 'bent'], 'phys.cable'))) return e
  if (!CABLE_KINDS.includes(c['kind'] as CableKind)) return `kablo türü ${String(c['kind'])} bilinmiyor`
  if (typeof c['lengthM'] !== 'number' || !(c['lengthM'] >= 0)) return 'kablo uzunluğu (lengthM) sayı olmalı'
  for (const f of ['damaged', 'bent']) if (c[f] !== undefined && typeof c[f] !== 'boolean') return `phys.cable.${f} boolean olmalı`
  if (x['txRxSwapped'] !== undefined && typeof x['txRxSwapped'] !== 'boolean') return 'phys.txRxSwapped boolean olmalı'
  const ends = x['ends']
  if (ends === undefined) return null
  if (!obj(ends)) return 'phys.ends nesne olmalı'
  if ((e = only(ends, ['a', 'b'], 'phys.ends'))) return e
  for (const side of ['a', 'b'] as const) {
    const end = ends[side]
    if (end === undefined) continue
    if (!obj(end)) return `phys.ends.${side} nesne olmalı`
    if ((e = only(end, ['sfp', 'connectorDirty'], `phys.ends.${side}`))) return e
    if (end['connectorDirty'] !== undefined && typeof end['connectorDirty'] !== 'boolean') return `phys.ends.${side}.connectorDirty boolean olmalı`
    const sfp = end['sfp']
    if (sfp === undefined) continue
    if (!obj(sfp)) return `phys.ends.${side}.sfp nesne olmalı`
    if ((e = only(sfp, ['type', 'vendor', 'dead'], `phys.ends.${side}.sfp`))) return e
    if (!SFP_TYPES.includes(sfp['type'] as SfpType)) return `SFP tipi ${String(sfp['type'])} bilinmiyor`
    if (sfp['vendor'] !== undefined && sfp['vendor'] !== 'cisco' && sfp['vendor'] !== 'third-party') return 'SFP vendor cisco ya da third-party olmalı'
    if (sfp['dead'] !== undefined && typeof sfp['dead'] !== 'boolean') return 'SFP dead boolean olmalı'
    if (!gigabit(side)) return `phys.ends.${side}: SFP yalnız switch'in GigabitEthernet portuna takılabilir`
  }
  return null
}

/** Çalışma anı biçimi → LinkDef.phys (a/b sırası verilen uçlarla). */
export function physSpecOf(p: LinkPhys, aKey: string, bKey: string): { cable: CableSpec; ends?: { a?: PhysEndSpec; b?: PhysEndSpec }; txRxSwapped?: boolean } {
  const ends: { a?: PhysEndSpec; b?: PhysEndSpec } = {}
  const clean = (e: PhysEndSpec | undefined) => (e && (e.sfp || e.connectorDirty) ? structuredCopy(e) : undefined)
  const a = clean(p.ends[aKey])
  const b = clean(p.ends[bKey])
  if (a) ends.a = a
  if (b) ends.b = b
  return { cable: { ...p.cable }, ...(a || b ? { ends } : {}), ...(p.txRxSwapped ? { txRxSwapped: true } : {}) }
}
