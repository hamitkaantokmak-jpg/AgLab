"""L1 ping paritesi: eski AğLab motoru ⇄ Labber (köprü üzerinden), gerçek içerikte.

Her içerik iki durumda denenir:
* 40 Akademi labı: öğrenci başlangıç topolojisi ve öğretmen hedef topolojisi.
* Ortak senaryolar: yüklenmiş başlangıç ve tarif çözüm komutlarından sonraki durum.

Köprü kararı 'labber' olan her durumda, IP'li PC'lerin bütün sıralı çiftleri için eski
motorun `reach` sonucu ile Labber `LabQuery.ping().ok` karşılaştırılır. Farklar sessizce
eşitlenmez: yalnız aşağıda tek tek listelenen, uyumluluk matrisinde kararı yazılı farklar
kabul edilir ve bunlar da birebir ortaya çıkmak zorundadır (liste dışı fark ya da artık
oluşmayan bir liste satırı testi düşürür). Karşılaştırmada hem başarılı hem
başarısız ping bulunmalıdır. Sonuç sim-parity-browser.json olarak kaydedilir.
"""

import json
import unittest

from playwright.sync_api import sync_playwright

from aglab_test_support import HTML, ROOT, artifact_dir, launch_chromium

COMPARE = """(t) => {
  academyEngine.load(t);
  const snap = academyEngine.snapshot();
  const pcs = snap.devices.filter((d) => d.type === 'PC' && d.ip);
  const r = AgLabSim.toLabber(snap);
  const out = { decision: r.report.engineDecision, reasons: r.report.reasons, pairs: [] };
  if (r.report.engineDecision !== 'labber') return out;
  const rt = AgLabSim.createRuntime(r);
  const q = new AgLabSim.LabQuery(rt.derived, rt.startup);
  for (const a of pcs) for (const b of pcs) if (a !== b) {
    const labber = q.ping(a.id, b.ip);
    out.pairs.push({ from: a.name, to: b.name, legacy: aglabSharedEngine.reach(a.name, b.name),
                     labber: labber.ok, reason: labber.reason || null });
  }
  return out;
}"""


# docs/UYUMLULUK_MATRISI.md "Labber motoru ile eski motor arasındaki bilinen farklar":
# eski motor dönüş yolunu kaynağın kendi maskesi/ARP sonucu ile kurmuyor; Labber kuruyor.
# Karar: Labber (Cisco/gerçek davranış). Bu senaryolar zaten Labber'da değerlendirilir.
KNOWN_DIFFS = {
    # asimetrik maske: PC-C /25 yanıtı .11/.12'ye geri gönderemez (ağ geçidi yok)
    ("eth-wrong-mask", "başlangıç", "PC-A", "PC-C"),
    ("eth-wrong-mask", "başlangıç", "PC-B", "PC-C"),
    # IP çakışması: .12'nin ARP'sini LAPTOP kazanır; PC-B'ye yanıt dönmez
    ("eth-duplicate-ip", "başlangıç", "PC-B", "PC-A"),
    ("eth-duplicate-ip", "başlangıç", "PC-B", "PC-C"),
}


def collect(page):
    items = []
    for path in sorted((ROOT / "academy/student").glob("AGL-*.json")):
        lid = path.stem
        items.append(
            (lid, "başlangıç", json.loads(path.read_text(encoding="utf-8"))["initial_topology"])
        )
        teacher = json.loads((ROOT / f"academy/teacher/{lid}.json").read_text(encoding="utf-8"))
        items.append((lid, "hedef", teacher["target_topology"]))
    for rec in page.evaluate("aglabSharedEngine.recipes()"):
        page.evaluate("(id)=>aglabSharedEngine.load(id)", rec["id"])
        items.append((rec["id"], "başlangıç", page.evaluate("academyEngine.snapshot()")))
        for block in rec["solution"]:
            page.evaluate(
                "([n,c])=>aglabSharedEngine.commandBlock(n,c)", [block["device"], block["commands"]]
            )
        items.append((rec["id"], "çözüm", page.evaluate("academyEngine.snapshot()")))
    return items


class SimPingParityTests(unittest.TestCase):
    def test_ping_parity_on_real_content(self):
        with sync_playwright() as pw:
            browser = launch_chromium(pw)
            page = browser.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(HTML.as_uri())
            page.click('[data-area="lab"]')
            results = []
            for cid, state, topology in collect(page):
                row = page.evaluate(COMPARE, topology)
                row.update(content=cid, state=state)
                results.append(row)
            browser.close()
        self.assertEqual(errors, [])
        labber = [r for r in results if r["decision"] == "labber"]
        pairs = [p for r in labber for p in r["pairs"]]
        diffs = [
            {"content": r["content"], "state": r["state"], **p}
            for r in labber
            for p in r["pairs"]
            if p["legacy"] != p["labber"]
        ]
        summary = {
            "states": len(results),
            "labber_states": len(labber),
            "pairs": len(pairs),
            "ping_ok": sum(p["labber"] for p in pairs),
            "ping_fail": sum(not p["labber"] for p in pairs),
            "diffs": diffs,
        }
        (artifact_dir() / "sim-parity-browser.json").write_text(
            json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print("SIM_PING_PARITY", json.dumps({k: v for k, v in summary.items() if k != "diffs"}))
        scenarios = json.loads(
            (ROOT / "simulator/network-scenarios.json").read_text(encoding="utf-8")
        )
        self.assertEqual(len(results), 2 * (40 + len(scenarios)))
        self.assertGreater(summary["ping_ok"], 50, "başarılı ping de karşılaştırılmalı")
        self.assertGreater(summary["ping_fail"], 50, "başarısız ping de karşılaştırılmalı")
        self.assertTrue(all(d["legacy"] and not d["labber"] for d in diffs), diffs)
        self.assertEqual(
            {(d["content"], d["state"], d["from"], d["to"]) for d in diffs},
            KNOWN_DIFFS,
            "eski motor ile Labber arasında beklenmeyen (ya da artık oluşmayan) ping farkı",
        )


if __name__ == "__main__":
    unittest.main()
