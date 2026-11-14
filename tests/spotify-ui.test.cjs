const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const playback = (playing = true, progress = 11000) => ({
  is_playing: playing, progress_ms: progress, device: { id: 'phone', name: 'Phone' },
  item: { uri: 'spotify:track:test', name: 'Test song', duration_ms: 180000, artists: [] }
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function setup(initial = playback()) {
  const elements = new Map(), timeouts = new Map(), intervals = new Map();
  let now = 1000000, nextId = 0, current = initial, commandImpl = async () => {};
  const element = id => {
    if (!elements.has(id)) {
      const attrs = new Map();
      elements.set(id, { textContent: '', value: 0, hidden: false,
        classList: { toggle() {} }, setAttribute: (key, value) => attrs.set(key, String(value)),
        getAttribute: key => attrs.get(key) ?? null, removeAttribute: key => attrs.delete(key) });
    }
    return elements.get(id);
  };
  const client = { connected: true, retryAt: 0, playback: async () => current,
    command: (...args) => commandImpl(...args), disconnect() { this.connected = false; } };
  const context = vm.createContext({
    document: { querySelector: selector => element(selector.slice(1)), hidden: false, addEventListener() {} },
    location: { origin: 'http://127.0.0.1:8766', pathname: '/', search: '' },
    window: { fetch() {}, crypto: {}, addEventListener() {} }, sessionStorage: {},
    spotifyConfig: { clientId: 'test' }, spotifyClient: { create: () => client },
    URL, URLSearchParams, Date: { now: () => now },
    setTimeout: (fn, delay) => { const id = ++nextId; timeouts.set(id, { fn, delay }); return id; },
    clearTimeout: id => timeouts.delete(id),
    setInterval: fn => { const id = ++nextId; intervals.set(id, fn); return id; },
    clearInterval: id => intervals.delete(id)
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../spotify.js'), 'utf8'), context);
  vm.runInContext('spotifyMusic.setActive(true)', context);
  return { element, client, alert: callback => vm.runInContext('spotifyMusic', context).withRestAlert(callback),
    setActive: value => vm.runInContext('spotifyMusic', context).setActive(value),
    setPlayer: value => { current = value; },
    setCommand: fn => { commandImpl = fn; }, advance: ms => { now += ms; intervals.forEach(fn => fn()); },
    async poll() { const [id, job] = [...timeouts][0]; timeouts.delete(id); await job.fn(); },
    pollDelay: () => [...timeouts.values()][0]?.delay };
}

test('Pause changes the button and freezes elapsed time before the request completes', async () => {
  const s = setup(); await flush();
  s.advance(2000);
  const request = deferred(); s.setCommand(() => request.promise);
  const click = s.element('musicPlay').onclick();
  assert.equal(s.element('musicPlay').getAttribute('aria-label'), 'Play');
  assert.equal(s.element('musicElapsed').textContent, '0:13');
  s.advance(3000);
  assert.equal(s.element('musicElapsed').textContent, '0:13');
  request.resolve(); await click;
  // An old read must not undo the pause or make the clock jump.
  assert.equal(s.element('musicPlay').getAttribute('aria-label'), 'Play');
  assert.equal(s.element('musicElapsed').textContent, '0:13');
  assert.equal(s.pollDelay(), 750);
  s.setPlayer(playback(false, 13000)); await s.poll();
  assert.equal(s.element('musicDevice').textContent, 'Paused on Phone');
  assert.equal(s.pollDelay(), 5000);
});

test('Rest chime pauses fresh Spotify playback even outside Music and resumes after the chime', async () => {
  const s = setup(); await flush(); s.setActive(false);
  const events = [], chime = deferred();
  s.setCommand(async action => { events.push(action); s.setPlayer(playback(action === 'play')); });
  const alert = s.alert(async () => { events.push('chime'); await chime.promise; });
  await flush();
  assert.deepEqual(events, ['pause']);
  // Run the pause-settling timeout without advancing the outstanding chime.
  await s.poll(); await flush();
  assert.deepEqual(events, ['pause', 'chime']);
  chime.resolve(); await alert;
  assert.deepEqual(events, ['pause', 'chime', 'play']);
});

test('Rest chime leaves already-paused music paused', async () => {
  const s = setup(playback(false)); await flush();
  const commands = []; s.setCommand(async action => commands.push(action));
  let heard = false; await s.alert(async () => { heard = true; });
  assert.equal(heard, true); assert.deepEqual(commands, []);
});

test('Rest chime still plays when Spotify rejects the pause or is disconnected', async () => {
  for (const connected of [true, false]) {
    const s = setup(); await flush(); s.client.connected = connected;
    const commands = []; let heard = false;
    s.setCommand(async action => { commands.push(action); throw new Error('Unavailable'); });
    await s.alert(async () => { heard = true; });
    assert.equal(heard, true); assert.deepEqual(commands, connected ? ['pause'] : []);
  }
});

test('Rest alert never resumes a different track or device, or a disconnected account', async () => {
  for (const change of ['track', 'device', 'disconnect', 'already-resumed']) {
    const s = setup(); await flush();
    const commands = [];
    s.setCommand(async action => { commands.push(action); s.setPlayer(playback(false)); });
    const alert = s.alert(async () => {
      const changed = playback(false);
      if (change === 'track') changed.item.uri = 'spotify:track:another';
      if (change === 'device') changed.device.id = 'another-device';
      if (change === 'already-resumed') changed.is_playing = true;
      if (change === 'disconnect') s.element('musicDisconnect').onclick();
      s.setPlayer(changed);
    });
    await flush(); await s.poll(); await alert;
    assert.deepEqual(commands, ['pause'], change);
  }
});

test('A chime failure still restores Spotify music paused for the alert', async () => {
  const s = setup(); await flush();
  const commands = [];
  s.setCommand(async action => { commands.push(action); s.setPlayer(playback(action === 'play')); });
  const alert = s.alert(async () => { throw new Error('Audio interrupted'); });
  const rejected = assert.rejects(alert, /Audio interrupted/);
  await flush(); await s.poll(); await rejected;
  assert.deepEqual(commands, ['pause', 'play']);
});

test('Play starts the clock immediately and ignores a briefly stale paused response', async () => {
  const s = setup(playback(false)); await flush();
  await s.element('musicPlay').onclick();
  assert.equal(s.element('musicPlay').getAttribute('aria-label'), 'Pause');
  s.advance(2000);
  assert.equal(s.element('musicElapsed').textContent, '0:13');
  s.setPlayer(playback(true, 13000)); await s.poll();
  assert.equal(s.element('musicDevice').textContent, 'Playing on Phone');
});

test('A rejected pause restores playback and reports the failure', async () => {
  const s = setup(); await flush();
  const request = deferred(); s.setCommand(() => request.promise);
  const click = s.element('musicPlay').onclick();
  s.advance(2000);
  request.reject(Object.assign(new Error('Pause was rejected. Try again.'), { kind: 'restricted' }));
  await click;
  assert.equal(s.element('musicPlay').getAttribute('aria-label'), 'Pause');
  assert.equal(s.element('musicElapsed').textContent, '0:13');
  assert.equal(s.element('musicStatus').textContent, 'Pause was rejected. Try again.');
});

test('An accepted command cannot override real Spotify state indefinitely', async () => {
  const s = setup(); await flush();
  await s.element('musicPlay').onclick();
  assert.equal(s.element('musicPlay').getAttribute('aria-label'), 'Play');
  s.advance(5001); await s.poll();
  assert.equal(s.element('musicPlay').getAttribute('aria-label'), 'Pause');
  assert.equal(s.pollDelay(), 5000);
});

test('A changed track is accepted immediately, and disconnect ignores late commands', async () => {
  const s = setup(); await flush();
  const next = playback(); next.item.uri = 'spotify:track:other'; next.item.name = 'Another song';
  s.setPlayer(next); await s.element('musicPlay').onclick();
  assert.equal(s.element('musicTitle').textContent, 'Another song');
  assert.equal(s.element('musicPlay').getAttribute('aria-label'), 'Pause');
  const request = deferred(); s.setCommand(() => request.promise);
  const click = s.element('musicPlay').onclick();
  s.element('musicDisconnect').onclick(); request.resolve(); await click;
  assert.equal(s.element('musicPlayer').hidden, true);
  assert.equal(s.element('musicStatus').textContent, 'Disconnected from Setlog. Your music stays in Spotify.');
});
