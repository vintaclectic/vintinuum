'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   THE RECKONING (AETHERHOLD, Vinta directive 2026-08-08)

   The Covenants shipped with a complete backend and no hands. `world:strike`,
   `world:policy:vote` and `world:execute` all had server handlers, full rules,
   blood, grace windows and quorums — and NOTHING in the entire client ever sent
   one of them. The knife existed; nobody could hold it. This file is the hand.

   Three acts live here, and they are deliberately the same surface, because they
   are the same question asked at three temperatures:

     THE KNIFE     — one person, right now, on ground that permits it.
     THE PAPER     — the whole body, over two days, by counted voices.
     THE GALLOWS   — the body, against one person, and only one already outlawed.

   ── THE DESIGN CLAIM WORTH DEFENDING ────────────────────────────────────────
   Violence here is never a surprise and never a slip. Every irreversible act in
   this file passes through the same two-step: the act NAMES ITS VICTIM and
   STATES ITS PRICE before it is armed, and the arming decays on its own after a
   few seconds. That is not friction for its own sake — it is the client half of
   the promise the soil band makes. A game where you can kill by fat-fingering a
   button has not made violence meaningful, it has made it noise. Making the
   player look at a name and a cost, and then reach a second time, is what makes
   the act theirs.

   The second claim: THE CLIENT RULES ON NOTHING. It cannot know whether a strike
   is lawful — soil, distance, grace, cooldown, blood and covenant policy all
   live in factions.js. So it never greys a button to mean "forbidden"; it asks,
   and it renders the server's refusal in words. A client that guessed would
   eventually guess wrong and call a lawful act impossible, or worse, promise an
   unlawful one. Refusals are surfaced verbatim-in-spirit, never swallowed.

   ── NO-COLLISION LAW COMPLIANCE ─────────────────────────────────────────────
   This file pins NO fixed geometry of its own. Not one `bottom:` literal.
     · the launcher comes from `DirverseHUD.addLauncher`, the rail that measures
       its own slots (rail order: star-map · agents · court · home · lanterns ·
       covenant · reckoning · build).
     · the sheet uses the shared `registerSheet`/`openSheet` eviction contract,
       so raising it CLOSES every other sheet — two full-width surfaces can never
       be up at once.
     · the CONFIRM step is rendered INSIDE the sheet's own scroller, not as a
       floating overlay, precisely so it cannot land on top of anything. The one
       thing a confirmation must never do is obscure the thing it describes.
     · toasts route through the shared `DirverseHUD.toast` — one page, one toast
       element, because two toast nodes at one anchor stack on each other.
   ════════════════════════════════════════════════════════════════════════════ */

