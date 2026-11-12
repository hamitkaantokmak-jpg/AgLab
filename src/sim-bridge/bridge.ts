// AğLab topoloji JSON'u ⇄ Labber LabDef + SwitchConfig/PcConfig köprüsü (L1).
//
// Eşleme tablosu: docs/YENIDEN_YAPILANMA.md → "L2. Veri modeli köprüsü".
// İlke: desteklenen alan çevrilir; arayüz/meta alanları opak geçer; Labber'da karşılığı
// olmayan her alan `unsupported`, geçersiz/eşlenemeyen her öğe `rejected` olarak
// raporlanır ve bu durumda motor kararı 'legacy' olur. Hiçbir şey sessizce düşürülmez.
//
// L1'de bu modül ürün tarafından çağrılmaz; yalnızca testler ve motor seçim tablosu
// aracı kullanır.

import AgLabMacAddress from '../../simulator/mac-address.js'
import { defaultPhys, defaultSvi, defaultSwitchConfig, defaultVlanName, RESERVED_VLANS } from '../sim/config'
import { LabRuntime } from '../sim/runtime'
import { isApipa } from '../sim/dhcp'
import { aclKind, normAddr } from '../sim/acl'
import { emptyNat, type NatEntry } from '../sim/nat'
import type { Acl, AclAddr, AclEntry, DhcpPool, Hardware, L3Opts, LabDef, OspfConfig, PcConfig, PcDef, StaticRoute, SubIfConfig, SwitchConfig, SwitchDef } from '../sim/types'
import { canonIf, clone, ipToInt, isIp, maskToPrefix, networkOf, normalizeMac, ports as expandPorts, prefixToMask } from '../sim/util'
import type { AglabDevice, AglabInterface, AglabLink, AglabStaticRoute, AglabTopology } from './aglab'

export interface UnsupportedItem {
  device: string
  field: string
  reason: string
}
export interface RejectedItem {
  device: string
  item: string
  reason: string
}
export interface BridgeReport {
  unsupported: UnsupportedItem[]
  rejected: RejectedItem[]
  engineDecision: 'labber' | 'legacy'
  reasons: string[]
  /** cihaz → (Labber kanonik port adı → AğLab'daki özgün ad) */
  portNames: Record<string, Record<string, string>>
}
export interface BridgeResult {
  def: LabDef
  running: Record<string, SwitchConfig>
  pcs: Record<string, PcConfig>
  report: BridgeReport
  /** L5-e: err-disabled ports ('dev|canonical port') from AğLab `errdisabled` (psecure-violation) */
  errdis?: string[]
  /** L5-d: dynamic NAT translations from AğLab `natTranslations` */
  nat?: NatEntry[]
}

export const MODEL_L2 = 'WS-C2960-24TT-L'
export const MODEL_L3 = 'WS-C3650-24PS'
export const MODEL_ROUTER = 'ISR4331'
/** AğLab'ın yeni Router şablonu (src/app/main.js templates.Router.ports). */
const ROUTER_TEMPLATE_PORTS = ['g0/0', 'g0/1']
const TEMPLATES: Record<string, string[]> = {
  [MODEL_L2]: ['Fa0/1-24', 'Gi0/1-2'],
  [MODEL_L3]: ['Gi1/0/1-24', 'Gi1/1/1-4'],
}

// Opak (arayüz/meta) alanlar: Labber'a gitmez, toAglab'da özgün değeriyle kalır.
const TOP_OPAQUE = new Set(['app', 'version', 'nextId', 'selected', 'importReport', 'sourceArchive'])
const DEVICE_OPAQUE = new Set(['id', 'name', 'type', 'x', 'y', 'w', 'h', 'mode', 'config', 'selected'])
// L5-b: `dhcpLease` (adres DHCP'den alındı) ve `dns` (DNS sunucusu) PC/Server alanlarıdır.
const PC_FIELDS = new Set(['enabled', 'ports', 'interfaces', 'ip', 'mask', 'gateway', 'mac', 'vlan', 'dhcpLease', 'dns'])
const SWITCH_FIELDS = new Set([
  'enabled', 'ports', 'interfaces', 'gateway', 'vlans', 'vlanNames', 'stpPriority', 'stpPriorities', 'ip', 'mask',
])
// L4: Router. `ip`/`mask`/`gateway` cihaz düzeyinde yalnız boş olabilir; `vlan` router için
// anlamsızdır (PKT dönüştürücüsü 1 yazar) ve opak geçer.
// L5-b: `dhcpPools` / `dhcpExcluded` (IOS DHCP sunucusu) ve arayüzde `helperAddress` (relay).
// L5-d: `natOverload {aclId, outsideInterface}` ve çalışma durumu `natTranslations`
const ROUTER_FIELDS = new Set(['enabled', 'ports', 'interfaces', 'staticRoutes', 'route', 'ospf', 'ip', 'mask', 'gateway', 'vlan', 'dhcpPools', 'dhcpExcluded', 'acls', 'natOverload', 'natTranslations'])
// L5-c: `aclIn` / `aclOut` (ip access-group)
const ROUTER_IF_FIELDS = new Set(['ip', 'mask', 'enabled', 'helperAddress', 'aclIn', 'aclOut', 'natRole'])
const ACL_RULE_FIELDS = new Set(['id', 'action', 'protocol', 'srcType', 'src', 'wildcard', 'dstType', 'dst', 'dstWildcard', 'port'])
const DHCP_POOL_FIELDS = new Set(['name', 'network', 'mask', 'defaultRouter', 'dnsServer'])
// L5-a: router alt arayüzü (`g0/0.10`). Eski CLI yeni alt arayüzü `encapsulation: ''`, `vlan: 1`
// ile kurar: boş encapsulation "henüz yapılandırılmadı" demektir (eski motorda da etkin değil).
const SUBIF_FIELDS = new Set(['ip', 'mask', 'enabled', 'parent', 'vlan', 'encapsulation', 'helperAddress', 'aclIn', 'aclOut', 'natRole'])
const STATIC_ROUTE_FIELDS = new Set(['network', 'mask', 'nextHop', 'distance'])
const OSPF_FIELDS = new Set(['pid', 'routerId', 'networks'])
// Server: PC gibi bir uç; L5-b'den beri DHCP ve DNS servisleri modellenir (HTTP L5-d'ye kadar yok).
const SERVER_FIELDS = new Set([...PC_FIELDS, 'services'])
// L5-e: `portSecurity {enabled, max, violation, macs}` ve `errdisabled` (port security ihlali)
const PHYS_FIELDS = new Set(['mode', 'vlan', 'allowed', 'nativeVlan', 'enabled', 'portSecurity', 'errdisabled'])
const PS_FIELDS = ['enabled', 'max', 'violation', 'macs']
/** AğLab MAC yazımı (`02:00:00:00:00:fe`) ⇄ Labber (`0200.0000.00fe`). */
const colonMac = (dotted: string) => dotted.replace(/\./g, '').match(/../g)!.join(':')
const SVI_FIELDS = new Set(['ip', 'mask', 'enabled', 'vlan'])

const FEATURE_REASON: Record<string, string> = {
  staticRoutes: 'Switch üzerinde statik rota AğLab modelinde yok',
  route: 'Switch üzerinde varsayılan rota AğLab modelinde yok',
  acls: 'ACL Labber\'da yok (L5)',
  natOverload: 'NAT Labber\'da yok (L5)',
  natTranslations: 'NAT çeviri tablosu Labber\'da yok (L5)',
  ospf: 'Switch üzerinde OSPF AğLab modelinde yok',
  bgp: 'BGP Labber\'da yok (L5)',
  services: 'Sunucu servisleri yalnız Server cihazında modellenir',
  http: 'Sunucu servisleri içinde HTTP Labber\'da yok (L5)',
  startupConfig: 'Kaydedilmiş startup-config köprüde henüz eşlenmiyor (L7)',
  portSecurity: 'Port security Labber\'da yok (L5)',
  errdisabled: 'Port security err-disable durumu Labber\'da yok (L5)',
  encapsulation: 'Alt arayüz alanı (encapsulation) yalnız router alt arayüzünde (g0/0.N) eşlenir',
  parent: 'Alt arayüz alanı (parent) yalnız router alt arayüzünde (g0/0.N) eşlenir',
  aclIn: 'ACL Labber\'da yok (L5)',
  aclOut: 'ACL Labber\'da yok (L5)',
  natRole: 'NAT Labber\'da yok (L5)',
  helperAddress: 'DHCP relay (helperAddress) yalnız router arayüzünde ve alt arayüzünde eşlenir',
}

const sortNum = (a: number, b: number) => a - b

/** Labber'ın 3560 ailesi gibi trunk için önce encapsulation isteyen modelleri. */
export function needsEncapFor(model: string): boolean {
  return /3560/.test(model)
}

/** 'fa0/1', 'g0/1', 'FastEthernet0/1' → 'FastEthernet0/1'. Eşlenemezse null. */
export function canonPort(name: string): string | null {
  const m = /^([A-Za-z-]+)\s*(\d+(?:\/\d+)*)$/.exec(name)
  if (!m) return null
  const full = canonIf(m[1]!, m[2]!)
  if (!full) return null
  if (/^(Port-channel|Vlan|Loopback)/.test(full)) return null
  return full
}

