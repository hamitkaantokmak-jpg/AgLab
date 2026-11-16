// AğLab Konu #31 - OSPF çok alan arıza giderme: stub bayrağı uyuşmazlığı, omurgaya bağlanmayan
// ABR (area 0 yok → alanlar arası rota yok), totally stubby alanın tamamlanması.
import type { LabDef } from '../sim/types'
import { ports } from '../sim/util'

const lan = (n: number) => `vlan 10
 name LAN
exit
interface fa0/1
 switchport mode access
 switchport access vlan 10
exit
interface vlan 10
 ip address 192.168.${n}.1 255.255.255.0
exit`

const routed = (port: string, ip: string) => `interface ${port}
 no switchport
 ip address ${ip} 255.255.255.252
exit`

const lab: LabDef = {
  id: 'ospf-alan-ariza',
  title: 'Çok alanlı OSPF arıza giderme: stub bayrağı ve omurgasız ABR',
  summary:
    'Şube alanı (area 1) merkeze hiç bağlanmıyor. Önce komşuluğu engelleyen bayrak uyuşmazlığını, sonra omurgaya bağlanmayan ABR\'yi bul; sonunda area 1\'i totally stubby yap.',
  level: 'İleri',
  tags: ['ENCOR', 'OSPF', 'Multi-area', 'Stub area', 'ABR', 'Arıza giderme'],
  brief: [
    'Tasarım: R1 (şube, area 1) — R2 (ABR) — R3 (merkez) — R4 (merkez LAN). R2–R3 ve R3–R4 bağlantıları ve merkez LAN\'ları area 0 olmalı. Area 1 totally stubby olacak: şube yalnız varsayılan rotayı ve kendi alanını görecek.',
    'Belirti: R1 ile R2 komşu değil. R1\'de area 1 stub yazılmış. Ayrıca bir teknisyen R2–R3 bağlantısını iki uçta da area 2\'ye almış; R3 bu yüzden ABR gibi görünüyor ama R2 omurgaya bağlı değil.',
    'Kurallar: stub bayrağı bir alandaki bütün router\'larda aynı olmalı (hello\'da karşılaştırılır). Alanlar arası rotalar yalnız area 0\'a bağlı ABR üzerinden geçer; omurgaya dokunmayan bir router iki alanı birbirine bağlayamaz.',
    'Totally stubby: alandaki her router\'da area 1 stub, ABR\'de ayrıca no-summary. R1\'de O*IA 0.0.0.0/0 dışında alanlar arası rota kalmamalı.',
    'Kontrol: show ip ospf neighbor, show ip ospf (ABR satırı ve alanlar), show ip ospf interface brief, show ip route ospf. PC1 → PC4 ping.',
  ],
  view: { w: 960, h: 500 },
  devices: [
    { id: 'R1', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0090.0001', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 130, y: 160 },
    { id: 'R2', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0090.0002', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 360, y: 160 },
    { id: 'R3', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0090.0003', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 590, y: 160 },
    { id: 'R4', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0090.0004', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 820, y: 160 },
    { id: 'PC1', kind: 'pc', mac: '0050.7966.9001', x: 130, y: 420 },
    { id: 'PC4', kind: 'pc', mac: '0050.7966.9004', x: 820, y: 420 },
  ],
  links: [
    { a: ['R1', 'GigabitEthernet0/1'], b: ['R2', 'GigabitEthernet0/1'] },
    { a: ['R2', 'GigabitEthernet0/2'], b: ['R3', 'GigabitEthernet0/1'] },
    { a: ['R3', 'GigabitEthernet0/2'], b: ['R4', 'GigabitEthernet0/1'] },
    { a: ['PC1', 'eth0'], b: ['R1', 'FastEthernet0/1'] },
    { a: ['PC4', 'eth0'], b: ['R4', 'FastEthernet0/1'] },
  ],
  initialConfig: {
    // fault 1: stub flag only on R1
    R1: `ip routing
${lan(1)}
${routed('gi0/1', '10.1.12.1')}
router ospf 1
 router-id 1.1.1.1
 area 1 stub
 passive-interface vlan 10
 network 10.1.12.0 0.0.0.3 area 1
 network 192.168.1.0 0.0.0.255 area 1
exit`,
    // fault 2: backbone link in area 2 on both ends
    R2: `ip routing
${routed('gi0/1', '10.1.12.2')}
${routed('gi0/2', '10.0.23.1')}
router ospf 1
 router-id 2.2.2.2
 network 10.1.12.0 0.0.0.3 area 1
 network 10.0.23.0 0.0.0.3 area 2
exit`,
    R3: `ip routing
${lan(3)}
${routed('gi0/1', '10.0.23.2')}
${routed('gi0/2', '10.0.34.1')}
router ospf 1
 router-id 3.3.3.3
 passive-interface vlan 10
 network 10.0.23.0 0.0.0.3 area 2
 network 10.0.34.0 0.0.0.3 area 0
 network 192.168.3.0 0.0.0.255 area 0
exit`,
    R4: `ip routing
${lan(4)}
${routed('gi0/1', '10.0.34.2')}
router ospf 1
 router-id 4.4.4.4
 passive-interface vlan 10
 network 10.0.34.0 0.0.0.3 area 0
 network 192.168.4.0 0.0.0.255 area 0
exit`,
  },
  initialPcs: {
    PC1: { ip: '192.168.1.10', prefix: 24, gw: '192.168.1.1' },
    PC4: { ip: '192.168.4.10', prefix: 24, gw: '192.168.4.1' },
  },
  objectives: [
    {
      id: 'stubflag',
      title: 'R1–R2 komşuluğu FULL (stub bayrağı iki uçta aynı)',
      hint: 'R2: router ospf 1 → area 1 stub. (Bayrağı R1\'den kaldırmak da komşuluğu kurar ama tasarım totally stubby istiyor.)',
      check: (q) => q.ospfAdjacent('R1', 'R2'),
    },
    {
      id: 'backbone',
      title: 'R2–R3 bağlantısı area 0\'da; R2 omurgaya bağlı ABR',
      hint: 'R2 ve R3: no network 10.0.23.0 0.0.0.3 area 2 → network 10.0.23.0 0.0.0.3 area 0. Kontrol: show ip ospf → "It is an area border router", alanlar 0 ve 1.',
      check: (q) => {
        const r2 = q.ospf('R2')
        return { ok: !!r2?.abr && r2.areas.join() === '0,1' && q.ospfAdjacent('R2', 'R3'), detail: r2 ? `R2 alanları: ${r2.areas.join(', ')}` : 'R2\'de OSPF yok' }
      },
    },
    {
      id: 'interarea',
      title: 'R4, şube LAN\'ını (192.168.1.0/24) O IA olarak görüyor',
      hint: 'Alanlar arası rota ancak omurgaya bağlı ABR\'nin ürettiği özet LSA ile gelir. show ip route 192.168.1.0 (R4).',
      check: (q) => {
        const r = q.route('R4', '192.168.1.0', 24)
        return { ok: r?.code === 'O IA', detail: r ? r.code : 'rota yok' }
      },
    },
    {
      id: 'tstub',
      title: 'Area 1 totally stubby: R1\'de yalnız O*IA varsayılan',
      hint: 'R2: router ospf 1 → area 1 stub no-summary. R1\'de "O IA" olarak yalnız 0.0.0.0/0 kalmalı.',
      check: (q) => {
        const rs = q.routes('R1').filter((e) => e.code.startsWith('O'))
        const def = rs.find((e) => e.prefix === 0)
        const extra = rs.filter((e) => e.code !== 'O' && e.prefix !== 0).map((e) => `${e.code} ${e.net}/${e.prefix}`)
        const ok = def?.code === 'O IA' && !extra.length
        return { ok, detail: !def ? 'R1\'de varsayılan rota yok' : extra.length ? 'Fazla: ' + extra.join(', ') : undefined }
      },
    },
    {
      id: 'e2e',
      title: 'PC1 ↔ PC4 ping',
      hint: 'R1 varsayılan rotayla R2\'ye, R2 omurga üzerinden R4\'e gider; dönüş O IA rotasıyla. PC1\'de: trace 192.168.4.10',
      check: (q) => q.ping('PC1', '192.168.4.10').ok && q.ping('PC4', '192.168.1.10').ok,
    },
  ],
  solution: {
    R2: `configure terminal
router ospf 1
 area 1 stub no-summary
 no network 10.0.23.0 0.0.0.3 area 2
 network 10.0.23.0 0.0.0.3 area 0
end
write memory`,
    R3: `configure terminal
router ospf 1
 no network 10.0.23.0 0.0.0.3 area 2
 network 10.0.23.0 0.0.0.3 area 0
end
write memory`,
  },
}

export default lab
