/* Digital Sanctuary — PWA shell cache.
 * Same-origin files are network-first, so a fresh deployment wins online;
 * the cache is only a fallback for offline launches. Coverr API and video
 * CDN requests are cross-origin and deliberately pass through untouched.
 */
const CACHE = 'sanctuary-shell-v13';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './videos.json',
  './videos-data.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;

    if (request.mode === 'navigate') {
      const shell = (await cache.match('./index.html')) || (await cache.match('./'));
      if (shell) return shell;
    }

    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(networkFirst(request));
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'schedule-return') return;

  const deliverAt = Number(data.deliverAt) || (Date.now() + 2 * 60 * 60 * 1000);
  const title = data.title || 'Digital Sanctuary';
  const body = data.body || 'Продолжение открыто. Вернись, чтобы узнать, что дальше.';
  const delay = Math.max(0, deliverAt - Date.now());
  const options = {
    body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'sanctuary-return',
    data: { url: './' },
    renotify: false,
  };

  if ('TimestampTrigger' in self && delay > 0) {
    try {
      self.registration.showNotification(title, {
        ...options,
        showTrigger: new self.TimestampTrigger(deliverAt),
      });
      return;
    } catch (_) {
      /* TimestampTrigger может быть недоступен */
    }
  }

  if (delay <= 0) {
    self.registration.showNotification(title, options);
    return;
  }

  // Service-worker timers are best-effort; the page also keeps a fallback timer.
  setTimeout(() => {
    self.registration.showNotification(title, options);
  }, Math.min(delay, 2147483647));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus();
        return;
      }
    }
    await self.clients.openWindow('./');
  })());
});
