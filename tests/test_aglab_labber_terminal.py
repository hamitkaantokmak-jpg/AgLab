"""L3-a: Labber kararındaki içerikte terminal Labber'ın IOS/VPCS oturumudur.

* İçerik boyunca TEK kalıcı LabRuntime: terminalden yazılan çözüm aynı çalışma zamanında
  değerlendirilir (senaryo hedefi); komutlar yeni çalışma zamanı kurmaz.
* İstem, `?` yardımı, Tab tamamlama ve onay soruları IOS gibidir: `reload` kaydedilmemiş
  değişiklikte "Save? [yes/no]", ardından "[confirm]" sorar; "no" ile kaydedilmemiş ayar
  geri gider, `copy running-config startup-config` ile kaydedilen kalır.
* Güç düzenleyicisi (`device power off|on`) çalışma zamanına gider: açılış bir reload'dur.
* Düzenleyicinin topoloji değişikliği (kablo sökme) çalışma zamanını yeniden kurar;
  kaydedilmiş yapılandırma korunur, kablo sökülünce iletim başarısız olur.
* Eski motor kararındaki içerikte terminal eski motorda kalır.
* Başarılı ve başarısız iletim ayrı ayrı doğrulanır; durum metin yerine türetilmiş Labber
  durumundan (LabQuery / toAglab görünümü) sorgulanır.
"""

import unittest

from playwright.sync_api import sync_playwright

from aglab_test_support import HTML, launch_chromium


