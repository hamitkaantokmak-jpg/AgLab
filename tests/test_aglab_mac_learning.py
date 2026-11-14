"""Dynamic MAC ingress-port, VLAN scope, routing boundary and aging in Chromium."""

import json, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium, import_topology

# L7b: eski motorun modülü (ürüne gömülü olduğu denetlenirdi) kaldırıldı; davranış Labber'da sınanır.


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
        import_topology(page, path)

    def cmd(device, text):
        before = page.locator("#ptTerminal > div").count()
        page.evaluate(
            "([id,text])=>{document.querySelector('#ptCliDevice').value=id;document.querySelector('#ptCliInput').value=text;document.querySelector('#ptCliForm').requestSubmit()}",
            [device, text],
        )
        return "\n".join(page.locator("#ptTerminal > div").all_text_contents()[before:])

    def ping(device, target):
        # I-1: çalışma alanı Labber'da; PC terminali VPCS (başarı: 5 adet "84 bytes from")
        out = cmd(device, "ping " + target)
        assert out.count("84 bytes from " + target) == 5, out

    def dynamic(device):
        # Labber `show mac address-table` IOS biçiminde: dinamik girdiler DYNAMIC satırları
        out = cmd(device, "show mac address-table")
        return [line for line in out.splitlines() if "DYNAMIC" in line]

    def row(device, mac, port, vlan=10):
        # IOS port yazımı kısa ve büyük harfle (Fa0/1, Gi0/1); karşılaştırma harf duyarsız
        rows = [line for line in dynamic(device) if mac in line]
        assert any(
            line.split()[0] == str(vlan) and port.lower() in line.lower() for line in rows
        ), (device, mac, port, vlan, rows)

    # L7b: eski motorun "Paket adımı" ilerleticisiyle adım adım öğrenme bölümü eski motorla
    # birlikte kaldırıldı (Labber'da adım ilerleticisi yok; paketin yolu Simulation Mode'dadır).
    # Labber: gerçek trafik (ping) kaynak MAC'leri giriş portlarında öğretir
    load(obj)
    ping("d3", "192.168.10.3")
    # IOS: `clear mac address-table` ayrıcalıklı EXEC'tedir; kullanıcı kipinde tanınmayan
    # kelime ana bilgisayar adı sayılır (Translating "clear" … % Unknown command or computer name)
    out = cmd("d1", "clear mac address-table dynamic")
    assert "% Unknown command or computer name" in out, out
    row("d1", "0200.0000.0003", "fa0/1")
    row("d1", "0200.0000.0004", "gi0/1")
    row("d2", "0200.0000.0003", "gi0/1")
    row("d2", "0200.0000.0004", "fa0/2")
    print("PASS: source MAC learned on ingress ports on both switches", flush=True)
    # IOS mac address-table aging-time 300 s (Labber motor bulgusu, MOTOR_BULGULARI.md):
    # son trafikten 300 s sonra dinamik girdi düşer, yeni trafik yeniden öğretir.
    page.evaluate("window.macTestTime=Date.now();Date.now=()=>window.macTestTime")
    ping("d3", "192.168.10.3")
    page.evaluate("window.macTestTime+=299999")
    row("d1", "0200.0000.0003", "fa0/1")
    page.evaluate("window.macTestTime+=1")
    assert dynamic("d1") == [], dynamic("d1")
    ping("d3", "192.168.10.3")
    row("d1", "0200.0000.0003", "fa0/1")
    # Shutdown ve access VLAN değişikliği porttaki dinamik girdileri siler (IOS)
    for c in ["enable", "configure terminal", "interface fa0/1", "shutdown", "end"]:
        cmd("d1", c)
    assert not any("0200.0000.0003" in line for line in dynamic("d1")), dynamic("d1")
    for c in ["configure terminal", "interface fa0/1", "no shutdown", "end"]:
        cmd("d1", c)
    ping("d3", "192.168.10.3")
    for c in ["configure terminal", "interface fa0/1", "switchport access vlan 20", "end"]:
        cmd("d1", c)
    assert not any("0200.0000.0003" in line for line in dynamic("d1")), dynamic("d1")
    print("PASS: 300-second aging, relearning, shutdown and VLAN invalidation", flush=True)
    load(obj)
    ping("d3", "192.168.10.3")
    cmd("d1", "enable")
    cmd("d1", "clear mac address-table dynamic")
    assert dynamic("d1") == [], dynamic("d1")
    row("d2", "0200.0000.0003", "gi0/1")
    ping("d3", "192.168.10.3")
    row("d1", "0200.0000.0003", "fa0/1")
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
    # IOS: router'ın her fiziksel arayüzünün kendi MAC'i vardır; alt arayüzler (g0/0.10,
    # g0/0.20) üst arayüzün MAC'ini paylaşır. Eski motor cihaz başına tek MAC kullanıyordu;
    # Labber arayüz MAC'i verir. Router g0/0 MAC'i, Gi0/2'de iki VLAN'da birden görülen adrestir.
    on_gi2 = [line.split() for line in dynamic("d1") if "gi0/2" in line.lower()]
    router_mac = next(
        m for v, m, *_ in on_gi2 if v == "10" and any(x[0] == "20" and x[1] == m for x in on_gi2)
    )
    assert router_mac not in ("0200.0000.0003", "0200.0000.0004"), on_gi2
    row("d1", router_mac, "gi0/2", 10)
    row("d1", router_mac, "gi0/2", 20)
    ping("d3", "192.168.20.2")
    out = dynamic("d2")
    assert not any("0200.0000.0003" in line and line.split()[0] == "20" for line in out), out
    row("d2", router_mac, "gi0/1", 20)
    print("PASS: clear/relearn, same MAC in two VLANs and router source-MAC rewrite", flush=True)
    assert not errors, errors
    browser.close()
