const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const key = 'setlog-settings-v1';

function setup({ saved = null, blocked = false, settings = false } = {}) {
  const storage = new Map(saved === null ? [] : [[key, typeof saved === 'string' ? saved : JSON.stringify(saved)]]);
  const elements = new Map(), listeners = new Map();
  const root = { dataset: {}, style: {} };
  const element = selector => {
    if (!elements.has(selector)) {
      const attrs = new Map(), events = new Map();
      elements.set(selector, { value: '', checked: true, dataset: {}, style: {}, textContent: '',
        classList: { toggle() {} }, reportValidity: () => true, setCustomValidity() {},
        setAttribute: (key, value) => attrs.set(key, value), getAttribute: key => attrs.get(key),
        addEventListener: (type, fn) => events.set(type, fn),
        showModal() { this.open = true; }, close() { this.open = false; events.get('close')?.(); } });
    }
    return elements.get(selector);
  };
  const context = vm.createContext({
    document: { documentElement: root, querySelector: element },
    localStorage: { getItem: name => { if (blocked) throw Error('Storage blocked'); return storage.get(name) ?? null; },
      setItem: (name, value) => { if (blocked) throw Error('Storage blocked'); storage.set(name, value); } },
    window: { addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); }, dispatchEvent() {} },
    setTimeout() { return 1; }, clearTimeout() {}, Event
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../theme.js'), 'utf8'), context);
  if (settings) vm.runInContext(fs.readFileSync(path.join(__dirname, '../settings.js'), 'utf8'), context);
  return { root, storage, element,
    apply: value => { context.value = value; vm.runInContext('appTheme.apply(value)', context); },
    changedStorage: value => listeners.get('storage').forEach(fn => fn({ key, newValue: JSON.stringify(value) })) };
}

test('Saved light theme and browser chrome are applied before deferred settings initialize', () => {
  const s = setup({ saved: { appearance: 'light' } });
  assert.equal(s.root.dataset.theme, 'light');
  assert.equal(s.root.style.colorScheme, 'light');
  assert.equal(s.element('meta[name="theme-color"]').getAttribute('content'), '#f5f6f0');
});

test('Missing, malformed, invalid or inaccessible preferences safely retain dark mode', () => {
  for (const options of [{}, { saved: '{invalid' }, { saved: { appearance: 'surprise' } }, { saved: { appearance: 'system' } }, { blocked: true }]) {
    assert.equal(setup(options).root.dataset.theme, 'dark');
  }
});

test('A preference changed in another tab updates the theme', () => {
  const s = setup(); s.changedStorage({ appearance: 'light' });
  assert.equal(s.root.dataset.theme, 'light');
});

test('Choosing a theme saves it without changing units, profile measurements or alert preferences', () => {
  const saved = { appearance: 'dark', weightUnit: 'lbs', heightUnit: 'm', heightCm: 184, bodyWeightKg: 77, volume: 75, confetti: false };
  const s = setup({ saved, settings: true });
  s.element('#appearanceToggle').checked = false;
  s.element('#appearanceToggle').onchange();
  const updated = JSON.parse(s.storage.get(key));
  assert.deepEqual(updated, { ...saved, appearance: 'light' });
  assert.equal(s.root.dataset.theme, 'light');
  assert.equal(s.element('#appearanceToggle').checked, false);
  s.element('#saveSettings').onclick();
  assert.equal(s.element('#settingsSavedTitle').textContent, 'Settings saved!');
  const reopened = setup({ saved: updated, settings: true });
  assert.equal(reopened.root.dataset.theme, 'light');
  assert.equal(reopened.element('#appearanceToggle').checked, false);
  reopened.element('#appearanceToggle').checked = true;
  reopened.element('#appearanceToggle').onchange();
  assert.equal(reopened.root.dataset.theme, 'dark');
});