function macToInt(mac: string): bigint {
  return BigInt('0x' + mac.replace(/[:.]/g, ''))
}
function intToDotted(v: bigint): string {
  const hex = v.toString(16).padStart(12, '0')
  return `${hex.slice(0, 4)}.${hex.slice(4, 8)}.${hex.slice(8, 12)}`
}

/** VLAN kimliği 1-4094 aralığında tam sayı mı. */
function vlanId(v: unknown): number | null {
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= 4094 ? n : null
}

export function toLabber(input: AglabTopology): BridgeResult {
  const report: BridgeReport = { unsupported: [], rejected: [], engineDecision: 'labber', reasons: [], portNames: {} }
  const unsupported = (device: string, field: string, reason: string) =>
    report.unsupported.push({ device, field, reason })
  const reject = (device: string, item: string, reason: string) => report.rejected.push({ device, item, reason })

  for (const key of Object.keys(input))
    if (!TOP_OPAQUE.has(key) && key !== 'devices' && key !== 'links')
      unsupported('*', key, 'Tanınmayan üst düzey alan')

  const devices = Array.isArray(input.devices) ? input.devices : []
  const links = Array.isArray(input.links) ? input.links : []

  // MAC: mevcut AgLabMacAddress çözücüsü (açık uç MAC'leri korunur).
  let resolveMac: ((d: AglabDevice) => string) | null = null
  try {
    const resolver = AgLabMacAddress.createResolver()
    resolver(devices[0] ?? {}, devices)
    resolveMac = (d) => resolver(d, devices)
  } catch (error) {
    reject('*', 'mac', 'MAC adresi doğrulaması başarısız: ' + String((error as Error).message ?? error))
  }

  const def: LabDef = {
    id: 'aglab-bridge', title: '', summary: '', level: 'Başlangıç', tags: [], brief: [],
    devices: [], links: [], objectives: [], solution: {}, view: { w: 1000, h: 700 },
  }
  const running: Record<string, SwitchConfig> = {}
  const pcs: Record<string, PcConfig> = {}
  const canonByDevice: Record<string, Record<string, string>> = {}
  const usedMacs = new Map<string, string>()
  const errdis: string[] = []
  const nat: NatEntry[] = []
  const ids = new Set<string>()

  const claimMac = (dev: string, mac: string) => {
    const other = usedMacs.get(mac)
    if (other !== undefined) reject(dev, 'mac', `MAC ${mac} ${other} ile çakışıyor`)
    else usedMacs.set(mac, dev)
  }

  /** AğLab port listesini kanonik adlara çevirir; eşlenemeyen/yinelenen ad reddedilir. */
  const mapPorts = (id: string, sourcePorts: string[]) => {
    const portMap: Record<string, string> = {}
    const canonPorts: string[] = []
    for (const p of sourcePorts) {
      const c = canonPort(p)
      if (!c) {
        reject(id, p, 'Eşlenemeyen port adı')
        continue
      }
      if (portMap[c] !== undefined) {
        reject(id, p, `Port ${c} iki kez tanımlı (${portMap[c]})`)
        continue
      }
      portMap[c] = p
      canonPorts.push(c)
    }
    return { portMap, canonPorts }
  }

  /** L5-b: `helperAddress` (tek adres) → `ip helper-address`; geçersizse reddedilir. */
  const helperOf = (id: string, name: string, iface: AglabInterface): string[] | null => {
    const h = iface['helperAddress']
    if (h === undefined || h === '') return null
    if (typeof h !== 'string' || !isIp(h)) {
      reject(id, `${name}.helperAddress`, 'Geçersiz helper-address')
      return null
    }
    return [h]
  }

  /** L5-c: `aclIn` / `aclOut` → L3Opts (boş metin = uygulanmamış). */
  const accessGroups = (id: string, name: string, iface: AglabInterface) => {
    const out: { aclIn?: string; aclOut?: string } = {}
    for (const k of ['aclIn', 'aclOut'] as const) {
      const v = iface[k]
      if (v === undefined || v === '' || v === null) continue
      if (typeof v !== 'string' && typeof v !== 'number') reject(id, `${name}.${k}`, 'Geçersiz ACL kimliği')
      else out[k] = String(v)
    }
    return Object.keys(out).length ? out : null
  }

  /** L5-d: `natRole` → L3Opts.nat (boş = rolsüz). */
  const natRoleOf = (id: string, name: string, iface: AglabInterface): { nat?: 'inside' | 'outside' } | null => {
    const v = iface['natRole']
    if (v === undefined || v === '' || v === null) return null
    if (v !== 'inside' && v !== 'outside') {
      reject(id, `${name}.natRole`, 'natRole inside ya da outside olmalı')
      return null
    }
    return { nat: v }
  }

  /**
   * L5-c: eski motor kuralları → Labber listeleri. 1-99 standart, 100-199 genişletilmiş; isimli
   * listenin türü kurallarından çıkarılır (yalnız `ip` ve hedef `any` → standart).
   */
  const aclsToLabber = (id: string, rules: Record<string, unknown>[]): Record<string, Acl> | null => {
    const lists: Record<string, Acl> = {}
    const order: string[] = []
    let ok = true
    const addr = (type: unknown, a: unknown, w: unknown, where: string): AclAddr | null => {
      if (type === undefined || type === 'any') return { addr: '0.0.0.0', wild: '255.255.255.255' }
      if (type === 'host' && typeof a === 'string' && isIp(a)) return { addr: a, wild: '0.0.0.0' }
      if (type === 'network' && typeof a === 'string' && isIp(a) && typeof w === 'string' && isIp(w)) return normAddr(a, w)
      reject(id, where, 'Geçersiz ACL adres/wildcard')
      ok = false
      return null
    }
    rules.forEach((r, i) => {
      const where = `acls[${i}]`
      for (const k of Object.keys(r ?? {})) if (!ACL_RULE_FIELDS.has(k)) unsupported(id, `${where}.${k}`, 'Labber\'da karşılığı olmayan ACL alanı')
      const name = String(r?.['id'] ?? '')
      const proto = String(r?.['protocol'] ?? 'ip')
      if (!name || !['permit', 'deny'].includes(String(r?.['action'])) || !['ip', 'icmp', 'tcp', 'udp'].includes(proto)) {
        reject(id, where, 'Geçersiz ACL kuralı')
        ok = false
        return
      }
      const src = addr(r['srcType'], r['src'], r['wildcard'], where + '.src')
      const dst = addr(r['dstType'], r['dst'], r['dstWildcard'], where + '.dst')
      const port = r['port']
      if (port !== undefined && port !== null && (!['tcp', 'udp'].includes(proto) || !Number.isInteger(Number(port)) || Number(port) < 0 || Number(port) > 65535)) {
        reject(id, where + '.port', 'ACL portu yalnız tcp/udp için 0-65535')
        ok = false
        return
      }
      if (!src || !dst) return
      if (!lists[name]) {
        lists[name] = { type: 'extended', entries: [] }
        order.push(name)
      }
      const e: AclEntry = {
        seq: (lists[name]!.entries.length + 1) * 10, action: r['action'] as 'permit' | 'deny', proto: proto as AclEntry['proto'], src, dst,
        ...(port !== undefined && port !== null ? { dstPort: { op: 'eq' as const, a: Number(port) } } : {}),
      }
      lists[name]!.entries.push(e)
    })
    for (const name of order) {
      const l = lists[name]!
      const plain = l.entries.every((e) => e.proto === 'ip' && !e.dstPort && e.dst!.wild === '255.255.255.255')
      const kind = aclKind(name) ?? (plain ? 'standard' : 'extended')
      if (kind === 'standard') {
        if (!plain) {
          reject(id, `acls.${name}`, 'Standart ACL (1-99) yalnız kaynak adresi eşler')
          ok = false
          continue
        }
        l.type = 'standard'
        for (const e of l.entries) delete e.dst
      }
    }
    return ok ? lists : null
  }

  // ---- Router (L4) ----
  const routerToLabber = (d: AglabDevice, id: string, off: boolean) => {
    for (const key of ['ip', 'mask', 'gateway'] as const)
      if (d[key] !== undefined && d[key] !== '') unsupported(id, key, 'Router\'da cihaz düzeyi adres alanı AğLab modelinde yok (arayüz adresleri kullanılır)')
    const ifaces = d.interfaces ?? {}
    const sourcePorts = d.ports ?? [...new Set([...ROUTER_TEMPLATE_PORTS, ...Object.keys(ifaces).filter((n) => !n.includes('.'))])]
    const { portMap, canonPorts } = mapPorts(id, sourcePorts)
    canonByDevice[id] = Object.fromEntries(Object.entries(portMap).map(([c, o]) => [o, c]))
    report.portNames[id] = portMap
    const pktModel = typeof d.config?.packetTracerModel === 'string' ? (d.config.packetTracerModel as string) : ''
    const sw: SwitchDef = {
      id, kind: 'switch', router: true, l3: true, model: pktModel || MODEL_ROUTER, mac: '0000.0000.0000', ports: canonPorts,
      x: Number(d.x ?? 0), y: Number(d.y ?? 0), ...(off ? { off: true } : {}),
    }
    if (resolveMac) sw.mac = intToDotted((0x02n << 40n) | ((macToInt(resolveMac(d)) & 0xffffffffn) << 8n))
    claimMac(id, sw.mac)
    def.devices.push(sw)
    const cfg = defaultSwitchConfig(sw)
    cfg.hostname = d.name || id
    // AğLab'da arayüz kaydı olmayan router portu açık ve adressizdir (eski motor: enabled !== false).
    for (const c of canonPorts) cfg.ifaces[c]!.shutdown = false
    for (const [name, iface] of Object.entries(ifaces)) {
      if (name.includes('.')) continue
      const c = canonPort(name)
      if (!c || portMap[c] === undefined) {
        reject(id, name, c ? 'Arayüz cihazın port listesinde yok' : 'Eşlenemeyen arayüz adı')
        continue
      }
      for (const key of Object.keys(iface))
        if (!ROUTER_IF_FIELDS.has(key)) unsupported(id, `interfaces.${name}.${key}`, FEATURE_REASON[key] ?? 'Labber\'da karşılığı olmayan router arayüz alanı')
      const phys = cfg.ifaces[c]!
      phys.shutdown = iface.enabled === false
      if (iface.ip) {
        const pre = iface.mask ? maskToPrefix(iface.mask) : null
        if (!isIp(iface.ip) || pre === null || pre === 0) reject(id, name, 'Geçersiz router arayüzü IPv4 adresi/maskesi')
        else phys.ip = { addr: iface.ip, mask: iface.mask! }
      }
      const helpers = helperOf(id, name, iface)
      if (helpers) phys.l3 = { ...(phys.l3 ?? {}), helpers }
      const groups = accessGroups(id, name, iface)
      if (groups) phys.l3 = { ...(phys.l3 ?? {}), ...groups }
      const role = natRoleOf(id, name, iface)
      if (role) phys.l3 = { ...(phys.l3 ?? {}), ...role }
    }
    // L5-a: alt arayüzler (`<fiziksel>.<n>`, 802.1Q)
    for (const [name, iface] of Object.entries(ifaces)) {
      if (!name.includes('.')) continue
      const dot = name.indexOf('.')
      const physName = name.slice(0, dot)
      const sub = name.slice(dot + 1)
      const parent = canonPort(physName)
      if (!parent || portMap[parent] === undefined || !/^\d+$/.test(sub) || Number(sub) < 1 || Number(sub) > 4294967295) {
        reject(id, name, 'Alt arayüzün fiziksel portu cihazda yok ya da numarası geçersiz')
        continue
      }
      for (const key of Object.keys(iface))
        if (!SUBIF_FIELDS.has(key)) unsupported(id, `interfaces.${name}.${key}`, FEATURE_REASON[key] ?? 'Labber\'da karşılığı olmayan alt arayüz alanı')
      if (iface.parent !== undefined && canonPort(String(iface.parent)) !== parent) {
        reject(id, `${name}.parent`, 'Alt arayüzün parent alanı adıyla uyuşmuyor')
        continue
      }
      let vlan: number | null = null
      if (iface.encapsulation !== undefined && iface.encapsulation !== '') {
        const v = vlanId(iface.vlan)
        if (iface.encapsulation !== 'dot1q') reject(id, `${name}.encapsulation`, 'Yalnız 802.1Q (dot1q) alt arayüzü modellenir')
        else if (v === null) reject(id, `${name}.vlan`, 'Geçersiz 802.1Q VLAN kimliği')
        else vlan = v
      }
      const key = `${parent}.${Number(sub)}`
      const subs = (cfg.subifs ??= {})
      if (vlan !== null && Object.values(subs).some((x) => x.parent === parent && x.vlan === vlan)) {
        reject(id, name, `Aynı fiziksel portta VLAN ${vlan} iki alt arayüzde`)
        continue
      }
      let ip: SubIfConfig['ip'] = null
      if (iface.ip) {
        const pre = iface.mask ? maskToPrefix(iface.mask) : null
        if (!isIp(iface.ip) || pre === null || pre === 0) reject(id, name, 'Geçersiz alt arayüz IPv4 adresi/maskesi')
        else if (vlan === null) reject(id, name, 'encapsulation dot1q olmadan alt arayüz IP adresi (IOS kabul etmez)')
        else ip = { addr: iface.ip, mask: iface.mask! }
      }
      subs[key] = { parent, vlan, native: false, shutdown: iface.enabled === false, description: '', ip }
      const helpers = helperOf(id, name, iface)
      if (helpers) subs[key]!.l3 = { helpers }
      const groups = accessGroups(id, name, iface)
      if (groups) subs[key]!.l3 = { ...(subs[key]!.l3 ?? {}), ...groups }
      const role = natRoleOf(id, name, iface)
      if (role) subs[key]!.l3 = { ...(subs[key]!.l3 ?? {}), ...role }
    }
    // L5-d: NAT overload (PAT, outside arayüz adresiyle) ve çeviri tablosu
    if (d.natOverload !== undefined && d.natOverload !== null) {
      const n = d.natOverload as Record<string, unknown>
      const out = typeof n['outsideInterface'] === 'string' ? String(n['outsideInterface']) : ''
      const dot = out.indexOf('.')
      const canon = dot < 0 ? canonPort(out) : canonPort(out.slice(0, dot)) + out.slice(dot)
      const known = !!canon && (dot < 0 ? portMap[canon] !== undefined : !!cfg.subifs?.[canon])
      if (typeof n !== 'object' || n['aclId'] === undefined || n['aclId'] === '' || !known)
        reject(id, 'natOverload', 'NAT overload için ACL kimliği ve cihazdaki outside arayüzü gerekli')
      else {
        for (const k of Object.keys(n)) if (k !== 'aclId' && k !== 'outsideInterface') unsupported(id, `natOverload.${k}`, 'Labber\'da karşılığı olmayan NAT alanı')
        cfg.nat = { ...emptyNat(), rules: [{ acl: String(n['aclId']), iface: canon!, overload: true }] }
      }
    }
    if (d.natTranslations !== undefined) {
      if (!Array.isArray(d.natTranslations)) reject(id, 'natTranslations', 'NAT çeviri tablosu dizi olmalı')
      else
        (d.natTranslations as Record<string, unknown>[]).forEach((t, i) => {
          const proto = t?.['protocol']
          const ips = ['insideLocal', 'insideGlobal', 'outsideLocal'].map((k) => String(t?.[k] ?? ''))
          if ((proto !== 'icmp' && proto !== 'tcp' && proto !== 'udp') || !ips.every(isIp))
            return reject(id, `natTranslations[${i}]`, 'Geçersiz NAT çeviri girdisi')
          nat.push({ dev: id, proto, insideLocal: ips[0]!, insideGlobal: ips[1]!, outsideLocal: ips[2]! })
        })
    }
    // L5-c: ACL'ler (eski motor kuralları; liste kimliğine göre sırayla gruplanır)
    if (d.acls !== undefined) {
      if (!Array.isArray(d.acls)) reject(id, 'acls', 'ACL listesi dizi olmalı')
      else {
        const lists = aclsToLabber(id, d.acls as Record<string, unknown>[])
        if (lists) cfg.acls = lists
      }
    }
    // L5-b: IOS DHCP sunucusu (`ip dhcp pool`, `ip dhcp excluded-address`)
    if (d.dhcpPools !== undefined) {
      if (!Array.isArray(d.dhcpPools)) reject(id, 'dhcpPools', 'DHCP havuz listesi dizi olmalı')
      else
        (d.dhcpPools as Record<string, unknown>[]).forEach((pool, i) => {
          const where = `dhcpPools[${i}]`
          for (const key of Object.keys(pool ?? {}))
            if (!DHCP_POOL_FIELDS.has(key)) unsupported(id, `${where}.${key}`, 'Labber\'da karşılığı olmayan DHCP havuz alanı')
          const name = pool?.['name']
          if (typeof name !== 'string' || !name || /\s/.test(name)) return reject(id, where, 'DHCP havuz adı boşluksuz bir metin olmalı')
          if (cfg.dhcpPools?.[name]) return reject(id, where, 'Aynı adla yinelenen DHCP havuzu')
          const out: DhcpPool = { net: null, defaultRouter: null, dns: null }
          const network = pool['network'] ?? ''
          if (network !== '') {
            const pre = isIp(String(pool['mask'] ?? '')) ? maskToPrefix(String(pool['mask'])) : null
            if (!isIp(String(network)) || pre === null || pre < 1 || pre > 30 || networkOf(String(network), pre) !== network)
              return reject(id, where, 'Geçersiz DHCP havuz ağı (ağ adresi/maske)')
            out.net = { addr: String(network), mask: String(pool['mask']) }
          }
          for (const [key, field] of [['defaultRouter', 'defaultRouter'], ['dnsServer', 'dns']] as const) {
            const v = pool[key] ?? ''
            if (v === '') continue
            if (!isIp(String(v))) return reject(id, `${where}.${key}`, 'Geçersiz IPv4 adresi')
            out[field] = String(v)
          }
          ;(cfg.dhcpPools ??= {})[name] = out
        })
    }
    if (d.dhcpExcluded !== undefined) {
      if (!Array.isArray(d.dhcpExcluded)) reject(id, 'dhcpExcluded', 'DHCP dışlanan adres listesi dizi olmalı')
      else
        (d.dhcpExcluded as Record<string, unknown>[]).forEach((r, i) => {
          const where = `dhcpExcluded[${i}]`
          for (const key of Object.keys(r ?? {}))
            if (key !== 'start' && key !== 'end') unsupported(id, `${where}.${key}`, 'Labber\'da karşılığı olmayan DHCP dışlama alanı')
          const lo = String(r?.['start'] ?? '')
          const hi = String(r?.['end'] ?? lo)
          if (!isIp(lo) || !isIp(hi) || ipToInt(hi)! < ipToInt(lo)!) return reject(id, where, 'Geçersiz DHCP dışlanan adres aralığı')
          ;(cfg.dhcpExcluded ??= []).push({ lo, hi })
        })
    }
    // Statik rotalar: AD (distance) 1-255; yoksa 1. Eski `route` alanı, listede varsayılan
    // rota yoksa AD 1 varsayılan rotadır (src/engine/routing.js staticRoutes ile aynı kural).
    const list: AglabStaticRoute[] = Array.isArray(d.staticRoutes) ? d.staticRoutes : []
    if (d.staticRoutes !== undefined && !Array.isArray(d.staticRoutes)) reject(id, 'staticRoutes', 'Statik rota listesi dizi olmalı')
    list.forEach((r, i) => {
      const where = `staticRoutes[${i}]`
      for (const key of Object.keys(r ?? {}))
        if (!STATIC_ROUTE_FIELDS.has(key)) unsupported(id, `${where}.${key}`, 'Labber\'da karşılığı olmayan statik rota alanı')
      const prefix = isIp(r?.mask ?? '') ? maskToPrefix(r.mask) : null
      const ad = r?.distance === undefined ? 1 : Number(r.distance)
      if (!isIp(r?.network ?? '') || prefix === null || !isIp(r?.nextHop ?? '')) return reject(id, where, 'Geçersiz statik rota (ağ/maske/next-hop)')
      if (networkOf(r.network, prefix) !== r.network) return reject(id, where, 'Statik rota ağ adresi maskeyle hizalı değil')
      if (!Number.isInteger(ad) || ad < 1 || ad > 255) return reject(id, where, 'Statik rota AD 1-255 arasında tam sayı olmalı')
      if (cfg.routes.some((x) => x.net === r.network && x.mask === r.mask && x.nh === r.nextHop))
        return reject(id, where, 'Aynı ağ ve next-hop ile yinelenen statik rota')
      cfg.routes.push(ad === 1 ? { net: r.network, mask: r.mask, nh: r.nextHop } : { net: r.network, mask: r.mask, nh: r.nextHop, ad })
    })
    if (d.route !== undefined && d.route !== '') {
      if (typeof d.route !== 'string' || !isIp(d.route)) reject(id, 'route', 'Geçersiz varsayılan rota next-hop\'u: ' + String(d.route))
      else if (!cfg.routes.some((x) => x.net === '0.0.0.0' && x.mask === '0.0.0.0')) cfg.routes.push({ net: '0.0.0.0', mask: '0.0.0.0', nh: d.route })
    }
    if (d.ospf !== undefined && d.ospf !== null) {
      const o = d.ospf as Record<string, unknown>
      for (const key of Object.keys(o))
        if (!OSPF_FIELDS.has(key)) unsupported(id, `ospf.${key}`, 'Labber\'da karşılığı olmayan AğLab OSPF alanı')
      const pid = Number(o['pid'] ?? 1)
      const rid = o['routerId'] ?? null
      const nets = Array.isArray(o['networks']) ? (o['networks'] as Record<string, unknown>[]) : []
      if (!Number.isInteger(pid) || pid < 1 || pid > 65535) reject(id, 'ospf.pid', 'Geçersiz OSPF süreç numarası')
      else if (rid !== null && rid !== '' && !isIp(String(rid))) reject(id, 'ospf.routerId', 'Geçersiz OSPF router-id')
      else {
        const ospf: OspfConfig = {
          pid, routerId: rid ? String(rid) : null, activeRid: rid ? String(rid) : null, networks: [],
          passiveDefault: false, passive: [], refBw: 100, defaultOriginate: null, stubs: {},
        }
        nets.forEach((n, i) => {
          for (const key of Object.keys(n ?? {}))
            if (!['network', 'wildcard', 'area'].includes(key)) unsupported(id, `ospf.networks[${i}].${key}`, 'Labber\'da karşılığı olmayan OSPF network alanı')
          const area = Number(n?.['area'])
          if (!isIp(String(n?.['network'] ?? '')) || !isIp(String(n?.['wildcard'] ?? '')) || !Number.isInteger(area) || area < 0)
            reject(id, `ospf.networks[${i}]`, 'Geçersiz OSPF network satırı')
          else ospf.networks.push({ addr: String(n['network']), wildcard: String(n['wildcard']), area })
        })
        cfg.ospf = ospf
      }
    }
    running[id] = cfg
  }

  for (const d of devices) {
    const id = String(d.id)
    if (ids.has(id)) {
      reject(id, 'id', 'Yinelenen cihaz kimliği')
      continue
    }
    ids.add(id)
    const fields =
      d.type === 'PC' ? PC_FIELDS : d.type === 'Server' ? SERVER_FIELDS : d.type === 'Switch' ? SWITCH_FIELDS : d.type === 'Router' ? ROUTER_FIELDS : null
    if (!fields) {
      unsupported(id, 'type', `${d.type} cihaz tipi Labber köprüsünde yok`)
      continue
    }
    for (const key of Object.keys(d))
      if (!DEVICE_OPAQUE.has(key) && !fields.has(key))
        unsupported(id, key, FEATURE_REASON[key] ?? 'Labber\'da karşılığı olmayan alan')
    // Güç: yalnız açık `enabled: false` kapalıdır (eksik alan açık sayılır; içerikte hep açık yazılı).
    const off = d.enabled === false

    if (d.type === 'Server') {
      // L5-b: DHCP ve DNS servisleri modellenir; açık HTTP servisi eski motorda kalır.
      const services = d.services
      if (services !== undefined && (typeof services !== 'object' || services === null || Array.isArray(services)))
        reject(id, 'services', 'Servis listesi nesne olmalı')
      else
        for (const [name, on] of Object.entries(services ?? {})) {
          if (typeof on !== 'boolean') reject(id, `services.${name}`, 'Servis durumu true/false olmalı')
          else if (name !== 'dhcp' && name !== 'dns' && on)
            unsupported(id, `services.${name}`, name === 'http' ? FEATURE_REASON['http']! : 'Bilinmeyen sunucu servisleri Labber\'da yok: ' + name)
        }
    }

    if (d.type === 'Router') {
      routerToLabber(d, id, off)
      continue
    }

    if (d.type === 'PC' || d.type === 'Server') {
      const ports = d.ports ?? ['eth0']
      if (ports.length !== 1 || ports[0] !== 'eth0') reject(id, 'ports', 'PC yalnızca tek eth0 portuyla modellenir')
      for (const [name, iface] of Object.entries(d.interfaces ?? {})) {
        if (name !== 'eth0') {
          reject(id, name, 'PC arayüzü yalnızca eth0 olabilir')
          continue
        }
        for (const key of Object.keys(iface))
          if (key !== 'enabled') unsupported(id, `interfaces.eth0.${key}`, 'Labber\'da karşılığı olmayan PC arayüz alanı')
      }
      const ip = d.ip ?? ''
      const prefix = d.mask ? maskToPrefix(d.mask) : null
      if (ip && !isIp(ip)) reject(id, 'ip', 'Geçersiz IPv4 adresi: ' + ip)
      if (ip && prefix === null) reject(id, 'mask', 'Geçersiz alt ağ maskesi: ' + d.mask)
      if (d.gateway && !isIp(d.gateway)) reject(id, 'gateway', 'Geçersiz ağ geçidi: ' + d.gateway)
      pcs[id] = {
        ip: ip && isIp(ip) && prefix !== null ? ip : null,
        prefix: prefix ?? 24,
        gw: d.gateway && isIp(d.gateway) ? d.gateway : null,
      }
      // L5-b: DHCP istemci durumu, DNS sunucusu ve sunucu servisleri
      if (d.dhcpLease !== undefined && typeof d.dhcpLease !== 'boolean') reject(id, 'dhcpLease', 'dhcpLease true/false olmalı')
      else if (d.dhcpLease) pcs[id]!.dhcp = true
      if (d.dns !== undefined && d.dns !== '') {
        if (typeof d.dns !== 'string' || !isIp(d.dns)) reject(id, 'dns', 'Geçersiz DNS sunucusu adresi: ' + String(d.dns))
        else pcs[id]!.dns = d.dns
      }
      if (d.type === 'Server') {
        const sv = (d.services ?? {}) as Record<string, unknown>
        if (sv['dhcp'] === true || sv['dns'] === true)
          pcs[id]!.services = { ...(sv['dhcp'] === true ? { dhcp: true } : {}), ...(sv['dns'] === true ? { dns: true } : {}) }
      }
      const mac = resolveMac ? intToDotted(macToInt(resolveMac(d))) : '0000.0000.0000'
      claimMac(id, mac)
      const pc: PcDef = {
        id, kind: 'pc', mac, x: Number(d.x ?? 0), y: Number(d.y ?? 0),
        ...(d.name ? { name: d.name } : {}),
        ...(d.type === 'Server' ? { server: true } : {}),
        ...(off ? { off: true } : {}),
        ...(d.interfaces?.['eth0']?.enabled === false ? { nicDown: true } : {}),
      }
      def.devices.push(pc)
      canonByDevice[id] = { eth0: 'eth0' }
      report.portNames[id] = { eth0: 'eth0' }
      continue
    }

    // ---- Switch ----
    if (d.ip || d.mask) unsupported(id, 'ip', 'Cihaz düzeyi switch IP adresi; yönetim adresi SVI üzerinden verilir')
    const ifaces = d.interfaces ?? {}
    const svis = Object.entries(ifaces).filter(([n]) => /^vlan\d+$/i.test(n))
    const l3 = svis.some(([, i]) => !!i.ip)
    const pktModel = typeof d.config?.packetTracerModel === 'string' ? (d.config.packetTracerModel as string) : ''
    const model = pktModel || (l3 ? MODEL_L3 : MODEL_L2)
    const sourcePorts = d.ports ?? (TEMPLATES[model] ? expandPorts(...TEMPLATES[model]!).map((p) => p) : [])
    const { portMap, canonPorts } = mapPorts(id, sourcePorts)
    if (!d.ports) {
      // Şablon portları kanonik adla gelir; AğLab'da kullanılan yazımı (ör. fa0/1) koru.
      const used = [
        ...Object.keys(d.interfaces ?? {}),
        ...links.flatMap((l) => (String(l.a) === id ? [String(l.portA)] : String(l.b) === id ? [String(l.portB)] : [])),
      ]
      for (const name of used) {
        const c = canonPort(name)
        if (c && portMap[c] === c) portMap[c] = name
      }
    }
    canonByDevice[id] = Object.fromEntries(Object.entries(portMap).map(([c, o]) => [o, c]))
    report.portNames[id] = portMap
    const sw: SwitchDef = {
      id, kind: 'switch', model, mac: '0000.0000.0000', ports: canonPorts, x: Number(d.x ?? 0), y: Number(d.y ?? 0),
      ...(l3 ? { l3: true } : {}),
      ...(needsEncapFor(model) ? { needsEncap: true } : {}),
      ...(off ? { off: true } : {}),
    }
    if (resolveMac) {
      // Labber SVI/routed port MAC'lerini tabandan türetir (taban+0x40, taban+port+1);
      // switch tabanları arasında 0x100 boşluk bırakılır.
      const v = macToInt(resolveMac(d))
      sw.mac = intToDotted((0x02n << 40n) | ((v & 0xffffffffn) << 8n))
    }
    claimMac(id, sw.mac)
    def.devices.push(sw)

    const cfg = defaultSwitchConfig(sw)
    cfg.hostname = d.name || id
    // VLAN veritabanı
    for (const v of d.vlans ?? [1]) {
      const n = vlanId(v)
      if (n === null) {
        reject(id, `vlans.${v}`, 'Geçersiz VLAN kimliği')
        continue
      }
      cfg.vlans[String(n)] = d.vlanNames?.[String(n)] ?? cfg.vlans[String(n)] ?? defaultVlanName(n)
    }
    for (const k of Object.keys(d.vlanNames ?? {}))
      if (!(d.vlans ?? [1]).map(Number).includes(Number(k))) reject(id, `vlanNames.${k}`, 'Veritabanında olmayan VLAN için ad')
    // Ağ geçidi
    if (d.gateway) {
      if (isIp(d.gateway)) cfg.defaultGateway = d.gateway
      else reject(id, 'gateway', 'Geçersiz ağ geçidi: ' + d.gateway)
    }
    // STP önceliği: AğLab değeri sys-id-ext İÇERMEZ (ör. 4096); Labber stpPriority de
    // içermez, `show spanning-tree` ve LabQuery.bridgePriority VLAN kimliğini ekler.
    const prio = (v: unknown, where: string): number | null => {
      const n = Number(v)
      if (!Number.isInteger(n) || n < 0 || n > 61440 || n % 4096 !== 0) {
        reject(id, where, 'STP önceliği 0-61440 arasında 4096\'nın katı olmalı: ' + String(v))
        return null
      }
      return n
    }
    if (d.stpPriority !== undefined) {
      const g = prio(d.stpPriority, 'stpPriority')
      if (g !== null) for (const v of Object.keys(cfg.vlans)) if (!RESERVED_VLANS.includes(Number(v)) || v === '1') cfg.stpPriority[v] = g
    }
    for (const [v, p] of Object.entries(d.stpPriorities ?? {})) {
      const n = vlanId(v)
      const value = prio(p, `stpPriorities.${v}`)
      if (n === null) reject(id, `stpPriorities.${v}`, 'Geçersiz VLAN kimliği')
      else if (value !== null) cfg.stpPriority[String(n)] = value
    }
    // Arayüzler
    for (const [name, iface] of Object.entries(ifaces)) {
      if (/^vlan\d+$/i.test(name)) {
        const v = vlanId(name.slice(4))
        if (v === null) {
          reject(id, name, 'Geçersiz SVI adı')
          continue
        }
        for (const key of Object.keys(iface))
          if (!SVI_FIELDS.has(key)) unsupported(id, `interfaces.${name}.${key}`, FEATURE_REASON[key] ?? 'Labber\'da karşılığı olmayan SVI alanı')
        const svi = cfg.svis[String(v)] ?? defaultSvi(v)
        svi.shutdown = iface.enabled === false
        if (iface.ip) {
          const pre = iface.mask ? maskToPrefix(iface.mask) : null
          if (!isIp(iface.ip) || pre === null) reject(id, name, 'Geçersiz SVI IPv4 adresi/maskesi')
          else svi.ip = { addr: iface.ip, mask: iface.mask! }
        }
        cfg.svis[String(v)] = svi
        continue
      }
      const c = canonPort(name)
      if (!c || portMap[c] === undefined) {
        reject(id, name, c ? 'Arayüz cihazın port listesinde yok' : 'Eşlenemeyen arayüz adı')
        continue
      }
      for (const key of Object.keys(iface))
        if (!PHYS_FIELDS.has(key))
          unsupported(id, `interfaces.${name}.${key}`, FEATURE_REASON[key] ?? (key === 'ip' || key === 'mask' ? 'Switch fiziksel portunda IP (routed port) köprüde henüz yok (L4)' : 'Labber\'da karşılığı olmayan arayüz alanı'))
      const phys = cfg.ifaces[c] ?? defaultPhys()
      const mode = iface.mode ?? 'access'
      if (mode !== 'access' && mode !== 'trunk') {
        reject(id, `${name}.mode`, 'Bilinmeyen port modu: ' + mode)
        continue
      }
      phys.mode = mode
      phys.shutdown = iface.enabled === false
      const access = vlanId(iface.vlan ?? 1)
      if (access === null) reject(id, `${name}.vlan`, 'Geçersiz access VLAN')
      else phys.accessVlan = access
      const native = vlanId(iface.nativeVlan ?? 1)
      if (native === null) reject(id, `${name}.nativeVlan`, 'Geçersiz native VLAN')
      else phys.nativeVlan = native
      // AğLab: `allowed` yoksa trunk HİÇBİR VLAN'ı taşımaz; Labber'da null "tümü" demektir.
      const allowed = (iface.allowed ?? []).map(vlanId)
      if (allowed.some((x) => x === null)) reject(id, `${name}.allowed`, 'Geçersiz izinli VLAN listesi')
      else phys.allowed = [...new Set(allowed as number[])].sort(sortNum)
      if (mode === 'trunk' && sw.needsEncap) phys.encapDot1q = true
      // L5-e: port security (eski motor kuralları: max 1-1024, violation, geçerli tekil MAC'ler)
      if (iface.portSecurity !== undefined) {
        const ps = iface.portSecurity as Record<string, unknown>
        const macs = Array.isArray(ps?.['macs']) ? (ps['macs'] as unknown[]).map((m) => (typeof m === 'string' ? normalizeMac(m) : null)) : null
        const max = ps?.['max']
        if (
          !ps || typeof ps !== 'object' || Object.keys(ps).some((k) => !PS_FIELDS.includes(k)) || typeof ps['enabled'] !== 'boolean' ||
          !Number.isInteger(max) || (max as number) < 1 || (max as number) > 1024 ||
          !['shutdown', 'restrict', 'protect'].includes(String(ps['violation'])) ||
          !macs || macs.some((m) => !m || m === '0000.0000.0000' || parseInt(m.slice(0, 2), 16) % 2 === 1) ||
          new Set(macs).size !== macs.length || macs.length > (max as number)
        ) reject(id, `${name}.portSecurity`, 'Geçersiz portSecurity yapılandırması')
        else if (ps['enabled'] && mode !== 'access') reject(id, `${name}.portSecurity`, 'Port security yalnız access portta (IOS)')
        else
          phys.portSecurity = {
            enabled: ps['enabled'] as boolean, max: max as number, violation: ps['violation'] as 'shutdown' | 'restrict' | 'protect',
            sticky: false, macs: macs as string[], stickyMacs: [],
          }
      }
      if (iface.errdisabled !== undefined) {
        if (typeof iface.errdisabled !== 'boolean') reject(id, `${name}.errdisabled`, 'errdisabled true/false olmalı')
        else if (iface.errdisabled) errdis.push(`${id}|${c}`)
      }
      cfg.ifaces[c] = phys
    }
    // AğLab'da arayüz kaydı olmayan port: access, VLAN 1 (Labber varsayılanı dynamic-auto).
    for (const c of canonPorts)
      if (!Object.keys(ifaces).some((n) => canonPort(n) === c)) {
        const phys = cfg.ifaces[c] ?? defaultPhys()
        phys.mode = 'access'
        phys.allowed = []
        cfg.ifaces[c] = phys
      }
    running[id] = cfg
  }

  // Bağlantılar
  const usedPort = new Map<string, string>()
  links.forEach((l: AglabLink, index) => {
    const tag = `links[${index}]`
    for (const key of Object.keys(l))
      if (!['a', 'portA', 'b', 'portB', 'up'].includes(key)) unsupported(tag, key, 'Labber\'da karşılığı olmayan bağlantı alanı')
    const end = (dev: string, port: string): [string, string] | null => {
      if (!ids.has(dev)) {
        reject(tag, `${dev}:${port}`, 'Bağlantı bilinmeyen cihaza gidiyor')
        return null
      }
      const map = canonByDevice[dev]
      if (!map) return null // desteklenmeyen cihaz tipi (zaten raporlandı)
      const c = map[port] ?? (port === 'eth0' ? undefined : (() => {
        const k = canonPort(port)
        return k && Object.values(map).includes(k) ? k : undefined
      })())
      if (!c) {
        reject(tag, `${dev}:${port}`, 'Bağlantı portu cihazda yok ya da eşlenemedi')
        return null
      }
      const key = `${dev}|${c}`
      if (usedPort.has(key)) {
        reject(tag, `${dev}:${port}`, 'Port birden çok bağlantıda kullanılıyor')
        return null
      }
      usedPort.set(key, tag)
      return [dev, c]
    }
    const a = end(String(l.a), String(l.portA))
    const b = end(String(l.b), String(l.portB))
    // Kablo: yalnız açık `up: false` kopuktur (eksik alan takılı sayılır).
    if (a && b) def.links.push(l.up === false ? { a, b, up: false } : { a, b })
  })

  const reasons = new Set<string>()
  for (const u of report.unsupported) reasons.add(u.reason)
  for (const r of report.rejected) reasons.add('Reddedildi: ' + r.reason)
  report.reasons = [...reasons].sort()
  report.engineDecision = report.unsupported.length || report.rejected.length ? 'legacy' : 'labber'
  return { def, running, pcs, report, ...(errdis.length ? { errdis } : {}), ...(nat.length ? { nat } : {}) }
}

