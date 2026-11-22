// IP SLA (icmp-echo) ve nesne izleme (track), IOS 15 davranışı.
//
// İzlenen nesne türleri: arayüz line-protocol'ü (`track N interface <if> line-protocol`) ve
// IP SLA işlemi (`track N ip sla <sla> [reachability | state]`; ikisinde de başarılı yoklama =
// Up). Statik rota bir nesneye bağlanabilir (`ip route … track N`): nesne Down iken rota
// kurulmaz; aynı hedefe daha yüksek AD'li yedek (floating static) varsa o kurulur. HSRP
// (`standby … track N`) iki türü de kullanır.
//
// Zaman modellenmez: frequency ve delay saklanır, show'da yazılır; her durum değişikliğinde
// (komut, kablo, güç) bütün işlemler bir kez yoklanır. Değerlendirme deterministiktir ve döngüye
// girmez:
//   (a) track'li rotaların hepsi kuruluyken tablo (Derived.track henüz yok),
//   (b) zamanlanmış her SLA bu tabloyla yoklanır (router'dan hedefe ping modeli; source-interface
//       verilmişse kaynak adres o arayüzün adresi, çıkış yine rota tablosuyla seçilir),
//   (c) nesne durumları belirlenir,
//   (d) Derived.track yazılır: Down nesneye bağlı rotalar tablodan çıkar. Böyle bir rota OSPF dış
//       rotasını tablodan okuyan bir ASBR'deyse (default-information originate `always`'siz,
//       redistribute static; EIGRP redistribute static) OSPF/EIGRP bir kez yeniden hesaplanır: duyuru çekilir, komşular başka
//       ASBR'nin duyurusuna geçer. SLA'lar yeniden yoklanmaz, nesne durumları değişmez.
//       Başarısız yoklama bu (OSPF'i güncel) tabloyla bir kez daha denenir; şimdi (yedek yoldan) başarılı oluyorsa gerçek IOS'ta
//       nesne Up/Down arasında gidip gelir (dalgalanma). Model rotayı kapalı tutar ve nesnede
//       `flapping` işaretini saklar (show track'te görünür). Yoklama hedefine birincil hattan
//       giden bir host rotası (/32, track'siz) varsa yoklama yedek yola düşmez, dalgalanma olmaz.

import { bgpUsesStatics, recomputeBgp } from './bgp'
import { eigrpExternalsFromTable, recomputeEigrp } from './eigrp'
import type { Derived } from './engine'
import { l3Ifs, ping } from './net'
import { ospfExternalsFromTable, recomputeOspf } from './ospf'
import { pk } from './topology'
import type { IpSlaConfig } from './types'

export type SlaCode = 'OK' | 'Timeout' | 'No connection' | 'Unknown'

export interface SlaResult {
  scheduled: boolean
  ok: boolean
  code: SlaCode
  /** model RTT (ms); başarısızda null */
  rtt: number | null
  /** (d) adımında yoklama yedek yoldan başarılı: gerçek IOS'ta dalgalanır */
  flapping: boolean
}

export interface TrackObjState {
  type: 'interface' | 'ip sla'
  up: boolean
  flapping: boolean
  /** durum değişikliği sayısı (runtime tutar; başlangıç Down sayılır) */
  changes: number
}

export interface TrackState {
  /** dev → SLA no → sonuç */
  sla: Record<string, Record<string, SlaResult>>
  /** dev → nesne no → durum */
  objects: Record<string, Record<string, TrackObjState>>
}

/** Line protocol of an interface (IOS `track … line-protocol`). */
export function lineProtocolUp(d: Derived, dev: string, ifname: string): boolean {
  if (d.hw.off.has(dev)) return false
  const cfg = d.cfgs[dev]
  if (!cfg) return false
  if (ifname.startsWith('Vlan')) return !!d.svis[dev]?.find((s) => 'Vlan' + s.vlan === ifname)?.up
  if (ifname.includes('.')) {
    const si = cfg.subifs?.[ifname]
    return !!si && !si.shutdown && !!d.lportByName[pk(dev, si.parent)]?.active
  }
  return !!d.lportByName[pk(dev, ifname)]?.active
}

