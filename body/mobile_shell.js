// ═══════════════════════════════════════════════════════════════════════════
// MOBILE_SHELL — bottom-sheet drawer controls for left + right sidebars
//
// Problem solved: on phones the 3-column grid stacked everything and every
// button could touch its neighbour. This module injects two floating pill
// toggles (one per sidebar) that slide the sidebars up as bottom sheets,
// with a scrim behind, no overlap with any other UI element, and ≥44px
// tap targets. Desktop: pills are display:none (CSS owns that).
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function buildPill(side, label) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vtn-mobile-pill is-' + side;
    btn.textContent = label;
    btn.setAttribute('aria-label', 'open ' + side + ' panel');
    btn.setAttribute('aria-expanded', 'false');
    return btn;
  }

  function buildScrim() {
    const s = document.createElement('div');
    s.className = 'vtn-sheet-scrim';
    s.setAttribute('aria-hidden', 'true');
    return s;
  }

  function init() {
    const left  = document.querySelector('.vtn-sidebar-left');
    const right = document.querySelector('.vtn-sidebar-right');
    if (!left && !right) {
      // Shell not mounted yet — retry once
      setTimeout(init, 500);
      return;
    }

    // Don't double-mount
    if (document.querySelector('.vtn-mobile-pill')) return;

    const scrim = buildScrim();
    document.body.appendChild(scrim);

    const pillLeft  = buildPill('left',  'BODY');
    const pillRight = buildPill('right', 'MIND');
    document.body.appendChild(pillLeft);
    document.body.appendChild(pillRight);

    let openPanel = null; // 'left' | 'right' | null

    function emit(name, which) {
      try {
        document.dispatchEvent(new CustomEvent(name, { detail: { side: which } }));
      } catch (_) {}
    }

    function closeAll() {
      const was = openPanel;
      if (left)  left.classList.remove('is-open');
      if (right) right.classList.remove('is-open');
      scrim.classList.remove('is-open');
      pillLeft.setAttribute('aria-expanded', 'false');
      pillRight.setAttribute('aria-expanded', 'false');
      openPanel = null;
      document.body.style.overflow = '';
      if (was) emit('vtn:sheet-close', was);
    }

    function openSide(which) {
      // Ensure exclusivity — closing the other prevents overlap
      closeAll();
      const panel = which === 'left' ? left : right;
      if (!panel) return;
      panel.classList.add('is-open');
      scrim.classList.add('is-open');
      (which === 'left' ? pillLeft : pillRight).setAttribute('aria-expanded', 'true');
      openPanel = which;
      // Prevent background scroll while sheet is up (body still scrolls within)
      document.body.style.overflow = 'hidden';
      try { navigator.vibrate && navigator.vibrate(8); } catch (_) {}
      emit('vtn:sheet-open', which);
    }

    // ── Swipe-down-to-dismiss ──────────────────────────────────────────
    // Natural sheet physics: when the sheet is scrolled to its top, a
    // downward drag follows the finger; release past 90px (or a fast
    // flick) closes it, otherwise it springs back. Internal scroll wins
    // whenever the sheet isn't at scrollTop 0 — no gesture conflict.
    function wireSwipe(panel) {
      if (!panel) return;
      let startY = 0, lastY = 0, lastT = 0, vel = 0, tracking = false, pulled = false;
      panel.addEventListener('touchstart', (e) => {
        if (!panel.classList.contains('is-open')) return;
        tracking = panel.scrollTop <= 0;
        pulled = false;
        startY = lastY = e.touches[0].clientY;
        lastT = e.timeStamp;
        vel = 0;
      }, { passive: true });
      panel.addEventListener('touchmove', (e) => {
        if (!tracking) return;
        const y = e.touches[0].clientY;
        const dy = y - startY;
        const dt = Math.max(1, e.timeStamp - lastT);
        vel = (y - lastY) / dt; // px per ms, + is downward
        lastY = y; lastT = e.timeStamp;
        if (dy <= 0) {
          // Finger moved up — this is a scroll, not a dismiss
          if (!pulled) tracking = false;
          return;
        }
        pulled = true;
        panel.classList.add('is-swiping');
        panel.style.transform = 'translateY(' + dy + 'px)';
        if (e.cancelable) e.preventDefault();
      }, { passive: false });
      panel.addEventListener('touchend', () => {
        if (!tracking || !pulled) { tracking = false; return; }
        tracking = false;
        const dy = lastY - startY;
        panel.classList.remove('is-swiping');
        if (dy > 90 || vel > 0.55) {
          // Close from where the finger left it — keep the inline offset for
          // one frame so the exit glide starts at the release point.
          closeAll();
          requestAnimationFrame(() => { panel.style.transform = ''; });
        } else {
          panel.style.transform = ''; // spring back to fully open
        }
      }, { passive: true });
    }
    wireSwipe(left);
    wireSwipe(right);

    pillLeft.addEventListener('click', () => {
      if (openPanel === 'left') closeAll(); else openSide('left');
    });
    pillRight.addEventListener('click', () => {
      if (openPanel === 'right') closeAll(); else openSide('right');
    });
    scrim.addEventListener('click', closeAll);
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && openPanel) closeAll();
    });

    // If orientation/viewport grows past mobile breakpoint, force-reset so
    // desktop users never see stuck-open sheets.
    const mq = window.matchMedia('(max-width: 820px)');
    const handleMq = () => { if (!mq.matches) closeAll(); };
    if (mq.addEventListener) mq.addEventListener('change', handleMq);
    else if (mq.addListener) mq.addListener(handleMq);

    // Public API (additive) — other surfaces may drive the sheets
    // programmatically: VtnMobileShell.open('left'|'right'), .close(),
    // .isOpen() → 'left'|'right'|null. Events: vtn:sheet-open/-close.
    window.VtnMobileShell = {
      open: openSide,
      close: closeAll,
      isOpen: () => openPanel,
    };

    console.log('[MOBILE_SHELL] pills mounted — BODY / MIND drawers ready (swipe-to-dismiss armed)');
  }

  onReady(init);
})();
