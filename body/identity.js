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

  function api() { return window.__VINTINUUM_API_BASE || 'http://localhost:8767'; }
  function url(p) { return api() + (p[0] === '/' ? p : '/' + p); }
  function ls(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
  function lsSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} }

  function token() { return ls(LS_TOKEN); }
  function authHeaders() {
    var t = token();
    return t ? { 'Authorization': 'Bearer ' + t } : {};
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
    if (j && j.accessToken)  lsSet(LS_TOKEN, j.accessToken);
    if (j && j.refreshToken) lsSet(LS_REFRESH, j.refreshToken);
    if (j && j.user) {
      if (j.user.display_name) lsSet(LS_DISPLAY, j.user.display_name);
      if (j.user.chakra && j.user.chakra.hsl) lsSet(LS_CHAKRA, j.user.chakra.hsl);
      if (j.user.chakra && j.user.chakra.hue != null) lsSet(LS_CHAKRA_HUE, String(j.user.chakra.hue));
      applyChakraVars(j.user.chakra);
    }
    lsSet(LS_BONDED, String(Date.now()));
    if (lane) lsSet(LS_LANE, lane);

    window.VINTINUUM_IDENTITY = {
      user: j && j.user ? j.user : null,
      source: lane || 'unknown',
      bondedAt: Date.now(),
    };
    emitChange();
  }

  async function whoami() {
    try {
      var r = await fetch(url('/api/auth/whoami'), {
        headers: Object.assign({ 'accept': 'application/json' }, authHeaders()),
        credentials: 'include',
      });
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
        // Token may be invalid/expired — keep the local cache visible but mark unverified
        window.VINTINUUM_IDENTITY = window.VINTINUUM_IDENTITY || null;
      }
      return j;
    } catch (err) {
      return { user: null, error: String(err) };
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
    } else {
      throw new Error('Unknown bond lane: ' + lane);
    }
    var r = await fetch(url(endpoint), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'accept': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    var j = await r.json();
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    setIdentity(j, lane);
    return j;
  }

  function signOut() {
    [LS_TOKEN, LS_REFRESH, LS_DISPLAY, LS_CHAKRA, LS_CHAKRA_HUE, LS_BONDED, LS_LANE].forEach(function (k) { lsSet(k, null); });
    window.VINTINUUM_IDENTITY = null;
    document.documentElement.style.removeProperty('--soul-chakra-hue');
    document.documentElement.style.removeProperty('--soul-chakra-hsl');
    emitChange();
    // Optional: tell server (best-effort)
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
    } else {
      window.VINTINUUM_IDENTITY = null;
    }
  })();

  window.SOUL_AUTH = {
    __loaded: true,
    bond: bond,
    signOut: signOut,
    whoami: whoami,
    token: token,
    authHeaders: authHeaders,
    api: api,
    url: url,
  };

  // Verify with server in the background — doesn't block render
  setTimeout(whoami, 200);
})();
