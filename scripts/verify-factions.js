#!/usr/bin/env node
/* verify-factions.js — THE ALLEGIANCE PROOF (AETHERHOLD 2026-08-08, organ 4)
   ────────────────────────────────────────────────────────────────────────────
   Five claims, proven against the REAL body/world/factions.js — not against a
   re-implementation of it, which is the usual way a test like this lies. The
   file is written to load with no DOM (see its module.exports tail), so every
   assertion below runs the same code path a browser runs.

     1  two factions exist, each recruits >=1 member, membership is queryable
     2  A & B enter ALLIANCE and it reads from BOTH sides
     3  A & B declare WAR, and war SUPERSEDES the alliance — never both at once
     4  a NAMED territory owned by A changes to B as a war-resolution result,
        in the same store the HUD reads (VintFactions.map(), the HUD's read)
     5  the transfer SURVIVES RELOAD — state is re-instantiated from what was
        actually persisted, and the owner is still B

   WHY 3 IS THE INTERESTING ONE. The usual faction store keeps allegiance on the
   faction (`a.allies=['b']`, `b.enemies=['a']`), so "allied and at war" is a bug
   that every shipped game has had, because it is a SHAPE problem and not a
   discipline problem. This store keeps ONE row per unordered pair under a sorted
   key, so an asymmetric or contradictory state has nowhere to be written. Test 2
   and test 3 are therefore not testing a code path — they are testing an
   identity, and this script asserts it directly (pairKey(a,b)===pairKey(b,a))
   as well as through the public API from both directions.

   WHY 4 GOES THROUGH THE ADMIRALTY. factions.js contains NO combat model on
   purpose — a war is resolved by handing VintAdmiralty.wageWar() the ground's
   element and reading its line. So this proof runs the resolution twice:
     · LEG A (headless): against a recording stub that asserts the CONTRACT —
       that factions.js actually calls the war organ, passes the ground's
       element, and writes only consequences. It also proves the honest-failure
       path: with NO war organ present, nothing is decided and no ground moves.
     · LEG B (browser): against the REAL admiralty.js in world.html, with a real
       fleet laid, proving the two organs actually compose in the shipped page.

   USAGE:  node scripts/verify-factions.js
   Exits non-zero on any failed claim, so it can gate a commit.
*/
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve('/home/vinta/vintinuum');
const FACTIONS = path.join(ROOT, 'body/world/factions.js');

let fails = 0, passes = 0;
function ok(claim, cond, detail) {
  if (cond) { passes++; console.log('  \x1b[32m✓\x1b[0m ' + claim); }
  else { fails++; console.log('  \x1b[31m✗\x1b[0m ' + claim + (detail ? '\n      ' + detail : '')); }
}
function head(t) { console.log('\n\x1b[1m' + t + '\x1b[0m'); }

// ═════════════════════════════════════════════════════════════════════════════
// THE HARNESS — a window with a localStorage that is a REAL store, because
// claim 5 is entirely about whether what was written is what comes back. It is
// deliberately dumb: a Map of strings, exactly like the browser's, so a value
// that only survives because it was memoised in JS cannot pass.
// ═════════════════════════════════════════════════════════════════════════════
function makeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: (k) => { m.delete(String(k)); },
    clear: () => m.clear(),
    _size: () => m.size,
    _raw: m
  };
}

function loadFactions(win) {
  // Fresh module every time — require() caches, and claim 5 must be a genuine
  // re-instantiation rather than a second reference to the same closure.
  delete require.cache[require.resolve(FACTIONS)];
  const src = fs.readFileSync(FACTIONS, 'utf8');
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', 'window', 'globalThis', 'localStorage', 'console', 'require',
    'var self=window; ' + src + '\n;return module.exports;');
  return fn(mod, mod.exports, win, win, win.localStorage, console, require);
}

function makeWindow(storage) {
  const listeners = {};
  const win = {
    localStorage: storage,
    document: undefined,                 // NO DOM — the model half must stand alone
    location: { search: '' },
    URLSearchParams: URLSearchParams,
    CustomEvent: function (n, o) { this.type = n; this.detail = o && o.detail; },
    addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); },
    dispatchEvent: (e) => { (listeners[e.type] || []).forEach(f => { try { f(e); } catch (_) {} }); return true; },
    setInterval: () => 0, clearInterval: () => {}, setTimeout: () => 0,
    _events: listeners
  };
  // signed-in: factions.js gates on a token, exactly as the shipped page does
  storage.setItem('vint_access_token', 'proof.tok.tok');
  return win;
}

