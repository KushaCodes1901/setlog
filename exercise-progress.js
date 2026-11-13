const exerciseProgress = (() => {
  const key = value => String(value).trim().toLowerCase();
  const positive = value => Number.isFinite(Number(value)) && Number(value) > 0;
  const sameWeight = (a, b) => Math.abs(Number(a ?? 0) - Number(b ?? 0)) < 1e-7;

  function dateValue(value) {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
    if (!match) return null;
    const [, day, month, year] = match.map(Number);
    const date = new Date(year, month - 1, day, 12);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date.getTime() : null;
  }

  function names(sessions) {
    const unique = new Map();
    for (const session of sessions) {
      if (session.restDay || dateValue(session.date) === null) continue;
      for (const exercise of session.exercises) {
        if (exercise.sets.some(set => positive(set.seconds) || (set.seconds == null && positive(set.reps)))) unique.set(key(exercise.name), exercise.name.trim());
      }
    }
    return [...unique.values()].sort((a, b) => a.localeCompare(b));
  }

  function analyze(sessions, name) {
    const assisted = /assisted|assistance/.test(key(name));
    const entries = [];
    sessions.forEach((session, index) => {
      const timestamp = dateValue(session.date);
      if (session.restDay || timestamp === null) return;
      const sets = session.exercises.filter(exercise => key(exercise.name) === key(name)).flatMap(exercise => exercise.sets)
        .filter(set => positive(set.seconds) || (set.seconds == null && positive(set.reps)));
      if (!sets.length) return;
      const lifted = sets.filter(set => set.seconds == null && positive(set.reps)
        && (positive(set.weight) || (assisted && set.weight != null && Number(set.weight) === 0)));
      const topSet = [...lifted].sort((a, b) => (assisted ? Number(a.weight) - Number(b.weight) : Number(b.weight) - Number(a.weight))
        || Number(b.reps) - Number(a.reps))[0] ?? null;
      const repSets = sets.filter(set => set.seconds == null && positive(set.reps));
      const timedSets = sets.filter(set => positive(set.seconds));
      entries.push({ date: session.date, timestamp, index, sets, topSet,
        weight: topSet ? Number(topSet.weight) : null,
        reps: repSets.length ? Math.max(...repSets.map(set => Number(set.reps))) : null,
        seconds: timedSets.length ? Math.max(...timedSets.map(set => Number(set.seconds))) : null });
    });
    entries.sort((a, b) => a.timestamp - b.timestamp || a.index - b.index);
    const metrics = ['weight', 'reps', 'seconds'].filter(metric => entries.some(entry => entry[metric] !== null));
    return { name, assisted, entries, metrics };
  }

  function insight(data) {
    const latest = data.entries.at(-1);
    const previous = data.entries.at(-2);
    if (!previous) return { kind: 'start' };
    // Compare reps only at the same logged load, never across different weights.
    let repGain = null;
    for (const set of latest.sets) {
      if (set.seconds != null || !positive(set.reps)) continue;
      const matches = previous.sets.filter(old => old.seconds == null && positive(old.reps) && sameWeight(old.weight, set.weight));
      const gain = matches.length ? Number(set.reps) - Math.max(...matches.map(old => Number(old.reps))) : 0;
      if (gain > 0 && (!repGain || gain > repGain.amount)) repGain = { kind: 'reps', amount: gain, weight: Number(set.weight ?? 0) };
    }
    if (repGain) return repGain;
    if (latest.weight !== null && previous.weight !== null && !sameWeight(latest.weight, previous.weight)
      && (data.assisted ? latest.weight < previous.weight : latest.weight > previous.weight)) {
      return { kind: data.assisted ? 'assistance' : 'weight', latest: latest.topSet, previous: previous.topSet };
    }
    if (latest.seconds !== null && previous.seconds !== null && latest.seconds > previous.seconds) {
      return { kind: 'time', amount: latest.seconds - previous.seconds };
    }
    return { kind: 'steady' };
  }

  let dialog;
  let source;
  let selectedName;
  let selectedMetric;
  let visibleSessions = 6;
  let formatWeight;
  let returnFocus;
  const duration = seconds => Math.floor(Math.round(seconds) / 60) + ':' + String(Math.round(seconds) % 60).padStart(2, '0');
  const metricLabel = (metric, assisted) => metric === 'weight' ? (assisted ? 'Lowest assistance' : 'Heaviest weight')
    : metric === 'reps' ? 'Most reps in a set' : 'Longest timed set';
  const valueText = (value, metric) => metric === 'weight' ? formatWeight(value) : metric === 'reps' ? value + ' reps' : duration(value);
  const shortDate = entry => new Date(entry.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  function setText(selector, text) { dialog.querySelector(selector).textContent = text; }
  function setSummary(set, assisted) {
    if (set.seconds != null) return duration(Number(set.seconds));
    return set.reps + ' reps' + (set.weight != null && (Number(set.weight) > 0 || assisted)
      ? ' × ' + formatWeight(set.weight) + (assisted ? ' assistance' : '') : '');
  }

  function render() {
    const sessions = source();
    const allNames = names(sessions);
    const select = dialog.querySelector('#progressExercise');
    if ([...select.options].map(option => option.value).join('\n') !== allNames.join('\n')) {
      select.replaceChildren(...allNames.map(name => new Option(name, name)));
    }
    if (!allNames.some(name => key(name) === key(selectedName))) selectedName = allNames[0];
    selectedName = allNames.find(name => key(name) === key(selectedName));
    select.value = selectedName ?? '';
    const data = analyze(sessions, selectedName ?? '');
    setText('#exerciseProgressTitle', selectedName ?? 'Exercise Progress');
    dialog.querySelector('.progress-content').hidden = !data.entries.length;
    dialog.querySelector('.progress-empty').hidden = Boolean(data.entries.length);
    if (!data.entries.length) return;
    if (!data.metrics.includes(selectedMetric)) selectedMetric = data.metrics[0];
    const result = insight(data);
    const headings = { start: 'Your story starts here.', reps: 'Those extra reps add up.', weight: 'A new challenge, logged.',
      assistance: 'A little less help this time.', time: 'More time on the clock.', steady: 'Another session in the books.' };
    const tags = { start: 'STARTING MARK', reps: 'MORE REPS', weight: 'MORE WEIGHT', assistance: 'LESS ASSISTANCE', time: 'MORE TIME', steady: 'KEEP SHOWING UP' };
    let message = 'Progress isn’t always a bigger number. Your history keeps the full picture.';
    if (result.kind === 'start') message = 'Your first session is in. Log another to see how your numbers change.';
    if (result.kind === 'reps') message = result.amount + (result.amount === 1 ? ' more rep' : ' more reps')
      + (result.weight > 0 ? (data.assisted ? ' with ' : ' at ') + formatWeight(result.weight) + (data.assisted ? ' assistance' : '') : '')
      + (result.weight > 0 ? ' than your previous session at the same weight.' : ' than your previous session.');
    if (result.kind === 'weight' || result.kind === 'assistance') message = 'Latest top set: ' + setSummary(result.latest, data.assisted)
      + '. Previous: ' + setSummary(result.previous, data.assisted) + '. Weight and reps both matter.';
    if (result.kind === 'time') message = result.amount + (result.amount === 1 ? ' second' : ' seconds') + ' longer in your longest timed set than your previous session.';
    setText('.progress-win-tag', tags[result.kind]);
    setText('.progress-win h3', headings[result.kind]);
    setText('.progress-win p', message);
    const entries = data.entries.filter(entry => entry[selectedMetric] !== null);
    const values = entries.map(entry => entry[selectedMetric]);
    const best = selectedMetric === 'weight' && data.assisted ? Math.min(...values) : Math.max(...values);
    setText('.progress-best-label', metricLabel(selectedMetric, data.assisted));
    setText('.progress-best-value', valueText(best, selectedMetric));
    setText('.progress-session-count', data.entries.length);
    const tabs = dialog.querySelector('.progress-metrics');
    tabs.replaceChildren();
    for (const metric of data.metrics) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = metric === 'weight' ? (data.assisted ? 'Assistance' : 'Weight') : metric === 'reps' ? 'Reps' : 'Time';
      button.setAttribute('aria-pressed', metric === selectedMetric);
      button.onclick = () => {
        selectedMetric = metric;
        render();
        dialog.querySelector('.progress-metrics button[aria-pressed=true]').focus({ preventScroll: true });
      };
      tabs.append(button);
    }
    const note = selectedMetric === 'weight' ? (data.assisted ? 'Lower means less assistance. Reps are shown with each session.'
      : 'Each point shows the heaviest set in one session. Check the reps too.')
      : selectedMetric === 'reps' ? 'Each point shows the most reps in one set. Loads may differ; check the session details.'
        : 'Each point shows the longest timed set. This measures duration, not speed.';
    setText('.progress-chart-note', note + (entries.length > 12 ? ' Showing the latest 12 sessions.' : ''));
    renderChart(entries.slice(-12), data);
    const list = dialog.querySelector('.progress-session-list');
    list.replaceChildren();
    const recent = [...data.entries].reverse();
    for (const entry of recent.slice(0, visibleSessions)) {
      const row = document.createElement('li');
      const date = document.createElement('strong');
      date.textContent = entry.date;
      const count = document.createElement('small');
      count.textContent = entry.sets.length + (entry.sets.length === 1 ? ' set' : ' sets');
      const sets = document.createElement('div');
      sets.className = 'progress-session-sets';
      entry.sets.forEach((set, index) => {
        const text = document.createElement('p');
        text.textContent = 'Set ' + (index + 1) + ' · ' + setSummary(set, data.assisted);
        sets.append(text);
      });
      row.append(date, count, sets);
      list.append(row);
    }
    dialog.querySelector('#progressMore').hidden = recent.length <= visibleSessions;
  }

  function renderChart(entries, data) {
    const svg = dialog.querySelector('.progress-chart');
    svg.replaceChildren();
    const ns = 'http://www.w3.org/2000/svg';
    const add = (tag, attrs, text) => {
      const element = document.createElementNS(ns, tag);
      for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
      if (text != null) element.textContent = text;
      svg.append(element);
      return element;
    };
    const numeric = value => selectedMetric === 'weight' ? appSettings.weightFromKg(value, appSettings.weightUnit()) : value;
    const maximum = Math.max(...entries.map(entry => numeric(entry[selectedMetric])), 1) * 1.15;
    const left = 55, right = 342, top = 20, bottom = 158;
    for (let tick = 0; tick <= 2; tick++) {
      const value = maximum * tick / 2;
      const y = bottom - (bottom - top) * tick / 2;
      add('line', { x1: left, y1: y, x2: right, y2: y, class: 'progress-grid', 'aria-hidden': true });
      const label = selectedMetric === 'seconds' ? duration(value) : String(Number(value.toFixed(value < 10 ? 1 : 0)));
      add('text', { x: left - 10, y: y + 4, 'text-anchor': 'end', class: 'progress-axis', 'aria-hidden': true }, label);
    }
    const points = entries.map((entry, index) => ({ entry,
      x: entries.length === 1 ? (left + right) / 2 : left + (right - left) * index / (entries.length - 1),
      y: bottom - numeric(entry[selectedMetric]) / maximum * (bottom - top) }));
    if (points.length > 1) {
      const line = points.map((point, index) => (index ? 'L' : 'M') + point.x + ' ' + point.y).join(' ');
      add('path', { d: line + ' L' + right + ' ' + bottom + ' L' + left + ' ' + bottom + ' Z', class: 'progress-area', 'aria-hidden': true });
      add('path', { d: line, class: 'progress-line', 'aria-hidden': true });
    }
    const selectors = [];
    const selectPoint = (point, position) => {
      selectors.forEach((element, index) => element.setAttribute('aria-pressed', position === index));
      const entry = point.entry;
      const detail = dialog.querySelector('.progress-selected');
      detail.replaceChildren();
      const date = document.createElement('span');
      date.textContent = entry.date;
      const value = document.createElement('strong');
      value.textContent = valueText(entry[selectedMetric], selectedMetric);
      const context = document.createElement('small');
      context.textContent = selectedMetric === 'weight' ? setSummary(entry.topSet, data.assisted)
        : entry.sets.filter(set => selectedMetric === 'seconds' ? Number(set.seconds) === entry.seconds : set.seconds == null && Number(set.reps) === entry.reps)
          .map(set => setSummary(set, data.assisted)).join(' · ');
      detail.append(date, value, context);
    };
    points.forEach((point, index) => {
      add('circle', { cx: point.x, cy: point.y, r: 4, class: 'progress-dot', 'aria-hidden': true, 'pointer-events': 'none' });
      const target = add('circle', { cx: point.x, cy: point.y, r: 14, class: 'progress-point', role: 'button', tabindex: 0,
        'aria-label': point.entry.date + ' · ' + valueText(point.entry[selectedMetric], selectedMetric), 'aria-pressed': false });
      target.onclick = () => selectPoint(point, index);
      target.onkeydown = event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectPoint(point, index); }
      };
      selectors.push(target);
      if (index === 0 || index === points.length - 1 || (points.length > 4 && index === Math.floor(points.length / 2))) {
        add('text', { x: point.x, y: 185, 'text-anchor': index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle',
          class: 'progress-axis', 'aria-hidden': true }, shortDate(point.entry));
      }
    });
    selectPoint(points.at(-1), points.length - 1);
    setText('.progress-chart-unit', selectedMetric === 'weight' ? appSettings.weightUnit() : selectedMetric === 'reps' ? 'reps' : 'min:sec');
  }

  function open(options) {
    source = options.readSessions;
    formatWeight = options.formatWeight;
    selectedName = options.name;
    selectedMetric = null;
    visibleSessions = 6;
    returnFocus = document.activeElement;
    if (!dialog) {
      dialog = document.querySelector('#exerciseProgressDialog');
      dialog.querySelector('#progressBack').onclick = () => dialog.close();
      dialog.querySelector('#progressExercise').onchange = event => {
        selectedName = event.target.value;
        selectedMetric = null;
        visibleSessions = 6;
        render();
      };
      dialog.querySelector('#progressMore').onclick = () => { visibleSessions += 6; render(); };
      dialog.addEventListener('close', () => {
        document.documentElement.classList.remove('exercise-progress-open');
        if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      });
      window.addEventListener('weightunitchange', () => { if (dialog.open) render(); });
      window.addEventListener('storage', event => { if (dialog.open && event.key === 'setlog-v1') render(); });
    }
    render();
    document.documentElement.classList.add('exercise-progress-open');
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }

  return { analyze, names, insight, open };
})();
