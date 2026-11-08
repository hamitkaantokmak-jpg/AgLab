// Interface names, IP math, VLAN lists, MAC helpers.

export interface IfType {
  full: string
  short: string
  /** Mbps, physical only */
  speed?: number
}

export const IF_TYPES: IfType[] = [
  { full: 'FastEthernet', short: 'Fa', speed: 100 },
  { full: 'GigabitEthernet', short: 'Gi', speed: 1000 },
  { full: 'Port-channel', short: 'Po' },
  { full: 'Vlan', short: 'Vl' },
  { full: 'Loopback', short: 'Lo' },
]

/** 'fa0/1', 'Fa 0/1', 'FastEthernet0/1' -> 'FastEthernet0/1'; null if unknown */
export function canonIf(typeTok: string, num: string): string | null {
  const t = typeTok.toLowerCase()
  const matches = IF_TYPES.filter((x) => x.full.toLowerCase().startsWith(t))
  if (matches.length !== 1) return null
  return matches[0]!.full + num
}

export function ifType(name: string): IfType | undefined {
  return IF_TYPES.find((t) => name.startsWith(t.full))
}

export function shortIf(name: string): string {
  const t = ifType(name)
  return t ? t.short + name.slice(t.full.length) : name
}

export function ifNum(name: string): string {
  const t = ifType(name)
  return t ? name.slice(t.full.length) : name
}

/** Expand 'Fa0/1-4' style specs to canonical names. */
export function ports(...specs: string[]): string[] {
  const out: string[] = []
  for (const spec of specs) {
    const m = /^([A-Za-z-]+)(\d+\/)(\d+)(?:-(\d+))?$/.exec(spec)
    if (!m) throw new Error('bad port spec ' + spec)
    const full = canonIf(m[1]!, '')!
    const from = Number(m[3])
    const to = m[4] ? Number(m[4]) : from
    for (let i = from; i <= to; i++) out.push(full + m[2] + i)
  }
  return out
}

// ---- IPv4 ----

export function ipToInt(ip: string): number | null {
  const p = ip.split('.')
  if (p.length !== 4) return null
  let n = 0
  for (const s of p) {
    if (!/^\d{1,3}$/.test(s)) return null
    const v = Number(s)
    if (v > 255) return null
    n = n * 256 + v
  }
  return n >>> 0
}

export function intToIp(n: number): string {
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
}

export function isIp(s: string): boolean {
  return ipToInt(s) !== null
}

export function maskToPrefix(mask: string): number | null {
  const n = ipToInt(mask)
  if (n === null) return null
  let len = 0
  let seenZero = false
  for (let i = 31; i >= 0; i--) {
    const bit = (n >>> i) & 1
    if (bit && seenZero) return null
    if (bit) len++
    else seenZero = true
  }
  return len
}

export function prefixToMask(len: number): string {
  return intToIp(len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0)
}

export function prefixMaskInt(len: number): number {
  return len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0
}

export function sameSubnet(a: string, b: string, len: number): boolean {
  const m = prefixMaskInt(len)
  return ((ipToInt(a)! & m) >>> 0) === ((ipToInt(b)! & m) >>> 0)
}

export function networkOf(ip: string, len: number): string {
  return intToIp((ipToInt(ip)! & prefixMaskInt(len)) >>> 0)
}

// ---- VLAN lists ----

/** '10,20,30-32' -> [10,20,30,31,32]; null if invalid */
export function parseVlanList(s: string, min = 1, max = 4094): number[] | null {
  const out = new Set<number>()
  for (const part of s.split(',')) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim())
    if (!m) return null
    const a = Number(m[1])
    const b = m[2] ? Number(m[2]) : a
    if (a < min || b > max || a > b) return null
    for (let i = a; i <= b; i++) out.add(i)
  }
  return [...out].sort((x, y) => x - y)
}

/** [1,2,3,5] -> '1-3,5' */
export function formatVlanList(v: number[]): string {
  const s = [...v].sort((a, b) => a - b)
  const parts: string[] = []
  let i = 0
  while (i < s.length) {
    let j = i
    while (j + 1 < s.length && s[j + 1] === s[j]! + 1) j++
    parts.push(j > i ? `${s[i]}-${s[j]}` : `${s[i]}`)
    i = j + 1
  }
  return parts.join(',')
}

// ---- MAC ----

export function macAdd(mac: string, n: number): string {
  const hex = mac.replace(/\./g, '')
  const v = (BigInt('0x' + hex) + BigInt(n)).toString(16).padStart(12, '0')
  return `${v.slice(0, 4)}.${v.slice(4, 8)}.${v.slice(8, 12)}`
}

export function macToColon(mac: string): string {
  const hex = mac.replace(/\./g, '')
  return hex.match(/../g)!.join(':')
}

export function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

export function pad(s: string | number, n: number): string {
  const t = String(s)
  return t.length >= n ? t + ' ' : t + ' '.repeat(n - t.length)
}

export function padL(s: string | number, n: number): string {
  const t = String(s)
  return t.length >= n ? t : ' '.repeat(n - t.length) + t
}
