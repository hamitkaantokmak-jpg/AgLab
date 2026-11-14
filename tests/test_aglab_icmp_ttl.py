"""TTL decreases only at IP forwarding routers; ICMP expiry is really returned."""

import copy, json, re, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
from aglab_test_support import ROOT, launch_chromium

# L7b: eski motorun modülü (ürüne gömülü olduğu denetlenirdi) kaldırıldı; davranış Labber'da sınanır.
base = json.loads((ROOT / "static-routing-two-routers.aglab.json").read_text())
with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
    browser = launch_chromium(pw)
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
    path = Path(tmp) / "ttl.json"

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

    # I-1: içe aktarılan topoloji Labber'da. PC terminali VPCS: TTL `ping <hedef> -T N` ile verilir
    # (eski `ttl N` sözdizimi VPCS'te yok); Time Exceeded satırı "TTL expired in transit".
    # Olaylar Labber Simulation Mode izinden (aglabLabberSession.trace) okunur.
    def ping(ttl, success, device="d3", target="192.168.2.2"):
        out = cmd(device, "ping " + target + " -T " + str(ttl))
        assert out.count("84 bytes from " + target) == (5 if success else 0), out
        return out

    def events():
        return "\n".join(
            e.get("raw", "") for e in page.evaluate("aglabLabberSession.trace()")["events"]
        )

    load()
    out = ping(1, False)
    assert "TTL expired in transit" in out and "*192.168.1.1 " in out, out
    ev = events()
    assert "ttl-expired d1" in ev and "frame icmp-time-exceeded" in ev, ev
    assert "icmp-time-exceeded d3 from d1" in ev, ev
    assert "receive d5 icmp-request" not in ev, ev
    out = ping(2, False)
    assert "TTL expired in transit" in out and "*10.0.0.2 " in out, out
    ev = events()
    assert "ttl-expired d2" in ev and "receive d5 icmp-request" not in ev, ev
    ping(3, True)
    ev = events()
    assert "ttl-forward d1 3 -> 2" in ev and "ttl-forward d2 2 -> 1" in ev, ev
    assert "ttl-forward d2 64 -> 63" in ev, ev  # yanıt: PC 64 ile gönderir, R2 azaltır
    ping(255, True)
    assert cmd("d3", "ping 192.168.2.2").count("84 bytes from 192.168.2.2") == 5
    print(
        "PASS: TTL 1/2 expiry, real Time Exceeded reply and TTL 3/default/255 delivery", flush=True
    )
    # Switch'ler TTL'i azaltmaz; hedef router'ın kendisiyse TTL tükenmez
    ping(1, True, target="192.168.1.3")
    ping(1, True, target="192.168.1.1")
    # Router'ın kendi trafiği TTL'i baştan başlatır: IOS traceroute'ta TTL 1 sondası bir sonraki
    # router'da biter (R1'in kendisi saymaz)
    cmd("d1", "enable")
    tr = cmd("d1", "traceroute 192.168.2.2")
    assert re.search(r"^ +1 10\.0\.0\.2 ", tr, re.M) and re.search(
        r"^ +2 192\.168\.2\.2 ", tr, re.M
    ), tr
    print(
        "PASS: bridges and local destination routers do not consume TTL; router origin starts unchanged",
        flush=True,
    )
    # TTL R1'de biterse sonraki router'daki ACL sonucu etkilemez
    later = copy.deepcopy(base)
    r2 = later["devices"][1]
    r2["acls"] = [dict(id="101", action="deny", protocol="icmp", srcType="any", dstType="any")]
    r2["interfaces"]["g0/1"]["aclOut"] = "101"
    load(later)
    assert "TTL expired in transit" in ping(1, False)
    out = ping(3, False)
    assert "unreachable" in out, out  # R2 süzer: ICMP unreachable (IOS)
    # IOS: çıkış ACL'i router'ın kendi ürettiği paketlere uygulanmaz. R1'in g0/0 çıkış ACL'i
    # R1'in Time Exceeded'ini süzmez (eski motor süzüyordu); iletilen yankıyı ise süzer.
    blocked = copy.deepcopy(base)
    r1 = blocked["devices"][0]
    r1["acls"] = [dict(id="102", action="deny", protocol="icmp", srcType="any", dstType="any")]
    r1["interfaces"]["g0/0"]["aclOut"] = "102"
    load(blocked)
    assert "TTL expired in transit" in ping(1, False)
    ping(3, False)  # R2'den dönen yanıt R1 g0/0'dan çıkarken süzülür
    assert "icmp-delivered d3" not in events()
    print(
        "PASS: later-hop ACL does not mask expiry; router-originated ICMP is not filtered outbound",
        flush=True,
    )
    load()
    for bad in ["0", "256", "1.5", "-1", "NaN", "1 extra"]:
        out = cmd("d3", "ping 192.168.2.2 -T " + bad)
        assert "outerr" in (page.locator("#ptTerminal > div").last.get_attribute("class") or ""), (
            bad,
            out,
        )
        assert "bytes from" not in out, out
    print("PASS: invalid TTL rejected", flush=True)
    # R2'nin 192.168.1.0/24 rotası yok: Time Exceeded R2'den dönemez (zaman aşımı)
    no_return = copy.deepcopy(base)
    no_return["devices"][1]["staticRoutes"] = []
    load(no_return)
    out = ping(2, False)
    assert "timeout" in out and "TTL expired" not in out, out
    # hedef PC'nin ağ geçidi yok: TTL 1 R1'den döner, TTL 3'te yanıt dönemez
    no_gateway = copy.deepcopy(base)
    no_gateway["devices"][4]["gateway"] = ""
    load(no_gateway)
    assert "TTL expired in transit" in ping(1, False)
    assert "timeout" in ping(3, False)
    # switch SVI'si (IOS): traceroute ilk atlamada ağ geçidini gösterir
    svi = copy.deepcopy(base)
    svi["devices"][6]["interfaces"]["vlan1"] = dict(
        ip="192.168.1.10", mask="255.255.255.0", enabled=True, vlan=1
    )
    svi["devices"][6]["gateway"] = "192.168.1.1"
    load(svi)
    cmd("d7", "enable")
    tr = cmd("d7", "traceroute 192.168.2.2")
    assert re.search(r"^ +1 192\.168\.1\.1 ", tr, re.M) and re.search(r"192\.168\.2\.2 ", tr), tr
    print("PASS: missing ICMP return route, later missing gateway and SVI TTL", flush=True)
    # PAT: TTL inside router'da biter (NAT'tan önce) → çeviri yazılmaz; normal ping çevrilir
    nat = copy.deepcopy(base)
    r1 = nat["devices"][0]
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
    load(nat)
    assert "TTL expired in transit" in ping(1, False)
    cmd("d1", "enable")
    assert "icmp" not in cmd("d1", "show ip nat translations").split("Outside global")[-1]
    assert cmd("d3", "ping 192.168.2.2").count("84 bytes from 192.168.2.2") == 5
    assert "icmp 10.0.0.1" in cmd("d1", "show ip nat translations")
    # L7b: eski motorun "Paket adımı" ilerleticisi (router kaynaklı paketin TTL 64 ile çıkışı)
    # eski motorla birlikte kaldırıldı; TTL'nin yalnız router'da azalması yukarıda Labber'da
    # (ping ttl / Time Exceeded) sınanır.
    print("PASS: PAT expiry before translation", flush=True)
    assert not errors, errors
    browser.close()
