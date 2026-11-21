#!/usr/bin/env node
'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   THE FOLK, IN 3D — hermetic behaviour harness (task S8UVUC2)

   UNDER TEST: body/world/world-folk-3d.js — the module that spawns the SIM
   citizens (/api/world/citizens, via the shared VintWorldFolk store) as distinct
   3D bodies in the clearing, each with an action glyph and a distance-gated name.

   This drives the REAL SHIPPED MODULE (not a reimplementation) against a mock
   THREE + a stub 2D canvas, so every mapping/jitter/glyph/reconcile/tick path
   is the code that will run in the browser. The LIVE proof is the companion
   harness scripts/live-folk-3d-S8UVUC2.js (puppeteer, guest, deployed site).

   DISCIPLINE carried from the lessons:
     · the action vocabulary is the one the LIVE endpoint returns, not invented
       (BJDSVWE); an UNKNOWN verb is included to prove the fallback renders.
     · a check asserts a VALUE (which verb, which world point), never a shape —
       "8 bodies exist" is satisfied by 8 bodies of nothing (UGP7422).
     · NEGATIVE CONTROLS each revert ONE token, ABORT LOUDLY if the anchor
       drifted (B9HMZN3), must go RED, and no two may share a failure set
       (JX6M6BP). Run with --controls.

   USAGE:
     node scripts/verify-folk-3d-S8UVUC2.js            # the suite
     node scripts/verify-folk-3d-S8UVUC2.js --controls # + negative controls
   ════════════════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const os = require('os');

const MOD = path.resolve(__dirname, '..', 'body', 'world', 'world-folk-3d.js');

// ── a mock THREE just rich enough for the module ────────────────────────────
function vec3() {
  return { x: 0, y: 0, z: 0, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; } };
}
function base3d(type) {
  const o = {
    type, children: [], parent: null, userData: {}, visible: true,
    position: vec3(), rotation: vec3(),
    scale: { x: 1, y: 1, z: 1, set(a, b, c) { this.x = a; this.y = b; this.z = c; return this; }, setScalar(s) { this.x = this.y = this.z = s; return this; } },
    add(c) { if (c) { c.parent = this; this.children.push(c); } return this; },
    remove(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); if (c) c.parent = null; return this; },
    traverse(fn) { fn(this); for (const c of this.children) c.traverse ? c.traverse(fn) : fn(c); }
  };
  return o;
}
function mat(opts) { return Object.assign({ isMaterial: true, map: (opts && opts.map) || null, dispose() {} }, opts || {}); }
function mockTHREE() {
  const T = {
    Group: function () { return base3d('Group'); },
    Mesh: function (geo, m) { const o = base3d('Mesh'); o.geometry = geo; o.material = m; return o; },
    Sprite: function (m) { const o = base3d('Sprite'); o.material = m; o.renderOrder = 0; return o; },
    CapsuleGeometry: function () { return { isGeometry: true, kind: 'capsule' }; },
    SphereGeometry: function () { return { isGeometry: true, kind: 'sphere' }; },
    CircleGeometry: function () { return { isGeometry: true, kind: 'circle' }; },
    MeshStandardMaterial: function (o) { return mat(o); },
    MeshBasicMaterial: function (o) { return mat(o); },
    SpriteMaterial: function (o) { return mat(o); },
    CanvasTexture: function (c) { return { isTexture: true, image: c, colorSpace: null, minFilter: null, magFilter: null, generateMipmaps: true, needsUpdate: false, dispose() {} }; },
    SRGBColorSpace: 'srgb', LinearFilter: 'linear', DoubleSide: 2
  };
  // constructors must work with `new`
  for (const k of ['Group', 'Mesh', 'Sprite', 'CapsuleGeometry', 'SphereGeometry', 'CircleGeometry', 'MeshStandardMaterial', 'MeshBasicMaterial', 'SpriteMaterial', 'CanvasTexture']) {
    const f = T[k]; T[k] = function (...a) { return f(...a); };
  }
  return T;
}
function mockScene() {
  const s = base3d('Scene');
  return s;
}
// a 2D-canvas stub that counts createElement so we can prove NO non-canvas DOM
let _createEl = { canvas: 0, other: 0 };
function installDocument() {
  const ctx = new Proxy({ measureText: (s) => ({ width: String(s || '').length * 20 }) }, {
    get(t, p) { if (p in t) return t[p]; return () => {}; },
    set() { return true; }
  });
  global.document = {
    createElement(tag) {
      if (String(tag).toLowerCase() === 'canvas') { _createEl.canvas++; return { width: 0, height: 0, getContext: () => ctx }; }
      _createEl.other++; return { getContext: () => null };
    }
  };
  global.devicePixelRatio = 1;
}

