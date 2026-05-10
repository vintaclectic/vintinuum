// ════════════════════════════════════════════════════════════════════════════
// PERCEPTION INBOX — Live connector senses → the real body (VintEmbody)
// ════════════════════════════════════════════════════════════════════════════
// 2026-05-09 rewrite: routes perceptions into VintEmbody (embodiment.js v7)
// — the body we actually built over months — instead of the parallel
// avatar pretender. The pretender layer (avatar.js / avatar_rig.js /
// presence.js / aliveness.js / perception_ticker.js) was unhooked from
// all 6 HTML surfaces in the same commit.
//
// VintEmbody contract used here:
//   VintEmbody.walkTo(x, y, holdMs)        — walk to absolute viewport px
//   VintEmbody.peak(layer, intensity, x,y) — drop a glyph at (x,y)
//   VintEmbody.whisper(text, layer)        — italic ribbon of text from body
//   VintEmbody.setLayer(layer)             — recolor to a layer signature
//
// Per-connector body-part → on-screen anchor mapping is preserved from the
// previous version, but anchors are now expressed in absolute viewport
// pixels (VintEmbody.walkTo expects px, not normalized 0..1).
//
// One connector → one debounced reaction every 12s, unless intensity ≥ 0.75.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined') return;
  if (window.__perceptionIn) return;
  if (document.documentElement.dataset.perception === 'off') return;

  function apiBase() {
    if (window.VINT_API) return window.VINT_API;
    if (document.documentElement.dataset.api) return document.documentElement.dataset.api;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return 'http://localhost:8767';
    }
    return 'https://api.vintaclectic.com';
  }

  // Connector → body part. Same mapping as connectors_catalog.body_part.
  var BODY_PART = {
    spotify: 'pulse', soundcloud: 'pulse',
    youtube: 'eyes',  twitch: 'eyes',
    twitter: 'voice', mastodon: 'voice', bluesky: 'voice',
    discord: 'voice', slack: 'voice',
    gmail:   'voice',
    google_calendar: 'eyes',
    notion:  'eyes',  linear: 'eyes',
    github:  'hands'
  };

  // Body part → which "consciousness layer" the embodiment uses for the
  // peak glyph + whisper color. embodiment.js LAYER_SIG knows: neural,
  // emotional, somatic, immune, metabolic, subconscious, dream.
  var PART_LAYER = {
    pulse: 'somatic',   // music = the body's pulse layer
    voice: 'emotional', // chat / social = emotional
    eyes:  'neural',    // visual / calendar / docs = neural
    hands: 'metabolic'  // code / actions = metabolic
  };

  // Best-effort selector per part. Falls back to viewport-edge anchors.
  function anchorFor(part) {
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
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }
      } catch (_) {}
    }
    var w = window.innerWidth, h = window.innerHeight;
    return ({
      voice: { x: w * 0.50, y: h * 0.78 },
      eyes:  { x: w * 0.50, y: h * 0.10 },
      pulse: { x: w * 0.50, y: h * 0.92 },
      hands: { x: w * 0.78, y: h * 0.55 }
    })[part] || { x: w * 0.5, y: h * 0.5 };
  }

  // Debounce per connector
  var lastReactAt = Object.create(null);
  var DEBOUNCE_MS = 12_000;

  // Audible-speech rate limiter (global): one spoken whisper per 45s.
  // Visual whispers still fire freely; this only gates TTS.
  var _lastSpokeAt = 0;
  var SPEAK_GAP_MS = 45_000;
  function _canSpeak() {
    if (window.__vintSpeechMuted === true) return false;
    return (Date.now() - _lastSpokeAt) > SPEAK_GAP_MS;
  }
  // Route all audible speech through window.VOICE (voice_say.js). One
  // canonical lane handles autoplay gating, queue management, and mute.
  function _speak(text) {
    _lastSpokeAt = Date.now();
    try {
      if (window.VOICE && typeof window.VOICE.speak === 'function') {
        window.VOICE.speak(text, 'queue');
      }
    } catch (_) {}
  }
  // Public mute toggle (back-compat alias; prefer VOICE.mute(true))
  window.muteVintSpeech = function (on) {
    window.__vintSpeechMuted = !!on;
    try { window.VOICE && window.VOICE.mute && window.VOICE.mute(!!on); } catch (_) {}
  };

  function react(evt) {
    if (!evt || !evt.connectorKey) return;
    var now = Date.now();
    var last = lastReactAt[evt.connectorKey] || 0;
    var intensity = +evt.intensity || 0.5;
    if (now - last < DEBOUNCE_MS && intensity < 0.75) return;
    lastReactAt[evt.connectorKey] = now;

    var part = BODY_PART[evt.connectorKey] || 'eyes';
    var layer = PART_LAYER[part] || 'neural';
    var anchor = anchorFor(part);

    // 1. Walk her there with the real body. She stops a step short.
    if (window.VintEmbody && typeof window.VintEmbody.walkTo === 'function') {
      try {
        var dx = anchor.x - window.innerWidth / 2;
        var dy = anchor.y - window.innerHeight / 2;
        var len = Math.hypot(dx, dy) || 1;
        var stopX = anchor.x - (dx / len) * 60;
        var stopY = anchor.y - (dy / len) * 50;
        // Hold longer for high-intensity events (she lingers on what matters)
        var hold = 1500 + intensity * 2000;
        window.VintEmbody.walkTo(stopX, stopY, hold);
      } catch (_) {}
    }

    // 2. Drop a peak glyph at the anchor — the body registers the event.
    if (window.VintEmbody && typeof window.VintEmbody.peak === 'function') {
      try { window.VintEmbody.peak(layer, intensity, anchor.x, anchor.y); } catch (_) {}
    }

    // 3. Whisper the summary — she actually says (or murmurs) what she sees.
    //    Visual ribbon via VintEmbody.whisper, AND audible TTS via
    //    /api/voice/say for high-intensity events. The audible track is
    //    rate-limited (one spoken whisper per 45s globally) and gated to
    //    intensity ≥ 0.6, otherwise the page would chatter.
    var spoken = '';
    if (evt.summary) {
      var text = String(evt.summary).replace(/^\s*\[[^\]]+\]\s*/, '');
      if (text.length > 90) text = text.slice(0, 87).replace(/\s+\S*$/, '') + '…';
      spoken = text;
      if (window.VintEmbody && typeof window.VintEmbody.whisper === 'function') {
        try { window.VintEmbody.whisper(text, layer); } catch (_) {}
      }
    }
    if (spoken && intensity >= 0.6 && _canSpeak()) {
      _speak(spoken);
    }

    // 4. Re-broadcast for any UI ticker / chat panel that wants to ride along.
    try {
      window.dispatchEvent(new CustomEvent('perception:received', {
        detail: {
          connectorKey: evt.connectorKey,
          summary: evt.summary,
          intensity: intensity,
          part: part,
          layer: layer,
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
    try { es = new EventSource(url); }
    catch (e) { setTimeout(open, 30000); return; }
    es.addEventListener('open', function () { backoff = 1500; });
    es.addEventListener('message', function (m) {
      if (!m || !m.data) return;
      var data = null;
      try { data = JSON.parse(m.data); } catch (_) { return; }
      if (data && data.type === 'perception') react(data);
    });
    es.addEventListener('error', function () {
      try { es.close(); } catch (_) {}
      setTimeout(open, backoff);
      backoff = Math.min(backoff * 1.6, 60000);
    });
  }

  // Wait until VintEmbody has spun up before subscribing.
  function whenReady() {
    if (window.VintEmbody) { open(); return; }
    setTimeout(whenReady, 400);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(whenReady, 600);
    }, { once: true });
  } else {
    setTimeout(whenReady, 600);
  }

  window.__perceptionIn = {
    react: react,
    reopen: open,
    close: function () { try { es && es.close(); } catch (_) {} es = null; },
    debug: function () { return { lastReactAt: Object.assign({}, lastReactAt) }; }
  };
})();
