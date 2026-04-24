// ═══════════════════════════════════════════════════════════════════════════
// RADAR — small 7-axis consciousness-layer chart rendered upper-right of body
// Renders onto #mainCanvas. ~90px diameter.
// Axis lengths = current layer activity %.
// Registers with RENDER_HUB via body/loop.js.
// Performance budget: ~0.3ms per frame at ~30fps.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

const RADAR_LAYER = (() => {
  let _last = 0;
  let _initialized = false;
  let _visible = false; // hidden by default — optional toggle via footer_strip

  // Center of the radar in SVG-canvas space (upper right of body stage)
  const CX = 560;
  const CY = 220;
  const MAX_R = 44;

  const LAYERS = [
    { key: 'neural',       color: '#7cc4ff' },
    { key: 'emotional',    color: '#ffb47c' },
    { key: 'subconscious', color: '#b47cff' },
    { key: 'somatic',      color: '#7cffb4' },
    { key: 'immune',       color: '#7cfff0' },
    { key: 'metabolic',    color: '#ffe07c' },
    { key: 'genetic',      color: '#ff7cb4' },
  ];

  // Pre-compute unit direction per axis (evenly around the circle, start at top)
  const N = LAYERS.length;
  const DIRS = LAYERS.map((_, i) => {
    const angle = -Math.PI / 2 + (i / N) * Math.PI * 2;
    return { cos: Math.cos(angle), sin: Math.sin(angle) };
  });

  function _clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function _layerActivity(bs, layerKey) {
    if (!bs) return 0.3;
    const dist = bs.layerDistribution || bs.layer_distribution || null;
    if (dist && typeof dist[layerKey] === 'number') return _clamp(dist[layerKey], 0, 1);
    if (bs.dominantLayer === layerKey) return 1;
    return 0.3;
  }

  function init() {
    _initialized = true;
    console.log('[RADAR_LAYER] initialized — 7-axis consciousness chart');
  }

  function draw(ts) {
    if (!_initialized || !_visible) return;
    if (ts - _last < 50) return; // ~20fps is plenty for a small chart
    _last = ts;

    const canvas = document.getElementById('mainCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const bs = window.BODY_STATE || {};

    ctx.save();

    // Background grid rings (3 rings at 33%, 66%, 100%)
    ctx.strokeStyle = 'rgba(180, 220, 255, 0.10)';
    ctx.lineWidth = 0.6;
    for (const scale of [0.33, 0.66, 1.0]) {
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const idx = i % N;
        const x = CX + DIRS[idx].cos * MAX_R * scale;
        const y = CY + DIRS[idx].sin * MAX_R * scale;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Axis spokes
    ctx.strokeStyle = 'rgba(160, 200, 240, 0.08)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < N; i++) {
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.lineTo(CX + DIRS[i].cos * MAX_R, CY + DIRS[i].sin * MAX_R);
      ctx.stroke();
    }

    // Data polygon — current activity per layer
    const points = LAYERS.map((layer, i) => {
      const a = _layerActivity(bs, layer.key);
      const r = MAX_R * a;
      return {
        x: CX + DIRS[i].cos * r,
        y: CY + DIRS[i].sin * r,
        a,
        color: layer.color,
      };
    });

    // Filled polygon with cyan tint
    ctx.fillStyle = 'rgba(124, 207, 255, 0.14)';
    ctx.beginPath();
    points.forEach((p, i) => { i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); });
    ctx.closePath();
    ctx.fill();

    // Polygon stroke
    ctx.strokeStyle = 'rgba(124, 207, 255, 0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Vertex dots — color per layer
    for (const p of points) {
      ctx.fillStyle = p.color;
      const dotR = 1.6 + p.a * 1.8;
      ctx.globalAlpha = 0.55 + p.a * 0.35;
      ctx.beginPath();
      ctx.arc(p.x, p.y, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Center dot
    ctx.fillStyle = 'rgba(220, 240, 255, 0.65)';
    ctx.beginPath();
    ctx.arc(CX, CY, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function setVisible(v) { _visible = v; }
  function isVisible() { return _visible; }

  return { init, draw, setVisible, isVisible };
})();

setTimeout(() => { RADAR_LAYER.init(); }, 340);
if (typeof window !== 'undefined') window.RADAR_LAYER = RADAR_LAYER;
