(() => {
  const screen = document.querySelector('#startupScreen');
  function dismiss() {
    requestAnimationFrame(() => {
      screen.classList.add('is-ready');
      setTimeout(() => screen.remove(), 300);
    });
  }
  if (document.readyState !== 'complete') {
    document.addEventListener('DOMContentLoaded', dismiss, { once: true });
  } else {
    dismiss();
  }
})();
