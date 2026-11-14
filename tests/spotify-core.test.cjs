const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto, createHash } = require('node:crypto');
const context = vm.createContext({ URL, URLSearchParams, AbortController, TextEncoder, Uint8Array, setTimeout, clearTimeout, btoa });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../spotify-core.js'), 'utf8'), context);
const factory = vm.runInContext('spotifyClient', context);
const id = 'a'.repeat(32), redirect = 'http://127.0.0.1:8766/';
const tokenKey = 'setlog-spotify-session-v1', pendingKey = 'setlog-spotify-pkce-v1';
function setup({ saved = true, expired = false, redirectUri = redirect, clientId = id } = {}) {
  let time = 1000000;
  const values = new Map();
  if (saved) values.set(tokenKey, JSON.stringify({ clientId: id, access_token: 'test-access', refresh_token: 'test-refresh', expires_at: time + (expired ? -1 : 3600000) }));
  const responses = [], calls = [];
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const client = factory.create({ clientId, redirectUri, storage, crypto: webcrypto, now: () => time,
    fetch: async (url, options) => { calls.push({ url, ...options }); assert.ok(responses.length, 'Unexpected request'); const response = responses.shift(); return typeof response === 'function' ? response() : response; } });
  return { client, values, calls, responses, storage, advance: ms => { time += ms; } };
}
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const empty = () => new Response(null, { status: 204 });
const fresh = extra => json({ access_token: 'new-access', expires_in: 3600, ...extra });
const player = { device: { id: 'this device', is_restricted: false }, item: { duration_ms: 180000 }, actions: { disallows: {} } };

test('authorization uses random state and SHA-256 PKCE with only playback scopes', async () => {
  const s = setup({ saved: false });
  const url = new URL(await s.client.authorize());
  const pending = JSON.parse(s.values.get(pendingKey));
  assert.equal(url.origin, 'https://accounts.spotify.com');
  assert.equal(url.searchParams.get('redirect_uri'), redirect);
  assert.equal(url.searchParams.get('state'), pending.state);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(pending.verifier).digest('base64url'));
  assert.equal(url.searchParams.get('scope'), 'user-read-playback-state user-modify-playback-state');
  assert.equal(url.searchParams.has('client_secret'), false);
  assert.equal(s.calls.length, 0);
  const next = new URL(await s.client.authorize());
  assert.notEqual(next.searchParams.get('state'), pending.state);
});

test('callback exchanges the verified code without any client secret', async () => {
  const s = setup({ saved: false });
  const url = new URL(await s.client.authorize());
  const pending = JSON.parse(s.values.get(pendingKey));
  s.responses.push(fresh({ refresh_token: 'first-refresh' }));
  await s.client.finish({ code: 'test-code', state: url.searchParams.get('state') });
  assert.equal(s.client.connected, true);
  assert.equal(s.values.has(pendingKey), false);
  const body = s.calls[0].body;
  assert.equal(body.get('code_verifier'), pending.verifier);
  assert.equal(body.get('redirect_uri'), redirect);
  assert.equal(body.has('client_secret'), false);
});

test('wrong state, stale callbacks and denied access never exchange a code', async () => {
  for (const condition of ['state', 'expired', 'denied']) {
    const s = setup({ saved: false });
    const url = new URL(await s.client.authorize());
    if (condition === 'expired') s.advance(600001);
    await assert.rejects(s.client.finish({ code: 'test-code', state: condition === 'state' ? 'wrong' : url.searchParams.get('state'),
      error: condition === 'denied' ? 'access_denied' : null }), error => error.kind === 'auth');
    assert.equal(s.calls.length, 0);
    assert.equal(s.client.connected, false);
  }
});

test('localhost and insecure public redirect addresses are rejected', async () => {
  for (const redirectUri of ['http://localhost:8766/', 'http://example.com/']) {
    const s = setup({ saved: false, redirectUri });
    await assert.rejects(s.client.authorize(), error => error.kind === 'setup');
  }
});

test('a missing Client ID and unavailable session storage produce actionable errors', async () => {
  await assert.rejects(setup({ saved: false, clientId: '' }).client.authorize(), error => error.kind === 'setup');
  const s = setup({ saved: false });
  s.storage.setItem = () => { throw Error('Unavailable'); };
  await assert.rejects(s.client.authorize(), error => error.kind === 'storage');
});

test('missing playback returns null and music metadata stays out of storage', async () => {
  const s = setup();
  s.responses.push(empty(), json({ item: { name: 'Test song' }, device: { name: 'Test phone' } }));
  assert.equal(await s.client.playback(), null);
  assert.equal((await s.client.playback()).item.name, 'Test song');
  assert.equal([...s.values.values()].some(value => value.includes('Test song')), false);
  assert.equal(s.calls[0].headers.Authorization, 'Bearer test-access');
});

test('expiry refreshes credentials and retains the previous refresh token when not rotated', async () => {
  const s = setup({ expired: true });
  s.responses.push(fresh(), empty());
  await s.client.playback();
  assert.equal(s.calls[0].body.get('grant_type'), 'refresh_token');
  assert.equal(s.calls[0].body.get('client_id'), id);
  assert.equal(s.calls[1].headers.Authorization, 'Bearer new-access');
  assert.equal(JSON.parse(s.values.get(tokenKey)).refresh_token, 'test-refresh');
});

