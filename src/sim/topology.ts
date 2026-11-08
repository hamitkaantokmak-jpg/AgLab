import type { DeviceDef, LabDef, PcDef, SwitchDef } from './types'

export interface Peer {
  dev: string
  port: string
}

export interface Topo {
  lab: LabDef
  devices: Record<string, DeviceDef>
  switches: SwitchDef[]
  pcs: PcDef[]
  /** 'dev|port' -> peer */
  peer: Record<string, Peer>
  /** pc id -> switch attachment */
  pcAttach: Record<string, Peer | null>
}

export const pk = (dev: string, port: string) => `${dev}|${port}`

export function buildTopo(lab: LabDef): Topo {
  const devices: Record<string, DeviceDef> = {}
  for (const d of lab.devices) devices[d.id] = d
  const peer: Record<string, Peer> = {}
  for (const l of lab.links) {
    peer[pk(l.a[0], l.a[1])] = { dev: l.b[0], port: l.b[1] }
    peer[pk(l.b[0], l.b[1])] = { dev: l.a[0], port: l.a[1] }
  }
  const switches = lab.devices.filter((d): d is SwitchDef => d.kind === 'switch')
  const pcs = lab.devices.filter((d): d is PcDef => d.kind === 'pc')
  const pcAttach: Record<string, Peer | null> = {}
  for (const pc of pcs) pcAttach[pc.id] = peer[pk(pc.id, 'eth0')] ?? null
  return { lab, devices, switches, pcs, peer, pcAttach }
}
