// ═══════════════════════════════════════════════════════════════════════════
// THE FOLK, IN THREE DIMENSIONS — the sim citizens walk the clearing (S8UVUC2)
// AETHERHOLD, world-forger · Phase 2 of 3D citizen bodies
//
// WHAT THIS IS. The 2D folk layer (world-folk-layer.js, AC2WP9A) put the 33
// simulated citizens onto the flat terrain panels as coloured dots. This file
// puts them INTO THE CLEARING as actual 3D beings: a small distinct body for
// each, standing on the ground at the world position its sim parcel maps to,
// with a floating ACTION GLYPH over its head (🌾 gather / 🔨 build / 💤 rest …)
// and a name label that fades in when you walk near. Guest-visible, no auth.
//
// ONE STORE, TWO RENDERERS. It does NOT fetch anything of its own. It subscribes
// to the SAME window.VintWorldFolk store the 2D panels read, so the flat map and
// the 3D clearing can never show a person in two different places or doing two
// different things. The store polls /api/world/citizens once per 60s economy
// tick; between polls this layer LERPS each body toward its new site, so a
// citizen that moved parcels is seen to walk there rather than teleport.
//
// NOT THE PRESENCE LANE. This is deliberately kept apart from agent-life.js /
// world-client.js's `agents` Map. Those are COUNCIL AVATARS on a 5Hz presence
// websocket — glowing light-figures of who is browsing right now. These are
// WORLD CITIZENS — server-simulated people on a 60s cadence. Different
// population, different cadence, different endpoint, different body. This file
// touches neither the `agents` Map nor AgentLife; world-client calls into it
// exactly the way it calls AgentLife (init once, tick every frame), both guarded.
//
// 60FPS, MOBILE-FIRST (agent-life.js's design law, honoured here):
//   · geometries are shared across all 33 bodies (one capsule, one head, one
//     foot-ring); only the tiny per-citizen materials differ. No per-frame
//     allocation in tick(). The per-body work is a handful of vec math + a
//     distance check. The council's particle-cloud presences are an order of
//     magnitude heavier; 33 solid folk are cheap beside them.
//   · action glyphs are rebuilt ONLY when the verb changes, never per frame.
//   · name labels are distance-gated (shown only within LABEL_NEAR of the
//     player), which both cuts overdraw and keeps 33 labels from becoming a wall
//     — the No-Collision Law applied to floating sprites.
//   · on a coarse pointer the label radius tightens and the body is simpler.
//
// NO-COLLISION LAW. This module creates NO DOM — not one element, ever. Every
// citizen is a WebGL mesh/sprite in the canvas world-client already owns, so it
// has no box to overflow and nothing to stack on in the page. Two citizens that
// the sim places on the SAME parcel are fanned apart by a deterministic per-id
// jitter so no two bodies ever occupy the same ground point.
//
// FEATURE FLAG — 'world_folk3d'. ?folk3d=0 hard-kills every 3D body with no
// deploy (the 2D folk layer keeps working). ?folk=0 kills BOTH (it stops the
// shared store at the source).
//
// THE ACTION VOCABULARY IS NOT A CLOSED ENUM (BJDSVWE). The glyph map covers
// world-citizens.ACTION_KEYS (forage/rest/socialize/work/build/teach/explore)
// AND the world-actions model-lane verbs (move/gather/craft/pay/post_order/…),
// and ANY verb not in the map still renders with a neutral fallback glyph — a
// citizen is never invisible because the brain invented a new verb.
//
// DUAL EXPORT. Attaches to window.WorldFolk3D in the browser; module.exports in
// node, so the hermetic verifier drives THIS shipped code against a mock THREE
// rather than a reimplementation of it.
// ═══════════════════════════════════════════════════════════════════════════
(function (global) {
  'use strict';
  var API = {};

  // ── GEOMETRY of the mapping ────────────────────────────────────────────────
  // The clearing ground is a CircleGeometry(20) centred at the origin
  // (world-client _buildClearing). Parcels are a 0..63 grid. We map that grid
  // onto a FIELD×FIELD square centred at the origin and INSCRIBED in the
  // clearing: a half-span H gives a corner distance H·√2 that must stay inside
  // the radius-20 disc, so a citizen on any parcel lands on the ground, never
  // out over the fog. FIELD 26 → H 13 → corner 18.4 < 20 (a ~1.6m rim margin).
  var GRID = 63;            // parcel index max (0..63)
  var FIELD = 30;           // metres across the inhabited square. Half-span 15,
                            // so a corner parcel maps to r=21.2 — OUTSIDE the
                            // radius-20 disc — and the rim CLAMP below is what
                            // keeps it on the ground (load-bearing, not dead).
                            // Citizens thus spread across most of the clearing.
  var CLEAR_R = 20;         // the clearing ground radius (CircleGeometry(20))
  var EDGE_MARGIN = 1.0;    // keep bodies this far inside the rim (clamp to r=19)
  var LABEL_NEAR = 12;      // metres: show the name label only within this of the player
  var GLYPH_Y = 1.92;       // height of the action glyph sprite
  var LABEL_Y = 2.34;       // height of the name label sprite (above the glyph)

  // Provider accent — WHO is thinking for this citizen. Matches the 2D folk
  // layer's HUE map (warm=claude, green=openai, blue=gemini) so a person reads
  // the same colour on the flat map and in the clearing.
  var HUE = {
    claude:  0xffb570,
    openai:  0x96e8b8,
    gemini:  0x9fdcff,
    _fallback: 0xd6c8ff
  };

  // action → glyph. Covers both vocabularies plus a fallback (never a closed
  // enum). The second value is the plain verb word, drawn under the glyph so the
  // action is legible even where an emoji font is missing, and so the verifier
  // can assert a TEXT value rather than emoji pixels.
  var GLYPH = {
    forage:      ['🌿', 'forage'],    // 🌿
    gather:      ['🌾', 'gather'],    // 🌾
    rest:        ['💤', 'rest'],      // 💤
    socialize:   ['💬', 'socialize'], // 💬
    work:        ['🔧', 'work'],      // 🔧
    build:       ['🔨', 'build'],     // 🔨
    teach:       ['📖', 'teach'],     // 📖
    explore:     ['🧭', 'explore'],   // 🧭
    craft:       ['⚒',       'craft'],     // ⚒
    move:        ['👣', 'move'],      // 👣
    pay:         ['🪙', 'pay'],       // 🪙
    trade:       ['🪙', 'trade'],     // 🪙
    post_order:  ['📜', 'order'],     // 📜
    cancel_order:['📜', 'cancel']     // 📜
  };
  var FALLBACK_GLYPH = '✦';                 // ✦

  // ── PURE HELPERS (exposed for the hermetic verifier) ───────────────────────
  function fin(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : (d || 0); }
  function clampGrid(v) { v = fin(v, 0); return v < 0 ? 0 : (v > GRID ? GRID : v); }

  // parcel (0..63) → world metres on the ground plane, centred at the origin.
  function parcelToWorld(px, py) {
    return {
      x: (clampGrid(px) / GRID - 0.5) * FIELD,
      z: (clampGrid(py) / GRID - 0.5) * FIELD
    };
  }

  // FNV-1a — deterministic 32-bit hash of an id (no crypto needed for a jitter).
  function hash32(s) {
    var h = 2166136261 >>> 0; s = String(s == null ? '' : s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  // Deterministic per-id jitter so two citizens the sim puts on the SAME parcel
  // fan apart instead of stacking on one point. Radius 0.30..0.52 at a hashed
  // angle — larger than a body (~0.32 wide) so co-located pairs read as two.
  function jitter(id) {
    var h = hash32(id);
    var ang = (h % 3600) / 3600 * Math.PI * 2;
    var r = 0.30 + ((h >>> 11) % 100) / 100 * 0.22;
    return { dx: Math.cos(ang) * r, dz: Math.sin(ang) * r };
  }

  // The ground point a citizen OCCUPIES: its parcel cell plus its jitter, then
  // pulled inside the clearing rim so a corner parcel never lands on the fog.
  function siteFor(row) {
    var w = parcelToWorld(row.x, row.y), j = jitter(row.id);
    var x = w.x + j.dx, z = w.z + j.dz;
    var r = Math.hypot(x, z), max = CLEAR_R - EDGE_MARGIN;
    if (r > max && r > 0) { var k = max / r; x *= k; z *= k; }
    return { x: x, z: z };
  }

  function glyphFor(action) {
    var a = (typeof action === 'string') ? action : '';
    var g = GLYPH[a];
    return g ? g[0] : FALLBACK_GLYPH;
  }
  function verbFor(action) {
    var a = (typeof action === 'string') ? action : '';
    var g = GLYPH[a];
    return g ? g[1] : (a || '');
  }
  function hueFor(provider) {
    return (provider && HUE[provider] != null) ? HUE[provider] : HUE._fallback;
  }
  // distance-gated name label (tighter radius on a coarse pointer)
  function shouldLabel(dist, isMobile) {
    return dist <= (isMobile ? LABEL_NEAR * 0.65 : LABEL_NEAR);
  }

  API.parcelToWorld = parcelToWorld;
  API.jitter = jitter;
  API.siteFor = siteFor;
  API.glyphFor = glyphFor;
  API.verbFor = verbFor;
  API.hueFor = hueFor;
  API.shouldLabel = shouldLabel;
  API.hash32 = hash32;
  API.CONFIG = { GRID: GRID, FIELD: FIELD, CLEAR_R: CLEAR_R, EDGE_MARGIN: EDGE_MARGIN, LABEL_NEAR: LABEL_NEAR };

  // ── STATE ──────────────────────────────────────────────────────────────────
  var THREE = null, scene = null, getPlayer = null, isMobile = false;
  var _ready = false, _inited = false, _unsub = null;
  var _folk = new Map();        // id → record
  var _geo = null;              // shared geometry cache
  var _frame = 0;

  function enabled() {
    try {
      var q = new URLSearchParams((global.location && global.location.search) || '');
      if (q.get('folk3d') === '0') return false;
      if (q.get('folk3d') === '1') return true;
      if (global.localStorage && global.localStorage.getItem('vint:flag:world_folk3d') === '0') return false;
    } catch (_) {}
    return true;
  }
  API.enabled = enabled;

  // ── sprite texture from a 2D canvas (glyph + verb, or a name). Defensive: in a
  //    canvas-less environment the sprite is still built (mapless) so the logical
  //    record is intact — the verifier asserts the record, not the pixels. ──────
  function _spriteTex(draw, W, H) {
    try {
      if (typeof document === 'undefined' || !document.createElement) return null;
      var dpr = Math.min((global.devicePixelRatio || 1), 2);
      var c = document.createElement('canvas'); c.width = W * dpr; c.height = H * dpr;
      var ctx = c.getContext('2d'); if (!ctx) return null;
      ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);
      draw(ctx, W, H);
      var tex = new THREE.CanvasTexture(c);
      try { tex.colorSpace = THREE.SRGBColorSpace; } catch (_) {}
      try { tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; } catch (_) {}
      tex.needsUpdate = true;
      return tex;
    } catch (_) { return null; }
  }

  function _sprite(tex, sx, sy, y) {
    var mat = new THREE.SpriteMaterial({ map: tex || null, transparent: true, depthTest: false, depthWrite: false });
    var spr = new THREE.Sprite(mat);
    spr.renderOrder = 998;
    spr.scale.set(sx, sy, 1);
    spr.position.set(0, y, 0);
    return spr;
  }

  // the floating action chip: glyph on top, verb word under it, on a soft pill.
  function _makeGlyph(glyph, verb, hex) {
    var W = 256, H = 160;
    var tex = _spriteTex(function (ctx) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // soft dark pill so the glyph reads over any ground colour
      ctx.fillStyle = 'rgba(14,11,8,0.55)';
      _roundRect(ctx, 28, 18, W - 56, H - 36, 26); ctx.fill();
      // accent ring in the provider hue
      ctx.lineWidth = 4; ctx.strokeStyle = _css(hex, 0.85);
      _roundRect(ctx, 28, 18, W - 56, H - 36, 26); ctx.stroke();
      ctx.font = '70px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(glyph, W / 2, 66);
      ctx.font = '600 30px Georgia, serif';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineJoin = 'round';
      var s = String(verb || '').toUpperCase();
      ctx.strokeText(s, W / 2, 124); ctx.fillStyle = '#fbf2e4'; ctx.fillText(s, W / 2, 124);
    }, W, H);
    var spr = _sprite(tex, 0.95, 0.60, GLYPH_Y);
    spr.userData.kind = 'glyph';
    return spr;
  }

  function _makeLabel(name) {
    var W = 512, H = 128;
    var tex = _spriteTex(function (ctx) {
      ctx.font = '600 46px Georgia, serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var s = String(name || '').toUpperCase();
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineJoin = 'round';
      ctx.strokeText(s, W / 2, H / 2);
      ctx.fillStyle = '#fbf2e4'; ctx.fillText(s, W / 2, H / 2);
    }, W, H);
    var spr = _sprite(tex, 1.5, 0.375, LABEL_Y);
    spr.userData.kind = 'label';
    spr.visible = false; // distance-gated in tick()
    return spr;
  }

  function _roundRect(ctx, x, y, w, h, r) {
    try {
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    } catch (_) {}
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function _css(hex, a) {
    var r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  function _geometries() {
    if (_geo) return _geo;
    _geo = {
      body: new THREE.CapsuleGeometry(0.17, 0.46, 6, 12),
      head: new THREE.SphereGeometry(0.15, 16, 12),
      ring: new THREE.CircleGeometry(0.34, 20)
    };
    return _geo;
  }

  // Build a distinct FOLK body — a small solid figure, tinted by its provider,
  // standing on a soft ground-ring. Deliberately unlike the council's glowing
  // particle presences and unlike the user's full skeletal rig.
  function _makeBody(row) {
    var g = new THREE.Group();
    var hex = hueFor(row.provider);
    var geo = _geometries();
    var bodyMat = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.6, metalness: 0.05, emissive: hex, emissiveIntensity: 0.14 });
    var headMat = new THREE.MeshStandardMaterial({ color: 0xf3e6d2, roughness: 0.55, metalness: 0.04, emissive: hex, emissiveIntensity: 0.10 });
    var torso = new THREE.Mesh(geo.body, bodyMat); torso.position.y = 0.62;
    var head = new THREE.Mesh(geo.head, headMat); head.position.y = 1.12;
    g.add(torso); g.add(head);
    // a soft ground-ring so the being reads as planted (not floating)
    try {
      var ringMat = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
      var ring = new THREE.Mesh(geo.ring, ringMat);
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
    } catch (_) {}
    g.userData.torso = torso; g.userData.head = head;
    g.userData.baseY = 0; g.userData.bob = 0;
    return g;
  }

  // ── RECONCILE: the store's rows → the set of bodies in the scene ────────────
  function _activePlaced(rows) {
    var out = [];
    if (!rows) return out;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r && r.active && !r.incap && r.placed) out.push(r);
    }
    return out;
  }

  function _reconcile(rows) {
    if (!_ready || !scene || !THREE) return;
    var live = _activePlaced(rows);
    var seen = new Set();
    for (var i = 0; i < live.length; i++) {
      var row = live[i]; seen.add(row.id);
      var rec = _folk.get(row.id);
      var site = siteFor(row);
      if (!rec) {
        var g;
        try { g = _makeBody(row); } catch (e) { continue; }
        g.userData.__folkId = row.id;
        g.position.set(site.x, 0, site.z);
        var glyph = glyphFor(row.action), verb = verbFor(row.action);
        var gs = _makeGlyph(glyph, verb, hueFor(row.provider)); g.add(gs);
        var lbl = _makeLabel(row.name); g.add(lbl);
        try { scene.add(g); } catch (_) {}
        rec = {
          id: row.id, name: row.name, provider: row.provider,
          parcelX: row.x, parcelY: row.y, action: row.action,
          glyph: glyph, verb: verb,
          mesh: g, glyphSprite: gs, label: lbl,
          target: { x: site.x, z: site.z }, yaw: 0, moving: false
        };
        _folk.set(row.id, rec);
      } else {
        rec.parcelX = row.x; rec.parcelY = row.y; rec.provider = row.provider;
        rec.target.x = site.x; rec.target.z = site.z;
        if (row.action !== rec.action) {
          rec.action = row.action;
          rec.glyph = glyphFor(row.action); rec.verb = verbFor(row.action);
          // rebuild the glyph chip ONLY on an actual verb change
          try {
            if (rec.glyphSprite && rec.mesh) rec.mesh.remove(rec.glyphSprite);
            var ngs = _makeGlyph(rec.glyph, rec.verb, hueFor(row.provider));
            rec.mesh.add(ngs); rec.glyphSprite = ngs;
          } catch (_) {}
        }
      }
    }
    // remove any body whose citizen is gone / no longer active+placed
    var dead = [];
    _folk.forEach(function (rec, id) { if (!seen.has(id)) dead.push(id); });
    for (var d = 0; d < dead.length; d++) _dispose(dead[d]);
  }

  function _dispose(id) {
    var rec = _folk.get(id); if (!rec) return;
    try { if (rec.mesh && scene) scene.remove(rec.mesh); } catch (_) {}
    try {
      if (rec.mesh && rec.mesh.traverse) rec.mesh.traverse(function (o) {
        if (o.material && o.material.dispose) { try { o.material.dispose(); } catch (_) {} }
        if (o.material && o.material.map && o.material.map.dispose) { try { o.material.map.dispose(); } catch (_) {} }
      });
    } catch (_) {}
    _folk.delete(id);
  }

  // ── LIFECYCLE ──────────────────────────────────────────────────────────────
  API.init = function (opts) {
    opts = opts || {};
    THREE = opts.THREE; scene = opts.scene;
    getPlayer = (typeof opts.getPlayer === 'function') ? opts.getPlayer : function () { return { x: 0, z: 0 }; };
    isMobile = !!opts.isMobile;
    if (!THREE || !scene) return;
    _ready = true; _inited = true;
    // subscribe to the shared store, and make sure it is POLLING (nothing else
    // guarantees the poll runs for a guest who never opens a panel).
    try {
      var F = global.VintWorldFolk;
      if (F) {
        if (F.start) F.start();
        if (F.subscribe) _unsub = F.subscribe(function (rows) { try { _reconcile(rows); } catch (_) {} });
        else if (F.get) _reconcile(F.get());
      }
    } catch (_) {}
  };

  API.isReady = function () { return _ready && _inited; };

  // Called every frame by world-client, AFTER the presence lerp + AgentLife.tick.
  API.tick = function (dt, tnow) {
    if (!_ready || _folk.size === 0) return;
    dt = (typeof dt === 'number' && dt > 0) ? Math.min(dt, 0.05) : 0.016;
    var p = { x: 0, z: 0 };
    try { p = getPlayer() || p; } catch (_) {}
    _frame++;
    _folk.forEach(function (rec) {
      var g = rec.mesh; if (!g) return;
      var px = g.position.x, pz = g.position.z;
      // lerp toward the sim site (smooth walk between 60s ticks)
      g.position.x += (rec.target.x - px) * Math.min(1, 2.4 * dt);
      g.position.z += (rec.target.z - pz) * Math.min(1, 2.4 * dt);
      var moved = Math.hypot(g.position.x - px, g.position.z - pz) / dt;
      rec.moving = moved > 0.12;
      // gentle walk-bob while travelling; face the direction of travel
      var ud = g.userData;
      if (rec.moving) {
        ud.bob = (ud.bob || 0) + dt * 9;
        if (ud.torso) ud.torso.position.y = 0.62 + Math.abs(Math.sin(ud.bob)) * 0.05;
        var dx = rec.target.x - g.position.x, dz = rec.target.z - g.position.z;
        if (Math.abs(dx) + Math.abs(dz) > 0.002) {
          var want = Math.atan2(dx, dz), d = want - g.rotation.y;
          while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
          g.rotation.y += d * Math.min(1, 8 * dt);
        }
      } else if (ud.torso) {
        ud.torso.position.y += (0.62 - ud.torso.position.y) * Math.min(1, 6 * dt);
      }
      // distance-gated name label (cheap: every 4th frame is plenty for a fade cue)
      if ((_frame & 3) === 0 && rec.label) {
        var dist = Math.hypot(g.position.x - p.x, g.position.z - p.z);
        rec.label.visible = shouldLabel(dist, isMobile);
      }
    });
  };

  // Clear every body (warp/teardown parity). The store keeps its rows, so the
  // next notify — or an immediate rebuild from the current snapshot — repopulates.
  API.reset = function () {
    var ids = []; _folk.forEach(function (r, id) { ids.push(id); });
    for (var i = 0; i < ids.length; i++) _dispose(ids[i]);
    try { var F = global.VintWorldFolk; if (_ready && F && F.get) _reconcile(F.get()); } catch (_) {}
  };

  // ── INSPECTION (for the live + hermetic verifiers) ─────────────────────────
  // Returns the LOGICAL + rendered state of every body, so a harness can assert
  // VALUES (which verb, which world point) without reading emoji pixels.
  API.citizens = function () {
    var out = [];
    _folk.forEach(function (rec) {
      out.push({
        id: rec.id, name: rec.name, provider: rec.provider,
        parcelX: rec.parcelX, parcelY: rec.parcelY,
        action: rec.action, glyph: rec.glyph, verb: rec.verb,
        targetX: rec.target.x, targetZ: rec.target.z,
        x: rec.mesh ? rec.mesh.position.x : null,
        z: rec.mesh ? rec.mesh.position.z : null,
        hasMesh: !!rec.mesh, hasGlyph: !!rec.glyphSprite,
        labelVisible: rec.label ? !!rec.label.visible : false,
        moving: !!rec.moving
      });
    });
    return out;
  };
  API.count = function () { return _folk.size; };
  // test seam: drive a reconcile directly (the hermetic verifier uses this to
  // feed fixture rows without a real VintWorldFolk store).
  API._reconcileForTest = function (rows) { _reconcile(rows); };
  API._reset = function () { _folk.forEach(function (r, id) { _dispose(id); }); _folk.clear(); };

  // ── DUAL EXPORT ────────────────────────────────────────────────────────────
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.WorldFolk3D = API;
  else if (typeof global !== 'undefined') global.WorldFolk3D = API;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
