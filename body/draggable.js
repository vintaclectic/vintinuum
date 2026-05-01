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

  // Default targets if author didn't tag anything explicitly.
  const DEFAULT_SELECTORS = [
    '[data-drag]',
    '.draggable',
    '.tile', '.card', '.panel', '.widget',
    '.feed-card', '.stat-card', '.module',
    '.sidebar-block', '.dock-item',
    'button.movable',
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

  const applyStored = (el) => {
    const k = idFor(el);
    const v = layout[k];
    if (v && typeof v.x === 'number' && typeof v.y === 'number') {
      el.style.transform = `translate3d(${v.x}px, ${v.y}px, 0)`;
      el.dataset.dragX = String(v.x);
      el.dataset.dragY = String(v.y);
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
      el.dataset.dragReady = '1';
      el.style.touchAction = 'none';        // ← THE CRITICAL FIX
      el.style.userSelect = 'none';
      el.style.webkitUserSelect = 'none';
      el.style.webkitTouchCallout = 'none';
      // Promote to its own layer so transform updates are cheap
      if (!el.style.willChange) el.style.willChange = 'transform';
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
    el.classList.add('vint-dragging');
    el.style.transition = 'transform 60ms ease-out, box-shadow 120ms ease-out';
    el.style.zIndex = String(Math.max(9999, parseInt(el.style.zIndex) || 0));
    el.style.boxShadow = '0 18px 42px rgba(0,0,0,.45), 0 4px 10px rgba(0,0,0,.3)';
    // Tiny haptic if available
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch {} }
  };

  const disarm = (st) => {
    if (!st || !st.el) return;
    const el = st.el;
    el.classList.remove('vint-dragging');
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
      // Persist
      const k = idFor(active.el);
      const x = parseFloat(active.el.dataset.dragX || '0') || 0;
      const y = parseFloat(active.el.dataset.dragY || '0') || 0;
      layout[k] = { x, y };
      saveLayout();
      disarm(active);
    }
    try { active.el.releasePointerCapture(e.pointerId); } catch {}
    active = null;
  };

  const onPointerCancel = (e) => {
    if (!active || e.pointerId !== active.pointerId) return;
    clearTimeout(active.holdTimer);
    if (active.armed) disarm(active);
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
    }
    [data-drag-ready="1"]:active { cursor: grabbing; }
    @media (hover: none) {
      [data-drag-ready="1"] { cursor: default; }
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
