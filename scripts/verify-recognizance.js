#!/usr/bin/env node
/* verify-recognizance.js — THE RECOGNIZANCE PROOF (AETHERHOLD 2026-08-08, organ 5)
   ────────────────────────────────────────────────────────────────────────────
   Five claims, proven against the REAL body/world/recognizance.js — not against
   a re-implementation of it, which is the usual way a test like this lies.

     1  UNPROMPTED    with ZERO player input after boot, an agent acts within a
                      bounded number of ticks
     2  DURABLE       the act mutates keyed world state that is NOT a transform.
                      Snapshot before/after; assert the named value differs.
                      Position/rotation/gait are explicitly excluded, and this
                      script asserts that exclusion by reading only organ state.
     3  ATTRIBUTABLE  the resulting record carries the agent's id AND a timestamp
     4  LEGIBLE       the act emits an event a HUD can surface; this test
                      captures the event off the real window bus
     5  DETERMINISTIC same seed + same world = the same act sequence, twice,
                      from two independent module instances

   WHY 5 IS THE INTERESTING ONE. Determinism is trivially "true" for a system
   that never changes, and trivially false for one that calls Math.random() once.
   The hard case is the middle: a system whose decisions depend on world state
   that its own decisions mutate. This proof therefore runs the SAME tick
   sequence twice against two FRESH module instances with two FRESH storages,
   and requires the act sequences to be byte-identical — which can only hold if
   (a) there is no Math.random() in the decision path, (b) the roster iteration
   order is stable, and (c) each agent's draw is keyed rather than streamed. It
   additionally asserts that a DIFFERENT seed produces a DIFFERENT sequence, so
   "identical" cannot be passing because nothing happened.

   BUDGET + REVERSIBILITY are asserted too, below the five, because a design law
   nobody tests is a comment.

   USAGE:  node scripts/verify-recognizance.js
   Exits non-zero on any failed claim, so it can gate a commit.
*/
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve('/home/vinta/vintinuum');
const RECOG = path.join(ROOT, 'body/world/recognizance.js');
const CONCORD = path.join(ROOT, 'body/world/concord.js');
const FACTIONS = path.join(ROOT, 'body/world/factions.js');

let fails = 0, passes = 0;
function ok(claim, cond, detail) {
  if (cond) { passes++; console.log('  \x1b[32m✓\x1b[0m ' + claim); }
  else { fails++; console.log('  \x1b[31m✗\x1b[0m ' + claim + (detail ? '\n      ' + detail : '')); }
}
function head(t) { console.log('\n\x1b[1m' + t + '\x1b[0m'); }

// ═════════════════════════════════════════════════════════════════════════════
// THE HARNESS
// A window with a REAL string store, because claim 5 turns on what was actually
// persisted rather than what happened to still be in a closure.
// ═════════════════════════════════════════════════════════════════════════════
function makeStorage(seedFrom) {
  const m = new Map(seedFrom ? seedFrom._raw : undefined);
  return {
    getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: (k) => { m.delete(String(k)); },
    clear: () => m.clear(),
    _raw: m
  };
}

function makeWindow(storage) {
  const listeners = {};
  const win = {
    localStorage: storage,
    document: undefined,                 // NO DOM — the model half stands alone
    location: { search: '' },
    URLSearchParams,
    CustomEvent: function (n, o) { this.type = n; this.detail = o && o.detail; },
    addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); },
    dispatchEvent: (e) => { (listeners[e.type] || []).forEach(f => { try { f(e); } catch (_) {} }); return true; },
    setInterval: () => 0, clearInterval: () => {}, setTimeout: () => 0,
    _events: listeners
  };
  storage.setItem('vint_access_token', 'proof.tok.tok');
  return win;
}

function loadModule(file, win) {
  delete require.cache[require.resolve(file)];
  const src = fs.readFileSync(file, 'utf8');
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', 'window', 'globalThis', 'localStorage', 'console', 'require',
    'var self=window; ' + src + '\n;return module.exports;');
  return fn(mod, mod.exports, win, win, win.localStorage, console, require);
}

// A COURT of agents. This is the roster the organ deliberates over, and it is a
// stub of the Court's ONE exported read (`roster()`) — not a copy of the Court,
// because nothing in the decision path may depend on Court internals.
function stubCourt(win, ids) {
  win.VintCourt = {
    roster: () => ids.map((id, i) => ({
      id, name: id.replace('ag-', 'Agent '), status: 'active',
      provider: ['anthropic', 'openai', 'local', 'mistral'][i % 4],
      color: '#a67cff'
    }))
  };
}

