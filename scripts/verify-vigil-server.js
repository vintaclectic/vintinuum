#!/usr/bin/env node
/* verify-vigil-server.js — THE VIGIL, PROVEN AGAINST THE REAL BRAIN.
   ────────────────────────────────────────────────────────────────────────────
   WHY THIS EXISTS, ON TOP OF verify-vigil-collision.js

   Every VIGIL proof before this one was OFFLINE. verify-vigil-collision.js is
   honest about what it measures — pixels — but to get a populated vigil it
   INJECTS a synthetic `living` payload straight into the surface, because the
   collision harness has no brain behind it. So it proves the CLIENT renders a
   living picture without colliding. It cannot prove the SERVER ever emits one.

   That left the load-bearing half of THE VIGIL unverified:
     · does world:state actually carry living{spark,floor,driftPerDay,watchers,reach}?
     · does world:tend return world:tend:ok{tended,gained,living}?
     · does absence actually drain spark, and does the court actually hold it up?
     · does the homecoming gift pay on re-entry, and only on re-entry?
     · does the legacy path (no `living`) still produce a renderable frame?

   If the server contract drifts from what body/world/world-hud.js reads, the
   HUD does not crash — it silently falls into its degraded bare-bar path and
   the whole survival loop becomes an invisible no-op. That is the exact failure
   this file exists to make LOUD.

   WHAT IT DRIVES — the real code path, not a mock
   world-mvp.handle(meta, msg, send, broadcast) is the precise function the live
   WS server (world/world-server.js) calls for every world:* message. This test
   calls it directly with a captured `send`, so every frame asserted here is
   byte-for-byte the frame a browser receives. Nothing is stubbed except the
   socket itself. vigil.reconcile()/tend() run for real, against the real DB.

   THE CLOCK IS THE ONLY THING WE LIE ABOUT — and we lie about it HONESTLY.
   Decay is lazy: it is computed on read from (now - spark_at). So "three days
   passed" is expressed by backdating spark_at/vigil_at/tended_at in the test
   user's own rows — the same arithmetic the server would see if the wall clock
   had really advanced. No fake timers, no monkey-patched Date, no sleeping.

   ISOLATION — it never touches a real player.
   world_residents.user_id is an INTEGER PRIMARY KEY and real users are small
   positive integers, so the test resident is a NEGATIVE id below TEST_ID_BASE.
   Nothing in the product ever mints a negative user id, which makes collision
   with a real player impossible and makes the cleanup sweep unambiguous. Its
   rows are created at the start and DELETED in a finally block, even on
   failure; only world_residents / user_agents / world_inventory /
   world_structures are written. If the process is killed mid-run, `--sweep`
   drops any stragglers.

   PROVEN TO GO RED — the acceptance criterion, actually demonstrated.
   A green test that cannot fail is worse than no test, so this suite was
   mutation-tested against the live brain before it shipped. Four realistic
   drifts were introduced one at a time and every one was caught (exit 1):
     1. vigil.js  `driftPerDay` renamed → 10 failures (the drift sentence dies)
     2. vigil.js  `vigil.watchers` renamed → 10 failures (the orbs vanish)
     3. vigil.js  the homecoming gift silently stops paying → 2 failures
     4. world-mvp.js `world:tend:ok` stops carrying `living` → 2 failures
   Each of those four would have left the HUD rendering its silent degraded
   path in production with no error anywhere. That is precisely the class of
   failure this file converts into a loud non-zero exit.

   USAGE
     node scripts/verify-vigil-server.js          # run the suite
     node scripts/verify-vigil-server.js --sweep  # drop orphaned test users
     VIGIL_API=/path/to/vintinuum-api node scripts/verify-vigil-server.js

   Exits non-zero on any contract violation, so it can gate the commit.
   ──────────────────────────────────────────────────────────────────────────── */
'use strict';

const path = require('path');
const fs = require('fs');

