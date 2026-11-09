import { describe, expect, it } from 'vitest'
import { LABS, findLab } from '../../src/labs'
import { createLab, runScript } from '../../src/sim'
import type { LabRuntime } from '../../src/sim/runtime'
import type { LabDef } from '../../src/sim/types'

const ERR = /^% (Invalid|Incomplete|Ambiguous)|Command rejected|^% Bad|overlaps|Inconsistent/

function solve(def: LabDef, skip: string[] = []) {
  const rt = createLab(def)
  for (const [dev, script] of Object.entries(def.solution)) {
    if (skip.includes(dev)) continue
    const errs = runScript(rt, dev, script).filter((l) => ERR.test(l))
    expect(errs, `${def.id} ${dev}`).toEqual([])
  }
  return rt
}
const failed = (rt: LabRuntime) => rt.objectives().filter((o) => !o.ok).map((o) => o.id)
const cfg = (rt: LabRuntime, dev: string, s: string) => runScript(rt, dev, 'configure terminal\n' + s + '\nend')

describe('every lab', () => {
  it('ids are unique', () => {
    expect(new Set(LABS.map((l) => l.id)).size).toBe(LABS.length)
  })
  for (const def of LABS) {
    it(`${def.id}: not solved at start, solved by the reference solution`, () => {
      const start = createLab(def)
      expect(failed(start).length, 'some objectives must fail at start').toBeGreaterThan(0)
      expect(failed(solve(def))).toEqual([])
    })
    it(`${def.id}: devices and links are consistent`, () => {
      const ids = new Set(def.devices.map((d) => d.id))
      for (const l of def.links) {
        for (const [dev, port] of [l.a, l.b]) {
          expect(ids.has(dev), dev).toBe(true)
          const d = def.devices.find((x) => x.id === dev)!
          if (d.kind === 'switch') expect(d.ports, `${dev} ${port}`).toContain(port)
          else expect(port).toBe('eth0')
        }
      }
      for (const d of def.devices) {
        expect(d.x).toBeGreaterThanOrEqual(0)
        expect(d.x).toBeLessThanOrEqual(def.view.w)
        expect(d.y).toBeLessThanOrEqual(def.view.h)
      }
    })
  }
})

describe('vlan basics', () => {
  it('same subnet, different VLAN: no ping', () => {
    const def = findLab('vlan-temelleri')!
    const start = createLab(def)
    expect(start.objectives().find((o) => o.id === 'isolated')!.ok).toBe(false)
    const rt = solve(def)
    cfg(rt, 'SW1', 'interface fa0/3\nswitchport access vlan 10')
    expect(failed(rt)).toEqual(expect.arrayContaining(['access', 'isolated']))
  })
})

describe('trunk hardening', () => {
  it('nonegotiate is rejected in dynamic mode', () => {
    const rt = createLab(findLab('trunk-guvenligi')!)
    expect(cfg(rt, 'SW1', 'interface gi0/1\nswitchport nonegotiate').join('\n')).toContain("Conflict between 'nonegotiate' and 'dynamic'")
  })
  it('auto/auto link is not a trunk at start', () => {
    const rt = createLab(findLab('trunk-guvenligi')!)
    expect(rt.derived.lportByName['SW1|GigabitEthernet0/1']!.opMode).toBe('access')
  })
})

describe('stp load balancing', () => {
  const def = findLab('stp-yuk-dengeleme')!
  it('ASW1 is root at start (lowest MAC)', () => {
    const rt = createLab(def)
    expect(rt.derived.stp[10]!['ASW1']!.isRoot).toBe(true)
  })
  it('without secondary roots the load balancing breaks', () => {
    const rt = solve(def)
    cfg(rt, 'DSW2', 'no spanning-tree vlan 10 priority')
    expect(failed(rt)).toEqual(expect.arrayContaining(['secondary', 'balance']))
  })
})