/** Köprü sonucundan bir LabRuntime kurar (yapılandırma köprüden gelir, IOS betiği çalışmaz). */
export function createRuntime(result: BridgeResult): LabRuntime {
  return new LabRuntime(result.def, (rt) => {
    for (const [id, cfg] of Object.entries(result.running)) rt.running[id] = clone(cfg)
    for (const [id, pc] of Object.entries(result.pcs)) rt.pcs[id] = clone(pc)
    for (const k of result.errdis ?? []) {
      rt.errdis.add(k)
      rt.errCause.set(k, 'psecure-violation')
    }
    rt.natTable = clone(result.nat ?? [])
  })
}

export class BridgeError extends Error {}

/**
 * Labber çalışma durumunu AğLab JSON'una geri yazar. Özgün JSON'un kopyası üzerinde
 * çalışır: opak ve desteklenmeyen alanlar özgün değerleriyle kalır; desteklenen alanlar
 * Labber durumundan yazılır. Özgünde olmayıp varsayılana eşit alanlar eklenmez.
 * AğLab modelinde ifade edilemeyen bir Labber durumu açık bir BridgeError ile durur.
 */
export function toAglab(
  rt: { running: Record<string, SwitchConfig>; pcs: Record<string, PcConfig>; hw?: Hardware; def?: LabDef; errdis?: Set<string>; natTable?: NatEntry[] },
  original: AglabTopology,
): AglabTopology {
  const out = clone(original) as AglabTopology
  const portNames = toLabber(original).report.portNames
  // Kablo durumu (yalnız Labber'a giden bağlantılar; diğerleri özgün kalır)
  const canonOf = (dev: string, port: string) =>
    Object.entries(portNames[dev] ?? {}).find(([, o]) => o === port)?.[0]
  // Taşınan kablolar: Labber bağlantısı i, özgün bağlantı i'ye karşılık gelir (labber
  // kararında reddedilen bağlantı yoktur); uç değiştiyse özgün port adıyla yazılır.
  const outLinks = out.links ?? []
  if (rt.def && rt.def.links.length === outLinks.length)
    rt.def.links.forEach((dl, i) => {
      const l = outLinks[i]!
      for (const [side, end] of [['a', dl.a], ['b', dl.b]] as const) {
        const portKey = side === 'a' ? 'portA' : 'portB'
        const [dev, canon] = end
        if (String(l[side]) === dev && canonOf(dev, String(l[portKey])) === canon) continue
        const name = portNames[dev]?.[canon]
        if (!name) throw new BridgeError(`${dev}:${canon} AğLab port listesinde yok`)
        l[side] = dev
        l[portKey] = name
      }
    })
  if (rt.hw)
    for (const l of out.links ?? []) {
      const ca = canonOf(String(l.a), String(l.portA))
      const cb = canonOf(String(l.b), String(l.portB))
      if (!ca || !cb) continue
      const cut = rt.hw.cut.has(`${l.a}|${ca}`) || rt.hw.cut.has(`${l.b}|${cb}`)
      if (l.up !== undefined || cut) l.up = !cut
    }
  for (const d of out.devices) {
    const id = String(d.id)
    // Güç ve PC NIC'i
    if (rt.hw && ['PC', 'Server', 'Switch', 'Router'].includes(d.type) && portNames[id]) {
      const on = !rt.hw.off.has(id)
      if (d.enabled !== undefined || !on) d.enabled = on
      if (d.type === 'PC' || d.type === 'Server') {
        const nic = !rt.hw.nicDown.has(id)
        const eth0 = d.interfaces?.['eth0']
        if (eth0?.enabled !== undefined || !nic) {
          d.interfaces = d.interfaces ?? {}
          d.interfaces['eth0'] = { ...(eth0 ?? {}), enabled: nic }
        }
      }
    }
    if ((d.type === 'PC' || d.type === 'Server') && rt.pcs[id]) {
      const pc = rt.pcs[id]!
      const ip = pc.ip ?? ''
      if (d.ip !== undefined || ip) d.ip = ip
      if (pc.ip !== null && (d.mask !== undefined || pc.ip)) d.mask = prefixToMask(pc.prefix)
      const gw = pc.gw ?? ''
      if (d.gateway !== undefined || gw) d.gateway = gw
      // L5-b: kira (DHCP'den alınmış, link-local olmayan adres), DNS sunucusu, servisler
      const lease = !!pc.dhcp && !!pc.ip && !isApipa(pc.ip)
      if (d.dhcpLease !== undefined || lease) d.dhcpLease = lease
      const dns = pc.dns ?? ''
      if (d.dns !== undefined || dns) d.dns = dns
      if (d.type === 'Server') {
        const prev = (d.services ?? {}) as Record<string, unknown>
        const next: Record<string, unknown> = { ...prev }
        for (const k of ['dhcp', 'dns'] as const) {
          const on = !!pc.services?.[k]
          if (k in prev || on) next[k] = on
        }
        if (d.services !== undefined || Object.keys(next).length) d.services = next
      }
      continue
    }
    if (d.type === 'Router' && rt.running[id]) {
      routerToAglab(d, rt.running[id]!, portNames[id] ?? {}, original.devices.find((x) => String(x.id) === id)!, rt.natTable)
      continue
    }
    if (d.type !== 'Switch' || !rt.running[id]) continue
    const cfg = rt.running[id]!
    const fail = (what: string) => {
      throw new BridgeError(`${id}: ${what} AğLab modelinde ifade edilemiyor`)
    }
    if (cfg.hostname !== (d.name || id)) d.name = cfg.hostname
    if (cfg.pos && Object.keys(cfg.pos).length) fail('Port-channel')
    if (cfg.loopbacks && Object.keys(cfg.loopbacks).length) fail('Loopback')
    if (cfg.ospf) fail('OSPF')
    if (cfg.routes.length) fail('statik rota')
    if (cfg.ipRouting) fail('ip routing')
    if (cfg.stpMode !== 'pvst') fail('spanning-tree mode ' + cfg.stpMode)
    if (cfg.bpduguardDefault) fail('spanning-tree portfast bpduguard default')
    if (cfg.errRecoveryBpdu || cfg.errRecoveryInterval !== undefined) fail('errdisable recovery')
    if (Object.keys(cfg.dhcpPools ?? {}).length || cfg.dhcpExcluded?.length) fail('switch üzerinde DHCP sunucusu')
    const gw = cfg.defaultGateway ?? ''
    if (d.gateway !== undefined || gw) d.gateway = gw
    // VLAN'lar
    const hadOne = (original.devices.find((x) => String(x.id) === id)?.vlans ?? [1]).map(Number).includes(1)
    const vlans = Object.keys(cfg.vlans).map(Number).filter((v) => !RESERVED_VLANS.slice(1).includes(v) && (v !== 1 || hadOne)).sort(sortNum)
    if (d.vlans !== undefined || vlans.join() !== '1') d.vlans = vlans
    const names: Record<string, string> = {}
    for (const v of vlans) {
      const n = cfg.vlans[String(v)]!
      const keep = d.vlanNames !== undefined && Object.prototype.hasOwnProperty.call(d.vlanNames, String(v))
      if (keep || (n !== defaultVlanName(v) && !(v === 1 && n === 'default'))) names[String(v)] = n
    }
    if (d.vlanNames !== undefined || Object.keys(names).length) d.vlanNames = names
    // STP
    const prios: Record<string, number> = {}
    for (const [v, p] of Object.entries(cfg.stpPriority)) {
      const explicit = d.stpPriorities !== undefined && Object.prototype.hasOwnProperty.call(d.stpPriorities, v)
      if (explicit || d.stpPriority === undefined || p !== d.stpPriority) prios[v] = p
    }
    if (d.stpPriorities !== undefined || Object.keys(prios).length) d.stpPriorities = prios
    // Arayüzler
    const back = portNames[id] ?? {}
    d.interfaces = d.interfaces ?? {}
    for (const [canon, phys] of Object.entries(cfg.ifaces)) {
      const name = back[canon]
      if (!name) continue
      if (phys.mode !== 'access' && phys.mode !== 'trunk') fail(`${canon} modu ${phys.mode}`)
      if (phys.channel) fail(`${canon} channel-group`)
      if (phys.routed) fail(`${canon} routed port`)
      if (phys.allowed === null) fail(`${canon} "allowed vlan all"`)
      if (phys.portfast) fail(`${canon} portfast`)
      if (phys.nonegotiate) fail(`${canon} nonegotiate`)
      if (phys.description) fail(`${canon} description`)
      if (phys.bpduguard !== undefined) fail(`${canon} bpduguard`)
      if (phys.portSecurity?.sticky || phys.portSecurity?.stickyMacs.length) fail(`${canon} port-security mac-address sticky`)
      if (phys.l3 || phys.ip) fail(`${canon} L3 ayarı`)
      const prev = d.interfaces[name]
      const def = defaultPhys()
      const iface: AglabInterface = prev ? { ...prev } : {}
      const put = (key: keyof AglabInterface, value: unknown, dflt: unknown) => {
        if (prev && key in prev) iface[key] = value
        else if (JSON.stringify(value) !== JSON.stringify(dflt)) iface[key] = value
      }
      put('mode', phys.mode, 'access')
      put('vlan', phys.accessVlan, def.accessVlan)
      put('allowed', phys.allowed, [])
      put('nativeVlan', phys.nativeVlan, def.nativeVlan)
      put('enabled', !phys.shutdown, true)
      // L5-e: yapılandırılmış güvenli MAC'ler (dinamik öğrenilenler yazılmaz; IOS gibi kalıcı değil)
      const ps = phys.portSecurity
      if (ps) {
        const old = (prev?.['portSecurity'] ?? {}) as { macs?: string[] }
        const macs = ps.macs.map((m) => old.macs?.find((x) => normalizeMac(x) === m) ?? colonMac(m))
        iface['portSecurity'] = { enabled: ps.enabled, max: ps.max, violation: ps.violation, macs }
      } else if (prev && 'portSecurity' in prev) delete iface['portSecurity']
      if (rt.errdis) {
        const on = rt.errdis.has(`${id}|${canon}`)
        if ((prev && 'errdisabled' in prev) || on) iface['errdisabled'] = on
      }
      if (prev || Object.keys(iface).length) d.interfaces[name] = iface
    }
    for (const [v, svi] of Object.entries(cfg.svis)) {
      const name = 'vlan' + v
      if (svi.description) fail(`Vlan${v} description`)
      if (svi.l3) fail(`Vlan${v} L3/OSPF ayarı`)
      const prev = d.interfaces[name]
      if (!prev && !svi.ip && JSON.stringify(svi) === JSON.stringify(defaultSvi(Number(v)))) continue
      const iface: AglabInterface = prev ? { ...prev } : { vlan: Number(v) }
      if (svi.ip) {
        iface.ip = svi.ip.addr
        iface.mask = svi.ip.mask
      } else {
        if (prev?.ip !== undefined) iface.ip = ''
        if (prev?.mask !== undefined) iface.mask = ''
      }
      if (prev?.enabled !== undefined || svi.shutdown) iface.enabled = !svi.shutdown
      d.interfaces[name] = iface
    }
  }
  return out
}