// ── locate the brain ─────────────────────────────────────────────────────────
// This repo is checked out both as ~/vintinuum (beside ~/vintinuum-api) and as
// council worktrees under ~/.council-worktrees/<name>-seat-N, which are NOT
// siblings of the api repo. So try the sibling, then the canonical home path,
// then $HOME — and let VIGIL_API override everything for CI.
function findBrain() {
  const candidates = [
    process.env.VIGIL_API,
    path.resolve(__dirname, '..', '..', 'vintinuum-api'),
    path.join(process.env.HOME || '/home/vinta', 'vintinuum-api'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'world', 'vigil.js'))) return c;
  }
  return null;
}

const API = findBrain();
if (!API) {
  console.error('\n  ✖ cannot find the brain (world/vigil.js) in any of:' +
    '\n      ' + [process.env.VIGIL_API, path.resolve(__dirname, '..', '..', 'vintinuum-api'),
      path.join(process.env.HOME || '/home/vinta', 'vintinuum-api')]
      .filter(Boolean).join('\n      ') +
    '\n    set VIGIL_API=/path/to/vintinuum-api and re-run.\n');
  process.exit(2);
}

const vigil     = require(path.join(API, 'world', 'vigil.js'));
const worldMvp  = require(path.join(API, 'world', 'world-mvp.js'));
const { dbRun, dbGet, dbAll } = require(path.join(API, 'db.js'));

const HOUR = 3600, DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);

// ── tiny assert harness (no dev-dependency; this must run anywhere) ──────────
const results = [];
let failures = 0, checks = 0;
let CURRENT = '(none)';

function section(name) { CURRENT = name; results.push({ kind: 'section', name }); }
function ok(msg)   { checks++; results.push({ kind: 'pass', msg }); }
function bad(msg, detail) {
  checks++; failures++;
  results.push({ kind: 'fail', msg, detail: detail == null ? '' : String(detail), where: CURRENT });
}
function assert(cond, msg, detail) { cond ? ok(msg) : bad(msg, detail); }

function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }

/** assert a field exists AND is a finite number — the HUD's num() would silently
 *  substitute a default for a string/null, which is exactly the drift we hunt. */
function assertNum(obj, field, msg, extra) {
  const v = obj == null ? undefined : obj[field];
  assert(isNum(v), msg || ('`' + field + '` is a finite number'),
    'got ' + JSON.stringify(v) + (extra ? ' — ' + extra : ''));
  return v;
}

// ── the throwaway resident ───────────────────────────────────────────────────
// Negative ids are unreachable by the product (users are positive integers), so
// this can never shadow, read or clobber a real player's world.
const TEST_ID_BASE = -900000000;
const UID = TEST_ID_BASE - (process.pid % 100000);
const WORLD_ID = 'hub';

async function seedUser() {
  const t = now();
  // Start every test from a genuinely EMPTY court. Without this, agents seeded
  // by an earlier test survive (they carry different ids, so INSERT OR REPLACE
  // does not remove them) and the next test's court silently has extra members
  // — which showed up as "tended=5, court=4". A test that inherits state is a
  // test that lies, in either direction.
  await dbRun(`DELETE FROM user_agents WHERE owner_id=?`, [UID]);
  await dbRun(
    `INSERT OR REPLACE INTO world_residents
       (user_id, lumen, echo, spark, spark_at, vigil_at, spark_floor, updated_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [UID, 100, 12, 100, t, t, 20, t, t]
  );
}

/** Give the test user a court of N agents, each last tended `tendedAgoSec` ago. */
async function seedCourt(n, tendedAgoSec) {
  const t = now();
  const ids = [];
  for (let i = 0; i < n; i++) {
    const id = 'uagent:vigiltest:' + UID + ':' + i;
    await dbRun(
      `INSERT OR REPLACE INTO user_agents
         (id, owner_id, name, source, status, color, created_at, updated_at, tended_at, vigil_total)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, UID, 'watcher-' + i, 'test', 'active', '#ffd479',
       t - 30 * DAY, t, t - (tendedAgoSec || 0), 0]
    );
    ids.push(id);
  }
  return ids;
}

/** Backdate the resident's clocks — the honest way to express elapsed absence
 *  against a lazy, read-time decay model. */
async function backdate(sec, opts) {
  opts = opts || {};
  const t = now() - sec;
  await dbRun(
    `UPDATE world_residents SET spark_at=?, updated_at=?` +
    (opts.arrivalToo === false ? '' : `, vigil_at=?`) +
    ` WHERE user_id=?`,
    opts.arrivalToo === false ? [t, t, UID] : [t, t, t, UID]
  );
}

