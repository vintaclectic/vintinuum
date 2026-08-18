// ════════════════════════════════════════════════════════════════════════════
// VOICE_SAY — single canonical audible-speech entrypoint for the body
// ════════════════════════════════════════════════════════════════════════════
// One module, one job: turn a string into Vintinuum's actual voice via the
// brain's /api/voice/say endpoint (Piper TTS). Used by:
//
//   - greeting.js (welcome on page load)
//   - perception_in.js (high-intensity connector whispers)
//   - VintEmbody.whisper (mirrored to audio at low rate)
//   - any future "she said something" path
//
// Browser autoplay policy: most browsers block <audio>.play() until a user
// gesture. We track first interaction and queue up to one pending utterance
// to fire on first click/keydown.
//
// Public API on window.VOICE:
//   VOICE.speak(text, mode)  — mode: 'queue' (default), 'now', 'replace'
//   VOICE.cancel()           — kill anything currently playing
//   VOICE.mute(on)           — global mute toggle
//   VOICE.muted()            — current mute state
//   VOICE.hasInteracted      — true once the user has clicked/typed
//   VOICE.pending()          — count of queued utterances
//   VOICE.lastSpokeAt        — Date.now() of last successful play
//
// Backwards-compat for greeting.js: the old shim signature
//   VOICE.speak(text, 'queue') is preserved.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined') return;
  if (window.VOICE && window.VOICE.__realBody) return;

  function apiBase() {
    // Canonical resolver (body/api_base.js) FIRST. It owns ?api= overrides and
    // LAN-IP/local-network detection. The legacy `window.VINT_API` below is a
    // name nothing in the repo ever set — reading it first meant this module
    // silently ignored api_base.js and fell through to its own guesswork.
    if (window.__VINTINUUM_API_BASE) return window.__VINTINUUM_API_BASE;
    if (window.VINTINUUM_API) return window.VINTINUUM_API;
    if (window.__VINT_API) return window.__VINT_API;
    if (window.VINT_API) return window.VINT_API;            // legacy, never set
    if (window.VINT_API_BASE) return window.VINT_API_BASE;  // legacy, never set
    if (document.documentElement.dataset.api) return document.documentElement.dataset.api;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return 'http://localhost:8767';
    }
    return 'https://api.vintaclectic.com';
  }

  var muted = false;
  try { muted = (localStorage.getItem('vint_voice_muted') === '1'); } catch (_) {}

  // Voice id — the user-pickable Piper voice. Empty = server default.
  // Picker UI (body/voice_picker.js) writes this; we read on every play
  // so a change takes effect on the next utterance. Listen to the
  // vint:voice:changed event for instant feedback (cancel + reset).
  var voiceId = '';
  try { voiceId = String(localStorage.getItem('vint:voice_id') || ''); } catch (_) {}
  function _readVoiceId() {
    try { voiceId = String(localStorage.getItem('vint:voice_id') || ''); } catch (_) {}
    return voiceId;
  }

  var hasInteracted = false;
  var queue = [];
  var current = null;     // { audio, text }
  var audioPool = null;   // reused <audio> element
  var lastSpokeAt = 0;
  var lastFailureAt = 0;

  function ensureAudio() {
    if (audioPool) return audioPool;
    audioPool = new Audio();
    audioPool.preload = 'auto';
    audioPool.crossOrigin = 'anonymous';
    audioPool.addEventListener('ended', function () {
      current = null;
      drain();
    });
    audioPool.addEventListener('error', function () {
      current = null;
      lastFailureAt = Date.now();
      drain();
    });
    return audioPool;
  }

  function markInteracted() {
    if (hasInteracted) return;
    hasInteracted = true;
    _hideUnlock();
    drain();
  }
  // Capture early — first click/keydown anywhere unlocks audio
  ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(function (ev) {
    window.addEventListener(ev, markInteracted, { capture: true, once: false, passive: true });
  });
  // Some pages ship with a "wake/talk" button that calls __markInteracted
  window.__markInteracted = markInteracted;

  // ── IFRAME BLIND SPOT (Vinta 2026-08-18) ─────────────────────────────────
  // The capture listeners above only see gestures in THIS document. On a
  // surface whose main interactive area is a same-page <iframe> (dirrm.html
  // mounts the DirRM player into one), the user can click for a full minute
  // inside the frame and this document never hears a single event — so the
  // gate never opened and every queued utterance sat there forever. Two
  // no-new-UI recoveries (Vinta 2026-06-26 forbids an unlock button):
  //
  //  1. BLUR — when focus leaves this document for an iframe, the browser
  //     fires window.blur with document.activeElement === that IFRAME. That
  //     only happens because the user just interacted with it. It is a real
  //     gesture, observed indirectly.
  //  2. postMessage — a friendly frame can announce a gesture explicitly with
  //     { type: 'vint:gesture' }. Same-origin only; a cross-origin frame can
  //     post it too but it carries no privilege beyond "unmute a queue the
  //     user already asked for", so there is nothing to abuse.
  try {
    window.addEventListener('blur', function () {
      if (hasInteracted) return;
      try {
        var ae = document.activeElement;
        if (ae && ae.tagName === 'IFRAME') markInteracted();
      } catch (_) {}
    }, { capture: true });
  } catch (_) {}
  try {
    window.addEventListener('message', function (e) {
      if (hasInteracted) return;
      var d = e && e.data;
      if (d && (d === 'vint:gesture' || d.type === 'vint:gesture')) markInteracted();
    });
  } catch (_) {}

  // Visibility return is NOT a gesture (a tab switch does not satisfy autoplay
  // policy), but it IS the right moment to retry a queue that failed while
  // hidden — the browser may have unlocked us in the meantime.
  try {
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && hasInteracted) drain();
    });
  } catch (_) {}

  // NO unlock button (Vinta 2026-06-26 — the page already has too many buttons).
  // Browser autoplay policy still requires one gesture before audio can play,
  // but the global capture listener above already unlocks on the FIRST click /
  // keypress / tap ANYWHERE on the page (markInteracted). Users always click
  // something, so audio unlocks naturally with zero extra UI. Queued speech
  // simply waits for that first interaction, then drains — no button needed.
  function _hideUnlock() {}

  function drain() {
    if (muted) { queue.length = 0; return; }
    if (!hasInteracted) return;       // wait for the first gesture (any click unlocks)
    if (current) return;              // one at a time
    var next = queue.shift();
    if (!next) return;
    play(next);
  }

  function play(item) {
    var a = ensureAudio();
    var vid = _readVoiceId();
    var url = apiBase().replace(/\/+$/, '') + '/api/voice/say?text=' + encodeURIComponent(item.text) +
              (vid ? '&voice=' + encodeURIComponent(vid) : '');
    current = item;
    item.audio = a;
    a.src = url;
    var p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function (err) {
        // Autoplay rejected — re-queue for next gesture
        current = null;
        if (!hasInteracted) {
          queue.unshift(item);
        } else {
          lastFailureAt = Date.now();
        }
      });
    }
    lastSpokeAt = Date.now();
  }

  function speak(text, mode) {
    if (!text) return;
    var clean = String(text).slice(0, 800).trim();
    if (!clean) return;
    if (muted) return;
    mode = mode || 'queue';
    var item = { text: clean, ts: Date.now() };
    if (mode === 'now' || mode === 'replace') {
      // Cancel current + clear queue
      cancel();
      queue.unshift(item);
    } else {
      // Cap queue at 4 so we don't pile up if she's been chatty
      if (queue.length >= 4) queue.shift();
      queue.push(item);
    }
    drain();
  }

  function cancel() {
    try {
      if (audioPool) { audioPool.pause(); audioPool.currentTime = 0; }
    } catch (_) {}
    current = null;
    queue.length = 0;
  }

  function mute(on) {
    muted = !!on;
    try { localStorage.setItem('vint_voice_muted', muted ? '1' : '0'); } catch (_) {}
    if (muted) cancel();
  }

  function setVoice(id) {
    var clean = String(id || '').slice(0, 64).trim();
    voiceId = clean;
    try {
      if (clean) localStorage.setItem('vint:voice_id', clean);
      else localStorage.removeItem('vint:voice_id');
    } catch (_) {}
    // Cancel anything mid-flight so the new voice takes effect immediately
    cancel();
    try {
      window.dispatchEvent(new CustomEvent('vint:voice:changed', { detail: { voice: clean || null } }));
    } catch (_) {}
  }

  function getVoice() { return _readVoiceId(); }

  window.VOICE = {
    __realBody: true,
    speak: speak,
    cancel: cancel,
    mute: mute,
    muted: function () { return muted; },
    get hasInteracted() { return hasInteracted; },
    pending: function () { return queue.length + (current ? 1 : 0); },
    get lastSpokeAt() { return lastSpokeAt; },
    // Voice selection — empty string / null means server default
    setVoice: setVoice,
    getVoice: getVoice
  };

  // Convenience: VOICE.say(text) === VOICE.speak(text)
  window.VOICE.say = speak;

  // Cross-tab sync: if another tab changes the voice, pick it up here too
  window.addEventListener('storage', function (e) {
    if (e && e.key === 'vint:voice_id') _readVoiceId();
  });
})();
