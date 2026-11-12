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
import type { Hardware, LabDef, OspfConfig, PcConfig, PcDef, StaticRoute, SubIfConfig, SwitchConfig, SwitchDef } from '../sim/types'
import { canonIf, clone, ipToInt, isIp, maskToPrefix, networkOf, ports as expandPorts, prefixToMask } from '../sim/util'
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
// L5-b: `dhcpLease` = adres DHCP'den alındı (PcConfig.dhcp)
const PC_FIELDS = new Set(['enabled', 'ports', 'interfaces', 'ip', 'mask', 'gateway', 'mac', 'vlan', 'dhcpLease'])
const SWITCH_FIELDS = new Set([
  'enabled', 'ports', 'interfaces', 'gateway', 'vlans', 'vlanNames', 'stpPriority', 'stpPriorities', 'ip', 'mask',
])
// L4: Router. `ip`/`mask`/`gateway` cihaz düzeyinde yalnız boş olabilir; `vlan` router için
// anlamsızdır (PKT dönüştürücüsü 1 yazar) ve opak geçer.
const ROUTER_FIELDS = new Set(['enabled', 'ports', 'interfaces', 'staticRoutes', 'route', 'ospf', 'ip', 'mask', 'gateway', 'vlan'])
const ROUTER_IF_FIELDS = new Set(['ip', 'mask', 'enabled', 'helperAddress'])
// L5-a: router alt arayüzü (`g0/0.10`). Eski CLI yeni alt arayüzü `encapsulation: ''`, `vlan: 1`
// ile kurar: boş encapsulation "henüz yapılandırılmadı" demektir (eski motorda da etkin değil).
const SUBIF_FIELDS = new Set(['ip', 'mask', 'enabled', 'parent', 'vlan', 'encapsulation', 'helperAddress'])
const STATIC_ROUTE_FIELDS = new Set(['network', 'mask', 'nextHop', 'distance'])
const OSPF_FIELDS = new Set(['pid', 'routerId', 'networks'])
// Server, servisi yoksa PC gibi bir uçtur (L4); servisler L5.
const SERVER_FIELDS = new Set([...PC_FIELDS, 'services'])
const PHYS_FIELDS = new Set(['mode', 'vlan', 'allowed', 'nativeVlan', 'enabled'])
const SVI_FIELDS = new Set(['ip', 'mask', 'enabled', 'vlan'])

