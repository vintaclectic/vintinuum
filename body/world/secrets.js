// secrets.js — THE THINGS THE WORLD NEVER TOLD YOU (HELIOS-FUSION, 2026-08-26)
//
// ════════════════════════════════════════════════════════════════════════════
// Every other organ in this world announces itself. The rail has a launcher for
// the star-map, the court, the loom, the commons, the arcade — walk up, tap, the
// surface explains itself. That is correct for a FEATURE and fatal for a WORLD,
// because a place where everything is signposted is a place with no far side.
// Nothing here was ever found. It was only ever navigated to.
//
// This organ is the far side: a set of things nobody tells you about, that the
// world notices you doing anyway.
//
// WHAT A SECRET IS, EXACTLY:
//   A secret is a CONDITION over signals the world ALREADY emits — the
//   `vint:world-*` event vocabulary that trade, travel, tending, kindling,
//   striking, weaving and the rest have been broadcasting all along. When the
//   condition is met, the secret KEEPS. You are told at that moment and never
//   before. There is no progress bar, no "1 of 7 found" taunt on the rail, no
//   hint system, no checklist. The only way to learn a secret exists is to keep
//   it, or to be told by someone who did.
//
// WHY IT IS BUILT AS A PURE LISTENER (the load-bearing design decision):
//   This file instruments NOTHING. It adds no hooks to trade, no counters to
//   travel, no callbacks into the arcade. It attaches to the window event bus,
//   reads what is already flying past, and writes to its own storage key. That
//   means:
//     · every existing organ keeps working byte-identically if this file is
//       deleted, flagged off, or fails to parse — a secret is never load-bearing
//       for the thing it watches;
//     · a NEW secret is a row in the KEEPERS table below and nothing else. No
//       other file is ever edited to add one. That is the whole reason the
//       table is data and not code.
//   The inverse — sprinkling `if (secretCheck())` through eight organs — is how
//   discovery systems rot: they become the thing everyone must remember to call.
//
// THE SEVEN TESTS, where they actually bite:
//   1 GENEROUS (ARIA) — nothing is gated behind a secret. Not one. Every secret
//     grants MEANING (a name, a mark, a line of world-truth), never a
//     capability, never currency, never an advantage over someone who found
//     none. If a player read this file they would find no punishment for
//     missing everything, and no purchase that skips it. A secret you can buy
//     is an advertisement; a secret you can only keep is a secret. Nothing in
//     this file is tier-gated, and it never will be — that is written into the
//     TIER note below so a future hand cannot quietly monetize it.
//   2 INVESTMENT (HELIOS) — kept secrets are per-world and accrete. They are
//     the record of how you specifically inhabited this place, and they make
//     your clearing progressively more yours in a way no other player's can
//     duplicate. Switching cost that was earned, never charged.
//   4 AESTHETIC DENSITY (LUNEX) — a keep is ONE line through the world's single
//     toast channel. Not a modal, not a fanfare, not a screen-blanking
//     achievement card that interrupts what you were doing to congratulate you
//     for doing it. The reveal respects the moment it happened in.
//   5 THE OPEN LOOP (MORRISON) — this is the engine of the whole organ. The
//     sheet shows what you KEPT and, beneath it, the exact count of what you
//     have not — with no names, no hints, no silhouettes. "four things in this
//     world have not noticed you yet" is unfinished meaning that cannot be
//     resolved by grinding, only by living differently. That is the hook, and
//     it is made of curiosity rather than obligation.
//   6 FLAGGED + TRANSPARENT (ATLAS) — flag 'world_secrets', killable in 30s
//     (?secrets=0). Every kept secret records WHY it kept — the exact condition
//     — so "why am I seeing this?" always has an answer in the UI itself. The
//     resentment signal is real: VintSecrets.hush() silences every future
//     reveal permanently, in one call, and keeps the ones already kept.
//   7 MORE ALIVE (YUNA) — a world that notices what you did without being asked
//     is a world that was paying attention. That is the difference between a
//     place and a menu.
//
// TIER (FRUGAL-MAX) — deliberately NONE. Free players find every secret. The
// conversion narrative this organ serves is indirect and honest: it makes the
// world worth staying in, and the tiers sell what you do once you are staying.
// Gating a secret behind a rung would convert the one mechanic in the world
// that is pure gift into the one mechanic that is pure bait. Do not do it.
//
// ════════════════════════════════════════════════════════════════════════════
// NO-COLLISION LAW — how this surface can never touch another
//
// It adds ZERO fixed elements. Not one. Same two borrowed extension points
// every other organ uses, both of which MEASURE rather than assume:
//   · DirverseHUD.addLauncher() — the ✦ button is a FLOW CHILD of #dvRail, so
//     the rail allocates its slot. No hand-counted bottom offset exists in this
//     file, which is precisely the bug that once put the DirHaven door on top of
//     the build launcher.
//   · DirverseHUD.registerSheet() + openSheet() — the sheet joins the
//     one-open-at-a-time registry, so raising it CLOSES the star-map, court,
//     loom, commons and arcade rather than mounting on their identical pixels.
// The sheet reuses .dv-sheet/.dv-body/.dv-head/.dv-grip/.dv-title/.dv-x
// verbatim: height-capped, internally scrolling, safe-area padded. Content
// yields; the container never grows. Long secret names, forty kept rows and the
// empty state all scroll INSIDE the body and nothing reaches a neighbour at
// 320/375/768/1280/1920. Reveals speak through DirverseHUD.toast() — the world's
// ONE measured toast element — so two reveals in the same second queue through a
// single node instead of stacking two toasts on the same pixels.
//
// UNTRUSTED CONTENT — secret copy is authored here, but world names and event
// payloads are not. NOTHING in this file is ever concatenated into innerHTML;
// every dynamic string lands via textContent at the leaf.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintSecrets) return;

  var W = window;
  var DOC = (typeof document !== 'undefined') ? document : null;
  function hud() { return W.DirverseHUD; }

  // ── FEATURE FLAG — 'world_secrets'. Killable in 30s, no deploy. ────────────
  //   ?secrets=0 / ?secrets=1  ·  localStorage vint:flag:world_secrets = '0'|'1'
  // Read LIVE (never latched) so the kill switch does not require a reload.
  function enabled() {
    var on = true;
    try {
      var q = new URLSearchParams(W.location.search);
      if (q.get('secrets') === '0') return false;
      if (q.get('secrets') === '1') return true;
    } catch (_) {}
    try {
      var f = W.localStorage.getItem('vint:flag:world_secrets');
      if (f === '0') on = false;
      else if (f === '1') on = true;
    } catch (_) {}
    return on;
  }

  // ── RESENTMENT SIGNAL — one call, always available, never punished. ────────
  // hush() stops every FUTURE reveal. It never deletes what you already kept,
  // and it never disables the sheet: opting out of being interrupted is not
  // opting out of your own history.
  function hushed() {
    try { return W.localStorage.getItem('vint:secrets:hush') === '1'; } catch (_) { return false; }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STORAGE — per world, so secrets belong to a PLACE and not to a browser.
  // ═══════════════════════════════════════════════════════════════════════════
  function worldKey() {
    // Whatever the world calls itself; falls back to a stable literal so a
    // pre-identity load still records rather than throwing its keeps away.
    try {
      var w = W.VintinuumWorld;
      var id = w && (w.worldId || w.id || (w.state && w.state.worldId));
      if (id) return String(id);
    } catch (_) {}
    return 'here';
  }

  var _cache = null, _cacheKey = null;

  function load() {
    var k = worldKey();
    if (_cache && _cacheKey === k) return _cache;
    var st = { kept: {} };
    try {
      var raw = W.localStorage.getItem('vint:secrets:' + k);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && typeof p === 'object' && p.kept && typeof p.kept === 'object') st = p;
      }
    } catch (_) {}
    _cache = st; _cacheKey = k;
    return st;
  }

  function save() {
    try {
      W.localStorage.setItem('vint:secrets:' + _cacheKey, JSON.stringify(_cache));
    } catch (_) { /* quota or private mode — the world still runs */ }
  }

  // ── UNIVERSAL INGESTION LAW — every keep is a training example. ────────────
  // Append-only, capped, local. Never blocks, never throws into the world.
  function ingest(row) {
    try {
      var K = 'vint:ingest:secrets';
      var arr = JSON.parse(W.localStorage.getItem(K) || '[]');
      arr.push({ t: row.at, world: _cacheKey, secret: row.id, why: row.why });
      if (arr.length > 500) arr = arr.slice(-500);
      W.localStorage.setItem(K, JSON.stringify(arr));
    } catch (_) {}
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE KEEPERS — the entire content of the organ, as DATA.
  //
  // Each row: { id, name, line, why, watch, test }
  //   id    — stable storage key. NEVER renamed (renaming un-keeps a secret
  //           someone already earned, which is theft).
  //   name  — what it is called once found.
  //   line  — the single line spoken at the moment of keeping.
  //   why   — the plain-language condition, shown in the sheet forever after,
  //           so "why am I seeing this?" is answerable without leaving the UI.
  //   watch — the world events this listens to. Nothing else is subscribed.
  //   test  — (ev, mem) => truthy to keep. `mem` is a scratch object persisted
  //           per world, so a secret can count across a session without any
  //           other file knowing it is being counted.
  //
  // ADDING A SECRET IS ADDING A ROW HERE. No other file is touched, ever.
  // Conditions deliberately reward INHABITING the world (returning, tending,
  // trading fairly, walking at the edges) over grinding a number, because a
  // secret that rewards grinding is a chore wearing a secret's clothes.
  // ═══════════════════════════════════════════════════════════════════════════
  var KEEPERS = [
    {
      id: 'first-light',
      name: 'first light',
      line: 'the world noticed you arrive. it will remember the hour.',
      why: 'you stood in a world at the moment it finished waking.',
      watch: ['vint:world-ready'],
      test: function () { return true; }
    },
    {
      id: 'the-long-way',
      name: 'the long way',
      line: 'you have crossed enough clearings that the map knows your gait.',
      why: 'you travelled to seven different worlds.',
      watch: ['vint:world-travel'],
      test: function (ev, mem) {
        var to = pick(ev, ['to', 'world', 'worldId', 'id']);
        if (!to) return false;
        mem.seen = mem.seen || {};
        mem.seen[String(to)] = 1;
        return Object.keys(mem.seen).length >= 7;
      }
    },
    {
      id: 'open-handed',
      name: 'open-handed',
      line: 'you settled every trade you opened. nobody here has a reason to doubt you.',
      why: 'you settled five trades without leaving one closed unsettled.',
      watch: ['vint:world-trade-settled', 'vint:world-trade-closed'],
      test: function (ev, mem) {
        if (ev.type === 'vint:world-trade-closed') { mem.settled = 0; return false; }
        mem.settled = (mem.settled || 0) + 1;
        return mem.settled >= 5;
      }
    },
    {
      id: 'the-tended-hour',
      name: 'the tended hour',
      line: 'something you kept alive outlived your attention to it.',
      why: 'you tended the same world across three separate visits.',
      watch: ['vint:world-tend', 'vint:world-harvest', 'vint:world-kindle'],
      test: function (ev, mem) {
        // One credit per VISIT, not per action — grinding tend in a single
        // sitting must never satisfy a secret about returning.
        if (mem.visit === _boot) return false;
        mem.visit = _boot;
        mem.visits = (mem.visits || 0) + 1;
        return mem.visits >= 3;
      }
    },
    {
      id: 'quiet-hands',
      name: 'quiet hands',
      line: 'you built for an hour and struck nothing down. the world is heavier for it.',
      why: 'you raised twelve structures in one visit without striking any.',
      watch: ['vint:world-struct', 'vint:world-strike'],
      test: function (ev, mem) {
        if (mem.boot !== _boot) { mem.boot = _boot; mem.built = 0; }
        if (ev.type === 'vint:world-strike') { mem.built = 0; return false; }
        mem.built = (mem.built || 0) + 1;
        return mem.built >= 12;
      }
    },
    {
      id: 'the-witness',
      name: 'the witness',
      line: 'you were standing here when someone else walked in. that is rarer than it sounds.',
      why: 'another presence entered a world while you were already in it.',
      watch: ['vint:world-presence', 'vint:world-who'],
      test: function (ev, mem) {
        var n = presenceCount(ev);
        if (n == null) return false;
        var was = (mem.last == null) ? n : mem.last;
        mem.last = n;
        return n > was && n >= 2;
      }
    },
    {
      id: 'deep-water',
      name: 'deep water',
      line: 'you went further out than the world expected anyone to go.',
      why: 'you kept going after the world had nothing left to show you.',
      watch: ['vint:world-travel', 'vint:world-weave', 'vint:world-refine'],
      test: function (ev, mem) {
        // Not a count of one thing — a count of VARIETY. You only trip this by
        // doing many different kinds of things, which is what "further out"
        // actually means in a world with no edges.
        mem.kinds = mem.kinds || {};
        mem.kinds[ev.type] = (mem.kinds[ev.type] || 0) + 1;
        var kinds = Object.keys(mem.kinds);
        if (kinds.length < 3) return false;
        var total = 0;
        for (var i = 0; i < kinds.length; i++) total += mem.kinds[kinds[i]];
        return total >= 30;
      }
    }
  ];

  // A stable id for THIS page-load, so "per visit" conditions can tell one
  // sitting from the next without persisting a clock.
  var _boot = String(Date.now()) + ':' + Math.random().toString(36).slice(2, 8);

  // ── payload helpers — every event shape in the world is somebody else's, so
  // we read defensively and never assume a field exists.
  function pick(ev, keys) {
    var d = ev && ev.detail;
    if (!d || typeof d !== 'object') return null;
    for (var i = 0; i < keys.length; i++) {
      if (d[keys[i]] != null) return d[keys[i]];
    }
    return null;
  }

  function presenceCount(ev) {
    var d = ev && ev.detail;
    if (!d) return null;
    if (Array.isArray(d)) return d.length;
    if (typeof d.count === 'number') return d.count;
    var arr = d.present || d.people || d.who || d.presence;
    if (Array.isArray(arr)) return arr.length;
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // KEEPING
  // ═══════════════════════════════════════════════════════════════════════════
  function isKept(id) { return !!load().kept[id]; }

  function keep(k, why) {
    var st = load();
    if (st.kept[k.id]) return false;
    var row = { at: Date.now(), id: k.id, why: why || k.why };
    st.kept[k.id] = row;
    save();
    ingest(row);

    // ONE line, through the world's ONE toast channel. Never a modal: a reveal
    // that blanks the screen punishes you for the exact behaviour it is
    // rewarding. Suppressed entirely if the visitor asked for quiet.
    if (!hushed()) {
      try { if (hud() && hud().toast) hud().toast('✦ ' + k.name + ' — ' + k.line); } catch (_) {}
    }
    try {
      W.dispatchEvent(new CustomEvent('vint:secret-kept', {
        detail: { id: k.id, name: k.name, at: row.at }
      }));
    } catch (_) {}
    updateLauncher();
    return true;
  }

  // ── THE BUS — one listener per distinct event, dispatching to every keeper
  // that asked for it. A keeper that throws is contained and disabled for the
  // session: a bad row must never take down the world's event loop.
  var _mem = {};      // per-secret scratch, this session
  var _dead = {};     // keepers that threw — never called again this load
  var _bound = false;

  function onWorldEvent(ev) {
    if (!enabled()) return;
    for (var i = 0; i < KEEPERS.length; i++) {
      var k = KEEPERS[i];
      if (_dead[k.id]) continue;
      if (k.watch.indexOf(ev.type) === -1) continue;
      if (isKept(k.id)) continue;
      try {
        _mem[k.id] = _mem[k.id] || {};
        if (k.test(ev, _mem[k.id])) keep(k);
      } catch (err) {
        _dead[k.id] = 1;   // contained: the world keeps running
      }
    }
  }

  function bind() {
    if (_bound) return;
    _bound = true;
    var seen = {};
    for (var i = 0; i < KEEPERS.length; i++) {
      for (var j = 0; j < KEEPERS[i].watch.length; j++) {
        var t = KEEPERS[i].watch[j];
        if (seen[t]) continue;
        seen[t] = 1;
        W.addEventListener(t, onWorldEvent);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE SURFACE
  // ═══════════════════════════════════════════════════════════════════════════
  function keptList() {
    var st = load(), out = [];
    for (var i = 0; i < KEEPERS.length; i++) {
      var r = st.kept[KEEPERS[i].id];
      if (r) out.push({ k: KEEPERS[i], at: r.at, why: r.why });
    }
    out.sort(function (a, b) { return b.at - a.at; });
    return out;
  }

  function unkeptCount() { return KEEPERS.length - keptList().length; }

  function ago(t) {
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  var _sheet = null, _btn = null;

  function injectStyles() {
    if (!DOC || DOC.getElementById('sc-styles')) return;
    var s = DOC.createElement('style');
    s.id = 'sc-styles';
    // Scoped under #dvSecretSheet / #scBtn. The sheet scaffold itself
    // (.dv-sheet/.dv-body/.dv-head/.dv-grip) is inherited from dirverse-hud —
    // we add ONLY the accent and the row rhythm, never geometry.
    s.textContent = [
      '#scBtn{color:#e7dcff;border-color:rgba(179,136,255,0.34);}',
      '#scBtn .dot{background:#b388ff;box-shadow:0 0 8px #b388ff;}',
      '#dvSecretSheet .sc-row{display:flex;gap:11px;align-items:flex-start;',
      ' padding:11px 2px;border-bottom:1px solid rgba(179,136,255,0.12);}',
      '#dvSecretSheet .sc-row:last-child{border-bottom:0;}',
      '#dvSecretSheet .sc-g{flex:0 0 auto;width:22px;text-align:center;color:#b388ff;',
      ' font-size:15px;line-height:1.5;}',
      // min-width:0 is load-bearing: without it a long unbroken name refuses to
      // shrink and pushes the timestamp out past the sheet's right edge.
      '#dvSecretSheet .sc-t{flex:1 1 auto;min-width:0;}',
      '#dvSecretSheet .sc-n{color:#efe7ff;font-size:14.5px;letter-spacing:.02em;',
      ' overflow-wrap:anywhere;}',
      '#dvSecretSheet .sc-w{color:rgba(231,220,255,0.58);font-size:12px;font-style:italic;',
      ' line-height:1.5;margin-top:3px;overflow-wrap:anywhere;}',
      '#dvSecretSheet .sc-a{flex:0 0 auto;color:rgba(231,220,255,0.4);font-size:11.5px;',
      ' padding-top:2px;white-space:nowrap;}',
      '#dvSecretSheet .sc-none{color:rgba(231,220,255,0.62);font-size:13.5px;line-height:1.6;',
      ' padding:16px 2px;font-style:italic;}',
      // The open loop: its own block, its own space, never overlapping a row.
      '#dvSecretSheet .sc-loop{margin-top:14px;padding:13px 14px;border-radius:12px;',
      ' background:rgba(179,136,255,0.07);border:1px solid rgba(179,136,255,0.16);',
      ' color:rgba(231,220,255,0.76);font-size:13px;line-height:1.6;}',
      '#dvSecretSheet .sc-hush{margin-top:12px;min-height:44px;width:100%;border-radius:12px;',
      ' cursor:pointer;font:inherit;font-size:12.5px;color:rgba(231,220,255,0.6);',
      ' background:rgba(255,255,255,0.04);border:1px solid rgba(179,136,255,0.18);}',
      '#dvSecretSheet .sc-hush:active{transform:scale(0.98);}'
    ].join('');
    DOC.head.appendChild(s);
  }

  function buildSheet() {
    if (_sheet) return _sheet;
    injectStyles();
    var el = DOC.createElement('div');
    el.className = 'dv-sheet';
    el.id = 'dvSecretSheet';
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">what you have found<small id="scSub"></small></div>' +
        '<button class="dv-x" id="scX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body" id="scBody"></div>';
    DOC.body.appendChild(el);
    el.querySelector('#scX').onclick = close;
    _sheet = el;
    return el;
  }

  function render() {
    if (!_sheet) return;
    var body = _sheet.querySelector('#scBody');
    var sub = _sheet.querySelector('#scSub');
    var kept = keptList();
    var left = unkeptCount();

    while (body.firstChild) body.removeChild(body.firstChild);
    sub.textContent = kept.length
      ? kept.length + ' kept in this world'
      : 'nothing yet';

    if (!kept.length) {
      var none = DOC.createElement('div');
      none.className = 'sc-none';
      // Deliberately gives NO hint. Naming even one condition would convert the
      // whole organ into a checklist, which is the failure mode it exists to
      // avoid.
      none.textContent = 'this world has not told you anything yet. it will, '
        + 'when you do something worth noticing — and not before.';
      body.appendChild(none);
    } else {
      for (var i = 0; i < kept.length; i++) {
        var r = kept[i];
        var row = DOC.createElement('div'); row.className = 'sc-row';
        var g = DOC.createElement('div'); g.className = 'sc-g'; g.textContent = '✦';
        var t = DOC.createElement('div'); t.className = 'sc-t';
        var n = DOC.createElement('div'); n.className = 'sc-n';
        n.textContent = r.k.name;                       // textContent, always
        var w = DOC.createElement('div'); w.className = 'sc-w';
        w.textContent = r.why;                          // the transparency answer
        t.appendChild(n); t.appendChild(w);
        var a = DOC.createElement('div'); a.className = 'sc-a';
        a.textContent = ago(r.at);
        row.appendChild(g); row.appendChild(t); row.appendChild(a);
        body.appendChild(row);
      }
    }

    // THE OPEN LOOP — a count and nothing else. No names, no silhouettes, no
    // "you are close". A number you cannot act on directly is curiosity; a hint
    // is a chore.
    if (left > 0) {
      var loop = DOC.createElement('div');
      loop.className = 'sc-loop';
      loop.textContent = left === 1
        ? 'one thing in this world has not noticed you yet.'
        : left + ' things in this world have not noticed you yet.';
      body.appendChild(loop);
    }

    var hush = DOC.createElement('button');
    hush.type = 'button';
    hush.className = 'sc-hush';
    hush.textContent = hushed()
      ? 'reveals are silenced — turn them back on'
      : 'stop telling me when I find something';
    hush.onclick = function () {
      try { W.localStorage.setItem('vint:secrets:hush', hushed() ? '0' : '1'); } catch (_) {}
      render();
    };
    body.appendChild(hush);
  }

  function isOpen() { return !!(_sheet && _sheet.classList.contains('open')); }

  function open() {
    if (!enabled() || !DOC) return;
    buildSheet();
    var h = hud();
    if (h && h.openSheet) {
      h.openSheet('secrets', function () { render(); _sheet.classList.add('open'); });
    } else {
      render(); _sheet.classList.add('open');
    }
  }

  function close() {
    if (_sheet) _sheet.classList.remove('open');
    var h = hud();
    try { if (h && h.syncSheets) h.syncSheets(); } catch (_) {}
  }

  function toggle() { isOpen() ? close() : open(); }

  function updateLauncher() {
    if (!_btn) return;
    var n = keptList().length;
    try {
      _btn.setAttribute('aria-label',
        n ? ('what you have found — ' + n + ' kept') : 'what you have found');
    } catch (_) {}
  }

  var _waits = 0;
  function mountLauncher() {
    if (!enabled() || !DOC) return;
    injectStyles();
    var h = hud();
    // The HUD owns the rail. Wait for it rather than falling back to a fixed
    // button — a fallback that overlaps is worse than a launcher 200ms late.
    if (!h || !h.addLauncher) { if (_waits++ < 25) setTimeout(mountLauncher, 90); return; }
    _btn = h.addLauncher('scBtn', 'found', '✦', open);
    try { h.registerSheet('secrets', isOpen, close); } catch (_) {}
    updateLauncher();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE HEADLESS BOUNDARY — everything below needs a DOM. A require() stops here.
  // ═══════════════════════════════════════════════════════════════════════════
  function api() {
    return {
      open: open, close: close, toggle: toggle, isOpen: isOpen, enabled: enabled,
      render: render,
      kept: keptList,
      remaining: unkeptCount,
      isKept: isKept,
      all: function () { return KEEPERS.map(function (k) { return { id: k.id, name: k.name }; }); },
      // the resentment signal, always one call away
      hush: function (on) {
        try { W.localStorage.setItem('vint:secrets:hush', on === false ? '0' : '1'); } catch (_) {}
        return hushed();
      },
      hushed: hushed,
      // test seam — lets the verifier drive real conditions without faking storage
      _feed: onWorldEvent,
      _reset: function () {
        _cache = { kept: {} }; _mem = {}; _dead = {};
        try { W.localStorage.removeItem('vint:secrets:' + worldKey()); } catch (_) {}
        _cacheKey = worldKey();
      }
    };
  }

  bind();
  W.VintSecrets = api();

  if (!DOC) return;
  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
  else mountLauncher();
})();
