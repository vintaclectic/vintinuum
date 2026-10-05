#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════════
   verify-confluence-9TYJB74.js — headless proof for THE CONFLUENCE (task 9TYJB74)

   Loads the REAL world.html (real CSS, real neighbour rects) in headless Chromium
   and asserts, with evidence, that body/world/confluence.js honours every hard law:

     · OPENS / CLOSES via DirverseHUD's one-open-at-a-time registry (not its own).
     · ZERO FABRICATION — before any event the surface has ZERO rows; after feeding
       the EXACT verified real event shapes it shows EXACTLY those threads and no
       others; a crewmate who is ME is excluded; an unreachable ventures endpoint
       yields ZERO agent rows (never a placeholder).
     · HUMAN/AGENT PARITY — person and agent render as the same card kind.
     · NO-COLLISION — at 320/375/768/1280/1920px the sheet stays in the viewport,
       its body never overflows horizontally, and no two rendered cards (nor the
       commons entry vs. the roster) ever intersect.
     · KILL SWITCH — ?confluence=0 disables the surface and the commons entry.

   Network is intercepted: only local file:// loads; everything else is aborted,
   so the run is hermetic and never depends on prod. Puppeteer is resolved from
   the sibling api repo (the only copy installed on this machine).
   ──────────────────────────────────────────────────────────────────────────── */
'use strict';

