import type { LabDef } from '../sim/types'
import type { LabQuery } from '../sim/query'
import { ports } from '../sim/util'

const pingBoth = (q: LabQuery, a: string, b: string) =>
  q.ping(a, q.pcIp(b) ?? '0.0.0.0').ok && q.ping(b, q.pcIp(a) ?? '0.0.0.0').ok

const vlans = `vlan 10
 name SATIS
vlan 20
 name DEPO
exit`

const accessPorts = `interface fa0/1
 switchport mode access
 switchport access vlan 10
interface fa0/2
 switchport mode access
 switchport access vlan 20
exit`

const bundle = (q: LabQuery, a: string, b: string, id: number) => {
  const x = q.etherchannel(a, id)
  const y = q.etherchannel(b, id)
  return {
    ok: !!x && !!y && x.up && y.up && x.bundled === 2 && y.bundled === 2 && x.protocol === 'LACP' && y.protocol === 'LACP',
    detail: `${a} Po${id}: ${x ? `${x.protocol}, ${x.bundled} üye` : 'yok'} · ${b} Po${id}: ${y ? `${y.protocol}, ${y.bundled} üye` : 'yok'}`,
  }
}

const lab: LabDef = {
  id: 'etherchannel-ariza',
  title: 'Arıza bul: EtherChannel kurulmuyor',
  summary: 'İki port-channel\'ın hiçbiri kurulmamış. Mod, protokol ve üye config uyumsuzluklarını bul.',
  level: 'Orta',
  tags: ['EtherChannel', 'LACP', 'PAgP', 'Troubleshooting'],
  brief: [
    'SW1–SW2 arasındaki iki link Port-channel 1, SW1–SW3 arasındaki iki link Port-channel 2 olmalı. İkisi de LACP kullanmalı.',
    'PC\'ler şu an birbirine ping atabiliyor, çünkü bundle kurulmayınca linkler tek tek trunk olarak çalışıyor. STP de her çiftte bir linki blokluyor, yani bant genişliğinin yarısı boşa gidiyor.',
    'Üç ayrı hata var. show etherchannel summary çıktısındaki bayraklara bak: (P) bundle\'da, (I) tek başına, (s) askıya alınmış.',
    'Not: Bir gruptaki portların protokolü (LACP / PAgP) aynı olmalı. Protokolü değiştirmek için önce iki porttan da "no channel-group" ile çıkar. Üye portun config\'i port-channel\'ınkiyle aynı değilse port askıya alınır; port-channel arayüzündeki switchport komutları üyelere de uygulanır.',
  ],
  view: { w: 820, h: 480 },
  devices: [
    { id: 'SW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0004.0001', ports: ports('Fa0/1-4', 'Gi0/1-4'), x: 410, y: 70 },
    { id: 'SW2', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0004.0002', ports: ports('Fa0/1-4', 'Gi0/1-4'), x: 160, y: 300 },
    { id: 'SW3', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0004.0003', ports: ports('Fa0/1-4', 'Gi0/1-4'), x: 660, y: 300 },
    { id: 'PC1', kind: 'pc', mac: '0050.7966.0401', x: 70, y: 430 },
    { id: 'PC3', kind: 'pc', mac: '0050.7966.0403', x: 260, y: 430 },
    { id: 'PC2', kind: 'pc', mac: '0050.7966.0402', x: 560, y: 430 },
    { id: 'PC4', kind: 'pc', mac: '0050.7966.0404', x: 750, y: 430 },
  ],
  links: [
    { a: ['SW1', 'GigabitEthernet0/1'], b: ['SW2', 'GigabitEthernet0/1'] },
    { a: ['SW1', 'GigabitEthernet0/2'], b: ['SW2', 'GigabitEthernet0/2'] },
    { a: ['SW1', 'GigabitEthernet0/3'], b: ['SW3', 'GigabitEthernet0/1'] },
    { a: ['SW1', 'GigabitEthernet0/4'], b: ['SW3', 'GigabitEthernet0/2'] },
    { a: ['PC1', 'eth0'], b: ['SW2', 'FastEthernet0/1'] },
    { a: ['PC3', 'eth0'], b: ['SW2', 'FastEthernet0/2'] },
    { a: ['PC2', 'eth0'], b: ['SW3', 'FastEthernet0/1'] },
    { a: ['PC4', 'eth0'], b: ['SW3', 'FastEthernet0/2'] },
  ],
  initialPcs: {
    PC1: { ip: '10.4.10.11', prefix: 24, gw: null },
    PC2: { ip: '10.4.10.12', prefix: 24, gw: null },
    PC3: { ip: '10.4.20.11', prefix: 24, gw: null },
    PC4: { ip: '10.4.20.12', prefix: 24, gw: null },
  },
  initialConfig: {
    SW1: `${vlans}
interface range gi0/1 - 2
 switchport mode trunk
 switchport trunk allowed vlan 10,20
 channel-group 1 mode passive
interface range gi0/3 - 4
 switchport mode trunk
 switchport trunk allowed vlan 10,20
 channel-group 2 mode active
interface gi0/4
 switchport trunk allowed vlan 10
exit`,
    SW2: `${vlans}
${accessPorts}
interface range gi0/1 - 2
 switchport mode trunk
 switchport trunk allowed vlan 10,20
 channel-group 1 mode passive
exit`,
    SW3: `${vlans}
${accessPorts}
interface range gi0/1 - 2
 switchport mode trunk
 switchport trunk allowed vlan 10,20
 channel-group 2 mode desirable
exit`,
  },
  objectives: [
    {
      id: 'po1',
      title: 'SW1–SW2: Port-channel 1 LACP ile kurulu (2 üye)',
      hint: 'İki uç da passive ise LACP hiç başlamaz. En az bir uç active olmalı.',
      check: (q) => bundle(q, 'SW1', 'SW2', 1),
    },
    {
      id: 'po2',
      title: 'SW1–SW3: Port-channel 2 LACP ile kurulu (2 üye)',
      hint: 'SW3 PAgP (desirable) kullanıyor, SW1 LACP. SW1\'de Gi0/4\'ün allowed listesi de farklı (show run interface gi0/4).',
      check: (q) => bundle(q, 'SW1', 'SW3', 2),
    },
    {
      id: 'nostray',
      title: 'Askıda (s) veya tek başına (I) üye port yok',
      hint: 'Üç switch\'te de show etherchannel summary → tüm üyeler (P) olmalı.',
      check: (q) => {
        const bad = Object.values(q.d.ec)
          .flat()
          .flatMap((g) => g.members.filter((m) => m.flag !== 'P').map((m) => `${g.dev} ${m.port.replace('GigabitEthernet', 'Gi')}(${m.flag})`))
        return { ok: !bad.length, detail: bad.length ? bad.join(', ') : undefined }
      },
    },
    {
      id: 'stp',
      title: 'STP hiçbir uplink\'i bloklamıyor (VLAN 10 ve 20)',
      hint: 'Bundle kurulunca iki fiziksel link STP için tek mantıksal port olur. show spanning-tree vlan 10',
      check: (q) =>
        [10, 20].every((v) =>
          [
            ['SW2', 'Gi0/1'],
            ['SW2', 'Gi0/2'],
            ['SW3', 'Gi0/1'],
            ['SW3', 'Gi0/2'],
          ].every(([s, p]) => q.stpState(s!, p!, v) === 'FWD'),
        ),
    },
    {
      id: 'ping',
      title: 'PC1 ↔ PC2 (VLAN 10) ve PC3 ↔ PC4 (VLAN 20) ping',
      hint: 'Trafik SW2 → Po1 → SW1 → Po2 → SW3 yolundan geçer.',
      check: (q) => pingBoth(q, 'PC1', 'PC2') && pingBoth(q, 'PC3', 'PC4'),
    },
  ],
  solution: {
    SW1: `configure terminal
interface range gi0/1 - 2
 channel-group 1 mode active
interface port-channel 2
 switchport trunk allowed vlan 10,20
end
write memory`,
    SW3: `configure terminal
interface range gi0/1 - 2
 no channel-group
 channel-group 2 mode active
end
write memory`,
  },
}

export default lab
