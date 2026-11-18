// ═══════════════════════════════════════════════════════════════════════════
// THE FOLK LAYER — the living citizens, on the map, doing something (AC2WP9A)
//
// MEASURED 2026-11-17, api.vintaclectic.com:
//   GET /api/world/citizens -> 200, {citizens:[33]}, every row carrying
//   parcel_x/parcel_y in 0..63, last_action ('teach','build','rest','forage',
//   'socialize','gather','explore'), last_acted_tick, energy/food/shelter/
//   social, wallet_balance, provider, active, incapacitated.
//   AND: `grep -rln "world/citizens"` over this whole repo -> ZERO files.
// So the world had 33 people living in it, with positions and actions, and the
// browser drew a terrain map with NOBODY ON IT. The map was a landscape; this
// file makes it a POPULATED landscape.
//
// WHY A SHARED MODULE AND NOT A SECOND FETCHER. Two surfaces already paint the
// same 64x64 terrain from the same /api/world/parcels: the skeleton sheet
// (#wsMap, world-skeleton.js) and the land panel (#worldMapCanvas,
// economy-map.js). Giving each its own citizens fetch would double the request
// rate, let the two drift a tick apart, and fork the marker rules so they could
// disagree about where a person is. One store, one painter, two consumers.
//
// WHAT THIS FILE IS NOT. It does NOT touch the presence-socket sprite lane
// (agent-life.js / world-client.js's `agents` Map). Those are COUNCIL AVATARS
// riding a 5Hz websocket — live cursors of who is browsing. These are WORLD
// CITIZENS: server-side simulated people whose position only moves when the
// 60s economy tick moves it. Different population, different cadence, different
// endpoint; deliberately kept apart.
//
// NOTE ON /api/world/agents (the one the folk band already reads): it returns
// the SAME population with x/y and last_acted_tick, but it does NOT carry
// last_action. That single missing field is why the roster could say where
// everyone stood and never what anyone was DOING, and it is why this file reads
// /api/world/citizens instead of reusing that call.
//
// SERVER-AUTHORITATIVE. Computes no world state. Every number painted is a
// number read off the wire this minute. An unreachable endpoint keeps the last
// good snapshot (a stale-but-true position beats an empty map) and says so.
//
// NO-COLLISION LAW — structurally incapable of colliding:
//   · It creates NO DOM. Not one element, ever. It is a store and two paint
//     routines that write into a <canvas> its CALLER owns, so it has no box to
//     overflow and nothing to stack on.
//   · paintLabel draws at most ONE label per call and CLAMPS it inside the
//     canvas box, so label-vs-label overlap is impossible by construction
//     rather than by a placement heuristic that can be wrong.
//
// FEATURE FLAG — 'world_folk'. ?folk=0 hard-kills every marker, no deploy.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintWorldFolk) return;

  var W = window;
  function base() { try { return (W.__VINTINUUM_API_BASE || '').replace(/\/$/, ''); } catch (_) { return ''; } }
  function token() { try { return localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token'); } catch (_) { return null; } }
  function authHeaders() { var t = token(); return t ? { Authorization: 'Bearer ' + t } : {}; }

  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('folk') === '0') _flag = false;
      else if (q.get('folk') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_folk') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ── PROVIDER HUES. The provider is WHO IS THINKING for that citizen, and it
  //    is the only categorical field worth a colour here: three values, stable,
  //    and it makes the map legible at a glance without a single word of text.
  //    Warm/cool/green so they stay distinguishable in greyscale too.
  var HUE = {
    claude: [255, 181, 112],
    openai: [150, 232, 184],
    gemini: [159, 220, 255],
    _fallback: [214, 200, 255]
  };
  var PROVIDERS = ['claude', 'openai', 'gemini'];

  // ── THE STORE ───────────────────────────────────────────────────────────────
  var _rows = null;         // normalised citizen rows, or null before first read
  var _err = false;         // last fetch failed
  var _at = 0;              // Date.now() of the last GOOD read
  var _inflight = false;
  var _sig = '';            // change signature, so a quiet minute costs no renders
  var _subs = [];
  var _poll = null;

  function fin(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }

  // A citizen is only PLACED if it has both coordinates. A row without a
  // position is kept in the roster (it is a real person) and simply never
  // painted — a marker at a guessed cell would be a fabricated fact.
  function normalise(raw) {
    var out = [];
    if (!raw || !raw.length) return out;
    for (var i = 0; i < raw.length; i++) {
      var c = raw[i] || {};
      if (!c.id) continue;
      var x = fin(c.parcel_x), y = fin(c.parcel_y);
      out.push({
        id: String(c.id),
        name: String(c.display_name || c.id),
        x: x, y: y,
        placed: (x !== null && y !== null),
        action: (typeof c.last_action === 'string' && c.last_action) ? c.last_action : null,
        tick: fin(c.last_acted_tick),
        energy: fin(c.energy), food: fin(c.food),
        shelter: fin(c.shelter), social: fin(c.social),
        wallet: fin(c.wallet_balance), rep: fin(c.reputation),
        memories: fin(c.memory_count),
        provider: (typeof c.provider === 'string' && c.provider) ? c.provider : null,
        active: !!(c.active === 1 || c.active === true),
        incap: !!(c.incapacitated === 1 || c.incapacitated === true)
      });
    }
    // Stable, meaningful order: the people still standing first, then by the
    // tick they last moved (most recently active at the top), then by name so
    // the list never shuffles between two equal rows.
    out.sort(function (a, b) {
      if (a.active !== b.active) return a.active ? -1 : 1;
      if (a.incap !== b.incap) return a.incap ? 1 : -1;
      var at = (b.tick || 0) - (a.tick || 0);
      if (at) return at;
      return a.name.localeCompare(b.name);
    });
    return out;
  }

  // The signature is what a CONSUMER would have to repaint for: who exists,
  // where they are, what they are doing, and whether they are upright. Needs
  // drift every tick and are shown as chips, so they ride along too — but the
  // whole point is that an identical minute notifies nobody.
  function signature(rows) {
    var s = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      s.push(r.id + ':' + r.x + ',' + r.y + ':' + r.action + ':' + r.tick +
             ':' + r.energy + '/' + r.food + ':' + (r.incap ? 'x' : 'o'));
    }
    return s.join('|');
  }

  function notify(changed) {
    for (var i = 0; i < _subs.length; i++) {
      try { _subs[i](_rows, changed); } catch (_) {}
    }
  }

  function refresh(then) {
    if (!enabled()) { if (then) then(); return; }
    if (_inflight) { if (then) then(); return; }
    _inflight = true;
    fetch(base() + '/api/world/citizens', { cache: 'no-store', headers: authHeaders() })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        _inflight = false;
        if (!j || !Array.isArray(j.citizens)) throw new Error('bad payload');
        var rows = normalise(j.citizens);
        var sig = signature(rows);
        var changed = (sig !== _sig);
        _rows = rows; _sig = sig; _err = false; _at = Date.now();
        notify(changed);
        if (then) then();
      })
      .catch(function () {
        _inflight = false;
        // NEVER wipe a good snapshot on a transient failure. A position that is
        // one minute stale is true of a world that moves once a minute; an
        // empty map is a lie about a world with 33 people in it.
        _err = true;
        notify(false);
        if (then) then();
      });
  }

  // ── THE CADENCE. The world advances once every 60s (MEASURED:
  //    /api/world/economy -> tick_rate_ms 60000), so polling faster than that
  //    spends requests to re-read a number that cannot have changed. A
  //    backgrounded tab polls not at all and refreshes the moment it returns,
  //    so the first thing a returning player sees is honest.
  var PERIOD_MS = 60000;
  function start() {
    if (!enabled() || _poll) return;
    _poll = setInterval(function () {
      try { if (!document.hidden) refresh(); } catch (_) { try { refresh(); } catch (__) {} }
    }, PERIOD_MS);
    try {
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) { try { refresh(); } catch (_) {} }
      });
    } catch (_) {}
    refresh();
  }

  function subscribe(fn) {
    if (typeof fn !== 'function') return function () {};
    _subs.push(fn);
    // Hand a new subscriber whatever is already known, so a sheet opened after
    // the first read paints immediately instead of waiting out a whole minute.
    if (_rows) { try { fn(_rows, true); } catch (_) {} }
    return function () {
      var i = _subs.indexOf(fn);
      if (i >= 0) _subs.splice(i, 1);
    };
  }

  function get() { return _rows ? _rows.slice() : null; }
  function byId(id) {
    if (!_rows) return null;
    for (var i = 0; i < _rows.length; i++) if (_rows[i].id === id) return _rows[i];
    return null;
  }
  function actionOf(id) { var r = byId(id); return r ? r.action : null; }
  function placed() { return (_rows || []).filter(function (r) { return r.placed; }); }
  function hue(p) { return HUE[p] || HUE._fallback; }
  function rgb(c, a) {
    return (a === undefined || a >= 1)
      ? 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'
      : 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  // Text width with a deterministic fallback, so a context that refuses
  // measureText still produces a monotonic estimate (the fit loop below only
  // needs monotonicity in length to terminate at something that fits).
  function measure(ctx, s, fs) {
    try { return ctx.measureText(s).width; } catch (_) { return s.length * fs * 0.5; }
  }

  // ── CLUSTERING. At 64 cells across a 250px canvas one cell is 3.9px, so two
  //    citizens on the same parcel would paint exactly on top of each other and
  //    the second would be invisible — a person the map silently omits. Rather
  //    than draw a count badge (no room for a digit at that scale), co-located
  //    citizens are fanned onto a small ring around their shared cell centre:
  //    every one of them keeps its own hittable marker, and the fan itself
  //    reads as "several people here". Deterministic (index order), so markers
  //    never jitter between two paints of the same state.
  function layout(rows, geom) {
    var cw = geom.w / geom.cols, ch = geom.h / geom.rows;
    var buckets = {}, i, r, k;
    var list = [];
    for (i = 0; i < rows.length; i++) {
      r = rows[i];
      if (!r.placed) continue;
      k = r.x + ',' + r.y;
      if (!buckets[k]) buckets[k] = [];
      buckets[k].push(r);
    }
    for (k in buckets) {
      if (!Object.prototype.hasOwnProperty.call(buckets, k)) continue;
      var group = buckets[k];
      var cx = (group[0].x + 0.5) * cw, cy = (group[0].y + 0.5) * ch;
      var n = group.length;
      for (i = 0; i < n; i++) {
        var px = cx, py = cy;
        if (n > 1) {
          // fan radius stays sub-marker so a cluster still reads as one place
          var fan = geom.r * 0.95;
          var ang = (Math.PI * 2 * i) / n - Math.PI / 2;
          px = cx + Math.cos(ang) * fan;
          py = cy + Math.sin(ang) * fan;
        }
        list.push({
          row: group[i],
          cx: Math.max(geom.r, Math.min(geom.w - geom.r, px)),
          cy: Math.max(geom.r, Math.min(geom.h - geom.r, py)),
          cluster: n
        });
      }
    }
    return list;
  }

  // Marker geometry for a canvas of w x h BACKING pixels holding cols x rows
  // cells. The radius is clamped so a marker is always big enough to see and
  // always small enough that a fan of them cannot leave its own neighbourhood.
  function geometry(w, h, cols, rows, dpr) {
    cols = cols || 64; rows = rows || 64;
    var cell = Math.min(w / cols, h / rows);
    var r = Math.max(2.4 * dpr, Math.min(cell * 0.62, 7.5 * dpr));
    return { w: w, h: h, cols: cols, rows: rows, cell: cell, r: r, dpr: dpr };
  }

  // ── PAINT THE PEOPLE. Writes into a context the caller owns; never clears a
  //    terrain it did not draw (the caller decides whether this is an overlay
  //    canvas it may clear, or a composite it may not).
  //    `sel` is the selected citizen id, drawn with an extra ring.
  function paint(ctx, geom, rows, sel) {
    if (!enabled() || !ctx || !rows || !rows.length) return [];
    var hits = layout(rows, geom);
    var r = geom.r, i, m, row, c, acting;
    var now = currentTick(rows);

    // pass 1 — the soft halo of everyone who MOVED on the newest tick anyone
    // moved on. "Acting now" is the thing a glance should catch first.
    for (i = 0; i < hits.length; i++) {
      m = hits[i]; row = m.row;
      if (row.incap || !row.active) continue;
      acting = (now !== null && row.tick !== null && row.tick >= now);
      if (!acting) continue;
      c = hue(row.provider);
      ctx.beginPath();
      ctx.arc(m.cx, m.cy, r * 2.15, 0, Math.PI * 2);
      ctx.fillStyle = rgb(c, 0.17);
      ctx.fill();
    }

    // pass 2 — the people
    for (i = 0; i < hits.length; i++) {
      m = hits[i]; row = m.row;
      c = hue(row.provider);
      var dim = (row.incap || !row.active);

      // a dark seat under every marker, so a pale citizen on pale sand and a
      // dark citizen on deep water are equally legible. This is why a marker
      // can never be lost to its terrain.
      ctx.beginPath();
      ctx.arc(m.cx, m.cy, r + 1.25 * geom.dpr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(6,9,15,' + (dim ? 0.5 : 0.72) + ')';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(m.cx, m.cy, r, 0, Math.PI * 2);
      ctx.fillStyle = rgb(c, dim ? 0.32 : 0.95);
      ctx.fill();

      // a fallen citizen is a ring, not a disc — absence reads as absence.
      if (dim) {
        ctx.beginPath();
        ctx.arc(m.cx, m.cy, r * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6,9,15,0.85)';
        ctx.fill();
      }

      if (sel && row.id === sel) {
        ctx.beginPath();
        ctx.arc(m.cx, m.cy, r + 3.2 * geom.dpr, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.92)';
        ctx.lineWidth = Math.max(1, 1.5 * geom.dpr);
        ctx.stroke();
      }
    }
    return hits;
  }

  // The newest tick ANY citizen acted on — the world's "now" as the citizens
  // themselves report it. Derived from the rows rather than from the economy
  // endpoint, so paint() needs one source of truth, not two that can disagree.
  function currentTick(rows) {
    var t = null;
    for (var i = 0; i < (rows || []).length; i++) {
      var v = rows[i].tick;
      if (v === null) continue;
      if (t === null || v > t) t = v;
    }
    return t;
  }

  // ── ONE LABEL, CLAMPED. Drawn for a SINGLE citizen, and the box is clamped
  //    inside the canvas on both axes before a pixel is written. Because there
  //    is never a second label, label-vs-label collision is not avoided here —
  //    it is impossible. (A 33-label map at 320px would be unreadable mush; the
  //    names live in the roster band, which is flow layout and cannot overlap.)
  function paintLabel(ctx, geom, hit, text) {
    if (!ctx || !hit || !text) return null;
    var dpr = geom.dpr;
    var pad = 4 * dpr, fs = Math.max(9.5 * dpr, Math.min(12 * dpr, geom.w / 26));
    ctx.font = '600 ' + fs.toFixed(1) + 'px "Cormorant Garamond",Georgia,serif';
    ctx.textBaseline = 'middle';
    var chrome = pad * 2.4;
    var tw = measure(ctx, text, fs);
    var bh = fs + pad * 1.9;

    // ── FIT THE TEXT; DO NOT MERELY CLAMP THE BOX ────────────────────────────
    // A clamp can MOVE a box. It cannot SHRINK one that is wider than the
    // canvas, and when it saturates it silently leaves the box overhanging.
    // MEASURED before this fix, the 52-char citizen at the 320px lane:
    // label box 261.2px wide inside a 250x250 canvas -> both clamps pinned at
    // bx=1 and the box still ran 12.2px past the right edge. At 375/393 it
    // overhung by 12.9/22.2px. That is a No-Collision Law violation no amount
    // of repositioning can cure, so the TEXT is truncated to fit FIRST and the
    // clamp afterwards only ever has to move a box that already fits.
    var maxBw = geom.w - 2;                 // 1px of air on each side
    if (tw + chrome > maxBw) {
      var room = maxBw - chrome;
      var cut = text;
      // shortest-first is wrong (a name can be shorter than the ellipsis at a
      // tiny canvas), so shrink from the full string and accept '...' alone as
      // the floor: a label is never allowed to be the thing that overflows.
      while (cut.length > 1 && measure(ctx, cut + '\u2026', fs) > room) cut = cut.slice(0, -1);
      text = (cut.length > 1) ? cut.replace(/[\s\u00b7]+$/, '') + '\u2026' : '\u2026';
      tw = measure(ctx, text, fs);
    }
    var bw = Math.min(maxBw, tw + chrome);
    // prefer to the right of the marker; flip left when the right edge would
    // leave the box; then clamp both axes so it can never escape regardless.
    var bx = hit.cx + geom.r + 3 * dpr;
    if (bx + bw > geom.w - 1) bx = hit.cx - geom.r - 3 * dpr - bw;
    bx = Math.max(1, Math.min(geom.w - bw - 1, bx));
    var by = hit.cy - bh / 2;
    by = Math.max(1, Math.min(geom.h - bh - 1, by));

    var rr = Math.min(5 * dpr, bh / 2);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, rr);
    else ctx.rect(bx, by, bw, bh);
    ctx.fillStyle = 'rgba(6,9,15,0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = Math.max(1, dpr);
    ctx.stroke();
    ctx.fillStyle = '#eaf3ff';
    ctx.fillText(text, bx + pad * 1.2, by + bh / 2);
    return { x: bx, y: by, w: bw, h: bh };
  }

  // Nearest marker to a point in BACKING-pixel space, within a grab radius.
  // Used for tapping a person on the map.
  function hitTest(hits, px, py, geom) {
    var best = null, bd = Infinity;
    var grab = Math.max(geom.r * 2.2, 11 * geom.dpr);
    for (var i = 0; i < (hits || []).length; i++) {
      var h = hits[i];
      var d = Math.sqrt((h.cx - px) * (h.cx - px) + (h.cy - py) * (h.cy - py));
      if (d < bd) { bd = d; best = h; }
    }
    return (best && bd <= grab) ? best : null;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  W.VintWorldFolk = {
    enabled: enabled, start: start, refresh: refresh, subscribe: subscribe,
    get: get, byId: byId, actionOf: actionOf, placed: placed,
    geometry: geometry, layout: layout, paint: paint, paintLabel: paintLabel,
    hitTest: hitTest, currentTick: currentTick, hue: hue, rgb: rgb,
    providers: function () { return PROVIDERS.slice(); },
    stale: function () { return _err; },
    age: function () { return _at ? (Date.now() - _at) : null; },
    period: function () { return PERIOD_MS; }
  };
})();
