"""Arayüz PR 3: Simülatör geniş çalışma alanı (Genişlet / Daralt).

Genişken çalışma alanı pencereyi kaplar: üst gezinme, ikon şeridi ve Görev seç kataloğu gizlenir;
tuval ortada büyür, altta terminal + Simulation şeridi görünür kalır. Görev (hedefler) ve İnceleme
daraltılabilir yan şerittir. Üst çubuk düğmeleri erişilebilir kalır. Esc ve Alt+Shift+F;
seçim, yan şeritler ve terminal yüksekliği tarayıcıda hatırlanır; tuval yeni boyuta sığdırılır.
Ekran görüntüleri: test-results/arayuz-genis/genis-{1280,1920}-{light,dark}.png (commit'lenmez).
"""

import os
import unittest

from playwright.sync_api import expect, sync_playwright

from aglab_test_support import HTML, ROOT, launch_chromium

SHOTS = ROOT / "test-results/arayuz-genis"

NODES_INSIDE = """() => {
  const svg = document.getElementById('ptCanvas'),
    a = svg.getBoundingClientRect(), c = svg.parentElement.getBoundingClientRect();
  const l = Math.max(a.left, c.left), r = Math.min(a.right, c.right),
    t = Math.max(a.top, c.top), b = Math.min(a.bottom, c.bottom);
  return [...svg.querySelectorAll('g.pt-node')].filter((g) => {
    const x = g.getBoundingClientRect();
    return x.left < l - 1 || x.right > r + 1 || x.top < t - 1 || x.bottom > b + 1;
  }).map((g) => g.querySelector('.pt-name')?.textContent);
}"""


def in_view(page, sel):
    return page.locator(sel).evaluate(
        "(e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 &&"
        " r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 }"
    )


class SimWideTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = launch_chromium(cls.pw)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def open(self, width=1280, height=800, theme=None):
        page = self.browser.new_page(viewport={"width": width, "height": height})
        self.errors = []
        page.on("pageerror", lambda e: self.errors.append(str(e)))
        page.goto(HTML.as_uri())
        page.evaluate("localStorage.clear()")
        if theme:
            page.evaluate("(t) => localStorage.setItem('aglab-theme', t)", theme)
        page.reload()
        page.click('[data-area="lab"]')
        return page

    def labber_lab(self, page):
        lab = page.evaluate("aglabLabberLabs.list()[0].id")
        page.select_option("#labberLabSelect", lab)
        page.click("#labberLabStart")
        expect(page.locator("#agSimGoals li").first).to_be_attached()

    def tearDown(self):
        self.assertEqual(self.errors, [])

    def test_wide_toggle_strips_escape_and_memory(self):
        p = self.open()
        self.labber_lab(p)
        wide = p.locator("#agSimWide")
        expect(wide).to_have_attribute("aria-pressed", "false")
        self.assertIn("Genişlet", wide.get_attribute("aria-label"))
        box_before = p.evaluate("document.getElementById('ptCanvas').getBoundingClientRect().width")
        wide.click()
        expect(wide).to_have_attribute("aria-pressed", "true")
        self.assertIn("Daralt", wide.get_attribute("aria-label"))
        # Gezinme, ikon şeridi ve katalog gizli; tuval, terminal ve Simulation şeridi görünür.
        for sel in ("#agTop", "#agRail", "#agSimCatalog"):
            expect(p.locator(sel)).to_be_hidden()
        for sel in ("#ptCanvas", "#ptCliInput", "#simulationMode", "#agSimDock"):
            self.assertTrue(in_view(p, sel), sel)
        # Üst çubuk denetimleri erişilebilir.
        for sel in (
            "#labberLabCheck",
            "#agSimLabberHint",
            "#agSimLabberReset",
            "#agSimSolutionBtn",
        ):
            self.assertTrue(in_view(p, sel), sel)
        # Tuval büyür ve yeni boyuta sığdırılır.
        p.wait_for_timeout(200)
        box_after = p.evaluate("document.getElementById('ptCanvas').getBoundingClientRect().width")
        self.assertGreater(box_after, box_before + 150)
        self.assertEqual(p.evaluate(NODES_INSIDE), [])
        # Yan şeritler kapalı: hedefler görünmez; ikonla açılır.
        expect(p.locator("#agSimGoals")).to_be_hidden()
        expect(p.locator("#agSimTaskToggle")).to_have_attribute("aria-expanded", "false")
        p.click("#agSimTaskToggle")
        expect(p.locator("#agSimGoals")).to_be_visible()
        expect(p.locator("#agSimTaskToggle")).to_have_attribute("aria-expanded", "true")
        expect(p.locator("#agSimPane-port")).to_be_hidden()
        p.click("#agSimInspectToggle")
        expect(p.locator("#agSimPane-port")).to_be_visible()
        self.assertEqual(p.evaluate(NODES_INSIDE), [])
        # Seçim hatırlanır (yenileme sonrası da geniş, şeritler açık).
        p.reload()
        p.click('[data-area="lab"]') if p.locator("#agTop").is_visible() else None
        expect(p.locator("html")).to_have_class("ag-wide")
        expect(p.locator("#agSimTaskToggle")).to_have_attribute("aria-expanded", "true")
        # Esc dar görünüme döner.
        p.keyboard.press("Escape")
        expect(p.locator("html")).not_to_have_class("ag-wide")
        for sel in ("#agTop", "#agRail", "#agSimCatalog"):
            expect(p.locator(sel)).to_be_visible()
        self.assertEqual(p.evaluate("aglabSimWorkspace.wide().wide"), False)
        # Kısayol Alt+Shift+F; başka bölümde geniş görünüm uygulanmaz.
        p.keyboard.press("Alt+Shift+KeyF")
        expect(p.locator("html")).to_have_class("ag-wide")
        p.evaluate("location.hash = '#mufredat'")
        expect(p.locator("#agTop")).to_be_visible()
        expect(p.locator("html")).not_to_have_class("ag-wide")
        p.evaluate("location.hash = '#simulator'")
        expect(p.locator("html")).to_have_class("ag-wide")
        p.close()

    def test_dock_height_drag(self):
        p = self.open()
        p.evaluate("aglabSharedEngine.load('lpm-next-hop')")
        p.click("#agSimWide")
        grip = p.locator("#agSimDockGrip")
        dock = lambda: p.evaluate(
            "document.getElementById('agSimDock').getBoundingClientRect().height"
        )
        stage = lambda: p.evaluate(
            "document.getElementById('agSimStage').getBoundingClientRect().height"
        )
        h0, s0 = dock(), stage()
        g = grip.bounding_box()
        x, y = g["x"] + g["width"] / 2, g["y"] + g["height"] / 2
        p.mouse.move(x, y)
        p.mouse.down()
        p.mouse.move(x, y - 120, steps=6)
        p.mouse.up()
        p.wait_for_timeout(200)
        self.assertAlmostEqual(dock(), h0 + 120, delta=3)
        self.assertAlmostEqual(stage(), s0 - 120, delta=3)
        self.assertEqual(p.evaluate(NODES_INSIDE), [])
        # Klavye: ↓ 24 px; yükseklik hatırlanır.
        grip.focus()
        p.keyboard.press("ArrowDown")
        self.assertAlmostEqual(dock(), h0 + 96, delta=3)
        p.reload()
        self.assertAlmostEqual(dock(), h0 + 96, delta=3)
        self.assertEqual(grip.get_attribute("role"), "separator")
        p.close()

    def test_screenshots(self):
        SHOTS.mkdir(parents=True, exist_ok=True)
        for width, height in ((1280, 800), (1920, 1080)):
            for theme in ("light", "dark"):
                with self.subTest(width=width, theme=theme):
                    p = self.open(width, height, theme)
                    self.labber_lab(p)
                    p.click("#agSimWide")
                    p.click("#agSimTaskToggle")
                    if width >= 1920:
                        p.click("#agSimInspectToggle")
                    p.wait_for_timeout(300)
                    self.assertEqual(p.evaluate(NODES_INSIDE), [])
                    self.assertTrue(in_view(p, "#ptCliInput"))
                    if (
                        os.environ.get("AGLAB_UPDATE_SHOTS")
                        or not (SHOTS / f"genis-{width}-{theme}.png").exists()
                    ):
                        p.screenshot(path=str(SHOTS / f"genis-{width}-{theme}.png"))
                    p.close()


if __name__ == "__main__":
    unittest.main()