async function setSpark(v) {
  await dbRun(`UPDATE world_residents SET spark=? WHERE user_id=?`, [v, UID]);
}

async function cleanup(uid) {
  const u = uid || UID;
  for (const sql of [
    `DELETE FROM world_residents WHERE user_id=?`,
    `DELETE FROM user_agents    WHERE owner_id=?`,
    `DELETE FROM world_inventory WHERE user_id=?`,
    `DELETE FROM world_structures WHERE owner_id=?`,
  ]) { try { await dbRun(sql, [u]); } catch (_) {} }
}

/** Drop rows left behind by a run that was killed before its finally block.
 *  Bounded strictly to the negative test-id band, so it can never reach a real
 *  player's row even if it is run by hand against production. */
async function sweep() {
  let rows = [];
  try {
    rows = await dbAll(
      `SELECT user_id FROM world_residents WHERE user_id <= ?`, [TEST_ID_BASE]);
  } catch (_) {}
  for (const r of rows) await cleanup(r.user_id);
  console.log('swept ' + rows.length + ' orphaned vigil-test resident(s).');
}

// ── the transport shim: exactly what world-server.js hands world-mvp ─────────
/** Run one world:* message through the REAL handler and collect every frame it
 *  sent. `meta` mirrors world-server's per-socket metadata. */
async function send(msgType, extra, metaOverride) {
  const frames = [];
  const meta = Object.assign(
    { userId: UID, worldId: WORLD_ID, ownWorld: true, x: 0, z: 0 },
    metaOverride || {}
  );
  const handled = await worldMvp.handle(
    meta,
    Object.assign({ t: msgType }, extra || {}),
    (f) => frames.push(f),
    () => {}                       // broadcast — nothing else is listening here
  );
  return { handled, frames, first: (t) => frames.find(f => f && f.t === t) };
}

/* ════════════════════════════════════════════════════════════════════════════
   THE CONTRACT ASSERTION — one function, used by every test.

   This is deliberately written against what body/world/world-hud.js ACTUALLY
   READS (_renderVigil), field for field, rather than against vigil.js's return
   statement. That direction matters: if someone renames a field in vigil.js and
   updates only the server's own unit test, this still fails — because the HUD
   is the consumer whose contract we are protecting.
   ════════════════════════════════════════════════════════════════════════════ */
