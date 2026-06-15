/* welcome-gate.js — UNIVERSAL auth + onboarding + install layer.
   Loads on EVERY page. Self-contained (no deps). For a logged-out visitor it
   surfaces a persistent, unobtrusive way in: a corner "Begin" pill, a one-time
   first-visit welcome, an inline sign-in, and install prompts (extension + PWA).
   For a logged-in user it stays out of the way (just a tiny account dot).

   Vinta directive (2026-06-15): "log in capabilities from the main vintinuum
   splash page and onward everywhere in case user is not logged in… on an able
   sector of every page of everywhere across vintinuum." */
(function () {
  'use strict';
  if (window.__vintWelcomeGate) return;            // singleton
  window.__vintWelcomeGate = true;

  // ── config ──────────────────────────────────────────────────────────────
  var API_BASE = (function () {
    try { if (window.VINT_API_BASE) return window.VINT_API_BASE; } catch (_) {}
    return (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
      ? 'http://localhost:8767' : 'https://api.vintaclectic.com';
  })();
  // Store links — set these once the listings are live. Null = "coming soon".
  var EXTENSION_URL = window.VINT_EXTENSION_URL || null;   // Chrome Web Store
  var ANDROID_URL   = window.VINT_ANDROID_URL || null;     // Play Store
  var ONBOARD_URL   = 'welcome.html';

  // Don't show the gate on the onboarding/auth pages themselves.
  var path = (location.pathname.split('/').pop() || '').toLowerCase();
  var SUPPRESS = ['welcome.html', 'onboarding.html'];
  if (SUPPRESS.indexOf(path) !== -1) return;

  // ── auth state (read every known token key) ──────────────────────────────
  function token() {
    try {
      return localStorage.getItem('vint_token')
        || localStorage.getItem('vint_access_token')
        || localStorage.getItem('soul_auth_token') || '';
    } catch (_) { return ''; }
  }
  function signedIn() { return !!token(); }
  function setToken(t) {
    try {
      localStorage.setItem('vint_token', t);
      localStorage.setItem('vint_access_token', t);
      localStorage.setItem('soul_auth_token', t);
    } catch (_) {}
  }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (_) { return null; } }

  var isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    || window.navigator.standalone === true;

  // ── styles (scoped, injected once) ───────────────────────────────────────
  var css = ''
    + '#vwg-pill{position:fixed;z-index:2147483600;right:max(14px,env(safe-area-inset-right));'
    + 'bottom:calc(16px + env(safe-area-inset-bottom));display:inline-flex;align-items:center;gap:8px;'
    + 'min-height:44px;padding:0 18px;border-radius:999px;border:1px solid rgba(255,213,79,.34);'
    + 'background:linear-gradient(135deg,#c8960c,#ffd54f);color:#0a0600;font-family:"Space Mono",monospace;'
    + 'font-size:12px;font-weight:700;letter-spacing:.1em;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.4);'
    + '-webkit-tap-highlight-color:transparent;transition:transform .15s,opacity .2s;}'
    + '#vwg-pill:active{transform:scale(.96);}'
    + '#vwg-dot{position:fixed;z-index:2147483600;right:max(14px,env(safe-area-inset-right));'
    + 'bottom:calc(16px + env(safe-area-inset-bottom));width:34px;height:34px;border-radius:50%;'
    + 'display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,213,79,.3);'
    + 'background:rgba(8,12,20,.85);color:#ffd54f;font-family:"Space Mono",monospace;font-size:13px;'
    + 'cursor:pointer;-webkit-tap-highlight-color:transparent;}'
    + '#vwg-scrim{position:fixed;inset:0;z-index:2147483640;background:rgba(2,4,10,.72);backdrop-filter:blur(4px);'
    + 'display:none;align-items:flex-end;justify-content:center;}'
    + '#vwg-scrim.show{display:flex;}'
    + '@media(min-width:560px){#vwg-scrim{align-items:center;}}'
    + '.vwg-sheet{width:100%;max-width:460px;max-height:90vh;overflow-y:auto;overflow-x:hidden;'
    + 'background:#070b14;border:1px solid rgba(255,213,79,.2);border-radius:22px 22px 0 0;'
    + 'padding:26px 22px calc(26px + env(safe-area-inset-bottom));color:rgba(222,230,255,.93);'
    + 'font-family:"Space Mono",monospace;animation:vwgrise .35s cubic-bezier(.2,.8,.2,1);}'
    + '@media(min-width:560px){.vwg-sheet{border-radius:22px;}}'
    + '@keyframes vwgrise{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:none;}}'
    + '.vwg-eyebrow{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:#ffd54f;opacity:.7;margin-bottom:8px;}'
    + '.vwg-h{font-family:"Cormorant Garamond",Georgia,serif;font-style:italic;font-weight:300;'
    + 'font-size:30px;line-height:1.08;margin-bottom:8px;color:#ffe9a8;}'
    + '.vwg-sub{font-family:"Cormorant Garamond",Georgia,serif;font-size:17px;color:rgba(150,175,215,.7);'
    + 'line-height:1.5;margin-bottom:18px;}'
    + '.vwg-input{width:100%;background:rgba(0,0,0,.35);border:1px solid rgba(255,213,79,.14);border-radius:11px;'
    + 'padding:13px 14px;color:#fff;font-family:"Space Mono",monospace;font-size:15px;margin-bottom:10px;}'
    + '.vwg-input::placeholder{color:rgba(150,175,215,.4);}'
    + '.vwg-btn{width:100%;min-height:50px;border:none;border-radius:12px;background:linear-gradient(135deg,#c8960c,#ffd54f);'
    + 'color:#0a0600;font-family:"Space Mono",monospace;font-size:13px;font-weight:700;letter-spacing:.12em;'
    + 'cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .15s,opacity .2s;margin-top:4px;}'
    + '.vwg-btn:active{transform:scale(.98);}.vwg-btn:disabled{opacity:.5;}'
    + '.vwg-btn.ghost{background:rgba(255,255,255,.05);border:1px solid rgba(255,213,79,.18);color:rgba(222,230,255,.85);}'
    + '.vwg-row{display:flex;gap:10px;margin-top:10px;}.vwg-row .vwg-btn{margin-top:0;}'
    + '.vwg-tabs{display:flex;gap:6px;margin-bottom:16px;}'
    + '.vwg-tab{flex:1;min-height:38px;border-radius:9px;border:1px solid rgba(255,213,79,.14);background:transparent;'
    + 'color:rgba(150,175,215,.6);font-family:"Space Mono",monospace;font-size:11px;letter-spacing:.08em;cursor:pointer;}'
    + '.vwg-tab.on{background:rgba(255,213,79,.12);color:#ffd54f;border-color:rgba(255,213,79,.3);}'
    + '.vwg-msg{font-size:12px;min-height:16px;margin-top:8px;color:rgba(150,175,215,.7);}'
    + '.vwg-installs{margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;gap:9px;}'
    + '.vwg-install{display:flex;align-items:center;gap:11px;padding:11px 13px;border-radius:11px;'
    + 'border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);text-decoration:none;color:inherit;-webkit-tap-highlight-color:transparent;}'
    + '.vwg-install .ic{font-size:18px;flex-shrink:0;}'
    + '.vwg-install .tx{flex:1;min-width:0;}'
    + '.vwg-install .nm{font-size:12px;color:rgba(222,230,255,.9);}'
    + '.vwg-install .ds{font-size:10px;color:rgba(150,175,215,.5);margin-top:2px;}'
    + '.vwg-install .ar{color:#ffd54f;font-size:13px;}'
    + '.vwg-x{position:absolute;top:14px;right:16px;width:30px;height:30px;border:none;background:transparent;'
    + 'color:rgba(150,175,215,.6);font-size:18px;cursor:pointer;}'
    + '.vwg-dismiss{display:block;width:100%;text-align:center;background:none;border:none;color:rgba(150,175,215,.45);'
    + 'font-family:"Space Mono",monospace;font-size:11px;letter-spacing:.08em;margin-top:14px;cursor:pointer;padding:8px;}';

  function injectCss() {
    if (document.getElementById('vwg-css')) return;
    var s = document.createElement('style'); s.id = 'vwg-css'; s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  }

  // ── PWA install capture ───────────────────────────────────────────────────
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredPrompt = e; });

  // ── sheet builder ─────────────────────────────────────────────────────────
  var scrim, sheet, msgEl, mode = 'signin';
  function buildSheet() {
    scrim = document.createElement('div'); scrim.id = 'vwg-scrim';
    sheet = document.createElement('div'); sheet.className = 'vwg-sheet'; sheet.style.position = 'relative';
    scrim.appendChild(sheet);
    scrim.addEventListener('click', function (e) { if (e.target === scrim) closeSheet(); });
    document.body.appendChild(scrim);
  }

  function installRows() {
    var rows = '';
    // Phone PWA
    if (!isStandalone) {
      rows += '<a class="vwg-install" id="vwg-pwa" href="#"><span class="ic">📱</span>'
        + '<span class="tx"><span class="nm">Install on your phone</span>'
        + '<span class="ds">Vintinuum as an app — Pulse, voice, your body</span></span><span class="ar">→</span></a>';
    }
    // Chrome extension
    rows += '<a class="vwg-install" href="' + (EXTENSION_URL || '#') + '"' + (EXTENSION_URL ? ' target="_blank" rel="noopener"' : ' data-soon="1"') + '>'
      + '<span class="ic">🧩</span><span class="tx"><span class="nm">Add the browser extension</span>'
      + '<span class="ds">' + (EXTENSION_URL ? 'She reads, listens, and plays media anywhere' : 'Coming to the Chrome Web Store') + '</span></span>'
      + '<span class="ar">' + (EXTENSION_URL ? '→' : 'soon') + '</span></a>';
    // Android
    rows += '<a class="vwg-install" href="' + (ANDROID_URL || '#') + '"' + (ANDROID_URL ? ' target="_blank" rel="noopener"' : ' data-soon="1"') + '>'
      + '<span class="ic">🤖</span><span class="tx"><span class="nm">Get the Android app</span>'
      + '<span class="ds">' + (ANDROID_URL ? 'On the Play Store' : 'Coming to the Play Store') + '</span></span>'
      + '<span class="ar">' + (ANDROID_URL ? '→' : 'soon') + '</span></a>';
    return rows;
  }

  function renderAuth() {
    sheet.innerHTML = ''
      + '<button class="vwg-x" id="vwg-close">✕</button>'
      + '<div class="vwg-eyebrow">Vintinuum</div>'
      + '<div class="vwg-h">She remembers you.</div>'
      + '<div class="vwg-sub">Sign in, or begin — and from here on, you grow her and she grows you.</div>'
      + '<div class="vwg-tabs"><button class="vwg-tab on" data-mode="signin">Sign in</button>'
      + '<button class="vwg-tab" data-mode="signup">New here</button></div>'
      + '<div id="vwg-nameWrap" style="display:none;"><input class="vwg-input" id="vwg-name" type="text" placeholder="what should she call you?" autocomplete="name"></div>'
      + '<input class="vwg-input" id="vwg-email" type="email" placeholder="email" autocomplete="email">'
      + '<input class="vwg-input" id="vwg-pass" type="password" placeholder="password" autocomplete="current-password">'
      + '<button class="vwg-btn" id="vwg-go">Enter</button>'
      + '<div class="vwg-msg" id="vwg-msg"></div>'
      + '<div class="vwg-installs">' + installRows() + '</div>'
      + '<button class="vwg-dismiss" id="vwg-later">not now</button>';
    msgEl = sheet.querySelector('#vwg-msg');
    wireAuth();
  }

  function setMode(m) {
    mode = m;
    sheet.querySelectorAll('.vwg-tab').forEach(function (t) { t.classList.toggle('on', t.dataset.mode === m); });
    sheet.querySelector('#vwg-nameWrap').style.display = (m === 'signup') ? '' : 'none';
    sheet.querySelector('#vwg-go').textContent = (m === 'signup') ? 'Begin' : 'Enter';
    sheet.querySelector('#vwg-pass').setAttribute('autocomplete', m === 'signup' ? 'new-password' : 'current-password');
  }

  function wireAuth() {
    sheet.querySelector('#vwg-close').onclick = closeSheet;
    sheet.querySelector('#vwg-later').onclick = function () { ls('vwg_dismissed', String(Date.now())); closeSheet(); };
    sheet.querySelectorAll('.vwg-tab').forEach(function (t) { t.onclick = function () { setMode(t.dataset.mode); }; });

    var pwa = sheet.querySelector('#vwg-pwa');
    if (pwa) pwa.onclick = function (e) {
      e.preventDefault();
      if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt.userChoice.finally(function () { deferredPrompt = null; }); }
      else { window.open('phone.html', '_blank'); } // iOS / no-prompt fallback
    };
    sheet.querySelectorAll('[data-soon]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); flash('Coming soon — we will light this up the moment it is live.'); }; });

    sheet.querySelector('#vwg-go').onclick = doAuth;
    [sheet.querySelector('#vwg-email'), sheet.querySelector('#vwg-pass'), sheet.querySelector('#vwg-name')].forEach(function (el) {
      if (el) el.addEventListener('keydown', function (e) { if (e.key === 'Enter') doAuth(); });
    });
  }

  function flash(t, ok) { if (msgEl) { msgEl.textContent = t; msgEl.style.color = ok ? 'rgba(120,220,160,.9)' : 'rgba(150,175,215,.7)'; } }

  function doAuth() {
    var email = (sheet.querySelector('#vwg-email').value || '').trim();
    var pass = sheet.querySelector('#vwg-pass').value || '';
    var name = (sheet.querySelector('#vwg-name') && sheet.querySelector('#vwg-name').value || '').trim();
    if (!email || !pass) { flash('Email and password, please.'); return; }
    if (mode === 'signup' && !name) { flash('Tell her what to call you.'); return; }
    var go = sheet.querySelector('#vwg-go'); go.disabled = true; flash(mode === 'signup' ? 'Creating…' : 'Entering…');
    var p = (mode === 'signup') ? '/api/auth/signup' : '/api/auth/login';
    var body = (mode === 'signup') ? { email: email, password: pass, name: name, display_name: name } : { email: email, password: pass };
    fetch(API_BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        go.disabled = false;
        var tk = res.d && (res.d.accessToken || res.d.access_token || (res.d.data && res.d.data.accessToken));
        if (!res.ok || !tk) { flash((res.d && (res.d.error || res.d.message)) || 'That did not work — try again.'); return; }
        setToken(tk);
        var rt = res.d.refreshToken || res.d.refresh_token || (res.d.data && res.d.data.refreshToken);
        if (rt) { ls('vint_refresh_token', rt); ls('soul_auth_refresh', rt); }
        if (res.d.user) { try { localStorage.setItem('vint_user', JSON.stringify(res.d.user)); } catch (_) {} }
        flash('✓ Welcome.', true);
        var onboarded = ls('vint_onboarded') === '1';
        setTimeout(function () {
          if (mode === 'signup' && !onboarded) location.href = ONBOARD_URL;   // new → onboarding
          else location.reload();                                              // returning → refresh in place
        }, 650);
      })
      .catch(function () { go.disabled = false; flash('Network hiccup — try again in a moment.'); });
  }

  function openSheet() { injectCss(); if (!scrim) buildSheet(); renderAuth(); scrim.classList.add('show'); }
  function closeSheet() { if (scrim) scrim.classList.remove('show'); }

  // ── persistent affordance ─────────────────────────────────────────────────
  function mountPill() {
    injectCss();
    if (signedIn()) {
      // tiny account dot — unobtrusive, opens sheet to manage/install
      if (document.getElementById('vwg-pill')) document.getElementById('vwg-pill').remove();
      if (document.getElementById('vwg-dot')) return;
      var dot = document.createElement('button'); dot.id = 'vwg-dot'; dot.title = 'Account & install'; dot.textContent = '✦';
      dot.onclick = openSheet;
      document.body.appendChild(dot);
      return;
    }
    if (document.getElementById('vwg-pill')) return;
    var pill = document.createElement('button'); pill.id = 'vwg-pill';
    pill.innerHTML = '<span>✦</span><span>Begin</span>';
    pill.onclick = openSheet;
    document.body.appendChild(pill);
  }

  // First-visit welcome: open the sheet once for a brand-new logged-out visitor
  // (unless they dismissed it). Non-blocking — they can close instantly.
  function maybeFirstVisit() {
    if (signedIn()) return;
    if (ls('vwg_seen') === '1') return;
    if (ls('vwg_dismissed')) return;
    ls('vwg_seen', '1');
    setTimeout(openSheet, 900);   // let the page paint first
  }

  function boot() {
    if (!document.body) { return setTimeout(boot, 50); }
    mountPill();
    maybeFirstVisit();
    // Re-evaluate the affordance if auth changes elsewhere (shell.js broadcasts).
    try {
      window.addEventListener('storage', function (e) { if (e.key && e.key.indexOf('token') !== -1) mountPill(); });
      window.addEventListener('vint:auth', mountPill);
    } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // expose for manual triggering (e.g. a "Sign in" link anywhere can call this)
  window.VintWelcomeGate = { open: openSheet, close: closeSheet, signedIn: signedIn };
})();
