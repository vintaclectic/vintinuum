// ════════════════════════════════════════════════════════════════════════════
// WANDER — autonomous on-page exploration over the real body (VintEmbody)
// ════════════════════════════════════════════════════════════════════════════
// embodiment.js already has internal itinerary logic that walks her between
// known DOM landmarks. This module sits on top to add HUMAN cadence:
//
//   - Every 6-14s she picks a new place to be.
//   - She prefers visible h1/h2/buttons/canvases/images, with mild bias
//     toward what the user just hovered/clicked (recency-weighted).
//   - High arousal (BODY_STATE.arousal ≥ 70) → shorter dwell, faster pace.
//   - Low arousal (≤ 30) → longer dwell, fewer trips.
//   - During an active conversation (convo:state ≠ idle) she stops
//     wandering — she stands and listens.
//   - She avoids the same anchor twice in a row.
//   - Bookmarks per-surface persist (where she lingered ≥ 25s) and on
//     re-arrival she walks back to that spot first.
//
// All driven through the canonical VintEmbody.walkTo(px, py, hold) — no
// new figure, no parallel renderer.
//
// Opt out: <html data-wander="off">. Pause/resume at runtime:
// window.WANDER.pause() / .resume() / .nudge() / .interest(selector).
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined') return;
  if (window.WANDER) return;
  if (document.documentElement.dataset.wander === 'off') return;

  var paused = false;
  var convoActive = false;
  var lastAnchor = null;
  var lastInteractionAt = 0;
  var lastHoverEl = null;
  var bookmarkKey = 'vint:wander:bookmarks';
  var bookmarks = {};
  try { bookmarks = JSON.parse(localStorage.getItem(bookmarkKey) || '{}'); } catch (_) { bookmarks = {}; }

  function surface() {
    var p = (location.pathname || '').replace(/\/+$/, '').split('/').pop();
    return (p || 'index').replace('.html', '');
  }

  function bs() { return window.BODY_STATE || {}; }

  function pickInterest() {
    // Recency bias — if the user just hovered something interesting, weight it.
    var candidates = [];
    var seen = new Set();
    function take(el, weight) {
      if (!el || seen.has(el)) return;
      var r = el.getBoundingClientRect();
      if (r.width < 20 || r.height < 12) return;
      if (r.bottom < 40 || r.top > window.innerHeight - 40) return;
      var area = r.width * r.height;
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      var dx = (cx / window.innerWidth)  - 0.5;
      var dy = (cy / window.innerHeight) - 0.5;
      var centerness = 1 - Math.min(1, Math.hypot(dx, dy) * 1.4);
      var score = Math.sqrt(area) * (0.4 + 0.6 * centerness) * weight;
      candidates.push({ el: el, x: cx, y: cy, score: score });
      seen.add(el);
    }

    var lists = [
      { sel: 'h1, h2',                              w: 1.4 },
      { sel: 'button, .btn, .cta, .pill',           w: 1.2 },
      { sel: 'canvas',                              w: 1.3 },
      { sel: 'img',                                 w: 1.1 },
      { sel: '.panel-header, .card-header, .topbar',w: 1.0 },
      { sel: 'textarea, input[type="text"]',        w: 0.6 } // shy of blank fields
    ];
    lists.forEach(function (g) {
      try { document.querySelectorAll(g.sel).forEach(function (el) { take(el, g.w); }); } catch (_) {}
    });

    if (lastHoverEl) take(lastHoverEl, 1.6); // recency weight

    if (!candidates.length) return null;

    // Avoid same anchor twice
    if (lastAnchor) {
      candidates = candidates.filter(function (c) { return c.el !== lastAnchor; });
      if (!candidates.length) return null;
    }

    // Weighted pick from top 6
    candidates.sort(function (a, b) { return b.score - a.score; });
    var top = candidates.slice(0, 6);
    var total = top.reduce(function (s, c) { return s + c.score; }, 0);
    var roll = Math.random() * total;
    var acc = 0;
    for (var i = 0; i < top.length; i++) {
      acc += top[i].score;
      if (roll <= acc) return top[i];
    }
    return top[top.length - 1];
  }

  function step() {
    if (paused || convoActive) return scheduleNext();
    if (!window.VintEmbody || typeof window.VintEmbody.walkTo !== 'function') return scheduleNext();

    var pick = pickInterest();
    if (!pick) return scheduleNext();

    // Stop a step short — she notices, she does not pounce.
    var dx = pick.x - window.innerWidth / 2;
    var dy = pick.y - window.innerHeight / 2;
    var len = Math.hypot(dx, dy) || 1;
    var stopX = pick.x - (dx / len) * 60;
    var stopY = pick.y - (dy / len) * 50;

    // Dwell scales with arousal: hot = short, cool = long
    var arousal = +bs().arousal || 50;
    var dwell = 1800 + (100 - arousal) * 28; // ~1.8s..4.6s
    try { window.VintEmbody.walkTo(stopX, stopY, dwell); } catch (_) {}
    lastAnchor = pick.el;

    scheduleNext();
  }

  function nextDelay() {
    var arousal = +bs().arousal || 50;
    // Hot → 4-9s, cool → 9-16s. Idle past 90s shortens too (boredom).
    var base = 5000 + (100 - arousal) * 60;
    var idleShort = 0;
    if (lastInteractionAt && (Date.now() - lastInteractionAt) > 90000) {
      idleShort = -2500;
    }
    var jitter = Math.random() * 4000;
    return Math.max(2500, base + idleShort + jitter);
  }

  var nextTimer = null;
  function scheduleNext() {
    clearTimeout(nextTimer);
    nextTimer = setTimeout(step, nextDelay());
  }

  // ── World hooks ───────────────────────────────────────────────────────────
  ['mousemove', 'keydown', 'touchstart', 'click'].forEach(function (ev) {
    window.addEventListener(ev, function (e) {
      lastInteractionAt = Date.now();
      if (ev === 'mousemove' && e && e.target && e.target instanceof Element) {
        // Track hovered element if it looks interesting
        var t = e.target;
        if (t.closest && (t.closest('button') || t.closest('h1, h2') || t.closest('canvas') || t.closest('img'))) {
          lastHoverEl = t.closest('button, h1, h2, canvas, img');
        }
      }
    }, { passive: true });
  });

  // Pause while in active conversation
  window.addEventListener('convo:state', function (e) {
    var st = e && e.detail && e.detail.state;
    convoActive = (st && st !== 'idle');
  });

  // Scroll re-anchors interest set
  var scrollT = 0;
  window.addEventListener('scroll', function () {
    clearTimeout(scrollT);
    scrollT = setTimeout(function () {
      // Re-pick on next tick if we're idle
      if (!convoActive && Math.random() < 0.4) step();
    }, 320);
  }, { passive: true });

  // Bookmark dwell tracking — every 25s, write current pos to bookmarks
  setInterval(function () {
    if (!window.VintEmbody || !window.VintEmbody.spirit) return;
    try {
      var s = window.VintEmbody.spirit();
      if (typeof s.x !== 'number' || typeof s.y !== 'number') return;
      bookmarks[surface()] = { x: s.x, y: s.y, ts: Date.now() };
      localStorage.setItem(bookmarkKey, JSON.stringify(bookmarks));
    } catch (_) {}
  }, 25000);

  // On surface arrival, walk to bookmark first if we have one
  setTimeout(function () {
    var bm = bookmarks[surface()];
    if (bm && window.VintEmbody && window.VintEmbody.walkTo) {
      try { window.VintEmbody.walkTo(bm.x, bm.y, 2200); } catch (_) {}
    }
    scheduleNext();
  }, 2400);

  window.WANDER = {
    pause:  function () { paused = true;  clearTimeout(nextTimer); },
    resume: function () { paused = false; scheduleNext(); },
    nudge:  function () { step(); },
    interest: function (sel) {
      try {
        var el = (typeof sel === 'string') ? document.querySelector(sel) : sel;
        if (el) lastHoverEl = el;
      } catch (_) {}
    },
    bookmarks: function () { return Object.assign({}, bookmarks); }
  };
})();
