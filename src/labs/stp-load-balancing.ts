import type { LabDef } from '../sim/types'
import type { LabQuery } from '../sim/query'
import { ports } from '../sim/util'

const ALL = ['DSW1', 'DSW2', 'ASW1', 'ASW2']
const ACCESS = ['ASW1', 'ASW2']

const pingBoth = (q: LabQuery, a: string, b: string) =>
  q.ping(a, q.pcIp(b) ?? '0.0.0.0').ok && q.ping(b, q.pcIp(a) ?? '0.0.0.0').ok

const trunks = (list: string) => `interface range ${list}
 switchport mode trunk
 switchport trunk allowed vlan 10,20
exit`

const vlans = `vlan 10
 name SES
vlan 20
 name VERI
exit`

const lab: LabDef = {
  id: 'stp-yuk-dengeleme',
  title: 'STP: root seçimi ve VLAN başına yük dengeleme',
  summary: 'Yanlış switch root olmuş. Root ve yedek root\'u VLAN başına ayarla, trafiği iki dağıtım switch\'ine böl.',
  level: 'Orta',
  tags: ['STP', 'Rapid PVST+', 'Root bridge', 'Portfast'],
  brief: [
    'DSW1 ve DSW2 dağıtım, ASW1 ve ASW2 erişim switch\'leri. Trunk\'lar ve VLAN\'lar hazır. Ağ çalışıyor ama MAC adresi en düşük olduğu için ASW1 her VLAN\'da root bridge.',
    'Tüm switch\'leri Rapid PVST+ moduna al.',
    'DSW1 VLAN 10 için root, VLAN 20 için yedek root olsun. DSW2 VLAN 20 için root, VLAN 10 için yedek root olsun.',
    'Sonuçta her erişim switch\'i VLAN 10\'u DSW1 uplink\'inden (Gi0/1), VLAN 20\'yi DSW2 uplink\'inden (Gi0/2) iletmeli; diğer uplink o VLAN için bloklanmalı.',
    'Erişim switch\'lerinde PC portlarına portfast aç. İpucu: yedek root ayarlamazsan tie-breaker MAC adresi olur ve yük dengeleme bozulabilir. "STP görünümü" ile VLAN seçip bloklanan portları izle.',
  ],
  view: { w: 820, h: 500 },
  devices: [
    { id: 'DSW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0003.0010', ports: ports('Fa0/1-4', 'Gi0/1-4'), x: 230, y: 80 },
    { id: 'DSW2', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0003.0011', ports: ports('Fa0/1-4', 'Gi0/1-4'), x: 590, y: 80 },
    { id: 'ASW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0003.0001', ports: ports('Fa0/1-4', 'Gi0/1-4'), x: 150, y: 300 },
    { id: 'ASW2', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0003.0002', ports: ports('Fa0/1-4', 'Gi0/1-4'), x: 670, y: 300 },
    { id: 'PC1', kind: 'pc', mac: '0050.7966.0301', x: 70, y: 450 },
    { id: 'PC2', kind: 'pc', mac: '0050.7966.0302', x: 250, y: 450 },
    { id: 'PC3', kind: 'pc', mac: '0050.7966.0303', x: 570, y: 450 },
    { id: 'PC4', kind: 'pc', mac: '0050.7966.0304', x: 750, y: 450 },
  ],
  links: [
    { a: ['DSW1', 'GigabitEthernet0/1'], b: ['DSW2', 'GigabitEthernet0/1'] },
    { a: ['DSW1', 'GigabitEthernet0/2'], b: ['ASW1', 'GigabitEthernet0/1'] },
    { a: ['DSW1', 'GigabitEthernet0/3'], b: ['ASW2', 'GigabitEthernet0/1'] },
    { a: ['DSW2', 'GigabitEthernet0/2'], b: ['ASW1', 'GigabitEthernet0/2'] },
    { a: ['DSW2', 'GigabitEthernet0/3'], b: ['ASW2', 'GigabitEthernet0/2'] },
    { a: ['PC1', 'eth0'], b: ['ASW1', 'FastEthernet0/1'] },
    { a: ['PC2', 'eth0'], b: ['ASW1', 'FastEthernet0/2'] },
    { a: ['PC3', 'eth0'], b: ['ASW2', 'FastEthernet0/1'] },
    { a: ['PC4', 'eth0'], b: ['ASW2', 'FastEthernet0/2'] },
  ],
  initialPcs: {
    PC1: { ip: '10.1.10.11', prefix: 24, gw: null },
    PC2: { ip: '10.1.20.11', prefix: 24, gw: null },
    PC3: { ip: '10.1.10.12', prefix: 24, gw: null },
    PC4: { ip: '10.1.20.12', prefix: 24, gw: null },
  },
  initialConfig: {
    DSW1: `${vlans}\n${trunks('gi0/1 - 3')}`,
    DSW2: `${vlans}\n${trunks('gi0/1 - 3')}`,
    ASW1: `${vlans}\n${trunks('gi0/1 - 2')}
interface fa0/1
 switchport mode access
 switchport access vlan 10
interface fa0/2
 switchport mode access
 switchport access vlan 20
exit`,
    ASW2: `${vlans}\n${trunks('gi0/1 - 2')}
interface fa0/1
 switchport mode access
 switchport access vlan 10
interface fa0/2
 switchport mode access
 switchport access vlan 20
exit`,
  },
  objectives: [
    {
      id: 'mode',
      title: 'Dört switch de Rapid PVST+ modunda',
      hint: 'configure terminal → spanning-tree mode rapid-pvst. show spanning-tree → "protocol rstp"',
      check: (q) => {
        const bad = ALL.filter((s) => q.cfg(s).stpMode !== 'rapid-pvst')
        return { ok: !bad.length, detail: bad.length ? 'Hâlâ pvst: ' + bad.join(', ') : undefined }
      },
    },
    {
      id: 'roots',
      title: 'VLAN 10 root: DSW1, VLAN 20 root: DSW2',
      hint: 'DSW1: spanning-tree vlan 10 root primary. DSW2: spanning-tree vlan 20 root primary.',
      check: (q) => {
        const r10 = q.stpRoot(10)
        const r20 = q.stpRoot(20)
        return { ok: r10 === 'DSW1' && r20 === 'DSW2', detail: `VLAN 10 root: ${r10 ?? '-'}, VLAN 20 root: ${r20 ?? '-'}` }
      },
    },
    {
      id: 'secondary',
      title: 'Yedek root: VLAN 10 için DSW2, VLAN 20 için DSW1',
      hint: 'DSW2: spanning-tree vlan 10 root secondary (priority 28672). Yedek root, erişim switch\'lerinden düşük priority\'ye sahip olmalı.',
      check: (q) => {
        const second = (v: number, want: string, root: string) => {
          const p = q.bridgePriority(want, v)
          if (p === null) return false
          return ALL.filter((s) => s !== want && s !== root).every((s) => (q.bridgePriority(s, v) ?? Infinity) > p)
        }
        return second(10, 'DSW2', 'DSW1') && second(20, 'DSW1', 'DSW2')
      },
    },
    {
      id: 'balance',
      title: 'Erişim switch\'leri: VLAN 10 Gi0/1\'den, VLAN 20 Gi0/2\'den akıyor',
      hint: 'show spanning-tree vlan 10 (ASW1\'de): Gi0/1 Root FWD, Gi0/2 Altn BLK olmalı. VLAN 20 için tersi.',
      check: (q) => {
        const bad: string[] = []
        for (const s of ACCESS) {
          if (q.stpState(s, 'Gi0/1', 10) !== 'FWD' || q.stpState(s, 'Gi0/2', 10) !== 'BLK') bad.push(`${s} v10`)
          if (q.stpState(s, 'Gi0/2', 20) !== 'FWD' || q.stpState(s, 'Gi0/1', 20) !== 'BLK') bad.push(`${s} v20`)
        }
        return { ok: !bad.length, detail: bad.length ? 'Beklenmeyen: ' + bad.join(', ') : undefined }
      },
    },
    {
      id: 'portfast',
      title: 'ASW1 ve ASW2\'de PC portlarında portfast açık',
      hint: 'interface range fa0/1 - 2 → spanning-tree portfast',
      check: (q) => ACCESS.every((s) => ['Fa0/1', 'Fa0/2'].every((p) => q.portCfg(s, p)?.portfast)),
    },
    {
      id: 'ping',
      title: 'PC1 ↔ PC3 (VLAN 10) ve PC2 ↔ PC4 (VLAN 20) ping',
      hint: 'STP değişikliği bağlantıyı koparmamalı. PC1 konsolunda: ping 10.1.10.12',
      check: (q) => pingBoth(q, 'PC1', 'PC3') && pingBoth(q, 'PC2', 'PC4'),
    },
  ],
  solution: {
    DSW1: `configure terminal
spanning-tree mode rapid-pvst
spanning-tree vlan 10 root primary
spanning-tree vlan 20 root secondary
end
write memory`,
    DSW2: `configure terminal
spanning-tree mode rapid-pvst
spanning-tree vlan 20 root primary
spanning-tree vlan 10 root secondary
end
write memory`,
    ASW1: `configure terminal
spanning-tree mode rapid-pvst
interface range fa0/1 - 2
 spanning-tree portfast
end
write memory`,
    ASW2: `configure terminal
spanning-tree mode rapid-pvst
interface range fa0/1 - 2
 spanning-tree portfast
end
write memory`,
  },
}

export default lab
