const day = document.querySelector('#day');
const workout = document.querySelector('#workout');
const nameInput = document.querySelector('#name');
const addExerciseButton = document.querySelector('#addExercise');
const exerciseHint = document.querySelector('#exerciseHint');
const exercisePicker = document.querySelector('#exercisePicker');
const exerciseChoices = document.querySelector('#exerciseChoices');
const exerciseArea = document.querySelector('#exerciseArea');
const exerciseEquipment = document.querySelector('#exerciseEquipment');
const exercises = document.querySelector('#exercises');
const historyView = document.querySelector('#history');
const saveButton = document.querySelector('#save');
const cancelEdit = document.querySelector('#cancelEdit');
const restDay = document.querySelector('#restDay');
const workoutExercises = document.querySelector('#workoutExercises');
const storageKey = 'setlog-v1';
const effortLevels = [
  ['😄', 'Very easy'], ['🙂', 'Easy'], ['😐', 'Moderate'], ['😣', 'Hard'], ['😫', 'Max effort']
];
let storageReadable = true;
let hasDraft = false;
let editing = null;
let activeView = 'log';
const viewScroll = { home: 0, log: 0, rest: 0, history: 0, settings: 0 };

function tell(message, error = false) {
  const status = document.querySelector('#status');
  status.textContent = message;
  status.classList.toggle('error', error);
}

function readStorage() {
  return JSON.parse(localStorage.getItem(storageKey)) ?? { sessions: [], draft: null };
}

function writeStorage(change) {
  if (!storageReadable) return false;
  try {
    const updated = change(readStorage());
    if (!updated) return false;
    localStorage.setItem(storageKey, JSON.stringify(updated));
    return true;
  } catch {
    tell('Could not save on this device. Your entries are still on screen.', true);
    return false;
  }
}

function getSetValues(row) {
  const quantity = row.querySelector('.reps').value;
  const set = row.dataset.timed === 'true' ? { seconds: quantity } : { reps: quantity };
  if (row.dataset.legacyReps && quantity === '') {
    delete set.seconds;
    set.reps = row.dataset.legacyReps;
  }
  if (row.dataset.holdEndsAt) {
    set.holdEndsAt = Number(row.dataset.holdEndsAt);
    set.holdStartedAt = Number(row.dataset.holdStartedAt);
  }
  const weight = row.querySelector('.weight');
  if (!weight.disabled) set.weight = readWeight(weight);
  const effort = row.querySelector('.effort-options [aria-pressed=true]');
  const repsLeft = row.querySelector('.reps-left').value;
  if (effort) set.effort = Number(effort.value);
  if (repsLeft !== '') set.repsLeft = Number(repsLeft);
  return set;
}

// All stored weights are kilograms. Keep the original value when a rounded
// converted display has not been edited, so unit changes never accumulate drift.
function readWeight(input) {
  if (input.value === '') return '';
  if (input.value === input.dataset.displayValue) return input.dataset.kg;
  return String(appSettings.weightToKg(input.value, input.dataset.unit));
}

function weightDisplayValue(kg, unit) {
  if (kg == null || kg === '') return '';
  const value = appSettings.weightFromKg(kg, unit);
  return String(Math.round((value + Number.EPSILON) * 100) / 100);
}

function formatWeight(kg) {
  return weightDisplayValue(kg, appSettings.weightUnit()) + ' ' + appSettings.weightUnit();
}

function displayWeight(input, kg, unit) {
  input.dataset.kg = kg ?? '';
  input.dataset.unit = unit;
  input.value = weightDisplayValue(kg, unit);
  input.dataset.displayValue = input.value;
  input.closest('label').querySelector('.weight-label').textContent = 'Weight (' + unit + ')';
}

function getSets(list) {
  return Array.from(list.children, getSetValues);
}

function isBodyweight(name) {
  const tracking = exerciseDefinition(name)?.tracking;
  return tracking === 'reps' || tracking === 'seconds';
}

function isTimedExercise(name) {
  return exerciseDefinition(name)?.tracking === 'seconds';
}

function isHold(name) {
  return ['Plank', 'Side Plank', 'Dead Hang'].includes(exerciseDefinition(name)?.name);
}

function setResult(set, name) {
  const showWeight = set.weight != null && set.weight !== '' && (!isBodyweight(name) || Number(set.weight) > 0);
  const quantity = set.seconds != null
    ? durationPicker.format(set.seconds)
    : set.reps + ' reps';
  return quantity + (showWeight ? ' × ' + formatWeight(set.weight) : '');
}

function setNotes(set) {
  const notes = [];
  const effort = effortLevels[set.effort - 1];
  if (effort) notes.push(effort[0] + ' ' + effort[1] + ' · ' + set.effort + '/5');
  if (set.repsLeft != null) notes.push(set.repsLeft + (set.repsLeft === 1 ? ' rep left' : ' reps left'));
  return notes.join(' · ');
}

function getExercises() {
  return Array.from(exercises.children, card => ({
    name: card.querySelector('h3').textContent,
    sets: getSets(card.querySelector('.sets')),
    openSet: Array.from(card.querySelector('.sets').children).findIndex(row => !row.querySelector('.set-editor').hidden),
    saved: card.querySelector('.exercise-editor').hidden
  }));
}

