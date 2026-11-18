const cacheName = 'setlog-offline-v69';
const home = new URL('./', self.location.href).href;
const assets = ['assets/css/profile.css', 'assets/js/profile.js', 'assets/media/illustrations/profile-trophy.svg', 'assets/css/mobile.css', 'assets/fonts/manrope-variable.ttf', 'assets/media/illustrations/training-hero.svg', 'assets/js/home-dashboard.js', 'assets/css/startup.css', 'assets/js/startup.js', 'assets/js/theme.js', 'assets/css/themes.css', 'assets/css/styles.css', 'assets/css/install-guide.css?v=steps-only-1', 'assets/js/install-guide.js?v=visit-banner-1', 'assets/media/illustrations/install-steps.svg?v=samsung-1', 'assets/js/settings.js', 'assets/js/duration-picker.js', 'assets/js/exercise-catalog.js', 'assets/js/history-calendar.js', 'assets/js/personal-records.js', 'assets/js/exercise-progress.js', 'assets/js/exercise-timer.js', 'assets/js/app.js', 'assets/js/backup.js', 'assets/js/rest-timer.js?v=classic-chime', 'assets/media/illustrations/exercise-illustrations.svg',
  'manifest.webmanifest', 'assets/media/icons/icon.png', 'assets/media/icons/icon-v2-192.png', 'assets/media/icons/icon-v2-512.png', 'assets/media/icons/apple-touch-icon-v2.png',
  'assets/media/launch/launch-1290x2796.png', 'assets/media/launch/launch-1179x2556.png', 'assets/media/launch/launch-1170x2532.png', 'assets/media/launch/launch-1284x2778.png',
  'assets/media/launch/launch-1125x2436.png', 'assets/media/launch/launch-1242x2688.png', 'assets/media/launch/launch-750x1334.png', 'assets/media/launch/launch-828x1792.png', 'assets/media/launch/launch-2796x1290.png']
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
  // Let Safari's native media loader negotiate byte ranges directly with the host.
  if (new URL(request.url).pathname.toLowerCase().endsWith('.mp4')) return;
  const key = request.mode === 'navigate' ? home : request.url;
  if (key !== home && !assets.includes(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    try {
      const response = await fetch(request, { cache: 'no-cache' });
      if (response.status === 200 && (request.mode !== 'navigate' || response.headers.get('Content-Type')?.includes('text/html'))) {
        try { await cache.put(key, response.clone()); } catch {}
      }
      return response;
    } catch {
      return (await cache.match(key)) ?? Response.error();
    }
  })());
});
