"""Arayüz düzeltmeleri 1: konu listesi, liste açıkken yerleşim, üst arama ve ilk açılış.

- İlk açılışta müfredatın ilk konusu (Konu #1) açılır ve bu açılış "çalışılan konu" sayılmaz;
  sonraki açılışta en son çalışılan konu açılır.
- Konu listesindeki her kart içeriği kadar uzundur (alt satır kartın dışına taşmaz).
- Liste açıkken ders, listenin yanında durur (altına sıkışmaz).
- Üstteki arama kutusu konu listesini açar; Enter ilk sonucu açar.
- Arama kutusu ve seviye seçimi etiketleriyle çakışmaz.
"""

import unittest

from playwright.sync_api import expect, sync_playwright

from aglab_test_support import HTML, launch_chromium


class UiFixesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = launch_chromium(cls.pw)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.ctx = self.browser.new_context(viewport={"width": 1440, "height": 900})
        self.page = self.ctx.new_page()
        self.errors = []
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))
        self.page.goto(HTML.as_uri())

    def tearDown(self):
        self.assertEqual(self.errors, [])
        self.ctx.close()

    def first_course_title(self):
        return self.page.evaluate(
            "JSON.parse(document.getElementById('sfCourseData').textContent)[0].title"
        )

    def test_first_visit_opens_topic_one_without_counting_it(self):
        p = self.page
        expect(p.locator("#sfSheet h3").first).to_have_text(self.first_course_title())
        expect(p.locator("#sfSheet")).to_contain_text("KONU #1")
        expect(p.locator("#sfVisited")).to_have_text(
            "0/" + str(p.evaluate("aglabStudentFlow.count"))
        )

    def test_reopens_last_studied_topic(self):
        p = self.page
        p.click("#ux13ToggleTopics")
        p.locator("#sfList button", has_text="DHCP").first.click()
        p.reload()
        expect(p.locator("#sfSheet h3").first).to_have_text("DHCP")

    def test_list_cards_contain_their_text_and_sit_beside_sheet(self):
        p = self.page
        p.click("#ux13ToggleTopics")
        expect(p.locator("#sfList")).to_be_visible()
        overflow = p.evaluate(
            """() => [...document.querySelectorAll('#sfList button')].filter(b => {
                 const r = b.getBoundingClientRect(), s = b.querySelector('small').getBoundingClientRect();
                 return s.bottom > r.bottom + 0.5; }).length"""
        )
        self.assertEqual(overflow, 0)
        lst = p.locator("#sfList").bounding_box()
        sheet = p.locator("#sfSheet").bounding_box()
        self.assertGreater(sheet["x"], lst["x"] + lst["width"])
        self.assertLess(abs(sheet["y"] - lst["y"]), 40)

    def test_search_label_does_not_overlap_input(self):
        p = self.page
        p.click("#ux13ToggleTopics")
        label_right = p.evaluate("""() => { const l = document.querySelector('label[for=sfSearch]');
                 const r = document.createRange(); r.selectNodeContents(l.firstChild);
                 return r.getBoundingClientRect().right; }""")
        self.assertLessEqual(label_right, p.locator("#sfSearch").bounding_box()["x"])

    def test_top_search_opens_list_and_enter_opens_first(self):
        p = self.page
        expect(p.locator("#sfList")).to_be_hidden()
        p.fill("#agSearch", "ospf")
        expect(p.locator("#sfList")).to_be_visible()
        expect(p.locator("#sfList button").first).to_contain_text("OSPF")
        first = p.locator("#sfList button b").first.inner_text()
        p.press("#agSearch", "Enter")
        expect(p.locator("#sfSheet h3").first).to_have_text(first)
        expect(p.locator("#sfList")).to_be_hidden()


if __name__ == "__main__":
    unittest.main()
