// Arayüz yenilemesi PR 1: ortak iskelet (üst gezinme, sol ikon şeridi, sayfa düzeni).
// Üç ana bölüm: Müfredat (learn), Simülatör (lab), Sorun Çöz (troubleshoot); ikon şeridinde
// ayrıca Ders kısayolu ve Gelişmiş (advanced). Arayüz PR 3: Canlı Lab ayrı bölüm değil; operatör
// araçları (rapor inceleme, topoloji dışa aktarımı, öğrenci tanıları) Gelişmiş'te "Canlı Lab
// (operatör)" başlığı altında. Eski Canlı Lab bağlantıları Gelişmiş'e yönlenir. Bölüm kimlikleri (`data-area`,
// `#area-*`) ve kayıt anahtarları değişmez; adres çubuğu yeni adları gösterir, eski bağlantılar
// (#lab, #gercek-lab, #area-lab …) yeni bölüme yönlenir.
(() => {
  'use strict';
  const HASH = {
    learn: 'mufredat',
    lab: 'simulator',
    troubleshoot: 'sorun-coz',
    advanced: 'gelismis',
  };
  // Eski ve yeni adlar → bölüm (eski bağlantı uyumluluğu).
  const ALIASES = {
    mufredat: 'learn',
    learn: 'learn',
    ogren: 'learn',
    'area-learn': 'learn',
    ders: 'learn',
    simulator: 'lab',
    lab: 'lab',
    'area-lab': 'lab',
    'sorun-coz': 'troubleshoot',
    troubleshoot: 'troubleshoot',
    'area-troubleshoot': 'troubleshoot',
    'canli-lab': 'advanced',
    live: 'advanced',
    'gercek-lab': 'advanced',
    'real-lab': 'advanced',
    'area-live': 'advanced',
    gelismis: 'advanced',
    advanced: 'advanced',
  };
  const rail = document.getElementById('agRail');
  const current = () =>
    document.querySelector('.workspace.active')?.id.replace(/^area-/, '') || 'learn';
  function syncRail() {
    const area = current();
    for (const b of rail?.querySelectorAll('[data-rail]') || []) {
      const on =
        b.dataset.rail === area ||
        (b.dataset.rail === 'lesson' && area === 'learn' && rail.dataset.lesson === '1');
      const map = b.dataset.rail === 'learn' && area === 'learn' && rail.dataset.lesson !== '1';
      b.classList.toggle('cur', on || map);
      if (on || map) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    const name = HASH[area];
    if (name && location.hash !== '#' + name)
      try {
        history.replaceState(null, '', '#' + name);
      } catch (e) {}
  }
  function go(area) {
    if (!document.getElementById('area-' + area)) return;
    showArea(area);
    syncRail();
  }
  rail?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rail]');
    if (!b) return;
    const target = b.dataset.rail;
    rail.dataset.lesson = target === 'lesson' ? '1' : '';
    if (target === 'lesson') {
      go('learn');
      document.getElementById('sfSheet')?.scrollIntoView({ block: 'start' });
    } else go(target);
  });
  // Üst gezinme (main.js showArea) ile şerit eşzamanlı kalır.
  document.getElementById('areaTabs')?.addEventListener('click', () => {
    rail && (rail.dataset.lesson = '');
    setTimeout(syncRail, 0);
  });
  new MutationObserver(syncRail).observe(document.getElementById('agMain') || document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class'],
  });
  function fromHash(e) {
    // Hedef, olayın kendi adresinden okunur: olay işlenmeden önce bir sınıf değişikliği
    // syncRail'i tetikleyip adresi eski bölüme geri yazmış olabilir (replaceState), o zaman
    // location.hash geçişi kaybettirir.
    let hash = location.hash;
    try {
      if (e?.newURL) hash = new URL(e.newURL).hash;
    } catch (err) {}
    const key = decodeURIComponent(hash.replace(/^#/, '')).toLowerCase();
    const area = ALIASES[key];
    if (area && area !== current()) go(area);
    else syncRail();
  }
  window.addEventListener('hashchange', fromHash);
  // Arama: konu araması müfredattadır (öğrenme yolunun arama kutusu).
  const search = document.getElementById('agSearch');
  const sfSearch = document.getElementById('sfSearch');
  search?.addEventListener('input', () => {
    if (!sfSearch) return;
    if (current() !== 'learn') go('learn');
    sfSearch.value = search.value;
    sfSearch.dispatchEvent(new Event('input', { bubbles: true }));
  });
  search?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = document.querySelector('#sfList button');
    if (first) {
      e.preventDefault();
      first.click();
    }
  });
  fromHash();
  window.aglabShell = { go, current, aliases: () => ({ ...ALIASES }) };
})();
