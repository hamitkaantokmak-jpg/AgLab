#!/usr/bin/env python3
"""Derive structural eligibility from the actual 40 immutable student labs.

Eligibility is not an execution claim. No teacher solutions are consumed.

Labber köprüsü sütunu ve senaryo tablosu (L1): her Akademi labının başlangıç
topolojisi ve tüm ortak Sorun Çöz senaryolarının yüklenmiş başlangıç topolojisi, derlenmiş
HTML'deki köprüye (`AgLabSim.toLabber`) verilir; motor kararı ve gerekçeleri yazılır.
Senaryoların bir kısmının topolojisi kodla kurulduğu için tarayıcı (Playwright) gerekir.
CI, tests/test_lab_engine_map.py ile tablonun bu kararlarla güncel olduğunu doğrular.
"""

import hashlib, json, os, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "real-lab"))
from shared_topology import convert
from routed_topology import convert as convert_routed


def bridge_decisions(browser):
    """Köprü kararları: {'academy': {lab_id: report}, 'scenarios': [(id, title, report)]}."""
    page = browser.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
    page.click('[data-area="lab"]')
    decide = "(t) => { const r = AgLabSim.toLabber(t).report; return { decision: r.engineDecision, reasons: r.reasons }; }"
    academy = {}
    for p in sorted((ROOT / "academy/student").glob("AGL-*.json")):
        lab = json.loads(p.read_text(encoding="utf-8"))
        academy[lab["id"]] = page.evaluate(decide, lab["initial_topology"])
    scenarios = []
    for rec in page.evaluate("aglabSharedEngine.recipes()"):
        page.evaluate("(id)=>aglabSharedEngine.load(id)", rec["id"])
        snap = page.evaluate("academyEngine.snapshot()")
        scenarios.append((rec["id"], rec["title"], page.evaluate(decide, snap)))
    # E: Labber'ın kendi labları; lab tanımı doğrudan Labber'da (köprü kullanılmaz).
    labber_labs = page.evaluate(
        "() => AgLabSim.LABBER_LABS.map((l) => ({ id: l.id, title: l.title, level: l.level,"
        " devices: l.devices.length, links: l.links.length, objectives: l.objectives.length,"
        " tags: l.tags }))"
    )
    page.close()
    if errors:
        raise RuntimeError("Sayfa hatası: " + "; ".join(errors))
    return {"academy": academy, "scenarios": scenarios, "labber_labs": labber_labs}


def _decision_cell(report, academy=False):
    if report["decision"] == "labber":
        # L2-D2: Labber kararındaki Akademi labının ölçütleri Labber'da değerlendirilir.
        return "**Labber** — ölçütler Labber'da" if academy else "**Labber**"
    return "Eski motor: " + "; ".join(r.replace("|", "/") for r in report["reasons"])


