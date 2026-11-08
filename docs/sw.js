// Dynamic cache-first Service Worker for QuickExam (works completely offline after first load)
const CACHE_NAME = 'quickexam-offline-v3';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Cache root, index.html, manifest, and icons immediately
      const baseAssets = [
        './',
        './index.html',
        './manifest.json',
        './icons/icon-192.svg',
        './icons/icon-512.svg',
      ];
      await cache.addAll(baseAssets);

      // Parse index.html to pre-cache hashed JS and CSS bundles so offline works immediately!
      try {
        const res = await fetch('./index.html', { cache: 'no-cache' });
        const html = await res.text();
        const assetMatches = [...html.matchAll(/(?:src|href)="(\/?assets\/[^"]+)"/g)];
        const assetUrls = assetMatches.map((m) => m[1].replace(/^\//, './'));
        if (assetUrls.length > 0) {
          await cache.addAll(assetUrls);
        }
      } catch (e) {
        console.warn('Pre-caching bundles warning:', e);
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        // Update cache in background if online, but return cached immediately
        fetch(event.request)
          .then((netRes) => {
            if (netRes && netRes.status === 200) {
              const clone = netRes.clone();
              caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If navigation request fails offline, serve cached index.html
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
          }
        });
    })
  );
});