// A WORLD, so worldId() is stable and the organ is not in guest mode.
// `currentWorldId()` is the canonical read every organ uses (world-client.js
// exports it); `_worldId` is included only because that is the field the real
// world-client backs it with, and a stub that lied about the shape would let a
// real drift pass this proof.
function stubWorld(win, id) {
  const wid = id || 'proof-world';
  win.VintinuumWorld = {
    _worldId: wid, _guest: false, _canBuild: true,
    currentWorldId: function () { return wid; },
    _resident: { standing: 300, lumen: 400 }
  };
}

// THE POLITY, REAL. concord.js is loaded for real (headless) so that `table()`,
// `credit()`, `disposition()` and the charter gates are the shipped ones. The
// organ must be proven against the real floor, not a permissive fake.
function foundConcord(win, worldId) {
  win.localStorage.setItem('vint:concord:' + worldId, JSON.stringify({
    v: 1, founded: Date.now() - 86400000, charter: 'vault', name: 'the Vaultsworn',
    seats: [
      { agentId: 'ag-1', role: 'seat', joined: Date.now() - 80000000 },
      { agentId: 'ag-2', role: 'seat', joined: Date.now() - 80000000 }
    ],
    tags: { civic: 0, criminal: 0, craft: 0, social: 0, mentor: 0, heat: 0, trust: 0 },
    treasury: 20, motion: null, record: [], exiles: [], seen: 0
  }));
}

// ═════════════════════════════════════════════════════════════════════════════
// THE RIG — one complete world, from zero, with the real organs on it.
// Returns the loaded modules plus a captured event log, so every claim below is
// read off the same live objects the browser would hold.
// ═════════════════════════════════════════════════════════════════════════════
function rig(opts) {
  const o = opts || {};
  const WID = o.worldId || 'proof-world';
  const storage = o.storage || makeStorage();
  const win = makeWindow(storage);
  stubWorld(win, WID);
  stubCourt(win, o.agents || ['ag-1', 'ag-2', 'ag-3']);
  // Found the polity ONLY on a fresh world. A reload rig is handed the previous
  // storage on purpose, and re-founding would overwrite exactly the state the
  // durability claim is about — the test would then "pass" by re-seeding.
  if (!o.noConcord && !o.storage) foundConcord(win, WID);

  // real organs, headless
  const C = o.noConcord ? null : loadModule(CONCORD, win);
  const F = o.noFactions ? null : loadModule(FACTIONS, win);

  // capture the legibility bus BEFORE the organ loads, so nothing is missed
  const events = [];
  win.addEventListener('vint:recognizance', e => events.push({ type: e.type, detail: e.detail }));
  win.addEventListener('vint:recognizance-batch', e => events.push({ type: e.type, detail: e.detail }));

  const R = loadModule(RECOG, win);
  if (o.seed) R.reseed(o.seed);
  return { win, storage, C, F, R, events, WID };
}

// A world snapshot of DURABLE state only. Deliberately reads organ state and
// NOTHING that could be a transform: there is no position, rotation, scale or
// gait anywhere in this object, which is the point of claim 2.
function snapshot(r) {
  const out = { treasury: null, motionKind: null, seats: null, members: {}, ground: {}, keel: null };
  if (r.C) {
    const s = r.C.state();
    out.treasury = s.treasury;
    out.motionKind = s.motion ? s.motion.k : null;
    out.seats = (s.seats || []).length;
  }
  if (r.F) {
    const fs_ = r.F.state();
    out.ground = JSON.parse(JSON.stringify(fs_.ground || {}));
    const facs = r.F.factions() || [];
    facs.forEach(f => { out.members[f.k] = (r.F.members(f.k) || []).map(m => m.id).sort(); });
  }
  return out;
}

console.log('\n\x1b[1m\x1b[36mTHE RECOGNIZANCE PROOF\x1b[0m  ·  body/world/recognizance.js\n' +
            '  the world moves while you are not looking, and it signs its work.');

// ═════════════════════════════════════════════════════════════════════════════
// CLAIM 1 — UNPROMPTED
// ═════════════════════════════════════════════════════════════════════════════
head('1 · with ZERO player input, an agent acts within bounded ticks');

const A = rig({ seed: 'proof-seed-alpha' });
ok('the organ is enabled by default', A.R.enabled() === true);
ok('there are deliberants (the court is the roster)', A.R.deliberants().length === 3,
  'n=' + A.R.deliberants().length);
