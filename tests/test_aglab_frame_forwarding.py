"""Ethernet forwarding in Labber: MAC learning, VLAN isolation and Simulation Mode frame events."""

import json, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium, import_topology

# L7b: eski motorun modülü (ürüne gömülü olduğu denetlenirdi) kaldırıldı; davranış Labber'da sınanır.


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
    # L7b: eski motorun `test ethernet` / `show ethernet events` komutları (gerçek IOS/VPCS
    # komutu değil) eski motorla birlikte kaldırıldı. Aynı öğretim Labber'daki gerçek
    # karşılığıyla sınanır: IOS `show mac address-table` (öğrenme, giriş portu, VLAN kapsamı)
    # ve VPCS ping'i (VLAN yalıtımı). Labber'da olmayan ve bu yüzden sınanmayanlar (UYUMLULUK_
    # MATRISI "L7b"): bilinmeyen unicast taşırmasının ayrı olay olarak gösterilmesi, FDB yaşlanma
    # zamanlayıcısı, bayat FDB ile yanlış porta iletim (Labber iletimi topolojiden hesaplar).
    path.write_text(json.dumps(obj))
    import_topology(page, path)
    assert page.evaluate("aglabLabberSession.active()")

    def cmd(device, text):
        before = page.locator("#ptTerminal > div").count()
        page.evaluate(
            "([id,text])=>{document.querySelector('#ptCliDevice').value=id;document.querySelector('#ptCliInput').value=text;document.querySelector('#ptCliForm').requestSubmit()}",
            [device, text],
        )
        return "\n".join(page.locator("#ptTerminal > div").all_text_contents()[before:])

    def cisco_mac(device):
        mac = next(
            line.split(":", 1)[1].strip()
            for line in cmd(device, "show ip").splitlines()
            if line.startswith("MAC")
        )
        raw = mac.replace(":", "").lower()
        return ".".join(raw[i : i + 4] for i in (0, 4, 8))

    def mac_rows(switch):
        rows = {}
        for line in cmd(switch, "show mac address-table").splitlines():
            parts = line.split()
            if len(parts) == 4 and parts[2].upper() == "DYNAMIC":
                rows[parts[1].lower()] = (int(parts[0]), parts[3].lower())
        return rows

    page.click('[data-area="lab"]')
    assert page.locator("#packetDetectiveRefresh").is_visible()
    page.click("#packetDetectiveRefresh")
    assert "Henüz görüntülenecek" in page.locator("#packetDetectiveStatus").inner_text()
    assert "Tanılama için önce" in page.locator("#packetDetectiveDiagnosis").inner_text()
    assert page.locator("#packetDetectiveGoToDevice").is_disabled()
    assert page.locator("#packetDetectiveNext").is_disabled()
    assert page.locator("#packetDetectivePrevious").is_disabled()
    macs = {d: cisco_mac(d) for d in ("d3", "d4", "d5", "d6")}
    assert len(set(macs.values())) == 4, macs
    # Trafik yokken dinamik kayıt yok.
    assert not set(macs.values()) & set(mac_rows("d1")), mac_rows("d1")
    # Aynı VLAN'da ping: kaynak MAC'ler giriş portunda ve VLAN 10'da öğrenilir.
    assert "bytes from 192.168.10.3" in cmd("d3", "ping 192.168.10.3")
    sw1, sw2 = mac_rows("d1"), mac_rows("d2")
    assert sw1[macs["d3"]] == (10, "fa0/1") and sw1[macs["d4"]] == (10, "gi0/1"), sw1
    assert sw2[macs["d4"]] == (10, "fa0/2") and sw2[macs["d3"]] == (10, "gi0/1"), sw2
    # Hiç göndermeyen PC (d5, aynı VLAN) ve VLAN 20'deki PC (d6) öğrenilmez.
    assert macs["d5"] not in sw1 and macs["d6"] not in sw2, (sw1, sw2)
    print(
        "PASS: Labber MAC learning per ingress port and VLAN (show mac address-table)", flush=True
    )
    # VLAN yalıtımı: d6 aynı IP alt ağına alınsa da VLAN 20'deki erişim portundan VLAN 10'a
    # ulaşamaz; MAC'i VLAN 10'da öğrenilmez. (Gerçek IOS başarısız ARP isteğinin kaynağını VLAN
    # 20'de öğrenir; Labber yalnız teslim edilen trafikten öğrenir; bilinen fark, UYUMLULUK_
    # MATRISI "L7b". Bu yüzden VLAN 20 kaydı burada iddia edilmez.)
    cmd("d6", "ip 192.168.10.6 255.255.255.0")
    out = cmd("d6", "ping 192.168.10.5")
    assert "bytes from" not in out, out
    assert all(v[0] != 10 for m, v in mac_rows("d2").items() if m == macs["d6"])
    assert macs["d6"] not in mac_rows("d1")
    # Sorunu gidermek (d6'nın portunu VLAN 10'a almak) erişimi açar.
    cmd("d2", "enable")
    cmd("d2", "configure terminal")
    cmd("d2", "interface fa0/1")
    cmd("d2", "switchport access vlan 10")
    cmd("d2", "end")
    assert "bytes from 192.168.10.5" in cmd("d6", "ping 192.168.10.5")
    assert mac_rows("d2")[macs["d6"]] == (10, "fa0/1")
    print("PASS: Labber VLAN isolation and recovery (ping + show mac address-table)", flush=True)

    # L3-b: Labber içeriğinde (Sorun Çöz senaryosu) çerçeve olayları Labber olay
    # adaptöründen gelir: başarısız iletimde kablo aktarımı yok, ret ve "teslim edilmedi";
    # başarılı iletimde istek ve yanıt AğLab bağlantılarıyla birebir eşleşen kablolarda.
    def labber_trace(source, target):
        page.evaluate(
            "([s, t]) => { try { aglabSharedEngine.commandBlock(s, ['ping ' + t]) } catch (e) {} }",
            [source, target],
        )
        return page.evaluate("""() => {
              const ls = academyEngine.snapshot().links, ds = academyEngine.snapshot().devices;
              const name = (id) => ds.find((d) => d.id === id).name;
              const t = aglabLabberSession.trace();
              return { origin: t.origin, l2: t.l2, kinds: t.events.map((e) => e.kind),
                wires: t.events.filter((e) => e.kind === 'wire').map((e) => [
                  e.frame.kind, name(e.edge.a), name(e.edge.b),
                  AgLabSimulationPlayback.matchWire(e, ls), e.frame.ipv4.ttl]),
                last: t.events.at(-1).raw };
            }""")

    page.evaluate("aglabSharedEngine.load('vlan-wrong-access')")
    failed = labber_trace("PC-01", "192.168.10.12")
    assert failed["origin"] == "labber" and failed["wires"] == [], failed
    assert "discard" in failed["kinds"] and failed["last"].startswith("icmp-undelivered"), failed
    page.evaluate(
        "aglabSharedEngine.commandBlock('SW1', ['enable', 'configure terminal',"
        " 'interface fa0/1', 'switchport access vlan 10', 'end'])"
    )
    ok = labber_trace("PC-01", "192.168.10.12")
    assert ok["l2"] and ok["last"].startswith("icmp-delivered"), ok
    assert [w[:3] for w in ok["wires"]] == [
        ["icmp-request", "PC-01", "SW1"],
        ["icmp-request", "SW1", "SW2"],
        ["icmp-request", "SW2", "PC-02"],
        ["icmp-reply", "PC-02", "SW2"],
        ["icmp-reply", "SW2", "SW1"],
        ["icmp-reply", "SW1", "PC-01"],
    ], ok
    assert all(w[3] >= 0 and w[4] == 64 for w in ok["wires"]), ok
    print("PASS: Labber content frame events (failure and success)", flush=True)
    assert not errors, errors
    browser.close()
