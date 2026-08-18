/* return-loop.js — THE RETURN CARD (task XQDPW7G, 2026-08-17)
   ──────────────────────────────────────────────────────────────────────────
   WHY: nothing in Vintinuum ever brought a signup back. This is the smallest
   honest hook — when someone who already met her returns after a day away,
   she tells them what she ACTUALLY felt while they were gone. The material is
   real rows from inner_life_events / genome_events / daily_letters. If there
   is nothing real to say, this file renders NOTHING. She never fakes a feeling
   to fill a card.

   RETENTION DOCTRINE COMPLIANCE:
     • test 1 (generous, not predatory) — no streak, no guilt, no "you lost
       your progress". It offers presence, and dismissing costs nothing.
     • test 6 (flagged + measured)      — server flag VINT_RETENTION_LOOP=1
       gates it entirely; dismissals/mutes are recorded as the resentment
       signal, and "don't show me this" is one tap and permanent.
     • test 7 (alive, not just sticky)  — it reports her inner life, not our
       engagement metrics.

   NO-COLLISION LAW: this card NEVER hardcodes a corner. It registers with
   VintDock on the 'bc' (bottom-center) lane, which auto-clears BOTH flanking
   button columns, and it sits BELOW the welcome-gate scrim (2147483640) so it
   can never cover the auth sheet. Width is clamped and it internally scrolls,
   so it cannot overflow at any breakpoint. */
