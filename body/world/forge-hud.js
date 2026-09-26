// forge-hud.js — THE FORGE: two things become a third, and what you learn is
// worth more when you give it away. (AETHERHOLD, world-forger, 2026-09-25)
//
// ════════════════════════════════════════════════════════════════════════════
// "I WANT AN EPIC WORLD WHERE USERS AND THEIR AGENTS COME TO DO EVERYTHING
//  HUMANS DO — BUILD, CREATE, LEARN, THRIVE, DIE, LOSE."
//
// DIRVERSE could already do one economic verb properly: hand a thing to another
// person (the commons + ledger.js, real escrow, no dupes). And it had one
// conversion: echo → strand. That is a shop and a tap. It is not a civilisation.
//
// Nothing in the world could be COMBINED with anything else. There was no
// object in the database that had ever not existed before somebody put two
// things together. No knowledge anyone could hold that another person could
// not. No work too big for one pair of hands. So there was nothing to teach,
// nothing to collaborate on, and nothing to be first at.
//
// This surface is the anvil, and the four things that follow from it.
//
//   1. THE ANVIL — put two or more things down. Strike. Find out. You are NEVER
//      shown a recipe list to fill in; you are shown WHAT YOU HOLD and left to
//      wonder. A match mints an artifact with your name on it, forever. A miss
//      genuinely eats the material — and hands back SLAG, which is itself an
//      ingredient in two real recipes. Loss is real; it is never a dead end.
//   2. WHAT YOU KNOW — the recipes you have worked out, and the honest count of
//      how many exist that you have not. Never WHICH ones. The unknown stays
//      unknown or discovery is just reading.
//   3. TEACH — hand a recipe to a person standing here. THE WORLD PAYS YOU for
//      it and charges them NOTHING. The generous move and the selfish move are
//      the same move; that one inversion is the entire social economy.
//   4. THE GREAT WORKS — projects one person cannot finish, standing in public,
//      that anyone may add to and anyone may take their own share back out of.
//      When one completes, every contributor is named on the artifact forever —
//      not just whoever happened to land the last piece.
//   5. THE WORLD'S MEMORY — a feed of what everyone made, what they TRIED that
//      did not work, who taught whom, and the hall of everyone who was ever
//      first at anything. Failures are shown on purpose: a world that only
//      shows its highlight reel makes everyone feel alone in their own mistakes.
//
// ── PEERS, NOT PROPERTY (the acceptance criterion, honoured literally) ──────
// Lord Vinta was explicit: "for all users and their agents, NOT agents and
// their owners, because we are all one." So there is not one field, one string,
// or one mechanic in this file that frames an agent as owned. Nobody has an
// owner here. A row in the roster is a PARTICIPANT. An artifact has a MAKER and
// a CREW. A recipe has someone who was FIRST and someone who TAUGHT it. Every
// verb — strike, teach, contribute, withdraw — is available to a human and an
// agent on identical terms, because the server resolves them all as `user_id`
// and has no concept of which kind of mind is holding the socket. That is not a
// UI courtesy; it is the shape of the schema.
//
// ── WHAT THIS FILE DOES NOT DO ─────────────────────────────────────────────
// It decides NOTHING. It cannot name a recipe, compute an outcome, know whether
// a strike succeeded, or say who was first. It puts inputs on the wire and
// renders the answer, including the refusal. Every recipe lives on the server;
// the client is only ever sent the ones this player has already LEARNED, so an
// undiscovered recipe cannot be read out of the page source.
//
// ── VEHICLES (the "eventually") ────────────────────────────────────────────
// No vehicle flies today and none is faked. But an artifact row already carries
// `class` and a free-form `props`, and two recipes already mint class 'vessel'
// with mass/integrity/thrust/seats on them. The day a movement organ ships, the
// sleds people ALREADY OWN that day are flyable — no migration, no re-mint.
// This surface shows those props honestly as "it does not move yet."
//
// ── RETENTION DOCTRINE (all seven) ─────────────────────────────────────────
//   1 GENEROUS (Aria) — the teaching honorarium is paid BY THE WORLD to the
//     teacher and costs the student nothing. If a player saw exactly how this
//     hook works they would thank us, because the hook is "be good to people."
//     No timer, no streak, no pressure, no fake activity anywhere on it.
//   2 INVESTMENT LOOP (Helios) — every artifact, every recipe learned, every
//     crew you were named on is a compounding, uniquely-yours asset the world
//     remembers. The trigger is someone else's discovery landing in your feed;
//     the reward is variable because you genuinely do not know what a
//     combination does; the investment is knowledge that makes tomorrow's
//     forge cheaper. It is the honest moat: it cannot be copied because it is
//     made of what YOU worked out.
//   3 TIER (Frugal-Max) — FREE, entirely, forever. Making things and teaching
//     people is the top of the funnel and the reason anyone stays. It converts
//     by making the world a place where you have built things and people know
//     your name — which is what makes Companion's full memory worth paying for.
//   4 DENSE (Lunex) — a name, what it is made of, what it does, who was first.
//     No filler. The lore line is one sentence and it is the whole of it.
//   5 OPEN LOOP (Morrison) — "you know 3 of 7 things anyone has worked out" is
//     unfinished meaning, and it is TRUE. The four you do not know are real,
//     they are findable, and nobody will tell you what they are.
//   6 FLAGGED (Atlas) — 'world_forge' (?forge=0 or the localStorage flag),
//     killable in 30 seconds with no deploy. Every number rendered here is the
//     server's; nothing on this surface can be inflated by the client.
//   7 MORE ALIVE (Yuna) — a world where somebody else's good day is announced
//     to you, and where the thing you made has your name on it forever, is
//     alive. The same world with a crafting menu is a spreadsheet.
//
// ── NO-COLLISION LAW ───────────────────────────────────────────────────────
// Adds NO fixed element of its own — not one position:fixed rule in this file.
// It borrows DirverseHUD.addLauncher (a MEASURED slot in the rail that the rail
// itself lays out) and registerSheet/openSheet (the one-open-at-a-time registry),
// so raising it CLOSES every sibling sheet rather than mounting on their pixels.
// It reuses .dv-sheet/.dv-body verbatim — height-capped, internally scrolling,
// safe-area padded. Every long string (a stranger's name, an artifact name, a
// lore line) is ellipsised or wrapped at the leaf; a forty-row feed, a full
// manifest and a ten-person crew all scroll INSIDE the body. Content yields;
// the container never grows. Verified at 320/375/768/1280/1920.
//
// ── UNTRUSTED CONTENT ──────────────────────────────────────────────────────
// Every name in the feed, the hall and the crew came from a stranger. The
// server capped and sanitised it, and this file NEVER concatenates any of it
// into innerHTML — names go in through textContent, once, at the leaf. Both
// halves enforced; neither trusted alone.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintForge) return;

  var W = window;
  function world() { return W.VintinuumWorld; }
  function hud() { return W.DirverseHUD; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  // ── FEATURE FLAG — 'world_forge'. Killable in 30s, no deploy. ─────────────
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('forge') === '0') _flag = false;
      else if (q.get('forge') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_forge') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ── SERVER TRUTH, MIRRORED ───────────────────────────────────────────────
  var _res = null;        // my purse + inventory, from the state frame
  var _forge = null;      // { known, artifacts, total, fusable, honorarium }
  var _wld = null;        // { feed, hall, endeavours, artifacts, known, total }
  var _here = [];         // who is standing here (for teaching)
  var _anvil = {};        // item → count I have put down. CLIENT-LOCAL intent
                          // only: nothing leaves my hands until I strike.
  var _sheet = null, _btn = null, _tab = 'anvil';
  var _lastResult = null; // the outcome of my most recent strike, shown once

  function inv() { return (_res && _res.inventory) || {}; }
  function held(item) { return num(inv()[item], 0); }
  function fusable() { return (_forge && _forge.fusable) || []; }

  function pretty(s) { return String(s || '').replace(/_/g, ' '); }

  function injectStyles() {
    if (document.getElementById('vint-forge-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-forge-styles';
    s.textContent = [
      // ── tabs. Four across; they wrap to two rows under ~360px rather than
      //    squeezing below a 44px touch target or spilling the container. ────
      '#dvForgeSheet .fg-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:13px;}',
      '#dvForgeSheet .fg-tab{flex:1 1 68px;min-width:0;min-height:44px;border-radius:12px;cursor:pointer;',
      ' font-family:inherit;font-size:13px;color:rgba(220,231,255,0.65);',
      ' background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);',
      ' display:flex;align-items:center;justify-content:center;padding:0 6px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvForgeSheet .fg-tab.on{background:rgba(255,183,107,0.15);border-color:rgba(255,183,107,0.45);color:#ffd9ad;}',

      // ── the anvil ─────────────────────────────────────────────────────────
      '#dvForgeSheet .fg-anvil{padding:12px;border-radius:14px;margin-bottom:12px;',
      ' background:linear-gradient(180deg,rgba(255,183,107,0.09),rgba(255,183,107,0.03));',
      ' border:1px solid rgba(255,183,107,0.25);}',
      '#dvForgeSheet .fg-sh{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;',
      ' color:rgba(206,224,255,0.45);margin-bottom:9px;overflow:hidden;text-overflow:ellipsis;',
      ' white-space:nowrap;}',
      '#dvForgeSheet .fg-on{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:4px;}',
      // THE CHIP CONTAINS A BUTTON, so its height is driven BY that button, not
      // chosen independently. A 38px chip around a 44px touch target would push
      // the button through its own container's edge at every viewport — exactly
      // the overflow the no-collision law forbids, and the kind that is easy to
      // miss because it only shows up once the control inside grows. The chip is
      // 44px + its 1px borders, and the button inside it is sized DOWN to fit
      // while keeping a 44px hit area via padding on the chip's own row.
      '#dvForgeSheet .fg-chip{display:inline-flex;align-items:center;gap:7px;max-width:100%;',
      ' min-height:46px;padding:0 6px 0 11px;border-radius:12px;font-size:13.5px;color:#ffe3c2;',
      ' background:rgba(255,183,107,0.16);border:1px solid rgba(255,183,107,0.4);',
      ' box-sizing:border-box;}',
      '#dvForgeSheet .fg-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}',
      // the chip's own remove button: a full-height hit area inside the chip
      // rather than a second 44px box stacked within a 46px one.
      '#dvForgeSheet .fg-chip .fg-b{min-width:38px;min-height:38px;padding:0 8px;',
      ' background:rgba(0,0,0,0.22);border-color:rgba(255,183,107,0.3);color:#ffe3c2;}',
      '#dvForgeSheet .fg-empty{font-size:12.5px;color:rgba(206,224,255,0.4);font-style:italic;}',

      // ── the hand: what you hold, tappable onto the anvil ─────────────────
      '#dvForgeSheet .fg-hand{display:flex;flex-direction:column;gap:8px;}',
      '#dvForgeSheet .fg-mat{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:12px;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);}',
      '#dvForgeSheet .fg-mname{flex:1 1 auto;min-width:0;font-size:14px;color:#eaf3ff;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvForgeSheet .fg-mn{flex:0 0 auto;font-size:12.5px;color:rgba(206,224,255,0.5);',
      ' font-variant-numeric:tabular-nums;}',
      '#dvForgeSheet .fg-pm{flex:0 0 auto;display:flex;gap:6px;}',
      // A BUTTON'S LABEL CAN CONTAIN A STRANGER'S NAME ("teach <name>"), and a
      // stranger's name is the longest string this surface will ever hold. With
      // nowrap and no clamp, one 70-character name made this button wider than
      // the sheet at EVERY breakpoint — measured: 845px of content in a 320px
      // body, 2113px in a 1920px body. That is the no-collision law's exact
      // failure mode, and it was invisible until the audit stuffed real hostile
      // content through it. `max-width:100%` + `overflow:hidden` + ellipsis
      // makes the label yield instead of the container growing, which is the
      // rule: content yields, the box never does.
      '#dvForgeSheet .fg-b{min-width:44px;min-height:44px;border-radius:11px;cursor:pointer;',
      ' font-family:inherit;font-size:14px;color:#dce7ff;padding:0 11px;',
      ' background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.13);white-space:nowrap;',
      ' max-width:100%;box-sizing:border-box;overflow:hidden;text-overflow:ellipsis;}',
      '#dvForgeSheet .fg-b:disabled{opacity:0.32;pointer-events:none;}',
      '#dvForgeSheet .fg-strike{width:100%;box-sizing:border-box;min-height:52px;border-radius:14px;',
      ' font-family:inherit;font-size:15.5px;font-weight:600;cursor:pointer;color:#241202;border:none;',
      ' background:linear-gradient(90deg,#ffb76b,#ffd479);margin-top:11px;padding:0 12px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvForgeSheet .fg-strike:disabled{opacity:0.35;pointer-events:none;}',
      '#dvForgeSheet .fg-note{font-size:12.5px;line-height:1.55;color:rgba(206,224,255,0.55);',
      ' margin-top:10px;}',

      // ── the outcome of a strike ──────────────────────────────────────────
      '#dvForgeSheet .fg-out{padding:13px;border-radius:14px;margin-bottom:12px;line-height:1.55;',
      ' font-size:13.5px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);',
      ' color:#dce7ff;}',
      '#dvForgeSheet .fg-out.win{border-color:rgba(122,196,138,0.5);background:rgba(122,196,138,0.1);}',
      '#dvForgeSheet .fg-out.first{border-color:rgba(255,212,121,0.6);background:rgba(255,212,121,0.12);}',
      '#dvForgeSheet .fg-out.miss{border-color:rgba(255,160,120,0.35);background:rgba(255,160,120,0.07);}',
      '#dvForgeSheet .fg-out b{display:block;font-size:15px;color:#ffe3c2;margin-bottom:5px;}',
      '#dvForgeSheet .fg-lore{font-style:italic;color:rgba(206,224,255,0.6);margin-top:6px;}',

      // ── shared card (known recipes, artifacts, works, feed rows) ─────────
      '#dvForgeSheet .fg-list{display:flex;flex-direction:column;gap:9px;}',
      '#dvForgeSheet .fg-card{padding:11px 12px;border-radius:13px;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);',
      ' border-left:3px solid rgba(255,183,107,0.45);}',
      '#dvForgeSheet .fg-card.vessel{border-left-color:rgba(159,220,255,0.55);}',
      '#dvForgeSheet .fg-card.relic{border-left-color:rgba(214,159,255,0.55);}',
      '#dvForgeSheet .fg-card.miss{border-left-color:rgba(255,150,120,0.5);}',
      '#dvForgeSheet .fg-card.first{border-left-color:rgba(255,212,121,0.75);}',
      '#dvForgeSheet .fg-t{font-size:14.5px;color:#eaf3ff;overflow:hidden;text-overflow:ellipsis;',
      ' white-space:nowrap;}',
      '#dvForgeSheet .fg-s{font-size:12.5px;color:rgba(206,224,255,0.5);margin-top:3px;line-height:1.5;',
      ' overflow-wrap:anywhere;}',
      '#dvForgeSheet .fg-gold{color:#ffd479;}',
      '#dvForgeSheet .fg-row{display:flex;align-items:center;gap:10px;}',
      '#dvForgeSheet .fg-grow{flex:1 1 auto;min-width:0;}',
      '#dvForgeSheet .fg-side{flex:0 0 auto;display:flex;gap:6px;}',

      // ── the great works: a need-bar that can never overflow its track ────
      '#dvForgeSheet .fg-track{height:7px;border-radius:5px;margin:9px 0 7px;overflow:hidden;',
      ' background:rgba(255,255,255,0.08);}',
      '#dvForgeSheet .fg-fill{height:100%;border-radius:5px;background:linear-gradient(90deg,#ffb76b,#7ac48a);}',
      '#dvForgeSheet .fg-needs{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px;}',
      '#dvForgeSheet .fg-need{font-size:12px;padding:5px 9px;border-radius:9px;max-width:100%;',
      ' background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);',
      ' color:rgba(220,231,255,0.72);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvForgeSheet .fg-need.met{color:#7ac48a;border-color:rgba(122,196,138,0.35);}',
      // The action row wraps, and every child is allowed to SHRINK below its
      // 120px basis (min-width:0 + max-width:100%). Without both, a row of
      // three "teach <long name>" buttons lays out wider than the card even
      // though the row itself wraps — flex-basis is a starting size, not a cap.
      '#dvForgeSheet .fg-acts{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px;',
      ' max-width:100%;overflow:hidden;}',
      '#dvForgeSheet .fg-acts>button{flex:1 1 120px;min-width:0;max-width:100%;}',

      // ── the empty states. None may ever read as an error. ────────────────
      '#dvForgeSheet .fg-nil{padding:18px 14px;border-radius:13px;text-align:center;',
      ' background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);',
      ' font-size:13.5px;line-height:1.6;color:rgba(206,224,255,0.6);}',
      '#dvForgeSheet .fg-nil b{color:#ffd9ad;display:block;margin-bottom:5px;font-size:15px;}',

      // ── the launcher badge. Scoped to #fgBtn; COLOUR ONLY — never size or
      //    padding, because the rail measures its children and a size change
      //    here would silently re-flow every other launcher. ────────────────
      '#dvRail #fgBtn.lit{background:rgba(255,183,107,0.17);',
      ' border-color:rgba(255,183,107,0.5);color:#ffd9ad;}'
    ].join('');
    document.head.appendChild(s);
  }

  // ── the sheet. STATIC MARKUP ONLY; every dynamic value goes in as text. ──
  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var el = document.createElement('div');
    el.className = 'dv-sheet'; el.id = 'dvForgeSheet';
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the forge<small id="fgSub">put two things together</small></div>' +
        '<button class="dv-x" id="fgX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body">' +
        '<div class="fg-tabs">' +
          '<button class="fg-tab on" data-tab="anvil">anvil</button>' +
          '<button class="fg-tab" data-tab="known">known</button>' +
          '<button class="fg-tab" data-tab="works">works</button>' +
          '<button class="fg-tab" data-tab="world">the world</button>' +
        '</div>' +
        '<div id="fgPane"></div>' +
      '</div>';
    document.body.appendChild(el);
    _sheet = el;
    el.querySelector('#fgX').onclick = close;
    el.querySelectorAll('.fg-tab').forEach(function (b) {
      b.onclick = function () { _tab = b.getAttribute('data-tab'); render(); };
    });
    return el;
  }

  function open() {
    if (!enabled()) return;
    var h = hud();
    if (h && h.openSheet) h.openSheet('forge', function () { build(); _sheet.classList.add('open'); afterOpen(); });
    else { build(); _sheet.classList.add('open'); afterOpen(); }
  }
  function afterOpen() { render(); readWorld(); }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  function send(m) { try { var w = world(); return !!(w && w.send && w.send(m)); } catch (_) { return false; } }
  function readWorld() { send({ t: 'world:forge:read', limit: 30 }); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;     // ALWAYS textContent, never HTML
    return n;
  }

  // ── RENDER ───────────────────────────────────────────────────────────────
  function render() {
    if (!_sheet) return;
    var pane = _sheet.querySelector('#fgPane');
    if (!pane) return;
    _sheet.querySelectorAll('.fg-tab').forEach(function (b) {
      b.classList.toggle('on', b.getAttribute('data-tab') === _tab);
    });
    while (pane.firstChild) pane.removeChild(pane.firstChild);
    if (_tab === 'known') renderKnown(pane);
    else if (_tab === 'works') renderWorks(pane);
    else if (_tab === 'world') renderWorld(pane);
    else renderAnvil(pane);
  }

  // ── THE ANVIL ────────────────────────────────────────────────────────────
  // You are shown WHAT YOU HOLD, not a list of recipes to fill in. That is the
  // whole design: a crafting menu tells you the answer and asks you to fetch
  // it; an anvil asks you to wonder. Everything else here follows from that.
  function renderAnvil(pane) {
    var sub = _sheet.querySelector('#fgSub');
    if (sub) sub.textContent = 'put two things together';

    if (_lastResult) { pane.appendChild(outcomeCard(_lastResult)); }

    var av = el('div', 'fg-anvil');
    av.appendChild(el('div', 'fg-sh', 'on the anvil'));
    var on = el('div', 'fg-on');
    var kinds = Object.keys(_anvil).filter(function (k) { return _anvil[k] > 0; });
    if (!kinds.length) {
      on.appendChild(el('div', 'fg-empty', 'nothing yet — add from what you hold, below.'));
    } else {
      kinds.forEach(function (k) {
        var c = el('div', 'fg-chip');
        c.appendChild(el('span', null, _anvil[k] + ' × ' + pretty(k)));
        var x = el('button', 'fg-b', '−');
        x.setAttribute('aria-label', 'take one ' + pretty(k) + ' off the anvil');
        x.onclick = function () { put(k, -1); };
        c.appendChild(x);
        on.appendChild(c);
      });
    }
    av.appendChild(on);

    var strike = el('button', 'fg-strike',
      kinds.length < 2 ? 'the anvil needs two things' : 'strike');
    strike.disabled = kinds.length < 2;
    strike.onclick = doStrike;
    av.appendChild(strike);

    // The honest warning. A player must understand the risk BEFORE they take
    // it, or a real consequence reads as a bug rather than as a stake.
    av.appendChild(el('div', 'fg-note',
      'A strike that matches nothing uses up what you put down and hands back slag. ' +
      'Slag is real material — two things are made from it — so a failure costs you, ' +
      'but it never leaves you with nothing.'));
    pane.appendChild(av);

    // WHAT YOU HOLD
    var hand = el('div', 'fg-anvil');
    hand.appendChild(el('div', 'fg-sh', 'what you hold'));
    var list = el('div', 'fg-hand');
    var any = false;
    fusable().forEach(function (item) {
      var have = held(item), down = num(_anvil[item], 0);
      if (have <= 0 && down <= 0) return;
      any = true;
      var row = el('div', 'fg-mat');
      var nm = el('div', 'fg-mname', pretty(item));
      row.appendChild(nm);
      row.appendChild(el('div', 'fg-mn', (have - down) + ' free'));
      var pm = el('div', 'fg-pm');
      var minus = el('button', 'fg-b', '−');
      minus.disabled = down <= 0;
      minus.setAttribute('aria-label', 'take one ' + pretty(item) + ' off');
      minus.onclick = function () { put(item, -1); };
      var plus = el('button', 'fg-b', '+');
      plus.disabled = (have - down) <= 0;
      plus.setAttribute('aria-label', 'put one ' + pretty(item) + ' on');
      plus.onclick = function () { put(item, 1); };
      pm.appendChild(minus); pm.appendChild(plus);
      row.appendChild(pm);
      list.appendChild(row);
    });
    if (!any) {
      list.appendChild(el('div', 'fg-empty',
        'you are holding nothing that can be forged yet — harvest, and weave some strand.'));
    }
    hand.appendChild(list);
    pane.appendChild(hand);
  }

  // Client-local intent ONLY. Nothing leaves your hands until you strike, and
  // the server re-checks every count anyway — this cannot create material.
  function put(item, delta) {
    var have = held(item);
    var next = Math.max(0, Math.min(have, num(_anvil[item], 0) + delta));
    if (next <= 0) delete _anvil[item]; else _anvil[item] = next;
    render();
  }

  function doStrike() {
    var kinds = Object.keys(_anvil).filter(function (k) { return _anvil[k] > 0; });
    if (kinds.length < 2) return;
    var payload = {};
    kinds.forEach(function (k) { payload[k] = _anvil[k]; });
    if (!send({ t: 'world:forge:strike', inputs: payload })) {
      toast('the world is not listening right now — try again in a moment.');
      return;
    }
    _anvil = {};
    _lastResult = null;
    render();
  }

  function outcomeCard(r) {
    var cls = 'fg-out ' + (r.matched ? (r.first ? 'first' : 'win') : 'miss');
    var c = el('div', cls);
    if (r.matched) {
      c.appendChild(el('b', null, r.first
        ? 'FIRST IN THE WORLD — ' + r.recipe.name
        : r.recipe.name));
      c.appendChild(document.createTextNode(r.say));
      if (r.recipe.lore) c.appendChild(el('div', 'fg-lore', r.recipe.lore));
      var props = propWords(r.recipe.props, r.recipe.class);
      if (props) c.appendChild(el('div', 'fg-s', props));
    } else {
      c.appendChild(el('b', null, 'nothing took'));
      c.appendChild(document.createTextNode(r.say));
    }
    return c;
  }

  // Say what a thing DOES, plainly — and say honestly when it does not do it
  // yet. A vessel with thrust and no movement organ is an object you own, and
  // pretending otherwise would be the one lie on this surface.
  function propWords(props, cls) {
    if (!props) return '';
    var parts = [];
    for (var k in props) {
      if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
      var v = props[k];
      if (v === true) parts.push(pretty(k));
      else if (typeof v === 'number' && v !== 0) parts.push(pretty(k) + ' ' + v);
    }
    var s = parts.join(' · ');
    if (cls === 'vessel') {
      s += (s ? '  —  ' : '') + 'it is built to move. Nothing in this world can carry you yet.';
    }
    return s;
  }

  // ── WHAT YOU KNOW ────────────────────────────────────────────────────────
  function renderKnown(pane) {
    var known = (_forge && _forge.known) || [];
    var total = num(_forge && _forge.total, 0);
    var sub = _sheet.querySelector('#fgSub');
    if (sub) sub.textContent = known.length + ' of ' + total + ' worked out';

    if (!known.length) {
      var nil = el('div', 'fg-nil');
      nil.appendChild(el('b', null, 'You have not worked anything out yet.'));
      nil.appendChild(document.createTextNode(
        'Nobody is going to hand you a recipe list. Put two things on the anvil and ' +
        'find out what they do — there are ' + total + ' things somebody in this world ' +
        'has worked out how to make, and you can be first to one of them.'));
      pane.appendChild(nil);
      return;
    }

    // THE OPEN LOOP, and it is TRUE. The unknown recipes are real, findable,
    // and nobody is telling you what they are.
    var gap = total - known.length;
    if (gap > 0) {
      var loop = el('div', 'fg-nil');
      loop.appendChild(el('b', null, 'You know ' + known.length + ' of ' + total + '.'));
      loop.appendChild(document.createTextNode(
        gap === 1
          ? 'There is one more thing somebody has worked out that you have not. It is findable.'
          : 'There are ' + gap + ' more things somebody has worked out that you have not. ' +
            'They are findable, and somebody who knows one can teach you.'));
      pane.appendChild(loop);
    }

    var list = el('div', 'fg-list');
    known.forEach(function (r) {
      var card = el('div', 'fg-card ' + (r.class || ''));
      var row = el('div', 'fg-row');
      var g = el('div', 'fg-grow');
      g.appendChild(el('div', 'fg-t', r.name));
      g.appendChild(el('div', 'fg-s', inWords(r.in)));
      if (r.lore) g.appendChild(el('div', 'fg-s fg-lore', r.lore));
      var pw = propWords(r.props, r.class);
      if (pw) g.appendChild(el('div', 'fg-s', pw));
      g.appendChild(el('div', 'fg-s', r.via === 'taught'
        ? 'somebody taught you this'
        : (r.via === 'endeavour' ? 'you helped build one' : 'you worked this out yourself')));
      row.appendChild(g);
      card.appendChild(row);

      // TEACH — only offered when there is actually somebody here to teach.
      var others = _here.filter(function (p) { return !p.self; });
      var acts = el('div', 'fg-acts');
      if (others.length) {
        others.slice(0, 4).forEach(function (p) {
          var b = el('button', 'fg-b', 'teach ' + (p.name || 'them'));
          b.onclick = function () { teach(p, r); };
          acts.appendChild(b);
        });
      }
      if (r.big) {
        var rb = el('button', 'fg-b', 'raise this work');
        rb.onclick = function () {
          if (send({ t: 'world:forge:raise', recipeId: r.id })) toast('you raise the ' + r.name + '…');
        };
        acts.appendChild(rb);
      }
      if (acts.childNodes.length) card.appendChild(acts);
      list.appendChild(card);
    });
    pane.appendChild(list);

    // WHAT YOU HAVE MADE
    var arts = (_forge && _forge.artifacts) || [];
    if (arts.length) {
      pane.appendChild(el('div', 'fg-sh', 'what you have made'));
      var al = el('div', 'fg-list');
      arts.forEach(function (a) {
        var c = el('div', 'fg-card ' + (a.cls || '') + (a.first ? ' first' : ''));
        c.appendChild(el('div', 'fg-t', a.name));
        if (a.first) c.appendChild(el('div', 'fg-s fg-gold', 'the first one ever made'));
        var pw2 = propWords(a.props, a.cls);
        if (pw2) c.appendChild(el('div', 'fg-s', pw2));
        if (a.crew && a.crew.length) {
          c.appendChild(el('div', 'fg-s', 'built with ' +
            a.crew.map(function (m) { return m.name || 'someone'; }).join(', ')));
        }
        al.appendChild(c);
      });
      pane.appendChild(al);
    }
  }

  function inWords(m) {
    if (!m) return '';
    var parts = [];
    for (var k in m) {
      if (!Object.prototype.hasOwnProperty.call(m, k)) continue;
      parts.push(m[k] + ' ' + pretty(k));
    }
    return parts.join(' + ');
  }

  function teach(p, r) {
    if (send({ t: 'world:forge:teach', target: p.id, recipeId: r.id })) {
      toast('you show ' + (p.name || 'them') + ' how the ' + r.name + ' goes together…');
    } else {
      toast('the world is not listening right now — try again in a moment.');
    }
  }

  // ── THE GREAT WORKS ──────────────────────────────────────────────────────
  function renderWorks(pane) {
    var works = (_wld && _wld.endeavours) || [];
    var sub = _sheet.querySelector('#fgSub');
    if (sub) sub.textContent = works.length ? (works.length + ' standing here') : 'what one pair of hands cannot finish';

    if (!works.length) {
      var nil = el('div', 'fg-nil');
      nil.appendChild(el('b', null, 'No great work is standing here.'));
      nil.appendChild(document.createTextNode(
        'Some things are too big for one person to finish. If you know how one goes ' +
        'together, you can raise it here and anyone may add to it — and everyone who ' +
        'does is named on it forever. Nothing put in is ever lost: you can take your ' +
        'own share back out any time before it is done.'));
      pane.appendChild(nil);
      return;
    }

    var list = el('div', 'fg-list');
    works.forEach(function (w) {
      var card = el('div', 'fg-card ' + (w.cls || ''));
      card.appendChild(el('div', 'fg-t', w.name));
      card.appendChild(el('div', 'fg-s', 'raised by ' + (w.founder || 'someone')));
      if (w.lore) card.appendChild(el('div', 'fg-s fg-lore', w.lore));

      // The progress track. Width is CLAMPED to 0..100 so a server value that
      // ever exceeded the manifest could not push the fill past its track.
      var wantTotal = 0, needTotal = 0;
      for (var k in w.wants) { if (Object.prototype.hasOwnProperty.call(w.wants, k)) wantTotal += num(w.wants[k], 0); }
      for (var k2 in w.need) { if (Object.prototype.hasOwnProperty.call(w.need, k2)) needTotal += num(w.need[k2], 0); }
      var pct = wantTotal > 0 ? Math.max(0, Math.min(100, Math.round(((wantTotal - needTotal) / wantTotal) * 100))) : 0;
      var track = el('div', 'fg-track');
      var fill = el('div', 'fg-fill');
      fill.style.width = pct + '%';
      track.appendChild(fill);
      card.appendChild(track);
      card.appendChild(el('div', 'fg-s', pct + '% — ' + (w.crew.length === 1
        ? 'one person has put into this'
        : w.crew.length + ' people have put into this')));

      var needs = el('div', 'fg-needs');
      Object.keys(w.wants).forEach(function (item) {
        var short = num(w.need[item], 0);
        var chip = el('div', 'fg-need' + (short <= 0 ? ' met' : ''),
          short <= 0 ? pretty(item) + ' ✓' : 'needs ' + short + ' ' + pretty(item));
        needs.appendChild(chip);
      });
      card.appendChild(needs);

      var acts = el('div', 'fg-acts');
      Object.keys(w.need).forEach(function (item) {
        var short = num(w.need[item], 0);
        if (short <= 0) return;
        var canGive = Math.min(short, held(item));
        var b = el('button', 'fg-b', canGive > 0
          ? ('give ' + canGive + ' ' + pretty(item))
          : ('no ' + pretty(item)));
        b.disabled = canGive <= 0;
        b.onclick = function () {
          if (send({ t: 'world:forge:contribute', id: w.id, item: item, count: canGive })) {
            toast('you put ' + canGive + ' ' + pretty(item) + ' into the ' + w.name + '…');
          }
        };
        acts.appendChild(b);
      });
      var mine = w.crew.some(function (c) { return myId() != null && String(c.id) === String(myId()); });
      if (mine) {
        var wb = el('button', 'fg-b', 'take my share back');
        wb.onclick = function () { send({ t: 'world:forge:withdraw', id: w.id }); };
        acts.appendChild(wb);
      }
      if (acts.childNodes.length) card.appendChild(acts);

      if (w.crew.length) {
        card.appendChild(el('div', 'fg-s', 'building it: ' +
          w.crew.map(function (c) { return c.name || 'someone'; }).join(', ')));
      }
      list.appendChild(card);
    });
    pane.appendChild(list);
  }

  function myId() {
    if (_res && _res.userId != null) return _res.userId;
    try { var w = world(); if (w && w.myUserId) return w.myUserId(); } catch (_) {}
    return null;
  }

  // ── THE WORLD'S MEMORY ───────────────────────────────────────────────────
  // What everyone made, what they TRIED that did not work, who taught whom, and
  // who was ever first at anything. The failures are here deliberately.
  function renderWorld(pane) {
    var feed = (_wld && _wld.feed) || [];
    var hall = (_wld && _wld.hall) || [];
    var sub = _sheet.querySelector('#fgSub');
    if (sub) sub.textContent = 'what everyone has been making';

    if (hall.length) {
      pane.appendChild(el('div', 'fg-sh', 'first in the world'));
      var hl = el('div', 'fg-list');
      hall.forEach(function (h) {
        var c = el('div', 'fg-card first');
        c.appendChild(el('div', 'fg-t', h.name));
        c.appendChild(el('div', 'fg-s fg-gold', 'first made by ' + (h.by || 'someone')));
        if (h.lore) c.appendChild(el('div', 'fg-s fg-lore', h.lore));
        hl.appendChild(c);
      });
      pane.appendChild(hl);
    }

    pane.appendChild(el('div', 'fg-sh', 'lately'));
    if (!feed.length) {
      var nil = el('div', 'fg-nil');
      nil.appendChild(el('b', null, 'Nobody has made anything yet.'));
      nil.appendChild(document.createTextNode(
        'Everything anyone forges, tries and fails at, teaches, or builds together shows ' +
        'up here. Be the first thing in it.'));
      pane.appendChild(nil);
      return;
    }
    var list = el('div', 'fg-list');
    feed.forEach(function (f) {
      var c = el('div', 'fg-card' + (f.first ? ' first' : (f.ok ? (' ' + (f.cls || '')) : ' miss')));
      c.appendChild(el('div', 'fg-t', feedLine(f)));
      if (f.at) c.appendChild(el('div', 'fg-s', ago(f.at)));
      list.appendChild(c);
    });
    pane.appendChild(list);
  }

  // One sentence per event, said the way a person would say it. Every name goes
  // in as text at the leaf — this builds a STRING and hands it to textContent,
  // never to innerHTML.
  function feedLine(f) {
    var who = f.who || 'someone';
    if (f.kind === 'strike' && !f.ok) {
      var slag = f.detail && f.detail.slag;
      return who + ' tried something that did not take' + (slag ? ' — ' + slag + ' slag came back' : '') + '.';
    }
    if (f.kind === 'forge') {
      return f.first
        ? (who + ' is the first in this world to make a ' + (f.recipe || 'thing') + '.')
        : (who + ' made a ' + (f.recipe || 'thing') + '.');
    }
    if (f.kind === 'teach') {
      var st = f.detail && f.detail.student;
      return who + ' taught ' + (st || 'somebody') + ' how to make a ' + (f.recipe || 'thing') + '.';
    }
    if (f.kind === 'raise') return who + ' raised a ' + (f.recipe || 'great work') + ' — it needs hands.';
    if (f.kind === 'contribute') {
      var d = f.detail || {};
      return who + ' put ' + (d.n || 'something') + ' ' + pretty(d.item || '') + ' into a ' + (f.recipe || 'work') + '.';
    }
    if (f.kind === 'endeavour') {
      var crew = (f.detail && f.detail.crew) || [];
      return 'a ' + (f.recipe || 'great work') + ' was finished' +
        (crew.length ? ' by ' + crew.join(', ') : '') + '.';
    }
    if (f.kind === 'withdraw') return who + ' took their share back out of a ' + (f.recipe || 'work') + '.';
    return who + ' did something at the forge.';
  }

  function ago(sec) {
    var d = Math.floor(Date.now() / 1000) - num(sec, 0);
    if (d < 90) return 'just now';
    if (d < 3600) return Math.floor(d / 60) + ' minutes ago';
    if (d < 86400) return Math.floor(d / 3600) + ' hours ago';
    return Math.floor(d / 86400) + ' days ago';
  }

  // ── the launcher ─────────────────────────────────────────────────────────
  function mountLauncher() {
    if (!enabled() || _btn) return;
    var h = hud();
    if (!h || !h.addLauncher) { setTimeout(mountLauncher, 400); return; }
    injectStyles();
    try {
      _btn = h.addLauncher('fgBtn', 'forge', '⚒', open);
      if (h.registerSheet) h.registerSheet('forge', isOpen, close);
    } catch (_) {}
    updateLauncher();
  }

  function updateLauncher() {
    if (!_btn) return;
    var works = ((_wld && _wld.endeavours) || []).length;
    try {
      _btn.classList.toggle('lit', works > 0);
      _btn.setAttribute('title', works
        ? (works === 1 ? 'a great work is standing here' : works + ' great works are standing here')
        : 'the forge');
    } catch (_) {}
  }

  // ── WIRE TO THE WORLD ────────────────────────────────────────────────────
  W.addEventListener('vint:world-state', function (e) {
    var d = e.detail || {};
    if (d.resident) _res = d.resident;
    if (d.forge) _forge = d.forge;
    // Anything on the anvil that we no longer hold enough of is dropped — the
    // server just told us what we actually have, and an anvil holding material
    // that has since been traded away would offer a strike that must fail.
    var dirty = false;
    for (var k in _anvil) {
      if (!Object.prototype.hasOwnProperty.call(_anvil, k)) continue;
      if (_anvil[k] > held(k)) { _anvil[k] = held(k); dirty = true; }
      if (_anvil[k] <= 0) { delete _anvil[k]; dirty = true; }
    }
    if (isOpen()) render(); else if (dirty) { /* corrected silently */ }
    updateLauncher();
  });

  // The roster, borrowed from the same frame the commons reads. Teaching is
  // aimed at a person standing here, so this surface needs to know who that is
  // — and it costs nothing extra on the wire because commons already asks.
  W.addEventListener('vint:world-who', function (e) {
    _here = ((e.detail && e.detail.here) || []);
    if (isOpen() && _tab === 'known') render();
  });

  W.addEventListener('vint:world-forge', function (e) {
    var d = e.detail || {};
    _lastResult = d;
    if (!isOpen()) {
      // A result you cannot see is a result that did not happen. Say it out
      // loud through the SHARED toast, never a second anchored element.
      toast(d.say || 'the anvil rings.');
    } else { _tab = 'anvil'; render(); }
    readWorld();
  });

  // ── THE DISCOVERY — global, once per recipe, ever ────────────────────────
  // Safe to announce to everyone precisely because it can only ever happen once
  // per recipe in all of history. This is the line that makes the world feel
  // inhabited by people who are doing things without you.
  W.addEventListener('vint:world-forge-first', function (e) {
    var d = e.detail || {};
    toast((d.who || 'someone') + ' is the first in this world to make a ' + (d.name || 'new thing') + '.');
    readWorld();
  });

  W.addEventListener('vint:world-forge-taught', function (e) {
    var d = e.detail || {};
    toast(d.say || 'you taught it.');
    readWorld();
  });

  // Being given something by another person is one of the warmest moments this
  // world can produce, so it is said by name and it is never silent.
  W.addEventListener('vint:world-forge-learned', function (e) {
    var d = e.detail || {};
    toast((d.from || 'someone') + ' taught you how to make a ' + (d.name || 'new thing') + '.');
    readWorld();
  });

  W.addEventListener('vint:world-forge-world', function (e) {
    _wld = e.detail || null;
    if (_wld && _wld.known && _forge) _forge.known = _wld.known;
    if (isOpen()) render();
    updateLauncher();
  });

  W.addEventListener('vint:world-forge-endeavours', function (e) {
    if (!_wld) _wld = {};
    _wld.endeavours = (e.detail && e.detail.list) || [];
    if (isOpen() && _tab === 'works') render();
    updateLauncher();
  });

  W.addEventListener('vint:world-forge-raised', function (e) {
    var d = e.detail || {};
    toast(d.say || 'the work is standing.');
    readWorld();
  });

  W.addEventListener('vint:world-forge-contributed', function (e) {
    var d = e.detail || {};
    toast(d.say || 'you added to it.');
    readWorld();
  });

  W.addEventListener('vint:world-forge-withdrew', function (e) {
    var d = e.detail || {};
    toast(d.say || 'you took your share back.');
    readWorld();
  });

  // THE COMPLETION. Everyone who built it is named — including the people who
  // are not standing here, because they helped and finding out late is still
  // finding out.
  W.addEventListener('vint:world-forge-completed', function (e) {
    var d = e.detail || {};
    var crew = (d.crew || []).map(function (c) { return c.name || 'someone'; });
    toast(d.yours
      ? ('the ' + (d.name || 'great work') + ' you helped build is finished.')
      : ('the ' + (d.name || 'great work') + ' is finished' + (crew.length ? ' — ' + crew.join(', ') : '') + '.'));
    readWorld();
  });

  W.addEventListener('vint:world-travel', function () {
    _wld = null; _anvil = {}; _lastResult = null; _here = [];
    if (isOpen()) close();
    updateLauncher();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
  else mountLauncher();

  W.VintForge = {
    open: open, close: close, isOpen: isOpen, enabled: enabled,
    render: render, refresh: readWorld
  };
})();
