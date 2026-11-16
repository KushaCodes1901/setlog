const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const backup = fs.readFileSync(path.join(__dirname, '../backup.js'), 'utf8');
const exercise = { name: 'Chest Press', sets: [{ reps: 10, weight: 20 }] };
const base = { day: 'Monday', date: '16/11/2026', restDay: false, exercises: [exercise] };

function save({ value = '', rest = false, original = null, valid = true } = {}) {
  const data = { sessions: original ? [original] : [], draft: null };
  const context = { workout: {}, saveButton: { disabled: false }, nameInput: { value: '' },
    restDay: { checked: rest }, caloriesInput: { value, reportValidity: () => valid },
    getExercises: () => [exercise], day: { value: 'Monday' }, editing: original ? { index: 0, original } : null,
    writeStorage(fn) { const next = fn(data); if (!next) return false; Object.assign(data, next); return true; },
    loadDraft() {}, tell() {}, historyCalendar: { select() {} }, selectView() {},
    personalRecords: { analyze: () => ({ bySession: new Map() }) }, celebrateWorkout() {}, workoutHighlight() {} };
  vm.createContext(context);
  const start = app.indexOf('workout.onsubmit =');
  vm.runInContext(app.slice(start, app.indexOf('\nrefreshToday();', start)), context);
  context.workout.onsubmit({ preventDefault() {} });
  return data.sessions;
}

test('Workout saves only explicitly entered calories, including zero', () => {
  assert.equal(Object.hasOwn(save()[0], 'calories'), false);
  assert.equal(save({ value: '250' })[0].calories, 250);
  assert.equal(save({ value: '0' })[0].calories, 0);
  assert.equal(save({ value: '-1', valid: false }).length, 0);
  assert.equal(save({ value: '2.5', valid: false }).length, 0);
});

test('History edits change or remove calories; rest days never save hidden input', () => {
  const original = { ...base, calories: 250 };
  assert.equal(save({ value: '310', original })[0].calories, 310);
  assert.equal(Object.hasOwn(save({ original })[0], 'calories'), false);
  assert.equal(Object.hasOwn(save({ value: '250', rest: true })[0], 'calories'), false);
});

test('Unfinished workouts persist manual calorie input in their draft', () => {
  let result;
  const context = { hasDraft: false, updateWorkoutControls() {}, day: { value: 'Monday' },
    nameInput: { value: '' }, restDay: { checked: false }, caloriesInput: { value: '275' },
    getExercises: () => [exercise], editing: null, writeStorage(fn) { result = fn({ sessions: [] }); } };
  vm.createContext(context);
  vm.runInContext(app.slice(app.indexOf('function saveDraft()'), app.indexOf('function loadDraft(')), context);
  context.saveDraft();
  assert.equal(result.draft.calories, '275');
});

test('Backup round trips preserve calories, accept older workouts and reject invalid values', () => {
  const context = { days: ['Monday'] };
  vm.createContext(context);
  vm.runInContext(backup.slice(backup.indexOf('  function numberValue('), backup.indexOf('  function mergeSessions(')), context);
  const roundTrip = calories => context.readBackup(JSON.stringify({ app: 'Setlog', version: 1, sessions: [{ ...base, calories }] }))[0];
  assert.equal(Object.hasOwn(roundTrip(undefined), 'calories'), false);
  assert.equal(roundTrip(0).calories, 0);
  assert.equal(roundTrip(250).calories, 250);
  for (const value of [-1, 1.5, '', 'not a number']) assert.throws(() => roundTrip(value));
});
