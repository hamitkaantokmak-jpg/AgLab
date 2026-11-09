import type { LabDef } from '../sim/types'
import type { LabQuery } from '../sim/query'
import { ports } from '../sim/util'

const pingBoth = (q: LabQuery, a: string, b: string) =>
  q.ping(a, q.pcIp(b) ?? '0.0.0.0').ok && q.ping(b, q.pcIp(a) ?? '0.0.0.0').ok

const svi = (q: LabQuery, dev: string, vlan: number, addr: string, mask: string) => {
  const s = q.cfg(dev).svis[String(vlan)]
  return !!s?.ip && s.ip.addr === addr && s.ip.mask === mask && q.sviUp(dev, vlan)
}

const lab: LabDef = {
  id: 'l3-statik-route',
  title: 'İki L3 switch arasında statik yönlendirme',
  summary: 'İki çok katmanlı switch\'i /30 transit VLAN ile bağla, SVI\'ları kur ve statik + varsayılan rota ile uçtan uca ulaşım sağla.',
  level: 'İleri',
  tags: ['L3 switch', 'SVI', 'Static route', 'Default route'],
  brief: [
    'SW1 ve SW2 Catalyst 3560 (L3). İkisi de fabrika ayarında. PC\'lerin IP ve gateway\'leri hazır.',
    'SW1: VLAN 10 (PC1) ve VLAN 100 (TRANSIT). Vlan10 = 192.168.10.1/24, Vlan100 = 10.0.100.1/30.',
    'SW2: VLAN 20 (PC2), VLAN 30 (PC3) ve VLAN 100. Vlan20 = 192.168.20.1/24, Vlan30 = 172.16.30.1/24, Vlan100 = 10.0.100.2/30.',
    'Gi0/1 transit linki iki uçta VLAN 100\'de access port olsun. İki switch\'te de ip routing açık olsun.',
    'Rotalar: SW1 uzak ağların hepsine tek bir varsayılan rota (0.0.0.0/0) ile gitsin. SW2, 192.168.10.0/24 için statik rota kullansın. Kontrol: show ip route, PC\'den trace.',
  ],
  view: { w: 820, h: 440 },
  devices: [
    { id: 'SW1', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0005.0001', ports: ports('Fa0/1-4', 'Gi0/1-2'), l3: true, needsEncap: true, x: 240, y: 130 },
    { id: 'SW2', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0005.0002', ports: ports('Fa0/1-4', 'Gi0/1-2'), l3: true, needsEncap: true, x: 580, y: 130 },
    { id: 'PC1', kind: 'pc', mac: '0050.7966.0501', x: 240, y: 360 },
    { id: 'PC2', kind: 'pc', mac: '0050.7966.0502', x: 480, y: 360 },
    { id: 'PC3', kind: 'pc', mac: '0050.7966.0503', x: 690, y: 360 },
  ],
  links: [
    { a: ['SW1', 'GigabitEthernet0/1'], b: ['SW2', 'GigabitEthernet0/1'] },
    { a: ['PC1', 'eth0'], b: ['SW1', 'FastEthernet0/1'] },
    { a: ['PC2', 'eth0'], b: ['SW2', 'FastEthernet0/1'] },
    { a: ['PC3', 'eth0'], b: ['SW2', 'FastEthernet0/2'] },
  ],
  initialPcs: {
    PC1: { ip: '192.168.10.10', prefix: 24, gw: '192.168.10.1' },
    PC2: { ip: '192.168.20.10', prefix: 24, gw: '192.168.20.1' },
    PC3: { ip: '172.16.30.10', prefix: 24, gw: '172.16.30.1' },
  },
  objectives: [
    {
      id: 'routing',
      title: 'İki switch\'te de ip routing açık',
      hint: 'configure terminal → ip routing. Kapalıyken switch yalnızca kendi SVI\'larına cevap verir, yönlendirme yapmaz.',
      check: (q) => q.cfg('SW1').ipRouting && q.cfg('SW2').ipRouting,
    },
    {
      id: 'svis',
      title: 'Tüm SVI\'lar doğru adresle up/up',
      hint: 'SVI\'ın up olması için VLAN\'ın var olması ve o VLAN\'da aktif bir port bulunması gerekir. show ip interface brief',
      check: (q) => {
        const want: [string, number, string, string][] = [
          ['SW1', 10, '192.168.10.1', '255.255.255.0'],
          ['SW1', 100, '10.0.100.1', '255.255.255.252'],
          ['SW2', 20, '192.168.20.1', '255.255.255.0'],
          ['SW2', 30, '172.16.30.1', '255.255.255.0'],
          ['SW2', 100, '10.0.100.2', '255.255.255.252'],
        ]
        const bad = want.filter(([d, v, a, m]) => !svi(q, d, v, a, m)).map(([d, v]) => `${d} Vlan${v}`)
        return { ok: !bad.length, detail: bad.length ? 'Eksik/down: ' + bad.join(', ') : undefined }
      },
    },
    {
      id: 'transit',
      title: 'SW1, transit üzerinden 10.0.100.2\'ye ping atabiliyor',
      hint: 'Gi0/1 iki uçta: switchport mode access + switchport access vlan 100. SW1\'de: ping 10.0.100.2',
      check: (q) => q.ping('SW1', '10.0.100.2').ok,
    },
    {
      id: 'default',
      title: 'SW1\'de varsayılan rota 10.0.100.2\'ye, SW2\'de 192.168.10.0/24 statik rotası var',
      hint: 'SW1: ip route 0.0.0.0 0.0.0.0 10.0.100.2. SW2: ip route 192.168.10.0 255.255.255.0 10.0.100.1',
      check: (q) =>
        q.cfg('SW1').routes.some((r) => r.net === '0.0.0.0' && r.mask === '0.0.0.0' && r.nh === '10.0.100.2') &&
        q.cfg('SW2').routes.some((r) => r.net === '192.168.10.0' && r.mask === '255.255.255.0' && r.nh === '10.0.100.1'),
    },
    {
      id: 'local',
      title: 'SW2 üzerinde PC2 ↔ PC3 ping (VLAN\'lar arası)',
      hint: 'Aynı switch\'teki iki SVI arasında yönlendirme için ip routing yeterli.',
      check: (q) => pingBoth(q, 'PC2', 'PC3'),
    },
    {
      id: 'e2e',
      title: 'PC1 ↔ PC2 ve PC1 ↔ PC3 ping (iki router üzerinden)',
      hint: 'Dönüş yolunu unutma: SW2 192.168.10.0/24\'e nasıl gideceğini bilmeli. PC1\'de: trace 172.16.30.10',
      check: (q) => pingBoth(q, 'PC1', 'PC2') && pingBoth(q, 'PC1', 'PC3'),
    },
  ],
  solution: {
    SW1: `configure terminal
ip routing
vlan 10
 name LAN10
vlan 100
 name TRANSIT
exit
interface fa0/1
 switchport mode access
 switchport access vlan 10
interface gi0/1
 switchport mode access
 switchport access vlan 100
interface vlan 10
 ip address 192.168.10.1 255.255.255.0
interface vlan 100
 ip address 10.0.100.1 255.255.255.252
exit
ip route 0.0.0.0 0.0.0.0 10.0.100.2
end
write memory`,
    SW2: `configure terminal
ip routing
vlan 20
 name LAN20
vlan 30
 name LAN30
vlan 100
 name TRANSIT
exit
interface fa0/1
 switchport mode access
 switchport access vlan 20
interface fa0/2
 switchport mode access
 switchport access vlan 30
interface gi0/1
 switchport mode access
 switchport access vlan 100
interface vlan 20
 ip address 192.168.20.1 255.255.255.0
interface vlan 30
 ip address 172.16.30.1 255.255.255.0
interface vlan 100
 ip address 10.0.100.2 255.255.255.252
exit
ip route 192.168.10.0 255.255.255.0 10.0.100.1
end
write memory`,
  },
}

export default lab
