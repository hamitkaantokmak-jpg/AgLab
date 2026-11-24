// L3-b: Simulation Mode olay adaptörü.
//
// Labber'ın ping'ini (net.ts ping/deliver) Simulation Mode'un paket olayı kayıtlarına
// çevirir. Her IP atlaması için katman 2 yolu l2Domain BFS ağacından (via.out/in)
// çıkarılır; böylece animasyon kablo kablo ilerler. Kayıt biçimi eski motorun
// ethernetTraceEvents kayıtlarıyla aynıdır (simulator/packet-events.js normalize eder);
// köken 'labber' olarak işaretlenir.
//
// Sınırlar (arayüzde yazılır):
// - ARP çerçeveleri üretilmez; yalnız ICMP echo istek/yanıt çerçeveleri.
// - Bir atlamanın L2 yolu fiziksel kablolara eşlenemezse (ör. çözülemeyen uç) bütün kayıt
//   yalnız L3 atlamalarından oluşur (`l2: false`).
// - Simulation Mode deterministik bir yeniden oynatmadır; zamanlama modellenmez.

import { allows } from '../sim/engine'
import { fhrpOwns, fhrpTarget } from '../sim/fhrp'
import { deliver, l3Ifs, nodeVlan, physicalPath, ping, sourceIp, type Hop, type L3If } from '../sim/net'
import type { LabRuntime } from '../sim/runtime'
import { pk } from '../sim/topology'

export interface TraceEdge {
  a: string
  portA: string
  b: string
  portB: string
}

export interface TraceFrame {
  protocol: 'ICMP'
  kind: 'icmp-request' | 'icmp-reply' | 'icmp-time-exceeded' | 'icmp-unreachable'
  sourceMac: string
  destinationMac: string
  vlan: number
  etherType: '0x0800'
  arp: null
  ipv4: { sourceIp: string; destinationIp: string; ttl: number; protocol: 1 }
  icmp: { type: number; code: number }
}

export interface TraceRecord {
  raw: string
  frameId?: string
  frame?: TraceFrame
  kind?: 'wire'
  device?: string
  edge?: TraceEdge
  ingressPort?: string
}

export interface PingTrace {
  ok: boolean
  /** false: L2 yolu çıkarılamadı, kayıt yalnız L3 atlamalarıdır */
  l2: boolean
  records: TraceRecord[]
}

const colon = (mac: string) => {
  const h = mac.replace(/[^0-9a-f]/gi, '').toLowerCase()
  return h.length === 12 ? h.match(/../g)!.join(':') : mac
}

/** İki L3 arayüzü arasındaki fiziksel kablolar (kanonik port adlarıyla) ya da null. */
const l2Path = (rt: LabRuntime, a: L3If, b: L3If) => physicalPath(rt.derived, a, b)

/**
 * I-1: başarısız ping için açıklama (Paket Dedektifi "adaptörden türetilmiş tanı"; gerçek paket
 * yakalaması değildir). Neden Labber'ın türetilmiş durumundan: kaynak PC'nin VLAN'ı, onu
 * taşımayan switch–switch trunk'ı, access VLAN'ı olmayan port, rota/ARP sonucu.
 */
export function pingDiagnosis(rt: LabRuntime, from: string, dst: string, r: ReturnType<typeof ping>): string | null {
  if (r.ok) return null
  const d = rt.derived
  if (r.reason === 'off') return 'Kaynak cihaz kapalı.'
  if (r.reason === 'noip') return 'Kaynakta geçerli IPv4 adresi yok.'
  if (r.reason === 'noroute') return `Kaynakta ${dst} için yol yok (aynı alt ağda değil ve ağ geçidi yok).`
  if (r.reason === 'unreach') return `${r.unreachFrom} ${dst} için rota bulamadı ya da ACL engelledi (ICMP unreachable).`
  if (r.reason === 'expired') return `TTL ${r.expiredFrom} üzerinde bitti (ICMP Time Exceeded).`
  const at = d.topo.pcAttach[from]
  if (at) {
    const lp = d.lportOfPhys[pk(at.dev, at.port)]
    if (lp?.inactive) return `VLAN ${lp.cfg.accessVlan} ${at.dev} üzerinde tanımlı değil (${at.port} inactive).`
    const vlan = lp && lp.opMode === 'access' ? lp.cfg.accessVlan : null
    if (vlan !== null)
      for (const ports of Object.values(d.lports))
        for (const p of ports)
          if (p.active && p.opMode === 'trunk' && !p.peerIsPc && p.peerDev && !p.routed && !allows(p.cfg, vlan))
            return `VLAN ${vlan}, ${p.dev} ${p.name} trunk'ında izinli değil (switchport trunk allowed vlan).`
  }
  return 'Yanıt gelmedi: hedefe ya da dönüşte kaynağa katman 2 yolu veya dönüş rotası yok.'
}

