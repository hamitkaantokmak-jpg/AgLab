"""Arayüz PR 3 (ön adım): hazır senaryolar Simülatör'de.

* Görev metni yalnız belirtiyi ve kanıtın hangi cihazdan toplanacağını söyler: hiçbir hazır
  senaryonun görev metni kök nedeni (`cause`) ya da çözüm komutunu içermez (#86 kuralı). Eski
  kodla kurulan statik rota, NAT/PAT, DHCP relay ve STP senaryoları da veri tarifine taşındı.
* Katalog "Hazır senaryolar": konu süzgeci (kimlik önekinden) ve arama; durum "başlanmadı".
* Hazır senaryo açıkken üst çubukta Kontrol et + kademeli İpucu + aynı çözüm kilidi; çözüm
  kilit açılmadan DOM'da yoktur.
* Uzun görev başlığı tek satırda kısalır; tam ad `title` özniteliğinde.
"""

import json
import re
import unittest

from playwright.sync_api import expect, sync_playwright

from aglab_test_support import HTML, ROOT, launch_chromium

RECIPES = json.loads((ROOT / "simulator/network-scenarios.json").read_text(encoding="utf-8"))
# Kurulum ve gezinme komutları düzeltme değildir (belirtide "R1'i aç (device power on)" gibi
# geçebilir); geri kalan her çözüm satırı görev metninde aranır (büyük/küçük harf duyarlı: IOS
# komutu küçük harflidir, düzyazıdaki "VLAN 20" komut sayılmaz).
NOT_A_FIX = {"enable", "configure terminal", "end", "exit", "device power on", "ip dhcp"}


def fix_commands(recipe):
    for block in recipe["solution"]:
        for c in block["commands"]:
            c = c.strip()
            if len(c) < 4 or c in NOT_A_FIX or c.startswith("interface "):
                continue
            yield c


def leaks(recipe, text):
    """Görev metninde geçen kök neden ya da çözüm komutları."""
    found = [c for c in fix_commands(recipe) if c in text]
    if recipe.get("cause") and recipe["cause"] in text:
        found.append("cause")
    return found


class RecipeDataTests(unittest.TestCase):
    def test_every_recipe_is_data_defined(self):
        """Hazır senaryonun tamamı tarifte: topoloji, belirti, kök neden, ipuçları, çözüm."""
        for r in RECIPES:
            with self.subTest(r["id"]):
                for field in ("topology", "symptom", "cause", "hints", "solution"):
                    self.assertTrue(r.get(field), field)
                self.assertNotEqual(r["title"], r["id"], "başlık kimliğin kendisi olmamalı")

    def test_task_text_has_no_cause_or_fix(self):
        for r in RECIPES:
            with self.subTest(r["id"]):
                self.assertEqual(leaks(r, r["symptom"]), [])

    def test_no_code_built_scenario_text(self):
        """Eski kodla kurulan senaryoların "Arıza: … Görev: <komut>" metni kalmadı."""
        src = (ROOT / "src/app/main.js").read_text(encoding="utf-8")
        self.assertNotIn("<b>Arıza:</b>", src)
        self.assertIsNone(re.search(r"function loadShared\w+Scenario\(\)", src))