function updateExerciseSummary(card) {
  const summary = card.querySelector('.exercise-summary');
  summary.replaceChildren();
  const name = card.querySelector('h3').textContent;
  getSets(card.querySelector('.sets')).forEach((set, index) => {
    const item = document.createElement('li');
    item.textContent = 'Set ' + (index + 1) + ' · ' + setResult(set, name);
    const notes = setNotes(set);
    if (notes) item.append(' · ' + notes);
    summary.append(item);
  });
}

function updateWorkoutControls() {
  const hasOpenExercise = Boolean(exercises.querySelector('.exercise-editor:not([hidden])'));
  nameInput.disabled = hasOpenExercise;
  addExerciseButton.disabled = hasOpenExercise;
  exerciseHint.hidden = !hasOpenExercise;
  exercisePicker.hidden = hasOpenExercise;
  if (hasOpenExercise) exercisePicker.open = false;
  workoutExercises.hidden = restDay.checked;
  workoutExercises.disabled = restDay.checked;
  document.querySelector('#restDayMessage').hidden = !restDay.checked;
  saveButton.disabled = !restDay.checked && (hasOpenExercise || !exercises.children.length);
  saveButton.textContent = editing ? 'Save changes' : restDay.checked ? 'Save rest day' : 'Save workout';
  restDay.disabled = Boolean(exercises.querySelector('[data-hold-ends-at]'));
  for (const card of exercises.children) {
    const running = Boolean(card.querySelector('[data-hold-ends-at]'));
    card.querySelector('.save-exercise').disabled = running;
    card.querySelector('.add-set').disabled = running;
  }
}

function exerciseKey(name) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function exerciseDefinition(name) {
  const key = exerciseKey(name).replace(/[^a-z0-9]/g, '');
  return exerciseCatalog.find(exercise => [exercise.name, ...(exercise.aliases ?? [])]
    .some(alias => exerciseKey(alias).replace(/[^a-z0-9]/g, '') === key));
}

function equipmentGroup(exercise) {
  if (!exercise) return 'Other';
  const equipment = exercise.equipment.toLowerCase();
  if (equipment.includes('bodyweight') || equipment.includes('overhead bar') || equipment.startsWith('bar ·')) return 'Bodyweight';
  if (equipment.includes('dumbbell')) return 'Dumbbells';
  if (/barbell|ez |curl bar/.test(equipment)) return 'Barbell';
  if (equipment.includes('cable')) return 'Cable';
  if (equipment.includes('kettlebell')) return 'Kettlebell';
  if (/machine|treadmill|bike|trainer|rower/.test(equipment)) return 'Machine';
  return 'Other';
}

function previousExercises() {
  const previous = new Map();
  for (const session of [...readStorage().sessions].reverse()) {
    for (const exercise of session.exercises) {
      const key = exerciseKey(exercise.name);
      if (!previous.has(key)) previous.set(key, exercise);
    }
  }
  return previous;
}

function renderExerciseChoices() {
  exerciseChoices.replaceChildren();
  let previous;
  try {
    previous = previousExercises();
  } catch {
    previous = new Map();
  }
  const query = exerciseKey(nameInput.value);
  const areas = [...new Set(exerciseCatalog.map(exercise => exercise.area))];
  const groups = [
    ['Your exercises', [...previous.values()].map(exercise => exercise.name)],
    ...areas.map(area => [area, exerciseCatalog
      .filter(exercise => exercise.area === area && ![...previous.keys()]
        .some(name => exerciseDefinition(name)?.name === exercise.name))
      .map(exercise => exercise.name)])
  ];
  let resultCount = 0;
  for (const [title, names] of groups) {
    const matches = names.filter(name => {
      const exercise = exerciseDefinition(name);
      const search = [name, exercise?.name, exercise?.area, exercise?.equipment, ...(exercise?.aliases ?? [])].join(' ');
      return query.split(/\s+/).every(word => exerciseKey(search).includes(word))
        && (!exerciseArea.value || exercise?.area === exerciseArea.value)
        && (!exerciseEquipment.value || equipmentGroup(exercise) === exerciseEquipment.value);
    });
    if (!matches.length) continue;
    resultCount += matches.length;
    const group = document.createElement('div');
    const heading = document.createElement('h3');
    group.className = 'picker-group';
    heading.textContent = title;
    group.append(heading);
    for (const name of matches) {
      const choice = document.createElement('button');
      const illustration = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const drawing = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      const text = document.createElement('span');
      const title = document.createElement('span');
      const hint = document.createElement('small');
      choice.type = 'button';
      choice.className = 'exercise-choice';
      const knownExercise = exerciseDefinition(name);
      const picture = knownExercise?.image ?? 'custom';
      illustration.classList.add('exercise-thumbnail');
      illustration.setAttribute('viewBox', '0 0 80 80');
      illustration.setAttribute('aria-hidden', 'true');
      illustration.setAttribute('focusable', 'false');
      drawing.setAttribute('href', 'exercise-illustrations.svg#' + picture);
      illustration.append(drawing);
      text.className = 'exercise-choice-text';
      title.textContent = name;
      const metadata = document.createElement('span');
      metadata.className = 'exercise-metadata';
      metadata.textContent = knownExercise ? knownExercise.equipment : 'Custom exercise';
      hint.textContent = previous.has(exerciseKey(name)) ? 'Use last workout’s sets' : 'Start with a blank set';
      text.append(title, metadata, hint);
      choice.append(illustration, text);
      choice.onclick = () => {
        nameInput.value = name;
        addNamedExercise();
      };
      group.append(choice);
    }
    exerciseChoices.append(group);
  }
  document.querySelector('#exerciseCount').textContent = resultCount + (resultCount === 1 ? ' exercise' : ' exercises');
  if (!exerciseChoices.children.length) {
    const empty = document.createElement('p');
    empty.className = 'muted picker-help';
    empty.textContent = 'No matches. Tap Add to use your own exercise name.';
    exerciseChoices.append(empty);
  }
}

