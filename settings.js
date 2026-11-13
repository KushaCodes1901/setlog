const appSettings = (() => {
  const key = 'setlog-settings-v1';
  const volume = document.querySelector('#restVolume');
  const volumeValue = document.querySelector('#restVolumeValue');
  const confetti = document.querySelector('#showConfetti');
  const weightUnit = document.querySelector('#weightUnit');
  const status = document.querySelector('#settingsStatus');
  const saveButton = document.querySelector('#saveSettings');
  const savedDialog = document.querySelector('#settingsSavedDialog');
  let dialogTimer;
  savedDialog.addEventListener('close', () => {
    clearTimeout(dialogTimer);
    saveButton.textContent = 'Save Settings';
  });

  function read(value) {
    try {
      const saved = JSON.parse(value);
      return {
        volume: Number.isFinite(saved?.volume) ? Math.max(0, Math.min(100, saved.volume)) : 100,
        confetti: saved?.confetti !== false,
        weightUnit: saved?.weightUnit === 'lbs' ? 'lbs' : 'kg'
      };
    } catch {
      return { volume: 100, confetti: true, weightUnit: 'kg' };
    }
  }

  let preferences;
  try { preferences = read(localStorage.getItem(key)); } catch { preferences = read(null); }
  let confirmed = { ...preferences, sound: true };
  try { confirmed.sound = localStorage.getItem('setlog-rest-sound-v1') !== 'false'; } catch {}

  function showConfirmation(changed) {
    const icon = document.querySelector('.settings-saved-check');
    icon.textContent = changed ? '✓' : 'i';
    icon.classList.toggle('settings-info-icon', !changed);
    document.querySelector('#settingsSavedTitle').textContent = changed ? 'Settings saved!' : 'You’re already up to date';
    document.querySelector('#settingsSavedDescription').textContent = changed
      ? 'Your preferences are saved on this device.'
      : 'No settings changed. Everything is just as you left it.';
    clearTimeout(dialogTimer);
    if (!savedDialog.open) savedDialog.showModal();
    dialogTimer = setTimeout(() => savedDialog.close(), 1500);
  }

  function render() {
    volume.value = preferences.volume;
    volumeValue.value = preferences.volume + '%';
    confetti.checked = preferences.confetti;
    weightUnit.value = preferences.weightUnit;
  }

  function save(change, includeSound = false) {
    saveButton.textContent = 'Save Settings';
    const previousUnit = preferences.weightUnit;
    const updated = { ...preferences, ...change };
    const current = { ...updated, sound: document.querySelector('#restSound').checked };
    const changed = Object.keys(current).some(name => current[name] !== confirmed[name]);
    let saved = false;
    try {
      if (includeSound) localStorage.setItem('setlog-rest-sound-v1', String(document.querySelector('#restSound').checked));
      localStorage.setItem(key, JSON.stringify(updated));
      preferences = updated;
      saved = true;
      status.textContent = '';
      delete status.dataset.state;
      if (includeSound) {
        saveButton.textContent = changed ? '✓ Settings Saved' : 'Save Settings';
      }
    } catch {
      status.dataset.state = 'error';
      status.textContent = 'Could not save settings on this device. Please try again.';
    }
    render();
    if (previousUnit !== preferences.weightUnit) window.dispatchEvent(new Event('weightunitchange'));
    if (includeSound && saved) {
      confirmed = current;
      showConfirmation(changed);
    }
  }

  volume.oninput = () => { volumeValue.value = volume.value + '%'; };
  volume.onchange = () => save({ volume: Number(volume.value) });
  confetti.onchange = () => save({ confetti: confetti.checked });
  weightUnit.onchange = () => save({ weightUnit: weightUnit.value });
  saveButton.onclick = () => save({
    volume: Number(volume.value),
    confetti: confetti.checked,
    weightUnit: weightUnit.value
  }, true);
  window.addEventListener('storage', event => {
    if (event.key === key) {
      const previousUnit = preferences.weightUnit;
      preferences = read(event.newValue);
      render();
      if (previousUnit !== preferences.weightUnit) window.dispatchEvent(new Event('weightunitchange'));
    }
  });
  render();
  return {
    volume: () => preferences.volume / 100,
    confetti: () => preferences.confetti,
    weightUnit: () => preferences.weightUnit
  };
})();
