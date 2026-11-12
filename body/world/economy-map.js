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
  var API = (window.VINT_API_BASE || '').replace(/\/$/, '');
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
  mapButton.setAttribute('aria-expanded', 'false');
  mapButton.setAttribute('aria-controls', 'worldMapPanel');
  var top = document.getElementById('topctl');
  if (top) top.appendChild(mapButton);

  var panel = document.createElement('section');
  panel.id = 'worldMapPanel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'World parcel map');
  panel.innerHTML = '<div class="world-map-head"><strong>the land</strong><span id="worldMapMeta">64 × 64</span></div>' +
    '<canvas id="worldMapCanvas" width="512" height="512" aria-label="64 by 64 parcel terrain map"></canvas>' +
    '<div class="world-map-legend"><span><i class="terrain-f"></i>flat</span><span><i class="terrain-e"></i>fertile</span><span><i class="terrain-o"></i>forest</span><span><i class="terrain-r"></i>ore</span><span><i class="terrain-w"></i>water</span></div>' +
    '<div class="world-cost" id="worldCost">' +
      '<div class="world-cost-head"><strong>the ledger</strong><span id="worldCostDay">today</span></div>' +
      '<div class="world-cost-row"><span>tokens today</span><b id="worldCostTokens">—</b></div>' +
      '<div class="world-cost-bar"><i id="worldCostFill"></i></div>' +
      '<div class="world-cost-sub" id="worldCostSub">top spenders</div>' +
      '<ol class="world-cost-top" id="worldCostTop"></ol>' +
    '</div>';
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
  function get(path) {
    return fetch(API + path, { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('world api ' + r.status);
      return r.json();
    });
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
  // `visible()` below is the SAME predicate the collision probe uses
  // (scripts/verify-no-collision.js -> verify-worldstate-collision-MEF2C4P.js
  // -> this harness). That is deliberate: if the panel yielded to a different
  // set than the probe measures, the two could disagree forever — the panel
  // would either collapse against an invisible container (#dvRail is filtered
  // out by exactly this predicate, and at 375px its top is 237px, which would
  // otherwise crush the panel to 17px) or ignore something the probe flags.
  var FLOOR_GUTTER = 12;
  function visibleObstacle(el, cs) {
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (parseFloat(cs.opacity) === 0) return false;
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
  // The candidate scan is the EXPENSIVE half (getComputedStyle over every node
  // in the document — measured ~1,500 elements on world.html), so it runs on the
  // SLOW beat and the fast settling tail only re-reads the candidates' rects.
  // Sweeping the whole document every 60ms starved the main thread badly enough
  // that the ledger's own fetch callbacks ran a full state late in the harness —
  // the panel was correct and looked broken.
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
      if (!visibleObstacle(el, cs)) continue;
      var r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      // a full-bleed backdrop (#stage, #veil) is scenery, not furniture
      if (r.width >= vw * 0.9 && r.height >= vh * 0.9) continue;
      out.push(el);
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
      var el = _cands[i];
      if (!el.isConnected) continue;
      var cs = getComputedStyle(el);
      if (!visibleObstacle(el, cs)) continue;         // it may have faded out
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
    // The floor is published RAW: clamping it up to top+MIN_USABLE would let a
    // visible box reach past its floor, and the short case is already answered
    // by the stand-down above (room < MIN_USABLE is exactly raw < top+MIN_USABLE,
    // so the two can never disagree).
    panel.style.setProperty('--wmp-floor', raw + 'px');
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
    if (!on) return;
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

  mapButton.addEventListener('click', function () {
    var open = !panel.hidden;
    panel.hidden = open;
    mapButton.setAttribute('aria-expanded', String(!open));
    if (!open) get('/api/world/parcels').then(draw).catch(function () {
      var meta = document.getElementById('worldMapMeta'); if (meta) meta.textContent = 'map unavailable';
    });
    costPolling(!open);
    fitting(!open);
  });
  refreshClock();
  setInterval(refreshClock, 15000);
}());
