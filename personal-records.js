// Rebuild records from history so edits, imports and deletions stay accurate.
const personalRecords = (() => {
  const normalize = name => String(name).trim().toLowerCase();
  const positive = value => Number.isFinite(Number(value)) && Number(value) > 0;
  const better = (value, previous) => value - previous > 1e-8 * Math.max(1, value, previous);

  function parseDate(value) {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
    if (!match) return null;
    const [, day, month, year] = match.map(Number);
    const date = new Date(year, month - 1, day, 12);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }

  function weekOf(date) {
    const monday = new Date(date);
    monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
    return [monday.getFullYear(), String(monday.getMonth() + 1).padStart(2, '0'), String(monday.getDate()).padStart(2, '0')].join('-');
  }

  function analyze(sessions) {
    const bySession = new Map();
    const exerciseBests = new Map();
    const weeks = new Map();
    let previousWeek = null;
    let previousWeeksBest = 0;
    let milestoneCount = 0;
    const ordered = sessions.map((session, index) => ({ session, index, date: parseDate(session.date) }))
      .filter(entry => entry.date && !entry.session.restDay)
      .sort((a, b) => a.date - b.date || a.index - b.index);

    for (const { session, index, date } of ordered) {
      const records = [];
      const week = weekOf(date);
      if (week !== previousWeek) {
        if (previousWeek) previousWeeksBest = Math.max(previousWeeksBest, weeks.get(previousWeek) ?? 0);
        previousWeek = week;
      }
      const before = weeks.get(week) ?? 0;
      let volume = 0;
      const workoutBests = new Map();
      for (const exercise of session.exercises) {
        const key = normalize(exercise.name);
        // A heavier assistance setting makes the exercise easier, not a lifting PR.
        if (/assisted|assistance/.test(key)) continue;
        for (const set of exercise.sets) {
          if (set.seconds != null || !positive(set.reps) || !positive(set.weight)) continue;
          const weightKg = Number(set.weight);
          volume += Number(set.reps) * weightKg;
          if (!workoutBests.has(key) || weightKg > workoutBests.get(key).weightKg) {
            workoutBests.set(key, { name: exercise.name, weightKg, date: session.date });
          }
        }
      }
      for (const [key, best] of workoutBests) {
        const previous = exerciseBests.get(key);
        if (previous && better(best.weightKg, previous.weightKg)) {
          records.push({ type: 'weight', ...best, previous: previous.weightKg });
        }
        if (!previous || better(best.weightKg, previous.weightKg)) exerciseBests.set(key, best);
      }
      const weeklyVolume = before + volume;
      weeks.set(week, weeklyVolume);
      if (previousWeeksBest > 0 && better(weeklyVolume, Math.max(previousWeeksBest, before))) {
        records.push({ type: 'volume', volumeKg: weeklyVolume, previous: Math.max(previousWeeksBest, before), week });
      }
      if (records.length) bySession.set(index, records);
      milestoneCount += records.length;
    }
    const weeklyBest = [...weeks].filter(([, volumeKg]) => volumeKg > 0)
      .map(([week, volumeKg]) => ({ week, volumeKg }))
      .sort((a, b) => b.volumeKg - a.volumeKg || a.week.localeCompare(b.week))[0] ?? null;
    return { bySession, exerciseBests: [...exerciseBests.values()].sort((a, b) => a.name.localeCompare(b.name)), weeklyBest, milestoneCount };
  }

  return { analyze };
})();
