#!/usr/bin/env node
'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   COLLISION + REACHABILITY HARNESS — WORLD_SPEC Phase 8 items 2+3, the STORY
   LAYER sections inside #worldMapPanel on world.html.  (task 9SABEEP)

   Under test: the two <details> bands this slice added to the already-capped
   map panel — #worldStory (the history timeline) and #worldFolk (the roster and
   one agent's profile) — plus the profile that opens inside the second one.

   WHY THIS FILE EXISTS SEPARATELY from collision-world-cost-QWYN8PW.js: that
   harness measures the panel's own floor against the page's fixed furniture and
   is unchanged by this slice (it is re-run as the regression check). What it
   cannot measure is the band this slice adds INSIDE the panel, because a
   collapsed <details> is invisible to it. The new failure modes are all
   internal: an opened band that evicts the canvas or the ledger out of the box
   (MU6GKNH), a long beat line that spills past the panel's content box, and a
   last row that nothing can bring into view (NFQ2EU6 — a disclosure's whole
   contract is that everything is still REACHABLE).

   THE DISCIPLINE, carried from the sibling harnesses and the lessons:
     · scroll a band by writing ITS OWN scrollTop, never scrollIntoView — that
       walks up every scroll ancestor and scrolls the document too (S3U2BDT).
     · force scroll-behavior:auto before measuring, or the rect read on the next
       line is the PRE-scroll rect (S3U2BDT).
     · clip a rect to every scroll ancestor and to the viewport, THEN hit-test
       the centre; a null elementFromPoint means "not in the viewport", never
       "buried" (2BXVQEN, N2E8EAP).
     · exclude position:absolute/fixed from the pairwise set and say so.
     · filter bands on AREA, not the `hidden` attribute: a display:none band
       keeps hidden===false and a 0×0 rect, which reads as a live band (966XX38).

   NEGATIVE CONTROLS:
     --no-rail-yield restores the mobile launcher rail while the reader is open,
                     exposing the wrapped-rail reachability regression.
     --no-band-cap   strips the bands' own `max-height`/`overflow-y:auto`, i.e.
                     the containment this slice added. The band then grows to
                     its content and evicts its siblings out of the panel.
     --no-scrub      serves beat text with raw markup in it (as it would be if
                     world-gazette.scrubText were reverted). This lane PASSES —
                     and that is the finding, not a vacuous control: the page
                     escapes everything it is handed, so the API's scrubber and
                     the page's esc() are two INDEPENDENT guards. Reported as
                     doubly fail-closed rather than removing a layer to make a
                     control look sharper (UB8NTTR).
     --old-loadgate  skips the rail-stability load gate, so a lane can be
                     measured while #dvRail's launchers are still arriving.
                     MUST reproduce the "BURIED under cvBtn" reds at 375x667 in
                     a FULL sweep — they do not appear in a single-width run.
     --old-settle    restores the pre-fix settle key (fixed elements only, blind
                     to their position:relative flow children). MUST reproduce
                     the 13 "storySummary is BURIED under cvBtn" reds at
                     375x667 — that is what proves the settle fix load-bearing.
     --prove-escape  pays for that claim: it injects the same raw markup through
                     innerHTML WITHOUT esc(), so the injection checks MUST go
                     red. A safety check that has never been seen to fail is an
                     untested safety check.
   ════════════════════════════════════════════════════════════════════════════ */

const http = require('http');
const fs = require('fs');
const path = require('path');
// Absolute path, as every sibling harness in this repo does: puppeteer lives
// in the BRAIN's node_modules, and a bare specifier resolves from THIS script's
// directory, which has none (E4CS77Y, from the other side).
let puppeteer;
try { puppeteer = require('/home/vinta/vintinuum-api/node_modules/puppeteer'); }
catch (_) { console.error('puppeteer is not installed here; cannot measure.'); process.exit(2); }

const ROOT = path.resolve(__dirname, '..');
const NOCAP = process.argv.includes('--no-band-cap');
const NOSCRUB = process.argv.includes('--no-scrub');
const PROVE = process.argv.includes('--prove-escape');
// Negative control: restore the competing rail while the reader is open.
const NORAILYIELD = process.argv.includes('--no-rail-yield');
// --old-settle: restore the pre-fix settle key (fixed elements ONLY, blind to
// their flow children). The control for the settle fix: it must reproduce the
// 13 "BURIED under cvBtn" reds at 375x667 that the fix removes.
const OLDSETTLE = process.argv.includes('--old-settle');
// --old-loadgate: skip the rail-stability load gate, i.e. measure a page whose
// #dvRail launchers may still be arriving. The control for that gate.
const OLDGATE = process.argv.includes('--old-loadgate');
const VIEWPORTS = [[320, 568], [375, 667], [393, 852], [740, 360], [768, 1024], [1280, 800], [1920, 1080]]
  // COLLISION_WIDTH=375 runs one viewport; COLLISION_WIDTHS=320,375 runs a
  // SUBSET IN ORDER. The second one exists because a red can depend on which
  // viewports ran BEFORE it in the same browser, and re-running the whole 84-lane
  // sweep to test that is 13 minutes a reproduction should not cost (9SABEEP).
  .filter(([w]) => {
    if (process.env.COLLISION_WIDTH) return w === Number(process.env.COLLISION_WIDTH);
    if (process.env.COLLISION_WIDTHS) {
      return process.env.COLLISION_WIDTHS.split(',').map(Number).includes(w);
    }
    return true;
  });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm' };

