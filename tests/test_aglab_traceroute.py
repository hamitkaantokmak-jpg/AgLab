"""ICMP traceroute must display returned replies, never the topology's hidden path."""

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
    path = Path(tmp) / "trace.json"

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

    # I-1: içe aktarılan topoloji Labber'da. PC terminali VPCS: `trace <hedef> [-m N]` (UDP
    # sondası; hedef "Destination port unreachable" ile yanıtlar — eski motorun Windows tarzı
    # "Echo Reply"si yok). Router/switch IOS `traceroute`. Labber Simulation Mode izi yalnız
    # ping'i kaydeder (UYUMLULUK_MATRISI L5-i); sondanın gerçek paket olduğu NAT tablosundan
    # doğrulanır.
    def rows(output):
        return [line for line in output.splitlines() if re.match(r"^\s*\d+\s", line)]

    PORT = "Destination port unreachable"
    load()
    out = cmd("d3", "trace 192.168.2.2 -m 5")
    hops = rows(out)
    assert (
        len(hops) == 3
        and "192.168.1.1" in hops[0]
        and "10.0.0.2" in hops[1]
        and "*192.168.2.2" in hops[2]
        and PORT in hops[2]
    ), out
    assert len(rows(cmd("d3", "trace 192.168.1.3"))) == 1
    cmd("d1", "enable")
    tr = rows(cmd("d1", "traceroute 10.0.0.2"))
    assert len(tr) == 1 and "10.0.0.2" in tr[0], tr  # IOS'ta `tracert` yok
    print(
        "PASS: returned ICMP router hops, port-unreachable completion, IOS traceroute and local delivery",
        flush=True,
    )
    # R2 kaynaklı ICMP R1'in girişinde süzülür: 2. atlama sessiz, hedefin yanıtı yine gelir.
    # (IOS: R2'nin çıkış ACL'i R2'nin kendi ürettiği ICMP'yi süzmez.)
    silent = copy.deepcopy(base)
    r1 = silent["devices"][0]
    r1["acls"] = [
        dict(
            id="101", action="deny", protocol="icmp", srcType="host", src="10.0.0.2", dstType="any"
        ),
        dict(id="101", action="permit", protocol="ip", srcType="any", dstType="any"),
    ]
    r1["interfaces"]["g0/1"]["aclIn"] = "101"
    load(silent)
    out = cmd("d3", "trace 192.168.2.2 -m 4")
    hops = rows(out)
    assert (
        len(hops) == 3
        and hops[1].strip() == "2     *  *  *"
        and "10.0.0.2" not in out
        and PORT in hops[2]
    ), out
    print(
        "PASS: silent router stays hidden while a later reply still completes the trace", flush=True
    )
    load()
    out = cmd("d3", "trace 192.168.2.2 -m 1")
    assert len(rows(out)) == 1 and PORT not in out, out
    out = cmd("d3", "trace 192.168.2.99 -m 4")
    hops = rows(out)
    assert (
        len(hops) == 3
        and "192.168.1.1" in hops[0]
        and "10.0.0.2" in hops[1]
        and "Destination host unreachable" in hops[2]
        and PORT not in out
    ), out
    # Yönlendirme döngüsü gerçek TTL tüketir
    loop = copy.deepcopy(base)
    loop["devices"][0]["staticRoutes"].append(
        dict(network="198.51.100.0", mask="255.255.255.0", nextHop="10.0.0.2", distance=1)
    )
    loop["devices"][1]["staticRoutes"].append(
        dict(network="198.51.100.0", mask="255.255.255.0", nextHop="10.0.0.1", distance=1)
    )
    load(loop)
    out = cmd("d3", "trace 198.51.100.2 -m 5")
    hops = rows(out)
    assert (
        len(hops) == 5
        and "192.168.1.1" in hops[0]
        and "10.0.0.2" in hops[1]
        and "10.0.0.1" in hops[2]
        and PORT not in out
    ), out
    print("PASS: hop bound, unknown-host partial discovery and routing-loop TTL expiry", flush=True)
    before = page.locator("#ptTerminal > div").count()
    elapsed = page.evaluate(
        "()=>{const t=performance.now();document.querySelector('#ptCliDevice').value='d3';document.querySelector('#ptCliInput').value='trace 198.51.100.2 -m 64';document.querySelector('#ptCliForm').requestSubmit();return performance.now()-t}"
    )
    out = "\n".join(page.locator("#ptTerminal > div").all_text_contents()[before:])
    hops = rows(out)
    assert len(hops) == 64 and "10.0.0.2" in hops[-1], out
    assert elapsed < 5000, elapsed
    print("PASS: 64-hop loop bounded; browser elapsed_ms", round(elapsed, 1), flush=True)
    svi = copy.deepcopy(base)
    svi["devices"][6]["interfaces"]["vlan1"] = dict(
        ip="192.168.1.10", mask="255.255.255.0", enabled=True, vlan=1
    )
    svi["devices"][6]["gateway"] = "192.168.1.1"
    load(svi)
    cmd("d7", "enable")
    tr = rows(cmd("d7", "traceroute 192.168.2.2"))
    assert "192.168.2.2" in tr[-1] and "!H" not in tr[-1], tr
    # VPCS: -m 1..255; geçersiz biçimler hata satırı
    for invalid in [
        "trace",
        "trace invalid",
        "trace 192.168.2.2 extra",
        "trace 192.168.2.2 -m 0",
        "trace 192.168.2.2 -m 256",
        "trace 192.168.2.2 -m 1.5",
    ]:
        out = cmd("d3", invalid)
        assert "outerr" in (
            page.locator("#ptTerminal > div").last.get_attribute("class") or ""
        ), out
    print("PASS: SVI origin and strict trace command validation", flush=True)
    load()
    assert len(rows(cmd("d3", "trace 192.168.2.1 -m 4"))) == 2
    # Sonraki router'da rota yokluğu önceki Time Exceeded yanıtlarını engellemez
    missing = copy.deepcopy(base)
    missing["devices"][0]["staticRoutes"].append(
        dict(network="198.51.100.0", mask="255.255.255.0", nextHop="10.0.0.2", distance=1)
    )
    load(missing)
    out = cmd("d3", "trace 198.51.100.2 -m 3")
    hops = rows(out)
    assert (
        len(hops) == 3
        and "192.168.1.1" in hops[0]
        and "10.0.0.2" in hops[1]
        and "Destination host unreachable" in hops[2]
    ), out
    # PAT (L5-d) traceroute'u destekler: sondalar çevrilir, NAT tablosunda udp girdisi
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
    out = cmd("d3", "trace 192.168.2.2 -m 4")
    assert PORT in rows(out)[-1], out
    cmd("d1", "enable")
    nat_rows = cmd("d1", "show ip nat translations")
    assert "udp  10.0.0.1:" in nat_rows, nat_rows
    print("PASS: local destination router TTL, later missing route and PAT traceroute", flush=True)
    assert not errors, errors
    browser.close()