test('simultaneous API requests share one credential refresh', async () => {
  const s = setup({ expired: true });
  s.responses.push(fresh({ refresh_token: 'rotated' }), empty(), empty());
  await Promise.all([s.client.playback(), s.client.playback()]);
  assert.equal(s.calls.filter(call => call.url.includes('/api/token')).length, 1);
  assert.equal(JSON.parse(s.values.get(tokenKey)).refresh_token, 'rotated');
});

test('401 refreshes once; a repeated 401 disconnects instead of looping', async () => {
  const s = setup();
  s.responses.push(json({}, 401), fresh(), json({}, 401));
  await assert.rejects(s.client.playback(), error => error.kind === 'auth');
  assert.equal(s.calls.length, 3);
  assert.equal(s.client.connected, false);
  assert.equal(s.values.has(tokenKey), false);
});

test('revoked refresh credentials are removed; network trouble keeps credentials for retry', async () => {
  const revoked = setup({ expired: true });
  revoked.responses.push(json({}, 400));
  await assert.rejects(revoked.client.playback(), error => error.kind === 'auth');
  assert.equal(revoked.client.connected, false);
  const offline = setup();
  offline.responses.push(() => { throw Error('offline'); });
  await assert.rejects(offline.client.playback(), error => error.kind === 'network');
  assert.equal(offline.client.connected, true);
});

test('rate limits honor Retry-After and suppress additional requests', async () => {
  const s = setup();
  s.responses.push(json({}, 429, { 'Retry-After': '60' }));
  await assert.rejects(s.client.playback(), error => error.kind === 'rate');
  await assert.rejects(s.client.playback(), error => error.kind === 'rate');
  assert.equal(s.calls.length, 1);
  s.advance(60001);
  s.responses.push(empty());
  await s.client.playback();
  assert.equal(s.calls.length, 2);
});

test('controls target the displayed device and use Spotify’s command methods', async () => {
  const s = setup();
  for (const action of ['play', 'pause', 'next', 'previous']) {
    s.responses.push(empty());
    await s.client.command(action, player);
  }
  assert.deepEqual(s.calls.map(call => call.method), ['PUT', 'PUT', 'POST', 'POST']);
  for (const call of s.calls) assert.equal(new URL(call.url).searchParams.get('device_id'), 'this device');
});

test('restricted devices, unavailable actions and invalid seek values send no command', async () => {
  const s = setup();
  await assert.rejects(s.client.command('play', { device: { is_restricted: true } }), error => error.kind === 'inactive');
  await assert.rejects(s.client.command('next', { ...player, actions: { disallows: { skipping_next: true } } }), error => error.kind === 'restricted');
  await assert.rejects(s.client.command('seek', player, NaN), error => error.kind === 'action');
  assert.equal(s.calls.length, 0);
});

test('seeking clamps position to the track duration', async () => {
  const s = setup();
  s.responses.push(empty(), empty());
  await s.client.command('seek', player, -20);
  await s.client.command('seek', player, 999999);
  assert.equal(new URL(s.calls[0].url).searchParams.get('position_ms'), '0');
  assert.equal(new URL(s.calls[1].url).searchParams.get('position_ms'), '180000');
});

test('permission and no-active-device errors never report success', async () => {
  for (const [status, kind] of [[403, 'permission'], [404, 'inactive']]) {
    const s = setup();
    s.responses.push(json({}, status));
    await assert.rejects(s.client.command('next', player), error => error.kind === kind);
  }
});

test('disconnect during a refresh cannot restore tokens or send a playback request', async () => {
  const s = setup({ expired: true });
  let release;
  s.responses.push(() => new Promise(resolve => { release = resolve; }));
  const request = s.client.playback();
  s.client.disconnect();
  release(fresh());
  await assert.rejects(request, error => error.kind === 'disconnected');
  assert.equal(s.client.connected, false);
  assert.equal(s.values.has(tokenKey), false);
  assert.equal(s.calls.length, 1);
});

test('another app’s saved credentials are never reused', () => {
  const s = setup({ clientId: 'b'.repeat(32) });
  assert.equal(s.client.connected, false);
});

test('successful command responses may contain non-JSON acknowledgement text', async () => {
  const s = setup();
  s.responses.push(new Response('202 ACCEPTED', { status: 200 }));
  assert.equal(await s.client.command('pause', player), null);
});

test('unreadable playback responses produce a friendly error instead of raw parser text', async () => {
  const s = setup();
  s.responses.push(new Response('Temporary upstream issue', { status: 200 }));
  await assert.rejects(s.client.playback(), error => error.kind === 'service' && !error.message.includes('JSON'));
});

test('playback restrictions are respected in both response shapes', async () => {
  const s = setup();
  await assert.rejects(s.client.command('pause', { ...player, actions: { pausing: true } }), error => error.kind === 'restricted');
  assert.equal(s.calls.length, 0);
});
