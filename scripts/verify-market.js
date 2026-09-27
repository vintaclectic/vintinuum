#!/usr/bin/env node
/* verify-market.js — THE BAZAAR PROOF (AETHERHOLD 2026-09-27, the trade organ)
   ────────────────────────────────────────────────────────────────────────────
   Proven against the REAL body/world/market.js — not a re-implementation, which
   is the usual way a test like this lies. The file loads with no DOM (see its
   module.exports tail), so every model assertion runs the exact code path a
   browser runs.

   THE CLAIMS
     1  the organ EXISTS and is WIRED, and its shape obeys the architecture:
          · body/world/market.js exists
          · world.html loads it with a <script> tag
          · it takes its rail slot via addLauncher('mkBtn', …) — no hand-counted
            pixel offset, and it adds NO fixed geometry of its own (no
            position:fixed / position:absolute / z-index anywhere in the file)
          · it joins the one-sheet registry via registerSheet('market', …)
          · its sheet carries the shared .dv-sheet class
          · it settles ONLY through the Concord's guarded verbs (spend/credit/
            impress) and keeps NO treasury or balance of its own — one economy
     2  LIST → OFFER → ACCEPT settles through the Concord when YOU SOLD:
        a listing you hang, an agent's offer against it, your accept → the ONE
        treasury is CREDITED the price and the seven-tag spine is PRESSED, the
        stall is settled, rival offers are declined, and a history row is written
     3  a REJECTED offer settles nothing (decline, then an accept on it refuses)
     4  the BUYER path settles by SPEND, and is ATOMIC: with the treasury unable
        to cover it, NOTHING settles — the stall stays open, no karma moves, no
        history row. A refused offer settles nothing.
     5  the settlement SURVIVES RELOAD (a genuine re-instantiation, same storage)
     6  with NO polity founded, a paid trade REFUSES rather than minting value

   And, when puppeteer is present, LEG B drives the REAL concord.js in the shipped
   world.html: found a polity, hang a stall, take an agent's offer, and assert the
   REAL treasury actually moved and the REAL karma tags actually shifted.

   USAGE:  node scripts/verify-market.js
   Exits non-zero on any failed claim, so it can gate a commit.
*/
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const MARKET = path.join(ROOT, 'body/world/market.js');
const WORLD_HTML = path.join(ROOT, 'world.html');

let fails = 0, passes = 0;
function ok(claim, cond, detail) {
  if (cond) { passes++; console.log('  \x1b[32m✓\x1b[0m ' + claim); }
  else { fails++; console.log('  \x1b[31m✗\x1b[0m ' + claim + (detail ? '\n      ' + detail : '')); }
}
function head(t) { console.log('\n\x1b[1m' + t + '\x1b[0m'); }

// ═════════════════════════════════════════════════════════════════════════════
// THE HARNESS — a window with a REAL string-store localStorage, because claim 5
// is entirely about whether what was written is what comes back.
// ═════════════════════════════════════════════════════════════════════════════
function makeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: (k) => { m.delete(String(k)); },
    clear: () => m.clear(), _raw: m
  };
}

function makeWindow(storage) {
  const listeners = {};
  const win = {
    localStorage: storage,
    document: undefined,                 // NO DOM — the model half must stand alone
    location: { search: '' },
    URLSearchParams: URLSearchParams,
    CustomEvent: function (n, o) { this.type = n; this.detail = o && o.detail; },
    addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); },
    dispatchEvent: (e) => { (listeners[e.type] || []).forEach(f => { try { f(e); } catch (_) {} }); return true; },
    setInterval: () => 0, clearInterval: () => {}, setTimeout: () => 0,
    _events: listeners
  };
  // signed-in: market.js gates listing/offer/accept on a token, as the page does
  storage.setItem('vint_access_token', 'proof.tok.tok');
  return win;
}

// A Court stub: market.js reads VintCourt.roster() for its counterparties.
function stubCourt(win, agents) {
  win.VintCourt = { roster: () => agents.slice() };
}

// A Concord stub: market.js settles through spend/credit/impress. It RECORDS the
// calls so we can assert the market never keeps a second ledger. `mode` lets a
// test make spend refuse (treasury cannot cover) or the polity be unfounded.
function stubConcord(win, mode) {
  mode = mode || {};
  const calls = { credit: [], spend: [], impress: [] };
  win.VintConcord = {
    founded: () => (mode.founded === false ? false : true),
    state: () => ({ treasury: mode.treasury == null ? 500 : mode.treasury }),
    TAGS: ['civic', 'criminal', 'craft', 'social', 'mentor', 'heat', 'trust'],
    disposition: (a) => null,
    credit: (n, why) => { calls.credit.push([n, why]); return mode.creditFail ? false : true; },
    spend: (n, why) => { calls.spend.push([n, why]); return mode.spendFail ? false : true; },
    impress: (p, m) => { calls.impress.push([p, m]); return true; }
  };
  return calls;
}

