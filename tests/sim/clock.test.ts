// Sanal zaman (motor/syslog-zaman-diff, aşama 2): rt.clock, rt.tick ve zamana bağlı davranışlar.
//
// Zaman sanaldır: gerçek saat kullanılmaz. Lab `clock` tanımlarsa ya da `tick` bir kez çağrılırsa
// runtime "zamanlı kip"e geçer; zaman hiç kullanılmayan lab eskisi gibi davranır (errdisable
// kurtarması anlık, konsol damgası eski biçim).
import { describe, expect, it } from 'vitest'
import { LABS } from '../../src/labs/index'
import { createLab, createSession, runScript } from '../../src/sim/index'
import type { LabRuntime } from '../../src/sim/runtime'
import type { LabDef } from '../../src/sim/types'
import { fiber, G1, twoSwitchLab } from './fixtures/phys-lab'

const cfg = (rt: LabRuntime, dev: string, script: string) => runScript(rt, dev, 'configure terminal\n' + script + '\nend')
const up = (rt: LabRuntime, dev = 'SW1', port = G1) => rt.derived.phys[`${dev}|${port}`]!.up
const dirty = fiber('sx', 300, { ends: { a: { sfp: { type: '1000base-sx' }, connectorDirty: true }, b: { sfp: { type: '1000base-sx' } } } })

describe('saat ve tick', () => {
  it('varsayılan saat 0; LabDef.clock.start başlangıç; tick ilerletir, negatif reddedilir', () => {
    const rt = createLab(twoSwitchLab())
    expect(rt.clock).toBe(0)
    rt.tick(12.5)
    expect(rt.clock).toBe(12.5)
    expect(() => rt.tick(-1)).toThrow()
    const rt2 = createLab({ ...twoSwitchLab(), clock: { start: 3600 } })
    expect(rt2.clock).toBe(3600)
  })

  it('günlük damgası sanal saatten: 1 saat 2 dakika 5 saniye sonra', () => {
    const rt = createLab(twoSwitchLab())
    rt.tick(3725)
    rt.setLink('SW1', G1, false)
    expect(rt.log('SW1')[0]!.line).toMatch(/^\*Mar {2}1 01:02:05\.000: %LINK-3-UPDOWN/)
    expect(rt.log('SW1')[0]!.t).toBe(3725)
    expect(rt.log('SW1')[1]!.line).toMatch(/^\*Mar {2}1 01:02:05\.001: /)
    // zamanlı kipte konsol akışı da aynı damgayı kullanır
    expect(rt.logs.at(-1)!.text).toMatch(/^\*Mar {2}1 01:02:05\.00\d: /)
  })

  it('Katman 1 sayaçları zamanla büyür (deterministik); elle backgroundTraffic hâlâ çalışır', () => {
    const a = createLab(twoSwitchLab(dirty))
    const b = createLab(twoSwitchLab(dirty))
    const rx0 = a.counters('SW1', G1).rx
    a.tick(100)
    for (let i = 0; i < 10; i++) b.tick(10)
    expect(a.counters('SW1', G1)).toEqual(b.counters('SW1', G1))
    expect(a.counters('SW1', G1).rx).toBeGreaterThan(rx0)
    expect(a.counters('SW1', G1).crc).toBeGreaterThan(0)
    const before = a.counters('SW1', G1).rx
    a.backgroundTraffic(50)
    expect(a.counters('SW1', G1).rx).toBe(before + 50)
  })

  it('MAC tablosu sanal saatle yaşlanır (300 s)', () => {
    const rt = createLab(twoSwitchLab())
    rt.tick(1)
    createSession(rt, 'PC1').exec('ping 192.168.1.12')
    expect(rt.query().macTable('SW1').length).toBeGreaterThan(0)
    rt.tick(299)
    expect(rt.query().macTable('SW1').length).toBeGreaterThan(0)
    rt.tick(2)
    expect(rt.query().macTable('SW1')).toEqual([])
  })
})