/** Tek yoklama: router'dan hedefe ICMP echo (mevcut ping/yönlendirme modeli). */
function probe(d: Derived, dev: string, sla: IpSlaConfig): { ok: boolean; code: SlaCode } {
  const icmp = sla.icmp
  if (!icmp) return { ok: false, code: 'Unknown' }
  if (d.hw.off.has(dev)) return { ok: false, code: 'No connection' }
  const ifs = l3Ifs(d, dev)
  let src: string | undefined
  if (icmp.srcIf) {
    // kaynak arayüz kapalıysa ya da adresi yoksa yoklama gönderilemez
    const i = ifs.find((x) => x.name === icmp.srcIf)
    if (!i) return { ok: false, code: 'No connection' }
    src = i.ip
  } else if (icmp.srcIp) {
    if (!ifs.some((x) => x.ip === icmp.srcIp)) return { ok: false, code: 'No connection' }
    src = icmp.srcIp
  }
  const r = ping(d, dev, icmp.target, src ? { src } : {})
  if (r.ok) return { ok: true, code: 'OK' }
  return { ok: false, code: r.reason === 'noroute' || r.reason === 'noip' ? 'No connection' : 'Timeout' }
}

/**
 * IP SLA sonuçları ve nesne durumları (yukarıdaki a–d adımları). `d.track` yazılır ve döner;
 * değişim sayaçları 0'dır (runtime doldurur).
 */
export function computeTrack(d: Derived): TrackState {
  d.track = undefined
  const sla: TrackState['sla'] = {}
  const objects: TrackState['objects'] = {}
  const devs = d.topo.switches.map((s) => s.id).filter((id) => {
    const c = d.cfgs[id]
    return !!c && (Object.keys(c.ipSla ?? {}).length || Object.keys(c.tracks ?? {}).length)
  })
  // (a)+(b): track'li rotalar kuruluyken yoklama
  for (const dev of devs) {
    const out: Record<string, SlaResult> = {}
    for (const [n, s] of Object.entries(d.cfgs[dev]!.ipSla ?? {})) {
      const r = s.scheduled ? probe(d, dev, s) : { ok: false, code: 'Unknown' as const }
      out[n] = { scheduled: !!s.scheduled, ok: r.ok, code: r.code, rtt: r.ok ? 1 : null, flapping: false }
    }
    sla[dev] = out
  }
  // (c): nesne durumları (tanımsız SLA'ya bağlı nesne Down)
  for (const dev of devs) {
    const out: Record<string, TrackObjState> = {}
    for (const [n, t] of Object.entries(d.cfgs[dev]!.tracks ?? {})) {
      if (t.sla !== undefined) out[n] = { type: 'ip sla', up: !!sla[dev]?.[String(t.sla)]?.ok, flapping: false, changes: 0 }
      else out[n] = { type: 'interface', up: !!t.iface && lineProtocolUp(d, dev, t.iface), flapping: false, changes: 0 }
    }
    objects[dev] = out
  }
  // (d): Down nesnelere bağlı rotalar çıkar; başarısız yoklama yeni tabloyla bir kez daha
  const state: TrackState = { sla, objects }
  d.track = state
  // (d1) OSPF dış rotaları (default-information originate, redistribute static) rota
  // tablosundan okunur ve ilk OSPF hesabında track'li rotalar kurulu sayılmıştı. Down nesneye
  // bağlı bir rota, dış rotası tabloya bağlı bir ASBR'deyse OSPF bir kez yeniden hesaplanır
  // (komşularda O*E2 / O E2 kalkar; başka ASBR'nin duyurusu devreye girer). SLA'lar yeniden
  // yoklanmaz ve nesne durumları değişmez: döngü yok. Değişmeyen durumlarda ek hesap yapılmaz.
  const ospfStale = devs.some(
    (dev) =>
      ospfExternalsFromTable(d, dev) &&
      d.cfgs[dev]!.routes.some((r) => r.track !== undefined && !objects[dev]?.[String(r.track)]?.up),
  )
  if (ospfStale) recomputeOspf(d)
  // EIGRP `redistribute static` de tabloyu okur: aynı kural (duyuru kalkar, komşular günceller)
  const eigrpStale = devs.some(
    (dev) =>
      eigrpExternalsFromTable(d, dev) &&
      d.cfgs[dev]!.routes.some((r) => r.track !== undefined && !objects[dev]?.[String(r.track)]?.up),
  )
  if (eigrpStale) recomputeEigrp(d)
  // BGP de tabloyu okur (network tam eşleşme, redistribute static): Down rota çıkınca duyuru kalkar
  const bgpStale =
    ospfStale ||
    eigrpStale ||
    devs.some((dev) => bgpUsesStatics(d, dev) && d.cfgs[dev]!.routes.some((r) => r.track !== undefined && !objects[dev]?.[String(r.track)]?.up))
  if (bgpStale && Object.keys(d.bgp ?? {}).length) recomputeBgp(d)
  // (d2) dalgalanma yoklaması: Down rotalar çıkmış (ve gerekirse OSPF yeniden hesaplanmış) tabloyla
  for (const dev of devs)
    for (const [n, r] of Object.entries(sla[dev]!)) {
      if (!r.scheduled || r.ok) continue
      if (!probe(d, dev, d.cfgs[dev]!.ipSla![n]!).ok) continue
      r.flapping = true
      for (const [on, t] of Object.entries(d.cfgs[dev]!.tracks ?? {})) if (t.sla === Number(n)) objects[dev]![on]!.flapping = true
    }
  return state
}

