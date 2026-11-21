// AğLab Konu #29 - MST (802.1s) arıza giderme: bölge kimliği (ad + revizyon + VLAN eşlemesi)
// tutmayan switch ayrı bölgeye düşer, yük dengeleme kaybolur; CIST kökü erişim switch'inde.
import type { LabDef } from '../sim/types'
import type { LabQuery } from '../sim/query'
import { ports } from '../sim/util'

const ALL = ['DSW1', 'DSW2', 'ASW1', 'ASW2'] as const
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

const region = (rev: number, map: string) => `spanning-tree mode mst
spanning-tree mst configuration
 name KAMPUS
 revision ${rev}
${map}exit`

const MAP = ' instance 1 vlan 10\n instance 2 vlan 20\n'

const access = `interface fa0/1
 switchport mode access
 switchport access vlan 10
 spanning-tree portfast
interface fa0/2
 switchport mode access
 switchport access vlan 20
 spanning-tree portfast
exit`

const lab: LabDef = {
  id: 'mst-bolge',
  title: 'MST: bölge uyuşmazlığı ve kaybolan yük dengeleme',
  summary:
    'Kampüs MST\'ye geçti: VLAN 10 MST1\'de (kök DSW1), VLAN 20 MST2\'de (kök DSW2). Ama erişim switch\'leri yük dengelemiyor ve CIST kökü bir erişim switch\'i. Bölge kimliğini eşitle, CIST kökünü dağıtıma taşı.',
  level: 'İleri',
  tags: ['ENCOR', 'STP', 'MST', '802.1s', 'Bölge', 'CIST', 'Arıza giderme'],
  brief: [
    'Tasarım: dört switch tek MST bölgesi KAMPUS, revizyon 1; instance 1 = VLAN 10, instance 2 = VLAN 20. DSW1 MST1 kökü ve MST2 yedeği, DSW2 MST2 kökü ve MST1 yedeği. Trunk\'lar ve VLAN\'lar hazır.',
    'Belirti: ASW1 ve ASW2 iki VLAN\'ı da aynı uplink\'ten iletiyor; show spanning-tree mst\'de sınır (Bound) portları görünüyor. Ayrıca MST0 (CIST) kökü ASW1.',
    'Kurallar: bir bölgedeki bütün switch\'lerde ad, revizyon ve VLAN → instance eşlemesi birebir aynı olmalı (show spanning-tree mst configuration digest ile karşılaştır). Değişiklik (config-mst) kipinden exit ile çıkınca uygulanır.',
    'CIST kökü dağıtım katmanında olmalı: DSW1 instance 0 için kök.',
    'Bitince: her erişim switch\'i VLAN 10\'u Gi0/1\'den (DSW1), VLAN 20\'yi Gi0/2\'den (DSW2) iletir; diğer uplink o VLAN için BLK. PC1 ↔ PC3 ve PC2 ↔ PC4 ping.',
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
    DSW1: `${vlans}\n${trunks('gi0/1 - 3')}\n${region(1, MAP)}\nspanning-tree mst 1 root primary\nspanning-tree mst 2 root secondary`,
    DSW2: `${vlans}\n${trunks('gi0/1 - 3')}\n${region(1, MAP)}\nspanning-tree mst 2 root primary\nspanning-tree mst 1 root secondary`,
    // fault: VLAN 20 eşlemesi eksik (VLAN 20 IST'de kalıyor) → özet farklı, ayrı bölge
    ASW1: `${vlans}\n${trunks('gi0/1 - 2')}\n${access}\n${region(1, ' instance 1 vlan 10\n')}`,
    // fault: revizyon farklı → ayrı bölge
    ASW2: `${vlans}\n${trunks('gi0/1 - 2')}\n${access}\n${region(2, MAP)}`,
  },
  objectives: [
    {
      id: 'region',
      title: 'Dört switch aynı MST bölgesinde (ad, revizyon, eşleme)',
      hint: 'ASW1: spanning-tree mst configuration → instance 2 vlan 20 → exit. ASW2: spanning-tree mst configuration → revision 1 → exit. Kontrol: show spanning-tree mst configuration digest (dördünde aynı).',
      check: (q) => {
        const ref = q.mstRegion('DSW1')
        const bad = ALL.filter((s) => {
          const r = q.mstRegion(s)
          return r.name !== ref.name || r.revision !== ref.revision || r.digest !== ref.digest
        })
        return { ok: !bad.length, detail: bad.length ? 'Farklı bölge: ' + bad.join(', ') : undefined }
      },
    },
    {
      id: 'cist',
      title: 'CIST (MST0) kökü DSW1',
      hint: 'DSW1: spanning-tree mst 0 root primary (ya da priority 24576). show spanning-tree mst 0 → "This bridge is the root".',
      check: (q) => {
        const r = q.mstRoot('ASW2', 0)
        return { ok: r?.dev === 'DSW1', detail: `MST0 kökü: ${r?.dev ?? '-'}` }
      },
    },
    {
      id: 'balance',
      title: 'Erişim switch\'leri: VLAN 10 Gi0/1\'den, VLAN 20 Gi0/2\'den',
      hint: 'show spanning-tree mst 1 ve mst 2 (ASW1\'de): MST1\'de Gi0/1 Root FWD, Gi0/2 Altn BLK; MST2\'de tersi. Sınır (Bound) portu kalmamalı.',
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
      id: 'ping',
      title: 'PC1 ↔ PC3 (VLAN 10) ve PC2 ↔ PC4 (VLAN 20) ping',
      hint: 'Bölge düzeltmesi bağlantıyı koparmamalı. PC1 konsolunda: ping 10.1.10.12',
      check: (q) => pingBoth(q, 'PC1', 'PC3') && pingBoth(q, 'PC2', 'PC4'),
    },
  ],
  solution: {
    DSW1: `configure terminal
spanning-tree mst 0 root primary
end
write memory`,
    ASW1: `configure terminal
spanning-tree mst configuration
 instance 2 vlan 20
exit
end
write memory`,
    ASW2: `configure terminal
spanning-tree mst configuration
 revision 1
exit
end
write memory`,
  },
}

export default lab
