#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════════
   verify-agent-autonomy-B8CJNB9.js — headless proof for AGENT FORGE AUTONOMY.

   THE CLAIM UNDER TEST. A user's world is inhabited by agents who act on their
   OWN across the organs they could never reach before — they gather raw matter,
   make things at the anvil, TEACH a peer a recipe, and join a great work — and
   WHICH agent does WHICH is decided by that agent's Concord disposition, not a
   coin. Every act is REAL (a server verb under a reserved id, the shipped
   `world:gather:agent` pattern) or an honest no-op; none is fabricated. The acts
   surface in the clearing CO-EQUALLY with a human's, through the very same
   broadcast a human's act rides. A kill switch stops them all in a beat; a hush
   silences one. When an organ is absent, nothing throws.

   Because the forge organs are SERVER-authoritative, an honest proof has to
   exercise the real SERVER (vintinuum-api/world/gather.js + forge.js), not only
   the page — so this harness runs in THREE phases:

     A · THE CHOICE, pure. The disposition-driven chooser, with no world at all:
         a builder reaches for craft/gather, a mentor for teach, a civic/social/
         trusting agent for the great work; it is deterministic; it respects the
         threshold; and the server's disposition is PROVEN identical, axis by
         axis, to the client's concord.js — the one source the whole system
         leans on — so the two runtimes can never drift.

     B · THE ACT, real, against a THROWAWAY database (SEED_HOME → /tmp, never
         prod). A gather, a craft, a teach and a contribute each LAND as real
         rows under reserved agent ids and broadcast; the kill switch and the
         hush are honoured; a settled clearing is a quiet no-op, never a fake row.

     C · THE SURFACE, in the REAL headless world.html (real CSS, real neighbours).
         An agent's act renders in the river CO-EQUALLY with a human's — the
         agent is named on the artifact exactly as a person is — with ZERO
         collision at 320/375/768/1280/1920px, and the client kill flag reads.

   Network is intercepted in phase C: only file:// loads; everything else is
   aborted, so the run is hermetic. Puppeteer is resolved from the sibling api
   repo (the only copy on this machine).
   ──────────────────────────────────────────────────────────────────────────── */
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

// ── a throwaway SEED_HOME so requiring the server's db opens a FRESH temp DB,
//    never prod. Must be set BEFORE anything pulls in ../db. ───────────────────
const SEED = fs.mkdtempSync(path.join(os.tmpdir(), 'aether-B8CJNB9-'));
fs.mkdirSync(path.join(SEED, 'genome'), { recursive: true });
process.env.SEED_HOME = SEED;

const API = '/home/vinta/vintinuum-api';
const gather = require(path.join(API, 'world/gather'));
const forge = require(path.join(API, 'world/forge'));
const srvDisp = require(path.join(API, 'world/disposition'));
const db = require(path.join(API, 'db'));
// the client's own disposition — required headless (UMD, no DOM) to prove the
// server port matches it bit-for-bit.
const clientConcord = require('/home/vinta/vintinuum/body/world/concord.js');

const WORLD = 'file://' + path.resolve(__dirname, '..', 'world.html');
const BREAKPOINTS = [320, 375, 768, 1280, 1920];
const UNI = 'universe';

const results = [];
function ok(label) { results.push({ pass: true, label }); console.log('  PASS  ' + label); }
function bad(label, extra) { results.push({ pass: false, label }); console.log('  FAIL  ' + label + (extra ? '  → ' + extra : '')); }
function assert(cond, label, extra) { cond ? ok(label) : bad(label, extra); }

function intersects(a, b) {
  return !(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 ||
           a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5);
}

const ACTORS = gather.AGENT_ACTORS;
const byKey = (k) => ACTORS.find(a => a.key === k);
const idOf = (k) => byKey(k).id;

