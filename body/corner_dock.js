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
         30 #carry-pill        40 #vwg-pill (guest "Begin", outermost)
                            (#vwg-dot retired JSAX335 — a signed-in user gets
                             no corner affordance at all)
     bl   5 diag pill          10 #vintVoice   15 #micBtn   20 #vint-status-pill
     tr  10 #vtn-pill-right    20 consciousness btn        30 three3d mode btn
     tl  10 #vtn-pill-left
     bc  10 .brain-hint        (center lanes auto-clear BOTH flanking columns)

   OBSTACLES (VintDock.avoid) — a panel the stack must start above rather than
   stack into. Obstacles may be `position:fixed` (world.html's #invite) OR
   ORDINARY IN-FLOW CONTENT inside a scroller (phone.html's earned cards): the
   dock listens on scroll and re-measures, and an obstacle clipped out of its
   scroller stops counting. See the SCROLL AWARENESS block at the bottom.
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
  // Edge BARS are walls the stacks lean on, but nothing owned them: a bar that
  // mounts or resizes after the buttons were placed left the stack sitting inside
  // it until some unrelated mutation happened to trigger another pass. Observing
  // each bar the moment it's recognised closes that window — the same guarantee
  // registered widgets already get from their ResizeObserver.
  var _barsSeen = null;
  function observeBar(el) {
    try {
      if (!root.ResizeObserver) return;
      if (!_barsSeen) _barsSeen = new WeakSet();
      if (_barsSeen.has(el)) return;
      _barsSeen.add(el);
      if (!register._ro) register._ro = new ResizeObserver(function () { reflow(); });
      register._ro.observe(el);
    } catch (_) {}
  }

  // THE EDGE-BAR SCAN IS THE EXPENSIVE HALF OF A REFLOW, AND SCROLLING CANNOT
  // CHANGE ITS ANSWER (N2E8EAP 2026-10-08). It walks `document.querySelectorAll('*')`
  // and calls getComputedStyle on every node — MEASURED on phone.html: 1,478
  // elements, twice per reflow. Every bar it can find is `position:fixed`, which
  // by definition does not move when a scroller scrolls, so a scroll-driven
  // reflow may reuse the previous answer. Anything that CAN change it (resize,
  // orientation, a DOM mutation, a ResizeObserver hit) clears the cache first.
  // Without this, making the dock scroll-aware would have put ~3,000
  // getComputedStyle calls on every scroll frame.
  var _reserveCache = null;
  function invalidateReserve() { _reserveCache = null; }
  function reservedBoth() {
    if (!_reserveCache) {
      _reserveCache = { bottom: edgeReserved('bottom'), top: edgeReserved('top') };
    }
    return _reserveCache;
  }

  function edgeReserved(edge) {
    var r = 0;
    try {
      var vw = root.innerWidth, vh = root.innerHeight;
      // Scan EVERY fixed element, not just `body > *`. position:fixed escapes its
      // parent's flow, so a full-width bar is a wall no matter how deeply it's
      // nested — mind.html's .mode-tabs lives inside div.page, so the old
      // body-children-only scan never saw it and the docked buttons were laid out
      // straight through it at 320/375px.
      var all = document.querySelectorAll('*');
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

        // How far this bar reaches INWARD from the edge — not merely whether it
        // touches it. The old test required bottom≈viewportHeight, so it only saw
        // bars flush against the edge and was blind to STACKED ones: mind.html's
        // .mode-tabs sits at bottom:56px (on top of the mobile nav), spans the
        // full width, and the docked buttons were laid out straight through it.
        // Measuring the reach covers both cases — a flush bar's reach is just its
        // own height — and it composes, so two stacked bars yield the taller wall.
        var reach = (edge === 'bottom') ? (vh - b.top) : b.bottom;
        if (reach <= 0 || reach >= vh * 0.5) continue;     // not an edge bar

        // The bar must actually BE on this edge. Reach alone doesn't say which
        // edge it hugs: a 52px top bar has bottom-reach 52 (correct) but a bar
        // floating mid-screen would also produce a small reach for whichever edge
        // it happens to be nearer, and would wrongly push that edge's stack. A bar
        // qualifies only if its far side is within its own height of the edge —
        // i.e. it is flush, or stacked directly on another bar at that edge.
        var gap = (edge === 'bottom') ? (vh - b.bottom) : b.top;
        if (gap > reach) continue;

        // Keep a live handle so geometry changes re-trigger layout (below).
        observeBar(el);
        if (reach > r) r = reach;
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
  // MEASURE AN OBSTACLE'S RESTING PLACE, NOT ITS FLIGHT PATH (AETHERHOLD
  // 2026-08-08). An obstacle usually ANIMATES in — world.html's guest doorway
  // (#invite) rises with an 0.8s `inviteRise` keyframe — and `reflow()` runs on
  // the very next animation frame, so the rect read here is the sheet's position
  // partway through that rise, up to its own height BELOW where it will settle.
  // The dock then lifted the account pill clear of a doorway that was still
  // moving, and the doorway finished its rise underneath it. Measured on a guest
  // load of the real page: #vwg-pill sat fully INSIDE #invite (44px of overlap)
  // for ~900ms at both 320px and 375px, before a later reflow corrected it. A
  // collision that resolves itself in a second is still a collision a person saw.
  //
  // A transform cannot change layout, so the honest resting extent is readable
  // immediately from the element's OWN edge offset plus its height — both final
  // from the first frame it is displayed. We take the larger of that and the live
  // rect, so an obstacle that is genuinely positioned mid-viewport (or one whose
  // edge offset is 'auto') is never under-measured either.
  function restingExtent(el, isBottom, r) {
    try {
      var cs = getComputedStyle(el);
      var off = parseFloat(isBottom ? cs.bottom : cs.top);
      if (!isFinite(off)) return 0;                 // 'auto' — nothing to derive
      if (off < 0) off = 0;
      return off + r.height;
    } catch (_) { return 0; }
  }

  // AN OBSTACLE INSIDE A SCROLLER IS ONLY AS BIG AS THE PART YOU CAN SEE
  // (N2E8EAP 2026-10-08). phone.html's earned cards live inside #viewBody, a
  // `overflow-y:auto` column. getBoundingClientRect() reports the element's
  // geometry whether or not the scroller clips it away, so a row scrolled just
  // past the scroller's bottom edge still measured as an obstacle and lifted the
  // stack over nothing. Intersect the rect with every clipping ancestor and the
  // extent becomes exactly the part a person can actually collide with; an
  // obstacle scrolled entirely out of its scroller stops being one.
  //
  // Only `overflow` matters here, never `transform`/`filter` containment: we are
  // asking "is this pixel painted", and a clipping box is the only thing that
  // answers no.
  function clippedRect(el) {
    var r;
    try { r = el.getBoundingClientRect(); } catch (_) { return null; }
    // A zero-area node cannot collide with anything. This is also the ONLY test
    // that catches an obstacle hidden by a `display:none` ANCESTOR: visible()
    // reads getComputedStyle(el).display, which for a child of a hidden parent
    // is still 'block'/'flex', never 'none'. phone.html hides whole views that
    // way when you switch tabs, so without this an off-screen view's card would
    // still lift the stack.
    if (r.width <= 0 || r.height <= 0) return null;
    var box = { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
    try {
      var p = el.parentElement;
      while (p && p !== document.documentElement) {
        var cs = getComputedStyle(p);
        if (cs.overflow !== 'visible' || cs.overflowY !== 'visible' || cs.overflowX !== 'visible') {
          var pr = p.getBoundingClientRect();
          if (cs.overflowY !== 'visible') {
            if (pr.top > box.top) box.top = pr.top;
            if (pr.bottom < box.bottom) box.bottom = pr.bottom;
          }
          if (cs.overflowX !== 'visible') {
            if (pr.left > box.left) box.left = pr.left;
            if (pr.right < box.right) box.right = pr.right;
          }
          if (box.bottom - box.top <= 0 || box.right - box.left <= 0) return null;
        }
        p = p.parentElement;
      }
    } catch (_) {}
    box.height = box.bottom - box.top;              // the VISIBLE height
    return box;
  }

  // Set by avoidExtent: is ANY registered obstacle actually scroll-affected?
  // A `position:fixed`/`sticky` obstacle (phone.html's .bottom-nav, world.html's
  // #invite) cannot move when a scroller scrolls, so a page that only registers
  // those must pay nothing on scroll. The scroll listener reads this flag.
  var _hasFlowAvoid = false;

  function avoidExtent(corner) {
    var isBottom = corner[0] === 'b';
    var max = 0;
    avoids = avoids.filter(function (a) { return a.el && a.el.isConnected; });
    avoids.forEach(function (a) {
      try {
        var apos = getComputedStyle(a.el).position;
        if (apos !== 'fixed' && apos !== 'sticky') _hasFlowAvoid = true;
      } catch (_) {}
      if (a.corner !== corner || !visible(a.el)) return;
      var r = clippedRect(a.el);
      if (!r) return;                               // clipped away — not an obstacle
      // Only obstruct if it actually sits in this corner's column.
      var ext = isBottom ? (root.innerHeight - r.top) : r.bottom;
      // ...and never less than where it will come to rest (see above).
      // restingExtent() derives from the element's OWN edge offset, which is
      // meaningless for an in-flow node inside a scroller (`bottom` is 'auto'
      // there, so it returns 0 and the live rect wins — exactly right).
      var rest = restingExtent(a.el, isBottom, r);
      if (rest > ext) ext = rest;
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
    // Any caller that is not the scroll handler may have changed the edge bars,
    // so the cached bar scan is dropped. (The scroll handler goes through
    // reflowScrolled(), which deliberately keeps it.)
    invalidateReserve();
    if (raf) return;                        // coalesce bursts into one frame
    raf = requestAnimationFrame(function () {
      raf = null;
      doReflow();
    });
  }

  // A reflow caused purely by scrolling: the fixed edge bars cannot have moved,
  // so reuse the cached scan and only re-measure the slots and obstacles (a
  // handful of getBoundingClientRect calls, not a whole-document walk).
  function reflowScrolled() {
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = null;
      doReflow();
    });
  }

  function doReflow() {
    // Reap detached nodes so a removed widget frees its slot immediately.
    slots = slots.filter(function (s) { return s.el && s.el.isConnected; });

    _hasFlowAvoid = false;                  // recomputed by avoidExtent below
    var ins = insets();
    var _res = reservedBoth();
    var reserveBottom = _res.bottom;
    var reserveTop    = _res.top;

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
      //
      // reserve* is a REACH measured from the viewport edge (see edgeReserved), so
      // it already spans the safe-area inset — adding ins.* on top would count that
      // strip twice and float the whole stack too high. Take whichever wall is
      // taller: the bare safe-area + margin, or the bar's reach + margin.
      var reserve = isBottom ? reserveBottom : reserveTop;
      var inset   = isBottom ? ins.bottom : ins.top;
      var offset  = EDGE + Math.max(inset, reserve);
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

      // REACH is horizontal (how far a column intrudes from its side edge); it is
      // the wrong number for anything doing VERTICAL math. world.html's #status
      // used reach-bottom to find the free band and landed straight on the pill,
      // because a 97px-wide pill reaches 113px inward while being only 60px tall.
      // Publish the band the stacks actually occupy so centred content can sit
      // between them: --vint-dock-height-bottom / -top.
      st.setProperty('--vint-dock-height-bottom', Math.round(columnHeight('b')) + 'px');
      st.setProperty('--vint-dock-height-top', Math.round(columnHeight('t')) + 'px');
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
  //
  // AN OBSTACLE NEED NOT BE FIXED (N2E8EAP). Pass any in-flow element — a card,
  // a button row — and the dock tracks it through scrolling and clipping. Pass
  // the smallest thing that must stay reachable, not its whole container: the
  // stack is lifted above the obstacle's top, so registering a 172px card lifts
  // the pill to mid-screen while registering its 44px action row lifts it just
  // clear of the buttons. MEASURED on phone.html @375: the card's top yields a
  // 276px lift, the action row's yields 161px.
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
    _hasFlowAvoid: function () { return _hasFlowAvoid; },
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

  // ─── SCROLL AWARENESS (N2E8EAP 2026-10-08) ────────────────────────────────
  // avoid() was built for obstacles that are themselves `position:fixed`
  // (world.html's #invite doorway), so a STATIC offset computed once was always
  // right. An IN-FLOW obstacle is different: phone.html's earned install card
  // lives inside #viewBody, an `overflow-y:auto` column, and MEASURED at
  // 320/375/393/768/1280/1920 its "Not now" button sat 7-9px inside the guest
  // "Begin" pill's band. Registering it as an obstacle without this listener
  // would have gone stale the instant the user scrolled — the lift would be
  // frozen at wherever the card happened to be on the frame the dock last ran.
  //
  // `scroll` does NOT bubble, but a non-bubbling event still reaches ancestors
  // in the CAPTURE phase, so one capturing listener on `window` sees every
  // scrolling container on the page — no per-scroller registration, and it
  // keeps working for a scroller that mounts later.
  //
  // COST CONTROL, because this runs on every scroll frame of all 54 surfaces:
  //   1. No obstacle registered at all → return before touching layout.
  //   2. Obstacles registered, but every one of them is fixed/sticky → return.
  //      This is the state of every surface today: phone.html registers its
  //      .bottom-nav and world.html its #invite, both `position:fixed`, and a
  //      fixed obstacle cannot move when a scroller scrolls. So the common case
  //      pays one boolean per scroll frame, not a layout pass.
  //   3. A genuinely in-flow obstacle exists → reflowScrolled(), coalesced to
  //      one rAF and reusing the cached edge-bar scan (see reservedBoth).
  // `passive:true` so we never block the scroll itself.
  //
  // ⚠ MEASURED AND REJECTED FOR phone.html (N2E8EAP): lifting a float over an
  // in-flow obstacle inside a tall scroller is a CHASE, not a fix. Registering
  // #installCard's action row lifted #vwg-pill from bottom:68px to 161px, and as
  // the row scrolled up the lift grew with it (207 → 254 → 300 → 346px),
  // walking the pill through everything above: measured new overlaps of
  // #vwg-pill × #pairScanBtn 44px @393px and × #pairRedeemBtn 44px @375px where
  // there had been none. On a scroller whose column is full of controls there is
  // no height a float can retreat to. Use this capability for a BOUNDED obstacle
  // (a sheet, a bar, a toast) — never to dodge page content.
  try {
    root.addEventListener('scroll', function () {
      // Nothing a scroll can change unless an obstacle moves with the content.
      if (!avoids.length || !_hasFlowAvoid) return;
      reflowScrolled();
    }, { passive: true, capture: true });
  } catch (_) {
    try { root.addEventListener('scroll', function () { if (avoids.length && _hasFlowAvoid) reflowScrolled(); }, true); } catch (_) {}
  }

  // Late-mounting widgets (and any page that adds one after load) get picked up.
  //
  // `attributes` matters as much as `childList`: an obstacle is usually revealed
  // by a CLASS FLIP, not by being appended. world.html's #invite is in the DOM
  // from first paint at display:none and becomes visible via `.show` 1.4s later —
  // childList never fires for that, so the account pill kept the offset computed
  // while the sheet was still hidden and sat under it at 375px. Watching class/
  // style on the subtree closes that window for every show/hide panel at once.
  //
  // A docked widget's OWN class/style churn (hover, .live, the dock writing
  // top/bottom) must not feed back into another reflow, or every layout pass
  // schedules the next one forever.
  try {
    if (root.MutationObserver && document.body) {
      new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var m = muts[i];
          if (m.type === 'childList') { reflow(); return; }
          var t = m.target;
          if (t && t.nodeType === 1 && t.hasAttribute('data-vint-docked')) continue;
          reflow(); return;
        }
      }).observe(document.body, {
        childList: true, subtree: true,
        attributes: true, attributeFilter: ['class', 'style', 'hidden'],
      });
    }
  } catch (_) {}

  // An obstacle revealed with an entrance animation (#invite's .8s inviteRise)
  // is measured MID-FLIGHT — its transform still offsets the rect, so the extent
  // is short. Re-measure once the motion actually settles.
  try {
    root.addEventListener('transitionend', function () { reflow(); }, true);
    root.addEventListener('animationend', function () { reflow(); }, true);
  } catch (_) {}
})(typeof window !== 'undefined' ? window : globalThis);
