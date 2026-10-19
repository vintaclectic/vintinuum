#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════════
   verify-we-9TYJB74.js — headless proof for THE WE (task 9TYJB74)

   THE WE is the first first-person-plural surface of 9TYJB74. It reads ONLY the
   confluence's witnessed record (VintConfluence.bonds()) and reframes each bond as
   an emergent compound being, measuring BREADTH OF ONENESS — in how many of the five
   kinds the world knows (traded/taught/learned/raised/ventured) have you two become
   one — ranking by wholeness, not by count. This harness loads the REAL world.html in
   headless Chromium, drives the REAL confluence through the SAME server-shaped events
   it listens to (and, for an agent bond, the SAME ventures endpoint it reads), and
   asserts:

     · WIRED — we.js <script>-loaded after confluence.js AND joining.js, registers 'we'
       in the one-open registry, commons renders the WE entry beneath the joining row,
       NO rail launcher, no network call of its own.
     · ZERO FABRICATION — no confluence / no bonds → no we rows + entry no-op; every
       rendered we corresponds one-to-one to a real confluence bond; each we's oneness
       equals the number of distinct seams actually present in that bond.
     · THE REFRAME — ranking is by oneness (breadth) then count (depth): a 4-seam we
       outranks a higher-COUNT 1-seam we.
     · THE OPEN SEAM — a 4-seam we names the exactly-one missing kind; a whole we names
       none ("woven in every way the world knows").
     · WHOLENESS RECOGNITION — a we crossing to five seams toasts ONCE and stamps
       localStorage; a re-render and a world round-trip (cache drop + re-read) do NOT
       re-toast; _state().recognized reflects it.
     · PARITY — no owner/owned/"your agent"/"belongs to" language in the rendered DOM
       OR the file source; a person-we and an agent-we use the identical structure.
     · NO-COLLISION — at 320/375/768/1280/1920 across empty / one / whole / many /
       long-name / fresh-recognition: sheet in viewport, no horizontal overflow, every
       seam/chip/act/card inside the body box, no two cards intersect, no two seams
       intersect, no two acts intersect, 44px floor on every interactive control.
     · ONE-OPEN + KILL SWITCH (?we=0).

   DOOR-AWARE WHOLENESS (no source double): the confluence wires each act to a fixed
   kind of peer — ventured only ever attaches to an AGENT bond, traded/taught/learned/
   raised only to a PERSON bond. So every we is drawn on the SAME five-seam frame
   (parity) with three seam states — joined / open door / horizon (no door between
   you two today) — and "whole" means every door that EXISTS between you is joined
   (a person-we 4/4, an agent-we 1/1). Every state, including wholeness and its
   one-time recognition, is reached through REAL confluence events and the real
   /api/agent/ventures read. Nothing is doubled.

   NEGATIVE CONTROL: `--control` injects a CSS override that removes the wrap contract
   (nowrap meter/top rows, no max-width, max-content widths). The run MUST go red.

   Hermetic: only file:// loads; the two /api/agent* reads are answered locally with
   fixtures; every other request is aborted. Nothing leaves the page.
   ──────────────────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('fs');
