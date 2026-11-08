// AğLab ⇄ Labber motor köprüsü (L0 iskeleti).
//
// Bu aşamada yalnızca Labber motorunun genel API'sini dışa açar; AğLab topoloji
// JSON'u ile Labber LabDef/SwitchConfig arasındaki dönüşüm L1'in işidir.
// tools/build_sim.cjs bu dosyayı tek bir IIFE'ye (global ad: AgLabSim) derler.
// L0'da hiçbir ürün kodu AgLabSim'i çağırmaz.

export { createLab, createSession, runScript } from '../sim/index'
export { LabQuery } from '../sim/query'
export type { Session } from '../sim/index'
export type * from '../sim/types'
