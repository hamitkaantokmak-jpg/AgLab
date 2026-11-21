// eigrp-ariza labı: brief'te ve ipuçlarında anılan belirtiler lab başlangıcında gerçekten
// görülebilmeli (AGENTS.md). Lab açılışında günlük temizlenir ve `show logging` yoktur; bu yüzden
// K değeri belirtisi show çıktılarıyla, log ise ancak bir geçişte (kapat-aç) okunur.
import { describe, expect, it } from 'vitest'
import { createLab, runScript } from '../../src/sim'
import lab from '../../src/labs/eigrp-troubleshoot'
import { HINT_TIERS } from '../../src/labs/hint-tiers'

const run = (rt: ReturnType<typeof createLab>, dev: string, cmd: string) => runScript(rt, dev, cmd).join('\n')

describe('eigrp-ariza: brief belirtileri', () => {
  it('başlangıçta R4 komşusuz; K değerleri show ip protocols ile karşılaştırılabilir', () => {
    const rt = createLab(lab)
    expect(rt.logs).toEqual([])
    expect(run(rt, 'R4', 'show ip eigrp neighbors')).not.toMatch(/172\.16\./)
    expect(run(rt, 'R4', 'show ip protocols')).toContain('K1=1, K2=1, K3=1, K4=0, K5=0')
    expect(run(rt, 'R2', 'show ip protocols')).toContain('K1=1, K2=0, K3=1, K4=0, K5=0')
    expect(run(rt, 'S3', 'show ip protocols')).toContain('K1=1, K2=0, K3=1, K4=0, K5=0')
  })

  it('R4\'te arayüz kapatılıp açılınca log\'da K-value mismatch görünür', () => {
    const rt = createLab(lab)
    runScript(rt, 'R4', 'configure terminal\ninterface g0/1\nshutdown\nno shutdown\nend')
    expect(rt.logs.filter((l) => l.dev === 'R4').map((l) => l.text).join('\n')).toMatch(/K-value mismatch/)
  })

  it('belirti 1: R2\'de tek 10.0.0.0/8; yalnız S1\'de no auto-summary ping\'i düzeltir ama özet kalır', () => {
    const rt = createLab(lab)
    expect(rt.query().route('R2', '10.0.0.0', 8)).toBeTruthy()
    expect(rt.query().ping('PC1', '10.3.3.10').ok).toBe(false)
    runScript(rt, 'S1', 'configure terminal\nrouter eigrp 100\nno auto-summary\nend')
    expect(rt.query().ping('PC1', '10.3.3.10').ok).toBe(true)
    expect(rt.query().ping('PC3', '10.1.1.10').ok).toBe(true)
    expect(rt.query().route('R2', '10.0.0.0', 8)).toBeTruthy()
    expect(lab.objectives.find((o) => o.id === 'summary')!.check(rt.query())).toMatchObject({ ok: false })
    runScript(rt, 'S3', 'configure terminal\nrouter eigrp 100\nno auto-summary\nend')
    expect(lab.objectives.find((o) => o.id === 'summary')!.check(rt.query())).toMatchObject({ ok: true })
  })

  it('brief ve kvalue ipucu başlangıçta görülemeyen log\'a dayanmaz', () => {
    const text = lab.brief.join('\n')
    expect(text).not.toMatch(/log'da K-value mismatch/)
    expect(text).toMatch(/show ip eigrp neighbors/)
    expect(text).toMatch(/yalnız S1/)
    const kv = HINT_TIERS['eigrp-ariza']!['kvalue']![0]!
    expect(kv).toMatch(/show ip protocols/)
    expect(kv).not.toMatch(/^R4 neden kimseyle komşu olmuyor\? Log’da ne yazıyor\?$/)
  })
})
