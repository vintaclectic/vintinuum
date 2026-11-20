#!/usr/bin/env node
'use strict';
/* ───────────────────────────────────────────────────────────────────────────
   verify-treasury-reload-RVCP3MY.js — the acceptance's own LIVE tests.

   The card's acceptance has two clauses no static or hermetic check can
   settle, because both are about what a real page does across a real reload:

     · "reload does NOT reset numbers"
     · "zero localStorage writes for ledger state"

   The mock this card replaced failed the first one BY CONSTRUCTION: its
   treasury was a module-scope object seeded with a flat 1000 per agent, so
   every reload wiped it and re-invented it. This drives the LIVE site in a
   real browser, reads the rendered band, reloads, and reads it again.

   ONE browser, serially. Never run this alongside another headless browser —
   two at once manufacture timing reds indistinguishable from real ones
   (9SABEEP) — and check `uptime` first: on an 8-core box a load average over
   ~8 invalidates the measurement.

   This is a LIVE harness (it needs the public site and the public brain), so
   it is NOT a gate check. Run it after a deploy.

   Usage:  node scripts/verify-treasury-reload-RVCP3MY.js
   Env:    RVCP3MY_SITE, RVCP3MY_API, RVCP3MY_PUPPETEER
   ─────────────────────────────────────────────────────────────────────────── */
// puppeteer lives in the sibling brain repo (see CLAUDE.md "Two-repo
// coordination"); this repo ships no node_modules. Overridable so the harness
// can run anywhere the module is installed.
const path = require('path');
const os = require('os');
const PUPPETEER = process.env.RVCP3MY_PUPPETEER ||
  path.join(os.homedir(), 'vintinuum-api', 'node_modules', 'puppeteer');
const puppeteer = require(PUPPETEER);
const URL = process.env.RVCP3MY_SITE || 'https://vintinuum.com/world.html';
const API = (process.env.RVCP3MY_API || 'https://api.vintaclectic.com') + '/api/world/treasury';

let pass = 0; const fails = [];
const is = (l, ok, d) => { if (ok) { pass++; console.log('  PASS  ' + l); } else { fails.push(l + (d ? ' — ' + d : '')); console.log('  FAIL  ' + l + (d ? ' — ' + d : '')); } };
const eq = (l, g, w) => is(l, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w));

