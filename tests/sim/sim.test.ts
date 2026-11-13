import { describe, expect, it } from 'vitest'
import campus from './fixtures/campus-l2-l3'
import trouble from './fixtures/trunk-troubleshoot'
import { createLab, createSession, IosSession, runScript, VpcsSession } from '../../src/sim'
import type { LabRuntime } from '../../src/sim/runtime'

const solved = (lab = campus) => {
  const rt = createLab(lab)
  for (const [dev, script] of Object.entries(lab.solution)) {
    const out = runScript(rt, dev, script)
    const errs = out.filter((l) => /^% (Invalid|Incomplete|Ambiguous)|Command rejected/.test(l))
    expect(errs, `${dev} solution errors`).toEqual([])
  }
  return rt
}
const passed = (rt: LabRuntime) => rt.objectives().filter((o) => o.ok).map((o) => o.id)
const failed = (rt: LabRuntime) => rt.objectives().filter((o) => !o.ok).map((o) => o.id)
const cfg = (rt: LabRuntime, dev: string, script: string) => runScript(rt, dev, 'configure terminal\n' + script + '\nend')
const pcPing = (rt: LabRuntime, pc: string, ip: string) => (createSession(rt, pc) as VpcsSession).exec('ping ' + ip).join('\n')

describe('campus lab', () => {
  it('starts with no objective met', () => {
    const rt = createLab(campus)
    expect(passed(rt)).toEqual([])
  })

  it('reference solution meets all objectives', () => {
    const rt = solved()
    expect(failed(rt)).toEqual([])
  })

  it('removing VLAN 20 from SW3 trunks breaks only VLAN 20', () => {
    const rt = solved()
    cfg(rt, 'SW3', 'interface range gi0/1 - 2\nswitchport trunk allowed vlan remove 20')
    expect(failed(rt)).toContain('ping20')
    expect(passed(rt)).toContain('ping10')
  })

  it('native mismatch is detected and logged', () => {
    const rt = solved()
    cfg(rt, 'SW3', 'interface gi0/2\nswitchport trunk native vlan 1')
    expect(failed(rt)).toContain('native')
    expect(rt.logs.some((l) => l.text.includes('NATIVE_VLAN_MISMATCH'))).toBe(true)
  })

  it('channel mode on vs active suspends the bundle', () => {
    const rt = solved()
    cfg(rt, 'SW2', 'interface range gi0/1 - 2\nno channel-group\nchannel-group 1 mode on')
    expect(failed(rt)).toContain('po1')
    const ec = rt.derived.ec['SW2']!.find((g) => g.id === 1)!
    expect(ec.members.every((m) => m.flag === 's')).toBe(true)
    const sum = runScript(rt, 'SW1', 'show etherchannel summary').join('\n')
    expect(sum).toMatch(/Po1\(SD\)/)
  })

  it('mixing LACP and PAgP in a group is rejected', () => {
    const rt = solved()
    const out = cfg(rt, 'SW2', 'interface gi0/2\nchannel-group 1 mode desirable').join('\n')
    expect(out).toContain('Channel protocol mismatch')
  })

  it('wrong access VLAN breaks the PC ping', () => {
    const rt = solved()
    cfg(rt, 'SW2', 'interface fa0/1\nswitchport access vlan 20')
    expect(failed(rt)).toEqual(expect.arrayContaining(['access', 'ping10']))
  })

  it('removing the SVI breaks inter-VLAN but not intra-VLAN', () => {
    const rt = solved()
    cfg(rt, 'SW1', 'no interface vlan 20')
    expect(failed(rt)).toContain('intervlan')
    expect(passed(rt)).toEqual(expect.arrayContaining(['ping10', 'ping20']))
  })

  it('no ip routing stops L3', () => {
    const rt = solved()
    cfg(rt, 'SW1', 'no ip routing')
    expect(failed(rt)).toEqual(['intervlan'])
  })

  it('deleting VLAN 10 on SW3 makes PC2 unreachable', () => {
    const rt = solved()
    cfg(rt, 'SW3', 'no vlan 10')
    expect(failed(rt)).toEqual(expect.arrayContaining(['vlans', 'access', 'ping10']))
    expect(runScript(rt, 'SW3', 'show interfaces status').join('\n')).toMatch(/Fa0\/1\s+inactive/)
  })

  it('without SW1 priority SW2 is root (lowest MAC)', () => {
    const rt = solved()
    cfg(rt, 'SW1', 'no spanning-tree vlan 10,20 priority')
    expect(failed(rt)).toEqual(['root'])
    expect(rt.derived.stp[10]!['SW2']!.isRoot).toBe(true)
  })

  it('STP roles with SW1 as root', () => {
    const rt = solved()
    const sw3 = rt.derived.stp[10]!['SW3']!
    expect(sw3.rootPort).toBe('GigabitEthernet0/1')
    expect(sw3.ports['GigabitEthernet0/2']).toMatchObject({ role: 'Altn', state: 'BLK' })
    expect(rt.derived.stp[10]!['SW2']!.ports['GigabitEthernet0/3']).toMatchObject({ role: 'Desg', state: 'FWD' })
    expect(rt.derived.stp[10]!['SW2']!.ports['Port-channel1']).toMatchObject({ role: 'Root', cost: 3 })
  })

  it('dynamic auto on both ends stays access', () => {
    const rt = createLab(campus)
    const lp = rt.derived.lportByName['SW1|GigabitEthernet0/3']!
    expect(lp.opMode).toBe('access')
    cfg(rt, 'SW3', 'interface gi0/1\nswitchport mode dynamic desirable')
    expect(rt.derived.lportByName['SW1|GigabitEthernet0/3']!.opMode).toBe('trunk')
  })

  it('3560 rejects trunk mode without encapsulation', () => {
    const rt = createLab(campus)
    const out = cfg(rt, 'SW1', 'interface gi0/3\nswitchport mode trunk').join('\n')
    expect(out).toContain('trunk encapsulation is "Auto"')
  })

  it('PC ping output, ttl across one router', () => {
    const rt = solved()
    expect(pcPing(rt, 'PC1', '192.168.20.12')).toContain('ttl=63')
    expect(pcPing(rt, 'PC1', '192.168.10.12')).toContain('ttl=64')
    cfg(rt, 'SW1', 'no ip routing')
    expect(pcPing(rt, 'PC1', '192.168.20.12')).toContain('timeout')
  })

  it('IOS ping to its own address needs no ARP (I-1 motor bulgusu)', () => {
    const rt = solved()
    const s = new IosSession(rt, 'SW1')
    s.mode = 'priv'
    const own = rt.running['SW1']!.svis['1']?.ip?.addr ?? Object.values(rt.running['SW1']!.svis).find((v) => v.ip)?.ip?.addr
    if (own) expect(s.exec('ping ' + own).join('\n')).toContain('!!!!!')
  })

  it('IOS ping loses the first packet to ARP once', () => {
    const rt = solved()
    const s = new IosSession(rt, 'SW1')
    s.mode = 'priv'
    expect(s.exec('ping 192.168.10.11').join('\n')).toContain('.!!!!')
    expect(s.exec('ping 192.168.10.11').join('\n')).toContain('!!!!!')
  })

  it('reload restores saved config', () => {
    const rt = solved()
    const s = new IosSession(rt, 'SW1')
    s.mode = 'priv'
    runScript(rt, 'SW1', 'configure terminal\nhostname CORE\nend', s)
    expect(s.prompt()).toBe('CORE#')
    s.exec('reload')
    expect(s.prompt()).toMatch(/Save\?/)
    s.exec('no')
    s.exec('')
    expect(rt.running['SW1']!.hostname).toBe('SW1')
  })

  it('save/load round trip', () => {
    const rt = solved()
    const snap = JSON.parse(JSON.stringify(rt.save()))
    const rt2 = createLab(campus)
    expect(rt2.load(snap)).toBe(true)
    expect(failed(rt2)).toEqual([])
  })
})