function saveDraft() {
  hasDraft = true;
  updateWorkoutControls();
  const draft = { day: day.value, name: nameInput.value, restDay: restDay.checked, exercises: getExercises() };
  if (editing) return writeStorage(data => ({ ...data, editDraft: { ...editing, draft } }));
  return writeStorage(data => ({ ...data, draft }));
}

function loadDraft(draft) {
  hasDraft = Boolean(draft);
  exercises.replaceChildren();
  nameInput.value = draft?.name ?? '';
  restDay.checked = draft?.restDay === true;
  refreshToday();
  if (draft) {
    day.value = draft.day;
    draft.exercises.forEach(exercise => addExercise(exercise));
  }
  document.querySelector('#sessionTitle').textContent = editing ? 'Editing workout' : 'Session';
  saveButton.textContent = editing ? 'Save changes' : 'Save workout';
  cancelEdit.hidden = !editing;
  updateWorkoutControls();
}

function editWorkout(session, index) {
  if (editing) {
    selectView('log');
    return;
  }
  const draft = {
    day: session.day,
    name: '',
    restDay: session.restDay === true,
    exercises: session.exercises.map(exercise => ({ ...exercise, saved: true }))
  };
  const target = { index, original: session };
  if (!writeStorage(data => ({ ...data, editDraft: { ...target, draft } }))) return;
  editing = target;
  loadDraft(draft);
  tell('');
  selectView('log');
  day.focus();
}

function deleteWorkout(session, index) {
  if (editing || !window.confirm('Delete the ' + session.day + (session.restDay ? ' rest day' : ' workout') + ' logged on ' + session.date + '?')) return;
  if (!writeStorage(data => {
    if (data.editDraft) {
      tell('Finish or cancel the workout edit before deleting a workout.', true);
      return null;
    }
    if (JSON.stringify(data.sessions[index]) !== JSON.stringify(session)) {
      tell('History changed. Open it again before deleting this workout.', true);
      return null;
    }
    return { ...data, sessions: data.sessions.filter((_, position) => position !== index) };
  })) return;
  showHistory();
  document.querySelector('#historyTab').focus();
  tell('Workout deleted.');
}

function numberSets(list) {
  Array.from(list.children).forEach((row, index) => {
    row.querySelector('.set-number').textContent = 'Set ' + (index + 1);
    row.querySelector('.remove').setAttribute('aria-label', 'Remove set ' + (index + 1));
    row.querySelector('.remove').disabled = list.children.length === 1;
    if (row.querySelector('.set-editor').hidden) collapseSet(row);
  });
}

function collapseSet(row) {
  const set = getSetValues(row);
  const name = row.closest('article').querySelector('h3').textContent;
  const filled = Number(set.seconds ?? set.reps) > 0;
  row.querySelector('.set-summary-title').textContent = row.querySelector('.set-number').textContent;
  row.querySelector('.set-summary-values').textContent = filled
    ? [setResult(set, name), setNotes(set)].filter(Boolean).join(' · ')
    : 'Not filled in';
  row.querySelector('.set-editor').hidden = true;
  row.querySelector('.set-summary').hidden = false;
}

function showSetEditor(row) {
  for (const other of row.parentElement.children) {
    if (other !== row) collapseSet(other);
  }
  row.querySelector('.set-summary').hidden = true;
  row.querySelector('.set-editor').hidden = false;
}

function validateSets(list) {
  for (const row of list.children) {
    const quantity = row.querySelector('.reps');
    if (row.dataset.timed === 'true' && !(Number(quantity.value) > 0)) {
      tell('Choose a duration for each timed set.', true);
      showSetEditor(row);
      row.querySelector('.duration-trigger').click();
      return false;
    }
    const invalid = Array.from(row.querySelectorAll('input')).find(input => !input.checkValidity());
    if (invalid) {
      showSetEditor(row);
      invalid.reportValidity();
      return false;
    }
  }
  return true;
}

