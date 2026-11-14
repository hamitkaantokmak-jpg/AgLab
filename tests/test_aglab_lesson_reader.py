"""Ders okuyucu: docs/dersler/*.md derste şemalarıyla gösterilir (src/app/lesson-reader.js).

- Şemalar tanımlarından güncel üretilmiş (tools/build_figures.py --check).
- `doc` alanı olan her ders "Ayrıntılı öğren"de açılır; başvurulan her şema görünür, eksik yok.
- Zenginleştirilmiş derslerde (0. Bir bakışta) arıza senaryosunun nedeni/çözümü ve sınav cevapları
  kapalı kutudadır (öğrenciye önceden verilmez); her derste en az 6 şema.
- Metin kaçışlanır: Markdown'daki HTML etiketi sayfaya öğe olarak girmez.
"""

import json
import re
import subprocess
import sys
import unittest

from playwright.sync_api import sync_playwright

from aglab_test_support import ROOT, launch_chromium

COURSES = json.loads((ROOT / "src/data/courses.json").read_text(encoding="utf-8"))
DOCS = [c for c in COURSES if c.get("doc")]
FIG = re.compile(r"!\[[^\]]*\]\((gorseller/[\w./-]+\.svg)\)")


def enriched(doc):
    return "## 0. Bir bakışta" in (ROOT / "docs/dersler" / (doc + ".md")).read_text(
        encoding="utf-8"
    )


def num_key(c):
    return int(re.match(r"\d+", c["num"]).group())


class LessonDocTests(unittest.TestCase):
    def test_course_order_follows_curriculum_numbers(self):
        numbered = [c for c in COURSES if c.get("num")]
        self.assertEqual(len(numbered), len(COURSES), "her dersin konu numarası var")
        levels = ["beginner", "intermediate", "advanced"]
        keys = [(levels.index(c["level"]), num_key(c)) for c in COURSES]
        self.assertEqual(keys, sorted(keys))

    def test_figures_up_to_date(self):
        r = subprocess.run(
            [sys.executable, str(ROOT / "tools/build_figures.py"), "--check"],
            capture_output=True,
            text=True,
        )
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_docs_exist_and_reference_existing_figures(self):
        self.assertGreater(len(DOCS), 0)
        for c in DOCS:
            with self.subTest(c["id"]):
                text = (ROOT / "docs/dersler" / (c["doc"] + ".md")).read_text(encoding="utf-8")
                for rel in FIG.findall(text):
                    self.assertTrue((ROOT / "docs/dersler" / rel).exists(), rel)
                if enriched(c["doc"]):
                    self.assertGreaterEqual(len(FIG.findall(text)), 6, "en az 6 şema")
                    for part in (
                        "## 0. Bir bakışta",
                        "## 8. Özet kartı",
                        "## 9. Doğrulama notları",
                    ):
                        self.assertIn(part, text)
                    # Senaryo nedenleri ve sınav cevapları açılır kutuda.
                    sec6 = text.split("## 6.")[1].split("## 7.")[0]
                    sec7 = text.split("## 7.")[1].split("## 8.")[0]
                    if "### S1" in sec6:
                        self.assertNotIn("**Neden:**", sec6)
                        self.assertGreaterEqual(sec6.count("<details>"), sec6.count("### S"))
                    self.assertGreaterEqual(sec7.count("<details>"), 5)


class LessonReaderUiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = launch_chromium(cls.pw)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def test_each_doc_renders_with_figures(self):
        page = self.browser.new_page(viewport={"width": 1280, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
        for c in DOCS:
            with self.subTest(c["id"]):
                text = (ROOT / "docs/dersler" / (c["doc"] + ".md")).read_text(encoding="utf-8")
                page.locator("#sfList button", has_text=c["title"]).first.evaluate("b => b.click()")
                page.locator("#sfSheet button", has_text="Ayrıntılı öğren").first.evaluate(
                    "b => b.click()"
                )
                r = page.evaluate("""() => ({
                      figs: document.querySelectorAll('#sfSheet .lr-fig svg').length,
                      missing: document.querySelectorAll('#sfSheet .lr-missing').length,
                      toc: document.querySelectorAll('#sfSheet .lr-toc a').length,
                      openDetails: document.querySelectorAll('#sfSheet details[open]').length,
                    })""")
                self.assertEqual(r["figs"], len(FIG.findall(text)))
                self.assertEqual(r["missing"], 0)
                self.assertGreaterEqual(r["toc"], 7)
                self.assertEqual(r["openDetails"], 0)
        page.close()
        self.assertEqual(errors, [])

    def test_markdown_is_escaped(self):
        page = self.browser.new_page()
        page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
        html = page.evaluate(
            "aglabLessonReader._render('Metin <img src=x onerror=alert(1)> ve `<b>`\\n\\n| a |\\n| --- |\\n| <i>x</i> |', {})"
        )
        self.assertNotIn("<img", html)
        self.assertNotIn("<i>", html)
        self.assertIn("&lt;img", html)
        page.close()


if __name__ == "__main__":
    unittest.main()
