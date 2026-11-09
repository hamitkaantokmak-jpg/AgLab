import type { LabDef } from '../sim/types'
import type { LabQuery } from '../sim/query'
import { ports } from '../sim/util'

const SW = ['SW1', 'SW2', 'SW3']
const TRUNKS: [string, string, string, string][] = [
  ['SW1', 'Gi0/1', 'SW2', 'Gi0/1'],
  ['SW1', 'Gi0/3', 'SW3', 'Gi0/1'],
  ['SW2', 'Gi0/3', 'SW3', 'Gi0/2'],
]

const pingBoth = (q: LabQuery, a: string, b: string) => {
  const ab = q.ping(a, q.pcIp(b) ?? '0.0.0.0')
  const ba = q.ping(b, q.pcIp(a) ?? '0.0.0.0')
  return ab.ok && ba.ok
}

const lab: LabDef = {
  id: 'kampus-vlan-trunk-stp',
  title: 'Kampüs ağı: VLAN, Trunk, STP, EtherChannel',
  summary: 'Üç switch ve dört PC ile VLAN, trunk, native VLAN, LACP, root bridge ve VLAN\'lar arası yönlendirme kur.',
  level: 'Orta',
  tags: ['VLAN', 'Trunk', 'STP', 'EtherChannel', 'SVI'],
  brief: [
    'SW1 çekirdek (L3, Catalyst 3560), SW2 ve SW3 erişim switch\'leri. PC\'lerin IP adresleri hazır; sen yalnızca switch\'leri yapılandırırsın.',
    'VLAN 10 adı SATIS, VLAN 20 adı MUHASEBE, VLAN 99 adı NATIVE olsun. PC1 ve PC2 VLAN 10\'da, PC3 ve PC4 VLAN 20\'de.',
    'Switch\'ler arası tüm linkler trunk olsun, native VLAN 99 kullansın ve yalnızca 10, 20, 99 taşınsın. SW1–SW2 arasındaki iki link LACP ile Port-channel 1 olsun.',
    'SW1 VLAN 10 ve 20 için root bridge olsun. SW1 VLAN\'lar arası yönlendirme yapsın: Vlan10 = 192.168.10.1/24, Vlan20 = 192.168.20.1/24.',
    'Not: SW1 bir 3560 olduğu için trunk öncesi "switchport trunk encapsulation dot1q" gerekir. VLAN\'ı oluşturmadan porta atarsan port "inactive" kalır.',
  ],
  view: { w: 900, h: 520 },
  devices: [
    { id: 'SW1', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0010.0300', ports: ports('Fa0/1-4', 'Gi0/1-4'), l3: true, needsEncap: true, x: 450, y: 80 },
    { id: 'SW2', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0010.0101', ports: ports('Fa0/1-4', 'Gi0/1-4'), x: 210, y: 270 },
    { id: 'SW3', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0010.0202', ports: ports('Fa0/1-4', 'Gi0/1-4'), x: 690, y: 270 },
    { id: 'PC1', kind: 'pc', mac: '0050.7966.6801', x: 100, y: 450 },
    { id: 'PC3', kind: 'pc', mac: '0050.7966.6803', x: 320, y: 450 },
    { id: 'PC2', kind: 'pc', mac: '0050.7966.6802', x: 580, y: 450 },
    { id: 'PC4', kind: 'pc', mac: '0050.7966.6804', x: 800, y: 450 },
  ],
  links: [
    { a: ['SW1', 'GigabitEthernet0/1'], b: ['SW2', 'GigabitEthernet0/1'] },
    { a: ['SW1', 'GigabitEthernet0/2'], b: ['SW2', 'GigabitEthernet0/2'] },
    { a: ['SW1', 'GigabitEthernet0/3'], b: ['SW3', 'GigabitEthernet0/1'] },
    { a: ['SW2', 'GigabitEthernet0/3'], b: ['SW3', 'GigabitEthernet0/2'] },
    { a: ['PC1', 'eth0'], b: ['SW2', 'FastEthernet0/1'] },
    { a: ['PC3', 'eth0'], b: ['SW2', 'FastEthernet0/2'] },
    { a: ['PC2', 'eth0'], b: ['SW3', 'FastEthernet0/1'] },
    { a: ['PC4', 'eth0'], b: ['SW3', 'FastEthernet0/2'] },
  ],
  initialPcs: {
    PC1: { ip: '192.168.10.11', prefix: 24, gw: '192.168.10.1' },
    PC2: { ip: '192.168.10.12', prefix: 24, gw: '192.168.10.1' },
    PC3: { ip: '192.168.20.11', prefix: 24, gw: '192.168.20.1' },
    PC4: { ip: '192.168.20.12', prefix: 24, gw: '192.168.20.1' },
  },
  objectives: [
    {
      id: 'vlans',
      title: 'VLAN 10 (SATIS), 20 (MUHASEBE), 99 (NATIVE) üç switch\'te tanımlı',
      hint: 'Her switch\'te: vlan 10 → name SATIS, vlan 20 → name MUHASEBE, vlan 99 → name NATIVE. Kontrol: show vlan brief',
      check: (q) => {
        const want: [number, string][] = [[10, 'SATIS'], [20, 'MUHASEBE'], [99, 'NATIVE']]
        const missing = SW.flatMap((s) => want.filter(([v, n]) => q.vlanName(s, v) !== n).map(([v]) => `${s}:${v}`))
        return { ok: !missing.length, detail: missing.length ? 'Eksik/yanlış: ' + missing.join(', ') : undefined }
      },
    },
    {
      id: 'access',
      title: 'PC1/PC2 VLAN 10\'da, PC3/PC4 VLAN 20\'de',
      hint: 'PC portlarında: switchport mode access + switchport access vlan N. Kontrol: show interfaces status',
      check: (q) => {
        const want: Record<string, number> = { PC1: 10, PC2: 10, PC3: 20, PC4: 20 }
        const bad = Object.entries(want).filter(([pc, v]) => q.pcVlan(pc) !== v)
        return { ok: !bad.length, detail: bad.length ? bad.map(([pc]) => `${pc}: ${q.pcVlan(pc) ?? 'bağlı değil'}`).join(', ') : undefined }
      },
    },
    {
      id: 'trunks',
      title: 'Switch\'ler arası linkler trunk; yalnızca 10, 20, 99 taşınıyor',
      hint: 'switchport mode trunk + switchport trunk allowed vlan 10,20,99 (SW1\'de önce encapsulation dot1q). Kontrol: show interfaces trunk',
      check: (q) => {
        const bad: string[] = []
        for (const [a, ap, b, bp] of TRUNKS) {
          for (const [d, p] of [[a, ap], [b, bp]] as const) {
            const lp = q.port(d, p)
            const allowedOk = !!lp && lp.cfg.allowed !== null && [...lp.cfg.allowed].sort((x, y) => x - y).join(',') === '10,20,99'
            if (![10, 20, 99].every((v) => q.trunkAllows(d, p, v)) || !allowedOk) bad.push(`${d} ${p}`)
          }
        }
        return { ok: !bad.length, detail: bad.length ? 'Sorunlu: ' + bad.join(', ') : undefined }
      },
    },
    {
      id: 'native',
      title: 'Tüm trunk\'larda native VLAN 99, uyuşmazlık yok',
      hint: 'switchport trunk native vlan 99 (Po1 üzerinde de). Uyuşmazlık syslog\'da CDP-4-NATIVE_VLAN_MISMATCH olarak görünür.',
      check: (q) => {
        const trunks = q.trunks()
        if (!trunks.length) return { ok: false, detail: 'Henüz kurulu trunk yok' }
        const bad = trunks.filter((t) => t.cfg.nativeVlan !== 99).map((t) => `${t.dev} ${t.name}`)
        const mm = q.nativeMismatches().length
        return { ok: !bad.length && !mm && q.vlanExists('SW1', 99), detail: bad.length ? 'Native ≠ 99: ' + bad.join(', ') : mm ? 'Native VLAN uyuşmazlığı var' : undefined }
      },
    },
    {
      id: 'po1',
      title: 'SW1–SW2 arasında LACP Port-channel 1 kurulu (2 üye)',
      hint: 'İki uçta da: interface range gi0/1 - 2 → channel-group 1 mode active (veya bir uç passive). Kontrol: show etherchannel summary',
      check: (q) => {
        const a = q.etherchannel('SW1', 1)
        const b = q.etherchannel('SW2', 1)
        const ok = !!a && !!b && a.up && b.up && a.protocol === 'LACP' && a.bundled === 2 && b.bundled === 2
        return { ok, detail: !ok && a && b ? `SW1 Po1: ${a.bundled} üye, SW2 Po1: ${b.bundled} üye` : undefined }
      },
    },
    {
      id: 'root',
      title: 'SW1, VLAN 10 ve 20 için root bridge',
      hint: 'SW1: spanning-tree vlan 10,20 priority 4096 (veya root primary). Varsayılan root, MAC adresi en düşük olan SW2.',
      check: (q) => {
        const r10 = q.stpRoot(10)
        const r20 = q.stpRoot(20)
        return { ok: r10 === 'SW1' && r20 === 'SW1', detail: `VLAN 10 root: ${r10 ?? '-'}, VLAN 20 root: ${r20 ?? '-'}` }
      },
    },
    {
      id: 'ping10',
      title: 'PC1 ↔ PC2 ping (VLAN 10)',
      hint: 'PC1 konsolunda: ping 192.168.10.12',
      check: (q) => q.pcVlan('PC1') === 10 && q.pcVlan('PC2') === 10 && pingBoth(q, 'PC1', 'PC2'),
    },
    {
      id: 'ping20',
      title: 'PC3 ↔ PC4 ping (VLAN 20)',
      hint: 'PC3 konsolunda: ping 192.168.20.12',
      check: (q) => q.pcVlan('PC3') === 20 && q.pcVlan('PC4') === 20 && pingBoth(q, 'PC3', 'PC4'),
    },
    {
      id: 'intervlan',
      title: 'VLAN\'lar arası: PC1 ↔ PC4 ve PC3 ↔ PC2 ping',
      hint: 'SW1: ip routing, interface vlan 10/20 + ip address. Kontrol: show ip route, show ip interface brief',
      check: (q) => q.pcVlan('PC1') === 10 && q.pcVlan('PC4') === 20 && pingBoth(q, 'PC1', 'PC4') && pingBoth(q, 'PC3', 'PC2'),
    },
  ],
  solution: {
    SW1: `configure terminal
vlan 10
 name SATIS
vlan 20
 name MUHASEBE
vlan 99
 name NATIVE
exit
interface range gi0/1 - 2
 switchport trunk encapsulation dot1q
 switchport mode trunk
 switchport trunk native vlan 99
 switchport trunk allowed vlan 10,20,99
 channel-group 1 mode active
exit
interface gi0/3
 switchport trunk encapsulation dot1q
 switchport mode trunk
 switchport trunk native vlan 99
 switchport trunk allowed vlan 10,20,99
exit
spanning-tree vlan 10,20 priority 4096
ip routing
interface vlan 10
 ip address 192.168.10.1 255.255.255.0
 no shutdown
interface vlan 20
 ip address 192.168.20.1 255.255.255.0
 no shutdown
end
write memory`,
    SW2: `configure terminal
vlan 10
 name SATIS
vlan 20
 name MUHASEBE
vlan 99
 name NATIVE
exit
interface fa0/1
 switchport mode access
 switchport access vlan 10
interface fa0/2
 switchport mode access
 switchport access vlan 20
interface range gi0/1 - 2
 switchport mode trunk
 switchport trunk native vlan 99
 switchport trunk allowed vlan 10,20,99
 channel-group 1 mode active
interface gi0/3
 switchport mode trunk
 switchport trunk native vlan 99
 switchport trunk allowed vlan 10,20,99
end
write memory`,
    SW3: `configure terminal
vlan 10
 name SATIS
vlan 20
 name MUHASEBE
vlan 99
 name NATIVE
exit
interface fa0/1
 switchport mode access
 switchport access vlan 10
interface fa0/2
 switchport mode access
 switchport access vlan 20
interface range gi0/1 - 2
 switchport mode trunk
 switchport trunk native vlan 99
 switchport trunk allowed vlan 10,20,99
end
write memory`,
  },
}

export default lab
