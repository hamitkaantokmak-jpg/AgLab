"""Real local Ethernet forwarding: FDB selection, flooding, isolation and ARP/ICMP."""

import json, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium, import_topology

module = (ROOT / "simulator/ethernet-forwarding.js").read_text()
assert (
    "// BEGIN ETHERNET FORWARDING GENERATED\n" + module + "\n// END ETHERNET FORWARDING GENERATED\n"
    in (ROOT / "AgLab_Final_PKT_Import.html").read_text()
)


def switch(id):
    ports = ["fa0/1", "fa0/2", "fa0/3", "gi0/1", "gi0/2"]
    return dict(
        id=id,
        name="SW" + id,
        type="Switch",
        x=100,
        y=100,
        w=112,
        h=72,
        enabled=True,
        vlans=[1, 10, 20],
        ports=ports,
        interfaces={
            p: dict(
                mode="trunk" if p.startswith("gi") else "access",
                vlan=10,
                allowed=[10, 20],
                nativeVlan=1,
                enabled=True,
            )
            for p in ports
        },
    )


def host(id, ip):
    return dict(
        id=id,
        name="PC" + id,
        type="PC",
        x=100,
        y=200,
        w=104,
        h=72,
        enabled=True,
        ip=ip,
        mask="255.255.255.0",
        gateway="",
        vlan=10,
        ports=["eth0"],
        interfaces={"eth0": {"enabled": True}},
    )


def link(a, pa, b, pb):
    return dict(a=a, portA=pa, b=b, portB=pb, up=True)


obj = dict(
    app="AgLab",
    version=23,
    devices=[switch("d1"), switch("d2"), host("d3", "192.168.10.2"), host("d4", "192.168.10.3")],
    links=[
        link("d3", "eth0", "d1", "fa0/1"),
        link("d1", "gi0/1", "d2", "gi0/1"),
        link("d2", "fa0/2", "d4", "eth0"),
    ],
    nextId=5,
)