/** Nesne Up mu (tanımsız nesne Down; Derived.track yokken arayüz nesnesi doğrudan). */
export function objectUp(d: Derived, dev: string, n: number): boolean {
  const s = d.track?.objects[dev]?.[String(n)]
  if (s) return s.up
  const t = d.cfgs[dev]?.tracks?.[String(n)]
  return !!t?.iface && lineProtocolUp(d, dev, t.iface)
}

// ---------------- show ----------------

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

/** `show track [n]` (IOS 15 biçimine yakın; zaman yazılmaz: 00:00:00). */
export function showTrack(d: Derived, dev: string, only?: number): string[] {
  const o: string[] = []
  const cfg = d.cfgs[dev]
  const tracks = cfg?.tracks ?? {}
  const ids = Object.keys(tracks).map(Number).sort((a, b) => a - b)
  for (const n of ids) {
    if (only !== undefined && n !== only) continue
    const t = tracks[String(n)]!
    const st = d.track?.objects[dev]?.[String(n)]
    const up = st ? st.up : objectUp(d, dev, n)
    o.push(`Track ${n}`)
    if (t.sla !== undefined) {
      const kind = t.kind ?? 'state'
      const r = d.track?.sla[dev]?.[String(t.sla)]
      o.push(`  IP SLA ${t.sla} ${kind}`)
      o.push(`  ${kind === 'reachability' ? 'Reachability' : 'State'} is ${up ? 'Up' : 'Down'}`)
      if (st?.flapping) o.push('  Tracking is flapping: the probe succeeds only through the alternate route while this object is Down')
      o.push(`    ${plural(st?.changes ?? 0, 'change')}, last change 00:00:00`)
      if (t.delayUp !== undefined || t.delayDown !== undefined)
        o.push(`  Delay up ${t.delayUp ?? 0} secs, down ${t.delayDown ?? 0} secs`)
      o.push(`  Latest operation return code: ${r?.code ?? 'Unknown'}`)
      if (r?.rtt !== null && r?.rtt !== undefined) o.push(`  Latest RTT (millisecs) ${r.rtt}`)
    } else {
      o.push(`  Interface ${t.iface} line-protocol`, `  Line protocol is ${up ? 'Up' : 'Down'}`)
      if (st) o.push(`    ${plural(st.changes, 'change')}, last change 00:00:00`)
      if (t.delayUp !== undefined || t.delayDown !== undefined)
        o.push(`  Delay up ${t.delayUp ?? 0} secs, down ${t.delayDown ?? 0} secs`)
    }
    const hsrp = (d.fhrp?.members ?? []).filter((m) => m.dev === dev && m.tracks.some((x) => x.obj === n))
    const routing = (cfg?.routes ?? []).some((r) => r.track === n)
    if (hsrp.length || routing) {
      o.push('Tracked by:')
      if (routing) o.push('  Static IP Routing 0')
      for (const m of hsrp) o.push(`  HSRP ${m.ifname} ${m.group}`)
    }
  }
  return o
}

