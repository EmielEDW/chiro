const CACHE_NAME = 'chiro-bar-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.ico'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network-first for API calls, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // CRITICAL: Always use network-first for Supabase/API calls to ensure transactions go through
  // This includes all database operations, authentication, and edge functions
  if (
    url.hostname.includes('supabase') ||
    url.hostname.includes('lovableproject.com') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/rest') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/functions') ||
    request.method !== 'GET'
  ) {
    // Network-first: always try network, never serve cached API responses
    event.respondWith(
      fetch(request).catch((error) => {
        console.error('Network request failed for API call:', error);
        // For API calls, we don't want to serve stale data - throw the error
        throw error;
      })
    );
    return;
  }

  // For static assets: cache-first with network fallback
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached response, but also update cache in background
        event.waitUntil(
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, networkResponse.clone());
              });
            }
          }).catch(() => {
            // Silently fail background update
          })
        );
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(request).then((networkResponse) => {
        // Cache successful GET responses for static assets
        if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});
