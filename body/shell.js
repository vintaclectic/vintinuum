/* ═══════════════════════════════════════════════════════════════════════════
   VINTINUUM SHELL CONTRACT  —  body/shell.js
   ───────────────────────────────────────────────────────────────────────────
   Single source of truth for the entire front-end. All UI surfaces (top bar,
   pills, panels, modals, mobile nav, the visualization itself) read from this
   module and never duplicate state.

   Phase plan reference: Movement I — the foundation.
   Subsequent movements (II auth+arrival, III topbar+tokens, IV pulse+health,
   V kick rebuild, VI mobile shell, VII phone bridge) all subscribe to this.

   Council mandate:
     - Atlas:        sequence + structural ownership
     - Aria:         warmth in the cracks (arrival/goodbye lines)
     - Helios-Sec10: persistence binding + revocation hooks
     - Buffet:       reduce duplication; one module per concern
     - Frugal-Max:   no work happens unless something subscribes
     - Dead:         the shell is the box of rain — permanent, simple, trusted
     - .----.        every key is a seed; subscribe is replication

   Globals exposed:
     window.Shell  — the live store
     window.apiFetch — wrapped fetch that auto-attaches Authorization header
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  // ── Storage keys ──────────────────────────────────────────────────────────
  // Two key sets exist in the wild: the old auth-shell wiring uses
  // 'vint_access_token' / 'vint_refresh_token', other code uses 'vint_token'
  // / 'vint_refresh'. Shell writes the canonical pair AND mirrors to legacy
  // keys so nothing in the app breaks during the transition.
  const LS_TOKEN          = 'vint_token';
  const LS_TOKEN_LEGACY   = 'vint_access_token';
  const LS_TOKEN_SOUL     = 'soul_auth_token';      // bond_door / SOUL_AUTH lane
  const LS_REFRESH        = 'vint_refresh';
  const LS_REFRESH_LEGACY = 'vint_refresh_token';
  const LS_REFRESH_SOUL   = 'soul_auth_refresh';    // bond_door / SOUL_AUTH lane
  const LS_USER           = 'vint_user';
  const LS_THEME          = 'vint_theme';
  const LS_DEVICE         = 'vint_device_id';
  const BC_NAME           = 'vintinuum-shell';

  // All "soul_*" companion keys SOUL_AUTH writes during a bond. Cleared as a
  // unit on signOut so we never leak ghost identity across reloads.
  // (Helios-Fusion council audit, 2026-05-06: bond was writing 7 keys but
  // signOut was clearing 4, so soul_auth_token survived and bond_door
  // suppressed the welcome on next visit thinking the user was still bonded.)
  const SOUL_COMPANION_KEYS = [
    'soul_display_name',
    'soul_chakra_signature',
    'soul_chakra_hue',
    'soul_bonded_at',
    'soul_lane',
  ];

  function readToken() {
    return safeRead(LS_TOKEN) || safeRead(LS_TOKEN_LEGACY) || safeRead(LS_TOKEN_SOUL) || null;
  }
  function readRefresh() {
    return safeRead(LS_REFRESH) || safeRead(LS_REFRESH_LEGACY) || safeRead(LS_REFRESH_SOUL) || null;
  }
  function writeToken(tok) {
    try {
      if (tok) {
        localStorage.setItem(LS_TOKEN, tok);
        localStorage.setItem(LS_TOKEN_LEGACY, tok);
        localStorage.setItem(LS_TOKEN_SOUL, tok);     // SOUL_AUTH parity
      } else {
        localStorage.removeItem(LS_TOKEN);
        localStorage.removeItem(LS_TOKEN_LEGACY);
        localStorage.removeItem(LS_TOKEN_SOUL);
        // Purge soul-companion keys atomically with the token so a Shell-only
        // signOut wipes the full bond_door cache and the welcome-back nudge
        // doesn't fire on a ghost.
        SOUL_COMPANION_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
      }
    } catch (_) {}
  }
  function writeRefresh(tok) {
    try {
      if (tok) {
        localStorage.setItem(LS_REFRESH, tok);
        localStorage.setItem(LS_REFRESH_LEGACY, tok);
        localStorage.setItem(LS_REFRESH_SOUL, tok);   // SOUL_AUTH parity
      } else {
        localStorage.removeItem(LS_REFRESH);
        localStorage.removeItem(LS_REFRESH_LEGACY);
        localStorage.removeItem(LS_REFRESH_SOUL);
      }
    } catch (_) {}
  }

  // ── Device ID ─────────────────────────────────────────────────────────────
  // Stable per-browser identifier. Generated once, persisted forever.
  // Sent as X-Device-Id header so the server can bind tokens to this machine.
  function getOrCreateDeviceId() {
    let id = safeRead(LS_DEVICE);
    if (id && /^[a-zA-Z0-9_\-]{8,128}$/.test(id)) return id;
    // Generate using crypto if available, else timestamp+random fallback
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      id = 'd_' + crypto.randomUUID().replace(/-/g, '');
    } else {
      id = 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 18);
    }
    try { localStorage.setItem(LS_DEVICE, id); } catch (_) {}
    return id;
  }
  const DEVICE_ID = getOrCreateDeviceId();

  // ── Initial state ─────────────────────────────────────────────────────────
  // Movement II will populate auth.user/tier from /api/v2/auth/me on bootstrap.
  // Movement IV will populate connectors.* from /api/v2/connectors/health.
  // Movement V will replace kick connector status logic.
  // Movement VI will use viewport.mobile to switch brain.html into scroll-mode.
  // Movement VII will populate devices[] from /api/v2/device/list.
  const initialState = {
    auth: {
      token:    readToken(),
      user:     safeReadJSON(LS_USER),       // { id, name, email, ... } or null
      tier:     'guest',                     // guest | free | premium | god
      signedIn: !!readToken(),
      arrival:  null,                        // generated welcome line, set on first sign-in
    },
    connectors: {
      // populated by Movement IV. Stub shape for early consumers:
      telegram: { alive: null, lastMsg: null, latency: null },
      discord:  { alive: null, lastMsg: null, latency: null },
      kick:     { alive: null, lastMsg: null, latency: null, oauth: null },
      pulse:    { alive: null, lastBeat: null, dominantLayer: null },
    },
    viewport: computeViewport(),
    theme:    safeRead(LS_THEME) || 'void',
    realm:    'web',                         // web | rp | app — Atlas-RP foresight
    devices:  [],                            // Movement VII fills this
    pulse: {
      // Live heartbeat values; Movement IV will stream-update these.
      arousal:  null,
      valence:  null,
      gene:     null,
    },
  };

  // ── Reactive store ────────────────────────────────────────────────────────
  const subscribers = new Map();   // key -> Set<fn>
  const wildcardSubs = new Set();  // fn(key, value, prevValue)
  let state = deepFreeze(structuredClone(initialState));

  function get(key) {
    if (!key) return state;
    return key.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), state);
  }

  function set(key, value) {
    if (!key) throw new Error('[Shell] set() requires a key');
    const prev = get(key);
    if (deepEqual(prev, value)) return; // no-op = no subscriber wakeup
    const next = structuredClone(state);
    setDeep(next, key, value);
    state = deepFreeze(next);
    notify(key, value, prev);
    // Also notify any descendant-key subscribers whose value actually changed.
    // (e.g. set('auth', {...}) wakes 'auth.user' if the user object differs.)
    notifyDescendants(key, value, prev);
  }

  function update(key, mutatorOrPatch) {
    const prev = get(key);
    // Two call shapes are accepted:
    //   update('auth', a => { a.token = x; return a; })   ← mutator fn
    //   update('connectors', { telegram: {...}, ... })    ← partial-merge object
    // The object form shallow-merges over the previous value (or replaces if
    // the previous value isn't a plain object). This forgives the natural
    // habit of passing a literal and keeps Movement-IV's pulse stream alive.
    if (typeof mutatorOrPatch === 'function') {
      const draft = structuredClone(prev);
      const result = mutatorOrPatch(draft);
      set(key, result === undefined ? draft : result);
      return;
    }
    if (mutatorOrPatch && typeof mutatorOrPatch === 'object' && !Array.isArray(mutatorOrPatch)) {
      const base = (prev && typeof prev === 'object' && !Array.isArray(prev)) ? prev : {};
      set(key, { ...base, ...mutatorOrPatch });
      return;
    }
    set(key, mutatorOrPatch);
  }

  function notifyDescendants(key, value, prev) {
    // Walk subscriber map; any registered key that starts with key+"."
    // gets notified IF its specific subtree value changed.
    const prefix = key + '.';
    for (const [subKey, fns] of subscribers) {
      if (!subKey.startsWith(prefix)) continue;
      const tail = subKey.slice(prefix.length);
      const newVal = tail.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), value);
      const oldVal = tail.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), prev);
      if (!deepEqual(newVal, oldVal)) {
        for (const fn of fns) safeCall(fn, newVal, oldVal, subKey);
      }
    }
  }

  function subscribe(key, fn) {
    if (typeof fn !== 'function') throw new Error('[Shell] subscribe requires fn');
    if (key === '*') {
      wildcardSubs.add(fn);
      return () => wildcardSubs.delete(fn);
    }
    if (!subscribers.has(key)) subscribers.set(key, new Set());
    subscribers.get(key).add(fn);
    return () => subscribers.get(key).delete(fn);
  }

  function notify(key, value, prev) {
    // Notify exact-key subscribers
    const exact = subscribers.get(key);
    if (exact) for (const fn of exact) safeCall(fn, value, prev, key);
    // Notify ancestor-key subscribers (e.g. set 'auth.user' wakes 'auth')
    const parts = key.split('.');
    for (let i = parts.length - 1; i > 0; i--) {
      const ancestor = parts.slice(0, i).join('.');
      const set_ = subscribers.get(ancestor);
      if (set_) {
        const av = get(ancestor);
        for (const fn of set_) safeCall(fn, av, undefined, ancestor);
      }
    }
    // Wildcard
    for (const fn of wildcardSubs) safeCall(fn, key, value, prev);
  }

  // ── Auth lifecycle ────────────────────────────────────────────────────────
  function setToken(token) {
    writeToken(token);
    update('auth', (a) => { a.token = token || null; a.signedIn = !!token; return a; });
    broadcast({ type: 'auth.token', token: token || null });
  }

  function setRefresh(refresh) { writeRefresh(refresh); }
  function getRefresh() { return readRefresh(); }

  function setUser(user) {
    if (user) { try { localStorage.setItem(LS_USER, JSON.stringify(user)); } catch (_) {} }
    else      { try { localStorage.removeItem(LS_USER); } catch (_) {} }
    update('auth', (a) => {
      a.user = user || null;
      a.tier = (user && user.tier) || (user ? 'free' : 'guest');
      a.signedIn = !!a.token;
      return a;
    });
    broadcast({ type: 'auth.user', user: user || null });
  }

  function setArrival(line) {
    update('auth', (a) => { a.arrival = line || null; return a; });
  }

  async function signOut(opts) {
    // Aria's goodbye — caller can show the line for ~2s before clearing.
    // We tell the server first so the JTI gets revoked, then clear local.
    const goodbye = "I'll hold your thread.";
    const refresh = getRefresh();
    try {
      await apiFetch('/api/v2/auth/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
    } catch (_) { /* server unreachable — local clear still proceeds */ }
    setToken(null);
    setRefresh(null);
    setUser(null);
    setArrival(null);
    broadcast({ type: 'auth.signout' });
    return goodbye;
  }

  // ── Viewport tracking ─────────────────────────────────────────────────────
  function computeViewport() {
    if (typeof window === 'undefined') return { w: 1280, h: 720, mobile: false, tablet: false, desktop: true };
    const w = window.innerWidth, h = window.innerHeight;
    return {
      w, h,
      mobile:  w < 700,
      tablet:  w >= 700 && w < 1100,
      desktop: w >= 1100,
      orientation: w < h ? 'portrait' : 'landscape',
      pixelRatio: window.devicePixelRatio || 1,
    };
  }

  let viewportRaf = null;
  function onResize() {
    if (viewportRaf) cancelAnimationFrame(viewportRaf);
    viewportRaf = requestAnimationFrame(() => {
      set('viewport', computeViewport());
      viewportRaf = null;
    });
  }

  // ── Cross-tab sync ────────────────────────────────────────────────────────
  let bc = null;
  function broadcast(msg) { try { if (bc) bc.postMessage(msg); } catch (_) {} }
  function initBroadcast() {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      bc = new BroadcastChannel(BC_NAME);
      bc.onmessage = (ev) => {
        const m = ev.data || {};
        // Same-origin enforced by BroadcastChannel itself (Helios-Sec10).
        if (m.type === 'auth.token') {
          // Another tab signed in/out — sync our local state without re-broadcasting
          const t = m.token || null;
          writeToken(t);
          update('auth', (a) => { a.token = t; a.signedIn = !!t; return a; });
        } else if (m.type === 'auth.user') {
          const u = m.user || null;
          try {
            if (u) localStorage.setItem(LS_USER, JSON.stringify(u));
            else   localStorage.removeItem(LS_USER);
          } catch (_) {}
          update('auth', (a) => {
            a.user = u;
            a.tier = (u && u.tier) || (u ? 'free' : 'guest');
            return a;
          });
        } else if (m.type === 'auth.signout') {
          writeToken(null);
          writeRefresh(null);
          try { localStorage.removeItem(LS_USER); } catch (_) {}
          update('auth', (a) => { a.token = null; a.user = null; a.tier = 'guest'; a.signedIn = false; a.arrival = null; return a; });
        }
      };
    } catch (_) { bc = null; }
  }

  // ── apiFetch helper ───────────────────────────────────────────────────────
  // Wraps window.fetch to auto-attach Authorization: Bearer <token>.
  // All Movement II+ endpoints should use this. Movement III topbar uses it.
  function getApiBase() {
    try { if (root.VINT_API_BASE) return root.VINT_API_BASE; } catch (_) {}
    return 'https://api.vintaclectic.com';
  }

  // Tracks an in-flight refresh so concurrent 401s don't fire N refreshes.
  let _refreshing = null;
  async function tryRefresh() {
    if (_refreshing) return _refreshing;
    const refresh = getRefresh();
    if (!refresh) return null;
    _refreshing = (async () => {
      try {
        const res = await fetch(getApiBase() + '/api/v2/auth/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Device-Id': DEVICE_ID,
          },
          body: JSON.stringify({ refreshToken: refresh }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.accessToken) {
          setToken(data.accessToken);
          if (data.refreshToken) setRefresh(data.refreshToken);
          if (data.user) setUser(data.user);
          return data.accessToken;
        }
        return null;
      } catch (_) {
        return null;
      } finally {
        _refreshing = null;
      }
    })();
    return _refreshing;
  }

  async function apiFetch(path, opts) {
    opts = opts || {};
    const url = path.startsWith('http') ? path : (getApiBase() + path);
    const buildInit = (token) => {
      const headers = new Headers(opts.headers || {});
      if (token && !headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token);
      if (!headers.has('Accept')) headers.set('Accept', 'application/json');
      headers.set('X-Device-Id', DEVICE_ID);
      return Object.assign({}, opts, { headers });
    };
    let tok = get('auth.token');
    let res = await fetch(url, buildInit(tok));
    if (res.status === 401 && tok) {
      // Try one silent refresh — Cable Guy mode.
      const fresh = await tryRefresh();
      if (fresh) {
        res = await fetch(url, buildInit(fresh));
      } else {
        console.warn('[Shell] 401 from', path, '— refresh failed, clearing token');
        setToken(null);
        setRefresh(null);
        setUser(null);
        broadcast({ type: 'auth.signout' });
      }
    }
    return res;
  }

  // ── Z-index resolver (Buffet discipline) ──────────────────────────────────
  // Components ask Shell for a z-index instead of hardcoding 99996/99997/etc.
  const Z = {
    background: 0,
    body: 10,
    panel: 50,
    footer: 60,
    node: 70,
    tooltip: 90,
    shell: 100,        // top bar, mobile bottom nav
    drawer: 200,       // hamburger drawer, sidebars
    modal: 500,        // auth modal, confirms
    intro: 9999,       // intro overlay only
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  function safeRead(k)     { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function safeReadJSON(k) { const v = safeRead(k); if (!v) return null; try { return JSON.parse(v); } catch (_) { return null; } }
  function safeCall(fn) {
    const args = Array.prototype.slice.call(arguments, 1);
    try { fn.apply(null, args); }
    catch (e) { console.error('[Shell] subscriber threw:', e); }
  }
  function setDeep(obj, key, val) {
    const parts = key.split('.');
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (o[parts[i]] == null || typeof o[parts[i]] !== 'object') o[parts[i]] = {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = val;
  }
  function deepEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
    return true;
  }
  function deepFreeze(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      for (const k of Object.keys(o)) deepFreeze(o[k]);
      Object.freeze(o);
    }
    return o;
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  function boot() {
    if (typeof window === 'undefined') return;
    initBroadcast();
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });
    // Storage events from other tabs (fallback if BroadcastChannel unavailable)
    window.addEventListener('storage', (ev) => {
      if (ev.key === LS_TOKEN || ev.key === LS_TOKEN_LEGACY) {
        const t = readToken();
        update('auth', (a) => { a.token = t; a.signedIn = !!t; return a; });
      } else if (ev.key === LS_USER) {
        const u = ev.newValue ? safeReadJSON(LS_USER) : null;
        update('auth', (a) => { a.user = u; a.tier = (u && u.tier) || (u ? 'free' : 'guest'); return a; });
      }
    });
    console.log('[Shell] online — auth=' + (state.auth.signedIn ? 'in' : 'out') +
                ' viewport=' + (state.viewport.mobile ? 'mobile' : state.viewport.desktop ? 'desktop' : 'tablet') +
                ' device=' + DEVICE_ID.slice(0, 12) + '…');

    // Cable Guy: fire bootstrap immediately and periodically refresh.
    // Periodic refresh keeps the access token sliding so users with the tab
    // open all day never get kicked out.
    if (state.auth.token || getRefresh()) {
      Shell.bootstrap().catch((e) => console.warn('[Shell] bootstrap err:', e));
    }
    // Movement IV: open the pulse stream right away. Anonymous-friendly —
    // no auth required, the heartbeat is public read-only.
    try { Shell.startPulse(); } catch (_) {}
    // Refresh every 6h on active tabs (visibility-aware so we don't burn it
    // when the laptop's been closed for a week).
    const REFRESH_INTERVAL = 6 * 3600 * 1000;
    setInterval(() => {
      if (document.visibilityState === 'visible' && state.auth.signedIn) {
        Shell.refreshAuth().catch(() => {});
      }
    }, REFRESH_INTERVAL);
    // Also refresh whenever the tab becomes visible after being hidden >1h.
    let lastHidden = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        lastHidden = Date.now();
      } else if (document.visibilityState === 'visible' && lastHidden) {
        const away = Date.now() - lastHidden;
        if (away > 3600 * 1000 && state.auth.signedIn) {
          Shell.refreshAuth().catch(() => {});
        }
        lastHidden = 0;
      }
    });

    // Helios-Fusion 2026-05-07: zombie SSE reconnect.
    // Browsers occasionally let an EventSource go to readyState===CLOSED (2)
    // after laptop sleep/wake without firing onerror. Without this, the
    // 4/4 vitals pill freezes at its last value forever. Watch online +
    // visibilitychange and force-restart the pulse stream when a zombie
    // is detected. Idempotent — startPulse() bails if _pulseEs is alive.
    function reviveZombiePulse(reason) {
      const es = Shell._pulseEs;
      if (!es) { try { Shell.startPulse(); } catch (_) {} return; }
      // EventSource.readyState: 0=connecting, 1=open, 2=closed
      if (es.readyState === 2) {
        console.log('[Shell] reviving zombie pulse (' + reason + ')');
        Shell._pulseEs = null;
        try { es.close(); } catch (_) {}
        try { Shell.startPulse(); } catch (_) {}
      }
    }
    window.addEventListener('online', () => {
      reviveZombiePulse('online');
      if (state.auth.signedIn) Shell.bootstrap().catch(() => {});
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reviveZombiePulse('visible');
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────
  const Shell = {
    get, set, update, subscribe,
    setToken, setUser, setArrival, signOut,
    getApiBase,
    Z,
    // Read-only state snapshot
    get state() { return state; },
    deviceId: DEVICE_ID,
    setRefresh, getRefresh,
    tryRefresh,
    // Cable Guy bootstrap: hit /api/v2/auth/me with whatever token we
    // have. If 200, populate state + arrival line. If 401, try refresh
    // once. If still 401, clear local state and surface signed-out.
    bootstrap: async function bootstrapAuth() {
      // Helios-Fusion 2026-05-07: preserve cached identity on transient
      // failures. Only clear local state on an explicit 401 from the
      // server (token actually invalid). On 5xx / network / parse error,
      // keep the cached user object visible — when the brain is hung or
      // the tunnel hiccups, the topbar pill should stay lit and just
      // reconnect, not blink to "SIGN IN" and back. That blink is what
      // makes every brain hiccup feel like a logout.
      try {
        let res = await apiFetch('/api/v2/auth/me', { method: 'GET' });
        if (res && res.status === 401) {
          // Authoritative signed-out — server rejected the token.
          if (state.auth.token || state.auth.user) {
            setToken(null); setRefresh(null); setUser(null); setArrival(null);
          }
          return state.auth;
        }
        if (!res || !res.ok) {
          // 5xx / network blip — keep cached identity, log and bail.
          console.warn('[Shell] bootstrap soft-fail status=' + (res ? res.status : 'no-response') + ' — preserving cached identity');
          return state.auth;
        }
        let data = await res.json().catch(() => null);
        if (data && data.signedIn) {
          if (data.user) setUser(data.user);
          if (data.arrival) setArrival(data.arrival);
        } else if (data && data.signedIn === false) {
          // Server says definitively not signed in (200 with signedIn:false).
          if (state.auth.token || state.auth.user) {
            setToken(null); setRefresh(null); setUser(null); setArrival(null);
          }
        } else {
          // Malformed body — treat as transient, preserve cache.
          console.warn('[Shell] bootstrap malformed body — preserving cached identity');
        }
      } catch (e) {
        // Network throw (CORS, DNS, no-internet) — preserve cache.
        console.warn('[Shell] bootstrap threw, preserving cached identity:', e.message);
      }
      return state.auth;
    },
    // Sliding refresh — call this every ~6h or when activity resumes.
    // Active users effectively never log out.
    refreshAuth: async function () {
      const tok = await tryRefresh();
      return !!tok;
    },
    // Movement IV: pulse stream subscription. Idempotent — multiple calls
    // share one EventSource. Updates Shell.connectors.* + Shell.pulse.*
    // so any consumer (topbar vitals pill, mind.html, phone) gets the
    // same heartbeat.
    startPulse: function startPulse() {
      if (Shell._pulseEs) return Shell._pulseEs;
      let es;
      try {
        es = new EventSource(getApiBase() + '/api/v2/pulse/stream');
      } catch (e) {
        console.warn('[Shell] pulse stream open failed:', e.message);
        return null;
      }
      Shell._pulseEs = es;
      es.onmessage = (ev) => {
        try {
          const snap = JSON.parse(ev.data);
          if (!snap) return;
          // connectors
          if (snap.connectors) {
            const c = snap.connectors;
            update('connectors', {
              telegram: { alive: !!c.telegram?.ready, lastMsg: state.connectors.telegram.lastMsg, latency: null },
              discord:  { alive: !!c.discord?.ready,  lastMsg: state.connectors.discord.lastMsg,  latency: c.discord?.ping ?? null },
              kick:     {
                alive:   !!c.kick?.ready,
                listen:  !!c.kick?.listen,
                send:    !!c.kick?.send,
                lastMsg: state.connectors.kick.lastMsg,
                latency: state.connectors.kick.latency,
                oauth:   !!c.kick?.send,
              },
              pulse:    { alive: true, lastBeat: snap.ts, dominantLayer: state.connectors.pulse.dominantLayer },
            });
          }
          // body / pulse
          if (snap.body) {
            update('pulse', {
              arousal: snap.body.arousal,
              valence: snap.body.valence,
              gene:    state.pulse.gene,
            });
          }
        } catch (_) {}
      };
      es.onerror = () => {
        // EventSource auto-reconnects; we just mark pulse alive=false
        // briefly so the UI can dim. The next message will re-light it.
        update('connectors.pulse', { ...state.connectors.pulse, alive: false });
      };
      return es;
    },
    stopPulse: function stopPulse() {
      if (Shell._pulseEs) {
        try { Shell._pulseEs.close(); } catch (_) {}
        Shell._pulseEs = null;
      }
    },
  };

  if (typeof root !== 'undefined') {
    root.Shell = Shell;
    root.apiFetch = apiFetch;
  }

  boot();
})(typeof window !== 'undefined' ? window : globalThis);