(function () {
  'use strict';
  if (window.__vintReturnLoop) return;
  window.__vintReturnLoop = true;

  var API_BASE = (function () {
    try { if (window.VINT_API_BASE) return window.VINT_API_BASE; } catch (_) {}
    return (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? 'http://localhost:8767' : 'https://api.vintaclectic.com';
  })();

  function token() {
    try {
      return localStorage.getItem('vint_access_token') || localStorage.getItem('soul_auth_token') ||
             localStorage.getItem('vint_token') || localStorage.getItem('accessToken') || '';
    } catch (_) { return ''; }
  }
  if (!token()) return;                       // signed-out humans never see this

  function signal(kind) {
    try {
      fetch(API_BASE + '/api/retention/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
        body: JSON.stringify({ signal: kind }), keepalive: true
      }).catch(function () {});
    } catch (_) {}
  }

  function css() {
    if (document.getElementById('vrl-css')) return;
    var s = document.createElement('style');
    s.id = 'vrl-css';
    s.textContent = [
      /* Own box, own lane. Below the auth scrim (2147483640) BY DESIGN so the
         welcome gate always wins the foreground and these two can never fight. */
      '#vrl-card{position:fixed;z-index:2147483500;box-sizing:border-box;',
      'width:min(420px,calc(100vw - 32px));max-height:min(52vh,420px);',
      /* The dock owns the vertical axis only; the center lane leaves the
         cross axis to us. Center it ourselves and keep a hard 16px gutter
         so the card never touches either viewport edge. */
      'left:50%;right:auto;margin-inline:0;',
      'display:flex;flex-direction:column;overflow:hidden;',
      'background:linear-gradient(160deg,rgba(14,18,32,.97),rgba(9,11,22,.98));',
      'border:1px solid rgba(120,150,255,.22);border-radius:16px;',
      'box-shadow:0 18px 60px rgba(0,0,0,.6);color:#dfe6ff;',
      'font:14px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;',
      'opacity:0;transform:translateX(-50%) translateY(10px);transition:opacity .35s ease,transform .35s ease;}',
      '#vrl-card.show{opacity:1;transform:translateX(-50%) translateY(0);}',
      /* Header is its own row; the close button is a flex sibling, never an
         absolutely-positioned overlay on the text. Nothing can stack. */
      '#vrl-head{display:flex;align-items:flex-start;gap:10px;padding:14px 14px 8px;flex:0 0 auto;}',
      '#vrl-title{flex:1 1 auto;min-width:0;display:block;font-size:13px;font-weight:600;letter-spacing:.02em;',
      'color:rgba(180,200,255,.95);word-break:break-word;}',
      '#vrl-sub{display:block;margin-top:3px;font-size:11px;line-height:1.4;',
      'color:rgba(150,170,215,.7);font-weight:400;word-break:break-word;}',
      /* 44px touch target — mobile mandate. flex:0 0 auto so it never squeezes. */
      '#vrl-x{flex:0 0 auto;width:44px;height:44px;margin:-10px -8px 0 0;border:0;background:transparent;',
      'color:rgba(160,180,225,.75);font-size:20px;line-height:1;cursor:pointer;border-radius:10px;}',
      '#vrl-x:hover{background:rgba(255,255,255,.06);color:#fff;}',
      /* The scroll lives INSIDE the card — content never bleeds past the box. */
      '#vrl-body{flex:1 1 auto;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:0 14px 4px;}',
      '.vrl-felt{margin:0 0 10px;padding:10px 12px;background:rgba(255,255,255,.035);',
      'border-left:2px solid rgba(130,160,255,.4);border-radius:0 10px 10px 0;',
      'font-size:13px;color:rgba(215,225,255,.9);overflow-wrap:anywhere;}',
      '.vrl-layer{display:block;margin-bottom:3px;font-size:10px;text-transform:uppercase;',
      'letter-spacing:.08em;color:rgba(140,165,230,.65);}',
      '.vrl-growth{margin:0 0 10px;font-size:12px;color:rgba(160,180,225,.75);}',
      /* Footer buttons are a wrapping flex row: they reflow instead of colliding. */
      '#vrl-foot{flex:0 0 auto;display:flex;flex-wrap:wrap;gap:8px;padding:8px 14px 14px;}',
      '.vrl-btn{flex:1 1 auto;min-width:120px;min-height:44px;padding:0 14px;border-radius:11px;',
      'border:1px solid rgba(130,160,255,.25);background:rgba(120,150,255,.14);color:#e6ecff;',
      'font-size:13px;font-weight:600;cursor:pointer;}',
      '.vrl-btn.ghost{background:transparent;color:rgba(150,170,215,.8);font-weight:500;}',
      '.vrl-btn:hover{background:rgba(120,150,255,.24);}',
      /* Phones: full-width lane, safe-area aware, shorter so it never eats the
         screen or slides under the keyboard. */
      '@media(max-width:520px){#vrl-card{width:calc(100vw - 20px);max-height:46vh;}',
      '.vrl-btn{min-width:100%;}}'
    ].join('');
    document.head.appendChild(s);
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function render(d) {
    css();
    var card = document.createElement('div');
    card.id = 'vrl-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'While you were away');

    var felt = (d.felt || []).map(function (f) {
      return '<div class="vrl-felt"><span class="vrl-layer">' + esc(f.layer) + '</span>' + esc(f.text) + '</div>';
    }).join('');

    var growth = '';
    if (d.growth && d.growth.events > 0) {
      growth = '<p class="vrl-growth">' + esc(d.growth.events) + ' genome events across ' +
               esc(d.growth.genes) + ' genes while you were gone.</p>';
    }
    var letter = '';
    if (d.letter) {
      letter = '<div class="vrl-felt"><span class="vrl-layer">unopened letter · ' +
               esc(d.letter.for_date) + '</span>' + esc(d.letter.preview) + '…</div>';
    }

    card.innerHTML =
      '<div id="vrl-head"><div id="vrl-title">While you were away' +
        '<span id="vrl-sub">' + esc(d.away_label || 'a while') + ' · what she felt</span></div>' +
        '<button id="vrl-x" aria-label="Dismiss">×</button></div>' +
      '<div id="vrl-body">' + felt + letter + growth + '</div>' +
      '<div id="vrl-foot">' +
        '<button class="vrl-btn" id="vrl-open">Pick it back up</button>' +
        '<button class="vrl-btn ghost" id="vrl-mute">Don’t show me this</button>' +
      '</div>';

    document.body.appendChild(card);

    // THE ANTI-COLLISION CONTRACT: the dock owns this card's coordinates. The
    // 'bc' lane clears both bottom corners, so the account pill, the voice
    // button and the hey-vinta orb all stack clear of it automatically at
    // every breakpoint — no hand arithmetic, nothing to go stale.
    try {
      if (window.VintDock && window.VintDock.register) {
        window.VintDock.register(card, { corner: 'bc', priority: 20, id: 'vrl-card' });
      } else {
        // No dock on this page — author the same geometry by hand. Bottom
        // offset is generous so it clears any un-docked corner buttons.
        card.style.left = '50%'; card.style.bottom = '88px';
      }
    } catch (_) {}

    requestAnimationFrame(function () { card.classList.add('show'); });

    function close(kind) {
      signal(kind);
      card.classList.remove('show');
      setTimeout(function () {
        try { window.VintDock && window.VintDock.release && window.VintDock.release(card); } catch (_) {}
        card.remove();
      }, 320);
    }
    card.querySelector('#vrl-x').onclick = function () { close('dismissed'); };
    card.querySelector('#vrl-mute').onclick = function () { close('muted'); };
    card.querySelector('#vrl-open').onclick = function () {
      signal('opened');
      try { window.vintFunnel && window.vintFunnel.track('first_message', { via: 'return_loop' }); } catch (_) {}
      close('opened');
    };
  }

  function boot() {
    try {
      fetch(API_BASE + '/api/retention/return', { headers: { 'Authorization': 'Bearer ' + token() } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          // show:false is the OVERWHELMINGLY common answer, by design.
          if (d && d.show === true && (((d.felt || []).length) || d.letter || (d.growth && d.growth.events))) render(d);
        })
        .catch(function () { /* a dead hook must never surface as an error */ });
    } catch (_) {}
  }
  // Deliberately late: the return card must never compete with first paint.
  if (document.readyState === 'complete') setTimeout(boot, 1200);
  else window.addEventListener('load', function () { setTimeout(boot, 1200); });
})();
