// Dynamic cache-first Service Worker for QuickExam (works completely offline after first load)
const CACHE_NAME = 'quickexam-offline-v4';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const baseAssets = [
        './',
        './index.html',
        './manifest.json',
        './icons/icon-192.svg',
        './icons/icon-512.svg',
      ];
      await cache.addAll(baseAssets);

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

  // Never intercept cross-origin requests (Firestore, Firebase Auth, Gemini API, Handwriting API, etc.)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
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
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
          }
        });
    })
  );
});
