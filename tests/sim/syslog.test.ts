// Syslog tamponu ve `show logging` (motor/syslog-zaman-diff, aşama 1).
//
// Her switch/router'ın sınırlı bir günlük tamponu vardır (varsayılan 1000 satır; `logging buffered
// <bayt>` ile bayt sınırı). Olay durum değiştiği anda bir kez yazılır. Zaman damgası sanal saatten
// gelir (gerçek saat kullanılmaz). PC'nin günlüğü yoktur.
import { describe, expect, it } from 'vitest'
import { LABS } from '../../src/labs/index'
import { createLab, createSession, runScript } from '../../src/sim/index'
import type { LabRuntime } from '../../src/sim/runtime'
import type { LabDef } from '../../src/sim/types'
import { ports } from '../../src/sim/util'
import { fiber, G1, twoSwitchLab } from './fixtures/phys-lab'

const cfg = (rt: LabRuntime, dev: string, script: string) => runScript(rt, dev, 'configure terminal\n' + script + '\nend')
const showLog = (rt: LabRuntime, dev: string) => runScript(rt, dev, 'show logging').join('\n')
const mnems = (rt: LabRuntime, dev: string) => rt.log(dev).map((e) => `${e.facility}-${e.sev}-${e.mnemonic}`)

describe('günlük tamponu: biçim ve API', () => {
  it('lab açılışında tampon boş; link kesilip takılınca LINK/LINEPROTO satırları bir kez yazılır', () => {
    const rt = createLab(twoSwitchLab())
    expect(rt.log('SW1')).toEqual([])
    rt.setLink('SW1', G1, false)
    rt.setLink('SW1', G1, true)
    const e = rt.log('SW1')
    expect(e.map((x) => x.text)).toEqual([
      'Interface GigabitEthernet0/1, changed state to down',
      'Line protocol on Interface GigabitEthernet0/1, changed state to down',
      'Interface GigabitEthernet0/1, changed state to up',
      'Line protocol on Interface GigabitEthernet0/1, changed state to up',
    ])
    expect(e[0]).toMatchObject({ facility: 'LINK', sev: 3, mnemonic: 'UPDOWN' })
    expect(e[1]).toMatchObject({ facility: 'LINEPROTO', sev: 5, mnemonic: 'UPDOWN' })
    expect(e[0]!.line).toMatch(/^\*Mar {2}1 \d\d:\d\d:\d\d\.\d{3}: %LINK-3-UPDOWN: Interface GigabitEthernet0\/1, changed state to down$/)
    // aynı durumu tekrar uygulamak yeni satır üretmez
    rt.setLink('SW1', G1, true)
    expect(rt.log('SW1').length).toBe(4)
    // karşı switch de yazar; PC'nin günlüğü yok
    expect(mnems(rt, 'SW2').filter((m) => m === 'LINK-3-UPDOWN').length).toBe(2)
    expect(rt.log('PC1')).toEqual([])
  })

  it('zaman damgaları sanal ve deterministik: iki aynı çalışma aynı satırları üretir', () => {
    const run = () => {
      const rt = createLab(twoSwitchLab())
      rt.setLink('SW1', G1, false)
      rt.setLink('SW1', G1, true)
      return rt.log('SW1').map((e) => e.line)
    }
    const a = run()
    expect(a).toEqual(run())
    expect(new Set(a).size).toBe(a.length)
    expect([...a].sort()).toEqual(a)
  })

  it('show logging: başlık + tampon; clear logging onaylı boşaltır; LabQuery logHas/logCount', () => {
    const rt = createLab(twoSwitchLab())
    rt.setLink('SW1', G1, false)
    const out = showLog(rt, 'SW1')
    expect(out).toMatch(/^Syslog logging: enabled/m)
    expect(out).toMatch(/Buffer logging: {2}level debugging, 2 messages logged/)
    expect(out).toMatch(/Log Buffer \(1000 messages\):/)
    expect(out).toContain('%LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to down')
    const q = rt.query()
    expect(q.logHas('SW1', 'UPDOWN')).toBe(true)
    expect(q.logHas('SW1', 'LINK-3-UPDOWN')).toBe(true)
    expect(q.logCount('SW1', 'UPDOWN')).toBe(2)
    expect(q.logHas('SW1', 'ADJCHG')).toBe(false)
    const s = createSession(rt, 'SW1')
    s.exec('enable')
    s.exec('clear logging')
    expect(s.prompt()).toContain('Clear logging buffer [confirm]')
    s.exec('')
    expect(rt.log('SW1')).toEqual([])
    expect(rt.query().logCount('SW1', 'UPDOWN')).toBe(0)
    rt.setLink('SW1', G1, true)
    rt.clearLog('SW1')
    expect(rt.log('SW1')).toEqual([])
    // terminal monitor kabul edilir
    expect(s.exec('terminal monitor').join('\n')).not.toMatch(/%|Invalid/)
  })

  it('yapılandırma modundan çıkış SYS-5-CONFIG_I yazar', () => {
    const rt = createLab(twoSwitchLab())
    cfg(rt, 'SW1', 'interface fa0/2\ndescription test')
    expect(rt.log('SW1').at(-1)).toMatchObject({ facility: 'SYS', sev: 5, mnemonic: 'CONFIG_I', text: 'Configured from console by console' })
  })

  it('logging buffered <bayt>: running-config satırı ve bayt sınırında en eski satır düşer', () => {
    const rt = createLab(twoSwitchLab())
    cfg(rt, 'SW1', 'logging buffered 4096')
    expect(runScript(rt, 'SW1', 'show running-config').join('\n')).toContain('\nlogging buffered 4096\n')
    for (let i = 0; i < 40; i++) {
      rt.setLink('SW1', G1, false)
      rt.setLink('SW1', G1, true)
    }
    const e = rt.log('SW1')
    expect(e.reduce((n, x) => n + x.line.length + 1, 0)).toBeLessThanOrEqual(4096)
    expect(e.at(-1)!.text).toBe('Line protocol on Interface GigabitEthernet0/1, changed state to up')
    expect(showLog(rt, 'SW1')).toMatch(/Log Buffer \(4096 bytes\):/)
    cfg(rt, 'SW1', 'no logging buffered')
    expect(runScript(rt, 'SW1', 'show running-config').join('\n')).not.toContain('logging buffered')
    expect(runScript(rt, 'SW1', 'configure terminal\nlogging buffered 100\nend').join('\n')).toMatch(/% Invalid input/)
  })

  it('varsayılan sınır 1000 satır: en eski satırlar düşer', () => {
    const rt = createLab(twoSwitchLab())
    for (let i = 0; i < 300; i++) {
      rt.setLink('SW1', G1, false)
      rt.setLink('SW1', G1, true)
    }
    const e = rt.log('SW1')
    expect(e.length).toBe(1000)
    expect(e[0]!.text).toBe('Interface GigabitEthernet0/1, changed state to down')
    expect(showLog(rt, 'SW1')).toMatch(/1200 messages logged/)
  })

  it('kayıt/geri yükleme tamponu korur', () => {
    const rt = createLab(twoSwitchLab())
    rt.setLink('SW1', G1, false)
    const saved = JSON.parse(JSON.stringify(rt.save()))
    const rt2 = createLab(twoSwitchLab())
    expect(rt2.load(saved)).toBe(true)
    expect(rt2.log('SW1')).toEqual(rt.log('SW1'))
    // geri yüklenen tampona yeni satır eklenir, sıra bozulmaz
    rt2.setLink('SW1', G1, true)
    const lines = rt2.log('SW1').map((x) => x.line)
    expect([...lines].sort()).toEqual(lines)
  })

  it('cihaz yeniden başlayınca (güç) tampon boşalır; kapalı cihaz yazmaz', () => {
    const rt = createLab(twoSwitchLab())
    rt.setLink('SW1', G1, false)
    rt.setPower('SW1', false)
    rt.setLink('SW1', G1, true)
    rt.setPower('SW1', true)
    expect(rt.log('SW1').filter((e) => e.mnemonic === 'UPDOWN' && e.text.includes('down'))).toEqual([])
  })
})