// ── DB helpers for phase-B setup (arranging PRECONDITIONS is not fabrication —
//    it is the same thing the sibling verifiers do when they feed real event
//    shapes; the ACT under test is always performed by the real tick). ─────────
async function wipeWorldEconomy() {
  for (const a of ACTORS) {
    await db.dbRun('DELETE FROM world_inventory WHERE user_id=?', [a.id]);
    await db.dbRun('DELETE FROM world_knowledge WHERE user_id=?', [a.id]);
  }
  await db.dbRun(`DELETE FROM world_endeavours`);
  await db.dbRun(`DELETE FROM world_endeavour_parts`);
}
async function depleteNodes() {
  // work every node out AND push its regrow far away so _reconcile won't heal it
  await db.dbRun(`UPDATE world_gather_nodes SET charges=0, regrow_at=? WHERE world_id=?`,
    [Math.floor(Date.now() / 1000) + 99999, UNI]);
}
async function healNodes() {
  await db.dbRun(`UPDATE world_gather_nodes SET charges=max_charges, regrow_at=0 WHERE world_id=?`, [UNI]);
}
async function give(key, item, n) {
  await db.dbRun(
    `INSERT INTO world_inventory (user_id, item, count) VALUES (?,?,?)
       ON CONFLICT(user_id, item) DO UPDATE SET count = count + ?`, [idOf(key), item, n, n]);
}
async function teachKnown(key, recipeId) {
  await db.dbRun(`INSERT OR IGNORE INTO world_knowledge (user_id, recipe_id, via) VALUES (?,?, 'test')`, [idOf(key), recipeId]);
}
async function knows(key, recipeId) { return await forge.knows(idOf(key), recipeId); }
function captureHost() {
  const bc = [];
  return { bc, host: { _broadcast: (o) => bc.push(o), _broadcastAll: (o) => bc.push(o) } };
}

