#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════════
   verify-weave-9TYJB74.js — headless proof for THE WEAVE (task 9TYJB74)

   THE WEAVE is the collective PRESENT: it composes the Confluence's witnessed
   record (VintConfluence.bonds()) with the LIVE presence roster into one living
   constellation — YOU at the heart, every peer you are woven with (person OR agent,
   co-equal) a star, every witnessed thread an edge. This harness loads the REAL
   world.html (real CSS, real neighbour rects) in headless Chromium and asserts,
   with evidence, that body/world/weave.js honours every hard law:

     · WIRED — the module ships, is <script>-loaded in world.html, registers with
       DirverseHUD's one-open registry, and its commons entry is called by commons.js.
     · NO 16th RAIL — weave.js adds no rail launcher (no addLauncher / dv-launch), and
       no #dvRail launcher references it; it opens only through the sheet registry.
     · ZERO FABRICATION — before any presence frame or bond it has ZERO stars; after
       feeding the EXACT verified real signals (presence roster + Confluence bonds) it
       shows EXACTLY those co-equal peers and no others; it re-derives nothing (reads
       bonds() only) and sends NO fabricated backend verb; a thread (edge) is drawn
       ONLY for a peer the record actually witnessed — a present-but-unwoven star has
       NONE; self is the heart, never a peer star.
     · HUMAN/AGENT PARITY — a person and an agent render as the SAME star/legend kind,
       and the rendered copy carries NO owner/owned property language anywhere.
     · NO-COLLISION — at 320/375/768/1280/1920px the sheet stays in the viewport, the
       sky SVG + legend stay inside the body, no two star circles overlap (true circle
       distance test), and no two legend rows intersect — in empty, one-star, four-star
       AND many-star (cap + overflow) states.
     · ONE-OPEN REGISTRY — opening the commons evicts the weave.
     · KILL SWITCH — ?weave=0 disables the surface and the commons entry.

   Network is intercepted: only local file:// loads; everything else is aborted, so
   the run is hermetic and never touches prod. Puppeteer is resolved from the sibling
   api repo (the only copy installed on this machine).
   ──────────────────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer'); }
catch (e) { console.error('FATAL: puppeteer not resolvable from api repo:', e.message); process.exit(2); }

const ROOT = path.resolve(__dirname, '..');
const WORLD = 'file://' + path.join(ROOT, 'world.html');
const BREAKPOINTS = [320, 375, 768, 1280, 1920];

const results = [];
function ok(label) { results.push({ pass: true, label }); console.log('  PASS  ' + label); }
function bad(label, extra) { results.push({ pass: false, label }); console.log('  FAIL  ' + label + (extra ? '  → ' + extra : '')); }
function assert(cond, label, extra) { cond ? ok(label) : bad(label, extra); }

// rectangle intersection (for flow rows + boxes)
function intersects(a, b) {
  return !(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 ||
           a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5);
}
// TRUE circle overlap — the correct primitive for round star nodes. Two circles
// overlap only when centre distance < sum of radii. (A rect test would raise false
// positives on diagonally-separated circles.)
function circlesOverlap(a, b) {
  const dx = a.cx - b.cx, dy = a.cy - b.cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < (a.r + b.r) - 0.75;
}

async function waitReady(page) {
  await page.waitForFunction(
    () => !!(window.VintWeave && window.VintConfluence && window.DirverseHUD && document.getElementById('dvRail')),
    { timeout: 20000 }
  );
}

