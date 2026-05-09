// ════════════════════════════════════════════════════════════════════════════
// VOICE_OUT — server PCM frames → speakers, with instant interrupt
// ════════════════════════════════════════════════════════════════════════════
// Phase 1: receives 16kHz mono PCM int16 frames from voice_in (which
// receives them from the WS), schedules them on a Web Audio graph that
// plays seamlessly, and exposes a flush() that kills playback inside
// one audio block (~20ms).
//
// Why Web Audio + AudioBuffer chunks instead of MediaSource? Because
// MediaSource needs a container (webm/opus) and we're streaming raw PCM.
// Web Audio gives us sample-accurate scheduling and instant flush by
// calling stop() on every queued source node.
//
// Public API on window.__voiceOut:
//   enqueuePcm16(arrayBuffer)   // append a frame to the playback queue
//   flush()                     // kill all queued + playing audio in <40ms
//   level() → 0..1              // approximate output level for UI
//   queueMs() → number          // how much audio is buffered ahead of now
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined') return;
  if (window.__voiceOut) return;

  var SAMPLE_RATE = 16000;
  var state = window.__convoState;

  var ctx = null;
  var gainNode = null;
  var nextStartTime = 0;
  var activeSources = new Set();
  var lastLevel = 0;
  var levelDecay = null;

  function _ensureCtx() {
    if (ctx) return;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    ctx = new Ctx({ sampleRate: 48000 }); // browsers usually want 44.1k or 48k
    gainNode = ctx.createGain();
    gainNode.gain.value = 1.0;
    gainNode.connect(ctx.destination);
    nextStartTime = ctx.currentTime;
    if (!levelDecay) {
      levelDecay = setInterval(function () {
        lastLevel *= 0.85;
        if (lastLevel < 0.005) lastLevel = 0;
        // When playback queue drains AND we were speaking, return to listening
        if (queueMs() < 30 && activeSources.size === 0) {
          if (state && state.get() === 'speaking') {
            // give voice_in.start back the floor
            state.set('listening', 'voice_out.queue-drained');
          }
        }
      }, 50);
    }
  }

  // Convert int16 little-endian PCM @ 16kHz → AudioBuffer at ctx.sampleRate
  // (linear interpolation upsample to whatever the output device wants).
  function _pcm16ToAudioBuffer(arrayBuffer) {
    var i16 = new Int16Array(arrayBuffer);
    var srcLen = i16.length;
    if (srcLen === 0) return null;
    var ratio = ctx.sampleRate / SAMPLE_RATE;
    var dstLen = Math.floor(srcLen * ratio);
    var buf = ctx.createBuffer(1, dstLen, ctx.sampleRate);
    var ch = buf.getChannelData(0);
    var peak = 0;
    for (var i = 0; i < dstLen; i++) {
      var srcIdx = i / ratio;
      var i0 = Math.floor(srcIdx);
      var i1 = Math.min(i0 + 1, srcLen - 1);
      var frac = srcIdx - i0;
      var s0 = i16[i0] / (i16[i0] < 0 ? 0x8000 : 0x7FFF);
      var s1 = i16[i1] / (i16[i1] < 0 ? 0x8000 : 0x7FFF);
      var v = s0 * (1 - frac) + s1 * frac;
      ch[i] = v;
      var av = v < 0 ? -v : v;
      if (av > peak) peak = av;
    }
    if (peak > lastLevel) lastLevel = Math.min(1, peak);
    return buf;
  }

  function enqueuePcm16(arrayBuffer) {
    if (!arrayBuffer || arrayBuffer.byteLength === 0) return;
    _ensureCtx();
    if (ctx.state === 'suspended') {
      try { ctx.resume(); } catch (_) {}
    }
    var buf = _pcm16ToAudioBuffer(arrayBuffer);
    if (!buf) return;

    var src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(gainNode);

    // Schedule seamlessly — if we've fallen behind realtime, snap to now.
    var now = ctx.currentTime;
    var startAt = Math.max(now, nextStartTime);
    src.start(startAt);
    nextStartTime = startAt + buf.duration;

    activeSources.add(src);
    src.onended = function () {
      activeSources.delete(src);
      try { src.disconnect(); } catch (_) {}
    };

    if (state && state.get() === 'capturing') {
      // First echoed audio arriving while we're still capturing means the
      // server is responding before we've finished — only legal in echo mode.
      // Phase 2+ this branch will be reached when TTS starts mid-capture.
      // No-op for now.
    }
  }

  function flush() {
    activeSources.forEach(function (s) {
      try { s.stop(0); } catch (_) {}
      try { s.disconnect(); } catch (_) {}
    });
    activeSources.clear();
    if (ctx) nextStartTime = ctx.currentTime;
    lastLevel = 0;
  }

  function queueMs() {
    if (!ctx) return 0;
    var ahead = (nextStartTime - ctx.currentTime) * 1000;
    return ahead > 0 ? ahead : 0;
  }

  function destroy() {
    flush();
    if (levelDecay) { clearInterval(levelDecay); levelDecay = null; }
    try { gainNode && gainNode.disconnect(); } catch (_) {}
    try { ctx && ctx.close(); } catch (_) {}
    ctx = null; gainNode = null; nextStartTime = 0;
  }

  window.__voiceOut = {
    enqueuePcm16: enqueuePcm16,
    flush: flush,
    queueMs: queueMs,
    destroy: destroy,
    level: function () { return lastLevel; }
  };
})();
