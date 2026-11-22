// Konu #7 VLAN'lar arası yönlendirme — yönlendirmeli lab
// (docs/dersler/vlanlar-arasi-yonlendirme.md "4. Yönlendirmeli lab"): router-on-a-stick.
import type { LabDef } from '../sim/types'
import type { LabQuery } from '../sim/query'
import { ports } from '../sim/util'

const sub = (q: LabQuery, vlan: number, ip: string) => {
  const s = q.cfg('R1').subifs?.['GigabitEthernet0/0.' + vlan]
  return !!s && s.vlan === vlan && !s.shutdown && s.ip?.addr === ip && s.ip.mask === '255.255.255.0'
}

const lab: LabDef = {
  id: 'roas-kurulum',
  title: 'Router-on-a-stick: iki VLAN\'ı tek kabloyla yönlendirmek',
  summary: 'SW1–R1 bağlantısını trunk yap, R1\'de VLAN 10 ve 20 için alt arayüzleri kur; farklı VLAN\'daki PC\'ler birbirine ulaşsın.',
  level: 'Başlangıç',
  tags: ['Şube', 'Konu #7', 'Router-on-a-stick', 'Alt arayüz', '802.1Q', 'Trunk'],
  brief: [
    'SW1\'de VLAN\'lar hazır: PC-01 ve PC-03 VLAN 10\'da (192.168.10.0/24, gateway .1), PC-02 VLAN 20\'de (192.168.20.0/24, gateway .1). Önce gözle: PC-01 → PC-03 ping çalışır, PC-01 → PC-02 çalışmaz.',
    'R1\'in tek kablosu SW1 Gi0/1\'e bağlı. Bu kablo iki VLAN\'ı da taşımalı: SW1 tarafında trunk, izinli VLAN\'lar 10 ve 20.',
    'R1\'de fiziksel arayüz G0/0 açık olmalı ama IP almaz. Her VLAN için bir alt arayüz: G0/0.10 (VLAN 10, 192.168.10.1/24) ve G0/0.20 (VLAN 20, 192.168.20.1/24).',
    'Her adımdan sonra doğrula: SW1\'de `show interfaces trunk`, R1\'de `show ip interface brief` ve `show ip route` (iki bağlı ağ), sonra PC-01\'den `ping 192.168.20.12` ve `trace 192.168.20.12`.',
  ],
  view: { w: 820, h: 460 },
  devices: [
    { id: 'R1', kind: 'switch', router: true, model: 'ISR4331', mac: '5254.0092.0001', ports: ports('Gi0/0-2'), x: 410, y: 70 },
    { id: 'SW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0092.0011', ports: ports('Fa0/1-4', 'Gi0/1-2'), x: 410, y: 220 },
    { id: 'PC-01', kind: 'pc', mac: '0050.7966.9201', x: 180, y: 390 },
    { id: 'PC-02', kind: 'pc', mac: '0050.7966.9202', x: 410, y: 390 },
    { id: 'PC-03', kind: 'pc', mac: '0050.7966.9203', x: 640, y: 390 },
  ],
  links: [
    { a: ['R1', 'GigabitEthernet0/0'], b: ['SW1', 'GigabitEthernet0/1'] },
    { a: ['PC-01', 'eth0'], b: ['SW1', 'FastEthernet0/1'] },
    { a: ['PC-02', 'eth0'], b: ['SW1', 'FastEthernet0/2'] },
    { a: ['PC-03', 'eth0'], b: ['SW1', 'FastEthernet0/3'] },
  ],
  initialConfig: {
    SW1: `vlan 10
 name SATIS
vlan 20
 name MUHASEBE
exit
interface fa0/1
 switchport mode access
 switchport access vlan 10
interface fa0/2
 switchport mode access
 switchport access vlan 20
interface fa0/3
 switchport mode access
 switchport access vlan 10
exit`,
  },
  initialPcs: {
    'PC-01': { ip: '192.168.10.11', prefix: 24, gw: '192.168.10.1' },
    'PC-02': { ip: '192.168.20.12', prefix: 24, gw: '192.168.20.1' },
    'PC-03': { ip: '192.168.10.13', prefix: 24, gw: '192.168.10.1' },
  },
  objectives: [
    {
      id: 'trunk',
      title: 'SW1 Gi0/1 trunk ve VLAN 10 ile 20\'yi taşıyor',
      hint: 'interface gi0/1 → switchport mode trunk → switchport trunk allowed vlan 10,20. Kontrol: show interfaces trunk',
      check: (q) => q.isTrunk('SW1', 'GigabitEthernet0/1') && q.trunkCarries('SW1', 'GigabitEthernet0/1', 10) && q.trunkCarries('SW1', 'GigabitEthernet0/1', 20),
    },
    {
      id: 'sub10',
      title: 'R1 G0/0.10: VLAN 10, 192.168.10.1/24',
      hint: 'interface g0/0 → no shutdown; interface g0/0.10 → encapsulation dot1Q 10 → ip address 192.168.10.1 255.255.255.0 (önce encapsulation).',
      check: (q) => sub(q, 10, '192.168.10.1'),
    },
    {
      id: 'sub20',
      title: 'R1 G0/0.20: VLAN 20, 192.168.20.1/24',
      hint: 'interface g0/0.20 → encapsulation dot1Q 20 → ip address 192.168.20.1 255.255.255.0',
      check: (q) => sub(q, 20, '192.168.20.1'),
    },
    {
      id: 'gw',
      title: 'PC\'ler kendi gateway\'ine ulaşıyor',
      hint: 'Fiziksel G0/0 kapalıysa alt arayüzler de çalışmaz: interface g0/0 → no shutdown. Kontrol: show ip interface brief',
      check: (q) => q.ping('PC-01', '192.168.10.1').ok && q.ping('PC-02', '192.168.20.1').ok,
    },
    {
      id: 'inter',
      title: 'PC-01 (VLAN 10) ↔ PC-02 (VLAN 20) ping',
      hint: 'Trafik R1 üzerinden döner: PC-01\'de trace 192.168.20.12 ilk adımda 192.168.10.1\'i gösterir.',
      check: (q) => q.ping('PC-01', '192.168.20.12').ok && q.ping('PC-02', '192.168.10.13').ok,
    },
  ],
  solution: {
    SW1: `configure terminal
interface gi0/1
 switchport mode trunk
 switchport trunk allowed vlan 10,20
end
`,
    R1: `configure terminal
interface g0/0
 no shutdown
interface g0/0.10
 encapsulation dot1Q 10
 ip address 192.168.10.1 255.255.255.0
interface g0/0.20
 encapsulation dot1Q 20
 ip address 192.168.20.1 255.255.255.0
end
`,
  },
}

export default lab
