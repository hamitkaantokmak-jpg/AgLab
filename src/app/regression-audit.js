(function initRegressionAudit() {
  const btn = document.getElementById('runRegressionAudit');
  if (!btn) return;
  const required = [
    'return-route',
    'forward-route',
    'default-route',
    'wrong-prefix',
    'unresolved-next-hop',
    'lpm-next-hop',
    'floating-static',
    'access-vlan',
    'trunk-allowed',
    'native-vlan',
    'nat-pat',
    'relay-trunk',
    'stp-loop',
  ];
  function run() {
    const checks = [];
    const add = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
    try {
      const select = document.getElementById('sharedScenarioSelect');
      const optionValues = select ? [...select.options].map((o) => o.value) : [];
      add('Senaryo seçicisi mevcut', !!select, 'sharedScenarioSelect öğesi');
      add(
        'Gerekli ortak senaryolar seçicide var',
        required.every((x) => optionValues.includes(x)),
        required.filter((x) => !optionValues.includes(x)).length
          ? 'Eksik: ' + required.filter((x) => !optionValues.includes(x)).join(', ')
          : '13 senaryo seçeneği bulundu',
      );
      // L6: Sorun Çöz görevleri oyuncak model değil; her biri Labber karşılığına ya da açıkça
      // etiketli kavramsal alıştırmaya açılır.
      const tasks = typeof TROUBLESHOOT_TASKS !== 'undefined' ? TROUBLESHOOT_TASKS : [];
      const ids = tasks.map((x) => x.id);
      add('Sorun Çöz görevleri yüklü', ids.length > 0, ids.length + ' görev');
      add(
        'Görev kimlikleri benzersiz',
        new Set(ids).size === ids.length,
        new Set(ids).size === ids.length ? 'Tekrarlanan kimlik yok' : 'Tekrarlanan kimlik bulundu',
      );
      const missing = tasks.filter((x) =>
        x.target ? !optionValues.includes(x.target) : !x.concept,
      );
      add(
        'Her görevin Labber karşılığı ya da kavramsal etiketi var',
        tasks.length > 0 && !missing.length,
        missing.length
          ? 'Karşılıksız: ' + missing.map((x) => x.id).join(', ')
          : 'Labber karşılığı: ' +
              tasks.filter((x) => x.target).length +
              ', kavramsal: ' +
              tasks.filter((x) => !x.target).length,
      );
      const relay = tasks.find((x) => x.id === 'relay-trunk');
      add(
        'DHCP relay/trunk görevi Labber senaryosunda',
        !!relay && relay.target === 'relay-trunk' && optionValues.includes('relay-trunk'),
        relay ? 'relay-trunk → ' + relay.target : 'relay-trunk görevi bulunamadı',
      );
      const srcText = [...document.scripts].map((x) => x.textContent || '').join('\n');
      // Hazır senaryolar veri tariflidir (network-scenarios.json): NAT/PAT tarifinde R1'in iç
      // ve dış arayüz rolleri tanımlı olmalı.
      const natRecipe = (window.aglabSharedEngine?.recipes() || []).find((r) => r.id === 'nat-pat');
      const natRoles = (natRecipe?.topology?.devices || []).flatMap((d) =>
        Object.values(d.interfaces || {}).map((i) => i.natRole),
      );
      add(
        'NAT/PAT ortak motor senaryosu tanımlı',
        optionValues.includes('nat-pat') &&
          natRoles.includes('inside') &&
          natRoles.includes('outside'),
        'NAT/PAT, senaryo tarifinin topolojisinden denetlenir (inside/outside arayüz rolleri).',
      );
      add(
        'NAT overload komutu ve akış kontrolü kodda var',
        srcText.includes('ip nat inside source list') &&
          srcText.includes('natOverload') &&
          srcText.includes('natTranslations'),
        'NAT yapılandırma komutu, akış denetimi ve çeviri tablosu kontrol edildi',
      );
      add(
        'NAT tanılama komutları kodda var',
        srcText.includes('show ip nat translations') && srcText.includes('show ip nat statistics'),
        'Çeviri tablosu ve istatistik komut metinleri aranıyor',
      );
      add(
        'DHCP trunk düzeltme komutu kodda var',
        srcText.includes('set trunk-allowed'),
        'Trunk allowed komut işleyicisi aranıyor',
      );
    } catch (e) {
      add('Denetim çalışması', false, 'Denetim hatası: ' + String((e && e.message) || e));
    }
    const out = document.getElementById('regressionAuditResults');
    out.replaceChildren();
    for (const c of checks) {
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;gap:8px;align-items:flex-start;padding:7px 9px;border-radius:8px;border:1px solid ' +
        (c.ok ? '#276e55' : '#8b414a') +
        ';background:' +
        (c.ok ? 'rgba(21,61,54,.35)' : 'rgba(70,25,35,.35)');
      const icon = document.createElement('b');
      icon.textContent = c.ok ? '✓' : '✕';
      icon.style.color = c.ok ? '#6ee7b7' : '#fda4af';
      const body = document.createElement('div');
      const title = document.createElement('div');
      title.textContent = c.name;
      title.style.fontWeight = '700';
      const detail = document.createElement('div');
      detail.textContent = c.detail;
      detail.style.cssText = 'color:var(--muted,#a9b7c8);font-size:11px;margin-top:2px';
      body.append(title, detail);
      row.append(icon, body);
      out.append(row);
    }
    if (window.aglabSharedEngine)
      checks.push(
        ...window.aglabSharedEngine
          .validateScenarios()
          .map((r) => ({ name: r.id, ok: r.ok, detail: r.detail })),
      );
    const pass = checks.filter((x) => x.ok).length,
      fail = checks.length - pass;
    const summary = document.getElementById('regressionAuditSummary');
    summary.textContent = `${pass}/${checks.length} kontrol geçti · ${fail} başarısız. Yapı denetimi ve ortak motor senaryolarının başlangıç/çözüm kontrolleri tamamlandı.`;
    summary.style.color = fail ? '#fda4af' : '#6ee7b7';
  }
  btn.addEventListener('click', run);
})();
