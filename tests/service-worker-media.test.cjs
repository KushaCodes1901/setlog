const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const origin = 'https://example.test/setlog/';

function setup({ offline = false, contentType = 'text/html' } = {}) {
  const handlers = {}, requests = [], writes = [], precached = [];
  const cache = {
    async addAll(assets) { precached.push(...assets.map(asset => asset.url)); },
    async match() { return new Response('offline guide', { headers: { 'Content-Type': 'text/html' } }); },
    async put(key) { writes.push(key); }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8'), {
    self: { location: { href: origin + 'sw.js' }, addEventListener: (type, handler) => { handlers[type] = handler; } },
    URL, Request, Response, Headers,
    caches: { open: async () => cache },
    fetch: async request => { requests.push(request); if (offline) throw Error('Offline'); return new Response('network asset', { headers: { 'Content-Type': contentType } }); }
  });
  return { requests, writes, precached,
    async install() { let job; handlers.install({ waitUntil: promise => { job = promise; } }); await job; },
    async request(file, { range = '', mode = 'cors' } = {}) {
      let promise;
      handlers.fetch({ request: { method: 'GET', url: origin + file, mode, headers: new Headers(range ? { Range: range } : {}) },
        respondWith: response => { promise = response; } });
      return promise;
    }
  };
}

test('Embedded media and Safari byte probes bypass service-worker fetch and cache handling', async () => {
  const s = setup();
  for (const file of ['install-iphone.mp4', 'install-android.mp4?playback=native-2']) {
    for (const range of ['', 'bytes=0-1', 'bytes=100-']) {
      assert.equal(await s.request(file, { range }), undefined);
    }
  }
  assert.equal(s.requests.length, 0); assert.equal(s.writes.length, 0);
});

test('Opening the direct video cannot replace the cached app page', async () => {
  const s = setup();
  assert.equal(await s.request('install-iphone.mp4?playback=native-2', { mode: 'navigate' }), undefined);
  assert.deepEqual(s.writes, []);
});

test('Offline installation caches illustrated steps without video assets', async () => {
  const s = setup(); await s.install();
  assert.ok(s.precached.includes(origin + 'install-steps.svg?v=samsung-1'));
  assert.equal(s.precached.some(url => /install-(iphone|android)\.(jpg|vtt)/.test(url)), false);
  assert.equal(s.precached.some(url => new URL(url).pathname.endsWith('.mp4')), false);
});

test('Ordinary assets still update online and fall back to cache offline', async () => {
  const online = setup();
  assert.equal(await (await online.request('install-guide.js?v=visit-banner-1')).text(), 'network asset');
  assert.deepEqual(online.writes, [origin + 'install-guide.js?v=visit-banner-1']);
  const offline = setup({ offline: true });
  assert.equal(await (await offline.request('install-steps.svg?v=samsung-1')).text(), 'offline guide');
});

test('Non-HTML navigations cannot poison the offline home page', async () => {
  const s = setup({ contentType: 'image/png' });
  await s.request('icon.png', { mode: 'navigate' });
  assert.deepEqual(s.writes, []);
});
