(() => {
  const timer = document.querySelector('#restTimer');
  const dialTime = document.querySelector('#restDialTime');
  const dialLabel = document.querySelector('#restDialLabel');
  const progress = document.querySelector('#restProgress');
  const durationInput = document.querySelector('#restDuration');
  const start = document.querySelector('#restStart');
  const reset = document.querySelector('#restReset');
  const status = document.querySelector('#restStatus');
  const focus = document.querySelector('#restFocus');
  const focusTime = document.querySelector('#restFocusTime');
  const focusLabel = document.querySelector('#restFocusLabel');
  const focusProgress = document.querySelector('#restFocusProgress');
  const focusToggle = document.querySelector('#restFocusToggle');
  const expand = document.querySelector('#restExpand');
  const done = document.querySelector('#restFocusDone');
  const storageKey = 'setlog-rest-v1';
  let state = { duration: 90, remaining: 90, endsAt: null, paused: false };
  let interval = null;
  const durationControl = durationPicker.attach(durationInput, { label: 'Custom rest time', maximum: 3600 });

  function openFocus() {
    if (!focus.open) focus.showModal();
    document.documentElement.classList.add('rest-focus-open');
  }

  function celebrateCompletion() {
    done.focus({ preventScroll: true });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#141615', '#426829', '#ffffff', '#86b83a'];
    for (let index = 0; index < 40; index++) {
      const piece = document.createElement('span');
      piece.className = 'rest-confetti';
      piece.setAttribute('aria-hidden', 'true');
      piece.style.backgroundColor = colors[index % colors.length];
      piece.style.setProperty('--x', (Math.random() - 0.5) * Math.min(innerWidth * 1.3, 900) + 'px');
      piece.style.setProperty('--y', (Math.random() * 0.6 + 0.2) * innerHeight + 'px');
      piece.style.setProperty('--spin', (Math.random() - 0.5) * 1080 + 'deg');
      piece.style.animationDelay = Math.random() * 150 + 'ms';
      focus.append(piece);
      piece.addEventListener('animationend', () => piece.remove(), { once: true });
    }
    setTimeout(() => focus.querySelectorAll('.rest-confetti').forEach(piece => piece.remove()), 2000);
  }

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
    const complete = state.endsAt === null && remaining === 0;
    focus.classList.toggle('is-complete', complete);
    focus.querySelector('.rest-focus-header').hidden = complete;
    focus.querySelector('.focus-dial').hidden = complete;
    focus.querySelector('.rest-focus-actions').hidden = complete;
    done.hidden = !complete;
    if (!complete) focus.querySelectorAll('.rest-confetti').forEach(piece => piece.remove());
    focusTime.textContent = dialTime.textContent;
    focusLabel.textContent = complete ? 'Rest complete' : dialLabel.textContent;
    focusProgress.style.strokeDashoffset = complete ? '0' : progress.style.strokeDashoffset;
    focusToggle.textContent = complete ? 'Start another rest' : start.textContent;
    document.querySelector('#restFocusTitle').textContent = complete ? 'Break’s over!' : state.paused ? 'Take your time.' : 'Take a breather.';
    document.querySelector('#restFocusMessage').textContent = complete ? 'Time for your next set. You’ve got this.'
      : state.paused ? 'Your rest timer is paused.' : 'Recover, then come back ready.';
    const announcement = document.querySelector('#restFocusAnnouncement');
    const message = complete ? 'Your break is done. Let’s get back to it.' : '';
    if (announcement.textContent !== message) announcement.textContent = message;
    expand.hidden = state.endsAt === null && !state.paused && !complete;
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
      openFocus();
      render();
      celebrateCompletion();
      return;
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
    if (state.endsAt !== null) openFocus();
  };

  reset.onclick = () => chooseDuration(state.duration);
  focusToggle.onclick = () => start.click();
  document.querySelector('#restFocusReset').onclick = () => reset.click();
  document.querySelector('#restFocusClose').onclick = () => focus.close();
  done.onclick = () => focus.close();
  expand.onclick = openFocus;
  focus.addEventListener('close', () => {
    document.documentElement.classList.toggle('rest-focus-open', focus.open);
  });
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
    if (state.endsAt !== null) openFocus();
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
