(function () {
  try {
    document.documentElement.dataset.theme =
      localStorage.getItem('aglab-theme') === 'light' ? 'light' : 'dark';
  } catch (e) {
    document.documentElement.dataset.theme = 'dark';
  }
})();
