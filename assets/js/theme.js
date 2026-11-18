// Run before styles load so a saved light preference never flashes a dark page.
const appTheme = (() => {
  const key = 'setlog-settings-v1';
  const valid = value => ['dark', 'light'].includes(value) ? value : 'dark';
  function apply(value) {
    const theme = valid(value);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const color = document.querySelector('meta[name="theme-color"]');
    if (color) color.setAttribute('content', theme === 'light' ? '#f4f6f3' : '#0b0f10');
  }
  try { apply(JSON.parse(localStorage.getItem(key))?.appearance); } catch { apply('dark'); }
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) {
      try { apply(JSON.parse(event.newValue)?.appearance); } catch { apply('dark'); }
    }
  });
  return { apply, valid };
})();
