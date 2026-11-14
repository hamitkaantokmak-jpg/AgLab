"""Arayüz yenilemesi PR 2: Simülatör çalışma alanı ve "Çözümü göster" kilidi.

* Yerleşim (docs/arayuz/dolu-3.png): üst çubuk (başlık, motor rozeti, Sıfırla / İpucu /
  Kontrol et), görev | tuval | inceleme sütunları, altta terminal + Simulation Mode; görev
  seçimi çalışma alanının altında. 1280 px'te üç sütun yan yana ve ekrana sığar.
* İnceleme paneli: Port / Cihaz / Olaylar sekmeleri; hızlı show çıktısı Labber oturumunun
  kopyasından gelir: terminal, istem ve çalışma zamanı durumu değişmez.
* Terminal sekmeleri `#ptCliDevice` ile aynı cihazı seçer.
* Canlı hedefler: komutla düzeltilen ölçüt "Kontrol et"e basmadan işaretlenir; canlı
  değerlendirme puan/ilerleme kaydetmez.
* Çözüm kilidi (kullanıcı kararı, verify_packages yasağının yerine):
  1. kilit açılana kadar çözüm DOM'da oluşturulmaz (gizli öğe olarak da yok);
  2. kilit 3 başarısız "Kontrol et"ten ya da bütün ipuçları kullanıldıktan sonra açılır;
  3. gömülü çözümler tek paketteki öğretmen JSON'larıyla aynıdır (100/100 testleri ayrıca sürer).
* Simulation Mode zaman çizelgesi olay listesiyle aynı sırada; nokta seçince olay seçilir.
"""

import json
import re
import unittest

from playwright.sync_api import expect, sync_playwright

from aglab_test_support import HTML, ROOT, launch_chromium

TEXT_OUTSIDE_SCRIPTS = """(needle) => {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const tag = n.parentElement && n.parentElement.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE') continue;
    if (n.textContent.includes(needle)) return true;
  }
  return false;
}"""


class SimWorkspaceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = launch_chromium(cls.pw)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.page = self.browser.new_page(viewport={"width": 1280, "height": 900})
        self.errors = []
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))
        self.page.goto(HTML.as_uri())
        self.page.evaluate("localStorage.clear()")
        self.page.reload()
        self.page.click('[data-area="lab"]')

    def tearDown(self):
        self.page.close()
        self.assertEqual(self.errors, [])

    # ------------------------------------------------------------ yardımcılar
    def academy(self, lab):
        self.page.click("#ux14Guided")
        self.page.select_option("#academySelect", lab)
        self.page.click("#academyStart")
        if self.page.locator("#academyReplaceContinue").is_visible():
            self.page.click("#academyReplaceContinue")
        expect(self.page.locator("#agSimTitle")).to_contain_text(lab)

    def cli(self, device, *commands):
        self.page.select_option("#ptCliDevice", device)
        for c in commands:
            self.page.fill("#ptCliInput", c)
            self.page.press("#ptCliInput", "Enter")

    def visible_text(self, needle):
        return self.page.evaluate(TEXT_OUTSIDE_SCRIPTS, needle)

    def lock(self):
        return self.page.evaluate("aglabSimWorkspace.lock()")

    # ------------------------------------------------------------ yerleşim
    def test_layout_matches_reference(self):
        p = self.page
        expect(p.locator("#agSimTitle")).to_have_text("Simülatör · Serbest çalışma")
        expect(p.locator("#agSimEngine")).to_have_text("Motor: Labber")
        boxes = {
            sel: p.locator(sel).bounding_box()
            for sel in ["#agSimHead", "#agSimTask", "#agSimStage", "#agSimInspect", "#agSimDock"]
        }
        task, stage, inspect = boxes["#agSimTask"], boxes["#agSimStage"], boxes["#agSimInspect"]
        # Üç sütun aynı satırda, soldan sağa; başlık üstte, terminal altta; ekrana sığar.
        self.assertLess(task["x"] + task["width"], stage["x"])
        self.assertLess(stage["x"] + stage["width"], inspect["x"])
        self.assertAlmostEqual(task["y"], inspect["y"], delta=2)
        self.assertLess(boxes["#agSimHead"]["y"], task["y"])
        self.assertGreater(boxes["#agSimDock"]["y"], task["y"] + task["height"])
        dock = boxes["#agSimDock"]
        self.assertLessEqual(dock["y"] + dock["height"], 900 + 1)
        self.assertGreater(stage["width"], task["width"])
        # Görev seçimi çalışma alanının altında; "Görev seç" oraya götürür.
        catalog = p.locator("#agSimCatalog")
        self.assertGreater(catalog.bounding_box()["y"], dock["y"])
        for sel in ["#academySelect", "#labberLabSelect", "#sharedScenarioSelect"]:
            self.assertEqual(catalog.locator(sel).count(), 1, sel)
        p.click("#agSimChoose")
        expect(catalog).to_be_in_viewport()
        # Eski yön metinleri ve kahraman başlığı çalışma alanında yok.
        self.assertEqual(p.locator("#area-lab .lab-heading").count(), 0)
        self.assertEqual(p.locator("#ptWorkbench .pt-workgrid").count(), 0)
        # Serbest çalışmada çözüm düğmesi yok; görev bağlamı "free".
        expect(p.locator("#agSimSolutionBtn")).to_be_hidden()
        self.assertEqual(p.evaluate("aglabSimWorkspace.context().kind"), "free")
        expect(p.locator("#aglabFirstNetworkGuide")).to_be_visible()

    def test_inspector_tabs_and_quick_show_have_no_side_effects(self):
        p = self.page
        tabs = p.locator("#agSimInspect [role=tab]")
        self.assertEqual(tabs.all_text_contents(), ["Port", "Cihaz", "Olaylar"])
        expect(p.locator("#agSimTab-port")).to_have_attribute("aria-selected", "true")
        sw = p.evaluate("academyEngine.snapshot().devices.find(d=>d.type==='Switch')")
        p.locator('#ptCanvas g[data-id="' + sw["id"] + '"]').click()
        expect(p.locator("#agSimPortTitle")).to_contain_text(sw["name"])
        props = dict(
            zip(
                p.locator("#agSimPortProps dt").all_text_contents(),
                p.locator("#agSimPortProps dd").all_text_contents(),
            )
        )
        self.assertIn("Mod", props)
        self.assertEqual(props["Durum"], "up / up")
        before_lines = p.locator("#ptTerminal > div").count()
        before_state = p.evaluate("JSON.stringify(aglabLabberSession.state())")
        before_prompt = p.locator("#ptPrompt").text_content()
        trunk = p.locator('#agSimQuick [data-show="show interfaces trunk"]')
        if trunk.count() == 0:
            p.select_option(
                "#agSimPortSelect",
                next(port for port, i in sw["interfaces"].items() if i.get("mode") == "trunk"),
            )
        p.click('#agSimQuick [data-show="show interfaces trunk"]')
        out = p.locator("#agSimShowOut").text_content()
        self.assertIn("show interfaces trunk", out)
        self.assertIn("Vlans allowed on trunk", out)
        self.assertEqual(p.locator("#ptTerminal > div").count(), before_lines)
        self.assertEqual(p.evaluate("JSON.stringify(aglabLabberSession.state())"), before_state)
        self.assertEqual(p.locator("#ptPrompt").text_content(), before_prompt)
        # Yalnız show komutu çalışır.
        with self.assertRaises(Exception):
            p.evaluate("aglabLabberSession.peek('%s', 'configure terminal')" % sw["id"])
        # Cihaz ve Olaylar sekmeleri mevcut kartları taşır.
        p.click("#agSimTab-device")
        expect(p.locator("#ptDeviceInfo")).to_be_visible()
        expect(p.locator("#agSimPortProps")).to_be_hidden()
        p.locator("#agSimTab-device").press("ArrowRight")
        expect(p.locator("#agSimTab-events")).to_be_focused()
        expect(p.locator("#packetDetectiveRefresh")).to_be_visible()

    def test_terminal_tabs_follow_cli_device(self):
        p = self.page
        names = p.locator("#agSimTermTabs button").all_text_contents()
        devices = p.evaluate("academyEngine.snapshot().devices.map(d=>[d.id,d.name])")
        self.assertEqual(names, [n for _, n in devices])
        target = devices[2]
        p.click('#agSimTermTabs [data-dev="' + target[0] + '"]')
        expect(p.locator("#ptCliDevice")).to_have_value(target[0])
        expect(p.locator('#agSimTermTabs [data-dev="' + target[0] + '"]')).to_have_attribute(
            "aria-pressed", "true"
        )
        expect(p.locator("#ptPrompt")).to_contain_text(target[1])
        p.select_option("#ptCliDevice", devices[0][0])
        expect(p.locator('#agSimTermTabs [data-dev="' + devices[0][0] + '"]')).to_have_attribute(
            "aria-pressed", "true"
        )

    # ------------------------------------------------------------ canlı hedefler
    def test_live_goals_update_without_check(self):
        p = self.page
        self.academy("AGL-005")
        expect(p.locator("#academyCheck")).to_have_text("Kontrol et")
        expect(p.locator("#academyReset")).to_have_text("Sıfırla")
        expect(p.locator("#academyHint")).to_have_text("İpucu (1)")
        goals = p.locator("#agSimGoals li")
        self.assertGreater(goals.count(), 1)
        self.assertIn(
            "false", [goals.nth(i).get_attribute("data-ok") for i in range(goals.count())]
        )
        progress = p.evaluate("localStorage.getItem('aglab-academy-progress-v1')")
        self.cli(
            "SW1",
            "enable",
            "configure terminal",
            "interface fa0/2",
            "no shutdown",
            "end",
        )
        p.wait_for_function(
            "[...document.querySelectorAll('#agSimGoals li')].every(l=>l.dataset.ok==='true')"
        )
        # Canlı değerlendirme puan ve ilerleme yazmaz; "Kontrol et" yazar.
        self.assertEqual(p.evaluate("localStorage.getItem('aglab-academy-progress-v1')"), progress)
        expect(p.locator("#academyResult")).to_be_empty()
        p.click("#academyCheck")
        expect(p.locator("#academyResult")).to_contain_text("100/100")

    # ------------------------------------------------------------ çözüm kilidi
    def test_academy_solution_unlocks_after_three_failed_checks(self):
        p = self.page
        self.academy("AGL-005")
        sol = json.loads((ROOT / "academy/teacher/AGL-005.json").read_text("utf-8"))[
            "teacher_solution"
        ]
        btn = p.locator("#agSimSolutionBtn")
        expect(btn).to_be_visible()
        expect(btn).to_be_disabled()
        expect(btn).to_have_text("🔒 Çözümü göster")
        self.assertEqual(p.locator("#agSimSolution").count(), 0)
        self.assertFalse(self.visible_text(sol["explanation"]))
        for n in range(1, 3):
            p.click("#academyCheck")
            expect(p.locator("#academyResult")).to_contain_text("Düzenlemeye devam et")
            self.assertEqual(self.lock()["fails"], n)
            expect(btn).to_be_disabled()
            self.assertEqual(p.locator("#agSimSolution").count(), 0)
            self.assertFalse(self.visible_text(sol["explanation"]))
        p.click("#academyCheck")
        self.assertEqual(self.lock()["fails"], 3)
        self.assertTrue(self.lock()["unlocked"])
        expect(btn).to_be_enabled()
        expect(btn).to_have_text("Çözümü göster")
        # Kilit açık olsa da çözüm düğmeye basılana kadar oluşturulmaz.
        self.assertEqual(p.locator("#agSimSolution").count(), 0)
        btn.click()
        box = p.locator("#agSimSolution")
        expect(box).to_be_visible()
        expect(box).to_contain_text(sol["explanation"])
        for dev, cmds in sol["reference_commands"].items():
            expect(box).to_contain_text(dev)
            expect(box).to_contain_text(cmds[-2])
        expect(btn).to_be_disabled()

    def test_academy_solution_unlocks_after_all_hints(self):
        p = self.page
        self.academy("AGL-001")  # iki ipucu
        btn = p.locator("#agSimSolutionBtn")
        expect(p.locator("#academyHint")).to_have_text("İpucu (2)")
        p.click("#academyHint")
        expect(p.locator("#academyHint")).to_have_text("İpucu (1)")
        expect(btn).to_be_disabled()
        self.assertEqual(p.locator("#agSimSolution").count(), 0)
        expect(p.locator("#agSimHintBox")).to_be_visible()
        expect(p.locator("#agSimHintBox li")).to_have_count(1)
        p.click("#academyHint")
        expect(btn).to_be_enabled()
        lock = self.lock()
        self.assertEqual((lock["fails"], lock["hintsUsed"], lock["hintsTotal"]), (0, 2, 2))
        self.assertEqual(p.locator("#agSimSolution").count(), 0)
        btn.click()
        expect(p.locator("#agSimSolution")).to_be_visible()
        # Başka bir göreve geçince açılan çözüm kaldırılır (o görevin kilidi ayrıdır).
        self.academy("AGL-002")
        self.assertEqual(p.locator("#agSimSolution").count(), 0)
        expect(btn).to_be_disabled()

    def test_labber_lab_solution_lock(self):
        p = self.page
        lab = p.evaluate("aglabLabberLabs.list()[0].id")
        p.select_option("#labberLabSelect", lab)
        p.click("#labberLabStart")
        expect(p.locator("#agSimTitle")).to_contain_text(
            p.evaluate("(id)=>aglabLabberLabs.info(id).title", lab)
        )
        # Eski "Referans çözüm" kutusu yok; çözüm komutları DOM'da değil.
        self.assertEqual(p.locator("#labberLabSolution").count(), 0)
        script = "\n".join(p.evaluate("(id)=>aglabLabberLabs.solution(id)", lab).values())
        distinctive = max(script.split("\n"), key=len)
        self.assertFalse(self.visible_text(distinctive))
        btn = p.locator("#agSimSolutionBtn")
        expect(btn).to_be_disabled()
        goals = p.evaluate("aglabLabberLabs.goals()")
        expect(p.locator("#agSimLabberHint")).to_have_text("İpucu (%d)" % len(goals))
        # İpuçları sırayla: ilk sağlanmamış hedeften.
        p.click("#agSimLabberHint")
        first = next(g for g in goals if not g["ok"])
        expect(p.locator("#agSimLabberHints li").first).to_contain_text(first["hint"])
        for _ in range(3):
            p.click("#labberLabCheck")
        self.assertEqual(self.lock()["fails"], 3)
        expect(btn).to_be_enabled()
        self.assertFalse(self.visible_text(distinctive))
        btn.click()
        box = p.locator("#agSimSolution")
        expect(box).to_contain_text(distinctive)
        # Labber labı: bütün hedef ipuçları kullanılınca da açılır (yeni oturum, sıfır başarısız).
        p.evaluate("localStorage.removeItem('aglab-solution-lock-v1')")
        p.reload()
        p.click('[data-area="lab"]')
        expect(btn).to_be_disabled()
        for left in range(len(goals), 0, -1):
            expect(p.locator("#agSimLabberHint")).to_have_text("İpucu (%d)" % left)
            expect(btn).to_be_disabled()
            p.click("#agSimLabberHint")
        expect(p.locator("#agSimLabberHint")).to_be_disabled()
        expect(btn).to_be_enabled()
        self.assertEqual(self.lock()["fails"], 0)

    def test_embedded_solutions_match_teacher_json(self):
        html = HTML.read_text("utf-8")
        match = re.search(r"^const academySolutions = (.+);\r?$", html, re.M)
        self.assertTrue(match)
        embedded = json.loads(match.group(1))
        teacher = {
            p.stem: json.loads(p.read_text("utf-8"))["teacher_solution"]
            for p in (ROOT / "academy/teacher").glob("AGL-*.json")
        }
        self.assertEqual(len(teacher), 40)
        self.assertEqual(embedded, teacher)
        # Hedef topoloji gömülmez (yalnız çözümdeki dosya adı `target_topology_file`).
        self.assertIsNone(re.search(r'"target_topology"\s*:', html))

    # ------------------------------------------------------------ bağlam ve zaman çizelgesi
    def test_shared_scenario_context_and_simulation_timeline(self):
        p = self.page
        p.select_option("#sharedScenarioSelect", "return-route")
        p.click("#sharedScenarioLoad")
        title = p.locator('#sharedScenarioSelect option[value="return-route"]').text_content()
        expect(p.locator("#agSimTitle")).to_have_text("Simülatör · " + title)
        self.assertEqual(p.evaluate("aglabSimWorkspace.context().kind"), "shared")
        expect(p.locator("#sharedScenarioStatus")).to_be_visible()
        expect(p.locator("#agSimSharedReset")).to_be_visible()
        # Ortak senaryonun çözüm düzeni Sorun Çöz ekranında (PR 3); burada çözüm düğmesi yok.
        expect(p.locator("#agSimSolutionBtn")).to_be_hidden()
        # Ping → Simulation Mode: zaman çizelgesi olay satırlarıyla aynı.
        src = p.evaluate("aglabSharedEngine.active() && academyEngine.snapshot().devices[0].id")
        self.cli(src, "ping " + p.evaluate("aglabSharedEngine.target()"))
        p.click("#simulationMode")
        rows = p.locator("#simulationRows tr")
        expect(rows.first).to_be_attached()
        ticks = p.locator("#agSimTimeline li")
        expect(ticks).to_have_count(rows.count())
        ticks.nth(1).locator("button").click()
        expect(rows.nth(1)).to_have_attribute("aria-selected", "true")
        expect(ticks.nth(1)).to_have_attribute("aria-current", "step")
        expect(p.locator("#agSimSimTitle")).to_contain_text("olay 2 / " + str(rows.count()))
        p.click("#simulationRealtime")
        expect(p.locator("#agSimTimeline")).to_be_hidden()
        # Başka topoloji içe aktarılınca senaryo bağlamı biter.
        p.evaluate("academyEngine.load({app:'AgLab',version:23,devices:[],links:[],nextId:1})")
        expect(p.locator("#agSimTitle")).to_have_text("Simülatör · Serbest çalışma")


if __name__ == "__main__":
    unittest.main()
