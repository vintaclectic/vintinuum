/* draggable.js — universal drag/drop layer for Vintinuum UI
   ────────────────────────────────────────────────────────────
   Every element with [data-drag] (or matching one of the
   default selectors) becomes draggable on touch + mouse.

   Built 2026-04-30 per Vinta directive: "every single button
   able to be moved at will — drag drop click drop on phone
   mobile … needs to always be working."

   Behavior:
     • Long-press 350ms (touch) OR alt+click+hold (mouse) on
       any draggable element → enters drag.
     • While dragging: element follows finger/cursor with a
       lifted-card visual (slight scale + shadow + opacity).
     • Drop: element commits to current position (translate3d
       relative to its initial layout box).
     • Position persists per-page in localStorage under key
       `vint:layout:<pathname>:<elementId>`.
     • Double-tap an element to reset *that one* tile.
     • Long-press an empty area of the page → resets ALL.
     • Works alongside normal taps/clicks — drag activation
       requires hold time, so quick taps never engage.

   Core fix: touch-action:none on draggable nodes prevents
   the browser from hijacking the pointer into pinch/scroll
   (which is what was "stretching the background bubble").
   ──────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.__vintDraggableLoaded) return;
  window.__vintDraggableLoaded = true;

  const HOLD_MS = 350;        // long-press threshold
  const MOVE_TOL = 8;         // px of movement before activation cancels (you were tapping/scrolling)
  const DOUBLE_TAP_MS = 300;  // window for double-tap reset
  const STORAGE_KEY = 'vint:layout:' + (location.pathname || '/');
  const EDGE_MARGIN = 40;     // px of element that must remain on-screen after release

  // Monotonically increasing z-index for newly-grabbed tiles, so the most-recent
  // grab is always on top without us ever resetting other tiles back down.
  let topZ = 9999;

  // Default targets if author didn't tag anything explicitly.
  // Vinta directive 2026-05-08: "all buttons please … now mandatory able to
  // be moved by mouse click drag." Every <button>, <a class="*-btn">,
  // input[type=button], and the floating pills/CTAs ship draggable by
  // default. Opt out individually with data-drag-skip="1".
  const DEFAULT_SELECTORS = [
    '[data-drag]',
    '.draggable',
    '.tile', '.card', '.panel', '.widget',
    '.feed-card', '.stat-card', '.module',
    '.sidebar-block', '.dock-item',
    // Universal button coverage
    'button',
    'a[role="button"]',
    'input[type="button"]',
    'input[type="submit"]',
    // Known floating affordances that aren't <button>
    '#carry-pill',
    '.fab', '.pill', '.cta', '.dock-cta', '.float-btn',
  ];

  // Containers whose DIRECT-CHILD layout strip cannot be torn apart by
  // dragging individual tabs out of order. We still allow buttons inside
  // these containers to be draggable EXCEPT when the button is a direct
  // tab-row child (a tab in a tablist, a list-row in a chem-list, etc.).
  // For everything else (buttons inside forms, modals, popovers), drag is
  // allowed. Vinta directive: every button moveable. Period.
  //
  // The skip-rule is now: "only skip if my immediate parent matches one
  // of these AND the parent is acting as a positional row." That keeps
  // the chem-bar / layer-grid / tab-strip rows intact while letting
  // every form-submit, modal-cta, popover-action, etc. drag freely.
  const STRUCTURAL_TAB_PARENTS = [
    '.vtn-tabs',
    '.vtn-chem-list',
    '.vtn-layer-grid',
    '.vtn-legend-list',
    '[role="tablist"]',
    '[role="menu"]',
    '[role="listbox"]',
  ];

  // ── Stored layout ────────────────────────────────────────
  let layout = {};
  try { layout = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { layout = {}; }
  const saveLayout = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch {}
  };

  // Stable ID for an element so we can persist across reloads.
  const idFor = (el) => {
    if (el.id) return '#' + el.id;
    if (el.dataset.dragId) return 'd:' + el.dataset.dragId;
    // Fallback: positional path (best-effort, can shift if DOM mutates)
    let p = [], n = el;
    while (n && n !== document.body && p.length < 8) {
      const par = n.parentElement;
      if (!par) break;
      p.unshift([...par.children].indexOf(n));
      n = par;
    }
    return 'p:' + p.join('.') + ':' + (el.tagName || 'X');
  };

  // Given an element + a desired translate (x,y), return a clamped (x,y) such
  // that at least EDGE_MARGIN px of the element's visible rect stays inside
  // the viewport on all four sides. Math: the element currently sits at some
  // baseRect when translated by (curX,curY). The base (un-translated) rect is
  // baseRect shifted by (-curX,-curY). After applying (x,y), the rect would be
  // at baseRect + (x-curX, y-curY). We clamp that target rect into the viewport
  // with EDGE_MARGIN slack on each side, then back out the new (x,y).
  const clampToViewport = (el, x, y) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return { x, y };
    const curX = parseFloat(el.dataset.dragX || '0') || 0;
    const curY = parseFloat(el.dataset.dragY || '0') || 0;
    // Where would the rect's top-left land if we applied (x,y) instead of (curX,curY)?
    const targetLeft = r.left + (x - curX);
    const targetTop  = r.top  + (y - curY);
    const vw = window.innerWidth  || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    // Allowable range for the rect's top-left so EDGE_MARGIN stays visible.
    //   right edge ≥ EDGE_MARGIN          → targetLeft + r.width  ≥ EDGE_MARGIN
    //                                       → targetLeft ≥ EDGE_MARGIN - r.width
    //   left edge  ≤ vw - EDGE_MARGIN     → targetLeft ≤ vw - EDGE_MARGIN
    const minLeft = EDGE_MARGIN - r.width;
    const maxLeft = vw - EDGE_MARGIN;
    const minTop  = EDGE_MARGIN - r.height;
    const maxTop  = vh - EDGE_MARGIN;
    const clampedLeft = Math.max(minLeft, Math.min(maxLeft, targetLeft));
    const clampedTop  = Math.max(minTop,  Math.min(maxTop,  targetTop));
    return {
      x: x + (clampedLeft - targetLeft),
      y: y + (clampedTop  - targetTop),
    };
  };

  // ── Collision avoidance ──────────────────────────────────
  // No-overflow rule (Vinta directive 2026-05-08): a dropped button must
  // not sit on top of another fixed UI element (sidebar, dock, header,
  // another floating pill). On release we test the rect against a curated
  // list of "occupied zones" and nudge the button out by the shortest
  // axis if it overlaps.
  const OCCUPIED_SELECTORS = [
    '.vtn-sidebar-left',
    '.vtn-sidebar-right',
    '.vtn-footer',
    '#footerDock',
    '.bond-door',
    '.modal-frame',
    '#topbar',
    '.vtn-topbar',
    '#topShell',        // topbar.js header — hey-vinta / other floats must not land here
    '#peelDrawer',
  ];
  const rectOverlaps = (a, b) =>
    a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const snapAwayFromOccupied = (el, x, y) => {
    // Bail if user held a modifier — explicit override
    if (el.dataset.dragForce === '1') return { x, y };
    const r0 = el.getBoundingClientRect();
    if (!r0.width || !r0.height) return { x, y };
    // Project where the rect would land
    const curX = parseFloat(el.dataset.dragX || '0') || 0;
    const curY = parseFloat(el.dataset.dragY || '0') || 0;
    const projected = {
      left:   r0.left   + (x - curX),
      top:    r0.top    + (y - curY),
      right:  r0.right  + (x - curX),
      bottom: r0.bottom + (y - curY),
    };
    let nudgeX = 0, nudgeY = 0;
    document.querySelectorAll(OCCUPIED_SELECTORS.join(',')).forEach((zone) => {
      // Don't push a button OUT of its own ancestor (modal/sidebar/dock).
      // The button "lives" in that container and is allowed to occupy it.
      // Only push it away from FOREIGN occupied zones.
      if (zone === el || zone.contains(el) || el.contains(zone)) return;
      const z = zone.getBoundingClientRect();
      if (!z.width || !z.height) return;
      if (!rectOverlaps(projected, z)) return;
      // Compute minimum push to clear the overlap on the dominant axis.
      const pushLeft  = z.left  - projected.right;   // negative = how far left to push
      const pushRight = z.right - projected.left;    // positive = how far right to push
      const pushUp    = z.top   - projected.bottom;
      const pushDown  = z.bottom - projected.top;
      // Choose the axis with the smaller absolute push
      const optionsX = [pushLeft, pushRight];
      const optionsY = [pushUp, pushDown];
      const bestX = optionsX.reduce((a, b) => Math.abs(a) < Math.abs(b) ? a : b);
      const bestY = optionsY.reduce((a, b) => Math.abs(a) < Math.abs(b) ? a : b);
      if (Math.abs(bestX) < Math.abs(bestY)) {
        nudgeX += bestX;
        projected.left += bestX; projected.right += bestX;
      } else {
        nudgeY += bestY;
        projected.top += bestY; projected.bottom += bestY;
      }
    });
    return { x: x + nudgeX, y: y + nudgeY };
  };

  const applyStored = (el) => {
    const k = idFor(el);
    const v = layout[k];
    if (v && typeof v.x === 'number' && typeof v.y === 'number') {
      // First apply, then re-clamp in case the viewport shrank since save.
      el.style.transform = `translate3d(${v.x}px, ${v.y}px, 0)`;
      el.dataset.dragX = String(v.x);
      el.dataset.dragY = String(v.y);
      // Defer clamp by a frame so layout has settled and getBoundingClientRect is honest.
      requestAnimationFrame(() => {
        const c = clampToViewport(el, v.x, v.y);
        if (c.x !== v.x || c.y !== v.y) {
          el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;
          el.dataset.dragX = String(c.x);
          el.dataset.dragY = String(c.y);
          layout[k] = { x: c.x, y: c.y };
          saveLayout();
        }
      });
    }
  };

  // ── Auto-separate stacked fixed-position buttons ─────────
  // When two fixed-position buttons authored to the same corner overlap
  // (e.g. #micBtn and #voiceToggle both at bottom-left), nudge the
  // newcomer along the dominant clear axis until it doesn't overlap
  // any other fixed-position draggable. Result is committed via
  // translate3d so the user's drag system can still relocate it later.
  const separateFixedSiblings = (el) => {
    if (!el || !el.isConnected) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    // Find peers: other fixed-position draggables (not ancestors/descendants)
    const peers = [...document.querySelectorAll('[data-drag-ready="1"]')].filter(p => {
      if (p === el || p.contains(el) || el.contains(p)) return false;
      const cs = window.getComputedStyle(p);
      return cs.position === 'fixed';
    });
    let dx = 0, dy = 0;
    let projected = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    let safety = 8; // max iterations to avoid pathological loops
    let collided = true;
    while (collided && safety-- > 0) {
      collided = false;
      for (const p of peers) {
        const z = p.getBoundingClientRect();
        if (!z.width || !z.height) continue;
        if (!rectOverlaps(projected, z)) continue;
        // Push along the smaller-overlap axis (cheaper movement)
        const overlapX = Math.min(projected.right - z.left, z.right - projected.left);
        const overlapY = Math.min(projected.bottom - z.top, z.bottom - projected.top);
        const gap = 8;
        if (overlapX < overlapY) {
          // horizontal push — pick whichever side is closer to clear
          const pushRight = z.right - projected.left + gap;
          const pushLeft  = -(projected.right - z.left + gap);
          const push = Math.abs(pushLeft) < Math.abs(pushRight) ? pushLeft : pushRight;
          dx += push;
          projected.left += push; projected.right += push;
        } else {
          const pushDown = z.bottom - projected.top + gap;
          const pushUp   = -(projected.bottom - z.top + gap);
          const push = Math.abs(pushUp) < Math.abs(pushDown) ? pushUp : pushDown;
          dy += push;
          projected.top += push; projected.bottom += push;
        }
        collided = true;
      }
    }
    if (dx !== 0 || dy !== 0) {
      const c = clampToViewport(el, dx, dy);
      el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;
      el.dataset.dragX = String(c.x);
      el.dataset.dragY = String(c.y);
      const k = idFor(el);
      layout[k] = { x: c.x, y: c.y };
      saveLayout();
    }
  };

  // ── Mark every matching node as draggable ────────────────
  const markDraggable = (root) => {
    const nodes = (root || document).querySelectorAll(DEFAULT_SELECTORS.join(','));
    nodes.forEach((el) => {
      if (el.dataset.dragReady === '1') return;
      // Skip elements explicitly opted out
      if (el.dataset.dragSkip === '1') return;
      // Skip elements inside no-drag containers
      if (el.closest('[data-drag-container="false"]')) return;
      // Skip ONLY when the element is a direct-row child of a tab strip
      // (tabs / chem rows / layer grid cells / list rows). Buttons inside
      // forms, modals, popovers — i.e. NOT direct children of a tablist
      // row — are still draggable. Vinta directive: every button moveable.
      if (STRUCTURAL_TAB_PARENTS.some(sel => {
        const par = el.parentElement;
        return par && par !== el && par.matches && par.matches(sel);
      })) return;
      // Skip the close X / submit-on-form / icon-only chrome buttons that
      // explicitly opt out via data-drag-skip on their parent.
      if (el.closest('[data-no-drag="1"]')) return;
      el.dataset.dragReady = '1';
      el.style.touchAction = 'none';        // ← THE CRITICAL FIX
      el.style.userSelect = 'none';
      el.style.webkitUserSelect = 'none';
      el.style.webkitTouchCallout = 'none';
      // Promote to its own layer so transform updates are cheap
      if (!el.style.willChange) el.style.willChange = 'transform';
      // ── FIXED-POSITION SIBLING SEPARATION ────────────────────
      // Buttons authored at the same (left, bottom) — like #micBtn and
      // #voiceToggle stacking at bottom-left — overlap visually on load.
      // After the layer settles, if this button overlaps another fixed
      // button, nudge it horizontally until clear. Only fires when no
      // saved position exists (saved layout wins).
      const cs = window.getComputedStyle(el);
      if (cs.position === 'fixed' && !layout[idFor(el)]) {
        requestAnimationFrame(() => separateFixedSiblings(el));
      }
      // Hide grip-hint on tiles too small for it to read cleanly.
      // Measured lazily — if tile not in layout yet, retry next frame.
      const sizeCheck = () => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) {
          requestAnimationFrame(sizeCheck);
          return;
        }
        if (r.width < 60 || r.height < 60) el.dataset.dragHint = 'off';
      };
      requestAnimationFrame(sizeCheck);
      applyStored(el);
    });
  };

  // ── Active drag state ────────────────────────────────────
  let active = null;
  // {
  //   el, pointerId, startX, startY,
  //   originX, originY,            // current translate at drag start
  //   downAt, holdTimer,
  //   armed (bool),                // long-press fired
  //   moved (bool),
  //   lastTapAt                    // for double-tap reset
  // }

  const lastTapByEl = new WeakMap();

  const arm = (st) => {
    st.armed = true;
    const el = st.el;
    el.classList.remove('vint-prearm');
    el.classList.add('vint-dragging');
    el.style.transition = 'transform 60ms ease-out, box-shadow 120ms ease-out';
    el.style.zIndex = String(++topZ);
    el.style.boxShadow = '0 18px 42px rgba(0,0,0,.45), 0 4px 10px rgba(0,0,0,.3)';
    // Tiny haptic if available
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch {} }
  };

  const disarm = (st) => {
    if (!st || !st.el) return;
    const el = st.el;
    el.classList.remove('vint-dragging');
    el.classList.remove('vint-prearm');
    el.style.boxShadow = '';
    // Keep the transform; release transition so future drags are crisp.
    setTimeout(() => { if (el && el.style) el.style.transition = ''; }, 80);
  };

  const onPointerDown = (e) => {
    const el = e.target.closest(DEFAULT_SELECTORS.join(','));
    if (!el || el.dataset.dragSkip === '1') {
      // Empty-area long-press → reset all
      scheduleEmptyHold(e);
      return;
    }
    if (!el.dataset.dragReady) markDraggable(el.parentElement || document);
    if (!el.dataset.dragReady) return;

    // Double-tap detection (per element)
    const now = performance.now();
    const last = lastTapByEl.get(el) || 0;
    if (now - last < DOUBLE_TAP_MS) {
      // Reset this tile
      const k = idFor(el);
      delete layout[k];
      saveLayout();
      el.style.transition = 'transform 220ms cubic-bezier(.2,.8,.2,1)';
      el.style.transform = '';
      el.dataset.dragX = '0';
      el.dataset.dragY = '0';
      if (navigator.vibrate) { try { navigator.vibrate([8, 40, 8]); } catch {} }
      lastTapByEl.set(el, 0);
      return;
    }
    lastTapByEl.set(el, now);

    const x0 = parseFloat(el.dataset.dragX || '0') || 0;
    const y0 = parseFloat(el.dataset.dragY || '0') || 0;

    active = {
      el,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: x0,
      originY: y0,
      downAt: now,
      armed: false,
      moved: false,
      holdTimer: setTimeout(() => {
        if (active && active.el === el && !active.moved) arm(active);
      }, HOLD_MS),
    };

    // Light up the grip-hint immediately on touch — visual confirmation
    // that this surface is grippable. arm() will swap it to the dragging
    // state at HOLD_MS; if the user moves before then, we clear it.
    el.classList.add('vint-prearm');

    // Capture so the pointer keeps reporting even if it leaves the element
    try { el.setPointerCapture(e.pointerId); } catch {}
  };

  const onPointerMove = (e) => {
    if (!active || e.pointerId !== active.pointerId) return;
    const dx = e.clientX - active.startX;
    const dy = e.clientY - active.startY;

    if (!active.armed) {
      // Pre-arm: if user moves too far before hold completes, cancel arm
      if (Math.abs(dx) > MOVE_TOL || Math.abs(dy) > MOVE_TOL) {
        active.moved = true;
        clearTimeout(active.holdTimer);
        if (active.el) active.el.classList.remove('vint-prearm');
        // Don't engage — let the underlying scroll/click happen
        active = null;
      }
      return;
    }

    // Armed: actively dragging
    e.preventDefault();
    const nx = active.originX + dx;
    const ny = active.originY + dy;
    active.el.style.transform = `translate3d(${nx}px, ${ny}px, 0)`;
    active.el.dataset.dragX = String(nx);
    active.el.dataset.dragY = String(ny);
  };

  const onPointerUp = (e) => {
    if (!active || e.pointerId !== active.pointerId) return;
    clearTimeout(active.holdTimer);
    if (active.armed) {
      // On release: clamp to viewport, then snap away from any occupied
      // sibling zone (sidebars, dock, header, modal). Feels rubbery if
      // done mid-drag, so we only enforce on drop.
      const k = idFor(active.el);
      const rawX = parseFloat(active.el.dataset.dragX || '0') || 0;
      const rawY = parseFloat(active.el.dataset.dragY || '0') || 0;
      const c = clampToViewport(active.el, rawX, rawY);
      const s = snapAwayFromOccupied(active.el, c.x, c.y);
      // Re-clamp after the nudge in case snap pushed the rect off-screen
      const f = clampToViewport(active.el, s.x, s.y);
      const x = f.x, y = f.y;
      if (x !== rawX || y !== rawY) {
        // Glide back into safe zone
        active.el.style.transition = 'transform 180ms cubic-bezier(.2,.8,.2,1)';
        active.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        active.el.dataset.dragX = String(x);
        active.el.dataset.dragY = String(y);
      }
      layout[k] = { x, y };
      saveLayout();
      disarm(active);
    } else if (active.el) {
      // Tap released before arm fired — drop the pre-arm hint glow.
      active.el.classList.remove('vint-prearm');
    }
    try { active.el.releasePointerCapture(e.pointerId); } catch {}
    active = null;
  };

  const onPointerCancel = (e) => {
    if (!active || e.pointerId !== active.pointerId) return;
    clearTimeout(active.holdTimer);
    if (active.armed) disarm(active);
    else if (active.el) active.el.classList.remove('vint-prearm');
    active = null;
  };

  // ── Empty-area long-press → reset all ────────────────────
  let emptyHold = null;
  const scheduleEmptyHold = (e) => {
    clearTimeout(emptyHold);
    const sx = e.clientX, sy = e.clientY, pid = e.pointerId;
    emptyHold = setTimeout(() => {
      // Only fire if the pointer is still down roughly here
      if (!emptyHoldAlive) return;
      // Reset all
      layout = {};
      saveLayout();
      document.querySelectorAll('[data-drag-ready="1"]').forEach((el) => {
        el.style.transition = 'transform 260ms cubic-bezier(.2,.8,.2,1)';
        el.style.transform = '';
        el.dataset.dragX = '0';
        el.dataset.dragY = '0';
        setTimeout(() => { el.style.transition = ''; }, 320);
      });
      if (navigator.vibrate) { try { navigator.vibrate([14, 60, 14, 60, 14]); } catch {} }
    }, 900); // longer than per-tile so it's deliberate
  };
  let emptyHoldAlive = false;
  document.addEventListener('pointerdown', (e) => { emptyHoldAlive = true; }, true);
  document.addEventListener('pointerup', () => { emptyHoldAlive = false; clearTimeout(emptyHold); }, true);
  document.addEventListener('pointercancel', () => { emptyHoldAlive = false; clearTimeout(emptyHold); }, true);
  document.addEventListener('pointermove', (e) => {
    // Cancel empty-hold if the pointer wandered (it's a scroll, not a hold)
    if (emptyHoldAlive) clearTimeout(emptyHold);
  }, true);

  // ── Wire global listeners ────────────────────────────────
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointermove', onPointerMove, true);
  document.addEventListener('pointerup', onPointerUp, true);
  document.addEventListener('pointercancel', onPointerCancel, true);

  // ── Inject visual styles ─────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .vint-dragging {
      cursor: grabbing !important;
      transform-origin: 50% 50%;
      filter: brightness(1.05);
    }
    [data-drag-ready="1"] {
      cursor: grab;
      position: relative;
    }
    [data-drag-ready="1"]:active { cursor: grabbing; }
    @media (hover: none) {
      [data-drag-ready="1"] { cursor: default; }
    }

    /* ── Grip-hint: subtle 2x3 dot grid in the top-right corner ──
       Resting:  8% opacity — just enough to register as grippable.
       Hover (desktop) / pre-arm (touch): pulses to 60%.
       Active drag: 100%, with a soft halo so it reads as the anchor.
       currentColor inheritance lets it tint to whatever the tile's
       text color is — works on dark and light surfaces alike. */
    [data-drag-ready="1"]::after {
      content: "";
      position: absolute;
      top: 8px;
      right: 8px;
      width: 10px;
      height: 14px;
      pointer-events: none;
      background-image:
        radial-gradient(circle, currentColor 1px, transparent 1.4px),
        radial-gradient(circle, currentColor 1px, transparent 1.4px),
        radial-gradient(circle, currentColor 1px, transparent 1.4px),
        radial-gradient(circle, currentColor 1px, transparent 1.4px),
        radial-gradient(circle, currentColor 1px, transparent 1.4px),
        radial-gradient(circle, currentColor 1px, transparent 1.4px);
      background-size: 4px 4px;
      background-repeat: no-repeat;
      background-position:
        0 0,    6px 0,
        0 5px,  6px 5px,
        0 10px, 6px 10px;
      opacity: 0.08;
      transition: opacity 180ms ease-out, transform 180ms ease-out, filter 180ms ease-out;
      transform-origin: 100% 0;
      z-index: 1;
    }
    /* Hide hint on opted-out tiles + tiles we measured as too small. */
    [data-drag-skip="1"]::after,
    [data-drag-hint="off"]::after { display: none; }

    @media (hover: hover) {
      [data-drag-ready="1"]:hover::after {
        opacity: 0.6;
        transform: scale(1.08);
      }
    }
    /* Pre-arm: pointer is down but the 350ms hold hasn't fired.
       Same level as hover so touch users get the same visual. */
    [data-drag-ready="1"].vint-prearm::after {
      opacity: 0.6;
      transform: scale(1.08);
    }
    /* Active drag: the grip becomes the anchor — full visibility,
       slight scale-up, soft white halo for contrast on any surface. */
    [data-drag-ready="1"].vint-dragging::after {
      opacity: 1;
      transform: scale(1.15);
      filter: drop-shadow(0 0 3px rgba(255,255,255,.55));
    }
    @media (prefers-reduced-motion: reduce) {
      [data-drag-ready="1"]::after {
        transition: opacity 1ms;
        transform: none !important;
      }
    }
  `;
  document.head.appendChild(style);

  // ── Initial pass + observe DOM for newly inserted nodes ─
  const init = () => {
    markDraggable(document);
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType === 1) markDraggable(n);
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // ── Public API ───────────────────────────────────────────
  window.VintDraggable = {
    refresh: () => markDraggable(document),
    resetAll: () => {
      layout = {};
      saveLayout();
      document.querySelectorAll('[data-drag-ready="1"]').forEach((el) => {
        el.style.transform = '';
        el.dataset.dragX = '0';
        el.dataset.dragY = '0';
      });
    },
    reset: (el) => {
      if (typeof el === 'string') el = document.querySelector(el);
      if (!el) return;
      const k = idFor(el);
      delete layout[k];
      saveLayout();
      el.style.transform = '';
      el.dataset.dragX = '0';
      el.dataset.dragY = '0';
    },
    layout: () => ({ ...layout }),
  };
})();
