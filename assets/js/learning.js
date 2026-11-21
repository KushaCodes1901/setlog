const appLearning = (() => {
  const root = document.querySelector('#learnView');
  const book = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14"/></svg>';
  let query = '', area = 'All', libraryScroll = 0, returnButton = null;
  let page = 'library', activeGuide = null, detailFromLibrary = false;
  const photo = guide => guide.illustration;
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function heading(title, backText, onBack) {
    root.replaceChildren();
    const back = element('button', '‹ ' + backText, 'learn-back');
    back.type = 'button'; back.onclick = onBack;
    const h = element('h1', title); h.tabIndex = -1;
    root.append(back, h);
    return h;
  }
  function close() {
    if (!appNavigation.backTo('log')) selectView('log', { restoreScroll: true });
    (returnButton?.isConnected ? returnButton : document.querySelector('#openLearning')).focus({ preventScroll: true });
  }
  function results(list, count) {
    const terms = query.toLowerCase().trim().split(/\s+/);
    const matches = learningGuides.filter(g => (area === 'All' || g.area === area)
      && terms.every(term => `${g.name} ${g.area} ${g.equipment}`.toLowerCase().includes(term)));
    count.textContent = `${matches.length} ${matches.length === 1 ? 'guide' : 'guides'}`;
    list.replaceChildren();
    for (const [index, guide] of matches.entries()) {
      const button = element('button', null, 'learn-guide-card'); button.type = 'button';
      const img = new Image();
      img.loading = index < 4 ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.src = `assets/media/learning/${guide.slug}-thumbnail.webp`;
      img.alt = ''; img.width = 256; img.height = 256;
      let thumbnail = img;
      if (guide.illustration) {
        thumbnail = element('span', null, 'learn-character-thumbnail');
        const frame = element('span', null, 'learn-character-window');
        frame.append(img);
        thumbnail.append(frame);
      }
      const copy = element('span', null, 'learn-guide-copy');
      copy.append(element('small', guide.area), element('strong', guide.name), element('span', guide.equipment));
      const chevron = element('span', '›', 'learn-chevron'); chevron.setAttribute('aria-hidden', 'true');
      button.append(thumbnail, copy, chevron);
      button.onclick = () => { libraryScroll = window.scrollY; detail(guide, true); };
      list.append(button);
    }
    if (!matches.length) list.append(element('p', 'No guide here yet. Try another name or body area.', 'learn-empty'));
  }
  function library({ focus = true } = {}) {
    appNavigation.remember();
    page = 'library'; activeGuide = null;
    const h = heading('Learn the movement', 'Log Workout', close);
    root.append(element('p', 'A little confidence before your next set.', 'learn-intro'));
    const note = element('div', null, 'learn-library-note'); note.innerHTML = book;
    note.append(element('span', `${learningGuides.length} movement guides. Start position, finish position and the details that matter.`));
    const search = element('input'); search.type = 'search'; search.placeholder = 'Find an exercise'; search.value = query;
    search.setAttribute('aria-label', 'Search exercise guides');
    const filters = element('div', null, 'learn-filters'); filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', 'Filter guides by body area');
    const count = element('p', '', 'learn-count'); count.setAttribute('role', 'status');
    const list = element('div', null, 'learn-guide-list');
    for (const label of ['All', ...new Set(learningGuides.map(guide => guide.area))]) {
      const button = element('button', label); button.type = 'button'; button.setAttribute('aria-pressed', String(area === label));
      button.onclick = () => {
        area = label;
        for (const child of filters.children) child.setAttribute('aria-pressed', String(child === button));
        button.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        results(list, count);
      };
      filters.append(button);
    }
    search.oninput = () => { query = search.value; results(list, count); };
    root.append(note, search, filters, count, list, element('p', 'Start light and move with control. Stop if a movement causes pain. Ask a trainer if you are unsure about your setup.', 'learn-safety'));
    results(list, count);
    if (focus) h.focus({ preventScroll: true });
    if (document.body.dataset.view === 'learn') appNavigation.record('learn');
  }
  function detail(guide, fromLibrary) {
    appNavigation.remember();
    page = 'detail'; activeGuide = guide; detailFromLibrary = fromLibrary;
    const h = heading(guide.name, fromLibrary ? 'All guides' : 'Log Workout', () => {
      if (!fromLibrary) return close();
      library(); window.scrollTo({ top: libraryScroll, behavior: 'auto' });
    });
    root.append(element('p', `${guide.area} · ${guide.equipment}`, 'learn-intro'));
    const muscles = learningMuscles.render(guide.slug);
    if (muscles) root.append(muscles);
    const pair = element('div', null, 'learn-photo-pair');
    for (const [i, phase] of ['start', 'finish'].entries()) {
      const figure = element('figure');
      const image = new Image(); image.decoding = 'async'; image.src = photo(guide, phase); image.alt = `${guide.name}: ${guide.positions[i]}`; image.width = 1600; image.height = 800;
      const caption = element('figcaption');
      caption.append(element('strong', `${i + 1} · ${phase === 'start' ? 'Start' : 'Finish'}`), element('span', guide.positions[i]));
      if (guide.illustration) {
        const frame = element('div', null, 'learn-character-frame ' + phase);
        frame.append(image); figure.append(frame, caption);
      } else {
        figure.append(image, caption);
      }
      pair.append(figure);
    }
    root.append(pair);
    const how = element('section', null, 'learn-instructions'); how.append(element('h2', exerciseDefinition(guide.name)?.tracking === 'seconds' ? 'Make the hold count' : 'Make each rep count'));
    const steps = element('ol'); guide.steps.forEach(step => steps.append(element('li', step))); how.append(steps);
    const mistake = element('aside', null, 'learn-mistake'); mistake.append(element('h3', 'Watch out for'), element('p', guide.mistake));
    root.append(how, mistake, element('p', 'Use a light load while learning. An exercise guide cannot check your form; ask a trainer if you are unsure.', 'learn-safety'));
    if (!fromLibrary) {
      const browse = element('button', 'Browse all guides', 'learn-browse'); browse.type = 'button'; browse.onclick = () => { library(); window.scrollTo(0, 0); }; root.append(browse);
    }
    if (document.body.dataset.view === 'learn') window.scrollTo(0, 0);
    h.focus({ preventScroll: true });
    if (document.body.dataset.view === 'learn') appNavigation.record('learn');
  }
  document.querySelector('#openLearning').onclick = event => {
    returnButton = event.currentTarget; libraryScroll = 0; library({ focus: false }); selectView('learn'); root.querySelector('h1').focus({ preventScroll: true });
  };
  return {
    capture() { return { page, slug: activeGuide?.slug, fromLibrary: detailFromLibrary, query, area, libraryScroll }; },
    restore(state) {
      query = state.query; area = state.area; libraryScroll = state.libraryScroll;
      const guide = learningGuides.find(item => item.slug === state.slug);
      if (state.page === 'detail' && guide) detail(guide, state.fromLibrary);
      else library({ focus: false });
    },
    bindCard(card, name) {
      const canonical = exerciseDefinition(name)?.name || name;
      const guide = learningGuides.find(g => g.name.toLowerCase() === canonical.toLowerCase());
      const button = card.querySelector('.learn-exercise');
      if (!guide) return;
      button.hidden = false; button.setAttribute('aria-label', 'Learn ' + guide.name);
      button.onclick = () => { returnButton = button; detail(guide, false); selectView('learn'); root.querySelector('h1').focus({ preventScroll: true }); };
    }
  };
})();
