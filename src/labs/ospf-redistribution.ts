// AğLab Konu #44 - Redistribution: statik ve bağlı ağları OSPF'e E2 olarak aktarmak.
// Arıza: `subnets` olmadan aktarım (yalnız sınıflı ağlar geçer); OSPF'te olmayan bağlı ağ aktarılmamış.
import type { LabDef } from '../sim/types'
import { ports } from '../sim/util'

const lan = (vlan: number, ip: string) => `vlan ${vlan}
 name LAN
exit
interface fa0/1
 switchport mode access
 switchport access vlan ${vlan}
exit
interface vlan ${vlan}
 ip address ${ip} 255.255.255.0
exit`

const routed = (port: string, ip: string) => `interface ${port}
 no switchport
 ip address ${ip} 255.255.255.252
exit`

const lab: LabDef = {
  id: 'ospf-dagitim',
  title: 'Redistribution: statik ve bağlı ağları OSPF\'e aktarmak',
  summary:
    'Eski bir router\'ın arkasındaki sunucu ağı ve R1\'deki DMZ ağı OSPF alanında görünmüyor. R1\'i ASBR yap: statik rotayı ve DMZ\'yi E2 olarak, istenen metrikle aktar.',
  level: 'İleri',
  tags: ['ENARSI', 'OSPF', 'Redistribution', 'ASBR', 'E2', 'subnets'],
  brief: [
    'R0 eski bir router: OSPF çalıştırmıyor, arkasında 10.50.1.0/24 sunucu ağı var, varsayılan rotası R1\'e bakıyor. R1 bu ağa statik rotayla gidiyor (ip route 10.50.1.0 255.255.255.0 10.9.0.2).',
    'R1\'de ayrıca DMZ ağı 172.16.5.0/24 (Vlan20) var ve OSPF\'e eklenmemesi isteniyor: arayüz OSPF\'te olmadan aktarılmalı. R1–R2–R3 arası OSPF area 0 hazır.',
    'Belirti: R1\'de router ospf altında redistribute static yazılmış; ama R3\'ün tablosunda 10.50.1.0/24 yok. DMZ de yok.',
    'Kurallar: Labber\'ın 12.2 sürümlü IOS\'unda OSPF\'e aktarımda subnets yazılmazsa yalnız sınıflı (A/B/C) ağlar aktarılır; 10.50.1.0/24 bir A sınıfı ağın alt ağıdır. Aktarılan rotalar varsayılan olarak metrik 20, tip E2 alır. İstenen: statikler metrik 50, bağlı ağlar varsayılan 20.',
    'Kontrol: show ip ospf (R1 ASBR mı), show running-config | section ospf, R3\'te show ip route ospf (O E2 satırları ve metrikleri). PC3\'ten SRV0 ve PC-DMZ\'ye ping.',
  ],
  view: { w: 960, h: 500 },
  devices: [
    { id: 'R0', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.00a0.0000', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 110, y: 160 },
    { id: 'R1', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.00a0.0001', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 340, y: 160 },
    { id: 'R2', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.00a0.0002', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 590, y: 160 },
    { id: 'R3', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.00a0.0003', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 840, y: 160 },
    { id: 'SRV0', kind: 'pc', mac: '0050.7966.a000', x: 110, y: 420 },
    { id: 'PC-DMZ', kind: 'pc', mac: '0050.7966.a001', x: 340, y: 420 },
    { id: 'PC3', kind: 'pc', mac: '0050.7966.a003', x: 840, y: 420 },
  ],
  links: [
    { a: ['R0', 'GigabitEthernet0/1'], b: ['R1', 'GigabitEthernet0/1'] },
    { a: ['R1', 'GigabitEthernet0/2'], b: ['R2', 'GigabitEthernet0/1'] },
    { a: ['R2', 'GigabitEthernet0/2'], b: ['R3', 'GigabitEthernet0/1'] },
    { a: ['SRV0', 'eth0'], b: ['R0', 'FastEthernet0/1'] },
    { a: ['PC-DMZ', 'eth0'], b: ['R1', 'FastEthernet0/1'] },
    { a: ['PC3', 'eth0'], b: ['R3', 'FastEthernet0/1'] },
  ],
  initialConfig: {
    R0: `ip routing
${lan(10, '10.50.1.1')}
${routed('gi0/1', '10.9.0.2')}
ip route 0.0.0.0 0.0.0.0 10.9.0.1`,
    // fault: redistribute static without subnets; connected not redistributed
    R1: `ip routing
${lan(20, '172.16.5.1')}
${routed('gi0/1', '10.9.0.1')}
${routed('gi0/2', '10.0.12.1')}
ip route 10.50.1.0 255.255.255.0 10.9.0.2
router ospf 1
 router-id 1.1.1.1
 network 10.0.12.0 0.0.0.3 area 0
 redistribute static
exit`,
    R2: `ip routing
${routed('gi0/1', '10.0.12.2')}
${routed('gi0/2', '10.0.23.1')}
router ospf 1
 router-id 2.2.2.2
 network 10.0.12.0 0.0.0.3 area 0
 network 10.0.23.0 0.0.0.3 area 0
exit`,
    R3: `ip routing
${lan(30, '192.168.3.1')}
${routed('gi0/1', '10.0.23.2')}
router ospf 1
 router-id 3.3.3.3
 passive-interface vlan 30
 network 10.0.23.0 0.0.0.3 area 0
 network 192.168.3.0 0.0.0.255 area 0
exit`,
  },
  initialPcs: {
    SRV0: { ip: '10.50.1.10', prefix: 24, gw: '10.50.1.1' },
    'PC-DMZ': { ip: '172.16.5.10', prefix: 24, gw: '172.16.5.1' },
    PC3: { ip: '192.168.3.10', prefix: 24, gw: '192.168.3.1' },
  },
  objectives: [
    {
      id: 'static',
      title: 'R3\'te 10.50.1.0/24 O E2 olarak var',
      hint: 'R1: router ospf 1 → redistribute static subnets. subnets olmadan yalnız sınıflı ağlar aktarılır.',
      check: (q) => {
        const r = q.route('R3', '10.50.1.0', 24)
        return { ok: r?.code === 'O E2', detail: r ? r.code : 'rota yok' }
      },
    },
    {
      id: 'metric',
      title: 'Aktarılan statik rotanın metriği 50',
      hint: 'R1: redistribute static metric 50 subnets. Kontrol: R3\'te show ip route 10.50.1.0 → [110/50].',
      check: (q) => {
        const r = q.route('R3', '10.50.1.0', 24)
        return { ok: r?.code === 'O E2' && r.metric === 50, detail: r ? `metrik ${r.metric}` : 'rota yok' }
      },
    },
    {
      id: 'connected',
      title: 'DMZ (172.16.5.0/24) OSPF\'e eklenmeden R3\'te O E2',
      hint: 'R1: redistribute connected subnets. DMZ arayüzünü network satırıyla OSPF\'e eklersen rota O (alan içi) olur; istenen bu değil.',
      check: (q) => {
        const r = q.route('R3', '172.16.5.0', 24)
        const inOspf = !!q.ospf('R1')?.ifs.some((i) => i.name === 'Vlan20')
        return { ok: r?.code === 'O E2' && !inOspf, detail: inOspf ? 'Vlan20 OSPF\'te' : r ? r.code : 'rota yok' }
      },
    },
    {
      id: 'asbr',
      title: 'R1 ASBR',
      hint: 'show ip ospf → "It is an autonomous system boundary router". Aktarım yapan router ASBR olur.',
      check: (q) => !!q.ospf('R1')?.asbr,
    },
    {
      id: 'e2e',
      title: 'PC3 → SRV0 ve PC3 → PC-DMZ ping',
      hint: 'Gidiş E2 rotalarıyla R1\'e, R1 statik rotayla R0\'a; dönüş R0\'ın varsayılan rotası ve R1\'in OSPF rotasıyla.',
      check: (q) => q.ping('PC3', '10.50.1.10').ok && q.ping('PC3', '172.16.5.10').ok,
    },
  ],
  solution: {
    R1: `configure terminal
router ospf 1
 redistribute static metric 50 subnets
 redistribute connected subnets
end
write memory`,
  },
}

export default lab