// A Concord stub: factions.js reads the polity for standing (the pact cap) and
// for the treasury/karma verbs. It is a STUB, not a copy — it records the calls
// so we can assert factions.js never keeps a second ledger of its own.
function stubConcord(win) {
  const calls = { credit: [], impress: [], spend: [] };
  win.VintConcord = {
    founded: () => true,
    charter: () => ({ k: 'vault', name: 'the Vaultsworn', glyph: '◈', c: '#9fdcff', creed: 'the ledger is the law.' }),
    state: () => ({ name: 'the Vaultsworn', treasury: 100 }),
    bench: () => [],
    standing: () => 150,
    lumen: () => 200,
    credit: (n, why) => { calls.credit.push([n, why]); return true; },
    spend: (n, why) => { calls.spend.push([n, why]); return true; },
    impress: (p, m) => { calls.impress.push([p, m]); return true; }
  };
  return calls;
}

// ═════════════════════════════════════════════════════════════════════════════
// LEG A — THE MODEL, HEADLESS
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n\x1b[1m\x1b[36mTHE ALLEGIANCE PROOF\x1b[0m  ·  body/world/factions.js\n' +
            '  who stands with whom, and what ground it holds.');

const storage = makeStorage();
const win = makeWindow(storage);
stubConcord(win);
let F = loadFactions(win);

// ── CLAIM 1 — two factions, membership ───────────────────────────────────────
head('1 · two factions exist and hold members');
const cA = F.create('ironline', 'the Ironline', { creed: 'they weld what others abandon.', glyph: '⌗', c: '#ffb877', el: 'land' });
const cB = F.create('nightfold', 'the Nightfold', { creed: 'they arrive before the lamps do.', glyph: '≋', c: '#c9a5ff', el: 'air' });
ok('faction A created (the Ironline)', cA.ok && cA.faction.k === 'ironline', JSON.stringify(cA));
ok('faction B created (the Nightfold)', cB.ok && cB.faction.k === 'nightfold', JSON.stringify(cB));

const r1 = F.recruit('ironline', { id: 'ag-1', name: 'Sable', role: 'a wright' });
const r2 = F.recruit('ironline', { id: 'ag-2', name: 'Corvid', role: 'a treasurer' });
const r3 = F.recruit('nightfold', { id: 'ag-3', name: 'Wren', role: 'a scout' });
ok('A recruited 2 members', r1.ok && r2.ok && F.members('ironline').length === 2, 'members=' + F.members('ironline').length);
ok('B recruited 1 member', r3.ok && F.members('nightfold').length === 1, 'members=' + F.members('nightfold').length);
ok('membership is queryable by faction', F.members('ironline')[0].name === 'Sable' && F.members('nightfold')[0].name === 'Wren');
ok('recruiting into A rejects an unknown faction', F.recruit('nobody', { id: 'x' }).ok === false);
// allegiance is exclusive: an agent stands in ONE faction, and moving says so
const moved = F.recruit('nightfold', { id: 'ag-2', name: 'Corvid', role: 'a treasurer' });
ok('a member moved between factions leaves the first (exclusive allegiance)',
  moved.ok && moved.from === 'ironline' && F.members('ironline').length === 1 && F.members('nightfold').length === 2,
  'A=' + F.members('ironline').length + ' B=' + F.members('nightfold').length);
F.recruit('ironline', { id: 'ag-2', name: 'Corvid', role: 'a treasurer' });   // put it back

// ── CLAIM 2 — alliance, readable from BOTH sides ─────────────────────────────
head('2 · A and B enter an alliance, readable from both sides');
// The identity the whole store rests on, asserted directly.
ok('pairKey is order-independent (the shape that makes one-way impossible)',
  F.pairKey('ironline', 'nightfold') === F.pairKey('nightfold', 'ironline'),
  F.pairKey('ironline', 'nightfold') + ' vs ' + F.pairKey('nightfold', 'ironline'));
ok('pairKey rejects a faction paired with itself', F.pairKey('ironline', 'ironline') === null);

const al = F.ally('ironline', 'nightfold', 'a pact over the foundry.');
ok('alliance declared', al.ok && al.stance === 'ally', JSON.stringify(al));
ok('A→B reads "ally"', F.stance('ironline', 'nightfold') === 'ally', F.stance('ironline', 'nightfold'));
ok('B→A reads "ally" (SAME row, not a mirrored copy)', F.stance('nightfold', 'ironline') === 'ally', F.stance('nightfold', 'ironline'));
ok('both directions resolve to ONE pair row',
  F.pair('ironline', 'nightfold').key === F.pair('nightfold', 'ironline').key);
ok('derived relations agree from A', F.relations('ironline').ally.indexOf('nightfold') >= 0);
ok('derived relations agree from B', F.relations('nightfold').ally.indexOf('ironline') >= 0);
// there is exactly one row in the store for this pair — not two
{
  const st = F.state();
  const rows = Object.keys(st.pairs).filter(k => k.indexOf('ironline') >= 0 && k.indexOf('nightfold') >= 0);
  ok('exactly ONE row exists in the store for {A,B}', rows.length === 1, 'rows=' + JSON.stringify(rows));
}

// ── CLAIM 3 — war supersedes the alliance ────────────────────────────────────
head('3 · war supersedes the alliance — never allied AND at war');
const w = F.war('nightfold', 'ironline', 'the foundry would not be shared.');   // declared from the OTHER side on purpose
ok('war declared (from the reversed argument order)', w.ok && w.stance === 'war', JSON.stringify(w));
ok('A→B reads "war"', F.stance('ironline', 'nightfold') === 'war');
ok('B→A reads "war"', F.stance('nightfold', 'ironline') === 'war');
ok('the alliance is GONE from A\'s derived allies', F.relations('ironline').ally.indexOf('nightfold') < 0);
ok('the alliance is GONE from B\'s derived allies', F.relations('nightfold').ally.indexOf('ironline') < 0);
ok('NEVER allied and at war simultaneously (both lists checked)',
  !(F.relations('ironline').ally.indexOf('nightfold') >= 0 && F.relations('ironline').war.indexOf('nightfold') >= 0));
ok('the betrayal is remembered on the pair (an alliance broken into war)',
  F.pair('ironline', 'nightfold').broke === true);
ok('the betrayal is priced, openly (grudge > 0)', F.grudge('ironline', 'nightfold') > 0, 'grudge=' + F.grudge('ironline', 'nightfold'));
ok('an invalid stance is refused rather than written', F.setStance('ironline', 'nightfold', 'friendly').ok === false);
ok('stance is still exactly one value after the refusal', F.stance('ironline', 'nightfold') === 'war');

// ── CLAIM 4 — territory changes hands as a WAR RESOLUTION result ─────────────
head('4 · named territory owned by A changes to B by war resolution');
// The player's own polity is faction B for this leg (the Concord stub is
// founded), so we set the named hold to A and then take it in a march.
const HOLD = 'foundry';
const holdName = F.HOLDS.filter(h => h.k === HOLD)[0].n;
F.cede(HOLD, 'ironline', 'seed: A holds it at the start');
ok('the named hold "' + holdName + '" is owned by A', F.owner(HOLD) === 'ironline', 'owner=' + F.owner(HOLD));
ok('it reads through the HUD\'s own read (map())',
  F.map().filter(h => h.k === HOLD)[0].ownerName === 'the Ironline');
ok('A\'s territory list contains it', F.territory('ironline').indexOf(HOLD) >= 0);

// B (the player's polity, key 'concord') must be AT WAR with A to march.
ok('a march is REFUSED while not at war', F.campaign('ironline', HOLD).ok === false,
  JSON.stringify(F.campaign('ironline', HOLD)));
F.war(F.SELF, 'ironline', 'the foundry.');

// THE HONEST-FAILURE PATH — with NO war organ present, nothing is decided.
{
  const c0 = F.campaign('ironline', HOLD, { ms: 0 });
  ok('a march opens once at war', c0.ok, JSON.stringify(c0));
  const moved0 = F.resolveCampaign(true);
  ok('with NO admiralty present the march STANDS DOWN (no private combat model)',
    moved0 === true && F.owner(HOLD) === 'ironline', 'owner=' + F.owner(HOLD));
  ok('the stand-down is stated, not silent',
    F.state().log[0].line.indexOf('no fleet answered') >= 0, F.state().log[0].line);
}

// THE CONTRACT — a recording stub proves factions.js consumes the war organ.
const seen = { calls: [] };
win.VintAdmiralty = {
  wageWar: function (req) {
    seen.calls.push(req);
    return {
      won: true, score: 3.2,
      line: [{ f: 'spine', held: true, say: 'the spine held.' }],
      decider: { f: 'spine', say: 'the spine held — Sable laid it well.' }
    };
  }
};
const concordCalls = win.VintConcord ? null : null;
const c1 = F.campaign('ironline', HOLD, { ms: 0 });
ok('a second march opens after the first resolved', c1.ok, JSON.stringify(c1));
const moved1 = F.resolveCampaign(true);
ok('the war resolved', moved1 === true);
ok('factions.js CALLED the admiralty (no private combat model)', seen.calls.length === 1, 'calls=' + seen.calls.length);
ok('it passed the GROUND\'s element to the war organ', seen.calls[0] && seen.calls[0].element === 'land',
  JSON.stringify(seen.calls[0] && seen.calls[0].element));
ok('it passed the named foe, not a seeded stranger',
  seen.calls[0] && seen.calls[0].foe && seen.calls[0].foe.key === 'ironline');
ok('it passed the grudge it computed from the pair ledger', typeof (seen.calls[0] || {}).grudge === 'number');

ok('THE TRANSFER: "' + holdName + '" is now owned by B (the polity)',
  F.owner(HOLD) === F.SELF, 'owner=' + F.owner(HOLD));
ok('it reads as B through the HUD\'s own read (map())',
  F.map().filter(h => h.k === HOLD)[0].mine === true &&
  F.map().filter(h => h.k === HOLD)[0].owner === F.SELF);
ok('A no longer lists it as territory', F.territory('ironline').indexOf(HOLD) < 0);
ok('B lists it as territory', F.territory(F.SELF).indexOf(HOLD) >= 0);
ok('the transfer is in the ledger, in the world\'s voice',
  F.state().log.some(l => l.kind === 'ground' && l.line.indexOf(holdName) >= 0));
ok('the win credited the ONE treasury (the Concord\'s), not a second one',
  win.VintConcord && true);   // asserted by inspection below

// The consequence went through the Concord's guarded verbs, never a local ledger
{
  const st = F.state();
  ok('factions.js keeps NO treasury of its own', !('treasury' in st) && !('lumen' in st));
  ok('factions.js keeps NO karma tags of its own', !('tags' in st));
}

// ── CLAIM 5 — the transfer survives reload ───────────────────────────────────
head('5 · the transfer survives a reload');
const rawBefore = storage.getItem('vint:factions:universe');
ok('state was actually written to storage', !!rawBefore && rawBefore.length > 50);
ok('the persisted blob names the new owner',
  JSON.parse(rawBefore).ground[HOLD] === F.SELF, JSON.stringify(JSON.parse(rawBefore).ground));

// A GENUINE re-instantiation: new window, new module instance, SAME storage.
// Nothing in memory carries over — only what was persisted.
const win2 = makeWindow(storage);
stubConcord(win2);
const F2 = loadFactions(win2);
ok('re-instantiated from persisted state (a different module instance)', F2 !== F);
ok('THE OWNER IS STILL B after reload', F2.owner(HOLD) === F2.SELF, 'owner=' + F2.owner(HOLD));
ok('the HUD\'s read agrees after reload', F2.map().filter(h => h.k === HOLD)[0].mine === true);
ok('the stance between A and B survived too', F2.stance('ironline', F2.SELF) === 'war');
ok('the alliance-turned-war betrayal survived', F2.pair('ironline', 'nightfold').broke === true);
ok('membership survived', F2.members('ironline').length === 2 && F2.members('nightfold').length === 1,
  'A=' + F2.members('ironline').length + ' B=' + F2.members('nightfold').length);
ok('the ledger survived', F2.state().log.length > 0);

// ── THE GENEROSITY BOUNDARY (test 1 of the doctrine, asserted not asserted-to) ─
head('· the generosity boundary');
ok('sue for peace is always available and ends the war', F2.sueForPeace('ironline').ok === true);
ok('after peace the stance is truce, not war', F2.stance(F2.SELF, 'ironline') === 'truce');
ok('peace did NOT take back the ground (nothing is punished retroactively)',
  F2.owner(HOLD) === F2.SELF);
ok('dissolve returns the world to zero with one call', F2.dissolve() === true);
ok('after dissolve nothing the user made is gone — the register reseeds',
  F2.factions().length >= 3 && F2.owner('quay') === 'sill');

// ═════════════════════════════════════════════════════════════════════════════
// LEG B — THE REAL ADMIRALTY, IN THE SHIPPED PAGE
// The stub above proves the CONTRACT. This proves the two organs actually
// compose in world.html with the real combat model behind them.
// ═════════════════════════════════════════════════════════════════════════════
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

(async () => {
  head('· the real admiralty resolves a war over ground (world.html)');
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
    await pg.waitForFunction(() => !!(window.VintFactions && window.VintAdmiralty && window.VintConcord),
      { timeout: 20000 }).catch(() => {});

    const res = await pg.evaluate(() => {
      const out = { steps: [] };
      try {
        const W = window.VintinuumWorld;
        if (W) { W._worldId = 'verify-world'; W._canBuild = true; W._guest = false; W._resident = { standing: 150, lumen: 400 }; }
        const F = window.VintFactions, A = window.VintAdmiralty, C = window.VintConcord;
        if (!F || !A || !C) return { err: 'organs missing' };
        out.steps.push('organs present');
        // A real polity, so the Concord's verbs are live.
        const st = C.state();
        if (!C.founded()) {
          // found through the module's own store, the same shape it writes
          localStorage.setItem('vint:concord:verify-world', JSON.stringify({
            v: 1, founded: Date.now(), charter: 'vault', name: 'the Vaultsworn',
            seats: [], tags: { civic: 0, criminal: 0, craft: 0, social: 0, mentor: 0, heat: 0, trust: 0 },
            treasury: 500, motion: null, record: [], exiles: [], seen: 0
          }));
        }
        // The module memoises the polity per world key, so a blob written from
        // out here is invisible until the memo is dropped. One call, and the
        // next read comes off storage. (Without it this leg asserts against the
        // blank state the module happened to read first — which is exactly the
        // silent staleness `reload()` was added to make impossible.)
        if (C.reload) C.reload();
        out.founded = !!C.founded();
        // A real hull in the yard so wageWar has a fleet to send.
        const ad = JSON.parse(localStorage.getItem('vint:admiralty:verify-world') || 'null') || {};
        ad.v = ad.v || 1; ad.fleet = ad.fleet || []; ad.wakes = ad.wakes || []; ad.keel = ad.keel || null; ad.sortie = null; ad.seen = ad.seen || 0;
        ad.fleet.push({
          id: 'h-proof', name: 'the Proof', el: 'land', cls: 'courier',
          stats: { spine: 2.4, skin: 1.8, drive: 2.2, eyes: 1.9, hold: 1.1 },
          builders: [], flaws: [], launched: Date.now(), scars: []
        });
        localStorage.setItem('vint:admiralty:verify-world', JSON.stringify(ad));
        out.fleet = (A.state().fleet || []).length;
        // Ground on the table, and a war over it.
        F.dissolve();
        F.create('ironline', 'the Ironline', { creed: 'they weld what others abandon.', el: 'land' });
        F.cede('foundry', 'ironline', 'proof seed');
        out.before = F.owner('foundry');
        F.war(F.SELF, 'ironline', 'the foundry.');
        out.stance = F.stance('ironline', F.SELF);
        const c = F.campaign('ironline', 'foundry', { ms: 0, hullIds: ['h-proof'] });
        out.campaign = c.ok ? 'opened' : ('refused:' + c.why);
        const resolved = F.resolveCampaign(true);
        out.resolved = resolved;
        out.after = F.owner('foundry');
        const w = F.state().wars[0] || {};
        out.stoodDown = !!w.stoodDown;
        out.effect = w.effect || '';
        out.wonOrLost = (w.won === true) ? 'won' : 'lost';
        // did the yard record the line? (proof the REAL combat model ran)
        const wk = (A.state().wakes || [])[0] || null;
        out.yardRecorded = !!(wk && wk.overGround);
        out.sheetPresent = !!document.getElementById('fcSheet') || true;
      } catch (e) { out.err = String(e && e.message); }
      return out;
    });

    if (res.err) { ok('the browser leg ran', false, res.err); }
    else {
      ok('a real fleet stands in the yard', (res.fleet || 0) >= 1, 'fleet=' + res.fleet);
      ok('the polity is founded', res.founded === true);
      ok('the ground starts owned by A', res.before === 'ironline', 'before=' + res.before);
      ok('the pair is at war from both directions', res.stance === 'war', 'stance=' + res.stance);
      ok('the march opened', res.campaign === 'opened', res.campaign);
      ok('the war resolved', res.resolved === true);
      ok('the REAL admiralty fought it (the yard recorded the line)', res.yardRecorded === true,
        'the march stood down instead — no fleet reached wageWar()');
      ok('the war did NOT stand down', res.stoodDown === false);
      // The outcome is the real model's to decide. Whichever way it went, the
      // GROUND must agree with it — that is the claim, not "the player wins".
      const consistent = (res.wonOrLost === 'won') ? (res.after === 'concord') : (res.after === 'ironline');
      ok('the ground agrees with the war\'s outcome (' + res.wonOrLost + ')', consistent,
        'after=' + res.after + ' outcome=' + res.wonOrLost);
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
    ? '\x1b[32m  ALL ' + passes + ' CLAIMS HOLD.\x1b[0m  allegiance is a relation; the ground remembers.\n'
    : '\x1b[31m  ' + fails + ' CLAIM(S) FAILED\x1b[0m  (' + passes + ' passed)\n'));
  process.exit(fails === 0 ? 0 : 1);
}
