const day = document.querySelector('#day');
const workout = document.querySelector('#workout');
const nameInput = document.querySelector('#name');
const addExerciseButton = document.querySelector('#addExercise');
const exerciseHint = document.querySelector('#exerciseHint');
const exercisePicker = document.querySelector('#exercisePicker');
const exerciseChoices = document.querySelector('#exerciseChoices');
const exercises = document.querySelector('#exercises');
const historyView = document.querySelector('#history');
const saveButton = document.querySelector('#save');
const cancelEdit = document.querySelector('#cancelEdit');
const storageKey = 'setlog-v1';
const effortLevels = [
  ['😄', 'Very easy'], ['🙂', 'Easy'], ['😐', 'Moderate'], ['😣', 'Hard'], ['😫', 'Max effort']
];
const commonExercises = [
  'Chest Press', 'Bench Press', 'Incline Dumbbell Press', 'Chest Fly',
  'Push-up', 'Lat Pulldown', 'Seated Cable Row', 'Dumbbell Row',
  'Shoulder Press', 'Lateral Raise', 'Bicep Curl', 'Hammer Curl',
  'Tricep Pushdown', 'Squat', 'Leg Press', 'Leg Extension',
  'Leg Curl', 'Romanian Deadlift', 'Hip Thrust', 'Calf Raise', 'Crunch'
];
let storageReadable = true;
let hasDraft = false;
let editing = null;

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

function getSets(list) {
  return Array.from(list.children, row => {
    const set = { reps: row.querySelector('.reps').value, weight: row.querySelector('.weight').value };
    const effort = row.querySelector('.effort-options [aria-pressed=true]');
    const repsLeft = row.querySelector('.reps-left').value;
    if (effort) set.effort = Number(effort.value);
    if (repsLeft !== '') set.repsLeft = Number(repsLeft);
    return set;
  });
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
    saved: card.querySelector('.exercise-editor').hidden
  }));
}

function updateWorkoutControls() {
  const hasOpenExercise = Boolean(exercises.querySelector('.exercise-editor:not([hidden])'));
  nameInput.disabled = hasOpenExercise;
  addExerciseButton.disabled = hasOpenExercise;
  exerciseHint.hidden = !hasOpenExercise;
  exercisePicker.hidden = hasOpenExercise;
  if (hasOpenExercise) exercisePicker.open = false;
  saveButton.disabled = hasOpenExercise || !exercises.children.length;
}

function exerciseKey(name) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
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
  const groups = [
    ['Your exercises', [...previous.values()].map(exercise => exercise.name)],
    ['More exercises', commonExercises.filter(name => !previous.has(exerciseKey(name)))]
  ];
  for (const [title, names] of groups) {
    const matches = names.filter(name => exerciseKey(name).includes(query));
    if (!matches.length) continue;
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
      const knownExercise = commonExercises.find(exercise => exerciseKey(exercise) === exerciseKey(name));
      const picture = knownExercise ? exerciseKey(knownExercise).replace(/[^a-z0-9]+/g, '-') : 'custom';
      illustration.classList.add('exercise-thumbnail');
      illustration.setAttribute('viewBox', '0 0 80 80');
      illustration.setAttribute('aria-hidden', 'true');
      illustration.setAttribute('focusable', 'false');
      drawing.setAttribute('href', 'exercise-illustrations.svg#' + picture);
      illustration.append(drawing);
      text.className = 'exercise-choice-text';
      title.textContent = name;
      hint.textContent = previous.has(exerciseKey(name)) ? 'Use last workout’s sets' : 'Start with a blank set';
      text.append(title, hint);
      choice.append(illustration, text);
      choice.onclick = () => {
        nameInput.value = name;
        addNamedExercise();
      };
      group.append(choice);
    }
    exerciseChoices.append(group);
  }
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
  const draft = { day: day.value, name: nameInput.value, exercises: getExercises() };
  if (editing) return writeStorage(data => ({ ...data, editDraft: { ...editing, draft } }));
  return writeStorage(data => ({ ...data, draft }));
}

function loadDraft(draft) {
  hasDraft = Boolean(draft);
  exercises.replaceChildren();
  nameInput.value = draft?.name ?? '';
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
    selectView(true);
    return;
  }
  const draft = {
    day: session.day,
    name: '',
    exercises: session.exercises.map(exercise => ({ ...exercise, saved: true }))
  };
  const target = { index, original: session };
  if (!writeStorage(data => ({ ...data, editDraft: { ...target, draft } }))) return;
  editing = target;
  loadDraft(draft);
  tell('');
  selectView(true);
  day.focus();
}

function deleteWorkout(session, index) {
  if (editing || !window.confirm('Delete the ' + session.day + ' workout logged on ' + session.date + '?')) return;
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
    row.querySelector('small').textContent = 'Set ' + (index + 1);
    row.querySelector('button').setAttribute('aria-label', 'Remove set ' + (index + 1));
    row.querySelector('button').disabled = list.children.length === 1;
  });
}

