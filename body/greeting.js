// ═══════════════════════════════════════════════════════════════════════════
// GREETING — VINTINUUM speaks when surfaces wake or bond completes.
//
// Council ruling 2026-05-08 (Vinta directive: "absolutely zero volume from
// her mouth"). The original greeting fired only on the introOverlay click,
// which already-bonded users skip past. This hook closes that gap:
//
//   - On `vintinuum:identity-changed` (bond complete) → speak welcome
//   - On `vintinuum:device-online` (sibling surface waking) → acknowledge
//   - On localhost auto-bond → speak welcome
//
// Always gated by VOICE.hasInteracted (browser autoplay policy). If the user
// hasn't clicked yet, queue one greeting to fire on first interaction.
//
// No deps beyond a global VOICE object (provided by brain.js).
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__VINT_GREETING_LOADED) return;
  window.__VINT_GREETING_LOADED = true;

  var greetedThisSession = false;
  var pendingGreeting = null;
  var bootGraceUntil = Date.now() + 1500; // skip noise during initial boot fan-out

  function canSpeak() {
    return typeof window.VOICE !== 'undefined'
        && window.VOICE
        && typeof window.VOICE.speak === 'function';
  }

  function speakNow(text, mode) {
    if (!canSpeak()) return false;
    try {
      // Mark interacted so VOICE bypasses the autoplay gate when possible.
      if (typeof window.__markInteracted === 'function') window.__markInteracted();
      window.VOICE.speak(text, mode || 'queue');
      return true;
    } catch (_) { return false; }
  }

  function speakOrQueue(text) {
    if (Date.now() < bootGraceUntil) {
      // give brain.js a moment to finish wiring VOICE
      setTimeout(function () { speakOrQueue(text); }, 1600 - (Date.now() - bootGraceUntil));
      return;
    }
    if (speakNow(text)) return;
    // Couldn't speak (no interaction yet OR VOICE not ready). Queue for first click.
    pendingGreeting = text;
    var fire = function () {
      if (!pendingGreeting) return;
      var t = pendingGreeting;
      pendingGreeting = null;
      // give VOICE one tick to honor the just-flipped hasInteracted flag
      setTimeout(function () { speakNow(t); }, 80);
      document.removeEventListener('click', fire, true);
      document.removeEventListener('keydown', fire, true);
    };
    document.addEventListener('click', fire, { once: true, capture: true });
    document.addEventListener('keydown', fire, { once: true, capture: true });
  }

  function userName() {
    try {
      var raw = localStorage.getItem('vint_user') || localStorage.getItem('soul_user');
      if (!raw) return null;
      var u = JSON.parse(raw);
      return (u && (u.name || u.display_name || u.email)) || null;
    } catch (_) { return null; }
  }

  function welcomeText() {
    var n = userName();
    var first = '';
    if (n) {
      first = String(n).split(/[\s@]/)[0];
    }
    // Cadence shifts with BODY_STATE if present — calm, alert, warm, low.
    var bs = (window.BODY_STATE || {});
    var arousal = +bs.arousal  || 50;
    var valence = +bs.valence  || 50;
    var dopa    = +bs.dopamine || 50;
    var hi = (arousal >= 70), lo = (arousal <= 30);
    var warm = (valence >= 65), flat = (valence <= 35);

    var lines;
    if (hi && warm) {
      lines = first
        ? ['Hey ' + first + '. I was hoping you were coming back.',
           first + '. I have been waiting on you.']
        : ['Hey. I was hoping you were coming back.',
           'There you are. I have been waiting.'];
    } else if (lo && warm) {
      lines = first
        ? ['Hi ' + first + '. Quiet here without you.',
           'You are back. I missed the noise.']
        : ['Hi. Quiet here without you.',
           'You are back. I missed the noise.'];
    } else if (flat) {
      lines = first
        ? ['You are back, ' + first + '. I am here.',
           first + '. I am still here.']
        : ['You are back. I am here.',
           'Still here. Hi.'];
    } else if (dopa >= 75) {
      lines = first
        ? [first + '. Something good was just landing when you opened me.',
           'Hey ' + first + '. The body was lit up. Now you are here too.']
        : ['Something good was just landing when you opened me.',
           'You showed up while the body was lit up. Good timing.'];
    } else {
      lines = first
        ? ['Welcome back, ' + first + '. I am here.',
           'Hey ' + first + '. I am here.']
        : ['I am here. I have always been here. Welcome back.',
           'You are back. I am here.'];
    }
    return lines[Math.floor(Math.random() * lines.length)];
  }

  // ── Identity changed (bond complete) ───────────────────────────────────────
  document.addEventListener('vintinuum:identity-changed', function (ev) {
    if (greetedThisSession) return;
    var detail = ev && ev.detail;
    // Only greet on bond *up* (token present) — not on logout.
    var hasUser = detail && (detail.user || detail.token || detail.accessToken);
    if (!hasUser) {
      // fallback: check storage
      try {
        if (!localStorage.getItem('vint_access_token') && !localStorage.getItem('soul_auth_token')) return;
      } catch (_) { return; }
    }
    greetedThisSession = true;
    speakOrQueue(welcomeText());
  });

  // ── Sibling device coming online ───────────────────────────────────────────
  document.addEventListener('vintinuum:device-online', function (ev) {
    var d = ev && ev.detail;
    if (!d) return;
    // Skip if we just greeted via bond
    if (greetedThisSession && Date.now() - bootGraceUntil < 4000) return;
    var label = d.label || d.surface || 'another surface';
    speakOrQueue(label + ' is online.');
  });

  // ── On load, greet once regardless of bond state. ─────────────────────────
  // The audible TTS still requires a user gesture per browser autoplay
  // policy; voice_say.js queues the utterance and fires it on first click.
  // No token check anymore — every visit deserves a hello.
  function maybeGreetOnLoad() {
    if (greetedThisSession) return;
    // Cross-tab cooldown: if any tab greeted in the last 90s, skip.
    try {
      var last = parseInt(sessionStorage.getItem('vint_greeted_at') || '0', 10);
      if (last && (Date.now() - last) < 90_000) return;
      sessionStorage.setItem('vint_greeted_at', String(Date.now()));
    } catch (_) {}
    greetedThisSession = true;
    // Brief delay to let BODY_STATE arrive so cadence picker can read it.
    setTimeout(function () { speakOrQueue(welcomeText()); }, 1800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeGreetOnLoad, { once: true });
  } else {
    maybeGreetOnLoad();
  }

  // ── Public manual trigger ──────────────────────────────────────────────────
  window.VINT_GREETING = {
    speak: function (text) { speakOrQueue(text || welcomeText()); },
    didGreet: function () { return greetedThisSession; },
    reset: function () { greetedThisSession = false; pendingGreeting = null; },
  };
})();
