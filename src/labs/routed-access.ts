// ENCOR 1 - Architecture: "Best Practice: A Completely Routed Switch Block" (L3 to the access layer).
import type { LabDef } from '../sim/types'
import { ports } from '../sim/util'

const UPLINKS: [string, string, string, string, string][] = [
  // dist, dist port, access, access port, /30 network (dist .1, access .2)
  ['DSW1', 'Gi0/1', 'ASW1', 'Gi0/1', '10.1.11'],
  ['DSW2', 'Gi0/1', 'ASW1', 'Gi0/2', '10.1.21'],
  ['DSW1', 'Gi0/2', 'ASW2', 'Gi0/1', '10.1.12'],
  ['DSW2', 'Gi0/2', 'ASW2', 'Gi0/2', '10.1.22'],
]
const ALL = ['DSW1', 'DSW2', 'ASW1', 'ASW2']

const routedIf = (port: string, ip: string) => `interface ${port}
 no switchport
 ip address ${ip} 255.255.255.252
 ip ospf network point-to-point`

const solutionFor = (dev: string): string => {
  const lines = ['configure terminal']
  for (const [d, dp, a, ap, net] of UPLINKS) {
    if (d === dev) lines.push(routedIf(dp, net + '.1'))
    if (a === dev) lines.push(routedIf(ap, net + '.2'))
  }
  if (dev === 'DSW1' || dev === 'DSW2') {
    lines.push(routedIf('Gi0/3', dev === 'DSW1' ? '10.1.0.1' : '10.1.0.2'), 'exit')
    if (dev === 'DSW1') lines.push('no interface vlan 10', 'no interface vlan 20')
    lines.push('no vlan 10,20')
  } else {
    const v = dev === 'ASW1' ? 10 : 20
    lines.push('exit', `interface vlan ${v}`, ` ip address 192.168.${v}.1 255.255.255.0`, 'exit')
  }
  const rid = { DSW1: '10.255.0.1', DSW2: '10.255.0.2', ASW1: '10.255.0.11', ASW2: '10.255.0.12' }[dev]!
  lines.push('router ospf 1', ` router-id ${rid}`, ' network 10.1.0.0 0.0.255.255 area 0')
  if (dev.startsWith('ASW')) lines.push(` network 192.168.${dev === 'ASW1' ? 10 : 20}.0 0.0.0.255 area 0`, ` passive-interface vlan ${dev === 'ASW1' ? 10 : 20}`)
  lines.push('end', 'write memory')
  return lines.join('\n')
}

const trunk = (list: string) => `interface range ${list}
 switchport trunk encapsulation dot1q
 switchport mode trunk
exit`

