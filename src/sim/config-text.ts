// L5-h: IOS yapılandırma metnini (Packet Tracer `config.runningConfig`) hoşgörülü modda
// Labber CLI'sine uygulama.
//
// Metin satır satır global yapılandırma kipinde çalıştırılır; ilk hatada durulmaz. Her satır
// sınıflandırılır:
//   applied   — Labber kabul etti (modellenen ya da Labber'da etkisiz kabul edilen komut)
//   ignored   — Labber reddetti ama ağ davranışını etkilemeyen, Packet Tracer'ın her
//               running-config'te ürettiği satır ("zararsız/yok sayıldı": version, service,
//               line con 0, banner …)
//   unmodeled — Labber reddetti ve davranışı etkileyebilir ("modellenmedi"; içe aktarma
//               raporunda görünür)
//
// IOS anlamı:
// - running-config bir durum dökümüdür: `shutdown` yazmayan arayüz açıktır. Cihaz bu metinle
//   (startup-config gibi) açılmış sayılır; bu yüzden metindeki her arayüz önce açılır, sonra
//   satırları uygulanır (router'ın fabrika `shutdown` varsayılanı yalnız yapılandırmasız açılışta).
// - Alt kipte tanınmayan satır IOS'taki gibi üst (global) kipte denenir.
// - Reddedilen bir kip satırının (ör. desteklenmeyen `interface`) alt satırları önceki kipte
//   çalıştırılmaz: blok sonuna (`!`) kadar yalnız global kipte denenir.

import { IosSession, type Mode } from './cli/ios'
import type { LabRuntime } from './runtime'

export type LineStatus = 'applied' | 'ignored' | 'unmodeled'

export interface ConfigLine {
  device: string
  /** 1-based line number in the source text */
  line: number
  command: string
  status: LineStatus
  /** why the line was ignored or not modelled */
  reason?: string
  /** applied lines: interfaces it was applied to (canonical; empty = global command) */
  ifs?: string[]
}

/** Packet Tracer'ın ürettiği, ağ davranışını etkilemeyen satırlar (Labber reddederse). */
const HARMLESS: [RegExp, string][] = [
  [/^version\s/i, 'IOS sürüm satırı'],
  [/^(no\s+)?service\s+(timestamps|password-encryption|config|pad|tcp-keepalives|sequence-numbers)\b/i, 'service ayarı (ağ davranışını etkilemez)'],
  [/^(no\s+)?ip\s+cef$/i, 'CEF anahtarlama (davranış aynı)'],
  [/^(no\s+)?ipv6\s+cef$/i, 'IPv6 CEF'],
  [/^license\s+udi\b/i, 'lisans kimliği'],
  [/^ip\s+classless$/i, 'varsayılan (classless yönlendirme)'],
  [/^ip\s+flow-export\s+version\b/i, 'NetFlow dışa aktarma sürümü'],
  [/^spanning-tree\s+extend\s+system-id$/i, 'varsayılan (genişletilmiş sistem kimliği)'],
  // Packet Tracer router'larının running-config'inde de yer alır; router'da STP yoktur
  [/^spanning-tree\s+mode\s+pvst$/i, 'varsayılan STP kipi (router\'da STP yok)'],
  [/^(no\s+)?ip\s+domain[- ]lookup$/i, 'DNS çözümleme ayarı'],
  [/^boot-(start|end)-marker$/i, 'açılış işaretçisi'],
  [/^(duplex|speed)\s+auto$/i, 'varsayılan (otomatik hız/çift yön)'],
  [/^(no\s+)?logging\s/i, 'günlük ayarı'],
  [/^end$/i, 'yapılandırma sonu'],
]

/** Satırları IOS'ta oturum/erişim ayarı olan kip blokları (alt satırları da zararsız). */
const HARMLESS_BLOCK = /^line\s+(con|aux|vty)\b/i

const ERR = /^(%|Command rejected)/
/** IOS'un bilgi iletileri (komut uygulandı) */
const INFO = /^% Access VLAN does not exist\. Creating vlan \d+$/
const isError = (out: string[]) => out.some((l) => ERR.test(l.trim()) && !INFO.test(l.trim()))

/** Kip açan satırlar: reddedilirse alt satırları önceki kipte çalıştırılmaz. */
const MODE_LINE = /^(interface|router|line|ip\s+access-list|ip\s+dhcp\s+pool|vlan\s+\d|controller|class-map|policy-map|key\s+chain|crypto)\b/i

function harmless(cmd: string): string | null {
  for (const [re, why] of HARMLESS) if (re.test(cmd)) return why
  return null
}

/**
 * Bir cihazın yapılandırma metnini hoşgörülü modda uygular. Çalışma zamanının bu cihazı
 * fabrika durumunda olmalı (createLab / köprünün CLI yolu bunu sağlar).
 */
