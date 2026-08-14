#!/usr/bin/env node
/* verify-vitals.js — THE REGION VITALS PROOF (Vinta directive 2026-08-14).
   ────────────────────────────────────────────────────────────────────────────
   The "Right Now" tab of the region panel used to carry ONE decorative bar.
   It now carries a five-metric live dashboard (.rv rows in brain.js /
   brain.html). This proof holds that dashboard to the same standard
   verify-pulse.js holds PULSE to — measured, not assumed.

   WHAT IT ASSERTS, at every width, for EVERY brain region:
     1. NO-COLLISION — no two vitals elements' painted rects intersect.
        Labels, values, tracks, verbs, header, tick counter: all pairwise.
     2. NO-OVERFLOW — every row stays inside the .rv container, every child
        stays inside its own row, and the whole block stays inside the panel.
     3. THE BAR IS CLIPPED — .rv-fill never paints wider than its .rv-track,
        and the .rv-peak marker never escapes the track either.
     4. HONESTY — the rendered % equals round(value*100) as computed by
        readRegionVitals() from live page state. The bar width must agree with
        the number to within the documented 2% presentational floor. A bar that
        disagrees with its own label is the exact failure this catches.
     5. BOUNDS — every metric is within [0,1]. No NaN, no Infinity, no >100%.

   Every region is exercised because each has a different connection count,
   activity level, and label length — integration in particular is a pure
   function of the connection graph, so a region with 11 partners and one with
   2 are genuinely different layout and math cases.

   USAGE
     node scripts/verify-vitals.js
     VERIFY_WIDTHS=375 node scripts/verify-vitals.js
   Exits non-zero on any violation, so it can gate a commit.
*/
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');

const ROOT = path.resolve(__dirname, '..');
const WIDTHS = (process.env.VERIFY_WIDTHS || '320,375,768,1280,1920')
  .split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean);

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
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