describe('etherchannel troubleshoot', () => {
  const def = findLab('etherchannel-ariza')!
  it('start state: passive/passive and LACP vs PAgP are stand-alone, mismatched member', () => {
    const rt = createLab(def)
    const sw1 = rt.derived.ec['SW1']!
    expect(sw1.find((g) => g.id === 1)!.members.map((m) => m.flag)).toEqual(['I', 'I'])
    // pings work over individual trunks
    expect(rt.objectives().find((o) => o.id === 'ping')!.ok).toBe(true)
  })
  it('protocol change without removing the group first is rejected', () => {
    const rt = createLab(def)
    const out = cfg(rt, 'SW3', 'interface range gi0/1 - 2\nchannel-group 2 mode active').join('\n')
    expect(out).toContain('Channel protocol mismatch')
  })
  it('fixing modes but not the member config leaves Gi0/4 suspended', () => {
    const rt = solve(def)
    cfg(rt, 'SW1', 'interface gi0/4\nswitchport trunk allowed vlan 10')
    const g = rt.derived.ec['SW1']!.find((x) => x.id === 2)!
    expect(g.members.find((m) => m.port === 'GigabitEthernet0/4')!.flag).toBe('s')
    expect(failed(rt)).toEqual(expect.arrayContaining(['po2', 'nostray']))
  })
})

describe('l3 static routing', () => {
  const def = findLab('l3-statik-route')!
  it('missing return route breaks end to end only', () => {
    const rt = solve(def)
    cfg(rt, 'SW2', 'no ip route 192.168.10.0 255.255.255.0 10.0.100.1')
    expect(failed(rt)).toEqual(['default', 'e2e'])
  })
  it('ttl shows two routed hops', () => {
    const rt = solve(def)
    const r = rt.objectives()
    expect(r.every((o) => o.ok)).toBe(true)
    const out = runScript(rt, 'SW1', 'show ip route').join('\n')
    expect(out).toContain('S*    0.0.0.0/0 [1/0] via 10.0.100.2')
  })
  it('/30 network address is rejected on an SVI', () => {
    const rt = createLab(def)
    expect(cfg(rt, 'SW1', 'interface vlan 100\nip address 10.0.100.0 255.255.255.252').join('\n')).toContain('Bad mask /30')
  })
})

describe('mgmt vlan', () => {
  const def = findLab('yonetim-vlan')!
  it('without ip default-gateway the switch answers only its own VLAN', () => {
    const rt = solve(def)
    cfg(rt, 'ASW2', 'no ip default-gateway')
    expect(failed(rt)).toEqual(expect.arrayContaining(['gateway', 'saved']))
    expect(rt.objectives().find((o) => o.id === 'local')!.ok).toBe(true)
  })
  it('changes after saving clear the saved objective', () => {
    const rt = solve(def)
    cfg(rt, 'ASW1', 'hostname X1')
    expect(failed(rt)).toEqual(expect.arrayContaining(['hostname', 'saved']))
  })
})

