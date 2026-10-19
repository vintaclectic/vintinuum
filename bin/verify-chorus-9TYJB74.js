#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════════
   verify-chorus-9TYJB74.js — headless proof for THE CHORUS (task 9TYJB74)

   THE CHORUS is the first COLLECTIVE first-person-plural surface of 9TYJB74. It
   reads ONLY the confluence's witnessed record (VintConfluence.bonds()) and
   collapses every being woven with you (people AND agents, co-equal) into a single
   body "us", measuring each of the five seams (traded/taught/learned/raised/
   ventured) across EVERYONE at once as the five VOICES of one chord. Breadth is how
   many voices ring (0..5); it names the one silent voice still to sound; and it
   recognises the whole ROOM once per world when every voice rings. This harness
   loads the REAL world.html in headless Chromium, drives the REAL confluence through
   the SAME server-shaped events it listens to (and, for an agent bond, the SAME
   ventures endpoint it reads), and asserts:

     · WIRED — chorus.js <script>-loaded after confluence.js AND we.js, registers
       'chorus' in the one-open registry, commons renders the CHORUS entry beneath
       the we row, NO rail launcher, no network call of its own.
     · ZERO FABRICATION — no confluence / no bonds → no chord + entry no-op; each
       voice's count equals the number of real confluence bonds that share that seam;
       breadth equals the number of seams present in at least one real bond.
     · THE COLLECTIVE READING — a voice rings iff ≥1 real bond shares the seam; a
       voice sounded by a DIFFERENT peer than the first still lights the chord (the
       whole-room truth THE WE cannot show); counts are per-seam across everyone.
     · THE SILENT VOICE — a 4/5 chord names the exactly-one unsung voice (the first
       silent, in frame order) with the kind of peer the world has a door for; a
       whole chord names none ("every voice of the chord rings").
     · WHOLENESS RECOGNITION — the chord crossing to 5/5 toasts ONCE and stamps
       localStorage per WORLD (vint:chorus:<worldId>); a re-render and a world round-
       trip (cache drop + re-read) do NOT re-toast; _state().recognized reflects it.
     · CO-EQUALITY — no owner/owned/"your agent"/"belongs to" language in the rendered
       DOM OR the file source; the venturing voice (agents) sits on the same chord,
       same box, same font as the trading voice (people).
     · NO-COLLISION — at 320/375/768/1280/1920 across empty / partial / whole / many:
       sheet in viewport, no horizontal overflow, every voice/leaf/act inside the body
       box, no two voices intersect, no two acts intersect, 44px floor on every control.
     · ONE-OPEN + KILL SWITCH (?chorus=0).

   NEGATIVE CONTROL: `--control` injects a CSS override that removes the wrap contract
   (nowrap chord, max-content voices). The run MUST go red.

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
  '#dvChorusSheet .ch-chord,#dvChorusSheet .ch-breadth{flex-wrap:nowrap!important;}' +
  '#dvChorusSheet .ch-voice{flex:0 0 auto!important;max-width:none!important;min-width:max-content!important;white-space:nowrap!important;}' +
  '#dvChorusSheet .ch-vw{max-width:none!important;min-width:max-content!important;white-space:nowrap!important;}';

const results = [];
function ok(label) { results.push({ pass: true, label }); console.log('  PASS  ' + label); }
function bad(label, extra) { results.push({ pass: false, label }); console.log('  FAIL  ' + label + (extra ? '  → ' + extra : '')); }
function assert(cond, label, extra) { cond ? ok(label) : bad(label, extra); }
function intersects(a, b) {
  return !(a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5);
}

// a settled venture the REAL confluence will read to mint an AGENT bond
let ventures = [];

async function waitReady(page) {
  await page.waitForFunction(() => !!(window.VintChorus && window.VintWe && window.VintCommons && window.VintConfluence &&
    window.DirverseHUD && window.VintinuumWorld && document.getElementById('dvRail')), { timeout: 20000 });
}

