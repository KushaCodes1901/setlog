const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup({ enabled = true, volume = 1, hidden = false, sessionSupported = true, resumeStuck = false } = {}) {
  const elements = new Map(), intervals = new Map(), timeouts = new Map(), events = [];
  const oscillators = [];
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
    constructor() { this.state = 'suspended'; this.currentTime = 0; audio = this;
      if (sessionSupported && sessionType !== 'ambient') events.push('music-interrupted');
    }
    resume() { events.push('audio-resume'); if (resumeStuck) return new Promise(() => {}); this.state = 'running'; return Promise.resolve(); }
    async suspend() { events.push('audio-release'); this.state = 'suspended'; }
    createBuffer() { return {}; }
    createBufferSource() { return { connect() {}, disconnect() {}, start() { events.push('unlock-source'); } }; }
    createOscillator() { const oscillator = { frequency: {}, connect() {}, disconnect() {}, start(time) { this.startTime = time; events.push('note'); }, stop(time) { if (Number.isFinite(time)) this.stopTime = time; } }; oscillators.push(oscillator); return oscillator; }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  }
  let sessionType = 'auto';
  const audioSession = { get type() { return sessionType; }, set type(value) { sessionType = value; events.push('session-' + value); } };
  const context = vm.createContext({
    document: { hidden, querySelector: element, documentElement: { classList: { add() {}, toggle() {} } }, addEventListener() {} },
    window: { AudioContext, addEventListener() {} },
    navigator: sessionSupported ? { audioSession } : {},
    localStorage: { getItem: key => key === 'setlog-rest-sound-v1' ? String(enabled) : null, setItem() {} },
    appSettings: { volume: () => volume, confetti: () => false },
    spotifyMusic: { async withRestAlert(chime) { events.push('spotify-pause'); await chime(); events.push('spotify-resume'); } },
    durationPicker: { attach: () => ({ refresh() {} }) }, Date: { now: () => now },
    setInterval: fn => { const id = ++nextId; intervals.set(id, fn); return id; },
    clearInterval: id => intervals.delete(id),
    setTimeout: (fn, delay) => { const id = ++nextId; timeouts.set(id, { fn, delay }); return id; },
    clearTimeout: id => timeouts.delete(id),
    selectView() {}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../rest-timer.js'), 'utf8'), context);
  return { element, events, oscillators, audioState: () => audio?.state,
    async start() { element('#restDuration').value = 1; element('#restStart').onclick(); await flush(); },
    finish() { now += 1000; [...intervals.values()].forEach(fn => fn()); },
    interrupt() { audio.state = 'interrupted'; },
    async timeout(delay) { for (const [id, job] of [...timeouts]) { if (job.delay === delay) { timeouts.delete(id); job.fn(); } } await flush(); },
    async endChime(count = Infinity) { oscillators.filter(oscillator => !oscillator.ended).slice(0, count).forEach(oscillator => { oscillator.ended = true; oscillator.onended(); }); await flush(); } };
}

test('Rest completion restores interrupted audio, chimes once, and holds Spotify until notes finish', async () => {
  const s = setup(); await s.start(); s.interrupt(); s.events.length = 0;
  s.finish(); await flush();
  assert.deepEqual(s.events.slice(0, 3), ['spotify-pause', 'session-playback', 'audio-resume']);
  assert.equal(s.events.filter(event => event === 'note').length, 9);
  assert.ok(Math.abs(s.oscillators.at(-1).stopTime - s.oscillators[0].startTime - 4) < .001,
    'alert lasts four seconds from the first note to the final stop');
  assert.equal(s.element('#restFocusTitle').textContent, 'Break’s over!');
  s.finish(); await flush();
  assert.equal(s.events.filter(event => event === 'spotify-pause').length, 1);
  await s.endChime(8);
  assert.equal(s.events.includes('spotify-resume'), false, 'music waits for the final note');
  await s.endChime(); assert.deepEqual(s.events.slice(-3), ['audio-release', 'session-ambient', 'spotify-resume']);
});

test('Start and Resume prime audio in mixing mode, then leave it idle during the rest', async () => {
  const s = setup(); await s.start();
  assert.deepEqual(s.events, ['session-ambient', 'unlock-source', 'audio-resume', 'audio-release']);
  assert.equal(s.audioState(), 'suspended');
  s.events.length = 0;
  s.element('#restStart').onclick(); // Pause the countdown.
  s.element('#restStart').onclick(); // Resume it.
  await flush();
  assert.deepEqual(s.events, ['session-ambient', 'unlock-source', 'audio-resume', 'audio-release']);
  assert.equal(s.audioState(), 'suspended');
});

test('A stalled audio clock times out, releases Spotify and shows an honest failure message', async () => {
  const s = setup(); await s.start(); s.finish(); await flush();
  assert.equal(s.events.includes('spotify-resume'), false);
  await s.timeout(6000);
  assert.equal(s.events.at(-1), 'spotify-resume');
  assert.match(s.element('#restFocusAnnouncement').textContent, /Sound couldn’t play/);
  assert.deepEqual(s.events.slice(-3), ['audio-release', 'session-ambient', 'spotify-resume']);
});

test('A stuck resume cannot leave Spotify paused indefinitely', async () => {
  const s = setup({ resumeStuck: true });
  await s.start(); await s.timeout(1500);
  s.finish(); await flush(); await s.timeout(1500);
  assert.equal(s.events.at(-1), 'spotify-resume');
  assert.equal(s.events.includes('note'), false);
});

test('Browsers without Audio Session support still play and complete the chime', async () => {
  const s = setup({ sessionSupported: false }); await s.start(); s.finish(); await flush();
  assert.equal(s.events.filter(event => event === 'note').length, 9);
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
  assert.equal(s.events.filter(event => event === 'note').length, 9);
  await s.endChime(); await preview;
  assert.equal(s.events.at(-1), 'spotify-resume');
});
