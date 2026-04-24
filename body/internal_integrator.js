// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL_INTEGRATOR — binds every SVG system layer to the skin peel state
//
// Directive: "consume and integrate everything that is you externally internally"
//
// Problem fixed: SVG anatomy groups (skeletonLayer @ 0.55, muscleLayer @ 0.35,
//   skinLayer @ 0.18, bodyLayer, and the ambient ringLayer/thoughtLayer/
//   nodeLayer/proteinLayer) carried BAKED-IN opacities. They rendered under
//   the canvas skin — and because several SVG primitives (skull ellipse at
//   y=185 rx=78 ry=88, hip acetabula at cx=295/405 cy=908, shoulder/elbow
//   ring joints, CSF ventricle ring) extend PAST the silhouette, they
//   leaked out around the head and pelvis as "cobweb shit spreading."
//
// Fix: this module reads BODY_STATE.skinPeelAmount + BODY_STATE.peelVisible
//   each frame and writes opacity directly to each SVG group. Default skin
//   opaque (skinPeelAmount = 1) → every internal group opacity = 0. Peel
//   back → groups fade in. The ambient halo layers (ring/thought/node/
//   protein) are additionally gated: only visible when their own
//   peelVisible flag is true (default false) — so no radial crap spreads
//   around the head unless the user explicitly asks for it.
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';

const INTERNAL_INTEGRATOR = (() => {
  let _initialized = false;
  let _last = 0;
  let _nodes = {};

  // SVG groups → which peel key gates them, and their MAX opacity when
  // fully revealed (matches each layer's original baked-in opacity so the
  // look during peel matches what was designed).
  const GROUPS = [
    { id: 'skeletonLayer',    key: 'skeleton',   max: 0.55 },
    { id: 'muscleLayer',      key: 'muscle',     max: 0.35 },
    { id: 'skinLayer',        key: 'skin',       max: 0.18, inverse: true }, // faint SVG overlay
    { id: 'bodyLayer',        key: 'organs',     max: 1.00 },
    // Reproductive group — lives inside bodyLayer but brain.js writes its
    // opacity directly at 60fps based on layerState.reproductive. We
    // hammer it independently to guarantee it can't escape below the
    // crotch apex (y=748) and render "ballage" in the inter-leg V-gap.
    { id: 'reproductiveMale',   key: 'organs',   max: 1.00 },
    { id: 'reproductiveFemale', key: 'organs',   max: 0 },     // always hidden (VINTINUUM body = masculine)
    { id: 'reproductionSystem', key: 'organs',   max: 1.00 },
    // Ambient halo / field layers — the things that visibly spread
    // around the head/body. Hide by default. User can opt-in via _halo.
    { id: 'ringLayer',        key: '_halo',      max: 1.00 },
    { id: 'thoughtLayer',     key: '_halo',      max: 1.00 },
    { id: 'nodeLayer',        key: '_halo',      max: 1.00 },
    { id: 'proteinLayer',     key: '_halo',      max: 1.00 },
  ];

  function init() {
    GROUPS.forEach(g => {
      const el = document.getElementById(g.id);
      if (el) _nodes[g.id] = el;
    });
    // Ensure peelVisible has _halo flag (default off — no radial clutter)
    if (!window.BODY_STATE) window.BODY_STATE = {};
    if (!window.BODY_STATE.peelVisible) {
      window.BODY_STATE.peelVisible = {
        skin: true, muscle: false, skeleton: false,
        organs: true, circulatory: false, nervous: false,
      };
    }
    if (typeof window.BODY_STATE.peelVisible._halo === 'undefined') {
      window.BODY_STATE.peelVisible._halo = false;
    }
    _initialized = true;
    console.log('[INTERNAL_INTEGRATOR] consumed ' + Object.keys(_nodes).length + ' SVG group(s)');
  }

  function _targetOpacityFor(group, skinOpacity, peelVisible) {
    // Halo family: only on if explicitly enabled
    if (group.key === '_halo') {
      return peelVisible._halo ? group.max : 0;
    }
    // SVG skin overlay — faint decorative layer. Hide entirely; canvas skin
    // handles the real surface. Leaving it visible creates the translucent
    // "cobweb body" appearance we're killing.
    if (group.inverse) return 0;
    // Normal internal system: visible amount = (1 - skinOpacity) * (peel toggle on ? 1 : 0)
    const enabled = peelVisible[group.key] === true;
    if (!enabled) return 0;
    const revealed = 1 - Math.max(0, Math.min(1, skinOpacity));
    return group.max * revealed;
  }

  function draw(ts) {
    if (!_initialized) return;
    if (ts - _last < 50) return; // 20fps is fine — opacity changes are cheap but not free
    _last = ts;

    const bs = window.BODY_STATE || {};
    const pv = bs.peelVisible || {};
    // Treat "skin toggle off" as full peel — footer strip writes peelVisible.skin
    // but not skinPeelAmount, so we OR the two signals here.
    let skinOpacity = typeof bs.skinPeelAmount === 'number' ? bs.skinPeelAmount : 1.0;
    if (pv.skin === false) skinOpacity = 0;

    for (let i = 0; i < GROUPS.length; i++) {
      const g = GROUPS[i];
      const el = _nodes[g.id];
      if (!el) continue;
      const target = _targetOpacityFor(g, skinOpacity, pv);
      const rounded = Math.round(target * 1000) / 1000;
      const shouldHide = rounded <= 0.001;
      // Always enforce display each frame — other scripts (brain.js CNS
      // draw loop) rewrite opacity at 60fps; display:none trumps them
      // but we re-assert in case anything else toggles it.
      const wantDisplay = shouldHide ? 'none' : '';
      if (el.style.display !== wantDisplay) {
        el.style.display = wantDisplay;
      }
      const cur = parseFloat(el.getAttribute('data-vtn-op') || 'NaN');
      if (cur !== rounded) {
        el.setAttribute('opacity', rounded.toFixed(3));
        el.setAttribute('data-vtn-op', rounded.toFixed(3));
      }
    }
  }

  return { init, draw };
})();

// Bootstrap + register with RENDER_HUB
setTimeout(() => {
  INTERNAL_INTEGRATOR.init();
  if (window.RENDER_HUB && typeof window.RENDER_HUB.register === 'function') {
    // Priority 15 — runs before skin (20) so opacities settle first each frame.
    window.RENDER_HUB.register('internal_integrator', INTERNAL_INTEGRATOR.draw, 15);
  }
}, 450);

if (typeof window !== 'undefined') window.INTERNAL_INTEGRATOR = INTERNAL_INTEGRATOR;
