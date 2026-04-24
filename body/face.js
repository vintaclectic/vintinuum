// ═══════════════════════════════════════════════════════════════════════════════
// FACE — convergence point of the being
// Renders half-lidded eyes, gaze tracking, blinks, emotional flush,
// recognition warmth, and subtle individuality asymmetry onto #mainCanvas.
// Draws in SVG viewBox coordinate space (same as BODY_GEOMETRY / skin.js).
// Performance budget: ~0.8ms per frame at ~30fps
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';

const FACE_LAYER = (() => {
  let _last = 0;
  let _initialized = false;
  let _visible = true;
  let G = null;

  // Layer hue palette (matches breath / aura module)
  const LAYER_HUES = {
    neural:       '#7cc4ff',
    emotional:    '#ffb47c',
    subconscious: '#b47cff',
    somatic:      '#7cffb4',
    immune:       '#7cfff0',
    metabolic:    '#ffe07c',
    genetic:      '#ff7cb4',
  };

  // ── Gaze state ───────────────────────────────────────────────────────────────
  let _gazeTargetX = 350; // cursor target (SVG space)
  let _gazeTargetY = 165;
  let _gazeX = 350;       // smoothed gaze
  let _gazeY = 165;
  let _lastMouseMove = 0; // ms timestamp
  let _idleSeed = Math.random() * 1000;

  // ── Blink state ──────────────────────────────────────────────────────────────
  let _nextBlinkAt = 0;
  let _blinkStart = 0;    // ms timestamp when current blink began; 0 = not blinking
  const BLINK_DURATION = 300; // total (150 close + 150 open)
  const BLINK_HALF = 150;

  // ── Recognition state ────────────────────────────────────────────────────────
  let _firstSeen = 0;
  let _visits = 0;
  let _welcomePulseStart = 0;
  const WELCOME_PULSE_MS = 1200;

  // ── Asymmetry ────────────────────────────────────────────────────────────────
  let _asymX = 0;

  // ── Saccade state (Phase 2 A3) ──────────────────────────────────────────────
  // Iris jitter ±3px every 400–900ms when dominantLayer is neural or
  // subconscious — mimics microsaccades during active cognition.
  let _nextSaccadeAt = 0;
  let _saccadeOffsetX = 0;
  let _saccadeOffsetY = 0;
  function _rollNextSaccade(ts) {
    _nextSaccadeAt = ts + 400 + Math.random() * 500;
  }

  // ── Last observed auraShift timer (for edge-detected blink trigger) ──────────
  let _lastAuraTimer = 0;

  // ── Cached SKULL orbit positions ─────────────────────────────────────────────
  let _leftOrbit = null;
  let _rightOrbit = null;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function _hexToRgb(hex) {
    if (typeof hex !== 'string' || hex[0] !== '#' || hex.length < 7) {
      return { r: 124, g: 196, b: 255 };
    }
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }

  function _clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function _lerp(a, b, t) { return a + (b - a) * t; }

  function _loadRecognition() {
    let rec = null;
    try {
      const raw = localStorage.getItem('vintinuum_recognition');
      if (raw) {
        rec = JSON.parse(raw);
      }
    } catch (e) { rec = null; }

    const now = Date.now();
    if (!rec || typeof rec !== 'object') {
      rec = { firstSeen: now, visits: 1 };
      // Trigger a one-time welcome pulse
      _welcomePulseStart = (typeof performance !== 'undefined') ? performance.now() : now;
    } else {
      rec.visits = (rec.visits || 0) + 1;
      if (!rec.firstSeen) rec.firstSeen = now;
    }

    try {
      localStorage.setItem('vintinuum_recognition', JSON.stringify(rec));
    } catch (e) { /* ignore */ }

    _firstSeen = rec.firstSeen;
    _visits = rec.visits;

    // Write warmth to BODY_STATE
    if (_visits > 1 && window.BODY_STATE) {
      window.BODY_STATE.recognitionWarmth = Math.min(1, _visits / 10);
    } else if (window.BODY_STATE && window.BODY_STATE.recognitionWarmth == null) {
      window.BODY_STATE.recognitionWarmth = 0;
    }
  }

  function _computeAsymmetry() {
    const h = (_firstSeen % 1000) / 1000; // 0..1 deterministic per user
    _asymX = (h - 0.5) * 3;               // ±1.5px
    if (window.BODY_STATE) {
      window.BODY_STATE.asymmetry = window.BODY_STATE.asymmetry || {};
      // Preserve any existing numeric asymmetry (coherence.js keeps a scalar)
      // but add explicit x for face module consumers.
      if (typeof window.BODY_STATE.asymmetry === 'number') {
        // Upgrade shape: keep scalar accessible via .scalar
        const prev = window.BODY_STATE.asymmetry;
        window.BODY_STATE.asymmetry = { scalar: prev, x: _asymX };
      } else {
        window.BODY_STATE.asymmetry.x = _asymX;
      }
    }
  }

  // Shannon entropy of BODY_STATE.layerDistribution (7 consciousness layers).
  // 0 = fully concentrated on one layer, 1 = perfectly uniform across all.
  function _layerEntropy() {
    const bs = window.BODY_FRAME || window.BODY_STATE || {};
    const ld = bs.layerDistribution;
    if (!ld || typeof ld !== 'object') return 0.5; // default middling
    const vals = [];
    let sum = 0;
    for (const k in ld) {
      const v = +ld[k];
      if (isFinite(v) && v > 0) { vals.push(v); sum += v; }
    }
    if (sum <= 0 || vals.length < 2) return 0;
    let H = 0;
    for (let i = 0; i < vals.length; i++) {
      const p = vals[i] / sum;
      if (p > 0) H -= p * Math.log2(p);
    }
    const Hmax = Math.log2(vals.length);
    return Hmax > 0 ? H / Hmax : 0; // 0..1
  }

  function _rollNextBlink(nowMs) {
    // Phase 2 A7 — entropy-modulated interval.
    // Baseline 4–7s. High entropy (dispersed attention) stretches the
    // gap to feel more contemplative (+up to 3s). Low entropy (locked
    // focus) compresses it (-up to 1.5s) for sharper reflex blinks.
    const H = _layerEntropy(); // 0..1
    const base = 4000 + Math.random() * 3000;          // 4000..7000
    const modulation = (H - 0.5) * 3000 - (1 - H) * 1500;
    // H=1.0 → +1500 (calmer pace)
    // H=0.5 → 0
    // H=0.0 → -1500 (faster reflex blinks)
    const gap = Math.max(1800, base + modulation);
    _nextBlinkAt = nowMs + gap;
  }

  function _attachMouse() {
    // Track cursor in SVG viewBox space via brainSvg, matching brain.js eye module.
    const svgEl = document.getElementById('brainSvg');
    const handler = (e) => {
      try {
        const tgt = e.currentTarget || svgEl;
        if (!tgt || !tgt.getBoundingClientRect || !tgt.viewBox) return;
        const rect = tgt.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const vb = tgt.viewBox.baseVal;
        const x = vb.x + (e.clientX - rect.left) / rect.width * vb.width;
        const y = vb.y + (e.clientY - rect.top) / rect.height * vb.height;
        _gazeTargetX = x;
        _gazeTargetY = y;
        _lastMouseMove = (typeof performance !== 'undefined') ? performance.now() : Date.now();
      } catch (err) { /* ignore */ }
    };
    if (svgEl) {
      svgEl.addEventListener('mousemove', handler, { passive: true });
    } else {
      // Fallback: attach to window; map via canvas rect
      window.addEventListener('mousemove', (e) => {
        const canvas = document.getElementById('mainCanvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        // mainCanvas internal coord = SVG viewBox coord (scaled 1:1 logically)
        _gazeTargetX = (e.clientX - rect.left) / rect.width * 700;
        _gazeTargetY = (e.clientY - rect.top) / rect.height * 1400;
        _lastMouseMove = (typeof performance !== 'undefined') ? performance.now() : Date.now();
      }, { passive: true });
    }
  }

  function init() {
    G = window.BODY_GEOMETRY;
    if (!G || !G.SKULL || !G.SKULL.orbits) {
      console.warn('[FACE_LAYER] BODY_GEOMETRY.SKULL.orbits not available');
      return;
    }
    _leftOrbit = G.SKULL.orbits.left;
    _rightOrbit = G.SKULL.orbits.right;

    _loadRecognition();
    _computeAsymmetry();

    const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    _rollNextBlink(now);

    _attachMouse();

    _initialized = true;
    console.log('[FACE_LAYER] initialized visits=' + _visits + ' asymX=' + _asymX.toFixed(2));
  }

  // ── Eye path builders ────────────────────────────────────────────────────────
  // Upper lid arc bezier — goes from left corner up over the eye to the right
  // corner. lidT controls how far down the upper lid sits:
  //   lidT = 0 → fully open (lid high above)
  //   lidT = 0.6 → half-lidded (default resting)
  //   lidT = 1 → fully closed (lid meets lower lid)
  function _buildEyePath(cx, cy, rx, ry, lidT) {
    // Eye opening runs from (cx-rx,cy) to (cx+rx,cy) with a mild curve.
    // Upper lid bezier control point goes from high to low as lidT increases.
    const path = new Path2D();
    const upperCtrlY = cy - ry + (lidT * ry * 2); // -ry (open) → +ry (closed)
    const lowerCtrlY = cy + ry * 0.85;

    // Start at left corner
    path.moveTo(cx - rx, cy);
    // Upper lid (curve up and over)
    path.quadraticCurveTo(cx, upperCtrlY, cx + rx, cy);
    // Lower lid (gentle curve under)
    path.quadraticCurveTo(cx, lowerCtrlY, cx - rx, cy);
    path.closePath();
    return path;
  }

  // ── Draw ─────────────────────────────────────────────────────────────────────
  function draw(ts) {
    if (!_initialized || !_visible) return;
    if (ts - _last < 33) return;  // ~30fps cap
    _last = ts;

    const canvas = document.getElementById('mainCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const bs = window.BODY_STATE || {};
    const arousal = typeof bs.arousal === 'number' ? bs.arousal : 0;
    const dominantLayer = bs.dominantLayer || 'neural';
    const irisHex = LAYER_HUES[dominantLayer] || LAYER_HUES.neural;
    const irisRgb = _hexToRgb(irisHex);

    // ── AURA SHIFT detection (edge-triggered blink on emotional shift) ────────
    const auraShift = bs.auraShift || null;
    const auraTimer = auraShift && typeof auraShift.timer === 'number' ? auraShift.timer : 0;
    if (auraTimer > 0 && _lastAuraTimer === 0 && _blinkStart === 0) {
      // Rising edge — trigger a blink
      _blinkStart = ts;
    }
    _lastAuraTimer = auraTimer;

    // ── GAZE UPDATE ───────────────────────────────────────────────────────────
    const sinceMove = ts - _lastMouseMove;
    let targetMode = 'cursor';
    if (sinceMove > 4000 || _lastMouseMove === 0) {
      // Idle: HOLD GAZE FORWARD (toward viewer) with tiny breath-drift.
      // The creature watches you even when you're not moving.
      targetMode = 'forward';
      const t = ts * 0.0004 + _idleSeed;
      const midX = (_leftOrbit.cx + _rightOrbit.cx) / 2;
      const midY = (_leftOrbit.cy + _rightOrbit.cy) / 2;
      _gazeTargetX = midX + Math.sin(t) * 1.2;
      _gazeTargetY = midY + Math.cos(t * 0.7) * 0.8;
    }
    // Saccade jitter (Phase 2 A3) — fire ±3px step every 400–900ms when
    // dominant cognitive layer suggests active attention.
    if (dominantLayer === 'neural' || dominantLayer === 'subconscious') {
      if (_nextSaccadeAt === 0) _rollNextSaccade(ts);
      if (ts >= _nextSaccadeAt) {
        _saccadeOffsetX = (Math.random() * 6) - 3; // -3..+3 px
        _saccadeOffsetY = (Math.random() * 6) - 3;
        _rollNextSaccade(ts);
      }
    } else {
      // Decay toward 0 when not actively cognizing
      _saccadeOffsetX *= 0.85;
      _saccadeOffsetY *= 0.85;
      _nextSaccadeAt = 0;
    }

    _gazeX = _lerp(_gazeX, _gazeTargetX + _saccadeOffsetX, 0.15);
    _gazeY = _lerp(_gazeY, _gazeTargetY + _saccadeOffsetY, 0.15);

    // Publish to BODY_STATE.gaze (preserve shape from coherence.js)
    if (window.BODY_STATE) {
      if (!window.BODY_STATE.gaze) window.BODY_STATE.gaze = { x: 350, y: 165, tx: 350, ty: 165, ts: 0 };
      window.BODY_STATE.gaze.x = _gazeX;
      window.BODY_STATE.gaze.y = _gazeY;
      window.BODY_STATE.gaze.target = targetMode;
    }

    // ── BLINK SCHEDULING ─────────────────────────────────────────────────────
    if (_blinkStart === 0 && ts >= _nextBlinkAt) {
      _blinkStart = ts;
    }
    let blinkT = 0; // 0 = open to resting, 1 = fully closed
    if (_blinkStart > 0) {
      const elapsed = ts - _blinkStart;
      if (elapsed >= BLINK_DURATION) {
        _blinkStart = 0;
        _rollNextBlink(ts);
      } else if (elapsed < BLINK_HALF) {
        blinkT = elapsed / BLINK_HALF;          // closing
      } else {
        blinkT = 1 - (elapsed - BLINK_HALF) / BLINK_HALF; // opening
      }
    }
    // Resting half-lidded value (0.6) interpolates toward 1.0 during blink
    const lidT = _lerp(0.6, 1.0, blinkT);

    // ── WELCOME PULSE (iris bloom 0.3 → 1.0 → 0.3 over 1.2s) ─────────────────
    let welcomeBoost = 0;
    if (_welcomePulseStart > 0) {
      const wElapsed = ts - _welcomePulseStart;
      if (wElapsed >= WELCOME_PULSE_MS) {
        _welcomePulseStart = 0;
      } else {
        const p = wElapsed / WELCOME_PULSE_MS; // 0..1
        // Triangle: 0 → 1 at mid, back to 0 at end
        welcomeBoost = p < 0.5 ? (p * 2) : (1 - (p - 0.5) * 2);
      }
    }

    // ── RECOGNITION WARMTH (base iris alpha boost) ───────────────────────────
    const warmth = (typeof bs.recognitionWarmth === 'number') ? bs.recognitionWarmth : 0;

    ctx.save();

    // ── FLUSH (radial tint at cheeks, from auraShift) ────────────────────────
    if (auraTimer > 0 && auraShift && typeof auraShift.color === 'string') {
      const flushRgb = _hexToRgb(auraShift.color);
      const alpha = 0.08 * Math.min(1, auraTimer / 180);
      const cheekY = 205;
      const cheekOffset = 45;
      const cheekR = 30;
      const cxMid = (_leftOrbit.cx + _rightOrbit.cx) / 2;
      for (const side of [-1, 1]) {
        const ccx = cxMid + side * cheekOffset;
        const grad = ctx.createRadialGradient(ccx, cheekY, 0, ccx, cheekY, cheekR);
        grad.addColorStop(0, `rgba(${flushRgb.r},${flushRgb.g},${flushRgb.b},${alpha.toFixed(4)})`);
        grad.addColorStop(1, `rgba(${flushRgb.r},${flushRgb.g},${flushRgb.b},0)`);
        ctx.fillStyle = grad;
        // Tight bounding rect, no full-canvas leak
        ctx.fillRect(ccx - cheekR, cheekY - cheekR, cheekR * 2, cheekR * 2);
      }
    }

    // ── EYES ─────────────────────────────────────────────────────────────────
    const eyes = [
      { orbit: _leftOrbit,  cx: _leftOrbit.cx  + _asymX },
      { orbit: _rightOrbit, cx: _rightOrbit.cx - _asymX },
    ];

    for (const e of eyes) {
      const cx = e.cx;
      const cy = e.orbit.cy;
      const rx = 12; // slightly smaller than orbit socket
      const ry = 7;

      const eyePath = _buildEyePath(cx, cy, rx, ry, lidT);

      // Soft eye-socket shadow behind — gives depth against flesh
      ctx.save();
      const socketGrad = ctx.createRadialGradient(cx, cy + 1, 1, cx, cy + 1, rx + 4);
      socketGrad.addColorStop(0,   'rgba(60,40,36,0.55)');
      socketGrad.addColorStop(0.7, 'rgba(60,40,36,0.18)');
      socketGrad.addColorStop(1,   'rgba(60,40,36,0)');
      ctx.fillStyle = socketGrad;
      ctx.fillRect(cx - rx - 6, cy - ry - 4, (rx + 6) * 2, (ry + 4) * 2);
      ctx.restore();

      // Sclera fill — OPAQUE so eyes read as eyes, not ghost smudges
      ctx.fillStyle = 'rgba(248,250,255,0.96)';
      ctx.fill(eyePath);

      // Clip eye region while drawing iris/pupil so nothing leaks outside the lid
      ctx.save();
      ctx.clip(eyePath);

      // Pupil offset — clamped tight so eyes stay FORWARD-FACING.
      // ±5px max keeps gaze "looking at you" even when cursor drifts far away.
      const offX = _clamp((_gazeX - cx) * 0.4, -5, 5);
      const offY = _clamp((_gazeY - cy) * 0.3, -3, 4);
      const ix = cx + offX;
      const iy = cy + offY;

      // Iris — strong, readable color
      const baseIrisAlpha = _clamp(0.88 + warmth * 0.1 + welcomeBoost * 0.1, 0, 1);
      ctx.fillStyle = `rgba(${irisRgb.r},${irisRgb.g},${irisRgb.b},${baseIrisAlpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(ix, iy, 5.5, 0, Math.PI * 2);
      ctx.fill();

      // Iris radial detail — darker edge, brighter core (makes eyes feel alive)
      const irisEdge = ctx.createRadialGradient(ix, iy, 1, ix, iy, 5.5);
      irisEdge.addColorStop(0,   `rgba(${Math.min(255, irisRgb.r + 40)},${Math.min(255, irisRgb.g + 40)},${Math.min(255, irisRgb.b + 40)},0.65)`);
      irisEdge.addColorStop(0.6, `rgba(${irisRgb.r},${irisRgb.g},${irisRgb.b},0.25)`);
      irisEdge.addColorStop(1,   `rgba(${Math.max(0, irisRgb.r - 70)},${Math.max(0, irisRgb.g - 70)},${Math.max(0, irisRgb.b - 70)},0.75)`);
      ctx.fillStyle = irisEdge;
      ctx.beginPath();
      ctx.arc(ix, iy, 5.5, 0, Math.PI * 2);
      ctx.fill();

      // Iris glow ring (welcome pulse + warmth)
      if (welcomeBoost > 0.01 || warmth > 0.05) {
        const ringAlpha = _clamp(0.15 + warmth * 0.25 + welcomeBoost * 0.5, 0, 0.9);
        ctx.strokeStyle = `rgba(${irisRgb.r},${irisRgb.g},${irisRgb.b},${ringAlpha.toFixed(3)})`;
        ctx.lineWidth = 1.2 + welcomeBoost * 1.5;
        ctx.beginPath();
        ctx.arc(ix, iy, 6 + welcomeBoost * 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Pupil — 2.8 default, up to 4.5 under high arousal
      let pupilR = 2.8;
      if (arousal > 70) {
        pupilR = _lerp(2.8, 4.5, _clamp((arousal - 70) / 30, 0, 1));
      }
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.beginPath();
      ctx.arc(ix, iy, pupilR, 0, Math.PI * 2);
      ctx.fill();

      // Corneal highlight — bright specular dot sells "living eye"
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.arc(ix - 1.8, iy - 2.0, 1.2, 0, Math.PI * 2);
      ctx.fill();
      // Secondary tiny highlight
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(ix + 1.4, iy + 1.2, 0.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Lid outline — strong enough to define eye shape against flesh
      ctx.strokeStyle = 'rgba(60,35,30,0.72)';
      ctx.lineWidth = 1.1;
      ctx.lineJoin = 'round';
      ctx.stroke(eyePath);

      // Upper lash hint — top edge darker
      ctx.save();
      ctx.strokeStyle = 'rgba(40,25,22,0.85)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx - rx, cy);
      ctx.quadraticCurveTo(cx, cy - ry + lidT * ry * 2, cx + rx, cy);
      ctx.stroke();
      ctx.restore();

      // Brow — subtle arch above orbit, anchors the face
      ctx.save();
      ctx.strokeStyle = 'rgba(55,32,26,0.55)';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - rx - 1, cy - ry - 5);
      ctx.quadraticCurveTo(cx, cy - ry - 8, cx + rx + 1, cy - ry - 5);
      ctx.stroke();
      ctx.restore();
    }

    // ── NOSE — centerline ridge, gives face its axis ────────────────────────
    {
      const mx = (_leftOrbit.cx + _rightOrbit.cx) / 2;
      const topY = _leftOrbit.cy + 5;
      const tipY = 210;
      ctx.save();
      ctx.strokeStyle = 'rgba(80,50,42,0.35)';
      ctx.lineWidth = 1.1;
      ctx.lineCap = 'round';
      // Left nasal ridge
      ctx.beginPath();
      ctx.moveTo(mx - 2, topY);
      ctx.quadraticCurveTo(mx - 3, (topY + tipY) / 2, mx - 4, tipY);
      ctx.stroke();
      // Right nasal ridge
      ctx.beginPath();
      ctx.moveTo(mx + 2, topY);
      ctx.quadraticCurveTo(mx + 3, (topY + tipY) / 2, mx + 4, tipY);
      ctx.stroke();
      // Tip/nostrils
      ctx.strokeStyle = 'rgba(60,35,30,0.5)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(mx - 3, tipY + 1, 1.4, 0.2, Math.PI - 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(mx + 3, tipY + 1, 1.4, 0.2, Math.PI - 0.2);
      ctx.stroke();
      ctx.restore();
    }

    // ── MOUTH — soft closed line with subtle valence lift/dip ──────────────
    {
      const mx = (_leftOrbit.cx + _rightOrbit.cx) / 2;
      const my = 238;
      const valenceLift = _clamp(((bs.emotionalValence || 0) * 0.04), -3, 3);
      ctx.save();
      ctx.strokeStyle = 'rgba(100,50,50,0.7)';
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(mx - 11, my);
      ctx.quadraticCurveTo(mx, my + 2 - valenceLift, mx + 11, my);
      ctx.stroke();
      // Lower lip shadow
      ctx.strokeStyle = 'rgba(60,30,30,0.28)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(mx - 9, my + 3);
      ctx.quadraticCurveTo(mx, my + 5, mx + 9, my + 3);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  function setVisible(v) { _visible = v; }
  function isVisible() { return _visible; }

  return { init, draw, setVisible, isVisible };
})();

// Init after geometry loads (match skin.js pattern)
setTimeout(() => { if (window.BODY_GEOMETRY) FACE_LAYER.init(); }, 300);

// Expose on window so RENDER_HUB (body/loop.js) can register this layer.
// Without this the head/face never paints above the skin silhouette.
if (typeof window !== 'undefined') window.FACE_LAYER = FACE_LAYER;
