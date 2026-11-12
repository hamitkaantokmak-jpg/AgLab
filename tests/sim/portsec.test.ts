// L5-e: port security (access portları). Başarılı ve başarısız durumlar: ihlal modları,
// err-disable ve kurtarma, sticky, IOS ret metinleri, show çıktıları.
import { describe, expect, it } from 'vitest'
import { createLab, createSession, runScript, type VpcsSession } from '../../src/sim'
import type { LabRuntime } from '../../src/sim/runtime'
import type { LabDef } from '../../src/sim/types'
import { ports } from '../../src/sim/util'

const PC1_MAC = '0050.0000.0010'
function lab(fa1: string[] = []): LabDef {
  return {
    id: 'l5e', title: '', summary: '', level: 'Orta', tags: [], brief: [], objectives: [], solution: {}, view: { w: 1, h: 1 },
    devices: [
      { id: 'SW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0010.0000', ports: [...ports('Fa0/1-3'), ...ports('Gi0/1-2')], x: 0, y: 0 },
      { id: 'PC1', kind: 'pc', mac: PC1_MAC, x: 0, y: 0 },
      { id: 'PC2', kind: 'pc', mac: '0050.0000.0020', x: 0, y: 0 },
    ],
    links: [
      { a: ['PC1', 'eth0'], b: ['SW1', 'FastEthernet0/1'] },
      { a: ['PC2', 'eth0'], b: ['SW1', 'FastEthernet0/2'] },
    ],
    initialConfig: {
      SW1: ['hostname SW1', 'vlan 10', 'exit', 'interface range fa0/1 - 2', 'switchport mode access', 'switchport access vlan 10', 'interface fa0/1', ...fa1].join('\n'),
    },
    initialPcs: { PC1: { ip: '10.0.10.1', prefix: 24, gw: null }, PC2: { ip: '10.0.10.2', prefix: 24, gw: null } },
  }
}
const ping = (rt: LabRuntime, from: string, ip: string) => /bytes from/.test((createSession(rt, from) as VpcsSession).exec('ping ' + ip).join('\n'))
const run = (rt: LabRuntime, line: string) => runScript(rt, 'SW1', line).slice(1).join('\n')
const cfg = (rt: LabRuntime, script: string) => runScript(rt, 'SW1', 'configure terminal\n' + script + '\nend').join('\n')
const errdis = (rt: LabRuntime) => rt.errdis.has('SW1|FastEthernet0/1')
const logs = (rt: LabRuntime, s: string) => rt.logs.filter((l) => l.text.includes(s)).length

describe('port security: IOS kuralları', () => {
  it('yalnız access portta: dinamik ve trunk portta IOS ret metni', () => {
    const rt = createLab(lab())
    expect(cfg(rt, 'interface fa0/3\nswitchport port-security')).toContain('Command rejected: FastEthernet0/3 is a dynamic port.')
    expect(cfg(rt, 'interface gi0/1\nswitchport mode trunk\nswitchport port-security maximum 2')).toContain('Command rejected: GigabitEthernet0/1 is a trunk port.')
    expect(rt.running['SW1']!.ifaces['FastEthernet0/3']!.portSecurity).toBeUndefined()
    expect(cfg(rt, 'interface fa0/1\nswitchport port-security')).not.toContain('rejected')
  })

  it('maximum ve mac-address sınırları', () => {
    const rt = createLab(lab(['switchport port-security', 'switchport port-security mac-address 0200.0000.00fe']))
    expect(cfg(rt, 'interface fa0/1\nswitchport port-security mac-address 0200.0000.00fd')).toContain('Total secure mac-addresses on interface FastEthernet0/1 has reached maximum limit.')
    cfg(rt, 'interface fa0/1\nswitchport port-security maximum 2\nswitchport port-security mac-address 0200.0000.00fd')
    expect(cfg(rt, 'interface fa0/1\nswitchport port-security maximum 1')).toContain('Maximum is less than number of currently secured mac-addresses.')
    expect(rt.running['SW1']!.ifaces['FastEthernet0/1']!.portSecurity).toMatchObject({ max: 2, macs: ['0200.0000.00fe', '0200.0000.00fd'] })
    const run1 = run(rt, 'show running-config')
    expect(run1).toContain('interface FastEthernet0/1\n switchport access vlan 10\n switchport mode access\n switchport port-security maximum 2\n switchport port-security\n switchport port-security mac-address 0200.0000.00fe\n switchport port-security mac-address 0200.0000.00fd\n!')
  })
})

