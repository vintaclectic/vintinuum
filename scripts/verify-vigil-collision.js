#!/usr/bin/env node
/* verify-vigil-collision.js — THE PIXEL PROOF, WITH THE WORLD ACTUALLY ALIVE.
   ────────────────────────────────────────────────────────────────────────────
   WHY THIS EXISTS, ON TOP OF verify-no-collision.js

   verify-no-collision.js loads every page offline and proves no two fixed
   elements overlap. It is honest and it passes — but on world.html it can only
   ever measure the EMPTY vigil. The brain is unreachable in that harness, so
   `living` never arrives, #vintWorldHud renders its degraded bare-bar path, and
   the panel is at its SHORTEST. The collision risk THE VIGIL introduced is the
   exact opposite case: a panel made content-driven, at its TALLEST.

   A populated vigil adds, below the currency row:
       state head + meter + floor caption + drift line + the world's line
       + "N standing watch" + up to 8 watcher orbs (+overflow chip)
       + the concrete ask (two lines) + the reach row
       + a 4th action button (✦ tend your court)
   That is ~150-190px of growth in a fixed-position panel whose downstairs
   neighbour, #hint, used to sit at a HAND-COUNTED top:274px. So the empty-state
   sweep passing proves nothing about the state this feature actually ships.

   This harness injects a maximal `living` payload straight into the surface
   (dispatching the same vint:world-state event world-client.js would), then
   reuses the exact same rectangle probe and asserts:
     1. no two visible fixed elements overlap (the law, at full content);
     2. #hint sits BELOW #vintWorldHud's real bottom — i.e. --vint-hud-bottom
        is being published and honoured, not the 274px fallback;
     3. the panel stays inside the viewport (no overflow off the bottom) at
        every breakpoint, including 320px-wide and short-viewport phones;
     4. the re-entry/homecoming state renders without colliding with anything,
        whichever treatment it uses (modal, toast or inline — reported, not
        dictated; only the no-collision result is enforced).

   IMPLEMENTATION-AGNOSTIC BY DESIGN. THE VIGIL was built twice, in parallel
   seats, with different markup for the same truth — and an assertion written
   against one seat's class names failed the other seat's perfectly correct
   surface. So the checks here feature-detect the CONTRACT (the panel grew and
   is showing the server's state/drift; a tend control exists) rather than
   matching any one commit's DOM. A future redesign of the vigil should not have
   to edit this file to stay honest; only a genuine collision should fail it.

   RUN IT FROM THE WORKTREE YOU WANT TO PROVE — it measures whatever
   world.html + body/world/* are on disk beside it.

   USAGE
     node scripts/verify-vigil-collision.js
     VERIFY_WIDTHS=375,1280 node scripts/verify-vigil-collision.js

   Exits non-zero on any violation, so it can gate the commit.
*/
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');

// 320 and 375 are the phones the law names; 360x640 is the short-viewport case
// where a tall panel is most likely to run off the bottom.
const WIDTHS = (process.env.VERIFY_WIDTHS || '320,375,768,1280,1920')
  .split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean);
const HEIGHTS = { 320: 568, 375: 667, 768: 1024, 1280: 800, 1920: 1080 };

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