class ReadyScenarioUiTests(unittest.TestCase):
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

    def load(self, rid):
        self.page.select_option("#sharedScenarioSelect", rid)
        self.page.click("#sharedScenarioLoad")
        expect(self.page.locator("#agSimSharedCheck")).to_be_visible()

    def cli(self, device, *lines):
        dev = self.page.evaluate(
            "(n) => [...document.querySelectorAll('#ptCliDevice option')]"
            ".find((o) => o.textContent.startsWith(n + ' ')).value",
            device,
        )
        self.page.select_option("#ptCliDevice", dev)
        for line in lines:
            self.page.fill("#ptCliInput", line)
            self.page.locator("#ptCliInput").press("Enter")

    def page_text(self):
        """Sayfadaki öğelerin metni (gömülü betik verisi hariç)."""
        return self.page.evaluate(
            "() => { const b = document.body.cloneNode(true);"
            " b.querySelectorAll('script, style').forEach((n) => n.remove());"
            " return b.textContent + [...b.querySelectorAll('[title],[value]')]"
            ".map((n) => n.title + ' ' + (n.value || '')).join(' '); }"
        )

    def test_rendered_task_text_has_no_cause_or_fix(self):
        """Her senaryo yüklenince görünen görev metni (kök neden kutusu hariç) temiz; çözüm
        komutları sayfada hiçbir yerde yok."""
        shown = self.page.evaluate(
            """(ids) => ids.map((id) => {
                aglabSharedEngine.load(id);
                const panel = document.getElementById('sharedScenarioInstructions').cloneNode(true);
                panel.querySelector('#sharedScenarioCause')?.remove();
                return [id, panel.textContent, document.getElementById('agSimTask').textContent
                  .replace(document.getElementById('sharedScenarioCause')?.textContent || '', '')];
            })""",
            [r["id"] for r in RECIPES],
        )
        by_id = {r["id"]: r for r in RECIPES}
        options = self.page.evaluate(
            "[...document.querySelectorAll('#sharedScenarioSelect option')].map((o) => o.value)"
        )
        self.assertEqual(sorted(options), sorted(by_id))
        for rid, text, task in shown:
            with self.subTest(rid):
                self.assertIn(by_id[rid]["symptom"], text)
                self.assertEqual(leaks(by_id[rid], text), [])
                self.assertEqual(leaks(by_id[rid], task), [])

    def test_catalog_topic_filter_search_and_status(self):
        p = self.page
        rows = p.locator("#agSimCatList-shared .ag-cat-row")
        visible = p.locator("#agSimCatList-shared .ag-cat-row:visible")
        expect(rows).to_have_count(len(RECIPES))
        expect(rows.first.locator(".ag-cat-status")).to_have_text("başlanmadı")
        expect(
            p.locator("#agSimCatList-labber .ag-cat-row").first.locator(".ag-cat-status")
        ).to_have_text("başlanmadı")
        self.assertEqual(p.locator(".ag-cat-status", has_text="—").count(), 0)
        # Konu süzgeci kimlik önekinden: EtherChannel yalnız ec-* senaryoları.
        ec = sorted(r["id"] for r in RECIPES if r["id"].startswith("ec-"))
        p.select_option("#agSimSharedTopic", "ec")
        expect(visible).to_have_count(len(ec))
        self.assertEqual(sorted(visible.evaluate_all("(rs) => rs.map((r) => r.dataset.value)")), ec)
        # Öneksiz eski kimlik eşlenir: statik rota senaryoları ağ geçidi/rota konusunda.
        p.select_option("#agSimSharedTopic", "gw")
        expect(
            p.locator('#agSimCatList-shared .ag-cat-row[data-value="return-route"]')
        ).to_be_visible()
        expect(
            p.locator('#agSimCatList-shared .ag-cat-row[data-value="ec-two-faults"]')
        ).to_be_hidden()
        # Arama konu süzgeciyle birlikte; ad, kimlik ve konu adında arar (Türkçe küçük harf).
        p.select_option("#agSimSharedTopic", "")
        p.fill("#agSimSharedSearch", "FHRP")
        fhrp = [r["id"] for r in RECIPES if r["id"].startswith("fhrp-")]
        expect(visible).to_have_count(len(fhrp))
        p.fill("#agSimSharedSearch", "böyle bir senaryo yok")
        expect(visible).to_have_count(0)
        p.fill("#agSimSharedSearch", "")
        expect(visible).to_have_count(len(RECIPES))

    def test_top_bar_check_hint_and_lock(self):
        p = self.page
        rid = "return-route"
        recipe = next(r for r in RECIPES if r["id"] == rid)
        self.load(rid)
        hint = p.locator("#agSimSharedHint")
        check = p.locator("#agSimSharedCheck")
        solution = p.locator("#agSimSolutionBtn")
        expect(hint).to_have_text("İpucu (%d)" % len(recipe["hints"]))
        expect(solution).to_be_visible()
        expect(solution).to_be_disabled()
        # Çözüm komutu kilit açılmadan DOM'da yok.
        fix = list(fix_commands(recipe))
        self.assertTrue(fix)
        self.assertNotIn(fix[0], self.page_text())
        # Kademeli ipucu: her basış bir sonraki ipucunu açar.
        hint.click()
        steps = p.locator("#agSimSharedHints li")
        expect(steps).to_have_count(1)
        expect(steps.first).to_contain_text(recipe["hints"][0])
        expect(hint).to_have_text("İpucu (%d)" % (len(recipe["hints"]) - 1))
        expect(p.locator("#agSimMeta")).to_contain_text("ipucu 1/%d" % len(recipe["hints"]))
        # Başarısız Kontrol et: durum nedeni söyler, sayaç artar; 3 başarısızdan sonra kilit açılır.
        for n in range(1, 4):
            check.click()
            expect(p.locator("#sharedScenarioStatus")).to_contain_text("Henüz çözülmedi")
            expect(p.locator("#agSimMeta")).to_contain_text("Başarısız kontrol: %d" % n)
        self.assertEqual(p.evaluate("aglabSimWorkspace.lock().unlocked"), True)
        expect(solution).to_be_enabled()
        self.assertFalse(p.locator("#sharedScenarioCause").evaluate("(d) => d.open"))
        solution.click()
        box = p.locator("#agSimSolution")
        expect(box).to_contain_text(fix[0])
        expect(box).to_contain_text(recipe["cause"])
        # Çözümü uygula: Kontrol et başarılı, kök neden açılır, katalogda tamamlandı.
        for block in recipe["solution"]:
            self.cli(block["device"], *block["commands"])
        check.click()
        expect(p.locator("#sharedScenarioStatus")).to_contain_text("BAŞARILI")
        self.assertTrue(p.locator("#sharedScenarioCause").evaluate("(d) => d.open"))
        expect(p.locator("#agSimMeta")).to_contain_text("Başarısız kontrol: 3")
        expect(
            p.locator('#agSimCatList-shared .ag-cat-row[data-value="%s"] .ag-cat-status' % rid)
        ).to_have_text("açık")
        self.assertTrue(
            p.evaluate(
                "JSON.parse(localStorage.getItem('aglab-shared-engine-progress-v1'))['%s'].completed"
                % rid
            )
        )

    def test_all_hints_unlock_solution(self):
        p = self.page
        rid = "nat-pat"
        recipe = next(r for r in RECIPES if r["id"] == rid)
        self.load(rid)
        hint = p.locator("#agSimSharedHint")
        for i in range(len(recipe["hints"])):
            expect(p.locator("#agSimSolutionBtn")).to_be_disabled()
            hint.click()
            expect(p.locator("#agSimSharedHints li")).to_have_count(i + 1)
        expect(hint).to_have_text("İpuçları açık")
        expect(hint).to_be_disabled()
        expect(p.locator("#agSimSolutionBtn")).to_be_enabled()
        self.assertEqual(p.locator("#agSimSolution").count(), 0)
        p.click("#agSimSolutionBtn")
        expect(p.locator("#agSimSolution")).to_contain_text(
            "ip nat inside source list 1 interface g0/1 overload"
        )
        # Başka bir hazır senaryo: ipuçları ve kilit o senaryonun kaydından başlar.
        self.load("stp-loop")
        expect(p.locator("#agSimSolution")).to_have_count(0)
        expect(p.locator("#agSimSolutionBtn")).to_be_disabled()
        expect(p.locator("#agSimSharedHints li")).to_have_count(0)

    OUTSIDE_JS = """async (ids) => {
        const out = [];
        for (const id of ids) {
          aglabSharedEngine.load(id);
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const svg = document.getElementById('ptCanvas'),
            a = svg.getBoundingClientRect(),
            c = svg.parentElement.getBoundingClientRect();
          const v = { l: Math.max(a.left, c.left), r: Math.min(a.right, c.right),
                      t: Math.max(a.top, c.top), b: Math.min(a.bottom, c.bottom) };
          const bad = [...svg.querySelectorAll('g.pt-node')]
            .map((g) => [g.querySelector('.pt-name')?.textContent, g.getBoundingClientRect()])
            .filter(([, r]) => r.left < v.l - 1 || r.right > v.r + 1 || r.top < v.t - 1 || r.bottom > v.b + 1)
            .map(([n]) => n);
          if (bad.length) out.push([id, bad]);
        }
        return out;
      }"""

    def test_canvas_fits_every_scenario(self):
        """Sığdırma bütün düğüm kutularını (yazılar dahil) kapsar: 116 senaryonun hepsinde her
        düğüm tuvalin görünür alanında. Aynı cihaz kimlikli (d1…dN) topolojiler art arda
        yüklenince eski görünüm kalmaz (sıra ve ters sıra); boş sayfadan statik rota senaryosu."""
        ids = [r["id"] for r in RECIPES]
        for width in (1024, 1280, 1920):
            with self.subTest(width=width):
                self.page.set_viewport_size({"width": width, "height": 900})
                self.assertEqual(self.page.evaluate(self.OUTSIDE_JS, ids), [])
                self.assertEqual(self.page.evaluate(self.OUTSIDE_JS, ids[::-1]), [])
        for rid in ("lpm-next-hop", "floating-static"):
            self.page.reload()
            self.page.click('[data-area="lab"]')
            self.assertEqual(self.page.evaluate(self.OUTSIDE_JS, [rid]), [], rid)

    def test_route_for_query(self):
        """Senaryo hedefinde `routeFor` (LabQuery): {prefix, nextHop, ad, source}."""
        p = self.page

        def check(field, expected):
            return p.evaluate(
                "(c) => aglabSharedEngine.queryCheck(c)",
                {
                    "fn": "routeFor",
                    "args": ["R1", "10.20.0.10"],
                    "field": field,
                    "expected": expected,
                },
            )

        self.load("floating-static")
        # Başta: asıl rotanın next-hop'u çözümlenemiyor, R1'de kullanılabilir rota yok.
        self.assertFalse(check("source", "S")["ok"])
        self.assertIn("şu an null", check("source", "S")["why"])
        recipe = next(r for r in RECIPES if r["id"] == "floating-static")
        for block in recipe["solution"]:
            self.cli(block["device"], *block["commands"])
        for field, expected in (
            ("source", "S"),
            ("ad", 5),
            ("nextHop", "10.0.0.2"),
            ("prefix", "10.20.0.0/24"),
        ):
            self.assertTrue(check(field, expected)["ok"], field)
        self.load("default-route")
        recipe = next(r for r in RECIPES if r["id"] == "default-route")
        self.assertFalse(check("source", "default")["ok"])
        for block in recipe["solution"]:
            self.cli(block["device"], *block["commands"])
        self.assertTrue(check("source", "default")["ok"])
        self.assertTrue(check("prefix", "0.0.0.0/0")["ok"])
        # İzinli olmayan sorgu hâlâ reddedilir.
        with self.assertRaises(Exception):
            p.evaluate("aglabSharedEngine.queryCheck({fn: 'routes', args: ['R1'], expected: 1})")

    def test_long_title_single_line(self):
        p = self.page
        p.set_viewport_size({"width": 1024, "height": 800})
        rid = max(RECIPES, key=lambda r: len(r["title"]))["id"]
        self.load(rid)
        title = p.locator("#agSimTitle")
        name = next(r["title"] for r in RECIPES if r["id"] == rid)
        expect(title).to_have_text("Simülatör · " + name)
        full = title.text_content()
        expect(title).to_have_attribute("title", full)
        # Tek satır: yükseklik bir satır kadar; taşan kısım üç noktayla kısalır.
        style = title.evaluate(
            "(t) => { const s = getComputedStyle(t); return [s.whiteSpace, s.textOverflow,"
            " t.getBoundingClientRect().height, parseFloat(s.lineHeight) || 20] }"
        )
        self.assertEqual(style[:2], ["nowrap", "ellipsis"])
        self.assertLess(style[2], style[3] * 1.5)
        p.set_viewport_size({"width": 700, "height": 800})
        self.assertTrue(title.evaluate("(t) => t.scrollWidth > t.clientWidth"))
        box = title.evaluate("(t) => t.getBoundingClientRect().height")
        self.assertLess(box, style[3] * 1.5)


if __name__ == "__main__":
    unittest.main()
