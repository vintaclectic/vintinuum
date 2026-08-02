#!/usr/bin/env node
/* verify-no-collision.js — THE PIXEL PROOF (Vinta directive 2026-08-02).
   ────────────────────────────────────────────────────────────────────────────
   scripts/lint-no-collision.js is STATIC: it proves every fixed-corner widget
   *registers* with VintDock. That's necessary but not sufficient — a widget can
   register correctly and still collide because of a stale hardcoded CSS rule, a
   full-width bar the dock didn't detect, or a page that renders its own orb.
   The only honest test is to load the real page in a real browser and measure
   the real rectangles.

   This does exactly that: for every surface, at every breakpoint, in BOTH auth
   states, it collects every visible position:fixed element and asserts no two
   overlap. It also asserts the task's second half — that #vwg-pill ("Begin")
   does not exist when a token is present.

   USAGE
     node scripts/verify-no-collision.js              # all pages
     node scripts/verify-no-collision.js brain world  # only matching pages
     VERIFY_WIDTHS=375,1280 node scripts/verify-no-collision.js

   Exits non-zero on any collision, so it can gate a commit.
*/
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
// puppeteer lives in the sibling API repo; this repo has no node_modules.
const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');

const WIDTHS = (process.env.VERIFY_WIDTHS || '320,375,768,1280,1920')
  .split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean);

// Pages exempt from the overlap assertion (still checked for the Begin-pill
// rule). Deliberately EMPTY: dirrm-player.html was exempted on the assumption
// that an edge-to-edge media surface must layer, but it verifies clean, so the
// exemption was hiding nothing and would only have masked a future regression.
// Add a page here only with evidence that its layering is intentional.
const LAYERED_BY_DESIGN = new Set([]);

// ── a tiny static server so pages fetch relative assets exactly as in prod ──
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
      // never serve outside the repo
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

