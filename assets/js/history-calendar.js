const historyCalendar = (() => {
  let month = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12);
  let selected = null;
  let selectionToken = 0;

  function dateKey(date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  }

  function parseDate(value) {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
    if (!match) return null;
    const [, day, month, year] = match.map(Number);
    const date = new Date(year, month - 1, day, 12);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }

  function formatDate(value) {
    return parseDate(value)?.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) ?? value;
  }

  function select(value) {
    const date = parseDate(value);
    if (!date) return;
    selected = dateKey(date);
    month = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  }

  function render(target, sessions, renderEntries) {
    selectionToken++;
    target.replaceChildren();
    const entriesByDate = new Map();
    sessions.forEach((session, index) => {
      const date = parseDate(session.date);
      if (!date) return;
      const key = dateKey(date);
      if (!entriesByDate.has(key)) entriesByDate.set(key, []);
      entriesByDate.get(key).push({ session, index });
    });
    const today = dateKey(new Date());
    const firstEntry = [...entriesByDate.keys()].sort()[0];
    const prefix = dateKey(month).slice(0, 7);
    if (!selected || !selected.startsWith(prefix)) {
      selected = [...entriesByDate.keys()].filter(key => key.startsWith(prefix)).sort().at(-1)
        ?? (today.startsWith(prefix) ? today : dateKey(month));
    }

    const calendar = document.createElement('section');
    calendar.className = 'history-calendar';
    calendar.innerHTML = `
      <div class="calendar-header">
        <h2 id="historyMonth"></h2>
        <div class="row calendar-controls">
          <button type="button" class="calendar-prev" aria-label="Previous month">‹</button>
          <button type="button" class="calendar-today">Today</button>
          <button type="button" class="calendar-next" aria-label="Next month">›</button>
        </div>
      </div>
      <div class="calendar-weekdays" aria-hidden="true"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
      <div class="calendar-days" role="group" aria-labelledby="historyMonth"></div>
      <div class="calendar-legend">
        <span><i class="day-logged"></i>Workout</span>
        <span><i class="day-rest"></i>Rest day</span>
        <span><i class="day-missed"></i>Missed</span>
      </div>
      <p class="calendar-note">Missed = a past day with no entry since your first saved day.</p>
    `;
    calendar.querySelector('h2').textContent = month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const grid = calendar.querySelector('.calendar-days');
    const panel = document.createElement('div');
    panel.className = 'calendar-entries';
    panel.setAttribute('role', 'region');
    panel.tabIndex = -1;
    const buttons = new Map();

    function showDay(key, animate = false) {
      const token = ++selectionToken;
      selected = key;
      for (const [date, button] of buttons) button.setAttribute('aria-pressed', date === key);
      panel.getAnimations().forEach(animation => animation.cancel());
      panel.replaceChildren();
      const entries = entriesByDate.get(key) ?? [];
      const date = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8)), 12);
      const title = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      panel.setAttribute('aria-label', title + ' entries');
      if (entries.length) {
        renderEntries(entries, panel);
      } else {
        const empty = document.createElement('section');
        const heading = document.createElement('h2');
        const message = document.createElement('p');
        heading.textContent = title;
        message.className = 'muted picker-help';
        message.textContent = sessions.length ? 'No workout or rest day logged for this date.' : 'Your saved workouts and rest days will appear here.';
        empty.append(heading, message);
        panel.append(empty);
      }
      if (!animate) return;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const scroll = () => {
        if (token !== selectionToken || !panel.isConnected) return;
        panel.focus({ preventScroll: true });
        panel.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      };
      if (reduced) {
        scroll();
        return;
      }
      const opening = panel.animate(
        [{ height: '0px', opacity: 0 }, { height: panel.scrollHeight + 'px', opacity: 1 }],
        { duration: 280, easing: 'cubic-bezier(.2,.7,.3,1)' }
      );
      opening.finished.then(scroll).catch(() => {});
    }

    const offset = (month.getDay() + 6) % 7;
    for (let index = 0; index < offset; index++) {
      const spacer = document.createElement('span');
      spacer.setAttribute('aria-hidden', 'true');
      grid.append(spacer);
    }
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(month.getFullYear(), month.getMonth(), day, 12);
      const key = dateKey(date);
      const entries = entriesByDate.get(key) ?? [];
      const hasWorkout = entries.some(entry => !entry.session.restDay);
      const hasRest = entries.some(entry => entry.session.restDay);
      const missed = !entries.length && firstEntry && key >= firstEntry && key < today;
      const status = hasWorkout ? 'Workout logged' : hasRest ? 'Rest day' : missed ? 'Missed' : 'No entry';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'calendar-day' + (hasWorkout ? ' day-logged' : hasRest ? ' day-rest' : missed ? ' day-missed' : '');
      button.textContent = day;
      button.dataset.date = key;
      button.setAttribute('aria-label', date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        + ' · ' + status + (hasWorkout && hasRest ? ' and rest day' : ''));
      if (key === today) button.setAttribute('aria-current', 'date');
      button.onclick = () => showDay(key, true);
      buttons.set(key, button);
      grid.append(button);
    }

    function changeMonth(offset) {
      month = new Date(month.getFullYear(), month.getMonth() + offset, 1, 12);
      selected = null;
      render(target, sessions, renderEntries);
      target.querySelector('.calendar-' + (offset < 0 ? 'prev' : 'next')).focus({ preventScroll: true });
    }
    calendar.querySelector('.calendar-prev').onclick = () => changeMonth(-1);
    calendar.querySelector('.calendar-next').onclick = () => changeMonth(1);
    calendar.querySelector('.calendar-today').onclick = () => {
      month = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12);
      selected = today;
      render(target, sessions, renderEntries);
      target.querySelector('[aria-current=date]').focus({ preventScroll: true });
    };
    target.append(calendar, panel);
    showDay(selected);
  }

  return { render, select, formatDate };
})();
