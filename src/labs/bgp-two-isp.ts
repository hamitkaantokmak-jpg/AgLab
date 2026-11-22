// AğLab Konu #32 - eBGP arıza giderme: iki ISP'li şube (docs/dersler/bgp.md S1–S3 ve Bölüm 4).
// Arızalar: ISP-A komşusunda yanlış remote-as (S1), /23 bloğu RIB'de tam eşleşme bulamıyor (S2),
// LP 200 route-map'i yedek ISP-B'nin girişine uygulanmış (S3; taşındıktan sonra soft clear ister).
// Görev: ISP-B'ye duyuruya prepend ile gelen trafiği ISP-A'ya çekmek (soft out).
import type { LabDef } from '../sim/types'
import { ports } from '../sim/util'

const router = (id: string, mac: string, x: number, y: number) => ({
  id,
  kind: 'switch' as const,
  router: true,
  model: 'ISR4331',
  mac,
  ports: ports('Gi0/0-3'),
  x,
  y,
})

const ifc = (port: string, ip: string, mask = '255.255.255.252') => `interface ${port}
 ip address ${ip} ${mask}
 no shutdown
exit`

const LAN = '255.255.255.0'

const lab: LabDef = {
  id: 'bgp-iki-isp',
  title: 'eBGP arıza giderme: iki ISP\'li şube (oturum, önek duyurma, politika)',
  summary:
    'Şube R1 (AS 65010) iki ISP\'ye eBGP ile bağlı. Birincil ISP-A oturumu kurulmuyor, şirketin /23 bloğu internette görünmüyor ve çıkış trafiği yedek hattan gidiyor. Üç sorunu BGP tablolarından okuyarak bul; sonra gelen trafiği de birincil hatta çek.',
  level: 'İleri',
  tags: ['ENCOR', 'ENARSI', 'BGP', 'eBGP', 'Local Preference', 'AS_PATH prepend', 'route-map', 'Arıza giderme'],
  brief: [
    'R1 şube kenar router\'ı, AS 65010. LAN\'lar 198.51.100.0/24 (PC1) ve 198.51.101.0/24 (PC2); şirketin bloğu 198.51.100.0/23. ISP-A AS 64500 (203.0.113.1, birincil), ISP-B AS 64600 (192.0.2.1, yedek). İnternet tarafı INET AS 64700; sunucu SRV 203.0.114.10. Yalnız R1\'i düzelt: ISP\'ler ve INET operatör tarafı.',
    'Belirti 1: show ip bgp summary\'de ISP-A sürekli Active. show ip bgp neighbors 203.0.113.1 son hatayı söyler. İstersen R1\'de Gi0/1\'i kapatıp aç (shutdown, no shutdown) ve log\'daki BGP NOTIFICATION satırına bak: sondaki onaltılı sayı karşı tarafın gerçek AS\'idir.',
    'Belirti 2: PC1 SRV\'ye ping atamıyor. R1\'de show ip bgp: 198.51.100.0/23 tabloda yok; INET\'te show ip route 198.51.100.0 de boş.',
    'Belirti 3: show ip bgp\'de ISP-B\'den gelen yolların LocPrf sütununda 200 var; ISP-A düzelince de 203.0.114.0/24\'e çıkış ISP-B\'den kalıyor. Birincil hat ISP-A: çıkış ondan olmalı.',
    'Görev: Gelen trafik de ISP-A\'dan gelsin: INET 198.51.100.0/23\'e ISP-A üzerinden gitmeli. Bunu R1\'den, ISP-B\'ye giden duyuruyu uzatarak yap.',
    'Kurallar: network satırı RIB\'de birebir aynı önek/maske ister. Politika (route-map) değişikliği oturum kurulu iken kendiliğinden uygulanmaz: clear ip bgp <komşu> soft in|out (ya da soft) gerekir. LP girişte (in), prepend çıkışta (out) işe yarar.',
    'Kontrol: show ip bgp summary, show ip bgp, show ip bgp 203.0.114.0, show ip bgp neighbors <ip> [advertised-routes], show route-map, INET\'te show ip bgp 198.51.100.0 255.255.254.0. PC1 ve PC2\'den ping ve trace 203.0.114.10.',
  ],
  view: { w: 980, h: 540 },
  devices: [
    router('R1', '5254.00e0.0001', 200, 270),
    router('ISP-A', '5254.00e0.0002', 500, 130),
    router('ISP-B', '5254.00e0.0003', 500, 410),
    router('INET', '5254.00e0.0004', 780, 270),
    { id: 'PC1', kind: 'pc', mac: '0050.7966.e001', x: 60, y: 150 },
    { id: 'PC2', kind: 'pc', mac: '0050.7966.e002', x: 60, y: 400 },
    { id: 'SRV', kind: 'pc', mac: '0050.7966.e010', x: 920, y: 270 },
  ],
  links: [
    { a: ['PC1', 'eth0'], b: ['R1', 'GigabitEthernet0/0'] },
    { a: ['PC2', 'eth0'], b: ['R1', 'GigabitEthernet0/3'] },
    { a: ['R1', 'GigabitEthernet0/1'], b: ['ISP-A', 'GigabitEthernet0/1'] },
    { a: ['R1', 'GigabitEthernet0/2'], b: ['ISP-B', 'GigabitEthernet0/1'] },
    { a: ['ISP-A', 'GigabitEthernet0/2'], b: ['INET', 'GigabitEthernet0/1'] },
    { a: ['ISP-B', 'GigabitEthernet0/2'], b: ['INET', 'GigabitEthernet0/2'] },
    { a: ['INET', 'GigabitEthernet0/0'], b: ['SRV', 'eth0'] },
  ],
  initialConfig: {
    // S1: remote-as 64501 (doğrusu 64500); S2: /23 için Null0 yok; S3: LP 200 ISP-B'nin girişinde
    R1: `hostname R1
${ifc('g0/0', '198.51.100.1', LAN)}
${ifc('g0/3', '198.51.101.1', LAN)}
${ifc('g0/1', '203.0.113.2')}
${ifc('g0/2', '192.0.2.2')}
route-map PRIMARY-IN permit 10
 set local-preference 200
exit
router bgp 65010
 bgp router-id 10.255.0.1
 network 198.51.100.0 mask 255.255.254.0
 neighbor 203.0.113.1 remote-as 64501
 neighbor 203.0.113.1 description ISP-A birincil
 neighbor 192.0.2.1 remote-as 64600
 neighbor 192.0.2.1 description ISP-B yedek
 neighbor 192.0.2.1 route-map PRIMARY-IN in
exit`,
    'ISP-A': `hostname ISP-A
${ifc('g0/1', '203.0.113.1')}
${ifc('g0/2', '10.24.0.1')}
router bgp 64500
 neighbor 203.0.113.2 remote-as 65010
 neighbor 10.24.0.2 remote-as 64700
exit`,
    'ISP-B': `hostname ISP-B
${ifc('g0/1', '192.0.2.1')}
${ifc('g0/2', '10.34.0.1')}
router bgp 64600
 neighbor 192.0.2.2 remote-as 65010
 neighbor 10.34.0.2 remote-as 64700
exit`,
    INET: `hostname INET
${ifc('g0/0', '203.0.114.1', LAN)}
${ifc('g0/1', '10.24.0.2')}
${ifc('g0/2', '10.34.0.2')}
router bgp 64700
 network 203.0.114.0
 neighbor 10.24.0.1 remote-as 64500
 neighbor 10.34.0.1 remote-as 64600
exit`,
  },
  initialPcs: {
    PC1: { ip: '198.51.100.10', prefix: 24, gw: '198.51.100.1' },
    PC2: { ip: '198.51.101.10', prefix: 24, gw: '198.51.101.1' },
    SRV: { ip: '203.0.114.10', prefix: 24, gw: '203.0.114.1' },
  },
  objectives: [
    {
      id: 'session',
      title: 'R1 – ISP-A oturumu Established',
      hint: 'R1: router bgp 65010 → neighbor 203.0.113.1 remote-as 64500. show ip bgp summary → State/PfxRcd sütununda sayı.',
      check: (q) => {
        const s = q.bgpSession('R1', '203.0.113.1')
        return { ok: s?.state === 'Established', detail: s ? `ISP-A: ${s.state}` : 'komşu tanımı yok' }
      },
    },
    {
      id: 'announce',
      title: 'Şirket bloğu 198.51.100.0/23 iki ISP\'ye de duyuruluyor',
      hint: 'R1: ip route 198.51.100.0 255.255.254.0 Null0. show ip bgp → 198.51.100.0/23, next hop 0.0.0.0; show ip bgp neighbors 192.0.2.1 advertised-routes.',
      check: (q) => {
        const a = q.bgpPaths('ISP-A', '198.51.100.0', 23)?.some((p) => p.from === '203.0.113.2')
        const b = q.bgpPaths('ISP-B', '198.51.100.0', 23)?.some((p) => p.from === '192.0.2.2')
        return { ok: !!a && !!b, detail: !q.bgpPaths('R1', '198.51.100.0', 23) ? 'R1\'in BGP tablosunda /23 yok' : `ISP-A ${a ? 'alıyor' : 'almıyor'}, ISP-B ${b ? 'alıyor' : 'almıyor'}` }
      },
    },
    {
      id: 'outbound',
      title: 'R1, 203.0.114.0/24\'e ISP-A\'dan çıkıyor',
      hint: 'route-map PRIMARY-IN\'i ISP-A\'nın girişine taşı: no neighbor 192.0.2.1 route-map PRIMARY-IN in, neighbor 203.0.113.1 route-map PRIMARY-IN in; sonra clear ip bgp * soft in. show ip bgp 203.0.114.0.',
      check: (q) => {
        const best = q.bgpPaths('R1', '203.0.114.0', 24)?.find((p) => p.best)
        const r = q.route('R1', '203.0.114.0', 24)
        return { ok: best?.from === '203.0.113.1' && r?.code === 'B' && r.nh === '203.0.113.1', detail: best ? `en iyi yol ${best.from}, LP ${best.lp}` : 'BGP tablosunda yok' }
      },
    },
    {
      id: 'inbound',
      title: 'INET, 198.51.100.0/23\'e ISP-A üzerinden gidiyor',
      hint: 'R1: route-map ISP-B-OUT permit 10 → set as-path prepend 65010 65010; neighbor 192.0.2.1 route-map ISP-B-OUT out; clear ip bgp 192.0.2.1 soft out. INET: show ip bgp 198.51.100.0 255.255.254.0.',
      check: (q) => {
        const best = q.bgpPaths('INET', '198.51.100.0', 23)?.find((p) => p.best)
        return { ok: best?.from === '10.24.0.1', detail: best ? `INET en iyi yol ${best.from}, AS_PATH ${best.asPath.join(' ')}` : 'INET\'te /23 yok' }
      },
    },
    {
      id: 'e2e',
      title: 'PC1 ve PC2 → SRV ping',
      hint: 'PC1\'de: ping 203.0.114.10. /23 duyurulunca dönüş yolu oluşur; trace ile çıkışın ISP-A\'dan (203.0.113.1) olduğunu gör.',
      check: (q) => q.ping('PC1', '203.0.114.10').ok && q.ping('PC2', '203.0.114.10').ok,
    },
  ],
  solution: {
    R1: `configure terminal
ip route 198.51.100.0 255.255.254.0 Null0
route-map ISP-B-OUT permit 10
 set as-path prepend 65010 65010
exit
router bgp 65010
 neighbor 203.0.113.1 remote-as 64500
 no neighbor 192.0.2.1 route-map PRIMARY-IN in
 neighbor 203.0.113.1 route-map PRIMARY-IN in
 neighbor 192.0.2.1 route-map ISP-B-OUT out
end
clear ip bgp * soft
write memory`,
  },
}

export default lab
