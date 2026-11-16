const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function setup({ installed = false, userAgent = 'iPhone Safari', dismissed = 0, storageFails = false } = {}) {
  const events = new Map(), elements = new Map(), stored = new Map([['setlog-install-dismissed-v1', String(dismissed)]]);
  const element = id => {
    if (!elements.has(id)) {
      const attributes = new Map(), listeners = new Map();
      elements.set(id, { hidden: false, children: [], dataset: {}, textContent: '', pauses: 0,
        setAttribute: (key, value) => attributes.set(key, value), getAttribute: key => attributes.get(key),
        append(...children) { this.children.push(...children); }, replaceChildren() { this.children = []; },
        addEventListener: (type, fn) => listeners.set(type, fn),
        showModal() { this.open = true; }, close() { this.open = false; listeners.get('close')?.(); },
        pause() { this.pauses++; }, play: () => Promise.resolve(),
        load() { if (id === 'installVideo') assert.equal(element('installGuide').open, true, 'show the dialog before loading media'); },
        querySelectorAll: () => [iphone, android] });
    }
    return elements.get(id);
  };
  const iphone = element('iphone'), android = element('android');
  iphone.dataset.installPlatform = 'iphone'; android.dataset.installPlatform = 'android';
  const media = { matches: installed, addEventListener: (name, fn) => events.set('display-' + name, fn) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../install-guide.js'), 'utf8'), {
    navigator: { userAgent }, Date,
    matchMedia: () => media,
    localStorage: { getItem: key => { if (storageFails) throw Error('Blocked'); return stored.get(key); }, setItem: (key, value) => stored.set(key, value) },
    document: { getElementById: element, createElement: tag => element(tag + Math.random()), createElementNS: (_, tag) => element(tag + Math.random()), documentElement: { classList: { add() {}, remove() {} } } },
    window: { addEventListener: (name, fn) => events.set(name, fn) }
  });
  return { element, events, stored, android, media };
}

test('Installed app hides the banner and redundant Settings install link', () => {
  const s = setup({ installed: true });
  assert.equal(s.element('installBanner').hidden, true);
  assert.equal(s.element('settingsInstallGuide').hidden, true);
});

test('Banner dismisses for seven days but Settings still opens the guide', () => {
  const s = setup(); assert.equal(s.element('installBanner').hidden, false);
  s.element('dismissInstall').onclick(); assert.equal(s.element('installBanner').hidden, true);
  assert.ok(Number(s.stored.get('setlog-install-dismissed-v1')) > 0);
  s.element('settingsInstallGuide').onclick(); assert.equal(s.element('installGuide').open, true);
  assert.equal(setup({ dismissed: Date.now() }).element('installBanner').hidden, true);
  assert.equal(setup({ dismissed: Date.now() - 8 * 86400000 }).element('installBanner').hidden, false);
});

test('Guide selects matching videos and steps, pauses on platform switch and close', () => {
  const s = setup(); s.element('openInstallGuide').onclick();
  const video = s.element('installVideo');
  assert.equal(video.src, 'install-iphone.mp4?playback=native-2');
  assert.equal(s.element('installSteps').children.length, 5);
  assert.equal(s.element('openInstallVideo').href, video.src);
  s.android.onclick(); assert.equal(video.src, 'install-android.mp4?playback=native-2');
  assert.match(s.element('installBrowserHint').textContent, /Chrome/);
  const pauses = video.pauses; s.element('closeInstallGuide').onclick();
  assert.equal(video.pauses, pauses + 1);
  assert.equal(s.element('installGuide').open, false);
});

test('Android is detected and blocked preference storage does not break the guide', () => {
  const s = setup({ userAgent: 'Android Chrome', storageFails: true });
  s.element('openInstallGuide').onclick();
  assert.equal(s.element('installVideo').src, 'install-android.mp4?playback=native-2');
});

test('An unsupported video shows a poster and retry, and switching platform clears the error', () => {
  const s = setup(); s.element('openInstallGuide').onclick();
  s.element('installVideo').onerror();
  assert.equal(s.element('installVideo').hidden, true);
  assert.equal(s.element('installVideoFallback').hidden, false);
  assert.match(s.element('installFallbackPoster').src, /install-iphone.jpg$/);
  s.element('retryInstallVideo').onclick();
  assert.equal(s.element('installVideo').hidden, false);
  s.element('installVideo').onerror(); s.android.onclick();
  assert.equal(s.element('installVideoFallback').hidden, true);
});

test('Native prompt is never automatic, runs once per event, and appinstalled hides install controls', async () => {
  const s = setup(); let prompts = 0;
  s.events.get('beforeinstallprompt')({ preventDefault() {}, async prompt() { prompts++; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
  assert.equal(prompts, 0); assert.equal(s.element('installNative').hidden, false);
  await s.element('installNative').onclick(); await s.element('installNative').onclick();
  assert.equal(prompts, 1); assert.match(s.element('installFeedback').textContent, /No rush/);
  s.events.get('appinstalled')(); assert.equal(s.element('installBanner').hidden, true);
});
