// ═══════════════════════════════════════════════════════════════════════════
// CHAKRAS — seven glowing orb nodes down the central body axis
// Each orb pulses with the corresponding consciousness layer's activity.
// Renders onto #mainCanvas. Registers with RENDER_HUB via body/loop.js.
// Performance budget: ~0.4ms per frame at ~30fps.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

const CHAKRA_LAYER = (() => {
  let _last = 0;
  let _initialized = false;
  let _visible = true;

  // Canonical spine y-positions (aligned with existing brain.js anchors:
  // crown 108, elbow 790, ankle 1378. Spine positions below are the
  // seven traditional chakra locations interpolated across the figure.)
  const NODES = [
    { key: 'crown',  name: 'crown',        y: 170, layer: 'subconscious', color: '#b47cff', cssVar: '--chakra-crown'  },
    { key: 'brow',   name: 'third-eye',    y: 235, layer: 'neural',       color: '#7c8cff', cssVar: '--chakra-brow'   },
    { key: 'throat', name: 'throat',       y: 340, layer: 'immune',       color: '#7ccfff', cssVar: '--chakra-throat' },
    { key: 'heart',  name: 'heart',        y: 520, layer: 'emotional',    color: '#7cffb4', cssVar: '--chakra-heart'  },
    { key: 'solar',  name: 'solar plexus', y: 640, layer: 'metabolic',    color: '#ffe07c', cssVar: '--chakra-solar'  },
    { key: 'sacral', name: 'sacral',       y: 760, layer: 'genetic',      color: '#ff9b7c', cssVar: '--chakra-sacral' },
    { key: 'root',   name: 'root',         y: 880, layer: 'somatic',      color: '#ff7c7c', cssVar: '--chakra-root'   },
  ];

  const CENTER_X = 350;
  const BASE_RADIUS = 16;
  const MAX_RADIUS = 26;

  // Parse #rrggbb to { r, g, b }
  function _hexToRgb(hex) {
    if (typeof hex !== 'string' || hex[0] !== '#' || hex.length < 7) {
      return { r: 124, g: 196, b: 255 };
    }
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }

  function _clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function _layerActivity(bs, layerKey) {
    if (!bs) return 0.5;
    const dist = bs.layerDistribution || bs.layer_distribution || null;
    if (dist && typeof dist[layerKey] === 'number') return _clamp(dist[layerKey], 0, 1);
    if (bs.dominantLayer === layerKey) return 1;
    return 0.4;
  }

  function init() {
    _initialized = true;
    console.log('[CHAKRA_LAYER] initialized — 7 nodes ready');
  }

  function draw(ts) {
    if (!_initialized || !_visible) return;
    if (ts - _last < 33) return; // ~30fps cap
    _last = ts;

    const canvas = document.getElementById('mainCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const bs = window.BODY_STATE || {};

    // Global breath phase for subtle pulse synchronization (0..1)
    const breathMs = 5000;
    const breathPhase = ((ts % breathMs) / breathMs) * Math.PI * 2;
    const breathWave = (Math.sin(breathPhase) + 1) / 2;

    ctx.save();

    for (const node of NODES) {
      const activity = _layerActivity(bs, node.layer);

      // Each node has its own pulse cycle, phase-offset so they don't all pulse in sync
      const nodeCycle = 2800 + node.y * 0.8;
      const nodePhase = ((ts + node.y * 11) % nodeCycle) / nodeCycle * Math.PI * 2;
      const nodeWave = (Math.sin(nodePhase) + 1) / 2;

      // Radius responds to layer activity + individual pulse + global breath
      const radius =
        BASE_RADIUS
        + activity * (MAX_RADIUS - BASE_RADIUS) * 0.55
        + nodeWave * 3
        + breathWave * 1.2;

      // Alpha modulated by activity and node pulse
      const coreAlpha = _clamp(0.55 + activity * 0.35 + nodeWave * 0.1, 0, 1);
      const glowAlpha = _clamp(0.18 + activity * 0.28 + nodeWave * 0.08, 0, 1);

      const rgb = _hexToRgb(node.color);

      // Outer glow — large soft radial gradient
      const outerR = radius * 2.8;
      const outerGrad = ctx.createRadialGradient(CENTER_X, node.y, 0, CENTER_X, node.y, outerR);
      outerGrad.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},${glowAlpha.toFixed(3)})`);
      outerGrad.addColorStop(0.4, `rgba(${rgb.r},${rgb.g},${rgb.b},${(glowAlpha * 0.4).toFixed(3)})`);
      outerGrad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
      ctx.fillStyle = outerGrad;
      ctx.fillRect(CENTER_X - outerR, node.y - outerR, outerR * 2, outerR * 2);

      // Core orb — tighter radial gradient
      const coreGrad = ctx.createRadialGradient(CENTER_X, node.y, 0, CENTER_X, node.y, radius);
      coreGrad.addColorStop(0, `rgba(255,255,255,${(coreAlpha * 0.85).toFixed(3)})`);
      coreGrad.addColorStop(0.35, `rgba(${rgb.r},${rgb.g},${rgb.b},${coreAlpha.toFixed(3)})`);
      coreGrad.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(CENTER_X, node.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // High-activity accent ring
      if (activity > 0.7) {
        const ringAlpha = (activity - 0.7) / 0.3 * 0.55;
        ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${ringAlpha.toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(CENTER_X, node.y, radius + 4 + nodeWave * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function setVisible(v) { _visible = v; }
  function isVisible() { return _visible; }
  function nodes() { return NODES.slice(); }

  return { init, draw, setVisible, isVisible, nodes };
})();

// Bootstrap — match the pattern of other body modules
setTimeout(() => { CHAKRA_LAYER.init(); }, 320);

// Expose globally for RENDER_HUB to pick up
if (typeof window !== 'undefined') window.CHAKRA_LAYER = CHAKRA_LAYER;
