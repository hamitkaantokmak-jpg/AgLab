"""L5-b: DHCP/DNS Labber'da; `relay-trunk` senaryosu Labber kararında.

* Senaryo Labber'da açılır; terminal Labber'ın VPCS/IOS oturumudur.
* Başarısız durumlar: trunk VLAN 10'u taşımıyor (L2 yolu yok), relay yok
  (`no ip helper-address`), helper-address yanlış. Hiçbirinde kira oluşmaz ve PC link-local
  (169.254/16) adresinde kalır.
* Başarılı durum: trunk düzeltilince PC kira alır; adres, maske ve ağ geçidi AğLab görünümüne
  (toAglab) yazılır ve senaryo hedefi sağlanır.
* Parite: aynı topoloji eski motorda (içe aktarılan topoloji eski motordadır) aynı
  çözümle aynı adresi, maskeyi ve ağ geçidini verir; başlangıçta iki motor da kira vermez.
* Router'da `ip dhcp pool` ve sunucuda DNS servisi terminalden kurulur; durum kayıtta
  (tarayıcı kaydı) korunur.
Durum metin yerine türetilmiş Labber durumundan (LabQuery / toAglab görünümü) sorgulanır.
"""

import unittest

from playwright.sync_api import sync_playwright

from aglab_test_support import HTML, launch_chromium

FIX = ["enable", "configure terminal", "interface gi0/1", "switchport trunk allowed vlan 10,20"]


