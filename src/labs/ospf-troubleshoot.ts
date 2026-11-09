// ENCOR 3 - OSPF Fundamentals: requirements for neighbor adjacency, timers, MTU, metric tuning (reference bandwidth).
import type { LabDef } from '../sim/types'
import { ports } from '../sim/util'

const R = ['R1', 'R2', 'R3']

const base = (n: number, rid: string, extra: string) => `ip routing
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
${extra}
router ospf 1
 router-id ${rid}
 passive-interface vlan 10
 network 192.168.${n}.0 0.0.0.255 area 0`

const routed = (port: string, ip: string, more = '') => `interface ${port}
 no switchport
 ip address ${ip} 255.255.255.252${more}
exit`

const lab: LabDef = {
  id: 'ospf-ariza',
  title: 'OSPF arıza giderme: komşuluk şartları ve metrik ayarı',
  summary: 'Üç router arasında hiçbir OSPF komşuluğu FULL değil. Hello/dead, area ve MTU uyumsuzluklarını bul, sonra reference bandwidth ile trafiği gigabit yola çek.',
  level: 'İleri',
  tags: ['ENCOR', 'OSPF', 'Arıza giderme', 'Hello/Dead', 'MTU', 'Reference bandwidth'],
  brief: [
    'R1–R2 ve R2–R3 arası Gigabit, R1–R3 arası FastEthernet routed linkler. IP adresleri ve OSPF süreci hazır, ama "show ip ospf neighbor" neredeyse boş.',
    'OSPF komşuluğu için iki uçta eşleşmesi gerekenler: subnet ve mask, area ID, hello ve dead süresi, stub bayrağı, farklı router ID. MTU eşleşmezse komşu görünür ama EXSTART\'ta takılır.',
    'Her linkte sorunu bul ve doğru taraftan düzelt: standart değerler hello 10 / dead 40, MTU 1500, bütün linkler area 0.',
    'Sonra metrik: varsayılan reference bandwidth 100 Mbps, FastEthernet ile Gigabit\'i aynı maliyette (1) görür ve R1 192.168.3.0/24\'e yavaş linkten gider. Üç router\'da da auto-cost reference-bandwidth 10000 yap; R1 artık R2 üzerinden gitmeli, R1–R3 linki yedek kalmalı.',
    'Kontrol: show ip ospf neighbor, show ip ospf interface Gi0/1, show running-config | section interface, show ip route ospf.',
  ],
  view: { w: 880, h: 520 },
  devices: [
    { id: 'R1', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0060.0001', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 210, y: 150 },
    { id: 'R2', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0060.0002', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 440, y: 330 },
    { id: 'R3', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0060.0003', ports: ports('Fa0/1-2', 'Gi0/1-2'), l3: true, needsEncap: true, x: 670, y: 150 },
    { id: 'PC1', kind: 'pc', mac: '0050.7966.6001', x: 210, y: 460 },
    { id: 'PC3', kind: 'pc', mac: '0050.7966.6003', x: 670, y: 460 },
  ],
  links: [
    { a: ['R1', 'GigabitEthernet0/1'], b: ['R2', 'GigabitEthernet0/1'] },
    { a: ['R2', 'GigabitEthernet0/2'], b: ['R3', 'GigabitEthernet0/2'] },
    { a: ['R1', 'FastEthernet0/2'], b: ['R3', 'FastEthernet0/2'] },
    { a: ['PC1', 'eth0'], b: ['R1', 'FastEthernet0/1'] },
    { a: ['PC3', 'eth0'], b: ['R3', 'FastEthernet0/1'] },
  ],
  initialConfig: {
    R1: base(1, '1.1.1.1', [routed('gi0/1', '10.0.12.1'), routed('fa0/2', '10.0.13.1')].join('\n')) + `
 network 10.0.12.0 0.0.0.3 area 0
 network 10.0.13.0 0.0.0.3 area 0
exit`,
    // fault 1: hello timer on the R1-R2 link
    R2: base(2, '2.2.2.2', [routed('gi0/1', '10.0.12.2', '\n ip ospf hello-interval 5'), routed('gi0/2', '10.0.23.1')].join('\n')) + `
 network 10.0.12.0 0.0.0.3 area 0
 network 10.0.23.0 0.0.0.3 area 0
exit`,
    // fault 2: R2-R3 link put in area 1 on R3; fault 3: MTU on the R1-R3 link
    R3: base(3, '3.3.3.3', [routed('gi0/2', '10.0.23.2'), routed('fa0/2', '10.0.13.2', '\n ip mtu 1400')].join('\n')) + `
 network 10.0.23.0 0.0.0.3 area 1
 network 10.0.13.0 0.0.0.3 area 0
exit`,
  },
  initialPcs: {
    PC1: { ip: '192.168.1.10', prefix: 24, gw: '192.168.1.1' },
    PC3: { ip: '192.168.3.10', prefix: 24, gw: '192.168.3.1' },
  },
  objectives: [
    {
      id: 'r1r2',
      title: 'R1–R2 komşuluğu FULL',
      hint: 'Hello/dead iki uçta aynı olmalı. show ip ospf interface gi0/1 çıktısındaki "Timer intervals" satırlarını karşılaştır.',
      check: (q) => q.ospfAdjacent('R1', 'R2'),
    },
    {
      id: 'r2r3',
      title: 'R2–R3 komşuluğu FULL ve area 0\'da',
      hint: 'İki uçta show ip ospf interface brief ile Area sütununu karşılaştır. R3: no network 10.0.23.0 0.0.0.3 area 1 → network 10.0.23.0 0.0.0.3 area 0',
      check: (q) => q.ospfAdjacent('R2', 'R3') && q.ospf('R3')!.ifs.some((i) => i.name === 'GigabitEthernet0/2' && i.area === 0),
    },
    {
      id: 'r1r3',
      title: 'R1–R3 komşuluğu FULL (EXSTART\'ta takılı değil)',
      hint: 'Komşu görünüyor ama EXSTART\'ta kalıyorsa DBD paketleri MTU yüzünden kabul edilmiyor. R3 Fa0/2: no ip mtu',
      check: (q) => q.ospfAdjacent('R1', 'R3'),
    },
    {
      id: 'refbw',
      title: 'Üç router\'da auto-cost reference-bandwidth 10000',
      hint: 'Değer bütün router\'larda aynı olmalı. Yoksa her router linkleri farklı maliyetle hesaplar.',
      check: (q) => {
        const bad = R.filter((d) => q.cfg(d).ospf?.refBw !== 10000)
        return { ok: !bad.length, detail: bad.length ? 'Farklı: ' + bad.join(', ') : undefined }
      },
    },
    {
      id: 'path',
      title: 'R1, 192.168.3.0/24\'e yalnızca R2 üzerinden gidiyor',
      hint: 'Ref BW 10000 ile Gi = 10, Fa = 100. R1 → R2 → R3 = 20 + LAN < 100. Kontrol: show ip route 192.168.3.0',
      check: (q) => {
        const r = q.route('R1', '192.168.3.0', 24)
        return { ok: !!r && r.code === 'O' && r.paths?.length === 1 && r.nh === '10.0.12.2', detail: r ? `via ${r.paths?.map((p) => p.nh).join(', ')}` : 'rota yok' }
      },
    },
    {
      id: 'e2e',
      title: 'PC1 ↔ PC3 ping',
      hint: 'PC1\'de: trace 192.168.3.10. İlk hop 192.168.1.1, ikinci 10.0.12.2 olmalı.',
      check: (q) => q.ping('PC1', '192.168.3.10').ok && q.ping('PC3', '192.168.1.10').ok,
    },
  ],
  solution: {
    R1: `configure terminal
router ospf 1
 auto-cost reference-bandwidth 10000
end
write memory`,
    R2: `configure terminal
interface gi0/1
 no ip ospf hello-interval
exit
router ospf 1
 auto-cost reference-bandwidth 10000
end
write memory`,
    R3: `configure terminal
interface fa0/2
 no ip mtu
exit
router ospf 1
 no network 10.0.23.0 0.0.0.3 area 1
 network 10.0.23.0 0.0.0.3 area 0
 auto-cost reference-bandwidth 10000
end
write memory`,
  },
}

export default lab
