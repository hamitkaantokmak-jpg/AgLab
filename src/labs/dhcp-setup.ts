// Konu #9 DHCP — yönlendirmeli lab (docs/dersler/dhcp.md "4. Yönlendirmeli lab").
// R1 1. kata kendi havuzundan dağıtır; 2. kat isteğini relay ile sunucu odasındaki SRV'ye iletir.
// Hedefler PC'nin `ip dhcp` komutuna bağlı değildir: DHCP DISCOVER'ın sonucu durum
// değiştirmeden hesaplanır (dhcpDiscover), böylece referans çözüm yalnız IOS komutlarıdır.
import type { LabDef } from '../sim/types'
import type { LabQuery } from '../sim/query'
import { dhcpDiscover } from '../sim/dhcp'
import { ipToInt, ports } from '../sim/util'

const SRV = '192.168.100.10'
const offer = (q: LabQuery, pc: string) => dhcpDiscover(q.d, pc, [])

const lab: LabDef = {
  id: 'dhcp-kurulum',
  title: 'DHCP: havuz, dışlama ve relay (ip helper-address)',
  summary: 'R1\'de 1. kat için DHCP havuzu kur, gateway adreslerini dışla; 2. katın isteğini relay ile sunucu odasındaki DHCP sunucusuna ilet.',
  level: 'Başlangıç',
  tags: ['Şube', 'Konu #9', 'DHCP', 'Relay', 'ip helper-address', '169.254'],
  brief: [
    'R1\'in üç arayüzü hazır: Gi0/0 1. kat (192.168.10.1/24), Gi0/1 2. kat (192.168.20.1/24), Gi0/2 sunucu odası (192.168.100.1/24). Sunucu odasındaki SRV (192.168.100.10) DHCP ve DNS servisi çalıştırıyor. 1. kattaki yazıcının sabit adresi 192.168.10.5.',
    'Önce gözle: PC-11\'de `ip dhcp` yaz. "Can\'t find dhcp server" ve 169.254.x.x adresi, 1. katta DHCP veren kimse olmadığını gösterir.',
    '1. kat için R1\'de havuz kur: 192.168.10.1–192.168.10.20 dışlansın (gateway ve yazıcılar), havuz KAT1 192.168.10.0/24 ağını dağıtsın, default-router 192.168.10.1 ve dns-server 192.168.100.10 versin.',
    '2. kat adreslerini R1 değil SRV dağıtacak. PC-21\'in yayını R1\'de durur; R1\'in 2. kat arayüzü isteği SRV\'ye iletmeli.',
    'Her adımdan sonra PC\'de yeniden `ip dhcp` ve `show ip` ile sonucu gör; R1\'de `show ip dhcp binding` kiralamaları listeler.',
  ],
  view: { w: 860, h: 470 },
  devices: [
    { id: 'R1', kind: 'switch', router: true, model: 'ISR4331', mac: '5254.0090.0001', ports: ports('Gi0/0-2'), x: 430, y: 80 },
    { id: 'SW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0090.0011', ports: ports('Fa0/1-4', 'Gi0/1-2'), x: 200, y: 230 },
    { id: 'SW2', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0090.0012', ports: ports('Fa0/1-4', 'Gi0/1-2'), x: 520, y: 230 },
    { id: 'PC-11', kind: 'pc', mac: '0050.7966.9011', x: 110, y: 400 },
    { id: 'PC-12', kind: 'pc', mac: '0050.7966.9012', x: 290, y: 400 },
    { id: 'PC-21', kind: 'pc', mac: '0050.7966.9021', x: 520, y: 400 },
    { id: 'SRV', kind: 'pc', server: true, mac: '0050.7966.9100', x: 760, y: 230 },
    { id: 'YAZICI', kind: 'pc', mac: '0050.7966.9050', x: 40, y: 230 },
  ],
  links: [
    { a: ['R1', 'GigabitEthernet0/0'], b: ['SW1', 'GigabitEthernet0/1'] },
    { a: ['R1', 'GigabitEthernet0/1'], b: ['SW2', 'GigabitEthernet0/1'] },
    { a: ['R1', 'GigabitEthernet0/2'], b: ['SRV', 'eth0'] },
    { a: ['PC-11', 'eth0'], b: ['SW1', 'FastEthernet0/1'] },
    { a: ['PC-12', 'eth0'], b: ['SW1', 'FastEthernet0/2'] },
    { a: ['PC-21', 'eth0'], b: ['SW2', 'FastEthernet0/1'] },
    { a: ['YAZICI', 'eth0'], b: ['SW1', 'FastEthernet0/3'] },
  ],
  initialConfig: {
    R1: `interface g0/0
 ip address 192.168.10.1 255.255.255.0
 no shutdown
interface g0/1
 ip address 192.168.20.1 255.255.255.0
 no shutdown
interface g0/2
 ip address 192.168.100.1 255.255.255.0
 no shutdown
exit`,
    SW1: `interface range fa0/1 - 4
 switchport mode access
exit`,
    SW2: `interface range fa0/1 - 4
 switchport mode access
exit`,
  },
  initialPcs: {
    SRV: { ip: SRV, prefix: 24, gw: '192.168.100.1', services: { dhcp: true, dns: true } },
    YAZICI: { ip: '192.168.10.5', prefix: 24, gw: '192.168.10.1' },
  },
  objectives: [
    {
      id: 'exclude',
      title: '192.168.10.1–192.168.10.20 dağıtılmıyor',
      hint: 'ip dhcp excluded-address 192.168.10.1 192.168.10.20 (havuzdan önce yaz). Kontrol: show running-config | include excluded',
      check: (q) => {
        const n = (ip: string) => ipToInt(ip) ?? -1
        return (q.cfg('R1').dhcpExcluded ?? []).some((e) => n(e.lo) <= n('192.168.10.1') && n(e.hi) >= n('192.168.10.20'))
      },
    },
    {
      id: 'pool',
      title: 'PC-11 R1\'den 192.168.10.21, gateway 192.168.10.1 ve DNS 192.168.100.10 alır',
      hint: 'ip dhcp pool KAT1 → network 192.168.10.0 255.255.255.0 → default-router 192.168.10.1 → dns-server 192.168.100.10. PC-11\'de ip dhcp ile dene.',
      check: (q) => {
        const r = offer(q, 'PC-11')
        if (!r.ok) return { ok: false, detail: 'DHCP yanıtı yok' }
        const ok = r.server === 'R1' && r.ip === '192.168.10.21' && r.gw === '192.168.10.1' && r.dns === SRV
        return { ok, detail: ok ? undefined : `Teklif: ${r.ip}, GW ${r.gw ?? '-'}, DNS ${r.dns ?? '-'}` }
      },
    },
    {
      id: 'relay',
      title: 'PC-21 adresini SRV\'den relay ile alır (192.168.20.x, gateway 192.168.20.1)',
      hint: 'interface g0/1 → ip helper-address 192.168.100.10. PC-21\'de ip dhcp; show ip\'te DHCP SERVER 192.168.100.10 görünür.',
      check: (q) => {
        const r = offer(q, 'PC-21')
        return r.ok && r.server === 'SRV' && !!r.relay && r.gw === '192.168.20.1' && r.ip.startsWith('192.168.20.')
      },
    },
  ],
  solution: {
    R1: `configure terminal
ip dhcp excluded-address 192.168.10.1 192.168.10.20
ip dhcp pool KAT1
 network 192.168.10.0 255.255.255.0
 default-router 192.168.10.1
 dns-server 192.168.100.10
exit
interface g0/1
 ip helper-address 192.168.100.10
end
`,
  },
}

export default lab
