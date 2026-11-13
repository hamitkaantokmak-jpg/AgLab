import json, re, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium, import_topology

B = ROOT
base = json.loads((B / "static-routing-two-routers.aglab.json").read_text())
with sync_playwright() as p:
    browser = launch_chromium(p, args=["--no-sandbox"])
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.set_content((B / "AgLab_Final_PKT_Import.html").read_text(), wait_until="domcontentloaded")

    def run(top, device, target):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(top, f)
            name = f.name
        import_topology(page, name)
        page.evaluate(
            """a=>{document.querySelector('#ptCliDevice').value=a[0];document.querySelector('#ptCliInput').value='ping '+a[1];document.querySelector('#ptCliForm').requestSubmit()}""",
            [device, target],
        )
        return "\n".join(page.locator("#ptTerminal > div").all_text_contents())

    # I-1: içe aktarılan topoloji Labber'da. Router IOS ping'i: ilk istekte ARP çözülürken ilk
    # paket kaybolabilir (".!!!!", %80) — gerçek IOS.
    good = run(base, "d1", "192.168.2.2")
    assert re.search(r"Success rate is (80|100) percent", good[-400:]), good[-1300:]
    no_route = json.loads(json.dumps(base))
    next(d for d in no_route["devices"] if d["id"] == "d1")["staticRoutes"] = []
    out = run(no_route, "d1", "192.168.2.2")
    # rota yok: router hiçbir şey gönderemez ("....." %0)
    assert "Success rate is 0 percent (0/5)" in out[-400:], out[-1500:]
    no_return = json.loads(json.dumps(base))
    next(d for d in no_return["devices"] if d["id"] == "d2")["staticRoutes"] = []
    out = run(no_return, "d3", "10.0.0.2")
    # R2'nin dönüş rotası yok: PC'nin (VPCS) istekleri zaman aşımına düşer
    assert "10.0.0.2 icmp_seq=5 timeout" in out[-600:] and "bytes from" not in out[-600:], out[
        -1500:
    ]
    assert not errors, errors
    browser.close()
print(
    "PASS v13: router-origin valid route, missing forward route, missing router return route, JS errors 0"
)
