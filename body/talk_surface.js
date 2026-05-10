// ════════════════════════════════════════════════════════════════════════════
// TALK_SURFACE — entry module that lights up real-time conversation
// ════════════════════════════════════════════════════════════════════════════
// Loaded as <script type="module" src="body/talk_surface.js" data-talk="on">
// on any page that wants Vintinuum's voice loop. In Phase 1 that's chat.html
// only. Phases 4-5 expand to mind/stats/etc.
//
// What it does:
//   1. Loads convo_state, voice_in, voice_out as classic <script>s (they
//      attach to window globals; this module just guarantees order).
//   2. Exposes window.talk = { start, stop, toggle, state, level } so the
//      console + UI buttons have a single, documented entry point.
//   3. Honors data-talk="off" or ?talk=off to disable without removing
//      the script tag (per helios-disciplined kill switches).
//   4. Pings GET /api/voice/convo/status once on load so we surface a clear
//      error early if the server hasn't been redeployed with the spine yet.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.talk) return; // singleton

  // Find our own script tag to read data-* attributes
  var selfScript = document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        var src = scripts[i].src || '';
        if (/talk_surface\.js/.test(src)) return scripts[i];
      }
      return null;
    })();

  function _qsKill() {
    try {
      return /[?&]talk=off\b/.test(window.location.search);
    } catch (_) { return false; }
  }

  function _attrKill() {
    if (!selfScript) return false;
    var v = selfScript.getAttribute('data-talk');
    return v === 'off' || v === 'false';
  }

  if (_qsKill() || _attrKill()) {
    console.info('[talk_surface] disabled via data-talk/off or ?talk=off');
    window.talk = {
      disabled: true,
      start: function () { throw new Error('talk-disabled'); },
      stop: function () {},
      toggle: function () {},
      state: function () { return 'disabled'; },
      level: function () { return { in: 0, out: 0 }; }
    };
    return;
  }

  // Resolve script base path so we can side-load the dependency modules
  var BASE = (function () {
    if (selfScript && selfScript.src) {
      return selfScript.src.replace(/\/talk_surface\.js.*$/, '/');
    }
    return 'body/';
  })();

  function _loadOnce(name) {
    return new Promise(function (resolve, reject) {
      // Already attached? skip.
      if (name === 'convo_state' && window.__convoState) return resolve();
      if (name === 'voice_in'    && window.__voiceIn)    return resolve();
      if (name === 'voice_out'   && window.__voiceOut)   return resolve();

      // Already in DOM? wait for it.
      var existing = document.querySelector('script[data-talk-mod="' + name + '"]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(); });
        existing.addEventListener('error', reject);
        return;
      }

      var s = document.createElement('script');
      // Phase 4: cache-bust per-mod so TTS frame handling lands fresh.
      s.src = BASE + name + '.js?v=v20260509-talk-phase4';
      s.async = false; // preserve order
      s.setAttribute('data-talk-mod', name);
      s.addEventListener('load', function () { resolve(); });
      s.addEventListener('error', function () { reject(new Error('load-failed:' + name)); });
      document.head.appendChild(s);
    });
  }

  function _statusProbe() {
    var apiBase = (window.__VINTINUUM_API_BASE || window.VINTINUUM_API || '').replace(/\/+$/, '');
    if (!apiBase) return Promise.resolve({ ok: false, mounted: false, reason: 'no-api-base' });
    return fetch(apiBase + '/api/voice/convo/status', { mode: 'cors', credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : { ok: false, mounted: false, http: r.status }; })
      .catch(function (e) { return { ok: false, mounted: false, error: String(e) }; });
  }

  var _ready = (async function () {
    await _loadOnce('convo_state');
    await _loadOnce('voice_in');
    await _loadOnce('voice_out');
    var status = await _statusProbe();
    if (!status.mounted) {
      console.warn('[talk_surface] /api/voice/convo not mounted yet:', status);
    } else {
      console.info('[talk_surface] spine ready', status);
    }
    return status;
  })();

  async function start(opts) {
    await _ready;
    if (!window.__voiceIn) throw new Error('voice_in-not-loaded');
    return window.__voiceIn.start(opts || { surface: _detectSurface() });
  }

  function stop() {
    try { window.__voiceOut && window.__voiceOut.flush(); } catch (_) {}
    try { window.__voiceIn && window.__voiceIn.stop(); } catch (_) {}
  }

  async function toggle(opts) {
    var s = window.__convoState ? window.__convoState.get() : 'idle';
    if (s === 'idle' || s === 'paused') {
      await start(opts);
      return 'started';
    }
    stop();
    return 'stopped';
  }

  function _detectSurface() {
    try {
      var p = (window.location.pathname || '').toLowerCase();
      var m = p.match(/\/([a-z_-]+)\.html?$/);
      if (m) return m[1];
      if (p === '/' || p === '') return 'index';
      return 'chat';
    } catch (_) { return 'chat'; }
  }

  function state() {
    return window.__convoState ? window.__convoState.get() : 'unloaded';
  }

  function level() {
    return {
      in: window.__voiceIn ? window.__voiceIn.level() : 0,
      out: window.__voiceOut ? window.__voiceOut.level() : 0,
      queue_ms: window.__voiceOut ? window.__voiceOut.queueMs() : 0
    };
  }

  function snapshot() {
    return {
      state: state(),
      level: level(),
      sid: window.__voiceIn ? window.__voiceIn.sid() : null,
      open: window.__voiceIn ? window.__voiceIn.isOpen() : false,
      history: window.__convoState ? window.__convoState.snapshot().history : []
    };
  }

  // Optional: respond to global keyboard shortcut (Alt+T) to toggle talk.
  // Disabled by default; enable by setting data-talk-hotkey="alt+t".
  if (selfScript && selfScript.getAttribute('data-talk-hotkey')) {
    var hotkey = selfScript.getAttribute('data-talk-hotkey').toLowerCase();
    document.addEventListener('keydown', function (e) {
      var pressed = (e.altKey ? 'alt+' : '') + (e.ctrlKey ? 'ctrl+' : '') +
                    (e.shiftKey ? 'shift+' : '') + (e.key || '').toLowerCase();
      if (pressed === hotkey) {
        e.preventDefault();
        toggle().catch(function (err) { console.error('[talk_surface] toggle failed:', err); });
      }
    });
  }

  window.talk = {
    start: start,
    stop: stop,
    toggle: toggle,
    state: state,
    level: level,
    snapshot: snapshot,
    ready: function () { return _ready; }
  };
})();
