// VigApp service worker — minimal + safe.
// Caches only same-origin static assets and the app shell for offline use.
// Firestore, the OSM APIs, CDNs and the /api/* proxies are never touched.
const CACHE = 'vigapp-shell-v1';
const SHELL = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;               // never intercept writes / POSTs
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;      // ignore Firestore / OSM / CDNs
  if (url.pathname.startsWith('/api/')) return;     // ignore serverless proxies

  if (req.mode === 'navigate') {
    // Network-first for page loads; fall back to the cached shell when offline.
    event.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }

  if (url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/midia/') ||
      url.pathname.startsWith('/icon-')) {
    // Cache-first for immutable, hashed static assets.
    event.respondWith(
      caches.match(req).then((hit) =>
        hit || fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
      )
    );
  }
});
