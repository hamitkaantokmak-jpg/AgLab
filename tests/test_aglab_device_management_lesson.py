"""Cihaz yönetimi ve yedekleme dersi (Konu #11): veri bütünlüğü ve Öğren ekranında görünme.

Arıza senaryoları uygulamanın terminali Labber'a bağlanana kadar (L3-a) Labber testi
olarak tests/sim/device-management.test.ts içinde doğrulanır.
"""

import json
import unittest
from playwright.sync_api import sync_playwright

from aglab_test_support import ROOT, launch_chromium

COURSES = json.loads((ROOT / "src/data/courses.json").read_text(encoding="utf-8"))
DETAILS = json.loads((ROOT / "src/data/course-details.json").read_text(encoding="utf-8"))


class DeviceManagementLessonDataTests(unittest.TestCase):
    def test_course_and_detail_are_well_formed(self):
        ids = [c["id"] for c in COURSES]
        self.assertEqual(ids.index("devicemgmt"), ids.index("commands") + 1)
        self.assertEqual(len(ids), len(set(ids)))
        course = COURSES[ids.index("devicemgmt")]
        self.assertEqual(len(course["quiz"]), 10)
        for question, options, answer, explanation in course["quiz"]:
            self.assertEqual(len(options), 4, question)
            self.assertTrue(0 <= answer < 4 and explanation, question)
        detail = next(d for d in DETAILS if d["id"] == "devicemgmt")
        for item in detail["quiz"]:
            self.assertTrue(0 <= item["answer"] < len(item["options"]), item["q"])
        self.assertTrue(0 <= detail["case"]["answer"] < len(detail["case"]["choices"]))

    def test_labber_scenarios_exist(self):
        text = (ROOT / "tests/sim/device-management.test.ts").read_text(encoding="utf-8")
        for name in ("S1:", "S2:", "S3:", "S4:", "S5:"):
            self.assertIn(name, text)


class DeviceManagementLessonUiTests(unittest.TestCase):
    def test_lesson_opens_and_detail_renders(self):
        with sync_playwright() as pw:
            browser = launch_chromium(pw)
            page = browser.new_page(viewport={"width": 1280, "height": 960})
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
            page.locator("#sfList button", has_text="Cihaz yönetimi ve yedekleme").evaluate(
                "b => b.click()"
            )
            sheet = page.locator("#sfSheet")
            self.assertIn("running ve startup", sheet.text_content())
            sheet.locator("button", has_text="Ayrıntılı öğren").evaluate("b => b.click()")
            page.wait_for_function(
                "document.getElementById('sfSheet').textContent.includes('dün çalışıyordu')"
            )
            self.assertIn("Save? [yes/no]: no", sheet.text_content())
            browser.close()
            self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()
