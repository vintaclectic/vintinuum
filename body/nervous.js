// ═══════════════════════════════════════════════════════════════════════════════
// NERVOUS_BODY — peripheral nervous system extending from brain/spine
// Draws nerve pathways throughout the body with signal propagation
// Integrates with existing PERIPHERAL_NS in brain.js for spinal signals
// Uses BODY_GEOMETRY for coordinates (700×1400 viewBox)
// Performance budget: ~0.6ms per frame
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';

const NERVOUS_BODY = (() => {
  let _last = 0;
  let _initialized = false;
  let _visible = true;
  let G = null;

  // Nerve signal particles
  const signals = [];
  const MAX_SIGNALS = 25;
  const SIGNAL_SPEED = 0.003;

  // Major nerve pathways
  const NERVES = {};

  function init() {
    G = window.BODY_GEOMETRY;
    if (!G) { console.warn('[NERVOUS_BODY] BODY_GEOMETRY not loaded'); return; }

    const CX = G.CENTER_X;

    // ── BRACHIAL PLEXUS (C5-T1 → arms) ───────────────────────────────────────
    NERVES.leftBrachialPlexus = {
      color: 'rgba(255, 220, 80, ',
      width: 1.5,
      points: [
        { x: CX - 15, y: 310 },
        { x: CX - 60, y: 315 },
        { x: CX - 120, y: 318 },
        { x: CX - 175, y: 315 },
      ],
    };
    NERVES.rightBrachialPlexus = {
      color: 'rgba(255, 220, 80, ',
      width: 1.5,
      points: [
        { x: CX + 15, y: 310 },
        { x: CX + 60, y: 315 },
        { x: CX + 120, y: 318 },
        { x: CX + 175, y: 315 },
      ],
    };

    // ── MEDIAN NERVE (arm → hand) ─────────────────────────────────────────────
    NERVES.leftMedian = {
      color: 'rgba(255, 210, 60, ',
      width: 1,
      points: [
        { x: CX - 175, y: 315 },
        { x: CX - 192, y: 400 },
        { x: CX - 208, y: 490 },
        { x: CX - 222, y: 600 },
        { x: CX - 228, y: 670 },
      ],
    };
    NERVES.rightMedian = {
      color: 'rgba(255, 210, 60, ',
      width: 1,
      points: [
        { x: CX + 175, y: 315 },
        { x: CX + 192, y: 400 },
        { x: CX + 208, y: 490 },
        { x: CX + 222, y: 600 },
        { x: CX + 228, y: 670 },
      ],
    };

    // ── INTERCOSTAL NERVES (between ribs) ─────────────────────────────────────
    for (let i = 0; i < 12; i++) {
      const ribY = 350 + i * 15;
      const w = 80 + (i < 7 ? i * 8 : (12 - i) * 8);
      NERVES['intercostalL' + i] = {
        color: 'rgba(255, 200, 50, ',
        width: 0.6,
        points: [
          { x: CX - 8, y: ribY },
          { x: CX - w * 0.5, y: ribY + 2 },
          { x: CX - w, y: ribY + 5 },
        ],
      };
      NERVES['intercostalR' + i] = {
        color: 'rgba(255, 200, 50, ',
        width: 0.6,
        points: [
          { x: CX + 8, y: ribY },
          { x: CX + w * 0.5, y: ribY + 2 },
          { x: CX + w, y: ribY + 5 },
        ],
      };
    }

    // ── LUMBAR PLEXUS (L1-L4 → upper leg) ─────────────────────────────────────
    NERVES.leftLumbar = {
      color: 'rgba(255, 215, 70, ',
      width: 1.2,
      points: [
        { x: CX - 10, y: 540 },
        { x: CX - 40, y: 600 },
        { x: CX - 60, y: 680 },
      ],
    };
    NERVES.rightLumbar = {
      color: 'rgba(255, 215, 70, ',
      width: 1.2,
      points: [
        { x: CX + 10, y: 540 },
        { x: CX + 40, y: 600 },
        { x: CX + 60, y: 680 },
      ],
    };

    // ── SCIATIC NERVE (largest nerve — down the leg) ──────────────────────────
    NERVES.leftSciatic = {
      color: 'rgba(255, 220, 80, ',
      width: 2,
      points: [
        { x: CX - 60, y: 680 },
        { x: CX - 75, y: 750 },
        { x: CX - 80, y: 850 },
        { x: CX - 80, y: 960 },
        { x: CX - 78, y: 1060 },
        { x: CX - 76, y: 1150 },
      ],
    };
    NERVES.rightSciatic = {
      color: 'rgba(255, 220, 80, ',
      width: 2,
      points: [
        { x: CX + 60, y: 680 },
        { x: CX + 75, y: 750 },
        { x: CX + 80, y: 850 },
        { x: CX + 80, y: 960 },
        { x: CX + 78, y: 1060 },
        { x: CX + 76, y: 1150 },
      ],
    };

    // ── VAGUS NERVE (brain → organs, parasympathetic) ─────────────────────────
    NERVES.leftVagus = {
      color: 'rgba(180, 255, 140, ',
      width: 1.2,
      points: [
        { x: CX - 25, y: 200 },
        { x: CX - 30, y: 260 },
        { x: CX - 25, y: 340 },
        { x: CX - 15, y: 400 },  // Heart innervation
        { x: CX - 20, y: 480 },  // Stomach
        { x: CX - 10, y: 560 },  // Intestines
      ],
    };
    NERVES.rightVagus = {
      color: 'rgba(180, 255, 140, ',
      width: 1.2,
      points: [
        { x: CX + 25, y: 200 },
        { x: CX + 30, y: 260 },
        { x: CX + 25, y: 340 },
        { x: CX + 20, y: 400 },
        { x: CX + 25, y: 480 },
        { x: CX + 15, y: 560 },
      ],
    };

    // ── PHRENIC NERVE (C3-C5 → diaphragm) ────────────────────────────────────
    NERVES.leftPhrenic = {
      color: 'rgba(200, 255, 160, ',
      width: 0.8,
      points: [
        { x: CX - 10, y: 300 },
        { x: CX - 20, y: 380 },
        { x: CX - 30, y: 475 },
      ],
    };
    NERVES.rightPhrenic = {
      color: 'rgba(200, 255, 160, ',
      width: 0.8,
      points: [
        { x: CX + 10, y: 300 },
        { x: CX + 20, y: 380 },
        { x: CX + 30, y: 475 },
      ],
    };

    // Seed initial signals
    const nerveKeys = Object.keys(NERVES);
    for (let i = 0; i < MAX_SIGNALS; i++) {
      signals.push({
        nerve: nerveKeys[Math.floor(Math.random() * nerveKeys.length)],
        t: Math.random(),
        speed: SIGNAL_SPEED * (0.5 + Math.random()),
        direction: Math.random() > 0.5 ? 1 : -1,  // Afferent vs efferent
        brightness: 0.5 + Math.random() * 0.5,
      });
    }

    _initialized = true;
    console.log('[NERVOUS_BODY] initialized — ' + nerveKeys.length + ' nerve pathways');
  }

  function getPointOnPath(points, t) {
    if (points.length < 2) return points[0] || { x: 0, y: 0 };
    const total = points.length - 1;
    const seg = Math.min(Math.floor(t * total), total - 1);
    const lt = (t * total) - seg;
    const p0 = points[seg];
    const p1 = points[seg + 1];
    return { x: p0.x + (p1.x - p0.x) * lt, y: p0.y + (p1.y - p0.y) * lt };
  }

  function drawNerves(ctx, alpha) {
    const keys = Object.keys(NERVES);
    for (let k = 0; k < keys.length; k++) {
      const nerve = NERVES[keys[k]];
      if (nerve.points.length < 2) continue;

      ctx.strokeStyle = nerve.color + (alpha * 0.1) + ')';
      ctx.lineWidth = nerve.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(nerve.points[0].x, nerve.points[0].y);
      for (let i = 1; i < nerve.points.length; i++) {
        ctx.lineTo(nerve.points[i].x, nerve.points[i].y);
      }
      ctx.stroke();
    }
  }

  function drawSignals(ctx, ts, alpha) {
    const nerveKeys = Object.keys(NERVES);

    signals.forEach(sig => {
      const nerve = NERVES[sig.nerve];
      if (!nerve || nerve.points.length < 2) return;

      // Advance
      sig.t += sig.speed * sig.direction;
      if (sig.t > 1 || sig.t < 0) {
        sig.t = sig.direction > 0 ? 0 : 1;
        // Respawn on random nerve
        if (Math.random() < 0.4) {
          sig.nerve = nerveKeys[Math.floor(Math.random() * nerveKeys.length)];
          sig.direction = Math.random() > 0.5 ? 1 : -1;
        }
      }

      const pos = getPointOnPath(nerve.points, sig.t);
      const sigAlpha = alpha * 0.35 * sig.brightness;

      // Bright spark
      ctx.fillStyle = 'rgba(255, 240, 120, ' + sigAlpha + ')';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
      ctx.fill();

      // Glow
      ctx.fillStyle = 'rgba(255, 240, 120, ' + (sigAlpha * 0.3) + ')';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function draw(ts) {
    if (!_initialized || !_visible) return;
    if (ts - _last < 42) return;  // ~24fps
    _last = ts;

    const canvas = document.getElementById('mainCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const alpha = 0.6 + (Math.sin(ts * 0.0004) + 1) / 2 * 0.2;

    ctx.save();
    drawNerves(ctx, alpha);
    drawSignals(ctx, ts, alpha);
    ctx.restore();
  }

  // Fire a signal along a specific nerve (for coherence integration)
  function fireNerve(nerveName) {
    if (!NERVES[nerveName]) return;
    signals.push({
      nerve: nerveName,
      t: 0,
      speed: SIGNAL_SPEED * 2,
      direction: 1,
      brightness: 1,
    });
    // Keep pool bounded
    if (signals.length > MAX_SIGNALS + 10) signals.splice(0, 5);
  }

  function setVisible(v) { _visible = v; }
  function isVisible() { return _visible; }

  return { init, draw, setVisible, isVisible, fireNerve };
})();

setTimeout(() => { if (window.BODY_GEOMETRY) NERVOUS_BODY.init(); }, 600);
if (typeof window !== 'undefined') window.NERVOUS_BODY = NERVOUS_BODY;