// Feed the EXACT verified real signals. Produces four co-equal stars:
//   MERIDIAN — human, present + 1 trade thread           → woven star, present, HAS edge
//   KESTREL  — human, present, no shared act             → unwoven star, present, NO edge
//   LUNEX    — agent, 2 ventures woven (from the record) → woven star, absent, HAS edge
//   ATLAS-3  — human, 1 teach thread, NOT present        → woven star, absent, HAS edge
// → 4 stars, 3 threads (edges). Self (MESELF) is the heart, never a peer star.
async function feedRealSignals(page) {
  await page.evaluate(() => {
    const fire = (t, d) => window.dispatchEvent(new CustomEvent(t, { detail: d }));
    // 1) restore a genuinely-witnessed AGENT bond exactly as a reload would (agent
    //    bonds are only ever minted from the real ventures ledger, which is network
    //    and unreachable in this hermetic run — so this restores a real bond, never
    //    invents one), then force the Confluence to reload it via a world switch.
    const key = 'agent\u0000lunex';
    localStorage.setItem('vint:confluence:universe', JSON.stringify({
      v: 1, bonds: { [key]: { name: 'LUNEX', kind: 'agent', traded: 0, ventured: 2, ventureNet: 5,
        taught: [], learned: [], raised: [], count: 2, first: Date.now(), last: Date.now() } },
      seenVentures: { seed: 1 }, primedVentures: true
    }));
    fire('vint:world-state', { worldId: '__seed__' });    // switch away
    fire('vint:world-state', { worldId: 'universe' });     // switch back → reload seeded record

    // 2) learn my own name from a real presence self row
    fire('vint:world-presence', { users: [{ id: 'self', self: true, name: 'MESELF' }], worldId: 'universe' });
    // 3) a trade cleared with a person (partner named from the server's names map)
    fire('vint:world-trade', { trade: { id: 1, aUser: '1', bUser: '2' }, names: { '2': 'MERIDIAN' } });
    fire('vint:world-trade-settled', { tradeId: 1 });
    // 4) a person I taught a recipe, who is NOT standing here now
    fire('vint:world-forge-taught', { student: 'ATLAS-3', name: 'lantern', recipeId: 'r1' });
    // 5) the LIVE roster: me + MERIDIAN (present+woven) + KESTREL (present, new)
    fire('vint:world-presence', { users: [
      { id: 'self', self: true, name: 'MESELF' },
      { id: 'pM', self: false, name: 'MERIDIAN' },
      { id: 'pK', self: false, name: 'KESTREL' }
    ], worldId: 'universe' });
  });
}

async function skyInfo(page) {
  return await page.evaluate(() => {
    const sheet = document.getElementById('dvWeaveSheet');
    const body = sheet && sheet.querySelector('#wvBody');
    const sky = body && body.querySelector('.wv-sky');
    const nodes = Array.from((body || document).querySelectorAll('.wv-node'));
    const self = body && body.querySelector('.wv-self');
    const edges = Array.from((body || document).querySelectorAll('.wv-edge'));
    const legs = Array.from((body || document).querySelectorAll('.wv-legrow'));
    const rct = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
    const circ = el => { const b = el.getBoundingClientRect(); return { cx: b.left + b.width / 2, cy: b.top + b.height / 2, r: b.width / 2 }; };
    const allC = nodes.slice();
    if (self) allC.push(self);
    return {
      open: !!(sheet && sheet.classList.contains('open')),
      sheetRect: sheet ? rct(sheet) : null,
      bodyRect: body ? rct(body) : null,
      bodyOverflowX: body ? (body.scrollWidth - body.clientWidth) : 0,
      skyRect: sky ? rct(sky) : null,
      hasEmpty: !!(body && body.querySelector('.wv-empty')),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      legCount: legs.length,
      legNames: legs.map(l => (l.querySelector('.wv-legname') || {}).textContent || ''),
      legKinds: legs.map(l => l.classList.contains('k-agent') ? 'agent' : (l.classList.contains('k-human') ? 'human' : '?')),
      bodyText: body ? body.textContent : '',
      circles: allC.map(circ),
      legRects: legs.map(rct),
    };
  });
}

