const appSettings = (() => {
  const key = 'setlog-settings-v1';
  const volume = document.querySelector('#restVolume');
  const volumeValue = document.querySelector('#restVolumeValue');
  const confetti = document.querySelector('#showConfetti');
  const weightUnit = document.querySelector('#weightUnit');
  const heightUnit = document.querySelector('#heightUnit');
  const profileHeight = document.querySelector('#profileHeight');
  const profileHeightRemainder = document.querySelector('#profileHeightRemainder');
  const profileWeight = document.querySelector('#profileWeight');
  const weightFactors = { kg: 1, lbs: .45359237, st: 6.35029318, g: .001, oz: .028349523125 };
  const heightFactors = { mm: .1, cm: 1, m: 100, ft: 30.48, in: 2.54 };
  const heightNames = { mm: 'millimetres', cm: 'centimetres', m: 'metres and centimetres', ft: 'feet (decimal)', in: 'inches', 'ft-in': 'feet and inches' };
  const weightNames = { kg: 'kilograms', lbs: 'pounds', st: 'stones (decimal)', g: 'grams', oz: 'ounces' };
  const round = (value, decimals = 2) => Number(value.toFixed(decimals));
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
        weightUnit: Object.hasOwn(weightFactors, saved?.weightUnit) ? saved.weightUnit : 'kg',
        heightUnit: Object.hasOwn(heightNames, saved?.heightUnit) ? saved.heightUnit : 'cm',
        heightCm: Number.isFinite(saved?.heightCm) && saved.heightCm > 0 ? saved.heightCm : null,
        bodyWeightKg: Number.isFinite(saved?.bodyWeightKg) && saved.bodyWeightKg > 0 ? saved.bodyWeightKg : null
      };
    } catch {
      return { volume: 100, confetti: true, weightUnit: 'kg', heightUnit: 'cm', heightCm: null, bodyWeightKg: null };
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
    heightUnit.value = preferences.heightUnit;
    const feetAndInches = preferences.heightUnit === 'ft-in';
    const metresAndCentimetres = preferences.heightUnit === 'm';
    const splitHeight = feetAndInches || metresAndCentimetres;
    document.querySelector('#heightRemainderField').hidden = !splitHeight;
    profileHeightRemainder.disabled = !splitHeight;
    profileHeightRemainder.max = metresAndCentimetres ? '99.9999' : '11.9999';
    profileHeightRemainder.setAttribute('aria-label', metresAndCentimetres ? 'Additional centimetres' : 'Additional inches');
    document.querySelector('#profileHeightRemainderUnit').textContent = metresAndCentimetres ? 'cm' : 'in';
    profileHeight.min = splitHeight ? '0' : '0.0001';
    profileHeight.step = splitHeight ? '1' : 'any';
    profileHeightRemainder.value = '';
    if (preferences.heightCm === null) profileHeight.value = '';
    else if (feetAndInches) {
      const inches = round(preferences.heightCm / 2.54);
      profileHeight.value = Math.floor(inches / 12);
      profileHeightRemainder.value = round(inches % 12);
    } else if (metresAndCentimetres) {
      const centimetres = round(preferences.heightCm, 4);
      profileHeight.value = Math.floor(centimetres / 100);
      profileHeightRemainder.value = round(centimetres % 100, 4);
    } else profileHeight.value = round(preferences.heightCm / heightFactors[preferences.heightUnit], 4);
    profileHeight.dataset.displayValue = profileHeight.value + '|' + profileHeightRemainder.value;
    profileHeight.dataset.unit = preferences.heightUnit;
    document.querySelector('#profileHeightUnit').textContent = feetAndInches ? 'ft' : preferences.heightUnit;
    document.querySelector('#profileHeightHelp').textContent = 'Your height in ' + heightNames[preferences.heightUnit] + '.';
    document.querySelector('#profileWeightHelp').textContent = 'Your current body weight in ' + weightNames[preferences.weightUnit] + '.';
    const displayedWeight = preferences.bodyWeightKg === null ? '' : String(round(preferences.bodyWeightKg / weightFactors[preferences.weightUnit]));
    profileWeight.value = displayedWeight;
    profileWeight.dataset.displayValue = displayedWeight;
    profileWeight.dataset.unit = preferences.weightUnit;
    document.querySelector('#profileWeightUnit').textContent = preferences.weightUnit;
  }

  function save(change, includeSound = false) {
    const originalHeightUnit = profileHeight.dataset.unit;
    const splitHeight = originalHeightUnit === 'ft-in' || originalHeightUnit === 'm';
    const heightBlank = profileHeight.value === '' && (!splitHeight || profileHeightRemainder.value === '');
    const heightCm = heightBlank ? null
      : profileHeight.value + '|' + profileHeightRemainder.value === profileHeight.dataset.displayValue ? preferences.heightCm
      : Number((originalHeightUnit === 'ft-in'
        ? (Number(profileHeight.value) * 12 + Number(profileHeightRemainder.value)) * 2.54
        : originalHeightUnit === 'm' ? Number(profileHeight.value) * 100 + Number(profileHeightRemainder.value)
        : Number(profileHeight.value) * heightFactors[originalHeightUnit]).toPrecision(15));
    profileHeight.setCustomValidity(heightCm !== null && heightCm <= 0 ? 'Please enter a height greater than zero.' : '');
    if (!profileHeight.reportValidity() || !profileHeightRemainder.reportValidity() || !profileWeight.reportValidity()) {
      heightUnit.value = preferences.heightUnit;
      weightUnit.value = preferences.weightUnit;
      return;
    }
    saveButton.textContent = 'Save Settings';
    const previousUnit = preferences.weightUnit;
    const bodyWeightKg = profileWeight.value === '' ? null
      : profileWeight.value === profileWeight.dataset.displayValue ? preferences.bodyWeightKg
      : Number((Number(profileWeight.value) * weightFactors[profileWeight.dataset.unit]).toPrecision(15));
    const updated = { ...preferences,
      heightCm,
      bodyWeightKg, ...change };
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
  heightUnit.onchange = () => save({ heightUnit: heightUnit.value });
  profileHeight.onchange = () => save({});
  profileHeightRemainder.onchange = () => save({});
  profileWeight.onchange = () => save({});
  saveButton.onclick = () => save({
    volume: Number(volume.value),
    confetti: confetti.checked,
    weightUnit: weightUnit.value,
    heightUnit: heightUnit.value
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
    weightUnit: () => preferences.weightUnit,
    weightToKg: (value, unit) => Number((Number(value) * weightFactors[unit]).toPrecision(15)),
    weightFromKg: (value, unit) => Number(value) / weightFactors[unit]
  };
})();
