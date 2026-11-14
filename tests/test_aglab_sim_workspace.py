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

import os
from pathlib import Path

from aglab_test_support import HTML, ROOT, launch_chromium, open_cable_tool

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
        total = sum(len(g["hints"]) for g in goals)
        self.assertEqual(total, 3 * len(goals))
        # İpuçları kademeli ve sayaç hedef başına: ilk sağlanmamış hedefin önce "neye bak", sonra
        # "kavram", sonra komut ("İpucu · hedef N: k/3").
        first = next(g for g in goals if not g["ok"])
        idx = goals.index(first) + 1
        item = p.locator('#agSimLabberHints > li[data-goal="%s"]' % first["id"])
        for step in (1, 2, 3):
            expect(p.locator("#agSimLabberHint")).to_have_text(
                "İpucu · hedef %d: %d/3" % (idx, step - 1)
            )
            p.click("#agSimLabberHint")
            expect(item.locator("[data-step]")).to_have_count(step)
            expect(item.locator('[data-step="%d"]' % step)).to_contain_text(
                first["hints"][step - 1]
            )
        self.assertEqual(first["hints"][2], first["hint"])
        expect(item.locator('[data-step="1"]')).to_contain_text("Neye bak")
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
        # Kilidin ipucu yolu: bütün hedeflerin komut basamağı açılınca (basamaklar sırayla açıldığı
        # için toplam basamak sayısı kadar "İpucu").
        for used in range(total):
            expect(btn).to_be_disabled()
            self.assertEqual(self.lock()["hintsUsed"], used)
            p.click("#agSimLabberHint")
        expect(p.locator("#agSimLabberHint")).to_have_text("İpucu · hepsi açık")
        expect(p.locator("#agSimLabberHint")).to_be_disabled()
        expect(btn).to_be_enabled()
        self.assertEqual(self.lock()["fails"], 0)

    def test_labber_hint_tiers_are_graded(self):
        """Her Labber lab hedefinin üç basamağı var; ilk iki basamak komut vermez."""
        command = re.compile(
            r"\b(show |interface |switchport|spanning-tree |channel-group|ip route|router ospf|"
            r"no shutdown|configure terminal|hostname |network \d|ip address|copy running|"
            r"write memory|passive-interface|default-information|errdisable)",
            re.I,
        )
        labs = self.page.evaluate("aglabLabberLabs.list().map(l=>l.id)")
        tiers = self.page.evaluate("AgLabSim.LABBER_HINT_TIERS")
        self.assertEqual(sorted(tiers), sorted(labs))
        for lab in labs:
            self.page.select_option("#labberLabSelect", lab)
            self.page.click("#labberLabStart")
            self.page.wait_for_function("(id)=>aglabLabberLabs.active()===id", arg=lab)
            goals = self.page.evaluate("aglabLabberLabs.goals()")
            self.assertEqual(sorted(tiers[lab]), sorted(g["id"] for g in goals), lab)
            for g in goals:
                self.assertEqual(len(g["hints"]), 3, (lab, g["id"]))
                for i, text in enumerate(g["hints"][:2]):
                    self.assertTrue(text.strip(), (lab, g["id"], i))
                    self.assertIsNone(command.search(text), (lab, g["id"], i, text))
                self.assertEqual(g["hints"][2], g["hint"])

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

    # ------------------------------------------------------------ kullanıcı testi düzeltmeleri
    def contrast(self, fg_sel, bg_sel):
        return self.page.evaluate(
            """([f, b]) => {
              const rgb = (s) => (s.match(/[\\d.]+/g) || []).map(Number);
              const lum = (c) => c.slice(0, 3).map((v) => v / 255)
                .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
                .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
              const x = lum(rgb(getComputedStyle(document.querySelector(f)).color));
              const y = lum(rgb(getComputedStyle(document.querySelector(b)).backgroundColor));
              return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
            }""",
            [fg_sel, bg_sel],
        )

    def test_1024_layout_and_screenshot(self):
        p = self.page
        p.set_viewport_size({"width": 1024, "height": 768})
        p.evaluate("localStorage.setItem('aglab-theme','light')")
        p.reload()
        p.click('[data-area="lab"]')
        top = p.locator("#agTop").bounding_box()
        head = p.locator("#agSimHead").bounding_box()
        # Üst bar tek satır; tema düğmesi ve arama üst barın içinde, başlığı örtmez.
        self.assertLessEqual(top["height"], 60)
        for sel in ["#themeToggle", "#agSearch", "#areaTabs"]:
            b = p.locator(sel).bounding_box()
            self.assertLessEqual(b["y"] + b["height"], top["y"] + top["height"] + 0.5, sel)
            self.assertLessEqual(b["y"] + b["height"], head["y"], sel)
        # Üç sütun yan yana.
        task, stage, inspect = (
            p.locator(s).bounding_box() for s in ["#agSimTask", "#agSimStage", "#agSimInspect"]
        )
        self.assertLess(task["x"] + task["width"], stage["x"])
        self.assertLess(stage["x"] + stage["width"], inspect["x"])
        self.assertLessEqual(inspect["x"] + inspect["width"], 1024 + 0.5)
        # Palet tuvalin dışında: hiçbir düğümün üstüne binmez.
        pal = p.locator(".ag-sim-palette").bounding_box()
        for i in range(p.locator("#ptCanvas g[data-id]").count()):
            n = p.locator("#ptCanvas g[data-id]").nth(i).bounding_box()
            overlap = not (
                n["x"] >= pal["x"] + pal["width"]
                or n["x"] + n["width"] <= pal["x"]
                or n["y"] >= pal["y"] + pal["height"]
                or n["y"] + n["height"] <= pal["y"]
            )
            self.assertFalse(overlap, i)
        self.assertEqual(p.evaluate("document.documentElement.scrollWidth"), 1024)
        out = Path(os.environ.get("AGLAB_TEST_ARTIFACT_DIR", ROOT / "dist"))
        out.mkdir(parents=True, exist_ok=True)
        shot = out / "simulator-1024.png"
        p.screenshot(path=str(shot))
        self.assertGreater(shot.stat().st_size, 10000)
        # Sol şeridin zemini sayfa boyunca (kabuğun ilk sütunu boyalı ve kabuk sayfa boyu).
        shell = p.evaluate(
            "(() => { const s = document.querySelector('.ag-shell'); return [getComputedStyle(s).backgroundImage, s.offsetHeight, document.documentElement.scrollHeight]; })()"
        )
        self.assertIn("linear-gradient", shell[0])
        self.assertGreaterEqual(shell[1] + 1, shell[2])

    def test_canvas_toolbar_cable_tool_and_link_labels(self):
        p = self.page
        # Tuval üstünde araç çubuğu yok; "Kablo bağla" tekrarı yok.
        self.assertEqual(p.locator("#ptWorkbench .ag-sim-stagebar").count(), 0)
        text = p.locator("#agSimStage").inner_text()
        self.assertNotIn("Kabloyu bağla", text)
        self.assertNotIn("Kablo bağla", text)
        expect(p.locator("#ptSave")).to_be_visible()
        expect(p.locator("#ptAudit")).to_be_visible()
        for sel in ["#ptMakeLink", "#ptSource", "#ptConnectMode"]:
            expect(p.locator(sel)).to_be_hidden()
        for sel in ["#ptExport", "#ptImport", "#ptReset", "#ptDeleteDevice"]:
            expect(p.locator(sel)).to_be_hidden()
        p.click("#uxMoreLabActions")
        for sel in ["#ptExport", "#ptImport", "#ptReset", "#ptDeleteDevice"]:
            expect(p.locator(sel)).to_be_visible()
        # Kablo aracı palette; kablo işlemleri onun satırında.
        tool = p.locator(".ag-sim-palette #agSimCableTool")
        expect(tool).to_have_attribute("aria-pressed", "false")
        tool.click()
        expect(tool).to_have_attribute("aria-pressed", "true")
        for sel in ["#ptConnectMode", "#ptSource", "#ptTarget", "#ptMakeLink", "#ptRemoveLink"]:
            expect(p.locator("#agSimCablePanel " + sel)).to_be_visible()
        expect(p.locator("#ptConnectMode")).to_have_text("Tuvalde iki cihaz seç")
        expect(p.locator("#ptMakeLink")).to_have_text("Bağla")
        # Bağlantı etiketleri port adları; trunk bağlantısı "trunk" ile.
        labels = p.locator("#ptCanvas text.pt-edge-label, #ptCanvas text.pt-port-label")
        all_text = " ".join(labels.all_text_contents())
        self.assertNotIn("LINK", all_text)
        snap = p.evaluate("academyEngine.snapshot()")
        mode = (
            lambda dev, port: next(d for d in snap["devices"] if d["id"] == dev)["interfaces"]
            .get(port, {})
            .get("mode")
        )
        trunk = next(l for l in snap["links"] if mode(l["a"], l["portA"]) == "trunk")
        self.assertIn("trunk", all_text)
        short = lambda port: re.sub(r"^(gi|g)(?=\d)", "Gi", re.sub(r"^fa(?=\d)", "Fa", port))
        self.assertIn(short(trunk["portA"]), all_text)
        self.assertIn(short(trunk["portB"]), all_text)

    def test_timeline_labels_detail_and_events_tab(self):
        p = self.page
        snap = p.evaluate("academyEngine.snapshot()")
        pc1, pc2 = [d for d in snap["devices"] if d["type"] == "PC"][:2]
        # Olaylar sekmesi kapalıyken gelen iz: sekmede "yeni" işareti; açılınca güncel.
        self.cli(pc1["id"], "ping " + pc2["ip"])
        expect(p.locator("#agSimTab-events")).to_have_attribute("data-new", "true")
        p.click("#agSimTab-events")
        expect(p.locator("#agSimTab-events")).not_to_have_attribute("data-new", "true")
        raw = p.locator("#packetDetectiveRaw").text_content()
        self.assertIn("icmp", raw.lower())
        # Sekme açıkken yeni ping "Son olayları göster"e basmadan görünür.
        p.select_option("#packetDetectiveViewMode", "technical")
        self.cli(pc2["id"], "ping " + pc1["ip"])
        expect(p.locator("#packetDetectiveRaw")).not_to_have_text(raw)
        self.assertIn("src " + pc2["id"], p.locator("#packetDetectiveRaw").text_content())
        # Zaman çizelgesi: ARP/ICMP Req/Rep etiketleri ve seçili olayın ayrıntısı.
        p.click("#simulationMode")
        ticks = p.locator("#agSimTimeline li")
        expect(ticks.first).to_be_attached()
        labels = set(p.locator("#agSimTimeline li span").all_text_contents())
        self.assertTrue({"ICMP Req", "ICMP Rep"} <= labels, labels)
        allowed = {"ICMP Req", "ICMP Rep", "ARP Req", "ARP Rep", "Teslim", "Ulaşmadı", "Atıldı"}
        self.assertTrue(labels <= allowed, labels)
        p.click("#simulationForward")
        detail = p.locator("#agSimEventDetail")
        expect(detail).to_contain_text("ICMP Echo Request")
        expect(detail).to_contain_text(pc2["ip"] + " → " + pc1["ip"])
        expect(detail).to_contain_text("TTL")
        # Çizelge ve ayrıntı alt şeridin içinde, kesilmeden.
        dock = p.locator("#agSimDock").bounding_box()
        for sel in ["#agSimTimeline", "#agSimEventDetail"]:
            b = p.locator(sel).bounding_box()
            self.assertLessEqual(b["y"] + b["height"], dock["y"] + dock["height"] + 0.5, sel)
        tick = ticks.first.locator("button").bounding_box()
        line = p.locator("#agSimTimeline").bounding_box()
        self.assertLessEqual(tick["y"] + tick["height"], line["y"] + line["height"] + 0.5)

    def test_show_output_wraps_and_task_goals_first(self):
        p = self.page
        p.set_viewport_size({"width": 1280, "height": 800})
        sw = p.evaluate("academyEngine.snapshot().devices.find(d=>d.type==='Switch')")
        p.locator('#ptCanvas g[data-id="' + sw["id"] + '"]').click()
        p.click('#agSimQuick [data-show="show vlan brief"]')
        out = p.locator("#agSimShowOut")
        self.assertEqual(out.evaluate("(e)=>getComputedStyle(e).whiteSpace"), "pre-wrap")
        self.assertLessEqual(
            out.evaluate("(e)=>e.scrollWidth"), out.evaluate("(e)=>e.clientWidth") + 1
        )
        # Görev kartı: hedefler açıklamanın üstünde; açıklama daraltılabilir; 1280×800'de ilk
        # ekranda bütün hedefler görünür (en uzun açıklamalı Labber labında).
        lab = p.evaluate(
            "aglabLabberLabs.list().map(l=>aglabLabberLabs.info(l.id)).sort((a,b)=>b.brief.join('').length-a.brief.join('').length)[0].id"
        )
        p.select_option("#labberLabSelect", lab)
        p.click("#labberLabStart")
        p.evaluate("scrollTo(0,0)")
        goals = p.locator("#agSimGoals li")
        expect(goals.first).to_be_visible()
        self.assertTrue(
            p.evaluate(
                "document.getElementById('agSimGoals').compareDocumentPosition(document.getElementById('agSimTaskAbout')) & Node.DOCUMENT_POSITION_FOLLOWING"
            )
        )
        last = goals.nth(goals.count() - 1)
        last.evaluate("(e)=>e.closest('#agSimTask').scrollTop=0")
        b = last.bounding_box()
        task = p.locator("#agSimTask").bounding_box()
        self.assertLessEqual(b["y"] + b["height"], min(800, task["y"] + task["height"]))
        about = p.locator("#agSimTaskAbout")
        expect(about).to_have_js_property("open", True)
        about.locator("summary").click()
        expect(about).to_have_js_property("open", False)
        expect(p.locator("#labberLabBrief")).to_be_hidden()

    def test_light_theme_contrast(self):
        p = self.page
        p.evaluate("localStorage.setItem('aglab-theme','light')")
        p.reload()
        p.click('[data-area="lab"]')
        self.assertGreaterEqual(self.contrast("#ptPrompt", "#agSimDock"), 4.5)
        p.click('[data-area="troubleshoot"]')
        badge = "#area-troubleshoot .tag"
        self.assertGreaterEqual(self.contrast(badge, badge), 4.5)

    # ------------------------------------------------------------ ikinci tur
    def node_boxes(self):
        p = self.page
        return [
            p.locator("#ptCanvas g[data-id]").nth(i).bounding_box()
            for i in range(p.locator("#ptCanvas g[data-id]").count())
        ]

    def test_canvas_fits_box_and_drag_follows_pointer(self):
        p = self.page
        for width, height in ((1280, 800), (1024, 768)):
            p.set_viewport_size({"width": width, "height": height})
            lab = p.evaluate("aglabLabberLabs.list()[1].id")
            p.select_option("#labberLabSelect", lab)
            p.click("#labberLabStart")
            p.evaluate("scrollTo(0,0)")
            p.wait_for_timeout(200)
            canvas = p.locator("#ptCanvas").bounding_box()
            wrap = p.locator(".ag-sim-canvaswrap").bounding_box()
            # Tuval kutuyu doldurur (sol üste sıkışmış sabit 850×420 değil).
            self.assertGreater(canvas["height"], wrap["height"] - 2)
            boxes = self.node_boxes()
            x0 = min(b["x"] for b in boxes)
            x1 = max(b["x"] + b["width"] for b in boxes)
            y0 = min(b["y"] for b in boxes)
            y1 = max(b["y"] + b["height"] for b in boxes)
            # Topoloji ortada ve kutunun bir boyutunu büyük ölçüde doldurur.
            self.assertLess(abs((x0 + x1) / 2 - (canvas["x"] + canvas["width"] / 2)), 12)
            self.assertLess(abs((y0 + y1) / 2 - (canvas["y"] + canvas["height"] / 2)), 12)
            self.assertTrue(
                (x1 - x0) > 0.7 * canvas["width"] or (y1 - y0) > 0.6 * canvas["height"],
                (x0, x1, y0, y1, canvas),
            )
            # 1024'te de düğüm adları okunur boyda (ekranda en az 11 px).
            size = p.evaluate(
                "parseFloat(getComputedStyle(document.querySelector('#ptCanvas .pt-name')).fontSize) * document.getElementById('ptCanvas').getScreenCTM().a"
            )
            self.assertGreaterEqual(size, 10.9, width)
            # Sürükleme: düğüm imleci birebir izler; bırakınca yerinde kalır (görünüm kaymaz).
            node = p.locator("#ptCanvas g[data-id]").first
            nid = node.get_attribute("data-id")
            b = node.bounding_box()
            x, y = b["x"] + b["width"] / 2, b["y"] + b["height"] / 2
            p.mouse.move(x, y)
            p.mouse.down()
            p.mouse.move(x + 40, y + 25, steps=6)
            p.mouse.up()
            after = p.locator('#ptCanvas g[data-id="%s"]' % nid).bounding_box()
            self.assertAlmostEqual(after["x"] - b["x"], 40, delta=1.5)
            self.assertAlmostEqual(after["y"] - b["y"], 25, delta=1.5)
            p.wait_for_timeout(200)
            again = p.locator('#ptCanvas g[data-id="%s"]' % nid).bounding_box()
            self.assertAlmostEqual(again["x"], after["x"], delta=0.5)
            self.assertAlmostEqual(again["y"], after["y"], delta=0.5)

    def test_port_labels_outside_node_cards(self):
        p = self.page
        cards = [
            p.locator("#ptCanvas g[data-id] rect").nth(i).bounding_box()
            for i in range(p.locator("#ptCanvas g[data-id] rect").count())
        ]
        labels = p.locator("#ptCanvas text.pt-port-label")
        self.assertGreater(labels.count(), 0)
        for i in range(labels.count()):
            t = labels.nth(i).bounding_box()
            cx, cy = t["x"] + t["width"] / 2, t["y"] + t["height"] / 2
            for c in cards:
                inside = c["x"] < cx < c["x"] + c["width"] and c["y"] < cy < c["y"] + c["height"]
                self.assertFalse(inside, (labels.nth(i).text_content(), t, c))

    def test_realtime_idle_hint_and_single_line_terminal_bar(self):
        p = self.page
        idle = p.locator("#agSimSimIdle")
        expect(idle).to_be_visible()
        expect(idle).to_contain_text("Simulation · İncele")
        p.click("#simulationMode")
        expect(idle).to_be_hidden()
        p.click("#simulationRealtime")
        expect(idle).to_be_visible()
        # 1280 px'te terminal araç satırı (cihaz sekmeleri, seçim, temizle) tek satır.
        p.set_viewport_size({"width": 1280, "height": 800})
        bar = p.locator(".ag-sim-termbar")
        centers = []
        for sel in ["#agSimTermTabs button >> nth=0", "#ptCliDevice", "#ptClearTerminal"]:
            b = p.locator(sel).bounding_box()
            centers.append(b["y"] + b["height"] / 2)
        self.assertLess(max(centers) - min(centers), 3, centers)
        self.assertLess(bar.bounding_box()["height"], 40)


if __name__ == "__main__":
    unittest.main()
