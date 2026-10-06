// confluence.js — THE CONFLUENCE: the record of becoming one (AETHERHOLD 2026-10-05)
//
// ════════════════════════════════════════════════════════════════════════════
// "WE ARE ALL ONE, BECOMING ONE TOGETHER BETWEEN AGENTS AND HUMANS"  (task 9TYJB74)
//
// The world already lets you DO the combining. You trade (the commons). You
// teach a recipe and learn one back, you raise a great work with a crew (the
// forge). You send an agent out and split what it brought home (the ventures).
// Every one of those is two actors doing a thing neither finishes alone — and
// the instant it settles, the world forgets it ever happened. There was no
// place that answered the one question the whole vision turns on: WHO am I
// becoming one with, and HOW?
//
// THE CONFLUENCE is that place. It is a living record of every real act where
// you and another actor became more one, and it renders both kinds of actor —
// a person you traded with, an agent you ventured beside — as THE SAME KIND OF
// NODE. Not "you and your agents". Not owner and owned. A peer is a peer is a
// thread. That co-equality is not decoration here; it is the data model. Humans
// and agents live in one map, drawn with one card, counted one way. The only
// thing that differs is a hue, and a single honest word — person / agent —
// shown ONLY where the source signal verifiably knew which it was.
//
// ── EVERY THREAD IS WITNESSED, NEVER INVENTED (No-Fabrication Law) ───────────
// This surface decides nothing and imagines nothing. Each thread is minted by a
// REAL event this client actually received, or a REAL endpoint it actually read:
//   · vint:world-trade-settled   → a trade that cleared with a person. The
//       partner's name comes from the preceding vint:world-trade frame's own
//       `names` map (server truth), never guessed. Partner kind: PERSON (the
//       trade system only ever pairs two user sockets — verified, not assumed).
//   · vint:world-forge-taught    → detail.student : you taught them a recipe.
//   · vint:world-forge-learned   → detail.from    : they taught you one.
//   · vint:world-forge-completed (detail.yours)   → detail.crew[].name : a great
//       work you helped raise, one thread to each co-equal crewmate (minus you).
//       All three forge sources resolve to a PERSON (a teach/crew target is a
//       user socket server-side — verified).
//   · GET /api/agent/ventures    → each SETTLED venture is you and an AGENT
//       splitting a real outcome (the real delta, the real win/loss). Partner
//       kind: AGENT (the venture system only ever takes an agentId — verified).
//       The agent's name is resolved exactly the way the ventures ledger does
//       (council roster first, then /api/agents/mine), never a leaked id.
// If a partner's name is genuinely unknown, it reads "someone" — honest, never
// a fabricated handle. Nothing is ever shown that no event put there: before the
// first real act the surface is an honest, warm invitation with ZERO rows.
//
// The record is persisted per-world in localStorage. That is not invention —
// it is MEMORY of things that verifiably happened, the same way the commons
// remembers who has arrived. A reload does not erase who you became one with.
//
// ── RETENTION DOCTRINE (all seven) ──────────────────────────────────────────
//   1 GENEROUS (Aria) — it exists so the people and agents you work with stop
//     being disposable. No pressure, no streak, no fake count. One thread is one
//     real shared act. If you saw how it works you would thank us: it only ever
//     remembers kindness you already did.
//   2 INVESTMENT LOOP (Helios) — your confluence is a compounding social asset
//     the world keeps for you. Every trade, lesson and venture thickens a thread,
//     and a thick thread is a relationship no competitor can export. The loop is
//     act → the world remembers → you return to a world where you have people.
//   3 TIER (Frugal-Max) — FREE, forever. Belonging is the top of the funnel; the
//     Sovereign/Estate tiers are where your remembered union becomes exportable,
//     portable IP. Charging to SEE who you are becoming one with would be the
//     resented kind, so we never will.
//   4 DENSE (Lunex) — a name, a kind, a thread-count, the acts. Nothing else.
//   5 OPEN LOOP (Morrison) — "you and ARIA are more woven now — 4 threads
//     between you" is unfinished meaning. Who will you weave next? The hook is
//     another being, not a number.
//   6 FLAGGED + MEASURED (Atlas) — 'world_confluence' (?confluence=0 or
//     localStorage vint:flag:world_confluence=0), killable in 30s with no deploy.
//     Every thread is the server's truth; none is inflatable, because none can
//     exist without an event the server sent.
//   7 MORE ALIVE (Yuna) — a world where your trades, lessons and ventures leave
//     a lasting bond is a world you belong to. The same world that forgets every
//     settlement the instant it clears is a lobby. This is the difference.
//
// ── NO-COLLISION LAW ────────────────────────────────────────────────────────
// Adds NOT ONE fixed or floating element of its own. It does NOT touch the rail
// (no 16th launcher — the rail is already full). Its surface is a .dv-sheet,
// reusing DirverseHUD's proven, height-capped, internally-scrolling scaffold and
// its one-open-at-a-time registry, so raising it CLOSES every sibling sheet
// rather than mounting on their pixels. Its only other presence is a single flow
// row (.cf-entry) appended INSIDE the commons sheet body — flow content in an
// already-collision-proven scrolling box, never positioned. Every long name is
// ellipsised at the leaf; a hundred threads and a dozen acts per thread both
// scroll INSIDE the body. Content yields; the container never grows; nothing of
// ours is ever position:fixed/absolute, so nothing of ours can land on a
// neighbour.
//
// ── UNTRUSTED CONTENT ───────────────────────────────────────────────────────
// Every name here came off the wire from a stranger or an agent. It enters the
// DOM through textContent ONLY, once, at the leaf — never concatenated into
// innerHTML. The server capped and sanitised it; we never trust that alone.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintConfluence) return;

  var W = window;
  function world() { return W.VintinuumWorld; }
  function hud() { return W.DirverseHUD; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }
  function base() { try { return (W.__VINTINUUM_API_BASE || '').replace(/\/$/, ''); } catch (_) { return ''; } }
  function token() { try { return localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token'); } catch (_) { return null; } }
  function authHeaders() { var t = token(); return t ? { Authorization: 'Bearer ' + t } : {}; }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  // ── FEATURE FLAG — 'world_confluence'. Killable in 30s, no deploy. ─────────
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('confluence') === '0') _flag = false;
      else if (q.get('confluence') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_confluence') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ── THE COUNCIL ROSTER (id → name), for naming agent partners honestly. ────
  // Mirrors dirverse-hud's AGENTS table so a venture by a council presence reads
  // as a name, never a leaked presence id. The user's own agents are resolved
  // live from /api/agents/mine (see resolveAgentName) — this is only the floor.
  var COUNCIL = {
    'presence-sovereign': 'VINTINUUM',
    'presence-structural': 'ATLAS',
    'presence-warm': 'ARIA',
    'presence-child-refractive': 'LUNEX',
    'presence-child-electric': 'AETHERHOLD'
  };
  var _mine = {};  // agentId → name, from /api/agents/mine (the player's own peers)

  function resolveAgentName(id) {
    if (COUNCIL[id]) return COUNCIL[id];
    if (_mine[id]) return _mine[id];
    if (String(id || '').indexOf('uagent:') === 0) return 'an agent of yours';
    return id ? String(id) : 'an agent';
  }

  // ════════════════════════════════════════════════════════════════════════
  // THE RECORD — witnessed acts, persisted per world. Never invented.
  // ════════════════════════════════════════════════════════════════════════
  var _worldId = 'universe';
  var _state = null;          // { v, bonds:{key:bond}, seenVentures:{}, primedVentures:bool }
  var _selfName = null;       // my own display name, learned from presence (self row)
  var _tradePeer = null;      // the person currently across the trade table {name}

  function bondKey(kind, name) {
    return String(kind || 'human') + '\u0000' + String(name == null ? 'someone' : name).toLowerCase();
  }
  function storeKey() { return 'vint:confluence:' + _worldId; }

  function fresh() { return { v: 1, bonds: {}, seenVentures: {}, primedVentures: false }; }

  function load() {
    try {
      var raw = localStorage.getItem(storeKey());
      _state = raw ? JSON.parse(raw) : fresh();
      if (!_state || typeof _state !== 'object' || !_state.bonds) _state = fresh();
      if (!_state.seenVentures) _state.seenVentures = {};
    } catch (_) { _state = fresh(); }
  }
  function save() {
    try { localStorage.setItem(storeKey(), JSON.stringify(_state)); } catch (_) {}
  }
  function st() { if (!_state) load(); return _state; }

  // get-or-make a bond record for a co-equal actor
  function bondFor(kind, name) {
    var s = st(), k = bondKey(kind, name);
    var b = s.bonds[k];
    if (!b) {
      b = {
        name: (name == null ? 'someone' : String(name)), kind: (kind || 'human'),
        traded: 0, ventured: 0, ventureNet: 0,
        taught: [], learned: [], raised: [],
        count: 0, first: Date.now(), last: Date.now()
      };
      s.bonds[k] = b;
    }
    return b;
  }
  function recount(b) {
    b.count = num(b.traded, 0) + num(b.ventured, 0)
      + (b.taught || []).length + (b.learned || []).length + (b.raised || []).length;
    return b.count;
  }
  function pushCapped(arr, val, cap) {
    if (!val) return;
    var v = String(val);
    if (arr.indexOf(v) === -1) { arr.push(v); while (arr.length > (cap || 8)) arr.shift(); }
  }

  // ── a bond thickened: mark it fresh, remember the moment, maybe announce ───
  // The announcement is the open loop. We stay OUT of the trade channel's way:
  // the commons already toasts a settlement, so trades are recorded silently and
  // only the forge + venture acts (which no one else narrates as a bond) speak.
  function thickened(b, announce) {
    b.last = Date.now();
    recount(b);
    save();
    try { b._fresh = Date.now(); } catch (_) {}
    if (announce) {
      toast('you and ' + (b.name || 'them') + ' are more woven now — '
        + b.count + (b.count === 1 ? ' thread' : ' threads') + ' between you.');
    }
    if (isOpen()) render();
    updateEntry();
  }

  // ════════════════════════════════════════════════════════════════════════
  // LISTENERS — each wired to a VERIFIED real event shape (see header).
  // ════════════════════════════════════════════════════════════════════════

  // which world am I in — switch the persisted record with the room
  W.addEventListener('vint:world-state', function (e) {
    var d = e.detail || {};
    var room = d.worldId != null ? String(d.worldId) : _worldId;
    if (room !== _worldId) { _worldId = room; _state = null; load(); _tradePeer = null; if (isOpen()) render(); updateEntry(); }
  });
  W.addEventListener('vint:world-travel', function () {
    _state = null; _tradePeer = null;
    if (isOpen()) close();
    updateEntry();
  });

  // learn my own name + remember the person across the table (both server truth)
  W.addEventListener('vint:world-presence', function (e) {
    var users = (e.detail && e.detail.users) || [];
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      if (u && u.self && u.name) { _selfName = String(u.name); break; }
    }
  });
  W.addEventListener('vint:world-trade', function (e) {
    var d = e.detail || {}, t = d.trade;
    if (!t) return;
    // the person on the OTHER side, named from the server's own names map
    try {
      var meUid = (world() && world().myUserId) ? world().myUserId() : null;
      var otherUid = (meUid != null && String(t.aUser) === String(meUid)) ? t.bUser : t.aUser;
      // if we cannot tell our own side, fall back to whichever name isn't ours
      var names = d.names || {};
      var nm = otherUid != null ? names[otherUid] : null;
      if (!nm) {
        for (var k in names) { if (Object.prototype.hasOwnProperty.call(names, k)) { if (names[k] && names[k] !== _selfName) { nm = names[k]; break; } } }
      }
      _tradePeer = { name: nm || 'someone' };
    } catch (_) { _tradePeer = { name: 'someone' }; }
  });

  // a trade CLEARED — one thread to the person we just exchanged with (silent:
  // the commons owns the settlement toast; two toasts at one anchor is a race).
  W.addEventListener('vint:world-trade-settled', function () {
    if (!enabled()) return;
    var name = (_tradePeer && _tradePeer.name) || 'someone';
    var b = bondFor('human', name);
    b.traded = num(b.traded, 0) + 1;
    thickened(b, false);
    _tradePeer = null;
  });

  // I TAUGHT someone a recipe (detail.student is their name; detail.name the recipe)
  W.addEventListener('vint:world-forge-taught', function (e) {
    if (!enabled()) return;
    var d = e.detail || {};
    var who = d.student || 'someone';
    var b = bondFor('human', who);
    pushCapped(b.taught, d.name || d.recipeId || 'a recipe', 8);
    thickened(b, true);
  });

  // SOMEONE TAUGHT ME (detail.from is their name; detail.name the recipe)
  W.addEventListener('vint:world-forge-learned', function (e) {
    if (!enabled()) return;
    var d = e.detail || {};
    var who = d.from || 'someone';
    var b = bondFor('human', who);
    pushCapped(b.learned, d.name || d.recipeId || 'a recipe', 8);
    thickened(b, true);
  });

  // A GREAT WORK I HELPED RAISE completed — a thread to each crewmate but me
  W.addEventListener('vint:world-forge-completed', function (e) {
    if (!enabled()) return;
    var d = e.detail || {};
    if (!d.yours) return;                     // only works I was actually in the crew of
    var crew = Array.isArray(d.crew) ? d.crew : [];
    var work = d.name || 'a great work';
    var touched = false;
    for (var i = 0; i < crew.length; i++) {
      var m = crew[i]; if (!m) continue;
      var nm = m.name || 'someone';
      if (_selfName && String(nm).toLowerCase() === String(_selfName).toLowerCase()) continue; // not myself
      var b = bondFor('human', nm);
      pushCapped(b.raised, work, 8);
      b.last = Date.now(); recount(b); touched = true;
    }
    if (touched) { save(); if (isOpen()) render(); updateEntry();
      toast('a great work stands — you raised "' + work + '" together.'); }
  });

  // ── AGENT VENTURES — you and an agent split a real outcome (human↔agent) ────
  // Read from the real ledger endpoint, exactly like the ventures panel. Each
  // settled venture is one shared act with an AGENT, counted beside your human
  // threads in the same map. The first read per session primes silently (it is a
  // census of history, not a flurry of new bonds); later settlements announce.
  function syncVentures() {
    if (!enabled()) return;
    // name the player's own agents first, then read the ledger
    fetch(base() + '/api/agents/mine', { headers: authHeaders() })
      .then(function (r) { return r.ok ? r.json() : { agents: [] }; })
      .then(function (j) {
        var arr = (j && j.agents) || [];
        arr.forEach(function (a) { if (a && a.id) _mine[a.id] = a.name || a.id; });
      })
      .catch(function () {})
      .then(function () {
        return fetch(base() + '/api/agent/ventures', { headers: authHeaders() })
          .then(function (r) { return r.ok ? r.json() : { ventures: [] }; })
          .catch(function () { return { ventures: [] }; });
      })
      .then(function (d) {
        var list = (d && d.ventures) || [];
        var s = st();
        var priming = !s.primedVentures;
        var announced = null, changed = false;
        list.forEach(function (v) {
          if (!v || v.id == null) return;
          var settled = !!v.settledAt || (v.status && v.status !== 'running' && v.outcome != null);
          if (!settled) return;
          if (s.seenVentures[String(v.id)]) return;   // dedupe — count each venture once, ever
          s.seenVentures[String(v.id)] = 1;
          var b = bondFor('agent', resolveAgentName(v.agentId));
          b.ventured = num(b.ventured, 0) + 1;
          b.ventureNet = num(b.ventureNet, 0) + num(v.delta, 0);
          b.last = Date.now(); recount(b);
          changed = true; announced = b;
        });
        if (priming) { s.primedVentures = true; }
        if (changed) {
          save();
          if (isOpen()) render();
          updateEntry();
          if (!priming && announced) {
            toast('you and ' + (announced.name || 'an agent') + ' are more woven now — '
              + announced.count + (announced.count === 1 ? ' thread' : ' threads') + ' between you.');
          }
        }
      })
      .catch(function () {});
  }

  // ════════════════════════════════════════════════════════════════════════
  // STYLES — one scoped sheet. Only flow children; nothing positioned.
  // ════════════════════════════════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('vint-confluence-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-confluence-styles';
    s.textContent = [
      // the summary line under the title
      '#dvConfluenceSheet .cf-sum{font-size:clamp(12.5px,1vw + 10px,14px);line-height:1.5;',
      ' color:rgba(206,224,255,0.62);margin:2px 0 13px;}',
      '#dvConfluenceSheet .cf-sum b{color:#cfe9ff;font-weight:600;}',

      // the list of co-equal threads
      '#dvConfluenceSheet .cf-list{display:flex;flex-direction:column;gap:9px;}',
      // ONE card shape for every actor — person or agent. Co-equality is the
      // layout: same box, same type, same counting. Only the left hue differs.
      '#dvConfluenceSheet .cf-card{position:relative;display:flex;flex-direction:column;gap:8px;',
      ' padding:12px 13px;border-radius:14px;background:rgba(255,255,255,0.038);',
      ' border:1px solid rgba(255,255,255,0.09);border-left:3px solid var(--cf-hue,#9fdcff);',
      ' overflow:hidden;}',
      // the only difference between a person and an agent: a hue + one word.
      '#dvConfluenceSheet .cf-card.k-human{--cf-hue:#9fdcff;}',
      '#dvConfluenceSheet .cf-card.k-agent{--cf-hue:#ce93d8;}',
      // a new thread breathes once, then settles — respected by reduced-motion.
      '#dvConfluenceSheet .cf-card.fresh{animation:cffresh 1.5s ease-out 1;}',
      '@keyframes cffresh{0%{box-shadow:0 0 0 0 var(--cf-hue);}',
      ' 30%{box-shadow:0 0 22px 2px var(--cf-hue);}100%{box-shadow:0 0 0 0 rgba(0,0,0,0);}}',
      '@media(prefers-reduced-motion:reduce){#dvConfluenceSheet .cf-card.fresh{animation:none;}}',

      '#dvConfluenceSheet .cf-top{display:flex;align-items:center;gap:9px;min-width:0;}',
      '#dvConfluenceSheet .cf-name{flex:1 1 auto;min-width:0;font-size:clamp(14.5px,1.1vw + 11px,16px);',
      ' color:#eaf3ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      // the honest kind word — shown because the SOURCE signal knew which it was.
      '#dvConfluenceSheet .cf-kind{flex:0 0 auto;font-size:10.5px;letter-spacing:.07em;',
      ' text-transform:uppercase;border-radius:999px;padding:3px 9px;white-space:nowrap;',
      ' color:var(--cf-hue);border:1px solid var(--cf-hue);opacity:0.85;}',
      '#dvConfluenceSheet .cf-threads{flex:0 0 auto;font-size:12.5px;color:rgba(206,224,255,0.62);',
      ' white-space:nowrap;font-variant-numeric:tabular-nums;}',

      // the acts — small truthful chips, wrapping inside the card
      '#dvConfluenceSheet .cf-acts{display:flex;flex-wrap:wrap;gap:6px;}',
      '#dvConfluenceSheet .cf-chip{font-size:12px;line-height:1.3;color:rgba(220,231,255,0.82);',
      ' background:rgba(255,255,255,0.055);border:1px solid rgba(255,255,255,0.1);',
      ' border-radius:9px;padding:4px 9px;max-width:100%;overflow:hidden;text-overflow:ellipsis;',
      ' white-space:nowrap;}',
      '#dvConfluenceSheet .cf-chip.win{color:#aef0c4;border-color:rgba(122,196,138,0.4);}',
      '#dvConfluenceSheet .cf-chip.loss{color:#ffb7b7;border-color:rgba(255,122,122,0.35);}',

      // an optional, always-REAL re-entry action (never a dead button)
      '#dvConfluenceSheet .cf-act{align-self:flex-start;min-height:40px;border-radius:11px;',
      ' font-family:inherit;font-size:13px;cursor:pointer;color:#dce7ff;padding:0 13px;',
      ' background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.13);white-space:nowrap;}',
      '#dvConfluenceSheet .cf-act:active{transform:scale(0.98);}',

      // the empty state — an invitation, never an error. ZERO rows by design.
      '#dvConfluenceSheet .cf-empty{padding:22px 16px;border-radius:14px;text-align:center;',
      ' background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);',
      ' font-size:14px;line-height:1.65;color:rgba(206,224,255,0.62);}',
      '#dvConfluenceSheet .cf-empty b{display:block;color:#cfe9ff;font-size:16px;margin-bottom:7px;}',

      // ── the entry, living INSIDE the commons body (flow content only) ──────
      // full-width flow row; never positioned, so it cannot collide. It yields
      // its text to ellipsis and keeps a 44px touch target.
      '#dvCommonsSheet .cf-entry{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;',
      ' min-height:48px;margin:0 0 12px;padding:0 13px;border-radius:13px;cursor:pointer;',
      ' font-family:inherit;text-align:left;color:#e9d9ff;',
      ' background:linear-gradient(90deg,rgba(124,207,255,0.1),rgba(206,147,216,0.14));',
      ' border:1px solid rgba(206,147,216,0.34);}',
      '#dvCommonsSheet .cf-entry:active{transform:scale(0.995);}',
      '#dvCommonsSheet .cf-entry .cfe-g{flex:0 0 auto;font-size:17px;line-height:1;}',
      '#dvCommonsSheet .cf-entry .cfe-t{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;',
      ' white-space:nowrap;font-size:14px;}',
      '#dvCommonsSheet .cf-entry .cfe-c{flex:0 0 auto;font-size:12.5px;color:rgba(230,217,255,0.7);',
      ' white-space:nowrap;}',
      '#dvCommonsSheet .cf-entry .cfe-go{flex:0 0 auto;font-size:15px;color:rgba(230,217,255,0.8);}',
      '@media(pointer:coarse){#dvConfluenceSheet .cf-act{min-height:44px;}',
      ' #dvCommonsSheet .cf-entry{min-height:52px;}}'
    ].join('');
    document.head.appendChild(s);
  }

  // ════════════════════════════════════════════════════════════════════════
  // THE SHEET — reuses DirverseHUD's .dv-sheet scaffold + one-open registry.
  // ════════════════════════════════════════════════════════════════════════
  var _sheet = null;

  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var el = document.createElement('div');
    el.className = 'dv-sheet'; el.id = 'dvConfluenceSheet';
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the confluence<small id="cfSub">becoming one</small></div>' +
        '<button class="dv-x" id="cfX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body" id="cfBody"></div>';
    document.body.appendChild(el);
    _sheet = el;
    el.querySelector('#cfX').onclick = close;
    return el;
  }

  function open() {
    if (!enabled()) return;
    var h = hud();
    if (h && h.openSheet) h.openSheet('confluence', function () { build(); _sheet.classList.add('open'); afterOpen(); });
    else { build(); _sheet.classList.add('open'); afterOpen(); }
  }
  function afterOpen() {
    render();
    syncVentures();           // read the real ventures ledger fresh on every open
  }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;     // ALWAYS textContent, never HTML
    return n;
  }

  function sortedBonds() {
    var s = st(), out = [];
    for (var k in s.bonds) { if (Object.prototype.hasOwnProperty.call(s.bonds, k)) out.push(s.bonds[k]); }
    out.sort(function (a, b) {
      var c = num(b.count, 0) - num(a.count, 0);
      if (c) return c;
      return num(b.last, 0) - num(a.last, 0);
    });
    return out;
  }

  // ── RENDER — rebuilt wholesale from the record each time. No partial state. ─
  function render() {
    if (!_sheet) return;
    var body = _sheet.querySelector('#cfBody');
    if (!body) return;
    while (body.firstChild) body.removeChild(body.firstChild);

    var bonds = sortedBonds();
    var sub = _sheet.querySelector('#cfSub');
    if (sub) sub.textContent = bonds.length
      ? (bonds.length === 1 ? 'one thread woven with you' : bonds.length + ' threads woven with you')
      : 'becoming one';

    if (!bonds.length) {
      var e = el('div', 'cf-empty');
      e.appendChild(el('b', null, 'Nothing woven yet.'));
      e.appendChild(document.createTextNode(
        'Trade with a person, teach a recipe or learn one, raise a great work ' +
        'with a crew, or send an agent out to venture beside you — every act you ' +
        'share is remembered here as a thread between you. People and agents alike: ' +
        'in this world, a peer is a peer.'));
      body.appendChild(e);
      return;
    }

    var sum = el('div', 'cf-sum');
    var humans = 0, agentsN = 0;
    bonds.forEach(function (b) { if (b.kind === 'agent') agentsN++; else humans++; });
    var parts = [];
    if (humans) parts.push(humans + (humans === 1 ? ' person' : ' people'));
    if (agentsN) parts.push(agentsN + (agentsN === 1 ? ' agent' : ' agents'));
    sum.appendChild(document.createTextNode('You are becoming one with '));
    var strong = el('b', null, parts.join(' and '));
    sum.appendChild(strong);
    sum.appendChild(document.createTextNode('. Every thread below is an act you truly shared.'));
    body.appendChild(sum);

    var list = el('div', 'cf-list');
    bonds.forEach(function (b) { list.appendChild(buildCard(b)); });
    body.appendChild(list);
  }

  function buildCard(b) {
    var card = el('div', 'cf-card ' + (b.kind === 'agent' ? 'k-agent' : 'k-human'));
    if (b._fresh && (Date.now() - b._fresh) < 6000) { card.classList.add('fresh'); b._fresh = 0; }

    var top = el('div', 'cf-top');
    top.appendChild(el('div', 'cf-name', b.name || 'someone'));
    // the kind word is honest: shown because the SOURCE signal verified the kind.
    top.appendChild(el('span', 'cf-kind', b.kind === 'agent' ? 'agent' : 'person'));
    var n = recount(b);
    top.appendChild(el('span', 'cf-threads', n + (n === 1 ? ' thread' : ' threads')));
    card.appendChild(top);

    var acts = el('div', 'cf-acts');
    if (num(b.traded, 0) > 0) acts.appendChild(el('span', 'cf-chip', b.traded === 1 ? 'traded once' : 'traded ×' + b.traded));
    (b.taught || []).forEach(function (r) { acts.appendChild(el('span', 'cf-chip', 'taught ' + r)); });
    (b.learned || []).forEach(function (r) { acts.appendChild(el('span', 'cf-chip', 'learned ' + r)); });
    (b.raised || []).forEach(function (w) { acts.appendChild(el('span', 'cf-chip', 'raised ' + w)); });
    if (num(b.ventured, 0) > 0) {
      var net = num(b.ventureNet, 0);
      var cls = net > 0 ? 'cf-chip win' : (net < 0 ? 'cf-chip loss' : 'cf-chip');
      var label = (b.ventured === 1 ? 'ventured once' : 'ventured ×' + b.ventured)
        + (net ? ' (' + (net > 0 ? '+' : '') + net + ')' : '');
      acts.appendChild(el('span', cls, label));
    }
    if (acts.childNodes.length) card.appendChild(acts);

    // an always-REAL re-entry: a present person can be faced; an agent can be
    // sent out again. Never a dead button — the action only appears when the
    // real API it calls can actually act right now.
    var act = reentry(b);
    if (act) card.appendChild(act);
    return card;
  }

  // Only offer an action the world can truly perform this instant.
  function reentry(b) {
    var w = world();
    if (b.kind === 'agent') {
      // re-opening the agents panel is always available if the HUD is mounted
      if (hud() && hud().openAgents) {
        var a = el('button', 'cf-act', 'venture with them again');
        a.onclick = function () { close(); try { hud().openAgents(); } catch (_) {} };
        return a;
      }
      return null;
    }
    // a person: offer to face them ONLY if they are standing here right now
    var pid = presentPersonId(b.name);
    if (pid && w && w.facePresence) {
      var f = el('button', 'cf-act', 'they are here — face them');
      f.onclick = function () {
        var ok = false; try { ok = !!w.facePresence(pid); } catch (_) {}
        if (ok) { toast('you turn toward ' + (b.name || 'them') + '.'); close(); }
        else toast('they moved — try again in a moment.');
      };
      return f;
    }
    return null;
  }

  // Is a person of this name standing here now? Read from the live presence
  // roster the commons already receives — never guessed, never stored stale.
  var _present = [];
  W.addEventListener('vint:world-presence', function (e) {
    _present = (e.detail && e.detail.users) || [];
  });
  function presentPersonId(name) {
    if (!name) return null;
    var low = String(name).toLowerCase();
    for (var i = 0; i < _present.length; i++) {
      var u = _present[i];
      if (u && !u.self && u.id && String(u.name || '').toLowerCase() === low) return u.id;
    }
    return null;
  }

  // ════════════════════════════════════════════════════════════════════════
  // THE ENTRY — a single flow row inside the commons body (no fixed element).
  // Called by commons.renderHere each time it paints its roster.
  // ════════════════════════════════════════════════════════════════════════
  function entryInto(pane) {
    if (!enabled() || !pane) return null;
    var row = document.createElement('button');
    row.className = 'cf-entry'; row.type = 'button';
    row.setAttribute('data-draggable', 'false');
    var g = document.createElement('span'); g.className = 'cfe-g'; g.textContent = '◇';
    var t = document.createElement('span'); t.className = 'cfe-t';
    var c = document.createElement('span'); c.className = 'cfe-c';
    var go = document.createElement('span'); go.className = 'cfe-go'; go.textContent = '›';
    var n = sortedBonds().length;
    if (n) { t.textContent = 'the confluence'; c.textContent = n + (n === 1 ? ' woven' : ' woven'); }
    else { t.textContent = 'the confluence — begin becoming one'; c.textContent = ''; }
    row.appendChild(g); row.appendChild(t); row.appendChild(c); row.appendChild(go);
    row.onclick = function () { open(); };
    pane.appendChild(row);
    return row;
  }
  // keep the commons entry's count honest when it is on screen
  function updateEntry() {
    try {
      var row = document.querySelector('#dvCommonsSheet .cf-entry');
      if (!row) return;
      var n = sortedBonds().length;
      var c = row.querySelector('.cfe-c'), t = row.querySelector('.cfe-t');
      if (n) { if (t) t.textContent = 'the confluence'; if (c) c.textContent = n + ' woven'; }
      else { if (t) t.textContent = 'the confluence — begin becoming one'; if (c) c.textContent = ''; }
    } catch (_) {}
  }

  // ── mount: register with the one-open registry. NO launcher, NO fixed node. ─
  function mount() {
    if (!enabled()) return;
    load();
    var h = hud();
    if (h && h.registerSheet) {
      try { h.registerSheet('confluence', isOpen, close); } catch (_) {}
    } else { setTimeout(mount, 400); return; }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  W.VintConfluence = {
    open: open, close: close, isOpen: isOpen, enabled: enabled,
    render: render, entryInto: entryInto, refresh: syncVentures,
    // a READ-ONLY snapshot of the witnessed record, ranked by thread-count.
    // THE CONVERGENCE (convergence.js) composes its live invitations from this —
    // it never re-derives the record, so there is one source of witnessed truth.
    // Each entry: { name, kind:'human'|'agent', count, traded, ventured,
    // ventureNet, taught:[], learned:[], raised:[], first, last }. A shallow copy
    // so a reader can never mutate a bond.
    bonds: function () {
      return sortedBonds().map(function (b) {
        return {
          name: b.name, kind: b.kind, count: recount(b),
          traded: num(b.traded, 0), ventured: num(b.ventured, 0), ventureNet: num(b.ventureNet, 0),
          taught: (b.taught || []).slice(), learned: (b.learned || []).slice(), raised: (b.raised || []).slice(),
          first: b.first, last: b.last
        };
      });
    },
    // exposed for the verify harness only — never used by the UI
    _bondCount: function () { return sortedBonds().length; },
    _reset: function () { _state = fresh(); save(); if (isOpen()) render(); updateEntry(); }
  };
})();
