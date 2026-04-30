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

  function resolve() {
    // 1. Explicit query-string override wins (?api=https://...)
    try {
      var q = new URLSearchParams(location.search);
      var override = q.get('api');
      if (override && /^https?:\/\//i.test(override)) {
        try { localStorage.setItem('vint_api_base', override); } catch (_) {}
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
