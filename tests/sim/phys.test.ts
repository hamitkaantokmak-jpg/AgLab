// Katman 1 (fiziksel katman) modeli — Aşama 1: link durumunun fizikten türetilmesi.
//
// `LinkDef.phys` verilen bağlantıda kablo türü/uzunluğu, iki ucun SFP'si, konnektör temizliği
// ve fiber TX/RX yönü link durumunu, hızı ve hata oranını belirler (engine.ts derive →
// phys.ts evaluateLink). `phys` verilmeyen bağlantı eskisi gibi davranır.
import { describe, expect, it } from 'vitest'
import { createLab } from '../../src/sim/index'
import { evaluateLink, OPTICS } from '../../src/sim/phys'
import type { LabDef, LinkPhysSpec } from '../../src/sim/types'
import { fiber, G1, twoSwitchLab } from './fixtures/phys-lab'

const st = (rt: ReturnType<typeof createLab>, dev = 'SW1', port = G1) => rt.query().port(dev, port)!.status
const ps = (rt: ReturnType<typeof createLab>, dev = 'SW1', port = G1) => rt.derived.phys[`${dev}|${port}`]!
const pingOk = (rt: ReturnType<typeof createLab>) => rt.query().ping('PC1', '192.168.1.12').ok

describe('Katman 1: phys yok = eski davranış', () => {
  it('phys verilmeyen link aynı türetilmiş durumu üretir; l1 alanı yoktur', () => {
    const rt = createLab(twoSwitchLab())
    expect(st(rt)).toBe('connected')
    expect(ps(rt).l1).toBeUndefined()
    expect(rt.derived.lportOfPhys['SW1|' + G1]!.speed).toBe(1000)
    expect(pingOk(rt)).toBe(true)
    expect(rt.save().hw).toEqual({ cut: [], off: [], nicDown: [] })
    expect('phys' in rt.save()).toBe(false)
  })
})

