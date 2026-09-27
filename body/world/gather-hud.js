'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   THE GATHER HUD — where the near half of making finally has a face.
   (AETHERHOLD, world-forger, completed by seat-6 foreman 2026-09-27, task 66YN74N.)

   ── WHAT WAS MISSING ─────────────────────────────────────────────────────────
   THE GATHER shipped whole on the server (world/gather.js): five raw resources,
   real nodes at real positions, proximity-resolved harvest, depletion, lazy
   regrow, first-to-a-rare-seam announced to everyone. THE FORGE shipped its
   client too (forge-hud.js) — the anvil where two gathered things become a third.
   But the client that lets a human PULL matter out of the world never landed:
   world.html loaded `<script src="body/world/gather-hud.js">` and the file did
   not exist in any commit (a live 404), and world-client.js dispatched every
   forge frame but not one gather frame. So the world grew reedbeds and outcrops
   and lightwells nobody could touch, and the forge's "what you hold" could only
   ever hold the five things you START with. The near half was a ghost.

   This is that file. It is the deliberate twin of forge-hud.js: same rail, same
   one-open sheet, same textContent-only discipline, same kill switch shape. The
   forge asks you to WONDER what two things become; the gather asks you to WALK to
   a thing that is really there and pull it loose. Together they are the whole
   creation loop Lord Vinta named — gather → forge → a thing that never existed.

   ── HOW IT TALKS TO THE WORLD ────────────────────────────────────────────────
   Reads with `world:gather:read` → `world:gather:nodes {nodes, resources}`.
   Pulls with `world:gather:harvest {nodeId}` — the client names ONLY the node id;
   the server resolves proximity from the socket's own position (meta.x/z), so a
   too-far pull is refused server-side and comes back as `world:err`. The node's
   charge is authoritative: every `world:gather:ok` and every broadcast
   `world:gather:node` (someone else working this clearing) updates it live, so a
   worked clearing reads as inhabited. Inventory rides the `world:state` frame the
   same way the forge reads it (resident.inventory) — a gathered thing appears on
   the anvil's "what you hold" with no glue, because it is one store.

   ── THE COUNCIL LAWS IT ANSWERS ──────────────────────────────────────────────
   NO-COLLISION: not one position:fixed rule in this file. The launcher (gaBtn ⛏)
   is a MEASURED flow child of #dvRail via addLauncher(); the sheet reuses
   .dv-sheet/.dv-body (height-capped, internally scrolling) and joins the
   one-open-at-a-time registry, so raising it evicts whatever is up. Every pane is
   a bounded box that scrolls INSIDE .dv-body — nothing overlaps, nothing bleeds.
   MOBILE-FIRST: clamp() type, ≥44px touch targets, wraps at every width.
   RETENTION: the first-to-a-resource moment is a world event you see by name; a
   clearing depleting under other hands is the felt presence of other people.
   KILL SWITCH: ?gather=0 (or localStorage vint:flag:world_gather=0), read live.
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  var W = window;
  if (W.VintGather) return;

  function world() { return W.VintinuumWorld; }
  function hud() { return W.DirverseHUD; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }

  // ── KILL SWITCH (Atlas' flag) — live, never latched ────────────────────────
  function enabled() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('gather') === '0') return false;
      if (q.get('gather') === '1') return true;
      if (localStorage.getItem('vint:flag:world_gather') === '0') return false;
    } catch (_) {}
    return true;
  }

  // Server truth (world/gather.js): a pull needs you within this of the node, and
  // no faster than the cooldown. Kept as named constants so the gate the UI shows
  // matches the gate the server enforces — the button is honest, not decorative.
  var GATHER_RADIUS = 2.8;   // world units (matches gather.js GATHER_RADIUS)
  var REACH_EPS = 0.5;       // slack for socket-position lag vs. local _me

  var _sheet = null, _btn = null;
  var _nodes = {};           // id → node view {id,kind,resource,x,z,charges,max,label,lore,rare,regrowInMs}
  var _order = [];           // stable node id order as the server first sent them
  var _res = null;           // my purse + inventory, from the state frame
  var _resources = [];       // the raw resource names the world grows
  var _lastFirst = null;     // most recent first-to-a-resource banner, shown once at top
  var _pullLock = 0;         // client-side cooldown mirror so the button can't be spammed

  function inv() { return (_res && _res.inventory) || {}; }
  function me() { var w = world(); return (w && w._me) || { x: 0, z: 0 }; }

  function distTo(node) {
    var p = me();
    var dx = (Number(node.x) || 0) - (Number(p.x) || 0);
    var dz = (Number(node.z) || 0) - (Number(p.z) || 0);
    return Math.sqrt(dx * dx + dz * dz);
  }
  function withinReach(node) { return distTo(node) <= (GATHER_RADIUS + REACH_EPS); }

  function pretty(k) { return String(k || '').replace(/_/g, ' '); }

  // ── STYLE — its own .ga-* namespace, injected once. Palette matches the forge
  //    (amber warmth) so the making pair reads as one family on the rail. ──────
  function ensureStyle() {
    if (document.getElementById('dvGatherStyle')) return;
    var s = document.createElement('style');
    s.id = 'dvGatherStyle';
    s.textContent = [
      '#dvGatherSheet .ga-first{padding:11px 13px;border-radius:13px;margin-bottom:13px;line-height:1.5;',
        'border:1px solid rgba(255,212,121,0.6);background:rgba(255,212,121,0.12);color:#ffe3c2;font-size:13px;}',
      '#dvGatherSheet .ga-first b{color:#fff0d6;}',
      '#dvGatherSheet .ga-sh{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;',
        'color:rgba(255,183,107,0.85);margin:2px 0 9px;}',
      '#dvGatherSheet .ga-list{display:flex;flex-direction:column;gap:9px;margin-bottom:16px;}',
      '#dvGatherSheet .ga-node{padding:11px 12px;border-radius:14px;border:1px solid rgba(255,255,255,0.09);',
        'background:rgba(255,255,255,0.03);display:flex;flex-direction:column;gap:8px;}',
      '#dvGatherSheet .ga-node.near{border-color:rgba(122,196,138,0.45);background:rgba(122,196,138,0.07);}',
      '#dvGatherSheet .ga-node.rare{border-color:rgba(255,212,121,0.45);}',
      '#dvGatherSheet .ga-top{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;}',
      '#dvGatherSheet .ga-name{flex:1 1 auto;min-width:0;font-size:clamp(14px,3.6vw,15.5px);color:#eaf3ff;',
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvGatherSheet .ga-res{flex:0 0 auto;font-size:12px;color:rgba(255,183,107,0.9);',
        'letter-spacing:.03em;text-transform:uppercase;}',
      '#dvGatherSheet .ga-tag{flex:0 0 auto;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;',
        'padding:2px 7px;border-radius:999px;border:1px solid rgba(255,212,121,0.5);color:#ffd97a;}',
      '#dvGatherSheet .ga-lore{font-size:12px;font-style:italic;color:rgba(206,224,255,0.5);line-height:1.5;}',
      '#dvGatherSheet .ga-meta{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}',
      '#dvGatherSheet .ga-bar{flex:1 1 90px;min-width:80px;height:8px;border-radius:999px;',
        'background:rgba(255,255,255,0.08);overflow:hidden;}',
      '#dvGatherSheet .ga-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#7ac48a,#a6d98f);',
        'transition:width .35s ease;}',
      '#dvGatherSheet .ga-fill.low{background:linear-gradient(90deg,#c9a24a,#e0b85a);}',
      '#dvGatherSheet .ga-fill.out{background:rgba(255,160,120,0.5);}',
      '#dvGatherSheet .ga-charge{flex:0 0 auto;font-size:11.5px;color:rgba(206,224,255,0.55);min-width:52px;}',
      '#dvGatherSheet .ga-dist{flex:0 0 auto;font-size:11.5px;color:rgba(206,224,255,0.5);}',
      '#dvGatherSheet .ga-act{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}',
      '#dvGatherSheet .ga-pull{flex:0 0 auto;min-height:44px;padding:0 18px;border-radius:12px;cursor:pointer;',
        'border:1px solid rgba(122,196,138,0.5);background:rgba(122,196,138,0.16);color:#d6f5de;',
        'font-size:14px;font-weight:600;letter-spacing:.02em;}',
      '#dvGatherSheet .ga-pull:disabled{opacity:0.34;pointer-events:none;}',
      '#dvGatherSheet .ga-hint{flex:1 1 auto;min-width:0;font-size:12px;color:rgba(206,224,255,0.5);}',
      '#dvGatherSheet .ga-hold{padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,0.08);',
        'background:rgba(255,255,255,0.025);}',
      '#dvGatherSheet .ga-chips{display:flex;flex-wrap:wrap;gap:7px;}',
      '#dvGatherSheet .ga-chip{display:inline-flex;align-items:center;gap:7px;max-width:100%;padding:6px 11px;',
        'border-radius:999px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);',
        'font-size:13px;color:#eaf3ff;}',
      '#dvGatherSheet .ga-chip b{color:#ffd9ad;font-variant-numeric:tabular-nums;}',
      '#dvGatherSheet .ga-empty{font-size:12.5px;color:rgba(206,224,255,0.4);font-style:italic;}',
      '#dvGatherSheet .ga-foot{font-size:12px;line-height:1.55;color:rgba(206,224,255,0.5);margin-top:14px;',
        'padding-top:12px;border-top:1px solid rgba(255,255,255,0.07);}'
    ].join('');
    document.head.appendChild(s);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;   // ALWAYS textContent, never HTML
    return n;
  }

  // ── BUILD the sheet once. Reuses .dv-sheet/.dv-body verbatim (the one-open
  //    registry + height cap + internal scroll live there). ───────────────────
  function build() {
    if (_sheet) return _sheet;
    ensureStyle();
    var box = document.createElement('div');
    box.className = 'dv-sheet';
    box.id = 'dvGatherSheet';
    box.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the gather<small>walk to a thing, pull it loose</small></div>' +
        '<button class="dv-x" id="gaX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body">' +
        '<div id="gaPane"></div>' +
      '</div>';
    document.body.appendChild(box);
    _sheet = box;
    var x = box.querySelector('#gaX');
    if (x) x.onclick = close;
    return box;
  }

  function open() {
    if (!enabled()) return;
    var h = hud();
    if (h && h.openSheet) h.openSheet('gather', function () { build(); _sheet.classList.add('open'); afterOpen(); });
    else { build(); _sheet.classList.add('open'); afterOpen(); }
  }
  function afterOpen() { render(); readWorld(); }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  function send(m) { try { var w = world(); return !!(w && w.send && w.send(m)); } catch (_) { return false; } }
  function readWorld() { send({ t: 'world:gather:read' }); }

  // ── HARVEST — name only the node; the server resolves the rest ─────────────
  function pull(node) {
    if (!node) return;
    var now = Date.now();
    if (now < _pullLock) return;                 // client mirror of the 1.1s cooldown
    if (!withinReach(node)) { toast('walk closer to the ' + (node.label || 'node')); return; }
    if ((node.charges | 0) <= 0) { toast('the ' + (node.label || 'node') + ' is worked out — it will come back'); return; }
    _pullLock = now + 1100;
    send({ t: 'world:gather:harvest', nodeId: node.id });
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  function render() {
    if (!_sheet) return;
    var pane = _sheet.querySelector('#gaPane');
    if (!pane) return;
    while (pane.firstChild) pane.removeChild(pane.firstChild);

    if (_lastFirst) {
      var fb = el('div', 'ga-first');
      fb.appendChild(el('b', null, _lastFirst.who || 'someone'));
      fb.appendChild(document.createTextNode(' was first in this world to draw ' +
        pretty(_lastFirst.resource) + '.'));
      pane.appendChild(fb);
    }

    // THE GROUND — every node here, nearest first, so the walk reads on the page.
    pane.appendChild(el('div', 'ga-sh', 'the clearing'));
    var ids = _order.slice().sort(function (a, b) {
      var na = _nodes[a], nb = _nodes[b];
      if (!na || !nb) return 0;
      return distTo(na) - distTo(nb);
    });
    var list = el('div', 'ga-list');
    if (!ids.length) {
      list.appendChild(el('div', 'ga-empty', 'reading the ground…'));
    } else {
      ids.forEach(function (id) {
        var node = _nodes[id];
        if (node) list.appendChild(nodeRow(node));
      });
    }
    pane.appendChild(list);

    // WHAT YOU HOLD — only the raw resources, so the gather's own yield is legible
    // here; the full purse lives on the anvil. This is the bridge you can see.
    pane.appendChild(el('div', 'ga-sh', 'raw matter you hold'));
    var hold = el('div', 'ga-hold');
    var chips = el('div', 'ga-chips');
    var have = inv();
    var shown = 0;
    (_resources.length ? _resources : ['fiber', 'timber', 'stone', 'ore', 'glimmer']).forEach(function (r) {
      var n = have[r] | 0;
      if (n <= 0) return;
      shown++;
      var chip = el('div', 'ga-chip');
      chip.appendChild(el('b', null, String(n)));
      chip.appendChild(el('span', null, pretty(r)));
      chips.appendChild(chip);
    });
    if (!shown) chips.appendChild(el('div', 'ga-empty', 'nothing yet — pull something from the ground above.'));
    hold.appendChild(chips);
    pane.appendChild(hold);

    var foot = el('div', 'ga-foot',
      'Walk to a node (WASD / drag) until it lights, then pull. Nodes deplete as ' +
      'they are worked and heal on their own. Take two different things to the ' +
      'anvil (⚒ the Forge) and strike — that is where matter becomes a made thing.');
    pane.appendChild(foot);
  }

  function nodeRow(node) {
    var near = withinReach(node);
    var out = (node.charges | 0) <= 0;
    var row = el('div', 'ga-node' + (near ? ' near' : '') + (node.rare ? ' rare' : ''));

    var top = el('div', 'ga-top');
    top.appendChild(el('div', 'ga-name', node.label || pretty(node.kind)));
    top.appendChild(el('div', 'ga-res', pretty(node.resource)));
    if (node.rare) top.appendChild(el('div', 'ga-tag', 'rare'));
    row.appendChild(top);

    if (node.lore) row.appendChild(el('div', 'ga-lore', node.lore));

    var meta = el('div', 'ga-meta');
    var bar = el('div', 'ga-bar');
    var max = Math.max(1, node.max | 0);
    var frac = Math.max(0, Math.min(1, (node.charges | 0) / max));
    var fill = el('div', 'ga-fill' + (out ? ' out' : (frac <= 0.34 ? ' low' : '')));
    fill.style.width = Math.round(frac * 100) + '%';
    bar.appendChild(fill);
    meta.appendChild(bar);
    if (out) {
      var back = node.regrowInMs > 0 ? ('back in ~' + Math.ceil(node.regrowInMs / 1000) + 's') : 'worked out';
      meta.appendChild(el('div', 'ga-charge', back));
    } else {
      meta.appendChild(el('div', 'ga-charge', (node.charges | 0) + ' / ' + max));
    }
    meta.appendChild(el('div', 'ga-dist', near ? 'in reach' : (Math.round(distTo(node) * 10) / 10) + ' away'));
    row.appendChild(meta);

    var act = el('div', 'ga-act');
    var btn = el('button', 'ga-pull', out ? 'resting' : 'gather');
    btn.disabled = out || !near || Date.now() < _pullLock;
    btn.onclick = function () { pull(node); };
    act.appendChild(btn);
    if (out) act.appendChild(el('div', 'ga-hint', 'this one is spent — it will come back on its own'));
    else if (!near) act.appendChild(el('div', 'ga-hint', 'walk closer to pull it'));
    row.appendChild(act);
    return row;
  }

  function upsertNode(node) {
    if (!node || node.id == null) return;
    var id = String(node.id);
    if (!_nodes[id] && _order.indexOf(id) === -1) _order.push(id);
    _nodes[id] = node;
  }

  // ── THE WORLD SPEAKS (via world-client's generic + explicit dispatch) ───────
  W.addEventListener('vint:world-gather-nodes', function (e) {
    var d = e.detail || {};
    _nodes = {}; _order = [];
    (d.nodes || []).forEach(function (n) { upsertNode(n); });
    if (Array.isArray(d.resources)) _resources = d.resources;
    if (isOpen()) render();
  });

  W.addEventListener('vint:world-gather-ok', function (e) {
    var d = e.detail || {};
    if (d.node) upsertNode(d.node);
    if (d.say) toast(d.say);
    if (isOpen()) render();
  });

  // Someone else worked this clearing — the node depletes/heals for us too.
  W.addEventListener('vint:world-gather-node', function (e) {
    var d = e.detail || {};
    if (d.node) upsertNode(d.node);
    if (isOpen()) render();
  });

  // First hands in the whole world to draw a resource — global, once, forever.
  W.addEventListener('vint:world-gather-first', function (e) {
    var d = e.detail || {};
    _lastFirst = { who: d.who, resource: d.resource };
    toast((d.who || 'someone') + ' drew the first ' + pretty(d.resource) + ' in this world');
    if (isOpen()) render();
  });

  // Inventory rides every state frame (resident.inventory — the SAME store the
  // forge reads), so a fresh pull shows up in "raw matter you hold" with no glue.
  W.addEventListener('vint:world-state', function (e) {
    var d = e.detail || {};
    if (d.resident) _res = d.resident;
    else if (d.inventory) _res = { inventory: d.inventory };
    if (isOpen()) render();
  });

  // Gather-relevant refusals come back as world:err — surface them kindly.
  W.addEventListener('vint:world-err', function (e) {
    var d = e.detail || {};
    if (!isOpen()) return;
    if (d.code === 'too_far') toast(d.say || 'walk closer to gather that');
    else if (d.code === 'catching_breath') toast('catching your breath…');
    else if (d.code === 'worked_out') toast(d.say || 'that node is worked out — it will come back');
  });

  // Re-reading the clearing when we land somewhere new keeps distances honest.
  W.addEventListener('vint:world-travel', function () { if (isOpen()) { close(); } });

  // The player moves constantly (WASD), so while the sheet is open we re-render on
  // a gentle cadence to keep "in reach / X away" and the gather button truthful —
  // cheap, bounded, and only while visible. NOT a poll of the server; pure local.
  setInterval(function () { if (isOpen()) render(); }, 900);

  // ── MOUNT the rail launcher (a MEASURED slot; adds no fixed element) ────────
  function mountLauncher() {
    if (!enabled()) return;
    var h = hud();
    if (!h || !h.addLauncher) { setTimeout(mountLauncher, 400); return; }  // rail not up yet
    if (_btn) return;
    try {
      _btn = h.addLauncher('gaBtn', 'gather', '⛏', open);   // id gaBtn · label "gather" · ⛏ pick — pull raw matter from the ground
      if (h.registerSheet) h.registerSheet('gather', isOpen, close);
    } catch (_) { setTimeout(mountLauncher, 600); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
  else mountLauncher();

  W.VintGather = {
    open: open, close: close, isOpen: isOpen, enabled: enabled,
    _debug: function () { return { nodes: _nodes, resources: _resources, res: _res }; }
  };
})();
