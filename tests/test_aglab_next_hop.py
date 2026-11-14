"""Shared transit LAN must follow selected next-hop, including recursive and return paths."""

import copy, re, json, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium

# L7b: eski motorun modülü (ürüne gömülü olduğu denetlenirdi) kaldırıldı; davranış Labber'da sınanır.


def iface(ip):
    return dict(ip=ip, mask="255.255.255.0", enabled=True)


def route(network, hop, distance=1, mask="255.255.255.0"):
    return dict(network=network, mask=mask, nextHop=hop, distance=distance)


def node(id, kind, interfaces, **extra):
    return dict(
        id=id,
        name=id,
        type=kind,
        x=100,
        y=100,
        w=108,
        h=72,
        enabled=True,
        ports=list(interfaces),
        interfaces=interfaces,
        ip="",
        mask="",
        gateway="",
        **extra,
    )


def link(a, pa, b, pb):
    return dict(a=a, portA=pa, b=b, portB=pb, up=True)


a = node("d1", "PC", {"eth0": {"enabled": True}}, vlan=77)
a.update(ip="192.168.1.2", mask="255.255.255.0", gateway="192.168.1.1")
b = node("d2", "PC", {"eth0": {"enabled": True}}, vlan=77)
b.update(ip="192.168.2.2", mask="255.255.255.0", gateway="192.168.2.1")
r1 = node(
    "d3",
    "Router",
    {"g0/0": iface("192.168.1.1"), "g0/1": iface("10.0.0.1")},
    staticRoutes=[route("192.168.2.0", "10.0.0.3")],
)
r2 = node(
    "d4",
    "Router",
    {"g0/0": iface("10.0.0.2"), "g0/1": iface("192.168.2.1")},
    staticRoutes=[route("192.168.1.0", "10.0.0.1")],
)
r3 = node("d5", "Router", {"g0/0": iface("10.0.0.3")}, staticRoutes=[])
sw = node(
    "d6",
    "Switch",
    {f"fa0/{i}": dict(mode="access", vlan=77, allowed=[77], enabled=True) for i in (1, 2, 3)},
    vlans=[1, 77],
)
base = dict(
    app="AgLab",
    version=23,
    devices=[a, b, r1, r2, r3, sw],
    links=[
        link("d1", "eth0", "d3", "g0/0"),
        link("d3", "g0/1", "d6", "fa0/1"),
        link("d4", "g0/0", "d6", "fa0/2"),
        link("d5", "g0/0", "d6", "fa0/3"),
        link("d4", "g0/1", "d2", "eth0"),
    ],
    nextId=7,
)
with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
    browser = launch_chromium(pw)
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
    path = Path(tmp) / "routing.json"

    def load(obj):
        before = page.locator("#ptTerminal > div").count()
        path.write_text(json.dumps(obj))
        page.locator("#ptImportFile").set_input_files(str(path))
        page.wait_for_function(
            'n=>document.querySelector("#ptTerminal").children.length>n', arg=before
        )
        out = "\n".join(page.locator("#ptTerminal > div").all_text_contents()[before:])
        assert "Topoloji doğrulandı ve içe aktarıldı" in out, out

    def cmd(device, text):
        before = page.locator("#ptTerminal > div").count()
        page.evaluate(
            "([id,text])=>{document.querySelector('#ptCliDevice').value=id;document.querySelector('#ptCliInput').value=text;document.querySelector('#ptCliForm').requestSubmit()}",
            [device, text],
        )
        return "\n".join(page.locator("#ptTerminal > div").all_text_contents()[before:])

    # I-1: içe aktarılan topoloji Labber'da. PC (d1, d2) terminali VPCS: başarı 5 yanıt satırı;
    # router/switch IOS: ilk ping'de ARP için ilk paket kaybolabilir (".!!!!", %80).
    def ok(out, target="192.168.2.2"):
        if "Success rate is" in out:
            return bool(re.search(r"Success rate is (80|100) percent", out))
        return out.count("84 bytes from " + target) == 5

    def ping(success, device="d1"):
        out = cmd(device, "ping 192.168.2.2")
        assert ok(out) == success, out

    load(base)
    ping(False)
    ping(False, "d3")
    good = copy.deepcopy(base)
    good["devices"][2]["staticRoutes"] = [route("192.168.2.0", "10.0.0.2")]
    load(good)
    ping(True)
    # The selected R3 can legitimately hairpin through the same transit switch to R2.
    hairpin = copy.deepcopy(base)
    hairpin["devices"][4]["staticRoutes"] = [route("192.168.2.0", "10.0.0.2")]
    load(hairpin)
    ping(True)
    # R3'ün 192.168.1.0/24 rotası yok: Time Exceeded'i dönemez (2. atlama sessiz); iz hedefte biter
    trace = cmd("d1", "trace 192.168.2.2")
    assert re.search(r"^ 2 +\*  \*  \*$", trace, re.M) and "10.0.0.3" not in trace, trace
    assert "Destination port unreachable" in trace, trace
    cmd("d1", "ping 192.168.2.2 -T 2")
    raw = [e.get("raw", "") for e in page.evaluate("aglabLabberSession.trace()")["events"]]
    assert "ttl-expired d5" in raw, raw
    print(
        "PASS: dead selected next-hop rejected; valid selected path and same-LAN hairpin followed",
        flush=True,
    )
    # A route existing on every forward router is insufficient if the actual reverse next-hop dead-ends.
    reverse = copy.deepcopy(good)
    reverse["devices"][3]["staticRoutes"] = [route("192.168.1.0", "10.0.0.3")]
    load(reverse)
    ping(False)
    reverse["devices"][4]["staticRoutes"] = [route("192.168.1.0", "10.0.0.1")]
    load(reverse)
    ping(True)
    # dönüş R3'ten geçer: switch R3'ün g0/0 MAC'ini öğrenir (IOS arayüz MAC'i)
    mac_rows = cmd("d6", "show mac address-table")
    assert "0200.0000.0501" in mac_rows, mac_rows
    # An ACL on a reverse-only router must apply to the actual asymmetric reply.
    for c in [
        "enable",
        "configure terminal",
        "access-list 101 deny icmp any any",
        "interface g0/0",
        "ip access-group 101 in",
        "end",
    ]:
        cmd("d5", c)
    ping(False)
    # süzülen paket R2'nin yanıtıdır: R3'ün ICMP bildirimi yanıtın kaynağına (d2) gider, d1 yalnız
    # zaman aşımı görür. Süzme R3'ün ACL sayacında görünür.
    assert re.search(r"deny\s+icmp any any \(\d+ match", cmd("d5", "show access-lists")), cmd(
        "d5", "show access-lists"
    )
    for c in ["configure terminal", "interface g0/0", "no ip access-group 101 in", "end"]:
        cmd("d5", c)
    ping(True)
    # Recursive resolution must forward to the final wire neighbor, not the logical recursive IP.
    for hop, expected in [("10.0.0.3", False), ("10.0.0.2", True)]:
        recursive = copy.deepcopy(base)
        recursive["devices"][2]["staticRoutes"] = [
            route("192.168.2.0", "203.0.113.9"),
            route("203.0.113.9", hop, mask="255.255.255.255"),
        ]
        load(recursive)
        ping(expected)
    print("PASS: actual asymmetric reverse path and recursive wire next-hop", flush=True)
    # No fallback to another neighbor or floating route while the preferred route still resolves.
    preferred = copy.deepcopy(base)
    preferred["devices"][2]["staticRoutes"] = [
        route("192.168.2.0", "10.0.0.3", 1),
        route("192.168.2.0", "10.0.0.2", 10),
    ]
    load(preferred)
    ping(False)
    preferred["devices"][2]["staticRoutes"].pop(0)
    load(preferred)
    ping(True)
    lpm = copy.deepcopy(base)
    lpm["devices"][2]["staticRoutes"] = [
        route("0.0.0.0", "10.0.0.2", mask="0.0.0.0"),
        route("192.168.2.0", "10.0.0.3"),
    ]
    load(lpm)
    ping(False)
    lpm["devices"][2]["staticRoutes"].pop()
    load(lpm)
    ping(True)
    loop = copy.deepcopy(base)
    loop["devices"][4]["staticRoutes"] = [route("192.168.2.0", "10.0.0.1")]
    load(loop)
    ping(False)
    print("PASS: AD, longest-prefix, no silent fallback and routing-loop termination", flush=True)
    # A remote router address still requires a valid source gateway; a local router address does not.
    gateway = copy.deepcopy(good)
    gateway["devices"][0]["gateway"] = ""
    load(gateway)
    # VPCS: ağ geçidi yokken uzak hedef "host (…) not reachable"; yerel router adresi yanıt verir
    assert "host (10.0.0.2) not reachable" in cmd("d1", "ping 10.0.0.2")
    assert ok(cmd("d1", "ping 192.168.1.1"), "192.168.1.1")
    gateway["devices"][0]["gateway"] = "10.0.0.2"
    load(gateway)
    # bağlı ağda olmayan ağ geçidi kullanılamaz
    assert "bytes from" not in cmd("d1", "ping 10.0.0.2")
    # Logical subinterface numbers are not the dot1Q wire VLAN or physical ingress port.
    tagged = copy.deepcopy(good)
    for index, physical, logical, ip in [
        (2, "g0/1", "g0/1.5000", "10.0.0.1"),
        (3, "g0/0", "g0/0.9000", "10.0.0.2"),
        (4, "g0/0", "g0/0.12345", "10.0.0.3"),
    ]:
        tagged["devices"][index]["interfaces"][physical]["ip"] = ""
        tagged["devices"][index]["interfaces"][logical] = dict(
            ip=ip,
            mask="255.255.255.0",
            enabled=True,
            parent=physical,
            encapsulation="dot1q",
            vlan=77,
        )
    for intf in tagged["devices"][5]["interfaces"].values():
        intf.update(mode="trunk", nativeVlan=1)
    load(tagged)
    ping(True)
    tagged["devices"][2]["staticRoutes"] = [route("192.168.2.0", "10.0.0.3")]
    load(tagged)
    ping(False)
    # Changing the route in the real CLI must recover the failed flow.
    for c in [
        "enable",
        "configure terminal",
        "no ip route 192.168.2.0 255.255.255.0 10.0.0.3",
        "ip route 192.168.2.0 255.255.255.0 10.0.0.2",
        "end",
    ]:
        cmd("d3", c)
    ping(True)
    print(
        "PASS: source gateway, arbitrary dot1Q subinterface IDs and CLI route recovery", flush=True
    )
    origin = copy.deepcopy(good)
    origin["devices"][3]["staticRoutes"] = []
    load(origin)
    ping(True, "d3")
    ping(False)
    print("PASS: router-origin source address follows the egress interface", flush=True)
    # A management SVI can use R3 as its gateway even when the incoming route arrived through R2.
    svi = copy.deepcopy(good)
    svi["devices"][5]["interfaces"]["vlan77"] = dict(
        ip="10.0.0.6", mask="255.255.255.0", enabled=True, vlan=77
    )
    svi["devices"][5]["gateway"] = "10.0.0.3"
    svi["devices"][4]["staticRoutes"] = [route("192.168.2.0", "10.0.0.2")]
    load(svi)
    svi_output = cmd("d2", "ping 10.0.0.6")
    assert ok(svi_output, "10.0.0.6"), svi_output
    ping(True, "d6")
    rows = cmd("d6", "show mac address-table")
    assert any("0200.0000.0501" in line and "Fa0/3" in line for line in rows.splitlines()), rows
    print("PASS: asymmetric management SVI gateway and gateway MAC port", flush=True)
    assert not errors, errors
    browser.close()
