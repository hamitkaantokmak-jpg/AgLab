// Konu #12 CDP/LLDP — yönlendirmeli lab (docs/dersler/cdp-lldp.md "4. Yönlendirmeli lab").
// Belgelenmemiş ağ: öğrenci yalnız R1'in adını bilir, komşu tablolarından ağı çıkarır ve
// bulduğunu port açıklamalarına yazar; LLDP'yi açıp kullanıcı portlarında CDP'yi kapatır.
import type { LabDef } from '../sim/types'
import type { LabQuery } from '../sim/query'
import { ports } from '../sim/util'

// SW-CORE'un uplink'leri ve karşı uçtaki cihaz (açıklama bu adı içermeli)
const UPLINKS: [string, string][] = [
  ['GigabitEthernet0/1', 'R1'],
  ['GigabitEthernet0/2', 'SW-KAT1'],
  ['GigabitEthernet0/3', 'SW-KAT2'],
]
const desc = (q: LabQuery, dev: string, port: string) => (q.cfg(dev).ifaces[port]?.description ?? '').toUpperCase()
const ACCESS: [string, string][] = [
  ['SW-KAT1', 'FastEthernet0/1'],
  ['SW-KAT1', 'FastEthernet0/2'],
  ['SW-KAT2', 'FastEthernet0/1'],
  ['SW-KAT2', 'FastEthernet0/2'],
]

