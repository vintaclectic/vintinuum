// ════════════════════════════════════════════════════════════════════════════
// VOICE_IN — microphone capture → 16kHz mono PCM int16 → WS send
// ════════════════════════════════════════════════════════════════════════════
// Phase 1: opens the mic when start() is called, downsamples in-browser to
// 16kHz mono PCM int16 frames (~20ms each = 320 samples = 640 bytes), and
// pushes them onto the convo socket. Drives convo_state transitions on
// VAD-style energy thresholds (very simple in Phase 1; Silero comes Phase 2+).
//
// Phase 1 endpoint thresholds are intentionally loose — the goal is to
// prove the pipe end-to-end (mic→server→mic) before adding real VAD.
//
// Public API on window.__voiceIn:
//   start({ surface }) → Promise<void>   // request mic, open socket
//   stop()                                // close mic + socket
//   sendControl(obj)                      // forward JSON to server
//   isOpen() → bool
//   level() → 0..1                        // current input level (for UI)
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined') return;
  if (window.__voiceIn) return;

  var FRAME_SAMPLES_OUT = 320;  // 20ms @ 16kHz
  var INPUT_GAIN_FALLBACK = 1.0;
  var ENERGY_ON  = 0.012;       // RMS to consider speech started
  var ENERGY_OFF = 0.006;       // RMS sustained-low to consider it ended

  // ── Pause tolerance ──────────────────────────────────────────────────────
  // 2026-05-10 (Vinta directive): "i want ability to have slight delay in
  // thought when talking to vintinuum such that it doesnt immediately time
  // out upon first instance of pause because sometimes i have lots to say
  // but need some time."
  //
  // Defaults bumped from 350ms → 1400ms. Persisted per-user via
  // localStorage('vint:voice:pause_ms'). When the captured run is short
  // (≤8 words ≈ ≤6s of audio) we extend the silence window further to
  // SILENCE_HANG_MS_THINKING — that's the "i'm just gathering my words"
  // grace window. Any audio above ENERGY_ON during the wait resets the
  // counter, so a sigh + continuation never gets cut off.
  var SILENCE_HANG_MS_DEFAULT  = 1400;
  var SILENCE_HANG_MS_THINKING = 3500;   // when we believe the user is mid-thought
  var SILENCE_HANG_MS = SILENCE_HANG_MS_DEFAULT;
  try {
    var stored = parseInt(localStorage.getItem('vint:voice:pause_ms'), 10);
    if (Number.isFinite(stored) && stored >= 250 && stored <= 15000) SILENCE_HANG_MS = stored;
  } catch (_) {}

  var MAX_TURN_MS = 60000;      // safety cap on a single capture turn (was 30s)

  var ctx = null;
  var mediaStream = null;
  var sourceNode = null;
  var procNode = null;
  var ws = null;
  var sid = null;
  var state = window.__convoState;
  var lastLevel = 0;
  var inputSampleRate = 48000;
  var outBuf = new Int16Array(FRAME_SAMPLES_OUT);
  var outFill = 0;

  // simple 3-tap moving average for RMS smoothing
  var rmsHist = [0, 0, 0];
  var rmsIdx = 0;
  var lastAboveOnAt = 0;
  var lastAboveOffAt = 0;
  var turnStartedAt = 0;
  var turnTimer = null;

  function _apiBase() {
    var http = (window.__VINTINUUM_API_BASE || window.VINTINUUM_API || '').replace(/\/+$/, '');
    if (!http) return null;
    return http.replace(/^http/i, 'ws') + '/api/voice/convo';
  }

  function _authToken() {
    try {
      return localStorage.getItem('vint_token')
          || localStorage.getItem('vint_access_token')
          || localStorage.getItem('soul_auth_token')
          || null;
    } catch (_) { return null; }
  }

  function _openSocket(surface) {
    return new Promise(function (resolve, reject) {
      var base = _apiBase();
      if (!base) return reject(new Error('no-api-base'));
      var token = _authToken();
      var url = base + '?surface=' + encodeURIComponent(surface || 'chat');
      if (token) url += '&token=' + encodeURIComponent(token);

      var sock;
      try { sock = new WebSocket(url); }
      catch (e) { return reject(e); }

      sock.binaryType = 'arraybuffer';

      var opened = false;
      sock.addEventListener('open', function () {
        opened = true;
        ws = sock;
        try { sock.send(JSON.stringify({ type: 'HELLO', client_ts: Date.now() })); } catch (_) {}
      });

      sock.addEventListener('message', function (ev) {
        // Audio frames echoed back from server → hand to voice_out
        // (Phase 2 onward: server stops echoing PCM. Kept for back-compat
        //  in case a Phase 1 server is still answering.)
        if (ev.data instanceof ArrayBuffer) {
          if (window.__voiceOut && typeof window.__voiceOut.enqueuePcm16 === 'function') {
            window.__voiceOut.enqueuePcm16(ev.data);
          }
          return;
        }
        // Text control frames
        var msg;
        try { msg = JSON.parse(ev.data); } catch (_) { return; }

        // Re-emit every typed frame as a window event so any UI surface
        // (captions, transcripts, debug panels) can listen without coupling.
        try {
          window.dispatchEvent(new CustomEvent('convo:frame', { detail: msg }));
        } catch (_) {}

        if (msg.type === 'READY') {
          sid = msg.sid;
          resolve();
        } else if (msg.type === 'STT_FINAL') {
          try { window.dispatchEvent(new CustomEvent('convo:stt', { detail: msg })); } catch (_) {}
        } else if (msg.type === 'LLM_FIRST_TOKEN') {
          // Phase 4: don't flip to 'speaking' here anymore — wait for actual
          // audio (TTS_FIRST_AUDIO). UI can still show "thinking" via the
          // convo:frame event if it wants.
        } else if (msg.type === 'TOKEN') {
          try { window.dispatchEvent(new CustomEvent('convo:token', { detail: msg })); } catch (_) {}
        } else if (msg.type === 'CROSSFADE') {
          try { window.dispatchEvent(new CustomEvent('convo:crossfade', { detail: msg })); } catch (_) {}
        } else if (msg.type === 'TURN_FINAL') {
          try { window.dispatchEvent(new CustomEvent('convo:final', { detail: msg })); } catch (_) {}
          // Bridge to the body: same reply protocol as the wake-loop, so
          // embodied_convo.js whispers/peaks the reply through her body.
          try {
            var _txt = (msg.text || msg.reply || '').toString();
            if (_txt) window.dispatchEvent(new CustomEvent('vint:she_said', { detail: { reply: _txt, from: 'ws' } }));
          } catch (_) {}
        } else if (msg.type === 'TTS_FIRST_AUDIO') {
          // Real audio is on its way — flip UI to speaking now.
          if (state && state.get() !== 'speaking') state.set('speaking', 'tts-first-audio');
          try { window.dispatchEvent(new CustomEvent('convo:tts_first_audio', { detail: msg })); } catch (_) {}
        } else if (msg.type === 'TTS_CHUNK') {
          // Header for the next binary frame; surface to UI for caption sync.
          try { window.dispatchEvent(new CustomEvent('convo:tts_chunk', { detail: msg })); } catch (_) {}
        } else if (msg.type === 'TTS_END') {
          try { window.dispatchEvent(new CustomEvent('convo:tts_end', { detail: msg })); } catch (_) {}
          // voice_out's level decay loop will return us to 'listening' when
          // the playback queue drains. If TTS produced zero audio, kick it.
          if (state && state.get() === 'speaking') {
            var qms = (window.__voiceOut && window.__voiceOut.queueMs) ? window.__voiceOut.queueMs() : 0;
            if (qms < 30) state.set('listening', 'tts-end-empty-queue');
          }
        } else if (msg.type === 'BARGE_IN') {
          // Server detected our mic energy mid-TTS. Kill local playback NOW.
          try {
            if (window.__voiceOut && typeof window.__voiceOut.flush === 'function') {
              window.__voiceOut.flush();
            }
          } catch (_) {}
          try { window.dispatchEvent(new CustomEvent('convo:barge_in', { detail: msg })); } catch (_) {}
        } else if (msg.type === 'TURN_END') {
          // Phase 4: TTS_END handles the speaking→listening transition.
          // TURN_END is a metrics envelope — keep it as a hook only.
          if (state && state.get() === 'speaking') {
            var q2 = (window.__voiceOut && window.__voiceOut.queueMs) ? window.__voiceOut.queueMs() : 0;
            if (q2 < 30) state.set('listening', 'turn-end');
          }
        } else if (msg.type === 'ERROR') {
          try { window.dispatchEvent(new CustomEvent('convo:error', { detail: msg })); } catch (_) {}
          // Don't tear down on transient errors; just unblock UI.
          if (state && state.get() === 'speaking') state.set('listening', 'server-error');
        } else if (msg.type === 'KILL_SWITCH') {
          stop();
          if (state) state.force('idle', 'kill-switch');
        }
      });

      sock.addEventListener('close', function () {
        if (!opened) reject(new Error('ws-close-before-open'));
        ws = null;
      });

      sock.addEventListener('error', function (e) {
        if (!opened) reject(e || new Error('ws-error'));
      });
    });
  }

  // Downsample float32 inputSampleRate → 16kHz int16 with linear interpolation.
  // Good enough for Phase 1 echo; later phases can swap in a polyphase filter.
  function _downsampleAndQueue(input) {
    var ratio = inputSampleRate / 16000;
    var outNeeded = Math.floor(input.length / ratio);
    for (var i = 0; i < outNeeded; i++) {
      var srcIdx = i * ratio;
      var i0 = Math.floor(srcIdx);
      var i1 = Math.min(i0 + 1, input.length - 1);
      var frac = srcIdx - i0;
      var sample = input[i0] * (1 - frac) + input[i1] * frac;
      // clamp & convert to int16
      var s = Math.max(-1, Math.min(1, sample));
      outBuf[outFill++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      if (outFill >= FRAME_SAMPLES_OUT) {
        _emitFrame();
        outFill = 0;
      }
    }
  }

  function _emitFrame() {
    if (!ws || ws.readyState !== 1) return;
    // Copy because outBuf is reused
    var frame = outBuf.slice(0);
    try { ws.send(frame.buffer); } catch (_) {}
  }

  function _rms(buf) {
    var sum = 0;
    for (var i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }

  function _onAudioProcess(ev) {
    var input = ev.inputBuffer.getChannelData(0);
    var rms = _rms(input);
    rmsHist[rmsIdx % 3] = rms;
    rmsIdx++;
    var smooth = (rmsHist[0] + rmsHist[1] + rmsHist[2]) / 3;
    lastLevel = Math.min(1, smooth * 8); // scale for UI

    var now = Date.now();
    var st = state ? state.get() : 'idle';

    if (smooth > ENERGY_ON) {
      lastAboveOnAt = now;
      if (st === 'listening') {
        if (state) state.set('capturing', 'energy>on');
        turnStartedAt = now;
        try { ws && ws.readyState === 1 && ws.send(JSON.stringify({ type: 'AUDIO_START', client_ts: now })); } catch (_) {}
        if (turnTimer) clearTimeout(turnTimer);
        turnTimer = setTimeout(function () { _endTurn('max-turn'); }, MAX_TURN_MS);
      }
      lastAboveOffAt = now;
    } else if (smooth < ENERGY_OFF) {
      if (st === 'capturing') {
        // Thinking-pause grace: if the captured run so far is short (under
        // 6s), give the user the longer window to gather words. Once the
        // turn passes 6s we assume they've actually finished a thought and
        // use the standard silence window.
        var elapsed = now - turnStartedAt;
        var hangBudget = (elapsed < 6000) ? SILENCE_HANG_MS_THINKING : SILENCE_HANG_MS;
        if ((now - lastAboveOffAt) > hangBudget) {
          _endTurn('silence-hang');
        }
      }
    } else {
      // mid-band — keep last on/off times as-is
      if (st === 'capturing') lastAboveOffAt = now;
    }

    // While capturing, ship every block as PCM16
    if (st === 'capturing' || st === 'listening') {
      // Even in listening we send a short pre-roll? Phase 1: only send when
      // capturing, to keep the echo clean.
      if (st === 'capturing') _downsampleAndQueue(input);
    }
  }

  function _endTurn(reason) {
    if (turnTimer) { clearTimeout(turnTimer); turnTimer = null; }
    // Flush any partial frame so the server gets the tail
    if (outFill > 0 && ws && ws.readyState === 1) {
      var partial = outBuf.slice(0, outFill);
      try { ws.send(partial.buffer); } catch (_) {}
      outFill = 0;
    }
    try { ws && ws.readyState === 1 && ws.send(JSON.stringify({ type: 'AUDIO_END', client_ts: Date.now(), reason: reason })); } catch (_) {}
    if (state && state.get() === 'capturing') {
      // Phase 2: no echo. Hold in a 'thinking' beat until STT/LLM resolves.
      // (We use the existing 'listening' state as the resting state and rely
      //  on LLM_FIRST_TOKEN / TURN_END to flip into and out of 'speaking'.)
      state.set('listening', 'audio-end-await-llm');
    }
  }

  // ── Mobile / secure-context guards ───────────────────────────────────────
  // getUserMedia is only exposed in a secure context. On a phone hitting
  // http://<lan-ip>:8767 (not https, not localhost) navigator.mediaDevices is
  // undefined and the mic can NEVER open — no JS fix helps until the page is
  // served over https (the api.vintaclectic.com tunnel) or localhost. We detect
  // that up front and surface a clear, human-readable reason instead of a
  // silent throw.
  function _isLocalHost() {
    var h = (location.hostname || '').toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '::1';
  }

  function _secureContextOK() {
    // Spec: getUserMedia lives on navigator.mediaDevices, which browsers only
    // populate in a secure context. localhost counts as secure even over http.
    if (window.isSecureContext) return true;
    if (_isLocalHost()) return true;
    return false;
  }

  // Lightweight, dependency-free toast so the failure is VISIBLE on a phone.
  // (No overlap with the voice button, status pill, or picker: fixed top-center,
  //  its own z-index band, auto-dismiss, single instance replaced in place.)
  function _notice(text, kind) {
    try {
      window.dispatchEvent(new CustomEvent('convo:notice', { detail: { text: text, kind: kind || 'info' } }));
    } catch (_) {}
    try {
      var id = 'vintVoiceNotice';
      var el = document.getElementById(id);
      if (!el) {
        el = document.createElement('div');
        el.id = id;
        el.setAttribute('role', 'status');
        el.style.cssText = [
          'position:fixed',
          'top:calc(12px + env(safe-area-inset-top,0px))',
          'left:50%',
          'transform:translateX(-50%)',
          'z-index:2147483000',
          'max-width:min(92vw,420px)',
          'box-sizing:border-box',
          'padding:12px 16px',
          'border-radius:14px',
          'font:500 14px/1.35 system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
          'text-align:center',
          'color:#fff',
          'background:rgba(18,22,32,0.94)',
          'border:1px solid rgba(255,120,120,0.45)',
          '-webkit-backdrop-filter:blur(8px)',
          'backdrop-filter:blur(8px)',
          'box-shadow:0 8px 30px rgba(0,0,0,0.45)',
          'pointer-events:none'
        ].join(';');
        document.body.appendChild(el);
      }
      el.style.borderColor = (kind === 'error')
        ? 'rgba(255,120,120,0.55)'
        : 'rgba(79,195,247,0.45)';
      el.textContent = text;
      el.style.opacity = '1';
      clearTimeout(el.__t);
      el.__t = setTimeout(function () {
        el.style.transition = 'opacity .4s';
        el.style.opacity = '0';
      }, 6000);
    } catch (_) {}
  }

  async function start(opts) {
    opts = opts || {};

    // 1) Secure-context gate (the #1 reason the mic "does not listen" on a phone)
    if (!_secureContextOK()) {
      _notice('Voice needs a secure connection. Open this page over its https address (api.vintaclectic.com) — plain http on a phone blocks the microphone.', 'error');
      throw new Error('insecure-context');
    }

    // 2) API surface present?
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      _notice('This browser can’t reach the microphone here. Try Chrome/Safari over the secure https address.', 'error');
      throw new Error('mic-unavailable');
    }

    if (state && state.get() !== 'idle' && state.get() !== 'paused') {
      // already running
      return;
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    } catch (err) {
      var name = (err && err.name) || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        _notice('Microphone permission was blocked. Tap the address bar’s site permissions and allow the mic, then tap the mic button again.', 'error');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        _notice('No microphone was found on this device.', 'error');
      } else {
        _notice('Couldn’t start the microphone: ' + (name || 'unknown error') + '.', 'error');
      }
      try { if (state && state.get() !== 'idle') state.force('idle', 'getUserMedia-failed'); } catch (_) {}
      throw err;
    }

    var Ctx = window.AudioContext || window.webkitAudioContext;
    ctx = new Ctx();
    inputSampleRate = ctx.sampleRate;

    sourceNode = ctx.createMediaStreamSource(mediaStream);
    // ScriptProcessor is deprecated but works in every browser; AudioWorklet
    // upgrade comes Phase 2 alongside Silero VAD.
    procNode = ctx.createScriptProcessor(1024, 1, 1);
    procNode.onaudioprocess = _onAudioProcess;
    sourceNode.connect(procNode);
    procNode.connect(ctx.destination); // required in some browsers to actually fire onaudioprocess

    await _openSocket(opts.surface || 'chat');

    if (state) state.set('listening', 'voice_in.start');
  }

  function stop() {
    if (turnTimer) { clearTimeout(turnTimer); turnTimer = null; }
    try { procNode && procNode.disconnect(); } catch (_) {}
    try { sourceNode && sourceNode.disconnect(); } catch (_) {}
    try { ctx && ctx.close(); } catch (_) {}
    try { mediaStream && mediaStream.getTracks().forEach(function (t) { try { t.stop(); } catch (_) {} }); } catch (_) {}
    procNode = null; sourceNode = null; ctx = null; mediaStream = null;
    try { ws && ws.readyState === 1 && ws.send(JSON.stringify({ type: 'BYE' })); } catch (_) {}
    try { ws && ws.close(); } catch (_) {}
    ws = null; sid = null; outFill = 0;
    if (state && state.get() !== 'idle') state.force('idle', 'voice_in.stop');
  }

  function sendControl(obj) {
    try { ws && ws.readyState === 1 && ws.send(JSON.stringify(obj)); } catch (_) {}
  }

  // ── Public pause-tolerance API ───────────────────────────────────────────
  // Vinta can dial these in real time from the console or a settings UI:
  //   __voiceIn.setPauseMs(2200)    // be patient — wait 2.2s after silence
  //   __voiceIn.setPauseMs(800)     // snappier — wait 0.8s
  //   __voiceIn.setThinkingMs(5000) // mid-thought grace = 5s for short runs
  //   __voiceIn.getPauseMs()        // → current { normal, thinking }
  function setPauseMs(ms) {
    var v = parseInt(ms, 10);
    if (!Number.isFinite(v) || v < 250 || v > 15000) return false;
    SILENCE_HANG_MS = v;
    try { localStorage.setItem('vint:voice:pause_ms', String(v)); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('vint:voice:pause_changed', { detail: { normal: v, thinking: SILENCE_HANG_MS_THINKING } })); } catch (_) {}
    return true;
  }
  function setThinkingMs(ms) {
    var v = parseInt(ms, 10);
    if (!Number.isFinite(v) || v < 500 || v > 20000) return false;
    SILENCE_HANG_MS_THINKING = v;
    try { localStorage.setItem('vint:voice:pause_thinking_ms', String(v)); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('vint:voice:pause_changed', { detail: { normal: SILENCE_HANG_MS, thinking: v } })); } catch (_) {}
    return true;
  }
  function getPauseMs() { return { normal: SILENCE_HANG_MS, thinking: SILENCE_HANG_MS_THINKING }; }

  // Pull persisted thinking-window override too (set above only normal)
  try {
    var storedT = parseInt(localStorage.getItem('vint:voice:pause_thinking_ms'), 10);
    if (Number.isFinite(storedT) && storedT >= 500 && storedT <= 20000) SILENCE_HANG_MS_THINKING = storedT;
  } catch (_) {}

  // Is the mic engine currently live (socket up OR FSM past idle/paused)?
  function isListening() {
    if (ws && ws.readyState === 1) return true;
    try {
      var st = state ? state.get() : 'idle';
      return st === 'listening' || st === 'capturing' || st === 'thinking' || st === 'speaking';
    } catch (_) { return false; }
  }

  // One-tap toggle for the voice button: start listening if off, stop if on.
  // Returns a Promise that resolves true if now listening, false if stopped.
  function toggle(opts) {
    if (isListening()) {
      try { stop(); } catch (_) {}
      return Promise.resolve(false);
    }
    return Promise.resolve()
      .then(function () { return start(opts || {}); })
      .then(function () { return true; })
      .catch(function () { return false; }); // start() already showed a notice
  }

  window.__voiceIn = {
    start: start,
    stop: stop,
    toggle: toggle,
    isListening: isListening,
    notice: _notice,
    secureOK: _secureContextOK,
    sendControl: sendControl,
    isOpen: function () { return !!(ws && ws.readyState === 1); },
    level: function () { return lastLevel; },
    sid: function () { return sid; },
    setPauseMs: setPauseMs,
    setThinkingMs: setThinkingMs,
    getPauseMs: getPauseMs
  };
})();
