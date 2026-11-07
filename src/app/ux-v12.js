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
  // Compact navigation is an accessible orientation cue, not a second curriculum.
  const nav = document.createElement('nav');
  nav.id = 'uxStudentMap';
  nav.setAttribute('aria-label', 'Öğrenme yolundaki konumun');
  const names = { learn: '1 · Öğren', lab: '2 · Uygula', troubleshoot: '3 · Sorun çöz' };
  for (const key of Object.keys(areas)) {
    const b = btn(names[key], 'uxGo' + key);
    b.dataset.uxArea = key;
    b.addEventListener('click', () => {
      const t = tabs.find((tab) => tab.dataset.area === key);
      if (t) {
        t.click();
        setTimeout(
          () =>
            document
              .getElementById('areaTabs')
              ?.scrollIntoView({ block: 'start', behavior: 'smooth' }),
          20,
        );
      }
    });
    nav.append(b);
  }
  const note = document.createElement('span');
  note.className = 'ux-map-note';
  note.textContent = 'İlgili bölümde kaldığın yer korunur. Laboratuvarı sıfırlama işlemi ayrıdır.';
  nav.append(note);
  const tabsNode = document.getElementById('areaTabs');
  tabsNode?.insertAdjacentElement('afterend', nav);
  const sync = () => {
    const active = tabs.find((x) => x.classList.contains('active'))?.dataset.area || 'learn';
    $$('#uxStudentMap [data-ux-area]').forEach((x) => {
      if (x.dataset.uxArea === active) x.setAttribute('aria-current', 'step');
      else x.removeAttribute('aria-current');
    });
  };
  tabs.forEach((x) => x.addEventListener('click', () => setTimeout(sync, 0)));
  sync();
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
      '<div class="ux-guide-row"><div><strong>Lab çalışma yolu:</strong> cihaz ekle → kablo bağla → CLI ile yapılandır → ağı denetle.<br><small>İçe/dışa aktarma ve topolojiyi sıfırlama için “Diğer işlemler”i aç.</small></div></div>';
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
