#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════════
   verify-spire-9TYJB74.js — headless proof for THE SPIRE (task 9TYJB74)

   THE SPIRE is the shared DESTINATION — the fourth world surface and the first that
   is not a tense. It composes the Confluence's witnessed record (VintConfluence.bonds())
   with the LIVE presence roster into one rising structure: the spire's HEIGHT is the
   real sum of acts (traded + taught + learned + raised + ventured) across the bonds, it
   climbs through seven named courses toward a keystone, and the hands that raised it —
   people AND agents, co-equal — stand at its foot. This harness loads the REAL world.html
   (real CSS, real neighbour rects) in headless Chromium and asserts, with evidence, that
   body/world/spire.js honours every hard law:

     · WIRED — the module ships, is <script>-loaded in world.html, registers with
       DirverseHUD's one-open registry, and its commons entry is called by commons.js.
     · NO 16th RAIL — spire.js adds no rail launcher (no addLauncher / dv-launch), and
       no #dvRail launcher references it; it opens only through the sheet registry.
     · ZERO FABRICATION — before any presence frame or bond it has ZERO height, ZERO
       motes, ZERO fill; after feeding the EXACT verified real signals (presence roster +
       Confluence bonds) the height equals the true sum of acts and the crew is EXACTLY
       those co-equal hands and no others; it re-derives nothing (reads bonds() only) and
       sends NO fabricated backend verb; a present-but-unwoven hand contributes ZERO
       stones; self is never a crew mote.
     · HUMAN/AGENT PARITY — a person and an agent render as the SAME mote/legend kind,
       and the rendered copy carries NO owner/owned property language anywhere.
     · NO-COLLISION — at 320/375/768/1280/1920px the sheet stays in the viewport, the
       field SVG + legend stay inside the body, no two mote circles overlap (true circle
       distance test), no two legend rows intersect, and the course bands never leave the
       field — in empty, four-hand AND many-hand (cap + overflow) states.
     · ONE-OPEN REGISTRY — opening the commons evicts the spire.
     · KILL SWITCH — ?spire=0 disables the surface and the commons entry.

   Network is intercepted: only local file:// loads; everything else is aborted, so the
   run is hermetic and never touches prod. Puppeteer is resolved from the sibling api repo.
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
// TRUE circle overlap — centre distance < sum of radii (correct primitive for motes).
function circlesOverlap(a, b) {
  const dx = a.cx - b.cx, dy = a.cy - b.cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < (a.r + b.r) - 0.75;
}

async function waitReady(page) {
  await page.waitForFunction(
    () => !!(window.VintSpire && window.VintConfluence && window.DirverseHUD && document.getElementById('dvRail')),
    { timeout: 20000 }
  );
}

// Feed the EXACT verified real signals. Produces four co-equal hands:
//   LUNEX    — agent, 2 ventures woven (from the record) → 2 stones, absent
//   MERIDIAN — human, present + 1 cleared trade           → 1 stone, present
//   ATLAS-3  — human, 1 taught recipe, NOT present         → 1 stone, absent
//   KESTREL  — human, present, no shared act               → 0 stones, present, unwoven
// → height = 4 stones, stagesReached = 2 (thr 1 and 3 ≤ 4, thr 7 > 4), 3 woven hands,
//   2 present. Self (MESELF) is never a crew mote.
async function feedRealSignals(page) {
  await page.evaluate(() => {
    const fire = (t, d) => window.dispatchEvent(new CustomEvent(t, { detail: d }));
    const key = 'agent\u0000lunex';
    localStorage.setItem('vint:confluence:universe', JSON.stringify({
      v: 1, bonds: { [key]: { name: 'LUNEX', kind: 'agent', traded: 0, ventured: 2, ventureNet: 5,
        taught: [], learned: [], raised: [], count: 2, first: Date.now(), last: Date.now() } },
      seenVentures: { seed: 1 }, primedVentures: true
    }));
    fire('vint:world-state', { worldId: '__seed__' });
    fire('vint:world-state', { worldId: 'universe' });

    fire('vint:world-presence', { users: [{ id: 'self', self: true, name: 'MESELF' }], worldId: 'universe' });
    fire('vint:world-trade', { trade: { id: 1, aUser: '1', bUser: '2' }, names: { '2': 'MERIDIAN' } });
    fire('vint:world-trade-settled', { tradeId: 1 });
    fire('vint:world-forge-taught', { student: 'ATLAS-3', name: 'lantern', recipeId: 'r1' });
    fire('vint:world-presence', { users: [
      { id: 'self', self: true, name: 'MESELF' },
      { id: 'pM', self: false, name: 'MERIDIAN' },
      { id: 'pK', self: false, name: 'KESTREL' }
    ], worldId: 'universe' });
  });
}

