"""PR F: ders arıza senaryoları (Konu #11 cihaz yönetimi, Konu #3 Ethernet/ARP) Sorun Çöz'de.

Senaryolar `simulator/network-scenarios.json`'dan türetilir (sayı sabit yazılmaz): Labber
`query` hedefi olan her tarif. Her senaryo için:

* motor kararı Labber; başlangıçta hedef başarısız;
* tarifteki çözüm TERMINALDEN yazılınca (form, Enter) hedef başarılı ve hedef ping'i
  terminalden atılınca durum "BAŞARILI" olur;
* `survivesReload` hedefinde kaydedilmeyen çözüm geçmez: çözüm kaydetme satırı olmadan
  yazılınca hedef başarısız kalır ve durum nedenini (kaydedilmemiş) söyler;
* kaydedilmemiş başlangıç (`pending`): running-config ile startup-config farklıdır;
  reload'da "Save?" sorusuna "yes" demek hatayı kalıcı yapar (tuzak, başarısız).

Hedefler LabQuery ile yazılır (macPort, macVlan, ipUnique, ping().replier, saved); başarılı
ve başarısız iletim ayrı ayrı denenir.
"""

import json
import unittest

from playwright.sync_api import sync_playwright

from aglab_test_support import HTML, ROOT, launch_chromium

RECIPES = [
    r
    for r in json.loads((ROOT / "simulator/network-scenarios.json").read_text(encoding="utf-8"))
    if r["verify"]["kind"] == "query"
]
SAVE = "copy running-config startup-config"


def without_save(commands):
    """Çözümden kaydetme satırını ve onun hedef dosya sorusunun cevabını çıkarır."""
    out, skip = [], False
    for c in commands:
        if skip:
            skip = False
            continue
        if c in (SAVE, "write memory"):
            skip = c == SAVE
            continue
        out.append(c)
    return out


class LessonScenarioTests(unittest.TestCase):
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

    def load(self, sid):
        self.page.evaluate("(id) => aglabSharedEngine.load(id)", sid)
        return self.page.evaluate("aglabSharedEngine.engine()")

    def goal(self):
        return self.page.evaluate("aglabSharedEngine.goal()")

    def status(self):
        return self.page.text_content("#sharedScenarioStatus")

    def device(self, name):
        dev = self.page.evaluate(
            "(n) => [...document.querySelectorAll('#ptCliDevice option')]"
            ".find((o) => o.textContent.startsWith(n + ' ')).value",
            name,
        )
        self.page.select_option("#ptCliDevice", dev)

    def type(self, line):
        before = self.page.locator("#ptTerminal > div").count()
        self.page.fill("#ptCliInput", line)
        self.page.locator("#ptCliInput").press("Enter")
        rows = self.page.locator("#ptTerminal > div")
        return [
            (rows.nth(i).text_content(), rows.nth(i).get_attribute("class") or "")
            for i in range(before, rows.count())
        ]

    def type_block(self, device, commands):
        self.device(device)
        for c in commands:
            errors = [t for t, k in self.type(c) if "outerr" in k]
            self.assertEqual(errors, [], (device, c))

    def ping_target(self, recipe):
        self.device(recipe["verify"]["source"])
        return self.type("ping " + recipe["verify"]["target"])

    def test_recipes_exist_and_are_on_labber(self):
        ids = {r["id"] for r in RECIPES}
        self.assertTrue({r for r in ids if r.startswith("mgmt-")}, ids)
        self.assertTrue({r for r in ids if r.startswith("eth-")}, ids)
        for r in RECIPES:
            self.assertEqual(self.load(r["id"])["engine"], "labber", r["id"])

    def test_terminal_solution_passes_after_failing_start(self):
        for r in RECIPES:
            with self.subTest(r["id"]):
                self.load(r["id"])
                self.assertFalse(self.goal(), "başlangıçta hedef başarısız olmalı")
                for block in r["solution"]:
                    self.type_block(block["device"], block["commands"])
                self.assertTrue(self.goal(), "terminalden yazılan çözüm hedefi sağlamalı")
                self.ping_target(r)
                self.assertIn("BAŞARILI", self.status())

    def test_unsaved_solution_does_not_pass(self):
        rows = [
            r
            for r in RECIPES
            if r["verify"].get("survivesReload")
            and any(SAVE in b["commands"] for b in r["solution"])
        ]
        self.assertTrue(rows)
        for r in rows:
            with self.subTest(r["id"]):
                self.load(r["id"])
                for block in r["solution"]:
                    self.type_block(block["device"], without_save(block["commands"]))
                self.assertFalse(self.goal(), "kaydedilmeyen çözüm geçmemeli")
                self.ping_target(r)
                status = self.status()
                self.assertIn("kaydedilmemiş", status)
                self.assertNotIn("BAŞARILI", status)

    def test_pending_change_and_reload_yes_trap(self):
        rows = [r for r in RECIPES if r.get("pending")]
        self.assertTrue(rows)
        for r in rows:
            with self.subTest(r["id"]):
                self.load(r["id"])
                device = r["pending"][0]["device"]
                self.device(device)
                self.type("enable")
                running = "\n".join(t for t, _ in self.type("show running-config"))
                startup = "\n".join(t for t, _ in self.type("show startup-config"))
                self.assertNotEqual(running, startup, "başlangıç değişikliği kaydedilmemiş olmalı")
                # Tuzak: reload sorusuna "yes" hatayı kalıcı yapar
                self.type("reload")
                self.type("yes")
                self.type("")
                self.assertFalse(self.goal())
        # Doğru cevap "no": her iki satır da ayrı ayrı denendi (test_terminal_solution...).

    def test_query_targets_use_derived_state(self):
        # macPort/macVlan hedefleri trafikle öğrenilen MAC'e bakar; çözümden önce sağlanmaz.
        rows = [
            r
            for r in RECIPES
            if any(c["fn"] in ("macPort", "macVlan") for c in r["verify"]["checks"])
        ]
        self.assertTrue(rows)
        for r in rows:
            with self.subTest(r["id"]):
                self.load(r["id"])
                out = self.ping_target(r)
                self.assertTrue(any("outerr" in k for _, k in out), "başarısız iletim")
                self.assertIn("Henüz çözülmedi", self.status())


if __name__ == "__main__":
    unittest.main()
