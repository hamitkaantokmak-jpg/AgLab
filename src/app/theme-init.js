(function () {
  // PR 2b: kayıtlı seçim yoksa sistem tercihi (prefers-color-scheme); o da yoksa açık tema
  // (taslak açık temadadır).
  let saved = null;
  try {
    saved = localStorage.getItem('aglab-theme');
  } catch (e) {}
  const system =
    typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  document.documentElement.dataset.theme = saved === 'light' || saved === 'dark' ? saved : system;
})();