function serve() {
  return new Promise((resolve) => {
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

/* ── THE STUBBED BRAIN ───────────────────────────────────────────────────────
   Shapes copied from the live routes' own output (world-timeline.timeline and
   world-profile.listAgents/profileOf), so the page is rendering the real
   contract rather than a shape invented here.
   ────────────────────────────────────────────────────────────────────────── */
const LONGNAME = 'aetherhold-the-world-forger-of-the-vintinuum-council-xx';
const LONGTEXT = 'Ember took fertile land at (17,54) against ' + LONGNAME +
  ' by 2.42 to 1.68, seizing 3 goods, and the whole of the north wood changed hands in a single afternoon of it';
// MEASURED: world-gazette.scrubText turns < > " into ‹ › ” so citizen text can
// never open a tag. --no-scrub serves the UNSCRUBBED string, which is what the
// API would return if that function were reverted, to prove the page escapes.
const RAWTEXT = '<img src=x onerror=alert(1)> wrote a law — "</p><script>alert(1)</script><p>"';
const SCRUBBED = '‹img src=x onerror=alert(1)› wrote a law — ”‹/p›‹script›alert(1)‹/script›‹p›”';

function timelineBody(state) {
  if (state === 'empty') {
    return { tick: 0, today: 0, ticks_per_day: 24, days_requested: 7, days_returned: 0,
      per_day: 5, kinds: ['life'], kind_filter: null, unclassified_types: [], days: [] };
  }
  const path_ = state === 'pathological';
  const nDays = path_ ? 14 : 3;
  const perDay = path_ ? 40 : 5;
  const days = [];
  for (let i = 0; i < nDays; i++) {
    const day = 40 - i;
    const beats = [];
    for (let b = 0; b < perDay; b++) {
      beats.push({ id: 1000 - b, tick: day * 24 + b, type: 'war_resolved',
        kind: ['war', 'crime', 'life', 'state', 'market', 'land', 'underweb'][b % 7],
        weight: 90 - b, agent_id: 'citizen_ember',
        agent_name: path_ ? LONGNAME : 'Ember', hour: b,
        text: NOSCRUB ? RAWTEXT : (path_ ? LONGTEXT : SCRUBBED) });
    }
    days.push({ day, from_tick: day * 24, to_tick: day * 24 + 23, is_today: i === 0,
      events_total: 1240, beats_total: perDay + 9, beats_shown: perDay,
      by_kind: { war: 2, crime: 1 },
      headline: path_ ? LONGTEXT : (NOSCRUB ? RAWTEXT : 'Ember takes (17,54)'),
      gazette_url: '/uw/gazette.uw/day-' + day, gazette_words: 310, beats });
  }
  return { tick: 985, today: 41, ticks_per_day: 24, days_requested: nDays, days_returned: nDays,
    per_day: perDay, kinds: ['life', 'war'], kind_filter: null, unclassified_types: [], days };
}

function agentsBody(state) {
  if (state === 'empty') return { agents: [] };
  const path_ = state === 'pathological';
  const out = [];
  for (let i = 0; i < (path_ ? 40 : 5); i++) {
    out.push({ id: 'citizen_a' + i, name: path_ ? (LONGNAME + '-' + i) : ['Ember', 'Wren', 'Sol', 'Atlas', 'Wrer'][i % 5],
      home_project: null, talents: path_ ? ['forage', 'build', 'tend', 'teach', 'convene'] : ['tend'],
      active: i !== 3, needs: { energy: 80, food: 60, shelter: 70, social: 50 },
      reputation: 50, wallet_cached: path_ ? 987654321 : (120 - i * 7),
      x: 10 + i, y: 10, last_acted_tick: 985 - i });
  }
  return { agents: out };
}

function profileBody(state, id) {
  const path_ = state === 'pathological';
  const nm = path_ ? LONGNAME : 'Ember';
  return {
    id, name: NOSCRUB ? RAWTEXT : nm, home_project: null,
    talents: ['forage', 'tend'], genome_ref: null, model_tier: 'cheap', acts_every_ticks: 1,
    alive: true, needs: { energy: 80, food: 60, shelter: 70, social: 50 },
    reputation: 50, last_acted_tick: 985,
    parcel: { x: 17, y: 54, terrain: 'fertile', owner: id, mine: true },
    deeds: 3, inventory: [{ good: 'grain', qty: 12 }, { good: 'wood', qty: path_ ? 987654321 : 4 }],
    sites: [], death: null,
    wallet: { balance: path_ ? 987654321 : 128, cached_balance: path_ ? 12 : 120,
      drift: path_ ? 987654309 : 8, lifetime_earned: 140, lifetime_spent: 12,
      by_reason: [{ reason: 'trade', net: -12, moves: 1 }],
      recent: [{ tick: 34, delta: -12, reason: 'trade', memo: 'sold wood', transfer_id: 't1' }] },
    diary: Array.from({ length: path_ ? 8 : 2 }, (_, i) => ({
      tick: 980 - i, importance: 0.8,
      text: NOSCRUB ? RAWTEXT : (path_
        ? 'I am tired of being robbed and I will write a law about it, and then another, and I will keep writing until the north wood is mine alone and nobody walks it without my leave at all'
        : 'I am tired of being robbed. I will write a law.') })),
    memories: [], memory_counts: { diary: 2, event: 4, outcome: 1 },
    relationships: {
      peers: Array.from({ length: path_ ? 6 : 2 }, (_, i) => ({
        agent_id: 'citizen_' + (path_ ? LONGNAME + i : ['wren', 'sol'][i]),
        trust: 0.9 - i * 0.1, parts: { contracts: 2, transfers: 5, orgs: 1, wars: 1, crimes: i },
        enough: true })),
      orgs: [{ org_id: 'org:sol-council', name: path_ ? LONGNAME : 'Sol Council',
        kind: 'government', treasury: 568, founder: id, is_founder: true, members: 24 }],
      kin: { children: [], parents: [], proposals: [] },
      crimes: { committed: 1, suffered: 2 },
      will: { beneficiary: 'citizen_ember', kind: 'citizen',
        note: NOSCRUB ? RAWTEXT : 'the one I have dealt with most', written_tick: 42 },
    },
    history: [],
  };
}
const PARCELS = (() => {
  const terrain = []; for (let i = 0; i < 64 * 64; i++) terrain.push('feorw'[i % 5]);
  return { w: 64, h: 64, terrain: terrain.join(''), claims: [{ x: 3, y: 4 }] };
})();

/* ── THE PAGE-SIDE PROBE ─────────────────────────────────────────────────── */
function probe() {
  const vw = window.innerWidth, vh = window.innerHeight;

  // (1) the shared fixed-overlap probe, byte-identical to the sibling harnesses
  function visible(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity) === 0) return false;
    const ownText = Array.from(el.childNodes).filter((n) => n.nodeType === 3)
      .map((n) => n.nodeValue).join('').trim();
    if (cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.backgroundImage === 'none' &&
        cs.borderStyle === 'none' && cs.boxShadow === 'none' && !ownText) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 12 && r.height <= 12 && cs.pointerEvents === 'none' &&
        !el.children.length && !el.textContent.trim()) return false;
    const blur = /blur\(\s*([\d.]+)px/.exec(cs.filter);
    const faint = parseFloat(cs.opacity) <= 0.15;
    const behind = (parseInt(cs.zIndex, 10) || 0) <= 0;
    if (cs.pointerEvents === 'none' && behind && !el.textContent.trim() &&
        ((blur && parseFloat(blur[1]) >= 20) || faint)) return false;
    return true;
  }
  const rects = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed') continue;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) continue;
    if (r.width >= vw * 0.9 && r.height >= vh * 0.9) continue;
    rects.push({ id: el.id || '', tag: el.tagName.toLowerCase(),
      cls: String(el.className || '').slice(0, 40), x: r.left, y: r.top, w: r.width, h: r.height, _el: el });
  }
  const hits = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a._el.contains(b._el) || b._el.contains(a._el)) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 1 && oy > 1) hits.push({ a: a.id || a.tag + '.' + a.cls, b: b.id || b.tag + '.' + b.cls,
        overlap: Math.round(ox) + 'x' + Math.round(oy) });
    }
  }

  const panel = document.getElementById('worldMapPanel');
  const story = document.getElementById('worldStory');
  const folk = document.getElementById('worldFolk');
  if (!panel || panel.hidden || !story || !folk) return { hits, open: false, rendered: false };
  const pcs = getComputedStyle(panel);
  if (panel.hasAttribute('data-standdown') || pcs.display === 'none' || pcs.visibility === 'hidden') {
    return { hits, open: true, standdown: true, rendered: false,
      room: Math.round((parseFloat(pcs.getPropertyValue('--wmp-floor')) || vh) -
                       (parseFloat(pcs.getPropertyValue('--wmp-top')) ||
                        parseFloat(pcs.getPropertyValue('--wmp-base')) || 214)) };
  }

  const pr = panel.getBoundingClientRect();
  const px = (v) => parseFloat(v) || 0;
  // The panel's CONTENT box — rect minus border minus padding, with clientWidth
  // for the inline edge so a scrollbar is accounted for.
  const content = {
    l: pr.left + px(pcs.borderLeftWidth) + px(pcs.paddingLeft),
    r: pr.left + px(pcs.borderLeftWidth) + panel.clientWidth - px(pcs.paddingRight),
  };

  // (2) THE SIBLING BANDS KEEP THEIR SPACE. MU6GKNH: a band with no inward cap
  // evicts its neighbour out of the card. Every top-level child of the panel
  // must still have height, and no two may overlap.
  // Filtered on AREA, never on the `hidden` attribute: a display:none band
  // keeps hidden===false and a 0x0 rect, which reads as a live band (966XX38).
  const bands = Array.from(panel.children)
    .map((el) => ({ el, id: el.id || el.tagName.toLowerCase() + '.' + String(el.className || '').slice(0, 20),
      r: el.getBoundingClientRect() }))
    .filter((b) => b.r.width * b.r.height > 0);
  const zero = Array.from(panel.children)
    .filter((el) => getComputedStyle(el).display !== 'none')
    .map((el) => ({ id: el.id || el.tagName.toLowerCase() + '.' + String(el.className || '').slice(0, 20),
      h: Math.round(el.getBoundingClientRect().height) }))
    .filter((b) => b.h <= 0);
  const bandHits = [];
  for (let i = 0; i < bands.length; i++) {
    for (let j = i + 1; j < bands.length; j++) {
      const a = bands[i], b = bands[j];
      // absolutely/fixed-positioned children are excluded and reported: an
      // authored decoration may legitimately sit over its parent.
      if (['absolute', 'fixed'].includes(getComputedStyle(a.el).position)) continue;
      if (['absolute', 'fixed'].includes(getComputedStyle(b.el).position)) continue;
      const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (ox > 1 && oy > 1) bandHits.push({ a: a.id, b: b.id, overlap: Math.round(ox) + 'x' + Math.round(oy) });
    }
  }

  // (3) HORIZONTAL CONTAINMENT of every element the story layer renders, against
  // the panel's content box — and no horizontal scroll anywhere. Never measured
  // with scrollWidth against innerWidth: the page's html/body is overflow-x
  // hidden, which clamps scrollWidth and makes that check incapable of failing
  // (2BXVQEN).
  const spills = [];
  const mine = [story, folk].concat(
    Array.from(story.querySelectorAll('*')), Array.from(folk.querySelectorAll('*')));
  for (const el of mine) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 && r.height <= 0) continue;
    if (r.left < content.l - 1 || r.right > content.r + 1) {
      spills.push({ what: el.id || el.tagName.toLowerCase() + '.' + String(el.className || '').slice(0, 24),
        left: Math.round(r.left), right: Math.round(r.right),
        bound: Math.round(content.l) + '..' + Math.round(content.r) });
    }
  }
  const hScrollPanel = panel.scrollWidth - panel.clientWidth;
  const hScrollBands = [story, folk].map((el) => {
    const b = el.querySelector('.wd-body');
    return b ? { id: el.id, h: b.scrollWidth - b.clientWidth } : { id: el.id, h: 0 };
  });

  // (4) VERTICAL CONTAINMENT: the band grows INWARD, so each open band's own
  // body must be a scroller rather than a thing that reaches past the panel.
  const bodies = [story, folk].map((el) => {
    const b = el.querySelector('.wd-body');
    if (!b || !el.open) return { id: el.id, open: !!el.open, present: !!b };
    const r = b.getBoundingClientRect();
    const cs = getComputedStyle(b);
    // NOT "is the band inside the panel's VISIBLE rect": the panel is itself a
    // max-height scroller, so a band further down its scroll content correctly
    // sits below the visible box until the panel is scrolled — and the sibling
    // harness already proves the panel never leaves the viewport. The defect
    // this slice can actually introduce (MU6GKNH) is a band that grows to its
    // CONTENT instead of growing inward, so what is measured is BOUNDEDNESS:
    // the band may never be taller than the panel's own visible slot, and when
    // its content exceeds its box it must scroll rather than push a sibling.
    return { id: el.id, open: true, present: true,
      overflowY: cs.overflowY, maxHeight: cs.maxHeight,
      h: Math.round(r.height), scrollH: Math.round(b.scrollHeight),
      scrolls: b.scrollHeight > b.clientHeight + 1,
      bounded: r.height <= panel.clientHeight + 1,
      capBinds: b.scrollHeight <= b.clientHeight + 1 || b.scrollHeight > b.clientHeight + 1 };
  });

  // (5) REACHABILITY. Write each scroll ancestor's OWN scrollTop from rects —
  // never scrollIntoView (S3U2BDT) — then clip to every ancestor and the
  // viewport and hit-test the centre of what is left. Scroll behaviour is
  // forced to 'auto' so the rect on the next line is the POST-scroll rect.
  document.documentElement.style.scrollBehavior = 'auto';
  function reach(target) {
    if (!target) return null;
    const ancestors = [];
    for (let n = target.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (/(auto|scroll)/.test(cs.overflowY) || /(auto|scroll)/.test(cs.overflowX)) ancestors.push(n);
      if (n === document.body) break;
    }
    for (const sc of ancestors) {                       // innermost first
      const sr = sc.getBoundingClientRect();
      const tr = target.getBoundingClientRect();
      const dy = (tr.top - sr.top) - (sc.clientHeight - tr.height) / 2;
      sc.scrollTop = Math.max(0, Math.min(sc.scrollTop + dy, sc.scrollHeight - sc.clientHeight));
      const dx = (tr.left - sr.left) - (sc.clientWidth - tr.width) / 2;
      sc.scrollLeft = Math.max(0, Math.min(sc.scrollLeft + dx, sc.scrollWidth - sc.clientWidth));
    }
    let r = target.getBoundingClientRect();
    let cl = Math.max(r.left, 0), cr = Math.min(r.right, vw);
    let ct = Math.max(r.top, 0), cb = Math.min(r.bottom, vh);
    for (const sc of ancestors) {
      const sr = sc.getBoundingClientRect();
      cl = Math.max(cl, sr.left); cr = Math.min(cr, sr.right);
      ct = Math.max(ct, sr.top); cb = Math.min(cb, sr.bottom);
    }
    const okBox = cr - cl > 1 && cb - ct > 1;
    const hit = okBox ? document.elementFromPoint((cl + cr) / 2, (ct + cb) / 2) : null;
    return { visible: okBox, own: !!(hit && (hit === target || target.contains(hit) || hit.contains(target))),
      hitId: hit ? (hit.id || hit.tagName.toLowerCase() + '.' + String(hit.className || '').slice(0, 20)) : null,
      clipped: { w: Math.round(cr - cl), h: Math.round(cb - ct) } };
  }
  const lastBeat = story.querySelectorAll('.wd-beats li');
  const lastFolk = folk.querySelectorAll('.wd-folk button');
  const reaches = {
    storyLast: story.open && lastBeat.length ? reach(lastBeat[lastBeat.length - 1]) : null,
    folkLast: folk.open && lastFolk.length ? reach(lastFolk[lastFolk.length - 1]) : null,
    paper: story.open ? reach(story.querySelector('.wd-paper')) : null,
    storySummary: reach(story.querySelector('summary')),
    folkSummary: reach(folk.querySelector('summary')),
  };
  // put every scroller back so the next measurement starts clean
  for (const sc of [panel].concat(Array.from(panel.querySelectorAll('.wd-body')))) {
    sc.scrollTop = 0; sc.scrollLeft = 0;
  }

  // (6) the page must ESCAPE whatever it was handed — the second of two guards
  const injected = {
    scripts: panel.querySelectorAll('script').length,
    imgs: panel.querySelectorAll('img').length,
    handlers: Array.from(panel.querySelectorAll('*')).filter((el) =>
      Array.from(el.attributes || []).some((a) => /^on[a-z]+$/i.test(a.name))).length,
  };

  return {
    hits, open: true, rendered: true, standdown: false,
    panel: { t: Math.round(pr.top), b: Math.round(pr.bottom), l: Math.round(pr.left),
      r: Math.round(pr.right), h: Math.round(pr.height) },
    inViewport: pr.top >= -1 && pr.bottom <= vh + 1 && pr.left >= -1 && pr.right <= vw + 1,
    room: Math.round((parseFloat(pcs.getPropertyValue('--wmp-floor')) || vh) -
                     (parseFloat(pcs.getPropertyValue('--wmp-top')) ||
                      parseFloat(pcs.getPropertyValue('--wmp-base')) || 214)),
    bandCap: getComputedStyle(story.querySelector('.wd-body')).maxHeight,
    panelScrolls: panel.scrollHeight > panel.clientHeight + 1,
    bandHits, zero, spills, hScrollPanel: Math.round(hScrollPanel), hScrollBands,
    bodies, reaches, injected,
    counts: { days: story.querySelectorAll('.wd-day').length,
      beats: lastBeat.length, folk: lastFolk.length,
      profile: folk.querySelectorAll('.wd-prof').length },
    storyNote: (document.getElementById('worldStoryNote') || {}).textContent || '',
    folkNote: (document.getElementById('worldFolkNote') || {}).textContent || '',
  };
}

