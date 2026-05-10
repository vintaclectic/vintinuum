// ════════════════════════════════════════════════════════════════════════════
// CONVO_STATE — finite state machine for real-time conversation
// ════════════════════════════════════════════════════════════════════════════
// One source of truth for what the conversation is doing right now.
// Every other voice module (voice_in, voice_out, avatar, presence) reads
// from this and reacts. Direct DOM/global reads of "are we talking?" are
// forbidden — go through window.__convoState.
//
// States (strict; no skipping):
//   idle         — mic off, nothing happening
//   listening    — mic on, VAD watching, no speech detected yet
//   capturing    — speech onset detected, frames flowing to server
//   thinking     — AUDIO_END sent, awaiting first server audio (Phase 2+)
//   speaking     — server audio arriving, playing through speakers
//   interrupted  — user spoke during speaking; killing playback
//   paused       — user-requested hold; mic muted, no auto-resume
//
// Phase 1 simplification: the loop is
//   idle → listening → capturing → (echo back as) speaking → idle
// because we echo audio frames immediately rather than buffering for STT.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined') return;
  if (window.__convoState) return; // singleton

  var STATES = ['idle', 'listening', 'capturing', 'thinking', 'speaking', 'interrupted', 'paused'];

  // Allowed transitions. Any attempt to move between states not in this map
  // logs a warning and is rejected — keeps the FSM honest.
  var TRANSITIONS = {
    idle:        ['listening', 'paused'],
    listening:   ['idle', 'capturing', 'paused'],
    capturing:   ['thinking', 'speaking', 'interrupted', 'paused', 'listening'],
    thinking:    ['speaking', 'interrupted', 'paused', 'idle'],
    speaking:    ['idle', 'interrupted', 'capturing', 'paused', 'listening'],
    interrupted: ['listening', 'idle', 'paused'],
    paused:      ['idle', 'listening']
  };

  var current = 'idle';
  var since = Date.now();
  var listeners = new Set();
  var history = []; // ring buffer of recent transitions for debugging
  var HIST_MAX = 64;

  function get() { return current; }
  function elapsed() { return Date.now() - since; }

  function on(fn) {
    if (typeof fn !== 'function') return function () {};
    listeners.add(fn);
    return function off() { listeners.delete(fn); };
  }

  function emit(prev, next, reason) {
    var entry = { prev: prev, next: next, reason: reason || null, ts: Date.now() };
    history.push(entry);
    if (history.length > HIST_MAX) history.shift();
    listeners.forEach(function (fn) {
      try { fn(next, prev, reason); } catch (_) {}
    });
    // CSS hook so any element can react via [data-convo-state="speaking"]
    try {
      var root = document.documentElement;
      if (root) root.setAttribute('data-convo-state', next);
    } catch (_) {}
    // Custom event for modules that prefer DOM events
    try {
      window.dispatchEvent(new CustomEvent('convo:state', { detail: entry }));
    } catch (_) {}
    // Bridge to status pill protocol — every FSM transition lights the pill.
    // Pill listens for vint:voice:listening|thinking|speaking|idle. Map our
    // 7 internal states down to those 4 surfaces so external watchers see a
    // simple, stable signal even as we add finer-grained internal states.
    try {
      var pillEvent = null;
      var pillDetail = { from: 'convo_state', prev: prev, fsm: next };
      switch (next) {
        case 'listening':
        case 'capturing':
          pillEvent = 'vint:voice:listening';
          break;
        case 'thinking':
          pillEvent = 'vint:voice:thinking';
          break;
        case 'speaking':
          // Sticky budget scales with avg sentence length; 1.6s holds the
          // pill on speaking through brief inter-chunk gaps without locking
          // it past the actual end of speech.
          pillEvent = 'vint:voice:speaking';
          pillDetail.stickyMs = 1600;
          break;
        case 'idle':
        case 'paused':
          pillEvent = 'vint:voice:idle';
          break;
        case 'interrupted':
          // Brief listening flash — interruption means the user took the floor
          pillEvent = 'vint:voice:listening';
          break;
      }
      if (pillEvent) {
        window.dispatchEvent(new CustomEvent(pillEvent, { detail: pillDetail }));
      }
    } catch (_) {}
  }

  function set(next, reason) {
    if (!STATES.indexOf(next) > -1 && STATES.indexOf(next) === -1) {
      console.warn('[convo_state] unknown state:', next);
      return false;
    }
    if (next === current) return true; // idempotent
    var allowed = TRANSITIONS[current] || [];
    if (allowed.indexOf(next) === -1) {
      console.warn('[convo_state] illegal transition:', current, '→', next, '(reason:', reason, ')');
      return false;
    }
    var prev = current;
    current = next;
    since = Date.now();
    emit(prev, next, reason);
    return true;
  }

  // Force-set bypasses the transition table. Reserved for hard error recovery
  // (kill switch, socket dropped mid-turn, etc). Logged distinctly so misuse
  // is visible.
  function force(next, reason) {
    if (STATES.indexOf(next) === -1) {
      console.warn('[convo_state] force: unknown state:', next);
      return false;
    }
    var prev = current;
    current = next;
    since = Date.now();
    emit(prev, next, '[FORCE] ' + (reason || ''));
    return true;
  }

  function snapshot() {
    return {
      state: current,
      elapsed_ms: elapsed(),
      history: history.slice(-16)
    };
  }

  window.__convoState = {
    STATES: STATES,
    get: get,
    set: set,
    force: force,
    on: on,
    elapsed: elapsed,
    snapshot: snapshot
  };

  // Init the data attribute so CSS can target idle from first paint
  try {
    if (document && document.documentElement) {
      document.documentElement.setAttribute('data-convo-state', 'idle');
    }
  } catch (_) {}
})();
