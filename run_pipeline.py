#!/usr/bin/env python3
"""Portable AğLab test, quality gate, report and release pipeline.

Test listesi elle büyütülmez; tek bir manifest (``collect_checks``) üzerinden
keşfedilir:

* ``tests/test_*.py``      – Python/Playwright regresyonları (depo kökünde çalışır)
* ``tests/node/*.cjs``     – Node testleri ve kıyaslamalar
* ``real-lab/test_*.py``   – Gerçek Lab birim/smoke testleri (Docker gerektirmez)
* ``REAL_LAB_EXTRA``       – test_ adı taşımayan ek kontroller

Testler ortak ``tests/aglab_test_support.py`` yardımcılarını kullanır; sabit
``/mnt/data`` veya ``/usr/bin/chromium`` yolu yoktur, bu yüzden geçici bir kopya
dizine "staging" ve metin değiştirme yapılmaz.
"""

from __future__ import annotations

import argparse
import base64
import datetime
import json
import os
import pathlib
import shutil
import subprocess
import sys
import time
import zipfile
from dataclasses import dataclass

from verify_packages import build_release_manifest, verify_release_packages

ROOT = pathlib.Path(__file__).resolve().parent
ACADEMY_DOCS = [
    "AKADEMI.md",
    "academy/ADAPTATION.md",
    "academy/adaptation-audit.json",
    "docs/ENTEGRE_SURUM_RAPORU.md",
]

# Gerçek Lab kontrolleri arasında test_ adı taşımayanlar ve özel çalışma dizinleri.
REAL_LAB_EXTRA = ["real-lab/check_topology.py"]
REAL_LAB_CWD = {"real-lab/test_diagnostics.py": "real-lab"}

STUDENT_FILES = [
    "real-lab/student_api.py",
    "real-lab/export_student_snapshot.py",
    "real-lab/student_isolation_smoke.py",
    "real-lab/student_live_smoke.py",
    "real-lab/student.html",
    "real-lab/student.js",
    "real-lab/student.css",
]
REAL_LAB_FILES = [
    "real-lab/topology.clab.yml",
    "real-lab/r1/frr.conf",
    "real-lab/r2/frr.conf",
    "real-lab/README.md",
    "real-lab/manage.py",
    "real-lab/live_smoke.py",
    "real-lab/api.py",
    "real-lab/dashboard.html",
    "real-lab/diagnostics.py",
    *STUDENT_FILES,
    "real-lab/advanced_smoke.py",
    "real-lab/security_smoke.py",
    "real-lab/socket_peer.py",
    "real-lab/examples/security-topology.json",
    "real-lab/routed_topology.py",
    "real-lab/routed_smoke.py",
    "real-lab/examples/routed-2-routers.aglab.json",
    "real-lab/examples/routed-3-routers.aglab.json",
    "real-lab/shared_topology.py",
    "real-lab/shared_smoke.py",
    "real-lab/extended_routing.py",
    "real-lab/examples/shared-vlan10.aglab.json",
]
ARTIFACTS = [
    "AgLab_Final_PKT_Import.html",
    "html-build.sha256",
    "convert_pkt_to_aglab.py",
    "restore_pkt_from_aglab_json.py",
    "verify_packages.py",
    "run_pipeline.py",
    "static-routing-two-routers.aglab.json",
    "static-routing-two-routers-import-report.json",
    "AgLab_PKT_Import_Kullanim.md",
    "static-routing-two-routers(1).pkt",
    "pkt-sample-matrix.json",
    "PKT_ORNEK_MATRISI.md",
    "SIMULATOR_PLAN.md",
    "docs/SIMULATION_MODE_V1.md",
    "docs/ORTAK_MOTOR.md",
    "docs/LAB_MOTOR_HARITASI.md",
    "docs/ORTAK_GERCEK_LAB.md",
    "docs/GELISMIS_MOTOR_ENTEGRASYON.md",
    "docs/UYUMLULUK_MATRISI.md",
    "docs/HAZIR_MOTOR_ENTEGRASYON.md",
    # Simülatör modülleri (HTML'ye gömülür) ve Node test yardımcıları.
    "simulator/mac-address.js",
    "simulator/switch-management.js",
    "simulator/mac-learning.js",
    "simulator/ethernet-forwarding.js",
    "simulator/routing-path.js",
    "simulator/routed-ethernet.js",
    "simulator/icmp.js",
    "simulator/traceroute.js",
    "simulator/packet-events.js",
    "simulator/packet-detective-ui.js",
    "simulator/device-cli.js",
    "simulator/network-protocols.js",
    "simulator/port-security.js",
    "simulator/network-scenarios.js",
    "simulator/network-scenarios.json",
    "simulator/simulation-playback.js",
    "simulator/simulation-ui.js",
    "simulator/engine-adapter-prototype.cjs",
    "simulator/engine-manager.js",
    "simulator/engine-manager-ui.js",
    "simulator/lab-evidence.js",
    "simulator/lab-evidence-ui.js",
    "simulator/borck-adapter.ts",
    "simulator/borck-engine.generated.js",
    "simulator/borck-ui.js",
    "simulator/borck-fixtures.cjs",
    "simulator/borck-production-reference.cjs",
    # Derleme araçları ve yapılandırması.
    "build_simulator.py",
    "build_academy.py",
    "tools/build_html.py",
    "tools/build_lab_engine_map.py",
    "tools/build_borck_engine.cjs",
    "tools/build_sim.cjs",
    "tsconfig.sim.json",
    "package.json",
    "package-lock.json",
    "tests/aglab_test_support.py",
]
ARTIFACTS += [
    p.relative_to(ROOT).as_posix()
    for p in sorted((ROOT / "third_party/borck-netsim").rglob("*"))
    if p.is_file()
]
# HTML kaynak ağacı (HTML'nin kendisi derleme çıktısıdır).
ARTIFACTS += [
    p.relative_to(ROOT).as_posix() for p in sorted((ROOT / "src").rglob("*")) if p.is_file()
]