/**
 * Router çalışma durumunu AğLab Router alanlarına yazar (L4): ad, arayüz IP/maske/açık,
 * `staticRoutes` (distance ile), eski `route` alanı ve OSPF (pid, routerId, networks).
 * AğLab modelinde olmayan durum (loopback, açıklama, arayüz OSPF ayarı, passive-interface,
 * `no ip routing` …) BridgeError'dur.
 */
function routerToAglab(d: AglabDevice, cfg: SwitchConfig, back: Record<string, string>, orig: AglabDevice, natTable?: NatEntry[]) {
  const id = String(d.id)
  const fail = (what: string) => {
    throw new BridgeError(`${id}: ${what} AğLab modelinde ifade edilemiyor`)
  }
  if (cfg.hostname !== (d.name || id)) d.name = cfg.hostname
  if (cfg.loopbacks && Object.keys(cfg.loopbacks).length) fail('Loopback')
  if (!cfg.ipRouting) fail('no ip routing')
  if (cfg.defaultGateway) fail('ip default-gateway')
  // L5-c: ACL'ler (özgünde alan varsa ya da liste tanımlıysa yazılır)
  {
    const rules = aclsBack(cfg, orig, fail)
    const prevRules = JSON.stringify(orig.acls ?? null)
    const same = JSON.stringify(rules.map((r) => ({ ...r }))) === prevRules
    if (!same && (d.acls !== undefined || rules.length)) d.acls = rules
  }
  d.interfaces = d.interfaces ?? {}
  for (const [canon, phys] of Object.entries(cfg.ifaces)) {
    const name = back[canon]
    if (!name) continue
    if (phys.description) fail(`${canon} description`)
    const helper = helperBack(phys.l3, canon, fail)
    const prev = d.interfaces[name]
    if (!prev && !phys.ip && !phys.shutdown && !helper && !phys.l3?.aclIn && !phys.l3?.aclOut && !phys.l3?.nat) continue
    const iface: AglabInterface = prev ? { ...prev } : {}
    if (phys.ip) {
      iface.ip = phys.ip.addr
      iface.mask = phys.ip.mask
    } else if (prev?.ip !== undefined) iface.ip = ''
    if (prev?.enabled !== undefined || phys.shutdown) iface.enabled = !phys.shutdown
    if (helper) iface['helperAddress'] = helper
    else if (iface['helperAddress'] !== '') delete iface['helperAddress']
    groupsBack(iface, phys.l3)
    natRoleBack(iface, phys.l3)
    d.interfaces[name] = iface
  }
  // L5-a: alt arayüzler. AğLab adı: fiziksel portun AğLab yazımı + '.N'. Native alt arayüz,
  // açıklama ve arayüz OSPF ayarı AğLab modelinde yok → BridgeError.
  const subNames = new Set<string>()
  for (const [canon, si] of Object.entries(cfg.subifs ?? {})) {
    const physName = back[si.parent]
    if (!physName) fail(`${canon} fiziksel portu`)
    const name = physName + canon.slice(canon.indexOf('.'))
    subNames.add(name)
    if (si.native) fail(`${canon} encapsulation dot1Q ${si.vlan} native`)
    if (si.description) fail(`${canon} description`)
    const helper = helperBack(si.l3, canon, fail)
    const prev = d.interfaces[name]
    const iface: AglabInterface = prev ? { ...prev } : { ip: '', mask: '255.255.255.0', enabled: true, vlan: 1, encapsulation: '', parent: physName }
    // yalnız özgünde olan ya da varsayılandan farklı alanlar yazılır (gidiş-dönüş birebir)
    if (si.ip || 'ip' in iface) iface.ip = si.ip?.addr ?? ''
    if (si.ip) iface.mask = si.ip.mask
    if (si.shutdown || 'enabled' in iface) iface.enabled = !si.shutdown
    if (si.vlan === null) {
      if ('encapsulation' in iface) iface.encapsulation = ''
    } else {
      iface.encapsulation = 'dot1q'
      iface.vlan = si.vlan
    }
    if (prev?.parent !== undefined || !prev) iface.parent = physName
    if (helper) iface['helperAddress'] = helper
    else if (iface['helperAddress'] !== '') delete iface['helperAddress']
    groupsBack(iface, si.l3)
    natRoleBack(iface, si.l3)
    d.interfaces[name] = iface
  }
  // CLI ile silinen alt arayüz (`no interface Gi0/0.N`) AğLab görünümünden de çıkar
  for (const name of Object.keys(d.interfaces)) if (name.includes('.') && !subNames.has(name)) delete d.interfaces[name]
  natBack(d, cfg, back, orig, natTable ?? [], fail)
  // L5-b: DHCP sunucusu. Özgün havuz nesnesi aynı kaldıysa olduğu gibi yazılır.
  const pools = Object.entries(cfg.dhcpPools ?? {}).map(([name, p]) => {
    const next: Record<string, unknown> = { name, network: p.net?.addr ?? '', mask: p.net?.mask ?? '' }
    if (p.defaultRouter) next['defaultRouter'] = p.defaultRouter
    if (p.dns) next['dnsServer'] = p.dns
    const kept = ((orig.dhcpPools ?? []) as Record<string, unknown>[]).find(
      (a) => a['name'] === name && (a['network'] ?? '') === next['network'] && (a['mask'] ?? '') === next['mask'] &&
        (a['defaultRouter'] ?? '') === (p.defaultRouter ?? '') && (a['dnsServer'] ?? '') === (p.dns ?? ''),
    )
    return kept ? clone(kept) : next
  })
  if (d.dhcpPools !== undefined || pools.length) d.dhcpPools = pools
  const excluded = (cfg.dhcpExcluded ?? []).map((r) => {
    const kept = ((orig.dhcpExcluded ?? []) as Record<string, unknown>[]).find((a) => a['start'] === r.lo && String(a['end'] ?? a['start']) === r.hi)
    return kept ? clone(kept) : { start: r.lo, end: r.hi }
  })
  if (d.dhcpExcluded !== undefined || excluded.length) d.dhcpExcluded = excluded
  // Eski `route` alanı: köprü onu (listede varsayılan rota yoksa) AD 1 varsayılan rota yaptı.
  const legacyDefault =
    typeof orig.route === 'string' && orig.route !== '' &&
    !(orig.staticRoutes ?? []).some((r) => r.network === '0.0.0.0' && r.mask === '0.0.0.0')
  let routes: StaticRoute[] = cfg.routes
  if (legacyDefault) {
    const i = routes.findIndex((r) => r.net === '0.0.0.0' && r.mask === '0.0.0.0' && r.nh === orig.route && (r.ad ?? 1) === 1)
    if (i >= 0) routes = routes.filter((_, j) => j !== i)
    else d.route = ''
  }
  // Özgün rota nesnesi aynı kaldıysa olduğu gibi (distance alanı yoksa yine yok) yazılır.
  const same = (a: AglabStaticRoute, r: StaticRoute) =>
    a.network === r.net && a.mask === r.mask && a.nextHop === r.nh && Number(a.distance ?? 1) === (r.ad ?? 1)
  const list = routes.map((r) => {
    const kept = (orig.staticRoutes ?? []).find((a) => same(a, r))
    return kept ? clone(kept) : { network: r.net, mask: r.mask, nextHop: r.nh, distance: r.ad ?? 1 }
  })
  if (d.staticRoutes !== undefined || list.length) d.staticRoutes = list
  // OSPF
  const o = cfg.ospf
  if (!o) {
    if (d.ospf !== undefined && d.ospf !== null) delete d.ospf
    return
  }
  if (o.passiveDefault || o.passive.length) fail('passive-interface')
  if (o.refBw !== 100) fail('auto-cost reference-bandwidth')
  if (o.defaultOriginate) fail('default-information originate')
  if (Object.keys(o.stubs).length) fail('stub area')
  const prev = (orig.ospf ?? {}) as Record<string, unknown>
  const ospf: Record<string, unknown> = { ...prev, pid: o.pid }
  if (o.routerId || prev['routerId'] !== undefined) ospf['routerId'] = o.routerId ?? ''
  ospf['networks'] = o.networks.map((n) => ({ network: n.addr, wildcard: n.wildcard, area: n.area }))
  d.ospf = ospf
}

