"""Validate the single offline release archive (Academy content, sources and build identity).

Arayüz yenilemesi PR 1: öğrenci/öğretmen ayrımı kalktı; tek paket üretilir. Öğretmen çözümleri
(`academy/teacher/`) ve kaynaklar (`academy/source/`) aynı ZIP'tedir. HTML'e yalnız öğrenci
alanları gömülür; çözümlerle yapılan 100/100 kontrolleri testlerde kalır."""

import hashlib, json, os, re, sys, zipfile

EMBEDDED_SOURCES = {
    "SIM": "src/sim.generated.js",
    "SIMULATION PLAYBACK": "simulator/simulation-playback.js",
    "SIMULATION UI": "simulator/simulation-ui.js",
    "PACKET TRACE": "simulator/packet-trace.js",
    "AGLAB MODEL": "simulator/aglab-model.js",
    "DEVICE CLI": "simulator/device-cli.js",
    "LAB EVIDENCE": "simulator/lab-evidence.js",
    "LAB EVIDENCE UI": "simulator/lab-evidence-ui.js",
    "PACKET EVENTS": "simulator/packet-events.js",
    "PACKET DETECTIVE UI": "simulator/packet-detective-ui.js",
}


def build_release_manifest(root):
    commit = os.environ.get("GITHUB_SHA") or os.environ.get("AGLAB_SOURCE_COMMIT")
    if commit is not None and not re.fullmatch("[0-9a-f]{40}", commit):
        raise ValueError("Invalid source commit identity")
    return {
        "format": "aglab-offline-build-v1",
        "source_commit": commit,
        "source_identity": (
            "CI checkout"
            if os.environ.get("GITHUB_SHA")
            else "operator supplied" if commit else "unverified local build"
        ),
        "html_sha256": hashlib.sha256(
            (root / "AgLab_Final_PKT_Import.html").read_bytes()
        ).hexdigest(),
        "sources": {
            p: hashlib.sha256((root / p).read_bytes()).hexdigest()
            for p in EMBEDDED_SOURCES.values()
        },
    }


