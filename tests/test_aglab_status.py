from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium, import_topology

B = ROOT
with sync_playwright() as p:
    b = launch_chromium(p, args=["--no-sandbox"])
    page = b.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.set_content((B / "AgLab_Final_PKT_Import.html").read_text(), wait_until="domcontentloaded")
    import_topology(page, B / "static-routing-two-routers.aglab.json")

    def command(device, cmd):
        page.evaluate(
            """([device,cmd])=>{document.querySelector('#ptCliDevice').value=device;document.querySelector('#ptCliInput').value=cmd;document.querySelector('#ptCliForm').requestSubmit()}""",
            [device, cmd],
        )
        return page.locator("#ptTerminal").inner_text()

    # Find a connected router port and an unused port from imported topology
    import json

    topo = json.loads((B / "static-routing-two-routers.aglab.json").read_text())
    r = next(d for d in topo["devices"] if d["name"] == "R1")
    print("Router", r["id"], list(r["interfaces"]))
    out = command(r["id"], "show ip interface brief")
    print(out[-1100:])
    assert "g0/0            192.168.1.1     up     up" in out
    assert "g0/2            unassigned      administratively down     down" in out
    # Reimport a topology with the cable administratively disabled in the link model.
    import tempfile

    broken = json.loads((B / "static-routing-two-routers.aglab.json").read_text())
    link = next(
        l
        for l in broken["links"]
        if (l["a"] == "d1" and l["portA"] == "g0/0") or (l["b"] == "d1" and l["portB"] == "g0/0")
    )
    print("link keys", link.keys())
    link["up"] = False
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(broken, f)
        broken_path = f.name
    import_topology(page, broken_path)
    out = command(r["id"], "show ip interface brief")
    assert "g0/0            192.168.1.1     down     down" in out, out[-900:]
    assert not errors, errors
    b.close()
print("PASS: interface brief distinguishes down from up")
