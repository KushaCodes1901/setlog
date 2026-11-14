const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function setup({ enabled = true, volume = 1, hidden = false } = {}) {
  const elements = new Map(), intervals = new Map(), timeouts = new Map(), events = [];
  let now = 100000, nextId = 0, audio;
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      value: 90, checked: enabled, textContent: '', style: {}, classList: { add() {}, toggle() {} },
      reportValidity: () => true, refresh() {}, setAttribute() {}, addEventListener() {},
      focus() {}, querySelector: element, querySelectorAll: () => [],
      showModal() { this.open = true; }, close() { this.open = false; }
    });
    return elements.get(selector);
  };
  class AudioContext {
    constructor() { this.state = 'suspended'; this.currentTime = 0; audio = this; }
    async resume() { events.push('audio-resume'); this.state = 'running'; }
    createOscillator() { return { frequency: {}, connect() {}, disconnect() {}, start() { events.push('note'); }, stop() {} }; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  }
  const context = vm.createContext({
    document: { hidden, querySelector: element, documentElement: { classList: { add() {}, toggle() {} } }, addEventListener() {} },
    window: { AudioContext, addEventListener() {} },
    localStorage: { getItem: key => key === 'setlog-rest-sound-v1' ? String(enabled) : null, setItem() {} },
    appSettings: { volume: () => volume, confetti: () => false },
    spotifyMusic: { async withRestAlert(chime) { events.push('spotify-pause'); await chime(); events.push('spotify-resume'); } },
    durationPicker: { attach: () => ({ refresh() {} }) }, Date: { now: () => now },
    setInterval: fn => { const id = ++nextId; intervals.set(id, fn); return id; },
    clearInterval: id => intervals.delete(id),
    setTimeout: (fn, delay) => { const id = ++nextId; timeouts.set(id, { fn, delay }); return id; },
    selectView() {}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../rest-timer.js'), 'utf8'), context);
  return { element, events, async start() { element('#restDuration').value = 1; element('#restStart').onclick(); await flush(); },
    finish() { now += 1000; [...intervals.values()].forEach(fn => fn()); },
    interrupt() { audio.state = 'interrupted'; },
    async endChime() { for (const [id, job] of [...timeouts]) { if (job.delay === 1000) { timeouts.delete(id); job.fn(); } } await flush(); } };
}

test('Rest completion restores interrupted audio, chimes once, and holds Spotify until notes finish', async () => {
  const s = setup(); await s.start(); s.interrupt(); s.events.length = 0;
  s.finish(); await flush();
  assert.deepEqual(s.events, ['spotify-pause', 'audio-resume', 'note', 'note', 'note']);
  assert.equal(s.element('#restFocusTitle').textContent, 'Break’s over!');
  s.finish(); await flush();
  assert.equal(s.events.filter(event => event === 'spotify-pause').length, 1);
  await s.endChime(); assert.equal(s.events.at(-1), 'spotify-resume');
});

test('Muted, disabled and background completions never interrupt music', async () => {
  for (const options of [{ volume: 0 }, { enabled: false }, { hidden: true }]) {
    const s = setup(options); await s.start(); s.events.length = 0;
    s.finish(); await flush(); assert.deepEqual(s.events, []);
  }
});

test('Test sound still previews the chime when automatic rest sounds are disabled', async () => {
  const s = setup({ enabled: false });
  const preview = s.element('#testRestSound').onclick(); await flush();
  assert.equal(s.events.filter(event => event === 'note').length, 3);
  await s.endChime(); await preview;
  assert.equal(s.events.at(-1), 'spotify-resume');
});
