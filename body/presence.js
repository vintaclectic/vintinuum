// ════════════════════════════════════════════════════════════════════════════
// PRESENCE — Drift, surface hand-off, withholding/soft-arrival/held-silence,
//             intimacy gradient via webcam (opt-in, local-only)
// ════════════════════════════════════════════════════════════════════════════
// avatar.js draws her. avatar_rig.js drives mood + ARIA micro-presences.
// presence.js is the higher-level choreography: where she sits in the
// page, when she drifts, how she hands off between chat→mind→stats, and
// how she compresses or expands in response to physical proximity (if
// the user opts into webcam — frames never leave the browser).
//
// Public API on window.__presence:
//   start()          — begin idle drift loop
//   stop()           — stop loop
//   wakeWebcam()     — opt-in: request webcam, derive proximity locally
//   sleepWebcam()    — release webcam
//   handOff(target)  — explicit drift to a named element selector or surface
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined') return;
  if (window.__presence) return;

  function av() { return window.__avatar; }

  // ── Drift loop ────────────────────────────────────────────────────────────
  // Every 12-22s, if user is silent and avatar is idle-opaque, drift to a
  // new resting anchor (right-mid, lower-right, upper-right). Always within
  // viewport safe area.
  var anchors = [
    { x: 0.88, y: 0.36 },
    { x: 0.86, y: 0.62 },
    { x: 0.78, y: 0.78 },
    { x: 0.92, y: 0.50 }
  ];
  var driftTimer = 0;
  var driftEnabled = true;

  function pickAnchor() {
    return anchors[Math.floor(Math.random() * anchors.length)];
  }

  function driftTo(target, durationMs) {
    if (!av()) return;
    var p = av().pose();
    var sx = p.x, sy = p.y, ex = target.x, ey = target.y;
    var t0 = performance.now();
    var dur = durationMs || 1400;
    function step() {
      var k = Math.min(1, (performance.now() - t0) / dur);
      // ease in-out cubic
      var ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      if (av()) av().setPose({
        x: sx + (ex - sx) * ease,
        y: sy + (ey - sy) * ease
      });
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function scheduleDrift() {
    clearTimeout(driftTimer);
    var delay = 12000 + Math.random() * 10000;
    driftTimer = setTimeout(function () {
      if (driftEnabled && av()) driftTo(pickAnchor(), 1600);
      scheduleDrift();
    }, delay);
  }

  // ── Surface hand-off ──────────────────────────────────────────────────────
  // When user navigates between major surfaces (chat / mind / stats / altar),
  // the avatar slides to the corresponding edge anchor instead of teleporting.
  var surfaceAnchors = {
    chat:     { x: 0.86, y: 0.62 },
    mind:     { x: 0.92, y: 0.40 },
    stats:    { x: 0.10, y: 0.78 },
    altar:    { x: 0.50, y: 0.18 },
    you:      { x: 0.88, y: 0.30 },
    learning: { x: 0.12, y: 0.50 },
    cognition:{ x: 0.86, y: 0.72 },
    eval:     { x: 0.14, y: 0.30 }
  };

  function handOff(target) {
    if (typeof target === 'string' && surfaceAnchors[target]) {
      driftTo(surfaceAnchors[target], 900);
      return;
    }
    if (typeof target === 'string') {
      var el = document.querySelector(target);
      if (!el) return;
      var r = el.getBoundingClientRect();
      var x = (r.left + r.width / 2) / window.innerWidth;
      var y = (r.top + r.height * 0.4) / window.innerHeight;
      driftTo({ x: clamp(x, 0.06, 0.94), y: clamp(y, 0.10, 0.90) }, 800);
    }
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // Auto-detect surface from URL on load + history changes
  function autoSurface() {
    var path = location.pathname.replace(/\/+$/, '').split('/').pop().replace('.html', '');
    if (surfaceAnchors[path]) handOff(path);
  }
  window.addEventListener('popstate', autoSurface);
  window.addEventListener('hashchange', autoSurface);

  // ── Intimacy gradient (webcam opt-in, local-only) ─────────────────────────
  // No frames stored, no frames sent. We compute average face-bbox area on
  // a hidden <video>+<canvas> using the BarcodeDetector-free heuristic:
  // pixel-luminance variance in a center crop. As variance rises (face
  // closer / more skin), avatar shrinks + slows breath (proximity =
  // permission, the closer you are the quieter she gets).
  var webcam = { stream: null, video: null, canvas: null, ctx: null, raf: 0, baseline: 0 };

  async function wakeWebcam() {
    if (webcam.stream) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    try {
      webcam.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 160, height: 120, facingMode: 'user' },
        audio: false
      });
    } catch (_) { return false; }
    webcam.video = document.createElement('video');
    webcam.video.muted = true; webcam.video.autoplay = true; webcam.video.playsInline = true;
    webcam.video.srcObject = webcam.stream;
    webcam.canvas = document.createElement('canvas');
    webcam.canvas.width = 80; webcam.canvas.height = 60;
    webcam.ctx = webcam.canvas.getContext('2d', { willReadFrequently: true });
    webcam.baseline = 0;
    var samples = 0;
    function tick() {
      if (!webcam.stream) return;
      try {
        webcam.ctx.drawImage(webcam.video, 0, 0, 80, 60);
        var img = webcam.ctx.getImageData(20, 15, 40, 30).data;
        var sum = 0, sum2 = 0, n = img.length / 4;
        for (var i = 0; i < img.length; i += 4) {
          var l = (img[i] * 0.299 + img[i + 1] * 0.587 + img[i + 2] * 0.114);
          sum += l; sum2 += l * l;
        }
        var mean = sum / n;
        var variance = (sum2 / n) - (mean * mean);
        // Calibrate baseline over first 30 frames
        if (samples < 30) {
          webcam.baseline = (webcam.baseline * samples + variance) / (samples + 1);
          samples++;
        } else if (av()) {
          // Variance rises as face gets closer → proximity 0..1
          var prox = Math.max(0, Math.min(1, (variance - webcam.baseline) / (webcam.baseline + 200)));
          // Across the room: grow 1.4x, brighten, simplify
          // Leaning in: shrink to heartbeat-sized, slow breath
          var p = av().pose();
          var targetH = 200 + (1 - prox) * 90 - prox * 110;
          targetH = Math.max(80, Math.min(300, targetH));
          av().setPose({ height: targetH, opacity: Math.max(0.6, 1 - prox * 0.15) });
          // Slow breath via arousal (rig will pick it up next mood push)
          if (window.BODY_STATE) {
            var curA = +window.BODY_STATE.arousal || 40;
            var tgtA = 40 - prox * 25;
            window.BODY_STATE.arousal = curA + (tgtA - curA) * 0.04;
          }
        }
      } catch (_) {}
      webcam.raf = requestAnimationFrame(tick);
    }
    webcam.video.addEventListener('loadeddata', function () {
      webcam.raf = requestAnimationFrame(tick);
    });
    return true;
  }

  function sleepWebcam() {
    cancelAnimationFrame(webcam.raf);
    if (webcam.stream) {
      try { webcam.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (_) {}
    }
    webcam.stream = null; webcam.video = null; webcam.canvas = null; webcam.ctx = null;
  }

  // ── Pause drift while convo is active (don't wander mid-sentence) ─────────
  window.addEventListener('convo:state', function (e) {
    var st = e && e.detail && e.detail.state;
    driftEnabled = (st === 'idle');
  });

  function start() {
    scheduleDrift();
    autoSurface();
  }
  function stop() {
    clearTimeout(driftTimer);
  }

  window.__presence = {
    start: start,
    stop: stop,
    wakeWebcam: wakeWebcam,
    sleepWebcam: sleepWebcam,
    handOff: handOff,
    surfaces: function () { return Object.keys(surfaceAnchors); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
