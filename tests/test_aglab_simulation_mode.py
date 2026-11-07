"""Real Chromium interactions and measurements; no second packet engine."""

import ast, copy, json, math, os, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from aglab_test_support import ROOT, launch_chromium

OUT = Path(os.environ.get("AGLAB_TEST_ARTIFACT_DIR", ROOT / "dist"))
OUT.mkdir(exist_ok=True, parents=True)


def pc(id, ip, gateway, x):
    return dict(
        id=id,
        name=id,
        type="PC",
        ip=ip,
        mask="255.255.255.0",
        gateway=gateway,
        x=x,
        y=170,
        w=104,
        h=72,
        enabled=True,
        ports=["eth0"],
        interfaces={"eth0": {"enabled": True}},
    )


def router(id, addresses, x, routes=None):
    return dict(
        id=id,
        name=id,
        type="Router",
        x=x,
        y=170,
        w=108,
        h=72,
        enabled=True,
        ports=list(addresses),
        interfaces={
            p: {"ip": ip, "mask": "255.255.255.0", "enabled": True} for p, ip in addresses.items()
        },
        staticRoutes=routes or [],
    )


def edge(a, pa, b, pb):
    return dict(a=a, portA=pa, b=b, portB=pb, up=True)


def routed(two=False):
    ds = [pc("P1", "10.1.0.2", "10.1.0.1", 100), pc("P2", "10.2.0.2", "10.2.0.1", 750)]
    if two:
        ds.extend(
            [
                router(
                    "R1",
                    {"g0/0": "10.1.0.1", "g0/1": "10.255.0.1"},
                    300,
                    [
                        dict(
                            network="10.2.0.0",
                            mask="255.255.255.0",
                            nextHop="10.255.0.2",
                            distance=1,
                        )
                    ],
                ),
                router(
                    "R2",
                    {"g0/0": "10.255.0.2", "g0/1": "10.2.0.1"},
                    550,
                    [
                        dict(
                            network="10.1.0.0",
                            mask="255.255.255.0",
                            nextHop="10.255.0.1",
                            distance=1,
                        )
                    ],
                ),
            ]
        )
        ls = [
            edge("P1", "eth0", "R1", "g0/0"),
            edge("R1", "g0/1", "R2", "g0/0"),
            edge("R2", "g0/1", "P2", "eth0"),
        ]
    else:
        ds.append(router("R1", {"g0/0": "10.1.0.1", "g0/1": "10.2.0.1"}, 420))
        ls = [edge("P1", "eth0", "R1", "g0/0"), edge("R1", "g0/1", "P2", "eth0")]
    return dict(app="AgLab", version=23, devices=ds, links=ls, nextId=len(ds) + 1, selected="P1")