class LabberTerminalTests(unittest.TestCase):
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

    # --- yardımcılar -------------------------------------------------------------
    def load(self, sid):
        self.page.evaluate("(id) => aglabSharedEngine.load(id)", sid)

    def device(self, name):
        dev = self.page.evaluate(
            "(n) => [...document.querySelectorAll('#ptCliDevice option')]"
            ".find((o) => o.textContent.startsWith(n + ' ')).value",
            name,
        )
        self.page.select_option("#ptCliDevice", dev)
        return dev

    def type(self, line):
        """Terminale gerçek kullanıcı gibi yazar; bu satırın çıktısını döndürür."""
        before = self.page.locator("#ptTerminal > div").count()
        self.page.fill("#ptCliInput", line)
        self.page.locator("#ptCliInput").press("Enter")
        return self.page.locator("#ptTerminal > div").all_text_contents()[before:]

    def prompt(self):
        return self.page.text_content("#ptPrompt")

    def goal(self):
        return self.page.evaluate("aglabSharedEngine.goal()")

    # --- testler ----------------------------------------------------------------
    def test_ios_prompt_help_completion(self):
        self.load("vlan-wrong-access")
        self.assertTrue(self.page.evaluate("aglabLabberSession.active()"))
        self.device("SW1")
        self.assertEqual(self.prompt(), "SW1>")
        self.type("enable")
        self.assertEqual(self.prompt(), "SW1#")
        # Tab: tek eşleşen anahtar sözcük tamamlanır
        self.page.fill("#ptCliInput", "conf")
        self.page.locator("#ptCliInput").press("Tab")
        self.assertEqual(self.page.input_value("#ptCliInput"), "configure ")
        self.type("configure terminal")
        self.assertEqual(self.prompt(), "SW1(config)#")
        self.type("interface fa0/1")
        self.assertEqual(self.prompt(), "SW1(config-if)#")
        # `?`: bağlam yardımı, yazılan satır girişte kalır
        out = self.type("switchport access ?")
        self.assertTrue(any("vlan" in line for line in out), out)
        self.assertEqual(self.page.input_value("#ptCliInput"), "switchport access ")
        # geçersiz komut IOS işaretçisiyle hata verir
        out = self.type("switchport bogus")
        self.assertIn("% Invalid input detected at '^' marker.", out)
        self.type("end")
        self.assertEqual(self.prompt(), "SW1#")
        # PC: VPCS istemi cihaz adıyla
        self.device("PC-01")
        self.assertEqual(self.prompt(), "PC-01> ")

    def test_terminal_solution_is_graded_on_same_runtime(self):
        self.load("vlan-wrong-access")
        runtime = self.page.evaluate("aglabLabberSession.runtimeId()")
        self.device("PC-01")
        out = self.type("ping 192.168.10.12")
        self.assertTrue(any("timeout" in line for line in out), out)
        self.assertFalse(self.goal())
        self.assertIn("Henüz çözülmedi", self.page.text_content("#sharedScenarioStatus"))
        self.device("SW1")
        for line in ["enable", "configure terminal", "interface fa0/1"]:
            self.type(line)
        self.type("switchport access vlan 10")
        self.type("end")
        # değerlendirme terminalle aynı çalışma zamanında: anında görünür
        self.assertTrue(self.goal())
        self.device("PC-01")
        out = self.type("ping 192.168.10.12")
        self.assertTrue(any(line.startswith("84 bytes from 192.168.10.12") for line in out), out)
        self.assertIn("BAŞARILI", self.page.text_content("#sharedScenarioStatus"))
        self.assertEqual(self.page.evaluate("aglabLabberSession.runtimeId()"), runtime)
        # AğLab görünümü (çizim/kayıt) Labber durumundan türetildi
        self.assertEqual(
            self.page.evaluate(
                "aglabSharedEngine.view().devices.find((d) => d.name === 'SW1')"
                ".interfaces['fa0/1'].vlan"
            ),
            10,
        )

    def test_reload_dialog_reverts_unsaved_and_keeps_saved(self):
        self.load("vlan-wrong-access")
        self.device("SW1")
        for line in ["enable", "configure terminal", "interface fa0/1"]:
            self.type(line)
        self.type("switchport access vlan 10")
        self.type("end")
        self.assertTrue(self.goal())
        self.type("reload")
        self.assertEqual(self.prompt(), "System configuration has been modified. Save? [yes/no]: ")
        self.type("no")
        self.assertEqual(self.prompt(), "Proceed with reload? [confirm]")
        out = self.type("")  # Enter onaylar
        self.assertTrue(any("Press RETURN to get started" in line for line in out), out)
        self.assertEqual(self.prompt(), "SW1>")
        # kaydedilmeyen düzeltme gitti: başarısız iletim
        self.assertFalse(self.goal())
        # bu kez kaydet, sonra reload: düzeltme kalır
        for line in ["enable", "configure terminal", "interface fa0/1"]:
            self.type(line)
        self.type("switchport access vlan 10")
        self.type("end")
        out = self.type("copy running-config startup-config")
        self.assertEqual(self.prompt(), "Destination filename [startup-config]? ")
        out = self.type("")
        self.assertIn("[OK]", out)
        self.type("reload")
        self.assertEqual(self.prompt(), "Proceed with reload? [confirm]")
        self.type("")
        self.assertTrue(self.goal())

    def test_power_editor_is_a_reload(self):
        self.load("vlan-wrong-access")
        self.device("SW1")
        for line in ["enable", "configure terminal", "interface fa0/1"]:
            self.type(line)
        self.type("switchport access vlan 10")
        self.type("end")
        self.assertTrue(self.goal())
        self.type("device power off")
        self.assertFalse(self.goal())
        self.assertIn("konsol", self.prompt())
        self.type("device power on")
        # kaydedilmemiş düzeltme açılışta kaybolur (startup-config yüklenir)
        self.assertEqual(self.prompt(), "SW1>")
        self.assertFalse(self.goal())

    def test_editor_cable_change_rebuilds_runtime_and_keeps_saved_config(self):
        self.load("vlan-wrong-access")
        self.device("SW1")
        for line in ["enable", "configure terminal", "interface fa0/1"]:
            self.type(line)
        self.type("switchport access vlan 10")
        self.type("end")
        self.type("copy running-config startup-config")
        self.type("")
        self.assertTrue(self.goal())
        # düzenleyici: SW1 ↔ SW2 kablosunu sök → iletim başarısız
        ids = self.page.evaluate(
            "() => [...document.querySelectorAll('#ptSource option')]"
            ".map((o) => [o.textContent.split(' ')[0], o.value])"
        )
        ids = dict(ids)
        self.page.select_option("#ptSource", ids["SW1"])
        self.page.select_option("#ptTarget", ids["SW2"])
        self.page.click("#ptRemoveLink")
        self.assertFalse(self.goal())
        # yeniden bağla → kaydedilmiş yapılandırma yeni çalışma zamanında da geçerli
        self.page.click("#ptMakeLink")
        self.device("SW1")
        out = self.type("show startup-config | include access vlan 10")
        self.assertTrue(any("switchport access vlan 10" in line for line in out), out)

    def test_router_terminal_and_static_routes_on_labber(self):
        """L4: routing senaryosunda router terminali Labber IOS'udur; başarısız ve başarılı
        iletim, AD'li statik rota ve running-config türetilmiş durumdan doğrulanır."""
        self.load("floating-static")
        self.assertTrue(self.page.evaluate("aglabLabberSession.active()"))
        self.assertFalse(self.goal())
        self.device("R1")
        self.assertEqual(self.prompt(), "R1>")
        self.type("enable")
        # çözümlenemeyen AD 1 rotası tabloda yok; switch komutu routerda yok
        out = self.type("show ip route 10.20.0.10")
        self.assertIn("% Network not in table", out)
        self.type("configure terminal")
        out = self.type("vlan 10")
        self.assertTrue(any("Invalid input" in line for line in out), out)
        self.type("ip route 10.20.0.0 255.255.255.0 10.0.0.2 5")
        self.type("end")
        out = self.type("show ip route 10.20.0.10")
        self.assertIn('  Known via "static", distance 5, metric 0', out)
        out = self.type("show running-config | include ip route")
        self.assertIn("ip route 10.20.0.0 255.255.255.0 10.0.0.2 5", out)
        self.assertTrue(self.goal())
        view = self.page.evaluate("aglabSharedEngine.view()")
        r1 = next(d for d in view["devices"] if d["name"] == "R1")
        self.assertIn(
            {"network": "10.20.0.0", "mask": "255.255.255.0", "nextHop": "10.0.0.2", "distance": 5},
            r1["staticRoutes"],
        )
        # PC terminali VPCS: ping başarılı, sonra R2 dönüş rotası silinince başarısız
        self.device("PC-01")
        out = self.type("ping 10.20.0.10")
        self.assertTrue(any("bytes from 10.20.0.10" in line for line in out), out)
        self.device("R2")
        self.type("enable")
        self.type("configure terminal")
        self.type("no ip route 192.168.1.0 255.255.255.0 10.0.0.1")
        self.type("end")
        self.assertFalse(self.goal())

    def test_show_cdp_neighbors_from_terminal(self):
        """L5-f: terminalden `show cdp neighbors` IOS sütunlarıyla; PC'ler listelenmez, kablo
        çıkınca komşu anında düşer, `no cdp run` sonrası CDP kapalı mesajı."""
        self.load("vlan-uplink-not-trunk")
        self.assertTrue(self.page.evaluate("aglabLabberSession.active()"))
        self.device("SW1")
        self.type("enable")
        out = self.type("show cdp neighbors")
        self.assertIn(
            "Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID", out
        )
        rows = [line for line in out if line.startswith("SW2 ")]
        self.assertEqual(len(rows), 1, out)
        self.assertIn("Gig 0/24", rows[0])
        self.assertFalse(any(line.startswith("PC-") for line in out), out)
        self.assertIn("Total cdp entries displayed : 1", out)
        self.page.evaluate("aglabLabberSession.setLink('d3', 'gi0/24', false)")
        out = self.type("show cdp neighbors")
        self.assertFalse(any(line.startswith("SW2 ") for line in out), out)
        self.assertIn("Total cdp entries displayed : 0", out)
        self.type("configure terminal")
        self.type("no cdp run")
        self.type("end")
        self.assertIn("% CDP is not enabled", self.type("show cdp neighbors"))

    def test_ttl_traceroute_extended_ping(self):
        """L5-i: return-route çözülünce Labber terminalinde VPCS trace, ping -T (Time Exceeded ve
        Simulation Mode izi), IOS traceroute ve extended ping; dönüş rotası silinince başarısız."""
        self.load("return-route")
        self.page.evaluate(
            "() => { for (const b of aglabSharedEngine.recipes().find(r => r.id === 'return-route').solution)"
            " aglabSharedEngine.commandBlock(b.device, b.commands) }"
        )
        self.device("PC-01")
        out = self.type("trace 10.20.0.10")
        self.assertTrue(any("Destination port unreachable" in x for x in out), out)
        out = self.type("ping 10.20.0.10 -T 1 -c 1")
        self.assertTrue(any("TTL expired in transit" in x for x in out), out)
        raw = [e.get("raw") for e in self.page.evaluate("aglabLabberSession.trace()")["events"]]
        self.assertTrue(any(r and r.startswith("ttl-expired ") for r in raw), raw)
        self.assertTrue(
            any(r and r.startswith("icmp-time-exceeded PC-01") for r in raw)
            or any(r and "icmp-time-exceeded" in r for r in raw),
            raw,
        )
        self.device("R1")
        self.type("enable")
        out = self.type("traceroute 10.20.0.10")
        self.assertTrue(
            any(x.strip().startswith("2 10.20.0.10") or " 10.20.0.10 " in x for x in out), out
        )
        self.type("ping")
        for answer in ["", "10.20.0.10", "3", "", "", "n"]:
            out = self.type(answer)
        self.assertTrue(any("Sending 3, 100-byte ICMP Echos to 10.20.0.10" in x for x in out), out)
        self.assertTrue(any("Success rate is" in x and "/3)" in x for x in out), out)
        # dönüş rotası silinince traceroute yanıtsız atlamalarla biter
        self.device("R2")
        self.type("configure terminal")
        self.type("no ip route 192.168.1.0 255.255.255.0")
        self.type("end")
        # R1'in kendi sondası R2'ye bağlı ağdan çıkar; PC-01'inki artık dönemez
        self.device("PC-01")
        out = self.type("trace 10.20.0.10")
        self.assertTrue(any(x.strip().endswith("*  *  *") for x in out), out)
        self.assertFalse(any("Destination port unreachable" in x for x in out), out)

    def test_acl_from_terminal(self):
        """L5-c: terminalden standart ACL; yanlış yönde etkisiz, doğru yönde PC-01 trafiğini keser,
        sayaçlar `show access-lists`'te, uygulanan liste `show ip interface`'te."""
        self.load("return-route")
        self.page.evaluate(
            "() => { for (const b of aglabSharedEngine.recipes().find(r => r.id === 'return-route').solution)"
            " aglabSharedEngine.commandBlock(b.device, b.commands) }"
        )
        self.assertTrue(self.goal())
        self.device("R2")
        for line in [
            "enable",
            "configure terminal",
            "access-list 10 deny host 192.168.1.10",
            "access-list 10 permit any",
            "interface g0/1",
            "ip access-group 10 in",
            "end",
        ]:
            self.type(line)
        # g0/1 sunucu tarafı: PC-01'in istekleri oradan girmez → süzülmez (yanlış yön)
        self.assertTrue(self.goal())
        self.type("configure terminal")
        self.type("interface g0/1")
        self.type("no ip access-group 10 in")
        self.type("ip access-group 10 out")
        self.type("end")
        self.device("PC-01")
        out = self.type("ping 10.20.0.10")
        self.assertFalse(any("bytes from" in line for line in out), out)
        self.assertFalse(self.goal())
        self.device("R2")
        out = self.type("show access-lists")
        self.assertIn("Standard IP access list 10", out)
        self.assertIn("    10 deny   192.168.1.10 (5 matches)", out)
        out = self.type("show ip interface g0/1")
        self.assertIn("  Outgoing access list is 10", out)

    def test_nat_pat_from_terminal(self):
        """L5-d: nat-pat senaryosu Labber'da. NAT'sız ping dönmez; PAT eklenince başarılı, çeviri
        `show ip nat translations`'ta; inside/outside ters çevrilince yeniden başarısız."""
        self.load("nat-pat")
        self.assertTrue(self.page.evaluate("aglabLabberSession.active()"))
        self.device("PC-01")
        out = self.type("ping 203.0.113.8")
        self.assertFalse(any("bytes from" in line for line in out), out)
        self.assertFalse(self.goal())
        self.device("R1")
        for line in [
            "enable",
            "configure terminal",
            "ip nat inside source list 1 interface g0/1 overload",
            "end",
        ]:
            self.type(line)
        self.device("PC-01")
        out = self.type("ping 203.0.113.8")
        self.assertTrue(any("bytes from 203.0.113.8" in line for line in out), out)
        self.assertTrue(self.goal())
        self.device("R1")
        out = self.type("show ip nat translations")
        rows = [" ".join(line.split()) for line in out if line.startswith("icmp")]
        self.assertEqual(
            rows, ["icmp 203.0.113.1:1 192.168.1.10:1 203.0.113.8:1 203.0.113.8:1"], out
        )
        out = self.type("show ip nat statistics")
        self.assertIn("Total active translations: 1 (0 static, 1 dynamic; 1 extended)", out)
        self.type("clear ip nat translation *")
        for line in [
            "configure terminal",
            "interface g0/0",
            "ip nat outside",
            "interface g0/1",
            "ip nat inside",
            "end",
        ]:
            self.type(line)
        self.assertFalse(self.goal())
        self.assertFalse(
            any(line.startswith("icmp") for line in self.type("show ip nat translations"))
        )

    def test_http_from_terminal(self):
        """L5-g: nat-pat'ta WEB-PUBLIC'in HTTP servisi. NAT'sız curl zaman aşımı; PAT ile sayfa gelir
        ve tcp çevirisi yazılır; servis kapatılınca bağlantı reddedilir; ACL web'i engelleyince
        No route to host."""
        self.load("nat-pat")
        self.device("PC-01")
        out = self.type("curl 203.0.113.8")
        self.assertTrue(any("Connection timed out" in line for line in out), out)
        self.device("R1")
        for line in [
            "enable",
            "configure terminal",
            "ip nat inside source list 1 interface g0/1 overload",
            "end",
        ]:
            self.type(line)
        self.device("PC-01")
        out = self.type("curl http://203.0.113.8/")
        self.assertTrue(any("<title>WEB-PUBLIC</title>" in line for line in out), out)
        self.device("R1")
        rows = [
            " ".join(line.split())
            for line in self.type("show ip nat translations")
            if line.startswith("tcp")
        ]
        self.assertEqual(
            rows, ["tcp 203.0.113.1:49153 192.168.1.10:49153 203.0.113.8:80 203.0.113.8:80"]
        )
        self.device("WEB-PUBLIC")
        self.assertIn("HTTP service is off", self.type("service http off"))
        self.device("PC-01")
        out = self.type("curl 203.0.113.8")
        self.assertTrue(any("Connection refused" in line for line in out), out)
        self.device("WEB-PUBLIC")
        self.type("service http on")
        self.device("R1")
        for line in [
            "configure terminal",
            "access-list 101 deny tcp any any eq www",
            "access-list 101 permit ip any any",
            "interface g0/0",
            "ip access-group 101 in",
            "end",
        ]:
            self.type(line)
        self.device("PC-01")
        out = self.type("curl 203.0.113.8")
        self.assertTrue(any("No route to host" in line for line in out), out)
        out = self.type("ping 203.0.113.8")
        self.assertTrue(any("bytes from 203.0.113.8" in line for line in out), out)

    def test_legacy_content_keeps_legacy_terminal(self):
        # L5-d'den beri NAT/PAT da Labber'da; eski motorda yalnız BGP senaryosu kaldı.
        self.load("bgp-as")
        self.assertFalse(self.page.evaluate("aglabLabberSession.active()"))
        self.device("R1")
        self.type("enable")
        self.assertEqual(self.prompt(), "R1#")
        # eski motorun AğLab komutu Labber'da yoktur, burada çalışır
        out = self.type("show ip route")
        self.assertFalse(any("Invalid input" in line for line in out), out)


if __name__ == "__main__":
    unittest.main()
