#!/usr/bin/env node
/* verify-pair-float-clear-AZGMUTT.js — THE PROOF FOR AZGMUTT.
   ────────────────────────────────────────────────────────────────────────────
   Discovered while doing N2E8EAP. On the GUEST / unpaired render of phone.html,
   #pairScreen (position:fixed; inset:0; z-index:9999; opaque #050812) is the
   blocking pairing gate. The docked bottom-LEFT float stack
   (#vintVoice / #vint-vc-fab / .vint-status-pill) carries a z-index ABOVE the
   gate, so it paints ON TOP of the pairing card; the card is vertically centred,
   so at some widths it reaches up into the stack's band and a float overlaps a
   pair-screen button (the task report: .vint-status-pill × #pairScanBtn = 2px
   @375px).

   This is a DIFFERENT collision class than JSAX335/N2E8EAP, whose harness only
   measures #vwg-dot / #vwg-pill (the bottom-RIGHT welcome-gate affordances). The
   bottom-LEFT status/voice stack vs. the pair-screen controls was never checked.

   WHAT A COLLISION IS HERE (the N2E8EAP/NFQ2EU6 rule, inverted for "float on top
   of a reachable control"):
     A rect overlap is necessary but not sufficient. The float only COLLIDES if
     it is actually PAINTED on top of the pair-screen control at the overlap
     region — i.e. document.elementFromPoint at the overlap centre returns the
     float (or something inside it), not the control. A float whose z-index sits
     BELOW the opaque gate overlaps the control's rect but is buried behind the
     gate and is not a collision (a float cannot collide with something nobody can
     see). So every overlap is reported with floatOnTop measured directly, and
     ONLY floatOnTop overlaps fail the run.

   WHAT IT ASSERTS, on guest phone.html at 320/375/393/768/1280/1920:
     1. #pairScreen is actually up (display:flex) — else the lane proves nothing.
     2. No docked float (or known bl/br stack member) is painted on top of ANY
        pair-screen control.

   NEGATIVE CONTROL
     --no-fix re-exposes the docked floats over the gate exactly as the pre-fix
     code left them: it removes the data-vint-unpaired attribute the fix sets and
     clears any display:none the fix applied, then re-docks. The run MUST go red
     with a floatOnTop overlap against a #pairScreen control — otherwise this
     harness is not measuring the reported bug.

   USAGE
     node scripts/verify-pair-float-clear-AZGMUTT.js
     node scripts/verify-pair-float-clear-AZGMUTT.js --no-fix     # negative control
     VERIFY_WIDTHS=375 node scripts/verify-pair-float-clear-AZGMUTT.js
*/
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');

const WIDTHS = (process.env.VERIFY_WIDTHS || '320,375,393,768,1280,1920')
  .split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean);

const NO_FIX = process.argv.includes('--no-fix');
const TOKEN_KEYS = ['vint_token', 'soul_auth_token', 'vint_access_token', 'access_token'];

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

/* Settle on LAYOUT QUIET, not the clock — phone.html re-docks at 1200/4000ms. */
async function settle(page) {
  try {
    await page.evaluate(async () => {
      const snap = () => Array.from(document.querySelectorAll('body *'))
        .filter(el => getComputedStyle(el).position === 'fixed')
        .map(el => { const r = el.getBoundingClientRect();
          return `${el.id}:${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`; })
        .join('|');
      const t0 = Date.now();
      let prev = '', stable = 0;
      for (let i = 0; i < 32; i++) {
        await new Promise(r => setTimeout(r, 150));
        const cur = snap();
        stable = (cur === prev) ? stable + 1 : 0;
        prev = cur;
        if (stable >= 2 && Date.now() - t0 >= 3400) break;
      }
    });
  } catch (_) {}
}

