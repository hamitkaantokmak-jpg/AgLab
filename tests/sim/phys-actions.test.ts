// Katman 1 — Aşama 3: teknisyen eylemleri ve kalıcılık.
//
// Eylemler LabRuntime'dadır (kablo değiştir, konnektör temizle, SFP değiştir/çıkar, fiber
// TX/RX çevir, kablo tak/çıkar = setLink). Her eylem commit() ile türetilmiş durumu yeniden
// hesaplar; switch'in gözleyebildiği değişiklik syslog üretir. Fiziksel durum rt.save()'e
// girer, rt.load() ve köprü (toLabber → createRuntime → load, toAglab) ile korunur.
//
// Başarı ölçütü (iki switch'li phys labı): temiz fiber up; kirli konnektör marjinal + CRC
// artıyor; SX/LX uyumsuz link yok; third-party SFP err-disabled; her biri teknisyen eylemiyle
// düzelir ve show çıktıları değişir; phys'siz labın çıktısı değişmez (legacy-output.test.ts).
import { describe, expect, it } from 'vitest'
import { createLab, createSession } from '../../src/sim/index'
import { createRuntime, toAglab, toLabber } from '../../src/sim-bridge/bridge'
import type { AglabTopology } from '../../src/sim-bridge/aglab'
import type { LinkPhysSpec } from '../../src/sim/types'
import { fiber, G1, twoSwitchLab } from './fixtures/phys-lab'

type Rt = ReturnType<typeof createLab>
const cli = (rt: Rt, dev = 'SW1') => {
  const s = createSession(rt, dev)
  s.exec('enable')
  return (cmd: string) => s.exec(cmd).join('\n')
}
const status = (rt: Rt, dev = 'SW1') => /Gi0\/1 +(\S+)/.exec(cli(rt, dev)('show interfaces status'))![1]
const crc = (rt: Rt, dev = 'SW1') => Number(/(\d+) CRC/.exec(cli(rt, dev)('show interfaces gi0/1'))![1])
const ping = (rt: Rt, n = 1) => {
  const pc = createSession(rt, 'PC1')
  let out = ''
  for (let i = 0; i < n; i++) out = pc.exec('ping 192.168.1.12').join('\n')
  return out
}
const logs = (rt: Rt) => rt.logs.map((l) => `${l.dev} ${l.text.replace(/^\*\S+ +\S+ \S+: /, '')}`)
const dirtyA: LinkPhysSpec = fiber('sx', 300, { ends: { a: { sfp: { type: '1000base-sx' }, connectorDirty: true }, b: { sfp: { type: '1000base-sx' } } } })

