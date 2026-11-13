// L5-g: sunucunun HTTP servisi (TCP 80) ve PC'nin `curl` isteği. Her davranış başarılı ve
// başarısız durumla sınanır: servis kapalı, ACL web'i engelliyor, NAT arkasından erişim.
import { describe, expect, it } from 'vitest'
import { createLab, createSession, runScript, type VpcsSession } from '../../src/sim'
import type { LabRuntime } from '../../src/sim/runtime'
import type { LabDef } from '../../src/sim/types'
import { ports } from '../../src/sim/util'

/** PC1 (192.168.1.10) — SW1 — R1 Gi0/0 | Gi0/1 — WEB 203.0.113.80 (HTTP), DNS 203.0.113.53. */
function lab(r1: string[], webGw: string | null = '203.0.113.1', web: { http?: boolean } = { http: true }): LabDef {
  return {
    id: 'l5g', title: '', summary: '', level: 'İleri', tags: [], brief: [], objectives: [], solution: {}, view: { w: 1, h: 1 },
    devices: [
      { id: 'R1', kind: 'switch', router: true, model: 'ISR4331', mac: '5254.0010.0000', ports: ports('Gi0/0-1'), x: 0, y: 0 },
      { id: 'SW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0020.0000', ports: [...ports('Fa0/1-3'), ...ports('Gi0/1-2')], x: 0, y: 0 },
      { id: 'SW2', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0030.0000', ports: [...ports('Fa0/1-3'), ...ports('Gi0/1-2')], x: 0, y: 0 },
      { id: 'PC1', kind: 'pc', mac: '0050.0000.0010', x: 0, y: 0 },
      { id: 'WEB', kind: 'pc', server: true, name: 'web', mac: '0050.0000.0020', x: 0, y: 0 },
      { id: 'DNS', kind: 'pc', server: true, name: 'dns', mac: '0050.0000.0030', x: 0, y: 0 },
    ],
    links: [
      { a: ['PC1', 'eth0'], b: ['SW1', 'FastEthernet0/1'] },
      { a: ['SW1', 'GigabitEthernet0/1'], b: ['R1', 'GigabitEthernet0/0'] },
      { a: ['R1', 'GigabitEthernet0/1'], b: ['SW2', 'GigabitEthernet0/1'] },
      { a: ['WEB', 'eth0'], b: ['SW2', 'FastEthernet0/1'] },
      { a: ['DNS', 'eth0'], b: ['SW2', 'FastEthernet0/2'] },
    ],
    initialConfig: {
      R1: ['interface g0/0', 'ip address 192.168.1.1 255.255.255.0', 'no shutdown', 'interface g0/1', 'ip address 203.0.113.1 255.255.255.0', 'no shutdown', 'exit', ...r1].join('\n'),
    },
    initialPcs: {
      PC1: { ip: '192.168.1.10', prefix: 24, gw: '192.168.1.1', dns: '203.0.113.53' },
      WEB: { ip: '203.0.113.80', prefix: 24, gw: webGw, services: web },
      DNS: { ip: '203.0.113.53', prefix: 24, gw: '203.0.113.1', services: { dns: true } },
    },
  }
}
const cfg = (rt: LabRuntime, script: string) => runScript(rt, 'R1', 'configure terminal\n' + script + '\nend')
const sh = (rt: LabRuntime, dev: string, cmd: string) => (createSession(rt, dev) as VpcsSession).exec(cmd).join('\n')
const curl = (rt: LabRuntime, url = '203.0.113.80') => sh(rt, 'PC1', 'curl ' + url)
const PAGE = /<title>web<\/title>/

describe('HTTP servisi (TCP 80)', () => {
  it('servis açıkken sayfa gelir; kapatılınca bağlantı reddedilir, açılınca geri gelir', () => {
    const rt = createLab(lab([]))
    expect(curl(rt)).toMatch(PAGE)
    expect(curl(rt, 'http://203.0.113.80/index.html')).toMatch(PAGE)
    expect(sh(rt, 'WEB', 'service http off')).toBe('HTTP service is off')
    expect(curl(rt)).toBe('curl: (7) Failed to connect to 203.0.113.80 port 80 after 1 ms: Connection refused')
    expect(rt.query().http('PC1', '203.0.113.80')).toMatchObject({ ok: false, reason: 'refused' })
    expect(sh(rt, 'WEB', 'show services')).toMatch(/http\s+off/)
    sh(rt, 'WEB', 'service http on')
    expect(curl(rt)).toMatch(PAGE)
  })

  it('80 dışındaki port ve HTTP sunucusu olmayan cihaz reddeder; https desteklenmez', () => {
    const rt = createLab(lab([]))
    expect(curl(rt, '203.0.113.80:8080')).toMatch(/port 8080 .*Connection refused/)
    expect(curl(rt, '203.0.113.53')).toMatch(/Connection refused/)
    expect(curl(rt, '203.0.113.1')).toMatch(/Connection refused/)
    expect(curl(rt, 'https://203.0.113.80')).toMatch(/https.*not supported/)
  })

  it('ad DNS ile çözülür; DNS servisi kapalıyken çözülemez', () => {
    const rt = createLab(lab([]))
    expect(curl(rt, 'web')).toMatch(PAGE)
    sh(rt, 'DNS', 'service dns off')
    expect(curl(rt, 'web')).toBe('curl: (6) Could not resolve host: web')
  })

  it('ACL web\'i (eq www) engelleyince erişim kesilir; ping geçmeye devam eder; sayaç artar', () => {
    const rt = createLab(lab(['access-list 101 deny tcp any host 203.0.113.80 eq www', 'access-list 101 permit ip any any', 'interface g0/0', 'ip access-group 101 in']))
    expect(curl(rt)).toBe('curl: (7) Failed to connect to 203.0.113.80 port 80 after 1 ms: No route to host')
    expect(/bytes from/.test(sh(rt, 'PC1', 'ping 203.0.113.80'))).toBe(true)
    expect(runScript(rt, 'R1', 'show access-lists').join('\n')).toMatch(/10 deny   tcp any host 203\.0\.113\.80 eq www \(1 match\)/)
    // başka porta izin veren ACL web'i etkilemez
    cfg(rt, 'no access-list 101\naccess-list 101 deny tcp any any eq 443\naccess-list 101 permit ip any any')
    expect(curl(rt)).toMatch(PAGE)
    // dönüş yönünde (kaynak port 80) süzen ACL de erişimi keser
    cfg(rt, 'interface g0/0\nno ip access-group 101 in\nexit\naccess-list 102 deny tcp any eq 80 any\naccess-list 102 permit ip any any\ninterface g0/0\nip access-group 102 out')
    expect(curl(rt)).toMatch(/Connection timed out|No route to host/)
  })

  it('NAT arkasından erişim: PAT ile tcp girdisi; NAT yokken (sunucunun rotası yok) zaman aşımı', () => {
    const rt = createLab(lab(['interface g0/0', 'ip nat inside', 'interface g0/1', 'ip nat outside', 'exit', 'access-list 1 permit 192.168.1.0 0.0.0.255'], null))
    expect(curl(rt)).toBe('curl: (28) Failed to connect to 203.0.113.80 port 80 after 75000 ms: Connection timed out')
    cfg(rt, 'ip nat inside source list 1 interface g0/1 overload')
    expect(curl(rt)).toMatch(PAGE)
    const rows = runScript(rt, 'R1', 'show ip nat translations').filter((l) => l.startsWith('tcp')).map((l) => l.trim().split(/\s+/).join(' '))
    expect(rows).toEqual(['tcp 203.0.113.1:49153 192.168.1.10:49153 203.0.113.80:80 203.0.113.80:80'])
  })

  it('statik TCP port çevirisi: dışarıdan genel adresin 80\'ine gelen istek içerideki sunucuya gider', () => {
    // içeride web sunucusu: WEB'i iç ağa taşımak yerine PC1 → dış istemci rolü ters kurulur
    const def = lab(['interface g0/0', 'ip nat outside', 'interface g0/1', 'ip nat inside', 'exit'])
    def.initialPcs!['PC1'] = { ip: '192.168.1.10', prefix: 24, gw: null }
    def.initialPcs!['WEB'] = { ip: '203.0.113.80', prefix: 24, gw: '203.0.113.1', services: { http: true } }
    const rt = createLab(def)
    // genel adres 192.168.1.80 (PC1'in alt ağında) → iç 203.0.113.80:80
    expect(curl(rt, '192.168.1.80')).toMatch(/timed out/)
    cfg(rt, 'ip nat inside source static tcp 203.0.113.80 80 192.168.1.80 80')
    expect(curl(rt, '192.168.1.80')).toMatch(PAGE)
    expect(curl(rt, '192.168.1.80:8080')).toMatch(/timed out/)
  })

  it('gönderen ya da hedef yoksa uygun curl hatası', () => {
    const rt = createLab(lab([]))
    sh(rt, 'PC1', 'clear ip')
    expect(curl(rt)).toMatch(/Network is unreachable/)
    expect(sh(rt, 'PC1', 'curl')).toMatch(/try 'curl --help'/)
  })
})
