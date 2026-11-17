// MST (IEEE 802.1s), Catalyst IOS 15 davranışı: bölge (ad + revizyon + VLAN→örnek eşlemesi),
// CIST (örnek 0) ve bölge içi MSTI'ler, bölge sınırı (başka bölge / PVST+ komşusu), (config-mst)
// kipinde bekleyen yapılandırma (exit uygular, abort atar). Her davranış hem başarılı hem
// başarısız durumla sınanır.
import { describe, expect, it } from 'vitest'
import { createLab, createSession, runScript, type VpcsSession } from '../../src/sim'
import { applyConfigText } from '../../src/sim/config-text'
import type { LabRuntime } from '../../src/sim/runtime'
import type { LabDef } from '../../src/sim/types'
import { ports } from '../../src/sim/util'

const sw = (id: string, n: number) => ({ id, kind: 'switch' as const, model: 'WS-C2960-24TT-L', mac: `5254.000${n}.0000`, ports: ports('Fa0/1-24', 'Gi0/1-2'), x: 0, y: 0 })
const pc = (id: string, n: number) => ({ id, kind: 'pc' as const, mac: `0050.0000.00${n}0`, x: 0, y: 0 })

const REGION = ['spanning-tree mode mst', 'spanning-tree mst configuration', 'name BOLGE', 'revision 1', 'instance 1 vlan 10', 'instance 2 vlan 20', 'exit']

/**
 * Üçgen: SW1 Gi0/1 – SW2 Gi0/1, SW2 Gi0/2 – SW3 Gi0/1, SW3 Gi0/2 – SW1 Gi0/2 (trunk).
 * VLAN 10 → MST1 (kök SW1), VLAN 20 → MST2 (kök SW2), VLAN 30 eşlenmemiş (MST0).
 * H10a SW2 Fa0/1, H10b SW3 Fa0/1 (VLAN 10); H20a SW1 Fa0/2, H20b SW3 Fa0/2 (VLAN 20).
 */
function lab(extra: Record<string, string> = {}): LabDef {
  const base = (dev: string, more: string[]) =>
    ['vlan 10,20,30', 'exit', 'interface range gi0/1 - 2', 'switchport mode trunk', 'exit', ...more, ...(extra[dev] ? extra[dev]!.split('\n') : [])].join('\n')
  return {
    id: 'mst', title: '', summary: '', level: 'İleri', tags: [], brief: [], objectives: [], solution: {}, view: { w: 1, h: 1 },
    devices: [sw('SW1', 1), sw('SW2', 2), sw('SW3', 3), pc('H10a', 1), pc('H10b', 2), pc('H20a', 3), pc('H20b', 4)],
    links: [
      { a: ['SW1', 'GigabitEthernet0/1'], b: ['SW2', 'GigabitEthernet0/1'] },
      { a: ['SW2', 'GigabitEthernet0/2'], b: ['SW3', 'GigabitEthernet0/1'] },
      { a: ['SW3', 'GigabitEthernet0/2'], b: ['SW1', 'GigabitEthernet0/2'] },
      { a: ['H10a', 'eth0'], b: ['SW2', 'FastEthernet0/1'] },
      { a: ['H10b', 'eth0'], b: ['SW3', 'FastEthernet0/1'] },
      { a: ['H20a', 'eth0'], b: ['SW1', 'FastEthernet0/2'] },
      { a: ['H20b', 'eth0'], b: ['SW3', 'FastEthernet0/2'] },
    ],
    initialConfig: {
      SW1: base('SW1', [...REGION, 'spanning-tree mst 1 priority 24576', 'interface fa0/2', 'switchport access vlan 20', 'exit']),
      SW2: base('SW2', [...REGION, 'spanning-tree mst 2 priority 24576', 'interface fa0/1', 'switchport access vlan 10', 'exit']),
      SW3: base('SW3', [...REGION, 'interface fa0/1', 'switchport access vlan 10', 'interface fa0/2', 'switchport access vlan 20', 'exit']),
    },
    initialPcs: {
      H10a: { ip: '192.168.10.1', prefix: 24, gw: '' }, H10b: { ip: '192.168.10.2', prefix: 24, gw: '' },
      H20a: { ip: '192.168.20.1', prefix: 24, gw: '' }, H20b: { ip: '192.168.20.2', prefix: 24, gw: '' },
    },
  }
}

