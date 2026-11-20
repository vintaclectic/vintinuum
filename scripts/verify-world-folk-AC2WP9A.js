#!/usr/bin/env node
'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   THE FOLK ON THE MAP — behaviour + collision harness  (task AC2WP9A)

   UNDER TEST: body/world/world-folk-layer.js (the shared citizen store and the
   canvas marker painter) and the two surfaces that consume it —
     · the SKELETON SHEET (#dvWorldSkeletonSheet, world-skeleton.js): the
       #wsCits overlay canvas over the #wsMap terrain, and the #wsFolk roster
       band naming every citizen and WHAT IT IS DOING.
     · the LAND PANEL (#worldMapCanvas, economy-map.js): the same markers
       composited into the canvas that was already there.

   WHY THIS EXISTS. MEASURED 2026-11-17 against api.vintaclectic.com:
   /api/world/citizens answered 200 with 33 citizens, every one carrying
   parcel_x/parcel_y in 0..63 and a last_action, while
   `grep -rln "world/citizens"` over the whole repo returned ZERO files. The
   browser drew a 64x64 terrain map with NOBODY ON IT.

   THE ACTION VOCABULARY IS NOT INVENTED (BJDSVWE). The fixture's verbs are the
   ones the LIVE endpoint actually returned in that same measurement —
   rest, forage, socialize, teach, build, gather, explore — not a set written
   from memory. A fixture that invents an enum validates itself.

   THE DISCIPLINE, carried from the sibling harnesses and the lessons:
     · scroll a band by writing ITS OWN scrollTop, never scrollIntoView, which
       walks up every scroll ancestor and scrolls the document too (S3U2BDT).
     · force scroll-behavior:auto and kill transitions/animations BEFORE
       measuring, or the rect read on the next line is the pre-scroll one
       (S3U2BDT) / the pre-move one (ME67WU5: never measure an animated prop).
     · clip a rect to every scroll ancestor and to the viewport, THEN hit-test
       the centre; a null elementFromPoint means "not in the viewport", never
       "buried" (2BXVQEN, N2E8EAP).
     · settle on a STABLE rect across several frames, keyed on EVERY element the
       checks read — not a fixed sleep and not the subject alone (9SABEEP).
     · exclude position:absolute/fixed from the pairwise overlap set and SAY SO;
       the #wsMap/#wsCits pair is the one authored overlay here (pins over a
       map) and is reported, never silently filtered (N2E8EAP).
     · filter bands on AREA, not the `hidden` attribute: a display:none band
       keeps hidden===false and a 0x0 rect, which reads as a live band (966XX38).
     · a check must assert a VALUE, not a shape — "41 rows came back" is
       satisfied by 41 rows of nothing (UGP7422).

   NEGATIVE CONTROLS — each reverts ONE thing, each ABORTS LOUDLY if its anchor
   drifted (B9HMZN3), and no two of them may produce the same failure set
   (JX6M6BP). Run them all with --controls.
     --control-nofolk     kills the feature at its flag (?folk=0). MEASURED
                          24/24 GREEN, because the harness SKIPS every citizen
                          check behind `if (!CTL.nofolk)`. So it does NOT prove
                          the citizen checks are non-vacuous (--control-nopaint
                          does). What it DOES prove, and why it is kept: the
                          sheet, the terrain and the overlap budget are
                          unharmed with the feature off, and it is the baseline
                          that measured the ✕/#vwg-pill occluder as
                          PRE-EXISTING rather than this slice's.
     --control-nopaint    keeps the flag ON and every check ENABLED, and paints
                          no marker. Owns "no placed citizen is missing from
                          the map", "the overlay actually received ink", the
                          twins, and the label checks: this is the control that
                          proves the marker checks are not vacuous.
     --control-constverb  shows a constant 'still' instead of the verb the
                          server sent. Owns the ACCEPTANCE's own clause —
                          "the action line CHANGES across two world ticks" —
                          i.e. it is the control that proves that check can
                          fail at all.
     --control-nocap      strips .ws-folk's own max-height + overflow-y, i.e.
                          the containment this slice added. 33 rows then grow to
                          their content instead of inward. Owns the band-growth
                          and sheet-overflow checks (MU6GKNH).
     --control-noclamp    removes paintLabel's two clamp lines, so a label is
                          never REPOSITIONED into the box. Owns the corner
                          citizens (0,0)/(63,63), whose labels then hang off
                          the left edge after the right-edge flip.
     --control-nofit      reverts THE FIX this card landed: paintLabel's text
                          truncation. A clamp can only MOVE a box, never shrink
                          one WIDER than the canvas, so it saturates and leaves
                          the box overhanging. Owns the 52-char citizen, and is
                          the control that reproduces the ACTUAL measured bug
                          (261.2px label in a 250px canvas at the 320 lane).
     --control-nofan      removes the cluster fan, so two citizens sharing a
                          parcel paint at identical centres. Owns "every placed
                          citizen has its own distinct marker".
     --control-staticact  serves the SAME action to BOTH tick samples. MEASURED
                          106/106 GREEN, and correctly so: the section-J
                          assertion INVERTS under it, becoming "the roster did
                          NOT invent a change the server never sent". That is a
                          real guard against a fabricated verb, so it is kept
                          — but it is NOT the control that proves the
                          change-detection can fail (--control-constverb is).
   MEASURED CONTROL TALLIES at the 375x667 lane (COLLISION_WIDTH=375), and the
   pairwise diff of their FAILURE SETS — not their tallies, because two runs can
   share a tally while failing on different lanes (J3EASMR), and two controls
   can both go red while testing the SAME thing (JX6M6BP):
     clean 106/106 · nofolk 24/24 · nocap 100/106 · noclamp 100/106
     nofan 104/106 · staticact 106/106 · nofit 104/106 · nopaint 74/90
     constverb 101/106
   No two failure sets are IDENTICAL. One containment is real and is stated
   rather than hidden: nofit's set is a strict SUBSET of noclamp's, because
   cit_long's label fails under both — but for DIFFERENT reasons, which is why
   both are load-bearing. Under nofit the box sits at x=1.0 and is 305.9px wide
   in a 293px canvas (a WIDTH the clamp cannot shrink); under noclamp the same
   label flips left to x=-142.1 (a POSITION the fit cannot correct). Delete
   either one and a real defect stops being caught.
   ════════════════════════════════════════════════════════════════════════════ */

const http = require('http');
const fs = require('fs');
const path = require('path');
// Absolute path, as every sibling harness in this repo does: puppeteer lives in
// the BRAIN's node_modules, and a bare specifier resolves from THIS script's
// directory, which has none (E4CS77Y).
let puppeteer;
try { puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer'); }
catch (_) { console.error('puppeteer is not installed here; cannot measure.'); process.exit(2); }

const ROOT = path.resolve(__dirname, '..');
const A = process.argv.slice(2);
const has = (f) => A.includes(f);
const ALL = has('--controls');
const CTL = {
  nofolk: has('--control-nofolk'),
  nocap: has('--control-nocap'),
  noclamp: has('--control-noclamp'),
  nofit: has('--control-nofit'),
  nopaint: has('--control-nopaint'),
  constverb: has('--control-constverb'),
  nofan: has('--control-nofan'),
  staticact: has('--control-staticact')
};
const ANYCTL = Object.keys(CTL).some((k) => CTL[k]);

const VIEWPORTS = [[320, 568], [375, 667], [393, 852], [768, 1024], [1280, 800], [1920, 1080]]
  .filter(([w]) => {
    if (process.env.COLLISION_WIDTH) return w === Number(process.env.COLLISION_WIDTH);
    if (process.env.COLLISION_WIDTHS) return process.env.COLLISION_WIDTHS.split(',').map(Number).includes(w);
    return true;
  });

// ── THE FIXTURE WORLD ───────────────────────────────────────────────────────
// Terrain: a deterministic 64x64 string over the LIVE legend's five chars
// (measured: {f:flat, e:fertile, o:forest, r:ore, w:water}).
const LEGEND = { f: 'flat', e: 'fertile', o: 'forest', r: 'ore', w: 'water' };
const CHARS = 'feorw';
let terrain = '';
for (let i = 0; i < 64 * 64; i++) terrain += CHARS[(i * 7 + ((i / 64) | 0) * 3) % 5];
const PARCELS = {
  w: 64, h: 64, terrain, legend: LEGEND,
  claims: [{ x: 1, y: 0, owner: 'citizen_ember', occupant: null },
           { x: 2, y: 0, owner: null, occupant: 'citizen_ember' }]
};

// The verbs the LIVE endpoint returned on 2026-11-17. Not invented.
const VERBS = ['rest', 'forage', 'socialize', 'teach', 'build', 'gather', 'explore'];
const PROVIDERS = ['claude', 'gemini', 'openai'];
const BASE_TICK = 16450;

// 33 citizens, matching the live count, plus the edge cases a map must survive:
//   · TWO on the SAME parcel (the cluster fan)
//   · one at (0,0) and one at (63,63)  (label clamping at both corners)
//   · one incapacitated           (a ring, not a disc; 'fallen')
//   · one that has NEVER acted    (last_action null -> 'still', never a borrowed verb)
//   · one UNPLACED (parcel_x null) (in the roster, never painted)
//   · one with a very long name   (ellipsis, never an overflow)
function citizens(sample) {
  const rows = [];
  const push = (o) => rows.push(Object.assign({
    mem_id: rows.length + 1, active: 1, incapacitated: 0,
    energy: 50, food: 50, shelter: 80, social: 60, reputation: 100,
    wallet_balance: 300, memory_count: 1000,
    provider: PROVIDERS[rows.length % 3],
    last_acted_tick: BASE_TICK + sample, last_diary_tick: BASE_TICK - 13
  }, o));

  // the three founders, at the live coordinates measured on 2026-11-17
  push({ id: 'citizen_ember', display_name: 'Ember', parcel_x: 2, parcel_y: 0, last_action: sample ? 'build' : 'teach' });
  push({ id: 'citizen_wren', display_name: 'Wren', parcel_x: 30, parcel_y: 17, last_action: sample ? 'forage' : 'build' });
  push({ id: 'citizen_sol', display_name: 'Sol', parcel_x: 45, parcel_y: 36, last_action: sample ? 'teach' : 'rest' });
  // the corners — label clamping on both axes
  push({ id: 'cit_origin', display_name: 'Origin', parcel_x: 0, parcel_y: 0, last_action: sample ? 'gather' : 'explore' });
  push({ id: 'cit_far', display_name: 'Faredge', parcel_x: 63, parcel_y: 63, last_action: sample ? 'explore' : 'gather' });
  // the cluster — two souls on ONE parcel
  push({ id: 'cit_twin_a', display_name: 'Twin A', parcel_x: 20, parcel_y: 20, last_action: 'socialize' });
  push({ id: 'cit_twin_b', display_name: 'Twin B', parcel_x: 20, parcel_y: 20, last_action: 'socialize' });
  // the fallen
  push({ id: 'cit_fallen', display_name: 'Thrace', parcel_x: 9, parcel_y: 44, last_action: 'rest',
         incapacitated: 1, energy: 0, food: 0, last_acted_tick: BASE_TICK - 80 });
  // never acted
  push({ id: 'cit_newborn', display_name: 'Newborn', parcel_x: 50, parcel_y: 5, last_action: null, last_acted_tick: null });
  // unplaced
  push({ id: 'cit_nowhere', display_name: 'Nowhere', parcel_x: null, parcel_y: null, last_action: 'rest' });
  // the long name
  push({ id: 'cit_long', display_name: 'Bartholomew Vantablack-Ashgrove the Unreasonably Long',
         parcel_x: 33, parcel_y: 51, last_action: sample ? 'socialize' : 'forage' });
  // fill to 33, every one placed and acting
  while (rows.length < 33) {
    const i = rows.length;
    push({ id: 'cit_f' + i, display_name: 'Folk ' + i,
           parcel_x: (i * 11 + 3) % 64, parcel_y: (i * 17 + 5) % 64,
           last_action: VERBS[(i + sample) % VERBS.length] });
  }
  return rows;
}
// The two samples, one world tick apart. --control-staticact collapses them.
const SAMPLE = [citizens(0), citizens(1)];
const CHANGERS = ['citizen_ember', 'citizen_wren', 'citizen_sol', 'cit_origin', 'cit_far', 'cit_long'];

function agentsBody(sample) {
  // the SAME population as /api/world/citizens, in the shape /api/world/agents
  // actually returns (measured): x/y + last_acted_tick, and NO last_action.
  return { agents: SAMPLE[sample].filter((c) => c.parcel_x !== null).map((c) => ({
    id: c.id, name: c.display_name, home_project: 'Vintinuum', talents: ['tend'],
    active: !!c.active, needs: { energy: c.energy, food: c.food, shelter: c.shelter, social: c.social },
    reputation: c.reputation, wallet_cached: c.wallet_balance, x: c.parcel_x, y: c.parcel_y,
    last_acted_tick: c.last_acted_tick })) };
}

// ── CONTROL PATCHES — applied to the served source, aborting if an anchor
//    drifted so a silently-inert control can never report a near-green tally.
const PATCHES = {
  noclamp: {
    file: 'body/world/world-folk-layer.js',
    from: `    bx = Math.max(1, Math.min(geom.w - bw - 1, bx));
    var by = hit.cy - bh / 2;
    by = Math.max(1, Math.min(geom.h - bh - 1, by));`,
    to: `    var by = hit.cy - bh / 2;`
  },
  nofan: {
    file: 'body/world/world-folk-layer.js',
    from: `        if (n > 1) {`,
    to: `        if (false) {`
  },
  // Reverts THE FIX this card landed: paintLabel's text truncation. Anchored
  // on the whole block, because neutering only the condition would leave
  // `bw = Math.min(maxBw, ...)` still capping the BOX that check H measures,
  // and the control would be INERT while looking armed (B9HMZN3).
  // ── WHAT PROVES THE MARKER CHECKS ARE NOT VACUOUS ─────────────────────
  // NOT --control-nofolk: that run came back 24/24 GREEN, because the harness
  // SKIPS every citizen check behind `if (!CTL.nofolk)` — so it never proved
  // the marker checks can fail (UB8NTTR: a green control is a harness bug
  // until proven otherwise). This one keeps the flag ON, the roster band
  // populated and all the checks ENABLED, and simply paints nothing.
  nopaint: {
    file: 'body/world/world-folk-layer.js',
    from: `  function paint(ctx, geom, rows, sel) {
    if (!enabled() || !ctx || !rows || !rows.length) return [];`,
    to: `  function paint(ctx, geom, rows, sel) {
    if (true) return [];
    if (!enabled() || !ctx || !rows || !rows.length) return [];`
  },
  // ── WHAT PROVES "THE ACTION CHANGES ACROSS TWO TICKS" CAN FAIL ────────
  // NOT --control-staticact either: that one serves ONE sample to BOTH ticks
  // and the section-J assertion INVERTS under it (it then checks the roster
  // did NOT invent a change), so it came back 106/106 green. The realistic
  // regression is a roster that shows a CONSTANT placeholder instead of the
  // verb the server sent — which is exactly the state this card found the
  // page in. Then nothing changes between samples and J fires.
  constverb: {
    file: 'body/world/world-skeleton.js',
    from: `    act.textContent = r.incap ? 'fallen' : (r.action || 'still');`,
    to: `    act.textContent = 'still';`
  },
  nofit: {
    file: 'body/world/world-folk-layer.js',
    from: String.raw`    var maxBw = geom.w - 2;                 // 1px of air on each side
    if (tw + chrome > maxBw) {
      var room = maxBw - chrome;
      var cut = text;
      // shortest-first is wrong (a name can be shorter than the ellipsis at a
      // tiny canvas), so shrink from the full string and accept '...' alone as
      // the floor: a label is never allowed to be the thing that overflows.
      while (cut.length > 1 && measure(ctx, cut + '\u2026', fs) > room) cut = cut.slice(0, -1);
      text = (cut.length > 1) ? cut.replace(/[\s\u00b7]+$/, '') + '\u2026' : '\u2026';
      tw = measure(ctx, text, fs);
    }
    var bw = Math.min(maxBw, tw + chrome);`,
    to: `    var bw = tw + chrome;`
  }
};
function served(rel) {
  let src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  for (const k of Object.keys(PATCHES)) {
    if (!CTL[k]) continue;
    const p = PATCHES[k];
    if (p.file !== rel) continue;
    if (src.split(p.from).length - 1 !== 1) {
      console.error(`CONTROL ABORT: --control-${k}'s anchor no longer matches exactly once in ${rel}.`);
      console.error('The control is INERT, so this run\'s tally is NOT evidence. Re-anchor it.');
      process.exit(2);
    }
    src = src.replace(p.from, p.to);
  }
  return src;
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const rel = p.replace(/^\/+/, '');
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); return res.end('no'); }
        const ext = path.extname(file).toLowerCase();
        // the control patches are applied to the JS as it is served, so the
        // working tree is never modified by a control run.
        if (ext === '.js' && ANYCTL) {
          try { buf = Buffer.from(served(rel), 'utf8'); } catch (_) {}
        }
        res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream',
          'cache-control': 'no-store' });
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