describe('errdisable recovery (zamanlı kip)', () => {
  const lab = LABS.find((l) => l.id === 'bpdu-guard')!
  const ed = (rt: LabRuntime, p: string) => rt.derived.phys['ASW1|' + p]!.errDisabled

  it('zaman kullanılmayan lab: kurtarma eskisi gibi anlık', () => {
    const rt = createLab(lab)
    cfg(rt, 'ASW1', 'errdisable recovery cause bpduguard\ninterface gi0/2\nno spanning-tree bpduguard')
    expect(ed(rt, 'GigabitEthernet0/2')).toBe(false)
  })

  it('zamanlı kipte süre dolunca denenir; neden sürüyorsa yeniden err-disable', () => {
    const rt = createLab({ ...lab, clock: {} })
    cfg(rt, 'ASW1', 'errdisable recovery cause bpduguard\nerrdisable recovery interval 60\ninterface gi0/2\nno spanning-tree bpduguard')
    expect(ed(rt, 'GigabitEthernet0/2')).toBe(true)
    expect(runScript(rt, 'ASW1', 'show errdisable recovery').join('\n')).toMatch(/Gi0\/2 +bpduguard +60/)
    rt.tick(59)
    expect(ed(rt, 'GigabitEthernet0/2')).toBe(true)
    expect(runScript(rt, 'ASW1', 'show errdisable recovery').join('\n')).toMatch(/Gi0\/2 +bpduguard +1\b/)
    rt.tick(1)
    expect(ed(rt, 'GigabitEthernet0/2')).toBe(false)
    expect(rt.query().logHas('ASW1', 'ERR_RECOVER')).toBe(true)
    // neden sürüyor: fa0/3 BPDU alıyor → kurtarılır, hemen yeniden err-disable
    cfg(rt, 'ASW1', 'interface fa0/3\nspanning-tree bpduguard enable')
    if (ed(rt, 'FastEthernet0/3')) {
      rt.tick(60)
      expect(ed(rt, 'FastEthernet0/3')).toBe(true)
      expect(rt.query().logCount('ASW1', 'ERR_DISABLE')).toBeGreaterThanOrEqual(2)
    }
  })

  it('recovery kapalıyken zaman geçse de port err-disabled kalır', () => {
    const rt = createLab({ ...lab, clock: {} })
    cfg(rt, 'ASW1', 'interface gi0/2\nno spanning-tree bpduguard')
    rt.tick(3600)
    expect(ed(rt, 'GigabitEthernet0/2')).toBe(true)
  })

  it('psecure-violation kurtarması da zamana bağlı', () => {
    const rt = createLab(twoSwitchLab())
    cfg(rt, 'SW1', 'errdisable recovery cause psecure-violation\nerrdisable recovery interval 30\ninterface fa0/1\nswitchport mode access\nswitchport port-security\nswitchport port-security mac-address 0000.1111.2222')
    rt.tick(1)
    createSession(rt, 'PC1').exec('ping 192.168.1.12')
    expect(up(rt, 'SW1', 'FastEthernet0/1')).toBe(false)
    expect(runScript(rt, 'SW1', 'show running-config').join('\n')).toContain('errdisable recovery cause psecure-violation')
    rt.tick(30)
    expect(up(rt, 'SW1', 'FastEthernet0/1')).toBe(true)
  })
})

describe('flap eden link', () => {
  it('periyot 10 s, 6 s up: faz saatten; her geçişte LINK/LINEPROTO satırı', () => {
    const rt = createLab(twoSwitchLab())
    rt.setFlap('SW1', G1, { periodS: 10, upS: 6 })
    expect(up(rt)).toBe(true) // saat 0: faz 0 < 6
    rt.tick(5.9)
    expect(up(rt)).toBe(true)
    rt.tick(0.1)
    expect(up(rt)).toBe(false)
    expect(rt.log('SW1').at(-1)!.text).toBe('Line protocol on Interface GigabitEthernet0/1, changed state to down')
    expect(rt.log('SW1').at(-2)!.t).toBe(6)
    rt.tick(4)
    expect(up(rt)).toBe(true)
    rt.clearLog('SW1')
    rt.tick(100) // 10 periyot: 10 düşüş + 10 kalkış
    expect(rt.query().logCount('SW1', 'LINK-3-UPDOWN')).toBe(20)
    expect(rt.query().logCount('SW2', 'LINK-3-UPDOWN')).toBeGreaterThanOrEqual(20)
    rt.setFlap('SW1', G1, null)
    expect(up(rt)).toBe(true)
    rt.tick(100)
    expect(up(rt)).toBe(true)
  })

  it('tek büyük tick ile küçük tick\'ler aynı sonucu verir', () => {
    const run = (steps: number[]) => {
      const rt = createLab(twoSwitchLab())
      rt.setFlap('SW1', G1, { periodS: 7, upS: 3 })
      for (const s of steps) rt.tick(s)
      return { up: up(rt), log: rt.log('SW1').map((e) => e.line) }
    }
    expect(run([50])).toEqual(run([10, 10, 10, 10, 10]))
    expect(run([50])).toEqual(run(Array.from({ length: 50 }, () => 1)))
  })

  it('flap OSPF\'i yeniden hesaplar (komşuluk düşer/kalkar)', () => {
    const lab = LABS.find((l) => l.id === 'ospf-tek-alan')!
    const rt = createLab(lab)
    for (const [dev, s] of Object.entries(lab.solution)) runScript(rt, dev, s)
    const dev = Object.keys(rt.derived.ospf).find((d) => rt.derived.ospf[d]!.nbrs.some((n) => n.state === 'FULL'))!
    const nbr = rt.derived.ospf[dev]!.nbrs.find((n) => n.state === 'FULL')!
    rt.setFlap(dev, nbr.ifname, { periodS: 20, upS: 10 })
    rt.tick(10)
    expect(rt.derived.ospf[dev]!.nbrs.some((n) => n.rid === nbr.rid && n.state === 'FULL')).toBe(false)
    rt.tick(10)
    expect(rt.derived.ospf[dev]!.nbrs.some((n) => n.rid === nbr.rid && n.state === 'FULL')).toBe(true)
    expect(rt.query().logCount(dev, 'ADJCHG')).toBeGreaterThanOrEqual(2)
  })
})