class DhcpDnsTests(unittest.TestCase):
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
        self.page.evaluate("aglabSharedEngine.load('relay-trunk')")

    def tearDown(self):
        self.page.close()
        self.assertEqual(self.errors, [])

    # --- yardımcılar -------------------------------------------------------------
    def device(self, name):
        dev = self.page.evaluate(
            "(n) => [...document.querySelectorAll('#ptCliDevice option')]"
            ".find((o) => o.textContent.startsWith(n + ' ')).value",
            name,
        )
        self.page.select_option("#ptCliDevice", dev)
        return dev

    def type(self, line):
        before = self.page.locator("#ptTerminal > div").count()
        self.page.fill("#ptCliInput", line)
        self.page.locator("#ptCliInput").press("Enter")
        return self.page.locator("#ptTerminal > div").all_text_contents()[before:]

    def run_on(self, name, lines):
        self.device(name)
        out = []
        for line in lines:
            out += self.type(line)
        return out

    def view(self, name):
        return self.page.evaluate(
            "(n) => aglabSharedEngine.view().devices.find((d) => d.name === n)", name
        )

    def goal(self):
        return self.page.evaluate("aglabSharedEngine.goal()")

    def lease(self):
        return self.page.evaluate(
            "() => { const q = aglabLabberSession.query();"
            " const id = aglabSharedEngine.view().devices.find((d) => d.name === 'PC-01').id;"
            " return q.dhcpLease(id); }"
        )

    # --- testler ----------------------------------------------------------------
    def test_scenario_runs_on_labber_fail_then_lease(self):
        self.assertTrue(self.page.evaluate("aglabSharedEngine.engine().expressible"))
        self.assertTrue(self.page.evaluate("aglabLabberSession.active()"))
        start = self.view("PC-01")
        # başarısız: trunk VLAN 10'u taşımıyor
        out = self.run_on("PC-01", ["ip dhcp"])
        self.assertTrue(any("Can't find dhcp server" in line for line in out), out)
        self.assertEqual(self.view("PC-01"), start)
        self.assertIsNone(self.lease())
        self.assertFalse(self.goal())
        # başarılı: trunk düzeltilir
        self.run_on("SW-01", FIX)
        out = self.run_on("PC-01", ["ip dhcp"])
        self.assertTrue(
            any("DDORA IP 192.168.1.100/24 GW 192.168.1.1" in line for line in out), out
        )
        pc = self.view("PC-01")
        self.assertEqual(
            [pc["ip"], pc["mask"], pc["gateway"], pc["dhcpLease"]],
            ["192.168.1.100", "255.255.255.0", "192.168.1.1", True],
        )
        lease = self.lease()
        self.assertEqual([lease["ip"], lease["serverIp"]], ["192.168.1.100", "10.10.20.2"])
        self.assertTrue(self.goal())
        # kiralanan adresle sunucuya erişim; sunucuda kira görünür
        self.assertTrue(self.page.evaluate("aglabSharedEngine.probe().ok"))
        out = self.run_on("DHCP-SRV", ["show ip dhcp binding"])
        self.assertTrue(any(line.startswith("192.168.1.100") for line in out), out)

    def test_no_relay_and_wrong_helper_fail(self):
        self.run_on("SW-01", FIX)
        # relay yok
        self.run_on(
            "R1", ["enable", "configure terminal", "interface g0/0", "no ip helper-address"]
        )
        self.assertNotIn("helperAddress", self.view("R1")["interfaces"]["g0/0"])
        out = self.run_on("PC-01", ["ip dhcp"])
        self.assertTrue(any("Can't find dhcp server" in line for line in out), out)
        self.assertFalse(self.goal())
        # helper-address yanlış (sunucu 10.10.20.2)
        self.run_on("R1", ["ip helper-address 10.10.20.99"])
        self.assertEqual(self.view("R1")["interfaces"]["g0/0"]["helperAddress"], "10.10.20.99")
        self.run_on("PC-01", ["ip dhcp"])
        self.assertTrue(self.view("PC-01")["ip"].startswith("169.254."))
        self.assertFalse(self.view("PC-01")["dhcpLease"])
        self.assertFalse(self.goal())
        # doğru adres
        self.run_on("R1", ["no ip helper-address 10.10.20.99", "ip helper-address 10.10.20.2"])
        self.run_on("PC-01", ["ip dhcp"])
        self.assertTrue(self.goal())

    # L7b: test_legacy_engine_gives_the_same_lease (eski motorla kira paritesi) eski motorla
    # birlikte silindi; Labber'daki başarısız/başarılı kira yukarıdaki testlerdedir.

    def test_router_pool_dns_and_persistence(self):
        self.run_on("SW-01", FIX)
        # R1 kendi havuzundan adres verir (aynı yayın alanındaki sunucu relay'den önce yanıtlar)
        self.run_on(
            "R1",
            [
                "enable",
                "configure terminal",
                "ip dhcp excluded-address 192.168.1.1 192.168.1.9",
                "ip dhcp pool LAN",
                "network 192.168.1.0 255.255.255.0",
                "default-router 192.168.1.1",
                "dns-server 10.10.20.2",
                "end",
            ],
        )
        out = self.run_on("PC-01", ["ip dhcp"])
        self.assertTrue(any("DDORA IP 192.168.1.10/24 GW 192.168.1.1" in line for line in out), out)
        r1 = self.view("R1")
        self.assertEqual(
            r1["dhcpPools"],
            [
                {
                    "name": "LAN",
                    "network": "192.168.1.0",
                    "mask": "255.255.255.0",
                    "defaultRouter": "192.168.1.1",
                    "dnsServer": "10.10.20.2",
                }
            ],
        )
        self.assertEqual(r1["dhcpExcluded"], [{"start": "192.168.1.1", "end": "192.168.1.9"}])
        self.assertEqual(self.view("PC-01")["dns"], "10.10.20.2")
        out = self.run_on("R1", ["show ip dhcp binding"])
        self.assertTrue(any(line.startswith("192.168.1.10 ") for line in out), out)
        # DNS: servis kapalıyken zaman aşımı, açılınca ad çözülür, bilinmeyen ad bulunamaz
        out = self.run_on("PC-01", ["nslookup DHCP-SRV"])
        self.assertTrue(any("DNS request timed out." in line for line in out), out)
        self.run_on("DHCP-SRV", ["service dns on"])
        self.assertEqual(
            self.view("DHCP-SRV")["services"], {"dhcp": True, "dns": True, "http": False}
        )
        out = self.run_on("PC-01", ["nslookup DHCP-SRV"])
        self.assertTrue(any("10.10.20.2" in line and "Address" in line for line in out), out)
        out = self.run_on("PC-01", ["nslookup yok.example"])
        self.assertTrue(any("Non-existent domain" in line for line in out), out)
        # kayıt: sayfa yenilenince topoloji (havuz, kira, DNS) kayıttan geri gelir
        saved = self.page.evaluate("academyEngine.snapshot()")
        self.page.reload()
        self.page.click('[data-area="lab"]')
        restored = self.page.evaluate("academyEngine.snapshot()")
        find = lambda t, n: next(d for d in t["devices"] if d["name"] == n)
        for name in ("PC-01", "R1", "DHCP-SRV"):
            self.assertEqual(find(restored, name), find(saved, name), name)
        self.assertTrue(
            self.page.evaluate("(t) => AgLabSim.toLabber(t).report.expressible", restored)
        )


if __name__ == "__main__":
    unittest.main()
