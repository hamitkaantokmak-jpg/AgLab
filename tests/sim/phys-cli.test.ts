// Katman 1 — Aşama 2: CLI. show interfaces status / <if> / counters errors /
// transceiver [detail], clear counters. Sayaçlar runtime'da tutulur, deterministik artar
// (lab açılışında BOOT_FRAMES arka plan çerçevesi, sonra gerçek trafik: ping/curl).
import { describe, expect, it } from 'vitest'
import { createLab, createSession } from '../../src/sim/index'
import { BOOT_FRAMES } from '../../src/sim/phys'
import type { LinkPhysSpec } from '../../src/sim/types'
import { fiber, twoSwitchLab } from './fixtures/phys-lab'

const sw = (rt: ReturnType<typeof createLab>, dev = 'SW1') => {
  const s = createSession(rt, dev)
  s.exec('enable')
  return (cmd: string) => s.exec(cmd).join('\n')
}
const dirty: LinkPhysSpec = fiber('sx', 300, { ends: { a: { sfp: { type: '1000base-sx' }, connectorDirty: true }, b: { sfp: { type: '1000base-sx' } } } })
const crcOf = (out: string) => Number(/(\d+) input errors, (\d+) CRC/.exec(out)![2])
const ping = (rt: ReturnType<typeof createLab>, n = 5) => {
  const pc = createSession(rt, 'PC1')
  for (let i = 0; i < n; i++) pc.exec('ping 192.168.1.12')
}

describe('show interfaces status (Katman 1)', () => {
  it('SFP portunda Type modül tipidir; hız/duplex anlaşmadan gelir', () => {
    const out = sw(createLab(twoSwitchLab(fiber('lx', 5000))))('show interfaces status')
    expect(out).toMatch(/Gi0\/1 +connected +1 +a-full +a-1000 1000BaseLX SFP/)
    // phys tanımsız port eskisi gibi
    expect(out).toMatch(/Fa0\/1 +connected +1 +a-full +a-100 10\/100BaseTX/)
  })

  it('link yokken auto/auto, modül tipi yine görünür; fiber yuvası boşsa Not Present', () => {
    const mm = sw(createLab(twoSwitchLab({ cable: { kind: 'fiber-sm', lengthM: 100 }, ends: { a: { sfp: { type: '1000base-sx' } }, b: { sfp: { type: '1000base-lx' } } } })))
    expect(mm('show interfaces status')).toMatch(/Gi0\/1 +notconnect +1 +auto +auto 1000BaseSX SFP/)
    const empty = createLab(twoSwitchLab({ cable: { kind: 'fiber-mm', lengthM: 50 }, ends: { a: { sfp: { type: '1000base-sx' } } } }))
    expect(sw(empty, 'SW2')('show interfaces status')).toMatch(/Gi0\/1 +notconnect +1 +auto +auto Not Present/)
  })

  it('Fa ⇄ Gi bakır: Gi ucunda a-100', () => {
    const rt = createLab(
      twoSwitchLab(undefined, (d) => {
        d.links[2] = { a: ['SW1', 'FastEthernet0/2'], b: ['SW2', 'GigabitEthernet0/1'], phys: { cable: { kind: 'utp-cat5e', lengthM: 10 } } }
      }),
    )
    expect(sw(rt, 'SW2')('show interfaces status')).toMatch(/Gi0\/1 +connected +1 +a-full +a-100 10\/100\/1000BaseTX/)
  })

  it('third-party SFP: show interfaces status err-disabled nedeni gbic-invalid', () => {
    const rt = createLab(twoSwitchLab(fiber('sx', 100, { ends: { a: { sfp: { type: '1000base-sx', vendor: 'third-party' } }, b: { sfp: { type: '1000base-sx' } } } })))
    const c = sw(rt)
    expect(c('show interfaces status')).toMatch(/Gi0\/1 +err-disabled/)
    expect(c('show interfaces status err-disabled')).toMatch(/Gi0\/1 +err-disabled +gbic-invalid/)
    expect(c('show interfaces gi0/1')).toMatch(/line protocol is down \(err-disabled\)/)
  })
})

describe('show interfaces <if>: ortam ve hata sayaçları', () => {
  it('temiz fiber: media type, giriş/çıkış sayaçları, 0 CRC', () => {
    const out = sw(createLab(twoSwitchLab(fiber('sx', 300))))('show interfaces gi0/1')
    expect(out).toContain('Full-duplex, 1000Mb/s, link type is auto, media type is 1000BaseSX SFP')
    expect(out).toContain(`${BOOT_FRAMES} packets input`)
    expect(out).toContain('0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored')
    expect(out).toContain('0 output errors, 0 collisions, 0 interface resets')
  })

  it('kirli konnektör: lab açılışında CRC > 0 ve trafikle artar (deterministik)', () => {
    const a = createLab(twoSwitchLab(dirty))
    const b = createLab(twoSwitchLab(dirty))
    const c0 = crcOf(sw(a)('show interfaces gi0/1'))
    expect(c0).toBeGreaterThan(0)
    expect(crcOf(sw(b)('show interfaces gi0/1'))).toBe(c0)
    ping(a, 40)
    ping(b, 40)
    const c1 = crcOf(sw(a)('show interfaces gi0/1'))
    expect(c1).toBeGreaterThan(c0)
    expect(crcOf(sw(b)('show interfaces gi0/1'))).toBe(c1)
    // karşı ucun alıcısı temiz
    expect(crcOf(sw(a, 'SW2')('show interfaces gi0/1'))).toBe(0)
  })

  it('phys tanımsız port: sayaç satırı yok (eski çıktı)', () => {
    expect(sw(createLab(twoSwitchLab(dirty)))('show interfaces fa0/1')).not.toContain('input errors')
  })
})