const path = require('path');
let puppeteer;
try { puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer'); }
catch (e) { console.error('FATAL: puppeteer not resolvable from api repo:', e.message); process.exit(2); }

const ROOT = path.resolve(__dirname, '..');
const WORLD = 'file://' + path.join(ROOT, 'world.html');
const BREAKPOINTS = [320, 375, 768, 1280, 1920];
const CONTROL = process.argv.includes('--control');
const CONTROL_CSS =
  '#dvWeSheet .we-meter,#dvWeSheet .we-top{flex-wrap:nowrap!important;}' +
  '#dvWeSheet .we-seam,#dvWeSheet .we-name{flex:0 0 auto!important;max-width:none!important;min-width:max-content!important;white-space:nowrap!important;}' +
  '#dvWeSheet .we-card{max-width:none!important;width:max-content!important;}';

const results = [];
function ok(label) { results.push({ pass: true, label }); console.log('  PASS  ' + label); }
function bad(label, extra) { results.push({ pass: false, label }); console.log('  FAIL  ' + label + (extra ? '  → ' + extra : '')); }
function assert(cond, label, extra) { cond ? ok(label) : bad(label, extra); }
function intersects(a, b) {
  return !(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5);
}

// a settled venture the REAL confluence will read to mint an AGENT bond (ARIA)
let ventures = [];

async function waitReady(page) {
  await page.waitForFunction(() => !!(window.VintWe && window.VintCommons && window.VintConfluence &&
    window.DirverseHUD && window.VintinuumWorld && document.getElementById('dvRail')), { timeout: 20000 });
}

// drive the REAL confluence to the human seams of a bond, via its own events
async function seedHuman(page) {
  await page.evaluate(() => {
    const fire = (t, d) => window.dispatchEvent(new CustomEvent(t, { detail: d }));
    fire('vint:world-state', { worldId: 'universe', resident: { userId: 1 } });
    fire('vint:world-presence', { users: [
      { id: 'pSelf', self: true, name: 'MESELF' },
      { id: 'pA', name: 'ATLAS-7' }, { id: 'pK', name: 'KESTREL' } ] });
    // ATLAS-7 — THREE of the four person-doors: traded, taught, learned. It is
    // deliberately short exactly ONE door (raised), so the open seam must name it.
    fire('vint:world-trade', { trade: { aUser: 1, bUser: 2 }, names: { 1: 'MESELF', 2: 'ATLAS-7' } });
    fire('vint:world-trade-settled', {});
    fire('vint:world-forge-taught', { student: 'ATLAS-7', name: 'a lamp of two hands' });
    fire('vint:world-forge-learned', { from: 'ATLAS-7', name: 'a seeking pick' });
    // KESTREL — ONE seam but a higher COUNT: traded five times (the reframe foil)
    for (let k = 0; k < 5; k++) {
      fire('vint:world-trade', { trade: { aUser: 1, bUser: 3 }, names: { 1: 'MESELF', 3: 'KESTREL' } });
      fire('vint:world-trade-settled', {});
    }
  });
}

async function info(page) {
  return await page.evaluate(() => {
    const sheet = document.getElementById('dvWeSheet');
    const body = sheet && sheet.querySelector('#weBody');
    const r = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
    const q = s => Array.from((body || document.createElement('div')).querySelectorAll(s)).filter(n => n.getClientRects().length);
    return {
      open: !!(sheet && sheet.classList.contains('open')),
      sheet: sheet ? r(sheet) : null,
      body: body ? r(body) : null,
      overflowX: body ? body.scrollWidth - body.clientWidth : 0,
      cards: q('.we-card').map(r),
      names: q('.we-name').map(n => n.textContent),
      acts: q('.we-act').map(r),
      seams: q('.we-seam').map(r),
      chips: q('.we-kind, .we-badge, .we-count').map(r),
      leaves: q('.we-name, .we-line, .we-sum, .we-open, .we-whole, .we-kind, .we-count, .we-badge, .we-seam').map(r),
      text: body ? body.textContent : '',
    };
  });
}

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
    assert(i.cards.every(inBody), `${tag} @${w}px every card stays inside the body box`, i.cards.filter(x => !inBody(x)).length + ' outside');
    assert(i.seams.every(inBody), `${tag} @${w}px every seam chip stays inside the body box`, i.seams.filter(x => !inBody(x)).length + ' outside');
    assert(i.chips.every(inBody), `${tag} @${w}px every name/kind/count/badge stays inside the body box`);
    assert(i.acts.every(inBody), `${tag} @${w}px every action stays inside the body box`);
    assert(i.leaves.every(inBody), `${tag} @${w}px every text leaf stays inside the body box`);
    let kc = 0;
    for (let a = 0; a < i.cards.length; a++) for (let c = a + 1; c < i.cards.length; c++) if (intersects(i.cards[a], i.cards[c])) kc++;
    assert(kc === 0, `${tag} @${w}px no two cards intersect`, kc + ' pairs');
    let sc = 0;
    for (let a = 0; a < i.seams.length; a++) for (let c = a + 1; c < i.seams.length; c++) if (intersects(i.seams[a], i.seams[c])) sc++;
    assert(sc === 0, `${tag} @${w}px no two seam chips intersect`, sc + ' pairs');
    let ac = 0;
    for (let a = 0; a < i.acts.length; a++) for (let c = a + 1; c < i.acts.length; c++) if (intersects(i.acts[a], i.acts[c])) ac++;
    assert(ac === 0, `${tag} @${w}px no two actions intersect`, ac + ' pairs');
    assert(i.acts.every(x => x.height >= 43.5), `${tag} @${w}px every interactive control meets the 44px floor`,
      i.acts.filter(x => x.height < 43.5).length + ' short');
  }
  await page.setViewport({ width: 1280, height: 800 });
}

