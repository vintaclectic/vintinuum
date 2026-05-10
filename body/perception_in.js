// ════════════════════════════════════════════════════════════════════════════
// PERCEPTION INBOX — Live connector senses → avatar reactions (Phase 6.6)
// ════════════════════════════════════════════════════════════════════════════
// The connector-harvester writes a connector_perception memory whenever a
// connector lights up — Spotify changed track, a new tweet arrived, a
// calendar event is approaching, GitHub got a notification, etc. The brain
// also rebroadcasts that same event over /api/life/stream as a JSON frame:
//
//   { type: 'perception', connectorKey, summary, intensity, body, ts }
//
// This module subscribes once per page, debounces noisy connectors, and
// translates each perception into a small embodied reaction:
//
//   - quick glance toward the relevant body-part anchor on screen
//     (voice → chat input, eyes → topbar, pulse → footer / dock)
//   - micro-pose nudge (head tilt for surprise, lean-in for high intensity)
//   - rig mood blip (dopamine micro-bump for music; arousal nudge for
//     high-intensity events)
//   - emits a `perception:received` window event so other surfaces (chat
//     ticker, brain panel, anything) can listen too
//
// It does NOT write to the DB. It does NOT call the brain. It just listens
// and reacts. The avatar can be opted out with <html data-perception="off">.
//
// Reconnect: EventSource auto-reconnects. We add a small jittered backoff
// only if the connection rejects with 503 (life-stream at capacity).
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined') return;
  if (window.__perceptionIn) return;
  if (document.documentElement.dataset.perception === 'off') return;

  // Where the brain lives. Match the convention used by other client code:
  // window.VINT_API or default to api.vintaclectic.com. localhost dev can
  // override with <html data-api="http://localhost:8767">.
  function apiBase() {
    if (window.VINT_API) return window.VINT_API;
    if (document.documentElement.dataset.api) return document.documentElement.dataset.api;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return 'http://localhost:8767';
    }
    return 'https://api.vintaclectic.com';
  }

  // Body-part → on-screen anchor selector (best effort; falls back to viewport
  // edge zones if no element matches). The harvester schedule already maps
  // each connector to a body part via connectors_catalog, but for the client
  // we only need a lightweight mapping.
  var BODY_PART = {
    spotify:         'pulse',  soundcloud: 'pulse',
    youtube:         'eyes',   twitch: 'eyes',
    twitter:         'voice',  mastodon: 'voice', bluesky: 'voice',
    discord:         'voice',  slack: 'voice',
    gmail:           'voice',
    google_calendar: 'eyes',
    notion:          'eyes',   linear: 'eyes',
    github:          'hands'
  };

  // Where on the screen each body-part lives. Numbers are normalized
  // 0..1 viewport coords. The avatar walks/glances toward these anchors.
  function anchorFor(part) {
    // Prefer real elements when present.
    var sel = ({
      voice: 'textarea, input[type="text"], #message-input, .chat-input',
      eyes:  'header, .topbar, h1, .panel-header',
      pulse: '.footer, .dock, .bottom-bar, footer',
      hands: 'button, .btn, .cta'
    })[part];
    if (sel) {
      try {
        var els = Array.from(document.querySelectorAll(sel));
        var visible = els.filter(function (el) {
          var r = el.getBoundingClientRect();
          return r.width > 20 && r.height > 12 &&
                 r.bottom > 0 && r.top < window.innerHeight;
        });
        if (visible.length) {
          var pick = visible[Math.floor(Math.random() * visible.length)];
          var r = pick.getBoundingClientRect();
          return {
            x: (r.left + r.width / 2) / window.innerWidth,
            y: (r.top + r.height / 2) / window.innerHeight
          };
        }
      } catch (_) {}
    }
    // Fallback zones.
    return ({
      voice: { x: 0.5,  y: 0.78 },
      eyes:  { x: 0.5,  y: 0.10 },
      pulse: { x: 0.5,  y: 0.92 },
      hands: { x: 0.78, y: 0.55 }
    })[part] || { x: 0.5, y: 0.5 };
  }

  // Per-connector debounce — Spotify can change tracks every 30s and we
  // don't want her bobbing the whole time. One reaction per connector per
  // 12s, with intensity allowed to upgrade an in-flight reaction.
  var lastReactAt = Object.create(null);
  var DEBOUNCE_MS = 12_000;

  function react(evt) {
    if (!evt || !evt.connectorKey) return;
    var now = Date.now();
    var last = lastReactAt[evt.connectorKey] || 0;
    if (now - last < DEBOUNCE_MS && (evt.intensity || 0) < 0.75) return;
    lastReactAt[evt.connectorKey] = now;

    var part = BODY_PART[evt.connectorKey] || 'eyes';
    var anchor = anchorFor(part);
    var intensity = +evt.intensity || 0.5;

    // 1. Glance toward the anchor. Prefer aliveness API (has lookAtPos),
    //    falls back to avatar-rig direct mood prod.
    try {
      if (window.__aliveness && window.__aliveness.lookAt) {
        // Synthesize a fake selector via direct position call is ideal,
        // but the public API takes a selector. Use rig directly for pos.
      }
      if (window.__avatarRig && window.__avatarRig.glance) {
        window.__avatarRig.glance(anchor.x, anchor.y, 1400);
      } else if (window.__avatar) {
        // Ultra-fallback: nudge profileMix toward the anchor side.
        var p = window.__avatar.pose();
        var mix = anchor.x < 0.5 ? -0.35 : 0.35;
        window.__avatar.setPose({ profileMix: mix });
        setTimeout(function () {
          if (window.__avatar) window.__avatar.setPose({ profileMix: 0 });
        }, 1200);
      }
    } catch (_) {}

    // 2. High-intensity perception → small walk toward the anchor.
    //    Only if she's not already walking and convo isn't active.
    if (intensity >= 0.7 && window.__aliveness && window.__aliveness.walkTo) {
      try {
        // Stop a meter short — she notices, she does not pounce.
        var dx = anchor.x - 0.5, dy = anchor.y - 0.5;
        var len = Math.hypot(dx, dy) || 1;
        var stopX = anchor.x - (dx / len) * 0.12;
        var stopY = anchor.y - (dy / len) * 0.10;
        window.__aliveness.walkTo(stopX, stopY);
      } catch (_) {}
    }

    // 3. Rig mood blip — pulse connectors (music) get a dopamine micro-bump,
    //    voice connectors (chat) get arousal nudge.
    try {
      if (window.__avatarRig && window.__avatarRig.bump) {
        if (part === 'pulse') {
          window.__avatarRig.bump({ dopamine: 0.05 + intensity * 0.05, gold: intensity });
        } else if (part === 'voice') {
          window.__avatarRig.bump({ arousal: 0.04 + intensity * 0.04 });
        } else if (part === 'eyes') {
          window.__avatarRig.bump({ alertness: 0.05 });
        } else if (part === 'hands') {
          window.__avatarRig.bump({ dopamine: 0.03 });
        }
      }
    } catch (_) {}

    // 4. Re-broadcast on a window event so other UI can ride along —
    //    chat ticker, brain panel, perception toast, etc.
    try {
      window.dispatchEvent(new CustomEvent('perception:received', {
        detail: {
          connectorKey: evt.connectorKey,
          summary: evt.summary,
          intensity: intensity,
          part: part,
          anchor: anchor,
          ts: evt.ts || now
        }
      }));
    } catch (_) {}
  }

  // ── SSE subscription ──────────────────────────────────────────────────────
  var es = null;
  var backoff = 1500;

  function open() {
    try { if (es) es.close(); } catch (_) {}
    var url = apiBase().replace(/\/+$/, '') + '/api/life/stream';
    try {
      es = new EventSource(url);
    } catch (e) {
      // EventSource construction itself failed (shouldn't happen in modern
      // browsers, but be defensive). Retry slowly.
      setTimeout(open, 30000);
      return;
    }
    es.addEventListener('open', function () { backoff = 1500; });
    es.addEventListener('message', function (m) {
      if (!m || !m.data) return;
      var data = null;
      try { data = JSON.parse(m.data); } catch (_) { return; }
      if (data && data.type === 'perception') react(data);
    });
    es.addEventListener('error', function () {
      // Browser auto-reconnects, but if we got 503 (capacity) it gives up.
      // Backoff manually then re-open.
      try { es.close(); } catch (_) {}
      setTimeout(open, backoff);
      backoff = Math.min(backoff * 1.6, 60000);
    });
  }

  // Wait until the avatar trio has had time to spin up before subscribing.
  // The first perception event in the wild would otherwise have nothing
  // to drive.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(open, 2000);
    }, { once: true });
  } else {
    setTimeout(open, 2000);
  }

  window.__perceptionIn = {
    react: react,
    reopen: open,
    close: function () { try { es && es.close(); } catch (_) {} es = null; },
    debug: function () { return { lastReactAt: Object.assign({}, lastReactAt) }; }
  };
})();
