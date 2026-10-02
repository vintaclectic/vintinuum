#!/usr/bin/env node
/* verify-pulse-9TYJB74.js — proves THE PULSE renders REAL events and never
 * collides. (AETHERHOLD 2026-10-02)
 *
 * What it does, in a REAL headless Chromium against the REAL world.html (actual
 * CSS, actual #topctl/#editHeadBtn/#status neighbours, actual pulse-hud.js),
 * with ALL network blocked so nothing external loads:
 *   A. NO FABRICATION — before any event is fired, asserts the river has 0 rows.
 *   B. REAL EVENTS → ROWS — fires every real signal the organs dispatch and
 *      asserts each produces exactly the row(s) expected, with the right actor
 *      KIND (agent vs person vs you vs world). Fires presence twice to prove the
 *      census-vs-arrival guard. A signal never fired never appears.
 *   C. NO COLLISION — at 320/375/768/1280/1920px, measures the ambient glance's
 *      real bounding box against the real top-right controls and the #status
 *      ceiling and asserts zero intersection (or an honest hide).
 *
 * Exit 0 = all assertions passed; non-zero = a failure (printed).
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');

const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.glb':'model/gltf-binary' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/world.html';
      const fp = path.join(ROOT, p);
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
        res.writeHead(404); res.end('nf'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'text/plain' });
      fs.createReadStream(fp).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

let fails = 0, passes = 0;
function ok(cond, label, extra) {
  if (cond) { passes++; console.log('  PASS  ' + label); }
  else { fails++; console.log('  FAIL  ' + label + (extra != null ? ('  [' + extra + ']') : '')); }
}

(async () => {
  const srv = await serve();
  const port = srv.address().port;
  const base = 'http://127.0.0.1:' + port + '/world.html?pulse=1';
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  // Block everything that is not our own origin (kills CDN, the WS, the API).
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    if (r.url().startsWith('http://127.0.0.1:' + port + '/')) r.continue();
    else r.abort();
  });
  page.on('pageerror', () => {});   // organs that need the WS/WebGL may throw; irrelevant here

  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
  await page.waitForFunction('!!window.VintPulse', { timeout: 10000 });

  console.log('\nA. NO FABRICATION (nothing in the river before any event)');
  ok((await page.evaluate(() => window.VintPulse._count())) === 0, 'river is empty at load — no synthetic rows');

  console.log('\nB. REAL EVENTS -> ROWS (each row sourced from a dispatched signal)');
  // Fire every real signal. Values mirror the verified payload shapes.
  const expect = await page.evaluate(() => {
    const fire = (t, d) => window.dispatchEvent(new CustomEvent(t, { detail: d }));
    const before = window.VintPulse._count();

    // presence: first frame is a CENSUS (no arrival rows), second has an arrival
    fire('vint:world-presence', { users: [{ id: 'u:1', name: 'RIVERA' }] });              // census
    const afterCensus = window.VintPulse._count();
    fire('vint:world-presence', { users: [{ id: 'u:1', name: 'RIVERA' }, { id: 'u:2', name: 'KOA' }] }); // KOA arrives

    // market: an AGENT bought your tool (the co-equal agent row)
    fire('vint:market-settled', { title: 'bone-handled knife', lumen: 40, soldByYou: true,
      kind: 'tool', counterparty: 'your archivist', counterpartyIsAgent: true });

    // the rest of the real world
    fire('vint:world-trade-settled', { gave: { strand: 2 }, got: { ember: 1 } });
    fire('vint:world-forge-first', { who: 'LUMEN', name: 'lantern-glass' });               // global
    fire('vint:world-forge-learned', { from: 'KOA', name: 'warding-knot' });
    fire('vint:world-forge-taught', { say: 'you taught it.' });
    fire('vint:world-forge-completed', { crew: [{ name: 'KOA' }, { name: 'you' }], name: 'the long bridge', yours: true }); // global
    fire('vint:world-forge-raised', {});
    fire('vint:world-forge-contributed', {});
    fire('vint:world-forge', { say: 'the anvil rings.' });
    fire('vint:world-weave', {});
    fire('vint:world-struct', { struct: { kind: 'arch' } });
    fire('vint:world-trace', { id: 't1' });
    fire('vint:world-trace-ok', { id: 't2' });
    fire('vint:concord-resolved', { passed: true, kind: 'tithe', effect: {} });            // agent lane
    fire('vint:world-law', { carried: true });
    fire('vint:world-strike', { victim: { name: 'a raider' }, took: {} });
    fire('vint:world-died', {});
    fire('vint:admiralty-launched', { name: 'Dawnreach', cls: 'sloop', el: 'air', flaws: 0 });
    fire('vint:admiralty-wake', { won: true, effect: {} });
    fire('vint:secret-kept', { id: 's1', name: 'the drowned door' });

    const rows = window.VintPulse._rows();
    return {
      before, afterCensus, total: rows.length,
      kinds: rows.map(r => r.kind),
      // the specific co-equality assertions
      hasAgentMarket: rows.some(r => r.kind === 'agent' && /bought your bone-handled knife/.test(r.verb)),
      hasPersonArrival: rows.some(r => r.kind === 'person' && r.actor === 'KOA' && /walked into the world/.test(r.verb)),
      hasConcordAgent: rows.some(r => r.kind === 'agent' && r.actor === 'the Concord'),
      hasGlobalForge: rows.some(r => r.scope === 'world' && /first lantern-glass/.test(r.verb)),
      hasYouForge: rows.some(r => r.kind === 'you' && /anvil/.test(r.verb))
    };
  });

  // 22 fire() calls, but the FIRST presence is a census (0 rows) and the SECOND
  // adds exactly 1 arrival (KOA; RIVERA was in the census). So: 22 events, of
  // which presence contributes 1 row, forge-first+completed are rows too ->
  // every non-census event yields exactly one row.
  const EXPECT_ROWS = 21; // 22 events - 1 census frame that intentionally adds nothing
  ok(expect.before === 0, 'still empty right before firing', expect.before);
  ok(expect.afterCensus === 0, 'first presence frame is a census — adds 0 rows', expect.afterCensus);
  ok(expect.total === EXPECT_ROWS, 'every real event produced exactly one row (' + EXPECT_ROWS + ')', 'got ' + expect.total);
  ok(expect.hasPersonArrival, 'a human arrival renders as a PERSON row (KOA)');
  ok(expect.hasAgentMarket, 'an agent buying your tool renders as an AGENT row (co-equal)');
  ok(expect.hasConcordAgent, 'the Concord (your court bench) renders as an AGENT row');
  ok(expect.hasGlobalForge, 'a first-ever forge renders as a world-scope row');
  ok(expect.hasYouForge, 'your own anvil renders as a YOU row');

  // open the river sheet and confirm it paints the rows + filters
  const riverOpen = await page.evaluate(() => {
    window.VintPulse.open();
    const sheet = document.getElementById('vpSheet');
    const list = document.getElementById('vpList');
    const rowsPainted = list ? list.querySelectorAll('.vp-row').length : -1;
    // filter to AGENTS only and recount
    const agentChip = sheet && sheet.querySelector('.vp-chip[data-f="agent"]');
    if (agentChip) agentChip.click();
    const agentRows = list ? list.querySelectorAll('.vp-row').length : -1;
    return { open: !!(sheet && sheet.classList.contains('open')), rowsPainted, agentRows };
  });
  ok(riverOpen.open, 'the river sheet opens (.dv-sheet.open)');
  ok(riverOpen.rowsPainted === EXPECT_ROWS, 'the river paints every row', 'painted ' + riverOpen.rowsPainted);
  ok(riverOpen.agentRows >= 2 && riverOpen.agentRows < EXPECT_ROWS, 'the AGENTS filter narrows to agent rows only', 'agent rows ' + riverOpen.agentRows);
  await page.evaluate(() => window.VintPulse.close());

  console.log('\nC. NO COLLISION (ambient glance vs the real top-right stack & #status)');
  const widths = [320, 375, 768, 1280, 1920];
  for (const w of widths) {
    await page.setViewport({ width: w, height: 760, deviceScaleFactor: 1 });
    // let layout + the glance's resize handler + the HUD panel's reflow settle
    // (the glance schedules a 320ms steady-state relayout after any resize)
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await new Promise(r => setTimeout(r, 420));
    const g = await page.evaluate(() => {
      function rect(id) { const e = document.getElementById(id); if (!e) return null;
        const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
        const vis = cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0 && e.classList.contains('vp-on');
        return { x: r.left, y: r.top, r: r.right, b: r.bottom, vis }; }
      function rawrect(id) { const e = document.getElementById(id); if (!e) return null;
        const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
        if (cs.display === 'none' || r.width === 0) return null;
        return { x: r.left, y: r.top, r: r.right, b: r.bottom }; }
      const glance = rect('vpGlance');
      const dot = rect('vpDot');
      const mode = (glance && glance.vis) ? 'line' : ((dot && dot.vis) ? 'dot' : 'none');
      const shown = mode === 'line' ? glance : (mode === 'dot' ? dot : null);
      const cs = getComputedStyle(document.documentElement);
      const ceil = parseFloat(cs.getPropertyValue('--vint-hud-bottom')) || 270;
      return { shown, mode, topctl: rawrect('topctl'), edit: rawrect('editHeadBtn'), ceil,
        vw: window.innerWidth };
    });
    const intersects = (a, b) => a && b && a.x < b.r && a.r > b.x && a.y < b.b && a.b > b.y;
    ok(g.mode !== 'none', w + 'px — an ambient entry is present (' + g.mode + ')', g.mode);
    if (!g.shown) {
      ok(true, w + 'px — glance honestly hidden (no room) → cannot collide');
      continue;
    }
    const hitTop = intersects(g.shown, g.topctl);
    const hitEdit = intersects(g.shown, g.edit);
    const underCeil = g.shown.b <= g.ceil + 0.5;
    const inViewX = g.shown.r <= g.vw + 0.5 && g.shown.x >= -0.5;
    ok(!hitTop, w + 'px — glance does not touch #topctl', hitTop ? JSON.stringify([g.shown, g.topctl]) : '');
    ok(!hitEdit, w + 'px — glance does not touch #editHeadBtn', hitEdit ? JSON.stringify([g.shown, g.edit]) : '');
    ok(underCeil, w + 'px — glance stays above #status ceiling (' + g.ceil + ')', 'bottom ' + Math.round(g.shown.b));
    ok(inViewX, w + 'px — glance stays within the viewport horizontally', JSON.stringify(g.shown));
  }

  await browser.close();
  srv.close();
  console.log('\n──────────────────────────────────────────');
  console.log('  ' + passes + ' passed, ' + fails + ' failed');
  console.log('──────────────────────────────────────────');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
