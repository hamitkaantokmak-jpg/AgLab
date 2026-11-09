import type { LabDef } from '../sim/types'
import type { LabQuery } from '../sim/query'
import { ports } from '../sim/util'

const pingBoth = (q: LabQuery, a: string, b: string) =>
  q.ping(a, q.pcIp(b) ?? '0.0.0.0').ok && q.ping(b, q.pcIp(a) ?? '0.0.0.0').ok

const lab: LabDef = {
  id: 'ariza-trunk',
  title: 'Arıza bul: Bozuk trunk',
  summary: 'Önceden yapılandırılmış iki switch\'te dört hata var. show komutlarıyla bul ve düzelt.',
  level: 'Başlangıç',
  tags: ['Troubleshooting', 'VLAN', 'Trunk', 'Native VLAN'],
  brief: [
    'SWA ve SWB arasındaki Gi0/1 linki trunk. VLAN 10 (OFIS) ve VLAN 30 (KAMERA) iki switch\'e de yayılmalı.',
    'PC1 ↔ PC2 (VLAN 10) ve PC3 ↔ PC4 (VLAN 30) birbirine ping atabilmeli. Şu an ikisi de çalışmıyor.',
    'Trunk yalnızca VLAN 10 ve 30\'u taşısın ve iki uçta native VLAN aynı olsun. Routing yok; PC\'ler yalnızca kendi VLAN\'larıyla konuşur.',
    'İpucu: show vlan brief, show interfaces trunk, show interfaces status ve syslog paneli yeterli.',
  ],
  view: { w: 760, h: 440 },
  devices: [
    { id: 'SWA', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.00aa.0001', ports: ports('Fa0/1-4', 'Gi0/1-2'), x: 200, y: 140 },
    { id: 'SWB', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.00aa.0002', ports: ports('Fa0/1-4', 'Gi0/1-2'), x: 560, y: 140 },
    { id: 'PC1', kind: 'pc', mac: '0050.7966.6a01', x: 100, y: 360 },
    { id: 'PC3', kind: 'pc', mac: '0050.7966.6a03', x: 290, y: 360 },
    { id: 'PC2', kind: 'pc', mac: '0050.7966.6a02', x: 470, y: 360 },
    { id: 'PC4', kind: 'pc', mac: '0050.7966.6a04', x: 660, y: 360 },
  ],
  links: [
    { a: ['SWA', 'GigabitEthernet0/1'], b: ['SWB', 'GigabitEthernet0/1'] },
    { a: ['PC1', 'eth0'], b: ['SWA', 'FastEthernet0/1'] },
    { a: ['PC3', 'eth0'], b: ['SWA', 'FastEthernet0/2'] },
    { a: ['PC2', 'eth0'], b: ['SWB', 'FastEthernet0/1'] },
    { a: ['PC4', 'eth0'], b: ['SWB', 'FastEthernet0/2'] },
  ],
  initialPcs: {
    PC1: { ip: '10.0.10.11', prefix: 24, gw: null },
    PC2: { ip: '10.0.10.12', prefix: 24, gw: null },
    PC3: { ip: '10.0.30.11', prefix: 24, gw: null },
    PC4: { ip: '10.0.30.12', prefix: 24, gw: null },
  },
  initialConfig: {
    SWA: `vlan 10
 name OFIS
vlan 30
 name KAMERA
exit
interface fa0/1
 switchport mode access
 switchport access vlan 10
interface fa0/2
 switchport mode access
 switchport access vlan 30
interface gi0/1
 switchport mode trunk
 switchport trunk allowed vlan 10,30
exit`,
    SWB: `vlan 10
 name OFIS
exit
interface fa0/1
 switchport mode access
 switchport access vlan 20
interface fa0/2
 switchport mode access
 switchport access vlan 30
interface gi0/1
 switchport mode trunk
 switchport trunk native vlan 99
 switchport trunk allowed vlan 10
exit`,
  },
  objectives: [
    {
      id: 'vlans',
      title: 'VLAN 10 (OFIS) ve 30 (KAMERA) iki switch\'te de var',
      hint: 'show vlan brief ile karşılaştır. Eksik VLAN\'a atanan port "inactive" görünür.',
      check: (q) => ['SWA', 'SWB'].every((s) => q.vlanName(s, 10) === 'OFIS' && q.vlanName(s, 30) === 'KAMERA'),
    },
    {
      id: 'access',
      title: 'PC1/PC2 VLAN 10\'da, PC3/PC4 VLAN 30\'da',
      hint: 'show interfaces status ile PC portlarının VLAN sütununa bak.',
      check: (q) => q.pcVlan('PC1') === 10 && q.pcVlan('PC2') === 10 && q.pcVlan('PC3') === 30 && q.pcVlan('PC4') === 30,
    },
    {
      id: 'native',
      title: 'Trunk\'ın iki ucunda native VLAN aynı',
      hint: 'Syslog\'da CDP-4-NATIVE_VLAN_MISMATCH var mı? show interfaces trunk → Native vlan sütunu.',
      check: (q) => q.isTrunk('SWA', 'Gi0/1') && q.isTrunk('SWB', 'Gi0/1') && q.nativeMismatches().length === 0,
    },
    {
      id: 'allowed',
      title: 'Trunk iki uçta da yalnızca VLAN 10 ve 30\'u taşıyor',
      hint: 'show interfaces trunk → "Vlans allowed on trunk". switchport trunk allowed vlan add 30',
      check: (q) =>
        ['SWA', 'SWB'].every((s) => {
          const lp = q.port(s, 'Gi0/1')
          return !!lp && lp.cfg.allowed?.join(',') === '10,30' && q.trunkAllows(s, 'Gi0/1', 10) && q.trunkAllows(s, 'Gi0/1', 30)
        }),
    },
    {
      id: 'ping',
      title: 'PC1 ↔ PC2 ve PC3 ↔ PC4 ping',
      hint: 'Önceki hedefler tamamsa ping de çalışmalı. PC konsolunda: ping 10.0.10.12',
      check: (q) => pingBoth(q, 'PC1', 'PC2') && pingBoth(q, 'PC3', 'PC4'),
    },
  ],
  solution: {
    SWB: `configure terminal
vlan 30
 name KAMERA
exit
interface fa0/1
 switchport access vlan 10
interface gi0/1
 no switchport trunk native vlan
 switchport trunk allowed vlan add 30
end
write memory`,
  },
}

export default lab
