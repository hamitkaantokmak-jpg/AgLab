"""Arayüz PR 2: konu akışı Öğren → Test → Pratik ve simülatörde konuya göre görev listesi.

- Konu sayfasında üç adım var; "Adım n/3" etiketi adımı izler. Öğren adımı tam dersi açar,
  kısa özet daraltılmış durur.
- Konu listesinde seviye başlıkları müfredat sırasında.
- Simülatör > Görev seç: üç kaynağın bütün görevleri tek listede, konu sırasına göre gruplu;
  her görev bir konuya bağlı ("Diğer" grubu boş). Arama, seviye ve tür süzgeçleri çalışır.
- Pratik adımı konunun görevlerini listeler; Başlat görevi simülatörde açar.
"""

import json
import unittest

from playwright.sync_api import expect, sync_playwright

from aglab_test_support import HTML, ROOT, launch_chromium

COURSES = json.loads((ROOT / "src/data/courses.json").read_text(encoding="utf-8"))


class FlowTasksTests(unittest.TestCase):
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

    def open_course(self, title):
        self.page.locator("#sfList button", has_text=title).first.evaluate("b => b.click()")

    def test_three_steps_and_stage_label(self):
        p = self.page
        steps = p.locator("#sfSheet .sf-steps button")
        expect(steps).to_have_text(["1 · Öğren", "2 · Test", "3 · Pratik"])
        expect(p.locator("#ux13Stage")).to_have_text("Adım 1/3 · Öğren")
        # Öğren: tam ders (içindekiler) ve daraltılmış kısa özet.
        expect(p.locator("#sfSheet .lr-toc")).to_have_count(1)
        summary = p.locator("#sfSheet details.sf-summary")
        expect(summary).to_have_js_property("open", False)
        expect(summary.locator("summary")).to_have_text("Kısa özet")
        steps.nth(2).click()
        expect(p.locator("#ux13Stage")).to_have_text("Adım 3/3 · Pratik")
        expect(p.locator("#sfSheet .sf-toolbar button", has_text="Sonraki")).to_have_count(0)

    def test_topic_list_has_level_headers_in_order(self):
        heads = self.page.evaluate(
            "[...document.querySelectorAll('#sfList .sf-level-head')].map(h => h.textContent)"
        )
        self.assertEqual(heads, ["Seviye 1 · Şube", "Seviye 2 · CCNA", "Seviye 3 · CCNP"])

    def test_simulator_task_list_groups_every_task_by_topic(self):
        p = self.page
        p.click('[data-area="lab"]')
        tasks = p.locator("#agSimTasks")
        expect(tasks).to_be_visible()
        total = p.evaluate("""() => ['academySelect','labberLabSelect','sharedScenarioSelect']
              .reduce((n, id) => n + document.getElementById(id).options.length, 0)""")
        rows = p.locator("#agSimTaskList .ag-task-row")
        expect(rows).to_have_count(total)
        expect(p.locator('#agSimTaskList [data-course="other"]')).to_have_count(0)
        # Gruplar müfredat sırasında.
        order = [c["id"] for c in COURSES]
        groups = p.evaluate(
            "[...document.querySelectorAll('#agSimTaskList .ag-task-group')].map(g => g.dataset.course)"
        )
        self.assertEqual(groups, sorted(groups, key=order.index))
        self.assertIn("vlan", groups)
        # Tür süzgeci: yalnız arıza bulma; hazır senaryoların hepsi arıza bulmadır.
        p.select_option("#agSimTaskType", "ariza")
        expect(p.locator('#agSimTaskList .ag-task-type[data-type="kurulum"]')).to_have_count(0)
        shared = p.evaluate("document.getElementById('sharedScenarioSelect').options.length")
        self.assertGreaterEqual(rows.count(), shared)
        p.select_option("#agSimTaskType", "")
        # Seviye süzgeci: CCNP seviyesinde yalnız ileri konular.
        p.select_option("#agSimTaskLevel", "advanced")
        adv = {c["id"] for c in COURSES if c["level"] == "advanced"}
        shown = p.evaluate(
            "[...document.querySelectorAll('#agSimTaskList .ag-task-group')].map(g => g.dataset.course)"
        )
        self.assertTrue(shown)
        self.assertTrue(set(shown) <= adv, shown)
        p.select_option("#agSimTaskLevel", "")
        # Arama ada ve konu başlığına bakar.
        p.fill("#agSimTaskSearch", "AGL-024")
        expect(rows).to_have_count(1)
        p.fill("#agSimTaskSearch", "EtherChannel")
        expect(
            p.locator('#agSimTaskList .ag-task-group[data-course="etherchannel"]')
        ).to_have_count(1)
        p.fill("#agSimTaskSearch", "zzzz yok")
        expect(p.locator("#agSimTaskCount")).to_have_text("0 görev")

    def test_task_start_uses_source_controls(self):
        p = self.page
        p.click('[data-area="lab"]')
        lab = p.evaluate("aglabLabberLabs.list()[0].id")
        p.locator(
            '#agSimTaskList .ag-task-row[data-kind="labber"][data-value="%s"] .ag-task-start' % lab
        ).click()
        p.wait_for_function("aglabSimWorkspace.context().kind === 'labber'")
        self.assertEqual(p.evaluate("aglabSimWorkspace.context().id"), lab)
        row = p.locator('#agSimTaskList .ag-task-row[data-value="%s"]' % lab)
        expect(row.locator(".ag-task-status")).to_have_text("açık")
        sc = p.evaluate("document.getElementById('sharedScenarioSelect').options[3].value")
        p.locator(
            '#agSimTaskList .ag-task-row[data-kind="shared"][data-value="%s"] .ag-task-start' % sc
        ).click()
        p.wait_for_function("aglabSimWorkspace.context().kind === 'shared'")
        self.assertEqual(p.evaluate("aglabSimWorkspace.context().id"), sc)

    def test_practice_step_lists_topic_tasks_and_starts_one(self):
        p = self.page
        self.open_course("VLAN ve trunk")
        p.locator("#sfSheet .sf-steps button", has_text="3 · Pratik").click()
        expected = p.evaluate("aglabSimWorkspace.tasksFor('vlan').length")
        self.assertGreater(expected, 5)
        items = p.locator("#sfSheet .sf-tasks li")
        expect(items).to_have_count(expected)
        lab = p.evaluate("aglabSimWorkspace.tasksFor('vlan').find(t => t.kind === 'labber').id")
        p.locator('#sfSheet .sf-tasks li[data-value="%s"] button' % lab).click()
        expect(p.locator("#area-lab")).to_be_visible()
        p.wait_for_function("aglabSimWorkspace.context().kind === 'labber'")
        self.assertEqual(p.evaluate("aglabSimWorkspace.context().id"), lab)
        # "Bütün görevleri gör": simülatör listesinde konunun grubu.
        p.click('[data-area="learn"]')
        p.locator("#sfSheet button", has_text="Simülatörde bütün görevleri gör").click()
        group = p.locator('#agSimTaskList .ag-task-group[data-course="vlan"]')
        expect(group).to_be_in_viewport()
        expect(group.locator("h4")).to_have_attribute("tabindex", "-1")

    def test_topic_without_tasks_offers_free_simulator(self):
        p = self.page
        self.open_course("IPsec")
        p.locator("#sfSheet .sf-steps button", has_text="3 · Pratik").click()
        expect(p.locator("#sfSheet .sf-tasks")).to_have_count(0)
        expect(p.locator("#sfSheet")).to_contain_text("simülatör görevi henüz yok")

    def test_reading_label_matches_simulator_tasks(self):
        """ "Okuma" etiketi yalnız simülatör görevi olmayan derste; labı olan okuma dersi
        "okuma + simülatör labı" etiketini taşır (MUFREDAT "Dürüstlük" ilkesi iki yönlü)."""
        p = self.page
        p.click('[data-area="lab"]')
        expect(p.locator("#agSimTasks")).to_be_visible()
        counts = p.evaluate(
            "Object.fromEntries(%s.map(id => [id, aglabSimWorkspace.tasksFor(id).length]))"
            % json.dumps([c["id"] for c in COURSES])
        )
        for c in COURSES:
            with self.subTest(c["id"]):
                if c.get("kind") == "okuma":
                    self.assertEqual(counts[c["id"]], 0, "görevi olan ders 'okuma' olamaz")
                if c.get("kind") == "okuma-lab":
                    self.assertGreater(counts[c["id"]], 0, "'okuma-lab' dersinin görevi olmalı")
        p.click('[data-area="learn"]')
        eigrp = p.locator("#sfList button", has_text="EIGRP").first
        expect(eigrp.locator("small")).to_contain_text("okuma + simülatör labı")
        eigrp.evaluate("b => b.click()")
        expect(p.locator("#sfSheet > small").first).to_contain_text("OKUMA DERSİ + SİMÜLATÖR LABI")
        bgp = p.locator("#sfList button", has_text="BGP: eBGP").first
        expect(bgp.locator("small")).to_contain_text("okuma + simülatör labı")
        ipsec = p.locator("#sfList button", has_text="IPsec").first
        expect(ipsec.locator("small")).to_contain_text("okuma")
        expect(ipsec.locator("small")).not_to_contain_text("simülatör labı")

    def test_level1_topics_have_setup_and_fault_tasks(self):
        """Şube 1.0: Seviye 1'in her konusunda en az bir kurulum (yönlendirmeli) görevi ve en az
        beş arıza görevi var. #1 Sorun giderme yöntemi kurulum gerektirmez: yönlendirmeli labı
        sağlam ağda kanıt toplamaktır, pratiği arıza senaryolarıdır."""
        p = self.page
        p.click('[data-area="lab"]')
        expect(p.locator("#agSimTasks")).to_be_visible()
        for c in COURSES:
            if c["level"] != "beginner":
                continue
            with self.subTest(c["id"]):
                types = p.evaluate(
                    "(id) => aglabSimWorkspace.tasksFor(id).map(t => t.type)", c["id"]
                )
                self.assertGreaterEqual(types.count("ariza"), 5)
                if c["id"] != "method":
                    self.assertGreaterEqual(types.count("kurulum"), 1)


if __name__ == "__main__":
    unittest.main()
