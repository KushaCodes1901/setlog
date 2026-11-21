const dailyMotivation = (() => {
  const storageKey = 'setlog-daily-motivation-v1';
  const all = ['ready', 'rest', 'done', 'return'];
  const messages = [
    { id: 'king-adjust', text: 'Champions adjust.', author: 'Billie Jean King', source: 'https://www.billiejeanking.com/battle-of-the-sexes/', contexts: all },
    { id: 'king-pressure', text: 'Pressure is a privilege.', author: 'Billie Jean King', source: 'https://www.billiejeanking.com/tennis/', contexts: ['ready'] },
    { id: 'serena-believe', text: 'You have to continue to work hard and believe in yourself.', author: 'Serena Williams', source: 'https://www.wtatennis.com/news/1440009/serena-williams-is-us-open-ready-i-have-more-fire-in-my-belly', contexts: ['ready', 'done', 'return'] },
    { id: 'keller-hope', text: 'Optimism is the faith that leads to achievement; nothing can be done without hope.', author: 'Helen Keller', source: 'https://afb.org/about-afb/history/helen-keller/helen-keller-quotes/helen-keller-quotes-optimism', contexts: all },
    { id: 'clear-systems', text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear', source: 'https://jamesclear.com/quotes/you-do-not-rise-to-the-level-of-your-goals-you-fall-to-the-level-of-your-systems', contexts: ['ready', 'done'] },
    { id: 'roosevelt-arena', text: 'The credit belongs to the man who is actually in the arena', author: 'Theodore Roosevelt', source: 'https://www.theodorerooseveltcenter.org/encyclopedia/culture-and-society/man-in-the-arena/', contexts: ['ready', 'done'] },
    ...[
      ['show-up', 'Show up for yourself. Let today’s effort be enough.', all],
      ['pace', 'Your pace can change. Your direction can stay.', all],
      ['focus', 'Bring your focus. Make the next step count.', ['ready']],
      ['ordinary', 'Strong routines are built one ordinary day at a time.', all],
      ['quiet-work', 'Give yourself credit for the work nobody else sees.', ['done', 'rest']],
      ['begin', 'Come as you are. Take the next step from here.', ['ready', 'return']],
      ['kind', 'Keep your standards kind and your effort honest.', all],
      ['courage', 'A little patience. A little courage. Another step forward.', all],
      ['tomorrow', 'Save some energy for tomorrow. You’re building for the long run.', ['rest', 'done']],
      ['back-yourself', 'Back yourself. Keep building something you can be proud of.', ['ready', 'done']],
      ['one-day', 'One day at a time is still a way forward.', all],
      ['curious', 'Stay curious. Small adjustments can open new doors.', all],
      ['breathe', 'Leave room for both ambition and breathing space.', all],
      ['real-life', 'Build a routine that has room for real life.', all],
      ['again', 'There is strength in beginning again.', ['return', 'ready']],
      ['quiet', 'Trust the quiet work. It counts too.', all],
      ['recharge', 'You don’t have to earn a moment to recharge.', ['rest']],
      ['rest-space', 'Give your next session a little breathing room.', ['rest']],
      ['credit', 'You made time for yourself today. That deserves some credit.', ['done']],
      ['fresh-start', 'Start from where you are, with what you have today.', ['return', 'ready']]
    ].map(([id, text, contexts]) => ({ id, text, contexts }))
  ];
  let remembered;
  const ordinal = date => Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  const dayKey = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');

  function sessionDay(value) {
    if (typeof value !== 'string') return null;
    const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
    if (!match) return null;
    const [, d, m, y] = match.map(Number);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? ordinal(date) : null;
  }

  function contextFor(sessions, now) {
    const today = ordinal(now);
    const entries = sessions.map(session => ({ session, day: sessionDay(session.date) })).filter(entry => entry.day !== null && entry.day <= today);
    const training = entries.filter(({ session }) => !session.restDay && session.exercises?.length);
    if (training.some(entry => entry.day === today)) return 'done';
    if (entries.some(entry => entry.day === today && entry.session.restDay)) return 'rest';
    if (training.length && today - Math.max(...training.map(entry => entry.day)) >= 7) return 'return';
    return 'ready';
  }

  function choose(context, now) {
    const day = dayKey(now);
    let saved = remembered;
    if (remembered?.day !== day) {
      try { saved = JSON.parse(localStorage.getItem(storageKey)) ?? remembered; } catch {}
    }
    const existing = messages.find(message => saved?.day === day && message.id === saved.id);
    if (existing) { remembered = saved; return existing; }
    const eligible = messages.filter(message => message.contexts.includes(context) && Boolean(message.author) === (ordinal(now) % 2 === 0));
    const choices = eligible.filter(message => message.id !== saved?.id);
    const message = choices[Math.floor(ordinal(now) / 2) % choices.length];
    remembered = { day, id: message.id };
    try { localStorage.setItem(storageKey, JSON.stringify(remembered)); } catch {}
    return message;
  }

  function render(sessions, now = new Date()) {
    const context = contextFor(sessions, now);
    const message = choose(context, now);
    const card = document.createElement('aside');
    card.className = 'daily-motivation';
    card.setAttribute('aria-label', 'Daily motivation');
    card.dataset.day = dayKey(now);
    card.dataset.message = message.id;
    card.dataset.context = context;
    const style = ['forest', 'teal', 'amethyst', 'indigo', 'berry'][Array.from(message.id).reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 5];
    card.dataset.style = style;
    card.dataset.length = message.text.length > 100 ? 'long' : 'short';
    const header = document.createElement('div');
    header.className = 'daily-motivation-header';
    const label = document.createElement('p');
    label.className = 'daily-motivation-label';
    label.textContent = 'Daily motivation';
    const edition = document.createElement('span');
    edition.className = 'daily-motivation-edition';
    edition.textContent = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    header.append(label, edition);
    const text = document.createElement(message.author ? 'blockquote' : 'p');
    text.className = 'daily-motivation-text';
    const words = message.text.split(' ');
    const highlight = document.createElement('em');
    highlight.textContent = words.splice(-Math.min(3, words.length)).join(' ');
    text.append((message.author ? '“' : '') + (words.length ? words.join(' ') + ' ' : ''), highlight, message.author ? '”' : '');
    const body = document.createElement('div');
    body.className = 'daily-motivation-body';
    body.append(text);
    card.append(header, body);
    if (message.author) {
      const author = document.createElement('a');
      author.className = 'daily-motivation-author';
      author.textContent = message.author;
      author.href = message.source;
      author.target = '_blank';
      author.rel = 'noopener noreferrer';
      author.setAttribute('aria-label', 'Quote by ' + message.author + ' — read source (opens in a new tab)');
      body.append(author);
    }
    const foot = document.createElement('p');
    foot.className = 'daily-motivation-note';
    foot.textContent = { ready: 'A little encouragement for your next session.', rest: 'Rest day logged. Make room to recharge.', done: 'Workout logged. Give yourself a little credit.', return: 'A fresh start, at your pace.' }[context];
    card.append(foot);
    return card;
  }

  function refresh(sessions, now = new Date()) {
    const current = document.querySelector('.daily-motivation');
    if (!current || (current.dataset.day === dayKey(now) && current.dataset.context === contextFor(sessions, now))) return false;
    current.replaceWith(render(sessions, now));
    return true;
  }
  return { render, refresh };
})();
