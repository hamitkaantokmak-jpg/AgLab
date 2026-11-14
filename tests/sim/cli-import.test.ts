// L5-h: PKT IOS metin yolu. Hoşgörülü mod (createLab lenient), satır sınıflandırması,
// yapısal/CLI karşılaştırması ve içe aktarma raporu. Başarılı ve başarısız durumlar.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createLab, runScript } from '../../src/sim'
import { cliImport, importReportWithCli } from '../../src/sim-bridge/cli-import'
import { createRuntime } from '../../src/sim-bridge/bridge'
import type { AglabTopology } from '../../src/sim-bridge/aglab'
import type { LabDef } from '../../src/sim/types'
import { ports } from '../../src/sim/util'

const SAMPLE = (): AglabTopology => JSON.parse(readFileSync(join(__dirname, '..', '..', 'static-routing-two-routers.aglab.json'), 'utf8'))

function lab(r1: string, sw1 = ''): LabDef {
  return {
    id: 'l5h', title: '', summary: '', level: 'İleri', tags: [], brief: [], objectives: [], solution: {}, view: { w: 1, h: 1 },
    devices: [
      { id: 'R1', kind: 'switch', router: true, model: 'ISR4331', mac: '5254.0010.0000', ports: ports('Gi0/0-2'), x: 0, y: 0 },
      { id: 'SW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0020.0000', ports: [...ports('Fa0/1-3'), ...ports('Gi0/1-2')], x: 0, y: 0 },
    ],
    links: [],
    initialConfig: { R1: r1, ...(sw1 ? { SW1: sw1 } : {}) },
  }
}

describe('hoşgörülü mod (createLab lenient)', () => {
  it('ilk hatada durmaz; her satırın sonucu raporlanır; zararsız ve modellenmeyen ayrılır', () => {
    const text = ['!', 'version 15.1', 'hostname R1', 'interface GigabitEthernet0/0', 'ip address 10.0.0.1 255.255.255.0', 'duplex auto', 'ip ospf authentication message-digest', '!', 'router bgp 65001', 'neighbor 1.1.1.1 remote-as 2', '!', 'ip route 0.0.0.0 0.0.0.0 10.0.0.2', 'line con 0', 'password cisco', '!', 'end'].join('\n')
    expect(() => createLab(lab(text))).toThrow()
    const rt = createLab(lab(text), { lenient: true })
    const st = Object.fromEntries(rt.configReport!.map((l) => [l.command, l.status]))
    expect(st).toMatchObject({
      'version 15.1': 'ignored', 'hostname R1': 'applied', 'ip address 10.0.0.1 255.255.255.0': 'applied', 'duplex auto': 'ignored',
      'ip ospf authentication message-digest': 'unmodeled', 'router bgp 65001': 'unmodeled', 'neighbor 1.1.1.1 remote-as 2': 'unmodeled',
      'ip route 0.0.0.0 0.0.0.0 10.0.0.2': 'applied', 'line con 0': 'ignored', 'password cisco': 'ignored', end: 'ignored',
    })
    expect(rt.configReport!.find((l) => l.command.startsWith('neighbor'))!.reason).toContain('router bgp 65001')
    expect(rt.running['R1']!.hostname).toBe('R1')
    expect(rt.running['R1']!.routes).toHaveLength(1)
  })

  it('running-config durum dökümüdür: shutdown yazmayan router arayüzü açık, yazan kapalı', () => {
    const rt = createLab(lab(['interface GigabitEthernet0/0', 'ip address 10.0.0.1 255.255.255.0', '!', 'interface GigabitEthernet0/1', 'shutdown', '!'].join('\n')), { lenient: true })
    expect(rt.running['R1']!.ifaces['GigabitEthernet0/0']!.shutdown).toBe(false)
    expect(rt.running['R1']!.ifaces['GigabitEthernet0/1']!.shutdown).toBe(true)
    // metinde geçmeyen port fabrika durumunda (router: kapalı)
    expect(rt.running['R1']!.ifaces['GigabitEthernet0/2']!.shutdown).toBe(true)
  })

  it('reddedilen kip satırının alt satırları önceki arayüze uygulanmaz', () => {
    // router'da Vlan arayüzü yok; `shutdown` Gi0/0'a değil hiçbir yere uygulanmamalı
    const rt = createLab(lab(['interface GigabitEthernet0/0', 'ip address 10.0.0.1 255.255.255.0', 'interface Vlan10', 'ip address 10.9.9.1 255.255.255.0', 'shutdown', '!'].join('\n')), { lenient: true })
    expect(rt.running['R1']!.ifaces['GigabitEthernet0/0']!.shutdown).toBe(false)
    expect(rt.running['R1']!.ifaces['GigabitEthernet0/0']!.ip!.addr).toBe('10.0.0.1')
    expect(rt.configReport!.filter((l) => l.status === 'unmodeled').map((l) => l.command)).toEqual(['interface Vlan10', 'ip address 10.9.9.1 255.255.255.0', 'shutdown'])
  })

  it('banner çok satırlı metni ve `end` sonrası satırlar', () => {
    const rt = createLab(lab(['banner motd ^C', 'Yetkisiz erişim yasak', 'ip route 1.1.1.0 255.255.255.0 10.0.0.2', '^C', 'end', 'ip route 2.2.2.0 255.255.255.0 10.0.0.2'].join('\n')), { lenient: true })
    expect(rt.configReport!.slice(0, 4).every((l) => l.status === 'ignored')).toBe(true)
    // banner içindeki satır komut değildir; `end` sonrası uygulanmaz ama raporlanır
    expect(rt.running['R1']!.routes).toEqual([])
    expect(rt.configReport!.at(-1)).toMatchObject({ command: 'ip route 2.2.2.0 255.255.255.0 10.0.0.2', status: 'unmodeled' })
  })

  it('IOS: alt kipte tanınmayan global komut üst kipte uygulanır; olmayan access VLAN oluşturulur', () => {
    const rt = createLab(lab('', ['interface FastEthernet0/1', 'switchport access vlan 30', 'ip default-gateway 10.0.0.1'].join('\n')), { lenient: true })
    expect(rt.running['SW1']!.defaultGateway).toBe('10.0.0.1')
    expect(rt.running['SW1']!.vlans['30']).toBe('VLAN0030')
    expect(rt.configReport!.every((l) => l.status === 'applied')).toBe(true)
    expect(runScript(rt, 'SW1', 'configure terminal\ninterface fa0/2\nswitchport access vlan 40').join('\n')).toContain('% Access VLAN does not exist. Creating vlan 40')
  })
})

