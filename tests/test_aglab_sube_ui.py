"""Şube 1.0 arayüz düzeltmeleri (personel gözüyle yapılan gezinmede bulunanlar).

- Labber labında inceleme panelinin port durumu çalışma zamanından gelir: kapalı port
  "disabled" görünür, `no shutdown` sonrası "connected" olur (önceden lab açılışındaki çizim
  modelinden okunuyordu ve kapalı port "up / up" görünüyordu).
- Router (LabDef `router: true`) tuvalde ve terminal listesinde router olarak görünür, etiketi
  adresidir; L3 switch routed port adresini, adresi olmayan PC "IP yok" gösterir (önceden hepsi
  "L2 switch"). Router portunda panel IP gösterir ve hızlı show komutları hata vermez.
- Lab açılınca terminal CLI'nin ilk adımlarını yazar (Seviye 1 dersleri IOS kiplerini anlatmıyor).
"""

import unittest

from playwright.sync_api import expect, sync_playwright

from aglab_test_support import HTML, launch_chromium


class SubeUiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = launch_chromium(cls.pw)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.ctx = self.browser.new_context(viewport={"width": 1366, "height": 900})
        self.page = self.ctx.new_page()
        self.errors = []
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))
        self.page.goto(HTML.as_uri())
        self.page.click('[data-area="lab"]')

    def tearDown(self):
        self.assertEqual(self.errors, [])
        self.ctx.close()

    def start(self, lab_id):
        p = self.page
        p.select_option("#labberLabSelect", lab_id)
        p.click("#labberLabStart")
        p.wait_for_function("(id) => aglabLabberLabs.active() === id", arg=lab_id)

    def type(self, dev, *lines):
        p = self.page
        p.select_option("#ptCliDevice", dev)
        for line in lines:
            p.fill("#ptCliInput", line)
            p.locator("#ptCliInput").press("Enter")

    def inspect(self, dev, port):
        p = self.page
        p.locator(f'#ptCanvas .pt-node[data-id="{dev}"]').click()
        p.select_option("#agSimPortSelect", port)
        return p.locator("#agSimPortProps")

    def labels(self):
        return self.page.evaluate(
            """() => Object.fromEntries([...document.querySelectorAll(
              '#ptCanvas .pt-node')].map(g => [g.dataset.id, g.querySelector('.pt-ip').textContent]))"""
        )

    def test_port_status_follows_runtime(self):
        self.start("fiziksel-kontrol")
        props = self.inspect("SW1", "fa0/2")
        expect(props).to_contain_text("disabled (administratively down)")
        expect(props.locator("dd.bad")).to_have_count(1)
        self.type("SW1", "enable", "configure terminal", "interface fa0/2", "no shutdown", "end")
        props = self.inspect("SW1", "fa0/2")
        expect(props).to_contain_text("connected (up / up)")
        # Karşı ucu kapalı uplink: bu uçta notconnect.
        expect(self.inspect("SW1", "gi0/1")).to_contain_text("notconnect")

    def test_router_type_label_and_quick_show(self):
        self.start("eigrp-ariza")
        labels = self.labels()
        self.assertEqual(labels["R2"], "172.16.12.2")
        self.assertEqual(labels["S1"], "172.16.12.1")  # L3 switch: routed port adresi
        options = self.page.eval_on_selector_all(
            "#ptCliDevice option", "os => os.map(o => o.textContent)"
        )
        self.assertIn("R2 · Router", options)
        self.start("dhcp-kurulum")
        labels = self.labels()
        self.assertEqual(labels["PC-11"], "IP yok")
        self.assertEqual(labels["SW1"], "L2 switch")
        self.assertEqual(labels["SRV"], "192.168.100.10")
        props = self.inspect("R1", "gi0/0")
        expect(props).to_contain_text("192.168.10.1 / 255.255.255.0")
        expect(props).not_to_contain_text("Access VLAN")
        quick = self.page.locator("#agSimQuick button")
        for i in range(quick.count()):
            quick.nth(i).click()
            expect(self.page.locator("#agSimShowOut")).not_to_contain_text("% Invalid")

    def test_lab_start_prints_cli_primer(self):
        self.start("dhcp-kurulum")
        term = self.page.locator("#ptTerminal")
        expect(term).to_contain_text("başlatıldı")
        expect(term).to_contain_text('enable → "R1#"')
        expect(term).not_to_contain_text("IOS/VPCS")
        expect(self.page.locator("#agSimEngine")).to_have_text("Simülatör")


if __name__ == "__main__":
    unittest.main()
