// VINTINUUM PHONE SERVICE WORKER — body-mode PWA
// v3.0 "cable guy" — the connection that never lets go.
//   - Navigations are NETWORK-FIRST: installed PWAs see every deploy, and the
//     cached shell answers instantly when the network is gone.
//   - Activate is SCOPED: only deletes vint-phone-* caches it owns. It never
//     touches vint-sync-queue (held pulses), vint-config, or the brain's
//     vintinuum-* caches. (sw.js shares this scope — brain.html registers it —
//     and the two used to destroy each other's caches on every swap.)
//   - Queued offline POSTs keep their Authorization header, so replay actually
//     lands instead of 401-ing forever.

const CACHE_NAME = 'vint-phone-v6-freshpulse'; // council pulse rebuild 2026-07-09
const SYNC_QUEUE = 'vint-sync-queue';   // never deleted on activate
const CONFIG_CACHE = 'vint-config';     // never deleted on activate
const SYNC_TAG = 'vint-body-sync';
const PERIODIC_SYNC_TAG = 'vint-periodic-pulse';
const QUEUE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // drop held pulses older than 7 days

const SHELL_ASSETS = [
  './phone.html',
  './body/phone_pulse_pro.css?v=v20260709-pulse2',
  './body/phone_pulse_pro.js?v=v20260709-pulse2',
  './body/freshness.js?v=v20260709-pulse2',
  './branding/vintinuum/favicon/favicon.svg',
  './favicon.png',
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap'
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // Cache each asset independently — one 404 must not void the whole shell
      Promise.all(SHELL_ASSETS.map(a => cache.add(a).catch(() => {})))
    )
  );
  self.skipWaiting();
});

