const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../exercise-progress.js'), 'utf8'), context);
const analyze = (sessions, name = 'Chest Press') => {
  context.sessions = sessions;
  context.name = name;
  return vm.runInContext('exerciseProgress.analyze(sessions, name)', context);
};
const insight = data => {
  context.data = data;
  return vm.runInContext('exerciseProgress.insight(data)', context);
};
const workout = (date, sets, name = 'Chest Press') => ({ date, exercises: [{ name, sets }] });

test('chronological sessions include every matching set, including duplicate exercise entries', () => {
  const older = workout('02/11/2026', [{ reps: 8, weight: 20 }], ' chest press ');
  older.exercises.push({ name: 'Chest Press', sets: [{ reps: 10, weight: 20 }, { reps: 4, weight: 25 }] });
  const data = analyze([workout('10/11/2026', [{ reps: 5, weight: 30 }]), older]);
  assert.equal(data.entries.length, 2);
  assert.equal(data.entries[0].date, '02/11/2026');
  assert.equal(data.entries[0].sets.length, 3);
  assert.equal(data.entries[0].topSet.weight, 25);
  assert.equal(data.entries[0].topSet.reps, 4);
  assert.equal(data.entries[0].reps, 10);
});

test('rep encouragement compares the same load with the previous session’s best matching set', () => {
  const data = analyze([
    workout('02/11/2026', [{ reps: 8, weight: 20 }, { reps: 9, weight: 20 }]),
    workout('10/11/2026', [{ reps: 11, weight: 20 }])
  ]);
  assert.equal(insight(data).kind, 'reps');
  assert.equal(insight(data).amount, 2);
});

test('more reps at a lower weight do not claim a rep improvement at the same load', () => {
  const data = analyze([
    workout('02/11/2026', [{ reps: 8, weight: 30 }]),
    workout('10/11/2026', [{ reps: 12, weight: 20 }])
  ]);
  assert.equal(insight(data).kind, 'steady');
});

test('a heavier top set retains its reps so the comparison can show both', () => {
  const data = analyze([
    workout('02/11/2026', [{ reps: 10, weight: 20 }]),
    workout('10/11/2026', [{ reps: 5, weight: 25 }])
  ]);
  const result = insight(data);
  assert.equal(result.kind, 'weight');
  assert.equal(result.latest.reps, 5);
  assert.equal(result.previous.reps, 10);
});

test('bodyweight exercises work without inventing a lifting weight', () => {
  const data = analyze([
    workout('02/11/2026', [{ reps: 8 }], 'Push-up'),
    workout('10/11/2026', [{ reps: 10 }], 'Push-up')
  ], 'Push-up');
  assert.equal(data.metrics.join(','), 'reps');
  assert.equal(insight(data).kind, 'reps');
  assert.equal(insight(data).weight, 0);
});

test('timed exercises track duration without making speed claims', () => {
  const data = analyze([
    workout('02/11/2026', [{ seconds: 30 }], 'Plank'),
    workout('10/11/2026', [{ seconds: 45 }, { seconds: 40 }], 'Plank')
  ], 'Plank');
  assert.equal(data.metrics.join(','), 'seconds');
  assert.equal(insight(data).kind, 'time');
  assert.equal(insight(data).amount, 15);
});

test('assisted exercise progress favours less assistance, including zero', () => {
  const sessions = [
    workout('02/11/2026', [{ reps: 8, weight: 40 }], 'Assisted Pull-up'),
    workout('10/11/2026', [{ reps: 8, weight: 30 }], 'Assisted Pull-up')
  ];
  assert.equal(insight(analyze(sessions, 'Assisted Pull-up')).kind, 'assistance');
  sessions[1].exercises[0].sets[0].weight = 50;
  assert.equal(insight(analyze(sessions, 'Assisted Pull-up')).kind, 'steady');
  sessions[1].exercises[0].sets[0].weight = 0;
  assert.equal(insight(analyze(sessions, 'Assisted Pull-up')).kind, 'assistance');
});

test('empty, single-session, invalid-date and rest-day histories remain honest', () => {
  assert.equal(analyze([]).entries.length, 0);
  const sessions = [
    workout('31/02/2026', [{ reps: 8, weight: 20 }]),
    { ...workout('02/11/2026', [{ reps: 8, weight: 20 }]), restDay: true },
    workout('03/11/2026', [{ seconds: 0, reps: 10 }]),
    workout('10/11/2026', [{ reps: 8, weight: 20 }])
  ];
  const data = analyze(sessions);
  assert.equal(data.entries.length, 1);
  assert.equal(insight(data).kind, 'start');
});

test('edited and deleted sessions are reflected without modifying stored input', () => {
  const sessions = [workout('02/11/2026', [{ reps: 8, weight: 20 }]), workout('10/11/2026', [{ reps: 10, weight: 20 }])];
  const original = JSON.stringify(sessions);
  assert.equal(insight(analyze(sessions)).kind, 'reps');
  assert.equal(JSON.stringify(sessions), original);
  sessions[1].exercises[0].sets[0].reps = 7;
  assert.equal(insight(analyze(sessions)).kind, 'steady');
  sessions.pop();
  assert.equal(insight(analyze(sessions)).kind, 'start');
});