function killTransitions() {
  const s = document.createElement('style');
  s.textContent = '#worldState,#status,.world-cost-bar i,#dvToast,*{transition:none !important;' +
    'animation:none !important}html{scroll-behavior:auto !important}';
  document.head.appendChild(s);
}
// THE CONTROL: strip the containment this slice added to the bands.
function stripBandCap() {
  const s = document.createElement('style');
  s.textContent = '.world-disc .wd-body{max-height:none !important;overflow-y:visible !important}';
  document.head.appendChild(s);
}

(async () => {
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await puppeteer.launch({ headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    timeout: 120000, protocolTimeout: 180000 });

  const failures = [], limitations = [], notes = [];
  let checks = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const STATES = ['empty', 'normal', 'pathological'];

  async function loadPage(w, h) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const page = await browser.newPage();
        page.setDefaultTimeout(30000);
        page.__state = 'normal';
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const u = req.url();
          const json = (body) => req.respond({ status: 200, contentType: 'application/json',
            headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
          // sw.js must never register: a live service worker answers same-origin
          // fetches itself, so a stubbed route is never seen by this interceptor
          // and the page reads a synthetic 404 (measured in the sibling harness).
          if (/\/sw\.js(\?|$)/.test(u)) return req.respond({ status: 404, body: '' });
          if (u.includes('/api/world/timeline')) return json(timelineBody(page.__state));
          if (/\/api\/world\/agents?\/[^/?]+/.test(u)) return json(profileBody(page.__state, 'citizen_a0'));
          if (u.includes('/api/world/agents')) return json(agentsBody(page.__state));
          if (u.includes('/api/world/cost')) {
            return json({ day: '2026-11-12', tokens_today: 1200, token_budget: 2000000,
              pct_display: 14, status: 'running', agents_active: 2, unattributed_tokens: 0,
              per_agent: [{ name: 'Ember', tokens: 900, turns: 3 }, { name: 'Wren', tokens: 300, turns: 1 }] });
          }
          if (u.includes('/api/world/parcels')) return json(PARCELS);
          if (u.includes('/api/world/health')) return json({ economy_tick: 985 });
          if (u.includes('/api/world/budget')) {
            return json({ status: 'running', paused: false, pause_source: null,
              pct_display: 14, tokens_spent: 280000, token_budget: 2000000 });
          }
          if (/^https?:\/\/(api\.vintaclectic\.com|localhost:8767)/.test(u)) return req.abort('connectionrefused');
          return req.continue();
        });
        await page.evaluateOnNewDocument((off) => { window.__railGateOff = off; }, OLDGATE);
        if (page.setBypassServiceWorker) await page.setBypassServiceWorker(true);
        await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
        try { await page.goto(base + '/world.html', { waitUntil: 'domcontentloaded', timeout: 30000 }); }
        catch (_) { /* no live brain in a harness; the page still renders */ }
        await sleep(900);
        const ok = await page.evaluate(() => !!document.getElementById('worldMapButton') &&
          !!document.getElementById('worldStory') && !!document.getElementById('worldFolk'));
        if (!ok) { await page.close().catch(() => {}); throw new Error('world.html loaded without the story sections'); }
        // WAIT FOR THE DOCK, exactly as collision-world-cost-QWYN8PW.js does.
        // Without this gate the first two lanes measured a page whose floating
        // furniture had not been docked yet and whose #hint had not faded:
        // MEASURED `hint x worldClock 3x27` and `storySummary BURIED under
        // fgBtn` in lane 1 only, both gone by lane 3 and both present at HEAD
        // with no story sections at all — i.e. a pre-dock frame, not a defect
        // this slice introduced. Measuring an un-settled page is how a harness
        // manufactures a false red (NFQ2EU6).
        await page.waitForFunction(() => {
          const inv = document.getElementById('invite');
          return inv && inv.classList.contains('show') && window.DirverseHUD &&
            ['vintVoice', 'vint-vc-fab', 'vwg-pill'].every((id) => {
              const el = document.getElementById(id);
              return el && el.hasAttribute('data-vint-docked');
            });
        }, { timeout: 15000 }).catch(() => {});
        // AND WAIT FOR THE RAIL TO STOP MOVING. The dock gate above waits for
        // #vintVoice / #vint-vc-fab / #vwg-pill to publish data-vint-docked —
        // it says NOTHING about #dvRail's launchers (#cvBtn, #fgBtn,
        // #gatherBtn, #dhDoorBtn, the ascent button), which their own modules
        // append on their own schedule and which the rail then re-measures and
        // REPOSITIONS on a later beat. Those are flow children of a fixed
        // column, so they are invisible to a settle key keyed on
        // position:fixed, and they are appended AFTER this gate used to pass.
        //
        // MEASURED 2026-11-13: the full 84-lane sweep reported 13
        // "storySummary/folkSummary/storyLast is BURIED under cvBtn" reds at
        // 375x667, while FOUR standalone runs of that same width — one of them
        // with --old-settle, i.e. the pre-fix settle key — scored 223/223.
        // A red that only appears once the browser has already ground through a
        // previous viewport is the harness measuring a page whose rail has not
        // finished arriving, not a collision (NFQ2EU6; the comment on the dock
        // gate above records the SAME class for #fgBtn and fixed it only for
        // the dock). So wait until the rail's launcher SET and their RECTS are
        // both stable across several frames.
        await page.waitForFunction(() => {
          if (window.__railGateOff) return true;             // --old-loadgate control
          const rail = document.getElementById('dvRail');
          if (!rail) return true;                            // no rail on this page
          const key = [...rail.querySelectorAll('*')].map((el) => {
            const r = el.getBoundingClientRect();
            return (el.id || el.className || el.tagName) + ':' +
              Math.round(r.top) + ',' + Math.round(r.left) + ',' +
              Math.round(r.width) + ',' + Math.round(r.height);
          }).sort().join(';');
          window.__railKey = window.__railKey || { k: '', n: 0 };
          if (key === window.__railKey.k) window.__railKey.n++;
          else { window.__railKey.k = key; window.__railKey.n = 0; }
          return window.__railKey.n >= 6;
        }, { polling: 100, timeout: 20000 }).catch(() => {});
        // #hint fades on its own timer; it is page furniture this slice does not
        // touch, so wait it out rather than assert against a transient.
        await page.waitForFunction(() => {
          const h = document.getElementById('hint');
          if (!h) return true;
          const cs = getComputedStyle(h);
          return cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05;
        }, { timeout: 20000 }).catch(() => {});
        await page.evaluate(killTransitions);
        if (NORAILYIELD) await page.addStyleTag({ content:
          'body.vw-map-reading #dvRail, body.vw-map-reading #dvRail * { visibility:visible !important; pointer-events:auto !important; }' });
        if (NOCAP) await page.evaluate(stripBandCap);
        if (PROVE) await page.evaluate((raw) => {
          // The non-vacuity payment for the injection checks: the same citizen
          // string, written with innerHTML and NO esc(). If the checks below
          // cannot see this, they could never have seen a real one either.
          window.__proveEscape = () => {
            const b = document.getElementById('worldStoryBody');
            if (b) b.innerHTML = '<div class="wd-day">' + raw + '</div>';
          };
        }, RAWTEXT);
        return page;
      } catch (e) {
        if (attempt === 2) throw e;
        await sleep(1500);
      }
    }
  }

  // A STABLE rect, not a fixed sleep: a <details> toggle plus a fetch render
  // settles at a different speed on an idle box than on a loaded one (NY592A8).
  async function settle(page) {
    await page.evaluate(async (oldKey) => {
      window.__oldSettleKey = oldKey;
      const panel = document.getElementById('worldMapPanel');
      let last = '', same = 0;
      for (let i = 0; i < 70 && same < 4; i++) {
        await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));
        // The STAND-DOWN decision is part of the state being waited for. It is
        // published with visibility:hidden (QWYN8PW: display:none made the box
        // report a zero rect and the decision flip-flopped), so the rect alone
        // is STABLE while the decision is still flipping — waiting on height
        // only would sample a panel mid-decision and read a transient overlap
        // as a real one.
        const cs = getComputedStyle(panel);
        // The FIXED FURNITURE is part of the state being waited for, not just
        // the panel. #dvRail is a fixed column whose launchers (#gatherBtn,
        // #dhDoorBtn, the ascent/covenants buttons) are FLOW children, and the
        // rail re-measures its own band — ceiling against #vintWorldHud/#hint,
        // floor against #saybar — whenever the page reflows. Opening a band in
        // this panel reflows the page, so those launchers MOVE on the rail's
        // own schedule, AFTER the panel's rect has already gone quiet. Waiting
        // on the panel alone therefore hit-tests against furniture that is
        // still in flight, and a control legitimately reads as BURIED for one
        // frame. MEASURED: the full 112-lane sweep reported
        // "393x852 empty/both: storySummary is BURIED under gatherBtn" once and
        // that same width re-run standalone was 223/223 — a settle race, not a
        // collision. Keying on every fixed element's rounded rect removes the
        // class instead of re-rolling the dice (NY592A8: wait for a STABLE
        // rect, never a fixed sleep).
        // ...AND THE FURNITURE'S OWN CHILDREN. The comment above names
        // #gatherBtn, #dhDoorBtn and the covenants button as the things that
        // move — and then this key used to filter on `position === 'fixed'`,
        // which EXCLUDES every one of them: they are position:relative FLOW
        // children of the fixed #dvRail. So the key went quiet while exactly
        // the elements it was written to track were still in flight, and the
        // hit-test ran mid-layout.
        //
        // MEASURED 2026-11-13 at 375x667, load 2.4, nothing else running:
        // 13 lanes reported "storySummary is BURIED under cvBtn" with this key;
        // an instrumented copy differing ONLY by one extra elementFromPoint
        // (which forces a layout flush before the measurement) scored 223/223
        // on the same tree in the same minute. The page was never dirty — the
        // key was blind to #cvBtn, whose own rect is what moves.
        //
        // So the key now covers each fixed/sticky element AND its visible
        // descendants, capped per obstacle so the poll stays bounded
        // (N2E8EAP: this runs on every settle frame).
        const KEYDESC_CAP = 48;
        const furniture = [];
        for (const el of document.body.querySelectorAll('*')) {
          const st = getComputedStyle(el);
          if ((st.position !== 'fixed' && st.position !== 'sticky') ||
              st.visibility === 'hidden' || st.display === 'none') continue;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) continue;
          furniture.push(el);
          if (window.__oldSettleKey) continue;        // --old-settle control
          const kids = el.querySelectorAll('*');
          const n = kids.length < KEYDESC_CAP ? kids.length : KEYDESC_CAP;
          for (let j = 0; j < n; j++) {
            const kr = kids[j].getBoundingClientRect();
            if (kr.width > 0 && kr.height > 0) furniture.push(kids[j]);
          }
        }
        const fixedKey = furniture
          .map((el) => {
            const r = el.getBoundingClientRect();
            return `${el.id || el.className || el.tagName}:${Math.round(r.top)},${Math.round(r.left)},` +
                   `${Math.round(r.width)},${Math.round(r.height)}`;
          })
          .sort().join(';');
        const k = [Math.round(panel.getBoundingClientRect().height), panel.scrollHeight,
          panel.hasAttribute('data-standdown') ? 1 : 0,
          cs.getPropertyValue('--wmp-top').trim(), cs.getPropertyValue('--wmp-floor').trim(),
          fixedKey].join('|');
        if (k === last) same++; else { same = 0; last = k; }
      }
    }, OLDSETTLE);
  }

  for (const [w, h] of VIEWPORTS) {
    const page = await loadPage(w, h);
    // LANES: both bands shut, story open, folk open (+ a profile picked), both
    // open. The worst lane is the last one — the tallest the panel can ever be.
    const LANES = [
      { name: 'shut', story: false, folk: false, pick: false },
      { name: 'story', story: true, folk: false, pick: false },
      { name: 'folk', story: false, folk: true, pick: true },
      { name: 'both', story: true, folk: true, pick: true },
    ];
    for (const state of STATES) {
      for (const lane of LANES) {
        const tag = `${w}x${h} ${state}/${lane.name}`;
        const add = (msg) => failures.push(`${tag}: ${msg}`);
        page.__state = state;
        // open the panel fresh each lane so no stale scroll or band state leaks
        await page.evaluate(() => {
          const p = document.getElementById('worldMapPanel');
          if (!p.hidden) document.getElementById('worldMapButton').click();
          if (document.body.classList.contains('vw-map-reading')) throw new Error('closing reader did not restore rail');
        });
        await sleep(150);
        await page.evaluate(() => document.getElementById('worldMapButton').click());
        await sleep(400);
        await page.evaluate((l) => {
          const s = document.getElementById('worldStory'), f = document.getElementById('worldFolk');
          if (s.open !== l.story) { s.open = l.story; s.dispatchEvent(new Event('toggle')); }
          if (f.open !== l.folk) { f.open = l.folk; f.dispatchEvent(new Event('toggle')); }
        }, lane);
        await settle(page);
        if (lane.pick) {
          // Tapping a citizen is a TOGGLE (tap again to close), and the page is
          // reused across lanes, so a bare click can CLOSE a profile a previous
          // lane opened. Drive to the OPEN state explicitly, and assert the
          // toggle both ways while we are here.
          const picked = await page.evaluate(async () => {
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            const btn = () => document.querySelector('#worldFolkBody .wd-folk button');
            if (!btn()) return { ok: false, reason: 'no citizen rows' };
            const prof = () => document.querySelector('#worldFolkBody .wd-prof');
            // TAP AT MOST ONCE. The row is a TOGGLE (economy-map.js:
            // `pickedAgent = (pickedAgent === id) ? null : id`, and the closing
            // branch runs `profileRequest++; host.innerHTML = ''`), so a retry
            // LOOP around the tap closes the profile it just opened whenever
            // the first render needs longer than the loop's sleep — a retry
            // that fights the thing it is retrying. Drive from the page's OWN
            // published state instead of counting taps, then WAIT for the
            // render rather than guessing how long it takes.
            if (btn().getAttribute('aria-pressed') !== 'true') btn().click();
            for (let i = 0; i < 40 && !prof(); i++) await sleep(150);   // <= 6s
            const opened = !!prof();
            if (!opened) {
              const host = document.getElementById('worldProfile');
              return { ok: false, reason: 'profile never rendered within 6s after ONE tap' +
                ' (aria-pressed=' + btn().getAttribute('aria-pressed') +
                ', host="' + String(host && host.textContent || '').slice(0, 40) + '")' };
            }
            // the toggle still closes, and re-opens — asserted here, not assumed
            btn().click();
            for (let i = 0; i < 20 && prof(); i++) await sleep(100);
            if (prof()) return { ok: false, reason: 'tapping the open citizen did not close the profile' };
            btn().click();
            for (let i = 0; i < 40 && !prof(); i++) await sleep(150);
            return { ok: !!prof(), reason: prof() ? '' : 'the profile did not re-open after a close' };
          });
          if (picked && !picked.ok && state !== 'empty') add('pick: ' + picked.reason);
          await sleep(300); await settle(page);
        }
        if (PROVE) await page.evaluate(() => { if (window.__proveEscape) window.__proveEscape(); });
        const r = await page.evaluate(probe);
        checks++;
        if (!r.open) { add('the panel would not open'); continue; }
        if (r.standdown) {
          // A stood-down panel is a collision-free outcome, not a failure — it
          // is QWYN8PW's measured law for a viewport with no room.
          limitations.push(`${tag}: panel stood down (${r.room}px of free band) — shape, not collision`);
          console.log(`  ${tag.padEnd(34)} stood down (${r.room}px room)`);
          continue;
        }

        // 1 — no two visible fixed elements overlap, anywhere on the page
        checks++; if (r.hits.length) add('FIXED OVERLAP ' + r.hits.map((x) => `${x.a}x${x.b} ${x.overlap}`).join(', ') +
          ` [panel room ${r.room}px, band cap ${r.bandCap}]`);
        // 2 — the panel itself stays inside the viewport
        checks++; if (!r.inViewport) add(`panel left the viewport (t${r.panel.t} b${r.panel.b} l${r.panel.l} r${r.panel.r})`);
        // 3 — no band evicted a sibling: every child keeps height, none overlap
        checks++; if (r.zero.length) add('A BAND WAS EVICTED to zero height: ' + r.zero.map((z) => z.id).join(', '));
        checks++; if (r.bandHits.length) add('BANDS OVERLAP ' + r.bandHits.map((x) => `${x.a}x${x.b} ${x.overlap}`).join(', '));
        // 4 — horizontal containment and no horizontal scroll
        checks++; if (r.spills.length) add('HORIZONTAL SPILL ' + r.spills.slice(0, 3).map((s) => `${s.what} ${s.left}..${s.right} outside ${s.bound}`).join('; '));
        checks++; if (r.hScrollPanel > 1) add(`panel scrolls horizontally by ${r.hScrollPanel}px`);
        checks++; {
          const bad = r.hScrollBands.filter((b) => b.h > 1);
          if (bad.length) add('BAND scrolls horizontally: ' + bad.map((b) => `${b.id} ${b.h}px`).join(', '));
        }
        // 5 — an OPEN band grows inward: it is a scroller and it stays inside
        for (const b of r.bodies) {
          if (!b.open) continue;
          checks++;
          if (!/(auto|scroll)/.test(b.overflowY)) add(`${b.id} body is not a scroller (overflow-y:${b.overflowY}) — it can evict a sibling`);
          checks++;
          if (!b.bounded) add(`${b.id} body is TALLER than the panel's own slot ` +
            `(h${b.h} > ${r.panel.h}) — it grew to its content instead of inward`);
          checks++;
          // the cap must BIND when the content is long: an uncapped band would
          // report scrollH === clientHeight because it simply grew.
          if (b.scrollH > b.h + 1 && !b.scrolls) add(`${b.id} body has ${b.scrollH}px of content in ${b.h}px and does NOT scroll`);
        }
        // 6 — REACHABILITY: a disclosure's whole contract
        for (const [k, v] of Object.entries(r.reaches)) {
          if (!v) continue;
          checks++;
          if (!v.visible) add(`${k} cannot be brought into view at all (clipped to ${v.clipped.w}x${v.clipped.h})`);
          else if (!v.own) add(`${k} is BURIED under ${v.hitId}`);
        }
        // 7 — the page escapes what it was handed
        checks++; if (r.injected.scripts) add(`${r.injected.scripts} <script> injected into the panel`);
        checks++; if (r.injected.imgs) add(`${r.injected.imgs} <img> injected into the panel`);
        checks++; if (r.injected.handlers) add(`${r.injected.handlers} inline event handler(s) injected into the panel`);
        // 8 — the lane actually rendered what it claims (a vacuity guard: a band
        //     that rendered NOTHING would pass every check above for free)
        if (lane.story && state !== 'empty') {
          checks++; if (!r.counts.days) add('the story band is open and rendered NO days — every check above is vacuous');
          checks++; if (!r.counts.beats) add('the story band rendered no beats');
        }
        if (lane.folk && state !== 'empty') {
          checks++; if (!r.counts.folk) add('the folk band is open and rendered NO citizens — vacuous');
          if (lane.pick) { checks++; if (!r.counts.profile) add('a citizen was tapped and no profile rendered'); }
        }
        if (state === 'empty' && (lane.story || lane.folk)) {
          checks++;
          const note = lane.story ? r.storyNote : r.folkNote;
          if (!/no days yet|empty/.test(note)) add(`the empty state is not stated honestly (note: "${note}")`);
        }

        console.log(`  ${tag.padEnd(34)} panel ${String(r.panel.h).padStart(4)}px  ` +
          `${r.counts.days}d/${r.counts.beats}b/${r.counts.folk}f${r.counts.profile ? '+prof' : ''}  ` +
          `${r.panelScrolls ? 'scrolls' : 'fits   '}  ` +
          (failures.length && failures[failures.length - 1].startsWith(tag) ? 'DIRTY' : 'clean'));
      }
    }
    await page.close().catch(() => {});
  }

  await browser.close();
  srv.close();

  console.log('\n' + '='.repeat(74));
  if (limitations.length) {
    console.log('MEASURED LIMITATIONS (no overlap, simply no room):');
    for (const l of limitations) console.log('  ' + l);
    console.log('');
  }
  if (notes.length) { for (const n of notes) console.log('  note: ' + n); console.log(''); }
  if (failures.length) {
    console.log('FAILURES:');
    for (const f of failures) console.log('  · ' + f);
    console.log('');
    console.log(`${checks - failures.length}/${checks} pass` +
      (NOCAP ? '   [control: --no-band-cap]' : NOSCRUB ? '   [lane: --no-scrub]'
        : PROVE ? '   [control: --prove-escape]' : ''));
    process.exit(1);
  }
  console.log(`${checks}/${checks} pass` +
    (NOCAP ? '   [control: --no-band-cap]' : NOSCRUB ? '   [lane: --no-scrub — the page is the second guard]'
      : PROVE ? '   [control: --prove-escape]' : ''));
})().catch((e) => { console.error('\nHARNESS CRASH:', e && e.stack || e); process.exit(2); });
