#!/usr/bin/env node
'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   THE FOLK ON THE MAP — THE LIVE CHECK  (task AC2WP9A)

   The hermetic harness (scripts/verify-world-folk-AC2WP9A.js) proves the
   BEHAVIOUR against a fixture it controls. This proves the ACCEPTANCE, which is
   a claim about the public site talking to the public brain:

     "Open vintinuum.com/world.html skeleton panel: every active citizen visible
      at its position with name + a current-action line that CHANGES across two
      world ticks (two samples); parcels still render; no element overlap at
      320/768/1920; live site footer hash matches the deployed commit."

   It asserts VALUES out of the LIVE world, never shapes (UGP7422): the citizen
   ids and verbs are read off /api/world/citizens and then REQUIRED on the page,
   so a roster that rendered 33 rows of nothing fails. It pins no particular
   verb — the world chooses its own actions and a test that pinned one would be
   red every minute.

   TWO SAMPLES MEANS TWO TICKS, MEASURED (phase-world-citizen): it waits for the
   world's own newest tick to ADVANCE before taking the second sample, and
   quotes both tick numbers and the wall time between them. One sample of a
   counter is a snapshot, never a rate.

   A rect overlap is not a collision (N2E8EAP): every box is clipped to its
   scroll ancestors and the viewport first, DOM ancestry is excluded by asking
   the DOM rather than by a geometric enclosure test, and position:absolute /
   fixed furniture is excluded and reported.
   ════════════════════════════════════════════════════════════════════════════ */

const PAGE = process.env.FOLK_LIVE_PAGE || 'https://vintinuum.com/world.html';
const API  = process.env.FOLK_LIVE_API  || 'https://api.vintaclectic.com';
const WAIT_TICK_MS = Number(process.env.FOLK_LIVE_TICKWAIT || 240000);

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

/* ── THE EDGE, NOT THE WORLD ──────────────────────────────────────────────
   The public host is reached through a cloudflared named tunnel whose edge
   connections cycle, so one request can read 502/000 while the next reads 200
   (documented in scripts/live-world-story-9SABEEP.js from the tunnel's own
   error log). A bounded retry that PRINTS every attempt hides nothing. */
async function getJSON(url, tries = 4) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) return await r.json();
      last = 'HTTP ' + r.status;
    } catch (e) { last = String(e && e.message || e); }
    note(`${url} -> ${last} (attempt ${i + 1}/${tries})`);
    await sleep(1500 * (i + 1));
  }
  throw new Error(`${url} unreachable: ${last}`);
}

// the newest tick ANY citizen acted on — the world's own "now"
const maxTick = (cs) => cs.reduce((m, c) =>
  (typeof c.last_acted_tick === 'number' && c.last_acted_tick > m) ? c.last_acted_tick : m, -1);

/* ── COMPARE THE PAGE AND THE BRAIN AT THE *SAME* TICK ────────────────────
   MEASURED 2026-11-18: this check first reported 3 citizens whose page verb
   disagreed with the brain's (wren "rest" vs "build", sol "rest" vs "explore",
   helios-sec10 "rest" vs "forage") and ZERO verbs changing across two ticks.
   Both were artefacts of THIS harness. The world advances every 60s, and
   three page loads at three viewports take longer than that, so sample A's
   brain curl (tick 17103) was being compared against pages that had already
   read 17104. The arithmetic gave it away: sample B PASSED, and page A's verbs
   equalled page B's which equalled brain B's — i.e. the page was AHEAD of the
   curl, not wrong. Confirmed directly with a tight probe: read the page and
   the brain seconds apart and the ticks agree (17105 == 17105) with ZERO
   mismatched verbs.
   So every comparison is now anchored on the tick the PAGE rendered. A tick
   that cannot be aligned is reported as a note, never as a verb failure —
   the world is allowed to move while we measure it. */
