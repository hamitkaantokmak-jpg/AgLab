// L5-g: eski motorun HTTP kararı (src/app/main.js `curl`/`test http`) ile Labber paritesi.
//
// Eski motor kararı src/engine modülleriyle aynı sırada kurulur: hedefte HTTP servisi açık,
// ping'in denetimleri (gidiş NAT ve ACL, dönüş ACL'i; ICMP) ve ardından gidiş yolunda TCP/80
// ACL'i ve NAT. Labber kararı `httpGet` (gerçek TCP gidiş-dönüşü). Aynı AğLab topolojisi köprü
// üzerinden Labber'a verilir. Farklar sayılır ve KNOWN_DIFFS ile karşılaştırılır.
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { createRuntime, toLabber } from '../../src/sim-bridge/bridge'
import type { AglabTopology } from '../../src/sim-bridge/aglab'

const require_ = createRequire(import.meta.url)
const ROOT = join(__dirname, '..', '..')
const acl = require_(join(ROOT, 'src/engine/acl.js'))
const nat = require_(join(ROOT, 'src/engine/nat.js'))

/** Bilinen ve gerekçeli fark türleri (PR açıklaması, UYUMLULUK_MATRISI "L5-g"). */
const KNOWN_DIFFS = new Set([
  // Eski motor HTTP'den önce ping ister: ICMP'yi engelleyip TCP/80'e izin veren ACL'de eski
  // motor web'i başarısız sayar; IOS'ta (ve Labber'da) TCP bağlantısı ICMP'den bağımsızdır.
  'legacy-http-needs-icmp',
  // IOS sırası: inside → outside'da NAT çıkış ACL'inden önce. Outside arayüzündeki çıkış ACL'i
  // çevrilmiş (inside global) kaynağı görür; iç adresi süzen satır eşleşmez. Eski motor ACL'i
  // her zaman iç adresle değerlendirir.
  'outside-acl-sees-translated-source',
])

const RULE = (action: string, protocol: string, extra: Record<string, unknown> = {}) => ({ id: '101', action, protocol, srcType: 'any', src: '', dstType: 'any', dst: '', ...extra })
const ACLS: Record<string, Record<string, unknown>[] | null> = {
  none: null,
  denyWeb: [RULE('deny', 'tcp', { dstType: 'host', dst: '203.0.113.8', port: 80 }), RULE('permit', 'ip')],
  denyHttps: [RULE('deny', 'tcp', { port: 443 }), RULE('permit', 'ip')],
  onlyWeb: [RULE('permit', 'tcp', { port: 80 })],
  denyIcmp: [RULE('deny', 'icmp'), RULE('permit', 'ip')],
  denyHost: [RULE('deny', 'ip', { srcType: 'host', src: '10.0.0.5' }), RULE('permit', 'ip')],
}
const PLACES = [['g0/0', 'aclIn'], ['g0/1', 'aclOut'], ['g0/1', 'aclIn'], ['g0/0', 'aclOut']] as const

type Variant = { http: boolean; acl: string; place: (typeof PLACES)[number]; nat: boolean }

function lab(v: Variant): AglabTopology {
  const R1: any = {
    id: 'r1', name: 'R1', type: 'Router', enabled: true, ports: ['g0/0', 'g0/1'],
    interfaces: {
      'g0/0': { ip: '10.0.0.1', mask: '255.255.255.0', enabled: true },
      'g0/1': { ip: '203.0.113.1', mask: '255.255.255.0', enabled: true },
    },
    staticRoutes: [],
  }
  const rules = ACLS[v.acl]
  const natAcl = { id: '1', action: 'permit', protocol: 'ip', srcType: 'network', src: '10.0.0.0', wildcard: '0.0.0.255', dstType: 'any', dst: '' }
  if (rules || v.nat) R1.acls = [...(rules ?? []), ...(v.nat ? [natAcl] : [])]
  if (rules) R1.interfaces[v.place[0]][v.place[1]] = '101'
  if (v.nat) {
    R1.interfaces['g0/0'].natRole = 'inside'
    R1.interfaces['g0/1'].natRole = 'outside'
    R1.natOverload = { aclId: '1', outsideInterface: 'g0/1' }
  }
  return {
    devices: [
      { id: 'pc', name: 'PC', type: 'PC', enabled: true, ports: ['eth0'], ip: '10.0.0.5', mask: '255.255.255.0', gateway: '10.0.0.1' },
      R1,
      // NAT varyantında genel adresteki sunucunun özel ağa rotası yok
      { id: 'srv', name: 'SRV', type: 'Server', enabled: true, ports: ['eth0'], ip: '203.0.113.8', mask: '255.255.255.0', gateway: v.nat ? '' : '203.0.113.1', services: { dhcp: false, dns: false, http: v.http } },
    ],
    links: [
      { a: 'pc', portA: 'eth0', b: 'r1', portB: 'g0/0', up: true },
      { a: 'r1', portA: 'g0/1', b: 'srv', portB: 'eth0', up: true },
    ],
  } as unknown as AglabTopology
}

