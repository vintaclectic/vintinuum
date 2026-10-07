#!/usr/bin/env node
/* verify-rail-saybar-93H6E4T.js — collision proof for task 93H6E4T.
 *
 * Two collisions this proves are gone, measured in headless Chromium against
 * the REAL world.html at five breakpoints:
 *   1. #dvRail (the launcher rail) must END ABOVE #saybar's top edge — the
 *      launchers must never sit on the say input. Root cause was layoutRail
 *      gating its saybar-floor on `say.offsetParent !== null`; #saybar is
 *      position:fixed, for which offsetParent is ALWAYS null, so the floor was
 *      never measured and step 3b borrowed the clearance back down to 8px.
 *   2. #dvToast (bottom-centre) must never overlap #topctl's buttons (which
 *      move to the bottom band on phones).
 *
 * Serves the repo over http (so relative <script>/fetch resolve), loads
 * world.html, waits for DirverseHUD, injects eight launchers (a full rail),
 * forces a long toast, relayouts, and reads getBoundingClientRect for every
 * pair at each breakpoint. Exit 0 iff zero overlaps.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..'); // repo root (vintinuum/)
let puppeteer;
try { puppeteer = require(path.join(process.env.HOME, 'vintinuum-api', 'node_modules', 'puppeteer')); }
catch (_) { puppeteer = require('puppeteer'); }

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
  '.jpg':'image/jpeg', '.woff2':'font/woff2', '.woff':'font/woff', '.ico':'image/x-icon' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/world.html';
      const fp = path.join(ROOT, p);
      if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(fp, (err, buf) => {
        if (err) { res.writeHead(404); return res.end('nf'); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const BREAKPOINTS = [
  { w: 320, h: 568 }, { w: 375, h: 667 }, { w: 768, h: 1024 },
  { w: 1280, h: 800 }, { w: 1920, h: 1080 },
];

function overlap(a, b) {
  if (!a || !b) return 0;
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return Math.round(x) * Math.round(y) > 0 ? { x: Math.round(x), y: Math.round(y) } : 0;
}

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}/world.html`;
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader',
           '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
  let fails = 0;
  const report = [];
  for (const bp of BREAKPOINTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: bp.w, height: bp.h, deviceScaleFactor: 1,
      isMobile: bp.w <= 859, hasTouch: bp.w <= 859 });
    page.on('pageerror', () => {});
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // wait for the HUD module, then build a full rail + a long toast
    await page.waitForFunction('window.DirverseHUD && window.DirverseHUD.addLauncher', { timeout: 15000 });
    const m = await page.evaluate(() => {
      const H = window.DirverseHUD;
      try { H.mount && H.mount(); } catch (_) {}
      // reproduce the SIGNED-IN composition: guestOverlay() hides these write
      // surfaces for a logged-out visitor, but the task's collision is measured
      // with them visible (a real session, build palette closed). Restore them.
      ['saybar','topctl','hint'].forEach(function (id) {
        const n = document.getElementById(id); if (n) n.style.display = '';
      });
      // dismiss any guest doorway so it is not counted as a floor
      try { const inv = document.getElementById('invite'); if (inv) inv.style.display = 'none'; } catch (_) {}
      const glyphs = ['★','◈','♔','⌂','✦','⚒','⚓','⚑'];
      const names = ['star-map','agents','court','dirhaven','found','forge','yard','allegiance'];
      for (let i = 0; i < glyphs.length; i++) {
        try { H.addLauncher('vbtn' + i, names[i], glyphs[i], function () {}); } catch (_) {}
      }
      try { H.toast('A long enough notice to wrap across two or three lines on a narrow phone so its real height is measured'); } catch (_) {}
      try { H.relayout(); } catch (_) {}
      return true;
    });
    // let layout settle (rAF + the relayout's own re-measures)
    await new Promise(r => setTimeout(r, 500));
    // Restore the signed-in composition AND measure in ONE evaluate, so
    // guestOverlay() cannot re-hide the write surfaces in a gap between the two
    // (it fires async during the settle; a separate restore pass raced it).
    const rects = await page.evaluate(() => {
      ['saybar','topctl','hint'].forEach(function (id) {
        const n = document.getElementById(id); if (n) n.style.display = '';
      });
      try { const inv = document.getElementById('invite'); if (inv) inv.style.display = 'none'; } catch (_) {}
      // populate the other bottom-band surfaces so the toast is proven clear of
      // the WHOLE cluster it shares a band with, not just #topctl.
      try {
        const feed = document.getElementById('feed');
        if (feed) { feed.innerHTML = '<div class="utterance user"><span class="who">you</span>hello there friend</div>'
          + '<div class="utterance agent"><span class="who">aria</span>a longer line of speech that wraps across</div>';
          feed.style.opacity = '1'; feed.style.display = ''; }
        const mh = document.getElementById('micHint');
        if (mh) { mh.textContent = 'live · normal range'; mh.classList.add('show'); }
        const mc = document.getElementById('movectl'); if (mc) mc.style.display = 'flex';
      } catch (_) {}
      try { window.DirverseHUD && window.DirverseHUD.relayout(); } catch (_) {}
      const r = (id) => { const el = document.getElementById(id); if (!el) return null;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.02) return null;
        const b = el.getBoundingClientRect();
        return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, w: b.width, h: b.height }; };
      // dock pills (bottom corners) come from VintDock's registry, not fixed ids
      const dock = [];
      try {
        const D = window.VintDock, sl = (D && D._slots) ? D._slots() : [];
        sl.forEach(s => { if (!s || !s.el) return; const c = getComputedStyle(s.el);
          if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return;
          const b = s.el.getBoundingClientRect(); if (b.width < 2 || b.height < 2) return;
          dock.push({ id: (s.el.id || s.corner), left: b.left, top: b.top, right: b.right, bottom: b.bottom }); });
      } catch (_) {}
      return { rail: r('dvRail'), saybar: r('saybar'), toast: r('dvToast'), topctl: r('topctl'),
               feed: r('feed'), micHint: r('micHint'), movectl: r('movectl'), dock,
               vh: window.innerHeight };
    });
    const railSay = overlap(rects.rail, rects.saybar);
    // the rail's bottom must be at or above the saybar's top (allow 0 — touching
    // edges is not overlap, but we want clearance; require rail.bottom <= saybar.top)
    const railBelowSay = rects.rail && rects.saybar && (rects.rail.bottom > rects.saybar.top + 0.5);
    let line = `${bp.w}x${bp.h}: `;
    const probs = [];
    if (rects.rail && rects.saybar) {
      line += `rail[${Math.round(rects.rail.top)}..${Math.round(rects.rail.bottom)}] saybar.top=${Math.round(rects.saybar.top)} `;
      if (railBelowSay || railSay) probs.push(`RAIL×SAYBAR overlap ${JSON.stringify(railSay)||''} (rail.bottom ${Math.round(rects.rail.bottom)} > saybar.top ${Math.round(rects.saybar.top)})`);
    } else {
      line += `rail=${!!rects.rail} saybar=${!!rects.saybar} `;
    }
    if (rects.toast) {
      line += `| toast[${Math.round(rects.toast.top)}..${Math.round(rects.toast.bottom)}] `;
      // the toast must clear EVERY surface it shares the bottom band with
      const neighbours = [['topctl', rects.topctl], ['saybar', rects.saybar],
        ['feed', rects.feed], ['micHint', rects.micHint], ['movectl', rects.movectl]];
      (rects.dock || []).forEach(d => neighbours.push(['dock:' + d.id, d]));
      neighbours.forEach(([nm, box]) => { const o = overlap(rects.toast, box);
        if (o) probs.push(`TOAST×${nm} overlap ${JSON.stringify(o)}`); });
    }
    if (probs.length) { fails += probs.length; line += '❌ ' + probs.join('; '); }
    else line += '✓';
    report.push(line);
    await page.close();
  }
  await browser.close();
  srv.close();
  console.log('\n=== verify-rail-saybar-93H6E4T ===');
  report.forEach(l => console.log('  ' + l));
  console.log(fails === 0 ? '\nPASS — no rail/saybar or toast/topctl overlaps at any breakpoint\n'
                          : `\nFAIL — ${fails} overlap(s)\n`);
  process.exit(fails === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
