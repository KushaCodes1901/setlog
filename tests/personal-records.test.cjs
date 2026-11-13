const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../personal-records.js'), 'utf8'), context);
const analyze = sessions => {
  context.sessions = sessions;
  return vm.runInContext('personalRecords.analyze(sessions)', context);
};
const workout = (date, name, weight, reps = 10) => ({ date, exercises: [{ name, sets: [{ reps, weight }] }] });

test('first lifts establish baselines; only a higher load on the same exercise earns a PR', () => {
  const result = analyze([
    workout('02/11/2026', 'Chest Press', 20),
    workout('03/11/2026', 'Leg Press', 100),
    workout('04/11/2026', ' chest press ', 20),
    workout('05/11/2026', 'Chest Press', 22.5, 3)
  ]);
  assert.equal(result.bySession.size, 1);
  assert.equal(result.bySession.get(3)[0].previous, 20);
  assert.equal(result.bySession.get(3)[0].weightKg, 22.5);
});

test('multiple sets and duplicate exercise entries produce one best lift per workout', () => {
  const first = workout('02/11/2026', 'Squat', 40);
  const second = workout('03/11/2026', 'Squat', 50);
  second.exercises[0].sets.push({ weight: 60, reps: 5 }, { weight: 55, reps: 4 });
  second.exercises.push({ name: 'Squat', sets: [{ weight: 65, reps: 2 }] });
  const result = analyze([first, second]);
  assert.equal(result.bySession.get(1).length, 1);
  assert.equal(result.bySession.get(1)[0].weightKg, 65);
});

test('weekly volume uses Monday–Sunday and adds every session within a week', () => {
  const result = analyze([
    workout('08/11/2026', 'Squat', 10), // Sunday: 100 kg volume, starting week.
    workout('09/11/2026', 'Squat', 10, 6), // Monday: 60.
    workout('10/11/2026', 'Squat', 10, 5), // Tuesday: 110 beats last week.
    workout('10/11/2026', 'Squat', 10, 1) // Another session: 120.
  ]);
  assert.equal(result.bySession.has(0), false);
  assert.equal(result.bySession.has(1), false);
  assert.equal(result.bySession.get(2)[0].type, 'volume');
  assert.equal(result.bySession.get(2)[0].volumeKg, 110);
  assert.equal(result.bySession.get(3)[0].volumeKg, 120);
  assert.equal(result.weeklyBest.week, '2026-11-09');
  assert.equal(result.weeklyBest.volumeKg, 120);
});

test('ties and conversion roundoff do not earn records', () => {
  const result = analyze([
    workout('02/11/2026', 'Squat', 45.359237),
    workout('03/11/2026', 'Squat', 45.35923700000001)
  ]);
  assert.equal(result.milestoneCount, 0);
});

test('timed, unweighted, assisted, invalid and rest-day entries are excluded', () => {
  const result = analyze([
    { date: '02/11/2026', restDay: true, exercises: [] },
    workout('03/11/2026', 'Assisted Pull-up', 50),
    workout('04/11/2026', 'Push-up', 0),
    workout('05/11/2026', 'Squat', -1),
    workout('06/11/2026', 'Squat', 50, 0),
    { date: '07/11/2026', exercises: [{ name: 'Treadmill', sets: [{ seconds: 60, weight: 50, reps: 10 }] }] },
    workout('31/02/2026', 'Squat', 100)
  ]);
  assert.equal(result.milestoneCount, 0);
  assert.equal(result.exerciseBests.length, 0);
  assert.equal(result.weeklyBest, null);
});

test('backdated imports, edits and deletions are recalculated chronologically', () => {
  const later = workout('12/11/2026', 'Squat', 60);
  const earlier = workout('02/11/2026', 'Squat', 40);
  let result = analyze([later, earlier]);
  assert.equal(result.bySession.get(0)[0].previous, 40);
  earlier.exercises[0].sets[0].weight = 70;
  result = analyze([later, earlier]);
  assert.equal(result.bySession.has(0), false);
  result = analyze([later]);
  assert.equal(result.milestoneCount, 0);
  assert.equal(result.exerciseBests[0].weightKg, 60);
});

test('weeks crossing New Year retain the correct Monday', () => {
  const result = analyze([workout('31/12/2026', 'Squat', 20), workout('01/01/2027', 'Squat', 20)]);
  assert.equal(result.weeklyBest.week, '2026-12-28');
  assert.equal(result.weeklyBest.volumeKg, 400);
  assert.equal(result.milestoneCount, 0);
});