describe('zamanlanmış olaylar (kaos)', () => {
  it('tam zamanında devreye girer; iptal edilebilir; liste sıralı', () => {
    const rt = createLab(twoSwitchLab())
    const a = rt.schedule(30, { type: 'link', dev: 'SW1', port: G1, up: false })
    const b = rt.schedule(10, { type: 'power', dev: 'PC2', on: false })
    const c = rt.schedule(20, { type: 'link', dev: 'SW1', port: 'FastEthernet0/1', up: false })
    expect(rt.scheduled().map((e) => e.id)).toEqual([b, c, a])
    expect(rt.unschedule(c)).toBe(true)
    expect(rt.unschedule(c)).toBe(false)
    rt.tick(9.99)
    expect(rt.powered('PC2')).toBe(true)
    rt.tick(0.01)
    expect(rt.powered('PC2')).toBe(false)
    rt.tick(19.99)
    expect(up(rt)).toBe(true)
    expect(up(rt, 'SW1', 'FastEthernet0/1')).toBe(true)
    rt.tick(0.01)
    expect(up(rt)).toBe(false)
    expect(rt.log('SW1').find((e) => e.mnemonic === 'UPDOWN')!.t).toBe(30)
    expect(rt.scheduled()).toEqual([])
  })

  it('flap, sfp ve cable eylemleri', () => {
    const rt = createLab(twoSwitchLab(fiber('lx', 1000)))
    rt.schedule(5, { type: 'sfp', dev: 'SW2', port: G1, sfp: { type: '1000base-sx' } })
    rt.schedule(10, { type: 'sfp', dev: 'SW2', port: G1, sfp: { type: '1000base-lx' } })
    rt.schedule(15, { type: 'cable', dev: 'SW1', port: G1, cable: { kind: 'fiber-sm', lengthM: 200000 } })
    rt.schedule(20, { type: 'cable', dev: 'SW1', port: G1, cable: { kind: 'fiber-sm', lengthM: 500 } })
    rt.schedule(25, { type: 'flap', dev: 'SW1', port: G1, flap: { periodS: 4, upS: 2 } })
    rt.tick(5)
    expect(up(rt)).toBe(false)
    rt.tick(5)
    expect(up(rt)).toBe(true)
    rt.tick(5)
    expect(up(rt)).toBe(false)
    rt.tick(5)
    expect(up(rt)).toBe(true)
    rt.tick(7) // saat 27: faz 27 mod 4 = 3 ≥ 2 → down
    expect(up(rt)).toBe(false)
  })

  it('geçmiş zamana kurulan olay bir sonraki tick\'te çalışır', () => {
    const rt = createLab(twoSwitchLab())
    rt.tick(50)
    rt.schedule(10, { type: 'link', dev: 'SW1', port: G1, up: false })
    expect(up(rt)).toBe(true)
    rt.tick(0)
    expect(up(rt)).toBe(false)
  })
})