/** main.js `curl`: ping (NAT + ACL gidiş/dönüş, ICMP), sonra gidişte TCP/80 ACL'i ve NAT. */
function legacyHttp(t: AglabTopology, v: Variant): boolean {
  const path = t.links
  const back = [...path].reverse()
  if (!v.http) return false
  if (!nat.natPathCheck(t, path, 'pc', 'srv', '10.0.0.5', '203.0.113.8', 'icmp').ok) return false
  // NAT'sız ve ağ geçitsiz sunucu: dönüş rotası yok (eski motor da ping'i başarısız sayar)
  if (!v.nat && (t.devices[2] as any).gateway === '') return false
  if (!acl.aclPathDecision(t, path, 'pc', 'srv', '10.0.0.5', '203.0.113.8', 'icmp', null).ok) return false
  if (!acl.aclPathDecision(t, back, 'srv', 'pc', '203.0.113.8', '10.0.0.5', 'icmp', null).ok) return false
  if (!acl.aclPathDecision(t, path, 'pc', 'srv', '10.0.0.5', '203.0.113.8', 'tcp', 80).ok) return false
  return nat.natPathCheck(t, path, 'pc', 'srv', '10.0.0.5', '203.0.113.8', 'tcp').ok
}

describe('HTTP oracle paritesi', () => {
  it('her varyantta web erişim kararı eski motorla aynı ya da bilinen farkta', () => {
    const counts: Record<string, number> = {}
    const examples: Record<string, string> = {}
    let compared = 0
    let agree = 0
    for (const http of [true, false])
      for (const a of Object.keys(ACLS))
        for (const place of a === 'none' ? [PLACES[0]] : PLACES)
          for (const n of [false, true]) {
            const v: Variant = { http, acl: a, place, nat: n }
            const t = lab(v)
            const br = toLabber(t)
            expect(br.report.engineDecision, JSON.stringify(v)).toBe('labber')
            const labber = createRuntime(br).query().http('pc', '203.0.113.8').ok
            const legacy = legacyHttp(t, v)
            compared++
            if (labber === legacy) {
              agree++
              continue
            }
            // ICMP'yi süzen, TCP/80'e izin veren liste
            const icmpOnly = a === 'denyIcmp' || a === 'onlyWeb'
            const natOut = v.nat && place[0] === 'g0/1' && place[1] === 'aclOut' && a === 'denyHost'
            const kind =
              icmpOnly && labber && !legacy ? 'legacy-http-needs-icmp' : natOut && labber && !legacy ? 'outside-acl-sees-translated-source' : `${legacy ? 'legacy' : 'labber'}-only-ok`
            counts[kind] = (counts[kind] ?? 0) + 1
            examples[kind] ??= JSON.stringify(v)
          }
    expect(Object.keys(counts).filter((k) => !KNOWN_DIFFS.has(k)), JSON.stringify(examples)).toEqual([])
    expect(agree + Object.values(counts).reduce((x, y) => x + y, 0)).toBe(compared)
    // gerçekten karşılaştırıldı: iki motorun aynı kararı verdiği hem başarılı hem başarısız durum var
    expect(agree).toBeGreaterThan(compared / 2)
  })
})