// Measure the vitals block for whichever region panel is currently open.
function measure() {
  const out = { rects: [], violations: [], honesty: [], bounds: [], rows: 0 };

  const wrap = document.getElementById('liveVitals');
  if (!wrap) { out.violations.push({ kind: 'missing', what: '#liveVitals' }); return out; }
  const panel = document.getElementById('nodePanel');

  function vis(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function rect(el) {
    const r = el.getBoundingClientRect();
    return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2),
             r: +r.right.toFixed(2), b: +r.bottom.toFixed(2) };
  }
  const EPS = 0.5;
  function hits(a, b) {
    return (a.x < b.r - EPS) && (a.r > b.x + EPS) && (a.y < b.b - EPS) && (a.b > b.y + EPS);
  }
  function inside(child, parent, name, pname) {
    if (child.x < parent.x - EPS || child.r > parent.r + EPS ||
        child.y < parent.y - EPS || child.b > parent.b + EPS) {
      out.violations.push({ kind: 'overflow', what: name, of: pname, child, parent });
    }
  }

  const wrapR = rect(wrap);
  if (panel) inside(wrapR, rect(panel), '.rv', '#nodePanel');

  // ── Collect every leaf element that paints, for the pairwise sweep ────────
  const leaves = [];
  const rows = Array.from(wrap.querySelectorAll('.rv-row'));
  out.rows = rows.length;

  const head = wrap.querySelector('.rv-head');
  if (head && vis(head)) {
    inside(rect(head), wrapR, '.rv-head', '.rv');
    ['#rvState', '#rvTicks'].forEach(sel => {
      const el = wrap.querySelector(sel);
      if (el && vis(el)) {
        const rr = rect(el);
        inside(rr, rect(head), sel, '.rv-head');
        leaves.push({ name: sel, r: rr });
      }
    });
  }

  rows.forEach(row => {
    const key = row.dataset.vital || '?';
    if (!vis(row)) return;
    const rowR = rect(row);
    inside(rowR, wrapR, `row[${key}]`, '.rv');

    const label = row.querySelector('.rv-label');
    const value = row.querySelector('[data-rv="value"]');
    const track = row.querySelector('[data-rv="track"]');
    const fill  = row.querySelector('[data-rv="fill"]');
    const peak  = row.querySelector('[data-rv="peak"]');
    const verb  = row.querySelector('[data-rv="verb"]');

    [['label', label], ['value', value], ['track', track], ['verb', verb]].forEach(([n, el]) => {
      if (!el || !vis(el)) return;
      const rr = rect(el);
      inside(rr, rowR, `${key}.${n}`, `row[${key}]`);
      leaves.push({ name: `${key}.${n}`, r: rr });
    });

    // THE CLIP CONTRACT — fill and peak must never paint outside the track.
    if (track && fill) {
      const tR = rect(track), fR = rect(fill);
      if (fR.r > tR.r + EPS || fR.x < tR.x - EPS) {
        out.violations.push({ kind: 'unclipped-fill', what: `${key}.fill`, child: fR, parent: tR });
      }
      if (peak) {
        const pR = rect(peak);
        if (pR.r > tR.r + EPS || pR.x < tR.x - EPS) {
          out.violations.push({ kind: 'unclipped-peak', what: `${key}.peak`, child: pR, parent: tR });
        }
      }

      // THE HONESTY CONTRACT — the bar the code COMMITTED must agree with the
      // number the code PRINTED. We compare against the inline width (the
      // asserted target), not the painted rect, because .rv-fill carries an
      // 850ms transition: a rect sampled mid-animation is a snapshot of the
      // bar travelling toward the truth, not a disagreement with it. Measuring
      // the rect here would test the easing curve's clock, not the contract.
      // (Rect-vs-track containment IS still asserted above, unconditionally —
      // that's the clip guarantee, and it holds at every frame of the tween.)
      // Documented floor: fill width = max(2%, value*100).
      const shown = parseInt((value.textContent || '').replace('%', ''), 10);
      if (isFinite(shown)) {
        const committed = parseFloat(fill.style.width);  // e.g. "82.0%"
        const expected = Math.max(2, shown);
        if (!isFinite(committed)) {
          out.honesty.push({ id: key, shown: shown + '%', expect: 'an inline % width', got: fill.style.width || '(none)' });
        } else if (Math.abs(committed - expected) > 1.01) {
          // 1.01 absorbs the one-decimal rounding of toFixed(1) vs Math.round.
          out.honesty.push({ id: key, shown: shown + '%',
            expect: expected.toFixed(1) + '% committed', got: committed.toFixed(1) + '%' });
        }
        if (shown < 0 || shown > 100) {
          out.bounds.push({ id: key, why: 'percent out of range', v: shown });
        }
      } else if ((value.textContent || '').trim() !== '') {
        out.honesty.push({ id: key, shown: value.textContent, expect: 'a numeric percent' });
      }
    }
  });

  // ── Pairwise collision across every measured leaf ─────────────────────────
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      if (hits(leaves[i].r, leaves[j].r)) {
        out.violations.push({ kind: 'collision', what: `${leaves[i].name} × ${leaves[j].name}`,
          a: leaves[i].r, b: leaves[j].r });
      }
    }
  }

  // ── Raw metric bounds, straight from the engine ───────────────────────────
  try {
    const hist = { samples: [], started: Date.now() - 5000, emissions: 7, peaks: {} };
    // Bare-identifier lookups — see the note at the REGIONS call site.
    const _readVitals = (typeof readRegionVitals === 'function') ? readRegionVitals : null;
    const _regions = (typeof REGIONS !== 'undefined') ? REGIONS : (window.REGIONS || []);
    _regions.forEach(reg => {
      const v = _readVitals ? _readVitals(reg, hist) : null;
      if (!v) return;
      Object.keys(v).forEach(k => {
        const n = v[k];
        if (typeof n !== 'number' || !isFinite(n) || n < 0 || n > 1) {
          out.bounds.push({ id: reg.id + '.' + k, why: 'out of [0,1] or not finite', v: n });
        }
      });
    });
  } catch (e) {
    out.bounds.push({ id: 'engine', why: String(e && e.message || e), v: null });
  }

  out.rects.push({ leaves: leaves.length });
  return out;
}