async function brainAtTick(tick, tries = 4) {
  if (typeof tick !== 'number') return null;
  for (let i = 0; i < tries; i++) {
    try {
      const j = await getJSON(`${API}/api/world/citizens`, 2);
      const cs = (j && j.citizens) || [];
      if (maxTick(cs) === tick) return cs;
      note(`brain is at tick ${maxTick(cs)}, page rendered ${tick} (align attempt ${i + 1}/${tries})`);
    } catch (e) { note(String(e.message || e)); }
    await sleep(2000);
  }
  return null;
}

/* ── read the sheet: the roster, the markers, the terrain, the footer ───── */
const READ = () => {
  const out = { rows: [], markers: [], geom: null, terrainColors: 0, citInk: 0, footer: null };
  const band = document.getElementById('wsFolk');
  if (band) for (const b of band.querySelectorAll('.ws-f')) {
    const nm = b.querySelector('.ws-fname'), ac = b.querySelector('.ws-fact');
    out.rows.push({ id: b.getAttribute('data-cit'),
      name: nm ? nm.textContent.trim() : null,
      action: ac ? ac.textContent.trim() : null });
  }
  try { out.markers = window.VintWorldSkeleton.markers() || []; } catch (_) {}
  try { out.geom = window.VintWorldSkeleton.geom(); } catch (_) {}
  // THE TICK THE PAGE IS SHOWING. Without this, a page snapshot gets compared
  // against a brain snapshot from a DIFFERENT moment — see brainAtTick below.
  try { out.renderedTick = window.VintWorldFolk.currentTick(window.VintWorldFolk.get()); }
  catch (_) { out.renderedTick = null; }
  // the terrain must still be there: distinct opaque colours on #wsMap
  try {
    const cv = document.getElementById('wsMap');
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 8) seen.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]);
    out.terrainColors = seen.size;
  } catch (_) {}
  // and the people must have put ink on their own overlay
  try {
    const cv = document.getElementById('wsCits');
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 24) n++;
    out.citInk = n;
  } catch (_) {}
  // ── WHERE THE BUILD HASH ACTUALLY LIVES ────────────────────────────────
  // NOT in a DOM element. world.html states the reason in its own source: at
  // the time the build-footer requirement landed, every fixed corner already
  // held a control and the No-Collision Law forbade adding a permanent one
  // without a full breakpoint audit. So the hash is carried by the TAB TITLE
  // (visible in a phone's tab switcher and share sheet) and the console, with
  // commit.json as the machine-checkable source of truth:
  //     document.title += ' \u00b7 ' + d.commit;
  // Scraping the body for a hex string would be asserting a promise this page
  // never made (NFQ2EU6) — and would pass or fail for the wrong reason.
  out.footer = document.title || null;
  return out;
};

/* ── collisions: clip to scroll ancestors, exclude DOM ancestry ─────────── */
const PAIRS = () => {
  const sheet = document.getElementById('dvWorldSkeletonSheet');
  if (!sheet) return { err: 'no sheet' };
  const vw = innerWidth, vh = innerHeight;
  const id = (el) => el.id || (el.tagName.toLowerCase() + '.' +
    String(el.className || '').trim().split(/\s+/)[0]);
  const clip = (el) => {
    const r = el.getBoundingClientRect();
    let l = r.left, t = r.top, rr = r.right, bb = r.bottom;
    for (let n = el.parentElement; n; n = n.parentElement) {
      const ps = getComputedStyle(n);
      if (!/(auto|scroll|hidden)/.test(ps.overflowY) &&
          !/(auto|scroll|hidden)/.test(ps.overflowX)) continue;
      const nr = n.getBoundingClientRect();
      l = Math.max(l, nr.left); t = Math.max(t, nr.top);
      rr = Math.min(rr, nr.right); bb = Math.min(bb, nr.bottom);
    }
    return { l: Math.max(l, 0), t: Math.max(t, 0), r: Math.min(rr, vw), b: Math.min(bb, vh) };
  };
  const flow = [], els = [];
  let absSkipped = 0;
  for (const el of sheet.querySelectorAll('*')) {
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') continue;
    const r0 = el.getBoundingClientRect();
    if (r0.width * r0.height < 1) continue;            // area, not the attr
    if (st.position === 'absolute' || st.position === 'fixed') { absSkipped++; continue; }
    const c = clip(el);
    if (c.r - c.l > 1 && c.b - c.t > 1) { flow.push({ id: id(el), ...c }); els.push(el); }
  }
  const pairs = [];
  for (let i = 0; i < flow.length; i++) for (let j = i + 1; j < flow.length; j++) {
    if (els[i].contains(els[j]) || els[j].contains(els[i])) continue;
    const a = flow[i], b = flow[j];
    const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l);
    const oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    if (ox > 1 && oy > 1) pairs.push(`${a.id} x ${b.id} ${Math.round(ox)}x${Math.round(oy)}`);
  }
  // nothing may overhang the viewport horizontally either
  const over = flow.filter((f) => f.r > vw + 1 || f.l < -1).map((f) => f.id);
  return { pairs, over, flowN: flow.length, absSkipped };
};