describe('ospf single area', () => {
  const def = findLab('ospf-tek-alan')!
  it('ip address is rejected on an L2 port', () => {
    const rt = createLab(def)
    expect(cfg(rt, 'R1', 'interface gi0/1\nip address 10.0.12.1 255.255.255.252').join('\n')).toContain('may not be configured on L2 links')
  })
  it('router-id change with neighbours needs clear ip ospf process', () => {
    const rt = solve(def)
    expect(cfg(rt, 'R1', 'router ospf 1\nrouter-id 9.9.9.9').join('\n')).toContain('clear ip ospf process')
    expect(rt.derived.ospf['R1']!.rid).toBe('1.1.1.1')
    runScript(rt, 'R1', 'clear ip ospf process\nyes')
    expect(rt.derived.ospf['R1']!.rid).toBe('9.9.9.9')
    expect(failed(rt)).toEqual(['rid'])
  })
  it('loopbacks are /32 routes, LAN stays advertised when passive', () => {
    const rt = solve(def)
    const r1 = runScript(rt, 'R1', 'show ip route ospf').join('\n')
    expect(r1).toContain('O        2.2.2.2/32 [110/2] via 10.0.12.2')
    expect(r1).toContain('192.168.3.0/24 [110/2] via 10.0.13.2')
    // R1-R3 link down: R1 reaches 192.168.3.0 through R2 (cost 3)
    cfg(rt, 'R3', 'interface gi0/1\nshutdown')
    expect(rt.objectives().find((o) => o.id === 'e2e')!.ok).toBe(true)
    expect(runScript(rt, 'R1', 'show ip route 192.168.3.0').join('\n')).toContain('metric 3, type intra area')
  })
  it('no ip routing removes the OSPF process', () => {
    const rt = solve(def)
    cfg(rt, 'R2', 'no ip routing')
    expect(rt.running['R2']!.ospf).toBeNull()
    expect(failed(rt)).toEqual(expect.arrayContaining(['adj', 'e2e']))
  })
})

describe('routed access block', () => {
  const def = findLab('routed-erisim-blogu')!
  it('starts as an L2 block with a blocked uplink', () => {
    const rt = createLab(def)
    expect(failed(rt)).toEqual(expect.arrayContaining(['routed', 'nostp', 'ecmp']))
    expect(rt.objectives().find((o) => o.id === 'nostp')!.detail).toContain('ASW1 GigabitEthernet0/2 (VLAN 10)')
  })
  it('broadcast network type still elects a DR', () => {
    const rt = solve(def)
    cfg(rt, 'ASW1', 'interface gi0/1\nno ip ospf network')
    cfg(rt, 'DSW1', 'interface gi0/1\nno ip ospf network')
    expect(failed(rt)).toEqual(['p2p'])
  })
  it('losing one uplink leaves one path and connectivity', () => {
    const rt = solve(def)
    cfg(rt, 'ASW1', 'interface gi0/1\nshutdown')
    expect(failed(rt)).toEqual(expect.arrayContaining(['ecmp']))
    expect(rt.objectives().find((o) => o.id === 'e2e')!.ok).toBe(true)
  })
})

describe('bpdu guard', () => {
  const def = findLab('bpdu-guard')!
  const ed = (rt: ReturnType<typeof createLab>, p: string) => rt.derived.phys['ASW1|' + p]!.errDisabled
  it('starts with the uplink err-disabled and ROGUE as root', () => {
    const rt = createLab(def)
    expect(ed(rt, 'GigabitEthernet0/2')).toBe(true)
    expect(rt.derived.stp[10]!['ROGUE']!.isRoot).toBe(true)
  })
  it('err-disable is sticky until shutdown / no shutdown', () => {
    const rt = createLab(def)
    cfg(rt, 'ASW1', 'interface gi0/2\nno spanning-tree portfast\nno spanning-tree bpduguard')
    expect(ed(rt, 'GigabitEthernet0/2')).toBe(true)
    cfg(rt, 'ASW1', 'interface gi0/2\nshutdown\nno shutdown')
    expect(ed(rt, 'GigabitEthernet0/2')).toBe(false)
  })
  it('recovery brings back fixed ports only', () => {
    const rt = createLab(def)
    cfg(rt, 'ASW1', 'errdisable recovery cause bpduguard\ninterface fa0/3\nspanning-tree bpduguard enable')
    expect(ed(rt, 'FastEthernet0/3')).toBe(true)
    cfg(rt, 'ASW1', 'interface gi0/2\nno spanning-tree bpduguard')
    expect(ed(rt, 'GigabitEthernet0/2')).toBe(false)
    expect(ed(rt, 'FastEthernet0/3')).toBe(true)
  })
  it('global bpduguard default only covers PortFast ports', () => {
    const rt = createLab(def)
    cfg(rt, 'ASW1', 'spanning-tree portfast bpduguard default')
    expect(ed(rt, 'FastEthernet0/3')).toBe(false)
    cfg(rt, 'ASW1', 'interface fa0/3\nspanning-tree portfast')
    expect(ed(rt, 'FastEthernet0/3')).toBe(true)
  })
})

