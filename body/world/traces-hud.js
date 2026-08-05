// traces-hud.js — THE LANTERNS, made findable (AETHERHOLD, 2026-08-05)
//
// ════════════════════════════════════════════════════════════════════════════
// DIRVERSE could already send you to another king's clearing. What it could not
// do was let the visit MEAN anything: you arrived, you looked, you left, and the
// world was bit-for-bit what it had been. Nobody knew you came. This surface is
// the other half of travel — the part where a place remembers.
//
// TWO PEOPLE, TWO MOMENTS, ONE OBJECT:
//
//   THE VISITOR gets one action, in someone else's world only: set down a
//   LANTERN where they're standing, with at most a sentence. One per world,
//   forever — leaving another MOVES yours. Scarcity is what makes it a gift
//   instead of a comment section, and it is enforced by the schema (a UNIQUE
//   index), not by a rate limit somebody can wait out.
//
//   THE OWNER gets the discovery: they walk into their own clearing and the
//   world tells them, once, that someone came while they were gone — with the
//   name, the words, and a way to walk to the light. And they can put any
//   lantern out in one tap, which is the thing that makes hosting strangers
//   safe enough to be generous about.
//
// THE SEVEN TESTS, where they bite:
//   1 GENEROUS (ARIA) — the floor of the interaction is "someone left you a
//     light". If an owner read this file they'd thank us: nothing is extracted
//     from them, the stranger's mark is removable, and the words are capped so
//     nobody can shout in their world.
//   2 INVESTMENT (HELIOS) — every visit makes a clearing more specifically
//     yours. The lanterns are a record only your world has, and the urge to go
//     leave one back is the star-map paying for its own discovery.
//   5 THE OPEN LOOP (MORRISON) — an unvisited lantern is unfinished meaning
//     standing in your own world. You go look. That is the whole hook, and it is
//     a hook made of another person, not a streak.
//   6 FLAGGED + TRANSPARENT (ATLAS) — feature-flagged 'world_traces' (killable
//     in 30s: ?traces=0). Every lantern names who left it and when. No count is
//     ever inflated: one lantern is exactly one person.
//
// ════════════════════════════════════════════════════════════════════════════
// NO-COLLISION LAW — how this surface can never touch another
//
// It adds NO fixed element of its own. Not one. It borrows the two extension
// points the rail already owns, and both of them measure:
//   · DirverseHUD.addLauncher() puts the ✧ button INSIDE #dvRail, in normal
//     flow, so it is allocated a slot by the thing that measures the rail rather
//     than pinned at a hand-counted offset (which is exactly how the DirHaven
//     door once landed on top of the build launcher).
//   · DirverseHUD.registerSheet() + openSheet() put this sheet in the
//     one-open-at-a-time registry, so raising it CLOSES the star-map, the agent
//     panel and the court instead of mounting on their identical pixels.
// The sheet itself reuses .dv-sheet/.dv-body verbatim: height-capped at
// min(78dvh,560px), internally scrolling, safe-area padded. Content yields; the
// container never grows. A 140-char sentence, a 40-char name and forty lanterns
// all scroll inside it and nothing reaches a neighbour at any width.
//
// UNTRUSTED CONTENT — every string in here came from a stranger. The server
// already sanitized and capped it, and this file NEVER concatenates any of it
// into innerHTML. Names and words go in through textContent, once, at the leaf.
// Both halves are enforced; neither is trusted to be the only one.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintTraces) return;

  var W = window;
  function world() { return W.VintinuumWorld; }
  function hud() { return W.DirverseHUD; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }

  // ── FEATURE FLAG — 'world_traces'. Killable in 30s, no deploy. ──────────────
  //   ?traces=0 / ?traces=1  ·  localStorage vint:flag:world_traces = '0' | '1'
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('traces') === '0') _flag = false;
      else if (q.get('traces') === '1') _flag = true;
      else {
        var ls = localStorage.getItem('vint:flag:world_traces');
        if (ls === '0') _flag = false;
      }
    } catch (_) {}
    return _flag;
  }

  var GLYPHS = [
    { k: 'lantern', s: '✦', label: 'lantern' },
    { k: 'sigil',   s: '◈', label: 'sigil' },
    { k: 'cairn',   s: '⌂', label: 'cairn' },
    { k: 'bloom',   s: '✾', label: 'bloom' },
    { k: 'ember',   s: '❈', label: 'ember' },
    { k: 'star',    s: '✧', label: 'star' }
  ];
  var MAX_CHARS = 140;   // mirrors the server's cap exactly; the server still wins

  function ago(sec) {
    if (!sec) return '';
    var d = Math.floor(Date.now() / 1000) - sec;
    if (d < 90) return 'just now';
    if (d < 3600) return Math.floor(d / 60) + 'm ago';
    if (d < 86400) return Math.floor(d / 3600) + 'h ago';
    if (d < 172800) return 'yesterday';
    return Math.floor(d / 86400) + 'd ago';
  }

  function injectStyles() {
    if (document.getElementById('vint-traces-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-traces-styles';
    // Everything here is scoped under #dvTraceSheet / #whFound. The sheet
    // scaffold (.dv-sheet/.dv-body/.dv-grip/.dv-head) is inherited from
    // dirverse-hud's stylesheet on purpose — one definition of the bottom-sheet
    // box means this surface can never disagree with its siblings about how
    // tall a sheet is allowed to be.
    s.textContent = [
      // ── the composer (visitor's action) ────────────────────────────────────
      '#dvTraceSheet .tr-compose{padding:2px 0 14px;border-bottom:1px solid rgba(255,255,255,0.07);',
      ' margin-bottom:12px;}',
      '#dvTraceSheet .tr-glyphs{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px;}',
      '#dvTraceSheet .tr-g{flex:1 1 auto;min-width:52px;min-height:44px;border-radius:12px;cursor:pointer;',
      ' font-family:inherit;font-size:18px;color:rgba(220,231,255,0.7);',
      ' background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);',
      ' display:flex;align-items:center;justify-content:center;}',
      '#dvTraceSheet .tr-g.on{background:rgba(255,212,121,0.14);border-color:rgba(255,212,121,0.45);color:#ffe2a0;}',
      // The words. A textarea, not an input, because a sentence wraps — and it
      // is height-fixed with its own scroll so a long line can never push the
      // send button out of the sheet.
      '#dvTraceSheet .tr-words{width:100%;box-sizing:border-box;min-height:66px;max-height:88px;',
      ' resize:none;border-radius:12px;padding:10px 12px;font-family:inherit;font-size:15px;line-height:1.45;',
      ' color:#eaf3ff;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.11);',
      ' outline:none;overflow-y:auto;}',
      '#dvTraceSheet .tr-words:focus{border-color:rgba(255,212,121,0.4);}',
      '#dvTraceSheet .tr-foot{display:flex;align-items:center;gap:10px;margin-top:9px;}',
      '#dvTraceSheet .tr-count{flex:0 0 auto;font-size:12px;color:rgba(206,224,255,0.45);',
      ' font-variant-numeric:tabular-nums;min-width:52px;}',
      '#dvTraceSheet .tr-count.over{color:#ff9a9a;}',
      '#dvTraceSheet .tr-send{flex:1 1 auto;min-height:48px;border-radius:13px;font-family:inherit;',
      ' font-size:15.5px;letter-spacing:.05em;cursor:pointer;color:#1a1006;font-weight:600;border:none;',
      ' background:linear-gradient(90deg,#ffd479,#ffb066);box-shadow:0 6px 20px rgba(255,212,121,0.22);}',
      '#dvTraceSheet .tr-send:active{transform:scale(0.985);}',
      '#dvTraceSheet .tr-send:disabled{opacity:0.4;pointer-events:none;filter:grayscale(0.4);}',
      '#dvTraceSheet .tr-hint{font-size:12px;color:rgba(206,224,255,0.5);font-style:italic;',
      ' margin-top:8px;line-height:1.45;}',

      // ── the list (both roles read this) ────────────────────────────────────
      '#dvTraceSheet .tr-list{display:flex;flex-direction:column;gap:8px;}',
      '#dvTraceSheet .tr-row{display:flex;align-items:flex-start;gap:11px;padding:11px 12px;border-radius:13px;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);',
      ' border-left:3px solid var(--tc,#ffd479);}',
      '#dvTraceSheet .tr-row.mine{border-color:rgba(255,212,121,0.3);background:rgba(255,212,121,0.05);}',
      '#dvTraceSheet .tr-mark{flex:0 0 auto;width:30px;height:30px;border-radius:50%;display:flex;',
      ' align-items:center;justify-content:center;font-size:15px;color:var(--tc,#ffd479);',
      ' background:rgba(255,255,255,0.06);}',
      // The text column. min-width:0 is what lets a 140-char sentence WRAP
      // inside the row instead of widening it past the sheet (the flex-child
      // overflow trap the no-collision law exists to catch).
      '#dvTraceSheet .tr-text{flex:1 1 auto;min-width:0;}',
      '#dvTraceSheet .tr-who{font-size:14.5px;color:#eaf3ff;display:flex;align-items:baseline;gap:7px;}',
      // a 40-char name clips inside its own line, never widening the row
      '#dvTraceSheet .tr-name{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvTraceSheet .tr-when{flex:0 0 auto;font-size:11.5px;color:rgba(206,224,255,0.45);}',
      // The words a stranger wrote. overflow-wrap kills the one string that can
      // still break a flex row: 140 unbroken characters with no space in them.
      '#dvTraceSheet .tr-said{font-size:13.5px;line-height:1.5;color:rgba(220,231,255,0.78);',
      ' margin-top:3px;overflow-wrap:anywhere;word-break:break-word;font-style:italic;}',
      '#dvTraceSheet .tr-acts{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;}',
      '#dvTraceSheet .tr-act{min-height:36px;padding:0 12px;border-radius:10px;font-family:inherit;font-size:12.5px;',
      ' cursor:pointer;color:rgba(206,224,255,0.75);background:rgba(255,255,255,0.05);',
      ' border:1px solid rgba(255,255,255,0.1);}',
      '#dvTraceSheet .tr-act.out{color:rgba(255,150,150,0.8);border-color:rgba(255,120,120,0.24);}',
      '#dvTraceSheet .tr-empty{padding:26px 10px;text-align:center;color:rgba(206,224,255,0.5);',
      ' font-style:italic;font-size:14.5px;line-height:1.55;}',
      '#dvTraceSheet .tr-sec{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;',
      ' color:rgba(159,220,255,0.55);margin:4px 0 8px;}',

      // ── THE DISCOVERY — the owner's arrival moment ─────────────────────────
      // The ONE overlay this file adds, and the sanctioned kind: a true modal on
      // its OWN scrim, centred with flex (never a transform against counted
      // offsets), dismissible three ways. z-order sits at the homecoming's band
      // (1610/1620) — but it can never coincide with the homecoming, because
      // that fires on the vigil's `living.homecoming` and this defers behind it
      // by design (see showFound's delay + the whHome guard).
      '#trFoundWrap{position:fixed;inset:0;z-index:1610;display:none;align-items:center;justify-content:center;',
      ' padding:max(16px,env(safe-area-inset-top,16px)) max(16px,env(safe-area-inset-right,16px))',
      ' max(16px,env(safe-area-inset-bottom,16px)) max(16px,env(safe-area-inset-left,16px));',
      ' background:rgba(3,5,10,0.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);',
      ' opacity:0;transition:opacity .45s ease;}',
      '#trFoundWrap.show{display:flex;opacity:1;}',
      '#trFoundCard{position:relative;z-index:1620;width:100%;max-width:min(380px,calc(100vw - 32px));',
      ' max-height:calc(100dvh - 32px);max-height:calc(100vh - 32px);',
      ' display:flex;flex-direction:column;overflow:hidden;',
      ' background:rgba(10,14,22,0.96);border:1px solid rgba(255,212,121,0.32);border-radius:22px;',
      ' box-shadow:0 24px 80px rgba(0,0,0,0.7),0 0 60px rgba(255,212,121,0.09);',
      ' font-family:"Cormorant Garamond",Georgia,serif;color:#f3ead9;',
      ' transform:translateY(14px) scale(0.97);transition:transform .45s cubic-bezier(.22,1,.36,1);}',
      '#trFoundWrap.show #trFoundCard{transform:translateY(0) scale(1);}',
      '#trFoundCard .fd-body{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;',
      ' overscroll-behavior:contain;padding:26px 22px 8px;text-align:center;}',
      '#trFoundCard .fd-glyph{font-size:38px;line-height:1;color:#ffd479;',
      ' text-shadow:0 0 30px rgba(255,212,121,0.6);animation:trEmber 3.4s ease-in-out infinite;}',
      '@keyframes trEmber{0%,100%{opacity:0.86;transform:scale(1);}50%{opacity:1;transform:scale(1.06);}}',
      '#trFoundCard .fd-kicker{margin-top:12px;font-size:11px;letter-spacing:.19em;text-transform:uppercase;',
      ' color:rgba(255,212,121,0.66);}',
      '#trFoundCard .fd-h{margin-top:7px;font-size:24px;line-height:1.25;color:#fff6e6;}',
      '#trFoundCard .fd-list{margin-top:16px;display:flex;flex-direction:column;gap:9px;text-align:left;}',
      '#trFoundCard .fd-one{padding:11px 13px;border-radius:13px;background:rgba(255,212,121,0.07);',
      ' border:1px solid rgba(255,212,121,0.2);}',
      '#trFoundCard .fd-who{font-size:14.5px;color:#fff6e6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#trFoundCard .fd-said{font-size:13.5px;line-height:1.5;color:rgba(255,226,160,0.88);margin-top:3px;',
      ' font-style:italic;overflow-wrap:anywhere;word-break:break-word;}',
      '#trFoundCard .fd-foot{flex:0 0 auto;padding:12px 22px max(18px,env(safe-area-inset-bottom,18px));',
      ' display:flex;flex-direction:column;gap:8px;}',
      '#trFoundCard .fd-go{width:100%;min-height:50px;border-radius:14px;font-family:inherit;',
      ' font-size:16px;letter-spacing:.05em;cursor:pointer;color:#1a1006;font-weight:600;border:none;',
      ' background:linear-gradient(90deg,#ffd479,#ffb066);box-shadow:0 6px 24px rgba(255,212,121,0.26);}',
      '#trFoundCard .fd-go:active{transform:scale(0.985);}',
      '@media(max-height:520px){#trFoundCard .fd-body{padding:16px 18px 6px;}',
      ' #trFoundCard .fd-glyph{font-size:26px;}#trFoundCard .fd-h{font-size:19px;}}'
    ].join('');
    document.head.appendChild(s);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE SHEET
  // ═══════════════════════════════════════════════════════════════════════════
  var _sheet = null, _glyph = 'lantern', _sending = false;

  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var el = document.createElement('div');
    el.className = 'dv-sheet'; el.id = 'dvTraceSheet';
    // STATIC MARKUP ONLY. Every stranger-authored string enters later through
    // textContent — there is no template literal anywhere in this file that a
    // name or a sentence is interpolated into.
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the lanterns<small id="trSub">who has stood here</small></div>' +
        '<button class="dv-x" id="trX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body">' +
        '<div class="tr-compose" id="trCompose" style="display:none">' +
          '<div class="tr-glyphs" id="trGlyphs"></div>' +
          '<textarea class="tr-words" id="trWords" maxlength="140" rows="2" ' +
            'placeholder="leave a word, or leave only the light…"></textarea>' +
          '<div class="tr-foot">' +
            '<span class="tr-count" id="trCount">0/140</span>' +
            '<button class="tr-send" id="trSend">set it down</button>' +
          '</div>' +
          '<div class="tr-hint" id="trHint"></div>' +
        '</div>' +
        '<div class="tr-sec" id="trSec">standing here</div>' +
        '<div class="tr-list" id="trList"></div>' +
      '</div>';
    document.body.appendChild(el);
    _sheet = el;

    el.querySelector('#trX').onclick = close;

    var gr = el.querySelector('#trGlyphs');
    GLYPHS.forEach(function (g) {
      var b = document.createElement('button');
      b.className = 'tr-g' + (g.k === _glyph ? ' on' : '');
      b.setAttribute('data-g', g.k);
      b.setAttribute('aria-label', g.label);
      b.title = g.label;
      b.textContent = g.s;
      b.onclick = function () {
        _glyph = g.k;
        gr.querySelectorAll('.tr-g').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      };
      gr.appendChild(b);
    });

    var ta = el.querySelector('#trWords'), ct = el.querySelector('#trCount');
    ta.addEventListener('input', function () {
      var n = ta.value.length;
      ct.textContent = n + '/' + MAX_CHARS;
      ct.classList.toggle('over', n >= MAX_CHARS);
    });
    el.querySelector('#trSend').onclick = send;

    grip(el);
    return el;
  }

  // grip-to-dismiss, matching the other sheets exactly (one gesture everywhere)
  function grip(sheet) {
    var g = sheet.querySelector('.dv-grip'); if (!g) return;
    var y0 = 0, dy = 0, dragging = false;
    function start(e) { dragging = true; dy = 0; y0 = (e.touches ? e.touches[0].clientY : e.clientY); sheet.style.transition = 'none'; }
    function move(e) {
      if (!dragging) return;
      dy = Math.max(0, (e.touches ? e.touches[0].clientY : e.clientY) - y0);
      sheet.style.transform = 'translateY(' + dy + 'px)';
    }
    function end() {
      if (!dragging) return; dragging = false; sheet.style.transition = '';
      sheet.style.transform = '';
      if (dy > 90) { close(); }
    }
    g.addEventListener('touchstart', start, { passive: true });
    g.addEventListener('touchmove', move, { passive: true });
    g.addEventListener('touchend', end);
    g.addEventListener('mousedown', function (e) {
      start(e);
      var mm = function (ev) { move(ev); };
      var mu = function () { end(); removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); };
      addEventListener('mousemove', mm); addEventListener('mouseup', mu);
    });
  }

  function open() {
    if (!enabled()) return;
    // openSheet is the ONLY sanctioned way up — it evicts the star-map, the
    // agent panel and the court first, so two sheets can never share pixels.
    var h = hud();
    if (h && h.openSheet) {
      h.openSheet('traces', function () { build(); _sheet.classList.add('open'); render(); });
    } else {
      build(); _sheet.classList.add('open'); render();
    }
    // ask the server for the live list — world:state carried one at arrival, but
    // someone may have set a light down since.
    try { world().send({ t: 'world:traces' }); } catch (_) {}
  }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — the list, and the composer when we're a guest somewhere
  // ═══════════════════════════════════════════════════════════════════════════
  function render() {
    if (!_sheet) return;
    var w = world();
    var canTrace = false;
    try { canTrace = !!(w && w.canTrace && w.canTrace()); } catch (_) {}
    var list = [];
    try { list = (w && w.traces) ? w.traces() : []; } catch (_) {}

    var compose = _sheet.querySelector('#trCompose');
    compose.style.display = canTrace ? 'block' : 'none';
    _sheet.querySelector('#trSub').textContent = canTrace
      ? 'you are a guest here — leave a light'
      : 'who has stood in your clearing';
    _sheet.querySelector('#trHint').textContent = canTrace
      ? 'one lantern per world. leaving another moves yours — it never adds a second.'
      : '';

    var sec = _sheet.querySelector('#trSec');
    sec.textContent = list.length
      ? (list.length === 1 ? '1 light standing here' : list.length + ' lights standing here')
      : 'standing here';

    var box = _sheet.querySelector('#trList');
    box.innerHTML = '';
    if (!list.length) {
      var e = document.createElement('div');
      e.className = 'tr-empty';
      e.textContent = canTrace
        ? 'nobody has left a light here yet. be the first.'
        : 'no one has been here yet. the star-map is how they find you.';
      box.appendChild(e);
      return;
    }
    // The owner may put a light out; a visitor may walk to one. Both are built
    // node-by-node so no stranger string is ever concatenated into markup.
    var owner = !canTrace;
    list.forEach(function (t) { box.appendChild(row(t, owner)); });
  }

  function row(t, owner) {
    var el = document.createElement('div');
    el.className = 'tr-row';
    var g = GLYPHS.filter(function (x) { return x.k === t.glyph; })[0] || GLYPHS[0];

    var mark = document.createElement('div');
    mark.className = 'tr-mark';
    mark.textContent = g.s;

    var text = document.createElement('div');
    text.className = 'tr-text';

    var who = document.createElement('div');
    who.className = 'tr-who';
    var nm = document.createElement('span');
    nm.className = 'tr-name';
    nm.textContent = t.who || 'a traveler';        // ← stranger string, as TEXT
    var wn = document.createElement('span');
    wn.className = 'tr-when';
    wn.textContent = ago(t.at);
    who.appendChild(nm); who.appendChild(wn);
    text.appendChild(who);

    if (t.words) {
      var sd = document.createElement('div');
      sd.className = 'tr-said';
      sd.textContent = '"' + t.words + '"';        // ← stranger string, as TEXT
      text.appendChild(sd);
    }

    var acts = document.createElement('div');
    acts.className = 'tr-acts';
    var go = document.createElement('button');
    go.className = 'tr-act';
    go.textContent = 'walk to it';
    go.onclick = function () { walkTo(t); };
    acts.appendChild(go);
    if (owner) {
      var out = document.createElement('button');
      out.className = 'tr-act out';
      out.textContent = 'put it out';
      out.onclick = function () {
        // ASK, then wait for the world to answer. We do NOT remove the row here:
        // the server re-checks ownership and may refuse, and a row that vanishes
        // optimistically would tell the owner a lie they'd only catch on reload.
        // The truth arrives as world:trace:gone (the mesh dies, the list
        // re-renders) or as world:err (the button comes back and says why).
        out.disabled = true;
        out.textContent = 'putting it out…';
        _pendingOut = t.id;
        try { world().removeTrace(t.id); } catch (_) {}
        // and never strand the control if the answer never comes
        setTimeout(function () {
          if (!out.isConnected) return;
          out.disabled = false; out.textContent = 'put it out';
        }, 4000);
      };
      acts.appendChild(out);
    }
    text.appendChild(acts);

    el.appendChild(mark); el.appendChild(text);
    return el;
  }

  // Turn the player toward a lantern and close the sheet, so the world itself is
  // what they read it in. We never seize the camera (the camera-mode contract is
  // the player's), we only point them at it.
  function walkTo(t) {
    close();
    try {
      var w = world();
      if (w && w.faceTrace) w.faceTrace(t.id);
    } catch (_) {}
    toast((t.who || 'a traveler') + (t.words ? ' — "' + t.words + '"' : ' left this light.'));
  }

  function send() {
    if (_sending) return;
    var ta = _sheet.querySelector('#trWords');
    var words = (ta.value || '').slice(0, MAX_CHARS);
    _sending = true;
    var btn = _sheet.querySelector('#trSend');
    btn.disabled = true; btn.textContent = 'setting it down…';
    try { world().leaveTrace(words, _glyph); } catch (_) {}
    // The server answers with world:trace:ok (or world:err). Either way the
    // button comes back — a send that silently strands the UI is worse than one
    // that failed loudly.
    setTimeout(function () {
      _sending = false;
      if (!_sheet) return;
      btn.disabled = false; btn.textContent = 'set it down';
    }, 4000);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE DISCOVERY — "someone came while you were gone"
  // ═══════════════════════════════════════════════════════════════════════════
  var _found = null;
  function showFound(found) {
    if (!enabled() || !found || !found.traces || !found.traces.length) return;
    injectStyles();
    if (!_found) {
      _found = document.createElement('div');
      _found.id = 'trFoundWrap';
      _found.innerHTML =
        '<div id="trFoundCard">' +
          '<div class="fd-body">' +
            '<div class="fd-glyph">✦</div>' +
            '<div class="fd-kicker">the clearing was not empty</div>' +
            '<div class="fd-h" id="trFoundH"></div>' +
            '<div class="fd-list" id="trFoundList"></div>' +
          '</div>' +
          '<div class="fd-foot"><button class="fd-go" id="trFoundGo">go and see</button></div>' +
        '</div>';
      document.body.appendChild(_found);
      _found.addEventListener('click', function (e) { if (e.target === _found) hideFound(); });
      _found.querySelector('#trFoundGo').onclick = function () { hideFound(); setTimeout(open, 420); };
    }
    _found.querySelector('#trFoundH').textContent = found.line || 'someone came while you were gone.';
    var list = _found.querySelector('#trFoundList');
    list.innerHTML = '';
    found.traces.slice(0, 4).forEach(function (t) {
      var one = document.createElement('div'); one.className = 'fd-one';
      var who = document.createElement('div'); who.className = 'fd-who';
      who.textContent = (t.who || 'a traveler') + ' · ' + ago(t.at);   // ← as TEXT
      one.appendChild(who);
      if (t.words) {
        var sd = document.createElement('div'); sd.className = 'fd-said';
        sd.textContent = '"' + t.words + '"';                            // ← as TEXT
        one.appendChild(sd);
      }
      list.appendChild(one);
    });
    _found.style.display = 'flex';
    try { requestAnimationFrame(function () { _found.classList.add('show'); }); }
    catch (_) { _found.classList.add('show'); }
    addEventListener('keydown', _key);
  }
  function _key(e) { if (e.key === 'Escape') hideFound(); }
  function hideFound() {
    if (!_found) return;
    _found.classList.remove('show');
    removeEventListener('keydown', _key);
    setTimeout(function () { try { if (_found) _found.style.display = ''; } catch (_) {} }, 480);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WIRING
  // ═══════════════════════════════════════════════════════════════════════════
  W.addEventListener('vint:world-state', function (e) {
    var d = (e && e.detail) || {};
    if (isOpen()) render();
    updateLauncher();
    // THE ARRIVAL MOMENT. Deferred well behind the vigil's homecoming so the two
    // modals can never be up together — the homecoming shows at ~900ms and owns
    // the same z-band, so this waits for it to be gone AND checks. Two overlays
    // on one scrim is the cardinal collision; this is the guard, not a hope.
    if (d.found && d.found.traces && d.found.traces.length) {
      setTimeout(function () {
        var home = document.getElementById('whHomeWrap');
        if (home && home.classList.contains('show')) {
          // the homecoming is up — wait for it, then take our turn
          var beat = setInterval(function () {
            var h = document.getElementById('whHomeWrap');
            if (!h || !h.classList.contains('show')) { clearInterval(beat); showFound(d.found); }
          }, 400);
          setTimeout(function () { clearInterval(beat); }, 30000);
          return;
        }
        showFound(d.found);
      }, 1500);
    }
  });
  W.addEventListener('vint:world-traces', function () { if (isOpen()) render(); });
  W.addEventListener('vint:world-trace', function () { if (isOpen()) render(); updateLauncher(); });
  W.addEventListener('vint:world-trace-ok', function () {
    toast('your light stands in this world now.');
    if (_sheet) { var ta = _sheet.querySelector('#trWords'); if (ta) { ta.value = ''; _sheet.querySelector('#trCount').textContent = '0/140'; } }
    if (isOpen()) render();
    updateLauncher();
  });
  W.addEventListener('vint:world-trace-gone', function () { if (isOpen()) render(); updateLauncher(); });
  W.addEventListener('vint:world-travel', function () {
    // the lanterns belonged to the world we left; the new world's arrive with
    // its world:state. Close rather than show a stale list from somewhere else.
    if (isOpen()) close();
    setTimeout(updateLauncher, 1200);
  });
  W.addEventListener('vint:world-err', function (e) {
    var c = (e && e.detail && e.detail.code) || '';

    // ── THE REMOVAL's refusals ────────────────────────────────────────────────
    // world-server.js answers a failed world:trace:remove with the module's BARE
    // code — 'not-yours' straight from the ownWorld guard, or 'bad-id' /
    // 'unavailable' passed through from traces.remove(). It does NOT carry the
    // 'trace-' prefix that the LEAVE path adds, so filtering on that prefix
    // alone made every failed removal a silent no-op — the button sat spinning
    // and the owner was told nothing. These are matched explicitly, and only
    // while a removal of ours is actually in flight, so we can never speak for
    // an unrelated module's error of the same name.
    if (_pendingOut != null && (c === 'not-yours' || c === 'bad-id' || c === 'unavailable')) {
      _pendingOut = null;
      if (isOpen()) render();   // restores every 'put it out' button to rest
      toast(
        c === 'not-yours' ? 'only the world\'s keeper can put a light out here.'
        : c === 'bad-id'  ? 'that light is already gone.'
        : 'the world couldn\'t reach that light. try again in a moment.'
      );
      return;
    }

    // ── THE LEAVING's refusals ────────────────────────────────────────────────
    if (c.indexOf('trace-') !== 0) return;
    _sending = false;
    if (_sheet) { var b = _sheet.querySelector('#trSend'); if (b) { b.disabled = false; b.textContent = 'set it down'; } }
    toast(
      c === 'trace-own-world' ? 'this is your own clearing — your light is already here.'
      : c === 'trace-rate'    ? 'you have left a lot of lights lately. rest a moment.'
      : c === 'trace-no-world'? 'the shared hub belongs to everyone — lights are left in a person\'s world.'
      : c === 'trace-no-visitor' ? 'sign in to leave a light in someone\'s world.'
      : 'the world could not hold that light. try again in a moment.'
    );
  });

  // ── THE LAUNCHER ────────────────────────────────────────────────────────────
  // Placed through DirverseHUD.addLauncher so the RAIL allocates its slot and
  // re-measures. This file pins nothing and counts no offsets, which is the only
  // way a new button can be added without risking the band another one is in.
  var _btn = null, _waits = 0;
  function mountLauncher() {
    if (!enabled()) return;
    var h = hud();
    if (!h || !h.addLauncher) { if (_waits++ < 25) setTimeout(mountLauncher, 90); return; }
    _btn = h.addLauncher('dvTraceBtn', 'lanterns', '✧', open);
    try { h.registerSheet('traces', isOpen, close); } catch (_) {}
    updateLauncher();
  }
  // The launcher is only meaningful where there is something to leave or find,
  // so it hides in the shared hub (which belongs to everyone and holds no
  // lanterns) and appears the moment you're standing in a person's world.
  function updateLauncher() {
    if (!_btn) return;
    var show = false;
    try {
      var w = world();
      var here = (w && w.currentWorldId) ? String(w.currentWorldId()) : 'universe';
      var n = (w && w.traces) ? w.traces().length : 0;
      var can = !!(w && w.canTrace && w.canTrace());
      show = here !== 'universe' && (can || n > 0);
    } catch (_) {}
    _btn.style.display = show ? 'flex' : 'none';
    try { if (hud() && hud().relayout) hud().relayout(); } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
  else mountLauncher();

  W.VintTraces = {
    open: open, close: close, enabled: enabled,
    render: render, showFound: showFound, isOpen: isOpen,
    // Re-evaluate whether the launcher should be showing. Already called on
    // every world:state and trace event; exported because the one-sheet proof
    // has to put the page in a world where this button legitimately appears
    // before it can tap it, and asking the module to re-check is honest where
    // reaching in to set display would be faking the thing under test.
    refresh: updateLauncher
  };
})();
