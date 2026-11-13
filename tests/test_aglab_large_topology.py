"""300-device ring: latency budget, STP convergence after edits and size limits."""

import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

from aglab_test_support import ROOT, launch_chromium, assert_vpcs_ping

N = 298
BUDGET_MS = 1000
obj = {"app": "AgLab", "version": 23, "devices": [], "links": [], "nextId": 301}
for index in range(N):
    switch = {
        "id": f"d{index+1}",
        "name": f"SW-{index}",
        "type": "Switch",
        "x": 60 + index % 10 * 70,
        "y": 60 + index // 10 * 30,
        "w": 112,
        "h": 72,
        "enabled": True,
        "vlans": [1, 77],
        "ports": ["fa0/1", "fa0/2", "gi0/1", "gi0/2"],
        "interfaces": {},
    }
    for port in switch["ports"]:
        switch["interfaces"][port] = {
            "mode": "trunk" if port.startswith("gi") else "access",
            "vlan": 77,
            "allowed": [77],
            "enabled": True,
        }
    obj["devices"].append(switch)
    for endpoint in (range(1) if index in (0, N // 2) else range(0)):
        number = 1 if index == 0 else 2
        host = {
            "id": f"d{N+number}",
            "name": f"PC-{number}",
            "type": "PC",
            "x": switch["x"],
            "y": switch["y"] + 10,
            "w": 104,
            "h": 72,
            "ip": f"10.0.0.{number}",
            "mask": "255.255.255.0",
            "gateway": "",
            "vlan": 77,
            "enabled": True,
            "ports": ["eth0"],
            "interfaces": {"eth0": {"enabled": True}},
        }
        obj["devices"].append(host)
        obj["links"].append(
            {
                "a": switch["id"],
                "b": host["id"],
                "portA": f"fa0/{endpoint+1}",
                "portB": "eth0",
                "up": True,
            }
        )
    obj["links"].append(
        {
            "a": switch["id"],
            "b": f"d{(index+1)%N+1}",
            "portA": "gi0/1",
            "portB": "gi0/2",
            "up": True,
        }
    )

with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
    browser = launch_chromium(pw)
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
    file = Path(tmp) / "large.json"
    file.write_text(json.dumps(obj))
    page.locator("#ptImportFile").set_input_files(str(file))
    page.wait_for_function(
        "document.querySelector('#ptCanvasStatus').textContent.includes('300 cihaz')"
    )
    assert page.locator("#ptCanvas .pt-node").count() == 300

    def command(device, text):
        before = page.locator("#ptTerminal").inner_text()
        elapsed = page.evaluate(
            """([id, text]) => {
            document.querySelector('#ptCliDevice').value = id;
            document.querySelector('#ptCliInput').value = text;
            const start = performance.now();
            document.querySelector('#ptCliForm').requestSubmit();
            return performance.now() - start;
        }""",
            [device, text],
        )
        return page.locator("#ptTerminal").inner_text()[len(before) :], elapsed

    timings = []

    def ping(ok):
        output, elapsed = command("d299", "ping 10.0.0.2")
        # I-1: topoloji Labber'da; PC terminali VPCS
        assert_vpcs_ping(output, "10.0.0.2", ok)
        timings.append(round(elapsed, 2))
        print("ping_ms", timings[-1], "expected_success", ok, flush=True)
        assert elapsed < BUDGET_MS, f"300-device ping exceeded {BUDGET_MS} ms: {elapsed:.1f}"

    ping(True)
    for text in ["enable", "configure terminal", "interface gi0/1", "shutdown", "end"]:
        command("d1", text)
    ping(True)  # remaining ring path must carry traffic
    for text in ["configure terminal", "interface gi0/2", "shutdown", "end"]:
        command("d1", text)
    ping(False)
    for text in ["configure terminal", "interface gi0/1", "no shutdown", "end"]:
        command("d1", text)
    ping(True)

    # Both public size limits reject input without replacing the active topology.
    too_many_devices = json.loads(json.dumps(obj))
    extra = json.loads(json.dumps(obj["devices"][-1]))
    extra["id"] = "d301"
    too_many_devices["devices"].append(extra)
    too_many_links = json.loads(json.dumps(obj))
    too_many_links["links"] = [obj["links"][0]] * 1001
    for invalid in (too_many_devices, too_many_links):
        previous = page.evaluate("localStorage.getItem('aglab-topology-v23')")
        before = page.locator("#ptTerminal").inner_text()
        file.write_text(json.dumps(invalid))
        page.locator("#ptImportFile").set_input_files(str(file))
        page.wait_for_function(
            "before => document.querySelector('#ptTerminal').innerText.length > before",
            arg=len(before),
        )
        output = page.locator("#ptTerminal").inner_text()[len(before) :]
        assert "Topoloji sınırı aşıldı" in output, output
        assert page.locator("#ptCanvas .pt-node").count() == 300
        assert page.evaluate("localStorage.getItem('aglab-topology-v23')") == previous
    assert not errors, errors
    browser.close()
print("PASS: 300 devices, 300 links; ring failover/isolation/recovery; timings_ms", timings)
