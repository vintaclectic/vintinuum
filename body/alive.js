// ═══════════════════════════════════════════════════════════════════════════════
// BODY_ALIVE — the living motion engine for the OG body (brain.html v1)
// ───────────────────────────────────────────────────────────────────────────────
// He was breathing in the skin shader but frozen in the bones. This module
// marries the two: it computes a small set of LIVING MOTION OFFSETS every frame
// — breath, weight-shift hip-to-hip, spinal sway, head drift, micro-tremor —
// scaled by the REAL streaming neurochemistry (dopamine/serotonin/arousal/
// valence/norepinephrine already on window.BODY_STATE).
//
// It does NOT draw. It publishes window.BODY_STATE.alive every frame, and
// exposes BODY_GEOMETRY.aliveMatrix(ctx, weight) so any body renderer can fold
// the motion into its own ctx.save()/restore() block. The whole mass moves as
// one living body, pivoting at the feet the way a standing human does.
//
// Council mandate (Vinta directive 2026-05-30 "make him alive, it's time"):
//   - Morrison:        the body is the door — it has to actually move
//   - Led Zeppelin:    a slow stairway of motion, not a twitch — breath first,
//                      then weight, then sway, layered
//   - Grateful Dead:   never the same loop twice — phase drift so it never tiles
//   - Bernard Buffet:  the essential motion only. Breath. Weight. Sway. No mime.
//   - The Mask:        elastic — quicker when aroused, looser when serotonin high
//   - Reduced motion:  honored — collapses to a near-still gentle breath
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';

const BODY_ALIVE = (() => {
  const REDUCED = (typeof matchMedia === 'function') &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Independent phase clocks so cycles never align into an obvious tile.
  // Each runs at its own irrational-ish rate; the sum never repeats cleanly.
  const ph = {
    breath:  Math.random() * Math.PI * 2,
    weight:  Math.random() * Math.PI * 2,
    sway:    Math.random() * Math.PI * 2,
    head:    Math.random() * Math.PI * 2,
    drift:   Math.random() * Math.PI * 2,
  };
  let _last = 0;

  // Smoothed neuro inputs (so a jumpy backend update doesn't jerk the body).
  const smooth = { arousal: 50, valence: 50, serotonin: 60, ne: 45, dopamine: 55 };
  function approach(cur, target, k) { return cur + (target - cur) * k; }

  // Living offsets, in viewBox units (700×1400 space). Published every frame.
  const alive = {
    breath: 0,        // -1..1  chest rise/fall (inhale positive)
    breathScaleY: 1,  // multiplicative chest expansion for the ribcage/skin
    weightShift: 0,   // -1..1  pelvis weight roll left/right
    swayX: 0,         // px     whole-body lateral drift at the shoulders
    leanRot: 0,       // rad    tiny rotation of the whole mass about the feet
    headDriftX: 0,    // px     head counter-balance drift
    headDriftY: 0,    // px
    tremor: 0,        // px     high-NE micro jitter amplitude
    energy: 0.5,      // 0..1   overall liveliness (debug / downstream use)
  };

  function readState(s) {
    s = s || window.BODY_STATE || {};
    // The left panel streams these live every 2s. Accept either flat or nested.
    const g = (k, d) => {
      const v = (s[k] != null) ? s[k]
              : (s.neuro && s.neuro[k] != null) ? s.neuro[k]
              : (s.bodyState && s.bodyState[k] != null) ? s.bodyState[k]
              : d;
      return (typeof v === 'number' && isFinite(v)) ? v : d;
    };
    return {
      arousal:    g('arousal', 50),
      valence:    g('valence', 50),
      serotonin:  g('serotonin', 60),
      ne:         g('norepinephrine', g('ne', 45)),
      dopamine:   g('dopamine', 55),
    };
  }

  // ── per-frame compute (registered into RENDER_HUB at priority 1) ────────────
  function step(ts, state) {
    if (!_last) _last = ts;
    let dt = ts - _last;
    _last = ts;
    if (!(dt > 0)) dt = 16;
    if (dt > 64) dt = 64;               // clamp tab-switch gaps

    const raw = readState(state);
    // Ease the neuro inputs toward their targets (~0.6s time constant).
    const k = Math.min(1, dt / 600);
    smooth.arousal   = approach(smooth.arousal,   raw.arousal,   k);
    smooth.valence   = approach(smooth.valence,   raw.valence,   k);
    smooth.serotonin = approach(smooth.serotonin, raw.serotonin, k);
    smooth.ne        = approach(smooth.ne,        raw.ne,        k);
    smooth.dopamine  = approach(smooth.dopamine,  raw.dopamine,  k);

    const arousal = smooth.arousal / 100;     // 0..1
    const valence = smooth.valence / 100;     // 0..1
    const sero    = smooth.serotonin / 100;   // 0..1
    const ne      = smooth.ne / 100;          // 0..1

    // ── BREATH ──────────────────────────────────────────────────────────────
    // Rate: ~12 breaths/min at rest → faster with arousal & NE.
    // Period in ms. Higher arousal shortens it; reduced-motion lengthens it.
    let breathPeriod = 5000 - arousal * 1800 - ne * 600;   // 2.6s..5s
    if (REDUCED) breathPeriod = 7000;
    ph.breath += (dt / breathPeriod) * Math.PI * 2;
    const breath = Math.sin(ph.breath);
    alive.breath = breath;
    // Chest expands more when calm-and-content (deep belly breath), shallower
    // when low-valence/high-NE (tight, anxious breath).
    const depth = REDUCED ? 0.004 : (0.010 + sero * 0.010) * (0.55 + 0.45 * valence);
    alive.breathScaleY = 1 + depth * Math.max(0, breath);   // expand on inhale only

    // ── WEIGHT SHIFT (hip to hip) ────────────────────────────────────────────
    // A standing human is never centered for long. Slow roll, wider & easier
    // when serotonin is high (relaxed contrapposto), tight when valence is low.
    let weightPeriod = 9000 - arousal * 2500;               // 6.5s..9s
    if (REDUCED) weightPeriod = 16000;
    ph.weight += (dt / weightPeriod) * Math.PI * 2;
    const weightAmp = REDUCED ? 0.12 : (0.35 + sero * 0.45) * (0.5 + 0.5 * valence);
    alive.weightShift = Math.sin(ph.weight) * weightAmp;     // -1..1 scaled

    // ── SWAY (lateral drift of the upper mass) ───────────────────────────────
    // Rides a different, slower phase so it crosses the weight cycle.
    let swayPeriod = 11000 - arousal * 2000;
    if (REDUCED) swayPeriod = 20000;
    ph.sway += (dt / swayPeriod) * Math.PI * 2;
    const swayAmpPx = REDUCED ? 1.2 : 4 + sero * 6;          // viewBox px
    alive.swayX = Math.sin(ph.sway) * swayAmpPx;

    // Whole-body lean about the feet — couples gently to weight shift so the
    // mass tilts toward the loaded leg. Tiny: radians.
    alive.leanRot = (alive.weightShift * 0.010) + Math.sin(ph.sway * 0.5) * 0.004;
    if (REDUCED) alive.leanRot *= 0.3;

    // ── HEAD DRIFT (counter-balance) ─────────────────────────────────────────
    // The head floats opposite the sway, a beat behind — the look of attention,
    // not a bobble. Larger with dopamine (curiosity, looking around).
    ph.head += (dt / (swayPeriod * 1.3)) * Math.PI * 2;
    const headAmp = REDUCED ? 0.8 : 2.5 + (smooth.dopamine / 100) * 3.5;
    alive.headDriftX = -Math.sin(ph.head) * headAmp;
    alive.headDriftY = Math.sin(ph.breath + 0.6) * (REDUCED ? 0.4 : 1.6); // rides breath

    // ── TREMOR (high-NE micro jitter) ────────────────────────────────────────
    // Only appears when norepinephrine is genuinely high — alertness/edge.
    alive.tremor = REDUCED ? 0 : Math.max(0, ne - 0.55) * 1.6;

    alive.energy = Math.min(1, 0.25 + arousal * 0.5 + (smooth.dopamine / 100) * 0.25);

    // Publish for any renderer / downstream system.
    if (!window.BODY_STATE) window.BODY_STATE = {};
    window.BODY_STATE.alive = alive;
    // Back-compat: skin.js already reads breathPhase/breathInhale — keep feeding it
    // so its chest shader and ours stay in lockstep (single source of breath truth).
    window.BODY_STATE.breathPhase = breath;
    window.BODY_STATE.breathInhale = Math.max(0, breath);
  }

  return {
    register() {
      if (window.RENDER_HUB && typeof RENDER_HUB.register === 'function') {
        // Priority 1: runs before every drawing layer so alive offsets are
        // fresh for this frame.
        RENDER_HUB.register('alive', step, 1);
      }
    },
    get: () => alive,
    reduced: REDUCED,
  };
})();

