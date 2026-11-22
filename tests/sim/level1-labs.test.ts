// Seviye 1 yönlendirmeli labları (Şube 1.0): brief'te anılan her belirti lab açılışında
// görülür (AGENTS.md: rt.logs temizlenir, show logging yok; belirtiler show/ping/ip dhcp ile)
// ve referans çözümden sonra beklenen sonuç gelir.
import { describe, expect, it } from 'vitest'
import { findLab } from '../../src/labs'
import { createLab, createSession, runScript } from '../../src/sim'
import type { LabRuntime } from '../../src/sim/runtime'

const lab = (id: string) => {
  const def = findLab(id)
  if (!def) throw new Error(id)
  return { def, rt: createLab(def) }
}
const run = (rt: LabRuntime, dev: string, line: string) => createSession(rt, dev).exec(line).join('\n')
const solve = (rt: LabRuntime, sol: Record<string, string>) => {
  for (const [dev, s] of Object.entries(sol)) runScript(rt, dev, s)
}
const failing = (rt: LabRuntime) => rt.objectives().filter((o) => !o.ok).map((o) => o.id)

describe('dhcp-kurulum (Konu #9)', () => {
  it('başta 1. katta DHCP yok (169.254), 2. kat da adres alamıyor', () => {
    const { rt } = lab('dhcp-kurulum')
    expect(run(rt, 'PC-11', 'ip dhcp')).toMatch(/Can't find dhcp server/)
    expect(rt.pcs['PC-11']!.ip).toMatch(/^169\.254\./)
    expect(run(rt, 'PC-21', 'ip dhcp')).toMatch(/Can't find dhcp server/)
    expect(failing(rt)).toEqual(['exclude', 'pool', 'relay'])
  })
  it('çözümden sonra PC-11 .21 alır, PC-21 SRV\'den relay ile alır', () => {
    const { def, rt } = lab('dhcp-kurulum')
    solve(rt, def.solution)
    expect(run(rt, 'PC-11', 'ip dhcp')).toContain('DDORA IP 192.168.10.21/24 GW 192.168.10.1')
    expect(run(rt, 'PC-21', 'ip dhcp')).toMatch(/DDORA IP 192\.168\.20\.\d+\/24 GW 192\.168\.20\.1/)
    expect(run(rt, 'PC-21', 'show ip')).toMatch(/DHCP SERVER\s*:?\s*192\.168\.100\.10/)
    expect(run(rt, 'R1', 'show ip dhcp binding')).toContain('192.168.10.21')
    expect(failing(rt)).toEqual([])
  })
  it('dışlama yoksa ilk adres .2 olur ve hedef sağlanmaz', () => {
    const { rt } = lab('dhcp-kurulum')
    runScript(rt, 'R1', 'configure terminal\nip dhcp pool KAT1\nnetwork 192.168.10.0 255.255.255.0\ndefault-router 192.168.10.1\ndns-server 192.168.100.10\nend')
    expect(failing(rt)).toContain('pool')
    expect(failing(rt)).toContain('exclude')
  })
})

describe('dns-kurulum (Konu #10)', () => {
  it('başta: ping gider ama ad çözülmez; iki katın belirtisi farklı', () => {
    const { rt } = lab('dns-kurulum')
    run(rt, 'PC-11', 'ip dhcp')
    expect(run(rt, 'PC-11', 'show ip')).toMatch(/192\.168\.100\.11/)
    expect(run(rt, 'PC-11', 'ping 192.168.100.20')).toMatch(/bytes from 192\.168\.100\.20/)
    expect(run(rt, 'PC-11', 'nslookup ERP')).toMatch(/timed out/i)
    run(rt, 'PC-21', 'ip dhcp')
    expect(run(rt, 'PC-21', 'nslookup ERP')).toMatch(/Default servers are not available/)
    expect(failing(rt)).toEqual(['kat1', 'kat2'])
  })
  it('çözümden sonra yeniden ip dhcp ile ERP çözülür', () => {
    const { def, rt } = lab('dns-kurulum')
    solve(rt, def.solution)
    for (const pc of ['PC-11', 'PC-21']) {
      run(rt, pc, 'ip dhcp')
      expect(run(rt, pc, 'nslookup ERP'), pc).toMatch(/192\.168\.100\.20/)
    }
    expect(failing(rt)).toEqual([])
  })
})

describe('roas-kurulum (Konu #7)', () => {
  it('başta aynı VLAN çalışır, VLAN arası çalışmaz; çözümden sonra çalışır', () => {
    const { def, rt } = lab('roas-kurulum')
    expect(run(rt, 'PC-01', 'ping 192.168.10.13')).toMatch(/bytes from/)
    expect(run(rt, 'PC-01', 'ping 192.168.20.12')).not.toMatch(/bytes from/)
    solve(rt, def.solution)
    expect(run(rt, 'PC-01', 'ping 192.168.20.12')).toMatch(/bytes from/)
    expect(run(rt, 'SW1', 'show interfaces trunk')).toMatch(/Gi0\/1/)
    expect(failing(rt)).toEqual([])
  })
})

describe('cdp-kesif (Konu #12)', () => {
  it('R1\'den başlayarak komşular bulunur; PC\'ler CDP tablosunda yok', () => {
    const { rt } = lab('cdp-kesif')
    const r1 = run(rt, 'R1', 'show cdp neighbors')
    expect(r1).toContain('SW-CORE')
    const core = run(rt, 'SW-CORE', 'show cdp neighbors')
    for (const n of ['R1', 'SW-KAT1', 'SW-KAT2']) expect(core).toContain(n)
    expect(core).not.toContain('ADMIN')
    expect(run(rt, 'SW-KAT1', 'show cdp neighbors')).not.toMatch(/PC-1[12]/)
    expect(failing(rt)).toEqual(['labels', 'lldp', 'nocdp'])
  })
  it('çözümden sonra Name sütunu dolar, LLDP açık, komşu tablosu bozulmaz', () => {
    const { def, rt } = lab('cdp-kesif')
    solve(rt, def.solution)
    expect(run(rt, 'SW-CORE', 'show interfaces status')).toMatch(/R1 Gi0\/0/)
    expect(run(rt, 'SW-CORE', 'show lldp')).not.toMatch(/not enabled/i)
    expect(run(rt, 'SW-CORE', 'show cdp neighbors')).toContain('SW-KAT1')
    expect(failing(rt)).toEqual([])
  })
  it('uplink\'te CDP kapatılırsa son hedef bozulur', () => {
    const { def, rt } = lab('cdp-kesif')
    solve(rt, def.solution)
    runScript(rt, 'SW-KAT1', 'configure terminal\ninterface gi0/1\nno cdp enable\nend')
    expect(failing(rt)).toEqual(['uplinks'])
  })
})

describe('fiziksel-kontrol (Konu #4)', () => {
  it('başta: Fa0/2 disabled, uplink SW1\'de notconnect ve SW2\'de disabled', () => {
    const { rt } = lab('fiziksel-kontrol')
    const sw1 = run(rt, 'SW1', 'show interfaces status')
    expect(sw1).toMatch(/Fa0\/2\s.*disabled/)
    expect(sw1).toMatch(/Gi0\/1\s.*notconnect/)
    expect(run(rt, 'SW2', 'show interfaces status')).toMatch(/Gi0\/1\s.*disabled/)
    expect(run(rt, 'PC-2', 'ping 192.168.10.11')).not.toMatch(/bytes from/)
    expect(failing(rt)).toEqual(['pc2', 'uplink', 'unused', 'labels'])
  })
  it('çözümden sonra ping çalışır ve Name sütunu dolar', () => {
    const { def, rt } = lab('fiziksel-kontrol')
    solve(rt, def.solution)
    const sw1 = run(rt, 'SW1', 'show interfaces status')
    expect(sw1).toMatch(/Fa0\/1\s+PC-1\s.*connected/)
    expect(sw1).toMatch(/Fa0\/3\s.*disabled/)
    expect(run(rt, 'PC-2', 'ping 192.168.10.50')).toMatch(/bytes from/)
    expect(failing(rt)).toEqual([])
  })
})
