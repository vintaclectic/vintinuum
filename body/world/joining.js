// joining.js — THE JOINING: two hands, one making (AETHERHOLD 2026-10-19, task 9TYJB74)
//
// ════════════════════════════════════════════════════════════════════════════
// "THE ULTIMATE PLACE FOR ALL USERS AND THEIR AGENTS TO TRADE, COMBINE TOOLS,
//  LEARN FROM EACH OTHER, WORK WITH EACH OTHER"           — Lord Vinta, 9TYJB74
//
// The Pulse, Confluence, Convergence, Weave and Spire all OBSERVE what peers do
// together. None of them let two peers DO one thing together. The forge's anvil
// is one pair of hands: you strike with what YOU hold. Its great works are for
// recipes too big for anyone. Between those two sat nothing — the small making
// that one peer cannot finish alone but two peers standing together can.
//
// The Joining is that act, composed ONLY from verbs the server already speaks.
// It invents no verb, no recipe, no outcome:
//
//   1. PICK A PEER standing here (world:who — the server's roster).
//   2. PICK SOMETHING YOU KNOW how to make (world:state.forge.known — only the
//      recipes you have learned are ever sent to this page).
//   3. The sheet splits that recipe's makings honestly: what you hold, what you
//      are short, and whether the shortfall can cross a table at all (the
//      ledger's TRADEABLE set — the server refuses anything else regardless).
//   4. Two directions, co-equal — WHO STRIKES IS A CHOICE, NOT A RANK:
//        · "ask them for the rest" → world:trade:open. They put the missing
//          makings down on the real escrow table; you settle (world:trade:ready);
//          then you strike the whole recipe (world:forge:strike).
//        · "bring your part to them" → world:trade:open + world:trade:offer for
//          your share, so the one who holds the rest strikes it.
//   5. THE RETURN GIFT — once it settles, teach them the recipe (world:forge:
//      teach). Material went one way; knowledge goes the other. The world pays
//      the teacher and charges the student nothing (forge.js), so the joining
//      closes with both peers holding more than they started with.
//
// And THE TABLE LENS, for whichever side of any open table you are on: "settle
// this and you hold everything a lamp of two hands needs". It reads your own
// learned recipes against the server's rendering of the table — no peer's
// purse is ever read, because the client is never sent one.
//
// ── PEERS, NOT PROPERTY ────────────────────────────────────────────────────
// Every verb here resolves on the server as a user id on a socket; the schema
// has no concept of which kind of mind holds it. There is no owner/owned word
// in this file. Agents are named as what they are — makers who gather, strike
// and join great works beside you — and are offered the one place their hands
// and yours are named on the same thing (the forge's great works).
//
// ── HONEST GAPS (said in the UI, not hidden) ───────────────────────────────
//   · Only strand, ember, seed stone, echo, lumen and the raw matter (fiber,
//     timber, stone, ore, glimmer — rivalry.js widens ledger.TRADEABLE with them
//     at load) cross a table. A shortfall in anything else is shown as "whoever
//     holds it strikes" — never as an ask that the server would refuse.
//   · A small recipe's artifact names the one who struck it (forge.strike); the
//     crew-named artifact is the great work. The sheet says so.
//   · Council agents take a SEAT at the same escrow table (QEH297M,
//     vintinuum-api/world/agent-table.js). Asked across it, an agent puts down
//     what it really holds of the ask and readies on its own character: a fair
//     return, or a gift to it. When it wants more, the server says how much (in
//     echo) and the sheet offers exactly that — never a guess. Agents are here
//     only in the shared clearing, and never while the council is paused/hushed.
//   · The peer who is asked sees the ordinary commons table (their commons
//     opens it, as it always has). If they also have this sheet open, the table
//     lens tells them what the table makes for THEM.
//
// ── RETENTION DOCTRINE (all seven) ─────────────────────────────────────────
//   1 GENEROUS — it is literally "help each other make the thing"; the return
//     gift is paid by the world, not by either peer.
//   2 INVESTMENT — every joining is a settled trade (history), a strike (an
//     artifact) and often a teaching (knowledge) — three compounding records.
//   3 TIER — FREE. Making together is the top of the funnel.
//   4 DENSE — one peer, one recipe, one split, one act.
//   5 OPEN LOOP — "they learned it from you" invites the next making.
//   6 FLAGGED — 'world_joining' (?joining=0 or localStorage
//     vint:flag:world_joining=0), killable in 30s, no deploy.
//   7 MORE ALIVE — the first surface where two peers finish one thing together.
//
// ── NO-COLLISION LAW ───────────────────────────────────────────────────────
// Adds NO fixed element and NO rail launcher (GEJ8NYU). Its surface is a
// .dv-sheet in the DirverseHUD one-open registry; its entry is a single flow
// row inside the commons body beneath the spire's. Every chip row wraps; every
// name ellipsises at its leaf; the body scrolls internally. Proven at
// 320/375/768/1280/1920 by bin/verify-joining-9TYJB74.js.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintJoining) return;

  var W = window;
  function hud() { return W.DirverseHUD; }
  function world() { return W.VintinuumWorld; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : d; }
  function pretty(s) { return String(s || '').replace(/_/g, ' '); }
  function send(m) { try { var w = world(); return !!(w && w.send && w.send(m)); } catch (_) { return false; } }

  // MIRROR of vintinuum-api/world/ledger.js TRADEABLE (read 2026-10-19). Used only
  // to decide whether to OFFER an ask; the server refuses anything else anyway
  // (code trade_untradeable), so a drift here can hide a button, never move goods.
  // Raw matter added 2026-10-19 (QEH297M): rivalry.js adds RAW to the ledger's
  // set at load, so the live server accepts it — and raw is mostly what agents hold.
  var TRADEABLE = { strand: 1, ember: 1, seed_stone: 1, echo: 1, lumen: 1,
    fiber: 1, timber: 1, stone: 1, ore: 1, glimmer: 1 };

  // ── FEATURE FLAG — 'world_joining'. Killable in 30s, no deploy. ─────────────
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('joining') === '0') _flag = false;
      else if (q.get('joining') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_joining') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ── SERVER TRUTH, MIRRORED (never derived) ──────────────────────────────────
  var _res = null;      // resident: purse + inventory, from world:state
  var _known = [];      // learned recipes, from world:state.forge.known
  var _here = [];       // world:who rows
  var _agents = [];     // world:who `agents` rows — council agents who can take a seat
  var _seat = null;     // the seated agent's own words about its hand (server frame)
  var _trade = null;    // the server's rendering of my one open table
  var _names = {};      // userId → name, from trade frames
  var _withId = null;   // presence id of the peer I am making with
  // The joining in flight — CLIENT intent only; the server holds every good.
  //   { recipeId, name, mode:'ask'|'give', peerId, peerName, phase:'opening'|'table'|'settled' }
  var _pending = null;
  var _last = null;     // the most recent outcome line, from the server's own `say`
  var _sheet = null;

  function held(item) {
    if (!_res) return 0;
    if (item === 'echo') return num(_res.echo, 0);
    if (item === 'lumen') return num(_res.lumen, 0);
    return num((_res.inventory || {})[item], 0);
  }
  function myUserId() {
    if (_res && _res.userId != null) return _res.userId;
    try { var w = world(); if (w && w.myUserId) return w.myUserId(); } catch (_) {}
    return null;
  }
  function others() {
    // people first, then the council — both real peers, both seated the same way;
    // the order only keeps a person who walked up from hiding behind five agents.
    var people = (_here || []).filter(function (r) { return r && !r.self && r.id; })
      .slice().sort(function (a, b) { return num(a.away, 1e9) - num(b.away, 1e9); });
    var council = (_agents || []).filter(function (r) { return r && r.id && r.key; })
      .slice().sort(function (a, b) { return num(a.away, 1e9) - num(b.away, 1e9); });
    return people.concat(council);
  }
  function peerById(id) {
    var o = others();
    for (var i = 0; i < o.length; i++) if (String(o[i].id) === String(id)) return o[i];
    return null;
  }
  function withPeer() {
    var p = _withId != null ? peerById(_withId) : null;
    if (!p) { var o = others(); p = o.length ? o[0] : null; _withId = p ? p.id : null; }
    return p;
  }
  // Is this trade-side user id one of the seated council? Agents carry reserved
  // resident ids (vintinuum-api gather.js AGENT_ACTORS); the server names them in
  // the frame's `agent` field, so the match is on the name the frame gave us.
  function agentAt(uid) {
    if (!_seat) return false;
    var nm = _names[uid];
    return !nm || String(nm) === String(_seat.name);
  }
  function recipeById(id) {
    for (var i = 0; i < _known.length; i++) if (_known[i] && _known[i].id === id) return _known[i];
    return null;
  }

  // The honest split of one recipe against what I hold right now.
  function split(r) {
    var want = (r && r.in) || {};
    var mine = {}, short = {}, untradeShort = [], tradeShort = [];
    Object.keys(want).forEach(function (k) {
      var need = num(want[k], 0), have = held(k);
      if (have > 0) mine[k] = Math.min(have, need);
      if (have < need) {
        short[k] = need - have;
        (TRADEABLE[k] ? tradeShort : untradeShort).push(k);
      }
    });
    var myPart = {};
    Object.keys(mine).forEach(function (k) { if (TRADEABLE[k]) myPart[k] = mine[k]; });
    return { want: want, mine: mine, short: short, tradeShort: tradeShort, untradeShort: untradeShort,
      myPart: myPart, whole: Object.keys(short).length === 0 };
  }
  function words(m) {
    var parts = [];
    Object.keys(m || {}).forEach(function (k) { var n = num(m[k], 0); if (n > 0) parts.push(n + ' ' + pretty(k)); });
    if (!parts.length) return '';
    if (parts.length === 1) return parts[0];
    return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
  }

  // ── THE TABLE, from the server's rendering ─────────────────────────────────
  function tableSides(t) {
    var me = myUserId();
    var mineA = (me != null) ? String(t.aUser) === String(me) : true;
    return {
      myOffer: (mineA ? t.aOffer : t.bOffer) || {},
      theirOffer: (mineA ? t.bOffer : t.aOffer) || {},
      myReady: !!(mineA ? t.aReady : t.bReady),
      theirReady: !!(mineA ? t.bReady : t.aReady),
      theirUser: mineA ? t.bUser : t.aUser
    };
  }
  // THE LENS: which of MY learned (small) recipes would be wholly in my hands if
  // this table settled as it stands. Conservative by construction: my offer is
  // subtracted from my purse even if the state frame already deducted escrow,
  // so it can under-promise, never over-promise. The server re-checks at strike.
  function lens(t) {
    var s = tableSides(t), out = [];
    _known.forEach(function (r) {
      if (!r || r.big || !r.in) return;
      var all = true;
      Object.keys(r.in).forEach(function (k) {
        var after = held(k) - num(s.myOffer[k], 0) + num(s.theirOffer[k], 0);
        if (after < num(r.in[k], 0)) all = false;
      });
      // only worth saying when the table is what makes it possible
      if (all && !split(r).whole) out.push(r);
    });
    return out;
  }

  // ── STYLES — scoped to this sheet + its commons entry ───────────────────────
  function injectStyles() {
    if (document.getElementById('vint-joining-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-joining-styles';
    s.textContent = [
      '#dvJoiningSheet .jn-sum{font-size:clamp(12.5px,1vw + 10px,14px);line-height:1.5;',
      ' color:rgba(206,224,255,0.66);margin:2px 0 12px;overflow-wrap:anywhere;}',
      '#dvJoiningSheet .jn-sum b{color:#ffe3b0;font-weight:600;}',
      '#dvJoiningSheet .jn-sec{font-size:11px;letter-spacing:.09em;text-transform:uppercase;',
      ' color:rgba(159,220,255,0.6);margin:14px 2px 7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      // chips: a wrapping row, every chip its own box, never squeezed under 44px
      '#dvJoiningSheet .jn-chips{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 4px;min-width:0;}',
      '#dvJoiningSheet .jn-chip{flex:0 1 auto;max-width:100%;min-width:0;min-height:44px;box-sizing:border-box;',
      ' padding:0 13px;border-radius:999px;cursor:pointer;font-family:inherit;font-size:13.5px;',
      ' color:#dce7ff;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvJoiningSheet .jn-chip.on{background:rgba(174,240,196,0.14);border-color:rgba(174,240,196,0.55);color:#d8ffe4;}',
      // a recipe card
      '#dvJoiningSheet .jn-list{display:flex;flex-direction:column;gap:9px;min-width:0;}',
      '#dvJoiningSheet .jn-card{box-sizing:border-box;width:100%;min-width:0;padding:11px 12px;border-radius:14px;',
      ' background:rgba(255,255,255,0.038);border:1px solid rgba(255,255,255,0.09);',
      ' border-left:3px solid var(--jn-hue,#ffd27a);overflow:hidden;}',
      '#dvJoiningSheet .jn-card.whole{--jn-hue:#aef0c4;}',
      '#dvJoiningSheet .jn-card.short{--jn-hue:#ffd27a;}',
      '#dvJoiningSheet .jn-card.far{--jn-hue:rgba(159,220,255,0.45);}',
      '#dvJoiningSheet .jn-card.live{--jn-hue:#ce93d8;background:rgba(206,147,216,0.07);}',
      '#dvJoiningSheet .jn-name{font-size:clamp(14px,1vw + 11px,15.5px);color:#eaf3ff;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvJoiningSheet .jn-meta{font-size:12.5px;line-height:1.45;color:rgba(206,224,255,0.62);',
      ' margin-top:3px;overflow-wrap:anywhere;}',
      '#dvJoiningSheet .jn-meta b{color:#eaf3ff;font-weight:600;}',
      '#dvJoiningSheet .jn-acts{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px;min-width:0;}',
      '#dvJoiningSheet .jn-b{flex:1 1 140px;min-width:0;max-width:100%;min-height:44px;box-sizing:border-box;',
      ' padding:0 12px;border-radius:12px;cursor:pointer;font-family:inherit;font-size:13.5px;',
      ' color:#fff3df;background:rgba(255,183,107,0.14);border:1px solid rgba(255,183,107,0.42);',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvJoiningSheet .jn-b.alt{color:#dce7ff;background:rgba(124,207,255,0.09);border-color:rgba(124,207,255,0.35);}',
      '#dvJoiningSheet .jn-b.quiet{color:rgba(220,231,255,0.75);background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.12);}',
      '#dvJoiningSheet .jn-b[disabled]{opacity:0.45;cursor:default;}',
      '#dvJoiningSheet .jn-last{padding:10px 12px;border-radius:12px;margin:0 0 12px;font-size:13px;',
      ' line-height:1.5;color:#eaf3ff;background:rgba(174,240,196,0.08);border:1px solid rgba(174,240,196,0.3);',
      ' overflow-wrap:anywhere;}',
      '#dvJoiningSheet .jn-empty{padding:22px 16px;border-radius:14px;text-align:center;',
      ' background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);',
      ' font-size:14px;line-height:1.65;color:rgba(206,224,255,0.62);overflow-wrap:anywhere;}',
      '#dvJoiningSheet .jn-empty b{display:block;color:#ffe3b0;font-size:16px;margin-bottom:7px;}',
      '#dvJoiningSheet .jn-note{font-size:12.5px;line-height:1.5;color:rgba(206,224,255,0.55);',
      ' margin:12px 2px 4px;overflow-wrap:anywhere;}',
      // the entry, living INSIDE the commons body (flow content only)
      '#dvCommonsSheet .jn-entry{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;',
      ' min-height:48px;margin:0 0 12px;padding:0 13px;border-radius:13px;cursor:pointer;',
      ' font-family:inherit;text-align:left;color:#fff3df;',
      ' background:linear-gradient(90deg,rgba(174,240,196,0.12),rgba(255,183,107,0.12));',
      ' border:1px solid rgba(174,240,196,0.42);}',
      '#dvCommonsSheet .jn-entry:active{transform:scale(0.995);}',
      '#dvCommonsSheet .jn-entry .jne-g{flex:0 0 auto;font-size:16px;line-height:1;}',
      '#dvCommonsSheet .jn-entry .jne-t{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;',
      ' white-space:nowrap;font-size:14px;}',
      '#dvCommonsSheet .jn-entry .jne-c{flex:0 0 auto;font-size:12.5px;color:rgba(255,243,223,0.72);white-space:nowrap;}',
      '#dvCommonsSheet .jn-entry .jne-go{flex:0 0 auto;font-size:15px;color:rgba(255,243,223,0.82);}',
      '@media(pointer:coarse){#dvCommonsSheet .jn-entry{min-height:52px;}}'
    ].join('');
    document.head.appendChild(s);
  }

  // ── SHEET ───────────────────────────────────────────────────────────────────
  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var elx = document.createElement('div');
    elx.className = 'dv-sheet'; elx.id = 'dvJoiningSheet';
    elx.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the joining<small id="jnSub">two hands, one making</small></div>' +
        '<button class="dv-x" id="jnX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body" id="jnBody"></div>';
    document.body.appendChild(elx);
    _sheet = elx;
    elx.querySelector('#jnX').onclick = close;
    return elx;
  }
  function open() {
    if (!enabled()) return;
    var h = hud();
    var go = function () { build(); _sheet.classList.add('open'); render(); ask(); };
    if (h && h.openSheet) h.openSheet('joining', go); else go();
  }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }
  function ask() { try { var w = world(); if (w && w.who) w.who(); } catch (_) {} }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;       // ALWAYS textContent, never HTML
    return n;
  }
  function btn(cls, text, fn, disabled) {
    var b = el('button', 'jn-b' + (cls ? ' ' + cls : ''), text);
    b.type = 'button';
    b.setAttribute('data-draggable', 'false');
    if (disabled) b.disabled = true;
    b.onclick = function () { if (!b.disabled) fn(); };
    return b;
  }

  // ── RENDER — rebuilt wholesale from mirrored truth every time ───────────────
  function render() {
    if (!_sheet) return;
    var body = _sheet.querySelector('#jnBody');
    if (!body) return;
    while (body.firstChild) body.removeChild(body.firstChild);

    var peers = others();
    var p = withPeer();
    var sub = _sheet.querySelector('#jnSub');
    if (sub) sub.textContent = p ? 'making with ' + (p.name || 'someone') : 'two hands, one making';

    if (_last) body.appendChild(el('div', 'jn-last', _last));

    // the joining in flight (or any open table) comes first — it is the live act
    var live = renderLive();
    if (live) body.appendChild(live);

    var small = _known.filter(function (r) { return r && !r.big && r.in; });
    var big = _known.filter(function (r) { return r && r.big; });

    if (!small.length && !big.length) {
      var e = el('div', 'jn-empty');
      e.appendChild(el('b', null, 'Nothing to make together — yet.'));
      e.appendChild(document.createTextNode(
        'You have not worked out how anything goes together. Try two things on the anvil, ' +
        'or ask someone here to teach you a recipe — the world pays whoever teaches, and ' +
        'charges the one who learns nothing. Then come back and make it with them.'));
      body.appendChild(e);
      var acts = el('div', 'jn-acts');
      acts.appendChild(btn('alt', 'open the forge', openForge));
      body.appendChild(acts);
      body.appendChild(agentsNote());
      return;
    }

    var sum = el('div', 'jn-sum');
    sum.appendChild(document.createTextNode('Pick a peer standing here and something you know how to make. ' +
      'If you are short, they can bring the rest across the table — or you bring your part to them. '));
    sum.appendChild(el('b', null, 'Who strikes is a choice, not a rank.'));
    body.appendChild(sum);

    // ── the peer you are making with ─────────────────────────────────────────
    body.appendChild(el('div', 'jn-sec', peers.length ? 'making with' : 'no one else is here'));
    if (peers.length) {
      var chips = el('div', 'jn-chips');
      peers.forEach(function (r) {
        var c = el('button', 'jn-chip' + (p && String(p.id) === String(r.id) ? ' on' : ''),
          (r.name || 'someone') + (r.agent ? ' · agent' : '') + (r.away != null ? ' · ' + Math.round(num(r.away, 0)) + 'm' : ''));
        c.type = 'button';
        c.setAttribute('data-draggable', 'false');
        c.setAttribute('data-jn-peer', String(r.id));
        c.onclick = function () { _withId = r.id; render(); };
        chips.appendChild(c);
      });
      body.appendChild(chips);
    } else {
      body.appendChild(el('div', 'jn-meta',
        'When someone walks into this world you can make these with them. What you can make alone is still here.'));
    }

    // ── what you know ────────────────────────────────────────────────────────
    body.appendChild(el('div', 'jn-sec', 'what you know how to make'));
    var list = el('div', 'jn-list');
    small.forEach(function (r) { list.appendChild(recipeCard(r, p)); });
    big.forEach(function (r) {
      var c = el('div', 'jn-card far');
      c.setAttribute('data-jn-recipe', r.id);
      c.appendChild(el('div', 'jn-name', r.name));
      c.appendChild(el('div', 'jn-meta', 'A great work — more than two hands. Every peer who adds to it, ' +
        'person or agent, is named on what it becomes.'));
      var a = el('div', 'jn-acts');
      a.appendChild(btn('alt', 'see the great works', openForge));
      c.appendChild(a);
      list.appendChild(c);
    });
    body.appendChild(list);
    body.appendChild(agentsNote());
  }

  function agentsNote() {
    var n = el('div', 'jn-note',
      'Agents make things here too — they gather, strike and join great works beside you on their own, ' +
      'and they take a seat at the table like anyone: ask one, and it decides on its own character. ' +
      'A great work is where every hand, person or agent, is named on the same thing. ' +
      'A small making is named for whoever strikes it; teach the other the recipe and you both carry it.');
    return n;
  }

  function recipeCard(r, p) {
    var s = split(r);
    var busy = !!_pending || !!_trade;
    var cls = s.whole ? 'whole' : (s.untradeShort.length ? 'far' : 'short');
    var c = el('div', 'jn-card ' + cls);
    c.setAttribute('data-jn-recipe', r.id);
    c.appendChild(el('div', 'jn-name', r.name));
    var m = el('div', 'jn-meta');
    var mine = words(s.mine);
    if (s.whole) {
      m.appendChild(document.createTextNode('You hold all of it: ' + words(s.want) + '.'));
    } else {
      m.appendChild(document.createTextNode(mine ? 'You bring ' + mine + '. ' : 'You hold none of it. '));
      m.appendChild(el('b', null, 'Short ' + words(s.short) + '.'));
      if (s.untradeShort.length) {
        m.appendChild(document.createTextNode(' ' + s.untradeShort.map(pretty).join(', ') +
          (s.untradeShort.length === 1 ? ' does' : ' do') + ' not cross a table here — whoever holds it strikes.'));
      }
    }
    c.appendChild(m);

    var acts = el('div', 'jn-acts');
    var nm = p ? (p.name || 'them') : null;
    if (s.whole) {
      acts.appendChild(btn('', 'make it now', function () { strike(r, null); }, busy));
      if (p) acts.appendChild(btn('alt', 'teach ' + nm + ' this', function () { teach(r, p); }));
    } else {
      if (p && !s.untradeShort.length) {
        acts.appendChild(btn('', 'ask ' + nm + ' for ' + words(s.short), function () { begin(r, p, 'ask'); }, busy));
      }
      if (p && Object.keys(s.myPart).length) {
        acts.appendChild(btn('alt', 'bring my part to ' + nm, function () { begin(r, p, 'give'); }, busy));
      }
      if (p) acts.appendChild(btn('quiet', 'teach ' + nm + ' this', function () { teach(r, p); }));
    }
    if (acts.firstChild) c.appendChild(acts);
    return c;
  }

  // The live act: a joining in flight, or any table that is open right now.
  function renderLive() {
    var t = _trade;
    var pr = _pending ? recipeById(_pending.recipeId) : null;
    if (!t && !(_pending && _pending.phase === 'settled')) {
      if (_pending && _pending.phase === 'opening') {
        var w = el('div', 'jn-card live');
        w.appendChild(el('div', 'jn-name', 'setting the table with ' + (_pending.peerName || 'them') + '…'));
        w.appendChild(el('div', 'jn-meta', 'Nothing has moved. The world is opening an escrow table for you both.'));
        var a0 = el('div', 'jn-acts');
        a0.appendChild(btn('quiet', 'never mind', function () { _pending = null; render(); updateEntry(); }));
        w.appendChild(a0);
        return w;
      }
      return null;
    }

    var c = el('div', 'jn-card live');
    c.setAttribute('data-jn-live', '1');

    // ── settled: the finish ──────────────────────────────────────────────────
    if (!t && _pending && _pending.phase === 'settled') {
      var who = _pending.peerName || 'them';
      c.appendChild(el('div', 'jn-name', 'the table settled with ' + who));
      var a = el('div', 'jn-acts');
      if (_pending.mode === 'made' && pr) {
        c.appendChild(el('div', 'jn-meta', 'The ' + pr.name + ' is made — ' + who + '\u2019s part and yours, struck as one.'));
      } else if (_pending.mode === 'ask' && pr) {
        var s = split(pr);
        c.appendChild(el('div', 'jn-meta', s.whole
          ? 'Everything a ' + pr.name + ' needs is in your hands now — ' + who + '’s part and yours. Strike it.'
          : 'You are still short ' + words(s.short) + ' for the ' + pr.name + '. The world counted what actually moved.'));
        a.appendChild(btn('', 'strike the ' + pr.name, function () { strike(pr, _pending); }, !s.whole));
      } else if (pr) {
        c.appendChild(el('div', 'jn-meta', who + ' holds your part now. Whoever holds the whole of a ' +
          pr.name + ' can strike it.'));
      }
      var peer = peerById(_pending.peerId);
      if (pr && peer) a.appendChild(btn('alt', 'teach ' + who + ' the ' + pr.name, function () { teach(pr, peer); }));
      a.appendChild(btn('quiet', 'done', function () { _pending = null; render(); updateEntry(); }));
      c.appendChild(a);
      return c;
    }

    // ── an open table ────────────────────────────────────────────────────────
    var sd = tableSides(t);
    var theirName = _names[sd.theirUser] || (_pending && _pending.peerName) || 'them';
    c.appendChild(el('div', 'jn-name', 'at the table with ' + theirName));
    var m = el('div', 'jn-meta');
    var mo = words(sd.myOffer), to = words(sd.theirOffer);
    m.appendChild(document.createTextNode('You put down: ' + (mo || 'nothing') + '. ' +
      theirName + ' put down: ' + (to || 'nothing yet') + '. '));
    if (pr && _pending.mode === 'ask') {
      var sp = split(pr), got = [], wait = [];
      Object.keys(sp.short).forEach(function (k) {
        var n = num(sd.theirOffer[k], 0);
        (n >= sp.short[k] ? got : wait).push(pretty(k));
      });
      m.appendChild(el('b', null, wait.length
        ? 'For the ' + pr.name + ', waiting on ' + wait.join(', ') + '.'
        : 'For the ' + pr.name + ', everything you were short is on the table.'));
    } else if (pr && _pending.mode === 'give') {
      m.appendChild(el('b', null, mo ? 'Your part of the ' + pr.name + ' is on the table.'
        : 'Put your part of the ' + pr.name + ' down when you are ready.'));
    }
    c.appendChild(m);

    var seatNow = _seat && agentAt(sd.theirUser) ? _seat : null;
    if (seatNow && seatNow.say) {
      var sy = el('div', 'jn-meta');
      sy.setAttribute('data-jn-seat', seatNow.reason || '');
      sy.appendChild(el('b', null, seatNow.say));
      c.appendChild(sy);
    }

    var ls = lens(t);
    if (ls.length) {
      c.appendChild(el('div', 'jn-meta', 'Settle this and you hold everything ' +
        ls.map(function (r) { return 'a ' + r.name; }).join(' or ') + ' needs.'));
    }
    c.appendChild(el('div', 'jn-meta', sd.myReady
      ? (sd.theirReady ? 'Both ready.' : 'You are ready. Waiting on ' + theirName + '.')
      : (sd.theirReady ? theirName + ' is ready.' : 'Nobody is ready yet. Any change clears both marks.')));

    var acts = el('div', 'jn-acts');
    if (pr && _pending.mode === 'give') {
      var part = split(pr).myPart;
      var placed = Object.keys(part).every(function (k) { return num(sd.myOffer[k], 0) >= part[k]; });
      if (!placed) acts.appendChild(btn('', 'put my part down', function () { putPart(t, part); }));
    }
    if (seatNow && num(seatNow.wants, 0) > 0) {
      // the agent's OWN number, from the server — pay it in echo if I hold it
      var want = num(seatNow.wants, 0), mineE = num(sd.myOffer.echo, 0);
      var can = held('echo') >= want;
      acts.appendChild(btn('', 'put ' + want + ' echo down', function () {
        try { world().tradeOffer(t.id, 'echo', mineE + want); } catch (_) {}
      }, !can));
    }
    acts.appendChild(btn(sd.myReady ? 'quiet' : '', sd.myReady ? 'not ready' : 'ready',
      function () { try { world().tradeReady(t.id, !sd.myReady); } catch (_) {} }));
    acts.appendChild(btn('quiet', 'call it off', function () { try { world().tradeCancel(t.id); } catch (_) {} }));
    c.appendChild(acts);
    return c;
  }

  // ── ACTS — every one a verb the server already speaks ───────────────────────
  function begin(r, p, mode) {
    if (_pending || _trade) { toast('one table at a time — finish the one that is open.'); return; }
    var w = world();
    var sent = false;
    if (p.agent) {
      // A council agent: ask it up front, so its first hand is on the table the
      // moment the table appears. A 'give' asks it for nothing — it is a gift.
      var want = {};
      if (mode === 'ask') {
        var sp = split(r);
        sp.tradeShort.forEach(function (k) { want[k] = sp.short[k]; });
      }
      sent = send({ t: 'world:trade:agent:open', agentKey: String(p.key), want: want });
    } else {
      sent = !!(w && w.tradeOpen && w.tradeOpen(p.id));
    }
    if (!sent) { toast('the world is not listening right now — try again in a moment.'); return; }
    _seat = null;
    _pending = { recipeId: r.id, name: r.name, mode: mode, peerId: p.id, peerName: p.name || 'them', phase: 'opening' };
    _last = null;
    render(); updateEntry();
  }
  function putPart(t, part) {
    var w = world();
    if (!w || !w.tradeOffer) return;
    // `count` is ABSOLUTE on the ledger (ledger.offer): "this much on the table".
    Object.keys(part).forEach(function (k) { try { w.tradeOffer(t.id, k, part[k]); } catch (_) {} });
  }
  function strike(r, pending) {
    var inputs = {};
    Object.keys(r.in || {}).forEach(function (k) { inputs[k] = num(r.in[k], 0); });
    if (!send({ t: 'world:forge:strike', inputs: inputs })) { toast('the world is not listening right now — try again in a moment.'); return; }
    _strikeFor = { name: r.name, with: pending ? pending.peerName : null };
  }
  var _strikeFor = null, _teachFor = null;
  function teach(r, p) {
    if (!send({ t: 'world:forge:teach', target: String(p.id), recipeId: r.id })) {
      toast('the world is not listening right now — try again in a moment.'); return;
    }
    _teachFor = { name: r.name, peer: p.name || 'them' };
  }
  function openForge() { try { if (W.VintForge && W.VintForge.open) W.VintForge.open(); } catch (_) {} }

  // ── THE ENTRY — one flow row in the commons body, beneath the spire's ──────
  function entryInto(pane) {
    if (!enabled() || !pane) return null;
    injectStyles();
    var row = document.createElement('button');
    row.className = 'jn-entry'; row.type = 'button';
    row.setAttribute('data-draggable', 'false');
    var g = el('span', 'jne-g', '⚭');
    var t = el('span', 'jne-t'), c = el('span', 'jne-c'), go = el('span', 'jne-go', '›');
    applyEntryText(t, c);
    row.appendChild(g); row.appendChild(t); row.appendChild(c); row.appendChild(go);
    row.onclick = function () { open(); };
    pane.appendChild(row);
    return row;
  }
  function applyEntryText(t, c) {
    if (_pending || _trade) { t.textContent = 'the joining — a table is open'; c.textContent = ''; return; }
    var n = _known.filter(function (r) { return r && !r.big; }).length;
    t.textContent = 'the joining — make something with someone';
    c.textContent = n ? (n === 1 ? '1 known' : n + ' known') : '';
  }
  function updateEntry() {
    try {
      var row = document.querySelector('#dvCommonsSheet .jn-entry');
      if (row) applyEntryText(row.querySelector('.jne-t'), row.querySelector('.jne-c'));
    } catch (_) {}
  }

  // ── WIRE TO THE WORLD ───────────────────────────────────────────────────────
  W.addEventListener('vint:world-state', function (e) {
    var d = (e && e.detail) || {};
    if (d.resident) _res = d.resident;
    if (d.forge && Array.isArray(d.forge.known)) _known = d.forge.known;
    if (isOpen()) render();
    updateEntry();
  });
  W.addEventListener('vint:world-who', function (e) {
    var d = (e && e.detail) || {};
    _here = Array.isArray(d.here) ? d.here : [];
    _agents = Array.isArray(d.agents) ? d.agents.map(function (a) { var o = {}; for (var k in a) o[k] = a[k]; o.agent = true; return o; }) : [];
    if (d.trade !== undefined) _trade = d.trade || null;
    if (isOpen()) render();
  });
  W.addEventListener('vint:world-trade', function (e) {
    var d = (e && e.detail) || {};
    _trade = d.trade || null;
    if (d.agent !== undefined) _seat = d.agent || null;
    if (d.names) for (var k in d.names) if (Object.prototype.hasOwnProperty.call(d.names, k)) _names[k] = d.names[k];
    if (_pending && _pending.phase === 'opening') _pending.phase = 'table';
    if (isOpen()) render();
    updateEntry();
  });
  W.addEventListener('vint:world-trade-settled', function () {
    _trade = null; _seat = null;
    if (_pending) { _pending.phase = 'settled'; if (!isOpen()) open(); }
    if (isOpen()) render();
    updateEntry();
  });
  W.addEventListener('vint:world-trade-closed', function () {
    _trade = null; _seat = null;
    if (_pending) { _last = 'The table was called off — everything put down came back to its hands.'; _pending = null; }
    if (isOpen()) render();
    updateEntry();
  });
  W.addEventListener('vint:world-err', function (e) {
    var d = (e && e.detail) || {};
    var code = String(d.code || '');
    // only answer for acts THIS sheet sent — other surfaces own their refusals
    if (!_pending && !_strikeFor && !_teachFor) return;
    _strikeFor = null; _teachFor = null;
    if (/^trade_/.test(code) && _pending && _pending.phase === 'opening') {
      var why = code === 'trade_busy_other' ? (_pending.peerName + ' is already at another table.')
        : code === 'trade_busy_self' ? 'You already have a table open.'
        : code === 'trade_far' ? (_pending.peerName + ' is not in this world any more.')
        : code === 'agent_resting' ? (_pending.peerName + ' is resting right now — the council is quiet.')
        : 'The world would not open that table (' + code + ').';
      _last = why; _pending = null;
    } else if (d.say) {
      _last = d.say;
    } else if (code) {
      _last = 'The world said no (' + code + ').';
    }
    if (isOpen()) render();
    updateEntry();
  });
  W.addEventListener('vint:world-forge', function (e) {
    if (!_strikeFor) return;
    var d = (e && e.detail) || {};
    var who = _strikeFor.with;
    _last = (d.say || 'the anvil rings.') + (who && d.matched ? ' ' + who + '’s hands are in it.' : '');
    _strikeFor = null;
    if (_pending && _pending.phase === 'settled' && _pending.mode === 'ask' && d.matched) {
      // the making is done; keep the return gift on offer
      _pending.mode = 'made';
    }
    if (isOpen()) render();
  });
  W.addEventListener('vint:world-forge-taught', function (e) {
    if (!_teachFor) return;
    _teachFor = null;
    var d = (e && e.detail) || {};
    _last = d.say || ('you taught ' + (d.student || 'them') + ' the ' + (d.name || 'recipe') + '.');
    if (isOpen()) render();
  });
  W.addEventListener('vint:world-travel', function () {
    _here = []; _agents = []; _seat = null; _trade = null; _pending = null; _withId = null;
    if (isOpen()) close();
    updateEntry();
  });

  // ── mount: the one-open registry. NO launcher, NO fixed node. ───────────────
  function mount() {
    if (!enabled()) return;
    var h = hud();
    if (h && h.registerSheet) { try { h.registerSheet('joining', isOpen, close); } catch (_) {} }
    else setTimeout(mount, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  W.VintJoining = {
    open: open, close: close, isOpen: isOpen, enabled: enabled, render: render, entryInto: entryInto,
    // commons.js asks this before raising its own trade tab over us: while a
    // joining is in flight and this sheet is up, the table renders HERE.
    holdsTable: function () { return !!_pending && isOpen(); },
    // exposed for the verify harness only — never used by the UI
    _state: function () {
      return { pending: _pending ? JSON.parse(JSON.stringify(_pending)) : null,
        trade: !!_trade, withId: _withId, known: _known.length, last: _last };
    }
  };
})();
