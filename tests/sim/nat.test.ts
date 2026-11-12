// L5-d: NAT/PAT. Her davranış başarılı ve başarısız durumla sınanır.
import { describe, expect, it } from 'vitest'
import { createLab, createSession, runScript, type VpcsSession } from '../../src/sim'
import type { LabRuntime } from '../../src/sim/runtime'
import type { LabDef } from '../../src/sim/types'
import { ports } from '../../src/sim/util'

const pc = (id: string, n: number) => ({ id, kind: 'pc' as const, mac: `0050.0000.00${n}0`, x: 0, y: 0 })

/** PC1, PC2 (192.168.1.0/24) — SW1 — R1 Gi0/0 (inside) | R1 Gi0/1 (outside) — SRV 203.0.113.8 (rotasız). */
function lab(r1: string[]): LabDef {
  return {
    id: 'l5d', title: '', summary: '', level: 'İleri', tags: [], brief: [], objectives: [], solution: {}, view: { w: 1, h: 1 },
    devices: [
      { id: 'R1', kind: 'switch', router: true, model: 'ISR4331', mac: '5254.0010.0000', ports: ports('Gi0/0-1'), x: 0, y: 0 },
      { id: 'SW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0020.0000', ports: [...ports('Fa0/1-3'), ...ports('Gi0/1-2')], x: 0, y: 0 },
      pc('PC1', 1), pc('PC2', 2), pc('SRV', 3),
    ],
    links: [
      { a: ['PC1', 'eth0'], b: ['SW1', 'FastEthernet0/1'] },
      { a: ['PC2', 'eth0'], b: ['SW1', 'FastEthernet0/2'] },
      { a: ['SW1', 'GigabitEthernet0/1'], b: ['R1', 'GigabitEthernet0/0'] },
      { a: ['SRV', 'eth0'], b: ['R1', 'GigabitEthernet0/1'] },
    ],
    initialConfig: {
      R1: [
        'interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown',
        'interface g0/1', 'ip address 203.0.113.1 255.255.255.0', 'no shutdown', 'exit',
        ...r1,
      ].join('\n'),
    },
    initialPcs: {
      PC1: { ip: '192.168.1.10', prefix: 24, gw: '192.168.1.1' },
      PC2: { ip: '192.168.1.11', prefix: 24, gw: '192.168.1.1' },
      // genel adres alanındaki sunucunun özel ağlara rotası yok (ağ geçidi yok)
      SRV: { ip: '203.0.113.8', prefix: 24, gw: null },
    },
  }
}
const ROLES = ['interface g0/0', 'ip nat inside', 'interface g0/1', 'ip nat outside', 'exit']
const ACL1 = ['access-list 1 permit 192.168.1.0 0.0.0.255']
const PAT = [...ROLES, ...ACL1, 'ip nat inside source list 1 interface g0/1 overload']

const cfg = (rt: LabRuntime, dev: string, script: string) => runScript(rt, dev, 'configure terminal\n' + script + '\nend')
const vpcs = (rt: LabRuntime, from: string, cmd: string) => (createSession(rt, from) as VpcsSession).exec(cmd).join('\n')
const ok = (rt: LabRuntime, from: string, ip: string) => /bytes from/.test(vpcs(rt, from, 'ping ' + ip))
const sh = (rt: LabRuntime, cmd: string) => runScript(rt, 'R1', cmd).join('\n')
const rows = (rt: LabRuntime) => sh(rt, 'show ip nat translations').split('\n').filter((l) => l && !/^(Pro |R1)/.test(l)).map((l) => l.trim().split(/\s+/).join(' '))
const bad = (out: string[]) => out.filter((l) => /^% ?(Invalid|Incomplete|Ambiguous)/.test(l))

