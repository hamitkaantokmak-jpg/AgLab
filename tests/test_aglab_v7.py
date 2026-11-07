from pathlib import Path
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
    assert "Arayüz IP adresi kaldırıldı." in out
    out = run(pc, ["ip address 10.9.0.2 255.0.255.0"])
    assert "geçerli subnet maskesi" in out
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
    assert "VLAN listesi eksik" in out
    assert not errors, errors
    b.close()
print("PASS v7 3 CLI checks + zero page errors")
