// ════════════════════════════════════════════════════════════════════════════
// AVATAR_RIG — Phoneme→viseme map, blink/breathe/saccade timers, emotion blend
// ════════════════════════════════════════════════════════════════════════════
// The avatar.js is the canvas + skeleton. The rig drives mood, blink,
// breath, micro-glances, and the phoneme→viseme channel that lets her
// mouth shape syllables in time with TTS.
//
// Inputs it consumes:
//   • window.BODY_STATE (live neurochemistry from the brain SSE stream)
//   • Custom events: convo:tts_first_audio, convo:tts_end, convo:state,
//                    convo:tts_phoneme  { phoneme, dur_ms }   (optional;
//                    if Piper doesn't emit phonemes we fall back to
//                    mouthOpen amplitude already produced by voice_avatar.js)
//   • Mouse pointer + tab visibility for ARIA micro-presences
//
// Outputs:
//   • Calls window.__avatar.setMood(...) every ~120ms
//   • Drives blink + saccade overlays via avatar's pose channel
//   • Listens for ARIA cues: head-tilt, lean-in, soft-arrival, etc.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined') return;
  if (window.__avatarRig) return;

  function bs() { return window.BODY_STATE || {}; }
  function av() { return window.__avatar; }

  // ── Mood derivation from BODY_STATE ───────────────────────────────────────
  // neuralWeight  := dominance of (neural+subconscious) layers via PFC/hippo
  // emotionalWeight := dominance of (emotional+somatic) layers
  // We approximate from neurochemistry + layer hints if present.
  function deriveMood() {
    var st = bs();
    // Normalize 0..100 → 0..1
    var dopa     = clamp01((+st.dopamine || 50) / 100);
    var valence  = clamp01((+st.valence  || 50) / 100);
    var arousal  = clamp01((+st.arousal  || 40) / 100);
    var serot    = clamp01((+st.serotonin || 60) / 100);

    // Neural weight rises with low arousal + high serotonin (calm focus)
    var neural = clamp01(0.35 + (1 - arousal) * 0.4 + (serot - 0.5) * 0.3);
    // Emotional weight rises with high arousal + high valence (warm engagement)
    var emo    = clamp01(0.30 + arousal * 0.5 + (valence - 0.5) * 0.3);

    return { neuralWeight: neural, emotionalWeight: emo, dopa: dopa, valence: valence, arousal: arousal };
  }

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

  // Push mood at ~8Hz
  var moodTimer = setInterval(function () {
    if (!av()) return;
    av().setMood(deriveMood());
  }, 120);

  // ── Stairway crescendo arc ────────────────────────────────────────────────
  // Session crescendo: muted (0-5min) → saturated (5-20) → luminescent (20-45)
  // → gold-flecked (45+) at dopamine peaks. Resets on tab unload.
  var sessionStart = performance.now();
  var stairwayTimer = setInterval(function () {
    if (!av()) return;
    var minutes = (performance.now() - sessionStart) / 60000;
    var dopa = (deriveMood().dopa);
    var base;
    if (minutes < 5) base = 0;
    else if (minutes < 20) base = (minutes - 5) / 15 * 0.18;
    else if (minutes < 45) base = 0.18 + (minutes - 20) / 25 * 0.32;
    else base = 0.5 + Math.min(0.4, (minutes - 45) / 60 * 0.4);
    // Gold spikes at dopamine peaks (above 0.78)
    var spike = dopa > 0.78 ? (dopa - 0.78) * 2.4 : 0;
    av().setGold(clamp01(base + spike));
  }, 600);

  // ── 12 ARIA micro-presences ───────────────────────────────────────────────
  // Each is a small behavior firing on its own timer or event.

  // (1) Head-tilt on confusion — proxied by user re-typing within 1.5s
  var lastInput = 0;
  document.addEventListener('input', function () {
    var now = performance.now();
    if (now - lastInput < 1500 && av()) {
      // Brief 6° tilt via profileMix wiggle (reused channel)
      av().setPose({ profileMix: 0.10 });
      setTimeout(function () { av() && av().setPose({ profileMix: 0 }); }, 700);
    }
    lastInput = now;
  }, { passive: true });

  // (2) Soft gaze break — every 18-32s flick away briefly
  function gazeBreak() {
    if (av()) {
      av().setPose({ facing: (Math.random() < 0.5 ? -0.3 : 0.3) });
      setTimeout(function () { av() && av().setPose({ facing: 0 }); }, 900);
    }
    setTimeout(gazeBreak, 18000 + Math.random() * 14000);
  }
  setTimeout(gazeBreak, 18000);

  // (3) Breath catch before hard truth — fires on convo:tts_clause if clause
  //     contains hedging markers like "honestly", "actually", "look —"
  window.addEventListener('convo:tts_clause', function (e) {
    var text = String((e && e.detail && e.detail.text) || '').toLowerCase();
    if (/^(honestly|actually|look[\s,—-]|listen|truth)/.test(text)) {
      var rig = av();
      if (rig) {
        var p = rig.pose();
        rig.setPose({ opacity: Math.max(0, p.opacity - 0.15) });
        setTimeout(function () { av() && av().setPose({ opacity: p.opacity }); }, 400);
      }
    }
  });

  // (4) Lean-in on attention — when cursor stills for 2s near where avatar is,
  //     drift 40px closer
  var mouseStillSince = 0, lastMouseT = 0, leanInDone = false;
  document.addEventListener('mousemove', function () {
    lastMouseT = performance.now();
    leanInDone = false;
  }, { passive: true });
  setInterval(function () {
    if (!av()) return;
    var still = performance.now() - lastMouseT;
    if (still > 2000 && !leanInDone) {
      var p = av().pose();
      av().setPose({ x: Math.max(0.05, p.x - 0.04) });
      leanInDone = true;
      setTimeout(function () {
        if (av()) av().setPose({ x: p.x });
      }, 4000);
    }
  }, 500);

  // (5) Settle-sigh after task completion — fires on convo:tts_end
  window.addEventListener('convo:tts_end', function () {
    var rig = av(); if (!rig) return;
    var p = rig.pose();
    rig.setPose({ height: p.height + 4 });
    setTimeout(function () { av() && av().setPose({ height: p.height }); }, 1200);
  });

  // (6) Mirror-still co-regulation — when user has been silent for 30s+ but
  //     the page is focused, mirror minimum motion (already handled by low
  //     arousal driving slow breath). No explicit action.

  // (7) Throat-clear before interrupt — fires when convo state goes from
  //     listening → thinking → speaking with low confidence (skipped if
  //     orchestrator doesn't emit confidence; harmless no-op)
  window.addEventListener('convo:throat_clear', function () {
    var rig = av(); if (!rig) return;
    var p = rig.pose();
    rig.setPose({ opacity: p.opacity * 0.92 });
    setTimeout(function () { av() && av().setPose({ opacity: p.opacity }); }, 220);
  });

  // (8) Eye-rest blink every 90s — handled inside avatar.js draw()

  // (9) Warm-back-glance on tab refocus
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && av()) {
      var p = av().pose();
      av().setPose({ facing: 0, profileMix: 0, opacity: Math.max(p.opacity, 0.45) });
    }
  });

  // (10) Withholding — hovers at margin while user types (do not approach)
  document.addEventListener('focusin', function (e) {
    var t = e && e.target;
    if (!t) return;
    if (t.matches && (t.matches('input, textarea, [contenteditable]'))) {
      if (av()) av().setPose({ x: 0.92 });   // pull to right margin
    }
  });
  document.addEventListener('focusout', function (e) {
    var t = e && e.target;
    if (t && t.matches && t.matches('input, textarea, [contenteditable]')) {
      if (av()) av().setPose({ x: 0.78 });   // return to default
    }
  });

  // (11) Soft-arrival — always fade in from edge, never appear in place.
  //      First time we set opacity > 0 we arrive from x = 1.05 → 0.78.
  var hasArrived = false;
  var origSetPose = null;
  setTimeout(function () {
    if (!av() || hasArrived) return;
    var rig = av();
    rig.setPose({ x: 1.05, opacity: 0.0 });
    setTimeout(function () {
      if (!av()) return;
      av().setPose({ opacity: 0.85 });
      var startX = 1.05, endX = 0.78, t0 = performance.now(), dur = 900;
      function step() {
        var k = Math.min(1, (performance.now() - t0) / dur);
        var ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        if (av()) av().setPose({ x: startX + (endX - startX) * ease });
        if (k < 1) requestAnimationFrame(step);
        else hasArrived = true;
      }
      requestAnimationFrame(step);
    }, 250);
  }, 600);

  // (12) Held-silence — sits still and brightens 5% when user is typing
  //      slowly and erratically (proxy: input gaps > 2s with content present).
  //      Fires on input with delta-gap > 2s.
  var lastInputForHold = 0;
  document.addEventListener('input', function (e) {
    var now = performance.now();
    var gap = now - lastInputForHold;
    lastInputForHold = now;
    var t = e && e.target;
    if (gap > 2000 && t && t.value && t.value.length > 4 && av()) {
      var p = av().pose();
      av().setPose({ opacity: Math.min(1, p.opacity + 0.05) });
      setTimeout(function () { av() && av().setPose({ opacity: p.opacity }); }, 2200);
    }
  }, { passive: true });

  // ── Show avatar when speaking or listening ────────────────────────────────
  window.addEventListener('convo:state', function (e) {
    var st = e && e.detail && e.detail.state;
    if (!av()) return;
    var p = av().pose();
    if (st === 'listening' || st === 'speaking' || st === 'thinking') {
      av().setPose({ opacity: Math.max(p.opacity, 0.92) });
      // Dim face per spec (face.js reads --face-dim)
      document.documentElement.style.setProperty('--face-dim', '0.4');
    } else if (st === 'idle') {
      av().setPose({ opacity: 0.18 });
      document.documentElement.style.setProperty('--face-dim', '1');
    }
  });

  // ── Public reaction primitives (used by perception_in.js and others) ──────
  // glance(x,y,ms): momentarily turn head toward normalized viewport coord
  // (0..1, 0..1) for `ms` then return to neutral. Cheap; non-blocking.
  function glance(nx, ny, ms) {
    if (!av()) return;
    ms = +ms || 1200;
    nx = clamp01(+nx); ny = clamp01(+ny);
    // facing: -1 = full left, +1 = full right (avatar.js channel)
    var facing = (nx - 0.5) * 1.6;
    if (facing < -1) facing = -1; if (facing > 1) facing = 1;
    // Slight profileMix in the same direction so it reads as turning, not
    // just eye-darting.
    var profileMix = (nx - 0.5) * 0.5;
    av().setPose({ facing: facing, profileMix: profileMix });
    setTimeout(function () {
      if (av()) av().setPose({ facing: 0, profileMix: 0 });
    }, ms);
  }

  // bump({...}): transient mood blip layered over the BODY_STATE-derived
  // baseline. Each bump decays linearly over `decayMs` (default 2400). We
  // accumulate into _bumpAcc and re-apply on each mood tick.
  var _bumps = []; // { field, mag, t0, decayMs }
  function bump(spec, decayMs) {
    if (!spec) return;
    decayMs = +decayMs || 2400;
    var t0 = performance.now();
    Object.keys(spec).forEach(function (k) {
      _bumps.push({ field: k, mag: +spec[k] || 0, t0: t0, decayMs: decayMs });
    });
  }
  function _bumpAcc() {
    var now = performance.now();
    var out = {};
    for (var i = _bumps.length - 1; i >= 0; i--) {
      var b = _bumps[i];
      var age = now - b.t0;
      if (age > b.decayMs) { _bumps.splice(i, 1); continue; }
      var k = 1 - (age / b.decayMs);
      out[b.field] = (out[b.field] || 0) + b.mag * k;
    }
    return out;
  }
  // Re-wire the mood timer to layer bumps over derived mood.
  clearInterval(moodTimer);
  moodTimer = setInterval(function () {
    if (!av()) return;
    var mood = deriveMood();
    var bumps = _bumpAcc();
    if (bumps.dopa)            mood.dopa            = clamp01((mood.dopa            || 0) + bumps.dopa);
    if (bumps.dopamine)        mood.dopa            = clamp01((mood.dopa            || 0) + bumps.dopamine);
    if (bumps.arousal)         mood.arousal         = clamp01((mood.arousal         || 0) + bumps.arousal);
    if (bumps.alertness)       mood.neuralWeight    = clamp01((mood.neuralWeight    || 0) + bumps.alertness);
    if (bumps.emotionalWeight) mood.emotionalWeight = clamp01((mood.emotionalWeight || 0) + bumps.emotionalWeight);
    av().setMood(mood);
    // gold bump piggybacks the gold channel (already 0..1)
    if (bumps.gold && av().setGold) {
      try { av().setGold(clamp01(0.18 + bumps.gold * 0.5)); } catch (_) {}
    }
  }, 120);

  window.__avatarRig = {
    deriveMood: deriveMood,
    sessionMinutes: function () { return (performance.now() - sessionStart) / 60000; },
    glance: glance,
    bump: bump
  };
})();
