// L5-c: IPv4 ACL (standart, genişletilmiş, isimli). Başarısız durumlar: örtük deny, yanlış
// yön, yanlış wildcard, sıra hatası; router'ın kendi trafiği giden ACL'e takılmaz.
import { describe, expect, it } from 'vitest'
import { createLab, createSession, runScript, type VpcsSession } from '../../src/sim'
import type { LabRuntime } from '../../src/sim/runtime'
import type { LabDef } from '../../src/sim/types'
import { ports } from '../../src/sim/util'

/** H1 .10, H3 .11 — SW1 — R1 g0/0 192.168.1.1 ; R1 g0/1 10.0.0.1/30 — R2 g0/1 ; R2 g0/0 192.168.2.1 — H2 .20 */
function lab(r1: string[] = [], r2: string[] = []): LabDef {
  const r = (id: string, n: number) => ({ id, kind: 'switch' as const, router: true, model: 'ISR4331', mac: `5254.00${n}0.0000`, ports: ports('Gi0/0-1'), x: 0, y: 0 })
  return {
    id: 'l5c', title: '', summary: '', level: 'Orta', tags: [], brief: [], objectives: [], solution: {}, view: { w: 1, h: 1 },
    devices: [
      r('R1', 1), r('R2', 2),
      { id: 'SW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0030.0000', ports: [...ports('Fa0/1-3'), ...ports('Gi0/1-2')], x: 0, y: 0 },
      { id: 'H1', kind: 'pc', mac: '0050.0000.0010', x: 0, y: 0 },
      { id: 'H3', kind: 'pc', mac: '0050.0000.0030', x: 0, y: 0 },
      { id: 'H2', kind: 'pc', mac: '0050.0000.0020', x: 0, y: 0 },
    ],
    links: [
      { a: ['H1', 'eth0'], b: ['SW1', 'FastEthernet0/1'] },
      { a: ['H3', 'eth0'], b: ['SW1', 'FastEthernet0/2'] },
      { a: ['SW1', 'GigabitEthernet0/1'], b: ['R1', 'GigabitEthernet0/0'] },
      { a: ['R1', 'GigabitEthernet0/1'], b: ['R2', 'GigabitEthernet0/1'] },
      { a: ['R2', 'GigabitEthernet0/0'], b: ['H2', 'eth0'] },
    ],
    initialConfig: {
      SW1: 'interface range fa0/1 - 2\nswitchport mode access\ninterface gi0/1\nswitchport mode access',
      R1: ['interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.0.1 255.255.255.252', 'no shutdown', 'exit', 'ip route 192.168.2.0 255.255.255.0 10.0.0.2', ...r1].join('\n'),
      R2: ['interface g0/0', 'ip address 192.168.2.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 10.0.0.2 255.255.255.252', 'no shutdown', 'exit', 'ip route 192.168.1.0 255.255.255.0 10.0.0.1', ...r2].join('\n'),
    },
    initialPcs: {
      H1: { ip: '192.168.1.10', prefix: 24, gw: '192.168.1.1' },
      H3: { ip: '192.168.1.11', prefix: 24, gw: '192.168.1.1' },
      H2: { ip: '192.168.2.20', prefix: 24, gw: '192.168.2.1' },
    },
  }
}
const ping = (rt: LabRuntime, from: string, ip: string) => /bytes from/.test((createSession(rt, from) as VpcsSession).exec('ping ' + ip).join('\n'))
const run = (rt: LabRuntime, dev: string, line: string) => runScript(rt, dev, line).slice(1).join('\n')
const cfg = (rt: LabRuntime, dev: string, script: string) => runScript(rt, dev, 'configure terminal\n' + script + '\nend').join('\n')