# Başarılı testlerin ürettiği ve ZIP'e eklenen kanıt dosyaları.
EVIDENCE = [
    "browser-engine-benchmark.json",
    "advanced-student-journey.json",
    "unified-rc-performance.json",
    "simulation-mode-results.json",
    "sim-performance.json",
]


@dataclass(frozen=True)
class Check:
    """Manifestteki tek bir kontrol."""

    path: str
    runner: str  # "python" | "node" | "vitest"
    cwd: str = "."
    browser: bool = False


def _uses_browser(path: pathlib.Path) -> bool:
    return "playwright" in path.read_text(encoding="utf-8")


def collect_checks(root: pathlib.Path = ROOT) -> list[Check]:
    """Tek test manifesti: dizinlerden keşfedilir, sıra deterministiktir."""
    checks: list[Check] = []
    for p in sorted((root / "tests").glob("test_*.py")):
        checks.append(Check(p.relative_to(root).as_posix(), "python", browser=_uses_browser(p)))
    for p in sorted((root / "tests/node").glob("*.cjs")):
        checks.append(Check(p.relative_to(root).as_posix(), "node"))
    # Labber motor testleri (TypeScript, vitest): tek grup olarak tests/sim/.
    if (root / "tests/sim").is_dir():
        checks.append(Check("tests/sim", "vitest"))
    real_lab = sorted(p.relative_to(root).as_posix() for p in (root / "real-lab").glob("test_*.py"))
    for rel in real_lab + REAL_LAB_EXTRA:
        checks.append(
            Check(rel, "python", cwd=REAL_LAB_CWD.get(rel, "."), browser=_uses_browser(root / rel))
        )
    return checks


def find_browser() -> str | None:
    """Playwright'ın Chromium'u; yoksa sistemdeki Chromium/Chrome."""
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as pw:
            candidate = pathlib.Path(pw.chromium.executable_path)
            if candidate.is_file():
                return str(candidate)
    except Exception:
        pass
    return (
        shutil.which("chromium")
        or shutil.which("chromium-browser")
        or shutil.which("google-chrome")
    )


