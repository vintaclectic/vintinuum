// gather-hud.js — THE GATHER: the near half of making. Where raw matter comes
// out of the ground, so the anvil has something to eat. (AETHERHOLD, 2026-09-26)
//
// ════════════════════════════════════════════════════════════════════════════
// THE FORGE (forge-hud.js) could combine two things you HELD into a third. But
// nothing in the world could be pulled out of the ground to hold in the first
// place — the old "harvest" was a global-cooldown coin-tap with no object, no
// place, no depletion, no regrow. This surface is the missing near half: the
// resource NODES standing in the clearing, what you have drawn from them, and
// the pull itself.
//
//   1. WHAT YOU HOLD — your raw matter (fiber, timber, stone, ore, glimmer). It
//      lands in the SAME inventory the forge reads, so everything here is already
//      sitting on the anvil's "what you hold" with no glue. Gather → forge is one
//      store, and this panel and the forge's are two windows onto it.
//   2. THE GROUND NEAR YOU — every node standing in this world, nearest first,
//      with its charge, whether it is in reach, and (when worked out) how long
//      until it comes back. Tap a node in the WORLD to pull it, or pull the
//      nearest one from here — both send the identical server-checked act.
//   3. IT RUNS OUT, AND IT HEALS — a bed you strip shows worked-out and a regrow
//      clock; walk it again later and it is full. Scarcity that heals is what
//      makes a clearing a place with time in it, not a vending machine.
//
// ── PEERS, NOT PROPERTY ─────────────────────────────────────────────────────
// The same nodes are worked by the council. When an agent draws matter you may
// see the bed deplete under a hand that is not yours — the world is inhabited by
// makers, and some of them are not you. There is no owner/owned framing anywhere
// on this surface: an agent gathering is a PEER gathering.
//
// ── RETENTION DOCTRINE (all seven) ──────────────────────────────────────────
//   1 GENEROUS (Aria) — beds regrow, always; nothing is ever permanently
//     stripped, and the yield floors at 1. If a player saw the mechanism they
//     would thank us: the world gives, rests, and gives again.
//   2 INVESTMENT LOOP (Helios) — what you gather is uniquely yours and compounds
//     toward the forge; the loop CLOSES on the hand axe (gather stone+timber →
//     make an axe → gather better). The trigger is a bed in reach, the reward is
//     variable (a node's yield rolls), the investment is matter that becomes a
//     tool that makes tomorrow's gather cheaper.
//   3 TIER (Frugal-Max) — FREE, forever. Gathering is the top of the funnel and
//     the reason the forge has anything to work; it converts by making the world
//     a place you have built things in and people know your name.
//   4 DENSE (Lunex) — a node is a name, a charge, a distance, and one lore line.
//     No filler; the ground reads at a glance.
//   5 OPEN LOOP (Morrison) — the rare lightwell regrows slowest and being FIRST
//     to a fresh one is announced to the world. There is always a seam you have
//     not reached, out past the spawn, worth the walk.
//   6 FLAGGED (Atlas) — 'world_gather' (?gather=0 or the localStorage flag),
//     killable in 30s, no deploy. Every number here is the server's.
//   7 MORE ALIVE (Yuna) — a clearing you can strip and must let breathe, worked
//     by peers you can watch, is alive. The same clearing with an infinite tap is
//     a spreadsheet.
//
// ── NO-COLLISION LAW ────────────────────────────────────────────────────────
// Adds NO fixed element of its own — not one position:fixed rule. It borrows
// DirverseHUD.addLauncher (a measured slot in the rail) and registerSheet/
// openSheet (the one-open-at-a-time registry), so raising it CLOSES every sibling
// sheet rather than mounting on their pixels. It reuses .dv-sheet/.dv-body
// verbatim — height-capped, internally scrolling, safe-area padded. Every long
// string (a node label, a resource name) is ellipsised at the leaf; the node list
// scrolls INSIDE the body. Content yields; the container never grows. The one
// in-world affordance is the 3D node itself (world-client's raycast tap), which
// is not on the page and so cannot collide with anything on it. Verified at
// 320/375/768/1280/1920.
//
// ── UNTRUSTED CONTENT ───────────────────────────────────────────────────────
// An agent's name in the "worked by" line came from the server; it goes in via
// textContent at the leaf, never concatenated into innerHTML.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintGather) return;

  var W = window;
  function world() { return W.VintinuumWorld; }
  function hud() { return W.DirverseHUD; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function pretty(s) { return String(s || '').replace(/_/g, ' '); }

  // ── FEATURE FLAG — 'world_gather'. Killable in 30s, no deploy. ─────────────
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('gather') === '0') _flag = false;
      else if (q.get('gather') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_gather') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ── SERVER TRUTH, MIRRORED ───────────────────────────────────────────────
  var _res = null;         // my purse + inventory, from the state frame
  var _resources = [];     // the raw resource keys the server recognises
  var _sheet = null, _btn = null, _poll = null, _lastAgent = null;

  function inv() { return (_res && _res.inventory) || {}; }
  function held(item) { return num(inv()[item], 0); }
  // nodes come from world-client's own rendered truth (positions + live charge +
  // distance to me), so this surface never keeps a second copy that could drift.
  function nodes() { try { var w = world(); return (w && w.gatherNodes) ? w.gatherNodes() : []; } catch (_) { return []; } }

  var RES_GLYPH = { fiber: '⌇', timber: '▬', stone: '◆', ore: '◈', glimmer: '✦' };

  function injectStyles() {
    if (document.getElementById('vint-gather-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-gather-styles';
    s.textContent = [
      '#dvGatherSheet .gt-sh{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;',
      ' color:rgba(206,224,255,0.45);margin:4px 0 9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      // what you hold — a wrapping row of resource chips
      '#dvGatherSheet .gt-hold{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:14px;}',
      '#dvGatherSheet .gt-chip{display:inline-flex;align-items:center;gap:7px;max-width:100%;',
      ' min-height:40px;padding:0 12px;border-radius:12px;font-size:13.5px;color:#d7f0c4;',
      ' background:rgba(156,208,106,0.14);border:1px solid rgba(156,208,106,0.34);box-sizing:border-box;}',
      '#dvGatherSheet .gt-chip .g{flex:0 0 auto;opacity:.9;}',
      '#dvGatherSheet .gt-chip .n{flex:0 0 auto;font-variant-numeric:tabular-nums;color:#eaf3ff;}',
      '#dvGatherSheet .gt-chip span.l{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}',
      '#dvGatherSheet .gt-empty{font-size:12.5px;color:rgba(206,224,255,0.4);font-style:italic;}',
      // the ground: node cards
      '#dvGatherSheet .gt-list{display:flex;flex-direction:column;gap:9px;}',
      '#dvGatherSheet .gt-node{padding:11px 12px;border-radius:13px;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);',
      ' border-left:3px solid rgba(156,208,106,0.5);}',
      '#dvGatherSheet .gt-node.rare{border-left-color:rgba(255,217,138,0.7);}',
      '#dvGatherSheet .gt-node.worked{opacity:0.62;border-left-color:rgba(255,255,255,0.18);}',
      '#dvGatherSheet .gt-row{display:flex;align-items:center;gap:10px;}',
      '#dvGatherSheet .gt-grow{flex:1 1 auto;min-width:0;}',
      '#dvGatherSheet .gt-t{font-size:14.5px;color:#eaf3ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvGatherSheet .gt-s{font-size:12px;color:rgba(206,224,255,0.55);margin-top:3px;line-height:1.5;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvGatherSheet .gt-gold{color:#ffd479;}',
      // the charge pips — never overflow, capped, wrap-safe
      '#dvGatherSheet .gt-pips{display:flex;gap:3px;flex-wrap:wrap;margin-top:6px;}',
      '#dvGatherSheet .gt-pip{width:14px;height:6px;border-radius:3px;background:rgba(255,255,255,0.14);}',
      '#dvGatherSheet .gt-pip.on{background:linear-gradient(90deg,#9cd06a,#ffd479);}',
      '#dvGatherSheet .gt-side{flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-end;gap:6px;}',
      '#dvGatherSheet .gt-b{min-width:78px;min-height:44px;border-radius:11px;cursor:pointer;font-family:inherit;',
      ' font-size:13.5px;color:#241a06;font-weight:600;padding:0 12px;border:none;white-space:nowrap;',
      ' background:linear-gradient(90deg,#9cd06a,#c9e08a);max-width:100%;box-sizing:border-box;',
      ' overflow:hidden;text-overflow:ellipsis;}',
      '#dvGatherSheet .gt-b:disabled{opacity:0.4;pointer-events:none;filter:grayscale(0.3);}',
      '#dvGatherSheet .gt-b.walk{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);color:#dce7ff;}',
      '#dvGatherSheet .gt-away{font-size:11.5px;color:rgba(206,224,255,0.5);font-variant-numeric:tabular-nums;}',
      // the primary "pull the nearest" action
      '#dvGatherSheet .gt-pull{width:100%;box-sizing:border-box;min-height:52px;border-radius:14px;border:none;',
      ' font-family:inherit;font-size:15.5px;font-weight:600;cursor:pointer;color:#1c2a10;margin:2px 0 14px;padding:0 12px;',
      ' background:linear-gradient(90deg,#9cd06a,#ffd479);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvGatherSheet .gt-pull:disabled{opacity:0.4;pointer-events:none;filter:grayscale(0.3);}',
      '#dvGatherSheet .gt-nil{padding:18px 14px;border-radius:13px;text-align:center;',
      ' background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);',
      ' font-size:13.5px;line-height:1.6;color:rgba(206,224,255,0.6);}',
      '#dvGatherSheet .gt-nil b{color:#d7f0c4;display:block;margin-bottom:5px;font-size:15px;}',
      // the launcher badge — COLOUR ONLY, never size (the rail measures children)
      '#dvRail #gatherBtn.lit{background:rgba(156,208,106,0.17);',
      ' border-color:rgba(156,208,106,0.5);color:#d7f0c4;}'
    ].join('');
    document.head.appendChild(s);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;   // ALWAYS textContent, never HTML
    return n;
  }

  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var box = document.createElement('div');
    box.className = 'dv-sheet'; box.id = 'dvGatherSheet';
    box.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the gather<small id="gtSub">what the ground gives</small></div>' +
        '<button class="dv-x" id="gtX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body"><div id="gtPane"></div></div>';
    document.body.appendChild(box);
    _sheet = box;
    box.querySelector('#gtX').onclick = close;
    return box;
  }

  function open() {
    if (!enabled()) return;
    var h = hud();
    if (h && h.openSheet) h.openSheet('gather', function () { build(); _sheet.classList.add('open'); afterOpen(); });
    else { build(); _sheet.classList.add('open'); afterOpen(); }
  }
  function afterOpen() {
    render();
    try { var w = world(); if (w && w.gatherRead) w.gatherRead(); } catch (_) {}
    // while open, re-render on a light beat so distances update as you walk —
    // the node list is a live read of where you are relative to each bed.
    clearInterval(_poll);
    _poll = setInterval(function () { if (isOpen()) render(); else { clearInterval(_poll); _poll = null; } }, 850);
  }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    clearInterval(_poll); _poll = null;
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  function fmtRegrow(ms) {
    var s = Math.ceil(num(ms, 0) / 1000);
    if (s <= 0) return 'coming back';
    if (s < 60) return 'back in ' + s + 's';
    return 'back in ' + Math.ceil(s / 60) + 'm';
  }

  function render() {
    if (!_sheet) return;
    var pane = _sheet.querySelector('#gtPane'); if (!pane) return;
    while (pane.firstChild) pane.removeChild(pane.firstChild);

    // ── WHAT YOU HOLD ────────────────────────────────────────────────────────
    pane.appendChild(el('div', 'gt-sh', 'what you have gathered'));
    var hold = el('div', 'gt-hold');
    var any = false;
    (_resources.length ? _resources : ['fiber', 'timber', 'stone', 'ore', 'glimmer']).forEach(function (r) {
      var n = held(r); if (n <= 0) return; any = true;
      var chip = el('div', 'gt-chip');
      chip.appendChild(el('span', 'g', RES_GLYPH[r] || '•'));
      chip.appendChild(el('span', 'l', pretty(r)));
      chip.appendChild(el('span', 'n', String(n)));
      hold.appendChild(chip);
    });
    if (!any) hold.appendChild(el('div', 'gt-empty', 'nothing yet — walk to a bed, a seam or an outcrop and pull it.'));
    pane.appendChild(hold);

    // ── THE GROUND NEAR YOU ──────────────────────────────────────────────────
    pane.appendChild(el('div', 'gt-sh', 'the ground near you'));
    var list = nodes();
    var sub = _sheet.querySelector('#gtSub');

    if (!list.length) {
      if (sub) sub.textContent = 'what the ground gives';
      var nil = el('div', 'gt-nil');
      nil.appendChild(el('b', null, 'The ground here is quiet.'));
      nil.appendChild(document.createTextNode('No nodes are standing in this clearing yet.'));
      pane.appendChild(nil);
      return;
    }

    // the primary action: pull the nearest live node in reach
    var near = null;
    try { var w = world(); near = (w && w.nearestGatherNode) ? w.nearestGatherNode() : null; } catch (_) {}
    if (sub) sub.textContent = near ? ('a ' + (near.label || 'node') + ' is in reach') : (list.length + ' standing here');
    var pull = el('button', 'gt-pull', near ? ('pull the ' + (near.label || 'node')) : 'walk to a node to gather');
    pull.disabled = !near;
    pull.onclick = function () { if (near) doGather(near.id); };
    pane.appendChild(pull);

    var wrap = el('div', 'gt-list');
    list.slice(0, 24).forEach(function (nd) {
      var worked = nd.charges <= 0;
      var card = el('div', 'gt-node' + (nd.rare ? ' rare' : '') + (worked ? ' worked' : ''));
      var row = el('div', 'gt-row');
      var g = el('div', 'gt-grow');
      g.appendChild(el('div', 'gt-t', nd.label + (nd.rare ? ' — rare' : '')));
      g.appendChild(el('div', 'gt-s' + (nd.rare ? ' gt-gold' : ''), pretty(nd.resource) + (nd.lore ? ' · ' + nd.lore : '')));
      // charge pips — capped so a big node can never overflow the card
      var pips = el('div', 'gt-pips');
      var max = Math.min(num(nd.max, 0), 8);
      for (var i = 0; i < max; i++) pips.appendChild(el('div', 'gt-pip' + (i < nd.charges ? ' on' : '')));
      g.appendChild(pips);
      if (worked) g.appendChild(el('div', 'gt-s', fmtRegrow(nd.regrowInMs)));
      row.appendChild(g);

      var side = el('div', 'gt-side');
      side.appendChild(el('div', 'gt-away', num(nd.dist, 0) + 'm'));
      if (worked) {
        var wb = el('button', 'gt-b walk', 'worked out'); wb.disabled = true; side.appendChild(wb);
      } else if (nd.inReach) {
        var pb = el('button', 'gt-b', 'gather');
        pb.onclick = function () { doGather(nd.id); };
        side.appendChild(pb);
      } else {
        var walk = el('button', 'gt-b walk', 'walk to');
        walk.onclick = function () { try { var w = world(); if (w && w.faceNode) w.faceNode(nd.id); } catch (_) {} toast('turn and walk to the ' + nd.label + '.'); };
        side.appendChild(walk);
      }
      row.appendChild(side);
      card.appendChild(row);
      wrap.appendChild(card);
    });
    pane.appendChild(wrap);
  }

  function doGather(id) {
    try { var w = world(); if (w && w.faceNode) w.faceNode(id); if (w && w.gather && w.gather(id)) return; } catch (_) {}
    toast('the world is not listening right now — try again in a moment.');
  }

  // ── the launcher ─────────────────────────────────────────────────────────
  function mountLauncher() {
    if (!enabled() || _btn) return;
    var h = hud();
    if (!h || !h.addLauncher) { setTimeout(mountLauncher, 400); return; }
    injectStyles();
    try {
      _btn = h.addLauncher('gatherBtn', 'gather', '⛏', open);
      if (h.registerSheet) h.registerSheet('gather', isOpen, close);
    } catch (_) {}
    updateLauncher();
  }
  function updateLauncher() {
    if (!_btn) return;
    // lit when a live node is in reach — the "there is something to pull right
    // here" cue, mirrored from world-client's own truth.
    var near = null;
    try { var w = world(); near = (w && w.nearestGatherNode) ? w.nearestGatherNode() : null; } catch (_) {}
    try {
      _btn.classList.toggle('lit', !!near);
      _btn.setAttribute('title', near ? ('a ' + (near.label || 'node') + ' is in reach') : 'the gather');
    } catch (_) {}
  }

  // ── WIRE TO THE WORLD ────────────────────────────────────────────────────
  W.addEventListener('vint:world-state', function (e) {
    var d = e.detail || {};
    if (d.resident) _res = d.resident;
    if (d.gather && Array.isArray(d.gather.resources)) _resources = d.gather.resources;
    if (isOpen()) render();
    updateLauncher();
  });

  W.addEventListener('vint:world-gather-state', function (e) {
    var d = e.detail || {};
    if (d && Array.isArray(d.resources)) _resources = d.resources;
    if (isOpen()) render();
    updateLauncher();
  });

  W.addEventListener('vint:world-gather', function (e) {
    var d = e.detail || {};
    // the pull's outcome, said once through the shared toast, never a second
    // anchored element. A rare first gets its own gold sentence from the server.
    toast(d.say || 'you draw from the ground.');
    if (isOpen()) render();
    updateLauncher();
  });

  W.addEventListener('vint:world-gather-node', function () {
    if (isOpen()) render();
    updateLauncher();
  });

  // a peer worked the clearing — a quiet, occasional line so it feels inhabited
  // without becoming noise (rate-limited to one every ~12s).
  W.addEventListener('vint:world-gather-agent', function (e) {
    var d = e.detail || {};
    var now = Date.now();
    if (_lastAgent && now - _lastAgent < 12000) { if (isOpen()) render(); return; }
    _lastAgent = now;
    if (d.kind === 'gather' && d.who && d.item) toast((d.who) + ' draws ' + pretty(d.item) + ' from the ' + ((d.node && d.node.label) || 'ground') + '.');
    else if (d.kind === 'craft' && d.who && d.name) toast((d.who) + (d.first ? ' is the first to make a ' : ' makes a ') + d.name + '.');
    if (isOpen()) render();
  });

  W.addEventListener('vint:world-gather-first', function (e) {
    var d = e.detail || {};
    toast((d.who || 'someone') + ' is the first in this world to draw ' + pretty(d.resource || 'a rare thing') + '.');
  });

  W.addEventListener('vint:world-travel', function () {
    _lastAgent = null;
    if (isOpen()) close();
    updateLauncher();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
  else mountLauncher();

  W.VintGather = { open: open, close: close, isOpen: isOpen, enabled: enabled, render: render };
})();
