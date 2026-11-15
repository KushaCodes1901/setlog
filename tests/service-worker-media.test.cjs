const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const origin = 'https://example.test/setlog/';
const url = origin + 'install-iphone.mp4';
const video = fs.readFileSync(path.join(__dirname, '../install-iphone.mp4'));

function setup({ cached = true, offline = false } = {}) {
  const handlers = {}, requests = [], writes = [];
  let stored = cached ? new Response(video, { headers: { 'Content-Type': 'video/mp4' } }) : null;
  const cache = { match: async () => stored?.clone(), async put(key, response) { writes.push(response.status); stored = response.clone(); } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8'), {
    self: { location: { href: origin + 'sw.js' }, addEventListener: (type, handler) => { handlers[type] = handler; } },
    URL, Request, Response, Headers,
    caches: { open: async () => cache },
    fetch: async request => { requests.push(request); if (offline) throw Error('Offline'); return new Response(video, { headers: { 'Content-Type': 'video/mp4' } }); }
  });
  return { requests, writes, async request(range) {
    let promise;
    handlers.fetch({ request: new Request(url, { headers: range ? { Range: range } : {} }), respondWith: response => { promise = response; } });
    return promise;
  } };
}

test('Safari two-byte media probe receives exact 206 bytes and length from cache', async () => {
  const s = setup(); const response = await s.request('bytes=0-1');
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Content-Range'), `bytes 0-1/${video.length}`);
  assert.equal(response.headers.get('Content-Length'), '2');
  assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), video.subarray(0, 2));
  assert.equal(s.requests.length, 0);
});

test('Open-ended, suffix and oversized-end ranges are correctly sliced offline', async () => {
  const s = setup({ offline: true });
  for (const [range, start, end] of [['bytes=20-', 20, video.length], ['bytes=-32', video.length - 32, video.length],
    [`bytes=${video.length - 10}-${video.length + 500}`, video.length - 10, video.length]]) {
    const response = await s.request(range);
    assert.equal(response.status, 206);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), video.subarray(start, end));
  }
});

test('Invalid and unsatisfiable ranges return 416 with the complete resource size', async () => {
  const s = setup();
  for (const range of ['bytes=-0', 'bytes=5-2', `bytes=${video.length}-`, 'bytes=0-1,4-5', 'bytes=-']) {
    const response = await s.request(range);
    assert.equal(response.status, 416, range);
    assert.equal(response.headers.get('Content-Range'), `bytes */${video.length}`);
  }
});

test('A partial media request cannot replace the cached full video', async () => {
  const s = setup(); await s.request('bytes=0-1'); await s.request('bytes=50-99');
  const full = await s.request();
  assert.equal(full.status, 200);
  assert.deepEqual(Buffer.from(await full.arrayBuffer()), video);
  assert.deepEqual(s.writes, []);
});

test('Cold media load fetches and caches a full file before answering the requested range', async () => {
  const s = setup({ cached: false });
  const partial = await s.request('bytes=10-19');
  assert.equal(s.requests[0].headers.has('Range'), false);
  assert.deepEqual(s.writes, [200]);
  assert.equal(partial.status, 206);
  assert.deepEqual(Buffer.from(await partial.arrayBuffer()), video.subarray(10, 20));
  const full = await s.request();
  assert.deepEqual(Buffer.from(await full.arrayBuffer()), video);
  assert.equal(s.requests.length, 1);
});

test('Offline media with no cached resource fails rather than returning invalid video data', async () => {
  const s = setup({ cached: false, offline: true });
  assert.equal((await s.request('bytes=0-1')).type, 'error');
});
