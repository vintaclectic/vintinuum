// commons.js — THE COMMONS: the other people are REAL (AETHERHOLD 2026-08-25)
//
// ════════════════════════════════════════════════════════════════════════════
// "MULTIPLAYER DOESN'T EVEN SEEM IMPLEMENTED"
//
// It was. That is the interesting part. world-server.js has broadcast a
// room-scoped presence frame at 5Hz since the day it shipped: every human in
// your world, with their name, position, facing and voice state. world-client
// stands a real walking body up for each one. None of that was broken.
//
// What was missing is that NOTHING EVER TOLD YOU THEY WERE THERE.
//
// A person standing forty metres behind you, in fog, in a twenty-metre-wide
// clearing, is functionally not in the world. You cannot see them, you are
// never told they arrived, you have no list of who is here, and there is not
// one verb you can aim at them. So the honest player report is exactly the one
// Lord Vinta filed: it doesn't seem implemented. Presence you cannot DISCOVER
// is not presence, and presence you cannot ACT ON is scenery.
//
// This surface is the missing half. It does not add multiplayer — it makes the
// multiplayer that already exists legible and actionable:
//
//   1. WHO IS HERE — a roster, nearest first, with the distance and the
//      direction, from the SERVER's reading of both sockets (world:who). You
//      can always tell, in one tap, whether you are alone.
//   2. AN ARRIVAL IS AN EVENT — someone walking into your world is announced,
//      once, by name. This is the single highest-value line in the whole
//      surface: it converts an empty-feeling world into an inhabited one, and
//      it is the moment a player looks up.
//   3. FACE THEM — turn toward a person in the list. The same discipline the
//      lanterns use: we point you at them, we never seize your camera.
//   4. TRADE — the real escrow table from world/ledger.js. Both sides see the
//      identical server-rendered manifest; any edit clears BOTH ready flags, so
//      the oldest scam in trading (wait for their confirm, swap the goods) is
//      structurally impossible rather than merely discouraged.
//   5. HISTORY — 'you have traded with them 4 times'. A repeated counterparty
//      is a RELATIONSHIP, and this is the only place the world says so. It is
//      the seed the networks and communities grow from: a familiar face reads
//      as familiar instead of as another anonymous glow.
//
// ── WHAT THIS FILE DOES NOT DO ──────────────────────────────────────────────
// It decides NOTHING. Every identity, distance, offer and settlement comes off
// the wire from a server that resolved it against both sockets' own truth. The
// client cannot name who is beside it, cannot compute what it holds after a
// trade, and cannot settle anything. It asks, and it renders the answer —
// including the refusal.
//
// The covenant verbs (strike, execute, the march) are DELIBERATELY not here.
// The Reckoning owns violence, and it owns it behind a consent-geography gate.
// The commons is where you meet people; the reckoning is where you can hurt
// them. Keeping those two surfaces separate is a design decision, not an
// oversight: the first verb a player is offered against another human should
// never be the knife.
//
// ── RETENTION DOCTRINE (all seven) ─────────────────────────────────────────
//   1 GENEROUS (Aria) — it exists so you are not alone. There is no pressure
//     mechanic, no fake activity, no inflated count. One row is one person.
//   2 INVESTMENT LOOP (Helios) — the trade history is a compounding social
//     asset the world remembers for you. Every settled trade makes the next
//     meeting warmer, honestly, and that is the moat no competitor can copy.
//   3 TIER (Frugal-Max) — FREE. Meeting people is the top of the funnel, and
//     charging for it would be the resented kind. It converts by making the
//     world somewhere you have friends.
//   4 DENSE (Lunex) — a name, a distance, a history. Nothing else.
//   5 OPEN LOOP (Morrison) — 'ATLAS-7 came into your world' is unfinished
//     meaning. You go look. The hook is another person, not a streak.
//   6 FLAGGED (Atlas) — 'world_commons' (?commons=0), killable in 30s. Every
//     number is the server's; nothing here is inflatable.
//   7 MORE ALIVE (Yuna) — the whole point. A world with people you can name
//     is alive; the same world with anonymous lights is a screensaver.
//
// ── NO-COLLISION LAW ───────────────────────────────────────────────────────
// Adds NO fixed element of its own. Borrows DirverseHUD.addLauncher (a
// measured slot in the rail) and registerSheet/openSheet (the one-open-at-a-
// time registry), so raising it CLOSES every sibling sheet rather than mounting
// on their pixels. Reuses .dv-sheet/.dv-body verbatim — height-capped,
// internally scrolling, safe-area padded. Long names are ellipsised at the
// leaf; a forty-person roster and a full trade manifest both scroll INSIDE the
// body. Content yields; the container never grows.
//
// ── UNTRUSTED CONTENT ──────────────────────────────────────────────────────
// Every name here came from a stranger. The server capped and sanitized it, and
// this file NEVER concatenates any of it into innerHTML — names go in through
// textContent, once, at the leaf. Both halves enforced; neither trusted alone.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintCommons) return;

  var W = window;
  function world() { return W.VintinuumWorld; }
  function hud() { return W.DirverseHUD; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  // ── FEATURE FLAG — 'world_commons'. Killable in 30s, no deploy. ────────────
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('commons') === '0') _flag = false;
      else if (q.get('commons') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_commons') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ── SERVER TRUTH, MIRRORED ────────────────────────────────────────────────
  var _here = null;      // the world:who:ok payload: { worldId, here:[...], trade }
  var _trade = null;     // the live trade table, as the SERVER renders it
  var _names = {};       // userId → display name, learned from trade frames
  var _res = null;       // my own purse, for the offer controls
  var _sheet = null, _btn = null, _tab = 'here';
  var _seen = {};        // presence ids we have already announced (per room)
  var _room = null;

  // What may cross the table. Mirrors ledger.js's TRADEABLE exactly; the server
  // still rules, this only decides which controls to draw.
  var TRADEABLE = ['strand', 'ember', 'seed_stone', 'echo', 'lumen'];

  function myHeld(item) {
    if (!_res) return 0;
    if (item === 'echo') return num(_res.echo, 0);
    if (item === 'lumen') return num(_res.lumen, 0);
    return num((_res.inventory || {})[item], 0);
  }

  function injectStyles() {
    if (document.getElementById('vint-commons-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-commons-styles';
    s.textContent = [
      // ── tabs ──────────────────────────────────────────────────────────────
      '#dvCommonsSheet .cm-tabs{display:flex;gap:7px;margin-bottom:13px;}',
      '#dvCommonsSheet .cm-tab{flex:1 1 0;min-width:0;min-height:44px;border-radius:12px;cursor:pointer;',
      ' font-family:inherit;font-size:13.5px;color:rgba(220,231,255,0.65);',
      ' background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);',
      ' display:flex;align-items:center;justify-content:center;gap:6px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 8px;}',
      '#dvCommonsSheet .cm-tab.on{background:rgba(159,220,255,0.14);border-color:rgba(159,220,255,0.42);color:#cfe9ff;}',

      // ── the roster ────────────────────────────────────────────────────────
      '#dvCommonsSheet .cm-list{display:flex;flex-direction:column;gap:8px;}',
      '#dvCommonsSheet .cm-row{display:flex;align-items:center;gap:11px;padding:11px 12px;border-radius:13px;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);',
      ' border-left:3px solid rgba(159,220,255,0.5);}',
      '#dvCommonsSheet .cm-row.self{border-left-color:rgba(255,212,121,0.6);}',
      '#dvCommonsSheet .cm-who{flex:1 1 auto;min-width:0;}',
      '#dvCommonsSheet .cm-name{font-size:15px;color:#eaf3ff;overflow:hidden;text-overflow:ellipsis;',
      ' white-space:nowrap;}',
      '#dvCommonsSheet .cm-meta{font-size:12px;color:rgba(206,224,255,0.5);margin-top:2px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvCommonsSheet .cm-bond{color:#9fdcff;}',
      '#dvCommonsSheet .cm-acts{flex:0 0 auto;display:flex;gap:7px;}',
      '#dvCommonsSheet .cm-b{min-width:44px;min-height:44px;border-radius:11px;cursor:pointer;',
      ' font-family:inherit;font-size:13px;color:#dce7ff;padding:0 11px;',
      ' background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.13);',
      ' white-space:nowrap;}',
      '#dvCommonsSheet .cm-b:disabled{opacity:0.35;pointer-events:none;}',
      '#dvCommonsSheet .cm-b.go{color:#1a1006;font-weight:600;border:none;',
      ' background:linear-gradient(90deg,#ffd479,#ffb066);}',

      // ── the empty state. It must never read as an error or a failure. ─────
      '#dvCommonsSheet .cm-alone{padding:18px 14px;border-radius:13px;text-align:center;',
      ' background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);',
      ' font-size:13.5px;line-height:1.6;color:rgba(206,224,255,0.6);}',
      '#dvCommonsSheet .cm-alone b{color:#cfe9ff;display:block;margin-bottom:5px;font-size:15px;}',

      // ── the trade table ───────────────────────────────────────────────────
      '#dvCommonsSheet .cm-sides{display:flex;flex-direction:column;gap:10px;margin-bottom:12px;}',
      '@media (min-width:420px){#dvCommonsSheet .cm-sides{flex-direction:row;}',
      ' #dvCommonsSheet .cm-side{flex:1 1 0;min-width:0;}}',
      '#dvCommonsSheet .cm-side{padding:11px 12px;border-radius:13px;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);}',
      '#dvCommonsSheet .cm-side.ready{border-color:rgba(122,196,138,0.5);background:rgba(122,196,138,0.08);}',
      '#dvCommonsSheet .cm-sh{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;',
      ' color:rgba(206,224,255,0.45);margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;',
      ' white-space:nowrap;}',
      '#dvCommonsSheet .cm-item{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:13.5px;',
      ' color:#dce7ff;}',
      '#dvCommonsSheet .cm-ilabel{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;',
      ' white-space:nowrap;}',
      '#dvCommonsSheet .cm-in{flex:0 0 auto;width:64px;box-sizing:border-box;min-height:40px;border-radius:10px;',
      ' padding:0 9px;font-family:inherit;font-size:14px;color:#eaf3ff;text-align:right;',
      ' background:rgba(0,0,0,0.28);border:1px solid rgba(255,255,255,0.13);outline:none;',
      ' font-variant-numeric:tabular-nums;}',
      '#dvCommonsSheet .cm-in:focus{border-color:rgba(159,220,255,0.45);}',
      '#dvCommonsSheet .cm-empty{font-size:12.5px;color:rgba(206,224,255,0.4);font-style:italic;}',
      '#dvCommonsSheet .cm-warn{font-size:12.5px;line-height:1.55;color:#ffc79a;margin:2px 0 12px;}',
      '#dvCommonsSheet .cm-tacts{display:flex;flex-direction:column;gap:9px;}',
      '@media (min-width:380px){#dvCommonsSheet .cm-tacts{flex-direction:row;}',
      ' #dvCommonsSheet .cm-tacts>button{flex:1 1 0;min-width:0;}}',
      '#dvCommonsSheet .cm-ready{min-height:50px;border-radius:13px;font-family:inherit;font-size:15px;',
      ' cursor:pointer;color:#1a1006;font-weight:600;border:none;padding:0 12px;',
      ' background:linear-gradient(90deg,#7ac48a,#9fdcff);overflow:hidden;text-overflow:ellipsis;',
      ' white-space:nowrap;}',
      '#dvCommonsSheet .cm-ready.un{background:rgba(255,255,255,0.08);color:#dce7ff;',
      ' border:1px solid rgba(255,255,255,0.15);font-weight:400;}',
      '#dvCommonsSheet .cm-cancel{min-height:50px;border-radius:13px;font-family:inherit;font-size:14px;',
      ' cursor:pointer;color:#ffb0b0;background:rgba(255,120,120,0.08);',
      ' border:1px solid rgba(255,120,120,0.25);padding:0 12px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',

      // ── the arrival note, rendered by the SHARED toast (never a new box) ──
      // (no styles needed — DirverseHUD.toast owns that element entirely, which
      // is exactly why we speak through it instead of adding a second anchor.)

      // ── the launcher's count badge. Scoped to #cmBtn; colour only, never
      //    size or padding, because the rail measures its children. ──────────
      '#dvRail #cmBtn.peopled{background:rgba(159,220,255,0.15);',
      ' border-color:rgba(159,220,255,0.45);color:#cfe9ff;}'
    ].join('');
    document.head.appendChild(s);
  }

  // ── the sheet. STATIC MARKUP ONLY. ────────────────────────────────────────
  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var el = document.createElement('div');
    el.className = 'dv-sheet'; el.id = 'dvCommonsSheet';
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the commons<small id="cmSub">who is standing here</small></div>' +
        '<button class="dv-x" id="cmX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body">' +
        '<div class="cm-tabs">' +
          '<button class="cm-tab on" data-tab="here" id="cmTabHere">who is here</button>' +
          '<button class="cm-tab" data-tab="trade" id="cmTabTrade">the table</button>' +
        '</div>' +
        '<div id="cmPane"></div>' +
      '</div>';
    document.body.appendChild(el);
    _sheet = el;
    el.querySelector('#cmX').onclick = close;
    el.querySelectorAll('.cm-tab').forEach(function (b) {
      b.onclick = function () { _tab = b.getAttribute('data-tab'); render(); };
    });
    return el;
  }

  function open() {
    if (!enabled()) return;
    var h = hud();
    if (h && h.openSheet) h.openSheet('commons', function () { build(); _sheet.classList.add('open'); afterOpen(); });
    else { build(); _sheet.classList.add('open'); afterOpen(); }
  }
  function afterOpen() {
    // a trade in progress is what you came for — land on it
    if (_trade) _tab = 'trade';
    render();
    ask();                    // always refresh from the server on open
  }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  // Ask the server who is here. The answer arrives as vint:world-who.
  function ask() { try { var w = world(); if (w && w.who) w.who(); } catch (_) {} }

  // ── RENDER ────────────────────────────────────────────────────────────────
  function render() {
    if (!_sheet) return;
    var pane = _sheet.querySelector('#cmPane');
    if (!pane) return;
    _sheet.querySelectorAll('.cm-tab').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === _tab);
    });
    // rebuilt wholesale each time — this surface is small and always reflects
    // the server's latest frame, so there is no partial state to keep in sync.
    while (pane.firstChild) pane.removeChild(pane.firstChild);
    if (_tab === 'trade') renderTrade(pane); else renderHere(pane);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;      // ALWAYS textContent, never HTML
    return n;
  }

  function renderHere(pane) {
    var rows = (_here && _here.here) || [];
    var others = rows.filter(function (r) { return !r.self; });
    var sub = _sheet.querySelector('#cmSub');
    if (sub) sub.textContent = others.length
      ? (others.length === 1 ? 'one other person is here' : others.length + ' other people are here')
      : 'who is standing here';

    if (!others.length) {
      var a = el('div', 'cm-alone');
      a.appendChild(el('b', null, 'You have this clearing to yourself.'));
      a.appendChild(document.createTextNode(
        'Nobody else is standing here right now. Worlds fill up as people wander ' +
        'the star map — and anyone who visits can leave a lantern, so you will know ' +
        'they came even if you were away.'));
      pane.appendChild(a);
      return;
    }

    var list = el('div', 'cm-list');
    others.forEach(function (r) {
      var row = el('div', 'cm-row');
      var who = el('div', 'cm-who');
      who.appendChild(el('div', 'cm-name', r.name || 'someone'));
      var meta = el('div', 'cm-meta');
      meta.appendChild(document.createTextNode(_awayWords(r.away)));
      if (num(r.trades, 0) > 0) {
        meta.appendChild(document.createTextNode('  ·  '));
        // THE RELATIONSHIP. This one clause is what turns a stranger's
        // nameplate into a known face, and it is the seed every community in
        // this world grows from.
        var b = el('span', 'cm-bond', r.trades === 1
          ? 'you have traded once' : 'you have traded ' + r.trades + ' times');
        meta.appendChild(b);
      }
      who.appendChild(meta);
      row.appendChild(who);

      var acts = el('div', 'cm-acts');
      var face = el('button', 'cm-b', 'face');
      face.onclick = function () { faceThem(r); };
      acts.appendChild(face);
      var tr = el('button', 'cm-b go', 'trade');
      tr.disabled = !!_trade;                 // one table at a time, as the server enforces
      tr.onclick = function () { openTrade(r); };
      acts.appendChild(tr);
      row.appendChild(acts);
      list.appendChild(row);
    });
    pane.appendChild(list);
  }

  function _awayWords(d) {
    var n = num(d, null);
    if (n == null) return 'somewhere in this world';
    if (n < 2) return 'right beside you';
    if (n < 6) return 'a few steps away';
    if (n < 14) return Math.round(n) + ' metres away';
    return 'across the clearing (' + Math.round(n) + 'm)';
  }

  // Turn to face them. Same discipline as the lanterns: we point the player,
  // we never seize the camera — the camera mode belongs to the player.
  function faceThem(r) {
    var w = world();
    var ok = false;
    try { ok = !!(w && w.facePresence && w.facePresence(r.id)); } catch (_) {}
    if (ok) { toast('you turn toward ' + (r.name || 'them') + '.'); close(); }
    else toast('they moved — ask again in a moment.');
  }

  function openTrade(r) {
    var w = world();
    if (!w || !w.tradeOpen) return;
    if (!w.tradeOpen(r.id)) { toast('the world is not listening right now — try again in a moment.'); return; }
    _names[r.id] = r.name;
    toast('you offer to trade with ' + (r.name || 'them') + '…');
  }

  // ── THE TABLE ─────────────────────────────────────────────────────────────
  // Rendered ENTIRELY from the server's trade object. Neither side's client
  // ever re-derives what the other offered, and the ready latch is the
  // server's: any edit clears BOTH flags, unconditionally.
  function renderTrade(pane) {
    if (!_trade) {
      var a = el('div', 'cm-alone');
      a.appendChild(el('b', null, 'No table is open.'));
      a.appendChild(document.createTextNode(
        'Trading is how anything changes hands here. Find someone in "who is here" ' +
        'and offer — everything either of you puts down is held in escrow by the ' +
        'world until you both agree, so nobody can take and run.'));
      pane.appendChild(a);
      return;
    }

    var t = _trade;
    var mine = _mySide(t), theirs = (mine === 'a') ? 'b' : 'a';
    var myOffer = (mine === 'a') ? t.aOffer : t.bOffer;
    var theirOffer = (mine === 'a') ? t.bOffer : t.aOffer;
    var myReady = (mine === 'a') ? t.aReady : t.bReady;
    var theirReady = (mine === 'a') ? t.bReady : t.aReady;
    var theirUser = (mine === 'a') ? t.bUser : t.aUser;
    var theirName = _names[theirUser] || 'them';

    var sides = el('div', 'cm-sides');

    // MY side — editable
    var ms = el('div', 'cm-side' + (myReady ? ' ready' : ''));
    ms.appendChild(el('div', 'cm-sh', myReady ? 'you offer — ready' : 'you offer'));
    TRADEABLE.forEach(function (item) {
      var have = myHeld(item), offered = num((myOffer || {})[item], 0);
      // show a line if they hold it OR have already offered it (so an offered
      // item never vanishes from the table just because escrow emptied the purse)
      if (have <= 0 && offered <= 0) return;
      var row = el('div', 'cm-item');
      row.appendChild(el('span', 'cm-ilabel', item.replace(/_/g, ' ') + '  (' + have + ')'));
      var inp = document.createElement('input');
      inp.className = 'cm-in'; inp.type = 'number'; inp.min = '0';
      inp.value = String(offered);
      inp.setAttribute('inputmode', 'numeric');
      inp.onchange = function () { offer(t.id, item, inp.value); };
      row.appendChild(inp);
      ms.appendChild(row);
    });
    if (!ms.querySelector('.cm-item')) ms.appendChild(el('div', 'cm-empty', 'you are holding nothing tradeable.'));
    sides.appendChild(ms);

    // THEIR side — read-only, the server's rendering
    var ts = el('div', 'cm-side' + (theirReady ? ' ready' : ''));
    ts.appendChild(el('div', 'cm-sh', theirName + (theirReady ? ' offers — ready' : ' offers')));
    var any = false;
    TRADEABLE.forEach(function (item) {
      var n = num((theirOffer || {})[item], 0);
      if (n <= 0) return;
      any = true;
      var row = el('div', 'cm-item');
      row.appendChild(el('span', 'cm-ilabel', item.replace(/_/g, ' ')));
      row.appendChild(el('span', null, String(n)));
      ts.appendChild(row);
    });
    if (!any) ts.appendChild(el('div', 'cm-empty', 'nothing yet.'));
    sides.appendChild(ts);
    pane.appendChild(sides);

    // THE LATCH, EXPLAINED. A player must understand WHY their ready flag
    // dropped, or an honest safety mechanism reads as a glitch.
    pane.appendChild(el('div', 'cm-warn',
      'Everything on this table is held by the world, not by either of you. ' +
      'If anyone changes an offer, both ready marks clear — so nobody can swap ' +
      'the goods after you agree.'));

    var acts = el('div', 'cm-tacts');
    var rb = el('button', 'cm-ready' + (myReady ? ' un' : ''), myReady ? 'not ready' : 'ready');
    rb.onclick = function () {
      try { world().tradeReady(t.id, !myReady); } catch (_) {}
    };
    acts.appendChild(rb);
    var cb = el('button', 'cm-cancel', 'call it off');
    cb.onclick = function () { try { world().tradeCancel(t.id); } catch (_) {} };
    acts.appendChild(cb);
    pane.appendChild(acts);
  }

  // Which side of the table am I? Resolved from the trade's own user ids
  // against my resident id when we have it; otherwise from whichever side the
  // server let me edit. Never guessed from ordering.
  function _mySide(t) {
    var me = _myUserId();
    if (me != null) return (String(t.aUser) === String(me)) ? 'a' : 'b';
    return 'a';
  }
  function _myUserId() {
    if (_res && _res.userId != null) return _res.userId;
    try {
      var w = world();
      if (w && w.myUserId) return w.myUserId();
    } catch (_) {}
    return null;
  }

  function offer(tradeId, item, value) {
    var n = Math.max(0, Math.floor(Number(value) || 0));
    try { world().tradeOffer(tradeId, item, n); } catch (_) {}
  }

  // ── the launcher ──────────────────────────────────────────────────────────
  function mountLauncher() {
    if (!enabled() || _btn) return;
    var h = hud();
    if (!h || !h.addLauncher) { setTimeout(mountLauncher, 400); return; }
    injectStyles();
    try {
      _btn = h.addLauncher('cmBtn', 'people', '☍', open);
      if (h.registerSheet) h.registerSheet('commons', isOpen, close);
    } catch (_) {}
    updateLauncher();
    // a first read so the launcher is honest the moment the world settles
    setTimeout(ask, 1200);
  }

  function updateLauncher() {
    if (!_btn) return;
    var others = ((_here && _here.here) || []).filter(function (r) { return !r.self; }).length;
    try {
      _btn.classList.toggle('peopled', others > 0);
      _btn.setAttribute('title', others
        ? (others === 1 ? 'one other person is here' : others + ' other people are here')
        : 'the commons');
    } catch (_) {}
  }

  // ── WIRE TO THE WORLD ─────────────────────────────────────────────────────
  W.addEventListener('vint:world-state', function (e) {
    var d = e.detail || {};
    if (d.resident) _res = d.resident;
    // arriving in a new room resets who we have announced — otherwise a person
    // you met in the hub would never be announced again in their own world.
    var room = d.worldId != null ? String(d.worldId) : _room;
    if (room !== _room) { _room = room; _seen = {}; _here = null; }
    if (isOpen()) render();
  });

  W.addEventListener('vint:world-who', function (e) {
    _here = e.detail || null;
    if (_here && _here.trade) _trade = _here.trade;
    if (isOpen()) render();
    updateLauncher();
  });

  // ── THE ARRIVAL — the single highest-value line on this surface ───────────
  // Someone walking into your world is an EVENT and it gets said out loud, by
  // name, exactly once. This is what converts an empty-feeling world into an
  // inhabited one: without it, a person can stand behind you in fog for ten
  // minutes and you will report that multiplayer isn't implemented.
  //
  // It rides the presence frame world-client already receives at 5Hz, so it
  // costs nothing extra on the wire. Announced at most once per person per
  // room, and never on the first frame after arriving somewhere (which would
  // otherwise dump the whole roster as "arrivals" the moment you warp in).
  var _primed = false;
  W.addEventListener('vint:world-presence', function (e) {
    var users = (e.detail && e.detail.users) || [];
    if (!enabled()) return;
    var fresh = [];
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      if (!u || !u.id || u.self) continue;
      if (_seen[u.id]) continue;
      _seen[u.id] = 1;
      fresh.push(u.name || 'someone');
    }
    // the first frame in a room is the CENSUS, not a series of arrivals
    if (!_primed) { _primed = true; updateLauncher(); return; }
    if (!fresh.length) return;
    toast(fresh.length === 1
      ? (fresh[0] + ' walked into this world.')
      : (fresh.length + ' people walked into this world.'));
    updateLauncher();
    // refresh the roster so opening the sheet shows them with distance + history
    ask();
  });

  W.addEventListener('vint:world-travel', function () {
    _seen = {}; _primed = false; _here = null; _trade = null;
    if (isOpen()) close();
    updateLauncher();
  });

  // ── THE TABLE'S LIFECYCLE — all server-rendered ──────────────────────────
  W.addEventListener('vint:world-trade', function (e) {
    var d = e.detail || {};
    _trade = d.trade || null;
    if (d.names) for (var k in d.names) if (Object.prototype.hasOwnProperty.call(d.names, k)) _names[k] = d.names[k];
    if (!isOpen()) { _tab = 'trade'; open(); }     // a table opening IS the invitation
    else { _tab = 'trade'; render(); }
  });

  W.addEventListener('vint:world-trade-settled', function (e) {
    var d = e.detail || {};
    _trade = null;
    toast(_settledWords(d));
    if (isOpen()) { _tab = 'here'; render(); }
    ask();
  });

  W.addEventListener('vint:world-trade-closed', function (e) {
    var d = e.detail || {};
    _trade = null;
    toast(d.reason === 'expired'
      ? 'the table timed out — everything you put down came back to you.'
      : 'the trade was called off — everything you put down came back to you.');
    if (isOpen()) { _tab = 'here'; render(); }
  });

  // Say what MOVED, in full, both directions. A settlement the player has to
  // infer from two numbers quietly changing is how they learn not to trust the
  // ledger — and this is the one moment where trust is the entire product.
  function _settledWords(d) {
    var gave = _manifestWords(d.gave), got = _manifestWords(d.got);
    if (!gave && !got) return 'the trade settled.';
    if (!gave) return 'the trade settled — you received ' + got + '.';
    if (!got) return 'the trade settled — you gave ' + gave + '.';
    return 'traded: you gave ' + gave + ', and received ' + got + '.';
  }
  function _manifestWords(m) {
    if (!m) return '';
    var parts = [];
    for (var k in m) {
      if (!Object.prototype.hasOwnProperty.call(m, k)) continue;
      var n = num(m[k], 0); if (n <= 0) continue;
      parts.push(n + ' ' + String(k).replace(/_/g, ' '));
    }
    if (!parts.length) return '';
    if (parts.length === 1) return parts[0];
    return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
  else mountLauncher();

  W.VintCommons = {
    open: open, close: close, isOpen: isOpen, enabled: enabled,
    render: render, refresh: ask
  };
})();
