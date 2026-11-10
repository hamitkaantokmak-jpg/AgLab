// L4: Router cihaz tipi, statik rotada yönetimsel uzaklık (AD) ve özyinelemeli next-hop.
// Her davranış hem başarılı hem başarısız durumla sınanır (L3 tablosu sıra 2–3).
import { describe, expect, it } from 'vitest'
import { createLab, createSession, runScript, type VpcsSession } from '../../src/sim'
import { deliver, routeTable } from '../../src/sim/net'
import type { LabRuntime } from '../../src/sim/runtime'
import type { LabDef } from '../../src/sim/types'
import { ports } from '../../src/sim/util'

const router = (id: string, n: number) => ({ id, kind: 'switch' as const, router: true, model: 'ISR4331', mac: `5254.00${n}0.0000`, ports: ports('Gi0/0-2'), x: 0, y: 0 })
const pc = (id: string, n: number) => ({ id, kind: 'pc' as const, mac: `0050.0000.00${n}0`, x: 0, y: 0 })

/** H1 — R1 — R2 — H2; R1 Gi0/2 ↔ R3 (yedek yol: 10.0.13.0/30). */
function lab(extra: Record<string, string> = {}): LabDef {
  return {
    id: 'l4-router', title: '', summary: '', level: 'İleri', tags: [], brief: [], objectives: [], solution: {}, view: { w: 1, h: 1 },
    devices: [router('R1', 1), router('R2', 2), router('R3', 3), pc('H1', 1), pc('H2', 2)],
    links: [
      { a: ['H1', 'eth0'], b: ['R1', 'GigabitEthernet0/0'] },
      { a: ['R1', 'GigabitEthernet0/1'], b: ['R2', 'GigabitEthernet0/1'] },
      { a: ['R2', 'GigabitEthernet0/0'], b: ['H2', 'eth0'] },
      { a: ['R1', 'GigabitEthernet0/2'], b: ['R3', 'GigabitEthernet0/2'] },
    ],
    initialConfig: {
      R1: [
        'hostname R1',
        'interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown',
        'interface g0/1', 'ip address 10.0.12.1 255.255.255.252', 'no shutdown',
        'interface g0/2', 'ip address 10.0.13.1 255.255.255.252', 'no shutdown',
        ...(extra['R1'] ? extra['R1'].split('\n') : []),
      ].join('\n'),
      R2: [
        'hostname R2',
        'interface g0/0', 'ip address 192.168.2.1 255.255.255.0', 'no shutdown',
        'interface g0/1', 'ip address 10.0.12.2 255.255.255.252', 'no shutdown',
        ...(extra['R2'] ? extra['R2'].split('\n') : []),
      ].join('\n'),
      R3: ['hostname R3', 'interface g0/2', 'ip address 10.0.13.2 255.255.255.252', 'no shutdown'].join('\n'),
    },
    initialPcs: { H1: { ip: '192.168.1.10', prefix: 24, gw: '192.168.1.1' }, H2: { ip: '192.168.2.20', prefix: 24, gw: '192.168.2.1' } },
  }
}

const cfg = (rt: LabRuntime, dev: string, script: string) => runScript(rt, dev, 'configure terminal\n' + script + '\nend')
const pcPing = (rt: LabRuntime, from: string, ip: string) => (createSession(rt, from) as VpcsSession).exec('ping ' + ip).join('\n')
const statics = (rt: LabRuntime, dev: string) =>
  routeTable(rt.derived, dev)
    .filter((e) => e.code === 'S')
    .map((e) => `${e.net}/${e.prefix} ${e.ad ?? 1} via ${e.nh} -> ${e.via} ${e.ifname}`)
const egress = (rt: LabRuntime, dev: string, dst: string) => deliver(rt.derived, dev, dst).hops[0]?.outIf.name ?? null
const bad = (out: string[]) => out.filter((l) => /^% (Invalid|Incomplete|Ambiguous)/.test(l))

