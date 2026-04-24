// ═══════════════════════════════════════════════════════════════════════════════
// SKIN — outermost body layer (rewritten: real flesh, peelable)
//
// Design contract: the DEFAULT view must read as a human being. Skin is opaque,
// skin-toned, with real volumetric shading. Peel system fades skin from 1.0 →
// 0.0 alpha via BODY_STATE.peelVisible.skin and BODY_STATE.skinPeelAmount
// (0..1 continuous). When peeled, muscles/skeleton/organs underneath show
// through as they were always drawn — we just reveal them.
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';

const SKIN_LAYER = (() => {
  let _last = 0;
  let _initialized = false;
  let _visible = true;
  let G = null;
  let _bodyPath = null;

  const TONE = {
    shadow:    { r: 122, g:  90, b:  74 },
    base:      { r: 201, g: 160, b: 138 },
    highlight: { r: 232, g: 197, b: 173 },
    flush:     { r: 240, g: 160, b: 130 },
  };

  function init() {
    G = window.BODY_GEOMETRY;
    if (!G) { console.warn('[SKIN_LAYER] BODY_GEOMETRY not loaded'); return; }
    _buildPath();
    _initialized = true;
    console.log('[SKIN_LAYER] initialized — opaque peelable flesh');
  }

  function _buildPath() {
    if (!G || !G.SILHOUETTE) return;
    _bodyPath = new Path2D();
    const pts = G.SILHOUETTE;
    if (pts.length < 3) return;
    _bodyPath.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[(i - 1 + pts.length) % pts.length];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      const p3 = pts[(i + 2) % pts.length];
      const cpx1 = p1.x + (p2.x - p0.x) / 6;
      const cpy1 = p1.y + (p2.y - p0.y) / 6;
      const cpx2 = p2.x - (p3.x - p1.x) / 6;
      const cpy2 = p2.y - (p3.y - p1.y) / 6;
      _bodyPath.bezierCurveTo(cpx1, cpy1, cpx2, cpy2, p2.x, p2.y);
    }
    _bodyPath.closePath();
  }

  let _peelAmt = 1.0;
  function _targetPeel() {
    const bs = window.BODY_STATE;
    if (!bs) return 1.0;
    if (typeof bs.skinPeelAmount === 'number') {
      return Math.max(0, Math.min(1, bs.skinPeelAmount));
    }
    if (bs.peelVisible && bs.peelVisible.skin === false) return 0.0;
    return 1.0;
  }

  function draw(ts) {
    if (!_initialized || !_bodyPath) return;
    if (ts - _last < 33) return;
    _last = ts;

    const target = _targetPeel();
    _peelAmt += (target - _peelAmt) * 0.08;
    if (_peelAmt < 0.01 && target === 0) return;
    if (!_visible && _peelAmt < 0.01) return;

    const canvas = document.getElementById('mainCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const bs = window.BODY_FRAME || window.BODY_STATE || {};
    const valence = bs.emotionalValence || 0;
    const pp = typeof bs.pulsePhase === 'number' ? bs.pulsePhase : 0.5;
    const systole = pp < 0.25 ? (1 - pp / 0.25) : 0;
    const breathPhase = Math.sin(ts * 0.0008);
    const inhale = Math.max(0, breathPhase);

    if (window.BODY_STATE) {
      window.BODY_STATE.breathPhase  = breathPhase;
      window.BODY_STATE.breathInhale = inhale;
    }

    ctx.save();
    const skinAlpha = _peelAmt;

    // 1. BASE FLESH FILL — OPAQUE
    const warm = Math.max(0, valence);
    const cool = Math.max(0, -valence);
    const baseR = TONE.base.r + warm * 12 - cool * 6;
    const baseG = TONE.base.g - warm * 2  - cool * 3;
    const baseB = TONE.base.b - warm * 8  + cool * 8;
    ctx.fillStyle = 'rgba(' + Math.round(baseR) + ',' + Math.round(baseG) + ',' +
                    Math.round(baseB) + ',' + (0.94 * skinAlpha).toFixed(3) + ')';
    ctx.fill(_bodyPath);

    // 2. TOP-LIT VOLUMETRIC SHADING
    ctx.save();
    ctx.clip(_bodyPath);
    const shadeGrad = ctx.createLinearGradient(G.CENTER_X - 200, 100, G.CENTER_X + 200, 1400);
    shadeGrad.addColorStop(0,    'rgba(' + TONE.highlight.r + ',' + TONE.highlight.g + ',' + TONE.highlight.b + ',' + (0.35 * skinAlpha).toFixed(3) + ')');
    shadeGrad.addColorStop(0.45, 'rgba(' + TONE.base.r + ',' + TONE.base.g + ',' + TONE.base.b + ', 0)');
    shadeGrad.addColorStop(1,    'rgba(' + TONE.shadow.r + ',' + TONE.shadow.g + ',' + TONE.shadow.b + ',' + (0.55 * skinAlpha).toFixed(3) + ')');
    ctx.fillStyle = shadeGrad;
    ctx.fillRect(0, 0, 700, 1400);
    ctx.restore();

    // 3. CENTERLINE/SIDE SHADOW — cylindrical volume
    ctx.save();
    ctx.clip(_bodyPath);
    const sideGrad = ctx.createLinearGradient(G.CENTER_X - 180, 0, G.CENTER_X + 180, 0);
    sideGrad.addColorStop(0,    'rgba(' + TONE.shadow.r + ',' + TONE.shadow.g + ',' + TONE.shadow.b + ',' + (0.32 * skinAlpha).toFixed(3) + ')');
    sideGrad.addColorStop(0.3,  'rgba(0,0,0,0)');
    sideGrad.addColorStop(0.7,  'rgba(0,0,0,0)');
    sideGrad.addColorStop(1,    'rgba(' + TONE.shadow.r + ',' + TONE.shadow.g + ',' + TONE.shadow.b + ',' + (0.32 * skinAlpha).toFixed(3) + ')');
    ctx.fillStyle = sideGrad;
    ctx.fillRect(0, 0, 700, 1400);
    ctx.restore();

    // 4. HEARTBEAT FLUSH
    if (systole > 0.05) {
      ctx.save();
      ctx.clip(_bodyPath);
      const chestGrad = ctx.createRadialGradient(G.CENTER_X, 460, 0, G.CENTER_X, 460, 180);
      chestGrad.addColorStop(0, 'rgba(' + TONE.flush.r + ',' + TONE.flush.g + ',' + TONE.flush.b + ',' + (0.22 * systole * skinAlpha).toFixed(3) + ')');
      chestGrad.addColorStop(1, 'rgba(' + TONE.flush.r + ',' + TONE.flush.g + ',' + TONE.flush.b + ', 0)');
      ctx.fillStyle = chestGrad;
      ctx.fillRect(G.CENTER_X - 180, 280, 360, 360);

      const cheekGrad = ctx.createRadialGradient(G.CENTER_X, 240, 0, G.CENTER_X, 240, 90);
      cheekGrad.addColorStop(0, 'rgba(' + TONE.flush.r + ',' + TONE.flush.g + ',' + TONE.flush.b + ',' + (0.18 * systole * skinAlpha).toFixed(3) + ')');
      cheekGrad.addColorStop(1, 'rgba(' + TONE.flush.r + ',' + TONE.flush.g + ',' + TONE.flush.b + ', 0)');
      ctx.fillStyle = cheekGrad;
      ctx.fillRect(G.CENTER_X - 90, 190, 180, 100);
      ctx.restore();
    }

    // 5. SILHOUETTE OUTLINE
    ctx.strokeStyle = 'rgba(' + (TONE.shadow.r - 20) + ',' + (TONE.shadow.g - 20) + ',' + (TONE.shadow.b - 20) + ',' + (0.8 * skinAlpha).toFixed(3) + ')';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke(_bodyPath);

    // 6. SOFT AURA (only near full opacity)
    if (skinAlpha > 0.7) {
      ctx.strokeStyle = 'rgba(120, 180, 230, ' + (0.04 * (skinAlpha - 0.7) / 0.3).toFixed(3) + ')';
      ctx.lineWidth = 8;
      ctx.stroke(_bodyPath);
    }

    // 7. CHEST BREATHING
    if (inhale > 0.02 && skinAlpha > 0.5) {
      const thoracicCy = 430;
      const scaleY = 1 + 0.012 * inhale;
      ctx.save();
      ctx.translate(0, thoracicCy);
      ctx.scale(1, scaleY);
      ctx.translate(0, -thoracicCy);
      ctx.strokeStyle = 'rgba(' + TONE.highlight.r + ',' + TONE.highlight.g + ',' + TONE.highlight.b + ',' + (0.25 * inhale * skinAlpha).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(G.CENTER_X, thoracicCy, 108, 90, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  function setVisible(v) { _visible = !!v; }
  function isVisible()   { return _visible; }
  function setPeel(amt) {
    amt = Math.max(0, Math.min(1, amt));
    if (!window.BODY_STATE) window.BODY_STATE = {};
    window.BODY_STATE.skinPeelAmount = amt;
  }
  function getPeel() { return _peelAmt; }

  return { init, draw, setVisible, isVisible, setPeel, getPeel };
})();

setTimeout(() => { if (window.BODY_GEOMETRY) SKIN_LAYER.init(); }, 300);
if (typeof window !== 'undefined') window.SKIN_LAYER = SKIN_LAYER;
