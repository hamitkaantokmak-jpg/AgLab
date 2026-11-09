// ENCOR 2 - VLAN/Trunk/EtherChannel/STP: error conditions, err-disable recovery, STP protection (PortFast + BPDU Guard).
import type { LabDef } from '../sim/types'
import { ports } from '../sim/util'

const EDGE = ['Fa0/1', 'Fa0/2', 'Fa0/3']

const lab: LabDef = {
  id: 'bpdu-guard',
  title: 'BPDU Guard, err-disable ve otomatik kurtarma',
  summary: 'Kullanıcı portuna takılan sahte bir switch root bridge\'i ele geçirmiş, uplink\'lerden biri yanlış koruma yüzünden err-disabled. Kenar portları koru, uplink\'i kurtar, otomatik recovery kur.',
  level: 'Orta',
  tags: ['ENCOR', 'STP', 'PortFast', 'BPDU Guard', 'err-disable'],
  brief: [
    'DSW1 dağıtım switch\'i VLAN 10\'un root bridge\'i olmalı (priority 4096). ASW1\'e iki uplink ile bağlı. PC1 ve PC2 ASW1\'in Fa0/1–2 portlarında.',
    'Bir kullanıcı Fa0/3\'e kendi küçük switch\'ini (ROGUE) takmış. ROGUE VLAN 10 için priority 0 ile geliyor ve root bridge oldu; bütün VLAN 10 trafiği artık onun üzerinden hesaplanıyor.',
    'Önceki bir değişiklikte ASW1 Gi0/2 uplink\'ine yanlışlıkla PortFast ve BPDU Guard yazılmış. Port DSW1\'den BPDU aldığı için err-disabled.',
    'Görevler: ASW1\'de Fa0/1–3 kenar portları PortFast + BPDU Guard ile korunsun (port başına ya da "spanning-tree portfast bpduguard default" ile). ROGUE\'un portu err-disable olmalı, DSW1 tekrar root olmalı.',
    'Gi0/2\'den PortFast ve BPDU Guard\'ı kaldır ve portu kurtar (shutdown / no shutdown). Son olarak err-disable olan portların 60 saniyede bir kendiliğinden denensin: errdisable recovery cause bpduguard, errdisable recovery interval 60.',
    'Kontrol: show interfaces status, show interfaces status err-disabled, show spanning-tree vlan 10, show errdisable recovery.',
  ],
  view: { w: 860, h: 520 },
  devices: [
    { id: 'DSW1', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0050.0001', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 430, y: 80 },
    { id: 'ASW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0050.0011', ports: ports('Fa0/1-4', 'Gi0/1-2'), x: 430, y: 270 },
    { id: 'ROGUE', kind: 'switch', model: 'WS-C2960-8TC-L', mac: '5254.0050.00ff', ports: ports('Fa0/1-4'), x: 730, y: 430 },
    { id: 'PC1', kind: 'pc', mac: '0050.7966.5001', x: 150, y: 440 },
    { id: 'PC2', kind: 'pc', mac: '0050.7966.5002', x: 430, y: 450 },
  ],
  links: [
    { a: ['DSW1', 'GigabitEthernet0/1'], b: ['ASW1', 'GigabitEthernet0/1'] },
    { a: ['DSW1', 'GigabitEthernet0/2'], b: ['ASW1', 'GigabitEthernet0/2'] },
    { a: ['PC1', 'eth0'], b: ['ASW1', 'FastEthernet0/1'] },
    { a: ['PC2', 'eth0'], b: ['ASW1', 'FastEthernet0/2'] },
    { a: ['ROGUE', 'FastEthernet0/1'], b: ['ASW1', 'FastEthernet0/3'] },
  ],
  initialConfig: {
    DSW1: `ip routing
vlan 10
 name KULLANICI
exit
spanning-tree vlan 10 priority 4096
interface range gi0/1 - 2
 switchport trunk encapsulation dot1q
 switchport mode trunk
exit
interface vlan 10
 ip address 192.168.10.1 255.255.255.0
exit`,
    ASW1: `vlan 10
 name KULLANICI
exit
interface range gi0/1 - 2
 switchport mode trunk
exit
interface gi0/2
 spanning-tree portfast
 spanning-tree bpduguard enable
exit
interface range fa0/1 - 3
 switchport mode access
 switchport access vlan 10
exit
interface range fa0/1 - 2
 spanning-tree portfast
exit`,
    ROGUE: `hostname ROGUE
vlan 10
exit
spanning-tree vlan 10 priority 0
interface fa0/1
 switchport mode access
 switchport access vlan 10
exit`,
  },
  initialPcs: {
    PC1: { ip: '192.168.10.11', prefix: 24, gw: '192.168.10.1' },
    PC2: { ip: '192.168.10.12', prefix: 24, gw: '192.168.10.1' },
  },
  objectives: [
    {
      id: 'edge',
      title: 'ASW1 Fa0/1–3: PortFast ve BPDU Guard etkin',
      hint: 'interface range fa0/1 - 3 → spanning-tree portfast → spanning-tree bpduguard enable. Ya da global: spanning-tree portfast bpduguard default (yalnızca PortFast portlara uygulanır).',
      check: (q) => {
        const c = q.cfg('ASW1')
        const bad = EDGE.filter((p) => {
          const pc = q.portCfg('ASW1', p)!
          const guard = pc.bpduguard ?? (!!c.bpduguardDefault && pc.portfast)
          return !pc.portfast || !guard
        })
        return { ok: !bad.length, detail: bad.length ? 'Eksik: ' + bad.join(', ') : undefined }
      },
    },
    {
      id: 'rogue',
      title: 'ROGUE\'un bağlı olduğu Fa0/3 err-disabled',
      hint: 'BPDU Guard açık bir port BPDU alınca err-disable olur. Kontrol: show interfaces status err-disabled',
      check: (q) => q.errDisabled('ASW1', 'Fa0/3'),
    },
    {
      id: 'root',
      title: 'VLAN 10\'un root bridge\'i DSW1',
      hint: 'ROGUE ağdan kopunca DSW1 (4096) en düşük bridge ID olur. Kontrol: show spanning-tree vlan 10',
      check: (q) => q.stpRoot(10) === 'DSW1',
    },
    {
      id: 'uplink',
      title: 'Gi0/2 uplink\'i PortFast/BPDU Guard\'sız, up ve trunk',
      hint: 'interface gi0/2 → no spanning-tree portfast → no spanning-tree bpduguard → shutdown → no shutdown. Switch\'ler arası portta PortFast olmaz.',
      check: (q) => {
        const pc = q.portCfg('ASW1', 'Gi0/2')!
        return !pc.portfast && !pc.bpduguard && !q.errDisabled('ASW1', 'Gi0/2') && q.isTrunk('ASW1', 'Gi0/2')
      },
    },
    {
      id: 'recovery',
      title: 'errdisable recovery: bpduguard, 60 saniye',
      hint: 'errdisable recovery cause bpduguard ve errdisable recovery interval 60. Sebep ortadan kalkmadıkça port tekrar err-disable olur. Kontrol: show errdisable recovery',
      check: (q) => !!q.cfg('ASW1').errRecoveryBpdu && q.cfg('ASW1').errRecoveryInterval === 60,
    },
    {
      id: 'ping',
      title: 'PC1 ve PC2 gateway\'e (192.168.10.1) ping atabiliyor',
      hint: 'Kenar portları err-disable olmamalı: PC\'ler BPDU göndermez.',
      check: (q) => q.ping('PC1', '192.168.10.1').ok && q.ping('PC2', '192.168.10.1').ok,
    },
  ],
  solution: {
    ASW1: `configure terminal
interface range fa0/1 - 3
 spanning-tree portfast
 spanning-tree bpduguard enable
exit
interface gi0/2
 no spanning-tree portfast
 no spanning-tree bpduguard
 shutdown
 no shutdown
exit
errdisable recovery cause bpduguard
errdisable recovery interval 60
end
write memory`,
  },
}

export default lab
