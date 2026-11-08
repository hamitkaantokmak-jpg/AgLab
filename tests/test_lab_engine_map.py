"""docs/LAB_MOTOR_HARITASI.md üretilmiş ve güncel: yapısal adaylık ve Labber köprüsü kararları.

Köprü kararları derlenmiş HTML'deki AgLabSim ile tarayıcıda (playwright) hesaplanır;
CI bu test üzerinden köprü kararının tabloyla eşleştiğini doğrular.
"""

import importlib.util, unittest
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium

spec = importlib.util.spec_from_file_location("labmap", ROOT / "tools/build_lab_engine_map.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class MapTests(unittest.TestCase):
    def test_map_is_derived_and_current(self):
        with sync_playwright() as pw:
            browser = launch_chromium(pw)
            text = m.render(browser)
            browser.close()
        self.assertEqual(
            text,
            (ROOT / "docs/LAB_MOTOR_HARITASI.md").read_text(encoding="utf-8"),
            "Tablo güncel değil: python tools/build_lab_engine_map.py",
        )
        self.assertEqual(sum(x.startswith("| AGL-") for x in text.splitlines()), 40)
        self.assertEqual(sum(x.startswith("| `") for x in text.splitlines()), 22)


if __name__ == "__main__":
    unittest.main()
