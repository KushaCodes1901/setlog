const appNavigation = (() => {
  const entries = [];
  let restoring = false, gesture = null;
  const blocked = 'input, textarea, select, button, a, summary, label, [contenteditable], [role=listbox], .bottom-nav, .learn-filters, .duration-wheel, .timer-presets, .profile-week, .progress-chart, .home-chart-plot, [data-swipe-ignore]';
  const views = { home: 'homeView', log: 'log', learn: 'learnView', rest: 'restView', history: 'history', profile: 'profileView', settings: 'settingsView' };

  function key(entry) {
    const learning = entry.learning;
    return entry.view === 'learn' ? 'learn:' + learning.page + ':' + (learning.slug ?? '') + ':' + (learning.page === 'detail' && Boolean(learning.fromLibrary)) : entry.view;
  }

  function remember() {
    if (restoring || !entries.length) return;
    const entry = entries.at(-1);
    entry.scroll = window.scrollY;
    if (entry.view === 'learn' && document.body.dataset.view === 'learn') entry.learning = appLearning.capture();
  }

  function record(view = document.body.dataset.view) {
    if (restoring) return;
    const entry = { view, scroll: window.scrollY, learning: view === 'learn' ? appLearning.capture() : null };
    if (entries.length && key(entries.at(-1)) === key(entry)) {
      entries[entries.length - 1] = entry;
      return;
    }
    // Explicit Back buttons and gestures share a single return trail.
    if (entries.length > 1 && key(entries.at(-2)) === key(entry)) {
      entries.pop();
      entries[entries.length - 1] = entry;
    } else {
      entries.push(entry);
      if (entries.length > 40) entries.shift();
    }
  }

  function canGo(index = entries.length - 2) {
    return index >= 0 && index < entries.length - 1;
  }

  function go(index = entries.length - 2) {
    if (!canGo(index) || document.querySelector('dialog[open]')) return false;
    remember();
    const entry = entries[index];
    restoring = true;
    try {
      if (entry.view === 'learn') appLearning.restore(entry.learning);
      selectView(entry.view);
      entries.splice(index + 1);
      window.scrollTo({ top: entry.scroll, behavior: 'instant' });
      const screen = document.getElementById(views[entry.view]);
      const title = screen?.querySelector('h1, h2');
      if (title) { title.setAttribute('tabindex', '-1'); title.focus({ preventScroll: true }); }
      if (screen?.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        screen.animate([
          { transform: 'translateX(-24px)', opacity: .55 },
          { transform: 'translateX(0)', opacity: 1 }
        ], { duration: 190, easing: 'cubic-bezier(.2,.7,.2,1)' });
      }
      return true;
    } finally { restoring = false; }
  }

  function excluded(target) {
    if (!(target instanceof Element) || target.closest(blocked)) return true;
    for (let node = target; node && node !== document.body; node = node.parentElement) {
      const overflow = getComputedStyle(node).overflowX;
      if (node.scrollWidth > node.clientWidth + 2 && /auto|scroll/.test(overflow)) return true;
    }
    return false;
  }

  function reset() { gesture = null; }

  document.addEventListener('touchstart', event => {
    reset();
    if (event.touches.length !== 1 || document.querySelector('dialog[open]') || excluded(event.target) || window.getSelection()?.toString()) return;
    const touch = event.touches[0];
    // Safari owns its screen-edge gestures when running in a browser tab.
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (!standalone && (touch.clientX < 24 || touch.clientX > window.innerWidth - 24)) return;
    gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, dx: 0, dy: 0, start: performance.now(), horizontal: false };
  }, { passive: true });

  document.addEventListener('touchmove', event => {
    if (!gesture) return;
    if (event.touches.length !== 1 || document.querySelector('dialog[open]')) return reset();
    const touch = Array.from(event.touches).find(item => item.identifier === gesture.id);
    if (!touch) return reset();
    gesture.dx = touch.clientX - gesture.x;
    gesture.dy = touch.clientY - gesture.y;
    const x = Math.abs(gesture.dx), y = Math.abs(gesture.dy);
    if (!gesture.horizontal) {
      if (y > 12 && y >= x) return reset();
      if (x < 16 || x < y * 1.5) return;
      if (gesture.dx <= 0 || !canGo()) return reset();
      gesture.horizontal = true;
    }
    if (gesture.dx <= 0) return reset();
    if (event.cancelable) event.preventDefault();
  }, { passive: false });

  document.addEventListener('touchend', event => {
    if (!gesture) return;
    const completed = gesture;
    const touch = Array.from(event.changedTouches).find(item => item.identifier === completed.id);
    reset();
    if (!touch || event.touches.length || !completed.horizontal) return;
    const dx = touch.clientX - completed.x, dy = touch.clientY - completed.y;
    const threshold = Math.max(76, Math.min(120, window.innerWidth * .24));
    if (dx >= threshold && dx > Math.abs(dy) * 2 && performance.now() - completed.start < 1400) go();
  }, { passive: true });
  document.addEventListener('touchcancel', reset, { passive: true });
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', reset);
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowLeft' && go()) event.preventDefault();
  });

  function backTo(view) {
    for (let index = entries.length - 2; index >= 0; index--) {
      if (entries[index].view === view) return go(index);
    }
    return false;
  }

  return { remember, record, backTo };
})();