const lab: LabDef = {
  id: 'cdp-kesif',
  title: 'CDP/LLDP: belgelenmemiş ağı çıkarmak ve etiketlemek',
  summary: 'Yalnız R1\'in adını biliyorsun. Komşu tablolarıyla ağı çiz, merkez switch\'in uplink\'lerini etiketle, LLDP\'yi aç ve kullanıcı portlarında CDP\'yi kapat.',
  level: 'Başlangıç',
  tags: ['Şube', 'Konu #12', 'CDP', 'LLDP', 'description', 'Belgeleme'],
  brief: [
    'Şubenin çizimi yok. Bildiğin tek şey: kullanıcıların gateway\'i R1. Tuvaldeki cihaz adlarına değil, komşu tablolarına güven.',
    'R1\'den başla: `show cdp neighbors` hangi cihazı, hangi iki port arasında gösteriyor? O cihaza geç ve aynı komutu orada çalıştır; komşudan komşuya ilerleyerek bir kâğıda çiz (her bağlantının iki ucundaki port adlarıyla). `show cdp neighbors detail` komşunun adresini ve modelini de verir.',
    'PC\'ler CDP göndermez: kat switch\'lerinin komşu tablosunda PC görünmez. Bir PC\'nin portunu bulmak için MAC tablosuna bakılır (Konu #3).',
    'Bulduğunu belgele: merkez switch\'in üç uplink portunun açıklamasına karşı ucun cihaz adını yaz (ör. "R1 Gi0/0"). Bir sonraki arızada "bu port nereye gidiyor?" sorusu `show interfaces status` ile tek bakışta cevaplanır.',
    'Ağa başka marka cihaz da eklenecek: merkez switch\'te standart LLDP\'yi aç (`show lldp` durumu gösterir; LLDP komşusu görmek için karşı ucun da LLDP çalıştırması gerekir). Kat switch\'lerinde kullanıcı portları (Fa0/1–2) cihaz bilgisini dışarı sızdırmasın: o portlarda CDP kapalı olmalı.',
  ],
  view: { w: 880, h: 500 },
  devices: [
    { id: 'R1', kind: 'switch', router: true, model: 'ISR4331', mac: '5254.0093.0001', ports: ports('Gi0/0-2'), x: 440, y: 60 },
    { id: 'SW-CORE', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0093.0010', ports: ports('Fa0/1-4', 'Gi0/1-3'), x: 440, y: 190 },
    { id: 'SW-KAT1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0093.0011', ports: ports('Fa0/1-4', 'Gi0/1-2'), x: 220, y: 320 },
    { id: 'SW-KAT2', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0093.0012', ports: ports('Fa0/1-4', 'Gi0/1-2'), x: 660, y: 320 },
    { id: 'ADMIN', kind: 'pc', mac: '0050.7966.9300', x: 760, y: 190 },
    { id: 'PC-11', kind: 'pc', mac: '0050.7966.9311', x: 140, y: 450 },
    { id: 'PC-12', kind: 'pc', mac: '0050.7966.9312', x: 300, y: 450 },
    { id: 'PC-21', kind: 'pc', mac: '0050.7966.9321', x: 580, y: 450 },
    { id: 'PC-22', kind: 'pc', mac: '0050.7966.9322', x: 740, y: 450 },
  ],
  links: [
    { a: ['R1', 'GigabitEthernet0/0'], b: ['SW-CORE', 'GigabitEthernet0/1'] },
    { a: ['SW-CORE', 'GigabitEthernet0/2'], b: ['SW-KAT1', 'GigabitEthernet0/1'] },
    { a: ['SW-CORE', 'GigabitEthernet0/3'], b: ['SW-KAT2', 'GigabitEthernet0/1'] },
    { a: ['ADMIN', 'eth0'], b: ['SW-CORE', 'FastEthernet0/1'] },
    { a: ['PC-11', 'eth0'], b: ['SW-KAT1', 'FastEthernet0/1'] },
    { a: ['PC-12', 'eth0'], b: ['SW-KAT1', 'FastEthernet0/2'] },
    { a: ['PC-21', 'eth0'], b: ['SW-KAT2', 'FastEthernet0/1'] },
    { a: ['PC-22', 'eth0'], b: ['SW-KAT2', 'FastEthernet0/2'] },
  ],
  initialConfig: {
    R1: `interface g0/0
 ip address 192.168.10.1 255.255.255.0
 no shutdown
exit`,
    'SW-CORE': `hostname SW-CORE
interface vlan 1
 ip address 192.168.10.2 255.255.255.0
 no shutdown
exit
ip default-gateway 192.168.10.1`,
    'SW-KAT1': `hostname SW-KAT1
interface vlan 1
 ip address 192.168.10.3 255.255.255.0
 no shutdown
exit
ip default-gateway 192.168.10.1`,
    'SW-KAT2': `hostname SW-KAT2
interface vlan 1
 ip address 192.168.10.4 255.255.255.0
 no shutdown
exit
ip default-gateway 192.168.10.1`,
  },
  initialPcs: {
    ADMIN: { ip: '192.168.10.100', prefix: 24, gw: '192.168.10.1' },
    'PC-11': { ip: '192.168.10.11', prefix: 24, gw: '192.168.10.1' },
    'PC-12': { ip: '192.168.10.12', prefix: 24, gw: '192.168.10.1' },
    'PC-21': { ip: '192.168.10.21', prefix: 24, gw: '192.168.10.1' },
    'PC-22': { ip: '192.168.10.22', prefix: 24, gw: '192.168.10.1' },
  },
  objectives: [
    {
      id: 'labels',
      title: 'SW-CORE\'un üç uplink\'inin açıklaması karşı ucun adını taşıyor',
      hint: 'SW-CORE\'da interface gi0/1 → description R1 Gi0/0; gi0/2 → description SW-KAT1 Gi0/1; gi0/3 → description SW-KAT2 Gi0/1. Kontrol: show interfaces status (Name sütunu)',
      check: (q) => {
        const bad = UPLINKS.filter(([p, peer]) => !desc(q, 'SW-CORE', p).includes(peer))
        return { ok: !bad.length, detail: bad.length ? 'Eksik/yanlış: ' + bad.map(([p]) => p.replace('GigabitEthernet', 'Gi')).join(', ') : undefined }
      },
    },
    {
      id: 'lldp',
      title: 'SW-CORE\'da LLDP açık',
      hint: 'lldp run (genel yapılandırma). LLDP IOS\'ta varsayılan kapalıdır; CDP açıktır. Kontrol: show lldp',
      check: (q) => q.cfg('SW-CORE').lldpRun === true,
    },
    {
      id: 'nocdp',
      title: 'Kat switch\'lerinin kullanıcı portlarında (Fa0/1–2) CDP kapalı',
      hint: 'interface range fa0/1 - 2 → no cdp enable (her iki kat switch\'inde). Uplink\'lerde CDP açık kalsın: komşu tablosu ona bağlı.',
      check: (q) => {
        const bad = ACCESS.filter(([d, p]) => q.cfg(d).ifaces[p]?.cdp !== false)
        return { ok: !bad.length, detail: bad.length ? 'Açık: ' + bad.map(([d, p]) => d + ' ' + p.replace('FastEthernet', 'Fa')).join(', ') : undefined }
      },
    },
    {
      id: 'uplinks',
      title: 'Uplink\'lerde CDP açık kalıyor (komşu tablosu bozulmadı)',
      hint: 'no cdp run ya da uplink\'te no cdp enable komşu keşfini kapatır: cdp run ve interface gi0/x → cdp enable ile geri aç.',
      check: (q) =>
        q.cfg('SW-CORE').cdpRun !== false &&
        UPLINKS.every(([p]) => q.cfg('SW-CORE').ifaces[p]?.cdp !== false) &&
        ['SW-KAT1', 'SW-KAT2'].every((d) => q.cfg(d).cdpRun !== false && q.cfg(d).ifaces['GigabitEthernet0/1']?.cdp !== false),
    },
  ],
  solution: {
    'SW-CORE': `configure terminal
interface gi0/1
 description R1 Gi0/0
interface gi0/2
 description SW-KAT1 Gi0/1
interface gi0/3
 description SW-KAT2 Gi0/1
exit
lldp run
end
`,
    'SW-KAT1': `configure terminal
interface range fa0/1 - 2
 no cdp enable
end
`,
    'SW-KAT2': `configure terminal
interface range fa0/1 - 2
 no cdp enable
end
`,
  },
}

export default lab
