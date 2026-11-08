"""L0 kabul testi: Labber motoru (AgLabSim) çevrimdışı HTML'ye gömülü ama ürün onu çağırmıyor.

1. HTML'de `window.AgLabSim` tanımlı ve kaynak modülü birebir gömülü.
2. Test içinde tanımlanan küçük bir VLAN labı `createLab` ile kurulur; `LabQuery.ping`
   başta BAŞARISIZ (PC'lerin portları farklı VLAN'da), referans çözüm `runScript` ile
   uygulandıktan sonra BAŞARILI. Çözüm CLI hatası üretmez. Farklı VLAN'a erişim çözümden
   sonra da başarısız kalır.
3. Ürünün hiçbir akışı AgLabSim'e dokunmaz: sayfa yüklemesi, Lab (ortak senaryo + CLI
   ping), Sorun Çöz ve Akademi (lab başlatma + değerlendirme) boyunca, sayfa
   betiklerinden önce kurulan sayaçlı erişimci 0 kalır.
"""

import unittest

from playwright.sync_api import sync_playwright

from aglab_test_support import HTML, ROOT, launch_chromium

# Sayfa betiklerinden önce çalışır: `var AgLabSim = ...` ataması setter'a düşer; ürün
# kodunun global ada (getter) veya nesnenin özelliklerine (Proxy) her erişimi sayılır.
COUNTER = """
(() => {
  let real;
  let proxy;
  window.__aglabSimAccess = [];
  window.__aglabSimOwnAccess = false;
  const note = (what) => { if (!window.__aglabSimOwnAccess) window.__aglabSimAccess.push(what); };
  Object.defineProperty(window, 'AgLabSim', {
    configurable: true,
    get() { note('global'); return proxy; },
    set(value) {
      real = value;
      proxy = new Proxy(value, { get(t, k) { note(String(k)); return t[k]; } });
    },
  });
  window.__aglabSimReal = () => real;
})();
"""

# Küçük VLAN labı: SW1'e bağlı iki PC aynı alt ağda; PC2'nin portu başta VLAN 20'de.
LAB = """
({
  id: 'aglab-l0-vlan', title: 'L0 VLAN', summary: '', level: 'Başlangıç', tags: [], brief: [],
  view: { w: 400, h: 300 },
  devices: [
    { id: 'SW1', kind: 'switch', model: 'WS-C2960-24TT-L', mac: '5254.0001.0001',
      ports: ['FastEthernet0/1', 'FastEthernet0/2', 'FastEthernet0/3'], x: 200, y: 80 },
    { id: 'PC1', kind: 'pc', mac: '0050.7966.0001', x: 80, y: 220 },
    { id: 'PC2', kind: 'pc', mac: '0050.7966.0002', x: 200, y: 220 },
    { id: 'PC3', kind: 'pc', mac: '0050.7966.0003', x: 320, y: 220 },
  ],
  links: [
    { a: ['PC1', 'eth0'], b: ['SW1', 'FastEthernet0/1'] },
    { a: ['PC2', 'eth0'], b: ['SW1', 'FastEthernet0/2'] },
    { a: ['PC3', 'eth0'], b: ['SW1', 'FastEthernet0/3'] },
  ],
  initialConfig: { SW1: 'vlan 10\\nvlan 20\\ninterface fa0/1\\nswitchport mode access\\nswitchport access vlan 10\\ninterface fa0/2\\nswitchport mode access\\nswitchport access vlan 20\\ninterface fa0/3\\nswitchport mode access\\nswitchport access vlan 20' },
  initialPcs: {
    PC1: { ip: '192.168.10.11', prefix: 24, gw: null },
    PC2: { ip: '192.168.10.12', prefix: 24, gw: null },
    PC3: { ip: '192.168.10.13', prefix: 24, gw: null },
  },
  objectives: [],
  solution: { SW1: 'configure terminal\\ninterface fa0/2\\nswitchport access vlan 10\\nend' },
})
"""

