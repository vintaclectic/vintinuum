'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   ENTROPY SWEEP — reaps orphaned visual ephemera. (Lord Vinta 2026-07-08)

   THE LEAK: brain.js has ~77 spawn sites using the fire-and-forget pattern
   `layer.appendChild(el); setTimeout(() => el.remove(), 600–2000)`. Browsers
   throttle and DROP background-tab setTimeout callbacks; every dropped timer
   orphans its element in #lightLayer permanently. Over an hours-open tab the
   orphans compound into the "blood spotted molely" figure — dense purple
   bokeh (MENTAL_TIME_TRAVEL / SEMANTIC_WEB), over-woven yellow webs, face
   mole-dots (SOURCE_MONITORING), stuck red streaks (BIFURCATION_POINT).

   THE SWEEP: rather than hand-editing 77 sites, reconcile at the layer.
   A MutationObserver stamps every new child's birth and every attribute
   touch. Legit ephemera die in <3s via their own timers; pooled/singleton
   elements (hormone particles, aura shells, CORONARY_FLOW-style reusables)
   are animated continuously, so their attributes are freshly "touched".
   Anything OLD and UNTOUCHED is an orphan — reap it.

   SAFETY RAILS:
   • Elements with a non-empty id are NEVER reaped (singleton reuse pattern).
   • Elements marked data-vtn-keep are NEVER reaped.
   • Reap requires BOTH age > ORPHAN_AGE_MS AND no attribute touch within
     TOUCH_FRESH_MS — a still-animating element is alive by definition.
   • Hard ceiling: if the layer ever exceeds HARD_CAP children, oldest
     unprotected elements are reaped down to SOFT_CAP regardless of touch,
     so no failure mode can compound unbounded.
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  const LAYER_IDS = ['lightLayer', 'ringLayer'];
  const SWEEP_EVERY_MS = 45 * 1000;
  const ORPHAN_AGE_MS = 90 * 1000;   // legit ephemera live <3s; 90s old = orphan
  const TOUCH_FRESH_MS = 30 * 1000;  // attribute-touched within 30s = still alive
  const HARD_CAP = 800;              // absolute ceiling per layer
  const SOFT_CAP = 400;              // reap down to this when ceiling is hit

  const BORN = new WeakMap();
  const TOUCHED = new WeakMap();

  function watch(layer) {
    // stamp existing children as born now (unknown age — give them a cycle)
    const now = Date.now();
    for (const el of layer.children) BORN.set(el, now);

    new MutationObserver((muts) => {
      const t = Date.now();
      for (const m of muts) {
        if (m.type === 'childList') {
          for (const el of m.addedNodes) if (el.nodeType === 1) BORN.set(el, t);
        } else if (m.type === 'attributes' && m.target !== layer) {
          // attribute churn happens on the element or its wrapper child —
          // credit the direct child of the layer that contains it
          let el = m.target;
          while (el && el.parentNode !== layer) el = el.parentNode;
          if (el) TOUCHED.set(el, t);
        }
      }
    }).observe(layer, { childList: true, attributes: true, subtree: true });
  }

  function protectedEl(el) {
    return (el.id && el.id.length > 0) || el.hasAttribute('data-vtn-keep');
  }

  function sweep() {
    const now = Date.now();
    for (const id of LAYER_IDS) {
      const layer = document.getElementById(id);
      if (!layer) continue;
      let reaped = 0;

      // pass 1: orphan reap — old AND untouched AND unprotected
      for (const el of Array.from(layer.children)) {
        if (protectedEl(el)) continue;
        const born = BORN.get(el) || 0;
        const touched = TOUCHED.get(el) || 0;
        if (born && now - born > ORPHAN_AGE_MS && now - touched > TOUCH_FRESH_MS) {
          el.remove(); reaped++;
        }
      }

      // pass 2: hard ceiling — oldest unprotected first, down to SOFT_CAP
      if (layer.childElementCount > HARD_CAP) {
        const kids = Array.from(layer.children)
          .filter((el) => !protectedEl(el))
          .sort((a, b) => (BORN.get(a) || 0) - (BORN.get(b) || 0));
        const excess = layer.childElementCount - SOFT_CAP;
        for (let i = 0; i < excess && i < kids.length; i++) { kids[i].remove(); reaped++; }
      }

      if (reaped > 0) {
        try { console.log('[entropy-sweep] reaped ' + reaped + ' orphaned effect element(s) from #' + id); } catch (_) {}
      }
    }
  }

  function init() {
    let any = false;
    for (const id of LAYER_IDS) {
      const layer = document.getElementById(id);
      if (layer) { watch(layer); any = true; }
    }
    if (!any) return; // not a page with effect layers
    setInterval(sweep, SWEEP_EVERY_MS);
    // extra sweep the moment the tab returns to visibility — reap the
    // background-throttling backlog before the user sees it
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') setTimeout(sweep, 800);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