def verify_release_packages(package_path):
    ids = {f"AGL-{i:03d}" for i in range(1, 41)}
    docs = {
        "AKADEMI.md",
        "academy/ADAPTATION.md",
        "academy/adaptation-audit.json",
        "docs/ENTEGRE_SURUM_RAPORU.md",
    }

    def read_json(archive, name):
        return json.loads(archive.read(name).decode("utf-8"))

    with zipfile.ZipFile(package_path) as student:
        teacher = student
        names = student.namelist()
        assert len(names) == len(set(names)), "Duplicate ZIP entry"
        assert student.testzip() is None, "ZIP CRC failure"
        assert docs <= set(names), "Missing Academy documentation: " + str(docs - set(names))
        audit = read_json(student, "academy/adaptation-audit.json")
        assert (
            len(audit) == 40 and {row["id"] for row in audit} == ids
        ), "Incomplete adaptation audit"
        student_names = teacher_names = set(names)
        assert {
            "docs/UYUMLULUK_MATRISI.md",
            "docs/GELISMIS_MOTOR_ENTEGRASYON.md",
            "real-lab/advanced_smoke.py",
        } <= student_names, "Missing advanced motor documentation/runner"
        assert {
            "real-lab/routed_topology.py",
            "real-lab/routed_smoke.py",
            "real-lab/test_routed_topology.py",
            "real-lab/test_routed_smoke.py",
            "real-lab/examples/routed-2-routers.aglab.json",
            "real-lab/examples/routed-3-routers.aglab.json",
        } <= student_names, "Missing routed lab converter/examples/tests"
        assert {
            "real-lab/security_smoke.py",
            "real-lab/socket_peer.py",
            "real-lab/test_security_smoke.py",
            "real-lab/examples/security-topology.json",
        } <= student_names, "Missing native security lab dependencies"
        assert {
            "tests/test_aglab_unified_rc.py",
            "tests/test_aglab_unified_performance.py",
            "unified-rc-performance.json",
        } <= student_names, "Missing unified RC evidence/tests"
        assert "tests/aglab_test_support.py" in student_names, "Missing shared test fixture"
        assert {
            n for n in student_names if n.startswith("academy/student/") and n.endswith(".json")
        } == {f"academy/student/{i}.json" for i in ids}, "Student lab inventory mismatch"
        assert {
            n for n in teacher_names if n.startswith("academy/teacher/") and n.endswith(".json")
        } == {f"academy/teacher/{i}.json" for i in ids}, "Teacher lab inventory mismatch"
        assert {
            n for n in teacher_names if n.startswith("academy/source/") and n.endswith(".json")
        } == {f"academy/source/{i}.json" for i in ids} | {
            "academy/source/SHA256.json"
        }, "Source inventory mismatch"
        hashes = read_json(teacher, "academy/source/SHA256.json")
        assert set(hashes) == {i + ".json" for i in ids}, "Source hash inventory mismatch"
        html = student.read("AgLab_Final_PKT_Import.html").decode("utf-8")
        manifest = read_json(student, "html-build-manifest.json")
        replay = read_json(student, "simulation-mode-results.json")
        assert (
            replay["passed"] and not replay["page_errors"] and replay["browser"] == "Chromium"
        ), "Simulation Mode verification missing/failed"
        assert len(replay["performance"]) == 8 and {g["lab"] for g in replay["academy"]} == {
            "AGL-001",
            "AGL-005",
        }, "Incomplete Simulation Mode scenarios"
        assert all(
            g["grade"].startswith("100/100") for g in replay["academy"]
        ), "Simulation changed Academy outcome"
        assert (
            replay["animation"]["topology_nodes_removed_during_playback"] == 0
            and replay["animation"]["overlay_layers"] == 1
        ), "Unexpected SVG replay redraw"
        assert (
            student.read("html-build.sha256").decode().split()[0] == manifest["html_sha256"]
        ), "Unexpected compiled HTML identity"
        assert manifest.get("source_commit") is None or re.fullmatch(
            "[0-9a-f]{40}", manifest["source_commit"]
        ), "Invalid build commit"
        assert (
            manifest["html_sha256"]
            == hashlib.sha256(student.read("AgLab_Final_PKT_Import.html")).hexdigest()
        ), "HTML build digest mismatch"
        assert set(manifest["sources"]) == set(
            EMBEDDED_SOURCES.values()
        ), "Build source inventory mismatch"
        for title, source in EMBEDDED_SOURCES.items():
            data = student.read(source)
            assert hashlib.sha256(data).hexdigest() == manifest["sources"][source], (
                "Build source digest mismatch: " + source
            )
            generated = (
                "// BEGIN "
                + title
                + " GENERATED\n"
                + data.decode("utf-8").replace("\r\n", "\n")
                + "\n// END "
                + title
                + " GENERATED\n"
            )
            assert generated in html, "Stale/missing embedded module: " + source
        assert (
            "teacher_solution" not in html and "target_topology" not in html
        ), "Teacher fields embedded in HTML (solutions stay in academy/teacher/)"
        match = re.search(r"^const academyLabs = (.+);\r?$", html, re.MULTILINE)
        assert match, "Embedded Academy data missing"
        embedded = json.loads(match.group(1))
        assert (
            len(embedded) == 40 and {lab["id"] for lab in embedded} == ids
        ), "Embedded lab inventory mismatch"
        embedded = {lab["id"]: lab for lab in embedded}
        for lid in sorted(ids):
            raw = teacher.read(f"academy/source/{lid}.json")
            assert hashlib.sha256(raw).hexdigest() == hashes[lid + ".json"], (
                "Source SHA256 mismatch: " + lid
            )
            source = json.loads(raw.decode("utf-8"))
            learner = read_json(student, f"academy/student/{lid}.json")
            assert not {"teacher_solution", "target_topology"} & learner.keys(), (
                "Teacher fields in student JSON: " + lid
            )
            for key, value in source.items():
                if key not in ["teacher_solution", "target_topology"]:
                    assert learner.get(key) == value, "Source/student mismatch: " + lid + "/" + key
            assert embedded[lid] == learner, "HTML/student JSON mismatch: " + lid
            solution = read_json(teacher, f"academy/teacher/{lid}.json")
            assert solution == {
                key: source[key] for key in ["id", "target_topology", "teacher_solution"]
            }, ("Teacher/source mismatch: " + lid)
    return {
        "labs": 40,
        "source_hashes": 40,
        "single_package": True,
        "documentation": True,
    }


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python verify_packages.py AgLab_Otomatik_Dogrulanmis_Paket.zip")
    print(json.dumps(verify_release_packages(sys.argv[1]), ensure_ascii=False))
