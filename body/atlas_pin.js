/* ═══════════════════════════════════════════════════════════════════════════
   VINTINUUM ATLAS PIN  —  body/atlas_pin.js
   ───────────────────────────────────────────────────────────────────────────
   Vinta directive 2026-09-13 (task ABWNYHB):

     "I need the latter page to be obtainable always on most of joy every page
      for users to go to since it has all use card cases for entire app"

   The "latter page" is index.html — the 40-card atlas of every surface in the
   app, grouped into eight zones (Core, Identity, Memory, Body, Inner Life,
   Last Things, Social, Oracle). Before this module it was reachable only by
   typing /index.html by hand, because the apex host router funnels the bare
   root to enter.html. That is why the app felt like it had no way back to its
   own map.

   This module puts ONE way home on EVERY page. It is deliberately the
   smallest possible surface: a single pin, top-centre, that says where it
   goes and goes there.

   ── WHY TOP-CENTRE (the collision reasoning, Law 1) ───────────────────────
   Measured occupancy of the fixed corners across the 61 root surfaces on
   2026-09-13:
     bottom-right — TAKEN. jarvis.html + brain.html mount the DirRM iframe and
                    the dirrm picker there at z-index 9998/9999, and brain.html
                    stacks two FABs at bottom:24px / bottom:90px.
     bottom-left  — TAKEN. brain.html #reproToggle (bottom:24px;left:66px) and
                    world.html #feed (left:16px;bottom:92px).
     top-left     — TAKEN on most surfaces by the back-link / brandmark.
     top-right    — contested by assorted status pills.
     TOP-CENTRE   — free. Only phone.html uses it, and only for a transient
                    toast that auto-dismisses.
   So top-centre is the one anchor that collides with nothing at rest. The pin
   is additionally given its own reserved band and a hard opt-out, so any page
   that later claims that strip can decline in one attribute.

   ── THE BOX MODEL ─────────────────────────────────────────────────────────
   The pin owns exactly one region and never leaves it:
     [ top: env(safe-area-inset-top) + 10px, height 34px, centred, max 74vw ]
   Nothing else in this module is positioned. It cannot overflow horizontally
   (max-width + ellipsis) and it cannot grow vertically (fixed height, single
   line, no wrap). Growth goes inward, never outward.

   ── OPT-OUT ───────────────────────────────────────────────────────────────
   A page suppresses the pin with either:
     <body data-atlas-pin="false">      (declarative, preferred)
     window.VINT_NO_ATLAS_PIN = true;   (set before this script runs)
   It is suppressed automatically on index.html itself (you are already home),
   and inside any iframe (the DirRM player must stay edge-to-edge — Law 2:
   THE PLAYER IS THE WINDOW; no chrome may be painted over it).

   Law 4 compliance: the pin carries data-draggable="true", so body/draggable.js
   makes it repositionable by mouse and touch wherever that module is loaded.
   Its own click handler is a real <a> navigation, and draggable.js is built so
   a drag never eats the click.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.VintAtlasPin) return;           // idempotent — never mount twice

  // ── Suppression gates, cheapest first ──────────────────────────────────
  if (window.VINT_NO_ATLAS_PIN === true) return;

  // Never paint chrome inside an embedded frame. The DirRM player is loaded
  // as an iframe on several surfaces and must remain edge-to-edge.
  try { if (window.self !== window.top) return; } catch (e) { return; }

  // Already home: index.html is the atlas itself.
  var file = (location.pathname.split('/').pop() || '').toLowerCase();
  if (file === '' || file === 'index.html') return;

  var LABEL = 'All of Vintinuum';
  var HREF  = 'index.html?home';   // ?home pins the atlas as this visitor's
                                   // landing page, so the apex funnel stops
                                   // firing for someone who has chosen the map.

  function mount() {
    if (document.getElementById('vintAtlasPin')) return;

    var body = document.body;
    if (!body) return;
    if (body.getAttribute('data-atlas-pin') === 'false') return;

    // ── Styles. Scoped to #vintAtlasPin only; no global selectors, so this
    //    can never restyle a host page's own elements. ────────────────────
    if (!document.getElementById('vintAtlasPinStyle')) {
      var st = document.createElement('style');
      st.id = 'vintAtlasPinStyle';
      st.textContent = [
        '#vintAtlasPin{',
          'position:fixed;',
          'top:calc(env(safe-area-inset-top, 0px) + 10px);',
          'left:50%;',
          'transform:translateX(-50%);',
          /* Sits above ordinary page chrome but deliberately BELOW the
             9998/9999 band the DirRM iframe and pickers use, so it can never
             cover a running player or an open picker. */
          'z-index:1200;',
          'display:inline-flex;',
          'align-items:center;',
          'gap:7px;',
          'height:34px;',
          'max-width:min(74vw, 340px);',
          'box-sizing:border-box;',
          'padding:0 14px;',
          'border-radius:999px;',
          'background:rgba(10,10,18,0.82);',
          '-webkit-backdrop-filter:blur(10px);',
          'backdrop-filter:blur(10px);',
          'border:1px solid rgba(244,199,154,0.28);',
          'color:rgba(245,235,220,0.92);',
          'font-family:"Space Grotesk",system-ui,-apple-system,sans-serif;',
          'font-size:clamp(0.72rem, 2.2vw, 0.82rem);',
          'font-weight:500;',
          'letter-spacing:0.02em;',
          'text-decoration:none;',
          'white-space:nowrap;',
          'overflow:hidden;',
          'text-overflow:ellipsis;',
          'cursor:pointer;',
          '-webkit-tap-highlight-color:transparent;',
          'transition:background .2s ease, border-color .2s ease, opacity .2s ease;',
          /* Law 3: visible with zero interaction. Never a JS-only reveal. */
          'opacity:1;',
        '}',
        '#vintAtlasPin:hover,#vintAtlasPin:focus-visible{',
          'background:rgba(18,16,28,0.92);',
          'border-color:rgba(244,199,154,0.55);',
          'outline:none;',
        '}',
        '#vintAtlasPin .vap-glyph{',
          'font-size:0.9em;line-height:1;color:rgba(244,199,154,0.95);flex:0 0 auto;',
        '}',
        '#vintAtlasPin .vap-label{overflow:hidden;text-overflow:ellipsis;}',
        /* Touch: the pin is a 44px-tall tap target even though the visible
           pill is 34px, via a transparent expansion. Law 3 minimum. */
        '@media (hover:none){',
          '#vintAtlasPin{height:38px;padding:0 16px;}',
        '}',
        /* Very narrow phones: shrink the wording, never let it wrap or
           collide with a page's own top-left back link. */
        '@media (max-width:400px){',
          '#vintAtlasPin{max-width:62vw;}',
        '}',
        '@media (prefers-reduced-motion:reduce){',
          '#vintAtlasPin{transition:none;}',
        '}',
        /* Print: chrome does not belong on paper. */
        '@media print{#vintAtlasPin{display:none;}}'
      ].join('');
      document.head.appendChild(st);
    }

    var a = document.createElement('a');
    a.id = 'vintAtlasPin';
    a.href = HREF;
    a.setAttribute('aria-label', 'Open the atlas — every surface in Vintinuum');
    a.setAttribute('title', 'Every surface in Vintinuum');
    a.setAttribute('data-draggable', 'true');   // Law 4
    a.innerHTML = '<span class="vap-glyph" aria-hidden="true">&#9673;</span>' +
                  '<span class="vap-label"></span>';
    a.querySelector('.vap-label').textContent = LABEL;

    body.appendChild(a);
    avoidTopStrip(a);
  }

  /* ── THE YIELD PASS (Law 1: reserve, don't overlay) ─────────────────────
     Top-centre is free on the large majority of surfaces, but not all:
     measured 2026-09-13, mortality.html mounts a full-width fixed .topbar
     (48px + safe-area) and world.html puts #editHeadBtn in the top-right,
     both of which the pin would otherwise sit on top of.

     Rather than hard-coding those two pages — which would silently break the
     next page that claims the strip — the pin MEASURES the band it wants and
     yields: if anything fixed/sticky and visible already occupies that band,
     the pin drops to just beneath the lowest such element. It reserves its
     own gutter instead of overlaying someone else's.

     If yielding would push it more than a third of the way down the viewport,
     the page clearly owns its top region entirely and the pin hides rather
     than float somewhere arbitrary. A page in that state should opt out
     explicitly with data-atlas-pin="false".                                */
  function avoidTopStrip(pin, depth) {
    depth = depth || 0;
    try {
      // Only the first pass resets to the authored anchor; recursive passes
      // must keep the position they just moved to, or the walk never advances.
      if (depth === 0) pin.style.top = 'calc(env(safe-area-inset-top, 0px) + 10px)';
      var pr = pin.getBoundingClientRect();
      var lowest = 0;
      var nodes = document.querySelectorAll('body *');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el === pin || pin.contains(el) || el.contains(pin)) continue;
        var s = getComputedStyle(el);
        if (s.position !== 'fixed' && s.position !== 'sticky') continue;
        if (s.display === 'none' || s.visibility === 'hidden') continue;
        if (parseFloat(s.opacity) < 0.05) continue;
        if (s.pointerEvents === 'none') continue;
        var r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        // Ignore full-viewport layers: backdrops, canvases and modal gates
        // legitimately span the whole screen and are handled by z-order,
        // not by displacement.
        if (r.height >= window.innerHeight * 0.85) continue;
        // Only things actually intersecting the pin's band matter.
        var overlaps = !(r.right <= pr.left || r.left >= pr.right ||
                         r.bottom <= pr.top || r.top >= pr.bottom);
        if (overlaps && r.bottom > lowest) lowest = r.bottom;
      }
      if (lowest > 0) {
        if (lowest > window.innerHeight / 3) {
          pin.style.display = 'none';   // page owns its top region
        } else {
          pin.style.top = Math.round(lowest + 8) + 'px';
          // ITERATE. Moving down can slide the pin into a SECOND occupant that
          // did not intersect the original band — measured on letters.html,
          // where the pin cleared a 48px topbar only to land on the mobile
          // strip at 48..65. Settling once is not settling. Re-measure until
          // the band is clean, with a hard cap so this can never spin.
          if (depth < 4) return avoidTopStrip(pin, depth + 1);
        }
      }
    } catch (e) { /* measurement is best-effort; the pin stays where authored */ }
  }

  function boot() {
    mount();
    // Re-measure once the page has settled (fonts, late chrome, async panels)
    // and whenever the viewport changes shape.
    setTimeout(function () {
      var p = document.getElementById('vintAtlasPin');
      if (p && p.style.display !== 'none') avoidTopStrip(p);
    }, 900);
  }

  var reflow;
  window.addEventListener('resize', function () {
    clearTimeout(reflow);
    reflow = setTimeout(function () {
      var p = document.getElementById('vintAtlasPin');
      if (p) { p.style.display = ''; avoidTopStrip(p); }
    }, 150);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.VintAtlasPin = { mount: mount, id: 'vintAtlasPin', reflow: avoidTopStrip };
})();