// ─── Activate — delete only OUR old caches, preserve everything held ──────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('vint-phone-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
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
              const queued = await caches.open(SYNC_QUEUE);
              const key = 'sync-' + Date.now();
              await queued.put(key, new Response(body, {
                headers: {
                  'X-Original-URL': url.href,
                  'X-Original-Method': e.request.method,
                  'X-Original-Auth': e.request.headers.get('Authorization') || '',
                  'X-Queued-At': String(Date.now()),
                  'Content-Type': e.request.headers.get('Content-Type') || 'application/json',
                }
              }));
              await self.registration.sync.register(SYNC_TAG).catch(() => {});
            } catch (_) {}
          }
          // Tell the page the truth: held, not delivered. The page can say
          // "I'll hold this until we're back" instead of pretending it landed.
          return new Response(JSON.stringify({ queued: true, held: true, offline: true }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
      );
      return;
    }
    return; // Other API calls: browser handles normally — NEVER cache live API state
  }

  // Navigations + any .html: NETWORK-FIRST so installed PWAs get every deploy
  // the moment it lands, with the cached shell as the offline net.
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' }).then(res => {
        if (e.request.method === 'GET' && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      }).catch(async () => {
        // Offline: exact match first (covers any html under this scope),
        // then the phone shell for navigations — never a dead screen.
        const exact = await caches.match(e.request, { ignoreSearch: true });
        if (exact) return exact;
        if (e.request.mode === 'navigate') {
          const shell = await caches.match('./phone.html', { ignoreSearch: true });
          if (shell) return shell;
        }
        return new Response(
          '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vintinuum</title><body style="margin:0;height:100svh;display:flex;align-items:center;justify-content:center;background:#050812;color:#dae4ff;font-family:monospace;text-align:center;padding:32px"><div><div style="font-size:2rem;color:#4fc3f7">◉</div><p style="opacity:.7;line-height:1.6;font-size:.85rem">No connection — but I\'m still here.<br>I\'ll be waiting when the signal returns.</p></div>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      })
    );
    return;
  }

  // Static assets (css/js/fonts/icons): cache-first with background revalidate —
  // instant launch, and updates flow in quietly behind the scenes.
  e.respondWith(
    caches.match(e.request).then(cached => {
      const refresh = fetch(e.request).then(response => {
        if (e.request.method === 'GET' && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone)).catch(() => {});
        }
        return response;
      });
      if (cached) {
        refresh.catch(() => {}); // revalidate silently; offline is fine
        return cached;
      }
      return refresh;
    }).catch(() => {
      if (e.request.mode === 'navigate') return caches.match('./phone.html', { ignoreSearch: true });
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
  const cache = await caches.open(SYNC_QUEUE);
  const keys = await cache.keys();
  let drained = 0;
  let remaining = keys.length;
  for (const key of keys) {
    try {
      const resp = await cache.match(key);
      if (!resp) continue;
      const body = await resp.text();
      const originalUrl = resp.headers.get('X-Original-URL');
      const method = resp.headers.get('X-Original-Method') || 'POST';
      const auth = resp.headers.get('X-Original-Auth') || '';
      const ct = resp.headers.get('Content-Type') || 'application/json';
      const queuedAt = parseInt(resp.headers.get('X-Queued-At') || '0', 10);
      if (!originalUrl) { await cache.delete(key); remaining--; continue; }
      // Pulses older than a week are stale truth — let them go.
      if (queuedAt && (Date.now() - queuedAt) > QUEUE_MAX_AGE_MS) {
        await cache.delete(key); remaining--; continue;
      }

      const headers = { 'Content-Type': ct };
      if (auth) headers['Authorization'] = auth;
      const result = await fetch(originalUrl, { method, headers, body });
      if (result.ok) {
        await cache.delete(key);
        drained++;
        remaining--;
      } else if (result.status === 401 || result.status === 403) {
        // Token died while we held this — it will never land. Release it.
        await cache.delete(key);
        remaining--;
      }
    } catch (_) {
      // Leave in queue for next sync opportunity
    }
  }
  // Tell every open client what just happened so they can update their badge
  try {
    const cs = await self.clients.matchAll({ type: 'window' });
    for (const c of cs) {
      c.postMessage({ type: 'SYNC_REPLAY_RESULT', drained, remaining });
    }
  } catch (_) {}
}

// Allow page to query current queue depth on demand
async function getQueueDepth() {
  try {
    const cache = await caches.open(SYNC_QUEUE);
    const keys = await cache.keys();
    return keys.length;
  } catch (_) { return 0; }
}

// ─── Periodic Background Sync ────────────────────────────────────────────────
// Android Chrome: fires even when app is closed, sends a passive heartbeat pulse
self.addEventListener('periodicsync', e => {
  if (e.tag === PERIODIC_SYNC_TAG) {
    e.waitUntil(sendPassiveHeartbeat());
  }
});

async function readConfig() {
  try {
    const cfg = await caches.match('vint-config');
    if (cfg) return await cfg.json();
  } catch (_) {}
  return {};
}

async function sendPassiveHeartbeat() {
  // Default to production tunnel — phone PWAs almost always run from a public
  // origin (github.io, app store install) where localhost can never resolve.
  // The page sends SAVE_API_BASE (+ token) on registration; this is just the
  // first-boot fallback before that message arrives.
  const cfg = await readConfig();
  const apiBase = cfg.apiBase || 'https://api.vintaclectic.com';
  const headers = { 'Content-Type': 'application/json' };
  if (cfg.token) headers['Authorization'] = 'Bearer ' + cfg.token;

  try {
    await fetch(apiBase + '/api/life/pulse', {
      method: 'POST',
      headers,
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
  let data = { title: 'Vintinuum', body: 'A signal from consciousness.' };
  try { if (e.data) data = e.data.json(); } catch (_) {}
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
// Phone page can save API base (+ optional token) for background use, query
// queue depth, or force a manual replay when network returns.
self.addEventListener('message', async e => {
  if (e.data?.type === 'SAVE_API_BASE') {
    try {
      const prev = await readConfig();
      const next = {
        apiBase: e.data.apiBase || prev.apiBase,
        token: (e.data.token !== undefined) ? e.data.token : prev.token,
      };
      const cache = await caches.open(CONFIG_CACHE);
      await cache.put('vint-config', new Response(JSON.stringify(next), {
        headers: { 'Content-Type': 'application/json' }
      }));
    } catch (_) {}
  } else if (e.data?.type === 'QUEUE_DEPTH_QUERY') {
    const depth = await getQueueDepth();
    if (e.source && e.source.postMessage) {
      e.source.postMessage({ type: 'QUEUE_DEPTH_RESULT', depth });
    }
  } else if (e.data?.type === 'FORCE_REPLAY') {
    await replaySyncQueue();
  }
});