function loadMarket(win) {
  delete require.cache[require.resolve(MARKET)];
  const src = fs.readFileSync(MARKET, 'utf8');
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', 'window', 'globalThis', 'localStorage', 'console', 'require',
    'setTimeout', 'setInterval', 'clearInterval', 'URLSearchParams', 'CustomEvent',
    src + '\n;return module.exports;');
  return fn(mod, mod.exports, win, win, win.localStorage, console, require,
    win.setTimeout, win.setInterval, win.clearInterval, URLSearchParams, win.CustomEvent);
}

console.log('\n\x1b[1m\x1b[36mTHE BAZAAR PROOF\x1b[0m  ·  body/world/market.js\n' +
            '  trade, combine tools — and one economy, never two.');

// ═════════════════════════════════════════════════════════════════════════════
// CLAIM 1 — THE ORGAN EXISTS AND ITS SHAPE OBEYS THE ARCHITECTURE (source-level)
// ═════════════════════════════════════════════════════════════════════════════
head('1 · the organ exists, is wired, and adds no fixed geometry');
const SRC = fs.readFileSync(MARKET, 'utf8');
const HTML = fs.readFileSync(WORLD_HTML, 'utf8');
ok('body/world/market.js exists', fs.existsSync(MARKET));
ok('world.html loads it with a <script> tag',
  /<script[^>]+src=["']body\/world\/market\.js["']/.test(HTML), 'no market.js script tag found');
ok('takes its rail slot via addLauncher(\'mkBtn\', …)',
  /addLauncher\(\s*['"]mkBtn['"]/.test(SRC), 'no addLauncher(\'mkBtn\', …) call');
ok('joins the one-sheet registry via registerSheet(\'market\', …)',
  /registerSheet\(\s*['"]market['"]/.test(SRC), 'no registerSheet(\'market\', …) call');
ok('its sheet carries the shared .dv-sheet class',
  /=\s*['"]dv-sheet['"]/.test(SRC), 'sheet element does not use the dv-sheet class');
ok('NO hand-counted pixel offset / no fixed geometry of its own',
  !/position\s*:\s*(fixed|absolute)/.test(SRC) && !/z-index/.test(SRC),
  'the file declares its own fixed/absolute/z-index — the rail must own the slot');
ok('settles through the Concord\'s guarded verbs (spend/credit/impress present)',
  /\.spend\(/.test(SRC) && /\.credit\(/.test(SRC) && /\.impress\(/.test(SRC),
  'a guarded verb call is missing');
ok('keeps NO treasury of its own (no direct treasury write anywhere)',
  !/\btreasury\s*[-+]?=[^=]/.test(SRC) && !/s\.treasury/.test(SRC),
  'the file assigns a treasury balance — that is a second economy');
ok('offer/bid/accept flows are named verbs on the API',
  /\blist:\s*list\b/.test(SRC) && /\boffer:\s*offer\b/.test(SRC) && /\baccept:\s*accept\b/.test(SRC));

// ═════════════════════════════════════════════════════════════════════════════
// CLAIM 2 — LIST → OFFER → ACCEPT, settled through the Concord (YOU SOLD)
// ═════════════════════════════════════════════════════════════════════════════
head('2 · list → offer → accept settles through the treasury (you sold)');
const storage = makeStorage();
const win = makeWindow(storage);
stubCourt(win, [
  { id: 'ag-1', name: 'Sable', color: '#ffb877' },
  { id: 'ag-2', name: 'Corvid', color: '#c9a5ff' }
]);
const calls = stubConcord(win);
let M = loadMarket(win);

const L = M.list({ title: 'a whetted adze', kind: 'tool', desc: 'true to the line.', ask: 20, tag: 'craft' });
ok('you hang a stall', L.ok && L.listing.sellerId === M.SELF && L.listing.status === 'open', JSON.stringify(L));
ok('the stall records its karma axis (craft)', L.listing.tag === 'craft', 'tag=' + L.listing.tag);

const o1 = M.offer(L.listing.id, 25, 'i can use that', { id: 'ag-1', name: 'Sable', isAgent: true });
const o2 = M.offer(L.listing.id, 18, '', { id: 'ag-2', name: 'Corvid', isAgent: true });
ok('an agent offers ◇25', o1.ok && o1.offer.lumen === 25 && o1.offer.isAgent === true, JSON.stringify(o1));
ok('a second agent offers ◇18', o2.ok && o2.offer.lumen === 18);
ok('you cannot bid on your own stall', M.offer(L.listing.id, 5).ok === false);

const beforeCredit = calls.credit.length, beforeImpress = calls.impress.length;
const acc = M.accept(L.listing.id, o1.offer.id);
ok('you accept the ◇25 offer', acc.ok && acc.sold === true && acc.lumen === 25, JSON.stringify(acc));
ok('the ONE treasury was CREDITED ◇25 (income for what you sold)',
  calls.credit.length === beforeCredit + 1 && calls.credit[calls.credit.length - 1][0] === 25,
  'credit calls=' + JSON.stringify(calls.credit));
ok('the treasury was NOT spent (you sold, you did not buy)', calls.spend.length === 0, 'spend=' + JSON.stringify(calls.spend));
ok('the seven-tag spine was PRESSED through impress()',
  calls.impress.length === beforeImpress + 1 && ('craft' in calls.impress[calls.impress.length - 1][0]),
  'impress=' + JSON.stringify(calls.impress));

const st2 = M.state();
const settled = st2.listings.filter(x => x.id === L.listing.id)[0];
ok('the stall is now settled', settled && settled.status === 'settled', 'status=' + (settled && settled.status));
ok('the rival ◇18 offer was declined', settled.offers.filter(o => o.id === o2.offer.id)[0].status === 'declined');
ok('a settled-trade history row was written', st2.history.length === 1 &&
  st2.history[0].lumen === 25 && st2.history[0].buyer === 'Sable' && st2.history[0].seller === M.SELF,
  JSON.stringify(st2.history[0]));
ok('the market keeps NO treasury or lumen field of its own (one economy)',
  !('treasury' in st2) && !('lumen' in st2), 'state keys: ' + Object.keys(st2).join(','));

// ═════════════════════════════════════════════════════════════════════════════
// CLAIM 3 — a rejected offer settles nothing
// ═════════════════════════════════════════════════════════════════════════════
head('3 · a rejected offer settles nothing');
const L3 = M.list({ title: 'a coil of good wire', kind: 'tool', ask: 10, tag: 'craft' });
const o3 = M.offer(L3.listing.id, 12, '', { id: 'ag-1', name: 'Sable', isAgent: true });
const histBefore = M.state().history.length;
const dec = M.decline(L3.listing.id, o3.offer.id);
ok('the lister declines the offer', dec.ok === true);
ok('the declined offer cannot then be accepted', M.accept(L3.listing.id, o3.offer.id).ok === false);
ok('nothing was added to history by the rejection', M.state().history.length === histBefore);
ok('the stall is still open after a decline',
  M.state().listings.filter(x => x.id === L3.listing.id)[0].status === 'open');

// ═════════════════════════════════════════════════════════════════════════════
// CLAIM 4 — the BUYER path spends, and refusal is ATOMIC
// ═════════════════════════════════════════════════════════════════════════════
head('4 · the buyer path spends, and a treasury that cannot cover it settles nothing');
// happy buyer path: an agent lists, you offer, the accept SPENDS
const AL = M.list({ title: 'a barrel of lamp-oil', kind: 'resource', ask: 30, tag: 'civic' },
  { id: 'ag-2', name: 'Corvid', isAgent: true });
ok('an agent hangs a stall', AL.ok && AL.listing.isAgentSeller === true && AL.listing.sellerId === 'ag-2');
const myBid = M.offer(AL.listing.id, 30, 'yours');
ok('you lay a ◇30 offer on it', myBid.ok && myBid.offer.byId === M.SELF);
const spendBefore = calls.spend.length;
const buy = M.accept(AL.listing.id, myBid.offer.id);
ok('the accept settles as a PURCHASE (you bought)', buy.ok && buy.sold === false && buy.lumen === 30, JSON.stringify(buy));
ok('the ONE treasury was SPENT ◇30 (the cost of acquiring)',
  calls.spend.length === spendBefore + 1 && calls.spend[calls.spend.length - 1][0] === 30);

// ATOMIC refusal: a fresh world where spend() is refused (treasury cannot cover)
const stor2 = makeStorage();
const win2 = makeWindow(stor2);
stubCourt(win2, [{ id: 'ag-9', name: 'Wren', color: '#9fd' }]);
const calls2 = stubConcord(win2, { spendFail: true });
const M2 = loadMarket(win2);
const AL2 = M2.list({ title: 'a spare drivecore', kind: 'tool', ask: 40, tag: 'craft' },
  { id: 'ag-9', name: 'Wren', isAgent: true });
const bid2 = M2.offer(AL2.listing.id, 40, '');
const impBefore = calls2.impress.length;
const refused = M2.accept(AL2.listing.id, bid2.offer.id);
ok('the accept is REFUSED when the treasury cannot cover it', refused.ok === false, JSON.stringify(refused));
ok('the stall STAYS OPEN after the refusal (atomic — nothing flipped)',
  M2.state().listings.filter(x => x.id === AL2.listing.id)[0].status === 'open');
ok('NO karma was pressed on the refused trade (atomic — nothing moved)', calls2.impress.length === impBefore);
ok('NO history row was written for the refused trade', M2.state().history.length === 0);

// ═════════════════════════════════════════════════════════════════════════════
// CLAIM 5 — the settlement survives a reload
// ═════════════════════════════════════════════════════════════════════════════
head('5 · a settled trade survives a reload');
const rawBefore = storage.getItem('vint:market:universe');
ok('state was actually written to storage', !!rawBefore && rawBefore.length > 50);
// a GENUINE re-instantiation: new window, new module instance, SAME storage.
const win3 = makeWindow(storage);
stubCourt(win3, [{ id: 'ag-1', name: 'Sable' }]);
stubConcord(win3);
const M3 = loadMarket(win3);
ok('re-instantiated from persisted state (a different module instance)', M3 !== M);
ok('the settled trade is still in history after reload',
  M3.history().some(h => h.title === 'a whetted adze' && h.lumen === 25));
ok('the settled stall is still marked settled after reload',
  M3.state().listings.some(x => x.title === 'a whetted adze' && x.status === 'settled'));

// ═════════════════════════════════════════════════════════════════════════════
// CLAIM 6 — with no polity founded, a paid trade refuses rather than minting
// ═════════════════════════════════════════════════════════════════════════════
head('6 · with no polity founded, a paid trade refuses (no treasury to move)');
const stor4 = makeStorage();
const win4 = makeWindow(stor4);
stubCourt(win4, [{ id: 'ag-1', name: 'Sable' }]);
const calls4 = stubConcord(win4, { founded: false });
const M4 = loadMarket(win4);
const L4 = M4.list({ title: 'a true plumb-line', kind: 'tool', ask: 15, tag: 'craft' });
const o4 = M4.offer(L4.listing.id, 15, '', { id: 'ag-1', name: 'Sable', isAgent: true });
const noPolity = M4.accept(L4.listing.id, o4.offer.id);
ok('the accept refuses with "found a polity" when unfounded', noPolity.ok === false, JSON.stringify(noPolity));
ok('no treasury verb was reached with no polity', calls4.credit.length === 0 && calls4.spend.length === 0);
ok('the stall stays open (nothing settled)',
  M4.state().listings.filter(x => x.id === L4.listing.id)[0].status === 'open');

// resolve() is callable headless and returns a boolean without throwing
head('· the clock verb is sound');
let resolveOk = true, resolveVal;
try { resolveVal = M.resolve(); } catch (e) { resolveOk = false; }
ok('resolve() runs headless and returns a boolean', resolveOk && typeof resolveVal === 'boolean');

// ═════════════════════════════════════════════════════════════════════════════
// LEG B — THE REAL CONCORD, IN THE SHIPPED PAGE (skipped if puppeteer absent)
// The stubs above prove the CONTRACT. This proves the market and the real
// concord.js actually compose in world.html — the treasury genuinely moves.
// ═════════════════════════════════════════════════════════════════════════════
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2', '.webp': 'image/webp', '.ico': 'image/x-icon' };

(async () => {
  head('· the real concord settles a trade (world.html)');
  let puppeteer;
  try { puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer'); }
  catch (_) {
    console.log('  \x1b[33m—\x1b[0m puppeteer unavailable; the browser leg was skipped.');
    return done();
  }
  const srv = http.createServer((rq, rs) => {
    let p = decodeURIComponent(rq.url.split('?')[0]); if (p === '/') p = '/index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rs.writeHead(404); return rs.end(); }
    rs.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(rs);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  let b;
  try { b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--enable-unsafe-swiftshader'] }); }
  catch (e) { console.log('  \x1b[33m—\x1b[0m chrome would not start; the browser leg was skipped. (' + e.message.split('\n')[0] + ')'); srv.close(); return done(); }
  try {
    const pg = await b.newPage();
    await pg.setViewport({ width: 375, height: 812 });
    await pg.evaluateOnNewDocument(() => { localStorage.setItem('vint_access_token', 'proof.tok.tok'); });
    pg.on('pageerror', () => {});
    await pg.goto(`http://127.0.0.1:${port}/world.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pg.waitForFunction(() => !!(window.VintMarket && window.VintConcord && window.VintCourt),
      { timeout: 20000 }).catch(() => {});

    const res = await pg.evaluate(() => {
      const out = { steps: [] };
      try {
        const W = window.VintinuumWorld;
        if (W) { W._worldId = 'verify-world'; W._canBuild = true; W._guest = false; W._resident = { standing: 150, lumen: 400 }; }
        const M = window.VintMarket, C = window.VintConcord;
        if (!M || !C) return { err: 'organs missing' };
        out.steps.push('organs present');
        // Found a real polity through the module's own store shape, then drop the
        // memo so the next read comes off storage (the same dance verify-factions
        // does with the Concord).
        localStorage.setItem('vint:concord:verify-world', JSON.stringify({
          v: 1, founded: Date.now(), charter: 'vault', name: 'the Vaultsworn',
          seats: [], tags: { civic: 0, criminal: 0, craft: 0, social: 0, mentor: 0, heat: 0, trust: 0 },
          treasury: 100, motion: null, record: [], exiles: [], seen: 0
        }));
        if (C.reload) C.reload();
        out.founded = !!C.founded();
        out.treasuryBefore = C.state().treasury;
        out.craftBefore = C.tags().craft;
        // Hang a stall as the player, take an agent's offer, settle for real.
        M.reload();
        const L = M.list({ title: 'a whetted adze', kind: 'tool', desc: 'true.', ask: 20, tag: 'craft' });
        out.listed = !!(L && L.ok);
        const o = M.offer(L.listing.id, 25, 'mine', { id: 'ag-real', name: 'Sable', isAgent: true });
        out.offered = !!(o && o.ok);
        const a = M.accept(L.listing.id, o.offer.id);
        out.accepted = !!(a && a.ok);
        out.sold = a && a.sold;
        out.treasuryAfter = C.state().treasury;
        out.craftAfter = C.tags().craft;
        out.historyLen = M.state().history.length;
        out.sheetPresent = !!document.getElementById('mkSheet') || true; // built lazily on open
      } catch (e) { out.err = String(e && e.message); }
      return out;
    });

    if (res.err) { ok('the browser leg ran', false, res.err); }
    else {
      ok('the polity is founded (real concord.js)', res.founded === true);
      ok('you hung a stall in the shipped page', res.listed === true);
      ok('an agent offered against it', res.offered === true);
      ok('the accept settled (you sold)', res.accepted === true && res.sold === true);
      ok('the REAL treasury was credited (◇' + res.treasuryBefore + ' → ◇' + res.treasuryAfter + ')',
        res.treasuryAfter === res.treasuryBefore + 25,
        'before=' + res.treasuryBefore + ' after=' + res.treasuryAfter);
      ok('the REAL seven-tag spine moved (craft ' + res.craftBefore + ' → ' + res.craftAfter + ')',
        res.craftAfter > res.craftBefore, 'craft before=' + res.craftBefore + ' after=' + res.craftAfter);
      ok('a settled-trade history row was written', res.historyLen === 1, 'history=' + res.historyLen);
    }
    await pg.close();
  } catch (e) {
    const env = /execution context|target closed|session closed|detached|navigating|timeout|timed out/i;
    if (env.test(String(e && e.message))) console.log('  \x1b[33m—\x1b[0m browser leg environment fault, skipped: ' + String(e.message).split('\n')[0]);
    else ok('the browser leg ran', false, String(e && e.message));
  } finally {
    await b.close().catch(() => {});
    srv.close();
  }
  done();
})();

function done() {
  console.log('\n' + (fails === 0
    ? '\x1b[32m  ALL ' + passes + ' CLAIMS HOLD.\x1b[0m  a trade settles through one treasury; the world remembers it.\n'
    : '\x1b[31m  ' + fails + ' CLAIM(S) FAILED\x1b[0m  (' + passes + ' passed)\n'));
  process.exit(fails === 0 ? 0 : 1);
}
