// AğLab Konu #48 (ve #37) - IP SLA + track ile statik varsayılan rotayı yedeklemek.
// Arıza: birincil varsayılan rota track'e bağlı değil; ISP-A'nın ötesi kopukken arayüz up/up
// kaldığı için rota tablodan çıkmıyor, AD 250'li yedek hiç devreye girmiyor. Yoklama hedefi
// için host rotası yoksa nesne dalgalanır.
import type { LabDef } from '../sim/types'
import { ports } from '../sim/util'

const sw = (id: string, mac: string, x: number, y: number) => ({
  id,
  kind: 'switch' as const,
  model: 'WS-C3560-24PS',
  mac,
  ports: ports('Fa0/1-2', 'Gi0/1-2'),
  l3: true,
  needsEncap: true,
  x,
  y,
})

const routed = (port: string, ip: string, extra = '') => `interface ${port}
 no switchport
 ip address ${ip} 255.255.255.252${extra}
exit`

const lab: LabDef = {
  id: 'statik-yedek',
  title: 'IP SLA + track: birincil hat koptuğunda yedek internete geçmek',
  summary:
    'Şubenin iki internet çıkışı var. ISP-A\'nın ötesi koptu ama R1\'in ISP-A arayüzü up/up; trafik kara deliğe gidiyor, yedek rota hiç devreye girmiyor. Birincil rotayı gerçek erişilebilirliğe bağla.',
  level: 'İleri',
  tags: ['ENARSI', 'ENCOR', 'IP SLA', 'Track', 'Statik rota', 'Floating static', 'Arıza giderme'],
  brief: [
    'R1 şube kenar router\'ı: Gi0/1 ISP-A\'ya (10.1.1.2), Gi0/2 ISP-B\'ye (10.2.2.2). LAN 192.168.10.0/24 (PC1). İnternetteki sunucu SRV 203.0.113.10; ISP-A\'nın izleme adresi DNS-A 203.0.113.53.',
    'Varsayılan rotalar: birincil ip route 0.0.0.0 0.0.0.0 10.1.1.2, yedek ip route 0.0.0.0 0.0.0.0 10.2.2.2 250 (floating static). ISP router\'larına ve CORE\'a dokunma: arıza operatör tarafında.',
    'Belirti: ISP-A\'nın çekirdeğe bağlantısı koptu. R1\'de Gi0/1 up/up, birincil rota tabloda; PC1 internete çıkamıyor.',
    'Hedef: IP SLA 1 (icmp-echo 203.0.113.53) + track 1 ile birincil rotayı izle. Yoklama birincil hat ölünce yedek hattan dolaşıp başarılı olmasın (dalgalanma): yoklamayı Gi0/1 kaynağıyla gönder ve hedef için ISP-A üzerinden track\'siz bir host rotası (/32) ekle.',
    'Kontrol: show ip sla statistics, show track 1, show ip route static, PC1\'den ping ve trace 203.0.113.10.',
  ],
  view: { w: 980, h: 520 },
  devices: [
    sw('R1', '5254.00b0.0001', 140, 250),
    sw('ISP-A', '5254.00b0.0002', 440, 120),
    sw('ISP-B', '5254.00b0.0003', 440, 380),
    sw('CORE', '5254.00b0.0004', 740, 250),
    { id: 'PC1', kind: 'pc', mac: '0050.7966.b001', x: 140, y: 450 },
    { id: 'SRV', kind: 'pc', mac: '0050.7966.b010', x: 900, y: 160 },
    { id: 'DNS-A', kind: 'pc', mac: '0050.7966.b053', x: 900, y: 360 },
  ],
  links: [
    { a: ['R1', 'GigabitEthernet0/1'], b: ['ISP-A', 'GigabitEthernet0/1'] },
    { a: ['R1', 'GigabitEthernet0/2'], b: ['ISP-B', 'GigabitEthernet0/1'] },
    { a: ['ISP-A', 'GigabitEthernet0/2'], b: ['CORE', 'GigabitEthernet0/1'] },
    { a: ['ISP-B', 'GigabitEthernet0/2'], b: ['CORE', 'GigabitEthernet0/2'] },
    { a: ['PC1', 'eth0'], b: ['R1', 'FastEthernet0/1'] },
    { a: ['SRV', 'eth0'], b: ['CORE', 'FastEthernet0/1'] },
    { a: ['DNS-A', 'eth0'], b: ['CORE', 'FastEthernet0/2'] },
  ],
  initialConfig: {
    R1: `ip routing
vlan 10
 name LAN
exit
interface fa0/1
 switchport mode access
 switchport access vlan 10
exit
interface vlan 10
 ip address 192.168.10.1 255.255.255.0
exit
${routed('gi0/1', '10.1.1.1')}
${routed('gi0/2', '10.2.2.1')}
ip route 0.0.0.0 0.0.0.0 10.1.1.2
ip route 0.0.0.0 0.0.0.0 10.2.2.2 250`,
    // operatör tarafı: ISP-A'nın çekirdek bağlantısı kopuk (Gi0/2 kapalı)
    'ISP-A': `ip routing
${routed('gi0/1', '10.1.1.2')}
${routed('gi0/2', '10.10.1.1', '\n shutdown')}
ip route 0.0.0.0 0.0.0.0 10.10.1.2
ip route 192.168.10.0 255.255.255.0 10.1.1.1`,
    'ISP-B': `ip routing
${routed('gi0/1', '10.2.2.2')}
${routed('gi0/2', '10.20.2.1')}
ip route 0.0.0.0 0.0.0.0 10.20.2.2
ip route 192.168.10.0 255.255.255.0 10.2.2.1`,
    CORE: `ip routing
vlan 10
 name INTERNET
exit
interface range fa0/1 - 2
 switchport mode access
 switchport access vlan 10
exit
interface vlan 10
 ip address 203.0.113.1 255.255.255.0
exit
${routed('gi0/1', '10.10.1.2')}
${routed('gi0/2', '10.20.2.2')}
ip route 192.168.10.0 255.255.255.0 10.10.1.1
ip route 192.168.10.0 255.255.255.0 10.20.2.1 250
ip route 10.1.1.0 255.255.255.252 10.10.1.1
ip route 10.2.2.0 255.255.255.252 10.20.2.1`,
  },
  initialPcs: {
    PC1: { ip: '192.168.10.10', prefix: 24, gw: '192.168.10.1' },
    SRV: { ip: '203.0.113.10', prefix: 24, gw: '203.0.113.1' },
    'DNS-A': { ip: '203.0.113.53', prefix: 24, gw: '203.0.113.1' },
  },
  objectives: [
    {
      id: 'sla',
      title: 'R1\'de IP SLA 1 tanımlı ve zamanlanmış',
      hint: 'ip sla 1 → icmp-echo 203.0.113.53 source-interface gi0/1 → exit → ip sla schedule 1 life forever start-time now',
      check: (q) => {
        const s = q.ipSla('R1', 1)
        return { ok: s.configured && s.scheduled, detail: !s.configured ? 'SLA 1 yok' : !s.scheduled ? 'zamanlanmamış' : undefined }
      },
    },
    {
      id: 'track',
      title: 'Birincil varsayılan rota track 1\'e (IP SLA 1) bağlı; yedek devrede',
      hint: 'track 1 ip sla 1 reachability → ip route 0.0.0.0 0.0.0.0 10.1.1.2 track 1. Track Down iken AD 250\'lik yedek kurulur.',
      check: (q) => {
        const t = q.track('R1', 1)
        const r = q.route('R1', '0.0.0.0', 0)
        const ok = t.type === 'ip sla' && !t.up && r?.nh === '10.2.2.2'
        return { ok, detail: t.type !== 'ip sla' ? 'track 1 IP SLA\'ya bağlı değil' : r ? `varsayılan via ${r.nh}` : 'varsayılan rota yok' }
      },
    },
    {
      id: 'noflap',
      title: 'Yoklama yedek yola düşmüyor (dalgalanma yok)',
      hint: 'icmp-echo 203.0.113.53 source-interface gi0/1 ve ip route 203.0.113.53 255.255.255.255 10.1.1.2 (track\'siz). Kaynak verilmezse yoklama birincil rota çıkınca ISP-B\'den, ISP-B adresiyle çıkar ve başarılı olur; show track 1\'de "flapping" satırı görünür.',
      check: (q) => {
        const s = q.ipSla('R1', 1)
        const h = q.route('R1', '203.0.113.53', 32)
        return { ok: s.scheduled && !s.flapping && h?.nh === '10.1.1.2', detail: s.flapping ? 'yoklama yedek hattan başarılı: dalgalanır' : !h ? 'yoklama hedefi için host rotası yok' : undefined }
      },
    },
    {
      id: 'e2e',
      title: 'PC1 → SRV ping (yedek hattan)',
      hint: 'PC1\'de: ping 203.0.113.10, trace 203.0.113.10 → ikinci atlama 10.2.2.2 olmalı.',
      check: (q) => q.ping('PC1', '203.0.113.10').ok,
    },
  ],
  solution: {
    R1: `configure terminal
ip sla 1
 icmp-echo 203.0.113.53 source-interface gi0/1
exit
ip sla schedule 1 life forever start-time now
track 1 ip sla 1 reachability
exit
ip route 0.0.0.0 0.0.0.0 10.1.1.2 track 1
ip route 203.0.113.53 255.255.255.255 10.1.1.2
end
write memory`,
  },
}

export default lab
