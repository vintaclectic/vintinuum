// ═══════════════════════════════════════════════════════════════════════════════
// BODY_GEOMETRY — world-space coordinate definitions for the full human body
// All coordinates in SVG viewBox space (700 wide × 1400 tall)
// The brain visualization occupies roughly the head area (y: 0-320)
// The body extends below: neck, torso, arms, legs
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';

const BODY_GEOMETRY = (() => {

  // ── BODY ORIGIN & SCALE ─────────────────────────────────────────────────────
  // Center axis of the body along the SVG viewBox
  const CENTER_X = 350;
  const TOP_Y = 0;        // Top of skull
  const BOTTOM_Y = 1380;  // Bottom of feet

  // ── HEAD ─────────────────────────────────────────────────────────────────────
  const HEAD = {
    cx: CENTER_X,
    cy: 160,        // Center of skull
    rx: 95,         // Horizontal radius
    ry: 110,        // Vertical radius (slightly taller than wide)
    top: 50,        // Top of skull
    bottom: 270,    // Bottom of jaw
    jawWidth: 75,   // Half-width at jaw
  };

  // ── NECK ─────────────────────────────────────────────────────────────────────
  const NECK = {
    top: HEAD.bottom,
    bottom: 310,
    width: 40,      // Half-width
    cx: CENTER_X,
  };

  // ── TORSO ────────────────────────────────────────────────────────────────────
  const TORSO = {
    shoulderY: NECK.bottom,
    shoulderWidth: 175,    // Half-width at shoulders
    waistY: 620,
    waistWidth: 100,       // Half-width at waist
    hipY: 720,
    hipWidth: 130,         // Half-width at hips
    cx: CENTER_X,
  };

  // ── SPINE ────────────────────────────────────────────────────────────────────
  const SPINE = {
    cx: CENTER_X,
    // Vertebrae positions (y coords, top to bottom)
    cervical: [  // C1-C7
      { y: 275, w: 12 }, { y: 285, w: 13 }, { y: 295, w: 13 },
      { y: 305, w: 14 }, { y: 315, w: 14 }, { y: 325, w: 15 },
      { y: 335, w: 15 },
    ],
    thoracic: [  // T1-T12
      { y: 350, w: 16 }, { y: 365, w: 17 }, { y: 380, w: 18 },
      { y: 395, w: 19 }, { y: 410, w: 20 }, { y: 425, w: 20 },
      { y: 440, w: 20 }, { y: 455, w: 20 }, { y: 470, w: 19 },
      { y: 485, w: 19 }, { y: 500, w: 18 }, { y: 515, w: 18 },
    ],
    lumbar: [    // L1-L5
      { y: 535, w: 22 }, { y: 555, w: 24 }, { y: 575, w: 25 },
      { y: 595, w: 26 }, { y: 615, w: 26 },
    ],
    sacrum: { y: 640, h: 50, w: 28 },
    coccyx: { y: 695, h: 20, w: 12 },
  };

  // ── RIBCAGE ──────────────────────────────────────────────────────────────────
  const RIBS = {
    cx: CENTER_X,
    sternum: { top: 330, bottom: 510, width: 14 },
    // 12 pairs of ribs — each has a y, and width (half-width from center)
    pairs: [
      { y: 350, w: 110, curve: 0.3 },  // Rib 1 (smallest)
      { y: 365, w: 125, curve: 0.32 },
      { y: 380, w: 140, curve: 0.34 },
      { y: 395, w: 150, curve: 0.36 },
      { y: 410, w: 155, curve: 0.38 },
      { y: 425, w: 158, curve: 0.38 },
      { y: 440, w: 160, curve: 0.37 },  // Rib 7 (largest true rib)
      { y: 455, w: 155, curve: 0.35 },  // False ribs start
      { y: 470, w: 148, curve: 0.33 },
      { y: 485, w: 138, curve: 0.30 },
      { y: 500, w: 80, curve: 0.25 },   // Floating ribs
      { y: 512, w: 65, curve: 0.22 },   // Floating rib 12
    ],
  };

  // ── PELVIS ───────────────────────────────────────────────────────────────────
  const PELVIS = {
    cx: CENTER_X,
    top: 640,
    bottom: 740,
    width: 135,     // Half-width at widest
    iliacCrest: { y: 645, w: 130 },
    acetabulum: {   // Hip sockets
      left: { x: CENTER_X - 95, y: 710 },
      right: { x: CENTER_X + 95, y: 710 },
    },
    pubicSymphysis: { x: CENTER_X, y: 735 },
  };

  // ── ARMS ─────────────────────────────────────────────────────────────────────
  const ARMS = {
    left: {
      shoulder: { x: CENTER_X - 175, y: 315 },
      elbow: { x: CENTER_X - 210, y: 490 },
      wrist: { x: CENTER_X - 225, y: 650 },
      fingers: { x: CENTER_X - 230, y: 700 },
      width: 22,  // Arm thickness (radius)
    },
    right: {
      shoulder: { x: CENTER_X + 175, y: 315 },
      elbow: { x: CENTER_X + 210, y: 490 },
      wrist: { x: CENTER_X + 225, y: 650 },
      fingers: { x: CENTER_X + 230, y: 700 },
      width: 22,
    },
  };

  // ── LEGS ─────────────────────────────────────────────────────────────────────
  const LEGS = {
    left: {
      hip: { x: CENTER_X - 75, y: 730 },
      knee: { x: CENTER_X - 80, y: 960 },
      ankle: { x: CENTER_X - 78, y: 1190 },
      foot: { x: CENTER_X - 95, y: 1220, length: 55 },
      width: 35,  // Thigh radius
      calfWidth: 26,
    },
    right: {
      hip: { x: CENTER_X + 75, y: 730 },
      knee: { x: CENTER_X + 80, y: 960 },
      ankle: { x: CENTER_X + 78, y: 1190 },
      foot: { x: CENTER_X + 95, y: 1220, length: 55 },
      width: 35,
      calfWidth: 26,
    },
  };

  // ── SKULL ────────────────────────────────────────────────────────────────────
  const SKULL = {
    cx: CENTER_X,
    cy: 150,
    craniumRx: 92,
    craniumRy: 100,
    craniumTop: 55,
    // Facial bones
    orbits: {
      left: { cx: CENTER_X - 28, cy: 165, rx: 16, ry: 14 },
      right: { cx: CENTER_X + 28, cy: 165, rx: 16, ry: 14 },
    },
    nasalBridge: { x: CENTER_X, topY: 170, bottomY: 200, width: 10 },
    maxilla: { cx: CENTER_X, y: 210, width: 40, height: 20 },
    mandible: {
      cx: CENTER_X, y: 245,
      width: 65, height: 25,
      // Jaw curve control points
      leftAngle: { x: CENTER_X - 60, y: 230 },
      rightAngle: { x: CENTER_X + 60, y: 230 },
      chin: { x: CENTER_X, y: 265 },
    },
    temporalBone: {
      left: { x: CENTER_X - 88, y: 160 },
      right: { x: CENTER_X + 88, y: 160 },
    },
  };

  // ── SCAPULAE (Shoulder blades) ───────────────────────────────────────────────
  const SCAPULAE = {
    left: {
      top: { x: CENTER_X - 120, y: 330 },
      bottom: { x: CENTER_X - 100, y: 460 },
      spine: { y: 370 },  // Scapular spine
      width: 55,
    },
    right: {
      top: { x: CENTER_X + 120, y: 330 },
      bottom: { x: CENTER_X + 100, y: 460 },
      spine: { y: 370 },
      width: 55,
    },
  };

  // ── CLAVICLES ────────────────────────────────────────────────────────────────
  const CLAVICLES = {
    left: {
      inner: { x: CENTER_X - 10, y: 315 },
      outer: { x: CENTER_X - 165, y: 305 },
    },
    right: {
      inner: { x: CENTER_X + 10, y: 315 },
      outer: { x: CENTER_X + 165, y: 305 },
    },
  };

  // ── BODY SILHOUETTE (outline path for skin layer) ───────────────────────────
  // Simple closed clockwise polygon — no self-intersections, no backtracking.
  // Traversal: crown → right side of head → right shoulder → OUTSIDE of right
  // arm → around right hand → INSIDE of right arm (armpit) → right torso →
  // right hip → outside of right leg → around right foot → inside of right
  // leg → crotch midpoint → inside of left leg → around left foot → outside
  // of left leg → left hip → left torso → left armpit → INSIDE of left arm →
  // around left hand → OUTSIDE of left arm → left shoulder → left side of
  // head → crown close. Single continuous winding. No figure-8s.
  const SILHOUETTE = [
    // Top of skull (start/end)
    { x: CENTER_X,       y: 50  },
    // Right side of head
    { x: CENTER_X + 60,  y: 55  },
    { x: CENTER_X + 90,  y: 100 },
    { x: CENTER_X + 95,  y: 160 },
    { x: CENTER_X + 85,  y: 220 },
    { x: CENTER_X + 70,  y: 255 },
    // Right jaw → neck
    { x: CENTER_X + 45,  y: 270 },
    { x: CENTER_X + 42,  y: 295 },
    // Right shoulder (slope out to deltoid)
    { x: CENTER_X + 60,  y: 310 },
    { x: CENTER_X + 175, y: 318 },
    // OUTSIDE of right arm (shoulder → hand)
    { x: CENTER_X + 195, y: 400 },
    { x: CENTER_X + 215, y: 490 },
    { x: CENTER_X + 225, y: 580 },
    { x: CENTER_X + 232, y: 650 },
    // Around right hand (fingertip loop — single pass)
    { x: CENTER_X + 238, y: 695 },
    { x: CENTER_X + 230, y: 715 },
    { x: CENTER_X + 215, y: 720 },
    { x: CENTER_X + 200, y: 712 },
    // INSIDE of right arm (hand → armpit)
    { x: CENTER_X + 195, y: 680 },
    { x: CENTER_X + 185, y: 600 },
    { x: CENTER_X + 175, y: 510 },
    { x: CENTER_X + 160, y: 420 },
    { x: CENTER_X + 150, y: 360 },  // armpit
    // Right torso (ribcage → waist → hip)
    { x: CENTER_X + 155, y: 440 },
    { x: CENTER_X + 140, y: 540 },
    { x: CENTER_X + 120, y: 620 },  // waist
    { x: CENTER_X + 130, y: 700 },  // hip out
    { x: CENTER_X + 132, y: 735 },  // iliac crest
    // OUTSIDE of right leg (hip → ankle)
    { x: CENTER_X + 118, y: 800 },
    { x: CENTER_X + 108, y: 880 },
    { x: CENTER_X + 98,  y: 960 },  // knee outer
    { x: CENTER_X + 95,  y: 1020 },
    { x: CENTER_X + 90,  y: 1100 }, // calf
    { x: CENTER_X + 80,  y: 1180 }, // ankle outer
    // Right foot top and toe
    { x: CENTER_X + 70,  y: 1210 },
    { x: CENTER_X + 45,  y: 1225 }, // toe tip
    // Heel and instep (inside of right foot)
    { x: CENTER_X + 25,  y: 1215 },
    { x: CENTER_X + 35,  y: 1190 }, // ankle inside
    // INSIDE of right leg (ankle → crotch)
    { x: CENTER_X + 45,  y: 1100 },
    { x: CENTER_X + 52,  y: 1000 },
    { x: CENTER_X + 58,  y: 900  },
    { x: CENTER_X + 55,  y: 820  },
    { x: CENTER_X + 40,  y: 760  },
    // Crotch midpoint (single apex — no V-dip)
    { x: CENTER_X,       y: 748  },
    // INSIDE of left leg (crotch → ankle)
    { x: CENTER_X - 40,  y: 760  },
    { x: CENTER_X - 55,  y: 820  },
    { x: CENTER_X - 58,  y: 900  },
    { x: CENTER_X - 52,  y: 1000 },
    { x: CENTER_X - 45,  y: 1100 },
    { x: CENTER_X - 35,  y: 1190 },
    // Left heel and foot
    { x: CENTER_X - 25,  y: 1215 },
    { x: CENTER_X - 45,  y: 1225 }, // toe tip
    { x: CENTER_X - 70,  y: 1210 },
    // OUTSIDE of left leg (ankle → hip)
    { x: CENTER_X - 80,  y: 1180 },
    { x: CENTER_X - 90,  y: 1100 },
    { x: CENTER_X - 95,  y: 1020 },
    { x: CENTER_X - 98,  y: 960  },
    { x: CENTER_X - 108, y: 880  },
    { x: CENTER_X - 118, y: 800  },
    // Left hip and torso
    { x: CENTER_X - 132, y: 735  },
    { x: CENTER_X - 130, y: 700  },
    { x: CENTER_X - 120, y: 620  },
    { x: CENTER_X - 140, y: 540  },
    { x: CENTER_X - 155, y: 440  },
    // Left armpit
    { x: CENTER_X - 150, y: 360  },
    // INSIDE of left arm (armpit → hand)
    { x: CENTER_X - 160, y: 420  },
    { x: CENTER_X - 175, y: 510  },
    { x: CENTER_X - 185, y: 600  },
    { x: CENTER_X - 195, y: 680  },
    // Around left hand
    { x: CENTER_X - 200, y: 712  },
    { x: CENTER_X - 215, y: 720  },
    { x: CENTER_X - 230, y: 715  },
    { x: CENTER_X - 238, y: 695  },
    // OUTSIDE of left arm (hand → shoulder)
    { x: CENTER_X - 232, y: 650  },
    { x: CENTER_X - 225, y: 580  },
    { x: CENTER_X - 215, y: 490  },
    { x: CENTER_X - 195, y: 400  },
    { x: CENTER_X - 175, y: 318  },
    // Left shoulder → neck → jaw → head
    { x: CENTER_X - 60,  y: 310  },
    { x: CENTER_X - 42,  y: 295  },
    { x: CENTER_X - 45,  y: 270  },
    { x: CENTER_X - 70,  y: 255  },
    { x: CENTER_X - 85,  y: 220  },
    { x: CENTER_X - 95,  y: 160  },
    { x: CENTER_X - 90,  y: 100  },
    { x: CENTER_X - 60,  y: 55   },
    // Close at crown
    { x: CENTER_X,       y: 50   },
  ];

  // ── ZOOM REGIONS ─────────────────────────────────────────────────────────────
  // Predefined viewBox regions for quick-zoom navigation
  const ZOOM_REGIONS = {
    FULL_BODY:  { x: 0, y: 0, w: 700, h: 1400 },
    HEAD:       { x: 200, y: 30, w: 300, h: 300 },
    BRAIN:      { x: 230, y: 50, w: 240, h: 230 },
    CHEST:      { x: 130, y: 300, w: 440, h: 250 },
    ABDOMEN:    { x: 160, y: 480, w: 380, h: 200 },
    PELVIS:     { x: 160, y: 620, w: 380, h: 150 },
    LEFT_ARM:   { x: 70, y: 290, w: 200, h: 430 },
    RIGHT_ARM:  { x: 430, y: 290, w: 200, h: 430 },
    LEFT_LEG:   { x: 180, y: 700, w: 200, h: 540 },
    RIGHT_LEG:  { x: 320, y: 700, w: 200, h: 540 },
    HEART:      { x: 280, y: 350, w: 160, h: 140 },
    LUNGS:      { x: 170, y: 330, w: 360, h: 200 },
  };

  return {
    CENTER_X, TOP_Y, BOTTOM_Y,
    HEAD, NECK, TORSO, SPINE, RIBS, PELVIS,
    ARMS, LEGS, SKULL, SCAPULAE, CLAVICLES,
    SILHOUETTE, ZOOM_REGIONS,
  };
})();

// Make globally accessible
window.BODY_GEOMETRY = BODY_GEOMETRY;
