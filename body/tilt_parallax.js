'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   TILT PARALLAX — the page has depth; tilting the phone is how you look at it.
   (W5 invention layer, council 2026-07-10)

   Elements with data-tilt (optionally data-tilt-depth="0.5..2") drift subtly
   against device orientation. Clamped to ±8px so it can NEVER cause a
   collision. Off under prefers-reduced-motion. iOS permission requested on
   first touch. Kill switch: localStorage vint:flag:tilt=0
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  try { if (localStorage.getItem('vint:flag:tilt') === '0') return; } catch (_) {}
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var MAX = 8; // px — hard clamp, collision-proof
  var els = null, raf = 0, gx = 0, gy = 0;

  function collect() { els = Array.prototype.slice.call(document.querySelectorAll('[data-tilt]')); }
  function apply() {
    raf = 0;
    if (!els) collect();
    for (var i = 0; i < els.length; i++) {
      var d = parseFloat(els[i].getAttribute('data-tilt-depth')) || 1;
      els[i].style.transform = 'translate3d(' + (gx * d).toFixed(1) + 'px,' + (gy * d).toFixed(1) + 'px,0)';
    }
  }
  function onOrient(e) {
    if (e.gamma == null) return;
    // gamma: left/right −90..90, beta: front/back −180..180 — ease + clamp
    gx = Math.max(-MAX, Math.min(MAX, (e.gamma || 0) / 6));
    gy = Math.max(-MAX, Math.min(MAX, ((e.beta || 0) - 40) / 8)); // 40° = natural hold angle
    if (!raf) raf = requestAnimationFrame(apply);
  }

  function arm() {
    window.addEventListener('deviceorientation', onOrient, { passive: true });
  }
  // iOS 13+ requires a user-gesture permission request
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    var once = function () {
      document.removeEventListener('pointerdown', once);
      DeviceOrientationEvent.requestPermission().then(function (r) { if (r === 'granted') arm(); }).catch(function () {});
    };
    document.addEventListener('pointerdown', once, { passive: true });
  } else {
    arm();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', collect);
  else collect();
})();
