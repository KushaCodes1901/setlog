const homeDashboard = (() => {
  function weekly(sessions) {
    const today = new Date();
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
    monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
    const end = new Date(monday); end.setDate(end.getDate() + 7);
    const days = Array.from({ length: 7 }, () => ({ workouts: 0 }));
    let workouts = 0, sets = 0, calories = 0, calorieEntries = 0;
    for (const session of sessions) {
      const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(session.date);
      if (!match || session.restDay) continue;
      const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12);
      if (date < monday || date >= end) continue;
      const count = session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
      const day = (date.getDay() + 6) % 7;
      days[day].workouts++;
      workouts++; sets += count;
      if (Number.isInteger(session.calories) && session.calories >= 0) { calories += session.calories; calorieEntries++; }
    }
    return { days, workouts, sets, calories, calorieEntries, currentDay: (today.getDay() + 6) % 7 };
  }

  function render(sessions, onHistory) {
    const data = weekly(sessions);
    const card = document.createElement('div');
    card.className = 'weekly-summary';
    card.innerHTML = '<div class="weekly-heading"><h3>This week</h3><span>MON — SUN</span></div>'
      + '<div class="weekly-main"><div class="weekly-number"><strong></strong><span></span></div><div class="weekly-bars" role="img"></div></div>'
      + '<div class="weekly-details"><span class="weekly-sets"></span><span class="weekly-calories"></span></div>'
      + '<button type="button" class="weekly-history" aria-label="View this week in History">View activity <span aria-hidden="true">›</span></button>';
    card.querySelector('.weekly-number strong').textContent = data.workouts;
    card.querySelector('.weekly-number span').textContent = data.workouts === 1 ? 'workout logged' : 'workouts logged';
    card.querySelector('.weekly-sets').textContent = data.sets + (data.sets === 1 ? ' set completed' : ' sets completed');
    card.querySelector('.weekly-calories').textContent = data.calorieEntries ? data.calories.toLocaleString() + ' kcal · entered' : 'No calories entered';
    const chart = card.querySelector('.weekly-bars');
    chart.setAttribute('aria-label', 'Workouts logged this week. ' + ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, i) => day + ': ' + data.days[i].workouts).join('. '));
    const maximum = Math.max(1, ...data.days.map(day => day.workouts));
    data.days.forEach((day, index) => {
      const column = document.createElement('div');
      column.className = 'weekly-day' + (index === data.currentDay ? ' is-today' : '');
      column.setAttribute('aria-hidden', 'true');
      const track = document.createElement('div');
      track.className = 'weekly-bar-track';
      const fill = document.createElement('i');
      fill.style.height = day.workouts ? Math.max(14, day.workouts / maximum * 100) + '%' : '4px';
      fill.className = day.workouts ? 'has-workouts' : '';
      track.append(fill);
      const label = document.createElement('span'); label.textContent = ['M', 'T', 'W', 'T', 'F', 'S', 'S'][index];
      column.append(track, label); chart.append(column);
    });
    card.querySelector('button').onclick = onHistory;
    return card;
  }
  return { render };
})();
