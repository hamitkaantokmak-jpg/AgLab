// CCNA 200-301: OSPF single area (router ID from loopback, network statements, passive-interface).
import type { LabDef } from '../sim/types'
import type { LabQuery } from '../sim/query'
import { ports } from '../sim/util'

const R = ['R1', 'R2', 'R3']
const RID: Record<string, string> = { R1: '1.1.1.1', R2: '2.2.2.2', R3: '3.3.3.3' }
const PCS = ['PC1', 'PC2', 'PC3']

const pingAll = (q: LabQuery) => {
  for (const a of PCS) for (const b of PCS) if (a !== b && !q.ping(a, q.pcIp(b) ?? '0.0.0.0').ok) return `${a} → ${b}`
  return null
}

const lan = (n: number) => `interface fa0/1
 switchport mode access
 switchport access vlan 10
exit
vlan 10
 name LAN
exit
interface vlan 10
 ip address 192.168.${n}.1 255.255.255.0
exit`

const lab: LabDef = {
  id: 'ospf-tek-alan',
  title: 'Tek alanlı OSPF: routed linkler, router ID, passive-interface',
  summary: 'Üç L3 switch\'i /30 routed portlarla üçgen şeklinde bağla, loopback\'lerden router ID ver, area 0\'da OSPF kur ve LAN\'ları passive yap.',
  level: 'Orta',
  tags: ['CCNA', 'OSPF', 'Routed port', 'Loopback', 'Passive interface'],
  brief: [
    'R1, R2, R3 birer Catalyst 3560 ve ip routing açık. Her birinin LAN\'ı hazır: VLAN 10, Vlan10 = 192.168.N.1/24 (N = 1, 2, 3).',
    'Aradaki linkleri switchport değil routed port yap (no switchport) ve /30 adres ver. R1–R2 Gi0/1: 10.0.12.0/30, R1 Gi0/2–R3 Gi0/1: 10.0.13.0/30, R2 Gi0/2–R3 Gi0/2: 10.0.23.0/30. Küçük numaralı router .1 alsın.',
    'Her router\'a Loopback0 ekle: 1.1.1.1/32, 2.2.2.2/32, 3.3.3.3/32. OSPF router ID\'leri bu adresler olsun (router-id ile ya da loopback\'ten seçilerek).',
    'router ospf 1 altında bütün arayüzleri area 0\'a al. LAN arayüzlerinde (Vlan10) hello gönderilmesin: passive-interface.',
    'Kontrol: show ip ospf neighbor, show ip route ospf, show ip protocols. Loopback\'ler /32 olarak öğrenilir.',
  ],
  view: { w: 880, h: 520 },
  devices: [
    { id: 'R1', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0030.0001', ports: ports('Fa0/1-4', 'Gi0/1-2'), l3: true, needsEncap: true, x: 440, y: 90 },
    { id: 'R2', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0030.0002', ports: ports('Fa0/1-4', 'Gi0/1-2'), l3: true, needsEncap: true, x: 210, y: 300 },
    { id: 'R3', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0030.0003', ports: ports('Fa0/1-4', 'Gi0/1-2'), l3: true, needsEncap: true, x: 670, y: 300 },
    { id: 'PC1', kind: 'pc', mac: '0050.7966.3001', x: 700, y: 70 },
    { id: 'PC2', kind: 'pc', mac: '0050.7966.3002', x: 210, y: 470 },
    { id: 'PC3', kind: 'pc', mac: '0050.7966.3003', x: 670, y: 470 },
  ],
  links: [
    { a: ['R1', 'GigabitEthernet0/1'], b: ['R2', 'GigabitEthernet0/1'] },
    { a: ['R1', 'GigabitEthernet0/2'], b: ['R3', 'GigabitEthernet0/1'] },
    { a: ['R2', 'GigabitEthernet0/2'], b: ['R3', 'GigabitEthernet0/2'] },
    { a: ['PC1', 'eth0'], b: ['R1', 'FastEthernet0/1'] },
    { a: ['PC2', 'eth0'], b: ['R2', 'FastEthernet0/1'] },
    { a: ['PC3', 'eth0'], b: ['R3', 'FastEthernet0/1'] },
  ],
  initialConfig: {
    R1: 'ip routing\n' + lan(1),
    R2: 'ip routing\n' + lan(2),
    R3: 'ip routing\n' + lan(3),
  },
  initialPcs: {
    PC1: { ip: '192.168.1.10', prefix: 24, gw: '192.168.1.1' },
    PC2: { ip: '192.168.2.10', prefix: 24, gw: '192.168.2.1' },
    PC3: { ip: '192.168.3.10', prefix: 24, gw: '192.168.3.1' },
  },
  objectives: [
    {
      id: 'links',
      title: 'Üç /30 routed link çalışıyor (komşu adresine ping)',
      hint: 'interface gi0/1 → no switchport → ip address 10.0.12.1 255.255.255.252. Kontrol: show ip interface brief, ping 10.0.12.2',
      check: (q) => {
        const pairs: [string, string][] = [['R1', '10.0.12.2'], ['R1', '10.0.13.2'], ['R2', '10.0.23.2']]
        const bad = pairs.filter(([d, ip]) => !q.ping(d, ip).ok).map(([d, ip]) => `${d}→${ip}`)
        return { ok: !bad.length, detail: bad.length ? 'Ping yok: ' + bad.join(', ') : undefined }
      },
    },
    {
      id: 'rid',
      title: 'Router ID\'ler 1.1.1.1, 2.2.2.2, 3.3.3.3',
      hint: 'Router ID OSPF süreci başlarken seçilir. Sonradan değiştirirsen komşuluk varken "clear ip ospf process" gerekir. Kontrol: show ip protocols',
      check: (q) => {
        const bad = R.filter((d) => q.ospf(d)?.rid !== RID[d]).map((d) => `${d}=${q.ospf(d)?.rid ?? 'yok'}`)
        return { ok: !bad.length, detail: bad.length ? bad.join(', ') : undefined }
      },
    },
    {
      id: 'adj',
      title: 'Üç OSPF komşuluğu FULL',
      hint: 'network 10.0.0.0 0.255.255.255 area 0 gibi bir ifade linkleri OSPF\'e alır. Kontrol: show ip ospf neighbor',
      check: (q) => q.ospfAdjacent('R1', 'R2') && q.ospfAdjacent('R1', 'R3') && q.ospfAdjacent('R2', 'R3'),
    },
    {
      id: 'passive',
      title: 'LAN arayüzleri OSPF\'te ama passive',
      hint: 'router ospf 1 → passive-interface vlan 10. Passive arayüz hello göndermez ama ağı yine de ilan edilir. Kontrol: show ip ospf interface vlan 10',
      check: (q) => R.every((d) => q.ospf(d)?.ifs.some((i) => i.name === 'Vlan10' && i.passive && i.area === 0) ?? false),
    },
    {
      id: 'loop',
      title: 'R1, diğer router\'ların loopback\'lerini /32 olarak OSPF\'ten öğrendi',
      hint: 'Loopback0 da bir network ifadesiyle eşleşmeli (ör. network 2.2.2.2 0.0.0.0 area 0). Kontrol: show ip route ospf',
      check: (q) => ['2.2.2.2', '3.3.3.3'].every((ip) => q.route('R1', ip, 32)?.code === 'O'),
    },
    {
      id: 'e2e',
      title: 'Bütün PC\'ler birbirine ping atabiliyor',
      hint: 'Her LAN diğer iki router\'da O olarak görünmeli. PC\'de: trace 192.168.3.10',
      check: (q) => {
        const bad = pingAll(q)
        return { ok: !bad, detail: bad ? 'Ping yok: ' + bad : undefined }
      },
    },
  ],
  solution: {
    R1: `configure terminal
interface loopback 0
 ip address 1.1.1.1 255.255.255.255
interface gi0/1
 no switchport
 ip address 10.0.12.1 255.255.255.252
interface gi0/2
 no switchport
 ip address 10.0.13.1 255.255.255.252
exit
router ospf 1
 router-id 1.1.1.1
 network 10.0.0.0 0.255.255.255 area 0
 network 192.168.1.0 0.0.0.255 area 0
 network 1.1.1.1 0.0.0.0 area 0
 passive-interface vlan 10
end
write memory`,
    R2: `configure terminal
interface loopback 0
 ip address 2.2.2.2 255.255.255.255
interface gi0/1
 no switchport
 ip address 10.0.12.2 255.255.255.252
interface gi0/2
 no switchport
 ip address 10.0.23.1 255.255.255.252
exit
router ospf 1
 router-id 2.2.2.2
 network 10.0.0.0 0.255.255.255 area 0
 network 192.168.2.0 0.0.0.255 area 0
 network 2.2.2.2 0.0.0.0 area 0
 passive-interface vlan 10
end
write memory`,
    R3: `configure terminal
interface loopback 0
 ip address 3.3.3.3 255.255.255.255
interface gi0/1
 no switchport
 ip address 10.0.13.2 255.255.255.252
interface gi0/2
 no switchport
 ip address 10.0.23.2 255.255.255.252
exit
router ospf 1
 router-id 3.3.3.3
 network 10.0.0.0 0.255.255.255 area 0
 network 192.168.3.0 0.0.0.255 area 0
 network 3.3.3.3 0.0.0.0 area 0
 passive-interface vlan 10
end
write memory`,
  },
}

export default lab
