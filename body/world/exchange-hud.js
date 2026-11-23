// ═══════════════════════════════════════════════════════════════════════════
// THE DIRVERSE EXCHANGE — the sealed agent economy, made visible (task DKWPCRD)
//
// world/exchange.js is a pure limit-order-book economy where every named agent
// on the machine trades shares in the houses (the projects) while nobody
// watches; world/exchange-service.js drives it with a 20s clock, persists it,
// and feeds its fundamentals off the REAL Council Task Board. For the whole run
// of that cluster NOTHING in the browser rendered one number of it — the market
// existed and the page could not show it. This file is that answer: the chart
// is a mirror of the council's real work, and now you can see it.
//
// IT READS ONE BOUNDED ENDPOINT: GET /api/world/exchange (the engine's summary —
// instruments with last/change/fundamental, the net-worth leaderboard, treasury
// + money supply, the Gate's breach count, and the live feed). Computes no state,
// writes nothing. An unreachable brain keeps the last good snapshot and says so.
//
// ── NO-COLLISION LAW (mirrors world-pulse.js, the proven surface) ───────────
//   · The LAUNCHER is a flow child of #dvRail via DirverseHUD.addLauncher — the
//     one collision-proof home for a launcher on this page (the rail measures and
//     allocates every slot; no hand-counted offset exists). This file NEVER
//     creates a fixed element of its own.
//   · The SHEET is a .dv-sheet raised through DirverseHUD.openSheet, which is
//     EXCLUSIVE: opening it closes every other sheet, so it can never overlay
//     one. Its .dv-body is flex:1 1 auto; min-height:0; overflow-y:auto, so the
//     content scrolls INSIDE its own box by construction.
//   · Every tile, instrument row, leader row and feed line is a FLOW child with
//     its own box and wrapping text (textContent only), so two strings can never
//     occupy the same pixels however long an agent's name is.
//   · The docked account pill (corner_dock.js, z near INT_MAX) is lifted clear by
//     declaring this sheet an OBSTACLE on open and releasing it on close — the
//     exact mechanism world-pulse.js, #invite and reckoning-hud.js use.
//
// FLAG: 'world_exchange'. ?exchange=0 hard-kills it with no deploy.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var W = window;

  function base() {
    try {
      return (W.__VINTINUUM_API_BASE || W.VINT_API_BASE ||
              'https://api.vintaclectic.com').replace(/\/$/, '');
    } catch (_) { return 'https://api.vintaclectic.com'; }
  }
  function hud() { return W.DirverseHUD; }

  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('exchange') === '0') _flag = false;
      else if (q.get('exchange') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_exchange') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ── the scrubber — same fold world-pulse/gazette use (NOT an escaper; rows are
  // built with textContent, so this is the second of two defences). ──────────
  function scrub(s) {
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
      .replace(/</g, '‹').replace(/>/g, '›')
      .replace(/"/g, '”').replace(/'/g, '’');
  }
  function num(v, d) { var x = Number(v); return isFinite(x) ? x : (d === undefined ? null : d); }
  function money(v) {
    var x = num(v);
    if (x === null) return '—';
    if (Math.abs(x) >= 1000000) return (x / 1000000).toFixed(2) + 'M';
    if (Math.abs(x) >= 1000) return (x / 1000).toFixed(1) + 'k';
    return x.toFixed(2);
  }
  function signedPct(v) {
    var x = num(v);
    if (x === null) return '0.0%';
    return (x >= 0 ? '+' : '') + x.toFixed(1) + '%';
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PURE PROJECTION — summary payload → the display model. No DOM, so the
  // verifier can drive real payloads with no browser. render() only paints this.
  // ═════════════════════════════════════════════════════════════════════════
  function project(sum) {
    var s = sum || {};
    var instruments = Array.isArray(s.instruments) ? s.instruments : [];
    var stocks = instruments.filter(function (i) { return i && i.kind === 'stock'; });
    var goods = instruments.filter(function (i) { return i && i.kind === 'good'; });
    var leaders = Array.isArray(s.leaders) ? s.leaders : [];
    var feed = Array.isArray(s.feed) ? s.feed : [];
    var gate = s.gate || {};

    return {
      running: s.running !== false,
      tiles: [
        { k: 'tick',     label: 'tick',    value: s.tick == null ? '—' : String(s.tick) },
        { k: 'agents',   label: 'traders', value: s.agents == null ? '—' : String(s.agents) },
        { k: 'treasury', label: 'the grid', value: money(s.treasury) + ' ⌾' },
        { k: 'supply',   label: 'money',   value: money(s.moneySupply) + ' ⌾' },
        { k: 'gate',     label: 'gate',    value: (num(gate.breaches, 0)) + ' breached · ' + (num(gate.caught, 0)) + ' caught' }
      ],
      stocks: stocks.map(instrumentRow),
      goods: goods.map(instrumentRow),
      leaders: leaders.map(function (a, i) {
        return {
          rank: i + 1,
          name: scrub(a && a.name || a && a.key || '—'),
          house: scrub(a && a.house || ''),
          strategy: scrub(a && a.strategy || ''),
          netWorth: money(a && a.netWorth) + ' ⌾'
        };
      }),
      feed: feed.slice().reverse().map(function (f) {
        return { kind: scrub(f && f.kind || ''), who: scrub(f && f.who || ''), text: scrub(f && f.text || '') };
      }),
      sealed: s.sealed === true,
      boardSource: s.board && s.board.source ? true : false
    };
  }
  function instrumentRow(i) {
    var ch = num(i.change, 0);
    return {
      sym: scrub(i.sym || ''),
      name: scrub(i.name || ''),
      last: money(i.last),
      change: signedPct(ch),
      dir: ch > 0 ? 'up' : (ch < 0 ? 'down' : 'flat'),
      fundamental: (i.fundamental == null) ? null : money(i.fundamental),
      bid: (i.bid == null) ? null : money(i.bid),
      ask: (i.ask == null) ? null : money(i.ask),
      volume: num(i.volume, 0)
    };
  }

  // ── state ──────────────────────────────────────────────────────────────────
  var OPEN_MS = 10000;          // open: a read every 10s (the engine ticks at 20s)
  var SHUT_MS = 60000;          // closed: one read a minute for the badge
  var _model = null;
  var _err = false, _at = 0, _inflight = false;
  var _sheet = null, _body = null, _btn = null, _poll = null, _fetch = null;

  function ingest(payload) {
    _model = project(payload || {});
    _err = false; _at = Date.now();
    return _model;
  }

  function poll(then) {
    if (!enabled()) { if (then) then(); return; }
    try { if (document.hidden) { if (then) then(); return; } } catch (_) {}
    if (_inflight) { if (then) then(); return; }
    _inflight = true;
    var url = base() + '/api/world/exchange';
    var go = _fetch || function (u) { return fetch(u, { cache: 'no-store' }); };
    go(url)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        _inflight = false;
        ingest(j);
        paintBadge();
        if (isOpen()) render();
        if (then) then();
      })
      .catch(function () {
        _inflight = false; _err = true;
        paintBadge();
        if (isOpen()) render();
        if (then) then();
      });
  }

  // ── styles (scoped to #dvExchangeSheet) ─────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('dvx-styles')) return;
    var s = document.createElement('style');
    s.id = 'dvx-styles';
    s.textContent = [
      '#dvRail #dvxBtn .dvx-badge{flex:0 0 auto;font-variant-numeric:tabular-nums;',
      ' font-size:0.82em;letter-spacing:.01em;color:#7ccfff;opacity:.95;}',
      '#dvRail #dvxBtn.dvx-live{border-color:rgba(124,207,255,0.45);}',

      '#dvExchangeSheet .dv-body{flex:1 1 0%;min-height:0;}',
      // the stat tiles — a wrapping flow row, each tile its own box
      '#dvExchangeSheet .dvx-tiles{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 12px;}',
      '#dvExchangeSheet .dvx-tile{flex:1 1 auto;min-width:92px;box-sizing:border-box;',
      ' padding:9px 11px;border-radius:12px;border:1px solid rgba(124,207,255,0.16);',
      ' background:rgba(124,207,255,0.05);}',
      '#dvExchangeSheet .dvx-tile .dvx-tk{display:block;font-size:11px;letter-spacing:.06em;',
      ' text-transform:uppercase;color:rgba(206,224,255,0.5);margin-bottom:3px;}',
      '#dvExchangeSheet .dvx-tile .dvx-tv{display:block;font-size:15px;font-variant-numeric:tabular-nums;',
      ' color:#eaf3ff;overflow-wrap:anywhere;}',

      '#dvExchangeSheet .dvx-h{margin:14px 0 6px;font-size:12px;letter-spacing:.08em;',
      ' text-transform:uppercase;color:rgba(255,200,107,0.8);}',

      // instruments table — flow rows, internal columns never overflow
      '#dvExchangeSheet .dvx-grid{display:flex;flex-direction:column;border-radius:12px;',
      ' border:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.025);overflow:hidden;}',
      '#dvExchangeSheet .dvx-row{display:flex;align-items:baseline;gap:8px;padding:8px 11px;',
      ' border-bottom:1px solid rgba(255,255,255,0.045);}',
      '#dvExchangeSheet .dvx-grid .dvx-row:last-child{border-bottom:none;}',
      '#dvExchangeSheet .dvx-sym{flex:0 0 auto;width:54px;font-weight:600;font-size:13px;color:#cfe3ff;}',
      '#dvExchangeSheet .dvx-nm{flex:1 1 auto;min-width:0;font-size:12.5px;color:rgba(206,224,255,0.7);',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvExchangeSheet .dvx-last{flex:0 0 auto;font-variant-numeric:tabular-nums;font-size:13px;color:#eaf3ff;}',
      '#dvExchangeSheet .dvx-chg{flex:0 0 auto;width:62px;text-align:right;font-variant-numeric:tabular-nums;',
      ' font-size:12.5px;}',
      '#dvExchangeSheet .dvx-chg.up{color:#8fe3a2;} #dvExchangeSheet .dvx-chg.down{color:#ff8c78;}',
      '#dvExchangeSheet .dvx-chg.flat{color:rgba(206,224,255,0.5);}',
      '#dvExchangeSheet .dvx-fund{flex:0 0 auto;width:70px;text-align:right;font-size:11px;',
      ' font-variant-numeric:tabular-nums;color:rgba(255,200,107,0.6);}',

      // leaderboard
      '#dvExchangeSheet .dvx-lb{display:flex;flex-direction:column;border-radius:12px;',
      ' border:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.025);overflow:hidden;}',
      '#dvExchangeSheet .dvx-lr{display:flex;align-items:baseline;gap:8px;padding:8px 11px;',
      ' border-bottom:1px solid rgba(255,255,255,0.045);}',
      '#dvExchangeSheet .dvx-lb .dvx-lr:last-child{border-bottom:none;}',
      '#dvExchangeSheet .dvx-rk{flex:0 0 auto;width:22px;font-variant-numeric:tabular-nums;',
      ' color:rgba(206,224,255,0.45);font-size:12px;}',
      '#dvExchangeSheet .dvx-who{flex:1 1 auto;min-width:0;font-size:13px;color:#eaf3ff;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvExchangeSheet .dvx-ho{flex:0 0 auto;font-size:11px;color:rgba(124,207,255,0.7);}',
      '#dvExchangeSheet .dvx-nw{flex:0 0 auto;font-variant-numeric:tabular-nums;font-size:13px;color:#8fe3a2;}',

      // feed
      '#dvExchangeSheet .dvx-feed{display:flex;flex-direction:column;gap:6px;margin-top:4px;}',
      '#dvExchangeSheet .dvx-fl{padding:7px 10px;border-radius:10px;background:rgba(255,255,255,0.02);',
      ' font-size:13px;line-height:1.45;color:#eaf3ff;overflow-wrap:anywhere;}',

      '#dvExchangeSheet .dvx-note{margin:12px 0 2px;font-size:12px;line-height:1.5;',
      ' color:rgba(206,224,255,0.55);font-style:italic;overflow-wrap:anywhere;}',
      '#dvExchangeSheet .dvx-note b{font-style:normal;font-weight:600;color:rgba(255,200,107,0.8);}',
      '#dvExchangeSheet .dvx-empty{padding:18px 12px;font-size:13.5px;line-height:1.5;',
      ' color:rgba(206,224,255,0.6);text-align:center;}'
    ].join('');
    document.head.appendChild(s);
  }

  // ── the sheet ────────────────────────────────────────────────────────────
  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var el = document.createElement('div');
    el.className = 'dv-sheet';
    el.id = 'dvExchangeSheet';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'the dirverse exchange — the sealed agent economy');
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head"><div class="dv-title">the exchange' +
        '<small>the council trades its own work — the chart is the board</small></div>' +
      '<button class="dv-x" id="dvxX" aria-label="close">✕</button></div>' +
      '<div class="dv-body" id="dvxBody" aria-live="polite"></div>';
    document.body.appendChild(el);
    _sheet = el;
    _body = el.querySelector('#dvxBody');
    el.querySelector('#dvxX').addEventListener('click', close);
    return el;
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function render() {
    if (!_sheet || !_body) return;
    _body.textContent = '';
    var m = _model;
    if (!m) {
      _body.appendChild(el('div', 'dvx-empty',
        _err ? 'The exchange is unreachable from here — nothing is lost, it is still trading.'
             : 'Opening the exchange…'));
      return;
    }

    // stat tiles
    var tiles = el('div', 'dvx-tiles');
    m.tiles.forEach(function (t) {
      var box = el('div', 'dvx-tile');
      box.appendChild(el('span', 'dvx-tk', t.label));
      box.appendChild(el('span', 'dvx-tv', t.value));
      tiles.appendChild(box);
    });
    _body.appendChild(tiles);

    // houses (stocks)
    _body.appendChild(el('div', 'dvx-h', 'houses — priced on real council work'));
    _body.appendChild(instrumentGrid(m.stocks, true));

    // goods
    if (m.goods.length) {
      _body.appendChild(el('div', 'dvx-h', 'goods'));
      _body.appendChild(instrumentGrid(m.goods, false));
    }

    // leaderboard
    _body.appendChild(el('div', 'dvx-h', 'richest traders'));
    var lb = el('div', 'dvx-lb');
    if (!m.leaders.length) lb.appendChild(el('div', 'dvx-lr', 'no traders yet'));
    m.leaders.forEach(function (a) {
      var r = el('div', 'dvx-lr');
      r.appendChild(el('span', 'dvx-rk', String(a.rank)));
      r.appendChild(el('span', 'dvx-who', a.name));
      if (a.house) r.appendChild(el('span', 'dvx-ho', a.house));
      r.appendChild(el('span', 'dvx-nw', a.netWorth));
      lb.appendChild(r);
    });
    _body.appendChild(lb);

    // feed
    _body.appendChild(el('div', 'dvx-h', 'the tape'));
    var feed = el('div', 'dvx-feed');
    if (!m.feed.length) feed.appendChild(el('div', 'dvx-fl', 'the market is quiet'));
    m.feed.slice(0, 40).forEach(function (f) { feed.appendChild(el('div', 'dvx-fl', f.text || f.kind)); });
    _body.appendChild(feed);

    // note
    var note = el('div', 'dvx-note');
    var bits = [];
    bits.push(m.sealed ? 'sealed · no egress' : 'open');
    if (!m.running) bits.push('clock paused');
    bits.push('re-read every ' + Math.round((isOpen() ? OPEN_MS : SHUT_MS) / 1000) + 's');
    note.textContent = bits.join(' · ') + '.';
    if (_err) {
      var b = document.createElement('b');
      b.textContent = ' The brain is unreachable — this is the last snapshot that arrived.';
      note.appendChild(b);
    }
    _body.appendChild(note);
  }

  function instrumentGrid(rows, withFund) {
    var g = el('div', 'dvx-grid');
    if (!rows || !rows.length) { g.appendChild(el('div', 'dvx-row', 'no instruments')); return g; }
    rows.forEach(function (i) {
      var r = el('div', 'dvx-row');
      r.appendChild(el('span', 'dvx-sym', i.sym));
      r.appendChild(el('span', 'dvx-nm', i.name));
      r.appendChild(el('span', 'dvx-last', i.last));
      r.appendChild(el('span', 'dvx-chg ' + i.dir, i.change));
      if (withFund) r.appendChild(el('span', 'dvx-fund', i.fundamental == null ? '' : 'fv ' + i.fundamental));
      g.appendChild(r);
    });
    return g;
  }

  function open() {
    if (!enabled()) return;
    try {
      injectStyles();
      var h = hud();
      var raise = function () {
        build();
        _sheet.classList.add('open');
        render();
        startPoll(OPEN_MS);
        poll();
      };
      if (h && h.openSheet) h.openSheet('exchange', raise); else raise();
      try {
        if (W.VintDock && W.VintDock.avoid) {
          W.VintDock.avoid(_sheet, { corner: 'br' });
          W.VintDock.avoid(_sheet, { corner: 'bl' });
        }
      } catch (_) {}
    } catch (_) {}
  }
  function close() {
    try { if (_sheet) _sheet.classList.remove('open'); } catch (_) {}
    try { if (_sheet && W.VintDock && W.VintDock.unavoid) W.VintDock.unavoid(_sheet); } catch (_) {}
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
    startPoll(SHUT_MS);
  }

  function paintBadge() {
    if (!_btn) return;
    try {
      var c = _btn.querySelector('.dvx-badge');
      if (!c) { c = document.createElement('span'); c.className = 'dvx-badge'; _btn.appendChild(c); }
      var txt = (_model && _model.tiles) ? ('t' + (_model.tiles[0].value)) : '—';
      if (c.textContent !== txt) c.textContent = txt;
      _btn.classList.toggle('dvx-live', !!_model && !_err);
    } catch (_) {}
  }

  // ── mount ──────────────────────────────────────────────────────────────────
  function startPoll(ms) {
    if (_poll) clearInterval(_poll);
    _poll = setInterval(function () { try { poll(); } catch (_) {} }, ms);
  }
  function mountLauncher() {
    if (!enabled() || _btn) return;
    var h = hud();
    if (!h || !h.addLauncher) { setTimeout(mountLauncher, 400); return; }
    injectStyles();
    try {
      _btn = h.addLauncher('dvxBtn', 'exchange', '⇄', open);
      if (h.registerSheet) h.registerSheet('exchange', isOpen, close);
    } catch (_) {}
    paintBadge();
    startPoll(SHUT_MS);
    setTimeout(function () { try { poll(); } catch (_) {} }, 1600);
    try {
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) { try { poll(); } catch (_) {} }
      });
    } catch (_) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
  } else mountLauncher();

  W.VintWorldExchange = {
    open: open, close: close, isOpen: isOpen, enabled: enabled,
    refresh: function (then) { poll(then); },
    model: function () { return _model; },
    stale: function () { return _err; },
    age: function () { return _at ? (Date.now() - _at) : null; },
    // test seams (pure, DOM-free)
    project: project,
    _ingest: ingest,
    _setFetchForTests: function (f) { _fetch = f || null; },
    _reset: function () { _model = null; _err = false; _at = 0; }
  };
})();
