"""L2-D1: ortak senaryoların motor seçimi ve Labber'da değerlendirilmesi.

* Motor kararı içerikten gelir (köprü raporu) ve docs/LAB_MOTOR_HARITASI.md ile aynıdır;
  ekranda rozet olarak görünür: "Motor: Labber" ya da "Eski motor — nedeni: …".
* Labber kararındaki senaryoların (sayı motor tablosundan türetilir) başarı ölçütü Labber'dan gelir: başlangıçta başarısız,
  tarif çözümünden sonra başarılı (Labber lab değişmezi).
* CLI ping'i senaryo durumunu Labber sonucu ile yazar; başarısız ve başarılı iletim ayrı
  ayrı denenir. L3-a'dan beri terminal de Labber'dadır: terminal ve hedef aynı kalıcı
  çalışma zamanını kullanır (iki motor karşılaştırması bu içerikte yoktur).
* Çalışma sırasında motor değişmez: topoloji Labber'ın ifade edemediği bir duruma gelirse
  değerlendirme hata olarak gösterilir.
"""

import json
import re
import unittest

from playwright.sync_api import sync_playwright

from aglab_test_support import HTML, ROOT, launch_chromium


def labber_ids(decisions):
    return {k for k, v in decisions.items() if v == "labber"}


def map_decisions():
    """Motor tablosundaki senaryo satırları: {id: 'labber' | 'legacy'}."""
    text = (ROOT / "docs/LAB_MOTOR_HARITASI.md").read_text(encoding="utf-8")
    section = text.split("## Ortak motor senaryoları")[1].split("\n## ")[0]
    rows = re.findall(r"^\| `([^`]+)` \| [^|]+ \| (.+) \|$", section, re.M)
    return {
        sid: "labber" if cell.strip().startswith("**Labber**") else "legacy" for sid, cell in rows
    }


