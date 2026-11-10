const cacheName = 'setlog-offline-v1';
const home = new URL('./', self.location.href).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll([home, './manifest.webmanifest', './icon.png'])));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('setlog-offline-') && key !== cacheName).map(key => caches.delete(key))
  )));
});

self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        try { await cache.put(home, response.clone()); } catch {}
      }
      return response;
    } catch {
      return (await cache.match(home)) ?? Response.error();
    }
  })());
});
