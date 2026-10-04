// Service Worker for IPO Applications PWA
const CACHE_NAME = 'ipo-hub-v2';
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.debug('SW pre-cache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Never intercept Inertia requests, API endpoints, or auth routes
  const isInertia = event.request.headers.get('X-Inertia');
  const acceptHeader = event.request.headers.get('Accept') || '';
  if (isInertia || acceptHeader.includes('application/json')) {
    return;
  }

  const url = new URL(event.request.url);

  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/logout') ||
    url.pathname.startsWith('/login')
  ) {
    return;
  }

  // For static build assets or icons, use Stale-While-Revalidate
  if (
    url.pathname.startsWith('/build/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});

