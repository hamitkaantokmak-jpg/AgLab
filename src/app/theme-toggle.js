(function () {
  const root = document.documentElement,
    btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'themeToggle';
  btn.className = 'aglab-theme-toggle';
  // PR 2b: düğme şimdiki temayı değil eylemi söyler ("Koyu temaya geç"); aria-label aynı.
  function apply(t) {
    root.dataset.theme = t;
    const label = t === 'light' ? 'Koyu temaya geç' : 'Açık temaya geç';
    btn.textContent = (t === 'light' ? '☾ ' : '☀ ') + label;
    btn.setAttribute('aria-label', label);
    btn.removeAttribute('aria-pressed');
  }
  // Kullanıcı seçim yapmadıysa sistem tercihi değişince tema da değişir.
  try {
    const media = matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', (e) => {
      let saved = null;
      try {
        saved = localStorage.getItem('aglab-theme');
      } catch (err) {}
      if (saved !== 'light' && saved !== 'dark') apply(e.matches ? 'dark' : 'light');
    });
  } catch (e) {}
  btn.addEventListener('click', () => {
    const t = root.dataset.theme === 'light' ? 'dark' : 'light';
    try {
      localStorage.setItem('aglab-theme', t);
    } catch (e) {}
    apply(t);
  });
  // Arayüz yenilemesi: üst gezinmenin sağında (taslaktaki kullanıcı simgesinin yeri).
  (document.getElementById('agTopTools') || document.body).appendChild(btn);
  apply(root.dataset.theme || 'light');
  const terminal = document.getElementById('terminal'),
    command = document.getElementById('command'),
    toast = document.getElementById('toast');
  if (terminal) {
    terminal.setAttribute('role', 'log');
    terminal.setAttribute('aria-label', 'Terminal çıktısı');
  }
  if (command && !command.getAttribute('aria-label'))
    command.setAttribute('aria-label', 'Komut girişi');
  if (toast) {
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
  }
})();
