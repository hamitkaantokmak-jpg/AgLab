"""Routed ICMP uses real per-neighbor ARP and Ethernet FDB decisions, including SVI."""

import json, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium

module = (ROOT / "simulator/routed-ethernet.js").read_text()
assert (
    "// BEGIN ROUTED ETHERNET GENERATED\n" + module + "\n// END ROUTED ETHERNET GENERATED\n"
    in (ROOT / "AgLab_Final_PKT_Import.html").read_text()
)


def switch(id):
    ports = ["fa0/1", "fa0/2", "fa0/3", "gi0/1", "gi0/2"]
    return dict(
        id=id,
        name=id,
        type="Switch",
        x=100,
        y=100,
        w=112,
        h=72,
        enabled=True,
        vlans=[1, 10],
        ports=ports,
        interfaces={p: dict(mode="access", vlan=10, allowed=[10], enabled=True) for p in ports},
    )


def pc(id, ip, gateway):
    return dict(
        id=id,
        name=id,
        type="PC",
        x=100,
        y=200,
        w=104,
        h=72,
        enabled=True,
        ip=ip,
        mask="255.255.255.0",
        gateway=gateway,
        vlan=10,
        ports=["eth0"],
        interfaces={"eth0": {"enabled": True}},
    )


def router(id, first, second, network, hop):
    return dict(
        id=id,
        name=id,
        type="Router",
        x=200,
        y=100,
        w=112,
        h=72,
        enabled=True,
        ports=["g0/0", "g0/1"],
        interfaces={
            p: dict(ip=ip, mask="255.255.255.0", enabled=True)
            for p, ip in [("g0/0", first), ("g0/1", second)]
        },
        staticRoutes=[dict(network=network, mask="255.255.255.0", nextHop=hop, distance=1)],
    )


def link(a, pa, b, pb):
    return dict(a=a, portA=pa, b=b, portB=pb, up=True)


