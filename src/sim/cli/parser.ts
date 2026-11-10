// Tiny IOS-style command parser: patterns -> trie, abbreviation matching, '?' help, Tab completion.
//
// Pattern tokens:
//   word                   keyword
//   <1-4094:desc>          integer range
//   <vlist:desc>           VLAN list (10,20-30)
//   <A.B.C.D:desc>         IPv4 address
//   <H.H.H:desc>           MAC address (Cisco dotted, groups of 1-4 hex digits)
//   <WORD:desc>            single word
//   <LINE:desc>            rest of the line
//   <if>                   interface type keyword + <ifnum>

import { HELP } from './help'
import { IF_TYPES, isIp, parseVlanList } from '../util'

export interface Tok {
  text: string
  start: number
}

export type Param =
  | { kind: 'range'; min: number; max: number; desc: string }
  | { kind: 'vlist'; desc: string }
  | { kind: 'ip'; desc: string }
  | { kind: 'mac'; desc: string }
  | { kind: 'word'; desc: string }
  | { kind: 'line'; desc: string }
  | { kind: 'ifnum'; desc: string }

export interface TrieNode<C> {
  kws: Map<string, TrieNode<C>>
  params: { p: Param; node: TrieNode<C> }[]
  run?: (ctx: C, args: string[]) => string[] | void
  ifTypes?: boolean
}

export interface Pattern<C> {
  p: string
  run: (ctx: C, args: string[]) => string[] | void
  /** restrict <if> to these types (full names) */
  ifTypes?: string[]
}

const newNode = <C>(): TrieNode<C> => ({ kws: new Map(), params: [] })

function parseParam(spec: string): Param {
  const [head, ...rest] = spec.slice(1, -1).split(':')
  const desc = rest.join(':')
  const m = /^(\d+)-(\d+)$/.exec(head!)
  if (m) return { kind: 'range', min: Number(m[1]), max: Number(m[2]), desc }
  if (head === 'vlist') return { kind: 'vlist', desc }
  if (head === 'A.B.C.D') return { kind: 'ip', desc }
  if (head === 'H.H.H') return { kind: 'mac', desc }
  if (head === 'WORD') return { kind: 'word', desc }
  if (head === 'LINE') return { kind: 'line', desc }
  if (head === 'ifnum') return { kind: 'ifnum', desc }
  throw new Error('bad param ' + spec)
}

const sameParam = (a: Param, b: Param) => JSON.stringify(a) === JSON.stringify(b)

export function buildTrie<C>(patterns: Pattern<C>[]): TrieNode<C> {
  const root = newNode<C>()
  for (const pat of patterns) {
    let node = root
    for (const t of pat.p.match(/<[^>]*>|\S+/g)!) {
      if (t === '<if>') {
        const types = pat.ifTypes ?? IF_TYPES.map((x) => x.full)
        let numNode: TrieNode<C> | undefined
        // all type keywords share one number node per pattern so the rest of the pattern continues once
        const shared = newNode<C>()
        for (const ty of types) {
          let k = node.kws.get(ty)
          if (!k) node.kws.set(ty, (k = newNode<C>()))
          k.ifTypes = true
          let pn = k.params.find((x) => x.p.kind === 'ifnum')
          if (!pn) k.params.push((pn = { p: { kind: 'ifnum', desc: '' }, node: numNode ?? shared }))
          numNode = pn.node
        }
        node = numNode ?? shared
        continue
      }
      if (t.startsWith('<')) {
        const p = parseParam(t)
        let e = node.params.find((x) => sameParam(x.p, p))
        if (!e) node.params.push((e = { p, node: newNode<C>() }))
        node = e.node
      } else {
        let k = node.kws.get(t)
        if (!k) node.kws.set(t, (k = newNode<C>()))
        node = k
      }
    }
    node.run = pat.run
  }
  return root
}

export function tokenize(line: string): Tok[] {
  const out: Tok[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) out.push({ text: m[0], start: m.index })
  return out
}

function paramOk(p: Param, t: string): boolean {
  switch (p.kind) {
    case 'range':
      return /^\d+$/.test(t) && Number(t) >= p.min && Number(t) <= p.max
    case 'vlist':
      return parseVlanList(t) !== null
    case 'ip':
      return isIp(t)
    case 'mac':
      return /^[0-9a-f]{1,4}\.[0-9a-f]{1,4}\.[0-9a-f]{1,4}$/i.test(t)
    case 'word':
    case 'line':
      return true
    case 'ifnum':
      // L5-a: optional `.N` subinterface number (the session decides where it is allowed)
      return /^\d+(\/\d+)*(\.\d+)?$/.test(t)
  }
}

/** Split 'gi0/1' into 'gi' + '0/1' when the node expects an interface type. */
function splitIf<C>(node: TrieNode<C>, toks: Tok[], i: number) {
  const t = toks[i]!
  const m = /^([A-Za-z][A-Za-z-]*?)(\d[\d/]*(?:\.\d+)?)$/.exec(t.text)
  if (!m) return
  const hasIf = [...node.kws.entries()].some(([k, n]) => n.ifTypes && k.toLowerCase().startsWith(m[1]!.toLowerCase()))
  if (!hasIf) return
  toks.splice(i, 1, { text: m[1]!, start: t.start }, { text: m[2]!, start: t.start + m[1]!.length })
}

