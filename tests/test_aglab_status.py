from pathlib import Path
import re
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
        return "\n".join(page.locator("#ptTerminal > div").all_text_contents())

    # Find a connected router port and an unused port from imported topology
    import json

    topo = json.loads((B / "static-routing-two-routers.aglab.json").read_text())
    r = next(d for d in topo["devices"] if d["name"] == "R1")
    print("Router", r["id"], list(r["interfaces"]))
    out = command(r["id"], "show ip interface brief")
    print(out[-1100:])
    # I-1: içe aktarılan topoloji Labber'da; IOS `show ip interface brief` biçimi
    assert re.search(r"GigabitEthernet0/0\s+192\.168\.1\.1\s+YES manual up\s+up", out), out[-900:]
    assert re.search(
        r"GigabitEthernet0/2\s+unassigned\s+YES unset\s+administratively down down", out
    ), out[-900:]
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
    assert re.search(
        r"GigabitEthernet0/0\s+192\.168\.1\.1\s+YES manual down\s+down",
        out.split("show ip interface brief")[-1],
    ), out[-900:]
    assert not errors, errors
    b.close()
print("PASS: interface brief distinguishes down from up")
