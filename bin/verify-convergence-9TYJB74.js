#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════════
   verify-convergence-9TYJB74.js — headless proof for THE CONVERGENCE (task 9TYJB74)

   THE CONVERGENCE is the forward tense of THE CONFLUENCE: it reads the LIVE
   presence roster + the Confluence's witnessed record and offers the ONE real
   next act toward becoming more one with each co-equal peer here now. This harness
   loads the REAL world.html (real CSS, real neighbour rects) in headless Chromium
   and asserts, with evidence, that body/world/convergence.js honours every law:

     · WIRED — the module ships, is <script>-loaded in world.html, registers with
       DirverseHUD's one-open registry, and its commons entry is called by commons.js.
     · NO 16th RAIL — convergence.js adds no rail launcher (no addLauncher / dv-launch),
       and no #dvRail launcher references it; it opens only through the sheet registry.
     · ZERO FABRICATION — before any presence frame or bond it has ZERO cards; after
       feeding the EXACT verified real signals (presence roster + Confluence bonds) it
       shows EXACTLY those co-equal peers and no others; it calls only real client
       affordances (World.facePresence / DirverseHUD.openAgents) that exist in source.
     · HUMAN/AGENT PARITY — a person and an agent render as the SAME card kind, and the
       rendered copy carries NO owner/owned property language anywhere.
     · RANKING — a present+woven person outranks a present stranger outranks a ventured
       agent outranks a woven-but-absent peer; the absent peer gets NO dead button.
     · NO-COLLISION — at 320/375/768/1280/1920px the sheet stays in the viewport, its
       body never overflows horizontally, and no two cards (nor the commons entries)
       ever intersect.
     · ONE-OPEN REGISTRY — opening the commons evicts the convergence.
     · KILL SWITCH — ?convergence=0 disables the surface and the commons entry.

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

function intersects(a, b) {
  return !(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 ||
           a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5);
}

async function waitReady(page) {
  await page.waitForFunction(
    () => !!(window.VintConvergence && window.VintConfluence && window.DirverseHUD && document.getElementById('dvRail')),
    { timeout: 20000 }
  );
}

// Feed the EXACT verified real signals. Produces four co-equal candidates:
//   MERIDIAN  — human, present + 1 trade thread           → tier 0 (weave another)
//   KESTREL   — human, present, no shared act             → tier 1 (first thread)
//   LUNEX     — agent, 2 ventures woven (from the record) → tier 2 (venture again)
//   ATLAS-3   — human, 1 teach thread, NOT present        → tier 3 (waits, no button)
async function feedRealSignals(page) {
  await page.evaluate(() => {
    const fire = (t, d) => window.dispatchEvent(new CustomEvent(t, { detail: d }));
    // 1) seed an AGENT bond into the Confluence record exactly as a reload would
    //    restore it from a prior session, then force the Confluence to reload it by
    //    switching worlds away and back (its only reload path). Agent bonds are only
    //    ever minted from the real ventures ledger, which is network — unreachable in
    //    this hermetic run — so this restores a genuinely-witnessed bond, never invents one.
    const key = 'agent\u0000lunex';
    localStorage.setItem('vint:confluence:universe', JSON.stringify({
      v: 1, bonds: { [key]: { name: 'LUNEX', kind: 'agent', traded: 0, ventured: 2, ventureNet: 5,
        taught: [], learned: [], raised: [], count: 2, first: Date.now(), last: Date.now() } },
      seenVentures: { seed: 1 }, primedVentures: true
    }));
    fire('vint:world-state', { worldId: '__seed__' });   // switch away
    fire('vint:world-state', { worldId: 'universe' });    // switch back → reload seeded record

    // 2) learn my own name from a real presence self row (so trade self-naming works)
    fire('vint:world-presence', { users: [{ id: 'self', self: true, name: 'MESELF' }], worldId: 'universe' });
    // 3) a trade cleared with a person (partner named from the server's names map)
    fire('vint:world-trade', { trade: { id: 1, aUser: '1', bUser: '2' }, names: { '2': 'MERIDIAN' } });
    fire('vint:world-trade-settled', { tradeId: 1 });
    // 4) a person I taught a recipe, who is NOT standing here now
    fire('vint:world-forge-taught', { student: 'ATLAS-3', name: 'lantern', recipeId: 'r1' });
    // 5) the LIVE roster: me (self) + MERIDIAN (present+woven) + KESTREL (present, new)
    fire('vint:world-presence', { users: [
      { id: 'self', self: true, name: 'MESELF' },
      { id: 'pM', self: false, name: 'MERIDIAN' },
      { id: 'pK', self: false, name: 'KESTREL' }
    ], worldId: 'universe' });
  });
}