describe('cli', () => {
  const s = () => {
    const rt = createLab(campus)
    const x = new IosSession(rt, 'SW2')
    x.mode = 'priv'
    return x
  }

  it('abbreviations work', () => {
    const x = s()
    expect(x.exec('sh vl br').join('\n')).toContain('VLAN Name')
    x.exec('conf t')
    expect(x.prompt()).toBe('SW2(config)#')
    x.exec('int fa0/1')
    expect(x.prompt()).toBe('SW2(config-if)#')
    x.exec('sw mo acc')
    expect(x.cfg.ifaces['FastEthernet0/1']!.mode).toBe('access')
  })

  it('invalid input caret points at the bad word', () => {
    const x = s()
    const out = x.exec('show vlna')
    expect(out[0]).toBe(' '.repeat('SW2#show '.length) + '^')
    expect(out[1]).toContain("Invalid input detected at '^' marker.")
  })

  it('ambiguous and incomplete', () => {
    const x = s()
    expect(x.exec('c')[0]).toContain('% Ambiguous command')
    expect(x.exec('show')[0]).toBe('% Incomplete command.')
  })

  it('help and tab completion', () => {
    const x = s()
    expect(x.help('show sp').join('')).toContain('spanning-tree')
    expect(x.help('show ').join('\n')).toMatch(/vlan\s+VTP VLAN status/)
    expect(x.complete('sh run')).toBe('sh running-config ')
    x.exec('conf t')
    expect(x.help('interface gi0').join('\n')).toContain('Interface number')
  })

  it('pipe filters', () => {
    const x = s()
    const out = x.exec('show running-config | include hostname')
    expect(out).toEqual(['hostname SW2'])
    const sec = x.exec('show run | section interface GigabitEthernet0/1')
    expect(sec[0]).toBe('interface GigabitEthernet0/1')
  })

  it('global command from interface mode drops to config', () => {
    const x = s()
    x.exec('conf t')
    x.exec('int fa0/1')
    x.exec('vlan 50')
    expect(x.prompt()).toBe('SW2(config-vlan)#')
    x.exec('do show vlan brief')
    expect(x.prompt()).toBe('SW2(config-vlan)#')
  })

  it('interface status columns stay separated', () => {
    const x = s()
    const lines = x.exec('show interfaces status')
    expect(lines.find((l) => l.startsWith('Gi0/1'))).toMatch(/a-full\s+a-1000 10\/100\/1000BaseTX/)
  })
})

describe('troubleshoot lab', () => {
  it('starts broken, solution fixes everything', () => {
    const rt = createLab(trouble)
    expect(passed(rt)).toEqual([])
    const done = solved(trouble)
    expect(failed(done)).toEqual([])
  })
})
