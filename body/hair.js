// ═══════════════════════════════════════════════════════════════════════════
// HAIR — short soft crown above the skull
// ~22 flow lines originating from the scalp perimeter, flowing outward.
// Lines sway gently with breath phase. Closest lines pull slightly toward cursor.
// Renders onto #mainCanvas. Registers with RENDER_HUB.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

const HAIR_LAYER = (() => {
  let _last = 0;
  let _initialized = false;
  let _visible = true;
  let _strands = [];

  // Skull crown reference (existing canonical y:108 for crown, ~y:170 for mid-skull)
  const SKULL_CX = 350;
  const CROWN_Y = 118;
  const SCALP_RADIUS_X = 48;
  const SCALP_RADIUS_Y = 28;

  const STRAND_COUNT = 22;

  function _seededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function _buildStrands() {
    const rand = _seededRandom(7373);
    const strands = [];
    for (let i = 0; i < STRAND_COUNT; i++) {
      // Distribute angularly across the top hemisphere of the scalp (-150° to -30°)
      const t = i / (STRAND_COUNT - 1);
      const angle = Math.PI * (-5 / 6) + t * Math.PI * (2 / 3); // top arc only
      const originX = SKULL_CX + Math.cos(angle) * SCALP_RADIUS_X;
      const originY = CROWN_Y + Math.sin(angle) * SCALP_RADIUS_Y;

      // Length and direction of the strand (flow outward and slightly down)
      const length = 28 + rand() * 20;
      const dirX = Math.cos(angle) * 0.5 + (rand() - 0.5) * 0.3;
      const dirY = Math.sin(angle) * 0.6 + 0.35 + rand() * 0.25;

      strands.push({
        originX, originY,
        baseDirX: dirX,
        baseDirY: dirY,
        length,
        phase: rand() * Math.PI * 2,
        swayAmp: 1.8 + rand() * 1.2,
        thickness: 0.7 + rand() * 0.5,
        alpha: 0.42 + rand() * 0.28,
      });
    }
    return strands;
  }

  function init() {
    _strands = _buildStrands();
    _initialized = true;
    console.log('[HAIR_LAYER] initialized — ' + _strands.length + ' strands');
  }

  function draw(ts) {
    if (!_initialized || !_visible) return;
    if (ts - _last < 40) return; // ~25fps
    _last = ts;

    const canvas = document.getElementById('mainCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const bs = window.BODY_STATE || {};

    // Breath phase for sway (match 5s breath cycle)
    const breathMs = 5000;
    const breathPhase = ((ts % breathMs) / breathMs) * Math.PI * 2;

    // Cursor position for proximity reaction (fetched from BODY_STATE.gaze if present)
    const gaze = bs.gaze || null;
    const cursorX = gaze && typeof gaze.x === 'number' ? gaze.x : SKULL_CX;
    const cursorY = gaze && typeof gaze.y === 'number' ? gaze.y : CROWN_Y + 400;

    ctx.save();
    ctx.lineCap = 'round';

    for (const s of _strands) {
      const sway = Math.sin(breathPhase + s.phase) * s.swayAmp;

      // Proximity nudge — if cursor is close, pull strand tip toward it slightly
      const dx = cursorX - s.originX;
      const dy = cursorY - s.originY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const nudge = dist < 100 ? (1 - dist / 100) * 2.2 : 0;
      const nudgeX = nudge * (dx / (dist || 1));
      const nudgeY = nudge * (dy / (dist || 1));

      const tipX = s.originX + s.baseDirX * s.length + sway + nudgeX;
      const tipY = s.originY + s.baseDirY * s.length + nudgeY * 0.4;

      // Mid-point with a slight curve
      const midX = s.originX + s.baseDirX * s.length * 0.55 + sway * 0.6;
      const midY = s.originY + s.baseDirY * s.length * 0.55;

      // Color: cool dark blue-grey, semi-transparent
      ctx.strokeStyle = `rgba(90, 115, 150, ${s.alpha.toFixed(3)})`;
      ctx.lineWidth = s.thickness;

      ctx.beginPath();
      ctx.moveTo(s.originX, s.originY);
      ctx.quadraticCurveTo(midX, midY, tipX, tipY);
      ctx.stroke();

      // Highlight pass on brighter strands
      if (s.alpha > 0.55) {
        ctx.strokeStyle = `rgba(140, 165, 200, ${(s.alpha * 0.35).toFixed(3)})`;
        ctx.lineWidth = s.thickness * 0.5;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function setVisible(v) { _visible = v; }
  function isVisible() { return _visible; }

  return { init, draw, setVisible, isVisible };
})();

setTimeout(() => { HAIR_LAYER.init(); }, 380);
if (typeof window !== 'undefined') window.HAIR_LAYER = HAIR_LAYER;
