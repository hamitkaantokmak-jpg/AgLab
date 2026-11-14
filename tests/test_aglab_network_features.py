"""Common-engine scenarios, protocol withdrawal/AD, security, persistence and accessibility."""

import json
import os
import re
from pathlib import Path
import unittest
from playwright.sync_api import sync_playwright, expect

from aglab_test_support import ROOT, launch_chromium

OUT = Path(os.environ.get("AGLAB_TEST_ARTIFACT_DIR", ROOT / "dist"))
REPORT = {
    "scenarios": [],
    "accessibility": [],
    "scope": "Automated Chromium checks; no manual NVDA/VoiceOver speech test.",
}


class CommonEngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = launch_chromium(cls.pw)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / "network-scenario-results.json").write_text(
            json.dumps(REPORT, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        lines = ["# Ortak motor ve erişilebilirlik denetimi", "", REPORT["scope"], ""]
        lines += [
            f"- {'PASS' if r['ok'] else 'FAIL'} {r['id']}: {r['detail']}"
            for r in REPORT["scenarios"]
        ]
        lines += ["", "## Erişilebilirlik"] + [str(r) for r in REPORT["accessibility"]]
        (OUT / "network-audit.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    def setUp(self):
        self.context = self.browser.new_context(viewport={"width": 1280, "height": 960})
        self.page = self.context.new_page()
        self.page.emulate_media(reduced_motion="reduce")
        self.errors = []
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))
        self.page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
        self.page.click('[data-area="lab"]')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def run_js(self, js, arg=None):
        return self.page.evaluate(js, arg)

    def load(self, id):
        self.run_js("(id)=>aglabSharedEngine.load(id)", id)

    def command(self, name, commands):
        self.run_js(
            "([name,commands])=>aglabSharedEngine.commandBlock(name,commands)", [name, commands]
        )

    def solve(self, id):
        self.run_js(
            "(id)=>{for(const b of aglabSharedEngine.recipes().find(r=>r.id===id).solution)aglabSharedEngine.commandBlock(b.device,b.commands)}",
            id,
        )

    def probe(self):
        return self.run_js("aglabSharedEngine.probe()")

    def test_01_all_scenarios_fail_goal_then_solve_and_restore_academy(self):
        self.page.select_option("#academySelect", "AGL-005")
        self.page.click("#academyStart")
        if self.page.locator("#academyReplacePrompt").is_visible():
            self.page.click("#academyReplaceContinue")
        self.page.click("#academyHint")
        before = self.run_js("academyEngine.snapshot()")
        hints = self.page.locator("#academyHints").inner_text()
        REPORT["scenarios"] = self.run_js("aglabSharedEngine.validateScenarios()")
        self.assertGreaterEqual(len(REPORT["scenarios"]), 17)
        self.assertEqual(len(REPORT["scenarios"]), len(self.run_js("aglabSharedEngine.recipes()")))
        self.assertTrue(all(r["ok"] for r in REPORT["scenarios"]), REPORT["scenarios"])
        self.assertEqual(self.run_js("academyEngine.snapshot()"), before)
        self.assertEqual(self.page.locator("#academyHints").inner_text(), hints)
        # Arayüz yenilemesi: regresyon denetimi öğrencinin yolundan çıktı, "Gelişmiş" bölümünde
        self.page.click('[data-rail="advanced"]')
        self.page.click("#runRegressionAudit")
        expect(self.page.locator("#regressionAuditSummary")).to_contain_text("0 başarısız")

    def test_02_router_on_stick_strict_vlan_path(self):
        self.load("subif-missing")
        self.assertFalse(self.probe()["ok"])
        self.solve("subif-missing")
        self.assertTrue(self.probe()["ok"])
        # L7b: eski yol bulucu (strictPath) yerine Labber'ın Simulation Mode izi: VLAN'lar arası
        # paket router (d3) üzerinden geçer.
        wires = self.run_js(
            "() => { aglabWorkspace.pingTrace('d1', '192.168.20.20');"
            " return aglabLabberSession.trace().events.filter((e) => e.kind === 'wire')"
            ".map((e) => [e.edge.a, e.edge.b]) }"
        )
        self.assertTrue(any("d3" in w for w in wires), wires)
        self.command(
            "SW-01",
            [
                "enable",
                "configure terminal",
                "interface gi0/1",
                "switchport trunk allowed vlan 10",
                "end",
            ],
        )
        self.assertFalse(self.probe()["ok"])

    def test_03_ospf_reason_routes_mask_and_withdrawal(self):
        """L4: ospf-area Labber kararında (terminal, hedef ve OSPF Labber'da).

        Eski motorun Türkçe teşhis satırları ("area uyuşmazlığı", "maskesi uyuşmazlığı")
        yerine aynı arızalar Labber'ın türetilmiş OSPF durumundan (komşuluk uyuşmazlığı
        türü, FULL komşu, kurulu O rotası) ve IOS biçimli çıktıdan doğrulanır
        (UYUMLULUK_MATRISI: "OSPF teşhis metni").
        """
        self.load("ospf-area")
        self.assertTrue(self.run_js("aglabSharedEngine.engine()")["expressible"])
        self.assertFalse(self.probe()["ok"])
        self.assertIn("area", self.ospf("R2", "mismatches.map(m=>m.kind)"))
        self.command("R1", ["show ip ospf neighbor"])
        self.assertEqual(self.full_rows(), [])
        self.solve("ospf-area")
        self.assertTrue(self.probe()["ok"])
        self.assertEqual(self.ospf("R1", "nbrs.filter(n=>n.state==='FULL').length"), 1)
        routes = self.run_js(
            "()=>aglabLabberSession.query().routes(academyEngine.snapshot().devices.find(d=>d.name==='R1').id)"
        )
        self.assertTrue(
            any(r["code"] == "O" and r["net"] == "192.168.20.0" for r in routes), routes
        )
        self.command("R1", ["show ip route 192.168.20.20"])
        self.assertIn('Known via "ospf 1", distance 110', self.last_output())
        self.command(
            "R2",
            [
                "enable",
                "configure terminal",
                "interface g0/0",
                "ip address 10.0.12.2 255.255.255.0",
                "end",
            ],
        )
        self.assertFalse(self.probe()["ok"])
        routes = self.run_js(
            "()=>aglabLabberSession.query().routes(academyEngine.snapshot().devices.find(d=>d.name==='R1').id)"
        )
        self.assertFalse([r for r in routes if r["code"] == "O"], routes)
        self.assertIn("subnet", self.ospf("R2", "mismatches.map(m=>m.kind)"))
        self.command("R1", ["show ip ospf neighbor"])
        self.assertEqual(self.full_rows(), [])
        # komşuluğun düşüşü R1 konsoluna IOS syslog'u olarak yazılır
        self.assertIn("from FULL to DOWN", self.last_output())

    def full_rows(self):
        """`show ip ospf neighbor` tablosunda FULL durumundaki komşu satırları."""
        return re.findall(r"^\d+\.\d+\.\d+\.\d+\s+\d+\s+FULL.*$", self.last_output(), re.M)

    def ospf(self, name, expr):
        return self.run_js(
            "([n,e])=>new Function('s','return s.'+e)(aglabLabberSession.query().ospf(academyEngine.snapshot().devices.find(d=>d.name===n).id))",
            [name, expr],
        )

    def last_output(self):
        return self.page.locator("#ptTerminal").inner_text().split("show ip")[-1]

    # L7a: test_04 (BGP remote-as / AD) silindi. Yalnız eski motorda çalışan `bgp-as` senaryosunu
    # sınıyordu; BGP Labber'da modellenmez (kapsam dışı) ve kavramsal alıştırma olarak kaldı (L6).

    def test_05_port_security_modes_and_recovery(self):
        """L5-e: port-security Labber kararında; probe() kaynak PC'nin gerçek trafiğidir."""
        for mode in ["shutdown", "restrict", "protect"]:
            with self.subTest(mode=mode):
                self.load("port-security")
                self.command(
                    "SW-01",
                    [
                        "enable",
                        "configure terminal",
                        "interface fa0/1",
                        "switchport port-security violation " + mode,
                        "end",
                    ],
                )
                self.assertFalse(self.probe()["ok"])
                state = self.run_js(
                    "academyEngine.snapshot().devices.find(d=>d.name==='SW-01').interfaces['fa0/1']"
                )
                self.assertEqual(bool(state.get("errdisabled")), mode == "shutdown")
                if mode == "shutdown":
                    # L5-e (Labber, IOS): err-disabled portta tek başına `no shutdown` hata
                    # vermez ama portu kurtarmaz; önce shutdown gerekir. Eski motor burada hata
                    # satırı yazıyordu (UYUMLULUK_MATRISI "L5-e").
                    self.command(
                        "SW-01", ["enable", "configure terminal", "interface fa0/1", "no shutdown"]
                    )
                    state = self.run_js(
                        "academyEngine.snapshot().devices.find(d=>d.name==='SW-01').interfaces['fa0/1']"
                    )
                    self.assertTrue(state.get("errdisabled"))
                    self.assertFalse(self.probe()["ok"])
                self.solve("port-security")
                self.assertTrue(self.probe()["ok"])
        self.load("port-security")
        self.command(
            "SW-01",
            [
                "enable",
                "configure terminal",
                "interface fa0/1",
                "switchport port-security maximum 2",
                "end",
            ],
        )
        self.assertTrue(self.probe()["ok"])

    def test_06_round_trip_and_reject_unknown_nested_fields(self):
        for scenario in ["ospf-area", "port-security"]:
            self.load(scenario)
            self.solve(scenario)
            expected = self.run_js("academyEngine.snapshot()")
            self.page.reload()
            self.page.click('[data-area="lab"]')
            self.assertEqual(self.run_js("academyEngine.snapshot()"), expected)
            bad = json.loads(json.dumps(expected))
            device = next(
                d
                for d in bad["devices"]
                if d.get("ospf") or any(i.get("portSecurity") for i in d["interfaces"].values())
            )
            if "ospf" in device:
                device["ospf"]["unknown"] = True
            else:
                device["interfaces"]["fa0/1"]["portSecurity"]["unknown"] = True
            self.assertTrue(
                self.run_js(
                    "(t)=>{try{academyEngine.load(t);return false}catch(e){return true}}", bad
                )
            )
            self.assertEqual(self.run_js("academyEngine.snapshot()"), expected)

    def test_07_visible_navigation_keyboard_labels_and_contrast(self):
        self.page.click("#ux14Free")
        expect(self.page.locator("#sharedScenarioPanel")).to_be_visible()
        self.assertFalse(
            self.run_js(
                "(()=>{for(let e=document.getElementById('sharedScenarioPanel').parentElement;e;e=e.parentElement)if(e.tagName==='DETAILS'&&!e.open)return true;return false})()"
            )
        )
        self.page.click('[data-area="troubleshoot"]')
        self.page.locator("#sharedScenarioTroubleLink").focus()
        self.page.keyboard.press("Enter")
        expect(self.page.locator("#sharedScenarioSelect")).to_be_focused()
        self.page.keyboard.press("Tab")
        expect(self.page.locator("#sharedScenarioLoad")).to_be_focused()
        self.page.keyboard.press("Enter")
        self.assertEqual(self.page.locator("#sharedScenarioStatus").get_attribute("role"), "status")
        for theme in ["dark", "light"]:
            if self.page.locator("html").get_attribute("data-theme") != theme:
                self.page.locator("#themeToggle").focus()
                self.page.keyboard.press("Enter")
            # Arayüz PR 2: terminal alt şeritte hep açık; cihazda Enter komut satırına odaklanır
            # (yüzen #ptDeviceCliDialog yok).
            self.page.locator("#ptCanvas g[data-id]").first.focus()
            self.page.keyboard.press("Enter")
            expect(self.page.locator("#ptCliInput")).to_be_focused()
            issues = self.run_js(
                """()=>{const issues=[];for(const e of document.querySelectorAll('#area-lab input,#area-lab select')){if(!e.getClientRects().length||getComputedStyle(e).visibility==='hidden'||e.type==='file')continue;if(!e.labels?.length&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')&&!e.title)issues.push('Etiket yok: '+e.id)}return issues}"""
            )
            # WCAG 2.x relative luminance on critical controls, composing translucent ancestors.
            contrast = self.run_js(
                """()=>{const rgb=s=>(s.match(/[\\d.]+/g)||[]).map(Number),lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);return ['sharedScenarioSelect','sharedScenarioLoad','sharedScenarioStatus','ptCliInput','ptQuickCli','themeToggle'].map(id=>{const e=document.getElementById(id),fg=rgb(getComputedStyle(e).color);let bg=[255,255,255],chain=[];for(let p=e;p;p=p.parentElement)chain.unshift(p);for(const p of chain){const c=rgb(getComputedStyle(p).backgroundColor),a=c[3]??1;bg=bg.map((v,i)=>(c[i]||0)*a+v*(1-a))}const x=lum(fg),y=lum(bg);return {id,ratio:(Math.max(x,y)+.05)/(Math.min(x,y)+.05)}})}"""
            )
            issues += [
                "Kontrast " + c["id"] + ": " + str(round(c["ratio"], 2))
                for c in contrast
                if c["ratio"] < 4.5
            ]
            REPORT["accessibility"].append(
                {
                    "theme": theme,
                    "issues": issues,
                    "contrast": contrast,
                    "announcements": "sharedScenarioStatus role=status; dynamic text verified",
                }
            )
            self.assertEqual(issues, [])
        self.page.keyboard.press("Escape")
        self.page.click('[data-area="troubleshoot"]')
        # L6: eski metin senaryoları `TROUBLESHOOT_TASKS` (kimlik ve sıra aynı) Labber karşılığına
        # açılır. BGP Labber'da modellenmez (kapsam dışı): `bgp` motorsuz olduğu açıkça etiketli kavramsal alıştırmaya açılır.
        for legacy, shared in [
            ("ospf", "ospf-area"),
            ("portsec", "port-security"),
            ("subif", "subif-missing"),
        ]:
            self.page.click('[data-area="troubleshoot"]')
            index = self.run_js("(id)=>TROUBLESHOOT_TASKS.findIndex(s=>s.id===id)", legacy)
            self.page.locator(f'#scenarioList [data-s="{index}"]').click()
            expect(self.page.locator("#sharedScenarioSelect")).to_have_value(shared)
            expect(self.page.locator("#sharedScenarioPanel")).to_be_visible()
        self.page.click('[data-area="troubleshoot"]')
        index = self.run_js("(id)=>TROUBLESHOOT_TASKS.findIndex(s=>s.id===id)", "bgp")
        self.page.locator(f'#scenarioList [data-s="{index}"]').click()
        expect(self.page.locator("#conceptBadge")).to_contain_text("MOTOR YOK")

    def test_08_main_area_form_names_and_keyboard_focus(self):
        for theme in ["dark", "light"]:
            if self.page.locator("html").get_attribute("data-theme") != theme:
                self.page.locator("#themeToggle").focus()
                self.page.keyboard.press("Enter")
            for area in ["learn", "lab", "troubleshoot"]:
                button = self.page.locator(f'button[data-area="{area}"]')
                button.focus()
                self.page.keyboard.press("Enter")
                expect(button).to_have_attribute("aria-pressed", "true")
                self.run_js(
                    '(area)=>document.querySelectorAll("#area-"+area+" details").forEach(d=>d.open=true)',
                    area,
                )
                issues = self.run_js(r"""()=>{
     const issues=[];
     for(const e of document.querySelectorAll('input,select,textarea,button')){
      const s=getComputedStyle(e);
      if(!e.getClientRects().length||s.visibility==='hidden'||e.closest('details:not([open])')||e.type==='file'||e.disabled)continue;
      const labelled=(e.getAttribute('aria-label')||e.title||'').trim()||(e.getAttribute('aria-labelledby')||'').split(/\s+/).some(id=>document.getElementById(id)?.textContent.trim())||[...(e.labels||[])].some(label=>label.textContent.trim());
      const named=e.tagName==='BUTTON'?labelled||/[A-Za-z0-9À-ɏ]/.test(e.innerText):labelled;
      if(!named)issues.push('Erişilebilir ad yok: '+(e.id||e.outerHTML.slice(0,90)));
      if(e.tabIndex>0)issues.push('Pozitif tabindex: '+e.id);
     }
     return issues;
    }""")
                self.page.keyboard.press("Tab")
                self.assertTrue(self.run_js("document.activeElement!==document.body"))
                outline = self.run_js("getComputedStyle(document.activeElement).outlineStyle")
                issues += [] if outline not in ["none", "hidden"] else ["Klavye odağı görünmüyor"]
                REPORT["accessibility"].append(
                    {
                        "theme": theme,
                        "area": area,
                        "issues": issues,
                        "keyboard": "Enter navigation and Tab focus; names and tabindex checked",
                    }
                )
                self.assertEqual(issues, [])


if __name__ == "__main__":
    suite = unittest.main(exit=False)
    print("NETWORK_REPORT " + json.dumps(REPORT, ensure_ascii=False))
    raise SystemExit(0 if suite.result.wasSuccessful() else 1)
