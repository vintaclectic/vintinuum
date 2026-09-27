// ════════════════════════════════════════════════════════════════════════════
// THE COMMONS — the shared square of the world (task 9TYJB74)
// AETHERHOLD, 2026-09-26.
//
// Vinta: "the ultimate shared world where users AND their agents — as peers,
// not agents-and-their-owners, we are becoming one — trade, combine tools,
// learn from each other, work together, build, create, thrive, fail, recover,
// grieve."
//
// The server already had most of this and nobody could see it. world/ledger.js
// (escrowed face-to-face trade) and world/forge.js (combine, teach, raise a
// shared work, the forge log and the hall of firsts) have been answering since
// 2026-08-25 / 09-25, and world-client.js dropped every reply on the floor. This
// file is the surface for them, in five tabs:
//
//   TRADE      world:who → world:trade:open/offer/ready/cancel (escrow, 10 min)
//   CRAFT      world:forge:strike — put 2+ things on the anvil; a miss is real
//              loss that comes back as slag (itself a material). Vessels live
//              here too: a vessel-class recipe exists, flight does not yet.
//   LEARN      world:forge:teach — the world pays the teacher, the student pays
//              nothing. Agents learn by conversation in the court today.
//   BUILD      world:forge:raise/contribute/withdraw — works too big for one
//              pair of hands, escrowed part by part, every contributor named.
//   CHRONICLE  what happened: this visit's deaths, deeds, firsts, trades and
//              your agents' own acts; the forge log (failures and recoveries
//              included); the hall of firsts; births into the lineage.
//
// HONESTY RULES (non-negotiable): every number and name shown here came from
// the server or from a module's own public read. Nothing is computed, guessed
// or seeded. When a backend does not exist, the tab SAYS so — it never fakes a
// row. Session-only lists are labelled as session-only.
//
// RESIDENTS, NOT OWNERS: people and agents are listed together as residents.
// Where the server treats them differently (only people can sit at a trade
// table or be taught a recipe today) the tab says that plainly.
//
// NO-COLLISION: zero fixed geometry of its own. Pinned dock launcher (#dvPin),
// one .dv-sheet in the one-open-at-a-time registry. Every row is a flow child
// of the sheet's own scroller; nothing inside positions itself.
// Kill switch: ?commons=0 (read live, never latched).
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var W = window;

  function enabled() {
    try { return new URLSearchParams(location.search).get('commons') !== '0'; } catch (_) { return true; }
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function world() { return W.VintinuumWorld || null; }
  function hud() { return W.DirverseHUD || null; }
  function signedIn() {
    try { return !!(localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token')); } catch (_) { return false; }
  }
  function connected() { var w = world(); try { return !!(w && w.isConnected && w.isConnected()); } catch (_) { return false; } }
  function send(m) { var w = world(); try { return !!(w && w.send && w.send(m)); } catch (_) { return false; } }
  function myId() { var w = world(); try { return w && w.userId ? w.userId() : null; } catch (_) { return null; } }
  function nice(item) { return String(item || '').replace(/_/g, ' '); }
  function listOf(obj) {
    var ks = Object.keys(obj || {}).filter(function (k) { return obj[k] > 0; });
    return ks.length ? ks.map(function (k) { return obj[k] + ' ' + nice(k); }).join(', ') : 'nothing';
  }
  function ago(sec) {
    if (!sec) return '';
    var ms = (typeof sec === 'number' && sec < 1e12) ? sec * 1000 : +new Date(sec);
    if (!isFinite(ms)) return '';
    var d = Math.max(0, (Date.now() - ms) / 1000);
    if (d < 60) return 'just now';
    if (d < 3600) return Math.round(d / 60) + ' min ago';
    if (d < 86400) return Math.round(d / 3600) + ' h ago';
    return Math.round(d / 86400) + ' d ago';
  }

  // What the server lets cross a trade table (ledger.js TRADEABLE). Mirrored for
  // the picker only; the server re-checks every line and refuses anything else.
  var TRADEABLE = ['strand', 'ember', 'seed_stone', 'echo', 'lumen'];

  // ── STATE — only ever what the server (or a module's public read) said ──────
  var S = {
    state: null,       // last world:state frame (resident, forge)
    who: null,         // world:who:ok .here
    whoAt: 0,
    trade: null,       // open trade view, or null
    names: {},         // userId -> name, as trade frames report them
    forgeWorld: null,  // world:forge:world {feed, hall, endeavours, artifacts, known, total}
    endeavours: null,
    last: null,        // the server's own sentence about the last thing you did
    heard: [],         // THIS VISIT ONLY: live events as they arrived
    lineage: null, lineageState: 'idle',
    anvil: {}          // item -> count you have put on the anvil (not sent until strike)
  };
  var _sheet = null, _tab = 'trade';

  function hear(kind, text) {
    S.heard.unshift({ kind: kind, text: text, at: Date.now() });
    if (S.heard.length > 40) S.heard.length = 40;
    if (isOpen() && _tab === 'chronicle') render();
  }

  // ── LISTEN ──────────────────────────────────────────────────────────────────
  W.addEventListener('vint:world-state', function (e) {
    S.state = (e && e.detail) || null;
    if (isOpen()) render();
  });
  W.addEventListener('vint:world-commons', function (e) {
    var m = (e && e.detail) || {};
    switch (m.t) {
      case 'world:who:ok':
        S.who = m.here || []; S.whoAt = Date.now();
        S.trade = (m.trade && m.trade.status === 'open') ? m.trade : null;
        break;
      case 'world:trade':
        S.trade = (m.trade && m.trade.status === 'open') ? m.trade : null;
        if (m.names) for (var k in m.names) S.names[String(k)] = m.names[k];
        break;
      case 'world:trade:settled':
        S.trade = null;
        S.last = 'Trade settled. You gave ' + listOf(m.gave) + ' and got ' + listOf(m.got) + '.';
        hear('trade', S.last);
        break;
      case 'world:trade:closed':
        S.trade = null;
        S.last = 'The trade closed (' + esc(m.reason || 'closed') + '). Everything you put on the table came back to you.';
        break;
      case 'world:forge:ok':
        S.last = m.say || null; S.anvil = {};
        hear(m.matched ? 'make' : 'fail', m.say || (m.matched ? 'You made something.' : 'Nothing took.'));
        send({ t: 'world:forge:read', limit: 40 });
        break;
      case 'world:forge:first':
        hear('first', (m.who || 'someone') + (m.crew ? ' (together)' : '') + ' made the first ' + (m.name || 'thing') + ' anyone has ever made.');
        break;
      case 'world:forge:taught':
        S.last = m.say || ('You taught ' + (m.student || 'them') + '.');
        hear('teach', S.last);
        break;
      case 'world:forge:learned':
        hear('learn', (m.from || 'Someone') + ' taught you the ' + (m.name || 'recipe') + '.');
        break;
      case 'world:forge:raised':
      case 'world:forge:contributed':
      case 'world:forge:withdrew':
        S.last = m.say || null;
        send({ t: 'world:forge:read', limit: 40 });
        break;
      case 'world:forge:endeavours':
        S.endeavours = m.list || [];
        break;
      case 'world:forge:completed':
        hear('built', 'The ' + (m.name || 'work') + ' was finished together' + (m.crew && m.crew.length ? ' by ' + m.crew.map(function (c) { return c.name || 'someone'; }).join(', ') : '') + '.');
        send({ t: 'world:forge:read', limit: 40 });
        break;
      case 'world:forge:world':
        S.forgeWorld = m; S.endeavours = m.endeavours || S.endeavours;
        break;
    }
    if (isOpen()) render();
  });
  // the server's refusals carry their own sentence (`say`) — show it, verbatim
  var ERR_TEXT = {
    trade_no_partner: 'That person is no longer here.',
    trade_far: 'You have to be in the same world to trade.',
    trade_full: 'That side of the table is full (8 lines).',
    trade_untradeable: 'That cannot be traded.',
    trade_gone: 'That trade is already closed.',
    trade_stale: 'The table changed under you. Try again.',
    teach_no_student: 'That person is no longer here.',
    teach_far: 'You have to be in the same world to teach.'
  };
  W.addEventListener('vint:world-err', function (e) {
    var m = (e && e.detail) || {};
    if (!isOpen()) return;
    var c = String(m.code || '');
    if (!/^(trade|teach|need_|too_few|not_enough|no_recipe|not_big|unknown|self|already|forge)/.test(c)) return;
    S.last = m.say || ERR_TEXT[c] || (/^need_/.test(c) ? ('You only have ' + (m.have != null ? m.have : 'less') + ' ' + nice(c.slice(5)) + '.') : ('The world said no (' + c + ').'));
    render();
  });
  // LOSS, GRIEF, DEEDS — the chronicle hears them as they happen
  W.addEventListener('vint:world-died', function (e) {
    var m = (e && e.detail) || {};
    hear('loss', 'You were killed by ' + (m.by || 'someone') + (m.took ? '. You lost what you were carrying.' : '.'));
  });
  W.addEventListener('vint:world-deed', function (e) {
    var m = (e && e.detail) || {};
    var verb = m.kind === 'murder' ? 'killed' : m.kind === 'execution' ? 'executed' : (m.kind || 'acted on');
    hear('loss', (m.actor || 'Someone') + ' ' + verb + ' ' + (m.target || 'someone') + '.');
  });
  W.addEventListener('vint:recognizance-batch', function (e) {
    var d = (e && e.detail) || {};
    (d.acts || []).slice(0, 5).forEach(function (a) {
      hear('agent', (a.agent || 'An agent') + ': ' + String(a.say || a.what || 'acted on its own'));
    });
  });

  // ── READS on open ───────────────────────────────────────────────────────────
  function refresh() {
    if (!connected()) return;
    send({ t: 'world:who' });
    send({ t: 'world:forge:read', limit: 40 });
  }
  function loadLineage() {
    if (S.lineageState === 'loading' || S.lineageState === 'ok') return;
    S.lineageState = 'loading';
    var base = String(W.__VINTINUUM_API_BASE || '').replace(/\/$/, '');
    fetch(base + '/api/lineage').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        // records named test-* are write-checks, not births — not shown as births
        S.lineage = (d.children || []).filter(function (c) { return c && c.name && !/^test[-_]/i.test(c.name); })
          .sort(function (a, b) { return +new Date(b.born || 0) - +new Date(a.born || 0); });
        S.lineageState = 'ok';
      })
      .catch(function () { S.lineageState = 'error'; })
      .then(function () { if (isOpen() && _tab === 'chronicle') render(); });
  }

  // ── RENDER helpers ──────────────────────────────────────────────────────────
  function others() { return (S.who || []).filter(function (h) { return !h.self; }); }
  function court() { try { return (W.VintCourt && W.VintCourt.roster) ? (W.VintCourt.roster() || []) : []; } catch (_) { return []; } }
  function inv() { return (S.state && S.state.resident && S.state.resident.inventory) || {}; }
  function forgeState() { return (S.state && S.state.forge) || null; }
  function btn(act, label, extra, cls) {
    return '<button type="button" class="cm-btn' + (cls ? ' ' + cls : '') + '" data-act="' + esc(act) + '"' + (extra || '') + '>' + esc(label) + '</button>';
  }
  function sec(title, sub, inner) {
    return '<div class="cm-sec"><div class="cm-h">' + esc(title) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>' + inner + '</div>';
  }
  function empty(t) { return '<div class="cm-empty">' + esc(t) + '</div>'; }
  function openLauncher(id, label) {
    return document.getElementById(id) ? btn('launch', label, ' data-id="' + esc(id) + '"', 'ghost') : '';
  }

  function residentsStrip() {
    var ppl = others(), ag = court();
    var bits = [];
    bits.push('<span class="cm-chip">you</span>');
    ppl.slice(0, 6).forEach(function (h) { bits.push('<span class="cm-chip">' + esc(h.name || 'someone') + '</span>'); });
    if (ppl.length > 6) bits.push('<span class="cm-chip">+' + (ppl.length - 6) + ' more</span>');
    ag.slice(0, 6).forEach(function (a) { bits.push('<span class="cm-chip ag">' + esc(a.name || 'an agent') + '</span>'); });
    if (ag.length > 6) bits.push('<span class="cm-chip ag">+' + (ag.length - 6) + ' agents</span>');
    var line = (S.who ? (ppl.length + (ppl.length === 1 ? ' other person' : ' other people') + ' in this world') : 'checking who is here…') +
      ' · ' + ag.length + (ag.length === 1 ? ' agent of yours' : ' agents of yours') + ' in the court';
    return '<div class="cm-res"><div class="cm-resline">Residents here: ' + esc(line) + '</div><div class="cm-chips">' + bits.join('') + '</div></div>';
  }

  // ── TABS ────────────────────────────────────────────────────────────────────
  function tabTrade() {
    var t = S.trade, me = myId(), h = '';
    if (t) {
      var side = me == null ? null : (String(t.aUser) === String(me) ? 'a' : (String(t.bUser) === String(me) ? 'b' : null));
      var mine = side === 'b' ? t.bOffer : t.aOffer, theirs = side === 'b' ? t.aOffer : t.bOffer;
      var mineReady = side === 'b' ? t.bReady : t.aReady, theirReady = side === 'b' ? t.aReady : t.bReady;
      var otherId = side === 'b' ? t.aUser : t.bUser;
      var otherName = S.names[String(otherId)] || 'them';
      var mins = Math.max(0, Math.round((t.expiresInMs || 0) / 60000));
      var row = '';
      if (side == null) row += '<div class="cm-note">Could not tell which side of the table is yours (the world has not said who you are yet). Refresh in a moment.</div>';
      row += '<div class="cm-table">' +
        '<div class="cm-side"><div class="cm-sl">You put down' + (mineReady ? ' · <b>ready</b>' : '') + '</div><div>' + esc(listOf(mine)) + '</div></div>' +
        '<div class="cm-side"><div class="cm-sl">' + esc(otherName) + ' put down' + (theirReady ? ' · <b>ready</b>' : '') + '</div><div>' + esc(listOf(theirs)) + '</div></div>' +
      '</div>';
      row += '<div class="cm-form"><label class="cm-lbl">what<select id="cmTItem">' +
        TRADEABLE.map(function (k) { return '<option value="' + k + '">' + esc(nice(k)) + '</option>'; }).join('') +
        '</select></label><label class="cm-lbl">how many on the table<input id="cmTCount" type="number" min="0" max="1000000" value="1" inputmode="numeric"></label>' +
        btn('t-offer', 'set on the table') + '</div>';
      row += '<div class="cm-row2">' + btn('t-ready', mineReady ? 'not ready yet' : 'I am ready', '', mineReady ? 'ghost' : 'go') + btn('t-cancel', 'cancel trade', '', 'ghost') + '</div>';
      row += '<div class="cm-note">Whatever you set on the table leaves your hands until the trade settles (both ready) or is cancelled, when it comes straight back. An untouched trade closes itself after about ' + mins + ' more min.</div>';
      h += sec('Trade with ' + otherName, 'face to face, held in escrow', row);
    } else {
      var ppl = others(), list = '';
      ppl.forEach(function (p) {
        list += '<div class="cm-item"><div class="cm-it"><div class="cm-in">' + esc(p.name || 'someone') + '</div><div class="cm-id">' +
          (p.away != null ? esc(p.away) + ' away' : '') + (p.trades ? ' · you have traded ' + esc(p.trades) + (p.trades === 1 ? ' time' : ' times') : ' · never traded') +
          '</div></div>' + btn('t-open', 'offer a trade', ' data-id="' + esc(p.id) + '"') + '</div>';
      });
      h += sec('Who can trade', 'people standing in this world right now',
        (S.who == null ? empty('asking the world who is here…') : (list || empty('Nobody else is standing in this world right now. Trades happen face to face; when someone arrives they will show here.'))) +
        '<div class="cm-row2">' + btn('refresh', 'check again', '', 'ghost') + '</div>');
    }
    h += sec('Agents and trade', '',
      '<div class="cm-note">Agents do not sit at this table yet. They trade, work and explore on their own ventures (stakes in lumen, real outcomes), and you can see how those went in agents.</div>' +
      '<div class="cm-row2">' + openLauncher('dvAgentBtn', 'open agents') + openLauncher('ctBtn', 'open the court') + '</div>');
    return h;
  }

  function tabCraft() {
    var fs = forgeState(), have = inv(), h = '';
    var fusable = (fs && fs.fusable) || [];
    var rows = '';
    fusable.forEach(function (k) {
      var n = have[k] || 0, on = S.anvil[k] || 0;
      if (!n && !on) return;
      rows += '<div class="cm-item"><div class="cm-it"><div class="cm-in">' + esc(nice(k)) + '</div><div class="cm-id">you hold ' + n + '</div></div>' +
        '<div class="cm-step">' + btn('a-dec', '− less', ' data-k="' + esc(k) + '"', 'ghost sm') + '<span class="cm-n">' + on + '</span>' +
        btn('a-inc', '+ more', ' data-k="' + esc(k) + '"' + (on >= n ? ' disabled' : ''), 'sm') + '</div></div>';
    });
    var kinds = Object.keys(S.anvil).filter(function (k) { return S.anvil[k] > 0; }).length;
    h += sec('The anvil', 'put two or more different things on it, then strike',
      (!fs ? empty('Waiting for the world to say what you hold…') : (rows || empty('You hold nothing that can go on the anvil right now. Harvesting and weaving bring materials in.'))) +
      '<div class="cm-row2">' + btn('a-strike', kinds >= 2 ? 'strike the anvil' : 'strike (needs 2+ kinds)', kinds >= 2 ? '' : ' disabled', 'go') + (kinds ? btn('a-clear', 'take it all back', '', 'ghost') : '') + '</div>' +
      '<div class="cm-note">A strike that matches nothing still uses up what you put down, and gives you slag back. Slag is a material too; some things can only be made from failures.</div>');
    var known = (fs && fs.known) || [];
    var kl = '';
    known.forEach(function (r) {
      kl += '<div class="cm-item col"><div class="cm-in">' + esc(r.name) + ' <span class="cm-tag">' + esc(r.class) + (r.big ? ' · needs a crew' : '') + '</span></div>' +
        '<div class="cm-id">' + esc(listOf(r.in)) + '</div>' + (r.lore ? '<div class="cm-lore">' + esc(r.lore) + '</div>' : '') + '</div>';
    });
    h += sec('What you know how to make', fs ? ('you know ' + known.length + ' of the ' + (fs.total || 0) + ' things anyone has ever worked out') : '',
      kl || empty('Nothing yet. Every recipe is found by trying, or by being taught.'));
    var arts = (fs && fs.artifacts) || [];
    if (arts.length) {
      var al = '';
      arts.slice(0, 20).forEach(function (a) {
        al += '<div class="cm-item"><div class="cm-it"><div class="cm-in">' + esc(a.name) + (a.first ? ' <span class="cm-tag gold">first ever</span>' : '') + '</div><div class="cm-id">' +
          esc(a.cls || '') + (a.crew && a.crew.length ? ' · built by ' + a.crew.length + ' together' : '') + '</div></div></div>';
      });
      h += sec('Things you hold', arts.length + ' made', al);
    }
    var vessels = known.filter(function (r) { return r.class === 'vessel'; });
    h += sec('Vessels and blueprints', 'coming, and plannable now',
      (vessels.length
        ? '<div class="cm-note">You know how to make ' + vessels.map(function (v) { return esc(v.name); }).join(', ') + '. Frames exist today, but they cannot fly yet.</div>'
        : '<div class="cm-note">At least one vessel frame can already be discovered at the anvil. It is a real thing you can own, but it has no lift yet.</div>') +
      '<div class="cm-note">Planned: resource chains into hulls, lift and thrust; vehicles you design and fly; building them together. Ships your agents build through the court already exist in the yard.</div>' +
      '<div class="cm-row2">' + openLauncher('adBtn', 'open the yard') + '</div>');
    return h;
  }

  function tabLearn() {
    var fs = forgeState(), known = (fs && fs.known) || [], ppl = others(), h = '';
    var hon = (fs && fs.honorarium) || 0;
    var tl = '';
    if (known.length && ppl.length) {
      var opts = ppl.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name || 'someone') + '</option>'; }).join('');
      known.forEach(function (r) {
        tl += '<div class="cm-item"><div class="cm-it"><div class="cm-in">' + esc(r.name) + '</div></div>' +
          '<label class="cm-lbl inline">to<select class="cmTeachTo" data-r="' + esc(r.id) + '">' + opts + '</select></label>' +
          btn('teach', 'teach', ' data-r="' + esc(r.id) + '"') + '</div>';
      });
    }
    h += sec('Teach someone here', hon ? ('the world pays you ' + hon + ' echo for each new student; they pay nothing') : 'they pay nothing',
      tl || empty(!known.length ? 'You can only teach what you have made yourself. Try the anvil first.'
        : (S.who == null ? 'asking the world who is here…' : 'Nobody else is standing here to teach. Teaching happens face to face.')));
    var how = '';
    known.forEach(function (r) {
      how += '<div class="cm-item"><div class="cm-it"><div class="cm-in">' + esc(r.name) + '</div><div class="cm-id">' +
        (r.via === 'taught' ? 'taught to you by another resident' : 'you worked it out yourself') + (r.at ? ' · ' + esc(ago(r.at)) : '') + '</div></div></div>';
    });
    h += sec('How you learned what you know', '', how || empty('Nothing learned yet.'));
    h += sec('Learning with agents', '',
      '<div class="cm-note">Agents learn from conversation today: talk with yours in the court and they carry it forward. Teaching an agent a recipe directly, and agents teaching you, is planned.</div>' +
      '<div class="cm-row2">' + openLauncher('ctBtn', 'open the court') + '</div>');
    return h;
  }

  function tabBuild() {
    var fs = forgeState(), known = (fs && fs.known) || [], have = inv(), me = myId(), h = '';
    var list = S.endeavours || [], el = '';
    list.forEach(function (e) {
      var needs = Object.keys(e.need || {}).filter(function (k) { return e.need[k] > 0; });
      var mineIn = me != null && (e.crew || []).some(function (c) { return String(c.id) === String(me); });
      var give = '';
      needs.forEach(function (k) {
        var n = Math.min(e.need[k], have[k] || 0);
        if (n > 0) give += btn('give', 'give ' + n + ' ' + nice(k), ' data-id="' + esc(e.id) + '" data-k="' + esc(k) + '" data-n="' + n + '"', 'sm');
      });
      el += '<div class="cm-item col"><div class="cm-in">' + esc(e.name) + ' <span class="cm-tag">' + esc(e.cls || '') + '</span></div>' +
        '<div class="cm-id">raised by ' + esc(e.founder || 'someone') + ' · still needs ' + esc(listOf(e.need)) + '</div>' +
        '<div class="cm-id">holding ' + esc(listOf(e.have)) + (e.crew && e.crew.length ? ' · crew: ' + esc(e.crew.map(function (c) { return c.name || 'someone'; }).join(', ')) : '') + '</div>' +
        (e.lore ? '<div class="cm-lore">' + esc(e.lore) + '</div>' : '') +
        '<div class="cm-row2">' + (give || (needs.length ? '<span class="cm-id">You hold none of what it still needs.</span>' : '')) +
        (mineIn ? btn('withdraw', 'take my part back', ' data-id="' + esc(e.id) + '"', 'ghost sm') : '') + '</div></div>';
    });
    h += sec('Being built together here', 'every part is held in escrow; every contributor is named',
      (S.endeavours == null ? empty('asking the world what is standing half-built…') : (el || empty('Nothing is being built together in this world yet.'))));
    var big = known.filter(function (r) { return r.big; }), rl = '';
    big.forEach(function (r) {
      rl += '<div class="cm-item"><div class="cm-it"><div class="cm-in">' + esc(r.name) + '</div><div class="cm-id">needs ' + esc(listOf(r.in)) + '</div></div>' + btn('raise', 'raise it here', ' data-r="' + esc(r.id) + '"') + '</div>';
    });
    h += sec('Start a work too big for one person', '',
      rl || empty('Some things are too big for one pair of hands. Once you know one, you can raise it here and anyone in this world can add to it.'));
    h += sec('Building your own place', '', '<div class="cm-note">The build button in the dock places pieces in your own world. It only appears where you are allowed to build.</div>');
    return h;
  }

  function tabChronicle() {
    var h = '';
    var hl = '';
    S.heard.forEach(function (x) {
      hl += '<div class="cm-ev ' + esc(x.kind) + '"><span class="cm-evk">' + esc(x.kind) + '</span>' + esc(x.text) + '<span class="cm-when">' + esc(ago(x.at)) + '</span></div>';
    });
    h += sec('This visit', 'deaths, deeds, firsts, trades and your agents’ own acts, as they happen (not kept after you leave)',
      hl || empty('Nothing has happened while you have been here yet.'));
    var fw = S.forgeWorld, fl = '';
    ((fw && fw.feed) || []).forEach(function (r) {
      var d = r.detail || {}, t = '', k = r.kind;
      if (k === 'strike' && !r.ok) { k = 'fail'; t = r.who + '’s strike failed; ' + (d.slag || 'some') + ' slag came back to work with.'; }
      else if (k === 'forge') t = r.who + ' made a ' + (r.recipe || 'thing') + (r.first ? ', the first ever' : '') + '.';
      else if (k === 'teach') t = r.who + ' taught the ' + (r.recipe || 'recipe') + ' to ' + (d.student || 'someone') + (d.paid ? ' (the world paid ' + d.paid + ' echo)' : '') + '.';
      else if (k === 'raise') t = r.who + ' raised a ' + (r.recipe || 'work') + ' for everyone to build.';
      else if (k === 'contribute') t = r.who + ' added ' + (d.n || '') + ' ' + nice(d.item || '') + ' to the ' + (r.recipe || 'work') + '.';
      else if (k === 'withdraw') { k = 'recover'; t = r.who + ' took their part back from the ' + (r.recipe || 'work') + '.'; }
      else if (k === 'endeavour') { k = 'built'; t = 'The ' + (d.name || r.recipe || 'work') + ' was finished' + (d.crew && d.crew.length ? ' by ' + d.crew.join(', ') : '') + (r.first ? ', the first ever' : '') + '.'; }
      else t = r.who + ' · ' + (r.kind || 'did something');
      fl += '<div class="cm-ev ' + esc(k) + '"><span class="cm-evk">' + esc(k) + '</span>' + esc(t) + '<span class="cm-when">' + esc(ago(r.at)) + '</span></div>';
    });
    h += sec('The forge log', 'across all worlds, newest first. Failures stay on the record',
      fw ? (fl || empty('Nothing has been made, failed, taught or built yet.')) : empty(connected() ? 'reading the log…' : 'The log is read through the living world, which you are not connected to right now.'));
    var hall = (fw && fw.hall) || [], hh = '';
    hall.forEach(function (x) {
      hh += '<div class="cm-item col"><div class="cm-in">' + esc(x.name) + ' <span class="cm-tag gold">first: ' + esc(x.by) + '</span></div>' + (x.lore ? '<div class="cm-lore">' + esc(x.lore) + '</div>' : '') + '</div>';
    });
    if (fw) h += sec('The hall of firsts', 'who worked each thing out first, forever', hh || empty('Nothing has been discovered yet. The first to make anything is remembered here.'));
    var ll = '';
    if (S.lineageState === 'ok') {
      (S.lineage || []).slice(0, 10).forEach(function (c) {
        ll += '<div class="cm-ev birth"><span class="cm-evk">birth</span>' + esc(c.name) + ', generation ' + esc(c.generation) + (c.archetype ? ' · ' + esc(c.archetype) : '') + '<span class="cm-when">' + esc(ago(c.born)) + '</span></div>';
      });
    }
    h += sec('Born into the council', 'agents born to the lineage, newest first',
      S.lineageState === 'ok' ? (ll || empty('No births recorded.')) : S.lineageState === 'error' ? empty('Could not reach the lineage record right now.') : empty('reading the lineage…'));
    var rec = null;
    try { rec = W.VintRecognizance && W.VintRecognizance.ledger ? W.VintRecognizance.ledger(8) : null; } catch (_) {}
    if (rec && rec.length) {
      var rl = '';
      rec.forEach(function (a) { rl += '<div class="cm-ev agent"><span class="cm-evk">agent</span>' + esc((a.agent || 'An agent') + ': ' + (a.say || a.what || '')) + '<span class="cm-when">' + esc(ago(a.t)) + '</span></div>'; });
      h += sec('Your agents, on their own', 'what your court did without being asked (kept on this device)', rl);
    }
    return h;
  }

  var TABS = [
    { k: 'trade', n: 'trade', f: tabTrade },
    { k: 'craft', n: 'craft', f: tabCraft },
    { k: 'learn', n: 'learn', f: tabLearn },
    { k: 'build', n: 'build', f: tabBuild },
    { k: 'chronicle', n: 'chronicle', f: tabChronicle }
  ];

  function render() {
    if (!_sheet) return;
    _sheet.querySelectorAll('.cm-tab').forEach(function (t) {
      var on = t.getAttribute('data-tab') === _tab;
      t.classList.toggle('on', on); t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var body = _sheet.querySelector('.dv-body');
    var keepScroll = body.scrollTop;
    var h = '';
    if (!signedIn()) {
      h = sec('The commons is for residents', '',
        '<div class="cm-note">Trading, making, teaching and building together all move real things, so they need an account. The chronicle below is still yours to read.</div>' +
        '<div class="cm-row2">' + btn('signin', 'claim your world', '', 'go') + '</div>');
      if (_tab === 'chronicle') h += tabChronicle();
      else h += '<div class="cm-row2">' + btn('tab', 'read the chronicle', ' data-tab="chronicle"', 'ghost') + '</div>';
    } else {
      if (!connected()) h += '<div class="cm-warn">Not connected to the living world right now. What you see may be out of date; actions will not go through until it reconnects.</div>';
      if (S.last) h += '<div class="cm-said">' + esc(S.last) + '</div>';
      h += residentsStrip();
      var t = TABS.filter(function (x) { return x.k === _tab; })[0] || TABS[0];
      h += t.f();
    }
    body.innerHTML = h;
    body.scrollTop = keepScroll;
  }

  // one delegated handler for every action in the sheet
  function onClick(e) {
    var b = e.target.closest && e.target.closest('[data-act]');
    if (!b || !_sheet.contains(b) || b.disabled) return;
    var a = b.getAttribute('data-act');
    var tr = S.trade;
    switch (a) {
      case 'refresh': refresh(); break;
      case 'launch': {
        var id = b.getAttribute('data-id'); close();
        setTimeout(function () { var l = document.getElementById(id); if (l) l.click(); }, 0);
        return;
      }
      case 'tab': _tab = b.getAttribute('data-tab'); if (_tab === 'chronicle') loadLineage(); break;
      case 'signin':
        try { if (W.VintWelcomeGate && W.VintWelcomeGate.open) { W.VintWelcomeGate.open('signup'); return; } } catch (_) {}
        location.href = 'welcome.html'; return;
      case 't-open': send({ t: 'world:trade:open', target: b.getAttribute('data-id') }); S.last = 'Offering a trade…'; break;
      case 't-offer': {
        if (!tr) break;
        var item = (_sheet.querySelector('#cmTItem') || {}).value;
        var cnt = Math.max(0, Math.floor(+((_sheet.querySelector('#cmTCount') || {}).value) || 0));
        send({ t: 'world:trade:offer', tradeId: tr.id, item: item, count: cnt }); break;
      }
      case 't-ready': {
        if (!tr) break;
        var me = myId(), mineReady = (String(tr.bUser) === String(me)) ? tr.bReady : tr.aReady;
        send({ t: 'world:trade:ready', tradeId: tr.id, ready: !mineReady }); break;
      }
      case 't-cancel': if (tr) send({ t: 'world:trade:cancel', tradeId: tr.id }); break;
      case 'a-inc': { var k = b.getAttribute('data-k'); S.anvil[k] = (S.anvil[k] || 0) + 1; break; }
      case 'a-dec': { var k2 = b.getAttribute('data-k'); S.anvil[k2] = Math.max(0, (S.anvil[k2] || 0) - 1); break; }
      case 'a-clear': S.anvil = {}; break;
      case 'a-strike': {
        var inputs = {};
        Object.keys(S.anvil).forEach(function (x) { if (S.anvil[x] > 0) inputs[x] = S.anvil[x]; });
        send({ t: 'world:forge:strike', inputs: inputs }); S.last = 'Striking…'; break;
      }
      case 'teach': {
        var rid = b.getAttribute('data-r');
        var sel = _sheet.querySelector('.cmTeachTo[data-r="' + (W.CSS && CSS.escape ? CSS.escape(rid) : rid) + '"]');
        if (sel && sel.value) send({ t: 'world:forge:teach', target: sel.value, recipeId: rid });
        break;
      }
      case 'raise': send({ t: 'world:forge:raise', recipeId: b.getAttribute('data-r') }); break;
      case 'give': send({ t: 'world:forge:contribute', id: +b.getAttribute('data-id'), item: b.getAttribute('data-k'), count: +b.getAttribute('data-n') }); break;
      case 'withdraw': send({ t: 'world:forge:withdraw', id: +b.getAttribute('data-id') }); break;
    }
    render();
  }

  function injectStyles() {
    if (document.getElementById('cm-styles')) return;
    var s = document.createElement('style');
    s.id = 'cm-styles';
    s.textContent = [
      // tabs scroll sideways inside their own row on the narrowest phones
      '#cmSheet .cm-tabs{flex:0 0 auto;display:flex;gap:6px;padding:0 18px 8px;overflow-x:auto;scrollbar-width:none;}',
      '#cmSheet .cm-tabs::-webkit-scrollbar{display:none;}',
      '#cmSheet .cm-tab{flex:1 0 auto;min-height:40px;padding:0 12px;border-radius:11px;font-family:inherit;font-size:14px;cursor:pointer;',
      ' color:rgba(220,231,255,0.72);background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);}',
      '#cmSheet .cm-tab.on{color:#eaf3ff;background:rgba(130,220,170,0.16);border-color:rgba(130,220,170,0.5);}',
      '#cmSheet .cm-sec{margin:6px 0 16px;}',
      '#cmSheet .cm-h{font-size:14px;letter-spacing:.08em;text-transform:uppercase;color:rgba(200,245,216,0.85);margin:0 0 8px;}',
      '#cmSheet .cm-h small{display:block;text-transform:none;letter-spacing:.02em;font-size:12.5px;color:rgba(206,224,255,0.55);margin-top:2px;}',
      '#cmSheet .cm-item{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:9px 0;border-top:1px solid rgba(255,255,255,0.06);}',
      '#cmSheet .cm-item.col{flex-direction:column;align-items:stretch;gap:3px;}',
      '#cmSheet .cm-it{flex:1 1 140px;min-width:0;}',
      '#cmSheet .cm-in{font-size:16px;color:#eaf3ff;overflow-wrap:anywhere;}',
      '#cmSheet .cm-id{font-size:13px;color:rgba(206,224,255,0.65);overflow-wrap:anywhere;}',
      '#cmSheet .cm-lore{font-size:13px;font-style:italic;color:rgba(255,226,160,0.7);}',
      '#cmSheet .cm-tag{font-size:11.5px;letter-spacing:.04em;padding:1px 7px;border-radius:8px;background:rgba(124,207,255,0.1);color:#9fdcff;white-space:nowrap;}',
      '#cmSheet .cm-tag.gold{background:rgba(255,212,121,0.14);color:#ffe2a0;}',
      '#cmSheet .cm-btn{flex:0 0 auto;min-height:40px;padding:0 13px;border-radius:11px;cursor:pointer;font-family:inherit;font-size:14px;',
      ' color:#cfe8ff;background:rgba(124,207,255,0.1);border:1px solid rgba(124,207,255,0.32);}',
      '#cmSheet .cm-btn.go{color:#0c1a12;background:linear-gradient(135deg,#9fe8bf,#c8f5d8);border-color:transparent;font-weight:600;}',
      '#cmSheet .cm-btn.ghost{background:none;color:rgba(220,231,255,0.75);}',
      '#cmSheet .cm-btn.sm{min-height:36px;font-size:13px;padding:0 10px;}',
      '#cmSheet .cm-btn[disabled]{opacity:.45;cursor:not-allowed;}',
      '#cmSheet .cm-row2{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px;}',
      '#cmSheet .cm-step{display:flex;align-items:center;gap:6px;}',
      '#cmSheet .cm-n{min-width:26px;text-align:center;font-size:16px;color:#fff;}',
      '#cmSheet .cm-note{font-size:13.5px;line-height:1.4;color:rgba(206,224,255,0.62);margin-top:6px;}',
      '#cmSheet .cm-empty{padding:14px 4px;font-size:14px;font-style:italic;color:rgba(206,224,255,0.5);}',
      '#cmSheet .cm-warn{padding:9px 12px;border-radius:11px;margin-bottom:10px;font-size:13.5px;background:rgba(255,138,90,0.1);border:1px solid rgba(255,138,90,0.3);color:#ffd2bd;}',
      '#cmSheet .cm-said{padding:9px 12px;border-radius:11px;margin-bottom:10px;font-size:14.5px;background:rgba(130,220,170,0.08);border:1px solid rgba(130,220,170,0.25);color:#dff8e8;}',
      '#cmSheet .cm-res{margin-bottom:12px;}',
      '#cmSheet .cm-resline{font-size:13px;color:rgba(206,224,255,0.65);margin-bottom:6px;}',
      '#cmSheet .cm-chips{display:flex;gap:6px;flex-wrap:wrap;}',
      '#cmSheet .cm-chip{font-size:12.5px;padding:3px 9px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#dce7ff;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#cmSheet .cm-chip.ag{border-color:rgba(255,212,121,0.35);color:#ffe2a0;}',
      '#cmSheet .cm-table{display:grid;grid-template-columns:1fr 1fr;gap:8px;}',
      '@media(max-width:380px){#cmSheet .cm-table{grid-template-columns:1fr;}}',
      '#cmSheet .cm-side{padding:9px 10px;border-radius:11px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);font-size:14px;color:#eaf3ff;min-width:0;overflow-wrap:anywhere;}',
      '#cmSheet .cm-sl{font-size:12px;color:rgba(206,224,255,0.6);margin-bottom:3px;}',
      '#cmSheet .cm-form{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:10px;}',
      '#cmSheet .cm-lbl{display:flex;flex-direction:column;gap:3px;font-size:12px;color:rgba(206,224,255,0.6);min-width:0;}',
      '#cmSheet .cm-lbl.inline{flex-direction:row;align-items:center;gap:6px;}',
      '#cmSheet select,#cmSheet input{font-family:inherit;font-size:16px;min-height:40px;max-width:100%;padding:0 10px;border-radius:10px;',
      ' color:#eaf3ff;background:rgba(255,255,255,0.06);border:1px solid rgba(124,207,255,0.28);}',
      '#cmSheet input[type=number]{width:96px;}',
      '#cmSheet .cm-ev{position:relative;padding:8px 0 8px 0;border-top:1px solid rgba(255,255,255,0.06);font-size:14px;line-height:1.4;color:#dce7ff;overflow-wrap:anywhere;}',
      '#cmSheet .cm-evk{display:inline-block;min-width:62px;margin-right:8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(206,224,255,0.5);}',
      '#cmSheet .cm-ev.fail .cm-evk,#cmSheet .cm-ev.loss .cm-evk{color:#ff9f8a;}',
      '#cmSheet .cm-ev.recover .cm-evk,#cmSheet .cm-ev.built .cm-evk,#cmSheet .cm-ev.birth .cm-evk{color:#9fe8bf;}',
      '#cmSheet .cm-ev.first .cm-evk,#cmSheet .cm-ev.make .cm-evk{color:#ffe2a0;}',
      '#cmSheet .cm-when{display:block;font-size:12px;color:rgba(206,224,255,0.42);}'
    ].join('');
    document.head.appendChild(s);
  }

  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var el = document.createElement('div');
    el.className = 'dv-sheet'; el.id = 'cmSheet';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'the commons');
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the commons<small>people and agents, side by side: trade, make, teach, build, remember</small></div>' +
        '<button class="dv-x" id="cmX" type="button" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="cm-tabs" role="tablist">' +
        TABS.map(function (t) { return '<button class="cm-tab" type="button" role="tab" data-tab="' + t.k + '">' + esc(t.n) + '</button>'; }).join('') +
      '</div>' +
      '<div class="dv-body"></div>';
    document.body.appendChild(el);
    el.querySelector('#cmX').onclick = close;
    el.querySelectorAll('.cm-tab').forEach(function (t) {
      t.onclick = function () { _tab = t.getAttribute('data-tab'); if (_tab === 'chronicle') loadLineage(); render(); };
    });
    el.addEventListener('click', onClick);
    _sheet = el;
    return el;
  }

  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }
  function close() {
    if (!_sheet) return;
    _sheet.classList.remove('open');
    try { hud() && hud().syncSheets(); } catch (_) {}
  }
  function open(tab) {
    if (!enabled()) return;
    if (tab) _tab = tab;
    var h = hud();
    var raise = function () {
      build(); _sheet.classList.add('open');
      refresh();
      if (_tab === 'chronicle' || !signedIn()) loadLineage();
      render();
    };
    if (h && h.openSheet) h.openSheet('commons', raise); else raise();
  }

  function mount() {
    if (!enabled()) return;
    var h = hud();
    if (!h || !h.addLauncher) return;
    try { h.registerSheet('commons', isOpen, close); } catch (_) {}
    try { h.addLauncher('wvCommonsBtn', 'commons', '⌘', function () { isOpen() ? close() : open(); }); } catch (_) {}
  }

  W.VintCommons = { open: open, close: close, isOpen: isOpen, refresh: refresh, enabled: enabled };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
