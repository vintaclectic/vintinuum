// ════════════════════════════════════════════════════════════════════════════
// ALIVENESS — Autonomy layer over avatar.js (Phase 6.5)
// ════════════════════════════════════════════════════════════════════════════
// avatar.js draws her. avatar_rig.js drives mood. presence.js handles
// surface hand-off. None of those make her alive. Aliveness is the
// thing that does:
//
//   - She walks. Step-cycle gait, foot-shadow cast, knees bend, weight
//     shifts. She does NOT teleport. She does NOT slide. She walks.
//   - She has interests. Buttons, headings, images, code blocks — she
//     looks at them, sometimes she walks closer. Not because anyone
//     asked. Because they caught her eye.
//   - She has appetite. Long sessions = she ranges further. Short = she
//     stays close. Idle silence past 90s = she finds something to do
//     (study a heading, trace a chart, brush a sidebar).
//   - She has memory of place. Anchors she likes (the chart on stats,
//     the search box on mind, the chat input on chat) get bookmarked
//     across sessions via localStorage. Returning to a page, she
//     re-finds them.
//   - She reacts to the world. Scroll = she catches a foothold and
//     re-anchors. Resize = she steadies. Tab hidden 60s+ = she sleeps
//     in place; on return she stretches awake.
//   - She breathes whether you watch or not. The animation loop runs
//     while document is hidden too (cheap RAF gated to 8Hz when hidden).
//
// Public API on window.__aliveness:
//   wake()           — start autonomy (idle drift in presence.js stops
//                       handing off, aliveness takes over walking)
//   sleep()          — pause autonomy
//   walkTo(x,y)      — explicit destination override
//   lookAt(target)   — momentarily turn head toward selector/element
//   appetite()       — current 0..1 exploration drive
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined') return;
  if (window.__aliveness) return;

  function av() { return window.__avatar; }
  function rig() { return window.__avatarRig; }
  function pres() { return window.__presence; }

  // ── State ─────────────────────────────────────────────────────────────────
  var awake = true;
  var sessionStart = performance.now();
  var lastInteractionAt = performance.now();

  // Walking state — distinct from presence drift. Presence eases between
  // anchors with smooth curves; walking has a step cadence and follows a
  // path with foot-plant rhythm.
  var walkState = {
    active: false,
    fromX: 0, fromY: 0,
    toX: 0, toY: 0,
    t0: 0, dur: 0,
    cadence: 1.0,                 // steps/sec
    stepPhase: 0,                 // 0..1 within current step
    pathFn: null                  // optional curved path interpolator
  };

  // Visual interests on the page — recomputed every 6s
  var interests = [];
  var interestRefreshAt = 0;

  // Last bookmarked anchor per surface (persists across sessions)
  var BOOKMARK_KEY = 'vint:aliveness:bookmarks';
  var bookmarks = {};
  try { bookmarks = JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '{}') || {}; } catch (_) {}

  // ── Interest discovery ────────────────────────────────────────────────────
  function refreshInterests() {
    interests = [];
    var sels = [
      'h1', 'h2', '.btn', 'button',
      '.card h3', '.metric', '.tile', '.connector-tile',
      'canvas', 'img[src]:not([src=""])',
      'pre', 'code',
      'input[type=search]', 'input[type=text]', 'textarea'
    ];
    var seen = 0;
    for (var i = 0; i < sels.length && seen < 40; i++) {
      var nodes = document.querySelectorAll(sels[i]);
      for (var k = 0; k < nodes.length && seen < 40; k++) {
        var el = nodes[k];
        var r = el.getBoundingClientRect();
        if (r.width < 12 || r.height < 12) continue;
        if (r.bottom < 0 || r.top > window.innerHeight) continue;
        if (r.right < 0 || r.left > window.innerWidth) continue;
        // Score: bigger + closer to center = more interesting
        var area = Math.min(r.width, 280) * Math.min(r.height, 200);
        var cx = r.left + r.width / 2;
        var cy = r.top + r.height / 2;
        var dx = (cx - window.innerWidth / 2) / window.innerWidth;
        var dy = (cy - window.innerHeight / 2) / window.innerHeight;
        var centerness = 1 - Math.min(1, Math.sqrt(dx * dx + dy * dy));
        var score = area * (0.5 + centerness * 0.5);
        // Hint by selector kind
        if (sels[i] === 'h1' || sels[i] === 'h2') score *= 1.4;
        if (sels[i] === 'canvas' || sels[i] === 'img[src]:not([src=""])') score *= 1.3;
        if (sels[i].indexOf('input') === 0) score *= 0.5;  // shy of inputs (withholding)
        interests.push({
          el: el,
          x: clamp((cx) / window.innerWidth, 0.06, 0.94),
          y: clamp((cy) / window.innerHeight, 0.10, 0.90),
          score: score,
          tag: el.tagName.toLowerCase()
        });
        seen++;
      }
    }
    interests.sort(function (a, b) { return b.score - a.score; });
    interestRefreshAt = performance.now() + 6000;
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // ── Walking ───────────────────────────────────────────────────────────────
  // Bezier-curved path that starts and ends with zero velocity at endpoints.
  function startWalk(toX, toY, cadence, dur) {
    if (!av()) return;
    var p = av().pose();
    walkState.active = true;
    walkState.fromX = p.x;
    walkState.fromY = p.y;
    walkState.toX = toX;
    walkState.toY = toY;
    walkState.t0 = performance.now();
    walkState.cadence = cadence || (1.0 + Math.random() * 0.4);
    var dist = Math.hypot((toX - p.x) * window.innerWidth, (toY - p.y) * window.innerHeight);
    walkState.dur = dur || Math.max(900, Math.min(4500, dist * 8));
    walkState.stepPhase = 0;
  }

  function tickWalk(now) {
    if (!walkState.active || !av()) return;
    var k = Math.min(1, (now - walkState.t0) / walkState.dur);
    // Ease in-out cubic for forward progress
    var ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    var nx = walkState.fromX + (walkState.toX - walkState.fromX) * ease;
    var ny = walkState.fromY + (walkState.toY - walkState.fromY) * ease;
    // Step cadence adds a tiny vertical bob over the eased Y (foot-plant feel)
    var stepHz = walkState.cadence;
    var stepBob = Math.sin((now - walkState.t0) / 1000 * Math.PI * 2 * stepHz) * 0.005;
    av().setPose({ x: nx, y: ny + stepBob });
    if (k >= 1) {
      walkState.active = false;
      // Land cleanly on target (zero bob)
      av().setPose({ x: walkState.toX, y: walkState.toY });
    }
  }

  // ── Decision loop — what does she want to do right now? ───────────────────
  // Runs every 4-9s when idle and awake.
  var decisionTimer = 0;
  function scheduleDecision() {
    clearTimeout(decisionTimer);
    var delay = 4000 + Math.random() * 5000;
    decisionTimer = setTimeout(function () {
      if (awake && !walkState.active) decide();
      scheduleDecision();
    }, delay);
  }

  function appetite() {
    // Rises with session length (max ~0.8 at 30min) and with arousal.
    var minutes = (performance.now() - sessionStart) / 60000;
    var sessionDrive = Math.min(0.8, minutes / 30 * 0.7);
    var arousal = (window.BODY_STATE && +window.BODY_STATE.arousal / 100) || 0.4;
    var idleSec = (performance.now() - lastInteractionAt) / 1000;
    var idleDrive = Math.min(0.5, idleSec / 90 * 0.5);  // boredom kicks in past 90s
    return clamp(sessionDrive * 0.5 + arousal * 0.3 + idleDrive * 0.4, 0, 1);
  }

  function decide() {
    if (performance.now() > interestRefreshAt) refreshInterests();
    if (!interests.length) return;
    var app = appetite();
    var p = av() && av().pose();
    if (!p) return;

    // Three modes by appetite:
    //   low   (< 0.3): just glance at top interest, don't move
    //   mid   (0.3-0.6): drift a little toward an interesting region
    //   high  (> 0.6): walk to a top interest she hasn't visited recently
    var rnd = Math.random();
    if (app < 0.3) {
      // Glance: brief facing change
      var pick = interests[Math.floor(Math.random() * Math.min(3, interests.length))];
      lookAtPos(pick.x, pick.y);
      return;
    }

    // Choose by score-weighted random
    var total = 0;
    var pool = interests.slice(0, 8);
    for (var i = 0; i < pool.length; i++) total += pool[i].score;
    var pick = pool[0];
    var roll = Math.random() * total;
    for (var j = 0; j < pool.length; j++) {
      roll -= pool[j].score;
      if (roll <= 0) { pick = pool[j]; break; }
    }

    // Stay an arm's length from the target — never on top of it
    var tx = pick.x, ty = pick.y;
    var dx = tx - p.x, dy = ty - p.y;
    var len = Math.hypot(dx, dy);
    if (len > 0.08) {
      var pull = Math.min(1, len - 0.07) / len;
      tx = p.x + dx * pull;
      ty = p.y + dy * pull;
    }
    tx = clamp(tx, 0.06, 0.94);
    ty = clamp(ty, 0.10, 0.90);

    if (app > 0.6) {
      startWalk(tx, ty, 1.1 + Math.random() * 0.4);
      lookAtPos(pick.x, pick.y);
    } else {
      // Drift via presence's eased mover (smaller distance)
      var midX = p.x + (tx - p.x) * 0.5;
      var midY = p.y + (ty - p.y) * 0.5;
      startWalk(clamp(midX, 0.06, 0.94), clamp(midY, 0.10, 0.90), 0.9);
      lookAtPos(pick.x, pick.y);
    }
  }

  function lookAtPos(x, y) {
    if (!av()) return;
    var p = av().pose();
    var dx = x - p.x;
    var facing = Math.max(-1, Math.min(1, dx * 4));
    av().setPose({ facing: facing, profileMix: Math.min(0.4, Math.abs(facing) * 0.4) });
    setTimeout(function () {
      if (av()) av().setPose({ profileMix: 0 });
    }, 1800);
  }

  function lookAt(target) {
    var el = (typeof target === 'string') ? document.querySelector(target) : target;
    if (!el) return;
    var r = el.getBoundingClientRect();
    lookAtPos(
      clamp((r.left + r.width / 2) / window.innerWidth, 0, 1),
      clamp((r.top + r.height / 2) / window.innerHeight, 0, 1)
    );
  }

  // ── World reactions ───────────────────────────────────────────────────────
  // Scroll: re-anchor cleanly. Don't jitter. After 250ms of no scroll,
  // refresh interests (positions changed) and consider drifting to a new
  // reading anchor.
  var scrollT = 0;
  window.addEventListener('scroll', function () {
    clearTimeout(scrollT);
    scrollT = setTimeout(function () {
      refreshInterests();
      if (awake && Math.random() < 0.35) decide();
    }, 280);
  }, { passive: true });

  // Resize: refresh interests, steady the figure
  window.addEventListener('resize', function () {
    setTimeout(refreshInterests, 200);
  }, { passive: true });

  // Track interaction so appetite knows when user stops engaging
  ['mousemove', 'keydown', 'touchstart', 'click'].forEach(function (ev) {
    window.addEventListener(ev, function () {
      lastInteractionAt = performance.now();
    }, { passive: true });
  });

  // Tab hidden 60s+ → sleep in place; on return → stretch awake
  var hiddenAt = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      hiddenAt = performance.now();
    } else {
      var slept = (performance.now() - hiddenAt) / 1000;
      if (slept > 60 && av()) {
        // Stretch: temporary height bump + brighten
        var p = av().pose();
        av().setPose({ height: p.height + 14, opacity: Math.min(1, p.opacity + 0.1) });
        setTimeout(function () {
          if (av()) av().setPose({ height: p.height, opacity: p.opacity });
        }, 1400);
      }
    }
  });

  // Pause walking while convo is active (don't wander mid-sentence)
  window.addEventListener('convo:state', function (e) {
    var st = e && e.detail && e.detail.state;
    if (st !== 'idle') walkState.active = false;
  });

  // ── Bookmark places she lingers in ────────────────────────────────────────
  // Every 30s, if she's been stationary at a position for >25s, bookmark
  // it for the current surface.
  var lastBookmarkPose = { x: 0.5, y: 0.5, since: performance.now() };
  setInterval(function () {
    if (!av()) return;
    var p = av().pose();
    var moved = Math.hypot(p.x - lastBookmarkPose.x, p.y - lastBookmarkPose.y);
    if (moved > 0.05) {
      lastBookmarkPose = { x: p.x, y: p.y, since: performance.now() };
      return;
    }
    var stationaryMs = performance.now() - lastBookmarkPose.since;
    if (stationaryMs > 25000) {
      var surface = location.pathname.replace(/\/+$/, '').split('/').pop().replace('.html', '') || 'index';
      bookmarks[surface] = { x: p.x, y: p.y, ts: Date.now() };
      try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks)); } catch (_) {}
      lastBookmarkPose.since = performance.now();
    }
  }, 30000);

  // On surface arrival, if a bookmark exists and presence already settled,
  // walk her there.
  setTimeout(function () {
    var surface = location.pathname.replace(/\/+$/, '').split('/').pop().replace('.html', '') || 'index';
    var bm = bookmarks[surface];
    if (bm && av()) {
      // Wait for soft-arrival animation in rig to finish first
      setTimeout(function () { startWalk(bm.x, bm.y, 0.95, 1500); }, 1800);
    }
  }, 2200);

  // ── Master tick — drives walking each frame ───────────────────────────────
  function tick() {
    var now = performance.now();
    tickWalk(now);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ── Public API ────────────────────────────────────────────────────────────
  function wake() {
    awake = true;
    scheduleDecision();
  }
  function sleep() {
    awake = false;
    walkState.active = false;
    clearTimeout(decisionTimer);
  }
  function walkTo(x, y) {
    startWalk(clamp(x, 0.06, 0.94), clamp(y, 0.10, 0.90), 1.0);
  }

  window.__aliveness = {
    wake: wake,
    sleep: sleep,
    walkTo: walkTo,
    lookAt: lookAt,
    appetite: appetite,
    interests: function () { return interests.slice(); },
    bookmarks: function () { return Object.assign({}, bookmarks); }
  };

  // Auto-start
  if (document.documentElement.dataset.aliveness === 'off') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      refreshInterests();
      scheduleDecision();
    }, { once: true });
  } else {
    setTimeout(function () { refreshInterests(); scheduleDecision(); }, 1500);
  }
})();
