const spotifyMusic = (() => {
  const view = document.querySelector('#musicView');
  const $ = id => document.querySelector('#' + id);
  const redirectUri = location.origin + location.pathname;
  const query = new URLSearchParams(location.search);
  const wasCallback = query.has('state') && (query.has('code') || query.has('error'));
  const callback = { code: query.get('code'), state: query.get('state'), error: query.get('error') };
  if (wasCallback || query.has('ubi')) {
    ['code', 'state', 'error', 'error_description', 'ubi'].forEach(key => query.delete(key));
    history.replaceState(null, '', location.pathname + (query.size ? '?' + query : '') + location.hash);
  }
  const clientId = spotifyConfig.clientId;
  let client;
  let active = false;
  let player = null;
  let receivedAt = 0;
  let poll;
  let ticker;
  let busy = false;
  let loading = false;
  let connecting = wasCallback;
  let seeking = false;
  let stale = false;
  let revision = 0;
  let pendingToggle = null;

  function newClient() {
    let session;
    try { session = sessionStorage; } catch { session = { getItem() { return null; }, removeItem() {}, setItem() { throw new Error('Storage unavailable'); } }; }
    return spotifyClient.create({ clientId, redirectUri, storage: session, fetch: window.fetch.bind(window), crypto: window.crypto });
  }
  client = newClient();
  function tell(text, error = false) {
    $('musicStatus').textContent = text;
    $('musicStatus').classList.toggle('error', error);
  }
  const clock = ms => {
    const seconds = Math.floor(Math.max(0, Number(ms) || 0) / 1000);
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  };
  function trackLink(item) {
    try {
      const url = new URL(item?.external_urls?.spotify);
      if (url.protocol === 'https:' && url.hostname === 'open.spotify.com') return url.href;
    } catch {}
    return 'https://open.spotify.com/';
  }
  function can(action) {
    const name = { previous: 'skipping_prev', next: 'skipping_next', seek: 'seeking', play: 'resuming', pause: 'pausing' }[action];
    const disallowed = player?.actions?.disallows ?? player?.actions;
    return client.connected && !connecting && !busy && !loading && !stale && Date.now() >= client.retryAt
      && Boolean(player?.device) && !player.device.is_restricted && !disallowed?.[name];
  }
  function updatePosition() {
    if (!player?.item || seeking) return;
    const duration = Number(player.item.duration_ms) || 0;
    const elapsed = Math.min(duration, (Number(player.progress_ms) || 0) + (player.is_playing && !stale ? Date.now() - receivedAt : 0));
    $('musicSeek').value = Math.max(0, elapsed);
    $('musicSeek').setAttribute('aria-valuetext', clock(elapsed) + ' of ' + clock(duration));
    $('musicElapsed').textContent = clock(elapsed);
  }
  function render() {
    const connected = client.connected;
    $('musicWelcome').hidden = connected;
    $('musicPlayer').hidden = !connected;
    $('musicDisconnect').hidden = !connected && !connecting;
    $('musicConnect').disabled = connecting;
    $('musicConnect').textContent = connecting ? 'Connecting…' : 'Connect Spotify';
    $('musicDevice').textContent = connecting ? 'Connecting…' : !connected ? 'Not connected'
      : stale ? 'Playback not updated' : player?.device?.name ? (player.is_playing ? 'Playing on ' : 'Paused on ') + player.device.name : 'Connected';
    const item = connected ? player?.item : null;
    $('musicTitle').textContent = item?.name || (player?.currently_playing_type === 'ad' ? 'Advertisement' : 'Nothing playing yet');
    $('musicArtist').textContent = item ? (item.artists?.map(artist => artist.name).join(', ') || item.show?.publisher || item.show?.name || 'Spotify')
      : 'Open Spotify and start a song, then tap Refresh.';
    $('musicExplicit').hidden = !item?.explicit;
    const href = trackLink(item);
    ['musicTrackLink', 'musicArtworkLink', 'musicOpen'].forEach(id => { $(id).href = href; });
    const images = item?.album?.images ?? item?.images ?? [];
    let image = null;
    try { const url = new URL(images[0]?.url); if (url.protocol === 'https:') image = url.href; } catch {}
    const artwork = $('musicArtwork');
    if (image) {
      if (artwork.getAttribute('src') !== image) { artwork.hidden = false; $('musicArtworkPlaceholder').setAttribute('hidden', ''); artwork.src = image; }
      artwork.alt = 'Artwork for ' + (item.name || 'the current track');
    } else {
      artwork.removeAttribute('src'); artwork.hidden = true; $('musicArtworkPlaceholder').removeAttribute('hidden');
    }
    const playing = Boolean(player?.is_playing);
    $('musicPlay').setAttribute('aria-label', playing ? 'Pause' : 'Play');
    $('musicPlayShape').setAttribute('d', playing ? 'M7 5h3v14H7V5Zm7 0h3v14h-3V5Z' : 'm8 5 11 7-11 7V5Z');
    $('musicPlay').disabled = !can(playing ? 'pause' : 'play');
    $('musicPrevious').disabled = !can('previous');
    $('musicNext').disabled = !can('next');
    const duration = Number(item?.duration_ms) || 0;
    $('musicSeek').max = Math.max(duration, 1);
    $('musicSeek').disabled = !can('seek') || !item || duration <= 0 || player?.currently_playing_type === 'ad';
    $('musicDuration').textContent = clock(duration);
    if (!item) { $('musicSeek').value = 0; $('musicElapsed').textContent = '0:00'; }
    $('musicRefresh').disabled = loading || busy || connecting || Date.now() < client.retryAt;
    view.setAttribute('aria-busy', connecting || busy);
    updatePosition();
  }
  function schedule() {
    clearTimeout(poll);
    if (active && !document.hidden && client.connected && !connecting) {
      poll = setTimeout(refreshPlayback, Math.max(pendingToggle ? 750 : 5000, client.retryAt - Date.now() + 250));
    }
  }
  async function refreshPlayback() {
    if (loading || busy || connecting || !client.connected) return;
    const version = revision;
    loading = true;
    render();
    try {
      const result = await client.playback();
      if (version !== revision) return;
      // Spotify can briefly return the state from before an accepted command.
      // Keep the immediate button/clock response until it confirms, or the grace period ends.
      if (pendingToggle && Date.now() < pendingToggle.until && (!result ||
        (result.item?.uri === player?.item?.uri && result.device?.id === player?.device?.id
          && Boolean(result.is_playing) !== pendingToggle.playing))) return;
      pendingToggle = null;
      player = result;
      receivedAt = Date.now();
      stale = false;
      tell(!result ? 'Start a song in Spotify first, then tap Refresh.' : result.device?.is_restricted
        ? 'Spotify doesn’t allow control of this device. Choose another device in Spotify.' : '');
    } catch (error) {
      if (version !== revision) return;
      stale = true;
      if (['auth', 'inactive'].includes(error.kind)) player = null;
      tell(error.message, true);
    } finally {
      if (version === revision) { loading = false; render(); schedule(); }
    }
  }
  async function command(action, position) {
    if (!can(action)) return;
    const version = revision;
    const previousPlayer = player;
    const previousReceivedAt = receivedAt;
    clearTimeout(poll);
    pendingToggle = null;
    if (action === 'pause' || action === 'play') {
      const now = Date.now();
      const progress = Math.min(Number(player.item?.duration_ms) || Infinity,
        (Number(player.progress_ms) || 0) + (player.is_playing ? now - receivedAt : 0));
      player = { ...player, progress_ms: progress, is_playing: action === 'play' };
      receivedAt = now;
      pendingToggle = { playing: action === 'play', until: Infinity };
    }
    busy = true;
    render();
    let succeeded = false;
    try {
      await client.command(action, previousPlayer, position);
      if (version !== revision) return;
      succeeded = true;
      if (pendingToggle) pendingToggle.until = Date.now() + 5000;
      tell('Updating playback…');
    } catch (error) {
      if (version !== revision) return;
      pendingToggle = null;
      player = previousPlayer;
      receivedAt = previousReceivedAt;
      tell(error.message, true);
      if (error.kind === 'inactive') player = null;
      if (['network', 'rate', 'permission', 'auth'].includes(error.kind)) stale = true;
    } finally {
      if (version === revision) {
        busy = false;
        seeking = false;
        render();
        if (succeeded) await refreshPlayback(); else schedule();
      }
    }
  }
  async function withRestAlert(playAlert) {
    // Timer alerts also run when the Music tab is closed. Read fresh playback;
    // never resume a track/device that changed during the alert.
    if (!client.connected || busy || connecting || document.hidden || Date.now() < client.retryAt) {
      await playAlert();
      return;
    }
    const version = ++revision;
    clearTimeout(poll);
    loading = false;
    busy = true;
    pendingToggle = null;
    render();
    let original = null;
    let pausedByUs = false;
    const valid = () => version === revision && client.connected;
    try {
      try {
        original = await client.playback();
        if (valid() && original?.is_playing && original.device?.id && original.item?.uri) {
          await client.command('pause', original);
          pausedByUs = true;
          if (valid()) {
            player = { ...original, is_playing: false };
            receivedAt = Date.now();
            render();
          }
          // Allow Spotify Connect's accepted pause to reach the active device.
          for (let attempt = 0; attempt < 4 && valid(); attempt++) {
            await new Promise(resolve => setTimeout(resolve, 250));
            const current = await client.playback();
            if (!current?.is_playing) break;
          }
        }
      } catch {
        // A disconnected/restricted Spotify device must never suppress the chime.
      }
      await playAlert();
    } finally {
      if (pausedByUs && valid()) {
        try {
          const current = await client.playback();
          if (valid() && current && !current.is_playing && current.device?.id === original.device.id
            && current.item?.uri === original.item.uri) await client.command('play', current);
        } catch {
          tell('Your break is over. Tap Play in Spotify to continue your music.', true);
        }
      }
      if (version === revision) {
        busy = false;
        render();
        if (active && !document.hidden) await refreshPlayback(); else schedule();
      }
    }
  }
  $('musicArtwork').onerror = () => { $('musicArtwork').hidden = true; $('musicArtworkPlaceholder').removeAttribute('hidden'); };
  $('musicConnect').onclick = async () => {
    if (!spotifyClient.validId(clientId)) {
      tell('Spotify isn’t configured for this version yet.', true);
      return;
    }
    connecting = true;
    const version = revision;
    render();
    try {
      const url = await client.authorize();
      if (version === revision) location.assign(url);
    } catch (error) {
      if (version === revision) { connecting = false; tell(error.message, true); render(); }
    }
  };
  $('musicDisconnect').onclick = () => {
    revision++;
    client.disconnect();
    clearTimeout(poll);
    clearInterval(ticker);
    player = null;
    pendingToggle = null;
    busy = loading = connecting = seeking = stale = false;
    render();
    tell('Disconnected from Setlog. Your music stays in Spotify.');
  };
  $('musicPrevious').onclick = () => command('previous');
  $('musicNext').onclick = () => command('next');
  $('musicPlay').onclick = () => command(player?.is_playing ? 'pause' : 'play');
  $('musicRefresh').onclick = refreshPlayback;
  $('musicSeek').oninput = () => { seeking = true; $('musicElapsed').textContent = clock($('musicSeek').value); };
  $('musicSeek').onchange = () => {
    const position = Number($('musicSeek').value);
    seeking = false;
    command('seek', position);
  };
  function setActive(value) {
    active = value;
    clearTimeout(poll);
    clearInterval(ticker);
    if (active && !document.hidden) {
      render();
      refreshPlayback();
      ticker = setInterval(updatePosition, 1000);
    }
  }
  document.addEventListener('visibilitychange', () => setActive(active));
  window.addEventListener('online', () => { if (active) refreshPlayback(); });
  render();
  if (wasCallback) {
    const version = revision;
    client.finish(callback).then(() => { if (version === revision) tell('Spotify connected. Start music in Spotify to use the controls.'); })
      .catch(error => { if (version === revision) tell(error.message, true); })
      .finally(() => { if (version === revision) { connecting = false; render(); setActive(active); } });
  }
  return { setActive, wasCallback, withRestAlert };
})();
