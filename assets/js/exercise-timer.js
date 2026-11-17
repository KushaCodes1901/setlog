const exerciseTimer = (() => {
  const dialog = document.querySelector('#exerciseFocus');
  const title = document.querySelector('#exerciseFocusTitle');
  const setLabel = document.querySelector('#exerciseFocusSet');
  const message = document.querySelector('#exerciseFocusMessage');
  const time = document.querySelector('#exerciseFocusTime');
  const progress = document.querySelector('#exerciseFocusProgress');
  const stop = document.querySelector('#exerciseFocusStop');
  const done = document.querySelector('#exerciseFocusDone');
  const announcement = document.querySelector('#exerciseFocusAnnouncement');
  let owner = null;
  let duration = 0;
  let stopCurrent = null;

  function close() {
    if (dialog.open) dialog.close();
  }

  function update(row, remaining) {
    if (owner !== row) return;
    const seconds = Math.max(0, Math.ceil(remaining));
    time.textContent = Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    progress.style.strokeDashoffset = String(100 * (1 - Math.max(0, Math.min(1, remaining / duration))));
  }

  function open(row, total, remaining, onStop) {
    owner = row;
    duration = total;
    stopCurrent = onStop;
    title.textContent = row.closest('article').querySelector('h3').textContent;
    setLabel.textContent = row.querySelector('.set-number').textContent;
    message.textContent = 'Keep going. One second at a time.';
    announcement.textContent = '';
    dialog.classList.remove('is-complete');
    dialog.querySelector('.rest-focus-header').hidden = false;
    dialog.querySelector('.focus-dial').hidden = false;
    dialog.querySelector('.rest-focus-actions').hidden = false;
    done.hidden = true;
    update(row, remaining);
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add('exercise-focus-open');
  }

  function complete(row, stopped = false) {
    if (owner !== row) return;
    stopCurrent = null;
    dialog.classList.add('is-complete');
    dialog.querySelector('.rest-focus-header').hidden = true;
    dialog.querySelector('.focus-dial').hidden = true;
    dialog.querySelector('.rest-focus-actions').hidden = true;
    title.textContent = stopped ? 'Time recorded.' : 'Set complete!';
    const recorded = Number(row.querySelector('.reps').value);
    message.textContent = (recorded > 0 ? durationPicker.format(recorded) + ' recorded. ' : '')
      + 'Review your set, then save the exercise.';
    announcement.textContent = title.textContent + ' ' + message.textContent;
    done.hidden = false;
    if (dialog.open) done.focus({ preventScroll: true });
  }

  document.querySelector('#exerciseFocusBack').onclick = close;
  done.onclick = close;
  stop.onclick = () => stopCurrent?.();
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('exercise-focus-open');
    if (owner?.isConnected) owner.querySelector('.plank-start').focus({ preventScroll: true });
  });
  return { open, update, complete, dismiss(row) { if (owner === row) { close(); owner = null; stopCurrent = null; } } };
})();
