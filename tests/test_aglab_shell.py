"""Arayüz yenilemesi PR 1: ortak iskelet, adlandırma ve eski bağlantı uyumluluğu.

Üst gezinme dört ana bölümdür (Müfredat, Simülatör, Sorun Çöz, Canlı Lab); sol ikon şeridi
aynı bölümlere ve Gelişmiş'e götürür. Bölüm kimlikleri (`data-area`, `#area-*`) değişmez; adres
çubuğu yeni adları gösterir ve eski bağlantılar (#lab, #gercek-lab, #area-troubleshoot …) yeni
bölüme yönlenir. "Lab" (Labber) adı Simülatör, "Gerçek Lab" adı Canlı Lab oldu.
"""

import unittest

from playwright.sync_api import expect, sync_playwright

from aglab_test_support import HTML, launch_chromium


class ShellTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = launch_chromium(cls.pw)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def open(self, hash_=""):
        page = self.browser.new_page(viewport={"width": 1280, "height": 900})
        self.errors = []
        page.on("pageerror", lambda e: self.errors.append(str(e)))
        page.goto(HTML.as_uri() + hash_)
        return page

    def active(self, page):
        return page.evaluate("document.querySelector('.workspace.active').id")

    def test_four_sections_rail_and_names(self):
        page = self.open()
        tabs = page.locator("#areaTabs [data-area]")
        self.assertEqual(
            tabs.all_text_contents(), ["Müfredat", "Simülatör", "Sorun Çöz", "Canlı Lab"]
        )
        self.assertEqual(page.title(), "AğLab")
        for area, hash_ in [
            ("lab", "#simulator"),
            ("troubleshoot", "#sorun-coz"),
            ("live", "#canli-lab"),
            ("learn", "#mufredat"),
        ]:
            page.click(f'#areaTabs [data-area="{area}"]')
            self.assertEqual(self.active(page), "area-" + area)
            self.assertEqual(page.evaluate("location.hash"), hash_)
            expect(page.locator(f'#areaTabs [data-area="{area}"]')).to_have_attribute(
                "aria-pressed", "true"
            )
            expect(page.locator(f'#agRail [data-rail="{area}"]')).to_have_attribute(
                "aria-current", "page"
            )
        # ikon şeridi: Gelişmiş (regresyon denetimi öğrencinin yolundan çıktı)
        page.click('#agRail [data-rail="advanced"]')
        self.assertEqual(self.active(page), "area-advanced")
        expect(page.locator("#runRegressionAudit")).to_be_visible()
        page.click('#agRail [data-rail="lesson"]')
        self.assertEqual(self.active(page), "area-learn")
        expect(page.locator('#agRail [data-rail="lesson"]')).to_have_attribute(
            "aria-current", "page"
        )
        # Canlı Lab: rapor ve operatör dışa aktarımı kendi bölümünde, eski "Gerçek Lab" adı yok
        page.click('#areaTabs [data-area="live"]')
        expect(page.locator("#nativeLabReport")).to_be_attached()
        expect(page.locator("#realLabExportTopology")).to_be_visible()
        body = page.evaluate(
            "(() => { const c = document.body.cloneNode(true);"
            " c.querySelectorAll('script,style').forEach((e) => e.remove());"
            " return c.textContent })()"
        )
        self.assertNotIn("Gerçek Lab", body)
        # tema düğmesi üst barda
        self.assertEqual(
            page.evaluate("document.getElementById('themeToggle').parentElement.id"),
            "agTopTools",
        )
        self.assertEqual(self.errors, [])
        page.close()

    def test_old_links_redirect_to_new_sections(self):
        for hash_, area in [
            ("#lab", "lab"),
            ("#area-lab", "lab"),
            ("#gercek-lab", "live"),
            ("#real-lab", "live"),
            ("#area-troubleshoot", "troubleshoot"),
            ("#ogren", "learn"),
            ("#gelismis", "advanced"),
        ]:
            with self.subTest(hash_):
                page = self.open(hash_)
                self.assertEqual(self.active(page), "area-" + area)
                page.close()
        page = self.open()
        page.evaluate("location.hash = '#gercek-lab'")
        page.wait_for_function("document.querySelector('.workspace.active').id === 'area-live'")
        self.assertEqual(page.evaluate("location.hash"), "#canli-lab")
        self.assertEqual(self.errors, [])
        page.close()

    def test_search_filters_curriculum(self):
        page = self.open("#simulator")
        page.fill("#agSearch", "VLAN")
        self.assertEqual(self.active(page), "area-learn")
        self.assertEqual(page.input_value("#sfSearch"), "VLAN")
        self.assertEqual(self.errors, [])
        page.close()


if __name__ == "__main__":
    unittest.main()