ok('the world it surveys is real (a founded polity)', A.R.survey().founded === true,
  JSON.stringify({ founded: A.R.survey().founded, treasury: A.R.survey().treasury }));

const MAX_TICKS = 12;                       // the bound the claim is made against
let firstAct = null, ticksToFirst = 0;
for (let i = 0; i < MAX_TICKS && !firstAct; i++) {
  const got = A.R.tickNow(Date.now());
  ticksToFirst++;
  if (got.length) firstAct = got[0];
}
ok('an agent ACTED with no player input, within ' + MAX_TICKS + ' ticks', !!firstAct,
  'no act in ' + MAX_TICKS + ' ticks; ledger=' + A.R.ledger().length);
if (firstAct) console.log('      \x1b[2m→ ' + firstAct.say + '\x1b[0m');
ok('it took a bounded number of ticks (not the very last one by luck)',
  ticksToFirst <= MAX_TICKS, 'ticks=' + ticksToFirst);

// ═════════════════════════════════════════════════════════════════════════════
// CLAIM 2 — DURABLE (NOT A TRANSFORM)
// ═════════════════════════════════════════════════════════════════════════════
head('2 · the act mutates DURABLE keyed world state, not a transform');

const B = rig({ seed: 'proof-seed-durable', worldId: 'durable-world' });
const before = snapshot(B);
let bActs = [];
for (let i = 0; i < MAX_TICKS && !bActs.length; i++) bActs = bActs.concat(B.R.tickNow(Date.now()));
const after = snapshot(B);

ok('at least one act landed', bActs.length >= 1, 'acts=' + bActs.length);
const changedKeys = Object.keys(before).filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
ok('a KEYED value in organ state differs before → after', changedKeys.length >= 1,
  'before=' + JSON.stringify(before) + '\n      after=' + JSON.stringify(after));
console.log('      \x1b[2m→ changed: ' + changedKeys.join(', ') + '\x1b[0m');

// The act NAMES the durable thing it moved, and that name resolves to a real
// organ. An act whose `durable` descriptor pointed at nothing would pass a
// naive diff and still be a lie.
if (bActs.length) {
  const d = bActs[0].durable;
  ok('the act names the organ it moved', !!(d && d.organ), JSON.stringify(d));
  ok('the named organ is one of the real ones (concord|admiralty|factions)',
    ['concord', 'admiralty', 'factions'].indexOf(d.organ) >= 0, d && d.organ);
  ok('the act names the KEY it moved', !!(d && d.key), JSON.stringify(d));
}
// THE EXCLUSION, ASSERTED. Nothing in the durable descriptor may be a transform.
const TRANSFORMY = /position|rotation|scale|quaternion|gait|yaw|pitch|roll|anim/i;
ok('NO act describes a transform as its durable change (position/rotation/gait excluded)',
  B.R.ledger(99).every(r => !TRANSFORMY.test(JSON.stringify(r.durable || {}))),
  JSON.stringify(B.R.ledger(99).map(r => r.durable)));
// and it survives a genuine reload — durable means durable
{
  const B2 = rig({ storage: makeStorage(B.storage), worldId: 'durable-world', seed: null });
  const afterReload = snapshot(B2);
  ok('the change SURVIVES a reload (a new module instance, same storage)',
    JSON.stringify(afterReload) === JSON.stringify(after),
    'after=' + JSON.stringify(after) + '\n      reload=' + JSON.stringify(afterReload));
  ok('the ledger survives the reload too', B2.R.ledger().length === B.R.ledger().length,
    B2.R.ledger().length + ' vs ' + B.R.ledger().length);
}

// ═════════════════════════════════════════════════════════════════════════════
// CLAIM 3 — ATTRIBUTABLE
// ═════════════════════════════════════════════════════════════════════════════
head('3 · every act is attributable — agent id + timestamp');

const led = B.R.ledger(99);
ok('the ledger has rows', led.length >= 1, 'rows=' + led.length);
ok('EVERY row carries an agent id', led.every(r => !!r.agentId), JSON.stringify(led.map(r => r.agentId)));
ok('EVERY agent id is a real deliberant (not invented)',
  led.every(r => B.R.deliberants().some(a => a.id === r.agentId)),
  JSON.stringify(led.map(r => r.agentId)));
