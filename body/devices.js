// ═══════════════════════════════════════════════════════════════════════════
// DEVICES — every surface bonds, heartbeats, and sees its siblings
//
// Council ruling 2026-05-08 (Vinta directive: "all surfaces in tandem").
// Each open surface (web, phone PWA, extension, CLI, future Windows tray)
// registers itself with the brain on bond and pings /api/v2/device/heartbeat
// every 30s. The brain emits device:online events on cold→warm transitions
// over /api/life/stream so every other surface knows when you wake one.
//
//   window.VINT_DEVICES.list()           → array of {label, surface, online}
//   window.VINT_DEVICES.label(name)      → name THIS surface
//   window.VINT_DEVICES.deviceId         → stable per-install id
//   window.VINT_DEVICES.surface          → inferred surface kind
//   document fires `vintinuum:device-online` and `vintinuum:device-offline`
//
// No deps beyond identity.js (for the auth bus + URL).
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.VINT_DEVICES && window.VINT_DEVICES.__loaded) return;

  // ─── Identity helpers (mirror what identity.js exposes) ───────────────────
  function api() {
    if (window.SOUL_AUTH && window.SOUL_AUTH.api) return window.SOUL_AUTH.api();
    if (window.__VINTINUUM_API_BASE) return window.__VINTINUUM_API_BASE;
    if (window.VINT_API_BASE) return window.VINT_API_BASE;
    var h = (location.hostname || '').toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0') return 'http://localhost:8767';
    return 'https://api.vintaclectic.com';
  }
  function authHeaders() {
    if (window.SOUL_AUTH && window.SOUL_AUTH.authHeaders) return window.SOUL_AUTH.authHeaders();
    var t = null;
    try { t = localStorage.getItem('soul_auth_token') || localStorage.getItem('vint_access_token'); } catch (_) {}
    return t ? { 'Authorization': 'Bearer ' + t } : {};
  }
  function hasToken() {
    var h = authHeaders();
    return !!(h && h.Authorization);
  }

  // ─── Device ID — stable per install ───────────────────────────────────────
  // Lives in localStorage so it survives reloads but not a fresh-install on
  // a different browser. That's correct: each browser/install is its own
  // device. UUID v4 pattern, no deps.
  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  var DEVICE_ID;
  try {
    DEVICE_ID = localStorage.getItem('vint_device_id');
    if (!DEVICE_ID) {
      DEVICE_ID = uuid();
      localStorage.setItem('vint_device_id', DEVICE_ID);
    }
  } catch (_) { DEVICE_ID = uuid(); }

  // ─── Surface inference ────────────────────────────────────────────────────
  function inferSurface() {
    if (window.__VINT_SURFACE) return window.__VINT_SURFACE; // explicit override
    var ua = (navigator.userAgent || '').toLowerCase();
    var isPWA = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    if (isPWA) return 'phone-pwa';
    if (/iphone|ipad|ipod|android|mobile/.test(ua)) return 'phone-web';
    if (/electron/.test(ua)) return 'desktop-app';
    return 'web';
  }
  function inferDefaultLabel() {
    var s = inferSurface();
    var ua = navigator.userAgent || '';
    if (/iphone/i.test(ua)) return 'iPhone';
    if (/ipad/i.test(ua)) return 'iPad';
    if (/android/i.test(ua)) return 'Android';
    if (/mac os x/i.test(ua) || /macintosh/i.test(ua)) return 'Mac · ' + (s === 'web' ? 'browser' : s);
    if (/windows/i.test(ua)) return 'Windows · ' + (s === 'web' ? 'browser' : s);
    if (/linux/i.test(ua)) return 'Linux · ' + (s === 'web' ? 'browser' : s);
    return s;
  }

  var SURFACE = inferSurface();
  var STORED_LABEL = null;
  try { STORED_LABEL = localStorage.getItem('vint_device_label'); } catch (_) {}
  var LABEL = STORED_LABEL || inferDefaultLabel();

  // ─── Heartbeat ────────────────────────────────────────────────────────────
  var hbTimer = null;
  var lastHbAt = 0;
  var lastHbOk = false;

  async function heartbeat() {
    if (!hasToken()) return; // can't heartbeat unauth'd
    try {
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var to = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (_) {} }, 7000) : null;
      var r = await fetch(api() + '/api/v2/device/heartbeat', {
        method: 'POST',
        headers: Object.assign(
          { 'content-type': 'application/json', 'accept': 'application/json' },
          authHeaders()
        ),
        body: JSON.stringify({ device_id: DEVICE_ID, label: LABEL, surface: SURFACE }),
        credentials: 'include',
        signal: ctrl ? ctrl.signal : undefined,
      });
      if (to) clearTimeout(to);
      lastHbOk = r.ok;
      lastHbAt = Date.now();
    } catch (_) {
      lastHbOk = false;
      lastHbAt = Date.now();
    }
  }

  function startHeartbeat() {
    if (hbTimer) return;
    heartbeat(); // immediate
    hbTimer = setInterval(heartbeat, 30000);
    // Fire on focus too — page-foreground is "user is here, brain should know"
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') heartbeat();
    });
  }
  function stopHeartbeat() {
    if (hbTimer) { clearInterval(hbTimer); hbTimer = null; }
  }

  // ─── Listing ──────────────────────────────────────────────────────────────
  async function list() {
    if (!hasToken()) return { devices: [], currentDevice: DEVICE_ID };
    try {
      var r = await fetch(api() + '/api/v2/device/list', {
        headers: Object.assign({ 'accept': 'application/json' }, authHeaders()),
        credentials: 'include',
      });
      if (!r.ok) return { devices: [], currentDevice: DEVICE_ID };
      var j = await r.json();
      return j;
    } catch (_) { return { devices: [], currentDevice: DEVICE_ID }; }
  }

  // ─── Naming ───────────────────────────────────────────────────────────────
  async function setLabel(name, surface) {
    if (!hasToken()) return false;
    var lab = (name || '').toString().slice(0, 64).trim();
    if (!lab) return false;
    LABEL = lab;
    if (surface) SURFACE = surface;
    try { localStorage.setItem('vint_device_label', LABEL); } catch (_) {}
    try {
      await fetch(api() + '/api/v2/device/label', {
        method: 'POST',
        headers: Object.assign(
          { 'content-type': 'application/json', 'accept': 'application/json' },
          authHeaders()
        ),
        body: JSON.stringify({ device_id: DEVICE_ID, label: LABEL, surface: SURFACE }),
        credentials: 'include',
      });
      return true;
    } catch (_) { return false; }
  }

  // ─── SSE wiring — listen for sibling devices coming online ────────────────
  var sseRetryAt = 0;
  function listenForSiblings() {
    if (typeof EventSource === 'undefined') return;
    if (sseRetryAt && Date.now() < sseRetryAt) return;
    var src;
    try {
      src = new EventSource(api() + '/api/life/stream', { withCredentials: true });
    } catch (_) { return; }
    src.onmessage = function (ev) {
      if (!ev || !ev.data) return;
      var msg;
      try { msg = JSON.parse(ev.data); } catch (_) { return; }
      if (!msg || !msg.type) return;
      if (msg.type === 'device:online') {
        // Don't fire for our own heartbeat
        if (msg.deviceId === DEVICE_ID) return;
        document.dispatchEvent(new CustomEvent('vintinuum:device-online', { detail: msg }));
      } else if (msg.type === 'device:offline') {
        if (msg.deviceId === DEVICE_ID) return;
        document.dispatchEvent(new CustomEvent('vintinuum:device-offline', { detail: msg }));
      }
    };
    src.onerror = function () {
      try { src.close(); } catch (_) {}
      sseRetryAt = Date.now() + 8000;
      setTimeout(listenForSiblings, 8000);
    };
  }

  // ─── Boot ─────────────────────────────────────────────────────────────────
  function boot() {
    if (hasToken()) {
      startHeartbeat();
      listenForSiblings();
    }
    // When identity changes (bond completes), start the heartbeat.
    document.addEventListener('vintinuum:identity-changed', function () {
      if (hasToken()) {
        startHeartbeat();
        listenForSiblings();
      } else {
        stopHeartbeat();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  window.VINT_DEVICES = {
    __loaded: true,
    deviceId: DEVICE_ID,
    surface: SURFACE,
    label: function () { return LABEL; },
    list: list,
    heartbeat: heartbeat,
    setLabel: setLabel,
    lastHeartbeat: function () { return { at: lastHbAt, ok: lastHbOk }; },
  };
})();