/* Runs IN the page. */
function probe() {
  const vis = el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.01) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const nameOf = el => el.id ? '#' + el.id
    : (el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/)[0] : el.tagName.toLowerCase());

  const gate = document.getElementById('pairScreen');
  const gateUp = !!gate && getComputedStyle(gate).display !== 'none';
  const gateZ = gate ? getComputedStyle(gate).zIndex : null;

  // Pair-screen controls (only meaningful while the gate is up).
  const pairControls = gateUp
    ? Array.from(gate.querySelectorAll('button,a[href],input,textarea,select,[role="button"]')).filter(vis)
    : [];

  // Every docked float, PLUS the known bl/br stack members by selector as a belt
  // against a float that paints above the gate before corner_dock stamps
  // data-vint-docked on it.
  const floatSel = '[data-vint-docked],.vint-status-pill,#vintVoice,#vint-vc-fab,#hey-vinta-btn,#vwg-pill';
  const floats = Array.from(document.querySelectorAll(floatSel))
    .filter((el, i, a) => a.indexOf(el) === i)   // dedupe
    .filter(vis);

  const overlaps = [];
  for (const f of floats) {
    const fr = f.getBoundingClientRect();
    for (const c of pairControls) {
      if (f.contains(c) || c.contains(f)) continue;
      const cr = c.getBoundingClientRect();
      if (!hit(fr, cr)) continue;
      const oL = Math.max(fr.left, cr.left), oR = Math.min(fr.right, cr.right);
      const oT = Math.max(fr.top, cr.top),  oB = Math.min(fr.bottom, cr.bottom);
      const ox = oR - oL, oy = oB - oT;
      if (ox <= 0 || oy <= 0) continue;
      let painted = null;
      try { painted = document.elementFromPoint((oL + oR) / 2, (oT + oB) / 2); } catch (_) {}
      const floatOnTop = !!painted && (painted === f || f.contains(painted));
      overlaps.push({
        float: nameOf(f), ctl: nameOf(c), px: Math.round(Math.min(ox, oy)),
        floatZ: getComputedStyle(f).zIndex, floatOnTop,
      });
    }
  }

  return {
    gateUp, gateZ,
    unpairedAttr: document.documentElement.hasAttribute('data-vint-unpaired'),
    floatList: floats.map(f => `${nameOf(f)}@z${getComputedStyle(f).zIndex}`),
    overlaps,
  };
}

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  let browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const failures = [];
  let pass = 0, checks = 0;
  const ok = (cond, label, detail) => {
    checks++;
    if (cond) { pass++; return true; }
    failures.push({ label, detail });
    return false;
  };

  for (const w of WIDTHS) {
    const page = await browser.newPage();
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.setRequestInterception(true);
    page.on('request', req => {
      const u = req.url();
      if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return req.continue();
      return req.abort();
    });
    // Guest: clear every token so #pairScreen shows.
    await page.evaluateOnNewDocument((keys) => {
      try {
        keys.forEach(k => localStorage.removeItem(k));
        localStorage.removeItem('vint_user');
        localStorage.removeItem('vint_refresh_token');
        localStorage.setItem('vwg_seen', '1');
      } catch (_) {}
    }, TOKEN_KEYS);

    await page.setViewport({ width: w, height: 800, deviceScaleFactor: 1 });
    try { await page.goto(`${base}/phone.html`, { waitUntil: 'domcontentloaded', timeout: 20000 }); }
    catch (_) { await page.close(); continue; }
    await settle(page);

    if (NO_FIX) {
      // NEGATIVE CONTROL — revert ONLY the fix: drop the unpaired marker and clear
      // any display:none the fix set on docked floats, then re-dock so they paint
      // over the gate exactly as the pre-fix code left them.
      await page.evaluate(() => {
        document.documentElement.removeAttribute('data-vint-unpaired');
        document.querySelectorAll('[data-vint-docked],.vint-status-pill,#vintVoice,#vint-vc-fab,#hey-vinta-btn,#vwg-pill')
          .forEach(el => { el.style.removeProperty('display'); });
        try { window.VintDock && window.VintDock.reflow(); } catch (_) {}
      });
      await new Promise(r => setTimeout(r, 300));
    }

    try { await page.evaluate(() => window.VintDock && window.VintDock.reflow()); } catch (_) {}
    await new Promise(r => setTimeout(r, 250));

    let r;
    try { r = await page.evaluate(probe); } catch (e) { await page.close(); continue; }
    const label = `phone.html @${w}px guest`;

    ok(r.gateUp, `${label}: #pairScreen is up (display:flex)`, `gateUp=${r.gateUp} gateZ=${r.gateZ}`);

    // THE FIX: while the gate is up, the document is marked unpaired and the CSS
    // rule hides every docked float — the gate owns the screen alone.
    ok(r.unpairedAttr, `${label}: html[data-vint-unpaired] is set while the gate is up`,
       `unpairedAttr=${r.unpairedAttr}`);
    ok(r.floatList.length === 0, `${label}: no docked float is visible over the pairing gate`,
       `still visible: [${r.floatList.join(', ')}]`);

    // DEFENSE (independent of the hide): even if a float were visible, none may be
    // painted on top of a pair-screen control. Guards a future high-z escapee.
    const onTop = r.overlaps.filter(o => o.floatOnTop);
    ok(onTop.length === 0, `${label}: no float painted over a pair-screen control`,
       onTop.map(o => `${o.float}(z${o.floatZ}) × ${o.ctl} (${o.px}px, on top)`).join(', ')
       + `  | floats: [${r.floatList.join(', ')}]`);

    // Diagnostic (never fails): any rect overlap that is NOT painted on top.
    const buried = r.overlaps.filter(o => !o.floatOnTop);
    if (buried.length) {
      console.log(`\n  ℹ ${label}: ${buried.length} rect-overlap(s) BEHIND the gate (not a collision): `
        + buried.map(o => `${o.float}(z${o.floatZ})×${o.ctl} ${o.px}px`).join(', '));
    }
    await page.close();
    process.stdout.write('.');
  }

  await browser.close();
  srv.close();
  console.log('\n');

  if (!failures.length) {
    console.log(`${pass}/${checks} pass — guest phone.html × ${WIDTHS.length} widths (${WIDTHS.join(', ')})`);
    if (NO_FIX) console.log('  [--no-fix CONTROL — this SHOULD have failed]');
    process.exit(NO_FIX ? 1 : 0);
  }

  console.log(`${pass}/${checks} pass\n\nFAILURES:`);
  failures.forEach(f => console.log(`  ✗ ${f.label}${f.detail ? '  — ' + f.detail : ''}`));
  process.exit(NO_FIX ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