RUN_LAB = (
    """() => {
  window.__aglabSimOwnAccess = true;
  try {
    const S = window.__aglabSimReal();
    const def = """
    + LAB
    + """;
    const rt = S.createLab(def);
    const q = () => new S.LabQuery(rt.derived, rt.startup);
    const before = q().ping('PC1', '192.168.10.12').ok;
    const out = S.runScript(rt, 'SW1', def.solution.SW1);
    const errors = out.filter((l) => /^% (Invalid|Incomplete|Ambiguous)/.test(l));
    const after = q().ping('PC1', '192.168.10.12').ok;
    const otherVlan = q().ping('PC1', '192.168.10.13').ok;
    const session = S.createSession(rt, 'PC1').constructor.name;
    return { api: Object.keys(S).sort(), before, after, otherVlan, errors, session };
  } finally {
    window.__aglabSimOwnAccess = false;
  }
}"""
)


class SimEmbeddedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = launch_chromium(cls.pw)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={"width": 1280, "height": 960})
        self.context.add_init_script(COUNTER)
        self.page = self.context.new_page()
        self.errors = []
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))
        self.page.goto(HTML.as_uri())

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def accesses(self):
        return self.page.evaluate("window.__aglabSimAccess.slice()")

    def test_module_is_embedded_verbatim(self):
        source = (ROOT / "src/sim.generated.js").read_text(encoding="utf-8")
        html = HTML.read_text(encoding="utf-8")
        self.assertIn("// BEGIN SIM GENERATED\n" + source + "\n// END SIM GENERATED\n", html)
        self.assertTrue(self.page.evaluate("typeof window.__aglabSimReal() === 'object'"))

    def test_lab_fails_before_and_passes_after_solution(self):
        result = self.page.evaluate(RUN_LAB)
        # L0 motor API'si + L1 köprüsü (toLabber/toAglab/createRuntime ve yardımcıları).
        self.assertEqual(
            result["api"],
            [
                "BridgeError",
                "LabQuery",
                "MODEL_L2",
                "MODEL_L3",
                "canonPort",
                "createLab",
                "createRuntime",
                "createSession",
                "needsEncapFor",
                "runScript",
                "toAglab",
                "toLabber",
            ],
        )
        self.assertFalse(result["before"], "farklı VLAN'daki PC başta erişememeli")
        self.assertEqual(result["errors"], [], "referans çözüm CLI hatası üretmemeli")
        self.assertTrue(result["after"], "çözümden sonra aynı VLAN'da ping başarılı olmalı")
        self.assertFalse(result["otherVlan"], "VLAN 20'deki PC'ye erişim kapalı kalmalı")
        self.assertEqual(result["session"], "VpcsSession")
        self.assertEqual(self.accesses(), [], "testin kendi erişimi sayılmamalı")

    def test_product_flows_never_touch_aglabsim(self):
        page = self.page
        self.assertEqual(self.accesses(), [], "sayfa yüklemesi")
        # Lab: ortak motor senaryosu ve CLI ping
        page.click('[data-area="lab"]')
        page.evaluate("aglabSharedEngine.load('vlan-wrong-access')")
        page.evaluate("aglabSharedEngine.reach('PC-01','PC-02')")
        self.assertEqual(self.accesses(), [], "Lab")
        # Sorun Çöz ve Öğren alanları
        page.click('[data-area="troubleshoot"]')
        page.click('[data-area="learn"]')
        self.assertEqual(self.accesses(), [], "Sorun Çöz / Öğren")
        # Akademi: lab başlat ve değerlendir
        page.click('[data-area="lab"]')
        page.select_option("#academySelect", "AGL-022")
        page.click("#academyStart")
        if page.locator("#academyReplacePrompt").is_visible():
            page.click("#academyReplaceContinue")
        page.evaluate("academy.check()")
        self.assertEqual(self.accesses(), [], "Akademi")


if __name__ == "__main__":
    unittest.main()