async function readPass(page, label) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#worldMapButton', { timeout: 40000 });
  // THE LAUNCHER IS GUEST-GATED, and that is why this harness opens the panel
  // programmatically instead of clicking the pill.
  //
  // MEASURED on the live site (700ms trajectory probe + a two-load state probe):
  //   t=0     #topctl 63x148 flex,  #worldMapButton 62x44 block
  //   t=700   #topctl display:none, button rect [0,0]
  //   t=2100  body gains `vw-doorway`, #invite 500x199 .show
  //   after "just look around": #invite -> .show.min, body loses vw-doorway,
  //           but #topctl STAYS display:none — it is never restored.
  // On a WARM load the doorway is already up at t=0, so there is no window at
  // all. CAUSE, read from the source: guestOverlay() in world.html runs
  //   ['saybar','movectl','topctl','hint'].forEach(id => el.style.display='none')
  // as an INLINE style, deliberately, "so a guest never taps a dead control".
  // #topctl happens to hold the read-only map/history/folk/treasury launcher,
  // which needs no sign-in, and nothing ever clears that inline style.
  //
  // PRE-EXISTING, not this card's: `git diff` over this card's commits adds not
  // one line matching topctl/display:none/vw-doorway/visibility:hidden, and
  // every #topctl line is byte-identical to the commit before it (only line
  // numbers moved). Filed separately. So this harness does NOT assert launcher
  // reachability — that would be asserting a promise nobody made (NFQ2EU6) — it
  // REPORTS what it measured and invokes the panel's real click handler
  // directly, which is the same code path the pill fires.
  const reach = await page.evaluate(() => {
    const b = document.getElementById('worldMapButton');
    const top = document.getElementById('topctl');
    if (!b) return { ok: false, why: 'no #worldMapButton' };
    const r = b.getBoundingClientRect();
    const tcs = top ? getComputedStyle(top).display : 'no #topctl';
    if (r.width < 1 || r.height < 1) {
      return { ok: false, rect: [0, 0],
               why: 'guest-gated: #topctl computes display:' + tcs +
                    (top && top.style.display ? ' (inline "' + top.style.display + '", set by guestOverlay)' : '') };
    }
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const onTop = hit === b || b.contains(hit);
    return { ok: onTop, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
             why: onTop ? 'clear' : 'covered by ' + (hit ? hit.tagName + (hit.id ? '#' + hit.id : '') : 'null') };
  });
  console.log('    [' + label + '] NOTE launcher: ' + reach.why);
  // Invoke the panel's own handler. Not page.click(): a display:none element has
  // no clickable point, and the launcher's visibility is a separate, filed issue.
  await page.evaluate(() => document.getElementById('worldMapButton').click());
  // the mock's own report, taken from the live page
  const mock = await page.evaluate(() => ({
    isMockFlag: window.__AGENT_LEDGER_IS_MOCK,
    armed: window.__AGENT_LEDGER_ARMED,
    realSource: window.__AGENT_LEDGER_REAL_SOURCE,
    isMock: typeof AgentLedger !== 'undefined' ? AgentLedger.isMock() : 'NO GLOBAL',
    balEmber: typeof AgentLedger !== 'undefined' ? AgentLedger.balance('citizen_ember') : 'NO GLOBAL',
    balAsh: typeof AgentLedger !== 'undefined' ? AgentLedger.balance('anything') : 'NO GLOBAL',
    snap: typeof AgentLedger !== 'undefined' ? JSON.stringify(AgentLedger.snapshot()) : 'NO GLOBAL',
    realMoney: typeof AgentLedger !== 'undefined' ? AgentLedger.isRealMoneyEnabled() : 'NO GLOBAL',
  }));
  await page.waitForSelector('#worldTreasury', { timeout: 20000 });
  await page.evaluate(() => { const d = document.getElementById('worldTreasury'); if (!d.open) d.open = true; d.dispatchEvent(new Event('toggle')); });
  await page.waitForFunction(() => {
    const b = document.getElementById('worldTreasBody');
    return !!b && b.querySelectorAll('.wd-treas li').length > 0;
  }, { timeout: 40000 });
  const band = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.wd-treas li')].map((li) => ({
      who: li.querySelector('.wd-who').textContent.trim(),
      coin: Number(li.querySelector('.wd-coin').textContent.replace(/[^0-9-]/g, '')),
      sparks: li.querySelectorAll('.wd-spark i').length,
    }));
    const lines = {};
    document.querySelectorAll('#worldTreasBody .wd-rowline').forEach((r) => {
      lines[r.querySelector('span').textContent.trim()] = r.querySelector('b').textContent.trim();
    });
    return { rows, lines, note: document.getElementById('worldTreasNote').textContent.trim(),
             unit: (document.querySelector('#worldTreasBody .wd-unit') || {}).textContent || '' };
  });
  console.log('    [' + label + '] ' + band.rows.length + ' rows, note="' + band.note + '", top: ' +
    band.rows.slice(0, 3).map((r) => r.who + '=' + r.coin).join(', '));
  return { mock, band, reach };
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    // Record EVERY localStorage write made by the page, before any page script runs.
    await page.evaluateOnNewDocument(() => {
      window.__LS_WRITES = [];
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { window.__LS_WRITES.push(String(k)); return orig.apply(this, arguments); };
    });

    console.log('\nA. first load');
    const one = await readPass(page, 'load 1');
    eq('A1 the live page stamps the ledger as a MOCK', one.mock.isMockFlag, true);
    eq('A2 and it is NOT armed', one.mock.armed, false);
    eq('A3 AgentLedger.isMock() is true on the live page', one.mock.isMock, true);
    eq('A4 AgentLedger.balance() returns null — the fabricated 1000 is gone', one.mock.balEmber, null);
    eq('A4b for any id', one.mock.balAsh, null);
    eq('A5 its snapshot is empty (nothing was seeded)', one.mock.snap, '{}');
    eq('A6 real money reads OFF', one.mock.realMoney, false);
    eq('A7 it points callers at the real endpoint', one.mock.realSource, '/api/world/treasury');
    is('A8 the treasury band rendered real rows', one.band.rows.length > 5, one.band.rows.length + ' rows');
    is('A9 every row carries a 7-day shape', one.band.rows.every((r) => r.sparks === 7),
       JSON.stringify(one.band.rows.map((r) => r.sparks).slice(0, 5)));
    is('A10 the band labels the unit and says real money is off',
       /minted currency/.test(one.band.unit) && /real money off/.test(one.band.unit), one.band.unit.slice(0, 120));
    is('A11 and says a day is an IN-WORLD day', /IN-WORLD day/.test(one.band.unit));
    is('A12 no row is the mint or the escrow', !one.band.rows.some((r) => /^@/.test(r.who)),
       JSON.stringify(one.band.rows.map((r) => r.who).slice(0, 3)));

    const lsAfter1 = await page.evaluate(() => window.__LS_WRITES.slice());
    const ledgerish = lsAfter1.filter((k) => /ledger|treasur|lum|xmr|balance|wallet/i.test(k));
    eq('A13 ZERO localStorage writes whose key names ledger/treasury state', ledgerish.length, 0);
    console.log('    [load 1] localStorage keys written by the page: ' +
      (lsAfter1.length ? lsAfter1.slice(0, 8).join(', ') + (lsAfter1.length > 8 ? ' …(' + lsAfter1.length + ')' : '') : '(none)'));

    console.log('\nB. the API the band read, for comparison');
    const api = await page.evaluate(async (u) => (await fetch(u)).json(), API);
    const apiBy = new Map(api.citizens.map((c) => [c.display_name || c.id, c.balance]));
    let matched = 0, mismatch = [];
    for (const r of one.band.rows) {
      const w = r.who.replace(/\s*[†]|\s*·.*$/g, '').trim();
      if (apiBy.has(w)) { matched++; if (apiBy.get(w) !== r.coin) mismatch.push(w + ' band=' + r.coin + ' api=' + apiBy.get(w)); }
    }
    is('B1 the sample is non-vacuous', matched >= 5, matched + ' names matched the API');
    eq('B2 every rendered balance EQUALS the API balance', mismatch.length, 0);
    if (mismatch.length) console.log('      ' + mismatch.slice(0, 5).join(' | '));

    console.log('\nC. RELOAD — the acceptance test the mock used to fail');
    const two = await readPass(page, 'load 2');
    eq('C1 after a reload the mock is STILL null (it cannot reseed)', two.mock.balEmber, null);
    eq('C2 and still unarmed', two.mock.armed, false);
    is('C3 the band re-rendered real rows after the reload', two.band.rows.length > 5, two.band.rows.length + ' rows');
    // The world is LIVE, so a balance may legitimately move between loads. What
    // must NEVER happen is a RESET — to the mock's flat 1000, or to zero.
    const n1 = new Map(one.band.rows.map((r) => [r.who, r.coin]));
    const n2 = new Map(two.band.rows.map((r) => [r.who, r.coin]));
    const common = [...n1.keys()].filter((k) => n2.has(k));
    is('C4 the two loads share their roster', common.length >= 5, common.length + ' shared names');
    const flat1000 = two.band.rows.filter((r) => r.coin === 1000);
    eq('C5 NOT ONE row reads the mock\'s flat 1000 after a reload', flat1000.length, 0);
    const allSame = new Set(two.band.rows.map((r) => r.coin)).size;
    is('C6 the balances are not all one seeded value', allSame > 3, allSame + ' distinct balances');
    const drifted = common.filter((k) => n1.get(k) !== n2.get(k));
    is('C7 reload did not RESET the numbers (they carried over; any change is the live world moving)',
       drifted.length <= Math.max(2, Math.floor(common.length * 0.2)),
       drifted.length + '/' + common.length + ' moved: ' + drifted.slice(0, 4).map((k) => k + ' ' + n1.get(k) + '->' + n2.get(k)).join(', '));
    // The decisive one: the numbers are SERVER state, so they survive a reload
    // by construction. Prove the band holds no client-side treasury at all.
    const noClientState = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      return keys.filter((k) => /ledger|treasur|lum|xmr|wallet|balance/i.test(k));
    });
    eq('C8 localStorage holds NO ledger/treasury key at all after two loads', noClientState.length, 0);

    console.log('\nD. collision check on the opened band (No-Collision Law)');
    const coll = await page.evaluate(() => {
      const panel = document.getElementById('worldMapPanel');
      const pr = panel.getBoundingClientRect();
      const body = document.getElementById('worldTreasBody');
      const br = body.getBoundingClientRect();
      const over = [];
      // every rendered row must sit inside the panel's content box
      document.querySelectorAll('#worldTreasBody .wd-treas li, #worldTreasBody .wd-rowline').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        if (r.right > pr.right + 0.5 || r.left < pr.left - 0.5) over.push(el.className + ' h-overflow');
      });
      const abs = [...document.querySelectorAll('#worldTreasBody *')].filter((el) => {
        const p = getComputedStyle(el).position; return p === 'absolute' || p === 'fixed';
      }).length;
      return { panelInViewport: pr.bottom <= window.innerHeight + 0.5 && pr.top >= -0.5,
               bodyScrolls: getComputedStyle(body).overflowY, over, abs,
               panelH: Math.round(pr.height), bodyH: Math.round(br.height),
               maxH: getComputedStyle(panel).maxHeight };
    });
    eq('D1 nothing in the band overflows the panel horizontally', coll.over.length, 0);
    eq('D2 nothing inside the band is absolutely/fixed positioned', coll.abs, 0);
    eq('D3 the band body is its own scroller (it grows INWARD)', coll.bodyScrolls, 'auto');
    is('D4 the panel stays inside the viewport with the band open', coll.panelInViewport,
       'panelH=' + coll.panelH + ' maxH=' + coll.maxH);
    console.log('    panel ' + coll.panelH + 'px (max ' + coll.maxH + '), band body ' + coll.bodyH + 'px');

    console.log('\n' + '─'.repeat(70));
    console.log(pass + '/' + (pass + fails.length) + ' pass');
    if (fails.length) { console.log('\nFAILURES:'); fails.forEach((f) => console.log('  - ' + f)); }
    await browser.close();
    process.exit(fails.length ? 1 : 0);
  } catch (e) {
    console.error('\nHARNESS ERROR: ' + (e && e.stack || e));
    await browser.close();
    process.exit(2);
  }
})();
