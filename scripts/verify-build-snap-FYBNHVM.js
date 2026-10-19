#!/usr/bin/env node
// verify-build-snap-FYBNHVM.js — snap-connecting build pieces (FYBNHVM).
// Proves: the socket math joins pieces edge-to-edge with exact contact; every
// blueprint is buildable in order under the same gate the brain runs; floating
// and doubled pieces are refused; the client and brain twins are identical; and
// the wiring (client sends y, brain gates before debit, commission reuses the
// place path) is in place.
//   node scripts/verify-build-snap-FYBNHVM.js            → all green
//   node scripts/verify-build-snap-FYBNHVM.js --no-gate  → negative control (must FAIL)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const API = process.env.VINT_API_DIR || '/home/vinta/vintinuum-api';
const S = require(path.join(ROOT, 'body/world/build-snap.js'));
const NOGATE = process.argv.includes('--no-gate');
const judge = NOGATE ? () => ({ ok: true }) : S.judge;

let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) pass++; else { fail++; console.log('FAIL', name, extra !== undefined ? JSON.stringify(extra) : ''); } }
const near = (a, b) => Math.abs(a - b) < 1e-6;

// ── 1. constants agree with the authored geometry ──────────────────────────
ok('1.1 STOREY = FLOOR_T + WALL_H', near(S.STOREY, S.FLOOR_T + S.WALL_H));
const client = fs.readFileSync(path.join(ROOT, 'body/world/world-client.js'), 'utf8');
ok('1.2 wall panel is WALL_H tall', /BoxGeometry\(1, 1\.9, 0\.12\), M\.weave\);\s*\n\s*w\.position\.y = 0\.95/.test(client));
ok('1.3 floor plate is FLOOR_T thick', /BoxGeometry\(1, 0\.08, 1\), M\.deck\)/.test(client));
ok('1.4 roof pitch authored from 1.9 up (seats on a wall top)', /occupies y 1\.90–2\.42/.test(client));
ok('1.5 door head tops out at 1.90', /head\.position\.y = 1\.85/.test(client));

// ── 2. sockets join edge-to-edge with exact contact ────────────────────────
const f0 = { kind: 'floor', x: 0, y: 0, z: 0, rot: 0 };
const nb = S.snap('floor', { x: 0.8, z: 0.1 }, [f0]);
ok('2.1 floor snaps to its neighbour tile, edge-to-edge', nb && near(nb.x, 1) && near(nb.z, 0) && near(nb.y, 0), nb);
const w = S.snap('wall', { x: 0.1, z: 0.6 }, [f0]);
ok('2.2 wall snaps to the floor edge', w && near(w.x, 0) && near(w.z, 0.5) && near(w.rot, 0), w);
ok('2.3 wall base sits ON the plate (y = FLOOR_T)', w && near(w.y, S.FLOOR_T), w);
const ws = S.snap('wall', { x: 0.58, z: 0 }, [f0]);
ok('2.4 side edge turns the wall a quarter', ws && near(ws.x, 0.5) && near(Math.abs(ws.rot), Math.PI / 2), ws);
const wall0 = { kind: 'wall', x: w.x, y: w.y, z: w.z, rot: w.rot };
const r = S.snap('roof', { x: 0, z: 0.1 }, [f0, wall0]);
ok('2.5 roof seats on the wall top: roof.y + 1.9 = wall top', r && near(r.y + S.WALL_H, wall0.y + S.WALL_H), r);
const up = S.snap('floor', { x: 0, z: 0.1 }, [f0, wall0]);
ok('2.6 upper floor plate starts exactly at the wall top', up && near(up.y, wall0.y + S.WALL_H) && near(up.y, S.STOREY), up);
const stack = S.snap('wall', { x: 0, z: 0.5 }, [f0, wall0]);
ok('2.7 occupied edge forces the stacked socket one storey up', stack && near(stack.y, wall0.y + S.STOREY), stack);
const pil = S.snap('pillar', { x: 0.45, z: 0.45 }, [f0]);
ok('2.8 pillar snaps to the tile corner', pil && near(pil.x, 0.5) && near(pil.z, 0.5), pil);
const lamp = S.snap('light', { x: 0.2, z: -0.2 }, [f0]);
ok('2.9 a light sits on the tile centre, on the plate', lamp && near(lamp.x, 0) && near(lamp.y, S.FLOOR_T), lamp);
const st = S.snap('stair', { x: 0, z: 1.1 }, [f0]);
ok('2.10 stair foot on the neighbour tile, climbing toward the floor', st && near(st.z, 1) && near(Math.cos(st.rot), -1), st);
ok('2.11 nothing in reach → null (free placement fallback)', S.snap('wall', { x: 5, z: 5 }, [f0]) === null);

