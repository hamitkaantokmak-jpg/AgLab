"""Routed ICMP uses real per-neighbor ARP and Ethernet FDB decisions, including SVI."""

import json, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium, ping_succeeded

# L7b: eski motorun modülü (ürüne gömülü olduğu denetlenirdi) kaldırıldı; davranış Labber'da sınanır.


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

    # I-1: içe aktarılan topoloji Labber'da. PC terminali VPCS, router/switch IOS; olaylar Labber
    # Simulation Mode izinden (aglabLabberSession.trace). Labber izi ARP çerçevesi üretmez (L3-b);
    # komşu ARP'si `show arp` (VPCS) / `show ip arp` (IOS) tablolarından doğrulanır.
    def ping(device, target, success=True):
        out = cmd(device, "ping " + target)
        assert ping_succeeded(out, target) == success, out

    def events():
        return "\n".join(
            e.get("raw", "") for e in page.evaluate("aglabLabberSession.trace()")["events"]
        )

    load()
    ping("d1", "192.168.2.2")
    ev = events()
    assert "receive d5 icmp-request" in ev and "receive d6 icmp-request" in ev, ev
    assert "ttl-forward d5 64 -> 63" in ev and "ttl-forward d6 63 -> 62" in ev, ev
    assert "receive d2 icmp-request" in ev and "icmp-delivered d1 from d2" in ev, ev
    arp = cmd("d1", "show arp")
    assert "192.168.1.1" in arp and "192.168.2.2" not in arp, arp
    cmd("d5", "enable")
    arp = cmd("d5", "show ip arp")
    assert "10.0.0.2" in arp and "192.168.2.2" not in arp, arp
    cmd("d6", "enable")
    assert "192.168.2.2" in cmd("d6", "show ip arp")
    # sıcak FDB: ikinci ping'de çerçeve hedefe unicast gider, d7'ye taşmaz
    ping("d1", "192.168.2.2")
    assert "receive d7" not in events(), events()
    print("PASS: real per-hop ARP, routed request/reply and warm FDB unicast", flush=True)
    # L7b: eski motordaki "Paket adımı" ve bayat FDB (taşınan host) bölümü eski motorla birlikte
    # kaldırıldı: Labber iletimi FDB'den değil topolojiden hesaplar (bayat FDB modellenmez;
    # UYUMLULUK_MATRISI "L7b"), "Paket adımı"nın karşılığı Simulation Mode'dur.
    # Yönetim SVI'si (Labber): yerel/uzak teslim, ağ geçidi ARP'si, shutdown ve geri dönüş
    obj["devices"][3]["interfaces"]["vlan10"] = dict(
        ip="192.168.2.10", mask="255.255.255.0", enabled=True, vlan=10
    )
    obj["devices"][3]["gateway"] = "192.168.2.1"
    load()
    ping("d1", "192.168.2.10")
    ping("d4", "192.168.1.2")
    ping("d2", "192.168.2.10")
    cmd("d4", "enable")
    arp = cmd("d4", "show ip arp")
    assert "192.168.2.1" in arp and "192.168.1.2" not in arp, arp
    for c in ["configure terminal", "interface vlan 10", "shutdown", "end"]:
        cmd("d4", c)
    ping("d1", "192.168.2.10", False)
    for c in ["configure terminal", "interface vlan 10", "no shutdown", "end"]:
        cmd("d4", c)
    ping("d1", "192.168.2.10")
    print("PASS: local/remote SVI frame delivery, gateway ARP and shutdown recovery", flush=True)
    # PAT (L5-d): Labber çerçeveleri çevrilmiş adresle taşır; dönüş rotası olmayan R2 yine yanıtlar
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
    assert "receive d6 icmp-request" in events() and "frame icmp-request" in events()
    cmd("d5", "enable")
    assert "icmp 10.0.0.1:" in cmd("d5", "show ip nat translations").replace("  ", " ")
    print("PASS: PAT frames carried with translated source (Labber)", flush=True)
    assert not errors, errors
    browser.close()
