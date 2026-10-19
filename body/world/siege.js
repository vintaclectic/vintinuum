// ════════════════════════════════════════════════════════════════════════════
// THE SIEGE — raids and fighting over built structures (task KWD6VBA)
//
// The server organ (vintinuum-api/world/siege.js) decides everything: a piece
// can be struck only by someone who does NOT own it, only where BOTH the raider
// and the piece stand on violent soil (a covenant march), only within 4.5m of
// the raider's live position, at most once per 1.2s. A wreck deletes the piece
// and drops strand into the raider's CARRY — the pocket a death takes back —
// so loot has to be walked home and banked. The owner mends (1 strand → +50).
// A raider whose agents are awake on watch hits harder and can SEND THE COURT
// (1 ember → three server-run volleys that stop when the commander walks off).
//
// This file is the mirror and the hands:
//   · health bars float over every DAMAGED piece (an untouched piece is whole
//     by absence — no bar clutter over a pristine clearing)
//   · a struck piece flashes and shudders; a wrecked one bursts into shards
//   · one rail launcher (⚔) opens one registered .dv-sheet: the nearest foreign
//     piece in reach, its health, strike / send court / mend, the loot at risk
//
// ── NO-COLLISION: adds ZERO fixed elements. The launcher comes from
//    DirverseHUD.addLauncher (the rail measures and allocates it); the controls
//    live in one .dv-sheet registered as 'siege', declared to VintDock as an
//    obstacle in both bottom corners exactly like the foundry. Health bars are
//    3D sprites in the scene, never DOM.
// ── KILL SWITCH: ?siege=0 / localStorage vint:flag:world_siege='0' (client);
//    SIEGE=0 env on the brain (server, no restart).
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  var W = window;

  function enabled() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('siege') === '0') return false;
      if (q.get('siege') === '1') return true;
      if (localStorage.getItem('vint:flag:world_siege') === '0') return false;
    } catch (_) {}
    return true;
  }
  if (!enabled()) return;

  function world() { return W.VintinuumWorld; }
  function hud() { return W.DirverseHUD; }
  function T() { var w = world(); return (w && w._THREE) || W.THREE || null; }

  // mirrors of the server rules; replaced by world:state.siege.rules when it lands
  var RULES = { on: true, reach: 4.5, hit: 12, cooldownMs: 1200, mend: 50, mendReach: 6, courtVolleys: 3, courtCost: { ember: 1 } };
  var HP = {};          // structId → [hp, max]   (only damaged pieces)
  var _soil = null;     // last world:soil:ok
  var _carry = null;    // last known carry
  var _log = [];        // recent siege events, newest first
  var _sheet = null, _btn = null, _raf = 0, _lastHitAt = 0;
  var _bars = {};       // structId → sprite

  var ERR = {
    own_piece: 'that is yours — you cannot raid your own work.',
    hearth_immune: 'a hearth cannot be wrecked. it is somebody’s home.',
    you_are_on_safe_ground: 'you are on safe ground. raids happen only in the march.',
    piece_on_safe_ground: 'that piece stands on safe ground — out of the march, out of reach.',
    too_far: 'too far — close in (4.5m).',
    cooldown: 'steady — catch your breath.',
    not_here: 'that piece is in another world.',
    no_such_piece: 'it is already gone.',
    siege_off: 'raids are paused in this world right now.',
    court_asleep: 'your court is asleep — tend them first, then send them.',
    court_busy: 'your court is already at the walls.',
    need_ember: 'sending the court costs 1 ember.',
    need_strand: 'mending costs 1 strand (the loom weaves strand).',
    not_your_piece: 'only its builder can mend it.',
    unharmed: 'it is whole — nothing to mend.',
    unauthenticated: 'sign in to raid — guests can only watch.',
  };

  // ── geometry helpers ────────────────────────────────────────────────────
  function me() { var w = world(); return (w && w._me) || null; }
  function myId() { var w = world(); return w && w._myUserId != null ? String(w._myUserId) : null; }
  function structs() { var w = world(); try { return (w && w.structList) ? w.structList() : []; } catch (_) { return []; } }
  function dist(a, b) { return Math.hypot((a.x || 0) - (b.x || 0), (a.z || 0) - (b.z || 0)); }
  function hpOf(s) { var h = HP[s.id]; return h ? { hp: h[0], max: h[1], scarred: true } : null; }

  // nearest piece I could strike / mend, measured from where I stand
  function nearest(mine) {
    var p = me(); if (!p) return null;
    var id = myId(), best = null, bd = Infinity;
    var reach = mine ? RULES.mendReach : RULES.reach;
    structs().forEach(function (s) {
      if (s.kind === 'hearth') return;
      var own = id != null && String(s.owner) === id;
      if (mine !== own) return;
      if (mine && !HP[s.id]) return;              // mending targets only scarred pieces
      var d = dist(p, s);
      if (d <= reach + 0.25 && d < bd) { bd = d; best = s; }
    });
    return best ? Object.assign({ d: bd }, best) : null;
  }

  // ── 3D health bars ──────────────────────────────────────────────────────
  function barCanvas(hp, max) {
    var c = document.createElement('canvas'); c.width = 128; c.height = 20;
    var g = c.getContext('2d');
    g.fillStyle = 'rgba(10,8,8,0.78)'; g.fillRect(0, 0, 128, 20);
    var f = Math.max(0, Math.min(1, hp / max));
    g.fillStyle = f > 0.6 ? '#7be08f' : f > 0.3 ? '#f2c25a' : '#ff6a5a';
    g.fillRect(3, 3, Math.round(122 * f), 14);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.strokeRect(1.5, 1.5, 125, 17);
    return c;
  }
  function meshFor(id) {
    var s = structs().filter(function (x) { return String(x.id) === String(id); })[0];
    return s ? s.mesh : null;
  }
  function topOf(mesh) {
    var THREE = T(); if (!THREE || !mesh) return 2.8;
    try { var b = new THREE.Box3().setFromObject(mesh); if (isFinite(b.max.y)) return b.max.y - mesh.position.y + 0.45; } catch (_) {}
    return 2.8;
  }
  function paintBar(id) {
    var THREE = T(), w = world(); if (!THREE || !w || !w._scene) return;
    var h = HP[id], mesh = meshFor(id), spr = _bars[id];
    if (!h || !mesh || h[0] >= h[1]) { dropBar(id); return; }
    var tex = new THREE.CanvasTexture(barCanvas(h[0], h[1]));
    if (!spr) {
      spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      spr.scale.set(1.4, 0.22, 1); spr.renderOrder = 999;
      spr.userData.siegeBar = String(id);
      _bars[id] = spr;
    } else {
      if (spr.material.map) spr.material.map.dispose();
      spr.material.map = tex; spr.material.needsUpdate = true;
    }
    spr.position.set(mesh.position.x, mesh.position.y + topOf(mesh), mesh.position.z);
    if (spr.parent !== w._scene) w._scene.add(spr);
  }
  function dropBar(id) {
    var spr = _bars[id]; if (!spr) return;
    try { if (spr.parent) spr.parent.remove(spr); if (spr.material.map) spr.material.map.dispose(); spr.material.dispose(); } catch (_) {}
    delete _bars[id];
  }
  function repaintAll() {
    Object.keys(_bars).forEach(function (id) { if (!HP[id]) dropBar(id); });
    Object.keys(HP).forEach(paintBar);
  }

  // a struck piece shudders for ~260ms — cheap: position jitter only, no material swap
  function shudder(id) {
    var mesh = meshFor(id); if (!mesh) return;
    var ox = mesh.position.x, oz = mesh.position.z, t0 = performance.now();
    (function step() {
      var t = performance.now() - t0;
      if (t > 260) { mesh.position.x = ox; mesh.position.z = oz; return; }
      var a = 0.06 * (1 - t / 260);
      mesh.position.x = ox + (Math.random() - 0.5) * a; mesh.position.z = oz + (Math.random() - 0.5) * a;
      requestAnimationFrame(step);
    })();
  }
  // a wreck bursts into 14 shards that fall and fade over ~900ms, then are freed
  function burst(at) {
    var THREE = T(), w = world(); if (!THREE || !w || !w._scene || !at) return;
    var mat = new THREE.MeshStandardMaterial({ color: 0x9a8f86, emissive: 0x3a1408, emissiveIntensity: 0.6, transparent: true, opacity: 1 });
    var geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    var shards = [];
    for (var i = 0; i < 14; i++) {
      var m = new THREE.Mesh(geo, mat);
      m.position.set(at.x, (at.y || 0) + 1.2, at.z);
      m.userData.v = { x: (Math.random() - 0.5) * 4, y: 2 + Math.random() * 3, z: (Math.random() - 0.5) * 4 };
      w._scene.add(m); shards.push(m);
    }
    var t0 = performance.now(), last = t0;
    (function step() {
      var now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      var t = (now - t0) / 900;
      shards.forEach(function (m) {
        m.userData.v.y -= 9.8 * dt;
        m.position.x += m.userData.v.x * dt; m.position.y = Math.max(0.09, m.position.y + m.userData.v.y * dt); m.position.z += m.userData.v.z * dt;
        m.rotation.x += 6 * dt; m.rotation.z += 4 * dt;
      });
      mat.opacity = Math.max(0, 1 - t);
      if (t < 1) { requestAnimationFrame(step); return; }
      shards.forEach(function (m) { if (m.parent) m.parent.remove(m); });
      geo.dispose(); mat.dispose();
    })();
  }

  // ── server → mirror ─────────────────────────────────────────────────────
  W.addEventListener('vint:world-state', function (e) {
    var m = e.detail || {};
    if (m.siege) {
      if (m.siege.rules) RULES = Object.assign({}, RULES, m.siege.rules);
      if (m.siege.hp && typeof m.siege.hp === 'object') { HP = {}; Object.keys(m.siege.hp).forEach(function (k) { HP[k] = m.siege.hp[k]; }); }
      setTimeout(repaintAll, 0);   // structures render in the same frame; bars follow
    }
    if (m.carry) _carry = m.carry;
    paint();
  });
  W.addEventListener('vint:world-soil', function (e) { _soil = e.detail || null; if (_soil && _soil.carry) _carry = _soil.carry; paint(); });
  W.addEventListener('vint:world-travel', function () { Object.keys(_bars).forEach(dropBar); HP = {}; _log = []; paint(); });
  W.addEventListener('vint:world-siege', function (e) {
    var m = e.detail || {};
    if (m.t === 'world:siege:hit') {
      if (m.wrecked) delete HP[m.id]; else HP[m.id] = [m.hp, m.max];
      if (!m.wrecked) { paintBar(m.id); shudder(m.id); }
      var mine = myId() != null && String(m.owner) === myId();
      var who = m.court ? (m.by + '’s court') : m.by;
      note(m.wrecked ? (who + ' wrecked ' + (mine ? 'your ' : 'a ') + m.kind) : (who + ' struck ' + (mine ? 'your ' : 'a ') + m.kind + ' −' + m.dmg + ' (' + m.hp + '/' + m.max + ')'), mine ? 'bad' : 'ok');
      if (mine && m.wrecked) toast('your ' + m.kind + ' was wrecked by ' + who);
    } else if (m.t === 'world:struct:gone') {
      var s = _lastSeen[m.id];
      dropBar(m.id); delete HP[m.id];
      if (s) burst(s);
    } else if (m.t === 'world:siege:mended') {
      if (m.hp >= m.max) delete HP[m.id]; else HP[m.id] = [m.hp, m.max];
      paintBar(m.id);
      note(m.by + ' mended a piece (' + m.hp + '/' + m.max + ')', 'ok');
    } else if (m.t === 'world:siege:loot') {
      _carry = m.carry || _carry;
      note('+' + m.drop + ' strand looted — AT RISK until you bank it at your hearth', 'warn');
      toast('+' + m.drop + ' strand looted · carry it home to bank it');
    } else if (m.t === 'world:siege:lost') {
      toast('your ' + m.kind + ' was wrecked by ' + m.by);
    } else if (m.t === 'world:siege:court:ok') {
      note('your court (' + m.agents + ') marches on the piece — ' + m.volleys + ' volleys', 'ok');
    }
    paint();
  });
  W.addEventListener('vint:world-err', function (e) {
    var d = e.detail || {};
    if (d.op !== 'siege' && d.op !== 'mend' && d.op !== 'court') return;
    say(ERR[d.code] || ('the world refused: ' + d.code), 'bad');
  });
  // remember where every piece stood, so a wreck can burst where it was
  var _lastSeen = {};
  function remember() { structs().forEach(function (s) { _lastSeen[s.id] = { x: s.x, y: s.y, z: s.z }; }); }
  W.addEventListener('vint:world-struct', function () { setTimeout(remember, 0); });

  function toast(t) { try { if (hud() && hud().toast) hud().toast(t); } catch (_) {} }
  function note(text, cls) { _log.unshift({ text: text, cls: cls || '' }); _log = _log.slice(0, 5); }

  // ── the hands ───────────────────────────────────────────────────────────
  function send(m) { var w = world(); return !!(w && w.send && w.send(m)); }
  function strike() {
    var t = nearest(false);
    if (!t) { say(ERR.too_far, 'bad'); return; }
    if (Date.now() - _lastHitAt < RULES.cooldownMs) { say(ERR.cooldown, 'wait'); return; }
    _lastHitAt = Date.now();
    remember();
    if (!send({ t: 'world:siege', id: t.id })) say('no connection to the world.', 'bad');
  }
  function court() {
    var t = nearest(false);
    if (!t) { say(ERR.too_far, 'bad'); return; }
    remember();
    if (!send({ t: 'world:siege:court', id: t.id })) say('no connection to the world.', 'bad');
  }
  function mend() {
    var t = nearest(true);
    if (!t) { say('none of your scarred pieces are within 6m.', 'bad'); return; }
    if (!send({ t: 'world:mend', id: t.id })) say('no connection to the world.', 'bad');
  }

  // ── the sheet ───────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('vint-siege-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-siege-styles';
    s.textContent = [
      '#sgSheet .dv-body{display:flex;flex-direction:column;gap:8px;}',
      '#sgSheet .sg-row{display:flex;gap:6px;align-items:stretch;flex-wrap:wrap;}',
      '#sgSheet button{font-family:inherit;cursor:pointer;color:#ffe7dc;background:rgba(255,255,255,0.05);',
      ' border:1px solid rgba(255,255,255,0.12);border-radius:11px;min-height:44px;min-width:44px;box-sizing:border-box;',
      ' flex:1 1 92px;padding:0 10px;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '#sgSheet button:active{transform:scale(0.97);}',
      '#sgSheet button:disabled{opacity:0.38;cursor:default;}',
      '#sgSheet .sg-hit{color:#ffd9cf;background:rgba(255,96,72,0.16);border-color:rgba(255,96,72,0.5);}',
      '#sgSheet .sg-court{color:#f1e1ff;background:rgba(172,120,255,0.14);border-color:rgba(172,120,255,0.45);}',
      '#sgSheet .sg-mend{color:#d6ffe4;background:rgba(87,224,140,0.12);border-color:rgba(87,224,140,0.42);}',
      '#sgSheet .sg-line{font-size:12.5px;line-height:1.35;color:rgba(245,235,220,0.78);overflow-wrap:anywhere;}',
      '#sgSheet .sg-tgt{display:flex;flex-direction:column;gap:5px;padding:8px 10px;border-radius:11px;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);min-width:0;}',
      '#sgSheet .sg-bar{height:8px;border-radius:5px;background:rgba(255,255,255,0.08);overflow:hidden;}',
      '#sgSheet .sg-bar i{display:block;height:100%;border-radius:5px;transition:width .25s ease;}',
      '#sgSheet .sg-log{display:flex;flex-direction:column;gap:3px;max-height:96px;overflow-y:auto;overscroll-behavior:contain;min-height:0;}',
      '#sgSheet .sg-log div{font-size:12px;color:rgba(245,235,220,0.62);overflow-wrap:anywhere;}',
      '#sgSheet .sg-log .bad{color:rgba(255,170,160,0.9);} #sgSheet .sg-log .ok{color:rgba(170,235,195,0.85);} #sgSheet .sg-log .warn{color:rgba(255,214,140,0.92);}',
      '#sgStat{display:block;font-size:12px;letter-spacing:.03em;font-style:italic;margin-top:1px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:calc(100vw - 110px);}',
      '#sgStat.ok{color:rgba(150,240,185,0.85);} #sgStat.bad{color:rgba(255,160,160,0.9);} #sgStat.wait{color:rgba(206,224,255,0.65);}',
      'body.sg-open #dvScrim{background:transparent;backdrop-filter:none;-webkit-backdrop-filter:none;}',
    ].join('');
    document.head.appendChild(s);
  }
  function btn(cls, id, text, aria) {
    return '<button class="' + cls + '" id="' + id + '" data-draggable="false" aria-label="' + aria + '">' + text + '</button>';
  }
  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var el = document.createElement('div');
    el.className = 'dv-sheet'; el.id = 'sgSheet';
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the siege<small id="sgStat" class="wait" aria-live="polite">close on a piece in the march</small></div>' +
        '<button class="dv-x" id="sgX" data-draggable="false" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body">' +
        '<div class="sg-line" id="sgSoil"></div>' +
        '<div class="sg-tgt" id="sgTgt"></div>' +
        '<div class="sg-row">' +
          btn('sg-hit', 'sgHit', '⚔ strike', 'strike the nearest piece in reach') +
          btn('sg-court', 'sgCourt', '♛ send court · 1 ember', 'send your waking court to siege it') +
          btn('sg-mend', 'sgMend', '⚒ mend · 1 strand', 'mend your nearest scarred piece') +
        '</div>' +
        '<div class="sg-line" id="sgCarry"></div>' +
        '<div class="sg-log" id="sgLog" aria-live="polite"></div>' +
      '</div>';
    document.body.appendChild(el);
    _sheet = el;
    el.querySelector('#sgX').onclick = close;
    el.querySelector('#sgHit').onclick = strike;
    el.querySelector('#sgCourt').onclick = court;
    el.querySelector('#sgMend').onclick = mend;
    return el;
  }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function say(text, cls) { var s = _sheet && _sheet.querySelector('#sgStat'); if (!s) return; s.textContent = text; s.className = cls || ''; }

  function paint() {
    if (!_sheet || !isOpen()) return;
    var w = world(), guest = !!(w && w._guest);
    var soil = _soil && (_soil.soil || (_soil.here && _soil.here.soil));
    var violent = !!(_soil && (_soil.violence || (_soil.here && _soil.here.violence)));
    _sheet.querySelector('#sgSoil').textContent = guest ? 'guests can watch a siege, not wage one — sign in to raid.'
      : !RULES.on ? 'raids are paused in this world.'
      : violent ? 'you stand in the march — blood ground. pieces here can fall, including yours.'
      : 'you stand on ' + (soil || 'safe ground') + '. nothing here can be raided — find a march.';
    var t = nearest(false), m = nearest(true);
    var tgt = _sheet.querySelector('#sgTgt');
    if (t) {
      var h = hpOf(t), hp = h ? h.hp : null, max = h ? h.max : null;
      var f = h ? Math.max(0, Math.min(1, hp / max)) : 1;
      var col = f > 0.6 ? '#7be08f' : f > 0.3 ? '#f2c25a' : '#ff6a5a';
      tgt.innerHTML = '<div class="sg-line">target: ' + esc(t.kind) + ' · ' + t.d.toFixed(1) + 'm · ' + (h ? (hp + '/' + max) : 'unscarred') + '</div>' +
        '<div class="sg-bar"><i style="width:' + Math.round(f * 100) + '%;background:' + col + '"></i></div>';
    } else {
      tgt.innerHTML = '<div class="sg-line">no foreign piece within ' + RULES.reach + 'm.</div>';
    }
    var off = guest || !RULES.on;
    _sheet.querySelector('#sgHit').disabled = off || !t || !violent;
    _sheet.querySelector('#sgCourt').disabled = off || !t || !violent;
    _sheet.querySelector('#sgMend').disabled = guest || !m;
    var strand = _carry && _carry.strand ? _carry.strand : 0;
    _sheet.querySelector('#sgCarry').textContent = strand ? ('carrying ' + strand + ' looted strand — at risk until you bank it at your hearth.') : '';
    _sheet.querySelector('#sgLog').innerHTML = _log.map(function (l) { return '<div class="' + l.cls + '">' + esc(l.text) + '</div>'; }).join('');
  }

  function tick() {
    _raf = 0;
    if (!isOpen()) return;
    paint();
    _raf = setTimeout(function () { _raf = requestAnimationFrame(tick); }, 250);
  }

  function open() {
    var h = hud();
    var fn = function () { build(); _sheet.classList.add('open'); afterOpen(); };
    if (h && h.openSheet) h.openSheet('siege', fn); else fn();
  }
  function afterOpen() {
    document.body.classList.add('sg-open');
    try { if (W.VintDock && W.VintDock.avoid) { W.VintDock.avoid(_sheet, { corner: 'br' }); W.VintDock.avoid(_sheet, { corner: 'bl' }); } } catch (_) {}
    remember();
    send({ t: 'world:soil' });     // ask the server what ground this is — never guess it
    paint();
    if (!_raf) _raf = requestAnimationFrame(tick);
  }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    document.body.classList.remove('sg-open');
    try { if (W.VintDock && W.VintDock.unavoid && _sheet) W.VintDock.unavoid(_sheet); } catch (_) {}
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  function mountLauncher() {
    if (_btn) return;
    var h = hud();
    if (!h || !h.addLauncher) { setTimeout(mountLauncher, 400); return; }
    try {
      _btn = h.addLauncher('sgBtn', 'siege', '⚔', open);
      if (h.registerSheet) h.registerSheet('siege', isOpen, close);
    } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
  else mountLauncher();

  W.WorldSiege = {
    open: open, close: close, isOpen: isOpen, strike: strike, court: court, mend: mend,
    // read-only views for verifiers / future organs
    hp: function () { return JSON.parse(JSON.stringify(HP)); },
    bars: function () { return Object.keys(_bars); },
    rules: function () { return Object.assign({}, RULES); },
    target: function () { var t = nearest(false); return t ? { id: t.id, kind: t.kind, d: t.d } : null; },
    // test seam: replay a server frame exactly as world-client would relay it
    _inject: function (m) { W.dispatchEvent(new CustomEvent(m.t === 'world:state' ? 'vint:world-state' : 'vint:world-siege', { detail: m })); },
  };
})();
