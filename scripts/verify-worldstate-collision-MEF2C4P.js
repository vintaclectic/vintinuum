#!/usr/bin/env node
/* verify-worldstate-collision-MEF2C4P.js — THE PIXEL PROOF for the world-state
 * indicator (WORLD_SPEC §8: "viewer shows 'world sleeping'").
 * ────────────────────────────────────────────────────────────────────────────
 * The #worldState pill REUSES #status's hard-won free band (shared CSS
 * selectors) and is shown under the EXCLUSIVITY law — while it is up, #status
 * is hidden, so the two share one box and can never overlap each other. This
 * harness proves, at every breakpoint and in both the slowdown and sleeping
 * states:
 *   1. no two VISIBLE fixed elements overlap (the No-Collision Law);
 *   2. the pill is actually shown and has real geometry (not a silent pass);
 *   3. #status is hidden whenever the pill is up (the exclusivity contract);
 *   4. it still holds when the HUD is forced to its TALLEST (ceiling pushed
 *      down to the pill's worst case), which is where #status collisions have
 *      historically appeared.
 * A NEGATIVE CONTROL forces #status visible ALONGSIDE the pill (breaking the
 * exclusivity) and asserts the probe DOES catch the overlap — so a green run of
 * the real test means something.
 *
 * Mirrors verify-vigil-collision.js's serve() + probe() semantics exactly.
 * Exits non-zero on any violation.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');

const WIDTHS = (process.env.VERIFY_WIDTHS || '320,375,740,768,1280,1920')
  .split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean);
const HEIGHTS = { 320: 568, 375: 667, 740: 360, 768: 1024, 1280: 800, 1920: 1080 };

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

// ── byte-identical overlap probe (from verify-no-collision / vigil) ──────────
function probe() {
  const vw = window.innerWidth, vh = window.innerHeight;
  function visible(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity) === 0) return false;
    const ownText = Array.from(el.childNodes).filter(n => n.nodeType === 3)
      .map(n => n.nodeValue).join('').trim();
    if (cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.backgroundImage === 'none' &&
        cs.borderStyle === 'none' && cs.boxShadow === 'none' && !ownText) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 12 && r.height <= 12 && cs.pointerEvents === 'none' &&
        !el.children.length && !el.textContent.trim()) return false;
    const blur = /blur\(\s*([\d.]+)px/.exec(cs.filter);
    const faint = parseFloat(cs.opacity) <= 0.15;
    const behind = (parseInt(cs.zIndex, 10) || 0) <= 0;
    if (cs.pointerEvents === 'none' && behind && !el.textContent.trim() &&
        ((blur && parseFloat(blur[1]) >= 20) || faint)) return false;
    return true;
  }
  const rects = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed') continue;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) continue;
    if (r.width >= vw * 0.9 && r.height >= vh * 0.9) continue;
    rects.push({ id: el.id || '', tag: el.tagName.toLowerCase(),
      cls: String(el.className || '').slice(0, 40),
      x: r.left, y: r.top, w: r.width, h: r.height, _el: el });
  }
  const hits = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a._el.contains(b._el) || b._el.contains(a._el)) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 1 && oy > 1) {
        hits.push({ a: a.id || a.tag + '.' + a.cls, b: b.id || b.tag + '.' + b.cls,
          overlap: Math.round(ox) + 'x' + Math.round(oy) });
      }
    }
  }
  const ws = document.getElementById('worldState');
  const st = document.getElementById('status');
  const wsR = ws ? ws.getBoundingClientRect() : null;
  return {
    hits,
    fixedCount: rects.length,
    wsShown: !!(ws && getComputedStyle(ws).opacity === '1'),
    wsRect: wsR ? { w: Math.round(wsR.width), h: Math.round(wsR.height),
      top: Math.round(wsR.top), bottom: Math.round(wsR.bottom) } : null,
    wsInViewport: wsR ? (wsR.top >= -1 && wsR.bottom <= vh + 1 &&
      wsR.left >= -1 && wsR.right <= vw + 1) : false,
    statusHidden: st ? getComputedStyle(st).visibility === 'hidden' : true,
    wsText: ws ? ws.textContent.trim() : null,
  };
}

// Push the band ceiling to its worst case (tall HUD). The pill's STATE is not
// poked into the DOM here — it is driven through the page's REAL poller
// (window.__vwWorldState.tick) against a budget response stubbed at the network
// layer (see interceptBudget), so a green run proves the shipped apply() path.
// Earlier runs that set classes by hand raced the page's own first poll: its
// 404 from this harness server resolved late and wiped the pill (apply(null)),
// reading as "[NOT SHOWN] + [EXCLUSIVITY]" in whichever lane it landed on.
function setTallHud(tallHud) {
  if (tallHud) {
    // A genuinely TALL HUD (worst case for the pill's band), but never taller
    // than the viewport can hold — a HUD exceeding the screen is a degenerate
    // state the real layout never produces (it squeezes the HUD to fit).
    const hb = Math.min(Math.round(window.innerHeight * 0.5), 380);
    document.documentElement.style.setProperty('--vint-hud-bottom', hb + 'px');
  } else {
    document.documentElement.style.removeProperty('--vint-hud-bottom');
  }
}
// Run one real poll and wait for it to settle.
function pollOnce() { return window.__vwWorldState.tick(); }

// What the stubbed brain answers for each driven state (mirrors the live shape
// of GET /api/world/budget, measured 2026-10-30).
const STUB = {
  running:  { status: 'running',  paused: false, pause_source: null,     pct_display: 12,  tokens_spent: 240000,  token_budget: 2000000 },
  slowdown: { status: 'slowdown', paused: false, pause_source: null,     pct_display: 82,  tokens_spent: 1640000, token_budget: 2000000 },
  sleeping: { status: 'sleeping', paused: true,  pause_source: 'budget', pct_display: 100, tokens_spent: 2000000, token_budget: 2000000 },
};

// The negative control: break exclusivity — show #status at the SAME box while
// the pill is up. The probe MUST then see them overlap.
function breakExclusivity() {
  const st = document.getElementById('status');
  document.body.classList.remove('vw-worldstate'); // un-hide #status
  st.textContent = 'finding the clearing…';
  st.classList.add('show');
}

// Reset #status + HUD between states on the SAME loaded page (reusing one page
// per viewport keeps us well under the target budget that chrome drops at load
// avg ~28 — the N2MJ3P4 flakiness, not a collision). The pill itself is reset by
// polling the 'running' stub, which is the real "world woke up" path.
function resetChrome() {
  document.documentElement.style.removeProperty('--vint-hud-bottom');
  const st = document.getElementById('status');
  if (st) st.classList.remove('show');
}

// The pill/status opacity transition is .6s; a collision probe must read the
// SETTLED geometry, not a mid-fade frame. Kill the opacity transition on both
// so `.show` -> opacity 1 is instant and the probe is deterministic.
function killTransitions() {
  const s = document.createElement('style');
  s.textContent = '#worldState,#status{transition:none !important}';
  document.head.appendChild(s);
}

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  // High council load (load avg ~28) makes Chrome slow to hand back its WS
  // endpoint; a generous launch timeout avoids a false "crashed" under load.
  const browser = await puppeteer.launch({ headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    timeout: 120000, protocolTimeout: 180000 });

  const failures = [];
  let checks = 0;
  const STATES = ['slowdown', 'sleeping'];
  const HUDS = [false, true];
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Load the page once per viewport, with a retry — under load avg ~28 a single
  // goto can lose its target; a second attempt on a fresh page recovers it.
  async function loadPage(w, h) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(30000);
        page.__stub = 'running';
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const u = req.url();
          if (u.includes('/api/world/budget')) {
            req.respond({ status: 200, contentType: 'application/json',
              headers: { 'access-control-allow-origin': '*' },
              body: JSON.stringify(STUB[page.__stub]) });
          } else if (/^https?:\/\/(api\.vintaclectic\.com|localhost:8767)/.test(u)) {
            // every OTHER brain call is refused fast — no live brain in a test
            req.abort('connectionrefused');
          } else {
            req.continue();
          }
        });
        await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
        try { await page.goto(base + '/world.html', { waitUntil: 'domcontentloaded', timeout: 30000 }); }
        catch (_) { /* brain unreachable in harness; the page still renders */ }
        await sleep(900); // layout + HUD settle
        const hasPill = await page.evaluate(() =>
          !!document.getElementById('worldState') && !!(window.__vwWorldState && window.__vwWorldState.tick));
        if (!hasPill) { await page.close().catch(() => {}); throw new Error('world.html loaded without #worldState + its poller hook'); }
        await page.evaluate(killTransitions);
        return page;
      } catch (e) {
        if (attempt === 2) throw e;
        await sleep(1500);
      }
    }
  }

  let controlCaught = 0, controlRun = 0;

  for (const w of WIDTHS) {
    const h = HEIGHTS[w] || 800;
    const page = await loadPage(w, h);
    for (const state of STATES) {
      for (const tallHud of HUDS) {
        page.__stub = 'running';
        await page.evaluate(resetChrome);
        await page.evaluate(pollOnce);           // real "woke up" path clears the pill
        page.__stub = state;
        await page.evaluate(setTallHud, tallHud);
        await page.evaluate(pollOnce);           // real apply() renders the driven state
        await sleep(120);
        const res = await page.evaluate(probe);
        const tag = `${w}x${h} ${state}${tallHud ? ' tallHUD' : ''}`;
        checks++;
        if (res.hits.length) failures.push(`[COLLISION] ${tag}: ` +
          res.hits.map(x => `${x.a}×${x.b} ${x.overlap}`).join('; '));
        checks++;
        if (!res.wsShown) failures.push(`[NOT SHOWN] ${tag}: pill opacity != 1`);
        checks++;
        if (!res.wsRect || res.wsRect.w < 40 || res.wsRect.h < 16)
          failures.push(`[NO GEOMETRY] ${tag}: wsRect=${JSON.stringify(res.wsRect)}`);
        checks++;
        if (!res.wsInViewport)
          failures.push(`[OFF-SCREEN] ${tag}: wsRect=${JSON.stringify(res.wsRect)}`);
        checks++;
        const wantLabel = state === 'sleeping' ? 'world sleeping · budget' : 'world slowing · 82%';
        if (res.wsText !== wantLabel)
          failures.push(`[LABEL] ${tag}: real apply() rendered "${res.wsText}", wanted "${wantLabel}"`);
        checks++;
        if (!res.statusHidden)
          failures.push(`[EXCLUSIVITY] ${tag}: #status not hidden while pill is up`);
      }
    }
    // negative control at 320 and 768 — reuse this viewport's loaded page
    if (w === 320 || w === 768) {
      page.__stub = 'sleeping';
      await page.evaluate(resetChrome);
      await page.evaluate(setTallHud, false);
      await page.evaluate(pollOnce);
      await page.evaluate(breakExclusivity);
      await sleep(120);
      const res = await page.evaluate(probe);
      controlRun++;
      const caught = res.hits.some(x =>
        (x.a === 'status' && x.b === 'worldState') || (x.a === 'worldState' && x.b === 'status'));
      if (caught) controlCaught++;
      else failures.push(`[CONTROL FAILED] ${w}x${h}: forced #status×#worldState overlap NOT detected ` +
        `(hits=${JSON.stringify(res.hits)})`);
    }
    await page.close();
  }

  await browser.close();
  srv.close();

  console.log('\nWORLD-STATE INDICATOR COLLISION PROOF (MEF2C4P)\n');
  console.log(`breakpoints: ${WIDTHS.join(', ')}  |  states: ${STATES.join(', ')} × {default,tallHUD}`);
  console.log(`positive checks run: ${checks}`);
  console.log(`negative control: ${controlCaught}/${controlRun} forced overlaps correctly caught`);
  if (controlRun !== controlCaught)
    failures.push('[CONTROL] not every forced overlap was caught — the probe is not trustworthy');
  if (failures.length) {
    console.log('\nFAILURES:\n' + failures.map(f => '  ✗ ' + f).join('\n'));
    console.log(`\n${failures.length} violation(s).`);
    process.exit(1);
  }
  console.log('\n✓ no collisions in any state/breakpoint; pill shown + in viewport; ' +
    '#status hidden under it; negative control proves the probe catches overlaps.');
  process.exit(0);
})().catch(e => { console.error('verifier crashed:', e); process.exit(2); });
