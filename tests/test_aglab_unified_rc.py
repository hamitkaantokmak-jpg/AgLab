"""Unified student guide: actual controls, network failures, reviewed trace and saved bytes."""

import json, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from aglab_test_support import ROOT, launch_chromium

with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
    browser = launch_chromium(pw)
    page = browser.new_page(viewport={"width": 1280, "height": 960})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
    page.click('[data-area="lab"]')
    before = page.evaluate("academyEngine.snapshot()")
    for lab, label in [
        ("AGL-024", "Linux bridge doğrulaması"),
        ("AGL-034", "FRRouting doğrulaması"),
        ("AGL-035", "FRRouting doğrulaması"),
        ("AGL-001", "gerçek ortam doğrulaması yapılmadı"),
    ]:
        page.select_option("#academySelect", lab)
        expect(page.locator("#academyEngineScope")).to_contain_text(label)
        assert page.evaluate("academyEngine.snapshot()") == before
    page.locator("#academyStart").focus()
    page.keyboard.press("Enter")
    expect(page.locator("#academyReplacePrompt")).to_be_visible()
    expect(page.locator("#academyReplaceCancel")).to_be_focused()
    page.keyboard.press("Enter")
    expect(page.locator("#academyReplacePrompt")).to_be_hidden()
    assert page.evaluate("academyEngine.snapshot()") == before
    expect(page.locator("#academyStart")).to_be_focused()
    page.click("#ux14Free")
    page.click("#uxMoreLabActions")
    for _ in range(page.locator("#ptCanvas g[data-id]").count()):
        page.click("#ptDeleteDevice")
    page.locator("#aglabFirstNetworkGuide summary").click()
    before = page.evaluate("academyEngine.snapshot()")
    page.click("#firstGuideRefresh")
    assert page.evaluate("academyEngine.snapshot()") == before
    for kind in ["PC", "Switch", "PC"]:
        page.click('[data-pt-add="' + kind + '"]')
    page.click("#firstGuideRefresh")
    expect(page.locator("#firstGuideSteps li").nth(1)).to_have_attribute("data-complete", "true")
    snapshot = page.evaluate("academyEngine.snapshot()")
    pcs = [d for d in snapshot["devices"] if d["type"] == "PC"]
    sw = next(d for d in snapshot["devices"] if d["type"] == "Switch")

    def cable(pc):
        page.select_option("#ptSource", pc["id"])
        page.select_option("#ptTarget", sw["id"])
        page.click("#ptMakeLink")

    def cli(device, *commands):
        page.select_option("#ptCliDevice", device["id"])
        for command in commands:
            page.fill("#ptCliInput", command)
            page.press("#ptCliInput", "Enter")

    def step(index, ok):
        expect(page.locator("#firstGuideSteps li").nth(index)).to_have_attribute(
            "data-complete", str(ok).lower()
        )

    cable(pcs[0])
    page.click("#firstGuideRefresh")
    step(4, False)
    cable(pcs[1])
    for i, pc in enumerate(pcs, 1):
        # I-1: çalışma alanı Labber'da; PC terminali VPCS: `ip <adres> <maske>`
        cli(pc, "ip 10.9.0." + str(i) + " 255.255.255.0")
    page.click("#firstGuideRefresh")
    step(4, True)
    step(5, True)
    step(6, False)
    cli(pcs[1], "ip 10.9.0.1 255.255.255.0")
    page.click("#firstGuideRefresh")
    step(5, False)
    expect(page.locator("#firstGuidePing")).to_be_disabled()
    cli(pcs[1], "ip 10.10.0.2 255.255.255.0")
    page.click("#firstGuideRefresh")
    step(5, False)
    cli(pcs[1], "ip 10.9.0.2 255.255.255.0")
    page.click("#firstGuideRefresh")
    page.click("#firstGuidePing")
    step(6, True)
    step(7, False)
    step(8, False)
    # Arayüz PR 2: Paket Dedektifi inceleme panelinin "Olaylar" sekmesinde.
    page.click("#agSimTab-events")
    page.click("#packetDetectiveRefresh")
    step(7, True)
    raw = page.locator("#packetDetectiveRaw").text_content()
    assert raw and ("arp" in raw.lower() or "icmp" in raw.lower())
    # I-1: çalışma alanı Labber'da; Paket Dedektifi izin kaynağını doğru adlandırır
    assert "Labber motoru" in page.locator("#packetDetectiveStatus").text_content()
    page.select_option("#packetDetectiveViewMode", "simple")
    expect(page.locator("#packetDetectiveRaw")).to_be_hidden()
    page.select_option("#packetDetectiveViewMode", "technical")
    assert page.locator("#packetDetectiveRaw").text_content() == raw
    # The old fingerprint ignored interface shutdown and wrongly retained ping success.
    port = next(
        l["portB"]
        for l in page.evaluate("academyEngine.snapshot().links")
        if l["a"] == pcs[0]["id"] and l["b"] == sw["id"]
    )
    cli(sw, "enable", "configure terminal", "interface " + port, "shutdown", "end")
    step(6, False)
    step(7, False)
    page.click("#firstGuidePing")
    step(6, False)
    cli(sw, "enable", "configure terminal", "interface " + port, "no shutdown", "end")
    page.click("#firstGuideRefresh")
    page.click("#firstGuidePing")
    step(6, True)
    page.click("#packetDetectiveRefresh")
    step(7, True)
    # Download alone is not proof of a disk write in browser JS. Read back the actual file.
    with page.expect_download() as pending:
        page.click("#ptExport")
    path = Path(tmp) / "student.json"
    pending.value.save_as(path)
    saved = json.loads(path.read_text())
    step(8, False)
    assert saved["devices"] == page.evaluate("academyEngine.snapshot().devices")
    before = page.evaluate("academyEngine.snapshot()")
    page.locator("#firstGuideVerifyFile").set_input_files(str(path))
    step(8, True)
    assert before == page.evaluate("academyEngine.snapshot()")
    bad = Path(tmp) / "wrong.json"
    bad.write_text('{"app":"AgLab","version":23,"devices":[],"links":[]}')
    page.locator("#firstGuideVerifyFile").set_input_files(str(bad))
    step(8, False)
    assert before == page.evaluate("academyEngine.snapshot()")
    page.locator("#firstGuideVerifyFile").set_input_files(str(path))
    step(8, True)
    invalid = dict(saved, execute="untrusted")
    bad.write_text(json.dumps(invalid))
    page.locator("#firstGuideVerifyFile").set_input_files(str(bad))
    step(8, False)
    assert before == page.evaluate("academyEngine.snapshot()")
    invalid = dict(saved, sourceArchive={"fake": True})
    bad.write_text(json.dumps(invalid))
    page.locator("#firstGuideVerifyFile").set_input_files(str(bad))
    step(8, False)
    assert before == page.evaluate("academyEngine.snapshot()")
    page.locator("#firstGuideVerifyFile").set_input_files(str(path))
    step(8, True)
    page.locator("#aglabFirstNetworkGuide summary").click()
    page.locator("#aglabFirstNetworkGuide summary").click()
    step(8, True)
    page.reload()
    page.click('[data-area="lab"]')
    before = page.evaluate("academyEngine.snapshot()")
    for lab, label in [
        ("AGL-024", "Linux bridge doğrulaması"),
        ("AGL-034", "FRRouting doğrulaması"),
        ("AGL-035", "FRRouting doğrulaması"),
        ("AGL-001", "gerçek ortam doğrulaması yapılmadı"),
    ]:
        page.select_option("#academySelect", lab)
        expect(page.locator("#academyEngineScope")).to_contain_text(label)
        assert page.evaluate("academyEngine.snapshot()") == before
    page.click("#ux14Free")
    assert page.evaluate("academyEngine.snapshot().devices") == saved["devices"]
    page.click("#uxMoreLabActions")
    page.locator("#ptImportFile").set_input_files(str(path))
    page.wait_for_function(
        "(n)=>academyEngine.snapshot().devices.length===n", arg=len(saved["devices"])
    )
    assert page.evaluate("academyEngine.snapshot().links") == saved["links"]
    # Automated 200% CSS reflow and keyboard checks; no full WCAG claim.
    for width in (1280, 390):
        page.set_viewport_size({"width": width, "height": 960})
        page.evaluate("document.body.style.zoom='2'")
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), width
        summary = page.locator("#aglabFirstNetworkGuide summary")
        summary.focus()
        page.keyboard.press("Enter")
        expect(page.locator("#aglabFirstNetworkGuide")).to_have_js_property("open", True)
        page.locator("#firstGuideRefresh").focus()
        page.keyboard.press("Tab")
        expect(page.locator("#firstGuidePing")).to_be_focused()
        page.keyboard.press("Tab")
        expect(page.locator("#firstGuideVerifyFile")).to_be_focused()
        assert page.locator("#firstGuideVerifyFile").evaluate("(e)=>e.labels.length>0")
        page.keyboard.press("Shift+Tab")
        page.locator("#aglabFirstNetworkGuide summary").focus()
        page.keyboard.press("Enter")
        page.evaluate("document.body.style.zoom='1'")
    # Scope must follow restored sessions and reset selection, not only onchange.
    page.click("#ux14Guided")
    page.select_option("#academySelect", "AGL-034")
    page.click("#academyStart")
    page.click("#academyReplaceContinue")
    page.reload()
    expect(page.locator("#academySelect")).to_have_value("AGL-034")
    expect(page.locator("#academyEngineScope")).to_contain_text("FRRouting doğrulaması")
    page.click('[data-area="lab"]')
    page.click("#ux14Guided")
    before = page.evaluate("academyEngine.snapshot()")
    page.select_option("#academySelect", "AGL-001")
    page.click("#academyReset")
    expect(page.locator("#academyEngineScope")).to_contain_text("FRRouting doğrulaması")
    page.click("#academyReplaceCancel")
    assert before == page.evaluate("academyEngine.snapshot()")
    assert not errors, errors
    browser.close()
print(
    "PASS Unified RC guide: real add/cable/CLI, duplicate/subnet/shutdown failures, repair, inspected events and verified JSON round trip"
)
