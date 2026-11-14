"""Automated Chromium student journey; no claim of a human participant study."""

import json, os, tempfile, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium, import_topology

with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
    b = launch_chromium(pw)
    page = b.new_page(viewport={"width": 1400, "height": 1000})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
    page.click('[data-area="lab"]')
    page.click("#ux14Free")
    page.click("#uxMoreLabActions")
    # Start using the real delete/add controls, not an imported ready-made topology.
    initial = page.locator("#ptCanvas g[data-id]").count()
    for _ in range(initial):
        page.click("#ptDeleteDevice")
    assert page.locator("#ptCanvas g[data-id]").count() == 0
    for kind in ["PC", "PC", "Switch", "Switch"]:
        page.click('[data-pt-add="' + kind + '"]')
    devices = page.evaluate("academyEngine.snapshot().devices")
    pcs = [d for d in devices if d["type"] == "PC"]
    switches = [d for d in devices if d["type"] == "Switch"]

    def cable(a, b):
        page.select_option("#ptSource", a)
        page.select_option("#ptTarget", b)
        page.click("#ptMakeLink")

    cable(pcs[0]["id"], switches[0]["id"])
    cable(pcs[1]["id"], switches[1]["id"])
    cable(switches[0]["id"], switches[1]["id"])

    def cli(id, commands):
        page.locator('#ptCanvas g[data-id="' + id + '"]').click()
        out = []
        for text in commands:
            before = page.locator("#ptTerminal > div").count()
            page.fill("#ptCliInput", text)
            page.press("#ptCliInput", "Enter")
            out.extend(page.locator("#ptTerminal > div").all_text_contents()[before:])
        page.press("#ptCliInput", "Escape")
        return "\n".join(out)

    for i, pc in enumerate(pcs, 1):
        # I-1: düzenleyicideki topoloji Labber'da; PC terminali VPCS (`ip <adres> <maske>`)
        cli(pc["id"], [f"ip 10.0.0.{i} 255.255.255.0"])
    for sw in switches:
        cli(
            sw["id"],
            [
                "enable",
                "configure terminal",
                "vlan 10",
                "exit",
                "interface fa0/1",
                "switchport mode access",
                "switchport access vlan 10",
                "exit",
                "interface fa0/2",
                "switchport mode trunk",
                "switchport trunk allowed vlan 10,20",
                "end",
            ],
        )
    # VPCS ping: 5 adet "84 bytes from"
    assert cli(pcs[0]["id"], ["ping 10.0.0.2"]).count("84 bytes from 10.0.0.2") == 5
    # L7b: tek motor (Labber). Eski motor yöneticisinin "aglab-js"/"borck" seçimi ve borck'un
    # trunk reddi motorlarla birlikte kaldırıldı; FRR/Linux bridge ayrı Gerçek Lab olarak
    # aşağıda (rapor paneli ve operatör dışa aktarımı) sınanır.
    assert page.evaluate("([a,b])=>aglabSharedEngine.reach(a,b)", [pcs[0]["name"], pcs[1]["name"]])
    assert "trunk" in cli(switches[0]["id"], ["enable", "show interfaces trunk"])
    assert "10" in cli(switches[0]["id"], ["show vlan brief"])
    assert "DYNAMIC" in cli(switches[0]["id"], ["show mac address-table"])
    assert "Root" in cli(switches[0]["id"], ["show spanning-tree"])
    cli(
        switches[0]["id"],
        ["configure terminal", "interface fa0/2", "switchport trunk allowed vlan 20", "end"],
    )
    # VPCS ping açıklama yazmaz: yanıt yok, her istek zaman aşımı. VLAN teşhisi aşağıda Paket
    # Dedektifi'nden doğrulanır.
    failed = cli(pcs[0]["id"], ["ping 10.0.0.2"])
    assert "bytes from" not in failed and failed.count("timeout") == 5, failed
    page.click("#packetDetectiveRefresh")
    # Early preflight diagnostics are explicitly derived, not invented wire events.
    assert "VLAN" in page.locator("#packetDetectiveDiagnosis").inner_text()
    assert "paket yakalaması değildir" in page.locator("#packetDetectiveDiagnosis").inner_text()
    cli(
        switches[0]["id"],
        [
            "enable",
            "configure terminal",
            "interface fa0/2",
            "switchport trunk allowed vlan 10,20",
            "end",
        ],
    )
    assert cli(pcs[0]["id"], ["ping 10.0.0.2"]).count("84 bytes from 10.0.0.2") == 5
    page.click("#packetDetectiveRefresh")
    assert "Adım 1" in page.locator("#packetDetectiveStatus").inner_text()
    page.click("#ptSave")
    with page.expect_download() as download:
        page.click("#ptExport")
    exported = Path(tmp) / "student.json"
    download.value.save_as(str(exported))
    saved = json.loads(exported.read_text(encoding="utf-8"))
    assert len(saved["devices"]) == 4 and len(saved["links"]) == 3
    page.reload()
    page.click('[data-area="lab"]')
    page.click("#ux14Free")
    import_topology(page, exported)
    assert page.evaluate("([a,b])=>aglabSharedEngine.reach(a,b)", [pcs[0]["name"], pcs[1]["name"]])
    assert page.evaluate("academyEngine.snapshot().links.length") == 3
    # Karşılaştırma: MAC alanı hariç topoloji (operatör dosyası PC MAC'lerini açıkça yazar).
    state = (
        "JSON.stringify((({devices, links}) => ({devices: devices.map(({mac, ...d}) => d),"
        " links}))(academyEngine.snapshot()))"
    )
    baseline = page.evaluate(state)
    # Arayüz yenilemesi: Canlı Lab (eski adı Gerçek Lab) kendi bölümünde
    page.click('[data-area="live"]')
    page.locator("#realLabExport").evaluate("(d)=>d.open=true")
    with page.expect_download() as download:
        page.click("#realLabExportTopology")
    operator_file = Path(tmp) / "operator.json"
    download.value.save_as(str(operator_file))
    operator = json.loads(operator_file.read_text(encoding="utf-8"))
    assert operator["app"] == "AgLab" and operator["version"] == 23 and operator["selected"] == ""
    assert all("mac" not in d for d in operator["devices"] if d["type"] == "Switch")
    sys.path.insert(0, str(ROOT / "real-lab"))
    from shared_topology import convert

    # I-1: VPCS `ip <adres> <maske>` (ağ geçidisiz) PC'nin ağ geçidini sıfırlar (gerçek VPCS);
    # eski PC CLI'si eskisini bırakıyordu. Dönüştürücünün ağ geçidini açıkça reddetmesi yine
    # sınanır: ağ geçidi dışa aktarılan JSON'a konur.
    assert all(d["gateway"] == "" for d in operator["devices"] if d["type"] == "PC"), operator
    next(d for d in operator["devices"] if d["type"] == "PC")["gateway"] = "10.0.0.254"
    try:
        convert(operator)
    except ValueError as error:
        assert "Routing/configuration" in str(error)
    else:
        raise AssertionError("L2-only converter must reject the retained PC gateway")
    # Default PCs may retain an unrelated gateway after an address edit; reject it
    # explicitly instead of silently dropping it in an L2-only export.
    for d in operator["devices"]:
        if d["type"] == "PC":
            d["gateway"] = ""
    assert len(convert(operator)["nodes"]) == 4
    import_topology(page, operator_file)
    assert baseline == page.evaluate(state)
    report = {
        "kind": "routing",
        "engine": "FRRouting",
        "ok": True,
        "cleanup": True,
        "steps": [
            {
                "name": "OSPF report fixture <img src=bad onerror=alert(1)>",
                "ok": True,
                "evidence": {"route": {"protocol": "ospf"}},
            }
        ],
        "evidence": {},
    }
    report_file = Path(tmp) / "report.json"
    report_file.write_text(json.dumps(report), encoding="utf-8")
    page.locator("#nativeLabReport").set_input_files(str(report_file))
    page.wait_for_function(
        "document.querySelector('#nativeLabReportStatus').textContent.includes('imzası doğrulanmadı')"
    )
    page.locator("#nativeLabChecks").evaluate("(d)=>d.parentElement.open=true")
    assert "Beklenti karşılandı" in page.locator("#nativeLabChecks").inner_text()
    # rapor Simülatör'deki Paket Dedektifi'nde de "Canlı Lab" kaynağıyla görünür
    page.click('[data-area="lab"]')
    assert "Canlı Lab" in page.locator("#packetDetectiveStatus").inner_text()
    assert "paket olayı değil" in page.locator("#packetDetectiveExplanation").inner_text()
    assert page.locator('#packetDetectivePanel img[src="bad"]').count() == 0
    assert baseline == page.evaluate(state)
    report["execute"] = "shell"
    report_file.write_text(json.dumps(report), encoding="utf-8")
    page.locator("#nativeLabReport").set_input_files(str(report_file))
    page.wait_for_function(
        "document.querySelector('#nativeLabReportStatus').textContent.startsWith('Rapor açılmadı')"
    )
    assert not errors, errors
    out = Path(os.environ.get("AGLAB_TEST_ARTIFACT_DIR", ROOT / "dist"))
    out.mkdir(exist_ok=True, parents=True)
    (out / "advanced-student-journey.json").write_text(
        json.dumps(
            {
                "browser": "Chromium",
                "human_participants": False,
                "created_with_ui": True,
                "cabling": True,
                "vlan_trunk": True,
                "cli_fault_and_repair": True,
                "packet_trace_only_when_produced": True,
                "save_export_import": True,
                "single_engine": "labber",
                "frr_separate": True,
                "page_errors": errors,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    page.screenshot(path=str(out / "advanced-student-journey.png"))
    b.close()
print(
    "PASS UI device creation/cabling, CLI trunk fault/repair, single Labber engine, export/import"
)