// drive the REAL confluence to real bonds via its own server-shaped events:
//  · ATLAS-7 (person) — all four person seams: traded, taught, learned, raised
//  · KESTREL (person) — traded only (so the TRADE voice is shared by two peers:
//    the whole-room truth — a voice rings across DIFFERENT peers, not one pair)
async function seedPersons(page) {
  await page.evaluate(() => {
    const fire = (t, d) => window.dispatchEvent(new CustomEvent(t, { detail: d }));
    fire('vint:world-state', { worldId: 'universe', resident: { userId: 1 } });
    fire('vint:world-presence', { users: [
      { id: 'pSelf', self: true, name: 'MESELF' },
      { id: 'pA', name: 'ATLAS-7' }, { id: 'pK', name: 'KESTREL' } ] });
    // ATLAS-7 — all four person-door seams
    fire('vint:world-trade', { trade: { aUser: 1, bUser: 2 }, names: { 1: 'MESELF', 2: 'ATLAS-7' } });
    fire('vint:world-trade-settled', {});
    fire('vint:world-forge-taught', { student: 'ATLAS-7', name: 'a lamp of two hands' });
    fire('vint:world-forge-learned', { from: 'ATLAS-7', name: 'a seeking pick' });
    fire('vint:world-forge-completed', { yours: true, name: 'the great beacon', crew: [{ name: 'ATLAS-7' }, { name: 'MESELF' }] });
    // KESTREL — traded only: the TRADE voice is now shared by two different peers
    fire('vint:world-trade', { trade: { aUser: 1, bUser: 3 }, names: { 1: 'MESELF', 3: 'KESTREL' } });
    fire('vint:world-trade-settled', {});
  });
}

async function info(page) {
  return await page.evaluate(() => {
    const sheet = document.getElementById('dvChorusSheet');
    const body = sheet && sheet.querySelector('#chBody');
    const r = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height }; };
    const q = s => Array.from((body || document.createElement('div')).querySelectorAll(s)).filter(n => n.getClientRects().length);
    return {
      open: !!(sheet && sheet.classList.contains('open')),
      whole: !!(sheet && sheet.classList.contains('whole')),
      sheet: sheet ? r(sheet) : null,
      body: body ? r(body) : null,
      overflowX: body ? body.scrollWidth - body.clientWidth : 0,
      voices: q('.ch-voice').map(r),
      acts: q('.ch-act').map(r),
      leaves: q('.ch-sum, .ch-bn, .ch-bl, .ch-vw, .ch-vn, .ch-silent, .ch-whole, .ch-act, .ch-empty').map(r),
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
    assert(i.voices.every(inBody), `${tag} @${w}px every voice chip stays inside the body box`, i.voices.filter(x => !inBody(x)).length + ' outside');
    assert(i.acts.every(inBody), `${tag} @${w}px every action stays inside the body box`);
    assert(i.leaves.every(inBody), `${tag} @${w}px every text leaf stays inside the body box`, i.leaves.filter(x => !inBody(x)).length + ' outside');
    let vc = 0;
    for (let a = 0; a < i.voices.length; a++) for (let c = a + 1; c < i.voices.length; c++) if (intersects(i.voices[a], i.voices[c])) vc++;
    assert(vc === 0, `${tag} @${w}px no two voice chips intersect`, vc + ' pairs');
    let ac = 0;
    for (let a = 0; a < i.acts.length; a++) for (let c = a + 1; c < i.acts.length; c++) if (intersects(i.acts[a], i.acts[c])) ac++;
    assert(ac === 0, `${tag} @${w}px no two actions intersect`, ac + ' pairs');
    assert(i.acts.every(x => x.height >= 43.5), `${tag} @${w}px every interactive control meets the 44px floor`,
      i.acts.filter(x => x.height < 43.5).length + ' short');
  }
  await page.setViewport({ width: 1280, height: 800 });
}

