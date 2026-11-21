#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════════
   QACME5Q — EVERY .dv-sheet YIELDS THE BOTTOM CORNERS, FROM THE SHARED DOOR
   ════════════════════════════════════════════════════════════════════════════
   THE DEFECT, as filed and as re-measured here. #vwg-pill is the welcome-gate
   guest affordance: a position:fixed float (z-index 2147483600) docked by
   body/corner_dock.js into the `br` corner. A .dv-sheet is a full-width bottom
   sheet (position:fixed; left:0; right:0; bottom:0; z-index:1600). The sheet is
   therefore BELOW the pill in paint order and shares its pixels, so on a phone
   the pill lands on the sheet's own header — and at 375x667 it landed exactly
   on #wsX, the only way out of the world skeleton sheet.

   WHY THIS IS FIXED IN THE SHARED DOOR AND NOT IN THE SHEET (HAAXZR2).
   corner_dock.js already has the mechanism: VintDock.avoid(el, {corner}) makes
   the docked stack start ABOVE an obstacle. Two sheets had remembered to call
   it (world-pulse.js, reckoning-hud.js). MEASURED on origin/main at the time
   this was written: TWENTY-FIVE elements are given `className = 'dv-sheet'`
   across body/world/, and 23 of them never register. A gate every new surface
   must remember is a gate that will be forgotten — which is the lesson
   dirverse-hud.js's own layoutRail step 2b already carries in prose:

       "THE SELECTOR USED TO BE A HAND-WRITTEN LIST of the three sheets that
        existed when this was written ... A list that has to be edited by
        whoever adds a surface is a list that will be wrong."

   So the yield moves into syncScrim() — the single chokepoint every sheet
   transition already runs through — and it finds its obstacles the same way
   layoutRail does: by asking the DOM which elements carrying the shared sheet
   class are open RIGHT NOW. One selector, named once (openSheetEls), consumed
   by both. A sheet shipped tomorrow is covered on the day it ships, with
   nothing for its author to remember.

   WHAT THIS HARNESS ASSERTS, per viewport x per sheet, in GUEST state (so the
   pill genuinely exists — a signed-in page has no pill and every check below
   would pass for free, which is why B is a vacuity guard and not a courtesy):

     B  the pill is present and visible            (vacuity guard)
     C  ZERO overlap between the pill and the open sheet       (geometry)
     D  elementFromPoint at the close button's clipped centre returns the
        close button or a descendant                (the card's own wording)
     E  the pill itself is still reachable          (the fix must not bury it)
     F  the pill is inside the viewport             (no overflow)

   THE OCCLUSION FILTER, AND WHY THE FLOATS ARE NEUTRALISED FOR *ONE* OF THE
   TWO PAINT TESTS (N2E8EAP, and copied verbatim in shape from the sibling
   harness scripts/verify-account-dot-gone-JSAX335.js). getBoundingClientRect()
   answers "where would this be", never "can a person touch this". So a control
   is only a legitimate collision CANDIDATE if it is painted at its own clipped
   centre — and when we ask THAT question we set the floats to
   pointer-events:none, because the float's own coverage must not be what
   disqualifies the candidate (it is the very thing under test). Check D then
   asks the opposite question with the floats LIVE, which is the card's literal
   acceptance criterion. Both are reported with the id of whatever was hit, so
   a failure never leaves you guessing which element did it.

   NEGATIVE CONTROLS (each reverts ONE thing, each must go RED; a control whose
   anchor drifts ABORTS the run rather than quietly reporting a near-green
   tally that reads as "the fix was unnecessary" — B9HMZN3):
     --control-nodock    removes syncDockAvoid()'s call from syncScrim(), i.e.
                         exactly the pre-fix world. Must reproduce the overlap.
     --control-bronly    registers only the `br` corner. A .dv-sheet is
                         full-width and reaches into BOTH bottom corners; this
                         proves the second avoid() is load-bearing for anything
                         docked bottom-LEFT.
     --control-nounavoid drops the unavoid, so a closed sheet keeps lifting the
                         pill forever. Must leave the pill lifted after close.
   ════════════════════════════════════════════════════════════════════════════ */

const http = require('http');
const fs = require('fs');
const path = require('path');
// Absolute path, as every sibling harness in this repo does: puppeteer lives in
// the BRAIN's node_modules and a bare specifier resolves from THIS script's
// directory, which has none (E4CS77Y).
let puppeteer;
try { puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer'); }
catch (_) { console.error('puppeteer is not installed here; cannot measure.'); process.exit(2); }

const ROOT = path.resolve(__dirname, '..');
const A = process.argv.slice(2);
const has = (f) => A.includes(f);
const CTL = {
  nodock: has('--control-nodock'),
  bronly: has('--control-bronly'),
  nounavoid: has('--control-nounavoid'),
};
const ANYCTL = Object.keys(CTL).some((k) => CTL[k]);

const HUD = 'body/world/dirverse-hud.js';
// Each control reverts ONE expression. `from` must match EXACTLY ONCE or the
// run aborts: a control that silently fails to apply turns its own tally into
// an argument against the fix (B9HMZN3).
const PATCHES = {
  nodock:    { file: HUD, from: 'try { syncDockAvoid(); } catch (_) {}',
                          to:   'try { /* control-nodock */ } catch (_) {}' },
  bronly:    { file: HUD, from: "AVOID_CORNERS = ['br', 'bl']",
                          to:   "AVOID_CORNERS = ['br']" },
  nounavoid: { file: HUD, from: 'VintDock.unavoid(prev[i])',
                          to:   'void (prev[i])' },
};

const VIEWPORTS = [[320, 568], [375, 667], [393, 852], [768, 1024], [1280, 800], [1920, 1080]]
  .filter(([w]) => {
    if (process.env.COLLISION_WIDTH) return w === Number(process.env.COLLISION_WIDTH);
    if (process.env.COLLISION_WIDTHS) return process.env.COLLISION_WIDTHS.split(',').map(Number).includes(w);
    return true;
  });

/* THE SHEETS UNDER TEST. The card is about #dvWorldSkeletonSheet, and that one
   is first. The other four are here because this fix is a CLASS fix and a class
   fix proven on one instance is one instance (JX6M6BP): #dvWorldPulseSheet
   ALREADY registered per-sheet before this change (so it is the control group —
   it must not regress), while #dvCommonsSheet, #dvWeSheet and #dvSpireSheet
   never registered at all and are covered here for the first time by the shared
   door alone, with zero lines added to their own files. */
const SHEETS = [
  { global: 'VintWorldSkeleton', id: 'dvWorldSkeletonSheet', x: 'wsX', note: 'the card' },
  { global: 'VintCommons',       id: 'dvCommonsSheet',       x: 'cmX', note: 'never registered' },
  { global: 'VintWe',            id: 'dvWeSheet',            x: 'weX', note: 'never registered' },
  { global: 'VintSpire',         id: 'dvSpireSheet',         x: 'spX', note: 'never registered' },
  { global: 'VintWorldPulse',    id: 'dvWorldPulseSheet',    x: 'wpX', note: 'registered already' },
];

function served(rel) {
  let src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  for (const k of Object.keys(PATCHES)) {
    if (!CTL[k]) continue;
    const p = PATCHES[k];
    if (p.file !== rel) continue;
    const n = src.split(p.from).length - 1;
    if (n !== 1) {
      console.error(`CONTROL ABORT: --control-${k}'s anchor matched ${n} times in ${rel} (want exactly 1).`);
      console.error("The control is INERT, so this run's tally is NOT evidence. Re-anchor it.");
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
        // control patches are applied to the JS AS IT IS SERVED, so a control
        // run never modifies the working tree.
        if (ext === '.js' && ANYCTL) { try { buf = Buffer.from(served(rel), 'utf8'); } catch (_) {} }
        res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream',
          'cache-control': 'no-store' });
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

const BASE_TICK = 16450;
function killTransitions() {
  const s = document.createElement('style');
  s.textContent = '*{transition:none !important;animation:none !important}' +
    'html{scroll-behavior:auto !important}';
  document.head.appendChild(s);
}

/* ── THE ONE IN-PAGE MEASUREMENT ───────────────────────────────────────────
   Runs with a sheet open. `sheetId` names the sheet; it reads the pill, the
   sheet, and the sheet's own close control, and answers every question above
   in ONE evaluate so nothing can drift between reads. */
const MEASURE = (sheetId) => {
  const vw = innerWidth, vh = innerHeight;
  const out = { vw, vh };
  const sheet = document.getElementById(sheetId);
  const pill = document.getElementById('vwg-pill');
  const dot = document.getElementById('vwg-dot');
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

  out.hasSheet = !!sheet;
  out.sheetOpen = !!(sheet && sheet.classList.contains('open') && vis(sheet));
  out.pillVisible = vis(pill);
  out.dotVisible = vis(dot);

  // the floats this page's guest state actually paints. MEASURED ABOVE THE
  // EARLY RETURN on purpose: a .dv-sheet element is BUILT LAZILY by its own
  // open(), so before the first open the sheet id resolves to nothing — and a
  // pill rect taken after that return is never taken at all, which is how the
  // resting-place baseline came back undefined on the first run of this file.
  const floats = [pill, dot].filter((e) => vis(e));
  out.floats = floats.map(idOf);
  if (out.pillVisible) out.pill = rect(pill);

  if (!sheet) return out;
  out.sheet = rect(sheet);

  // ── clip an element to every scrolling ancestor and to the viewport ──────
  const clipToScrollers = (el) => {
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
    if (bottom - top <= 0 || right - left <= 0) return null;
    return { top, bottom, left, right };
  };

  // Is `el` a legitimate collision CANDIDATE — i.e. painted at its own clipped
  // centre once the floats are taken out of the hit test? The floats are
  // neutralised for exactly this question because the float's own coverage is
  // what we are measuring and must not disqualify the target (N2E8EAP).
  const collidableBox = (el) => {
    const box = clipToScrollers(el);
    if (!box) return null;
    const saved = floats.map((f) => [f, f.style.pointerEvents]);
    saved.forEach(([f]) => { f.style.pointerEvents = 'none'; });
    let painted = null;
    try { painted = document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2); }
    catch (_) {}
    saved.forEach(([f, v]) => { f.style.pointerEvents = v; });
    if (!painted) return null;
    return (painted === el || el.contains(painted)) ? box : null;
  };

  // The card's own criterion, asked with the floats LIVE: who is painted here?
  const hitWithFloatsLive = (el) => {
    const box = clipToScrollers(el);
    if (!box) return { visible: false, own: false, hitId: null };
    let painted = null;
    try { painted = document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2); }
    catch (_) {}
    return { visible: true,
      own: !!(painted && (painted === el || el.contains(painted))),
      hitId: idOf(painted) };
  };

  const overlap = (a, b) => {
    if (!a || !b) return null;
    const ox = Math.min(a.right !== undefined ? a.right : a.r, b.right !== undefined ? b.right : b.r)
             - Math.max(a.left !== undefined ? a.left : a.l, b.left !== undefined ? b.left : b.l);
    const oy = Math.min(a.bottom !== undefined ? a.bottom : a.b, b.bottom !== undefined ? b.bottom : b.b)
             - Math.max(a.top !== undefined ? a.top : a.t, b.top !== undefined ? b.top : b.t);
    return (ox > 1 && oy > 1) ? { ox: Math.round(ox), oy: Math.round(oy) } : null;
  };

  // ── C: the pill vs the WHOLE sheet, and vs the close control specifically ─
  const xEl = sheet.querySelector('.dv-x');
  out.hasX = !!xEl;
  if (out.pillVisible) {
    out.pillVsSheet = overlap(out.pill, out.sheet);
    out.floatVsSheet = floats.map((f) => ({ id: idOf(f), ov: overlap(rect(f), out.sheet) }))
                             .filter((o) => o.ov);
  }
  if (xEl) {
    out.xBox = collidableBox(xEl);           // null => not painted for reasons of its own
    out.xHit = hitWithFloatsLive(xEl);
    if (out.xBox && out.pillVisible) out.pillVsX = overlap(out.pill, out.xBox);
  }
  // ── E: the pill's own reachability, floats live (it must not be buried) ───
  if (out.pillVisible) out.pillHit = hitWithFloatsLive(pill);

  // ── what the dock believes it is avoiding right now ──────────────────────
  try {
    out.avoids = (window.VintDock && window.VintDock._avoids)
      ? window.VintDock._avoids().map((a) => (a.el && a.el.id ? a.el.id : '?') + '@' + a.corner).sort()
      : null;
  } catch (_) { out.avoids = null; }

  /* ── EVERY DOCKED FLOAT, NOT JUST THE PILL ──────────────────────────────
     The pill is the float the card names, and it docks `br`. But a .dv-sheet
     is full-width and the dock has a bottom-LEFT stack too: MEASURED on a
     guest load of world.html at 375x667, VintDock._slots() is
     ["vint-vc-fab@bl","vwg-pill@br","vintVoice@bl"] — two of the three are
     bl. Asserting only the pill would make the second avoid() corner look
     decorative and would let --control-bronly pass for the wrong reason, so
     the yield is measured against every float the dock actually holds. */
  out.docked = [];
  try {
    const slots = (window.VintDock && window.VintDock._slots) ? window.VintDock._slots() : [];
    for (const sl of slots) {
      const el = sl && sl.el;
      if (!el || !vis(el)) continue;
      const box = clipToScrollers(el);
      const ov = overlap(rect(el), out.sheet);
      out.docked.push({ id: idOf(el), corner: sl.corner, ov: ov,
        hit: box ? (() => { let pt = null;
          try { pt = document.elementFromPoint((box.left + box.right) / 2, (box.top + box.bottom) / 2); }
          catch (_) {}
          return { own: !!(pt && (pt === el || el.contains(pt))), hitId: idOf(pt) }; })() : null });
    }
  } catch (_) {}
  return out;
};

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

  async function loadPage(w, h) {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = req.url();
      const json = (body) => req.respond({ status: 200, contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
      if (/\/sw\.js(\?|$)/.test(u)) return req.respond({ status: 404, body: '' });
      if (u.includes('/api/world/citizens')) return json({ citizens: [] });
      if (u.includes('/api/world/parcels')) return json({ w: 8, h: 8, terrain: 'f'.repeat(64),
        legend: { f: 'flat' }, claims: [] });
      if (u.includes('/api/world/economy')) return json({ tick: BASE_TICK, tick_rate_ms: 60000,
        snapshot_every_ticks: 24, snapshot_keep: 14, behind_s: 3, behind_ticks: 0 });
      if (u.includes('/api/world/health')) return json({ economy_tick: BASE_TICK });
      if (u.includes('/api/world/cost')) return json({ day: '2026-11-18', tokens_today: 10,
        token_budget: 2e6, pct_display: 1, per_agent: [] });
      if (u.includes('/api/world/timeline')) return json({ days: [] });
      if (u.includes('/api/world/agents')) return json({ agents: [] });
      if (u.includes('/api/world/')) return json({});
      if (/^https?:\/\/(api\.vintaclectic\.com|localhost:8767)/.test(u)) return req.abort('connectionrefused');
      return req.continue();
    });
    if (page.setBypassServiceWorker) await page.setBypassServiceWorker(true);
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    // GUEST, deliberately: no token anywhere, so welcome-gate paints the pill.
    // Without this the page may be signed in and every pill check passes for
    // free — the vacuity this harness exists to refuse.
    await page.evaluateOnNewDocument(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch (_) {}
    });
    try { await page.goto(base + '/world.html', { waitUntil: 'domcontentloaded', timeout: 30000 }); }
    catch (_) {}
    await sleep(1400);           // the pill fades in over 0.2s + a 0.6s lift tail
    await page.evaluate(killTransitions);
    return page;
  }

  /* SETTLE, NEVER SLEEP (9SABEEP) — and settle on EVERY element the checks
     read, not just the sheet. Opening a sheet reflows the page, and #dvRail
     and the docked floats then re-measure on their OWN schedule, which
     finishes AFTER the sheet's rect goes quiet. Keying the settle on the
     sheet alone is exactly the race that reports a one-frame occlusion as a
     defect. */
  const SETTLE = (sheetId) => {
    const parts = [];
    const s = document.getElementById(sheetId);
    if (!s) return false;
    const push = (el, p) => { const r = el.getBoundingClientRect();
      parts.push(p + (el.id || el.className || el.tagName) + ':' +
        Math.round(r.top) + ',' + Math.round(r.left) + ',' +
        Math.round(r.width) + ',' + Math.round(r.height)); };
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
    window.__qs = window.__qs || { k: '', n: 0 };
    if (key === window.__qs.k) window.__qs.n++; else { window.__qs.k = key; window.__qs.n = 0; }
    return window.__qs.n >= 4;
  };

  async function openSheet(page, sh) {
    const ok = await page.evaluate((g) => {
      try {
        const m = window[g];
        if (!m || typeof m.open !== 'function') return false;
        m.open();
        return true;
      } catch (_) { return false; }
    }, sh.global);
    if (!ok) return false;
    await page.waitForFunction((id) => {
      const s = document.getElementById(id);
      return !!(s && s.classList.contains('open'));
    }, { timeout: 15000 }, sh.id).catch(() => {});
    await page.evaluate(() => { try { delete window.__qs; } catch (_) {} });
    await page.waitForFunction(SETTLE, { polling: 90, timeout: 25000 }, sh.id).catch(() => {});
    return true;
  }

  // ════ GROUP A — THE SHARED DOOR OWNS THE YIELD (static) ══════════════════
  // The whole point of this card is that the gate is in ONE place. A static
  // check is the only thing that can prove "one place" rather than "this place
  // happens to work" — and it is what fails the run if a 26th sheet ships with
  // its own copy instead of inheriting.
  {
    const hud = fs.readFileSync(path.join(ROOT, HUD), 'utf8');
    // own-line comments only: a naive /\*[\s\S]*?\*\// sweep eats whole
    // functions whenever the file contains a comment-shaped substring
    // (U3VFRJR), and this file is 3000 lines of annotated CSS strings.
    const code = hud
      .replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*$/gm, '')
      .replace(/^([ \t]*)\/\/[^\n]*$/gm, '$1');

    eqv('A1 openSheetEls() is defined exactly once in the shared door',
        (code.match(/function openSheetEls\s*\(/g) || []).length, 1);
    // one definition + layoutRail's step 2b + syncDockAvoid + syncRailSpill
    // (the rail-column spill door, DSAZ7GJ) = 4 occurrences. The point stands:
    // every reader asks the SAME selector, so they can never disagree about what
    // is open — a new reader is welcome, a new inline copy is not (A6 guards that).
    eqv('A2 openSheetEls() is the ONE selector, consumed by every reader',
        (code.match(/openSheetEls\s*\(/g) || []).length, 4);
    eqv('A3 syncScrim() calls syncDockAvoid()',
        (code.match(/syncDockAvoid\(\)/g) || []).length >= 2, true);
    eqv('A4 both bottom corners are declared', /AVOID_CORNERS\s*=\s*\['br',\s*'bl'\]/.test(code), true);
    eqv('A5 the door unavoids what closed', /VintDock\.unavoid\(/.test(code), true);
    // the hand-written list the old step 2b carried must NOT come back.
    eqv('A6 no hand-written sheet list survives in the shared door',
        /querySelectorAll\(\s*'\.dv-sheet\.open,\s*#ctSheet\.open,\s*#dvTraceSheet\.open'\s*\)/.test(code),
        false);

    /* ── THE CENSUS, COUNTED ON CODE AND NOT ON PROSE (S7VCB6C) ──────────
       This fix is only interesting because many sheets exist and almost none
       registered, so the census is evidence and has to be right. The door's
       own explanatory comment NAMES the token it counts — it quotes
       `className = 'dv-sheet'` to say how many surfaces there are — so a raw
       count reads its own prose as a 26th surface. MEASURED on the first
       post-fix run: 26 where the truth is 25. Count on a comment-stripped
       copy, and PAY FOR the strip with A9, which asserts the prose really
       does carry the token so the strip can never be vacuous. */
    const stripOwnLine = (t) => t
      .replace(/^[ \t]*\/\*[\s\S]*?\*\/[ \t]*$/gm, '')
      .replace(/^([ \t]*)\/\/[^\n]*$/gm, '$1');
    const files = fs.readdirSync(path.join(ROOT, 'body/world')).filter((f) => f.endsWith('.js'));
    let sheetCount = 0, rawCount = 0;
    const selfAvoid = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(ROOT, 'body/world', f), 'utf8');
      const code = stripOwnLine(src);
      rawCount += (src.match(/className\s*=\s*'dv-sheet'/g) || []).length;
      sheetCount += (code.match(/className\s*=\s*'dv-sheet'/g) || []).length;
      // the shared door is where the gate LIVES; it is not a sheet that
      // remembered to register itself.
      if (f !== 'dirverse-hud.js' && /VintDock\.avoid\(/.test(code)) selfAvoid.push(f);
    }
    is(`A7 the .dv-sheet census is non-vacuous (${sheetCount} surfaces in ${files.length} files)`,
       sheetCount >= 20 && files.length >= 30);
    eqv('A8 the census counts CODE, not the door\'s own prose about the token',
        rawCount > sheetCount, true);
    is(`A9 the strip is load-bearing: the door really does name the token in prose ` +
       `(raw ${rawCount} vs code ${sheetCount})`, rawCount - sheetCount >= 1);
    notes.push(`A: ${sheetCount} .dv-sheet surfaces exist under body/world/; the only files ` +
               `that still call VintDock.avoid themselves are ${JSON.stringify(selfAvoid)} ` +
               `— every other surface is covered by the shared door alone`);

    /* ── A10: THE SIBLING'S EXEMPTION SET MUST STAY EMPTY ─────────────────
       scripts/verify-world-folk-AC2WP9A.js subtracted this exact collision
       into a named set (INHERITED_OCCLUDERS) because it was a pre-existing
       occluder outside that card's slice. This card is what shrinks it, so
       the shrink is asserted FROM HERE: if a future agent re-adds a name to
       that set to get a green run, this run goes red instead. Two scoped
       ratchets whose union nobody checks is how a class stays unguarded
       (JX6M6BP), so the class-wide verifier holds the scoped one's line. */
    const sibPath = path.join(ROOT, 'scripts/verify-world-folk-AC2WP9A.js');
    const sib = fs.existsSync(sibPath) ? fs.readFileSync(sibPath, 'utf8') : '';
    const sibSet = (sib.match(/INHERITED_OCCLUDERS\s*=\s*\[([^\]]*)\]/) || [])[1];
    is('A10 the sibling verifier still DECLARES an exemption set (not deleted)',
       sibSet !== undefined);
    eqv('A11 that exemption set is EMPTY — the shrink this card exists to make',
        sibSet === undefined ? '(absent)' : sibSet.trim(), '');

    /* ── A12: THE BLAST RADIUS, MEASURED RATHER THAN ASSUMED ──────────────
       The card asks for brain.html and phone.html to be checked "since the
       pill is shared". The pill is shared; the SHEETS are not. MEASURED: of
       every .html at the repo root, exactly ONE loads the shared door, and
       `dv-sheet` appears in no other page's markup — so world.html is the
       only surface where a .dv-sheet and the pill can ever share pixels, and
       this change cannot reach the other pages at all. (The pill's own
       regressions are covered by scripts/verify-account-dot-gone-JSAX335.js,
       which drives phone.html and brain.html.) */
    const rootHtml = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'));
    const loadsDoor = rootHtml.filter((f) =>
      fs.readFileSync(path.join(ROOT, f), 'utf8').includes('dirverse-hud.js'));
    const hasSheetClass = rootHtml.filter((f) =>
      fs.readFileSync(path.join(ROOT, f), 'utf8').includes('dv-sheet'));
    is(`A12 the census of root pages is non-vacuous (${rootHtml.length} .html files)`,
       rootHtml.length >= 10);
    eqv('A13 exactly one root page loads the shared door',
        loadsDoor.sort().join(','), 'world.html');
    eqv('A14 no other root page carries the shared sheet class',
        hasSheetClass.sort().join(','), 'world.html');
  }

  // ════ THE SWEEP ══════════════════════════════════════════════════════════
  for (const [vw, vh] of VIEWPORTS) {
    const lane = `${vw}x${vh}`;
    const page = await loadPage(vw, vh);
    try {
      /* ── SETTLE THE RESTING PLACE BEFORE BASELINING IT ──────────────────
         world.html's guest doorway (#invite) rises on its OWN 0.8s keyframe
         and world.html registers it with VintDock.avoid(), so the pill's
         resting place MOVES well after the page is otherwise quiet. MEASURED
         at 375x667 on the first run of this file: a baseline taken at 1400ms
         read the pill at t=492 with `avoids: []`, while the settled page has
         it at t=400 with `avoids: ["invite@br","invite@bl"]` — a 92px shift
         caused by the doorway, not by any sheet. Comparing a post-close
         position against that un-settled baseline reported a correct unavoid
         as a failure on all five sheets (9SABEEP, on the float this time).
         So settle on the pill's own rect AND the dock's obstacle set. */
      await page.waitForFunction(() => {
        const pill = document.getElementById('vwg-pill');
        if (!pill) return false;
        const r = pill.getBoundingClientRect();
        let av = '';
        try { av = (window.VintDock && window.VintDock._avoids)
          ? window.VintDock._avoids().map((a) => (a.el && a.el.id ? a.el.id : '?') + '@' + a.corner).sort().join(',')
          : 'nodock'; } catch (_) { av = 'err'; }
        const key = Math.round(r.top) + ',' + Math.round(r.left) + ',' +
                    Math.round(r.width) + ',' + Math.round(r.height) + '|' + av;
        window.__qp = window.__qp || { k: '', n: 0 };
        if (key === window.__qp.k) window.__qp.n++; else { window.__qp.k = key; window.__qp.n = 0; }
        return window.__qp.n >= 5;
      }, { polling: 100, timeout: 25000 }).catch(() => {});

      // ── B: GUEST STATE IS REAL (the vacuity guard for everything below) ──
      const pre = await page.evaluate(MEASURE, SHEETS[0].id);
      is(`${lane} B1: the guest pill #vwg-pill is painted (vacuity guard)`, pre.pillVisible);
      eqv(`${lane} B2: #vwg-dot is not created for a guest (JSAX335)`, pre.dotVisible, false);
      if (!pre.pillVisible) {
        add(`${lane}: NO GUEST PILL — every pill check in this lane is vacuous; harness fault`);
        await page.close().catch(() => {});
        continue;
      }
      const pillClosed = pre.pill;

      for (const sh of SHEETS) {
        const tag = `${lane} ${sh.id}`;
        const opened = await openSheet(page, sh);
        is(`${tag}: opened (${sh.note})`, opened);
        if (!opened) continue;

        const m = await page.evaluate(MEASURE, sh.id);
        is(`${tag}: the sheet is open and visible`, m.sheetOpen);
        is(`${tag}: it has a .dv-x close control`, m.hasX);
        if (!m.sheetOpen || !m.hasX) continue;

        // ── C: GEOMETRY. Nothing touches anything (the No-Collision Law). ──
        eqv(`${tag}: ZERO float-vs-sheet overlap`,
            (m.floatVsSheet || []).map((o) => `${o.id} ${o.ov.ox}x${o.ov.oy}`).join(' | ') || 'none',
            'none');
        eqv(`${tag}: ZERO pill-vs-close-button overlap`,
            m.pillVsX ? `${m.pillVsX.ox}x${m.pillVsX.oy}` : 'none', 'none');

        // ── D: THE CARD'S OWN CRITERION, floats live. ──────────────────────
        checks++;
        if (!m.xBox) {
          // not painted at its own centre even with the floats taken out: that
          // is not this card's defect, and asserting it would be asserting a
          // promise nobody made (NFQ2EU6). Report it.
          notes.push(`${tag}: the ✕ is not painted at its clipped centre with the floats ` +
                     `neutralised — not a pill collision; hit=${JSON.stringify(m.xHit && m.xHit.hitId)}`);
        } else if (m.xHit && m.xHit.own) {
          /* reachable: nothing to report */
        } else {
          add(`${tag}: the ✕ is NOT its own hit target — elementFromPoint returned ` +
              `${JSON.stringify(m.xHit && m.xHit.hitId)} (pill at ` +
              `${JSON.stringify(m.pill)}, sheet top ${m.sheet.t})`);
        }

        // ── E: THE FIX MUST NOT BURY THE PILL EITHER. ──────────────────────
        is(`${tag}: the pill is STILL its own hit target (${m.pillHit && m.pillHit.hitId})`,
           !!(m.pillHit && m.pillHit.own));

        // ── E2: AND NEITHER CORNER'S STACK TOUCHES THE SHEET. ─────────────
        is(`${tag}: the docked-float census is non-vacuous ` +
           `(${(m.docked || []).map((d) => d.id + '@' + d.corner).join(' ')})`,
           (m.docked || []).length >= 2);
        eqv(`${tag}: ZERO overlap between ANY docked float and the sheet`,
            (m.docked || []).filter((d) => d.ov)
              .map((d) => `${d.id}@${d.corner} ${d.ov.ox}x${d.ov.oy}`).join(' | ') || 'none',
            'none');
        /* ── E3: ...AND NOTHING BUT THE MODAL BACKDROP IS PAINTED OVER THEM ─
           MEASURED, with the fix and at EVERY viewport including 1280/1920
           where no float can reach the sheet at all: #vint-vc-fab and
           #vintVoice hit-test to #dvScrim. That is the sheet's own modal
           backdrop — `position:fixed; inset:0; z-index:1560; pointer-events:
           auto` when shown — and those two floats are z-index 480/491
           (body/voice_console.js), so they sit behind it BY DESIGN. The
           No-Collision Law names this case explicitly as the one permitted
           overlay ("a modal over a dimmed backdrop"), and dirverse-hud's own
           scrim comment is the proof it is deliberate: the RAIL had to be
           promoted to 1570 for its launchers to stay clickable, and nothing
           promoted the voice floats.
           IT IS ALSO NOT THIS CHANGE: --control-nodock, which reverts the
           yield entirely, reports the identical `vint-vc-fab@bl->dvScrim` on
           every sheet. So it is REPORTED, not asserted (NFQ2EU6).
           THE EXEMPTION IS ONE NAMED ELEMENT AND IS PAID FOR. Anything else
           painted over a docked float still FAILS — and that is not
           hypothetical: under --control-nodock the same run measures
           `vintVoice@bl->div.dv-title`, the float painted on the sheet's own
           TITLE, which is a real collision and stays red. E4 then proves the
           named element really is a full-viewport backdrop above the floats
           it covers, so a future occluder cannot inherit the pass merely by
           being called dvScrim. */
        const DIMMED_BY_DESIGN = 'dvScrim';
        const occluded = (m.docked || []).filter((d) => d.hit && !d.hit.own);
        const behindScrim = occluded.filter((d) => d.hit.hitId === DIMMED_BY_DESIGN);
        const realOccluders = occluded.filter((d) => d.hit.hitId !== DIMMED_BY_DESIGN);
        eqv(`${tag}: every docked float is its own hit target, or behind the sheet's own scrim`,
            realOccluders.map((d) => `${d.id}@${d.corner}->${d.hit.hitId}`).join(' | ') || 'none',
            'none');
        if (behindScrim.length) {
          notes.push(`${tag}: ${behindScrim.map((d) => d.id + '@' + d.corner).join(', ')} ` +
                     `sit behind #dvScrim, the sheet's own modal backdrop — authored layering, ` +
                     `measured identically under --control-nodock`);
        }
        // ── E4: PAY FOR THE EXEMPTION — the named element IS that backdrop. ─
        if (behindScrim.length) {
          const sc = await page.evaluate(() => {
            const el = document.getElementById('dvScrim');
            if (!el) return null;
            const cs = getComputedStyle(el), r = el.getBoundingClientRect();
            const zOf = (id) => { const e = document.getElementById(id);
              return e ? parseInt(getComputedStyle(e).zIndex, 10) : null; };
            return { shown: el.classList.contains('show'), pe: cs.pointerEvents,
              z: parseInt(cs.zIndex, 10), covers: r.width >= innerWidth - 1 && r.height >= innerHeight - 1,
              fab: zOf('vint-vc-fab'), voice: zOf('vintVoice') };
          });
          is(`${tag}: #dvScrim really is a shown, full-viewport, interactive backdrop`,
             !!(sc && sc.shown && sc.pe === 'auto' && sc.covers));
          is(`${tag}: #dvScrim (z=${sc && sc.z}) outranks the floats it dims ` +
             `(fab=${sc && sc.fab}, voice=${sc && sc.voice})`,
             !!(sc && behindScrim.every((d) => {
               const z = d.id === 'vint-vc-fab' ? sc.fab : (d.id === 'vintVoice' ? sc.voice : null);
               return z === null || z < sc.z;
             })));
        }

        // ── F: and it stays inside the viewport. ───────────────────────────
        is(`${tag}: the pill is inside the viewport ` +
           `(t=${m.pill.t} b=${m.pill.b} of ${m.vh})`,
           m.pill.t >= 0 && m.pill.b <= m.vh + 1 && m.pill.l >= 0 && m.pill.r <= m.vw + 1);

        // ── G: the door really did register BOTH corners for THIS sheet. ───
        const want = CTL.bronly ? [`${sh.id}@br`] : [`${sh.id}@bl`, `${sh.id}@br`];
        eqv(`${tag}: the door registered it as an obstacle in both bottom corners`,
            (m.avoids || []).filter((a) => a.indexOf(sh.id + '@') === 0).sort().join(','),
            want.join(','));

        // ── H: CLOSING IT GIVES THE CORNER BACK (the unavoid). ────────────
        await page.evaluate((g) => { try { window[g].close(); } catch (_) {} }, sh.global);
        await page.evaluate(() => { try { delete window.__qs; delete window.__qp; } catch (_) {} });
        // the float settles AFTER the sheet's own rect goes quiet, so settle on
        // the float, not on a sleep.
        await page.waitForFunction(() => {
          const pill = document.getElementById('vwg-pill');
          if (!pill) return false;
          const r = pill.getBoundingClientRect();
          const key = Math.round(r.top) + ',' + Math.round(r.left);
          window.__qp = window.__qp || { k: '', n: 0 };
          if (key === window.__qp.k) window.__qp.n++; else { window.__qp.k = key; window.__qp.n = 0; }
          return window.__qp.n >= 5;
        }, { polling: 100, timeout: 20000 }).catch(() => {});
        const after = await page.evaluate(MEASURE, sh.id);
        eqv(`${tag}: after close the door avoids it no longer`,
            (after.avoids || []).filter((a) => a.indexOf(sh.id + '@') === 0).length, 0);
        is(`${tag}: after close the pill returns to its resting place ` +
           `(t=${after.pill && after.pill.t}, was ${pillClosed.t})`,
           !!(after.pill && Math.abs(after.pill.t - pillClosed.t) <= 2));
      }
    } finally {
      await page.close().catch(() => {});
    }
  }

  await browser.close().catch(() => {});
  srv.close();

  const pass = checks - failures.length;
  if (notes.length) {
    console.log('\nNOTES (reported, not asserted):');
    for (const n of notes) console.log('  · ' + n);
  }
  if (failures.length) {
    console.log('\nFAILURES:');
    for (const f of failures) console.log('  - ' + f);
  }
  const ctlName = Object.keys(CTL).filter((k) => CTL[k]).map((k) => '--control-' + k).join(' ');
  console.log(`\n${pass}/${checks} pass` + (ctlName ? `  [${ctlName}]` : '') +
              `  (${VIEWPORTS.length} viewport(s) x ${SHEETS.length} sheets)`);
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
