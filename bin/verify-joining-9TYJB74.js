#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════════
   verify-joining-9TYJB74.js — headless proof for THE JOINING (task 9TYJB74)

   THE JOINING is the first ACT surface of 9TYJB74: two co-equal peers standing in
   the same world make one thing together. It composes ONLY verbs the server already
   handles (world:who, world:trade:open/offer/ready/cancel, world:forge:strike,
   world:forge:teach). This harness loads the REAL world.html in headless Chromium,
   replaces only the socket's send() with a recorder (so nothing leaves the page),
   feeds server-shaped frames, and asserts:

     · WIRED — <script>-loaded after forge-hud.js + commons.js, registers 'joining'
       in the one-open registry, commons renders its entry, NO rail launcher.
     · REAL VERBS ONLY — every world:* literal in joining.js is a handler in the
       server source (vintinuum-api/world/world-mvp.js), and every World.* helper it
       calls exists in world-client.js.
     · ZERO FABRICATION — no known recipe → no recipe card; the split shown for each
       recipe equals recipe.in minus the mirrored inventory; an untradeable shortfall
       never offers an ask.
     · THE ACT, END TO END — ask → world:trade:open(target = the peer's presence id);
       the server's table renders HERE (commons does not evict it); ready →
       world:trade:ready; settled → strike sends EXACTLY recipe.in; teach sends the
       peer + recipe; give → world:trade:offer for my part with absolute counts;
       closed → the act clears.
     · PARITY — no owner/owned/"your agent" language anywhere.
     · NO-COLLISION — at 320/375/768/1280/1920 in the list, live-table and many-peer
       states: sheet in viewport, no horizontal overflow, every chip/button/card in
       the body box, no two controls intersect, no two cards intersect, 44px floor.
     · ONE-OPEN + KILL SWITCH (?joining=0).

   NEGATIVE CONTROL: `--control` injects a CSS override that removes the wrap
   contract (nowrap chips + nowrap action rows, no max-width). The run MUST go red.

   Hermetic: only file:// loads; all other requests are aborted.
   ──────────────────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer'); }
catch (e) { console.error('FATAL: puppeteer not resolvable from api repo:', e.message); process.exit(2); }

const ROOT = path.resolve(__dirname, '..');
const WORLD = 'file://' + path.join(ROOT, 'world.html');
const SERVER = '/home/vinta/vintinuum-api/world/world-mvp.js';
const BREAKPOINTS = [320, 375, 768, 1280, 1920];
const CONTROL = process.argv.includes('--control');
const CONTROL_CSS =
  '#dvJoiningSheet .jn-chips,#dvJoiningSheet .jn-acts{flex-wrap:nowrap!important;}' +
  '#dvJoiningSheet .jn-chip,#dvJoiningSheet .jn-b{flex:0 0 auto!important;max-width:none!important;min-width:max-content!important;}';

const results = [];
function ok(label) { results.push({ pass: true, label }); console.log('  PASS  ' + label); }
function bad(label, extra) { results.push({ pass: false, label }); console.log('  FAIL  ' + label + (extra ? '  → ' + extra : '')); }
function assert(cond, label, extra) { cond ? ok(label) : bad(label, extra); }
function intersects(a, b) {
  return !(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5);
}

const KNOWN = [
  { id: 'lamp_of_two_hands', name: 'lamp of two hands', in: { strand: 2, ember: 1 }, class: 'tool', big: false },
  { id: 'seeking_pick', name: 'seeking pick', in: { resonance_pick: 1, strand: 1 }, class: 'tool', big: false },
  { id: 'hand_axe', name: 'hand axe', in: { stone: 1, timber: 1 }, class: 'tool', big: false },
  { id: 'great_beacon', name: 'great beacon', in: { strand: 12, ember: 4, slag: 6 }, class: 'structure', big: true },
];

async function waitReady(page) {
  await page.waitForFunction(() => !!(window.VintJoining && window.VintCommons && window.DirverseHUD &&
    window.VintinuumWorld && document.getElementById('dvRail')), { timeout: 20000 });
}

async function info(page) {
  return await page.evaluate(() => {
    const sheet = document.getElementById('dvJoiningSheet');
    const body = sheet && sheet.querySelector('#jnBody');
    const r = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
    const q = s => Array.from((body || document.createElement('div')).querySelectorAll(s)).filter(n => n.getClientRects().length);
    const controls = q('.jn-chip, .jn-b');
    return {
      open: !!(sheet && sheet.classList.contains('open')),
      sheet: sheet ? r(sheet) : null,
      body: body ? r(body) : null,
      overflowX: body ? body.scrollWidth - body.clientWidth : 0,
      cards: q('.jn-card').map(r),
      cardIds: q('.jn-card[data-jn-recipe]').map(n => n.getAttribute('data-jn-recipe')),
      controls: controls.map(r),
      controlText: controls.map(n => n.textContent),
      leaves: q('.jn-name, .jn-meta, .jn-sum, .jn-sec, .jn-note, .jn-last').map(r),
      text: body ? body.textContent : '',
      live: !!(body && body.querySelector('[data-jn-live]')),
    };
  });
}
function cardText(page, id) {
  return page.evaluate((id) => { const c = document.querySelector('#dvJoiningSheet .jn-card[data-jn-recipe="' + id + '"]'); return c ? c.textContent : null; }, id);
}
function clickButton(page, re) {
  return page.evaluate((src) => {
    const re = new RegExp(src);
    const b = Array.from(document.querySelectorAll('#dvJoiningSheet .jn-b')).find(x => re.test(x.textContent) && !x.disabled);
    if (!b) return false; b.click(); return true;
  }, re.source);
}
function sent(page) { return page.evaluate(() => window.__sent.slice()); }

async function collisionSweep(page, tag) {
  for (const w of BREAKPOINTS) {
    await page.setViewport({ width: w, height: 800 });
    await new Promise(r => setTimeout(r, 300));
    const i = await info(page);
    const b = i.body;
    assert(i.sheet && i.sheet.left >= -0.5 && i.sheet.right <= w + 0.5 && i.sheet.top >= -0.5 && i.sheet.bottom <= 800.5,
      `${tag} @${w}px sheet inside the viewport`, JSON.stringify(i.sheet));
    assert(i.overflowX <= 1, `${tag} @${w}px body has no horizontal overflow`, 'overflowX=' + i.overflowX);
    const inBody = x => b && x.left >= b.left - 1 && x.right <= b.right + 1;
    assert(i.controls.every(inBody), `${tag} @${w}px every chip/button stays inside the body box`,
      i.controls.filter(x => !inBody(x)).length + ' outside');
    assert(i.cards.every(inBody), `${tag} @${w}px every card stays inside the body box`);
    assert(i.leaves.every(inBody), `${tag} @${w}px every text leaf stays inside the body box`);
    let cc = 0;
    for (let a = 0; a < i.controls.length; a++) for (let c = a + 1; c < i.controls.length; c++) if (intersects(i.controls[a], i.controls[c])) cc++;
    assert(cc === 0, `${tag} @${w}px no two controls intersect`, cc + ' pairs');
    let kc = 0;
    for (let a = 0; a < i.cards.length; a++) for (let c = a + 1; c < i.cards.length; c++) if (intersects(i.cards[a], i.cards[c])) kc++;
    assert(kc === 0, `${tag} @${w}px no two cards intersect`, kc + ' pairs');
    assert(i.controls.every(x => x.height >= 43.5), `${tag} @${w}px every control meets the 44px floor`);
  }
  await page.setViewport({ width: 1280, height: 800 });
}

(async () => {
  console.log('THE JOINING — verify 9TYJB74' + (CONTROL ? '   [NEGATIVE CONTROL: wrap contract removed — MUST FAIL]' : ''));
  console.log('world: ' + WORLD + '\n');

  // ── STATIC ─────────────────────────────────────────────────────────────────
  const src = fs.readFileSync(path.join(ROOT, 'body/world/joining.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'world.html'), 'utf8');
  const commons = fs.readFileSync(path.join(ROOT, 'body/world/commons.js'), 'utf8');
  const client = fs.readFileSync(path.join(ROOT, 'body/world/world-client.js'), 'utf8');
  const server = fs.readFileSync(SERVER, 'utf8');

  assert(/<script[^>]+body\/world\/joining\.js/.test(html), 'joining.js is <script>-loaded in world.html');
  const iJ = html.indexOf('body/world/joining.js'), iF = html.indexOf('body/world/forge-hud.js'), iC = html.indexOf('body/world/commons.js');
  assert(iJ > iF && iJ > iC, 'joining.js loads AFTER forge-hud.js and commons.js');
  assert(/registerSheet\(\s*'joining'/.test(src), "registers 'joining' with the one-open registry");
  assert(/VintJoining\.entryInto/.test(commons), 'commons.js renders the joining entry');
  assert(/VintJoining\.holdsTable/.test(commons), 'commons.js defers its trade tab while a joining holds the table');
  assert(!/addLauncher|dv-launch/.test(src), 'NO 16th rail: joining.js adds no rail launcher');
  assert(!/fetch\(|XMLHttpRequest/.test(src), 'joining.js makes no network call of its own');
  const verbs = Array.from(new Set((src.match(/'world:[a-z][a-z:]*'/g) || []).map(s => s.slice(1, -1))));
  assert(verbs.length > 0, 'joining.js names at least one verb', JSON.stringify(verbs));
  const missing = verbs.filter(v => !server.includes("msg.t === '" + v + "'"));
  assert(missing.length === 0, 'every world:* verb joining.js sends is a REAL server handler (' + verbs.join(', ') + ')', JSON.stringify(missing));
  const helpers = ['who', 'tradeOpen', 'tradeOffer', 'tradeReady', 'tradeCancel', 'myUserId'];
  const helperMissing = helpers.filter(h => !new RegExp('World\\.' + h + '\\s*=').test(client));
  assert(helperMissing.length === 0, 'every World.* helper it calls exists in world-client.js', JSON.stringify(helperMissing));
  for (const v of ['world:who', 'world:trade:open', 'world:trade:offer', 'world:trade:ready', 'world:trade:cancel'])
    assert(server.includes("msg.t === '" + v + "'"), 'server handles ' + v + ' (reached via the World helper)');

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setRequestInterception(true);
    page.on('request', req => { const u = req.url(); (u.startsWith('file://') || u.startsWith('about:') || u.startsWith('data:')) ? req.continue() : req.abort(); });
    page.on('pageerror', () => {});
    await page.goto(WORLD, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitReady(page);
    ok('world.html loaded; VintJoining + VintCommons + DirverseHUD present');

    await page.evaluate((css, control) => {
      try { localStorage.clear(); } catch (_) {}
      window.__sent = [];
      window.VintinuumWorld.send = function (m) { window.__sent.push(JSON.parse(JSON.stringify(m))); return true; };
      if (control) { const s = document.createElement('style'); s.id = 'jnControl'; s.textContent = css; document.head.appendChild(s); }
    }, CONTROL_CSS, CONTROL);

    assert(await page.evaluate(() => window.VintJoining.enabled() === true), 'flag on by default');
    assert(await page.evaluate(() => !Array.from(document.querySelectorAll('#dvRail .dv-launch')).some(b => /join/i.test(b.textContent || ''))),
      'NO 16th rail: no #dvRail launcher references the joining');

    // ── EMPTY — nothing known, nothing fabricated ───────────────────────────
    await page.evaluate(() => window.VintJoining.open());
    let i = await info(page);
    assert(i.open, 'opens via the registry');
    assert(i.cardIds.length === 0, 'ZERO recipe cards before any known recipe (no fabrication)', 'got ' + i.cardIds.length);
    assert(/Nothing to make together/.test(i.text), 'honest empty-state invitation shown');
    const sentOpen = await sent(page);
    assert(sentOpen.some(m => m.t === 'world:who'), 'opening asks the server who is here (world:who)');
    await collisionSweep(page, 'empty');

    // ── FEED real-shaped server frames ──────────────────────────────────────
    await page.evaluate((known) => {
      const fire = (t, d) => window.dispatchEvent(new CustomEvent(t, { detail: d }));
      fire('vint:world-state', { worldId: 'universe', resident: { userId: 1, echo: 0, lumen: 0,
        inventory: { strand: 1, ember: 1, stone: 1, timber: 1 } }, forge: { known } });
      fire('vint:world-who', { worldId: 'universe', trade: null, here: [
        { id: 'pSelf', name: 'MESELF', self: true, away: 0 },
        { id: 'pK', name: 'KESTREL', self: false, away: 8.2 },
        { id: 'pM', name: 'MERIDIAN', self: false, away: 3.1 } ] });
    }, KNOWN);
    await new Promise(r => setTimeout(r, 120));
    i = await info(page);
    assert(i.cardIds.length === 4 && ['lamp_of_two_hands', 'seeking_pick', 'hand_axe', 'great_beacon'].every(x => i.cardIds.includes(x)),
      'exactly the 4 known recipes render as cards', JSON.stringify(i.cardIds));
    assert(await page.evaluate(() => window.VintJoining._state().withId === 'pM'), 'defaults to the NEAREST peer (MERIDIAN, 3m)');
    const lamp = await cardText(page, 'lamp_of_two_hands');
    assert(/You bring 1 strand and 1 ember/.test(lamp) && /Short 1 strand/.test(lamp), 'lamp split = recipe.in − inventory (bring 1 strand + 1 ember, short 1 strand)', lamp);
    assert(/ask MERIDIAN for 1 strand/.test(lamp), 'lamp offers "ask MERIDIAN for 1 strand" (tradeable shortfall)');
    const pick = await cardText(page, 'seeking_pick');
    assert(!/ask /.test(pick) && /resonance pick does not cross a table/.test(pick), 'untradeable shortfall (resonance pick) NEVER offers an ask', pick);
    const axe = await cardText(page, 'hand_axe');
    assert(/You hold all of it/.test(axe) && /make it now/.test(axe), 'whole recipe offers "make it now"');
    const beacon = await cardText(page, 'great_beacon');
    assert(/great work/.test(beacon) && !/ask /.test(beacon), 'a big recipe routes to the great works, never a two-hand ask');
    assert(!/\bowner\b|\bowned\b|belongs to|your agent|my agent/i.test(i.text), 'NO owner/owned property language anywhere');
    assert(/Who strikes is a choice, not a rank/.test(i.text), 'co-equal framing present ("who strikes is a choice, not a rank")');

    await collisionSweep(page, 'list');

    // switching peer re-aims every act
    await page.evaluate(() => document.querySelector('#dvJoiningSheet .jn-chip[data-jn-peer="pK"]').click());
    assert(/ask KESTREL for 1 strand/.test(await cardText(page, 'lamp_of_two_hands')), 'choosing KESTREL re-aims the ask at KESTREL');
    await page.evaluate(() => document.querySelector('#dvJoiningSheet .jn-chip[data-jn-peer="pM"]').click());

    // ── THE ACT: ask → table → ready → settled → strike → teach ─────────────
    await page.evaluate(() => { window.__sent = []; });
    assert(await clickButton(page, /^ask MERIDIAN/), 'tap "ask MERIDIAN for 1 strand"');
    let s = await sent(page);
    assert(s.length === 1 && s[0].t === 'world:trade:open' && s[0].target === 'pM', 'ask sends world:trade:open aimed at the peer\'s presence id', JSON.stringify(s));
    assert(await page.evaluate(() => window.VintJoining._state().pending.phase === 'opening'), 'joining is in flight (opening) — nothing has moved yet');
    assert(await page.evaluate(() => window.VintJoining.holdsTable() === true), 'joining holds the table while its sheet is up');

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('vint:world-trade', { detail: { trade: { id: 7, aUser: 1, bUser: 2,
        aOffer: {}, bOffer: { strand: 1 }, aReady: false, bReady: true }, names: { 1: 'MESELF', 2: 'MERIDIAN' } } }));
    });
    await new Promise(r => setTimeout(r, 120));
    i = await info(page);
    const commonsOpen = await page.evaluate(() => { const c = document.getElementById('dvCommonsSheet'); return !!(c && c.classList.contains('open')); });
    assert(i.open && !commonsOpen, 'the server table renders HERE — the commons did not evict the act');
    assert(i.live && /at the table with MERIDIAN/.test(i.text), 'live table card names the peer from the server frame');
    assert(/everything you were short is on the table/.test(i.text), 'tracks the shortfall against the server\'s rendering of their offer');
    assert(/Settle this and you hold everything a lamp of two hands needs/.test(i.text), 'TABLE LENS: names what settling makes possible (from known recipes only)');
    assert(/MERIDIAN is ready/.test(i.text), 'reads their ready mark from the server frame');
    await collisionSweep(page, 'table');

    await page.evaluate(() => { window.__sent = []; });
    assert(await clickButton(page, /^ready$/), 'tap "ready"');
    s = await sent(page);
    assert(s.length === 1 && s[0].t === 'world:trade:ready' && s[0].tradeId === 7 && s[0].ready === true, 'ready sends world:trade:ready for table 7', JSON.stringify(s));

    await page.evaluate(() => {
      const fire = (t, d) => window.dispatchEvent(new CustomEvent(t, { detail: d }));
      fire('vint:world-trade-settled', { tradeId: 7, gave: {}, got: { strand: 1 } });
      fire('vint:world-state', { worldId: 'universe', resident: { userId: 1, echo: 0, lumen: 0,
        inventory: { strand: 2, ember: 1, stone: 1, timber: 1 } } });
    });
    await new Promise(r => setTimeout(r, 120));
    i = await info(page);
    assert(/the table settled with MERIDIAN/.test(i.text) && /Strike it/.test(i.text), 'settled: everything is in hand — strike offered');
    await collisionSweep(page, 'settled');
    await page.evaluate(() => { window.__sent = []; });
    assert(await clickButton(page, /^strike the lamp of two hands/), 'tap "strike the lamp of two hands"');
    s = await sent(page);
    assert(s.length === 1 && s[0].t === 'world:forge:strike' && JSON.stringify(s[0].inputs) === JSON.stringify({ strand: 2, ember: 1 }),
      'strike sends EXACTLY recipe.in (strand 2, ember 1) — nothing invented', JSON.stringify(s));
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('vint:world-forge', { detail: { matched: true, say: 'You made a lamp of two hands.' } })));
    await new Promise(r => setTimeout(r, 80));
    i = await info(page);
    assert(/You made a lamp of two hands\. MERIDIAN.s hands are in it\./.test(i.text), 'outcome is the server\'s own say, plus the peer whose hands are in it');
    assert(/is made — MERIDIAN.s part and yours/.test(i.text), 'finish card records the joint making');
    await page.evaluate(() => { window.__sent = []; });
    assert(await clickButton(page, /^teach MERIDIAN the lamp/), 'tap the return gift: "teach MERIDIAN the lamp of two hands"');
    s = await sent(page);
    assert(s.length === 1 && s[0].t === 'world:forge:teach' && s[0].target === 'pM' && s[0].recipeId === 'lamp_of_two_hands',
      'teach sends world:forge:teach (peer presence id + recipe id)', JSON.stringify(s));
    assert(await clickButton(page, /^done$/), 'tap "done" clears the act');
    assert(await page.evaluate(() => window.VintJoining._state().pending === null), 'no act in flight after done');

    // ── THE OTHER DIRECTION: bring my part → offer → called off ─────────────
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('vint:world-state', { detail: { worldId: 'universe',
      resident: { userId: 1, echo: 0, lumen: 0, inventory: { strand: 1, ember: 1 } } } })));
    await page.evaluate(() => { window.__sent = []; });
    assert(await clickButton(page, /^bring my part to MERIDIAN/), 'tap "bring my part to MERIDIAN"');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('vint:world-trade', { detail: { trade: { id: 8, aUser: 1, bUser: 2,
      aOffer: {}, bOffer: {}, aReady: false, bReady: false } } })));
    await new Promise(r => setTimeout(r, 80));
    assert(await clickButton(page, /^put my part down/), 'tap "put my part down"');
    s = await sent(page);
    const offers = s.filter(m => m.t === 'world:trade:offer');
    assert(s[0].t === 'world:trade:open' && s[0].target === 'pM', 'give opens the table with the peer');
    assert(offers.length === 2 && offers.every(o => o.tradeId === 8) &&
      offers.some(o => o.item === 'strand' && o.count === 1) && offers.some(o => o.item === 'ember' && o.count === 1),
      'give offers my tradeable part with ABSOLUTE counts (strand 1, ember 1)', JSON.stringify(offers));
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('vint:world-trade-closed', { detail: { tradeId: 8, reason: 'cancelled' } })));
    await new Promise(r => setTimeout(r, 80));
    assert(await page.evaluate(() => window.VintJoining._state().pending === null), 'a called-off table clears the act');
    assert(/came back to its hands/.test((await info(page)).text), 'says honestly that everything came back');

    // ── A COUNCIL AGENT TAKES A SEAT (task QEH297M) ─────────────────────────
    await page.evaluate(() => {
      const fire = (t, d) => window.dispatchEvent(new CustomEvent(t, { detail: d }));
      fire('vint:world-state', { worldId: 'universe', resident: { userId: 1, echo: 10, lumen: 0,
        inventory: { strand: 1, ember: 1 } } });
      fire('vint:world-who', { worldId: 'universe', trade: null,
        here: [{ id: 'pSelf', name: 'MESELF', self: true, away: 0 }, { id: 'pM', name: 'MERIDIAN', self: false, away: 3.1 }],
        agents: [{ id: 'agent:atlas', key: 'atlas', name: 'ATLAS', agent: true, away: 4.4 }] });
    });
    await new Promise(r => setTimeout(r, 100));
    i = await info(page);
    assert(i.controlText.some(t => /^ATLAS · agent/.test(t)), 'the seated-able council renders as peer chips ("ATLAS · agent")', JSON.stringify(i.controlText));
    assert(await page.evaluate(() => window.VintJoining._state().withId === 'pM'), 'a person who walked up stays first; agents follow');
    await page.evaluate(() => document.querySelector('#dvJoiningSheet .jn-chip[data-jn-peer="agent:atlas"]').click());
    assert(/ask ATLAS for 1 strand/.test(await cardText(page, 'lamp_of_two_hands')), 'choosing ATLAS re-aims the ask at the agent');
    await page.evaluate(() => { window.__sent = []; });
    assert(await clickButton(page, /^ask ATLAS/), 'tap "ask ATLAS for 1 strand"');
    s = await sent(page);
    assert(s.length === 1 && s[0].t === 'world:trade:agent:open' && s[0].agentKey === 'atlas' && JSON.stringify(s[0].want) === JSON.stringify({ strand: 1 }),
      'asking an agent sends world:trade:agent:open with EXACTLY the tradeable shortfall', JSON.stringify(s));
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('vint:world-trade', { detail: {
      trade: { id: 9, aUser: 1, bUser: 900000003, aOffer: {}, bOffer: { strand: 1 }, aReady: false, bReady: false },
      names: { 1: 'MESELF', 900000003: 'ATLAS' },
      agent: { key: 'atlas', name: 'ATLAS', reason: 'unfair', wants: 4, ready: false,
        say: "ATLAS puts down 1 strand and wants about 4 echo's worth more from you before it is ready." } } })));
    await new Promise(r => setTimeout(r, 100));
    i = await info(page);
    assert(i.live && /at the table with ATLAS/.test(i.text), 'the agent\'s table renders as a live table');
    assert(/wants about 4 echo/.test(i.text), 'the agent\'s own words about its hand are shown (server say)');
    await collisionSweep(page, 'agent-table');
    await page.evaluate(() => { window.__sent = []; });
    assert(await clickButton(page, /^put 4 echo down/), 'tap "put 4 echo down" (the agent\'s own number)');
    s = await sent(page);
    assert(s.length === 1 && s[0].t === 'world:trade:offer' && s[0].tradeId === 9 && s[0].item === 'echo' && s[0].count === 4,
      'paying the agent sends world:trade:offer echo 4 (absolute)', JSON.stringify(s));
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('vint:world-trade-closed', { detail: { tradeId: 9, reason: 'cancelled' } })));
    await new Promise(r => setTimeout(r, 80));
    assert(await page.evaluate(() => window.VintJoining._state().pending === null), 'the agent table called off clears the act');
    await page.evaluate(() => { window.__sent = []; });
    assert(await clickButton(page, /^teach ATLAS this/), 'tap "teach ATLAS this"');
    s = await sent(page);
    assert(s.length === 1 && s[0].t === 'world:forge:teach' && s[0].target === 'agent:atlas', 'teaching an agent addresses its seat id (agent:atlas)', JSON.stringify(s));
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('vint:world-forge-taught', { detail: { say: 'taught.' } })));

    // ── MANY PEERS + LONG NAMES ─────────────────────────────────────────────
    await page.evaluate(() => {
      const here = [{ id: 'pSelf', name: 'MESELF', self: true, away: 0 }];
      for (let k = 0; k < 18; k++) here.push({ id: 'p' + k, name: 'A-PEER-WITH-A-VERY-LONG-NAME-THAT-NEVER-ENDS-' + k, self: false, away: k + 1 });
      window.dispatchEvent(new CustomEvent('vint:world-who', { detail: { here, trade: null } }));
    });
    await new Promise(r => setTimeout(r, 100));
    assert((await info(page)).controlText.filter(t => /A-PEER/.test(t)).length >= 18, 'many-peer: every peer gets its own chip');
    await collisionSweep(page, 'many-peer');
    await page.evaluate(() => window.VintJoining.close());

    // ── COMMONS ENTRY ───────────────────────────────────────────────────────
    await page.evaluate(() => window.VintCommons.open());
    await page.waitForFunction(() => { const s = document.getElementById('dvCommonsSheet'); return s && s.classList.contains('open'); }, { timeout: 5000 });
    const entry = await page.evaluate(() => {
      const row = document.querySelector('#dvCommonsSheet .jn-entry');
      if (!row) return { present: false };
      const r = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, height: b.height }; };
      const R = r(row);
      const body = document.querySelector('#dvCommonsSheet .dv-body');
      const sibs = Array.from(document.querySelectorAll('#dvCommonsSheet .sp-entry, #dvCommonsSheet .wv-entry, #dvCommonsSheet .cv-entry, #dvCommonsSheet .cf-entry, #dvCommonsSheet .cm-row'))
        .filter(n => n.getClientRects().length).map(r);
      const hits = sibs.filter(b => !(R.right <= b.left + 0.5 || b.right <= R.left + 0.5 || R.bottom <= b.top + 0.5 || b.bottom <= R.top + 0.5)).length;
      return { present: true, rect: R, body: body ? r(body) : null, hits, sibs: sibs.length };
    });
    assert(entry.present, 'joining entry appears inside the commons body');
    if (entry.present) {
      assert(entry.rect.height >= 44, 'entry meets the 44px floor', 'h=' + entry.rect.height);
      assert(!entry.body || (entry.rect.left >= entry.body.left - 1 && entry.rect.right <= entry.body.right + 1), 'entry stays inside the commons body');
      assert(entry.hits === 0, 'entry overlaps none of its ' + entry.sibs + ' siblings (spire/weave/convergence/confluence entries, roster rows)', 'hits=' + entry.hits);
    }

    // ── ONE-OPEN ────────────────────────────────────────────────────────────
    await page.evaluate(() => window.VintJoining.open());
    await new Promise(r => setTimeout(r, 100));
    const ev1 = await page.evaluate(() => ({ j: window.VintJoining.isOpen(), c: window.VintCommons.isOpen() }));
    assert(ev1.j && !ev1.c, 'one-open: opening the joining closed the commons', JSON.stringify(ev1));
    await page.evaluate(() => window.VintCommons.open());
    await new Promise(r => setTimeout(r, 100));
    const ev2 = await page.evaluate(() => ({ j: window.VintJoining.isOpen(), c: window.VintCommons.isOpen() }));
    assert(!ev2.j && ev2.c, 'one-open: opening the commons closed the joining', JSON.stringify(ev2));
    await page.evaluate(() => window.VintCommons.close());

    // ── KILL SWITCH ─────────────────────────────────────────────────────────
    await page.goto(WORLD + '?joining=0', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitReady(page);
    const killed = await page.evaluate(() => {
      const en = window.VintJoining.enabled();
      window.VintJoining.open();
      const s = document.getElementById('dvJoiningSheet');
      window.VintCommons.open();
      const entry = !!document.querySelector('#dvCommonsSheet .jn-entry');
      return { en, open: !!(s && s.classList.contains('open')), entry };
    });
    assert(killed.en === false && !killed.open && !killed.entry, 'kill switch: ?joining=0 → disabled, raises nothing, no commons entry', JSON.stringify(killed));
  } catch (e) {
    bad('harness threw: ' + e.message, e.stack);
  } finally {
    await browser.close();
  }

  const passed = results.filter(r => r.pass).length;
  console.log('\n──────────────────────────────────────────');
  console.log(`RESULT: ${passed}/${results.length} pass` + (CONTROL ? '  (negative control — expected RED)' : ''));
  console.log('──────────────────────────────────────────');
  process.exit(passed === results.length ? 0 : 1);
})();
