// L5-g: sunucunun HTTP servisi (TCP 80) ve PC'nin web isteği.
//
// İstek gerçek bir TCP SYN gibi taşınır: `deliver` ile ACL (L5-c, `eq 80`/`www`) ve NAT (L5-d,
// statik TCP port çevirisi dahil) uygulanır. Hedef HTTP servisi açık bir sunucuysa yanıt
// (SYN-ACK/200) aynı yoldan geri döner; servis yoksa hedef TCP RST döner (bağlantı reddedildi).
// Uygulama katmanı (HTTP başlıkları, sayfa içeriği) modellenmez: tek bir sabit sayfa döner.

import type { Derived } from './engine'
import { deliver, sourceIp, type Delivery } from './net'

export const HTTP_PORT = 80
/** İstemcinin geçici kaynak portu (doğrulanmadı: gerçek istemcide rastgele) */
export const HTTP_CLIENT_PORT = 49153

export type HttpResult =
  | { ok: true; server: string; forward: Delivery; back: Delivery }
  | {
      ok: false
      /** refused: hedef RST döndü; unreach: router ICMP unreachable döndü; timeout: yanıt yok */
      reason: 'off' | 'noip' | 'noroute' | 'refused' | 'unreach' | 'timeout'
      unreachFrom?: string
      forward?: Delivery
      back?: Delivery
    }

/** Bu cihaz TCP 80'de dinliyor mu: HTTP servisi açık, açık bir sunucu. */
export function httpListening(d: Derived, dev: string): boolean {
  const def = d.topo.devices[dev]
  return !!def && def.kind === 'pc' && !!def.server && !!d.pcs[dev]?.services?.http && !d.hw.off.has(dev)
}

/** `from`'dan `dst:port`'a bir HTTP isteği (TCP bağlantısı + GET); yalnız 80 dinlenir. */
export function httpGet(d: Derived, from: string, dst: string, port = HTTP_PORT): HttpResult {
  if (d.hw.off.has(from)) return { ok: false, reason: 'off' }
  const fwd = deliver(d, from, dst, { proto: 'tcp', sport: HTTP_CLIENT_PORT, dport: port })
  if (fwd.kind === 'noip') return { ok: false, reason: 'noip', forward: fwd }
  if (fwd.kind === 'noroute') return { ok: false, reason: 'noroute', forward: fwd }
  const src = fwd.pkt?.src ?? sourceIp(d, from, dst)!
  if (fwd.kind === 'unreach') {
    // router ICMP unreachable döner (ACL ya da rota yok); istemci "No route to host" görür
    const back = deliver(d, fwd.at, src, { proto: 'icmp', icmpType: 'unreachable', src: fwd.atIp, dport: fwd.pkt?.sport, natPending: fwd.nat })
    return back.kind === 'ok' ? { ok: false, reason: 'unreach', unreachFrom: fwd.atIp, forward: fwd, back } : { ok: false, reason: 'timeout', forward: fwd, back }
  }
  if (fwd.kind !== 'ok') return { ok: false, reason: 'timeout', forward: fwd }
  // paketin ulaştığı cihaz yanıtlar: dinliyorsa SYN-ACK, dinlemiyorsa RST (ikisi de geri dönmeli)
  const server = fwd.hops[fwd.hops.length - 1]?.dev ?? from
  const back = deliver(d, server, src, { proto: 'tcp', src: fwd.pkt!.dst, sport: fwd.pkt!.dport, dport: fwd.pkt!.sport, natPending: fwd.nat })
  const backTo = back.hops[back.hops.length - 1]?.dev ?? server
  if (back.kind !== 'ok' || backTo !== from) return { ok: false, reason: 'timeout', forward: fwd, back }
  if (port !== HTTP_PORT || !httpListening(d, server)) return { ok: false, reason: 'refused', forward: fwd, back }
  return { ok: true, server, forward: fwd, back }
}