const slaIds = (d: Derived, dev: string, only?: number) =>
  Object.keys(d.cfgs[dev]?.ipSla ?? {})
    .map(Number)
    .sort((a, b) => a - b)
    .filter((n) => only === undefined || n === only)

/** `show ip sla statistics [n]` */
export function showIpSlaStatistics(d: Derived, dev: string, only?: number): string[] {
  const o = ['IPSLAs Latest Operation Statistics', '']
  for (const n of slaIds(d, dev, only)) {
    const s = d.cfgs[dev]!.ipSla![String(n)]!
    const r = d.track?.sla[dev]?.[String(n)]
    o.push(`IPSLA operation id: ${n}`)
    if (!s.scheduled || !r) {
      o.push('        Latest RTT: Unknown', 'Latest operation return code: Unknown', 'Number of successes: Unknown', 'Number of failures: Unknown', 'Operation time to live: 0', '')
      continue
    }
    o.push(`        Latest RTT: ${r.ok ? r.rtt + ' milliseconds' : 'NoConnection/Busy/Timeout'}`)
    o.push('Latest operation start time: 00:00:00 UTC')
    o.push(`Latest operation return code: ${r.code}`)
    o.push(`Number of successes: ${r.ok ? 1 : 0}`, `Number of failures: ${r.ok ? 0 : 1}`, 'Operation time to live: Forever', '')
  }
  return o
}

/** `show ip sla configuration [n]` */
export function showIpSlaConfiguration(d: Derived, dev: string, only?: number): string[] {
  const o = ['IP SLAs Infrastructure Engine-III']
  for (const n of slaIds(d, dev, only)) {
    const s = d.cfgs[dev]!.ipSla![String(n)]!
    o.push(`Entry number: ${n}`, 'Owner: ', 'Tag: ', 'Operation timeout (milliseconds): 5000')
    if (s.icmp) {
      o.push('Type of operation to perform: icmp-echo')
      if (s.icmp.srcIf) o.push(`Target address/Source interface: ${s.icmp.target}/${s.icmp.srcIf}`)
      else o.push(`Target address/Source address: ${s.icmp.target}/${s.icmp.srcIp ?? '0.0.0.0'}`)
      o.push('Type Of Service parameter: 0x0', 'Request size (ARR data portion): 28', 'Verify data: No', 'Vrf Name: ')
    } else o.push('Type of operation to perform: not configured')
    o.push('Schedule:')
    o.push(`   Operation frequency (seconds): ${s.frequency ?? 60}  (not considered if randomly scheduled)`)
    o.push(`   Next Scheduled Start Time: ${s.scheduled ? 'Start Time already passed' : 'Pending trigger'}`)
    o.push('   Group Scheduled : FALSE', '   Randomly Scheduled : FALSE', `   Life (seconds): ${s.scheduled ? 'Forever' : '3600'}`)
    o.push('')
  }
  return o
}

/** `show ip sla summary` (* etkin, ~ bekliyor) */
export function showIpSlaSummary(d: Derived, dev: string): string[] {
  const o = [
    'IPSLAs Latest Operation Summary',
    'Codes: * active, ^ inactive, ~ pending',
    '',
    'ID           Type        Destination       Stats       Return      Last',
    '                                           (ms)        Code        Run ',
    '-----------------------------------------------------------------------',
  ]
  const pad = (s: string | number, n: number) => String(s).padEnd(n)
  for (const n of slaIds(d, dev)) {
    const s = d.cfgs[dev]!.ipSla![String(n)]!
    const r = d.track?.sla[dev]?.[String(n)]
    const on = !!s.scheduled && !!r
    o.push(
      pad((on ? '*' : '~') + n, 13) + pad(s.icmp ? 'icmp-echo' : '-', 12) + pad(s.icmp?.target ?? '-', 18) +
        pad(on && r!.ok ? 'RTT=' + r!.rtt : '-', 12) + pad(on ? r!.code : 'Unknown', 12) + (on ? '0 seconds ago' : '-'),
    )
  }
  return o
}
