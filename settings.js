const appSettings = (() => {
  const key = 'setlog-settings-v1';
  const volume = document.querySelector('#restVolume');
  const volumeValue = document.querySelector('#restVolumeValue');
  const confetti = document.querySelector('#showConfetti');
  const status = document.querySelector('#settingsStatus');

  function read(value) {
    try {
      const saved = JSON.parse(value);
      return {
        volume: Number.isFinite(saved?.volume) ? Math.max(0, Math.min(100, saved.volume)) : 100,
        confetti: saved?.confetti !== false
      };
    } catch {
      return { volume: 100, confetti: true };
    }
  }

  let preferences;
  try { preferences = read(localStorage.getItem(key)); } catch { preferences = read(null); }

  function render() {
    volume.value = preferences.volume;
    volumeValue.value = preferences.volume + '%';
    confetti.checked = preferences.confetti;
  }

  function save(change) {
    const updated = { ...preferences, ...change };
    try {
      localStorage.setItem(key, JSON.stringify(updated));
      preferences = updated;
      status.textContent = 'Settings saved on this device.';
    } catch {
      status.textContent = 'Could not save this setting. Try again.';
    }
    render();
  }

  volume.oninput = () => { volumeValue.value = volume.value + '%'; };
  volume.onchange = () => save({ volume: Number(volume.value) });
  confetti.onchange = () => save({ confetti: confetti.checked });
  window.addEventListener('storage', event => {
    if (event.key === key) {
      preferences = read(event.newValue);
      render();
    }
  });
  render();
  return { volume: () => preferences.volume / 100, confetti: () => preferences.confetti };
})();