describe('Router cihaz tipi', () => {
  it('portlar routed ve varsayılan olarak kapalı; ip routing açık', () => {
    const rt = createLab({ ...lab(), initialConfig: {} })
    const s = createSession(rt, 'R1')
    expect(s.prompt()).toBe('R1>')
    const brief = runScript(rt, 'R1', 'show ip interface brief').join('\n')
    expect(brief).toMatch(/GigabitEthernet0\/0\s+unassigned\s+YES unset\s+administratively down/)
    expect(rt.running['R1']!.ipRouting).toBe(true)
    expect(Object.values(rt.running['R1']!.ifaces).every((c) => c.routed)).toBe(true)
    // kapalı port karşı ucu da düşürür: H1 ağ geçidine ulaşamaz
    expect(pcPing(rt, 'H1', '192.168.1.1')).not.toMatch(/bytes from/)
  })

  it('switch komutları routerda yok; arayüze IP verip açmak bağlı ağı kurar', () => {
    const rt = createLab({ ...lab(), initialConfig: {} })
    for (const cmd of ['vlan 10', 'spanning-tree mode rapid-pvst', 'interface vlan 1', 'interface port-channel 1'])
      expect(bad(cfg(rt, 'R1', cmd)), cmd).not.toEqual([])
    expect(bad(cfg(rt, 'R1', 'interface g0/0\nswitchport mode access'))).not.toEqual([])
    expect(bad(runScript(rt, 'R1', 'show vlan brief'))).not.toEqual([])
    expect(bad(cfg(rt, 'R1', 'interface g0/0\nip address 192.168.1.1 255.255.255.0\nno shutdown'))).toEqual([])
    expect(routeTable(rt.derived, 'R1').map((e) => `${e.code} ${e.net}/${e.prefix}`)).toEqual(['C 192.168.1.0/24', 'L 192.168.1.1/32'])
    expect(pcPing(rt, 'H1', '192.168.1.1')).toMatch(/bytes from 192\.168\.1\.1/)
    const run = runScript(rt, 'R1', 'show running-config').join('\n')
    expect(run).toContain('interface GigabitEthernet0/0\n ip address 192.168.1.1 255.255.255.0\n!')
    expect(run).not.toMatch(/switchport|spanning-tree|^vlan /m)
    expect(run).toMatch(/interface GigabitEthernet0\/1\n no ip address\n shutdown/)
  })

  it('kopan kablo bağlı rotayı tablodan çıkarır', () => {
    const rt = createLab(lab())
    expect(routeTable(rt.derived, 'R1').some((e) => e.code === 'C' && e.net === '10.0.12.0')).toBe(true)
    rt.setLink('R1', 'GigabitEthernet0/1', false)
    expect(routeTable(rt.derived, 'R1').some((e) => e.code === 'C' && e.net === '10.0.12.0')).toBe(false)
    expect(runScript(rt, 'R1', 'show ip interface brief').join('\n')).toMatch(/GigabitEthernet0\/1\s+10\.0\.12\.1\s+YES manual down\s+down/)
  })
})

describe('statik rota: iki yönlü erişim', () => {
  it('dönüş rotası yoksa ping zaman aşımı; eklenince başarılı', () => {
    const rt = createLab(lab({ R1: 'ip route 192.168.2.0 255.255.255.0 10.0.12.2' }))
    expect(pcPing(rt, 'H1', '192.168.2.20')).toMatch(/timeout/)
    cfg(rt, 'R2', 'ip route 192.168.1.0 255.255.255.0 10.0.12.1')
    expect(pcPing(rt, 'H1', '192.168.2.20')).toMatch(/bytes from 192\.168\.2\.20/)
  })

  it('ileri rota yoksa kaynak router "host unreachable" döner', () => {
    const rt = createLab(lab({ R2: 'ip route 192.168.1.0 255.255.255.0 10.0.12.1' }))
    expect(pcPing(rt, 'H1', '192.168.2.20')).toMatch(/unreachable/)
  })

  it('varsayılan rota uzak ağı kapsar; yanlış prefix kapsamaz', () => {
    const rt = createLab(lab({ R1: 'ip route 192.168.20.0 255.255.255.0 10.0.12.2', R2: 'ip route 192.168.1.0 255.255.255.0 10.0.12.1' }))
    expect(pcPing(rt, 'H1', '192.168.2.20')).not.toMatch(/bytes from/)
    cfg(rt, 'R1', 'ip route 0.0.0.0 0.0.0.0 10.0.12.2')
    expect(pcPing(rt, 'H1', '192.168.2.20')).toMatch(/bytes from 192\.168\.2\.20/)
    expect(runScript(rt, 'R1', 'show ip route').join('\n')).toContain('Gateway of last resort is 10.0.12.2 to network 0.0.0.0')
  })
})