function assertLivingShape(L, label) {
  const p = label ? label + ': ' : '';
  if (!L || typeof L !== 'object') {
    bad(p + '`living` is an object', 'got ' + JSON.stringify(L) +
      ' — the HUD would fall into its degraded bare-bar path and the entire ' +
      'vigil surface would silently vanish.');
    return;
  }
  ok(p + '`living` is an object');

  // ── the meter: head, fill and floor band (world-hud.js:622-660)
  const spark = assertNum(L, 'spark', p + 'living.spark is a finite number');
  const max   = assertNum(L, 'max',   p + 'living.max is a finite number');
  const floor = assertNum(L, 'floor', p + 'living.floor is a finite number');
  if (isNum(spark) && isNum(max) && isNum(floor)) {
    assert(spark >= 0 && spark <= max, p + 'spark is within [0, max]',
      'spark=' + spark + ' max=' + max);
    assert(floor >= 0 && floor <= max, p + 'floor is within [0, max]',
      'floor=' + floor + ' max=' + max);
  }

  // ── the state word. stateOf() in the HUD maps this to a label + colour; an
  //    unknown word degrades the head, so the vocabulary is part of the contract.
  const STATES = ['radiant', 'warm', 'dimming', 'guttering', 'ember'];
  assert(typeof L.state === 'string' && STATES.includes(L.state),
    p + 'living.state is one of ' + STATES.join('/'), 'got ' + JSON.stringify(L.state));

  // ── the drift line — the single most load-bearing number in the surface.
  assertNum(L, 'driftPerDay', p + 'living.driftPerDay is a finite number',
    'the drift sentence renders from this');
  assert(L.hoursToFloor === null || isNum(L.hoursToFloor),
    p + 'living.hoursToFloor is a number or null', 'got ' + JSON.stringify(L.hoursToFloor));

  // ── the world's own line
  assert(typeof L.line === 'string' && L.line.length > 0,
    p + 'living.line is a non-empty string', 'got ' + JSON.stringify(L.line));

  // ── who stands watch (world-hud.js:683-705)
  const v = L.vigil;
  if (!v || typeof v !== 'object') {
    bad(p + 'living.vigil is an object', 'got ' + JSON.stringify(v));
  } else {
    ok(p + 'living.vigil is an object');
    assert(Array.isArray(v.watchers), p + 'living.vigil.watchers is an array',
      'got ' + JSON.stringify(v.watchers));
    assertNum(v, 'standing', p + 'living.vigil.standing is a finite number');
    assertNum(v, 'agents',   p + 'living.vigil.agents is a finite number');
    assertNum(v, 'nextAgentPerDay', p + 'living.vigil.nextAgentPerDay is a finite number',
      'the concrete ask renders from this');
    if (Array.isArray(v.watchers)) {
      for (const w of v.watchers) {
        assert(w && typeof w.name === 'string' && isNum(w.watch),
          p + 'each watcher carries {name, watch}', JSON.stringify(w));
        // the HUD clamps watch to [0,1] for the orb opacity — a value outside
        // that band means the server changed units on us.
        if (w && isNum(w.watch)) {
          assert(w.watch >= 0 && w.watch <= 1,
            p + 'watcher.watch is a 0..1 ratio', 'got ' + w.watch + ' for ' + w.name);
        }
      }
      if (v.watchers.length) ok(p + 'watchers carry the fields the orbs render');
      assert(v.watchers.length <= (isNum(v.standing) ? v.standing : v.watchers.length),
        p + 'watchers never exceed standing', 'watchers=' + v.watchers.length +
        ' standing=' + v.standing);
    }
  }

  // ── the reach row (world-hud.js:720-731)
  const r = L.reach;
  if (!r || typeof r !== 'object') {
    bad(p + 'living.reach is an object', 'got ' + JSON.stringify(r));
  } else {
    ok(p + 'living.reach is an object');
    assertNum(r, 'buildRadius', p + 'living.reach.buildRadius is a finite number');
    assertNum(r, 'maxStake',    p + 'living.reach.maxStake is a finite number');
  }

  // ── the homecoming trigger. world-hud.js:1168 gates the modal on
  //    num(d.living.homecoming, 0) > 0, so this must always be a number.
  assertNum(L, 'homecoming', p + 'living.homecoming is a finite number',
    'the homecoming modal is gated on this being > 0');

  // ── the promise the payload itself carries
  assert(L.safe === true, p + 'living.safe is true (nothing is ever destroyed)',
    'got ' + JSON.stringify(L.safe));
}

/* ════════════════════════════════════════════════════════════════════════════
   THE TESTS
   ════════════════════════════════════════════════════════════════════════════ */

async function testFirstEntry() {
  section('first entry — world:hello emits a full living picture');
  await seedUser();

  const { handled, frames, first } = await send('world:hello');
  assert(handled === true, 'world-mvp.handle() claims world:hello', 'returned ' + handled);
  const st = first('world:state');
  assert(!!st, 'world:hello answers with a world:state frame',
    'frames: ' + frames.map(f => f && f.t).join(', '));
  if (!st) return;

  assert(!!st.resident, 'world:state carries a resident row');
  assertLivingShape(st.living, 'first-entry');

  // A brand-new resident has an empty court, so the world MUST be leaning.
  if (st.living) {
    assert(st.living.driftPerDay > 0,
      'an empty court drains: driftPerDay > 0', 'got ' + st.living.driftPerDay);
    assert(st.living.vigil && st.living.vigil.standing === 0,
      'a fresh resident has nobody standing watch',
      'standing=' + (st.living.vigil && st.living.vigil.standing));
  }

  // The resident row's spark and the living picture must AGREE. world-mvp
  // composes them from one reconcile; if they ever diverge, the HUD's legacy
  // path (which reads resident.spark) and its vigil path draw two different
  // truths on the same panel.
  if (st.resident && st.living) {
    assert(Math.abs(Number(st.resident.spark) - Number(st.living.spark)) < 0.51,
      'resident.spark agrees with living.spark',
      'resident=' + st.resident.spark + ' living=' + st.living.spark);
  }
}

