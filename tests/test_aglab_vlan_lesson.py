"""VLAN ve trunk dersi (Konu #5-6) arıza senaryoları: başarılı ve başarısız iletim.

Ortak senaryo denetimi her tarifin "başta başarısız, çözümden sonra başarılı" olduğunu
zaten doğrular. Bu test dersin öğrettiği iki ek davranışı sabitler:

* Çözümden sonra bile farklı VLAN'daki PC'ye erişim başarısız kalır (VLAN yalıtımı).
* İki hatalı senaryoda hatalardan yalnız biri düzeltilirse erişim hâlâ başarısızdır.
"""

import unittest
from playwright.sync_api import sync_playwright

from aglab_test_support import ROOT, launch_chromium

LESSON_SCENARIOS = [
    "vlan-wrong-access",
    "vlan-uplink-not-trunk",
    "vlan-allowed-overwritten",
    "vlan-missing-on-switch",
    "vlan-two-faults",
]


class VlanLessonScenarioTests(unittest.TestCase):
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
        self.assertTrue({"PC-01", "PC-02", "PC-03", "PC-04"} <= names, scenario)

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

    def test_fault_blocks_then_fix_restores_and_vlans_stay_isolated(self):
        for scenario in LESSON_SCENARIOS:
            with self.subTest(scenario=scenario):
                self.load(scenario)
                self.assertFalse(self.reachable("PC-01", "PC-02"), "arıza başta erişimi kesmeli")
                for block in self.recipe(scenario)["solution"]:
                    self.run_block(block)
                self.assertTrue(self.reachable("PC-01", "PC-02"), "çözüm erişimi açmalı")
                self.assertTrue(self.reachable("PC-03", "PC-04"), "diğer VLAN da çalışmalı")
                self.assertFalse(self.reachable("PC-01", "PC-04"), "VLAN'lar arası erişim olmamalı")

    def test_two_fault_scenario_needs_both_fixes(self):
        blocks = self.recipe("vlan-two-faults")["solution"]
        self.assertEqual(len(blocks), 2)
        for only in blocks:
            with self.subTest(only=only["device"]):
                self.load("vlan-two-faults")
                self.run_block(only)
                self.assertFalse(self.reachable("PC-01", "PC-02"), "tek düzeltme yeterli olmamalı")


if __name__ == "__main__":
    unittest.main()
