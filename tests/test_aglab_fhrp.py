"""FHRP (HSRP + VRRP) çalışma alanında Labber'da: içe aktarma, seçim, devir, preempt, track,
grup uyuşmazlığı, PC trafiğinin yeni aktiften geçmesi, dışa aktarma gidiş-dönüşü ve eski motor
kararında görünür uyarı. Beklenen çıktılar Cisco IOS 15 / VPCS biçimidir."""

import json
import re
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium, import_topology, ping_succeeded


def switch(id, ports):
    return dict(
        id=id,
        name=id.upper(),
        type="Switch",
        x=200,
        y=100,
        w=112,
        h=72,
        enabled=True,
        vlans=[1],
        ports=ports,
        interfaces={
            p: dict(mode="access", vlan=1, allowed=[1], nativeVlan=1, enabled=True) for p in ports
        },
    )


def host(id, ip, gw, kind="PC"):
    return dict(
        id=id,
        name=id.upper(),
        type=kind,
        x=50,
        y=200,
        w=104,
        h=72,
        enabled=True,
        ip=ip,
        mask="255.255.255.0",
        gateway=gw,
        ports=["eth0"],
        interfaces={"eth0": {"enabled": True}},
    )


def router(id, n, lan, wan):
    return dict(
        id=id,
        name=id.upper(),
        type="Router",
        x=300,
        y=100 * n,
        w=108,
        h=72,
        enabled=True,
        ports=["g0/0", "g0/1"],
        interfaces={
            "g0/0": dict(ip="192.168.1." + str(n + 1), mask="255.255.255.0", enabled=True, **lan),
            "g0/1": dict(ip="192.168.2." + str(n + 1), mask="255.255.255.0", enabled=True, **wan),
        },
        staticRoutes=[],
    )


def topology(r1_lan, r2_lan, r1_wan=None, r2_wan=None):
    """PC — SW1 — {R1, R2} — SW2 — SRV. LAN VIP .1.254 (PC ağ geçidi), sunucu tarafı VIP
    .2.254 (sunucunun ağ geçidi; dönüş trafiği de FHRP'den geçer)."""
    wan = dict(hsrp=[dict(group=2, ip="192.168.2.254")])
    return dict(
        app="AgLab",
        version=23,
        devices=[
            host("pc", "192.168.1.10", "192.168.1.254"),
            switch("sw1", ["fa0/1", "fa0/2", "fa0/3"]),
            router("r1", 1, r1_lan, r1_wan if r1_wan is not None else wan),
            router("r2", 2, r2_lan, r2_wan if r2_wan is not None else wan),
            switch("sw2", ["fa0/1", "fa0/2", "fa0/3"]),
            host("srv", "192.168.2.10", "192.168.2.254", "Server"),
        ],
        links=[
            dict(a="pc", portA="eth0", b="sw1", portB="fa0/1", up=True),
            dict(a="r1", portA="g0/0", b="sw1", portB="fa0/2", up=True),
            dict(a="r2", portA="g0/0", b="sw1", portB="fa0/3", up=True),
            dict(a="r1", portA="g0/1", b="sw2", portB="fa0/2", up=True),
            dict(a="r2", portA="g0/1", b="sw2", portB="fa0/3", up=True),
            dict(a="srv", portA="eth0", b="sw2", portB="fa0/1", up=True),
        ],
        nextId=7,
    )


