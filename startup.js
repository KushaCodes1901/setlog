(() => {
  const screen = document.querySelector('#startupScreen');
  const shownAt = performance.now();
  const minimumDisplayTime = 1500;
  function dismiss() {
    const remaining = Math.max(0, minimumDisplayTime - (performance.now() - shownAt));
    setTimeout(() => {
      requestAnimationFrame(() => {
        screen.classList.add('is-ready');
        setTimeout(() => screen.remove(), 300);
      });
    }, remaining);
  }
  if (document.readyState !== 'complete') {
    document.addEventListener('DOMContentLoaded', dismiss, { once: true });
  } else {
    dismiss();
  }
})();
