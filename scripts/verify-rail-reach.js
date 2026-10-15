#!/usr/bin/env node
/* verify-rail-reach.js — EVERY LAUNCHER, EVERY SHEET, EVERY BREAKPOINT (task GEJ8NYU).
   ────────────────────────────────────────────────────────────────────────────
   verify-one-sheet.js hit-tests only the 8 launchers that OPEN a sheet. The rail
   holds ~15. A launcher clipped off the top of the rail's scroll box, or painted
   under an open sheet, is a dead control whether or not it happens to open a
   sheet itself — so this proof asks the question for ALL of them:

     for each viewport × each state (no sheet, and each sheet open):
       every visible .dv-launch must have its centre inside the viewport AND
       elementFromPoint(centre) must land on the launcher itself, AND its rect
       must sit fully inside the rail's own box (not clipped by the scroll edge),
       AND it must not intersect any other launcher.

   It also records which compaction rung the rail chose, so a red result names
   the layout that produced it.

   The world is put into the same preconditions verify-one-sheet.js uses (a named,
   buildable world with one lantern) so the conditional launchers are present —
   the harder, fuller rail. Pointer is the default (fine) pointer, as in the
   sibling verifier; pass COARSE=1 to emulate touch.

   USAGE   node scripts/verify-rail-reach.js
           VIEWPORTS=375x812,320x568 node scripts/verify-rail-reach.js
           NO_SCROLL_REACH=1 …   negative control: scroll-to-reveal not counted
           BREAK_SCROLL=1 …      negative control: rail forced overflow:hidden
   EXITS   0 = every launcher reachable · 1 = violations · 2 = harness fault
*/
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');
const ROOT = path.resolve(__dirname, '..');

const VIEWPORTS = (process.env.VIEWPORTS ||
  '320x568,320x812,375x667,375x812,768x1024,1280x800,1920x1080')
  .split(',').map(s => s.trim().split('x').map(Number)).filter(v => v[0] && v[1]);
const COARSE = process.env.COARSE === '1';

const SURFACES = [
  ['warp', () => window.DirverseHUD.open()],
  ['agent', () => window.DirverseHUD.openAgent()],
  ['court', () => window.VintCourt.open()],
  ['traces', () => window.VintTraces.open()],
  ['concord', () => window.VintConcord.open()],
  ['admiralty', () => window.VintAdmiralty.open()],
  ['arcade', () => window.VintArcade.open()],
];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

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

