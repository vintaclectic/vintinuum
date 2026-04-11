// ═══════════════════════════════════════════════════════════════════════════════
// ORGANS — draws major internal organs on mainCanvas
// Heart, lungs, liver, kidneys, stomach, intestines, bladder, spleen
// All coordinates in 700×1400 viewBox space using BODY_GEOMETRY
// Performance budget: ~1.5ms per frame
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';

const ORGANS = (() => {
  let _last = 0;
  let _initialized = false;
  let _visible = true;
  let G = null;

  // Organ state — can be influenced by body systems later
  const state = {
    heartRate: 72,      // BPM
    breathRate: 14,     // breaths/min
    heartPhase: 0,
    breathPhase: 0,
    digestActive: 0.3,  // 0-1
  };

  function init() {
    G = window.BODY_GEOMETRY;
    if (!G) { console.warn('[ORGANS] BODY_GEOMETRY not loaded'); return; }
    _initialized = true;
    console.log('[ORGANS] initialized');
  }

  // ── HEART ───────────────────────────────────────────────────────────────────
  function drawHeart(ctx, ts) {
    const cx = G.CENTER_X + 15;  // Heart is slightly left of center (anatomically)
    const cy = 395;
    const beatPeriod = 60000 / state.heartRate;
    const beatPhase = (ts % beatPeriod) / beatPeriod;

    // Systolic squeeze: quick contraction then slow relaxation
    let scale = 1;
    if (beatPhase < 0.1) {
      scale = 1 - 0.08 * Math.sin(beatPhase / 0.1 * Math.PI);
    } else if (beatPhase < 0.2) {
      scale = 0.92 + 0.08 * ((beatPhase - 0.1) / 0.1);
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Heart shape — anatomical-ish, not valentine
    const heartAlpha = 0.25 + (1 - scale) * 2;  // Brighter during beat

    // Left ventricle (larger, left side)
    ctx.fillStyle = 'rgba(180, 40, 50, ' + (heartAlpha * 0.5) + ')';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.bezierCurveTo(-35, -30, -40, 5, -5, 28);
    ctx.fill();

    // Right ventricle
    ctx.fillStyle = 'rgba(140, 50, 60, ' + (heartAlpha * 0.45) + ')';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.bezierCurveTo(30, -28, 35, 5, 5, 25);
    ctx.fill();

    // Aorta (ascending)
    ctx.strokeStyle = 'rgba(200, 60, 60, ' + (heartAlpha * 0.4) + ')';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-5, -18);
    ctx.bezierCurveTo(-5, -35, 15, -40, 20, -30);
    ctx.stroke();

    // Coronary arteries (surface vessels)
    ctx.strokeStyle = 'rgba(200, 80, 80, ' + (heartAlpha * 0.25) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-15, -10);
    ctx.bezierCurveTo(-25, 0, -20, 15, -8, 22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, -10);
    ctx.bezierCurveTo(20, 5, 15, 15, 5, 20);
    ctx.stroke();

    // Beat flash
    if (beatPhase < 0.05) {
      ctx.fillStyle = 'rgba(255, 100, 100, ' + (0.15 * (1 - beatPhase / 0.05)) + ')';
      ctx.beginPath();
      ctx.arc(0, 5, 30, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ── LUNGS ───────────────────────────────────────────────────────────────────
  function drawLungs(ctx, ts) {
    const breathCycle = 60000 / state.breathRate;
    const breathPhase = (ts % breathCycle) / breathCycle;

    // Inhale (0-0.4), pause (0.4-0.45), exhale (0.45-0.85), pause (0.85-1)
    let expand = 0;
    if (breathPhase < 0.4) {
      expand = Math.sin(breathPhase / 0.4 * Math.PI / 2);
    } else if (breathPhase < 0.45) {
      expand = 1;
    } else if (breathPhase < 0.85) {
      expand = Math.cos((breathPhase - 0.45) / 0.4 * Math.PI / 2);
    }

    const expandFactor = 1 + expand * 0.04;
    const lungAlpha = 0.12 + expand * 0.06;

    // Right lung (3 lobes, slightly larger)
    ctx.save();
    ctx.translate(G.CENTER_X + 65, 405);
    ctx.scale(expandFactor, expandFactor);
    ctx.fillStyle = 'rgba(140, 80, 100, ' + lungAlpha + ')';
    ctx.beginPath();
    ctx.moveTo(0, -65);
    ctx.bezierCurveTo(55, -55, 70, 0, 65, 50);
    ctx.bezierCurveTo(55, 75, 10, 80, -10, 65);
    ctx.bezierCurveTo(-25, 40, -25, -30, 0, -65);
    ctx.fill();
    // Lobe divisions
    ctx.strokeStyle = 'rgba(200, 140, 160, ' + (lungAlpha * 0.6) + ')';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-5, -15); ctx.bezierCurveTo(30, -10, 55, -5, 60, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, 20); ctx.bezierCurveTo(25, 25, 50, 30, 55, 40); ctx.stroke();
    // Bronchi
    ctx.strokeStyle = 'rgba(180, 120, 140, ' + (lungAlpha * 0.5) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-12, -20); ctx.bezierCurveTo(10, -10, 30, 10, 40, 30); ctx.stroke();
    ctx.restore();

    // Left lung (2 lobes, smaller due to heart)
    ctx.save();
    ctx.translate(G.CENTER_X - 65, 410);
    ctx.scale(expandFactor, expandFactor);
    ctx.fillStyle = 'rgba(140, 80, 100, ' + (lungAlpha * 0.9) + ')';
    ctx.beginPath();
    ctx.moveTo(0, -60);
    ctx.bezierCurveTo(-50, -50, -60, 0, -55, 45);
    ctx.bezierCurveTo(-45, 70, -5, 75, 10, 55);
    ctx.bezierCurveTo(20, 35, 15, -25, 0, -60);
    ctx.fill();
    // Cardiac notch (indent for heart)
    ctx.fillStyle = 'rgba(5, 8, 15, 0.3)';
    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.bezierCurveTo(18, 20, 18, 40, 10, 55);
    ctx.bezierCurveTo(5, 45, 5, 25, 10, 10);
    ctx.fill();
    // Lobe division
    ctx.strokeStyle = 'rgba(200, 140, 160, ' + (lungAlpha * 0.6) + ')';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(8, 5); ctx.bezierCurveTo(-20, 10, -45, 15, -50, 20); ctx.stroke();
    // Bronchi
    ctx.strokeStyle = 'rgba(180, 120, 140, ' + (lungAlpha * 0.5) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(8, -15); ctx.bezierCurveTo(-10, -5, -30, 15, -35, 30); ctx.stroke();
    ctx.restore();

    // Trachea (windpipe)
    ctx.strokeStyle = 'rgba(160, 120, 140, ' + (lungAlpha * 0.4) + ')';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(G.CENTER_X, 290);
    ctx.lineTo(G.CENTER_X, 345);
    ctx.stroke();
    // Tracheal rings
    ctx.strokeStyle = 'rgba(180, 140, 160, ' + (lungAlpha * 0.3) + ')';
    ctx.lineWidth = 1;
    for (let y = 295; y < 345; y += 8) {
      ctx.beginPath();
      ctx.ellipse(G.CENTER_X, y, 6, 2, 0, 0, Math.PI);
      ctx.stroke();
    }
    // Bronchial bifurcation
    ctx.strokeStyle = 'rgba(160, 120, 140, ' + (lungAlpha * 0.35) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(G.CENTER_X, 345);
    ctx.bezierCurveTo(G.CENTER_X + 15, 355, G.CENTER_X + 35, 370, G.CENTER_X + 53, 385);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(G.CENTER_X, 345);
    ctx.bezierCurveTo(G.CENTER_X - 15, 355, G.CENTER_X - 35, 375, G.CENTER_X - 57, 395);
    ctx.stroke();
  }

  // ── LIVER ───────────────────────────────────────────────────────────────────
  function drawLiver(ctx, ts) {
    const cx = G.CENTER_X + 50;
    const cy = 505;
    const alpha = 0.15 + Math.sin(ts * 0.0003) * 0.02;

    ctx.fillStyle = 'rgba(120, 60, 40, ' + alpha + ')';
    ctx.beginPath();
    ctx.moveTo(cx - 70, cy - 15);
    ctx.bezierCurveTo(cx - 60, cy - 35, cx + 20, cy - 40, cx + 60, cy - 20);
    ctx.bezierCurveTo(cx + 70, cy, cx + 50, cy + 25, cx, cy + 20);
    ctx.bezierCurveTo(cx - 40, cy + 15, cx - 75, cy + 5, cx - 70, cy - 15);
    ctx.fill();

    // Hepatic lobes division
    ctx.strokeStyle = 'rgba(160, 90, 60, ' + (alpha * 0.5) + ')';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - 30);
    ctx.bezierCurveTo(cx - 5, cy, cx - 15, cy + 15, cx - 20, cy + 18);
    ctx.stroke();

    // Gallbladder
    ctx.fillStyle = 'rgba(80, 140, 60, ' + (alpha * 0.6) + ')';
    ctx.beginPath();
    ctx.ellipse(cx - 20, cy + 8, 8, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── STOMACH ─────────────────────────────────────────────────────────────────
  function drawStomach(ctx, ts) {
    const cx = G.CENTER_X - 30;
    const cy = 510;
    const churn = Math.sin(ts * 0.001) * 0.01;
    const alpha = 0.12 + state.digestActive * 0.06;

    ctx.fillStyle = 'rgba(160, 100, 80, ' + alpha + ')';
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(churn);
    ctx.beginPath();
    ctx.moveTo(-10, -35);
    ctx.bezierCurveTo(25, -40, 40, -10, 35, 20);
    ctx.bezierCurveTo(30, 40, 5, 42, -15, 30);
    ctx.bezierCurveTo(-35, 20, -40, -5, -30, -25);
    ctx.bezierCurveTo(-25, -35, -15, -36, -10, -35);
    ctx.fill();

    // Rugae (stomach folds)
    ctx.strokeStyle = 'rgba(190, 130, 100, ' + (alpha * 0.4) + ')';
    ctx.lineWidth = 0.6;
    for (let i = 0; i < 4; i++) {
      const fy = -15 + i * 12;
      ctx.beginPath();
      ctx.moveTo(-20, fy);
      ctx.bezierCurveTo(-5, fy + 3, 10, fy - 2, 25, fy + 1);
      ctx.stroke();
    }
    ctx.restore();

    // Esophagus connection
    ctx.strokeStyle = 'rgba(160, 100, 80, ' + (alpha * 0.3) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 35);
    ctx.bezierCurveTo(cx, cy - 60, G.CENTER_X - 5, cy - 90, G.CENTER_X, 345);
    ctx.stroke();
  }

  // ── KIDNEYS ─────────────────────────────────────────────────────────────────
  function drawKidneys(ctx, ts) {
    const alpha = 0.13 + Math.sin(ts * 0.0004) * 0.02;

    [{ cx: G.CENTER_X - 80, cy: 555 }, { cx: G.CENTER_X + 80, cy: 550 }].forEach((k, i) => {
      const side = i === 0 ? -1 : 1;

      // Kidney bean shape
      ctx.fillStyle = 'rgba(140, 60, 50, ' + alpha + ')';
      ctx.beginPath();
      ctx.moveTo(k.cx, k.cy - 20);
      ctx.bezierCurveTo(k.cx + side * 18, k.cy - 22, k.cx + side * 22, k.cy, k.cx + side * 18, k.cy + 20);
      ctx.bezierCurveTo(k.cx + side * 10, k.cy + 22, k.cx - side * 5, k.cy + 15, k.cx - side * 8, k.cy);
      ctx.bezierCurveTo(k.cx - side * 5, k.cy - 12, k.cx - side * 2, k.cy - 18, k.cx, k.cy - 20);
      ctx.fill();

      // Hilum (indentation where vessels enter)
      ctx.fillStyle = 'rgba(100, 40, 35, ' + (alpha * 0.5) + ')';
      ctx.beginPath();
      ctx.arc(k.cx - side * 5, k.cy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Renal artery/vein
      ctx.strokeStyle = 'rgba(180, 70, 60, ' + (alpha * 0.3) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(k.cx - side * 5, k.cy);
      ctx.lineTo(G.CENTER_X + side * 15, k.cy - 5);
      ctx.stroke();

      // Ureter (down to bladder)
      ctx.strokeStyle = 'rgba(160, 120, 100, ' + (alpha * 0.2) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(k.cx - side * 3, k.cy + 18);
      ctx.bezierCurveTo(k.cx - side * 10, k.cy + 80, G.CENTER_X + side * 15, 680, G.CENTER_X + side * 8, 710);
      ctx.stroke();
    });
  }

  // ── INTESTINES (simplified) ─────────────────────────────────────────────────
  function drawIntestines(ctx, ts) {
    const cx = G.CENTER_X;
    const cy = 610;
    const peristalsis = ts * 0.0005;
    const alpha = 0.08 + state.digestActive * 0.04;

    // Small intestine (loopy)
    ctx.strokeStyle = 'rgba(180, 130, 110, ' + alpha + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let x = cx - 30, y = cy - 40;
    ctx.moveTo(x, y);
    for (let i = 0; i < 12; i++) {
      const nextX = x + Math.sin(i * 1.2 + peristalsis) * 25;
      const nextY = y + 8;
      ctx.bezierCurveTo(x + 15, y + 2, nextX - 10, nextY - 2, nextX, nextY);
      x = nextX; y = nextY;
    }
    ctx.stroke();

    // Large intestine (ascending, transverse, descending)
    ctx.strokeStyle = 'rgba(160, 110, 90, ' + (alpha * 1.2) + ')';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    // Ascending colon (right side)
    ctx.moveTo(cx + 70, cy + 60);
    ctx.lineTo(cx + 70, cy - 30);
    // Transverse colon
    ctx.bezierCurveTo(cx + 50, cy - 40, cx - 50, cy - 40, cx - 70, cy - 30);
    // Descending colon (left side)
    ctx.lineTo(cx - 70, cy + 50);
    // Sigmoid
    ctx.bezierCurveTo(cx - 60, cy + 70, cx - 30, cy + 75, cx - 10, cy + 65);
    ctx.stroke();

    // Haustra (pouches) — small bumps on large intestine
    ctx.fillStyle = 'rgba(160, 110, 90, ' + (alpha * 0.3) + ')';
    for (let i = 0; i < 6; i++) {
      const hy = cy - 25 + i * 15;
      ctx.beginPath(); ctx.arc(cx + 76, hy, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx - 76, hy, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── BLADDER ─────────────────────────────────────────────────────────────────
  function drawBladder(ctx, ts) {
    const cx = G.CENTER_X;
    const cy = 715;
    const alpha = 0.1;

    ctx.fillStyle = 'rgba(100, 120, 160, ' + alpha + ')';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(130, 150, 190, ' + (alpha * 0.5) + ')';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ── SPLEEN ──────────────────────────────────────────────────────────────────
  function drawSpleen(ctx, ts) {
    const cx = G.CENTER_X - 95;
    const cy = 510;
    const alpha = 0.12;

    ctx.fillStyle = 'rgba(120, 50, 70, ' + alpha + ')';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 15, 22, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── DIAPHRAGM ───────────────────────────────────────────────────────────────
  function drawDiaphragm(ctx, ts) {
    const breathCycle = 60000 / state.breathRate;
    const breathPhase = (ts % breathCycle) / breathCycle;
    let position = 0;
    if (breathPhase < 0.4) position = -Math.sin(breathPhase / 0.4 * Math.PI / 2) * 8;
    else if (breathPhase < 0.45) position = -8;
    else if (breathPhase < 0.85) position = -8 + Math.sin((breathPhase - 0.45) / 0.4 * Math.PI / 2) * 8;

    const cy = 480 + position;
    const alpha = 0.08;

    ctx.strokeStyle = 'rgba(160, 120, 130, ' + alpha + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(G.CENTER_X - 130, cy + 10);
    ctx.bezierCurveTo(G.CENTER_X - 60, cy - 15, G.CENTER_X + 60, cy - 15, G.CENTER_X + 130, cy + 10);
    ctx.stroke();
  }

  // ── MAIN DRAW ───────────────────────────────────────────────────────────────
  function draw(ts) {
    if (!_initialized || !_visible) return;
    if (ts - _last < 42) return;  // ~24fps
    _last = ts;

    const canvas = document.getElementById('mainCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.save();

    // Draw back-to-front for proper layering
    drawDiaphragm(ctx, ts);
    drawIntestines(ctx, ts);
    drawBladder(ctx, ts);
    drawKidneys(ctx, ts);
    drawSpleen(ctx, ts);
    drawStomach(ctx, ts);
    drawLiver(ctx, ts);
    drawLungs(ctx, ts);
    drawHeart(ctx, ts);

    ctx.restore();
  }

  function setVisible(v) { _visible = v; }
  function isVisible() { return _visible; }

  // Expose state for other systems to influence
  function setHeartRate(bpm) { state.heartRate = Math.max(40, Math.min(200, bpm)); }
  function setBreathRate(bpm) { state.breathRate = Math.max(6, Math.min(40, bpm)); }
  function setDigestActive(v) { state.digestActive = Math.max(0, Math.min(1, v)); }

  return {
    init, draw, setVisible, isVisible,
    setHeartRate, setBreathRate, setDigestActive,
    state,
  };
})();

setTimeout(() => { if (window.BODY_GEOMETRY) ORGANS.init(); }, 400);