function addSet(list, values = {}, focus = false) {
  const row = document.querySelector('#setTemplate').content.firstElementChild.cloneNode(true);
  const reps = row.querySelector('.reps');
  const weight = row.querySelector('.weight');
  const name = list.closest('article').querySelector('h3').textContent;
  const timed = isTimedExercise(name);
  row.dataset.timed = timed;
  reps.value = timed ? values.seconds ?? '' : values.reps ?? '';
  if (timed && values.reps != null) row.dataset.legacyReps = values.reps;
  row.querySelector('.quantity-label').textContent = timed ? isHold(name) ? 'Hold time' : 'Duration' : 'Reps';
  if (timed) {
    reps.type = 'hidden';
    reps.required = false;
  }
  displayWeight(weight, values.weight, appSettings.weightUnit());
  const bodyweight = isBodyweight(list.closest('article').querySelector('h3').textContent);
  // Keep extra weight visible in older records that explicitly logged it.
  weight.disabled = bodyweight && !(Number(values.weight) > 0);
  weight.required = !weight.disabled;
  weight.closest('label').hidden = weight.disabled;
  row.querySelector('.reps-left').value = values.repsLeft ?? '';
  row.querySelector('.reps-left').disabled = timed;
  row.querySelector('.reps-left-label').hidden = timed;
  const options = row.querySelector('.effort-options');
  effortLevels.forEach(([face, label], index) => {
    const rating = document.createElement('button');
    const icon = document.createElement('span');
    const name = document.createElement('span');
    const number = document.createElement('span');
    rating.type = 'button';
    rating.value = index + 1;
    rating.setAttribute('aria-label', label + ', ' + (index + 1) + ' of 5');
    rating.setAttribute('aria-pressed', Number(values.effort) === index + 1);
    icon.className = 'effort-face';
    icon.textContent = face;
    icon.setAttribute('aria-hidden', 'true');
    name.className = 'effort-label';
    name.textContent = label;
    number.className = 'effort-number';
    number.textContent = rating.value + '/5';
    rating.append(icon, name, number);
    rating.onclick = () => {
      const selected = options.querySelector('[aria-pressed=true]');
      selected?.setAttribute('aria-pressed', 'false');
      if (selected !== rating) rating.setAttribute('aria-pressed', 'true');
      saveDraft();
    };
    options.append(rating);
  });
  row.querySelector('.remove').onclick = () => {
    const index = Array.from(list.children).indexOf(row);
    row.remove();
    const next = list.children[Math.min(index, list.children.length - 1)];
    if (next) showSetEditor(next);
    numberSets(list);
    saveDraft();
  };
  row.querySelector('.set-summary').onclick = () => {
    if (list.querySelector('[data-hold-ends-at]')) {
      tell('Finish the running set timer before editing another set.', true);
      return;
    }
    showSetEditor(row);
    saveDraft();
    (row.querySelector('.duration-trigger') ?? reps).focus();
  };
  list.append(row);
  if (timed) setupSetTimer(row, values);
  numberSets(list);
  if (focus) {
    showSetEditor(row);
    (row.querySelector('.duration-trigger') ?? reps).focus();
  }
}

function setupSetTimer(row, values) {
  const panel = row.querySelector('.plank-timer');
  const input = row.querySelector('.reps');
  const start = row.querySelector('.plank-start');
  const clock = row.querySelector('.plank-clock');
  const status = row.querySelector('.plank-status');
  let interval = null;
  const durationControl = durationPicker.attach(input, { label: 'Set duration' });
  const holding = isHold(row.closest('article').querySelector('h3').textContent);
  const startLabel = holding ? 'Start hold' : 'Start timer';
  start.textContent = startLabel;
  status.textContent = holding ? 'Choose your hold time, then tap Start hold.'
    : 'Choose your duration, then tap Start timer.';
  panel.hidden = false;
  if (values.reps != null && values.seconds == null) {
    status.textContent = 'Previously logged as reps. Enter a hold time in seconds.';
  }

  function finish(message) {
    clearInterval(interval);
    interval = null;
    delete row.dataset.holdEndsAt;
    delete row.dataset.holdStartedAt;
    input.disabled = false;
    durationControl.refresh();
    start.textContent = startLabel;
    status.textContent = message;
    saveDraft();
  }

  function tick() {
    if (!row.isConnected) {
      clearInterval(interval);
      return;
    }
    const remaining = Math.max(0, Math.ceil((Number(row.dataset.holdEndsAt) - Date.now()) / 1000));
    clock.textContent = durationPicker.format(remaining) === 'Choose time' ? '0:00' : durationPicker.format(remaining);
    if (!remaining) finish('Timer complete. Your time is ready to save.');
  }

  function run() {
    input.disabled = true;
    durationControl.refresh();
    start.textContent = 'Stop early';
    status.textContent = holding ? 'Holding…' : 'Timing…';
    interval = setInterval(tick, 250);
    clock.textContent = durationPicker.format(Math.max(0, Math.ceil((Number(row.dataset.holdEndsAt) - Date.now()) / 1000)));
    updateWorkoutControls();
  }

  start.onclick = () => {
    if (row.dataset.holdEndsAt) {
      const elapsed = Math.min(Number(input.value), Math.floor((Date.now() - Number(row.dataset.holdStartedAt)) / 1000));
      input.value = Math.max(0, elapsed);
      clock.textContent = Number(input.value) ? durationPicker.format(input.value) : '0:00';
      finish('Stopped. Review your time, then save the exercise.');
      return;
    }
    if (!(Number(input.value) > 0)) {
      durationControl.button.click();
      return;
    }
    row.dataset.holdStartedAt = Date.now();
    row.dataset.holdEndsAt = Date.now() + Number(input.value) * 1000;
    run();
    saveDraft();
  };
  input.onchange = () => {
    clock.textContent = '';
    status.textContent = 'Time selected. Ready when you are.';
  };
  if (Number.isFinite(values.holdEndsAt) && Number.isFinite(values.holdStartedAt)) {
    row.dataset.holdEndsAt = values.holdEndsAt;
    row.dataset.holdStartedAt = values.holdStartedAt;
    run();
  }
}

