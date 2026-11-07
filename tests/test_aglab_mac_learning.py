"""Dynamic MAC ingress-port, VLAN scope, routing boundary and aging in Chromium."""

import json, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium

module = (ROOT / "simulator/mac-learning.js").read_text()
assert (
    "// BEGIN MAC LEARNING GENERATED\n" + module + "\n// END MAC LEARNING GENERATED\n"
    in (ROOT / "AgLab_Final_PKT_Import.html").read_text()
)


def switch(id):
    ports = ["fa0/1", "fa0/2", "gi0/1", "gi0/2"]
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
with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
    browser = launch_chromium(pw)
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
    path = Path(tmp) / "mac.json"

    def load(data):
        path.write_text(json.dumps(data))
        page.locator("#ptImportFile").set_input_files(str(path))
        page.wait_for_timeout(60)

    def cmd(device, text):
        before = page.locator("#ptTerminal > div").count()
        page.evaluate(
            "([id,text])=>{document.querySelector('#ptCliDevice').value=id;document.querySelector('#ptCliInput').value=text;document.querySelector('#ptCliForm').requestSubmit()}",
            [device, text],
        )
        return "\n".join(page.locator("#ptTerminal > div").all_text_contents()[before:])

    def ping(device, target):
        assert "100 percent (5/5)" in cmd(device, "ping " + target)

    def row(device, mac, port, vlan=10):
        out = cmd(device, "show mac address-table")
        rows = [line for line in out.splitlines() if mac in line]
        assert any(line.split()[0] == str(vlan) and port in line for line in rows), (
            device,
            mac,
            port,
            vlan,
            out,
        )

    load(obj)
    page.evaluate(
        "document.querySelector('#ptSource').value='d3';document.querySelector('#ptTarget').value='d4';document.querySelector('#ptPacketStep').click()"
    )
    row("d1", "0200.0000.0003", "fa0/1")
    assert "0200.0000.0004" not in cmd("d1", "show mac address-table")
    page.evaluate("document.querySelector('#ptPacketStep').click()")
    row("d2", "0200.0000.0003", "gi0/1")
    load(obj)
    ping("d3", "192.168.10.3")
    assert "Switch enable" in cmd("d1", "clear mac address-table dynamic")
    row("d1", "0200.0000.0003", "fa0/1")
    row("d1", "0200.0000.0003", "fa0/1")
    row("d1", "0200.0000.0004", "gi0/1")
    row("d2", "0200.0000.0003", "gi0/1")
    row("d2", "0200.0000.0004", "fa0/2")
    print("PASS: source MAC learned on ingress ports on both switches", flush=True)
    # Advance application wall clock, without waiting five minutes or adding runtime test APIs.
    page.evaluate("window.macTestTime=Date.now();Date.now=()=>window.macTestTime")
    ping("d3", "192.168.10.3")
    page.evaluate("window.macTestTime+=299999")
    row("d1", "0200.0000.0003", "fa0/1")
    page.evaluate("window.macTestTime+=1")
    assert "MAC tablosu boş" in cmd("d1", "show mac address-table")
    ping("d3", "192.168.10.3")
    row("d1", "0200.0000.0003", "fa0/1")
    # Shutdown and VLAN membership changes invalidate stale entries when the table is read.
    for c in ["enable", "configure terminal", "interface fa0/1", "shutdown", "end"]:
        cmd("d1", c)
    assert "0200.0000.0003" not in cmd("d1", "show mac address-table")
    for c in ["configure terminal", "interface fa0/1", "no shutdown", "end"]:
        cmd("d1", c)
    ping("d3", "192.168.10.3")
    for c in ["configure terminal", "interface fa0/1", "switchport access vlan 20", "end"]:
        cmd("d1", c)
    assert "0200.0000.0003" not in cmd("d1", "show mac address-table")
    print("PASS: 300-second aging, relearning, shutdown and VLAN invalidation", flush=True)
    load(obj)
    ping("d3", "192.168.10.3")
    cmd("d1", "enable")
    cmd("d1", "clear mac address-table dynamic")
    cleared = cmd("d1", "show mac address-table")
    assert "MAC tablosu boş" in cleared, cleared
    row("d2", "0200.0000.0003", "gi0/1")
    ping("d3", "192.168.10.3")
    assert "0200.0000.0003" in cmd("d1", "show mac address-table")
    # A router uses the same modeled MAC on two VLANs; the downstream switch must not learn remote endpoint MACs across L3.
    obj["devices"][3]["ip"] = "192.168.20.2"
    obj["devices"][1]["interfaces"]["fa0/2"]["vlan"] = 20
    r = dict(
        id="d5",
        name="R",
        type="Router",
        x=200,
        y=100,
        w=112,
        h=72,
        enabled=True,
        ports=["g0/0"],
        interfaces={"g0/0": dict(ip="", mask="255.255.255.0", enabled=True)},
    )
    for v in (10, 20):
        r["interfaces"]["g0/0." + str(v)] = dict(
            ip="192.168." + str(v) + ".1",
            mask="255.255.255.0",
            enabled=True,
            parent="g0/0",
            encapsulation="dot1q",
            vlan=v,
        )
    obj["devices"].append(r)
    obj["links"].append(link("d1", "gi0/2", "d5", "g0/0"))
    obj["nextId"] = 6
    obj["devices"][2]["gateway"] = "192.168.10.1"
    obj["devices"][3]["gateway"] = "192.168.20.1"
    load(obj)
    ping("d3", "192.168.10.1")
    ping("d4", "192.168.20.1")
    row("d1", "0200.0000.0005", "gi0/2", 10)
    row("d1", "0200.0000.0005", "gi0/2", 20)
    ping("d3", "192.168.20.2")
    out = cmd("d2", "show mac address-table")
    assert not any(
        "0200.0000.0003" in line and line.split()[0] == "20" for line in out.splitlines()
    ), out
    row("d2", "0200.0000.0005", "gi0/1", 20)
    print("PASS: clear/relearn, same MAC in two VLANs and router source-MAC rewrite", flush=True)
    assert not errors, errors
    browser.close()