async function testDecayOverElapsedTime() {
  section('decay — spark falls with real elapsed absence, and stops at the floor');
  await seedUser();
  await setSpark(100);

  // Reconcile once at t0 so spark_at is stamped, then push it into the past.
  await send('world:hello');
  await backdate(3 * DAY, { arrivalToo: false });

  const st = (await send('world:hello')).first('world:state');
  assert(!!st && !!st.living, 'a state frame still arrives after 3 days away');
  if (!st || !st.living) return;

  const L = st.living;
  assert(L.spark < 100, 'three days of absence with no court cost light',
    'spark=' + L.spark + ' (expected < 100)');
  assert(L.spark >= L.floor - 0.51, 'decay never falls below the floor',
    'spark=' + L.spark + ' floor=' + L.floor);
  assertLivingShape(L, 'after-decay');

  // NOTHING IS EVER DESTROYED (invariant 3): a dimmed world keeps its property.
  assert(Number(st.resident.lumen) === 100 && Number(st.resident.echo) === 12,
    'decay costs LIGHT, never property (lumen/echo untouched)',
    'lumen=' + st.resident.lumen + ' echo=' + st.resident.echo);

  // THE FLOOR CATCHES. Drop to the floor and confirm a further absence holds.
  section('decay — the floor actually catches a long fall');
  await setSpark(Math.round(L.floor));
  await backdate(30 * DAY, { arrivalToo: false });
  const st2 = (await send('world:hello')).first('world:state');
  if (st2 && st2.living) {
    assert(st2.living.spark >= st2.living.floor - 0.51,
      'a 30-day absence still rests on the floor, never below',
      'spark=' + st2.living.spark + ' floor=' + st2.living.floor);
    assert(st2.living.safe === true, 'the payload still promises safe:true after a long absence');
  } else {
    bad('a state frame arrives after a 30-day absence', 'no living picture');
  }
}

async function testCourtHoldsTheLight() {
  section('the court — tended agents offset the drain');
  await seedUser();
  await setSpark(100);
  await send('world:hello');

  // Empty court: measure the lean.
  const empty = (await send('world:hello')).first('world:state');
  const driftEmpty = empty && empty.living ? empty.living.driftPerDay : null;

  // Now bring a court of five freshly-tended agents (the design's stated
  // break-even: 0.16 * 5 = 0.80 vs a 0.70/hr base drain).
  await seedCourt(5, 0);
  const held = (await send('world:hello')).first('world:state');
  assert(!!held && !!held.living, 'a state frame arrives with a court present');
  if (!held || !held.living || driftEmpty == null) return;

  const L = held.living;
  assertLivingShape(L, 'with-court');
  assert(L.driftPerDay < driftEmpty,
    'a standing court reduces the drift', 'empty=' + driftEmpty + ' held=' + L.driftPerDay);
  assert(L.vigil.standing > 0, 'the court is counted as standing watch',
    'standing=' + L.vigil.standing);
  assert(L.vigil.watchers.length > 0, 'the watchers the HUD draws as orbs are present');
  assert(L.vigil.agents >= 5, 'the full court size is reported', 'agents=' + L.vigil.agents);

  // A FADED court must be visibly weaker than a fresh one — the "idle agents
  // mean a dimming world" clause, asserted rather than assumed.
  section('the court — an untended court fades and holds less');
  await dbRun(`UPDATE user_agents SET tended_at=? WHERE owner_id=?`,
    [now() - 10 * DAY, UID]);
  const faded = (await send('world:hello')).first('world:state');
  if (faded && faded.living) {
    assert(faded.living.driftPerDay > L.driftPerDay,
      'a court left untended for 10 days holds less light',
      'fresh=' + L.driftPerDay + ' faded=' + faded.living.driftPerDay);
  } else {
    bad('a state frame arrives with a faded court', 'no living picture');
  }
}

