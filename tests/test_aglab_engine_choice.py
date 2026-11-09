"""L2-D1: ortak senaryoların motor seçimi ve Labber'da değerlendirilmesi.

* Motor kararı içerikten gelir (köprü raporu) ve docs/LAB_MOTOR_HARITASI.md ile aynıdır;
  ekranda rozet olarak görünür: "Motor: Labber" ya da "Eski motor — nedeni: …".
* Labber kararındaki 9 senaryonun başarı ölçütü Labber'dan gelir: başlangıçta başarısız,
  tarif çözümünden sonra başarılı (Labber lab değişmezi).
* CLI ping'i (eski motor) senaryo durumunu Labber sonucu ile yazar; başarısız ve başarılı
  iletim ayrı ayrı denenir.
* Çalışma sırasında motor değişmez: topoloji Labber'ın ifade edemediği bir duruma gelirse
  değerlendirme hata olarak gösterilir; iki motor farklı sonuç verirse uyuşmazlık
  gösterilir ve sonuç kabul edilmez.
"""

import re
import unittest

from playwright.sync_api import sync_playwright

from aglab_test_support import HTML, ROOT, launch_chromium

LABBER_SCENARIOS = {
    "access-vlan",
    "trunk-allowed",
    "native-vlan",
    "stp-loop",
    "vlan-wrong-access",
    "vlan-uplink-not-trunk",
    "vlan-allowed-overwritten",
    "vlan-missing-on-switch",
    "vlan-two-faults",
}


def map_decisions():
    """Motor tablosundaki senaryo satırları: {id: 'labber' | 'legacy'}."""
    text = (ROOT / "docs/LAB_MOTOR_HARITASI.md").read_text(encoding="utf-8")
    section = text.split("## Ortak motor senaryoları")[1].split("\n## ")[0]
    rows = re.findall(r"^\| `([^`]+)` \| [^|]+ \| (.+) \|$", section, re.M)
    return {sid: "labber" if cell.strip() == "**Labber**" else "legacy" for sid, cell in rows}


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
        self.assertEqual(len(expected), 22)
        self.assertEqual({k for k, v in expected.items() if v == "labber"}, LABBER_SCENARIOS)
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
        self.assertEqual({r["id"] for r in labber}, LABBER_SCENARIOS)
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

    def test_engine_disagreement_is_shown_and_not_accepted(self):
        self.load("vlan-wrong-access")
        # Labber sonucunu ters çeviren saptırma: iki motor uyuşmazsa sonuç kabul edilmez.
        self.page.evaluate("""() => {
              // Paket dışa aktarımları salt okunur; global nesnenin kopyası takılır.
              const orig = AgLabSim.createRuntime;
              window.AgLabSim = { ...AgLabSim, createRuntime: (r) => {
                const rt = orig(r);
                const query = rt.query.bind(rt);
                rt.query = () => {
                  const q = query();
                  const ping = q.ping.bind(q);
                  q.ping = (a, b) => { const p = ping(a, b); return { ...p, ok: !p.ok }; };
                  return q;
                };
                return rt;
              } };
            }""")
        self.ping_fails("PC-01", "192.168.10.12")
        self.assertIn("Motor uyuşmazlığı", self.status())
        self.assertNotIn("BAŞARILI", self.status())

    def test_legacy_scenario_keeps_old_engine(self):
        decision = self.load("return-route")
        self.assertEqual(decision["engine"], "legacy")
        self.assertIn("Router", self.badge())
        self.assertFalse(self.page.evaluate("aglabSharedEngine.goal()"))


if __name__ == "__main__":
    unittest.main()
