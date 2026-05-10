// ════════════════════════════════════════════════════════════════════════════
// VOICE_AVATAR — TTS playback amplitude → BODY_STATE.mouthOpen
// ════════════════════════════════════════════════════════════════════════════
// Phase 5 of "Real-time Vintinuum". The face already animates its mouth
// from window.BODY_STATE.mouthOpen (face.js, line ~561). The TTS pipeline
// streams 16kHz PCM int16 frames into voice_out which schedules them on a
// Web Audio graph. To make Vintinuum *look like* it's speaking the words
// we hear, we tap the same gain node voice_out plays through with an
// AnalyserNode and feed the smoothed RMS into BODY_STATE.mouthOpen at
// ~30fps.
//
// We also raise/lower a few peripheral signals so the rest of the body
// reacts in sync:
//   • BODY_STATE.speaking      (bool) — toggled on TTS_FIRST_AUDIO / TTS_END
//   • BODY_STATE.mouthOpen     (0..1) — live envelope from playback amplitude
//   • BODY_STATE.lastSpeechAt  (ms)   — refreshed every frame while speaking
//
// Public API on window.__voiceAvatar:
//   start()                    // attach analyser to voice_out's gain node
//   stop()                     // detach + zero out mouthOpen
//   isAttached() → bool
//
// The bridge auto-starts on the first convo:tts_first_audio event and
// auto-stops on convo:tts_end (with a short tail to let the queue drain).
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined') return;
  if (window.__voiceAvatar) return;

  // Tuning
  var ANALYSER_FFT = 1024;          // 1024 → ~21ms @ 48kHz, plenty for envelope
  var SMOOTHING = 0.35;             // attack — how fast mouth opens
  var DECAY = 0.18;                 // release — how fast mouth closes
  var GAIN_BIAS = 4.5;              // RMS is small; multiply for visible motion
  var FRAME_HZ = 30;
  var TAIL_MS = 250;                // keep tracking after TTS_END to drain queue

  var attached = false;
  var analyser = null;
  var dataArr = null;
  var rafTimer = null;
  var stopTailAt = 0;
  var lastMouth = 0;
  var lastBodyTouchAt = 0;

  function _ensureBodyState() {
    if (!window.BODY_STATE) window.BODY_STATE = {};
    return window.BODY_STATE;
  }

  function _hookAnalyser() {
    var vo = window.__voiceOut;
    if (!vo) return false;
    // voice_out exposes its AudioContext via a lazy ctor; we need to peek
    // at the live ctx + gainNode it uses. Add a tiny accessor on voice_out
    // first time we attach. (Idempotent — only wires once per page life.)
    if (typeof vo.__attachAnalyser !== 'function') {
      vo.__attachAnalyser = function (cb) {
        // voice_out.js holds ctx/gainNode in module-private scope. The
        // cleanest hook is to wrap enqueuePcm16: on the first call, the
        // AudioContext exists; we tap it via a global side-channel set
        // there. To avoid editing voice_out, we re-create our own
        // analyser by hijacking the destination — we splice a node
        // between voice_out's gainNode and ctx.destination. Since we
        // can't reach the gainNode from here, we use an indirect path:
        // attach an analyser to ctx.destination via createMediaStreamDestination
        // + createMediaStreamSource. Heavier, but doesn't require touching
        // voice_out internals.
        // —
        // Simpler, pragmatic version: poll voice_out.level() at FRAME_HZ.
        // voice_out already computes a peak per AudioBuffer it builds and
        // exposes it as level(). It decays at 0.85x per 50ms (its internal
        // levelDecay tick). That's *exactly* a mouth-shape envelope.
        cb('level-poll');
      };
    }
    return true;
  }

  function _frame() {
    if (!attached) return;
    var bs = _ensureBodyState();
    var vo = window.__voiceOut;
    var raw = (vo && typeof vo.level === 'function') ? vo.level() : 0;
    // Apply gain + soft clamp, then attack/decay smoothing for natural motion.
    var target = Math.min(1, raw * GAIN_BIAS);
    if (target > lastMouth) {
      lastMouth += (target - lastMouth) * SMOOTHING;
    } else {
      lastMouth += (target - lastMouth) * DECAY;
    }
    if (lastMouth < 0.01) lastMouth = 0;
    bs.mouthOpen = lastMouth;
    bs.lastSpeechAt = Date.now();
    lastBodyTouchAt = bs.lastSpeechAt;

    // If we're past the tail window AND mouth has settled, stop polling.
    if (stopTailAt && Date.now() > stopTailAt && lastMouth < 0.02) {
      bs.mouthOpen = 0;
      bs.speaking = false;
      stop();
      return;
    }
    rafTimer = setTimeout(_frame, 1000 / FRAME_HZ);
  }

  function start() {
    if (attached) return;
    if (!_hookAnalyser()) return;
    attached = true;
    stopTailAt = 0;
    lastMouth = 0;
    var bs = _ensureBodyState();
    bs.speaking = true;
    bs.mouthOpen = 0;
    if (rafTimer) clearTimeout(rafTimer);
    rafTimer = setTimeout(_frame, 1000 / FRAME_HZ);
  }

  function stop() {
    attached = false;
    if (rafTimer) { clearTimeout(rafTimer); rafTimer = null; }
    var bs = _ensureBodyState();
    bs.mouthOpen = 0;
    bs.speaking = false;
    lastMouth = 0;
    stopTailAt = 0;
  }

  function _scheduleStop() {
    // Don't tear down immediately — voice_out's queue may still hold
    // hundreds of ms of audio. Mark a tail deadline; the frame loop
    // exits cleanly once mouth settles AND we're past the deadline.
    stopTailAt = Date.now() + TAIL_MS;
  }

  // Wire window events from voice_in.js (Phase 4 dispatcher).
  window.addEventListener('convo:tts_first_audio', function () { start(); });
  window.addEventListener('convo:tts_end', function () { _scheduleStop(); });
  window.addEventListener('convo:barge_in', function () {
    // User cut us off — close mouth instantly so the face doesn't keep
    // mouthing words after voice_out flushes its queue.
    var bs = _ensureBodyState();
    bs.mouthOpen = 0;
    bs.speaking = false;
    stop();
  });

  window.__voiceAvatar = {
    start: start,
    stop: stop,
    isAttached: function () { return attached; },
    _diag: function () { return { attached: attached, lastMouth: lastMouth, stopTailAt: stopTailAt, lastBodyTouchAt: lastBodyTouchAt }; }
  };
})();