const FEATURE_REASON: Record<string, string> = {
  staticRoutes: 'Switch üzerinde statik rota AğLab modelinde yok',
  route: 'Switch üzerinde varsayılan rota AğLab modelinde yok',
  acls: 'ACL Labber\'da yok (L5)',
  natOverload: 'NAT Labber\'da yok (L5)',
  natTranslations: 'NAT çeviri tablosu Labber\'da yok (L5)',
  ospf: 'Switch üzerinde OSPF AğLab modelinde yok',
  bgp: 'BGP Labber\'da yok (L5)',
  services: 'Sunucu DNS/HTTP servisleri Labber\'da yok (L5)',
  startupConfig: 'Kaydedilmiş startup-config köprüde henüz eşlenmiyor (L7)',
  portSecurity: 'Port security Labber\'da yok (L5)',
  errdisabled: 'Port security err-disable durumu Labber\'da yok (L5)',
  encapsulation: 'Alt arayüz alanı (encapsulation) yalnız router alt arayüzünde (g0/0.N) eşlenir',
  parent: 'Alt arayüz alanı (parent) yalnız router alt arayüzünde (g0/0.N) eşlenir',
  aclIn: 'ACL Labber\'da yok (L5)',
  aclOut: 'ACL Labber\'da yok (L5)',
  natRole: 'NAT Labber\'da yok (L5)',
  helperAddress: 'DHCP relay Labber\'da yok (L5)',
  dhcpLease: 'DHCP istemci kirası Labber\'da yok (L5)',
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

  /** L5-b: `helperAddress` (ip helper-address); geçersiz adres reddedilir. */
  const helperOf = (id: string, name: string, iface: AglabInterface): string | null => {
    const h = iface['helperAddress']
    if (h === undefined || h === '') return null
    if (typeof h !== 'string' || !isIp(h)) {
      reject(id, `${name}.helperAddress`, 'Geçersiz ip helper-address')
      return null
    }
    return h
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
      const helper = helperOf(id, name, iface)
      if (helper) phys.helper = helper
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
      const helper = helperOf(id, name, iface)
      subs[key] = { parent, vlan, native: false, shutdown: iface.enabled === false, description: '', ip, ...(helper ? { helper } : {}) }
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
      // Sunucu PC gibi bir uçtur; DHCP servisi L5-b'den beri Labber'da (PcDef.dhcpServer),
      // DNS/HTTP L5'in kalanına kadar eski motorda.
      const services = d.services
      if (services !== undefined && (typeof services !== 'object' || services === null || Array.isArray(services)))
        reject(id, 'services', 'Servis listesi nesne olmalı')
      else
        for (const [name, on] of Object.entries(services ?? {}))
          if (on && name !== 'dhcp') unsupported(id, `services.${name}`, FEATURE_REASON['services']!)
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
      if (d.dhcpLease !== undefined && typeof d.dhcpLease !== 'boolean') reject(id, 'dhcpLease', 'dhcpLease true/false olmalı')
      pcs[id] = {
        ip: ip && isIp(ip) && prefix !== null ? ip : null,
        prefix: prefix ?? 24,
        gw: d.gateway && isIp(d.gateway) ? d.gateway : null,
        ...(d.dhcpLease === true ? { dhcp: true } : {}),
      }
      const mac = resolveMac ? intToDotted(macToInt(resolveMac(d))) : '0000.0000.0000'
      claimMac(id, mac)
      const pc: PcDef = {
        id, kind: 'pc', mac, x: Number(d.x ?? 0), y: Number(d.y ?? 0),
        ...(off ? { off: true } : {}),
        ...(d.interfaces?.['eth0']?.enabled === false ? { nicDown: true } : {}),
        ...(d.type === 'Server' && (d.services as Record<string, unknown> | undefined)?.['dhcp'] ? { dhcpServer: true } : {}),
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
  return { def, running, pcs, report }
}

/** Köprü sonucundan bir LabRuntime kurar (yapılandırma köprüden gelir, IOS betiği çalışmaz). */
export function createRuntime(result: BridgeResult): LabRuntime {
  return new LabRuntime(result.def, (rt) => {
    for (const [id, cfg] of Object.entries(result.running)) rt.running[id] = clone(cfg)
    for (const [id, pc] of Object.entries(result.pcs)) rt.pcs[id] = clone(pc)
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
  rt: { running: Record<string, SwitchConfig>; pcs: Record<string, PcConfig>; hw?: Hardware; def?: LabDef },
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
      if (d.dhcpLease !== undefined || pc.dhcp) d.dhcpLease = !!pc.dhcp
      continue
    }
    if (d.type === 'Router' && rt.running[id]) {
      routerToAglab(d, rt.running[id]!, portNames[id] ?? {}, original.devices.find((x) => String(x.id) === id)!)
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
function routerToAglab(d: AglabDevice, cfg: SwitchConfig, back: Record<string, string>, orig: AglabDevice) {
  const id = String(d.id)
  const fail = (what: string) => {
    throw new BridgeError(`${id}: ${what} AğLab modelinde ifade edilemiyor`)
  }
  if (cfg.hostname !== (d.name || id)) d.name = cfg.hostname
  if (cfg.loopbacks && Object.keys(cfg.loopbacks).length) fail('Loopback')
  if (!cfg.ipRouting) fail('no ip routing')
  if (cfg.defaultGateway) fail('ip default-gateway')
  d.interfaces = d.interfaces ?? {}
  for (const [canon, phys] of Object.entries(cfg.ifaces)) {
    const name = back[canon]
    if (!name) continue
    if (phys.description) fail(`${canon} description`)
    if (phys.l3 && Object.keys(phys.l3).length) fail(`${canon} arayüz OSPF/L3 ayarı`)
    const prev = d.interfaces[name]
    if (!prev && !phys.ip && !phys.shutdown && !phys.helper) continue
    const iface: AglabInterface = prev ? { ...prev } : {}
    if (phys.ip) {
      iface.ip = phys.ip.addr
      iface.mask = phys.ip.mask
    } else if (prev?.ip !== undefined) iface.ip = ''
    if (prev?.enabled !== undefined || phys.shutdown) iface.enabled = !phys.shutdown
    // L5-b: eski CLI `no ip helper-address` alanı siler
    if (phys.helper) iface['helperAddress'] = phys.helper
    else delete iface['helperAddress']
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
    if (si.l3 && Object.keys(si.l3).length) fail(`${canon} arayüz OSPF/L3 ayarı`)
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
    if (si.helper) iface['helperAddress'] = si.helper
    else delete iface['helperAddress']
    d.interfaces[name] = iface
  }
  // CLI ile silinen alt arayüz (`no interface Gi0/0.N`) AğLab görünümünden de çıkar
  for (const name of Object.keys(d.interfaces)) if (name.includes('.') && !subNames.has(name)) delete d.interfaces[name]
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

/** IPv4 → tam sayı (yardımcı; testlerde kullanılır). */
export { ipToInt }
