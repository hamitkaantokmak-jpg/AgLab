"""Arayüz PR 3: Sorun Çöz, Gelişmiş ve telefon görünümü.

- Sorun Çöz: açıklama metni temanın soluk metin rengini kullanır (açık temada okunur);
  hazır senaryo bağlantısı ne yaptığını söyler; her senaryo satırı bağlı olduğu dersi gösterir.
- Gelişmiş: denetim kutusu açık temada koyu zemin almaz; dosya seçici Türkçe ve çalışır.
- Telefon: kısayol çubuğu ayrı satır kaplamaz, tema düğmesi simgeye iner; ders başlığı
  ekranın üst yarısında görünür.
"""

import json
import unittest

from playwright.sync_api import expect, sync_playwright

from aglab_test_support import HTML, ROOT, launch_chromium

COURSES = {c["id"]: c for c in json.loads((ROOT / "src/data/courses.json").read_text("utf-8"))}


def luminance(rgb):
    vals = [int(v) for v in rgb[rgb.index("(") + 1 : rgb.index(")")].split(",")[:3]]
    out = []
    for v in vals:
        c = v / 255
        out.append(c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2]


def contrast(a, b):
    la, lb = sorted([luminance(a), luminance(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


class UiFixes3Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = launch_chromium(cls.pw)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def open(self, width=1440, height=900):
        self.ctx = self.browser.new_context(
            viewport={"width": width, "height": height}, color_scheme="light"
        )
        self.page = self.ctx.new_page()
        self.errors = []
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))
        self.page.goto(HTML.as_uri())
        return self.page

    def tearDown(self):
        self.assertEqual(self.errors, [])
        self.ctx.close()

    def bg_of(self, sel):
        return self.page.evaluate(
            """(sel) => { let e = document.querySelector(sel);
                 for (; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor;
                   if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; }
                 return 'rgb(255, 255, 255)'; }""",
            sel,
        )

    def test_troubleshoot_text_link_and_lessons(self):
        p = self.open()
        p.click('[data-area="troubleshoot"]')
        desc = p.locator("#mission p").first
        color = desc.evaluate("e => getComputedStyle(e).color")
        self.assertGreaterEqual(contrast(color, self.bg_of("#mission")), 4.5)
        n = p.evaluate("document.getElementById('sharedScenarioSelect').options.length")
        expect(p.locator("#sharedScenarioTroubleLink")).to_have_text(
            "Simülatördeki %d hazır arıza senaryosu →" % n
        )
        rows = p.locator("#scenarioList .scenario")
        tags = p.locator("#scenarioList .scenario .scenario-lesson")
        expect(tags).to_have_count(rows.count())
        for i in range(tags.count()):
            cid = tags.nth(i).get_attribute("data-course")
            self.assertIn(cid, COURSES)
            expect(tags.nth(i)).to_have_text(
                "Ders: Konu #%s · %s" % (COURSES[cid]["num"], COURSES[cid]["title"])
            )
        bgp = p.locator("#scenarioList .scenario", has_text="BGP").locator(".scenario-lesson")
        expect(bgp).to_have_attribute("data-course", "bgp")

    def test_advanced_panel_and_turkish_file_picker(self):
        p = self.open()
        p.click('#agRail [data-rail="advanced"]')
        bg = p.locator("#regressionAuditPanel").evaluate("e => getComputedStyle(e).backgroundColor")
        self.assertGreater(luminance(bg), 0.6, bg)
        live = p.locator("#advancedLive")
        expect(live.locator(".ag-file-pick")).to_have_text("Dosya seç")
        expect(live.locator(".ag-file-name")).to_have_text("Dosya seçilmedi")
        self.assertNotIn("Choose File", live.inner_text())
        with p.expect_file_chooser() as fc:
            live.locator(".ag-file-pick").click()
        self.assertFalse(fc.value.is_multiple())
        report = ROOT / "tests" / "_tmp_rapor.json"
        report.write_text("{}", encoding="utf-8")
        try:
            fc.value.set_files(str(report))
        finally:
            report.unlink()
        expect(live.locator(".ag-file-name")).to_have_text("_tmp_rapor.json")
        # Öğrenme yolundaki yedek yükleme: etiket düğmedir, ham dosya girdisi görünmez.
        box = p.locator("#sfImport").bounding_box()
        self.assertTrue(box is None or box["width"] <= 1)

    def test_phone_lesson_title_visible_early(self):
        p = self.open(390, 844)
        title = p.locator("#sfSheet h3").first
        self.assertLess(title.bounding_box()["y"], 844 / 2)
        top = p.locator("#agTop").bounding_box()
        for sel in ['#agRail [data-rail="advanced"]', '#agRail [data-rail="lesson"]']:
            b = p.locator(sel).bounding_box()
            self.assertLess(b["y"] + b["height"], top["y"] + top["height"] + 1, sel)
        expect(p.locator('#agRail [data-rail="lab"]')).to_be_hidden()
        expect(p.locator("#themeToggle .tt-label")).to_be_hidden()
        expect(p.locator("#themeToggle")).to_have_attribute("aria-label", "Koyu temaya geç")
        # Gelişmiş telefonda da açılır.
        p.click('#agRail [data-rail="advanced"]')
        expect(p.locator("#area-advanced")).to_be_visible()


if __name__ == "__main__":
    unittest.main()