/** Labber ping'inin Simulation Mode kayıtları. Öğrencinin durumunu değiştirmez. */
export function pingTrace(
  rt: LabRuntime,
  from: string,
  dst: string,
  /** kanonik port adının arayüzdeki yazımı (AğLab bağlantılarıyla eşleşmesi için) */
  portName: (dev: string, port: string) => string = (_dev, port) => port,
  /** L5-i: gönderenin IP TTL'i (ping -T); verilmezse 64 ve süresiz */
  opts: { ttl?: number } = {},
): PingTrace {
  const d = rt.derived
  const r = ping(d, from, dst, opts.ttl !== undefined ? { ttl: opts.ttl } : {})
  const records: TraceRecord[] = []
  let unreachCode = 1
  const pushDiag = () => {
    const reason = pingDiagnosis(rt, from, dst, r)
    // tanı ilk düşme kaydından önce (Paket Dedektifi ilk sorunu özetler); `icmp-undelivered` son kalır
    if (!reason) return
    const first = records.findIndex((x) => x.raw.startsWith('discard ') || x.raw.startsWith('icmp-undelivered '))
    records.splice(first < 0 ? records.length : first, 0, { raw: 'diagnostic ' + JSON.stringify({ source: from, reason, origin: 'adapter-derived' }) })
  }
  let frameNo = 0
  let l2 = true
  // atlama hedefi bir HSRP/VRRP sanal adresiyse Active/Master'ın arayüzü (sanal MAC ile)
  const ifOf = (dev: string, ip: string) =>
    l3Ifs(d, dev).find((i) => i.ip === ip) ?? (fhrpOwns(d, dev, ip) ? fhrpTarget(d, ip, () => true) : null)

  /** Bir teslimatın atlamaları; döndürdüğü: son ulaşılan cihaz. */
  const walk = (
    kind: 'icmp-request' | 'icmp-reply' | 'icmp-time-exceeded' | 'icmp-unreachable',
    start: string,
    hops: Hop[],
    srcIp: string,
    dstIp: string,
    baseTtl: number,
  ) => {
    let ttl = baseTtl
    let sender = start
    for (const hop of hops) {
      if (sender !== start) {
        records.push({ raw: `ttl-forward ${sender} ${ttl} -> ${ttl - 1}` })
        ttl--
      }
      const target = ifOf(hop.dev, hop.ip)
      const frameId = 'lf' + ++frameNo
      const frame: TraceFrame = {
        protocol: 'ICMP',
        kind,
        sourceMac: colon(hop.outIf.mac),
        destinationMac: colon(target?.mac ?? ''),
        vlan: hop.outIf.node ? nodeVlan(hop.outIf.node) : 0,
        etherType: '0x0800',
        arp: null,
        // L5-d: NAT'tan sonra kablodaki adresler (hop.src/dst)
        ipv4: { sourceIp: hop.src ?? srcIp, destinationIp: hop.dst ?? dstIp, ttl, protocol: 1 },
        icmp:
          kind === 'icmp-unreachable'
            ? { type: 3, code: unreachCode }
            : { type: kind === 'icmp-request' ? 8 : kind === 'icmp-time-exceeded' ? 11 : 0, code: 0 },
      }
      const ev = { frameId, frame }
      records.push({ raw: `frame ${kind} src ${sender} dst ${frame.destinationMac} vlan ${frame.vlan}`, ...ev })
      const steps = target ? l2Path(rt, hop.outIf, target) : null
      if (!steps) l2 = false
      let lastIn = 'local'
      for (const s of steps ?? []) {
        if (rt.topo.devices[s.from]?.kind === 'switch' && (s.from !== sender || lastIn !== 'local'))
          records.push({
            raw: `unicast ${s.from} ingress ${lastIn === 'local' ? 'local' : portName(s.from, lastIn)} egress ${portName(s.from, s.out)} vlan ${s.vlan}`,
            ...ev,
          })
        lastIn = s.in
        records.push({
          raw: `wire ${kind} ${s.from} -> ${s.to}`,
          ...ev,
          kind: 'wire',
          device: s.from,
          edge: { a: s.from, portA: portName(s.from, s.out), b: s.to, portB: portName(s.to, s.in) },
        })
      }
      records.push({ raw: `receive ${hop.dev} ${kind} vlan ${frame.vlan}`, ...ev, ...(steps?.length ? { ingressPort: portName(hop.dev, steps[steps.length - 1]!.in) } : {}) })
      sender = hop.dev
    }
    return sender
  }

  const fwd = r.forward
  const src = sourceIp(d, from, dst)
  if (!fwd || !src) {
    records.push({ raw: `icmp-undelivered ${from} ${r.reason ?? 'noroute'}` })
    pushDiag()
    return { ok: false, l2: true, records }
  }
  const reached = walk('icmp-request', from, fwd.hops, src, dst, opts.ttl ?? 64)
  if (fwd.kind === 'expired') {
    // L5-i: TTL router'da bitti; router ICMP Time Exceeded'ı kaynağa gönderir
    records.push({ raw: `ttl-expired ${fwd.at}` })
    const back = r.back
    const backTo = back ? walk('icmp-time-exceeded', fwd.at, back.hops, fwd.atIp, src, 255) : fwd.at
    if (!back || back.kind !== 'ok' || backTo !== from) records.push({ raw: `discard ${backTo} no-return-path` })
    else records.push({ raw: `icmp-time-exceeded ${from} from ${fwd.at}` })
    records.push({ raw: `icmp-undelivered ${from} ${r.reason ?? 'expired'}` })
    pushDiag()
    return { ok: false, l2, records }
  }
  if (fwd.kind === 'unreach') {
    // I-1: router ICMP Destination Unreachable'ı kaynağa gönderir (13: ACL, 1: rota/ARP yok)
    unreachCode = fwd.filtered ? 13 : 1
    records.push({ raw: `discard ${fwd.at} ${fwd.filtered ? 'acl' : 'no-route'}` })
    const back = r.back
    const backTo = back ? walk('icmp-unreachable', fwd.at, back.hops, fwd.atIp, src, 255) : fwd.at
    if (back && back.kind === 'ok' && backTo === from) records.push({ raw: `icmp-unreachable ${from} from ${fwd.at} code ${unreachCode}` })
    else records.push({ raw: `discard ${backTo} no-return-path` })
    records.push({ raw: `icmp-undelivered ${from} ${r.reason ?? 'unreach'}` })
    pushDiag()
    return { ok: false, l2, records }
  }
  if (fwd.kind === 'timeout' && fwd.suppressedAt) records.push({ raw: `icmp-error-suppressed ${fwd.suppressedAt}` })
  if (fwd.kind !== 'ok') {
    records.push({ raw: `discard ${reached} no-l2-path` })
    records.push({ raw: `icmp-undelivered ${from} ${r.reason ?? fwd.kind}` })
    pushDiag()
    return { ok: false, l2, records }
  }
  const replier = fwd.hops[fwd.hops.length - 1]?.dev ?? from
  // ping()'in kendi dönüş teslimatı (NAT çevirisi dahil)
  const back = r.back ?? deliver(d, replier, src)
  const base = rt.topo.devices[replier]?.kind === 'pc' ? 64 : 255
  const backTo = walk('icmp-reply', replier, back.hops, dst, src, base)
  if (!r.ok || back.kind !== 'ok' || backTo !== from) {
    records.push({ raw: `discard ${backTo} no-return-path` })
    records.push({ raw: `icmp-undelivered ${from} ${r.reason ?? 'timeout'}` })
    pushDiag()
    return { ok: false, l2, records }
  }
  records.push({ raw: `icmp-delivered ${from} from ${replier}` })
  return { ok: true, l2, records }
}