# Add a same-VLAN observer and a different-VLAN observer to expose real flooding.
obj["devices"] += [host("d5", "192.168.10.5"), host("d6", "192.168.20.6")]
obj["devices"][1]["interfaces"]["fa0/1"]["vlan"] = 20
obj["links"] += [link("d1", "fa0/2", "d5", "eth0"), link("d2", "fa0/1", "d6", "eth0")]
obj["nextId"] = 7
with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
    browser = launch_chromium(pw)
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
    path = Path(tmp) / "frames.json"
    path.write_text(json.dumps(obj))
    import_topology(page, path)

    def cmd(device, text):
        before = page.locator("#ptTerminal > div").count()
        page.evaluate(
            "([id,text])=>{document.querySelector('#ptCliDevice').value=id;document.querySelector('#ptCliInput').value=text;document.querySelector('#ptCliForm').requestSubmit()}",
            [device, text],
        )
        return "\n".join(page.locator("#ptTerminal > div").all_text_contents()[before:])

    page.click('[data-area="lab"]')
    assert page.locator("#packetDetectiveRefresh").is_visible()
    page.click("#packetDetectiveRefresh")
    assert "Henüz görüntülenecek" in page.locator("#packetDetectiveStatus").inner_text()
    assert "Tanılama için önce" in page.locator("#packetDetectiveDiagnosis").inner_text()
    assert page.locator("#packetDetectiveGoToDevice").is_disabled()
    assert page.locator("#packetDetectiveNext").is_disabled()
    assert page.locator("#packetDetectivePrevious").is_disabled()
    cmd("d3", "test ethernet 0200.0000.0004")
    events = cmd("d3", "show ethernet events")
    assert "unknown-unicast" in events, events
    assert "receive d5" in events and "receive d4" in events and "receive d6" not in events, events
    assert "ingress fa0/1 egress fa0/1" not in events, events
    assert "100 percent" in cmd("d3", "ping 192.168.10.3")
    events = cmd("d3", "show ethernet events")
    assert "arp-request" in events and "broadcast" in events, events
    # The student playback is a read-only view over the same real event log.
    page.click("#packetDetectiveRefresh")
    status = page.locator("#packetDetectiveStatus").inner_text()
    assert "Adım 1 /" in status, status
    assert "arp-request" in page.locator("#packetDetectiveRaw").inner_text()
    assert page.locator('#ptCanvas g[data-id="d3"] rect').get_attribute("stroke") == "#ffcb38"
    old_events = cmd("d3", "show ethernet events")
    page.click("#packetDetectiveNext")
    assert "Adım 2 /" in page.locator("#packetDetectiveStatus").inner_text()
    page.click("#packetDetectivePrevious")
    assert "Adım 1 /" in page.locator("#packetDetectiveStatus").inner_text()
    assert cmd("d3", "show ethernet events") == old_events, "Playback must not simulate new traffic"
    page.select_option("#packetDetectiveFilter", "arp")
    assert "Adım 1 /" in page.locator("#packetDetectiveStatus").inner_text()
    assert "arp-" in page.locator("#packetDetectiveRaw").inner_text()
    page.select_option("#packetDetectiveFilter", "discard")
    assert (
        "Bu filtreye uygun ağ olayı yok." in page.locator("#packetDetectiveStatus").inner_text()
        or "Adım 1 /" in page.locator("#packetDetectiveStatus").inner_text()
    )
    page.select_option("#packetDetectiveFilter", "all")
    assert "Adım 1 /" in page.locator("#packetDetectiveStatus").inner_text()
    assert (
        cmd("d3", "show ethernet events") == old_events
    ), "Filtering must not simulate new traffic"

    # A known one-port forwarding decision highlights its physical SVG edge.
    # Read the real event log and advance only to an eligible decision.
    page.click("#packetDetectiveRefresh")
    found_edge = False
    for _ in range(256):
        if page.locator('#ptCanvas line.pt-edge[stroke="#ffcb38"]').count() == 1:
            found_edge = True
            break
        if page.locator("#packetDetectiveNext").is_disabled():
            break
        page.click("#packetDetectiveNext")
    assert found_edge, "No real single-egress forwarding edge was highlighted during playback"
    while page.locator("#packetDetectivePrevious").is_enabled():
        page.click("#packetDetectivePrevious")
    assert "Adım 1 /" in page.locator("#packetDetectiveStatus").inner_text()
    assert page.locator('#ptCanvas line.pt-edge[stroke="#ffcb38"]').count() == 0

    assert "100 percent" in cmd("d3", "ping 192.168.10.3")
    events = cmd("d3", "show ethernet events")
    assert (
        "arp-request" not in events
        and "unknown-unicast" not in events
        and "receive d5" not in events
    ), events
    print(
        "PASS: unknown-unicast flood, VLAN isolation, cold ARP and warm learned unicast", flush=True
    )
    # A raw broadcast reaches only active receivers in the source VLAN.
    cmd("d5", "test ethernet broadcast")
    events = cmd("d5", "show ethernet events")
    assert (
        "broadcast" in events
        and "receive d3" in events
        and "receive d4" in events
        and "receive d6" not in events
    ), events
    # Known source and destination on the same ingress port must be filtered, not flooded.
    cmd("d3", "test ethernet 0200.0000.0003")
    events = cmd("d3", "show ethernet events")
    assert "filter" in events and "receive d5" not in events, events
    for c in [
        "enable",
        "configure terminal",
        "interface gi0/1",
        "switchport trunk allowed vlan none",
        "end",
    ]:
        cmd("d1", c)
    assert "0 percent (0/5)" in cmd("d3", "ping 192.168.10.3")
    events = cmd("d3", "show ethernet events")
    assert "icmp-request" in events and "receive d4" not in events, events
    cmd("d3", "test ethernet broadcast")
    events = cmd("d3", "show ethernet events")
    assert "receive d5" in events and "receive d4" not in events, events
    for c in [
        "configure terminal",
        "interface gi0/1",
        "switchport trunk allowed vlan 10,20",
        "end",
    ]:
        cmd("d1", c)
    assert "100 percent" in cmd("d3", "ping 192.168.10.3")
    # Aging must make the next raw unicast flood again, including the observer.
    page.evaluate("window.frameTime=Date.now()+300001;Date.now=()=>window.frameTime")
    cmd("d3", "test ethernet 0200.0000.0004")
    events = cmd("d3", "show ethernet events")
    assert "unknown-unicast" in events and "receive d5" in events, events
    assert "geçersiz" in cmd("d3", "test ethernet invalid").lower()
    print(
        "PASS: broadcast, same-ingress filter, allowed-list isolation/recovery and aged FDB flood",
        flush=True,
    )
    # Move the destination while keeping the old upstream FDB port physically valid.
    # Ping must follow that stale entry and fail, rather than falling back to a BFS path.
    assert "100 percent" in cmd("d3", "ping 192.168.10.3")
    page.evaluate(
        "document.querySelector('#ptSource').value='d2';document.querySelector('#ptTarget').value='d4';document.querySelector('#ptRemoveLink').click()"
    )
    page.evaluate(
        "document.querySelector('#ptSource').value='d1';document.querySelector('#ptTarget').value='d4';document.querySelector('#ptMakeLink').click()"
    )
    assert "0 percent (0/5)" in cmd("d3", "ping 192.168.10.3")
    cmd("d4", "test ethernet broadcast")
    assert "100 percent" in cmd("d3", "ping 192.168.10.3")
    print(
        "PASS: real FDB egress governs ping; source learning repairs a moved-host stale entry",
        flush=True,
    )
    # An access port emits untagged frames: its VLAN must match the peer trunk native VLAN.
    mixed = json.loads(json.dumps(obj))
    mixed["devices"][1]["interfaces"]["gi0/1"]["mode"] = "access"
    path.write_text(json.dumps(mixed))
    import_topology(page, path)
    cmd("d3", "test ethernet broadcast")
    events = cmd("d3", "show ethernet events")
    assert "receive d4" not in events, events
    for c in [
        "enable",
        "configure terminal",
        "interface gi0/1",
        "switchport trunk native vlan 10",
        "end",
    ]:
        cmd("d1", c)
    assert "100 percent" in cmd("d3", "ping 192.168.10.3")
    print("PASS: access/trunk untagged native VLAN mismatch and recovery", flush=True)
    # A triangle exercises loop-free flood and recovery after a tree edge goes down.
    obj["devices"].append(switch("d7"))
    obj["links"] += [link("d1", "gi0/2", "d7", "gi0/1"), link("d2", "gi0/2", "d7", "gi0/2")]
    obj["nextId"] = 8
    path.write_text(json.dumps(obj))
    import_topology(page, path)
    assert "Henüz" in cmd("d3", "show ethernet events")
    cmd("d3", "test ethernet broadcast")
    events = cmd("d3", "show ethernet events")
    assert (
        events.count("broadcast d1 ingress") == 1
        and events.count("broadcast d2 ingress") == 1
        and events.count("broadcast d7 ingress") == 1
    ), events
    assert (
        "broadcast d2 ingress gi0/1 egress fa0/2 vlan 10" in events
        and "broadcast d7 ingress gi0/1 egress - vlan 10" in events
    ), events
    for c in ["enable", "configure terminal", "interface gi0/1", "shutdown", "end"]:
        cmd("d1", c)
    assert "100 percent" in cmd("d3", "ping 192.168.10.3")
    print(
        "PASS: topology import clears events; triangle STP flood terminates and link-down recovers",
        flush=True,
    )
    # Routers consume a broadcast on the ingress LAN without bridging it to their other port.
    obj["devices"] += [
        dict(
            id="d8",
            name="R",
            type="Router",
            x=200,
            y=200,
            w=112,
            h=72,
            enabled=True,
            ports=["g0/0", "g0/1"],
            interfaces={
                "g0/0": dict(ip="192.168.10.1", mask="255.255.255.0", enabled=True),
                "g0/1": dict(ip="192.168.30.1", mask="255.255.255.0", enabled=True),
            },
        ),
        host("d9", "192.168.30.2"),
    ]
    obj["links"] += [link("d7", "fa0/1", "d8", "g0/0"), link("d8", "g0/1", "d9", "eth0")]
    obj["nextId"] = 10
    path.write_text(json.dumps(obj))
    import_topology(page, path)
    cmd("d3", "test ethernet broadcast")
    events = cmd("d3", "show ethernet events")
    assert "receive d8" in events and "receive d9" not in events, events
    for invalid in ["0100.5e00.0001", "0000.0000.0000", "invalid"]:
        assert "geçersiz" in cmd("d3", "test ethernet " + invalid).lower()
    print("PASS: router broadcast boundary and unsupported/malformed MAC rejection", flush=True)
    assert not errors, errors
    browser.close()
