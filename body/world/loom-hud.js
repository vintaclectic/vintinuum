// loom-hud.js — THE LOOM, made REACHABLE (AETHERHOLD, 2026-08-25, task BUTHM4K)
//
// ════════════════════════════════════════════════════════════════════════════
// THE OTHER HALF OF THE STRAND FAMINE
//
// Every one of the fifteen PLACE_COST entries costs `strand`. The starter hand
// grants strand:3 once. So a player placed three cheap pieces and was then
// PERMANENTLY unable to build — forever, no matter how much echo or lumen they
// piled up. Lord Vinta reported it exactly as it feels from inside: "building
// does not work at all when tried, even with enough harvest points."
//
// world/loom.js fixed the ECONOMY half: echo → strand by an honest conversion,
// plus a 22% filament drop and a deterministic ember kindle. It shipped. And
// the game did not get one inch better, because NOTHING IN THE CLIENT EVER
// SENT `world:weave`. Not one line. The faucet was plumbed, pressure-tested and
// left behind a wall with no tap on it.
//
// That is the more interesting bug, and it is worth naming plainly: a server
// verb with no surface is indistinguishable from a verb that does not exist.
// The player cannot read your source. If they cannot press it, you did not
// ship it. THIS FILE IS THE TAP.
//
// ── WHAT IT OWES THE PLAYER, in order ─────────────────────────────────────
//   1. THE DEAD END, NAMED. A player at 0 strand is not confused, they are
//      STUCK, and they do not know why. The loom opens by saying exactly what
//      is wrong and exactly what fixes it — in the one place they will look
//      after a build fails.
//   2. THE RATE, FROM THE SERVER. Every number shown here came off the state
//      frame's `loom` block (loom.ratesFor). This file computes NO conversion
//      rate, ever. If the server retunes ECHO_PER_STRAND the UI follows in the
//      same frame, and a dim clearing's worse rate is the server's word.
//   3. THE ARITHMETIC BEFORE THE SPEND. What you have, what it costs, what
//      you will hold after — shown BEFORE you press, so weaving is a decision
//      and never a surprise.
//   4. THE TENSION, HONESTLY. Echo is contested: it is also what the refinery
//      eats for lumen. So the loom SAYS what a weave costs you at the refinery.
//      A shop that hides the opportunity cost of its own product is the
//      predatory kind; this one states it and lets the player choose.
//
// ── RETENTION DOCTRINE (all seven, since this is a new surface) ───────────
//   1 GENEROUS (Aria) — it exists to UNBLOCK, not to upsell. "Weave all" is
//     one tap and defaults to everything you can afford, because that is the
//     gesture people actually make. Nothing here is sold; nothing is timed.
//   2 INVESTMENT LOOP (Helios) — harvest → weave → build → standing → a wider
//     palette. This is the middle link that was missing, so the entire loop
//     was open-circuit. Closing it is what makes yesterday's echo into
//     tomorrow's clearing.
//   3 TIER (Frugal-Max) — FREE, deliberately and permanently. This is the
//     core loop; charging for the ability to build at all would be the
//     resented kind of monetization. It converts by making the world worth
//     living in, which is what the paid tiers are then about.
//   4 AESTHETICALLY DENSE (Lunex) — three numbers and one sentence. The whole
//     economy in a glance, no filler.
//   5 OPEN LOOP (Morrison) — the ember. It is visible from the first minute
//     and it is weeks away, so there is always a named thing you are working
//     toward, sitting one tab away from where you already are.
//   6 FLAGGED + MEASURED (Atlas) — feature-flagged 'world_loom' (?loom=0),
//     killable in 30s with no deploy. Every refusal is the server's own.
//   7 MORE ALIVE (Yuna) — a strand is WOVEN, never found. The verb is a craft
//     the player performs on their own world, not a currency ticking up.
//
// ── NO-COLLISION LAW ──────────────────────────────────────────────────────
// This surface adds NO fixed element of its own. Not one. It borrows the two
// extension points the rail already owns and both of them MEASURE:
//   · DirverseHUD.addLauncher() puts the ⧉ button INSIDE #dvRail in normal
//     flow, allocated a slot by the thing that measures the rail.
//   · DirverseHUD.registerSheet() + openSheet() enter it in the
//     one-open-at-a-time registry, so raising the loom CLOSES the star-map,
//     the agent panel, the court, the reckoning and the lanterns rather than
//     mounting on their identical pixels.
// The sheet reuses .dv-sheet/.dv-body verbatim — height-capped, internally
// scrolling, safe-area padded. Content yields; the container never grows. At
// 320px the two action buttons are a single stacked column (they only sit side
// by side once there is room for two 44px targets plus the gap), so nothing
// can ever be clipped or overlapped at any width.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintLoom) return;

  var W = window;
  function world() { return W.VintinuumWorld; }
  function hud() { return W.DirverseHUD; }
  function toast(m) { try { if (hud() && hud().toast) hud().toast(m); } catch (_) {} }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  // ── FEATURE FLAG — 'world_loom'. Killable in 30s, no deploy. ───────────────
  //   ?loom=0 / ?loom=1  ·  localStorage vint:flag:world_loom = '0' | '1'
  var _flag = null;
  function enabled() {
    if (_flag !== null) return _flag;
    _flag = true;
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('loom') === '0') _flag = false;
      else if (q.get('loom') === '1') _flag = true;
      else if (localStorage.getItem('vint:flag:world_loom') === '0') _flag = false;
    } catch (_) {}
    return _flag;
  }

  // ── SERVER TRUTH, MIRRORED — never derived ────────────────────────────────
  // _rates is whatever the last world:state's `loom` block said. If it is null
  // (a legacy server that predates the loom) this surface says so honestly and
  // offers nothing, rather than inventing a rate it cannot honour.
  var _rates = null;    // { echoPerStrand, filamentChance, emberChance, kindle, state }
  var _res = null;      // the resident block: lumen, echo, inventory, standing
  var _sheet = null, _btn = null, _busy = false;

  function inv() { return (_res && _res.inventory) || {}; }
  function held(item) { return num(inv()[item], 0); }
  function echo() { return num(_res && _res.echo, 0); }
  function per() { return Math.max(1, num(_rates && _rates.echoPerStrand, 4)); }
  function affordable() { return Math.floor(echo() / per()); }

  function pct(p) { return Math.round(num(p, 0) * 100); }

  function injectStyles() {
    if (document.getElementById('vint-loom-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-loom-styles';
    // Scoped entirely under #dvLoomSheet. The sheet scaffold
    // (.dv-sheet/.dv-body/.dv-grip/.dv-head) is inherited from dirverse-hud on
    // purpose: one definition of the bottom-sheet box means this surface can
    // never disagree with its siblings about how tall a sheet may be.
    s.textContent = [
      // ── the dead-end banner: the sentence a stuck player needs ────────────
      '#dvLoomSheet .lm-stuck{display:none;padding:12px 13px;border-radius:13px;margin-bottom:13px;',
      ' background:rgba(255,176,102,0.10);border:1px solid rgba(255,176,102,0.30);',
      ' font-size:13.5px;line-height:1.5;color:#ffd9b0;}',
      '#dvLoomSheet .lm-stuck.show{display:block;}',
      '#dvLoomSheet .lm-stuck b{color:#ffd479;}',

      // ── the purse: three numbers, tabular so they never jitter ────────────
      '#dvLoomSheet .lm-purse{display:flex;gap:8px;margin-bottom:13px;}',
      '#dvLoomSheet .lm-p{flex:1 1 0;min-width:0;padding:10px 8px;border-radius:12px;text-align:center;',
      ' background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.09);}',
      '#dvLoomSheet .lm-pn{font-size:19px;font-weight:600;color:#eaf3ff;font-variant-numeric:tabular-nums;',
      ' line-height:1.2;overflow:hidden;text-overflow:ellipsis;}',
      '#dvLoomSheet .lm-pl{font-size:11px;letter-spacing:.06em;color:rgba(206,224,255,0.5);margin-top:3px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvLoomSheet .lm-p.hot .lm-pn{color:#ffd479;}',

      // ── the rate line, straight from the server ──────────────────────────
      '#dvLoomSheet .lm-rate{font-size:13px;line-height:1.55;color:rgba(206,224,255,0.72);',
      ' padding:11px 12px;border-radius:12px;background:rgba(255,255,255,0.035);',
      ' border:1px solid rgba(255,255,255,0.07);margin-bottom:13px;}',
      '#dvLoomSheet .lm-rate b{color:#9fdcff;}',
      '#dvLoomSheet .lm-dim{margin-top:7px;font-size:12.5px;color:#ffc79a;font-style:italic;display:none;}',
      '#dvLoomSheet .lm-dim.show{display:block;}',

      // ── the dial: how many to weave ──────────────────────────────────────
      '#dvLoomSheet .lm-sec{font-size:11.5px;letter-spacing:.10em;text-transform:uppercase;',
      ' color:rgba(206,224,255,0.42);margin:0 0 9px;}',
      '#dvLoomSheet .lm-dial{display:flex;align-items:center;gap:10px;margin-bottom:11px;}',
      // 44px minimum tap targets, always (CLAUDE.md UI law)
      '#dvLoomSheet .lm-step{flex:0 0 auto;width:46px;height:46px;border-radius:13px;cursor:pointer;',
      ' font-family:inherit;font-size:21px;line-height:1;color:#dce7ff;',
      ' background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);',
      ' display:flex;align-items:center;justify-content:center;}',
      '#dvLoomSheet .lm-step:disabled{opacity:0.3;pointer-events:none;}',
      '#dvLoomSheet .lm-amt{flex:1 1 auto;min-width:0;text-align:center;}',
      '#dvLoomSheet .lm-an{font-size:27px;font-weight:600;color:#ffd479;line-height:1.1;',
      ' font-variant-numeric:tabular-nums;}',
      '#dvLoomSheet .lm-al{font-size:11.5px;color:rgba(206,224,255,0.5);margin-top:2px;}',

      // ── the arithmetic, BEFORE the spend ─────────────────────────────────
      '#dvLoomSheet .lm-math{font-size:12.5px;line-height:1.6;color:rgba(206,224,255,0.62);',
      ' padding:10px 12px;border-radius:12px;background:rgba(159,220,255,0.06);',
      ' border:1px solid rgba(159,220,255,0.16);margin-bottom:12px;}',
      '#dvLoomSheet .lm-math b{color:#eaf3ff;font-variant-numeric:tabular-nums;}',
      '#dvLoomSheet .lm-cost{color:rgba(206,224,255,0.5);font-style:italic;}',

      // ── the actions. NO-COLLISION: one column by default, two only when
      //    there is genuinely room for two 44px targets plus the gap. ───────
      '#dvLoomSheet .lm-acts{display:flex;flex-direction:column;gap:9px;}',
      '@media (min-width:380px){#dvLoomSheet .lm-acts{flex-direction:row;}',
      ' #dvLoomSheet .lm-acts>button{flex:1 1 0;min-width:0;}}',
      '#dvLoomSheet .lm-go{min-height:50px;border-radius:13px;font-family:inherit;font-size:15.5px;',
      ' letter-spacing:.04em;cursor:pointer;color:#1a1006;font-weight:600;border:none;',
      ' background:linear-gradient(90deg,#ffd479,#ffb066);box-shadow:0 6px 20px rgba(255,212,121,0.22);',
      ' padding:0 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvLoomSheet .lm-go:active{transform:scale(0.985);}',
      '#dvLoomSheet .lm-go:disabled{opacity:0.4;pointer-events:none;filter:grayscale(0.4);}',
      '#dvLoomSheet .lm-alt{min-height:50px;border-radius:13px;font-family:inherit;font-size:14.5px;',
      ' cursor:pointer;color:#dce7ff;background:rgba(255,255,255,0.06);',
      ' border:1px solid rgba(255,255,255,0.13);padding:0 12px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#dvLoomSheet .lm-alt:disabled{opacity:0.35;pointer-events:none;}',

      // ── the ember: the open loop, stated plainly ─────────────────────────
      '#dvLoomSheet .lm-ember{margin-top:16px;padding-top:14px;',
      ' border-top:1px solid rgba(255,255,255,0.08);}',
      '#dvLoomSheet .lm-ework{font-size:12.5px;line-height:1.6;color:rgba(206,224,255,0.6);',
      ' margin-bottom:10px;}',
      '#dvLoomSheet .lm-ework b{color:#ff8a3d;}',

      // ── THE EARNED NUDGE, on the rail's own launcher ─────────────────────
      // Scoped to #lmBtn only, so it restyles NOTHING but our own button and
      // cannot leak onto a sibling launcher. It changes colour and breathes —
      // it does NOT change size, position, margin or padding, because the rail
      // measures its children and a growing launcher would push its neighbours.
      // A nudge must never move the furniture (no-collision).
      '#dvRail #lmBtn.urgent{background:rgba(255,212,121,0.16);border-color:rgba(255,212,121,0.5);',
      ' color:#ffe2a0;animation:lmPulse 2.4s ease-in-out infinite;}',
      '@keyframes lmPulse{0%,100%{box-shadow:0 0 0 rgba(255,212,121,0);}',
      ' 50%{box-shadow:0 0 14px rgba(255,212,121,0.35);}}',
      // honour the user's motion preference — a pulse is decoration, never info
      '@media (prefers-reduced-motion:reduce){#dvRail #lmBtn.urgent{animation:none;}}'
    ].join('');
    document.head.appendChild(s);
  }

  // ── the sheet ─────────────────────────────────────────────────────────────
  // STATIC MARKUP ONLY. Every number enters later through textContent; there is
  // no template literal in this file that a server value is interpolated into.
  function build() {
    if (_sheet) return _sheet;
    injectStyles();
    var el = document.createElement('div');
    el.className = 'dv-sheet'; el.id = 'dvLoomSheet';
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the loom<small id="lmSub">echo becomes strand</small></div>' +
        '<button class="dv-x" id="lmX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body">' +
        '<div class="lm-stuck" id="lmStuck"></div>' +
        '<div class="lm-purse">' +
          '<div class="lm-p"><div class="lm-pn" id="lmEcho">0</div><div class="lm-pl">echo</div></div>' +
          '<div class="lm-p hot"><div class="lm-pn" id="lmStrand">0</div><div class="lm-pl">strand</div></div>' +
          '<div class="lm-p"><div class="lm-pn" id="lmEmber">0</div><div class="lm-pl">ember</div></div>' +
        '</div>' +
        '<div class="lm-rate" id="lmRate">' +
          '<span id="lmRateT"></span>' +
          '<div class="lm-dim" id="lmDim"></div>' +
        '</div>' +
        '<div class="lm-sec">weave</div>' +
        '<div class="lm-dial">' +
          '<button class="lm-step" id="lmMinus" aria-label="fewer">−</button>' +
          '<div class="lm-amt">' +
            '<div class="lm-an" id="lmAmt">0</div>' +
            '<div class="lm-al" id="lmAmtL">strand</div>' +
          '</div>' +
          '<button class="lm-step" id="lmPlus" aria-label="more">+</button>' +
        '</div>' +
        '<div class="lm-math" id="lmMath"></div>' +
        '<div class="lm-acts">' +
          '<button class="lm-go" id="lmWeave">weave</button>' +
          '<button class="lm-alt" id="lmAll">weave all</button>' +
        '</div>' +
        '<div class="lm-ember">' +
          '<div class="lm-sec">the ember</div>' +
          '<div class="lm-ework" id="lmEwork"></div>' +
          '<button class="lm-alt" id="lmKindle">kindle an ember</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    _sheet = el;

    el.querySelector('#lmX').onclick = close;
    el.querySelector('#lmMinus').onclick = function () { setAmt(_amt - 1); };
    el.querySelector('#lmPlus').onclick = function () { setAmt(_amt + 1); };
    el.querySelector('#lmWeave').onclick = function () { weave(_amt); };
    el.querySelector('#lmAll').onclick = function () { weave(null); };   // null = all I can
    el.querySelector('#lmKindle').onclick = kindle;
    return el;
  }

  var _amt = 1;
  function setAmt(n) {
    var max = Math.max(1, affordable());
    _amt = Math.max(1, Math.min(max, Math.floor(num(n, 1))));
    render();
  }

  function open() {
    if (!enabled()) return;
    // openSheet is the ONLY sanctioned way up — it evicts every other sheet
    // first, so two full-width surfaces can never share pixels.
    var h = hud();
    if (h && h.openSheet) h.openSheet('loom', function () { build(); _sheet.classList.add('open'); afterOpen(); });
    else { build(); _sheet.classList.add('open'); afterOpen(); }
  }
  function afterOpen() {
    // default the dial to everything affordable — "weave what I can" is the
    // gesture people actually make, so it should already be dialled in.
    _amt = Math.max(1, affordable());
    render();
  }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    try { if (hud() && hud().syncSheets) hud().syncSheets(); } catch (_) {}
  }
  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  // ── RENDER — every number here came off the wire ──────────────────────────
  function render() {
    if (!_sheet) return;
    var t = function (id, v) {
      var n = _sheet.querySelector(id); if (n) n.textContent = v;
    };
    var e = echo(), st = held('strand'), em = held('ember'), p = per();
    t('#lmEcho', e); t('#lmStrand', st); t('#lmEmber', em);

    // ── the dead end, named ──────────────────────────────────────────────
    // A player at zero strand who has just been refused a placement is STUCK
    // and does not know why. This is the one place they will look, so this is
    // where the whole economy gets explained in two sentences.
    var stuck = _sheet.querySelector('#lmStuck');
    if (stuck) {
      var canWeave = affordable() > 0;
      if (st <= 0 && !canWeave) {
        stuck.textContent = 'You have no strand, and not enough echo to weave any. ' +
          'Everything you build costs strand — go strike a node (⛏ harvest) until you ' +
          'have ' + p + ' echo, then weave it here.';
        stuck.classList.add('show');
      } else if (st <= 0) {
        stuck.textContent = 'You have no strand — that is why building is refused. ' +
          'Weave some below and the palette opens right back up.';
        stuck.classList.add('show');
      } else {
        stuck.classList.remove('show');
      }
    }

    // ── the rate, verbatim from the server ───────────────────────────────
    var rt = _sheet.querySelector('#lmRateT');
    if (rt) {
      if (!_rates) {
        rt.textContent = 'This world has not told us its weaving rate yet — ' +
          'harvest once to wake the loom.';
      } else {
        rt.textContent = p + ' echo makes 1 strand. Nodes also give up a loose ' +
          'filament about ' + pct(_rates.filamentChance) + '% of the time, and an ' +
          'ember about ' + pct(_rates.emberChance) + '%.';
      }
    }
    // a dim clearing weaves loose — the server's word, not ours
    var dim = _sheet.querySelector('#lmDim');
    if (dim) {
      var s = _rates && _rates.state;
      if (s && s !== 'radiant' && s !== 'warm') {
        dim.textContent = 'The clearing is ' + s + ', so the loom runs loose — ' +
          'the same echo yields fewer strand until you tend it warm again.';
        dim.classList.add('show');
      } else dim.classList.remove('show');
    }

    // ── the dial + the arithmetic BEFORE the spend ───────────────────────
    var max = affordable();
    if (_amt > max) _amt = Math.max(1, max);
    t('#lmAmt', max > 0 ? _amt : 0);
    t('#lmAmtL', (max > 0 && _amt === 1) ? 'strand' : 'strand');

    var minus = _sheet.querySelector('#lmMinus'), plus = _sheet.querySelector('#lmPlus');
    if (minus) minus.disabled = (max <= 0 || _amt <= 1);
    if (plus) plus.disabled = (max <= 0 || _amt >= max);

    var math = _sheet.querySelector('#lmMath');
    if (math) {
      if (max <= 0) {
        math.textContent = 'You need ' + Math.max(0, p - e) + ' more echo before you can ' +
          'weave a single strand. One swing at a node pays a few.';
      } else {
        var spend = _amt * p;
        // THE HONEST OPPORTUNITY COST. Echo is contested — the refinery eats it
        // too — so we say what this weave costs at the OTHER exit. A surface
        // that hides the opportunity cost of its own product is the predatory
        // kind; this one states it and lets the player choose. 0.85 is the
        // server's REFINE_RATE; shown as "about" because the tier can cut it.
        var foregone = Math.round(spend * 0.85);
        math.textContent = 'Spend ' + spend + ' echo → get ' + _amt + ' strand. ' +
          'You would hold ' + (e - spend) + ' echo and ' + (held('strand') + _amt) + ' strand. ' +
          'That is about ' + foregone + ' lumen not refined.';
      }
    }

    var go = _sheet.querySelector('#lmWeave'), all = _sheet.querySelector('#lmAll');
    if (go) { go.disabled = _busy || max <= 0; go.textContent = max > 0 ? ('weave ' + _amt) : 'nothing to weave'; }
    if (all) { all.disabled = _busy || max <= 0; all.textContent = max > 1 ? ('weave all ' + max) : 'weave all'; }

    // ── the ember: the open loop ─────────────────────────────────────────
    var ew = _sheet.querySelector('#lmEwork'), kb = _sheet.querySelector('#lmKindle');
    var k = (_rates && _rates.kindle) || { strand: 8, echo: 40 };
    if (ew) {
      ew.textContent = 'An ember is the rare thing — only the beacon spends one, and a ' +
        'beacon is the one piece a stranger can see from the star map. You can wait for ' +
        'a node to give one up, or kindle one deliberately: ' + k.strand + ' strand and ' +
        k.echo + ' echo. Anyone can. Nobody does it by accident.';
    }
    if (kb) {
      var canKindle = held('strand') >= num(k.strand, 8) && e >= num(k.echo, 40);
      kb.disabled = _busy || !canKindle;
      kb.textContent = canKindle
        ? ('kindle an ember (' + k.strand + ' strand + ' + k.echo + ' echo)')
        : ('kindle an ember — need ' + k.strand + ' strand + ' + k.echo + ' echo');
    }
  }

  // ── THE VERBS. The server rules on every one; we only ask. ────────────────
  function weave(count) {
    var w = world();
    if (!w || !w.send) return;
    // A send that never reached the socket must not look like a success —
    // World.send returns false when the socket is not open.
    _busy = true; render();
    var sent = false;
    try { sent = w.send({ t: 'world:weave', count: count == null ? null : Math.floor(count) }); } catch (_) {}
    if (!sent) { _busy = false; render(); toast('the world is not listening right now — try again in a moment.'); return; }
    // released by the world:weave:ok / world:err that answers it, with a
    // timeout so a dropped reply can never leave the buttons dead forever.
    clearTimeout(_busyT); _busyT = setTimeout(function () { _busy = false; render(); }, 6000);
  }
  function kindle() {
    var w = world();
    if (!w || !w.send) return;
    _busy = true; render();
    var sent = false;
    try { sent = w.send({ t: 'world:kindle' }); } catch (_) {}
    if (!sent) { _busy = false; render(); toast('the world is not listening right now — try again in a moment.'); return; }
    clearTimeout(_busyT); _busyT = setTimeout(function () { _busy = false; render(); }, 6000);
  }
  var _busyT = null;

  // ── the launcher ──────────────────────────────────────────────────────────
  function mountLauncher() {
    if (!enabled() || _btn) return;
    var h = hud();
    if (!h || !h.addLauncher) { setTimeout(mountLauncher, 400); return; }  // rail not up yet
    // the urgent-nudge rule lives in our stylesheet, and the launcher can go
    // urgent long before the sheet is ever built — so inject now, not in build()
    injectStyles();
    try {
      _btn = h.addLauncher('lmBtn', 'loom', '⧉', open);
      if (h.registerSheet) h.registerSheet('loom', isOpen, close);
    } catch (_) {}
    updateLauncher();
  }

  // THE NUDGE, EARNED — the launcher glows ONLY when the player is genuinely
  // blocked (no strand) AND can actually do something about it (enough echo to
  // weave). A hint that fires when you can't act on it is nagging; one that
  // fires exactly when the answer is one tap away is help. It stops the instant
  // they hold strand again.
  function updateLauncher() {
    if (!_btn) return;
    try {
      var blocked = held('strand') <= 0 && affordable() > 0;
      _btn.classList.toggle('urgent', blocked);
      _btn.setAttribute('title', blocked ? 'you are out of strand — weave some' : 'the loom');
    } catch (_) {}
  }

  // ── WIRE TO THE WORLD ─────────────────────────────────────────────────────
  // Every value this surface shows arrives here, from the server, on the state
  // frame. There is no other source and no local cache of an economy number.
  W.addEventListener('vint:world-state', function (e) {
    var d = e.detail || {};
    if (d.resident) _res = d.resident;
    // `loom` absent = a server that predates the loom. Set null (never keep a
    // stale rate) so the surface says what it cannot prove instead of lying.
    _rates = d.loom || null;
    if (isOpen()) render();
    updateLauncher();
  });

  W.addEventListener('vint:world-weave', function (e) {
    var d = e.detail || {};
    _busy = false; clearTimeout(_busyT);
    var made = num(d.made, 0), spent = num(d.spent, 0);
    // Say BOTH numbers whenever the tier took a cut. An unexplained smaller
    // number is indistinguishable from a bug; a named one reads as stakes.
    toast('you wove ' + made + ' strand from ' + spent + ' echo' +
      (d.full != null && d.full > made ? ' — of ' + d.full + ', the clearing is ' + (d.state || 'dim') : '') + '.');
    if (isOpen()) render();
  });

  W.addEventListener('vint:world-kindle', function (e) {
    var d = e.detail || {};
    _busy = false; clearTimeout(_busyT);
    toast('an ember kindles in your hand. the beacon is one step closer.');
    if (isOpen()) render();
  });

  // Any refusal releases the buttons — world-hud speaks the words, this just
  // stops the surface sitting dead waiting for a reply that already came back.
  W.addEventListener('vint:world-err', function () {
    if (!_busy) return;
    _busy = false; clearTimeout(_busyT);
    if (isOpen()) render();
  });

  // THE HANDOFF — a build refused for want of strand should not make the player
  // hunt for the fix. world-hud already says "weave echo into strand at the
  // loom"; this makes that sentence one tap by raising the loom itself. It only
  // fires on need_strand/need_ember (never on any other refusal), and only when
  // no other sheet is up, so it can never yank a player out of something.
  W.addEventListener('vint:world-err', function (e) {
    var c = (e && e.detail && e.detail.code) || '';
    if (c !== 'need_strand' && c !== 'need_ember') return;
    if (!enabled() || isOpen()) return;
    try { if (hud() && hud().anySheetOpen && hud().anySheetOpen()) return; } catch (_) {}
    setTimeout(function () { try { open(); } catch (_) {} }, 700);   // after the toast lands
  });

  W.addEventListener('vint:world-travel', function () { if (isOpen()) close(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountLauncher, { once: true });
  else mountLauncher();

  W.VintLoom = {
    open: open, close: close, isOpen: isOpen, enabled: enabled,
    render: render, refresh: updateLauncher
  };
})();
