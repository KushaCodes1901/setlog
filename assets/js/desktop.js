const desktopLayout = (() => {
  const wide = matchMedia('(min-width: 1100px)');
  const calendar = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="4"/><path d="M7 3v4m10-4v4M3 11h18m-12 5h.01m4 0h.01"/></svg>';
  let timerPreview = null;

  function syncTimer() {
    if (!timerPreview) return;
    timerPreview.querySelector('.desktop-rest-time').textContent = document.querySelector('#restDialTime').textContent;
    timerPreview.querySelector('.desktop-rest-label').textContent = document.querySelector('#restDialLabel').textContent;
    timerPreview.querySelector('.desktop-rest-progress').style.strokeDashoffset = document.querySelector('#restProgress').style.strokeDashoffset;
    const action = document.querySelector('#restStart').textContent;
    timerPreview.querySelector('.desktop-rest-start').textContent = action === 'Start' ? 'Start rest' : action === 'Pause' ? 'Pause rest' : 'Resume rest';
  }

  function enhance(report, sessions) {
    if (!wide.matches) return;
    timerPreview = document.createElement('section');
    timerPreview.className = 'desktop-only desktop-rest-card';
    timerPreview.setAttribute('aria-label', 'Rest timer');
    timerPreview.innerHTML = '<div class="desktop-card-heading"><h3>Rest Timer</h3><button type="button" class="desktop-rest-adjust">Adjust</button></div>'
      + '<div class="desktop-rest-dial"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="desktop-rest-track" cx="60" cy="60" r="51"/><circle class="desktop-rest-progress" cx="60" cy="60" r="51" pathLength="100"/></svg><div><span class="desktop-rest-time" role="timer" aria-live="off"></span><span class="desktop-rest-label"></span></div></div>'
      + '<button type="button" class="primary desktop-rest-start">Start rest</button>';
    timerPreview.querySelector('.desktop-rest-start').onclick = () => document.querySelector('#restStart').click();
    timerPreview.querySelector('.desktop-rest-adjust').onclick = () => document.querySelector('#restTab').click();
    report.append(timerPreview);
    syncTimer();

    const learn = document.createElement('section');
    learn.className = 'desktop-only desktop-learn-card';
    learn.innerHTML = '<h3>Learn a movement</h3><div class="desktop-learn-content"><img src="assets/media/learning/bicep-curl-thumbnail.webp" alt="Bicep curl illustration" width="96" height="96" loading="lazy"><div><strong>Bicep Curl</strong><p></p><button type="button">Explore guides</button></div></div>';
    learn.querySelector('p').textContent = learningGuides.length + ' illustrated guides';
    learn.querySelector('button').onclick = () => document.querySelector('#openLearning').click();
    report.append(learn);

    const recent = document.createElement('section');
    recent.className = 'desktop-only desktop-recent';
    recent.innerHTML = '<div class="desktop-card-heading"><h3>Recent workouts</h3><button type="button" class="desktop-view-history">View all</button></div>';
    recent.querySelector('button').onclick = () => document.querySelector('#historyTab').click();
    const serial = value => { const [day, month, year] = value.split('/').map(Number); return Date.UTC(year, month - 1, day); };
    const entries = sessions.map((session, index) => ({ session, index }))
      .filter(({ session }) => !session.restDay)
      .sort((a, b) => serial(b.session.date) - serial(a.session.date) || b.index - a.index).slice(0, 3);
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'desktop-recent-empty';
      empty.textContent = 'Your saved sessions will appear here. Start with one good workout.';
      recent.append(empty);
    }
    for (const { session } of entries) {
      const row = document.createElement('button');
      row.type = 'button'; row.className = 'desktop-recent-row';
      row.innerHTML = '<span class="desktop-recent-icon">' + calendar + '</span><span><strong></strong><small></small></span><span class="desktop-recent-arrow" aria-hidden="true">›</span>';
      row.querySelector('strong').textContent = historyCalendar.formatDate(session.date);
      const sets = session.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
      row.querySelector('small').textContent = session.exercises.length + (session.exercises.length === 1 ? ' exercise' : ' exercises') + ' · ' + sets + (sets === 1 ? ' set' : ' sets');
      row.onclick = () => { historyCalendar.select(session.date); document.querySelector('#historyTab').click(); };
      recent.append(row);
    }
    report.append(recent);
  }

  function syncProfile() {
    document.querySelector('#desktopProfileName').textContent = document.querySelector('#profileName').textContent;
    document.querySelector('#desktopProfileLevel').textContent = document.querySelector('#profileLevelTitle').textContent;
    const source = document.querySelector('#headerProfilePhoto');
    const photo = document.querySelector('#desktopProfilePhoto');
    const initial = document.querySelector('#desktopProfileInitial');
    photo.hidden = source.hidden;
    initial.hidden = !source.hidden;
    initial.textContent = document.querySelector('#profileInitial').textContent;
    if (!source.hidden) photo.src = source.src; else photo.removeAttribute('src');
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('#desktopBrand').onclick = () => document.querySelector('#homeTab').click();
    document.querySelector('#desktopProfile').onclick = () => document.querySelector('#profileTab').click();
    document.querySelector('#desktopSettings').onclick = () => document.querySelector('#profileSettings').click();
    const profileObserver = new MutationObserver(syncProfile);
    for (const id of ['profileName', 'profileLevelTitle', 'profileInitial', 'headerProfilePhoto']) {
      profileObserver.observe(document.getElementById(id), { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'hidden'] });
    }
    const timerObserver = new MutationObserver(syncTimer);
    for (const id of ['restDialTime', 'restDialLabel', 'restProgress', 'restStart']) {
      timerObserver.observe(document.getElementById(id), { childList: true, attributes: true, attributeFilter: ['style'] });
    }
    syncProfile(); syncTimer();
    if (wide.matches) appProfile.show();
    wide.addEventListener('change', () => {
      if (wide.matches) appProfile.show();
      if (document.body.dataset.view === 'home') showHome();
    });
  });
  return { enhance };
})();