obj = dict(
    app="AgLab",
    version=23,
    devices=[
        pc("d1", "192.168.1.2", "192.168.1.1"),
        pc("d2", "192.168.2.2", "192.168.2.1"),
        switch("d3"),
        switch("d4"),
        router("d5", "192.168.1.1", "10.0.0.1", "192.168.2.0", "10.0.0.2"),
        router("d6", "10.0.0.2", "192.168.2.1", "192.168.1.0", "10.0.0.1"),
        pc("d7", "192.168.2.7", "192.168.2.1"),
        switch("d8"),
    ],
    links=[
        link("d1", "eth0", "d3", "fa0/1"),
        link("d3", "gi0/1", "d5", "g0/0"),
        link("d5", "g0/1", "d6", "g0/0"),
        link("d6", "g0/1", "d4", "gi0/1"),
        link("d4", "gi0/2", "d8", "gi0/1"),
        link("d8", "fa0/1", "d2", "eth0"),
        link("d7", "eth0", "d4", "fa0/2"),
    ],
    nextId=9,
)
with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
    browser = launch_chromium(pw)
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
    path = Path(tmp) / "routed.json"

    def load():
        before = page.locator("#ptTerminal > div").count()
        path.write_text(json.dumps(obj))
        page.locator("#ptImportFile").set_input_files(str(path))
        page.wait_for_function(
            'n=>document.querySelector("#ptTerminal").children.length>n', arg=before
        )
        assert "Topoloji doğrulandı" in "\n".join(
            page.locator("#ptTerminal > div").all_text_contents()[before:]
        )

    def cmd(device, text):
        before = page.locator("#ptTerminal > div").count()
        page.evaluate(
            "([id,text])=>{document.querySelector('#ptCliDevice').value=id;document.querySelector('#ptCliInput').value=text;document.querySelector('#ptCliForm').requestSubmit()}",
            [device, text],
        )
        return "\n".join(page.locator("#ptTerminal > div").all_text_contents()[before:])

    def ping(device, target, success=True):
        out = cmd(device, "ping " + target)
        assert ("100 percent (5/5)" if success else "0 percent (0/5)") in out, out

    load()
    ping("d1", "192.168.2.2")
    events = cmd("d1", "show ethernet events")
    assert "arp-request" in events and "forward d5" in events and "forward d6" in events, events
    assert "next-hop 10.0.0.2 ip 192.168.1.2 -> 192.168.2.2" in events, events
    assert "next-hop 192.168.2.2 ip 192.168.1.2 -> 192.168.2.2" in events, events
    for frame in events.split("frame "):
        if frame.startswith("arp-request src d5 "):
            assert "receive d1" not in frame, frame
    arp = cmd("d1", "show arp")
    assert "192.168.1.1" in arp and "192.168.2.2" not in arp, arp
    arp = cmd("d5", "show arp")
    assert "10.0.0.2" in arp and "192.168.2.2" not in arp, arp
    arp = cmd("d6", "show arp")
    assert "192.168.2.2" in arp, arp
    ping("d1", "192.168.2.2")
    events = cmd("d1", "show ethernet events")
    assert "arp-request" not in events and "receive d7" not in events, events
    print("PASS: real per-hop ARP, routed request/reply and warm FDB unicast", flush=True)
    page.evaluate(
        "document.querySelector('#ptSource').value='d1';document.querySelector('#ptTarget').value='d2';for(let i=0;i<7;i++)document.querySelector('#ptPacketStep').click()"
    )
    arp = cmd("d1", "show arp")
    assert "192.168.1.1" in arp and "192.168.2.2" not in arp, arp
    print(
        "PASS: Packet Step completion preserves real neighbor ARP instead of synthetic remote entries",
        flush=True,
    )
    # Keep the upstream FDB egress physically active while moving the final host.
    page.evaluate(
        "document.querySelector('#ptSource').value='d8';document.querySelector('#ptTarget').value='d2';document.querySelector('#ptRemoveLink').click()"
    )
    page.evaluate(
        "document.querySelector('#ptSource').value='d4';document.querySelector('#ptTarget').value='d2';document.querySelector('#ptMakeLink').click()"
    )
    ping("d1", "192.168.2.2", False)
    events = cmd("d1", "show ethernet events")
    assert "icmp-request" in events and "receive d2" not in events, events
    ping("d2", "192.168.2.1")
    ping("d1", "192.168.2.2")
    print(
        "PASS: routed ping obeys a stale FDB egress and recovers after source learning", flush=True
    )
    # Logical management SVI is an Ethernet endpoint without a fabricated physical port.
    obj["devices"][3]["interfaces"]["vlan10"] = dict(
        ip="192.168.2.10", mask="255.255.255.0", enabled=True, vlan=10
    )
    obj["devices"][3]["gateway"] = "192.168.2.1"
    load()
    ping("d1", "192.168.2.10")
    ping("d4", "192.168.1.2")
    ping("d2", "192.168.2.10")
    arp = cmd("d4", "show arp")
    assert "192.168.2.1" in arp and "192.168.1.2" not in arp, arp
    for c in ["enable", "configure terminal", "interface vlan 10", "shutdown", "end"]:
        cmd("d4", c)
    ping("d1", "192.168.2.10", False)
    for c in ["configure terminal", "interface vlan 10", "no shutdown", "end"]:
        cmd("d4", c)
    ping("d1", "192.168.2.10")
    print("PASS: local/remote SVI frame delivery, gateway ARP and shutdown recovery", flush=True)
    # Preserve the existing translated PAT model while explicitly declining a new frame-delivery claim.
    r1 = obj["devices"][4]
    r1["interfaces"]["g0/0"]["natRole"] = "inside"
    r1["interfaces"]["g0/1"]["natRole"] = "outside"
    r1["natOverload"] = dict(aclId="1", outsideInterface="g0/1")
    r1["acls"] = [
        dict(
            id="1",
            action="permit",
            protocol="ip",
            srcType="network",
            src="192.168.1.0",
            wildcard="0.0.0.255",
            dstType="any",
        )
    ]
    obj["devices"][5]["staticRoutes"] = []
    load()
    ping("d1", "192.168.2.2")
    events = cmd("d1", "show ethernet events")
    assert "legacy-nat" in events and "frame icmp-request" not in events, events
    print(
        "PASS: existing PAT result preserved and explicitly marked as legacy, not frame-verified",
        flush=True,
    )
    assert not errors, errors
    browser.close()
