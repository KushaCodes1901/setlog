const spotifyClient = (() => {
  const tokenKey = 'setlog-spotify-session-v1';
  const pendingKey = 'setlog-spotify-pkce-v1';
  const scopes = 'user-read-playback-state user-modify-playback-state';
  class SpotifyError extends Error {
    constructor(kind, message) { super(message); this.kind = kind; }
  }
  const validId = id => /^[a-f\d]{32}$/i.test(id);
  function create({ clientId, redirectUri, storage, fetch: request, crypto, now = Date.now }) {
    let tokens = null;
    let refreshPromise = null;
    let epoch = 0;
    let retryAt = 0;
    try {
      const saved = JSON.parse(storage.getItem(tokenKey));
      if (saved?.clientId === clientId && typeof saved.access_token === 'string' && saved.access_token
        && typeof saved.refresh_token === 'string' && saved.refresh_token && Number.isFinite(saved.expires_at)) tokens = saved;
    } catch {}

    const assertEpoch = version => {
      if (version !== epoch) throw new SpotifyError('disconnected', 'Connection closed.');
    };
    function disconnect() {
      epoch++;
      tokens = null;
      refreshPromise = null;
      retryAt = 0;
      try { storage.removeItem(tokenKey); storage.removeItem(pendingKey); } catch {}
    }
    async function send(url, options = {}) {
      if (now() < retryAt) throw new SpotifyError('rate', 'Spotify needs a moment. Please wait before trying again.');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await request(url, { ...options, signal: controller.signal, cache: 'no-store', referrerPolicy: 'no-referrer' });
        if (response.status === 429) {
          const seconds = Number(response.headers.get('Retry-After'));
          retryAt = now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 30) * 1000;
          throw new SpotifyError('rate', 'Spotify needs a moment. Controls will be available again shortly.');
        }
        return response;
      } catch (error) {
        if (error instanceof SpotifyError) throw error;
        throw new SpotifyError('network', 'Couldn’t reach Spotify. Check your connection and try again.');
      } finally { clearTimeout(timer); }
    }
    function remember(body, version) {
      assertEpoch(version);
      if (typeof body.access_token !== 'string' || !body.access_token || !Number.isFinite(body.expires_in) || body.expires_in <= 0) {
        throw new SpotifyError('auth', 'Spotify didn’t finish connecting. Please connect again.');
      }
      if (body.scope && scopes.split(' ').some(scope => !body.scope.split(' ').includes(scope))) {
        throw new SpotifyError('auth', 'Playback permissions weren’t granted. Please connect again.');
      }
      const updated = { clientId, access_token: body.access_token,
        refresh_token: body.refresh_token || tokens?.refresh_token, expires_at: now() + body.expires_in * 1000 };
      if (!updated.refresh_token) throw new SpotifyError('auth', 'Spotify didn’t finish connecting. Please connect again.');
      try { storage.setItem(tokenKey, JSON.stringify(updated)); } catch {
        throw new SpotifyError('storage', 'This browser can’t save the Spotify connection. Allow site storage and try again.');
      }
      tokens = updated;
      return tokens.access_token;
    }
    async function json(response) {
      try { return await response.json(); } catch {
        throw new SpotifyError('service', 'Spotify returned an unreadable response. Please try again in a moment.');
      }
    }
    const random = length => {
      const bytes = crypto.getRandomValues(new Uint8Array(length));
      return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    };
    async function authorize() {
      const version = epoch;
      if (!validId(clientId)) throw new SpotifyError('setup', 'Add your Spotify app’s Client ID in Connection setup first.');
      const uri = new URL(redirectUri);
      if (uri.protocol !== 'https:' && !(uri.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(uri.hostname))) {
        throw new SpotifyError('setup', 'Open Setlog over HTTPS, or use 127.0.0.1 for a local test.');
      }
      if (!crypto?.subtle) throw new SpotifyError('setup', 'This browser can’t start a secure Spotify connection.');
      const verifier = random(32);
      const state = random(24);
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
      assertEpoch(version);
      const challenge = btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      try { storage.setItem(pendingKey, JSON.stringify({ verifier, state, clientId, redirectUri, created: now() })); } catch {
        throw new SpotifyError('storage', 'Allow site storage to connect Spotify.');
      }
      const url = new URL('https://accounts.spotify.com/authorize');
      url.search = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: redirectUri,
        scope: scopes, state, code_challenge_method: 'S256', code_challenge: challenge });
      return url.href;
    }
    async function finish({ code, state, error }) {
      const version = epoch;
      let pending;
      try { pending = JSON.parse(storage.getItem(pendingKey)); storage.removeItem(pendingKey); } catch {}
      if (!pending || !state || state !== pending.state || pending.clientId !== clientId || pending.redirectUri !== redirectUri
        || !Number.isFinite(pending.created) || now() - pending.created > 600000 || now() < pending.created) {
        throw new SpotifyError('auth', 'This connection link expired or couldn’t be verified. Please connect again.');
      }
      if (error) throw new SpotifyError('auth', error === 'access_denied' ? 'Connection cancelled. You can connect whenever you’re ready.' : 'Spotify couldn’t connect. Please try again.');
      if (!code) throw new SpotifyError('auth', 'Spotify didn’t return a connection code. Please try again.');
      const response = await send('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, code_verifier: pending.verifier }) });
      assertEpoch(version);
      if (!response.ok) throw new SpotifyError('auth', 'Spotify couldn’t complete the connection. Check the app’s redirect address, then connect again.');
      return remember(await json(response), version);
    }
    async function refresh() {
      if (refreshPromise) return refreshPromise;
      if (!tokens?.refresh_token) throw new SpotifyError('auth', 'Connect Spotify to control your music.');
      const version = epoch;
      const refreshToken = tokens.refresh_token;
      const promise = (async () => {
        const response = await send('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId }) });
        assertEpoch(version);
        if (!response.ok) {
          if ([400, 401, 403].includes(response.status)) { disconnect(); throw new SpotifyError('auth', 'Your Spotify connection expired. Please connect again.'); }
          throw new SpotifyError('network', 'Spotify is unavailable right now. Please try again.');
        }
        return remember(await json(response), version);
      })();
      refreshPromise = promise;
      try { return await promise; } finally { if (refreshPromise === promise) refreshPromise = null; }
    }
    async function api(path, method = 'GET', retry = true) {
      const version = epoch;
      if (!tokens) throw new SpotifyError('auth', 'Connect Spotify to control your music.');
      const token = tokens.expires_at <= now() + 30000 ? await refresh() : tokens.access_token;
      assertEpoch(version);
      const response = await send('https://api.spotify.com/v1/me/player' + path,
        { method, headers: { Authorization: 'Bearer ' + token } });
      assertEpoch(version);
      if (response.status === 401 && retry) { await refresh(); return api(path, method, false); }
      if (response.status === 401) { disconnect(); throw new SpotifyError('auth', 'Reconnect Spotify to continue.'); }
      if (response.status === 403) throw new SpotifyError('permission', 'Spotify didn’t allow this request. Check Premium, the app’s test-user list, and playback permissions.');
      if (response.status === 404) throw new SpotifyError('inactive', 'Start a song in Spotify first, then tap Refresh here.');
      if (!response.ok) throw new SpotifyError('service', 'Spotify couldn’t complete that request. Please try again.');
      if (response.status === 204 || method !== 'GET') return null;
      return json(response);
    }
    const playback = () => api('?additional_types=track,episode');
    async function command(action, player, position) {
      if (!player?.device || player.device.is_restricted) throw new SpotifyError('inactive', 'Open Spotify and start music on a controllable device first.');
      const actions = { play: ['PUT', '/play', 'resuming'], pause: ['PUT', '/pause', 'pausing'],
        next: ['POST', '/next', 'skipping_next'], previous: ['POST', '/previous', 'skipping_prev'], seek: ['PUT', '/seek', 'seeking'] };
      if (!actions[action]) throw new SpotifyError('action', 'Unknown playback control.');
      const [method, path, disallow] = actions[action];
      const disallowed = player.actions?.disallows ?? player.actions;
      if (disallowed?.[disallow]) throw new SpotifyError('restricted', 'Spotify hasn’t made this control available for the current track.');
      const params = new URLSearchParams();
      if (player.device.id) params.set('device_id', player.device.id);
      if (action === 'seek') {
        if (!Number.isFinite(position) || !Number.isFinite(player.item?.duration_ms) || player.item.duration_ms <= 0) throw new SpotifyError('action', 'This track can’t be seeked.');
        params.set('position_ms', Math.round(Math.max(0, Math.min(player.item.duration_ms, position))));
      }
      return api(path + (params.size ? '?' + params : ''), method);
    }
    return { authorize, finish, playback, command, disconnect, get connected() { return Boolean(tokens); }, get retryAt() { return retryAt; } };
  }
  return { create, validId, SpotifyError };
})();