async function fieldInfo(page) {
  return await page.evaluate(() => {
    const sheet = document.getElementById('dvSpireSheet');
    const body = sheet && sheet.querySelector('#spBody');
    const field = body && body.querySelector('.sp-field');
    const motes = Array.from((body || document).querySelectorAll('.sp-mote'));
    const courses = Array.from((body || document).querySelectorAll('.sp-course'));
    const fills = Array.from((body || document).querySelectorAll('.sp-fill'));
    const rows = Array.from((body || document).querySelectorAll('.sp-row'));
    const courseRows = Array.from((body || document).querySelectorAll('.sp-row.sp-stage'));
    const moteRows = Array.from((body || document).querySelectorAll('.sp-row.sp-crew'));
    const rct = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
    const circ = el => { const b = el.getBoundingClientRect(); return { cx: b.left + b.width / 2, cy: b.top + b.height / 2, r: b.width / 2 }; };
    return {
      open: !!(sheet && sheet.classList.contains('open')),
      sheetRect: sheet ? rct(sheet) : null,
      bodyRect: body ? rct(body) : null,
      bodyOverflowX: body ? (body.scrollWidth - body.clientWidth) : 0,
      fieldRect: field ? rct(field) : null,
      hasEmpty: !!(body && body.querySelector('.sp-empty')),
      moteCount: motes.length,
      courseCount: courses.length,
      fillCount: fills.length,
      rowCount: rows.length,
      courseRowCount: courseRows.length,
      moteRowCount: moteRows.length,
      moteRowNames: moteRows.map(r => (r.querySelector('.sp-name') || {}).textContent || ''),
      moteRowKinds: moteRows.map(r => r.classList.contains('k-agent') ? 'agent' : (r.classList.contains('k-human') ? 'human' : '?')),
      bodyText: body ? body.textContent : '',
      moteCircles: motes.map(circ),
      courseRects: courses.map(rct),
      legRects: rows.map(rct),
    };
  });
}

