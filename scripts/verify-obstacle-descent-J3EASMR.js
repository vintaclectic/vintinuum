#!/usr/bin/env node
/* verify-obstacle-descent-J3EASMR.js — THE PROOF that economy-map.js's obstacle
 * scan is no longer blind to a transparent fixed CONTAINER whose painted
 * CHILDREN do the work.
 * ────────────────────────────────────────────────────────────────────────────
 * THE DEFECT, MEASURED ON HEAD (1a7d711) BEFORE THE FIX, signed-in lane
 * (world.html line ~1774 sets inline display:none on #topctl for a GUEST, so
 * only a signed-in visitor has the row at all — which is why every existing
 * sweep, all of which run the guest lane, is structurally blind to this):
 *
 *   375x667  #topctl y489..535 z6, shown=true paints=false -> 3 painted
 *            buttons btnView/btnMic/worldMapButton, ALL THREE in this panel's
 *            columns. Panel floor 540, box reaching y540 — 46px PAST the row.
 *            document.elementFromPoint at the 🗺 pill's centre -> #worldMapCanvas.
 *   393x852  the same burial, panel bottom y725 against #topctl y672..718,
 *            elementFromPoint -> #worldStory.
 *
 * In both the panel was covering the ONLY control that opens and closes it.
 * EF3CRMF made that non-fatal by giving the panel its own ✕; it did not make
 * the floor correct. This does.
 *
 * WHAT IS ASSERTED
 *   A  the split is faithful: visibleObstacle === shownEl && paintsEl, and the
 *      composite is still what panelBand re-checks.
 *   B  the descent fires where it must: #topctl's buttons set the floor at
 *      375x667 / 393x852 / 768x1024, and the 🗺 pill hit-tests to ITSELF.
 *   C  the descent does NOT fire where it must not: #dvRail stays out by name,
 *      and a container rejected for being HIDDEN is never descended into
 *      (opacity is not inherited — a child of an opacity:0 parent reports its
 *      own opacity as 1 and keeps a full rect).
 *   D  nothing that already worked broke: 740x360 still RENDERS its panel
 *      (RCNFBGS) rather than standing down, and 320x568's rail-crushed
 *      stand-down is unchanged.
 *
 * NEGATIVE CONTROLS — each removes one policy and must go RED:
 *   --control-nodescend  restores `if (!visibleObstacle(el, cs)) continue;`
 *                        (the pre-fix scan). Reproduces the measured burial.
 *   --control-rail       empties NO_DESCENT so #dvRail's launchers count.
 *   --control-shown      removes BOTH hidden-parent guards (scan + band).
 *                        Lane F injects an opacity:0 host with a painted child;
 *                        the mutation must yield to this invisible obstacle.
 *
 * NOT A CONTROL, AND SAID SO (the UB8NTTR rule): panelBand's host re-check is
 * a BELT, not the sole guard. scanObstacles re-runs every tick of the 700ms
 * slow beat and every 5th tick of the 80ms fast tail, and a faded-out #topctl
 * is dropped by shownEl() there too — so the worst case without the re-check is
 * MEASURED at ~320ms of staleness during the fast tail and zero after it. A
 * `--control-nohost` could therefore not be made to go red honestly. It is
 * asserted STATICALLY instead (A4), kept because it costs <=3 getComputedStyle
 * calls and makes panelBand's contract independent of scan cadence.
 *
 * No live brain dependency: API responses are stubbed. One page at a time (9SABEEP: two puppeteer
 * harnesses at once manufacture reds indistinguishable from real ones).
 * Exits non-zero on any violation.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');

const NODESCEND = process.argv.includes('--control-nodescend');
const RAIL      = process.argv.includes('--control-rail');
const SHOWN     = process.argv.includes('--control-shown');

const VIEWPORTS = [[320, 568], [375, 667], [393, 852], [740, 360], [768, 1024], [1280, 800], [1920, 1080]]
  .filter(([w]) => !process.env.COLLISION_WIDTH || w === Number(process.env.COLLISION_WIDTH));
if (!VIEWPORTS.length) throw new Error('COLLISION_WIDTH must select an audited width');

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm',
};
const MAPJS = '/body/world/economy-map.js';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = [], checks = 0;
function is(name, ok, got) {
  checks++;
  if (!ok) failures.push(name + (got === undefined ? '' : ' — got ' + got));
}

// ── the controls, applied to the SHIPPED source on the way out of serve() ───
function control(src) {
  if (NODESCEND) {
    const before = src;
    src = src.replace(
      "      if (!shownEl(el, cs)) continue;          // hidden: it AND its children are out\n" +
      "      if (!paintsEl(el, cs)) {                 // a transparent wrapper...\n" +
      "        if (!NO_DESCENT[el.id]) descendInto(el, out, vw, vh);   // ...its children are the paint\n" +
      "        continue;\n" +
      "      }\n",
      "      if (!visibleObstacle(el, cs)) continue;\n");
    if (src === before) throw new Error('--control-nodescend did not apply (anchor drifted)');
  }
  if (RAIL) {
    const before = src;
    src = src.replace('var NO_DESCENT = { dvRail: 1 };', 'var NO_DESCENT = {};');
    if (src === before) throw new Error('--control-rail did not apply (anchor drifted)');
  }
  if (SHOWN) {
    const before = src;
    src = src.replace(
      '      if (!shownEl(el, cs)) continue;          // hidden: it AND its children are out\n',
      '      if (!shownEl(el, cs)) { if (!NO_DESCENT[el.id]) descendInto(el, out, vw, vh); continue; }\n');
    src = src.replace(
      '      if (host && (!host.isConnected || !shownEl(host, getComputedStyle(host)))) continue;',
      '      if (host && !host.isConnected) continue;');
    if (src === before) throw new Error('--control-shown did not apply (anchor drifted)');
  }
  return src;
}

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404).end(); return; }
        if (p === MAPJS) buf = Buffer.from(control(buf.toString()));
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// ── the stubbed brain ───────────────────────────────────────────────────────
const PARCELS = (() => {
  const t = []; for (let i = 0; i < 64 * 64; i++) t.push('feorw'[i % 5]);
  return { w: 64, h: 64, terrain: t.join(''), claims: [{ x: 3, y: 4 }] };
})();
const PER = [0, 1, 2, 3, 4].map((i) => ({
  id: 'a' + i, name: ['Ember', 'Wren', 'Sol', 'aetherhold', 'helios-design'][i],
  tokens: 5000 - i * 700, turns: i + 1,
}));
const COST = {
  day: '2026-11-13', tokens_today: 28000, token_budget: 2000000, pct_display: 14,
  status: 'running', attributed_tokens: 26800, unattributed_tokens: 1200,
  agents_active: 5, per_agent: PER, top_spenders: PER.slice(0, 5),
};

// ── the page-side probe ─────────────────────────────────────────────────────
function probe() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const panel = document.getElementById('worldMapPanel');
  const cs0 = getComputedStyle(panel);
  const pr = panel.getBoundingClientRect();
  const R = (el) => { const r = el.getBoundingClientRect();
    return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left),
             r: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) }; };
  const inCol = (r) => !(r.right <= pr.left + 1 || r.left >= pr.right - 1);

  const out = {
    vw, vh,
    panel: R(panel),
    base: parseFloat(cs0.getPropertyValue('--wmp-base')),
    top: parseFloat(cs0.getPropertyValue('--wmp-top')),
    floor: parseFloat(cs0.getPropertyValue('--wmp-floor')),
    standdown: panel.hasAttribute('data-standdown'),
    reading: document.body.classList.contains('vw-map-reading'),
    topctlShown: false, topctlPaints: null, topctlKidsInCol: 0, topctl: null,
    railLaunchersInCol: 0, railShown: false,
  };

  // #topctl — the container the card is about
  const tc = document.getElementById('topctl');
  if (tc) {
    const cs = getComputedStyle(tc);
    out.topctlShown = cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) !== 0;
    const ownText = Array.from(tc.childNodes).filter((n) => n.nodeType === 3)
      .map((n) => n.nodeValue).join('').trim();
    out.topctlPaints = !(cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.backgroundImage === 'none' &&
      cs.borderStyle === 'none' && cs.boxShadow === 'none' && !ownText);
    out.topctl = R(tc);
    out.topctlKidsInCol = Array.from(tc.children)
      .filter((k) => { const kr = k.getBoundingClientRect();
        return kr.width > 0 && kr.height > 0 && inCol(kr); }).length;
    // the HIGHEST painted child of #topctl that sits in this panel's columns
    // and below the anchor — the value the floor must equal minus the gutter
    const below = Array.from(tc.children).map((k) => k.getBoundingClientRect())
      .filter((kr) => kr.width > 0 && kr.height > 0 && inCol(kr) && kr.top >= out.base);
    out.topctlFloorSource = below.length ? Math.round(Math.min(...below.map((r) => r.top))) : null;
  }

  // #dvRail — the container that must stay OUT
  const rail = document.getElementById('dvRail');
  if (rail) {
    const cs = getComputedStyle(rail);
    out.railShown = cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) !== 0;
    out.railLaunchersInCol = Array.from(rail.querySelectorAll('.dv-launch'))
      .filter((k) => { const kr = k.getBoundingClientRect();
        return kr.width > 0 && kr.height > 0 && inCol(kr); }).length;
  }

  // REACHABILITY of the 🗺 pill (the control that closes this panel).
  // A rect overlap is not a collision and a rect clearance is not reachability:
  // clip to every scroll ancestor, then hit-test the surviving centre.
  const btn = document.getElementById('worldMapButton');
  if (btn) {
    let r = btn.getBoundingClientRect();
    let box = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    for (let a = btn.parentElement; a && a !== document.body; a = a.parentElement) {
      const acs = getComputedStyle(a);
      if (acs.overflow === 'visible' && acs.overflowX === 'visible' && acs.overflowY === 'visible') continue;
      const ar = a.getBoundingClientRect();
      box = { l: Math.max(box.l, ar.left), t: Math.max(box.t, ar.top),
              r: Math.min(box.r, ar.right), b: Math.min(box.b, ar.bottom) };
    }
    box = { l: Math.max(box.l, 0), t: Math.max(box.t, 0),
            r: Math.min(box.r, vw), b: Math.min(box.b, vh) };
    const cx = Math.round((box.l + box.r) / 2), cy = Math.round((box.t + box.b) / 2);
    const onScreen = box.r - box.l > 1 && box.b - box.t > 1;
    const hit = onScreen ? document.elementFromPoint(cx, cy) : null;
    out.mapButton = {
      rect: R(btn), onScreen,
      own: !!(hit && (hit === btn || btn.contains(hit))),
      hit: hit ? (hit.id || hit.tagName.toLowerCase() + '.' + String(hit.className || '').slice(0, 24)) : null,
    };
  }

  // every VISIBLE fixed pair must still be collision-free (the local sweep)
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
    rects.push({ id: el.id || el.tagName.toLowerCase() + '.' + String(el.className || '').slice(0, 32),
      x: r.left, y: r.top, w: r.width, h: r.height, _el: el });
  }
  out.hits = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a._el.contains(b._el) || b._el.contains(a._el)) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 1 && oy > 1) out.hits.push(a.id + '×' + b.id + ' ' +
        Math.round(ox) + 'x' + Math.round(oy));
    }
  }
  // the panel itself must stay inside the viewport
  out.inViewport = out.standdown ||
    (out.panel.t >= -1 && out.panel.l >= -1 && out.panel.b <= vh + 1 && out.panel.r <= vw + 1);
  return out;
}

// Settle on EVERY fixed/sticky rect, not just the panel's (9SABEEP): a band
// that moves because the panel moved finishes on ITS schedule, not the panel's.
function settleKey() {
  const key = Array.from(document.querySelectorAll('body *')).filter((e) => {
    const c = getComputedStyle(e);
    if (c.position !== 'fixed' && c.position !== 'sticky') return false;
    if (c.display === 'none' || c.visibility === 'hidden') return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }).map((e) => { const r = e.getBoundingClientRect();
    return Math.round(r.x) + ',' + Math.round(r.y) + ',' + Math.round(r.width) + ',' + Math.round(r.height);
  }).sort().join('|');
  const n = (window.__jKey === key) ? (window.__jN || 0) + 1 : 0;
  window.__jKey = key; window.__jN = n;
  return n >= 4;
}

(async () => {
  // ── A. STATIC: the split is faithful and the exclusions are named ─────────
  const src = fs.readFileSync(path.join(ROOT, MAPJS.slice(1)), 'utf8');
  // strip OWN-LINE comments only — a naive /\*…\*\/ sweep eats whole functions
  // whenever a string contains '*/' (U3VFRJR), and this file is full of prose.
  const code = src.replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*$/gm, '')
                  .replace(/^([ \t]*)\/\/[^\n]*$/gm, '$1');
  is('A1 shownEl() exists and tests only display/visibility/opacity',
    /function shownEl\(el, cs\) \{\s*if \(cs\.display === 'none' \|\| cs\.visibility === 'hidden'\) return false;\s*if \(parseFloat\(cs\.opacity\) === 0\) return false;\s*return true;\s*\}/.test(code));
  is('A2 paintsEl() exists and carries the paint tests',
    /function paintsEl\(el, cs\)/.test(code) && /backgroundColor === 'rgba\(0, 0, 0, 0\)'/.test(code) &&
    code.indexOf('backgroundColor') > code.indexOf('function paintsEl'));
  is('A3 visibleObstacle is exactly shownEl && paintsEl',
    /function visibleObstacle\(el, cs\) \{\s*return shownEl\(el, cs\) && paintsEl\(el, cs\);\s*\}/.test(code));
  is('A4 panelBand re-checks the HOST with shownEl (opacity is not inherited)',
    /if \(host && \(!host\.isConnected \|\| !shownEl\(host, getComputedStyle\(host\)\)\)\) continue;/.test(code));
  is('A5 panelBand re-checks ordinary candidates with the composite predicate',
    /if \(!visibleObstacle\(el, cs\)\) continue;/.test(code));
  is('A6 #dvRail is excluded BY NAME, not by accident',
    /var NO_DESCENT = \{ dvRail: 1 \};/.test(code));
  is('A7 the exclusion is tested BEFORE the child walk (the rail costs 0 reads)',
    /if \(!NO_DESCENT\[el\.id\]\) descendInto\(el, out, vw, vh\);/.test(code));
  is('A8 the descent is ONE level (children, never a recursive walk)',
    /var kids = host\.children/.test(code) && !/descendInto\(kid/.test(code));
  is('A9 the descent is capped and overflow stands the panel down',
    /var DESCENT_CAP = \d+;/.test(code) &&
    /overflow: true/.test(code) && /return \{ top: base, floor: base \}/.test(code));

  // ── B/C/D. BEHAVIOURAL ───────────────────────────────────────────────────
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await puppeteer.launch({ headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader'] });

  for (const [w, h] of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = req.url();
      const json = (o) => req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
      if (u.includes('/api/world/cost')) return json(COST);
      if (u.includes('/api/world/parcels')) return json(PARCELS);
      if (u.includes('/api/world/health')) return json({ economy_tick: 7421 });
      if (u.includes('/api/world/timeline')) return json({ days: [] });
      if (u.includes('/api/world/budget')) return json({ status: 'running', paused: false,
        pct_display: 14, tokens_spent: 280000, token_budget: 2000000 });
      if (/^https?:\/\/(api\.vintaclectic\.com|localhost:8767)/.test(u)) return req.abort('connectionrefused');
      return req.continue();
    });
    if (page.setBypassServiceWorker) await page.setBypassServiceWorker(true);
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    try { await page.goto(base + '/world.html', { waitUntil: 'domcontentloaded', timeout: 30000 }); }
    catch (_) { /* no live brain in a harness; the page still renders */ }
    await sleep(900);
    const ok = await page.evaluate(() => !!document.getElementById('worldMapPanel') &&
      !!document.getElementById('worldMapButton') && !!document.getElementById('topctl'));
    if (!ok) { await page.close().catch(() => {}); throw new Error('world.html loaded without #worldMapPanel / #worldMapButton / #topctl'); }
    try {
      await page.waitForFunction(() => { const i = document.getElementById('invite');
        return i && i.classList.contains('show') && window.DirverseHUD; }, { timeout: 15000 });
    } catch (_) {}

    // THE SIGNED-IN LANE. world.html's guest branch (line ~1774) sets inline
    // display:none on #topctl/#saybar/#movectl/#hint, so a guest has no row at
    // all — which is exactly why every existing sweep is blind to this defect.
    // Restore them and dismiss the doorway: this is the state the card measured.
    await page.evaluate(() => {
      const wd = document.getElementById('inviteWander'); if (wd) wd.click();
      const inv = document.getElementById('invite');
      if (inv) { inv.classList.remove('show'); inv.style.display = 'none'; }
      document.body.classList.remove('vw-doorway');
      ['topctl', 'saybar', 'movectl'].forEach((id) => {
        const n = document.getElementById(id); if (n) n.style.display = '';
      });
      const g = document.getElementById('vwg-pill'); if (g) g.style.display = 'none';
    });
    await sleep(300);

    const lane = `${w}x${h}`;
    const opened = await page.evaluate(() => {
      const p = document.getElementById('worldMapPanel');
      const b = document.getElementById('worldMapButton');
      if (!p.hidden) b.click();
      b.click();
      return !p.hidden;
    });
    is(`[${lane}] B0 the panel opens through its real control`, opened, String(opened));
    try { await page.waitForFunction(settleKey, { timeout: 20000, polling: 150 }); } catch (_) {}
    await sleep(120);
    const r = await page.evaluate(probe);

    // the premise of the whole card, re-measured every run
    is(`[${lane}] B1 #topctl is SHOWN in this lane`, r.topctlShown, String(r.topctlShown));
    is(`[${lane}] B2 #topctl paints NOTHING itself (it is the wrapper)`,
      r.topctlPaints === false, String(r.topctlPaints));
    is(`[${lane}] B3 #topctl offers painted children in its columns`, r.topctlKidsInCol > 0, String(r.topctlKidsInCol));

    // B4 — THE FLOOR. Where #topctl has a painted child in this panel's columns
    // BELOW the anchor, the floor must be that child's top minus the gutter.
    if (r.topctlFloorSource !== null) {
      is(`[${lane}] B4 the floor is set by #topctl's highest in-column child (${r.topctlFloorSource} - 12)`,
        r.floor <= r.topctlFloorSource - 12 + 0.5,
        `floor ${r.floor} vs child top ${r.topctlFloorSource}`);
    } else {
      is(`[${lane}] B4 no #topctl child sits below the anchor in column — floor unconstrained by it`,
        true);
    }
    // B5 — the panel's box never reaches the row
    if (!r.standdown && r.topctl && r.topctlKidsInCol > 0 && r.topctl.t >= r.base) {
      is(`[${lane}] B5 the panel's BOX clears #topctl's row`,
        r.panel.b <= r.topctl.t + 0.5, `panel.b ${r.panel.b} vs topctl.t ${r.topctl.t}`);
    } else { is(`[${lane}] B5 not applicable (stood down / row above the anchor)`, true); }

    // B6 — REACHABILITY, the thing that actually matters
    is(`[${lane}] B6 the 🗺 pill is on screen`, r.mapButton && r.mapButton.onScreen,
      JSON.stringify(r.mapButton));
    is(`[${lane}] B7 the 🗺 pill hit-tests to ITSELF (nothing covers the panel's own toggle)`,
      r.mapButton && r.mapButton.own, r.mapButton ? 'hit=' + r.mapButton.hit : 'no button');

    // C — the exclusions
    is(`[${lane}] C1 #dvRail's launchers are NEVER the floor` +
       ` (${r.railLaunchersInCol} in column, shown=${r.railShown})`,
      !(r.railShown && r.railLaunchersInCol > 0 && r.standdown && w >= 375),
      `standdown=${r.standdown} railInCol=${r.railLaunchersInCol}`);

    // D — nothing that worked broke
    if (w === 740) {
      is(`[${lane}] D1 the landscape panel still RENDERS (RCNFBGS), it does not stand down`,
        !r.standdown, `standdown=${r.standdown} room=${Math.round(r.floor - r.top)}`);
      is(`[${lane}] D2 a HIDDEN container (.vc-panel y95..217, across this band) never set the floor`,
        r.floor > 217, `floor ${r.floor}`);
    }
    is(`[${lane}] D3 no two visible fixed elements overlap`, r.hits.length === 0, r.hits.join('; '));
    is(`[${lane}] D4 the open panel stays inside the viewport`, r.inViewport,
      JSON.stringify(r.panel));
    is(`[${lane}] D5 the panel has usable height or has honestly stood down`,
      r.standdown || r.panel.h >= 100, `h=${r.panel.h} standdown=${r.standdown}`);

    // ── E. THE CAP PATH, EXERCISED (never shipped dormant) ─────────────────
    // More than 12 painted children must trigger a conservative stand-down;
    // a transparent host rect need not contain its overflowing children.
    if (w === 375) {
      const cap = await page.evaluate(() => {
        const p = document.getElementById('worldMapPanel');
        const read = () => parseFloat(getComputedStyle(p).getPropertyValue('--wmp-floor'));
        const pr = p.getBoundingClientRect();
        const before = read();
        const host = document.createElement('div');
        host.id = 'j3Cap';
        // paintless BY CONSTRUCTION: no background, no border, no shadow, and
        // its own childNodes are elements, so paintsEl()'s ownText test is ''.
        host.style.cssText = 'position:fixed;left:' + Math.round(pr.left) + 'px;top:' +
          Math.round(pr.top + 200) + 'px;width:' + Math.round(pr.width) +
          'px;z-index:9;background:transparent;border:none;box-shadow:none;' +
          'display:flex;flex-wrap:nowrap;gap:0;';
        for (let i = 0; i < 13; i++) {
          const k = document.createElement('span');
          k.textContent = 'x';                       // own text => paintsEl() true
          k.style.cssText = 'display:block;width:' + Math.floor(pr.width / 13) + 'px;height:14px;';
          host.appendChild(k);
        }
        document.body.appendChild(host);
        window.__vwCostFit();                        // scanObstacles() + fitPanel()
        const hr = host.getBoundingClientRect();
        const kids = Array.from(host.children).filter((k) => {
          const r2 = k.getBoundingClientRect(); return r2.width > 0 && r2.height > 0; }).length;
        const during = read();
        const standdown = p.hasAttribute('data-standdown');
        host.remove();
        window.__vwCostFit();
        return { hostTop: Math.round(hr.top), kids, before, during, standdown, after: read() };
      });
      is(`[${lane}] E0 the injected container really offers more than the cap (13 > 12)`,
        cap.kids === 13, String(cap.kids));
      is(`[${lane}] E1 cap overflow stands the panel down safely`,
        cap.standdown && cap.during < cap.before - 1,
        `before ${cap.before} during ${cap.during} hostTop ${cap.hostTop} standdown ${cap.standdown}`);
      is(`[${lane}] E2 removing it restores the floor (the fallback is not sticky)`,
        Math.abs(cap.after - cap.before) <= 1.5, `${cap.before} -> ${cap.during} -> ${cap.after}`);
      console.log(`  ${lane}  [cap] 13 kids, host top ${cap.hostTop}: ` +
        `floor ${cap.before} -> ${cap.during} -> ${cap.after}`);
    }

    // ── F. THE OPACITY TRAP, MADE A REAL CONTROL ──────────────────────────
    // OPACITY IS NOT INHERITED: a child of an opacity:0 parent reports its own
    // opacity as 1 and keeps a full-size rect, so a descent that fired on
    // containers rejected for being HIDDEN would resurrect invisible furniture
    // and yield to it. display:none collapses the rect and visibility:hidden IS
    // inherited, so opacity is the ONE hidden mode that can do this — which is
    // why `if (!shownEl(el, cs)) continue;` must come before the descent and
    // must never be relaxed.
    //
    // This lane EXISTS because the shipped page could not prove it. MEASURED:
    // world.html's own paintless-looking hidden container, .vc-panel (the voice
    // console, a real 376x122 rect across this panel's band at 740x360), is
    // reported below as `vcPanelHidden` — and whichever mode it uses, it cannot
    // make --control-shown go red on its own. So the trap is built here
    // deliberately: an opacity:0 fixed container with one painted child sitting
    // in this panel's columns, below the anchor. The fix must IGNORE it; the
    // control must yield to it.
    if (w === 375) {
      const fade = await page.evaluate(() => {
        const p = document.getElementById('worldMapPanel');
        const read = () => parseFloat(getComputedStyle(p).getPropertyValue('--wmp-floor'));
        const pr = p.getBoundingClientRect();
        const before = read();
        const host = document.createElement('div');
        host.id = 'j3Fade';
        host.style.cssText = 'position:fixed;opacity:0;left:' + Math.round(pr.left) + 'px;top:' +
          Math.round(pr.top + 200) + 'px;width:' + Math.round(pr.width) +
          'px;z-index:9;background:#fff;border:none;box-shadow:none;';
        const k = document.createElement('span');
        k.textContent = 'trap';                      // own text => paintsEl() true
        k.style.cssText = 'display:block;width:' + Math.round(pr.width) + 'px;height:40px;';
        host.appendChild(k);
        document.body.appendChild(host);
        window.__vwCostFit();
        const kr = k.getBoundingClientRect();
        const kidOpacity = parseFloat(getComputedStyle(k).opacity);
        const during = read();
        host.remove();
        window.__vwCostFit();
        // what mode does the page's own hidden container actually use?
        const vc = document.querySelector('.vc-panel');
        let vcPanelHidden = 'absent';
        if (vc) { const vs = getComputedStyle(vc);
          vcPanelHidden = vs.display === 'none' ? 'display:none'
            : vs.visibility === 'hidden' ? 'visibility:hidden'
            : parseFloat(vs.opacity) === 0 ? 'opacity:0' : 'shown'; }
        return { before, during, after: read(), kidTop: Math.round(kr.top),
          kidH: Math.round(kr.height), kidOpacity, vcPanelHidden };
      });
      is(`[${lane}] F0 the trap is real: the child of an opacity:0 parent still ` +
         `reports opacity 1 and a full rect`,
        fade.kidOpacity === 1 && fade.kidH === 40, `opacity ${fade.kidOpacity} h ${fade.kidH}`);
      is(`[${lane}] F1 a container hidden by OPACITY is never descended into`,
        Math.abs(fade.during - fade.before) <= 1.5,
        `floor ${fade.before} -> ${fade.during} (trap top ${fade.kidTop})`);
      is(`[${lane}] F2 removing the trap leaves the floor where it was`,
        Math.abs(fade.after - fade.before) <= 1.5, `${fade.before} -> ${fade.after}`);
      console.log(`  ${lane}  [opacity-trap] child top ${fade.kidTop} opacity ${fade.kidOpacity}: ` +
        `floor ${fade.before} -> ${fade.during} -> ${fade.after}  ` +
        `(page's own .vc-panel hides with ${fade.vcPanelHidden})`);
    }

    console.log(`  ${lane}  base ${r.base} top ${r.top} floor ${r.floor} ` +
      `panel ${r.panel.t}..${r.panel.b} standdown=${r.standdown ? 1 : 0} ` +
      `topctl ${r.topctl ? r.topctl.t + '..' + r.topctl.b : '-'} ` +
      `kidsInCol=${r.topctlKidsInCol} railInCol=${r.railLaunchersInCol} ` +
      `pill.own=${r.mapButton ? r.mapButton.own : '-'}${r.mapButton && !r.mapButton.own ? ' hit=' + r.mapButton.hit : ''}`);
    await page.close().catch(() => {});
  }

  await browser.close();
  srv.close();

  const mode = NODESCEND ? ' [--control-nodescend]' : RAIL ? ' [--control-rail]'
    : SHOWN ? ' [--control-shown]' : '';
  if (failures.length) {
    console.log('\nFAILURES:');
    for (const f of failures) console.log('  FAIL ' + f);
  }
  console.log(`\n${checks - failures.length}/${checks} pass${mode}`);
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
