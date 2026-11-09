// L2: Labber'da fiziksel durum — kopuk kablo, kapalı cihaz, kapalı PC NIC'i.
//
// Fiziksel durum yapılandırma değildir (CLI değiştiremez); LabDef'te başlangıç değeri
// (`links[].up`, `devices[].off`, PC `nicDown`), çalışırken LabRuntime.setLink /
// setPower / setNic ile değişir ve türetilmiş durumdan (phys/lport/STP/SVI/L3) okunur.
// Her durum için hem başarılı hem başarısız iletim denenir.
import { describe, expect, it } from 'vitest'
import { createLab, createSession, runScript } from '../../src/sim/index'
import { LabQuery } from '../../src/sim/query'
import { ports } from '../../src/sim/util'
import type { LabDef } from '../../src/sim/types'

// PC1, PC2 — SW1 ==trunk== SW2 — PC3 ; SW1 ve SW2 arasında ikinci (yedek) bağlantı.
function lab(over: (d: LabDef) => void = () => {}): LabDef {
  const d: LabDef = {
    id: 'hw', title: '', summary: '', level: 'Başlangıç', tags: [], brief: [], view: { w: 1, h: 1 },
    devices: [
      { id: 'SW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0001.0000', ports: ports('Fa0/1-3', 'Gi0/1-2'), x: 0, y: 0 },
      { id: 'SW2', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0002.0000', ports: ports('Fa0/1-2', 'Gi0/1-2'), x: 0, y: 0 },
      { id: 'PC1', kind: 'pc', mac: '0050.7966.0001', x: 0, y: 0 },
      { id: 'PC2', kind: 'pc', mac: '0050.7966.0002', x: 0, y: 0 },
      { id: 'PC3', kind: 'pc', mac: '0050.7966.0003', x: 0, y: 0 },
    ],
    links: [
      { a: ['PC1', 'eth0'], b: ['SW1', 'FastEthernet0/1'] },
      { a: ['PC2', 'eth0'], b: ['SW1', 'FastEthernet0/2'] },
      { a: ['PC3', 'eth0'], b: ['SW2', 'FastEthernet0/1'] },
      { a: ['SW1', 'GigabitEthernet0/1'], b: ['SW2', 'GigabitEthernet0/1'] },
      { a: ['SW1', 'GigabitEthernet0/2'], b: ['SW2', 'GigabitEthernet0/2'] },
    ],
    initialConfig: {
      SW1: 'interface range gi0/1 - 2\nswitchport mode trunk\ninterface vlan 1\nip address 192.168.1.251 255.255.255.0\nno shutdown',
      SW2: 'interface range gi0/1 - 2\nswitchport mode trunk\nspanning-tree vlan 1 priority 4096',
    },
    initialPcs: {
      PC1: { ip: '192.168.1.11', prefix: 24, gw: null },
      PC2: { ip: '192.168.1.12', prefix: 24, gw: null },
      PC3: { ip: '192.168.1.13', prefix: 24, gw: null },
    },
    objectives: [], solution: {},
  }
  over(d)
  return d
}

const q = (rt: ReturnType<typeof createLab>) => new LabQuery(rt.derived, rt.startup)
const logs = (rt: ReturnType<typeof createLab>) => rt.logs.map((l) => `${l.dev} ${l.text.replace(/^\*\S+ +\S+ \S+: /, '')}`)

describe('Labber fiziksel durum: kablo', () => {
  it('başlangıçta kopuk kablo (up:false): port notconnect, ping başarısız; takılınca başarılı', () => {
    const rt = createLab(lab((d) => (d.links[1]!.up = false)))
    expect(q(rt).linkUp('PC2')).toBe(false)
    expect(q(rt).linkUp('SW1', 'Fa0/2')).toBe(false)
    expect(q(rt).port('SW1', 'Fa0/2')!.status).toBe('notconnect')
    expect(q(rt).ping('PC1', '192.168.1.12').ok).toBe(false)
    expect(q(rt).ping('PC2', '192.168.1.11').ok).toBe(false)
    // aynı anahtardaki diğer PC'ler etkilenmez
    expect(q(rt).ping('PC1', '192.168.1.13').ok).toBe(true)
    expect(rt.setLink('PC2', 'eth0', true)).toBe(true)
    expect(q(rt).linkUp('PC2')).toBe(true)
    expect(q(rt).port('SW1', 'Fa0/2')!.status).toBe('connected')
    expect(q(rt).ping('PC1', '192.168.1.12').ok).toBe(true)
    expect(logs(rt)).toContain('SW1 %LINK-3-UPDOWN: Interface FastEthernet0/2, changed state to up')
  })

  it('çalışırken kablo çıkarılır: iki uç da düşer, syslog üretilir', () => {
    const rt = createLab(lab())
    expect(q(rt).ping('PC1', '192.168.1.12').ok).toBe(true)
    rt.setLink('SW1', 'FastEthernet0/2', false)
    expect(q(rt).linkUp('PC2')).toBe(false)
    expect(q(rt).ping('PC1', '192.168.1.12').ok).toBe(false)
    expect(logs(rt)).toContain('SW1 %LINK-3-UPDOWN: Interface FastEthernet0/2, changed state to down')
    expect(logs(rt)).toContain('SW1 %LINEPROTO-5-UPDOWN: Line protocol on Interface FastEthernet0/2, changed state to down')
    expect(createSession(rt, 'SW1').exec('show interfaces status').join('\n')).toMatch(/Fa0\/2 +notconnect/)
    expect(rt.setLink('SW1', 'FastEthernet0/3', false), 'kablosu olmayan port').toBe(false)
  })

  it('switch–switch kablosu: STP yedek bağlantıya geçer, ikisi de kopunca erişim biter', () => {
    const rt = createLab(lab())
    // döngüde bir port bloklu
    const blocked = () => ['Gi0/1', 'Gi0/2'].filter((p) => q(rt).stpState('SW1', p, 1) === 'BLK')
    expect(blocked()).toEqual(['Gi0/2'])
    rt.setLink('SW1', 'GigabitEthernet0/1', false)
    expect(q(rt).linkUp('SW2', 'Gi0/1')).toBe(false)
    expect(blocked()).toEqual([])
    expect(q(rt).stpState('SW1', 'Gi0/2', 1)).toBe('FWD')
    expect(q(rt).ping('PC1', '192.168.1.13').ok).toBe(true)
    rt.setLink('SW2', 'GigabitEthernet0/2', false)
    expect(q(rt).ping('PC1', '192.168.1.13').ok).toBe(false)
    expect(q(rt).ping('PC1', '192.168.1.12').ok).toBe(true)
  })
})

describe('Labber fiziksel durum: güç', () => {
  it('kapalı switch: arkasındaki PC erişilemez, komşu port notconnect, STP/SVI/CLI yok', () => {
    const rt = createLab(lab((d) => (d.devices[1] as { off?: boolean }).off = true))
    expect(q(rt).powered('SW2')).toBe(false)
    expect(q(rt).linkUp('SW1', 'Gi0/1')).toBe(false)
    expect(q(rt).linkUp('PC3')).toBe(false)
    expect(q(rt).port('SW1', 'Gi0/1')!.status).toBe('notconnect')
    expect(q(rt).ping('PC1', '192.168.1.13').ok).toBe(false)
    expect(q(rt).ping('PC1', '192.168.1.12').ok).toBe(true)
    expect(rt.derived.stp[1]!['SW2']).toBeUndefined()
    expect(() => createSession(rt, 'SW2')).toThrow(/powered off/)
    expect(() => runScript(rt, 'SW2', 'show version')).toThrow(/powered off/)
  })

  it('kapalı switch SVI adresine ping atılamaz; açılınca atılır', () => {
    const rt = createLab(lab())
    expect(q(rt).ping('PC1', '192.168.1.251').ok).toBe(true)
    rt.setPower('SW1', false)
    expect(q(rt).sviUp('SW1', 1)).toBe(false)
    expect(q(rt).ping('PC3', '192.168.1.251').ok).toBe(false)
    // kapalı cihaz syslog yazmaz; komşu yazar
    expect(logs(rt).filter((l) => l.startsWith('SW1 '))).toEqual([])
    expect(logs(rt)).toContain('SW2 %LINK-3-UPDOWN: Interface GigabitEthernet0/1, changed state to down')
    rt.setPower('SW1', true)
    expect(q(rt).ping('PC3', '192.168.1.251').ok).toBe(true)
  })

  it('açılış yeniden yüklemedir: kaydedilmemiş running-config kaybolur, startup-config geri gelir', () => {
    const rt = createLab(lab())
    runScript(rt, 'SW1', 'configure terminal\nhostname CORE\nend')
    expect(rt.hostname('SW1')).toBe('CORE')
    rt.setPower('SW1', false)
    rt.setPower('SW1', true)
    expect(rt.hostname('SW1')).toBe('SW1')
    runScript(rt, 'SW1', 'configure terminal\nhostname CORE\nend\ncopy running-config startup-config\n')
    rt.setPower('SW1', false)
    rt.setPower('SW1', true)
    expect(rt.hostname('SW1')).toBe('CORE')
  })

  it('kapalı PC: ping gönderemez (reason off), ona ping gitmez, switch portu notconnect', () => {
    const rt = createLab(lab((d) => (d.devices[3] as { off?: boolean }).off = true))
    expect(q(rt).ping('PC2', '192.168.1.11')).toEqual({ ok: false, reason: 'off' })
    expect(q(rt).ping('PC1', '192.168.1.12').ok).toBe(false)
    expect(q(rt).port('SW1', 'Fa0/2')!.status).toBe('notconnect')
    rt.setPower('PC2', true)
    expect(q(rt).ping('PC2', '192.168.1.11').ok).toBe(true)
    // PC'nin adresi açılışta korunur (PC yapılandırması kalıcı)
    expect(q(rt).pcIp('PC2')).toBe('192.168.1.12')
  })

  it('kapalı PC NIC: port notconnect, ping iki yönde başarısız; NIC açılınca başarılı', () => {
    const rt = createLab(lab((d) => (d.devices[2] as { nicDown?: boolean }).nicDown = true))
    expect(q(rt).linkUp('PC1')).toBe(false)
    expect(q(rt).ping('PC1', '192.168.1.12').ok).toBe(false)
    expect(q(rt).ping('PC2', '192.168.1.11').ok).toBe(false)
    rt.setNic('PC1', true)
    expect(q(rt).ping('PC1', '192.168.1.12').ok).toBe(true)
  })

  it('fiziksel durum kaydedilir ve geri yüklenir', () => {
    const rt = createLab(lab())
    rt.setLink('PC1', 'eth0', false)
    rt.setPower('SW2', false)
    rt.setNic('PC2', false)
    const saved = JSON.parse(JSON.stringify(rt.save()))
    const rt2 = createLab(lab())
    expect(rt2.load(saved)).toBe(true)
    expect(q(rt2).linkUp('PC1')).toBe(false)
    expect(q(rt2).powered('SW2')).toBe(false)
    expect(q(rt2).linkUp('PC2')).toBe(false)
    expect(q(rt2).ping('PC2', '192.168.1.11').ok).toBe(false)
    // eski (hw alanı olmayan) kayıt yüklenir; fiziksel durum lab tanımından gelir
    delete saved.hw
    const rt3 = createLab(lab())
    expect(rt3.load(saved)).toBe(true)
    expect(q(rt3).ping('PC1', '192.168.1.12').ok).toBe(true)
  })
})
