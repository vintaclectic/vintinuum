'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   THE COVENANTS, MADE LEGIBLE (AETHERHOLD, Vinta directive 2026-08-08)

   The server half of this feature (vintinuum-api/world/factions.js) is built on
   one promise: violence is a property of GROUND, not of a person, and every death
   was preceded by a deliberate walk onto ground that pays more. That promise is
   only kept if the player can ALWAYS SEE which ground they are on. A safety
   guarantee the player cannot read is not a safety guarantee — it is a surprise.

   So the load-bearing surface here is not the faction sheet. It is the SOIL BAND:
   one small always-visible strip that says, in plain words, what this ground is
   and what it can cost you right now. Three states, and the player never has to
   ask which one they are in:

     "hearth · nothing can be taken here"      (their world — inviolable)
     "the commons · nothing can be taken here" (the hub — inviolable)
     "the march · carrying 33 · at risk"       (contested — and the number is the
                                                exact thing they'd lose)

   THE ONE UI INVENTION WORTH NAMING. The band does not warn on entry and then
   go quiet, which is how every survival game does it and is why players get
   ambushed feeling cheated. It shows the CARRY — the live number the march is
   paying you and the exact number a death would take — and it grows more urgent
   as that number grows. The tension is rendered continuously, from the server's
   own value, so the greed the design wants a player to feel is a thing they watch
   happening rather than a thing they discover after the fact. Walking home with
   a big number is the most dramatic thing in the game, and the band is what makes
   the drama visible.

   ── NO-COLLISION LAW COMPLIANCE (the hard part on a phone) ───────────────────
   Nothing in this file pins its own `position:fixed` button or its own sheet
   geometry — that is precisely how the DirHaven door once came to sit on top of
   the build launcher (both hand-counted into the 318-364px band at z-index 1450).
   Instead:
     · the launcher is allocated by `DirverseHUD.addLauncher`, the rail that
       MEASURES its own slots. This file never names a `bottom:` offset.
     · the sheet registers with `DirverseHUD.registerSheet` and opens through
       `openSheet`, so opening it EVICTS every other sheet. Two full-width
       surfaces can never be up at once.
     · the SOIL BAND is the only new fixed element, and it is deliberately
       anchored to the ONE band nothing else occupies: pinned top-CENTER, with a
       width capped to leave the WorldHUD's 228px left panel and the topbar's
       right-hand controls their own air, and a `max-width` that shrinks it before
       it could ever reach either. It is measured against both at every
       breakpoint (320/375/768/1280/1920) rather than assumed.
     · it is `pointer-events:none` — it is a readout, never a control, so it
       cannot intercept a tap meant for the world or a button beneath it.
   ════════════════════════════════════════════════════════════════════════════ */

(function () {
  var W = window;
  if (W.CovenantsHUD) return;

  // ── state, all of it server-given ──────────────────────────────────────────
  // This module DERIVES NOTHING about risk. Soil, carry, blood and membership all
  // arrive from world:soil:ok / world:state, so the HUD can never tell a player
  // they are safe when the server thinks otherwise. That asymmetry is the whole
  // reason the band is trustworthy.
  var _soil = null;        // { soil, label, violence, yield, carry, blood, covenant, covenants }
  var _mounted = false;
  var _band = null, _sheet = null, _launcher = null;
  var _pollT = null;

  function world() { return W.VintinuumWorld || null; }
  function hud() { return W.DirverseHUD || null; }
  function send(m) { var w = world(); return w && w.send ? w.send(m) : false; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function carryTotal(carry) {
    var n = 0; for (var k in (carry || {})) n += (+carry[k] || 0); return n;
  }

  // ── STYLE ──────────────────────────────────────────────────────────────────
  function style() {
    if (document.getElementById('cvStyle')) return;
    var s = document.createElement('style');
    s.id = 'cvStyle';
    s.textContent = [
      /* ── THE SOIL BAND ──────────────────────────────────────────────────────
         The one new fixed element in this feature, and the only one that is
         always on screen. It lives in the top-CENTER band, which is the single
         region no other surface claims: #vintWorldHud owns top-left (228px wide
         at 64px down), #topctl owns top-right, #dvRail owns bottom-left, the
         saybar owns the bottom. The width is capped so that even at 320px the
         band cannot reach either neighbour — it compresses its own text first
         (the container yields, never the neighbour), and on the narrowest
         phones it drops to the glyph + number, which is the irreducible fact.  */
      /* THE INSETS ARE ASYMMETRIC BECAUSE THE NEIGHBOURS ARE (fixed 2026-08-08).
         This rule was `left:50%; transform:translateX(-50%); max-width:min(52vw,340px)`,
         which reads as safe and is not. A CENTRED box can only clear both corners
         when the two corner stacks are the same width, and here they are nowhere
         near it: #leave is a bare 44px-tall link at left:16 reaching x≈76, while
         #editHeadBtn is a ~115px pill at right:14 reaching 129px inward. Centring
         splits the leftover evenly, so the band always gives the roomy left side
         the same slack it gives the tight right side — and lands on the button.
         Measured, at the four phone widths that matter:
             320px → band 77..243, #editHeadBtn starts at 191  → 52px OVERLAP
             375px → band 90..285, #editHeadBtn starts at 246  → 39px OVERLAP
             414px → band 99..315, #editHeadBtn starts at 285  → 30px OVERLAP
         So the band is pinned by its OWN two edges instead — each derived from the
         real reach of the neighbour on that side (+12px gutter), never from a
         percentage of the viewport. `margin:0 auto` still centres it INSIDE that
         reserved column, so on desktop it looks centred exactly as authored, but
         the column itself can no longer touch either corner at any width. This is
         the same discipline #status already uses (see world.html: reserve BOTH
         stacks, centre in what remains).

         AND THE RIGHT INSET IS MEASURED, NOT BAKED. It was a literal 141px — the
         hand-measured reach of today's #editHeadBtn — which is precisely the
         stale-arithmetic bug the no-collision lint hunts: re-label that button,
         add a second top-right control, and the number is silently wrong with no
         test to catch it. corner_dock.js publishes the real reach of the top-right
         stack live as --vint-dock-reach-top, so the band now reserves THAT plus a
         12px gutter, and the 141px survives only as the fallback for a page where
         the dock never mounted. The band re-measures itself whenever the dock does;
         nothing here has to be re-counted by hand again.

         AND IT IS A max(), NOT A SUBSTITUTION — this is the part that actually
         bit. Measured on the real page, --vint-dock-reach-top is `0px` here,
         because #editHeadBtn is a DRAGGABLE button that never registers with the
         corner dock, so the dock has nothing to report for that corner. Trusting
         the var alone therefore reserved ZERO and put the band straight back onto
         the button at 320/375px (a measured 111px overlap). The reserve is now the
         LARGER of what the dock reports and the button's own measured reach
         (125px inward + a 12px gutter = 137), so an unregistered neighbour cannot
         silently collapse the guard, and a future registered stack that reaches
         FURTHER still wins. A floor and a ceiling, not a guess. */
      '#cvBand{position:fixed;z-index:1420;',
      ' top:calc(10px + env(safe-area-inset-top,0px));',
      ' left:calc(88px + env(safe-area-inset-left,0px));',
      ' right:calc(max(137px, 12px + var(--vint-dock-reach-top, 0px)) + env(safe-area-inset-right,0px));',
      /* `width:fit-content` WAS HERE AND SILENTLY BROKE THE RIGHT INSET (caught by
         the headless collision test at 320px: the band rendered 88..215 straight
         onto #editHeadBtn at 193). With left AND right both set, CSS is already
         solving for width — adding an explicit width over-constrains the box, and
         the spec resolves that by DROPPING `right`. So the guard that mattered was
         the one being thrown away. `width:auto` keeps both edges honoured, which
         is the whole point of pinning by edges. The box then fills its reserved
         column and the CONTENT centres inside it, so it still reads as a centred
         pill at every width while being physically unable to reach either corner. */
      ' width:auto;max-width:340px;margin:0 auto;',
      ' display:none;align-items:center;justify-content:center;gap:8px;',
      ' padding:7px 13px;border-radius:999px;',
      ' background:rgba(6,9,15,0.82);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);',
      ' border:1px solid rgba(124,207,255,0.20);',
      ' font-family:"Cormorant Garamond",Georgia,serif;font-size:13px;line-height:1;',
      ' color:#cfe0f5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
      // A READOUT, NEVER A CONTROL — it must not eat a tap meant for the world.
      ' pointer-events:none;',
      ' transition:border-color .5s ease, background .5s ease, box-shadow .5s ease;}',
      '#cvBand.show{display:flex;}',
      '#cvBand .cv-dot{flex:0 0 auto;width:7px;height:7px;border-radius:50%;',
      ' background:#9ae0c2;box-shadow:0 0 8px #9ae0c2;transition:background .5s,box-shadow .5s;}',
      '#cvBand .cv-txt{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;}',
      '#cvBand .cv-num{flex:0 0 auto;font-weight:600;color:#ffe2a0;font-variant-numeric:tabular-nums;}',
      /* the march: the band itself becomes the tension. Three escalating steps
         keyed to what the carry is worth, so the urgency is EARNED by the number
         and never merely decorative. */
      '#cvBand.march{border-color:rgba(255,138,90,0.42);background:rgba(24,9,6,0.84);}',
      '#cvBand.march .cv-dot{background:#ff8a5a;box-shadow:0 0 9px #ff8a5a;}',
      '#cvBand.risk{border-color:rgba(255,110,90,0.66);box-shadow:0 0 18px rgba(255,110,90,0.20);}',
      '#cvBand.risk .cv-dot{animation:cvPulse 1.6s ease-in-out infinite;}',
      '#cvBand.heavy{border-color:rgba(255,90,90,0.85);box-shadow:0 0 26px rgba(255,80,80,0.30);}',
      '#cvBand.heavy .cv-dot{animation:cvPulse .9s ease-in-out infinite;}',
      '@keyframes cvPulse{0%,100%{opacity:1;}50%{opacity:0.35;}}',
      // Landscape phones + very short viewports: keep the number, drop the prose.
      // The number is the irreducible fact — what a death would cost.
      //
      // `max-width:none` USED TO LIVE HERE AND WAS THE BUG (fixed 2026-08-08): it
      // lifted the only width guard at exactly the widths where the corner stacks
      // are closest together, so the band was free to grow straight onto
      // #editHeadBtn. The narrow case must CLAMP HARDER, never softer. The band is
      // already bounded by its left/right insets above, so the fix is simply to
      // stop overriding them — the CONTENT yields (the prose goes, the number
      // stays), which is how the no-collision law says to handle a tight box:
      // compress what's inside, never widen the container onto a neighbour.
      '@media(max-height:480px),(max-width:360px){#cvBand .cv-txt{display:none;}',
      ' #cvBand{padding:6px 11px;}}',
      // Reduced motion: the colour still escalates, the pulse does not.
      '@media(prefers-reduced-motion:reduce){#cvBand .cv-dot{animation:none!important;}}',

      /* ── THE COVENANT SHEET — scaffolded by the shared .dv-sheet class so it
         inherits the sheet geometry, the keyboard-following max-height and the
         eviction contract. This file adds only its own inner layout.          */
      '#cvSheet{position:fixed;left:0;right:0;bottom:0;z-index:1600;',
      ' max-height:min(78vh,560px);max-height:min(78dvh,560px);',
      ' background:rgba(6,9,15,0.94);border-top:1px solid rgba(124,207,255,0.22);',
      ' border-radius:20px 20px 0 0;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);',
      ' color:#dce7ff;font-family:"Cormorant Garamond",Georgia,serif;',
      ' transform:translateY(105%);transition:transform .38s cubic-bezier(.22,1,.36,1);',
      ' display:flex;flex-direction:column;',
      ' padding-bottom:env(safe-area-inset-bottom,0px);}',
      '#cvSheet.open{transform:translateY(0);}',
      '#cvSheet .cv-grip{flex:0 0 auto;padding:10px 0 4px;display:flex;justify-content:center;cursor:grab;}',
      '#cvSheet .cv-grip i{width:38px;height:4px;border-radius:2px;background:rgba(160,190,220,0.35);display:block;}',
      '#cvSheet .cv-head{flex:0 0 auto;padding:2px 18px 10px;}',
      '#cvSheet .cv-h1{font-size:19px;color:#f0e2c8;letter-spacing:.2px;}',
      '#cvSheet .cv-sub{font-size:12.5px;color:#93a6bd;margin-top:3px;line-height:1.45;}',
      // the scroller is the ONLY thing that scrolls, and it scrolls INSIDE its
      // own box — content never spills onto the head or the footer.
      '#cvSheet .cv-body{flex:1 1 auto;overflow-y:auto;-webkit-overflow-scrolling:touch;',
      ' overscroll-behavior:contain;padding:0 14px 16px;min-height:0;}',
      '#cvSheet .cv-card{border:1px solid rgba(124,207,255,0.16);border-radius:14px;',
      ' padding:12px 13px;margin-bottom:10px;background:rgba(10,16,26,0.55);}',
      '#cvSheet .cv-card.mine{border-color:rgba(255,212,121,0.45);background:rgba(26,20,10,0.6);}',
      '#cvSheet .cv-name{font-size:15.5px;color:#f0e2c8;display:flex;align-items:center;gap:7px;}',
      '#cvSheet .cv-swatch{width:9px;height:9px;border-radius:50%;flex:0 0 auto;}',
      '#cvSheet .cv-creed{font-size:12.5px;color:#b9c8dc;font-style:italic;margin-top:4px;}',
      '#cvSheet .cv-doc{font-size:12px;color:#8fa2b8;margin-top:5px;line-height:1.5;}',
      '#cvSheet .cv-btn{margin-top:9px;width:100%;padding:9px 12px;border-radius:10px;',
      ' background:rgba(124,207,255,0.12);border:1px solid rgba(124,207,255,0.35);',
      ' color:#cfe6ff;font-family:inherit;font-size:13px;cursor:pointer;}',
      '#cvSheet .cv-btn:hover{background:rgba(124,207,255,0.2);}',
      '#cvSheet .cv-btn[disabled]{opacity:.45;cursor:default;}',
      '#cvSheet .cv-tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;',
      ' background:rgba(255,212,121,0.14);color:#ffe2a0;border:1px solid rgba(255,212,121,0.3);}',
      '#cvSheet .cv-sect{font-size:11px;letter-spacing:1.3px;text-transform:uppercase;',
      ' color:#7f93aa;margin:14px 2px 8px;}',
      '#cvSheet .cv-row{display:flex;align-items:center;justify-content:space-between;gap:10px;',
      ' padding:9px 2px;border-bottom:1px solid rgba(124,207,255,0.08);}',
      '#cvSheet .cv-row:last-child{border-bottom:0;}',
      '#cvSheet .cv-rl{flex:1 1 auto;min-width:0;}',
      '#cvSheet .cv-rt{font-size:13.5px;color:#dce7ff;}',
      '#cvSheet .cv-rb{font-size:11.5px;color:#8fa2b8;margin-top:2px;line-height:1.4;}',
      '#cvSheet .cv-mini{flex:0 0 auto;padding:6px 11px;border-radius:9px;font-size:12px;',
      ' background:rgba(124,207,255,0.1);border:1px solid rgba(124,207,255,0.3);',
      ' color:#cfe6ff;font-family:inherit;cursor:pointer;}',
      '#cvSheet .cv-note{font-size:12px;color:#8fa2b8;line-height:1.55;padding:6px 2px 0;}',
      '#cvSheet .cv-soil{display:flex;gap:8px;margin:2px 0 4px;}',
      '#cvSheet .cv-soil div{flex:1 1 0;min-width:0;border-radius:10px;padding:8px 9px;',
      ' border:1px solid rgba(124,207,255,0.16);background:rgba(10,16,26,0.5);}',
      '#cvSheet .cv-soil b{display:block;font-size:12px;color:#dce7ff;font-weight:600;}',
      '#cvSheet .cv-soil span{display:block;font-size:10.5px;color:#8fa2b8;margin-top:3px;line-height:1.35;}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── THE SOIL BAND ──────────────────────────────────────────────────────────
  function band() {
    if (_band) return _band;
    _band = document.createElement('div');
    _band.id = 'cvBand';
    _band.setAttribute('aria-live', 'polite');   // a screen reader hears the risk change
    _band.innerHTML = '<i class="cv-dot"></i><span class="cv-txt"></span><b class="cv-num"></b>';
    document.body.appendChild(_band);
    return _band;
  }

  /* Render the band from the SERVER's picture. Every branch here is driven by
     `_soil`, which only ever arrives from the wire — there is no client-side
     guess about safety anywhere in this function. */
  function paintBand() {
    var el = band();
    if (!_soil) { el.classList.remove('show'); return; }
    var txt = el.querySelector('.cv-txt'), num = el.querySelector('.cv-num');
    var carry = carryTotal(_soil.carry);
    var march = _soil.soil === 'march' && _soil.violence;

    el.classList.toggle('march', !!march);
    // The two escalation steps. Thresholds are deliberately LOW (12 / 40) because
    // the feeling we want is "I have something to lose", which starts early — not
    // "I am about to lose a fortune", which starts too late to change behaviour.
    el.classList.toggle('risk', march && carry >= 12);
    el.classList.toggle('heavy', march && carry >= 40);

    if (march) {
      txt.textContent = carry > 0 ? 'the march · at risk' : 'the march · nothing to lose yet';
      num.textContent = carry > 0 ? String(carry) : '';
    } else {
      // The safe soils say so PLAINLY and identically, because the promise is the
      // same on both and a player should never have to work out which safe they are.
      txt.textContent = (_soil.label || 'hearth') + ' · nothing can be taken here';
      num.textContent = '';
    }
    el.classList.add('show');
  }

  // ── THE SHEET ──────────────────────────────────────────────────────────────
  function sheet() {
    if (_sheet) return _sheet;
    _sheet = document.createElement('div');
    _sheet.id = 'cvSheet';
    _sheet.innerHTML =
      '<div class="cv-grip"><i></i></div>' +
      '<div class="cv-head"><div class="cv-h1">The Covenants</div>' +
      '<div class="cv-sub">Bodies that hold ground, pass law, and remember what you did.</div></div>' +
      '<div class="cv-body" id="cvBody"></div>';
    document.body.appendChild(_sheet);
    // grip / backdrop dismissal, matching the other sheets' feel
    _sheet.querySelector('.cv-grip').addEventListener('click', close);
    return _sheet;
  }

  function isOpen() { return !!(_sheet && _sheet.classList.contains('open')); }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    var h = hud(); if (h && h.syncSheets) { try { h.syncSheets(); } catch (_) {} }
  }
  function open() {
    style(); sheet();
    var h = hud();
    // THE EVICTION CONTRACT — open through the shared owner so this sheet can
    // never be raised on top of another one. If the HUD isn't present (a bare
    // world.html), fall back to opening directly; there is no sheet to collide
    // with in that case by definition.
    var raise = function () { build(); _sheet.classList.add('open'); };
    if (h && h.openSheet) h.openSheet('covenant', raise); else raise();
    refresh();
  }

  function build() {
    var b = document.getElementById('cvBody');
    if (!b) return;
    var s = _soil || {};
    var mine = s.covenant || null;
    var list = s.covenants || [];
    var html = '';

    /* THE SOIL PRIMER, shown FIRST and always. This is the table the whole
       ethical claim rests on, and a player is entitled to read it before they
       are ever at risk — not after. Three cells, plain words, no jargon. */
    html += '<div class="cv-sect">where you can be touched</div>';
    html += '<div class="cv-soil">' +
      '<div><b>hearth</b><span>your world. nothing can ever be taken here.</span></div>' +
      '<div><b>commons</b><span>where strangers meet. always safe.</span></div>' +
      '<div><b>the march</b><span>pays ' + esc(String((s.yield || 2.2))) + '×. you can be killed. you chose to stand here.</span></div>' +
      '</div>';
    html += '<div class="cn-note cv-note">A death in the march takes what you are <b>carrying</b> and nothing else — never your world, your build, your standing, or anything you banked at your hearth.</div>';

    if (mine) {
      html += '<div class="cv-sect">your covenant</div>';
      html += '<div class="cv-card mine"><div class="cv-name">' +
        '<i class="cv-swatch" style="background:' + esc(colorFor(mine.key, list)) + '"></i>' +
        esc(mine.name) + ' <span class="cv-tag">' + esc(mine.role || 'member') + '</span></div>' +
        '<div class="cv-creed">' + esc(mine.creed || '') + '</div></div>';

      html += '<div class="cv-sect">law · propose a policy</div>';
      for (var i = 0; i < POLICIES.length; i++) {
        var p = POLICIES[i];
        html += '<div class="cv-row"><div class="cv-rl">' +
          '<div class="cv-rt">' + esc(p.name) + '</div>' +
          '<div class="cv-rb">' + esc(p.blurb) + '</div></div>' +
          '<button class="cv-mini" data-policy="' + esc(p.key) + '">propose</button></div>';
      }
      html += '<div class="cv-note">A policy carries at ' + QUORUM + ' voices and then it is <b>real</b> — it changes what the world actually pays on your covenant\'s ground. Every one costs something; there is no free law.</div>';
    } else {
      html += '<div class="cv-sect">choose a body</div>';
      html += '<div class="cv-note" style="padding-bottom:10px">Five answers to one question: what is a debt, and who collects it? None is stronger — each trades something for something.</div>';
      for (var j = 0; j < list.length; j++) {
        var c = list[j];
        html += '<div class="cv-card"><div class="cv-name">' +
          '<i class="cv-swatch" style="background:' + esc(c.color || '#d8c48a') + '"></i>' + esc(c.name) + '</div>' +
          '<div class="cv-creed">' + esc(c.creed || '') + '</div>' +
          '<div class="cv-doc">' + esc(c.doctrine || '') + '</div>' +
          '<button class="cv-btn" data-join="' + esc(c.key) + '">take this creed</button></div>';
      }
    }

    if (carryTotal(s.carry) > 0) {
      html += '<div class="cv-sect">carrying</div>';
      html += '<div class="cv-row"><div class="cv-rl"><div class="cv-rt">' +
        carryTotal(s.carry) + ' unbanked</div><div class="cv-rb">A death in the march takes all of it. Banking is free and instant.</div></div>' +
        '<button class="cv-mini" id="cvBank">bank it</button></div>';
    }
    if (s.blood) {
      html += '<div class="cv-sect">blood</div>';
      html += '<div class="cv-note">Your stain reads <b>' + esc(String(s.blood)) + '</b>. It fades on its own — nobody is branded forever by one bad night. Past ' + OUTLAW + ' a covenant may lawfully outlaw you.</div>';
    }

    b.innerHTML = html;

    // ── wire the controls (delegated once per build, never a global handler) ──
    var joins = b.querySelectorAll('[data-join]');
    for (var k = 0; k < joins.length; k++) joins[k].addEventListener('click', function () {
      var key = this.getAttribute('data-join');
      this.disabled = true; this.textContent = 'taking the creed…';
      send({ t: 'world:covenant:join', key: key });
      setTimeout(refresh, 500);
    });
    var props = b.querySelectorAll('[data-policy]');
    for (var m = 0; m < props.length; m++) props[m].addEventListener('click', function () {
      var key = this.getAttribute('data-policy');
      this.disabled = true; this.textContent = 'proposed';
      send({ t: 'world:policy:propose', policy: key });
    });
    var bank = document.getElementById('cvBank');
    if (bank) bank.addEventListener('click', function () {
      this.disabled = true; this.textContent = 'banking…';
      send({ t: 'world:bank' });
      setTimeout(refresh, 500);
    });
  }

  function colorFor(key, list) {
    for (var i = 0; i < (list || []).length; i++) if (list[i].key === key) return list[i].color || '#d8c48a';
    return '#ffd479';
  }

  // Mirrors of the server's table, for COPY ONLY. Every one of these is enforced
  // server-side (factions.js POLICY / QUORUM / OUTLAW_BLOOD); nothing here is the
  // rule, and a mismatch can only ever mis-word a label, never mis-grant an act.
  var QUORUM = 3, OUTLAW = 67;
  var POLICIES = [
    { key: 'tithe_low', name: 'Low Tithe', blurb: 'Members keep more. The vault fills slower.' },
    { key: 'tithe_high', name: 'High Tithe', blurb: 'The vault fills fast. Members feel it.' },
    { key: 'sanctuary', name: 'Sanctuary', blurb: 'No raiding from our ground. Our marches yield less.' },
    { key: 'war_footing', name: 'War Footing', blurb: 'Raids sanctioned. Yields rise. The vault pays.' },
    { key: 'open_march', name: 'Open March', blurb: 'Anyone may draw from our marches. Renown rises.' },
    { key: 'blood_price', name: 'Blood Price', blurb: 'Bounties on those who kill our members.' },
    { key: 'amnesty', name: 'Amnesty', blurb: 'Blood forgiven faster. No executions, ever.' },
  ];

  // ── the wire ───────────────────────────────────────────────────────────────
  function refresh() { send({ t: 'world:soil' }); }

  function onSoil(d) {
    _soil = d || null;
    paintBand();
    if (isOpen()) build();
  }

  /* THE DEATH MOMENT. Being killed gets WORDS, from the server, naming who and
     what it cost — never a number that quietly changed. And the words carry the
     bounded promise with them ("your world is untouched"), because the instant a
     player is angriest is the exact instant the design's honesty has to be
     legible or it reads as a betrayal. */
  function onDied(d) {
    var took = carryTotal(d && d.took);
    var h = hud();
    var line = (d && d.by ? esc(d.by) : 'someone') + ' took you in the march' +
      (took > 0 ? ' — ' + took + ' carried, gone' : '') + '. Your world is untouched.';
    if (h && h.toast) { try { h.toast(line.replace(/<[^>]+>/g, '')); } catch (_) {} }
    _soil = null;             // force a truthful re-read rather than showing a stale carry
    refresh();
  }

  // ── mount ──────────────────────────────────────────────────────────────────
  function mount() {
    if (_mounted) return;
    _mounted = true;
    style(); band();

    // register with the shared sheet owner FIRST, so any other sheet opening
    // knows to evict us (and vice versa) from the very first frame.
    var h = hud();
    if (h && h.registerSheet) { try { h.registerSheet('covenant', isOpen, close); } catch (_) {} }
    // the launcher slot is ALLOCATED BY THE RAIL, never positioned here.
    if (h && h.addLauncher) {
      try { _launcher = h.addLauncher('cvBtn', 'covenant', '⚔', open); } catch (_) {}
    }

    W.addEventListener('vint:world-soil', function (e) { onSoil(e.detail); });
    W.addEventListener('vint:world-died', function (e) { onDied(e.detail); });
    // a fresh world means fresh ground — re-read soil on arrival and on travel
    W.addEventListener('vint:world-state', function () { setTimeout(refresh, 250); });
    W.addEventListener('vint:world-travel', function () { _soil = null; paintBand(); setTimeout(refresh, 900); });
    W.addEventListener('vint:world-harvest', function (e) {
      // a march harvest ships the carry back with it — repaint the tension the
      // instant the number moves, without waiting for the next poll.
      var d = e && e.detail;
      if (d && d.carry && _soil) { _soil.carry = d.carry; paintBand(); }
      else if (d && d.marchGain) refresh();
    });

    // A LOW-RATE TRUTH POLL. Soil changes when the player WALKS, and movement
    // sends no server ack — so without this a player could stroll into a march
    // and see "hearth · nothing can be taken here", which is the one lie this
    // whole surface exists to prevent. 6s is cheap (one tiny frame) and bounded:
    // it stops entirely when the tab is hidden or no socket is up.
    clearInterval(_pollT);
    _pollT = setInterval(function () {
      if (document.visibilityState !== 'visible') return;
      var w = world(); if (!w || !w.isConnected || !w.isConnected()) return;
      refresh();
    }, 6000);
    setTimeout(refresh, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  W.CovenantsHUD = {
    mount: mount, open: open, close: close, isOpen: isOpen,
    refresh: refresh, soil: function () { return _soil; },
  };
})();
