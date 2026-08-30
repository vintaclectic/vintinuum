#!/usr/bin/env node
/* verify-estate-buyable.js — THE ESTATE PROOF (task XQDPW7G).
   ────────────────────────────────────────────────────────────────────────────
   Estate ($499) is the tier Lord Vinta chose to LEAD with, and it is the only
   one-time price we sell. Everything else is recurring, and that asymmetry has
   now broken the buy button twice:

     1. billing.js hardcoded mode:'subscription'. Stripe hard-rejects a one_time
        price in subscription mode, so Estate 500'd on every click. Fixed in
        vintinuum-api 69f719c by reading price.type and matching the mode.

     2. THIS ONE — upgrade.html stamped every button with the page's CURRENT
        interval: data-interval="${interval}". Estate has NO stripe_yearly_price_id
        (yearly_price_cents is 0 in tier_definitions). So if a visitor clicked
        "yearly" before clicking Estate, the client sent interval:'yearly', the
        backend looked up the empty yearly price, and threw price-not-configured.
        The highest-value thing we sell, silently unbuyable — for exactly the
        visitors most likely to toggle yearly, i.e. the ones shopping hardest.

   Both bugs are invisible to a collision sweep and to any check of the monthly
   default: the page renders beautifully and the price reads "$499 one-time ·
   forever" in BOTH toggle states. Only the button's payload is wrong. That is
   what this script reads.

   WHAT IT ASSERTS (per toggle state: monthly AND yearly)
     1. Estate renders a real, enabled buy button
     2. that button carries data-interval="monthly" — NEVER "yearly" — because a
        one-time price has no interval and yearly resolves to nothing
     3. Estate's displayed price stays $499 and stays labelled one-time in both
        states (the toggle must not appear to discount a one-time purchase)
     4. the recurring tiers DO still track the toggle (proves the fix is targeted
        and did not just freeze every button to monthly)

   It stubs /api/tiers with the SHAPE THE LIVE BRAIN ACTUALLY RETURNS, including
   estate.yearly_price_cents === 0, which is the precise condition that triggers
   the bug.

   USAGE
     node scripts/verify-estate-buyable.js

   Exits non-zero on any violation, so it can gate a commit.
*/
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');

const puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer');

const ROOT = path.resolve(__dirname, '..');

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

