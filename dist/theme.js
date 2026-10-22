(() => {
  let theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  try {
    const saved = localStorage.getItem('openseek-theme');
    if (saved === 'dark' || saved === 'light') theme = saved;
  } catch { /* The theme also works without browser storage. */ }
  document.documentElement.dataset.theme = theme;
})();
