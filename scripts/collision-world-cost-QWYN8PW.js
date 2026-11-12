#!/usr/bin/env node
/* collision-world-cost-QWYN8PW.js — THE PIXEL PROOF for WORLD_SPEC §8's cost
 * panel ("tokens today, spend per agent, top spenders"), Phase 6 item 4.
 * ────────────────────────────────────────────────────────────────────────────
 * The ledger is a SECTION INSIDE #worldMapPanel, so there is no new fixed
 * element to collide with anything. What there IS, is a box that now grows with
 * its content — and a box that grows is exactly how a panel spills past the
 * viewport. So this harness measures, at every breakpoint and in every content
 * state, that:
 *   1. no two VISIBLE fixed elements overlap        (the No-Collision Law)
 *   2. the open panel's rect stays INSIDE the viewport on all four sides
 *   3. no ledger element crosses the panel's CONTENT box horizontally, and the
 *      panel has NO horizontal scroll (growth is vertical and contained)
 *   4. no two ledger block children overlap each other
 *   5. every row is REACHABLE — the last list item can be brought into view by
 *      writing the panel's own scrollTop (never scrollIntoView, which walks up
 *      and scrolls the document too), and hit-tests to itself or a descendant
 *   6. the ledger actually RENDERED (a silent empty pass is not a pass)
 *
 * Content states are driven through the page's REAL renderer against a stubbed
 * /api/world/cost, so a green run proves the shipped render path:
 *   empty        — no spend yet today (the live state on the day this shipped)
 *   normal       — 5 spenders, ordinary names
 *   pathological — 30 spenders, 64-char names, 9-digit token counts, plus the
 *                  unattributed row: the worst box the renderer can produce
 *   unreachable  — the brain answers 500 (the honest empty state)
 *
 * NEGATIVE CONTROL  --control-nocap  strips #worldMapPanel's max-height and
 * overflow-y (the pre-fix CSS) and MUST produce off-viewport / unreachable
 * failures at the small viewports — otherwise a green run proves nothing.
 *
 * Mirrors verify-worldstate-collision-MEF2C4P.js's serve() + probe() semantics.
 * Exits non-zero on any violation.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');

const NOCAP = process.argv.includes('--control-nocap');
// Restore the former clock/toast behavior and pre-dock voice fallback:
// every previously exempt pair must now make the gate red.
const HUD_CONTROL = process.argv.includes('--control-hud');
// --baseline MEASURES the pre-existing collision set of the OPEN map panel, so
// a red here can be attributed to HEAD rather than to this change (NFQ2EU6).
// Run it from a REAL COPY of HEAD, never a symlink:
//   git archive HEAD | tar -x -C /tmp/qwyn-head
//   cp scripts/collision-world-cost-QWYN8PW.js /tmp/qwyn-head/scripts/
//   node /tmp/qwyn-head/scripts/collision-world-cost-QWYN8PW.js --baseline
// It reports and always exits 0: it is a measurement, not a gate.
const BASELINE = process.argv.includes('--baseline');

// 740x360 is the SHORT LANDSCAPE lane: the one where a panel at top:214px has
// barely 130px of room, i.e. where an uncapped box must spill.
const VIEWPORTS = [[320, 568], [375, 667], [740, 360], [768, 1024], [1280, 800], [1920, 1080]]
  .filter(([w]) => !process.env.COLLISION_WIDTH || w === Number(process.env.COLLISION_WIDTH));
if (!VIEWPORTS.length) throw new Error('COLLISION_WIDTH must select an audited width');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404).end(); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        if (HUD_CONTROL && p === '/body/voice_console.js') {
          buf = Buffer.from(buf.toString().replace('bottom:calc(124px + env(', 'bottom:calc(14px + env('));
        }
        if (HUD_CONTROL && p === '/body/world/economy-map.js') {
          buf = Buffer.from(buf.toString().replace('if (short && shown)', 'if (false)')
            .replace('var avoid = !!(short && shown);', 'var avoid = false;'));
        }
        if (HUD_CONTROL && p === '/body/world/dirverse-hud.js') {
          buf = Buffer.from(buf.toString().replaceAll('if (toastDoorwayOpen())', 'if (false)')
            .replace('body.vw-doorway #dvToast{visibility:hidden;}', '')
            .replace(' width:min(90vw,340px);max-width:', ' max-width:'));
        }
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// ── the stubbed brain ───────────────────────────────────────────────────────
const LONG = 'aetherhold-the-world-forger-of-the-vintinuum-council-xx';  // 54
function agents(n, longNames) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      id: 'agent_' + i,
      name: longNames ? (LONG + '-' + i).slice(0, 64) : ['Ember', 'Wren', 'Sol', 'aetherhold', 'helios-design'][i % 5],
      tokens: longNames ? 987654321 - i : (5000 - i * 700),
      turns: longNames ? 123456789 : (i + 1),
    });
  }
  return out;
}
function costBody(state) {
  if (state === 'empty') {
    return { day: '2026-11-04', tokens_today: 0, token_budget: 2000000, pct_display: 0,
      status: 'running', attributed_tokens: 0, unattributed_tokens: 0, agents_active: 0,
      per_agent: [], top_spenders: [] };
  }
  const longNames = state === 'pathological';
  const per = agents(longNames ? 30 : 5, longNames);
  const attributed = per.reduce((a, r) => a + r.tokens, 0);
  return { day: '2026-11-04', tokens_today: attributed + (longNames ? 456789 : 1200),
    token_budget: 2000000, pct_display: longNames ? 100 : 14, status: 'running',
    attributed_tokens: attributed, unattributed_tokens: longNames ? 456789 : 1200,
    agents_active: per.length, per_agent: per, top_spenders: per.slice(0, 5) };
}
// A real terrain grid, so the map canvas has its true (worst-case) height.
const PARCELS = (() => {
  const terrain = []; for (let i = 0; i < 64 * 64; i++) terrain.push('feorw'[i % 5]);
  return { w: 64, h: 64, terrain: terrain.join(''), claims: [{ x: 3, y: 4 }] };
})();

// ── the page-side probe ─────────────────────────────────────────────────────
function probe() {
  const vw = window.innerWidth, vh = window.innerHeight;
  // (1) the byte-identical fixed-overlap probe (verify-no-collision / vigil)
  function visible(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity) === 0) return false;
    const ownText = Array.from(el.childNodes).filter((n) => n.nodeType === 3)
      .map((n) => n.nodeValue).join('').trim();
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

  const panel = document.getElementById('worldMapPanel');
  const cost = document.getElementById('worldCost');
  const R = (el) => { const r = el.getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  if (!panel || panel.hidden || !cost) {
    return { hits, open: false, rendered: false };
  }
  // The panel may be OPEN but STOOD DOWN (no room beside the guest doorway on a
  // short viewport) — that is a collision-free outcome, not a render failure.
  if (panel.hasAttribute('data-standdown') || getComputedStyle(panel).display === 'none'
      || getComputedStyle(panel).visibility === 'hidden') {
    const cs0 = getComputedStyle(panel);
    const base = parseFloat(cs0.getPropertyValue('--wmp-base')) || 214;
    const topV = parseFloat(cs0.getPropertyValue('--wmp-top')) || base;
    const floorV = parseFloat(cs0.getPropertyValue('--wmp-floor')) || vh;
    return { hits, open: true, standdown: true, rendered: false,
      room: Math.round(floorV - topV), floorVar: Math.round(floorV) + 'px' };
  }
  const pr = R(panel);
  const cs = getComputedStyle(panel);
  const px = (v) => parseFloat(v) || 0;
  // The panel's CONTENT box: rect minus border minus padding. Measured, never
  // assumed — a scrollbar also eats from the inline edge, so the right bound
  // uses clientWidth rather than the rect's own right.
  const content = {
    l: pr.l + px(cs.borderLeftWidth) + px(cs.paddingLeft),
    r: pr.l + px(cs.borderLeftWidth) + panel.clientWidth - px(cs.paddingRight),
  };

  // (3) horizontal containment of every ledger element + no horizontal scroll
  const spills = [];
  const kids = Array.from(cost.querySelectorAll('*')).concat([cost]);
  for (const el of kids) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 && r.height <= 0) continue;
    if (r.left < content.l - 1 || r.right > content.r + 1) {
      spills.push({ what: (el.id || el.tagName.toLowerCase() + '.' + String(el.className || '').slice(0, 24)),
        left: Math.round(r.left), right: Math.round(r.right),
        bound: Math.round(content.l) + '..' + Math.round(content.r) });
    }
  }
  const hScroll = panel.scrollWidth - panel.clientWidth;

  // (4) no two ledger BLOCK children overlap (flow layout must stay flow)
  const blocks = Array.from(cost.children).concat(
    Array.from(cost.querySelectorAll('#worldCostTop > li')));
  const inner = [];
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const A = blocks[i], B = blocks[j];
      if (A.contains(B) || B.contains(A)) continue;
      const a = A.getBoundingClientRect(), b = B.getBoundingClientRect();
      if (a.width <= 0 || b.width <= 0 || a.height <= 0 || b.height <= 0) continue;
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 1 && oy > 1) inner.push({
        a: A.id || A.tagName.toLowerCase() + '.' + String(A.className || '').slice(0, 20),
        b: B.id || B.tagName.toLowerCase() + '.' + String(B.className || '').slice(0, 20),
        overlap: Math.round(ox) + 'x' + Math.round(oy) });
    }
  }

  // (5) REACHABILITY of the last row — write the panel's OWN scrollTop (never
  // scrollIntoView: it walks up every scroll ancestor and scrolls the document
  // too, which is a different bug). A row that needs one swipe is reachable; a
  // row nothing can bring into view is not.
  const lis = Array.from(cost.querySelectorAll('#worldCostTop > li'));
  let reach = null;
  const target = lis.length ? lis[lis.length - 1] : document.getElementById('worldCostTokens');
  if (target) {
    const pRect = panel.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();
    const delta = (tRect.top - pRect.top) - (panel.clientHeight - tRect.height) / 2;
    panel.scrollTop = Math.max(0, Math.min(panel.scrollTop + delta,
      panel.scrollHeight - panel.clientHeight));
    const after = target.getBoundingClientRect();
    // clip to the panel's visible box AND the viewport, then hit-test the centre
    const cl = Math.max(after.left, pRect.left, 0), cr = Math.min(after.right, pRect.right, vw);
    const ct = Math.max(after.top, pRect.top, 0), cb = Math.min(after.bottom, pRect.bottom, vh);
    const okBox = cr - cl > 1 && cb - ct > 1;
    const hit = okBox ? document.elementFromPoint((cl + cr) / 2, (ct + cb) / 2) : null;
    reach = { visible: okBox, own: !!(hit && (hit === target || target.contains(hit) || hit.contains(target))),
      hitId: hit ? (hit.id || hit.tagName.toLowerCase()) : null,
      rect: { t: Math.round(after.top), b: Math.round(after.bottom) } };
    panel.scrollTop = 0;
  }

  const tokText = (document.getElementById('worldCostTokens') || {}).textContent || '';
  return {
    hits, open: true, rendered: true,
    panel: { l: Math.round(pr.l), t: Math.round(pr.t), r: Math.round(pr.r), b: Math.round(pr.b),
      w: Math.round(pr.w), h: Math.round(pr.h) },
    inViewport: pr.t >= -1 && pr.b <= vh + 1 && pr.l >= -1 && pr.r <= vw + 1,
    spills, hScroll: Math.round(hScroll), inner, reach,
    rows: lis.length, tokText: tokText.trim(),
    floorVar: getComputedStyle(panel).getPropertyValue('--wmp-floor').trim(),
    maxH: getComputedStyle(panel).maxHeight,
    sub: (document.getElementById('worldCostSub') || {}).textContent || '',
    scrollable: panel.scrollHeight > panel.clientHeight,
  };
}

// The negative control: strip the containment the fix added, i.e. the CSS this
// panel shipped with BEFORE QWYN8PW capped it.
function stripCap() {
  const s = document.createElement('style');
  s.textContent = '#worldMapPanel{max-height:none !important;overflow-y:visible !important}';
  document.head.appendChild(s);
}
function killTransitions() {
  const s = document.createElement('style');
  s.textContent = '#worldState,#status,.world-cost-bar i,#dvToast{transition:none !important}';
  document.head.appendChild(s);
}

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await puppeteer.launch({ headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    timeout: 120000, protocolTimeout: 180000 });

  const failures = [];
  const limitations = [];
  let checks = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // The last lane DISMISSES the guest doorway first ("just look around", the
  // thing a guest actually taps) and then shows the worst ledger. It is the lane
  // that proves the stand-down is not a DEAD CONTROL: on a short viewport the
  // panel yields to the doorway, and the moment the doorway is gone the panel
  // must come back and be clean. Without this lane, "it stands down" and "the
  // map is broken on a phone" look identical.
  const STATES = ['empty', 'normal', 'pathological', 'unreachable', 'pathological-nodoorway'];

  async function loadPage(w, h) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(30000);
        page.__state = 'normal';
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const u = req.url();
          const json = (body) => req.respond({ status: 200, contentType: 'application/json',
            headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
          // THE SERVICE WORKER MUST NEVER REGISTER HERE. body/welcome-gate.js
          // registers sw.js, and a registered SW answers every same-origin
          // fetch ITSELF — so a stubbed /api/world/cost is never seen by this
          // interceptor and the page reads a synthetic 404. MEASURED: with the
          // SW alive, the ledger rendered "ledger unavailable" at every
          // viewport and an in-page fetch('/api/world/cost') returned 404 with
          // NO intercepted request. Refusing sw.js makes registration fail and
          // the stubs reachable.
          if (/\/sw\.js(\?|$)/.test(u)) return req.respond({ status: 404, body: '' });
          if (u.includes('/api/world/cost')) {
            if (page.__state === 'unreachable') {
              return req.respond({ status: 500, contentType: 'application/json',
                headers: { 'access-control-allow-origin': '*' }, body: '{"error":"down"}' });
            }
            return json(costBody(page.__state.replace('-nodoorway', '')));
          }
          if (u.includes('/api/world/parcels')) return json(PARCELS);
          if (u.includes('/api/world/health')) return json({ economy_tick: 7421 });
          if (u.includes('/api/world/budget')) {
            return json({ status: 'running', paused: false, pause_source: null,
              pct_display: 14, tokens_spent: 280000, token_budget: 2000000 });
          }
          if (/^https?:\/\/(api\.vintaclectic\.com|localhost:8767)/.test(u)) return req.abort('connectionrefused');
          return req.continue();
        });
        // THE SERVICE WORKER MUST BE BYPASSED. MEASURED: with sw.js registered,
        // an in-page fetch('/api/world/cost') returned a synthetic 404 that this
        // interceptor never saw, so every content state rendered "ledger
        // unavailable" and the harness read it as a render bug in the page.
        if (page.setBypassServiceWorker) await page.setBypassServiceWorker(true);
        await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
        try { await page.goto(base + '/world.html', { waitUntil: 'domcontentloaded', timeout: 30000 }); }
        catch (_) { /* no live brain in a harness; the page still renders */ }
        await sleep(900);
        const hasPanel = await page.evaluate(() =>
          !!document.getElementById('worldMapPanel') && !!document.getElementById('worldMapButton'));
        if (!hasPanel) { await page.close().catch(() => {}); throw new Error('world.html loaded without the map panel + button'); }
        await page.waitForFunction(() => {
          const inv = document.getElementById('invite');
          return inv && inv.classList.contains('show') && window.DirverseHUD &&
            ['vintVoice', 'vint-vc-fab', 'vwg-pill'].every(id => {
              const el = document.getElementById(id);
              return el && el.hasAttribute('data-vint-docked');
            });
        }, { timeout: 15000 });
        await page.evaluate(killTransitions);
        if (NOCAP) await page.evaluate(stripCap);
        return page;
      } catch (e) {
        if (attempt === 2) throw e;
        await sleep(1500);
      }
    }
  }

  for (const [w, h] of VIEWPORTS) {
    const page = await loadPage(w, h);
    // Keep a real stream of messages alive across slow software-WebGL renders.
    // Each request uses the production toast API; no synthetic visible node.
    await page.evaluate(() => {
      const send = () => window.DirverseHUD.toast('HNER9E3 latest arrival message');
      send();
      window.__hudToastPulse = setInterval(send, 500);
    });
    // Reproduce the real pre-dock frame using the two shipped CSS fallbacks.
    // They are independent controls, not an ancestor/wrapper pair. Registering
    // vintVoice as an obstacle in its OWN dock column would chase itself upward.
    const fallback = await page.evaluate(() => {
      const a = document.getElementById('vintVoice'), b = document.getElementById('vint-vc-fab');
      const styles = [a.getAttribute('style'), b.getAttribute('style')];
      a.removeAttribute('style'); b.removeAttribute('style');
      const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      const gap = ar.top - br.bottom;
      [a,b].forEach((el,i) => styles[i] === null ? el.removeAttribute('style') : el.setAttribute('style', styles[i]));
      return Math.round(gap);
    });
    checks++;
    if (fallback < 12) failures.push(`[VOICE FALLBACK] ${w}x${h}: ${fallback}px gutter (requires 12px)`);
    for (const state of STATES) {
      page.__state = state;
      // Open the panel through its REAL control, then drive one real refresh.
      // The ledger is BLANKED to a sentinel first, so the wait below is for THIS
      // state's render and never a stale one. MEASURED: a fixed 900ms sleep read
      // the PREVIOUS state's ledger at every viewport — world.html runs a
      // Three.js scene under software WebGL here, so a fixed sleep is not a
      // settle. Wait for the sentinel to clear, then for the box geometry to be
      // STABLE across two reads (the fit beat and #invite's 0.8s rise both move
      // it after the render lands).
      const PENDING = '__QWYN8PW_PENDING__';
      if (state.endsWith('-nodoorway')) {
        await page.evaluate(() => {
          clearInterval(window.__hudToastPulse);
          window.DirverseHUD.toast('HNER9E3 older queued message');
          window.DirverseHUD.toast('HNER9E3 latest queued message');
          document.getElementById('inviteWander').click();
        });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const delivered = await page.evaluate(() => {
          const t = document.getElementById('dvToast');
          return t && t.classList.contains('show') && t.textContent === 'HNER9E3 latest queued message';
        });
        checks++;
        if (!delivered) failures.push(`[TOAST QUEUE] ${w}x${h}: latest deferred message not delivered on collapse`);
        const collapsed = await page.evaluate(probe);
        await page.evaluate(() => {
          window.__hudToastPulse = setInterval(() => window.DirverseHUD.toast('HNER9E3 latest arrival message'), 500);
        });
        checks++;
        if (collapsed.hits.length) failures.push(`[COLLAPSED COLLISION] ${w}x${h}: ` +
          collapsed.hits.map(x => `${x.a}×${x.b} ${x.overlap}`).join('; '));
        await page.evaluate(() => {
          const w = document.getElementById('inviteWander');
          if (w) w.click();
          const inv = document.getElementById('invite');
          if (inv) { inv.classList.remove('show'); inv.style.display = 'none'; }
          document.body.classList.remove('vw-doorway');
        });
        await sleep(400);
      }
      const opened = await page.evaluate((sentinel) => {
        const p = document.getElementById('worldMapPanel');
        const b = document.getElementById('worldMapButton');
        if (!p.hidden) b.click();                  // close first, so each state is a fresh open
        const tok = document.getElementById('worldCostTokens');
        const top = document.getElementById('worldCostTop');
        if (tok) tok.textContent = sentinel;
        if (top) top.innerHTML = '';
        b.click();
        return !p.hidden;
      }, PENDING);
      try {
        await page.waitForFunction((sentinel) => {
          const tok = document.getElementById('worldCostTokens');
          return !!tok && tok.textContent !== sentinel;
        }, { timeout: 15000, polling: 120 }, PENDING);
      } catch (_) { /* reported below as [NOT RENDERED] */ }
      // geometry settle: two equal reads of the panel's box + its stand-down flag
      try {
        await page.waitForFunction(() => {
          const p = document.getElementById('worldMapPanel');
          if (!p) return false;
          const key = Math.round(p.getBoundingClientRect().height) + '|' +
            (p.hasAttribute('data-standdown') ? 1 : 0) + '|' +
            Math.round((document.getElementById('invite') || { getBoundingClientRect: () => ({ top: 0 }) })
              .getBoundingClientRect().top);
          const prev = window.__qwynKey;
          window.__qwynKey = key;
          return prev === key;
        }, { timeout: 15000, polling: 200 });
      } catch (_) {}
      await sleep(120);
      if (state.endsWith('-nodoorway')) {
        // First painted frame, not just steady-state: clear the prior toast,
        // let the dock reclaim the row, then request a fresh SHORT message.
        await page.evaluate(() => {
          clearInterval(window.__hudToastPulse);
          const t = document.getElementById('dvToast');
          if (t) t.classList.remove('show');
        });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.evaluate(() => window.__vwCostFit());
        await page.evaluate(async () => {
          window.DirverseHUD.toast('Hi');
          // MutationObserver queues the dock before this continuation queues
          // our first-frame sample; all callbacks finish before browser paint.
          await Promise.resolve();
          await new Promise(resolve => requestAnimationFrame(resolve));
        });
        const firstFrame = await page.evaluate(probe);
        checks++;
        if (firstFrame.hits.length) failures.push(`[FIRST TOAST FRAME] ${w}x${h}: ` +
          firstFrame.hits.map(x => `${x.a}×${x.b} ${x.overlap}`).join('; '));
        await page.evaluate(() => {
          window.__hudToastPulse = setInterval(() => window.DirverseHUD.toast('HNER9E3 latest arrival message'), 500);
        });
      }
      const tag = `${w}x${h} ${state}`;
      checks++;
      if (!opened) { failures.push(`[NOT OPEN] ${tag}`); continue; }
      const toastState = await page.evaluate(() => {
        const el = document.getElementById('dvToast');
        const cs = el && getComputedStyle(el);
        return !!(el && cs.visibility !== 'hidden' && Number(cs.opacity) > 0);
      });
      checks++;
      if (toastState !== state.endsWith('-nodoorway')) {
        failures.push(`[TOAST] ${tag}: ${toastState ? 'painted over expanded doorway' : 'not delivered after dismissal'}`);
      }
      // The same all-pair gate measures a LIVE toast, never whichever frame of
      // the 2.6s arrival timeout happened to survive software WebGL startup.
      const res = await page.evaluate(probe);

      if (BASELINE) {
        console.log(`  BASELINE ${tag.padEnd(22)} ` + (res.hits.length
          ? res.hits.map((x) => `${x.a}×${x.b} ${x.overlap}`).join('; ')
          : 'clean'));
        continue;
      }
      // HNER9E3: every visible fixed pair gates this surface. No legacy allowlist.
      const ours = res.hits;
      checks++;
      if (ours.length) {
        const collision = `[COLLISION] ${tag}: ` + ours.map((x) => `${x.a}×${x.b} ${x.overlap}`).join('; ');
        failures.push(collision);
        console.log(collision);
      }
      if (res.standdown && state.endsWith('-nodoorway')) {
        // FLIPPED FROM LIMITATION → GATE (card RCNFBGS). QWYN8PW measured that
        // the portrait right-rail panel had only a 62px band at 740x360 and so
        // stood down — correct under the No-Collision Law, but it left the map +
        // ledger unavailable on a landscape phone, and that was logged here as a
        // tolerated LIMITATION. RCNFBGS shipped an actual landscape shape: the
        // panel relocates into the free centre-left band (left:252, right edge
        // capped 12px short of #worldClock, --wmp-base:60) so the SAME band
        // measurement now anchors in a column that CAN fit (173px of room at
        // 740x360). So on a landscape phone the map MUST render with the doorway
        // dismissed — standing down there is now a SHAPE REGRESSION, never an
        // acceptable limitation. The limitation escape hatch is closed for this
        // lane; the DEAD CONTROL gate still guards the other lanes.
        checks++;
        const landscapePhone = h <= 430 && w > h;
        if (landscapePhone) {
          failures.push(`[SHAPE REGRESSION] ${tag}: stands down on a landscape phone with the ` +
            `doorway dismissed (${res.room}px measured) — the RCNFBGS landscape shape is gone; ` +
            `the map + ledger must render in the centre-left band here`);
        } else if (res.room >= 150) {
          failures.push(`[DEAD CONTROL] ${tag}: stands down with the doorway dismissed ` +
            `while ${res.room}px of room was free — the map would be unreachable`);
        } else {
          limitations.push(`  ${tag}: only ${res.room}px of free band — the panel cannot ` +
            `fit this viewport at all (shape, not collision)`);
        }
        continue;
      }
      if (res.standdown) {
        console.log(`  ${tag.padEnd(26)} STOOD DOWN (no room beside the doorway) ` +
          (ours.length ? 'DIRTY' : 'clean'));
        continue;
      }
      checks++;
      if (!res.rendered) { failures.push(`[NOT RENDERED] ${tag}: #worldCost missing`); continue; }
      checks++;
      if (!res.inViewport) failures.push(`[OFF-SCREEN] ${tag}: panel=${JSON.stringify(res.panel)} vh=${h}`);
      checks++;
      if (res.spills.length) failures.push(`[SPILL] ${tag}: ` +
        res.spills.slice(0, 3).map((s) => `${s.what} ${s.left}..${s.right} outside ${s.bound}`).join('; '));
      checks++;
      if (res.hScroll > 1) failures.push(`[H-SCROLL] ${tag}: ${res.hScroll}px of horizontal overflow`);
      checks++;
      if (res.inner.length) failures.push(`[INNER OVERLAP] ${tag}: ` +
        res.inner.map((x) => `${x.a}×${x.b} ${x.overlap}`).join('; '));
      checks++;
      if (!res.reach || !res.reach.visible)
        failures.push(`[UNREACHABLE] ${tag}: last row cannot be brought into view ${JSON.stringify(res.reach)}`);
      checks++;
      if (res.reach && res.reach.visible && !res.reach.own)
        failures.push(`[BURIED] ${tag}: last row hit-tests to ${res.reach.hitId}`);
      // the ledger must actually say something — a silent empty pass is no pass
      checks++;
      if (state === 'unreachable') {
        if (!/unavailable/.test(res.sub))
          failures.push(`[NO EMPTY STATE] ${tag}: sub=${JSON.stringify(res.sub)}`);
      } else if (!/\d/.test(res.tokText) || !res.tokText.includes('/')) {
        failures.push(`[NOT RENDERED] ${tag}: tokens="${res.tokText}"`);
      }
      checks++;
      const wantRows = (state === 'empty' || state === 'unreachable') ? 0 : (state.indexOf('pathological') === 0 ? 31 : 6);
      //                                      all spenders + the unattributed row
      if (res.rows !== wantRows)
        failures.push(`[ROWS] ${tag}: ${res.rows} rows, expected ${wantRows}`);
      console.log(`  ${tag.padEnd(22)} panel ${String(res.panel.h).padStart(4)}px` +
        ` rows ${String(res.rows).padStart(2)}` +
        ` ${res.scrollable ? 'scrolls' : 'fits   '}` +
        ` floor ${String(res.floorVar || '-').padStart(6)}` +
        ` ${ours.length + res.spills.length + res.inner.length === 0 ? 'clean' : 'DIRTY'}`);
    }
    if (w === 320 && !BASELINE) {
      // The tightest viewport legitimately yields the map to a live toast.
      // Prove that is temporary using the real 2.6s expiry (no forced class edit).
      await page.evaluate(() => clearInterval(window.__hudToastPulse));
      await page.waitForFunction(() => {
        const t = document.getElementById('dvToast');
        return t && !t.classList.contains('show');
      }, { timeout: 4000 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.waitForFunction(() => !document.getElementById('worldMapPanel').hasAttribute('data-standdown'), { timeout: 2000 });
      const released = await page.evaluate(probe);
      checks++;
      if (!released.rendered || released.standdown) failures.push('[TOAST RELEASE] 320x568: map did not return after toast expiry');
      checks++;
      if (released.hits.length) failures.push('[TOAST RELEASE COLLISION] 320x568: ' +
        released.hits.map(x => `${x.a}×${x.b} ${x.overlap}`).join('; '));
    }
    await page.close().catch(() => {});
  }

  await browser.close();
  srv.close();

  console.log('\n' + '='.repeat(74));
  if (limitations.length) {
    console.log('MEASURED LIMITATIONS (no overlap, simply no room):');
    limitations.forEach((f) => console.log(f));
    console.log('');
  }
  if (failures.length) {
    console.log('FAILURES:');
    failures.forEach((f) => console.log('  - ' + f));
  }
  if (BASELINE) {
    console.log('BASELINE run — measurement only, no verdict.');
    process.exit(0);
  }
  console.log(`${checks - failures.length}/${checks} pass` +
    (NOCAP || HUD_CONTROL ? '  (negative control active — this run MUST be red)' : ''));
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR:', e); process.exit(2); });
