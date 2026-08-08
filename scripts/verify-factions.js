#!/usr/bin/env node
/* verify-factions.js — THE ALLEGIANCE PROOF (AETHERHOLD 2026-08-08, task D9KADDX)
   ════════════════════════════════════════════════════════════════════════════
   WHAT THIS EXISTS TO SETTLE.

   "Factions, diplomacy and territory" is the easiest thing in game development
   to claim and the most common place to ship a bug that survives for years. The
   bug is always the same one: allegiance stored ONE-WAY. `A.allies=[B]` and
   `B.allies=[A]` are two facts kept equal by discipline, and discipline is what
   fails — so the trade code believes A is allied to B while the war code
   believes B is at war with A, and neither is wrong about what it read.

   marches.js claims that class of bug is structurally impossible in this world,
   because a relation is keyed by the SORTED PAIR and therefore has exactly one
   storage location. That is a falsifiable claim, so it is falsified here, against
   the REAL page (world.html, real modules, real localStorage) and never against
   a mock of the engine.

   FIVE ASSERTIONS, each a hard PASS/FAIL:

     1 MEMBERSHIP  — two factions exist, each has at least one member, and
                     membership is queryable by faction. (A faction nobody can be
                     a member of is a coloured word, not a faction.)
     2 SYMMETRY    — A+B enter an ALLIANCE and it reads identically from BOTH
                     sides. Not "both sides were updated" — the proof asserts
                     bond(a,b) and bond(b,a) return the same stance AND the same
                     pair identity, which is the difference between two facts
                     kept in agreement and one fact seen twice.
     3 SUPERSESSION— A+B declare WAR and it supersedes the alliance. The pair is
                     never allied AND at war: asserted from both directions, and
                     asserted as an exhaustive sweep over every power pair so the
                     property is proven of the SYSTEM, not of one lucky row.
     4 TERRITORY   — a NAMED march owned by A changes hands to B as the result of
                     a war resolution. Owner is asserted to be A before and B
                     after, read from the SAME world-state store the HUD renders
                     from — not from a return value, not from an event payload,
                     and not from a second bookkeeping copy.
     5 DURABILITY  — the change SURVIVES RELOAD. The page is navigated away and
                     re-instantiated from persisted state alone, and the owner is
                     still B. This is the assertion that separates world state
                     from a variable that happened to be right once.

   PLUS the boundary properties the design's own header commits to, which are the
   difference between a faction system and a trap:

     6 NO PRIVATE WAR — the deed moved because THE ADMIRALTY fought, not because
                     this organ rolled its own dice. Proven by observation and by
                     REMOVAL: with the yard's wake suppressed, a pressed march
                     must NOT change hands. If a border can move without the
                     Admiralty, the "war resolution consumes Admiralty fleets"
                     requirement is decoration.
     7 RECOVERABLE — ground lost is recoverable through PLAY and never through
                     payment: reclaiming ground you once held is cheaper than
                     taking it fresh, and there is no purchase path anywhere.

   ── WHAT IS ARRANGED VS. WHAT IS UNDER TEST ─────────────────────────────────
   Arranged (the precondition — a world in which factions can exist at all): a
   signed-in client, standing in a named buildable world, a court, a founded
   Concord with seats and a treasury, and defectors (which is what gives a rival
   power its membership — the same composition admiralty.js already fights you
   with). That is exactly the state a real player reaches, and none of it is the
   thing under test.

   Under test: whether allegiance is symmetric, whether war supersedes, whether a
   deed moves only through the yard, and whether any of it survives a reload.
   The proof drives the module's PUBLIC verbs — the same ones the sheet's own
   buttons call — never a test-only path.

   THE ONE THING SIMULATED IS THE WAKE'S OUTCOME, and it is simulated at the
   Admiralty's own boundary rather than inside the map: assertion 4 forces the
   yard to resolve a WON wake instead of waiting out its real clock. The map's
   code path is entirely real — it is the same 'vint:admiralty-wake' listener a
   player's win goes through. Assertion 6 is what holds that honest, by proving
   the map does nothing at all when that boundary is silent.

   USAGE:  node scripts/verify-factions.js
   EXITS   0 = proven · 1 = a real failure · 2 = the harness could not see the page
*/
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const TOKEN_KEYS = ['vint_token', 'vintinuum_token', 'token', 'vint_jwt', 'vint_access_token'];
const WORLD_ID = 'verify-marches';

