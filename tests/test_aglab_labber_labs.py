"""E: Labber'ın kendi labları (src/labs) arayüzde ayrı içerik grubu.

* Grup listelenir; lab sayısı ve kimlikleri `src/labs/index.ts` kataloğundan türetilir
  (sabit yazılmaz). Akademi lab listesine karışmaz.
* Her lab: başlatılınca rozet "Motor: Labber"; başlangıçta en az bir hedef çözülmemiş;
  referans çözüm TERMINALDEN (form + Enter, ayrıcalıklı moddan) yazılınca bütün hedefler
  çözülmüş görünür ve IOS hatası çıkmaz. Hedefler rt.objectives() ile değerlendirilir.
* Lab tanımı sabittir: düzenleyiciyle topoloji değişirse değerlendirme açık hata verir.
* Sayfa yenilenince açık lab baştan başlar (çözülmemiş).
"""

import json
import re
import unittest

from playwright.sync_api import sync_playwright

from aglab_test_support import HTML, ROOT, launch_chromium


def catalog_ids():
    """src/labs/index.ts: LABS dizisindeki sıra → her içe aktarmanın dosyasındaki id."""
    index = (ROOT / "src/labs/index.ts").read_text(encoding="utf-8")
    imports = dict(re.findall(r"^import (\w+) from '\./([\w-]+)'", index, re.M))
    order = re.search(r"LABS: LabDef\[\] = \[([^\]]*)\]", index).group(1).replace(" ", "")
    ids = []
    for name in order.split(","):
        text = (ROOT / "src/labs" / (imports[name] + ".ts")).read_text(encoding="utf-8")
        ids.append(re.search(r"^  id: '([^']+)'", text, re.M).group(1))
    return ids


class LabberLabsTests(unittest.TestCase):
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

    def start(self, lab_id):
        self.page.select_option("#labberLabSelect", lab_id)
        self.page.click("#labberLabStart")

    def objectives(self):
        return self.page.evaluate("aglabLabberLabs.objectives()")

    def type(self, line):
        before = self.page.locator("#ptTerminal > div").count()
        self.page.fill("#ptCliInput", line)
        self.page.locator("#ptCliInput").press("Enter")
        rows = self.page.locator("#ptTerminal > div")
        return [
            (rows.nth(i).text_content(), rows.nth(i).get_attribute("class") or "")
            for i in range(before, rows.count())
        ]

    def type_solution(self, lab_id):
        for dev, script in self.page.evaluate(
            "(id) => aglabLabberLabs.solution(id)", lab_id
        ).items():
            self.page.select_option("#ptCliDevice", dev)
            # Referans çözüm ayrıcalıklı moddan girilir (labs.test.ts runScript gibi).
            for line in ["enable", *script.split("\n")]:
                errors = [t for t, k in self.type(line) if "outerr" in k]
                self.assertEqual(errors, [], (lab_id, dev, line))

    def test_group_is_listed_separately(self):
        ids = catalog_ids()
        self.assertTrue(ids)
        options = self.page.eval_on_selector_all(
            "#labberLabSelect option", "(os) => os.map((o) => o.value)"
        )
        self.assertEqual(options, ids)
        self.assertIn(str(len(ids)), self.page.text_content("#labberLabsTitle"))
        academy = set(
            self.page.eval_on_selector_all(
                "#academySelect option", "(os) => os.map((o) => o.value)"
            )
        )
        self.assertFalse(academy & set(ids), "Labber labları Akademi listesine karışmamalı")
        self.assertEqual(
            sorted(academy),
            sorted(p.stem for p in (ROOT / "academy/student").glob("AGL-*.json")),
        )

    def test_each_lab_unsolved_at_start_and_solved_from_terminal(self):
        for lab_id in catalog_ids():
            with self.subTest(lab_id):
                self.start(lab_id)
                self.assertEqual(self.page.evaluate("aglabLabberLabs.active()"), lab_id)
                self.assertTrue(
                    self.page.text_content("#labberLabEngine").startswith("Motor: Labber")
                )
                start = self.objectives()
                self.assertTrue(start)
                self.assertTrue(any(not o["ok"] for o in start), "başlangıçta çözülmemiş")
                self.assertIn("Henüz çözülmedi", self.page.text_content("#labberLabStatus"))
                self.type_solution(lab_id)
                done = self.objectives()
                self.assertEqual([o["id"] for o in done if not o["ok"]], [])
                self.assertIn("Lab tamamlandı", self.page.text_content("#labberLabStatus"))
                shown = self.page.eval_on_selector_all(
                    "#labberLabObjectives li", "(ls) => ls.map((l) => l.dataset.ok)"
                )
                self.assertEqual(shown, ["true"] * len(done))

    def test_lab_definition_is_fixed_and_resumes_on_reload(self):
        # L7 kalıcılık v24: sayfa yenilenince lab baştan başlamaz; Labber durumu (kaydedilmemiş
        # running dahil) kayıttan geri gelir. Lab tanımı yine sabittir.
        lab_id = catalog_ids()[0]
        self.start(lab_id)
        self.page.select_option("#ptCliDevice", "SW1")
        self.type("enable")
        self.type("configure terminal")
        self.type("hostname KALICI-LAB")
        self.type("end")
        self.assertEqual(
            json.loads(self.page.evaluate("localStorage.getItem('aglab-topology-v24')"))[
                "labberLab"
            ],
            {"id": lab_id},
        )
        self.page.reload()
        self.page.click('[data-area="lab"]')
        self.assertEqual(self.page.evaluate("aglabLabberLabs.active()"), lab_id)
        self.assertEqual(self.page.evaluate("aglabLabberSession.prompt('SW1')"), "KALICI-LAB>")
        self.assertTrue(any(not o["ok"] for o in self.objectives()))
        # düzenleyici topolojiyi değiştirirse sessizce yeni topolojiye geçilmez
        self.page.click('[data-pt-add="PC"]')
        self.page.click("#labberLabCheck")
        self.assertIn("düzenleyiciyle değiştirilemez", self.page.text_content("#labberLabStatus"))


if __name__ == "__main__":
    unittest.main()