describe('yönetimsel uzaklık (floating static)', () => {
  it('düşük AD kazanır; AD ve tekrar girilen rota running-config\'te', () => {
    const rt = createLab(lab())
    cfg(rt, 'R1', 'ip route 172.16.0.0 255.255.0.0 10.0.12.2 200\nip route 172.16.0.0 255.255.0.0 10.0.13.2 5')
    expect(statics(rt, 'R1')).toEqual(['172.16.0.0/16 5 via 10.0.13.2 -> 10.0.13.2 GigabitEthernet0/2'])
    expect(runScript(rt, 'R1', 'show ip route static').join('\n')).toContain('S        172.16.0.0/16 [5/0] via 10.0.13.2')
    expect(runScript(rt, 'R1', 'show ip route 172.16.1.1').join('\n')).toContain('Known via "static", distance 5, metric 0')
    // aynı next-hop ile yeniden girilen rota AD'yi değiştirir, ikinci satır eklemez
    cfg(rt, 'R1', 'ip route 172.16.0.0 255.255.0.0 10.0.13.2 250')
    expect(rt.running['R1']!.routes).toEqual([
      { net: '172.16.0.0', mask: '255.255.0.0', nh: '10.0.12.2', ad: 200 },
      { net: '172.16.0.0', mask: '255.255.0.0', nh: '10.0.13.2', ad: 250 },
    ])
    expect(statics(rt, 'R1')).toEqual(['172.16.0.0/16 200 via 10.0.12.2 -> 10.0.12.2 GigabitEthernet0/1'])
    const run = runScript(rt, 'R1', 'show running-config').join('\n')
    expect(run).toContain('ip route 172.16.0.0 255.255.0.0 10.0.12.2 200\nip route 172.16.0.0 255.255.0.0 10.0.13.2 250')
  })

  it('çözümlenemeyen AD 1 rotası kurulmaz; yedek AD 5 rotası devreye girer', () => {
    const rt = createLab(lab({ R1: 'ip route 192.168.2.0 255.255.255.0 10.0.1.2', R2: 'ip route 192.168.1.0 255.255.255.0 10.0.12.1' }))
    expect(statics(rt, 'R1')).toEqual([])
    expect(pcPing(rt, 'H1', '192.168.2.20')).toMatch(/unreachable/)
    cfg(rt, 'R1', 'ip route 192.168.2.0 255.255.255.0 10.0.12.2 5')
    expect(statics(rt, 'R1')).toEqual(['192.168.2.0/24 5 via 10.0.12.2 -> 10.0.12.2 GigabitEthernet0/1'])
    expect(pcPing(rt, 'H1', '192.168.2.20')).toMatch(/bytes from 192\.168\.2\.20/)
    // birincil yol düşünce yedek de çözümlenemez
    rt.setLink('R1', 'GigabitEthernet0/1', false)
    expect(statics(rt, 'R1')).toEqual([])
  })

  it('AD 0 ve 256 sözdiziminde reddedilir', () => {
    const rt = createLab(lab())
    expect(bad(cfg(rt, 'R1', 'ip route 9.9.9.0 255.255.255.0 10.0.12.2 0'))).not.toEqual([])
    expect(bad(cfg(rt, 'R1', 'ip route 9.9.9.0 255.255.255.0 10.0.12.2 256'))).not.toEqual([])
    expect(rt.running['R1']!.routes).toEqual([])
  })
})

describe('en uzun önek ve özyinelemeli next-hop', () => {
  it('daha uzun önek kazanır; next-hop\'u yanıtsızsa ARP tamamlanmaz', () => {
    const rt = createLab(lab({ R2: 'ip route 192.168.1.0 255.255.255.0 10.0.12.1' }))
    cfg(rt, 'R1', 'ip route 192.168.0.0 255.255.0.0 10.0.12.2\nip route 192.168.2.0 255.255.255.0 192.168.1.254')
    expect(egress(rt, 'R1', '192.168.2.20')).toBe(null)
    expect(pcPing(rt, 'H1', '192.168.2.20')).not.toMatch(/bytes from/)
    cfg(rt, 'R1', 'no ip route 192.168.2.0 255.255.255.0 192.168.1.254')
    expect(pcPing(rt, 'H1', '192.168.2.20')).toMatch(/bytes from 192\.168\.2\.20/)
  })

  it('next-hop başka bir rotayla çözülür (oracle: resolvedVia recursive)', () => {
    const rt = createLab(lab({ R2: 'ip route 192.168.1.0 255.255.255.0 10.0.12.1' }))
    cfg(rt, 'R1', 'ip route 192.168.2.0 255.255.255.0 8.8.1.1')
    expect(statics(rt, 'R1')).toEqual([])
    cfg(rt, 'R1', 'ip route 8.8.0.0 255.255.0.0 10.0.12.2')
    expect(statics(rt, 'R1')).toEqual([
      '192.168.2.0/24 1 via 8.8.1.1 -> 10.0.12.2 GigabitEthernet0/1',
      '8.8.0.0/16 1 via 10.0.12.2 -> 10.0.12.2 GigabitEthernet0/1',
    ])
    expect(pcPing(rt, 'H1', '192.168.2.20')).toMatch(/bytes from 192\.168\.2\.20/)
  })

  it('birbirine dayanan rotalar döngüye girmeden kurulmaz', () => {
    const rt = createLab(lab())
    cfg(rt, 'R1', 'ip route 5.5.5.0 255.255.255.0 4.4.4.4\nip route 4.4.4.0 255.255.255.0 5.5.5.5')
    expect(statics(rt, 'R1')).toEqual([])
    expect(egress(rt, 'R1', '5.5.5.1')).toBe(null)
  })

  it('uzun önek çözülemezse kısa aday kullanılır', () => {
    const rt = createLab(lab())
    cfg(rt, 'R1', 'ip route 3.3.3.0 255.255.255.0 2.2.2.2\nip route 3.3.0.0 255.255.0.0 10.0.12.2')
    expect(egress(rt, 'R1', '3.3.3.3')).toBe('GigabitEthernet0/1')
  })
})

