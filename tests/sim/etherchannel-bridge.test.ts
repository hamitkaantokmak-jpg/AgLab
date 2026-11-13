// EtherChannel AğLab modelinde: üye portta `channelGroup {id, mode}`, switch'te `po<N>`
// Port-channel arayüzü. Köprü iki yönde; toAglab → toLabber gidiş-dönüşünde
// `show etherchannel summary` ve LabQuery.etherchannel aynı kalmalı.
import { describe, expect, it } from 'vitest'
import { createRuntime, toAglab, toLabber } from '../../src/sim-bridge/bridge'
import type { AglabTopology } from '../../src/sim-bridge/aglab'
import { runScript } from '../../src/sim/index'
import type { LabRuntime } from '../../src/sim/runtime'

const ports = ['fa0/1', 'fa0/2', 'fa0/23', 'fa0/24', 'gi0/1', 'gi0/2']
const sw = (id: string) => ({
  id, name: id.toUpperCase(), type: 'Switch', x: 0, y: 0, enabled: true, vlans: [1, 10], ports,
  interfaces: { 'fa0/1': { mode: 'access', vlan: 10, enabled: true }, 'fa0/23': { mode: 'trunk', vlan: 1, allowed: [1, 10], nativeVlan: 1, enabled: true }, 'fa0/24': { mode: 'trunk', vlan: 1, allowed: [1, 10], nativeVlan: 1, enabled: true } },
})
const pc = (id: string, ip: string) => ({ id, name: id.toUpperCase(), type: 'PC', x: 0, y: 0, enabled: true, ip, mask: '255.255.255.0', gateway: '', ports: ['eth0'], interfaces: { eth0: { enabled: true } } })
function topo(): AglabTopology {
  return {
    app: 'AgLab', version: 23,
    devices: [sw('s1'), sw('s2'), pc('p1', '192.168.10.1'), pc('p2', '192.168.10.2')],
    links: [
      { a: 's1', portA: 'fa0/23', b: 's2', portB: 'fa0/23', up: true },
      { a: 's1', portA: 'fa0/24', b: 's2', portB: 'fa0/24', up: true },
      { a: 'p1', portA: 'eth0', b: 's1', portB: 'fa0/1', up: true },
      { a: 'p2', portA: 'eth0', b: 's2', portB: 'fa0/1', up: true },
    ],
  } as unknown as AglabTopology
}
const cfg = (rt: LabRuntime, dev: string, lines: string[]) => runScript(rt, dev, ['configure terminal', ...lines, 'end'].join('\n'))
const summary = (rt: LabRuntime, dev: string) => runScript(rt, dev, 'show etherchannel summary').join('\n')
/** Labber'da kur, AğLab'a yaz, yeniden Labber'a al: iki çalışma zamanı aynı kanal durumunu göstermeli. */
function roundTrip(t: AglabTopology, rt: LabRuntime) {
  const json = toAglab(rt, t)
  const r = toLabber(json)
  expect(r.report.engineDecision, JSON.stringify(r.report.reasons)).toBe('labber')
  const again = createRuntime(r)
  for (const dev of ['s1', 's2']) expect(summary(again, dev)).toBe(summary(rt, dev))
  expect(again.query().etherchannel('s1', 1)).toEqual(rt.query().etherchannel('s1', 1))
  expect(again.query().etherchannel('s2', 1)).toEqual(rt.query().etherchannel('s2', 1))
  return { json, again }
}

