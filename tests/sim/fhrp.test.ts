// FHRP: HSRP v1 ve VRRP v2 (Cisco IOS davranışı). Her davranış hem başarılı hem başarısız
// durumla sınanır: seçim, preempt (HSRP kapalı / VRRP açık varsayılan), track ile devir, grup
// uyuşmazlığında iki Active, güç kesilince devir ve PC trafiğinin yeni aktiften geçmesi.
import { describe, expect, it } from 'vitest'
import { createLab, createSession, runScript, type VpcsSession } from '../../src/sim'
import { deliver } from '../../src/sim/net'
import type { LabRuntime } from '../../src/sim/runtime'
import type { LabDef } from '../../src/sim/types'
import { ports } from '../../src/sim/util'

const router = (id: string, n: number) => ({ id, kind: 'switch' as const, router: true, model: 'ISR4331', mac: `5254.00${n}0.0000`, ports: ports('Gi0/0-2'), x: 0, y: 0 })
const pc = (id: string, n: number) => ({ id, kind: 'pc' as const, mac: `0050.0000.00${n}0`, x: 0, y: 0 })

/** PC — SW — {R1, R2} (192.168.1.0/24, VIP .254); R1/R2 — R3 — H2 (192.168.9.0/24). */
function lab(extra: Record<string, string> = {}): LabDef {
  const lines = (dev: string, base: string[]) => [...base, ...(extra[dev] ? extra[dev]!.split('\n') : [])].join('\n')
  return {
    id: 'fhrp', title: '', summary: '', level: 'İleri', tags: [], brief: [], objectives: [], solution: {}, view: { w: 1, h: 1 },
    devices: [
      { id: 'SW', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0090.0000', ports: ports('Fa0/1-24', 'Gi0/1-2'), x: 0, y: 0 },
      router('R1', 1), router('R2', 2), router('R3', 3), pc('PC', 1), pc('H2', 2),
    ],
    links: [
      { a: ['PC', 'eth0'], b: ['SW', 'FastEthernet0/1'] },
      { a: ['R1', 'GigabitEthernet0/0'], b: ['SW', 'FastEthernet0/2'] },
      { a: ['R2', 'GigabitEthernet0/0'], b: ['SW', 'FastEthernet0/3'] },
      { a: ['R1', 'GigabitEthernet0/1'], b: ['R3', 'GigabitEthernet0/1'] },
      { a: ['R2', 'GigabitEthernet0/1'], b: ['R3', 'GigabitEthernet0/2'] },
      { a: ['R3', 'GigabitEthernet0/0'], b: ['H2', 'eth0'] },
    ],
    initialConfig: {
      SW: 'interface range fa0/1 - 3\nswitchport mode access',
      R1: lines('R1', [
        'interface g0/0', 'ip address 192.168.1.2 255.255.255.0', 'no shutdown',
        'interface g0/1', 'ip address 10.0.1.1 255.255.255.252', 'no shutdown',
        'exit', 'ip route 192.168.9.0 255.255.255.0 10.0.1.2',
      ]),
      R2: lines('R2', [
        'interface g0/0', 'ip address 192.168.1.3 255.255.255.0', 'no shutdown',
        'interface g0/1', 'ip address 10.0.2.1 255.255.255.252', 'no shutdown',
        'exit', 'ip route 192.168.9.0 255.255.255.0 10.0.2.2',
      ]),
      R3: [
        'interface g0/0', 'ip address 192.168.9.1 255.255.255.0', 'no shutdown',
        'interface g0/1', 'ip address 10.0.1.2 255.255.255.252', 'no shutdown',
        'interface g0/2', 'ip address 10.0.2.2 255.255.255.252', 'no shutdown',
        'exit', 'ip route 192.168.1.0 255.255.255.0 10.0.1.1', 'ip route 192.168.1.0 255.255.255.0 10.0.2.1 5',
      ].join('\n'),
    },
    initialPcs: { PC: { ip: '192.168.1.10', prefix: 24, gw: '192.168.1.254' }, H2: { ip: '192.168.9.10', prefix: 24, gw: '192.168.9.1' } },
  }
}

const cfg = (rt: LabRuntime, dev: string, script: string) => runScript(rt, dev, 'configure terminal\n' + script + '\nend')
const run = (rt: LabRuntime, dev: string, cmd: string) => runScript(rt, dev, cmd).join('\n')
const pcPing = (rt: LabRuntime, ip: string) => (createSession(rt, 'PC') as VpcsSession).exec('ping ' + ip).join('\n')
const firstRouter = (rt: LabRuntime) => deliver(rt.derived, 'PC', '192.168.9.10').hops[0]?.dev ?? null
const bad = (out: string[]) => out.filter((l) => /^% (Invalid|Incomplete|Ambiguous)/.test(l))
const states = (rt: LabRuntime) =>
  Object.fromEntries((rt.derived.fhrp?.members ?? []).map((m) => [`${m.dev}:${m.proto}${m.group}`, m.state]))

const HSRP = (prio?: number, preempt = false, more: string[] = []) =>
  ['interface g0/0', 'standby 1 ip 192.168.1.254', ...(prio ? [`standby 1 priority ${prio}`] : []), ...(preempt ? ['standby 1 preempt'] : []), ...more].join('\n')
const VRRP = (prio?: number, more: string[] = []) =>
  ['interface g0/0', 'vrrp 1 ip 192.168.1.254', ...(prio ? [`vrrp 1 priority ${prio}`] : []), ...more].join('\n')

describe('HSRP seçimi', () => {
  it('en yüksek öncelik Active, sonraki Standby; PC trafiği Active üzerinden', () => {
    const rt = createLab(lab({ R1: HSRP(110), R2: HSRP() }))
    expect(states(rt)).toEqual({ 'R1:hsrp1': 'Active', 'R2:hsrp1': 'Standby' })
    const brief = run(rt, 'R1', 'show standby brief')
    expect(brief).toContain('Interface   Grp  Pri P State   Active          Standby         Virtual IP')
    expect(brief).toMatch(/Gi0\/0\s+1\s+110\s+Active\s+local\s+192\.168\.1\.3\s+192\.168\.1\.254/)
    expect(run(rt, 'R2', 'show standby brief')).toMatch(/Gi0\/0\s+1\s+100\s+Standby\s+192\.168\.1\.2\s+local\s+192\.168\.1\.254/)
    const full = run(rt, 'R2', 'show standby')
    expect(full).toContain('GigabitEthernet0/0 - Group 1')
    expect(full).toContain('  State is Standby')
    expect(full).toContain('  Active router is 192.168.1.2, priority 110')
    expect(full).toContain('  Active virtual MAC address is 0000.0c07.ac01 (MAC Not In Use)')
    expect(full).toContain('  Preemption disabled')
    expect(pcPing(rt, '192.168.9.10').match(/84 bytes from/g)?.length).toBe(5)
    expect(firstRouter(rt)).toBe('R1')
    // VIP ARP'sini Active yanıtlar: PC'nin ARP tablosunda sanal MAC (v1: 0000.0c07.acXX)
    expect((createSession(rt, 'PC') as VpcsSession).exec('show arp').join('\n')).toContain('00:00:0c:07:ac:01  192.168.1.254')
    // VIP'ye ping'i Active yanıtlar
    expect(pcPing(rt, '192.168.1.254').match(/84 bytes from/g)?.length).toBe(5)
  })

  it('eşit öncelikte yüksek arayüz adresi Active', () => {
    const rt = createLab(lab({ R1: HSRP(), R2: HSRP() }))
    expect(states(rt)).toEqual({ 'R1:hsrp1': 'Standby', 'R2:hsrp1': 'Active' })
  })

  it('VIP yoksa (hiçbir router aktif değil) PC ağ geçidine ulaşamaz', () => {
    const rt = createLab(lab())
    expect(pcPing(rt, '192.168.9.10')).not.toContain('84 bytes from')
    expect(firstRouter(rt)).toBeNull()
  })

  it("aynı grup, farklı VIP: tek seçim (Active + Standby), farklı VIP'li router DIFFVIP1 yazar", () => {
    const rt = createLab(lab())
    cfg(rt, 'R1', HSRP(110))
    cfg(rt, 'R2', 'interface g0/0\nstandby 1 ip 192.168.1.253')
    expect(states(rt)).toEqual({ 'R1:hsrp1': 'Active', 'R2:hsrp1': 'Standby' })
    const logs = rt.logs.filter((l) => l.dev === 'R2').map((l) => l.text).join('\n')
    expect(logs).toContain('%HSRP-4-DIFFVIP1: Gi0/0 Grp 1 active routers virtual IP address 192.168.1.254 is different to the locally configured address 192.168.1.253')
    expect(rt.logs.filter((l) => l.dev === 'R1').map((l) => l.text).join('\n')).not.toContain('DIFFVIP1')
    // show standby yerel VIP'i gösterir
    expect(run(rt, 'R2', 'show standby')).toContain('  Virtual IP address is 192.168.1.253')
    expect(run(rt, 'R2', 'show standby brief')).toMatch(/Gi0\/0\s+1\s+100\s+Standby\s+192\.168\.1\.2\s+local\s+192\.168\.1\.253/)
    // ağ geçidi Active'in VIP'i (.254): trafik R1'den; Standby'ın yerel VIP'ini (.253) kimse yanıtlamaz
    expect(pcPing(rt, '192.168.9.10').match(/84 bytes from/g)?.length).toBe(5)
    expect(firstRouter(rt)).toBe('R1')
    expect(pcPing(rt, '192.168.1.253')).not.toContain('84 bytes from')
    // Active düşünce R2 devralır ve kendi VIP'ini (.253) yanıtlar; .254 artık yanıtsız
    rt.setPower('R1', false)
    expect(states(rt)['R2:hsrp1']).toBe('Active')
    expect(pcPing(rt, '192.168.1.253').match(/84 bytes from/g)?.length).toBe(5)
    expect(pcPing(rt, '192.168.9.10')).not.toContain('84 bytes from')
  })

  it('grup numarası farklıysa iki Active, Standby bilinmiyor', () => {
    const rt = createLab(lab({ R1: HSRP(110), R2: 'interface g0/0\nstandby 2 ip 192.168.1.254' }))
    expect(states(rt)).toEqual({ 'R1:hsrp1': 'Active', 'R2:hsrp2': 'Active' })
    expect(run(rt, 'R2', 'show standby brief')).toMatch(/Gi0\/0\s+2\s+100\s+Active\s+local\s+unknown\s+192\.168\.1\.254/)
  })

  it('IOS sözdizimi: geçersiz grup/öncelik reddedilir, running-config satırları', () => {
    const rt = createLab(lab({ R1: HSRP(110, true, ['track 1 interface g0/1 line-protocol', 'interface g0/0', 'standby 1 track 1 decrement 20']) }))
    expect(bad(cfg(rt, 'R1', 'interface g0/0\nstandby 256 ip 192.168.1.250'))).toHaveLength(1)
    expect(bad(cfg(rt, 'R1', 'interface g0/0\nstandby 1 priority 256'))).toHaveLength(1)
    const rc = run(rt, 'R1', 'show running-config')
    expect(rc).toContain('track 1 interface GigabitEthernet0/1 line-protocol')
    expect(rc).toContain(' standby 1 ip 192.168.1.254\n standby 1 priority 110\n standby 1 preempt\n standby 1 track 1 decrement 20')
    cfg(rt, 'R1', 'interface g0/0\nno standby 1')
    expect(run(rt, 'R1', 'show running-config')).not.toContain('standby 1')
    expect(run(rt, 'R1', 'show standby brief')).not.toContain('Gi0/0')
  })
})

describe('HSRP preempt', () => {
  it('preempt yoksa sonradan gelen yüksek öncelik geri almaz; preempt ile alır', () => {
    const rt = createLab(lab())
    cfg(rt, 'R2', HSRP())
    expect(states(rt)).toEqual({ 'R2:hsrp1': 'Active' })
    cfg(rt, 'R1', HSRP(110))
    expect(states(rt)).toEqual({ 'R1:hsrp1': 'Standby', 'R2:hsrp1': 'Active' })
    expect(firstRouter(rt)).toBe('R2')
    cfg(rt, 'R1', 'interface g0/0\nstandby 1 preempt')
    expect(states(rt)).toEqual({ 'R1:hsrp1': 'Active', 'R2:hsrp1': 'Standby' })
    expect(firstRouter(rt)).toBe('R1')
    expect(rt.logs.map((l) => l.text).join('\n')).toMatch(/%HSRP-5-STATECHANGE: Gi0\/0 Grp 1 state Standby -> Active/)
  })
})

describe('HSRP track', () => {
  it('izlenen arayüz düşünce öncelik azalır, preempt eden yedek devralır; geri gelince geri alınır', () => {
    const r1 = HSRP(110, true, ['exit', 'track 1 interface g0/1 line-protocol', 'interface g0/0', 'standby 1 track 1 decrement 20'])
    const rt = createLab(lab({ R1: r1, R2: HSRP(100, true) }))
    expect(states(rt)).toEqual({ 'R1:hsrp1': 'Active', 'R2:hsrp1': 'Standby' })
    cfg(rt, 'R1', 'interface g0/1\nshutdown')
    expect(states(rt)).toEqual({ 'R1:hsrp1': 'Standby', 'R2:hsrp1': 'Active' })
    expect(run(rt, 'R1', 'show standby')).toContain('  Priority 90 (configured 110)\n    Track object 1 state Down decrement 20')
    expect(run(rt, 'R1', 'show track')).toContain('  Line protocol is Down')
    expect(pcPing(rt, '192.168.9.10').match(/84 bytes from/g)?.length).toBe(5)
    expect(firstRouter(rt)).toBe('R2')
    cfg(rt, 'R1', 'interface g0/1\nno shutdown')
    expect(states(rt)).toEqual({ 'R1:hsrp1': 'Active', 'R2:hsrp1': 'Standby' })
  })

  it('yedek preempt etmiyorsa düşük öncelikli Active kalır (trafik R1 üzerinden kaybolur)', () => {
    const r1 = HSRP(110, true, ['exit', 'track 1 interface g0/1 line-protocol', 'interface g0/0', 'standby 1 track 1 decrement 20'])
    const rt = createLab(lab({ R1: r1, R2: HSRP() }))
    cfg(rt, 'R1', 'interface g0/1\nshutdown')
    expect(states(rt)).toEqual({ 'R1:hsrp1': 'Active', 'R2:hsrp1': 'Standby' })
    expect(firstRouter(rt)).toBe('R1')
  })

  it('arayüz izleme (nesnesiz) varsayılan azaltma 10', () => {
    const rt = createLab(lab({ R1: HSRP(105, true, ['standby 1 track g0/1']), R2: HSRP(100, true) }))
    cfg(rt, 'R1', 'interface g0/1\nshutdown')
    expect(states(rt)['R2:hsrp1']).toBe('Active')
    expect(run(rt, 'R1', 'show running-config')).toContain(' standby 1 track GigabitEthernet0/1')
  })
})

describe('Güç ve arayüz kesintisi', () => {
  it('Active kapanınca Standby devralır; preempt yoksa açılan Active geri almaz', () => {
    const rt = createLab(lab({ R1: HSRP(110), R2: HSRP() }))
    rt.setPower('R1', false)
    expect(states(rt)).toEqual({ 'R1:hsrp1': 'Init', 'R2:hsrp1': 'Active' })
    expect(pcPing(rt, '192.168.9.10').match(/84 bytes from/g)?.length).toBe(5)
    expect(firstRouter(rt)).toBe('R2')
    rt.setPower('R1', true)
    expect(states(rt)).toEqual({ 'R1:hsrp1': 'Standby', 'R2:hsrp1': 'Active' })
  })

  it('preempt varsa açılan yüksek öncelikli router geri alır; arayüz shutdown da devirdir', () => {
    const rt = createLab(lab({ R1: HSRP(110, true), R2: HSRP() }))
    rt.setPower('R1', false)
    rt.setPower('R1', true)
    expect(states(rt)['R1:hsrp1']).toBe('Active')
    cfg(rt, 'R1', 'interface g0/0\nshutdown')
    expect(states(rt)).toEqual({ 'R1:hsrp1': 'Init', 'R2:hsrp1': 'Active' })
    expect(run(rt, 'R1', 'show standby')).toContain('  State is Init (interface down)')
  })

  it('iki router da kapalıyken PC dışarı çıkamaz', () => {
    const rt = createLab(lab({ R1: HSRP(110), R2: HSRP() }))
    rt.setPower('R1', false)
    rt.setPower('R2', false)
    expect(pcPing(rt, '192.168.9.10')).not.toContain('84 bytes from')
  })
})

describe('VRRP', () => {
  it('preempt varsayılan açık: sonradan gelen yüksek öncelik Master olur; Backup ve sanal MAC', () => {
    const rt = createLab(lab())
    cfg(rt, 'R2', VRRP())
    expect(states(rt)).toEqual({ 'R2:vrrp1': 'Master' })
    cfg(rt, 'R1', VRRP(110))
    expect(states(rt)).toEqual({ 'R1:vrrp1': 'Master', 'R2:vrrp1': 'Backup' })
    expect(firstRouter(rt)).toBe('R1')
    const brief = run(rt, 'R1', 'show vrrp brief')
    expect(brief).toContain('Interface          Grp Pri Time  Own Pre State   Master addr     Group addr')
    expect(brief).toMatch(/Gi0\/0\s+1\s+110 3570\s+Y\s+Master\s+192\.168\.1\.2\s+192\.168\.1\.254/)
    expect(run(rt, 'R2', 'show vrrp brief')).toMatch(/Gi0\/0\s+1\s+100 3609\s+Y\s+Backup\s+192\.168\.1\.2\s+192\.168\.1\.254/)
    pcPing(rt, '192.168.9.10')
    expect((createSession(rt, 'PC') as VpcsSession).exec('show arp').join('\n')).toContain('00:00:5e:00:01:01  192.168.1.254')
    expect(run(rt, 'R1', 'show vrrp')).toContain('  Virtual MAC address is 0000.5e00.0101')
    expect(rt.logs.map((l) => l.text).join('\n')).toMatch(/%VRRP-6-STATECHANGE: Gi0\/0 Grp 1 state Master -> Backup/)
  })

  it('`no vrrp N preempt`: Master yerinde kalır', () => {
    const rt = createLab(lab())
    cfg(rt, 'R2', VRRP())
    // preempt öncelikten önce kapatılır: açıkken öncelik 110 girildiği anda devralırdı
    cfg(rt, 'R1', 'interface g0/0\nvrrp 1 ip 192.168.1.254\nno vrrp 1 preempt\nvrrp 1 priority 110')
    expect(states(rt)).toEqual({ 'R1:vrrp1': 'Backup', 'R2:vrrp1': 'Master' })
    expect(run(rt, 'R1', 'show running-config')).toContain(' vrrp 1 ip 192.168.1.254\n vrrp 1 priority 110\n no vrrp 1 preempt')
    expect(bad(cfg(rt, 'R1', 'interface g0/0\nvrrp 1 priority 255'))).toHaveLength(1)
    expect(bad(cfg(rt, 'R1', 'interface g0/0\nvrrp 0 ip 192.168.1.250'))).toHaveLength(1)
  })

  it('adres sahibi (VIP = arayüz adresi) öncelik 255 ile Master; kapanınca Backup devralır', () => {
    const rt = createLab(lab())
    cfg(rt, 'R2', 'interface g0/0\nvrrp 1 ip 192.168.1.2\nvrrp 1 priority 200')
    cfg(rt, 'R1', 'interface g0/0\nvrrp 1 ip 192.168.1.2')
    runScript(rt, 'R1', 'copy running-config startup-config\n')
    expect(states(rt)).toEqual({ 'R1:vrrp1': 'Master', 'R2:vrrp1': 'Backup' })
    expect(run(rt, 'R1', 'show vrrp brief')).toMatch(/Gi0\/0\s+1\s+255 3003\s+Y\s+Y\s+Master/)
    rt.setPower('R1', false)
    expect(states(rt)['R2:vrrp1']).toBe('Master')
    // sahip kapalıyken sahibin adresine ping'i yeni Master yanıtlar
    expect(pcPing(rt, '192.168.1.2').match(/84 bytes from/g)?.length).toBe(5)
    rt.setPower('R1', true)
    expect(states(rt)['R1:vrrp1']).toBe('Master')
  })

  it('aynı grup, farklı VIP: ilan düşürülür (RFC 3768 7.1), iki Master', () => {
    const rt = createLab(lab({ R1: VRRP(110), R2: 'interface g0/0\nvrrp 1 ip 192.168.1.253' }))
    expect(states(rt)).toEqual({ 'R1:vrrp1': 'Master', 'R2:vrrp1': 'Master' })
  })

  it('grup numarası farklıysa iki Master', () => {
    const rt = createLab(lab({ R1: VRRP(110), R2: 'interface g0/0\nvrrp 2 ip 192.168.1.254' }))
    expect(states(rt)).toEqual({ 'R1:vrrp1': 'Master', 'R2:vrrp2': 'Master' })
  })
})

describe('LabQuery.fhrpActive', () => {
  it('router/arayüz/grup Active ya da Master mı', () => {
    const rt = createLab(lab({ R1: HSRP(110), R2: HSRP() }))
    expect(rt.query().fhrpActive('R1', 'g0/0', 1)).toBe(true)
    expect(rt.query().fhrpActive('R2', 'GigabitEthernet0/0', 1)).toBe(false)
    expect(rt.query().fhrpActive('R1', 'g0/0', 2)).toBe(false)
    rt.setPower('R1', false)
    expect(rt.query().fhrpActive('R2', 'g0/0', 1)).toBe(true)
  })
})

// ---------------- köprü (AğLab ⇄ Labber) ----------------
import { createRuntime, toAglab, toLabber } from '../../src/sim-bridge/bridge'
import type { AglabTopology } from '../../src/sim-bridge/aglab'

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
const aglabRouter = (id: string, ip: string, extra: Record<string, unknown> = {}) => ({
  id, name: id.toUpperCase(), type: 'Router', x: 0, y: 0, enabled: true, ports: ['g0/0', 'g0/1'],
  interfaces: { 'g0/0': { enabled: true, ip, mask: '255.255.255.0', ...extra }, 'g0/1': { enabled: true, ip: ip.replace('192.168.1.', '10.0.0.'), mask: '255.255.255.0' } },
  staticRoutes: [],
})
/** PC — SW — R1/R2 (HSRP grup 1, VIP .254) */
function aglab(r1: Record<string, unknown>, r2: Record<string, unknown>): AglabTopology {
  return {
    app: 'AgLab', version: 23,
    devices: [
      { id: 'pc', name: 'PC', type: 'PC', x: 0, y: 0, enabled: true, ip: '192.168.1.10', mask: '255.255.255.0', gateway: '192.168.1.254', ports: ['eth0'], interfaces: { eth0: { enabled: true } } },
      { id: 'sw', name: 'SW', type: 'Switch', x: 0, y: 0, enabled: true, ports: ['fa0/1', 'fa0/2', 'fa0/3'], vlans: [1],
        interfaces: Object.fromEntries(['fa0/1', 'fa0/2', 'fa0/3'].map((p) => [p, { mode: 'access', vlan: 1, allowed: [1], nativeVlan: 1, enabled: true }])) },
      aglabRouter('r1', '192.168.1.2', r1),
      aglabRouter('r2', '192.168.1.3', r2),
    ],
    links: [
      { a: 'pc', portA: 'eth0', b: 'sw', portB: 'fa0/1', up: true },
      { a: 'r1', portA: 'g0/0', b: 'sw', portB: 'fa0/2', up: true },
      { a: 'r2', portA: 'g0/0', b: 'sw', portB: 'fa0/3', up: true },
    ],
  }
}

describe('köprü: FHRP', () => {
  it('hsrp/vrrp/tracks Labber kararında; seçim çalışır; gidiş-dönüş birebir', () => {
    const t = aglab(
      { hsrp: [{ group: 1, ip: '192.168.1.254', priority: 110, preempt: true, track: [{ object: 1, decrement: 20 }, { interface: 'g0/1' }] }], vrrp: [{ group: 5, ip: '192.168.1.250', preempt: false }] },
      { hsrp: [{ group: 1, ip: '192.168.1.254' }], vrrp: [{ group: 5, ip: '192.168.1.250', priority: 120 }] },
    )
    ;(t.devices[2] as Record<string, unknown>)['tracks'] = [{ id: 1, interface: 'g0/1' }]
    const r = toLabber(t)
    expect(r.report.engineDecision, JSON.stringify(r.report.reasons)).toBe('labber')
    const rt = createRuntime(r)
    // R1'in g0/1'i kablosuz (line protocol down): iki izleme düşük → 110 - 20 - 10 = 80 < 100
    expect(rt.query().fhrpActive('r1', 'g0/0', 1)).toBe(false)
    expect(rt.query().fhrpActive('r2', 'g0/0', 1)).toBe(true)
    expect(runScript(rt, 'r1', 'show standby').join('\n')).toContain('  Priority 80 (configured 110)')
    expect(rt.query().fhrpActive('r2', 'g0/0', 5)).toBe(true)
    expect(runScript(rt, 'r1', 'show running-config').join('\n')).toContain('track 1 interface GigabitEthernet0/1 line-protocol')
    expect(toAglab(rt, t)).toEqual(t)
    // ping PC → VIP (Active yanıtlar)
    expect((createSession(rt, 'pc') as VpcsSession).exec('ping 192.168.1.254').join('\n')).toContain('84 bytes from 192.168.1.254')
  })

  it('varsayılana eşit özgün alanlar (priority 100, preempt false, boş liste) korunur', () => {
    const t = aglab({ hsrp: [{ group: 1, ip: '192.168.1.254', priority: 100, preempt: false, track: [] }] }, { vrrp: [], hsrp: [{ group: 1, ip: '192.168.1.254' }] })
    expect(toAglab(createRuntime(toLabber(t)), t)).toEqual(t)
  })

  it('CLI değişikliği AğLab görünümüne yazılır; kaldırılan grup alanı siler', () => {
    const t = aglab({ hsrp: [{ group: 1, ip: '192.168.1.254' }] }, {})
    const rt = createRuntime(toLabber(t))
    runScript(rt, 'r2', 'configure terminal\ninterface g0/0\nstandby 1 ip 192.168.1.254\nstandby 1 priority 150\nstandby 1 preempt\nexit\ntrack 7 interface g0/1 line-protocol\ninterface g0/0\nstandby 1 track 7 decrement 60\nend')
    runScript(rt, 'r1', 'configure terminal\ninterface g0/0\nno standby 1\nend')
    const v = toAglab(rt, t)
    expect(v.devices[3]!['tracks']).toEqual([{ id: 7, interface: 'g0/1' }])
    expect(v.devices[3]!.interfaces!['g0/0']!['hsrp']).toEqual([{ group: 1, ip: '192.168.1.254', priority: 150, preempt: true, track: [{ object: 7, decrement: 60 }] }])
    expect('hsrp' in v.devices[2]!.interfaces!['g0/0']!).toBe(false)
    expect(toLabber(v).report.engineDecision).toBe('labber')
  })

  it('geçersiz FHRP alanı reddedilir (karar eski motor, neden görünür); bilinmeyen alan desteklenmiyor', () => {
    for (const bad of [
      { hsrp: [{ group: 256, ip: '192.168.1.254' }] },
      { hsrp: [{ group: 1, ip: '192.168.1.300' }] },
      { vrrp: [{ group: 0, ip: '192.168.1.254' }] },
      { vrrp: [{ group: 1, ip: '192.168.1.254', priority: 255 }] },
      { hsrp: [{ group: 1, ip: '192.168.1.254' }, { group: 1, ip: '192.168.1.253' }] },
      { hsrp: [{ group: 1, ip: '192.168.1.254', track: [{ interface: 'g9/9' }] }] },
      { hsrp: { group: 1 } },
    ]) {
      const r = toLabber(aglab(bad, {}))
      expect(r.report.engineDecision, JSON.stringify(bad)).toBe('legacy')
      expect(r.report.rejected.length, JSON.stringify(bad)).toBeGreaterThan(0)
    }
    const r = toLabber(aglab({ hsrp: [{ group: 1, ip: '192.168.1.254', timers: [3, 10] }] }, {}))
    expect(r.report.unsupported.map((u) => u.field)).toEqual(['interfaces.g0/0.hsrp[0].timers'])
    const t = aglab({}, {})
    ;(t.devices[2] as Record<string, unknown>)['tracks'] = [{ id: 1, interface: 'g7/0' }]
    expect(toLabber(t).report.rejected.map((x) => x.item)).toEqual(['tracks'])
  })

  it('aynı topoloji klonu ile kararlı (giriş değiştirilmez)', () => {
    const t = aglab({ hsrp: [{ group: 1, ip: '192.168.1.254', priority: 110 }] }, { hsrp: [{ group: 1, ip: '192.168.1.254' }] })
    const before = clone(t)
    toAglab(createRuntime(toLabber(t)), t)
    expect(t).toEqual(before)
  })
})