def run_check(check: Check, env: dict, timeout: int, node: str | None) -> dict:
    if check.runner == "vitest":
        vitest = ROOT / "node_modules" / "vitest" / "vitest.mjs"
        if not node or not vitest.is_file():
            return {
                "name": check.path,
                "status": "FAIL",
                "error": "vitest bulunamadı; önce çalıştırın: npm ci --ignore-scripts",
            }
        command = [node, str(vitest), "run", "--root", check.path]
    elif check.runner == "node":
        if not node:
            return {"name": check.path, "status": "FAIL", "error": "Node.js bulunamadı."}
        command = [node, "--expose-gc", str(ROOT / check.path)]
    else:
        command = [sys.executable, str(ROOT / check.path)]
    started = time.monotonic()
    try:
        r = subprocess.run(
            command,
            cwd=ROOT / check.cwd,
            env=env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        return {"name": check.path, "status": "FAIL", "error": f"timed out after {timeout}s"}
    return {
        "name": check.path,
        "status": "PASS" if r.returncode == 0 else "FAIL",
        "duration_s": round(time.monotonic() - started, 2),
        "exit_code": r.returncode,
        "stdout": r.stdout[-8000:],
        "stderr": r.stderr[-8000:],
    }


def release_members(checks: list[Check]) -> list[str]:
    """ZIP'e girecek depo dosyaları (tekrarsız, sıralı)."""
    files: list[str] = []
    for c in checks:
        target = ROOT / c.path
        if target.is_dir():
            files += [
                p.relative_to(ROOT).as_posix()
                for p in sorted(target.rglob("*"))
                if p.is_file() and "node_modules" not in p.parts
            ]
        else:
            files.append(c.path)
    return list(dict.fromkeys(ARTIFACTS + files + REAL_LAB_FILES))


def run() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="dist")
    parser.add_argument("--skip-browser", action="store_true")
    parser.add_argument("--timeout", type=int, default=100)
    args = parser.parse_args()
    out = (ROOT / args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    # Offline HTML is a generated artifact. Refresh it from src/ + modules before testing.
    subprocess.run([sys.executable, str(ROOT / "tools/build_html.py")], cwd=ROOT, check=True)

    checks = collect_checks()
    browser = os.environ.get("AGLAB_CHROMIUM") or find_browser()
    report = {
        "date_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "browser": browser,
        "tests": [],
        "passed": False,
    }
    required = release_members(checks)
    missing = [f for f in required + ACADEMY_DOCS if not (ROOT / f).is_file()]
    if missing:
        report["error"] = "Missing files: " + ", ".join(missing)
    else:
        env = os.environ.copy()
        env["PYTHONPATH"] = str(ROOT) + os.pathsep + env.get("PYTHONPATH", "")
        env.update(PYTHONIOENCODING="utf-8", PYTHONUTF8="1", AGLAB_TEST_ARTIFACT_DIR=str(out))
        if browser:
            env["AGLAB_CHROMIUM"] = browser
        node = shutil.which("node")
        for check in checks:
            if check.browser and args.skip_browser:
                report["tests"].append({"name": check.path, "status": "SKIPPED"})
            elif check.browser and not browser:
                report["tests"].append(
                    {
                        "name": check.path,
                        "status": "FAIL",
                        "error": "Chromium bulunamadı. Çalıştırın: python -m playwright install chromium",
                    }
                )
            else:
                report["tests"].append(run_check(check, env, args.timeout, node))

    report["passed"] = (
        not missing
        and len(report["tests"]) == len(checks)
        and all(t["status"] == "PASS" for t in report["tests"])
    )
    (out / "test-results.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    lines = [
        "# AğLab otomatik test raporu",
        "",
        f"Tarih (UTC): {report['date_utc']}",
        f"Sonuç: {'BAŞARILI' if report['passed'] else 'BAŞARISIZ / DOĞRULANMADI'}",
        "",
    ]
    for t in report["tests"]:
        lines.append(f"- {t['status']}: {t['name']} ({t.get('duration_s', '?')} sn)")
    if report.get("error"):
        lines.append(report["error"])
    (out / "test-report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    student_zip = out / "AgLab_Otomatik_Dogrulanmis_Paket.zip"
    teacher_zip = out / "AgLab_Akademi_Ogretmen.zip"
    if report["passed"]:
        source = json.loads(
            (ROOT / "static-routing-two-routers.aglab.json").read_text(encoding="utf-8")
        )
        (out / "html-build-manifest.json").write_text(
            json.dumps(build_release_manifest(ROOT), indent=2), encoding="utf-8"
        )
        with zipfile.ZipFile(student_zip, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for f in required:
                z.write(ROOT / f, f)
            z.writestr(
                "decoded_source.xml", base64.b64decode(source["sourceArchive"]["decodedXmlBase64"])
            )
            for name in [
                "test-report.md",
                "test-results.json",
                "html-build-manifest.json",
                *EVIDENCE,
            ]:
                z.write(out / name, name)
            for f in sorted((ROOT / "academy/student").glob("*.json")):
                z.write(f, "academy/student/" + f.name)
            for name in ACADEMY_DOCS:
                z.write(ROOT / name, name)
        with zipfile.ZipFile(teacher_zip, "w", zipfile.ZIP_DEFLATED) as z:
            z.write(out / "html-build-manifest.json", "html-build-manifest.json")
            for folder in ["teacher", "source"]:
                for f in sorted((ROOT / "academy" / folder).glob("*.json")):
                    z.write(f, "academy/" + folder + "/" + f.name)
            for name in ACADEMY_DOCS:
                z.write(ROOT / name, name)
        try:
            package_result = verify_release_packages(student_zip, teacher_zip)
        except Exception as error:
            student_zip.unlink(missing_ok=True)
            teacher_zip.unlink(missing_ok=True)
            report["passed"] = False
            report["package_error"] = str(error)
            (out / "test-results.json").write_text(
                json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8"
            )
            lines[3] = "Sonuç: BAŞARISIZ / DOĞRULANMADI"
            (out / "test-report.md").write_text(
                "\n".join(lines) + "\n\nFAIL package verification: " + str(error) + "\n",
                encoding="utf-8",
            )
            print("FAIL package verification; no verified release retained:", error)
            return 1
        print("PASS package verification:", json.dumps(package_result, ensure_ascii=False))
        print("PASS: all tests; verified ZIP:", student_zip)
    else:
        student_zip.unlink(missing_ok=True)
        teacher_zip.unlink(missing_ok=True)
        print("FAIL: no verified release generated; see", out / "test-report.md")
    for t in report["tests"]:
        print(t["status"], t["name"])
        if t["status"] == "FAIL":
            print(t.get("error", ""), t.get("stdout", ""), t.get("stderr", ""))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(run())
