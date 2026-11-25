// Sanal zaman (motor/syslog-zaman-diff, aşama 2): tipler ve saf yardımcılar.
//
// Zaman saniye cinsinden sanal bir sayaçtır (rt.clock); gerçek saat kullanılmaz. rt.tick(s)
// saati ilerletir ve arada kalan olayları zaman sırasıyla işler (runtime.ts). Rastgelelik yoktur:
// aynı başlangıç ve aynı tick dizisi aynı sonucu verir; tek büyük tick ile küçük tick'ler arasında
// fark yoktur (olay anları önceden hesaplanır).

import type { CableSpec, SfpSpec } from './types'

/** Periyodik link kesintisi: her `periodS` saniyenin ilk `upS` saniyesi up, kalanı down (faz = saat). */
export interface FlapSpec {
  periodS: number
  upS: number
}

export type ScheduledAction =
  | { type: 'link'; dev: string; port: string; up: boolean }
  | { type: 'power'; dev: string; on: boolean; bootS?: number }
  | { type: 'flap'; dev: string; port: string; flap: FlapSpec | null }
  | { type: 'sfp'; dev: string; port: string; sfp: SfpSpec | null }
  | { type: 'cable'; dev: string; port: string; cable: CableSpec }

export interface ScheduledEvent {
  id: string
  /** sanal saat (saniye) */
  at: number
  action: ScheduledAction
}

/** Arka plan trafiği (CDP/STP/keepalive ve kullanıcı trafiği yerine): link yönü başına çerçeve/saniye. */
export const BACKGROUND_FPS = 10
/** Kayan nokta birikimini önlemek için zaman mikro saniyeye yuvarlanır. */
export const roundT = (t: number) => Math.round(t * 1e6) / 1e6
const EPS = 1e-9

export function validFlap(f: FlapSpec): boolean {
  return Number.isFinite(f.periodS) && f.periodS > 0 && Number.isFinite(f.upS) && f.upS >= 0 && f.upS <= f.periodS
}

/** Flap eden link `t` anında up mı (faz = t mod periyot; [0, upS) up). */
export function flapUp(f: FlapSpec, t: number): boolean {
  const phase = roundT(((t % f.periodS) + f.periodS) % f.periodS)
  return phase < f.upS - EPS
}

/** `t`'den sonraki ilk durum değişim anı (kesin büyük). */
export function nextFlapEdge(f: FlapSpec, t: number): number | null {
  if (f.upS <= 0 || f.upS >= f.periodS) return null // hep down / hep up
  const base = roundT(t - (((t % f.periodS) + f.periodS) % f.periodS))
  for (const c of [base + f.upS, base + f.periodS, base + f.periodS + f.upS]) if (roundT(c) > t + EPS) return roundT(c)
  return null
}