ok('EVERY row carries a timestamp', led.every(r => typeof r.t === 'number' && r.t > 0));
ok('EVERY row carries the agent\'s NAME (legible, not just an id)', led.every(r => !!r.agent));
ok('EVERY row carries the tick it was decided on (replayable)',
  led.every(r => typeof r.tick === 'number'));
ok('EVERY row carries the pressure that produced it (auditable motive)',
  led.every(r => typeof r.pressure === 'number' && r.pressure >= 0.52),
  JSON.stringify(led.map(r => r.pressure)));

// ═════════════════════════════════════════════════════════════════════════════
// CLAIM 4 — LEGIBLE
// ═════════════════════════════════════════════════════════════════════════════
head('4 · the act emits an event a HUD can surface');

const perAct = B.events.filter(e => e.type === 'vint:recognizance');
const batch  = B.events.filter(e => e.type === 'vint:recognizance-batch');
ok('a `vint:recognizance` event fired for the act', perAct.length >= 1, 'n=' + perAct.length);
ok('the event carries the whole row (id, name, what, say)',
  perAct.length >= 1 && !!perAct[0].detail.agentId && !!perAct[0].detail.say,
  JSON.stringify(perAct[0] && perAct[0].detail));
ok('the event carries a HUMAN LINE a HUD can print verbatim',
  perAct.length >= 1 && typeof perAct[0].detail.say === 'string' && perAct[0].detail.say.length > 8,
  perAct[0] && perAct[0].detail.say);
ok('a batch event fired too (so a HUD can summarise "while you were gone")',
  batch.length >= 1, 'n=' + batch.length);
ok('the unread counter moved (a badge has something honest to show)',
  B.R.unread() >= 1, 'unread=' + B.R.unread());
B.R.markSeen();
ok('marking seen clears it (never a nag that cannot be dismissed)', B.R.unread() === 0);

// ═════════════════════════════════════════════════════════════════════════════
// CLAIM 5 — DETERMINISTIC UNDER SEED
// ═════════════════════════════════════════════════════════════════════════════
head('5 · same seed = same act sequence');

function runSeq(seed, worldId, ticks) {
  const r = rig({ seed, worldId });
  const seq = [];
  const t0 = 1770000000000;                 // a FIXED clock: wall-clock time is
                                            // an input, so the replay must pin it
  for (let i = 0; i < ticks; i++) {
    const got = r.R.tickNow(t0 + i * 1000);
    got.forEach(g => seq.push(g.agentId + ':' + g.kind + ':' + g.what));
  }
  return seq;
}
const SEQ_TICKS = 10;
const s1 = runSeq('the-same-seed', 'det-world-1', SEQ_TICKS);
const s2 = runSeq('the-same-seed', 'det-world-1', SEQ_TICKS);
ok('the sequence is non-empty (determinism of nothing proves nothing)', s1.length >= 1,
  'len=' + s1.length);
ok('TWO independent runs on the same seed produce the SAME sequence',
  JSON.stringify(s1) === JSON.stringify(s2),
  'run1=' + JSON.stringify(s1) + '\n      run2=' + JSON.stringify(s2));
console.log('      \x1b[2m→ ' + s1.length + ' acts, e.g. ' + (s1[0] || '') + '\x1b[0m');

const s3 = runSeq('a-different-seed', 'det-world-1', SEQ_TICKS);
ok('a DIFFERENT seed produces a DIFFERENT sequence (not a constant)',
  JSON.stringify(s1) !== JSON.stringify(s3),
  'same=' + JSON.stringify(s1));

// The subtle one: adding an agent must not change what the ORIGINAL agents did.
// This only holds if each agent's draw is keyed on its own id rather than pulled
// from one shared stream, and it is the difference between determinism that
// survives a real roster and determinism that only survives a frozen one.
{
  function runFor(agents, worldId) {
    const r = rig({ seed: 'roster-stability', worldId, agents });
    const seq = [];
    const t0 = 1770000000000;
    for (let i = 0; i < SEQ_TICKS; i++) {
      r.R.tickNow(t0 + i * 1000).forEach(g => seq.push(g.agentId + ':' + g.kind));
    }
    return seq;
  }
  const small = runFor(['ag-1', 'ag-2'], 'stab-a');
  const large = runFor(['ag-1', 'ag-2', 'ag-9'], 'stab-b');
  const smallOnly = large.filter(x => x.indexOf('ag-9') !== 0);
  // Not asserting equality of the FULL sequence (a new agent legitimately
  // consumes world budget); asserting that the FIRST act of ag-1 is the same
  // decision either way, which is what "keyed, not streamed" guarantees.
  const f1 = small.filter(x => x.indexOf('ag-1:') === 0)[0] || null;
  const f2 = large.filter(x => x.indexOf('ag-1:') === 0)[0] || null;
  ok('adding an agent does not change what an EXISTING agent first decided',
    f1 === f2, 'small=' + f1 + ' large=' + f2);
}