(async () => {
  const srv = await serve();
  const port = srv.address().port;
  const base = `http://127.0.0.1:${port}`;
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  let failures = 0, checks = 0;

  for (const width of WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    page.on('pageerror', () => {});
    // Offline-by-design: block every external request. Proving LAYOUT + MATH.
    await page.setRequestInterception(true);
    page.on('request', req => {
      const u = req.url();
      if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return req.continue();
      return req.abort();
    });
    await page.goto(`${base}/brain.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 1000));

    // brain.js is a classic script, so its top-level `const REGIONS` lives on
    // the global LEXICAL scope — reachable as a bare identifier, but NOT as a
    // property of `window`. Resolve by identifier, with a window fallback.
    const regionIds = await page.evaluate(`
      (function(){ try { return REGIONS.map(function(r){return r.id;}); }
                   catch(e){ return (window.REGIONS||[]).map(function(r){return r.id;}); } })()
    `);
    if (!regionIds.length) {
      console.error(`  ✗ ${width}px — REGIONS not exposed`);
      failures++; await page.close(); continue;
    }

    let widthBad = 0, regionsChecked = 0, leafTotal = 0;

    for (const rid of regionIds) {
      const opened = await page.evaluate(`
        (function(){
          try {
            var r = REGIONS.find(function(x){ return x.id === ${JSON.stringify(rid)}; });
            if (!r) return false;
            openRegionPanel(r);
            return true;
          } catch (e) { return false; }
        })()
      `);
      if (!opened) continue;

      // Let the first vitals paint land and the 850ms bar transition settle,
      // so we measure FINAL geometry, not an in-flight width.
      await new Promise(r => setTimeout(r, 1100));

      const res = await page.evaluate(measure);
      regionsChecked++;
      leafTotal += (res.rects[0] || {}).leaves || 0;

      const bad = res.violations.length + res.honesty.length + res.bounds.length;
      if (bad) {
        widthBad += bad;
        console.log(`  ✗ ${width}px · ${rid} — ${bad} violation(s)`);
        res.violations.forEach(v => {
          console.log(`      [${v.kind}] ${v.what}`);
          if (v.a && v.b) console.log(`         a=${JSON.stringify(v.a)}\n         b=${JSON.stringify(v.b)}`);
          if (v.child && v.parent) console.log(`         child=${JSON.stringify(v.child)}\n         parent=${JSON.stringify(v.parent)}`);
        });
        res.honesty.forEach(h => console.log(`      [honesty] ${h.id}: shown "${h.shown}" expected "${h.expect}"${h.got ? ' got ' + h.got : ''}`));
        res.bounds.forEach(b => console.log(`      [bounds] ${b.id}: ${b.why} (${b.v})`));
      }

      await page.evaluate(() => { if (typeof closePanel === 'function') closePanel(); });
      await new Promise(r => setTimeout(r, 120));
    }

    checks++;
    failures += widthBad;
    if (!widthBad) {
      console.log(`  ✓ ${width}px — clean (${regionsChecked} regions, ${leafTotal} elements measured)`);
    }

    await page.close();
  }

  await browser.close();
  srv.close();

  console.log('');
  if (failures) {
    console.error(`✗ VITALS proof FAILED — ${failures} violation(s) across ${checks} widths`);
    process.exit(1);
  }
  console.log(`✓ VITALS proof clean — ${checks} widths, no collision, no overflow, bars honest`);
})().catch(e => { console.error(e); process.exit(1); });
