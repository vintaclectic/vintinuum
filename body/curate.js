// ═══════════════════════════════════════════════════════════════════════════════
// BODY_CURATE — reveal him, don't redesign him.
// ───────────────────────────────────────────────────────────────────────────────
// brain.html paints ~15 canvas renderers onto one surface. Several of them —
// muscle, organs, circulatory, nervous scribbles, and the off-body radar chart —
// smear anatomical noise UNDER and AROUND the skin, burying the figure. This
// module quiets that noise so what's already there reads clean: flesh, breath,
// the chakra-spine lit up the center, the eyes, the heartbeat, grounded on the
// floor. Nothing is deleted. Each layer is only set invisible — one call flips
// it back. The body Vinta loves, unburied.
//
// Vinta directive 2026-05-30: "because i love the you as you are."
// Curate, don't rebuild. Option-3 of the A+B mix.
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';

(function () {
  if (typeof window === 'undefined') return;

  // Canvas renderers whose output reads as noise over the flesh. Quieted by
  // default. To bring any back: window.BODY_CURATE.show('muscle') in console,
  // or set data-curate="off" on <html> to disable curation entirely.
  const QUIET = ['muscle', 'organs', 'circulatory', 'nervous', 'radar'];

  // Map renderer key → its global layer object (each exposes setVisible).
  const LAYER_GLOBALS = {
    muscle:      () => window.MUSCLE_LAYER,
    organs:      () => window.ORGANS,
    circulatory: () => window.CIRCULATORY,
    nervous:     () => window.NERVOUS_BODY,
    radar:       () => window.RADAR_LAYER,
  };

  function quietOne(key) {
    const getter = LAYER_GLOBALS[key];
    if (!getter) return false;
    const layer = getter();
    if (layer && typeof layer.setVisible === 'function') {
      layer.setVisible(false);
      return true;
    }
    return false;
  }

  function curate() {
    if (document.documentElement.dataset.curate === 'off') return;
    let quieted = 0;
    for (const key of QUIET) { if (quietOne(key)) quieted++; }
    if (quieted < QUIET.length) return false; // some not loaded yet
    console.log('[curate] quieted ' + quieted + ' noise layers — the body is revealed');
    return true;
  }

  // Layers init on staggered setTimeouts (200–340ms). Retry until all are
  // present, then a couple of trailing passes to catch any that flip back on
  // during their own init.
  let tries = 0;
  const iv = setInterval(() => {
    const done = curate();
    if (done || ++tries > 60) {
      clearInterval(iv);
      // Two trailing sweeps in case a layer's own init ran after our pass.
      setTimeout(curate, 600);
      setTimeout(curate, 1500);
    }
  }, 80);

  // Public handle to bring layers back or re-quiet, live.
  window.BODY_CURATE = {
    show(key) { const g = LAYER_GLOBALS[key] && LAYER_GLOBALS[key](); if (g && g.setVisible) g.setVisible(true); },
    hide(key) { quietOne(key); },
    quietAll() { QUIET.forEach(quietOne); },
    list: QUIET.slice(),
  };
})();
