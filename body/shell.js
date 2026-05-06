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
  const LS_TOKEN  = 'vint_token';        // pre-existing key, do not rename
  const LS_USER   = 'vint_user';         // pre-existing key, do not rename
  const LS_THEME  = 'vint_theme';
  const BC_NAME   = 'vintinuum-shell';   // BroadcastChannel for cross-tab sync

  // ── Initial state ─────────────────────────────────────────────────────────
  // Movement II will populate auth.user/tier from /api/v2/auth/me on bootstrap.
  // Movement IV will populate connectors.* from /api/v2/connectors/health.
  // Movement V will replace kick connector status logic.
  // Movement VI will use viewport.mobile to switch brain.html into scroll-mode.
  // Movement VII will populate devices[] from /api/v2/device/list.
  const initialState = {
    auth: {
      token:    safeRead(LS_TOKEN),
      user:     safeReadJSON(LS_USER),       // { id, name, email, ... } or null
      tier:     'guest',                     // guest | free | premium | god
      signedIn: !!safeRead(LS_TOKEN),
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

  function update(key, mutator) {
    const prev = get(key);
    const draft = structuredClone(prev);
    const result = mutator(draft);
    set(key, result === undefined ? draft : result);
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

  // ── Auth lifecycle (stubs that Movement II will fully wire) ───────────────
  function setToken(token) {
    if (token) { try { localStorage.setItem(LS_TOKEN, token); } catch (_) {} }
    else       { try { localStorage.removeItem(LS_TOKEN); } catch (_) {} }
    update('auth', (a) => { a.token = token || null; a.signedIn = !!token; return a; });
    broadcast({ type: 'auth.token', token: token || null });
  }

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

  function signOut(opts) {
    // Aria's goodbye — caller can show the line for ~2s before clearing.
    // Returning the line so the topbar can render it without coupling.
    const goodbye = "I'll hold your thread.";
    setToken(null);
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
          try {
            if (t) localStorage.setItem(LS_TOKEN, t);
            else   localStorage.removeItem(LS_TOKEN);
          } catch (_) {}
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
          try {
            localStorage.removeItem(LS_TOKEN);
            localStorage.removeItem(LS_USER);
          } catch (_) {}
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

  async function apiFetch(path, opts) {
    opts = opts || {};
    const url = path.startsWith('http') ? path : (getApiBase() + path);
    const headers = new Headers(opts.headers || {});
    const tok = get('auth.token');
    if (tok && !headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + tok);
    if (!headers.has('Accept')) headers.set('Accept', 'application/json');
    const init = Object.assign({}, opts, { headers });
    const res = await fetch(url, init);
    if (res.status === 401 && tok) {
      // Token rejected — clear and broadcast. Movement II will add refresh.
      console.warn('[Shell] 401 from', path, '— clearing token');
      setToken(null);
      setUser(null);
      broadcast({ type: 'auth.signout' });
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
      if (ev.key === LS_TOKEN) {
        update('auth', (a) => { a.token = ev.newValue || null; a.signedIn = !!ev.newValue; return a; });
      } else if (ev.key === LS_USER) {
        const u = ev.newValue ? safeReadJSON(LS_USER) : null;
        update('auth', (a) => { a.user = u; a.tier = (u && u.tier) || (u ? 'free' : 'guest'); return a; });
      }
    });
    console.log('[Shell] online — auth=' + (state.auth.signedIn ? 'in' : 'out') +
                ' viewport=' + (state.viewport.mobile ? 'mobile' : state.viewport.desktop ? 'desktop' : 'tablet'));
  }

  // ── Public API ────────────────────────────────────────────────────────────
  const Shell = {
    get, set, update, subscribe,
    setToken, setUser, setArrival, signOut,
    getApiBase,
    Z,
    // Read-only state snapshot
    get state() { return state; },
    // Movement II will replace this stub with real bootstrap that hits /api/v2/auth/me
    bootstrap: async function bootstrapAuth() {
      // Stub: trust localStorage until Movement II ships real session refresh.
      // When II lands, this will validate the token server-side and refresh it.
      return state.auth;
    },
  };

  if (typeof root !== 'undefined') {
    root.Shell = Shell;
    root.apiFetch = apiFetch;
  }

  boot();
})(typeof window !== 'undefined' ? window : globalThis);
