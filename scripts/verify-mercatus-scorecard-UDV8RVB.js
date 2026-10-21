#!/usr/bin/env node
'use strict';
// (UDV8RVB) The war room's discovery cards now render the multi-factor scorecard:
// a thesis line, four factor bars, an in-flow veto box, folded evidence, and a
// header row with the weights in force + the grading record. This proves it is
// correct AND collision-free at 320/375/768/1280/1920 with pathological content
// (long thesis, long unbroken veto token, legacy no-factor rows mixed in).
// No network: every non-file request is aborted.
//   --control  breaks the layout contract (fixed-width track, nowrap veto); the
//              collision checks MUST go red.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const file = path.resolve(__dirname, '../mercatus.html');
const CONTROL = process.argv.includes('--control');
let pass = 0, fail = 0;
function check(ok, msg) { if (ok) pass++; else { fail++; console.log('FAIL ' + msg); } }

const FX = (t, m, q, n) => ({ trend: t, momentum: m, quality: q, news: n });
const row = (symbol, stance, extra) => Object.assign({ symbol, name: symbol + ' Holdings', stance, picked: false,
  score: 72.4, price: 41.5, changePct: 3.21, marketCapB: 12.4, sources: ['day gainer', 'trending'],
  factors: FX(88, 61, 74, 55), risk: [], vetoes: [],
  thesis: 'Pursue at 72.4/100 — strongest on trend 88, quality 74',
  reasons: ['up 3.2% today', '+12.0% vs 200-day average', 'analysts 1.8 (Buy)', 'news positive (0.40 over 5 opinionated headlines)'] }, extra || {});
const LONG = 'Extraordinarily Long Consolidated International Semiconductor & Renewable Infrastructure Holdings Incorporated';
const VETO = 'pinned to a pending acquisition — upside capped at the deal price, downside is a deal break ("' + 'Megacorp-agrees-to-acquire-'.repeat(8) + '")';
const disc = (learning) => ({ at: new Date(Date.now() - 60000).toISOString(), ok: true, err: null, enabled: true,
  lanes: { day_gainers: { ok: true, n: 25 } }, picks: ['HAS', 'ZZLONG'],
  counts: { seen: 131, pursue: 2, watch: 1, decline: 2 },
  scorecard: { seed: { trend: 0.3, momentum: 0.2, quality: 0.2, news: 0.3 },
    weights: learning ? { trend: 0.36, momentum: 0.15, quality: 0.22, news: 0.27 } : { trend: 0.3, momentum: 0.2, quality: 0.2, news: 0.3 },
    grading: learning ? { observed: 900, graded: 212, minGraded: 40, horizonDays: 5, learning: true, pickedExcessPct: 1.42, restExcessPct: -0.31, pickedN: 40 }
      : { observed: 30, graded: 0, minGraded: 40, horizonDays: 5, learning: false, pickedExcessPct: null, restExcessPct: null } },
  candidates: [
    row('HAS', 'pursue', { picked: true, factors: FX(97, 83.9, 85, 100), score: 88.5, thesis: 'Pursue at 88.5/100 — strongest on news 100, trend 97 — risk: intraday range 8.4% of price — violent tape' }),
    row('ZZLONG', 'pursue', { picked: true, name: LONG, factors: FX(0, 100, -5, 140), thesis: 'Pursue at 61/100 — ' + 'a-very-long-unbroken-thesis-token-'.repeat(6) }),
    row('TSM', 'watch', { thesis: 'Watch at 67.1/100 — strongest on quality 92, trend 76' }),
  ],
  declined: [
    row('BRZE', 'decline', { score: 65.3, factors: FX(99.8, 98.5, 65.8, 75), vetoes: [VETO], thesis: 'Decline at 65.3/100 — strongest on trend 100, momentum 99 — VETO: pinned to a pending acquisition',
      reasons: ['up 51.7% today', 'declined: ' + VETO] }),
    // A legacy journal row (attention score, no scorecard) must still render.
    { symbol: 'OLD', name: 'Legacy Row', stance: 'decline', score: -0.3, price: 10, changePct: -4.5, marketCapB: 3, sources: ['day loser'],
      reasons: ['declined: falling AND the news is negative'] },
  ] });