describe('no ip route', () => {
  it('next-hop ile tek rotayı, next-hop olmadan prefix\'in bütün rotalarını siler', () => {
    const rt = createLab(lab())
    cfg(rt, 'R1', 'ip route 9.9.9.0 255.255.255.0 10.0.12.2\nip route 9.9.9.0 255.255.255.0 10.0.13.2 5\nip route 8.8.8.0 255.255.255.0 10.0.12.2')
    expect(cfg(rt, 'R1', 'no ip route 9.9.9.0 255.255.255.0 10.0.99.9').join('\n')).toContain('%No matching route to delete')
    cfg(rt, 'R1', 'no ip route 9.9.9.0 255.255.255.0 10.0.12.2')
    expect(rt.running['R1']!.routes.map((r) => r.nh)).toEqual(['10.0.13.2', '10.0.12.2'])
    cfg(rt, 'R1', 'no ip route 9.9.9.0 255.255.255.0')
    expect(rt.running['R1']!.routes).toEqual([{ net: '8.8.8.0', mask: '255.255.255.0', nh: '10.0.12.2' }])
  })

  it('kendi adresine ve tutarsız prefix\'e rota reddedilir', () => {
    const rt = createLab(lab())
    expect(cfg(rt, 'R1', 'ip route 9.9.9.0 255.255.255.0 10.0.12.1').join('\n')).toContain('%Invalid next hop address')
    expect(cfg(rt, 'R1', 'ip route 9.9.9.1 255.255.255.0 10.0.12.2').join('\n')).toContain('%Inconsistent address and mask')
    expect(rt.running['R1']!.routes).toEqual([])
  })
})

describe('OSPF ile AD karşılaştırması', () => {
  const ospf = {
    R1: 'router ospf 1\nnetwork 10.0.12.0 0.0.0.3 area 0\nnetwork 192.168.1.0 0.0.0.255 area 0',
    R2: 'router ospf 1\nnetwork 10.0.12.0 0.0.0.3 area 0\nnetwork 192.168.2.0 0.0.0.255 area 0',
  }
  it('OSPF (110) yüksek AD\'li yedek statik rotayı yener; AD 1 statik OSPF\'i yener', () => {
    const rt = createLab(lab(ospf))
    expect(routeTable(rt.derived, 'R1').find((e) => e.net === '192.168.2.0')?.code).toBe('O')
    cfg(rt, 'R1', 'ip route 192.168.2.0 255.255.255.0 10.0.13.2 200')
    expect(routeTable(rt.derived, 'R1').find((e) => e.net === '192.168.2.0')?.code).toBe('O')
    expect(pcPing(rt, 'H1', '192.168.2.20')).toMatch(/bytes from 192\.168\.2\.20/)
    cfg(rt, 'R1', 'ip route 192.168.2.0 255.255.255.0 10.0.13.2')
    const e = routeTable(rt.derived, 'R1').find((x) => x.net === '192.168.2.0')!
    expect([e.code, e.nh]).toEqual(['S', '10.0.13.2'])
    // R3 bu ağı bilmiyor: statik rota doğru kurulsa da trafik yanlış yola gider
    expect(pcPing(rt, 'H1', '192.168.2.20')).not.toMatch(/bytes from/)
  })

  it('area uyuşmazlığında komşuluk kurulmaz, uzak LAN öğrenilmez', () => {
    const rt = createLab(lab({ ...ospf, R2: ospf.R2.replace('10.0.12.0 0.0.0.3 area 0', '10.0.12.0 0.0.0.3 area 1') }))
    expect(routeTable(rt.derived, 'R1').some((e) => e.net === '192.168.2.0')).toBe(false)
    expect(pcPing(rt, 'H1', '192.168.2.20')).not.toMatch(/bytes from/)
    cfg(rt, 'R2', 'router ospf 1\nno network 10.0.12.0 0.0.0.3 area 1\nnetwork 10.0.12.0 0.0.0.3 area 0')
    expect(pcPing(rt, 'H1', '192.168.2.20')).toMatch(/bytes from 192\.168\.2\.20/)
  })
})
