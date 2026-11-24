// Katman 1 testlerinin ortak labı (phys.test.ts, phys-cli.test.ts, phys-actions.test.ts).
import { ports } from '../../../src/sim/util'
import type { LabDef, LinkPhysSpec } from '../../../src/sim/types'

export const G1 = 'GigabitEthernet0/1'

/** İki switch (Gi0/1 ⇄ Gi0/1) ve her switch'e bir PC; switch'ler arası link `phys` ile. */
export function twoSwitchLab(phys?: LinkPhysSpec, over: (d: LabDef) => void = () => {}): LabDef {
  const d: LabDef = {
    id: 'l1', title: '', summary: '', level: 'Başlangıç', tags: [], brief: [], view: { w: 1, h: 1 },
    devices: [
      { id: 'SW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0001.0000', ports: ports('Fa0/1-2', 'Gi0/1-2'), x: 0, y: 0 },
      { id: 'SW2', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0002.0000', ports: ports('Fa0/1-2', 'Gi0/1-2'), x: 0, y: 0 },
      { id: 'PC1', kind: 'pc', mac: '0050.7966.0001', x: 0, y: 0 },
      { id: 'PC2', kind: 'pc', mac: '0050.7966.0002', x: 0, y: 0 },
    ],
    links: [
      { a: ['PC1', 'eth0'], b: ['SW1', 'FastEthernet0/1'] },
      { a: ['PC2', 'eth0'], b: ['SW2', 'FastEthernet0/1'] },
      phys ? { a: ['SW1', G1], b: ['SW2', G1], phys } : { a: ['SW1', G1], b: ['SW2', G1] },
    ],
    initialPcs: {
      PC1: { ip: '192.168.1.11', prefix: 24, gw: null },
      PC2: { ip: '192.168.1.12', prefix: 24, gw: null },
    },
    objectives: [], solution: {},
  }
  over(d)
  return d
}

export const fiber = (type: 'sx' | 'lx' | 'zx', lengthM: number, more: Partial<LinkPhysSpec> = {}): LinkPhysSpec => ({
  cable: { kind: type === 'sx' ? 'fiber-mm' : 'fiber-sm', lengthM },
  ends: { a: { sfp: { type: `1000base-${type}` } }, b: { sfp: { type: `1000base-${type}` } } },
  ...more,
})

