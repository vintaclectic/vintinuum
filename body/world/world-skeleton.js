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
      '#dvWorldSkeletonSheet #wsMap{width:100%;max-width:min(420px,78vmin);',
      ' aspect-ratio:1/1;image-rendering:pixelated;image-rendering:crisp-edges;',
      ' display:block;border-radius:12px;border:1px solid rgba(124,207,255,0.2);',
      ' background:rgba(255,255,255,0.03);}',

      // ── legend ────────────────────────────────────────────────────────────
      '#dvWorldSkeletonSheet .ws-legend{display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:10px;}',
      '#dvWorldSkeletonSheet .ws-leg{display:flex;align-items:center;gap:6px;',
      ' font-size:12.5px;color:rgba(220,231,255,0.72);text-transform:capitalize;}',
      '#dvWorldSkeletonSheet .ws-sw{width:12px;height:12px;border-radius:3px;flex:0 0 auto;',
      ' box-shadow:0 0 0 1px rgba(255,255,255,0.14) inset;}',

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
        '<div class="ws-mapwrap"><canvas id="wsMap" width="64" height="64" aria-label="the 64 by 64 world terrain map"></canvas></div>' +
        '<div class="ws-legend" id="wsLegend"></div>' +
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
    if (_claimN > 0) n.textContent = _claimN + (_claimN === 1 ? ' parcel claimed' : ' parcels claimed') + ' · marked in gold';
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
    refresh: function () { pollEconomy(); if (isOpen()) loadParcels(); },
    tick: function () { return _econ ? _econ.tick : null }
  };
})();