with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
    browser = launch_chromium(pw)
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
    page.click('[data-area="lab"]')
    path = Path(tmp) / "fhrp.json"

    def load(obj):
        path.write_text(json.dumps(obj))
        import_topology(page, path)

    def cmd(device, text):
        before = page.locator("#ptTerminal > div").count()
        page.evaluate(
            "([id,t])=>{document.querySelector('#ptCliDevice').value=id;"
            "document.querySelector('#ptCliInput').value=t;"
            "document.querySelector('#ptCliForm').requestSubmit()}",
            [device, text],
        )
        return "\n".join(page.locator("#ptTerminal > div").all_text_contents()[before:])

    def ios(device, *lines):
        return "\n".join(cmd(device, line) for line in lines)

    def ping(target="192.168.2.10"):
        return ping_succeeded(cmd("pc", "ping " + target), target)

    def first_router():
        """Simulation Mode izi: PC'nin isteğini ilk alan router (Labber olay adaptörü)."""
        raw = [e.get("raw", "") for e in page.evaluate("aglabLabberSession.trace()")["events"]]
        hit = [r for r in raw if re.match(r"receive r[12] icmp-request", r)]
        return hit[0].split()[1] if hit else None

    # 1) HSRP: R1 öncelik 110 → Active; PC trafiği R1'den
    load(
        topology(
            dict(hsrp=[dict(group=1, ip="192.168.1.254", priority=110)]),
            dict(hsrp=[dict(group=1, ip="192.168.1.254")]),
        )
    )
    assert page.evaluate("aglabLabberSession.active()"), "FHRP topolojisi Labber kararında olmalı"
    assert "Labber" in page.locator("#workspaceEngine").inner_text()
    ios("r1", "enable")
    ios("r2", "enable")
    brief = cmd("r1", "show standby brief")
    assert re.search(
        r"Gi0/0\s+1\s+110\s+Active\s+local\s+192\.168\.1\.3\s+192\.168\.1\.254", brief
    ), brief
    assert re.search(
        r"Gi0/0\s+1\s+100\s+Standby\s+192\.168\.1\.2\s+local", cmd("r2", "show standby brief")
    )
    assert ping(), "PC → sunucu, ağ geçidi VIP"
    assert first_router() == "r1"
    assert "00:00:0c:07:ac:01  192.168.1.254" in cmd("pc", "show arp")
    print("PASS: HSRP election, VIP ARP with virtual MAC, PC traffic via Active", flush=True)

    # 2) Active'in gücü kesilir → Standby devralır; PC trafiği R2'den
    cmd("r1", "device power off")
    assert re.search(r"Gi0/0\s+1\s+100\s+Active\s+local", cmd("r2", "show standby brief"))
    assert ping()
    assert first_router() == "r2"
    # preempt yok: R1 açılınca geri almaz
    cmd("r1", "device power on")
    ios("r1", "enable")
    assert re.search(r"Gi0/0\s+1\s+110\s+Standby", cmd("r1", "show standby brief"))
    assert ping() and first_router() == "r2"
    # preempt ile geri alır
    ios("r1", "configure terminal", "interface g0/0", "standby 1 preempt", "end")
    assert re.search(r"Gi0/0\s+1\s+110 P Active\s+local", cmd("r1", "show standby brief"))
    assert ping() and first_router() == "r1"
    assert "%HSRP-5-STATECHANGE: Gi0/0 Grp 1 state Standby -> Active" in "\n".join(
        page.locator("#ptTerminal > div").all_text_contents()
    )
    print("PASS: power failover, no-preempt hold, preempt takeover", flush=True)

    # 3) Dışa aktarma: CLI'de eklenen preempt AğLab JSON'unda; yeniden içe aktarma aynı durum
    page.locator("#uxMoreLabActions").click()
    with page.expect_download() as download:
        page.locator("#ptExport").click()
    exported = Path(tmp) / "export.json"
    download.value.save_as(str(exported))
    saved = json.loads(exported.read_text())
    r1 = next(d for d in saved["devices"] if d["id"] == "r1")
    assert r1["interfaces"]["g0/0"]["hsrp"] == [
        dict(group=1, ip="192.168.1.254", priority=110, preempt=True)
    ], r1["interfaces"]["g0/0"]
    import_topology(page, exported)
    ios("r1", "enable")
    assert re.search(r"Gi0/0\s+1\s+110 P Active", cmd("r1", "show standby brief"))
    print("PASS: export/import round trip keeps CLI-configured HSRP", flush=True)

    # 4) Track: R1 g0/1 düşünce 110-20=90 < R2 100 (preempt) → R2 Active
    obj = topology(
        dict(
            hsrp=[
                dict(
                    group=1,
                    ip="192.168.1.254",
                    priority=110,
                    preempt=True,
                    track=[dict(object=1, decrement=20)],
                )
            ]
        ),
        dict(hsrp=[dict(group=1, ip="192.168.1.254", preempt=True)]),
    )
    obj["devices"][2]["tracks"] = [dict(id=1, interface="g0/1")]
    load(obj)
    assert page.evaluate("aglabLabberSession.active()")
    ios("r1", "enable")
    assert "track 1 interface GigabitEthernet0/1 line-protocol" in cmd("r1", "show running-config")
    ios("r1", "configure terminal", "interface g0/1", "shutdown", "end")
    out = cmd("r1", "show standby")
    assert (
        "Priority 90 (configured 110)" in out and "Track object 1 state Down decrement 20" in out
    ), out
    ios("r2", "enable")
    assert re.search(r"Gi0/0\s+1\s+100 P Active\s+local", cmd("r2", "show standby brief"))
    assert ping() and first_router() == "r2"
    ios("r1", "configure terminal", "interface g0/1", "no shutdown", "end")
    assert re.search(r"Gi0/0\s+1\s+110 P Active", cmd("r1", "show standby brief"))
    print("PASS: interface tracking decrement hands over and preempts back", flush=True)

    # 5) Grup uyuşmazlığı: R2 grup 2 → iki Active, Standby bilinmiyor
    load(
        topology(
            dict(hsrp=[dict(group=1, ip="192.168.1.254", priority=110)]),
            dict(hsrp=[dict(group=2, ip="192.168.1.254")]),
        )
    )
    ios("r2", "enable")
    assert re.search(r"Gi0/0\s+2\s+100\s+Active\s+local\s+unknown", cmd("r2", "show standby brief"))
    print("PASS: group mismatch gives two Active routers", flush=True)

    # 6) VRRP: preempt varsayılan açık; yeni Master; sanal MAC 0000.5e00.01XX
    vr = lambda p=None: dict(
        vrrp=[dict(group=1, ip="192.168.1.254", **({"priority": p} if p else {}))]
    )
    wan_v = dict(vrrp=[dict(group=2, ip="192.168.2.254")])
    load(topology(vr(), vr(), wan_v, wan_v))
    ios("r1", "enable")
    ios("r2", "enable")
    # eşit öncelik: yüksek adres (R2 .3) Master
    assert re.search(
        r"Gi0/0\s+1\s+100 3609\s+Y\s+Master\s+192\.168\.1\.3", cmd("r2", "show vrrp brief")
    )
    assert ping() and first_router() == "r2"
    ios("r1", "configure terminal", "interface g0/0", "vrrp 1 priority 120", "end")
    assert re.search(
        r"Gi0/0\s+1\s+120 3531\s+Y\s+Master\s+192\.168\.1\.2", cmd("r1", "show vrrp brief")
    )
    assert ping() and first_router() == "r1"
    assert "00:00:5e:00:01:01  192.168.1.254" in cmd("pc", "show arp")
    # iki router da kapalıyken PC dışarı çıkamaz (başarısız iletim)
    cmd("r1", "device power off")
    cmd("r2", "device power off")
    assert not ping()
    print("PASS: VRRP default preempt, Master/Backup, virtual MAC, total outage fails", flush=True)

    # 7) Eski motor kararında FHRP sessizce kaybolmaz: rozet söyler
    legacy = topology(dict(hsrp=[dict(group=1, ip="192.168.1.254")]), {})
    legacy["devices"][1]["staticRoutes"] = []  # switch'te statik rota: köprü desteklemez
    load(legacy)
    assert not page.evaluate("aglabLabberSession.active()")
    assert "HSRP/VRRP eski motorda modellenmez" in page.locator("#workspaceEngine").inner_text()
    # geçersiz grup reddedilmez (validateTopologyData); köprü nedeni rozette
    bad = topology(dict(hsrp=[dict(group=300, ip="192.168.1.254")]), {})
    load(bad)
    badge = page.locator("#workspaceEngine").inner_text()
    assert "Reddedildi" in badge and "HSRP" in badge, badge
    print(
        "PASS: legacy decision reports FHRP visibly; invalid group goes to the bridge", flush=True
    )
    assert not errors, errors
    browser.close()