const run = (rt: LabRuntime, dev: string, cmd: string) => runScript(rt, dev, cmd).join('\n')
const cfg = (rt: LabRuntime, dev: string, script: string) => runScript(rt, dev, 'configure terminal\n' + script + '\nend')
const bad = (out: string[]) => out.filter((l) => /^%/.test(l.trim()))
const ping = (rt: LabRuntime, from: string, ip: string) => (createSession(rt, from) as VpcsSession).exec('ping ' + ip).join('\n')
const st = (rt: LabRuntime, dev: string, port: string, vlan: number) => rt.query().stpState(dev, port, vlan)
const LINKS: [string, string, string, string][] = [
  ['SW1', 'Gi0/1', 'SW2', 'Gi0/1'],
  ['SW2', 'Gi0/2', 'SW3', 'Gi0/1'],
  ['SW3', 'Gi0/2', 'SW1', 'Gi0/2'],
]
/** VLAN'ı iki ucunda da ileten switch–switch bağlantıları (döngüsüz üçgende tam 2). */
const fwdLinks = (rt: LabRuntime, vlan: number) =>
  LINKS.filter(([a, pa, b, pb]) => st(rt, a, pa, vlan) === 'FWD' && st(rt, b, pb, vlan) === 'FWD').map(([a, , b]) => a + '-' + b)
const mac = (rt: LabRuntime, pcId: string) => rt.query().d.topo.devices[pcId]!.mac

