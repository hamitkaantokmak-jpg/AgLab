import json, re, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium, import_topology

B = ROOT
top = json.loads((B / "static-routing-two-routers.aglab.json").read_text())
with sync_playwright() as p:
    browser = launch_chromium(p, args=["--no-sandbox"])
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.set_content((B / "AgLab_Final_PKT_Import.html").read_text(), wait_until="domcontentloaded")

    def load(t):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(t, f)
            name = f.name
        import_topology(page, name)

    def cli(cmd):
        page.evaluate(
            """cmd=>{document.querySelector('#ptCliDevice').value='d1';document.querySelector('#ptCliInput').value=cmd;document.querySelector('#ptCliForm').requestSubmit()}""",
            cmd,
        )
        return "\n".join(page.locator("#ptTerminal > div").all_text_contents())

    load(top)
    # I-1: içe aktarılan topoloji Labber'da; IOS biçimi: "C  192.168.1.0/24 is directly connected"
    CONNECTED = re.compile(
        r"^C\s+192\.168\.1\.0/24 is directly connected, GigabitEthernet0/0", re.M
    )
    cli("enable")
    out = cli("show ip route")
    assert CONNECTED.search(out), out[-1500:]
    broken = json.loads(json.dumps(top))
    link = next(
        l
        for l in broken["links"]
        if (l["a"] == "d1" and l["portA"] == "g0/0") or (l["b"] == "d1" and l["portB"] == "g0/0")
    )
    link["up"] = False
    load(broken)
    cli("enable")
    out = cli("show ip route")
    assert not CONNECTED.search(out.split("show ip route")[-1]), out[-1500:]
    out = cli("show ip interface brief")
    assert re.search(
        r"GigabitEthernet0/0\s+192\.168\.1\.1\s+YES manual down\s+down",
        out.split("show ip interface brief")[-1],
    ), out[-1500:]
    assert not errors, errors
    browser.close()
print("PASS v11: connected route removed after link down, CLI status consistent")