(async () => {
  console.log('THE CHORUS — verify 9TYJB74' + (CONTROL ? '   [NEGATIVE CONTROL: wrap contract removed — MUST FAIL]' : ''));
  console.log('world: ' + WORLD + '\n');

  // ── STATIC ─────────────────────────────────────────────────────────────────
  const src = fs.readFileSync(path.join(ROOT, 'body/world/chorus.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'world.html'), 'utf8');
  const commons = fs.readFileSync(path.join(ROOT, 'body/world/commons.js'), 'utf8');

  assert(/<script[^>]+body\/world\/chorus\.js/.test(html), 'chorus.js is <script>-loaded in world.html');
  const iCh = html.indexOf('body/world/chorus.js'), iC = html.indexOf('body/world/confluence.js'), iWe = html.indexOf('body/world/we.js');
  assert(iCh > iC && iC !== -1, 'chorus.js loads AFTER confluence.js (its only source)');
  assert(iCh > iWe && iWe !== -1, 'chorus.js loads AFTER we.js (its entry sits beneath the we row)');
  assert(/registerSheet\(\s*'chorus'/.test(src), "registers 'chorus' with the one-open registry");
  assert(/VintChorus\.entryInto/.test(commons), 'commons.js renders the CHORUS entry');
  assert(commons.indexOf('VintChorus.entryInto') > commons.indexOf('VintWe.entryInto'), 'the CHORUS entry is added BENEATH the we entry');
  assert(!/addLauncher|dv-launch/.test(src), 'NO 16th rail: chorus.js adds no rail launcher');
  assert(!/fetch\(|XMLHttpRequest|new WebSocket|\.send\(/.test(src), 'chorus.js makes no network / socket call of its own');
  assert(/VintConfluence|confluence\(\)/.test(src) && /\.bonds\s*\(/.test(src), 'chorus.js reads VintConfluence.bonds() as its source');
  // CO-EQUALITY in the SOURCE — strip // comments first so a guard that names the
  // forbidden token never matches the prose explaining the ban (S7VCB6C).
  const srcCode = src.replace(/\/\/[^\n]*$/gm, '');
  assert(!/\bowner\b|\bowned\b|belongs to|your agent|my agent|owns them/i.test(srcCode), 'CO-EQUALITY (source): no owner/owned/your-agent language in chorus.js code');

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setRequestInterception(true);
    page.on('request', req => {
      const u = req.url();
      if (u.includes('/api/agents/mine')) return req.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ agents: [] }) });
      if (u.includes('/api/agent/ventures')) return req.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ventures }) });
      (u.startsWith('file://') || u.startsWith('about:') || u.startsWith('data:')) ? req.continue() : req.abort();
    });
    page.on('pageerror', () => {});
    await page.goto(WORLD, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitReady(page);
    ok('world.html loaded; VintChorus + VintWe + VintCommons + VintConfluence + DirverseHUD present');

    await page.evaluate((css, control) => {
      try { localStorage.clear(); } catch (_) {}
      window.__VINTINUUM_API_BASE = 'https://ventures.local';
      try { window.VintinuumWorld.myUserId = function () { return 1; }; } catch (_) {}
      window.__toasts = [];
      const base = window.DirverseHUD.toast;
      window.DirverseHUD.toast = function (m) { window.__toasts.push(String(m)); try { return base && base(m); } catch (_) {} };
      try { window.VintConfluence._reset(); } catch (_) {}
      if (control) { const s = document.createElement('style'); s.id = 'chControl'; s.textContent = css; document.head.appendChild(s); }
    }, CONTROL_CSS, CONTROL);
    const chToasts = () => page.evaluate(() => window.__toasts.filter(t => /the whole chorus rings/.test(t)).length);

    assert(await page.evaluate(() => window.VintChorus.enabled() === true), 'flag on by default');
    assert(await page.evaluate(() => !Array.from(document.querySelectorAll('#dvRail .dv-launch')).some(b => /chorus|all one/i.test(b.textContent || ''))),
      'NO 16th rail: no #dvRail launcher references THE CHORUS');

    // ── EMPTY — nothing witnessed, nothing fabricated ───────────────────────────
    await page.evaluate(() => window.VintChorus.open());
    let i = await info(page);
    assert(i.open, 'opens via the registry');
    assert(i.voices.length === 0, 'ZERO voice chips before any confluence bond (no fabrication)', 'got ' + i.voices.length);
    let st = await page.evaluate(() => window.VintChorus._state());
    assert(st.roster === 0 && st.breadth === 0 && st.whole === false, '_state() is empty with an empty confluence (roster 0, breadth 0, not whole)', JSON.stringify(st));
    assert(/No chorus yet/.test(i.text), 'honest empty-state invitation shown');
    await collisionSweep(page, 'empty');

    // entry is a true no-op when the confluence source is ABSENT
    const noop = await page.evaluate(() => {
      const saved = window.VintConfluence;
      window.VintConfluence = undefined;
      const pane = document.createElement('div');
      const row = window.VintChorus.entryInto(pane);
      window.VintConfluence = saved;
      return { row: row, children: pane.childNodes.length };
    });
    assert(noop.row === null && noop.children === 0, 'entry is a no-op when VintConfluence is absent (no row added)', JSON.stringify(noop));

    // ── SEED PERSON BONDS — breadth 4, the venturing voice still silent ─────────
    await seedPersons(page);
    // the seeding's world:trade frames auto-open the commons; (re)open THE CHORUS
    // over it — opening it closes the commons through the one-open registry.
    await page.evaluate(() => window.VintChorus.open());
    await new Promise(r => setTimeout(r, 120));
    i = await info(page);
    st = await page.evaluate(() => window.VintChorus._state());
    const bonds = await page.evaluate(() => window.VintConfluence.bonds());
    assert(st.roster === 2 && bonds.length === 2, 'roster === 2 real confluence bonds (ATLAS-7, KESTREL)', 'roster=' + st.roster + ' bonds=' + bonds.length);
    // ZERO FABRICATION — each voice count equals the real bonds sharing that seam
    const voiceTruth = await page.evaluate(() => {
      const bs = window.VintConfluence.bonds();
      const share = (b, k) => k === 'traded' ? (b.traded || 0) > 0 : k === 'ventured' ? (b.ventured || 0) > 0 : (b[k] || []).length > 0;
      const expect = {}; ['traded', 'taught', 'learned', 'raised', 'ventured'].forEach(k => { expect[k] = bs.filter(b => share(b, k)).length; });
      const got = window.VintChorus._state().voices;
      return { ok: ['traded', 'taught', 'learned', 'raised', 'ventured'].every(k => got[k] === expect[k]), expect, got };
    });
    assert(voiceTruth.ok, 'every voice count equals the confluence bonds that truly share that seam (no fabrication)', JSON.stringify(voiceTruth));
    assert(st.voices.traded === 2, 'THE WHOLE-ROOM TRUTH: the TRADE voice rings across TWO DIFFERENT peers (ATLAS-7 + KESTREL = 2) — not one pair', JSON.stringify(st.voices));
    assert(st.voices.taught === 1 && st.voices.learned === 1 && st.voices.raised === 1, 'teaching/learning/raising each ring with exactly one peer (ATLAS-7)', JSON.stringify(st.voices));
    assert(st.voices.ventured === 0, 'the venturing voice is silent — no agent bond yet', JSON.stringify(st.voices));
    assert(st.breadth === 4 && st.whole === false, 'breadth === 4 of 5, chord NOT whole', JSON.stringify({ breadth: st.breadth, whole: st.whole }));
    assert(st.silent === 'ventured', 'THE SILENT VOICE === venturing (the first/only unsung seam)', 'silent=' + st.silent);
    assert(/the silent voice/i.test(i.text) && /venturing voice has not yet sounded/.test(i.text) && /no agent has ventured beside you yet/.test(i.text),
      'names the VENTURING voice as the silent one, with the agent-door phrasing', i.text.slice(0, 600));
    assert(await chToasts() === 0, 'NO wholeness recognition toast while the chord is 4/5');
    // the collective headline reads "all of us", and the breadth readout "4/5"
    assert(/all of us/.test(i.text) && /4\/5/.test(i.text), 'the collective headline says "all of us" and the breadth readout shows 4/5', i.text.slice(0, 300));
    await collisionSweep(page, 'partial');

    // CO-EQUALITY — the venturing voice chip renders on the SAME chord structure
    const voiceStruct = await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('#dvChorusSheet .ch-voice'));
      // read the word leaf (.ch-vw) and count leaf (.ch-vn) SEPARATELY — in
      // textContent the word and count are adjacent ("◆ trade2"), which has no
      // word boundary for a \bword\b match; the leaf is the honest unit.
      const classOf = w => { const c = chips.find(n => { const vw = n.querySelector('.ch-vw'); return vw && vw.textContent.indexOf(w) !== -1; }); return c ? (c.querySelector('.ch-vw') && c.querySelector('.ch-vn') ? 'wn' : 'x') : null; };
      return { trade: classOf('trade'), venture: classOf('venturing'), count: chips.length };
    });
    assert(voiceStruct.count === 5, 'the chord always draws all five voices (parity of the frame)', JSON.stringify(voiceStruct));
    assert(voiceStruct.trade === 'wn' && voiceStruct.venture === 'wn', 'CO-EQUALITY: the venturing voice (agents) and the trade voice (people) render identically (word + count)', JSON.stringify(voiceStruct));
    assert(!/\bowner\b|\bowned\b|belongs to|your agent|my agent/i.test(i.text), 'CO-EQUALITY (DOM): no owner/owned/your-agent language anywhere in the rendered chorus');

    // ── THE WHOLE CHORD — an AGENT venture sounds the fifth voice ───────────────
    ventures = [{ id: 'v1', agentId: 'presence-warm', settledAt: Date.now(), status: 'done', outcome: 1, delta: 3 }];
    await page.evaluate(() => { try { window.VintConfluence.refresh(); } catch (_) {} });
    await page.waitForFunction(() => (window.VintConfluence.bonds() || []).some(b => b.kind === 'agent'), { timeout: 5000 });
    await page.evaluate(() => window.VintChorus.open());     // render → wholeness recognition
    await new Promise(r => setTimeout(r, 140));
    i = await info(page);
    st = await page.evaluate(() => window.VintChorus._state());
    assert(st.roster === 3, 'roster === 3 (ATLAS-7, KESTREL, and the agent peer)', 'roster=' + st.roster);
    assert(st.voices.ventured === 1, 'the venturing voice now rings (one agent peer)', JSON.stringify(st.voices));
    assert(st.breadth === 5 && st.whole === true, 'breadth === 5 of 5 — THE WHOLE CHORD', JSON.stringify({ breadth: st.breadth, whole: st.whole }));
    assert(st.silent === null, 'a whole chord has NO silent voice', 'silent=' + st.silent);
    assert(i.whole, 'the sheet carries the .whole class (every voice gold)');
    // the whole-chord BODY line reads "every voice of the chord rings"; the phrase
    // "the whole chorus rings" lives in the subtitle (#chSub) and the toast, not the
    // body — assert the body line and the absence of the silent-voice loop.
    const chSub = await page.evaluate(() => { const s = document.getElementById('chSub'); return s ? s.textContent : ''; });
    assert(/every voice of the chord rings/i.test(i.text) && !/the silent voice/i.test(i.text),
      'the whole-chord line replaces the silent-voice loop', i.text.slice(0, 500));
    assert(/the whole chorus rings/i.test(chSub), 'the subtitle reads "the whole chorus rings" when the chord is whole', chSub);
    const t1 = await chToasts();
    assert(t1 === 1, 'WHOLENESS RECOGNITION: crossing to 5/5 toasts EXACTLY once', 'toasts=' + t1);
    assert(st.recognized === 1, '_state().recognized === 1 (the whole room, once)', JSON.stringify({ recognized: st.recognized }));
    const stamp = await page.evaluate(() => { try { const o = JSON.parse(localStorage.getItem('vint:chorus:universe') || '{}'); return o && o.whole === 1; } catch (_) { return false; } });
    assert(stamp, 'the recognition is stamped in localStorage (vint:chorus:<worldId>, a single per-world stamp)');
    await collisionSweep(page, 'whole');

    // re-render does NOT re-toast
    await page.evaluate(() => { window.VintChorus.render(); window.VintChorus.refresh(); });
    await new Promise(r => setTimeout(r, 60));
    assert(await chToasts() === t1, 'a re-render of the already-recognised whole chord does NOT re-toast');

    // a world round-trip (cache drop + re-read from localStorage) does NOT re-toast
    await page.evaluate(() => {
      window.VintChorus.close();
      window.dispatchEvent(new CustomEvent('vint:world-state', { detail: { worldId: 'elsewhere', resident: { userId: 1 } } }));
      window.dispatchEvent(new CustomEvent('vint:world-state', { detail: { worldId: 'universe', resident: { userId: 1 } } }));
      window.VintChorus.open();
    });
    await new Promise(r => setTimeout(r, 140));
    assert(await chToasts() === t1, 'after a world round-trip, the persisted stamp is re-read and the whole chord does not re-announce');
    const reSt = await page.evaluate(() => window.VintChorus._state());
    assert(reSt.recognized === 1 && reSt.whole === true, 'the recognised whole chord survives the round-trip (recognized=1, whole)', JSON.stringify({ recognized: reSt.recognized, whole: reSt.whole }));
    await page.evaluate(() => window.VintChorus.close());

    // ── MANY — a large roster + high counts still fit, no collision ─────────────
    await page.evaluate(() => {
      const fire = (t, d) => window.dispatchEvent(new CustomEvent(t, { detail: d }));
      for (let k = 0; k < 24; k++) {
        const nm = 'A-PEER-WITH-A-VERY-LONG-NAME-THAT-NEVER-ENDS-AND-KEEPS-GOING-' + k;
        fire('vint:world-trade', { trade: { aUser: 1, bUser: 200 + k }, names: { 1: 'MESELF', ['' + (200 + k)]: nm } });
        fire('vint:world-trade-settled', {});
        if (k % 3 === 0) fire('vint:world-forge-taught', { student: nm, name: 'a recipe number ' + k });
      }
    });
    await page.evaluate(() => window.VintChorus.open());
    await new Promise(r => setTimeout(r, 120));
    st = await page.evaluate(() => window.VintChorus._state());
    assert(st.voices.traded >= 26, 'many: the trade voice count climbs with the roster (≥26)', 'traded=' + st.voices.traded);
    assert(st.roster >= 27, 'many: roster climbs to ≥27 real bonds', 'roster=' + st.roster);
    await collisionSweep(page, 'many');

    // ── COMMONS ENTRY — beneath the we row, no collision ────────────────────────
    await page.evaluate(() => window.VintCommons.open());
    await page.waitForFunction(() => { const s = document.getElementById('dvCommonsSheet'); return s && s.classList.contains('open'); }, { timeout: 5000 });
    const entry = await page.evaluate(() => {
      const row = document.querySelector('#dvCommonsSheet .chorus-entry');
      if (!row) return { present: false };
      const r = el => { const b = el.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, height: b.height }; };
      const R = r(row);
      const body = document.querySelector('#dvCommonsSheet .dv-body');
      const we = document.querySelector('#dvCommonsSheet .we-entry');
      const sibs = Array.from(document.querySelectorAll('#dvCommonsSheet .we-entry, #dvCommonsSheet .jn-entry, #dvCommonsSheet .sp-entry, #dvCommonsSheet .wv-entry, #dvCommonsSheet .cv-entry, #dvCommonsSheet .cf-entry, #dvCommonsSheet .cm-row'))
        .filter(n => n.getClientRects().length).map(r);
      const hits = sibs.filter(b => !(R.right <= b.left + 0.5 || b.right <= R.left + 0.5 || R.bottom <= b.top + 0.5 || b.bottom <= R.top + 0.5)).length;
      return { present: true, rect: R, body: body ? r(body) : null, hits, sibs: sibs.length, belowWe: we ? (R.top >= r(we).top - 0.5) : null, label: row.textContent };
    });
    assert(entry.present, 'the CHORUS entry appears inside the commons body');
    if (entry.present) {
      assert(entry.rect.height >= 44, 'entry meets the 44px floor', 'h=' + entry.rect.height);
      assert(!entry.body || (entry.rect.left >= entry.body.left - 1 && entry.rect.right <= entry.body.right + 1), 'entry stays inside the commons body');
      assert(entry.hits === 0, 'entry overlaps none of its ' + entry.sibs + ' siblings', 'hits=' + entry.hits);
      assert(entry.belowWe === true, 'the CHORUS entry sits BENEATH the we entry', 'belowWe=' + entry.belowWe);
      assert(/the chorus/.test(entry.label) && /whole/.test(entry.label), 'the entry reads "the chorus" and shows the whole state', JSON.stringify(entry.label));
    }

    // ── ONE-OPEN ────────────────────────────────────────────────────────────────
    await page.evaluate(() => window.VintChorus.open());
    await new Promise(r => setTimeout(r, 100));
    const ev1 = await page.evaluate(() => ({ ch: window.VintChorus.isOpen(), c: window.VintCommons.isOpen() }));
    assert(ev1.ch && !ev1.c, 'one-open: opening THE CHORUS closed the commons', JSON.stringify(ev1));
    await page.evaluate(() => window.VintWe.open());
    await new Promise(r => setTimeout(r, 100));
    const ev2 = await page.evaluate(() => ({ ch: window.VintChorus.isOpen(), we: window.VintWe.isOpen() }));
    assert(!ev2.ch && ev2.we, 'one-open: opening THE WE closed THE CHORUS', JSON.stringify(ev2));
    await page.evaluate(() => window.VintWe.close());

    // ── KILL SWITCH ───────────────────────────────────────────────────────────
    await page.goto(WORLD + '?chorus=0', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitReady(page);
    const killed = await page.evaluate(() => {
      const en = window.VintChorus.enabled();
      window.VintChorus.open();
      const s = document.getElementById('dvChorusSheet');
      window.VintCommons.open();
      const entry = !!document.querySelector('#dvCommonsSheet .chorus-entry');
      return { en, open: !!(s && s.classList.contains('open')), entry };
    });
    assert(killed.en === false && !killed.open && !killed.entry, 'kill switch: ?chorus=0 → disabled, raises nothing, no commons entry', JSON.stringify(killed));
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
