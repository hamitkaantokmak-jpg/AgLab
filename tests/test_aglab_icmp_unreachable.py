"""Only delivered ICMP Destination Unreachable terminates the trace as !N/!H."""

import copy, json, re, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium

module = (ROOT / "simulator/icmp.js").read_text()
assert (
    "// BEGIN ICMP GENERATED\n" + module + "\n// END ICMP GENERATED\n"
    in (ROOT / "AgLab_Final_PKT_Import.html").read_text()
)
base = json.loads((ROOT / "static-routing-two-routers.aglab.json").read_text())
with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
    browser = launch_chromium(pw)
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
    path = Path(tmp) / "unreachable.json"

    def load(obj=base):
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

    def rows(out):
        return [line for line in out.splitlines() if re.match(r"^\d+\s", line)]

    missing = copy.deepcopy(base)
    missing["devices"][0]["staticRoutes"] = []
    load(missing)
    out = cmd("d3", "trace 192.168.2.2 max-hops 4")
    hops = rows(out)
    assert len(hops) == 2 and "!N" in hops[-1] and "Network Unreachable" in out, out
    events = cmd("d3", "show ethernet events")
    assert (
        "icmp-destination-unreachable type 3 code 0" in events and "icmp-delivered d3" in events
    ), events
    load()
    out = cmd("d3", "trace 192.168.2.99 max-hops 5")
    hops = rows(out)
    assert len(hops) == 3 and "!H" in hops[-1] and "Echo Reply" not in out, out
    events = cmd("d3", "show ethernet events")
    assert (
        "arp-unresolved d2 target 192.168.2.99" in events
        and "icmp-destination-unreachable type 3 code 1" in events
    ), events
    assert "Hedefe ulaşılabilir" not in out, out
    print("PASS: returned network/host unreachable after actual route/ARP failure", flush=True)
    blocked = copy.deepcopy(base)
    r2 = blocked["devices"][1]
    r2["acls"] = [
        dict(
            id="101", action="deny", protocol="icmp", srcType="host", src="10.0.0.2", dstType="any"
        ),
        dict(id="101", action="permit", protocol="ip", srcType="any", dstType="any"),
    ]
    r2["interfaces"]["g0/0"]["aclOut"] = "101"
    load(blocked)
    out = cmd("d3", "trace 192.168.2.99 max-hops 4")
    hops = rows(out)
    assert (
        len(hops) == 4 and hops[-1].strip() == "4  *" and "!H" not in out and "!N" not in out
    ), out
    events = cmd("d3", "show ethernet events")
    assert "icmp-undelivered d3" in events and "ACL 101" in events, events
    no_return = copy.deepcopy(base)
    no_return["devices"][1]["staticRoutes"] = []
    load(no_return)
    out = cmd("d3", "trace 192.168.2.99 max-hops 4")
    assert "!H" not in out and rows(out)[-1].strip() == "4  *", out
    print(
        "PASS: blocked/missing error return remains silent, no fabricated terminal response",
        flush=True,
    )
    load()
    out = cmd("d3", "ping 192.168.2.99")
    assert "0 percent (0/5)" in out and "Destination Unreachable" in out and "code 1" in out, out
    load(missing)
    out = cmd("d3", "ping 192.168.2.2")
    assert "0 percent (0/5)" in out and "Destination Unreachable" in out and "code 0" in out, out
    print(
        "PASS: ping failure reports actual returned ICMP instead of a topology-only rejection",
        flush=True,
    )
    # A warmed cache is not an ARP failure: an Ethernet black hole must remain silent.
    load()
    assert "100 percent" in cmd("d3", "ping 192.168.2.2")
    cmd("d5", "device power off")
    out = cmd("d3", "trace 192.168.2.2 max-hops 4")
    assert "!H" not in out and "!N" not in out and rows(out)[-1].strip() == "4  *", out
    events = cmd("d3", "show ethernet events")
    assert (
        "cached-neighbor-no-reply d2" in events and "icmp-destination-unreachable" not in events
    ), events
    cold = copy.deepcopy(base)
    cold["devices"][4]["enabled"] = False
    load(cold)
    assert "!H" in cmd("d3", "trace 192.168.2.2 max-hops 4")
    svi = copy.deepcopy(base)
    svi["devices"][6]["interfaces"]["vlan1"] = dict(
        ip="192.168.1.10", mask="255.255.255.0", enabled=True, vlan=1
    )
    svi["devices"][6]["gateway"] = "192.168.1.1"
    load(svi)
    assert "!H" in cmd("d7", "trace 192.168.2.99 max-hops 4")
    print(
        "PASS: warm-cache silence vs cold ARP failure; real unreachable return to SVI", flush=True
    )
    load()
    for target in ["224.0.0.1", "255.255.255.255", "192.168.2.255"]:
        out = cmd("d3", "trace " + target + " max-hops 3")
        assert "!N" not in out and "!H" not in out, out
        assert "icmp-error-suppressed" in cmd("d3", "show ethernet events")
    print("PASS: no ICMP error replies for multicast/limited or directed broadcast", flush=True)
    # A host used as a static next-hop can answer ARP without forwarding IP: it is not an ARP failure.
    host_hop = copy.deepcopy(base)
    transit = copy.deepcopy(base["devices"][6])
    transit.update(id="d9", name="Transit")
    host = copy.deepcopy(base["devices"][3])
    host.update(id="d10", name="NextHopPC", ip="10.0.0.9", gateway="", vlan=1)
    # This is a new synthetic host, not a second NIC with the original PC's physical MAC.
    host.pop("mac", None)
    host_hop["devices"] += [transit, host]
    host_hop["devices"][0]["staticRoutes"][0]["nextHop"] = "10.0.0.9"
    host_hop["devices"][0]["interfaces"]["g0/1"]["mask"] = "255.255.255.0"
    host_hop["devices"][1]["interfaces"]["g0/0"]["mask"] = "255.255.255.0"
    host_hop["links"] = [
        link for link in host_hop["links"] if {link["a"], link["b"]} != {"d1", "d2"}
    ]
    host_hop["links"] += [
        dict(a="d1", portA="g0/1", b="d9", portB="fa0/1", up=True),
        dict(a="d2", portA="g0/0", b="d9", portB="fa0/2", up=True),
        dict(a="d10", portA="eth0", b="d9", portB="fa0/3", up=True),
    ]
    host_hop["nextId"] = 11
    load(host_hop)
    out = cmd("d3", "trace 192.168.2.2 max-hops 3")
    assert "!H" not in out and "!N" not in out and rows(out)[-1].strip() == "3  *", out
    assert "10.0.0.9" in cmd("d1", "show arp")
    print(
        "PASS: ARP-responsive non-forwarding host is not reported as Host Unreachable", flush=True
    )
    assert not errors, errors
    browser.close()
