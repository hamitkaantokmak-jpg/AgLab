"""Seviye 1 dersleri (MUFREDAT.md konu şablonu): veri bütünlüğü, eşleme ve Öğren ekranı.

Her satır bir dersi tanımlar: uygulamadaki kimlik, belge, senaryo kimliği öneki ve ekranda
görünmesi beklenen iki ifade (kısa kart ve ayrıntılı ders). Senaryoların motorda başta
başarısız, çözümle başarılı olması `test_aglab_lesson_scenarios.py`'de sınanır.
"""

import json
import re
import unittest

from playwright.sync_api import sync_playwright

from aglab_test_support import ROOT, launch_chromium

COURSES = json.loads((ROOT / "src/data/courses.json").read_text(encoding="utf-8"))
DETAILS = json.loads((ROOT / "src/data/course-details.json").read_text(encoding="utf-8"))
RECIPES = json.loads((ROOT / "simulator/network-scenarios.json").read_text(encoding="utf-8"))
FLOW = (ROOT / "src/app/student-flow.js").read_text(encoding="utf-8")

# (kurs kimliği, ayrıntı kimliği, belge, senaryo öneki, kısa kartta, ayrıntıda)
LESSONS = [
    ("discovery", "discovery", "cdp-lldp.md", "cdp-", "LLDP", "çizimi olmayan ağı çıkarmak"),
    ("dhcp", "dhcp", "dhcp.md", "dhcp-", "169.254", "adres nereden gelir"),
    ("dns", "dns", "dns.md", "dns-", "nslookup", "isim yok"),
    ("routing", "routing", "gateway-statik-routing.md", "gw-", "floating static", "nasıl döner"),
    ("ip", "ipv4", "ip-adresleme.md", "ip-", "Hızlı hesap", "kim benim ağımda"),
    ("physical", "physical", "fiziksel-baglanti.md", "phy-", "İki uç kuralı", "port ne diyor"),
    ("method", "method", "sorun-giderme-yontemi.md", "method-", "Üç yaklaşım", "tek değişiklik"),
    ("vlan", "vlan", "vlan-trunk.md", "vlan-", "Okuma sırası", "Sahada: DTP ve VTP"),
    ("intervlan", "intervlan", "vlanlar-arasi-yonlendirme.md", "roas-", "Router-on-a-stick", "Üç kural"),
    ("devicemgmt", "devicemgmt", "cihaz-yonetimi.md", "mgmt-", "Yönetim adresi ve SSH", "İki yapılandırma"),
    # Seviye 2
    ("commands", "diagnostics", "teshis-araclari.md", "diag-", "Extended ping", "Paket yakalama"),
    ("acl", "acl", "acl.md", "acl-", "Wildcard ve sıra", "Sayaçlarla teşhis"),
    ("nat", "natpat", "nat-pat.md", "nat-", "PAT'ın üç parçası", "Tablo ve istatistikle teşhis"),
    ("ospf", "ospf", "ospf.md", "ospf-", "Komşuluk şartları", "Teşhis sırası"),
    ("stp", "stp", "stp.md", "stp-", "Port rolleri", "RSTP ve koruma"),
]
PARTS = [
    "## 1. Neden önemli",
    "## 2. Kavram",
    "## 3. Çıktı okuma",
    "## 4. Yönlendirmeli lab",
    "## 5. Sık hatalar",
    "## 6. Arıza senaryoları",
    "## 7. Kısa sınav",
    "## 8. Doğrulama notları",
]


LEGACY_ONE_STEP = {"nat-pat", "ospf-area", "stp-loop"}


class LevelOneLessonDataTests(unittest.TestCase):
    def test_ids_unique(self):
        for rows in (COURSES, DETAILS, RECIPES):
            ids = [r["id"] for r in rows]
            self.assertEqual(len(ids), len(set(ids)))

    def test_lessons_well_formed(self):
        for cid, did, doc, prefix, _, _ in LESSONS:
            with self.subTest(cid):
                course = next(c for c in COURSES if c["id"] == cid)
                self.assertEqual(len(course["quiz"]), 10)
                answers = set()
                for question, options, answer, explanation in course["quiz"]:
                    self.assertEqual(len(options), 4, question)
                    self.assertTrue(0 <= answer < 4 and explanation, question)
                    answers.add(answer)
                # Doğru cevap hep aynı sırada olmasın (seçenekler karıştırılmıyor).
                self.assertGreater(len(answers), 1)
                detail = next(d for d in DETAILS if d["id"] == did)
                for item in detail["quiz"]:
                    self.assertTrue(0 <= item["answer"] < len(item["options"]), item["q"])
                case = detail["case"]
                self.assertTrue(0 <= case["answer"] < len(case["choices"]))
                self.assertGreaterEqual(len(detail["pitfalls"]), 3)
                self.assertRegex(FLOW, r"'%s': \[[^\]]*'%s'" % (re.escape(cid), re.escape(did)))
                text = (ROOT / "docs/dersler" / doc).read_text(encoding="utf-8")
                for part in PARTS:
                    self.assertIn(part, text)

    def test_lesson_scenarios_follow_template(self):
        for _, _, doc, prefix, _, _ in LESSONS:
            # eski tek adımlı senaryolar (ping doğrulamalı ya da topolojisi uygulamada kurulan), şablon dışı
            rows = [r for r in RECIPES if r["id"].startswith(prefix) and r["id"] not in LEGACY_ONE_STEP]
            text = (ROOT / "docs/dersler" / doc).read_text(encoding="utf-8")
            with self.subTest(prefix):
                self.assertGreaterEqual(len(rows), 5)
                for r in rows:
                    self.assertIn("`" + r["id"] + "`", text, "belge senaryoyu anmalı")
                    for key in ("title", "symptom", "cause", "hints", "topology", "solution"):
                        self.assertTrue(r.get(key), (r["id"], key))
                    self.assertEqual(r["verify"]["kind"], "query", r["id"])
                    self.assertGreaterEqual(len(r["hints"]), 3, r["id"])


class LevelOneLessonUiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = launch_chromium(cls.pw)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def test_lessons_render_from_list(self):
        for cid, did, _, _, short_text, detail_text in LESSONS:
            course = next(c for c in COURSES if c["id"] == cid)
            with self.subTest(cid):
                page = self.browser.new_page(viewport={"width": 1280, "height": 960})
                errors = []
                page.on("pageerror", lambda e: errors.append(str(e)))
                page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
                page.locator("#sfList button", has_text=course["title"]).first.evaluate(
                    "b => b.click()"
                )
                sheet = page.locator("#sfSheet")
                self.assertIn(short_text, sheet.text_content())
                sheet.locator("button", has_text="Ayrıntılı öğren").evaluate("b => b.click()")
                page.wait_for_function(
                    "(t) => document.getElementById('sfSheet').textContent.includes(t)",
                    arg=detail_text,
                )
                page.close()
                self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()
