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
      elements.set(id, { hidden: false, children: [], dataset: {}, textContent: '',
        setAttribute: (key, value) => attributes.set(key, value), getAttribute: key => attributes.get(key),
        append(...children) { this.children.push(...children); }, replaceChildren() { this.children = []; },
        addEventListener: (type, fn) => listeners.set(type, fn),
        showModal() { this.open = true; }, close() { this.open = false; listeners.get('close')?.(); },
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

test('Banner dismisses for this visit, survives prompt updates, and returns on a fresh page', () => {
  const s = setup(); assert.equal(s.element('installBanner').hidden, false);
  s.element('dismissInstall').onclick(); assert.equal(s.element('installBanner').hidden, true);
  s.events.get('beforeinstallprompt')({ preventDefault() {} });
  assert.equal(s.element('installBanner').hidden, true);
  s.element('settingsInstallGuide').onclick(); assert.equal(s.element('installGuide').open, true);
  assert.equal(setup({ dismissed: Date.now() }).element('installBanner').hidden, false);
  assert.equal(setup().element('installBanner').hidden, false);
  assert.equal(setup({ dismissed: Date.now() - 8 * 86400000 }).element('installBanner').hidden, false);
});

test('Guide switches illustrated steps between iPhone and Android without a video player', () => {
  const s = setup(); s.element('openInstallGuide').onclick();
  assert.equal(s.element('installSteps').children.length, 5);
  const picture = s.element('installSteps').children[0].children[1];
  assert.equal(picture.children[0].getAttribute('href'), 'install-steps.svg?v=samsung-1#iphone-1');
  s.android.onclick();
  assert.equal(s.element('installSteps').children.length, 4);
  assert.match(s.element('installBrowserHint').textContent, /Chrome/);
  const androidPicture = s.element('installSteps').children[0].children[1];
  assert.equal(androidPicture.children[0].getAttribute('href'), 'install-steps.svg?v=samsung-1#android-1');
  s.element('closeInstallGuide').onclick();
  assert.equal(s.element('installGuide').open, false);
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.doesNotMatch(html, /<video|installVideo|openInstallVideo/);
});

test('Android detection works with blocked preference storage', () => {
  const s = setup({ userAgent: 'Android Chrome', storageFails: true });
  s.element('openInstallGuide').onclick();
  assert.equal(s.element('installSteps').children.length, 4);
  assert.match(s.element('installBrowserHint').textContent, /Android/);
});

test('Native prompt is never automatic, runs once per event, and appinstalled hides install controls', async () => {
  const s = setup(); let prompts = 0;
  s.events.get('beforeinstallprompt')({ preventDefault() {}, async prompt() { prompts++; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
  assert.equal(prompts, 0); assert.equal(s.element('installNative').hidden, false);
  await s.element('installNative').onclick(); await s.element('installNative').onclick();
  assert.equal(prompts, 1); assert.match(s.element('installFeedback').textContent, /No rush/);
  s.events.get('appinstalled')(); assert.equal(s.element('installBanner').hidden, true);
});
