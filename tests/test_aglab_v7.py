from pathlib import Path
import re
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium

B = ROOT
with sync_playwright() as p:
    b = launch_chromium(p, args=["--no-sandbox"])
    page = b.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.set_content((B / "AgLab_Final_PKT_Import.html").read_text(), wait_until="domcontentloaded")

    def run(device, commands):
        page.evaluate(
            """([d,cmds])=>{document.querySelector('#ptCliDevice').value=d;for(const c of cmds){document.querySelector('#ptCliInput').value=c;document.querySelector('#ptCliForm').requestSubmit()}}""",
            [device, commands],
        )
        return page.locator("#ptTerminal").inner_text()

    devices = page.evaluate(
        """()=>[...document.querySelector('#ptCliDevice').options].map(o=>({value:o.value,text:o.textContent}))"""
    )
    print("devices", devices[:12])
    router = next(x["value"] for x in devices if "Router" in x["text"])
    pc = next(x["value"] for x in devices if "PC-01" in x["text"])
    sw = next(x["value"] for x in devices if "SW-01" in x["text"])
    out = run(
        router,
        [
            "enable",
            "conf t",
            "interface g0/0",
            "ip address 10.9.0.1 255.255.255.0",
            "no ip address",
            "end",
            "show ip interface brief",
        ],
    )
    # I-1: varsayılan çalışma alanı Labber'da. IOS `no ip address` sonrası bilgi satırı yazmaz;
    # `show ip interface brief` arayüzü "unassigned … unset" gösterir.
    assert re.search(r"GigabitEthernet0/0\s+unassigned\s+YES unset", out), out[-1500:]
    # PC terminali VPCS: `ip <adres> <maske>`; bitişik olmayan maske reddedilir (Invalid netmask)
    out = run(pc, ["ip 10.9.0.2 255.0.255.0"])
    assert "Invalid netmask" in out, out[-500:]
    out = run(
        sw,
        [
            "enable",
            "conf t",
            "interface fa0/1",
            "switchport mode trunk",
            "switchport trunk allowed vlan add",
        ],
    )
    # IOS: liste verilmeyen `allowed vlan add` eksik komuttur
    assert "% Incomplete command." in out, out[-500:]
    assert not errors, errors
    b.close()
print("PASS v7 3 CLI checks + zero page errors")
