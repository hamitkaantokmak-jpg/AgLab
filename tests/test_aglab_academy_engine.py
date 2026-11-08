"""L2-D2: Akademi M1–M3 (AGL-001…030) Labber'da değerlendirilir.

* Motor kararı içerikten (başlangıç topolojisi, köprü raporu) gelir, motor tablosuyla aynıdır
  ve rozet olarak görünür; sonuç kutusu da değerlendirme motorunu yazar.
* Labber lab değişmezi: her M1–M3 labı başlangıçta en az bir ölçütte başarısız, öğretmen
  hedef topolojisi + cevap anahtarıyla bütün ölçütler Labber'da geçer (100/100).
* `probe.icmp` Labber ping'inden gelir (başarılı ve başarısız iletim), `state.equals`
  Labber görünümünden (toAglab) okunur.
* `required_capabilities`: motorda olmayan yetenek isteyen ölçüt `on_unavailable`
  ("not_evaluated") olur, geçti sayılmaz.
* Çalışma sırasında motor değişmez: topoloji Labber'ın ifade edemediği hale gelirse ölçüt
  hata olarak raporlanır, eski motora düşülmez.
"""

import json
import re
import unittest

from playwright.sync_api import sync_playwright

from aglab_test_support import HTML, ROOT, launch_chromium

M1_M3 = [f"AGL-{n:03d}" for n in range(1, 31)]


def map_decisions():
    text = (ROOT / "docs/LAB_MOTOR_HARITASI.md").read_text(encoding="utf-8")
    rows = re.findall(r"^\| (AGL-\d{3}) \|(?:[^|]*\|){3} ([^|]+) \|", text, re.M)
    return {lid: "labber" if cell.strip() == "**Labber**" else "legacy" for lid, cell in rows}


def lab_json(lid):
    student = json.loads((ROOT / f"academy/student/{lid}.json").read_text(encoding="utf-8"))
    teacher = json.loads((ROOT / f"academy/teacher/{lid}.json").read_text(encoding="utf-8"))
    return student, teacher


class AcademyEngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = launch_chromium(cls.pw)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.page = self.browser.new_page(viewport={"width": 1280, "height": 960})
        self.errors = []
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))
        self.page.goto(HTML.as_uri())
        self.page.click('[data-area="lab"]')

    def tearDown(self):
        self.page.close()
        self.assertEqual(self.errors, [])

    def start(self, lid):
        self.page.select_option("#academySelect", lid)
        self.page.click("#academyStart")
        if self.page.locator("#academyReplacePrompt").is_visible():
            self.page.click("#academyReplaceContinue")

    def answer(self, teacher):
        for key, value in teacher["teacher_solution"]["answer_key"].items():
            control = self.page.locator(f"#academyAnswer-{key}")
            if control.evaluate("(e)=>e.tagName") == "SELECT":
                control.select_option(json.dumps(value) if isinstance(value, bool) else value)
            else:
                control.fill(str(value))

    def test_decision_matches_map_and_badge(self):
        decisions = map_decisions()
        self.assertEqual(len(decisions), 40)
        self.assertEqual([k for k, v in decisions.items() if v == "labber"], M1_M3)
        for lid, engine in decisions.items():
            self.page.select_option("#academySelect", lid)
            badge = self.page.locator("#academyEngineBadge")
            self.assertEqual(badge.get_attribute("data-engine"), engine, lid)
            text = badge.text_content()
            if engine == "labber":
                self.assertTrue(text.startswith("Motor: Labber"), lid)
            else:
                self.assertTrue(text.startswith("Eski motor — nedeni: "), lid)

    def test_m1_m3_fail_first_and_teacher_solution_passes_on_labber(self):
        for lid in M1_M3:
            student, teacher = lab_json(lid)
            self.start(lid)
            first = self.page.evaluate("academy.check()")
            self.assertEqual(first["engine"], "labber", lid)
            self.assertLess(first["earned_points"], 100, lid)
            self.assertTrue(any(c["status"] == "failed" for c in first["criteria"]), lid)
            self.assertIn("Değerlendirme motoru: Labber.", self.page.text_content("#academyResult"))
            self.page.evaluate("t=>academyEngine.load(t)", teacher["target_topology"])
            self.answer(teacher)
            done = self.page.evaluate("academy.check()")
            self.assertEqual(done["engine"], "labber", lid)
            self.assertEqual((done["earned_points"], done["coverage"]), (100, 1), (lid, done))
            self.assertTrue(all(c["status"] == "passed" for c in done["criteria"]), done)

    def test_probe_comes_from_labber_success_and_failure(self):
        # AGL-025: trunk izinli listesi eksik; PC2 → PC4 başta başarısız, PC1 → PC3 başarılı
        student, teacher = lab_json("AGL-025")
        self.start("AGL-025")
        probes = {
            c["id"]: c
            for c in self.page.evaluate("academy.check()")["criteria"]
            if c["kind"] == "probe.icmp"
        }
        self.assertEqual(probes["AGL-025-C04"]["status"], "failed")
        self.assertIn("Labber: Yanıt gelmedi", probes["AGL-025-C04"]["detail"])
        self.assertEqual(probes["AGL-025-C03"]["status"], "passed")
        self.assertIn("Labber: yanıt PC3", probes["AGL-025-C03"]["detail"])
        self.page.evaluate("t=>academyEngine.load(t)", teacher["target_topology"])
        probes = [
            c
            for c in self.page.evaluate("academy.check()")["criteria"]
            if c["kind"] == "probe.icmp"
        ]
        self.assertTrue(
            all(c["status"] == "passed" and "Labber: yanıt" in c["detail"] for c in probes)
        )

    def test_missing_capability_is_not_evaluated(self):
        student, _ = lab_json("AGL-022")
        self.start("AGL-022")
        criteria = student["assessment"]["criteria"]
        # Toplam puan 100 kalsın diye iki ölçüt yetenek isteyen kopyalarıyla değiştirilir.
        pi = next(i for i, c in enumerate(criteria) if c["kind"] == "probe.icmp")
        si = next(i for i, c in enumerate(criteria) if c["kind"] == "state.equals")
        changed = [dict(c) for c in criteria]
        changed[pi] = {
            **criteria[pi],
            "id": "src-if",
            "target": {**criteria[pi]["target"], "source_interface": "eth0"},
        }
        changed[si] = {**criteria[si], "id": "dhcp", "required_capabilities": ["dhcp_lease"]}
        result = self.page.evaluate("c => academy.evaluate(c, {}, null)", changed)
        rows = {r["id"]: r for r in result["criteria"]}
        for cid in ("src-if", "dhcp"):
            self.assertEqual(rows[cid]["status"], "not_evaluated", rows[cid])
            self.assertIn("Labber motorunda değerlendirilemiyor", rows[cid]["detail"])
        self.assertEqual(result["status"], "incomplete")
        self.assertLess(result["coverage"], 1)
        # Eski motor kararındaki lab kaynak arayüzlü probe'u değerlendirir.
        legacy = self.page.evaluate("c => academy.evaluate(c, {}, null, 'legacy')", changed)
        legacy_rows = {r["id"]: r for r in legacy["criteria"]}
        self.assertNotEqual(legacy_rows["src-if"]["status"], "not_evaluated")
        self.assertEqual(legacy_rows["dhcp"]["status"], "not_evaluated")

    def test_unsupported_runtime_topology_is_error_not_fallback(self):
        self.start("AGL-022")
        self.page.click('[data-pt-add="Router"]')
        result = self.page.evaluate("academy.check()")
        self.assertEqual(result["engine"], "labber")
        for c in result["criteria"]:
            if c["kind"] in ("state.equals", "probe.icmp"):
                self.assertEqual(c["status"], "error", c)
                self.assertIn("Motor değiştirilmez", c["detail"])
        self.assertNotEqual(result["status"], "complete")

    def test_legacy_lab_keeps_old_engine(self):
        self.start("AGL-031")
        result = self.page.evaluate("academy.check()")
        self.assertEqual(result["engine"], "legacy")
        self.assertIn("Değerlendirme motoru: eski motor.", self.page.text_content("#academyResult"))


if __name__ == "__main__":
    unittest.main()
