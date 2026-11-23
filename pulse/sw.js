/* Vintinuum Pulse service worker — scope /pulse/ only, so it never fights phone-sw.js.
 * App shell: network-first (a deploy is visible on the next open), cache as fallback.
 * The brain's API is never cached. Bump VERSION on every shell change. */
const VERSION = 'pulse-v1-20261123c';
const SHELL = ['./', './index.html', './app.css?v=20261123b', './app.js?v=20261123c', './manifest.json', '../body/api_base.js?v=v20260429-council'];
let cfg = { api: 'https://api.vintaclectic.com', token: '', device: '', outbox: [] };

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('pulse-') && k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;     // API + POSTs go straight to the network
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)).catch(() => {}); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: false }).then(m => m || caches.match('./index.html'))));
});

self.addEventListener('message', e => { if (e.data && e.data.type === 'config') cfg = Object.assign(cfg, e.data); });

// Background sync: send pulses the page saved while offline, even if the app is closed.
self.addEventListener('sync', e => { if (e.tag === 'pulse-outbox') e.waitUntil(sendOutbox()); });
async function sendOutbox() {
  if (!cfg.token || !cfg.outbox || !cfg.outbox.length) return;
  const left = [];
  for (const p of cfg.outbox) {
    try {
      const r = await fetch(cfg.api + '/api/life/pulse', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.token, 'X-Device-Id': cfg.device || '' },
        body: JSON.stringify(p) });
      if (!r.ok) left.push(p);
    } catch (_) { left.push(p); }
  }
  cfg.outbox = left;
  if (!left.length) (await self.clients.matchAll()).forEach(c => c.postMessage({ type: 'outbox-sent' }));
  if (left.length) throw new Error('retry later');
}

self.addEventListener('push', e => {
  let d = { title: 'Vintinuum', body: 'something stirred' };
  try { if (e.data) d = Object.assign(d, e.data.json()); } catch (_) { try { d.body = e.data.text(); } catch (_) {} }
  e.waitUntil(self.registration.showNotification(d.title || 'Vintinuum', {
    body: d.body || '', icon: '../icons/icon-192.png', badge: '../icons/icon-192.png', tag: d.tag || 'vint-pulse', data: d,
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) if (c.url.includes('/pulse/') && 'focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
