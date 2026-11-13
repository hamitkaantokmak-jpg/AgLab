from pathlib import Path
import json
import re
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium, import_topology

B = ROOT
with sync_playwright() as p:
    b = launch_chromium(p, args=["--no-sandbox"])
    page = b.new_page(viewport={"width": 1440, "height": 1000})
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.set_content((B / "AgLab_Final_PKT_Import.html").read_text(), wait_until="domcontentloaded")
    import_topology(page, B / "static-routing-two-routers.aglab.json")

    def cmd(c):
        page.evaluate(
            "document.querySelector('#ptCliDevice').value='d7';document.querySelector('#ptCliInput').value="
            + json.dumps(c)
            + ";document.querySelector('#ptCliForm').requestSubmit()"
        )
        page.wait_for_timeout(25)
        return page.locator("#ptTerminal").inner_text()

    for c in [
        "enable",
        "configure terminal",
        "interface fa0/3",
        "switchport mode trunk",
        "switchport trunk allowed vlan 1,10-12",
        "switchport trunk allowed vlan add 20",
        "switchport trunk allowed vlan remove 11",
    ]:
        out = cmd(c)
    # I-1: içe aktarılan topoloji Labber'da. IOS yapılandırma kipinde geri bildirim yazmaz
    # (eski motorun "Allowed VLANs:" satırı yok); izinli liste `show interfaces <if> switchport`
    # çıktısındaki "Trunking VLANs Enabled" satırından okunur.
    out = cmd("do show interfaces fa0/3 switchport")
    assert "Trunking VLANs Enabled: 1,10,12,20" in out, out[-2000:]
    cmd("exit")
    # Trunk izinli listesi VLAN oluşturmaz: `show vlan brief`'te 10/11/12/20 satırı yok
    before = page.locator("#ptTerminal > div").count()
    cmd("do show vlan brief")
    rows = page.locator("#ptTerminal > div").all_text_contents()[before:]
    assert any(re.match(r"1\s+default", r) for r in rows), rows
    assert not any(re.match(r"(10|11|12|20)\s", r) for r in rows), rows
    out = cmd("do show running-config")
    assert "switchport trunk allowed vlan 1,10,12,20" in out, out[-2000:]
    cmd("configure terminal")
    cmd("interface fa0/3")
    cmd("switchport trunk allowed vlan none")
    # IOS: boş izinli liste `show interfaces … switchport`'ta "NONE"
    out = cmd("do show interfaces fa0/3 switchport")
    assert "Trunking VLANs Enabled: NONE" in out, out[-1000:]
    cmd("switchport trunk allowed vlan 1")
    cmd("exit")
    out = cmd("do show running-config")
    assert "switchport trunk allowed vlan 1" in out, out[-2000:]
    assert "switchport trunk allowed vlan 1," not in out.split("FastEthernet0/3")[1][:300], out[
        -2000:
    ]
    assert not errs, errs
    b.close()
print("PASS: trunk VLAN list set/range/add/remove/running-config; browser errors=0")
