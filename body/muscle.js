// ═══════════════════════════════════════════════════════════════════════════════
// MUSCLE — muscular system layer drawn between skeleton and skin
// Major muscle groups rendered as semi-transparent fiber textures
// Uses BODY_GEOMETRY for coordinates (700×1400 viewBox)
// Performance budget: ~0.5ms per frame
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';

const MUSCLE_LAYER = (() => {
  let _last = 0;
  let _initialized = false;
  let _visible = true;
  let G = null;

  // Muscle definitions — each has an origin area and fiber direction
  const MUSCLES = [];

  function init() {
    G = window.BODY_GEOMETRY;
    if (!G) { console.warn('[MUSCLE_LAYER] BODY_GEOMETRY not loaded'); return; }

    const CX = G.CENTER_X;

    // ── MAJOR MUSCLE GROUPS ─────────────────────────────��───────────────────
    // Each muscle: { name, cx, cy, rx, ry, rotation, fiberAngle, color, alpha }

    // Pectorals
    MUSCLES.push(
      { name: 'pectoralis_R', cx: CX + 60, cy: 370, rx: 55, ry: 35, rot: -0.1, fAngle: 0.3, color: [140, 60, 70] },
      { name: 'pectoralis_L', cx: CX - 60, cy: 370, rx: 55, ry: 35, rot: 0.1, fAngle: -0.3, color: [140, 60, 70] },
    );

    // Deltoids
    MUSCLES.push(
      { name: 'deltoid_R', cx: CX + 170, cy: 325, rx: 25, ry: 30, rot: 0.2, fAngle: 0.8, color: [150, 70, 65] },
      { name: 'deltoid_L', cx: CX - 170, cy: 325, rx: 25, ry: 30, rot: -0.2, fAngle: -0.8, color: [150, 70, 65] },
    );

    // Biceps
    MUSCLES.push(
      { name: 'bicep_R', cx: CX + 190, cy: 400, rx: 14, ry: 40, rot: 0.15, fAngle: 1.4, color: [145, 65, 65] },
      { name: 'bicep_L', cx: CX - 190, cy: 400, rx: 14, ry: 40, rot: -0.15, fAngle: -1.4, color: [145, 65, 65] },
    );

    // Rectus abdominis (abs)
    MUSCLES.push(
      { name: 'rectus_abs', cx: CX, cy: 520, rx: 35, ry: 80, rot: 0, fAngle: 1.57, color: [135, 60, 65] },
    );

    // External obliques
    MUSCLES.push(
      { name: 'oblique_R', cx: CX + 80, cy: 530, rx: 40, ry: 55, rot: 0.4, fAngle: 0.6, color: [130, 55, 60] },
      { name: 'oblique_L', cx: CX - 80, cy: 530, rx: 40, ry: 55, rot: -0.4, fAngle: -0.6, color: [130, 55, 60] },
    );

    // Latissimus dorsi (shown faintly — posterior muscle in anterior view)
    MUSCLES.push(
      { name: 'lat_R', cx: CX + 110, cy: 440, rx: 50, ry: 60, rot: 0.2, fAngle: 0.5, color: [120, 50, 55] },
      { name: 'lat_L', cx: CX - 110, cy: 440, rx: 50, ry: 60, rot: -0.2, fAngle: -0.5, color: [120, 50, 55] },
    );

    // Quadriceps
    MUSCLES.push(
      { name: 'quad_R', cx: CX + 82, cy: 850, rx: 28, ry: 80, rot: 0.05, fAngle: 1.5, color: [140, 60, 65] },
      { name: 'quad_L', cx: CX - 82, cy: 850, rx: 28, ry: 80, rot: -0.05, fAngle: -1.5, color: [140, 60, 65] },
    );

    // Calves (gastrocnemius)
    MUSCLES.push(
      { name: 'calf_R', cx: CX + 82, cy: 1060, rx: 18, ry: 50, rot: 0, fAngle: 1.5, color: [135, 58, 62] },
      { name: 'calf_L', cx: CX - 82, cy: 1060, rx: 18, ry: 50, rot: 0, fAngle: -1.5, color: [135, 58, 62] },
    );

    // Trapezius (upper back/neck — partially visible from front)
    MUSCLES.push(
      { name: 'trap_R', cx: CX + 50, cy: 305, rx: 40, ry: 20, rot: 0.15, fAngle: 0.2, color: [125, 50, 55] },
      { name: 'trap_L', cx: CX - 50, cy: 305, rx: 40, ry: 20, rot: -0.15, fAngle: -0.2, color: [125, 50, 55] },
    );

    // Gluteals
    MUSCLES.push(
      { name: 'glute_R', cx: CX + 85, cy: 730, rx: 35, ry: 30, rot: 0.1, fAngle: 0.4, color: [130, 55, 58] },
      { name: 'glute_L', cx: CX - 85, cy: 730, rx: 35, ry: 30, rot: -0.1, fAngle: -0.4, color: [130, 55, 58] },
    );

    // Forearm muscles
    MUSCLES.push(
      { name: 'forearm_R', cx: CX + 212, cy: 530, rx: 12, ry: 45, rot: 0.1, fAngle: 1.3, color: [135, 58, 62] },
      { name: 'forearm_L', cx: CX - 212, cy: 530, rx: 12, ry: 45, rot: -0.1, fAngle: -1.3, color: [135, 58, 62] },
    );

    _initialized = true;
    console.log('[MUSCLE_LAYER] initialized — ' + MUSCLES.length + ' muscle groups');
  }

  function drawMuscle(ctx, m, alpha, ts) {
    // Big alpha jump — muscle was invisible at 0.08. Going to 0.22 for
    // real presence, then +15% on every heartbeat systole.
    const baseAlpha = alpha * 0.22;
    const twitch = Math.sin(ts * 0.0003 + m.cx * 0.01) * 0.015;

    // Heartbeat sync — strong systolic flush. BODY_STATE.pulsePhase 0..1
    // cycles once per beat; systole = sharp rise in first 25% of cycle.
    const pp = (window.BODY_STATE && typeof window.BODY_STATE.pulsePhase === 'number')
      ? window.BODY_STATE.pulsePhase : 0.5;
    const systole = pp < 0.25 ? (1 - pp / 0.25) : 0;
    const flushR  = systole * 60;   // was 25 — now a real flush you can see
    const flushA  = systole * 0.08; // was 0.025 — 3x stronger

    ctx.save();
    ctx.translate(m.cx, m.cy);
    ctx.rotate(m.rot);

    // Muscle body — permanent +50 red warmth (was +20) + strong heartbeat flush
    const r = Math.min(255, m.color[0] + 50 + flushR);
    const g = Math.min(255, m.color[1] + 10);
    const b = m.color[2];
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${baseAlpha + twitch + flushA})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, m.rx, m.ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fiber lines (striations)
    ctx.strokeStyle = `rgba(${m.color[0] + 30}, ${m.color[1] + 20}, ${m.color[2] + 20}, ${baseAlpha * 0.5})`;
    ctx.lineWidth = 0.4;
    const fiberCount = Math.floor(m.ry / 5);
    for (let f = 0; f < fiberCount; f++) {
      const fy = -m.ry + (f / fiberCount) * m.ry * 2;
      const fxRange = m.rx * Math.sqrt(1 - (fy * fy) / (m.ry * m.ry));
      if (fxRange < 1) continue;
      ctx.beginPath();
      ctx.moveTo(-fxRange, fy);
      ctx.lineTo(fxRange, fy);
      ctx.stroke();
    }

    // Tendon attachment points (lighter ends)
    ctx.fillStyle = `rgba(200, 190, 175, ${baseAlpha * 0.4})`;
    ctx.beginPath(); ctx.ellipse(0, -m.ry + 3, m.rx * 0.3, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, m.ry - 3, m.rx * 0.3, 3, 0, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  function draw(ts) {
    if (!_initialized || !_visible) return;
    if (ts - _last < 50) return;  // ~20fps is fine for muscles
    _last = ts;

    const canvas = document.getElementById('mainCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const alpha = 0.6 + (Math.sin(ts * 0.0004) + 1) / 2 * 0.15;

    ctx.save();
    for (let i = 0; i < MUSCLES.length; i++) {
      drawMuscle(ctx, MUSCLES[i], alpha, ts);
    }
    ctx.restore();
  }

  function setVisible(v) { _visible = v; }
  function isVisible() { return _visible; }

  return { init, draw, setVisible, isVisible };
})();

setTimeout(() => { if (window.BODY_GEOMETRY) MUSCLE_LAYER.init(); }, 350);
if (typeof window !== 'undefined') window.MUSCLE_LAYER = MUSCLE_LAYER;
