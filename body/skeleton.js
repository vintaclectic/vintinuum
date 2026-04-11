// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON — draws the skeletal system on mainCanvas
// Renders: skull, spine, ribcage, pelvis, clavicles, scapulae, limb bones
// Uses BODY_GEOMETRY for all coordinates (700×1400 viewBox space)
// Performance budget: ~1.2ms per frame
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';

const SKELETON = (() => {
  const BONE_COLOR = 'rgba(220, 225, 235, ';  // Base bone color (append alpha + ')')
  const JOINT_COLOR = 'rgba(180, 200, 230, ';
  const MARROW_GLOW = 'rgba(255, 220, 180, ';
  let _last = 0;
  let _pulsePhase = 0;
  let _initialized = false;
  let _visible = true;

  // Cache geometry reference
  let G = null;

  function init() {
    G = window.BODY_GEOMETRY;
    if (!G) {
      console.warn('[SKELETON] BODY_GEOMETRY not loaded');
      return;
    }
    _initialized = true;
    console.log('[SKELETON] initialized');
  }

  // ── DRAWING HELPERS ─────────────────────────────────────────────────────────

  function drawBone(ctx, x1, y1, x2, y2, width, alpha) {
    ctx.strokeStyle = BONE_COLOR + alpha + ')';
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function drawJoint(ctx, x, y, radius, alpha) {
    ctx.fillStyle = JOINT_COLOR + alpha + ')';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCurvedBone(ctx, points, width, alpha) {
    if (points.length < 2) return;
    ctx.strokeStyle = BONE_COLOR + alpha + ')';
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      if (points[i].cpx !== undefined) {
        ctx.quadraticCurveTo(points[i].cpx, points[i].cpy, points[i].x, points[i].y);
      } else {
        ctx.lineTo(points[i].x, points[i].y);
      }
    }
    ctx.stroke();
  }

  // ── SKULL ───────────────────────────────────────────────────────────────────

  function drawSkull(ctx, alpha, pulse) {
    const S = G.SKULL;
    const glow = 0.02 + pulse * 0.015;

    // Cranium outline
    ctx.strokeStyle = BONE_COLOR + (alpha * 0.7) + ')';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(S.cx, S.cy - 10, S.craniumRx, S.craniumRy, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Subtle inner glow (marrow/living bone)
    ctx.strokeStyle = MARROW_GLOW + glow + ')';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(S.cx, S.cy - 10, S.craniumRx - 4, S.craniumRy - 4, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Eye orbits
    ctx.strokeStyle = BONE_COLOR + (alpha * 0.5) + ')';
    ctx.lineWidth = 1.5;
    [S.orbits.left, S.orbits.right].forEach(o => {
      ctx.beginPath();
      ctx.ellipse(o.cx, o.cy, o.rx, o.ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Nasal bridge
    ctx.strokeStyle = BONE_COLOR + (alpha * 0.4) + ')';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(S.nasalBridge.x, S.nasalBridge.topY);
    ctx.lineTo(S.nasalBridge.x - 5, S.nasalBridge.bottomY);
    ctx.moveTo(S.nasalBridge.x, S.nasalBridge.topY);
    ctx.lineTo(S.nasalBridge.x + 5, S.nasalBridge.bottomY);
    ctx.stroke();

    // Mandible (jaw)
    ctx.strokeStyle = BONE_COLOR + (alpha * 0.5) + ')';
    ctx.lineWidth = 2;
    const M = S.mandible;
    ctx.beginPath();
    ctx.moveTo(M.leftAngle.x, M.leftAngle.y);
    ctx.quadraticCurveTo(M.cx - 30, M.y + 15, M.chin.x, M.chin.y);
    ctx.quadraticCurveTo(M.cx + 30, M.y + 15, M.rightAngle.x, M.rightAngle.y);
    ctx.stroke();

    // Temporal bones (sides)
    ctx.strokeStyle = BONE_COLOR + (alpha * 0.3) + ')';
    ctx.lineWidth = 1.5;
    [S.temporalBone.left, S.temporalBone.right].forEach(t => {
      ctx.beginPath();
      ctx.arc(t.x, t.y, 8, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  // ── SPINE ───────────────────────────────────────────────────────────────────

  function drawSpine(ctx, alpha, pulse, ts) {
    const SP = G.SPINE;
    const allVerts = [...SP.cervical, ...SP.thoracic, ...SP.lumbar];

    // Main spinal column (slightly curved line)
    ctx.strokeStyle = BONE_COLOR + (alpha * 0.5) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(SP.cx, allVerts[0].y - 5);
    for (const v of allVerts) {
      // Slight S-curve
      const sway = Math.sin(v.y * 0.008) * 3;
      ctx.lineTo(SP.cx + sway, v.y);
    }
    ctx.stroke();

    // Individual vertebrae
    allVerts.forEach((v, i) => {
      const phaseOff = i * 0.15;
      const breathPulse = Math.sin(ts * 0.001 + phaseOff) * 0.03;
      const vAlpha = alpha * 0.35 + breathPulse;
      const sway = Math.sin(v.y * 0.008) * 3;

      // Vertebral body (rounded rect approximation)
      ctx.fillStyle = BONE_COLOR + vAlpha + ')';
      ctx.beginPath();
      ctx.ellipse(SP.cx + sway, v.y, v.w / 2, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Transverse processes (side wings)
      ctx.strokeStyle = BONE_COLOR + (vAlpha * 0.6) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(SP.cx + sway - v.w / 2, v.y);
      ctx.lineTo(SP.cx + sway - v.w, v.y - 2);
      ctx.moveTo(SP.cx + sway + v.w / 2, v.y);
      ctx.lineTo(SP.cx + sway + v.w, v.y - 2);
      ctx.stroke();

      // Spinous process (backward projection — toward viewer in this anterior view)
      ctx.fillStyle = BONE_COLOR + (vAlpha * 0.3) + ')';
      ctx.beginPath();
      ctx.arc(SP.cx + sway, v.y - 6, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Intervertebral discs (gaps between vertebrae)
    ctx.fillStyle = 'rgba(100, 160, 220, ' + (alpha * 0.08) + ')';
    for (let i = 0; i < allVerts.length - 1; i++) {
      const midY = (allVerts[i].y + allVerts[i + 1].y) / 2;
      const sway = Math.sin(midY * 0.008) * 3;
      ctx.beginPath();
      ctx.ellipse(SP.cx + sway, midY, 6, 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sacrum
    const sac = SP.sacrum;
    ctx.fillStyle = BONE_COLOR + (alpha * 0.3) + ')';
    ctx.beginPath();
    ctx.moveTo(SP.cx - sac.w / 2, sac.y);
    ctx.lineTo(SP.cx + sac.w / 2, sac.y);
    ctx.lineTo(SP.cx + sac.w / 3, sac.y + sac.h);
    ctx.lineTo(SP.cx - sac.w / 3, sac.y + sac.h);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = BONE_COLOR + (alpha * 0.4) + ')';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Sacral foramina (nerve exit holes)
    for (let i = 0; i < 4; i++) {
      const fy = sac.y + 8 + i * 10;
      const fw = sac.w / 2 - i * 2;
      ctx.fillStyle = 'rgba(80, 120, 180, ' + (alpha * 0.1) + ')';
      ctx.beginPath(); ctx.arc(SP.cx - fw / 2, fy, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(SP.cx + fw / 2, fy, 2, 0, Math.PI * 2); ctx.fill();
    }

    // Coccyx
    const cox = SP.coccyx;
    ctx.strokeStyle = BONE_COLOR + (alpha * 0.25) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(SP.cx, sac.y + sac.h);
    ctx.lineTo(SP.cx, cox.y + cox.h);
    ctx.stroke();
  }

  // ── RIBCAGE ─────────────────────────────────────────────────────────────────

  function drawRibs(ctx, alpha, ts) {
    const R = G.RIBS;

    // Sternum
    ctx.strokeStyle = BONE_COLOR + (alpha * 0.5) + ')';
    ctx.lineWidth = R.sternum.width / 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(R.cx, R.sternum.top);
    ctx.lineTo(R.cx, R.sternum.bottom);
    ctx.stroke();

    // Xiphoid process (bottom of sternum)
    ctx.strokeStyle = BONE_COLOR + (alpha * 0.3) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(R.cx, R.sternum.bottom);
    ctx.lineTo(R.cx, R.sternum.bottom + 15);
    ctx.stroke();

    // Rib pairs — draw with breathing animation
    const breathPhase = Math.sin(ts * 0.0008) * 0.02;  // Very subtle breathing

    R.pairs.forEach((rib, i) => {
      const ribAlpha = alpha * (0.25 + (1 - i / 12) * 0.2) + breathPhase;
      const expand = 1 + breathPhase * (i < 7 ? 1 : 0.5);  // Upper ribs expand more
      const w = rib.w * expand;
      const curveH = rib.curve * w;

      // Right rib
      ctx.strokeStyle = BONE_COLOR + ribAlpha + ')';
      ctx.lineWidth = 1.8 - i * 0.06;
      ctx.beginPath();
      ctx.moveTo(R.cx + 8, rib.y);
      ctx.quadraticCurveTo(R.cx + w * 0.6, rib.y - curveH, R.cx + w, rib.y + curveH * 0.3);
      // Curve back to spine attachment
      ctx.quadraticCurveTo(R.cx + w + 5, rib.y + curveH * 0.6, G.SPINE.cx + 15, rib.y + 2);
      ctx.stroke();

      // Left rib (mirror)
      ctx.beginPath();
      ctx.moveTo(R.cx - 8, rib.y);
      ctx.quadraticCurveTo(R.cx - w * 0.6, rib.y - curveH, R.cx - w, rib.y + curveH * 0.3);
      ctx.quadraticCurveTo(R.cx - w - 5, rib.y + curveH * 0.6, G.SPINE.cx - 15, rib.y + 2);
      ctx.stroke();

      // Costal cartilage (connects ribs 1-7 to sternum) — softer color
      if (i < 7) {
        ctx.strokeStyle = 'rgba(160, 190, 220, ' + (ribAlpha * 0.4) + ')';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 2]);
        // Right
        ctx.beginPath();
        ctx.moveTo(R.cx + 8, rib.y);
        ctx.lineTo(R.cx + w * 0.3, rib.y + 5);
        ctx.stroke();
        // Left
        ctx.beginPath();
        ctx.moveTo(R.cx - 8, rib.y);
        ctx.lineTo(R.cx - w * 0.3, rib.y + 5);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }

  // ── PELVIS ──────────────────────────────────────────────────────────────────

  function drawPelvis(ctx, alpha) {
    const P = G.PELVIS;

    // Iliac crests (butterfly wings of pelvis)
    ctx.strokeStyle = BONE_COLOR + (alpha * 0.4) + ')';
    ctx.lineWidth = 2.5;

    // Right ilium
    ctx.beginPath();
    ctx.moveTo(P.cx + 10, P.top + 20);
    ctx.quadraticCurveTo(P.cx + 80, P.top - 10, P.cx + P.width, P.top + 15);
    ctx.quadraticCurveTo(P.cx + P.width + 10, P.top + 60, P.acetabulum.right.x, P.acetabulum.right.y);
    ctx.stroke();

    // Left ilium
    ctx.beginPath();
    ctx.moveTo(P.cx - 10, P.top + 20);
    ctx.quadraticCurveTo(P.cx - 80, P.top - 10, P.cx - P.width, P.top + 15);
    ctx.quadraticCurveTo(P.cx - P.width - 10, P.top + 60, P.acetabulum.left.x, P.acetabulum.left.y);
    ctx.stroke();

    // Hip sockets (acetabulum)
    ctx.strokeStyle = BONE_COLOR + (alpha * 0.35) + ')';
    ctx.lineWidth = 2;
    [P.acetabulum.left, P.acetabulum.right].forEach(a => {
      ctx.beginPath();
      ctx.arc(a.x, a.y, 14, 0, Math.PI * 2);
      ctx.stroke();
      // Inner ring
      ctx.strokeStyle = JOINT_COLOR + (alpha * 0.2) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 8, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Pubic symphysis
    ctx.fillStyle = BONE_COLOR + (alpha * 0.25) + ')';
    ctx.beginPath();
    ctx.arc(P.pubicSymphysis.x, P.pubicSymphysis.y, 6, 0, Math.PI * 2);
    ctx.fill();

    // Pubic rami (connecting hip sockets to pubic symphysis)
    ctx.strokeStyle = BONE_COLOR + (alpha * 0.3) + ')';
    ctx.lineWidth = 2;
    // Right
    ctx.beginPath();
    ctx.moveTo(P.acetabulum.right.x - 10, P.acetabulum.right.y + 8);
    ctx.quadraticCurveTo(P.cx + 40, P.pubicSymphysis.y - 5, P.pubicSymphysis.x, P.pubicSymphysis.y);
    ctx.stroke();
    // Left
    ctx.beginPath();
    ctx.moveTo(P.acetabulum.left.x + 10, P.acetabulum.left.y + 8);
    ctx.quadraticCurveTo(P.cx - 40, P.pubicSymphysis.y - 5, P.pubicSymphysis.x, P.pubicSymphysis.y);
    ctx.stroke();

    // Obturator foramina (large holes in pelvis)
    ctx.strokeStyle = BONE_COLOR + (alpha * 0.15) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(P.cx + 55, P.pubicSymphysis.y - 15, 18, 12, 0.2, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(P.cx - 55, P.pubicSymphysis.y - 15, 18, 12, -0.2, 0, Math.PI * 2); ctx.stroke();
  }

  // ── CLAVICLES & SCAPULAE ────────────────────────────────────────────────────

  function drawShoulderGirdle(ctx, alpha) {
    const C = G.CLAVICLES;
    const SC = G.SCAPULAE;

    // Clavicles (collarbones)
    ctx.strokeStyle = BONE_COLOR + (alpha * 0.4) + ')';
    ctx.lineWidth = 2.5;
    // Right clavicle
    ctx.beginPath();
    ctx.moveTo(C.right.inner.x, C.right.inner.y);
    ctx.quadraticCurveTo(G.CENTER_X + 80, C.right.inner.y - 8, C.right.outer.x, C.right.outer.y);
    ctx.stroke();
    // Left clavicle
    ctx.beginPath();
    ctx.moveTo(C.left.inner.x, C.left.inner.y);
    ctx.quadraticCurveTo(G.CENTER_X - 80, C.left.inner.y - 8, C.left.outer.x, C.left.outer.y);
    ctx.stroke();

    // Scapulae (shoulder blades — shown as faint triangles since this is anterior view)
    ctx.strokeStyle = BONE_COLOR + (alpha * 0.15) + ')';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    [SC.left, SC.right].forEach(s => {
      ctx.beginPath();
      ctx.moveTo(s.top.x, s.top.y);
      ctx.lineTo(s.bottom.x, s.bottom.y);
      ctx.lineTo(s.top.x + (s === SC.left ? -s.width : s.width) * 0.3, s.spine.y);
      ctx.closePath();
      ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  // ── LIMB BONES ──────────────────────────────────────────────────────────────

  function drawLimbs(ctx, alpha) {
    const A = G.ARMS;
    const L = G.LEGS;

    // ── ARMS ──
    ['left', 'right'].forEach(side => {
      const arm = A[side];

      // Humerus (upper arm)
      drawBone(ctx, arm.shoulder.x, arm.shoulder.y, arm.elbow.x, arm.elbow.y, 3, alpha * 0.4);

      // Radius and ulna (forearm — two bones slightly offset)
      const elbX = arm.elbow.x, elbY = arm.elbow.y;
      const wriX = arm.wrist.x, wriY = arm.wrist.y;
      drawBone(ctx, elbX - 3, elbY, wriX - 4, wriY, 2, alpha * 0.35);  // Ulna
      drawBone(ctx, elbX + 3, elbY, wriX + 4, wriY, 1.8, alpha * 0.3); // Radius

      // Joints
      drawJoint(ctx, arm.shoulder.x, arm.shoulder.y, 6, alpha * 0.25);
      drawJoint(ctx, arm.elbow.x, arm.elbow.y, 5, alpha * 0.25);
      drawJoint(ctx, arm.wrist.x, arm.wrist.y, 4, alpha * 0.2);

      // Simplified hand bones (metacarpals)
      const dx = arm.fingers.x - arm.wrist.x;
      const dy = arm.fingers.y - arm.wrist.y;
      for (let f = 0; f < 5; f++) {
        const spread = (f - 2) * 4;
        const len = f === 0 ? 0.6 : 0.9;  // Thumb shorter
        ctx.strokeStyle = BONE_COLOR + (alpha * 0.2) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(arm.wrist.x + spread, arm.wrist.y);
        ctx.lineTo(arm.wrist.x + dx * len + spread * 2, arm.wrist.y + dy * len);
        ctx.stroke();
      }
    });

    // ── LEGS ──
    ['left', 'right'].forEach(side => {
      const leg = L[side];

      // Femur (thigh bone)
      drawBone(ctx, leg.hip.x, leg.hip.y, leg.knee.x, leg.knee.y, 4, alpha * 0.4);

      // Patella (kneecap)
      ctx.strokeStyle = BONE_COLOR + (alpha * 0.3) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(leg.knee.x, leg.knee.y - 5, 8, 10, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Tibia and fibula (shin — two bones)
      const knX = leg.knee.x, knY = leg.knee.y;
      const anX = leg.ankle.x, anY = leg.ankle.y;
      drawBone(ctx, knX - 4, knY + 5, anX - 3, anY, 3, alpha * 0.35);  // Tibia
      drawBone(ctx, knX + 6, knY + 5, anX + 5, anY, 1.5, alpha * 0.25); // Fibula

      // Joints
      drawJoint(ctx, leg.hip.x, leg.hip.y, 7, alpha * 0.2);
      drawJoint(ctx, leg.knee.x, leg.knee.y, 6, alpha * 0.2);
      drawJoint(ctx, leg.ankle.x, leg.ankle.y, 5, alpha * 0.18);

      // Simplified foot bones
      const footDir = side === 'left' ? -1 : 1;
      ctx.strokeStyle = BONE_COLOR + (alpha * 0.2) + ')';
      ctx.lineWidth = 1.5;
      // Calcaneus (heel)
      ctx.beginPath();
      ctx.moveTo(anX, anY);
      ctx.lineTo(anX + footDir * 5, anY + 20);
      ctx.stroke();
      // Metatarsals
      for (let t = 0; t < 5; t++) {
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(anX + footDir * 5, anY + 10);
        ctx.lineTo(leg.foot.x + footDir * (t - 2) * 6, leg.foot.y + t * 2);
        ctx.stroke();
      }
    });
  }

  // ── MARROW GLOW (life inside bones) ─────────────────────────────────────────

  function drawMarrowGlow(ctx, alpha, ts) {
    // Subtle warm glow pulsing through major bones — representing living marrow
    const pulse = (Math.sin(ts * 0.0012) + 1) / 2;  // 0-1
    const glowAlpha = alpha * 0.04 * pulse;
    if (glowAlpha < 0.005) return;

    ctx.fillStyle = MARROW_GLOW + glowAlpha + ')';

    // Sternum marrow
    ctx.beginPath();
    ctx.ellipse(G.RIBS.cx, (G.RIBS.sternum.top + G.RIBS.sternum.bottom) / 2, 5, 80, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pelvis marrow
    ctx.beginPath();
    ctx.ellipse(G.PELVIS.cx, G.PELVIS.top + 40, 60, 30, 0, 0, Math.PI * 2);
    ctx.fill();

    // Femur marrow (upper legs)
    ['left', 'right'].forEach(side => {
      const leg = G.LEGS[side];
      const midX = (leg.hip.x + leg.knee.x) / 2;
      const midY = (leg.hip.y + leg.knee.y) / 2;
      ctx.beginPath();
      ctx.ellipse(midX, midY, 4, 50, Math.atan2(leg.knee.y - leg.hip.y, leg.knee.x - leg.hip.x), 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ── MAIN DRAW ───────────────────────────────────────────────────────────────

  function draw(ts) {
    if (!_initialized || !_visible) return;
    // Throttle to ~24fps for skeleton (doesn't need 60)
    if (ts - _last < 42) return;
    _last = ts;

    const canvas = document.getElementById('mainCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    _pulsePhase = (Math.sin(ts * 0.0005) + 1) / 2;
    const baseAlpha = 0.6 + _pulsePhase * 0.15;  // Bones are fairly visible

    ctx.save();

    // Draw layers bottom to top
    drawMarrowGlow(ctx, baseAlpha, ts);
    drawSpine(ctx, baseAlpha, _pulsePhase, ts);
    drawRibs(ctx, baseAlpha, ts);
    drawPelvis(ctx, baseAlpha);
    drawShoulderGirdle(ctx, baseAlpha);
    drawSkull(ctx, baseAlpha, _pulsePhase);
    drawLimbs(ctx, baseAlpha);

    ctx.restore();
  }

  // ── VISIBILITY TOGGLE ───────────────────────────────────────────────────────
  function setVisible(v) { _visible = v; }
  function isVisible() { return _visible; }

  return { init, draw, setVisible, isVisible };
})();

// Init after BODY_GEOMETRY is ready
setTimeout(() => { if (window.BODY_GEOMETRY) SKELETON.init(); }, 200);
