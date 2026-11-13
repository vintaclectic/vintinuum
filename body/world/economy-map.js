/*
 * WORLD-SPEC Phase 2 viewer: the persistent economy clock and 64×64 parcel map.
 * The API owns state; this file is deliberately a read-only window into it.
 *
 * QWYN8PW (Phase 6 item 4) adds WORLD_SPEC §8's COST PANEL — "tokens today,
 * spend per agent, top spenders" — as a SECTION INSIDE this already-positioned,
 * already-width-capped, opt-in panel.
 *
 * WHY INSIDE, and not a panel of its own (No-Collision Law): world.html's
 * right rail is fully spoken for — #topctl at top:52px+, #worldClock at 160px,
 * this panel at 214px — and on a phone #topctl becomes a ROW of 46px pills
 * right-aligned above the dock. MEASURED from the stylesheet: a FOURTH pill
 * would make that row 4*46 + 3*8 = 208px wide, and in the short-landscape rule
 * (world.html line ~633) #topctl's right offset is already
 * max(10px,safe-area) + 116px — so 116 + 10 + 208 = 334px, which OVERFLOWS a
 * 320px viewport. A new button was therefore the one shape that could not be
 * made collision-free. Reusing the map's button and box adds ZERO new fixed
 * element, ZERO new rail slot and ZERO new button — the same "collision-proof
 * by reuse" move the citizen feed made on #feed. The box's growth is contained
 * by #worldMapPanel's own max-height + overflow-y:auto (world.html), so the
 * ledger can never push the panel past the viewport.
 */
