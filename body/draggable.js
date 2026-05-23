/* ═══════════════════════════════════════════════════════════════════════════
   VINTINUUM DRAGGABLE  —  body/draggable.js
   ───────────────────────────────────────────────────────────────────────────
   Every button on every surface must be repositionable by mouse and touch.
   (Vinta directive 2026-05-08 — non-negotiable, no exceptions.)

   How it works:
   - Auto-applies to all [data-draggable="true"] elements
   - Also auto-applies to known FAB/pill selectors
   - Press-and-hold 250ms mouse / 350ms touch OR 6px/8px movement starts drag
   - Short tap/click still fires normally — drag does NOT eat clicks
   - Position clamped to viewport with 8px safe margin
   - Persisted to localStorage: vint:btnpos:<id>
   - Shift+double-click OR 1.2s long-press resets to authored default position
   - Visual: scale(1.05) + cursor:grabbing during drag
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.VintDraggable) return;

  const LS_PREFIX     = 'vint:btnpos:';
  const SAFE_MARGIN   = 8;
  const HOLD_MS_MOUSE = 250;
  const HOLD_MS_TOUCH = 350;
  const DRAG_PX_MOUSE = 6;
  const DRAG_PX_TOUCH = 8;
  const RESET_HOLD_MS = 1200;

  const AUTO_SELECTORS = [
    '[data-draggable="true"]',
    '.dock-cta',
    '.vint-fab',
    '.vint-pill-draggable',
    '#vint-chat-btn',
    '#voiceToggle',
    '.browser-relay-pill',
    '.relay-scheduler-pill',
  ].join(',');

  function savePos(id, x, y) {
    if (!id) return;
    try { localStorage.setItem(LS_PREFIX + id, JSON.stringify({ x, y })); } catch (_) {}
  }
  function loadPos(id) {
    if (!id) return null;
    try { var r = localStorage.getItem(LS_PREFIX + id); return r ? JSON.parse(r) : null; } catch (_) { return null; }
  }
  function clearPos(id) {
    if (!id) return;
    try { localStorage.removeItem(LS_PREFIX + id); } catch (_) {}
  }
  function clamp(x, y, w, h) {
    var vw = window.innerWidth, vh = window.innerHeight;
    return {
      x: Math.max(SAFE_MARGIN, Math.min(vw - w - SAFE_MARGIN, x)),
      y: Math.max(SAFE_MARGIN, Math.min(vh - h - SAFE_MARGIN, y)),
    };
  }
  function applyPos(el, x, y) {
    el.style.position = 'fixed';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
    el.style.right = '';
    el.style.bottom = '';
  }

  function makeDraggable(el) {
    if (el._vintDrag) return;
    el._vintDrag = true;
    el.style.userSelect = 'none';
    el.style.webkitUserSelect = 'none';
    el.style.touchAction = 'none';

    // Snapshot default authored pos before localStorage restore
    var rect0 = el.getBoundingClientRect();
    el._vintDefaultPos = { x: rect0.left, y: rect0.top };

    // Restore saved position
    var id = el.id || el.dataset.draggableId;
    var saved = id ? loadPos(id) : null;
    if (saved) {
      var rect = el.getBoundingClientRect();
      var c = clamp(saved.x, saved.y, rect.width || 48, rect.height || 48);
      applyPos(el, c.x, c.y);
    }

    var dragging = false, holdTimer = null, resetTimer = null;
    var startClient = { x: 0, y: 0 }, startElPos = { x: 0, y: 0 };

    function beginDrag(cx, cy) {
      dragging = true;
      var r = el.getBoundingClientRect();
      startElPos = { x: r.left, y: r.top };
      startClient = { x: cx, y: cy };
      el.style.transition = 'none';
      el.style.transform  = 'scale(1.05)';
      el.style.cursor     = 'grabbing';
      el.style.zIndex     = '999999';
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }
    function moveDrag(cx, cy) {
      if (!dragging) return;
      var dx = cx - startClient.x, dy = cy - startClient.y;
      var r  = el.getBoundingClientRect();
      var c  = clamp(startElPos.x + dx, startElPos.y + dy, r.width, r.height);
      applyPos(el, c.x, c.y);
    }
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      el.style.transform  = '';
      el.style.cursor     = '';
      el.style.zIndex     = '';
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      var r = el.getBoundingClientRect();
      var c = clamp(r.left, r.top, r.width, r.height);
      applyPos(el, c.x, c.y);
      savePos(id, c.x, c.y);
    }
    function resetPos() {
      clearPos(id);
      var d = el._vintDefaultPos || { x: 0, y: 0 };
      el.style.transition = 'left 0.3s ease, top 0.3s ease';
      applyPos(el, d.x, d.y);
      setTimeout(function () { el.style.transition = ''; }, 320);
    }

    // Mouse
    el.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      startClient = { x: e.clientX, y: e.clientY };
      holdTimer = setTimeout(function () { beginDrag(e.clientX, e.clientY); }, HOLD_MS_MOUSE);
    });
    document.addEventListener('mousemove', function (e) {
      if (holdTimer) {
        var d = Math.hypot(e.clientX - startClient.x, e.clientY - startClient.y);
        if (d >= DRAG_PX_MOUSE) { clearTimeout(holdTimer); holdTimer = null; beginDrag(e.clientX, e.clientY); }
      }
      moveDrag(e.clientX, e.clientY);
    });
    document.addEventListener('mouseup', function () { clearTimeout(holdTimer); holdTimer = null; endDrag(); });
    el.addEventListener('dblclick', function (e) { if (e.shiftKey) { e.preventDefault(); resetPos(); } });

    // Touch
    el.addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      startClient = { x: t.clientX, y: t.clientY };
      holdTimer   = setTimeout(function () { beginDrag(t.clientX, t.clientY); }, HOLD_MS_TOUCH);
      resetTimer  = setTimeout(function () { if (!dragging) resetPos(); }, RESET_HOLD_MS);
    }, { passive: true });
    el.addEventListener('touchmove', function (e) {
      var t = e.touches[0];
      if (holdTimer) {
        var d = Math.hypot(t.clientX - startClient.x, t.clientY - startClient.y);
        if (d >= DRAG_PX_TOUCH) { clearTimeout(holdTimer); holdTimer = null; beginDrag(t.clientX, t.clientY); }
      }
      if (dragging) { e.preventDefault(); moveDrag(t.clientX, t.clientY); }
    }, { passive: false });
    el.addEventListener('touchend', function (e) {
      clearTimeout(holdTimer); holdTimer = null;
      clearTimeout(resetTimer); resetTimer = null;
      if (dragging) { endDrag(); e.preventDefault(); }
    }, { passive: false });
  }

  function mountAll() {
    try { document.querySelectorAll(AUTO_SELECTORS).forEach(makeDraggable); } catch (_) {}
  }

  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        try {
          if (node.matches && node.matches(AUTO_SELECTORS)) makeDraggable(node);
          if (node.querySelectorAll) node.querySelectorAll(AUTO_SELECTORS).forEach(makeDraggable);
        } catch (_) {}
      });
    });
  });

  function init() {
    mountAll();
    observer.observe(document.body, { childList: true, subtree: true });
    console.log('[VintDraggable] mounted — all buttons repositionable');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.VintDraggable = { apply: makeDraggable };
})();