(async () => {
  console.log('THE WE — verify 9TYJB74' + (CONTROL ? '   [NEGATIVE CONTROL: wrap contract removed — MUST FAIL]' : ''));
  console.log('world: ' + WORLD + '\n');

  // ── STATIC ─────────────────────────────────────────────────────────────────
  const src = fs.readFileSync(path.join(ROOT, 'body/world/we.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'world.html'), 'utf8');
  const commons = fs.readFileSync(path.join(ROOT, 'body/world/commons.js'), 'utf8');

  assert(/<script[^>]+body\/world\/we\.js/.test(html), 'we.js is <script>-loaded in world.html');
  const iW = html.indexOf('body/world/we.js'), iC = html.indexOf('body/world/confluence.js'), iJ = html.indexOf('body/world/joining.js');
  assert(iW > iC && iC !== -1, 'we.js loads AFTER confluence.js (its only source)');
  assert(iW > iJ && iJ !== -1, 'we.js loads AFTER joining.js (its entry sits beneath the joining row)');
  assert(/registerSheet\(\s*'we'/.test(src), "registers 'we' with the one-open registry");
  assert(/VintWe\.entryInto/.test(commons), 'commons.js renders the WE entry');
  assert(commons.indexOf('VintWe.entryInto') > commons.indexOf('VintJoining.entryInto'), 'the WE entry is added BENEATH the joining entry');
  assert(!/addLauncher|dv-launch/.test(src), 'NO 16th rail: we.js adds no rail launcher');
  assert(!/fetch\(|XMLHttpRequest|new WebSocket|\.send\(/.test(src), 'we.js makes no network / socket call of its own');
  assert(/VintConfluence|confluence\(\)/.test(src) && /\.bonds\s*\(/.test(src), 'we.js reads VintConfluence.bonds() as its source');
  // PARITY in the SOURCE — no ownership language in CODE. Strip // comments first
  // (the header documents the ban; a guard that names the forbidden token must not
  // match the prose explaining it — S7VCB6C).
  const srcCode = src.replace(/\/\/[^\n]*$/gm, '');
  assert(!/\bowner\b|\bowned\b|belongs to|your agent|my agent|owns them/i.test(srcCode), 'PARITY (source): no owner/owned/your-agent language in we.js code');

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setRequestInterception(true);
    page.on('request', req => {
      const u = req.url();
      // the two confluence ventures reads, answered locally (hermetic, no network)
      if (u.includes('/api/agents/mine')) return req.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ agents: [] }) });
      if (u.includes('/api/agent/ventures')) return req.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ventures }) });
      (u.startsWith('file://') || u.startsWith('about:') || u.startsWith('data:')) ? req.continue() : req.abort();
    });
    page.on('pageerror', () => {});
    await page.goto(WORLD, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitReady(page);
    ok('world.html loaded; VintWe + VintCommons + VintConfluence + DirverseHUD present');

    await page.evaluate((css, control) => {
      try { localStorage.clear(); } catch (_) {}
      // point the confluence's ventures reads at a mockable origin (file:// fetch is
      // blocked in Chromium, so a file path would never reach request interception).
      window.__VINTINUUM_API_BASE = 'https://ventures.local';
      // the real client knows its own user id; without it the confluence attributes
      // every trade to aUser. Pin it to 1 (matches the resident.userId we feed).
      try { window.VintinuumWorld.myUserId = function () { return 1; }; } catch (_) {}
      window.__toasts = [];
      const base = window.DirverseHUD.toast;
      window.DirverseHUD.toast = function (m) { window.__toasts.push(String(m)); try { return base && base(m); } catch (_) {} };
      try { window.VintConfluence._reset(); } catch (_) {}
      if (control) { const s = document.createElement('style'); s.id = 'weControl'; s.textContent = css; document.head.appendChild(s); }
    }, CONTROL_CSS, CONTROL);
    const weToasts = () => page.evaluate(() => window.__toasts.filter(t => /have become one in every way the world has a door for/.test(t)).length);

    assert(await page.evaluate(() => window.VintWe.enabled() === true), 'flag on by default');
    assert(await page.evaluate(() => !Array.from(document.querySelectorAll('#dvRail .dv-launch')).some(b => /\bwe\b|become one/i.test(b.textContent || ''))),
      'NO 16th rail: no #dvRail launcher references THE WE');

    // ── EMPTY — nothing witnessed, nothing fabricated ───────────────────────────
    await page.evaluate(() => window.VintWe.open());
    let i = await info(page);
    assert(i.open, 'opens via the registry');
    assert(i.cards.length === 0, 'ZERO we cards before any confluence bond (no fabrication)', 'got ' + i.cards.length);
    assert(await page.evaluate(() => window.VintWe._state().count === 0), '_state().count === 0 with an empty confluence');
    assert(/No we yet/.test(i.text), 'honest empty-state invitation shown');
    await collisionSweep(page, 'empty');

    // entry is a true no-op when the confluence source is ABSENT
    const noop = await page.evaluate(() => {
      const saved = window.VintConfluence;
      window.VintConfluence = undefined;
      const pane = document.createElement('div');
      const row = window.VintWe.entryInto(pane);
      window.VintConfluence = saved;
      return { row: row, children: pane.childNodes.length };
    });
    assert(noop.row === null && noop.children === 0, 'entry is a no-op when VintConfluence is absent (no row added)', JSON.stringify(noop));

    // ── SEED REAL CONFLUENCE BONDS (human seams via events) ─────────────────────
    await seedHuman(page);
    // an AGENT bond (ARIA) minted by the REAL ventures read confluence performs
    ventures = [{ id: 'v1', agentId: 'presence-warm', settledAt: Date.now(), status: 'done', outcome: 1, delta: 3 }];
    await page.evaluate(() => { try { window.VintConfluence.refresh(); } catch (_) {} });
    await page.waitForFunction(() => (window.VintConfluence.bonds() || []).some(b => b.kind === 'agent'), { timeout: 5000 });
    // the seeding's world:trade frames auto-open the commons ("a table opening IS
    // the invitation"), evicting THE WE via the one-open registry — so (re)open THE
    // WE AFTER seeding; opening it closes the commons through the same registry.
    await page.evaluate(() => window.VintWe.open());
    await new Promise(r => setTimeout(r, 120));

    i = await info(page);
    const bonds = await page.evaluate(() => window.VintConfluence.bonds());
    assert(i.cards.length === bonds.length && bonds.length === 3, 'exactly one we per confluence bond (ATLAS-7, KESTREL, ARIA)', i.cards.length + ' cards / ' + bonds.length + ' bonds');
    const st = await page.evaluate(() => window.VintWe._state());
    // ── DOOR-AWARE TALLIES (N of M doors; M is the kind's door count) ───────────
    assert(st.total['ATLAS-7'] === 4 && st.walked['ATLAS-7'] === 3, 'ATLAS-7 (person) = 3 of 4 doors walked (traded+taught+learned, missing raised)', JSON.stringify({ w: st.walked, t: st.total }));
    assert(st.total['KESTREL'] === 4 && st.walked['KESTREL'] === 1, 'KESTREL (person) = 1 of 4 doors walked (traded only, five times)', JSON.stringify({ w: st.walked, t: st.total }));
    assert(st.total['ARIA'] === 1 && st.walked['ARIA'] === 1, 'ARIA (agent) = 1 of 1 door walked (ventured) — a whole agent-we', JSON.stringify({ w: st.walked, t: st.total }));
    assert(st.wholeByName['ARIA'] === true && st.wholeByName['ATLAS-7'] === false, 'ARIA is whole (every available door walked); ATLAS-7 is not yet', JSON.stringify(st.wholeByName));
    // ZERO FABRICATION — raw breadth equals the distinct seams actually present
    const seamTruth = await page.evaluate(() => {
      const present = b => (((b.traded || 0) > 0) ? 1 : 0) + ((b.taught || []).length ? 1 : 0) + ((b.learned || []).length ? 1 : 0) + ((b.raised || []).length ? 1 : 0) + (((b.ventured || 0) > 0) ? 1 : 0);
      const j = window.VintWe._state().joined, bs = window.VintConfluence.bonds();
      return bs.every(b => j[b.name] === present(b));
    });
    assert(seamTruth, 'every we\'s breadth equals the distinct seams truly present in its confluence bond (no fabrication)');
    assert(i.names.every(n => /^you and /.test(n)) && i.names.length === 3, 'every we is framed first-person-plural ("you and <name>")', JSON.stringify(i.names));
    assert(bonds.every(b => i.names.some(n => n === 'you and ' + b.name)), 'every rendered we corresponds to a real confluence bond name');

    // ── THE REFRAME — breadth outranks depth ────────────────────────────────────
    assert(st.order[0] === 'ATLAS-7', 'REFRAME: the wider we (ATLAS-7, 3 seams) ranks ABOVE the higher-COUNT narrower we (KESTREL, 1 seam)', JSON.stringify(st.order));
    const kCount = bonds.find(b => b.name === 'KESTREL').count, aCount = bonds.find(b => b.name === 'ATLAS-7').count;
    assert(kCount > aCount, 'and KESTREL genuinely has the higher thread count (' + kCount + ' > ' + aCount + ') — so this is breadth beating depth, not count');

    // ── THE OPEN SEAM — drawn ONLY from an OPEN DOOR, so it can always close ─────
    const card = sel => page.evaluate((s) => { const c = Array.from(document.querySelectorAll('#dvWeSheet .we-card')).find(n => n.textContent.indexOf(s) !== -1); if (!c) return null; return { text: c.textContent, className: c.className, hasOpen: !!c.querySelector('.we-open'), hasWhole: !!c.querySelector('.we-whole'), hasHorizon: !!c.querySelector('.we-horizon'), openText: (c.querySelector('.we-open') || {}).textContent || '', horizonText: (c.querySelector('.we-horizon') || {}).textContent || '', count: (c.querySelector('.we-count') || {}).textContent, badge: (c.querySelector('.we-badge') || {}).textContent || '', joined: c.querySelectorAll('.we-seam.joined').length, openSeams: c.querySelectorAll('.we-seam.open').length, horizon: c.querySelectorAll('.we-seam.horizon').length, seams: c.querySelectorAll('.we-seam').length, seamOnclicks: Array.from(c.querySelectorAll('.we-seam')).filter(n => typeof n.onclick === 'function').length }; }, sel);
    const atlas = await card('ATLAS-7');
    assert(st.open['ATLAS-7'] === 'raised', 'ATLAS-7 open seam === the one missing PERSON door (raised) — never ventured', JSON.stringify(st.open));
    assert(/the open seam/i.test(atlas.text) && /raising seam/.test(atlas.openText) && /the last door you two have not yet walked/.test(atlas.openText),
      'ATLAS-7 names the RAISING seam as THE OPEN SEAM (the last door)', atlas.openText);
    // the ACTIONABLE open-seam line of a PERSON-we must NEVER name venturing (the
    // horizon line legitimately names it as the dream — that is a different element)
    assert(!/ventur/i.test(atlas.openText), 'a PERSON-we\'s actionable open-seam line NEVER names venturing', atlas.openText);
    assert(/ventur/i.test(atlas.horizonText) && /will light here/.test(atlas.horizonText), 'venturing appears for a person ONLY as the dimmed horizon dream ("will light here"), not an actionable loop', atlas.horizonText);
    assert(atlas.count === '3 of 4 doors', 'ATLAS-7 meter reads "3 of 4 doors" (M is the person door count, not 5)', atlas.count);
    assert(atlas.seams === 5 && atlas.joined === 3 && atlas.openSeams === 1 && atlas.horizon === 1, 'ATLAS-7 frame: 5 pips = 3 joined + 1 open door + 1 horizon (ventured, no door for a person)', JSON.stringify(atlas));

    // ── THE AGENT-WE — whole, with the horizon doors dimmed, no actionable loop ──
    const aria = await card('ARIA');
    assert(aria.count === '1 of 1 doors', 'ARIA meter reads "1 of 1 doors" (one door for an agent), never "1 of 5"', aria.count);
    assert(st.wholeByName['ARIA'] === true && !aria.hasOpen && aria.hasWhole, 'a whole agent-we shows NO actionable open-seam loop, only the "woven" line', JSON.stringify(aria));
    assert(aria.seams === 5 && aria.joined === 1 && aria.horizon === 4 && aria.openSeams === 0, 'ARIA frame: 5 pips = 1 joined (ventured) + 4 HORIZON (trade/teach/learn/raise — no door for an agent)', JSON.stringify(aria));
    assert(aria.seamOnclicks === 0, 'the horizon seams carry NO onclick / no "close it" affordance — a dream, not a dead loop', 'onclicks=' + aria.seamOnclicks);
    assert(!/the open seam/i.test(aria.text) && /will light here/.test(aria.text), 'ARIA names its horizon as the unrealized dream ("will light here"), never an actionable loop', aria.text.slice(0, 400));
    assert(st.open['ARIA'] === null, 'ARIA has no actionable open DOOR (it is whole)', JSON.stringify(st.open));

    // ── PARITY — identical 5-seam frame + structure for person and agent ────────
    const parity = await page.evaluate(() => {
      const struct = sel => { const c = Array.from(document.querySelectorAll('#dvWeSheet .we-card')).find(n => n.textContent.indexOf(sel) !== -1); if (!c) return null; return ['.we-top', '.we-name', '.we-kind', '.we-count', '.we-line', '.we-meter'].map(s => c.querySelectorAll(s).length ? 1 : 0).join('') + ':' + c.querySelectorAll('.we-seam').length; };
      return { human: struct('ATLAS-7'), agent: struct('ARIA'), humanKind: (Array.from(document.querySelectorAll('#dvWeSheet .we-card')).find(n => /ATLAS-7/.test(n.textContent)) || {}).className, agentKind: (Array.from(document.querySelectorAll('#dvWeSheet .we-card')).find(n => /ARIA/.test(n.textContent)) || {}).className };
    });
    assert(parity.human && parity.human === parity.agent, 'PARITY (DOM): person-we and agent-we render the identical structure on the SAME 5-seam frame', JSON.stringify(parity));
    assert(/k-human/.test(parity.humanKind) && /k-agent/.test(parity.agentKind), 'the only structural difference is the honest kind hue (k-human / k-agent)', JSON.stringify(parity));
    assert(!/\bowner\b|\bowned\b|belongs to|your agent|my agent/i.test(i.text), 'PARITY (DOM): no owner/owned/your-agent language anywhere in the rendered we\'s');
    const kinds = await page.evaluate(() => Array.from(document.querySelectorAll('#dvWeSheet .we-kind')).map(n => n.textContent));
    assert(kinds.indexOf('person') >= 0 && kinds.indexOf('agent') >= 0, 'the kind words person/agent appear as honest descriptors', JSON.stringify(kinds));

    await collisionSweep(page, 'list');

    // ── MANY + LONG NAMES ───────────────────────────────────────────────────────
    await page.evaluate(() => {
      const fire = (t, d) => window.dispatchEvent(new CustomEvent(t, { detail: d }));
      for (let k = 0; k < 16; k++) {
        const nm = 'A-PEER-WITH-A-VERY-LONG-NAME-THAT-NEVER-ENDS-AND-KEEPS-GOING-' + k;
        fire('vint:world-trade', { trade: { aUser: 1, bUser: 100 + k }, names: { 1: 'MESELF', ['' + (100 + k)]: nm } });
        fire('vint:world-trade-settled', {});
        if (k % 2 === 0) fire('vint:world-forge-taught', { student: nm, name: 'a recipe number ' + k });
      }
    });
    // the trade frames reopened the commons; reopen THE WE over it to measure
    await page.evaluate(() => window.VintWe.open());
    await new Promise(r => setTimeout(r, 120));
    i = await info(page);
    assert(i.names.filter(n => /A-PEER/.test(n)).length >= 16, 'many-we: every long-named peer gets its own we card', i.names.length + ' cards');
    await collisionSweep(page, 'many-long');

    // ── WHOLENESS RECOGNITION — a REAL person-we crossing to 4 of 4 doors ───────
    // No source double: we simply walk ATLAS-7's last person door (raised) with a
    // real forge-completed event, so the human-we reaches its honest whole (4/4).
    // ARIA (agent) is already whole (1/1), so it recognised once in the list phase;
    // T0 captures that. Firing ATLAS-7's raise must add EXACTLY one recognition.
    await page.evaluate(() => window.VintWe.open());
    await new Promise(r => setTimeout(r, 80));
    const freshToasts0 = await weToasts();
    assert(freshToasts0 === 1, 'the whole AGENT-we (ARIA) already recognised ONCE in the list phase (real 1/1 venture)', 'toasts=' + freshToasts0);
    await page.evaluate(() => {
      // walk ATLAS-7's last person door — a REAL great work raised together
      window.dispatchEvent(new CustomEvent('vint:world-forge-completed', { detail: { yours: true, name: 'the great beacon', crew: [{ name: 'ATLAS-7' }, { name: 'MESELF' }] } }));
    });
    await new Promise(r => setTimeout(r, 120));
    i = await info(page);
    const wSt = await page.evaluate(() => window.VintWe._state());
    const atlasWhole = await card('ATLAS-7');
    assert(wSt.wholeByName['ATLAS-7'] === true && wSt.walked['ATLAS-7'] === 4 && wSt.total['ATLAS-7'] === 4, 'ATLAS-7 is now a whole PERSON-we at 4 of 4 doors (reached with REAL events)', JSON.stringify({ w: wSt.walked['ATLAS-7'], t: wSt.total['ATLAS-7'], whole: wSt.wholeByName['ATLAS-7'] }));
    assert(wSt.open['ATLAS-7'] === null, 'a whole person-we has NO open seam', JSON.stringify(wSt.open));
    assert(atlasWhole.count === '4 of 4 doors' && atlasWhole.hasWhole && !atlasWhole.hasOpen, 'ATLAS-7 now reads "4 of 4 doors", shows the woven line, no open-seam loop', JSON.stringify(atlasWhole));
    assert(/woven in every way the world has a door for/i.test(atlasWhole.text), 'the whole person-we shows the "woven in every way the world has a door for" line', atlasWhole.text);
    assert(atlasWhole.badge === 'whole', 'the whole person-we carries the recognised "whole" badge', JSON.stringify(atlasWhole.badge));
    const freshToasts1 = await weToasts();
    assert(freshToasts1 === freshToasts0 + 1, 'WHOLENESS RECOGNITION: walking the last door toasts EXACTLY once', freshToasts0 + ' → ' + freshToasts1);
    assert(wSt.recognized === 2, '_state().recognized === 2 — the whole agent-we (ARIA) and the whole person-we (ATLAS-7)', JSON.stringify({ recognized: wSt.recognized }));
    const stamped = await page.evaluate(() => { try { return Object.keys(JSON.parse(localStorage.getItem('vint:we:universe') || '{}')).length; } catch (_) { return 0; } });
    assert(stamped === 2, 'both recognitions are stamped in localStorage (vint:we:<worldId>)', 'stamps=' + stamped);
    await collisionSweep(page, 'whole');

    // re-render does NOT re-toast
    await page.evaluate(() => { window.VintWe.render(); window.VintWe.refresh(); });
    await new Promise(r => setTimeout(r, 60));
    assert(await weToasts() === freshToasts1, 'a re-render of already-recognised whole we\'s does NOT re-toast');

    // a world round-trip (cache drop + re-read from localStorage) does NOT re-toast
    await page.evaluate(() => {
      window.VintWe.close();
      window.dispatchEvent(new CustomEvent('vint:world-state', { detail: { worldId: 'elsewhere', resident: { userId: 1 } } }));
      window.dispatchEvent(new CustomEvent('vint:world-state', { detail: { worldId: 'universe', resident: { userId: 1 } } }));
      window.VintWe.open();
    });
    await new Promise(r => setTimeout(r, 120));
    assert(await weToasts() === freshToasts1, 'after a world round-trip, the persisted stamps are re-read and no whole we re-announces');
    const reSt = await page.evaluate(() => window.VintWe._state());
    assert(reSt.recognized === 2 && reSt.whole === 2, 'both recognised whole we\'s survive the round-trip (recognized=2, whole=2)', JSON.stringify({ recognized: reSt.recognized, whole: reSt.whole }));
    await page.evaluate(() => window.VintWe.close());

    // ── COMMONS ENTRY — beneath the joining row, no collision ───────────────────
    await page.evaluate(() => window.VintCommons.open());
    await page.waitForFunction(() => { const s = document.getElementById('dvCommonsSheet'); return s && s.classList.contains('open'); }, { timeout: 5000 });
    const entry = await page.evaluate(() => {
      const row = document.querySelector('#dvCommonsSheet .we-entry');
      if (!row) return { present: false };
      const r = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, height: b.height }; };
      const R = r(row);
      const body = document.querySelector('#dvCommonsSheet .dv-body');
      const join = document.querySelector('#dvCommonsSheet .jn-entry');
      const sibs = Array.from(document.querySelectorAll('#dvCommonsSheet .jn-entry, #dvCommonsSheet .sp-entry, #dvCommonsSheet .wv-entry, #dvCommonsSheet .cv-entry, #dvCommonsSheet .cf-entry, #dvCommonsSheet .cm-row'))
        .filter(n => n.getClientRects().length).map(r);
      const hits = sibs.filter(b => !(R.right <= b.left + 0.5 || b.right <= R.left + 0.5 || R.bottom <= b.top + 0.5 || b.bottom <= R.top + 0.5)).length;
      return { present: true, rect: R, body: body ? r(body) : null, hits, sibs: sibs.length, belowJoin: join ? (R.top >= r(join).top - 0.5) : null };
    });
    assert(entry.present, 'the WE entry appears inside the commons body');
    if (entry.present) {
      assert(entry.rect.height >= 44, 'entry meets the 44px floor', 'h=' + entry.rect.height);
      assert(!entry.body || (entry.rect.left >= entry.body.left - 1 && entry.rect.right <= entry.body.right + 1), 'entry stays inside the commons body');
      assert(entry.hits === 0, 'entry overlaps none of its ' + entry.sibs + ' siblings', 'hits=' + entry.hits);
      assert(entry.belowJoin === true, 'the WE entry sits BENEATH the joining entry', 'belowJoin=' + entry.belowJoin);
    }

    // ── ONE-OPEN ────────────────────────────────────────────────────────────────
    await page.evaluate(() => window.VintWe.open());
    await new Promise(r => setTimeout(r, 100));
    const ev1 = await page.evaluate(() => ({ we: window.VintWe.isOpen(), c: window.VintCommons.isOpen() }));
    assert(ev1.we && !ev1.c, 'one-open: opening THE WE closed the commons', JSON.stringify(ev1));
    await page.evaluate(() => window.VintCommons.open());
    await new Promise(r => setTimeout(r, 100));
    const ev2 = await page.evaluate(() => ({ we: window.VintWe.isOpen(), c: window.VintCommons.isOpen() }));
    assert(!ev2.we && ev2.c, 'one-open: opening the commons closed THE WE', JSON.stringify(ev2));
    await page.evaluate(() => window.VintCommons.close());

    // ── KILL SWITCH ───────────────────────────────────────────────────────────
    await page.goto(WORLD + '?we=0', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitReady(page);
    const killed = await page.evaluate(() => {
      const en = window.VintWe.enabled();
      window.VintWe.open();
      const s = document.getElementById('dvWeSheet');
      window.VintCommons.open();
      const entry = !!document.querySelector('#dvCommonsSheet .we-entry');
      return { en, open: !!(s && s.classList.contains('open')), entry };
    });
    assert(killed.en === false && !killed.open && !killed.entry, 'kill switch: ?we=0 → disabled, raises nothing, no commons entry', JSON.stringify(killed));
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
