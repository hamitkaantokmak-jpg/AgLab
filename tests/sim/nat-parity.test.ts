// L5-d: eski motor NAT oracle'ı (src/engine/nat.js natPathCheck) ile Labber paritesi.
//
// Aynı AğLab topolojisi hem oracle'a hem köprü üzerinden Labber'a verilir. Varyantlar: arayüz
// rolleri (doğru, ters, inside yok), ACL (eşleşir, eşleşmez, yok), natOverload (var/yok) ve
// overload'un gösterdiği outside arayüzü (çıkış arayüzü ya da başka bir outside arayüz).
//
// Karşılaştırma: oracle çeviri yaptığında Labber aynı inside global adresine çevirir ve aynı
// (inside local, inside global, outside local, protokol) girdisini üretir; oracle çevirmediğinde
// Labber de çevirmez. Farklar sayılır ve KNOWN_DIFFS ile karşılaştırılır (sessiz eşitleme yok).
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { createRuntime, toLabber } from '../../src/sim-bridge/bridge'
import type { AglabTopology } from '../../src/sim-bridge/aglab'
import { deliver, ping } from '../../src/sim/net'

const require_ = createRequire(import.meta.url)
const nat = require_(join(__dirname, '..', '..', 'src/engine/nat.js'))

/** Bilinen ve gerekçeli fark türleri (PR açıklaması, UYUMLULUK_MATRISI "L5-d"). */
const KNOWN_DIFFS = new Set([
  // Oracle inside → outside akışında NAT yoksa ya da ACL eşleşmezse akışı "başarısız" sayar;
  // IOS paketi çevirmeden iletir (dönüş yolu yoksa yanıt gelmez). Labber IOS gibi: çeviri yok.
  'oracle-fails-untranslated',
  // Overload başka bir outside arayüzü gösteriyorsa oracle akışı reddeder; IOS o arayüzün
  // adresine çevirir (`ip nat inside source list N interface X overload`, X çıkış arayüzü
  // olmak zorunda değil). Labber IOS gibi.
  'other-outside-interface-translates',
])

type Variant = { roles: 'ok' | 'reversed' | 'no-inside'; acl: 'match' | 'nomatch' | 'none'; overload: 'g0/1' | 'g0/2' | null }

function lab(v: Variant): AglabTopology {
  const role = (r: 'inside' | 'outside' | null) => (r ? { natRole: r } : {})
  const [g0, g1] = v.roles === 'ok' ? (['inside', 'outside'] as const) : v.roles === 'reversed' ? (['outside', 'inside'] as const) : ([null, 'outside'] as const)
  const R1: any = {
    id: 'r1', name: 'R1', type: 'Router', enabled: true, ports: ['g0/0', 'g0/1', 'g0/2'],
    interfaces: {
      'g0/0': { ip: '10.0.0.1', mask: '255.255.255.0', enabled: true, ...role(g0) },
      'g0/1': { ip: '203.0.113.1', mask: '255.255.255.0', enabled: true, ...role(g1) },
      'g0/2': { ip: '198.51.100.1', mask: '255.255.255.0', enabled: true, natRole: 'outside' },
    },
    staticRoutes: [],
  }
  if (v.acl !== 'none')
    R1.acls = [{ id: '1', action: 'permit', protocol: 'ip', srcType: 'network', src: v.acl === 'match' ? '10.0.0.0' : '10.9.0.0', wildcard: '0.0.0.255', dstType: 'any', dst: '' }]
  if (v.overload) R1.natOverload = { aclId: '1', outsideInterface: v.overload }
  const pc = (id: string, ip: string, gw: string) => ({ id, name: id.toUpperCase(), type: 'PC', enabled: true, ports: ['eth0'], ip, mask: '255.255.255.0', gateway: gw })
  return {
    devices: [pc('pc', '10.0.0.5', '10.0.0.1'), R1, pc('srv', '203.0.113.8', ''), pc('other', '198.51.100.9', '')],
    links: [
      { a: 'pc', portA: 'eth0', b: 'r1', portB: 'g0/0', up: true },
      { a: 'r1', portA: 'g0/1', b: 'srv', portB: 'eth0', up: true },
      { a: 'r1', portA: 'g0/2', b: 'other', portB: 'eth0', up: true },
    ],
  } as unknown as AglabTopology
}

const VARIANTS: Variant[] = []
for (const roles of ['ok', 'reversed', 'no-inside'] as const)
  for (const acl of ['match', 'nomatch', 'none'] as const)
    for (const overload of ['g0/1', 'g0/2', null] as const) {
      // natOverload'un var olmayan ACL'i göstermesi AğLab doğrulamasında reddedilir (main.js)
      if (acl === 'none' && overload) continue
      VARIANTS.push({ roles, acl, overload })
    }

describe('NAT oracle paritesi', () => {
  it('her varyantta çeviri kararı oracle ile aynı ya da bilinen farkta', () => {
    const counts: Record<string, number> = {}
    let compared = 0
    for (const v of VARIANTS) {
      const topo = lab(v)
      const path = topo.links!.slice(0, 2)
      const o = nat.natPathCheck(topo, path, 'pc', 'srv', '10.0.0.5', '203.0.113.8', 'icmp')
      const br = toLabber(topo)
      expect(br.report.expressible, JSON.stringify(v)).toBe(true)
      const rt = createRuntime(br)
      const d = deliver(rt.derived, 'pc', '203.0.113.8')
      expect(d.kind, JSON.stringify(v)).toBe('ok')
      const translated = d.pkt!.src !== '10.0.0.5'
      const entry = d.nat?.find((e) => e.proto === 'icmp')
      compared++
      let kind: string | null = null
      if (o.ok && o.translated) {
        if (!translated || d.pkt!.src !== o.entry.insideGlobal) kind = 'insideGlobal'
        else if (!entry || entry.insideLocal !== o.entry.insideLocal || entry.outsideLocal !== o.entry.outsideLocal || entry.proto !== o.entry.protocol) kind = 'entry'
      } else if (o.ok && translated) kind = 'labber-translates-oracle-not'
      else if (!o.ok) kind = !translated ? 'oracle-fails-untranslated' : v.overload === 'g0/2' && d.pkt!.src === '198.51.100.1' ? 'other-outside-interface-translates' : 'oracle-fails-labber-translates'
      if (kind) counts[kind] = (counts[kind] ?? 0) + 1
      // uçtan uca: çeviri varsa ping döner (sunucunun özel ağa rotası yok)
      expect(ping(rt.derived, 'pc', '203.0.113.8').ok, JSON.stringify(v)).toBe(translated && d.pkt!.src === '203.0.113.1')
    }
    expect(compared).toBe(VARIANTS.length)
    expect(Object.keys(counts).filter((k) => !KNOWN_DIFFS.has(k)), JSON.stringify(counts)).toEqual([])
    // eşleşen çeviriler gerçekten karşılaştırıldı (yalnız bilinen farklardan oluşan bir test değil)
    const agree = VARIANTS.length - Object.values(counts).reduce((a, b) => a + b, 0)
    expect(agree).toBeGreaterThan(0)
    expect(counts['oracle-fails-untranslated']).toBeGreaterThan(0)
  })
})