async function openSheet(page) {
  await page.waitForFunction(() => !!window.VintWorldSkeleton, { timeout: 45000 }).catch(() => {});
  await page.evaluate(() => { try { window.VintWorldSkeleton.open(); } catch (_) {} });
  await page.waitForFunction(() => {
    const s = document.getElementById('dvWorldSkeletonSheet');
    return !!(s && s.classList.contains('open'));
  }, { timeout: 30000 }).catch(() => {});
  // wait for the ROSTER to be populated from the live brain, then for every
  // element the checks read to hold a STABLE rect across several frames
  // (9SABEEP: a settle keyed on the subject alone still races its neighbours).
  await page.waitForFunction(() => document.querySelectorAll('#wsFolk .ws-f').length > 0,
    { timeout: 45000 }).catch(() => {});
  await page.evaluate(async () => {
    document.documentElement.style.scrollBehavior = 'auto';
    const st = document.createElement('style');
    st.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
    document.head.appendChild(st);
    const key = () => [...document.querySelectorAll('*')].filter((e) => {
      const r = e.getBoundingClientRect(); return r.width * r.height >= 1;
    }).map((e) => {
      const r = e.getBoundingClientRect();
      return Math.round(r.top) + ',' + Math.round(r.left) + ',' +
             Math.round(r.width) + ',' + Math.round(r.height);
    }).join('|');
    let prev = '', same = 0;
    for (let i = 0; i < 120 && same < 4; i++) {
      await new Promise((r) => requestAnimationFrame(() => r()));
      const k = key();
      same = (k === prev) ? same + 1 : 0;
      prev = k;
    }
  });
}

