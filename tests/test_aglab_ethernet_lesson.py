"""Ethernet, MAC ve ARP dersi (Konu #3): veri bütünlüğü ve Öğren ekranında görünme.

* Ders, kurs listesinde fiziksel bağlantının hemen ardından gelir ve ayrıntılı ders kaydına bağlıdır.
* Kısa sınavın her sorusunda dört seçenek ve geçerli bir doğru cevap vardır.
* İlerleme sayacı konu sayısını sabit 33 yerine gerçek kurs sayısından hesaplar.
* Ders seçilince başlık, öğrenme hedefleri ve çıktı örneği ekranda görünür.
"""

import json
import unittest
from playwright.sync_api import sync_playwright

from aglab_test_support import ROOT, launch_chromium

COURSES = json.loads((ROOT / "src/data/courses.json").read_text(encoding="utf-8"))
DETAILS = json.loads((ROOT / "src/data/course-details.json").read_text(encoding="utf-8"))


class EthernetLessonDataTests(unittest.TestCase):
    def test_course_follows_physical_and_has_detail(self):
        ids = [c["id"] for c in COURSES]
        self.assertIn("ethernet", ids)
        self.assertEqual(ids.index("ethernet"), ids.index("physical") + 1)
        self.assertEqual(len(ids), len(set(ids)))
        self.assertIn("ethernet", {d["id"] for d in DETAILS})

    def test_quiz_items_are_well_formed(self):
        course = next(c for c in COURSES if c["id"] == "ethernet")
        self.assertEqual(len(course["quiz"]), 10)
        for question, options, answer, explanation in course["quiz"]:
            self.assertEqual(len(options), 4, question)
            self.assertTrue(0 <= answer < len(options), question)
            self.assertTrue(explanation)
        detail = next(d for d in DETAILS if d["id"] == "ethernet")
        for item in detail["quiz"]:
            self.assertTrue(0 <= item["answer"] < len(item["options"]), item["q"])
        self.assertTrue(0 <= detail["case"]["answer"] < len(detail["case"]["choices"]))


class EthernetLessonUiTests(unittest.TestCase):
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

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def test_counter_uses_real_course_count(self):
        visited = self.page.text_content("#sfVisited")
        self.assertTrue(visited.endswith("/" + str(len(COURSES))), visited)

    def test_lesson_renders_from_list(self):
        # Odak modunda (ux13-focused) liste gizli olabilir; düğmenin kendi işleyicisini çağır.
        self.page.locator("#sfList button", has_text="Ethernet, MAC ve ARP").evaluate("b => b.click()")
        sheet = self.page.locator("#sfSheet")
        self.assertIn("Switch MAC öğrenir", sheet.text_content())
        sheet.locator("button", has_text="Ayrıntılı öğren").evaluate("b => b.click()")
        self.page.wait_for_function(
            "document.getElementById('sfSheet').textContent.includes('aynı ağdayım ama ulaşamıyorum')"
        )
        text = sheet.text_content()
        self.assertIn("show mac address-table", text)
        self.assertIn("Incomplete", text)


if __name__ == "__main__":
    unittest.main()