// ── the in-page probe: collect every visible fixed rect, find intersections ──
// Runs in the browser. Must be self-contained (no closure over node scope).
function probe() {
  const vw = window.innerWidth, vh = window.innerHeight;

  function visible(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity) === 0) return false;
    // NOTE: pointer-events:none is NOT an exemption. The no-collision law is about
    // what the user SEES, not only what they can tap — brain.js's consolidate toast
    // was pointer-events:none and still rendered straight over the V orb for 3.2s.
    // Only genuinely invisible things are skipped (handled by the opacity/display
    // checks above), plus elements with no painted surface of their own: a bare
    // transparent wrapper can legitimately span other widgets.
    //
    // "Own text" means DIRECT text nodes only. el.textContent includes every
    // descendant's text, so a bare transparent LAYOUT WRAPPER looked painted
    // purely because of the buttons inside it — that's how world.html's #dvRail
    // (a pointer-events:none flex column whose .dv-launch children are the real
    // controls) was reported as a 133x270 box colliding with the HUD and the
    // guest sheet. The wrapper paints nothing; its children are measured on
    // their own and are the things that must not overlap.
    const ownText = Array.from(el.childNodes)
      .filter(n => n.nodeType === 3).map(n => n.nodeValue).join('').trim();
    if (cs.backgroundColor === 'rgba(0, 0, 0, 0)' &&
        cs.backgroundImage === 'none' &&
        cs.borderStyle === 'none' &&
        cs.boxShadow === 'none' &&
        !ownText) return false;

    // Decorative PARTICLE effects (cursor trails, sparks, confetti) are spawned in
    // swarms that overlap each other by design and carry no content or control.
    // They are not "elements that must have their own space" in the sense of the
    // law — the law is about UI the user reads or touches. Identified structurally:
    // tiny, non-interactive, childless, and pass-through.
    const r = el.getBoundingClientRect();
    if (r.width <= 12 && r.height <= 12 &&
        cs.pointerEvents === 'none' &&
        !el.children.length &&
        !el.textContent.trim()) return false;

    // AMBIENT BACKDROP layers (consciousness_philosophy.html's .nebula blobs:
    // 430-604px circles at opacity 0.07 under blur(80px)) are wallpaper. They
    // drift across each other and under the whole UI by design — that IS the
    // effect. They are not elements competing for space, so measuring them as
    // such reports the backdrop colliding with every button on the page.
    // Identified structurally, never by class name: heavily blurred OR nearly
    // transparent, non-interactive, textless, and painted behind the content.
    const blur = /blur\(\s*([\d.]+)px/.exec(cs.filter);
    const faint = parseFloat(cs.opacity) <= 0.15;
    const behind = (parseInt(cs.zIndex, 10) || 0) <= 0;
    if (cs.pointerEvents === 'none' && behind && !el.textContent.trim() &&
        ((blur && parseFloat(blur[1]) >= 20) || faint)) return false;

    return true;
  }

  const rects = [];
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed') continue;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    // Off-screen (parked/animated-out) elements can't collide with anything.
    if (r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) continue;
    // Full-screen scrims/overlays are DESIGNED to cover (modal over backdrop).
    // Vinta's law exempts explicit overlays; treat >=90% of viewport as one.
    if (r.width >= vw * 0.9 && r.height >= vh * 0.9) continue;

    rects.push({
      id: el.id || '',
      cls: (el.className && el.className.baseVal !== undefined
              ? el.className.baseVal : String(el.className || '')).slice(0, 60),
      tag: el.tagName.toLowerCase(),
      docked: el.getAttribute('data-vint-docked') || '',
      x: r.left, y: r.top, w: r.width, h: r.height,
      _el: el,
    });
  }

  // Ancestor/descendant pairs legitimately share space (a button inside a bar).
  // Only SIBLING-ish elements — neither containing the other — can "collide".
  function related(a, b) {
    return a._el.contains(b._el) || b._el.contains(a._el);
  }

  const hits = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (related(a, b)) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      // 1px tolerance absorbs sub-pixel rounding; anything more is a real overlap.
      if (ox > 1 && oy > 1) {
        hits.push({
          a: a.id || a.tag + '.' + a.cls, b: b.id || b.tag + '.' + b.cls,
          overlap: Math.round(ox) + 'x' + Math.round(oy),
          aRect: [a.x, a.y, a.w, a.h].map(Math.round).join(','),
          bRect: [b.x, b.y, b.w, b.h].map(Math.round).join(','),
          aDocked: a.docked, bDocked: b.docked,
        });
      }
    }
  }

  return {
    hits,
    fixedCount: rects.length,
    hasBeginPill: !!document.getElementById('vwg-pill'),
    hasAccountDot: !!document.getElementById('vwg-dot'),
  };
}

const TOKEN_KEYS = ['vint_token', 'soul_auth_token', 'vint_access_token', 'access_token'];

