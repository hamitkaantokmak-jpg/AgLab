import { IosSession } from './cli/ios'
import { applyConfigText } from './config-text'
import { VpcsSession } from './cli/vpcs'
import { LabRuntime } from './runtime'
import type { LabDef } from './types'

export type Session = IosSession | VpcsSession

export interface CreateLabOptions {
  /**
   * L5-h: hoşgörülü mod. `initialConfig` bir running-config metni sayılır: satırlar ilk hatada
   * durmadan uygulanır ve her satırın sonucu `rt.configReport`'a yazılır (bkz. config-text.ts).
   */
  lenient?: boolean
}

export function createLab(def: LabDef, opts: CreateLabOptions = {}): LabRuntime {
  return new LabRuntime(def, (rt) => {
    if (opts.lenient) rt.configReport = []
    for (const sw of rt.topo.switches) {
      const text = def.initialConfig?.[sw.id]
      if (!text) continue
      if (opts.lenient) {
        rt.configReport!.push(...applyConfigText(rt, sw.id, text))
        continue
      }
      const s = new IosSession(rt, sw.id)
      s.mode = 'config'
      for (const line of text.split('\n')) {
        const out = s.exec(line)
        if (out.some((l) => l.startsWith('%') && /Invalid|Incomplete|Ambiguous/.test(l)))
          throw new Error(`initial config for ${sw.id} failed at "${line}": ${out.join(' ')}`)
      }
    }
  })
}

/** A powered-off device has no console. */
function assertPowered(rt: LabRuntime, dev: string) {
  if (!rt.powered(dev)) throw new Error(`${dev} is powered off`)
}

export function createSession(rt: LabRuntime, dev: string): Session {
  assertPowered(rt, dev)
  return rt.topo.devices[dev]!.kind === 'pc' ? new VpcsSession(rt, dev) : new IosSession(rt, dev)
}

/** Feed IOS commands (starting from privileged mode) into a switch. Returns the transcript. */
export function runScript(rt: LabRuntime, dev: string, script: string, session?: IosSession): string[] {
  assertPowered(rt, dev)
  const s = session ?? new IosSession(rt, dev)
  if (s.mode === 'user') s.mode = 'priv'
  const out: string[] = []
  for (const line of script.split('\n')) {
    out.push(s.prompt() + line)
    out.push(...s.exec(line))
  }
  return out
}

export { IosSession, VpcsSession, LabRuntime }
export * from './types'
export { ports } from './util'
