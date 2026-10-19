// foundry.js — THE FOUNDRY: snap-connected modular building (AETHERHOLD, 2026-10-18, task XQNRQE7)
//
// ════════════════════════════════════════════════════════════════════════════
// Lord Vinta: "realistic objects, connecting builds like in the best of open
// world survival builder games but real world like ish ... more skin and flesh
// merged with machine and electronics."
//
// The legacy build palette drops a piece where you stand, at whatever angle you
// face. Nothing meets anything, so nothing you make reads as ARCHITECTURE. The
// Foundry is the opposite contract: every piece lives on one shared 2m lattice
// and connects through SOCKETS — cells (slabs, stairs), edges (walls, doorways,
// conduits) and corners (pillars, power nodes). A wall finds the edge of the
// foundation under it, a second wall finds the top of the first, a floor finds
// the tops of the walls around it, a conduit runs along a wall's foot, a node
// crowns a pillar. Rotation is in 90° steps. A ghost shows you the result
// before you spend anything: GREEN = it will connect, RED = it will not (and the
// status line says exactly why).
//
// ── THE PROTOCOL (no invented server verbs) ─────────────────────────────────
// The brain (vintinuum-api/world/world-mvp.js) already accepts
//   world:place { kind, x, y, z, rot, meta }
// with `kind` from its fixed PLACE_COST table and `meta` an object ≤800 chars.
// So a signed-in, connected player places REAL pieces through the existing
// economy (strand costs, tier ladder, claim/reach rules — every refusal is the
// server's own world:err). Each Foundry piece maps onto an existing server kind
// and carries its true shape in meta:
//     foundation→floor  wall→wall  doorway→door  floor·roof→floor  pillar→pillar
//     stairs→stair      conduit→fence             power node→light
// world-client._renderStruct hands any struct with meta.piece back to us
// (WorldFoundry.buildFor), so every viewer sees the modular piece.
//
// A GUEST has no socket. Their pieces are a CLIENT-ONLY SKETCH: rendered and
// persisted in localStorage (vint:foundry:v1:<world>:guest), never sent
// anywhere, labelled as a sketch in the status line. Every placement in either
// mode fires `vint:foundry-place` {mode:'server'|'local', piece, kind, x,y,z,
// rot, mat} — the hook a future server-side sketch import can listen to.
//
// ── NO-COLLISION ────────────────────────────────────────────────────────────
// ZERO new fixed elements. The launcher is a flow child of #dvRail via
// DirverseHUD.addLauncher (the rail measures and allocates it); the controls
// live in ONE .dv-sheet registered with the shared sheet owner, so opening it
// evicts every other sheet and the rail yields to it. Its buttons are flow
// children of a bounded, internally scrolling sheet and are data-draggable
// "false" for the same reason the rail's are: dragging them free would pin a
// fixed button over the HUD. While the Foundry is open the shared scrim is made
// transparent (body.fd-open) so the ghost stays crisp — it still catches taps.
//
// ── RETENTION DOCTRINE ──────────────────────────────────────────────────────
//   1 GENEROUS — the ghost shows success/failure BEFORE a strand is spent.
//   2 INVESTMENT — pieces compound: every placed piece publishes new sockets,
//     so yesterday's walls are what today's roof snaps to.
//   3 TIER — free core loop; the server's ascent ladder still gates which kinds
//     open (door/stair/… unlock with standing), unchanged.
//   4 DENSE — one row of verbs, one row of pieces, one row of materials.
//   5 OPEN LOOP — a power node on a pillar is a promise: power networks are the
//     next slice (conduits already carry a live pulse in the owner's color).
//   6 FLAGGED — ?foundry=0 / localStorage vint:flag:world_foundry='0'.
//   7 MORE ALIVE — biomech pieces breathe the same conduit pulse as the bodies.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var W = window;

  // ── flag ────────────────────────────────────────────────────────────────
  function enabled() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('foundry') === '0') return false;
      if (q.get('foundry') === '1') return true;
      if (localStorage.getItem('vint:flag:world_foundry') === '0') return false;
    } catch (_) {}
    return true;
  }
  if (!enabled()) return;

  function world() { return W.VintinuumWorld; }
  function hud() { return W.DirverseHUD; }
  function T() { var w = world(); return (w && w._THREE) || null; }

  // ── the lattice ─────────────────────────────────────────────────────────
  var C = 2;          // cell size (m)
  var FH = 0.3;       // foundation slab height
  var WH = 2.6;       // wall / pillar height
  var SH = 0.15;      // floor/roof slab thickness
  var BOUNDS = 12;    // world-mvp.js BOUNDS — the server refuses beyond this
  var MAXY = 10.6;    // four storeys
  var EPS = 0.01;

  // anchor: which socket family the piece connects through
  // slot: occupancy class — two pieces of one class cannot share a socket+level
  // ground: may stand on bare ground (y=0) where nothing else supports it
  var PIECES = [
    { id: 'foundation', label: 'foundation', glyph: '▭', anchor: 'cell',   slot: 'cell',   kind: 'floor',  mat: 'concrete', ground: true },
    { id: 'wall',       label: 'wall',       glyph: '▮', anchor: 'edge',   slot: 'wall',   kind: 'wall',   mat: 'concrete', ground: true },
    { id: 'doorway',    label: 'doorway',    glyph: '⊓', anchor: 'edge',   slot: 'wall',   kind: 'door',   mat: 'wood',     ground: true },
    { id: 'floor',      label: 'floor·roof', glyph: '▬', anchor: 'cell',   slot: 'cell',   kind: 'floor',  mat: 'wood',     ground: false },
    { id: 'pillar',     label: 'pillar',     glyph: '┃', anchor: 'corner', slot: 'corner', kind: 'pillar', mat: 'steel',    ground: true },
    { id: 'stairs',     label: 'stairs',     glyph: '◿', anchor: 'cell',   slot: 'cell',   kind: 'stair',  mat: 'wood',     ground: true },
    { id: 'conduit',    label: 'conduit',    glyph: '⌇', anchor: 'edge',   slot: 'pipe',   kind: 'fence',  mat: 'biomech',  ground: true, fixedMat: true },
    { id: 'node',       label: 'power node', glyph: '◉', anchor: 'corner', slot: 'corner', kind: 'light',  mat: 'biomech',  ground: true, fixedMat: true },
  ];
  var BY_ID = {}; PIECES.forEach(function (p) { BY_ID[p.id] = p; });
  var MATS = ['concrete', 'steel', 'wood', 'biomech'];

  // ── socket keys ─────────────────────────────────────────────────────────
  // cell centres sit on odd coordinates, lattice lines on even ones.
  function cellOf(x, z) { return { x: Math.floor(x / C) * C + 1, z: Math.floor(z / C) * C + 1 }; }
  function lineOf(v) { return Math.round(v / C) * C; }
  function r1(v) { return Math.round(v * 100) / 100; }
  function keyCell(x, z) { return 'c:' + r1(x) + ':' + r1(z); }
  function keyEdge(x, z, alongX) { return (alongX ? 'ex:' : 'ez:') + r1(x) + ':' + r1(z); }
  function keyCorner(x, z) { return 'k:' + r1(x) + ':' + r1(z); }

  // Where a piece sits, from its anchor point + rotation (0..3).
  function socketFor(def, x, z, rot) {
    if (def.anchor === 'cell') { var c = cellOf(x, z); return { x: c.x, z: c.z, key: keyCell(c.x, c.z) }; }
    if (def.anchor === 'corner') { var kx = lineOf(x), kz = lineOf(z); return { x: kx, z: kz, key: keyCorner(kx, kz) }; }
    var alongX = (rot % 2) === 0;
    if (alongX) { var ex = Math.floor(x / C) * C + 1, ez = lineOf(z); return { x: ex, z: ez, key: keyEdge(ex, ez, true) }; }
    var fx = lineOf(x), fz = Math.floor(z / C) * C + 1;
    return { x: fx, z: fz, key: keyEdge(fx, fz, false) };
  }

  // The sockets a placed piece OFFERS to others: [{key, y}]
  function cellEdges(cx, cz) {
    return [keyEdge(cx, cz - 1, true), keyEdge(cx, cz + 1, true), keyEdge(cx - 1, cz, false), keyEdge(cx + 1, cz, false)];
  }
  function cellCorners(cx, cz) {
    return [keyCorner(cx - 1, cz - 1), keyCorner(cx + 1, cz - 1), keyCorner(cx - 1, cz + 1), keyCorner(cx + 1, cz + 1)];
  }
  function offers(p) {
    var out = [], d = BY_ID[p.piece]; if (!d) return out;
    function add(keys, y) { for (var i = 0; i < keys.length; i++) out.push({ key: keys[i], y: r1(y) }); }
    if (p.piece === 'foundation' || p.piece === 'floor') {
      var top = p.y + (p.piece === 'foundation' ? FH : SH);
      add([keyCell(p.x, p.z)], top); add(cellEdges(p.x, p.z), top); add(cellCorners(p.x, p.z), top);
    } else if (p.piece === 'wall' || p.piece === 'doorway') {
      var wt = p.y + WH, alongX = p.key.charAt(1) === 'x';
      add([p.key], wt);
      if (alongX) {
        add([keyCorner(p.x - 1, p.z), keyCorner(p.x + 1, p.z)], wt);
        add([keyCell(p.x, p.z - 1), keyCell(p.x, p.z + 1)], wt);
      } else {
        add([keyCorner(p.x, p.z - 1), keyCorner(p.x, p.z + 1)], wt);
        add([keyCell(p.x - 1, p.z), keyCell(p.x + 1, p.z)], wt);
      }
    } else if (p.piece === 'pillar') {
      var pt = p.y + WH;
      add([keyCorner(p.x, p.z)], pt);
      add([keyCell(p.x - 1, p.z - 1), keyCell(p.x + 1, p.z - 1), keyCell(p.x - 1, p.z + 1), keyCell(p.x + 1, p.z + 1)], pt);
      add([keyEdge(p.x - 1, p.z, true), keyEdge(p.x + 1, p.z, true), keyEdge(p.x, p.z - 1, false), keyEdge(p.x, p.z + 1, false)], pt);
    }
    return out;
  }

  // ── the index ───────────────────────────────────────────────────────────
  var _pieces = new Map();     // id → { id, piece, mat, x, y, z, rot, key, mesh, local }
  var _supports = null;        // key → sorted levels (lazy, rebuilt on change)
  var _occupied = null;        // slot|key|y → id
  function dirty() { _supports = null; _occupied = null; }
  function index() {
    if (_supports) return;
    var sup = {}, occ = {};
    _pieces.forEach(function (p) {
      var d = BY_ID[p.piece]; if (!d) return;
      occ[d.slot + '|' + p.key + '|' + r1(p.y)] = p.id;
      offers(p).forEach(function (o) { (sup[o.key] = sup[o.key] || []).push(o.y); });
    });
    Object.keys(sup).forEach(function (k) { sup[k] = sup[k].filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; }); });
    _supports = sup; _occupied = occ;
  }

  // Resolve a placement: the lowest free connected level at this socket.
  // { ok, y, reason, connected }
  function resolve(def, sock) {
    index();
    var lv = (_supports[sock.key] || []).slice();
    var under = lv.length && lv[0] <= FH + EPS;            // something sits at slab height here
    if (def.id === 'foundation') {
      if (_occupied['cell|' + sock.key + '|0']) return { ok: false, y: 0, reason: 'a foundation already sits here' };
      return { ok: true, y: 0, connected: !!(_supports[sock.key] || hasNeighbourFoundation(sock)), reason: '' };
    }
    // a floor/roof never sits ON a foundation (a slab on a slab is not a storey)
    if (def.id === 'floor') lv = lv.filter(function (y) { return y > FH + EPS; });
    if (def.ground && !under) lv.unshift(0);
    if (!lv.length) return { ok: false, y: 0, reason: def.id === 'floor' ? 'a floor needs walls, pillars or a slab under its edge' : 'nothing here to connect to' };
    for (var i = 0; i < lv.length; i++) {
      var y = lv[i];
      if (_occupied[def.slot + '|' + sock.key + '|' + r1(y)]) continue;
      if (y > MAXY) return { ok: false, y: y, reason: 'four storeys is the ceiling for now' };
      return { ok: true, y: y, connected: y > 0 || !!_supports[sock.key], reason: '' };
    }
    return { ok: false, y: lv[lv.length - 1], reason: 'that socket is taken' };
  }
  function hasNeighbourFoundation(sock) {
    var n = [[2, 0], [-2, 0], [0, 2], [0, -2]];
    for (var i = 0; i < n.length; i++) if (_occupied['cell|' + keyCell(sock.x + n[i][0], sock.z + n[i][1]) + '|0']) return true;
    return false;
  }
  function inBounds(x, z) { return Math.abs(x) <= BOUNDS && Math.abs(z) <= BOUNDS; }

  // ── materials (shared, built once) ──────────────────────────────────────
  var _mats = null, _bio = null;
  function canvasTex(THREE, paint) {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d'); paint(g, 128);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function seeded(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
  function mats() {
    if (_mats) return _mats;
    var THREE = T();
    var rnd = seeded(7);
    var concrete = canvasTex(THREE, function (g, n) {
      g.fillStyle = '#8f8b85'; g.fillRect(0, 0, n, n);
      for (var i = 0; i < 1400; i++) { var v = 110 + Math.floor(rnd() * 70); g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v - 6) + ',0.55)'; g.fillRect(rnd() * n, rnd() * n, 1 + rnd() * 2, 1 + rnd() * 2); }
      g.strokeStyle = 'rgba(60,58,55,0.35)'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, n - 1, n - 1);   // form-work joint
    });
    var steel = canvasTex(THREE, function (g, n) {
      g.fillStyle = '#9aa3ad'; g.fillRect(0, 0, n, n);
      for (var i = 0; i < n; i++) { var v = 140 + Math.floor(rnd() * 40); g.fillStyle = 'rgba(' + v + ',' + (v + 6) + ',' + (v + 14) + ',0.35)'; g.fillRect(0, i, n, 1); }
      g.fillStyle = 'rgba(40,44,50,0.5)'; [[10, 10], [n - 14, 10], [10, n - 14], [n - 14, n - 14]].forEach(function (p) { g.beginPath(); g.arc(p[0] + 2, p[1] + 2, 3, 0, 6.3); g.fill(); });  // rivets
    });
    var wood = canvasTex(THREE, function (g, n) {
      g.fillStyle = '#7d5232'; g.fillRect(0, 0, n, n);
      for (var y = 0; y < n; y += 2) { var a = 0.08 + rnd() * 0.18; g.fillStyle = 'rgba(40,22,10,' + a + ')'; g.fillRect(0, y + Math.sin(y * 0.3) * 1.5, n, 1); }
      g.fillStyle = 'rgba(20,10,4,0.5)'; for (var p = 32; p < n; p += 32) g.fillRect(0, p, n, 1);   // plank joints
    });
    _mats = {
      concrete: new THREE.MeshStandardMaterial({ map: concrete, color: 0xffffff, roughness: 0.93, metalness: 0.0 }),
      steel: new THREE.MeshStandardMaterial({ map: steel, color: 0xffffff, roughness: 0.34, metalness: 0.85 }),
      wood: new THREE.MeshStandardMaterial({ map: wood, color: 0xffffff, roughness: 0.74, metalness: 0.0 }),
      trim: new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.4, metalness: 0.8 }),
      core: new THREE.MeshStandardMaterial({ color: 0x0a1a22, emissive: 0x5fe0ff, emissiveIntensity: 2.2, roughness: 0.3 }),
    };
    _mats.biomech = bioMat();
    return _mats;
  }
  function bioMat() {
    if (_bio) return _bio;
    var THREE = T(), RP = W.RiggedPresence;
    if (RP && RP.makeBiomechMaterial && RP.biomechState !== 'failed') {
      _bio = RP.makeBiomechMaterial(THREE, { space: 'world', scale: 1.6, tint: '#5fe0ff', rim: 0.25 });
    } else {
      // honest fallback when the GPU refused the biomech program: dark flesh-red, conduit glow
      _bio = new THREE.MeshStandardMaterial({ color: 0x6a3a34, emissive: 0x1f6f80, emissiveIntensity: 0.5, roughness: 0.5, metalness: 0.35 });
    }
    return _bio;
  }
  // biomech pieces pulse: the shared material's time is set as any biomech mesh
  // is drawn — one float write per draw, no loop of our own.
  function pulse() { if (_bio && _bio.userData && _bio.userData.uTime) _bio.userData.uTime.value = performance.now() / 1000; }

  // ── geometry (local frame: origin at the socket, y = 0 at the base level;
  //     edge pieces span local X; rotation.y = rot·90° turns them) ───────────
  function box(THREE, w, h, d, m, x, y, z) {
    var g = new THREE.BoxGeometry(w, h, d);
    var mesh = new THREE.Mesh(g, m);
    mesh.position.set(x || 0, y || 0, z || 0);
    return mesh;
  }
  function scaleUV(geo, u, v) { var a = geo.attributes.uv; for (var i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * u, a.getY(i) * v); a.needsUpdate = true; }
  function makePiece(pieceId, matName, ghostMat) {
    var THREE = T(), M = mats();
    var body = ghostMat || M[matName] || M.concrete;
    var trim = ghostMat || M.trim;
    var bioM = ghostMat || M.biomech;
    var g = new THREE.Group();
    switch (pieceId) {
      case 'foundation': {
        var slab = box(THREE, C, FH, C, body, 0, FH / 2, 0); scaleUV(slab.geometry, 2, 2); g.add(slab);
        g.add(box(THREE, C + 0.02, 0.05, 0.05, trim, 0, FH - 0.025, -1), box(THREE, C + 0.02, 0.05, 0.05, trim, 0, FH - 0.025, 1));
        g.add(box(THREE, 0.05, 0.05, C + 0.02, trim, -1, FH - 0.025, 0), box(THREE, 0.05, 0.05, C + 0.02, trim, 1, FH - 0.025, 0));
        break;
      }
      case 'wall': {
        var w = box(THREE, C - 0.02, WH, 0.2, body, 0, WH / 2, 0); scaleUV(w.geometry, 2, 2.6); g.add(w);
        g.add(box(THREE, C, 0.07, 0.24, trim, 0, 0.035, 0), box(THREE, C, 0.07, 0.24, trim, 0, WH - 0.035, 0));
        break;
      }
      case 'doorway': {
        var jw = 0.6, oh = 2.1;
        var l = box(THREE, jw, WH, 0.2, body, -(C / 2 - jw / 2), WH / 2, 0); scaleUV(l.geometry, 0.6, 2.6);
        var r = box(THREE, jw, WH, 0.2, body, (C / 2 - jw / 2), WH / 2, 0); scaleUV(r.geometry, 0.6, 2.6);
        var li = box(THREE, C - 2 * jw, WH - oh, 0.2, body, 0, oh + (WH - oh) / 2, 0);
        g.add(l, r, li);
        g.add(box(THREE, 0.06, oh, 0.24, trim, -(C / 2 - jw), oh / 2, 0), box(THREE, 0.06, oh, 0.24, trim, (C / 2 - jw), oh / 2, 0));
        break;
      }
      case 'floor': {
        var f = box(THREE, C, SH, C, body, 0, SH / 2, 0); scaleUV(f.geometry, 2, 2); g.add(f);
        break;
      }
      case 'pillar': {
        g.add(box(THREE, 0.3, WH, 0.3, body, 0, WH / 2, 0));
        g.add(box(THREE, 0.42, 0.08, 0.42, trim, 0, 0.04, 0), box(THREE, 0.42, 0.08, 0.42, trim, 0, WH - 0.04, 0));
        break;
      }
      case 'stairs': {
        var steps = 8, rise = (WH + SH) / steps, run = C / steps;
        for (var i = 0; i < steps; i++) {
          var hgt = rise * (i + 1);
          g.add(box(THREE, C * 0.9, hgt, run, body, 0, hgt / 2, -C / 2 + run / 2 + i * run));
        }
        break;
      }
      case 'conduit': {
        var pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, C, 12), bioM);
        pipe.rotation.z = Math.PI / 2; pipe.position.set(0, 0.45, 0.19); g.add(pipe);
        [-0.7, 0, 0.7].forEach(function (x) {
          var clamp = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 6, 12), trim);
          clamp.rotation.y = Math.PI / 2; clamp.position.set(x, 0.45, 0.19); g.add(clamp);
        });
        break;
      }
      case 'node': {
        var base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.34, 6), bioM); base.position.y = 0.17; g.add(base);
        var ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 16), trim); ring.rotation.x = Math.PI / 2; ring.position.y = 0.36; g.add(ring);
        var core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), ghostMat || M.core); core.position.y = 0.52; g.add(core);
        if (!ghostMat) g.userData.spin = core;    // world-client's _stepStructs turns it
        break;
      }
      default: return null;
    }
    if (!ghostMat) {
      g.traverse(function (o) {
        if (!o.isMesh) return;
        o.castShadow = false; o.receiveShadow = false;
        if (o.material === M.biomech) o.onBeforeRender = pulse;
      });
    }
    return g;
  }
  function place3(g, p) {
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = (p.rot || 0) * Math.PI / 2;
  }

  // ── registry: server pieces (via world-client) + local sketch pieces ─────
  function register(p) { _pieces.set(String(p.id), p); dirty(); }

  // world-client calls this for any struct whose meta carries `piece`.
  function buildFor(s) {
    var meta = s.meta || {}, def = BY_ID[meta.piece];
    if (!def || !T()) return null;
    var rot = ((meta.r != null ? +meta.r : Math.round((+s.rot || 0) / (Math.PI / 2))) % 4 + 4) % 4;
    var mat = def.fixedMat ? def.mat : (MATS.indexOf(meta.mat) >= 0 ? meta.mat : def.mat);
    var sock = socketFor(def, +s.x || 0, +s.z || 0, rot);
    var g = makePiece(def.id, mat, null);
    if (!g) return null;
    var p = { id: String(s.id), piece: def.id, mat: mat, x: +s.x || 0, y: +s.y || 0, z: +s.z || 0, rot: rot, key: sock.key, mesh: g, local: false };
    place3(g, p);
    register(p);
    if (_pending && _pending.key === sock.key && _pending.piece === def.id) { _pending = null; say('placed — it connected.', 'ok'); }
    return g;
  }

  function reset() {
    _pieces.forEach(function (p) { if (p.local && p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh); });
    _pieces.clear(); dirty(); _localLoaded = null;
    setTimeout(loadLocal, 0);
  }

  // ── local sketch persistence (guests) ───────────────────────────────────
  var _localLoaded = null;
  function isGuest() { var w = world(); return !!(w && w._guest); }
  function localKey() { var w = world(); return 'vint:foundry:v1:' + ((w && w.currentWorldId && w.currentWorldId()) || 'hub') + ':guest'; }
  function saveLocal() {
    var arr = [];
    _pieces.forEach(function (p) { if (p.local) arr.push({ id: p.id, piece: p.piece, mat: p.mat, x: p.x, y: p.y, z: p.z, rot: p.rot }); });
    try { localStorage.setItem(localKey(), JSON.stringify(arr.slice(-600))); } catch (_) {}
  }
  function addLocal(rec) {
    var w = world(); if (!w || !w._scene) return;
    var def = BY_ID[rec.piece]; if (!def) return;
    var g = makePiece(def.id, rec.mat, null); if (!g) return;
    var sock = socketFor(def, rec.x, rec.z, rec.rot);
    var p = { id: String(rec.id), piece: def.id, mat: rec.mat, x: rec.x, y: rec.y, z: rec.z, rot: rec.rot, key: sock.key, mesh: g, local: true };
    place3(g, p);
    if (g.userData.spin) {
      // a local node has no _stepStructs ticker — spin its core on draw
      var core = g.userData.spin, last = 0;
      core.onBeforeRender = function () { var t = performance.now(); if (last) core.rotation.y += (t - last) * 0.0004; last = t; };
    }
    w._scene.add(g);
    register(p);
  }
  function loadLocal() {
    if (!isGuest() || !T() || !world()._scene) return;
    var k = localKey(); if (_localLoaded === k) return; _localLoaded = k;
    var arr = [];
    try { arr = JSON.parse(localStorage.getItem(k) || '[]'); } catch (_) {}
    if (!Array.isArray(arr)) return;
    arr.forEach(function (r) { if (r && BY_ID[r.piece]) addLocal(r); });
  }

  // ── placement state ─────────────────────────────────────────────────────
  var _sel = 'foundation', _matSel = {}, _rot = 0, _nudge = { f: 0, r: 0 };
  var _ghost = null, _ghostFor = '', _ghostOk = null, _ghostMats = null;
  var _cand = null, _pending = null, _raf = 0;

  function ghostMats() {
    if (_ghostMats) return _ghostMats;
    var THREE = T();
    function gm(c) { return new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.42, depthWrite: false }); }
    _ghostMats = { ok: gm(0x57e08c), bad: gm(0xff5a5a) };
    return _ghostMats;
  }
  function matFor(id) { var d = BY_ID[id]; return d.fixedMat ? d.mat : (_matSel[id] || d.mat); }

  function ensureGhost(ok) {
    var w = world(); if (!w || !w._scene) return null;
    var want = _sel + '|' + (ok ? 'ok' : 'bad');
    if (_ghost && _ghostFor === want) return _ghost;
    if (_ghost && _ghost.parent) _ghost.parent.remove(_ghost);
    if (_ghost) _ghost.traverse(function (o) { if (o.isMesh) o.geometry.dispose(); });
    var gm = ghostMats();
    _ghost = makePiece(_sel, matFor(_sel), ok ? gm.ok : gm.bad);
    _ghost.renderOrder = 10;
    w._scene.add(_ghost);
    _ghostFor = want;
    return _ghost;
  }
  function dropGhost() {
    if (_ghost && _ghost.parent) _ghost.parent.remove(_ghost);
    _ghostFor = '';
  }

  // The cursor: 2.6m ahead of the player, plus the nudge pad's offset in cells
  // relative to the facing quadrant — so ▲ always means "further from me".
  function cursor() {
    var w = world(), me = (w && w._me) || { x: 0, z: 0, yaw: 0 };
    var yaw = +me.yaw || 0;
    var fx = Math.sin(yaw), fz = Math.cos(yaw);
    var q = ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
    var F = [[0, 1], [1, 0], [0, -1], [-1, 0]][q];         // facing, quantized
    // right hand = world-client's strafe vector (cos yaw, -sin yaw), quantized
    var R = [F[1], -F[0]];
    return {
      x: (+me.x || 0) + fx * 2.6 + (F[0] * _nudge.f + R[0] * _nudge.r) * C,
      z: (+me.z || 0) + fz * 2.6 + (F[1] * _nudge.f + R[1] * _nudge.r) * C,
    };
  }

  // Magnetic snap: look at the socket under the cursor and its neighbours and
  // prefer one that CONNECTS to something — that is what makes it feel like the
  // piece is being pulled into place rather than dropped on graph paper.
  function candidate() {
    var def = BY_ID[_sel], P = cursor();
    var best = null;
    for (var dx = -1; dx <= 1; dx++) for (var dz = -1; dz <= 1; dz++) {
      var px = P.x + dx * C * 0.5, pz = P.z + dz * C * 0.5;
      var sock = socketFor(def, px, pz, _rot);
      var res = resolve(def, sock);
      var dist = Math.hypot(sock.x - P.x, sock.z - P.z);
      var score = dist - (res.ok && res.connected ? 1.3 : 0) + (res.ok ? 0 : 3);
      if (!best || score < best.score) best = { sock: sock, res: res, score: score };
    }
    var c = best.sock, rr = best.res;
    var ok = rr.ok, reason = rr.reason;
    if (ok && !inBounds(c.x, c.z)) { ok = false; reason = 'beyond the edge of this world'; }
    var mode = modeNow();
    if (ok && mode.blocked) { ok = false; reason = mode.blocked; }
    return { def: def, x: c.x, z: c.z, y: rr.y, key: c.key, rot: _rot, ok: ok, reason: reason, connected: !!rr.connected, mode: mode.mode };
  }

  function modeNow() {
    var w = world();
    if (!w) return { mode: 'none', blocked: 'the world has not woken yet' };
    if (w._guest) return { mode: 'local' };
    if (!(w.isConnected && w.isConnected())) return { mode: 'server', blocked: 'the world is not listening — wait for it to reconnect' };
    if (w.canBuild && !w.canBuild()) return { mode: 'server', blocked: 'this world is not yours to build in' };
    return { mode: 'server' };
  }

  function tick() {
    _raf = 0;
    if (!isOpen()) { dropGhost(); return; }
    _cand = candidate();
    var g = ensureGhost(_cand.ok);
    if (g) place3(g, { x: _cand.x, y: _cand.y, z: _cand.z, rot: _cand.rot });
    if (_ghostOk !== _cand.ok || _lastReason !== _cand.reason) {
      _ghostOk = _cand.ok; _lastReason = _cand.reason;
      if (!_pending) say(statusLine(_cand), _cand.ok ? 'ok' : 'bad');
    }
    _raf = requestAnimationFrame(tick);
  }
  var _lastReason = null;
  function statusLine(c) {
    if (!c.ok) return c.reason;
    var where = c.y > 0 ? 'snaps at ' + c.y.toFixed(2) + 'm' : (c.connected ? 'snaps to its neighbour' : 'stands on bare ground');
    return where + (c.mode === 'local' ? ' · a sketch (sign in to make it permanent)' : '');
  }

  function placeNow() {
    var c = _cand || candidate();
    if (!c.ok) { say(c.reason || 'that will not connect', 'bad'); return false; }
    var mat = matFor(c.def.id);
    var rec = { piece: c.def.id, kind: c.def.kind, x: c.x, y: c.y, z: c.z, rot: c.rot, mat: mat };
    if (c.mode === 'local') {
      rec.id = 'L' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
      addLocal(rec); saveLocal();
      say('sketched — ' + c.def.label + ' placed.', 'ok');
    } else {
      var w = world();
      var sent = false;
      try {
        sent = w.send({ t: 'world:place', kind: c.def.kind, x: c.x, y: c.y, z: c.z, rot: c.rot * Math.PI / 2,
          meta: { piece: c.def.id, mat: mat, r: c.rot, v: 1 } });
      } catch (_) {}
      if (!sent) { say('the world is not listening right now — try again in a moment.', 'bad'); return false; }
      _pending = { key: c.key, piece: c.def.id, kind: c.def.kind, at: Date.now() };
      say('placing…', 'wait');
      setTimeout(function () { if (_pending && Date.now() - _pending.at >= 5000) { _pending = null; say('no answer from the world — it may still land.', 'bad'); } }, 5100);
    }
    try { W.dispatchEvent(new CustomEvent('vint:foundry-place', { detail: Object.assign({ mode: c.mode }, rec) })); } catch (_) {}
    _ghostOk = null;
    return true;
  }

  var ERR = {
    no_claim: 'claim a plot first — set your seed stone, then build on it',
    not_your_plot: 'that ground belongs to someone else',
    out_of_bounds: 'beyond the edge of this world',
    reach: 'too far from your claim — build closer to home',
    bad_kind: 'this world does not know that piece yet',
    standing: 'your standing has not opened that piece yet',
  };
  W.addEventListener('vint:world-err', function (e) {
    var d = e.detail || {};
    if (!_pending || (d.kind && d.kind !== _pending.kind)) return;
    _pending = null;
    var code = String(d.code || '');
    var msg = ERR[code] || (code.indexOf('need_') === 0 ? 'not enough ' + code.slice(5) + (d.need ? ' — needs ' + d.need + ', you hold ' + (d.have || 0) : '') + ' (the loom weaves strand)' : 'the world refused: ' + code);
    say(msg, 'bad');
  });

  // ── the sheet ───────────────────────────────────────────────────────────
  var _sheet = null, _btn = null;
  function injectStyles() {
    if (document.getElementById('vint-foundry-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-foundry-styles';
    // Scoped under #fdSheet; the sheet box itself is dirverse-hud's .dv-sheet.
    s.textContent = [
      '#fdSheet .dv-body{display:flex;flex-direction:column;gap:8px;}',
      '#fdSheet .fd-row{display:flex;gap:4px;align-items:stretch;}',
      '#fdSheet .fd-acts{flex-wrap:wrap;}',
      '#fdSheet .fd-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;padding-bottom:2px;}',
      '#fdSheet button{font-family:inherit;cursor:pointer;color:#dce7ff;background:rgba(255,255,255,0.05);',
      ' border:1px solid rgba(255,255,255,0.1);border-radius:11px;min-height:44px;min-width:44px;box-sizing:border-box;}',
      '#fdSheet button:active{transform:scale(0.97);}',
      '#fdSheet .fd-pc{flex:0 0 auto;padding:0 10px;font-size:13px;white-space:nowrap;}',
      '#fdSheet .fd-pc.on,#fdSheet .fd-mc.on{background:rgba(124,207,255,0.16);border-color:rgba(124,207,255,0.5);color:#eaf3ff;}',
      '#fdSheet .fd-mc{flex:1 1 0;min-width:0;padding:0 6px;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#fdSheet .fd-mc:disabled{opacity:0.35;cursor:default;}',
      '#fdSheet .fd-k{flex:0 0 44px;font-size:17px;padding:0;}',
      '#fdSheet .fd-go{flex:1 1 72px;font-size:15px;letter-spacing:.04em;color:#cfffe0;',
      ' background:rgba(87,224,140,0.14);border-color:rgba(87,224,140,0.45);}',
      '#fdSheet .fd-go.bad{color:rgba(255,190,190,0.7);background:rgba(255,90,90,0.08);border-color:rgba(255,90,90,0.3);}',
      '#fdStat{display:block;font-size:12px;letter-spacing:.03em;font-style:italic;margin-top:1px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:calc(100vw - 110px);}',
      '#fdStat.ok{color:rgba(150,240,185,0.85);} #fdStat.bad{color:rgba(255,160,160,0.9);} #fdStat.wait{color:rgba(206,224,255,0.65);}',
      // the scrim stays (it still catches the tap that closes us) but goes clear,
      // so the ghost — the whole point of this surface — is not dimmed or blurred.
      'body.fd-open #dvScrim{background:transparent;backdrop-filter:none;-webkit-backdrop-filter:none;}',
    ].join('');
    document.head.appendChild(s);
  }
  function btn(cls, id, text, aria) {
    return '<button class="' + cls + '" ' + (id ? 'id="' + id + '" ' : '') + 'data-draggable="false" aria-label="' + aria + '">' + text + '</button>';
  }
  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var el = document.createElement('div');
    el.className = 'dv-sheet'; el.id = 'fdSheet';
    var pcs = PIECES.map(function (p) { return btn('fd-pc', '', p.glyph + ' ' + p.label, p.label).replace('<button ', '<button data-piece="' + p.id + '" '); }).join('');
    var mts = MATS.map(function (m) { return btn('fd-mc', '', m, m + ' material').replace('<button ', '<button data-mat="' + m + '" '); }).join('');
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the foundry<small id="fdStat" class="wait" aria-live="polite">choose a piece</small></div>' +
        btn('dv-x', 'fdX', '✕', 'close') +
      '</div>' +
      '<div class="dv-body">' +
        '<div class="fd-row fd-acts">' +
          btn('fd-k', 'fdL', '◀', 'nudge left') + btn('fd-k', 'fdF', '▲', 'nudge further') +
          btn('fd-k', 'fdB', '▼', 'nudge closer') + btn('fd-k', 'fdR', '▶', 'nudge right') +
          btn('fd-k', 'fdRot', '⟳', 'rotate 90 degrees (G)') + btn('fd-go', 'fdGo', '✓ place', 'place piece (Enter)') +
        '</div>' +
        '<div class="fd-row fd-scroll" id="fdPieces">' + pcs + '</div>' +
        '<div class="fd-row" id="fdMats">' + mts + '</div>' +
      '</div>';
    document.body.appendChild(el);
    _sheet = el;
    el.querySelector('#fdX').onclick = close;
    el.querySelector('#fdL').onclick = function () { _nudge.r -= 1; };
    el.querySelector('#fdR').onclick = function () { _nudge.r += 1; };
    el.querySelector('#fdF').onclick = function () { _nudge.f += 1; };
    el.querySelector('#fdB').onclick = function () { _nudge.f -= 1; };
    el.querySelector('#fdRot').onclick = function () { _rot = (_rot + 1) % 4; };
    el.querySelector('#fdGo').onclick = placeNow;
    el.querySelectorAll('[data-piece]').forEach(function (b) { b.onclick = function () { select(b.getAttribute('data-piece')); }; });
    el.querySelectorAll('[data-mat]').forEach(function (b) {
      b.onclick = function () { if (BY_ID[_sel].fixedMat) return; _matSel[_sel] = b.getAttribute('data-mat'); _ghostFor = ''; paint(); };
    });
    paint();
    return el;
  }
  function select(id) {
    if (!BY_ID[id]) return;
    _sel = id; _nudge.f = 0; _nudge.r = 0; _ghostFor = ''; _ghostOk = null;
    paint();
  }
  function paint() {
    if (!_sheet) return;
    _sheet.querySelectorAll('[data-piece]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-piece') === _sel); });
    var d = BY_ID[_sel], cur = matFor(_sel);
    _sheet.querySelectorAll('[data-mat]').forEach(function (b) {
      var m = b.getAttribute('data-mat');
      b.classList.toggle('on', m === cur);
      b.disabled = !!d.fixedMat && m !== cur;
    });
  }
  function say(text, cls) {
    var s = _sheet && _sheet.querySelector('#fdStat'); if (!s) return;
    s.textContent = text; s.className = cls || '';
    var go = _sheet.querySelector('#fdGo'); if (go) go.classList.toggle('bad', cls === 'bad');
  }

  function open() {
    var h = hud();
    var fn = function () { build(); _sheet.classList.add('open'); afterOpen(); };
    if (h && h.openSheet) h.openSheet('foundry', fn); else fn();
  }
  function afterOpen() {
    document.body.classList.add('fd-open');
    // The docked corner pills (#vwg-pill, z≈INT_MAX) are a separate registry
    // the sheet owner does not govern: measured at 375x812 the account pill sat
    // 97x33 on this sheet. Same honest fix reckoning-hud uses — declare the
    // sheet an obstacle in both bottom corners and let VintDock lift the pills.
    try { if (W.VintDock && W.VintDock.avoid) { W.VintDock.avoid(_sheet, { corner: 'br' }); W.VintDock.avoid(_sheet, { corner: 'bl' }); } } catch (_) {}
    loadLocal();
    _ghostOk = null; _lastReason = null; _pending = null;
    if (!_raf) _raf = requestAnimationFrame(tick);
  }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    document.body.classList.remove('fd-open');
    try { if (W.VintDock && W.VintDock.unavoid && _sheet) W.VintDock.unavoid(_sheet); } catch (_) {}
    dropGhost();
    if (_raf) { cancelAnimationFrame(_raf); _raf = 0; }
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  // keyboard: G rotates, Enter places — only while the foundry is up and the
  // player is not typing. (R is taken by voice range, arrows by movement.)
  W.addEventListener('keydown', function (e) {
    if (!isOpen()) return;
    if (document.activeElement && /input|textarea/i.test(document.activeElement.tagName)) return;
    var k = (e.key || '').toLowerCase();
    // a focused button already activates on Enter — do not place twice
    if (k === 'enter' && document.activeElement && document.activeElement.tagName === 'BUTTON') return;
    if (k === 'g' && !e.repeat) { _rot = (_rot + 1) % 4; e.preventDefault(); }
    else if (k === 'enter' && !e.repeat) { placeNow(); e.preventDefault(); }
  });

  // ── launcher ────────────────────────────────────────────────────────────
  function mountLauncher() {
    if (_btn) return;
    var h = hud();
    if (!h || !h.addLauncher) { setTimeout(mountLauncher, 400); return; }
    try {
      _btn = h.addLauncher('fdBtn', 'foundry', '⬢', open);
      if (h.registerSheet) h.registerSheet('foundry', isOpen, close);
    } catch (_) {}
  }
  W.addEventListener('vint:world-ready', function () { loadLocal(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
  else mountLauncher();

  W.WorldFoundry = {
    buildFor: buildFor,
    reset: reset,
    open: open,
    close: close,
    isOpen: isOpen,
    select: select,
    rotate: function () { _rot = (_rot + 1) % 4; },
    place: placeNow,
    // THE SIEGE (KWD6VBA): a wrecked piece leaves the socket index, so the lattice
    // can be rebuilt on the ruin
    forget: function (id) { if (_pieces.delete(String(id))) dirty(); },
    // read-only views for verifiers / future organs (power networks, raids)
    candidate: function () { return candidate(); },
    pieces: function () { var a = []; _pieces.forEach(function (p) { a.push({ id: p.id, piece: p.piece, mat: p.mat, x: p.x, y: p.y, z: p.z, rot: p.rot, key: p.key, local: p.local }); }); return a; },
    PIECES: PIECES.map(function (p) { return { id: p.id, label: p.label, kind: p.kind, anchor: p.anchor }; }),
  };
})();
