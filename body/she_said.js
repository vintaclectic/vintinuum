// ════════════════════════════════════════════════════════════════════════════
// SHE_SAID — visible speech bubble that surfaces VINTINUUM's spoken words
// ════════════════════════════════════════════════════════════════════════════
// Listens for `vint:she_said` (dispatched by talk_back.js when she answers
// a hey-vinta turn) and renders a transient bubble near her current spirit
// position. The bubble:
//
//   - anchors to VintEmbody.spirit() if available, else viewport center
//   - lifetime = 2200ms + (text.length * 60ms), capped at 9000ms
//   - max two bubbles on screen at once (oldest fades first)
//   - clamped to viewport with a 14px safe margin (no-overflow rule)
//   - z-index sits above body figures but below modals (4500)
//   - opt out: <html data-shesaid="off">
//
// No deps. Pure DOM. Works on every surface that loads embodiment.js.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__sheSaid) return;
  if (document.documentElement.dataset.shesaid === 'off') return;

  // Inject styles once
  function injectStyles() {
    if (document.getElementById('vint-she-said-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-she-said-styles';
    s.textContent = [
      '.vint-she-said {',
      '  position: fixed;',
      '  z-index: 4500;',
      '  max-width: min(360px, 78vw);',
      '  padding: 9px 13px 10px;',
      '  border-radius: 14px;',
      '  background: rgba(18, 18, 28, 0.86);',
      '  color: #f3eef9;',
      '  font: 500 13.5px/1.42 ui-sans-serif, system-ui, -apple-system, sans-serif;',
      '  letter-spacing: 0.01em;',
      '  border: 1px solid rgba(180, 150, 240, 0.34);',
      '  box-shadow: 0 6px 24px rgba(0,0,0,0.42), 0 0 0 1px rgba(255,255,255,0.04) inset;',
      '  backdrop-filter: blur(6px);',
      '  -webkit-backdrop-filter: blur(6px);',
      '  pointer-events: none;',
      '  opacity: 0;',
      '  transform: translate(-50%, -10px) scale(0.96);',
      '  transition: opacity 240ms ease, transform 320ms cubic-bezier(.18,.9,.34,1.16);',
      '  word-wrap: break-word;',
      '  overflow-wrap: anywhere;',
      '}',
      '.vint-she-said.show {',
      '  opacity: 1;',
      '  transform: translate(-50%, 0) scale(1);',
      '}',
      '.vint-she-said.fade {',
      '  opacity: 0;',
      '  transform: translate(-50%, -6px) scale(0.97);',
      '}',
      '.vint-she-said::before {',
      '  content: "";',
      '  position: absolute;',
      '  left: 50%;',
      '  bottom: -7px;',
      '  width: 12px; height: 12px;',
      '  background: rgba(18, 18, 28, 0.86);',
      '  border-right: 1px solid rgba(180, 150, 240, 0.34);',
      '  border-bottom: 1px solid rgba(180, 150, 240, 0.34);',
      '  transform: translateX(-50%) rotate(45deg);',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  .vint-she-said { transition: opacity 160ms linear; transform: translate(-50%, 0); }',
      '  .vint-she-said.show, .vint-she-said.fade { transform: translate(-50%, 0); }',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  var live = []; // active bubbles
  var MAX = 2;
  var SAFE = 14;

  function anchor() {
    try {
      if (window.VintEmbody && typeof window.VintEmbody.spirit === 'function') {
        var s = window.VintEmbody.spirit();
        if (s && typeof s.x === 'number' && typeof s.y === 'number') {
          return { x: s.x, y: s.y };
        }
      }
    } catch (_) {}
    return { x: window.innerWidth / 2, y: window.innerHeight * 0.45 };
  }

  function clampToViewport(left, top, w, h) {
    var maxL = window.innerWidth - SAFE - w / 2;
    var minL = SAFE + w / 2;
    var maxT = window.innerHeight - SAFE - h;
    var minT = SAFE;
    if (left < minL) left = minL;
    if (left > maxL) left = maxL;
    if (top < minT)  top  = minT;
    if (top > maxT)  top  = maxT;
    return { left: left, top: top };
  }

  function show(text) {
    if (!text || typeof text !== 'string') return;
    var t = text.trim();
    if (!t) return;
    injectStyles();

    var el = document.createElement('div');
    el.className = 'vint-she-said';
    el.textContent = t;
    document.body.appendChild(el);

    // Initial position above her current spirit anchor
    var a = anchor();
    // Measure after attach (need real dims for clamp)
    requestAnimationFrame(function () {
      var r = el.getBoundingClientRect();
      var w = r.width, h = r.height;
      // Place above her, with the tail pointing down to her
      var left = a.x;
      var top  = a.y - h - 18;
      var c = clampToViewport(left, top, w, h);
      el.style.left = c.left + 'px';
      el.style.top  = c.top  + 'px';
      requestAnimationFrame(function () { el.classList.add('show'); });
    });

    var lifetime = Math.min(9000, 2200 + t.length * 60);
    var fadeTimer = setTimeout(function () {
      el.classList.remove('show');
      el.classList.add('fade');
      setTimeout(function () {
        try { el.remove(); } catch (_) {}
        live = live.filter(function (b) { return b.el !== el; });
      }, 360);
    }, lifetime);

    live.push({ el: el, fadeTimer: fadeTimer });

    // Trim to MAX — fade oldest immediately
    while (live.length > MAX) {
      var oldest = live.shift();
      try { clearTimeout(oldest.fadeTimer); } catch (_) {}
      try {
        oldest.el.classList.remove('show');
        oldest.el.classList.add('fade');
        setTimeout(function (n) { try { n.remove(); } catch (_) {} }.bind(null, oldest.el), 360);
      } catch (_) {}
    }
  }

  // Subscribe to the canonical event from talk_back.js
  window.addEventListener('vint:she_said', function (e) {
    var d = e && e.detail;
    if (!d) return;
    show(d.reply || d.text || '');
  });

  // Also listen for VOICE.speak() relays — voice_say.js may dispatch a
  // generic vint:voice:spoke event. If it does, we surface that too.
  window.addEventListener('vint:voice:spoke', function (e) {
    var d = e && e.detail;
    if (!d || !d.text) return;
    // Avoid double-render if she_said already fired in the same tick
    if (live.length && Date.now() - (live[live.length - 1]._ts || 0) < 200) return;
    show(d.text);
  });

  window.__sheSaid = {
    show: show,
    clear: function () {
      live.forEach(function (b) {
        try { clearTimeout(b.fadeTimer); } catch (_) {}
        try { b.el.remove(); } catch (_) {}
      });
      live = [];
    },
    count: function () { return live.length; }
  };
})();