// ── load a FRESH copy of the module (optionally source-mutated for a control) ──
function loadModule(mutate) {
  let src = fs.readFileSync(MOD, 'utf8');
  if (mutate) {
    const before = src;
    src = mutate.fn(src);
    if (src === before) { console.error(`CONTROL ABORT: anchor for ${mutate.name} did not match — the source moved (B9HMZN3). Not evidence.`); process.exit(2); }
  }
  const tmp = path.join(os.tmpdir(), `folk3d-S8UVUC2-${mutate ? mutate.name : 'clean'}-${process.pid}-${Math.random().toString(36).slice(2)}.js`);
  fs.writeFileSync(tmp, src);
  delete require.cache[require.resolve(tmp)];
  const api = require(tmp);
  try { fs.unlinkSync(tmp); } catch (_) {}
  return api;
}

// ── fixtures: verbs are the LIVE set (BJDSVWE) + one UNKNOWN for the fallback ──
function row(id, x, y, action, provider, over) {
  return Object.assign({
    id, name: id.replace(/^citizen_/, '').replace(/^\w/, c => c.toUpperCase()),
    x, y, placed: (x !== null && y !== null), action, tick: 100,
    energy: 50, food: 50, shelter: 80, social: 60, wallet: 100, rep: 100,
    memories: 10, provider, active: true, incap: false
  }, over || {});
}
function baseRows() {
  return [
    row('citizen_a', 2, 0, 'teach', 'claude'),
    row('citizen_b', 46, 8, 'build', 'openai'),
    row('citizen_c', 33, 55, 'rest', 'gemini'),
    row('citizen_d', 0, 0, 'forage', 'claude'),      // corner → tests clamp
    row('citizen_e', 63, 63, 'gather', 'openai'),    // opposite corner
    row('citizen_f', 20, 20, 'socialize', 'gemini'), // co-located pair →
    row('citizen_g', 20, 20, 'explore', 'claude'),   //   tests jitter fan-out
    row('citizen_h', 10, 10, 'zzz_newverb', 'openai'), // UNKNOWN verb → fallback
    row('citizen_inactive', 5, 5, 'rest', 'claude', { active: false }),
    row('citizen_incap', 6, 6, 'rest', 'openai', { incap: true }),
    row('citizen_unplaced', null, null, 'rest', 'gemini', { placed: false })
  ];
}
const SHOULD_SPAWN = ['citizen_a', 'citizen_b', 'citizen_c', 'citizen_d', 'citizen_e', 'citizen_f', 'citizen_g', 'citizen_h'];
const SHOULD_NOT = ['citizen_inactive', 'citizen_incap', 'citizen_unplaced'];