export type ParseResult<C> =
  | { ok: true; node: TrieNode<C>; args: string[]; starts: number[] }
  | { ok: false; err: 'invalid'; at: number }
  | { ok: false; err: 'ambiguous' }
  | { ok: false; err: 'incomplete' }
  | { ok: false; err: 'empty' }

function step<C>(node: TrieNode<C>, text: string): { next: TrieNode<C>; value: string } | 'ambiguous' | null {
  const lower = text.toLowerCase()
  const kw = [...node.kws.keys()].filter((k) => k.toLowerCase().startsWith(lower))
  const exact = kw.find((k) => k.toLowerCase() === lower)
  if (exact) return { next: node.kws.get(exact)!, value: exact }
  if (kw.length === 1) return { next: node.kws.get(kw[0]!)!, value: kw[0]! }
  const prm = node.params.find((x) => x.p.kind !== 'line' && paramOk(x.p, text))
  if (kw.length > 1 && !prm) return 'ambiguous'
  if (prm) return { next: prm.node, value: text }
  return null
}

export function parse<C>(root: TrieNode<C>, line: string): ParseResult<C> {
  const toks = tokenize(line)
  if (!toks.length) return { ok: false, err: 'empty' }
  let node = root
  const args: string[] = []
  const starts: number[] = []
  for (let i = 0; i < toks.length; i++) {
    splitIf(node, toks, i)
    const t = toks[i]!
    starts.push(t.start)
    const lineParam = node.params.find((x) => x.p.kind === 'line')
    const r = step(node, t.text)
    if (r === 'ambiguous') return { ok: false, err: 'ambiguous' }
    if (!r) {
      if (lineParam) {
        args.push(line.slice(t.start).trim())
        node = lineParam.node
        break
      }
      return { ok: false, err: 'invalid', at: t.start }
    }
    args.push(r.value)
    node = r.next
  }
  if (!node.run) return { ok: false, err: 'incomplete' }
  return { ok: true, node, args, starts }
}

function paramLabel(p: Param): string {
  switch (p.kind) {
    case 'range':
      return `<${p.min}-${p.max}>`
    case 'vlist':
      return 'WORD'
    case 'ip':
      return 'A.B.C.D'
    case 'mac':
      return 'H.H.H'
    case 'word':
      return 'WORD'
    case 'line':
      return 'LINE'
    case 'ifnum':
      return '<0-9>'
  }
}

const IFNUM_HELP = 'Interface number'

function walk<C>(root: TrieNode<C>, toks: Tok[]): { node: TrieNode<C> } | { invalidAt: number } | { ambiguous: true } | { line: true } {
  let node = root
  for (let i = 0; i < toks.length; i++) {
    splitIf(node, toks, i)
    const r = step(node, toks[i]!.text)
    if (r === 'ambiguous') return { ambiguous: true }
    if (!r) {
      if (node.params.some((x) => x.p.kind === 'line')) return { line: true }
      return { invalidAt: toks[i]!.start }
    }
    node = r.next
  }
  return { node }
}

/** Output for a line ending in '?' (the '?' already stripped). */
export function help<C>(root: TrieNode<C>, line: string): string[] | { invalidAt: number } {
  const partial = !/\s$/.test(line) && line.length > 0
  const toks = tokenize(line)
  const last = partial ? toks.pop()! : null
  const w = walk(root, toks)
  if ('ambiguous' in w) return [`% Ambiguous command: "${line.trim()}"`]
  if ('line' in w) return ['  LINE', '']
  if ('invalidAt' in w) return w
  const node = w.node
  if (last) {
    const parts = [last]
    splitIf(node, parts, 0)
    if (parts.length > 1) {
      const r = step(node, parts[0]!.text)
      if (r && r !== 'ambiguous') return ['  <0-9>'.padEnd(16) + IFNUM_HELP, '']
    }
    const lower = last.text.toLowerCase()
    const kws = [...node.kws.keys()].filter((k) => k.toLowerCase().startsWith(lower)).sort()
    if (kws.length) return [kws.join('  '), '']
    const prm = node.params.find((x) => paramOk(x.p, last.text))
    if (prm) return [paramLabel(prm.p), '']
    return { invalidAt: last.start }
  }
  const rows: [string, string][] = []
  for (const k of [...node.kws.keys()].sort()) rows.push([k, HELP[k] ?? ''])
  for (const { p } of node.params) rows.push([paramLabel(p), p.desc || (p.kind === 'ifnum' ? IFNUM_HELP : '')])
  if (node.run) rows.push(['<cr>', ''])
  const width = Math.max(14, ...rows.map((r) => r[0].length + 2))
  return [...rows.map(([a, b]) => ('  ' + a.padEnd(width) + b).trimEnd()), '']
}

/** Tab completion: returns the new line, or null when nothing unique. */
export function complete<C>(root: TrieNode<C>, line: string): string | null {
  if (!line.trim() || /\s$/.test(line)) return null
  const toks = tokenize(line)
  const last = toks.pop()!
  const w = walk(root, toks)
  if (!('node' in w)) return null
  const lower = last.text.toLowerCase()
  const kws = [...w.node.kws.keys()].filter((k) => k.toLowerCase().startsWith(lower))
  if (kws.length !== 1) return null
  return line.slice(0, last.start) + kws[0] + ' '
}