/**
 * L5-b: arayüz L3 ayarlarından AğLab `helperAddress` değeri. AğLab modeli arayüz başına tek
 * helper tutar; birden çok helper ve diğer L3/OSPF ayarları ifade edilemez.
 */
function helperBack(l3: L3Opts | undefined, canon: string, fail: (what: string) => never): string | null {
  if (!l3) return null
  const { helpers, aclIn: _in, aclOut: _out, nat: _nat, ...rest } = l3
  if (Object.keys(rest).length) fail(`${canon} arayüz OSPF/L3 ayarı`)
  if (helpers && helpers.length > 1) fail(`${canon} üzerinde birden çok ip helper-address`)
  return helpers?.[0] ?? null
}

/** L5-d: `ip nat inside|outside` → AğLab `natRole` (kaldırılınca alan silinir). */
function natRoleBack(iface: AglabInterface, l3: L3Opts | undefined) {
  if (l3?.nat) iface['natRole'] = l3.nat
  else if (iface['natRole'] !== '') delete iface['natRole']
}

/**
 * L5-d: NAT → AğLab `natOverload` ve `natTranslations`. AğLab modeli yalnız tek bir
 * "ACL + outside arayüzü + overload" eşlemesini tutar; statik NAT, havuz, overload'suz ya da
 * birden çok eşleme BridgeError'dur. Çeviri girdisinin port numarası AğLab modelinde yok:
 * girdiler eski motorun anahtarıyla (kaynak|hedef|protokol) tekilleştirilerek yazılır.
 */