describe('NAT/PAT', () => {
  it('NAT yokken özel kaynak geri dönemez; PAT (arayüz overload) ile ping çalışır ve tabloya yazılır', () => {
    const rt = createLab(lab([]))
    expect(ok(rt, 'PC1', '203.0.113.8')).toBe(false)
    expect(bad(cfg(rt, 'R1', PAT.join('\n')))).toEqual([])
    expect(ok(rt, 'PC1', '203.0.113.8')).toBe(true)
    expect(ok(rt, 'PC2', '203.0.113.8')).toBe(true)
    // PC2 aynı ICMP kimliğini kullanır: PAT bir sonraki boş kimliği seçer
    expect(rows(rt)).toEqual([
      'icmp 203.0.113.1:1 192.168.1.10:1 203.0.113.8:1 203.0.113.8:1',
      'icmp 203.0.113.1:2 192.168.1.11:1 203.0.113.8:1 203.0.113.8:1',
    ])
    const st = sh(rt, 'show ip nat statistics')
    expect(st).toContain('Total active translations: 2 (0 static, 2 dynamic; 2 extended)')
    expect(st).toMatch(/Outside interfaces:\n {2}GigabitEthernet0\/1\nInside interfaces:\n {2}GigabitEthernet0\/0/)
    expect(st).toContain('Hits: 20  Misses: 0')
    expect(st).toContain('[Id: 1] access-list 1 interface GigabitEthernet0/1 overload refcount 2')
    const run = sh(rt, 'show running-config')
    expect(run).toContain('interface GigabitEthernet0/0\n ip address 192.168.1.1 255.255.255.0\n ip nat inside')
    expect(run).toContain('ip nat inside source list 1 interface GigabitEthernet0/1 overload')
    sh(rt, 'clear ip nat translation *')
    expect(rows(rt)).toEqual([])
  })

  it('TCP/UDP girdileri kaynak portuyla yazılır (VPCS trace UDP sondası)', () => {
    const rt = createLab(lab(PAT))
    vpcs(rt, 'PC1', 'trace 203.0.113.8')
    expect(rows(rt)[0]).toMatch(/^udp 203\.0\.113\.1:49152 192\.168\.1\.10:49152 203\.0\.113\.8:33434 203\.0\.113\.8:33434$/)
  })

  it('inside/outside ters yapılandırılınca çeviri olmaz (başarısız); düzeltilince çalışır', () => {
    const rt = createLab(lab(['interface g0/0', 'ip nat outside', 'interface g0/1', 'ip nat inside', 'exit', ...ACL1, 'ip nat inside source list 1 interface g0/1 overload']))
    expect(ok(rt, 'PC1', '203.0.113.8')).toBe(false)
    expect(rows(rt)).toEqual([])
    cfg(rt, 'R1', 'interface g0/0\nno ip nat outside\nip nat inside\ninterface g0/1\nno ip nat inside\nip nat outside')
    expect(ok(rt, 'PC1', '203.0.113.8')).toBe(true)
  })

  it('ACL kaynağı kapsamıyorsa çeviri olmaz; tanımsız ACL de çevirmez', () => {
    const rt = createLab(lab([...ROLES, 'access-list 1 permit 192.168.2.0 0.0.0.255', 'ip nat inside source list 1 interface g0/1 overload']))
    expect(ok(rt, 'PC1', '203.0.113.8')).toBe(false)
    expect(rows(rt)).toEqual([])
    cfg(rt, 'R1', 'no access-list 1')
    expect(ok(rt, 'PC1', '203.0.113.8')).toBe(false)
    cfg(rt, 'R1', ACL1.join('\n'))
    expect(ok(rt, 'PC1', '203.0.113.8')).toBe(true)
  })

  it('dinamik havuz (overload yok): adres tükenince ikinci host düşer; overload ile ikisi de geçer', () => {
    const pool = [...ROLES, ...ACL1, 'ip nat pool GENEL 203.0.113.100 203.0.113.100 netmask 255.255.255.0', 'ip nat inside source list 1 pool GENEL']
    const rt = createLab(lab(pool))
    expect(ok(rt, 'PC1', '203.0.113.8')).toBe(true)
    expect(ok(rt, 'PC2', '203.0.113.8')).toBe(false)
    expect(rows(rt)).toEqual(['--- 203.0.113.100 192.168.1.10 --- ---', 'icmp 203.0.113.100:1 192.168.1.10:1 203.0.113.8:1 203.0.113.8:1'])
    const st = sh(rt, 'show ip nat statistics')
    expect(st).toContain('Misses: 5')
    expect(st).toContain('type generic, total addresses 1, allocated 1 (100%), misses 5')
    cfg(rt, 'R1', 'ip nat inside source list 1 pool GENEL overload')
    expect(ok(rt, 'PC2', '203.0.113.8')).toBe(true)
  })

  it('statik NAT: dışarıdan genel adrese erişim içerideki hosta çevrilir; statik yokken başarısız', () => {
    const rt = createLab(lab(ROLES))
    expect(ok(rt, 'SRV', '203.0.113.50')).toBe(false)
    cfg(rt, 'R1', 'ip nat inside source static 192.168.1.10 203.0.113.50')
    expect(ok(rt, 'SRV', '203.0.113.50')).toBe(true)
    expect(ok(rt, 'PC1', '203.0.113.8')).toBe(true)
    expect(ok(rt, 'PC2', '203.0.113.8')).toBe(false)
    expect(rows(rt)).toEqual(['--- 203.0.113.50 192.168.1.10 --- ---'])
    expect(sh(rt, 'show running-config')).toContain('ip nat inside source static 192.168.1.10 203.0.113.50')
  })

  it('IOS kuralları: havuz aralığı, kullanımdaki havuz, çakışan statik, switch\'te NAT yok', () => {
    const rt = createLab(lab([...ROLES, ...ACL1]))
    expect(cfg(rt, 'R1', 'ip nat pool P 203.0.113.20 203.0.113.10 netmask 255.255.255.0').join('\n')).toContain('%End address less than starting address')
    cfg(rt, 'R1', 'ip nat pool P 203.0.113.10 203.0.113.20 netmask 255.255.255.0\nip nat inside source list 1 pool P')
    expect(cfg(rt, 'R1', 'no ip nat pool P').join('\n')).toContain('%Pool P in use, cannot destroy')
    cfg(rt, 'R1', 'ip nat inside source static 192.168.1.10 203.0.113.50')
    expect(cfg(rt, 'R1', 'ip nat inside source static 192.168.1.11 203.0.113.50').join('\n')).toContain('% similar static entry (192.168.1.10 -> 203.0.113.50) already exists')
    expect(bad(runScript(rt, 'SW1', 'show ip nat translations'))).not.toEqual([])
    expect(bad(cfg(rt, 'SW1', 'interface vlan 1\nip nat inside'))).not.toEqual([])
  })

  it('çeviri varken eşleme silinirken IOS onay sorar', () => {
    const rt = createLab(lab(PAT))
    expect(ok(rt, 'PC1', '203.0.113.8')).toBe(true)
    const s = createSession(rt, 'R1')
    s.exec('enable')
    s.exec('configure terminal')
    s.exec('no ip nat inside source list 1 interface g0/1 overload')
    expect(s.prompt()).toBe('%Dynamic mapping in use, do you want to delete all entries? [no]: ')
    expect(rt.running['R1']!.nat!.rules).toHaveLength(1)
    s.exec('yes')
    expect(rt.running['R1']!.nat!.rules).toEqual([])
    expect(rows(rt)).toEqual([])
  })

  it('kayıt/yükleme çeviri tablosunu korur', () => {
    const rt = createLab(lab(PAT))
    ok(rt, 'PC1', '203.0.113.8')
    const saved = rt.save()
    const rt2 = createLab(lab(PAT))
    expect(rt2.load(saved)).toBe(true)
    expect(rows(rt2)).toHaveLength(1)
  })
})

