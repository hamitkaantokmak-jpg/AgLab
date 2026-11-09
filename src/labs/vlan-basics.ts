import type { LabDef } from '../sim/types'
import type { LabQuery } from '../sim/query'
import { ports } from '../sim/util'

const pingBoth = (q: LabQuery, a: string, b: string) =>
  q.ping(a, q.pcIp(b) ?? '0.0.0.0').ok && q.ping(b, q.pcIp(a) ?? '0.0.0.0').ok

const UNUSED = ['Fa0/5', 'Fa0/6', 'Fa0/7', 'Fa0/8']

const lab: LabDef = {
  id: 'vlan-temelleri',
  title: 'VLAN temelleri: tek switch',
  summary: 'Aynı subnet\'teki dört PC\'yi iki VLAN\'a ayır ve VLAN\'ın broadcast domain\'i nasıl böldüğünü gör.',
  level: 'Başlangıç',
  tags: ['VLAN', 'Access port', 'hostname'],
  brief: [
    'Dört PC aynı switch\'e bağlı ve hepsi 192.168.1.0/24 subnet\'inde. Şu an hepsi VLAN 1\'de olduğu için birbirine ping atabiliyor.',
    'Switch\'in adını ERISIM-1 yap. VLAN 10 (YONETIM) ve VLAN 20 (MISAFIR) oluştur. PC1 ve PC2 VLAN 10\'da, PC3 ve PC4 VLAN 20\'de olsun.',
    'Kullanılmayan Fa0/5–Fa0/8 portlarını kapat.',
    'Sonuçta IP adresleri aynı subnet\'te olsa bile PC1, PC3\'e ulaşamamalı. VLAN\'lar farklı broadcast domain\'lerdir; aradaki trafik için router gerekir.',
    'Kısayol: interface range fa0/5 - 8 → shutdown. Kontrol: show vlan brief, show interfaces status.',
  ],
  view: { w: 760, h: 420 },
  devices: [
    { id: 'SW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0001.0001', ports: ports('Fa0/1-8', 'Gi0/1-2'), x: 380, y: 120 },
    { id: 'PC1', kind: 'pc', mac: '0050.7966.0101', x: 100, y: 330 },
    { id: 'PC2', kind: 'pc', mac: '0050.7966.0102', x: 285, y: 330 },
    { id: 'PC3', kind: 'pc', mac: '0050.7966.0103', x: 475, y: 330 },
    { id: 'PC4', kind: 'pc', mac: '0050.7966.0104', x: 660, y: 330 },
  ],
  links: [
    { a: ['PC1', 'eth0'], b: ['SW1', 'FastEthernet0/1'] },
    { a: ['PC2', 'eth0'], b: ['SW1', 'FastEthernet0/2'] },
    { a: ['PC3', 'eth0'], b: ['SW1', 'FastEthernet0/3'] },
    { a: ['PC4', 'eth0'], b: ['SW1', 'FastEthernet0/4'] },
  ],
  initialPcs: {
    PC1: { ip: '192.168.1.11', prefix: 24, gw: null },
    PC2: { ip: '192.168.1.12', prefix: 24, gw: null },
    PC3: { ip: '192.168.1.13', prefix: 24, gw: null },
    PC4: { ip: '192.168.1.14', prefix: 24, gw: null },
  },
  objectives: [
    {
      id: 'hostname',
      title: 'Switch adı ERISIM-1',
      hint: 'configure terminal → hostname ERISIM-1. Prompt hemen değişir.',
      check: (q) => q.hostname('SW1') === 'ERISIM-1',
    },
    {
      id: 'vlans',
      title: 'VLAN 10 (YONETIM) ve VLAN 20 (MISAFIR) tanımlı',
      hint: 'vlan 10 → name YONETIM, vlan 20 → name MISAFIR. Kontrol: show vlan brief',
      check: (q) => q.vlanName('SW1', 10) === 'YONETIM' && q.vlanName('SW1', 20) === 'MISAFIR',
    },
    {
      id: 'access',
      title: 'Fa0/1–2 VLAN 10, Fa0/3–4 VLAN 20 (access mod)',
      hint: 'interface range fa0/1 - 2 → switchport mode access → switchport access vlan 10',
      check: (q) => {
        const want: [string, number][] = [['Fa0/1', 10], ['Fa0/2', 10], ['Fa0/3', 20], ['Fa0/4', 20]]
        const bad = want.filter(([p, v]) => q.portCfg('SW1', p)?.mode !== 'access' || q.port('SW1', p)?.cfg.accessVlan !== v || q.port('SW1', p)?.inactive)
        return { ok: !bad.length, detail: bad.length ? 'Sorunlu: ' + bad.map(([p]) => p).join(', ') : undefined }
      },
    },
    {
      id: 'unused',
      title: 'Kullanılmayan Fa0/5–Fa0/8 kapalı',
      hint: 'interface range fa0/5 - 8 → shutdown. show interfaces status\'ta "disabled" görünür.',
      check: (q) => UNUSED.every((p) => q.phys('SW1', p)?.adminDown),
    },
    {
      id: 'same',
      title: 'PC1 ↔ PC2 ve PC3 ↔ PC4 ping çalışıyor',
      hint: 'Aynı VLAN\'daki PC\'ler hâlâ konuşabilmeli.',
      check: (q) => q.pcVlan('PC1') === 10 && q.pcVlan('PC3') === 20 && pingBoth(q, 'PC1', 'PC2') && pingBoth(q, 'PC3', 'PC4'),
    },
    {
      id: 'isolated',
      title: 'PC1 → PC3 ping çalışmıyor (VLAN izolasyonu)',
      hint: 'Aynı subnet ama farklı VLAN: ARP isteği diğer VLAN\'a ulaşmaz, ping timeout olur.',
      check: (q) => q.pcVlan('PC1') === 10 && q.pcVlan('PC3') === 20 && !q.ping('PC1', '192.168.1.13').ok,
    },
  ],
  solution: {
    SW1: `configure terminal
hostname ERISIM-1
vlan 10
 name YONETIM
vlan 20
 name MISAFIR
exit
interface range fa0/1 - 2
 switchport mode access
 switchport access vlan 10
interface range fa0/3 - 4
 switchport mode access
 switchport access vlan 20
interface range fa0/5 - 8
 shutdown
end
write memory`,
  },
}

export default lab
