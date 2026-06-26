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
    if (window.VINT_API) return window.VINT_API;
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

  // ── AUTOPLAY UNLOCK PROMPT (Vinta 2026-06-26) ───────────────────────────────
  // The #1 reason browser TTS "doesn't work": browser autoplay policy blocks
  // audio until the user clicks the page. On a tab the user hasn't clicked
  // (stream overlay, fresh load) speech queues silently and never plays. So:
  // whenever speech wants to play but we're gesture-locked, show a clear,
  // impossible-to-miss "🔊 Click to enable voice" button. One click unlocks
  // audio for the whole session and immediately drains the queue. This is the
  // correct, user-shippable fix — every audio site does exactly this.
  var _unlockEl = null;
  function _showUnlock() {
    if (hasInteracted || muted || _unlockEl) return;
    try {
      _unlockEl = document.createElement('button');
      _unlockEl.id = 'vint-voice-unlock';
      _unlockEl.textContent = '🔊 click to enable voice';
      _unlockEl.setAttribute('aria-label', 'Click to enable Vintinuum voice');
      _unlockEl.style.cssText = [
        'position:fixed', 'left:50%', 'top:18px', 'transform:translateX(-50%)',
        'z-index:2147483647', 'padding:12px 20px', 'min-height:44px',
        'border-radius:24px', 'border:1px solid rgba(79,195,247,0.5)',
        'background:rgba(8,12,20,0.92)', 'color:#9fdcff', 'font-size:14px',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'cursor:pointer', 'box-shadow:0 6px 24px rgba(0,0,0,0.5)',
        'backdrop-filter:blur(8px)', '-webkit-backdrop-filter:blur(8px)',
        'animation:vintVoicePulse 1.6s ease-in-out infinite',
      ].join(';');
      if (!document.getElementById('vint-voice-unlock-kf')) {
        var st = document.createElement('style'); st.id = 'vint-voice-unlock-kf';
        st.textContent = '@keyframes vintVoicePulse{0%,100%{box-shadow:0 6px 24px rgba(0,0,0,0.5),0 0 0 0 rgba(79,195,247,0.4)}50%{box-shadow:0 6px 24px rgba(0,0,0,0.5),0 0 0 8px rgba(79,195,247,0)}}';
        document.head.appendChild(st);
      }
      _unlockEl.addEventListener('click', markInteracted, { once: true });
      (document.body || document.documentElement).appendChild(_unlockEl);
    } catch (_) {}
  }
  function _hideUnlock() {
    if (_unlockEl) { try { _unlockEl.remove(); } catch (_) {} _unlockEl = null; }
  }

  function drain() {
    if (muted) { queue.length = 0; _hideUnlock(); return; }
    if (!hasInteracted) {
      // Speech is waiting but audio is gesture-locked → prompt the user once.
      if (queue.length) _showUnlock();
      return;
    }
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
