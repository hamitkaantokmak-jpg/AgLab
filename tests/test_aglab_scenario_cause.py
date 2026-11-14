"""Ortak senaryo panelinde kök neden cevaptır: yüklemede görünmez, çözümden sonra görünür.

Kök neden ipuçlarının yanında ayrı ve kapalı bir <details> ("Kök nedeni göster") içindedir;
ipucu adımları ve çözüm komutları ayrı kutudadır ve değişmez. Senaryo çözülünce (hedefler
sağlanıp hedef ping'i başarılı olunca) kutu kendiliğinden açılır ve "BAŞARILI" durumunun yanına
taşınır. Arızalı senaryo ve arızasız gözlem senaryosu (`verify.observation`) ayrı ayrı denenir;
başka senaryo yüklenince kutu yeniden kapalıdır.
"""

import json
import unittest

from playwright.sync_api import sync_playwright

from aglab_test_support import HTML, ROOT, launch_chromium

RECIPES = {
    r["id"]: r
    for r in json.loads((ROOT / "simulator/network-scenarios.json").read_text(encoding="utf-8"))
}
# Bir arıza senaryosu (çözüm terminalden) ve bir gözlem senaryosu (çözüm hedef ping'inin kendisi)
FAULT = next(
    r
    for r in RECIPES.values()
    if r["verify"]["kind"] == "query"
    and not r.get("pending")
    and not r["verify"].get("observation")
    and not r["verify"].get("survivesReload")
)
OBSERVATION = next(r for r in RECIPES.values() if r["verify"].get("observation"))


class ScenarioCauseTests(unittest.TestCase):
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

    def device(self, name):
        dev = self.page.evaluate(
            "(n) => [...document.querySelectorAll('#ptCliDevice option')]"
            ".find((o) => o.textContent.startsWith(n + ' ')).value",
            name,
        )
        self.page.select_option("#ptCliDevice", dev)

    def type(self, line):
        self.page.fill("#ptCliInput", line)
        self.page.locator("#ptCliInput").press("Enter")

    def load(self, recipe):
        self.page.select_option("#sharedScenarioSelect", recipe["id"])
        self.page.click("#sharedScenarioLoad")

    def cause(self):
        return self.page.locator("#sharedScenarioCause")

    def assert_hidden_on_load(self, recipe):
        cause = self.cause()
        self.assertEqual(cause.count(), 1)
        self.assertFalse(cause.evaluate("(d) => d.open"), "kök neden kapalı olmalı")
        self.assertEqual(cause.locator("summary").text_content(), "Kök nedeni göster")
        # cevap metni görünmüyor; belirti görünüyor
        self.assertFalse(self.page.get_by_text(recipe["cause"], exact=False).first.is_visible())
        panel = self.page.locator("#sharedScenarioInstructions")
        self.assertTrue(panel.get_by_text(recipe["symptom"]).first.is_visible())
        visible = panel.evaluate(
            "(p) => [...p.children].filter((c) => c.tagName === 'P').map((c) => c.textContent).join(' ')"
        )
        self.assertNotIn("Kök neden", visible)
        # kutu ipuçlarının yanında; ipucu kutusu ayrı ve ipuçlarını, çözümü olduğu gibi taşır
        hints = panel.locator("details").filter(has_text="İpuçları ve çözüm komutları")
        self.assertEqual(hints.count(), 1)
        for hint in recipe["hints"]:
            self.assertIn(hint, hints.text_content())
        self.assertNotIn(recipe["cause"], hints.text_content())
        self.assertEqual(
            cause.evaluate("(d) => d.previousElementSibling.querySelector('summary').textContent"),
            "İpuçları ve çözüm komutları",
        )

    def assert_revealed(self, recipe):
        self.assertIn("BAŞARILI", self.page.text_content("#sharedScenarioStatus"))
        cause = self.cause()
        self.assertTrue(cause.evaluate("(d) => d.open"))
        self.assertTrue(cause.get_by_text(recipe["cause"]).is_visible())
        self.assertEqual(
            cause.evaluate("(d) => d.previousElementSibling.id"), "sharedScenarioStatus"
        )

    def solve_and_ping(self, recipe):
        for block in recipe["solution"]:
            self.device(block["device"])
            for c in block["commands"]:
                self.type(c)
        self.device(recipe["verify"]["source"])
        self.type("ping " + recipe["verify"]["target"])

    def test_fault_cause_hidden_until_solved(self):
        self.load(FAULT)
        self.assert_hidden_on_load(FAULT)
        # çözülmeden atılan ping kutuyu açmaz
        self.device(FAULT["verify"]["source"])
        self.type("ping " + FAULT["verify"]["target"])
        self.assertNotIn("BAŞARILI", self.page.text_content("#sharedScenarioStatus"))
        self.assertFalse(self.cause().evaluate("(d) => d.open"))
        self.solve_and_ping(FAULT)
        self.assert_revealed(FAULT)
        # başka senaryo yüklenince yeniden kapalı ve ipuçlarının yanında
        self.load(OBSERVATION)
        self.assert_hidden_on_load(OBSERVATION)

    def test_observation_cause_hidden_until_solved(self):
        self.load(OBSERVATION)
        self.assert_hidden_on_load(OBSERVATION)
        self.solve_and_ping(OBSERVATION)
        self.assert_revealed(OBSERVATION)


if __name__ == "__main__":
    unittest.main()
