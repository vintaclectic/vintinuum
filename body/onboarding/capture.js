'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   CAPTURE — getUserMedia selfie with silent-until-needed guidance.
   ARIA: "no grid, no face-outline overlay (that's clinical). silent until needed."
   Brightness sampled from a 32x32 canvas every 400ms. Auto-captures when the
   frame is bright + still. Falls back to file pick if camera is denied.
   ════════════════════════════════════════════════════════════════════════════ */

(function (global) {
  const Capture = {};
  let stream = null, video = null, hintEl = null, sampler = null;
  let onAccept = null;
  let lastFrameSig = 0, stillSince = 0, lowLightShown = false, idleShown = false;
  let armed = false;

  Capture.start = async function ({ videoEl, hintEl: h, onAccept: cb, onNeedFallback }) {
    video = videoEl; hintEl = h; onAccept = cb;
    armed = true; lowLightShown = false; idleShown = false; stillSince = 0;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1024 }, height: { ideal: 1024 } }, audio: false });
      video.srcObject = stream;
      video.setAttribute('playsinline', '');
      await video.play();
      _startSampler();
    } catch (e) {
      console.warn('[capture] camera unavailable:', e.message);
      if (onNeedFallback) onNeedFallback();
    }
  };

  function _hint(text) { if (!hintEl) return; hintEl.textContent = text || ''; hintEl.classList.toggle('show', !!text); }

  function _startSampler() {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    sampler = setInterval(() => {
      if (!armed || !video || video.readyState < 2) return;
      try {
        ctx.drawImage(video, 0, 0, 32, 32);
        const px = ctx.getImageData(0, 0, 32, 32).data;
        let lum = 0, sig = 0;
        for (let i = 0; i < px.length; i += 4) {
          const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          lum += l; sig += l * ((i >> 2) % 7 + 1);
        }
        lum /= (px.length / 4);
        const now = Date.now();

        // low light guidance
        if (lum < 55) { if (!lowLightShown) { _hint('a little more light, if you can'); lowLightShown = true; } return; }
        else if (lowLightShown) { _hint(''); lowLightShown = false; }

        // stillness detection — frame signature stable ⇒ holding steady
        const delta = Math.abs(sig - lastFrameSig); lastFrameSig = sig;
        if (delta < sig * 0.02) {
          if (!stillSince) stillSince = now;
          if (now - stillSince > 800) { _hint('there you are'); setTimeout(_autoCapture, 600); armed = false; }
        } else {
          stillSince = 0;
          if (!idleShown && now - (Capture._t0 || now) > 4000) { _hint('whenever you’re ready'); idleShown = true; }
        }
      } catch (_) {}
    }, 400);
    Capture._t0 = Date.now();
  }

  function _autoCapture() {
    if (!video) return;
    const c = document.createElement('canvas');
    const s = Math.min(video.videoWidth, video.videoHeight) || 1024;
    c.width = s; c.height = s;
    const ctx = c.getContext('2d');
    // center-crop square, downscale to ~1024 to keep base64 under the ingest cap
    const sx = (video.videoWidth - s) / 2, sy = (video.videoHeight - s) / 2;
    ctx.drawImage(video, sx, sy, s, s, 0, 0, s, s);
    const dataUrl = c.toDataURL('image/jpeg', 0.9);
    _stop();
    if (onAccept) onAccept(dataUrl);
  }

  // file-pick fallback (camera denied or desktop without webcam)
  Capture.fromFile = function (file, cb) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(img.width, img.height);
        const c = document.createElement('canvas'); c.width = Math.min(s, 1024); c.height = Math.min(s, 1024);
        const ctx = c.getContext('2d');
        const sx = (img.width - s) / 2, sy = (img.height - s) / 2;
        ctx.drawImage(img, sx, sy, s, s, 0, 0, c.width, c.height);
        cb(c.toDataURL('image/jpeg', 0.9));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  function _stop() {
    armed = false;
    if (sampler) { clearInterval(sampler); sampler = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }
  Capture.stop = _stop;

  global.OnboardCapture = Capture;
})(window);
