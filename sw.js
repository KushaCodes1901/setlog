const cacheName = 'setlog-offline-v59';
const home = new URL('./', self.location.href).href;
const assets = ['startup.css', 'startup.js', 'styles.css', 'install-guide.css', 'install-guide.js', 'install-steps.svg', 'install-iphone.mp4', 'install-android.mp4', 'install-iphone.jpg', 'install-android.jpg', 'install-iphone.vtt', 'install-android.vtt', 'settings.js', 'duration-picker.js', 'exercise-catalog.js', 'history-calendar.js', 'personal-records.js', 'exercise-progress.js', 'app.js', 'backup.js', 'rest-timer.js?v=standalone', 'exercise-illustrations.svg',
  'manifest.webmanifest', 'icon.png', 'icon-v2-192.png', 'icon-v2-512.png', 'apple-touch-icon-v2.png',
  'launch-1290x2796.png', 'launch-1179x2556.png', 'launch-1170x2532.png', 'launch-1284x2778.png',
  'launch-1125x2436.png', 'launch-1242x2688.png', 'launch-750x1334.png', 'launch-828x1792.png', 'launch-2796x1290.png']
  .map(path => new URL(path, home).href);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll([home, ...assets].map(url => new Request(url, { cache: 'reload' })))
  ));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('setlog-offline-') && key !== cacheName).map(key => caches.delete(key))
  )));
});

async function videoResponse(response, range) {
  if (!range || response.status !== 200) return response;
  const bytes = await response.arrayBuffer();
  const size = bytes.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
  const invalid = () => new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size, 'Accept-Ranges': 'bytes' } });
  if (!match || (!match[1] && !match[2]) || size === 0) return invalid();
  let start, end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return invalid();
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return invalid();
    end = Math.min(end, size - 1);
  }
  const headers = new Headers(response.headers);
  headers.set('Content-Type', 'video/mp4');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Range', 'bytes ' + start + '-' + end + '/' + size);
  headers.set('Content-Length', String(end - start + 1));
  headers.delete('Content-Encoding');
  return new Response(bytes.slice(start, end + 1), { status: 206, statusText: 'Partial Content', headers });
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const key = request.mode === 'navigate' ? home : request.url;
  if (key !== home && !assets.includes(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    if (new URL(key).pathname.endsWith('.mp4')) {
      // Safari probes media with bytes=0-1, including offline. Cache only complete
      // videos and synthesize the exact requested 206 response from those bytes.
      const range = request.headers.get('Range');
      const cached = await cache.match(key);
      if (cached?.status === 200) return videoResponse(cached, range);
      try {
        const headers = new Headers(request.headers);
        headers.delete('Range');
        const fullRequest = new Request(request, { headers });
        const response = await fetch(fullRequest, { cache: 'no-cache' });
        if (response.status === 200) {
          try { await cache.put(key, response.clone()); } catch {}
        }
        return videoResponse(response, range);
      } catch { return Response.error(); }
    }
    try {
      const response = await fetch(request, { cache: 'no-cache' });
      if (response.status === 200) {
        try { await cache.put(key, response.clone()); } catch {}
      }
      return response;
    } catch {
      return (await cache.match(key)) ?? Response.error();
    }
  })());
});
