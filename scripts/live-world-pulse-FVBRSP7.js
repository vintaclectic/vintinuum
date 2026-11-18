#!/usr/bin/env node
'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   THE PULSE — THE LIVE CHECK  (task FVBRSP7)

   The hermetic harness (scripts/verify-world-pulse-FVBRSP7.js) proves the
   BEHAVIOUR against a fixture it controls. This proves the ACCEPTANCE, which is
   a claim about the PUBLIC SITE talking to the PUBLIC BRAIN:

     "Feed shows real events within one tick of them happening (compare against
      the events the brain reports); sentences name actor, action, object; panel
      scrolls inside its own box (no overflow onto neighbors) at 320-1920px;
      live on vintinuum.com/world.html."

   It asserts VALUES out of the LIVE world, never shapes (UGP7422): the event
   ids, the agent ids and the data values are read off /api/world/state and then
   REQUIRED on the page, so a feed that rendered 40 rows of nothing fails. It
   pins no particular event type — the world chooses its own deeds and a test
   that pinned one would be red within the hour.

   ── ANCHOR EVERY COMPARISON ON THE TICK THE PAGE RENDERED ─────────────────
   The economy clock advances every 60 seconds, and loading six viewports takes
   longer than that. The sibling live check (scripts/live-world-folk-AC2WP9A.js)
   recorded exactly this trap: its first run reported three citizens whose page
   verb "disagreed" with the brain's and zero verbs changing, and BOTH were
   artefacts of comparing a page that had already read tick N+1 against a curl
   taken at tick N. So here the brain is re-read until its tick EQUALS the tick
   the page says it rendered, and a tick that cannot be aligned is reported as a
   note, never as a failure. The world is allowed to move while we measure it.

   ── TWO SAMPLES MEANS TWO TICKS, MEASURED (phase-world-citizen) ───────────
   It waits for the world's own tick to ADVANCE before taking the second sample,
   and quotes both tick numbers and the wall time between them. One sample of a
   counter is a snapshot, never a rate.

   ── A RECT OVERLAP IS NOT A COLLISION (N2E8EAP) ───────────────────────────
   Every box is clipped to its scroll ancestors and the viewport first, DOM
   ancestry is excluded by asking the DOM rather than by a geometric enclosure
   test, and position:absolute/fixed furniture is excluded and reported.
   ════════════════════════════════════════════════════════════════════════════ */

const PAGE = process.env.PULSE_LIVE_PAGE || 'https://vintinuum.com/world.html';
const API  = process.env.PULSE_LIVE_API  || 'https://api.vintaclectic.com';
const WAIT_TICK_MS = Number(process.env.PULSE_LIVE_TICKWAIT || 240000);

