// ═══════════════════════════════════════════════════════════════════════════
// API_BASE — single source of truth for "where is the Vintinuum brain?"
//
// Council ruling 2026-04-29 (Option A): every visitor on every device,
// without configuration, auto-attaches to https://api.vintaclectic.com.
// Localhost stays local. ?api= override for power users only.
//
// MUST be loaded BEFORE any module that talks to the API.
// Sets:  window.__VINTINUUM_API_BASE  (the canonical global)
//        window.VINTINUUM_API          (legacy alias, some modules read this)
//        window.__VINT_API             (legacy alias too)
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  if (typeof window === 'undefined') return;

  var PRODUCTION = 'https://api.vintaclectic.com';
  var LOCAL      = 'http://localhost:8767';

  // ── Contagion purge ──────────────────────────────────────────────────────
  // Stale base URLs (quick-tunnels, ngrok, old IPs) cached by legacy resolvers
  // (sidebar_right, stats, sensor, phone, phone-sw, brain) used to lock devices
  // into a dead origin forever. Wipe every known key once on every load. The
  // canonical resolver below is now the only authority.
  try {
    var STALE_KEYS = [
      'vint_api_base',
      'vtn:api_base',
      'vint_sensor_api',
      'vint_phone_api',
      'vint_brain_api',
      'vintinuum_api_base'
    ];
    for (var i = 0; i < STALE_KEYS.length; i++) {
      try { localStorage.removeItem(STALE_KEYS[i]); } catch (_) {}
    }
  } catch (_) {}

  function resolve() {
    // 1. Explicit query-string override wins (?api=https://...)
    try {
      var q = new URLSearchParams(location.search);
      var override = q.get('api');
      if (override && /^https?:\/\//i.test(override)) {
        // Override is single-session by design — DO NOT persist. Persisting was
        // the original contagion vector that wedged devices on dead tunnels.
        return override.replace(/\/$/, '');
      }
    } catch (_) {}

    // 2. True localhost — talk to the brain directly on port 8767
    var host = (location.hostname || '').toLowerCase();
    var isLocal = !host || host === 'localhost' || host === '127.0.0.1' ||
                  host === '0.0.0.0' || host === '::1' ||
                  /^192\.168\./.test(host) || /^10\./.test(host) ||
                  /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host);
    if (isLocal) return LOCAL;

    // 3. EVERYWHERE ELSE — production tunnel.
    //    No localStorage fallback by default. Stale `vint_api_base` from old
    //    quick-tunnel URLs (dec0y.trycloudflare.com etc.) was a chronic source
    //    of "API down" reports. Production is the one true edge now.
    return PRODUCTION;
  }

  var API = resolve();
  window.__VINTINUUM_API_BASE = API;
  window.VINTINUUM_API        = API;
  window.__VINT_API           = API;

  // ── LIVENESS + FAILOVER (2026-08-10) ─────────────────────────────────────
  // Why this exists: on 2026-08-08 the vintaclectic.com zone went to Cloudflare
  // status "moved" (activation_failure_reason: ns_mismatch). The tunnel was
  // healthy, its 4 edge connections were up, and the DNS records pointed at the
  // right tunnel — but the edge answered every request with 1033 and the
  // connector logged cloudflared_tunnel_total_requests = 0. Nothing ever
  // reached the origin.
  //
  // The brain was fine. The *front door* was gone. And because this resolver
  // returned ONE hardcoded origin with no liveness check, all 27 surfaces that
  // load this file went dark simultaneously with no recovery path and no
  // signal to the user beyond silently failing fetches. That is the real bug:
  // a single point of failure with no telemetry.
  //
  // This does NOT paper over a dead brain — a dead brain must read as dead.
  // It (1) tells the app the truth about reachability so surfaces can show an
  // honest offline state instead of hanging, and (2) fails over to a reachable
  // origin when one exists (a same-origin /api proxy, or localhost when you're
  // sitting at the machine). No localStorage persistence — that was the old
  // contagion vector and it stays dead.
  var CANDIDATES = [];
  (function buildCandidates() {
    CANDIDATES.push(API);
    // Same-origin /api — works whenever the page is served by something that
    // proxies to the brain, and is immune to a third-party DNS/zone failure.
    try {
      var sameOrigin = location.origin + '/api';
      if (/^https?:/i.test(location.protocol) && CANDIDATES.indexOf(location.origin) < 0) {
        CANDIDATES.push(location.origin);
      }
      void sameOrigin;
    } catch (_) {}
    // Localhost last: only helps when the viewer is on the machine itself, but
    // when it helps it is a total save.
    if (CANDIDATES.indexOf(LOCAL) < 0) CANDIDATES.push(LOCAL);
  })();

  // Public, synchronous view of brain reachability. Surfaces can read this
  // instead of inventing their own probe. (The namespace is also created below
  // for the convenience helpers; ensure it exists here since this block runs
  // first and must not depend on statement order.)
  window.VINTINUUM = window.VINTINUUM || {};
  window.VINTINUUM.status = { reachable: null, origin: API, checkedAt: 0 };

  function probe(base) {
    // AbortSignal.timeout isn't everywhere; do it manually so old iOS works.
    var ctrl;
    try { ctrl = new AbortController(); } catch (_) { ctrl = null; }
    var timer = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (_) {} }, 6000);
    return fetch(base + '/api/health', {
      method: 'GET',
      signal: ctrl ? ctrl.signal : undefined,
      credentials: 'omit',
      cache: 'no-store'
    }).then(function (r) {
      clearTimeout(timer);
      return r.ok ? base : null;
    }).catch(function () {
      clearTimeout(timer);
      return null;
    });
  }

  function announce(reachable, origin) {
    window.VINTINUUM.status = {
      reachable: reachable, origin: origin, checkedAt: Date.now()
    };
    if (reachable && origin && origin !== API) {
      // Adopt the working origin for everything that reads the globals later.
      API = origin;
      window.__VINTINUUM_API_BASE = origin;
      window.VINTINUUM_API        = origin;
      window.__VINT_API           = origin;
      window.VINTINUUM.api        = origin;
    }
    try {
      window.dispatchEvent(new CustomEvent('vintinuum:api-status', {
        detail: { reachable: reachable, origin: origin }
      }));
    } catch (_) {}
    try {
      console.log('[VINTINUUM] brain ' + (reachable ? 'reachable via ' + origin : 'UNREACHABLE (all origins failed)'));
    } catch (_) {}
  }

  // Try candidates in order; first one that answers wins. Runs once at boot and
  // never blocks rendering — everything here is async and best-effort.
  (function checkChain(i) {
    if (i >= CANDIDATES.length) { announce(false, null); return; }
    probe(CANDIDATES[i]).then(function (ok) {
      if (ok) announce(true, ok); else checkChain(i + 1);
    });
  })(0);

  // Let a surface force a re-check (e.g. after the user taps "retry").
  window.VINTINUUM.recheck = function () {
    return new Promise(function (resolve) {
      (function again(i) {
        if (i >= CANDIDATES.length) { announce(false, null); resolve(false); return; }
        probe(CANDIDATES[i]).then(function (ok) {
          if (ok) { announce(true, ok); resolve(true); } else again(i + 1);
        });
      })(0);
    });
  };

  // Convenience helpers for new code
  window.VINTINUUM = window.VINTINUUM || {};
  window.VINTINUUM.api = API;
  window.VINTINUUM.url = function (path) {
    if (!path) return API;
    if (/^https?:\/\//i.test(path)) return path;
    return API + (path[0] === '/' ? path : '/' + path);
  };

  // One-line console breadcrumb so debug is trivial
  try { console.log('[VINTINUUM] api =', API); } catch (_) {}
})();