describe('MST (802.1s)', () => {
  it('iki örnek, iki kök: farklı portlar bloke, VLAN 10 ve 20 farklı yollardan', () => {
    const rt = createLab(lab())
    const q = rt.query()
    expect([q.mstInstance('SW1', 10), q.mstInstance('SW1', 20), q.mstInstance('SW1', 30), q.mstInstance('SW1', 1)]).toEqual([1, 2, 0, 0])
    expect(q.mstRoot('SW3', 1)?.dev).toBe('SW1')
    expect(q.mstRoot('SW3', 2)?.dev).toBe('SW2')
    expect(q.mstRoot('SW3', 1)?.prio).toBe(24577)
    // MST1: SW2–SW3 bağlantısı SW3 tarafında bloke; MST2: SW1–SW3 bağlantısı SW3 tarafında
    expect([st(rt, 'SW3', 'Gi0/1', 10), st(rt, 'SW3', 'Gi0/2', 10)]).toEqual(['BLK', 'FWD'])
    expect([st(rt, 'SW3', 'Gi0/1', 20), st(rt, 'SW3', 'Gi0/2', 20)]).toEqual(['FWD', 'BLK'])
    expect(fwdLinks(rt, 10)).toEqual(['SW1-SW2', 'SW3-SW1'])
    expect(fwdLinks(rt, 20)).toEqual(['SW1-SW2', 'SW2-SW3'])
    // VLAN 10: SW2 → SW1 → SW3 (SW1 öğrenir); VLAN 20: SW1 → SW2 → SW3 (SW2 öğrenir)
    expect(ping(rt, 'H10a', '192.168.10.2')).toMatch(/bytes from 192\.168\.10\.2/)
    expect(ping(rt, 'H20a', '192.168.20.2')).toMatch(/bytes from 192\.168\.20\.2/)
    expect(rt.query().macPort('SW1', mac(rt, 'H10a'))).toBe('GigabitEthernet0/1')
    expect(rt.query().macPort('SW2', mac(rt, 'H20a'))).toBe('GigabitEthernet0/1')
    // show
    const m1 = run(rt, 'SW1', 'show spanning-tree mst 1')
    expect(m1).toContain('##### MST1    vlans mapped:   10')
    expect(m1).toContain('Root          this switch for MST1')
    expect(run(rt, 'SW3', 'show spanning-tree mst 1')).toMatch(/Gi0\/1\s+Altn BLK 20000\s+128\.\d+\s+P2p/)
    // örnekte yalnız o örneğin VLAN'larını taşıyan portlar (Fa0/2 VLAN 20 → MST2)
    expect(run(rt, 'SW3', 'show spanning-tree mst 1')).toMatch(/Fa0\/1\s+Desg FWD/)
    expect(run(rt, 'SW3', 'show spanning-tree mst 1')).not.toMatch(/Fa0\/2/)
    const v10 = run(rt, 'SW3', 'show spanning-tree vlan 10')
    expect(v10).toContain('MST1\n  Spanning tree enabled protocol mstp')
    expect(v10).toContain('(priority 32768 sys-id-ext 1)')
    expect(run(rt, 'SW1', 'show spanning-tree summary')).toContain('Switch is in mst mode (IEEE Standard)\nRoot bridge for: MST0, MST1')
    expect(run(rt, 'SW1', 'show spanning-tree mst detail')).toContain('GigabitEthernet0/1 of MST1 is designated forwarding')
  })

  it('örnek başına port maliyeti ve öncelik kök portu değiştirir', () => {
    const rt = createLab(lab({ SW3: 'interface gi0/2\nspanning-tree mst 1 cost 200000\nexit' }))
    // MST1'de SW3 artık SW2 üzerinden (20000 + 20000 < 200000); MST2 etkilenmez
    expect([st(rt, 'SW3', 'Gi0/1', 10), st(rt, 'SW3', 'Gi0/2', 10)]).toEqual(['FWD', 'BLK'])
    expect([st(rt, 'SW3', 'Gi0/1', 20), st(rt, 'SW3', 'Gi0/2', 20)]).toEqual(['FWD', 'BLK'])
    expect(fwdLinks(rt, 10)).toEqual(['SW1-SW2', 'SW2-SW3'])
    const pp = createLab(lab({ SW2: 'interface gi0/2\nspanning-tree mst 2 port-priority 64\nexit' }))
    expect(run(pp, 'SW2', 'show spanning-tree mst 2')).toMatch(/Gi0\/2\s+Desg FWD 20000\s+64\.\d+\s+P2p/)
    expect(run(pp, 'SW2', 'show running-config')).toContain(' spanning-tree mst 2 port-priority 64')
  })

  it('eşlenmemiş VLAN örnek 0 (IST); IST kökü ayrı seçilir', () => {
    const rt = createLab(lab({ SW3: 'spanning-tree mst 0 priority 4096' }))
    const q = rt.query()
    expect(q.mstInstance('SW2', 30)).toBe(0)
    expect(q.mstRoot('SW1', 0)?.dev).toBe('SW3')
    expect(q.mstRoot('SW1', 1)?.dev).toBe('SW1')
    // IST kökü SW3: SW1–SW2 bağlantısı bloke (SW2 tarafı: SW1 daha iyi gönderen)
    expect(fwdLinks(rt, 30)).toEqual(['SW2-SW3', 'SW3-SW1'])
    expect(fwdLinks(rt, 10)).toEqual(['SW1-SW2', 'SW3-SW1'])
    expect(run(rt, 'SW3', 'show spanning-tree mst 0')).toContain('Root          this switch for the CIST')
    expect(run(rt, 'SW3', 'show spanning-tree vlan 30')).toContain('MST0\n  Spanning tree enabled protocol mstp')
  })

  it('revizyon farkı → ayrı bölge; sınır portları; MSTI sınırda CIST\'e düşer (yük dengeleme kaybolur)', () => {
    const rt = createLab(lab({ SW3: 'spanning-tree mst configuration\nrevision 2\nexit' }))
    const q = rt.query()
    expect(q.mstRegion('SW1')).toEqual({ name: 'BOLGE', revision: 1, digest: q.mstRegion('SW2').digest })
    expect(q.mstRegion('SW3').revision).toBe(2)
    expect(q.mstRegion('SW3').digest).toBe(q.mstRegion('SW1').digest)
    // CIST kökü SW1 (en düşük MAC). SW3 tek köprülük bölge: SW1'e kök portu, SW2'ye alternate
    for (const v of [10, 20, 30]) {
      expect([st(rt, 'SW3', 'Gi0/1', v), st(rt, 'SW3', 'Gi0/2', v)], `VLAN ${v}`).toEqual(['BLK', 'FWD'])
      expect(fwdLinks(rt, v), `VLAN ${v}`).toEqual(['SW1-SW2', 'SW3-SW1'])
    }
    expect(run(rt, 'SW1', 'show spanning-tree mst 2')).toMatch(/Gi0\/2\s+Desg FWD 20000\s+128\.\d+\s+P2p Bound\(RSTP\)/)
    expect(run(rt, 'SW3', 'show spanning-tree mst 2')).toMatch(/Gi0\/2\s+Mstr FWD/)
    expect(ping(rt, 'H10a', '192.168.10.2')).toMatch(/bytes from/)
    expect(ping(rt, 'H20a', '192.168.20.2')).toMatch(/bytes from/)
    // düzeltme: revizyon eşitlenince yük dengeleme geri gelir
    cfg(rt, 'SW3', 'spanning-tree mst configuration\nrevision 1\nexit')
    expect(fwdLinks(rt, 20)).toEqual(['SW1-SW2', 'SW2-SW3'])
  })

  it('(config-mst): abort atar, exit uygular; show pending / show current', () => {
    const rt = createLab(lab())
    const s = createSession(rt, 'SW1')
    const out: string[] = []
    for (const l of ['enable', 'configure terminal', 'spanning-tree mst configuration']) out.push(...s.exec(l))
    expect(s.prompt()).toBe('SW1(config-mst)#')
    out.push(...s.exec('name YENI'), ...s.exec('revision 7'), ...s.exec('no instance 2'))
    const pending = s.exec('show pending').join('\n')
    expect(pending).toContain('Pending MST configuration\nName      [YENI]\nRevision  7     Instances configured 2')
    expect(s.exec('show current').join('\n')).toContain('Current MST configuration\nName      [BOLGE]\nRevision  1     Instances configured 3')
    out.push(...s.exec('abort'))
    expect(s.prompt()).toBe('SW1(config)#')
    expect(rt.query().mstRegion('SW1')).toMatchObject({ name: 'BOLGE', revision: 1 })
    out.push(...s.exec('spanning-tree mst configuration'), ...s.exec('name YENI'), ...s.exec('instance 3 vlan 20,30'))
    // uygulanmadan önce etkisiz
    expect(rt.query().mstInstance('SW1', 20)).toBe(2)
    out.push(...s.exec('exit'))
    expect(bad(out)).toEqual([])
    expect(rt.query().mstRegion('SW1').name).toBe('YENI')
    expect([rt.query().mstInstance('SW1', 20), rt.query().mstInstance('SW1', 30)]).toEqual([3, 3])
    const conf = run(rt, 'SW1', 'show spanning-tree mst configuration')
    expect(conf).toContain('Name      [YENI]')
    expect(conf).toMatch(/0\s+1-9,11-19,21-29,31-4094/)
    expect(conf).toMatch(/3\s+20,30/)
    // bölge yalnız SW1'de değişti: SW1 artık ayrı bölge
    expect(run(rt, 'SW1', 'show spanning-tree mst 0')).toContain('Bound(RSTP)')
  })

  it('varsayılan bölge özeti IEEE değeri; show spanning-tree mst configuration digest', () => {
    const rt = createLab(lab())
    cfg(rt, 'SW1', 'spanning-tree mst configuration\nno instance 1\nno instance 2\nexit')
    expect(run(rt, 'SW1', 'show spanning-tree mst configuration digest')).toContain('Digest          0xAC36177F50283CD4B83821D8AB26DE62')
  })

  it('MST ↔ Rapid PVST+ komşusu: sınır, döngü yok, ping çalışır', () => {
    const rt = createLab(lab({ SW3: 'spanning-tree mode rapid-pvst' }))
    for (const v of [10, 20, 30]) expect(fwdLinks(rt, v), `VLAN ${v}`).toHaveLength(2)
    expect(run(rt, 'SW1', 'show spanning-tree mst 0')).toMatch(/Gi0\/2\s+\w+ \w+ \d+\s+128\.\d+\s+P2p Bound\(PVST\)/)
    expect(run(rt, 'SW3', 'show spanning-tree vlan 10')).toMatch(/Peer\(STP\)/)
    expect(ping(rt, 'H10a', '192.168.10.2')).toMatch(/bytes from/)
    expect(ping(rt, 'H20a', '192.168.20.2')).toMatch(/bytes from/)
    // PVST+ tarafı: bütün VLAN'lar aynı (CIST) kararı
    expect(new Set([10, 20, 30].map((v) => JSON.stringify(fwdLinks(rt, v)))).size).toBe(1)
  })

  it('portfast / bpduguard MST kipinde de çalışır', () => {
    const rt = createLab(lab({ SW3: 'interface fa0/1\nspanning-tree portfast\nspanning-tree bpduguard enable\nexit' }))
    expect(run(rt, 'SW3', 'show spanning-tree mst 1')).toMatch(/Fa0\/1\s+Desg FWD \d+\s+128\.\d+\s+P2p Edge/)
    expect(ping(rt, 'H10a', '192.168.10.2')).toMatch(/bytes from/)
  })

  it('show running-config → config-text gidiş-dönüşü MST satırlarını korur', () => {
    const rt = createLab(lab({ SW1: 'interface gi0/1\nspanning-tree mst 1 cost 100\nspanning-tree mst 1 port-priority 64\nexit' }))
    const rc = run(rt, 'SW1', 'show running-config')
    const lines = rc.split('\n')
    const at = (l: string) => lines.indexOf(l)
    expect(at('spanning-tree mode mst')).toBeGreaterThan(0)
    expect(rc).toContain('spanning-tree mst configuration\n name BOLGE\n revision 1\n instance 1 vlan 10\n instance 2 vlan 20\n!')
    expect(at('spanning-tree mst 1 priority 24576')).toBeGreaterThan(at(' instance 2 vlan 20'))
    expect(rc).toContain(' spanning-tree mst 1 cost 100\n spanning-tree mst 1 port-priority 64')
    const back = createLab({ ...lab(), initialConfig: {} })
    const res = applyConfigText(back, 'SW1', rc.slice(rc.indexOf('\n!') + 1))
    const ours = res.filter((l) => /spanning-tree|^name|^revision|^instance/.test(l.command))
    // (`spanning-tree extend system-id` zaten zararsız/yok sayıldı sınıfında)
    expect(ours.filter((l) => l.status === 'unmodeled')).toEqual([])
    expect(ours.filter((l) => /mst|^name|^revision|^instance/.test(l.command)).every((l) => l.status === 'applied')).toBe(true)
    const rc2 = run(back, 'SW1', 'show running-config').split('\n')
    for (const l of ['spanning-tree mode mst', 'spanning-tree mst configuration', ' name BOLGE', ' revision 1', ' instance 1 vlan 10', ' instance 2 vlan 20', 'spanning-tree mst 1 priority 24576', ' spanning-tree mst 1 cost 100', ' spanning-tree mst 1 port-priority 64'])
      expect(rc2).toContain(l)
    expect(back.query().mstRegion('SW1')).toEqual(rt.query().mstRegion('SW1'))
  })

  it('geçersiz öncelik ve kapsam dışı komutlar reddedilir', () => {
    const rt = createLab(lab())
    expect(cfg(rt, 'SW1', 'spanning-tree mst 1 priority 1000').join('\n')).toMatch(/increments of 4096/)
    expect(cfg(rt, 'SW1', 'spanning-tree mst 1-2 root primary').join('\n')).not.toMatch(/%/)
    expect(rt.query().mstRoot('SW3', 2)?.dev).toBe('SW1')
  })
})
