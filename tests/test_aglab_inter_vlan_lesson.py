"""VLAN'lar arası yönlendirme dersi (Konu #7): router-on-a-stick arıza senaryoları.

Ortak senaryo denetimi her tarifin "başta başarısız, çözümden sonra başarılı" olduğunu
zaten doğrular. Bu test dersin öğrettiği ek davranışları sabitler:

* Arıza varken aynı VLAN'daki erişim (PC-01 -> PC-03) çalışır; sorun yalnız VLAN'lar arasıdır.
  Fiziksel arayüzün kapalı olduğu senaryo bunun istisnası değildir: switch katmanı sağlamdır.
* Çözümden sonra VLAN'lar arası erişim iki yönde de çalışır (dönüş yolu dahil).
* İki hatalı senaryoda hatalardan yalnız biri düzeltilirse erişim hâlâ başarısızdır.
"""

import json
import unittest
from playwright.sync_api import sync_playwright

from aglab_test_support import ROOT, launch_chromium

LESSON_SCENARIOS = [
    "roas-wrong-tag",
    "roas-switch-port-access",
    "roas-pc-gateway",
    "roas-physical-shutdown",
    "roas-two-faults",
]


class InterVlanLessonScenarioTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = launch_chromium(cls.pw)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={"width": 1280, "height": 960})
        self.page = self.context.new_page()
        self.errors = []
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))
        self.page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
        self.page.click('[data-area="lab"]')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def js(self, code, arg=None):
        return self.page.evaluate(code, arg)

    def load(self, scenario):
        self.js("(id)=>aglabSharedEngine.load(id)", scenario)
        names = {d["name"] for d in self.js("academyEngine.snapshot()")["devices"]}
        self.assertTrue({"PC-01", "PC-02", "PC-03", "SW1", "R1"} <= names, scenario)

    def recipe(self, scenario):
        return self.js("(id)=>aglabSharedEngine.recipes().find(r=>r.id===id)", scenario)

    def run_block(self, block):
        self.js(
            "([name,commands])=>aglabSharedEngine.commandBlock(name,commands)",
            [block["device"], block["commands"]],
        )

    def reachable(self, source, target):
        return self.js("([s,t])=>aglabSharedEngine.reach(s,t)", [source, target])

    def test_all_lesson_scenarios_are_present(self):
        ids = {r["id"] for r in self.js("aglabSharedEngine.recipes()")}
        self.assertTrue(set(LESSON_SCENARIOS) <= ids, set(LESSON_SCENARIOS) - ids)

    def test_fault_blocks_inter_vlan_only_and_fix_restores_both_directions(self):
        for scenario in LESSON_SCENARIOS:
            with self.subTest(scenario=scenario):
                self.load(scenario)
                # L5-a: router-on-a-stick senaryoları Labber kararında; hedef Labber'dan gelir
                self.assertEqual(self.js("aglabSharedEngine.engine()")["engine"], "labber")
                self.assertFalse(self.js("aglabSharedEngine.goal()"))
                self.assertFalse(
                    self.reachable("PC-01", "PC-02"), "arıza VLAN'lar arası erişimi kesmeli"
                )
                self.assertTrue(
                    self.reachable("PC-01", "PC-03"), "aynı VLAN arızadan etkilenmemeli"
                )
                for block in self.recipe(scenario)["solution"]:
                    self.run_block(block)
                self.assertTrue(self.js("aglabSharedEngine.goal()"))
                self.assertTrue(self.reachable("PC-01", "PC-02"), "çözüm erişimi açmalı")
                self.assertTrue(self.reachable("PC-02", "PC-03"), "dönüş yönü de çalışmalı")

    def test_two_fault_scenario_needs_both_fixes(self):
        blocks = self.recipe("roas-two-faults")["solution"]
        self.assertEqual(len(blocks), 2)
        for only in blocks:
            with self.subTest(only=only["device"]):
                self.load("roas-two-faults")
                self.run_block(only)
                self.assertFalse(self.reachable("PC-01", "PC-02"), "tek düzeltme yeterli olmamalı")
                self.assertFalse(self.js("aglabSharedEngine.goal()"))


class InterVlanLessonContentTests(unittest.TestCase):
    def test_course_follows_vlan_and_has_detail(self):
        courses = json.loads((ROOT / "src/data/courses.json").read_text(encoding="utf-8"))
        details = json.loads((ROOT / "src/data/course-details.json").read_text(encoding="utf-8"))
        ids = [c["id"] for c in courses]
        self.assertEqual(ids.index("intervlan"), ids.index("vlan") + 1)
        self.assertEqual(len(ids), len(set(ids)))
        course = courses[ids.index("intervlan")]
        self.assertEqual(len(course["quiz"]), 10)
        for question, options, answer, explanation in course["quiz"]:
            self.assertEqual(len(options), 4, question)
            self.assertTrue(0 <= answer < 4 and explanation, question)
        detail = next(d for d in details if d["id"] == "intervlan")
        for item in detail["quiz"]:
            self.assertTrue(0 <= item["answer"] < len(item["options"]), item["q"])
        self.assertTrue(0 <= detail["case"]["answer"] < len(detail["case"]["choices"]))
        flow = (ROOT / "src/app/student-flow.js").read_text(encoding="utf-8")
        self.assertIn("'intervlan': ['intervlan']", flow)


if __name__ == "__main__":
    unittest.main()
