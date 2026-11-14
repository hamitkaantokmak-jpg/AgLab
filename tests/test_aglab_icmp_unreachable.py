"""Only delivered ICMP Destination Unreachable terminates the trace as !N/!H."""

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

    # I-1: içe aktarılan topoloji Labber'da. PC terminali VPCS: `trace <hedef> -m N` (eski
    # `max-hops N` VPCS'te yok). ICMP unreachable satırı: "*<router> … (ICMP type:3, code:1,
    # Destination host unreachable)". IOS rota yokken de kod 1 (host unreachable) gönderir
    # (UYUMLULUK_MATRISI L4); eski motor rota yokta !N/kod 0 yazıyordu. Olaylar Labber
    # Simulation Mode izinden (ping) okunur.
    def rows(out):
        return [line for line in out.splitlines() if re.match(r"^\s*\d+\s", line)]

    def events():
        return "\n".join(
            e.get("raw", "") for e in page.evaluate("aglabLabberSession.trace()")["events"]
        )

    UNREACH = "(ICMP type:3, code:1, Destination host unreachable)"
    missing = copy.deepcopy(base)
    missing["devices"][0]["staticRoutes"] = []
    load(missing)
    out = cmd("d3", "trace 192.168.2.2 -m 4")
    hops = rows(out)
    assert len(hops) == 2 and "*192.168.1.1" in hops[-1] and UNREACH in hops[-1], out
    cmd("d3", "ping 192.168.2.2")
    ev = events()
    assert "frame icmp-unreachable" in ev and "icmp-unreachable d3 from d1 code 1" in ev, ev
    load()
    out = cmd("d3", "trace 192.168.2.99 -m 5")
    hops = rows(out)
    # son router (R2) bağlı ağda ARP'yi çözemez: host unreachable (IOS; motor bulgusu I-1)
    assert len(hops) == 3 and "*10.0.0.2" in hops[-1] and UNREACH in hops[-1], out
    assert "bytes from" not in out, out
    cmd("d3", "ping 192.168.2.99")
    assert "icmp-unreachable d3 from d2 code 1" in events()
    print("PASS: returned network/host unreachable after actual route/ARP failure", flush=True)
    # IOS: çıkış ACL'i router'ın kendi ürettiği ICMP'yi süzmez (eski motor R2 g0/0 out ile
    # süzüyordu). Dönen hatanın yolda süzülmesi R1'in girişinde sınanır: R2 kaynaklı ICMP R1'e
    # giremez, iz yanıtsız kalır.
    blocked = copy.deepcopy(base)
    r1 = blocked["devices"][0]
    r1["acls"] = [
        dict(
            id="101", action="deny", protocol="icmp", srcType="host", src="10.0.0.2", dstType="any"
        ),
        dict(id="101", action="permit", protocol="ip", srcType="any", dstType="any"),
    ]
    r1["interfaces"]["g0/1"]["aclIn"] = "101"
    load(blocked)
    out = cmd("d3", "trace 192.168.2.99 -m 4")
    hops = rows(out)
    assert len(hops) == 4 and hops[-1].strip() == "4     *  *  *" and "unreachable" not in out, out
    cmd("d3", "ping 192.168.2.99")
    ev = events()
    assert "icmp-undelivered d3" in ev and "icmp-unreachable d3" not in ev, ev
    no_return = copy.deepcopy(base)
    no_return["devices"][1]["staticRoutes"] = []
    load(no_return)
    out = cmd("d3", "trace 192.168.2.99 -m 4")
    assert "unreachable" not in out and rows(out)[-1].strip() == "4     *  *  *", out
    print(
        "PASS: blocked/missing error return remains silent, no fabricated terminal response",
        flush=True,
    )
    load()
    out = cmd("d3", "ping 192.168.2.99")
    assert "bytes from" not in out and "*10.0.0.2 icmp_seq=1" in out and UNREACH in out, out
    load(missing)
    out = cmd("d3", "ping 192.168.2.2")
    assert "bytes from" not in out and "*192.168.1.1 icmp_seq=1" in out and UNREACH in out, out
    print(
        "PASS: ping failure reports actual returned ICMP instead of a topology-only rejection",
        flush=True,
    )
    # Sıcak ARP önbelleği: hedef sonradan kapanırsa router çerçeveyi gönderir, yanıt gelmez
    load()
    assert cmd("d3", "ping 192.168.2.2").count("84 bytes from 192.168.2.2") == 5
    cmd("d5", "device power off")
    out = cmd("d3", "trace 192.168.2.2 -m 4")
    assert "unreachable" not in out and rows(out)[-1].strip() == "4     *  *  *", out
    cold = copy.deepcopy(base)
    cold["devices"][4]["enabled"] = False
    load(cold)
    assert UNREACH in cmd("d3", "trace 192.168.2.2 -m 4")
    # switch SVI'si (IOS traceroute): dönen unreachable !H
    svi = copy.deepcopy(base)
    svi["devices"][6]["interfaces"]["vlan1"] = dict(
        ip="192.168.1.10", mask="255.255.255.0", enabled=True, vlan=1
    )
    svi["devices"][6]["gateway"] = "192.168.1.1"
    load(svi)
    cmd("d7", "enable")
    assert "!H" in cmd("d7", "traceroute 192.168.2.99")
    print(
        "PASS: warm-cache silence vs cold ARP failure; real unreachable return to SVI", flush=True
    )
    # RFC 1812 / IOS: çok yöncü, sınırlı yayın ve yönlendirilmiş yayın hedeflerine ICMP hatası yok
    load()
    for target in ["224.0.0.1", "255.255.255.255", "192.168.2.255"]:
        out = cmd("d3", "trace " + target + " -m 3")
        assert "unreachable" not in out, out
        cmd("d3", "ping " + target)
        assert "icmp-error-suppressed" in events(), (target, events())
    print("PASS: no ICMP error replies for multicast/limited or directed broadcast", flush=True)
    # A host used as a static next-hop can answer ARP without forwarding IP: it is not an ARP failure.
    host_hop = copy.deepcopy(base)
    transit = copy.deepcopy(base["devices"][6])
    transit.update(id="d9", name="Transit")
    host = copy.deepcopy(base["devices"][3])
    host.update(id="d10", name="NextHopPC", ip="10.0.0.9", gateway="", vlan=1)
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
    out = cmd("d3", "trace 192.168.2.2 -m 3")
    assert "unreachable" not in out and rows(out)[-1].strip() == "3     *  *  *", out
    assert "10.0.0.9" in cmd("d1", "show ip arp")
    print(
        "PASS: ARP-responsive non-forwarding host is not reported as Host Unreachable", flush=True
    )
    assert not errors, errors
    browser.close()