export function applyConfigText(rt: LabRuntime, dev: string, text: string): ConfigLine[] {
  const s = new IosSession(rt, dev)
  s.mode = 'config'
  const out: ConfigLine[] = []
  const lines = text.split(/\r?\n/)
  /** reddedilen kip satırı: blok sonuna kadar alt satırlar global kipte denenir */
  let rejectedParent: { cmd: string; harmless: boolean } | null = null
  const push = (line: number, command: string, status: LineStatus, reason?: string) =>
    out.push({ device: dev, line, command, status, ...(reason ? { reason } : {}), ...(status === 'applied' ? { ifs: s.mode === 'if' ? [...s.ifs] : [] } : {}) })

  for (let i = 0; i < lines.length; i++) {
    const n = i + 1
    const cmd = lines[i]!.trim()
    if (!cmd) continue
    if (cmd.startsWith('!')) {
      // running-config belgesinde `!` bölüm sınırıdır: sonraki satır global kipte okunur
      rejectedParent = null
      s.mode = 'config'
      continue
    }
    // banner: ayraçla biten çok satırlı metin
    const banner = /^banner\s+\S+\s+(\^C|\S)(.*)$/i.exec(cmd)
    if (banner) {
      const delim = banner[1]!
      push(n, cmd, 'ignored', 'banner (ağ davranışını etkilemez)')
      if (!banner[2]!.includes(delim))
        while (i + 1 < lines.length) {
          i++
          push(i + 1, lines[i]!.trim(), 'ignored', 'banner metni')
          if (lines[i]!.includes(delim)) break
        }
      continue
    }
    if (/^end$/i.test(cmd)) {
      // IOS yapılandırmayı `end`'de bitirir; sonrası uygulanmaz
      push(n, cmd, 'ignored', 'yapılandırma sonu')
      for (let j = i + 1; j < lines.length; j++) {
        const rest = lines[j]!.trim()
        if (rest && !rest.startsWith('!')) push(j + 1, rest, 'unmodeled', '`end` satırından sonra (uygulanmaz)')
      }
      break
    }
    if (rejectedParent) {
      // alt satır: önceki kipte değil, yalnız global kipte (yeni bir üst satır olabilir)
      s.mode = 'config'
      const r = s.exec(cmd)
      if (!isError(r) && !s.pendingPrompt) {
        rejectedParent = null
        push(n, cmd, 'applied')
        continue
      }
      if (s.pendingPrompt) s.exec('')
      if (MODE_LINE.test(cmd)) {
        // reddedilen yeni bir kip satırı: yeni blok başlar
        rejectedParent = { cmd, harmless: HARMLESS_BLOCK.test(cmd) }
        if (rejectedParent.harmless) push(n, cmd, 'ignored', 'oturum/erişim hattı ayarı (ağ davranışını etkilemez)')
        else push(n, cmd, harmless(cmd) ? 'ignored' : 'unmodeled', harmless(cmd) ?? r.find((l) => ERR.test(l.trim()) && !INFO.test(l.trim()))?.trim())
        continue
      }
      const why = harmless(cmd)
      if (rejectedParent.harmless || why) push(n, cmd, 'ignored', why ?? `"${rejectedParent.cmd}" bloğu (zararsız)`)
      else push(n, cmd, 'unmodeled', `üst satır modellenmedi: ${rejectedParent.cmd}`)
      continue
    }
    const before: Mode = s.mode
    let r = s.exec(cmd)
    if (s.pendingPrompt) {
      // onay soran komut (ör. kullanımdaki eşleme): metinden yüklemede onaylanmaz
      s.exec('')
      r = [...r, '% confirmation required']
    }
    if (isError(r) && before !== 'config') {
      // IOS: alt kipte tanınmayan komut üst kipte denenir
      s.mode = 'config'
      const g = s.exec(cmd)
      if (!isError(g)) r = g
      else s.mode = before
    }
    if (!isError(r)) {
      push(n, cmd, 'applied')
      // durum dökümü: metindeki arayüz `shutdown` yazmıyorsa açıktır
      if (/^interface\s/i.test(cmd) && !/\srange\s/i.test(cmd) && (s.mode as Mode) === 'if') s.exec('no shutdown')
      continue
    }
    const why = harmless(cmd)
    const isMode = MODE_LINE.test(cmd)
    if (isMode) {
      s.mode = 'config'
      rejectedParent = { cmd, harmless: HARMLESS_BLOCK.test(cmd) }
    }
    if (why || (isMode && HARMLESS_BLOCK.test(cmd))) push(n, cmd, 'ignored', why ?? 'oturum/erişim hattı ayarı (ağ davranışını etkilemez)')
    else push(n, cmd, 'unmodeled', r.find((l) => ERR.test(l.trim()) && !INFO.test(l.trim()))?.trim())
  }
  return defaultBlocks(rt, dev, out)
}

/**
 * Packet Tracer router'ların running-config'inde varsayılan `interface Vlan1` bloğu bulunur
 * (`no ip address` + `shutdown`). Router'da SVI yoktur; blok yalnız varsayılan değerlerden
 * oluşuyorsa zararsızdır.
 */
function defaultBlocks(rt: LabRuntime, dev: string, lines: ConfigLine[]): ConfigLine[] {
  const sw = rt.topo.devices[dev]
  if (!sw || sw.kind !== 'switch' || !sw.router) return lines
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!
    if (l.status !== 'unmodeled' || !/^interface\s+vlan\s*1$/i.test(l.command)) continue
    const kids: ConfigLine[] = []
    for (let j = i + 1; j < lines.length && lines[j]!.reason?.startsWith('üst satır modellenmedi: ' + l.command); j++) kids.push(lines[j]!)
    if (!kids.every((k) => /^(no\s+ip\s+address|shutdown)$/i.test(k.command))) continue
    for (const x of [l, ...kids]) {
      x.status = 'ignored'
      x.reason = 'Packet Tracer router\'ının varsayılan Vlan1 bloğu (router\'da SVI yok)'
    }
  }
  return lines
}

export function summarize(lines: ConfigLine[]): { applied: number; ignored: number; unmodeled: number } {
  return {
    applied: lines.filter((l) => l.status === 'applied').length,
    ignored: lines.filter((l) => l.status === 'ignored').length,
    unmodeled: lines.filter((l) => l.status === 'unmodeled').length,
  }
}
