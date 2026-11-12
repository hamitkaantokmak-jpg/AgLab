// L5-b: DHCP (IOS havuzu, sunucu servisi, relay, PC istemcisi) ve DNS. Her davranış başarılı
// ve başarısız durumla sınanır.
import { describe, expect, it } from 'vitest'
import { createLab, createSession, runScript, type VpcsSession } from '../../src/sim'
import { apipaFor, isApipa } from '../../src/sim/dhcp'
import type { LabRuntime } from '../../src/sim/runtime'
import type { LabDef, PcConfig } from '../../src/sim/types'
import { ports } from '../../src/sim/util'

const pc = (id: string, n: number) => ({ id, kind: 'pc' as const, mac: `0050.0000.0a0${n}`, x: 0, y: 0 })

/**
 * PC1, PC2 — SW1 — R1 Gi0/0 (192.168.1.1/24); R1 Gi0/1 (10.0.0.1/24) — SRV (10.0.0.2);
 * R1 Gi0/2 (10.0.9.1/24) — HOST (10.0.9.2, servissiz).
 */
function lab(r1: string[] = [], srv: Partial<PcConfig> = {}): LabDef {
  return {
    id: 'l5b', title: '', summary: '', level: 'İleri', tags: [], brief: [], objectives: [], solution: {}, view: { w: 1, h: 1 },
    devices: [
      { id: 'R1', kind: 'switch', router: true, model: 'ISR4331', mac: '5254.0010.0000', ports: ports('Gi0/0-2'), x: 0, y: 0 },
      { id: 'SW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0020.0000', ports: ports('Fa0/1-4'), x: 0, y: 0 },
      pc('PC1', 1), pc('PC2', 2),
      { id: 'SRV', kind: 'pc', server: true, name: 'srv-01', mac: '0050.0000.0b01', x: 0, y: 0 },
      { id: 'HOST', kind: 'pc', name: 'host', mac: '0050.0000.0c01', x: 0, y: 0 },
    ],
    links: [
      { a: ['PC1', 'eth0'], b: ['SW1', 'FastEthernet0/1'] },
      { a: ['PC2', 'eth0'], b: ['SW1', 'FastEthernet0/2'] },
      { a: ['SW1', 'FastEthernet0/3'], b: ['R1', 'GigabitEthernet0/0'] },
      { a: ['R1', 'GigabitEthernet0/1'], b: ['SRV', 'eth0'] },
      { a: ['R1', 'GigabitEthernet0/2'], b: ['HOST', 'eth0'] },
    ],
    initialConfig: {
      SW1: 'interface range fa0/1 - 4\nswitchport mode access',
      R1: [
        'interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown',
        'interface g0/1', 'ip address 10.0.0.1 255.255.255.0', 'no shutdown',
        'interface g0/2', 'ip address 10.0.9.1 255.255.255.0', 'no shutdown',
        'exit', ...r1,
      ].join('\n'),
    },
    initialPcs: {
      SRV: { ip: '10.0.0.2', prefix: 24, gw: '10.0.0.1', ...srv },
      HOST: { ip: '10.0.9.2', prefix: 24, gw: '10.0.9.1' },
    },
  }
}

const POOL = ['ip dhcp excluded-address 192.168.1.1 192.168.1.10', 'ip dhcp pool LAN', 'network 192.168.1.0 255.255.255.0', 'default-router 192.168.1.1', 'dns-server 10.0.0.2', 'exit']
const sh = (rt: LabRuntime, dev: string, script: string) => runScript(rt, dev, script).join('\n')
const vpc = (rt: LabRuntime, id: string) => createSession(rt, id) as VpcsSession
const dhcp = (rt: LabRuntime, id: string) => vpc(rt, id).exec('ip dhcp').join('\n')