describe('port security: ihlal modları', () => {
  it('shutdown: bilinmeyen MAC → err-disabled, syslog, sayaç; shutdown / no shutdown ile kurtarma', () => {
    const rt = createLab(lab(['switchport port-security', 'switchport port-security mac-address 0200.0000.00fe']))
    expect(ping(rt, 'PC1', '10.0.10.2')).toBe(false)
    expect(errdis(rt)).toBe(true)
    expect(logs(rt, `%PORT_SECURITY-2-PSECURE_VIOLATION: Security violation occurred, caused by MAC address ${PC1_MAC} on port FastEthernet0/1.`)).toBe(1)
    expect(logs(rt, '%PM-4-ERR_DISABLE: psecure-violation error detected on Fa0/1, putting Fa0/1 in err-disable state')).toBe(1)
    expect(run(rt, 'show interfaces status')).toMatch(/Fa0\/1\s+err-disabled/)
    expect(run(rt, 'show interfaces status err-disabled')).toMatch(/Fa0\/1\s+err-disabled\s+psecure-violation/)
    expect(run(rt, 'show port-security')).toMatch(/Fa0\/1\s+1\s+1\s+1\s+Shutdown/)
    expect(run(rt, 'show port-security interface fa0/1')).toContain('Port Status                : Secure-shutdown')
    expect(run(rt, 'show port-security interface fa0/1')).toContain(`Last Source Address:Vlan   : ${PC1_MAC}:10`)
    // MAC düzeltilmeden kurtarma yeni ihlalle tekrar err-disable olur
    cfg(rt, 'interface fa0/1\nshutdown\nno shutdown')
    expect(errdis(rt)).toBe(false)
    expect(ping(rt, 'PC1', '10.0.10.2')).toBe(false)
    expect(errdis(rt)).toBe(true)
    cfg(rt, `interface fa0/1\nno switchport port-security mac-address 0200.0000.00fe\nswitchport port-security mac-address ${PC1_MAC}\nshutdown\nno shutdown`)
    expect(ping(rt, 'PC1', '10.0.10.2')).toBe(true)
    expect(run(rt, 'show port-security interface fa0/1')).toContain('Port Status                : Secure-up')
  })

  it('restrict: trafik düşer, port açık kalır, her denemede sayaç ve syslog', () => {
    const rt = createLab(lab(['switchport port-security', 'switchport port-security violation restrict', 'switchport port-security mac-address 0200.0000.00fe']))
    expect(ping(rt, 'PC1', '10.0.10.2')).toBe(false)
    expect(ping(rt, 'PC1', '10.0.10.2')).toBe(false)
    expect(errdis(rt)).toBe(false)
    expect(rt.psViolations.get('SW1|FastEthernet0/1')).toBe(2)
    expect(logs(rt, '%PORT_SECURITY-2-PSECURE_VIOLATION')).toBe(2)
    expect(run(rt, 'show port-security')).toMatch(/Fa0\/1\s+1\s+1\s+2\s+Restrict/)
    // aynı switch'teki diğer uç etkilenmez
    expect(run(rt, 'show interfaces status')).toMatch(/Fa0\/1\s+connected/)
  })

  it('protect: trafik sessizce düşer (sayaç ve syslog yok)', () => {
    const rt = createLab(lab(['switchport port-security', 'switchport port-security violation protect', 'switchport port-security mac-address 0200.0000.00fe']))
    expect(ping(rt, 'PC1', '10.0.10.2')).toBe(false)
    expect([errdis(rt), rt.psViolations.get('SW1|FastEthernet0/1') ?? 0, logs(rt, 'PSECURE_VIOLATION')]).toEqual([false, 0, 0])
  })
})

describe('port security: öğrenme', () => {
  it('dinamik öğrenme: ilk çerçevede SecureDynamic, port düşünce silinir; config\'e yazılmaz', () => {
    const rt = createLab(lab(['switchport port-security']))
    expect(ping(rt, 'PC1', '10.0.10.2')).toBe(true)
    expect(run(rt, 'show port-security address')).toMatch(new RegExp(`10\\s+${PC1_MAC}\\s+SecureDynamic\\s+Fa0/1`))
    expect(run(rt, 'show running-config')).not.toContain(PC1_MAC)
    rt.setLink('SW1', 'FastEthernet0/1', false)
    expect(rt.psDynamic.size).toBe(0)
  })

  it('sticky: öğrenilen MAC running-config\'e yazılır; maximum dolunca başka MAC ihlaldir', () => {
    const rt = createLab(lab(['switchport port-security', 'switchport port-security mac-address sticky']))
    expect(ping(rt, 'PC1', '10.0.10.2')).toBe(true)
    expect(run(rt, 'show running-config')).toContain(` switchport port-security mac-address sticky\n switchport port-security mac-address sticky ${PC1_MAC}`)
    expect(run(rt, 'show port-security address')).toMatch(/SecureSticky/)
    // kablo başka PC'ye taşınınca: sticky adres kalır, yeni MAC ihlal → err-disabled
    expect(rt.moveCable('SW1', 'FastEthernet0/1', 'SW1', 'FastEthernet0/3')).toBe(true)
    expect(rt.moveCable('SW1', 'FastEthernet0/2', 'SW1', 'FastEthernet0/1')).toBe(true)
    expect(ping(rt, 'PC2', '10.0.10.1')).toBe(false)
    expect(errdis(rt)).toBe(true)
  })
})
