import { IosSession } from './cli/ios'
import { VpcsSession } from './cli/vpcs'
import { LabRuntime } from './runtime'
import type { LabDef } from './types'

export type Session = IosSession | VpcsSession

export function createLab(def: LabDef): LabRuntime {
  return new LabRuntime(def, (rt) => {
    for (const sw of rt.topo.switches) {
      const text = def.initialConfig?.[sw.id]
      if (!text) continue
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

export function createSession(rt: LabRuntime, dev: string): Session {
  return rt.topo.devices[dev]!.kind === 'pc' ? new VpcsSession(rt, dev) : new IosSession(rt, dev)
}

/** Feed IOS commands (starting from privileged mode) into a switch. Returns the transcript. */
export function runScript(rt: LabRuntime, dev: string, script: string, session?: IosSession): string[] {
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
