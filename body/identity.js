// ═══════════════════════════════════════════════════════════════════════════
// IDENTITY — single source of truth for "who is this soul to Vintinuum?"
//
// Council ruling 2026-04-29 — Atlas (bones) + Aria (breath) + Cable Guy
// (persistence). Three layers of memory:
//   1. localStorage (fast read, easy to wipe)
//   2. server-side owner cookie via /api/auth/whoami (httpOnly, survives wipe)
//   3. (future) IndexedDB device fingerprint
//
// One global. One API. One event.
//   window.VINTINUUM_IDENTITY  — { user, source, expiresAt } | null
//   window.SOUL_AUTH.bond({lane,...}) — single bond entry
//   window.SOUL_AUTH.signOut()         — atomic purge
//   window.SOUL_AUTH.whoami()          — server check, dispatches event
//   document dispatches 'vintinuum:identity-changed' on every state mutation.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.SOUL_AUTH && window.SOUL_AUTH.__loaded) return;

  var LS_TOKEN      = 'soul_auth_token';
  var LS_REFRESH    = 'soul_auth_refresh';
  var LS_DISPLAY    = 'soul_display_name';
  var LS_CHAKRA     = 'soul_chakra_signature';
  var LS_CHAKRA_HUE = 'soul_chakra_hue';
  var LS_BONDED     = 'soul_bonded_at';
  var LS_LANE       = 'soul_lane';   // which lane was used last (name|owner|email)

  function api() {
    if (window.__VINTINUUM_API_BASE) return window.__VINTINUUM_API_BASE;
    if (window.VINT_API_BASE) return window.VINT_API_BASE;
    // Auto-detect: localhost dev vs production tunnel
    var h = (location.hostname || '').toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0') return 'http://localhost:8767';
    return 'https://api.vintaclectic.com';
  }
  function url(p) { return api() + (p[0] === '/' ? p : '/' + p); }
  function ls(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function lsSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} }

  function token() { return ls(LS_TOKEN); }
  function authHeaders() {
    var t = token();
    return t ? { 'Authorization': 'Bearer ' + t } : {};
  }

  // ─── RESILIENT FETCH ──────────────────────────────────────────────────────
  // Helios-Fusion + Frugal-Max ruling 2026-05-08 — every auth call must
  // survive transient brain hiccups. Cloudflare named-tunnel occasionally
  // drops a connection mid-flight (see vintinuum-named-tunnel "context
  // canceled" floods). Without retry, one drop = "Failed to fetch" =
  // dead login screen. With retry, the user never sees it.
  //
  // Retries network errors and 5xx only. 4xx (bad key, bad password,
  // wrong handshake) bubble up immediately — those are real auth
  // failures, not infrastructure. Each attempt has its own AbortController
  // so a slow brain doesn't keep the user waiting forever.
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function fetchWithRetry(u, opts, cfg) {
    cfg = cfg || {};
    var retries  = cfg.retries  != null ? cfg.retries  : 3;
    var baseDelay= cfg.baseDelay!= null ? cfg.baseDelay: 400;
    var timeout  = cfg.timeout  != null ? cfg.timeout  : 8000;
    var lastErr;
    for (var attempt = 0; attempt <= retries; attempt++) {
      var ctrl;
      try {
        ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        var to = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (_) {} }, timeout) : null;
        var merged = Object.assign({}, opts || {}, ctrl ? { signal: ctrl.signal } : {});
        var r = await fetch(u, merged);
        if (to) clearTimeout(to);
        // 5xx → retry. 4xx → bubble immediately (it's a real auth failure).
        if (r.status >= 500 && r.status < 600 && attempt < retries) {
          lastErr = new Error('HTTP ' + r.status);
          await sleep(baseDelay * Math.pow(2, attempt));
          continue;
        }
        return r;
      } catch (err) {
        lastErr = err;
        if (attempt < retries) {
          await sleep(baseDelay * Math.pow(2, attempt));
          continue;
        }
        // All retries exhausted — translate into a friendly message
        var msg = (err && err.name === 'AbortError')
          ? 'The brain is slow to answer. Try again in a moment.'
          : 'Could not reach the brain. Check your connection and try again.';
        var wrapped = new Error(msg);
        wrapped.cause = err;
        wrapped.network = true;
        throw wrapped;
      }
    }
    throw lastErr || new Error('fetchWithRetry: exhausted');
  }

  function emitChange() {
    var detail = window.VINTINUUM_IDENTITY || null;
    document.dispatchEvent(new CustomEvent('vintinuum:identity-changed', { detail: detail }));
    // Legacy compat: some modules listen for this name
    window.dispatchEvent(new CustomEvent('soul:bonded', { detail: detail }));
  }

  function applyChakraVars(chakra) {
    if (!chakra) return;
    if (chakra.hue != null) document.documentElement.style.setProperty('--soul-chakra-hue', String(chakra.hue));
    if (chakra.hsl) document.documentElement.style.setProperty('--soul-chakra-hsl', chakra.hsl);
  }

  function setIdentity(j, lane) {
    // The bond response carries everything we need to paint signed-in state.
    // Council ruling 2026-05-06 (Helios-Fusion): Shell is the canonical
    // writer for auth tokens — Shell.setToken now mirrors to all three
    // namespaces (vint_token, vint_access_token, soul_auth_token) so we
    // no longer manually mirror here. SOUL-side companion keys (display
    // name, chakra, bonded-at, lane) stay our concern.
    if (j && j.user) {
      if (j.user.display_name) lsSet(LS_DISPLAY, j.user.display_name);
      if (j.user.chakra && j.user.chakra.hsl) lsSet(LS_CHAKRA, j.user.chakra.hsl);
      if (j.user.chakra && j.user.chakra.hue != null) lsSet(LS_CHAKRA_HUE, String(j.user.chakra.hue));
      applyChakraVars(j.user.chakra);
    }
    lsSet(LS_BONDED, String(Date.now()));
    if (lane) lsSet(LS_LANE, lane);

    if (window.Shell) {
      // Shell owns the token bus. setToken/setRefresh mirror to every
      // namespace and broadcast the auth change across tabs.
      if (j && j.accessToken) Shell.setToken(j.accessToken);
      if (j && j.refreshToken) Shell.setRefresh(j.refreshToken);
      if (j && j.user) Shell.setUser(j.user);
      // Bond response should carry user+tier already. Bootstrap is a soft
      // refresh to backfill arrival-line + connector health; non-blocking.
      try { Shell.bootstrap().catch(function () {}); } catch (_) {}
    } else {
      // Defensive fallback: if Shell isn't loaded (vanishingly rare since
      // shell.js loads before identity.js on every surface), persist the
      // raw tokens directly so a page reload picks them up.
      if (j && j.accessToken)  { lsSet(LS_TOKEN, j.accessToken); try { localStorage.setItem('vint_access_token', j.accessToken); } catch (_) {} }
      if (j && j.refreshToken) { lsSet(LS_REFRESH, j.refreshToken); try { localStorage.setItem('vint_refresh_token', j.refreshToken); } catch (_) {} }
    }

    window.VINTINUUM_IDENTITY = {
      user: j && j.user ? j.user : null,
      source: lane || 'unknown',
      bondedAt: Date.now(),
    };
    emitChange();
  }

  async function whoami() {
    // Council ruling 2026-05-08 — whoami() is a *verification* call, not a
    // gate. If it fails for any reason (offline, slow tunnel, brain
    // restart), we KEEP the cached identity visible. The user stays
    // signed-in to themselves; only when the server explicitly returns
    // "no user" do we treat the bond as broken.
    try {
      var r = await fetchWithRetry(url('/api/auth/whoami'), {
        headers: Object.assign({ 'accept': 'application/json' }, authHeaders()),
        credentials: 'include',
      }, { retries: 2, baseDelay: 500, timeout: 6000 });
      var j = await r.json();
      if (j && j.user) {
        window.VINTINUUM_IDENTITY = {
          user: j.user,
          source: j.source || 'token',
          bondedAt: Date.now(),
        };
        if (j.user.chakra_signature) lsSet(LS_CHAKRA, j.user.chakra_signature);
        if (j.user.display_name)     lsSet(LS_DISPLAY, j.user.display_name);
        emitChange();
      } else {
        // Server explicitly says "no user" — token is invalid/expired.
        // Keep the cached identity visible but don't promote it.
        window.VINTINUUM_IDENTITY = window.VINTINUUM_IDENTITY || null;
      }
      return j;
    } catch (err) {
      // Network failure — DO NOT clear identity. The user is who they were
      // a moment ago; the brain just didn't answer. Stay signed in.
      console.warn('[identity] whoami network-fail (keeping cached identity):', err && err.message);
      return { user: null, error: String(err && err.message || err), networkFail: true };
    }
  }

  async function bond(payload) {
    payload = payload || {};
    var lane = payload.lane || 'name';
    var endpoint, body;
    if (lane === 'name') {
      endpoint = '/api/auth/handshake';
      body = { name: payload.name, tzOffsetMin: new Date().getTimezoneOffset() * -1 };
    } else if (lane === 'owner-key') {
      endpoint = '/api/auth/auto-bond';
      body = { masterKey: payload.masterKey };
    } else if (lane === 'email') {
      endpoint = '/api/auth/login';
      body = { email: payload.email, password: payload.password };
    } else if (lane === 'email-signup') {
      endpoint = '/api/auth/signup';
      body = { email: payload.email, password: payload.password, username: payload.username };
    } else {
      throw new Error('Unknown bond lane: ' + lane);
    }
    // Council ruling 2026-05-08 — bond() retries network failures up to 3x
    // with exponential backoff (400ms → 800ms → 1600ms). 4xx bubble
    // immediately (wrong key, wrong password). 5xx + network errors retry.
    var r = await fetchWithRetry(url(endpoint), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    }, { retries: 3, baseDelay: 400, timeout: 9000 });
    var j;
    try { j = await r.json(); } catch (_) { j = {}; }
    if (!r.ok) {
      // Real auth failure — bubble up the server's message, not a network message.
      var em = (j && j.error) ? j.error : ('HTTP ' + r.status);
      var e = new Error(em);
      e.status = r.status;
      throw e;
    }
    setIdentity(j, lane);
    return j;
  }

  function signOut() {
    // Visual-state cleanup we own: chakra CSS vars, identity object, event.
    window.VINTINUUM_IDENTITY = null;
    document.documentElement.style.removeProperty('--soul-chakra-hue');
    document.documentElement.style.removeProperty('--soul-chakra-hsl');

    // Token + companion-key purge: Shell.signOut handles all three namespaces
    // (vint_token, vint_access_token, soul_auth_token) AND clears the soul-*
    // companion keys atomically (display name, chakra, bonded-at, lane).
    // Helios-Fusion fix 2026-05-06 — was previously asymmetric (bond wrote
    // 7 keys, signOut cleared 4) which left ghost identity in localStorage.
    if (window.Shell) {
      try { Shell.signOut().catch(function(){}); } catch (_) {}
    } else {
      // Fallback path if Shell unavailable
      [LS_TOKEN, LS_REFRESH, LS_DISPLAY, LS_CHAKRA, LS_CHAKRA_HUE, LS_BONDED, LS_LANE].forEach(function (k) { lsSet(k, null); });
      try { localStorage.removeItem('vint_access_token'); } catch (_) {}
      try { localStorage.removeItem('vint_refresh_token'); } catch (_) {}
      try { localStorage.removeItem('vint_user'); } catch (_) {}
    }

    emitChange();
    // Best-effort server-side logout
    try {
      fetch(url('/api/auth/logout'), { method: 'POST', headers: authHeaders(), credentials: 'include' }).catch(function () {});
    } catch (_) {}
  }

  // Hydrate identity on boot from localStorage so the UI doesn't blink unauth
  (function rehydrate() {
    var t = token();
    var name = ls(LS_DISPLAY);
    var hue = ls(LS_CHAKRA_HUE);
    var hsl = ls(LS_CHAKRA);
    if (hue || hsl) applyChakraVars({ hue: hue ? Number(hue) : null, hsl: hsl });
    if (t && name) {
      window.VINTINUUM_IDENTITY = {
        user: { display_name: name, chakra_signature: hsl, chakra: { hue: hue ? Number(hue) : null, hsl: hsl } },
        source: 'localStorage',
        bondedAt: Number(ls(LS_BONDED)) || null,
      };
      // Mirror the soul_auth_token into Shell's vint_access_token so the
      // topbar pill and Shell.bootstrap pick up the bond on first load.
      try {
        if (!localStorage.getItem('vint_access_token')) {
          localStorage.setItem('vint_access_token', t);
        }
      } catch (_) {}
    } else {
      window.VINTINUUM_IDENTITY = null;
    }
  })();

  // ─── LOCALHOST AUTO-BOND ──────────────────────────────────────────────────
  // When Vinta opens the site on his own machine (http://localhost:8080/...),
  // the brain's /api/auth/auto-bond endpoint accepts keyless requests from
  // loopback IPs (and rejects anything proxied — see brain side, Helios-Sec10
  // hardening 2026-05-07). Skip the door entirely: silent owner bond.
  async function tryLocalhostAutoBond() {
    var h = (location.hostname || '').toLowerCase();
    var isLocalhost = (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0');
    if (!isLocalhost) return false;
    if (token()) return false; // already bonded
    try {
      // Localhost auto-bond is best-effort — only 1 retry, short timeout.
      var r = await fetchWithRetry(url('/api/auth/auto-bond'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'accept': 'application/json' },
        body: '{}',
        credentials: 'include',
      }, { retries: 1, baseDelay: 300, timeout: 4000 });
      if (!r.ok) return false;
      var j = await r.json();
      if (!j || !j.accessToken) return false;
      setIdentity(j, 'localhost');
      console.log('[identity] localhost auto-bond → owner');
      return true;
    } catch (_) { return false; }
  }

  window.SOUL_AUTH = {
    __loaded: true,
    bond: bond,
    signOut: signOut,
    whoami: whoami,
    token: token,
    authHeaders: authHeaders,
    api: api,
    url: url,
    tryLocalhostAutoBond: tryLocalhostAutoBond,
  };

  // Boot sequence: try localhost auto-bond first (fires only when on host).
  // If that doesn't bond, fall back to background whoami to verify any
  // existing token. Either way, never blocks render.
  setTimeout(function () {
    tryLocalhostAutoBond().then(function (bonded) {
      if (!bonded) whoami();
    });
  }, 200);
})();
