"""L6: motor kullanmayan eski içerik.

Sorun Çöz'ün 25 eski metin senaryosu, "Hazır deneyler" mini lab'ı (labRun) ve iki atölye (rota,
protokol) için seçilen yol sınanır:

* Labber karşılığına açılanlar (1. yol): görev/deney/durum ilgili ortak senaryoyu yükler ve
  senaryo Labber kararındadır (terminal ve değerlendirme Labber oturumunda).
* Labber görünümüne çevrilenler (2. yol, atölye): başlangıçta motorun rota kararı başarısız ya da
  "önce", değişiklik gerçek IOS komutuyla uygulanınca "sonra" (metric, ECMP, OSPF passive).
  Yeni topoloji senaryolarının başta başarısız / çözümle başarılı testi
  `test_aglab_lesson_scenarios.py`'dedir (bütün `query` tarifleri).
* Kavramsal alıştırmalar (3. yol): rozet "motor yok"; terminal ya da motor sonucu yok.

Kayıtlı ilerleme (`aglab-passed-final`, eski kimlikler) ve Labber karşılığının tamamlanması listede
görünür. Görev sayısı ve eşlemeler koddan okunur, sabit yazılmaz.
"""

import json

from playwright.sync_api import expect, sync_playwright

from aglab_test_support import ROOT, launch_chromium

RECIPES = {
    r["id"]: r
    for r in json.loads((ROOT / "simulator/network-scenarios.json").read_text(encoding="utf-8"))
}


def set_select(page, selector, value):
    page.evaluate(
        "([s,v])=>{const e=document.querySelector(s);e.value=v;e.dispatchEvent(new Event('change'))}",
        [selector, value],
    )


def done(page, index):
    return page.locator(f'#scenarioList [data-s="{index}"]').evaluate(
        "(b)=>b.classList.contains('done')"
    )


def click(page, selector):
    page.evaluate("(s)=>document.querySelector(s).click()", selector)