report = {
    "browser": "Chromium",
    "human_participants": False,
    "physical_mobile_device": False,
    "scenarios": [],
    "performance": [],
}
with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
    browser = launch_chromium(pw)
    context = browser.new_context(viewport={"width": 1366, "height": 1000}, offline=True)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
    page.click('[data-area="lab"]')
    page.click("#ux14Free")
    page.click("#uxMoreLabActions")

    def state():
        return page.evaluate("aglabSimulation.state()")

    def trace():
        return page.evaluate("aglabEngines.trace()")

    def cmd(id, commands):
        page.locator('#ptCanvas g[data-id="' + id + '"]').click()
        expect(page.locator("#ptCliDevice")).to_have_value(id)
        output = []
        for command in commands:
            before = page.locator("#ptTerminal > div").count()
            page.fill("#ptCliInput", command)
            page.press("#ptCliInput", "Enter")
            output.extend(page.locator("#ptTerminal > div").all_text_contents()[before:])
        page.keyboard.press("Escape")
        return "\n".join(output)

    def connect(a, b):
        page.select_option("#ptSource", a)
        page.select_option("#ptTarget", b)
        page.click("#ptMakeLink")

    def load(top):
        file = Path(tmp) / "topology.json"
        file.write_text(json.dumps(top), encoding="utf-8")
        before = page.locator("#ptTerminal > div").count()
        page.locator("#ptImportFile").set_input_files(str(file))
        page.wait_for_function(
            'n=>document.querySelector("#ptTerminal").children.length>n', arg=before
        )
        assert "Topoloji doğrulandı" in "\n".join(
            page.locator("#ptTerminal > div").all_text_contents()[before:]
        )
        assert len(page.evaluate("aglabEngines.capture().devices")) == len(top["devices"])

    def select_event(index):
        if not page.locator("#simulationEvents").evaluate("(d)=>d.open"):
            page.locator("#simulationEvents summary").click()
        # Page to the actual recorded position; DOM is bounded to 25 rows.
        desired = index // 25
        while int(page.locator("#simulationPage").inner_text().split("/")[0]) - 1 < desired:
            page.click("#simulationNextPage")
        while int(page.locator("#simulationPage").inner_text().split("/")[0]) - 1 > desired:
            page.click("#simulationPreviousPage")
        page.locator('#simulationRows tr[data-pos="' + str(index) + '"] button').click()

    def same_capture():
        assert page.evaluate("aglabSimulation.trace().events") == trace()["events"]

    # Construct the basic lab with the real add/cable/CLI controls.
    for _ in range(page.locator("#ptCanvas g[data-id]").count()):
        page.click("#ptDeleteDevice")
    for kind in ("PC", "Switch", "PC"):
        page.click('[data-pt-add="' + kind + '"]')
    ds = page.evaluate("aglabEngines.capture().devices")
    hosts = [d for d in ds if d["type"] == "PC"]
    sw = next(d for d in ds if d["type"] == "Switch")
    a, b = hosts[0]["id"], hosts[1]["id"]
    connect(a, sw["id"])
    connect(b, sw["id"])
    cmd(a, ["ip address 10.0.0.1 255.255.255.0"])
    cmd(b, ["ip address 10.0.0.2 255.255.255.0"])
    good = page.evaluate("academyEngine.snapshot()")
    assert "100 percent" in cmd(a, ["ping 10.0.0.2"])
    cold = trace()
    print("PASS setup and actual ping trace", len(cold["events"]), flush=True)
    assert any(
        e.get("frame", {}).get("arp", {}).get("senderIp") == "10.0.0.1"
        for e in cold["events"]
        if e.get("frame", {}).get("arp")
    )
    assert any(e["kind"] == "wire" for e in cold["events"])
    assert not state()["active"]
    baseline = page.evaluate(
        "JSON.stringify({topology:academyEngine.snapshot(),tables:aglabEngines.tables()})"
    )
    page.click("#simulationMode")
    same_capture()
    assert state()["cursor"] == -1
    print("PASS capture", flush=True)
    page.locator("#aglabFirstNetworkGuide").evaluate("(d)=>d.open=true")
    page.evaluate("()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")
    page.evaluate(
        """()=>{window.replayGuideChanges=0;new MutationObserver(()=>replayGuideChanges++).observe(document.getElementById('firstGuideSteps'),{childList:true});}"""
    )
    page.click("#simulationForward")
    assert state()["cursor"] == 0
    page.click("#simulationForward")
    assert state()["cursor"] == 1 and state()["event"]["kind"] == "wire"
    print("PASS manual forward", state()["progress"], flush=True)
    page.wait_for_function(
        "aglabSimulation.state().progress>.12 && aglabSimulation.state().progress<.95"
    )
    page.click("#simulationPause")
    paused = state()
    assert not paused["playing"] and not paused["rafPending"]

    def geometry():
        return page.evaluate(
            """()=>{const s=aglabSimulation.state(),t=aglabEngines.capture(),e=s.event.edge,ls=t.links.filter(l=>t.devices.some(d=>d.id===l.a)&&t.devices.some(d=>d.id===l.b)),i=AgLabSimulationPlayback.matchWire(s.event,ls),line=document.querySelectorAll('#ptCanvas line.pt-edge')[i],dot=document.getElementById('simulationPacket');let p={x1:+line.getAttribute('x1'),y1:+line.getAttribute('y1'),x2:+line.getAttribute('x2'),y2:+line.getAttribute('y2')};if(ls[i].a!==e.a)p={x1:p.x2,y1:p.y2,x2:p.x1,y2:p.y1};const expected=AgLabSimulationPlayback.interpolate(p,s.progress),box=dot.getBoundingClientRect(),m=document.getElementById('ptCanvas').getScreenCTM(),screen=new DOMPoint(expected.x,expected.y).matrixTransform(m);return {x:+dot.getAttribute('cx'),y:+dot.getAttribute('cy'),expected,screen:{x:screen.x,y:screen.y},actualScreen:{x:box.x+box.width/2,y:box.y+box.height/2}}}"""
        )

    def aligned():
        g = geometry()
        assert abs(g["x"] - g["expected"]["x"]) < 0.1 and abs(g["y"] - g["expected"]["y"]) < 0.1, g
        assert (
            abs(g["screen"]["x"] - g["actualScreen"]["x"]) < 1
            and abs(g["screen"]["y"] - g["actualScreen"]["y"]) < 1
        ), g

    aligned()
    position = geometry()
    page.wait_for_timeout(170)
    assert state()["cursor"] == paused["cursor"] and geometry() == position
    initial_guide_updates = page.evaluate("replayGuideChanges")
    assert initial_guide_updates <= 4, (
        "Animation must not rebuild the unrelated guide every frame",
        initial_guide_updates,
    )
    print("PASS animation geometry and pause", flush=True)
    assert (
        page.evaluate(
            "JSON.stringify({topology:academyEngine.snapshot(),tables:aglabEngines.tables()})"
        )
        == baseline
    ), "Replay must not change network state"
    # Select an actual paused packet in empty wire space, while device hit areas
    # remain protected. At 0.5x the midpoint leaves a generous interaction window.
    page.select_option("#simulationSpeed", "0.5")
    page.click("#simulationReset")
    page.click("#simulationForward")
    page.click("#simulationForward")
    page.wait_for_function(
        "aglabSimulation.state().progress>.45&&aglabSimulation.state().progress<.62"
    )
    page.click("#simulationPause")
    expect(page.locator("#simulationPacketHit")).to_have_attribute("aria-disabled", "false")
    page.locator("#simulationPacketHit").press("Space")
    expect(page.locator("#simulationDetailsTitle")).to_be_focused()
    page.locator("#simulationPacketHit").click()
    expect(page.locator("#simulationDetailsTitle")).to_be_focused()
    # Moving a device redraws the existing SVG; the overlay must reattach, not
    # invent new geometry or force a topology redraw per animation frame.
    node = page.locator('#ptCanvas g[data-id="' + a + '"]')
    node.scroll_into_view_if_needed()
    box = node.bounding_box()
    x, y = box["x"] + 20, box["y"] + 20
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + 35, y + 20, steps=6)
    page.mouse.up()
    page.wait_for_function('document.querySelectorAll("#simulationOverlay").length===1')
    assert not state()["stale"]
    aligned()
    cdp = context.new_cdp_session(page)
    cdp.send("Emulation.setPageScaleFactor", {"pageScaleFactor": 2})
    aligned()
    cdp.send("Emulation.setPageScaleFactor", {"pageScaleFactor": 1})
    assert "10.0.0.1" in cmd(a, ["ipconfig"])
    assert state()["active"]
    page.select_option("#simulationSpeed", "4")
    page.click("#simulationPlay")
    old = state()["cursor"]
    page.wait_for_function("(old)=>aglabSimulation.state().cursor>old", arg=old)
    page.click("#simulationPause")
    assert not state()["playing"]
    print("PASS move/zoom/CLI/play", flush=True)
    page.click("#simulationReset")
    assert state()["cursor"] == -1
    select_event(1)
    assert "10.0.0.1" in page.locator("#simulationFields").inner_text()
    assert "0x0806" in page.locator("#simulationFields").inner_text()
    chosen = state()["event"]["eventId"]
    page.click("#simulationExplain")
    assert "AğLab simülasyon motoru" in page.locator("#packetDetectiveStatus").inner_text()
    page.click("#packetDetectiveSimulate")
    assert state()["event"]["eventId"] == chosen
    page.locator("#simulationModeBar").evaluate('(n)=>n.scrollIntoView({block:"start"})')
    page.screenshot(path=str(OUT / "simulation-desktop.png"))
    assert "100 percent" in cmd(a, ["ping 10.0.0.2"])
    same_capture()
    assert not any(
        e.get("frame", {}).get("protocol") == "ARP" for e in trace()["events"]
    ), "Warm ping must not invent ARP"
    page.select_option("#simulationFilter", "ARP")
    assert state()["total"] == 0
    expect(page.locator("#simulationStatus")).to_contain_text("filtreyi değiştir")
    page.select_option("#simulationFilter", "all")
    same_capture()
    report["scenarios"].append(
        "UI-built basic ping; exact trace; playback/Pause/reset/speed/details; drag/zoom geometry; CLI; detective bridge; warm ARP cache"
    )
    print("PASS basic replay integration", flush=True)
    before_native = page.evaluate("JSON.stringify(aglabSimulation.trace())")
    native = Path(tmp) / "native.json"
    native.write_text(
        json.dumps(
            {
                "kind": "routing",
                "engine": "FRRouting",
                "ok": True,
                "cleanup": True,
                "steps": [{"name": "Separate native report", "ok": True}],
                "evidence": {},
            }
        )
    )
    page.locator("#nativeLabReport").set_input_files(str(native))
    expect(page.locator("#packetDetectiveSimulate")).to_be_disabled()
    assert page.evaluate("JSON.stringify(aglabSimulation.trace())") == before_native
    # Failure and repair must reflect actual diagnostics, never fabricated drops.
    cmd(b, ["ip address 10.0.1.2 255.255.255.0"])
    assert state()["stale"]
    assert "0 percent" in cmd(a, ["ping 10.0.0.2"])
    same_capture()
    failed = trace()
    diagnostic = next(i for i, e in enumerate(failed["events"]) if e["kind"] == "diagnostic")
    select_event(diagnostic)
    assert "Motor tanısı" in page.locator("#simulationFields").inner_text()
    expect(page.locator("#simulationOverlay")).not_to_be_visible()
    cmd(b, ["ip address 10.0.0.2 255.255.255.0"])
    assert "100 percent" in cmd(a, ["ping 10.0.0.2"])
    port = next(
        l["portA"] if l["a"] == sw["id"] else l["portB"]
        for l in good["links"]
        if b in (l["a"], l["b"])
    )
    cmd(sw["id"], ["enable", "conf t", "interface " + port, "switchport access vlan 20", "end"])
    assert "0 percent" in cmd(a, ["ping 10.0.0.2"])
    assert not any(e["kind"] == "wire" and e["edge"]["b"] == b for e in trace()["events"])
    cmd(sw["id"], ["enable", "conf t", "interface " + port, "switchport access vlan 10", "end"])
    assert "100 percent" in cmd(a, ["ping 10.0.0.2"])
    same_capture()
    report["scenarios"].append(
        "IP failure/repair; VLAN isolation/repair; stale trace stops; no fabricated diagnostic drop point"
    )
    shared = json.loads((ROOT / "real-lab/examples/shared-vlan10.aglab.json").read_text())
    load(shared)
    pcs = [d for d in shared["devices"] if d["type"] == "PC"]
    assert "100 percent" in cmd(pcs[0]["id"], ["ping " + pcs[1]["ip"]])
    same_capture()
    report["scenarios"].append("Two-PC two-switch VLAN10/trunk trace")
    one = routed()
    load(one)
    assert "0 percent" in cmd("P1", ["ping 10.2.0.2 ttl 1"])
    ttl = trace()
    drop = next(
        i
        for i, e in enumerate(ttl["events"])
        if e["kind"] == "discard" and e["detail"]["reason"] == "ttl-expired"
    )
    select_event(drop)
    assert state()["event"]["device"] == "R1"
    assert page.locator("#simulationPacket").get_attribute("fill") == "#b91c1c"
    assert "100 percent" in cmd("P1", ["ping 10.2.0.2"])
    assert any(
        e.get("frame", {}).get("ipv4", {}).get("ttl") == 63
        for e in trace()["events"]
        if e.get("frame", {}).get("ipv4")
    )
    report["scenarios"].append(
        "One-router IPv4 forwarding, actual TTL decrement and ICMP Time Exceeded drop marker"
    )
    two = routed(True)
    load(two)
    assert "100 percent" in cmd("P1", ["ping 10.2.0.2"])
    cmd("R1", ["enable", "conf t", "no ip route 10.2.0.0 255.255.255.0 10.255.0.2", "end"])
    assert "0 percent" in cmd("P1", ["ping 10.2.0.2"])
    same_capture()
    cmd("R1", ["enable", "conf t", "ip route 10.2.0.0 255.255.255.0 10.255.0.2", "end"])
    assert "100 percent" in cmd("P1", ["ping 10.2.0.2"])
    report["scenarios"].append("Two-router static route failure/repair")
    escaped = copy.deepcopy(good)
    next(d for d in escaped["devices"] if d["id"] == a)["name"] = "<img src=bad onerror=alert(1)>"
    load(escaped)
    assert "100 percent" in cmd(a, ["ping 10.0.0.2"])
    assert page.locator("#simulationPanel img").count() == 0
    assert "<img src=bad" in page.locator("#simulationRows").inner_text()
    report["scenarios"].append("Untrusted names remain text; native reports cannot populate replay")
    # Existing Academy source/rubrics remain unchanged. Viewing does not grade.
    grades = []
    for labid in ("AGL-001", "AGL-005"):
        page.click("#ux14Guided")
        page.select_option("#academySelect", labid)
        page.click("#academyStart")
        if page.locator("#academyReplaceContinue").is_visible():
            page.click("#academyReplaceContinue")
        if labid == "AGL-001":
            connect("PC1", "SW1")
            connect("PC2", "SW1")
            page.select_option("#academyAnswer-router_required", "false")
        else:
            assert "0 percent" in cmd("PC1", ["ping 192.168.1.20"])
            cmd("SW1", ["enable", "conf t", "interface fa0/2", "no shutdown", "end"])
        assert "100 percent" in cmd("PC1", ["ping 192.168.1.20"])
        page.click("#academyCheck")
        grade = page.locator("#academyResult h3").inner_text()
        saved = page.evaluate('localStorage.getItem("aglab-academy-progress-v1")')
        if not state()["active"]:
            page.click("#simulationMode")
        page.click("#simulationCapture")
        page.click("#simulationForward")
        page.click("#simulationPause")
        assert page.evaluate('localStorage.getItem("aglab-academy-progress-v1")') == saved
        page.click("#academyCheck")
        assert page.locator("#academyResult h3").inner_text() == grade
        grades.append({"lab": labid, "grade": grade})
    page.click("#ptSave")
    persisted = page.evaluate('localStorage.getItem("aglab-academy-progress-v1")')
    snapshot = page.evaluate("academyEngine.snapshot()")
    if not page.locator("#ptExport").is_visible():
        page.click("#uxMoreLabActions")
    with page.expect_download() as download:
        page.click("#ptExport")
    savedfile = Path(tmp) / "saved.json"
    download.value.save_as(str(savedfile))
    assert "simulation" not in json.loads(savedfile.read_text()).keys()
    page.reload()
    page.click('[data-area="lab"]')
    assert page.evaluate('localStorage.getItem("aglab-academy-progress-v1")') == persisted
    assert page.evaluate("academyEngine.snapshot()") == snapshot
    assert not state()["active"] and not state()["total"]
    page.locator("#ptImportFile").set_input_files(str(savedfile))
    page.wait_for_timeout(80)
    assert page.evaluate("academyEngine.snapshot()") == snapshot
    report["academy"] = grades
    report["scenarios"].append(
        "AGL-001/005 grade equality, progress, save/reload and JSON roundtrip; replay history not persisted"
    )
    # Reuse the existing large-topology fixture, not another implementation.
    tree = ast.parse((ROOT / "test_aglab_unified_performance.py").read_text())
    fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "topology")
    ns = {}
    exec(compile(ast.Module(body=[fn], type_ignores=[]), "<existing fixture>", "exec"), ns)
    page.click("#ux14Free")
    fixtures = [
        ("2PC+1SW", good, a, b),
        ("2PC+2SW VLAN10", shared, pcs[0]["id"], pcs[1]["id"]),
        ("2PC+1R", one, "P1", "P2"),
        ("2PC+2R", two, "P1", "P2"),
    ] + [(str(n) + " devices", ns["topology"](n), "p0", "p1") for n in (10, 50, 100, 250)]
    for title, top, source, target in fixtures:
        row = {"topology": title, "devices": len(top["devices"]), "samples_per_mode": 1}
        for sim in (False, True):
            load(top)
            page.click("#simulationMode" if sim else "#simulationRealtime")
            measured = page.evaluate(
                """([a,b])=>{const start=performance.now(),r=aglabEngines.run('aglab-js',a,b);return {ok:r.ok,ms:performance.now()-start,events:aglabEngines.trace().events.length,overflow:aglabEngines.trace().overflow}}""",
                [source, target],
            )
            assert measured["ok"], (title, measured)
            row["simulation" if sim else "realtime"] = measured
            assert measured["events"] <= 512
            if sim:
                assert (
                    page.locator("#simulationRows tr").count() <= 25 and not state()["rafPending"]
                )
        report["performance"].append(row)
    page.click("#simulationNextPage")
    expect(page.locator("#simulationPage")).to_contain_text("2 /")
    page.click("#simulationReset")
    expect(page.locator("#simulationPage")).to_contain_text("1 /")
    assert state()["cursor"] == -1
    # Animation is one reused SVG layer, with no full topology redraw per frame.
    load(good)
    page.click("#simulationMode")
    cmd(a, ["ping 10.0.0.2"])
    page.select_option("#simulationSpeed", "4")
    page.evaluate(
        """()=>{window.removedSimulationNodes=0;new MutationObserver(rs=>rs.forEach(r=>r.removedNodes.forEach(n=>{if(n.matches?.('.pt-node'))removedSimulationNodes++}))).observe(document.getElementById('ptCanvas'),{childList:true});}"""
    )
    page.click("#simulationPlay")
    page.wait_for_function("aglabSimulation.state().cursor>=4")
    page.click("#simulationPause")
    redraws = page.evaluate("removedSimulationNodes")
    layers = page.locator("#simulationOverlay").count()
    assert redraws == 0
    assert layers == 1
    report["animation"] = {
        "topology_nodes_removed_during_playback": redraws,
        "overlay_layers": layers,
        "wire_geometry_drag_zoom": True,
        "paused_packet_click_and_space": True,
        "guide_rebuilds_during_initial_wire": initial_guide_updates,
    }
    report["scenarios"].append(
        "Performance on eight fixtures; max512 records/max25 rows; one SVG layer; zero topology-node redraw during playback"
    )
    assert not errors, errors
    context.close()
    # Mobile controls, touch CLI and reduced-motion text playback.
    context = browser.new_context(
        viewport={"width": 390, "height": 900},
        is_mobile=True,
        has_touch=True,
        reduced_motion="reduce",
        offline=True,
    )
    page = context.new_page()
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
    page.click('[data-area="lab"]')
    page.click("#ux14Free")
    load(good)
    assert "100 percent" in cmd(a, ["ping 10.0.0.2"])
    page.locator("#simulationMode").tap()
    expect(page.locator("#simulationAnimation")).not_to_be_checked()
    expect(page.locator("#simulationAnimation")).to_be_disabled()
    page.locator("#simulationForward").tap()
    assert state()["cursor"] == 0 and not state()["rafPending"]
    assert not page.locator("#simulationEvents").evaluate("(d)=>d.open")
    page.locator("#simulationEvents summary").tap()
    page.locator('#simulationRows tr[data-pos="1"] button').tap()
    assert "0x0806" in page.locator("#simulationFields").inner_text()
    page.locator('#ptCanvas g[data-id="' + a + '"]').tap()
    expect(page.locator("#ptCliDevice")).to_have_value(a)
    page.keyboard.press("Escape")
    assert state()["active"]
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
    page.locator("#simulationPanel").screenshot(path=str(OUT / "simulation-details-mobile.png"))
    page.locator("#simulationModeBar").evaluate('(n)=>n.scrollIntoView({block:"start"})')
    page.screenshot(path=str(OUT / "simulation-mobile.png"))
    page.locator('#simulationRows tr[data-pos="1"] button').focus()
    page.keyboard.press("ArrowDown")
    assert state()["cursor"] == 2
    # Reduced motion removes movement, not the playback dwell/speed controls.
    page.select_option("#simulationSpeed", "0.5")
    page.click("#simulationReset")
    page.click("#simulationPlay")
    page.wait_for_timeout(100)
    assert state()["cursor"] == 0, "Reduced-motion autoplay must not rush through one event per RAF"
    page.wait_for_function("aglabSimulation.state().cursor>0")
    page.click("#simulationPause")
    assert not state()["playing"]
    assert not errors, errors
    context.close()
    browser.close()
    report["scenarios"].append(
        "390px touch controls/CLI, keyboard event navigation, reduced motion, no page horizontal overflow"
    )
    report["page_errors"] = errors
    report["passed"] = True
    (OUT / "simulation-mode-results.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8"
    )
print(
    "PASS Simulation Mode: real events, immutable replay, actual-wire animation, failures/routing/Academy/mobile and Chromium measurements"
)
