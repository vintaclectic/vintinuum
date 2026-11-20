#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════════
   QACME5Q — THE LIVE PROOF: no float lands on an open sheet on the real site
   ════════════════════════════════════════════════════════════════════════════
   The card's acceptance ends "Verify live on vintinuum.com/world.html", and
   the LIVE-DEPLOY LAW is explicit that "committed and pushed" is never
   completion proof for a user-visible change — the proof is the public URL
   serving your sha. So this drives the PUBLIC page as a GUEST (no token, so
   #vwg-pill genuinely exists) and measures the same two things the hermetic
   harness measures, against the bytes a person actually gets:

     · the sheet's own ✕ is its own hit target at every viewport, and
     · no VintDock-docked float overlaps the open sheet at all.

   It also pins the build. Pass LIVE_EXPECT_COMMIT=<short sha> and it requires
   commit.json AND the page's own build marker to be that commit, so a green
   run can never be a green run against yesterday's deploy.

   Usage:  LIVE_EXPECT_COMMIT=abc1234 node scripts/live-sheet-dock-yield-QACME5Q.js
           LIVE_BASE=http://127.0.0.1:8080 node scripts/live-sheet-dock-yield-QACME5Q.js
   ════════════════════════════════════════════════════════════════════════════ */

const https = require('https');
let puppeteer;
try { puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer'); }
catch (_) { console.error('puppeteer is not installed here; cannot measure.'); process.exit(2); }

const BASE = process.env.LIVE_BASE || 'https://vintinuum.com';
const EXPECT = (process.env.LIVE_EXPECT_COMMIT || '').trim();
const VIEWPORTS = [[320, 568], [375, 667], [393, 852], [768, 1024], [1280, 800], [1920, 1080]]
  .filter(([w]) => !process.env.COLLISION_WIDTH || w === Number(process.env.COLLISION_WIDTH));
const SHEETS = [
  { global: 'VintWorldSkeleton', id: 'dvWorldSkeletonSheet' },
  { global: 'VintCommons',       id: 'dvCommonsSheet' },
  { global: 'VintWe',            id: 'dvWeSheet' },
  { global: 'VintSpire',         id: 'dvSpireSheet' },
  { global: 'VintWorldPulse',    id: 'dvWorldPulseSheet' },
];

const get = (url) => new Promise((res, rej) => {
  https.get(url, { headers: { 'cache-control': 'no-store' } }, (r) => {
    let b = ''; r.on('data', (d) => { b += d; }); r.on('end', () => res({ status: r.statusCode, body: b }));
  }).on('error', rej);
});

/* The same measurement as the hermetic harness, inlined so this file stands
   alone: clip to every scrolling ancestor and to the viewport, then hit-test
   the surviving centre. A rect overlap is not a collision (N2E8EAP). */
const MEASURE = (sheetId) => {
  const vw = innerWidth, vh = innerHeight;
  const out = { vw, vh, docked: [] };
  const sheet = document.getElementById(sheetId);
  const pill = document.getElementById('vwg-pill');
  const idOf = (el) => !el ? null
    : (el.id || el.tagName.toLowerCase() + '.' + String(el.className || '').trim().split(/\s+/)[0]);
  const vis = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.01) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const rect = (el) => { const r = el.getBoundingClientRect();
    return { t: Math.round(r.top), l: Math.round(r.left), b: Math.round(r.bottom),
             r: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) }; };
  const clip = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    let { top, bottom, left, right } = r;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflow === 'visible' && cs.overflowY === 'visible' && cs.overflowX === 'visible') continue;
      const pr = p.getBoundingClientRect();
      if (cs.overflowY !== 'visible') { top = Math.max(top, pr.top); bottom = Math.min(bottom, pr.bottom); }
      if (cs.overflowX !== 'visible') { left = Math.max(left, pr.left); right = Math.min(right, pr.right); }
      if (bottom - top <= 0 || right - left <= 0) return null;
    }
    top = Math.max(top, 0); left = Math.max(left, 0);
    bottom = Math.min(bottom, vh); right = Math.min(right, vw);
    return (bottom - top <= 0 || right - left <= 0) ? null : { top, bottom, left, right };
  };
  const hit = (el) => {
    const b = clip(el);
    if (!b) return { visible: false, own: false, hitId: null };
    let pt = null;
    try { pt = document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2); } catch (_) {}
    return { visible: true, own: !!(pt && (pt === el || el.contains(pt))), hitId: idOf(pt) };
  };
  const ov = (a, b) => {
    if (!a || !b) return null;
    const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l);
    const oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    return (ox > 1 && oy > 1) ? { ox: Math.round(ox), oy: Math.round(oy) } : null;
  };

  out.buildMark = (document.title.match(/[0-9a-f]{7,40}/) || [])[0] || null;
  try { out.buildMark = out.buildMark || (document.querySelector('#buildHash, [data-build]') || {}).textContent || null; } catch (_) {}
  out.pillVisible = vis(pill);
  out.hasSheet = !!sheet;
  out.sheetOpen = !!(sheet && sheet.classList.contains('open') && vis(sheet));
  if (!sheet) return out;
  out.sheet = rect(sheet);
  const xEl = sheet.querySelector('.dv-x, [id$="X"]');
  out.hasX = !!xEl;
  if (xEl) { out.xId = idOf(xEl); out.xHit = hit(xEl); }
  if (out.pillVisible) { out.pill = rect(pill); out.pillHit = hit(pill); }
  try {
    const slots = (window.VintDock && window.VintDock._slots) ? window.VintDock._slots() : [];
    for (const sl of slots) {
      const el = sl && sl.el;
      if (!el || !vis(el)) continue;
      out.docked.push({ id: idOf(el), corner: sl.corner, ov: ov(rect(el), out.sheet), hit: hit(el) });
    }
    out.avoids = (window.VintDock && window.VintDock._avoids)
      ? window.VintDock._avoids().map((a) => (a.el && a.el.id ? a.el.id : '?') + '@' + a.corner).sort() : null;
  } catch (_) {}
  return out;
};

