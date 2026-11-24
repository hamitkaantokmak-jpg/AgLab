// Katman 1 geriye uyumluluk: `phys` tanımlamayan labların çıktısı birebir aynı kalır.
//
// Fikstür (fixtures/legacy-output.json) Katman 1'den önceki motorla (main, b8471c3) üretildi:
// her Labber labının başlangıcında ve öğretmen çözümünden sonra, her switch'te aşağıdaki show
// komutlarının ve PC'lerde `show ip`in çıktısı ile rt.save() (kalıcı durum) SHA-256 özeti.
// Yeniden üretmek (yalnız bilinçli bir çıktı değişikliğinde): AGLAB_UPDATE_LEGACY=1 npm run test:sim
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LABS } from '../../src/labs/index'
import { createLab, createSession, runScript } from '../../src/sim/index'

const FIXTURE = join(__dirname, 'fixtures', 'legacy-output.json')
const SWITCH_CMDS = [
  'show interfaces status',
  'show interfaces',
  'show interfaces status err-disabled',
  'show running-config',
  'show spanning-tree',
  'show ip interface brief',
  'show cdp neighbors',
  'show etherchannel summary',
]
const h = (x: unknown) => createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex').slice(0, 16)

function snapshot(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const lab of LABS) {
    for (const stage of ['start', 'solved'] as const) {
      const rt = createLab(lab)
      if (stage === 'solved') for (const [dev, script] of Object.entries(lab.solution)) if (rt.powered(dev)) runScript(rt, dev, script)
      for (const dv of lab.devices) {
        if (!rt.powered(dv.id)) continue
        const s = createSession(rt, dv.id)
        if (dv.kind === 'switch') {
          s.exec('enable')
          for (const cmd of SWITCH_CMDS) out[`${lab.id}/${stage}/${dv.id}/${cmd}`] = h(s.exec(cmd).join('\n'))
        } else out[`${lab.id}/${stage}/${dv.id}/show ip`] = h(s.exec('show ip').join('\n'))
      }
      const saved = rt.save() as unknown as Record<string, unknown>
      out[`${lab.id}/${stage}/save`] = h({ ...saved, seen: [...(saved['seen'] as string[])].sort() })
      out[`${lab.id}/${stage}/objectives`] = h(rt.objectives().map((o) => o.ok))
    }
  }
  return out
}

describe('Katman 1 geriye uyumluluk', () => {
  it('phys tanımlamayan labların show çıktıları ve kalıcı durumu Katman 1 öncesiyle aynı', () => {
    const now = snapshot()
    if (process.env['AGLAB_UPDATE_LEGACY'] === '1' || !existsSync(FIXTURE)) {
      writeFileSync(FIXTURE, JSON.stringify(now, null, 1) + '\n')
      if (process.env['AGLAB_UPDATE_LEGACY'] !== '1') throw new Error('fikstür yoktu; üretildi: ' + FIXTURE)
      return
    }
    const want = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, string>
    expect(Object.keys(now).length).toBeGreaterThan(400)
    const diff = Object.keys(want).filter((k) => now[k] !== want[k])
    expect(diff).toEqual([])
    expect(Object.keys(now).sort()).toEqual(Object.keys(want).sort())
  })
})
