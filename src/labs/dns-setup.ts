// Konu #10 DNS — yönlendirmeli lab (docs/dersler/dns.md "4. Yönlendirmeli lab").
// İstemciler DNS sunucusunu DHCP'den öğrenir; iki havuzdaki dns-server ayarı bozuk. Öğrenci
// "ad çözülmüyor" ile "adres erişilemiyor"u ayırır, havuzları düzeltir. Hedefler DHCP
// teklifini durum değiştirmeden hesaplar (dhcpDiscover); referans çözüm yalnız IOS komutlarıdır.
import type { LabDef } from '../sim/types'
import type { LabQuery } from '../sim/query'
import { dhcpDiscover } from '../sim/dhcp'
import { ports } from '../sim/util'

const DNS = '192.168.100.10'
const dnsOf = (q: LabQuery, pc: string) => {
  const r = dhcpDiscover(q.d, pc, [])
  return r.ok ? r.dns : null
}

const lab: LabDef = {
  id: 'dns-kurulum',
  title: 'DNS: istemciye doğru DNS sunucusunu dağıtmak',
  summary: 'İki katın DHCP havuzunda DNS ayarı bozuk. nslookup ile ad çözümleme hatasını IP bağlantı hatasından ayır ve havuzları düzelt.',
  level: 'Başlangıç',
  tags: ['Şube', 'Konu #10', 'DNS', 'nslookup', 'DHCP', 'dns-server'],
  brief: [
    'Şube ağı Konu #9\'daki gibi: R1 iki kata DHCP ile adres veriyor (havuzlar KAT1 ve KAT2). Sunucu odasında DNS sunucusu SRV (192.168.100.10) ve web sunucusu ERP (192.168.100.20) var.',
    'Şikâyet: "ERP açılmıyor". PC-11\'de `ip dhcp`, sonra `show ip`: hangi DNS sunucusunu aldı? `nslookup ERP` ve `ping 192.168.100.20` sonuçlarını karşılaştır: biri çalışıp öbürü çalışmıyorsa sorun ağda değil, isim çözümlemede.',
    'PC-21 için aynısını yap; bu katın belirtisi farklı olabilir ("timed out" ile "Default servers are not available" aynı şey değildir).',
    'Düzeltmeyi istemcide değil, adresi dağıtan yerde yap: R1\'deki iki havuz da DNS olarak 192.168.100.10\'u vermeli. Sonra PC\'lerde yeniden `ip dhcp` ve `nslookup ERP` ile doğrula.',
    'Not: AğLab\'ın DNS sunucusu ağdaki her cihazı kendi adıyla tanır; ayrı kayıt girmek gerekmez (SRV\'de `show dns`).',
  ],
  view: { w: 860, h: 470 },
  devices: [
    { id: 'R1', kind: 'switch', router: true, model: 'ISR4331', mac: '5254.0091.0001', ports: ports('Gi0/0-2'), x: 430, y: 80 },
    { id: 'SW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0091.0011', ports: ports('Fa0/1-4', 'Gi0/1-2'), x: 200, y: 230 },
    { id: 'SW2', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0091.0012', ports: ports('Fa0/1-4', 'Gi0/1-2'), x: 430, y: 230 },
    { id: 'SW3', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0091.0013', ports: ports('Fa0/1-4', 'Gi0/1-2'), x: 690, y: 230 },
    { id: 'PC-11', kind: 'pc', mac: '0050.7966.9111', x: 200, y: 400 },
    { id: 'PC-21', kind: 'pc', mac: '0050.7966.9121', x: 430, y: 400 },
    { id: 'SRV', kind: 'pc', server: true, mac: '0050.7966.9200', x: 620, y: 400 },
    { id: 'ERP', kind: 'pc', server: true, mac: '0050.7966.9201', x: 760, y: 400 },
  ],
  links: [
    { a: ['R1', 'GigabitEthernet0/0'], b: ['SW1', 'GigabitEthernet0/1'] },
    { a: ['R1', 'GigabitEthernet0/1'], b: ['SW2', 'GigabitEthernet0/1'] },
    { a: ['R1', 'GigabitEthernet0/2'], b: ['SW3', 'GigabitEthernet0/1'] },
    { a: ['PC-11', 'eth0'], b: ['SW1', 'FastEthernet0/1'] },
    { a: ['PC-21', 'eth0'], b: ['SW2', 'FastEthernet0/1'] },
    { a: ['SRV', 'eth0'], b: ['SW3', 'FastEthernet0/1'] },
    { a: ['ERP', 'eth0'], b: ['SW3', 'FastEthernet0/2'] },
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
exit
ip dhcp excluded-address 192.168.10.1 192.168.10.20
ip dhcp excluded-address 192.168.20.1 192.168.20.20
ip dhcp pool KAT1
 network 192.168.10.0 255.255.255.0
 default-router 192.168.10.1
 dns-server 192.168.100.11
exit
ip dhcp pool KAT2
 network 192.168.20.0 255.255.255.0
 default-router 192.168.20.1
exit`,
    SW1: `interface range fa0/1 - 4
 switchport mode access
exit`,
    SW2: `interface range fa0/1 - 4
 switchport mode access
exit`,
    SW3: `interface range fa0/1 - 4
 switchport mode access
exit`,
  },
  initialPcs: {
    SRV: { ip: DNS, prefix: 24, gw: '192.168.100.1', services: { dns: true } },
    ERP: { ip: '192.168.100.20', prefix: 24, gw: '192.168.100.1', services: { http: true } },
  },
  objectives: [
    {
      id: 'kat1',
      title: '1. kat DHCP\'den DNS olarak 192.168.100.10 alıyor',
      hint: 'ip dhcp pool KAT1 → dns-server 192.168.100.10 (yeni değer eskisinin yerine geçer). PC-11\'de ip dhcp, sonra nslookup ERP.',
      check: (q) => {
        const dns = dnsOf(q, 'PC-11')
        return { ok: dns === DNS, detail: dns === DNS ? undefined : 'Dağıtılan DNS: ' + (dns ?? 'yok') }
      },
    },
    {
      id: 'kat2',
      title: '2. kat DHCP\'den DNS olarak 192.168.100.10 alıyor',
      hint: 'ip dhcp pool KAT2 → dns-server 192.168.100.10. Havuzda DNS hiç yoksa istemci "Default servers are not available" der.',
      check: (q) => {
        const dns = dnsOf(q, 'PC-21')
        return { ok: dns === DNS, detail: dns === DNS ? undefined : 'Dağıtılan DNS: ' + (dns ?? 'yok') }
      },
    },
    {
      id: 'server',
      title: 'DNS sunucusu ve ERP iki kattan da erişilebilir (R1\'in iki LAN arayüzünden ping)',
      hint: 'Bu hedef baştan sağlam: ping çalıştığı halde ad çözülmüyorsa sorun bağlantıda değildir. Kontrol: ping 192.168.100.10 source g0/0',
      check: (q) => q.ping('SRV', '192.168.10.1').ok && q.ping('SRV', '192.168.20.1').ok && q.ping('ERP', '192.168.10.1').ok,
    },
  ],
  solution: {
    R1: `configure terminal
ip dhcp pool KAT1
 dns-server 192.168.100.10
exit
ip dhcp pool KAT2
 dns-server 192.168.100.10
end
`,
  },
}

export default lab