def render(browser):
    decisions = bridge_decisions(browser)
    lines = [
        "# Akademi laboratuvar–motor haritası",
        "",
        "Bu tablo gerçek öğrenci JSON içeriklerinden üretilir. Yapısal adaylık, aktarım veya başarılı native test anlamına gelmez. AğLab JS mevcut görev/grading motorudur. MIT yalnız access LAN karşılaştırmasıdır. Linux bridge dönüştürücüsü sınırlı PC/switch ormanlarını kabul eder. FRR dönüştürücüsü sınırlı PC/router ve VLAN1 access-köprü şemasını ayrı doğrular; şema kabulü native test başarısı değildir.",
        "",
        "| Lab | Gerçek konu | Cihaz/bağ | AğLab JS | Labber köprüsü (L1) | MIT NetSim | Linux bridge | FRR | Öğrenci JSON SHA256 |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for p in sorted((ROOT / "academy/student").glob("AGL-*.json")):
        raw = p.read_bytes()
        lab = json.loads(raw)
        t = lab["initial_topology"]
        ds = t["devices"]
        router = any(d["type"] == "Router" for d in ds)
        trunk = any(c.get("mode") == "trunk" for d in ds for c in d.get("interfaces", {}).values())
        vlan = any(c.get("vlan", 1) != 1 for d in ds for c in d.get("interfaces", {}).values())
        mit = (
            "Yok (routing)"
            if router
            else (
                "Sınırlı aday; unused trunk portları da reddedilir"
                if trunk
                else "Access LAN adayı; görev/CLI aktarılmaz"
            )
        )
        if router:
            linux = "L2 dönüştürücü değil; FRR yoluna bakınız"
        else:
            try:
                convert(t)
                linux = "Başlangıç şeması kabul edilir; native görev testi yok"
            except ValueError as error:
                linux = (
                    "Başlangıç reddedilir: " + str(error) + "; onarım sonrası yeniden değerlendir"
                )
        if lab["id"] == "AGL-024":
            linux = "Native arıza/onarım senaryosu; sonuç CI kanıtında"
        frr = "Gerekmez"
        if router:
            try:
                convert_routed(t)
                frr = "Başlangıç şeması kabul; native görev testi yok"
            except ValueError as error:
                frr = "Başlangıç reddedilir: " + str(error)
            if lab["id"] in ("AGL-034", "AGL-035"):
                frr = "Başlangıç/çözüm native CI geçti (a1d6382; kanıt aşağıda)"
        lines.append(
            f"| {lab['id']} | {lab['title'].replace('|','/')} | {len(ds)}/{len(t['links'])} | Mevcut | {_decision_cell(decisions['academy'][lab['id']], academy=True)} | {mit} | {linux} | {frr} | `{hashlib.sha256(raw).hexdigest()}` |"
        )
    scen = decisions["scenarios"]
    lines.extend(
        [
            "",
            "## Ortak motor senaryoları (Sorun Çöz)",
            "",
            "Senaryo yüklendikten sonraki başlangıç topolojisi köprüye verilir.",
            "",
            "| Senaryo | Başlık | Labber köprüsü (L1) |",
            "|---|---|---|",
        ]
    )
    for sid, title, report in scen:
        lines.append(f"| `{sid}` | {title.replace('|', '/')} | {_decision_cell(report)} |")
    labber_labs = decisions["labber_labs"]
    lines.extend(
        [
            "",
            "## Labber labları (E)",
            "",
            "Labber simülatörünün kendi labları (`src/labs`, kullanıcının içeriği). Ayrı içerik",
            "grubudur; Akademi labları ve SHA256 kayıtlarıyla karışmaz. Lab tanımı (LabDef)",
            "köprü kullanılmadan doğrudan Labber'da kurulur; terminal Labber oturumudur, hedefler",
            "`rt.objectives()` ile değerlendirilir. Hepsi Labber.",
            "",
            "| Lab | Başlık | Seviye | Cihaz/bağ | Hedef | Konular | Motor |",
            "|---|---|---|---|---|---|---|",
        ]
    )
    for l in labber_labs:
        lines.append(
            f"| `{l['id']}` | {l['title'].replace('|', '/')} | {l['level']} | "
            f"{l['devices']}/{l['links']} | {l['objectives']} | "
            f"{', '.join(l['tags']).replace('|', '/')} | **Labber** — LabDef doğrudan |"
        )
    everything = list(decisions["academy"].values()) + [r for _, _, r in scen]
    reasons = {}
    for r in everything:
        for reason in r["reasons"]:
            reasons[reason] = reasons.get(reason, 0) + 1
    count = lambda rows: (
        sum(r["decision"] == "labber" for r in rows),
        sum(r["decision"] != "labber" for r in rows),
    )
    a_lab, a_leg = count(list(decisions["academy"].values()))
    s_lab, s_leg = count([r for _, _, r in scen])
    lines.extend(
        [
            "",
            "## Labber köprüsü özeti (L1)",
            "",
            "Karar köprünün yapısal sonucudur: `labber`, içeriğin bütün alanlarının Labber'a",
            "eşlendiği anlamına gelir. Ürün kararı içerik yüklenirken aynı köprüden alır ve",
            "ekranda gösterir. `labber` kararındaki ortak senaryonun başarı ölçütü (L2-D1) ve",
            "Akademi labının ölçütleri (L2-D2: `probe.icmp` → LabQuery.ping, `state.equals` →",
            "toAglab görünümü) Labber'da değerlendirilir.",
            "L3-a'dan beri Labber kararındaki içerikte terminal de Labber'dadır (tek kalıcı",
            "çalışma zamanı). L4'ten beri Router (routed portlar), statik rotada yönetimsel",
            "uzaklık ve özyinelemeli next-hop, AğLab OSPF alanları (pid, routerId, networks) ve",
            "servissiz sunucu (uç) da Labber'dadır; kaynak arayüzlü ICMP ölçütü Labber'da",
            "değerlendirilir. L5-a'dan beri router alt arayüzü (802.1Q, router-on-a-stick)",
            "da Labber'dadır. Eski motor kararı aşağıdaki gerekçelerden en az birine dayanır.",
            "",
            "| Grup | Labber | Eski motor | Toplam |",
            "|---|---|---|---|",
            f"| Akademi labları | {a_lab} | {a_leg} | {a_lab + a_leg} |",
            f"| Ortak senaryolar | {s_lab} | {s_leg} | {s_lab + s_leg} |",
            f"| Labber labları | {len(labber_labs)} | 0 | {len(labber_labs)} |",
            f"| Toplam | {a_lab + s_lab + len(labber_labs)} | {a_leg + s_leg} | {a_lab + a_leg + s_lab + s_leg + len(labber_labs)} |",
            "",
            "| Eski motor gerekçesi | İçerik sayısı |",
            "|---|---|",
        ]
    )
    for reason, n in sorted(reasons.items(), key=lambda x: (-x[1], x[0])):
        lines.append(f"| {reason.replace('|', '/')} | {n} |")
    lines.extend(
        [
            "",
            "ACL/NAT için security_smoke ayrı native operatör örnekleridir; mevcut 40 görevin ACL/NAT alanlarını dönüştürdüğü veya native doğruladığı iddia edilmez. ACL 28 ve SNAT/PAT 21 native kontrolü [CI 42205155584 / 6f651fe](https://github.com/hamitkaantokmak-jpg/AgLab/actions/runs/42205155584) güvenlik işlerinde geçti; görev aktarımı sayılmaz.",
            "",
            "AGL-034/035 native kanıtı: [42192382258, a1d6382](https://github.com/hamitkaantokmak-jpg/AgLab/actions/runs/42192382258), `aglab-integration-routed_smoke` artefaktı. Diğer labların dönüştürücü kabulü native başarı iddiası değildir.",
            "",
            "AGL-024 gerçekte dört PC, iki switch, VLAN10 ve VLAN20 içerir; örnek görev tablosundan varsayım yapılmamıştır. Native test ilk VLAN10 başarısızlığını, uplink trunk onarımını ve iki VLAN’ın gerçek ICMP trafiğini denetler. AGL-034/035 özgün başlangıç/çözüm topolojileri değiştirilmeden FRR kabul takımına bağlandı; başlangıç arızası, CLI rota onarımı, ICMP, RIB/FIB ve shutdown/no shutdown native CI’da geçti. Yeni IPv6/multi-area ve bağımsız iki/üç router örnekleri özgün 40 lab dışında operatör senaryolarıdır.",
            "",
        ]
    )
    return "\n".join(lines)


if __name__ == "__main__":
    from playwright.sync_api import sync_playwright

    with sync_playwright() as pw:
        kwargs = {"headless": True}
        if os.environ.get("AGLAB_CHROMIUM"):
            kwargs["executable_path"] = os.environ["AGLAB_CHROMIUM"]
        browser = pw.chromium.launch(**kwargs)
        text = render(browser)
        browser.close()
    (ROOT / "docs/LAB_MOTOR_HARITASI.md").write_text(text, encoding="utf-8")
