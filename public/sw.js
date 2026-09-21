const CACHE_NAME = 'gridsketch-cache-v1';

// We want to cache the root document, manifest, and icons immediately.
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  // Kick out the old service worker
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

self.addEventListener('activate', (event) => {
  // Claim all clients immediately so the app works offline right away
  event.waitUntil(self.clients.claim());

  // Clean up old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Stale-while-revalidate strategy for all requests to ensure fast loading 
  // while keeping the offline cache fresh in the background.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request).then((response) => {
        // Only cache successful responses for same-origin or opaque responses
        if (!response || (response.status !== 200 && response.type !== 'opaque')) {
          return response;
        }

        // Clone the response because it's a stream and can only be consumed once
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Network failed (offline). If we don't have it in cache, return a fallback or just fail.
      });

      // Return the cached response immediately if we have it, otherwise wait for network
      return cachedResponse || networkFetch;
    })
  );
});