describe('PKT IOS metin yolu (cliImport)', () => {
  it('gerçek örnek: yapısal ve CLI yolu modellenen alanlarda aynı; uçtan uca ping CLI yolunda geçer', () => {
    const t = SAMPLE()
    const r = cliImport(t)
    expect(r.bridge.report.expressible).toBe(true)
    expect(r.diffs).toEqual([])
    expect(r.lines.filter((l) => l.status === 'unmodeled')).toEqual([])
    const q = r.runtime.query()
    const pcs = t.devices.filter((d) => d.type === 'PC')
    for (const a of pcs) for (const b of pcs) if (a !== b) expect(q.ping(String(a.id), String(b.ip)).ok, `${a.name} → ${b.name}`).toBe(true)
    // satır sayıları kaynak metinden türer: boş ve `!` dışındaki her satır bir kez sınıflanır
    const counted = t.devices.flatMap((d) => String((d.config as { runningConfig?: string } | undefined)?.runningConfig ?? '').split('\n').filter((l) => l.trim() && !l.trim().startsWith('!')))
    expect(r.lines).toHaveLength(counted.length)
  })

  it('yapısal yol bozulursa fark yakalanır (sessiz fark = hata)', () => {
    const t = SAMPLE()
    const r1 = t.devices.find((d) => d.name === 'R1')!
    r1.interfaces!['g0/0']!.ip = '192.168.1.254'
    r1.staticRoutes = []
    const r = cliImport(t)
    expect(r.diffs.map((d) => d.field).sort()).toEqual(['GigabitEthernet0/0.ip', 'routes'])
    // yapısal çalışma zamanında rota yok: ping başarısız; CLI yolunda başarılı
    expect(createRuntime(r.bridge).query().ping('d3', '192.168.2.2').ok).toBe(false)
    expect(r.runtime.query().ping('d3', '192.168.2.2').ok).toBe(true)
  })

  it('içe aktarma raporu: reddedilen satırlar unmodeledConfigLines, zararsızlar ayrı; dönüştürücü listesi korunur', () => {
    const t = SAMPLE()
    const text = (t.devices.find((d) => d.name === 'R1')!.config as { runningConfig: string }).runningConfig
    ;(t.devices.find((d) => d.name === 'R1')!.config as { runningConfig: string }).runningConfig = text.replace('ip classless', 'ip classless\nip sla 1\nrouter eigrp 10')
    const r = cliImport(t)
    const rep = importReportWithCli(t.importReport as Record<string, unknown>, t, r.lines)
    expect((rep['unmodeledConfigLines'] as { command: string }[]).map((x) => x.command)).toEqual(['ip sla 1', 'router eigrp 10'])
    expect(rep['unmodeledConfigLineCount']).toBe(2)
    expect(rep['ignoredConfigLineCount']).toBe(r.lines.filter((l) => l.status === 'ignored').length)
    expect(rep['converterUnmodeledConfigLines']).toEqual((t.importReport as { unmodeledConfigLines: unknown[] }).unmodeledConfigLines)
    expect(rep['labberCli']).toEqual({ applied: r.lines.filter((l) => l.status === 'applied').length, ignored: rep['ignoredConfigLineCount'], unmodeled: 2 })
  })
})
