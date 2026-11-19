const appNavigation = (() => {
  const entries = [];
  let position = -1, restoring = false, gesture = null;
  const blocked = 'input, textarea, select, button, a, summary, label, [contenteditable], [role=listbox], .bottom-nav, .learn-filters, .duration-wheel, .timer-presets, .profile-week, .progress-chart, .home-chart-plot, [data-swipe-ignore]';
  const views = { home: 'homeView', log: 'log', learn: 'learnView', rest: 'restView', history: 'history', profile: 'profileView', settings: 'settingsView' };
  const indicator = document.createElement('div');
  indicator.className = 'swipe-navigation-hint';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.hidden = true;
  document.body.append(indicator);

  function key(entry) {
    const learning = entry.learning;
    return entry.view === 'learn' ? 'learn:' + learning.page + ':' + (learning.slug ?? '') + ':' + (learning.page === 'detail' && Boolean(learning.fromLibrary)) : entry.view;
  }

  function remember() {
    if (restoring || position < 0) return;
    const entry = entries[position];
    entry.scroll = window.scrollY;
    if (entry.view === 'learn' && document.body.dataset.view === 'learn') entry.learning = appLearning.capture();
  }

  function record(view = document.body.dataset.view) {
    if (restoring) return;
    const entry = { view, scroll: window.scrollY, learning: view === 'learn' ? appLearning.capture() : null };
    if (position >= 0 && key(entries[position]) === key(entry)) {
      entries[position] = entry;
      return;
    }
    // Explicit Back buttons use the same trail, leaving the next screen available.
    if (position > 0 && key(entries[position - 1]) === key(entry)) {
      entries[--position] = entry;
    } else if (position + 1 < entries.length && key(entries[position + 1]) === key(entry)) {
      entries[++position] = entry;
    } else {
      entries.splice(position + 1);
      entries.push(entry);
      position = entries.length - 1;
      if (entries.length > 40) { entries.shift(); position--; }
    }
  }

  function canGo(direction) {
    return position + direction >= 0 && position + direction < entries.length;
  }

  function go(direction) {
    if (!canGo(direction) || document.querySelector('dialog[open]')) return false;
    remember();
    const entry = entries[position + direction];
    restoring = true;
    try {
      if (entry.view === 'learn') appLearning.restore(entry.learning);
      selectView(entry.view);
      position += direction;
      window.scrollTo({ top: entry.scroll, behavior: 'instant' });
      const screen = document.getElementById(views[entry.view]);
      const title = screen?.querySelector('h1, h2');
      if (title) { title.setAttribute('tabindex', '-1'); title.focus({ preventScroll: true }); }
      if (screen?.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        screen.animate([
          { transform: `translateX(${direction < 0 ? -24 : 24}px)`, opacity: .55 },
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

  function reset() { gesture = null; indicator.hidden = true; }

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
      if (!canGo(gesture.dx > 0 ? -1 : 1)) return reset();
      gesture.horizontal = true;
    }
    if (event.cancelable) event.preventDefault();
    if (!canGo(gesture.dx > 0 ? -1 : 1)) { indicator.hidden = true; return; }
    indicator.dataset.direction = gesture.dx > 0 ? 'back' : 'forward';
    indicator.textContent = gesture.dx > 0 ? '‹' : '›';
    indicator.hidden = false;
  }, { passive: false });

  document.addEventListener('touchend', event => {
    if (!gesture) return;
    const completed = gesture;
    const touch = Array.from(event.changedTouches).find(item => item.identifier === completed.id);
    reset();
    if (!touch || event.touches.length || !completed.horizontal) return;
    const dx = touch.clientX - completed.x, dy = touch.clientY - completed.y;
    const threshold = Math.max(76, Math.min(120, window.innerWidth * .24));
    if (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 2 && performance.now() - completed.start < 1400) go(dx > 0 ? -1 : 1);
  }, { passive: true });
  document.addEventListener('touchcancel', reset, { passive: true });
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', reset);
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowLeft' && go(-1)) event.preventDefault();
    if (event.key === 'ArrowRight' && go(1)) event.preventDefault();
  });

  function backTo(view) {
    for (let index = position - 1; index >= 0; index--) {
      if (entries[index].view === view) return go(index - position);
    }
    return false;
  }

  return { remember, record, backTo };
})();
