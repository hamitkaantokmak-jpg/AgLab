import json, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium, import_topology

B = ROOT
original = json.loads((B / "static-routing-two-routers.aglab.json").read_text())
with sync_playwright() as p:
    b = launch_chromium(p, args=["--no-sandbox"])
    page = b.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.set_content((B / "AgLab_Final_PKT_Import.html").read_text(), wait_until="domcontentloaded")

    def check(change, expected):
        t = json.loads(json.dumps(original))
        change(t)
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(t, f)
            path = f.name
        import_topology(page, path)
        page.evaluate(
            """()=>{document.querySelector('#ptCliDevice').value='d3';document.querySelector('#ptCliInput').value='ping 192.168.2.2';document.querySelector('#ptCliForm').requestSubmit()}"""
        )
        out = "\n".join(page.locator("#ptTerminal > div").all_text_contents()[-8:])
        assert expected in out, (expected, out[-1300:])

    # I-1: içe aktarılan topoloji Labber'da; PC terminali VPCS. Başarı: 5 yanıt; kaynakta ağ
    # geçidi yoksa VPCS "host (<hedef>) not reachable" der; hedefin ağ geçidi yoksa yanıt dönmez
    # (her istek zaman aşımı).
    check(lambda t: None, "84 bytes from 192.168.2.2 icmp_seq=5")
    check(
        lambda t: next(d for d in t["devices"] if d["id"] == "d3").update(gateway=""),
        "host (192.168.2.2) not reachable",
    )
    check(
        lambda t: next(d for d in t["devices"] if d["id"] == "d5").update(gateway=""),
        "192.168.2.2 icmp_seq=5 timeout",
    )
    assert not errors, errors
    b.close()
print("PASS: valid gateway, missing source gateway, missing destination gateway; JS errors 0")
