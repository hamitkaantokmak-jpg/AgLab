// CCNA 200-301: Initial Switch Configuration (hostname, management IP, default gateway, copy run start).
import type { LabDef } from '../sim/types'
import type { LabQuery } from '../sim/query'
import { ports } from '../sim/util'

const MGMT: Record<string, string> = { ASW1: '192.168.99.11', ASW2: '192.168.99.12' }

const mgmtUp = (q: LabQuery, dev: string) => {
  const s = q.cfg(dev).svis['99']
  return !!s?.ip && s.ip.addr === MGMT[dev] && s.ip.mask === '255.255.255.0' && q.sviUp(dev, 99)
}

const lab: LabDef = {
  id: 'yonetim-vlan',
  title: 'Switch yönetimi: hostname, yönetim VLAN\'ı, varsayılan ağ geçidi',
  summary: 'İki erişim switch\'ine isim ver, VLAN 99 üzerinden yönetim IP\'si ata, ip default-gateway ile başka VLAN\'dan erişilebilir yap ve kaydet.',
  level: 'Başlangıç',
  tags: ['CCNA', 'Yönetim SVI', 'Default gateway', 'copy run start'],
  brief: [
    'CORE (Catalyst 3560) hazır: VLAN 10 (KULLANICI) ve VLAN 99 (YONETIM) arasında yönlendirme yapıyor. Vlan10 = 192.168.10.1/24, Vlan99 = 192.168.99.1/24. Switch\'ler arası trunk\'lar kurulu.',
    'İki erişim switch\'i fabrikadan yeni çıkmış gibi "Switch" adıyla geliyor. Hostname\'lerini ASW1 ve ASW2 yap.',
    'Her erişim switch\'inde VLAN 99\'u YONETIM adıyla oluştur ve interface vlan 99\'a yönetim adresi ver: ASW1 = 192.168.99.11/24, ASW2 = 192.168.99.12/24.',
    'Bir L2 switch yönlendirme yapmaz. Başka bir VLAN\'daki yöneticiye cevap verebilmesi için ip default-gateway 192.168.99.1 gerekir.',
    'Kontrol: PC1 (VLAN 10) iki switch\'in yönetim adresine ping atabilsin. Bitirince yapılandırmayı NVRAM\'e kaydet (copy running-config startup-config).',
  ],
  view: { w: 860, h: 470 },
  devices: [
    { id: 'CORE', kind: 'switch', model: 'WS-C3560-24PS', mac: '5254.0020.0001', ports: ports('Fa0/1-4', 'Gi0/1-2'), l3: true, needsEncap: true, x: 430, y: 80 },
    { id: 'ASW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0020.0011', ports: ports('Fa0/1-4', 'Gi0/1-2'), x: 230, y: 250 },
    { id: 'ASW2', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0020.0012', ports: ports('Fa0/1-4', 'Gi0/1-2'), x: 630, y: 250 },
    { id: 'PC1', kind: 'pc', mac: '0050.7966.2001', x: 230, y: 410 },
    { id: 'PC2', kind: 'pc', mac: '0050.7966.2002', x: 630, y: 410 },
  ],
  links: [
    { a: ['CORE', 'GigabitEthernet0/1'], b: ['ASW1', 'GigabitEthernet0/1'] },
    { a: ['CORE', 'GigabitEthernet0/2'], b: ['ASW2', 'GigabitEthernet0/1'] },
    { a: ['PC1', 'eth0'], b: ['ASW1', 'FastEthernet0/1'] },
    { a: ['PC2', 'eth0'], b: ['ASW2', 'FastEthernet0/1'] },
  ],
  initialConfig: {
    CORE: `ip routing
vlan 10
 name KULLANICI
vlan 99
 name YONETIM
exit
interface range gi0/1 - 2
 switchport trunk encapsulation dot1q
 switchport mode trunk
exit
interface vlan 10
 ip address 192.168.10.1 255.255.255.0
interface vlan 99
 ip address 192.168.99.1 255.255.255.0
exit`,
    ASW1: `hostname Switch
vlan 10
 name KULLANICI
exit
interface gi0/1
 switchport mode trunk
interface fa0/1
 switchport mode access
 switchport access vlan 10
exit`,
    ASW2: `hostname Switch
vlan 10
 name KULLANICI
exit
interface gi0/1
 switchport mode trunk
interface fa0/1
 switchport mode access
 switchport access vlan 10
exit`,
  },
  initialPcs: {
    PC1: { ip: '192.168.10.10', prefix: 24, gw: '192.168.10.1' },
    PC2: { ip: '192.168.10.20', prefix: 24, gw: '192.168.10.1' },
  },
  objectives: [
    {
      id: 'hostname',
      title: 'Erişim switch\'lerinin adı ASW1 ve ASW2',
      hint: 'configure terminal → hostname ASW1. Prompt hemen değişir.',
      check: (q) => q.hostname('ASW1') === 'ASW1' && q.hostname('ASW2') === 'ASW2',
    },
    {
      id: 'vlan99',
      title: 'VLAN 99 iki erişim switch\'inde YONETIM adıyla var',
      hint: 'vlan 99 → name YONETIM. VLAN yoksa interface vlan 99 hiçbir zaman up olmaz.',
      check: (q) => ['ASW1', 'ASW2'].every((d) => q.vlanName(d, 99) === 'YONETIM'),
    },
    {
      id: 'svi',
      title: 'Yönetim SVI\'ları doğru adresle up/up',
      hint: 'interface vlan 99 → ip address 192.168.99.11 255.255.255.0. Kontrol: show ip interface brief',
      check: (q) => {
        const bad = ['ASW1', 'ASW2'].filter((d) => !mgmtUp(q, d))
        return { ok: !bad.length, detail: bad.length ? 'Eksik/down: ' + bad.join(', ') : undefined }
      },
    },
    {
      id: 'local',
      title: 'CORE, iki switch\'in yönetim adresine ping atabiliyor',
      hint: 'Aynı VLAN içinde gateway gerekmez. Burada sorun varsa trunk\'ın VLAN 99\'u taşıdığını kontrol et: show interfaces trunk',
      check: (q) => q.ping('CORE', MGMT.ASW1!).ok && q.ping('CORE', MGMT.ASW2!).ok,
    },
    {
      id: 'gateway',
      title: 'PC1 (VLAN 10), ASW1 ve ASW2\'ye ping atabiliyor',
      hint: 'Switch cevabı başka bir ağa göndermek zorunda: ip default-gateway 192.168.99.1. Kontrol: show ip route (L2 switch\'te "Default gateway is ..." yazar)',
      check: (q) => q.ping('PC1', MGMT.ASW1!).ok && q.ping('PC1', MGMT.ASW2!).ok,
    },
    {
      id: 'saved',
      title: 'Yapılandırma iki switch\'te de kaydedildi',
      hint: 'copy running-config startup-config (veya write memory). Kayıttan sonra yaptığın her değişiklik tekrar kaydedilmeli.',
      check: (q) => ['ASW1', 'ASW2'].every((d) => q.saved(d) && mgmtUp(q, d) && !!q.cfg(d).defaultGateway),
    },
  ],
  solution: {
    ASW1: `configure terminal
hostname ASW1
vlan 99
 name YONETIM
exit
interface vlan 99
 ip address 192.168.99.11 255.255.255.0
 no shutdown
exit
ip default-gateway 192.168.99.1
end
copy running-config startup-config
`,
    ASW2: `configure terminal
hostname ASW2
vlan 99
 name YONETIM
exit
interface vlan 99
 ip address 192.168.99.12 255.255.255.0
 no shutdown
exit
ip default-gateway 192.168.99.1
end
copy running-config startup-config
`,
  },
}

export default lab
