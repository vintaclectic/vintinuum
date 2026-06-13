// VINTINUUM SERVICE WORKER — faux server for GitHub Pages
// Intercepts all requests, forces fresh brain.js/brain.html on every deploy,
// caches assets intelligently, and acts as a local proxy layer.

const CACHE_NAME = 'vintinuum-v20260613-0010';
const BRAIN_ASSETS = ['/vintinuum/brain.html', '/vintinuum/brain.js'];

// ── Install: pre-cache nothing (fetch-first strategy) ──
self.addEventListener('install', e => {
  self.skipWaiting(); // activate immediately, don't wait for old SW to die
});

// ── Activate: delete only OUR old caches ──
// phone-sw.js shares this scope (phone.html registers it; registering either
// replaces the other). The old "delete everything not mine" purge destroyed
// the phone's vint-sync-queue (held offline pulses), vint-config, and shell
// cache on every swap. Scope the cleanup to vintinuum-* so the two SWs can
// trade control without destroying each other's held state.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('vintinuum-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim()) // take control of all open tabs immediately
  );
});

// ── Fetch: network-first for brain.js/brain.html, cache-first for everything else ──
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Critical assets — ALWAYS network first, never serve stale
  // Includes brain.js, brain.html, all body/ scripts, genome files, and root path
  const isCritical = url.pathname.endsWith('brain.js') || url.pathname.endsWith('brain.html')
    || url.pathname.includes('/body/') || url.pathname.endsWith('genome-data.js')
    || url.pathname.endsWith('genome-bulk.js') || url.pathname === '/vintinuum/'
    || url.pathname === '/vintinuum' || url.pathname.endsWith('index.html')
    || url.pathname.endsWith('body-v3.html') || url.pathname.endsWith('body-v2.html')
    || url.pathname.endsWith('jarvis.html') || url.pathname.endsWith('.html');
  if (isCritical) {
    e.respondWith(
      fetch(e.request.url.split('?')[0] + '?_sw=' + CACHE_NAME, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      }).then(res => {
        // Clone and cache the fresh response
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => {
        // Network failed — serve from cache as fallback
        return caches.match(e.request);
      })
    );
    return;
  }

  // Static assets (fonts, icons, etc.) — cache-first (GET only; cache.put throws on POST)
  if (url.origin === location.origin && e.request.method === 'GET') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Everything else (API calls, YouTube, etc.) — pass through, never cache
  // e.respondWith not called = browser handles normally
});

// ── Message: force update on demand ──
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