describe('standart ACL', () => {
  it('çıkışta host engeli: H1 → H2 düşer, H3 geçer; sayaçlar ve show çıktıları', () => {
    const rt = createLab(lab([], ['access-list 10 deny host 192.168.1.10', 'access-list 10 permit any', 'interface g0/0', 'ip access-group 10 out']))
    expect(ping(rt, 'H1', '192.168.2.20')).toBe(false)
    expect(ping(rt, 'H3', '192.168.2.20')).toBe(true)
    expect(run(rt, 'R2', 'show access-lists')).toBe('Standard IP access list 10\n    10 deny   192.168.1.10 (5 matches)\n    20 permit any (5 matches)')
    expect(run(rt, 'R2', 'show ip interface g0/0')).toContain('  Outgoing access list is 10\n  Inbound Common access list is not set\n  Inbound  access list is not set')
    expect(run(rt, 'R2', 'show running-config')).toContain('access-list 10 deny   192.168.1.10\naccess-list 10 permit any')
    expect(run(rt, 'R2', 'show running-config')).toContain(' ip access-group 10 out')
    runScript(rt, 'R2', 'clear access-list counters')
    expect(run(rt, 'R2', 'show access-lists 10')).not.toContain('match')
  })

  it('örtük deny: yalnız permit satırı olan liste diğer herkesi engeller', () => {
    const rt = createLab(lab([], ['access-list 20 permit host 192.168.1.11', 'interface g0/0', 'ip access-group 20 out']))
    expect(ping(rt, 'H3', '192.168.2.20')).toBe(true)
    expect(ping(rt, 'H1', '192.168.2.20')).toBe(false)
    expect(run(rt, 'R2', 'show access-lists')).toBe('Standard IP access list 20\n    10 permit 192.168.1.11 (5 matches)')
  })

  it('yanlış yön: H2 tarafına inbound uygulanınca H1 trafiği süzülmez', () => {
    const rt = createLab(lab([], ['access-list 10 deny host 192.168.1.10', 'access-list 10 permit any', 'interface g0/0', 'ip access-group 10 in']))
    expect(ping(rt, 'H1', '192.168.2.20')).toBe(true)
    cfg(rt, 'R2', 'interface g0/0\nno ip access-group 10 in\nip access-group 10 out')
    expect(ping(rt, 'H1', '192.168.2.20')).toBe(false)
  })

  it('yanlış wildcard: 0.0.0.0 tek adresi tutar, ağı değil', () => {
    const rt = createLab(lab([], ['access-list 30 deny 192.168.1.0 0.0.0.0', 'access-list 30 permit any', 'interface g0/0', 'ip access-group 30 out']))
    expect(ping(rt, 'H1', '192.168.2.20')).toBe(true)
    cfg(rt, 'R2', 'no access-list 30\naccess-list 30 deny 192.168.1.0 0.0.0.255\naccess-list 30 permit any')
    expect(ping(rt, 'H1', '192.168.2.20')).toBe(false)
    // wildcard bitleri adresten silinir (IOS)
    cfg(rt, 'R2', 'access-list 31 permit 192.168.1.77 0.0.0.255')
    expect(run(rt, 'R2', 'show access-lists 31')).toContain('10 permit 192.168.1.0, wildcard bits 0.0.0.255')
  })

  it('sıra hatası: genel permit özel deny\'den önce; isimli listede sıra numarasıyla düzeltilir', () => {
    const rt = createLab(lab([], ['ip access-list standard GUEST', 'permit any', 'deny host 192.168.1.10', 'exit', 'interface g0/0', 'ip access-group GUEST out']))
    expect(ping(rt, 'H1', '192.168.2.20')).toBe(true)
    cfg(rt, 'R2', 'ip access-list standard GUEST\n5 deny host 192.168.1.10')
    expect(ping(rt, 'H1', '192.168.2.20')).toBe(false)
    expect(ping(rt, 'H3', '192.168.2.20')).toBe(true)
    expect(run(rt, 'R2', 'show access-lists GUEST')).toMatch(/^Standard IP access list GUEST\n    5 deny   192\.168\.1\.10 \(5 matches\)\n    10 permit any \(10 matches\)\n    20 deny   192\.168\.1\.10$/)
    cfg(rt, 'R2', 'ip access-list standard GUEST\nno 20')
    expect(run(rt, 'R2', 'show running-config')).toContain('ip access-list standard GUEST\n deny   192.168.1.10\n permit any')
  })
})

describe('genişletilmiş ACL', () => {
  it('protokol ve ICMP türü: echo engeli ping\'i keser, tcp/udp satırları IOS biçiminde', () => {
    const rt = createLab(lab(['access-list 101 deny icmp host 192.168.1.10 host 192.168.2.20 echo', 'access-list 101 permit tcp any host 192.168.2.20 eq www', 'access-list 101 permit udp any any range 1000 2000', 'access-list 101 permit ip any any', 'interface g0/0', 'ip access-group 101 in']))
    expect(ping(rt, 'H1', '192.168.2.20')).toBe(false)
    expect(ping(rt, 'H3', '192.168.2.20')).toBe(true)
    const out = run(rt, 'R1', 'show access-lists 101')
    expect(out).toContain('10 deny   icmp host 192.168.1.10 host 192.168.2.20 echo (5 matches)')
    expect(out).toContain('20 permit tcp any host 192.168.2.20 eq www')
    expect(out).toContain('30 permit udp any any range 1000 2000')
    expect(out).toContain('40 permit ip any any (5 matches)')
  })

  it('isimli genişletilmiş liste ve traceroute !A', () => {
    const rt = createLab(lab([], ['ip access-list extended NOUDP', 'deny udp any any', 'permit ip any any', 'exit', 'interface g0/1', 'ip access-group NOUDP in']))
    expect(ping(rt, 'H1', '192.168.2.20')).toBe(true)
    // L5-i: TTL'li sondalar: TTL 1 sondası R2'nin giriş ACL'ine takılır → 1. atlamada !A (önceki
    // kısayol R2'yi ayrı bir atlama sayıp !A'yı 2. satıra yazıyordu); IOS numarayı 3 sütuna yaslar
    const tr = run(rt, 'R1', 'traceroute 192.168.2.20')
    expect(tr).toMatch(/\n {2}1 10\.0\.0\.2 !A {2}!A {2}!A /)
    expect(tr).not.toMatch(/\n {2}2 /)
  })

  it('geçersiz satırlar reddedilir (wildcard eksik, bilinmeyen protokol, numara aralığı)', () => {
    const rt = createLab(lab())
    expect(cfg(rt, 'R1', 'access-list 101 permit tcp 192.168.1.0 any')).toContain('% Invalid input')
    expect(cfg(rt, 'R1', 'access-list 101 permit gre any any')).toContain('% Invalid input')
    expect(cfg(rt, 'R1', 'access-list 10 permit tcp any any')).toContain('% Invalid input')
    expect(cfg(rt, 'R1', 'ip access-list extended 10')).toContain('% Invalid access list number')
    expect(rt.running['R1']!.acls ?? {}).toEqual({})
  })
})

describe('IOS kuralları', () => {
  it('router\'ın kendi trafiği giden ACL\'e takılmaz; yönlendirilen trafik takılır', () => {
    const rt = createLab(lab(['access-list 110 deny ip any any', 'interface g0/1', 'ip access-group 110 out']))
    expect(run(rt, 'R1', 'ping 10.0.0.2')).toContain('!!!!')
    expect(ping(rt, 'H1', '192.168.2.20')).toBe(false)
  })

  it('tanımsız liste uygulanırsa her şeye izin verilir', () => {
    const rt = createLab(lab([], ['interface g0/0', 'ip access-group 99 out']))
    expect(ping(rt, 'H1', '192.168.2.20')).toBe(true)
  })
})
