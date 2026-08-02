/* corner_dock.js — THE CORNER ALLOCATOR (Vinta directive 2026-08-01).
   ────────────────────────────────────────────────────────────────────────────
   WHY THIS EXISTS

   Shell.Z solved z-index by centralizing it: components ask for a layer instead
   of hardcoding 99996. Position never got the same treatment. So every floating
   widget hardcoded its own right/bottom and hand-derived those numbers from a
   SNAPSHOT of its neighbours (read voice_button.js's comment block — it does the
   arithmetic by hand, in a comment, against three named siblings). The moment a
   neighbour resizes, moves, or a new widget lands, that arithmetic is silently
   stale and things overlap. That's exactly how the bottom-right corner ended up
   with hey_vinta's 56px orb (right:20 bottom:20) sitting on top of welcome-gate's
   pill (right:14 bottom:16) on 11 pages.

   THE FIX: nobody hardcodes a corner coordinate again. Widgets REGISTER with a
   corner and a priority; the dock MEASURES their real rendered size and stacks
   them with a fixed gutter. Collision stops being a thing you check for and
   becomes a thing that cannot happen — if a widget grows, its neighbours are
   re-flowed on the next frame. This is the NO-COLLISION LAW enforced in code
   rather than in comments.

   ZERO DEPENDENCIES. Loads on every page (carried by welcome-gate.js, the only
   script present on all 50 surfaces). Never assumes Shell exists.

   USAGE
     VintDock.register(el, { corner:'br', priority:10, id:'hey-vinta' });
     VintDock.release(el);                 // or el.remove() — auto-reaped
     VintDock.reflow();                    // force a re-layout

   CORNERS: 'br' | 'bl' | 'tr' | 'tl', plus the CENTER lanes 'bc' | 'tc'.
   Lower priority = closer to the corner.

   THE LIVE PRIORITY MAP — pick a FREE number, never reuse one on a corner a
   sibling can share a page with. Ties fall back to registration order, which is
   script-load order, which is not something you should ever depend on.

     br  10 #vint-chat-btn (brain only) / #hey-vinta-btn (everywhere else)
            └ these two never coexist: brain.html hides #hey-vinta-btn, and
              the dock skips display:none nodes, so the tie is inert BY DESIGN.
              Anything NEW on 'br' must not take 10.
         30 #carry-pill        40 #vwg-pill / #vwg-dot (account, outermost)
     bl   5 diag pill          10 #vintVoice   15 #micBtn   20 #vint-status-pill
     tr  10 #vtn-pill-right    20 consciousness btn        30 three3d mode btn
     tl  10 #vtn-pill-left
     bc  10 .brain-hint        (center lanes auto-clear BOTH flanking columns)
*/
(function (root) {
  'use strict';
  // Idempotent, but must NOT mistake welcome-gate's queuing stub for the real
  // thing — the stub also has .register(), and bailing on it left every page
  // with a dock that only ever queued and never laid anything out.
  if (root.VintDock && root.VintDock._slots) return;

  // Widgets may call VintDock.register() BEFORE this file finishes loading (it
  // is injected async by welcome-gate.js). They push onto VintDock.q instead;
  // we drain it below. This removes every per-widget retry loop.
  var queued = (root.VintDock && root.VintDock.q) || [];

  var EDGE = 16;      // distance from the viewport edge to the first slot
  var GUTTER = 12;    // space between stacked widgets — nothing ever touches

  // Reserved bands the dock must never stack into. The mobile bottom nav is a
  // full-width bar; anything docked bottom must clear it or it sits underneath.
  // Any FULL-WIDTH bar pinned to an edge (the mobile nav, world.html's #saybar,
  // a page's top shell) is a wall the button stack must sit clear of. Detected
  // structurally rather than by a hardcoded id list, so a new bar on any surface
  // is cleared automatically instead of being collided with.
  // edge: 'bottom' | 'top'
  function edgeReserved(edge) {
    var r = 0;
    try {
      var vw = root.innerWidth, vh = root.innerHeight;
      var all = document.querySelectorAll('body > *');
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        // A docked widget must never be mistaken for the wall it stands against —
        // that would feed its own height back into the offset each reflow.
        if (el.hasAttribute('data-vint-docked')) continue;
        var cs = getComputedStyle(el);
        if (cs.position !== 'fixed') continue;
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (parseFloat(cs.opacity) === 0) continue;
        var b = el.getBoundingClientRect();
        if (b.height <= 0 || b.height >= 200) continue;   // a bar, not a panel/page
        if (b.width < vw * 0.9) continue;                 // must span the width
        var pinned = (edge === 'bottom') ? Math.abs(b.bottom - vh) <= 2
                                         : Math.abs(b.top) <= 2;
        if (!pinned) continue;
        if (b.height > r) r = b.height;
      }
    } catch (_) {}
    return r;
  }

  var slots = [];     // { el, corner, priority, id }
  var avoids = [];    // { el, corner } — big panels the button stack must clear

  // A large panel (e.g. world.html's 320px head editor) owns the corner while
  // it's open. Rather than docking it into the button stack — wrong shape, and
  // it's draggable/full-width on mobile — we treat it as an obstacle: the
  // buttons start ABOVE it and slide back down the moment it closes.
  function avoidExtent(corner) {
    var isBottom = corner[0] === 'b';
    var max = 0;
    avoids = avoids.filter(function (a) { return a.el && a.el.isConnected; });
    avoids.forEach(function (a) {
      if (a.corner !== corner || !visible(a.el)) return;
      var r;
      try { r = a.el.getBoundingClientRect(); } catch (_) { return; }
      // Only obstruct if it actually sits in this corner's column.
      var ext = isBottom ? (root.innerHeight - r.top) : r.bottom;
      if (ext > max && ext < root.innerHeight) max = ext;
    });
    return max ? max + GUTTER : 0;
  }

  function safeInset(side) {
    // env() isn't readable from JS; probe it once via a throwaway element.
    try {
      var p = document.createElement('div');
      p.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;' +
        side + ':env(safe-area-inset-' + side + ',0px);width:0;height:0;';
      document.body.appendChild(p);
      var v = parseFloat(getComputedStyle(p)[side]) || 0;
      p.remove();
      return v;
    } catch (_) { return 0; }
  }

  var _insets = null;
  function insets() {
    if (!_insets) {
      _insets = { bottom: safeInset('bottom'), right: safeInset('right'), left: safeInset('left'), top: safeInset('top') };
    }
    return _insets;
  }

  // A button the user has DRAGGED (draggable.js persists vint:btnpos:<id>) owns
  // its own position — the dock must never yank it back. It also stops taking up
  // a slot, so its old neighbours close the gap instead of leaving a hole.
  function userPlaced(el) {
    try {
      if (!el.id) return false;
      return !!localStorage.getItem('vint:btnpos:' + el.id);
    } catch (_) { return false; }
  }

  function visible(el) {
    if (!el || !el.isConnected) return false;
    if (userPlaced(el)) return false;
    var cs;
    try { cs = getComputedStyle(el); } catch (_) { return false; }
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity) === 0) return false;
    return true;
  }

  // How far the two corner stacks on an edge ('b'|'t') extend inward from it.
  // Used to lift a CENTER-lane element clear of both flanking columns, since a
  // centred bar can grow wide enough (or a phone can be narrow enough) that
  // "centre" and "corner" are the same pixels.
  function columnHeight(edge) {
    var max = 0;
    slots.forEach(function (s) {
      if (s.corner[0] !== edge) return;
      if (s.corner[1] === 'c') return;              // other centre items don't count
      if (!visible(s.el)) return;
      var r;
      try { r = s.el.getBoundingClientRect(); } catch (_) { return; }
      if (!r.height) return;
      var ext = (edge === 'b') ? (root.innerHeight - r.top) : r.bottom;
      if (ext > max && ext < root.innerHeight) max = ext;
    });
    return max ? max + GUTTER : 0;
  }

  var raf = null;
  function reflow() {
    if (raf) return;                        // coalesce bursts into one frame
    raf = requestAnimationFrame(function () {
      raf = null;
      doReflow();
    });
  }

  function doReflow() {
    // Reap detached nodes so a removed widget frees its slot immediately.
    slots = slots.filter(function (s) { return s.el && s.el.isConnected; });

    var ins = insets();
    var reserveBottom = edgeReserved('bottom');
    var reserveTop    = edgeReserved('top');

    // 'bc'/'tc' are CENTER lanes: same vertical stacking, but the element keeps
    // its own horizontal centering. They're laid out after the corners so a
    // centered bar can be told how much room the corner stacks actually left it.
    ['br', 'bl', 'tr', 'tl', 'bc', 'tc'].forEach(function (corner) {
      var mine = slots
        .filter(function (s) { return s.corner === corner && visible(s.el); })
        .sort(function (a, b) { return a.priority - b.priority; });

      var isBottom = corner[0] === 'b';
      var isRight  = corner[1] === 'r';
      var isCenter = corner[1] === 'c';

      // Stack outward from the corner, measuring each element's REAL height,
      // starting clear of the mobile nav and any open corner panel.
      var offset = EDGE + (isBottom ? ins.bottom + reserveBottom : ins.top + reserveTop);
      offset = Math.max(offset, avoidExtent(corner));

      // A CENTER-lane element spans the middle, so it must clear BOTH corner
      // stacks on its edge — not just the reserved bars. Start it above the
      // tallest corner column so a centred bar can never sit in the same band as
      // the buttons flanking it (the .brain-hint × #micBtn overlap at 320px).
      if (isCenter) offset = Math.max(offset, columnHeight(corner[0]));

      mine.forEach(function (s) {
        var el = s.el;
        var h;
        try { h = el.getBoundingClientRect().height; } catch (_) { h = 0; }
        if (!h) h = 44;                     // sane default before first paint

        el.style.position = 'fixed';
        if (isBottom) { el.style.bottom = offset + 'px'; el.style.top = 'auto'; }
        else          { el.style.top    = offset + 'px'; el.style.bottom = 'auto'; }

        // The dock owns the STACKING AXIS (top/bottom). The cross axis is only
        // set when the widget hasn't authored its own — e.g. status_pill uses
        // left:var(--vint-fab-left) to clear the desktop sidebar, and stomping
        // that would push it back under the rail we just cleared. A center-lane
        // element always keeps its own horizontal placement (that's the point).
        if (!s.keepSide && !isCenter) {
          var side = EDGE + (isRight ? ins.right : ins.left);
          if (isRight) { el.style.right = side + 'px'; el.style.left = 'auto'; }
          else         { el.style.left  = side + 'px'; el.style.right = 'auto'; }
        }

        el.setAttribute('data-vint-docked', corner);
        offset += h + GUTTER;               // next widget clears this one entirely
      });
    });

    publishReach();
  }

  // A CENTERED element (brain.html's .brain-hint, a toast, any middle-of-the-edge
  // bar) can't be docked — it isn't in a corner stack — but it still has to stay
  // out of the buttons' way. Hardcoding "reserve 120px" is the same stale
  // arithmetic this file exists to delete, so instead we publish how far the
  // docked columns actually REACH inward, as a CSS variable. Centred content
  // reserves 2× that and is correct forever, including when a widget resizes,
  // appears, or is dragged away.
  //   --vint-dock-reach-bottom / --vint-dock-reach-top
  function publishReach() {
    try {
      var vw = root.innerWidth;
      var reach = { bottom: 0, top: 0 };
      slots.forEach(function (s) {
        if (!visible(s.el)) return;
        var r;
        try { r = s.el.getBoundingClientRect(); } catch (_) { return; }
        if (!r.width) return;
        // How far this widget intrudes from ITS OWN vertical edge.
        var in_ = (s.corner[1] === 'r') ? (vw - r.left) : r.right;
        var edge = (s.corner[0] === 'b') ? 'bottom' : 'top';
        if (in_ > reach[edge]) reach[edge] = in_;
      });
      var st = document.documentElement.style;
      st.setProperty('--vint-dock-reach-bottom', Math.round(reach.bottom) + 'px');
      st.setProperty('--vint-dock-reach-top', Math.round(reach.top) + 'px');
    } catch (_) {}
  }

  function register(el, opts) {
    if (!el) return;
    opts = opts || {};
    var id = opts.id || el.id || '';
    // Same element (or same id) registering twice must not create two slots.
    slots = slots.filter(function (s) {
      return s.el !== el && !(id && s.id === id);
    });
    slots.push({
      el: el,
      corner: opts.corner || 'br',
      priority: typeof opts.priority === 'number' ? opts.priority : 50,
      id: id,
      keepSide: !!opts.keepSide,   // widget authors its own left/right
    });
    // Observe size changes so a widget that expands pushes its neighbours away
    // instead of growing into them.
    try {
      if (root.ResizeObserver) {
        if (!register._ro) register._ro = new ResizeObserver(function () { reflow(); });
        register._ro.observe(el);
      }
    } catch (_) {}
    reflow();
  }

  function release(el) {
    slots = slots.filter(function (s) { return s.el !== el; });
    try { if (register._ro) register._ro.unobserve(el); } catch (_) {}
    reflow();
  }

  // Convenience for widget modules: identical to register(), and safe to call
  // no matter when the dock loaded relative to the caller.
  function claim(el, opts) { register(el, opts); }

  // Declare a panel as an obstacle the docked buttons must stack clear of.
  // (defined below `register`; see VintDock.claim for the load-order-safe entry)
  // A wide sheet (world.html's #invite: centered, up to 500px) reaches into BOTH
  // bottom corners on a phone, so it must be declarable as an obstacle for each.
  // Dedupe is therefore per (element, corner) — keying on the element alone made
  // the second avoid() silently delete the first, leaving one corner unprotected.
  function avoid(el, opts) {
    if (!el) return;
    opts = opts || {};
    var corner = opts.corner || 'br';
    avoids = avoids.filter(function (a) { return !(a.el === el && a.corner === corner); });
    avoids.push({ el: el, corner: corner });
    try {
      if (root.ResizeObserver) {
        if (!register._ro) register._ro = new ResizeObserver(function () { reflow(); });
        register._ro.observe(el);
      }
    } catch (_) {}
    reflow();
  }
  function unavoid(el) {
    avoids = avoids.filter(function (a) { return a.el !== el; });
    reflow();
  }

  root.VintDock = {
    register: register,
    release: release,
    claim: claim,
    avoid: avoid,
    unavoid: unavoid,
    reflow: reflow,
    EDGE: EDGE,
    GUTTER: GUTTER,
    _slots: function () { return slots.slice(); },
    _avoids: function () { return avoids.slice(); },
  };

  // Drain anything queued before this file landed.
  try {
    queued.forEach(function (c) {
      if (!c || !c[0]) return;
      if (c[0] === 'avoid') avoid(c[1], c[2]);
      else register(c[1], c[2]);
    });
  } catch (_) {}

  try {
    root.addEventListener('resize', function () { _insets = null; reflow(); });
    root.addEventListener('orientationchange', function () { _insets = null; reflow(); });
  } catch (_) {}

  // Late-mounting widgets (and any page that adds one after load) get picked up.
  try {
    if (root.MutationObserver && document.body) {
      new MutationObserver(function () { reflow(); })
        .observe(document.body, { childList: true, subtree: false });
    }
  } catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);