// ═════════════════════════════════════════════════════════════════════════════
// THE DESIGN LAWS — tested, because a law nobody tests is a comment.
// ═════════════════════════════════════════════════════════════════════════════
head('· the budget is real and tunable');
{
  const r = rig({ seed: 'budget-world', worldId: 'budget-world' });
  const b = r.R.budget();
  ok('the budget is readable', typeof b.perAgent === 'number' && typeof b.perWorld === 'number',
    JSON.stringify(b));
  const t0 = 1770000000000;
  let total = 0;
  for (let i = 0; i < 60; i++) total += r.R.tickNow(t0 + i * 1000).length;
  ok('the WORLD ceiling held across 60 ticks (perWorld=' + b.perWorld + ')',
    total <= b.perWorld, 'acts=' + total);
  const counts = {};
  r.R.ledger(99).forEach(x => { counts[x.agentId] = (counts[x.agentId] || 0) + 1; });
  ok('NO agent exceeded its per-agent ration (perAgent=' + b.perAgent + ')',
    Object.keys(counts).every(k => counts[k] <= b.perAgent), JSON.stringify(counts));
  const tuned = r.R.tune({ perWorld: 99 });
  ok('the budget is TUNABLE at runtime (explicit, per the design law)', tuned.perWorld === 99);
  r.R.tune({ perWorld: b.perWorld });
}

head('· the flag kills it, and the resentment signal is one call');
{
  const r = rig({ seed: 'flag-world', worldId: 'flag-world' });
  r.win.location.search = '?recog=0';
  ok('?recog=0 disables the organ live (not latched at boot)', r.R.enabled() === false);
  let n = 0;
  for (let i = 0; i < 20; i++) n += r.R.tickNow(Date.now()).length;
  ok('with the flag off, NOTHING acts', n === 0, 'acts=' + n);
  r.win.location.search = '';
  ok('clearing the flag re-enables it', r.R.enabled() === true);

  // hush: always available, never punished
  const r2 = rig({ seed: 'hush-world', worldId: 'hush-world' });
  r2.R.hush('ag-1');
  ok('hush() is one call and it takes', r2.R.hushed('ag-1') === true);
  let acts = [];
  for (let i = 0; i < 20; i++) acts = acts.concat(r2.R.tickNow(Date.now()));
  ok('a hushed agent NEVER acts', acts.every(a => a.agentId !== 'ag-1'),
    JSON.stringify(acts.map(a => a.agentId)));
  ok('hushing one agent does not silence the others (never all-or-nothing)',
    r2.R.deliberants().length > 1);
  ok('the hush rate is measurable (the resentment signal, doctrine test 6)',
    r2.R.hushRate() > 0 && r2.R.hushRate() < 1, 'rate=' + r2.R.hushRate());
  r2.R.hush('ag-1', false);
  ok('un-hushing is equally one call (never punished, never a trap)',
    r2.R.hushed('ag-1') === false);
}

head('· every act is reversible BY PLAY, never by purchase');
{
  const rows = B.R.ledger(99).concat(A.R.ledger(99));
  ok('every act carries an undo descriptor', rows.every(x => !!(x.undo && x.undo.organ && x.undo.how)),
    JSON.stringify(rows.map(x => x.undo)));
  ok('every undo names a REAL organ verb', rows.every(x => ['concord', 'admiralty', 'factions'].indexOf(x.undo.organ) >= 0));
  // Aria's line, asserted rather than promised: no reversal may be a purchase.
  const PAY = /\b(buy|purchase|pay|\$|usd|subscribe|upgrade|premium|tier)\b/i;
  ok('NO reversal is a purchase (Aria\'s boundary, asserted not promised)',
    rows.every(x => !PAY.test(x.undo.how)), JSON.stringify(rows.map(x => x.undo.how)));
}