async function testTendOneAgent() {
  section('world:tend — tending ONE agent returns tend:ok{tended,gained,living}');
  await seedUser();
  await setSpark(60);
  const ids = await seedCourt(3, 9 * DAY);   // a faded court, so tending matters
  await send('world:hello');

  const before = (await send('world:hello')).first('world:state');
  const sparkBefore = before && before.living ? before.living.spark : null;

  const { handled, frames, first } = await send('world:tend', { agentId: ids[0] });
  assert(handled === true, 'world-mvp.handle() claims world:tend', 'returned ' + handled);

  const okf = first('world:tend:ok');
  assert(!!okf, 'world:tend answers with a world:tend:ok frame',
    'frames: ' + frames.map(f => f && f.t).join(', '));
  if (!okf) return;

  assertNum(okf, 'tended', 'tend:ok.tended is a finite number');
  assertNum(okf, 'gained', 'tend:ok.gained is a finite number');
  assert(okf.tended === 1, 'tending one agent reports exactly one tended',
    'tended=' + okf.tended);
  assertLivingShape(okf.living, 'tend:ok');

  // The warmth echo (world-hud.js:1196) renders straight off tend:ok.living, so
  // this frame must be a COMPLETE picture, not a partial diff.
  if (okf.living && sparkBefore != null) {
    assert(okf.living.spark >= sparkBefore,
      'tending never costs light', 'before=' + sparkBefore + ' after=' + okf.living.spark);
  }

  // world-mvp sends a follow-up state frame so the whole surface re-renders.
  const st = first('world:state');
  assert(!!st, 'world:tend also emits a world:state so the panel re-renders');
  if (st) assertLivingShape(st.living, 'post-tend state');

  // The tend must actually have STAMPED the agent — otherwise the watch would
  // not refresh and the headline act of the loop would be cosmetic.
  const row = await dbGet(`SELECT tended_at, vigil_total FROM user_agents WHERE id=?`, [ids[0]]);
  assert(!!row && Number(row.tended_at) >= now() - 10,
    'the tended agent\'s watch is refreshed in the DB',
    'tended_at=' + (row && row.tended_at));
  assert(!!row && Number(row.vigil_total) > 0,
    'tending credits the agent\'s vigil_total (the deed the ascent counts)',
    'vigil_total=' + (row && row.vigil_total));

  // The UNtended agents must be untouched — a targeted tend is targeted.
  const other = await dbGet(`SELECT tended_at FROM user_agents WHERE id=?`, [ids[1]]);
  assert(!!other && Number(other.tended_at) < now() - DAY,
    'tending one agent does NOT refresh the rest of the court',
    'sibling tended_at=' + (other && other.tended_at));
}

async function testTendWholeCourt() {
  section('world:tend — tending the WHOLE court (no agentId) touches everyone');
  await seedUser();
  await setSpark(50);
  const ids = await seedCourt(4, 9 * DAY);
  await send('world:hello');

  const okf = (await send('world:tend')).first('world:tend:ok');
  assert(!!okf, 'a court-wide world:tend answers with world:tend:ok');
  if (!okf) return;

  assert(okf.tended === ids.length,
    'a court-wide tend reports every agent tended',
    'tended=' + okf.tended + ' court=' + ids.length);
  assertLivingShape(okf.living, 'court-tend');

  const rows = await dbAll(
    `SELECT id, tended_at FROM user_agents WHERE owner_id=?`, [UID]);
  const stale = rows.filter(r => Number(r.tended_at) < now() - 10);
  assert(stale.length === 0, 'every agent in the court had its watch refreshed',
    stale.length + ' left stale: ' + stale.map(r => r.id).join(', '));

  // A freshly-tended full court should be holding the line — the payoff the
  // design promises ("a tended court means a world that thrives while you sleep").
  if (okf.living) {
    assert(okf.living.vigil.standing === ids.length,
      'the whole tended court is standing watch',
      'standing=' + okf.living.vigil.standing);
    assert(okf.living.driftPerDay < 16.8,
      'a fully tended court drifts less than a bare 0.70/hr drain (16.8/day)',
      'driftPerDay=' + okf.living.driftPerDay);
  }
}