function killTransitions() {
  const s = document.createElement('style');
  s.textContent = '*{transition:none !important;animation:none !important}' +
    'html{scroll-behavior:auto !important}';
  document.head.appendChild(s);
}
function stripFolkCap() {
  const s = document.createElement('style');
  s.textContent = '#dvWorldSkeletonSheet .ws-folk{max-height:none !important;' +
    'overflow-y:visible !important;min-height:auto !important}';
  document.head.appendChild(s);
}

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await puppeteer.launch({ headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    timeout: 120000, protocolTimeout: 180000 });

  const failures = [], notes = [];
  let checks = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const add = (m) => failures.push(m);
  const is = (label, cond) => { checks++; if (!cond) add(label); };
  const eqv = (label, got, want) => {
    checks++;
    if (got !== want) add(`${label} — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  };

  async function loadPage(w, h, sample) {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    page.__sample = sample;
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = req.url();
      const json = (body) => req.respond({ status: 200, contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
      // a live service worker would answer same-origin fetches itself and the
      // page would never see a stub (measured in the sibling harness).
      if (/\/sw\.js(\?|$)/.test(u)) return req.respond({ status: 404, body: '' });
      const s = CTL.staticact ? 0 : page.__sample;
      if (u.includes('/api/world/citizens')) return json({ citizens: SAMPLE[s] });
      if (u.includes('/api/world/parcels')) return json(PARCELS);
      if (u.includes('/api/world/economy')) {
        return json({ tick: BASE_TICK + page.__sample, tick_rate_ms: 60000,
          snapshot_every_ticks: 24, snapshot_keep: 14, behind_s: 3, behind_ticks: 0 });
      }
      if (/\/api\/world\/agents?\/[^/?]+/.test(u)) return json({ id: 'citizen_ember', wallet: {}, reputation: 100 });
      if (u.includes('/api/world/agents')) return json(agentsBody(s));
      if (u.includes('/api/world/health')) return json({ economy_tick: BASE_TICK + page.__sample });
      if (u.includes('/api/world/cost')) return json({ day: '2026-11-17', tokens_today: 10, token_budget: 2e6, pct_display: 1, per_agent: [] });
      if (u.includes('/api/world/timeline')) return json({ days: [] });
      if (/^https?:\/\/(api\.vintaclectic\.com|localhost:8767)/.test(u)) return req.abort('connectionrefused');
      return req.continue();
    });
    if (page.setBypassServiceWorker) await page.setBypassServiceWorker(true);
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    const url = base + '/world.html' + (CTL.nofolk ? '?folk=0' : '');
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }); } catch (_) {}
    await sleep(900);
    await page.evaluate(killTransitions);
    if (CTL.nocap) await page.evaluate(stripFolkCap);
    return page;
  }

  // Open the skeleton sheet through the page's OWN api, then wait for a STABLE
  // key over every element the checks read (the sheet's subtree AND the fixed
  // furniture whose rects move when the sheet opens).
  async function openSheet(page) {
    await page.waitForFunction(() => !!window.VintWorldSkeleton, { timeout: 20000 }).catch(() => {});
    await page.evaluate(() => { try { window.VintWorldSkeleton.open(); } catch (_) {} });
    await page.waitForFunction(() => {
      const s = document.getElementById('dvWorldSkeletonSheet');
      return !!(s && s.classList.contains('open'));
    }, { timeout: 20000 }).catch(() => {});
    await page.waitForFunction(() => {
      const s = document.getElementById('dvWorldSkeletonSheet');
      if (!s) return false;
      const parts = [];
      for (const el of s.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        parts.push((el.id || el.className || el.tagName) + ':' +
          Math.round(r.top) + ',' + Math.round(r.left) + ',' +
          Math.round(r.width) + ',' + Math.round(r.height));
      }
      // the fixed furniture moves on its own schedule once the sheet reflows
      // the page, AFTER the sheet's own rect goes quiet (9SABEEP).
      for (const el of document.body.querySelectorAll('*')) {
        const st = getComputedStyle(el);
        if (st.position !== 'fixed' && st.position !== 'sticky') continue;
        if (st.visibility === 'hidden' || st.display === 'none') continue;
        const r = el.getBoundingClientRect();
        if (r.width * r.height < 1) continue;
        parts.push('F' + (el.id || el.tagName) + ':' +
          Math.round(r.top) + ',' + Math.round(r.left) + ',' +
          Math.round(r.width) + ',' + Math.round(r.height));
      }
      const key = parts.sort().join(';');
      window.__sk = window.__sk || { k: '', n: 0 };
      if (key === window.__sk.k) window.__sk.n++; else { window.__sk.k = key; window.__sk.n = 0; }
      return window.__sk.n >= 4;
    }, { polling: 90, timeout: 25000 }).catch(() => {});
  }

  // ── the one in-page measurement ───────────────────────────────────────────
  const MEASURE = () => {
    const vw = innerWidth, vh = innerHeight;
    const sheet = document.getElementById('dvWorldSkeletonSheet');
    const out = { ok: !!sheet, vw, vh };
    if (!sheet) return out;

    const rect = (el) => { const r = el.getBoundingClientRect();
      return { t: r.top, l: r.left, b: r.bottom, r: r.right, w: r.width, h: r.height }; };
    const id = (el) => el.id || (el.tagName.toLowerCase() + '.' + String(el.className || '').trim().split(/\s+/)[0]);

    out.sheet = rect(sheet);
    const map = document.getElementById('wsMap');
    const cits = document.getElementById('wsCits');
    const boxEl = sheet.querySelector('.ws-mapbox');
    out.hasMap = !!map; out.hasCits = !!cits; out.hasBox = !!boxEl;
    out.citsInBox = !!(boxEl && cits && boxEl.contains(cits));
    out.mapInBox = !!(boxEl && map && boxEl.contains(map));
    if (map && cits) {
      const a = map.getBoundingClientRect(), b = cits.getBoundingClientRect();
      out.align = { dt: Math.abs(a.top - b.top), dl: Math.abs(a.left - b.left),
        dw: Math.abs(a.width - b.width), dh: Math.abs(a.height - b.height) };
      out.citsBacking = { w: cits.width, h: cits.height };
    }

    // terrain actually painted? count distinct colours off the 64x64 buffer.
    out.terrainColors = 0;
    try {
      const c = map.getContext('2d');
      const d = c.getImageData(0, 0, map.width, map.height).data;
      const seen = new Set();
      for (let i = 0; i < d.length; i += 4) seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
      out.terrainColors = seen.size;
    } catch (_) {}

    // did the overlay actually get INK? (a transparent overlay is no marker)
    out.citInk = 0;
    try {
      const c = cits.getContext('2d');
      const d = c.getImageData(0, 0, cits.width, cits.height).data;
      let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++;
      out.citInk = n;
    } catch (_) {}

    // the roster — every row's NAME and ACTION, as rendered
    const band = document.getElementById('wsFolk');
    out.hasBand = !!band;
    out.rows = [];
    if (band) {
      out.bandRect = rect(band);
      out.bandScroll = { sh: band.scrollHeight, ch: band.clientHeight,
        sw: band.scrollWidth, cw: band.clientWidth,
        oy: getComputedStyle(band).overflowY, mh: getComputedStyle(band).maxHeight };
      for (const b of band.querySelectorAll('.ws-f')) {
        const nm = b.querySelector('.ws-fname'), ac = b.querySelector('.ws-fact');
        out.rows.push({ id: b.getAttribute('data-cit'),
          name: nm ? nm.textContent : null, action: ac ? ac.textContent : null,
          on: b.classList.contains('on'),
          nameOverflow: nm ? (nm.scrollWidth - nm.clientWidth) : 0 });
      }
    }
    const note = document.getElementById('wsFolkNote');
    const cnt = document.getElementById('wsFolkCount');
    out.folkNote = note ? note.textContent : null;
    out.folkCount = cnt ? cnt.textContent : null;

    // markers, via the surface's own seam
    out.markers = [];
    out.geom = null;
    try { out.markers = window.VintWorldSkeleton.markers() || []; } catch (_) {}
    try { out.geom = window.VintWorldSkeleton.geom(); } catch (_) {}

    // ── OVERFLOW: nothing inside the sheet may leave the sheet's PADDING box,
    //    and nothing may overhang the viewport horizontally. Flow children
    //    only; the two canvases are authored absolute and are checked against
    //    their own .ws-mapbox separately.
    const cs = getComputedStyle(sheet);
    const padL = parseFloat(cs.paddingLeft) || 0, padR = parseFloat(cs.paddingRight) || 0;
    const inner = { l: out.sheet.l + padL, r: out.sheet.r - padR,
      t: out.sheet.t, b: out.sheet.b };
    out.overflow = [];
    out.flow = [];
    const flowEls = [];   // parallel to out.flow; page-local, never serialised

    // ── CLIP BEFORE YOU COMPARE (N2E8EAP) ───────────────────────────────────
    // getBoundingClientRect answers "where WOULD this be", never "where can a
    // person SEE it". A roster row scrolled out of the capped .ws-folk band
    // still reports a full-height rect below the band, which lands on #wsNote
    // and reads as a collision. Clipping each box to every scroll/hidden
    // ancestor's own box (and to the viewport) first is what makes the
    // comparison a statement about pixels a person could actually see.
    const clipBox = (el) => {
      const r = el.getBoundingClientRect();
      let l = r.left, t = r.top, rr = r.right, bb = r.bottom;
      for (let n = el.parentElement; n; n = n.parentElement) {
        const ps = getComputedStyle(n);
        if (!/(auto|scroll|hidden)/.test(ps.overflowY) &&
            !/(auto|scroll|hidden)/.test(ps.overflowX)) continue;
        const nr = n.getBoundingClientRect();
        l = Math.max(l, nr.left); t = Math.max(t, nr.top);
        rr = Math.min(rr, nr.right); bb = Math.min(bb, nr.bottom);
      }
      l = Math.max(l, 0); t = Math.max(t, 0);
      rr = Math.min(rr, vw); bb = Math.min(bb, vh);
      return { l, t, r: rr, b: bb, w: rr - l, h: bb - t };
    };

    for (const el of sheet.querySelectorAll('*')) {
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height < 1) continue;       // area, never the hidden attr
      const abs = (st.position === 'absolute' || st.position === 'fixed');
      if (!abs) {
        const cb = clipBox(el);
        // a box that clips to nothing is not on screen and cannot collide
        if (cb.w > 1 && cb.h > 1) { out.flow.push({ id: id(el), ...cb }); flowEls.push(el); }
      }
      // a scroller's own children legitimately sit outside it while scrolled
      let inScroller = false;
      for (let n = el.parentElement; n && n !== sheet.parentElement; n = n.parentElement) {
        const ps = getComputedStyle(n);
        if (/(auto|scroll)/.test(ps.overflowY) || /(auto|scroll)/.test(ps.overflowX)) { inScroller = true; break; }
      }
      if (inScroller) continue;
      const over = Math.max(0, Math.round(inner.l - r.left)) + Math.max(0, Math.round(r.right - inner.r)) +
                   Math.max(0, Math.round(inner.t - r.top)) + Math.max(0, Math.round(r.bottom - inner.b));
      if (over > 1) out.overflow.push({ id: id(el), over,
        dl: Math.round(inner.l - r.left), dr: Math.round(r.right - inner.r),
        dt: Math.round(inner.t - r.top), db: Math.round(r.bottom - inner.b) });
      if (r.right > vw + 1 || r.left < -1) out.overflow.push({ id: id(el), over: 1, viewportX: true });
    }

    // ── PAIRWISE OVERLAP over FLOW siblings only. Absolute/fixed excluded and
    //    reported, because an authored decoration legitimately sits over its
    //    parent and including it is how a harness fails on correct code.
    out.pairs = [];
    const f = out.flow;
    for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) {
      const a = f[i], b = f[j];
      // ── DOM ANCESTRY, NOT A GEOMETRIC ENCLOSURE TEST ────────────────────
      // A parent legitimately contains its child, and the old test asked that
      // geometrically ("does one box enclose the other?"). A parent that
      // SCROLLS does not enclose its overflowing child, so that test reported
      // real parent-x-child pairs as collisions: MEASURED at every lane,
      // "div.dv-body x div.ws-mapwrap", "div.dv-body x div.ws-mapbox" and
      // "wsFolk x button.ws-f" — 12 failures across 6 lanes x 2 samples, none
      // of them a collision. Ancestry is a DOM fact; ask the DOM.
      if (flowEls[i].contains(flowEls[j]) || flowEls[j].contains(flowEls[i])) continue;
      const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l);
      const oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
      if (ox > 1 && oy > 1) out.pairs.push({ a: a.id, b: b.id, ox: Math.round(ox), oy: Math.round(oy) });
    }
    return out;
  };

  // reachability: scroll each ancestor by its OWN scrollTop, clip, hit-test.
  const REACH = (sel) => {
    const target = document.querySelector(sel);
    if (!target) return null;
    const vw = innerWidth, vh = innerHeight;
    const anc = [];
    for (let n = target.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowY) || /(auto|scroll)/.test(cs.overflowX)) anc.push(n);
      if (n === document.body) break;
    }
    for (const sc of anc) {
      const sr = sc.getBoundingClientRect(), tr = target.getBoundingClientRect();
      const dy = (tr.top - sr.top) - (sc.clientHeight - tr.height) / 2;
      sc.scrollTop = Math.max(0, Math.min(sc.scrollTop + dy, sc.scrollHeight - sc.clientHeight));
      const dx = (tr.left - sr.left) - (sc.clientWidth - tr.width) / 2;
      sc.scrollLeft = Math.max(0, Math.min(sc.scrollLeft + dx, sc.scrollWidth - sc.clientWidth));
    }
    const r = target.getBoundingClientRect();
    let cl = Math.max(r.left, 0), cr = Math.min(r.right, vw);
    let ct = Math.max(r.top, 0), cb = Math.min(r.bottom, vh);
    for (const sc of anc) {
      const sr = sc.getBoundingClientRect();
      cl = Math.max(cl, sr.left); cr = Math.min(cr, sr.right);
      ct = Math.max(ct, sr.top); cb = Math.min(cb, sr.bottom);
    }
    const okBox = cr - cl > 1 && cb - ct > 1;
    const hit = okBox ? document.elementFromPoint((cl + cr) / 2, (ct + cb) / 2) : null;
    return { visible: okBox,
      own: !!(hit && (hit === target || target.contains(hit) || hit.contains(target))),
      hitId: hit ? (hit.id || hit.tagName.toLowerCase() + '.' + String(hit.className || '').slice(0, 24)) : null };
  };

  const PLACED = SAMPLE[0].filter((c) => c.parcel_x !== null);
  const FOLK_N = SAMPLE[0].length;

  // ════ THE SWEEP ══════════════════════════════════════════════════════════
  for (const [vw, vh] of VIEWPORTS) {
    const lane = `${vw}x${vh}`;
    const seen = {};             // id -> action, per tick sample
    for (const sample of [0, 1]) {
      const page = await loadPage(vw, vh, sample);
      try {
        await openSheet(page);
        const m = await page.evaluate(MEASURE);
        const tag = `${lane} tick+${sample}`;

        is(`${tag}: the skeleton sheet opened`, m.ok && m.sheet && m.sheet.h > 20);
        if (!m.ok) { await page.close().catch(() => {}); continue; }

        // ── A. STRUCTURE — the two canvases share one box, exactly ──────────
        is(`${tag}: #wsMap exists`, m.hasMap);
        is(`${tag}: #wsCits (the citizen overlay) exists`, CTL.nofolk ? true : m.hasCits);
        if (m.hasMap && m.hasCits) {
          is(`${tag}: both canvases live inside .ws-mapbox`, m.citsInBox && m.mapInBox);
          const al = m.align || {};
          is(`${tag}: the overlay is pixel-aligned with the terrain ` +
             `(dt${(al.dt || 0).toFixed(2)} dl${(al.dl || 0).toFixed(2)} ` +
             `dw${(al.dw || 0).toFixed(2)} dh${(al.dh || 0).toFixed(2)})`,
             al.dt <= 0.6 && al.dl <= 0.6 && al.dw <= 0.6 && al.dh <= 0.6);
          is(`${tag}: the overlay has a real backing store (${m.citsBacking && m.citsBacking.w}x${m.citsBacking && m.citsBacking.h})`,
             m.citsBacking && m.citsBacking.w > 50 && m.citsBacking.h > 50);
        }

        // ── B. PARCELS STILL RENDER (the acceptance's regression clause) ────
        is(`${tag}: the terrain is still painted (${m.terrainColors} distinct colours, want >=5)`,
           m.terrainColors >= 5);

        // ── C. EVERY PLACED CITIZEN HAS ITS OWN MARKER, AT ITS OWN PARCEL ───
        if (CTL.nofolk) {
          eqv(`${tag}: the flag is off, so NOTHING is painted on the overlay`, m.citInk, 0);
          eqv(`${tag}: the flag is off, so the roster is empty`, m.rows.length, 0);
        } else {
          eqv(`${tag}: one marker per PLACED citizen`, m.markers.length, PLACED.length);
          is(`${tag}: the overlay actually received ink (${m.citInk} opaque px)`, m.citInk > 50);
          // each marker's centre must map back to the parcel the server named.
          const g = m.geom;
          is(`${tag}: the marker geometry is readable`, !!g);
          if (g) {
            const cw = g.w / g.cols, ch = g.h / g.rows;
            const want = {}; for (const c of PLACED) want[c.id] = [c.parcel_x, c.parcel_y];
            let wrong = [], missing = [];
            for (const c of PLACED) if (!m.markers.some((k) => k.id === c.id)) missing.push(c.id);
            for (const k of m.markers) {
              const w2 = want[k.id];
              if (!w2) { wrong.push(k.id + ' is not a placed citizen'); continue; }
              // a fanned cluster member sits within one marker radius of the
              // cell centre, so allow the fan but not a whole cell of drift.
              const ecx = (w2[0] + 0.5) * cw, ecy = (w2[1] + 0.5) * ch;
              const tol = g.r * 1.2 + 1;
              if (Math.abs(k.cx - ecx) > tol || Math.abs(k.cy - ecy) > tol) {
                wrong.push(`${k.id} painted at ${k.cx.toFixed(1)},${k.cy.toFixed(1)} want ~${ecx.toFixed(1)},${ecy.toFixed(1)} (tol ${tol.toFixed(1)})`);
              }
            }
            eqv(`${tag}: no placed citizen is missing from the map`, missing.join(',') || 'none', 'none');
            eqv(`${tag}: every marker sits on its own parcel`, wrong.slice(0, 3).join(' | ') || 'none', 'none');
            // the cluster fan: two citizens on ONE parcel keep DISTINCT centres
            const tw = m.markers.filter((k) => k.id === 'cit_twin_a' || k.id === 'cit_twin_b');
            eqv(`${tag}: both co-located twins have a marker`, tw.length, 2);
            if (tw.length === 2) {
              const d = Math.hypot(tw[0].cx - tw[1].cx, tw[0].cy - tw[1].cy);
              is(`${tag}: the twins' markers are DISTINCT, not stacked (${d.toFixed(2)}px apart, want >=${(g.r * 0.9).toFixed(2)})`,
                 d >= g.r * 0.9);
              eqv(`${tag}: the twins are reported as a cluster of 2`, tw[0].cluster, 2);
            }
          }

          // ── D. THE ROSTER — every citizen, named, with what it is DOING ───
          eqv(`${tag}: one roster row per citizen (placed or not)`, m.rows.length, FOLK_N);
          const byId = {}; for (const r of m.rows) byId[r.id] = r;
          const noName = m.rows.filter((r) => !r.name || !r.name.trim()).map((r) => r.id);
          const noAct = m.rows.filter((r) => !r.action || !r.action.trim()).map((r) => r.id);
          eqv(`${tag}: every row carries a NAME`, noName.join(',') || 'none', 'none');
          eqv(`${tag}: every row carries an ACTION line`, noAct.join(',') || 'none', 'none');
          // VALUES, not shapes (UGP7422): the named citizens' verbs must be the
          // ones the stub served, not a placeholder.
          const srv0 = {}; for (const c of SAMPLE[CTL.staticact ? 0 : sample]) srv0[c.id] = c.last_action;
          const mismatched = [];
          for (const c of PLACED) {
            const row = byId[c.id]; if (!row) { mismatched.push(c.id + ' absent'); continue; }
            const want = c.incapacitated ? 'fallen' : (srv0[c.id] || 'still');
            if (row.action !== want) mismatched.push(`${c.id} shows "${row.action}" want "${want}"`);
          }
          eqv(`${tag}: the action shown is the verb the server sent`, mismatched.slice(0, 3).join(' | ') || 'none', 'none');
          eqv(`${tag}: a citizen that never acted says 'still', never a borrowed verb`,
              byId.cit_newborn && byId.cit_newborn.action, 'still');
          eqv(`${tag}: a fallen citizen says 'fallen'`, byId.cit_fallen && byId.cit_fallen.action, 'fallen');
          is(`${tag}: the UNPLACED citizen is still in the roster`, !!byId.cit_nowhere);
          is(`${tag}: the unplaced citizen is NOT painted on the map`,
             !m.markers.some((k) => k.id === 'cit_nowhere'));
          // the long name ellipsizes rather than overflowing its row
          is(`${tag}: a 52-char name ellipsizes inside its row`,
             byId.cit_long && byId.cit_long.nameOverflow >= 0);
          is(`${tag}: the roster header counts the souls (${JSON.stringify(m.folkNote)})`,
             /\d+ souls? standing/.test(m.folkNote || ''));
          is(`${tag}: the roster header names the tick (${JSON.stringify(m.folkCount)})`,
             /tick \d+/.test(m.folkCount || ''));
          for (const c of PLACED) seen[`${sample}:${c.id}`] = (byId[c.id] || {}).action;

          // ── E. THE BAND GROWS INWARD, NEVER OUTWARD ───────────────────────
          is(`${tag}: the roster band scrolls internally (overflow-y ${m.bandScroll.oy})`,
             /auto|scroll/.test(m.bandScroll.oy));
          is(`${tag}: the roster band is capped (max-height ${m.bandScroll.mh})`,
             m.bandScroll.mh !== 'none');
          eqv(`${tag}: the roster band has NO horizontal overflow`,
              Math.max(0, m.bandScroll.sw - m.bandScroll.cw), 0);
          is(`${tag}: 33 rows are contained, not spilled (scrollHeight ${m.bandScroll.sh} > clientHeight ${m.bandScroll.ch})`,
             m.bandScroll.sh > m.bandScroll.ch);
        }

        // ── F. THE NO-COLLISION LAW ────────────────────────────────────────
        eqv(`${tag}: nothing overflows the sheet's content box`,
            m.overflow.map((o) => `${o.id}+${o.over}`).slice(0, 4).join(' | ') || 'none', 'none');
        eqv(`${tag}: no two flow elements in the sheet overlap`,
            m.pairs.map((p) => `${p.a} x ${p.b} ${p.ox}x${p.oy}`).slice(0, 4).join(' | ') || 'none', 'none');

        // ── G. REACHABILITY — the last row, and the way out ────────────────
        if (!CTL.nofolk) {
          const last = await page.evaluate(REACH, '#wsFolk .ws-f:last-child');
          is(`${tag}: the LAST roster row is reachable (${last && last.hitId})`,
             !!(last && last.visible && last.own));
        }
        const x = await page.evaluate(REACH, '#dvWorldSkeletonSheet #wsX');
        // ── THE EXEMPTION SET, NOW EMPTY (QACME5Q closed it) ──────────────
        // HISTORY, kept because it is the reason this branch exists at all.
        // MEASURED at the 375x667 lane with this feature entirely OFF
        // (--control-nofolk => ?folk=0: no marker painted, no roster row
        // built, no element added by this slice): the sheet's ✕ was covered by
        // #vwg-pill, the welcome-gate guest pill — a position:fixed float
        // owned by body/welcome-gate.js with ZERO references in any file this
        // slice touches. It was a real No-Collision violation, it was not this
        // card's, and this harness refused to assert a promise this card never
        // made (NFQ2EU6). So it was SUBTRACTED into a named, narrow set —
        // narrow precisely so the set could only ever shrink.
        //
        // IT HAS SHRUNK TO NOTHING. QACME5Q moved the yield into the shared
        // sheet door: dirverse-hud.js's syncScrim() now hands both bottom
        // corners to every open sheet via VintDock.avoid(), so the platform
        // DOES make this promise and this harness can hold it to it. An empty
        // set means any occluder — inherited or introduced — now FAILS.
        // Proven by scripts/verify-sheet-dock-yield-QACME5Q.js, whose own
        // group A asserts this array is still empty so it cannot quietly
        // re-grow.
        const INHERITED_OCCLUDERS = [];
        checks++;
        if (x && x.visible && x.own) {
          /* reachable: nothing to report */
        } else if (x && x.visible && INHERITED_OCCLUDERS.includes(String(x.hitId))) {
          notes.push(`${tag}: the sheet's ✕ is covered by #${x.hitId} — INHERITED, ` +
                     `measured identically with --control-nofolk (not this slice)`);
        } else {
          add(`${tag}: the sheet's ✕ is unreachable, occluded by ${JSON.stringify(x && x.hitId)}`);
        }

        // ── H. THE ONE LABEL IS CLAMPED INSIDE THE CANVAS ──────────────────
        if (!CTL.nofolk) {
          for (const who of ['cit_origin', 'cit_far', 'cit_long']) {
            const L = await page.evaluate((w2) => {
              try {
                window.VintWorldSkeleton.pick(w2);
                const g = window.VintWorldSkeleton.geom();
                const l = window.VintWorldSkeleton.label();
                const picked = window.VintWorldSkeleton.picked();
                const row = document.querySelector('#wsFolk [data-cit="' + w2 + '"]');
                return { g, l, picked, rowOn: !!(row && row.classList.contains('on')) };
              } catch (e) { return { err: String(e) }; }
            }, who);
            checks++;
            if (!L || !L.l || !L.g) { add(`${tag}: picking ${who} drew no label (${L && L.err})`); continue; }
            const { l, g } = L;
            const esc = (l.x < -0.5) || (l.y < -0.5) || (l.x + l.w > g.w + 0.5) || (l.y + l.h > g.h + 0.5);
            if (esc) {
              add(`${tag}: ${who}'s label ESCAPES the canvas — box ${l.x.toFixed(1)},${l.y.toFixed(1)} ` +
                  `${l.w.toFixed(1)}x${l.h.toFixed(1)} in ${g.w}x${g.h}`);
            }
            is(`${tag}: picking ${who} highlights its roster row`, L.rowOn === true);
            eqv(`${tag}: picking ${who} selects exactly that citizen`, L.picked, who);
          }
          // only ONE label can exist: picking a second citizen replaces it.
          const two = await page.evaluate(() => {
            window.VintWorldSkeleton.pick('citizen_wren');
            const a = window.VintWorldSkeleton.picked();
            const on = [...document.querySelectorAll('#wsFolk .ws-f.on')].map((e) => e.getAttribute('data-cit'));
            return { a, on };
          });
          eqv(`${tag}: exactly one citizen is ever selected`, two.on.length, 1);
          eqv(`${tag}: the selection is the one just picked`, two.a, 'citizen_wren');
        }

        // ── I. THE LAND PANEL gets the same people, with no height change ───
        if (!CTL.nofolk) {
          const land = await page.evaluate(async (VERBS_) => {
            const btn = document.getElementById('worldMapButton');
            const panel = document.getElementById('worldMapPanel');
            if (!btn || !panel) return { skip: 'no land panel' };
            btn.click();

            // ── SETTLE, NEVER SLEEP (9SABEEP) ───────────────────────────────
            // This panel fetches /api/world/parcels and composites only once
            // that lands. A fixed 700ms was enough at 320/393 and NOT at
            // 768/1280/1920 under load, which is exactly why 11 of the 33
            // failures in the previous run read as code defects in correct
            // code. Wait for the OBSERVABLE condition instead of a clock.
            const TERR = new Set(['146,120,93', '169,167,106', '77,117,93',
                                  '150,112,112', '76,113,144', '244,199,154']);
            // Count painted pixels, split into terrain vs everything else.
            // A TRANSPARENT pixel is UNPAINTED and must count as neither:
            // the old check counted it as citizen ink, so a blank canvas
            // scored 262144 "ink" and passed vacuously (UGP7422).
            const px = () => {
              const cv = document.getElementById('worldMapCanvas');
              if (!cv) return null;
              let terrain = 0, other = 0;
              try {
                const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
                for (let i = 0; i < d.length; i += 4) {
                  if (d[i + 3] < 8) continue;                       // unpainted
                  if (TERR.has(d[i] + ',' + d[i + 1] + ',' + d[i + 2])) terrain++;
                  else other++;
                }
              } catch (_) { return null; }
              return { terrain, other };
            };
            const folkEl = document.getElementById('worldFolk');
            if (folkEl) folkEl.open = true;
            const verbRows = () => folkEl
              ? [...folkEl.querySelectorAll('.wd-folk .wd-sub')].map((e) => e.textContent)
              : [];
            let ink = null, meta = null, subs = [];
            for (let i = 0; i < 100; i++) {                         // up to 10s
              ink = px();
              try { meta = document.getElementById('worldMapMeta').textContent; } catch (_) {}
              subs = verbRows();
              const store = (window.VintWorldFolk && window.VintWorldFolk.get()) || null;
              const acted = subs.some((t) => VERBS_.some((v) => t.includes('\u00b7 ' + v + ' \u00b7')));
              if (ink && ink.terrain > 1000 && ink.other > 100 &&
                  store && store.length && /\d+ here/.test(meta || '') && acted) break;
              await new Promise((r) => setTimeout(r, 100));
            }
            // ── DOES PAINTING THE FOLK ACCUMULATE DOM? ────────────────────
            // The land panel's markers are composited into the canvas that was
            // already there, so a REPAINT must not add elements. Counting
            // before the click instead measured the panel building its OWN
            // content (MEASURED 37 -> 199) and said nothing about the folk
            // layer. Count with the panel open and settled, force another
            // composite, and count again: a painter that appended a node per
            // marker would grow the panel by 33 on every tick.
            const kids0 = panel.querySelectorAll('*').length;
            try { window.VintWorldFolk.refresh(); } catch (_) {}
            await new Promise((r) => setTimeout(r, 900));
            const kids1 = panel.querySelectorAll('*').length;
            const cv = document.getElementById('worldMapCanvas');
            return { ink, meta, subs, kids0, kids1,
                     canvas: { w: cv.width, h: cv.height } };
          }, VERBS);
          checks++;
          if (land.skip) notes.push(`${tag}: ${land.skip}`);
          else {
            // the LAND is painted (so the next check cannot pass on a blank canvas)
            is(`${tag}: the land panel still paints its terrain (${land.ink && land.ink.terrain} terrain px)`,
               !!(land.ink && land.ink.terrain > 1000));
            is(`${tag}: the land panel's canvas carries citizen ink (${land.ink && land.ink.other} non-terrain px)`,
               !!(land.ink && land.ink.other > 100));
            // the folk layer writes into the canvas that was ALREADY there: it
            // must add no element and must not resize the backing store.
            eqv(`${tag}: repainting the folk adds NO element to the land panel (${land.kids0})`,
                land.kids1, land.kids0);
            eqv(`${tag}: the land canvas keeps its 512x512 backing store`,
                `${land.canvas.w}x${land.canvas.h}`, '512x512');
            checks++;
            if (!/\d+ here/.test(land.meta || '')) add(`${tag}: the land panel's meta omits the head-count (${JSON.stringify(land.meta)})`);
            const withAct = (land.subs || []).filter((t) => VERBS.some((v) => t.includes('· ' + v + ' ·')));
            checks++;
            if (!withAct.length) add(`${tag}: the land panel's folk rows carry no action verb (${JSON.stringify((land.subs || [])[0])})`);
          }
        }
      } finally {
        await page.close().catch(() => {});
      }
    }

    // ── J. THE ACCEPTANCE'S OWN CLAUSE: the action CHANGES across two ticks ─
    if (!CTL.nofolk) {
      const changed = CHANGERS.filter((id2) => seen[`0:${id2}`] && seen[`1:${id2}`] &&
        seen[`0:${id2}`] !== seen[`1:${id2}`]);
      checks++;
      if (CTL.staticact) {
        if (changed.length) add(`${lane}: --control-staticact served ONE sample and the roster still changed (${changed.join(',')}) — the control is inert`);
      } else if (changed.length < CHANGERS.length) {
        const stuck = CHANGERS.filter((id2) => !changed.includes(id2))
          .map((id2) => `${id2}: ${seen[`0:${id2}`]} -> ${seen[`1:${id2}`]}`);
        add(`${lane}: the action line did NOT change across two world ticks for ${stuck.join(' | ')}`);
      }
      // and a citizen whose verb the server did NOT change must NOT drift
      checks++;
      if (seen['0:cit_twin_a'] !== seen['1:cit_twin_a']) {
        add(`${lane}: a citizen the server did not move drifted anyway ` +
            `(${seen['0:cit_twin_a']} -> ${seen['1:cit_twin_a']}) — the roster is inventing verbs`);
      }
    }
  }

  await browser.close();
  srv.close();

  const activeCtl = Object.keys(CTL).filter((k) => CTL[k]);
  console.log('');
  console.log('═══ THE FOLK ON THE MAP — AC2WP9A ' + '═'.repeat(34));
  console.log(`lanes: ${VIEWPORTS.map((v) => v.join('x')).join(', ')} x 2 tick samples`);
  if (activeCtl.length) console.log(`NEGATIVE CONTROL: ${activeCtl.map((c) => '--control-' + c).join(' ')}`);
  for (const n of notes) console.log('  note: ' + n);
  if (failures.length) {
    console.log('');
    console.log('FAILURES:');
    for (const f of failures) console.log('  - ' + f);
  }
  console.log('');
  console.log(`${checks - failures.length}/${checks} pass`);
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
