from pathlib import Path
from playwright.sync_api import sync_playwright
import json, re, tempfile
from aglab_test_support import ROOT, launch_chromium, import_topology

B = ROOT
topo = json.loads((B / "static-routing-two-routers.aglab.json").read_text())
r = next(d for d in topo["devices"] if d["name"] == "R1")
r["interfaces"]["g0/0.20"] = {
    "ip": "192.168.20.1",
    "mask": "255.255.255.0",
    "enabled": True,
    "parent": "g0/0",
    "vlan": 20,
    "encapsulation": "dot1q",
}
with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
    json.dump(topo, f)
    path = f.name
with sync_playwright() as p:
    b = launch_chromium(p, args=["--no-sandbox"])
    page = b.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.set_content((B / "AgLab_Final_PKT_Import.html").read_text(), wait_until="domcontentloaded")
    import_topology(page, path)

    def cmd(x):
        page.evaluate(
            """([id,cmd])=>{document.querySelector('#ptCliDevice').value=id;document.querySelector('#ptCliInput').value=cmd;document.querySelector('#ptCliForm').requestSubmit()}""",
            [r["id"], x],
        )
        return "\n".join(page.locator("#ptTerminal > div").all_text_contents())

    # I-1: içe aktarılan topoloji Labber'da; IOS `show ip interface brief` biçimi
    out = cmd("show ip interface brief")
    assert re.search(r"GigabitEthernet0/0\.20\s+192\.168\.20\.1\s+YES manual up\s+up", out), out[
        -1300:
    ]
    # parent shutdown => child cannot remain operational
    page.evaluate("""(id)=>{document.querySelector('#ptCliDevice').value=id}""", r["id"])
    for x in ["enable", "configure terminal", "interface g0/0", "shutdown", "end"]:
        cmd(x)
    out = cmd("show ip interface brief")
    # üst arayüz kapalı: alt arayüz çalışmaz (Labber "down down"; doğrulanmadı: IOS'ta alt
    # arayüz durum sütununun "administratively down" olup olmadığı — UYUMLULUK_MATRISI I-1)
    tail = out.split("show ip interface brief")[-1]
    assert re.search(
        r"GigabitEthernet0/0\.20\s+192\.168\.20\.1\s+YES manual (administratively )?down\s+down",
        tail,
    ), out[-1300:]
    assert not re.search(r"GigabitEthernet0/0\.20\s+\S+\s+YES manual up", tail), out[-1300:]
    assert not errors, errors
    b.close()
print("PASS: subinterface inherits parent link and shutdown")