describe('günlük olayları', () => {
  it('SFP değişimi ve third-party modül: PHY-4 + PM-4-ERR_DISABLE; link gelince UPDOWN', () => {
    const rt = createLab(twoSwitchLab({ cable: { kind: 'fiber-sm', lengthM: 1000 }, ends: { a: { sfp: { type: '1000base-lx' } }, b: { sfp: { type: '1000base-sx' } } } }))
    rt.replaceSfp('SW2', G1, { type: '1000base-lx', vendor: 'third-party' })
    expect(mnems(rt, 'SW2')).toEqual(['PHY-4-UNSUPPORTED_TRANSCEIVER', 'PM-4-ERR_DISABLE'])
    expect(rt.log('SW2')[1]!.text).toBe('gbic-invalid error detected on Gi0/1, putting Gi0/1 in err-disable state')
    rt.replaceSfp('SW2', G1, { type: '1000base-lx' })
    cfg(rt, 'SW2', 'interface gi0/1\nshutdown\nno shutdown')
    expect(rt.query().logHas('SW2', 'LINK-3-UPDOWN')).toBe(true)
    expect(rt.query().logHas('SW1', 'LINK-3-UPDOWN')).toBe(true)
  })

  it('bpduguard ve psecure-violation err-disable satırları', () => {
    const rt = createLab(twoSwitchLab())
    cfg(rt, 'SW2', 'interface gi0/1\nspanning-tree portfast\nspanning-tree bpduguard enable')
    expect(mnems(rt, 'SW2')).toContain('SPANTREE-2-BLOCK_BPDUGUARD')
    expect(rt.log('SW2').find((e) => e.mnemonic === 'ERR_DISABLE')!.text).toMatch(/^bpduguard error detected on Gi0\/1/)
    cfg(rt, 'SW1', 'interface fa0/1\nswitchport mode access\nswitchport port-security\nswitchport port-security mac-address 0000.1111.2222')
    createSession(rt, 'PC1').exec('ping 192.168.1.12')
    expect(rt.log('SW1').filter((e) => e.mnemonic === 'ERR_DISABLE').map((e) => e.text)).toEqual(['psecure-violation error detected on Fa0/1, putting Fa0/1 in err-disable state'])
    expect(rt.query().logHas('SW1', 'PSECURE_VIOLATION')).toBe(true)
  })

  it('STP topoloji değişimi: SPANTREE-5-TOPOTRAP (yalnız tampon), durum değişmezse yok', () => {
    const rt = createLab(twoSwitchLab(undefined, (d) => d.links.push({ a: ['SW1', 'GigabitEthernet0/2'], b: ['SW2', 'GigabitEthernet0/2'] })))
    cfg(rt, 'SW1', 'interface range gi0/1 - 2\nswitchport mode trunk')
    cfg(rt, 'SW2', 'interface range gi0/1 - 2\nswitchport mode trunk')
    rt.clearLog('SW1')
    rt.clearLog('SW2')
    const consoleBefore = rt.logs.length
    rt.setLink('SW1', G1, false)
    const traps = [...rt.log('SW1'), ...rt.log('SW2')].filter((e) => e.mnemonic === 'TOPOTRAP')
    expect(traps.length).toBeGreaterThan(0)
    expect(traps[0]!.text).toMatch(/^Topology Change Trap for vlan 1$/)
    // konsol akışı (rt.logs) eskisi gibi: TOPOTRAP konsola yazılmaz
    expect(rt.logs.slice(consoleBefore).some((l) => l.text.includes('TOPOTRAP'))).toBe(false)
    const n = rt.log('SW2').length
    cfg(rt, 'SW2', 'interface fa0/2\ndescription x')
    expect(rt.log('SW2').length).toBe(n + 1) // yalnız CONFIG_I
    expect(rt.log('SW2').at(-1)!.mnemonic).toBe('CONFIG_I')
  })

  it('OSPF komşuluk kaybı: OSPF-5-ADJCHG FULL to DOWN', () => {
    const lab = LABS.find((l) => l.id === 'ospf-tek-alan')!
    const rt = createLab(lab)
    for (const [dev, s] of Object.entries(lab.solution)) runScript(rt, dev, s)
    const dev = Object.keys(rt.derived.ospf).find((d) => rt.derived.ospf[d]!.nbrs.some((n) => n.state === 'FULL'))!
    expect(rt.query().logHas(dev, 'ADJCHG')).toBe(true)
    const nbr = rt.derived.ospf[dev]!.nbrs.find((n) => n.state === 'FULL')!
    rt.clearLog(dev)
    cfg(rt, dev, `interface ${nbr.ifname}\nshutdown`)
    const adj = rt.log(dev).filter((e) => e.mnemonic === 'ADJCHG')
    expect(adj.length).toBeGreaterThan(0)
    expect(adj[0]!.text).toMatch(/from FULL to DOWN/)
  })

  it('HSRP durum değişimi: Standby -> Active', () => {
    const r = (id: string, n: number) => ({ id, kind: 'switch' as const, router: true, model: 'ISR4331', mac: `5254.00${n}0.0000`, ports: ports('Gi0/0-1'), x: 0, y: 0 })
    const def: LabDef = {
      id: 'hsrp-log', title: '', summary: '', level: 'İleri', tags: [], brief: [], objectives: [], solution: {}, view: { w: 1, h: 1 },
      devices: [{ id: 'SW', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0090.0000', ports: ports('Fa0/1-2'), x: 0, y: 0 }, r('R1', 1), r('R2', 2)],
      links: [
        { a: ['R1', 'GigabitEthernet0/0'], b: ['SW', 'FastEthernet0/1'] },
        { a: ['R2', 'GigabitEthernet0/0'], b: ['SW', 'FastEthernet0/2'] },
      ],
      initialConfig: {
        R1: 'interface g0/0\nip address 192.168.1.2 255.255.255.0\nstandby 1 ip 192.168.1.254\nstandby 1 priority 110\nno shutdown',
        R2: 'interface g0/0\nip address 192.168.1.3 255.255.255.0\nstandby 1 ip 192.168.1.254\nno shutdown',
      },
    }
    const rt = createLab(def)
    expect(rt.log('R2')).toEqual([])
    rt.setPower('R1', false)
    expect(rt.log('R2').find((e) => e.mnemonic === 'STATECHANGE')!.text).toBe('Gi0/0 Grp 1 state Standby -> Active')
  })
})
