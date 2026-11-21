// AğLab Konu #41 - EIGRP arıza giderme: auto-summary ile süreksiz ağ (Catalyst 12.2 varsayılanı),
// K değeri uyuşmazlığı (komşuluk yok), feasible successor ve variance ile eşit olmayan maliyetli yol.
import type { LabDef } from '../sim/types'
import { ports } from '../sim/util'

const l3sw = (id: string, mac: string, x: number, y: number) => ({
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

const lan = (ip: string) => `vlan 10
 name LAN
exit
interface fa0/1
 switchport mode access
 switchport access vlan 10
 spanning-tree portfast
exit
interface vlan 10
 ip address ${ip} 255.255.255.0
exit`

const routedSw = (port: string, ip: string) => `interface ${port}
 no switchport
 ip address ${ip} 255.255.255.0
exit`

const routedR = (port: string, ip: string, extra = '') => `interface ${port}
 ip address ${ip} 255.255.255.0${extra}
 no shutdown
exit`

const lab: LabDef = {
  id: 'eigrp-ariza',
  title: 'EIGRP arıza giderme: auto-summary, K değerleri ve variance',
  summary:
    'İki şube LAN\'ı 10.x ağlarında, aralarında 172.16.x taşıma ağı. Şubeler birbirine ulaşamıyor, yedek router komşuluk kurmuyor ve yedek yol hiç kullanılmıyor. Üç sorunu EIGRP tablolarından okuyarak bul.',
  level: 'İleri',
  tags: ['ENARSI', 'EIGRP', 'auto-summary', 'K değerleri', 'Feasible successor', 'variance', 'Arıza giderme'],
  brief: [
    'S1 ve S3 Catalyst 3560 (IOS 12.2) L3 switch\'ler: S1 LAN 10.1.1.0/24 (PC1), S3 LAN 10.3.3.0/24 (PC3). R2 merkez, R4 yedek router (ISR). Hepsi EIGRP AS 100.',
    'Bağlantılar: S1–R2 172.16.12.0/24, R2–S3 172.16.23.0/24 (birincil), R2–R4 172.16.24.0/24 ve R4–S3 172.16.34.0/24 (yedek yol). R2\'deki delay değerleri tasarımın parçası: değiştirme.',
    'Belirti 1: PC1, PC3\'e ulaşamıyor; R2\'nin tablosunda iki şube LAN\'ı yerine tek bir 10.0.0.0/8 rotası var. Belirti 2: R4 hiçbir komşu görmüyor; log\'da K-value mismatch. Belirti 3: R4 düzelince de R2, 10.3.3.0/24\'e yalnız birincil yoldan gidiyor.',
    'Kurallar: 12.2 sürümlü IOS\'ta EIGRP sınıflı sınırda otomatik özetler (auto-summary varsayılan açık). Komşular aynı K değerlerini kullanmalı. Feasible successor yalnız RD < FD ise olur; variance yalnız feasible successor\'ları eşit olmayan maliyetle tabloya ekler.',
    'Kontrol: show ip protocols, show ip eigrp neighbors, show ip eigrp topology, show ip route eigrp. PC1 ↔ PC3 ping.',
  ],
  view: { w: 960, h: 520 },
  devices: [
    l3sw('S1', '5254.00d0.0001', 120, 200),
    router('R2', '5254.00d0.0002', 400, 200),
    l3sw('S3', '5254.00d0.0003', 760, 200),
    router('R4', '5254.00d0.0004', 580, 380),
    { id: 'PC1', kind: 'pc', mac: '0050.7966.d001', x: 120, y: 420 },
    { id: 'PC3', kind: 'pc', mac: '0050.7966.d003', x: 880, y: 420 },
  ],
  links: [
    { a: ['S1', 'GigabitEthernet0/1'], b: ['R2', 'GigabitEthernet0/0'] },
    { a: ['R2', 'GigabitEthernet0/1'], b: ['S3', 'GigabitEthernet0/1'] },
    { a: ['R2', 'GigabitEthernet0/2'], b: ['R4', 'GigabitEthernet0/1'] },
    { a: ['R4', 'GigabitEthernet0/2'], b: ['S3', 'GigabitEthernet0/2'] },
    { a: ['PC1', 'eth0'], b: ['S1', 'FastEthernet0/1'] },
    { a: ['PC3', 'eth0'], b: ['S3', 'FastEthernet0/1'] },
  ],
  initialConfig: {
    // fault 1a: auto-summary 12.2 varsayılanı (açık)
    S1: `ip routing
${lan('10.1.1.1')}
${routedSw('gi0/1', '172.16.12.1')}
router eigrp 100
 network 10.0.0.0
 network 172.16.0.0
exit`,
    R2: `${routedR('g0/0', '172.16.12.2')}
${routedR('g0/1', '172.16.23.2', '\n delay 2')}
${routedR('g0/2', '172.16.24.2', '\n delay 3')}
router eigrp 100
 network 172.16.0.0
exit`,
    // fault 1b: auto-summary 12.2 varsayılanı (açık)
    S3: `ip routing
${lan('10.3.3.1')}
${routedSw('gi0/1', '172.16.23.3')}
${routedSw('gi0/2', '172.16.34.3')}
router eigrp 100
 network 10.0.0.0
 network 172.16.0.0
exit`,
    // fault 2: K değerleri farklı
    R4: `${routedR('g0/1', '172.16.24.4')}
${routedR('g0/2', '172.16.34.4')}
router eigrp 100
 metric weights 0 1 1 1 0 0
 network 172.16.0.0
exit`,
  },
  initialPcs: {
    PC1: { ip: '10.1.1.10', prefix: 24, gw: '10.1.1.1' },
    PC3: { ip: '10.3.3.10', prefix: 24, gw: '10.3.3.1' },
  },
  objectives: [
    {
      id: 'summary',
      title: 'R2\'de iki şube LAN\'ı ayrı rotalar (10.0.0.0/8 özeti yok)',
      hint: 'S1 ve S3: router eigrp 100 → no auto-summary. show ip protocols → "Automatic network summarization is not in effect".',
      check: (q) => {
        const a = q.route('R2', '10.1.1.0', 24)
        const b = q.route('R2', '10.3.3.0', 24)
        const sum = q.route('R2', '10.0.0.0', 8)
        return { ok: a?.code === 'D' && b?.code === 'D' && !sum, detail: sum ? 'R2\'de 10.0.0.0/8 özeti var' : !a || !b ? 'şube LAN rotası eksik' : undefined }
      },
    },
    {
      id: 'kvalue',
      title: 'R4, R2 ve S3 ile komşu',
      hint: 'R4: router eigrp 100 → no metric weights (varsayılan 0 1 0 1 0 0). show ip eigrp neighbors (R4).',
      check: (q) => {
        const ok = (q.eigrp('R4')?.nbrs ?? []).filter((n) => n.ok).map((n) => n.peerDev).sort()
        return { ok: ok.join() === 'R2,S3', detail: `R4 komşuları: ${ok.join(', ') || 'yok'}` }
      },
    },
    {
      id: 'fs',
      title: 'R2\'de 10.3.3.0/24 için R4 feasible successor',
      hint: 'show ip eigrp topology 10.3.3.0 255.255.255.0 (R2): R4 üzerinden yolun RD\'si FD\'den küçük. R4 komşu olunca kendiliğinden gelir.',
      check: (q) => {
        const t = q.eigrpTopo('R2', '10.3.3.0', 24)
        const fs = (t?.feasibleSuccessors ?? []).some((p) => p.nh === '172.16.24.4')
        return { ok: fs, detail: t ? `FD ${t.fd}, FS: ${(t.feasibleSuccessors ?? []).map((p) => p.nh).join(', ') || 'yok'}` : 'topolojide yok' }
      },
    },
    {
      id: 'variance',
      title: 'R2, 10.3.3.0/24\'ü iki yoldan (S3 ve R4) tabloya kurar',
      hint: 'R2: router eigrp 100 → variance 2. show ip route 10.3.3.0 → iki "via" satırı, metrikleri farklı.',
      check: (q) => {
        const r = q.route('R2', '10.3.3.0', 24)
        const nhs = (r?.paths ?? []).map((p) => p.nh).sort()
        return { ok: nhs.join() === '172.16.23.3,172.16.24.4', detail: r ? `yollar: ${nhs.join(', ')}` : 'rota yok' }
      },
    },
    {
      id: 'e2e',
      title: 'PC1 ↔ PC3 ping',
      hint: 'PC1\'de: ping 10.3.3.10. Özetler kalkınca iki yönde de rota olur.',
      check: (q) => q.ping('PC1', '10.3.3.10').ok && q.ping('PC3', '10.1.1.10').ok,
    },
  ],
  solution: {
    S1: `configure terminal
router eigrp 100
 no auto-summary
end
write memory`,
    S3: `configure terminal
router eigrp 100
 no auto-summary
end
write memory`,
    R4: `configure terminal
router eigrp 100
 no metric weights
end
write memory`,
    R2: `configure terminal
router eigrp 100
 variance 2
end
write memory`,
  },
}

export default lab