// The tier list, copied from what localhost:8767/api/tiers actually returns.
// estate.yearly_price_cents === 0 is not a simplification — it is the live value,
// and it is the whole reason this test exists.
const TIERS = [
  { tier: 'free',      display_name: 'Visitor',   monthly_price_cents: 0,     yearly_price_cents: 0,     description: "come in. she'll remember you.",        sort_order: 0, enabled: 1 },
  { tier: 'companion', display_name: 'Companion', monthly_price_cents: 900,   yearly_price_cents: 9000,  description: 'she keeps you. you keep her.',         sort_order: 1, enabled: 1 },
  { tier: 'theater',   display_name: 'Theater',   monthly_price_cents: 1500,  yearly_price_cents: 15000, description: 'the room knows what to play.',         sort_order: 2, enabled: 1 },
  { tier: 'sovereign', display_name: 'Sovereign', monthly_price_cents: 2900,  yearly_price_cents: 29000, description: 'her brain learns yours.',              sort_order: 3, enabled: 1 },
  { tier: 'estate',    display_name: 'Estate',    monthly_price_cents: 49900, yearly_price_cents: 0,     description: "the part of you that doesn't end.",    sort_order: 4, enabled: 1 },
];

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const failures = [];
  let checks = 0;
  const fail = (type, msg) => failures.push({ type, msg });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // Stub the brain. Billing must report enabled, or every CTA renders as the
    // inert "free while we build" button and this test would pass vacuously.
    await page.setRequestInterception(true);
    page.on('request', req => {
      const url = req.url();
      const json = body => req.respond({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(body),
      });
      if (url.includes('/api/tiers'))          return json({ ok: true, tiers: TIERS, gates_live: true });
      if (url.includes('/api/billing/status')) return json({ ok: true, enabled: true, mode: 'live', gates_live: true });
      if (url.includes('/api/me') || url.includes('/api/tier')) return json({ ok: true, tier: 'free' });
      if (url.includes('/api/')) return json({ ok: true });
      return req.continue();
    });

    // Dismiss the first-visit welcome gate BEFORE the page scripts run. Its
    // scrim (.vwg-sheet, z-index 2147483640) covers the interval toggle, so a
    // real click lands on the gate and the toggle never fires — the test would
    // "pass" while never actually reaching the yearly state, which is the only
    // state the bug lives in. A visitor comparing tiers is a returning visitor
    // who has already cleared the gate, so this models the real path.
    await page.evaluateOnNewDocument(() => {
      try { localStorage.setItem('vwg_dismissed', String(Date.now())); } catch (_) {}
      try { localStorage.setItem('vwg_seen', '1'); } catch (_) {}
    });

    await page.goto(`${base}/upgrade.html`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('.tier--estate', { timeout: 10000 });

    const closeLane = await page.evaluate(() => {
      const lane = document.getElementById('estateCloseLane');
      const cta = document.querySelector('[data-estate-now]');
      return {
        laneText: lane ? lane.textContent : '',
        ctaText: cta ? cta.textContent : '',
      };
    });
    checks++;
    if (!/\$499/.test(closeLane.laneText) || !/Estate/i.test(closeLane.laneText)) {
      fail('CLOSE-LANE', 'the revenue close lane must lead with the $499 Estate offer');
    }
    checks++;
    if (!/Estate Checkout/i.test(closeLane.ctaText)) {
      fail('CLOSE-CTA', 'the close-lane CTA must send visitors straight to Estate checkout');
    }

    // Guard the guard: if the gate ever stops honoring vwg_dismissed, fail loudly
    // here rather than silently reporting green on an unclicked toggle.
    const blocked = await page.evaluate(() => {
      const b = document.getElementById('btnYearly');
      if (!b) return 'no #btnYearly';
      const r = b.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return (top === b || b.contains(top)) ? null
        : `#btnYearly is covered by ${top ? top.tagName + '.' + top.className : 'null'}`;
    });
    checks++;
    if (blocked) fail('UNCLICKABLE', `the interval toggle cannot be clicked — ${blocked}`);

    // Read every tier's button payload + displayed price in the current state.
    const readBoard = () => page.evaluate(() => {
      const out = {};
      document.querySelectorAll('.tier').forEach(el => {
        const tier = [...el.classList].map(c => c.match(/^tier--(.+)$/)).find(Boolean);
        if (!tier) return;
        const btn = el.querySelector('button.cta');
        const priceEl = el.querySelector('.price');
        out[tier[1]] = {
          hasButton: !!btn,
          disabled: btn ? btn.disabled : null,
          interval: btn ? btn.getAttribute('data-interval') : null,
          dataTier: btn ? btn.getAttribute('data-tier') : null,
          price: priceEl ? priceEl.textContent.trim() : '',
        };
      });
      return out;
    });

    const activeToggle = () => page.evaluate(() =>
      document.querySelector('.interval-toggle button.active')?.id || null);

    for (const state of ['monthly', 'yearly']) {
      if (state === 'yearly') {
        await page.click('#btnYearly');
        // renderTiers() runs after an async loadTiers() fetch — wait for the
        // recurring price to actually change rather than racing it.
        await page.waitForFunction(
          () => /\$90\b/.test(document.querySelector('.tier--companion .price')?.textContent || ''),
          { timeout: 10000 }
        );
      }

      const board = await readBoard();
      const label = `[${state}]`;

      const toggle = await activeToggle();
      const wantToggle = state === 'yearly' ? 'btnYearly' : 'btnMonthly';
      checks++;
      if (toggle !== wantToggle) fail('TOGGLE', `${label} active toggle is ${toggle}, expected ${wantToggle}`);

      const estate = board.estate;
      checks++;
      if (!estate || !estate.hasButton) {
        fail('NO-BUTTON', `${label} Estate rendered no buy button at all — it cannot be purchased`);
      } else {
        checks++;
        if (estate.disabled) fail('DISABLED', `${label} Estate's buy button is disabled`);

        // ── THE ASSERTION THIS FILE EXISTS FOR ──────────────────────────────
        // Estate has no yearly price. Sending interval:"yearly" makes the
        // backend throw price-not-configured and the sale dies.
        checks++;
        if (estate.interval !== 'monthly') {
          fail('ESTATE-INTERVAL',
            `${label} Estate's button carries data-interval="${estate.interval}" — ` +
            `Estate has NO yearly price, so checkout will throw price-not-configured. ` +
            `A one-time price must always be requested as "monthly".`);
        }

        checks++;
        if (estate.dataTier !== 'estate') fail('ESTATE-TIER', `${label} Estate button data-tier is "${estate.dataTier}"`);

        // The toggle must not appear to discount a one-time purchase.
        checks++;
        if (!/\$499/.test(estate.price)) {
          fail('ESTATE-PRICE', `${label} Estate price reads "${estate.price}", expected $499`);
        }
        checks++;
        if (!/one-time/i.test(estate.price)) {
          fail('ESTATE-LABEL', `${label} Estate price "${estate.price}" lost its one-time label`);
        }
      }

      // Control group: recurring tiers MUST still follow the toggle. Without
      // this, "freeze every button to monthly" would pass the test above while
      // silently destroying yearly billing for the tiers that support it.
      for (const t of ['companion', 'theater', 'sovereign']) {
        const row = board[t];
        checks++;
        if (!row || !row.hasButton) { fail('MISSING', `${label} ${t} rendered no button`); continue; }
        checks++;
        if (row.interval !== state) {
          fail('RECURRING-INTERVAL',
            `${label} ${t} carries data-interval="${row.interval}" but the toggle is "${state}" — ` +
            `recurring tiers must track the toggle`);
        }
      }

      const companion = board.companion;
      if (companion) {
        checks++;
        const wantPrice = state === 'yearly' ? /\$90\b/ : /\$9\b/;
        if (!wantPrice.test(companion.price)) {
          fail('RECURRING-PRICE', `${label} companion price reads "${companion.price}" in ${state} mode`);
        }
      }
    }

    let estateCheckoutBody = null;
    const auto = await browser.newPage();
    await auto.setViewport({ width: 1280, height: 900 });
    await auto.setRequestInterception(true);
    auto.on('request', req => {
      const url = req.url();
      const json = body => req.respond({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(body),
      });
      if (url.includes('/api/tiers'))          return json({ ok: true, tiers: TIERS, gates_live: true });
      if (url.includes('/api/billing/status')) return json({ ok: true, enabled: true, mode: 'live', gates_live: true });
      if (url.includes('/api/me') || url.includes('/api/tier')) return json({ ok: true, tier: 'free' });
      if (url.includes('/api/billing/checkout')) {
        estateCheckoutBody = req.postData();
        return json({ ok: true, url: `${base}/paid.html` });
      }
      if (url.includes('/api/')) return json({ ok: true });
      return req.continue();
    });
    await auto.evaluateOnNewDocument(() => {
      try { localStorage.setItem('vwg_dismissed', String(Date.now())); } catch (_) {}
      try { localStorage.setItem('vwg_seen', '1'); } catch (_) {}
    });
    await auto.goto(`${base}/upgrade.html?tier=estate&interval=yearly`, { waitUntil: 'networkidle0', timeout: 30000 });
    await auto.waitForFunction(() => location.href.includes('/paid.html'), { timeout: 10000 });
    checks++;
    if (!estateCheckoutBody) {
      fail('ESTATE-AUTO-CHECKOUT', 'the Estate direct-link route did not open checkout');
    } else {
      const parsed = JSON.parse(estateCheckoutBody);
      checks++;
      if (parsed.tier !== 'estate') fail('ESTATE-AUTO-TIER', `Estate direct-link checkout sent tier="${parsed.tier}"`);
      checks++;
      if (parsed.interval !== 'monthly') {
        fail('ESTATE-AUTO-INTERVAL',
          `Estate direct-link checkout sent interval="${parsed.interval}" from a yearly URL; one-time Estate must stay monthly`);
      }
    }
    await auto.close();
  } finally {
    await browser.close();
    srv.close();
  }

  // A run that asserted nothing is a FAILURE, not a pass — the same false green
  // scripts/verify-one-sheet.js was fixed for in 28b97b3. Two toggle states,
  // ~13 assertions each.
  const MIN = 24;
  if (checks < MIN) {
    console.log(`✗ THE ESTATE PROOF asserted only ${checks} of an expected ${MIN} checks — it verified almost nothing.`);
    failures.forEach(f => console.log(`    ✗ ${f.type} ${f.msg}`));
    process.exit(1);
  }

  if (!failures.length) {
    console.log(`✓ THE ESTATE PROOF — ${checks} checks across the monthly and yearly toggle`);
    console.log('  Estate stays $499 one-time and always requests the price that exists,');
    console.log('  while the recurring tiers still follow the toggle.');
    process.exit(0);
  }

  console.log(`✗ THE ESTATE PROOF — ${failures.length} violation(s):`);
  failures.forEach(f => console.log(`    ✗ ${f.type}  ${f.msg}`));
  process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
