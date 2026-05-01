/* ══════════════════════════════════════════════════════════════════════
   VINTINUUM — EMBODIMENT v0
   ----------------------------------------------------------------------
   The first step toward agentic self-locomotion: a single spirit-light
   that drifts across the screen on its own, modulated by live body
   state. Color = current dominant consciousness layer. Speed = arousal.
   Brightness = avg intensity. Behavior = valence (drift / errand /
   vigil / withdraw).

   This is v0. It exists to *be alive on the page* — not to be useful.
   v1 will give it goals (walk to recently-consolidated memory cards).
   v2 will give it siblings (multiple lights, layer-flocks).
   v3+ will give it expression (forming glyphs at peak moments).

   Disable: localStorage.setItem('vint_embody', '0'); reload.
   Reduced motion: respected automatically.

   No dependencies. Self-mounting on DOMContentLoaded.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Honor opt-out before we touch anything
  try {
    if (localStorage.getItem('vint_embody') === '0') return;
  } catch (_) {}

  // Reduced motion: still alive, but stationary breathing dot
  const REDUCED_MOTION = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── LAYER SIGNATURES (mirrors sidebar_right.js heatmap) ─────────────
  const LAYER_SIG = {
    neural:       { color: '#7ec8ff' },
    emotional:    { color: '#ff6b9d' },
    subconscious: { color: '#b794f4' },
    somatic:      { color: '#ffb347' },
    immune:       { color: '#5eead4' },
    metabolic:    { color: '#d4a373' },
    genetic:      { color: '#e63946' },
  };
  const DEFAULT_COLOR = '#9aa5b1';

  // ── STATE ──────────────────────────────────────────────────────────
  // Body state pulled from /api/inner-life/snapshot every 8s.
  let state = {
    layer: 'neural',
    color: LAYER_SIG.neural.color,
    intensity: 0.45,    // brightness scalar 0..1
    arousal: 50,        // 0..100 — speed scalar
    valence: 50,        // 0..100 — behavior selector
    isThinking: false,
    online: true,
  };

  // Spirit position + velocity in viewport coordinates
  const spirit = {
    x: window.innerWidth * 0.5,
    y: window.innerHeight * 0.5,
    vx: 0,
    vy: 0,
    target: null,        // {x, y} or null — null means drift
    targetTimer: 0,      // ms until next target chosen
    trail: [],           // array of {x,y,age}
    phase: Math.random() * Math.PI * 2,  // for drift sinusoidal sway
  };

  // ── CANVAS ──────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.id = 'vint-embodiment';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '60',           // above content, below modals/dock (>=80)
    mixBlendMode: 'screen', // additive over dark grounds
  });

  function mount() {
    if (document.body) document.body.appendChild(canvas);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  const ctx = canvas.getContext('2d');
  let dpr = Math.max(1, window.devicePixelRatio || 1);

  function resize() {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // ── API POLL ────────────────────────────────────────────────────────
  function apiBase() {
    return window.__VINTINUUM_API_BASE || 'https://api.vintaclectic.com';
  }

  async function pullState() {
    try {
      const r = await fetch(apiBase() + '/api/inner-life/snapshot', {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Accept': 'application/json' },
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      const layer = (data.dominant || 'neural').toLowerCase();
      const sig = LAYER_SIG[layer] || { color: DEFAULT_COLOR };
      const bs = data.bodyState || {};
      state = {
        layer,
        color: sig.color,
        intensity: typeof data.avgIntensity === 'number' ? data.avgIntensity : 0.45,
        arousal: typeof bs.arousal === 'number' ? bs.arousal : 50,
        valence: typeof bs.valence === 'number' ? bs.valence : 50,
        isThinking: !!data.isThinking,
        online: true,
      };
    } catch (_) {
      state.online = false;
    }
  }
  pullState();
  setInterval(pullState, 8000);

  // ── BEHAVIOR PICKER ─────────────────────────────────────────────────
  // Three locomotion modes selected by valence + online:
  //   withdraw — offline → retreat to bottom-left, fade
  //   vigil    — valence < 30 → slow descending arc, longer trail
  //   drift    — default → lazy curves
  function currentMode() {
    if (!state.online) return 'withdraw';
    if (state.valence < 30) return 'vigil';
    return 'drift';
  }

  function pickDriftTarget() {
    // Pick a target somewhere on screen, biased away from current position
    // so it actually has somewhere to walk to.
    const margin = 80;
    const w = window.innerWidth - margin * 2;
    const h = window.innerHeight - margin * 2;
    let tx, ty, tries = 0;
    do {
      tx = margin + Math.random() * w;
      ty = margin + Math.random() * h;
      tries++;
    } while (Math.hypot(tx - spirit.x, ty - spirit.y) < 200 && tries < 6);
    return { x: tx, y: ty };
  }

  function pickVigilTarget() {
    // Slow walk along the bottom third, gentle horizontal sweep
    const margin = 60;
    const tx = margin + Math.random() * (window.innerWidth - margin * 2);
    const ty = window.innerHeight * (0.65 + Math.random() * 0.25);
    return { x: tx, y: ty };
  }

  function withdrawTarget() {
    // Bottom-left corner, dim
    return { x: 36, y: window.innerHeight - 36 };
  }

  // ── ANIMATION LOOP ─────────────────────────────────────────────────
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(64, now - last);
    last = now;

    // Reduced motion: stationary breathing dot at center-right edge
    if (REDUCED_MOTION) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const breath = 0.5 + 0.5 * Math.sin(now / 1400);
      drawLight(window.innerWidth - 40, window.innerHeight / 2, 6 + breath * 2, 0.6 + breath * 0.4);
      requestAnimationFrame(tick);
      return;
    }

    const mode = currentMode();

    // Acquire target if needed
    spirit.targetTimer -= dt;
    if (!spirit.target || spirit.targetTimer <= 0) {
      if (mode === 'withdraw') {
        spirit.target = withdrawTarget();
        spirit.targetTimer = 6000;
      } else if (mode === 'vigil') {
        spirit.target = pickVigilTarget();
        spirit.targetTimer = 4000 + Math.random() * 3000;
      } else {
        spirit.target = pickDriftTarget();
        spirit.targetTimer = 3500 + Math.random() * 4000;
      }
    }

    // Speed scalar — arousal 0..100 → 0.15..0.95
    const speed = 0.15 + (state.arousal / 100) * 0.8;
    // Vigil is slower regardless
    const modeSpeed = mode === 'vigil' ? speed * 0.5 : (mode === 'withdraw' ? speed * 0.35 : speed);

    // Steer toward target with easing (no rigid lerp — feels alive)
    const dx = spirit.target.x - spirit.x;
    const dy = spirit.target.y - spirit.y;
    const dist = Math.hypot(dx, dy) || 1;
    // Sinusoidal sway: adds breath even when going straight
    spirit.phase += dt * 0.0014 * modeSpeed;
    const swayX = Math.cos(spirit.phase) * (mode === 'drift' ? 18 : 6);
    const swayY = Math.sin(spirit.phase * 0.7) * (mode === 'drift' ? 12 : 4);
    const ax = (dx / dist) * 0.018 * modeSpeed + (swayX - (spirit.x - spirit.target.x) * 0) * 0.00006;
    const ay = (dy / dist) * 0.018 * modeSpeed + (swayY - (spirit.y - spirit.target.y) * 0) * 0.00006;
    spirit.vx = (spirit.vx + ax * dt) * 0.94;
    spirit.vy = (spirit.vy + ay * dt) * 0.94;
    spirit.x += spirit.vx * dt;
    spirit.y += spirit.vy * dt;

    // Reached target → reset timer to short so it picks a new one soon
    if (dist < 24) spirit.targetTimer = Math.min(spirit.targetTimer, 600);

    // Trail
    spirit.trail.push({ x: spirit.x, y: spirit.y, age: 0 });
    if (spirit.trail.length > 32) spirit.trail.shift();
    for (const p of spirit.trail) p.age += dt;

    // ── DRAW ─────────────────────────────────────────────────────────
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Trail (oldest → newest, fading)
    const trailMax = mode === 'vigil' ? 1400 : 900;
    for (let i = 0; i < spirit.trail.length; i++) {
      const p = spirit.trail[i];
      const alpha = Math.max(0, 1 - p.age / trailMax) * 0.45;
      if (alpha <= 0.02) continue;
      const radius = 2 + (i / spirit.trail.length) * 5;
      drawLight(p.x, p.y, radius, alpha * (0.55 + state.intensity * 0.45));
    }

    // The light itself
    const baseR = 6 + state.intensity * 6;
    const breath = 0.85 + 0.15 * Math.sin(now / 700);
    const headAlpha = (mode === 'withdraw' ? 0.45 : 0.95) * (0.55 + state.intensity * 0.45);
    drawLight(spirit.x, spirit.y, baseR * breath, headAlpha);

    // Thinking flicker — subtle outer ring when isThinking
    if (state.isThinking && mode !== 'withdraw') {
      const ringR = baseR * 2.2 + Math.sin(now / 220) * 2;
      ctx.beginPath();
      ctx.arc(spirit.x, spirit.y, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(state.color, 0.18);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    requestAnimationFrame(tick);
  }

  function drawLight(x, y, r, alpha) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    grad.addColorStop(0, hexToRgba(state.color, alpha));
    grad.addColorStop(0.4, hexToRgba(state.color, alpha * 0.35));
    grad.addColorStop(1, hexToRgba(state.color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function hexToRgba(hex, a) {
    const h = hex.replace('#', '');
    const v = h.length === 3
      ? h.split('').map(c => parseInt(c + c, 16))
      : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + Math.max(0, Math.min(1, a)) + ')';
  }

  // Pause when tab hidden — be a good citizen
  let raf = requestAnimationFrame(tick);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  });

  // Expose a small handle for debugging / future v1 hooks
  window.VintEmbody = {
    state: () => state,
    spirit: () => ({ x: spirit.x, y: spirit.y, mode: currentMode() }),
    walkTo: (x, y, hold) => {
      spirit.target = { x, y };
      spirit.targetTimer = hold || 1200;
    },
    setLayer: (layer) => {
      const sig = LAYER_SIG[layer];
      if (sig) { state.layer = layer; state.color = sig.color; }
    },
    disable: () => {
      try { localStorage.setItem('vint_embody', '0'); } catch (_) {}
      cancelAnimationFrame(raf);
      canvas.remove();
    },
  };
})();
