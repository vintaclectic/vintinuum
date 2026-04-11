// ═══════════════════════════════════════════════════════════════════════════════
// CIRCULATORY — blood vessel network + flowing blood cells
// Major arteries, veins, and animated blood particles
// Uses BODY_GEOMETRY for coordinates (700×1400 viewBox)
// Performance budget: ~0.8ms per frame
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';

const CIRCULATORY = (() => {
  let _last = 0;
  let _initialized = false;
  let _visible = true;
  let G = null;

  // Blood particles — pool of animated cells
  const MAX_CELLS = 60;
  const cells = [];
  let _heartPhase = 0;

  // Vessel paths — each defined as a series of {x,y} waypoints
  const VESSELS = {
    // ── ARTERIES (red, from heart outward) ──────────────────────────────────
    aorta: {
      color: 'rgba(200, 60, 60, ',
      width: 4,
      points: [], // Built in init()
    },
    leftCarotid: { color: 'rgba(200, 60, 60, ', width: 2.5, points: [] },
    rightCarotid: { color: 'rgba(200, 60, 60, ', width: 2.5, points: [] },
    leftSubclavian: { color: 'rgba(180, 55, 55, ', width: 2, points: [] },
    rightSubclavian: { color: 'rgba(180, 55, 55, ', width: 2, points: [] },
    leftFemoral: { color: 'rgba(170, 50, 50, ', width: 2.5, points: [] },
    rightFemoral: { color: 'rgba(170, 50, 50, ', width: 2.5, points: [] },
    leftBrachial: { color: 'rgba(170, 50, 50, ', width: 1.5, points: [] },
    rightBrachial: { color: 'rgba(170, 50, 50, ', width: 1.5, points: [] },

    // ── VEINS (blue, returning to heart) ────────────────────────────────────
    inferiorVenaCava: { color: 'rgba(60, 80, 200, ', width: 4, points: [] },
    superiorVenaCava: { color: 'rgba(60, 80, 200, ', width: 3.5, points: [] },
    leftJugular: { color: 'rgba(60, 80, 180, ', width: 2, points: [] },
    rightJugular: { color: 'rgba(60, 80, 180, ', width: 2, points: [] },
    leftSaphenous: { color: 'rgba(50, 70, 170, ', width: 1.8, points: [] },
    rightSaphenous: { color: 'rgba(50, 70, 170, ', width: 1.8, points: [] },
  };

  function init() {
    G = window.BODY_GEOMETRY;
    if (!G) { console.warn('[CIRCULATORY] BODY_GEOMETRY not loaded'); return; }

    const CX = G.CENTER_X;
    const heartY = 395;

    // Build vessel paths
    VESSELS.aorta.points = [
      { x: CX + 10, y: heartY - 15 },
      { x: CX + 20, y: heartY - 40 },  // Aortic arch
      { x: CX + 5, y: heartY - 50 },
      { x: CX - 10, y: heartY - 40 },
      { x: CX - 5, y: heartY },
      { x: CX, y: 500 },
      { x: CX, y: 600 },
      { x: CX, y: 700 },  // Bifurcation
    ];

    VESSELS.leftCarotid.points = [
      { x: CX - 5, y: heartY - 45 },
      { x: CX - 15, y: 330 },
      { x: CX - 20, y: 280 },
      { x: CX - 18, y: 200 },
      { x: CX - 25, y: 140 },
    ];

    VESSELS.rightCarotid.points = [
      { x: CX + 15, y: heartY - 40 },
      { x: CX + 20, y: 330 },
      { x: CX + 22, y: 280 },
      { x: CX + 20, y: 200 },
      { x: CX + 25, y: 140 },
    ];

    VESSELS.leftSubclavian.points = [
      { x: CX - 10, y: heartY - 45 },
      { x: CX - 60, y: 330 },
      { x: CX - 130, y: 318 },
      { x: CX - 175, y: 315 },
    ];

    VESSELS.rightSubclavian.points = [
      { x: CX + 15, y: heartY - 42 },
      { x: CX + 60, y: 330 },
      { x: CX + 130, y: 318 },
      { x: CX + 175, y: 315 },
    ];

    VESSELS.leftBrachial.points = [
      { x: CX - 175, y: 315 },
      { x: CX - 195, y: 400 },
      { x: CX - 210, y: 490 },
      { x: CX - 225, y: 600 },
    ];

    VESSELS.rightBrachial.points = [
      { x: CX + 175, y: 315 },
      { x: CX + 195, y: 400 },
      { x: CX + 210, y: 490 },
      { x: CX + 225, y: 600 },
    ];

    VESSELS.leftFemoral.points = [
      { x: CX - 10, y: 700 },
      { x: CX - 40, y: 730 },
      { x: CX - 70, y: 800 },
      { x: CX - 78, y: 960 },
      { x: CX - 76, y: 1100 },
      { x: CX - 78, y: 1190 },
    ];

    VESSELS.rightFemoral.points = [
      { x: CX + 10, y: 700 },
      { x: CX + 40, y: 730 },
      { x: CX + 70, y: 800 },
      { x: CX + 78, y: 960 },
      { x: CX + 76, y: 1100 },
      { x: CX + 78, y: 1190 },
    ];

    VESSELS.superiorVenaCava.points = [
      { x: CX + 25, y: 200 },
      { x: CX + 25, y: 280 },
      { x: CX + 22, y: 340 },
      { x: CX + 18, y: heartY - 10 },
    ];

    VESSELS.inferiorVenaCava.points = [
      { x: CX + 5, y: 700 },
      { x: CX + 5, y: 600 },
      { x: CX + 8, y: 500 },
      { x: CX + 12, y: heartY + 10 },
    ];

    VESSELS.leftJugular.points = [
      { x: CX - 30, y: 140 },
      { x: CX - 28, y: 200 },
      { x: CX - 25, y: 280 },
      { x: CX - 15, y: 340 },
    ];

    VESSELS.rightJugular.points = [
      { x: CX + 30, y: 140 },
      { x: CX + 30, y: 200 },
      { x: CX + 28, y: 280 },
      { x: CX + 25, y: 340 },
    ];

    VESSELS.leftSaphenous.points = [
      { x: CX - 60, y: 1190 },
      { x: CX - 55, y: 1060 },
      { x: CX - 58, y: 960 },
      { x: CX - 55, y: 850 },
      { x: CX - 45, y: 750 },
    ];

    VESSELS.rightSaphenous.points = [
      { x: CX + 60, y: 1190 },
      { x: CX + 55, y: 1060 },
      { x: CX + 58, y: 960 },
      { x: CX + 55, y: 850 },
      { x: CX + 45, y: 750 },
    ];

    // Initialize blood cells
    const vesselKeys = Object.keys(VESSELS);
    for (let i = 0; i < MAX_CELLS; i++) {
      const vKey = vesselKeys[Math.floor(Math.random() * vesselKeys.length)];
      cells.push({
        vessel: vKey,
        t: Math.random(),  // Position along vessel (0-1)
        speed: 0.0004 + Math.random() * 0.0003,
        size: 1.5 + Math.random() * 1.5,
        isArtery: !vKey.includes('Vena') && !vKey.includes('ugular') && !vKey.includes('aphenous'),
      });
    }

    _initialized = true;
    console.log('[CIRCULATORY] initialized — ' + Object.keys(VESSELS).length + ' vessels, ' + MAX_CELLS + ' cells');
  }

  // ── INTERPOLATE ALONG VESSEL PATH ───────────────────────────────────────────
  function getPointOnPath(points, t) {
    if (points.length < 2) return points[0] || { x: 0, y: 0 };
    const totalSegments = points.length - 1;
    const segment = Math.min(Math.floor(t * totalSegments), totalSegments - 1);
    const localT = (t * totalSegments) - segment;
    const p0 = points[segment];
    const p1 = points[segment + 1];
    return {
      x: p0.x + (p1.x - p0.x) * localT,
      y: p0.y + (p1.y - p0.y) * localT,
    };
  }

  // ── DRAW VESSELS ────────────────────────────────────────────────────────────
  function drawVessels(ctx, alpha) {
    Object.values(VESSELS).forEach(v => {
      if (v.points.length < 2) return;
      ctx.strokeStyle = v.color + (alpha * 0.18) + ')';
      ctx.lineWidth = v.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(v.points[0].x, v.points[0].y);
      for (let i = 1; i < v.points.length; i++) {
        // Smooth with midpoint for organic look
        if (i < v.points.length - 1) {
          const midX = (v.points[i].x + v.points[i + 1].x) / 2;
          const midY = (v.points[i].y + v.points[i + 1].y) / 2;
          ctx.quadraticCurveTo(v.points[i].x, v.points[i].y, midX, midY);
        } else {
          ctx.lineTo(v.points[i].x, v.points[i].y);
        }
      }
      ctx.stroke();
    });
  }

  // ── DRAW BLOOD CELLS ────────────────────────────────────────────────────────
  function drawCells(ctx, ts, alpha) {
    // Heartbeat pulse — cells move faster during systole
    const heartBPM = (typeof ORGANS !== 'undefined' && ORGANS.state) ? ORGANS.state.heartRate : 72;
    const beatPeriod = 60000 / heartBPM;
    const beatPhase = (ts % beatPeriod) / beatPeriod;
    const pulseMultiplier = beatPhase < 0.15 ? 2.5 : 1;  // Rush during systole

    cells.forEach(cell => {
      const vessel = VESSELS[cell.vessel];
      if (!vessel || vessel.points.length < 2) return;

      // Advance position
      cell.t += cell.speed * pulseMultiplier;
      if (cell.t > 1) {
        cell.t = 0;
        // Occasionally switch vessels for variety
        if (Math.random() < 0.3) {
          const keys = Object.keys(VESSELS);
          cell.vessel = keys[Math.floor(Math.random() * keys.length)];
          cell.isArtery = !cell.vessel.includes('Vena') && !cell.vessel.includes('ugular') && !cell.vessel.includes('aphenous');
        }
      }

      const pos = getPointOnPath(vessel.points, cell.t);

      // Draw cell
      const cellAlpha = alpha * (0.25 + pulseMultiplier * 0.08);
      if (cell.isArtery) {
        // Arterial blood — bright red
        ctx.fillStyle = 'rgba(220, 70, 70, ' + cellAlpha + ')';
      } else {
        // Venous blood — darker, bluish
        ctx.fillStyle = 'rgba(80, 90, 180, ' + cellAlpha + ')';
      }
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, cell.size, 0, Math.PI * 2);
      ctx.fill();

      // Subtle trail
      if (cell.t > 0.01) {
        const prevPos = getPointOnPath(vessel.points, cell.t - 0.01);
        ctx.strokeStyle = cell.isArtery
          ? 'rgba(220, 70, 70, ' + (cellAlpha * 0.3) + ')'
          : 'rgba(80, 90, 180, ' + (cellAlpha * 0.3) + ')';
        ctx.lineWidth = cell.size * 0.6;
        ctx.beginPath();
        ctx.moveTo(prevPos.x, prevPos.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
    });
  }

  // ── MAIN DRAW ───────────────────────────────────────────────────────────────
  function draw(ts) {
    if (!_initialized || !_visible) return;
    if (ts - _last < 33) return;  // ~30fps for fluid motion
    _last = ts;

    const canvas = document.getElementById('mainCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const pulse = (Math.sin(ts * 0.0005) + 1) / 2;
    const alpha = 0.6 + pulse * 0.2;

    ctx.save();
    drawVessels(ctx, alpha);
    drawCells(ctx, ts, alpha);
    ctx.restore();
  }

  function setVisible(v) { _visible = v; }
  function isVisible() { return _visible; }

  return { init, draw, setVisible, isVisible };
})();

setTimeout(() => { if (window.BODY_GEOMETRY) CIRCULATORY.init(); }, 500);
