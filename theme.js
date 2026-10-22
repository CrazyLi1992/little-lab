(() => {
  'use strict';
  const key = 'little-lab:theme';
  const parse = value => { try { return JSON.parse(value) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } };
  let theme = 'light';
  try { theme = parse(localStorage.getItem(key)); } catch {}
  function apply() {
    document.documentElement.dataset.theme = theme;
    document.getElementById('theme-toggle')?.setAttribute('aria-label', theme === 'light' ? '切换到深色主题' : '切换到浅色主题');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#fafafa' : '#09090b';
  }
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      theme = theme === 'light' ? 'dark' : 'light';
      apply();
      try { localStorage.setItem(key, JSON.stringify(theme)); } catch {}
    });
  });
  addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    theme = parse(event.newValue);
    apply();
  });
  addEventListener('pageshow', () => {
    try { theme = parse(localStorage.getItem(key)); } catch {}
    apply();
  });
})();
