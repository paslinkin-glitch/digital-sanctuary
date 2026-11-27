/* Yoursanctuary — PWA shell cache (v127).
 * install() precaches only the critical shell: the app, styles, catalog and
 * manifest. Fonts and icons are cached on first use but served cache-first
 * afterwards, so they return from disk instantly instead of holding the
 * browser loading bar while the network is slow. The shell itself stays
 * network-first, so a fresh deployment wins online. Cross-origin video CDN
 * requests and the umami beacon deliberately pass through untouched.
 */
const CACHE = 'sanctuary-shell-v127';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './player.js',
  './app.js',
  './videos-data.js',
  './manifest.json',
];
const CACHE_FIRST_PATHS = [
  /^\/fonts\/[^/]+\.woff2$/i,
  /^\/(icon-[^/]+\.png|og-preview\.png|favicon\.ico|apple-touch-icon\.png)$/i,
];

function isCacheFirst(url) {
  return CACHE_FIRST_PATHS.some((pattern) => pattern.test(url.pathname));
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(SHELL.map((asset) => cache.add(asset)));
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

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return cached || Response.error();
  }
}

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
  if (url.hostname === 'cloud.umami.is' || url.hostname.endsWith('.umami.is')) return;
  // Video, posters and the audio library live on the Timeweb S3 host. Those
  // multi-megabyte GETs (and their 206 range responses) never touch this
  // worker: the browser streams them straight from the network.
  if (url.hostname === 's3.twcstorage.ru') return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(isCacheFirst(url) ? cacheFirst(request) : networkFirst(request));
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'schedule-return') return;

  const deliverAt = Number(data.deliverAt) || (Date.now() + 2 * 60 * 60 * 1000);
  const title = data.title || 'Yoursanctuary';
  const body = data.body || 'Продолжение открыто. Вернись, чтобы узнать, что дальше.';
  const delay = Math.max(0, deliverAt - Date.now());
  const options = {
    body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'sanctuary-return',
    data: { url: './?app=1' },
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
    await self.clients.openWindow('./?app=1');
  })());
});
