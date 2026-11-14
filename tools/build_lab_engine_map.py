#!/usr/bin/env python3
"""Derive structural eligibility from the actual 40 immutable student labs.

Eligibility is not an execution claim. No teacher solutions are consumed.

Labber sütunu ve senaryo tablosu: her Akademi labının başlangıç topolojisi ve tüm ortak Sorun
Çöz senaryolarının yüklenmiş başlangıç topolojisi, derlenmiş HTML'deki köprüye
(`AgLabSim.toLabber`) verilir; Labber'da ifade edilebilirlik ve gerekçeleri yazılır (L7b: tek
motor; ifade edilemeyen içerik "simüle edilemiyor" olarak açılır, başka motora düşmez).
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
    decide = "(t) => { const r = AgLabSim.toLabber(t).report; return { decision: r.expressible ? 'labber' : 'unsupported', reasons: r.reasons }; }"
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
    # L6: motor kullanmayan eski içerik. Yol ürünün kendisinden okunur: Sorun Çöz görev listesi,
    # "Hazır deneyler" bağlantıları ve atölyelerde her seçeneğin açtığı görünüm.
    legacy = {
        "tasks": page.evaluate(
            "TROUBLESHOOT_TASKS.map((t) => ({ id: t.id, title: t.title, target: t.target || null }))"
        ),
        "experiments": page.evaluate(
            "() => [...document.querySelectorAll('#labExperimentLinks [data-shared-scenario]')]"
            ".map((b) => ({ id: b.dataset.experiment, title: b.textContent, target: b.dataset.sharedScenario }))"
        ),
        "workshops": page.evaluate("""() => {
              const out = [], pick = (sel, v) => { const e = document.querySelector(sel); e.value = v; e.dispatchEvent(new Event('change')); };
              for (const o of document.querySelectorAll('#routeCalcScenario option')) {
                pick('#routeCalcScenario', o.value);
                const shared = !document.getElementById('routeCalcShared').hidden;
                out.push({ workshop: 'Rota', id: o.value, title: o.textContent,
                  target: shared ? document.getElementById('routeCalcSharedOpen').dataset.sharedScenario : null,
                  view: shared ? null : 'labber' });
              }
              for (const o of document.querySelectorAll('#protoScenario option')) {
                pick('#protoScenario', o.value);
                const shared = !document.getElementById('protoShared').hidden;
                const concept = document.getElementById('protoBadge').textContent.includes('MOTOR YOK');
                out.push({ workshop: 'Protokol', id: o.value, title: o.textContent,
                  target: shared ? 'ospf-area-mismatch' : null, view: shared ? null : concept ? 'concept' : 'labber' });
              }
              out.push({ workshop: 'Rota', id: 'diagnostic', title: document.getElementById('routeDiagTitle').textContent,
                target: null, view: document.getElementById('routeDiagBadge').textContent.includes('MOTOR YOK') ? 'concept' : 'labber' });
              return out;
            }"""),
    }
    page.close()
    if errors:
        raise RuntimeError("Sayfa hatası: " + "; ".join(errors))
    return {
        "academy": academy,
        "scenarios": scenarios,
        "labber_labs": labber_labs,
        "legacy": legacy,
    }


def _decision_cell(report, academy=False):
    if report["decision"] == "labber":
        # L2-D2: Labber kararındaki Akademi labının ölçütleri Labber'da değerlendirilir.
        return "**Labber** — ölçütler Labber'da" if academy else "**Labber**"
    return "Simüle edilemiyor: " + "; ".join(r.replace("|", "/") for r in report["reasons"])


def render(browser):
    decisions = bridge_decisions(browser)
    lines = [
        "# Akademi laboratuvar–motor haritası",
        "",
        "Bu tablo gerçek öğrenci JSON içeriklerinden üretilir. Yapısal adaylık, aktarım veya başarılı native test anlamına gelmez. Ürünün tek simülasyon motoru Labber'dır (L7b: eski AğLab JS motoru ve MIT NetSim karşılaştırması kaldırıldı). Linux bridge ve FRR sütunları ayrı Gerçek Lab (native) dönüştürücüleridir: Linux bridge dönüştürücüsü sınırlı PC/switch ormanlarını kabul eder; FRR dönüştürücüsü sınırlı PC/router ve VLAN1 access-köprü şemasını ayrı doğrular; şema kabulü native test başarısı değildir.",
        "",
        "| Lab | Gerçek konu | Cihaz/bağ | Labber | Linux bridge | FRR | Öğrenci JSON SHA256 |",
        "|---|---|---|---|---|---|---|",
    ]
    for p in sorted((ROOT / "academy/student").glob("AGL-*.json")):
        raw = p.read_bytes()
        lab = json.loads(raw)
        t = lab["initial_topology"]
        ds = t["devices"]
        router = any(d["type"] == "Router" for d in ds)
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
            f"| {lab['id']} | {lab['title'].replace('|','/')} | {len(ds)}/{len(t['links'])} | {_decision_cell(decisions['academy'][lab['id']], academy=True)} | {linux} | {frr} | `{hashlib.sha256(raw).hexdigest()}` |"
        )
    scen = decisions["scenarios"]
    lines.extend(
        [
            "",
            "## Ortak motor senaryoları (Sorun Çöz)",
            "",
            "Senaryo yüklendikten sonraki başlangıç topolojisi köprüye verilir.",
            "",
            "| Senaryo | Başlık | Labber |",
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
    legacy = decisions["legacy"]
    known = {sid for sid, _, _ in scen}
    labber = {sid for sid, _, r in scen if r["decision"] == "labber"}
    # L6'da karşılığı olmadığı için gerçek topoloji senaryosuna çevrilenler (2. yol)
    added = {
        "dhcp-client-static",
        "dhcp-service-down",
        "eth-mac-learning",
        "eth-unknown-unicast",
        "acl-http-blocked",
    }
    path = lambda target, view=None: (
        ("2 · yeni Labber senaryosu" if target in added else "1 · Labber karşılığı")
        + f" `{target}`"
        + ("" if target in labber else " (UYARI: Labber değil)")
        if target
        else (
            "2 · Labber görünümü (gerçek `show` çıktısı + LabQuery)"
            if view == "labber"
            else "3 · Kavramsal alıştırma (motor yok)"
        )
    )
    for row in legacy["tasks"] + legacy["experiments"] + legacy["workshops"]:
        if row["target"] and row["target"] not in known:
            raise RuntimeError("L6 karşılığı senaryolarda yok: " + row["target"])
    lines.extend(
        [
            "",
            "## Motor kullanmayan eski içerik (L6)",
            "",
            "Sorun Çöz'ün eski metin senaryoları, \"Hazır deneyler\" mini lab'ı ve iki atölye kendi oyuncak",
            "modelleriyle çalışıyordu. Her öğe ya Labber'daki karşılık senaryoya açılır (1. yol), ya",
            "gerçek topoloji senaryosuna / Labber görünümüne çevrildi (2. yol) ya da kavramsal",
            "alıştırmadır (3. yol, motor yok). Tablo ürünün kendisinden üretilir; ayrıntı",
            'UYUMLULUK_MATRISI "L6".',
            "",
            "| Bölüm | Öğe | Başlık | Yol |",
            "|---|---|---|---|",
        ]
    )
    for t in legacy["tasks"]:
        lines.append(
            f"| Sorun Çöz | `{t['id']}` | {t['title'].replace('|', '/')} | {path(t['target'])} |"
        )
    for t in legacy["experiments"]:
        lines.append(
            f"| Hazır deneyler | `{t['id']}` | {t['title'].replace('|', '/')} | {path(t['target'])} |"
        )
    for t in legacy["workshops"]:
        lines.append(
            f"| {t['workshop']} atölyesi | `{t['id']}` | {t['title'].replace('|', '/')} | {path(t['target'], t['view'])} |"
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
            "## Labber özeti",
            "",
            "`Labber`, içeriğin bütün alanlarının Labber'a eşlendiği anlamına gelir (köprünün",
            "yapısal sonucu, `report.expressible`). Ürün bunu içerik yüklenirken aynı köprüden",
            "alır ve rozette gösterir. Terminal, ortak senaryonun başarı ölçütü, Akademi labının",
            "ölçütleri (`probe.icmp` → LabQuery.ping, `state.equals` → toAglab görünümü) ve",
            "Simulation Mode aynı kalıcı Labber çalışma zamanındadır. L7b'den beri eski motor",
            'yoktur: ifade edilemeyen içerik başka motorda açılmaz, "simüle edilemiyor" olarak',
            "gerekçesiyle gösterilir (terminal ve değerlendirme açık hata verir).",
            "",
            "| Grup | Labber | Simüle edilemiyor | Toplam |",
            "|---|---|---|---|",
            f"| Akademi labları | {a_lab} | {a_leg} | {a_lab + a_leg} |",
            f"| Ortak senaryolar | {s_lab} | {s_leg} | {s_lab + s_leg} |",
            f"| Labber labları | {len(labber_labs)} | 0 | {len(labber_labs)} |",
            f"| Toplam | {a_lab + s_lab + len(labber_labs)} | {a_leg + s_leg} | {a_lab + a_leg + s_lab + s_leg + len(labber_labs)} |",
            "",
            "| Simüle edilememe gerekçesi | İçerik sayısı |",
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
