(() => {
  const screen = document.querySelector('#startupScreen');
  const shownAt = performance.now();
  const minimumDisplayTime = 2000;
  function dismiss() {
    const remaining = Math.max(0, minimumDisplayTime - (performance.now() - shownAt));
    setTimeout(() => {
      requestAnimationFrame(() => {
        const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
        screen.classList.add('is-launching');
        document.body.classList.add('startup-reveal');
        setTimeout(() => {
          screen.remove();
          document.body.classList.remove('startup-reveal');
        }, reducedMotion ? 0 : 850);
      });
    }, remaining);
  }
  if (document.readyState !== 'complete') {
    document.addEventListener('DOMContentLoaded', dismiss, { once: true });
  } else {
    dismiss();
  }
})();