describe('güç ve açılış süresi', () => {
  it('powerOn bootS: açılış süresince cihaz kapalı/cevapsız, sonra çalışır', () => {
    const rt = createLab(twoSwitchLab())
    rt.setPower('SW2', false)
    rt.powerOn('SW2', { bootS: 90 })
    expect(rt.isBooting('SW2')).toBe(true)
    expect(rt.powered('SW2')).toBe(false)
    expect(() => createSession(rt, 'SW2')).toThrow()
    expect(up(rt)).toBe(false)
    rt.tick(89)
    expect(rt.isBooting('SW2')).toBe(true)
    rt.tick(1)
    expect(rt.isBooting('SW2')).toBe(false)
    expect(rt.powered('SW2')).toBe(true)
    expect(up(rt)).toBe(true)
    // bootS yok: hemen açılır
    rt.setPower('SW2', false)
    rt.powerOn('SW2')
    expect(rt.powered('SW2')).toBe(true)
  })

  it('zamanlanmış güç kesintisi + açılış süresi', () => {
    const rt = createLab(twoSwitchLab())
    rt.schedule(10, { type: 'power', dev: 'SW2', on: false })
    rt.schedule(20, { type: 'power', dev: 'SW2', on: true, bootS: 30 })
    rt.tick(25)
    expect(rt.isBooting('SW2')).toBe(true)
    rt.tick(25)
    expect(rt.powered('SW2')).toBe(true)
  })
})

describe('okSince (SLA verisi)', () => {
  const lab = (): LabDef => ({
    ...twoSwitchLab(),
    objectives: [{ id: 'ping', title: 'PC1 → PC2', hint: '', check: (q) => q.ping('PC1', '192.168.1.12').ok }],
  })
  it('hedef OK olduğundan beri geçen sanal zamanın başlangıcı; bozulunca null', () => {
    const rt = createLab(lab())
    expect(rt.okSince('ping')).toBe(0)
    rt.tick(100)
    expect(rt.okSince('ping')).toBe(0)
    rt.schedule(130, { type: 'link', dev: 'SW1', port: G1, up: false })
    rt.schedule(170, { type: 'link', dev: 'SW1', port: G1, up: true })
    rt.tick(50)
    expect(rt.okSince('ping')).toBeNull()
    rt.tick(30)
    expect(rt.okSince('ping')).toBe(170)
    // CLI değişikliği (zaman geçmeden) bir sonraki değerlendirmede o anın saatiyle görülür
    cfg(rt, 'SW1', 'interface gi0/1\nshutdown')
    rt.tick(5)
    expect(rt.okSince('ping')).toBeNull()
    cfg(rt, 'SW1', 'interface gi0/1\nno shutdown')
    rt.tick(5)
    expect(rt.okSince('ping')).toBe(185)
    expect(rt.okSince('yok')).toBeNull()
  })

  it('flap sırasında her geçiş değerlendirilir', () => {
    const rt = createLab(lab())
    rt.setFlap('SW1', G1, { periodS: 10, upS: 6 })
    rt.tick(13)
    expect(rt.okSince('ping')).toBe(10)
  })
})

describe('kalıcılık ve geriye uyumluluk', () => {
  it('save/load saati, zamanlanmış olayları, flap\'i ve açılışı korur', () => {
    const rt = createLab(twoSwitchLab())
    rt.tick(40)
    rt.setFlap('SW1', G1, { periodS: 10, upS: 5 })
    rt.schedule(100, { type: 'power', dev: 'PC2', on: false })
    rt.setPower('SW2', false)
    rt.powerOn('SW2', { bootS: 200 })
    const saved = JSON.parse(JSON.stringify(rt.save()))
    const rt2 = createLab(twoSwitchLab())
    expect(rt2.load(saved)).toBe(true)
    expect(rt2.clock).toBe(40)
    expect(rt2.scheduled()).toEqual(rt.scheduled())
    expect(rt2.isBooting('SW2')).toBe(true)
    for (const r of [rt, rt2]) r.tick(250)
    expect(rt2.powered('PC2')).toBe(false)
    expect(rt2.powered('SW2')).toBe(true)
    expect(rt2.log('SW1').map((e) => e.line)).toEqual(rt.log('SW1').map((e) => e.line))
  })

  it('zaman hiç kullanılmayan lab: save()\'de zaman anahtarı yok, konsol damgası eski biçim', () => {
    const rt = createLab(twoSwitchLab())
    rt.setLink('SW1', G1, false)
    const s = rt.save() as unknown as Record<string, unknown>
    expect('time' in s).toBe(false)
    expect(rt.logs.at(-1)!.text).toMatch(/^\*Mar {2}1 01:02:0\d\.\d{3}: /)
  })
})
