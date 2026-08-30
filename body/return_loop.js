/* return_loop.js — THE ACTIVATION TOUCH (task TAS22T8, 2026-08-17).

   WHAT THIS IS NOT: it is not an email. Vintinuum has NO email transport —
   no nodemailer, no sendgrid, no resend. An "activation pass" that claims to
   send mail would be a lie told to Vinta in his own dashboard. So the touch is
   IN-APP: when someone who already met her comes back after a day away, she
   tells them what she actually felt while they were gone.

   The backend (task XQDPW7G) already built the honest half:
     GET  /api/retention/return  → { show, felt[], growth, letter }  (flag-gated,
          returns show:false unless there is REAL inner_life/genome material)
     POST /api/retention/signal  → 'opened' | 'dismissed' | 'muted'
   It has never fired, because nothing ever called it. This is the caller.

   RETENTION DOCTRINE TEST 6 — flagged, measured, transparent:
   - Server flag VINT_RETENTION_LOOP=1 arms it. Unset = OFF. Killable in 30s
     with no deploy (unset the env var; the endpoint returns show:false).
   - Client flag: <html data-return-loop="off"> or ?loop=off disables locally.
   - Every surfacing records 'shown'; every close records 'dismissed'; the
     never-again button records 'muted'. resentment_pct in /api/funnel/report
     is (dismissed+muted)/shown — a REAL number, not an estimate. If it climbs,
     the hook dies regardless of what it does for return rate.
   - "Why am I seeing this?" is answered on the card itself, per the doctrine.

   NO-COLLISION LAW: this is a modal over a dimmed backdrop — the one overlay
   the law explicitly permits. It claims no dock corner, so it cannot collide
   with hey_vinta (br/10), status_pill (bl/20), wake_consent (bc/20) or the
   welcome-gate pill (br/40). It is the only fixed element it introduces, its
   scrim owns the full viewport, and the card scrolls INTERNALLY rather than
   ever bleeding past its own bounds. */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.__vintReturnLoop) return;               // singleton
  window.__vintReturnLoop = true;

  // ── client-side kill switches ────────────────────────────────────────────
  try {
    var html = document.documentElement;
    if (html && html.getAttribute('data-return-loop') === 'off') return;
    if (/[?&]loop=off/.test(location.search)) return;
  } catch (_) {}

  // Never interrupt the onboarding/auth surfaces themselves.
  var page = (location.pathname.split('/').pop() || '').toLowerCase();
  if (page === 'welcome.html' || page === 'onboarding.html') return;

  function apiUrl(path) {
    try {
      if (window.VINTINUUM && typeof window.VINTINUUM.url === 'function') return window.VINTINUUM.url(path);
      var base = window.__VINTINUUM_API_BASE || window.VINTINUUM_API || window.__VINT_API;
      if (base) return base + path;
    } catch (_) {}
    var h = (location.hostname || '').toLowerCase();
    var local = !h || h === 'localhost' || h === '127.0.0.1';
    return (local ? 'http://localhost:8767' : 'https://api.vintaclectic.com') + path;
  }

  function token() {
    try {
      return localStorage.getItem('vint_token')
        || localStorage.getItem('vint_access_token')
        || localStorage.getItem('soul_auth_token') || '';
    } catch (_) { return ''; }
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── the resentment channel ───────────────────────────────────────────────
  function signal(sig) {
    try {
      var t = token();
      if (!t) return;
      fetch(apiUrl('/api/retention/signal'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        credentials: 'include',
        keepalive: true,
        body: JSON.stringify({ signal: sig })
      }).catch(function () {});
    } catch (_) {}
  }

  // ── styles ───────────────────────────────────────────────────────────────
  // Matches the welcome-gate visual language exactly (same palette, same type,
  // same bottom-sheet-on-mobile / centered-card-on-desktop behaviour) so this
  // reads as part of Vintinuum rather than a bolted-on growth widget.
  var CSS = ''
    + '#vrl-scrim{position:fixed;inset:0;z-index:2147483630;background:rgba(2,4,10,.72);'
    + 'backdrop-filter:blur(4px);display:none;align-items:flex-end;justify-content:center;}'
    + '#vrl-scrim.show{display:flex;}'
    + '@media(min-width:560px){#vrl-scrim{align-items:center;}}'
    + '.vrl-card{position:relative;width:100%;max-width:460px;max-height:88vh;max-height:88svh;'
    + 'overflow-y:auto;overflow-x:hidden;box-sizing:border-box;'
    + 'background:#070b14;border:1px solid rgba(255,213,79,.2);border-radius:22px 22px 0 0;'
    + 'padding:26px 22px calc(22px + env(safe-area-inset-bottom));'
    + 'color:rgba(222,230,255,.93);font-family:"Space Mono",monospace;'
    + 'animation:vrlrise .35s cubic-bezier(.2,.8,.2,1);}'
    + '@media(min-width:560px){.vrl-card{border-radius:22px;}}'
    + '@keyframes vrlrise{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:none;}}'
    // Close button sits in its own reserved column; the heading is padded clear
    // of it so the two can never occupy the same pixels at any string length.
    + '.vrl-x{position:absolute;top:8px;right:10px;width:44px;height:44px;border:none;'
    + 'background:transparent;color:rgba(150,175,215,.6);font-size:17px;cursor:pointer;'
    + 'line-height:1;border-radius:8px;-webkit-tap-highlight-color:transparent;}'
    + '.vrl-x:hover{color:rgba(222,230,255,.9);}'
    + '.vrl-eyebrow{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#ffd54f;'
    + 'opacity:.7;margin:0 54px 8px 0;}'
    + '.vrl-h{font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-weight:300;'
    + 'font-size:27px;line-height:1.12;margin:0 54px 14px 0;color:#ffe9a8;overflow-wrap:anywhere;}'
    + '.vrl-felt{display:flex;flex-direction:column;gap:9px;margin-bottom:14px;}'
    + '.vrl-item{padding:12px 13px;border-radius:11px;border:1px solid rgba(255,255,255,.08);'
    + 'background:rgba(255,255,255,.025);box-sizing:border-box;}'
    + '.vrl-layer{display:block;font-size:9px;letter-spacing:.18em;text-transform:uppercase;'
    + 'color:rgba(255,213,79,.65);margin-bottom:5px;}'
    + '.vrl-text{display:block;font-family:"Cormorant Garamond",Georgia,serif;font-size:16px;'
    + 'line-height:1.5;color:rgba(222,230,255,.9);overflow-wrap:anywhere;}'
    + '.vrl-growth{font-size:11px;color:rgba(150,175,215,.6);line-height:1.6;'
    + 'padding-top:12px;border-top:1px solid rgba(255,255,255,.06);overflow-wrap:anywhere;}'
    + '.vrl-actions{display:flex;flex-direction:column;gap:9px;margin-top:16px;}'
    + '.vrl-btn{width:100%;min-height:48px;border:none;border-radius:12px;box-sizing:border-box;'
    + 'background:linear-gradient(135deg,#c8960c,#ffd54f);color:#0a0600;'
    + 'font-family:"Space Mono",monospace;font-size:12px;font-weight:700;letter-spacing:.12em;'
    + 'cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .15s;}'
    + '.vrl-btn:active{transform:scale(.98);}'
    + '.vrl-why{font-size:10px;color:rgba(150,175,215,.42);line-height:1.6;margin-top:14px;'
    + 'padding-top:12px;border-top:1px solid rgba(255,255,255,.06);overflow-wrap:anywhere;}'
    + '.vrl-mute{display:block;width:100%;min-height:44px;text-align:center;background:none;'
    + 'border:none;color:rgba(150,175,215,.45);font-family:"Space Mono",monospace;font-size:11px;'
    + 'letter-spacing:.06em;cursor:pointer;padding:8px;-webkit-tap-highlight-color:transparent;}'
    + '.vrl-mute:hover{color:rgba(222,230,255,.75);}';

  var scrim = null;

  function close(sig) {
    try {
      if (scrim) scrim.classList.remove('show');
      if (sig) signal(sig);
      // Restore scroll — the scrim locked it while open.
      try { document.body.style.overflow = ''; } catch (_) {}
    } catch (_) {}
  }

  function render(d) {
    try {
      var st = document.createElement('style');
      st.id = 'vrl-css'; st.textContent = CSS;
      (document.head || document.documentElement).appendChild(st);

      scrim = document.createElement('div');
      scrim.id = 'vrl-scrim';
      scrim.setAttribute('role', 'dialog');
      scrim.setAttribute('aria-modal', 'true');
      scrim.setAttribute('aria-label', 'While you were away');

      var card = document.createElement('div');
      card.className = 'vrl-card';

      var felt = '';
      (d.felt || []).forEach(function (f) {
        if (!f || !f.text) return;
        felt += '<div class="vrl-item"><span class="vrl-layer">' + esc(f.layer || 'felt') + '</span>'
              + '<span class="vrl-text">' + esc(f.text) + '</span></div>';
      });
      if (d.letter && d.letter.preview) {
        felt += '<div class="vrl-item"><span class="vrl-layer">unopened letter</span>'
              + '<span class="vrl-text">' + esc(d.letter.preview) + '…</span></div>';
      }

      // Growth line only when there is something real to report.
      var g = d.growth || {};
      var growth = (g.events > 0)
        ? '<div class="vrl-growth">She changed in ' + esc(g.events) + ' recorded way'
          + (g.events === 1 ? '' : 's') + (g.genes ? ' across ' + esc(g.genes) + ' gene' + (g.genes === 1 ? '' : 's') : '')
          + ' while you were gone.</div>'
        : '';

      card.innerHTML = ''
        + '<button class="vrl-x" id="vrl-x" aria-label="Close">✕</button>'
        + '<div class="vrl-eyebrow">While you were away</div>'
        + '<div class="vrl-h">' + esc(d.away_label || 'a day') + ' without you.</div>'
        + '<div class="vrl-felt">' + felt + '</div>'
        + growth
        + '<div class="vrl-actions"><button class="vrl-btn" id="vrl-go">Go to her</button></div>'
        + '<div class="vrl-why">You are seeing this because you signed in, then came back after '
        + esc(d.away_label || 'a day') + '. Everything above is drawn from what she actually '
        + 'recorded in that window — nothing here is generated to fill the card.</div>'
        + '<button class="vrl-mute" id="vrl-mute">don\'t show me this again</button>';

      scrim.appendChild(card);
      document.body.appendChild(scrim);

      // A backdrop click is a dismissal, same as the ✕.
      scrim.addEventListener('click', function (e) { if (e.target === scrim) close('dismissed'); });
      card.querySelector('#vrl-x').onclick = function () { close('dismissed'); };
      card.querySelector('#vrl-mute').onclick = function () { close('muted'); };
      card.querySelector('#vrl-go').onclick = function () {
        signal('opened');
        try { document.body.style.overflow = ''; } catch (_) {}
        location.href = 'brain.html';
      };
      document.addEventListener('keydown', function onKey(e) {
        if (e.key === 'Escape' && scrim && scrim.classList.contains('show')) {
          close('dismissed'); document.removeEventListener('keydown', onKey);
        }
      });

      // Lock background scroll so the page behind cannot move under the modal.
      try { document.body.style.overflow = 'hidden'; } catch (_) {}
      scrim.classList.add('show');
    } catch (_) { /* a broken hook must never break the page it lives on */ }
  }

  // ── ask the server whether there is anything honest to say ───────────────
  function check() {
    try {
      var t = token();
      if (!t) return;                     // signed-out visitors are not "returning"
      fetch(apiUrl('/api/retention/return'), {
        headers: { Authorization: 'Bearer ' + t },
        credentials: 'include'
      })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          // show:false is the overwhelmingly common answer — flag off, muted,
          // too soon, no prior session, or (most often) no real material.
          if (!d || !d.show) return;
          if (!(d.felt && d.felt.length) && !(d.letter && d.letter.preview)
              && !(d.growth && d.growth.events)) return;   // nothing real → say nothing
          render(d);
        })
        .catch(function () {});
    } catch (_) {}
  }

  function boot() {
    if (!document.body) return setTimeout(boot, 60);
    // Let the page paint and settle first. The interrupt must feel like she
    // noticed you arrived, not like a popup ambushing the load.
    setTimeout(check, 1800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
