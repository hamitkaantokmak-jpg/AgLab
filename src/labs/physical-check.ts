// Konu #4 Fiziksel bağlantı — yönlendirmeli lab (docs/dersler/fiziksel-baglanti.md
// "4. Yönlendirmeli lab"). Port durum tablosunu okuma: disabled (kapatılmış) ile notconnect
// (karşı uç yok/kapalı) ayrımı, iki ucu okuma, kullanılmayan portu kapatma ve etiketleme.
import type { LabDef } from '../sim/types'
import type { LabQuery } from '../sim/query'
import { ports } from '../sim/util'

const desc = (q: LabQuery, port: string) => (q.cfg('SW1').ifaces[port]?.description ?? '').toUpperCase()
const LABELS: [string, string][] = [
  ['FastEthernet0/1', 'PC-1'],
  ['FastEthernet0/2', 'PC-2'],
  ['GigabitEthernet0/1', 'SW2'],
]

const lab: LabDef = {
  id: 'fiziksel-kontrol',
  title: 'Port durum tablosunu okumak: iki uç, boş portlar ve etiketleme',
  summary: 'show interfaces status ile disabled ve notconnect portları ayır, iki ucu oku, kullanılmayan portları kapat ve kullanılan portları etiketle.',
  level: 'Başlangıç',
  tags: ['Şube', 'Konu #4', 'show interfaces status', 'shutdown', 'notconnect', 'description'],
  brief: [
    'SW1\'e PC-1 (Fa0/1) ve PC-2 (Fa0/2) bağlı; yazıcı ve PC-3, SW1\'e Gi0/1 ile bağlı SW2\'de. Hepsi 192.168.10.0/24 ağında. Şikâyet: "PC-2 hiçbir yere ulaşamıyor, yazıcı da yazmıyor."',
    'Her teşhis durum tablosuyla başlar: SW1\'de `show interfaces status`. connected, notconnect ve disabled portları ayır. disabled "biri bu portu kapattı" demektir; notconnect "bu uçta sorun yok ama karşıdan sinyal gelmiyor".',
    'Bir uplink notconnect ise karşı ucu da oku: SW2\'ye geç ve aynı tabloya bak. Sorun hangi uçta?',
    'Düzelttikten sonra şube kuralını uygula: SW1\'de kullanılmayan Fa0/3 ve Fa0/4 kapalı dursun; kullanılan üç portun açıklamasına bağlı cihazın adını yaz (ör. "PC-1"). Tablodaki Name sütunu dolar.',
    'Son olarak ilk şikâyeti aynı testle dene: PC-2\'den PC-1\'e ve yazıcıya ping.',
  ],
  view: { w: 820, h: 460 },
  devices: [
    { id: 'SW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0094.0011', ports: ports('Fa0/1-5', 'Gi0/1-2'), x: 260, y: 160 },
    { id: 'SW2', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0094.0012', ports: ports('Fa0/1-4', 'Gi0/1-2'), x: 580, y: 160 },
    { id: 'PC-1', kind: 'pc', mac: '0050.7966.9401', x: 140, y: 360 },
    { id: 'PC-2', kind: 'pc', mac: '0050.7966.9402', x: 340, y: 360 },
    { id: 'YAZICI', kind: 'pc', mac: '0050.7966.9410', x: 520, y: 360 },
    { id: 'PC-3', kind: 'pc', mac: '0050.7966.9403', x: 700, y: 360 },
  ],
  links: [
    { a: ['SW1', 'GigabitEthernet0/1'], b: ['SW2', 'GigabitEthernet0/1'] },
    { a: ['PC-1', 'eth0'], b: ['SW1', 'FastEthernet0/1'] },
    { a: ['PC-2', 'eth0'], b: ['SW1', 'FastEthernet0/2'] },
    { a: ['YAZICI', 'eth0'], b: ['SW2', 'FastEthernet0/1'] },
    { a: ['PC-3', 'eth0'], b: ['SW2', 'FastEthernet0/2'] },
  ],
  initialConfig: {
    SW1: `interface range fa0/1 - 5
 switchport mode access
interface fa0/2
 shutdown
interface fa0/5
 shutdown
exit`,
    SW2: `interface range fa0/1 - 4
 switchport mode access
interface gi0/1
 shutdown
exit`,
  },
  initialPcs: {
    'PC-1': { ip: '192.168.10.11', prefix: 24, gw: null },
    'PC-2': { ip: '192.168.10.12', prefix: 24, gw: null },
    YAZICI: { ip: '192.168.10.50', prefix: 24, gw: null },
    'PC-3': { ip: '192.168.10.13', prefix: 24, gw: null },
  },
  objectives: [
    {
      id: 'pc2',
      title: 'PC-2 ↔ PC-1 ping',
      hint: 'SW1 Fa0/2 "disabled": interface fa0/2 → no shutdown. Kontrol: show interfaces status',
      check: (q) => q.ping('PC-2', '192.168.10.11').ok,
    },
    {
      id: 'uplink',
      title: 'SW1–SW2 uplink\'i up; PC-1 yazıcıya ulaşıyor',
      hint: 'SW1 tarafında Gi0/1 notconnect ama kapatılmamış; SW2\'de Gi0/1 disabled. Kapatılan uçta: interface gi0/1 → no shutdown',
      check: (q) => q.linkUp('SW1', 'GigabitEthernet0/1') && q.ping('PC-1', '192.168.10.50').ok,
    },
    {
      id: 'unused',
      title: 'SW1\'de kullanılmayan Fa0/3 ve Fa0/4 kapalı',
      hint: 'interface range fa0/3 - 4 → shutdown. Kullanılmayan açık port, izinsiz bir cihazın ağa girmesine izin verir.',
      check: (q) => ['FastEthernet0/3', 'FastEthernet0/4'].every((p) => q.cfg('SW1').ifaces[p]?.shutdown === true),
    },
    {
      id: 'labels',
      title: 'SW1\'in kullanılan portları etiketli (PC-1, PC-2, SW2)',
      hint: 'interface fa0/1 → description PC-1; fa0/2 → description PC-2; gi0/1 → description SW2 Gi0/1. Kontrol: show interfaces status (Name sütunu)',
      check: (q) => {
        const bad = LABELS.filter(([p, name]) => !desc(q, p).includes(name))
        return { ok: !bad.length, detail: bad.length ? 'Eksik: ' + bad.map(([p]) => p.replace('FastEthernet', 'Fa').replace('GigabitEthernet', 'Gi')).join(', ') : undefined }
      },
    },
  ],
  solution: {
    SW1: `configure terminal
interface fa0/2
 no shutdown
interface range fa0/3 - 4
 shutdown
interface fa0/1
 description PC-1
interface fa0/2
 description PC-2
interface gi0/1
 description SW2 Gi0/1
end
`,
    SW2: `configure terminal
interface gi0/1
 no shutdown
end
`,
  },
}

export default lab