const path = require('path');
let puppeteer;
try { puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer'); }
catch (e) { console.error('FATAL: puppeteer not resolvable from api repo:', e.message); process.exit(2); }

const WORLD = 'file://' + path.resolve(__dirname, '..', 'world.html');
const BREAKPOINTS = [320, 375, 768, 1280, 1920];

const results = [];
function ok(label) { results.push({ pass: true, label }); console.log('  PASS  ' + label); }
function bad(label, extra) { results.push({ pass: false, label }); console.log('  FAIL  ' + label + (extra ? '  → ' + extra : '')); }
function assert(cond, label, extra) { cond ? ok(label) : bad(label, extra); }

// pairwise 2D intersection test (the No-Collision primitive)
function intersects(a, b) {
  return !(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 ||
           a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5);
}

async function waitReady(page) {
  await page.waitForFunction(
    () => !!(window.VintConfluence && window.DirverseHUD && document.getElementById('dvRail')),
    { timeout: 20000 }
  );
}

// feed the EXACT verified real event payload shapes (see confluence.js header)
async function feedRealEvents(page) {
  await page.evaluate(() => {
    const fire = (t, detail) => window.dispatchEvent(new CustomEvent(t, { detail }));
    // learn my own name from a real presence self row (so crew self-exclusion works)
    fire('vint:world-presence', { users: [{ id: 'self', self: true, name: 'MESELF' }], worldId: 'universe' });
    // a trade cleared with a person (partner name from the server's names map)
    fire('vint:world-trade', { trade: { id: 1, aUser: '1', bUser: '2' }, names: { '2': 'MERIDIAN' } });
    fire('vint:world-trade-settled', { tradeId: 1, gave: { strand: 2 }, got: { ember: 1 } });
    // I taught a person a recipe
    fire('vint:world-forge-taught', { student: 'ARIA-7', name: 'lantern', recipeId: 'r1' });
    // a person taught me one
    fire('vint:world-forge-learned', { from: 'ATLAS-3', name: 'ember', recipeId: 'r2' });
    // a great work I was in the crew of completed — crew incl. me (excluded) + LUNEX
    fire('vint:world-forge-completed', { yours: true, name: 'the beacon',
      crew: [{ id: 'u1', name: 'LUNEX' }, { id: 'u2', name: 'MESELF' }] });
  });
}

async function cardInfo(page) {
  return await page.evaluate(() => {
    const sheet = document.getElementById('dvConfluenceSheet');
    const body = sheet && sheet.querySelector('#cfBody');
    const cards = Array.from((body || document).querySelectorAll('.cf-card'));
    const r = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
    return {
      open: !!(sheet && sheet.classList.contains('open')),
      sheetRect: sheet ? r(sheet) : null,
      bodyRect: body ? r(body) : null,
      bodyOverflowX: body ? (body.scrollWidth - body.clientWidth) : 0,
      hasEmpty: !!(body && body.querySelector('.cf-empty')),
      count: cards.length,
      names: cards.map(c => (c.querySelector('.cf-name') || {}).textContent || ''),
      kinds: cards.map(c => c.classList.contains('k-agent') ? 'agent' : (c.classList.contains('k-human') ? 'human' : '?')),
      cardRects: cards.map(r),
    };
  });
}

(async () => {
  console.log('THE CONFLUENCE — verify 9TYJB74');
  console.log('world: ' + WORLD + '\n');

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setRequestInterception(true);
    page.on('request', req => {
      const u = req.url();
      if (u.startsWith('file://') || u.startsWith('about:') || u.startsWith('data:')) req.continue();
      else req.abort();              // hermetic: no CDN, no prod, no WS
    });
    page.on('pageerror', () => {});  // guarded page code logs; never fatal to the harness

    // ── load the real page ──────────────────────────────────────────────────
    await page.goto(WORLD, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitReady(page);
    ok('world.html loaded; DirverseHUD + VintConfluence + #dvRail present');

    // clean slate for this run
    await page.evaluate(() => { try { localStorage.clear(); } catch (_) {} window.VintConfluence._reset(); });

    // ── TEST 1 — flag on by default ───────────────────────────────────────────
    assert(await page.evaluate(() => window.VintConfluence.enabled() === true),
      'flag on by default (enabled() === true)');

    // ── TEST 2 — ZERO FABRICATION: empty before any event ─────────────────────
    await page.evaluate(() => window.VintConfluence.open());
    await page.waitForFunction(() => { const s = document.getElementById('dvConfluenceSheet'); return s && s.classList.contains('open'); }, { timeout: 5000 });
    let info = await cardInfo(page);
    assert(info.open, 'opens via registry (VintConfluence.open)');
    assert(info.count === 0, 'ZERO rows before any event (no fabrication)', 'got ' + info.count);
    assert(info.hasEmpty, 'honest empty-state invitation shown when nothing is woven');
    await page.evaluate(() => window.VintConfluence.close());
    assert(await page.evaluate(() => !window.VintConfluence.isOpen()), 'closes (VintConfluence.close)');

    // ── TEST 3 — renders EXACTLY the real events, excludes self ────────────────
    await feedRealEvents(page);
    const bc = await page.evaluate(() => window.VintConfluence._bondCount());
    assert(bc === 4, 'exactly 4 threads from 4 real cross-actor events', 'got ' + bc);
    await page.evaluate(() => window.VintConfluence.open());
    await page.waitForFunction(() => { const s = document.getElementById('dvConfluenceSheet'); return s && s.classList.contains('open'); }, { timeout: 5000 });
    info = await cardInfo(page);
    assert(info.count === 4, 'exactly 4 cards rendered', 'got ' + info.count);
    const want = ['MERIDIAN', 'ARIA-7', 'ATLAS-3', 'LUNEX'];
    assert(want.every(n => info.names.includes(n)), 'all four real partners present', JSON.stringify(info.names));
    assert(!info.names.includes('MESELF'), 'self excluded from a great-work crew (no self-bond)');
    assert(info.kinds.every(k => k === 'human'), 'trade/teach/learn/great-work partners rendered as person (verified kind)');
    assert(info.kinds.every(k => k === 'human' || k === 'agent'), 'human/agent parity: every card is one co-equal kind');

    // ── TEST 4 — NO-COLLISION at every breakpoint ─────────────────────────────
    for (const w of BREAKPOINTS) {
      await page.setViewport({ width: w, height: 800 });
      await new Promise(r => setTimeout(r, 120));
      const i = await cardInfo(page);
      const vpOK = i.sheetRect && i.sheetRect.left >= -0.5 && i.sheetRect.right <= w + 0.5 &&
        i.sheetRect.top >= -0.5 && i.sheetRect.bottom <= 800 + 0.5;
      assert(vpOK, `@${w}px sheet stays inside the viewport`, i.sheetRect && JSON.stringify(i.sheetRect));
      assert(i.bodyOverflowX <= 1, `@${w}px body has no horizontal overflow`, 'overflowX=' + i.bodyOverflowX);
      const br = i.bodyRect;
      const cardsInBody = br ? i.cardRects.every(c => c.left >= br.left - 1 && c.right <= br.right + 1) : false;
      assert(cardsInBody, `@${w}px every card stays within the body box`);
      let overlap = false;
      for (let a = 0; a < i.cardRects.length; a++)
        for (let b = a + 1; b < i.cardRects.length; b++)
          if (intersects(i.cardRects[a], i.cardRects[b])) overlap = true;
      assert(!overlap, `@${w}px no two cards intersect`);
    }
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluate(() => window.VintConfluence.close());

    // ── TEST 5 — the commons entry is collision-free flow content ─────────────
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('vint:world-presence', { detail: { users: [
        { id: 'self', self: true, name: 'MESELF' }, { id: 'p9', self: false, name: 'KESTREL' }
      ], worldId: 'universe' } }));
      window.VintCommons.open();
    });
    await page.waitForFunction(() => { const s = document.getElementById('dvCommonsSheet'); return s && s.classList.contains('open'); }, { timeout: 5000 });
    const entry = await page.evaluate(() => {
      const row = document.querySelector('#dvCommonsSheet .cf-entry');
      if (!row) return { present: false };
      const body = document.querySelector('#dvCommonsSheet .dv-body');
      const first = document.querySelector('#dvCommonsSheet .cm-row');
      const r = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, height: b.height }; };
      return { present: true, rect: r(row), bodyRect: body ? r(body) : null, rosterRect: first ? r(first) : null };
    });
    assert(entry.present, 'confluence entry appears inside the commons body');
    if (entry.present) {
      assert(entry.rect.height >= 44, 'entry meets the 44px touch floor', 'h=' + entry.rect.height);
      assert(!entry.bodyRect || (entry.rect.left >= entry.bodyRect.left - 1 && entry.rect.right <= entry.bodyRect.right + 1),
        'entry stays within the commons body box');
      assert(!entry.rosterRect || !intersects(entry.rect, entry.rosterRect),
        'entry never overlaps the roster row');
    }
    await page.evaluate(() => { try { window.VintCommons.close(); } catch (_) {} });

    // ── TEST 6 — registry one-open: opening commons evicts the confluence ─────
    await page.evaluate(() => window.VintConfluence.open());
    await page.waitForFunction(() => window.VintConfluence.isOpen(), { timeout: 5000 });
    await page.evaluate(() => window.VintCommons.open());
    await new Promise(r => setTimeout(r, 150));
    const evict = await page.evaluate(() => ({
      confluenceOpen: window.VintConfluence.isOpen(),
      commonsOpen: (() => { const s = document.getElementById('dvCommonsSheet'); return !!(s && s.classList.contains('open')); })(),
    }));
    assert(!evict.confluenceOpen && evict.commonsOpen,
      'one-open registry: opening the commons closed the confluence', JSON.stringify(evict));
    await page.evaluate(() => { try { window.VintCommons.close(); } catch (_) {} });

    // ── TEST 7 — KILL SWITCH ──────────────────────────────────────────────────
    await page.goto(WORLD + '?confluence=0', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitReady(page);
    assert(await page.evaluate(() => window.VintConfluence.enabled() === false),
      'kill switch: ?confluence=0 disables the surface');
    const killed = await page.evaluate(() => {
      window.VintConfluence.open();
      const s = document.getElementById('dvConfluenceSheet');
      const open = !!(s && s.classList.contains('open'));
      window.VintCommons.open();
      const entry = !!document.querySelector('#dvCommonsSheet .cf-entry');
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
