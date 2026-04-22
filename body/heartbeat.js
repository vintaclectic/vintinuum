// ═══════════════════════════════════════════════════════════════════════════
// HEARTBEAT — soft radial pulse at the heart canonical anchor
// Pulse rate: 60 + arousal*0.4 bpm (default 60, up to ~100 at max arousal).
// Expands from 8px to 14px over 120ms, fades back over 400ms, repeats.
// Renders onto #mainCanvas. Registers with RENDER_HUB.
// Performance budget: ~0.2ms per frame at ~60fps.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

const HEARTBEAT_LAYER = (() => {
  let _last = 0;
  let _initialized = false;
  let _visible = true;

  // Heart canonical position (chest left-center, aligned with skeleton)
  const HEART_X = 332;
  const HEART_Y = 500;

  // Beat phase tracking
  let _lastBeatAt = 0;
  let _beatIntervalMs = 1000; // default 60 bpm

  // Pulse shape durations
  const SYSTOLE_MS  = 120;   // sharp expand
  const DIASTOLE_MS = 400;   // slow fade
  const TOTAL_BEAT_MS = SYSTOLE_MS + DIASTOLE_MS;

  function _clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function init() {
    _lastBeatAt = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    _initialized = true;
    console.log('[HEARTBEAT_LAYER] initialized — 60bpm base, arousal-modulated');
  }

  function draw(ts) {
    if (!_initialized || !_visible) return;
    // Heartbeat draws every frame — pulse shape is sub-frame-sensitive
    _last = ts;

    const canvas = document.getElementById('mainCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const bs = window.BODY_STATE || {};

    // Compute current bpm from arousal
    const arousal = typeof bs.arousal === 'number' ? bs.arousal : 50;
    const bpm = 60 + arousal * 0.4;
    _beatIntervalMs = 60000 / bpm;

    // Advance beat phase
    const sinceLast = ts - _lastBeatAt;
    if (sinceLast >= _beatIntervalMs) {
      _lastBeatAt = ts;
    }

    // Render the current pulse
    const beatElapsed = ts - _lastBeatAt;
    if (beatElapsed < TOTAL_BEAT_MS) {
      let phase, intensity;
      if (beatElapsed < SYSTOLE_MS) {
        phase = beatElapsed / SYSTOLE_MS;
        intensity = phase; // rising 0 → 1
      } else {
        phase = (beatElapsed - SYSTOLE_MS) / DIASTOLE_MS;
        intensity = 1 - phase; // falling 1 → 0
      }
      intensity = _clamp(intensity, 0, 1);

      const radius = 8 + intensity * 6;
      const alpha = 0.12 + intensity * 0.38;

      ctx.save();

      // Outer shimmer (larger soft red glow)
      const outerR = radius * 2.4;
      const outerGrad = ctx.createRadialGradient(HEART_X, HEART_Y, 0, HEART_X, HEART_Y, outerR);
      outerGrad.addColorStop(0, `rgba(255, 120, 140, ${(alpha * 0.4).toFixed(3)})`);
      outerGrad.addColorStop(0.45, `rgba(255, 90, 120, ${(alpha * 0.18).toFixed(3)})`);
      outerGrad.addColorStop(1, 'rgba(255, 80, 110, 0)');
      ctx.fillStyle = outerGrad;
      ctx.fillRect(HEART_X - outerR, HEART_Y - outerR, outerR * 2, outerR * 2);

      // Core pulse
      const coreGrad = ctx.createRadialGradient(HEART_X, HEART_Y, 0, HEART_X, HEART_Y, radius);
      coreGrad.addColorStop(0, `rgba(255, 220, 230, ${alpha.toFixed(3)})`);
      coreGrad.addColorStop(0.5, `rgba(255, 140, 160, ${(alpha * 0.8).toFixed(3)})`);
      coreGrad.addColorStop(1, 'rgba(255, 100, 120, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(HEART_X, HEART_Y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Publish pulse phase to BODY_STATE for other modules (skin warming, chest rise)
    if (window.BODY_STATE) {
      window.BODY_STATE.pulseBpm = bpm;
      window.BODY_STATE.pulsePhase = beatElapsed / _beatIntervalMs; // 0..1
    }
  }

  function setVisible(v) { _visible = v; }
  function isVisible() { return _visible; }

  return { init, draw, setVisible, isVisible };
})();

setTimeout(() => { HEARTBEAT_LAYER.init(); }, 360);
if (typeof window !== 'undefined') window.HEARTBEAT_LAYER = HEARTBEAT_LAYER;
