const cacheName = 'setlog-offline-v15';
const home = new URL('./', self.location.href).href;
const assets = ['startup.css', 'startup.js', 'styles.css', 'duration-picker.js', 'exercise-catalog.js', 'history-calendar.js', 'app.js', 'backup.js', 'rest-timer.js?v=rest-tab', 'exercise-illustrations.svg',
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

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const key = request.mode === 'navigate' ? home : request.url;
  if (key !== home && !assets.includes(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    try {
      const response = await fetch(request, { cache: 'no-cache' });
      if (response.ok) {
        try { await cache.put(key, response.clone()); } catch {}
      }
      return response;
    } catch {
      return (await cache.match(key)) ?? Response.error();
    }
  })());
});
