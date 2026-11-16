// ENARSI / AğLab Konu #42 - İleri OSPF sorun giderme: ağ tipi uyuşmazlığı (FULL ama rota yok),
// çift router-id (komşuluk yok), iki uçta priority 0 (2-WAY'de takılı).
import type { LabDef } from '../sim/types'
import { ports } from '../sim/util'

const base = (n: number, extra: string) => `ip routing
vlan 10
 name LAN
exit
interface fa0/1
 switchport mode access
 switchport access vlan 10
exit
interface vlan 10
 ip address 192.168.${n}.1 255.255.255.0
exit
${extra}`

const routed = (port: string, ip: string, more = '') => `interface ${port}
 no switchport
 ip address ${ip} 255.255.255.252${more}
exit`

const ospf = (rid: string, n: number, nets: string[]) => `
router ospf 1
 router-id ${rid}
 passive-interface vlan 10
 network 192.168.${n}.0 0.0.0.255 area 0
${nets.map((x) => ` network ${x} 0.0.0.3 area 0`).join('\n')}
exit`

const lab: LabDef = {
  id: 'ospf-sorun-ileri',
  title: 'İleri OSPF sorun giderme: ağ tipi, çift router-id ve DR seçimi',
  summary:
    'Dört router zinciri. Bir komşuluk FULL görünüyor ama rota gelmiyor, biri hiç kurulmuyor, biri 2-WAY\'de takılı. Her bağlantıda takılan durumdan nedeni bul ve PC1 ile PC4 arasını aç.',
  level: 'İleri',
  tags: ['ENARSI', 'OSPF', 'Arıza giderme', 'Ağ tipi', 'Router-id', 'DR/BDR'],
  brief: [
    'Zincir: R1 — R2 — R3 — R4; bütün bağlantılar /30 routed port, hepsi area 0. LAN\'lar 192.168.1.0/24 (R1) ve 192.168.4.0/24 (R4). IP adresleri doğru.',
    'Belirti: PC1, PC4\'e ulaşamıyor. R1\'de show ip ospf neighbor R2\'yi FULL gösteriyor ama R1\'in tablosunda OSPF rotası yok. R2 ile R3 birbirini hiç görmüyor. R3 ile R4 arasında komşuluk 2WAY/DROTHER\'da kalıyor.',
    'Yöntem: her bağlantıda önce durumu oku (show ip ospf neighbor), sonra arayüz ayarlarını karşılaştır (show ip ospf interface), sonra süreç ayarlarına bak (show ip ospf, show running-config | section ospf).',
    'Kurallar: iki uçta aynı ağ tipi; her router\'ın benzersiz router-id\'si (değişince clear ip ospf process); broadcast bir segmentte en az bir router\'ın priority\'si 0\'dan büyük olmalı ki DR seçilebilsin.',
    'Bitince: üç komşuluk FULL, R1\'in tablosunda 192.168.4.0/24 OSPF rotası, PC1 ↔ PC4 ping.',
  ],
  view: { w: 960, h: 500 },
  devices: [
    { id: 'R1', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0080.0001', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 130, y: 160 },
    { id: 'R2', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0080.0002', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 360, y: 160 },
    { id: 'R3', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0080.0003', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 590, y: 160 },
    { id: 'R4', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0080.0004', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 820, y: 160 },
    { id: 'PC1', kind: 'pc', mac: '0050.7966.8001', x: 130, y: 420 },
    { id: 'PC4', kind: 'pc', mac: '0050.7966.8004', x: 820, y: 420 },
  ],
  links: [
    { a: ['R1', 'GigabitEthernet0/1'], b: ['R2', 'GigabitEthernet0/1'] },
    { a: ['R2', 'GigabitEthernet0/2'], b: ['R3', 'GigabitEthernet0/1'] },
    { a: ['R3', 'GigabitEthernet0/2'], b: ['R4', 'GigabitEthernet0/1'] },
    { a: ['PC1', 'eth0'], b: ['R1', 'FastEthernet0/1'] },
    { a: ['PC4', 'eth0'], b: ['R4', 'FastEthernet0/1'] },
  ],
  initialConfig: {
    R1: base(1, routed('gi0/1', '10.0.12.1')) + ospf('1.1.1.1', 1, ['10.0.12.0']),
    // fault 1: network type point-to-point on one end only
    R2:
      base(2, [routed('gi0/1', '10.0.12.2', '\n ip ospf network point-to-point'), routed('gi0/2', '10.0.23.1')].join('\n')) +
      ospf('2.2.2.2', 2, ['10.0.12.0', '10.0.23.0']),
    // fault 2: router-id copied from R2; fault 3a: priority 0 towards R4
    R3:
      base(3, [routed('gi0/1', '10.0.23.2'), routed('gi0/2', '10.0.34.1', '\n ip ospf priority 0')].join('\n')) +
      ospf('2.2.2.2', 3, ['10.0.23.0', '10.0.34.0']),
    // fault 3b: priority 0 towards R3 as well
    R4: base(4, routed('gi0/1', '10.0.34.2', '\n ip ospf priority 0')) + ospf('4.4.4.4', 4, ['10.0.34.0']),
  },
  initialPcs: {
    PC1: { ip: '192.168.1.10', prefix: 24, gw: '192.168.1.1' },
    PC4: { ip: '192.168.4.10', prefix: 24, gw: '192.168.4.1' },
  },
  objectives: [
    {
      id: 'nettype',
      title: 'R1–R2: iki uçta aynı ağ tipi, rotalar SPF\'e giriyor',
      hint: 'R2 Gi0/1: no ip ospf network (ya da iki uçta da point-to-point).',
      check: (q) => {
        const nb = q.ospf('R1')?.nbrs.find((n) => n.peerDev === 'R2')
        return { ok: !!nb && nb.state === 'FULL' && nb.spf, detail: nb ? `${nb.state}${nb.spf ? '' : ', SPF dışında'}` : 'komşu yok' }
      },
    },
    {
      id: 'rid',
      title: 'R2–R3 komşuluğu FULL (router-id benzersiz)',
      hint: 'R3: router ospf 1 → router-id 3.3.3.3 → end → clear ip ospf process (soruya yes).',
      check: (q) => q.ospfAdjacent('R2', 'R3'),
    },
    {
      id: 'dr',
      title: 'R3–R4 komşuluğu FULL (segmentte bir DR seçildi)',
      hint: 'R3 Gi0/2 ya da R4 Gi0/1: no ip ospf priority. İki uç da priority 0 iken DR seçilemez.',
      check: (q) => q.ospfAdjacent('R3', 'R4'),
    },
    {
      id: 'route',
      title: 'R1\'in tablosunda 192.168.4.0/24 OSPF rotası',
      hint: 'show ip route ospf. Önceki üç hedef tamamsa rota R2 üzerinden gelir.',
      check: (q) => {
        const r = q.route('R1', '192.168.4.0', 24)
        return { ok: !!r && r.code === 'O', detail: r ? `${r.code} via ${r.nh}` : 'rota yok' }
      },
    },
    {
      id: 'e2e',
      title: 'PC1 ↔ PC4 ping',
      hint: 'PC1\'de: ping 192.168.4.10, sonra trace 192.168.4.10.',
      check: (q) => q.ping('PC1', '192.168.4.10').ok && q.ping('PC4', '192.168.1.10').ok,
    },
  ],
  solution: {
    R2: `configure terminal
interface gi0/1
 no ip ospf network
end
write memory`,
    R3: `configure terminal
router ospf 1
 router-id 3.3.3.3
end
clear ip ospf process
yes
configure terminal
interface gi0/2
 no ip ospf priority
end
write memory`,
  },
}

export default lab