class EngineChoiceTests(unittest.TestCase):
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

    def load(self, sid):
        self.page.evaluate("(id) => aglabSharedEngine.load(id)", sid)
        return self.page.evaluate("aglabSharedEngine.engine()")

    def badge(self):
        return self.page.text_content("#sharedScenarioEngine")

    def status(self):
        return self.page.text_content("#sharedScenarioStatus")

    def cli(self, device, *commands):
        self.page.evaluate(
            "([d, c]) => aglabSharedEngine.commandBlock(d, c)", [device, list(commands)]
        )

    def ping_fails(self, device, target):
        """Başarısız ping terminale hata satırı yazar; commandBlock bunu istisnaya çevirir."""
        error = self.page.evaluate(
            "([d, t]) => { try { aglabSharedEngine.commandBlock(d, ['ping ' + t]); return null }"
            " catch (e) { return e.message } }",
            [device, target],
        )
        self.assertIsNotNone(error, "ping başarısız olmalıydı")

    def test_decision_matches_engine_map_and_badge_is_shown(self):
        expected = map_decisions()
        # Senaryo sayısı sabit yazılmaz: tarif dosyasından türetilir.
        recipes = json.loads(
            (ROOT / "simulator/network-scenarios.json").read_text(encoding="utf-8")
        )
        self.assertEqual(set(expected), {r["id"] for r in recipes})
        # L2 VLAN/STP senaryoları ve ders senaryoları (Konu #3, #11) Labber'da olmalı.
        self.assertTrue(
            {"access-vlan", "stp-loop", "vlan-two-faults"} <= labber_ids(expected), expected
        )
        self.assertTrue(
            {r["id"] for r in recipes if r["verify"]["kind"] == "query"} <= labber_ids(expected)
        )
        for sid, engine in expected.items():
            decision = self.load(sid)
            self.assertEqual(decision["engine"], engine, sid)
            if engine == "labber":
                self.assertEqual(decision["reasons"], [], sid)
                self.assertTrue(self.badge().startswith("Motor: Labber"), sid)
            else:
                self.assertTrue(decision["reasons"], sid)
                self.assertEqual(
                    self.badge(), "Eski motor — nedeni: " + "; ".join(decision["reasons"]), sid
                )

    def test_labber_scenarios_fail_first_and_pass_after_solution_on_labber(self):
        results = self.page.evaluate("aglabSharedEngine.validateScenarios()")
        labber = [r for r in results if r["engine"] == "labber"]
        self.assertEqual({r["id"] for r in labber}, labber_ids(map_decisions()))
        for r in labber:
            self.assertEqual((r["initial"], r["solved"], r["ok"]), (False, True, True), r)
        self.assertTrue(all(r["ok"] for r in results), [r for r in results if not r["ok"]])

    def test_cli_ping_status_comes_from_labber(self):
        self.load("vlan-wrong-access")
        self.ping_fails("PC-01", "192.168.10.12")
        self.assertIn("Henüz çözülmedi", self.status())
        self.assertIn("Labber: Yanıt gelmedi", self.status())
        self.cli(
            "SW1",
            "enable",
            "configure terminal",
            "interface fa0/1",
            "switchport access vlan 10",
            "end",
        )
        self.cli("PC-01", "ping 192.168.10.12")
        self.assertIn("BAŞARILI", self.status())
        self.assertTrue(self.page.evaluate("aglabSharedEngine.goal()"))

    def test_unsupported_runtime_topology_is_an_error_not_a_fallback(self):
        self.load("access-vlan")
        self.assertFalse(self.page.evaluate("aglabSharedEngine.goal()"))
        self.page.click('[data-pt-add="Router"]')
        error = self.page.evaluate(
            "() => { try { aglabSharedEngine.goal(); return null } catch (e) { return e.message } }"
        )
        self.assertIn("Motor değiştirilmez", error)
        self.assertIn("Router", error)
        # karar değişmez, rozet Labber kalır
        self.assertEqual(self.page.evaluate("aglabSharedEngine.engine()")["engine"], "labber")
        target = self.page.evaluate("aglabSharedEngine.target()")
        self.ping_fails("PC-01", target)
        self.assertIn("Değerlendirme hatası", self.status())

    def test_labber_content_uses_one_runtime_for_cli_and_goal(self):
        """L3-a: Labber içeriğinde terminal ve hedef aynı kalıcı çalışma zamanındadır.

        L2'deki "iki motor uyuşmazlığı" denetimi (CLI eski motorda, hedef Labber'da) bu
        içerikte bilerek kaldırıldı: karşılaştırılacak ikinci motor yok. Yerine şu
        değişmez doğrulanır: içerik yüklendikten sonra komutlar ve hedef değerlendirmesi
        yeni çalışma zamanı kurmaz, hepsi aynı çalışma zamanını kullanır.
        """
        self.load("vlan-wrong-access")
        before = self.page.evaluate("aglabLabberSession.runtimeId()")
        self.page.evaluate("""() => {
              const orig = AgLabSim.createRuntime;
              window.__created = 0;
              window.AgLabSim = { ...AgLabSim, createRuntime: (r) => {
                window.__created++;
                return orig(r);
              } };
            }""")
        self.ping_fails("PC-01", "192.168.10.12")
        self.assertIn("Henüz çözülmedi", self.status())
        self.cli(
            "SW1",
            "enable",
            "configure terminal",
            "interface fa0/1",
            "switchport access vlan 10",
            "end",
        )
        self.assertTrue(self.page.evaluate("aglabSharedEngine.goal()"))
        self.cli("PC-01", "ping 192.168.10.12")
        self.assertIn("BAŞARILI", self.status())
        self.assertNotIn("Motor uyuşmazlığı", self.status())
        self.assertEqual(self.page.evaluate("window.__created"), 0)
        self.assertEqual(self.page.evaluate("aglabLabberSession.runtimeId()"), before)

    def test_legacy_scenario_keeps_old_engine(self):
        decision = self.load("return-route")
        self.assertEqual(decision["engine"], "legacy")
        self.assertIn("Router", self.badge())
        self.assertFalse(self.page.evaluate("aglabSharedEngine.goal()"))


if __name__ == "__main__":
    unittest.main()
