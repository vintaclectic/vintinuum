/* ════════════════════════════════════════════════════════════════════════════
   BUILD-SNAP — sockets that join pieces edge-to-edge, the way survival builders
   do it. (FYBNHVM, 2026-10-18 — "snap-connecting realistic build pieces
   (foundation/wall/floor/roof/door sockets that join edge-to-edge) for users
   and agents".)

   ONE PURE MODULE, TWO HOMES. This file is loaded by world.html (window.VintSnap)
   AND required by the brain (~/vintinuum-api/world/build-snap.js is a byte-for-
   byte twin; scripts/verify-build-snap-FYBNHVM.js fails if they drift). The
   client uses it to put the ghost on a socket; the server uses the SAME
   arithmetic to refuse a floating or doubled piece and to plan the blueprints a
   council agent raises for you. The preview never invents a rule the server
   does not hold.

   THE GRID IS THE FIRST FOUNDATION. The first floor you lay anywhere is free on
   the half-unit grid; every piece after that snaps to sockets offered by what is
   already standing:

     floor/foundation ─ 4 neighbour tiles (edge-to-edge, same level)
                      ─ 4 edges   → wall · door · window · arch · fence
                      ─ 4 corners → pillar
                      ─ 1 centre  → light · lantern · planter · banner · beacon · shelf
                      ─ 4 outward → stair (foot on the neighbour tile, climbing in)
     wall-line piece  ─ the same edge one storey up (stacked walls)
                      ─ the 2 tiles either side, at its top → upper floor · roof

   THE STOREY (all numbers in world units, shared with world-client _PIECE):
     a floor plate is FLOOR_T (0.08) thick and its base sits on the level line;
     wall-line pieces stand ON the plate (level + 0.08) and are WALL_H (1.9) tall,
     so their tops are exactly one STOREY (1.98) above the level line — which is
     where the next floor's plate starts and where a roof's authored base (1.9
     above its own origin, placed at level + 0.08) lands. Nothing floats and
     nothing interpenetrates: the joint IS the socket.

   OCCUPANCY. Every piece owns one slot key — a tile, an edge, a corner, or a
   tile-centre — at its level. A roof and the next storey's floor share the same
   key (both cap the room), so you cannot lay a floor through a roof.
   ════════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VintSnap = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FLOOR_T = 0.08, WALL_H = 1.9, STOREY = FLOOR_T + WALL_H;  // 1.98
  const MAX_LEVELS = 4;                 // the highest plate sits at 3 storeys up
  const MAX_Y = STOREY * MAX_LEVELS;
  const SNAP_R = 0.9;                   // how far the aim may be from a socket
  const HALF_PI = Math.PI / 2;

  const WALL_LINE = { wall: 1, door: 1, window: 1, arch: 1, fence: 1 };
  const SURFACE = { light: 1, lantern: 1, planter: 1, banner: 1, beacon: 1, shelf: 1 };

  function r2(n) { return Math.round(n * 100) / 100; }
  function clsOf(kind) {
    if (kind === 'floor') return 'floor';
    if (WALL_LINE[kind]) return 'edge';
    if (kind === 'pillar') return 'corner';
    if (kind === 'roof') return 'roof';
    if (kind === 'stair') return 'stair';
    if (SURFACE[kind]) return 'surface';
    return 'free';
  }

  // The one slot a piece occupies. `null` for kinds that never collide by slot.
  function slotOf(kind, x, y, z) {
    const c = clsOf(kind);
    if (c === 'floor') return 'T:' + r2(x) + ',' + r2(z) + '@' + r2(y);
    if (c === 'roof')  return 'T:' + r2(x) + ',' + r2(z) + '@' + r2(y + WALL_H);
    if (c === 'edge')  return 'E:' + r2(x) + ',' + r2(z) + '@' + r2(y);
    if (c === 'corner') return 'C:' + r2(x) + ',' + r2(z) + '@' + r2(y);
    if (c === 'surface') return 'S:' + r2(x) + ',' + r2(z) + '@' + r2(y);
    if (c === 'stair') return 'T:' + r2(x) + ',' + r2(z) + '@' + r2(y);
    return null;
  }

  function occupancy(structs) {
    const occ = new Set();
    (structs || []).forEach(s => {
      const k = slotOf(String(s.kind || ''), +s.x || 0, +s.y || 0, +s.z || 0);
      if (k) occ.add(k);
    });
    return occ;
  }

  // Offsets of a tile's four edges, with the rot that faces each one outward.
  // A wall-line piece is authored 1 long on X, 0.12 deep on Z, so an edge that
  // runs along X takes rot 0/π and an edge that runs along Z takes ±π/2.
  const EDGES = [
    { dx: 0, dz: 0.5, rot: 0 },
    { dx: 0, dz: -0.5, rot: Math.PI },
    { dx: 0.5, dz: 0, rot: HALF_PI },
    { dx: -0.5, dz: 0, rot: -HALF_PI },
  ];
  const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const CORNERS = [[0.5, 0.5], [0.5, -0.5], [-0.5, 0.5], [-0.5, -0.5]];

  // Every socket a given kind could use, offered by the standing structures.
  function sockets(kind, structs) {
    const c = clsOf(kind), out = [];
    const push = (x, y, z, rot, from) => {
      if (y < -1e-6 || y > MAX_Y + 1e-6) return;
      out.push({ x: r2(x), y: r2(y), z: r2(z), rot, from });
    };
    (structs || []).forEach(s => {
      const k = String(s.kind || ''), sx = +s.x || 0, sy = +s.y || 0, sz = +s.z || 0;
      const sc = clsOf(k);
      if (sc === 'floor') {
        const top = sy + FLOOR_T;
        if (c === 'floor') NEIGHBOURS.forEach(([dx, dz]) => push(sx + dx, sy, sz + dz, 0, 'floor'));
        if (c === 'edge') EDGES.forEach(e => push(sx + e.dx, top, sz + e.dz, e.rot, 'floor-edge'));
        if (c === 'corner') CORNERS.forEach(([dx, dz]) => push(sx + dx, top, sz + dz, 0, 'floor-corner'));
        if (c === 'surface') push(sx, top, sz, +s.rot || 0, 'floor-centre');
        // a stair's foot stands on the neighbour tile and climbs TOWARD this floor
        // (the stair is authored climbing +Z, so it faces the floor it serves)
        if (c === 'stair') EDGES.forEach(e => push(sx + e.dx * 2, sy, sz + e.dz * 2, e.rot + Math.PI, 'floor-stair'));
      } else if (sc === 'edge') {
        const top = sy + WALL_H;                       // = the next level line
        if (c === 'edge') push(sx, top + FLOOR_T, sz, +s.rot || 0, 'wall-stack');
        // the two tiles this edge divides: their centres sit ±0.5 across it
        const along = Math.abs(Math.sin(+s.rot || 0)) > 0.5;      // edge runs along Z
        const tiles = along ? [[0.5, 0], [-0.5, 0]] : [[0, 0.5], [0, -0.5]];
        if (c === 'floor') tiles.forEach(([dx, dz]) => push(sx + dx, top, sz + dz, 0, 'wall-top'));
        if (c === 'roof') tiles.forEach(([dx, dz]) => push(sx + dx, sy, sz + dz, along ? HALF_PI : 0, 'wall-cap'));
      } else if (sc === 'corner') {
        if (c === 'corner') push(sx, sy + WALL_H + FLOOR_T, sz, 0, 'pillar-stack');
      }
    });
    return out;
  }

  // Pick the socket for `kind` nearest the aim point (horizontal distance), the
  // lowest free level winning a tie. Returns null when nothing is in reach, so
  // the caller falls back to free placement on the half grid.
  function snap(kind, aim, structs, opts) {
    const occ = occupancy(structs), r = (opts && opts.radius) || SNAP_R;
    let best = null, bestD = Infinity;
    sockets(kind, structs).forEach(sk => {
      if (occ.has(slotOf(kind, sk.x, sk.y, sk.z))) return;
      const d = Math.hypot(sk.x - aim.x, sk.z - aim.z);
      if (d > r) return;
      const score = d + sk.y * 0.01;
      if (score < bestD - 1e-9) { bestD = score; best = sk; }
    });
    return best ? { x: best.x, y: best.y, z: best.z, rot: best.rot, socket: best.from, snapped: true } : null;
  }

  // The server's question: may this piece stand here? Ground pieces always have
  // support; anything above the ground must sit on a real socket. Every piece
  // must have its slot free.
  function judge(kind, pos, structs) {
    const y = +pos.y || 0;
    if (!(y >= -1e-6 && y <= MAX_Y + 1e-6)) return { ok: false, code: 'too_high' };
    const slot = slotOf(kind, +pos.x || 0, y, +pos.z || 0);
    if (slot && occupancy(structs).has(slot)) return { ok: false, code: 'occupied' };
    if (y < 0.05) return { ok: true };
    const hit = sockets(kind, structs).some(sk =>
      Math.abs(sk.x - pos.x) < 0.02 && Math.abs(sk.z - pos.z) < 0.02 && Math.abs(sk.y - y) < 0.02);
    return hit ? { ok: true } : { ok: false, code: 'unsupported' };
  }

  // ── BLUEPRINTS — whole rooms, laid in an order every step of which is
  // supported by the steps before it. Used by a council agent raising a room
  // for you (server: world:commission) and by the HUD's "raise" control.
  const BLUEPRINTS = {
    // tier 0 only: a 2×2 deck, seven walls and an open doorway — 11 strand
    shelter: { n: 'a shelter', w: 2, d: 2, door: false, roof: false, storeys: 1 },
    // door + window + a full roof — opens with the warden's rung
    hut:     { n: 'a hut',     w: 2, d: 2, door: true, window: true, roof: true, storeys: 1 },
    // 1×1, two storeys, roofed — a lookout
    tower:   { n: 'a tower',   w: 1, d: 1, door: true, roof: true, storeys: 2 },
  };

  function rotPt(dx, dz, rot) {
    const c = Math.cos(rot), s = Math.sin(rot);
    return [dx * c + dz * s, -dx * s + dz * c];
  }
  function quarter(rot) { return Math.round((+rot || 0) / HALF_PI) * HALF_PI; }

  // origin = the centre of the front-left tile, snapped to the half grid. rot is
  // squared to a quarter turn so every edge stays on the tile lattice.
  function blueprint(name, origin, rot) {
    const bp = BLUEPRINTS[name]; if (!bp) return null;
    const q = quarter(rot);
    const ox = Math.round((+origin.x || 0) * 2) / 2, oz = Math.round((+origin.z || 0) * 2) / 2;
    const plan = [];
    const at = (dx, dz) => { const [rx, rz] = rotPt(dx, dz, q); return [r2(ox + rx), r2(oz + rz)]; };
    for (let L = 0; L < bp.storeys; L++) {
      const base = L * STOREY;
      for (let i = 0; i < bp.w; i++) for (let j = 0; j < bp.d; j++) {
        const [x, z] = at(i, j); plan.push({ kind: 'floor', x, y: r2(base), z, rot: 0 });
      }
      // perimeter edges; the front edge (local -Z) carries the door on level 0
      const edges = [];
      for (let i = 0; i < bp.w; i++) { edges.push({ dx: i, dz: -0.5, front: true, i }); edges.push({ dx: i, dz: bp.d - 0.5 }); }
      for (let j = 0; j < bp.d; j++) { edges.push({ dx: -0.5, dz: j, side: true }); edges.push({ dx: bp.w - 0.5, dz: j, side: true }); }
      edges.forEach((e, n) => {
        const [x, z] = at(e.dx, e.dz);
        const erot = r2(q + (e.side ? HALF_PI : 0));
        let kind = 'wall';
        if (L === 0 && e.front && e.i === 0) { if (!bp.door) return; kind = 'door'; }
        else if (L === 0 && e.front && e.i === 1 && bp.window) kind = 'window';
        plan.push({ kind, x, y: r2(base + FLOOR_T), z, rot: erot });
      });
    }
    if (bp.roof) {
      const top = (bp.storeys - 1) * STOREY + FLOOR_T;
      for (let i = 0; i < bp.w; i++) for (let j = 0; j < bp.d; j++) {
        const [x, z] = at(i, j); plan.push({ kind: 'roof', x, y: r2(top), z, rot: r2(q) });
      }
    }
    return { name, n: bp.n, pieces: plan };
  }

  // What a plan costs against a cost table ({kind:{item:n}}).
  function planCost(plan, costs) {
    const total = {};
    (plan && plan.pieces || []).forEach(p => {
      const c = (costs && costs[p.kind]) || {};
      for (const it in c) total[it] = (total[it] || 0) + c[it];
    });
    return total;
  }

  return {
    FLOOR_T, WALL_H, STOREY, MAX_Y, SNAP_R, BLUEPRINTS,
    clsOf, slotOf, occupancy, sockets, snap, judge, blueprint, planCost,
  };
}));
