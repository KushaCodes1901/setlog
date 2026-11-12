(() => {
  const exportButton = document.querySelector('#exportBackup');
  const importButton = document.querySelector('#importBackup');
  const fileInput = document.querySelector('#backupFile');
  const status = document.querySelector('#backupStatus');
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  function numberValue(value, minimum, integer = false) {
    if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') {
      throw new Error('A workout value is missing.');
    }
    const number = Number(value);
    if (!Number.isFinite(number) || number < minimum || (integer && !Number.isInteger(number))) {
      throw new Error('A workout value is invalid.');
    }
    return number;
  }

  function normalizeSet(set) {
    if (!set || typeof set !== 'object' || (set.seconds == null) === (set.reps == null)) {
      throw new Error('A set needs reps or a time.');
    }
    const result = set.seconds != null
      ? { seconds: numberValue(set.seconds, 1, true) }
      : { reps: numberValue(set.reps, 1, true) };
    if (set.weight != null) result.weight = numberValue(set.weight, 0);
    if (set.effort != null) {
      result.effort = numberValue(set.effort, 1, true);
      if (result.effort > 5) throw new Error('An effort rating is invalid.');
    }
    if (set.repsLeft != null) result.repsLeft = numberValue(set.repsLeft, 0, true);
    return result;
  }

  function normalizeSession(session) {
    if (!session || !days.includes(session.day) || typeof session.date !== 'string'
      || !/^\d{2}\/\d{2}\/\d{4}$/.test(session.date) || !Array.isArray(session.exercises)
      || (session.restDay != null && typeof session.restDay !== 'boolean')) {
      throw new Error('A workout entry is invalid.');
    }
    const [day, month, year] = session.date.split('/').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new Error('A workout date is invalid.');
    }
    const restDay = session.restDay === true;
    if (restDay ? session.exercises.length !== 0 : session.exercises.length === 0) {
      throw new Error('An entry has unexpected exercises.');
    }
    const exercises = session.exercises.map(exercise => {
      if (!exercise || typeof exercise.name !== 'string' || !exercise.name.trim()
        || exercise.name.length > 100 || !Array.isArray(exercise.sets) || !exercise.sets.length) {
        throw new Error('An exercise entry is invalid.');
      }
      return { name: exercise.name, sets: exercise.sets.map(normalizeSet) };
    });
    return { day: session.day, date: session.date, restDay, exercises };
  }

  function readBackup(text) {
    const backup = JSON.parse(text);
    if (!backup || backup.app !== 'Setlog' || backup.version !== 1 || !Array.isArray(backup.sessions)) {
      throw new Error('Choose a Setlog backup file exported by this app.');
    }
    return backup.sessions.map(normalizeSession);
  }

  function mergeSessions(existing, incoming) {
    const counts = new Map();
    for (const session of existing) {
      const key = JSON.stringify(normalizeSession(session));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const occurrences = new Map();
    const added = [];
    for (const session of incoming) {
      const key = JSON.stringify(session);
      const count = (occurrences.get(key) ?? 0) + 1;
      occurrences.set(key, count);
      if (count > (counts.get(key) ?? 0)) added.push(session);
    }
    return { sessions: [...existing, ...added], added: added.length };
  }

  exportButton.onclick = async () => {
    exportButton.disabled = true;
    try {
      const sessions = readStorage().sessions.map(normalizeSession);
      const backup = { app: 'Setlog', version: 1, exportedAt: new Date().toISOString(), sessions };
      const now = new Date();
      const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
      const file = new File([JSON.stringify(backup, null, 2)], 'setlog-backup-' + date + '.json', { type: 'application/json' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Setlog workout backup' });
        status.textContent = 'Backup shared. Make sure you saved it in Files before reinstalling Setlog.';
      } else {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        status.textContent = 'Backup download started. Check that the file is saved before reinstalling Setlog.';
      }
    } catch (error) {
      status.textContent = error.name === 'AbortError' ? 'Export canceled.' : 'Could not export your workouts. ' + error.message;
    } finally {
      exportButton.disabled = false;
    }
  };

  importButton.onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    if (!file) return;
    importButton.disabled = true;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('This file is too large for a Setlog backup.');
      const incoming = readBackup(await file.text());
      const preview = mergeSessions(readStorage().sessions, incoming);
      if (!preview.added) {
        status.textContent = 'All entries in this backup are already in your History.';
        return;
      }
      if (!window.confirm('Import ' + preview.added + ' saved entries into History? Your current workouts and draft will be kept.')) {
        status.textContent = 'Import canceled.';
        return;
      }
      let added = 0;
      if (!writeStorage(data => {
        const merged = mergeSessions(data.sessions, incoming);
        added = merged.added;
        return { ...data, sessions: merged.sessions };
      })) {
        status.textContent = 'The backup could not be saved on this device. Your existing data is still available.';
        return;
      }
      selectView('history');
      status.textContent = 'Imported ' + added + (added === 1 ? ' entry.' : ' entries.') + ' Your History is ready.';
    } catch (error) {
      status.textContent = 'Could not import this backup. ' + error.message;
    } finally {
      importButton.disabled = false;
      fileInput.value = '';
    }
  };
})();
