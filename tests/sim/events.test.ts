// L3-b: Simulation Mode olay adaptörü (src/sim-bridge/events.ts).
// Labber ping'i → paket olayı kayıtları: her IP atlamasının L2 yolu l2Domain'den kablo
// kablo çıkarılır. Değişmezler gerçek içerikte (src/labs; sayı sabit yazılmaz) denenir:
// iz sonucu ping sonucuyla aynıdır, başarılı ping'de L2 yolu her zaman çıkarılır ve
// kablolar lab tanımındaki bağlantılardır.
import { describe, expect, it } from 'vitest'
import { LABS, findLab } from '../../src/labs'
import { createLab, runScript } from '../../src/sim'
import { pingTrace } from '../../src/sim-bridge/events'
import type { LabDef } from '../../src/sim/types'

function solved(def: LabDef) {
  const rt = createLab(def)
  for (const [dev, script] of Object.entries(def.solution)) runScript(rt, dev, script)
  return rt
}
const wires = (t: ReturnType<typeof pingTrace>) => t.records.filter((r) => r.kind === 'wire')
const linkKey = (a: string, pa: string, b: string, pb: string) => [`${a}|${pa}`, `${b}|${pb}`].sort().join('~')

describe('pingTrace', () => {
  it('aynı VLAN: istek ve yanıt kablo kablo, TTL 64, teslim edildi', () => {
    const rt = solved(findLab('vlan-temelleri')!)
    const t = pingTrace(rt, 'PC1', '192.168.1.12')
    expect(t.ok).toBe(true)
    expect(t.l2).toBe(true)
    expect(wires(t).map((r) => `${r.frame!.kind} ${r.edge!.a}>${r.edge!.b}`)).toEqual([
      'icmp-request PC1>SW1',
      'icmp-request SW1>PC2',
      'icmp-reply PC2>SW1',
      'icmp-reply SW1>PC1',
    ])
    expect(wires(t)[0]!.frame!.ipv4.ttl).toBe(64)
    expect(t.records.at(-1)!.raw).toBe('icmp-delivered PC1 from PC2')
  })
  it('farklı VLAN: çerçeve yok, kayıt reddi ve teslim edilmedi', () => {
    const rt = solved(findLab('vlan-temelleri')!)
    const t = pingTrace(rt, 'PC1', '192.168.1.13')
    expect(t.ok).toBe(false)
    expect(wires(t)).toEqual([])
    expect(t.records.some((r) => r.raw.startsWith('discard PC1 '))).toBe(true)
    expect(t.records.at(-1)!.raw).toMatch(/^icmp-undelivered PC1 /)
  })
  it('yönlendirilen yol: router geçişinde TTL azalır ve ttl-forward kaydı', () => {
    const def = findLab('l3-statik-route')!
    const rt = solved(def)
    const pcs = def.devices.filter((d) => d.kind === 'pc').map((d) => d.id)
    const target = rt.pcs[pcs[pcs.length - 1]!]!.ip!
    const t = pingTrace(rt, pcs[0]!, target)
    expect(t.ok).toBe(true)
    expect(t.records.some((r) => r.raw.startsWith('ttl-forward '))).toBe(true)
    const req = wires(t).filter((r) => r.frame!.kind === 'icmp-request')
    expect(req.at(-1)!.frame!.ipv4.ttl).toBeLessThan(64)
  })
  it('port adı çevirisi kenarlara ve ileri kararlarına uygulanır', () => {
    const rt = solved(findLab('vlan-temelleri')!)
    const t = pingTrace(rt, 'PC1', '192.168.1.12', (_d, p) => p.replace('FastEthernet', 'fa'))
    expect(wires(t)[0]!.edge!.portB).toBe('fa0/1')
  })
  for (const def of LABS) {
    it(`${def.id}: iz ping ile aynı sonucu verir; başarılıda L2 yolu lab kablolarıdır`, () => {
      const rt = solved(def)
      const cables = new Set(def.links.map((l) => linkKey(l.a[0], l.a[1], l.b[0], l.b[1])))
      const pcs = def.devices.filter((d) => d.kind === 'pc').map((d) => d.id)
      let ok = 0
      for (const a of pcs)
        for (const b of pcs) {
          const ip = rt.pcs[b]?.ip
          if (a === b || !ip) continue
          const t = pingTrace(rt, a, ip)
          expect(t.ok, `${a}→${b}`).toBe(rt.query().ping(a, ip).ok)
          if (!t.ok) continue
          ok++
          expect(t.l2, `${a}→${b}`).toBe(true)
          for (const w of wires(t)) expect(cables.has(linkKey(w.edge!.a, w.edge!.portA, w.edge!.b, w.edge!.portB))).toBe(true)
        }
      if (pcs.length > 1) expect(ok).toBeGreaterThan(0)
    })
  }
})