(async () => {
  const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');
  const profile = fs.mkdtempSync('/dev/shm/mercatus-udv-');
  const browser = await puppeteer.launch({ headless: true, pipe: true, userDataDir: profile, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith('file:') ? r.continue() : r.abort());
    await page.goto(pathToFileURL(file).href);
    await page.evaluate(() => { mcStopPolling(); mcStopLoop(); mcPollAll = () => Promise.resolve(); });
    if (CONTROL) await page.addStyleTag({ content: '.mc-dfx{grid-template-columns:66px 420px 34px!important}.mc-dveto{overflow-wrap:normal!important;white-space:nowrap!important}.mc-dc{overflow:visible!important}' });
    const inject = (d) => page.evaluate((m) => { window.__mcTestInject({ strat: { lastScan: { finishedAt: m.at, discovery: m }, config: { scanInterval: 5 } }, history: { history: [] } }); document.getElementById('mcSecDisc').open = true; }, d);

    // ── content ──
    await inject(disc(false));
    let t = await page.$eval('#mcDiscBody', e => e.textContent);
    check(/Pursue at 88\.5\/100 — strongest on news 100, trend 97/.test(t), 'thesis line renders');
    check(t.includes('88.5/100'), 'composite rendered as /100 when factors are present');
    check(t.includes('-0.30'), 'legacy row (no factors) keeps its old score format');
    check(/weights.*trend 30 · momentum 20 · quality 20 · news 30 \(seed\)/.test(t) && /0\/40 graded — seed weights until then/.test(t), 'header: seed weights + grading progress');
    check(/Veto · pinned to a pending acquisition/.test(t), 'veto box renders the veto');
    const bars = await page.$$eval('#mcDiscBody .mc-dc', cs => cs.map(c => [...c.querySelectorAll('.mc-dfx-f')].map(f => f.style.width)));
    check(bars[1].map(parseFloat).join(',') === '0,100,0,100', 'out-of-range factor values are clamped to 0..100% (' + bars[1].join(',') + ')');
    check(bars[4].length === 0, 'legacy row renders no factor bars');
    const open = await page.$$eval('#mcDiscBody .mc-dc', cs => cs.map(c => { const d = c.querySelector('.mc-dmore'); return d ? (d.open ? 'open' : 'closed') : (c.querySelector('.mc-dwhy') ? 'list' : 'none'); }));
    check(open.slice(0, 4).every(s => s === 'closed') && open[4] === 'list', 'evidence folded for scorecard rows, open list for legacy rows (' + open.join(',') + ')');
    await inject(disc(true));
    t = await page.$eval('#mcDiscBody', e => e.textContent);
    check(/\(learned\)/.test(t) && /picked \+1\.42% vs rest -0\.31% over SPY \(212 graded\)/.test(t), 'header: learned weights + measured record');
    await page.evaluate(() => { const m = window.MC.strat.lastScan.discovery; m.candidates[0].name = '<img src=x onerror="window.__pwn=1">'; m.candidates[0].vetoes = ['<img src=y onerror="window.__pwn=2">']; m.candidates[0].thesis = '<b id=pwn3>x</b>'; mcRenderAll(); });
    check(await page.evaluate(() => !document.querySelector('#mcDiscBody img') && !document.getElementById('pwn3') && !window.__pwn), 'name, veto and thesis are HTML-escaped');

    // ── collision sweep, evidence OPEN (worst case) ──
    await inject(disc(true));
    for (const width of [320, 375, 768, 1280, 1920]) {
      await page.setViewport({ width, height: 900 });
      await page.evaluate(() => { mcRenderAll(); document.querySelectorAll('#mcDiscBody .mc-dmore').forEach(d => { d.open = true; }); });
      const out = await page.evaluate(() => {
        const f = [];
        const inter = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
        const inside = (a, b) => a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5;
        const sec = document.getElementById('mcSecDisc').getBoundingClientRect();
        const cards = [...document.querySelectorAll('#mcDiscBody .mc-dc')];
        if (cards.length !== 5) f.push('expected 5 cards, got ' + cards.length);
        cards.forEach((c, i) => {
          const cr = c.getBoundingClientRect();
          if (!inside(cr, sec)) f.push('card ' + i + ' escapes section');
          const blocks = [...c.children].map(e => [e.className, e.getBoundingClientRect()]).filter(([, r]) => r.width && r.height);
          for (let a = 0; a < blocks.length; a++) {
            if (!inside(blocks[a][1], cr)) f.push('card ' + i + ' ' + blocks[a][0] + ' escapes card');
            for (let b = a + 1; b < blocks.length; b++) if (inter(blocks[a][1], blocks[b][1])) f.push('card ' + i + ' ' + blocks[a][0] + ' × ' + blocks[b][0]);
          }
          const g = c.querySelector('.mc-dfx');
          if (g) {
            const gr = g.getBoundingClientRect();
            const cells = [...g.children].map(e => e.getBoundingClientRect());
            if (cells.length !== 12) f.push('card ' + i + ' factor grid has ' + cells.length + ' cells');
            for (let a = 0; a < cells.length; a++) {
              if (!inside(cells[a], gr)) f.push('card ' + i + ' factor cell ' + a + ' escapes grid');
              for (let b = a + 1; b < cells.length; b++) if (inter(cells[a], cells[b])) f.push('card ' + i + ' factor cells ' + a + '×' + b);
            }
            for (const tr of g.querySelectorAll('.mc-dfx-t')) { const r = tr.getBoundingClientRect(); const fr = tr.firstChild.getBoundingClientRect(); if (fr.width && !inside(fr, r)) f.push('card ' + i + ' fill escapes track'); if (r.width < 24) f.push('card ' + i + ' track only ' + r.width.toFixed(1) + 'px'); }
          }
          for (const li of c.querySelectorAll('.mc-dwhy li')) { const r = li.getBoundingClientRect(); if (r.right > cr.right + 0.5) f.push('card ' + i + ' reason overflows'); }
        });
        for (let a = 0; a < cards.length; a++) for (let b = a + 1; b < cards.length; b++) if (inter(cards[a].getBoundingClientRect(), cards[b].getBoundingClientRect())) f.push('cards overlap');
        let maxR = 0; for (const e of document.querySelectorAll('#mcSecDisc *')) { const r = e.getBoundingClientRect(); if (r.width) maxR = Math.max(maxR, r.right); }
        if (maxR > innerWidth + 0.5) f.push('descendant right edge ' + maxR.toFixed(1) + ' > ' + innerWidth);
        return f;
      });
      check(out.length === 0, width + 'px: ' + (out.slice(0, 6).join('; ') || 'clean'));
    }
    if (!CONTROL) { await page.setViewport({ width: 375, height: 1400 }); await page.evaluate(() => document.querySelector('#mcDiscBody .mc-dc').scrollIntoView({ block: 'start', behavior: 'instant' })); await page.screenshot({ path: '/tmp/mercatus-scorecard-375.png' }); }
    check(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  } finally { await browser.close(); fs.rmSync(profile, { recursive: true, force: true }); }
  console.log(`UDV8RVB scorecard cards: ${pass}/${pass + fail} pass${CONTROL ? ' (CONTROL: layout contract broken)' : ''}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