// ── THE MAXIMAL LIVING PAYLOAD ──────────────────────────────────────────────
// Shaped EXACTLY like vigil.reconcile()'s return (world/vigil.js in the API
// repo). Every field is at its most space-consuming legal value: 12 watchers so
// the orb row shows 8 + an overflow chip, the longest state word, a drift that
// triggers the losing branch (the longest of the three sentences), an ask that
// clears its threshold, and both reach cells present.
const LIVING_MAX = {
  spark: 41.6, floor: 30, max: 100,
  state: 'guttering',
  line: 'the clearing has drawn in close, and the lanterns lean toward the dark',
  driftPerDay: 4.8,
  hoursToFloor: 58,
  homecoming: 0,
  vigil: {
    agents: 12, standing: 12, perDay: 1.2,
    watchers: [
      { id: 'a1',  name: 'Aetherhold the Long-Watching', color: '#a67cff', watch: 1 },
      { id: 'a2',  name: 'Vesper',   color: '#ffd479', watch: 0.92 },
      { id: 'a3',  name: 'Corvid',   color: '#7ccfff', watch: 0.71 },
      { id: 'a4',  name: 'Marrow',   color: '#57e08c', watch: 0.55 },
      { id: 'a5',  name: 'Tinder',   color: '#ffb066', watch: 0.4 },
      { id: 'a6',  name: 'Quill',    color: '#c77b7b', watch: 0.31 },
      { id: 'a7',  name: 'Hollow',   color: '#9a86d8', watch: 0.22 },
      { id: 'a8',  name: 'Ash',      color: '#ffd479', watch: 0.13 },
      { id: 'a9',  name: 'Ninth',    color: '#7ccfff', watch: 0.1 },
      { id: 'a10', name: 'Tenth',    color: '#57e08c', watch: 0.08 },
      { id: 'a11', name: 'Eleventh', color: '#ffb066', watch: 0.05 },
      { id: 'a12', name: 'Twelfth',  color: '#a67cff', watch: 0.02 },
    ],
    nextAgentPerDay: 3.8,
    // ── THE CONSEQUENCE TIER's slot cap (AETHERHOLD 2026-08-05) ──────────────
    // The tier caps how many watches a dim clearing can keep awake; the resting
    // ones are drawn dimmed BESIDE the awake ones (never removed) plus a caption
    // explaining they return. That is another orb row's worth of content and a
    // two-line caption, so the maximal payload must carry it or this harness
    // would certify a panel shorter than the one that actually ships.
    slots: 3,
    resting: 9,
    resters: [
      { id: 'r1', name: 'Ninth',    color: '#7ccfff', watch: 0.1 },
      { id: 'r2', name: 'Tenth',    color: '#57e08c', watch: 0.08 },
      { id: 'r3', name: 'Eleventh', color: '#ffb066', watch: 0.05 },
      { id: 'r4', name: 'Twelfth',  color: '#a67cff', watch: 0.02 },
    ],
  },
  reach: { buildRadius: 4.6, maxStake: 615 },
  // ── THE CONSEQUENCE TIER band — the loss + the way back, both at their
  // longest legal strings (the `deep` variant, which is what guttering renders).
  tier: {
    state: 'guttering', yield: 0.55, yieldPct: 55, watchSlots: 3, visitors: true,
    loss: 'little light left to work by — the ground gives grudgingly.',
    next: { state: 'dimming', yieldPct: 75, at: 30 },
    boon: null,
  },
  watchSlots: 3,
  // ── THE SLUMBER note — the longest of its two forms (with the wake promise).
  slumber: {
    steps: 2, days: 23, sparkState: 'warm', wakesOnArrival: true,
    line: 'your clearing has been sleeping — no one has walked in for 23 days. it wakes the moment you do.',
  },
  safe: true,
  neverDestroyed: true,
};

// the homecoming case — same payload, plus the gift that opens the modal
const LIVING_HOME = Object.assign({}, LIVING_MAX, { homecoming: 40 });

const RESIDENT = { lumen: 128340, echo: 9912, standing: 47, spark: 41.6, claim: null };

