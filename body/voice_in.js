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
  var SILENCE_HANG_MS = 350;    // how long below ENERGY_OFF before AUDIO_END
  var MAX_TURN_MS = 30000;      // safety cap on a single capture turn

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
      if (st === 'capturing' && (now - lastAboveOffAt) > SILENCE_HANG_MS) {
        _endTurn('silence-hang');
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

  async function start(opts) {
    opts = opts || {};
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('mic-unavailable');
    }
    if (state && state.get() !== 'idle' && state.get() !== 'paused') {
      // already running
      return;
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

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

  window.__voiceIn = {
    start: start,
    stop: stop,
    sendControl: sendControl,
    isOpen: function () { return !!(ws && ws.readyState === 1); },
    level: function () { return lastLevel; },
    sid: function () { return sid; }
  };
})();
