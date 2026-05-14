// ════════════════════════════════════════════════════════════════════════════
// JARVIS_CLIENT — frontend consumer for /api/jarvis/today + /api/jarvis/stream
// ════════════════════════════════════════════════════════════════════════════
// HELIOS-FUSION-20 contract surface. Counterparts being written in parallel:
//   - HELIO-SEC10  → ~/vintinuum-api/jarvis.js (envelope assembler + SSE)
//   - HELIOS-FE-D  → ~/vintinuum/body/jarvis_styles.css (visual layer)
//   - HELIOS-DISC  → IA / layer ordering authority
//
// This module owns ONLY the wire + DOM-binding contract. It does no styling.
// CSS targets stable [data-jarvis-layer="*"] attributes — the visual brief
// can be re-pasted on top without touching JS.
//
// PUBLIC SURFACE (window.JARVIS):
//   reload()           — refetch today envelope from REST
//   date()             — currently-rendered date (YYYY-MM-DD, user TZ)
//   tier()             — last-seen tier from envelope ('free'|'premium'|'god')
//   last()             — diag snapshot { sse, last_event_ts, layers, degraded }
//   witness()          — manually fire the witness POST (normally automatic)
//   on(layer, cb)      — subscribe to a single layer's deltas
//
// EVENTS DISPATCHED on window:
//   vint:jarvis:opened          { date, tier }                   — once on mount
//   vint:jarvis:layer_updated   { layer, payload, source }       — per delta
//   vint:jarvis:witnessed       { date, ts }                     — once per page
//   vint:jarvis:degraded        { partial: bool, missing: [..] } — degraded mode
//   vint:jarvis:sse_open|close                                   — SSE lifecycle
//
// CROSS-TAB SYNC:
//   localStorage key 'vint:jarvis:opened_at' carries timestamp. Storage
//   event in another tab → dispatches vint:jarvis:peer_opened (the body can
//   choose to react with a tiny peak so Vinta knows another surface saw it).
//
// AUDIBLE OUTPUT POLICY:
//   This module does NOT call speechSynthesis. Per the one-voice directive
//   shipped 2026-05-10, ANY audible utterance routes through window.VOICE,
//   and only when EMBODIED_CONVO is mounted (it owns the whisper rhythm).
//   We dispatch events; the body decides whether to vocalize.
//
// DEGRADED MODE:
//   If envelope.degraded === true OR a layer's payload is missing/null, the
//   layer container gets data-jarvis-state="degraded" (CSS shows a subtle
//   "live data slow" pill). No error theater, no red banners.
// ════════════════════════════════════════════════════════════════════════════
//
// ⚠ ASSUMPTIONS FLAGGED FOR HELIO-SEC10 RECONCILIATION:
// I'm guessing the envelope shape because sec10 is writing it in parallel.
// If the real shape differs, ONLY the _renderEnvelope() and _applyDelta()
// functions need to change — every other surface (events, public API,
// SSE wiring) is contract-stable.
//
//   GET /api/jarvis/today/:userId?date=YYYY-MM-DD
//   Headers: Authorization: Bearer <token>, X-TZ-Offset: <minutes from UTC>
//   Response 200:
//   {
//     ok: true,
//     date: "2026-05-10",
//     tier: "free" | "premium" | "god",
//     degraded: false,
//     witnessed_at: 1234567890 | null,
//     felt_quality: "today reads as quiet electricity, slightly under-slept",
//     layers: {
//       subconscious: { headline, body, fragments: [..], updated_at, confidence },
//       somatic:      { headline, body, fragments, updated_at, confidence },
//       genetic:      { headline, body, fragments, updated_at, confidence },
//       immune:       { headline, body, fragments, updated_at, confidence },
//       metabolic:    { headline, body, fragments, updated_at, confidence },
//       neural:       { headline, body, fragments, updated_at, confidence },
//       emotional:    { headline, body, fragments, updated_at, confidence }
//     },
//     order: ["subconscious","somatic","genetic","immune","metabolic","neural","emotional"]
//   }
//
//   GET /api/jarvis/stream/:userId   (SSE)
//   Events:
//     event: layer
//     data: { "layer": "neural", "payload": { headline, body, fragments, ... }, "ts": ... }
//
//     event: felt_quality
//     data: { "text": "...", "ts": ... }
//
//     event: degraded
//     data: { "partial": true, "missing": ["metabolic"] }
//
//     event: heartbeat
//     data: { "ts": ... }
//
//   POST /api/jarvis/today/:userId/witness   { date }
//   → 200 { ok: true, witnessed_at }
//
// If sec10 ships a different shape, search this file for "@CONTRACT" and
// adjust those four functions — nothing else.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.JARVIS && window.JARVIS.__realBody) return;

  // ── Config ───────────────────────────────────────────────────────────────
  var DEFAULT_LAYER_ORDER = [
    'subconscious', 'somatic', 'genetic',
    'immune', 'metabolic', 'neural', 'emotional'
  ];
  var SSE_RECONNECT_MIN_MS = 1500;
  var SSE_RECONNECT_MAX_MS = 30000;
  var REST_TIMEOUT_MS = 8000;
  var STORAGE_KEY_OPENED = 'vint:jarvis:opened_at';
  var STORAGE_KEY_LAST_DATE = 'vint:jarvis:last_date';

  // ── Helpers (api base / auth / userId) ───────────────────────────────────
  function _apiBase() {
    if (window.VINT_API) return String(window.VINT_API).replace(/\/+$/, '');
    if (document.documentElement.dataset.api) return String(document.documentElement.dataset.api).replace(/\/+$/, '');
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return 'http://localhost:8767';
    }
    return 'https://api.vintaclectic.com';
  }

  function _authToken() {
    try {
      return localStorage.getItem('vint_token')
          || localStorage.getItem('vint_access_token')
          || localStorage.getItem('soul_auth_token')
          || null;
    } catch (_) { return null; }
  }

  function _userId() {
    // The Shell holds the canonical signed-in user; fall back to 'default'
    // (the single-user lane this stack still uses on most surfaces).
    try {
      if (window.Shell && typeof window.Shell.get === 'function') {
        var u = window.Shell.get('auth.user');
        if (u && (u.id || u.user_id)) return String(u.id || u.user_id);
      }
    } catch (_) {}
    try {
      var stored = localStorage.getItem('vint_user_id');
      if (stored) return String(stored);
    } catch (_) {}
    return 'default';
  }

  function _tzOffsetMinutes() {
    // getTimezoneOffset returns minutes-EAST-of-UTC negated; we send the
    // intuitive sign (positive = ahead of UTC) so the server's date math
    // matches the user's local 'today'.
    return -1 * (new Date()).getTimezoneOffset();
  }

  function _todayLocal() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function _qs(params) {
    var s = [];
    for (var k in params) {
      if (params[k] != null) s.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
    }
    return s.length ? ('?' + s.join('&')) : '';
  }

  // ── Internal state ───────────────────────────────────────────────────────
  var STATE = {
    date: null,
    tier: 'free',
    degraded: false,
    layers: {},                    // { subconscious: {payload}, ... }
    order: DEFAULT_LAYER_ORDER.slice(),
    witnessed_at: null,
    last_event_ts: 0,
    sse: null,                     // EventSource
    sse_open: false,
    sse_attempts: 0,
    sse_reconnect_timer: null,
    listeners: {}                  // layer -> [cb,...]
  };

  function _emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); } catch (_) {}
  }

  // ── DOM binding ──────────────────────────────────────────────────────────
  // We don't own the markup — jarvis.html ships the containers. We just find
  // them by [data-jarvis-layer] and paint into named child slots:
  //   [data-jarvis-slot="headline"]
  //   [data-jarvis-slot="body"]
  //   [data-jarvis-slot="fragments"]   (we render <li> children)
  //   [data-jarvis-slot="updated"]     (relative time)
  //   [data-jarvis-slot="confidence"]  (numeric 0..1 → bar width via CSS var)
  //
  // The container also receives:
  //   data-jarvis-state="ready" | "loading" | "degraded" | "live"
  //   --jarvis-confidence: <0..1>   (CSS custom property)
  //   data-jarvis-updated-ms: <epoch>

  function _layerEl(layer) {
    return document.querySelector('[data-jarvis-layer="' + layer + '"]');
  }

  function _setText(el, sel, text) {
    if (!el) return;
    var t = el.querySelector('[data-jarvis-slot="' + sel + '"]');
    if (t) t.textContent = text || '';
  }

  function _fragText(f) {
    if (f == null) return '';
    if (typeof f === 'string') return f;
    if (typeof f === 'number') return String(f);
    // Objects from API: pick the most descriptive string field
    // Known shapes: {text,intensity}, {at,where,what}, {id,text,held_since},
    //               {layer,intensity,n}, {name,value}, {headline,...}
    if (f.text)     return f.text;
    if (f.what)     return [f.what, f.where ? '(' + f.where + ')' : ''].filter(Boolean).join(' ');
    if (f.name)     return f.name + (f.value != null ? ': ' + f.value : '');
    if (f.headline) return f.headline;
    if (f.layer)    return f.layer + (f.intensity != null ? ' ' + f.intensity : '');
    // Last resort: pull first string value from the object
    var keys = Object.keys(f);
    for (var i = 0; i < keys.length; i++) {
      if (typeof f[keys[i]] === 'string' && f[keys[i]].length > 0) return f[keys[i]];
    }
    return JSON.stringify(f);
  }

  function _setFragments(el, frags) {
    if (!el) return;
    var host = el.querySelector('[data-jarvis-slot="fragments"]');
    if (!host) return;
    host.innerHTML = '';
    if (!Array.isArray(frags)) return;
    frags.slice(0, 12).forEach(function (f) {
      var text = _fragText(f);
      if (!text) return;
      var li = document.createElement('li');
      li.textContent = text;
      host.appendChild(li);
    });
  }

  function _setUpdated(el, ts) {
    if (!el || !ts) return;
    var t = el.querySelector('[data-jarvis-slot="updated"]');
    if (t) {
      var d = new Date(ts);
      t.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      t.setAttribute('datetime', d.toISOString());
    }
    el.setAttribute('data-jarvis-updated-ms', String(ts));
  }

  function _setConfidence(el, c) {
    if (!el) return;
    var v = (typeof c === 'number') ? Math.max(0, Math.min(1, c)) : null;
    if (v == null) return;
    el.style.setProperty('--jarvis-confidence', String(v));
    var bar = el.querySelector('[data-jarvis-slot="confidence"]');
    if (bar) bar.setAttribute('aria-valuenow', String(Math.round(v * 100)));
  }

  // @CONTRACT — adjust here if sec10 ships a different per-layer shape
  function _paintLayer(layer, payload, source) {
    var el = _layerEl(layer);
    if (!el) return;
    if (!payload) {
      // Mark degraded — CSS owns the "live data slow" label via ::after,
      // do NOT also stamp it into the headline slot (that produced 8x
      // duplicate text on screen, screenshot 2026-05-10 0506). Leave
      // existing headline/body text in place if any prior render put
      // something useful there; otherwise the panel just looks empty,
      // which is a more honest signal than a stamped error string.
      el.setAttribute('data-jarvis-state', 'degraded');
      return;
    }
    el.setAttribute('data-jarvis-state', source === 'sse' ? 'live' : 'ready');
    _setText(el, 'headline', payload.headline || '');
    _setText(el, 'body', payload.body || '');
    _setFragments(el, payload.fragments || []);
    _setUpdated(el, payload.updated_at || Date.now());
    _setConfidence(el, payload.confidence);

    // Brief "just updated" pulse for SSE deltas — CSS owns the visual.
    if (source === 'sse') {
      el.classList.remove('jarvis-pulse');
      // force reflow so the animation can re-trigger
      void el.offsetWidth;
      el.classList.add('jarvis-pulse');
    }
  }

  function _paintFeltQuality(text) {
    var el = document.querySelector('[data-jarvis-felt-quality]');
    if (el && text) el.textContent = text;
  }

  function _paintMeta() {
    var dEl = document.querySelector('[data-jarvis-date]');
    if (dEl) dEl.textContent = STATE.date || '';
    var tEl = document.querySelector('[data-jarvis-tier]');
    if (tEl) tEl.textContent = (STATE.tier || 'free').toUpperCase();
    var degEl = document.querySelector('[data-jarvis-degraded]');
    if (degEl) {
      if (STATE.degraded) degEl.removeAttribute('hidden');
      else degEl.setAttribute('hidden', '');
    }
  }

  // @CONTRACT — adjust here if sec10 ships a different envelope shape
  function _renderEnvelope(env) {
    if (!env || typeof env !== 'object') return;
    STATE.date = env.date || _todayLocal();
    STATE.tier = env.tier || 'free';
    STATE.degraded = !!env.degraded;
    STATE.witnessed_at = env.witnessed_at || null;
    if (Array.isArray(env.order) && env.order.length) STATE.order = env.order.slice();

    _paintMeta();
    if (env.felt_quality) _paintFeltQuality(env.felt_quality);

    var layers = env.layers || {};
    STATE.order.forEach(function (layer) {
      var payload = layers[layer];
      STATE.layers[layer] = payload || null;
      _paintLayer(layer, payload, 'rest');
    });

    if (STATE.degraded) {
      _emit('vint:jarvis:degraded', { partial: true, missing: STATE.order.filter(function (l) { return !layers[l]; }) });
    }

    try { localStorage.setItem(STORAGE_KEY_LAST_DATE, STATE.date); } catch (_) {}
  }

  // @CONTRACT — adjust here if sec10's SSE event shape differs
  function _applyDelta(eventName, dataObj) {
    STATE.last_event_ts = Date.now();
    if (eventName === 'layer') {
      var layer = dataObj && dataObj.layer;
      if (!layer) return;
      var payload = dataObj.payload || dataObj;
      STATE.layers[layer] = payload;
      _paintLayer(layer, payload, 'sse');
      _emit('vint:jarvis:layer_updated', { layer: layer, payload: payload, source: 'sse', ts: STATE.last_event_ts });
      // Notify per-layer subscribers
      var subs = STATE.listeners[layer] || [];
      subs.forEach(function (cb) { try { cb(payload); } catch (_) {} });
    } else if (eventName === 'felt_quality') {
      _paintFeltQuality(dataObj && dataObj.text);
    } else if (eventName === 'degraded') {
      STATE.degraded = true;
      _paintMeta();
      _emit('vint:jarvis:degraded', dataObj || { partial: true });
    } else if (eventName === 'heartbeat') {
      // no-op; presence of the event keeps the connection alive
    }
  }

  // ── Network: REST envelope fetch ─────────────────────────────────────────
  function fetchEnvelope(opts) {
    opts = opts || {};
    var date = opts.date || _todayLocal();
    var url = _apiBase() + '/api/jarvis/today/' + encodeURIComponent(_userId()) +
              _qs({ date: date });

    var headers = {
      'Accept': 'application/json',
      'X-TZ-Offset': String(_tzOffsetMinutes())
    };
    var tok = _authToken();
    if (tok) headers['Authorization'] = 'Bearer ' + tok;

    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (_) {} }, REST_TIMEOUT_MS);

    return fetch(url, { method: 'GET', headers: headers, cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error('http-' + r.status);
        return r.json();
      })
      .then(function (env) {
        _renderEnvelope(env);
        _emit('vint:jarvis:opened', { date: STATE.date, tier: STATE.tier, degraded: STATE.degraded });
        // Mark cross-tab open
        try { localStorage.setItem(STORAGE_KEY_OPENED, String(Date.now())); } catch (_) {}
        return env;
      })
      .catch(function (err) {
        clearTimeout(timer);
        // Soft-degrade: paint what we have (probably nothing on first load)
        STATE.degraded = true;
        _paintMeta();
        _emit('vint:jarvis:degraded', { partial: false, error: String(err && err.message || err) });
        // Re-render any cached layers so a stale view beats an empty one
        STATE.order.forEach(function (l) { _paintLayer(l, STATE.layers[l] || null, 'rest'); });
        throw err;
      });
  }

  // ── Network: SSE stream ──────────────────────────────────────────────────
  function _openStream() {
    if (typeof EventSource !== 'function') return;
    if (STATE.sse) { try { STATE.sse.close(); } catch (_) {} STATE.sse = null; }

    // Token auth for SSE: EventSource can't set headers, so token rides on
    // the query string (sec10's endpoint accepts ?token= as a fallback —
    // that's the same pattern voice_in.js uses for the WS lane).
    var tok = _authToken();
    var url = _apiBase() + '/api/jarvis/stream/' + encodeURIComponent(_userId()) +
              _qs({ token: tok || null, tz: _tzOffsetMinutes() });

    var es;
    try { es = new EventSource(url, { withCredentials: false }); }
    catch (e) { _scheduleReconnect(); return; }

    STATE.sse = es;

    es.addEventListener('open', function () {
      STATE.sse_open = true;
      STATE.sse_attempts = 0;
      _emit('vint:jarvis:sse_open', { ts: Date.now() });
    });

    // Generic message — JSON envelope with {event, data}
    es.addEventListener('message', function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (_) { return; }
      _applyDelta(msg.event || 'message', msg.data || msg);
    });

    // Named server events (sec10 should dispatch these by name)
    ['layer', 'felt_quality', 'degraded', 'heartbeat'].forEach(function (name) {
      es.addEventListener(name, function (ev) {
        var data;
        try { data = JSON.parse(ev.data); } catch (_) { data = {}; }
        _applyDelta(name, data);
      });
    });

    es.addEventListener('error', function () {
      STATE.sse_open = false;
      _emit('vint:jarvis:sse_close', { ts: Date.now() });
      try { es.close(); } catch (_) {}
      STATE.sse = null;
      _scheduleReconnect();
    });
  }

  function _scheduleReconnect() {
    if (STATE.sse_reconnect_timer) return;
    STATE.sse_attempts++;
    var backoff = Math.min(SSE_RECONNECT_MAX_MS,
      SSE_RECONNECT_MIN_MS * Math.pow(1.7, STATE.sse_attempts - 1));
    // Add 0-30% jitter
    backoff = backoff * (1 + Math.random() * 0.3);
    STATE.sse_reconnect_timer = setTimeout(function () {
      STATE.sse_reconnect_timer = null;
      _openStream();
    }, backoff);
  }

  // ── Witness POST (fires once per page on first interaction) ──────────────
  var WITNESS_FIRED = false;
  function postWitness() {
    if (WITNESS_FIRED) return Promise.resolve(null);
    WITNESS_FIRED = true;
    var url = _apiBase() + '/api/jarvis/today/' + encodeURIComponent(_userId()) + '/witness';
    var headers = { 'Content-Type': 'application/json' };
    var tok = _authToken();
    if (tok) headers['Authorization'] = 'Bearer ' + tok;
    return fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ date: STATE.date || _todayLocal() }),
      cache: 'no-store'
    }).then(function (r) {
      if (!r.ok) throw new Error('witness-http-' + r.status);
      return r.json();
    }).then(function (j) {
      STATE.witnessed_at = (j && j.witnessed_at) || Date.now();
      _emit('vint:jarvis:witnessed', { date: STATE.date, ts: STATE.witnessed_at });
      return j;
    }).catch(function (err) {
      // Don't unfire — one attempt per page even if it failed; the next
      // page load will retry. We don't want to spam witness on every click.
      _emit('vint:jarvis:witness_failed', { error: String(err && err.message || err) });
      return null;
    });
  }

  function _wireFirstInteractionWitness() {
    var fire = function () { postWitness(); cleanup(); };
    var events = ['pointerdown', 'click', 'keydown', 'touchstart', 'wheel'];
    function cleanup() {
      events.forEach(function (ev) { window.removeEventListener(ev, fire, true); });
    }
    events.forEach(function (ev) {
      window.addEventListener(ev, fire, { capture: true, once: true, passive: true });
    });
  }

  // ── Cross-tab sync ───────────────────────────────────────────────────────
  window.addEventListener('storage', function (e) {
    if (!e || !e.key) return;
    if (e.key === STORAGE_KEY_OPENED) {
      _emit('vint:jarvis:peer_opened', { ts: Number(e.newValue) || Date.now() });
    } else if (e.key === STORAGE_KEY_LAST_DATE && e.newValue && e.newValue !== STATE.date) {
      // Another tab moved to a new date (midnight rollover) — refetch ours
      fetchEnvelope({ date: e.newValue }).catch(function () {});
    }
  });

  // ── Boot ─────────────────────────────────────────────────────────────────
  function _boot() {
    // Only mount on a page that actually has the JARVIS surface.
    if (!document.querySelector('[data-jarvis-root]')) return;

    fetchEnvelope().catch(function () { /* degraded UI already painted */ });
    _openStream();
    _wireFirstInteractionWitness();

    // Midnight rollover watch — if the local date changes, refetch today.
    var lastDate = STATE.date || _todayLocal();
    setInterval(function () {
      var now = _todayLocal();
      if (now !== lastDate) {
        lastDate = now;
        fetchEnvelope({ date: now }).catch(function () {});
      }
    }, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot, { once: true });
  } else {
    _boot();
  }

  // ── Public API ───────────────────────────────────────────────────────────
  window.JARVIS = {
    __realBody: true,
    reload: function () { return fetchEnvelope({ date: STATE.date || _todayLocal() }); },
    date: function () { return STATE.date; },
    tier: function () { return STATE.tier; },
    witness: postWitness,
    last: function () {
      return {
        date: STATE.date,
        tier: STATE.tier,
        degraded: STATE.degraded,
        witnessed_at: STATE.witnessed_at,
        sse_open: STATE.sse_open,
        sse_attempts: STATE.sse_attempts,
        last_event_ts: STATE.last_event_ts,
        layers: Object.keys(STATE.layers).reduce(function (acc, k) {
          acc[k] = STATE.layers[k] ? {
            updated_at: STATE.layers[k].updated_at,
            confidence: STATE.layers[k].confidence,
            has_body: !!STATE.layers[k].body
          } : null;
          return acc;
        }, {})
      };
    },
    on: function (layer, cb) {
      if (!layer || typeof cb !== 'function') return function () {};
      if (!STATE.listeners[layer]) STATE.listeners[layer] = [];
      STATE.listeners[layer].push(cb);
      return function unsub() {
        STATE.listeners[layer] = (STATE.listeners[layer] || []).filter(function (f) { return f !== cb; });
      };
    }
  };
})();