// ── the suite: returns the set of FAILING check ids ──────────────────────────
function runSuite(api, label) {
  const fails = [];
  let n = 0;
  function ok(id, cond, detail) {
    n++;
    if (!cond) { fails.push(id); if (label === 'clean') console.log(`  FAIL ${id} — ${detail || ''}`); }
  }
  const C = api.CONFIG;
  const player = { x: 999, z: 999 };
  const scene = mockScene();
  api._reset && api._reset();
  api.init({ THREE: mockTHREE(), scene, getPlayer: () => player, isMobile: false });
  ok('ready', api.isReady(), 'module did not become ready after init');

  // ── pure: mapping ──
  const p00 = api.parcelToWorld(0, 0), p63 = api.parcelToWorld(63, 63), pmid = api.parcelToWorld(31.5, 31.5);
  ok('map.corner0', Math.abs(p00.x - (-15)) < 0.01 && Math.abs(p00.z - (-15)) < 0.01, `parcel(0,0)->${JSON.stringify(p00)} want (-15,-15)`);
  ok('map.corner63', Math.abs(p63.x - 15) < 0.01 && Math.abs(p63.z - 15) < 0.01, `parcel(63,63)->${JSON.stringify(p63)} want (15,15)`);
  ok('map.centre', Math.abs(pmid.x) < 0.01 && Math.abs(pmid.z) < 0.01, `parcel(31.5,31.5)->${JSON.stringify(pmid)} want ~(0,0)`);

  // ── pure: every corner site stays INSIDE the clearing after jitter+clamp ──
  let allInside = true, worst = 0;
  for (const [px, py] of [[0, 0], [63, 0], [0, 63], [63, 63], [63, 32]]) {
    const s = api.siteFor({ id: 'probe_' + px + '_' + py, x: px, y: py });
    const r = Math.hypot(s.x, s.z); worst = Math.max(worst, r);
    if (r >= C.CLEAR_R) allInside = false;
  }
  ok('site.insideClearing', allInside, `a corner site landed at r=${worst.toFixed(2)} >= clearing ${C.CLEAR_R}`);

  // ── pure: jitter deterministic + separating ──
  const j1 = api.jitter('citizen_x'), j1b = api.jitter('citizen_x'), j2 = api.jitter('citizen_y');
  ok('jitter.deterministic', j1.dx === j1b.dx && j1.dz === j1b.dz, 'same id gave different jitter');
  ok('jitter.distinct', j1.dx !== j2.dx || j1.dz !== j2.dz, 'two ids gave identical jitter');
  ok('jitter.nonzero', Math.hypot(j1.dx, j1.dz) > 0.2, `jitter radius ${Math.hypot(j1.dx, j1.dz).toFixed(3)} too small to separate bodies`);

  // ── pure: glyph vocabulary (real verbs) + fallback ──
  ok('glyph.known', api.verbFor('gather') === 'gather' && api.verbFor('build') === 'build' && api.verbFor('rest') === 'rest', 'a known verb did not map to itself');
  ok('glyph.knownGlyphDiffers', api.glyphFor('gather') !== api.glyphFor('build') && api.glyphFor('rest') !== api.glyphFor('teach'), 'distinct actions share one glyph');
  ok('glyph.fallback', api.glyphFor('zzz_newverb') === api.glyphFor('totally_made_up') && api.glyphFor('gather') !== api.glyphFor('zzz_newverb'), 'unknown verb did not fall back to the neutral glyph');

  // ── pure: label distance gate ──
  ok('lod.near', api.shouldLabel(5, false) === true, 'a near citizen would not be labelled');
  ok('lod.far', api.shouldLabel(50, false) === false, 'a far citizen would still be labelled (clutter)');
  ok('lod.mobileTighter', api.shouldLabel(C.LABEL_NEAR * 0.8, false) === true && api.shouldLabel(C.LABEL_NEAR * 0.8, true) === false, 'mobile radius not tighter than desktop');

  // ── render: reconcile the base rows ──
  api._reconcileForTest(baseRows());
  const cz = () => { const m = {}; for (const c of api.citizens()) m[c.id] = c; return m; };
  let m = cz();
  ok('spawn.count', api.count() === SHOULD_SPAWN.length, `spawned ${api.count()} want ${SHOULD_SPAWN.length}`);
  ok('spawn.each', SHOULD_SPAWN.every(id => m[id] && m[id].hasMesh), 'a citizen that should spawn has no body');
  ok('spawn.excluded', SHOULD_NOT.every(id => !m[id]), 'an inactive/incap/unplaced row got a body');
  ok('spawn.glyphEach', SHOULD_SPAWN.every(id => m[id] && m[id].hasGlyph), 'a body has no action glyph');

  // ── render: VALUE checks — verb + world point, not shape ──
  ok('value.verbTeach', m['citizen_a'] && m['citizen_a'].verb === 'teach' && m['citizen_a'].action === 'teach', `a.verb=${m['citizen_a'] && m['citizen_a'].verb}`);
  ok('value.verbGather', m['citizen_e'] && m['citizen_e'].verb === 'gather', `e.verb=${m['citizen_e'] && m['citizen_e'].verb}`);
  ok('value.verbFallbackGlyph', m['citizen_h'] && m['citizen_h'].glyph === api.glyphFor('anything_unknown'), 'unknown-verb body did not carry the fallback glyph');
  // a NON-corner body maps from its parcel (no clamp): position == parcelToWorld + jitter
  const exp = (() => { const w = api.parcelToWorld(46, 8), j = api.jitter('citizen_b'); return { x: w.x + j.dx, z: w.z + j.dz }; })();
  ok('value.mapsFromParcel', m['citizen_b'] && Math.abs(m['citizen_b'].x - exp.x) < 1e-6 && Math.abs(m['citizen_b'].z - exp.z) < 1e-6, `b at (${m['citizen_b'] && m['citizen_b'].x.toFixed(3)},${m['citizen_b'] && m['citizen_b'].z.toFixed(3)}) want (${exp.x.toFixed(3)},${exp.z.toFixed(3)})`);
  // every rendered body sits inside the clearing disc
  ok('value.allInsideClearing', SHOULD_SPAWN.every(id => m[id] && Math.hypot(m[id].x, m[id].z) < C.CLEAR_R), 'a rendered body sits outside the clearing');

  // ── render: NO-COLLISION — the two co-located citizens are fanned apart ──
  const f = m['citizen_f'], g = m['citizen_g'];
  const sep = (f && g) ? Math.hypot(f.x - g.x, f.z - g.z) : 0;
  ok('collision.coLocatedSeparated', sep > 0.5, `two citizens on parcel (20,20) are ${sep.toFixed(3)}m apart — they stack`);

  // ── render: NO DOM — the module made only <canvas> (for textures), nothing else ──
  ok('dom.noNonCanvas', _createEl.other === 0, `module created ${_createEl.other} non-canvas DOM element(s)`);

  // ── action change rebuilds the glyph ──
  const glyphBefore = (() => { const rec = api.citizens().find(c => c.id === 'citizen_a'); return rec && rec.glyph; })();
  const rowsChanged = baseRows().map(r => r.id === 'citizen_a' ? Object.assign({}, r, { action: 'gather' }) : r);
  api._reconcileForTest(rowsChanged);
  m = cz();
  ok('change.actionUpdates', m['citizen_a'] && m['citizen_a'].action === 'gather' && m['citizen_a'].verb === 'gather' && m['citizen_a'].glyph !== glyphBefore, 'a verb change did not update the action/glyph');
  ok('change.countStable', api.count() === SHOULD_SPAWN.length, `count changed on a verb-only update: ${api.count()}`);

  // ── removal: a citizen going inactive is disposed ──
  const rowsGone = baseRows().filter(r => r.id !== 'citizen_b');
  api._reconcileForTest(rowsGone);
  m = cz();
  ok('remove.disposed', !m['citizen_b'] && api.count() === SHOULD_SPAWN.length - 1, 'a departed citizen kept its body');
  ok('remove.sceneClean', !scene.children.some(ch => ch.userData && ch.userData.__folkId === 'citizen_b'), 'departed body still in scene');

  // ── TRACKING: move citizen_c to a far parcel; tick; the body walks there ──
  api._reconcileForTest(baseRows()); // restore b + c at parcel (33,55)
  const cRec0 = api.citizens().find(c => c.id === 'citizen_c');
  const startX = cRec0.x, startZ = cRec0.z;
  const movedRows = baseRows().map(r => r.id === 'citizen_c' ? Object.assign({}, r, { x: 5, y: 5 }) : r);
  api._reconcileForTest(movedRows);
  const cRecT = api.citizens().find(c => c.id === 'citizen_c');
  const tgt = { x: cRecT.targetX, z: cRecT.targetZ };
  // target must have moved meaningfully from the start, or the test is vacuous
  const targetMoved = Math.hypot(tgt.x - startX, tgt.z - startZ);
  ok('track.targetMoved', targetMoved > 3, `fixture did not move citizen_c far enough (${targetMoved.toFixed(2)}m)`);
  // position starts at the old site; after many frames it should be near the new target
  let dBefore = Math.hypot(api.citizens().find(c => c.id === 'citizen_c').x - tgt.x, api.citizens().find(c => c.id === 'citizen_c').z - tgt.z);
  for (let k = 0; k < 400; k++) api.tick(0.05, k * 0.05);
  const cAfter = api.citizens().find(c => c.id === 'citizen_c');
  const dAfter = Math.hypot(cAfter.x - tgt.x, cAfter.z - tgt.z);
  ok('track.converges', dAfter < dBefore - 1 && dAfter < 0.2, `citizen_c did not walk to its new site: before ${dBefore.toFixed(2)} after ${dAfter.toFixed(2)}`);

  // ── LABEL LOD under tick: near → visible, far → hidden ──
  const near = api.citizens().find(c => c.id === 'citizen_a');
  player.x = near.x; player.z = near.z;
  for (let k = 0; k < 8; k++) api.tick(0.05, (1000 + k) * 0.05);
  const labNear = api.citizens().find(c => c.id === 'citizen_a').labelVisible;
  player.x = 999; player.z = 999;
  for (let k = 0; k < 8; k++) api.tick(0.05, (2000 + k) * 0.05);
  const labFar = api.citizens().find(c => c.id === 'citizen_a').labelVisible;
  ok('lod.tickShows', labNear === true, 'a body next to the player showed no name label');
  ok('lod.tickHides', labFar === false, 'a body far from the player still showed its name label');

  // ── reset clears everything ──
  api.reset && api.reset(); // will try to rebuild from VintWorldFolk.get (absent) → stays empty
  ok('reset.clears', api.count() === 0, `reset left ${api.count()} bodies`);

  return { fails, n };
}