function addExercise(exercise, focus = false) {
  const card = document.querySelector('#exerciseTemplate').content.firstElementChild.cloneNode(true);
  card.querySelector('h3').textContent = exercise.name;
  const list = card.querySelector('.sets');
  const editor = card.querySelector('.exercise-editor');
  const summary = card.querySelector('.exercise-summary');
  const edit = card.querySelector('.edit-exercise');
  const remove = card.querySelector('.remove-exercise');
  edit.setAttribute('aria-label', 'Edit ' + exercise.name);
  remove.setAttribute('aria-label', 'Remove ' + exercise.name);
  remove.onclick = () => {
    card.remove();
    saveDraft();
  };
  card.querySelector('.add-set').onclick = () => {
    if (validateSets(list)) {
      addSet(list, {}, true);
      saveDraft();
    }
  };

  function setSaved(saved) {
    editor.hidden = saved;
    edit.hidden = !saved;
    remove.hidden = saved;
    summary.hidden = !saved;
    summary.replaceChildren();
    if (saved) {
      updateExerciseSummary(card);
    }
  }

  edit.onclick = () => {
    if (addExerciseButton.disabled) {
      tell('Save the open exercise before editing another.', true);
      return;
    }
    tell('');
    setSaved(false);
    saveDraft();
    const open = list.querySelector('.set-editor:not([hidden])');
    (open.querySelector('.duration-trigger') ?? open.querySelector('.reps')).focus();
  };
  card.querySelector('.save-exercise').onclick = () => {
    if (!validateSets(list)) return;
    tell('');
    setSaved(true);
    if (saveDraft()) {
      edit.focus();
    } else {
      setSaved(false);
      updateWorkoutControls();
      card.querySelector('.save-exercise').focus();
    }
  };
  exercises.append(card);
  exercise.sets.forEach((set, index) => addSet(list, set, focus && index === 0));
  const openIndex = Number.isInteger(exercise.openSet) && exercise.openSet >= 0 && exercise.openSet < list.children.length
    ? exercise.openSet : 0;
  const running = list.querySelector('[data-hold-ends-at]');
  if (list.children.length) showSetEditor(running ?? list.children[openIndex]);
  setSaved(exercise.saved === true);
}

function addNamedExercise() {
  if (addExerciseButton.disabled || restDay.checked) return;
  const name = nameInput.value.trim();
  if (!name) {
    tell('Enter an exercise name first.', true);
    nameInput.focus();
    return;
  }
  let previous;
  try {
    const savedExercises = previousExercises();
    const definition = exerciseDefinition(name);
    previous = savedExercises.get(exerciseKey(name));
    if (!previous && definition) {
      previous = [...savedExercises.values()].find(exercise => exerciseDefinition(exercise.name)?.name === definition.name);
    }
  } catch {
    tell('Previous exercises could not be read. Reload to try again.', true);
    return;
  }
  tell(previous ? 'Previous sets filled in. Adjust them for today.' : '');
  nameInput.value = '';
  const sets = previous?.sets.length
    ? previous.sets.map(({ reps, weight, seconds }) => isTimedExercise(name) ? { seconds }
      : isBodyweight(name) ? { reps } : { reps, weight })
    : [{}];
  addExercise({ name: previous?.name ?? name, sets }, true);
  saveDraft();
}

function showHistory() {
  historyView.replaceChildren();
  let sessions;
  try {
    sessions = readStorage().sessions;
  } catch {
    tell('Workout history could not be read on this device.', true);
    return;
  }
  const records = personalRecords.analyze(sessions);
  historyCalendar.render(historyView, sessions, (entries, target) => renderHistoryEntries(entries, target, records));
}

function showHome() {
  const home = document.querySelector('#homeView');
  home.replaceChildren();
  try {
    const sessions = readStorage().sessions;
    home.append(renderRecordsReport(personalRecords.analyze(sessions), sessions));
  } catch {
    const message = document.createElement('p');
    message.textContent = 'Your progress couldn’t be loaded. Please try reopening Setlog.';
    home.append(message);
  }
}

function recordDescription(record) {
  return record.type === 'weight'
    ? record.name + ' · ' + formatWeight(record.weightKg) + ' (previous best: ' + formatWeight(record.previous) + ')'
    : 'New weekly total · ' + formatWeight(record.volumeKg) + ' lifted across all reps';
}

