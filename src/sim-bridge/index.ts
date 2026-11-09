// AğLab ⇄ Labber motor köprüsü.
//
// L0: Labber motorunun genel API'si. L1: AğLab topoloji JSON'u ⇄ LabDef/SwitchConfig
// dönüşümü (toLabber/toAglab) ve motor kararı raporu.
// tools/build_sim.cjs bu dosyayı tek bir IIFE'ye (global ad: AgLabSim) derler.
// L3-a: ürün terminali Labber içeriğinde createSession ile IosSession/VpcsSession açar.

export { createLab, createSession, IosSession, runScript, VpcsSession } from '../sim/index'
export { LabQuery } from '../sim/query'
// E: Labber'ın kendi labları (src/labs, kullanıcının içeriği; değiştirilmeden alındı).
export { LABS as LABBER_LABS } from '../labs/index'
export type { Session } from '../sim/index'
export type * from '../sim/types'
export { BridgeError, canonPort, createRuntime, needsEncapFor, toAglab, toLabber, MODEL_L2, MODEL_L3 } from './bridge'
export type { BridgeReport, BridgeResult, RejectedItem, UnsupportedItem } from './bridge'
export type { AglabDevice, AglabInterface, AglabLink, AglabTopology } from './aglab'
