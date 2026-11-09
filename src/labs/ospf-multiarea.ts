// ENCOR 3 - OSPF Fundamentals: areas, ABR/ASBR, LSA types, default routes, stub / totally stubby areas.
import type { LabDef } from '../sim/types'
import { ports } from '../sim/util'

const lanCfg = (n: number) => `vlan 10
 name LAN
exit
interface fa0/1
 switchport mode access
 switchport access vlan 10
exit
interface vlan 10
 ip address 192.168.${n}.1 255.255.255.0
exit`

const routed = (port: string, ip: string, mask = '255.255.255.252') => `interface ${port}
 no switchport
 ip address ${ip} ${mask}
exit`

const lab: LabDef = {
  id: 'ospf-cok-alan',
  title: 'Çok alanlı OSPF: ABR, ASBR, varsayılan rota, totally stubby area',
  summary: 'Şube router\'ını area 1\'e al, ABR üzerinden backbone\'a bağla, ASBR\'den internete varsayılan rota yay ve area 1\'i totally stubby yaparak şubenin rota tablosunu tek bir default\'a indir.',
  level: 'İleri',
  tags: ['ENCOR', 'OSPF', 'Multi-area', 'ABR/ASBR', 'Stub area', 'Default route'],
  brief: [
    'Topoloji: R1 (şube, area 1) — R2 (ABR) — R3 (merkez, area 0, ASBR) — ISP. ISP hazır: Loopback0 8.8.8.8 ve iç ağlara dönüş rotaları var. Bütün IP adresleri ve ip routing hazır.',
    'Area 0 kurulu: R2 Gi0/2, R2 Loopback0 (2.2.2.2) ve R3\'ün iç arayüzleri. Area 1 eksik: R1 tarafında OSPF hiç yok, R2 Gi0/1 de OSPF\'te değil.',
    'R1\'de router ospf 1 (router-id 1.1.1.1), Gi0/1 ve LAN area 1, LAN passive. R2\'de 10.1.12.0/30 linkini area 1\'e al. R2 artık ABR olmalı.',
    'R3 internet çıkışı: ip route 0.0.0.0 0.0.0.0 203.0.113.1 ve router ospf altında default-information originate. R3 ASBR olur, R2 varsayılanı O*E2 olarak öğrenmeli.',
    'Şube router\'ının bütün iç rotaları ve dış rotaları bilmesine gerek yok. Area 1\'i totally stubby yap: R1\'de area 1 stub, ABR\'de (R2) area 1 stub no-summary. Stub bayrağı iki uçta da olmazsa komşuluk düşer.',
    'Sonuç: R1\'in tablosunda yalnızca kendi alanının rotaları ve O*IA 0.0.0.0/0 kalmalı. Kontrol: show ip route, show ip ospf, show ip ospf neighbor. PC1 hem PC3\'e hem 8.8.8.8\'e ping atabilmeli.',
  ],
  view: { w: 960, h: 500 },
  devices: [
    { id: 'R1', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0070.0001', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 130, y: 150 },
    { id: 'R2', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0070.0002', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 370, y: 150 },
    { id: 'R3', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0070.0003', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 610, y: 150 },
    { id: 'ISP', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0070.00ee', ports: ports('Gi0/1-2'), l3: true, needsEncap: true, x: 850, y: 150 },
    { id: 'PC1', kind: 'pc', mac: '0050.7966.7001', x: 130, y: 400 },
    { id: 'PC3', kind: 'pc', mac: '0050.7966.7003', x: 610, y: 400 },
  ],
  links: [
    { a: ['R1', 'GigabitEthernet0/1'], b: ['R2', 'GigabitEthernet0/1'] },
    { a: ['R2', 'GigabitEthernet0/2'], b: ['R3', 'GigabitEthernet0/1'] },
    { a: ['R3', 'GigabitEthernet0/2'], b: ['ISP', 'GigabitEthernet0/1'] },
    { a: ['PC1', 'eth0'], b: ['R1', 'FastEthernet0/1'] },
    { a: ['PC3', 'eth0'], b: ['R3', 'FastEthernet0/1'] },
  ],
  initialConfig: {
    R1: `ip routing
${lanCfg(1)}
${routed('gi0/1', '10.1.12.1')}`,
    R2: `ip routing
interface loopback 0
 ip address 2.2.2.2 255.255.255.255
exit
${routed('gi0/1', '10.1.12.2')}
${routed('gi0/2', '10.0.23.1')}
router ospf 1
 router-id 2.2.2.2
 network 10.0.23.0 0.0.0.3 area 0
 network 2.2.2.2 0.0.0.0 area 0
exit`,
    R3: `ip routing
${lanCfg(3)}
${routed('gi0/1', '10.0.23.2')}
${routed('gi0/2', '203.0.113.2')}
router ospf 1
 router-id 3.3.3.3
 passive-interface vlan 10
 network 10.0.23.0 0.0.0.3 area 0
 network 192.168.3.0 0.0.0.255 area 0
exit`,
    ISP: `ip routing
interface loopback 0
 ip address 8.8.8.8 255.255.255.255
exit
${routed('gi0/1', '203.0.113.1')}
ip route 10.0.0.0 255.0.0.0 203.0.113.2
ip route 192.168.0.0 255.255.0.0 203.0.113.2`,
  },
  initialPcs: {
    PC1: { ip: '192.168.1.10', prefix: 24, gw: '192.168.1.1' },
    PC3: { ip: '192.168.3.10', prefix: 24, gw: '192.168.3.1' },
  },
  objectives: [
    {
      id: 'area1',
      title: 'R1–R2 komşuluğu FULL ve area 1\'de; R2 ABR',
      hint: 'R1: router ospf 1 → router-id 1.1.1.1 → network 10.1.12.0 0.0.0.3 area 1. R2: network 10.1.12.0 0.0.0.3 area 1. Kontrol: show ip ospf ("It is an area border router")',
      check: (q) => q.ospfAdjacent('R1', 'R2') && !!q.ospf('R2')?.abr && q.ospf('R1')?.rid === '1.1.1.1' && q.ospf('R1')!.areas.join() === '1',
    },
    {
      id: 'lan1',
      title: 'R1 LAN\'ı area 1\'de, passive; R3 onu O IA olarak görüyor',
      hint: 'Başka alandan gelen ağ, ABR\'nin ürettiği Type 3 (summary) LSA ile gelir ve tabloda "O IA" görünür.',
      check: (q) => !!q.ospf('R1')?.ifs.some((i) => i.name === 'Vlan10' && i.passive && i.area === 1) && q.route('R3', '192.168.1.0', 24)?.code === 'O IA',
    },
    {
      id: 'asbr',
      title: 'R3 ASBR: statik default + default-information originate, R2\'de O*E2',
      hint: 'R3: ip route 0.0.0.0 0.0.0.0 203.0.113.1, router ospf 1 → default-information originate. Statik default olmadan (always yoksa) ilan edilmez.',
      check: (q) => !!q.ospf('R3')?.asbr && q.route('R2', '0.0.0.0', 0)?.code === 'O E2',
    },
    {
      id: 'stub',
      title: 'Area 1 totally stubby: R1\'de yalnızca O*IA default var',
      hint: 'R1: area 1 stub. R2: area 1 stub no-summary. R1\'de "O IA" olarak yalnızca 0.0.0.0/0 kalmalı, O E2 hiç olmamalı.',
      check: (q) => {
        const rs = q.routes('R1').filter((e) => e.code.startsWith('O'))
        const def = rs.find((e) => e.prefix === 0)
        const extra = rs.filter((e) => e.code !== 'O' && e.prefix !== 0).map((e) => `${e.code} ${e.net}/${e.prefix}`)
        const ok = def?.code === 'O IA' && !extra.length && !!q.cfg('R2').ospf?.stubs['1']?.noSummary
        return { ok, detail: !def ? 'R1\'de default yok' : def.code !== 'O IA' ? `default ${def.code}` : extra.length ? 'Fazla: ' + extra.join(', ') : undefined }
      },
    },
    {
      id: 'e2e',
      title: 'PC1 → PC3 ve PC1 → 8.8.8.8 ping',
      hint: 'R1 internete O*IA default ile R2\'ye, R2 O*E2 ile R3\'e, R3 statik default ile ISP\'ye gider. PC1\'de: trace 8.8.8.8',
      check: (q) => q.ping('PC1', '192.168.3.10').ok && q.ping('PC1', '8.8.8.8').ok,
    },
  ],
  solution: {
    R1: `configure terminal
router ospf 1
 router-id 1.1.1.1
 area 1 stub
 passive-interface vlan 10
 network 10.1.12.0 0.0.0.3 area 1
 network 192.168.1.0 0.0.0.255 area 1
end
write memory`,
    R2: `configure terminal
router ospf 1
 area 1 stub no-summary
 network 10.1.12.0 0.0.0.3 area 1
end
write memory`,
    R3: `configure terminal
ip route 0.0.0.0 0.0.0.0 203.0.113.1
router ospf 1
 default-information originate
end
write memory`,
  },
}

export default lab