describe('Başarı ölçütü: iki switch, phys tanımlı link', () => {
  it('(1) temiz fiber link up', () => {
    const rt = createLab(twoSwitchLab(fiber('sx', 300)))
    expect(status(rt)).toBe('connected')
    expect(ping(rt)).toMatch(/84 bytes from 192\.168\.1\.12/)
  })

  it('(2)+(5) kirli konnektör: marjinal + CRC artıyor; temizlenince CRC artışı durur, RX gücü yükselir', () => {
    const rt = createLab(twoSwitchLab(dirtyA))
    expect(status(rt)).toBe('connected')
    const c0 = crc(rt)
    ping(rt, 40)
    expect(crc(rt)).toBeGreaterThan(c0)
    const rxBefore = cli(rt)('show interfaces transceiver')
    expect(rt.cleanConnector('SW1', G1)).toBe(true)
    expect(rt.derived.phys['SW1|' + G1]!.l1!.fault).toBe('none')
    expect(cli(rt)('show interfaces transceiver')).not.toBe(rxBefore)
    cli(rt)('clear counters')
    cli(rt)('')
    const c1 = crc(rt)
    ping(rt, 40)
    expect(crc(rt)).toBe(c1)
    // temizlemek link durumunu değiştirmez: switch gözlemlemez, günlük yazılmaz
    expect(logs(rt).filter((l) => l.includes('UPDOWN'))).toEqual([])
  })

  it('(3)+(5) SX/LX uyumsuzluğu: link yok; SFP değişince link gelir ve syslog yazılır', () => {
    const rt = createLab(twoSwitchLab({ cable: { kind: 'fiber-sm', lengthM: 2000 }, ends: { a: { sfp: { type: '1000base-sx' } }, b: { sfp: { type: '1000base-lx' } } } }))
    expect(status(rt)).toBe('notconnect')
    expect(cli(rt)('show interfaces status')).toMatch(/1000BaseSX SFP/)
    expect(rt.replaceSfp('SW1', G1, { type: '1000base-lx' })).toBe(true)
    expect(status(rt)).toBe('connected')
    expect(cli(rt)('show interfaces status')).toMatch(/Gi0\/1 +connected +1 +a-full +a-1000 1000BaseLX SFP/)
    expect(logs(rt)).toContain('SW1 %LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to up')
    expect(logs(rt)).toContain('SW2 %LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/1, changed state to up')
    expect(ping(rt)).toMatch(/84 bytes from/)
  })

  it('(4)+(5) third-party SFP: err-disabled; yalnız SFP değiştirmek yetmez, shutdown/no shutdown ile kalkar', () => {
    const rt = createLab(twoSwitchLab(fiber('sx', 100, { ends: { a: { sfp: { type: '1000base-sx', vendor: 'third-party' } }, b: { sfp: { type: '1000base-sx' } } } })))
    expect(status(rt)).toBe('err-disabled')
    expect(cli(rt)('show interfaces status err-disabled')).toMatch(/Gi0\/1 +err-disabled +gbic-invalid/)
    // third-party modül takılıyken shut/no shut: yeniden err-disable
    const sh = createSession(rt, 'SW1')
    for (const c of ['enable', 'configure terminal', 'interface gi0/1', 'shutdown', 'no shutdown', 'end']) sh.exec(c)
    expect(status(rt)).toBe('err-disabled')
    expect(logs(rt)).toContain('SW1 %PM-4-ERR_DISABLE: gbic-invalid error detected on Gi0/1, putting Gi0/1 in err-disable state')
    expect(logs(rt)).toContain('SW1 %PHY-4-UNSUPPORTED_TRANSCEIVER: Unsupported transceiver found in Gi0/1')
    // Cisco modül takılır: port err-disabled kalır (IOS: err-disable kendiliğinden kalkmaz)
    rt.replaceSfp('SW1', G1, { type: '1000base-sx', vendor: 'cisco' })
    expect(status(rt)).toBe('err-disabled')
    for (const c of ['configure terminal', 'interface gi0/1', 'shutdown', 'no shutdown', 'end']) sh.exec(c)
    expect(status(rt)).toBe('connected')
    expect(cli(rt)('show interfaces status err-disabled')).not.toMatch(/Gi0\/1/)
    expect(ping(rt)).toMatch(/84 bytes from/)
  })

  it('(5) TX/RX ters: fiber çevrilince link gelir; ölü SFP değişince link gelir', () => {
    const sw = createLab(twoSwitchLab(fiber('lx', 2000, { txRxSwapped: true })))
    expect(status(sw)).toBe('notconnect')
    expect(sw.flipFiber('SW2', G1)).toBe(true)
    expect(status(sw)).toBe('connected')
    const dead = createLab(twoSwitchLab(fiber('lx', 2000, { ends: { a: { sfp: { type: '1000base-lx' } }, b: { sfp: { type: '1000base-lx', dead: true } } } })))
    expect(status(dead, 'SW2')).toBe('notconnect')
    dead.replaceSfp('SW2', G1, { type: '1000base-lx' })
    expect(status(dead, 'SW2')).toBe('connected')
  })

  it('(5) uzun/hasarlı kablo: kablo değiştirilince düzelir; SFP çıkarılınca Not Present', () => {
    const rt = createLab(twoSwitchLab({ cable: { kind: 'utp-cat5e', lengthM: 180 } }))
    expect(status(rt)).toBe('notconnect')
    expect(rt.replaceCable('SW1', G1, { kind: 'utp-cat6', lengthM: 60 })).toBe(true)
    expect(status(rt)).toBe('connected')
    const f = createLab(twoSwitchLab(fiber('sx', 100)))
    expect(f.replaceSfp('SW2', G1, null)).toBe(true)
    expect(cli(f, 'SW2')('show interfaces status')).toMatch(/Gi0\/1 +notconnect +1 +auto +auto Not Present/)
    expect(logs(f)).toContain('SW2 %LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to down')
  })

  it('kablo tak/çıkar (setLink) phys linkinde de çalışır; phys durumu korunur', () => {
    const rt = createLab(twoSwitchLab(dirtyA))
    rt.setLink('SW1', G1, false)
    expect(status(rt)).toBe('notconnect')
    rt.setLink('SW1', G1, true)
    expect(status(rt)).toBe('connected')
    expect(rt.derived.phys['SW1|' + G1]!.l1!.fault).toBe('marginal')
  })

  it('phys tanımsız linkte kablo değiştirmek linki fiziksel modele alır; geçersiz eylemler false döner', () => {
    const rt = createLab(twoSwitchLab())
    expect(rt.cleanConnector('SW1', G1)).toBe(false)
    expect(rt.flipFiber('SW1', G1)).toBe(false)
    expect(rt.replaceSfp('SW1', 'FastEthernet0/2', { type: '1000base-sx' }), 'kablosuz port').toBe(false)
    expect(rt.replaceSfp('SW1', 'FastEthernet0/1', { type: '1000base-sx' }), 'Fa portunda SFP yuvası yok').toBe(false)
    expect(rt.replaceCable('SW1', G1, { kind: 'fiber-mm', lengthM: 10 })).toBe(true)
    expect(status(rt)).toBe('notconnect')
    expect(rt.physLink('SW1', G1)!.phys.cable.kind).toBe('fiber-mm')
    rt.replaceSfp('SW1', G1, { type: '1000base-sx' })
    rt.replaceSfp('SW2', G1, { type: '1000base-sx' })
    expect(status(rt)).toBe('connected')
  })
})

