from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import HTML, launch_chromium

h = HTML.read_text()
with sync_playwright() as p:
    b = launch_chromium(p, args=["--no-sandbox"])
    page = b.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.set_content(h, wait_until="domcontentloaded")
    for ip in ["999.1.2.3", "192.168.1", "hello", "-1.0.0.1"]:
        page.evaluate(
            "ip=>{document.querySelector('#ptCliInput').value='ping '+ip;document.querySelector('#ptCliForm').requestSubmit()}",
            ip,
        )
        # I-1: varsayılan çalışma alanı Labber'da; seçili PC'nin terminali VPCS. VPCS geçerli
        # IPv4 olmayan hedefi ad sayar ve çözemez: "Cannot resolve <hedef>" (gerçek VPCS), paket
        # gönderilmez ve satır hata olarak işaretlenir.
        result = page.locator("#ptTerminal").inner_text()
        assert "Cannot resolve " + ip in result, (ip, result[-500:])
        assert "bytes from" not in result.split("ping " + ip)[-1], (ip, result[-500:])
        last = page.locator("#ptTerminal > div").last
        assert "outerr" in (last.get_attribute("class") or ""), (ip, last.inner_text())
    assert not errors, errors
    b.close()
print("PASS v17: invalid IPv4 ping targets rejected in Chromium (Labber VPCS)")
