#!/usr/bin/env node
'use strict';
// (DCSWR89) The war room's discovery panel: renders lastScan.discovery (or the
// newest discovery_snapshot journal row), picks the NEWER source, and stays
// collision-free at 320/375/768/1280/1920 with long names + long reasons.
// No network: every non-file request is aborted. `--control` strips the panel's
// wrap rules to prove the collision checks can go red.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const file = path.resolve(__dirname, '../mercatus.html');
const CONTROL = process.argv.includes('--control');
let pass = 0, fail = 0;
function check(ok, msg) { if (ok) pass++; else { fail++; console.log('FAIL ' + msg); } }

const row = (symbol, stance, extra) => Object.assign({ symbol, name: symbol + ' Holdings', stance, picked: false,
  score: 1.23, price: 41.5, changePct: 3.21, marketCapB: 12.4, sources: ['gainers', 'trending'],
  reasons: ['liquid: $12.4B cap, 3.2M avg volume', 'momentum: +3.21% today'] }, extra || {});
const LONG = 'Extraordinarily Long Consolidated International Semiconductor & Renewable Infrastructure Holdings Incorporated';
const disc = (at, tag) => ({ at, ok: true, err: null, enabled: true,
  lanes: { day_gainers: { ok: true, n: 25 }, most_actives: { ok: true, n: 25 }, trending: { ok: false, err: 'timeout' } },
  picks: ['NVDA', 'ZZLONGSYM'],
  counts: { seen: 61, pursue: 2, watch: 1, decline: 2 },
  candidates: [
    row('NVDA', 'pursue', { picked: true, name: tag }),
    row('ZZLONGSYM', 'pursue', { picked: true, name: LONG, reasons: ['reason ' + 'very-long-unbroken-token-'.repeat(12), 'second reason that is also quite wordy and keeps going past any sane line length on a phone screen'] }),
    row('AMD', 'watch', { reasons: ['watch: outside the top 2 this tick'] }),
    row('XYZ', 'decline', { changePct: -4.5, score: -0.3, reasons: ['declined: falling AND the news is negative'] }),
  ],
  declined: [row('XYZ', 'decline', { changePct: -4.5, score: -0.3, reasons: ['declined: falling AND the news is negative'] }),
             row('QQQQ', 'decline', { price: null, marketCapB: null, sources: null, reasons: ['declined: news is clearly negative'] })] });