(async () => {
  console.log('THE SPIRE — verify 9TYJB74');
  console.log('world: ' + WORLD + '\n');

  // ── STATIC WIRING (filesystem, no browser needed) ───────────────────────────
  const srcSpire = fs.readFileSync(path.join(ROOT, 'body/world/spire.js'), 'utf8');
  const srcHtml = fs.readFileSync(path.join(ROOT, 'world.html'), 'utf8');
  const srcCommons = fs.readFileSync(path.join(ROOT, 'body/world/commons.js'), 'utf8');
  const srcClient = fs.readFileSync(path.join(ROOT, 'body/world/world-client.js'), 'utf8');
  const srcDvhud = fs.readFileSync(path.join(ROOT, 'body/world/dirverse-hud.js'), 'utf8');

  assert(/<script[^>]+body\/world\/spire\.js/.test(srcHtml), 'spire.js is <script>-loaded in world.html');
  assert(/registerSheet\(\s*['"]spire['"]/.test(srcSpire), '.dv-sheet one-open registry wiring present (registerSheet("spire"))');
  assert(/VintSpire\s*&&\s*W\.VintSpire\.entryInto|VintSpire\.entryInto/.test(srcCommons), 'commons.js calls VintSpire.entryInto (entry lives in the commons, not a rail)');
  assert(!/addLauncher/.test(srcSpire) && !/dv-launch/.test(srcSpire), 'NO 16th rail: spire.js adds no rail launcher (no addLauncher / dv-launch)');
  assert(/VintConfluence[\s\S]{0,40}\.bonds\(\)|confluence\(\)\.bonds/.test(srcSpire), 'spire.js composes from VintConfluence.bonds() (single source of witnessed truth)');
  const verbSends = srcSpire.match(/['"]world:[a-z][a-z:]*['"]/g) || [];
  assert(verbSends.length === 0, 'no fabricated backend verb: spire.js sends zero world: verbs (pure composition)', JSON.stringify(verbSends));
  // the only sources it may read are bonds() + the presence roster — assert no other API call shapes.
  assert(!/fetch\(|XMLHttpRequest|\.send\(/.test(srcSpire), 'spire.js makes no network call of its own (composition only)');
  assert(/vint:world-presence/.test(srcSpire), 'spire.js reads the live presence roster (vint:world-presence)');
  // the real re-entry affordances it CAN call must exist in the real source.
  assert(/World\.facePresence\s*=/.test(srcClient), 'real affordance World.facePresence exists in world-client.js');
  assert(/openAgents\s*:/.test(srcDvhud), 'real affordance DirverseHUD.openAgents exists in dirverse-hud.js');
  // scaffold parity: uses the shared draggable bottom-sheet scaffold (.dv-sheet + .dv-grip + .dv-body scroll)
  assert(/className\s*=\s*'dv-sheet'/.test(srcSpire) && /dv-grip/.test(srcSpire) && /dv-body/.test(srcSpire),
    'uses the shared draggable .dv-sheet scaffold (.dv-grip drag-dismiss + .dv-body internal scroll)');
  // load order: spire.js must come AFTER confluence.js and commons.js in world.html
  const idxSpire = srcHtml.indexOf('body/world/spire.js');
  const idxConf = srcHtml.indexOf('body/world/confluence.js');
  const idxCommons = srcHtml.indexOf('body/world/commons.js');
  assert(idxSpire > idxConf && idxSpire > idxCommons, 'spire.js loads AFTER confluence.js and commons.js');

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
    await waitReady(page);
    ok('world.html loaded; DirverseHUD + VintSpire + VintConfluence + #dvRail present');

    await page.evaluate(() => { try { localStorage.clear(); } catch (_) {} });

    // ── TEST 1 — flag on by default ─────────────────────────────────────────
    assert(await page.evaluate(() => window.VintSpire.enabled() === true), 'flag on by default (enabled() === true)');

    // ── TEST 2 — NO new rail launcher references the spire in the DOM ────────
    const railHasSpire = await page.evaluate(() => {
      const rail = document.getElementById('dvRail');
      if (!rail) return false;
      return Array.from(rail.querySelectorAll('.dv-launch')).some(b => /spire/i.test(b.textContent || ''));
    });
    assert(!railHasSpire, 'NO 16th rail: no #dvRail launcher references the spire');

    // ── TEST 3 — ZERO FABRICATION: empty before any signal ──────────────────
    await page.evaluate(() => window.VintSpire.open());
    await page.waitForFunction(() => { const s = document.getElementById('dvSpireSheet'); return s && s.classList.contains('open'); }, { timeout: 5000 });
    let info = await fieldInfo(page);
    assert(info.open, 'opens via registry (VintSpire.open)');
    assert(info.moteCount === 0, 'ZERO motes before any presence frame or bond (no fabrication)', 'got ' + info.moteCount);
    assert(info.courseCount === 0, 'ZERO courses drawn when the ground is bare (no SVG field yet)', 'got ' + info.courseCount);
    assert(info.fillCount === 0, 'ZERO progress fill before any stone', 'got ' + info.fillCount);
    const pic0 = await page.evaluate(() => window.VintSpire._picture());
    assert(pic0.height === 0, 'height is ZERO before any act (no fabricated stone)', 'got ' + pic0.height);
    assert(info.hasEmpty, 'honest empty-state invitation shown when the ground is bare');
    await page.evaluate(() => window.VintSpire.close());
    assert(await page.evaluate(() => !window.VintSpire.isOpen()), 'closes (VintSpire.close)');

    // ── TEST 4 — composes EXACTLY the real signals into co-equal hands ───────
    await feedRealSignals(page);
    const g = await page.evaluate(() => window.VintSpire._picture());
    assert(g.crew.length === 4, 'exactly 4 co-equal hands from the real roster + record', 'got ' + g.crew.length);
    assert(g.height === 4, 'spire height === true sum of acts (2 venture + 1 trade + 1 taught + 0)', 'got ' + g.height);
    assert(g.stagesReached === 2, 'exactly 2 courses reached at height 4 (thr 1 and 3 ≤ 4, thr 7 > 4)', 'got ' + g.stagesReached);
    assert(g.stageCount === 7, 'seven named courses in total', 'got ' + g.stageCount);
    assert(g.complete === false, 'the keystone is NOT set at height 4 (open loop)');
    assert(g.hands === 3, 'exactly 3 woven hands (LUNEX, MERIDIAN, ATLAS-3); KESTREL has no stone', 'hands=' + g.hands);
    assert(g.here === 2, 'exactly 2 hands present now (MERIDIAN, KESTREL)', 'here=' + g.here);
    const gnames = g.crew.map(n => n.name);
    assert(['MERIDIAN', 'KESTREL', 'LUNEX', 'ATLAS-3'].every(n => gnames.includes(n)), 'all four real hands present', JSON.stringify(gnames));
    assert(!gnames.includes('MESELF'), 'self is never a crew mote');
    const kestrel = g.crew.filter(c => c.name === 'KESTREL')[0];
    assert(kestrel && kestrel.stones === 0 && kestrel.woven === false, 'present-but-unwoven hand (KESTREL) contributes ZERO stones');
    assert(g.self === 'MESELF', 'self name learned from the real presence self row', g.self);

    await page.evaluate(() => window.VintSpire.open());
    await page.waitForFunction(() => { const s = document.getElementById('dvSpireSheet'); return s && s.classList.contains('open'); }, { timeout: 5000 });
    await new Promise(r => setTimeout(r, 200));
    info = await fieldInfo(page);
    assert(info.moteCount === 4, 'exactly 4 mote circles rendered at the foot', 'got ' + info.moteCount);
    assert(info.courseCount === 7, 'all 7 course bands rendered', 'got ' + info.courseCount);
    assert(info.fillCount === 1, 'exactly 1 progress fill — the course being laid', 'got ' + info.fillCount);
    assert(info.courseRowCount === 7, 'exactly 7 course legend rows (the readable layer)', 'got ' + info.courseRowCount);
    assert(info.moteRowCount === 4, 'exactly 4 crew legend rows', 'got ' + info.moteRowCount);
    assert(['MERIDIAN', 'KESTREL', 'LUNEX', 'ATLAS-3'].every(n => info.moteRowNames.includes(n)), 'crew legend names match the real hands', JSON.stringify(info.moteRowNames));
    assert(!info.moteRowNames.includes('MESELF'), 'self never appears as a crew legend row');

    // ── TEST 5 — HUMAN/AGENT PARITY ─────────────────────────────────────────
    assert(info.moteRowKinds.every(k => k === 'human' || k === 'agent'), 'every crew row is one co-equal kind (human|agent)', JSON.stringify(info.moteRowKinds));
    assert(info.moteRowKinds.includes('human') && info.moteRowKinds.includes('agent'), 'both a person and an agent render — as the same row shape');
    assert(!/owner|owned|belongs to|your agent|my agent/i.test(info.bodyText),
      'NO owner/owned property language anywhere in the rendered surface');

    // ── TEST 6 — NO-COLLISION at every breakpoint (four-hand state) ──────────
    for (const w of BREAKPOINTS) {
      await page.setViewport({ width: w, height: 800 });
      await new Promise(r => setTimeout(r, 450));
      const i = await fieldInfo(page);
      const vpOK = i.sheetRect && i.sheetRect.left >= -0.5 && i.sheetRect.right <= w + 0.5 &&
        i.sheetRect.top >= -0.5 && i.sheetRect.bottom <= 800 + 0.5;
      assert(vpOK, `@${w}px sheet stays inside the viewport`, i.sheetRect && JSON.stringify(i.sheetRect));
      assert(i.bodyOverflowX <= 1, `@${w}px body has no horizontal overflow`, 'overflowX=' + i.bodyOverflowX);
      const br = i.bodyRect;
      const fieldInB = br && i.fieldRect ? (i.fieldRect.left >= br.left - 1 && i.fieldRect.right <= br.right + 1) : false;
      assert(fieldInB, `@${w}px the field stays within the body box`);
      const coursesInF = i.fieldRect ? i.courseRects.every(c => c.left >= i.fieldRect.left - 1 && c.right <= i.fieldRect.right + 1) : false;
      assert(coursesInF, `@${w}px every course band stays within the field`);
      const legsInB = br ? i.legRects.every(c => c.left >= br.left - 1 && c.right <= br.right + 1) : false;
      assert(legsInB, `@${w}px every legend row stays within the body box`);
      let moteOverlap = false;
      for (let a = 0; a < i.moteCircles.length; a++)
        for (let b = a + 1; b < i.moteCircles.length; b++)
          if (circlesOverlap(i.moteCircles[a], i.moteCircles[b])) moteOverlap = true;
      assert(!moteOverlap, `@${w}px no two motes overlap (true circle distance)`);
      let legOverlap = false;
      for (let a = 0; a < i.legRects.length; a++)
        for (let b = a + 1; b < i.legRects.length; b++)
          if (intersects(i.legRects[a], i.legRects[b])) legOverlap = true;
      assert(!legOverlap, `@${w}px no two legend rows intersect`);
    }
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluate(() => window.VintSpire.close());

    // ── TEST 7 — MANY-HAND collision: cap + overflow stay collision-free ─────
    await page.evaluate(() => {
      const bonds = {};
      for (let i = 0; i < 55; i++) {
        bonds['agent\u0000peer' + i] = { name: 'PEER-' + i, kind: (i % 2 ? 'agent' : 'human'),
          traded: 0, ventured: 1, ventureNet: 0, taught: [], learned: [], raised: [],
          count: 1, first: Date.now(), last: Date.now() };
      }
      localStorage.setItem('vint:confluence:universe', JSON.stringify({ v: 1, bonds, seenVentures: { s: 1 }, primedVentures: true }));
      window.dispatchEvent(new CustomEvent('vint:world-state', { detail: { worldId: '__seed2__' } }));
      window.dispatchEvent(new CustomEvent('vint:world-state', { detail: { worldId: 'universe' } }));
      window.dispatchEvent(new CustomEvent('vint:world-presence', { detail: { users: [{ id: 'self', self: true, name: 'MESELF' }], worldId: 'universe' } }));
      window.VintSpire.open();
    });
    await page.waitForFunction(() => { const s = document.getElementById('dvSpireSheet'); return s && s.classList.contains('open'); }, { timeout: 5000 });
    await new Promise(r => setTimeout(r, 250));
    const many = await fieldInfo(page);
    assert(many.moteCount > 0 && many.moteCount <= 8, 'many-hand: ground caps visible motes (<=8), never piles them', 'motes=' + many.moteCount);
    assert(many.moteRowCount === 55, 'many-hand: every hand still gets a readable legend row (full crew legible)', 'rows=' + many.moteRowCount);
    assert(many.courseCount === 7, 'many-hand: still exactly 7 course bands', 'courses=' + many.courseCount);
    for (const w of [320, 768, 1920]) {
      await page.setViewport({ width: w, height: 800 });
      await new Promise(r => setTimeout(r, 300));
      const i = await fieldInfo(page);
      let moteOverlap = false;
      for (let a = 0; a < i.moteCircles.length; a++)
        for (let b = a + 1; b < i.moteCircles.length; b++)
          if (circlesOverlap(i.moteCircles[a], i.moteCircles[b])) moteOverlap = true;
      assert(!moteOverlap, `@${w}px many-hand: no two motes overlap`);
      assert(i.bodyOverflowX <= 1, `@${w}px many-hand: no horizontal overflow`, 'overflowX=' + i.bodyOverflowX);
    }
    await page.setViewport({ width: 1280, height: 800 });
    await page.evaluate(() => { try { window.VintSpire.close(); localStorage.clear(); } catch (_) {} });

    // ── TEST 8 — the commons entry is collision-free flow content ────────────
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('vint:world-presence', { detail: { users: [
        { id: 'self', self: true, name: 'MESELF' }, { id: 'pK', self: false, name: 'KESTREL' }
      ], worldId: 'universe' } }));
      window.VintCommons.open();
    });
    await page.waitForFunction(() => { const s = document.getElementById('dvCommonsSheet'); return s && s.classList.contains('open'); }, { timeout: 5000 });
    const entry = await page.evaluate(() => {
      const row = document.querySelector('#dvCommonsSheet .sp-entry');
      if (!row) return { present: false };
      const body = document.querySelector('#dvCommonsSheet .dv-body');
      const cf = document.querySelector('#dvCommonsSheet .cf-entry');
      const cv = document.querySelector('#dvCommonsSheet .cv-entry');
      const wv = document.querySelector('#dvCommonsSheet .wv-entry');
      const roster = document.querySelector('#dvCommonsSheet .cm-row');
      const r = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, height: b.height }; };
      const ix = (a, b) => a && b && !(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5);
      const R = r(row), CF = cf ? r(cf) : null, CV = cv ? r(cv) : null, WV = wv ? r(wv) : null, RO = roster ? r(roster) : null, BO = body ? r(body) : null;
      return { present: true, rect: R, body: BO,
        hitsCf: ix(R, CF), hitsCv: ix(R, CV), hitsWv: ix(R, WV), hitsRoster: ix(R, RO) };
    });
    assert(entry.present, 'spire entry appears inside the commons body');
    if (entry.present) {
      assert(entry.rect.height >= 44, 'entry meets the 44px touch floor', 'h=' + entry.rect.height);
      assert(!entry.body || (entry.rect.left >= entry.body.left - 1 && entry.rect.right <= entry.body.right + 1),
        'entry stays within the commons body box');
      assert(!entry.hitsCf, 'spire entry never overlaps the confluence entry (stacked flow)');
      assert(!entry.hitsCv, 'spire entry never overlaps the convergence entry (stacked flow)');
      assert(!entry.hitsWv, 'spire entry never overlaps the weave entry (stacked flow)');
      assert(!entry.hitsRoster, 'spire entry never overlaps the roster row');
    }
    await page.evaluate(() => { try { window.VintCommons.close(); } catch (_) {} });

    // ── TEST 9 — one-open registry: opening commons evicts the spire ─────────
    await page.evaluate(() => window.VintSpire.open());
    await page.waitForFunction(() => window.VintSpire.isOpen(), { timeout: 5000 });
    await page.evaluate(() => window.VintCommons.open());
    await new Promise(r => setTimeout(r, 150));
    const evict = await page.evaluate(() => ({
      spireOpen: window.VintSpire.isOpen(),
      commonsOpen: (() => { const s = document.getElementById('dvCommonsSheet'); return !!(s && s.classList.contains('open')); })(),
    }));
    assert(!evict.spireOpen && evict.commonsOpen,
      'one-open registry: opening the commons closed the spire', JSON.stringify(evict));
    await page.evaluate(() => { try { window.VintCommons.close(); } catch (_) {} });

    // ── TEST 10 — KILL SWITCH ─────────────────────────────────────────────────
    await page.goto(WORLD + '?spire=0', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitReady(page);
    assert(await page.evaluate(() => window.VintSpire.enabled() === false), 'kill switch: ?spire=0 disables the surface');
    const killed = await page.evaluate(() => {
      window.VintSpire.open();
      const s = document.getElementById('dvSpireSheet');
      const open = !!(s && s.classList.contains('open'));
      window.VintCommons.open();
      const entry = !!document.querySelector('#dvCommonsSheet .sp-entry');
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