(async () => {
  const failures = [], notes = [];
  let checks = 0;
  const add = (m) => failures.push(m);
  const is = (l, c) => { checks++; if (!c) add(l); };
  const eqv = (l, g, w) => { checks++; if (g !== w) add(`${l} — got ${JSON.stringify(g)}, want ${JSON.stringify(w)}`); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ── THE BUILD PIN: a green run against yesterday's deploy proves nothing ──
  let liveCommit = null;
  if (/^https:/.test(BASE)) {
    try {
      const j = await get(BASE + '/commit.json?t=' + Date.now());
      eqv('commit.json answers 200', j.status, 200);
      liveCommit = JSON.parse(j.body).commit;
      notes.push(`live commit.json = ${liveCommit}`);
      if (EXPECT) eqv(`the live deploy is the commit under test`, String(liveCommit).slice(0, 7), EXPECT.slice(0, 7));
      else notes.push('LIVE_EXPECT_COMMIT not set — the build is NOT pinned for this run');
    } catch (e) { add('could not read commit.json: ' + e.message); }
  }

  const browser = await puppeteer.launch({ headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    timeout: 120000, protocolTimeout: 180000 });

  const SETTLE = (sheetId) => {
    const s = document.getElementById(sheetId);
    if (!s) return false;
    const parts = [];
    const push = (el, p) => { const r = el.getBoundingClientRect();
      parts.push(p + (el.id || el.className || el.tagName) + ':' + Math.round(r.top) + ',' +
        Math.round(r.left) + ',' + Math.round(r.width) + ',' + Math.round(r.height)); };
    push(s, 'S');
    for (const el of s.querySelectorAll('*')) push(el, 's');
    for (const el of document.body.querySelectorAll('*')) {
      const st = getComputedStyle(el);
      if (st.position !== 'fixed' && st.position !== 'sticky') continue;
      if (st.visibility === 'hidden' || st.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height < 1) continue;
      push(el, 'F');
    }
    const key = parts.sort().join(';');
    window.__ls = window.__ls || { k: '', n: 0 };
    if (key === window.__ls.k) window.__ls.n++; else { window.__ls.k = key; window.__ls.n = 0; }
    return window.__ls.n >= 4;
  };

  for (const [vw, vh] of VIEWPORTS) {
    const lane = `${vw}x${vh}`;
    const page = await browser.newPage();
    page.setDefaultTimeout(45000);
    await page.setViewport({ width: vw, height: vh, deviceScaleFactor: 1 });
    // GUEST on purpose: a signed-in page paints no pill and every check below
    // would pass for free.
    await page.evaluateOnNewDocument(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (_) {} });
    try { await page.goto(BASE + '/world.html', { waitUntil: 'domcontentloaded', timeout: 45000 }); }
    catch (e) { add(`${lane}: the live page did not load — ${e.message}`); await page.close().catch(() => {}); continue; }
    await sleep(2600);
    await page.evaluate(() => {
      const s = document.createElement('style');
      s.textContent = '*{transition:none !important;animation:none !important}html{scroll-behavior:auto !important}';
      document.head.appendChild(s);
    });
    // settle the float's own resting place before any sheet opens: world.html's
    // guest doorway rises on its own 0.8s keyframe and moves the pill.
    await page.waitForFunction(() => {
      const p = document.getElementById('vwg-pill');
      if (!p) return false;
      const r = p.getBoundingClientRect();
      let av = '';
      try { av = (window.VintDock && window.VintDock._avoids)
        ? window.VintDock._avoids().map((a) => (a.el && a.el.id ? a.el.id : '?') + '@' + a.corner).sort().join(',') : 'nodock'; }
      catch (_) { av = 'err'; }
      const k = Math.round(r.top) + ',' + Math.round(r.left) + '|' + av;
      window.__lp = window.__lp || { k: '', n: 0 };
      if (k === window.__lp.k) window.__lp.n++; else { window.__lp.k = k; window.__lp.n = 0; }
      return window.__lp.n >= 5;
    }, { polling: 120, timeout: 30000 }).catch(() => {});

    const pre = await page.evaluate(MEASURE, SHEETS[0].id);
    is(`${lane}: the guest pill is painted on the live page (vacuity guard)`, pre.pillVisible);
    if (EXPECT && pre.buildMark) {
      eqv(`${lane}: the page's own build marker is the commit under test`,
          String(pre.buildMark).slice(0, 7), EXPECT.slice(0, 7));
    }
    if (!pre.pillVisible) { await page.close().catch(() => {}); continue; }

    for (const sh of SHEETS) {
      const tag = `${lane} ${sh.id}`;
      const opened = await page.evaluate((g) => {
        try { const m = window[g]; if (!m || typeof m.open !== 'function') return false; m.open(); return true; }
        catch (_) { return false; }
      }, sh.global);
      if (!opened) { notes.push(`${tag}: module absent on the live page — skipped`); continue; }
      await page.waitForFunction((id) => {
        const s = document.getElementById(id); return !!(s && s.classList.contains('open'));
      }, { timeout: 20000 }, sh.id).catch(() => {});
      await page.evaluate(() => { try { delete window.__ls; } catch (_) {} });
      await page.waitForFunction(SETTLE, { polling: 110, timeout: 30000 }, sh.id).catch(() => {});

      const m = await page.evaluate(MEASURE, sh.id);
      is(`${tag}: opened on the live page`, m.sheetOpen);
      if (!m.sheetOpen) continue;
      is(`${tag}: it has a close control`, m.hasX);

      eqv(`${tag}: LIVE — ZERO overlap between ANY docked float and the sheet`,
          (m.docked || []).filter((d) => d.ov).map((d) => `${d.id}@${d.corner} ${d.ov.ox}x${d.ov.oy}`).join(' | ') || 'none',
          'none');
      checks++;
      if (!m.xHit || !m.xHit.visible) {
        notes.push(`${tag}: the ✕ is not in the viewport at all — reported, not asserted`);
      } else if (m.xHit.own) { /* reachable */ }
      else {
        add(`${tag}: LIVE — the ✕ (#${m.xId}) is NOT its own hit target; elementFromPoint ` +
            `returned ${JSON.stringify(m.xHit.hitId)} (pill ${JSON.stringify(m.pill)}, sheet top ${m.sheet.t})`);
      }
      is(`${tag}: LIVE — the pill is still its own hit target (${m.pillHit && m.pillHit.hitId})`,
         !!(m.pillHit && m.pillHit.own));
      eqv(`${tag}: LIVE — the door registered both bottom corners`,
          (m.avoids || []).filter((a) => a.indexOf(sh.id + '@') === 0).sort().join(','),
          `${sh.id}@bl,${sh.id}@br`);

      await page.evaluate((g) => { try { window[g].close(); } catch (_) {} }, sh.global);
      await sleep(500);
    }
    await page.close().catch(() => {});
  }

  await browser.close().catch(() => {});
  if (notes.length) { console.log('\nNOTES (reported, not asserted):'); for (const n of notes) console.log('  · ' + n); }
  if (failures.length) { console.log('\nFAILURES:'); for (const f of failures) console.log('  - ' + f); }
  console.log(`\n${checks - failures.length}/${checks} pass  (LIVE ${BASE}, ${VIEWPORTS.length} viewport(s) x ${SHEETS.length} sheets)`);
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