function renderRecordsReport(records, sessions) {
  const report = document.createElement('section');
  report.className = 'home-records';
  report.innerHTML = '<div class="home-hero"><div><h2 class="home-headline">Overview</h2><p class="home-message"></p></div><button class="home-log-button" type="button"></button></div>'
    + '<div class="home-stats"><div><strong class="home-workouts-count"></strong><span>Workouts logged</span></div>'
    + '<div><strong class="home-pr-count"></strong><span>Personal records</span></div></div>'
    + '<div class="home-milestone"><div><strong>Next milestone</strong><span class="home-milestone-label"></span></div>'
    + '<progress aria-label="Personal records toward your next milestone"></progress><p></p></div>'
    + '<div class="records-body"><h2>Personal records</h2></div>';
  report.querySelector('.home-message').textContent = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const log = report.querySelector('.home-log-button');
  log.textContent = hasDraft ? 'Resume workout' : 'Log workout';
  log.onclick = () => selectView('log', { restoreScroll: true });
  report.querySelector('.home-workouts-count').textContent = sessions.filter(session => !session.restDay).length;
  report.querySelector('.home-pr-count').textContent = records.milestoneCount;
  const next = [1, 5, 10, 25, 50, 100].find(value => value > records.milestoneCount)
    ?? (Math.floor(records.milestoneCount / 100) + 1) * 100;
  const remaining = next - records.milestoneCount;
  report.querySelector('.home-milestone-label').textContent = next === 1 ? 'Your first PR' : next + ' personal records';
  const progress = report.querySelector('progress');
  progress.max = next;
  progress.value = records.milestoneCount;
  report.querySelector('.home-milestone p').textContent = records.exerciseBests.length
    ? remaining + (remaining === 1 ? ' record until the next milestone.' : ' records until the next milestone.')
    : 'Log a weighted workout to establish your first marks.';
  const overview = exerciseProgress.overview(sessions, formatWeight, openExerciseProgress);
  report.insertBefore(overview, report.querySelector('.home-stats'));
  const body = report.querySelector('.records-body');
  const help = document.createElement('p');
  help.className = 'muted records-help';
  help.textContent = 'Your first lift sets the starting mark. Beat it to earn a PR.';
  body.append(help);
  if (records.weeklyBest) {
    const week = document.createElement('div');
    const label = document.createElement('strong');
    const value = document.createElement('p');
    const note = document.createElement('small');
    week.className = 'record-week';
    label.textContent = 'Total weight lifted in a week';
    value.textContent = formatWeight(records.weeklyBest.volumeKg);
    const [year, month, day] = records.weeklyBest.week.split('-').map(Number);
    note.textContent = 'Week of ' + new Date(year, month - 1, day, 12).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    week.append(label, value, note);
    const explanation = document.createElement('p');
    explanation.className = 'record-week-explanation';
    const unit = appSettings.weightUnit();
    explanation.textContent = 'Your highest weekly total, adding up every rep. For example, 10 reps × 20 ' + unit + ' = 200 ' + unit + '. A week runs Monday–Sunday.';
    week.append(explanation);
    body.append(week);
  }
  const list = document.createElement('ul');
  list.className = 'record-lifts';
  if (records.exerciseBests.length) {
    const title = document.createElement('h3');
    title.className = 'record-lifts-title';
    title.textContent = 'Heaviest lifts';
    body.append(title);
  }
  for (const best of records.exerciseBests) {
    const row = document.createElement('li');
    const name = document.createElement('span');
    const date = document.createElement('small');
    const value = document.createElement('strong');
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', 'View ' + best.name + ' progress');
    button.onclick = () => openExerciseProgress(best.name);
    name.textContent = best.name;
    date.textContent = best.date;
    name.append(date);
    value.textContent = formatWeight(best.weightKg);
    button.append(name, value);
    row.append(button);
    list.append(row);
  }
  body.append(list);
  const note = document.createElement('p');
  note.className = 'muted records-help';
  note.textContent = records.exerciseBests.length
    ? 'Best lifts are tracked per exercise. Weekly totals exclude timed, unweighted and assisted sets.'
    : 'Log a weighted workout to set your starting marks. Timed, unweighted and assisted sets don’t count toward lifting records.';
  body.append(note);
  return report;
}

function openExerciseProgress(name) {
  exerciseProgress.open({ name, readSessions: () => readStorage().sessions, formatWeight });
}