async function testHomecoming() {
  section('homecoming — the re-entry gift pays after a long absence, once');
  await seedUser();
  await setSpark(40);
  // Away for eight days: well past HOMECOMING_MIN_ABSENCE (12h), and long
  // enough that the gift is unmistakable rather than rounding noise.
  await backdate(8 * DAY);

  const st = (await send('world:hello')).first('world:state');
  assert(!!st && !!st.living, 'a state frame arrives on re-entry');
  if (!st || !st.living) return;

  const L = st.living;
  assertLivingShape(L, 'homecoming');
  assert(L.homecoming > 0,
    'coming back after 8 days pays a homecoming gift',
    'homecoming=' + L.homecoming +
    ' — the HUD gates its homecoming modal on this being > 0, so a zero here ' +
    'means the entire re-entry moment silently never fires.');
  assert(L.homecoming <= 40.001, 'the homecoming is capped (never unbounded)',
    'homecoming=' + L.homecoming);

  // RE-ENTRY IS A GIFT, NOT A BILL (invariant 5) — it must ADD light.
  assert(L.spark >= 40, 'the homecoming leaves the world no dimmer than it was',
    'spark=' + L.spark);

  // ...and it must not be farmable. A second world:hello moments later has an
  // absence of ~0, so the gift must be zero.
  const again = (await send('world:hello')).first('world:state');
  assert(!!again && again.living && again.living.homecoming === 0,
    'a chatty client cannot farm the homecoming (second hello pays 0)',
    'second homecoming=' + (again && again.living && again.living.homecoming));

  // A SHORT absence is not an absence at all.
  section('homecoming — a short absence pays nothing (under half a day)');
  await seedUser();
  await backdate(2 * HOUR);
  const short = (await send('world:hello')).first('world:state');
  assert(!!short && short.living && short.living.homecoming === 0,
    'a 2-hour gap pays no homecoming',
    'homecoming=' + (short && short.living && short.living.homecoming));

  // A NON-ARRIVING read must never pay the gift — only world:hello arrives.
  section('homecoming — only an ARRIVAL pays; a plain read never does');
  await seedUser();
  await backdate(8 * DAY);
  const pic = await vigil.reconcile(UID);           // no {arriving:true}
  assert(pic && pic.homecoming === 0,
    'a non-arriving reconcile pays no homecoming',
    'homecoming=' + (pic && pic.homecoming));
}

async function testLegacyServerPath() {
  section('legacy path — a frame with no `living` must still be renderable');
  await seedUser();
  const st = (await send('world:hello')).first('world:state');
  if (!st) { bad('a state frame arrives', 'none'); return; }

  // Simulate the older brain: strip `living` entirely, exactly as a pre-vigil
  // server would have sent it. The HUD's contract (world-hud.js:609-619) is
  // that it falls back to resident.spark and draws the bare bar. That requires
  // the resident row to carry a usable spark even when `living` is absent.
  const legacy = Object.assign({}, st);
  delete legacy.living;

  assert(legacy.resident && isNum(Number(legacy.resident.spark)),
    'a living-less frame still carries resident.spark for the bare-bar fallback',
    'resident.spark=' + (legacy.resident && legacy.resident.spark));
  const bare = Number(legacy.resident && legacy.resident.spark);
  assert(bare >= 0 && bare <= 100,
    'the fallback spark is inside the bar\'s 0..100 range', 'got ' + bare);

  // The three-valued `living` contract (world-hud.js:1096-1104): world:state
  // ALWAYS decides — either an object or an explicit null, never undefined-by-
  // omission dressed up as "no change". world-mvp sends `living` as a key even
  // when reconcile fails, so assert the key is PRESENT on the real frame.
  assert(Object.prototype.hasOwnProperty.call(st, 'living'),
    'world:state always carries a `living` key (object or null), never omits it',
    'keys: ' + Object.keys(st).join(', '));
}

