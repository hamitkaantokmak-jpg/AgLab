"""Eğitici katman (src/app/coach.js): tur, bağlamsal ipuçları, terminal kip satırı, komut açıklaması.

- Otomasyon altında (navigator.webdriver) katman kapalıdır: balon, 💡 düğmesi ve kip satırı
  yoktur; mevcut testler etkilenmez. Bu dosya katmanı `aglab-coach-force` ile açar.
- İlk açılışta 4 adımlı tur; bitince ya da atlanınca bir daha çıkmaz. 💡 menüsü turu yeniden
  başlatır, ipuçlarını kapatır ya da gösterilenleri sıfırlar.
- Simülatörde ilk görev: çalışma alanı turu. Kip satırı istemi izler. Komut ilk kez yazılınca
  açıklama çıkar (bir kez); ipucu komut açıklamasının yerine geçer.
"""

import json
import unittest

from playwright.sync_api import expect, sync_playwright

from aglab_test_support import HTML, launch_chromium

FORCE = "localStorage.setItem('aglab-coach-force', '1')"


class CoachTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = launch_chromium(cls.pw)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def open(self, force=True):
        self.ctx = self.browser.new_context(viewport={"width": 1366, "height": 768})
        if force:
            self.ctx.add_init_script(FORCE)
        self.page = self.ctx.new_page()
        self.errors = []
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))
        self.page.goto(HTML.as_uri())
        return self.page

    def tearDown(self):
        self.assertEqual(self.errors, [])
        self.ctx.close()

    def current(self):
        return self.page.evaluate("aglabCoach.current()")

    def wait_current(self, value):
        self.page.wait_for_function("(v) => aglabCoach.current() === v", arg=value)

    def press(self, text):
        self.page.locator("#agCoach .ag-coach-btn", has_text=text).click()

    def type(self, dev, line):
        p = self.page
        p.select_option("#ptCliDevice", dev)
        p.fill("#ptCliInput", line)
        p.locator("#ptCliInput").press("Enter")

    def reload(self):
        # Sözleşme: uygulama durumu localStorage'a yazar, açılışta oradan okur. Chromium file://
        # kökeninde localStorage'ı tarayıcı sürecine gecikmeli işler; yük altında yenilenen
        # belge son yazmayı (hatta hiçbir kaydı) görmeyebiliyor (CI'da ve yerel hatta görüldü).
        # Bu yüzden yenilemeden önce yazılan kayıt okunur ve yeni belgeye uygulama
        # başlamadan tek seferlik verilir (window.name yenilemede korunur).
        want = self.page.evaluate("localStorage.getItem('aglab-coach-v1')")
        self.assertIsNotNone(want, "coach durumu localStorage'a yazılmadı")
        self._reloads = getattr(self, "_reloads", 0) + 1
        token = "aglab-coach-reload-%d" % self._reloads
        self.ctx.add_init_script(
            "if (window.name === %s) { window.name = '';"
            " localStorage.setItem('aglab-coach-v1', %s); }" % (json.dumps(token), json.dumps(want))
        )
        self.page.evaluate("(t) => { window.name = t }", token)
        self.page.reload()
        self.assertEqual(self.page.evaluate("localStorage.getItem('aglab-coach-v1')"), want)

    def finish_tour(self):
        self.wait_current("tour:0")
        for i in range(3):
            self.press("Sonraki")
            self.wait_current("tour:%d" % (i + 1))
        self.press("Bitir")
        self.wait_current(None)

    def start_lab(self, lab_id):
        p = self.page
        p.click('[data-area="lab"]')
        p.select_option("#labberLabSelect", lab_id)
        p.click("#labberLabStart")
        p.wait_for_function("(id) => aglabLabberLabs.active() === id", arg=lab_id)

    def test_off_under_automation_by_default(self):
        p = self.open(force=False)
        p.wait_for_timeout(1000)
        self.assertFalse(p.evaluate("aglabCoach.available()"))
        expect(p.locator("#agCoach")).to_be_hidden()
        expect(p.locator("#agCoachMenuBtn")).to_have_count(0)
        self.start_lab("dhcp-kurulum")
        p.wait_for_timeout(700)
        self.type("R1", "enable")
        expect(p.locator("#agCoach")).to_be_hidden()
        expect(p.locator("#agCoachMode")).to_be_hidden()

    def test_first_open_tour_once(self):
        p = self.open()
        self.finish_tour()
        self.assertEqual(p.evaluate("aglabCoach.seen().tour"), "done")
        self.reload()
        p.wait_for_timeout(1200)
        self.assertIsNone(self.current())
        # Atla da turu bitirir; menüden yeniden başlar.
        p.click("#agCoachMenuBtn")
        p.click("#agCoachTour")
        self.wait_current("tour:0")
        self.press("Turu atla")
        self.wait_current(None)
        self.assertEqual(p.evaluate("aglabCoach.seen().tour"), "done")

    def test_menu_turns_off_and_resets(self):
        p = self.open()
        self.finish_tour()
        p.click("#agCoachMenuBtn")
        expect(p.locator("#agCoachToggle")).to_have_text("Eğitici ipuçlarını kapat")
        p.click("#agCoachToggle")
        self.assertFalse(p.evaluate("aglabCoach.enabled()"))
        self.start_lab("dhcp-kurulum")
        p.wait_for_timeout(900)
        self.type("R1", "enable")
        self.assertIsNone(self.current())
        expect(p.locator("#agCoachMode")).to_be_hidden()
        self.reload()
        self.assertFalse(p.evaluate("aglabCoach.enabled()"), "kapatma kalıcı")
        p.click("#agCoachMenuBtn")
        expect(p.locator("#agCoachToggle")).to_have_text("Eğitici ipuçlarını aç")
        p.click("#agCoachReset")
        self.assertTrue(p.evaluate("aglabCoach.enabled()"))
        self.assertEqual(p.evaluate("aglabCoach.seen()"), {})

    def test_simulator_tour_mode_line_and_command_help(self):
        p = self.open()
        self.finish_tour()
        self.start_lab("dhcp-kurulum")
        self.wait_current("tour:sim:0")
        self.press("Turu atla")
        self.wait_current(None)
        self.type("R1", "")
        expect(p.locator("#agCoachMode")).to_contain_text("Kullanıcı kipi")
        expect(p.locator("#agCoachMode")).to_contain_text("enable → ayrıcalıklı kip")
        self.type("R1", "enable")
        self.wait_current("cmd:ios:enable")
        expect(p.locator("#agCoachBody")).to_contain_text("Ayrıcalıklı kipe geçer")
        expect(p.locator("#agCoachMode")).to_contain_text("Ayrıcalıklı kip")
        self.type("R1", "conf t")
        self.wait_current("cmd:ios:configure terminal")  # komut açıklaması öncekinin yerine
        expect(p.locator("#agCoachMode")).to_contain_text("Genel ayar kipi")
        self.press("Anladım")
        self.type("R1", "interface g0/1")
        expect(p.locator("#agCoachMode")).to_contain_text("Arayüz kipi")
        self.press("Anladım")
        self.type("R1", "end")
        self.press("Anladım")
        self.type("R1", "disable")
        self.press("Anladım")
        self.type("R1", "enable")  # ikinci kez: açıklama yok
        p.wait_for_timeout(300)
        self.assertIsNone(self.current())
        # Hata ipucu komut açıklamasının yerine geçer.
        self.type("R1", "show vlan brief")  # router'da yok
        self.wait_current("tip:invalid")
        expect(p.locator("#agCoach")).to_contain_text("Komut tanınmadı")
        p.keyboard.press("Escape")
        self.wait_current(None)

    def test_pc_command_and_apipa_tip(self):
        p = self.open()
        self.finish_tour()
        self.start_lab("dhcp-kurulum")
        self.wait_current("tour:sim:0")
        self.press("Turu atla")
        self.type("PC-11", "show ip")
        expect(p.locator("#agCoachMode")).to_contain_text("PC terminali")
        self.wait_current("cmd:pc:show ip")
        self.type("PC-11", "ip dhcp")
        self.wait_current("tip:apipa")
        expect(p.locator("#agCoach")).to_contain_text("DHCP sunucusu bulamadı")

    def test_check_tip_after_first_check(self):
        p = self.open()
        self.finish_tour()
        self.start_lab("dhcp-kurulum")
        self.wait_current("tour:sim:0")
        self.press("Turu atla")
        p.click("#labberLabCheck")
        self.wait_current("tip:check")
        self.press("Anladım")
        p.click("#labberLabCheck")
        p.wait_for_timeout(500)
        self.assertIsNone(self.current())

    def test_abbreviations(self):
        p = self.open()
        cases = {
            ("sh ip int br", "Router"): "show ip interface brief",
            ("conf t", "Switch"): "configure terminal",
            ("no shut", "Switch"): "no shutdown",
            ("do sh vlan br", "Switch"): "show vlan brief",
            ("int range fa0/1 - 4", "Switch"): "interface range",
            ("copy run start", "Router"): "copy running-config startup-config",
            ("ip 192.168.1.10/24 192.168.1.1", "PC"): "ip",
            ("ip dhcp", "PC"): "ip dhcp",
            ("show ?", "Router"): None,
            ("frobnicate", "Router"): None,
        }
        for (line, kind), key in cases.items():
            with self.subTest(line):
                self.assertEqual(
                    p.evaluate("([l, k]) => aglabCoach.explain(l, k)", [line, kind]), key
                )


if __name__ == "__main__":
    unittest.main()
