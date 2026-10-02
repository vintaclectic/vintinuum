// pulse-hud.js — THE PULSE: the world, living (AETHERHOLD 2026-10-02, task 9TYJB74)
//
// ════════════════════════════════════════════════════════════════════════════
// "SEE WHAT HAPPENS."
//
// The world does enormous things. Trades settle through the Concord treasury.
// A recipe is taught from one pair of hands to another. A crew pushes a great
// work past the line it could never reach alone. A stranger walks into your
// clearing. A lantern is set down in the fog. A craft is minted on the anvil.
// A reckoning falls. A ship leaves harbour. And every one of those is done not
// only by people but by their AGENTS — the court that lists and bids in the
// market, the bench that governs in the Concord, the beings that act whether
// you are watching or not.
//
// And until this file, NONE OF IT SURFACED. Every organ fired a real event onto
// the window — world-client re-broadcasts twenty of them (presence, trade,
// forge, weave, struct, trace, law, strike, died); market, concord, admiralty
// and secrets add their own — and the only thing that ever caught them was a
// 2.6-second toast that then vanished forever. There was no place a player could
// LOOK UP and read what the world had just done. A living world you cannot watch
// live is, to the person standing in it, a still photograph.
//
// THE PULSE is that place: one river of REAL emergent events, newest first,
// where a human and an agent appear SIDE BY SIDE as equal rows. That equality is
// not decoration — it is the whole acceptance made literal on screen. We are not
// "users and their agents." We are one world of actors, and the river does not
// rank them. A person who arrived and an agent who sold your tool get the same
// row, the same weight, the same light; only a quiet glyph says which kind of
// soul it was, and only when the system actually KNOWS.
//
// ── THE IRON RULE: NOTHING IN THIS RIVER IS INVENTED ─────────────────────────
// Every row comes from a signal the system ALREADY emits. There is no synthetic
// activity, no "3 traders online" inflation, no fabricated liveliness to make an
// empty world feel full. If the world is quiet, the river says so, honestly. The
// twenty-odd listeners below each map to a verified dispatch — the file:line of
// the server handler or the client re-broadcast is named at the call site. The
// client DECIDES nothing: it classifies an actor only against rosters it can
// verify (the live presence frame for people; VintCourt.bench() for agents) and
// otherwise says, plainly, "someone." A name it cannot place is never promoted
// to a kind it cannot prove.
//
// ── NO-COLLISION LAW (absolute) ──────────────────────────────────────────────
// This surface is AMBIENT and it touches nothing. It has two parts, and both are
// collision-safe by construction, not by hope:
//
//   1. THE GLANCE — a single fixed line docked to the RIGHT edge, in the one
//      persistent clear sub-band this HUD has: BELOW the top-right control stack
//      (#topctl, #editHeadBtn) and ABOVE #status's ceiling (--vint-hud-bottom,
//      the panel's measured true bottom, ~270px). Its top is MEASURED live from
//      those neighbours' real rects (ResizeObserver + resize + a short settle
//      poll) and clamped: if the controls ever grow tall enough that there is no
//      honest gap before #status, THE GLANCE HIDES rather than overlap. It is
//      right-anchored and width-capped so it can never reach the left rail or a
//      centred #status message in its own y-band. It adds NO rail launcher (the
//      rail is already at 15 and overflows at 375 — defect GEJ8NYU) and it is not
//      draggable: an ambient ticker that could be dragged onto other elements
//      would be the exact collision this law forbids, and its tap already owns a
//      gesture (open the river). Dismissible to a 26px dot, then fully hideable.
//
//   2. THE RIVER — the full scrolling history, opened from THE GLANCE as a
//      `.dv-sheet` in DirverseHUD's one-open-at-a-time registry. It reuses the
//      proven bottom-sheet box verbatim (height-capped, .dv-body internal
//      scroll, safe-area padded, scrim-dimmed, grip-dismissible). Opening it
//      CLOSES every sibling sheet; it never mounts on another surface's pixels.
//
// ── UNTRUSTED CONTENT ────────────────────────────────────────────────────────
// Every actor name here came from a stranger or an agent over the wire. It is
// placed with textContent, once, at the leaf — never concatenated into innerHTML.
//
// ── RETENTION DOCTRINE (all seven, and this organ lives or dies by #7) ───────
//   1 GENEROUS (Aria) — every row is a true event; the empty state is honestly
//     empty. If you saw how this works you would thank us: it never lies about
//     how alive the world is to make you stay.
//   2 INVESTMENT LOOP (Helios) — the river is the trigger→reward surface of the
//     whole world. You glance, you see your agent cleared a sale or a crew
//     finished the work you seeded, you go back in. The more you and your court
//     act, the richer YOUR river — a compounding asset no competitor can copy.
//   3 TIER (Frugal-Max) — FREE. Seeing the world live is the top of the funnel;
//     charging for it would be the resented kind. It converts by making the
//     world somewhere you have a stake, not by gating the glance.
//   4 DENSE (Lunex) — glyph · name · one clause · time. A fourteen-token truth,
//     never a paragraph.
//   5 OPEN LOOP (Morrison) — "a crew finished the great work while you were
//     gone." Unfinished meaning is the hook; the latest line is always a thread
//     to pull. You come back for communion, not a streak.
//   6 FLAGGED + TRANSPARENT (Atlas) — ?pulse=0 (or vint:flag:world_pulse) kills
//     it in 30s, no deploy. The river's own head carries "why am I seeing this?"
//     — because every line is a real thing the world just did. Nothing here is
//     inflatable; the resentment valve is hide(), one tap, keeps nothing running.
//   7 MORE ALIVE (Yuna) — the entire reason it exists. A world you can watch
//     living, humans and agents as one river, is alive. The same world with its
//     events thrown away two seconds after they happen is a screensaver.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintPulse) return;

  var W = window, D = document;
  function hud() { return W.DirverseHUD; }
  function world() { return W.VintinuumWorld; }

  // ── FEATURE FLAG — ?pulse=0/1, then the latched resentment valve ───────────
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('pulse') === '0') _flag = false;
      else if (q.get('pulse') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_pulse') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ── STATE ──────────────────────────────────────────────────────────────────
  var MAX = 120;                 // the river never grows unbounded on a phone
  var _rows = [];                // newest first
  var _unseen = 0;               // events added while the river sheet was closed
  var _people = Object.create(null);   // human names verified present (presence frame)
  var _seen = Object.create(null);     // arrival dedupe, per room
  var _primed = false;           // first presence frame is a census, not arrivals
  var _filter = 'all';           // all | person | agent | you
  var _collapsed = false;        // GLANCE shrunk to a dot
  var _hidden = false;           // GLANCE fully hidden this session (resentment valve)
  var _glance = null, _sheet = null;
  var _emitSeq = 0;              // monotonic, for test introspection

  // ── ACTOR CLASSIFICATION — verified, never guessed ─────────────────────────
  // self: the player. person: a human the live presence frame has named here.
  // agent: a member of this user's own court (VintCourt.bench()). someone: a
  // named soul the system cannot place — rendered honestly as neutral, never
  // promoted to a kind we cannot prove.
  function selfName() { try { var w = world(); return (w && w._selfName) || 'you'; } catch (_) { return 'you'; } }
  function courtNames() {
    try {
      var c = W.VintCourt;
      if (c && typeof c.bench === 'function') {
        return c.bench().map(function (b) { return b && b.agent && b.agent.name; }).filter(Boolean);
      }
    } catch (_) {}
    return [];
  }
  function classify(name) {
    if (!name) return 'someone';
    if (name === selfName()) return 'you';
    if (_people[name]) return 'person';
    var cn = courtNames();
    for (var i = 0; i < cn.length; i++) if (cn[i] === name) return 'agent';
    return 'someone';
  }

  var KIND = {
    you:     { g: '◉', tint: '#f4c79a', label: 'you' },
    person:  { g: '◉', tint: '#9fdcff', label: 'a person' },
    agent:   { g: '◈', tint: '#c6a6ff', label: 'an agent' },
    someone: { g: '◇', tint: '#cfc3b0', label: 'someone' },
    world:   { g: '⟡', tint: '#9ad6b4', label: 'the world' }
  };

  // ── THE ONLY DOOR A ROW ENTERS BY ──────────────────────────────────────────
  // Every call site below is a verified real event. There is no other producer.
  function push(kind, actor, verb, scope) {
    if (!enabled()) return null;
    if (!KIND[kind]) kind = 'someone';
    var row = {
      seq: ++_emitSeq,
      kind: kind,
      actor: (actor != null && String(actor)) || KIND[kind].label,
      verb: String(verb || ''),
      at: Date.now(),
      scope: scope || 'near'    // 'world' = global (every soul online); 'near' = your world
    };
    _rows.unshift(row);
    if (_rows.length > MAX) _rows.length = MAX;
    if (!sheetOpen()) _unseen++;
    try { renderGlance(); } catch (_) {}
    try { if (sheetOpen()) renderRiver(); } catch (_) {}
    return row;
  }

  // ── RELATIVE TIME — dense, honest, never a fake precision ──────────────────
  function ago(t) {
    var s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 5) return 'now';
    if (s < 60) return s + 's';
    var m = Math.round(s / 60);
    if (m < 60) return m + 'm';
    var h = Math.round(m / 60);
    if (h < 24) return h + 'h';
    return Math.round(h / 24) + 'd';
  }

  // ════════════════════════════════════════════════════════════════════════
  // THE LISTENERS — one per verified real signal. The file:line named is the
  // dispatch this row is sourced from; this file interprets only fields it has
  // read at that source.
  // ════════════════════════════════════════════════════════════════════════

  // presence — the 5Hz room frame, re-broadcast by world-client.js:728. m.users
  // are human accounts (court agents ride m.agents, which is NOT re-dispatched).
  // Arrival-diffing pattern mirrors commons.js:528 (census guard + _seen map).
  W.addEventListener('vint:world-presence', function (e) {
    var users = (e.detail && e.detail.users) || [];
    var fresh = [];
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      if (!u || !u.id) continue;
      if (u.self) continue;
      var nm = u.name || 'someone';
      _people[nm] = 1;                              // verified: a human is here
      if (_seen[u.id]) continue;
      _seen[u.id] = 1;
      fresh.push(nm);
    }
    if (!_primed) { _primed = true; return; }       // first frame = census, not arrivals
    for (var j = 0; j < fresh.length; j++) push('person', fresh[j], 'walked into the world', 'near');
  });

  // market — the async bazaar. ENRICHED at market.js:464 with the real
  // counterparty name + agent flag (counterparties are always your court).
  W.addEventListener('vint:market-settled', function (e) {
    var d = e.detail || {};
    var title = d.title || 'something';
    var lum = (typeof d.lumen === 'number') ? d.lumen : null;
    var cost = lum != null ? (' for ' + lum + ' lumen') : '';
    if (d.soldByYou) {
      var buyerKind = d.counterpartyIsAgent ? 'agent' : classify(d.counterparty);
      // the SALE is yours, but the actor who completed it is the counterparty —
      // render the buyer so an agent clearing your stall is a named row.
      push(buyerKind, d.counterparty || KIND[buyerKind].label, 'bought your ' + title + cost, 'near');
    } else {
      var sellerKind = d.counterpartyIsAgent ? 'agent' : classify(d.counterparty);
      push(sellerKind, d.counterparty || KIND[sellerKind].label, 'sold you ' + title + cost, 'near');
    }
  });

  // trade — the co-present escrow swap, server-settled. world-client.js:842.
  // You are always a party to a table you are standing at, so this is a 'you' row.
  W.addEventListener('vint:world-trade-settled', function (e) {
    var d = e.detail || {};
    var gave = manifest(d.gave), got = manifest(d.got);
    var verb = 'settled a trade';
    if (gave && got) verb = 'traded ' + gave + ' for ' + got;
    else if (got) verb = 'received ' + got + ' in a trade';
    else if (gave) verb = 'gave ' + gave + ' in a trade';
    push('you', null, verb, 'near');
  });
  function manifest(m) {
    if (!m || typeof m !== 'object') return '';
    var parts = [];
    for (var k in m) {
      if (!Object.prototype.hasOwnProperty.call(m, k)) continue;
      var n = m[k]; if (typeof n !== 'number' || !(n > 0)) continue;
      parts.push(n + ' ' + String(k).replace(/_/g, ' '));
    }
    if (parts.length <= 1) return parts[0] || '';
    return parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1];
  }

  // forge:first — the ONE global frame: first soul in this world to make a
  // recipe, ever. world-client.js:860, fields {who,name} per forge-hud.js:831.
  W.addEventListener('vint:world-forge-first', function (e) {
    var d = e.detail || {};
    push(classify(d.who), d.who, 'forged the first ' + (d.name || 'new thing') + ' this world has seen', 'world');
  });

  // forge:learned — someone taught YOU. world-client.js:864, {from,name}
  // (forge-hud.js:845). The teacher is the actor; the gift is to you.
  W.addEventListener('vint:world-forge-learned', function (e) {
    var d = e.detail || {};
    push(classify(d.from), d.from, 'taught you to make a ' + (d.name || 'new thing'), 'near');
  });

  // forge:taught — YOU handed a recipe to someone. world-client.js:862.
  W.addEventListener('vint:world-forge-taught', function () {
    push('you', null, 'taught a recipe to someone', 'near');
  });

  // forge:completed — a great work is finished; crew named. world-client.js:876,
  // {crew:[{name}],name,yours} per forge-hud.js:886.
  W.addEventListener('vint:world-forge-completed', function (e) {
    var d = e.detail || {};
    var crew = (d.crew || []).map(function (c) { return (c && c.name) || 'someone'; });
    var who = crew.length ? crew.join(', ') : 'a crew';
    push(d.yours ? 'you' : 'someone', d.yours ? null : who,
      (d.yours ? 'helped finish the ' : 'finished the ') + (d.name || 'great work'), 'world');
  });

  // forge:raised — a great work was raised (begun). world-client.js:870.
  W.addEventListener('vint:world-forge-raised', function () {
    push('you', null, 'raised a great work', 'near');
  });

  // forge:contributed — you added to a crew's work. world-client.js:872.
  W.addEventListener('vint:world-forge-contributed', function () {
    push('you', null, 'added to a great work', 'near');
  });

  // forge:ok — the anvil rang; a craft was minted. world-client.js:858.
  W.addEventListener('vint:world-forge', function () {
    push('you', null, 'forged something new on the anvil', 'near');
  });

  // weave — a strand was woven (the build economy faucet). world-client.js:825.
  W.addEventListener('vint:world-weave', function () {
    push('you', null, 'wove a strand of light', 'near');
  });

  // struct — a built piece was placed in the world. world-client.js:789,
  // relays m.struct (which carries .kind, drawn by _renderStruct).
  W.addEventListener('vint:world-struct', function (e) {
    var st = (e.detail && (e.detail.kind ? e.detail : e.detail.struct)) || {};
    var kind = st.kind ? String(st.kind) : 'something';
    push('you', null, 'built a ' + kind, 'near');
  });

  // trace — a lantern was set down. new trace from another soul standing here
  // (world-client.js:778) vs your own confirmed one (world-client.js:782).
  W.addEventListener('vint:world-trace', function () {
    push('someone', null, 'left a lantern in the fog', 'near');
  });
  W.addEventListener('vint:world-trace-ok', function () {
    push('you', null, 'left a lantern', 'near');
  });

  // concord — the bench ruled. concord.js:793, {passed,kind,effect}. The bench
  // IS this user's court (see concord.js header: "your court governs"), so this
  // is the agent lane made literal: your agents governing while you watch.
  W.addEventListener('vint:concord-resolved', function (e) {
    var d = e.detail || {};
    push('agent', 'the Concord', 'ruled on ' + (d.kind || 'a motion') + ' — it ' + (d.passed ? 'carried' : 'fell'), 'near');
  });

  // law — a policy carried / a vote landed. world-client.js:816; the carried
  // flag is read exactly as reckoning-hud.js:513 reads it.
  W.addEventListener('vint:world-law', function (e) {
    var d = e.detail || {};
    if (d.carried) push('world', null, 'a law carried — it is real now', 'near');
    else if (d.yes != null) push('world', null, 'a vote was cast on the order paper', 'near');
  });

  // strike — a reckoning fell. world-client.js:809, {victim:{name},took} per
  // reckoning-hud.js:506. This is YOUR strike (the server addresses the striker).
  W.addEventListener('vint:world-strike', function (e) {
    var d = e.detail || {};
    var v = (d.victim && d.victim.name) || 'someone';
    push('you', null, 'struck ' + v, 'near');
  });

  // died — a being fell in this world. world-client.js:799. No single actor is
  // named at this frame, so it is the world's own voice.
  W.addEventListener('vint:world-died', function () {
    push('world', null, 'a being fell in this world', 'near');
  });

  // admiralty — a ship set sail / a voyage returned. admiralty.js:853 & :1220.
  W.addEventListener('vint:admiralty-launched', function (e) {
    var d = e.detail || {};
    push('you', null, 'launched ' + (d.name || 'a ship') + (d.cls ? (', a ' + d.cls) : ''), 'near');
  });
  W.addEventListener('vint:admiralty-wake', function (e) {
    var d = e.detail || {};
    push('you', null, d.won ? 'brought a voyage home in triumph' : 'brought a voyage home', 'near');
  });

  // secret — a secret was kept. secrets.js:344, {id,name,at}.
  W.addEventListener('vint:secret-kept', function (e) {
    var d = e.detail || {};
    push('you', null, 'kept a secret' + (d.name ? (': ' + d.name) : ''), 'near');
  });

  // travel — a new world is a new river. Reset per-room memory (mirror of the
  // commons travel reset, commons.js:550), keep nothing that belonged to the
  // place you left.
  W.addEventListener('vint:world-travel', function () {
    _rows = []; _unseen = 0; _people = Object.create(null); _seen = Object.create(null);
    _primed = false;
    try { renderGlance(); } catch (_) {}
    try { if (sheetOpen()) renderRiver(); } catch (_) {}
  });

  // ════════════════════════════════════════════════════════════════════════
  // STYLES — namespaced vp-*; the river sheet borrows .dv-sheet/.dv-body/etc.
  // ════════════════════════════════════════════════════════════════════════
  var _styled = false;
  function injectStyles() {
    if (_styled) return; _styled = true;
    var css = [
      // THE GLANCE — right-edge, single line, measured clear sub-band.
      '#vpGlance{position:fixed;z-index:6;right:max(12px,env(safe-area-inset-right,12px));',
      ' top:170px;max-width:min(320px,calc(100vw - 92px));display:none;align-items:center;gap:9px;',
      ' min-height:44px;padding:8px 12px;border-radius:13px;',
      ' background:rgba(10,14,22,0.74);border:1px solid rgba(159,220,255,0.22);',
      ' -webkit-backdrop-filter:blur(9px);backdrop-filter:blur(9px);cursor:pointer;',
      ' box-shadow:0 6px 22px rgba(0,0,0,0.34);color:#e8f1ff;',
      ' transition:opacity .4s ease, box-shadow .5s ease;}',
      '#vpGlance.vp-on{display:flex;}',
      '#vpGlance .vp-g{font-size:15px;line-height:1;flex:0 0 auto;}',
      '#vpGlance .vp-txt{flex:1 1 auto;min-width:0;font-size:clamp(12px,3.3vw,13.5px);',
      ' line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#vpGlance .vp-txt b{font-weight:600;}',
      '#vpGlance .vp-n{flex:0 0 auto;font-size:11px;min-width:20px;height:20px;padding:0 6px;',
      ' border-radius:10px;display:none;align-items:center;justify-content:center;',
      ' background:rgba(159,220,255,0.18);color:#bfe4ff;}',
      '#vpGlance .vp-n.vp-show{display:inline-flex;}',
      '#vpGlance .vp-x{flex:0 0 auto;width:28px;height:28px;border-radius:8px;border:0;',
      ' background:transparent;color:rgba(232,241,255,0.5);font-size:14px;cursor:pointer;',
      ' display:flex;align-items:center;justify-content:center;}',
      '#vpGlance .vp-x:hover{color:#e8f1ff;}',
      // the pulse flash when new life arrives (reduced-motion safe below)
      '#vpGlance.vp-beat{box-shadow:0 6px 22px rgba(0,0,0,0.34),0 0 0 2px rgba(159,220,255,0.45);}',
      // THE DOT — collapsed glance
      '#vpDot{position:fixed;z-index:6;right:max(12px,env(safe-area-inset-right,12px));top:170px;',
      ' width:26px;height:26px;border-radius:50%;display:none;cursor:pointer;',
      ' background:rgba(10,14,22,0.74);border:1px solid rgba(159,220,255,0.3);',
      ' -webkit-backdrop-filter:blur(9px);backdrop-filter:blur(9px);',
      ' box-shadow:0 4px 14px rgba(0,0,0,0.34);}',
      '#vpDot.vp-on{display:block;}',
      '#vpDot .vp-ping{position:absolute;inset:0;border-radius:50%;',
      ' box-shadow:0 0 0 0 rgba(159,220,255,0.5);}',
      '#vpDot.vp-beat .vp-ping{animation:vpping 1.4s ease-out 1;}',
      '@keyframes vpping{0%{box-shadow:0 0 0 0 rgba(159,220,255,0.5);}100%{box-shadow:0 0 0 12px rgba(159,220,255,0);}}',
      // THE RIVER — rows (inside the shared .dv-body)
      '#vpFilters{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 10px;}',
      '.vp-chip{min-height:34px;padding:0 13px;border-radius:17px;border:1px solid rgba(159,220,255,0.26);',
      ' background:transparent;color:rgba(232,241,255,0.72);font-size:12.5px;cursor:pointer;}',
      '.vp-chip.on{background:rgba(159,220,255,0.16);color:#eaf3ff;border-color:rgba(159,220,255,0.5);}',
      '#vpWhy{font-size:12px;line-height:1.4;color:rgba(232,241,255,0.5);margin:0 0 12px;font-style:italic;}',
      '.vp-row{display:flex;align-items:flex-start;gap:11px;padding:10px 2px;',
      ' border-bottom:1px solid rgba(255,255,255,0.06);}',
      '.vp-row .vp-ic{flex:0 0 auto;width:22px;height:22px;border-radius:50%;display:flex;',
      ' align-items:center;justify-content:center;font-size:12px;margin-top:1px;',
      ' background:rgba(255,255,255,0.05);}',
      '.vp-row .vp-main{flex:1 1 auto;min-width:0;}',
      '.vp-row .vp-line{font-size:14px;line-height:1.35;color:#eef4ff;',
      ' overflow-wrap:anywhere;}',
      '.vp-row .vp-line b{font-weight:600;}',
      '.vp-row .vp-meta{font-size:11.5px;color:rgba(232,241,255,0.42);margin-top:2px;}',
      '.vp-row .vp-meta .vp-world{color:#9ad6b4;}',
      '.vp-empty{padding:34px 8px;text-align:center;color:rgba(232,241,255,0.5);',
      ' font-size:14px;line-height:1.5;font-style:italic;}',
      '@media (prefers-reduced-motion: reduce){',
      ' #vpGlance,#vpDot .vp-ping{transition:none !important;animation:none !important;}',
      ' #vpGlance.vp-beat{box-shadow:0 6px 22px rgba(0,0,0,0.34);}}'
    ].join('');
    var tag = D.createElement('style');
    tag.id = 'vpStyles';
    tag.textContent = css;
    (D.head || D.documentElement).appendChild(tag);
  }

  // ════════════════════════════════════════════════════════════════════════
  // THE GLANCE
  // ════════════════════════════════════════════════════════════════════════
  var _dot = null, _beatT = null;
  function buildGlance() {
    if (_glance) return _glance;
    injectStyles();
    var g = D.createElement('div');
    g.id = 'vpGlance';
    g.setAttribute('role', 'button');
    g.setAttribute('aria-label', 'open the pulse — the world, living');
    g.innerHTML =
      '<span class="vp-g" aria-hidden="true">⟡</span>' +
      '<span class="vp-txt"></span>' +
      '<span class="vp-n" aria-hidden="true"></span>' +
      '<button class="vp-x" aria-label="dismiss the pulse">✕</button>';
    g.addEventListener('click', function (e) {
      if (e.target && e.target.classList && e.target.classList.contains('vp-x')) return;
      openRiver();
    });
    g.querySelector('.vp-x').addEventListener('click', function (e) {
      e.stopPropagation(); collapseGlance();
    });
    D.body.appendChild(g);
    _glance = g;

    var dot = D.createElement('div');
    dot.id = 'vpDot';
    dot.setAttribute('role', 'button');
    dot.setAttribute('aria-label', 'the pulse — tap to watch the world');
    dot.innerHTML = '<span class="vp-ping" aria-hidden="true"></span>';
    dot.addEventListener('click', function () { _collapsed = false; renderGlance(); openRiver(); });
    D.body.appendChild(dot);
    _dot = dot;

    layoutGlance();
    return g;
  }

  function collapseGlance() {
    // first ✕ → shrink to a dot (still watchable). A dot already dismissed → hide
    // for the session (the resentment valve; returns next visit, never nagged).
    if (!_collapsed) { _collapsed = true; }
    else { _hidden = true; }
    renderGlance();
  }

  function latestText() {
    for (var i = 0; i < _rows.length; i++) return _rows[i];
    return null;
  }

  function renderGlance() {
    if (!_glance) { if (!enabled() || _hidden) return; buildGlance(); }
    var r = latestText();
    if (r && !_collapsed) {
      // paint the latest line — textContent only, never innerHTML with names
      var txt = _glance.querySelector('.vp-txt');
      var gl = _glance.querySelector('.vp-g');
      var nb = _glance.querySelector('.vp-n');
      gl.textContent = KIND[r.kind].g;
      gl.style.color = KIND[r.kind].tint;
      while (txt.firstChild) txt.removeChild(txt.firstChild);
      var b = D.createElement('b'); b.textContent = r.actor; b.style.color = KIND[r.kind].tint;
      txt.appendChild(b);
      txt.appendChild(D.createTextNode(' ' + r.verb));
      if (_unseen > 0) { nb.textContent = '+' + _unseen; nb.classList.add('vp-show'); }
      else { nb.classList.remove('vp-show'); }
    }
    var m = layoutGlance();          // positions + decides visibility (symmetric)
    // a NEW arrival pulses the surface that is actually visible
    if (r && m.want === 'line') pulse(_glance);
    else if (r && m.want === 'dot') pulse(_dot);
  }


  function pulse(elm) {
    if (!elm) return;
    try {
      if (W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    } catch (_) {}
    elm.classList.remove('vp-beat');
    // force reflow so the class re-add restarts the transition/animation
    void elm.offsetWidth;
    elm.classList.add('vp-beat');
    clearTimeout(_beatT);
    _beatT = setTimeout(function () { elm.classList.remove('vp-beat'); }, 1500);
  }

  // ── LAYOUT — collision-safe BY CONSTRUCTION, not by predicting production ──
  // The glance is right-anchored and docked just below the top-right control
  // stack. Rather than guess the live geometry (which varies with sign-in state,
  // the HUD panel's reflow and the viewport), it runs a TRUE 2D intersection
  // test of its own candidate box against the real rects of every neighbour it
  // could possibly meet, and it only shows a surface that PROVABLY touches none
  // of them. Tiered so the ambient entry survives tight states:
  //   · the rich 52px LINE if it clears everything,
  //   · else the 26px DOT (a far smaller box that clears almost anywhere),
  //   · else nothing — it hides rather than ever overlap.
  // This is the No-Collision law honoured without a single assumed pixel.
  var NEIGHBOURS = ['topctl', 'editHeadBtn', 'status', 'movectl', 'dvRail', 'hint', 'feed', 'saybar'];
  function rectOf(id) {
    var e = D.getElementById(id); if (!e) return null;
    try {
      var cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return null;
      var r = e.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) return null;
      return { x: r.left, y: r.top, r: r.right, b: r.bottom };
    } catch (_) { return null; }
  }
  function overlaps(a, b) { return !!(a && b && a.x < b.r - 0.5 && a.r > b.x + 0.5 && a.y < b.b - 0.5 && a.b > b.y + 0.5); }
  function clearOf(box) {
    for (var i = 0; i < NEIGHBOURS.length; i++) if (overlaps(box, rectOf(NEIGHBOURS[i]))) return false;
    return true;
  }
  function measure() {
    var GAP = 8;
    var vw = W.innerWidth || 320;
    var R = 12;
    try { R = Math.max(12, parseFloat(getComputedStyle(D.documentElement).getPropertyValue('env(safe-area-inset-right)')) || 12); } catch (_) { R = 12; }
    // dock just below the lowest of the top-right controls
    var below = 56;
    var tc = rectOf('topctl'), eh = rectOf('editHeadBtn');
    if (tc) below = Math.max(below, tc.b);
    if (eh) below = Math.max(below, eh.b);
    var top = Math.round(below + GAP);
    var lineW = Math.min(320, Math.max(150, vw - 92));
    var lineBox = { x: vw - R - lineW, r: vw - R, y: top, b: top + 52 };
    var dotBox = { x: vw - R - 26, r: vw - R, y: top, b: top + 26 };
    return { top: top, lineOk: clearOf(lineBox), dotOk: clearOf(dotBox), lineBox: lineBox, dotBox: dotBox, vw: vw };
  }

  // Visibility lives in ONE place and is fully symmetric — room returning brings
  // the glance BACK; it is never stranded off after a tight moment passes.
  function layoutGlance() {
    var m = measure();
    if (_glance) _glance.style.top = m.top + 'px';
    if (_dot) _dot.style.top = m.top + 'px';
    var have = enabled() && !_hidden && !!latestText();
    var want = 'none';
    if (have) {
      if (_collapsed) want = m.dotOk ? 'dot' : 'none';
      else want = m.lineOk ? 'line' : (m.dotOk ? 'dot' : 'none');
    }
    if (_glance) _glance.classList.toggle('vp-on', want === 'line');
    if (_dot) _dot.classList.toggle('vp-on', want === 'dot');
    m.want = want;
    return m;
  }

  // ════════════════════════════════════════════════════════════════════════
  // THE RIVER — the full sheet (DirverseHUD registry, proven .dv-sheet box)
  // ════════════════════════════════════════════════════════════════════════
  function buildSheet() {
    if (_sheet) return _sheet;
    injectStyles();
    var el = D.createElement('div');
    el.className = 'dv-sheet'; el.id = 'vpSheet';
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the pulse<small>the world, living · newest first</small></div>' +
        '<button class="dv-x" id="vpClose" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body">' +
        '<div id="vpFilters">' +
          '<button class="vp-chip on" data-f="all">all</button>' +
          '<button class="vp-chip" data-f="person">people</button>' +
          '<button class="vp-chip" data-f="agent">agents</button>' +
          '<button class="vp-chip" data-f="you">you</button>' +
        '</div>' +
        '<div id="vpWhy">why am I seeing this? every line is a real thing the world just did — a person or an agent acting, nothing invented.</div>' +
        '<div id="vpList"></div>' +
      '</div>';
    D.body.appendChild(el);
    _sheet = el;
    el.querySelector('#vpClose').onclick = closeRiver;
    el.querySelectorAll('.vp-chip').forEach(function (c) {
      c.onclick = function () {
        _filter = c.getAttribute('data-f');
        el.querySelectorAll('.vp-chip').forEach(function (x) { x.classList.toggle('on', x === c); });
        renderRiver();
      };
    });
    try { if (hud() && hud().registerSheet) hud().registerSheet('pulse', isSheetOpenEl, closeRiver); } catch (_) {}
    return el;
  }

  function isSheetOpenEl() { return !!_sheet && _sheet.classList.contains('open'); }
  function sheetOpen() { return isSheetOpenEl(); }

  function openRiver() {
    if (!enabled()) return;
    var h = hud();
    if (h && h.openSheet) h.openSheet('pulse', function () { buildSheet(); _sheet.classList.add('open'); afterOpen(); });
    else { buildSheet(); _sheet.classList.add('open'); afterOpen(); }
  }
  function afterOpen() {
    _unseen = 0;
    renderRiver();
    renderGlance();
  }
  function closeRiver() {
    if (_sheet) _sheet.classList.remove('open');
    try { if (hud() && hud().closeSheets) { /* registry sync handled by caller */ } } catch (_) {}
    renderGlance();
  }

  function matchFilter(r) {
    if (_filter === 'all') return true;
    if (_filter === 'you') return r.kind === 'you';
    if (_filter === 'person') return r.kind === 'person';
    if (_filter === 'agent') return r.kind === 'agent';
    return true;
  }

  function renderRiver() {
    if (!_sheet) return;
    var list = _sheet.querySelector('#vpList');
    if (!list) return;
    while (list.firstChild) list.removeChild(list.firstChild);
    var shown = 0;
    for (var i = 0; i < _rows.length; i++) {
      var r = _rows[i];
      if (!matchFilter(r)) continue;
      list.appendChild(rowEl(r));
      shown++;
    }
    if (!shown) {
      var e = D.createElement('div');
      e.className = 'vp-empty';
      e.textContent = _rows.length
        ? 'nothing here under this filter yet.'
        : 'the world is quiet right now. stay — and you will see it move.';
      list.appendChild(e);
    }
  }

  function rowEl(r) {
    var row = D.createElement('div'); row.className = 'vp-row';
    var ic = D.createElement('div'); ic.className = 'vp-ic';
    ic.textContent = KIND[r.kind].g; ic.style.color = KIND[r.kind].tint;
    row.appendChild(ic);
    var main = D.createElement('div'); main.className = 'vp-main';
    var line = D.createElement('div'); line.className = 'vp-line';
    var b = D.createElement('b'); b.textContent = r.actor; b.style.color = KIND[r.kind].tint;
    line.appendChild(b);
    line.appendChild(D.createTextNode(' ' + r.verb));
    main.appendChild(line);
    var meta = D.createElement('div'); meta.className = 'vp-meta';
    meta.textContent = ago(r.at);
    if (r.scope === 'world') {
      meta.appendChild(D.createTextNode(' · '));
      var w = D.createElement('span'); w.className = 'vp-world'; w.textContent = 'across the world';
      meta.appendChild(w);
    }
    main.appendChild(meta);
    row.appendChild(main);
    return row;
  }

  // keep the glance's measured band true as the HUD reflows
  // Relayout now AND after the HUD panel finishes reflowing (it republishes
  // --vint-hud-bottom a frame or two later), so a transient mid-reflow value can
  // never leave the glance stranded off at the new size.
  function relayoutSoon() {
    try { layoutGlance(); } catch (_) {}
    try { requestAnimationFrame(function () { try { layoutGlance(); } catch (_) {} }); } catch (_) {}
    setTimeout(function () { try { layoutGlance(); } catch (_) {} }, 320);
  }
  try {
    W.addEventListener('resize', relayoutSoon);
    W.addEventListener('orientationchange', relayoutSoon);
    var _ro;
    function observeNeighbours() {
      if (typeof ResizeObserver !== 'function' || _ro) return;
      _ro = new ResizeObserver(function () { try { layoutGlance(); } catch (_) {} });
      var tc = D.getElementById('topctl'); if (tc) _ro.observe(tc);
      var eh = D.getElementById('editHeadBtn'); if (eh) _ro.observe(eh);
    }
    // a short settle beat: the HUD publishes --vint-hud-bottom on world:state,
    // which can arrive after we mount; relayout a few times early, then rest.
    var _settle = 0;
    var _settleT = setInterval(function () {
      try { observeNeighbours(); layoutGlance(); } catch (_) {}
      if (++_settle > 12) { clearInterval(_settleT); }
    }, 500);
    W.addEventListener('vint:world-state', function () { try { layoutGlance(); } catch (_) {} });
  } catch (_) {}

  function mount() {
    if (!enabled()) return;
    buildGlance();
    renderGlance();
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  // ── PUBLIC + TEST SURFACE ──────────────────────────────────────────────────
  W.VintPulse = {
    open: openRiver,
    close: closeRiver,
    isOpen: isSheetOpenEl,
    enabled: enabled,
    hide: function () { _hidden = true; renderGlance(); },
    // test introspection — proves the river reflects exactly the events fired
    _rows: function () { return _rows.slice(); },
    _count: function () { return _rows.length; },
    _unseen: function () { return _unseen; },
    _measure: measure,
    _push: push,                 // used by the verification harness to drive 'push' directly
    _classify: classify
  };
})();
