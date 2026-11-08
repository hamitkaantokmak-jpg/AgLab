"""Offline full UI/CLI versus real vendored NetSim; default engine/grades preserved."""

import json, os, subprocess, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium

topology = json.loads(
    subprocess.check_output(
        [
            "node",
            "-e",
            "let t=require('./simulator/borck-fixtures.cjs').fixture(); t.devices.forEach((d,i)=>Object.assign(d,{x:100+i*130,y:150,w:112,h:72})); console.log(JSON.stringify({app:'AgLab',version:23,...t,nextId:5}))",
        ],
        cwd=ROOT,
        text=True,
    )
)
with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
    b = launch_chromium(pw)
    page = b.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
    page.click('[data-area="lab"]')

    def load(t):
        f = Path(tmp) / "network.json"
        f.write_text(json.dumps(t), encoding="utf-8")
        page.locator("#ptImportFile").set_input_files(str(f))
        # İçe aktarma asenkron (await file.text()); işleyici bitince alanı boşaltır.
        # Sabit bekleme CI yükünde yetmiyordu (ping topoloji yüklenmeden gidiyordu).
        page.wait_for_function("document.querySelector('#ptImportFile').value === ''")

    def cmd(device, text):
        before = page.locator("#ptTerminal > div").count()
        page.evaluate(
            "([id,text])=>{document.querySelector('#ptCliDevice').value=id;document.querySelector('#ptCliInput').value=text;document.querySelector('#ptCliForm').requestSubmit()}",
            [device, text],
        )
        return "\n".join(page.locator("#ptTerminal > div").all_text_contents()[before:])

    load(topology)
    baseline = page.evaluate("JSON.stringify(aglabBorckComparison.capture())")
    assert "100 percent" in cmd("p0", "ping 10.0.0.2")
    actual = page.evaluate("aglabBorckComparison.compare('p0','p1')")
    assert actual["supported"] and actual["ok"] and len(actual["events"]) == 12, actual
    assert actual["arp"]["p0"][0]["ip"] == "10.0.0.2"
    assert len(actual["mac"]["s0"]) == 2
    assert baseline == page.evaluate("JSON.stringify(aglabBorckComparison.capture())")
    page.select_option("#ptSource", "p0")
    page.select_option("#ptTarget", "p1")
    page.locator("#borckCompare").evaluate("(el)=>el.parentElement.open=true")
    page.click("#borckCompare")
    page.click("#borckDetective")
    assert "Michael Borck NetSim" in page.locator("#packetDetectiveStatus").inner_text()
    assert "arp-wire" in page.locator("#packetDetectiveRaw").inner_text()
    page.click("#packetDetectiveNext")
    assert "Adım 2" in page.locator("#packetDetectiveStatus").inner_text()
    page.click("#packetDetectiveRefresh")
    assert "AğLab simülasyon motoru" in page.locator("#packetDetectiveStatus").inner_text()
    # Existing Cisco-like CLI changes shared config; the next third-party run sees it.
    for command in ["enable", "conf t", "interface fa0/2", "shutdown"]:
        cmd("s1", command)
    assert not page.evaluate("aglabBorckComparison.compare('p0','p1')")["ok"]
    cmd("s1", "no shutdown")
    assert page.evaluate("aglabBorckComparison.compare('p0','p1')")["ok"]
    for command in ["switchport access vlan 20"]:
        cmd("s1", command)
    assert not page.evaluate("aglabBorckComparison.compare('p0','p1')")["ok"]
    cmd("s1", "switchport access vlan 10")
    cmd("s1", "switchport mode trunk")
    refused = page.evaluate("aglabBorckComparison.compare('p0','p1')")
    assert not refused["supported"] and any("trunk" in r for r in refused["reasons"])
    # Actual inter-switch trunk still pings in the original engine.
    trunk = json.loads(json.dumps(topology))
    for d in trunk["devices"][2:]:
        d["interfaces"]["uplink"] = {
            "mode": "trunk",
            "allowed": [10, 20],
            "nativeVlan": 1,
            "enabled": True,
        }
    load(trunk)
    assert not page.evaluate("aglabBorckComparison.compare('p0','p1')")["supported"]
    assert "100 percent" in cmd("p0", "ping 10.0.0.2")
    for mode in ["isolation", "cable", "wrong_gateway"]:
        t = json.loads(json.dumps(topology))
        if mode == "isolation":
            t["devices"][3]["interfaces"]["fa0/2"]["vlan"] = 20
        elif mode == "cable":
            t["links"].pop()
        else:
            t["devices"][1]["ip"] = "192.168.20.2"
            t["devices"][0]["gateway"] = "10.0.0.254"
            t["devices"][1]["gateway"] = "192.168.20.254"
        load(t)
        ip = t["devices"][1]["ip"]
        assert "100 percent" not in cmd("p0", "ping " + ip), mode
        r = page.evaluate("aglabBorckComparison.compare('p0','p1')")
        assert r["supported"] and not r["ok"], (mode, r)
    assert not errors, errors
    out = Path(os.environ.get("AGLAB_TEST_ARTIFACT_DIR", ROOT / "dist"))
    out.mkdir(parents=True, exist_ok=True)
    (out / "borck-ui-results.json").write_text(
        json.dumps(
            {
                "upstream_commit": actual["engine"]["commit"],
                "success": True,
                "arp": True,
                "mac_learning": True,
                "real_wire_events": 12,
                "cli_config_seen": True,
                "vlan_isolation": True,
                "cable_failure": True,
                "wrong_gateway": True,
                "trunk_explicitly_unsupported": True,
                "topology_unchanged": True,
                "page_errors": errors,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    b.close()
print(
    "PASS real third-party engine offline UI, CLI config, negative cases, detective, default-engine preservation"
)