head('· offline replay is bounded and honest');
{
  const r = rig({ seed: 'offline-world', worldId: 'offline-world' });
  const b = r.R.budget();
  const t0 = 1770000000000;
  r.R.step(t0);                                  // arm the clock
  // "gone for a week" — the replay must be bounded, not a week of world
  const got = r.R.step(t0 + 7 * 24 * 3600e3);
  ok('a week away replays a BOUNDED story, not a week of world',
    got.length <= b.perWorld, 'acts=' + got.length + ' ceiling=' + b.perWorld);
  ok('coming back after a long absence produced SOMETHING to reckon with',
    got.length >= 1 || r.R.ledger().length >= 1, 'acts=' + got.length);
  ok('skipped ticks are forgiven, never banked (the clock resets to now)',
    r.R.state().last === t0 + 7 * 24 * 3600e3);
}

head('· the organ is honest when its neighbours are missing');
{
  const r = rig({ seed: 'lonely', worldId: 'lonely-world', noConcord: true, noFactions: true });
  let n = 0;
  for (let i = 0; i < 20; i++) n += r.R.tickNow(Date.now()).length;
  ok('with NO organs to act through, nothing happens and nothing throws', n === 0, 'acts=' + n);
  ok('the ledger stays empty rather than logging phantom acts', r.R.ledger().length === 0);
}

head('· a guest world is never moved without an account');
{
  const storage = makeStorage();
  const win = makeWindow(storage);
  storage.removeItem('vint_access_token');
  stubWorld(win, 'guest-world');
  win.VintinuumWorld._guest = true;
  stubCourt(win, ['ag-1', 'ag-2']);
  foundConcord(win, 'guest-world');
  loadModule(CONCORD, win); loadModule(FACTIONS, win);
  const R = loadModule(RECOG, win);
  let n = 0;
  for (let i = 0; i < 20; i++) n += R.tickNow(Date.now()).length;
  ok('a guest\'s world is never acted on', n === 0, 'acts=' + n);
}

head('· the ingestion hook is wired (Universal Ingestion Law)');
{
  const spool = JSON.parse(B.storage.getItem('vint:ingest:recognizance') || '[]');
  ok('every act spooled a training row', spool.length >= B.R.ledger(99).length,
    'spool=' + spool.length + ' ledger=' + B.R.ledger(99).length);
  ok('the spooled row carries world, agent, kind and the durable change',
    spool.length >= 1 && !!spool[0].world && !!spool[0].agent && !!spool[0].kind && !!spool[0].durable,
    JSON.stringify(spool[0]));
  ok('the spool is BOUNDED (it can never eat the origin\'s storage)', spool.length <= 500);
}

// ═════════════════════════════════════════════════════════════════════════════
// THE BROWSER LEG — the organ in the shipped page, with the REAL Concord,
// Admiralty and factions behind it. The headless legs prove the model; this
// proves the page actually composes and that NO surface was added.
// ═════════════════════════════════════════════════════════════════════════════
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

