import type { LabDef } from '../sim/types'
import type { LabQuery } from '../sim/query'
import { ports } from '../sim/util'

const SW = ['SW1', 'SW2']
const PC_PORTS = ['Fa0/1', 'Fa0/2']
const UNUSED = ['Fa0/3', 'Fa0/4', 'Gi0/2']

const pingBoth = (q: LabQuery, a: string, b: string) =>
  q.ping(a, q.pcIp(b) ?? '0.0.0.0').ok && q.ping(b, q.pcIp(a) ?? '0.0.0.0').ok

const lab: LabDef = {
  id: 'trunk-guvenligi',
  title: 'Trunk ve port güvenliği (DTP)',
  summary: 'Varsayılan DTP ayarlarını kapat: statik trunk, nonegotiate, kullanılmayan native VLAN, park VLAN ve portfast.',
  level: 'Orta',
  tags: ['DTP', 'Native VLAN', 'Best practice', 'Portfast'],
  brief: [
    'İki switch fabrika ayarında. Tüm portlar "dynamic auto": iki uç da auto olduğu için aradaki link trunk olmadı ve bir saldırgan DTP ile trunk açabilir.',
    'VLAN 10 (KULLANICI), VLAN 998 (PARK) ve VLAN 999 (NATIVE) oluştur. PC portları VLAN 10\'da statik access olsun ve portfast açık olsun.',
    'Gi0/1 linki iki uçta statik trunk olsun, DTP kapalı olsun (switchport nonegotiate), native VLAN 999 olsun ve yalnızca VLAN 10 taşınsın.',
    'Kullanılmayan portlar (Fa0/3, Fa0/4, Gi0/2) access modda, VLAN 998\'de ve kapalı olsun.',
    'Not: nonegotiate yalnızca access veya trunk modda kabul edilir. dynamic moddayken "Conflict between \'nonegotiate\' and \'dynamic\' status" hatası alırsın.',
  ],
  view: { w: 760, h: 400 },
  devices: [
    { id: 'SW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0002.0001', ports: ports('Fa0/1-4', 'Gi0/1-2'), x: 210, y: 130 },
    { id: 'SW2', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0002.0002', ports: ports('Fa0/1-4', 'Gi0/1-2'), x: 550, y: 130 },
    { id: 'PC1', kind: 'pc', mac: '0050.7966.0201', x: 110, y: 320 },
    { id: 'PC3', kind: 'pc', mac: '0050.7966.0203', x: 300, y: 320 },
    { id: 'PC2', kind: 'pc', mac: '0050.7966.0202', x: 460, y: 320 },
    { id: 'PC4', kind: 'pc', mac: '0050.7966.0204', x: 650, y: 320 },
  ],
  links: [
    { a: ['SW1', 'GigabitEthernet0/1'], b: ['SW2', 'GigabitEthernet0/1'] },
    { a: ['PC1', 'eth0'], b: ['SW1', 'FastEthernet0/1'] },
    { a: ['PC3', 'eth0'], b: ['SW1', 'FastEthernet0/2'] },
    { a: ['PC2', 'eth0'], b: ['SW2', 'FastEthernet0/1'] },
    { a: ['PC4', 'eth0'], b: ['SW2', 'FastEthernet0/2'] },
  ],
  initialPcs: {
    PC1: { ip: '10.10.10.11', prefix: 24, gw: null },
    PC3: { ip: '10.10.10.13', prefix: 24, gw: null },
    PC2: { ip: '10.10.10.12', prefix: 24, gw: null },
    PC4: { ip: '10.10.10.14', prefix: 24, gw: null },
  },
  objectives: [
    {
      id: 'vlans',
      title: 'VLAN 10 (KULLANICI), 998 (PARK), 999 (NATIVE) iki switch\'te var',
      hint: 'vlan 10 → name KULLANICI, vlan 998 → name PARK, vlan 999 → name NATIVE',
      check: (q) => SW.every((s) => q.vlanName(s, 10) === 'KULLANICI' && q.vlanName(s, 998) === 'PARK' && q.vlanName(s, 999) === 'NATIVE'),
    },
    {
      id: 'static-trunk',
      title: 'Gi0/1 iki uçta statik trunk ve DTP kapalı',
      hint: 'switchport mode trunk → switchport nonegotiate. show interfaces switchport → "Negotiation of Trunking: Off"',
      check: (q) =>
        SW.every((s) => q.portCfg(s, 'Gi0/1')?.mode === 'trunk' && q.portCfg(s, 'Gi0/1')?.nonegotiate && q.isTrunk(s, 'Gi0/1')),
    },
    {
      id: 'native',
      title: 'Native VLAN 999, trunk yalnızca VLAN 10\'u taşıyor',
      hint: 'switchport trunk native vlan 999 + switchport trunk allowed vlan 10. İki uç aynı olmalı.',
      check: (q) =>
        q.nativeMismatches().length === 0 &&
        SW.every((s) => {
          const c = q.portCfg(s, 'Gi0/1')
          return c?.nativeVlan === 999 && c.allowed?.join(',') === '10' && q.trunkAllows(s, 'Gi0/1', 10)
        }),
    },
    {
      id: 'access',
      title: 'PC portları VLAN 10\'da statik access, portfast açık',
      hint: 'interface range fa0/1 - 2 → switchport mode access → switchport access vlan 10 → spanning-tree portfast',
      check: (q) =>
        SW.every((s) =>
          PC_PORTS.every((p) => {
            const c = q.portCfg(s, p)
            return c?.mode === 'access' && c.accessVlan === 10 && c.portfast
          }),
        ),
    },
    {
      id: 'parked',
      title: 'Kullanılmayan portlar VLAN 998\'de ve kapalı',
      hint: 'interface range fa0/3 - 4, gi0/2 → switchport mode access → switchport access vlan 998 → shutdown',
      check: (q) => {
        const bad = SW.flatMap((s) =>
          UNUSED.filter((p) => {
            const c = q.portCfg(s, p)
            return !(c?.mode === 'access' && c.accessVlan === 998 && c.shutdown)
          }).map((p) => `${s} ${p}`),
        )
        return { ok: !bad.length, detail: bad.length ? 'Sorunlu: ' + bad.join(', ') : undefined }
      },
    },
    {
      id: 'ping',
      title: 'Dört PC birbirine ping atabiliyor (VLAN 10)',
      hint: 'Trunk VLAN 10\'u taşıyorsa PC1 → PC2 çalışır. PC konsolunda: ping 10.10.10.12',
      check: (q) => ['PC1', 'PC2', 'PC3', 'PC4'].every((p) => q.pcVlan(p) === 10) && pingBoth(q, 'PC1', 'PC2') && pingBoth(q, 'PC3', 'PC4'),
    },
  ],
  solution: Object.fromEntries(
    SW.map((s) => [
      s,
      `configure terminal
vlan 10
 name KULLANICI
vlan 998
 name PARK
vlan 999
 name NATIVE
exit
interface range fa0/1 - 2
 switchport mode access
 switchport access vlan 10
 spanning-tree portfast
interface range fa0/3 - 4, gi0/2
 switchport mode access
 switchport access vlan 998
 shutdown
interface gi0/1
 switchport mode trunk
 switchport nonegotiate
 switchport trunk native vlan 999
 switchport trunk allowed vlan 10
end
write memory`,
    ]),
  ),
}

export default lab
