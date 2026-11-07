"""Build result must not depend on previous order of generated adapter blocks."""

import pathlib, re, shutil, subprocess, sys, tempfile, unittest, os, hashlib
from unittest.mock import patch
from aglab_test_support import ROOT
from verify_packages import build_release_manifest

TITLES = [
    "SIMULATION PLAYBACK",
    "BORCK ENGINE",
    "ENGINE MANAGER",
    "ENGINE MANAGER UI",
    "BORCK UI",
    "LAB EVIDENCE",
    "LAB EVIDENCE UI",
    "SIMULATION UI",
]


class BuildTests(unittest.TestCase):
    def test_device_hooks_are_generated_from_legacy_html(self):
        # Kaynak biçimlendirildiğinde de geçerli olsun diye kod parçaları boşluktan bağımsız aranır.
        text = re.sub(
            r"\s+", "", (ROOT / "AgLab_Final_PKT_Import.html").read_text(encoding="utf-8")
        )
        self.assertIn("deviceCliDragExceeded(ev,e,startX,startY)", text)
        self.assertNotIn("Math.abs(e.clientX-startX)+Math.abs(e.clientY-startY)>3", text)
        self.assertIn("selectDeviceCliHistory(d.id);if(ptCommandHistory", text)
        self.assertEqual(
            hashlib.sha256((ROOT / "AgLab_Final_PKT_Import.html").read_bytes()).hexdigest(),
            (ROOT / "html-build.sha256").read_text().split()[0],
        )

    def test_build_identity_is_explicit_and_bounded(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertIsNone(build_release_manifest(ROOT)["source_commit"])
        with patch.dict(os.environ, {"GITHUB_SHA": "a" * 40}, clear=True):
            self.assertEqual(build_release_manifest(ROOT)["source_commit"], "a" * 40)
        with patch.dict(os.environ, {"GITHUB_SHA": "invented"}, clear=True):
            self.assertRaises(ValueError, build_release_manifest, ROOT)

    def _copy_sources(self, folder):
        for name in ["src", "tools", "simulator", "academy"]:
            shutil.copytree(ROOT / name, folder / name)

    def test_build_is_independent_of_previous_html(self):
        """The HTML is a pure build output: a missing or corrupted copy rebuilds identically."""
        expected = (ROOT / "AgLab_Final_PKT_Import.html").read_bytes()
        with tempfile.TemporaryDirectory() as tmp:
            folder = pathlib.Path(tmp)
            self._copy_sources(folder)
            html = folder / "AgLab_Final_PKT_Import.html"
            subprocess.run([sys.executable, str(folder / "tools/build_html.py")], check=True)
            self.assertEqual(
                html.read_bytes(), expected, "Committed HTML differs from a clean source build"
            )
            html.write_text("stale", encoding="utf-8")
            self.assertNotEqual(
                subprocess.run(
                    [sys.executable, str(folder / "tools/build_html.py"), "--check"]
                ).returncode,
                0,
                "--check must reject a stale HTML",
            )
            subprocess.run([sys.executable, str(folder / "tools/build_html.py")], check=True)
            self.assertEqual(html.read_bytes(), expected, "Build depends on previous HTML content")
        text = expected.decode("utf-8")
        positions = [text.index("// BEGIN " + t + " GENERATED\n") for t in TITLES]
        self.assertEqual(positions, sorted(positions))


if __name__ == "__main__":
    unittest.main()
