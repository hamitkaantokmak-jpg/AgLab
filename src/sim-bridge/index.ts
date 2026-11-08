// AğLab ⇄ Labber motor köprüsü.
//
// L0: Labber motorunun genel API'si. L1: AğLab topoloji JSON'u ⇄ LabDef/SwitchConfig
// dönüşümü (toLabber/toAglab) ve motor kararı raporu.
// tools/build_sim.cjs bu dosyayı tek bir IIFE'ye (global ad: AgLabSim) derler.
// L1'de hiçbir ürün kodu AgLabSim'i çağırmaz; köprüyü yalnızca testler ve
// tools/build_lab_engine_map.py kullanır.

export { createLab, createSession, runScript } from '../sim/index'
export { LabQuery } from '../sim/query'
export type { Session } from '../sim/index'
export type * from '../sim/types'
export { BridgeError, canonPort, createRuntime, needsEncapFor, toAglab, toLabber, MODEL_L2, MODEL_L3 } from './bridge'
export type { BridgeReport, BridgeResult, RejectedItem, UnsupportedItem } from './bridge'
export type { AglabDevice, AglabInterface, AglabLink, AglabTopology } from './aglab'