describe('L5-b: IOS DHCP sunucusu (ip dhcp pool)', () => {
  it('havuz: dışlanan adresler atlanır, en düşük boş adres, default-router ve dns-server verilir', () => {
    const rt = createLab(lab(POOL))
    expect(dhcp(rt, 'PC1')).toContain('DDORA IP 192.168.1.11/24 GW 192.168.1.1')
    expect(rt.pcs['PC1']).toEqual({ ip: '192.168.1.11', prefix: 24, gw: '192.168.1.1', dhcp: true, dns: '10.0.0.2' })
    expect(dhcp(rt, 'PC2')).toContain('DDORA IP 192.168.1.12/24')
    const q = rt.query()
    expect(q.dhcpLease('PC1')).toMatchObject({ server: 'R1', pool: 'LAN', ip: '192.168.1.11', serverIp: '192.168.1.1' })
    expect(q.dhcpBindings('R1').map((b) => b.ip)).toEqual(['192.168.1.11', '192.168.1.12'])
    // kiralanan adresle ağ geçidinin ötesine erişim
    expect(q.ping('PC1', '10.0.0.2').ok).toBe(true)
  })

  it('aynı istemci yenileyince aynı adresi alır; bırakınca (ip dhcp -x) adres boşalır', () => {
    const rt = createLab(lab(POOL))
    dhcp(rt, 'PC1')
    dhcp(rt, 'PC2')
    expect(vpc(rt, 'PC1').exec('ip dhcp -r').join('\n')).toContain('192.168.1.11/24')
    vpc(rt, 'PC1').exec('ip dhcp -x')
    expect(rt.pcs['PC1']).toEqual({ ip: null, prefix: 24, gw: null })
    expect(rt.query().dhcpBindings('R1').map((b) => b.client)).toEqual(['PC2'])
  })

  it('sunucu yok: istemci 169.254/16 adresi alır, ağ geçidi boşalır, kira oluşmaz', () => {
    const rt = createLab(lab())
    const out = dhcp(rt, 'PC1')
    expect(out).toContain("Can't find dhcp server")
    const c = rt.pcs['PC1']!
    expect(c.ip).toBe(apipaFor('0050.0000.0a01'))
    expect(isApipa(c.ip!)).toBe(true)
    expect([c.prefix, c.gw]).toEqual([16, null])
    expect(rt.query().dhcpLease('PC1')).toBeNull()
    expect(rt.query().ping('PC1', '192.168.1.1').ok).toBe(false)
  })

  it('başarısız yenilemede var olan 169.254 adresi korunur; önceki kira düşer', () => {
    const rt = createLab(lab(POOL))
    dhcp(rt, 'PC1')
    sh(rt, 'R1', 'conf t\nno ip dhcp pool LAN')
    expect(dhcp(rt, 'PC1')).toContain("Can't find dhcp server")
    const first = rt.pcs['PC1']!.ip
    rt.pcs['PC2'] = { ip: '169.254.30.8', prefix: 16, gw: null }
    rt.commit()
    dhcp(rt, 'PC2')
    expect(rt.pcs['PC2']!.ip).toBe('169.254.30.8')
    expect(isApipa(first!)).toBe(true)
    expect(rt.query().dhcpBindings('R1')).toEqual([])
  })

  it('havuz tükenince adres verilmez', () => {
    const rt = createLab(lab(['ip dhcp excluded-address 192.168.1.1 192.168.1.253', 'ip dhcp pool LAN', 'network 192.168.1.0 /24', 'exit']))
    expect(dhcp(rt, 'PC1')).toContain('192.168.1.254/24')
    expect(rt.pcs['PC1']!.gw).toBeNull()
    expect(dhcp(rt, 'PC2')).toContain("Can't find dhcp server")
    expect(rt.dhcpRequest('PC2')).toMatchObject({ ok: false, reason: 'exhausted', server: 'R1' })
  })

  it('havuzun ağı istemcinin alt ağını kapsamıyorsa adres verilmez; kullanımdaki adres atlanır', () => {
    const rt = createLab(lab(['ip dhcp pool OTHER', 'network 172.16.0.0 255.255.0.0', 'exit']))
    expect(rt.dhcpRequest('PC1')).toMatchObject({ ok: false, reason: 'nopool' })
    sh(rt, 'R1', 'conf t\nip dhcp pool LAN\nnetwork 192.168.1.0 255.255.255.0')
    vpc(rt, 'PC2').exec('ip 192.168.1.2/24')
    // .1 router'da, .2 PC2'de: çakışma denetimi ikisini de atlar
    expect(dhcp(rt, 'PC1')).toContain('192.168.1.3/24')
  })

  it('show ip dhcp binding / pool ve running-config', () => {
    const rt = createLab(lab(POOL))
    dhcp(rt, 'PC1')
    const binding = sh(rt, 'R1', 'show ip dhcp binding')
    expect(binding).toContain('IP address          Client-ID/              Lease expiration        Type')
    expect(binding).toMatch(/192\.168\.1\.11 +0100\.5000\.000a\.01 +Mar 02 1993 \d\d:\d\d [AP]M +Automatic/)
    const pool = sh(rt, 'R1', 'show ip dhcp pool')
    expect(pool).toContain('Pool LAN :')
    expect(pool).toMatch(/Total addresses +: 254/)
    expect(pool).toMatch(/Leased addresses +: 1/)
    expect(pool).toMatch(/192\.168\.1\.12 +192\.168\.1\.1 +- 192\.168\.1\.254 +1/)
    expect(sh(rt, 'R1', 'show ip dhcp pool YOK')).toContain('% Pool YOK not found')
    const run = sh(rt, 'R1', 'show running-config')
    for (const line of ['ip dhcp excluded-address 192.168.1.1 192.168.1.10', 'ip dhcp pool LAN', ' network 192.168.1.0 255.255.255.0', ' default-router 192.168.1.1', ' dns-server 10.0.0.2'])
      expect(run.split('\n')).toContain(line)
  })

  it('CLI: havuz kipi, hatalı girişler ve silme', () => {
    const rt = createLab(lab())
    const out = sh(rt, 'R1', 'conf t\nip dhcp pool A\nnetwork 192.168.1.77 /24\ndo show run | include network\nnetwork 192.168.1.0 255.255.255.255\nexit\nip dhcp pool B\nnetwork 192.168.1.0 255.255.255.0')
    expect(out).toContain('R1(dhcp-config)#')
    expect(out).toContain(' network 192.168.1.0 255.255.255.0')
    expect(out).toContain("% Invalid input detected at '^' marker.")
    expect(out).toContain('% A pool already exists for network 192.168.1.0 / 255.255.255.0')
    expect(sh(rt, 'R1', 'conf t\nno ip dhcp pool YOK')).toContain('% Pool YOK not found')
    expect(sh(rt, 'R1', 'conf t\nip dhcp excluded-address 10.0.0.9 10.0.0.1')).toContain('% Invalid range of IP addresses')
    expect(sh(rt, 'R1', 'conf t\nno ip dhcp excluded-address 10.0.0.1')).toContain('% Range [10.0.0.1, 10.0.0.1] is not in the database.')
    sh(rt, 'R1', 'conf t\nip dhcp excluded-address 10.0.0.1\nno ip dhcp excluded-address 10.0.0.1\nno ip dhcp pool A\nno ip dhcp pool B')
    expect(rt.running['R1']!.dhcpExcluded).toBeUndefined()
    expect(rt.running['R1']!.dhcpPools).toBeUndefined()
    // `?` yardımı yeni komutları gösterir
    const s = createSession(rt, 'R1')
    s.exec('enable')
    s.exec('configure terminal')
    expect(s.exec('ip dhcp ?').join('\n')).toMatch(/excluded-address[\s\S]*pool/)
  })

  it('kiralar RAM\'dedir: clear ip dhcp binding ve reload sonrası tablo boş', () => {
    const rt = createLab(lab(POOL))
    dhcp(rt, 'PC1')
    dhcp(rt, 'PC2')
    expect(sh(rt, 'R1', 'clear ip dhcp binding 192.168.1.99')).toContain('% Binding 192.168.1.99 not found')
    sh(rt, 'R1', 'clear ip dhcp binding 192.168.1.11')
    expect(rt.query().dhcpBindings('R1').map((b) => b.ip)).toEqual(['192.168.1.12'])
    sh(rt, 'R1', 'clear ip dhcp binding *')
    expect(rt.query().dhcpBindings('R1')).toEqual([])
    dhcp(rt, 'PC1')
    sh(rt, 'R1', 'write memory')
    rt.setPower('R1', false)
    rt.setPower('R1', true)
    expect(rt.query().dhcpBindings('R1')).toEqual([])
    // kayıtlı havuz geri gelir; istemci yeniden kira alır
    expect(dhcp(rt, 'PC1')).toContain('DDORA IP 192.168.1.11/24')
  })

  it('kiralar kayıtta taşınır (save/load)', () => {
    const rt = createLab(lab(POOL))
    dhcp(rt, 'PC1')
    const copy = createLab(lab(POOL))
    expect(copy.load(rt.save())).toBe(true)
    expect(copy.query().dhcpLease('PC1')).toMatchObject({ ip: '192.168.1.11', server: 'R1' })
  })
})