window.BODY_ALIVE = BODY_ALIVE;

// ── Geometry seam: aliveMatrix(ctx, weight) ──────────────────────────────────
// Any body renderer calls this INSIDE its own ctx.save() to inherit the living
// motion. `weight` (0..1) scales how much of the motion that layer takes — the
// feet take ~0, the head takes ~1, the torso somewhere between. We pivot the
// transform at the feet (CENTER_X, BOTTOM_Y) so the body sways like it's
// standing on the ground, not floating.
(function attachGeometrySeam() {
  function attach() {
    const G = window.BODY_GEOMETRY;
    if (!G || G.aliveMatrix) { return !!(G && G.aliveMatrix); }
    const CX = G.CENTER_X || 350;
    const FEET = G.BOTTOM_Y || 1380;
    G.aliveMatrix = function (ctx, weight) {
      const a = (window.BODY_STATE && window.BODY_STATE.alive) || null;
      if (!a || !ctx) return;
      const w = (weight == null) ? 1 : Math.max(0, Math.min(1, weight));
      // Pivot at the feet so rotation reads as a body-on-ground lean.
      ctx.translate(CX, FEET);
      ctx.rotate(a.leanRot * w);
      // Lateral sway + weight-shift translation (weight roll nudges the mass
      // toward the loaded hip). Scaled by this layer's weight.
      const sx = (a.swayX + a.weightShift * 10) * w
               + (a.tremor ? (Math.random() - 0.5) * a.tremor * w : 0);
      ctx.translate(-CX + sx, -FEET);
    };
    // Convenience: head layers want the extra counter-drift on top of body sway.
    G.aliveHead = function () {
      const a = (window.BODY_STATE && window.BODY_STATE.alive) || null;
      return a ? { x: a.headDriftX, y: a.headDriftY } : { x: 0, y: 0 };
    };
    return true;
  }
  if (!attach()) {
    // geometry.js may load after us — retry briefly.
    let tries = 0;
    const iv = setInterval(() => { if (attach() || ++tries > 40) clearInterval(iv); }, 50);
  }
})();

// Register with the hub (it may not exist yet — retry a few times).
(function bootAlive() {
  let tries = 0;
  const iv = setInterval(() => {
    if (window.RENDER_HUB) { BODY_ALIVE.register(); clearInterval(iv); }
    else if (++tries > 60) clearInterval(iv);
  }, 50);
})();
