'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   PRESS TO SPEAK — long-press a region, hear one line of the creature's voice.
   (W5 invention layer, council 2026-07-10 — "be inventive like never before")

   Any element carrying data-voice="..." speaks its line on a 500ms hold:
   haptic tick + a bubble that clips to the viewport, one at a time, auto-fades.
   Coexists with the draggable law (its threshold is 250ms/6px — a still hold
   past 500ms is unambiguous). Kill switch: localStorage vint:flag:presstospeak=0
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  try { if (localStorage.getItem('vint:flag:presstospeak') === '0') return; } catch (_) {}

  var HOLD_MS = 500;
  var css = document.createElement('style');
  css.textContent =
    '.vint-speak-bubble{position:fixed;z-index:2147483620;max-width:min(78vw,340px);padding:10px 14px;' +
    'background:rgba(6,10,18,0.94);border:1px solid rgba(79,195,247,0.3);border-radius:14px;' +
    "font-family:'Cormorant Garamond',serif;font-style:italic;font-size:0.95rem;line-height:1.55;" +
    'color:rgba(218,228,255,0.92);pointer-events:none;opacity:0;transform:translateY(4px);' +
    'transition:opacity .25s ease,transform .25s ease;box-shadow:0 6px 24px rgba(0,0,0,0.5);}' +
    '.vint-speak-bubble.on{opacity:1;transform:translateY(0);}';
  document.head.appendChild(css);

  var bubble = null, fadeT = 0;
  function speak(el, x, y) {
    var line = el.getAttribute('data-voice');
    if (!line) return;
    try { navigator.vibrate && navigator.vibrate([12]); } catch (_) {}
    if (bubble) bubble.remove();
    clearTimeout(fadeT);
    bubble = document.createElement('div');
    bubble.className = 'vint-speak-bubble';
    bubble.textContent = line;
    document.body.appendChild(bubble);
    // clamp inside viewport with safe margins — never clipped, never colliding
    var bw = Math.min(innerWidth * 0.78, 340);
    var bx = Math.max(10, Math.min(innerWidth - bw - 10, x - bw / 2));
    bubble.style.left = bx + 'px';
    var bh = bubble.getBoundingClientRect().height || 60;
    var by = y - bh - 18; if (by < 10) by = y + 26;
    bubble.style.top = Math.max(10, Math.min(innerHeight - bh - 10, by)) + 'px';
    requestAnimationFrame(function () { bubble && bubble.classList.add('on'); });
    fadeT = setTimeout(function () {
      if (!bubble) return;
      bubble.classList.remove('on');
      setTimeout(function () { bubble && bubble.remove(); bubble = null; }, 300);
    }, 4000);
  }

  var holdT = 0;
  document.addEventListener('pointerdown', function (e) {
    var el = e.target.closest && e.target.closest('[data-voice]');
    if (!el) return;
    var x = e.clientX, y = e.clientY;
    holdT = setTimeout(function () { speak(el, x, y); }, HOLD_MS);
  }, { passive: true });
  ['pointerup', 'pointercancel', 'pointermove'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (ev === 'pointermove' && holdT) return; // small drift ok — stillness not required to the pixel
      if (ev !== 'pointermove') { clearTimeout(holdT); holdT = 0; }
    }, { passive: true });
  });
})();