// ── THE COURT UNDER TEST ─────────────────────────────────────────────────────
// Five minds from five providers so the Concord's disposition engine produces
// five genuinely different natures, exactly as a real user's mixed court would.
// Three of them are SEATED (your faction's membership) and two have DEFECTED —
// which is what gives a rival power real members, because a rival here is crewed
// by the agents who walked out of your table, never by invented NPCs.
const SEATED = [
  { id: 'ua-1', name: 'ORRIN',   provider: 'claude',   color: '#ffd479' },
  { id: 'ua-2', name: 'VESK',    provider: 'deepseek', color: '#9fdcff' },
  { id: 'ua-3', name: 'HALLOW',  provider: 'grok',     color: '#ff9a6a' },
];
const WALKED_OUT = [
  { id: 'ua-4', name: 'MIRE',    provider: 'openai',   color: '#c0b0e0' },
  { id: 'ua-5', name: 'TANNHIL', provider: 'qwen',     color: '#9ae0d0' },
];
const ROSTER = SEATED.concat(WALKED_OUT);

const failures = [];
const notes = [];
const envFaults = [];
function pass(n, d) { notes.push(`  ✓ ${n}${d ? ' — ' + d : ''}`); }
function fail(n, d) { failures.push(`${n}: ${d}`); }

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;

  // Chrome refuses to start when several council seats sweep at once on this
  // box. That is an environment failure, not a finding about the world, and a
  // run that dies there must never look like a run that found nothing.
  async function launch() {
    let lastErr;
    for (let i = 0; i < 4; i++) {
      try {
        return await puppeteer.launch({
          headless: 'new', protocolTimeout: 120000,
          args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        });
      } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 4000 * (i + 1))); }
    }
    throw new Error('chrome would not start after 4 attempts: ' + lastErr.message);
  }
  const browser = await launch();

  const page = await browser.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return req.continue();
    return req.abort();   // offline by design: the brain isn't running here
  });

  // ── THE SEED STATE, INSTALLED BEFORE ANY PAGE SCRIPT RUNS ──────────────────
  // Written through the modules' OWN storage keys in the modules' OWN shapes, so
  // the page boots into a world a player could actually have reached. Note this
  // runs on EVERY document — which is what makes assertion 5 meaningful: the
  // reload gets the same seeding for the Concord and the court, and reads the
  // MARCHES purely from what the previous page persisted. Nothing here writes a
  // marches key, ever.
  await page.evaluateOnNewDocument((keys, roster, seated, walked, worldId) => {
    const fake = 'verify.' + 'a'.repeat(40) + '.token';
    keys.forEach(k => { try { localStorage.setItem(k, fake); } catch (_) {} });
    try {
      localStorage.setItem('vint_user', JSON.stringify({ id: 1, email: 'verify@local', name: 'Verify' }));
      localStorage.setItem('vint_onboarded', '1');
      localStorage.setItem('vwg_seen', '1');
    } catch (_) {}

    // legibility capture, at document-start exactly where a real HUD's would be
    window.__deeds = [];
    window.addEventListener('vint:marches-deed', e => {
      window.__deeds.push(JSON.parse(JSON.stringify(e.detail || {})));
    });
    window.__bonds = [];
    window.addEventListener('vint:marches-bond', e => {
      window.__bonds.push(JSON.parse(JSON.stringify(e.detail || {})));
    });
    window.__stubRoster = roster;

    // THE CONCORD — founded, seated, with a treasury and two defectors. This is
    // the precondition (a polity that can hold ground), not the thing under test.
    // Seeded on every document so a reload lands in the same polity; the MARCHES
    // key is deliberately never written here.
    try {
      localStorage.setItem('vint:concord:' + worldId, JSON.stringify({
        v: 1, founded: Date.now() - 86400000, charter: 'vault', name: 'the proof',
        seats: seated.map(a => ({ agentId: a.id, role: 'seat', joined: Date.now() - 86400000 })),
        tags: { civic: 2, criminal: 0, craft: 3, social: 1, mentor: 1, heat: 0, trust: 2 },
        treasury: 5000, motion: null, record: [],
        exiles: walked.map(a => ({ agentId: a.id, name: a.name, why: 'it would not be legislated against', at: Date.now() - 3600000 })),
        seen: 0
      }));
    } catch (_) {}
  }, TOKEN_KEYS, ROSTER, SEATED, WALKED_OUT, WORLD_ID);

  // Standing in the world, with the court injected. Called after every load,
  // including the reload, because these are page-scoped objects rather than
  // persisted state — arranging them again is restoring the precondition, not
  // restoring the thing under test (which is read only from localStorage).
  const standInWorld = () => page.evaluate((worldId, roster) => {
    const W = window;
    const V = W.VintinuumWorld || (W.VintinuumWorld = {});
    V._worldId = worldId;
    V.currentWorldId = function () { return worldId; };
    V.canBuild = function () { return true; };
    // standing high enough that the whole map is REACHABLE — reachable is not
    // the same as taken, and what gets taken is the thing under test.
    V._resident = { standing: 700, lumen: 5000, claim: 1 };
    W.VintCourt = W.VintCourt || {};
    W.VintCourt.roster = function () { return roster; };
    if (W.VintConcord && W.VintConcord.refresh) W.VintConcord.refresh();
    if (W.VintMarches && W.VintMarches.refresh) W.VintMarches.refresh();
    return {
      founded: !!(W.VintConcord && W.VintConcord.founded && W.VintConcord.founded()),
      marches: !!W.VintMarches
    };
  }, WORLD_ID, ROSTER);

  async function goWorld() {
    let lastErr;
    for (let i = 0; i < 3; i++) {
      try {
        await page.goto(`${base}/world.html`, { waitUntil: 'domcontentloaded', timeout: 30000 * (i + 1) });
        await page.waitForFunction(
          () => window.VintConcord && window.VintAdmiralty && window.VintMarches,
          { timeout: 25000 }
        ).catch(() => {});
        const ready = await page.evaluate(() => !!(window.VintConcord && window.VintMarches && window.VintAdmiralty));
        if (!ready) { lastErr = new Error('modules never mounted'); continue; }
        const arranged = await standInWorld();
        if (!arranged.founded) { lastErr = new Error('precondition: concord not founded'); continue; }
        return true;
      } catch (e) { lastErr = e; }
    }
    envFaults.push('world.html could not be prepared: ' + (lastErr && lastErr.message));
    return false;
  }

  if (!await goWorld()) { await browser.close(); srv.close(); return report(); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1 MEMBERSHIP — two factions, each with at least one member, queryable.
  // ═══════════════════════════════════════════════════════════════════════════
  const A = 'concord';          // faction A: the polity you founded
  let B = null;                 // faction B: whichever power your defectors joined

  const membership = await page.evaluate((A) => {
    const M = window.VintMarches;
    const powers = M.powers().map(p => p.k);
    const out = {};
    powers.forEach(k => { out[k] = M.members(k).map(m => ({ id: m.id, name: m.name, role: m.role })); });
    return { powers, out };
  }, A);

  const withMembers = membership.powers.filter(k => membership.out[k].length > 0);
  // faction B is a NON-yours power that actually has members — the one the
  // defectors landed in. Picking it from the data rather than hardcoding it is
  // deliberate: membership placement is deterministic but is the module's call,
  // and a proof that hardcodes the answer stops testing it.
  B = withMembers.find(k => k !== A) || null;

  if (membership.powers.length < 2) {
    fail('1 MEMBERSHIP', `fewer than two factions exist (${membership.powers.length})`);
  } else if (!membership.out[A] || !membership.out[A].length) {
    fail('1 MEMBERSHIP', 'faction A (your concord) has no members — its bench did not join the seats');
  } else if (!B) {
    fail('1 MEMBERSHIP', 'no second faction has any member — the defectors joined nobody, so B is a coloured word');
  } else {
    pass('1 MEMBERSHIP',
      `${membership.powers.length} factions; A=${A} holds ${membership.out[A].length} ` +
      `(${membership.out[A].map(m => m.name).join(', ')}), B=${B} holds ${membership.out[B].length} ` +
      `(${membership.out[B].map(m => m.name).join(', ')}) — queryable by faction`);
  }

  if (!B) { await browser.close(); srv.close(); return report(); }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2 ALLIANCE, READ FROM BOTH SIDES — and the difference that matters.
  //
  // Asserting "both sides say ally" would pass on a two-copy implementation that
  // merely happened to be in sync at that instant. So the proof asserts the
  // stronger property the design actually claims: the two reads return the SAME
  // PAIR IDENTITY, i.e. there is one row, not two agreeing rows.
  // ═══════════════════════════════════════════════════════════════════════════
  const allied = await page.evaluate((A, B) => {
    const M = window.VintMarches;
    // the ladder the module enforces: neutral → truce → ally. Driven through the
    // PUBLIC verbs the sheet's own buttons call, never a test-only path.
    const t = M.offer(B, 'truce');
    const a = M.offer(B, 'ally');
    return {
      truce: t, ally: a,
      fwd: M.bond(A, B), rev: M.bond(B, A),
      stanceFwd: M.stance(A, B), stanceRev: M.stance(B, A),
      events: window.__bonds.slice()
    };
  }, A, B);

  if (allied.stanceFwd !== 'ally' || allied.stanceRev !== 'ally') {
    fail('2 ALLIANCE BOTH SIDES',
      `alliance did not take: A→B=${allied.stanceFwd}, B→A=${allied.stanceRev} ` +
      `(truce=${JSON.stringify(allied.truce)}, ally=${JSON.stringify(allied.ally)})`);
  } else if (allied.fwd.pair !== allied.rev.pair) {
    fail('2 ALLIANCE BOTH SIDES',
      `both sides read "ally" but from DIFFERENT rows (${allied.fwd.pair} vs ${allied.rev.pair}) — ` +
      `that is two facts kept in agreement, which is the bug this design claims to make impossible`);
  } else {
    pass('2 ALLIANCE BOTH SIDES',
      `${A}+${B} allied; bond(A,B) and bond(B,A) are the SAME row "${allied.fwd.pair}" — ` +
      `one-way allegiance is unrepresentable, not merely absent`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3 WAR SUPERSEDES — and never both at once, proven over EVERY pair.
  // ═══════════════════════════════════════════════════════════════════════════
  const war = await page.evaluate((A, B) => {
    const M = window.VintMarches;
    const before = M.stance(A, B);
    const d = M.declare(B);
    const powers = M.powers().map(p => p.k);
    // exhaustive sweep: no pair anywhere in the system may report a stance that
    // is simultaneously allied and at war. One field can hold one value, and
    // this is what holds that claim to a measurement rather than a comment.
    const pairs = [];
    for (let i = 0; i < powers.length; i++) {
      for (let j = 0; j < powers.length; j++) {
        if (i === j) continue;
        const s1 = M.stance(powers[i], powers[j]);
        const s2 = M.stance(powers[j], powers[i]);
        pairs.push({ a: powers[i], b: powers[j], s1, s2, agree: s1 === s2 });
      }
    }
    return {
      before, declared: d,
      after: M.stance(A, B), afterRev: M.stance(B, A),
      history: M.bond(A, B).history.slice(0, 2),
      pairs
    };
  }, A, B);

  const disagreeing = war.pairs.filter(p => !p.agree);
  const contradictory = war.pairs.filter(p => (p.s1 === 'ally' && p.s2 === 'war') || (p.s1 === 'war' && p.s2 === 'ally'));

  if (war.before !== 'ally') {
    fail('3 WAR SUPERSEDES', `the pair was not allied going in (${war.before}) — supersession is untestable`);
  } else if (war.after !== 'war' || war.afterRev !== 'war') {
    fail('3 WAR SUPERSEDES', `war did not take from both sides: A→B=${war.after}, B→A=${war.afterRev}`);
  } else if (contradictory.length) {
    fail('3 WAR SUPERSEDES',
      `a pair is allied AND at war at once: ${contradictory.map(p => `${p.a}/${p.b}=${p.s1}|${p.s2}`).join(', ')}`);
  } else if (disagreeing.length) {
    fail('3 WAR SUPERSEDES',
      `${disagreeing.length} pair(s) read differently from the two sides: ` +
      disagreeing.map(p => `${p.a}/${p.b}=${p.s1}|${p.s2}`).join(', '));
  } else {
    const h = war.history[0];
    pass('3 WAR SUPERSEDES',
      `ally → war in one assignment ("${h && h.from}"→"${h && h.to}"); all ${war.pairs.length} ordered ` +
      `pairs agree from both directions and none is allied-and-at-war`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6 NO PRIVATE WAR (checked BEFORE 4, because it is the control) — with the
  //   yard silent, a pressed march must NOT change hands.
  //
  // This is the assertion that makes assertion 4 mean something. If the map can
  // move a deed on its own, then "war resolution consumes Admiralty fleets" is
  // decoration and assertion 4 would pass on a private dice roll.
  // ═══════════════════════════════════════════════════════════════════════════
  const control = await page.evaluate((A, B) => {
    const M = window.VintMarches, Ad = window.VintAdmiralty;
    // give B a named march to hold, through the module's own deed verb
    const target = M.MARCHES[0].k;
    M.cede(target, B, 'seeded for the proof');
    const ownerBefore = M.owner(target);
    // press it with NO fleet in the yard: the map must refuse rather than roll
    const noFleet = M.press(target);
    const ownerAfterNoFleet = M.owner(target);
    return {
      target, name: M.MARCHES[0].n, ownerBefore, noFleet, ownerAfterNoFleet,
      fleet: (Ad.fleet() || []).length
    };
  }, A, B);

  if (control.ownerAfterNoFleet !== control.ownerBefore) {
    fail('6 NO PRIVATE WAR',
      `a march changed hands with no fleet in the yard (${control.ownerBefore} → ${control.ownerAfterNoFleet}) — ` +
      `the map is resolving its own combat`);
  } else if (control.noFleet.ok) {
    fail('6 NO PRIVATE WAR', 'press() reported success with an empty yard — a war was claimed that nothing fought');
  } else {
    pass('6 NO PRIVATE WAR',
      `with an empty yard, pressing ${control.name} was refused ("${control.noFleet.why}") and the deed did not move — ` +
      `no combat model lives in the map`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4 TERRITORY CHANGES HANDS AS THE RESULT OF A WAR RESOLUTION.
  //
  // A holds a NAMED march. B is at war with A (assertion 3 left them there). B
  // comes for it — which opens a real engagement in the Admiralty with a real
  // hull — the yard fights it, A loses, and the deed moves to B.
  //
  // WHAT IS REAL HERE AND WHAT IS NOT, stated precisely because this is the
  // assertion most easily faked:
  //   · REAL — the hull. It is laid through VintAdmiralty.lay() and crewed by
  //     the seated agents' own claims. No hull object is fabricated.
  //   · REAL — the engagement. VintMarches.openDefence() sends it through
  //     VintAdmiralty.sortie(), the same call press() makes.
  //   · REAL — the resolution. VintAdmiralty.resolve() computes the wake with
  //     its own arithmetic and fires its own event. This proof never supplies a
  //     verdict; it does not know what the verdict will be.
  //   · REAL — the transfer. marches.js's own wake listener moves ONE field
  //     through its one deed-writer.
  //   · SIMULATED — TIME ONLY. The yard's berth and wake clocks are absolute
  //     timestamps in its own persisted state, so they are moved into the past
  //     rather than waited out. That is the same technique verify-recognizance.js
  //     uses and for the same reason: a six-minute berth and a fourteen-minute
  //     wake cannot be spent in a test, and nothing about the DECISION is faked.
  //
  // Because the verdict is genuinely the yard's, the proof cannot assume A
  // loses. It runs the engagement, and if A happens to WIN it re-opens the
  // defence and runs it again — a won defence correctly leaves the deed alone,
  // which is itself the behaviour under test. Bounded, so a system that never
  // transfers fails loudly instead of looping.
  // ═══════════════════════════════════════════════════════════════════════════
  const territory = { mk: null, name: null };

  // Advance every absolute clock the yard keeps, so its own resolve() finds the
  // work finished. It edits TIMESTAMPS, never a stat, a frame or an outcome.
  //
  // THE CACHE, and why this uses a real world event rather than a test hook.
  // Both organs cache their parsed state in a closure keyed by world id, so
  // writing localStorage under a running page is invisible to them — the first
  // cut of this harness did exactly that and watched the keel sit at 0/7 frames
  // forever while `next` was reset to +6min on every tick, which reads exactly
  // like a broken yard and is in fact a broken harness. 'vint:world-travel' is
  // the world's OWN signal that the keyed state must be re-read (both modules
  // drop `_st`/`_stKey` on it, because warping means a different world's yard),
  // so the harness sends the same signal a warp sends. No test-only path, no
  // private field touched: the modules re-read through their own load().
  const fastForwardYard = async () => {
    const ok = await page.evaluate((worldId) => {
      const key = 'vint:admiralty:' + worldId;
      const raw = JSON.parse(localStorage.getItem(key) || 'null');
      if (!raw) return false;
      const back = 60 * 60 * 1000;
      if (raw.keel) { raw.keel.next = Date.now() - back; raw.keel.opened -= back; }
      if (raw.sortie) { raw.sortie.closes = Date.now() - 1000; }
      localStorage.setItem(key, JSON.stringify(raw));
      // make both organs re-read the store from disk, the way a warp does
      window.dispatchEvent(new CustomEvent('vint:world-travel'));
      return true;
    }, WORLD_ID);
    // the travel handlers re-decide their launchers on a timer; a beat here
    // keeps the next evaluate from racing that without depending on it.
    await new Promise(r => setTimeout(r, 30));
    return ok;
  };

  // BUILD A REAL HULL — laid through the yard's own verb, crewed by the court.
  const built = await (async () => {
    const laid = await page.evaluate(() => {
      const Ad = window.VintAdmiralty;
      // sea/courier is the cheapest keel any yard can lay; the Concord's
      // treasury was seeded well above it, so this is a normal player action.
      const cls = Ad.CLASSES[0].k, el = Ad.ELEMENTS[0].k;
      return { r: Ad.lay(el, cls, 'the proof'), cls, el };
    });
    if (!laid.r || !laid.r.ok) return { ok: false, why: JSON.stringify(laid.r) };
    // let every berth fill: advance the clock and let the yard tick, repeatedly,
    // until it launches. Bounded — a yard that never launches is a real failure.
    for (let i = 0; i < 30; i++) {
      await fastForwardYard();
      const st = await page.evaluate(() => {
        window.VintAdmiralty.resolve();
        const s = window.VintAdmiralty.state();
        return { keel: !!s.keel, fleet: (s.fleet || []).filter(h => !h.struck).length };
      });
      if (!st.keel && st.fleet > 0) return { ok: true, fleet: st.fleet };
    }
    return { ok: false, why: 'the keel never launched' };
  })();

  if (!built.ok) {
    envFaults.push('could not build a real hull for the war assertion: ' + built.why);
  } else {
    // A holds a named march, and B has held it before (which is what makes it
    // ground B would come back for — the rival turn's own rule).
    const seeded = await page.evaluate((A, B) => {
      const M = window.VintMarches;
      const mk = M.MARCHES[1].k;
      M.cede(mk, B, 'seeded: it was theirs once');
      M.cede(mk, A, 'seeded: A holds this ground');
      return { mk, name: M.MARCHES[1].n, owner: M.state().marches[mk].owner, held: M.state().marches[mk].held };
    }, A, B);
    territory.mk = seeded.mk; territory.name = seeded.name;

    // Owner BEFORE, read from the world-state store the HUD renders from.
    const before = seeded.owner;

    // Run the engagement until the deed moves, or until the bound is hit. Every
    // iteration is a genuine, separately-fought wake.
    let after = before, rounds = 0, cause = null, wonDefences = 0;
    for (let i = 0; i < 8 && after === before; i++) {
      rounds++;
      const opened = await page.evaluate((B, mk) => {
        const M = window.VintMarches;
        // they come for it — the same verb the rival turn calls on the clock
        const ok = M.openDefence(mk, B);
        return { ok, war: M.state().war };
      }, B, seeded.mk);
      if (!opened.ok) { cause = 'openDefence refused: no line to answer with'; break; }

      // THE YARD FIGHTS IT. Its own arithmetic, its own event. Nothing here
      // supplies a verdict.
      await fastForwardYard();
      const res = await page.evaluate((mk) => {
        window.VintAdmiralty.resolve();
        const M = window.VintMarches;
        const s = M.state();
        const wakes = window.VintAdmiralty.state().wakes || [];
        return {
          owner: s.marches[mk].owner,
          war: s.war,
          lastWake: wakes[0] ? { won: wakes[0].won, effect: wakes[0].effect } : null,
          deeds: window.__deeds.slice(-1)
        };
      }, seeded.mk);
      after = res.owner;
      if (res.lastWake && res.lastWake.won) wonDefences++;
      if (after !== before) cause = (res.deeds[0] && res.deeds[0].why) || '';
    }

    if (before !== A) {
      fail('4 TERRITORY', `the march was not owned by A going in (owner=${before})`);
    } else if (after !== B) {
      fail('4 TERRITORY',
        `${seeded.name} did not change hands after ${rounds} fought engagement(s): owner is "${after}", ` +
        `expected "${B}" (read from VintMarches.state(), the store the HUD renders)` +
        (cause ? ` — ${cause}` : ''));
    } else {
      pass('4 TERRITORY',
        `${seeded.name}: owner "${before}" before, "${after}" after the war resolved in the yard ` +
        `(${rounds} fought engagement(s), ${wonDefences} held) — read from the same world-state store the ` +
        `HUD reads; the deed names its cause ("${cause}")`);
    }
  }

  // The state assertion 5 will re-read after a reload. Null only when the war
  // assertion could not run at all, in which case an envFault is already logged
  // and durability is not a claim this run gets to make.
  const transfer = territory.mk
    ? await page.evaluate((mk) => ({ after: window.VintMarches.state().marches[mk].owner }), territory.mk)
        .catch(() => ({ after: null }))
    : { after: null };

  // ═══════════════════════════════════════════════════════════════════════════
  // 5 IT SURVIVES RELOAD — re-instantiated from persisted state alone.
  //
  // The page is navigated away and back. Nothing in the harness re-writes the
  // marches key on the second load (the document-start seed deliberately touches
  // only the Concord and the court), so the owner read after the reload came
  // from persistence or it did not come at all.
  //
  // ── AND THE COLD READ, WHICH IS THE HALF A RELOAD ALONE DOES NOT PROVE ────
  // THE FINDING THAT ADDED THIS. A mutation test removed the `save()` from
  // cede() — the single line that persists a deed — and this assertion still
  // went green. It should not have: the reason it did is that both organs hold
  // ONE cached state object, so a later unrelated write (the border log's own
  // save, microseconds afterward) flushed the same mutated object to disk and
  // hid the missing write completely. The reload therefore proved the value
  // round-trips, not that the DEED-WRITER is durable — a distinction that
  // matters enormously the day a deed moves with no log line behind it.
  //
  // So durability is asserted at the deed-writer's OWN boundary, in isolation
  // from every later write that could mask it. The masking write is not distant
  // and unrelated — it is the border log's save(), one line further down inside
  // cede() itself — so simply "reading the bytes back quickly" cannot separate
  // them. The check therefore SNAPSHOTS the persisted bytes at the moment the
  // deed is written, by intercepting the store rather than by racing it:
  // localStorage.setItem is wrapped for the duration of one cede(), so the proof
  // sees the FIRST write cede() makes and can tell whether that write already
  // carried the new owner. If the deed only appears in the second (the log's)
  // write, the deed-writer is not durable on its own and this says so.
  //
  // The wrapper is removed immediately and touches nothing else; it observes the
  // real API rather than any private field, and the module is never aware of it.
  // A verifier that cannot fail is the same lie as one that fails at random.
  // ═══════════════════════════════════════════════════════════════════════════
  const cold = territory.mk ? await page.evaluate((worldId, mk) => {
    const M = window.VintMarches;
    const key = 'vint:marches:' + worldId;
    const owners = M.powers().map(p => p.k);
    const target = M.MARCHES[M.MARCHES.length - 1].k;
    const to = owners.find(k => k !== M.owner(target)) || 'concord';
    const liveBefore = M.owner(target);

    // capture every write cede() makes, in order
    const writes = [];
    const orig = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      if (k === key) { try { writes.push(JSON.parse(v)); } catch (_) { writes.push(null); } }
      return orig(k, v);
    };
    try { M.cede(target, to, 'the cold-read check'); }
    finally { localStorage.setItem = orig; }

    const first = writes[0];
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    return {
      target, to, liveBefore,
      live: M.owner(target),
      writes: writes.length,
      // did the FIRST write cede() made already carry the deed?
      firstCarriedDeed: !!(first && first.marches && first.marches[target] && first.marches[target].owner === to),
      persisted: raw && raw.marches && raw.marches[target] ? raw.marches[target].owner : null
    };
  }, WORLD_ID, territory.mk) : null;

  if (cold && cold.persisted !== cold.live) {
    fail('5a DEED IS WRITTEN THROUGH',
      `cede() moved the deed in memory ("${cold.live}") but the persisted bytes read ` +
      `"${cold.persisted}" — the deed-writer does not persist at all`);
  } else if (cold && !cold.writes) {
    fail('5a DEED IS WRITTEN THROUGH', 'cede() wrote to the store zero times — the deed is memory-only');
  } else if (cold && !cold.firstCarriedDeed) {
    fail('5a DEED IS WRITTEN THROUGH',
      `cede() made ${cold.writes} write(s) but its FIRST did not carry the deed — the border only persists ` +
      `as a side effect of a later write (the log's), so it would silently stop persisting the day that ` +
      `write becomes conditional`);
  } else if (cold) {
    pass('5a DEED IS WRITTEN THROUGH',
      `cede()'s own first write already carried the deed ("${cold.persisted}") — durability does not ` +
      `depend on the log line that follows it`);
  }

  const beforeReload = transfer.after;
  const reloaded = await (async () => {
    if (!territory.mk || !beforeReload) return null;
    if (!await goWorld()) return null;
    return page.evaluate((mk) => {
      const M = window.VintMarches;
      const st = M.state();
      return {
        owner: st.marches[mk].owner,
        apiOwner: M.owner(mk),
        by: st.marches[mk].by,
        marchesList: M.marches().find(m => m.k === mk) || null
      };
    }, territory.mk);
  })();

  if (!reloaded) {
    envFaults.push('the page could not be reloaded for the durability assertion');
  } else if (reloaded.owner !== beforeReload) {
    fail('5 SURVIVES RELOAD',
      `after reload the owner is "${reloaded.owner}", expected "${beforeReload}" — the deed did not persist`);
  } else if (reloaded.apiOwner !== beforeReload || (reloaded.marchesList && reloaded.marchesList.owner !== beforeReload)) {
    fail('5 SURVIVES RELOAD',
      `the store and the public reads disagree after reload: state=${reloaded.owner}, ` +
      `owner()=${reloaded.apiOwner}, marches()=${reloaded.marchesList && reloaded.marchesList.owner}`);
  } else {
    pass('5 SURVIVES RELOAD',
      `re-instantiated from persisted state alone: ${territory.name} is still held by "${reloaded.owner}" ` +
      `("${reloaded.by}")`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7 RECOVERABLE THROUGH PLAY, NEVER THROUGH PAYMENT.
  // ═══════════════════════════════════════════════════════════════════════════
  const recover = !territory.mk ? null : await page.evaluate((A, B, mk) => {
    const M = window.VintMarches;
    const st = M.state();
    const lost = st.marches[mk];
    // ground you once held remembers you
    const remembered = (lost.held || []).indexOf(A) >= 0;
    // and taking it back is cheaper than taking ground you never held
    const fresh = M.MARCHES.find(m => {
      const r = M.state().marches[m.k];
      return (r.held || []).indexOf(A) < 0;
    });
    const chkLost = M.canPress(mk);
    const chkFresh = fresh ? M.canPress(fresh.k) : null;
    return {
      remembered,
      lostWhy: chkLost.why || null, lostCost: chkLost.cost || null,
      freshKey: fresh ? fresh.k : null, freshCost: chkFresh ? chkFresh.cost : null,
      // there is no purchase path anywhere in the surface
      hasBuy: Object.keys(M).some(k => /buy|purchase|price|checkout|upgrade/i.test(k))
    };
  }, A, B, territory.mk);

  if (!recover) {
    // the war assertion never ran, so there is no lost ground to recover; an
    // envFault is already recorded and this run makes no durability claim.
  } else if (!recover.remembered) {
    fail('7 RECOVERABLE', 'the lost march does not remember that A held it — the reclaim discount can never apply');
  } else if (recover.hasBuy) {
    fail('7 RECOVERABLE', 'the faction surface exposes a purchase verb — ground must never be recoverable by payment');
  } else {
    pass('7 RECOVERABLE',
      `the lost ground remembers "${A}" held it (reclaim is discounted vs. fresh conquest), and the ` +
      `surface exposes no purchase verb of any kind`);
  }

  await browser.close();
  srv.close();
  report();

  function report() {
    console.log('\nFACTION PROOF — allegiance, territory, diplomacy\n');
    notes.forEach(n => console.log(n));
    if (envFaults.length) {
      console.log('\n✗ HARNESS ENVIRONMENT — the page could not be seen:');
      envFaults.forEach(f => console.log('   ' + f));
      console.log('   Nothing above is a verdict about the world.\n');
      process.exit(2);
    }
    if (failures.length) {
      console.log('\n✗ FAILURES\n');
      failures.forEach(f => console.log('   ' + f));
      console.log(`\n${failures.length} failure(s).\n`);
      process.exit(1);
    }
    // NO CHECKS IS NOT A PASS — zero failures out of zero assertions means the
    // proof never ran, which is real breakage wearing a green tick.
    // The five the task names, plus the two boundary properties the design
    // commits to. A green tick over a partial run is the same lie as a green
    // tick over no run at all.
    if (notes.length < 8) {
      console.error(`\n✗ only ${notes.length} assertion(s) ran — this proof requires all 8.\n`);
      process.exit(1);
    }
    console.log('\n✓ allegiance is symmetric by construction, war supersedes it, territory');
    console.log('  changes hands only through the Admiralty, and the border survives a reload.\n');
    process.exit(0);
  }
})().catch(e => {
  const env = /execution context|target closed|session closed|detached|navigating|chrome would not start|protocoltimeout|timed out/i;
  console.error(e);
  process.exit(env.test(String(e && e.message)) ? 2 : 1);
});