function natBack(d: AglabDevice, cfg: SwitchConfig, back: Record<string, string>, orig: AglabDevice, table: NatEntry[], fail: (what: string) => never) {
  const n = cfg.nat
  if (n?.statics.length) fail('Statik NAT (ip nat inside source static)')
  if (n && Object.keys(n.pools).length) fail('NAT havuzu (ip nat pool)')
  const rules = n?.rules ?? []
  if (rules.length > 1) fail('Birden çok dinamik NAT eşlemesi')
  const r = rules[0]
  if (r && (!r.iface || !r.overload)) fail(`NAT eşlemesi (${r.iface ? 'overload olmadan' : 'havuzla'})`)
  if (r) {
    const dot = r.iface!.indexOf('.')
    const name = dot < 0 ? back[r.iface!] : back[r.iface!.slice(0, dot)] && back[r.iface!.slice(0, dot)] + r.iface!.slice(dot)
    if (!name) fail(`NAT outside arayüzü ${r.iface}`)
    const prev = orig.natOverload as Record<string, unknown> | undefined
    const aclId = prev && String(prev['aclId']) === r.acl ? prev['aclId'] : r.acl
    d.natOverload = { aclId, outsideInterface: name }
  } else if (d.natOverload !== undefined) delete d.natOverload
  const id = String(d.id)
  const entries: Record<string, unknown>[] = []
  for (const e of table) {
    if (e.dev !== id || e.proto === null || !e.outsideLocal) continue
    const key = [e.insideLocal, e.outsideLocal, e.proto].join('|')
    if (entries.some((x) => x['key'] === key)) continue
    entries.push({ key, protocol: e.proto, insideLocal: e.insideLocal, insideGlobal: e.insideGlobal, outsideLocal: e.outsideLocal })
  }
  if (JSON.stringify(entries) === JSON.stringify(orig.natTranslations ?? [])) return
  if (d.natTranslations !== undefined || entries.length) d.natTranslations = entries
}