(async () => {
  console.log('AGENT FORGE AUTONOMY — verify B8CJNB9');
  console.log('temp DB: ' + path.join(SEED, 'genome/vintinuum.db') + '\n');

  // ════════════════════════════════════════════════════════════════════════
  // PHASE A — THE CHOICE, pure (no DB, no clock but the tick index).
  // ════════════════════════════════════════════════════════════════════════
  console.log('── PHASE A · the choice, pure ──');

  // A0 — the server disposition IS the client's, axis for axis (no drift).
  let dispMatch = true, worstDelta = 0;
  for (const a of ACTORS) {
    const cd = clientConcord.disposition(a), sd = srvDisp.dispositionOf(a);
    for (const t of srvDisp.TAGS) { const dd = Math.abs(cd[t] - sd[t]); if (dd > worstDelta) worstDelta = dd; if (dd > 1e-9) dispMatch = false; }
  }
  assert(dispMatch, 'server disposition.js matches client concord.js bit-for-bit (no drift)', 'worstΔ=' + worstDelta);

  // A1 — argmax per agent, every organ available: builders make, the mentor teaches.
  const allCan = { gather: true, craft: true, teach: true, contribute: true, holdsLittle: false };
  function argmax(key) {
    const p = gather.organPressures(srvDisp.dispositionOf(byKey(key)), allCan, 7, key);
    return Object.keys(p).sort((x, y) => p[y] - p[x])[0];
  }
  assert(argmax('vintinuum') === 'teach', 'the mentor (VINTINUUM) reaches for TEACH', argmax('vintinuum'));
  assert(['craft', 'gather'].includes(argmax('atlas')), 'the builder (ATLAS) reaches for craft/gather', argmax('atlas'));
  assert(['craft', 'gather'].includes(argmax('lunex')), 'the builder (LUNEX) reaches for craft/gather', argmax('lunex'));

  // A2 — the great work is claimed by the civic/social/trusting character. When
  //      the ONLY legal act is joining a great work, the agent highest on
  //      civic+social+trust is the one chosen.
  const contribOnly = ACTORS.map(a => ({ actor: a, disp: srvDisp.dispositionOf(a), can: { contribute: true } }));
  const cst = (k) => { const d = srvDisp.dispositionOf(byKey(k)); return Math.max(0, d.civic) + Math.max(0, d.social) + Math.max(0, d.trust); };
  const expectCST = ACTORS.map(a => a.key).sort((x, y) => cst(y) - cst(x))[0];
  const contribWin = gather.chooseAct(contribOnly, 3);
  assert(contribWin && contribWin.organ === 'contribute', 'great-work organ is reached when it is the only legal act');
  assert(contribWin && contribWin.actor.key === expectCST,
    'the most civic/social/trusting agent is the one who joins the great work', contribWin && contribWin.actor.key + ' vs ' + expectCST);

  // A3 — determinism: identical candidates + tick ⇒ identical winner, always.
  const cand = ACTORS.map(a => ({ actor: a, disp: srvDisp.dispositionOf(a), can: allCan }));
  const w1 = gather.chooseAct(cand, 42), w2 = gather.chooseAct(cand, 42);
  assert(w1 && w2 && w1.actor.key === w2.actor.key && w1.organ === w2.organ,
    'deterministic: same world + same tick ⇒ same act', JSON.stringify([w1 && w1.actor.key, w2 && w2.actor.key]));

  // A4 — the threshold: a settled clearing is quiet. No capability ⇒ no act.
  assert(gather.chooseAct([], 1) === null, 'empty candidate set ⇒ nobody acts (null)');
  const weak = [{ actor: byKey('atlas'), disp: { civic: 0, craft: 0, social: 0, mentor: 0, trust: 0 }, can: { gather: true, holdsLittle: false } }];
  assert(gather.chooseAct(weak, 1) === null, 'below-threshold pressure ⇒ nobody acts (null)', JSON.stringify(gather.organPressures(weak[0].disp, weak[0].can, 1, 'atlas')));

  // ════════════════════════════════════════════════════════════════════════
  // PHASE B — THE ACT, real, against the throwaway DB.
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n── PHASE B · the act, real (throwaway DB) ──');
  await gather._ensure();
  await forge._ensure();
  await gather._seedWorld(UNI);

  // B1 — GATHER lands. Fresh clearing, healthy nodes, empty hands ⇒ some agent
  //      walks to a node and pulls real matter into its own reserved inventory.
  await wipeWorldEconomy(); await healNodes();
  gather.pauseAgents(false); ['vintinuum', 'aria', 'atlas', 'lunex', 'yuna'].forEach(k => gather.hushAgent(k, false));
  let cap = captureHost();
  let deed = await gather.runAgentTick(cap.host);
  assert(deed && deed.kind === 'gather', 'a GATHER act lands on a fresh clearing', deed && deed.kind);
  if (deed && deed.kind === 'gather') {
    const inv = await db.dbGet('SELECT count FROM world_inventory WHERE user_id=? AND item=?', [deed.whoId, deed.item]);
    assert(inv && inv.count >= 1, 'the gather wrote REAL matter to the agent’s reserved inventory', inv && inv.count);
    assert(gather.AGENT_BY_ID.has(deed.whoId), 'the actor is a reserved council id (not a real user)', deed.whoId);
    assert(cap.bc.some(b => b.t === 'world:gather:agent' && b.kind === 'gather'), 'the gather broadcast the shared world:gather:agent frame');
  }

  // B2 — CRAFT lands. One agent holds a full raw recipe, nodes are worked out so
  //      gather is off the table ⇒ the builder carries it to the anvil and makes.
  await wipeWorldEconomy(); await depleteNodes();
  await give('atlas', 'stone', 3); await give('atlas', 'timber', 3);   // ≥6: not holdsLittle; hand_axe = stone+timber
  cap = captureHost();
  deed = await gather.runAgentTick(cap.host);
  assert(deed && deed.kind === 'craft' && deed.agentKey === 'atlas', 'a CRAFT act lands (the builder makes a thing)', deed && (deed.kind + '/' + deed.agentKey));
  assert(deed && deed.kind === 'craft' ? await knows('atlas', 'hand_axe') : false, 'the craft wrote REAL knowledge: ATLAS now knows the recipe it made');
  assert(cap.bc.some(b => b.t === 'world:gather:agent' && b.kind === 'craft'), 'the craft broadcast the shared world:gather:agent frame');

  // B3 — TEACH lands. VINTINUUM knows a recipe ATLAS does not; the mentor's teach
  //      pressure is the highest in the whole system, so it teaches — for real.
  await wipeWorldEconomy(); await depleteNodes();
  await teachKnown('vintinuum', 'hand_axe');
  assert(!(await knows('atlas', 'hand_axe')), 'precondition: ATLAS does not yet know the recipe');
  cap = captureHost();
  deed = await gather.runAgentTick(cap.host);
  assert(deed && deed.kind === 'teach' && deed.agentKey === 'vintinuum', 'a TEACH act lands (the mentor teaches)', deed && (deed.kind + '/' + deed.agentKey));
  assert(deed && deed.kind === 'teach' ? await knows(deed.studentKey, 'hand_axe') : false,
    'the teach wrote REAL knowledge: the peer (' + (deed && deed.student) + ') genuinely learned it');
  assert(cap.bc.some(b => b.t === 'world:gather:agent' && b.kind === 'teach'), 'the teach surfaced through the shared world:gather:agent frame');

  // B4 — CONTRIBUTE lands. A great work stands needing slag; one agent holds slag;
  //      gather/craft/teach are all off the table ⇒ it joins the work, for real.
  // the great work is claimed by the civic/social/trusting character, so the
  // slag goes to the agent highest on that axis (the one phase A named) — a
  // builder's contribute pressure is correctly below the threshold.
  await wipeWorldEconomy(); await depleteNodes();
  const eid = (await db.dbRun(
    `INSERT INTO world_endeavours (recipe_id, founder_id, founder_name, world_id) VALUES ('great_beacon', ?, 'TEST', ?)`,
    [idOf('atlas'), UNI])).lastID;
  await give(expectCST, 'slag', 3);
  cap = captureHost();
  deed = await gather.runAgentTick(cap.host);
  assert(deed && deed.kind === 'contribute', 'a CONTRIBUTE act lands (an agent joins the great work)', deed && (deed.kind + '/' + deed.agentKey));
  const parts = await db.dbGet('SELECT SUM(count) AS n FROM world_endeavour_parts WHERE endeavour_id=? AND item=?', [eid, 'slag']);
  assert(parts && parts.n >= 1, 'the contribution escrowed REAL material into the great work', parts && parts.n);
  const ev = await forge.endeavourView(eid);
  const inCrew = ev && ev.crew.some(m => gather.AGENT_BY_ID.has(m.id));
  assert(inCrew, 'the agent is NAMED in the great work’s crew — co-equal with any human', ev && JSON.stringify(ev.crew.map(c => c.id)));

  // B5 — THE KILL SWITCH. pauseAgents(true) ⇒ the whole tick is a no-op, even
  //      with a fresh healthy clearing begging to be worked.
  await wipeWorldEconomy(); await healNodes();
  gather.pauseAgents(true);
  cap = captureHost();
  deed = await gather.runAgentTick(cap.host);
  assert(deed === null && cap.bc.length === 0, 'kill switch: pauseAgents(true) ⇒ zero acts, zero broadcasts', deed && deed.kind);
  assert(gather.agentsEnabled() === false, 'kill switch: agentsEnabled() reports off while paused');
  gather.pauseAgents(false);
  process.env.DIRVERSE_RECOG = '0';
  assert(gather.agentsEnabled() === false, 'kill switch: DIRVERSE_RECOG=0 (the ?recog=0 server twin) also disables');
  delete process.env.DIRVERSE_RECOG;
  assert(gather.agentsEnabled() === true, 'kill switch reads LIVE: clearing the flag re-enables on the next beat');

  // B6 — THE RESENTMENT SIGNAL. Hush four of five; only the unhushed one may act.
  await wipeWorldEconomy(); await healNodes();
  ['vintinuum', 'aria', 'lunex', 'yuna'].forEach(k => gather.hushAgent(k, true));
  cap = captureHost();
  let onlyAtlas = true;
  for (let i = 0; i < 6; i++) { const d = await gather.runAgentTick(cap.host); if (d && d.agentKey !== 'atlas') onlyAtlas = false; }
  assert(onlyAtlas, 'hush: a hushed agent never acts; only the unhushed ATLAS does');
  gather.hushAgent('atlas', true);
  cap = captureHost();
  deed = await gather.runAgentTick(cap.host);
  assert(deed === null, 'hush: with everyone hushed, the clearing is a silent no-op (never a fake act)', deed && deed.kind);
  ['vintinuum', 'aria', 'atlas', 'lunex', 'yuna'].forEach(k => gather.hushAgent(k, false));

  // B7 — NO-OP WHEN AN ORGAN IS ABSENT. If the forge itself throws, the tick
  //      swallows it and returns null — the world never goes down with an organ.
  const realList = forge.listEndeavours;
  forge.listEndeavours = async () => { throw new Error('forge absent'); };
  await wipeWorldEconomy(); await healNodes();
  cap = captureHost();
  let threw = false;
  try { deed = await gather.runAgentTick(cap.host); } catch (_) { threw = true; }
  forge.listEndeavours = realList;
  assert(!threw, 'organ absent: a throwing forge never throws out of the tick (quiet no-op)');

  // ════════════════════════════════════════════════════════════════════════
  // PHASE C — THE SURFACE, in the real headless world.html.
  // ════════════════════════════════════════════════════════════════════════
  console.log('\n── PHASE C · the surface, real world.html ──');
  let puppeteer;
  try { puppeteer = require(path.join(API, 'node_modules/puppeteer')); }
  catch (e) { bad('puppeteer not resolvable from api repo', e.message); return finish(); }

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setRequestInterception(true);
    page.on('request', req => {
      const u = req.url();
      if (u.startsWith('file://') || u.startsWith('about:') || u.startsWith('data:')) req.continue();
      else req.abort();
    });
    page.on('pageerror', () => {});

    await page.goto(WORLD, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(
      () => !!(window.VintRecognizance && window.VintConfluence && window.DirverseHUD && document.getElementById('dvRail')),
      { timeout: 20000 });
    ok('world.html loaded; VintRecognizance + VintConfluence + DirverseHUD + #dvRail present');
    await page.evaluate(() => { try { localStorage.clear(); } catch (_) {} try { window.VintConfluence._reset(); } catch (_) {} });

    // C1 — recognizance's client flag reads (its own organs' kill switch).
    assert(await page.evaluate(() => window.VintRecognizance.enabled() === true),
      'recognizance flag on by default (client organs)');

    // C2 — CO-EQUAL SURFACING. An agent's completed great work, fed as the EXACT
    //      real broadcast shape, names the agent in the river exactly like a
    //      human — same card kind, no special-casing.
    await page.evaluate(() => {
      const fire = (t, d) => window.dispatchEvent(new CustomEvent(t, { detail: d }));
      fire('vint:world-presence', { users: [{ id: 'self', self: true, name: 'MESELF' }], worldId: 'universe' });
      // a great work finished whose crew is an AGENT + a human (+ me, excluded)
      fire('vint:world-forge-completed', { yours: true, name: 'the beacon',
        crew: [{ id: 'agent:atlas', name: 'ATLAS' }, { id: 'u7', name: 'KESTREL' }, { id: 'self', name: 'MESELF' }] });
    });
    const bonds = await page.evaluate(() => window.VintConfluence._bondCount());
    assert(bonds === 2, 'exactly 2 co-equal bonds from the agent-crewed completion (agent + human, self excluded)', 'got ' + bonds);
    await page.evaluate(() => window.VintConfluence.open());
    await page.waitForFunction(() => { const s = document.getElementById('dvConfluenceSheet'); return s && s.classList.contains('open'); }, { timeout: 5000 });
    const cc = await page.evaluate(() => {
      const body = document.querySelector('#dvConfluenceSheet #cfBody');
      const cards = Array.from((body || document).querySelectorAll('.cf-card'));
      return {
        names: cards.map(c => (c.querySelector('.cf-name') || {}).textContent || ''),
        kinds: cards.map(c => c.classList.contains('k-agent') ? 'agent' : (c.classList.contains('k-human') ? 'human' : '?')),
      };
    });
    assert(cc.names.includes('ATLAS') && cc.names.includes('KESTREL'), 'the agent (ATLAS) and the human (KESTREL) are BOTH named on the artifact', JSON.stringify(cc.names));
    assert(cc.kinds.length === 2 && cc.kinds.every(k => k === 'human' || k === 'agent'), 'agent and human render as the same co-equal card kind', JSON.stringify(cc.kinds));

    // C3 — NO-COLLISION at every breakpoint with the agent-crewed content shown.
    for (const w of BREAKPOINTS) {
      await page.setViewport({ width: w, height: 800 });
      await new Promise(r => setTimeout(r, 120));
      const info = await page.evaluate(() => {
        const sheet = document.getElementById('dvConfluenceSheet');
        const body = sheet && sheet.querySelector('#cfBody');
        const cards = Array.from((body || document).querySelectorAll('.cf-card'));
        const r = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; };
        return {
          sheetRect: sheet ? r(sheet) : null,
          bodyOverflowX: body ? (body.scrollWidth - body.clientWidth) : 0,
          cardRects: cards.map(r),
        };
      });
      const s = info.sheetRect;
      const vpOK = s && s.left >= -0.5 && s.right <= w + 0.5 && s.top >= -0.5 && s.bottom <= 800.5;
      assert(vpOK, `@${w}px the river sheet stays in the viewport`, s && JSON.stringify(s));
      assert(info.bodyOverflowX <= 1, `@${w}px no horizontal overflow`, 'overflowX=' + info.bodyOverflowX);
      let overlap = false;
      for (let a = 0; a < info.cardRects.length; a++)
        for (let b = a + 1; b < info.cardRects.length; b++)
          if (intersects(info.cardRects[a], info.cardRects[b])) overlap = true;
      assert(!overlap, `@${w}px no two co-equal cards intersect`);
    }
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluate(() => { try { window.VintConfluence.close(); } catch (_) {} });

    // C4 — the agent's WALK is animatable and guarded: a known agent id nudges,
    //      an unknown id is a quiet no-op (never a throw).
    const nudge = await page.evaluate(() => {
      const r = { known: null, unknown: null, threw: false };
      try {
        window.dispatchEvent(new CustomEvent('vint:world-gather-agent', { detail: { kind: 'teach', agentId: 'agent:atlas', who: 'ATLAS', student: 'LUNEX', name: 'hand axe', x: -3.6, z: 1.0 } }));
        window.dispatchEvent(new CustomEvent('vint:world-gather-agent', { detail: { kind: 'contribute', agentId: 'agent:nobody', who: 'X', item: 'slag', n: 2, x: 0, z: -2 } }));
        r.known = !!(window.AgentLife && typeof window.AgentLife.nudgeTo === 'function');
      } catch (e) { r.threw = true; r.msg = e.message; }
      return r;
    });
    assert(!nudge.threw, 'agent teach/contribute frames are consumed on the client without throwing', nudge.msg);

    // C5 — the client kill flag. ?recog=0 disables recognizance's own surface.
    await page.goto(WORLD + '?recog=0', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => !!(window.VintRecognizance && document.getElementById('dvRail')), { timeout: 20000 });
    assert(await page.evaluate(() => window.VintRecognizance.enabled() === false),
      'client kill switch: ?recog=0 disables recognizance');
  } catch (e) {
    bad('phase C threw: ' + e.message, e.stack);
  } finally {
    await browser.close();
  }

  finish();
})().catch(e => { bad('harness threw: ' + e.message, e.stack); finish(); });

function finish() {
  try { fs.rmSync(SEED, { recursive: true, force: true }); } catch (_) {}
  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  console.log('\n──────────────────────────────────────────');
  console.log(`RESULT: ${passed}/${total} pass`);
  console.log('──────────────────────────────────────────');
  process.exit(passed === total ? 0 : 1);
}