describe('Katman 1: fiber', () => {
  it('temiz SX (çok modlu, 300 m) link up, hız 1000, hata yok, RX gücü eşiğin üstünde', () => {
    const rt = createLab(twoSwitchLab(fiber('sx', 300)))
    expect(st(rt)).toBe('connected')
    expect(pingOk(rt)).toBe(true)
    const l1 = ps(rt).l1!
    expect(l1.link).toBe(true)
    expect(l1.fault).toBe('none')
    expect(l1.speed).toBe(1000)
    expect(l1.errPer10k).toBe(0)
    expect(l1.rxDbm!).toBeGreaterThan(OPTICS['1000base-sx'].sensDbm + 3)
    expect(l1.type).toBe('1000BaseSX SFP')
  })

  it('temiz LX (tek modlu, 10 km) ve ZX (tek modlu, 40 km) link up', () => {
    expect(st(createLab(twoSwitchLab(fiber('lx', 10000))))).toBe('connected')
    expect(st(createLab(twoSwitchLab(fiber('zx', 40000))))).toBe('connected')
  })

  it('kirli konnektör: o ucun RX gücü düşer, link up ama marjinal (hata oranı > 0); iki uç kirliyse yine yalnız alıcılar etkilenir', () => {
    const clean = createLab(twoSwitchLab(fiber('sx', 300)))
    const dirty = createLab(twoSwitchLab(fiber('sx', 300, { ends: { a: { sfp: { type: '1000base-sx' }, connectorDirty: true }, b: { sfp: { type: '1000base-sx' } } } })))
    expect(st(dirty)).toBe('connected')
    expect(pingOk(dirty)).toBe(true)
    expect(ps(dirty).l1!.fault).toBe('marginal')
    expect(ps(dirty).l1!.errPer10k).toBeGreaterThan(0)
    expect(ps(dirty).l1!.rxDbm!).toBeLessThan(ps(clean).l1!.rxDbm!)
    // karşı ucun alıcısı temiz
    expect(ps(dirty, 'SW2').l1!.fault).toBe('none')
    expect(ps(dirty, 'SW2').l1!.errPer10k).toBe(0)
  })

  it('kirli konnektör + aşırı bükülme: RX eşiğin altında → link yok (iki uç notconnect)', () => {
    const rt = createLab(twoSwitchLab(fiber('sx', 300, { cable: { kind: 'fiber-mm', lengthM: 300, bent: true }, ends: { a: { sfp: { type: '1000base-sx' }, connectorDirty: true }, b: { sfp: { type: '1000base-sx' } } } })))
    expect(st(rt)).toBe('notconnect')
    expect(st(rt, 'SW2')).toBe('notconnect')
    expect(ps(rt).l1!.fault).toBe('los')
    expect(pingOk(rt)).toBe(false)
  })

  it('aşırı bükülme tek başına RX gücünü düşürür (link up kalır ya da marjinale iner)', () => {
    const clean = createLab(twoSwitchLab(fiber('sx', 300)))
    const bent = createLab(twoSwitchLab(fiber('sx', 300, { cable: { kind: 'fiber-mm', lengthM: 300, bent: true } })))
    expect(ps(bent).l1!.rxDbm!).toBeLessThan(ps(clean).l1!.rxDbm!)
    expect(ps(bent, 'SW2').l1!.rxDbm!).toBeLessThan(ps(clean, 'SW2').l1!.rxDbm!)
  })

  it('SX ↔ LX tip uyumsuzluğu: link yok', () => {
    const rt = createLab(twoSwitchLab({ cable: { kind: 'fiber-sm', lengthM: 100 }, ends: { a: { sfp: { type: '1000base-sx' } }, b: { sfp: { type: '1000base-lx' } } } }))
    expect(st(rt)).toBe('notconnect')
    expect(ps(rt).l1!.fault).toBe('type-mismatch')
    expect(pingOk(rt)).toBe(false)
  })

  it('SX + tek modlu kablo: link yok; LX + çok modlu kablo: zayıf sinyal (marjinal)', () => {
    const sxSm = createLab(twoSwitchLab({ cable: { kind: 'fiber-sm', lengthM: 100 }, ends: { a: { sfp: { type: '1000base-sx' } }, b: { sfp: { type: '1000base-sx' } } } }))
    expect(st(sxSm)).toBe('notconnect')
    expect(ps(sxSm).l1!.fault).toBe('los')
    const lxMm = createLab(twoSwitchLab({ cable: { kind: 'fiber-mm', lengthM: 100 }, ends: { a: { sfp: { type: '1000base-lx' } }, b: { sfp: { type: '1000base-lx' } } } }))
    expect(st(lxMm)).toBe('connected')
    expect(ps(lxMm).l1!.fault).toBe('marginal')
    expect(ps(lxMm).l1!.errPer10k).toBeGreaterThan(0)
  })

  it('fiber TX/RX ters: link yok, RX ışık yok', () => {
    const rt = createLab(twoSwitchLab(fiber('lx', 2000, { txRxSwapped: true })))
    expect(st(rt)).toBe('notconnect')
    expect(ps(rt).l1!.fault).toBe('swapped')
    expect(ps(rt).l1!.rxDbm).toBe(-40)
  })

  it('ölü SFP: link yok (iki uç notconnect)', () => {
    const rt = createLab(twoSwitchLab(fiber('sx', 100, { ends: { a: { sfp: { type: '1000base-sx', dead: true } }, b: { sfp: { type: '1000base-sx' } } } })))
    expect(st(rt)).toBe('notconnect')
    expect(st(rt, 'SW2')).toBe('notconnect')
    expect(ps(rt).l1!.fault).toBe('sfp-dead')
  })

  it('fiber kablo SFP\'siz porta: link yok', () => {
    const rt = createLab(twoSwitchLab({ cable: { kind: 'fiber-mm', lengthM: 50 }, ends: { a: { sfp: { type: '1000base-sx' } } } }))
    expect(st(rt)).toBe('notconnect')
    expect(ps(rt, 'SW2').l1!.fault).toBe('media')
  })

  it('kısa ZX bağlantısı: alıcı doyar (overload), link up ama hatalı', () => {
    const rt = createLab(twoSwitchLab(fiber('zx', 500)))
    expect(st(rt)).toBe('connected')
    expect(ps(rt).l1!.fault).toBe('overload')
    expect(ps(rt).l1!.errPer10k).toBeGreaterThan(0)
  })

  it('desteklenmeyen (third-party) SFP: port err-disabled (gbic-invalid), karşı uç notconnect', () => {
    const rt = createLab(twoSwitchLab(fiber('sx', 100, { ends: { a: { sfp: { type: '1000base-sx', vendor: 'third-party' } }, b: { sfp: { type: '1000base-sx', vendor: 'cisco' } } } })))
    expect(st(rt)).toBe('err-disabled')
    expect(rt.errCause.get('SW1|' + G1)).toBe('gbic-invalid')
    expect(st(rt, 'SW2')).toBe('notconnect')
    expect(pingOk(rt)).toBe(false)
    // lab açılışında günlük boş (belirti port durumunda görünür)
    expect(rt.logs).toEqual([])
  })
})