/** L5-c: `ip access-group` → AğLab `aclIn` / `aclOut` (kaldırılınca alan silinir). */
function groupsBack(iface: AglabInterface, l3: L3Opts | undefined) {
  for (const k of ['aclIn', 'aclOut'] as const) {
    if (l3?.[k]) iface[k] = l3[k]
    else if (iface[k] !== '') delete iface[k]
  }
}

/**
 * L5-c: Labber listeleri → eski motor kuralları (listeler özgün sırasıyla, yeniler sonda).
 * Sıra numaraları AğLab'da tutulmaz (sıra korunur). Kaynak portu, eq dışı port işleci ve ICMP
 * türü AğLab modelinde yok → BridgeError. Boş liste yazılmaz (IOS'ta da her şeye izin verir).
 */
function aclsBack(cfg: SwitchConfig, orig: AglabDevice, fail: (what: string) => never): Record<string, unknown>[] {
  const lists = cfg.acls ?? {}
  const origOrder = [...new Set(((orig.acls as Record<string, unknown>[] | undefined) ?? []).map((r) => String(r['id'])))]
  // kimliğin AğLab'daki türü ("1" ya da 1) korunur; yeni numaralı liste sayı olarak yazılır
  const origId = (n: string) => ((orig.acls as Record<string, unknown>[] | undefined) ?? []).find((r) => String(r['id']) === n)?.['id'] ?? (aclKind(n) ? Number(n) : n)
  const names = [...origOrder.filter((n) => lists[n]), ...Object.keys(lists).filter((n) => !origOrder.includes(n))]
  const out: Record<string, unknown>[] = []
  const side = (a: AclAddr, pre: 'src' | 'dst') => {
    if (a.wild === '255.255.255.255') return { [pre + 'Type']: 'any', [pre]: '' }
    if (a.wild === '0.0.0.0') return { [pre + 'Type']: 'host', [pre]: a.addr }
    return { [pre + 'Type']: 'network', [pre]: a.addr, [pre === 'src' ? 'wildcard' : 'dstWildcard']: a.wild }
  }
  for (const n of names) {
    for (const e of lists[n]!.entries) {
      if (e.srcPort) fail(`ACL ${n} ${e.seq} kaynak portu`)
      if (e.dstPort && e.dstPort.op !== 'eq') fail(`ACL ${n} ${e.seq} port işleci ${e.dstPort.op}`)
      if (e.icmpType) fail(`ACL ${n} ${e.seq} ICMP türü`)
      out.push({
        id: origId(n), action: e.action, protocol: e.proto, ...side(e.src, 'src'),
        ...side(e.dst ?? { addr: '0.0.0.0', wild: '255.255.255.255' }, 'dst'),
        ...(e.dstPort ? { port: e.dstPort.a } : {}),
      })
    }
  }
  return out
}

/** IPv4 → tam sayı (yardımcı; testlerde kullanılır). */
export { ipToInt }