function renderHistoryEntries(entries, target, records) {
  [...entries].reverse().forEach(({ session, index }) => {
    const card = document.createElement('article');
    const details = document.createElement('details');
    const header = document.createElement('summary');
    const heading = document.createElement('span');
    const content = document.createElement('div');
    const actions = document.createElement('div');
    const edit = document.createElement('button');
    const remove = document.createElement('button');
    card.className = 'history-card';
    details.open = true;
    heading.className = 'history-title';
    const exerciseCount = session.exercises.length;
    const setCount = session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
    heading.textContent = session.restDay ? session.date + ' · Rest day' : session.date + ' · ' + exerciseCount + (exerciseCount === 1 ? ' exercise' : ' exercises')
      + ' · ' + setCount + (setCount === 1 ? ' set' : ' sets');
    header.append(heading);
    content.className = 'history-content';
    const milestones = records.bySession.get(index) ?? [];
    if (milestones.length) {
      const list = document.createElement('ul');
      list.className = 'record-badges';
      for (const record of milestones) {
        const badge = document.createElement('li');
        badge.textContent = 'PR · ' + recordDescription(record);
        list.append(badge);
      }
      content.append(list);
    }
    if (session.restDay) {
      const message = document.createElement('p');
      message.className = 'muted';
      message.textContent = 'Rest and recovery.';
      content.append(message);
    }
    edit.type = 'button';
    edit.textContent = editing?.index === index ? 'Resume edit' : 'Edit';
    edit.disabled = Boolean(editing && editing.index !== index);
    edit.setAttribute('aria-label', edit.textContent + ' · ' + heading.textContent);
    edit.onclick = () => editWorkout(session, index);
    remove.type = 'button';
    remove.className = 'delete-workout';
    remove.textContent = 'Delete';
    remove.disabled = Boolean(editing);
    remove.setAttribute('aria-label', 'Delete · ' + heading.textContent);
    remove.onclick = () => deleteWorkout(session, index);
    actions.className = 'row history-actions';
    actions.append(edit, remove);
    session.exercises.forEach(exercise => {
      const group = document.createElement('div');
      const title = document.createElement('h3');
      const sets = document.createElement('ul');
      group.className = 'history-exercise';
      title.textContent = exercise.name;
      sets.className = 'history-sets';
      exercise.sets.forEach((set, index) => {
        const row = document.createElement('li');
        const number = document.createElement('span');
        const result = document.createElement('span');
        number.className = 'muted';
        number.textContent = 'Set ' + (index + 1);
        result.textContent = setResult(set, exercise.name);
        const notes = setNotes(set);
        if (notes) {
          const note = document.createElement('small');
          note.className = 'set-notes';
          note.textContent = notes;
          result.append(note);
        }
        row.append(number, result);
        sets.append(row);
      });
      group.append(title, sets);
      content.append(group);
    });
    content.append(actions);
    details.append(header, content);
    card.append(details);
    target.append(card);
  });
}

function selectView(view, { restoreScroll = false } = {}) {
  if (activeView !== view) viewScroll[activeView] = window.scrollY;
  activeView = view;
  document.querySelector('#homeView').hidden = view !== 'home';
  document.querySelector('#log').hidden = view !== 'log';
  document.querySelector('#restView').hidden = view !== 'rest';
  document.querySelector('#settingsView').hidden = view !== 'settings';
  historyView.hidden = view !== 'history';
  document.querySelector('#backupPanel').hidden = view !== 'history';
  document.querySelector('#logTab').setAttribute('aria-pressed', view === 'log');
  document.querySelector('#restTab').setAttribute('aria-pressed', view === 'rest');
  document.querySelector('#historyTab').setAttribute('aria-pressed', view === 'history');
  document.querySelector('#settingsTab').setAttribute('aria-pressed', view === 'settings');
  document.querySelector('#homeTab').setAttribute('aria-pressed', view === 'home');
  if (view === 'home') showHome();
  if (view === 'history') showHistory();
  window.scrollTo({ top: restoreScroll ? viewScroll[view] : 0, behavior: 'auto' });
}

function workoutHighlight(session, previousSessions) {
  for (const exercise of session.exercises) {
    const name = exercise.name.trim().toLowerCase();
    const previous = previousSessions.findLast(workout =>
      workout.exercises.some(entry => entry.name.trim().toLowerCase() === name)
    );
    if (!previous) continue;
    const previousSets = previous.exercises
      .filter(entry => entry.name.trim().toLowerCase() === name)
      .flatMap(entry => entry.sets);
    for (const set of exercise.sets) {
      if (set.seconds != null) {
        const holds = previousSets.filter(entry => entry.seconds != null);
        const extra = Number(set.seconds) - Math.max(...holds.map(entry => Number(entry.seconds)));
        if (holds.length && extra > 0) return exercise.name + ' · Held ' + extra + ' seconds longer than last time.';
        continue;
      }
      const comparable = previousSets.filter(entry => Math.abs(Number(entry.weight ?? 0) - Number(set.weight ?? 0)) < .005);
      if (!comparable.length) continue;
      const extra = Number(set.reps) - Math.max(...comparable.map(entry => Number(entry.reps)));
      if (extra > 0) {
        return exercise.name + ' · ' + extra + (extra === 1 ? ' more rep' : ' more reps')
          + (set.weight != null ? ' at ' + formatWeight(set.weight) : '') + ' than last time.';
      }
    }
  }
  return '';
}

