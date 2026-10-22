(() => {
  'use strict';
  const nav = document.getElementById('tool-nav');
  const menu = document.createElement('button');
  menu.className = 'icon-button menu-toggle';
  menu.setAttribute('aria-controls', 'tool-nav');
  document.querySelector('.header-right').append(menu);
  function setMenu(open) {
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
    menu.textContent = open ? '×' : '☰';
    nav.classList.toggle('is-open', open);
  }
  setMenu(false);
  menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) setMenu(false);
  });
  const mobile = matchMedia('(max-width: 760px)');
  mobile.addEventListener('change', () => setMenu(false));
  function markCurrent() {
    nav.querySelectorAll('a').forEach(link => {
      if (link.hash === location.hash) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  addEventListener('hashchange', markCurrent);
  markCurrent();
  const updates = document.getElementById('updates');
  const summary = updates.querySelector('summary');
  document.getElementById('close-updates').addEventListener('click', () => {
    updates.open = false;
    summary.focus();
  });
  document.addEventListener('click', event => {
    if (!nav.contains(event.target) && !menu.contains(event.target)) setMenu(false);
    if (!updates.contains(event.target)) updates.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (updates.open) { updates.open = false; summary.focus(); }
    if (menu.getAttribute('aria-expanded') === 'true') { setMenu(false); menu.focus(); }
  });
  document.addEventListener('focusin', event => {
    if (!nav.contains(event.target) && !menu.contains(event.target)) setMenu(false);
  });
  const motion = document.getElementById('motion-toggle');
  const track = document.querySelector('.marquee-track');
  motion.hidden = false;
  motion.addEventListener('click', () => {
    const paused = motion.getAttribute('aria-pressed') !== 'true';
    motion.setAttribute('aria-pressed', String(paused));
    motion.textContent = paused ? '继续背景滚动' : '暂停背景滚动';
    track.style.animationPlayState = paused ? 'paused' : 'running';
  });
  document.documentElement.classList.add('ui-ready');
})();
