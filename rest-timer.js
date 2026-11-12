(() => {
  const timer = document.querySelector('#restTimer');
  const dialTime = document.querySelector('#restDialTime');
  const dialLabel = document.querySelector('#restDialLabel');
  const progress = document.querySelector('#restProgress');
  const durationInput = document.querySelector('#restDuration');
  const start = document.querySelector('#restStart');
  const reset = document.querySelector('#restReset');
  const status = document.querySelector('#restStatus');
  const storageKey = 'setlog-rest-v1';
  let state = { duration: 90, remaining: 90, endsAt: null, paused: false };
  let interval = null;
  const durationControl = durationPicker.attach(durationInput, { label: 'Custom rest time', maximum: 3600 });

  function readState(value) {
    const parsed = JSON.parse(value);
    if (!parsed || !Number.isInteger(parsed.duration) || parsed.duration < 1 || parsed.duration > 3600
      || !Number.isFinite(parsed.remaining) || parsed.remaining < 0 || parsed.remaining > parsed.duration
      || (parsed.endsAt !== null && !Number.isFinite(parsed.endsAt))) return null;
    return parsed;
  }

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      status.textContent = 'Timer is running on this screen. Its state could not be saved.';
    }
  }

  function remainingSeconds() {
    return state.endsAt === null
      ? state.remaining
      : Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
  }

  function render() {
    const remaining = remainingSeconds();
    dialTime.textContent = Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2, '0');
    dialLabel.textContent = state.endsAt !== null ? 'Resting…' : state.paused ? 'Paused'
      : remaining === 0 ? 'Rest complete' : 'Ready to rest';
    const exactRemaining = state.endsAt === null ? state.remaining : (state.endsAt - Date.now()) / 1000;
    const fraction = Math.max(0, Math.min(1, exactRemaining / state.duration));
    progress.style.strokeDashoffset = String((1 - fraction) * 100);
    start.textContent = state.endsAt !== null ? 'Pause' : state.paused ? 'Resume' : 'Start';
    durationInput.disabled = state.endsAt !== null;
    durationControl.refresh();
    timer.querySelectorAll('[data-rest]').forEach(button => {
      button.setAttribute('aria-pressed', Number(button.dataset.rest) === state.duration);
    });
  }

  function tick() {
    if (state.endsAt !== null && remainingSeconds() === 0) {
      state.endsAt = null;
      state.remaining = 0;
      state.paused = false;
      clearInterval(interval);
      interval = null;
      timer.open = true;
      status.textContent = 'Rest complete. Ready for your next set?';
      persist();
    }
    render();
  }

  function schedule() {
    clearInterval(interval);
    interval = null;
    tick();
    if (state.endsAt !== null) interval = setInterval(tick, 250);
  }

  function chooseDuration(seconds) {
    state = { duration: seconds, remaining: seconds, endsAt: null, paused: false };
    durationInput.value = seconds;
    status.textContent = 'Ready. Tap Start when your set is finished.';
    schedule();
    persist();
  }

  start.onclick = () => {
    if (state.endsAt !== null) {
      state.remaining = remainingSeconds();
      state.endsAt = null;
      state.paused = state.remaining > 0;
      status.textContent = state.remaining ? 'Timer paused.' : 'Rest complete. Ready for your next set?';
    } else {
      if (!durationInput.reportValidity()) return;
      const duration = Number(durationInput.value);
      if (duration !== state.duration) {
        state.duration = duration;
        state.remaining = duration;
      }
      if (!state.remaining) state.remaining = state.duration;
      state.endsAt = Date.now() + state.remaining * 1000;
      state.paused = false;
      status.textContent = 'Resting…';
    }
    schedule();
    persist();
  };

  reset.onclick = () => chooseDuration(state.duration);
  durationInput.onchange = () => {
    if (durationInput.reportValidity()) chooseDuration(Number(durationInput.value));
  };
  timer.querySelectorAll('[data-rest]').forEach(button => {
    button.onclick = () => chooseDuration(Number(button.dataset.rest));
  });

  function restore(value) {
    try {
      const saved = readState(value);
      if (saved) state = saved;
    } catch {
      // Keep the default timer available when storage cannot be read.
    }
    durationInput.value = state.duration;
    status.textContent = state.endsAt !== null ? 'Resting…'
      : state.remaining === 0 ? 'Rest complete. Ready for your next set?'
      : state.paused ? 'Timer paused.' : 'Choose your rest time, then tap Start.';
    schedule();
  }

  try {
    restore(localStorage.getItem(storageKey));
  } catch {
    render();
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tick();
  });
  window.addEventListener('storage', event => {
    if (event.key === storageKey) restore(event.newValue);
  });
})();
