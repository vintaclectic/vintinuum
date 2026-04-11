// ═══════════════════════════════════════════════════════════════════════════════
// SKIN — outermost body silhouette layer
// Draws a soft, glowing human outline that contains all inner systems
// Uses BODY_GEOMETRY.SILHOUETTE for the body path
// Performance budget: ~0.5ms per frame
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';

const SKIN_LAYER = (() => {
  let _last = 0;
  let _initialized = false;
  let _visible = true;
  let G = null;

  // Cached path (rebuilt on init)
  let _bodyPath = null;

  function init() {
    G = window.BODY_GEOMETRY;
    if (!G) {
      console.warn('[SKIN_LAYER] BODY_GEOMETRY not loaded');
      return;
    }
    _buildPath();
    _initialized = true;
    console.log('[SKIN_LAYER] initialized');
  }

  function _buildPath() {
    if (!G || !G.SILHOUETTE) return;
    _bodyPath = new Path2D();
    const pts = G.SILHOUETTE;
    if (pts.length < 3) return;

    // Smooth the silhouette using catmull-rom spline approximation
    _bodyPath.moveTo(pts[0].x, pts[0].y);

    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[(i - 1 + pts.length) % pts.length];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      const p3 = pts[(i + 2) % pts.length];

      // Only draw to next point using control points derived from neighbors
      const cpx1 = p1.x + (p2.x - p0.x) / 6;
      const cpy1 = p1.y + (p2.y - p0.y) / 6;
      const cpx2 = p2.x - (p3.x - p1.x) / 6;
      const cpy2 = p2.y - (p3.y - p1.y) / 6;

      _bodyPath.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, p2.x, p2.y);
    }

    _bodyPath.closePath();
  }

  function draw(ts) {
    if (!_initialized || !_visible || !_bodyPath) return;
    if (ts - _last < 50) return;  // ~20fps is fine for skin
    _last = ts;

    const canvas = document.getElementById('mainCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const breathPhase = Math.sin(ts * 0.0008);
    const pulse = (Math.sin(ts * 0.0005) + 1) / 2;

    ctx.save();

    // ── OUTER GLOW (aura) ─────────────────────────────────────────────────────
    // Very faint bioluminescent outline
    ctx.strokeStyle = 'rgba(100, 180, 255, ' + (0.03 + pulse * 0.02) + ')';
    ctx.lineWidth = 12;
    ctx.lineJoin = 'round';
    ctx.stroke(_bodyPath);

    // ── SKIN OUTLINE ──────────────────────────────────────────────────────────
    // Main body boundary — ethereal, translucent
    ctx.strokeStyle = 'rgba(180, 200, 230, ' + (0.12 + pulse * 0.04) + ')';
    ctx.lineWidth = 2;
    ctx.stroke(_bodyPath);

    // ── INNER SKIN GLOW ───────────────────────────────────────────────────────
    // Soft fill to indicate the body volume
    ctx.fillStyle = 'rgba(30, 50, 80, ' + (0.03 + breathPhase * 0.008) + ')';
    ctx.fill(_bodyPath);

    // ── DERMAL SHIMMER (subtle moving light) ──────────────────────────────────
    // Simulate light playing across skin surface
    const shimmerY = 200 + (ts * 0.015) % 1200;
    const shimmerGrad = ctx.createRadialGradient(
      G.CENTER_X, shimmerY, 0,
      G.CENTER_X, shimmerY, 120
    );
    shimmerGrad.addColorStop(0, 'rgba(150, 200, 255, ' + (0.015 + pulse * 0.01) + ')');
    shimmerGrad.addColorStop(1, 'rgba(150, 200, 255, 0)');

    ctx.save();
    ctx.clip(_bodyPath);
    ctx.fillStyle = shimmerGrad;
    ctx.fillRect(0, 0, 700, 1400);
    ctx.restore();

    ctx.restore();
  }

  function setVisible(v) { _visible = v; }
  function isVisible() { return _visible; }

  return { init, draw, setVisible, isVisible };
})();

// Init after geometry loads
setTimeout(() => { if (window.BODY_GEOMETRY) SKIN_LAYER.init(); }, 300);