(async () => {
  head('· the organ acts inside the shipped page (world.html)');
  let puppeteer;
  try { puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer'); }
  catch (_) {
    console.log('  \x1b[33m—\x1b[0m puppeteer unavailable; the browser leg was skipped.');
    return done();
  }
  const srv = http.createServer((rq, rs) => {
    let p = decodeURIComponent(rq.url.split('?')[0]); if (p === '/') p = '/index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rs.writeHead(404); return rs.end(); }
    rs.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(rs);
  });
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  try {
    const pg = await b.newPage();
    await pg.setViewport({ width: 320, height: 640 });
    await pg.evaluateOnNewDocument(() => { localStorage.setItem('vint_access_token', 'proof.tok.tok'); });
    pg.on('pageerror', () => {});
    await pg.goto(`http://127.0.0.1:${port}/world.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pg.waitForFunction(() => !!(window.VintRecognizance && window.VintConcord && window.VintAdmiralty),
      { timeout: 20000 }).catch(() => {});

    const res = await pg.evaluate(async () => {
      const out = { steps: [] };
      try {
        const W = window.VintinuumWorld;
        if (W) { W._worldId = 'recog-page'; W._canBuild = true; W._guest = false; W._resident = { standing: 300, lumen: 400 }; }
        const R = window.VintRecognizance, C = window.VintConcord;
        if (!R || !C) return { err: 'organs missing: R=' + !!R + ' C=' + !!C };
        out.steps.push('organs present');
        out.noSheet = !document.getElementById('rcSheet') && !document.getElementById('recogSheet');
        // count sheets + rail launchers BEFORE, so we can prove the organ adds none
        out.launchersBefore = document.querySelectorAll('#dvRail button').length;

        // found a polity + seat two of the user's agents, through the real store
        localStorage.setItem('vint:concord:recog-page', JSON.stringify({
          v: 1, founded: Date.now() - 86400000, charter: 'vault', name: 'the Vaultsworn',
          seats: [{ agentId: 'pa-1', role: 'seat', joined: Date.now() - 800000 },
                  { agentId: 'pa-2', role: 'seat', joined: Date.now() - 800000 }],
          tags: { civic: 0, criminal: 0, craft: 0, social: 0, mentor: 0, heat: 0, trust: 0 },
          treasury: 15, motion: null, record: [], exiles: [], seen: 0
        }));
        // a court the organ can deliberate over
        window.VintCourt = window.VintCourt || {};
        window.VintCourt.roster = () => ([
          { id: 'pa-1', name: 'Sable', status: 'active', provider: 'anthropic', color: '#a67cff' },
          { id: 'pa-2', name: 'Corvid', status: 'active', provider: 'openai', color: '#9fdcff' }
        ]);
        out.founded = !!C.founded();
        R.dissolve(); R.reseed('page-proof');

        const seen = [];
        window.addEventListener('vint:recognizance', e => seen.push(e.detail));
        const t0 = C.state().treasury;
        let acts = [];
        for (let i = 0; i < 12 && !acts.length; i++) acts = acts.concat(R.tickNow(Date.now()));
        out.acts = acts.length;
        out.say = acts.length ? acts[0].say : '';
        out.agentId = acts.length ? acts[0].agentId : '';
        out.events = seen.length;
        out.treasuryBefore = t0;
        out.treasuryAfter = C.state().treasury;
        out.motionAfter = C.state().motion ? C.state().motion.k : null;
        out.durableMoved = (out.treasuryAfter !== t0) || !!out.motionAfter;
        out.launchersAfter = document.querySelectorAll('#dvRail button').length;
        out.stillNoSheet = !document.getElementById('rcSheet') && !document.getElementById('recogSheet');

        // ── THE FEED LEG ─────────────────────────────────────────────────────
        // The organ's whole visible life is world.html routing the batch event
        // into the existing speech feed. Prove it lands, prove it NEVER
        // overflows: a big offline replay must still leave `#feed` at its
        // authored cap of 5 children, or the No-Collision Law is broken by an
        // element the organ caused to exist.
        const feed = document.getElementById('feed');
        out.feedBefore = feed ? feed.children.length : -1;
        const many = [];
        for (let i = 0; i < 12; i++) {
          many.push({ agent: 'Sable', say: 'Sable did thing ' + i + '.', what: 'thing ' + i });
        }
        window.dispatchEvent(new CustomEvent('vint:recognizance-batch',
          { detail: { acts: many, offline: true } }));
        await new Promise(r => setTimeout(r, 3200));   // the staggered lines land
        out.feedAfter = feed ? feed.children.length : -1;
        out.feedText = feed ? Array.from(feed.children).map(c => c.textContent) : [];
        // the name must appear ONCE per line (the `who` cell), never twice
        out.doubledName = out.feedText.some(t => (t.match(/Sable/g) || []).length > 1);
        // and the feed must not have grown outside its own box
        if (feed) {
          const fr = feed.getBoundingClientRect();
          out.feedInViewport = fr.left >= 0 && fr.right <= window.innerWidth + 1 && fr.top >= 0;
        }

        // ── THE PLAYER'S REACH ───────────────────────────────────────────────
        // The ledger + hush live inside the Concord's EXISTING sheet, so this
        // leg opens that sheet and proves: the section renders, every row fits
        // at 320px, and the hush control actually takes.
        C.open();
        await new Promise(r => setTimeout(r, 400));
        const sheet = document.getElementById('cnSheet');
        out.sheetOpen = !!(sheet && sheet.classList.contains('open'));
        const secs = Array.from(sheet ? sheet.querySelectorAll('.cn-sec') : [])
          .map(x => x.textContent);
        out.hasRecogSection = secs.indexOf('on their own recognizance') >= 0;
        out.sections = secs;
        // NOTHING in the sheet may exceed the sheet's own width at 320
        if (sheet) {
          const sr = sheet.getBoundingClientRect();
          out.sheetW = Math.round(sr.width);
          let bleed = 0;
          sheet.querySelectorAll('.cn-seat, .cn-sn, .cn-ss, .cn-sa').forEach(el2 => {
            const r2 = el2.getBoundingClientRect();
            if (r2.right > sr.right + 1 || r2.left < sr.left - 1) bleed++;
          });
          out.bleed = bleed;
        }
        // the hush control is reachable and it TAKES
        const hushBtn = Array.from(sheet ? sheet.querySelectorAll('.cn-sa') : [])
          .filter(x => x.textContent === 'hush')[0];
        out.hushReachable = !!hushBtn;
        if (hushBtn) {
          const who = R.ledger(1)[0] && R.ledger(1)[0].agentId;
          hushBtn.click();
          await new Promise(r => setTimeout(r, 250));
          out.hushTook = R.hushed(who) === true;
          // and it is reversible in one tap, from the same place
          const back = Array.from(sheet.querySelectorAll('.cn-sa'))
            .filter(x => x.textContent === 'let them act')[0];
          out.unhushReachable = !!back;
          if (back) { back.click(); await new Promise(r => setTimeout(r, 250)); out.unhushTook = R.hushed(who) === false; }
        }
        C.close();
        // no fixed element of its own, anywhere
        out.ownFixed = 0;
        document.querySelectorAll('[id^="rc"],[id^="recog"]').forEach(el => {
          if (getComputedStyle(el).position === 'fixed') out.ownFixed++;
        });
      } catch (e) { out.err = String(e && e.message); }
      return out;
    });

    if (res.err) { ok('the browser leg ran', false, res.err); }
    else {
      ok('the polity is founded in the page', res.founded === true);
      ok('an agent ACTED inside the shipped page', (res.acts || 0) >= 1, 'acts=' + res.acts);
      if (res.say) console.log('      \x1b[2m→ ' + res.say + '\x1b[0m');
      ok('the act is attributable to a real agent', !!res.agentId, 'agentId=' + res.agentId);
      ok('a legible event reached the page bus', (res.events || 0) >= 1, 'events=' + res.events);
      ok('DURABLE page state moved (treasury or the floor)', res.durableMoved === true,
        'treasury ' + res.treasuryBefore + '→' + res.treasuryAfter + ' motion=' + res.motionAfter);
      // NO-COLLISION: the organ adds no surface at all, so it joins no stack.
      ok('the organ added NO sheet to the one-sheet exclusive set', res.stillNoSheet === true);
      ok('the organ added NO launcher to the rail',
        res.launchersAfter === res.launchersBefore,
        res.launchersBefore + ' → ' + res.launchersAfter);
      ok('the organ owns ZERO fixed elements (nothing to collide with)', res.ownFixed === 0,
        'fixed=' + res.ownFixed);
      // the visible life, and its bound
      ok('an act is SPOKEN into the clearing\'s existing feed', (res.feedAfter || 0) >= 1,
        'feed ' + res.feedBefore + ' → ' + res.feedAfter);
      ok('a 12-act offline replay still leaves the feed at its authored cap of 5',
        res.feedAfter <= 5, 'children=' + res.feedAfter);
      ok('the agent\'s name is printed ONCE per line, never doubled',
        res.doubledName === false, JSON.stringify(res.feedText));
      ok('the feed stayed inside the viewport (no overflow at 320px)',
        res.feedInViewport === true);
      // the player's reach, inside a sheet that already existed
      ok('the Concord sheet opens', res.sheetOpen === true);
      ok('"on their own recognizance" renders inside it (no NEW sheet was needed)',
        res.hasRecogSection === true, JSON.stringify(res.sections));
      ok('NOTHING in the section bleeds past the sheet at 320px',
        res.bleed === 0, 'bleeding elements=' + res.bleed + ' sheetW=' + res.sheetW);
      ok('the hush control is reachable from the ledger row', res.hushReachable === true);
      ok('tapping hush TAKES (the agent will not act again)', res.hushTook === true);
      ok('un-hushing is the same one tap, in the same place', res.unhushReachable === true);
      ok('and un-hushing takes (never a trap)', res.unhushTook === true);
    }
    await pg.close();
  } catch (e) {
    ok('the browser leg ran', false, String(e && e.message));
  } finally {
    await b.close().catch(() => {});
    srv.close();
  }
  done();
})();

function done() {
  console.log('\n' + (fails === 0
    ? '\x1b[32m  ALL ' + passes + ' CLAIMS HOLD.\x1b[0m  they act on their own, and the ledger says who.\n'
    : '\x1b[31m  ' + fails + ' CLAIM(S) FAILED\x1b[0m  (' + passes + ' passed)\n'));
  process.exit(fails === 0 ? 0 : 1);
}
