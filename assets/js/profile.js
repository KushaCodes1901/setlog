const appProfile = (() => {
  const $ = id => document.getElementById(id);
  const editor = $('profileEditor');
  const info = $('profileInfoDialog');
  const dayMs = 86400000;
  let identity = { name: '', bio: '', photo: null };
  let photoUrl = '', editorPhotoUrl = '';
  let pendingPhoto = null;
  let photoJob = 0, saving = false, toastTimer;
  let latest = null;

  function store(method, value) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('setlog-profile-v1', 1);
      let blocked = false;
      request.onupgradeneeded = () => request.result.createObjectStore('profile');
      request.onerror = () => reject(request.error);
      request.onblocked = () => { blocked = true; reject(new Error('Profile storage is busy.')); };
      request.onsuccess = () => {
        const database = request.result;
        if (blocked) { database.close(); return; }
        const transaction = database.transaction('profile', method === 'get' ? 'readonly' : 'readwrite');
        const objectStore = transaction.objectStore('profile');
        const operation = method === 'get' ? objectStore.get('identity') : objectStore.put(value, 'identity');
        transaction.oncomplete = () => { database.close(); resolve(operation.result); };
        transaction.onabort = () => { database.close(); reject(transaction.error); };
      };
    });
  }

  function toast(message) {
    clearTimeout(toastTimer);
    $('profileStatus').textContent = message;
    toastTimer = setTimeout(() => { $('profileStatus').textContent = ''; }, 3000);
  }

  function initials(name) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    return words.length ? [words[0], ...(words.length > 1 ? [words.at(-1)] : [])].map(word => Array.from(word)[0]).join('').toUpperCase() : 'S';
  }

  function paintIdentity() {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = identity.photo ? URL.createObjectURL(identity.photo) : '';
    for (const id of ['profilePhoto', 'headerProfilePhoto']) {
      const image = $(id);
      image.hidden = !photoUrl;
      if (photoUrl) image.src = photoUrl; else image.removeAttribute('src');
    }
    $('headerProfile').querySelector('svg').style.display = photoUrl ? 'none' : '';
    $('profileInitial').hidden = Boolean(photoUrl);
    $('profileInitial').textContent = initials(identity.name);
    $('profileName').textContent = identity.name || 'Your profile';
    $('profileBio').textContent = identity.bio || 'Your training story, one session at a time.';
  }

  async function loadIdentity() {
    try {
      const value = await store('get');
      identity = { name: typeof value?.name === 'string' ? value.name.slice(0, 60) : '',
        bio: typeof value?.bio === 'string' ? value.bio.slice(0, 120) : '',
        photo: value?.photo instanceof Blob && value.photo.type === 'image/jpeg' ? value.photo : null };
      paintIdentity();
      return true;
    } catch { toast('Your profile couldn’t be loaded. Try reopening Setlog.'); return false; }
  }
  const ready = loadIdentity();

  function dateSerial(value) {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
    if (!match) return null;
    const [, day, month, year] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.getTime() / dayMs : null;
  }
  const weekStart = day => day - (new Date(day * dayMs).getUTCDay() + 6) % 7;
  function summary(sessions) {
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / dayMs;
    const eligible = sessions.filter(session => !session.restDay && dateSerial(session.date) !== null && dateSerial(session.date) <= today
      && session.exercises.some(exercise => exercise.sets.some(set => Number(set.seconds ?? set.reps) > 0)));
    const trainingDays = new Set(eligible.map(session => dateSerial(session.date)));
    const restDays = new Set(sessions.filter(session => session.restDay && dateSerial(session.date) !== null && dateSerial(session.date) <= today).map(session => dateSerial(session.date)));
    const weeks = new Set([...trainingDays].map(weekStart));
    let bestWeeks = 0, run = 0, previous = null;
    for (const week of [...weeks].sort((a, b) => a - b)) {
      run = previous !== null && week - previous === 7 ? run + 1 : 1;
      bestWeeks = Math.max(bestWeeks, run); previous = week;
    }
    let week = weekStart(today);
    if (!weeks.has(week)) week -= 7;
    let streak = 0;
    while (weeks.has(week)) { streak++; week -= 7; }
    const records = personalRecords.analyze(eligible).milestoneCount;
    const score = trainingDays.size * 100 + records * 25;
    return { workouts: eligible.length, trainingDays, restDays, records, score, streak, bestWeeks, today, monday: weekStart(today), level: Math.floor(score / 500) + 1, progress: score % 500 };
  }

  const icons = {
    spark: '<path d="m12 2 2.6 6.8 7.4.6-5.7 4.8 1.8 7.2-6.1-4-6.1 4 1.8-7.2L2 9.4l7.4-.6Z"/>',
    strength: '<path d="M7 12h10M4 7v10M7 5v14M20 7v10M17 5v14"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6m10-6v6M3 11h18m-10 5h2"/>',
    trophy: '<path d="M7 3h10v7a5 5 0 0 1-10 0V3Zm0 2H3v4a4 4 0 0 0 5 4m9-8h4v4a4 4 0 0 1-5 4M12 15v5m-4 1h8"/>',
    medal: '<circle cx="12" cy="9" r="6"/><path d="m8 14-2 8 6-3 6 3-2-8m-7-5 2 2 4-4"/>',
    rhythm: '<path d="M3 12h4l3-8 4 16 3-8h4"/>'
  };
  const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true">' + icons[name] + '</svg>';
  function achievements(data) {
    return [
      { name: 'First session', detail: '1 training day', value: data.trainingDays.size, target: 1, icon: 'spark' },
      { name: 'Back for more', detail: '5 training days', value: data.trainingDays.size, target: 5, icon: 'strength' },
      { name: 'Double digits', detail: '10 training days', value: data.trainingDays.size, target: 10, icon: 'calendar' },
      { name: 'First PR', detail: '1 personal record', value: data.records, target: 1, icon: 'trophy' },
      { name: 'PR collector', detail: '10 personal records', value: data.records, target: 10, icon: 'medal' },
      { name: 'In a rhythm', detail: '4 active weeks in a row', value: data.bestWeeks, target: 4, icon: 'rhythm' }
    ];
  }

  function showInfo(title, paragraphs) {
    $('profileInfoTitle').textContent = title;
    $('profileInfoContent').replaceChildren(...paragraphs.map(text => {
      const p = document.createElement('p'); p.textContent = text; return p;
    }));
    info.showModal();
    document.documentElement.classList.add('profile-dialog-open');
  }
  info.addEventListener('close', () => { document.documentElement.classList.toggle('profile-dialog-open', editor.open); });
  $('closeProfileInfo').onclick = () => info.close();
  $('profileInfoDone').onclick = () => info.close();
  $('profileScoreInfo').onclick = () => {
    if (!latest) return;
    showInfo('Every bit of effort adds up.', [
      '100 XP for each day you log a workout. Extra workouts on the same day don’t multiply the daily points.',
      '25 XP for each personal record, using the same lifting and weekly-volume records shown on Home.',
      latest.trainingDays.size + ' training days × 100 + ' + latest.records + ' records × 25 = ' + latest.score.toLocaleString() + ' XP.',
      'Your week streak counts consecutive weeks with a workout. The current week stays open until Sunday.',
      'Every 500 XP unlocks another level. Rest days never deduct points. Editing, deleting or importing workouts recalculates your score from History.'
    ]);
  };

  function render(data) {
    latest = data;
    $('profileScore').textContent = data.score.toLocaleString() + ' XP';
    $('profileWorkoutCount').textContent = data.workouts;
    $('profilePRCount').textContent = data.records;
    $('profileWeekStreak').textContent = data.streak;
    $('profileLevelTitle').textContent = 'Level ' + data.level;
    $('profileLevelName').textContent = ['Getting started', 'Finding rhythm', 'Showing up', 'Building momentum', 'Going strong'][Math.min(data.level - 1, 4)];
    $('profileLevelProgress').value = data.progress;
    $('profileLevelPoints').textContent = data.progress + ' / 500 XP';
    $('profileLevelRemaining').textContent = (500 - data.progress) + ' XP to Level ' + (data.level + 1);
    $('profileAvatarProgress').style.strokeDashoffset = String(100 - data.progress / 5);
    const badges = achievements(data);
    const earned = badges.filter(badge => badge.value >= badge.target).length;
    $('profileBadgeCount').textContent = earned + ' / ' + badges.length + ' earned';
    const next = badges.find(badge => badge.value < badge.target);
    $('profileNextTitle').textContent = next ? next.name : 'Look at you go.';
    $('profileNextDescription').textContent = next ? 'Your next badge: ' + next.detail.toLowerCase() + '.' : 'Every badge earned. Keep building your story.';
    $('profileNextCount').textContent = next ? Math.min(next.value, next.target) + ' / ' + next.target + ' completed' : 'Your collection is complete';
    $('profileBadges').replaceChildren(...badges.map(badge => {
      const button = document.createElement('button');
      const unlocked = badge.value >= badge.target;
      button.type = 'button'; button.className = 'profile-badge' + (unlocked ? ' is-earned' : '');
      button.setAttribute('aria-label', badge.name + (unlocked ? ', earned. ' : ', not earned yet. ') + badge.detail);
      button.innerHTML = '<span class="profile-badge-icon">' + icon(badge.icon) + '</span><strong></strong><small></small><span class="profile-badge-state"></span>';
      button.querySelector('strong').textContent = badge.name;
      button.querySelector('small').textContent = badge.detail;
      button.querySelector('.profile-badge-state').textContent = unlocked ? '✓ Earned' : Math.min(badge.value, badge.target) + ' / ' + badge.target;
      button.onclick = () => showInfo(badge.name, [unlocked ? 'You earned this one. Nice work.' : 'This one is still ahead of you.', badge.detail + '.', 'Your progress: ' + Math.min(badge.value, badge.target) + ' / ' + badge.target + '. Rest days don’t take away progress.']);
      return button;
    }));
    const formatDate = (serial, options) => new Date(serial * dayMs).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });
    $('profileWeekRange').textContent = formatDate(data.monday, { day: 'numeric', month: 'short' }) + ' – ' + formatDate(data.monday + 6, { day: 'numeric', month: 'short' });
    $('profileWeek').replaceChildren(...Array.from({ length: 7 }, (_, index) => {
      const serial = data.monday + index;
      const trained = data.trainingDays.has(serial), rested = data.restDays.has(serial);
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'profile-week-day' + (serial === data.today ? ' is-today' : '') + (trained ? ' is-trained' : rested ? ' is-rested' : '');
      button.setAttribute('aria-label', formatDate(serial, { day: 'numeric', month: 'long' }) + (trained ? ', workout logged' : rested ? ', rest day' : ', no entry'));
      if (serial === data.today) button.setAttribute('aria-current', 'date');
      button.innerHTML = '<i aria-hidden="true"></i><span>' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index] + '</span><strong>' + new Date(serial * dayMs).getUTCDate() + '</strong>';
      button.onclick = () => { historyCalendar.select(formatDate(serial, { day: '2-digit', month: '2-digit', year: 'numeric' })); selectView('history'); };
      return button;
    }));
  }

  async function show() {
    try { render(summary(readStorage().sessions)); } catch { toast('Your training history couldn’t be loaded. Try reopening Setlog.'); }
    await loadIdentity();
  }

  function editorPhoto() {
    if (editorPhotoUrl) URL.revokeObjectURL(editorPhotoUrl);
    editorPhotoUrl = pendingPhoto ? URL.createObjectURL(pendingPhoto) : '';
    $('profileEditorPhoto').hidden = !editorPhotoUrl;
    if (editorPhotoUrl) $('profileEditorPhoto').src = editorPhotoUrl; else $('profileEditorPhoto').removeAttribute('src');
    $('profileEditorInitial').hidden = Boolean(editorPhotoUrl);
    $('profileEditorInitial').textContent = initials($('profileNameInput').value);
    $('removeProfilePhoto').hidden = !pendingPhoto;
  }
  function busy(value) {
    for (const id of ['chooseProfilePhoto', 'removeProfilePhoto', 'saveProfile', 'profileNameInput', 'profileBioInput']) $(id).disabled = value;
  }
  async function edit() {
    await ready;
    if (!await loadIdentity()) return;
    pendingPhoto = identity.photo;
    $('profileNameInput').value = identity.name;
    $('profileBioInput').value = identity.bio;
    $('profileEditorStatus').textContent = '';
    busy(false); editorPhoto(); editor.showModal();
    document.documentElement.classList.add('profile-dialog-open');
  }
  $('editProfile').onclick = edit;
  $('editProfilePhoto').onclick = edit;
  $('closeProfileEditor').onclick = () => { if (!saving) editor.close(); };
  editor.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
  editor.addEventListener('close', () => {
    photoJob++;
    if (editorPhotoUrl) URL.revokeObjectURL(editorPhotoUrl);
    editorPhotoUrl = '';
    document.documentElement.classList.toggle('profile-dialog-open', info.open);
  });
  $('chooseProfilePhoto').onclick = () => $('profilePhotoFile').click();
  $('removeProfilePhoto').onclick = () => { pendingPhoto = null; editorPhoto(); };
  $('profileNameInput').oninput = () => { if (!pendingPhoto) $('profileEditorInitial').textContent = initials($('profileNameInput').value); };

  async function preparePhoto(file) {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') throw new Error('Choose a photo, such as a JPG or PNG.');
    if (file.size > 12 * 1024 * 1024) throw new Error('That photo is a little large. Choose one under 12 MB.');
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 384;
      const context = canvas.getContext('2d');
      context.fillStyle = '#17201c'; context.fillRect(0, 0, 384, 384);
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 384, 384);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .84));
      if (!blob) throw new Error('This photo couldn’t be saved. Try a JPG or PNG.');
      return blob;
    } finally { URL.revokeObjectURL(url); }
  }
  $('profilePhotoFile').onchange = async () => {
    const file = $('profilePhotoFile').files[0]; $('profilePhotoFile').value = '';
    if (!file) return;
    const job = ++photoJob;
    busy(true); $('profileEditorStatus').textContent = 'Getting your photo ready…';
    try {
      const photo = await preparePhoto(file);
      if (job !== photoJob || !editor.open) return;
      pendingPhoto = photo; editorPhoto(); $('profileEditorStatus').textContent = 'Looking good. Tap Save Profile to keep it.';
    } catch (error) {
      if (job === photoJob) $('profileEditorStatus').textContent = error.message?.startsWith('Choose') || error.message?.includes('12 MB') ? error.message : 'This photo couldn’t be opened. Try a JPG or PNG.';
    } finally { if (job === photoJob) busy(false); }
  };
  $('profileForm').onsubmit = async event => {
    event.preventDefault(); if (saving || !$('profileForm').reportValidity()) return;
    const updated = { name: $('profileNameInput').value.trim(), bio: $('profileBioInput').value.trim(), photo: pendingPhoto };
    if (updated.name === identity.name && updated.bio === identity.bio && updated.photo === identity.photo) { editor.close(); toast('Your profile is already up to date.'); return; }
    saving = true; busy(true); $('profileEditorStatus').textContent = 'Saving your profile…';
    try {
      await store('put', updated);
      identity = updated; paintIdentity(); editor.close(); toast('Profile saved. Looking good!');
    } catch { $('profileEditorStatus').textContent = 'Your profile couldn’t be saved. Please try again.'; }
    finally { saving = false; busy(false); }
  };
  return { show };
})();