describe('köprü: EtherChannel', () => {
  it('LACP kanalı kurulur; channelGroup ve po1 AğLab\'a yazılır; gidiş-dönüşte summary aynı', () => {
    const t = topo()
    const rt = createRuntime(toLabber(t))
    cfg(rt, 's1', ['interface range fa0/23 - 24', 'channel-group 1 mode active'])
    cfg(rt, 's2', ['interface range fa0/23 - 24', 'channel-group 1 mode passive'])
    expect(rt.query().etherchannel('s1', 1)).toEqual({ up: true, protocol: 'LACP', bundled: 2 })
    expect(summary(rt, 's1')).toMatch(/1\s+Po1\(SU\)\s+LACP\s+Fa0\/23\(P\)\s+Fa0\/24\(P\)/)
    const { json, again } = roundTrip(t, rt)
    const s1 = json.devices.find((d) => d.id === 's1')!
    expect(s1.interfaces!['fa0/23']!['channelGroup']).toEqual({ id: 1, mode: 'active' })
    expect(s1.interfaces!['po1']).toEqual({ mode: 'trunk', vlan: 1, allowed: [1, 10], nativeVlan: 1, enabled: true })
    expect(again.query().ping('p1', '192.168.10.2').ok).toBe(true)
    // kanal kaldırılınca alanlar da kalkar
    cfg(rt, 's1', ['interface range fa0/23 - 24', 'no channel-group', 'exit', 'no interface port-channel 1'])
    const back = toAglab(rt, t).devices.find((d) => d.id === 's1')!
    expect(back.interfaces!['fa0/23']!['channelGroup']).toBeUndefined()
    expect(back.interfaces!['po1']).toBeUndefined()
  })

  it('izinli liste farkı olan üye askıya alınır (s); gidiş-dönüşte aynı', () => {
    const t = topo()
    const rt = createRuntime(toLabber(t))
    cfg(rt, 's1', ['interface range fa0/23 - 24', 'channel-group 1 mode on'])
    cfg(rt, 's2', ['interface range fa0/23 - 24', 'channel-group 1 mode on'])
    cfg(rt, 's1', ['interface fa0/24', 'switchport trunk allowed vlan 1'])
    expect(summary(rt, 's1')).toMatch(/Fa0\/24\(s\)/)
    expect(rt.query().etherchannel('s1', 1)!.bundled).toBe(1)
    const { json } = roundTrip(t, rt)
    expect(json.devices.find((d) => d.id === 's1')!.interfaces!['fa0/24']!.allowed).toEqual([1])
  })

  it('passive–passive kanal kurmaz; gidiş-dönüşte aynı', () => {
    const t = topo()
    const rt = createRuntime(toLabber(t))
    cfg(rt, 's1', ['interface range fa0/23 - 24', 'channel-group 1 mode passive'])
    cfg(rt, 's2', ['interface range fa0/23 - 24', 'channel-group 1 mode passive'])
    expect(rt.query().etherchannel('s1', 1)!.bundled).toBe(0)
    expect(rt.query().etherchannel('s1', 1)!.up).toBe(false)
    roundTrip(t, rt)
  })

  it('AğLab JSON\'undan kanal: po kaydı yoksa ilk üyeden oluşur (IOS gibi)', () => {
    const t = topo()
    for (const id of ['s1', 's2'])
      for (const p of ['fa0/23', 'fa0/24']) (t.devices.find((d) => d.id === id)!.interfaces![p] as Record<string, unknown>)['channelGroup'] = { id: 2, mode: id === 's1' ? 'desirable' : 'auto' }
    const r = toLabber(t)
    expect(r.report.engineDecision, JSON.stringify(r.report.reasons)).toBe('labber')
    expect(r.running['s1']!.pos['2']).toMatchObject({ mode: 'trunk', allowed: [1, 10] })
    expect(createRuntime(r).query().etherchannel('s1', 2)).toEqual({ up: true, protocol: 'PAgP', bundled: 2 })
  })

  it('geçersiz EtherChannel alanları reddedilir (motor eski motor, neden raporlanır)', () => {
    const bad: [string, (t: AglabTopology) => void, RegExp][] = [
      ['grup numarası', (t) => ((t.devices[0]!.interfaces!['fa0/23'] as Record<string, unknown>)['channelGroup'] = { id: 99, mode: 'on' }), /channelGroup/],
      ['bilinmeyen mod', (t) => ((t.devices[0]!.interfaces!['fa0/23'] as Record<string, unknown>)['channelGroup'] = { id: 1, mode: 'lacp' }), /channelGroup/],
      ['protokol uyuşmazlığı', (t) => {
        ;(t.devices[0]!.interfaces!['fa0/23'] as Record<string, unknown>)['channelGroup'] = { id: 1, mode: 'active' }
        ;(t.devices[0]!.interfaces!['fa0/24'] as Record<string, unknown>)['channelGroup'] = { id: 1, mode: 'desirable' }
      }, /protokol uyuşmazlığı/],
      ['Port-channel numarası', (t) => (t.devices[0]!.interfaces!['po60'] = { mode: 'trunk' }), /1-48/],
    ]
    for (const [name, mutate, reason] of bad) {
      const t = topo()
      mutate(t)
      const r = toLabber(t)
      expect(r.report.engineDecision, name).toBe('legacy')
      expect(r.report.reasons.join('\n'), name).toMatch(reason)
    }
    const unk = topo()
    unk.devices[0]!.interfaces!['po1'] = { mode: 'trunk', lacpRate: 'fast' } as never
    expect(toLabber(unk).report.unsupported.map((u) => u.reason).join()).toMatch(/Port-channel alanı/)
  })
})