describe('Katman 1: bakır ve DAC', () => {
  const utp = (lengthM: number, more: object = {}): LinkPhysSpec => ({ cable: { kind: 'utp-cat6', lengthM, ...more } })

  it('UTP 90 m: link up, hata yok', () => {
    const rt = createLab(twoSwitchLab(utp(90)))
    expect(st(rt)).toBe('connected')
    expect(ps(rt).l1!.errPer10k).toBe(0)
    expect(ps(rt).l1!.rxDbm).toBeNull()
    expect(ps(rt).l1!.type).toBe('10/100/1000BaseTX')
  })

  it('UTP 120 m: link up ama hatalı; 180 m: link yok', () => {
    const long = createLab(twoSwitchLab(utp(120)))
    expect(st(long)).toBe('connected')
    expect(ps(long).l1!.fault).toBe('length')
    expect(ps(long).l1!.errPer10k).toBeGreaterThan(0)
    const tooLong = createLab(twoSwitchLab(utp(180)))
    expect(st(tooLong)).toBe('notconnect')
    expect(ps(tooLong).l1!.link).toBe(false)
  })

  it('hasarlı UTP: link up, iki uçta da hata', () => {
    const rt = createLab(twoSwitchLab(utp(20, { damaged: true })))
    expect(st(rt)).toBe('connected')
    expect(ps(rt).l1!.fault).toBe('errors')
    expect(ps(rt, 'SW2').l1!.errPer10k).toBeGreaterThan(0)
  })

  it('Fa ⇄ Gi bakır: hız 100', () => {
    const rt = createLab(
      twoSwitchLab(undefined, (d) => {
        d.links[2] = { a: ['SW1', 'FastEthernet0/2'], b: ['SW2', G1], phys: { cable: { kind: 'utp-cat5e', lengthM: 10 } } }
      }),
    )
    expect(st(rt, 'SW1', 'FastEthernet0/2')).toBe('connected')
    expect(ps(rt, 'SW2').l1!.speed).toBe(100)
    expect(rt.derived.lportOfPhys['SW2|' + G1]!.speed).toBe(100)
  })

  it('UTP kablo optik SFP\'ye takılamaz: link yok; 1000BASE-T SFP ile çalışır', () => {
    const bad = createLab(twoSwitchLab({ cable: { kind: 'utp-cat6', lengthM: 10 }, ends: { a: { sfp: { type: '1000base-lx' } } } }))
    expect(st(bad)).toBe('notconnect')
    expect(ps(bad).l1!.fault).toBe('media')
    const ok = createLab(twoSwitchLab({ cable: { kind: 'utp-cat6', lengthM: 10 }, ends: { a: { sfp: { type: '1000base-t' } } } }))
    expect(st(ok)).toBe('connected')
    expect(ps(ok).l1!.type).toBe('10/100/1000BaseTX SFP')
  })

  it('DAC 3 m: link up; 10 m: link yok', () => {
    const dac = (lengthM: number): LinkPhysSpec => ({ cable: { kind: 'dac', lengthM }, ends: { a: { sfp: { type: 'dac' } }, b: { sfp: { type: 'dac' } } } })
    expect(st(createLab(twoSwitchLab(dac(3))))).toBe('connected')
    expect(st(createLab(twoSwitchLab(dac(10))))).toBe('notconnect')
  })

  it('PC ucunda phys: bakır ve uzunluk kuralları PC kablosunda da geçerli', () => {
    const rt = createLab(
      twoSwitchLab(undefined, (d) => {
        d.links[0] = { ...d.links[0]!, phys: { cable: { kind: 'utp-cat5e', lengthM: 200 } } }
      }),
    )
    expect(rt.query().linkUp('PC1')).toBe(false)
    expect(st(rt, 'SW1', 'FastEthernet0/1')).toBe('notconnect')
  })
})

describe('Katman 1: deterministik değerlendirme', () => {
  it('evaluateLink aynı girdiye her zaman aynı sonucu verir', () => {
    const spec = { cable: { kind: 'fiber-mm' as const, lengthM: 300 }, ends: { 'A|x': { sfp: { type: '1000base-sx' as const }, connectorDirty: true }, 'B|y': { sfp: { type: '1000base-sx' as const } } } }
    const ends = [
      { key: 'A|x', port: G1, pc: false },
      { key: 'B|y', port: G1, pc: false },
    ] as const
    expect(evaluateLink(spec, ends[0], ends[1])).toEqual(evaluateLink(spec, ends[0], ends[1]))
  })

  it('SFP FastEthernet portuna tanımlanamaz (lab yazım hatası)', () => {
    expect(() =>
      createLab(
        twoSwitchLab(undefined, (d) => {
          d.links[2] = { a: ['SW1', 'FastEthernet0/2'], b: ['SW2', G1], phys: fiber('sx', 10) }
        }),
      ),
    ).toThrow(/SFP/)
  })
})