describe('show interfaces counters errors / clear counters', () => {
  it('FCS-Err ve Rcv-Err kirli uçta; clear counters sıfırlar, trafik yeniden artırır', () => {
    const rt = createLab(twoSwitchLab(dirty))
    const c = sw(rt)
    const row = () => /Gi0\/1 +(\d+) +(\d+) +(\d+) +(\d+) +(\d+) +(\d+)/.exec(c('show interfaces counters errors'))!
    expect(c('show interfaces counters errors')).toMatch(/Port +Align-Err +FCS-Err +Xmit-Err +Rcv-Err +UnderSize +OutDiscards/)
    expect(Number(row()[2])).toBeGreaterThan(0)
    expect(row()[2]).toBe(row()[4])
    const s = createSession(rt, 'SW1')
    s.exec('enable')
    s.exec('clear counters')
    expect(s.prompt()).toContain('Clear "show interface" counters on all interfaces [confirm]')
    s.exec('')
    expect(Number(row()[2])).toBe(0)
    expect(c('show interfaces gi0/1')).toContain('0 packets input')
    expect(rt.logs.map((l) => l.text).join('\n')).toContain('%CLEAR-5-COUNTERS: Clear counter on all interfaces by console')
    ping(rt, 40)
    expect(Number(row()[2])).toBeGreaterThan(0)
  })

  it('phys tanımsız labda: counters errors sıfırlar gösterir, clear counters hata vermez', () => {
    const rt = createLab(twoSwitchLab())
    const s = createSession(rt, 'SW1')
    s.exec('enable')
    expect(s.exec('show interfaces counters errors').join('\n')).toMatch(/Gi0\/1 +0 +0 +0 +0 +0 +0/)
    s.exec('clear counters')
    expect(s.exec('').join('\n')).not.toMatch(/%|Invalid/)
    expect(rt.save().physCounters).toBeUndefined()
  })

  it('clear counters <if> yalnız o portu sıfırlar; onaylanmazsa hiçbir şey değişmez', () => {
    const rt = createLab(twoSwitchLab(dirty))
    const s = createSession(rt, 'SW1')
    s.exec('enable')
    const crc = () => crcOf(s.exec('show interfaces gi0/1').join('\n'))
    const before = crc()
    s.exec('clear counters gi0/1')
    expect(s.prompt()).toContain('Clear "show interface" counters on this interface [confirm]')
    s.exec('n')
    expect(crc()).toBe(before)
    s.exec('clear counters gi0/1')
    s.exec('')
    expect(crc()).toBe(0)
  })

  it('sayaçlar kaydedilip geri yüklenir', () => {
    const rt = createLab(twoSwitchLab(dirty))
    ping(rt, 10)
    const before = crcOf(sw(rt)('show interfaces gi0/1'))
    const saved = JSON.parse(JSON.stringify(rt.save()))
    const rt2 = createLab(twoSwitchLab(dirty))
    createSession(rt2, 'SW1').exec('enable')
    expect(rt2.load(saved)).toBe(true)
    expect(crcOf(sw(rt2)('show interfaces gi0/1'))).toBe(before)
  })
})

describe('show interfaces transceiver [detail]', () => {
  it('TX/RX gücü ve uyarı işaretleri; bakır portlar listelenmez', () => {
    const c = sw(createLab(twoSwitchLab(dirty)))
    const d = c('show interfaces transceiver detail')
    expect(d).toContain('Transmit Power')
    expect(d).toContain('Receive Power')
    // kirli uç: RX duyarlılığın biraz üstünde → düşük uyarı (-)
    expect(d).toMatch(/Gi0\/1 +-16\.\d +- /)
    expect(d).not.toContain('Fa0/1')
    const brief = c('show interfaces transceiver')
    expect(brief).toMatch(/Gi0\/1 +-5\.0 +-16\.\d/)
  })

  it('TX/RX ters: RX -40.0 ve düşük alarm (--); temiz linkte işaret yok', () => {
    const sw1 = sw(createLab(twoSwitchLab(fiber('lx', 2000, { txRxSwapped: true }))))
    expect(sw1('show interfaces transceiver detail')).toMatch(/Gi0\/1 +-40\.0 +-- /)
    const clean = sw(createLab(twoSwitchLab(fiber('lx', 2000))))
    expect(clean('show interfaces transceiver detail')).toMatch(/Gi0\/1 +-7\.\d {4}/)
  })

  it('optik modül yoksa çıktı boş', () => {
    expect(sw(createLab(twoSwitchLab()))('show interfaces transceiver').trim()).toBe('')
  })
})