const lab: LabDef = {
  id: 'routed-erisim-blogu',
  title: 'Tamamen routed switch bloğu (L3 erişim katmanı)',
  summary: 'Klasik L2 dağıtım bloğunu, erişim switch\'lerinin kendi VLAN\'larına gateway olduğu, STP\'nin port bloklamadığı ve OSPF\'in iki uplink\'i birlikte kullandığı routed bir bloğa dönüştür.',
  level: 'İleri',
  tags: ['ENCOR', 'Kampüs tasarımı', 'Routed port', 'OSPF', 'ECMP'],
  brief: [
    'Mevcut tasarım klasik L2 bloğu: VLAN 10 ve 20 dört switch\'e de yayılmış, bütün linkler trunk, gateway\'ler DSW1\'deki SVI\'lar. STP her VLAN\'da bir uplink\'i blokluyor; uplink\'lerin yarısı boşta.',
    'Hedef, PDF\'teki "A Completely Routed Switch Block" tasarımı: dört switch arasındaki her link /30 routed port olsun ve hiçbir VLAN erişim switch\'inin dışına çıkmasın.',
    'Adresleme: DSWn Gi0/x tarafı .1, erişim tarafı .2 alsın. DSW1–ASW1 10.1.11.0/30, DSW2–ASW1 10.1.21.0/30, DSW1–ASW2 10.1.12.0/30, DSW2–ASW2 10.1.22.0/30, DSW1–DSW2 (Gi0/3) 10.1.0.0/30 (DSW1 .1).',
    'Gateway\'ler erişim katmanına taşınsın: ASW1 Vlan10 = 192.168.10.1/24, ASW2 Vlan20 = 192.168.20.1/24. DSW1\'deki eski SVI\'ları ve dağıtım switch\'lerindeki VLAN 10/20\'yi kaldır.',
    'OSPF area 0. Router ID\'ler: DSW1 10.255.0.1, DSW2 10.255.0.2, ASW1 10.255.0.11, ASW2 10.255.0.12. İki router\'lık linklerde DR/BDR seçimi gereksiz: ip ospf network point-to-point. LAN SVI\'ları passive.',
    'Sonuç: her erişim switch\'i karşı LAN\'a iki eşit maliyetli yol görmeli (ECMP). Kontrol: show ip route 192.168.20.0, show spanning-tree, show ip ospf neighbor.',
  ],
  view: { w: 900, h: 560 },
  devices: [
    { id: 'DSW1', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0040.0001', ports: ports('Fa0/1-2', 'Gi0/1-3'), l3: true, needsEncap: true, x: 260, y: 90 },
    { id: 'DSW2', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0040.0002', ports: ports('Fa0/1-2', 'Gi0/1-3'), l3: true, needsEncap: true, x: 640, y: 90 },
    { id: 'ASW1', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0040.0011', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 260, y: 330 },
    { id: 'ASW2', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0040.0012', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 640, y: 330 },
    { id: 'PC1', kind: 'pc', mac: '0050.7966.4001', x: 260, y: 500 },
    { id: 'PC2', kind: 'pc', mac: '0050.7966.4002', x: 640, y: 500 },
  ],
  links: [
    { a: ['DSW1', 'GigabitEthernet0/1'], b: ['ASW1', 'GigabitEthernet0/1'] },
    { a: ['DSW2', 'GigabitEthernet0/1'], b: ['ASW1', 'GigabitEthernet0/2'] },
    { a: ['DSW1', 'GigabitEthernet0/2'], b: ['ASW2', 'GigabitEthernet0/1'] },
    { a: ['DSW2', 'GigabitEthernet0/2'], b: ['ASW2', 'GigabitEthernet0/2'] },
    { a: ['DSW1', 'GigabitEthernet0/3'], b: ['DSW2', 'GigabitEthernet0/3'] },
    { a: ['PC1', 'eth0'], b: ['ASW1', 'FastEthernet0/1'] },
    { a: ['PC2', 'eth0'], b: ['ASW2', 'FastEthernet0/1'] },
  ],
  initialConfig: {
    DSW1: `ip routing
vlan 10,20
exit
spanning-tree vlan 10,20 root primary
${trunk('gi0/1 - 3')}
interface vlan 10
 ip address 192.168.10.1 255.255.255.0
interface vlan 20
 ip address 192.168.20.1 255.255.255.0
exit`,
    DSW2: `ip routing
vlan 10,20
exit
${trunk('gi0/1 - 3')}`,
    ASW1: `ip routing
vlan 10,20
exit
${trunk('gi0/1 - 2')}
interface fa0/1
 switchport mode access
 switchport access vlan 10
 spanning-tree portfast
exit`,
    ASW2: `ip routing
vlan 10,20
exit
${trunk('gi0/1 - 2')}
interface fa0/1
 switchport mode access
 switchport access vlan 20
 spanning-tree portfast
exit`,
  },
  initialPcs: {
    PC1: { ip: '192.168.10.10', prefix: 24, gw: '192.168.10.1' },
    PC2: { ip: '192.168.20.10', prefix: 24, gw: '192.168.20.1' },
  },
  objectives: [
    {
      id: 'routed',
      title: 'Blok içindeki bütün linkler routed port',
      hint: 'interface gi0/1 → no switchport → ip address … 255.255.255.252. Trunk kalan link VLAN\'ı dağıtıma taşımaya devam eder.',
      check: (q) => {
        const ends: [string, string][] = [...UPLINKS.flatMap(([d, dp, a, ap]) => [[d, dp], [a, ap]] as [string, string][]), ['DSW1', 'Gi0/3'], ['DSW2', 'Gi0/3']]
        const bad = ends.filter(([dev, p]) => !q.portCfg(dev, p)?.routed || !q.portCfg(dev, p)?.ip).map(([dev, p]) => `${dev} ${p}`)
        return { ok: !bad.length, detail: bad.length ? 'L2 ya da IP\'siz: ' + bad.join(', ') : undefined }
      },
    },
    {
      id: 'novlan',
      title: 'VLAN 10/20 dağıtıma yayılmıyor, gateway\'ler erişim switch\'inde',
      hint: 'DSW1: no interface vlan 10, no interface vlan 20, no vlan 10,20 (DSW2\'de de). ASW1\'de interface vlan 10, ASW2\'de interface vlan 20.',
      check: (q) =>
        ['DSW1', 'DSW2'].every((d) => !q.vlanExists(d, 10) && !q.vlanExists(d, 20)) &&
        q.cfg('ASW1').svis['10']?.ip?.addr === '192.168.10.1' &&
        q.sviUp('ASW1', 10) &&
        q.cfg('ASW2').svis['20']?.ip?.addr === '192.168.20.1' &&
        q.sviUp('ASW2', 20),
    },
    {
      id: 'nostp',
      title: 'STP hiçbir portu bloklamıyor',
      hint: 'Routed portlar STP\'ye katılmaz; döngü L3\'te OSPF tarafından çözülür. Kontrol: show spanning-tree',
      check: (q) => {
        const blk: string[] = []
        for (const [v, bridges] of Object.entries(q.d.stp))
          for (const [dev, b] of Object.entries(bridges))
            for (const [p, st] of Object.entries(b.ports)) if (st.state !== 'FWD') blk.push(`${dev} ${p} (VLAN ${v})`)
        return { ok: !blk.length, detail: blk.length ? 'Bloklu: ' + blk.join(', ') : undefined }
      },
    },
    {
      id: 'p2p',
      title: 'Beş OSPF komşuluğu FULL, hepsi point-to-point (DR/BDR yok)',
      hint: 'Her routed linkte iki uçta: ip ospf network point-to-point. show ip ospf neighbor\'da durum "FULL/  -" olmalı.',
      check: (q) => {
        const pairs: [string, string][] = [['DSW1', 'DSW2'], ...UPLINKS.map(([d, , a]) => [d, a] as [string, string])]
        const bad = pairs.filter(([a, b]) => !q.ospfAdjacent(a, b)).map(([a, b]) => `${a}–${b}`)
        const dr = ALL.flatMap((d) => q.ospfFull(d).filter((n) => n.role !== '-').map((n) => `${d} ${n.ifname}`))
        if (bad.length) return { ok: false, detail: 'Komşuluk yok: ' + bad.join(', ') }
        return { ok: !dr.length, detail: dr.length ? 'Hâlâ broadcast: ' + dr.join(', ') : undefined }
      },
    },
    {
      id: 'rid',
      title: 'Router ID\'ler plana uygun',
      hint: 'router ospf 1 → router-id 10.255.0.11. Komşuluk kurulduktan sonra değiştirirsen: clear ip ospf process',
      check: (q) => {
        const want: Record<string, string> = { DSW1: '10.255.0.1', DSW2: '10.255.0.2', ASW1: '10.255.0.11', ASW2: '10.255.0.12' }
        const bad = ALL.filter((d) => q.ospf(d)?.rid !== want[d]).map((d) => `${d}=${q.ospf(d)?.rid ?? 'yok'}`)
        return { ok: !bad.length, detail: bad.length ? bad.join(', ') : undefined }
      },
    },
    {
      id: 'ecmp',
      title: 'Erişim switch\'leri karşı LAN\'a iki eşit maliyetli yol görüyor',
      hint: 'İki uplink aynı maliyette olmalı. Kontrol: show ip route 192.168.20.0 → iki "via" satırı.',
      check: (q) => (q.route('ASW1', '192.168.20.0', 24)?.paths?.length ?? 0) >= 2 && (q.route('ASW2', '192.168.10.0', 24)?.paths?.length ?? 0) >= 2,
    },
    {
      id: 'e2e',
      title: 'PC1 ↔ PC2 ping',
      hint: 'LAN\'lar OSPF\'e alınmalı (network 192.168.10.0 0.0.0.255 area 0) ve passive olmalı.',
      check: (q) => q.ping('PC1', '192.168.20.10').ok && q.ping('PC2', '192.168.10.10').ok && q.route('ASW1', '192.168.20.0', 24)?.code === 'O',
    },
  ],
  solution: Object.fromEntries(ALL.map((d) => [d, solutionFor(d)])),
}

export default lab