describe('L5-b: DHCP relay (ip helper-address)', () => {
  // DHCP sunucusu uzak ağdaki SRV; R1 Gi0/0 relay
  const relay = (helper: string) => ['interface g0/0', `ip helper-address ${helper}`, 'exit']

  it('relay ile uzak sunucudan kira: adres relay arayüzünün ağından, ağ geçidi relay adresi', () => {
    const rt = createLab(lab(relay('10.0.0.2'), { services: { dhcp: true } }))
    // AğLab sunucu havuzu: ağın 100. adresinden başlar (src/engine/dhcp.js ile aynı kural)
    expect(dhcp(rt, 'PC1')).toContain('DDORA IP 192.168.1.100/24 GW 192.168.1.1')
    expect(dhcp(rt, 'PC2')).toContain('DDORA IP 192.168.1.101/24')
    expect(rt.query().dhcpLease('PC1')).toMatchObject({ server: 'SRV', serverIp: '10.0.0.2', pool: '' })
    expect(vpc(rt, 'SRV').exec('show ip dhcp binding').join('\n')).toMatch(/192\.168\.1\.100 +0050\.0000\.0a01/)
    expect(vpc(rt, 'PC1').exec('show ip').join('\n')).toContain('DHCP SERVER : 10.0.0.2')
  })

  it('relay yok: yayın router\'ı geçmez, istemci 169.254 adresinde kalır', () => {
    const rt = createLab(lab([], { services: { dhcp: true } }))
    expect(rt.dhcpRequest('PC1')).toMatchObject({ ok: false, reason: 'noserver' })
    expect(isApipa(rt.pcs['PC1']!.ip!)).toBe(true)
  })

  it('helper-address yanlış: olmayan adres → erişilemez; servissiz host → sunucu değil', () => {
    const rt = createLab(lab(relay('10.0.0.99'), { services: { dhcp: true } }))
    expect(rt.dhcpRequest('PC1')).toMatchObject({ ok: false, reason: 'relay-unreachable', relay: { dev: 'R1', ifname: 'GigabitEthernet0/0', helper: '10.0.0.99' } })
    sh(rt, 'R1', 'conf t\ninterface g0/0\nno ip helper-address 10.0.0.99\nip helper-address 10.0.9.2')
    expect(rt.dhcpRequest('PC1')).toMatchObject({ ok: false, reason: 'relay-noserver', server: 'HOST' })
    // doğru adres eklenince (ikinci helper) kira gelir
    sh(rt, 'R1', 'conf t\ninterface g0/0\nip helper-address 10.0.0.2')
    expect(rt.running['R1']!.ifaces['GigabitEthernet0/0']!.l3!.helpers).toEqual(['10.0.9.2', '10.0.0.2'])
    expect(rt.dhcpRequest('PC1')).toMatchObject({ ok: true, ip: '192.168.1.100' })
    expect(sh(rt, 'R1', 'show running-config interface g0/0')).toContain(' ip helper-address 10.0.0.2')
  })

  it('sunucunun DHCP servisi kapalıysa ya da dönüş yolu yoksa kira gelmez', () => {
    const rt = createLab(lab(relay('10.0.0.2')))
    expect(rt.dhcpRequest('PC1')).toMatchObject({ ok: false, reason: 'relay-noserver' })
    expect(vpc(rt, 'SRV').exec('service dhcp on')).toEqual(['DHCP service is on'])
    expect(rt.dhcpRequest('PC1').ok).toBe(true)
    // sunucunun ağ geçidi silinince yanıt relay'e dönemez
    vpc(rt, 'SRV').exec('ip 10.0.0.2/24')
    expect(rt.pcs['SRV']!.services).toEqual({ dhcp: true })
    expect(rt.dhcpRequest('PC1')).toMatchObject({ ok: false, reason: 'relay-unreachable' })
  })

  it('relay IOS sunucusuna: havuz giaddr (relay arayüzü) ağına göre seçilir', () => {
    // R2: uzak DHCP sunucusu (Gi0/2 tarafında HOST yerine router yok; R1 kendi dışındaki havuzu kullanamaz)
    const def = lab(relay('10.0.9.2'))
    def.devices = def.devices.map((d) => (d.id === 'HOST' ? { id: 'HOST', kind: 'switch' as const, router: true, model: 'ISR4331', mac: '5254.0030.0000', ports: ports('Gi0/0-1'), x: 0, y: 0 } : d))
    def.links = def.links.map((l) => (l.b[0] === 'HOST' ? { a: l.a, b: ['HOST', 'GigabitEthernet0/0'] as [string, string] } : l))
    delete def.initialPcs!['HOST']
    def.initialConfig!['HOST'] = ['interface g0/0', 'ip address 10.0.9.2 255.255.255.0', 'no shutdown', 'exit', 'ip route 192.168.1.0 255.255.255.0 10.0.9.1',
      'ip dhcp pool WRONG', 'network 10.0.9.0 255.255.255.0', 'exit'].join('\n')
    const rt = createLab(def)
    expect(rt.dhcpRequest('PC1')).toMatchObject({ ok: false, reason: 'nopool', server: 'HOST' })
    sh(rt, 'HOST', 'conf t\nip dhcp pool LAN\nnetwork 192.168.1.0 255.255.255.0\ndefault-router 192.168.1.1')
    expect(rt.dhcpRequest('PC1')).toMatchObject({ ok: true, server: 'HOST', pool: 'LAN', ip: '192.168.1.2', gw: '192.168.1.1', serverIp: '10.0.9.2' })
  })

  it('istemci VLAN\'ı relay\'e ulaşmıyorsa (L2 yolu yok) kira gelmez; yol açılınca gelir', () => {
    const rt = createLab(lab(relay('10.0.0.2'), { services: { dhcp: true } }))
    sh(rt, 'SW1', 'conf t\nvlan 20\ninterface fa0/1\nswitchport access vlan 20')
    expect(rt.dhcpRequest('PC1')).toMatchObject({ ok: false, reason: 'noserver' })
    sh(rt, 'SW1', 'conf t\ninterface fa0/1\nswitchport access vlan 1')
    expect(rt.dhcpRequest('PC1').ok).toBe(true)
    // kablo kopuk: istemcinin bağlantısı yok
    rt.setLink('PC1', 'eth0', false)
    expect(rt.dhcpRequest('PC1')).toMatchObject({ ok: false, reason: 'nolink' })
  })
})