describe('NAT Simulation Mode izi', () => {
  it('outside kablosunda kaynak çevrilmiş, dönüşte hedef geri çevrilmiş görünür', async () => {
    const { pingTrace } = await import('../../src/sim-bridge/events')
    const rt = createLab(lab(PAT))
    const t = pingTrace(rt, 'PC1', '203.0.113.8')
    expect(t.ok).toBe(true)
    const frames = t.records.filter((r) => r.kind === 'wire').map((r) => `${r.frame!.kind} ${r.edge!.a}>${r.edge!.b} ${r.frame!.ipv4.sourceIp}>${r.frame!.ipv4.destinationIp}`)
    expect(frames).toEqual([
      'icmp-request PC1>SW1 192.168.1.10>203.0.113.8',
      'icmp-request SW1>R1 192.168.1.10>203.0.113.8',
      'icmp-request R1>SRV 203.0.113.1>203.0.113.8',
      'icmp-reply SRV>R1 203.0.113.8>203.0.113.1',
      'icmp-reply R1>SW1 203.0.113.8>192.168.1.10',
      'icmp-reply SW1>PC1 203.0.113.8>192.168.1.10',
    ])
    // NAT'sız: istek gider, yanıt dönemez
    expect(pingTrace(createLab(lab([])), 'PC1', '203.0.113.8').ok).toBe(false)
  })
})