// settle: nothing animating anywhere in the document for 3 consecutive frames,
// then force a synchronous relayout so the rail has measured the final sheet.
const SETTLE = () => new Promise(resolve => {
  const deadline = performance.now() + 15000;
  let quiet = 0;
  const tick = () => {
    const busy = document.getAnimations().some(a => a.playState === 'running' &&
      !(a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming().iterations === Infinity));
    quiet = busy ? 0 : quiet + 1;
    if (quiet >= 3 || performance.now() > deadline) {
      try { window.DirverseHUD.relayout && window.DirverseHUD.relayout(); } catch (_) {}
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(quiet >= 3)));
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

const MEASURE = () => {
  const rail = document.getElementById('dvRail');
  const cl = document.body.classList;
  const rung = ['dv-rail-compact', 'dv-rail-tight', 'dv-rail-glyph', 'dv-rail-wrap', 'dv-rail-scrolls']
    .filter(c => cl.contains(c)).map(c => c.replace('dv-rail-', '')).join('+') || 'full';
  const rr = rail.getBoundingClientRect();
  const out = { coarse: matchMedia('(pointer:coarse)').matches, rung, rail: [Math.round(rr.left), Math.round(rr.top), Math.round(rr.right), Math.round(rr.bottom)], bad: [], n: 0 };
  const vw = innerWidth, vh = innerHeight;
  const ls = [...rail.querySelectorAll('.dv-launch')].filter(b => b.offsetParent !== null);
  out.n = ls.length;
  // the narrowest VISIBLE name box, and its text — so a wrap that ellipsizes a
  // name down to nothing is visible in the log, not hidden behind a green tick.
  out.lblMin = null;
  ls.forEach(b => { const l = b.querySelector('.lbl');
    if (!l || getComputedStyle(l).display === 'none') return;
    const wpx = l.getBoundingClientRect().width;
    if (out.lblMin === null || wpx < out.lblMin[0]) out.lblMin = [Math.round(wpx), b.id]; });
  const rects = ls.map(b => b.getBoundingClientRect());
  const clipped = new Set();
  // ── SCROLL-TO-REVEAL IS REACH, WHEN THE RAIL HONESTLY SCROLLS (YH3AS5T) ──
  // 19 launchers cannot be seated on a 320/375 phone at rest: the glyph tier is
  // forbidden on touch (Vinta 2026-09-26) and a labeled 84px column needs ~10
  // rows there. So layoutRail's last rung is a bounded single-column scroll with
  // a top fade (body.dv-rail-scrolls) and the newest launcher pinned in view
  // (605061e). A launcher above the fold of THAT scroller is one swipe away, not
  // dead — but only if all of these hold, and each is checked, not assumed:
  //   1. the rail is a real scrollport (overflow-y auto/scroll, scrollHeight >
  //      clientHeight) AND announces it (body.dv-rail-scrolls → the fade);
  //   2. its visible band holds ≥ 2 launchers, so the swipe is discoverable;
  //   3. writing the RAIL'S OWN scrollTop (never scrollIntoView, which also
  //      scrolls the document — S3U2BDT) brings the launcher fully inside the
  //      rail box, its centre below the 34px fade, inside the viewport, and
  //      elementFromPoint there lands on the launcher itself;
  //   4. the document did not move, and the rail's scrollTop is restored after.
  // Launchers that pass this are counted in `viaScroll` (logged), so a resting
  // state that leans on the scroll is visible in the output, never laundered.
  // NO_SCROLL_REACH=1 disables this (reproduces the old red); BREAK_SCROLL=1 sets
  // the rail to overflow:hidden first, which must make every such launcher fail.
  out.viaScroll = 0;
  const cs0 = getComputedStyle(rail);
  const scrollport = /auto|scroll/.test(cs0.overflowY) && rail.scrollHeight > rail.clientHeight + 1;
  const announced = cl.contains('dv-rail-scrolls');
  const firstH = rects.length ? rects[0].height : 46;
  const discoverable = rail.clientHeight >= 2 * firstH;
  const reveal = (b, name) => {
    if (window.__NO_SCROLL_REACH) return null;
    if (!scrollport) return 'rail is not a scrollport';
    if (!announced) return 'rail scrolls silently (no dv-rail-scrolls fade)';
    if (!discoverable) return `rail band ${rail.clientHeight}px holds < 2 launchers`;
    const saved = rail.scrollTop, sb = rail.style.scrollBehavior, docY = scrollY;
    rail.style.scrollBehavior = 'auto';
    try {
      const a = b.getBoundingClientRect(), c = rail.getBoundingClientRect();
      rail.scrollTop = rail.scrollTop + ((a.top + a.height / 2) - (c.top + c.height / 2));
      const r = b.getBoundingClientRect(), q = rail.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (scrollY !== docY) return 'revealing it scrolled the document';
      if (r.top < q.top - 1 || r.bottom > q.bottom + 1 || r.left < q.left - 1 || r.right > q.right + 1) return 'still clipped after scrolling the rail';
      if (cy < q.top + 34) return 'centre left under the scroll fade';
      if (cx < 0 || cy < 0 || cx > vw || cy > vh) return 'centre off-screen after scrolling the rail';
      const hit = document.elementFromPoint(cx, cy);
      if (!hit || !(hit === b || b.contains(hit))) return `covered by ${hit ? '#' + (hit.id || hit.className || hit.tagName) : 'nothing'} after scrolling the rail`;
      return '';
    } finally { rail.scrollTop = saved; rail.style.scrollBehavior = sb; }
  };
  ls.forEach((b, i) => {
    const r = rects[i];
    const name = b.id || b.getAttribute('aria-label');
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const off = (cx < 0 || cy < 0 || cx > vw || cy > vh);
    const clip = r.top < rr.top - 1 || r.bottom > rr.bottom + 1 || r.left < rr.left - 1 || r.right > rr.right + 1;
    if (off || clip) {
      clipped.add(i);
      const why = reveal(b, name);
      if (why === '') { out.viaScroll++; return; }
      const base = off ? `${name} centre off-screen (${Math.round(cx)},${Math.round(cy)})`
        : `${name} clipped by rail box [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`;
      out.bad.push(why ? `${base} — not reachable by scrolling the rail: ${why}` : base);
      return;
    }
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || !(hit === b || b.contains(hit))) { out.bad.push(`${name} covered by ${hit ? '#' + (hit.id || hit.className || hit.tagName) : 'nothing'}`); return; }
    if (r.width < 44 || r.height < 42) out.bad.push(`${name} target ${Math.round(r.width)}x${Math.round(r.height)} under floor`);
    for (let j = i + 1; j < ls.length; j++) {
      const o = rects[j];
      if (r.left < o.right && o.left < r.right && r.top < o.bottom && o.top < r.bottom) out.bad.push(`${name} INTERSECTS ${ls[j].id}`);
    }
    // identity: something visible must name it (glyph or label), plus an accessible name
    const vis = [...b.querySelectorAll('.gly,.lbl')].some(s => getComputedStyle(s).display !== 'none' && s.textContent.trim());
    if (!vis) out.bad.push(`${name} shows no glyph or label`);
    if (!b.getAttribute('aria-label') && !b.textContent.trim()) out.bad.push(`${name} has no accessible name`);
  });
  // The rail's LAUNCHERS may not share pixels with any other visible fixed
  // element (sheets and the scrim excepted: the hit-test above already proves a
  // sheet never covers a launcher). Reported per launcher so a wider wrap that
  // walks onto a neighbour is named, not averaged away. Elements that ignore the
  // pointer (pe:none readouts) are reported in `soft`, not failed, so a transient
  // readout that only exists in the offline harness is visible without being
  // confused with a control collision.
  out.soft = [];
  const fixed = [...document.querySelectorAll('body *')].filter(el => {
    if (rail.contains(el) || el.closest('.dv-sheet,#ctSheet,#dvTraceSheet,#dvScrim,#dhPanel')) return false;
    const c = getComputedStyle(el);
    if (c.position !== 'fixed' || c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2 && r.width < vw - 2 && r.top < vh && r.bottom > 0;
  });
  fixed.forEach(el => {
    const f = el.getBoundingClientRect();
    const pe = getComputedStyle(el).pointerEvents === 'none';
    rects.forEach((r, i) => {
      // a launcher scrolled outside the rail's box is not painted there (the rail
      // clips it) and is already failed above as unreachable; skip it here.
      if (clipped.has(i)) return;
      if (r.left < f.right && f.left < r.right && r.top < f.bottom && f.top < r.bottom) {
        const msg = `${ls[i].id} OVERLAPS #${el.id || el.className}`;
        (pe ? out.soft : out.bad).push(msg);
      }
    });
  });
  return out;
};

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  let browser;
  for (let i = 0; i < 4 && !browser; i++) {
    try { browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 120000,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] }); }
    catch (e) { await new Promise(r => setTimeout(r, 4000 * (i + 1))); }
  }
  if (!browser) { console.error('chrome would not start'); process.exit(2); }
  const page = await browser.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.setRequestInterception(true);
  page.on('request', req => { const u = req.url();
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return req.continue();
    return req.abort(); });
  if (process.env.NO_SCROLL_REACH === '1') await page.evaluateOnNewDocument(() => { window.__NO_SCROLL_REACH = true; });
  await page.evaluateOnNewDocument(() => {
    const fake = 'verify.' + 'a'.repeat(40) + '.token';
    ['vint_token', 'vintinuum_token', 'token', 'vint_jwt'].forEach(k => { try { localStorage.setItem(k, fake); } catch (_) {} });
    try {
      localStorage.setItem('vint_user', JSON.stringify({ id: 1, email: 'verify@local', name: 'Verify' }));
      localStorage.setItem('vint_onboarded', '1'); localStorage.setItem('vwg_seen', '1');
    } catch (_) {}
  });
  // pointer:coarse is produced by a touch + mobile viewport (puppeteer cannot
  // emulate the `pointer` media feature directly).

  const fails = []; let harness = 0, states = 0;
  for (const [w, h] of VIEWPORTS) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, hasTouch: COARSE, isMobile: COARSE });
    try { await page.goto(`${base}/world.html`, { waitUntil: 'domcontentloaded', timeout: 60000 }); }
    catch (e) { harness++; console.log(`${w}x${h}  load failed`); continue; }
    await page.waitForFunction(() => window.DirverseHUD && window.VintCourt && window.VintTraces
      && window.VintConcord && window.VintAdmiralty && window.VintArcade, { timeout: 20000 }).catch(() => {});
    await page.evaluate(() => {
      try {
        const W = window.VintinuumWorld; if (!W) return;
        W._worldId = 'verify-world'; W._canTrace = true; W._guest = false; W._canBuild = true;
        W._resident = W._resident || { standing: 150, lumen: 200 };
        if (typeof W.traces === 'function') {
          const t = [{ id: 1, who: 'a traveler', words: 'i stood here', glyph: 'lantern', at: Math.floor(Date.now() / 1000), dist: 1 }];
          W.traces = function () { return t; };
        }
        ['VintConcord', 'VintAdmiralty', 'VintTraces'].forEach(k => { try { window[k].refresh(); } catch (_) {} });
      } catch (_) {}
    });
    await page.waitForFunction(() => ['#cnBtn', '#adBtn', '#dvTraceBtn', '#arBtn', '#ctBtn']
      .every(s => { const e = document.querySelector(s); return e && e.getBoundingClientRect().width > 2; }),
      { timeout: 20000 }).catch(() => {});
    await page.evaluate(() => { try { window.DirverseHUD.closeSheets(); } catch (_) {} });
    await page.evaluate(SETTLE);
    const runs = [['(none)', null], ...SURFACES];
    for (const [id, open] of runs) {
      states++;
      await page.evaluate(() => { try { window.DirverseHUD.closeSheets(); } catch (_) {} });
      await page.evaluate(SETTLE);
      if (open) { await page.evaluate(fn => { eval('(' + fn + ')')(); }, open.toString()); await page.evaluate(SETTLE); }
      if (process.env.BREAK_SCROLL === '1') await page.evaluate(() => { const r = document.getElementById('dvRail'); if (r) r.style.overflowY = 'hidden'; });
      const m = await page.evaluate(MEASURE).catch(e => ({ err: e.message }));
      if (m.err) { harness++; console.log(`${w}x${h} ${id}: harness ${m.err}`); continue; }
      const tag = `${w}x${h} ${id.padEnd(9)} rung=${m.rung.padEnd(26)}${m.coarse ? ' coarse' : ''} n=${m.n} rail=${m.rail.join(',')} lblMin=${m.lblMin ? m.lblMin.join('@') : 'glyph'}${m.viaScroll ? ` viaScroll=${m.viaScroll}` : ''}`;
      console.log((m.bad.length ? '✗ ' : '✓ ') + tag + (m.bad.length ? '\n     ' + m.bad.join('\n     ') : '') +
        (m.soft.length ? '\n     (soft, pe:none) ' + m.soft.join('; ') : ''));
      m.bad.forEach(b => fails.push(`${w}x${h} ${id}: ${b}`));
    }
  }
  await browser.close(); srv.close();
  console.log(`\n${states} states, ${fails.length} violations, ${harness} harness faults`);
  process.exit(fails.length ? 1 : harness ? 2 : 0);
})().catch(e => { console.error(e); process.exit(2); });
