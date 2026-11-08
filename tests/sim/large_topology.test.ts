// AğLab L0 bütçe testi: 300 cihazlık sentetik topolojide Labber computeState() süresi.
//
// Topoloji: 150 switch'lik halka (her bağlantı VLAN 1,10,20 taşıyan trunk) ve her
// switch'e bağlı bir PC (150 PC; çift sıradakiler VLAN 10, tekler VLAN 20).
// Halka, VLAN başına STP'nin bir bağlantıyı bloklamasını gerektirir; bu yüzden en
// ağır türetme yollarından biridir.
//
// Bütçe (kullanıcı kararı): tek computeState() < 200 ms. Ölçüm 5 kez yapılır, ortanca
// karşılaştırılır ve AGLAB_TEST_ARTIFACT_DIR altına sim-performance.json yazılır.
import { describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createLab } from '../../src/sim'
import { computeState } from '../../src/sim/ospf'
import { LabQuery } from '../../src/sim/query'
import { ports } from '../../src/sim/util'
import type { DeviceDef, LabDef, LinkDef } from '../../src/sim/types'

const SWITCHES = 150
const BUDGET_MS = 200

function hex(n: number): string {
  return n.toString(16).padStart(4, '0')
}

function largeLab(): LabDef {
  const devices: DeviceDef[] = []
  const links: LinkDef[] = []
  const initialConfig: Record<string, string> = {}
  const initialPcs: LabDef['initialPcs'] = {}
  for (let i = 0; i < SWITCHES; i++) {
    devices.push({
      id: `SW${i}`, kind: 'switch', model: 'WS-C2960-24TT-L', mac: `5254.0100.${hex(i)}`,
      ports: ports('Fa0/1-2', 'Gi0/1-2'), x: 0, y: 0,
    })
    devices.push({ id: `PC${i}`, kind: 'pc', mac: `0050.7966.${hex(i)}`, x: 0, y: 0 })
    links.push({ a: [`PC${i}`, 'eth0'], b: [`SW${i}`, 'FastEthernet0/1'] })
    links.push({ a: [`SW${i}`, 'GigabitEthernet0/1'], b: [`SW${(i + 1) % SWITCHES}`, 'GigabitEthernet0/2'] })
    const vlan = i % 2 === 0 ? 10 : 20
    initialConfig[`SW${i}`] = [
      'vlan 10', 'vlan 20', 'exit',
      'interface range gi0/1 - 2', 'switchport mode trunk', 'exit',
      'interface fa0/1', 'switchport mode access', `switchport access vlan ${vlan}`, 'exit',
    ].join('\n')
    initialPcs[`PC${i}`] = { ip: `10.${vlan}.${Math.floor(i / 250)}.${(i % 250) + 1}`, prefix: 16, gw: null }
  }
  return {
    id: 'aglab-l0-300', title: 'L0 bütçe topolojisi', summary: '', level: 'İleri', tags: [], brief: [],
    devices, links, initialConfig, initialPcs, objectives: [], solution: {}, view: { w: 100, h: 100 },
  }
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]!
}

describe('300 cihazlık topoloji', () => {
  const lab = largeLab()
  const rt = createLab(lab)

  it('topoloji doğru türetiliyor (aynı VLAN erişir, farklı VLAN erişmez, halkada bir blok)', () => {
    expect(lab.devices.length).toBe(300)
    const q = new LabQuery(rt.derived, rt.startup)
    expect(q.ping('PC0', rt.pcs['PC2']!.ip!).ok).toBe(true)
    expect(q.ping('PC0', rt.pcs['PC1']!.ip!).ok).toBe(false)
    const blocked = Object.values(rt.derived.stp[10] ?? {}).flatMap((b) =>
      Object.values(b.ports).filter((p) => p.state === 'BLK'),
    )
    expect(blocked.length).toBe(1)
  })

  it(`tek computeState() ortancası ${BUDGET_MS} ms altında`, () => {
    computeState(rt.topo, rt.running, rt.pcs, rt.errdis) // ısınma
    const samples: number[] = []
    for (let n = 0; n < 5; n++) {
      const t0 = performance.now()
      computeState(rt.topo, rt.running, rt.pcs, rt.errdis)
      samples.push(performance.now() - t0)
    }
    const result = {
      devices: lab.devices.length,
      links: lab.links.length,
      samples_ms: samples.map((v) => Math.round(v * 10) / 10),
      median_ms: Math.round(median(samples) * 10) / 10,
      budget_ms: BUDGET_MS,
      node: process.version,
    }
    const out = process.env.AGLAB_TEST_ARTIFACT_DIR
    if (out) {
      mkdirSync(out, { recursive: true })
      writeFileSync(join(out, 'sim-performance.json'), JSON.stringify(result, null, 2) + '\n')
    }
    console.log('SIM_PERFORMANCE ' + JSON.stringify(result))
    expect(result.median_ms).toBeLessThan(BUDGET_MS)
  })
})
