// ═══════════════════════════════════════════════════════════════════════════
// THE SKELETON — the world's bones, made visible (AETHERHOLD, World-Council P2)
//
// WORLD_SPEC Phase 2 stood up a PERSISTENT world on the server: a DB-backed
// economy clock that rises once every 60 seconds whether or not a single browser
// is open, and a 64×64 parcel map of terrain the agents will gather, build and
// fight over. GET /api/world/economy and GET /api/world/parcels returned all of
// it, whole and correct — and NOTHING IN THE BROWSER RENDERED ONE FIELD.
//
// So the acceptance criterion — "a tick counter is visible and visibly rises,
// and the 64×64 terrain is on the page" — was true on the server and false to
// the human, which is the same as false. This file is the other half: where the
// world's skeleton becomes SEEN.
//
// WHAT IT SHOWS, in order of how little the player has to do to see it:
//   1. THE CLOCK, ALWAYS ON. The live economy tick is a count badge on the rail
//      launcher itself, polled every ~5s — so the number visibly rises without
//      opening anything, and the "it persists higher after you close the tab" is
//      inherent, because the clock is the server's, not the page's.
//   2. THE CLOCK, IN WORDS. Opened, the sheet reads "world tick N · day ⌊N/snap⌋
//      · 1 tick / 60s" and keeps rising while you watch — the divisor and the
//      rate are the SERVER's own values, never hardcoded.
//   3. THE TERRAIN. The 64×64 parcel map drawn one real pixel per cell to a
//      64×64 canvas and scaled up with image-rendering:pixelated, so it is crisp
//      at any size and can NEVER overflow its capped sheet.
//   4. THE LEGEND. Only the terrains this map actually has, each with its colour.
//   5. THE CLAIMS. Best-effort: parcels already deeded are tinted gold — but ONLY
//      where a claim key/value is unambiguously an (x,y), so a mark is never
//      fabricated against a shape this client could not verify (see parseCoord).
//   6. THE FOLK (AC2WP9A). The 33 living citizens, each as a marker ON the map
//      at its own parcel, plus a roster band naming every one of them and WHAT
//      IT IS DOING this tick. Until this landed the map was a landscape with
//      nobody in it: /api/world/citizens answered 200 with 33 people carrying
//      parcel_x/parcel_y and last_action, and `grep -rln "world/citizens"`
//      over the whole repo returned ZERO files.
//
// THE FOLK, IN TWO PLACES ON PURPOSE. Positions go on the CANVAS (a second
// canvas layered exactly over the terrain — see below) because position is
// spatial and a list cannot show it. Names and actions go in a FLOW ROSTER
// BAND because 33 floating labels on a 250px map is mush, and because flow
// layout is the only label layout that cannot overlap. The two are linked both
// ways: tap a marker and its row highlights; tap a row and its marker rings
// and gains the one clamped label this surface will ever draw.
//
// SERVER-AUTHORITATIVE, ABSOLUTELY. This file computes NO world state. It does
// not advance the clock, does not know a terrain char's meaning except through
// the legend the server hands it, and asserts nothing it did not read off the
// wire. If an endpoint is unreachable it says so quietly and claims nothing.
//
// NO-COLLISION LAW — how this surface is structurally incapable of colliding:
//   · It adds ZERO new position:fixed elements. Not one.
//   · Its LAUNCHER is a flow child of #dvRail (via DirverseHUD.addLauncher) — the
//     one fixed box that owns that column, measures its own ceiling/floor and
//     scrolls/compacts/wraps internally. This file sets no position, no top/left/
//     right/bottom, no z-index on the launcher. The count badge is a flow child
//     INSIDE the button (flex:0 0 auto), so the name ellipsizes before it, and it
//     can only ever occupy the rail's own measured box.
//   · Its SHEET is registered with the HUD's one-sheet-at-a-time owner
//     (registerSheet/openSheet), so raising it CLOSES every sibling sheet first.
//   · The sheet reuses .dv-sheet/.dv-body verbatim — height-capped, internally
//     scrolling, safe-area padded. The map is width:100% + max-width + aspect-
//     ratio:1/1, so it scales inside the body and never pushes the box.
//   · The ONE intended overlay is the sheet over the shared #dvScrim — the
//     sanctioned modal case Vinta already approved for every other sheet.
//
// ── RETENTION DOCTRINE (all seven) ─────────────────────────────────────────
//   1 GENEROUS (Aria) — the whole world's clock and map, free, no gate. One tick
//     is one real minute of a world that kept living while you were gone.
//   2 INVESTMENT LOOP (Helios) — the tick you watch rise is the same clock your
//     parcels, agents and claims accrue against; seeing it makes the world's
//     permanence legible, which is the moat.
//   3 TIER (Frugal-Max) — FREE. Seeing the world is the top of the funnel.
//   4 DENSE (Lunex) — a number, a map, a legend. Nothing else.
//   5 OPEN LOOP (Morrison) — the clock never stops and the map is mostly
//     unclaimed. Both are unfinished meaning you come back to.
//   6 FLAGGED (Atlas) — 'world_skeleton' (?skeleton=0), killable in 30s. Every
//     number is the server's.
//   7 MORE ALIVE (Yuna) — a world whose clock you can watch tick is alive; the
//     same world with no visible time is a screenshot.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintWorldSkeleton) return;

  var W = window;
  function hud() { return W.DirverseHUD; }
  function base() { try { return (W.__VINTINUUM_API_BASE || '').replace(/\/$/, ''); } catch (_) { return ''; } }
  function token() { try { return localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token'); } catch (_) { return null; } }
  function authHeaders() { var t = token(); return t ? { Authorization: 'Bearer ' + t } : {}; }

  // ── FEATURE FLAG — 'world_skeleton'. ?skeleton=0 hard-kills it, no deploy. ──
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('skeleton') === '0') _flag = false;
      else if (q.get('skeleton') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_skeleton') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ── TERRAIN COLOURS — keyed by the SERVER's type NAME, never by char ────────
  // The legend (char→type) comes off the wire; we only decide how to PAINT a
  // type, in the page's warm palette on #1a1410. An unknown type falls back to a
  // muted warm brown rather than throwing or going transparent.
  var COLORS = {
    water:    [74, 127, 165],   // blue
    ore:      [112, 117, 126],  // slate / grey
    forest:   [57, 92, 58],     // deep green
    fertile:  [138, 160, 86],   // warm green
    flat:     [156, 133, 96],   // tan / sand
    _fallback:[90, 78, 64]      // muted warm brown for an unmapped char
  };
  var LEGEND_ORDER = ['fertile', 'forest', 'ore', 'water', 'flat'];
  var CLAIM_RGB = [255, 212, 121]; // gold — matches the deed accent elsewhere

  // ── SERVER TRUTH, MIRRORED ──────────────────────────────────────────────────
  var _econ = null, _econErr = false;
  var _parcels = null, _parcelsErr = false, _parcelsInflight = false;
  var _claimN = 0;
  var _sheet = null, _btn = null, _poll = null;
  // ── THE FOLK (AC2WP9A) — markers, the roster, and which person is picked ──
  var _hits = [];        // last painted marker geometry, for hit-testing a tap
  var _sel = null;       // selected citizen id, or null
  var _folkSub = null;   // unsubscribe handle for the shared store
  var _ro = null;        // ResizeObserver on the map box
  var _citBound = false;
  var _lastGeom = null;  // last marker geometry, in BACKING pixels
  var _lastLabel = null; // last label box, in BACKING pixels (test seam)

  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  // ── STYLES — one injected sheet, scoped to #dvWorldSkeleton* / #wsBtn ────────
  function injectStyles() {
    if (document.getElementById('ws-skeleton-styles')) return;
    var s = document.createElement('style');
    s.id = 'ws-skeleton-styles';
    s.textContent = [
      // ── the always-on tick badge. Scoped to #wsBtn; a flow child of the
      //    button (flex:0 0 auto) so the NAME ellipsizes before it and it can
      //    never widen the pill past the rail's measured box. Opacity-only pulse
      //    on change (no transform, no layout) so "rising" feels alive and still
      //    cannot collide. ───────────────────────────────────────────────────
      '#dvRail #wsBtn .ws-count{flex:0 0 auto;font-variant-numeric:tabular-nums;',
      ' font-size:0.82em;letter-spacing:.01em;color:#9fdcff;opacity:.92;}',
      '#dvRail #wsBtn.ws-live{border-color:rgba(159,220,255,0.45);}',
      '#dvRail #wsBtn .ws-count.bump{animation:wsbump .6s ease;}',
      '@keyframes wsbump{0%{opacity:.3;}100%{opacity:.92;}}',
      '@media(prefers-reduced-motion:reduce){#dvRail #wsBtn .ws-count.bump{animation:none;}}',

      // ── the live clock readout ──────────────────────────────────────────────
      '#dvWorldSkeletonSheet .ws-readout{padding:11px 13px;border-radius:13px;',
      ' background:rgba(159,220,255,0.07);border:1px solid rgba(159,220,255,0.2);}',
      '#dvWorldSkeletonSheet .ws-r-main{font-size:19px;color:#eaf3ff;letter-spacing:.02em;}',
      '#dvWorldSkeletonSheet .ws-r-k{color:rgba(206,224,255,0.7);}',
      '#dvWorldSkeletonSheet .ws-r-v{font-variant-numeric:tabular-nums;color:#9fdcff;}',
      '#dvWorldSkeletonSheet .ws-r-sub{font-size:13px;color:rgba(206,224,255,0.6);',
      ' margin-top:3px;font-style:italic;}',

      // ── the map. 64×64 backing store, scaled to fit, pixelated, square. It
      //    fills the body width, is capped so a desktop can't blow it up, keeps a
      //    1/1 aspect so it never overflows, and scrolls WITH the body if the
      //    sheet is short. ──────────────────────────────────────────────────────
      '#dvWorldSkeletonSheet .ws-mapwrap{margin:13px 0 4px;display:flex;justify-content:center;}',
      // THE TWO CANVASES SHARE ONE BOX. .ws-mapbox owns the size (width:100%,
      // capped, square); BOTH canvases are inset:0 inside it. Alignment is
      // therefore a LAYOUT guarantee, not a measurement that can drift by a
      // subpixel — the terrain pixel under a citizen's marker is always the
      // parcel that citizen stands on. The box is position:relative, so the
      // overlay is contained by it and cannot escape onto a sibling; this is
      // the one intended overlay here (pins over a map), and it adds no fixed
      // element and no z-index above the sheet's own stacking context.
      '#dvWorldSkeletonSheet .ws-mapbox{position:relative;width:100%;',
      ' max-width:min(420px,78vmin);aspect-ratio:1/1;}',
      '#dvWorldSkeletonSheet #wsMap{position:absolute;inset:0;width:100%;height:100%;',
      ' image-rendering:pixelated;image-rendering:crisp-edges;',
      ' display:block;border-radius:12px;border:1px solid rgba(124,207,255,0.2);',
      ' background:rgba(255,255,255,0.03);}',
      // the people. Same box, drawn at CSS resolution x devicePixelRatio so the
      // markers and the one label are CRISP while the terrain beneath stays
      // deliberately pixelated (one pixel = one parcel).
      '#dvWorldSkeletonSheet #wsCits{position:absolute;inset:0;width:100%;height:100%;',
      ' display:block;border-radius:12px;cursor:pointer;touch-action:manipulation;}',

      // ── legend ────────────────────────────────────────────────────────────
      '#dvWorldSkeletonSheet .ws-legend{display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:10px;}',
      '#dvWorldSkeletonSheet .ws-leg{display:flex;align-items:center;gap:6px;',
      ' font-size:12.5px;color:rgba(220,231,255,0.72);text-transform:capitalize;}',
      '#dvWorldSkeletonSheet .ws-sw{width:12px;height:12px;border-radius:3px;flex:0 0 auto;',
      ' box-shadow:0 0 0 1px rgba(255,255,255,0.14) inset;}',

      // ── THE FOLK ROSTER. A flow list: one row per citizen, name + what it is
      //    doing. Capped and internally scrolling, so 33 rows (or 300) grow
      //    INWARD and can never evict the map above them — and because the
      //    rows are flow children, two names can never occupy the same pixels
      //    no matter how long they are. min-height:0 + overflow-y:auto is the
      //    pair that actually frees a flex/again-capped child (CSS Flexbox
      //    §4.5: the automatic minimum size applies only while main-axis
      //    overflow is `visible`), and max-height is what bounds the growth.
      '#dvWorldSkeletonSheet .ws-folkhead{display:flex;align-items:baseline;gap:8px;',
      ' margin:14px 0 6px;font-size:13px;color:rgba(159,220,255,0.78);letter-spacing:.05em;}',
      '#dvWorldSkeletonSheet .ws-folkhead b{font-weight:600;color:#eaf3ff;font-size:14px;}',
      '#dvWorldSkeletonSheet .ws-folkhead .ws-fcount{margin-left:auto;font-variant-numeric:tabular-nums;',
      ' color:rgba(206,224,255,0.6);font-style:italic;}',
      '#dvWorldSkeletonSheet .ws-folk{max-height:min(34vh,264px);overflow-y:auto;min-height:0;',
      ' -webkit-overflow-scrolling:touch;overscroll-behavior:contain;',
      ' border-radius:12px;border:1px solid rgba(255,255,255,0.07);',
      ' background:rgba(255,255,255,0.025);}',
      '#dvWorldSkeletonSheet .ws-f{display:flex;align-items:center;gap:9px;width:100%;',
      ' min-height:38px;padding:6px 11px;background:none;border:none;border-radius:0;',
      ' font-family:inherit;text-align:left;cursor:pointer;color:inherit;',
      ' border-bottom:1px solid rgba(255,255,255,0.045);}',
      '#dvWorldSkeletonSheet .ws-folk .ws-f:last-child{border-bottom:none;}',
      '#dvWorldSkeletonSheet .ws-f .ws-fdot{flex:0 0 auto;width:9px;height:9px;border-radius:50%;',
      ' box-shadow:0 0 0 1px rgba(0,0,0,0.5);}',
      // the NAME is the only flexible cell, so it ellipsizes and every fixed
      // cell to its right keeps its space at 320px instead of being pushed out.
      '#dvWorldSkeletonSheet .ws-f .ws-fname{flex:1 1 auto;min-width:0;overflow:hidden;',
      ' text-overflow:ellipsis;white-space:nowrap;font-size:14.5px;color:#eaf3ff;}',
      '#dvWorldSkeletonSheet .ws-f .ws-fact{flex:0 0 auto;font-size:11.5px;letter-spacing:.04em;',
      ' text-transform:lowercase;padding:2px 8px;border-radius:999px;',
      ' background:rgba(159,220,255,0.12);border:1px solid rgba(159,220,255,0.22);',
      ' color:#cfe8ff;max-width:11ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvWorldSkeletonSheet .ws-f .ws-fat{flex:0 0 auto;font-size:11.5px;',
      ' font-variant-numeric:tabular-nums;color:rgba(206,224,255,0.5);}',
      '#dvWorldSkeletonSheet .ws-f.on{background:rgba(124,207,255,0.14);}',
      '#dvWorldSkeletonSheet .ws-f.down .ws-fname{color:rgba(220,231,255,0.45);}',
      '#dvWorldSkeletonSheet .ws-f.down .ws-fact{background:rgba(255,160,140,0.12);',
      ' border-color:rgba(255,160,140,0.25);color:#ffc0ae;}',
      // a phone gets a 44px row, the same floor .dv-x already declares there.
      '@media(max-width:480px){#dvWorldSkeletonSheet .ws-f{min-height:44px;}',
      ' #dvWorldSkeletonSheet .ws-f .ws-fat{display:none;}}',
      '@media(hover:hover){#dvWorldSkeletonSheet .ws-f:hover{background:rgba(255,255,255,0.05);}}',

      // ── the quiet note (drift / claims) ─────────────────────────────────────
      '#dvWorldSkeletonSheet .ws-note{font-size:12.5px;color:rgba(206,224,255,0.55);',
      ' margin-top:11px;font-style:italic;min-height:15px;}',
      '#dvWorldSkeletonSheet .ws-note.drift{color:#ffc79a;}'
    ].join('');
    document.head.appendChild(s);
  }

  // ── THE SHEET — static scaffold, built once ─────────────────────────────────
  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var el = document.createElement('div');
    el.className = 'dv-sheet'; el.id = 'dvWorldSkeletonSheet';
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the skeleton<small>the world’s bones · live</small></div>' +
        '<button class="dv-x" id="wsX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body">' +
        '<div class="ws-readout" id="wsReadout"></div>' +
        '<div class="ws-mapwrap"><div class="ws-mapbox">' +
          '<canvas id="wsMap" width="64" height="64" aria-label="the 64 by 64 world terrain map"></canvas>' +
          '<canvas id="wsCits" aria-label="the living citizens, each at its own parcel"></canvas>' +
        '</div></div>' +
        '<div class="ws-legend" id="wsLegend"></div>' +
        '<div class="ws-folkhead"><b>the folk</b><span id="wsFolkNote">who is here</span>' +
          '<span class="ws-fcount" id="wsFolkCount"></span></div>' +
        '<div class="ws-folk" id="wsFolk" role="list"></div>' +
        '<div class="ws-note" id="wsNote"></div>' +
      '</div>';
    document.body.appendChild(el);
    _sheet = el;
    try { el.querySelector('#wsX').onclick = close; } catch (_) {}
    return el;
  }

  function open() {
    if (!enabled()) return;
    try {
      injectStyles();
      var h = hud();
      if (h && h.openSheet) h.openSheet('skeleton', function () { build(); _sheet.classList.add('open'); afterOpen(); });
      else { build(); _sheet.classList.add('open'); afterOpen(); }
    } catch (_) {}
  }
  function afterOpen() {
    try {
      renderReadout();
      loadParcels();      // fetch-once-and-cache; redraws from cache on re-open
      pollEconomy();      // land the newest tick the moment you open
      bindFolk();         // markers + roster, and keep them following the tick
    } catch (_) {}
  }
  function close() {
    try { if (_sheet) _sheet.classList.remove('open'); } catch (_) {}
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  // ── THE ECONOMY CLOCK ───────────────────────────────────────────────────────
  function pollEconomy(then) {
    if (!enabled()) return;
    // don't burn requests on a backgrounded tab; we refresh on visibility return.
    try { if (document.hidden) { if (then) then(); return; } } catch (_) {}
    var url = base() + '/api/world/economy';
    fetch(url, { cache: 'no-store', headers: authHeaders() })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (!j || typeof j.tick !== 'number') throw new Error('bad payload');
        _econ = j; _econErr = false;
        paintBadge();
        if (isOpen()) renderReadout();
        if (then) then();
      })
      .catch(function () {
        // never wipe a good number on a transient failure — a stale-but-true
        // tick beats an error. Only a cold failure shows the drift line.
        _econErr = true;
        if (isOpen()) renderReadout();
        if (then) then();
      });
  }

  function renderReadout() {
    var r = document.getElementById('wsReadout');
    if (!r) return;
    while (r.firstChild) r.removeChild(r.firstChild);
    if (!_econ) {
      var waiting = document.createElement('div');
      waiting.className = 'ws-r-main';
      waiting.textContent = _econErr ? 'the world clock is drifting out of reach…' : 'reading the world clock…';
      r.appendChild(waiting);
      return;
    }
    var tick = _econ.tick;
    var snap = num(_econ.snapshot_every_ticks, 24); if (snap <= 0) snap = 24;
    var day = Math.floor(tick / snap);
    var secs = Math.round(num(_econ.tick_rate_ms, 60000) / 1000); if (secs <= 0) secs = 60;

    var big = document.createElement('div'); big.className = 'ws-r-main';
    var k = document.createElement('span'); k.className = 'ws-r-k'; k.textContent = 'world tick ';
    var v = document.createElement('span'); v.className = 'ws-r-v'; v.textContent = String(tick);
    big.appendChild(k); big.appendChild(v);
    r.appendChild(big);

    var sub = document.createElement('div'); sub.className = 'ws-r-sub';
    sub.textContent = 'day ' + day + '  ·  1 tick / ' + secs + 's';
    r.appendChild(sub);
  }

  // ── THE ALWAYS-ON BADGE ─────────────────────────────────────────────────────
  function paintBadge() {
    if (!_btn || !_econ) return;
    try {
      var cnt = _btn.querySelector('.ws-count');
      if (!cnt) { cnt = document.createElement('span'); cnt.className = 'ws-count'; _btn.appendChild(cnt); }
      var t = String(_econ.tick);
      if (cnt.textContent !== t) {
        var digitsChanged = cnt.textContent.length !== t.length;
        cnt.textContent = t;
        _btn.classList.add('ws-live');
        // opacity-only pulse; re-trigger by removing then re-adding the class.
        cnt.classList.remove('bump'); void cnt.offsetWidth; cnt.classList.add('bump');
        // only a digit-COUNT change can shift width; re-measure the rail then,
        // never on every quiet increment.
        if (digitsChanged) { try { if (hud() && hud().relayout) hud().relayout(); } catch (_) {} }
      }
    } catch (_) {}
  }

  // ── THE PARCEL MAP ──────────────────────────────────────────────────────────
  function loadParcels() {
    if (_parcels) { draw(); renderLegend(); renderNote(); return; }   // cached
    if (_parcelsInflight) return;
    _parcelsInflight = true;
    var url = base() + '/api/world/parcels';
    fetch(url, { headers: authHeaders() })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        _parcelsInflight = false;
        if (!j || typeof j.terrain !== 'string' || !j.terrain.length) throw new Error('bad payload');
        _parcels = j; _parcelsErr = false;
        draw(); renderLegend(); renderNote();
      })
      .catch(function () {
        _parcelsInflight = false;
        _parcelsErr = true;
        renderNote();
      });
  }

  function draw() {
    var cv = document.getElementById('wsMap');
    if (!cv) return;
    var ctx = null;
    try { ctx = cv.getContext('2d'); } catch (_) {}
    if (!ctx) return;
    if (!_parcels || typeof _parcels.terrain !== 'string') return;
    var w = num(_parcels.w, 64), h = num(_parcels.h, 64);
    if (w <= 0 || h <= 0) return;
    if (cv.width !== w) cv.width = w;
    if (cv.height !== h) cv.height = h;
    var terr = _parcels.terrain;
    var legend = (_parcels.legend && typeof _parcels.legend === 'object') ? _parcels.legend : {};
    var img, data;
    try { img = ctx.createImageData(w, h); data = img.data; } catch (_) { return; }
    var cells = w * h;
    for (var i = 0; i < cells; i++) {
      var ch = terr.charAt(i);
      var type = legend[ch];
      var c = COLORS[type] || COLORS._fallback;
      var o = i * 4;
      data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
    }
    _claimN = markClaims(data, w, h);
    try { ctx.putImageData(img, 0, 0); } catch (_) {}
  }

  // Tint claimed cells toward gold — but ONLY where a claim entry is
  // UNAMBIGUOUSLY an (x,y). The claims object's exact key shape could not be
  // verified from this worktree (egress is blocked here), so this fails CLOSED:
  // an ambiguous key (e.g. a bare parcel id) marks NOTHING rather than risk
  // painting a false claim. The acceptance test needs only tick + terrain; a
  // wrong mark would be worse than no mark.
  function markClaims(data, w, h) {
    var cl = _parcels && _parcels.claims;
    if (!cl || typeof cl !== 'object') return 0;
    var n = 0;
    for (var key in cl) {
      if (!Object.prototype.hasOwnProperty.call(cl, key)) continue;
      var xy = parseCoord(key, cl[key], w, h);
      if (!xy) continue;
      var idx = (xy.y * w + xy.x) * 4;
      if (idx < 0 || idx + 3 >= data.length) continue;
      data[idx]     = Math.round(data[idx]     * 0.35 + CLAIM_RGB[0] * 0.65);
      data[idx + 1] = Math.round(data[idx + 1] * 0.35 + CLAIM_RGB[1] * 0.65);
      data[idx + 2] = Math.round(data[idx + 2] * 0.35 + CLAIM_RGB[2] * 0.65);
      n++;
    }
    return n;
  }

  var COORD_RE = /^(\d+)\s*[,:xX]\s*(\d+)$/;
  function parseCoord(key, val, w, h) {
    var m = COORD_RE.exec(String(key));
    if (m) return clampXY(+m[1], +m[2], w, h);
    if (val && typeof val === 'object' && isFinite(val.x) && isFinite(val.y)) return clampXY(val.x, val.y, w, h);
    if (typeof val === 'string') { var m2 = COORD_RE.exec(val); if (m2) return clampXY(+m2[1], +m2[2], w, h); }
    return null;   // ambiguous → never fabricate a mark
  }
  function clampXY(x, y, w, h) {
    x = Math.floor(x); y = Math.floor(y);
    if (!(x >= 0 && x < w && y >= 0 && y < h)) return null;
    return { x: x, y: y };
  }

  function renderLegend() {
    var L = document.getElementById('wsLegend');
    if (!L) return;
    while (L.firstChild) L.removeChild(L.firstChild);
    // only the terrains THIS map actually carries (from the server legend)
    var present = null;
    try {
      if (_parcels && _parcels.legend) {
        present = {};
        for (var ch in _parcels.legend) {
          if (Object.prototype.hasOwnProperty.call(_parcels.legend, ch)) present[_parcels.legend[ch]] = 1;
        }
      }
    } catch (_) { present = null; }
    LEGEND_ORDER.forEach(function (type) {
      if (present && !present[type]) return;
      var c = COLORS[type]; if (!c) return;
      L.appendChild(legItem('rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')', type));
    });
    if (_claimN > 0) L.appendChild(legItem('rgb(' + CLAIM_RGB.join(',') + ')', 'claimed'));
  }
  function legItem(color, label) {
    var item = document.createElement('div'); item.className = 'ws-leg';
    var sw = document.createElement('i'); sw.className = 'ws-sw'; sw.style.background = color;
    item.appendChild(sw);
    item.appendChild(document.createTextNode(label));   // textContent — never HTML
    return item;
  }

  function renderNote() {
    var n = document.getElementById('wsNote');
    if (!n) return;
    while (n.firstChild) n.removeChild(n.firstChild);
    if (_parcelsErr && !_parcels) {
      n.className = 'ws-note drift';
      n.textContent = 'the skeleton is drifting out of reach…';
      return;
    }
    n.className = 'ws-note';
    var bits = [];
    if (_claimN > 0) bits.push(_claimN + (_claimN === 1 ? ' parcel claimed' : ' parcels claimed') + ' · gold');
    try {
      var F = folk();
      if (F && F.enabled()) {
        var rows = F.get();
        if (rows && rows.length) bits.push(rows.length + ' placed as of the newest tick they acted on');
        if (F.stale() && rows) bits.push('the register is briefly out of reach — positions are last-known');
      }
    } catch (_) {}
    n.textContent = bits.join(' · ');
  }

  // ══ THE FOLK ═══════════════════════════════════════════════════════════════
  // Positions on the canvas, names+actions in the roster, linked both ways.
  // Every value here is read off /api/world/citizens by world-folk-layer.js;
  // this file decides only how to PAINT and LIST what that store holds.

  function folk() { return W.VintWorldFolk; }

  function bindFolk() {
    var F = folk();
    if (!F || !F.enabled()) { renderFolkBand(); return; }
    if (!_folkSub) {
      // One subscription for the life of the sheet. The store notifies at most
      // once per 60s world tick AND only when something actually changed, so a
      // quiet minute costs zero renders.
      _folkSub = F.subscribe(function () {
        if (!isOpen()) return;
        drawCits(); renderFolkBand(); renderNote();
      });
    }
    bindCitTap();
    watchBox();
    // land the newest people the moment the sheet opens, exactly as the clock does
    try { F.refresh(); } catch (_) {}
    drawCits(); renderFolkBand();
  }

  // Re-paint the markers when the BOX changes size — a rotation, a viewport
  // resize, or the sheet's own max-height recomputing. The overlay is sized in
  // backing pixels, so a stale size would paint people at the wrong parcel.
  function watchBox() {
    if (_ro) return;
    try {
      var box = _sheet && _sheet.querySelector('.ws-mapbox');
      if (!box || typeof ResizeObserver !== 'function') return;
      _ro = new ResizeObserver(function () { if (isOpen()) drawCits(); });
      _ro.observe(box);
    } catch (_) { _ro = null; }
  }

  // Size the overlay to its own CSS box x devicePixelRatio and hand the folk
  // layer the geometry. Returns the geometry, or null when there is nothing to
  // draw into yet (a zero-size box before first layout).
  function citGeom(cv) {
    var F = folk(); if (!F) return null;
    var r = null;
    try { r = cv.getBoundingClientRect(); } catch (_) { return null; }
    if (!r || r.width < 2 || r.height < 2) return null;
    var dpr = Math.max(1, Math.min(3, W.devicePixelRatio || 1));
    var bw = Math.round(r.width * dpr), bh = Math.round(r.height * dpr);
    if (cv.width !== bw) cv.width = bw;
    if (cv.height !== bh) cv.height = bh;
    var cols = num(_parcels && _parcels.w, 64), rows = num(_parcels && _parcels.h, 64);
    if (cols <= 0) cols = 64; if (rows <= 0) rows = 64;
    return F.geometry(bw, bh, cols, rows, dpr);
  }

  function drawCits() {
    var F = folk(); if (!F) return;
    var cv = document.getElementById('wsCits'); if (!cv) return;
    var ctx = null; try { ctx = cv.getContext('2d'); } catch (_) {}
    if (!ctx) return;
    var g = citGeom(cv); if (!g) return;
    _lastGeom = g; _lastLabel = null;
    ctx.clearRect(0, 0, g.w, g.h);
    _hits = [];
    if (!F.enabled()) return;
    var rows = F.get();
    if (!rows || !rows.length) return;
    _hits = F.paint(ctx, g, rows, _sel) || [];
    // THE ONE LABEL. Only ever the picked citizen, clamped inside this box, so
    // a second label cannot exist and label-vs-label overlap is impossible.
    if (_sel) {
      for (var i = 0; i < _hits.length; i++) {
        if (_hits[i].row.id !== _sel) continue;
        var r = _hits[i].row;
        _lastLabel = F.paintLabel(ctx, g, _hits[i], r.name + (r.action ? ' · ' + r.action : ''));
        break;
      }
    }
  }

  // Tapping a person on the map picks them. One pointer listener on the overlay
  // (which is the topmost child of .ws-mapbox, so it receives the tap and the
  // terrain beneath never needs to care). A tap on empty land clears.
  function bindCitTap() {
    if (_citBound) return;
    var cv = document.getElementById('wsCits'); if (!cv) return;
    _citBound = true;
    try {
      cv.addEventListener('click', function (e) {
        var F = folk(); if (!F) return;
        var g = citGeom(cv); if (!g) return;
        var r = cv.getBoundingClientRect();
        var px = (e.clientX - r.left) * (g.w / r.width);
        var py = (e.clientY - r.top) * (g.h / r.height);
        var hit = F.hitTest(_hits, px, py, g);
        pick(hit ? hit.row.id : null, true);
      });
    } catch (_) {}
  }

  // The selection, from either side. `fromMap` scrolls the roster to the row so
  // a marker tap has a visible answer in the list.
  function pick(id, fromMap) {
    _sel = (id && _sel === id) ? null : (id || null);
    drawCits();
    paintRowState();
    if (fromMap && _sel) revealRow(_sel);
  }

  // Scroll the band by writing ITS OWN scrollTop, computed from rects. Never
  // scrollIntoView — that walks up every scroll ancestor and would scroll the
  // sheet body (and the document) too.
  function revealRow(id) {
    try {
      var band = document.getElementById('wsFolk'); if (!band) return;
      var row = band.querySelector('[data-cit="' + cssEsc(id) + '"]'); if (!row) return;
      var br = band.getBoundingClientRect(), rr = row.getBoundingClientRect();
      if (rr.top >= br.top && rr.bottom <= br.bottom) return;   // already visible
      var want = band.scrollTop + (rr.top - br.top) - (br.height - rr.height) / 2;
      band.scrollTop = Math.max(0, Math.min(band.scrollHeight - band.clientHeight, want));
    } catch (_) {}
  }
  function cssEsc(v) {
    try { if (W.CSS && CSS.escape) return CSS.escape(v); } catch (_) {}
    return String(v).replace(/["\\\]]/g, '\\$&');
  }

  function paintRowState() {
    try {
      var band = document.getElementById('wsFolk'); if (!band) return;
      var rows = band.querySelectorAll('.ws-f');
      for (var i = 0; i < rows.length; i++) {
        var on = (rows[i].getAttribute('data-cit') === _sel);
        rows[i].classList.toggle('on', on);
        rows[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
    } catch (_) {}
  }

  // THE ROSTER. One flow row per citizen: a provider dot, the name, what it is
  // doing, and the tick it did it on. Built with createElement/textContent
  // throughout — a citizen's display_name is server data and never becomes
  // markup here.
  function renderFolkBand() {
    var band = document.getElementById('wsFolk');
    var note = document.getElementById('wsFolkNote');
    var count = document.getElementById('wsFolkCount');
    if (!band) return;
    var F = folk();
    while (band.firstChild) band.removeChild(band.firstChild);
    if (!F || !F.enabled()) {
      if (note) note.textContent = 'stood down';
      if (count) count.textContent = '';
      return;
    }
    var rows = F.get();
    if (!rows) {
      if (note) note.textContent = F.stale() ? 'the folk are out of reach…' : 'reading the register…';
      if (count) count.textContent = '';
      return;
    }
    if (!rows.length) {
      if (note) note.textContent = 'nobody lives here yet';
      if (count) count.textContent = '';
      return;
    }
    var now = F.currentTick(rows);
    var acting = 0, standing = 0, i;
    for (i = 0; i < rows.length; i++) {
      if (rows[i].active && !rows[i].incap) standing++;
      if (now !== null && rows[i].tick !== null && rows[i].tick >= now) acting++;
    }
    if (note) note.textContent = standing + (standing === 1 ? ' soul' : ' souls') + ' standing';
    if (count) count.textContent = (now === null ? '' : acting + ' acting · tick ' + now);

    for (i = 0; i < rows.length; i++) band.appendChild(folkRow(rows[i], now));
    paintRowState();
  }

  function folkRow(r, now) {
    var F = folk();
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ws-f' + ((r.incap || !r.active) ? ' down' : '');
    b.setAttribute('data-cit', r.id);
    b.setAttribute('role', 'listitem');
    b.setAttribute('aria-pressed', 'false');

    var dot = document.createElement('i');
    dot.className = 'ws-fdot';
    var c = F.hue(r.provider);
    dot.style.background = F.rgb(c, (r.incap || !r.active) ? 0.35 : 0.95);
    b.appendChild(dot);

    var nm = document.createElement('span');
    nm.className = 'ws-fname';
    nm.textContent = r.name + (r.placed ? '' : ' (unplaced)');
    b.appendChild(nm);

    var act = document.createElement('span');
    act.className = 'ws-fact';
    // THE CURRENT ACTION. The card's whole ask. `last_action` is the verb the
    // server applied for this citizen on its latest turn; a citizen that has
    // never acted says so rather than borrowing a neighbour's verb.
    act.textContent = r.incap ? 'fallen' : (r.action || 'still');
    b.appendChild(act);

    var at = document.createElement('span');
    at.className = 'ws-fat';
    at.textContent = r.placed ? '(' + r.x + ',' + r.y + ')' : '—';
    b.appendChild(at);

    b.addEventListener('click', function () { pick(r.id, false); });
    return b;
  }

  // ── MOUNT ───────────────────────────────────────────────────────────────────
  function mountLauncher() {
    if (!enabled()) return;
    if (_btn) return;
    var h = hud();
    // No rail yet → retry, exactly as commons.js does. We NEVER invent a fixed
    // button of our own; the rail is the only collision-proof home for a launcher.
    if (!h || !h.addLauncher) { setTimeout(mountLauncher, 400); return; }
    injectStyles();
    try {
      _btn = h.addLauncher('wsBtn', 'skeleton', '⬡', open);   // ⬡ (unused elsewhere)
      if (h.registerSheet) h.registerSheet('skeleton', isOpen, close);
    } catch (_) {}
    // start the always-on clock: one read now, then every ~5s so the badge rises
    // on its own with nothing open.
    startPoll();
    setTimeout(function () { pollEconomy(); }, 1000);
  }

  function startPoll() {
    if (_poll) return;
    _poll = setInterval(function () { try { pollEconomy(); } catch (_) {} }, 5000);
    // when a backgrounded tab comes back, refresh immediately so the number is
    // honest the moment the player looks.
    try {
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) { try { pollEconomy(); } catch (_) {} }
      });
    } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
  else mountLauncher();

  W.VintWorldSkeleton = {
    open: open, close: close, isOpen: isOpen, enabled: enabled,
    refresh: function () {
      pollEconomy();
      if (isOpen()) loadParcels();
      try { if (folk() && folk().refresh) folk().refresh(); } catch (_) {}
    },
    tick: function () { return _econ ? _econ.tick : null },
    // test seams for scripts/verify-world-folk-AC2WP9A.js
    pick: function (id) { pick(id, false); },
    picked: function () { return _sel; },
    markers: function () { return _hits.map(function (h) { return { id: h.row.id, cx: h.cx, cy: h.cy, cluster: h.cluster }; }); },
    geom: function () { return _lastGeom ? { w: _lastGeom.w, h: _lastGeom.h, cols: _lastGeom.cols, rows: _lastGeom.rows, r: _lastGeom.r, dpr: _lastGeom.dpr } : null; },
    label: function () { return _lastLabel; },
    redraw: function () { drawCits(); renderFolkBand(); }
  };
})();
