/* ════════════════════════════════════════════════════════════════════════════
   POWER GLOW — the Foundry's power networks, made visible.
   (AETHERHOLD, world-forger, 2026-10-18. Task Q3FFTUD.)

   WHO DECIDES. For a signed-in world the SERVER decides every network
   (~/vintinuum-api/world/power.js → world:state.power and the world:power
   broadcast after any conduit/node/doorway lands). This file only paints that
   verdict. A GUEST has no server, so their localStorage sketch is solved here by
   the SAME pure function (body/world/power-graph.js, byte-identical to the
   server's copy — the verifier diffs them).

   WHAT IT PAINTS, per powered piece, in the OWNER'S tint (your being tint for
   your own pieces; a stable colour hashed from the owner id for everyone else,
   so every viewer sees one owner as one colour):
     conduit   — a light sheath along the pipe, breathing
     node      — a halo around the core; an AUTOLOOM node (2+ nodes in one
                 network) breathes harder and wears a turning ring
     doorway   — AUTODOOR: jamb strips and a light curtain that parts as you
                 walk up to it and closes behind you
   No DOM, no fixed elements — everything lives in the 3D scene. One rAF loop,
   only while something is powered.

   KILL SWITCH: ?power=0 or localStorage vint:flag:world_power='0'.
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var W = window;
  function enabled() {
    try {
      if (/[?&]power=0\b/.test(location.search)) return false;
      if (localStorage.getItem('vint:flag:world_power') === '0') return false;
    } catch (_) {}
    return true;
  }
  if (!enabled()) { W.WorldPower = { disabled: true }; return; }

  function world() { return W.VintinuumWorld; }
  function T() { var w = world(); return (w && w._THREE) || W.THREE || null; }
  function fd() { return W.WorldFoundry; }
  function G() { return W.VintPowerGraph; }

  var _server = null;      // last server verdict for this world
  var _applied = new Map();// id → { mesh, fx, role, owner }
  var _raf = 0;
  var _mats = {};

  // ── owner tint ──────────────────────────────────────────────────────────
  function hashHue(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 360); }
  function tintOf(owner) {
    var w = world();
    var me = w && w.myUserId ? w.myUserId() : null;
    if ((owner === 'guest' || (me != null && String(owner) === String(me))) && w && typeof w._myTint === 'string' && w._myTint) return w._myTint;
    return 'hsl(' + hashHue(owner) + ',85%,62%)';
  }
  function matFor(owner) {
    var THREE = T(), col = tintOf(owner);
    if (_mats[col]) return _mats[col];
    var m = new THREE.MeshBasicMaterial({ color: new THREE.Color(col), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    m.userData.__pwr = true;
    return (_mats[col] = m);
  }

  // ── the effects, in each piece's local frame (foundry.js makePiece) ─────
  function build(role, owner, machine) {
    var THREE = T(), m = matFor(owner), g = new THREE.Group(); g.name = '__pwr';
    if (role === 'conduit') {
      var sh = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 1.9, 12, 1, true), m);
      sh.rotation.z = Math.PI / 2; sh.position.set(0, 0.45, 0.19); g.add(sh);
    } else if (role === 'node') {
      var halo = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), m); halo.position.y = 0.52; g.add(halo);
      g.userData.halo = halo;
      if (machine === 'autoloom') {
        var ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.018, 6, 28), m);
        ring.rotation.x = Math.PI / 2; ring.position.y = 0.52; g.add(ring); g.userData.ring = ring;
      }
    } else if (role === 'doorway') {
      var jw = 0.6, oh = 2.1, C = 2;
      var cur = new THREE.Mesh(new THREE.PlaneGeometry(C - 2 * jw - 0.04, oh - 0.04), m.clone());
      cur.material.userData = {}; cur.material.opacity = 0.32; cur.position.set(0, oh / 2, 0); g.add(cur); g.userData.curtain = cur;
      [-1, 1].forEach(function (s) {
        var st = new THREE.Mesh(new THREE.BoxGeometry(0.03, oh, 0.26), m); st.position.set(s * (C / 2 - jw + 0.035), oh / 2, 0); g.add(st);
      });
    }
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.renderOrder = 2; } });
    return g;
  }

  function dropFx(id) {
    var a = _applied.get(id); if (!a) return;
    if (a.fx && a.fx.parent) a.fx.parent.remove(a.fx);
    if (a.fx) a.fx.traverse(function (o) { if (o.isMesh) { o.geometry.dispose(); if (o.material && !o.material.userData.__pwr) o.material.dispose(); } });
    _applied.delete(id);
  }

  // verdict: { powered: {id: owner}, machines: {id: 'autodoor'|'autoloom'} }
  // pieces: [{ id, piece }] from the foundry registry
  function paint(verdict, pieces) {
    if (!T() || !fd() || !fd().meshOf) return 0;
    var want = {};
    (pieces || []).forEach(function (p) {
      var owner = verdict.powered[p.id];
      if (owner == null) return;
      want[p.id] = { role: p.piece, owner: String(owner), machine: verdict.machines[p.id] || null };
    });
    _applied.forEach(function (a, id) {
      var w = want[id];
      if (!w || w.role !== a.role || w.owner !== a.owner || w.machine !== a.machine || a.mesh !== fd().meshOf(id)) dropFx(id);
    });
    var n = 0;
    Object.keys(want).forEach(function (id) {
      n++;
      if (_applied.has(id)) return;
      var mesh = fd().meshOf(id); if (!mesh) return;
      var w = want[id], fx = build(w.role, w.owner, w.machine);
      mesh.add(fx);
      _applied.set(id, { mesh: mesh, fx: fx, role: w.role, owner: w.owner, machine: w.machine });
    });
    if (_applied.size && !_raf) _raf = requestAnimationFrame(step);
    return n;
  }

  function localVerdict(pieces) {
    var g = G(); if (!g) return { powered: {}, machines: {}, networks: [] };
    var structs = [];
    pieces.forEach(function (p) {
      if (!p.local) return;
      structs.push({ id: p.id, owner_id: 'guest', kind: g.KIND_OF[p.piece] || p.piece, x: p.x, y: p.y, z: p.z, rot: p.rot * Math.PI / 2, meta: { piece: p.piece, r: p.rot } });
    });
    return g.solve(structs);
  }

  // Merge the server verdict (server pieces) with a local solve (guest sketch).
  var _last = { powered: {}, machines: {}, networks: [] };
  function refresh() {
    if (!fd() || !fd().pieces) return;
    var pieces = fd().pieces();
    var v = { powered: {}, machines: {}, networks: [] };
    var s = _server || { powered: {}, machines: {}, networks: [] };
    var l = localVerdict(pieces);
    [s, l].forEach(function (x) {
      Object.keys(x.powered || {}).forEach(function (k) { v.powered[k] = x.powered[k]; });
      Object.keys(x.machines || {}).forEach(function (k) { v.machines[k] = x.machines[k]; });
      v.networks = v.networks.concat(x.networks || []);
    });
    _last = v;
    paint(v, pieces);
  }

  // ── the breathing + the parting curtain ─────────────────────────────────
  function step() {
    _raf = 0;
    if (!_applied.size) return;
    var t = performance.now() / 1000, w = world(), me = (w && w._me) || null;
    var p = 0.5 + 0.5 * Math.sin(t * 2.1);
    Object.keys(_mats).forEach(function (k) { _mats[k].opacity = 0.32 + 0.3 * p; });
    _applied.forEach(function (a) {
      var ud = a.fx.userData;
      if (ud.halo) ud.halo.scale.setScalar((a.machine === 'autoloom' ? 1.05 : 0.95) + (a.machine === 'autoloom' ? 0.3 : 0.12) * p);
      if (ud.ring) ud.ring.rotation.z = t * 1.4;
      if (ud.curtain) {
        var open = false;
        if (me && a.mesh) {
          var wp = a.mesh.position;
          open = Math.hypot(wp.x - (+me.x || 0), wp.z - (+me.z || 0)) < 1.6;
        }
        var target = open ? 0 : 0.34;
        var m = ud.curtain.material;
        m.opacity += (target - m.opacity) * 0.18;
        ud.curtain.visible = m.opacity > 0.01;
        ud.curtain.scale.x = 0.05 + 0.95 * Math.min(1, m.opacity / 0.34);   // parts from the middle
      }
    });
    _raf = requestAnimationFrame(step);
  }

  // ── wiring ──────────────────────────────────────────────────────────────
  function toast(msg) { try { if (W.DirverseHUD && W.DirverseHUD.toast) W.DirverseHUD.toast(msg); } catch (_) {} }
  function take(power) {
    if (!power || typeof power !== 'object') return;
    _server = { powered: power.powered || {}, machines: power.machines || {}, networks: power.networks || [] };
    var st = power.settle;
    if (st && st.wove > 0) toast('your autoloom wove ' + st.wove + ' strand while you were away');
    else if (st && st.idle && st.code === 'not_enough_echo') toast('your autoloom sat idle — it weaves only echo above ' + (st.reserve || 12));
    // pieces from this same frame register synchronously before the event fires;
    // a frame later covers any foundry mesh built on a deferred path
    refresh(); setTimeout(refresh, 60);
  }
  W.addEventListener('vint:world-state', function (e) { var m = e.detail || {}; if (m.power) take(m.power); });
  W.addEventListener('vint:world-power', function (e) { var m = e.detail || {}; take(m.power); });
  W.addEventListener('vint:world-struct', function () { setTimeout(refresh, 0); });
  W.addEventListener('vint:foundry-place', function (e) { if (e.detail && e.detail.mode === 'local') setTimeout(refresh, 0); });
  W.addEventListener('vint:world-ready', function () { _server = null; setTimeout(refresh, 120); });

  W.WorldPower = {
    refresh: refresh,
    verdict: function () { return JSON.parse(JSON.stringify(_last)); },
    applied: function () { var o = {}; _applied.forEach(function (a, id) { o[id] = { role: a.role, owner: a.owner, machine: a.machine, tint: tintOf(a.owner) }; }); return o; },
    tintOf: tintOf,
  };
})();
