"""Ortak senaryo panelinde kök neden cevaptır: yüklemede DOM'da yoktur (#86).

Kök neden kutusu (<details> "Kök nedeni göster") çözüm kilidi açılınca kapalı olarak görev
metninin altına eklenir; senaryo çözülünce (hedefler sağlanıp hedef ping'i başarılı olunca) açık
olarak "BAŞARILI" durumunun yanına konur. İpuçları ve çözüm komutları panelde yoktur (arayüz
PR 3: Simülatör üst çubuğunda kademeli İpucu ve kilitli "Çözümü göster"). Arızalı senaryo ve
arızasız gözlem senaryosu (`verify.observation`) ayrı ayrı denenir; başka senaryo yüklenince kutu
yeniden yoktur.
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

    def page_text(self):
        """Sayfadaki öğelerin metni (gömülü betik verisi hariç)."""
        return self.page.evaluate(
            "() => { const b = document.body.cloneNode(true);"
            " b.querySelectorAll('script, style').forEach((n) => n.remove());"
            " return b.textContent; }"
        )

    def assert_hidden_on_load(self, recipe):
        # #86: kök neden kutusu ve metni yüklemede DOM'da yok; belirti görünüyor.
        self.page.wait_for_timeout(300)  # çalışma alanı yenilemesi (120 ms) bitsin
        self.assertEqual(self.cause().count(), 0)
        self.assertNotIn(recipe["cause"], self.page_text())
        self.assertNotIn("Kök nedeni göster", self.page_text())
        panel = self.page.locator("#sharedScenarioInstructions")
        self.assertTrue(panel.get_by_text(recipe["symptom"]).first.is_visible())
        # Arayüz PR 3: ipuçları ve çözüm komutları panelde değil (üst çubuk İpucu / kilitli
        # "Çözümü göster").
        self.assertEqual(
            panel.locator("details").filter(has_text="İpuçları ve çözüm komutları").count(), 0
        )
        self.assertEqual(panel.locator("pre").count(), 0)
        self.assertEqual(self.page.locator("#agSimSolution").count(), 0)

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
        self.assertEqual(self.cause().count(), 0)
        self.solve_and_ping(FAULT)
        self.assert_revealed(FAULT)
        # başka senaryo yüklenince kutu yeniden yok
        self.load(OBSERVATION)
        self.assert_hidden_on_load(OBSERVATION)

    def test_cause_appears_closed_when_lock_opens(self):
        """Kilit (3 başarısız Kontrol et) açılınca kutu kapalı olarak görev metninin altında."""
        self.load(FAULT)
        self.assert_hidden_on_load(FAULT)
        for _ in range(3):
            self.page.click("#agSimSharedCheck")
        cause = self.cause()
        cause.wait_for(state="attached")
        self.assertFalse(cause.evaluate("(d) => d.open"))
        self.assertEqual(cause.locator("summary").text_content(), "Kök nedeni göster")
        self.assertEqual(cause.evaluate("(d) => d.parentElement.id"), "sharedScenarioInstructions")
        self.assertIn(FAULT["cause"], cause.text_content())
        self.assertFalse(self.page.get_by_text(FAULT["cause"]).first.is_visible())

    def test_observation_cause_hidden_until_solved(self):
        self.load(OBSERVATION)
        self.assert_hidden_on_load(OBSERVATION)
        self.solve_and_ping(OBSERVATION)
        self.assert_revealed(OBSERVATION)


if __name__ == "__main__":
    unittest.main()