function celebrateWorkout(highlight, records = []) {
  const card = document.createElement('section');
  const heading = document.createElement('h2');
  const message = document.createElement('p');
  card.className = 'workout-celebration';
  heading.tabIndex = -1;
  heading.textContent = records.length ? (records.length === 1 ? 'New personal record!' : 'New personal records!') : 'Workout saved!';
  message.textContent = records.length ? 'You improved on your previous best.' : highlight || 'Your session has been added to History.';
  card.append(heading, message);
  if (records.length) {
    const list = document.createElement('ul');
    list.className = 'celebration-records';
    for (const record of records) {
      const item = document.createElement('li');
      item.textContent = recordDescription(record);
      list.append(item);
    }
    card.append(list);
  }
  historyView.prepend(card);
  heading.focus();
  if (!appSettings.confetti() || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#d4fa7d', '#ffe091', '#ffb4a8', '#a9d7ff'];
  for (let index = 0; index < 24; index++) {
    const piece = document.createElement('span');
    piece.className = 'confetti';
    piece.setAttribute('aria-hidden', 'true');
    piece.style.backgroundColor = colors[index % colors.length];
    piece.style.setProperty('--x', (Math.random() - 0.5) * 440 + 'px');
    piece.style.setProperty('--y', (Math.random() - 0.5) * 190 + 'px');
    piece.style.setProperty('--spin', (Math.random() - 0.5) * 760 + 'deg');
    card.append(piece);
    piece.addEventListener('animationend', () => piece.remove(), { once: true });
  }
}

function refreshToday() {
  const now = new Date();
  document.querySelector('#today').textContent = editing?.original.date
    ?? now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (!hasDraft) day.value = now.toLocaleDateString('en-GB', { weekday: 'long' });
}

addExerciseButton.onclick = addNamedExercise;
for (const area of new Set(exerciseCatalog.map(exercise => exercise.area))) {
  exerciseArea.add(new Option(area, area));
}
exerciseArea.onchange = renderExerciseChoices;
exerciseEquipment.onchange = renderExerciseChoices;
exercisePicker.ontoggle = () => {
  if (exercisePicker.open) renderExerciseChoices();
};
nameInput.addEventListener('input', renderExerciseChoices);
document.querySelector('#weightUnitText').textContent = appSettings.weightUnit();
window.addEventListener('weightunitchange', () => {
  for (const input of exercises.querySelectorAll('.weight')) {
    displayWeight(input, readWeight(input), appSettings.weightUnit());
  }
  for (const card of exercises.children) {
    for (const row of card.querySelectorAll('.set')) {
      if (row.querySelector('.set-editor').hidden) collapseSet(row);
    }
    if (!card.querySelector('.exercise-summary').hidden) updateExerciseSummary(card);
  }
  document.querySelector('#weightUnitText').textContent = appSettings.weightUnit();
  if (hasDraft) saveDraft();
  if (activeView === 'history') showHistory();
  if (activeView === 'home') showHome();
});

document.querySelector('#homeTab').onclick = () => {
  selectView('home', { restoreScroll: true });
};
document.querySelector('#logTab').onclick = () => {
  selectView('log', { restoreScroll: true });
};
document.querySelector('#restTab').onclick = () => {
  selectView('rest', { restoreScroll: true });
};
document.querySelector('#historyTab').onclick = () => {
  selectView('history', { restoreScroll: true });
};
document.querySelector('#settingsTab').onclick = () => {
  selectView('settings', { restoreScroll: true });
};
day.onchange = saveDraft;
restDay.onchange = saveDraft;
workout.oninput = saveDraft;
cancelEdit.onclick = () => {
  let regularDraft;
  if (!writeStorage(data => {
    regularDraft = data.draft;
    return { ...data, editDraft: null };
  })) return;
  editing = null;
  loadDraft(regularDraft);
  tell('Workout edit canceled.');
  selectView('history');
};
nameInput.onkeydown = event => {
  if (event.key === 'Enter' && !event.isComposing) {
    event.preventDefault();
    addNamedExercise();
  }
};

workout.onsubmit = event => {
  event.preventDefault();
  if (saveButton.disabled) return;
  if (!restDay.checked && nameInput.value.trim()) {
    addNamedExercise();
    return;
  }
  const entries = restDay.checked ? [] : getExercises();
  if (!restDay.checked && !entries.length) return;
  const session = {
    day: day.value,
    date: editing?.original.date ?? new Date().toLocaleDateString('en-GB'),
    restDay: restDay.checked,
    exercises: entries.map(({ name, sets }) => ({ name, sets }))
  };
  let regularDraft = null;
  let previousSessions;
  const isEdit = Boolean(editing);
  if (!writeStorage(data => {
    if (!editing) {
      previousSessions = data.sessions;
      return { ...data, sessions: [...data.sessions, session], draft: null };
    }
    if (JSON.stringify(data.sessions[editing.index]) !== JSON.stringify(editing.original)) {
      tell('This workout changed in another tab. Cancel this edit and reopen it from History.', true);
      return null;
    }
    regularDraft = data.draft;
    const sessions = [...data.sessions];
    sessions[editing.index] = session;
    return { ...data, sessions, editDraft: null };
  })) return;
  editing = null;
  loadDraft(regularDraft);
  tell(isEdit ? 'Entry updated.' : session.restDay ? 'Rest day saved.' : '');
  historyCalendar.select(session.date);
  selectView('history');
  if (!isEdit && !session.restDay) {
    const records = personalRecords.analyze([...previousSessions, session]).bySession.get(previousSessions.length) ?? [];
    celebrateWorkout(workoutHighlight(session, previousSessions), records);
  }
};

refreshToday();
try {
  const { draft, editDraft } = readStorage();
  if (editDraft) {
    editing = { index: editDraft.index, original: editDraft.original };
  }
  loadDraft(editDraft?.draft ?? draft);
} catch {
  storageReadable = false;
  tell('Stored workouts are unavailable. Reload to try again.', true);
}
selectView(editing ? 'log' : 'home');

window.addEventListener('storage', event => {
  if (event.key === storageKey && activeView === 'home') showHome();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshToday();
});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(registration => {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) registration.update().catch(() => {});
    });
  }).catch(() => {});
}
