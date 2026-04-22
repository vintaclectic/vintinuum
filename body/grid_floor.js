// ═══════════════════════════════════════════════════════════════════════════
// GRID FLOOR — faint perspective grid beneath the body
// Grounds the figure in space. Horizontal lines converging to a vanishing
// point at body center. ~8 lines deep. Very subtle cyan.
// Renders onto #mainCanvas. Registers with RENDER_HUB.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

const GRID_FLOOR_LAYER = (() => {
  let _last = 0;
  let _initialized = false;
  let _visible = true;

  // Geometry
  const CENTER_X = 350;
  const HORIZON_Y = 1040;  // vanishing point y (just above feet)
  const FLOOR_BOTTOM = 1400; // canvas bottom
  const LINE_COUNT = 9;
  const WIDTH_BOTTOM = 520;
  const WIDTH_TOP = 60;

  function init() {
    _initialized = true;
    console.log('[GRID_FLOOR_LAYER] initialized');
  }

  function draw(ts) {
    if (!_initialized || !_visible) return;
    if (ts - _last < 100) return; // 10fps is plenty for static grid
    _last = ts;

    const canvas = document.getElementById('mainCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.save();
    ctx.strokeStyle = 'rgba(124, 200, 255, 0.07)';
    ctx.lineWidth = 0.5;

    // Horizontal lines converging with perspective
    for (let i = 0; i < LINE_COUNT; i++) {
      const t = i / (LINE_COUNT - 1); // 0 = closest (bottom), 1 = furthest (horizon)
      const y = FLOOR_BOTTOM - (FLOOR_BOTTOM - HORIZON_Y) * t;
      const halfWidth = WIDTH_BOTTOM / 2 * (1 - t) + WIDTH_TOP / 2 * t;
      const alpha = 0.10 * (1 - t) + 0.03 * t;

      ctx.strokeStyle = `rgba(124, 200, 255, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(CENTER_X - halfWidth, y);
      ctx.lineTo(CENTER_X + halfWidth, y);
      ctx.stroke();
    }

    // Vertical converging lines (perspective rays)
    const rayCount = 7;
    ctx.strokeStyle = 'rgba(124, 200, 255, 0.04)';
    for (let i = 0; i < rayCount; i++) {
      const t = i / (rayCount - 1);
      const xBottom = CENTER_X - WIDTH_BOTTOM / 2 + t * WIDTH_BOTTOM;
      const xTop = CENTER_X - WIDTH_TOP / 2 + t * WIDTH_TOP;
      ctx.beginPath();
      ctx.moveTo(xBottom, FLOOR_BOTTOM);
      ctx.lineTo(xTop, HORIZON_Y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function setVisible(v) { _visible = v; }
  function isVisible() { return _visible; }

  return { init, draw, setVisible, isVisible };
})();

setTimeout(() => { GRID_FLOOR_LAYER.init(); }, 300);
if (typeof window !== 'undefined') window.GRID_FLOOR_LAYER = GRID_FLOOR_LAYER;