function addSet(list, values = {}, focus = false) {
  const row = document.querySelector('#setTemplate').content.firstElementChild.cloneNode(true);
  const reps = row.querySelector('.reps');
  const weight = row.querySelector('.weight');
  reps.value = values.reps ?? '';
  weight.value = values.weight ?? '';
  row.querySelector('.reps-left').value = values.repsLeft ?? '';
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
  row.querySelector('button').onclick = () => {
    row.remove();
    numberSets(list);
    saveDraft();
  };
  list.append(row);
  numberSets(list);
  if (focus) reps.focus();
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
    if (Array.from(list.querySelectorAll('input')).every(input => input.reportValidity())) {
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
      getSets(list).forEach((set, index) => {
        const item = document.createElement('li');
        item.textContent = 'Set ' + (index + 1) + ' · ' + set.reps + ' reps × ' + set.weight + ' kg';
        const notes = setNotes(set);
        if (notes) item.append(' · ' + notes);
        summary.append(item);
      });
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
    list.querySelector('.reps').focus();
  };
  card.querySelector('.save-exercise').onclick = () => {
    if (!Array.from(list.querySelectorAll('input')).every(input => input.reportValidity())) return;
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
  setSaved(exercise.saved === true);
}

function addNamedExercise() {
  if (addExerciseButton.disabled) return;
  const name = nameInput.value.trim();
  if (!name) {
    tell('Enter an exercise name first.', true);
    nameInput.focus();
    return;
  }
  let previous;
  try {
    previous = previousExercises().get(exerciseKey(name));
  } catch {
    tell('Previous exercises could not be read. Reload to try again.', true);
    return;
  }
  tell(previous ? 'Previous sets filled in. Adjust them for today.' : '');
  nameInput.value = '';
  const sets = previous?.sets.length
    ? previous.sets.map(({ reps, weight }) => ({ reps, weight }))
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
  if (!sessions.length) {
    const empty = document.createElement('section');
    empty.textContent = 'Your saved workouts will appear here.';
    historyView.append(empty);
    return;
  }
  sessions.map((session, index) => ({ session, index })).reverse().forEach(({ session, index }) => {
    const card = document.createElement('article');
    const details = document.createElement('details');
    const header = document.createElement('summary');
    const label = document.createElement('span');
    const heading = document.createElement('span');
    const metadata = document.createElement('small');
    const content = document.createElement('div');
    const actions = document.createElement('div');
    const edit = document.createElement('button');
    const remove = document.createElement('button');
    card.className = 'history-card';
    details.open = index === sessions.length - 1;
    heading.className = 'history-title';
    heading.textContent = session.day + ' workout';
    const exerciseCount = session.exercises.length;
    const setCount = session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
    metadata.textContent = session.date + ' · ' + exerciseCount + (exerciseCount === 1 ? ' exercise' : ' exercises')
      + ' · ' + setCount + (setCount === 1 ? ' set' : ' sets');
    label.append(heading, metadata);
    header.append(label);
    content.className = 'history-content';
    edit.type = 'button';
    edit.textContent = editing?.index === index ? 'Resume edit' : 'Edit';
    edit.disabled = Boolean(editing && editing.index !== index);
    edit.setAttribute('aria-label', edit.textContent + ' · ' + heading.textContent + ' · ' + session.date);
    edit.onclick = () => editWorkout(session, index);
    remove.type = 'button';
    remove.className = 'delete-workout';
    remove.textContent = 'Delete';
    remove.disabled = Boolean(editing);
    remove.setAttribute('aria-label', 'Delete · ' + heading.textContent + ' · ' + session.date);
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
        result.textContent = set.reps + ' reps × ' + set.weight + ' kg';
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
    historyView.append(card);
  });
}

function selectView(showLog) {
  document.querySelector('#log').hidden = !showLog;
  historyView.hidden = showLog;
  document.querySelector('#logTab').setAttribute('aria-pressed', showLog);
  document.querySelector('#historyTab').setAttribute('aria-pressed', !showLog);
  if (!showLog) showHistory();
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
      const comparable = previousSets.filter(entry => Number(entry.weight) === Number(set.weight));
      if (!comparable.length) continue;
      const extra = Number(set.reps) - Math.max(...comparable.map(entry => Number(entry.reps)));
      if (extra > 0) {
        return exercise.name + ' · ' + extra + (extra === 1 ? ' more rep' : ' more reps')
          + ' at ' + set.weight + ' kg than last time.';
      }
    }
  }
  return '';
}

function celebrateWorkout(highlight) {
  const card = document.createElement('section');
  const heading = document.createElement('h2');
  const message = document.createElement('p');
  card.className = 'workout-celebration';
  heading.tabIndex = -1;
  heading.textContent = 'Workout saved!';
  message.textContent = highlight || 'Nice work showing up today.';
  card.append(heading, message);
  historyView.prepend(card);
  heading.focus();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
exercisePicker.ontoggle = () => {
  if (exercisePicker.open) renderExerciseChoices();
};
nameInput.addEventListener('input', renderExerciseChoices);
document.querySelector('#logTab').onclick = () => selectView(true);
document.querySelector('#historyTab').onclick = () => selectView(false);
day.onchange = saveDraft;
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
  selectView(false);
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
  if (nameInput.value.trim()) {
    addNamedExercise();
    return;
  }
  const entries = getExercises();
  if (!entries.length) return;
  const session = {
    day: day.value,
    date: editing?.original.date ?? new Date().toLocaleDateString('en-GB'),
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
  tell(isEdit ? 'Workout updated.' : '');
  selectView(false);
  if (!isEdit) celebrateWorkout(workoutHighlight(session, previousSessions));
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
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refreshToday();
});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