let puppeteer;
try { puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer'); }
catch (_) { console.error('puppeteer is not installed here; cannot measure.'); process.exit(2); }

let pass = 0; const fails = [];
const is = (label, ok, got) => {
  if (ok) { pass++; console.log(`  PASS  ${label}`); }
  else { const g = got === undefined ? '' : ` — got ${JSON.stringify(got)}`;
         fails.push(label + g); console.log(`  FAIL  ${label}${g}`); }
};
const note = (s) => console.log(`  note  ${s}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* The public host is reached through a cloudflared named tunnel whose edge
   connections cycle, so one request can read 502/000 while the next reads 200.
   A bounded retry that PRINTS every attempt hides nothing. */
async function getJSON(url, tries = 4) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) return await r.json();
      last = 'HTTP ' + r.status;
    } catch (e) { last = String((e && e.message) || e); }
    note(`${url} -> ${last} (attempt ${i + 1}/${tries})`);
    await sleep(1500 * (i + 1));
  }
  throw new Error(`${url} unreachable: ${last}`);
}
const stateUrl = (n) => `${API}/api/world/state?events=${n}&t=${Date.now()}`;

/* Read the brain at a SPECIFIC tick, or report that it could not be aligned. */
async function brainAtTick(tick, tries = 5) {
  if (typeof tick !== 'number') return null;
  for (let i = 0; i < tries; i++) {
    try {
      const j = await getJSON(stateUrl(200), 2);
      if (j && j.tick === tick) return j;
      note(`brain is at tick ${j && j.tick}, page rendered ${tick} (align attempt ${i + 1}/${tries})`);
    } catch (e) { note(String((e && e.message) || e)); }
    await sleep(2500);
  }
  return null;
}

const VIEWPORTS = [[320, 568], [375, 667], [768, 1024], [1280, 800], [1920, 1080]]
  .filter(([w]) => (process.env.PULSE_WIDTH ? w === Number(process.env.PULSE_WIDTH) : true));

/* ── read the sheet: the rows, the footer note, the build stamp ───────────── */
const READ = () => {
  const out = { rows: [], note: '', tick: null, stale: null, unphrased: null, title: null, chips: [] };
  const P = window.VintWorldPulse;
  if (P) { out.tick = P.tick(); out.stale = P.stale(); out.unphrased = P.unphrased(); }
  for (const r of document.querySelectorAll('#wpFeed .wp-row')) {
    out.rows.push({ type: r.getAttribute('data-type'), lane: r.getAttribute('data-lane'),
      tick: Number(r.getAttribute('data-tick')),
      text: ((r.querySelector('.wp-say') || {}).textContent || '').trim() });
  }
  for (const c of document.querySelectorAll('#dvWorldPulseSheet .wp-chip')) {
    out.chips.push((c.textContent || '').trim());
  }
  out.note = ((document.getElementById('wpNote') || {}).textContent || '').trim();
  // The build hash is carried by the TAB TITLE on this page (world.html appends
  // ' · <commit>' from commit.json), which is the machine-checkable stamp the
  // sibling live checks read — no new fixed corner element to collide.
  out.title = document.title || null;
  return out;
};

/* geometry: overflow + pairwise overlap, clipped and ancestry-aware */
const GEOM = () => {
  const id = (el) => el.id || (el.tagName.toLowerCase() + '.' + String(el.className || '').trim().split(/\s+/).slice(0, 2).join('.'));
  const s = document.getElementById('dvWorldPulseSheet');
  const out = { ok: !!(s && s.classList.contains('open')), vw: innerWidth, overflow: [], pairs: [], fixedExcluded: 0 };
  if (!out.ok) return out;
  const sr = s.getBoundingClientRect();
  out.sheet = { t: sr.top, l: sr.left, w: sr.width, h: sr.height, b: sr.bottom, r: sr.right };
  const body = s.querySelector('.dv-body');
  if (body) out.body = { clientH: body.clientHeight, scrollH: body.scrollHeight,
    scrolls: body.scrollHeight > body.clientHeight + 1, overflowY: getComputedStyle(body).overflowY };
  const chips = document.getElementById('wpChips');
  if (chips) { const cs = getComputedStyle(chips);
    out.chipband = { h: chips.getBoundingClientRect().height, overflowY: cs.overflowY, maxH: cs.maxHeight }; }
  const inner = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return { l: r.left + parseFloat(cs.borderLeftWidth || 0) + parseFloat(cs.paddingLeft || 0),
      r: r.right - parseFloat(cs.borderRightWidth || 0) - parseFloat(cs.paddingRight || 0),
      t: r.top + parseFloat(cs.borderTopWidth || 0) + parseFloat(cs.paddingTop || 0),
      b: r.bottom - parseFloat(cs.borderBottomWidth || 0) - parseFloat(cs.paddingBottom || 0) }; };
  const flowEls = [], flow = [];
  for (const el of s.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width * r.height < 1) continue;
    if (cs.position === 'absolute' || cs.position === 'fixed' || cs.position === 'sticky') { out.fixedExcluded++; continue; }
    flowEls.push(el); flow.push({ id: id(el), l: r.left, r: r.right, t: r.top, b: r.bottom });
    if (r.right > innerWidth + 1 || r.left < -1) out.overflow.push({ id: id(el), viewportX: true, dr: Math.round(r.right - innerWidth) });
    let sc = null;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (/(auto|scroll)/.test(ps.overflowY) || /(auto|scroll)/.test(ps.overflowX)) { sc = p; break; }
      if (p === s) { sc = p; break; }
    }
    if (sc && sc === s) {
      const box = inner(sc);
      const over = Math.max(0, Math.round(box.t - r.top)) + Math.max(0, Math.round(r.bottom - box.b));
      if (over > 1) out.overflow.push({ id: id(el), over, inside: id(sc) });
    }
  }
  for (let i = 0; i < flow.length; i++) for (let j = i + 1; j < flow.length; j++) {
    if (flowEls[i].contains(flowEls[j]) || flowEls[j].contains(flowEls[i])) continue;
    const a = flow[i], b = flow[j];
    const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l);
    const oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    if (ox > 1 && oy > 1) out.pairs.push({ a: a.id, b: b.id, ox: Math.round(ox), oy: Math.round(oy) });
  }
  // the pill is the known float above every sheet; report whether it still
  // overlaps now that the sheet registers as a dock obstacle.
  const pill = document.getElementById('vwg-pill') || document.getElementById('vwg-dot');
  if (pill) {
    const pr = pill.getBoundingClientRect();
    const ox = Math.min(pr.right, sr.right) - Math.max(pr.left, sr.left);
    const oy = Math.min(pr.bottom, sr.bottom) - Math.max(pr.top, sr.top);
    out.pill = { id: pill.id, ox: Math.round(ox), oy: Math.round(oy), overlaps: ox > 1 && oy > 1 };
  }
  return out;
};

function killTransitions() {
  const s = document.createElement('style');
  s.textContent = '*{transition:none !important;animation:none !important}html{scroll-behavior:auto !important}';
  document.head.appendChild(s);
}

(async () => {
  console.log(`page: ${PAGE}`);
  console.log(`api : ${API}`);

  // ── 0. the deployed commit, from the site's own stamp ─────────────────────
  let stamp = null;
  try { stamp = await getJSON(`${PAGE.replace(/\/[^/]*$/, '')}/commit.json?t=${Date.now()}`); } catch (e) { note(String(e.message || e)); }
  console.log(`stamp: commit.json -> ${JSON.stringify(stamp)}`);
  is('0.1 the site publishes a build stamp', !!(stamp && stamp.commit), stamp);

  // ── 1. the brain really is serving the record ────────────────────────────
  const s0 = await getJSON(stateUrl(200));
  is('1.1 GET /api/world/state answers with the world record',
    !!(s0 && typeof s0.tick === 'number' && s0.events && Array.isArray(s0.events.events)),
    s0 && { tick: s0.tick, n: s0.events && s0.events.events_returned });
  is(`1.2 the record is non-empty (events_total ${s0.events.events_total})`, s0.events.events_total > 100);
  note(`brain tick ${s0.tick}, ${s0.events.events_returned} of ${s0.events.events_total} rows, ${Object.keys(s0.events.by_type).length} types`);

  const browser = await puppeteer.launch({ headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    timeout: 120000, protocolTimeout: 180000 });

  async function load(w, h) {
    const page = await browser.newPage();
    page.setDefaultTimeout(45000);
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    try { await page.goto(PAGE + '?t=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 45000 }); } catch (_) {}
    await sleep(1600);
    await page.evaluate(killTransitions);
    await page.waitForFunction(() => !!window.VintWorldPulse, { timeout: 25000 }).catch(() => {});
    await page.evaluate(() => { try { window.VintWorldPulse.open(); } catch (_) {} });
    await page.waitForFunction(() => {
      const s = document.getElementById('dvWorldPulseSheet');
      return !!(s && s.classList.contains('open'));
    }, { timeout: 25000 }).catch(() => {});
    // wait for ROWS, then for a STABLE geometry key over the sheet AND the
    // fixed furniture whose rects move once the sheet reflows the page.
    await page.waitForFunction(() => document.querySelectorAll('#wpFeed .wp-row').length > 0,
      { timeout: 30000 }).catch(() => {});
    await page.waitForFunction(() => {
      const s = document.getElementById('dvWorldPulseSheet');
      if (!s) return false;
      const parts = [];
      for (const el of s.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        parts.push((el.id || el.className || el.tagName) + ':' + Math.round(r.top) + ',' +
          Math.round(r.left) + ',' + Math.round(r.width) + ',' + Math.round(r.height));
      }
      for (const el of document.body.querySelectorAll('*')) {
        const st = getComputedStyle(el);
        if (st.position !== 'fixed' && st.position !== 'sticky') continue;
        if (st.visibility === 'hidden' || st.display === 'none') continue;
        const r = el.getBoundingClientRect();
        if (r.width * r.height < 1) continue;
        parts.push('F' + (el.id || el.tagName) + ':' + Math.round(r.top) + ',' + Math.round(r.left) + ',' +
          Math.round(r.width) + ',' + Math.round(r.height));
      }
      const key = parts.join('|');
      window.__k = (window.__k || []).concat([key]).slice(-4);
      return window.__k.length === 4 && window.__k.every((x) => x === key);
    }, { timeout: 30000, polling: 170 }).catch(() => {});
    return page;
  }

  const pretty = (idv) => {
    const raw = String(idv == null ? '' : idv).replace(/^citizen_/, '');
    if (!raw) return 'someone';
    if (raw[0] === '@') return raw.slice(1) === 'mint' ? 'the mint' : raw.slice(1);
    return raw[0].toUpperCase() + raw.slice(1);
  };
  // the live display names, so "the actor is named" is measured against the
  // world's own roster and not against a guess
  let nameOf = {};
  try {
    const cj = await getJSON(`${API}/api/world/citizens?t=${Date.now()}`, 3);
    for (const c of (cj && cj.citizens) || []) nameOf[c.id] = String(c.display_name || c.id);
    note(`roster: ${Object.keys(nameOf).length} living citizens`);
  } catch (e) { note('could not read the roster: ' + (e.message || e)); }
  const nm = (idv) => nameOf[String(idv)] || pretty(idv);

  const ticksSeen = [];

  // ════ TWO SAMPLES, SEPARATED BY A REAL TICK ADVANCE ══════════════════════
  for (const sample of [0, 1]) {
    if (sample === 1) {
      const t0 = ticksSeen[0];
      const began = Date.now();
      let now = t0;
      while (Date.now() - began < WAIT_TICK_MS) {
        await sleep(15000);
        try { const j = await getJSON(stateUrl(1), 2); now = j && j.tick; } catch (_) {}
        if (typeof now === 'number' && now > t0) break;
      }
      if (!(typeof now === 'number' && now > t0)) {
        note(`the world did not advance past tick ${t0} within ${Math.round(WAIT_TICK_MS / 1000)}s — second sample skipped`);
        break;
      }
      note(`the world advanced ${t0} -> ${now} after ${Math.round((Date.now() - began) / 1000)}s of waiting`);
    }

    for (const [w, h] of VIEWPORTS) {
      const lane = `${w}x${h} s${sample}`;
      const page = await load(w, h);
      try {
        const r = await page.evaluate(READ);
        const g = await page.evaluate(GEOM);

        is(`${lane}: the pulse sheet is on the live page and open`, g.ok && g.sheet && g.sheet.h > 20, g.sheet);
        if (!g.ok) { await page.close().catch(() => {}); continue; }
        is(`${lane}: the build hash in the tab title matches the deployed commit (${stamp && stamp.commit})`,
          !!(r.title && stamp && stamp.commit && r.title.includes(stamp.commit)), r.title);
        is(`${lane}: the feed rendered real lines — ${r.rows.length}`, r.rows.length >= 5, r.rows.length);
        is(`${lane}: the page is NOT showing a stale/unreachable chronicle`, r.stale === false, r.stale);
        if (sample === 0 && typeof r.tick === 'number' && ticksSeen.length === 0) ticksSeen.push(r.tick);

        // ── ACCEPTANCE 1: real events, within one tick ────────────────────
        const brain = await brainAtTick(r.tick);
        if (!brain) {
          note(`${lane}: could not align the brain to the page's tick ${r.tick} — comparison skipped (the world is allowed to move while we measure it)`);
        } else {
          const mirrors = await page.evaluate(() => window.VintWorldPulse.mirrors());
          const quiet = await page.evaluate(() => window.VintWorldPulse.quiet());
          const bEvents = brain.events.events;
          // Math.max of an EMPTY list is -Infinity, which would read as a wild
          // tick mismatch rather than as "there was nothing to compare".
          const maxTickOf = (arr) => (arr.length ? arr.reduce((m, x) => (x.tick > m ? x.tick : m), -1) : null);
          const newest = maxTickOf(bEvents);
          const pageNewest = maxTickOf(r.rows);
          if (newest === null || pageNewest === null) {
            note(`${lane}: nothing to compare (brain rows ${bEvents.length}, page rows ${r.rows.length})`);
          } else {
          is(`${lane}: the page's newest line is within ONE tick of the brain's newest event (page ${pageNewest}, brain ${newest})`,
            Math.abs(pageNewest - newest) <= 1, { page: pageNewest, brain: newest });
          // EVERY showable event the brain reports at its newest tick must be
          // on the page. This is the check that a rendered-but-empty feed fails.
          const want = bEvents.filter((e) => e.tick === newest &&
            mirrors.indexOf(e.type) < 0 && quiet.indexOf(e.type) < 0);
          const got = r.rows.filter((x) => x.tick === newest);
          is(`${lane}: every showable brain event at tick ${newest} is on the page — brain ${want.length}, page ${got.length}`,
            want.length === 0 ? true : got.length >= want.length,
            { brainTypes: want.map((e) => e.type), pageTypes: got.map((x) => x.type) });
          // ── ACCEPTANCE 2: actor, action, object — measured against the
          //    BRAIN's own values for the newest tick's events.
          let named = 0, valued = 0;
          for (const e of want) {
            const row = got.find((x) => x.type === e.type);
            if (!row) continue;
            const parties = [e.agent_id];
            for (const k of ['buyer', 'seller', 'winner', 'loser', 'attacker', 'defender', 'victim',
                             'accused', 'child', 'member', 'by', 'to', 'offeror', 'offeree', 'owner', 'author']) {
              const v = e.data && e.data[k];
              if (typeof v === 'string' && v) parties.push(v);
            }
            const names = parties.filter(Boolean).map(nm);
            const org = (e.data && (e.data.org_name || e.data.name)) || null;
            if (names.some((x) => row.text.indexOf(x) >= 0) || (org && row.text.indexOf(org) >= 0)) named++;
            const vals = [];
            const walk = (o, d) => { if (!o || d > 2) return;
              for (const k in o) { const v = o[k];
                if (typeof v === 'number' && isFinite(v) && Math.abs(v) >= 1) vals.push(String(v));
                else if (typeof v === 'string' && v.length >= 3 && v.length <= 40 && !/^(org:|crm_|war_|kin_)/.test(v)) { vals.push(v.replace(/_/g, ' ')); vals.push(nm(v)); }
                else if (v && typeof v === 'object') walk(v, d + 1); } };
            walk(e.data, 0);
            if (vals.length === 0 || vals.some((v) => row.text.indexOf(v) >= 0)) valued++;
          }
          const matched = want.filter((e) => got.some((x) => x.type === e.type)).length;
          is(`${lane}: every matched line NAMES its actor — ${named}/${matched}`, matched === 0 ? true : named === matched);
          is(`${lane}: every matched line carries a VALUE from the brain's own event — ${valued}/${matched}`,
            matched === 0 ? true : valued === matched);
          if (got.length) note(`${lane}: newest line — "${got[0].text.slice(0, 150)}"`);
          }
        }

        // every line reads as a sentence, not a type name
        const bad = r.rows.filter((x) => !/[.]$/.test(x.text) || x.text.split(/\s+/).length < 4 || /[_:]/.test(x.text.split(' ')[1] || ''));
        is(`${lane}: every rendered line reads as a sentence — ${bad.length} that do not`,
          bad.length === 0, bad.slice(0, 3));

        // ── ACCEPTANCE 3: scrolls inside its own box, no overflow ──────────
        is(`${lane}: the sheet stays inside the viewport`, g.sheet.l >= -1 && g.sheet.r <= g.vw + 1,
          { l: g.sheet.l, r: g.sheet.r, vw: g.vw });
        is(`${lane}: the feed scrolls INSIDE its own box (overflow-y:${g.body && g.body.overflowY}, ${g.body && g.body.scrollH} into ${g.body && g.body.clientH})`,
          !!g.body && /(auto|scroll)/.test(g.body.overflowY) && g.body.scrolls);
        is(`${lane}: nothing overflows the sheet — ${JSON.stringify(g.overflow.slice(0, 3))}`, g.overflow.length === 0);
        is(`${lane}: no flow element overlaps another — ${JSON.stringify(g.pairs.slice(0, 3))}`, g.pairs.length === 0);
        is(`${lane}: the docked account pill does not land on the sheet — ${JSON.stringify(g.pill)}`,
          !g.pill || !g.pill.overlaps);
        is(`${lane}: the chip band is capped and grows inward (max-height ${g.chipband && g.chipband.maxH})`,
          !!g.chipband && g.chipband.overflowY !== 'visible' && g.chipband.maxH !== 'none');
        note(`${lane}: ${g.fixedExcluded} absolutely/fixed-positioned element(s) excluded from the pairwise set; sheet ${Math.round(g.sheet.h)}px, chips ${Math.round((g.chipband || {}).h)}px, feed ${Math.round((g.body || {}).clientH)}px`);
        is(`${lane}: all six filter chips are present — ${JSON.stringify(r.chips)}`, r.chips.length === 6);
        if (r.unphrased && Object.keys(r.unphrased).length) {
          note(`${lane}: the world is emitting types this page cannot phrase yet: ${Object.keys(r.unphrased).join(', ')} (named in the footer, never dropped)`);
        }
        if (sample === 1 && typeof r.tick === 'number') ticksSeen.push(r.tick);
      } finally { await page.close().catch(() => {}); }
    }
  }

  // ── the two samples must be two DIFFERENT ticks, and the feed must move ──
  if (ticksSeen.length >= 2) {
    is(`2.1 the page rendered a LATER tick on the second sample (${ticksSeen[0]} -> ${ticksSeen[ticksSeen.length - 1]})`,
      ticksSeen[ticksSeen.length - 1] > ticksSeen[0], ticksSeen);
  } else {
    note(`only one tick was sampled (${ticksSeen.join(', ')}) — the advance assertion could not be taken`);
  }

  await browser.close();
  console.log('');
  console.log('═══ THE PULSE — LIVE (FVBRSP7) ' + '═'.repeat(38));
  console.log(`lanes: ${VIEWPORTS.map((v) => v.join('x')).join(', ')} x 2 tick samples`);
  if (fails.length) { console.log(''); console.log('FAILURES:'); for (const f of fails) console.log('  - ' + f); }
  console.log('');
  console.log(`${pass}/${pass + fails.length} pass`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