(async () => {
  console.log('');
  console.log('═══ THE FOLK ON THE MAP — LIVE  (AC2WP9A) ' + '═'.repeat(26));
  console.log(`page: ${PAGE}`);
  console.log(`api : ${API}`);

  // ── 0. the deployed commit, from the site's own stamp ───────────────────
  const stamp = await getJSON(`${PAGE.replace(/\/[^/]*$/, '')}/commit.json?t=${Date.now()}`);
  console.log(`stamp: commit.json -> ${JSON.stringify(stamp)}`);

  // ── 1. SAMPLE ONE, from the brain ──────────────────────────────────────
  const a = await getJSON(`${API}/api/world/citizens`);
  const csA = (a && a.citizens) || [];
  is(`the live brain serves citizens (${csA.length})`, csA.length > 0, csA.length);
  const tickA = maxTick(csA);
  const tA = Date.now();
  console.log(`sample A: ${csA.length} citizens, newest tick ${tickA}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  const sampleA = {};
  try {
    // ── 2. THE ACCEPTANCE'S THREE WIDTHS ────────────────────────────────
    for (const [w, h] of [[320, 568], [768, 1024], [1920, 1080]]) {
      const page = await browser.newPage();
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      try {
        await page.goto(`${PAGE}?t=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(1200);
        await openSheet(page);
        const m = await page.evaluate(READ);
        const tag = `${w}x${h}`;
        // the brain AS THE PAGE SAW IT, not as it was before the page loaded
        const alignedCs = await brainAtTick(m.renderedTick);
        const cs = alignedCs || csA;
        is(`${tag}: the page's rendered tick could be aligned with the brain (${m.renderedTick})`,
           !!alignedCs, { renderedTick: m.renderedTick });

        // the roster names the LIVE people, with a verb each
        const byId = {}; for (const r of m.rows) byId[r.id] = r;
        const active = cs.filter((c) => c.active === 1 || c.active === true);
        const missing = active.filter((c) => !byId[c.id]).map((c) => c.id);
        is(`${tag}: every ACTIVE live citizen has a roster row (${active.length})`,
           missing.length === 0, missing.slice(0, 5));
        const noName = m.rows.filter((r) => !r.name).map((r) => r.id);
        const noAct = m.rows.filter((r) => !r.action).map((r) => r.id);
        is(`${tag}: every roster row carries a NAME`, noName.length === 0, noName.slice(0, 5));
        is(`${tag}: every roster row carries an ACTION`, noAct.length === 0, noAct.slice(0, 5));
        // VALUES: the verb on the page is the verb the brain sent
        const wrongVerb = active.filter((c) => {
          const row = byId[c.id]; if (!row) return false;
          const want = (c.incapacitated === 1 || c.incapacitated === true)
            ? 'fallen' : (c.last_action || 'still');
          return row.action !== want;
        }).map((c) => `${c.id}: page "${byId[c.id].action}" vs brain "${c.last_action}"`);
        is(`${tag}: the action shown is the verb the BRAIN sent`,
           wrongVerb.length === 0, wrongVerb.slice(0, 3));

        // positions: a marker per placed citizen, each on its own parcel
        const placed = cs.filter((c) => typeof c.parcel_x === 'number' && typeof c.parcel_y === 'number');
        const mk = {}; for (const k of m.markers) mk[k.id] = k;
        const noMarker = placed.filter((c) => !mk[c.id]).map((c) => c.id);
        is(`${tag}: every PLACED live citizen has a marker (${placed.length})`,
           noMarker.length === 0, noMarker.slice(0, 5));
        if (m.geom) {
          const cw = m.geom.w / m.geom.cols, ch = m.geom.h / m.geom.rows;
          const offParcel = placed.filter((c) => {
            const k = mk[c.id]; if (!k) return false;
            // a cluster is fanned off-centre on purpose; allow the fan radius
            const tol = Math.max(cw, ch) * 0.5 + m.geom.r * 1.1;
            return Math.abs(k.cx - (c.parcel_x + 0.5) * cw) > tol ||
                   Math.abs(k.cy - (c.parcel_y + 0.5) * ch) > tol;
          }).map((c) => c.id);
          is(`${tag}: every marker sits on its own parcel`, offParcel.length === 0, offParcel.slice(0, 3));
        } else is(`${tag}: the marker geometry is readable`, false, m.geom);

        is(`${tag}: the citizens actually painted (${m.citInk} opaque px)`, m.citInk > 100, m.citInk);
        // PARCELS STILL RENDER — the acceptance says so explicitly
        is(`${tag}: the terrain still renders (${m.terrainColors} distinct colours)`,
           m.terrainColors >= 5, m.terrainColors);

        // NO ELEMENT OVERLAP at this width
        const p = await page.evaluate(PAIRS);
        is(`${tag}: no two flow elements in the sheet overlap (${p.flowN} boxes, ${p.absSkipped} absolute/fixed excluded)`,
           !p.err && p.pairs.length === 0, p.pairs && p.pairs.slice(0, 4));
        is(`${tag}: nothing overhangs the viewport horizontally`,
           !p.err && p.over.length === 0, p.over && p.over.slice(0, 4));

        // the footer must carry the DEPLOYED commit
        is(`${tag}: the build hash in the tab title matches the deployed commit (${stamp.commit})`,
           !!(m.footer && stamp.commit && m.footer.includes(stamp.commit)), m.footer);

        if (w === 1920) {
          for (const r of m.rows) sampleA[r.id] = r.action;
          sampleA.__tick = m.renderedTick;
        }
      } finally { await page.close().catch(() => {}); }
    }

    // ── 3. SAMPLE TWO — AFTER THE WORLD'S OWN TICK ADVANCES ─────────────
    console.log('');
    const baseTick = (typeof sampleA.__tick === 'number') ? sampleA.__tick : tickA;
    console.log(`waiting for the world to tick past the tick SAMPLE A RENDERED (${baseTick}) ` +
                `(up to ${Math.round(WAIT_TICK_MS / 1000)}s)…`);
    let csB = csA, tickB = baseTick;
    const deadline = Date.now() + WAIT_TICK_MS;
    while (Date.now() < deadline) {
      await sleep(10000);
      try {
        const b = await getJSON(`${API}/api/world/citizens`, 2);
        csB = (b && b.citizens) || [];
        tickB = maxTick(csB);
        if (tickB > baseTick) break;
      } catch (e) { note(String(e.message || e)); }
    }
    const waited = ((Date.now() - tA) / 1000).toFixed(0);
    is(`the world's newest tick ADVANCED past the tick sample A rendered ` +
       `(${baseTick} -> ${tickB} in ${waited}s)`, tickB > baseTick, { baseTick, tickB });

    if (tickB > baseTick) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
      try {
        await page.goto(`${PAGE}?t=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await sleep(1200);
        await openSheet(page);
        const m2 = await page.evaluate(READ);
        const sampleB = {}; for (const r of m2.rows) sampleB[r.id] = r.action;
        // The acceptance asks for TWO SAMPLES ACROSS TWO TICKS. The thing that
        // must differ is the tick the PAGE RENDERED — if both page loads read
        // the same tick, "nothing changed" says nothing about the feature and
        // everything about how fast the measurement ran.
        is(`the page rendered a DIFFERENT tick on the second sample ` +
           `(${baseTick} -> ${m2.renderedTick})`,
           typeof m2.renderedTick === 'number' && m2.renderedTick > baseTick,
           { sampleA: baseTick, sampleB: m2.renderedTick });

        // the page's SECOND sample must agree with the brain's second sample
        const alignedB = await brainAtTick(m2.renderedTick);
        const csB2 = alignedB || csB;
        const byB = {}; for (const c of csB2) byB[c.id] = c;
        const drift = Object.keys(sampleB).filter((k) => {
          const c = byB[k]; if (!c) return false;
          const want = (c.incapacitated === 1 || c.incapacitated === true)
            ? 'fallen' : (c.last_action || 'still');
          return sampleB[k] !== want;
        }).map((k) => `${k}: page "${sampleB[k]}" vs brain "${(byB[k] || {}).last_action}"`);
        is(`sample B: the action shown is still the verb the BRAIN sent`,
           drift.length === 0, drift.slice(0, 3));

        // THE ACCEPTANCE'S OWN CLAUSE: a current-action line that CHANGES
        const changed = Object.keys(sampleA).filter((k) =>
          k !== '__tick' && sampleB[k] && sampleB[k] !== sampleA[k]);
        is(`a current-action line CHANGED across two world ticks (${changed.length} citizens)`,
           changed.length > 0, { sampleA_size: Object.keys(sampleA).length });
        for (const k of changed.slice(0, 6)) console.log(`        ${k}: ${sampleA[k]} -> ${sampleB[k]}`);

        // and the brain must agree that those citizens really moved
        const brainChanged = changed.filter((k) => {
          const before = csA.find((c) => c.id === k), after = byB[k];
          return before && after && before.last_action !== after.last_action;
        });
        is(`the brain agrees those verbs changed (${brainChanged.length}/${changed.length})`,
           changed.length === 0 || brainChanged.length > 0, brainChanged.slice(0, 5));
      } finally { await page.close().catch(() => {}); }
    }
  } finally { await browser.close().catch(() => {}); }

  console.log('');
  if (fails.length) { console.log('FAILURES:'); for (const f of fails) console.log('  - ' + f); console.log(''); }
  console.log(`${pass}/${pass + fails.length} pass`);
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
