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

import { deliver, l2Domain, l3Ifs, nodeVlan, ping, sourceIp, type Hop, type L3If, type Node } from '../sim/net'
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
  kind: 'icmp-request' | 'icmp-reply'
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

const nk = (n: Node) => `${n.dev}|${n.vlan}`
const colon = (mac: string) => {
  const h = mac.replace(/[^0-9a-f]/gi, '').toLowerCase()
  return h.length === 12 ? h.match(/../g)!.join(':') : mac
}

interface Step {
  from: string
  out: string
  to: string
  in: string
  vlan: number
}

/** İki L3 arayüzü arasındaki fiziksel kablolar (kanonik port adlarıyla) ya da null. */
function l2Path(rt: LabRuntime, a: L3If, b: L3If): Step[] | null {
  const d = rt.derived
  if (!a.node || !b.node) return null
  const dom = l2Domain(d, a.node)
  const chain: { from: string; out: string; to: Node; in: string }[] = []
  let cur = dom.nodes.get(nk(b.node))
  if (!cur) return null
  while (cur.via) {
    const prev = dom.nodes.get(cur.via.from)
    if (!prev) return null
    chain.unshift({ from: prev.node.dev, out: cur.via.out, to: cur.node, in: cur.via.in })
    cur = prev
  }
  const steps: Step[] = []
  // Mantıksal port (Port-channel dahil) → aynı iki cihaz arasındaki fiziksel kablo.
  for (const c of chain) {
    const link = rt.def.links.find((l) =>
      (
        [
          [l.a, l.b],
          [l.b, l.a],
        ] as const
      ).some(
        ([x, y]) =>
          x[0] === c.from &&
          y[0] === c.to.dev &&
          d.lportOfPhys[pk(x[0], x[1])]?.name === c.out &&
          d.lportOfPhys[pk(y[0], y[1])]?.name === c.in &&
          rt.cableIntact(x[0], x[1]),
      ),
    )
    if (!link) return null
    const fwd = link.a[0] === c.from && d.lportOfPhys[pk(link.a[0], link.a[1])]?.name === c.out
    const [x, y] = fwd ? [link.a, link.b] : [link.b, link.a]
    steps.push({ from: x[0], out: x[1], to: y[0], in: y[1], vlan: nodeVlan(c.to) })
  }
  // PC uçları: PC ↔ erişim portu kablosu
  for (const [ifc, atStart] of [
    [a, true],
    [b, false],
  ] as const) {
    if (ifc.kind !== 'pc') continue
    const at = rt.topo.pcAttach[ifc.dev]
    if (!at || !rt.cableIntact(ifc.dev, 'eth0')) return null
    const vlan = nodeVlan(ifc.node!)
    if (atStart) steps.unshift({ from: ifc.dev, out: 'eth0', to: at.dev, in: at.port, vlan })
    else steps.push({ from: at.dev, out: at.port, to: ifc.dev, in: 'eth0', vlan })
  }
  return steps
}

/** Labber ping'inin Simulation Mode kayıtları. Öğrencinin durumunu değiştirmez. */
export function pingTrace(
  rt: LabRuntime,
  from: string,
  dst: string,
  /** kanonik port adının arayüzdeki yazımı (AğLab bağlantılarıyla eşleşmesi için) */
  portName: (dev: string, port: string) => string = (_dev, port) => port,
): PingTrace {
  const d = rt.derived
  const r = ping(d, from, dst)
  const records: TraceRecord[] = []
  let frameNo = 0
  let l2 = true
  const ifOf = (dev: string, ip: string) => l3Ifs(d, dev).find((i) => i.ip === ip) ?? null

  /** Bir teslimatın atlamaları; döndürdüğü: son ulaşılan cihaz. */
  const walk = (
    kind: 'icmp-request' | 'icmp-reply',
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
        ipv4: { sourceIp: srcIp, destinationIp: dstIp, ttl, protocol: 1 },
        icmp: { type: kind === 'icmp-request' ? 8 : 0, code: 0 },
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
    return { ok: false, l2: true, records }
  }
  const reached = walk('icmp-request', from, fwd.hops, src, dst, 64)
  if (fwd.kind !== 'ok') {
    records.push({ raw: `discard ${reached} ${fwd.kind === 'unreach' ? 'no-route' : 'no-l2-path'}` })
    records.push({ raw: `icmp-undelivered ${from} ${r.reason ?? fwd.kind}` })
    return { ok: false, l2, records }
  }
  const replier = fwd.hops[fwd.hops.length - 1]?.dev ?? from
  const back = deliver(d, replier, src)
  const base = rt.topo.devices[replier]?.kind === 'pc' ? 64 : 255
  const backTo = walk('icmp-reply', replier, back.hops, dst, src, base)
  if (!r.ok || back.kind !== 'ok' || backTo !== from) {
    records.push({ raw: `discard ${backTo} no-return-path` })
    records.push({ raw: `icmp-undelivered ${from} ${r.reason ?? 'timeout'}` })
    return { ok: false, l2, records }
  }
  records.push({ raw: `icmp-delivered ${from} from ${replier}` })
  return { ok: true, l2, records }
}
