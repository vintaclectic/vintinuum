/* ═══════════════════════════════════════════════════════════════════
   VINTINUUM FOOT SHADOW (Phase 2 b7 — grounding pass)
   Soft radial shadow ellipse under each foot. The body was floating
   in void because grid_floor was disabled (it was clipping through).
   This gives ground contact *without* a grid — just a gentle shadow
   that says "this creature stands on something."
   Radius derived from geometry.js foot length. Alpha breathes with
   heartbeat so the shadow itself feels alive.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let _visible = true;
  let _initialized = false;
  let _last = 0;

  function init() {
    _initialized = true;
  }

  function draw(ts) {
    if (!_initialized || !_visible) return;
    if (ts - _last < 50) return; // 20fps is plenty for a shadow
    _last = ts;

    const canvas = document.getElementById('mainCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const G = window.BODY_GEOMETRY;
    if (!G || !G.leftLeg || !G.rightLeg) return;

    // Foot center Y = geometry foot.y + a hair below to sit *under* it
    const shadowY = Math.max(G.leftLeg.foot.y, G.rightLeg.foot.y) + 18;
    const leftX  = G.leftLeg.foot.x  + G.leftLeg.foot.length  * 0.25;
    const rightX = G.rightLeg.foot.x + G.rightLeg.foot.length * 0.25;

    // Breathe the shadow with the pulse — subtle, ±8% opacity
    const pulse = (window.BODY_STATE && typeof window.BODY_STATE.pulsePhase === 'number')
      ? window.BODY_STATE.pulsePhase
      : 0.5;
    // Inverse: shadow deepest between beats (diastole), lifts on systole
    const breath = 1 - Math.abs(pulse - 0.5) * 0.6;

    _drawShadow(ctx, leftX,  shadowY, 44, 9, 0.28 * breath);
    _drawShadow(ctx, rightX, shadowY, 44, 9, 0.28 * breath);
  }

  function _drawShadow(ctx, cx, cy, rx, ry, alpha) {
    // Radial gradient — opaque center → transparent edge
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    grad.addColorStop(0,   'rgba(0, 0, 0, ' + alpha.toFixed(3) + ')');
    grad.addColorStop(0.6, 'rgba(0, 0, 0, ' + (alpha * 0.4).toFixed(3) + ')');
    grad.addColorStop(1,   'rgba(0, 0, 0, 0)');
    ctx.save();
    ctx.fillStyle = grad;
    // Squash vertically into an ellipse
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function setVisible(v) { _visible = !!v; }
  function isVisible()   { return _visible; }

  window.FOOT_SHADOW = { init, draw, setVisible, isVisible };

  // Boot in step with the rest of the body geometry chain
  setTimeout(() => {
    init();
    if (window.RENDER_HUB && typeof window.RENDER_HUB.register === 'function') {
      // Register FIRST so shadow renders BEHIND legs
      window.RENDER_HUB.register('foot_shadow', draw, -10);
    }
  }, 350);
})();
