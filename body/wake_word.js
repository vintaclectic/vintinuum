// ════════════════════════════════════════════════════════════════════════════
// WAKE_WORD — passive ambient listening for "hey vinta"
// ════════════════════════════════════════════════════════════════════════════
// hey_vinta.js is tap-to-listen. This module sits beside it and runs the
// Web Speech API in CONTINUOUS + interim mode while idle, watching every
// fragment for variants of the wake phrase: "hey vinta", "hi vinta",
// "yo vinta", "vinta" (alone, only if loud/standalone).
//
// On detection:
//   1. Stop the ambient recognizer (avoid double capture)
//   2. Strip the wake phrase from the captured tail
//   3. If a tail follows ("hey vinta what time is it") → dispatch
//      `vint:hey_vinta` directly with that tail (skip the tap step)
//   4. If no tail → trigger hey_vinta's listening UI for the follow-on
//   5. After the reply finishes (vint:she_said + grace), resume ambient
//
// Privacy & restraint:
//   - Audio never leaves the device. Only matched transcript text moves.
//   - Pauses while VOICE is speaking (avoid hearing herself).
//   - Pauses while a hey_vinta tap session is active.
//   - Pauses in convo:state ≠ idle.
//   - Hard backoff on consecutive recognizer errors (1s → 30s exponential).
//   - Opt out: <html data-wakeword="off"> OR localStorage['vint:wake_off']='1'.
//   - Off by default unless one of:
//       • localStorage['vint:wake_on']='1', or
//       • <html data-wakeword="on">, or
//       • window.WAKE_WORD.enable() called from the console
//     (Browser will surface a mic permission prompt on first enable.)
//
// Public API:
//   window.WAKE_WORD.enable()  — start ambient listening (persists choice)
//   window.WAKE_WORD.disable() — stop and persist the choice
//   window.WAKE_WORD.status()  — { enabled, listening, lastDetection }
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined') return;
  if (window.WAKE_WORD) return;
  if (document.documentElement.dataset.wakeword === 'off') return;

  var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  var supported = !!SpeechRec;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (_) {} }

  var enabled = (function () {
    if (lsGet('vint:wake_off') === '1') return false;
    if (lsGet('vint:wake_on') === '1') return true;
    if (document.documentElement.dataset.wakeword === 'on') return true;
    return false;
  })();

  var rec = null;
  var listening = false;
  var paused = false;
  var lastDetection = 0;
  var consecutiveErrors = 0;
  var restartTimer = null;
  var manualSession = false;
  var convoActive = false;

  // Wake patterns, ordered by specificity. The "vinta" alone case is
  // intentionally guarded — it only triggers when it stands as the entire
  // tail (no other words around) to avoid mis-fires from background chatter.
  var WAKE_RX = [
    /\bh(?:e|a)y[, ]+vinta\b[\s,.!?-]*(.*)$/i,
    /\bhi[, ]+vinta\b[\s,.!?-]*(.*)$/i,
    /\byo[, ]+vinta\b[\s,.!?-]*(.*)$/i,
    /\bok(?:ay)?[, ]+vinta\b[\s,.!?-]*(.*)$/i,
    /\bvinta[, ]+(.+)$/i,                 // "vinta, what's up"
    /^\s*vinta\s*[!?.]*\s*$/i             // bare "vinta" — tail = ''
  ];

  function detectWake(text) {
    if (!text) return null;
    var t = String(text).trim();
    for (var i = 0; i < WAKE_RX.length; i++) {
      var m = t.match(WAKE_RX[i]);
      if (m) {
        var tail = (m[1] || '').trim();
        return { matched: true, tail: tail, raw: t };
      }
    }
    return null;
  }

  function ensureRec() {
    if (!supported) return null;
    try {
      rec = new SpeechRec();
      rec.lang = navigator.language || 'en-US';
      rec.continuous = true;       // ambient mode
      rec.interimResults = true;
      rec.maxAlternatives = 1;
    } catch (e) {
      rec = null;
    }
    return rec;
  }

  function resumeSoon(delayMs) {
    clearTimeout(restartTimer);
    restartTimer = setTimeout(function () {
      if (enabled && !paused && !manualSession && !convoActive) startAmbient();
    }, Math.max(250, delayMs || 1000));
  }

  function backoffMs() {
    var n = Math.min(consecutiveErrors, 6);
    return Math.min(30000, 1000 * Math.pow(1.7, n));
  }

  function stopAmbient() {
    if (!rec) { listening = false; return; }
    try { rec.onresult = null; rec.onerror = null; rec.onend = null; } catch (_) {}
    try { rec.stop(); } catch (_) {}
    try { rec.abort && rec.abort(); } catch (_) {}
    listening = false;
    rec = null;
  }

  function startAmbient() {
    if (!enabled || !supported) return;
    if (manualSession || convoActive || paused) return;
    if (listening) return;

    var r = ensureRec();
    if (!r) return;

    r.onresult = function (ev) {
      // Walk every interim+final segment; bail on first wake match
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var alt = ev.results[i][0];
        var text = (alt && alt.transcript) || '';
        var hit = detectWake(text);
        if (hit) {
          lastDetection = Date.now();
          consecutiveErrors = 0;
          stopAmbient();
          fire(hit);
          return;
        }
      }
    };
    r.onerror = function (ev) {
      consecutiveErrors++;
      // 'no-speech' and 'aborted' are routine in continuous mode
      var code = (ev && ev.error) || 'unknown';
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        // mic denied — disable and stop nagging
        try { console.warn('[wake_word] mic permission denied; disabling'); } catch (_) {}
        disable({ persist: true, reason: 'mic-denied' });
        return;
      }
      stopAmbient();
      resumeSoon(backoffMs());
    };
    r.onend = function () {
      listening = false;
      // Continuous mode still ends on its own occasionally; just resume.
      if (enabled && !paused && !manualSession && !convoActive) {
        resumeSoon(consecutiveErrors ? backoffMs() : 600);
      }
    };

    try {
      r.start();
      listening = true;
    } catch (e) {
      consecutiveErrors++;
      stopAmbient();
      resumeSoon(backoffMs());
    }
  }

  function fire(hit) {
    var detail = {
      transcript: hit.tail,
      raw: hit.raw,
      confidence: 0.7,
      surface: 'wake_word',
      duration_ms: 0,
      via: 'wake_word'
    };

    if (hit.tail) {
      // Already heard the question along with the wake phrase — go directly
      // to talk_back without making the user repeat themselves.
      try {
        window.dispatchEvent(new CustomEvent('vint:hey_vinta', { detail: detail }));
      } catch (_) {}
      // Resume after the reply lands (or after a 12s safety window)
      armResumeAfterReply();
    } else {
      // Bare "hey vinta" — open the listening UI to capture the follow-on
      try {
        window.dispatchEvent(new CustomEvent('vint:hey_vinta:trigger'));
      } catch (_) {}
      // Resume once the manual session ends
      manualSession = true;
      armResumeAfterManual();
    }
  }

  // Resume scheduling after a reply or manual capture finishes
  var resumeArmed = false;
  function armResumeAfterReply() {
    if (resumeArmed) return;
    resumeArmed = true;
    var safety = setTimeout(release, 14000);
    function release() {
      clearTimeout(safety);
      window.removeEventListener('vint:she_said', onSaid);
      resumeArmed = false;
      // Small grace so we don't catch the tail of her own voice
      resumeSoon(1200);
    }
    function onSaid() {
      // Wait for TTS to settle; rough ~14 chars/sec + 800ms
      var lastTxt = window.__lastSpokenText || '';
      var wait = 800 + Math.min(8000, lastTxt.length * 70);
      clearTimeout(safety);
      setTimeout(release, wait);
    }
    window.addEventListener('vint:she_said', onSaid, { once: true });
  }
  function armResumeAfterManual() {
    if (resumeArmed) return;
    resumeArmed = true;
    var safety = setTimeout(release, 18000);
    function release() {
      clearTimeout(safety);
      manualSession = false;
      resumeArmed = false;
      resumeSoon(1500);
    }
    // hey_vinta dispatches vint:hey_vinta on success or finishes silently
    window.addEventListener('vint:hey_vinta', function () {
      // Then wait for she_said to finish before we resume
      armResumeAfterReply();
      manualSession = false;
      resumeArmed = false;
      clearTimeout(safety);
    }, { once: true });
  }

  // ── Pause while she's actually speaking out loud ─────────────────────────
  function watchVoice() {
    // Probe VOICE state every 500ms; pause/resume accordingly.
    setInterval(function () {
      try {
        if (window.VOICE) {
          var pending = (typeof window.VOICE.pending === 'function')
            ? window.VOICE.pending() : 0;
          var lastSpoke = (typeof window.VOICE.lastSpokeAt === 'number')
            ? window.VOICE.lastSpokeAt
            : (window.VOICE.lastSpokeAt || 0);
          var hot = pending > 0 || (Date.now() - lastSpoke) < 1500;
          if (hot && !paused) {
            paused = true;
            stopAmbient();
          } else if (!hot && paused) {
            paused = false;
            if (enabled && !manualSession && !convoActive) resumeSoon(400);
          }
        }
      } catch (_) {}
    }, 500);
  }

  // ── Pause during convo state ─────────────────────────────────────────────
  window.addEventListener('convo:state', function (e) {
    var st = e && e.detail && e.detail.state;
    convoActive = !!(st && st !== 'idle');
    if (convoActive) {
      stopAmbient();
    } else if (enabled && !paused && !manualSession) {
      resumeSoon(800);
    }
  });

  // ── Pause while hey_vinta tap session is active ──────────────────────────
  // hey_vinta has no 'started' event; observe via window.HeyVinta.isListening.
  setInterval(function () {
    try {
      var hv = window.HeyVinta;
      if (hv && typeof hv.isListening === 'function') {
        var hvOn = hv.isListening();
        if (hvOn && !manualSession) {
          manualSession = true;
          stopAmbient();
        } else if (!hvOn && manualSession && !resumeArmed) {
          // hey_vinta finished without the resume arm catching it
          manualSession = false;
          if (enabled && !paused && !convoActive) resumeSoon(900);
        }
      }
    } catch (_) {}
  }, 700);

  function enable(opts) {
    if (!supported) return false;
    enabled = true;
    if (!opts || opts.persist !== false) {
      lsSet('vint:wake_on', '1');
      lsDel('vint:wake_off');
    }
    consecutiveErrors = 0;
    if (!paused && !manualSession && !convoActive) startAmbient();
    return true;
  }

  function disable(opts) {
    enabled = false;
    if (!opts || opts.persist !== false) {
      lsSet('vint:wake_off', '1');
      lsDel('vint:wake_on');
    }
    stopAmbient();
    clearTimeout(restartTimer);
    return true;
  }

  function status() {
    return {
      supported: supported,
      enabled: enabled,
      listening: listening,
      paused: paused,
      manualSession: manualSession,
      convoActive: convoActive,
      lastDetection: lastDetection,
      consecutiveErrors: consecutiveErrors
    };
  }

  window.WAKE_WORD = {
    enable: enable,
    disable: disable,
    status: status,
    detect: detectWake
  };

  // Boot
  if (supported) {
    watchVoice();
    if (enabled) {
      // Slight delay so embodiment + voice can settle first
      setTimeout(startAmbient, 2200);
    }
  } else {
    try { console.warn('[wake_word] Web Speech API not supported in this browser'); } catch (_) {}
  }
})();
