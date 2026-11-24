const muscleBalance = (() => {
  const groups = {
    chest: 'Chest', back: 'Upper back & lats', shoulders: 'Shoulders', biceps: 'Biceps',
    triceps: 'Triceps', forearms: 'Forearms', core: 'Core', lowerBack: 'Lower back',
    glutes: 'Glutes & outer hips', quads: 'Quadriceps', hamstrings: 'Hamstrings',
    adductors: 'Inner thighs', calves: 'Calves'
  };
  const mapping = {};
  function assign(ids, primary, assisting = []) {
    ids.split(' ').forEach(id => { mapping[id] = { primary, assisting }; });
  }
  assign('chest-press bench-press dumbbell-bench-press incline-dumbbell-press incline-barbell-press decline-bench-press cable-chest-press push-up incline-push-up', ['chest'], ['shoulders', 'triceps']);
  assign('chest-fly pec-deck cable-crossover low-to-high-cable-fly mid-height-cable-fly single-arm-cable-fly', ['chest'], ['shoulders']);
  assign('lat-pulldown seated-cable-row dumbbell-row barbell-row t-bar-row chest-supported-row pull-up assisted-pull-up', ['back'], ['biceps', 'shoulders']);
  assign('chin-up', ['back', 'biceps'], ['forearms']);
  assign('straight-arm-pulldown', ['back']);
  assign('dumbbell-pullover', ['chest', 'back']);
  assign('dead-hang', ['forearms']);
  assign('back-extension', ['lowerBack'], ['glutes', 'hamstrings']);
  assign('deadlift sumo-deadlift', ['glutes', 'quads'], ['hamstrings', 'lowerBack', 'forearms', 'adductors']);
  assign('shoulder-press arnold-press', ['shoulders'], ['triceps']);
  assign('lateral-raise cable-lateral-raise front-raise', ['shoulders']);
  assign('reverse-fly face-pull', ['shoulders', 'back']);
  assign('upright-row', ['shoulders'], ['back', 'biceps']);
  assign('shrug', ['back']);
  assign('bicep-curl ez-bar-curl preacher-curl concentration-curl cable-curl', ['biceps'], ['forearms']);
  assign('hammer-curl reverse-curl', ['biceps', 'forearms']);
  assign('wrist-curl', ['forearms']);
  assign('tricep-pushdown overhead-tricep-extension skull-crusher bench-dip tricep-kickback', ['triceps']);
  assign('dip', ['chest', 'triceps'], ['shoulders']);
  assign('squat front-squat goblet-squat hack-squat smith-machine-squat leg-press lunge reverse-lunge bulgarian-split-squat step-up bodyweight-squat', ['quads', 'glutes'], ['adductors']);
  assign('leg-extension', ['quads']);
  assign('leg-curl seated-leg-curl standing-leg-curl', ['hamstrings'], ['calves']);
  assign('romanian-deadlift kettlebell-swing', ['hamstrings', 'glutes'], ['lowerBack', 'forearms']);
  assign('hip-thrust glute-bridge cable-kickback hip-abduction', ['glutes']);
  assign('hip-adduction', ['adductors']);
  assign('calf-raise seated-calf-raise standing-calf-machine', ['calves']);
  assign('plank side-plank crunch reverse-crunch sit-up bicycle-crunch hanging-knee-raise hanging-leg-raise cable-crunch russian-twist ab-wheel-rollout dead-bug mountain-climber', ['core']);
  assign('bird-dog', ['core', 'lowerBack'], ['glutes']);
  assign('burpee', ['quads', 'glutes'], ['core', 'shoulders', 'calves']);
  assign('thruster', ['quads', 'glutes', 'shoulders'], ['triceps', 'core']);
  assign('farmer-carry', ['forearms'], ['back', 'core']);
  assign('battle-ropes', ['shoulders'], ['forearms', 'core']);
  assign('sled-push', ['quads', 'glutes'], ['calves', 'core']);
  assign('jumping-jack', ['calves'], ['glutes', 'shoulders']);

  const normalize = name => String(name ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const catalog = new Map();
  exerciseCatalog.forEach(exercise => [exercise.name, ...(exercise.aliases ?? [])].forEach(name => catalog.set(normalize(name), exercise)));
  const dayNumber = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  function parseDay(value) {
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(value));
    if (!match) return null;
    const [, day, month, year] = match.map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? dayNumber(date) : null;
  }
  function analyze(sessions, days = 7, now = new Date()) {
    const end = dayNumber(now), start = end - days + 1;
    const totals = Object.fromEntries(Object.keys(groups).map(id => [id, { direct: 0, assisting: 0, score: 0, exercises: new Map() }]));
    let workouts = 0, sets = 0, cardio = 0;
    const unknown = new Set();
    for (const session of sessions) {
      const day = parseDay(session.date);
      if (session.restDay || day === null || day < start || day > end) continue;
      let counted = false;
      for (const exercise of session.exercises ?? []) {
        const definition = catalog.get(normalize(exercise.name));
        const valid = (exercise.sets ?? []).filter(set => {
          const quantity = Number(set.seconds ?? set.reps);
          return Number.isFinite(quantity) && quantity > 0 && (set.weight == null || (Number.isFinite(Number(set.weight)) && Number(set.weight) >= 0));
        }).length;
        if (!valid) continue;
        if (!definition) { unknown.add(String(exercise.name || 'Unnamed exercise')); continue; }
        if (definition.area === 'Cardio') { cardio += valid; continue; }
        const muscles = mapping[definition.image];
        if (!muscles) { unknown.add(definition.name); continue; }
        counted = true; sets += valid;
        for (const [kind, ids] of [['direct', muscles.primary], ['assisting', muscles.assisting]]) {
          for (const id of ids) {
            const total = totals[id];
            total[kind] += valid;
            const entry = total.exercises.get(definition.name) ?? { name: definition.name, direct: 0, assisting: 0, dates: new Set() };
            entry[kind] += valid; entry.dates.add(session.date);
            total.exercises.set(definition.name, entry);
          }
        }
      }
      if (counted) workouts++;
    }
    Object.values(totals).forEach(total => { total.score = total.direct + total.assisting * .5; });
    const max = Math.max(0, ...Object.values(totals).map(total => total.score));
    const covered = Object.values(totals).filter(total => total.score > 0).length;
    return { totals, max, covered, workouts, sets, cardio, unknown: [...unknown], days, start, end };
  }

  const shapes = {
    front: {
      shoulders: ['M65 87Q48 87 42 108L61 119 73 98Z', 'M135 87Q152 87 158 108L139 119 127 98Z'],
      chest: ['M74 97Q85 91 98 100L98 132Q81 137 66 118Z', 'M126 97Q115 91 102 100L102 132Q119 137 134 118Z'],
      biceps: ['M43 114L60 124 54 158 37 155Z', 'M157 114L140 124 146 158 163 155Z'],
      forearms: ['M37 162L53 164 43 205 29 201Z', 'M163 162L147 164 157 205 171 201Z'],
      core: ['M77 141L97 139 97 204 77 210 68 175Z', 'M123 141L103 139 103 204 123 210 132 175Z'],
      quads: ['M68 236L88 240 94 297 87 322 65 317 59 274Z', 'M132 236L112 240 106 297 113 322 135 317 141 274Z'],
      adductors: ['M91 238L98 244 97 293 92 279Z', 'M109 238L102 244 103 293 108 279Z'],
      calves: ['M65 336L86 339 84 377 76 412 65 408 60 366Z', 'M135 336L114 339 116 377 124 412 135 408 140 366Z']
    },
    back: {
      shoulders: ['M65 87Q48 87 42 108L61 119 73 98Z', 'M135 87Q152 87 158 108L139 119 127 98Z'],
      back: ['M78 83L98 94 98 159 76 181 65 121Z', 'M122 83L102 94 102 159 124 181 135 121Z'],
      triceps: ['M43 114L60 124 54 158 37 155Z', 'M157 114L140 124 146 158 163 155Z'],
      forearms: ['M37 162L53 164 43 205 29 201Z', 'M163 162L147 164 157 205 171 201Z'],
      lowerBack: ['M79 183L97 166 97 213 75 213Z', 'M121 183L103 166 103 213 125 213Z'],
      glutes: ['M73 220Q83 212 98 220L98 253Q78 264 63 248Z', 'M127 220Q117 212 102 220L102 253Q122 264 137 248Z'],
      hamstrings: ['M64 261Q77 267 95 260L93 301 86 323 65 318 60 285Z', 'M136 261Q123 267 105 260L107 301 114 323 135 318 140 285Z'],
      calves: ['M64 337Q77 330 87 340L87 374 76 413 65 408 60 365Z', 'M136 337Q123 330 113 340L113 374 124 413 135 408 140 365Z']
    }
  };
  const silhouette = 'M88 71L87 82 65 87Q48 87 41 110L35 153 27 197 24 215Q27 224 33 217L45 207 56 167 61 143 68 177 71 209 62 235 56 274 60 318 57 363 63 413 58 429Q59 437 81 434L88 416 91 365 95 327 100 280 105 327 109 365 112 416 119 434Q141 437 142 429L137 413 143 363 140 318 144 274 138 235 129 209 132 177 139 143 144 167 155 207 167 217Q173 224 176 215L173 197 165 153 159 110Q152 87 135 87L113 82 112 71Z';
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const number = value => Number.isInteger(value) ? String(value) : value.toFixed(1);
  function heat(total, max) { return !total.score ? 0 : total.score / max < .34 ? 1 : total.score / max < .67 ? 2 : 3; }
  function bodyMap(data, view, select, active, mini = false) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '10 12 180 430');
    svg.setAttribute('class', 'balance-body');
    if (mini) { svg.setAttribute('aria-hidden', 'true'); }
    else { svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', view === 'front' ? 'Front muscle map' : 'Back muscle map'); }
    const base = document.createElementNS(ns, 'path'); base.setAttribute('d', silhouette); base.setAttribute('class', 'balance-silhouette'); svg.append(base);
    const head = document.createElementNS(ns, 'ellipse'); head.setAttribute('cx', '100'); head.setAttribute('cy', '44'); head.setAttribute('rx', '23'); head.setAttribute('ry', '30'); head.setAttribute('class', 'balance-silhouette'); svg.append(head);
    Object.entries(shapes[view]).forEach(([id, paths]) => {
      const region = document.createElementNS(ns, 'g'); region.dataset.heat = heat(data.totals[id], data.max);
      region.setAttribute('class', 'balance-region');
      if (!mini) {
        region.setAttribute('role', 'button'); region.setAttribute('tabindex', '0'); region.setAttribute('aria-pressed', String(id === active));
        region.setAttribute('aria-label', groups[id] + ': ' + number(data.totals[id].score) + ' set credits');
        region.onclick = () => select(id);
        region.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(id); } };
      }
      paths.forEach(d => { const path = document.createElementNS(ns, 'path'); path.setAttribute('d', d); region.append(path); });
      svg.append(region);
    });
    return svg;
  }

  let dialog, readSessions, onGuide, selected = 'chest', range = 7, view = 'front', returnFocus;
  function insight(data) {
    if (!data.sets) return 'Your next logged workout starts the picture.';
    if (data.workouts < 2) return 'One workout is a snapshot. Keep logging to see your pattern.';
    const ranked = Object.entries(data.totals).sort((a, b) => b[1].score - a[1].score);
    const missing = ranked.filter(([, total]) => !total.score).length;
    return groups[ranked[0][0]] + ' received the most logged work.' + (missing ? ' ' + missing + ' muscle groups have no logged work in this window.' : ' Every muscle group has some logged work in this window.');
  }
  function overview(sessions, options) {
    const data = analyze(sessions);
    const card = node('div', undefined, 'balance-home');
    const heading = node('div', undefined, 'balance-home-heading');
    heading.append(node('h3', 'Muscle balance'), node('span', 'LAST 7 DAYS'));
    const main = node('div', undefined, 'balance-home-main');
    const art = node('div', undefined, 'balance-mini'); art.append(bodyMap(data, 'front', null, null, true), bodyMap(data, 'back', null, null, true));
    const copy = node('div');
    copy.append(node('strong', data.sets ? data.covered + ' of 13' : 'Build your picture'), node('p', data.sets ? 'muscle groups with logged work' : 'See which muscles your workouts cover.'), node('small', insight(data)));
    main.append(art, copy);
    const button = node('button', 'Explore muscle balance →', 'balance-open'); button.type = 'button';
    button.onclick = () => open(options);
    card.append(heading, main, button);
    return card;
  }
  function renderDetail(data) {
    const target = dialog.querySelector('.balance-detail'); target.replaceChildren();
    const total = data.totals[selected];
    target.append(node('p', 'YOUR SELECTED MUSCLE GROUP', 'balance-kicker'), node('h3', groups[selected]));
    const stats = node('div', undefined, 'balance-detail-stats');
    stats.append(node('strong', number(total.score) + ' set credits'), node('p', total.direct + ' main-muscle sets + ' + total.assisting + ' assisting sets × ½'));
    target.append(stats);
    if (!total.score) target.append(node('p', 'No work logged for this muscle group in these ' + range + ' days. This may simply reflect your current routine.', 'balance-muted'));
    else {
      const list = node('ul', undefined, 'balance-exercises');
      [...total.exercises.values()].sort((a, b) => b.direct + b.assisting * .5 - a.direct - a.assisting * .5).forEach(entry => {
        const item = node('li'); const text = node('div');
        text.append(node('strong', entry.name), node('small', [entry.direct ? entry.direct + ' main' : '', entry.assisting ? entry.assisting + ' assisting' : ''].filter(Boolean).join(' · ') + ' · ' + entry.dates.size + (entry.dates.size === 1 ? ' day' : ' days')));
        item.append(text, node('b', number(entry.direct + entry.assisting * .5))); list.append(item);
      });
      target.append(list);
    }
    const guide = exerciseCatalog.find(exercise => mapping[exercise.image]?.primary.includes(selected) && learningGuides.some(item => item.name === exercise.name));
    if (guide) {
      const button = node('button', 'Learn ' + guide.name, 'balance-guide'); button.type = 'button';
      button.onclick = () => { dialog.close(); onGuide(guide.name); }; target.append(button);
    }
  }
  function render() {
    const data = analyze(readSessions(), range);
    dialog.querySelectorAll('[data-range]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.range) === range)));
    dialog.querySelectorAll('[data-body-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.bodyView === view)));
    const start = new Date(data.start * 86400000), end = new Date(data.end * 86400000);
    const dateFormat = { day: 'numeric', month: 'short', timeZone: 'UTC' };
    dialog.querySelector('.balance-period').textContent = start.toLocaleDateString('en-GB', dateFormat) + ' – ' + end.toLocaleDateString('en-GB', { ...dateFormat, year: 'numeric' }) + ' · including today';
    dialog.querySelector('.balance-insight').textContent = insight(data);
    dialog.querySelector('.balance-count').textContent = data.sets ? data.sets + ' logged sets · ' + data.workouts + (data.workouts === 1 ? ' workout' : ' workouts') + ' · ' + data.covered + '/13 muscle groups' : 'No mapped strength or timed-hold sets in this window';
    const select = id => {
      selected = id;
      dialog.querySelectorAll('[data-muscle]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.muscle === id)));
      dialog.querySelectorAll('.balance-region').forEach(region => region.setAttribute('aria-pressed', String(region.dataset.id === id)));
      renderDetail(data);
      if (matchMedia('(max-width: 679px)').matches) {
        dialog.querySelector('.balance-detail').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    };
    const map = bodyMap(data, view, select, selected);
    map.querySelectorAll('.balance-region').forEach((region, index) => { region.dataset.id = Object.keys(shapes[view])[index]; });
    dialog.querySelector('.balance-map').replaceChildren(map);
    const list = dialog.querySelector('.balance-muscles'); list.replaceChildren();
    Object.entries(groups).forEach(([id, name]) => {
      const total = data.totals[id]; const button = node('button'); button.type = 'button'; button.dataset.muscle = id; button.setAttribute('aria-pressed', String(id === selected));
      button.append(node('span', name), node('b', number(total.score)));
      const track = node('span', undefined, 'balance-bar'); const fill = node('i'); fill.style.width = (data.max ? total.score / data.max * 100 : 0) + '%'; track.append(fill); track.setAttribute('aria-hidden', 'true'); button.append(track);
      button.onclick = () => select(id); list.append(button);
    });
    renderDetail(data);
    const exclusions = dialog.querySelector('.balance-excluded');
    exclusions.replaceChildren(node('p', 'Rest days are excluded. Cardio is kept separate: a minute on a treadmill is not treated as a strength set.'));
    if (data.cardio) exclusions.append(node('p', data.cardio + ' cardio entries kept separate in this window.'));
    if (data.unknown.length) exclusions.append(node('p', 'Not mapped: ' + data.unknown.join(', ') + '. These entries are still saved in History.'));
  }
  function open(options) {
    readSessions = options.readSessions; onGuide = options.onGuide; returnFocus = document.activeElement;
    range = 7; view = 'front'; selected = 'chest';
    if (!dialog) {
      dialog = node('dialog', undefined, 'balance-dialog'); dialog.id = 'muscleBalanceDialog'; dialog.setAttribute('aria-labelledby', 'balanceTitle');
      dialog.innerHTML = '<div class="balance-shell"><header class="balance-header"><div><p class="balance-kicker">YOUR TRAINING, MAPPED</p><h2 id="balanceTitle">Muscle balance</h2></div><button type="button" class="balance-close" aria-label="Close muscle balance">×</button></header><p class="balance-intro">See where your logged work goes. Make room for the bigger picture.</p><div class="balance-range" role="group" aria-label="Report period"><button type="button" data-range="7">Last 7 days</button><button type="button" data-range="30">Last 30 days</button></div><p class="balance-period"></p><p class="balance-count"></p><div class="balance-insight" role="status"></div><div class="balance-layout"><div class="balance-visual"><div class="balance-views" role="group" aria-label="Body view"><button type="button" data-body-view="front">Front</button><button type="button" data-body-view="back">Back</button></div><div class="balance-map"></div><div class="balance-legend"><span><i data-heat="0"></i>No logged work</span><span><i data-heat="1"></i>Less</span><span><i data-heat="3"></i>More</span></div><p class="balance-muted">Relative to your most-trained group. Tap a muscle or choose it below.</p></div><div class="balance-detail" aria-live="polite" aria-atomic="true"></div></div><div class="balance-list-heading"><h3>All muscle groups</h3><span>Set credits</span></div><div class="balance-muscles"></div><details class="balance-method"><summary>How this report works</summary><p>Each logged set gives 1 credit to each main muscle group and ½ credit to each assisting group. A set can contribute to several groups, so muscle totals can exceed your logged set count.</p><p>The ½ weighting is a simple Setlog estimate, not a measurement of muscle activation. Technique, effort and exercise variation can change the muscles involved. Timed holds count once per logged set; longer holds do not earn extra credit.</p><p>This shows training coverage, not soreness, recovery, strength differences or physical development. Equal totals are not a training target. Only saved sessions in the selected dates are included.</p><div class="balance-excluded"></div><p>Exercise references: <a href="https://www.nasm.org/resource-center/exercise-library" target="_blank" rel="noopener noreferrer">NASM exercise library</a>.</p></details></div>';
      document.body.append(dialog);
      dialog.querySelector('.balance-close').onclick = () => dialog.close();
      dialog.querySelectorAll('[data-range]').forEach(button => { button.onclick = () => { range = Number(button.dataset.range); render(); }; });
      dialog.querySelectorAll('[data-body-view]').forEach(button => { button.onclick = () => { view = button.dataset.bodyView; render(); }; });
      dialog.addEventListener('close', () => { document.documentElement.classList.remove('balance-open-page'); if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true }); });
      window.addEventListener('storage', event => { if (dialog.open && event.key === 'setlog-v1') render(); });
      document.addEventListener('visibilitychange', () => { if (dialog.open && !document.hidden) render(); });
    }
    render(); dialog.showModal(); dialog.scrollTop = 0; document.documentElement.classList.add('balance-open-page');
  }
  return { analyze, overview, open };
})();
