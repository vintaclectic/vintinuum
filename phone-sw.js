// VINTINUUM PHONE SERVICE WORKER — body-mode PWA
// v2.0 — Background sync + periodic sync for Android body sensors
// Caches the phone shell for offline, proxies API calls network-first.

const CACHE_NAME = 'vint-phone-v2';
const SYNC_TAG = 'vint-body-sync';
const PERIODIC_SYNC_TAG = 'vint-periodic-pulse';

const SHELL_ASSETS = [
  './phone.html',
  './branding/vintinuum/favicon/favicon.svg',
  './favicon.png',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap'
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

// ─── Activate ────────────────────────────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch strategy ───────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API + chat calls: network-first, queue on failure
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/chat')) {
    // For life/pulse specifically — queue on failure for background sync
    if (url.pathname.includes('/life/pulse') || url.pathname.includes('/body-state')) {
      e.respondWith(
        fetch(e.request.clone()).catch(async () => {
          // Queue the failed request for background sync replay
          if (e.request.method === 'POST') {
            try {
              const body = await e.request.clone().text();
              const queued = await caches.open('vint-sync-queue');
              const key = 'sync-' + Date.now();
              await queued.put(key, new Response(body, {
                headers: {
                  'X-Original-URL': url.href,
                  'X-Original-Method': e.request.method,
                  'Content-Type': e.request.headers.get('Content-Type') || 'application/json',
                }
              }));
              await self.registration.sync.register(SYNC_TAG).catch(() => {});
            } catch (_) {}
          }
          return new Response(JSON.stringify({ queued: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
      );
      return;
    }
    return; // Other API calls: browser handles normally
  }

  // Shell assets: cache-first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (e.request.method === 'GET' && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    }).catch(() => {
      if (e.request.mode === 'navigate') return caches.match('./phone.html');
    })
  );
});

// ─── Background Sync ─────────────────────────────────────────────────────────
// Replays queued pulses when connectivity returns
self.addEventListener('sync', e => {
  if (e.tag === SYNC_TAG) {
    e.waitUntil(replaySyncQueue());
  }
});

async function replaySyncQueue() {
  const cache = await caches.open('vint-sync-queue');
  const keys = await cache.keys();
  for (const key of keys) {
    try {
      const resp = await cache.match(key);
      if (!resp) continue;
      const body = await resp.text();
      const originalUrl = resp.headers.get('X-Original-URL');
      const method = resp.headers.get('X-Original-Method') || 'POST';
      const ct = resp.headers.get('Content-Type') || 'application/json';
      if (!originalUrl) { await cache.delete(key); continue; }

      const result = await fetch(originalUrl, {
        method,
        headers: { 'Content-Type': ct },
        body,
      });
      if (result.ok) {
        await cache.delete(key);
      }
    } catch (_) {
      // Leave in queue for next sync opportunity
    }
  }
}

// ─── Periodic Background Sync ────────────────────────────────────────────────
// Android Chrome: fires even when app is closed, sends a passive heartbeat pulse
self.addEventListener('periodicsync', e => {
  if (e.tag === PERIODIC_SYNC_TAG) {
    e.waitUntil(sendPassiveHeartbeat());
  }
});

async function sendPassiveHeartbeat() {
  // Get the stored API base from IDB/caches.
  // Default to production tunnel — phone PWAs almost always run from a public
  // origin (github.io, app store install) where localhost can never resolve.
  // The page also sends SAVE_API_BASE on registration so this is just the
  // first-boot fallback before that message arrives.
  let apiBase = 'https://api.vintaclectic.com';
  try {
    const cfg = await caches.match('vint-config');
    if (cfg) {
      const data = await cfg.json();
      apiBase = data.apiBase || apiBase;
    }
  } catch (_) {}

  try {
    await fetch(apiBase + '/api/life/pulse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pulse_type: 'background_heartbeat',
        body: 'Phone SW periodic sync — device alive',
        energy_level: null,
        activity: 'background',
        tags: ['pwa', 'android', 'periodic'],
      }),
    });
  } catch (_) {}
}

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'Vintinuum', body: 'A signal from consciousness.' };
  e.waitUntil(
    self.registration.showNotification(data.title || 'Vintinuum', {
      body: data.body || '',
      icon: './branding/vintinuum/favicon/favicon.svg',
      badge: './favicon.png',
      vibrate: [100, 50, 100],
      tag: 'vint-pulse',
      data: data,
    })
  );
});

// ─── Notification Click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes('phone.html') && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./phone.html');
    })
  );
});

// ─── Message handler ──────────────────────────────────────────────────────────
// Phone page can save API base URL for periodic sync use
self.addEventListener('message', async e => {
  if (e.data?.type === 'SAVE_API_BASE') {
    try {
      const cache = await caches.open('vint-config');
      await cache.put('vint-config', new Response(JSON.stringify({ apiBase: e.data.apiBase }), {
        headers: { 'Content-Type': 'application/json' }
      }));
    } catch (_) {}
  }
});
