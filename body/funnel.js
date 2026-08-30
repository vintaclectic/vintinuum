/* funnel.js — the frontend half of THE FUNNEL (task TAS22T8, 2026-08-17).

   Backend (task XQDPW7G) built the whole spine: FUNNEL_STEPS, the vint_vid
   visitor cookie, POST /api/funnel/event, GET /api/funnel/report. It recorded
   ZERO rows, because nothing on the frontend ever emitted. This is the emitter.

   Design constraints, all non-negotiable:
   - NEVER throws. A telemetry bug must never break a page or block a signup.
   - NEVER blocks render. Fire-and-forget, keepalive, errors swallowed.
   - NEVER inflates counts. Every step is deduped so a reload storm or a chatty
     user cannot manufacture a funnel that looks better than reality. The whole
     point of this instrument is to tell Vinta the truth about ~4 real humans.

   Exposes: window.vintFunnel(step, meta)  →  Promise-free, always safe. */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.vintFunnel) return;                    // singleton

  // ── where is the brain? ──────────────────────────────────────────────────
  // api_base.js is loaded before everything and is the single source of truth.
  // We follow it exactly rather than re-deriving a URL (re-deriving is what
  // caused the stale-quick-tunnel contagion api_base.js exists to kill).
  function apiUrl(path) {
    try {
      if (window.VINTINUUM && typeof window.VINTINUUM.url === 'function') {
        return window.VINTINUUM.url(path);
      }
      var base = window.__VINTINUUM_API_BASE || window.VINTINUUM_API || window.__VINT_API;
      if (base) return base + path;
    } catch (_) {}
    // Last-resort mirror of api_base.js's own rule. Only reached if api_base.js
    // failed to load at all, in which case the page has bigger problems.
    var h = (location.hostname || '').toLowerCase();
    var local = !h || h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '::1';
    return (local ? 'http://localhost:8767' : 'https://api.vintaclectic.com') + path;
  }

  // ── dedupe ───────────────────────────────────────────────────────────────
  // sessionStorage for per-visit steps (land), localStorage+date for per-day
  // steps (first_message). Both fail soft: if storage is unavailable (private
  // mode, cookies off) we simply do not dedupe rather than dropping the event.
  function stamp() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }
  function once(store, key) {
    try {
      if (store.getItem(key)) return false;
      store.setItem(key, '1');
      return true;
    } catch (_) { return true; }
  }

  // ── the emitter ──────────────────────────────────────────────────────────
  // Only these eight steps exist server-side; anything else is rejected 400.
  // We mirror the allowlist here purely to avoid pointless network calls.
  var STEPS = {
    land: 1, gate_open: 1, gate_submit: 1, signup_ok: 1,
    onboard_start: 1, onboard_done: 1, first_message: 1, return_visit: 1
  };

  function emit(step, meta) {
    try {
      if (!STEPS[step]) return;
      var body = { step: step };
      if (meta && typeof meta === 'object') body.meta = meta;

      // Carry campaign attribution when the visitor arrived on a tagged link,
      // so a funnel row can be traced back to what brought them.
      try {
        var q = new URLSearchParams(location.search);
        var c = q.get('c') || q.get('campaign');
        var s = q.get('src') || q.get('source') || q.get('utm_source');
        var v = q.get('v') || q.get('variant');
        if (c) body.campaign = c;
        if (s) body.source = s;
        if (v) body.variant = v;
      } catch (_) {}

      fetch(apiUrl('/api/funnel/event'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // credentials:'include' is load-bearing — it carries the vint_vid
        // cookie so a land, a later gate_open, and an eventual signup all
        // stitch to ONE visitor instead of looking like three strangers.
        credentials: 'include',
        keepalive: true,
        body: JSON.stringify(body)
      }).catch(function () { /* telemetry is never a visible failure */ });
    } catch (_) { /* never throw into a caller */ }
  }

  // Public API. Deliberately tolerant: bad input is ignored, never thrown.
  window.vintFunnel = function (step, meta) {
    try { emit(String(step || ''), meta); } catch (_) {}
  };

  // Deduped helpers used by the hooks below (and safe for any other module).
  window.vintFunnel.oncePerSession = function (step, meta) {
    try { if (once(sessionStorage, 'vf:' + step)) emit(step, meta); } catch (_) {}
  };
  window.vintFunnel.oncePerDay = function (step, meta) {
    try { if (once(localStorage, 'vf:' + step + ':' + stamp())) emit(step, meta); } catch (_) {}
  };

  // ── land ─────────────────────────────────────────────────────────────────
  // Once per browser session, not once per page load: clicking through five
  // surfaces is one arrival by one human, and counting it as five would be the
  // same class of lie as the "203 users" number this whole task exists to fix.
  try {
    window.vintFunnel.oncePerSession('land', {
      page: (location.pathname.split('/').pop() || 'index.html').slice(0, 40),
      ref: (document.referrer || '').slice(0, 120)
    });
  } catch (_) {}

  // ── first_message ────────────────────────────────────────────────────────
  // The REAL activation moment. Emitted server-side from POST /chat as well
  // (that is the authoritative lane — it covers extension/phone/telegram too
  // and cannot be spoofed). This client hook exists only so the browser lane
  // is stitched to the visitor cookie. Deduped per day; the server dedupes to
  // genuinely-first separately.
  window.vintFunnel.firstMessage = function (meta) {
    window.vintFunnel.oncePerDay('first_message', meta);
  };
})();