(function () {
  'use strict';
  // ── WHERE THE BRAIN IS (task 3WCDCFV) ────────────────────────────────────
  // This read `window.VINT_API_BASE || ''`. NOTHING sets VINT_API_BASE — every
  // other module that mentions it says so in a comment, "legacy, never set" —
  // so this resolved to '' and every story/folk/clock read went to the PAGE's
  // own origin. MEASURED 2026-11-13 on the live site: the band requested
  // `https://vintinuum.com/api/world/timeline?days=7&per_day=5` and got 404
  // from GitHub Pages, which has no API, so it rendered "The history is
  // unreachable." immediately and forever. wdDays 0, folkBtns 0, note
  // "unreachable" — the Phase 8 story layer could never have worked in public.
  //
  // It passed every local and harness check because both hide the defect:
  // served from the API host, '' happens to be right, and
  // scripts/collision-world-story-9SABEEP.js intercepts by PATH
  // (`u.includes('/api/world/timeline')`) before it ever looks at the host, so
  // a wrong host is invisible to it. The live page was the only thing that
  // could catch this, which is why the phase's acceptance demands it.
  //
  // body/api_base.js is loaded by world.html at line 957, before this module
  // at 1301, and is the single source of truth: it sets
  // __VINTINUUM_API_BASE to localhost:8767 on localhost and to the production
  // brain everywhere else, honouring ?api= for power users. So read THAT, the
  // same canonical global altar.html / stream.html / body-v2.html read, and
  // keep the production default as a floor in case api_base.js ever fails to
  // load. VINT_API_BASE stays as a second chance purely so an existing
  // override cannot stop working.
  var API = (window.__VINTINUUM_API_BASE || window.VINT_API_BASE ||
             'https://api.vintaclectic.com').replace(/\/$/, '');
  var clock = document.createElement('div');
  clock.id = 'worldClock';
  clock.setAttribute('aria-live', 'polite');
  clock.textContent = 'world · tick —';
  document.body.appendChild(clock);

  // HNER9E3: the short right rail ends at the doorway's RESTING top, not
  // its animated rect. Clock first, then the Begin pill above it (12px gutters).
  // Only short screens need this extra obstacle; registering it everywhere
  // would needlessly haul the desktop pill up to the top of the page.
  var doorway = document.getElementById('invite');
  var clockAvoided = false;
  function fitClock() {
    var short = window.innerHeight <= 430;
    var shown = doorway && !doorway.hidden && !doorway.classList.contains('min') &&
      getComputedStyle(doorway).display !== 'none' && getComputedStyle(doorway).visibility !== 'hidden';
    var oldTop = clock.style.top;
    var nextTop = '';
    if (short && shown) {
      var ds = getComputedStyle(doorway);
      var floor = window.innerHeight - (parseFloat(ds.bottom) || 0) - doorway.offsetHeight - 12;
      nextTop = Math.max(12, Math.min(160, floor - clock.offsetHeight)) + 'px';
    }
    if (oldTop !== nextTop) clock.style.top = nextTop;
    var avoid = !!(short && shown);
    if (window.VintDock && avoid !== clockAvoided) {
      if (avoid) window.VintDock.avoid(clock, { corner: 'br' });
      else if (window.VintDock.unavoid) window.VintDock.unavoid(clock);
      clockAvoided = avoid;
    }
    if (oldTop !== nextTop && window.VintDock) window.VintDock.reflow();
  }
  if (doorway) {
    new MutationObserver(fitClock).observe(doorway, {
      attributes: true, attributeFilter: ['class', 'style', 'hidden']
    });
    if (window.ResizeObserver) {
      var clockSizer = new ResizeObserver(fitClock);
      clockSizer.observe(doorway);
      clockSizer.observe(clock);
    }
  }
  window.addEventListener('resize', fitClock);
  fitClock();

  var mapButton = document.createElement('button');
  mapButton.id = 'worldMapButton';
  mapButton.type = 'button';
  mapButton.textContent = '🗺 map';
  mapButton.title = 'Map, history timeline, Gazette and citizen profiles';
  mapButton.setAttribute('aria-label', 'Open map, history and citizen profiles');
  mapButton.setAttribute('aria-expanded', 'false');
  mapButton.setAttribute('aria-controls', 'worldMapPanel');
  var top = document.getElementById('topctl');
  if (top) top.appendChild(mapButton);

  var panel = document.createElement('section');
  panel.id = 'worldMapPanel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'World map, history and citizen profiles');
  // THE READER'S OWN WAY OUT (EF3CRMF). While body.vw-map-reading is set this
  // panel has hidden #dvRail, and its only other dismissal is #topctl's 🗺 pill:
  // the click handler at the foot of this file is the single toggle — there is
  // no Escape path and no outside-click path. A surface that stands the
  // navigation down has to carry its own exit, and it cannot borrow the rail's,
  // so the head gains a ✕. MEASURED at 375x667, this panel's own box can reach
  // y521 while #topctl's pills sit at y489..535 and #topctl is z-index 6 against
  // this panel's 7 — so the 🗺 pill is not reliably clear of the very panel it
  // closes. It is a FLOW child of the existing flex row (no position:absolute
  // inside this panel, ever), and world.html paints it only while the rail is
  // actually stood down, so no viewport that keeps its rail changes shape.
  panel.innerHTML = '<div class="world-map-head"><strong>the land</strong><span id="worldMapMeta">64 × 64</span><button type="button" class="wmp-close" id="worldMapClose" aria-label="Close the map, history and citizen profiles" title="Close">✕</button></div>' +
    '<canvas id="worldMapCanvas" width="512" height="512" aria-label="64 by 64 parcel terrain map"></canvas>' +
    '<div class="world-map-legend"><span><i class="terrain-f"></i>flat</span><span><i class="terrain-e"></i>fertile</span><span><i class="terrain-o"></i>forest</span><span><i class="terrain-r"></i>ore</span><span><i class="terrain-w"></i>water</span></div>' +
    '<div class="world-cost" id="worldCost">' +
      '<div class="world-cost-head"><strong>the ledger</strong><span id="worldCostDay">today</span></div>' +
      '<div class="world-cost-row"><span>tokens today</span><b id="worldCostTokens">—</b></div>' +
      '<div class="world-cost-bar"><i id="worldCostFill"></i></div>' +
      '<div class="world-cost-sub" id="worldCostSub">top spenders</div>' +
      '<ol class="world-cost-top" id="worldCostTop"></ol>' +
    '</div>' +
    // ── 9SABEEP (Phase 8 items 2+3) — THE STORY LAYER ──────────────────────
    // Two <details> sections, COLLAPSED by default, inside this same box. See
    // the CSS block in world.html for why they live here and not behind a new
    // #topctl pill (QWYN8PW measured that a fourth pill overflows 320px).
    // Each body is max-height + overflow-y:auto, so an open section grows
    // INWARD and can never evict the canvas or the ledger above it.
    '<details class="world-disc" id="worldStory">' +
      '<summary><strong>the story</strong><span class="wd-note" id="worldStoryNote">what happened</span></summary>' +
      '<div class="wd-body" id="worldStoryBody"></div>' +
    '</details>' +
    '<details class="world-disc" id="worldFolk">' +
      '<summary><strong>the folk</strong><span class="wd-note" id="worldFolkNote">who is here</span></summary>' +
      '<div class="wd-body" id="worldFolkBody"></div>' +
    '</details>';
  document.body.appendChild(panel);
  var canvas = panel.querySelector('canvas');
  var ctx = canvas.getContext('2d');
  var colors = { f: '#92785d', e: '#a9a76a', o: '#4d755d', r: '#967070', w: '#4c7190' };
  function draw(grid) {
    if (!grid || !grid.terrain || !ctx) return;
    var w = Number(grid.w) || 64, h = Number(grid.h) || 64;
    var sx = canvas.width / w, sy = canvas.height / h;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      ctx.fillStyle = colors[grid.terrain[y * w + x]] || colors.f;
      ctx.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
    }
    (grid.claims || []).forEach(function (claim) {
      ctx.fillStyle = '#f4c79a';
      ctx.fillRect(claim.x * sx + sx * .25, claim.y * sy + sy * .25, sx * .5, sy * .5);
    });
    var meta = document.getElementById('worldMapMeta');
    if (meta) meta.textContent = w + ' × ' + h + ' · ' + (grid.claims || []).length + ' claimed';
  }
  // ── A HUNG REQUEST IS THE EDGE'S REAL FAILURE MODE (task 3WCDCFV) ────────
  // This page is served from vintinuum.com and reads api.vintaclectic.com
  // through a cloudflared named tunnel whose individual edge connections
  // cycle. MEASURED 2026-11-13 09:0xZ, three identical requests back to back
  // from this box: attempt 1 `code=000 t=30.016s` (no response at all),
  // attempts 2 and 3 `200` in 0.62s and 1.51s, CORS correct on every one.
  // So the failure is not an error status — it is SILENCE.
  //
  // fetch() without a signal waits forever on that silence: it never resolves
  // and never rejects, so the 20s poll below simply stacked more hung sockets
  // and the band sat empty indefinitely. MEASURED: the live story band never
  // rendered a .wd-day inside 60s while `requestfailed` stayed EMPTY — a hung
  // socket raises no event, which is exactly why this looked like nothing
  // happening rather than like a failure.
  //
  // So every read is bounded well under the poll interval: a hung attempt is
  // abandoned at 8s and the next poll gets a fresh chance, on what is usually
  // a different edge connection. The brain itself answers localhost in
  // 0.3-1.7s for these same URLs, so 8s accuses nobody slow.
  var READ_TIMEOUT_MS = 8000;
  function get(path) {
    // AbortController, not AbortSignal.timeout(), so this still bounds the
    // read on older mobile browsers that never shipped the static helper.
    var ctl = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, READ_TIMEOUT_MS) : null;
    var opts = { cache: 'no-store' };
    if (ctl) opts.signal = ctl.signal;
    return fetch(API + path, opts).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('world api ' + r.status);
      return r.json();
    }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }
  function refreshClock() {
    get('/api/world/health').then(function (data) {
      clock.textContent = 'world · tick ' + (data.economy_tick == null ? '—' : data.economy_tick);
      clock.dataset.tick = String(data.economy_tick == null ? '' : data.economy_tick);
    }).catch(function () { clock.textContent = 'world · sleeping'; });
  }
  // ── THE PANEL'S OWN FLOOR (QWYN8PW) ──────────────────────────────────────
  // MEASURED at HEAD, with the panel OPEN, before this change (the --baseline
  // run of scripts/collision-world-cost-QWYN8PW.js):
  //     320x568  worldMapPanel x vint-vc-fab 48x56, x vwg-pill 97x44,
  //              x dvToast 280x39, x vintVoice 36x44, invite x panel 280x228
  //     375x667  invite x panel 280x74,  panel x vwg-pill 97x44
  //     740x360  panel x vwg-pill 97x44, invite x panel 176x138
  //     1280x800 panel x vwg-pill 97x11
  // So this box was ALREADY colliding with the bottom-right furniture — it was
  // never audited open, because it is opt-in. A ledger that makes it TALLER
  // would have made every one of those worse, and the No-Collision Law does not
  // accept "no worse than before" either. The fix is for the PANEL to yield:
  //
  //   the panel's floor = the top edge of the highest visible fixed element
  //   that sits below the panel's top and overlaps it horizontally, minus a
  //   gutter.
  //
  // THE PANEL YIELDS, NEVER THE FLOATS. The alternative — teaching #vwg-pill to
  // dodge this panel — walks the pill UP a 419px-tall rail into #worldClock and
  // #editHeadBtn: a chase with no resting height. Obstacle-avoidance is for a
  // bounded sheet, not for a tall column. The panel is the transient, opt-in
  // thing here, so it is the thing that fits itself into the free space.
  //
  var FLOOR_GUTTER = 12;
  // J3EASMR: preserve the direct-obstacle predicate, but separate hidden
  // elements from transparent wrappers. Only the latter may offer children.
  // At 375x667 #topctl's three painted buttons start at y489; ignoring this
  // transparent wrapper let the panel reach y540 and cover its own toggle.
  // Opacity is not inherited: children of an opacity:0 parent still report 1.
  // Descending through hidden .vc-panel would also break the landscape band.
  function shownEl(el, cs) {
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity) === 0) return false;
    return true;
  }
  function paintsEl(el, cs) {
    var ownText = Array.prototype.filter.call(el.childNodes, function (n) { return n.nodeType === 3; })
      .map(function (n) { return n.nodeValue; }).join('').trim();
    if (cs.backgroundColor === 'rgba(0, 0, 0, 0)' && cs.backgroundImage === 'none' &&
        cs.borderStyle === 'none' && cs.boxShadow === 'none' && !ownText) return false;
    var r = el.getBoundingClientRect();
    if (r.width <= 12 && r.height <= 12 && cs.pointerEvents === 'none' &&
        !el.children.length && !el.textContent.trim()) return false;
    var blur = /blur\(\s*([\d.]+)px/.exec(cs.filter);
    var faint = parseFloat(cs.opacity) <= 0.15;
    var behind = (parseInt(cs.zIndex, 10) || 0) <= 0;
    if (cs.pointerEvents === 'none' && behind && !el.textContent.trim() &&
        ((blur && parseFloat(blur[1]) >= 20) || faint)) return false;
    return true;
  }
  function visibleObstacle(el, cs) {
    return shownEl(el, cs) && paintsEl(el, cs);
  }
  // The candidate scan is the EXPENSIVE half (getComputedStyle over every node
  // in the document — measured ~1,500 elements on world.html), so it runs on the
  // SLOW beat and the fast settling tail only re-reads the candidates' rects.
  // Sweeping the whole document every 60ms starved the main thread badly enough
  // that the ledger's own fetch callbacks ran a full state late in the harness —
  // the panel was correct and looked broken.
  // #dvRail is deliberately excluded: its launchers leave only 80px free at
  // 375x667, below MIN_USABLE 150. EF3CRMF instead yields the rail to the
  // reader through body.vw-map-reading (see railOverReader below).
  var NO_DESCENT = { dvRail: 1 };
  // At desktop sizes #topctl ends at y214. Counting it restores the existing
  // 12px gutter: the panel starts at 226, rather than touching the toggle.
  // Current included wrappers offer at most three children. Bound the number
  // of retained children; overflow stands the panel down until the next scan.
  // A host rect is not a safe fallback: positioned children can escape it.
  var DESCENT_CAP = 12;
  function descendInto(host, out, vw, vh) {
    var kids = host.children, keep = [];
    for (var k = 0; k < kids.length; k++) {
      var kid = kids[k];
      if (kid === panel || panel.contains(kid)) continue;
      var ks = getComputedStyle(kid);
      if (!shownEl(kid, ks) || !paintsEl(kid, ks)) continue;
      var kr = kid.getBoundingClientRect();
      if (kr.width <= 0 || kr.height <= 0) continue;
      if (kr.width >= vw * 0.9 && kr.height >= vh * 0.9) continue;
      if (keep.length >= DESCENT_CAP) { out.push({ el: host, host: null, overflow: true }); return; }
      keep.push(kid);
    }
    for (var j = 0; j < keep.length; j++) out.push({ el: keep[j], host: host, overflow: false });
  }
  // Retain the wrapper so fast band updates can re-check its visibility:
  // opacity changes on a parent are invisible to its children's computed style.
  var _cands = [];
  function scanObstacles() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var out = [];
    var all = document.querySelectorAll('body *');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el === panel || panel.contains(el)) continue;
      var cs = getComputedStyle(el);
      if (cs.position !== 'fixed') continue;
      if (!shownEl(el, cs)) continue;          // hidden: it AND its children are out
      if (!paintsEl(el, cs)) {                 // a transparent wrapper...
        if (!NO_DESCENT[el.id]) descendInto(el, out, vw, vh);   // ...its children are the paint
        continue;
      }
      var r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      // a full-bleed backdrop (#stage, #veil) is scenery, not furniture
      if (r.width >= vw * 0.9 && r.height >= vh * 0.9) continue;
      out.push({ el: el, host: null, overflow: false });
    }
    _cands = out;
    return out;
  }
  // THE BAND, both edges. An obstacle BELOW the panel's anchor sets its FLOOR;
  // one that reaches DOWN ACROSS the anchor from above sets its CEILING, and the
  // panel starts under it instead. The second half is not theoretical: with the
  // guest doorway dismissed at 375x667 the world HUD grows downward past the
  // anchor, and a floor-only rule left worldMapPanel x vintWorldHud 161x9 —
  // caught by the doorway-dismissed lane of the harness.
  //
  // The partition is taken against the CSS-DECLARED anchor (--wmp-base), never
  // against the panel's live rect: the live top is what this function WRITES, so
  // reading it back would be a feedback loop (and it is zero whenever the panel
  // is hidden).
  function panelBand() {
    var vh = window.innerHeight;
    var base = parseFloat(getComputedStyle(panel).getPropertyValue('--wmp-base')) || 214;
    var pr = panel.getBoundingClientRect();        // width/left do not depend on top
    var ceil = base, floor = vh - FLOOR_GUTTER;
    for (var i = 0; i < _cands.length; i++) {
      var el = _cands[i].el, host = _cands[i].host;
      if (!el.isConnected) continue;
      var cs = getComputedStyle(el);
      if (_cands[i].overflow) {
        if (shownEl(el, cs)) return { top: base, floor: base };
        continue;
      }
      if (!visibleObstacle(el, cs)) continue;  // it may have faded out
      // ...and so may the wrapper it was reached through, invisibly to it
      // (opacity is not inherited — see _cands above).
      if (host && (!host.isConnected || !shownEl(host, getComputedStyle(host)))) continue;
      var r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.right <= pr.left + 1 || r.left >= pr.right - 1) continue;   // other columns
      if (r.bottom <= base) {
        // entirely above the anchor — only matters if it reaches the anchor
        if (r.bottom + FLOOR_GUTTER > ceil) ceil = r.bottom + FLOOR_GUTTER;
      } else if (r.top >= base) {
        if (r.top - FLOOR_GUTTER < floor) floor = r.top - FLOOR_GUTTER;
      } else {
        // straddles the anchor: the panel must start BELOW it
        if (r.bottom + FLOOR_GUTTER > ceil) ceil = r.bottom + FLOOR_GUTTER;
      }
    }
    return { top: Math.round(ceil), floor: Math.round(floor) };
  }
  // THE STAND-DOWN. On a short viewport the guest doorway (#invite, a bottom
  // sheet up to 288px tall) starts ABOVE this panel's top, so there is no floor
  // to yield to and no room to rise into: at 740x360 they genuinely cannot both
  // be on screen. world.html already has the law for that case — "two that both
  // want the band never share it; the transient one wins and the ambient one
  // stands down" (body.vw-doorway #feed). So when the measured room is below
  // what the box can usably hold, the panel stands down rather than overlap.
  // It is NOT a dead control: the moment the doorway is dismissed (one tap, and
  // the thing a guest does anyway) the next measurement brings the panel back,
  // because `hidden` was never set — only the stand-down flag.
  // DECISION (QWYN8PW): stand down rather than overlap. Reversible: delete the
  // [data-standdown] rule in world.html and this flag.
  //
  // THE STAND-DOWN HIDES WITH visibility, NEVER display. MEASURED: with
  // `display:none` the stood-down panel's getBoundingClientRect() reads all
  // zeros, so the very next measurement computed room from top=0, found plenty,
  // cleared the flag, and the box came back — an 80ms flip-flop that the
  // collision probe caught mid-flash (320x568 panel 30px tall with a nonsense
  // 238px floor, overlapping #vint-vc-fab 48x30). `visibility:hidden` keeps the
  // layout box, so the measurement stays correct and the decision is stable —
  // and the collision probe's own `visible()` predicate already excludes a
  // visibility:hidden element, so a stood-down panel is in nobody's way.
  var MIN_USABLE = 150;
  function fitPanel() {
    var band = panelBand();
    var raw = band.floor, top = band.top;
    var room = raw - top;
    panel.style.setProperty('--wmp-top', top + 'px');
    if (room < MIN_USABLE) {
      panel.dataset.standdown = '1';
      mapButton.setAttribute('aria-expanded', 'false');
    } else {
      delete panel.dataset.standdown;
      if (!panel.hidden) mapButton.setAttribute('aria-expanded', 'true');
    }
    // The phone rail wraps into this panel's column. The transient reader wins
    // while visible; keep the rail's layout box so its sizing does not oscillate.
    //
    // AND IT ASKS THE RECTS, NOT THE VIEWPORT (EF3CRMF). This landed keyed on
    // `room >= MIN_USABLE` plus an `@media (max-width:768px)` wrapper on the rule
    // in world.html, which is a proxy for "the rail wraps into this column" and
    // is wrong on both sides of it. MEASURED, panel open and both story bands
    // open, counting the rail's launchers whose own rects fall inside this
    // panel's box:
    //     320x568   2  (panel already stands down, so the flag is off anyway)
    //     375x667  17  <- the 13 reds of collision-world-story-9SABEEP.js
    //     393x852  10  <- the same burial, latent: the harness's probe points miss it
    //     740x360   0
    //     768x1024  0
    //     1280x800  0
    //     1920x1080 0
    // So the breakpoint hid the ENTIRE launcher rail at 740x360 and 768x1024
    // with nothing to justify it — the rail is the only way to reach sixteen
    // other surfaces, and standing it down where it collides with nothing is a
    // reachability cost paid for no collision. railOverRreader() below asks the
    // one question that actually matters, so the decision is taken from the
    // geometry at every viewport and the rule in world.html needs no breakpoint.
    document.body.classList.toggle('vw-map-reading',
      !panel.hidden && room >= MIN_USABLE && railOverReader());
    // The floor is published RAW: clamping it up to top+MIN_USABLE would let a
    // visible box reach past its floor, and the short case is already answered
    // by the stand-down above (room < MIN_USABLE is exactly raw < top+MIN_USABLE,
    // so the two can never disagree).
    panel.style.setProperty('--wmp-floor', raw + 'px');
  }
  // ── DOES THE RAIL ACTUALLY REACH THIS PANEL? (EF3CRMF) ───────────────────
  // #dvRail is deliberately NOT in the obstacle set above — it is named in
  // NO_DESCENT, and the arithmetic backs it: with the rail counted, the
  // largest free gap left in this panel's column at 375x667 is 80px against
  // MIN_USABLE 150 (hud 64..128, rail 178..412, vwg-pill 492..536, dvToast
  // 552..591, invite 593..659), so the map, the ledger and the story would stand
  // down permanently on a phone. Nor can the two sit side by side: clearing a
  // 290px wrapped rail leaves this panel 133px of a 375px viewport and it needs
  // 280. One of them must own the band, and the page's own law says which — the
  // transient surface wins and the ambient furniture stands down.
  //
  // What that law still needs is the WHEN, and only the rects can answer it: the
  // rail's width swings with how many launchers have mounted and whether it has
  // wrapped (MEASURED at 375x667 across runs: 202px, 214px and 290px wide), so
  // no breakpoint describes it.
  //
  // IT READS GEOMETRY, NEVER VISIBILITY, AND THAT IS LOAD-BEARING. The rule this
  // feeds hides the rail with `visibility`, which leaves every rect exactly where
  // it was — deliberately, so the rail's own sizing cannot oscillate. Reading
  // `visibility` (or `opacity`) back would therefore be a feedback loop: hidden
  // launchers would score as absent, the flag would clear, the rail would
  // repaint, the overlap would return, and the flag would be set again — the same
  // flip-flop the stand-down comment above records for display:none.
  // `display:none` is still honoured, because it collapses the rect to zero and
  // the size test below rejects that.
  function railOverReader() {
    var rail = document.getElementById('dvRail');
    if (!rail) return false;
    var pr = panel.getBoundingClientRect();
    if (pr.width <= 0 || pr.height <= 0) return false;
    var kids = rail.querySelectorAll('.dv-launch');
    for (var i = 0; i < kids.length; i++) {
      if (getComputedStyle(kids[i]).display === 'none') continue;
      var r = kids[i].getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;              // not mounted yet
      if (r.right <= pr.left + 1 || r.left >= pr.right - 1) continue;
      if (r.bottom <= pr.top + 1 || r.top >= pr.bottom - 1) continue;
      return true;
    }
    return false;
  }
  var fitTimer = null, fitTail = 0;
  // Obstacles MOVE: #invite rises over 0.8s (getting taller as it goes) and a
  // toast can appear while the panel is open — so one measurement at open time
  // is not enough. A short fast tail catches the rise, then a slow beat holds it
  // true, and both stop dead when the panel closes. Bounded: ~10 rect reads,
  // only while a human has the panel open.
  //
  // RE-SCANNING, not just re-reading (RCNFBGS). The fast tail re-reads the
  // rects of obstacles ALREADY in _cands, which tracks #invite GROWING once it
  // is a candidate. But an obstacle that is display:none / not-yet-in-DOM at
  // open (the guest doorway animating up a beat after the panel opens) is in
  // NOBODY's rect list until the next scanObstacles — and before RCNFBGS the
  // landscape panel always stood down (--wmp-base 214 left <150px), so that gap
  // never mattered. Now that the landscape panel RENDERS, a doorway that appears
  // after open must be caught before it rises INTO the panel. MEASURED: the
  // 740x360 'empty' state opened the panel at floor 348 (doorway not yet a
  // candidate) and the doorway then rose into it — invite×worldMapPanel 260x166.
  // So the tail now RE-SCANS on a coarse cadence (every ~400ms, 4 extra sweeps
  // over the 1.6s tail — far below the every-80ms sweep that once starved the
  // thread) so a late-appearing doorway or toast becomes a floor within 400ms.
  function fitting(on) {
    if (fitTimer) { clearInterval(fitTimer); fitTimer = null; }
    if (!on) { document.body.classList.remove('vw-map-reading'); return; }
    fitTail = 0;
    scanObstacles();
    fitPanel();
    fitTimer = setInterval(function () {
      if (fitTail % 5 === 0) scanObstacles();  // ~every 400ms: catch a late doorway/toast
      fitPanel();                              // cheap: candidate rects only
      if (++fitTail === 20) {                   // ~1.6s of fast settling...
        clearInterval(fitTimer);
        // ...then a slow beat that RE-SCANS, so a toast or sheet that appears
        // while the panel is open becomes a floor too.
        fitTimer = setInterval(function () { scanObstacles(); fitPanel(); }, 700);
      }
    }, 80);
  }
  function refit() { if (!panel.hidden) { scanObstacles(); fitPanel(); } }
  window.addEventListener('resize', refit);
  window.addEventListener('orientationchange', refit);
  // Toasts reserve a row immediately. Measure after the dock's mutation-driven
  // frame callback, before paint, rather than letting the 700ms beat catch up.
  window.addEventListener('vint:world-toast', function () {
    Promise.resolve().then(function () { requestAnimationFrame(refit); });
  });
  // The ledger is the one thing that changes this box's height from inside, so
  // re-fit right after it renders.
  window.__vwCostFit = refit;

  // ── §8 COST PANEL ─────────────────────────────────────────────────────────
  // Read-only, and polled ONLY while the panel is open: a closed panel costs the
  // brain nothing (the clock already polls on its own 15s beat).
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function num(n) { return (Number(n) || 0).toLocaleString('en-US'); }
  function renderCost(c) {
    var tokEl = document.getElementById('worldCostTokens');
    var fill = document.getElementById('worldCostFill');
    var dayEl = document.getElementById('worldCostDay');
    var topEl = document.getElementById('worldCostTop');
    var subEl = document.getElementById('worldCostSub');
    if (!tokEl || !topEl) return;
    if (!c) {
      tokEl.textContent = '—';
      if (fill) fill.style.width = '0%';
      topEl.innerHTML = '';
      if (subEl) subEl.textContent = 'ledger unavailable';
      return;
    }
    tokEl.textContent = num(c.tokens_today) + ' / ' + num(c.token_budget);
    if (dayEl) dayEl.textContent = esc(c.day || 'today');
    if (fill) fill.style.width = Math.max(0, Math.min(100, Number(c.pct_display) || 0)) + '%';
    var top = (c.per_agent || c.top_spenders || []).slice().sort(function (a, b) { return (Number(b.tokens) || 0) - (Number(a.tokens) || 0); });
    // The honest empty state: nobody has spent yet is NOT an error, and the
    // unattributed line is shown rather than implying the breakdown is complete
    // (a spend recorded with no agent id — the voice lane — has no row).
    if (subEl) {
      subEl.textContent = top.length
        ? ('spend per agent · highest first · ' + c.agents_active + (c.agents_active === 1 ? ' agent' : ' agents'))
        : (Number(c.tokens_today) > 0 ? 'spent, not yet attributed' : 'no spend yet today');
    }
    topEl.innerHTML = top.map(function (a) {
      return '<li><span class="wc-who">' + esc(a.name) + '</span>' +
             '<span class="wc-tok">' + num(a.tokens) + '</span>' +
             '<span class="wc-turns">' + num(a.turns) + (Number(a.turns) === 1 ? ' turn' : ' turns') + '</span></li>';
    }).join('') + (Number(c.unattributed_tokens) > 0
      ? '<li class="wc-rest"><span class="wc-who">unattributed</span><span class="wc-tok">' +
        num(c.unattributed_tokens) + '</span><span class="wc-turns">voice lane</span></li>'
      : '');
  }
  var costTimer = null;
  function refreshCost() {
    return get('/api/world/cost')
      .then(renderCost)
      .catch(function () { renderCost(null); })
      .then(function () { if (window.__vwCostFit) window.__vwCostFit(); });
  }
  function costPolling(on) {
    if (costTimer) { clearInterval(costTimer); costTimer = null; }
    if (on) { refreshCost(); costTimer = setInterval(refreshCost, 15000); }
  }

  /* ── 9SABEEP (Phase 8) — THE HISTORY TIMELINE and THE AGENT PROFILES ───────
     Read-only windows onto /api/world/timeline and /api/world/agents. Polled
     ONLY while their own disclosure is OPEN — a closed section costs the brain
     nothing, which is the same discipline the ledger section already follows.

     EVERY string from the API is inserted with textContent or through esc(),
     never as raw HTML. The API's own scrubber (world-gazette.scrubText) has
     already replaced < > " in citizen text with look-alikes, so this is the
     SECOND of two independent guards, not the only one.
  ─────────────────────────────────────────────────────────────────────────── */
  var story = document.getElementById('worldStory');
  var folk = document.getElementById('worldFolk');
  var pickedAgent = null, profileRequest = 0;

  function plural(n, one, many) { return (Number(n) === 1 ? one : many); }

  function renderStory(t) {
    var body = document.getElementById('worldStoryBody');
    var note = document.getElementById('worldStoryNote');
    if (!body) return;
    if (!t || !Array.isArray(t.days) || !t.days.length) {
      body.innerHTML = '<p class="wd-empty">' +
        (t ? 'Nothing has happened yet. The clock is running.' : 'The history is unreachable.') + '</p>';
      if (note) note.textContent = t ? 'no days yet' : 'unreachable';
      if (window.__vwCostFit) window.__vwCostFit();
      return;
    }
    if (note) note.textContent = t.days.length + ' ' + plural(t.days.length, 'day', 'days') +
      ' · tick ' + num(t.tick);
    body.innerHTML = t.days.map(function (d) {
      var head = '<div class="wd-day-head"><b>' +
        (d.is_today ? 'today' : Number(d.day) === Number(t.today) - 1 ? 'yesterday' : 'day ' + num(d.day)) + '</b>' +
        '<span>hours ' + num(d.from_tick) + '–' + num(d.to_tick) + ' · ' +
        num(d.events_total) + ' recorded</span></div>';
      // The gazette's own headline when the paper has been printed, so the
      // timeline never tells a different story about a day than the paper does.
      var lead = d.headline
        ? '<div class="wd-day-lead">' + esc(d.headline) + '</div>'
        : (d.is_today ? '<div class="wd-day-lead" style="opacity:.5">still happening</div>' : '');
      var beats = (d.beats || []).map(function (b) {
        return '<li data-kind="' + esc(b.kind) + '">' +
          '<span class="wd-hr">' + num(b.hour) + 'h</span>' +
          '<span class="wd-txt">' + esc(b.text) + '</span></li>';
      }).join('');
      var more = (Number(d.beats_total) || 0) > (Number(d.beats_shown) || 0)
        ? '<li><span class="wd-hr"></span><span class="wd-txt" style="opacity:.45">and ' +
          num(d.beats_total - d.beats_shown) + ' more</span></li>' : '';
      // The PAPER is one tap away from the day it belongs to. Absolute, because
      // /uw/... is served by the brain's origin, not by this static page.
      var paper = d.gazette_url
        ? '<a class="wd-paper" href="' + esc(API + d.gazette_url) + '" target="_blank" rel="noopener">' +
          'read the Gazette for this day' + (d.gazette_words ? ' · ' + num(d.gazette_words) + ' words' : '') + '</a>'
        : '';
      return '<div class="wd-day">' + head + lead +
        (beats ? '<ul class="wd-beats">' + beats + more + '</ul>'
               : '<p class="wd-empty">nothing the world thought worth writing down</p>') +
        paper + '</div>';
    }).join('');
    if (window.__vwCostFit) window.__vwCostFit();
  }

  function renderFolk(list) {
    var body = document.getElementById('worldFolkBody');
    var note = document.getElementById('worldFolkNote');
    if (!body) return;
    var agents = (list && list.agents) || [];
    if (!agents.length) {
      body.innerHTML = '<p class="wd-empty">' + (list ? 'Nobody is registered yet.' : 'The registry is unreachable.') + '</p>';
      if (note) note.textContent = list ? 'empty' : 'unreachable';
      // The box's height just changed from inside, so re-measure the floor —
      // every other render path here does, and this early return was the one
      // that skipped it (a stale floor is how the panel keeps a measurement
      // taken for a taller box).
      if (window.__vwCostFit) window.__vwCostFit();
      return;
    }
    if (note) note.textContent = agents.length + ' ' + plural(agents.length, 'citizen', 'citizens');
    body.innerHTML = '<div id="worldProfile" aria-live="polite"></div><ul class="wd-folk">' + agents.map(function (a) {
      var where = (a.x != null && a.y != null) ? '(' + num(a.x) + ',' + num(a.y) + ')' : 'nowhere yet';
      return '<li><button type="button" data-agent="' + esc(a.id) + '" ' +
        'aria-pressed="' + (pickedAgent === a.id ? 'true' : 'false') + '">' +
        '<span class="wd-who">' + esc(a.name) + (a.active ? '' : ' †') + '</span>' +
        '<span class="wd-coin">' + num(a.wallet_cached) + '</span>' +
        '<span class="wd-sub">' + where + ' · acted at tick ' + num(a.last_acted_tick) +
        (a.talents && a.talents.length ? ' · ' + esc(a.talents.join(', ')) : '') +
        '</span></button></li>';
    }).join('') + '</ul>';
    if (pickedAgent) loadProfile(pickedAgent);
    if (window.__vwCostFit) window.__vwCostFit();
  }

  function renderProfile(p) {
    var host = document.getElementById('worldProfile');
    if (!host) return;
    if (!p) { host.innerHTML = '<p class="wd-empty">that profile is unreachable</p>'; return; }
    var w = p.wallet || {};
    var rel = p.relationships || {};
    var rows = [];
    rows.push(['wallet', num(w.balance)]);
    // The DRIFT between the journal and the cached column is SHOWN, never
    // hidden: it is the one number on this page that can only be a bug.
    if (Number(w.drift)) rows.push(['cache drift', '<span class="wd-drift">' + num(w.drift) + '</span>']);
    rows.push(['earned · spent', num(w.lifetime_earned) + ' · ' + num(w.lifetime_spent)]);
    rows.push(['reputation', num(p.reputation)]);
    rows.push(['deeds', num(p.deeds)]);
    if (p.parcel) rows.push(['stands on', '(' + num(p.parcel.x) + ',' + num(p.parcel.y) + ')' +
      (p.parcel.terrain ? ' ' + esc(p.parcel.terrain) : '')]);
    if (p.inventory && p.inventory.length) {
      rows.push(['carries', p.inventory.map(function (i) { return num(i.qty) + ' ' + esc(i.good); }).join(', ')]);
    }
    if (p.death) rows.push(['died', esc(p.death.cause) + ' · tick ' + num(p.death.died_tick)]);

    var peers = (rel.peers || []).map(function (x) {
      var ev = [];
      if (x.parts) {
        if (x.parts.contracts) ev.push(x.parts.contracts + ' ' + plural(x.parts.contracts, 'deal', 'deals'));
        if (x.parts.transfers) ev.push(x.parts.transfers + ' ' + plural(x.parts.transfers, 'payment', 'payments'));
        if (x.parts.orgs) ev.push('same org');
        if (x.parts.wars) ev.push('fought beside');
        if (x.parts.crimes) ev.push(x.parts.crimes + ' ' + plural(x.parts.crimes, 'wrong', 'wrongs'));
      }
      return '<li><i>' + x.trust.toFixed(2) + '</i> ' + esc(x.agent_id.replace(/^citizen_/, '')) +
        (ev.length ? ' — ' + esc(ev.join(', ')) : ' — no history yet') + '</li>';
    }).join('');

    var diary = (p.diary || []).map(function (e) {
      return '<li><i>' + num(e.tick) + 'h</i> ' + esc(e.text) + '</li>';
    }).join('');

    host.innerHTML = '<div class="wd-prof">' +
      '<h4>' + esc(p.name) + (p.alive ? '' : ' — dead') + '</h4>' +
      rows.map(function (r) {
        return '<div class="wd-rowline"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>';
      }).join('') +
      (rel.orgs && rel.orgs.length
        ? '<div class="wd-lbl">bound to</div><ul class="wd-diary">' + rel.orgs.map(function (o) {
            return '<li>' + esc(o.name) + (o.is_founder ? ' (founded it)' : '') +
              ' · ' + num(o.members) + ' ' + plural(o.members, 'member', 'members') + '</li>';
          }).join('') + '</ul>' : '') +
      '<div class="wd-lbl">who they trust' +
        (rel.crimes && (rel.crimes.committed || rel.crimes.suffered)
          ? ' · wronged ' + num(rel.crimes.committed) + ', wronged by ' + num(rel.crimes.suffered) : '') +
      '</div>' +
      (peers ? '<ul class="wd-diary">' + peers + '</ul>'
             : '<p class="wd-empty">nobody yet — no deals, no payments, no shared roof</p>') +
      (rel.will ? '<div class="wd-lbl">their will</div><ul class="wd-diary"><li>everything to ' +
        esc(rel.will.kind === 'state' ? 'the state' : rel.will.beneficiary.replace(/^citizen_/, '')) +
        (rel.will.note ? ' — ' + esc(rel.will.note) : '') + '</li></ul>' : '') +
      '<div class="wd-lbl">their diary, in their own words</div>' +
      (diary ? '<ul class="wd-diary">' + diary + '</ul>'
             : '<p class="wd-empty">they have not written anything down yet</p>') +
      '</div>';
    if (window.__vwCostFit) window.__vwCostFit();
  }

  function loadProfile(id) {
    var request = ++profileRequest;
    return get('/api/world/agent/' + encodeURIComponent(id))
      .then(function (p) { if (request === profileRequest && pickedAgent === id) renderProfile(p); })
      .catch(function () { if (request === profileRequest && pickedAgent === id) renderProfile(null); });
  }

  // One delegated listener on the body, so a re-render never leaves a dead
  // handler behind and the list can be rebuilt on every poll.
  var folkBody = document.getElementById('worldFolkBody');
  if (folkBody) folkBody.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('button[data-agent]') : null;
    if (!btn) return;
    var id = btn.getAttribute('data-agent');
    pickedAgent = (pickedAgent === id) ? null : id;
    Array.prototype.forEach.call(folkBody.querySelectorAll('button[data-agent]'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-agent') === pickedAgent));
    });
    var host = document.getElementById('worldProfile');
    if (!pickedAgent) { profileRequest++; if (host) host.innerHTML = ''; if (window.__vwCostFit) window.__vwCostFit(); return; }
    if (host) host.innerHTML = '<p class="wd-empty">reading…</p>';
    folkBody.scrollTop = 0;
    loadProfile(pickedAgent);
  });

  // A FLAP MUST NOT ERASE WHAT THE READER IS ALREADY READING. renderStory(null)
  // replaces the rendered days with "The history is unreachable.", so before
  // this guard one dropped edge connection blanked a band that had been
  // correct a second earlier, and the next poll 20s later put it back —
  // a visible flicker that told the reader the world had lost its history.
  // Rendered content therefore STAYS and only the note says so; the empty
  // message is still shown when there is nothing to keep (a first load that
  // cannot reach the brain), which is the honest answer in that case.
  function keepOrEmpty(bodyId, noteId, render) {
    var b = document.getElementById(bodyId);
    if (b && b.querySelector('.wd-day, button[data-agent]')) {
      var n = document.getElementById(noteId);
      if (n) n.textContent = 'unreachable · retrying';
      return;
    }
    render(null);
  }
  function refreshStory() {
    return get('/api/world/timeline?days=7&per_day=5')
      .then(renderStory)
      .catch(function () { keepOrEmpty('worldStoryBody', 'worldStoryNote', renderStory); });
  }
  function refreshFolk() {
    return get('/api/world/agents?limit=40')
      .then(renderFolk)
      .catch(function () { keepOrEmpty('worldFolkBody', 'worldFolkNote', renderFolk); });
  }
  // A section polls only while it is OPEN. `toggle` fires on both open and
  // close, so one listener covers starting and stopping.
  function discPolling(el, on, refresh, ref) {
    if (ref.t) { clearInterval(ref.t); ref.t = null; }
    if (!on) return;
    refresh();
    ref.t = setInterval(refresh, 20000);
  }
  var storyRef = { t: null }, folkRef = { t: null };
  if (story) story.addEventListener('toggle', function () {
    discPolling(story, story.open && !panel.hidden, refreshStory, storyRef);
    // An opened band changes this box's height from inside, so re-measure the
    // floor immediately rather than waiting for the 700ms beat.
    requestAnimationFrame(refit);
  });
  if (folk) folk.addEventListener('toggle', function () {
    discPolling(folk, folk.open && !panel.hidden, refreshFolk, folkRef);
    requestAnimationFrame(refit);
  });
  // Closing the whole panel must stop both polls — a hidden panel costs nothing.
  function storyPolling(on) {
    discPolling(story, !!(on && story && story.open), refreshStory, storyRef);
    discPolling(folk, !!(on && folk && folk.open), refreshFolk, folkRef);
  }

  mapButton.addEventListener('click', function () {
    var open = !panel.hidden;
    panel.hidden = open;
    // Choosing the world is the same guest intent as 'just wandering'.
    // Reuse that existing collapse action so the welcome sheet cannot hide
    // the map/history on a small phone. The join pill remains available.
    if (!open && window.innerWidth <= 768 && doorway && !doorway.classList.contains('min')) {
      var wander = document.getElementById('inviteWander');
      if (wander) wander.click();
    }
    mapButton.setAttribute('aria-expanded', String(!open));
    if (!open) get('/api/world/parcels').then(draw).catch(function () {
      var meta = document.getElementById('worldMapMeta'); if (meta) meta.textContent = 'map unavailable';
    });
    costPolling(!open);
    storyPolling(!open);
    fitting(!open);
  });
  // The ✕ delegates to the one toggle above rather than repeating its work, so
  // the parcels fetch, the aria state, the pollers, fitting() and the
  // vw-map-reading flag can never drift between the two ways out (EF3CRMF).
  var closeBtn = document.getElementById('worldMapClose');
  if (closeBtn) closeBtn.addEventListener('click', function () { mapButton.click(); });
  refreshClock();
  setInterval(refreshClock, 15000);
}());