with sync_playwright() as pw:
    browser = launch_chromium(pw)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    # Eski kayıtlı ilerleme + Labber karşılığı tamamlanmış görev
    page.add_init_script(
        "try{if(!sessionStorage.getItem('l6')){sessionStorage.setItem('l6','1');"
        "localStorage.setItem('aglab-passed-final',JSON.stringify(['gateway']));"
        "localStorage.setItem('aglab-shared-engine-progress-v1',"
        "JSON.stringify({'dns-wrong-server-pc':{completed:true}}))}}catch(e){}"
    )
    page.goto((ROOT / "AgLab_Final_PKT_Import.html").as_uri())
    tasks = page.evaluate("TROUBLESHOOT_TASKS")
    ids = [t["id"] for t in tasks]
    assert len(ids) == len(set(ids)) == 25, ids  # eski 25 senaryonun kimliği ve sırası korunur

    # --- Sorun Çöz: kayıtlı ilerleme -------------------------------------------------------
    page.click('[data-area="troubleshoot"]')
    for task_id in ("gateway", "dns"):
        assert done(page, ids.index(task_id)), task_id
    assert not done(page, ids.index("mask"))
    print("PASS: saved legacy progress and completed Labber counterparts shown", flush=True)

    # --- Sorun Çöz: her görev karşılığına açılır, karşılık Labber'da --------------------------
    for i, task in enumerate(tasks):
        if not task.get("target"):
            continue
        assert task["target"] in RECIPES, task
        page.click('[data-area="troubleshoot"]')
        page.locator(f'#scenarioList [data-s="{i}"]').click()
        expect(page.locator("#sharedScenarioSelect")).to_have_value(task["target"])
        assert page.evaluate("aglabLabberSession.active()"), (
            task["id"],
            task["target"],
            page.locator("#sharedScenarioStatus").text_content(),
        )
    print("PASS: every legacy troubleshoot task opens its Labber counterpart", flush=True)

    # --- Sorun Çöz: kavramsal alıştırma (BGP) ------------------------------------------------
    concept = [i for i, t in enumerate(tasks) if not t.get("target")]
    assert [ids[i] for i in concept] == ["bgp"], concept
    page.click('[data-area="troubleshoot"]')
    page.locator(f'#scenarioList [data-s="{concept[0]}"]').click()
    expect(page.locator("#conceptBadge")).to_have_text("KAVRAMSAL ALIŞTIRMA (MOTOR YOK)")
    expect(page.locator("#scenarioList .scenario.selected small")).to_contain_text("motor yok")
    # motorlu gibi görünmez: terminal, komut formu ya da "test http" gibi sahte komut yok
    for gone in ("#terminal", "#cmdForm", "#command", "[data-cmd]"):
        assert page.locator(gone).count() == 0, gone
    assert "test http" not in page.locator("#area-troubleshoot").text_content()
    options = page.locator("#options [data-o]")
    texts = options.all_text_contents()
    # Seçenekler kök neden düzeyinde: hiçbiri görev başlığını tekrar etmez; açıklama, hangi
    # kanıtın seçeneği elediğini söyler.
    title = tasks[concept[0]]["title"]
    assert not any(t.split(". ", 1)[1] in title for t in texts), (texts, title)
    wrong = next(i for i, t in enumerate(texts) if "outbound prefix-list" in t)
    options.nth(wrong).click()
    expect(page.locator("#diagnosis .feedback")).to_have_class("feedback bad")
    expect(page.locator("#diagnosis")).to_contain_text("yerel BGP tablosunda")
    assert not done(page, concept[0])
    right = next(i for i, t in enumerate(texts) if "network 203.0.113.0" in t)
    options.nth(right).click()
    expect(page.locator("#diagnosis .feedback")).to_have_class("feedback good")
    assert done(page, concept[0])
    print("PASS: BGP is a labelled conceptual exercise without a fake terminal", flush=True)

    # --- Hazır deneyler (labRun) → Labber senaryoları -----------------------------------------
    assert page.evaluate("typeof labRun") == "undefined"
    page.click('[data-area="lab"]')
    experiments = page.locator("#labExperimentLinks [data-shared-scenario]")
    targets = experiments.evaluate_all("(bs)=>bs.map(b=>b.dataset.sharedScenario)")
    assert len(targets) == 9 and all(t in RECIPES for t in targets), targets
    for n, target in enumerate(targets):
        experiments.nth(n).evaluate("(b)=>b.click()")
        expect(page.locator("#sharedScenarioSelect")).to_have_value(target)
        assert page.evaluate("aglabLabberSession.active()"), target
    print("PASS: mini-lab experiments open Labber scenarios", flush=True)

    # --- Rota atölyesi ------------------------------------------------------------------------
    page.click('[data-area="learn"]')
    page.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    for case, shared in (
        ("static-ospf", "ospf-static-overrides"),
        ("lpm", "lpm-next-hop"),
        ("default", "default-route"),
    ):
        set_select(page, "#routeCalcScenario", case)
        assert page.locator("#routeCalcSharedOpen").get_attribute("data-shared-scenario") == shared
        assert RECIPES[shared]
    set_select(page, "#routeCalcScenario", "metric")
    before = page.locator("#routeCalcResult").text_content()
    assert "10.0.13.2 (metric 3)" in before, before
    assert "[110/3] via 10.0.13.2" in page.locator("#routeCalcOutput").text_content()
    click(page, "#routeCalcApply")
    after = page.locator("#routeCalcResult").text_content()
    assert "10.0.12.2 (metric 102)" in after, after
    set_select(page, "#routeCalcScenario", "ecmp")
    assert "1 yol" in page.locator("#routeCalcResult").text_content()
    expect(page.locator("#routeCalcResult")).to_have_class("route-calc-result bad")
    click(page, "#routeCalcApply")
    assert "2 yol (10.0.12.2 ve 10.0.13.2" in page.locator("#routeCalcResult").text_content()
    expect(page.locator("#routeCalcResult")).to_have_class("route-calc-result good")
    out = page.locator("#routeCalcOutput").text_content()
    assert "[110/3] via 10.0.12.2" in out and "[110/3] via 10.0.13.2" in out, out
    expect(page.locator("#routeDiagBadge")).to_have_text("KAVRAMSAL ALIŞTIRMA (MOTOR YOK)")
    set_select(page, "#routeCalcScenario", "static-ospf")
    click(page, "#routeCalcSharedOpen")
    expect(page.locator("#sharedScenarioSelect")).to_have_value("ospf-static-overrides")
    print(
        "PASS: route workshop: AD/LPM/default open Labber scenarios; metric and ECMP from Labber",
        flush=True,
    )

    # --- Protokol atölyesi --------------------------------------------------------------------
    page.click('[data-area="learn"]')
    page.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
    set_select(page, "#protoScenario", "ospf-passive")
    expect(page.locator("#protoBadge")).to_have_text("LABBER MOTORU")
    assert "komşuluğu: yok" in page.locator("#protoResult").text_content()
    expect(page.locator("#protoResult")).to_have_class("proto-result bad")
    click(page, "#protoFixBtn")
    assert "komşuluğu: FULL" in page.locator("#protoResult").text_content()
    assert "FULL/" in page.locator("#protoOutput").text_content()
    expect(page.locator("#protoResult")).to_have_class("proto-result good")
    # BGP: başlık yalnız belirti; üç durum aynı dört aday nedeni paylaşır, doğru neden kanıttan
    # ayırt edilir. Her durumda doğru seçenek farklıdır; yanlışın açıklaması eleme kanıtını söyler.
    answers = set()
    for bgp in ("bgp-advertise", "bgp-filter", "bgp-next-hop"):
        set_select(page, "#protoScenario", bgp)
        expect(page.locator("#protoBadge")).to_have_text("KAVRAMSAL ALIŞTIRMA (MOTOR YOK)")
        assert "canlı ağdan ölçülmez" in page.locator("#protoResult").text_content()
        label = page.evaluate(
            "() => document.querySelector('#protoScenario').selectedOptions[0].textContent"
        )
        buttons = page.locator("#protoOptions [data-cause]")
        causes = buttons.evaluate_all("(bs) => bs.map((b) => b.dataset.cause)")
        assert causes == ["network", "filter", "nexthop", "session"], causes
        for cause in ("prefix-list", "NEXT_HOP", "network"):
            assert cause not in label, (label, cause)
        good = []
        for n, cause in enumerate(causes):
            buttons.nth(n).evaluate("(b) => b.click()")
            result = page.locator("#protoResult")
            if "good" in (result.get_attribute("class") or ""):
                good.append(cause)
            else:
                assert result.text_content().startswith("Elenir:"), result.text_content()
        assert len(good) == 1, (bgp, good)
        answers.add(good[0])
    assert answers == {"network", "filter", "nexthop"}, answers
    set_select(page, "#protoScenario", "ospf-area")
    click(page, "#protoSharedOpen")
    expect(page.locator("#sharedScenarioSelect")).to_have_value("ospf-area-mismatch")
    print(
        "PASS: protocol workshop: OSPF passive from Labber, OSPF area scenario, BGP conceptual",
        flush=True,
    )

    assert not errors, errors
    browser.close()