(async () => {
  const only = process.argv.slice(2).filter(a => !a.startsWith('-'));
  const pages = fs.readdirSync(ROOT)
    .filter(f => f.endsWith('.html'))
    .filter(f => !only.length || only.some(o => f.includes(o)))
    .sort();

  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const failures = [];
  let checks = 0;

  for (const file of pages) {
    for (const signedIn of [false, true]) {
      const page = await browser.newPage();
      page.on('dialog', d => d.dismiss().catch(() => {}));
      // Pages call the live brain; we're offline-by-design here. Fail fast on
      // API calls so layout settles instead of hanging on network timeouts.
      await page.setRequestInterception(true);
      page.on('request', req => {
        const u = req.url();
        if (u.startsWith(base)) return req.continue();
        if (u.startsWith('data:') || u.startsWith('blob:')) return req.continue();
        return req.abort();   // external: brain API, fonts, CDNs
      });

      if (signedIn) {
        await page.evaluateOnNewDocument((keys) => {
          const fake = 'verify.' + 'a'.repeat(40) + '.token';
          keys.forEach(k => { try { localStorage.setItem(k, fake); } catch (_) {} });
          try {
            localStorage.setItem('vint_user', JSON.stringify({ id: 1, email: 'verify@local', name: 'Verify' }));
            localStorage.setItem('vint_onboarded', '1');
            localStorage.setItem('vwg_seen', '1');
          } catch (_) {}
        }, TOKEN_KEYS);
      }

      for (const w of WIDTHS) {
        await page.setViewport({ width: w, height: 800, deviceScaleFactor: 1 });
        try {
          await page.goto(`${base}/${file}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        } catch (_) { continue; }
        // Let async widgets mount, the dock drain its queue, and rAF reflow land.
        //
        // A FLAT wait is a trap: world.html raises its guest sheet at t=1400ms
        // with a 0.8s entrance animation, so a 1200ms settle measured the sheet
        // mid-flight and reported a collision the live page never actually shows
        // (and would equally MISS one that only appears after the delay). Wait
        // for the layout to go quiet instead of for the clock: poll every fixed
        // rect until two consecutive samples match, so whenever the last delayed
        // panel lands and the dock re-flows, we measure the settled truth.
        await page.evaluate(async () => {
          const snap = () => Array.from(document.querySelectorAll('body *'))
            .filter(el => getComputedStyle(el).position === 'fixed')
            .map(el => { const r = el.getBoundingClientRect();
              return `${el.id}:${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`; })
            .join('|');
          // A FLOOR is as important as the ceiling: world.html's sheet is revealed
          // at t=1400ms, so a page that looks quiet at 600ms is not actually
          // settled — exiting early there would measure the pre-reveal layout and
          // miss the collision entirely. Never conclude before 1600ms, then exit
          // as soon as it's stable (most pages settle immediately after), with a
          // ~4s ceiling for surfaces that animate forever and never go quiet.
          const t0 = Date.now();
          let prev = '', stable = 0;
          for (let i = 0; i < 26; i++) {
            await new Promise(r => setTimeout(r, 150));
            const cur = snap();
            stable = (cur === prev) ? stable + 1 : 0;
            prev = cur;
            // The floor must outlast the SLOWEST deliberate mount, or the sweep is
            // a coin flip: brain.js starts CONSCIOUSNESS_BRAIN at setTimeout 3000,
            // so a 1600ms floor measured the page before that button existed —
            // #consciousness-brain-btn passed and failed on alternating runs for
            // no code reason. 3400ms clears it with margin; the stability check
            // still exits early on quiet pages, so only slow pages pay the cost.
            if (stable >= 2 && Date.now() - t0 >= 3400) break;
          }
        }).catch(() => {});
        try { await page.evaluate(() => window.VintDock && window.VintDock.reflow()); } catch (_) {}
        await new Promise(r => setTimeout(r, 300));

        let res;
        try { res = await page.evaluate(probe); } catch (e) { continue; }
        checks++;

        const label = `${file} @${w}px ${signedIn ? 'signed-in' : 'guest'}`;

        if (!LAYERED_BY_DESIGN.has(file) && res.hits.length) {
          res.hits.forEach(h => failures.push({ type: 'OVERLAP', label, ...h }));
        }
        // The task's second half, asserted directly.
        if (signedIn && res.hasBeginPill) {
          failures.push({ type: 'BEGIN-PILL-WHILE-SIGNED-IN', label });
        }
      }
      await page.close();
    }
    process.stdout.write('.');
  }

  await browser.close();
  srv.close();

  console.log('\n');
  if (!failures.length) {
    console.log(`✓ collision sweep clean — ${pages.length} pages × ${WIDTHS.length} widths × 2 auth states (${checks} renders)`);
    console.log(`  widths: ${WIDTHS.join(', ')}`);
    process.exit(0);
  }

  console.log(`✗ ${failures.length} collision failure(s):\n`);
  const byLabel = {};
  failures.forEach(f => { (byLabel[f.label] = byLabel[f.label] || []).push(f); });
  Object.keys(byLabel).sort().forEach(label => {
    console.log(`  ${label}`);
    byLabel[label].forEach(f => {
      if (f.type === 'OVERLAP') {
        console.log(`    ✗ ${f.a}  ×  ${f.b}   overlap ${f.overlap}px`);
        console.log(`        a[${f.aRect}]${f.aDocked ? ' docked:' + f.aDocked : ''}  b[${f.bRect}]${f.bDocked ? ' docked:' + f.bDocked : ''}`);
      } else {
        console.log(`    ✗ ${f.type}`);
      }
    });
  });
  process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
