#!/usr/bin/env node
/* verify-pulse.js — THE PULSE PROOF (Vinta directive 2026-08-14).
   ────────────────────────────────────────────────────────────────────────────
   verify-no-collision.js measures `position:fixed` elements. PULSE renders in
   NORMAL FLOW inside #vtnCardList, so that sweep — correctly — never looks at
   it. This proof covers the gap: it drives real jobs through the live panel and
   measures the actual painted rectangle of every PULSE element.

   WHAT IT ASSERTS, at every width, against adversarial content:
     1. NO-COLLISION — no two PULSE elements' rects intersect. Rows, bars,
        labels, percentages, badges, tab buttons: all of them, pairwise.
     2. NO-OVERFLOW — every row stays inside #vtnCardList's box, and every
        child (label, %, bar fill, detail, meta) stays inside its own row.
     3. THE BAR IS CLIPPED — .vtn-pulse-fill never paints wider than its
        .vtn-pulse-track, even at 100%.
     4. TOUCH TARGETS — every tab button is >= 44px tall.
     5. HONESTY — the rendered % equals round(done/total*100) for determinate
        jobs, and indeterminate jobs render NO percentage at all. This is the
        Retention Doctrine's first test, mechanically enforced: the bar cannot
        drift from the data even by accident.

   ADVERSARIAL CONTENT: a 240-char label, a 300-char detail, a 0% job, a 100%
   job, an indeterminate job, a failed job, and 12 simultaneous rows — because
   the collision law must hold under the worst content, not the demo content.

   USAGE
     node scripts/verify-pulse.js
     VERIFY_WIDTHS=375 node scripts/verify-pulse.js
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

// ── Seed adversarial jobs, then measure everything ──────────────────────────
function seed() {
  const P = window.VintPulse;
  if (!P) return { error: 'VintPulse missing' };

  const LONG_LABEL =
    'eval gauntlet with an absurdly long identifier that no sane caller would ' +
    'ever send but which must not be allowed to shove the percentage readout ' +
    'out of its row or wrap behind a neighbouring element under any condition';
  const LONG_DETAIL =
    'probe_identifier_that_keeps_going_and_going/subsection/deeply/nested/path/' +
    'component_name_with_no_spaces_at_all_so_word_break_cannot_help_it_here/and/' +
    'still/more/segments/to/force/the/single/line/ellipsis/contract/to/prove/out';

  // 0% — a job that just started.
  P.track('t:zero', { label: 'corpus export', total: 500, done: 0 });
  // Mid-flight, ordinary.
  P.track('t:mid', { label: 'eval · g1', total: 50, done: 12, detail: 'g1_012' });
  // 100% but not settled — the bar is full, the job is not done.
  P.track('t:full', { label: 'training pass', total: 80, done: 80 });
  // Adversarial text.
  P.track('t:long', { label: LONG_LABEL, total: 1000, done: 437, detail: LONG_DETAIL });
  // Indeterminate — must render NO number.
  P.indeterminate('t:indet', { label: 'crawler sweep', detail: 'scanning open directories' });
  // Settled states.
  P.track('t:ok', { label: 'memory consolidation', total: 10, done: 10 });
  P.done('t:ok', { ok: true, summary: 'consolidated 10 traces' });
  P.track('t:bad', { label: 'gate · g4', total: 20, done: 7 });
  P.fail('t:bad', 'threshold not cleared');
  // Volume — force the container to scroll.
  for (let i = 0; i < 12; i++) {
    P.track('t:bulk' + i, { label: 'shard ' + i, total: 100, done: i * 7 });
  }
  return { seeded: true };
}

function measure() {
  const out = { rects: [], violations: [], honesty: [], touch: [] };

  const list = document.getElementById('vtnCardList');
  if (!list) { out.violations.push({ kind: 'missing', what: '#vtnCardList' }); return out; }
  const listRect = list.getBoundingClientRect();

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
  // 0.5px tolerance absorbs sub-pixel layout rounding; anything more is real.
  const EPS = 0.5;
  function hits(a, b) {
    return (a.x < b.r - EPS) && (a.r > b.x + EPS) && (a.y < b.b - EPS) && (a.b > b.y + EPS);
  }
  function inside(child, parent, name, pname) {
    if (child.x < parent.x - EPS || child.r > parent.r + EPS ||
        child.y < parent.y - EPS || child.b > parent.b + EPS) {
      out.violations.push({ kind: 'overflow', what: name, of: pname,
        child, parent });
    }
  }

  // ── 1. Rows never intersect each other ────────────────────────────────────
  const rows = Array.from(document.querySelectorAll('.vtn-pulse-row')).filter(vis);
  const rowRects = rows.map(rect);
  for (let i = 0; i < rowRects.length; i++) {
    for (let j = i + 1; j < rowRects.length; j++) {
      if (hits(rowRects[i], rowRects[j])) {
        out.violations.push({ kind: 'collision', what: 'row#' + i + ' × row#' + j,
          a: rowRects[i], b: rowRects[j] });
      }
    }
  }
  out.rects.push({ rows: rowRects.length });

  // ── 2. Every row's children stay inside the row; siblings never intersect ─
  rows.forEach((row, i) => {
    const rr = rect(row);
    // A row is allowed to scroll out of the visible list window (that's what a
    // scroll container is for) — but it must never be WIDER than the list.
    if (rr.x < listRect.x - EPS || rr.right > listRect.right + EPS) {
      out.violations.push({ kind: 'overflow-x', what: 'row#' + i, of: '#vtnCardList',
        child: rr, parent: rect(list) });
    }

    const kids = ['.vtn-pulse-head', '.vtn-pulse-track', '.vtn-pulse-detail', '.vtn-pulse-meta']
      .map(s => row.querySelector(s)).filter(el => el && vis(el));
    const kidRects = kids.map(rect);
    kidRects.forEach((k, n) => inside(k, rr, 'row#' + i + ' ' + kids[n].className, 'row#' + i));
    for (let a = 0; a < kidRects.length; a++) {
      for (let b = a + 1; b < kidRects.length; b++) {
        if (hits(kidRects[a], kidRects[b])) {
          out.violations.push({ kind: 'collision', what: 'row#' + i + ' ' + kids[a].className + ' × ' + kids[b].className,
            a: kidRects[a], b: kidRects[b] });
        }
      }
    }

    // Label vs percentage — the classic long-string failure.
    const lbl = row.querySelector('.vtn-pulse-label');
    const pct = row.querySelector('.vtn-pulse-pct');
    if (lbl && pct && vis(lbl) && vis(pct)) {
      const lr = rect(lbl), pr = rect(pct);
      if (hits(lr, pr)) {
        out.violations.push({ kind: 'collision', what: 'row#' + i + ' label × pct', a: lr, b: pr });
      }
      if (pr.r > rr.r + EPS) {
        out.violations.push({ kind: 'overflow', what: 'row#' + i + ' pct escapes row', child: pr, parent: rr });
      }
    }

    // ── 3. The bar fill is clipped by its track ─────────────────────────────
    const track = row.querySelector('.vtn-pulse-track');
    const fill = row.querySelector('.vtn-pulse-fill');
    if (track && fill && vis(track)) {
      const tr = rect(track), fr = rect(fill);
      // The INDETERMINATE bar is a full-width band deliberately swept past
      // both track edges by `transform: translateX(±62%)`. Its untransformed
      // border-box legitimately reports outside the track, so raw geometry
      // is the wrong assertion — what actually keeps it safe is the track's
      // own `overflow:hidden`. Assert THAT (the real containment contract),
      // and keep the strict geometry rule for determinate bars, which have
      // no transform and must never escape.
      const indeterminate = track.classList.contains('is-indeterminate');
      if (indeterminate) {
        const clip = getComputedStyle(track).overflow;
        if (clip !== 'hidden' && clip !== 'clip') {
          out.violations.push({ kind: 'unclipped-bar', what: 'row#' + i +
            ' indeterminate track does not clip (overflow:' + clip + ')',
            child: fr, parent: tr });
        }
      } else if (fr.r > tr.r + EPS || fr.x < tr.x - EPS || fr.b > tr.b + EPS || fr.y < tr.y - EPS) {
        out.violations.push({ kind: 'unclipped-bar', what: 'row#' + i, child: fr, parent: tr });
      }
    }
  });

  // ── 4. Tab strip: buttons never intersect, 44px touch target ──────────────
  const tabs = Array.from(document.querySelectorAll('.vtn-right-tab')).filter(vis);
  const tabRects = tabs.map(rect);
  for (let i = 0; i < tabRects.length; i++) {
    for (let j = i + 1; j < tabRects.length; j++) {
      if (hits(tabRects[i], tabRects[j])) {
        out.violations.push({ kind: 'collision', what: 'tab#' + i + ' × tab#' + j,
          a: tabRects[i], b: tabRects[j] });
      }
    }
    if (tabRects[i].h < 44 - EPS) {
      out.touch.push({ what: 'tab "' + tabs[i].textContent.trim() + '"', h: tabRects[i].h });
    }
    // The badge must sit inside its button, not over the label.
    const badge = tabs[i].querySelector('.vtn-tab-badge');
    const label = tabs[i].querySelector('.vtn-tab-label');
    if (badge && vis(badge)) {
      inside(rect(badge), tabRects[i], 'tab#' + i + ' badge', 'tab#' + i);
      if (label && vis(label) && hits(rect(badge), rect(label))) {
        out.violations.push({ kind: 'collision', what: 'tab#' + i + ' badge × label',
          a: rect(badge), b: rect(label) });
      }
    }
  }
  out.rects.push({ tabs: tabRects.length });

  // ── 5. HONESTY: rendered % must equal the underlying data ─────────────────
  const jobs = window.VintPulse && window.VintPulse._jobs;
  if (jobs) {
    rows.forEach((row, i) => {
      const id = row.getAttribute('data-pulse-id');
      const j = jobs.get(id);
      if (!j) return;
      const shown = (row.querySelector('.vtn-pulse-pct') || {}).textContent || '';
      const track = row.querySelector('.vtn-pulse-track');
      const indet = track && track.classList.contains('is-indeterminate');

      if (j.status === 'running' && !j.indeterminate && j.total) {
        const expect = Math.round((j.done / j.total) * 100) + '%';
        if (shown.trim() !== expect) {
          out.honesty.push({ id, shown: shown.trim(), expect, done: j.done, total: j.total });
        }
      }
      // Indeterminate work must NEVER display a fabricated number.
      if (j.indeterminate && j.status === 'running') {
        if (/\d/.test(shown)) {
          out.honesty.push({ id, shown: shown.trim(), expect: 'no number (indeterminate)' });
        }
        if (!indet) {
          out.honesty.push({ id, shown: 'determinate bar', expect: 'is-indeterminate track' });
        }
      }
    });
  }

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
    // Offline-by-design: block every external request (the brain API, fonts,
    // CDNs). Critically this also kills the /api/life/stream SSE socket, which
    // never closes — networkidle would hang forever waiting on it. We're
    // proving LAYOUT here, and we seed the job data ourselves below.
    await page.setRequestInterception(true);
    page.on('request', req => {
      const u = req.url();
      if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return req.continue();
      return req.abort();
    });
    await page.goto(`${base}/brain.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 900));  // let the shell paint

    // The panel must be open for its rows to have real rects. On phone widths
    // the shell hides the sidebar behind a pill, so force it visible for the
    // measurement — we are proving PULSE's internal layout, and the sidebar's
    // own placement is already covered by verify-no-collision.js.
    await page.evaluate(() => {
      const sr = document.getElementById('sidebarRight');
      if (sr) {
        sr.style.display = 'block';
        sr.style.visibility = 'visible';
        sr.style.transform = 'none';
        sr.classList.add('is-open');
      }
      if (window.SIDEBAR_RIGHT) window.SIDEBAR_RIGHT.setActive('pulse');
    });
    await new Promise(r => setTimeout(r, 400));

    const seeded = await page.evaluate(seed);
    if (seeded && seeded.error) {
      console.error(`  ✗ ${width}px — ${seeded.error}`);
      failures++;
      await page.close();
      continue;
    }
    // Let the bar transitions settle so we measure final geometry.
    await new Promise(r => setTimeout(r, 900));

    const res = await page.evaluate(measure);
    checks++;

    const bad = res.violations.length + res.honesty.length + res.touch.length;
    if (bad === 0) {
      const rows = (res.rects.find(r => r.rows) || {}).rows || 0;
      const tabs = (res.rects.find(r => r.tabs) || {}).tabs || 0;
      console.log(`  ✓ ${width}px — clean (${rows} rows, ${tabs} tabs measured)`);
    } else {
      failures += bad;
      console.log(`  ✗ ${width}px — ${bad} violation(s)`);
      res.violations.forEach(v => {
        console.log(`      [${v.kind}] ${v.what}`);
        if (v.a && v.b) console.log(`         a=${JSON.stringify(v.a)}\n         b=${JSON.stringify(v.b)}`);
        if (v.child && v.parent) console.log(`         child=${JSON.stringify(v.child)}\n         parent=${JSON.stringify(v.parent)}`);
      });
      res.honesty.forEach(h => console.log(`      [honesty] ${h.id}: shown "${h.shown}" expected "${h.expect}"`));
      res.touch.forEach(t => console.log(`      [touch] ${t.what} height ${t.h}px < 44px`));
    }

    await page.close();
  }

  await browser.close();
  srv.close();

  console.log('');
  if (failures) {
    console.error(`✗ PULSE proof FAILED — ${failures} violation(s) across ${checks} widths`);
    process.exit(1);
  }
  console.log(`✓ PULSE proof clean — ${checks} widths, no collision, no overflow, bars honest`);
})().catch(e => { console.error(e); process.exit(1); });