(async () => {
  const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');
  const profile = fs.mkdtempSync('/dev/shm/mercatus-disc-');
  const browser = await puppeteer.launch({ headless: true, pipe: true, userDataDir: profile, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', r => r.url().startsWith('file:') ? r.continue() : r.abort());
    await page.goto(pathToFileURL(file).href);
    await page.evaluate(() => { mcStopPolling(); mcStopLoop(); mcPollAll = () => Promise.resolve(); });
    if (CONTROL) await page.addStyleTag({ content: '.mc-dh{flex-wrap:nowrap!important}.mc-dname{flex:0 0 auto!important;white-space:nowrap!important}.mc-dc{overflow:visible!important}.mc-dwhy{overflow-wrap:normal!important}' });

    const now = Date.now();
    const memAt = new Date(now - 60000).toISOString(), jAt = new Date(now - 600000).toISOString();
    // 1. empty state
    await page.evaluate(() => { window.__mcTestInject({ strat: { config: { scanInterval: 5 } }, history: { history: [] } }); });
    let t = await page.$eval('#mcDiscBody', e => e.textContent);
    check(/No discovery report yet/.test(t), 'empty state names the missing report');
    check(await page.$eval('#mcDiscCount', e => e.textContent) === '—', 'empty count is a dash');

    // 2. journal only → source journal
    await page.evaluate((j) => { window.__mcTestInject({ strat: { lastScan: null }, history: { history: [Object.assign({ timestamp: j.at, type: 'discovery_snapshot', mode: 'live' }, j)] } }); }, disc(jAt, 'JOURNAL-TAG'));
    t = await page.$eval('#mcDiscBody', e => e.textContent);
    check(t.includes('JOURNAL-TAG') && /journal/.test(t), 'journal discovery_snapshot row renders with source=journal');

    // 3. memory newer than journal → memory wins
    await page.evaluate((m, j) => { window.__mcTestInject({ strat: { lastScan: { finishedAt: m.at, discovery: m } }, history: { history: [Object.assign({ timestamp: j.at, type: 'discovery_snapshot' }, j)] } }); }, disc(memAt, 'MEMORY-TAG'), disc(jAt, 'JOURNAL-TAG'));
    t = await page.$eval('#mcDiscBody', e => e.textContent);
    check(t.includes('MEMORY-TAG') && !t.includes('JOURNAL-TAG'), 'newer in-memory report beats older journal row');
    check(await page.$eval('#mcDiscCount', e => e.textContent) === '2 pursue · 1 watch · 2 decline', 'summary count = server counts');
    check(t.includes('Pursued (2)') && t.includes('Watched (1)') && t.includes('Declined (2)'), 'three stance groups with sizes');
    check(t.includes('pursue · picked') && t.includes('declined: falling AND the news is negative'), 'picked flag + written reasons render');
    check(t.includes('day_gainers 25') && t.includes('trending ✕'), 'lane health rendered (n + failure)');
    check(t.includes('+3.21%') && t.includes('-4.50%') && t.includes('$12.40B'), 'change + market cap formatted');
    check(/never/.test(t), 'states a stance is never an order');
    // 4. journal newer than memory → journal wins
    await page.evaluate((m, j) => { window.__mcTestInject({ strat: { lastScan: { finishedAt: m.at, discovery: m } }, history: { history: [Object.assign({ timestamp: j.at, type: 'discovery_snapshot' }, j)] } }); }, disc(jAt, 'MEMORY-TAG'), disc(memAt, 'JOURNAL-TAG'));
    t = await page.$eval('#mcDiscBody', e => e.textContent);
    check(t.includes('JOURNAL-TAG') && !t.includes('MEMORY-TAG'), 'newer journal row beats older memory report');
    // 5. XSS: names are escaped
    await page.evaluate((m) => { m.candidates[0].name = '<img src=x onerror="window.__pwn=1">'; window.__mcTestInject({ strat: { lastScan: { finishedAt: m.at, discovery: m } }, history: { history: [] } }); }, disc(memAt, 'X'));
    check(await page.evaluate(() => !document.querySelector('#mcDiscBody img') && !window.__pwn), 'candidate name is HTML-escaped');

    // 6. collision sweep with the pathological fixture, section open
    await page.evaluate((m) => { window.__mcTestInject({ strat: { lastScan: { finishedAt: m.at, discovery: m }, config: { scanInterval: 5 } }, history: { history: [] } }); document.getElementById('mcSecDisc').open = true; }, disc(memAt, 'A name for NVDA'));
    for (const width of [320, 375, 768, 1280, 1920]) {
      await page.setViewport({ width, height: 900 });
      await page.evaluate(() => mcRenderAll());
      const out = await page.evaluate(() => {
        const f = [];
        const inter = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
        const inside = (a, b) => a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5;
        const sec = document.getElementById('mcSecDisc').getBoundingClientRect();
        if (sec.left < 0 || sec.right > innerWidth + 0.5) f.push('section outside viewport');
        const cards = [...document.querySelectorAll('#mcDiscBody .mc-dc')];
        if (cards.length !== 5) f.push('expected 5 cards, got ' + cards.length);
        cards.forEach((c, i) => {
          const cr = c.getBoundingClientRect();
          if (!inside(cr, sec)) f.push('card ' + i + ' escapes section');
          const parts = [...c.querySelectorAll('.mc-dh>span')].map(e => e.getBoundingClientRect()).filter(r => r.width && r.height);
          for (let a = 0; a < parts.length; a++) { if (!inside(parts[a], cr)) f.push('card ' + i + ' head part escapes'); for (let b = a + 1; b < parts.length; b++) if (inter(parts[a], parts[b])) f.push('card ' + i + ' head parts overlap'); }
          const blocks = [c.querySelector('.mc-dh'), c.querySelector('.mc-tr'), c.querySelector('.mc-dwhy')].filter(Boolean).map(e => e.getBoundingClientRect());
          for (let a = 0; a < blocks.length; a++) { if (!inside(blocks[a], cr)) f.push('card ' + i + ' block ' + a + ' escapes'); for (let b = a + 1; b < blocks.length; b++) if (inter(blocks[a], blocks[b])) f.push('card ' + i + ' blocks overlap'); }
          for (const li of c.querySelectorAll('.mc-dwhy li')) { const r = li.getBoundingClientRect(); if (r.right > cr.right + 0.5) f.push('card ' + i + ' reason overflows right'); }
          for (const cell of c.querySelectorAll('.mc-tr>div')) { const r = cell.getBoundingClientRect(); if (!inside(r, cr)) f.push('card ' + i + ' cell escapes'); }
        });
        for (let a = 0; a < cards.length; a++) for (let b = a + 1; b < cards.length; b++) if (inter(cards[a].getBoundingClientRect(), cards[b].getBoundingClientRect())) f.push('cards overlap');
        // real-geometry overflow (html may hide overflow-x)
        let maxR = 0; for (const e of document.querySelectorAll('#mcSecDisc *')) { const r = e.getBoundingClientRect(); if (r.width && !e.closest('.mc-dc[style]')) maxR = Math.max(maxR, r.right); }
        if (maxR > innerWidth + 0.5) f.push('descendant right edge ' + maxR.toFixed(1) + ' > ' + innerWidth);
        const summ = document.querySelector('#mcSecDisc>summary'); const st = summ.querySelector('.st').getBoundingClientRect(), sc = summ.querySelector('.sc').getBoundingClientRect();
        if (inter(st, sc)) f.push('summary title overlaps count');
        return f;
      });
      check(out.length === 0, width + 'px: ' + (out.join('; ') || 'clean'));
    }
    if (!CONTROL) { await page.setViewport({ width: 375, height: 900 }); await page.evaluate(() => document.getElementById('mcSecDisc').scrollIntoView({ block: 'start', behavior: 'instant' })); await page.screenshot({ path: '/tmp/mercatus-discovery-375.png' }); }
    check(errors.length === 0, 'no page errors: ' + errors.join(' | '));
  } finally { await browser.close(); fs.rmSync(profile, { recursive: true, force: true }); }
  console.log(`DCSWR89 discovery panel: ${pass}/${pass + fail} pass${CONTROL ? ' (CONTROL: wrap rules stripped)' : ''}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