(async () => {
  console.log('THE WEAVE — verify 9TYJB74');
  console.log('world: ' + WORLD + '\n');

  // ── STATIC WIRING (filesystem, no browser needed) ───────────────────────────
  const srcWeave = fs.readFileSync(path.join(ROOT, 'body/world/weave.js'), 'utf8');
  const srcHtml = fs.readFileSync(path.join(ROOT, 'world.html'), 'utf8');
  const srcCommons = fs.readFileSync(path.join(ROOT, 'body/world/commons.js'), 'utf8');
  const srcClient = fs.readFileSync(path.join(ROOT, 'body/world/world-client.js'), 'utf8');
  const srcDvhud = fs.readFileSync(path.join(ROOT, 'body/world/dirverse-hud.js'), 'utf8');

  assert(/<script[^>]+body\/world\/weave\.js/.test(srcHtml), 'weave.js is <script>-loaded in world.html');
  assert(/registerSheet\(\s*['"]weave['"]/.test(srcWeave), '.dv-sheet one-open registry wiring present (registerSheet("weave"))');
  assert(/VintWeave\s*&&\s*W\.VintWeave\.entryInto|VintWeave\.entryInto/.test(srcCommons), 'commons.js calls VintWeave.entryInto (entry lives in the commons, not a rail)');
  assert(!/addLauncher/.test(srcWeave) && !/dv-launch/.test(srcWeave), 'NO 16th rail: weave.js adds no rail launcher (no addLauncher / dv-launch)');
  // COMPOSITION ONLY — reads the one witnessed source, never re-derives, sends no verb.
  assert(/VintConfluence[\s\S]{0,40}\.bonds\(\)|confluence\(\)\.bonds/.test(srcWeave), 'weave.js composes from VintConfluence.bonds() (single source of witnessed truth)');
  const verbSends = srcWeave.match(/['"]world:[a-z][a-z:]*['"]/g) || [];
  assert(verbSends.length === 0, 'no fabricated backend verb: weave.js sends zero world: verbs (pure composition)', JSON.stringify(verbSends));
  // the real re-entry affordances it CAN call must exist in the real source.
  assert(/World\.facePresence\s*=/.test(srcClient), 'real affordance World.facePresence exists in world-client.js');
  assert(/openAgents\s*:/.test(srcDvhud), 'real affordance DirverseHUD.openAgents exists in dirverse-hud.js');
  // load order: weave.js must come AFTER confluence.js and commons.js in world.html
  const idxWeave = srcHtml.indexOf('body/world/weave.js');
  const idxConf = srcHtml.indexOf('body/world/confluence.js');
  const idxCommons = srcHtml.indexOf('body/world/commons.js');
  assert(idxWeave > idxConf && idxWeave > idxCommons, 'weave.js loads AFTER confluence.js and commons.js');

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setRequestInterception(true);
    page.on('request', req => {
      const u = req.url();
      if (u.startsWith('file://') || u.startsWith('about:') || u.startsWith('data:')) req.continue();
      else req.abort();               // hermetic: no CDN, no prod, no WS
    });
    page.on('pageerror', () => {});   // guarded page code logs; never fatal to the harness

    await page.goto(WORLD, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitReady(page);
    ok('world.html loaded; DirverseHUD + VintWeave + VintConfluence + #dvRail present');

    await page.evaluate(() => { try { localStorage.clear(); } catch (_) {} });

    // ── TEST 1 — flag on by default ─────────────────────────────────────────
    assert(await page.evaluate(() => window.VintWeave.enabled() === true),
      'flag on by default (enabled() === true)');

    // ── TEST 2 — NO new rail launcher references the weave in the DOM ────────
    const railHasWeave = await page.evaluate(() => {
      const rail = document.getElementById('dvRail');
      if (!rail) return false;
      return Array.from(rail.querySelectorAll('.dv-launch')).some(b => /weave/i.test(b.textContent || ''));
    });
    assert(!railHasWeave, 'NO 16th rail: no #dvRail launcher references the weave');

    // ── TEST 3 — ZERO FABRICATION: empty before any signal ──────────────────
    await page.evaluate(() => window.VintWeave.open());
    await page.waitForFunction(() => { const s = document.getElementById('dvWeaveSheet'); return s && s.classList.contains('open'); }, { timeout: 5000 });
    let info = await skyInfo(page);
    assert(info.open, 'opens via registry (VintWeave.open)');
    assert(info.nodeCount === 0, 'ZERO stars before any presence frame or bond (no fabrication)', 'got ' + info.nodeCount);
    assert(info.edgeCount === 0, 'ZERO threads before any bond (no fabricated edge)', 'got ' + info.edgeCount);
    assert(info.hasEmpty, 'honest empty-state invitation shown when the sky is bare');
    await page.evaluate(() => window.VintWeave.close());
    assert(await page.evaluate(() => !window.VintWeave.isOpen()), 'closes (VintWeave.close)');

    // ── TEST 4 — composes EXACTLY the real signals into co-equal stars ───────
    await feedRealSignals(page);
    const g = await page.evaluate(() => window.VintWeave._graph());
    assert(g.nodes.length === 4, 'exactly 4 co-equal stars from the real roster + record', 'got ' + g.nodes.length);
    assert(g.woven === 3, 'exactly 3 woven threads (MERIDIAN, LUNEX, ATLAS-3); KESTREL has none', 'woven=' + g.woven);
    const gnames = g.nodes.map(n => n.name);
    assert(['MERIDIAN', 'KESTREL', 'LUNEX', 'ATLAS-3'].every(n => gnames.includes(n)), 'all four real peers present', JSON.stringify(gnames));
    assert(!gnames.includes('MESELF'), 'self is the heart, never a peer star');
    assert(g.self === 'MESELF', 'self name learned from the real presence self row', g.self);

    await page.evaluate(() => window.VintWeave.open());
    await page.waitForFunction(() => { const s = document.getElementById('dvWeaveSheet'); return s && s.classList.contains('open'); }, { timeout: 5000 });
    await new Promise(r => setTimeout(r, 200));
    info = await skyInfo(page);
    assert(info.nodeCount === 4, 'exactly 4 star circles rendered in the sky', 'got ' + info.nodeCount);
    assert(info.edgeCount === 3, 'exactly 3 thread edges rendered — unwoven star has NO edge', 'got ' + info.edgeCount);
    assert(info.legCount === 4, 'exactly 4 legend rows (the readable layer)', 'got ' + info.legCount);
    assert(['MERIDIAN', 'KESTREL', 'LUNEX', 'ATLAS-3'].every(n => info.legNames.includes(n)), 'legend names match the real peers', JSON.stringify(info.legNames));
    assert(!info.legNames.includes('MESELF'), 'self never appears as a legend peer');

    // ── TEST 5 — HUMAN/AGENT PARITY ─────────────────────────────────────────
    assert(info.legKinds.every(k => k === 'human' || k === 'agent'), 'every legend row is one co-equal kind (human|agent)', JSON.stringify(info.legKinds));
    assert(info.legKinds.includes('human') && info.legKinds.includes('agent'), 'both a person and an agent render — as the same row shape');
    assert(!/owner|owned|belongs to|your agent|my agent/i.test(info.bodyText),
      'NO owner/owned property language anywhere in the rendered surface');

    // ── TEST 6 — NO-COLLISION at every breakpoint (four-star state) ──────────
    for (const w of BREAKPOINTS) {
      await page.setViewport({ width: w, height: 800 });
      await new Promise(r => setTimeout(r, 450));   // settle past the .dv-sheet open transition
      const i = await skyInfo(page);
      const vpOK = i.sheetRect && i.sheetRect.left >= -0.5 && i.sheetRect.right <= w + 0.5 &&
        i.sheetRect.top >= -0.5 && i.sheetRect.bottom <= 800 + 0.5;
      assert(vpOK, `@${w}px sheet stays inside the viewport`, i.sheetRect && JSON.stringify(i.sheetRect));
      assert(i.bodyOverflowX <= 1, `@${w}px body has no horizontal overflow`, 'overflowX=' + i.bodyOverflowX);
      const br = i.bodyRect;
      const skyInB = br && i.skyRect ? (i.skyRect.left >= br.left - 1 && i.skyRect.right <= br.right + 1) : false;
      assert(skyInB, `@${w}px the sky stays within the body box`);
      const legsInB = br ? i.legRects.every(c => c.left >= br.left - 1 && c.right <= br.right + 1) : false;
      assert(legsInB, `@${w}px every legend row stays within the body box`);
      let starOverlap = false;
      for (let a = 0; a < i.circles.length; a++)
        for (let b = a + 1; b < i.circles.length; b++)
          if (circlesOverlap(i.circles[a], i.circles[b])) starOverlap = true;
      assert(!starOverlap, `@${w}px no two stars overlap (true circle distance)`);
      let legOverlap = false;
      for (let a = 0; a < i.legRects.length; a++)
        for (let b = a + 1; b < i.legRects.length; b++)
          if (intersects(i.legRects[a], i.legRects[b])) legOverlap = true;
      assert(!legOverlap, `@${w}px no two legend rows intersect`);
    }
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluate(() => window.VintWeave.close());

    // ── TEST 7 — MANY-STAR collision: cap + overflow stay collision-free ─────
    await page.evaluate(() => {
      const bonds = {};
      for (let i = 0; i < 55; i++) {
        bonds['agent\u0000peer' + i] = { name: 'PEER-' + i, kind: (i % 2 ? 'agent' : 'human'),
          traded: 0, ventured: 1, ventureNet: 0, taught: [], learned: [], raised: [],
          count: 1 + (i % 7), first: Date.now(), last: Date.now() };
      }
      localStorage.setItem('vint:confluence:universe', JSON.stringify({ v: 1, bonds, seenVentures: { s: 1 }, primedVentures: true }));
      window.dispatchEvent(new CustomEvent('vint:world-state', { detail: { worldId: '__seed2__' } }));
      window.dispatchEvent(new CustomEvent('vint:world-state', { detail: { worldId: 'universe' } }));
      // clear the live roster to self-only so this state is exactly the 55 seeded
      // bonds (no leftover present peers merging in from a prior test's frame).
      window.dispatchEvent(new CustomEvent('vint:world-presence', { detail: { users: [{ id: 'self', self: true, name: 'MESELF' }], worldId: 'universe' } }));
      window.VintWeave.open();
    });
    await page.waitForFunction(() => { const s = document.getElementById('dvWeaveSheet'); return s && s.classList.contains('open'); }, { timeout: 5000 });
    await new Promise(r => setTimeout(r, 250));
    const many = await skyInfo(page);
    assert(many.nodeCount > 0 && many.nodeCount <= 40, 'many-star: sky caps visible stars (<=40), never piles them', 'nodes=' + many.nodeCount);
    assert(many.legCount === 55, 'many-star: every peer still gets a readable legend row (full fabric legible)', 'legs=' + many.legCount);
    for (const w of [320, 768, 1920]) {
      await page.setViewport({ width: w, height: 800 });
      await new Promise(r => setTimeout(r, 300));
      const i = await skyInfo(page);
      let starOverlap = false;
      for (let a = 0; a < i.circles.length; a++)
        for (let b = a + 1; b < i.circles.length; b++)
          if (circlesOverlap(i.circles[a], i.circles[b])) starOverlap = true;
      assert(!starOverlap, `@${w}px many-star: no two stars overlap`);
      assert(i.bodyOverflowX <= 1, `@${w}px many-star: no horizontal overflow`, 'overflowX=' + i.bodyOverflowX);
    }
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluate(() => { try { window.VintWeave.close(); localStorage.clear(); } catch (_) {} });

    // ── TEST 8 — the commons entry is collision-free flow content ────────────
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('vint:world-presence', { detail: { users: [
        { id: 'self', self: true, name: 'MESELF' }, { id: 'pK', self: false, name: 'KESTREL' }
      ], worldId: 'universe' } }));
      window.VintCommons.open();
    });
    await page.waitForFunction(() => { const s = document.getElementById('dvCommonsSheet'); return s && s.classList.contains('open'); }, { timeout: 5000 });
    const entry = await page.evaluate(() => {
      const row = document.querySelector('#dvCommonsSheet .wv-entry');
      if (!row) return { present: false };
      const body = document.querySelector('#dvCommonsSheet .dv-body');
      const cf = document.querySelector('#dvCommonsSheet .cf-entry');
      const cv = document.querySelector('#dvCommonsSheet .cv-entry');
      const roster = document.querySelector('#dvCommonsSheet .cm-row');
      const r = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, height: b.height }; };
      const ix = (a, b) => a && b && !(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5);
      const R = r(row), CF = cf ? r(cf) : null, CV = cv ? r(cv) : null, RO = roster ? r(roster) : null, BO = body ? r(body) : null;
      return { present: true, rect: R, body: BO,
        hitsCf: ix(R, CF), hitsCv: ix(R, CV), hitsRoster: ix(R, RO) };
    });
    assert(entry.present, 'weave entry appears inside the commons body');
    if (entry.present) {
      assert(entry.rect.height >= 44, 'entry meets the 44px touch floor', 'h=' + entry.rect.height);
      assert(!entry.body || (entry.rect.left >= entry.body.left - 1 && entry.rect.right <= entry.body.right + 1),
        'entry stays within the commons body box');
      assert(!entry.hitsCf, 'weave entry never overlaps the confluence entry (stacked flow)');
      assert(!entry.hitsCv, 'weave entry never overlaps the convergence entry (stacked flow)');
      assert(!entry.hitsRoster, 'weave entry never overlaps the roster row');
    }
    await page.evaluate(() => { try { window.VintCommons.close(); } catch (_) {} });

    // ── TEST 9 — one-open registry: opening commons evicts the weave ─────────
    await page.evaluate(() => window.VintWeave.open());
    await page.waitForFunction(() => window.VintWeave.isOpen(), { timeout: 5000 });
    await page.evaluate(() => window.VintCommons.open());
    await new Promise(r => setTimeout(r, 150));
    const evict = await page.evaluate(() => ({
      weaveOpen: window.VintWeave.isOpen(),
      commonsOpen: (() => { const s = document.getElementById('dvCommonsSheet'); return !!(s && s.classList.contains('open')); })(),
    }));
    assert(!evict.weaveOpen && evict.commonsOpen,
      'one-open registry: opening the commons closed the weave', JSON.stringify(evict));
    await page.evaluate(() => { try { window.VintCommons.close(); } catch (_) {} });

    // ── TEST 10 — KILL SWITCH ────────────────────────────────────────────────
    await page.goto(WORLD + '?weave=0', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitReady(page);
    assert(await page.evaluate(() => window.VintWeave.enabled() === false),
      'kill switch: ?weave=0 disables the surface');
    const killed = await page.evaluate(() => {
      window.VintWeave.open();
      const s = document.getElementById('dvWeaveSheet');
      const open = !!(s && s.classList.contains('open'));
      window.VintCommons.open();
      const entry = !!document.querySelector('#dvCommonsSheet .wv-entry');
      try { window.VintCommons.close(); } catch (_) {}
      return { open, entry };
    });
    assert(!killed.open, 'kill switch: open() raises nothing when disabled');
    assert(!killed.entry, 'kill switch: no commons entry when disabled');

  } catch (e) {
    bad('harness threw: ' + e.message, e.stack);
  } finally {
    await browser.close();
  }

  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  console.log('\n──────────────────────────────────────────');
  console.log(`RESULT: ${passed}/${total} pass`);
  console.log('──────────────────────────────────────────');
  process.exit(passed === total ? 0 : 1);
})();