async function testTierAndReachAtLowSpark() {
  section('the consequence tier — a dim world reaches less, but is never denied');
  await seedUser();
  await setSpark(100);
  const bright = await vigil.reconcile(UID);

  await setSpark(12);            // ember territory
  await dbRun(`UPDATE world_residents SET spark_floor=? WHERE user_id=?`, [10, UID]);
  const dim = await vigil.reconcile(UID);

  assert(!!bright && !!dim, 'both a bright and a dim picture reconcile');
  if (!bright || !dim) return;

  assertLivingShape(bright, 'bright');
  assertLivingShape(dim, 'dim');

  assert(dim.reach.buildRadius <= bright.reach.buildRadius,
    'a dim world\'s build radius draws in',
    'bright=' + bright.reach.buildRadius + ' dim=' + dim.reach.buildRadius);
  assert(dim.reach.maxStake <= bright.reach.maxStake,
    'a dim world carries a smaller stake',
    'bright=' + bright.reach.maxStake + ' dim=' + dim.reach.maxStake);

  // IT SCALES, IT NEVER FORBIDS — the tier's whole ethical premise.
  assert(dim.reach.buildRadius > 0,
    'even an ember world may still build (dimming, never denial)',
    'buildRadius=' + dim.reach.buildRadius);
  assert(dim.reach.maxStake > 0,
    'even an ember world may still stake a venture',
    'maxStake=' + dim.reach.maxStake);
  assert(dim.safe === true, 'an ember world still promises safe:true');

  // The tier object the HUD and every enforcement site read from.
  assert(dim.tier && isNum(dim.tier.yieldPct) && isNum(dim.tier.watchSlots),
    'living.tier carries {yieldPct, watchSlots}', JSON.stringify(dim.tier));
}

/* ════════════════════════════════════════════════════════════════════════════
   RUNNER
   ════════════════════════════════════════════════════════════════════════════ */
async function main() {
  if (process.argv.includes('--sweep')) { await sweep(); return 0; }

  console.log('\n\x1b[1mTHE VIGIL — server contract, against the live brain\x1b[0m');
  console.log('  brain: ' + API);
  console.log('  test resident: ' + UID + '\n');

  try {
    worldMvp.init({});                       // host shim; nothing here broadcasts
  } catch (_) {}

  const suite = [
    testFirstEntry,
    testDecayOverElapsedTime,
    testCourtHoldsTheLight,
    testTendOneAgent,
    testTendWholeCourt,
    testHomecoming,
    testLegacyServerPath,
    testTierAndReachAtLowSpark,
  ];

  try {
    for (const fn of suite) {
      try {
        await fn();
      } catch (e) {
        // A THROW IS A FAILURE, NEVER A SKIP. A test that explodes must be as
        // loud as one that asserts false — otherwise a renamed export would
        // quietly turn the suite green by emptying it.
        bad('the "' + CURRENT + '" test threw', (e && e.stack) || String(e));
      }
    }
  } finally {
    await cleanup();
  }

  // ── report ────────────────────────────────────────────────────────────────
  for (const r of results) {
    if (r.kind === 'section') console.log('\n\x1b[36m▸ ' + r.name + '\x1b[0m');
    else if (r.kind === 'pass') console.log('  \x1b[32m✓\x1b[0m ' + r.msg);
    else {
      console.log('  \x1b[31m✖ ' + r.msg + '\x1b[0m');
      if (r.detail) console.log('    \x1b[2m' + r.detail.split('\n').join('\n    ') + '\x1b[0m');
    }
  }

  console.log('\n' + '─'.repeat(70));
  if (failures) {
    console.log('\x1b[31m\x1b[1m  ✖ THE VIGIL CONTRACT HAS DRIFTED — ' + failures +
      ' of ' + checks + ' checks failed.\x1b[0m');
    console.log('\x1b[2m    The server no longer emits what body/world/world-hud.js renders.');
    console.log('    Either restore the field, or update the HUD *and* this file together.\x1b[0m\n');
    return 1;
  }
  console.log('\x1b[32m\x1b[1m  ✓ all ' + checks +
    ' checks passed — the brain speaks the vigil the HUD renders.\x1b[0m\n');
  return 0;
}

main()
  .then(code => process.exit(code))
  .catch(async (e) => {
    try { await cleanup(); } catch (_) {}
    console.error('\n\x1b[31m✖ the harness itself failed:\x1b[0m ' + ((e && e.stack) || e) + '\n');
    process.exit(2);
  });
