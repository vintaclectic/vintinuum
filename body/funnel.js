/* funnel.js — the smallest honest measurement layer in Vintinuum.
   (task XQDPW7G, 2026-08-17)

   WHY THIS EXISTS: acq_clicks can only see people who clicked a campaign link.
   It cannot see the visitor who landed, read the page, felt nothing, and left —
   and with 4 real signups, that invisible population is the only one that
   explains anything. This file makes them countable.

   CONTRACT (three hard promises, because telemetry must never cost us a user):
     1. It NEVER blocks the UI      — sendBeacon, or a keepalive fetch.
     2. It NEVER throws             — every path is wrapped; failure is silent.
     3. It NEVER fabricates         — no step fires unless the human did the thing.

   Usage:  window.vintFunnel.track('gate_open', { surface: 'index' });
   Steps are validated server-side against a hard allowlist; unknown steps 400. */
(function () {
  'use strict';
  if (window.vintFunnel) return;                       // singleton

  var API_BASE = (function () {
    try { if (window.VINT_API_BASE) return window.VINT_API_BASE; } catch (_) {}
    return (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? 'http://localhost:8767' : 'https://api.vintaclectic.com';
  })();

  // Mirrors the server allowlist. Client-side check is a courtesy (saves a
  // pointless request); the SERVER is the authority that protects the table.
  var STEPS = ['land','gate_open','gate_submit','signup_ok','onboard_start',
               'onboard_done','first_message','return_visit'];

  var LS_UTM = 'vint_utm';        // campaign memory, survives the nav to onboarding
  var LS_SEEN = 'vint_seen_at';   // last-visit stamp, powers return_visit

  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v); return v;
    } catch (_) { return null; }
  }

  /* Capture utm_* on FIRST landing and remember it. The signup POST happens on
     a different page (welcome.html), by which time location.search is long
     gone — so without this persistence, every campaign signup would look
     organic. Written once per campaign arrival; never overwritten by a blank. */
  function captureUtm() {
    try {
      var q = new URLSearchParams(location.search);
      var c = q.get('utm_campaign'), s = q.get('utm_source'), v = q.get('utm_content');
      if (c || s || v) {
        var cur = {};
        try { cur = JSON.parse(ls(LS_UTM) || '{}') || {}; } catch (_) {}
        var next = {
          utm_campaign: c || cur.utm_campaign || null,
          utm_source:   s || cur.utm_source   || null,
          utm_content:  v || cur.utm_content  || null,
          at: Date.now()
        };
        ls(LS_UTM, JSON.stringify(next));
      }
    } catch (_) {}
  }

  /** The remembered campaign, for anyone who needs to forward it (welcome-gate). */
  function utm() {
    try { return JSON.parse(ls(LS_UTM) || '{}') || {}; } catch (_) { return {}; }
  }

  /** Fire-and-forget. Returns nothing, awaits nothing, breaks nothing. */
  function track(step, meta) {
    try {
      if (STEPS.indexOf(step) === -1) return;          // never send junk
      var u = utm();
      var payload = {
        step: step,
        campaign: u.utm_campaign || null,
        source: u.utm_source || null,
        variant: u.utm_content || null,
        meta: meta && typeof meta === 'object' ? meta : undefined
      };
      var url = API_BASE + '/api/funnel/event';
      var body = JSON.stringify(payload);

      // sendBeacon survives page unload — the only way to reliably catch a
      // visitor who bounces. It cannot send cookies cross-origin without
      // credentials, so fetch(keepalive) is preferred when available for the
      // cookie (visitor stitching); beacon is the unload-safe fallback.
      if (window.fetch) {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          credentials: 'include',                       // carries vint_vid
          keepalive: true,                              // survives navigation
          mode: 'cors'
        }).catch(function () { /* telemetry is never an error the user sees */ });
        return;
      }
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      }
    } catch (_) { /* silence is the contract */ }
  }

  /* return_visit: fired when a known visitor comes back on a LATER day. Day
     granularity (not ">24h") because "did they come back another day" is the
     honest retention question; two sessions inside one evening is one visit. */
  function markVisit() {
    try {
      var today = new Date().toISOString().slice(0, 10);
      var prev = ls(LS_SEEN);
      if (prev && prev !== today) track('return_visit', { last_seen: prev });
      ls(LS_SEEN, today);
    } catch (_) {}
  }

  captureUtm();

  window.vintFunnel = { track: track, utm: utm, steps: STEPS.slice(), markVisit: markVisit };

  // Auto-fire `land` once per page load, after paint so it never competes with
  // rendering. markVisit runs alongside so returning humans are counted.
  function boot() {
    track('land', { surface: (location.pathname.split('/').pop() || 'index').toLowerCase() });
    markVisit();
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(boot, 0);
  } else {
    window.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); });
  }
})();