// ── the probe: byte-identical semantics to verify-no-collision.js ────────────
function probe() {
  const vw = window.innerWidth, vh = window.innerHeight;

  function visible(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity) === 0) return false;
    const ownText = Array.from(el.childNodes)
      .filter(n => n.nodeType === 3).map(n => n.nodeValue).join('').trim();
    if (cs.backgroundColor === 'rgba(0, 0, 0, 0)' &&
        cs.backgroundImage === 'none' &&
        cs.borderStyle === 'none' &&
        cs.boxShadow === 'none' &&
        !ownText) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 12 && r.height <= 12 &&
        cs.pointerEvents === 'none' && !el.children.length &&
        !el.textContent.trim()) return false;
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
    rects.push({
      id: el.id || '',
      cls: (el.className && el.className.baseVal !== undefined
              ? el.className.baseVal : String(el.className || '')).slice(0, 60),
      tag: el.tagName.toLowerCase(),
      x: r.left, y: r.top, w: r.width, h: r.height, _el: el,
    });
  }

  const hits = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a._el.contains(b._el) || b._el.contains(a._el)) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 1 && oy > 1) {
        hits.push({
          a: a.id || a.tag + '.' + a.cls, b: b.id || b.tag + '.' + b.cls,
          overlap: Math.round(ox) + 'x' + Math.round(oy),
          aRect: [a.x, a.y, a.w, a.h].map(Math.round).join(','),
          bRect: [b.x, b.y, b.w, b.h].map(Math.round).join(','),
        });
      }
    }
  }

  // ── the vigil-specific assertions ──
  const hud = document.getElementById('vintWorldHud');
  const hint = document.getElementById('hint');
  const published = getComputedStyle(document.documentElement)
    .getPropertyValue('--vint-hud-bottom').trim();

  const hudR = hud ? hud.getBoundingClientRect() : null;
  const hintR = hint ? hint.getBoundingClientRect() : null;
  const hintShown = hint && getComputedStyle(hint).display !== 'none';

  return {
    hits,
    fixedCount: rects.length,
    published,
    hud: hudR ? { top: Math.round(hudR.top), bottom: Math.round(hudR.bottom), h: Math.round(hudR.height) } : null,
    hint: (hintR && hintShown) ? { top: Math.round(hintR.top), bottom: Math.round(hintR.bottom) } : null,
    // did the vigil actually render? (guards against a silently-empty pass)
    statusRect: (function () {
      var s = document.getElementById('status');
      if (!s) return null;
      var r = s.getBoundingClientRect();
      var cs = getComputedStyle(s);
      return {
        top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
        opacity: cs.opacity, cssTop: cs.top, maxH: cs.maxHeight,
        railtop: getComputedStyle(document.documentElement).getPropertyValue('--dv-railtop').trim(),
      };
    })(),
    // ── DID THE VIGIL ACTUALLY RENDER? ──────────────────────────────────────
    // FEATURE-DETECTED, NOT MARKUP-MATCHED. This guard exists so a run where
    // `living` never reached the panel cannot report a smug pass on what is
    // really the empty state. But asserting on one implementation's class names
    // (.wh-floorcap, .wh-orb) would make this harness a cast of a single commit:
    // it failed against a leaner VIGIL that was perfectly correct, simply
    // because it drew the same truth with different elements. So we detect the
    // CONTRACT instead — the panel grew, and it is showing the server's numbers.
    // Any honest vigil surface satisfies this; no vigil surface fakes it.
    vigilRendered: (function () {
      var box = document.getElementById('whVigil');
      if (!box) return false;
      var t = (box.textContent || '').trim();
      if (!t) return false;
      // The state word is the one thing ONLY a rendered vigil can produce: it is
      // echoed straight from living.state, so it cannot appear from the currency
      // row, the bare-bar fallback, or any static markup. A digit test was tried
      // and is wrong — the panel is full of digits either way, so it passed on a
      // tree that had no vigil at all. This is the honest tell.
      return /guttering|dimming|radiant|warm|ember/i.test(t);
    })(),
    // the tend control is the one element the loop cannot exist without: it is
    // the act. Looked up by id OR by its label, so a re-skin doesn't false-fail.
    hasTend: !!(document.getElementById('whTend') ||
      Array.prototype.some.call(document.querySelectorAll('#vintWorldHud button'),
        function (b) { return /tend/i.test(b.textContent || ''); })),
    // the homecoming is OPTIONAL surface — some implementations pay it as a
    // toast rather than a modal. Reported, never asserted (see below).
    homeShown: (function () {
      var h = document.getElementById('whHomeWrap');
      return !!(h && h.classList && h.classList.contains('show'));
    })(),
    vh,
  };
}

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await puppeteer.launch({
    headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const failures = [];
  const homecomingSeen = { modal: 0, inline: 0 };
  let checks = 0;

  for (const w of WIDTHS) {
    for (const scenario of ['populated', 'homecoming']) {
      const page = await browser.newPage();
      page.on('dialog', d => d.dismiss().catch(() => {}));
      await page.setRequestInterception(true);
      page.on('request', req => {
        const u = req.url();
        if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return req.continue();
        req.abort().catch(() => {});
      });
      // signed-in: the vigil is an owner surface
      await page.evaluateOnNewDocument(() => {
        try {
          localStorage.setItem('vint_token', 'verify-vigil-token');
          localStorage.setItem('soul_auth_token', 'verify-vigil-token');
        } catch (_) {}
      });
      await page.setViewport({ width: w, height: HEIGHTS[w] || 800, deviceScaleFactor: 1 });

      try {
        await page.goto(`${base}/world.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        // let the HUD mount
        await new Promise(r => setTimeout(r, 1200));

        // drive the surface exactly as world-client.js would
        await page.evaluate((living, resident) => {
          window.dispatchEvent(new CustomEvent('vint:world-state', {
            detail: { resident, living },
          }));
        }, scenario === 'homecoming' ? LIVING_HOME : LIVING_MAX, RESIDENT);

        // the homecoming is deliberately delayed ~900ms + a paint frame
        await new Promise(r => setTimeout(r, scenario === 'homecoming' ? 1800 : 700));

        // ── WAIT FOR QUIESCENCE, DON'T GUESS AT IT ──────────────────────────
        // A single sample after a fixed sleep is how a layout harness lies in
        // BOTH directions: sample too early and you report a transient that
        // settles (a false alarm), sample once and you can miss a transient that
        // a real user would see. #vintWorldHud's publishBottom() is debounced
        // 40ms and then calls DirverseHUD.relayout(), and the rail's own
        // launchers mount asynchronously — so the column genuinely moves for a
        // few hundred ms after world:state and then stops.
        //
        // So: poll the three rects until they are IDENTICAL across consecutive
        // samples (settled), and fail if they never settle. Anything the law
        // cares about is a state the user can actually sit and look at.
        const settled = await page.evaluate(async () => {
          const key = () => ['vintWorldHud', 'status', 'hint', 'dvRail'].map(id => {
            const e = document.getElementById(id);
            if (!e) return '-';
            const cs = getComputedStyle(e);
            if (cs.display === 'none' || cs.visibility === 'hidden') return 'x';
            const r = e.getBoundingClientRect();
            return [r.left, r.top, r.width, r.height].map(Math.round).join(',');
          }).join('|');
          let last = key(), stable = 0;
          for (let i = 0; i < 60; i++) {           // up to ~3s
            await new Promise(r => setTimeout(r, 50));
            const now = key();
            if (now === last) { if (++stable >= 4) return true; }  // 200ms quiet
            else { stable = 0; last = now; }
          }
          return false;
        });

        const res = await page.evaluate(probe);
        if (!settled) {
          failures.push(`${w}px/${scenario}: the left column never stopped moving ` +
            `(3s) — a layout that never settles cannot be proven collision-free`);
        }
        checks++;
        const tag = `${w}px/${scenario}`;

        if (res.hits.length) {
          failures.push(`${tag}: ${res.hits.length} overlap(s)\n` +
            res.hits.map(h => `      ${h.a} [${h.aRect}]  ×  ${h.b} [${h.bRect}]  = ${h.overlap}`).join('\n'));
        }

        if (scenario === 'populated') {
          // the vigil must actually have rendered, or this run proved nothing
          if (!res.vigilRendered) {
            failures.push(`${tag}: the vigil did not render — this run proves nothing`);
          }
          if (res.hasTend === false) {
            failures.push(`${tag}: the tend button is missing with a 12-agent court`);
          }
          // #hint must follow the panel, not the 274px literal
          if (res.hint && res.hud && res.hint.top < res.hud.bottom) {
            failures.push(`${tag}: #hint (top ${res.hint.top}) is above #vintWorldHud's bottom ` +
              `(${res.hud.bottom}) — --vint-hud-bottom is not being honoured [published: ${res.published || 'unset'}]`);
          }
          if (res.hint && !res.published) {
            failures.push(`${tag}: --vint-hud-bottom was never published; #hint is on the stale fallback`);
          }
          // the panel must not run off the bottom of the viewport
          if (res.hud && res.hud.bottom > res.vh + 1) {
            failures.push(`${tag}: #vintWorldHud overflows the viewport ` +
              `(bottom ${res.hud.bottom} > ${res.vh}) — a content-driven panel must scroll internally`);
          }
        }

        // THE HOMECOMING is deliberately NOT asserted. Whether the re-entry gift
        // is paid as a modal, a toast or an inline line is a design choice, and
        // this harness exists to enforce the no-collision law, not to freeze one
        // treatment. What it DOES enforce is the part the law owns: if a modal
        // does open, the hit-test above has already proven it collides with
        // nothing. We only report which treatment was seen.
        if (scenario === 'homecoming') homecomingSeen[res.homeShown ? 'modal' : 'inline']++;

        process.stdout.write('.');
      } catch (e) {
        failures.push(`${w}px/${scenario}: ${e.message}`);
        process.stdout.write('!');
      } finally {
        await page.close().catch(() => {});
      }
    }
  }

  await browser.close();
  srv.close();

  console.log('\n');
  if (failures.length) {
    console.error('✗ VIGIL COLLISION PROOF FAILED\n');
    failures.forEach(f => console.error('  ' + f));
    console.error(`\n  ${failures.length} failure(s) across ${checks} renders`);
    process.exit(1);
  }
  console.log(`✓ vigil collision proof clean — ${checks} renders ` +
    `(${WIDTHS.length} widths × populated + homecoming)`);
  console.log(`  widths: ${WIDTHS.join(', ')}`);
  console.log(`  homecoming treatment: ${homecomingSeen.modal} modal, ${homecomingSeen.inline} inline/toast`);
})();