describe('L5-b: sunucu servisleri ve DNS', () => {
  it('aynı ağdaki sunucu: kendi alt ağından kira, ağ geçidi sunucunun ağ geçidi', () => {
    // PC1, PC2 ve SRV aynı switch'te; router yok
    const def = lab()
    def.devices = def.devices.filter((d) => d.id !== 'R1' && d.id !== 'HOST')
    def.links = [...def.links.filter((l) => l.b[0] === 'SW1'), { a: ['SRV', 'eth0'], b: ['SW1', 'FastEthernet0/4'] }]
    def.initialConfig = { SW1: def.initialConfig!['SW1']! }
    def.initialPcs = { SRV: { ip: '192.168.1.5', prefix: 24, gw: '192.168.1.1', services: { dhcp: true, dns: true } } }
    const rt = createLab(def)
    expect(dhcp(rt, 'PC1')).toContain('DDORA IP 192.168.1.100/24 GW 192.168.1.1')
    // DNS servisi açık sunucu kendini DNS sunucusu olarak verir
    expect(rt.pcs['PC1']!.dns).toBe('192.168.1.5')
    expect(rt.query().dnsLookup('PC1', 'srv-01')).toMatchObject({ ok: true, address: '192.168.1.5' })
    expect(vpc(rt, 'SRV').exec('service dhcp off')).toEqual(['DHCP service is off'])
    expect(rt.query().dhcpBindings('SRV')).toEqual([])
    expect(rt.dhcpRequest('PC2')).toMatchObject({ ok: false, reason: 'noserver' })
  })

  it('nslookup: ad çözülür; bilinmeyen ad, kapalı servis ve DNS sunucusu olmayan istemci', () => {
    const rt = createLab(lab(POOL, { services: { dns: true } }))
    const p = vpc(rt, 'PC1')
    expect(p.exec('nslookup srv-01').join('\n')).toContain('*** Default servers are not available')
    dhcp(rt, 'PC1')
    expect(p.exec('nslookup SRV-01')).toEqual(['Server:  UnKnown', 'Address:  10.0.0.2', '', 'Name:    srv-01', 'Address:  10.0.0.2', ''])
    expect(rt.query().dnsLookup('PC1', 'host')).toEqual({ ok: true, server: '10.0.0.2', name: 'host', address: '10.0.9.2' })
    expect(rt.query().dnsLookup('PC1', 'R1')).toMatchObject({ ok: true, address: '192.168.1.1' })
    expect(p.exec('nslookup yok.example').join('\n')).toContain("*** UnKnown can't find yok.example: Non-existent domain")
    expect(vpc(rt, 'SRV').exec('show dns').join('\n')).toMatch(/srv-01 +10\.0\.0\.2/)
    vpc(rt, 'SRV').exec('service dns off')
    expect(p.exec('nslookup srv-01').join('\n')).toContain('DNS request timed out.')
    expect(rt.query().dnsLookup('PC1', 'srv-01')).toEqual({ ok: false, reason: 'timeout', server: '10.0.0.2' })
    expect(vpc(rt, 'SRV').exec('show services').join('\n')).toMatch(/dhcp +off\ndns +off/)
  })

  it('ip dns: elle DNS sunucusu; erişilemeyen sunucu zaman aşımı; servis komutları yalnız sunucuda', () => {
    const rt = createLab(lab([], { services: { dns: true } }))
    const p = vpc(rt, 'PC1')
    p.exec('ip 192.168.1.20/24 192.168.1.1')
    expect(p.exec('ip dns 999.1.1.1')).toEqual(['Invalid address'])
    p.exec('ip dns 10.0.0.2')
    expect(p.exec('show ip').join('\n')).toContain('DNS         : 10.0.0.2')
    expect(rt.query().dnsLookup('PC1', 'srv-01').ok).toBe(true)
    sh(rt, 'R1', 'conf t\ninterface g0/1\nshutdown')
    expect(rt.query().dnsLookup('PC1', 'srv-01')).toMatchObject({ ok: false, reason: 'timeout' })
    expect(p.exec('service dns on').join('\n')).toContain('Bad command')
    p.exec('ip dns 0.0.0.0')
    expect(rt.pcs['PC1']!.dns).toBeUndefined()
  })
})