async function cardInfo(page) {
  return await page.evaluate(() => {
    const sheet = document.getElementById('dvConvergenceSheet');
    const body = sheet && sheet.querySelector('#cvBody');
    const cards = Array.from((body || document).querySelectorAll('.cv-card'));
    const r = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
    return {
      open: !!(sheet && sheet.classList.contains('open')),
      sheetRect: sheet ? r(sheet) : null,
      bodyRect: body ? r(body) : null,
      bodyOverflowX: body ? (body.scrollWidth - body.clientWidth) : 0,
      hasEmpty: !!(body && body.querySelector('.cv-empty')),
      count: cards.length,
      names: cards.map(c => (c.querySelector('.cv-name') || {}).textContent || ''),
      kinds: cards.map(c => c.classList.contains('k-agent') ? 'agent' : (c.classList.contains('k-human') ? 'human' : '?')),
      acts: cards.map(c => (c.querySelector('.cv-act') || {}).textContent || ''),
      waits: cards.map(c => !!c.querySelector('.cv-wait')),
      bodyText: body ? body.textContent : '',
      cardRects: cards.map(r),
    };
  });
}

(async () => {
  console.log('THE CONVERGENCE — verify 9TYJB74');
  console.log('world: ' + WORLD + '\n');

  // ── STATIC WIRING (filesystem, no browser needed) ───────────────────────────
  const srcConv = fs.readFileSync(path.join(ROOT, 'body/world/convergence.js'), 'utf8');
  const srcHtml = fs.readFileSync(path.join(ROOT, 'world.html'), 'utf8');
  const srcCommons = fs.readFileSync(path.join(ROOT, 'body/world/commons.js'), 'utf8');
  const srcClient = fs.readFileSync(path.join(ROOT, 'body/world/world-client.js'), 'utf8');
  const srcDvhud = fs.readFileSync(path.join(ROOT, 'body/world/dirverse-hud.js'), 'utf8');

  assert(/<script[^>]+body\/world\/convergence\.js/.test(srcHtml), 'convergence.js is <script>-loaded in world.html');
  assert(/registerSheet\(\s*['"]convergence['"]/.test(srcConv), '.dv-sheet one-open registry wiring present (registerSheet("convergence"))');
  assert(/VintConvergence\s*&&\s*W\.VintConvergence\.entryInto|VintConvergence\.entryInto/.test(srcCommons), 'commons.js calls VintConvergence.entryInto (entry lives in the commons, not a rail)');
  assert(!/addLauncher/.test(srcConv) && !/dv-launch/.test(srcConv), 'NO 16th rail: convergence.js adds no rail launcher (no addLauncher / dv-launch)');

  // NO FABRICATED BACKEND VERB: convergence.js composes — it must SEND no world: verb.
  // (Its only world- tokens are 'vint:world-*' CLIENT events, never backend 'world:' verbs.)
  const verbSends = srcConv.match(/['"]world:[a-z][a-z:]*['"]/g) || [];
  assert(verbSends.length === 0, 'no fabricated backend verb: convergence.js sends zero world: verbs (pure composition)', JSON.stringify(verbSends));
  // the real client affordances it DOES call must exist in the real source.
  assert(/World\.facePresence\s*=/.test(srcClient), 'real affordance World.facePresence exists in world-client.js');
  assert(/openAgents\s*:/.test(srcDvhud), 'real affordance DirverseHUD.openAgents exists in dirverse-hud.js');

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
    ok('world.html loaded; DirverseHUD + VintConvergence + VintConfluence + #dvRail present');

    await page.evaluate(() => { try { localStorage.clear(); } catch (_) {} });

    // ── TEST 1 — flag on by default ─────────────────────────────────────────
    assert(await page.evaluate(() => window.VintConvergence.enabled() === true),
      'flag on by default (enabled() === true)');

    // ── TEST 2 — NO new rail launcher references the convergence in the DOM ──
    const railHasConv = await page.evaluate(() => {
      const rail = document.getElementById('dvRail');
      if (!rail) return false;
      return Array.from(rail.querySelectorAll('.dv-launch'))
        .some(b => /convergence/i.test(b.textContent || ''));
    });
    assert(!railHasConv, 'NO 16th rail: no #dvRail launcher references the convergence');

    // ── TEST 3 — ZERO FABRICATION: empty before any signal ──────────────────
    await page.evaluate(() => window.VintConvergence.open());
    await page.waitForFunction(() => { const s = document.getElementById('dvConvergenceSheet'); return s && s.classList.contains('open'); }, { timeout: 5000 });
    let info = await cardInfo(page);
    assert(info.open, 'opens via registry (VintConvergence.open)');
    assert(info.count === 0, 'ZERO cards before any presence frame or bond (no fabrication)', 'got ' + info.count);
    assert(info.hasEmpty, 'honest empty-state invitation shown when there is no next step');
    await page.evaluate(() => window.VintConvergence.close());
    assert(await page.evaluate(() => !window.VintConvergence.isOpen()), 'closes (VintConvergence.close)');

    // ── TEST 4 — composes EXACTLY the real signals into co-equal candidates ──
    await feedRealSignals(page);
    const cc = await page.evaluate(() => window.VintConvergence._candidateCount());
    assert(cc === 4, 'exactly 4 co-equal candidates from the real roster + record', 'got ' + cc);
    await page.evaluate(() => window.VintConvergence.open());
    await page.waitForFunction(() => { const s = document.getElementById('dvConvergenceSheet'); return s && s.classList.contains('open'); }, { timeout: 5000 });
    info = await cardInfo(page);
    assert(info.count === 4, 'exactly 4 cards rendered', 'got ' + info.count);
    const want = ['MERIDIAN', 'KESTREL', 'LUNEX', 'ATLAS-3'];
    assert(want.every(n => info.names.includes(n)), 'all four real peers present', JSON.stringify(info.names));
    assert(!info.names.includes('MESELF'), 'self never appears as a peer to converge with');

    // ── TEST 5 — HUMAN/AGENT PARITY ─────────────────────────────────────────
    assert(info.kinds.every(k => k === 'human' || k === 'agent'), 'every card is one co-equal kind (human|agent)', JSON.stringify(info.kinds));
    assert(info.kinds.includes('human') && info.kinds.includes('agent'), 'both a person and an agent render — as the same card shape');
    assert(!/owner|owned|belongs to|your agent|my agent/i.test(info.bodyText),
      'NO owner/owned property language anywhere in the rendered surface');

    // ── TEST 6 — RANKING + the absent peer has NO dead button ────────────────
    assert(info.names[0] === 'MERIDIAN', 'ranking: present + woven person ranks first', JSON.stringify(info.names));
    const iLunex = info.names.indexOf('LUNEX'), iAtlas = info.names.indexOf('ATLAS-3');
    assert(iLunex < iAtlas, 'ranking: a ventured agent outranks a woven-but-absent person');
    assert(info.acts[iLunex] === 'send them to venture beside you', 'agent CTA is the real venture affordance (co-equal, "beside you")', info.acts[iLunex]);
    assert(info.waits[iAtlas] === true && info.acts[iAtlas] === '', 'woven-but-absent peer shows the honest waiting line, never a dead button');
    const iKestrel = info.names.indexOf('KESTREL');
    assert(/here/i.test(info.acts[iKestrel]), 'present stranger gets a real "reach out" act', info.acts[iKestrel]);

    // ── TEST 7 — NO-COLLISION at every breakpoint ───────────────────────────
    for (const w of BREAKPOINTS) {
      await page.setViewport({ width: w, height: 800 });
      // settle PAST the .dv-sheet open transition (.38s) before measuring, so the
      // assertion is of the settled layout, not a mid-animation frame.
      await new Promise(r => setTimeout(r, 450));
      const i = await cardInfo(page);
      const vpOK = i.sheetRect && i.sheetRect.left >= -0.5 && i.sheetRect.right <= w + 0.5 &&
        i.sheetRect.top >= -0.5 && i.sheetRect.bottom <= 800 + 0.5;
      assert(vpOK, `@${w}px sheet stays inside the viewport`, i.sheetRect && JSON.stringify(i.sheetRect));
      assert(i.bodyOverflowX <= 1, `@${w}px body has no horizontal overflow`, 'overflowX=' + i.bodyOverflowX);
      const br = i.bodyRect;
      const inBody = br ? i.cardRects.every(c => c.left >= br.left - 1 && c.right <= br.right + 1) : false;
      assert(inBody, `@${w}px every card stays within the body box`);
      let overlap = false;
      for (let a = 0; a < i.cardRects.length; a++)
        for (let b = a + 1; b < i.cardRects.length; b++)
          if (intersects(i.cardRects[a], i.cardRects[b])) overlap = true;
      assert(!overlap, `@${w}px no two cards intersect`);
    }
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluate(() => window.VintConvergence.close());

    // ── TEST 8 — the commons entry is collision-free flow content ────────────
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('vint:world-presence', { detail: { users: [
        { id: 'self', self: true, name: 'MESELF' }, { id: 'pK', self: false, name: 'KESTREL' }
      ], worldId: 'universe' } }));
      window.VintCommons.open();
    });
    await page.waitForFunction(() => { const s = document.getElementById('dvCommonsSheet'); return s && s.classList.contains('open'); }, { timeout: 5000 });
    const entry = await page.evaluate(() => {
      const row = document.querySelector('#dvCommonsSheet .cv-entry');
      if (!row) return { present: false };
      const body = document.querySelector('#dvCommonsSheet .dv-body');
      const cf = document.querySelector('#dvCommonsSheet .cf-entry');
      const roster = document.querySelector('#dvCommonsSheet .cm-row');
      const r = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, height: b.height }; };
      const ix = (a, b) => a && b && !(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5);
      const R = r(row), CF = cf ? r(cf) : null, RO = roster ? r(roster) : null, BO = body ? r(body) : null;
      return { present: true, rect: R, cf: CF, roster: RO, body: BO,
        hitsCf: ix(R, CF), hitsRoster: ix(R, RO) };
    });
    assert(entry.present, 'convergence entry appears inside the commons body');
    if (entry.present) {
      assert(entry.rect.height >= 44, 'entry meets the 44px touch floor', 'h=' + entry.rect.height);
      assert(!entry.body || (entry.rect.left >= entry.body.left - 1 && entry.rect.right <= entry.body.right + 1),
        'entry stays within the commons body box');
      assert(!entry.hitsCf, 'convergence entry never overlaps the confluence entry (stacked flow)');
      assert(!entry.hitsRoster, 'convergence entry never overlaps the roster row');
    }
    await page.evaluate(() => { try { window.VintCommons.close(); } catch (_) {} });

    // ── TEST 9 — one-open registry: opening commons evicts the convergence ───
    await page.evaluate(() => window.VintConvergence.open());
    await page.waitForFunction(() => window.VintConvergence.isOpen(), { timeout: 5000 });
    await page.evaluate(() => window.VintCommons.open());
    await new Promise(r => setTimeout(r, 150));
    const evict = await page.evaluate(() => ({
      convergenceOpen: window.VintConvergence.isOpen(),
      commonsOpen: (() => { const s = document.getElementById('dvCommonsSheet'); return !!(s && s.classList.contains('open')); })(),
    }));
    assert(!evict.convergenceOpen && evict.commonsOpen,
      'one-open registry: opening the commons closed the convergence', JSON.stringify(evict));
    await page.evaluate(() => { try { window.VintCommons.close(); } catch (_) {} });

    // ── TEST 10 — KILL SWITCH ────────────────────────────────────────────────
    await page.goto(WORLD + '?convergence=0', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitReady(page);
    assert(await page.evaluate(() => window.VintConvergence.enabled() === false),
      'kill switch: ?convergence=0 disables the surface');
    const killed = await page.evaluate(() => {
      window.VintConvergence.open();
      const s = document.getElementById('dvConvergenceSheet');
      const open = !!(s && s.classList.contains('open'));
      window.VintCommons.open();
      const entry = !!document.querySelector('#dvCommonsSheet .cv-entry');
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
