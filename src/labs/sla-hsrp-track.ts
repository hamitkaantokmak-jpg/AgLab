// AğLab Konu #37 - IP SLA + track ile HSRP önceliğini hattın gerçek durumuna bağlamak.
// Arıza: aktif ağ geçidi (GW1) internet çıkışını izlemiyor; ISP-A'nın ötesi kopukken Active
// kalıyor ve LAN trafiğini kara deliğe gönderiyor. GW2'de preempt yok: öncelik düşse de devralmaz.
import type { LabDef } from '../sim/types'
import { ports } from '../sim/util'

const router = (id: string, mac: string, x: number, y: number) => ({
  id,
  kind: 'switch' as const,
  router: true,
  model: 'ISR4331',
  mac,
  ports: ports('Gi0/0-2'),
  x,
  y,
})

const ifc = (name: string, ip: string, mask = '255.255.255.252', extra: string[] = []) =>
  [`interface ${name}`, ` ip address ${ip} ${mask}`, ...extra.map((l) => ' ' + l), ' no shutdown', 'exit'].join('\n')

const lab: LabDef = {
  id: 'hsrp-sla-track',
  title: 'IP SLA + track ile HSRP: ağ geçidi internetini kaybedince devretmek',
  summary:
    'İki ağ geçidi HSRP ile çalışıyor. GW1\'in ISP\'sinin ötesi koptu ama LAN arayüzü sağlam olduğu için GW1 Active kalıyor ve kullanıcılar internetsiz. GW1\'in önceliğini gerçek internet erişimine bağla, GW2\'nin devralmasını sağla.',
  level: 'İleri',
  tags: ['ENCOR', 'IP SLA', 'Track', 'HSRP', 'Preempt', 'Arıza giderme'],
  brief: [
    'LAN 192.168.1.0/24, sanal ağ geçidi 192.168.1.254 (HSRP grup 1). GW1 (192.168.1.2, öncelik 110, preempt) ISP-A\'ya; GW2 (192.168.1.3, öncelik 100) ISP-B\'ye bağlı. İnternetteki sunucu SRV 203.0.113.10.',
    'Her ağ geçidinin varsayılan rotası kendi ISP\'sine bakıyor. ISP router\'larına ve CORE\'a dokunma: arıza operatör tarafında.',
    'Belirti: ISP-A\'nın çekirdek bağlantısı koptu. GW1 Active; PC1 internete çıkamıyor. GW1\'in LAN ve ISP arayüzleri up/up.',
    'Hedef: GW1\'de IP SLA 1 (icmp-echo 203.0.113.10, kaynak Gi0/1) + track 1; HSRP önceliği track 1 düşünce 20 azalsın (110 → 90). GW2 daha yüksek öncelikle devralabilmeli: bunun için GW2\'de preempt gerekli.',
    'Kontrol: show track 1, show standby brief (iki ağ geçidinde), PC1\'den ping ve trace 203.0.113.10.',
  ],
  view: { w: 980, h: 520 },
  devices: [
    { id: 'SW', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.00c0.0000', ports: ports('Fa0/1-24', 'Gi0/1-2'), x: 120, y: 260 },
    router('GW1', '5254.00c0.0001', 330, 130),
    router('GW2', '5254.00c0.0002', 330, 390),
    router('ISP-A', '5254.00c0.0003', 560, 130),
    router('ISP-B', '5254.00c0.0004', 560, 390),
    router('CORE', '5254.00c0.0005', 780, 260),
    { id: 'PC1', kind: 'pc', mac: '0050.7966.c001', x: 120, y: 450 },
    { id: 'SRV', kind: 'pc', mac: '0050.7966.c010', x: 920, y: 260 },
  ],
  links: [
    { a: ['PC1', 'eth0'], b: ['SW', 'FastEthernet0/1'] },
    { a: ['GW1', 'GigabitEthernet0/0'], b: ['SW', 'FastEthernet0/2'] },
    { a: ['GW2', 'GigabitEthernet0/0'], b: ['SW', 'FastEthernet0/3'] },
    { a: ['GW1', 'GigabitEthernet0/1'], b: ['ISP-A', 'GigabitEthernet0/1'] },
    { a: ['GW2', 'GigabitEthernet0/1'], b: ['ISP-B', 'GigabitEthernet0/1'] },
    { a: ['ISP-A', 'GigabitEthernet0/2'], b: ['CORE', 'GigabitEthernet0/1'] },
    { a: ['ISP-B', 'GigabitEthernet0/2'], b: ['CORE', 'GigabitEthernet0/2'] },
    { a: ['CORE', 'GigabitEthernet0/0'], b: ['SRV', 'eth0'] },
  ],
  initialConfig: {
    SW: 'interface range fa0/1 - 3\n switchport mode access\nexit',
    GW1: [
      ifc('g0/0', '192.168.1.2', '255.255.255.0', ['standby 1 ip 192.168.1.254', 'standby 1 priority 110', 'standby 1 preempt']),
      ifc('g0/1', '10.1.1.1'),
      'ip route 0.0.0.0 0.0.0.0 10.1.1.2',
    ].join('\n'),
    // fault: GW2 preempt yok
    GW2: [ifc('g0/0', '192.168.1.3', '255.255.255.0', ['standby 1 ip 192.168.1.254']), ifc('g0/1', '10.2.2.1'), 'ip route 0.0.0.0 0.0.0.0 10.2.2.2'].join(
      '\n',
    ),
    // operatör tarafı: ISP-A'nın çekirdek bağlantısı kopuk
    'ISP-A': [ifc('g0/1', '10.1.1.2'), ifc('g0/2', '10.10.1.1', '255.255.255.252', ['shutdown']).replace(' no shutdown\n', ''), 'ip route 0.0.0.0 0.0.0.0 10.10.1.2', 'ip route 192.168.1.0 255.255.255.0 10.1.1.1'].join('\n'),
    'ISP-B': [ifc('g0/1', '10.2.2.2'), ifc('g0/2', '10.20.2.1'), 'ip route 0.0.0.0 0.0.0.0 10.20.2.2', 'ip route 192.168.1.0 255.255.255.0 10.2.2.1'].join('\n'),
    CORE: [
      ifc('g0/0', '203.0.113.1', '255.255.255.0'),
      ifc('g0/1', '10.10.1.2'),
      ifc('g0/2', '10.20.2.2'),
      'ip route 192.168.1.0 255.255.255.0 10.10.1.1',
      'ip route 192.168.1.0 255.255.255.0 10.20.2.1 250',
      'ip route 10.1.1.0 255.255.255.252 10.10.1.1',
      'ip route 10.2.2.0 255.255.255.252 10.20.2.1',
    ].join('\n'),
  },
  initialPcs: {
    PC1: { ip: '192.168.1.10', prefix: 24, gw: '192.168.1.254' },
    SRV: { ip: '203.0.113.10', prefix: 24, gw: '203.0.113.1' },
  },
  objectives: [
    {
      id: 'sla',
      title: 'GW1\'de IP SLA 1 zamanlanmış ve track 1 ona bağlı',
      hint: 'ip sla 1 → icmp-echo 203.0.113.10 source-interface g0/1 → exit → ip sla schedule 1 life forever start-time now → track 1 ip sla 1 reachability',
      check: (q) => {
        const s = q.ipSla('GW1', 1)
        const t = q.track('GW1', 1)
        return { ok: s.scheduled && t.type === 'ip sla', detail: !s.configured ? 'SLA 1 yok' : !s.scheduled ? 'zamanlanmamış' : t.type !== 'ip sla' ? 'track 1 SLA\'ya bağlı değil' : undefined }
      },
    },
    {
      id: 'decrement',
      title: 'GW1\'in HSRP önceliği track 1\'e bağlı (Down iken 90)',
      hint: 'GW1 g0/0: standby 1 track 1 decrement 20. show standby → "Priority 90 (configured 110)".',
      check: (q) => {
        const p = q.fhrpPriority('GW1', 'GigabitEthernet0/0', 1)
        return { ok: p === 90, detail: p === null ? 'HSRP üyesi yok' : `öncelik ${p}` }
      },
    },
    {
      id: 'takeover',
      title: 'GW2 Active (preempt ile devraldı)',
      hint: 'GW2 g0/0: standby 1 preempt. Öncelik 100 > 90 olsa da preempt olmadan Standby router devralmaz.',
      check: (q) => q.fhrpActive('GW2', 'GigabitEthernet0/0', 1),
    },
    {
      id: 'e2e',
      title: 'PC1 → SRV ping',
      hint: 'PC1\'de: ping 203.0.113.10, trace 203.0.113.10 → ilk atlama 192.168.1.3 (GW2).',
      check: (q) => q.ping('PC1', '203.0.113.10').ok,
    },
  ],
  solution: {
    GW1: `configure terminal
ip sla 1
 icmp-echo 203.0.113.10 source-interface g0/1
exit
ip sla schedule 1 life forever start-time now
track 1 ip sla 1 reachability
exit
interface g0/0
 standby 1 track 1 decrement 20
end
write memory`,
    GW2: `configure terminal
interface g0/0
 standby 1 preempt
end
write memory`,
  },
}

export default lab