describe('Kalıcılık', () => {
  it('eylemlerle değişen fiziksel durum save/load ile korunur', () => {
    const rt = createLab(twoSwitchLab(dirtyA))
    rt.replaceSfp('SW2', G1, { type: '1000base-lx' })
    expect(status(rt)).toBe('notconnect')
    const saved = JSON.parse(JSON.stringify(rt.save()))
    expect(saved.hw.phys).toBeDefined()
    const rt2 = createLab(twoSwitchLab(dirtyA))
    expect(status(rt2)).toBe('connected')
    expect(rt2.load(saved)).toBe(true)
    expect(status(rt2)).toBe('notconnect')
    expect(rt2.physLink('SW2', G1)!.phys.ends['SW2|' + G1]!.sfp!.type).toBe('1000base-lx')
  })

  it('kablo taşınınca (moveCable) fiziksel durum yeni porta gider', () => {
    const rt = createLab(twoSwitchLab(dirtyA))
    expect(rt.moveCable('SW1', G1, 'SW1', 'GigabitEthernet0/2')).toBe(true)
    expect(rt.physLink('SW1', 'GigabitEthernet0/2')!.phys.ends['SW1|GigabitEthernet0/2']!.connectorDirty).toBe(true)
    expect(rt.derived.phys['SW1|GigabitEthernet0/2']!.l1!.fault).toBe('marginal')
    expect(rt.derived.phys['SW1|' + G1]!.l1).toBeUndefined()
  })
})

describe('Köprü (AgLabSim)', () => {
  const topo = (phys?: object): AglabTopology => ({
    devices: [
      { id: 'SW1', type: 'Switch', ports: ['Fa0/1', 'Gi0/1'] },
      { id: 'SW2', type: 'Switch', ports: ['Fa0/1', 'Gi0/1'] },
    ],
    links: [{ a: 'SW1', portA: 'Gi0/1', b: 'SW2', portB: 'Gi0/1', ...(phys ? { phys } : {}) }],
  })

  it('AgLab bağlantısındaki phys Labber\'a geçer; eylemden sonra toAglab geri yazar', () => {
    const t = topo({ cable: { kind: 'fiber-sm', lengthM: 1000 }, ends: { a: { sfp: { type: '1000base-lx' } }, b: { sfp: { type: '1000base-sx' } } } })
    const r = toLabber(t)
    expect(r.report.expressible).toBe(true)
    const rt = createRuntime(r)
    expect(rt.derived.phys['SW1|GigabitEthernet0/1']!.l1!.fault).toBe('type-mismatch')
    rt.replaceSfp('SW2', 'GigabitEthernet0/1', { type: '1000base-lx' })
    expect(rt.derived.phys['SW1|GigabitEthernet0/1']!.up).toBe(true)
    const back = toAglab(rt, t)
    expect(back.links[0]!['phys']).toEqual({ cable: { kind: 'fiber-sm', lengthM: 1000 }, ends: { a: { sfp: { type: '1000base-lx' } }, b: { sfp: { type: '1000base-lx' } } } })
  })

  it('phys\'siz topoloji: toAglab bağlantıya phys eklemez', () => {
    const t = topo()
    const rt = createRuntime(toLabber(t))
    expect('phys' in toAglab(rt, t).links[0]!).toBe(false)
  })

  it('geçersiz phys reddedilir (ifade edilemez)', () => {
    const bad = toLabber(topo({ cable: { kind: 'coax', lengthM: 5 } }))
    expect(bad.report.expressible).toBe(false)
    expect(bad.report.rejected.map((x) => x.reason).join(' ')).toMatch(/Katman 1/)
    const fa = toLabber({ ...topo(), links: [{ a: 'SW1', portA: 'Fa0/1', b: 'SW2', portB: 'Fa0/1', phys: { cable: { kind: 'fiber-mm', lengthM: 5 }, ends: { a: { sfp: { type: '1000base-sx' } } } } }] })
    expect(fa.report.expressible).toBe(false)
  })
})

describe('AgLabSim dışa aktarımı', () => {
  it('Katman 1 API köprü girişinden erişilebilir', async () => {
    const api = await import('../../src/sim-bridge/index')
    expect(typeof api.evaluateLink).toBe('function')
    expect(typeof api.validatePhysSpec).toBe('function')
    expect(api.OPTICS['1000base-lx'].label).toBe('1000BaseLX SFP')
    const rt = api.createLab(twoSwitchLab(fiber('sx', 100)))
    for (const m of ['replaceCable', 'cleanConnector', 'replaceSfp', 'flipFiber', 'setLink', 'physLink', 'backgroundTraffic', 'counters', 'clearCounters'] as const)
      expect(typeof rt[m]).toBe('function')
  })

  it('backgroundTraffic sayaçları deterministik artırır', () => {
    const a = createLab(twoSwitchLab(dirtyA))
    const b = createLab(twoSwitchLab(dirtyA))
    a.backgroundTraffic(5000)
    b.backgroundTraffic(5000)
    expect(a.counters('SW1', G1)).toEqual(b.counters('SW1', G1))
    expect(a.counters('SW1', G1).crc).toBeGreaterThan(0)
    expect(a.counters('SW2', G1).crc).toBe(0)
  })
})
