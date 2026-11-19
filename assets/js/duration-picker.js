const durationPicker = (() => {
  const dialog = document.querySelector('#durationDialog');
  const form = document.querySelector('#durationForm');
  const minutes = document.querySelector('#minutesWheel');
  const seconds = document.querySelector('#secondsWheel');
  const done = document.querySelector('#durationDone');
  const help = document.querySelector('#durationHelp');
  const wide = matchMedia('(min-width: 1100px)');
  const inputs = document.querySelector('#durationInputs');
  const minuteInput = document.querySelector('#durationMinutes');
  const secondInput = document.querySelector('#durationSeconds');
  const wheels = dialog.querySelector('.duration-wheels');
  const instructions = document.querySelector('#durationInstructions');
  const rowHeight = 44;
  let current = null;

  function format(total) {
    const value = Number(total);
    if (!value) return 'Choose time';
    const mins = Math.floor(value / 60);
    const secs = value % 60;
    return (mins ? mins + ' min' : '') + (mins && secs ? ' ' : '') + (secs ? secs + ' sec' : '');
  }

  function selected(wheel) {
    return wheel.children[Math.max(0, Math.min(wheel.children.length - 1, Math.round(wheel.scrollTop / rowHeight)))];
  }

  function totalSeconds() {
    if (current.typed) return Number(minuteInput.value) * 60 + Number(secondInput.value);
    return Number(selected(minutes).dataset.value) * 60 + Number(selected(seconds).dataset.value);
  }

  function update() {
    if (!current) return;
    if (current.typed && [minuteInput, secondInput].some(input => input.value === '' || !input.validity.valid)) {
      done.disabled = true;
      help.textContent = 'Enter whole minutes and seconds (0–59).';
      return;
    }
    for (const wheel of current.typed ? [] : [minutes, seconds]) {
      const active = selected(wheel);
      for (const item of wheel.children) item.setAttribute('aria-selected', item === active);
      wheel.setAttribute('aria-activedescendant', active.id);
    }
    const total = totalSeconds();
    done.disabled = !Number.isSafeInteger(total) || total === 0 || total > current.maximum;
    help.textContent = !Number.isSafeInteger(total) ? 'Enter a valid duration.'
      : total === 0 ? 'Choose at least 1 second.'
      : total > current.maximum ? 'Choose up to ' + format(current.maximum) + '.'
      : format(total);
  }

  function fill(wheel, values) {
    wheel.replaceChildren();
    wheel.dataset.count = values.length;
    // The middle copy leaves real values above zero and below the last number.
    for (let index = 0; index < values.length * 3; index++) {
      const value = values[index % values.length];
      const option = document.createElement('div');
      option.id = wheel.id + '-' + index;
      option.className = 'wheel-option';
      option.setAttribute('role', 'option');
      option.dataset.value = value;
      option.textContent = String(value).padStart(2, '0');
      option.onclick = () => {
        wheel.scrollTo({ top: (values.length + index % values.length) * rowHeight, behavior: 'instant' });
        update();
        wheel.focus({ preventScroll: true });
      };
      wheel.append(option);
    }
  }

  function configure(total) {
    current.typed = wide.matches;
    inputs.hidden = !current.typed;
    wheels.hidden = current.typed;
    minuteInput.disabled = secondInput.disabled = !current.typed;
    instructions.textContent = current.typed ? 'Enter minutes and seconds.' : 'Scroll to set minutes and seconds.';
    if (current.typed) {
      minuteInput.value = Math.floor(total / 60);
      secondInput.value = total % 60;
    } else {
      const selectedMinute = Math.floor(total / 60);
      const maximumMinute = Number.isFinite(current.maximum) ? Math.floor(current.maximum / 60) : Math.max(180, Math.min(1440, selectedMinute));
      const minuteValues = Array.from({ length: maximumMinute + 1 }, (_, index) => index);
      // Keep longer existing durations selectable without rendering huge lists.
      if (selectedMinute > maximumMinute) minuteValues.push(selectedMinute);
      fill(minutes, minuteValues);
      fill(seconds, Array.from({ length: 60 }, (_, index) => index));
      minutes.scrollTop = (minuteValues.length + minuteValues.indexOf(selectedMinute)) * rowHeight;
      seconds.scrollTop = (60 + total % 60) * rowHeight;
    }
    update();
    const focus = current.typed ? minuteInput : minutes;
    focus.focus({ preventScroll: true });
    if (current.typed) focus.select();
  }

  for (const input of [minuteInput, secondInput]) {
    input.oninput = update;
    input.onkeydown = event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (!done.disabled) done.click();
    };
  }
  wide.addEventListener('change', () => {
    if (!current || !dialog.open) return;
    const total = totalSeconds();
    configure(Number.isSafeInteger(total) && total >= 0 ? total : Number(current.input.value) || 0);
  });

  for (const wheel of [minutes, seconds]) {
    let settleTimeout;
    function recenter() {
      clearTimeout(settleTimeout);
      if (!current || !dialog.open) return;
      const count = Number(wheel.dataset.count);
      const index = Math.round(wheel.scrollTop / rowHeight);
      if (index < count || index >= count * 2) {
        const middleIndex = count + ((index % count) + count) % count;
        wheel.scrollTo({ top: middleIndex * rowHeight, behavior: 'instant' });
      }
      update();
    }
    wheel.onscroll = () => {
      update();
      clearTimeout(settleTimeout);
      // Fallback for browsers without scrollend; wait until touch scrolling settles.
      settleTimeout = setTimeout(recenter, 180);
    };
    wheel.addEventListener('scrollend', recenter);
    wheel.onkeydown = event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (!done.disabled) done.click();
        return;
      }
      const steps = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 };
      const count = Number(wheel.dataset.count);
      let index = Math.round(wheel.scrollTop / rowHeight);
      if (event.key in steps) index += steps[event.key];
      else if (event.key === 'Home') index = count;
      else if (event.key === 'End') index = count * 2 - 1;
      else return;
      event.preventDefault();
      wheel.scrollTo({ top: (count + ((index % count) + count) % count) * rowHeight, behavior: 'instant' });
      update();
    };
  }

  form.onsubmit = event => {
    if (event.submitter?.value !== 'save') return;
    event.preventDefault();
    update();
    if (done.disabled) return;
    const { input, control } = current;
    input.value = totalSeconds();
    control.refresh();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    dialog.close();
  };
  dialog.addEventListener('close', () => { current = null; });

  function attach(input, { label = 'Duration', maximum = Infinity } = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'duration-trigger';
    input.after(button);
    const control = {
      button,
      refresh() {
        button.textContent = format(input.value);
        button.disabled = input.disabled;
        button.setAttribute('aria-label', label + ', ' + format(input.value));
      }
    };
    button.onclick = () => {
      current = { input, control, maximum };
      document.querySelector('#durationTitle').textContent = label;
      const total = Number(input.value) || 0;
      dialog.showModal();
      configure(total);
    };
    control.refresh();
    return control;
  }

  return { attach, format };
})();
