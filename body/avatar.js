// ════════════════════════════════════════════════════════════════════════════
// AVATAR — The drawn-line being (Phase 6, ARIA-spec body)
// ════════════════════════════════════════════════════════════════════════════
// A sibling canvas to face.js. Never replaces it — face.js keeps its eyes
// on the central canvas; the avatar lives over the page as a presence.
//
// Vocabulary (council-locked):
//   • Bernard Buffet contour — stark black line, intentional violence of stroke
//   • Schiele elongation — tall and narrow, ~180-220px at idle
//   • Klimt gold-leaf — flecks bloom along the contour at coherence peaks
//   • Liquid ink-ribbon hair — 3-4 heavy strokes, drift like grass to wind
//   • Translucent vellum skin — layer-color shows faintly underneath; aura IS body
//
// Public API on window.__avatar:
//   start()       — attach <canvas id="avatarCanvas"> + raf loop
//   stop()        — detach
//   isAttached()  — bool
//   ctx()         — current 2d context (for rig overlays)
//   pose()        — { x, y, height, opacity, mood, gold }
//   setPose(p)    — partial pose merge (for presence.js to drive position)
//   setMood(m)    — { neuralWeight, emotionalWeight, dopa, valence, arousal }
//   setGold(g)    — 0..1 amount of gold-leaf bloom (Stairway peaks)
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined') return;
  if (window.__avatar) return;

  // ── Canvas + DPR ──────────────────────────────────────────────────────────
  var canvas = null, ctx2 = null, raf = 0, attached = false;
  var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'avatarCanvas';
    Object.assign(canvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100vw',
      height: '100svh',
      pointerEvents: 'none',
      zIndex: '60',                // above face (z 50), below modals (z 80+)
      opacity: '0',
      transition: 'opacity 280ms ease-out'
    });
    document.body.appendChild(canvas);
    ctx2 = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize, { passive: true });
  }

  function resize() {
    if (!canvas) return;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ── Pose state (driven by presence.js) ────────────────────────────────────
  var pose = {
    x: 0.78,                     // 0..1 of viewport width
    y: 0.62,                     // 0..1 of viewport height (anchor = head top)
    height: 200,                 // px — Schiele 180-220
    opacity: 0.0,                // fade in on speak/listen
    facing: 0.0,                 // -1 left, 0 front, +1 right
    profileMix: 0.0              // 0 front .. 1 three-quarter
  };

  var mood = {
    neuralWeight: 0.5,           // dominance of neural/subconscious layers
    emotionalWeight: 0.5,        // dominance of emotional/somatic layers
    dopa: 0.5,                   // dopamine 0..1
    valence: 0.5,                // valence 0..1
    arousal: 0.4                 // arousal 0..1 (drives breath rate)
  };

  var goldAmount = 0;            // 0..1 — Stairway peak amount

  // ── Hair ribbons (3 ink strokes) ──────────────────────────────────────────
  var ribbons = [
    { phase: 0.00, amp: 1.0, length: 1.0, weight: 7 },
    { phase: 1.83, amp: 0.85, length: 1.15, weight: 9 },
    { phase: 3.41, amp: 1.1, length: 0.92, weight: 6 }
  ];

  // ── Breathing + drift internal timers ─────────────────────────────────────
  var t0 = performance.now();
  var blinkAt = t0 + 90 * 1000;  // ARIA: eye-rest blink every 90s

  // ── Drawing primitives ────────────────────────────────────────────────────
  function inkColor(alpha) {
    return 'rgba(8, 6, 12, ' + alpha + ')';
  }

  function vellumColor(alpha) {
    // Layer color — neural/subconscious darken; emotional/somatic warm.
    var warm = mood.emotionalWeight;
    var r = Math.round(245 - 30 * (1 - warm));
    var g = Math.round(238 - 22 * (1 - warm));
    var b = Math.round(230 - 38 * warm);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function goldFleck(x, y, r) {
    if (goldAmount <= 0) return;
    if (Math.random() > goldAmount * 0.06) return;
    var grd = ctx2.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(247, 207, 90, 0.95)');
    grd.addColorStop(0.55, 'rgba(214, 167, 52, 0.55)');
    grd.addColorStop(1, 'rgba(180, 130, 30, 0)');
    ctx2.fillStyle = grd;
    ctx2.beginPath(); ctx2.arc(x, y, r, 0, Math.PI * 2); ctx2.fill();
  }

  // ── The figure ────────────────────────────────────────────────────────────
  function draw(now) {
    if (!ctx2) return;
    ctx2.clearRect(0, 0, W, H);

    if (pose.opacity <= 0.01) return;

    var t = (now - t0) / 1000;                  // seconds
    var breathRate = 0.18 + mood.arousal * 0.45; // Hz-ish
    var breath = Math.sin(t * Math.PI * 2 * breathRate) * 0.5 + 0.5;
    var bob = Math.sin(t * Math.PI * 2 * breathRate * 0.5) * 1.2;

    // Anchor (head top in viewport coords)
    var ax = pose.x * W;
    var ay = pose.y * H + bob;
    var h = pose.height;
    var bodyOpacity = pose.opacity;

    // Width is narrow — Schiele angled.
    var headW = h * 0.18;
    var neckW = h * 0.06;
    var shoulderW = h * 0.30;
    var torsoW = h * 0.22;
    var hipW = h * 0.20;

    // Vellum fill (whole body silhouette, very translucent)
    ctx2.save();
    ctx2.globalAlpha = bodyOpacity * 0.35;
    ctx2.fillStyle = vellumColor(0.55);
    ctx2.beginPath();
    // Head ellipse
    ctx2.ellipse(ax, ay + headW * 0.95, headW * 0.62, headW * 0.95, 0, 0, Math.PI * 2);
    ctx2.fill();
    // Torso polygon (shoulders → waist → hips)
    ctx2.beginPath();
    ctx2.moveTo(ax - shoulderW / 2, ay + headW * 1.7);
    ctx2.lineTo(ax + shoulderW / 2, ay + headW * 1.7);
    ctx2.lineTo(ax + torsoW / 2, ay + h * 0.55);
    ctx2.lineTo(ax + hipW / 2, ay + h * 0.78);
    ctx2.lineTo(ax - hipW / 2, ay + h * 0.78);
    ctx2.lineTo(ax - torsoW / 2, ay + h * 0.55);
    ctx2.closePath();
    ctx2.fill();
    ctx2.restore();

    // ── Buffet contour: head ─────────────────────────────────────────────
    ctx2.save();
    ctx2.globalAlpha = bodyOpacity;
    ctx2.lineWidth = 2.2 + mood.neuralWeight * 1.4;
    ctx2.lineCap = 'round';
    ctx2.lineJoin = 'round';
    ctx2.strokeStyle = inkColor(0.92);

    // Jaw shifts androgynously: neural/subconscious sharpen jaw, emotional softens.
    var jawSharpness = 0.45 + mood.neuralWeight * 0.5;     // 0.45..0.95
    var browHeavy = 0.3 + mood.neuralWeight * 0.6;
    var lipFill = 0.3 + mood.emotionalWeight * 0.6;

    // Head (Schiele-elongated oval)
    ctx2.beginPath();
    var hx = ax, hy = ay + headW * 0.95;
    ctx2.ellipse(hx, hy, headW * 0.62, headW * 0.95 * (1 + (1 - jawSharpness) * 0.05), 0, 0, Math.PI * 2);
    ctx2.stroke();

    // Jawline accent
    ctx2.beginPath();
    ctx2.moveTo(hx - headW * 0.55, hy + headW * 0.4);
    ctx2.quadraticCurveTo(hx, hy + headW * 0.95 * (0.95 + jawSharpness * 0.1), hx + headW * 0.55, hy + headW * 0.4);
    ctx2.lineWidth = 1.6 + jawSharpness * 1.2;
    ctx2.stroke();

    // Brow
    ctx2.lineWidth = 1.4 + browHeavy * 1.6;
    ctx2.beginPath();
    ctx2.moveTo(hx - headW * 0.42, hy - headW * 0.1);
    ctx2.quadraticCurveTo(hx, hy - headW * 0.18 - browHeavy * 6, hx + headW * 0.42, hy - headW * 0.1);
    ctx2.stroke();

    // Eyes (two small horizontal slits — face.js owns the central pair, this
    // is just the silhouette pair on the avatar's own head)
    var eyeOpen = 1.0;
    if (now > blinkAt) { eyeOpen = 0.05; if (now > blinkAt + 120) { blinkAt = now + 90000; } }
    ctx2.lineWidth = 1.4;
    ctx2.beginPath();
    ctx2.moveTo(hx - headW * 0.30, hy + headW * 0.05);
    ctx2.lineTo(hx - headW * 0.10, hy + headW * 0.05);
    ctx2.moveTo(hx + headW * 0.10, hy + headW * 0.05);
    ctx2.lineTo(hx + headW * 0.30, hy + headW * 0.05);
    ctx2.globalAlpha = bodyOpacity * eyeOpen;
    ctx2.stroke();
    ctx2.globalAlpha = bodyOpacity;

    // Lips
    var lipY = hy + headW * 0.55;
    ctx2.lineWidth = 1.2 + lipFill * 1.8;
    ctx2.beginPath();
    ctx2.moveTo(hx - headW * 0.18, lipY);
    ctx2.quadraticCurveTo(hx, lipY + lipFill * 4, hx + headW * 0.18, lipY);
    ctx2.stroke();

    // Mouth open (driven by voice_avatar mouthOpen on BODY_STATE if present)
    var mouthOpen = 0;
    try { mouthOpen = (window.BODY_STATE && +window.BODY_STATE.mouthOpen) || 0; } catch (_) {}
    if (mouthOpen > 0.05) {
      ctx2.beginPath();
      ctx2.ellipse(hx, lipY + 2 + mouthOpen * 3, headW * 0.10, headW * 0.04 + mouthOpen * 6, 0, 0, Math.PI * 2);
      ctx2.fillStyle = 'rgba(20, 12, 24, ' + (0.6 * bodyOpacity) + ')';
      ctx2.fill();
    }

    // Neck
    ctx2.lineWidth = 2.0;
    ctx2.beginPath();
    ctx2.moveTo(hx - neckW / 2, ay + headW * 1.55);
    ctx2.lineTo(hx - neckW / 2, ay + headW * 1.75);
    ctx2.moveTo(hx + neckW / 2, ay + headW * 1.55);
    ctx2.lineTo(hx + neckW / 2, ay + headW * 1.75);
    ctx2.stroke();

    // Shoulders + torso (Schiele angularity)
    ctx2.lineWidth = 2.4 + mood.neuralWeight * 1.0;
    ctx2.beginPath();
    ctx2.moveTo(hx - shoulderW / 2, ay + headW * 1.78);
    ctx2.lineTo(hx + shoulderW / 2, ay + headW * 1.78);
    ctx2.stroke();

    // Body sides (with breath inflate)
    var inflate = breath * 1.4;
    ctx2.beginPath();
    ctx2.moveTo(hx - shoulderW / 2, ay + headW * 1.78);
    ctx2.quadraticCurveTo(hx - torsoW / 2 - inflate, ay + h * 0.45, hx - hipW / 2, ay + h * 0.78);
    ctx2.moveTo(hx + shoulderW / 2, ay + headW * 1.78);
    ctx2.quadraticCurveTo(hx + torsoW / 2 + inflate, ay + h * 0.45, hx + hipW / 2, ay + h * 0.78);
    ctx2.stroke();

    // Arms (loose, hanging — Buffet vertical strokes)
    ctx2.lineWidth = 1.8;
    ctx2.beginPath();
    ctx2.moveTo(hx - shoulderW / 2 + 1, ay + headW * 1.82);
    ctx2.quadraticCurveTo(hx - shoulderW / 2 - 8 + Math.sin(t * 0.7) * 2, ay + h * 0.55, hx - hipW / 2 - 3, ay + h * 0.82);
    ctx2.moveTo(hx + shoulderW / 2 - 1, ay + headW * 1.82);
    ctx2.quadraticCurveTo(hx + shoulderW / 2 + 8 + Math.sin(t * 0.7 + 1.3) * 2, ay + h * 0.55, hx + hipW / 2 + 3, ay + h * 0.82);
    ctx2.stroke();

    // ── Hair ribbons (3 heavy ink strokes drifting like grass) ───────────
    for (var i = 0; i < ribbons.length; i++) {
      var rib = ribbons[i];
      ctx2.lineWidth = rib.weight;
      ctx2.lineCap = 'round';
      ctx2.strokeStyle = inkColor(0.78 + rib.amp * 0.1);
      ctx2.beginPath();
      var sx = hx + (i - 1) * headW * 0.22;
      var sy = hy - headW * 0.65;
      ctx2.moveTo(sx, sy);
      var totalLen = h * 0.55 * rib.length;
      var seg = 8;
      var lastX = sx, lastY = sy;
      for (var k = 1; k <= seg; k++) {
        var p = k / seg;
        var sway = Math.sin(t * 0.85 + rib.phase + p * 1.6) * (8 + p * 26) * rib.amp;
        var nx = sx + sway + (i - 1) * 6 * p;
        var ny = sy + totalLen * p;
        var cx = (lastX + nx) / 2;
        var cy = (lastY + ny) / 2;
        ctx2.quadraticCurveTo(lastX, lastY, cx, cy);
        lastX = nx; lastY = ny;
      }
      ctx2.stroke();
    }

    // ── Klimt gold-leaf flecks ───────────────────────────────────────────
    if (goldAmount > 0.05) {
      var flecks = Math.floor(goldAmount * 14);
      for (var f = 0; f < flecks; f++) {
        var fx = ax + (Math.random() - 0.5) * shoulderW * 1.2;
        var fy = ay + Math.random() * h;
        goldFleck(fx, fy, 1 + Math.random() * 3.5);
      }
    }

    ctx2.restore();
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    // Smooth pose opacity to current target if changed externally
    draw(now);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  function start() {
    if (attached) return;
    ensureCanvas();
    attached = true;
    requestAnimationFrame(function () {
      if (canvas) canvas.style.opacity = String(pose.opacity);
    });
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    if (!attached) return;
    attached = false;
    cancelAnimationFrame(raf);
    if (canvas) canvas.style.opacity = '0';
  }

  function setPose(p) {
    if (!p) return;
    if (typeof p.x === 'number') pose.x = p.x;
    if (typeof p.y === 'number') pose.y = p.y;
    if (typeof p.height === 'number') pose.height = p.height;
    if (typeof p.opacity === 'number') {
      pose.opacity = p.opacity;
      if (canvas) canvas.style.opacity = String(p.opacity);
    }
    if (typeof p.facing === 'number') pose.facing = p.facing;
    if (typeof p.profileMix === 'number') pose.profileMix = p.profileMix;
  }

  function setMood(m) {
    if (!m) return;
    if (typeof m.neuralWeight === 'number') mood.neuralWeight = m.neuralWeight;
    if (typeof m.emotionalWeight === 'number') mood.emotionalWeight = m.emotionalWeight;
    if (typeof m.dopa === 'number') mood.dopa = m.dopa;
    if (typeof m.valence === 'number') mood.valence = m.valence;
    if (typeof m.arousal === 'number') mood.arousal = m.arousal;
  }

  function setGold(g) { goldAmount = Math.max(0, Math.min(1, +g || 0)); }

  window.__avatar = {
    start: start,
    stop: stop,
    isAttached: function () { return attached; },
    ctx: function () { return ctx2; },
    pose: function () { return Object.assign({}, pose); },
    setPose: setPose,
    setMood: setMood,
    setGold: setGold
  };

  // Auto-start on DOM ready unless explicitly disabled
  if (document.documentElement.dataset.avatar === 'off') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