// ── CONTROLS: one-token reverts, each must go RED with a DISTINCT failure set ──
const CONTROLS = [
  { name: 'noclamp', fn: s => s.replace('if (r > max && r > 0) { var k = max / r; x *= k; z *= k; }', 'if (false) { var k = max / r; x *= k; z *= k; }') },
  { name: 'nojitter', fn: s => s.replace('return { dx: Math.cos(ang) * r, dz: Math.sin(ang) * r };', 'return { dx: 0, dz: 0 };') },
  { name: 'constverb', fn: s => s.replace('return g ? g[1] : (a || \'\');', 'return \'X\';') },
  { name: 'nolod', fn: s => s.replace('return dist <= (isMobile ? LABEL_NEAR * 0.65 : LABEL_NEAR);', 'return true;') },
  { name: 'notrack', fn: s => s.replace('g.position.x += (rec.target.x - px) * Math.min(1, 2.4 * dt);\n      g.position.z += (rec.target.z - pz) * Math.min(1, 2.4 * dt);', 'g.position.x += 0;\n      g.position.z += 0;') },
  { name: 'nofilter', fn: s => s.replace('if (r && r.active && !r.incap && r.placed) out.push(r);', 'if (r) out.push(r);') }
];

function main() {
  installDocument();
  const doControls = process.argv.includes('--controls');
  console.log('THE FOLK, IN 3D — hermetic harness (S8UVUC2)\n');

  _createEl = { canvas: 0, other: 0 };
  const clean = runSuite(loadModule(null), 'clean');
  console.log(`CLEAN: ${clean.n - clean.fails.length}/${clean.n} pass` + (clean.fails.length ? `  FAILED: ${clean.fails.join(', ')}` : ''));

  let controlsOk = true;
  if (doControls) {
    console.log('\nNEGATIVE CONTROLS (each reverts one token; must go RED; failure sets must be pairwise-distinct):');
    const sets = {};
    for (const ctl of CONTROLS) {
      _createEl = { canvas: 0, other: 0 };
      const res = runSuite(loadModule(ctl), ctl.name);
      const red = res.fails.length > clean.fails.length;
      sets[ctl.name] = res.fails.slice().sort().join('|');
      console.log(`  --control-${ctl.name}: ${res.n - res.fails.length}/${res.n}` + (red ? ` RED ✓  (${res.fails.join(', ')})` : `  NOT RED ✗`));
      if (!red) controlsOk = false;
    }
    // pairwise-distinct failure sets (JX6M6BP)
    const names = Object.keys(sets);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      if (sets[names[i]] === sets[names[j]]) { console.log(`  ✗ controls ${names[i]} and ${names[j]} share a failure set — one is vacuous (JX6M6BP)`); controlsOk = false; }
    }
    if (controlsOk) console.log('  all controls RED, all failure sets pairwise-distinct ✓');
  }

  const pass = clean.fails.length === 0 && (!doControls || controlsOk);
  console.log(`\n${pass ? 'PASS' : 'FAIL'} — ${clean.n - clean.fails.length}/${clean.n} checks` + (doControls ? `, ${CONTROLS.length} controls` : ''));
  process.exit(pass ? 0 : 1);
}
main();
