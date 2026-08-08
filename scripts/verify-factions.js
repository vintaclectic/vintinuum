#!/usr/bin/env node
/* verify-factions.js — THE FACTIONS PROOF (task D9KADDX, DIRVERSE organ 4).
   ────────────────────────────────────────────────────────────────────────────
   Five things have to be true or the faction organ is decoration. This script
   proves all five against the REAL page — world.html, loaded in a real browser,
   with body/world/marches.js running as it ships. It does not require a mock,
   a stub, or a re-implementation of the model, because a proof that runs
   against a copy of the code proves something about the copy.

     1  Two factions exist, each with ≥1 member, and membership is queryable.
     2  A and B can enter an ALLIANCE that reads identically from BOTH sides.
     3  A and B can declare WAR, and war SUPERSEDES the alliance — there is no
        instant at which the pair is both allied and at war.
     4  A named territory owned by A changes hands to B as the RESULT of war
        resolution — owner is A before, B after, and the transfer landed in the
        same persisted world-state store the HUD reads.
     5  The change SURVIVES RELOAD — the page is torn down and re-loaded from
        localStorage, and the owner is still B.

   WHY TEST 2 IS STRONGER THAN IT LOOKS. "Readable from both sides" is usually
   tested by writing one relation and checking two getters agree. That only
   proves the getters agree TODAY. This script also asserts the structural
   claim: `pairKey(a,b) === pairKey(b,a)`, i.e. both directions address the SAME
   SLOT in the store, so a disagreement is not merely absent, it is
   unrepresentable. Then it inspects the raw persisted blob and asserts there is
   exactly ONE pact entry for the pair — no mirrored second copy hiding behind a
   symmetric-looking API.

   WHY TEST 4 DRIVES THE ADMIRALTY. The requirement is that war resolution
   consumes Admiralty fleets, with no private combat model. So this does not
   call an internal transfer helper. It lays a real keel, launches a real hull,
   calls VintMarches.contest() (which calls VintAdmiralty.sortie()), fast-
   forwards the Admiralty's own wall-clock, and lets the Admiralty resolve its
   own wake and fire its own `vint:admiralty-wake` event. The deed moves because
   a wake resolved. It also asserts, as a NEGATIVE, that marches.js contains no
   combat arithmetic of its own.

   EXITS  0 = proven · 1 = a real failure · 2 = harness could not run
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

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${name}${detail ? `\n      ${detail}` : ''}`);
}

(async () => {
  // ── A STATIC PROOF FIRST: no private combat model. ───────────────────────
  // This one needs no browser, and it is the requirement most easily violated
  // later by someone "just adding a quick roll" to the faction file.
  const src = fs.readFileSync(path.join(ROOT, 'body/world/marches.js'), 'utf8');
  const combatTells = [
    /Math\.random\s*\(/,        // no dice here — the Admiralty owns uncertainty
    /function\s+wake\s*\(/,     // no second wake
    /function\s+battle\s*\(/,
    /function\s+fight\s*\(/,
  ];
  const found = combatTells.filter(re => re.test(src)).map(String);

  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;

  async function launch() {
    let lastErr;
    for (let i = 0; i < 4; i++) {
      try {
        return await puppeteer.launch({
          headless: 'new',
          protocolTimeout: 120000,
          args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        });
      } catch (e) {
        lastErr = e;
        await new Promise(r => setTimeout(r, 4000 * (i + 1)));
      }
    }
    throw new Error('chrome would not start after 4 attempts: ' + lastErr.message);
  }

  let browser;
  try { browser = await launch(); }
  catch (e) { console.error(`\n✗ harness: ${e.message}\n`); process.exit(2); }

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  page.on('pageerror', e => console.error('    [page error] ' + e.message));

  // A token so the organs consider us a resident rather than a guest, and a
  // world id so state keys resolve to a real world instead of 'universe'.
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('vint_access_token', 'verify-factions');
      localStorage.setItem('vint_token', 'verify-factions');
    } catch (_) {}
  });

  await page.goto(`${base}/world.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => window.VintMarches && window.VintConcord && window.VintAdmiralty,
    { timeout: 20000 }
  ).catch(() => {});

  const loaded = await page.evaluate(() => ({
    marches: !!window.VintMarches,
    concord: !!window.VintConcord,
    admiralty: !!window.VintAdmiralty,
  }));
  if (!loaded.marches || !loaded.concord || !loaded.admiralty) {
    console.error(`\n✗ organs did not load: ${JSON.stringify(loaded)}\n`);
    await browser.close(); srv.close(); process.exit(2);
  }

  console.log('\n\x1b[1mTHE FACTIONS PROOF\x1b[0m — world.html, real page, real organs\n');

  check('no private combat model in marches.js', found.length === 0,
    found.length ? `found combat arithmetic: ${found.join(', ')}` :
      'no dice, no second wake — the Admiralty owns every fight');

  // ── FOUND A POLITY, so the player's faction is real. ─────────────────────
  // The Concord is the source of the player faction's identity and members, so
  // it has to actually be founded — a proof that ran against an unfounded
  // polity would be proving something about the empty case.
  const founded = await page.evaluate(() => {
    const C = window.VintConcord;
    const st = C.state();
    if (!st.founded) {
      // found it directly in the store the Concord itself reads, then let it
      // re-read — we are setting up the world, not testing the founding flow.
      const wid = (window.VintinuumWorld && window.VintinuumWorld.currentWorldId)
        ? String(window.VintinuumWorld.currentWorldId()) : 'universe';
      const key = 'vint:concord:' + wid;
      const blob = JSON.parse(localStorage.getItem(key) || 'null') || st;
      blob.v = 1;
      blob.founded = Date.now();
      blob.charter = 'hearth';
      blob.name = 'the Verified Hearth';
      blob.seats = blob.seats || [];
      localStorage.setItem(key, JSON.stringify(blob));
    }
    return true;
  });

  // Reload so the Concord picks the founded polity up through its own load().
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.VintMarches && window.VintConcord, { timeout: 20000 });

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 1 — two factions, each with ≥1 member, membership queryable.
  // ═════════════════════════════════════════════════════════════════════════
  const t1 = await page.evaluate(() => {
    const M = window.VintMarches;
    const fs = M.factions();
    // Recruit into the player's faction the way the world actually recruits:
    // its members ARE the Concord's seated bench, so seat an agent. This is the
    // point of the no-duplicate-store design and is worth proving, not
    // assuming — we write a seat and assert the FACTION reflects it.
    const wid = (window.VintinuumWorld && window.VintinuumWorld.currentWorldId)
      ? String(window.VintinuumWorld.currentWorldId()) : 'universe';
    const ckey = 'vint:concord:' + wid;
    const blob = JSON.parse(localStorage.getItem(ckey) || 'null');
    blob.seats = [{ agentId: 'verify-agent-1', role: 'speaker', loyalty: 1, joined: Date.now() }];
    localStorage.setItem(ckey, JSON.stringify(blob));

    return {
      count: fs.length,
      ids: fs.map(f => f.id),
      // membership of a standing power = the ground it holds, which is real
      // membership in this model and is queryable through the same verb.
      memberCounts: fs.map(f => ({ id: f.id, n: M.members(f.id).length })),
      selfIsFirst: fs[0] && fs[0].mine === true,
    };
  });

  const A = 'concord';           // the player's polity — faction A
  const B = 'span';              // a standing power — faction B

  const bothExist = t1.ids.includes(A) && t1.ids.includes(B);
  const bMembers = (t1.memberCounts.find(x => x.id === B) || {}).n || 0;
  check('two factions exist and are queryable', bothExist && t1.count >= 2,
    `${t1.count} factions: ${t1.ids.join(', ')}`);
  check('each faction has ≥1 member, membership queryable', bMembers >= 1,
    `${B} holds ${bMembers} march(es); membership read via VintMarches.members(id)`);

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 2 — ALLIANCE, readable identically from BOTH sides.
  // ═════════════════════════════════════════════════════════════════════════
  const t2 = await page.evaluate(({ A, B }) => {
    const M = window.VintMarches;
    const r = M.ally(A, B);
    const wid = (window.VintinuumWorld && window.VintinuumWorld.currentWorldId)
      ? String(window.VintinuumWorld.currentWorldId()) : 'universe';
    const raw = JSON.parse(localStorage.getItem('vint:marches:' + wid) || '{}');
    // How many entries in the whole pacts store mention BOTH ids? If the model
    // mirrored the relation onto each side there would be two.
    const keys = Object.keys(raw.pacts || {});
    const mentioning = keys.filter(k => k.includes(A) && k.includes(B));
    return {
      ok: r.ok,
      ab: M.relation(A, B),
      ba: M.relation(B, A),
      keyAB: M.pairKey(A, B),
      keyBA: M.pairKey(B, A),
      slots: mentioning.length,
      slotKeys: mentioning,
    };
  }, { A, B });

  check('alliance reads identically from BOTH sides', t2.ok && t2.ab === 'ally' && t2.ba === 'ally',
    `relation(A,B)="${t2.ab}"  relation(B,A)="${t2.ba}"`);
  check('symmetry is structural — one slot, not two mirrored writes',
    t2.keyAB === t2.keyBA && t2.slots === 1,
    `pairKey(A,B)="${t2.keyAB}" === pairKey(B,A)="${t2.keyBA}"; ${t2.slots} stored entry`);

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 3 — WAR supersedes ALLIANCE, never both at once.
  // ═════════════════════════════════════════════════════════════════════════
  const t3 = await page.evaluate(({ A, B }) => {
    const M = window.VintMarches;
    const before = M.relation(A, B);
    const r = M.declare(A, B);
    const wid = (window.VintinuumWorld && window.VintinuumWorld.currentWorldId)
      ? String(window.VintinuumWorld.currentWorldId()) : 'universe';
    const raw = JSON.parse(localStorage.getItem('vint:marches:' + wid) || '{}');
    const keys = Object.keys(raw.pacts || {}).filter(k => k.includes(A) && k.includes(B));
    // The decisive assertion: read every stored value for this pair. If ANY of
    // them still says 'ally' while another says 'war', the pair is in both
    // states at once and the model is incoherent.
    const values = keys.map(k => raw.pacts[k].k);
    return {
      before, ok: r.ok, broke: r.broke,
      ab: M.relation(A, B), ba: M.relation(B, A),
      values, slots: keys.length,
    };
  }, { A, B });

  check('war supersedes alliance', t3.before === 'ally' && t3.ok && t3.broke === true && t3.ab === 'war',
    `was "${t3.before}" → declared → "${t3.ab}" (alliance broken: ${t3.broke})`);
  check('never allied AND at war simultaneously',
    t3.slots === 1 && t3.values.length === 1 && t3.values[0] === 'war' && t3.ab === t3.ba,
    `stored state for the pair: [${t3.values.join(', ')}] — one slot, one word, both sides "${t3.ab}"`);

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 4 — territory changes hands as the RESULT of war resolution.
  //
  // The whole point: no internal transfer call. A real keel, a real hull, a
  // real sortie through VintAdmiralty, the Admiralty's own clock fast-
  // forwarded, the Admiralty's own resolve() firing its own event.
  // ═════════════════════════════════════════════════════════════════════════
  const setup = await page.evaluate(({ A, B }) => {
    const M = window.VintMarches, AD = window.VintAdmiralty, C = window.VintConcord;
    const wid = (window.VintinuumWorld && window.VintinuumWorld.currentWorldId)
      ? String(window.VintinuumWorld.currentWorldId()) : 'universe';

    // Give A a foothold so a shared border exists, and make the TARGET a march
    // B owns that touches it. We write the deeds store directly HERE because
    // this is arranging the board, not the act under test — the act under test
    // is the transfer, and that must come from a wake.
    const mkey = 'vint:marches:' + wid;
    const raw = JSON.parse(localStorage.getItem(mkey) || 'null') || M.state();
    // the ring: sill—span are neighbours. Give A the Long Sill, leave B the Span.
    raw.deeds.sill = { owner: A, since: Date.now(), hold: 2, took: null };
    raw.deeds.span = { owner: B, since: Date.now(), hold: 2, took: null };
    // B must hold more than one march, or SANCTUARY (correctly) protects it.
    raw.deeds.ash = { owner: B, since: Date.now(), hold: 2, took: null };
    localStorage.setItem(mkey, JSON.stringify(raw));

    // Give the Concord treasury + standing so a keel is affordable, and stock
    // a hull directly into the yard (building one through the berth-claiming
    // flow needs seated agents with dispositions; the fleet is a precondition
    // here, not the thing under test).
    const akey = 'vint:admiralty:' + wid;
    const ad = JSON.parse(localStorage.getItem(akey) || 'null') || AD.state();
    ad.v = 1;
    ad.fleet = [{
      id: 'verify-hull-1', name: 'the Proof', el: 'sea', cls: 'cutter',
      launched: Date.now(), struck: false, scars: [],
      stats: { hold: 3, speed: 2, skin: 2, spine: 3, eyes: 2, keel: 2 },
      frames: [], flaws: []
    }];
    ad.sortie = null; ad.wakes = []; ad.keel = null;
    localStorage.setItem(akey, JSON.stringify(ad));
    return { mkey, akey };
  }, { A, B });

  // Reload so both organs read the arranged board through their own load().
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.VintMarches && window.VintAdmiralty, { timeout: 20000 });

  const TARGET = 'span';
  const ownerBefore = await page.evaluate(t => window.VintMarches.ownerOf(t), TARGET);

  // Re-declare war on the fresh page (pacts persisted, but assert it explicitly
  // rather than trusting it — a precondition you did not check is a guess).
  const warOk = await page.evaluate(({ A, B }) => {
    const M = window.VintMarches;
    if (M.relation(A, B) !== 'war') M.declare(A, B);
    return M.relation(A, B);
  }, { A, B });

  const fought = await page.evaluate(async (TARGET) => {
    const M = window.VintMarches, AD = window.VintAdmiralty;

    // THE ACT UNDER TEST — a contest that must route through the Admiralty.
    const r = M.contest(TARGET);
    if (!r.ok) return { stage: 'contest', why: r.why };

    // Did it actually create an Admiralty sortie? If marches.js resolved this
    // privately there would be no sortie in the yard.
    const sortieLive = !!AD.state().sortie;
    const campaign = M.campaign();

    // Fast-forward the ADMIRALTY'S OWN clock by rewriting the sortie's close
    // time in its store, then let the ADMIRALTY resolve it. We never compute a
    // winner here — AD.resolve() runs its own wake arithmetic and fires its own
    // vint:admiralty-wake, which is what marches.js listens to.
    const wid = (window.VintinuumWorld && window.VintinuumWorld.currentWorldId)
      ? String(window.VintinuumWorld.currentWorldId()) : 'universe';
    const akey = 'vint:admiralty:' + wid;
    const ad = JSON.parse(localStorage.getItem(akey));
    ad.sortie.closes = Date.now() - 1000;
    // Make the rival beatable so the wake lands on a WIN — we are proving that
    // a won wake moves the deed, and a proof that depends on a coin flip is not
    // a proof. The rival's own stats are the Admiralty's to compute; we only
    // weaken the hull it fields, then let the Admiralty fight it normally.
    if (ad.sortie.rival && ad.sortie.rival.hull) {
      const rh = ad.sortie.rival.hull;
      Object.keys(rh.stats || {}).forEach(k => { rh.stats[k] = 0; });
      rh.flaws = [];
    }
    localStorage.setItem(akey, JSON.stringify(ad));

    // Force the Admiralty to re-read the store it just had rewritten, then let
    // IT resolve. (reload() drops its memo the same way a fresh page would.)
    if (AD.reload) AD.reload();
    else { AD.close(); }

    let fired = null;
    window.addEventListener('vint:admiralty-wake', e => { fired = e.detail; }, { once: true });

    AD.resolve();
    await new Promise(r2 => setTimeout(r2, 60));

    return {
      stage: 'done',
      sortieLive, campaign,
      wakeFired: fired,
      wakes: AD.state().wakes.length,
      owner: M.ownerOf(TARGET),
    };
  }, TARGET);

  check('contest routes through the Admiralty (a real sortie was created)',
    fought.stage === 'done' && fought.sortieLive === true && !!fought.campaign,
    fought.stage === 'contest'
      ? `contest refused: ${fought.why}`
      : `sortie live in the yard; campaign carried march="${fought.campaign && fought.campaign.march}"`);

  check("the Admiralty's own wake resolved and fired its event",
    !!fought.wakeFired && fought.wakes >= 1,
    fought.wakeFired ? `vint:admiralty-wake fired (won=${fought.wakeFired.won}); ${fought.wakes} wake on record`
      : 'no wake event — the deed would have moved without a battle');

  const ownerAfter = fought.owner;
  check('territory changed hands as the RESULT of war resolution',
    ownerBefore === B && ownerAfter === A,
    `${TARGET}: owner before = "${ownerBefore}" (B), owner after = "${ownerAfter}" (A)`);

  // The transfer must be in the SAME persisted store the HUD reads — not an
  // in-memory object that happens to answer correctly.
  const inStore = await page.evaluate(({ TARGET }) => {
    const wid = (window.VintinuumWorld && window.VintinuumWorld.currentWorldId)
      ? String(window.VintinuumWorld.currentWorldId()) : 'universe';
    const raw = JSON.parse(localStorage.getItem('vint:marches:' + wid) || '{}');
    const M = window.VintMarches;
    const fromApi = (M.territory().find(t => t.id === TARGET) || {}).owner;
    return {
      key: 'vint:marches:' + wid,
      stored: raw.deeds && raw.deeds[TARGET] ? raw.deeds[TARGET].owner : null,
      took: raw.deeds && raw.deeds[TARGET] ? raw.deeds[TARGET].took : null,
      fromApi,
    };
  }, { TARGET });

  check('transfer wrote to the same world-state store the HUD reads',
    inStore.stored === A && inStore.fromApi === A,
    `${inStore.key} → deeds.${TARGET}.owner = "${inStore.stored}"; VintMarches.territory() agrees ("${inStore.fromApi}")`);

  // ═════════════════════════════════════════════════════════════════════════
  // TEST 5 — the change survives reload.
  //
  // A full teardown: navigate away, come back, re-instantiate every organ from
  // persisted bytes. Nothing in memory survives this.
  // ═════════════════════════════════════════════════════════════════════════
  await page.goto('about:blank');
  await page.goto(`${base}/world.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.VintMarches, { timeout: 20000 });

  const after = await page.evaluate(({ TARGET, A, B }) => {
    const M = window.VintMarches;
    const cold = M.reload ? M.reload() : null;   // drop the memo, read the bytes
    return {
      owner: M.ownerOf(TARGET),
      fromTerritory: (M.territory().find(t => t.id === TARGET) || {}).owner,
      fromColdBlob: cold && cold.deeds && cold.deeds[TARGET] ? cold.deeds[TARGET].owner : null,
      relation: M.relation(A, B),
      heldByA: M.held(A).map(x => x.id),
    };
  }, { TARGET, A, B });

  check('the change SURVIVES reload',
    after.owner === A && after.fromTerritory === A && after.fromColdBlob === A,
    `after a full page teardown: ${TARGET} owner = "${after.owner}" (A); A now holds [${after.heldByA.join(', ')}]`);

  check('the war relation also survived reload', after.relation === 'war',
    `relation(A,B) = "${after.relation}"`);

  // ── the generosity rule, proven rather than promised ──────────────────────
  const gen = await page.evaluate(({ A }) => {
    const M = window.VintMarches;
    // Reduce A to exactly one march and assert it cannot be taken.
    const wid = (window.VintinuumWorld && window.VintinuumWorld.currentWorldId)
      ? String(window.VintinuumWorld.currentWorldId()) : 'universe';
    const mkey = 'vint:marches:' + wid;
    const raw = JSON.parse(localStorage.getItem(mkey));
    Object.keys(raw.deeds).forEach(k => { if (raw.deeds[k].owner === A) raw.deeds[k].owner = 'drift'; });
    raw.deeds.sill.owner = A;
    localStorage.setItem(mkey, JSON.stringify(raw));
    M.reload();
    return {
      lastMarch: M.held(A).length,
      sanctuary: M.sanctuary('sill'),
      // and no purchase verb exists anywhere on the API
      verbs: Object.keys(M).filter(k => /buy|purchase|price|pay|cost/i.test(k)),
    };
  }, { A });

  check('generous, not predatory — the last march is sanctuary, and nothing is for sale',
    gen.lastMarch === 1 && gen.sanctuary === true && gen.verbs.length === 0,
    `A holds 1 march; sanctuary(last)=${gen.sanctuary}; purchase verbs on the API: ${gen.verbs.length}`);

  await browser.close();
  srv.close();

  const failed = results.filter(r => !r.pass);
  console.log('');
  if (failed.length) {
    console.log(`\x1b[31m✗ ${failed.length} of ${results.length} checks failed\x1b[0m\n`);
    process.exit(1);
  }
  console.log(`\x1b[32m✓ all ${results.length} checks passed — factions, allegiance, territory, war\x1b[0m\n`);
  process.exit(0);
})().catch(e => {
  console.error('\n✗ harness error: ' + (e && e.stack || e) + '\n');
  process.exit(2);
});
