const durationPicker = (() => {
  const dialog = document.querySelector('#durationDialog');
  const form = document.querySelector('#durationForm');
  const minutes = document.querySelector('#minutesWheel');
  const seconds = document.querySelector('#secondsWheel');
  const done = document.querySelector('#durationDone');
  const help = document.querySelector('#durationHelp');
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
    return Number(selected(minutes).dataset.value) * 60 + Number(selected(seconds).dataset.value);
  }

  function update() {
    if (!current) return;
    for (const wheel of [minutes, seconds]) {
      const active = selected(wheel);
      for (const item of wheel.children) item.setAttribute('aria-selected', item === active);
      wheel.setAttribute('aria-activedescendant', active.id);
    }
    const total = totalSeconds();
    done.disabled = total === 0 || total > current.maximum;
    help.textContent = total === 0 ? 'Choose at least 1 second.'
      : total > current.maximum ? 'Choose up to ' + format(current.maximum) + '.'
      : format(total);
  }

  function fill(wheel, values) {
    wheel.replaceChildren();
    for (const value of values) {
      const option = document.createElement('div');
      option.id = wheel.id + '-' + value;
      option.className = 'wheel-option';
      option.setAttribute('role', 'option');
      option.dataset.value = value;
      option.textContent = String(value).padStart(2, '0');
      option.onclick = () => {
        wheel.scrollTo({ top: Array.from(wheel.children).indexOf(option) * rowHeight, behavior: 'auto' });
        update();
        wheel.focus({ preventScroll: true });
      };
      wheel.append(option);
    }
  }

  for (const wheel of [minutes, seconds]) {
    wheel.onscroll = update;
    wheel.onkeydown = event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (!done.disabled) done.click();
        return;
      }
      const steps = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 };
      let index = Math.round(wheel.scrollTop / rowHeight);
      if (event.key in steps) index += steps[event.key];
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = wheel.children.length - 1;
      else return;
      event.preventDefault();
      wheel.scrollTop = Math.max(0, Math.min(wheel.children.length - 1, index)) * rowHeight;
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
      const selectedMinute = Math.floor(total / 60);
      const maximumMinute = Number.isFinite(maximum) ? Math.floor(maximum / 60) : Math.max(180, Math.min(1440, selectedMinute));
      const minuteValues = Array.from({ length: maximumMinute + 1 }, (_, index) => index);
      // Keep longer existing durations selectable without rendering huge lists.
      if (selectedMinute > maximumMinute) minuteValues.push(selectedMinute);
      fill(minutes, minuteValues);
      fill(seconds, Array.from({ length: 60 }, (_, index) => index));
      dialog.showModal();
      minutes.scrollTop = minuteValues.indexOf(selectedMinute) * rowHeight;
      seconds.scrollTop = (total % 60) * rowHeight;
      update();
      minutes.focus({ preventScroll: true });
    };
    control.refresh();
    return control;
  }

  return { attach, format };
})();