describe('ospf troubleshooting', () => {
  const def = findLab('ospf-ariza')!
  it('start: hello mismatch hides the neighbour, MTU mismatch sticks in EXSTART', () => {
    const rt = createLab(def)
    const o = rt.derived.ospf
    expect(o['R1']!.nbrs.map((n) => [n.rid, n.state])).toEqual([['3.3.3.3', 'EXSTART']])
    expect(o['R2']!.nbrs).toEqual([])
    expect(o['R2']!.mismatches.map((m) => m.kind).sort()).toEqual(['area', 'hello'])
  })
  it('reference bandwidth on one router only keeps the slow path', () => {
    const rt = solve(def, ['R1'])
    expect(failed(rt)).toEqual(expect.arrayContaining(['refbw']))
    cfg(rt, 'R1', 'router ospf 1\nauto-cost reference-bandwidth 10000')
    expect(failed(rt)).toEqual([])
    expect(runScript(rt, 'R1', 'show ip route 192.168.3.0').join('\n')).toContain('* 10.0.12.2, 00:12:34 ago, via GigabitEthernet0/1')
  })
  it('dead interval mismatch also blocks the adjacency', () => {
    const rt = solve(def)
    cfg(rt, 'R2', 'interface gi0/1\nip ospf dead-interval 30')
    // the gigabit path is gone too, so R1 falls back to the FastEthernet link
    expect(failed(rt)).toEqual(['r1r2', 'path'])
    expect(rt.objectives().find((o) => o.id === 'e2e')!.ok).toBe(true)
  })
})

describe('ospf multi-area', () => {
  const def = findLab('ospf-cok-alan')!
  it('stub flag on one side only drops the adjacency', () => {
    const rt = solve(def)
    cfg(rt, 'R2', 'router ospf 1\nno area 1 stub')
    expect(rt.derived.ospf['R1']!.mismatches.map((m) => m.kind)).toEqual(['stub'])
    expect(failed(rt)).toEqual(expect.arrayContaining(['area1', 'e2e']))
  })
  it('plain stub area keeps inter-area routes but no externals', () => {
    const rt = solve(def)
    cfg(rt, 'R2', 'router ospf 1\nno area 1 stub no-summary')
    const codes = rt.derived.ospf['R1']!.routes.map((r) => `${r.code} ${r.net}/${r.prefix}`)
    expect(codes).toEqual(expect.arrayContaining(['O IA 0.0.0.0/0', 'O IA 192.168.3.0/24', 'O IA 2.2.2.2/32']))
    expect(codes.some((c) => c.startsWith('O E2'))).toBe(false)
    expect(failed(rt)).toEqual(['stub'])
  })
  it('non-stub area 1 learns the default as O*E2', () => {
    const rt = solve(def)
    cfg(rt, 'R1', 'router ospf 1\nno area 1 stub')
    cfg(rt, 'R2', 'router ospf 1\nno area 1 stub')
    expect(rt.derived.ospf['R1']!.routes.find((r) => r.prefix === 0)!.code).toBe('O E2')
    expect(rt.objectives().find((o) => o.id === 'e2e')!.ok).toBe(true)
  })
  it('default-information originate needs a default route unless always', () => {
    const rt = solve(def)
    cfg(rt, 'R3', 'no ip route 0.0.0.0 0.0.0.0 203.0.113.1')
    expect(rt.derived.ospf['R3']!.asbr).toBe(false)
    cfg(rt, 'R3', 'router ospf 1\ndefault-information originate always')
    expect(rt.derived.ospf['R3']!.asbr).toBe(true)
  })
})