(function () {
  var W = window;
  if (W.ReckoningHUD) return;

  var _mounted = false, _sheet = null;
  var _peers = [];          // live, from World.nearby()
  var _proposals = null;    // last order paper from the server
  var _soil = null;         // last soil reading (shared truth with covenants-hud)
  var _armed = null;        // { kind:'strike'|'execute', id, name, until } — decays
  var _armT = null, _tickT = null;

  function world() { return W.VintinuumWorld || null; }
  function hud() { return W.DirverseHUD || null; }
  function toast(m) {
    var h = hud();
    if (h && h.toast) { try { h.toast(m); return; } catch (_) {} }
    try { console.log('[reckoning]', m); } catch (_) {}
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function carryTotal(c) { var n = 0; for (var k in (c || {})) n += (+c[k] || 0); return n; }

  /* THE ARMING WINDOW. Long enough to be a decision, short enough that an armed
     knife left on screen cannot be triggered by a later, unrelated tap. It
     decays by itself — walking away is a valid way to change your mind. */
  var ARM_MS = 6000;

  // ── STYLE ──────────────────────────────────────────────────────────────────
  function style() {
    if (document.getElementById('rkStyle')) return;
    var s = document.createElement('style');
    s.id = 'rkStyle';
    s.textContent = [
      /* The sheet mirrors #cvSheet's geometry deliberately: same anchor, same
         radius, same max-height, same keyboard-safe padding. They are siblings
         under one eviction contract, so they should feel like one surface that
         changed its mind rather than two competing panels. */
      '#rkSheet{position:fixed;left:0;right:0;bottom:0;z-index:1600;',
      ' max-height:min(78vh,560px);max-height:min(78dvh,560px);',
      ' background:rgba(9,6,7,0.95);border-top:1px solid rgba(255,138,90,0.24);',
      ' border-radius:20px 20px 0 0;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);',
      ' color:#f0e0dc;font-family:"Cormorant Garamond",Georgia,serif;',
      ' transform:translateY(105%);transition:transform .38s cubic-bezier(.22,1,.36,1);',
      ' display:flex;flex-direction:column;padding-bottom:env(safe-area-inset-bottom,0px);}',
      '#rkSheet.open{transform:translateY(0);}',
      '#rkSheet .rk-grip{flex:0 0 auto;padding:10px 0 4px;display:flex;justify-content:center;cursor:grab;}',
      '#rkSheet .rk-grip i{width:38px;height:4px;border-radius:2px;background:rgba(255,180,160,0.32);display:block;}',
      '#rkSheet .rk-head{flex:0 0 auto;padding:2px 18px 10px;}',
      '#rkSheet .rk-h1{font-size:19px;color:#ffd9c4;letter-spacing:.2px;}',
      '#rkSheet .rk-sub{font-size:12.5px;color:#b79a92;margin-top:3px;line-height:1.45;}',
      // the ONLY scrolling box; content never spills onto head or footer
      '#rkSheet .rk-body{flex:1 1 auto;overflow-y:auto;-webkit-overflow-scrolling:touch;',
      ' overscroll-behavior:contain;padding:0 14px 16px;min-height:0;}',

      // tabs — three acts, one surface
      '#rkSheet .rk-tabs{flex:0 0 auto;display:flex;gap:6px;padding:0 14px 10px;}',
      '#rkSheet .rk-tab{flex:1 1 0;min-width:0;padding:8px 6px;border-radius:10px;font-family:inherit;',
      ' font-size:12.5px;cursor:pointer;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
      ' background:rgba(255,255,255,0.05);border:1px solid rgba(255,138,90,0.18);color:#c9b3ac;}',
      '#rkSheet .rk-tab.on{background:rgba(255,138,90,0.16);border-color:rgba(255,138,90,0.5);color:#ffd9c4;}',

      '#rkSheet .rk-sect{font-size:11px;letter-spacing:1.3px;text-transform:uppercase;',
      ' color:#9c8078;margin:14px 2px 8px;}',
      '#rkSheet .rk-row{display:flex;align-items:center;justify-content:space-between;gap:10px;',
      ' padding:9px 2px;border-bottom:1px solid rgba(255,138,90,0.10);}',
      '#rkSheet .rk-row:last-child{border-bottom:0;}',
      '#rkSheet .rk-rl{flex:1 1 auto;min-width:0;}',
      '#rkSheet .rk-rt{font-size:13.5px;color:#f0e0dc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '#rkSheet .rk-rb{font-size:11.5px;color:#a89189;margin-top:2px;line-height:1.4;}',
      '#rkSheet .rk-mini{flex:0 0 auto;padding:6px 11px;border-radius:9px;font-size:12px;font-family:inherit;',
      ' background:rgba(255,138,90,0.10);border:1px solid rgba(255,138,90,0.32);color:#ffd0b8;cursor:pointer;}',
      '#rkSheet .rk-mini[disabled]{opacity:.42;cursor:default;}',
      '#rkSheet .rk-mini.yes{background:rgba(122,220,160,0.10);border-color:rgba(122,220,160,0.34);color:#b8e8ca;}',
      '#rkSheet .rk-mini.no{background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.14);color:#bda9a2;}',
      '#rkSheet .rk-note{font-size:12px;color:#a89189;line-height:1.55;padding:6px 2px 0;}',
      '#rkSheet .rk-empty{font-size:13px;color:#a89189;line-height:1.6;padding:16px 4px;text-align:center;font-style:italic;}',

      /* THE CONFIRM CARD — rendered INSIDE the scroller, replacing the row it
         belongs to. It is not an overlay and it is not a modal: it can never
         cover the list it came from, and dismissing it needs no scrim. */
      '#rkSheet .rk-confirm{border:1px solid rgba(255,90,90,0.55);border-radius:13px;padding:12px 13px;',
      ' margin:8px 0;background:rgba(40,10,8,0.72);box-shadow:0 0 22px rgba(255,80,60,0.16);}',
      '#rkSheet .rk-cq{font-size:14.5px;color:#ffd2c4;line-height:1.45;}',
      '#rkSheet .rk-cw{font-size:12px;color:#e0a898;margin-top:6px;line-height:1.5;}',
      '#rkSheet .rk-crow{display:flex;gap:8px;margin-top:11px;}',
      '#rkSheet .rk-go{flex:1 1 auto;padding:10px 12px;border-radius:10px;font-family:inherit;font-size:13.5px;',
      ' background:rgba(255,70,60,0.20);border:1px solid rgba(255,90,80,0.72);color:#ffd0c6;cursor:pointer;}',
      '#rkSheet .rk-cancel{flex:0 0 auto;padding:10px 14px;border-radius:10px;font-family:inherit;font-size:13px;',
      ' background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.16);color:#c9b3ac;cursor:pointer;}',
      // the arming decay, shown as a thinning line so the window is visible
      '#rkSheet .rk-fuse{height:2px;border-radius:2px;background:rgba(255,90,70,0.75);margin-top:9px;',
      ' transition:width .25s linear;}',
      '@media(prefers-reduced-motion:reduce){#rkSheet .rk-fuse{transition:none;}}',

      '#rkSheet .rk-tag{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;',
      ' background:rgba(255,138,90,0.14);color:#ffc4a8;border:1px solid rgba(255,138,90,0.3);}',
      '#rkSheet .rk-tag.warrant{background:rgba(255,70,60,0.16);color:#ffb8ac;border-color:rgba(255,90,80,0.42);}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── the sheet ──────────────────────────────────────────────────────────────
  var _tab = 'near';   // near | paper

  function sheet() {
    if (_sheet) return _sheet;
    _sheet = document.createElement('div');
    _sheet.id = 'rkSheet';
    _sheet.innerHTML =
      '<div class="rk-grip"><i></i></div>' +
      '<div class="rk-head"><div class="rk-h1">The Reckoning</div>' +
      '<div class="rk-sub">What one person can do, and what a body can decide.</div></div>' +
      '<div class="rk-tabs">' +
        '<button class="rk-tab on" data-tab="near" type="button">who is near</button>' +
        '<button class="rk-tab" data-tab="paper" type="button">before the body</button>' +
      '</div>' +
      '<div class="rk-body" id="rkBody"></div>';
    document.body.appendChild(_sheet);
    _sheet.querySelector('.rk-grip').addEventListener('click', close);
    var tabs = _sheet.querySelectorAll('.rk-tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].addEventListener('click', function () {
      _tab = this.getAttribute('data-tab');
      var all = _sheet.querySelectorAll('.rk-tab');
      for (var j = 0; j < all.length; j++) all[j].classList.toggle('on', all[j] === this);
      disarm();
      if (_tab === 'paper') { var w = world(); if (w && w.proposals) w.proposals(); }
      build();
    });
    return _sheet;
  }

  function isOpen() { return !!(_sheet && _sheet.classList.contains('open')); }
  function close() {
    disarm();
    if (_sheet) _sheet.classList.remove('open');
    clearInterval(_tickT); _tickT = null;
    // Give the corner back the moment we're down, so the pills slide home.
    try { if (_sheet && W.VintDock && W.VintDock.unavoid) W.VintDock.unavoid(_sheet); } catch (_) {}
    var h = hud(); if (h && h.syncSheets) { try { h.syncSheets(); } catch (_) {} }
  }
  function open() {
    style(); sheet();
    var h = hud();
    var raise = function () { refresh(); _sheet.classList.add('open'); };
    if (h && h.openSheet) h.openSheet('reckoning', raise); else raise();

    /* THE DOCKED PILLS ARE A SEPARATE REGISTRY (measured, not assumed).
       The shared `openSheet` contract evicts other SHEETS, and dirverse-hud's
       layoutRail keeps the launcher rail clear — but neither governs the docked
       corner pills, which are a third thing. Headless at 1280x800 the account
       pill (#vwg-pill, z-index 2147483600) rendered at y740..784 directly on top
       of this sheet, which spans y240..800: a 97x44 overlap of an opaque,
       tappable control over the sheet's own footer, at EVERY width tested.
       z-index cannot solve it — the pill's z is near INT_MAX by design, so the
       honest fix is the same one world.html uses for #invite: declare the sheet
       an OBSTACLE and let the dock move its pills above it. Both bottom corners,
       because this sheet is full-width and spans them both. */
    try {
      if (W.VintDock && W.VintDock.avoid) {
        W.VintDock.avoid(_sheet, { corner: 'br' });
        W.VintDock.avoid(_sheet, { corner: 'bl' });
      }
    } catch (_) {}
    // keep the near-list live while it's up: people walk. 1.5s is cheap (it reads
    // an in-memory map, no network) and stops the instant the sheet closes.
    clearInterval(_tickT);
    _tickT = setInterval(function () {
      if (!isOpen()) { clearInterval(_tickT); _tickT = null; return; }
      if (_tab === 'near') build();
    }, 1500);
  }

  function refresh() {
    var w = world();
    if (w && w.soil) w.soil();
    if (w && w.proposals) w.proposals();
    build();
  }

  // ── arming ─────────────────────────────────────────────────────────────────
  /* An armed act is a NAMED act with a deadline. Nothing is armed globally and
     nothing survives a tab change, a sheet close, or six seconds of hesitation. */
  function arm(kind, id, name, extra) {
    _armed = { kind: kind, id: String(id), name: name || 'someone', until: Date.now() + ARM_MS, extra: extra || null };
    clearTimeout(_armT);
    _armT = setTimeout(function () {
      if (_armed && Date.now() >= _armed.until) { _armed = null; build(); }
    }, ARM_MS + 60);
    build();
    // paint the fuse down without rebuilding the whole list every frame
    var start = Date.now();
    var fuseT = setInterval(function () {
      var f = _sheet && _sheet.querySelector('.rk-fuse');
      if (!f || !_armed) { clearInterval(fuseT); return; }
      var left = Math.max(0, 1 - (Date.now() - start) / ARM_MS);
      f.style.width = (left * 100).toFixed(1) + '%';
      if (left <= 0) clearInterval(fuseT);
    }, 250);
  }
  function disarm() { _armed = null; clearTimeout(_armT); _armT = null; }

  // ── build ──────────────────────────────────────────────────────────────────
  function build() {
    var b = document.getElementById('rkBody');
    if (!b) return;
    b.innerHTML = (_tab === 'paper') ? paperHTML() : nearHTML();
    wire(b);
  }

  function nearHTML() {
    var w = world();
    var peers = (w && w.nearby) ? w.nearby() : [];
    _peers = peers;
    var s = _soil || {};
    var march = s.soil === 'march' && s.violence;
    var carry = carryTotal(s.carry);
    var html = '';

    /* GROUND FIRST, ALWAYS. The player reads what this ground permits before
       they read a list of people, because the answer to "can I do anything to
       them" is a property of where everyone is standing, not of who they are. */
    if (march) {
      html += '<div class="rk-sect">this ground</div>';
      html += '<div class="rk-note">You are in <b>the march</b>. Here you can be killed, and so can they. ' +
        (carry > 0
          ? 'You are carrying <b>' + carry + '</b> — a death takes all of it, and nothing else.'
          : 'You are carrying nothing, so a death would cost you nothing.') +
        '</div>';
    } else {
      html += '<div class="rk-sect">this ground</div>';
      html += '<div class="rk-note"><b>' + esc(s.label || 'hearth') + '</b> — nothing can be taken here, by you or from you. ' +
        'The knife is not offered on safe ground; it would be refused.</div>';
    }

    html += '<div class="rk-sect">who is near</div>';
    if (!peers.length) {
      html += '<div class="rk-empty">Nobody else is standing here.<br>The march is only dangerous when it is crowded.</div>';
      return html;
    }

    for (var i = 0; i < peers.length; i++) {
      var p = peers[i];
      // the confirm card REPLACES this person's row, so it can never cover it
      if (_armed && _armed.kind === 'strike' && _armed.id === p.id) {
        html += confirmHTML(
          'Kill ' + esc(p.name) + '?',
          'They lose everything they are carrying. You take blood — a stain that fades, ' +
          'but past ' + 67 + ' a covenant may lawfully outlaw you. Their world, their build and their standing are untouched.',
          'kill ' + esc(p.name)
        );
        continue;
      }
      // 2.6m is the server's real reach (factions.murder). Mirrored EXACTLY, and
      // for COPY ONLY — the server still rules. A wrong number here would tell a
      // player they are "within reach" and then have the act refused, which is
      // precisely the "safe when the server disagrees" lie the soil band exists
      // to prevent. If factions.js changes, this line changes with it.
      var far = p.dist > 2.6;
      html += '<div class="rk-row"><div class="rk-rl">' +
        '<div class="rk-rt">' + esc(p.name) + '</div>' +
        '<div class="rk-rb">' + p.dist.toFixed(1) + 'm away' +
          (march ? (far ? ' · too far to reach' : ' · within reach') : ' · safe ground') + '</div>' +
        '</div>' +
        // The button is OFFERED even when the client suspects it will fail, and
        // the server's refusal is shown in words. The one case it is withheld is
        // safe ground, where the answer is knowable from the soil the player is
        // already reading, and offering it would be a lie about the promise.
        (march
          ? '<button class="rk-mini" data-strike="' + esc(p.id) + '" data-name="' + esc(p.name) + '">the knife</button>'
          : '') +
        '</div>';
    }
    if (march) {
      html += '<div class="rk-note">A killing is remembered. Blood decays on its own — nobody is branded forever by one bad night.</div>';
    }
    return html;
  }

  function paperHTML() {
    var d = _proposals;
    var html = '';
    if (!d || !d.ok) {
      html += '<div class="rk-empty">You belong to no covenant, so there is nothing before you.<br>' +
        'Take a creed in <b>The Covenants</b> and you get a voice.</div>';
      return html;
    }
    var list = d.proposals || [];
    html += '<div class="rk-sect">' + esc(d.covenant || 'your covenant') + ' · open motions</div>';
    if (!list.length) {
      html += '<div class="rk-empty">Nothing is before the body.<br>Propose a policy in <b>The Covenants</b> and it appears here for everyone to answer.</div>';
      return html;
    }
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (_armed && _armed.kind === 'execute' && _armed.id === String(p.id)) {
        html += confirmHTML(
          'Carry out this execution?',
          'The warrant has its quorum. This is lawful, collective, and final — and it costs the covenant. ' +
          'It is the gravest thing a body can do.',
          'carry it out'
        );
        continue;
      }
      var mine = p.myVote;
      var voted = (mine !== null && mine !== undefined);
      var hrs = Math.max(0, Math.round((p.secondsLeft || 0) / 3600));
      html += '<div class="rk-row"><div class="rk-rl">' +
        '<div class="rk-rt">' + esc(p.name) +
          (p.kind === 'warrant' ? ' <span class="rk-tag warrant">warrant</span>' : '') + '</div>' +
        '<div class="rk-rb">' + esc(p.blurb || '') + '<br>' +
          '<b>' + p.yes + '</b> of ' + p.quorum + ' voices' +
          (p.total ? ' · ' + p.total + ' spoke' : '') +
          (hrs ? ' · ' + hrs + 'h left' : ' · closing') +
          (voted ? (mine ? ' · you said yes' : ' · you said no') : '') +
        '</div></div>' +
        (voted
          ? '<button class="rk-mini no" data-unvote="' + p.id + '">change</button>'
          : '<button class="rk-mini yes" data-vote="' + p.id + '">yes</button>') +
        '</div>';
      // a warrant that has reached quorum becomes an ACT, not a vote
      if (p.kind === 'warrant' && p.yes >= p.quorum && p.target) {
        html += '<div class="rk-row"><div class="rk-rl">' +
          '<div class="rk-rt">The warrant stands</div>' +
          '<div class="rk-rb">Quorum reached. It may now be carried out.</div></div>' +
          '<button class="rk-mini" data-exec="' + p.id + '" data-target="' + esc(p.target) + '">the gallows</button></div>';
      }
    }
    html += '<div class="rk-note">A motion carries at ' + (d.quorum || 3) +
      ' voices and then it is <b>real</b> — it changes what the world actually pays on your ground.</div>';
    return html;
  }

  function confirmHTML(q, warn, go) {
    return '<div class="rk-confirm">' +
      '<div class="rk-cq">' + q + '</div>' +
      '<div class="rk-cw">' + warn + '</div>' +
      '<div class="rk-crow">' +
        '<button class="rk-go" data-go="1">' + go + '</button>' +
        '<button class="rk-cancel" data-cancel="1">no</button>' +
      '</div>' +
      '<div class="rk-fuse" style="width:100%"></div>' +
      '</div>';
  }

  // ── wiring ─────────────────────────────────────────────────────────────────
  function wire(b) {
    var i, n;
    var strikes = b.querySelectorAll('[data-strike]');
    for (i = 0; i < strikes.length; i++) strikes[i].addEventListener('click', function () {
      arm('strike', this.getAttribute('data-strike'), this.getAttribute('data-name'));
    });
    var execs = b.querySelectorAll('[data-exec]');
    for (i = 0; i < execs.length; i++) execs[i].addEventListener('click', function () {
      arm('execute', this.getAttribute('data-exec'), null, { target: this.getAttribute('data-target') });
    });
    var votes = b.querySelectorAll('[data-vote]');
    for (i = 0; i < votes.length; i++) votes[i].addEventListener('click', function () {
      var id = +this.getAttribute('data-vote');
      this.disabled = true; this.textContent = '…';
      var w = world(); if (w && w.vote) w.vote(id, true);
    });
    var unv = b.querySelectorAll('[data-unvote]');
    for (i = 0; i < unv.length; i++) unv[i].addEventListener('click', function () {
      var id = +this.getAttribute('data-unvote');
      this.disabled = true; this.textContent = '…';
      // "change" flips to a NO — the only other thing a voice can say. Voting
      // again with the same value would be a no-op the player couldn't see.
      var w = world(); if (w && w.vote) w.vote(id, false);
    });
    var go = b.querySelector('[data-go]');
    if (go) go.addEventListener('click', function () {
      if (!_armed) return;
      if (Date.now() > _armed.until) { disarm(); toast('the moment passed.'); build(); return; }
      var a = _armed; disarm();
      var w = world();
      if (!w) { toast('the world is out of reach.'); return; }
      var sent = false;
      if (a.kind === 'strike') sent = w.strike ? w.strike(a.id) : false;
      else if (a.kind === 'execute') sent = w.execute ? w.execute(a.extra && a.extra.target, +a.id) : false;
      // send() returns false when the socket is down — never let that read as success
      if (!sent) toast('that did not reach the world.');
      build();
    });
    var cx = b.querySelector('[data-cancel]');
    if (cx) cx.addEventListener('click', function () { disarm(); build(); });
  }

  // ── the wire ───────────────────────────────────────────────────────────────
  /* Every refusal the server can give, in the player's language. An unmapped
     code still surfaces (as itself) rather than vanishing — a silent failure is
     the one outcome this file refuses to produce. */
  var REFUSAL = {
    covenants_off: 'the covenants are quiet right now.',
    violence_off: 'no blood is being spilled in this world.',
    not_in_covenant: 'you belong to no covenant — take a creed first.',
    no_such_target: 'they are no longer standing there.',
    no_such_policy: 'no such law.',
    no_such_proposal: 'that motion is gone.',
    not_your_covenant: 'that is not your body’s business.',
    already_proposed: 'that is already before the body.',
    closed: 'that motion has closed.',
    expired: 'that motion ran out of time.',
    // These three codes are copied EXACTLY from factions.murder()'s returns.
    // Guessing at them (an earlier draft invented `safe_ground`/`victim_safe`)
    // means the refusal falls through to the raw code, which is the one thing
    // this table exists to prevent.
    you_are_on_safe_ground: 'nothing can be taken here — you are on safe ground.',
    they_are_on_safe_ground: 'they are standing on safe ground.',
    not_together: 'they are not in this world with you.',
    unauthenticated: 'sign in to act in the world.',
    too_far: 'they are too far away.',
    grace: 'they only just died — leave them a moment.',
    cooldown: 'your hand is not steady yet.',
    self: 'you cannot do that to yourself.',
    not_outlawed: 'they are not outlawed — a body cannot execute the merely disliked.',
    amnesty: 'your covenant has sworn amnesty. it cannot execute.',
    no_warrant: 'there is no warrant against them.',
    no_quorum: 'the warrant has not reached quorum.',
  };

  // Codes that are NOT this surface's property — they mean something different
  // depending on which verb raised them. `cooldown` is the harvest node
  // recharging far more often than it is an unsteady hand; `unauthenticated`
  // belongs to whatever the player just tried to do. world-hud.js speaks both
  // generically, so if this sheet spoke them too, ONE refusal would raise TWO
  // toasts on two surfaces at once — the no-collision sin, in time rather than
  // space. We only claim them while this sheet is actually open, i.e. while the
  // player is unambiguously in the Reckoning's context.
  var ONLY_WHEN_OPEN = { cooldown: 1, unauthenticated: 1, too_far: 1 };

  function onErr(d) {
    var code = d && d.code;
    if (!code) return;
    // only speak to refusals that belong to THIS surface; the world emits many
    if (!(code in REFUSAL) && !/strike|covenant|policy|warrant|quorum|outlaw|carry|soil/.test(String(code))) return;
    if (ONLY_WHEN_OPEN[code] && !isOpen()) return;   // let the world HUD speak it
    toast(REFUSAL[code] || String(code).replace(/_/g, ' '));
    if (isOpen()) build();
  }

  function mount() {
    if (_mounted) return;
    _mounted = true;
    style();

    var h = hud();
    if (h && h.registerSheet) { try { h.registerSheet('reckoning', isOpen, close); } catch (_) {} }
    if (h && h.addLauncher) { try { h.addLauncher('rkBtn', 'reckoning', '⚖', open); } catch (_) {} }

    W.addEventListener('vint:world-soil', function (e) { _soil = e.detail || null; if (isOpen() && _tab === 'near') build(); });
    W.addEventListener('vint:world-proposals', function (e) { _proposals = e.detail || null; if (isOpen() && _tab === 'paper') build(); });
    W.addEventListener('vint:world-err', function (e) { onErr(e.detail); });

    // An act that LANDED gets words too, not just a refusal.
    W.addEventListener('vint:world-strike', function (e) {
      var d = e.detail || {};
      var took = carryTotal(d.took);
      toast('you took ' + ((d.victim && d.victim.name) || 'them') +
        (took > 0 ? ' — ' + took + ' carried, taken' : '') + '.');
      if (isOpen()) build();
    });
    W.addEventListener('vint:world-law', function (e) {
      var d = e.detail || {};
      if (d.carried) toast('it carried — the law is real now.');
      else if (d.yes != null) toast(d.yes + ' of ' + (d.quorum || 3) + ' voices.');
      if (isOpen()) build();
    });
    // travelling changes both the ground and the room
    W.addEventListener('vint:world-travel', function () { _soil = null; disarm(); if (isOpen()) build(); });
    // being killed closes the knife you were holding
    W.addEventListener('vint:world-died', function () { disarm(); if (isOpen()) build(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  W.ReckoningHUD = {
    mount: mount, open: open, close: close, isOpen: isOpen, refresh: refresh,
  };
})();
