// Syslog tamponu (motor/syslog-zaman-diff, aşama 1).
//
// Her switch/router'ın sınırlı bir günlük tamponu vardır (`show logging`). Satırlar IOS
// biçimindedir: `*Mar  1 00:05:12.345: %LINK-3-UPDOWN: Interface …, changed state to down`.
// Zaman damgası sanal saatten gelir (runtime.ts logStamp); gerçek saat kullanılmaz.
// Olaylar durum değiştiği anda bir kez yazılır (runtime.ts diffLogs ve olay noktaları).

export interface LogEntry {
  /** sanal saat (saniye) */
  t: number
  /** önem seviyesi 0–7 */
  sev: number
  /** tesis: LINK, LINEPROTO, PM, OSPF … */
  facility: string
  /** anahtar: UPDOWN, ERR_DISABLE, ADJCHG … */
  mnemonic: string
  /** açıklama (`%FAC-S-MNEM: ` sonrası) */
  text: string
  /** tam satır (zaman damgası dahil), `show logging` çıktısı */
  line: string
}

/** Yapılandırma yoksa tampon sınırı (satır). IOS'ta varsayılan bayt sınırı platforma göre değişir. */
export const LOG_BUFFER_DEFAULT = 1000
/** `logging buffered <bayt>` aralığı (IOS) */
export const LOG_BUFFER_MIN = 4096
export const LOG_BUFFER_MAX = 2147483647

const MSG = /^%([A-Z0-9_]+)-(\d)-([A-Z0-9_]+): ?(.*)$/

/** `%FAC-S-MNEM: metin` → parçalar (biçim dışı satır: SYS-6-LOG). */
export function parseMessage(msg: string): { facility: string; sev: number; mnemonic: string; text: string } {
  const m = MSG.exec(msg)
  if (!m) return { facility: 'SYS', sev: 6, mnemonic: 'LOG', text: msg }
  return { facility: m[1]!, sev: Number(m[2]), mnemonic: m[3]!, text: m[4]! }
}

const two = (n: number) => String(n).padStart(2, '0')

/** IOS zaman damgası (saat ayarlanmamış cihaz: `*Mar  1`); ms 0–999. Gün taşarsa gün artar. */
export function formatStamp(seconds: number, ms: number): string {
  const s = Math.floor(seconds)
  const day = 1 + Math.floor(s / 86400)
  const h = Math.floor(s / 3600) % 24
  const m = Math.floor(s / 60) % 60
  return `*Mar ${String(day).padStart(2, ' ')} ${two(h)}:${two(m)}:${two(s % 60)}.${String(Math.min(999, Math.max(0, ms))).padStart(3, '0')}`
}

/** Tamponu sınırına indirir: bayt sınırı verilmişse satır + yeni satır toplamı, yoksa satır sayısı. */
export function trimBuffer(buf: LogEntry[], bytes?: number): void {
  if (!bytes) {
    if (buf.length > LOG_BUFFER_DEFAULT) buf.splice(0, buf.length - LOG_BUFFER_DEFAULT)
    return
  }
  let total = buf.reduce((n, e) => n + e.line.length + 1, 0)
  let drop = 0
  while (total > bytes && drop < buf.length) total -= buf[drop++]!.line.length + 1
  if (drop) buf.splice(0, drop)
}

/** `show logging` (başlık IOS 15 biçiminin özü; konsol/izleme/tampon sayaçları). */
export function showLogging(entries: LogEntry[], logged: number, bytes?: number): string[] {
  return [
    'Syslog logging: enabled (0 messages dropped, 0 messages rate-limited, 0 flushes, 0 overruns, xml disabled, filtering disabled)',
    '',
    `    Console logging: level debugging, ${logged} messages logged, xml disabled,`,
    '                     filtering disabled',
    '    Monitor logging: level debugging, 0 messages logged, xml disabled,',
    '                     filtering disabled',
    `    Buffer logging:  level debugging, ${logged} messages logged, xml disabled,`,
    '                    filtering disabled',
    '    Trap logging: level informational, 0 message lines logged',
    '',
    bytes ? `Log Buffer (${bytes} bytes):` : `Log Buffer (${LOG_BUFFER_DEFAULT} messages):`,
    '',
    ...entries.map((e) => e.line),
  ]
}