// ── 3. the gate: floating and doubled pieces are refused ───────────────────
ok('3.1 floating wall refused (unsupported)', judge('wall', { x: 4, y: 1.0, z: 4 }, [f0]).ok === false);
ok('3.2 floating roof refused', judge('roof', { x: 0, y: 0.08, z: 0 }, [f0]).ok === false);
ok('3.3 doubled floor refused (occupied)', judge('floor', { x: 0, y: 0, z: 0 }, [f0]).ok === false);
ok('3.4 doubled wall on one edge refused', judge('wall', { x: 0, y: 0.08, z: 0.5 }, [f0, wall0]).ok === false);
ok('3.5 floor through a roof refused (shared cap slot)',
  judge('floor', { x: 0, y: S.STOREY, z: 0 }, [f0, wall0, { kind: 'roof', x: 0, y: 0.08, z: 0, rot: 0 }]).ok === false);
ok('3.6 above MAX_Y refused', judge('floor', { x: 0, y: S.MAX_Y + 1, z: 0 }, []).ok === false);
ok('3.7 a seated wall is accepted', S.judge('wall', w, [f0]).ok === true);

// ── 4. every blueprint builds in order, under the gate, with no shared slot ─
for (const name of Object.keys(S.BLUEPRINTS)) {
  for (const rot of [0, Math.PI / 2, 2.9]) {
    const plan = S.blueprint(name, { x: 1.3, z: -2.2 }, rot), placed = [];
    let bad = null;
    for (const pc of plan.pieces) { const v = S.judge(pc.kind, pc, placed); if (!v.ok) { bad = { pc, v }; break; } placed.push(pc); }
    ok('4 ' + name + ' @rot ' + rot.toFixed(2) + ' builds piece by piece', !bad, bad);
    const slots = plan.pieces.map(p => S.slotOf(p.kind, p.x, p.y, p.z));
    ok('4 ' + name + ' @rot ' + rot.toFixed(2) + ' no two pieces share a slot', new Set(slots).size === slots.length);
  }
}
const costs = { floor: { strand: 1 }, wall: { strand: 1 }, door: { strand: 2 }, window: { strand: 2 }, roof: { strand: 4 } };
ok('4.x shelter is tier-0 only and costs 11 strand',
  S.blueprint('shelter', { x: 0, z: 0 }, 0).pieces.every(p => p.kind === 'floor' || p.kind === 'wall') &&
  S.planCost(S.blueprint('shelter', { x: 0, z: 0 }, 0), costs).strand === 11);

// ── 5. twins + wiring ──────────────────────────────────────────────────────
const twin = path.join(API, 'world/build-snap.js');
if (fs.existsSync(twin)) {
  ok('5.1 client and brain build-snap are byte-identical',
    fs.readFileSync(twin, 'utf8') === fs.readFileSync(path.join(ROOT, 'body/world/build-snap.js'), 'utf8'));
  const mvp = fs.readFileSync(path.join(API, 'world/world-mvp.js'), 'utf8');
  const gateAt = mvp.indexOf('snapKit.judge(kind'), debitAt = mvp.indexOf("for (const [it, n] of Object.entries(PLACE_COST[kind])) await _addItem(userId, it, -n);");
  ok('5.2 brain gates sockets BEFORE the debit', gateAt > 0 && debitAt > 0 && gateAt < debitAt, { gateAt, debitAt });
  ok('5.3 commission is a write op (visitors refused)', /WRITE_OPS = new Set\(\[[^\]]*'world:commission'/.test(mvp));
  ok('5.4 commission lays each piece through handle(world:place)', /await handle\(meta, \{ t: 'world:place'/.test(mvp));
  ok('5.5 stored y is the gated y', /_insertStruct\(userId, kind, x, py, z/.test(mvp));
} else console.log('note: brain twin not found at', twin, '— twin checks skipped');
ok('5.6 client sends y with world:place', /t: 'world:place', kind, x: spot\.x, y: spot\.y \|\| 0/.test(client));
const html = fs.readFileSync(path.join(ROOT, 'world.html'), 'utf8');
ok('5.7 build-snap loads before world-client', html.indexOf('body/world/build-snap.js') > 0 && html.indexOf('body/world/build-snap.js') < html.indexOf('body/world/world-client.js'));
const hud = fs.readFileSync(path.join(ROOT, 'body/world/dirverse-hud.js'), 'utf8');
const bpCss = hud.split('\n').filter(l => l.indexOf('.dv-prop.bp') !== -1 || l.indexOf('+.dv-prop.bp') !== -1).join('\n');
ok('5.8 blueprint chips add no positioned element (flow children of the strip)', bpCss.length > 0 && !/position\s*:/.test(bpCss));

console.log((fail ? 'RED' : 'GREEN') + ' ' + pass + '/' + (pass + fail) + (NOGATE ? ' (--no-gate control)' : ''));
process.exit(fail ? 1 : 0);
