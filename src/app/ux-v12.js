(() => {
  'use strict';
  const $$ = (q, root = document) => Array.from(root.querySelectorAll(q));
  const btn = (label, id) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.id = id;
    el.textContent = label;
    return el;
  };
  const areas = {
    learn: document.getElementById('area-learn'),
    lab: document.getElementById('area-lab'),
    troubleshoot: document.getElementById('area-troubleshoot'),
  };
  const tabs = $$('#areaTabs [data-area]');
  // Arayüz yenilemesi PR 1: eski "1 · Öğren 2 · Uygula 3 · Sorun çöz" yön çubuğu kaldırıldı;
  // yerini üst gezinme ve sol ikon şeridi aldı (src/app/shell.js).
  // Keep save, audit and cabling immediately visible; rarely-used destructive and export/import actions behind disclosure.
  const lab = document.getElementById('ptWorkbench');
  const actions = lab?.querySelector('.pt-head-actions');
  if (lab && actions) {
    lab.classList.add('ux-simple-lab');
    const more = btn('Diğer işlemler ▾', 'uxMoreLabActions');
    more.setAttribute('aria-expanded', 'false');
    more.setAttribute('aria-controls', 'ptWorkbench');
    more.addEventListener('click', () => {
      const expanded = lab.classList.toggle('ux-expanded');
      more.setAttribute('aria-expanded', String(expanded));
      more.textContent = expanded ? 'Diğer işlemleri gizle ▴' : 'Diğer işlemler ▾';
    });
    actions.append(more);
    const guide = document.createElement('div');
    guide.className = 'ux-lab-guide';
    guide.innerHTML =
      '<div class="ux-guide-row"><div><strong>Simülatör çalışma yolu:</strong> cihaz ekle → kablo bağla → CLI ile yapılandır → ağı denetle.<br><small>İçe/dışa aktarma ve topolojiyi sıfırlama için “Diğer işlemler”i aç.</small></div></div>';
    lab.querySelector('.pt-head')?.insertAdjacentElement('afterend', guide);
  }
  if (areas.troubleshoot) {
    const box = document.createElement('div');
    box.className = 'ux-trouble-steps';
    box.innerHTML =
      '<b>Arızayı 4 adımda çöz</b><ol><li>Belirtiyi oku</li><li>Terminalden kanıt topla</li><li>Teşhisi seç ve düzelt</li><li>Ping veya uygun komutla doğrula</li></ol>';
    areas.troubleshoot.querySelector('.lab-heading')?.insertAdjacentElement('afterend', box);
  }
  window.aglabUxV12 = {
    version: '12.0',
    getActiveArea: () => tabs.find((x) => x.classList.contains('active'))?.dataset.area || null,
  };
})();
