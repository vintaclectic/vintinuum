/* ════════════════════════════════════════════════════════════════════════════
   POWER GRAPH — which Foundry pieces carry power, and which machines it wakes.
   (AETHERHOLD, world-forger, 2026-10-18. Task Q3FFTUD.)

   ONE PURE FUNCTION, TWO COPIES, BYTE-IDENTICAL:
     ~/vintinuum-api/world/power-graph.js   — the server's verdict (authoritative)
     ~/vintinuum/body/world/power-graph.js  — the guest sketch's mirror
   The verifier (scripts/verify-world-power-Q3FFTUD.js) fails if they differ, so
   the client can never draw a network the server would not decide.

   THE RULE, on the Foundry's 2m lattice (body/world/foundry.js socketFor):
     · A CONDUIT (meta.piece 'conduit', server kind 'fence') lies on an edge and
       joins the two lattice corners at its ends, at its own level.
     · A POWER NODE (meta.piece 'node', kind 'light') sits on a corner.
     · A NETWORK is a set of corners joined by conduits, scoped to ONE OWNER —
       your conduit never carries power into a neighbour's build, and theirs
       never lights yours. A network with at least one node is LIVE; every
       conduit and node in it is powered.
     · MACHINES — what live power unlocks:
         autodoor — a DOORWAY (kind 'door') whose either jamb corner touches a
                    live network of the same owner at the same level. It grows a
                    light curtain that parts for the person walking through.
         autoloom — a network holding TWO OR MORE nodes. While its owner is
                    away it runs the loom by itself: echo → strand at the loom's
                    exact price (world/power.js settle). Conversion, never
                    creation — the build-loop test's faucet rule still holds.
     · A meta.piece is only believed when it matches the server kind it was paid
       for (conduit↔fence, node↔light, doorway↔door). A 1-strand fence claiming
       to be a node is just a fence.
   ════════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VintPowerGraph = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var C = 2;
  var KIND_OF = { conduit: 'fence', node: 'light', doorway: 'door' };
  var AUTOLOOM_NODES = 2;

  function r1(v) { return Math.round(v * 100) / 100; }
  function lineOf(v) { return Math.round(v / C) * C; }
  function mid(v) { return Math.floor(v / C) * C + 1; }
  function metaOf(s) {
    var m = s && s.meta;
    if (m && typeof m === 'object') return m;
    if (typeof m === 'string' && m.charAt(0) === '{') { try { return JSON.parse(m); } catch (_) { return null; } }
    return null;
  }
  function rotOf(s, m) {
    var r = (m && m.r != null && isFinite(+m.r)) ? +m.r : Math.round((+s.rot || 0) / (Math.PI / 2));
    return ((Math.round(r) % 4) + 4) % 4;
  }
  // the two corners at the ends of an edge piece (same math as foundry socketFor)
  function edgeEnds(x, z, rot) {
    if (rot % 2 === 0) { var ex = mid(x), ez = lineOf(z); return [[ex - 1, ez], [ex + 1, ez]]; }
    var fx = lineOf(x), fz = mid(z);
    return [[fx, fz - 1], [fx, fz + 1]];
  }
  function ck(owner, x, z, y) { return owner + '|' + r1(x) + ':' + r1(z) + '|' + r1(y); }

  // structs: [{ id, owner_id, kind, x, y, z, rot, meta }]
  function solve(structs) {
    var parent = {};
    function find(a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
    function add(a) { if (!(a in parent)) parent[a] = a; }
    function join(a, b) { add(a); add(b); var x = find(a), y = find(b); if (x !== y) parent[x] = y; }

    var conduits = [], nodes = [], doors = [];
    (structs || []).forEach(function (s) {
      if (!s || s.id == null) return;
      var m = metaOf(s); if (!m || !KIND_OF[m.piece]) return;
      if (String(s.kind) !== KIND_OF[m.piece]) return;          // paid-for kind must match the shape
      var owner = String(s.owner_id == null ? '' : s.owner_id);
      var x = +s.x || 0, y = +s.y || 0, z = +s.z || 0, rot = rotOf(s, m);
      var rec = { id: String(s.id), owner: owner, y: y };
      if (m.piece === 'node') {
        rec.k = ck(owner, lineOf(x), lineOf(z), y); add(rec.k); nodes.push(rec);
      } else {
        var e = edgeEnds(x, z, rot);
        rec.a = ck(owner, e[0][0], e[0][1], y); rec.b = ck(owner, e[1][0], e[1][1], y);
        if (m.piece === 'conduit') { join(rec.a, rec.b); conduits.push(rec); } else doors.push(rec);
      }
    });

    var nets = {};   // root → network
    function net(k) {
      var r = find(k);
      return nets[r] || (nets[r] = { owner: k.split('|')[0], nodes: [], conduits: [], doors: [], autoloom: false });
    }
    nodes.forEach(function (n) { net(n.k).nodes.push(n.id); });
    conduits.forEach(function (c) { net(c.a).conduits.push(c.id); });

    var powered = {}, machines = {}, out = [];
    Object.keys(nets).forEach(function (r) {
      var n = nets[r]; if (!n.nodes.length) return;            // no node, no power
      n.autoloom = n.nodes.length >= AUTOLOOM_NODES;
      n.nodes.forEach(function (id) { powered[id] = n.owner; if (n.autoloom) machines[id] = 'autoloom'; });
      n.conduits.forEach(function (id) { powered[id] = n.owner; });
      n.root = r;
    });
    doors.forEach(function (d) {
      var hit = null;
      [d.a, d.b].forEach(function (k) {
        if (hit || !(k in parent)) return;
        var n = nets[find(k)]; if (n && n.nodes.length) hit = n;
      });
      if (!hit) return;
      powered[d.id] = d.owner; machines[d.id] = 'autodoor'; hit.doors.push(d.id);
    });
    Object.keys(nets).forEach(function (r) {
      var n = nets[r]; if (!n.nodes.length) return;
      out.push({ owner: n.owner, nodes: n.nodes.slice(), conduits: n.conduits.slice(), doors: n.doors.slice(), autoloom: n.autoloom });
    });
    out.sort(function (a, b) { return (a.nodes[0] < b.nodes[0]) ? -1 : 1; });
    return { v: 1, powered: powered, machines: machines, networks: out };
  }

  // how many autolooms one owner runs in a solved world
  function autoloomsOf(solved, owner) {
    var n = 0; owner = String(owner);
    (solved && solved.networks || []).forEach(function (w) { if (w.autoloom && w.owner === owner) n++; });
    return n;
  }

  return { solve: solve, autoloomsOf: autoloomsOf, KIND_OF: KIND_OF, AUTOLOOM_NODES: AUTOLOOM_NODES };
});
