// Impacto IA — Service Worker v1.0
// Provides offline support and PWA capabilities

const CACHE_NAME = 'impacto-ia-v1';
const OFFLINE_URL = '/offline.html';

const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {
        // If precaching fails, continue anyway
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// ── Fetch — Network First, Cache Fallback ─────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET and browser-extension requests
  if (request.method !== 'GET' || !request.url.startsWith('http')) return;
  
  // Skip Supabase API calls (always need network)
  if (request.url.includes('supabase.co') || request.url.includes('netlify/functions')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone and cache successful responses for HTML/JS/CSS
        if (response.ok) {
          const url = new URL(request.url);
          if (['.js', '.css', '.woff2', '.png', '.svg', '.webp'].some(ext => url.pathname.endsWith(ext))) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
          }
        }
        return response;
      })
      .catch(() => {
        // Try cache fallback
        return caches.match(request).then(cached => {
          if (cached) return cached;
          // For page navigation, return root
          if (request.mode === 'navigate') {
            return caches.match('/') || new Response('Offline', { status: 503 });
          }
          return new Response('', { status: 503 });
        });
      })
  );
});

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'Impacto IA';
  const options = {
    body: data.body || 'Você tem uma nova notificação!',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
