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
// AğLab arayüz PR 2: hedef ipuçlarının ilk iki basamağı (neye bak, kavram); 3. basamak labın `hint`i.
export { HINT_TIERS as LABBER_HINT_TIERS } from '../labs/hint-tiers'
export type { Session } from '../sim/index'
export type * from '../sim/types'
export { BridgeError, canonPort, createRuntime, needsEncapFor, toAglab, toLabber, MODEL_L2, MODEL_L3 } from './bridge'
export type { BridgeReport, BridgeResult, RejectedItem, UnsupportedItem } from './bridge'
// L3-b: Simulation Mode olay adaptörü (Labber ping → paket olayı kayıtları).
export { pingTrace } from './events'
export type { PingTrace, TraceRecord } from './events'
export type { AglabDevice, AglabInterface, AglabLink, AglabTopology } from './aglab'
// L5-h: PKT IOS metin yolu (hoşgörülü mod, satır raporu, yapısal/CLI karşılaştırması).
export { cliImport, importReportWithCli, modeledDiffs, modeledProjection } from './cli-import'
export type { CliImport, ModeledDiff } from './cli-import'
export type { ConfigLine, LineStatus } from '../sim/config-text'
