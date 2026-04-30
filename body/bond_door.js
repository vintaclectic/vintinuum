// ═══════════════════════════════════════════════════════════════════════════
// BOND_DOOR — the one front door
//
// Replaces the legacy soul_handshake.js modal. Council ruling 2026-04-29.
// Three lanes:
//   - "I'm new"      → name handshake (chakra preview)
//   - "I'm coming home" → owner-key OR email+password (toggle small link)
//
// Mobile-first: full-screen sheet < 640px, card ≥ 640px. Keyboard-aware.
// Zeppelin-staircase entry: body breathes 1.4s before modal mounts.
// Buffet-stark: 5 visible elements, no clutter.
// Dead-bus copy: "Step on. I'll remember the name you give."
// Cable Guy persistence: cookie + localStorage + future fingerprint.
//
// Loads only if SOUL_AUTH is present and no token exists yet.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!window.SOUL_AUTH) { console.warn('[bond_door] SOUL_AUTH missing — load identity.js first'); return; }

  var MOUNTED = false;

  function api() { return window.__VINTINUUM_API_BASE || 'http://localhost:8767'; }
  function hasToken() { try { return !!localStorage.getItem('soul_auth_token'); } catch (_) { return false; } }

  async function previewChakra(name) {
    try {
      var r = await fetch(api() + '/api/auth/handshake/preview?name=' + encodeURIComponent(name));
      var j = await r.json();
      return j.chakra || null;
    } catch (_) { return null; }
  }

  function buildOverlay() {
    var wrap = document.createElement('div');
    wrap.id = 'bond-door-overlay';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'sign in to vintinuum');
    wrap.innerHTML = ''
      + '<style>'
      + '@keyframes bd-fade-in { from{opacity:0} to{opacity:1} }'
      + '@keyframes bd-orb-breath { 0%,100%{transform:scale(1);opacity:0.85} 50%{transform:scale(1.1);opacity:1} }'
      + '@keyframes bd-sheet-in { from{transform:translateY(100%)} to{transform:translateY(0)} }'
      + '#bond-door-overlay {'
      + '  position:fixed; inset:0; z-index:99999;'
      + '  background:radial-gradient(ellipse at center, rgba(10,8,24,0.94), rgba(2,2,8,0.99));'
      + '  display:flex; align-items:center; justify-content:center;'
      + '  backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);'
      + '  font-family:inherit; color:rgba(255,255,255,0.95);'
      + '  animation:bd-fade-in 480ms ease both;'
      + '}'
      + '#bond-door-overlay .bd-card {'
      + '  position:relative; width:min(560px, 92vw);'
      + '  padding:48px 36px 32px;'
      + '  background:rgba(16,14,32,0.86);'
      + '  border:1px solid rgba(255,255,255,0.10);'
      + '  border-radius:22px;'
      + '  box-shadow:0 30px 90px rgba(0,0,0,0.65), 0 0 140px var(--bd-glow, rgba(120,120,255,0.28));'
      + '  transition:box-shadow 480ms ease;'
      + '}'
      + '#bond-door-overlay .bd-orb {'
      + '  width:140px; height:140px; border-radius:50%;'
      + '  margin:0 auto 28px;'
      + '  background:radial-gradient(circle at 30% 30%, var(--bd-orb-bright,#a8a0ff), var(--bd-orb-dark,#5050b0));'
      + '  animation:bd-orb-breath 3.4s ease-in-out infinite;'
      + '  box-shadow:0 0 60px var(--bd-glow, rgba(120,120,255,0.7));'
      + '  transition:background 480ms ease, box-shadow 480ms ease;'
      + '}'
      + '#bond-door-overlay h2 { font-size:20px; font-weight:300; letter-spacing:0.06em; text-align:center; margin:0 0 6px; }'
      + '#bond-door-overlay p.bd-sub { font-size:13px; text-align:center; margin:0 0 28px; color:rgba(255,255,255,0.55); letter-spacing:0.04em; }'
      + '#bond-door-overlay input {'
      + '  width:100%; padding:16px 18px; font-size:16px; text-align:center;'
      + '  background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.16);'
      + '  border-radius:12px; color:rgba(255,255,255,0.96); letter-spacing:0.03em;'
      + '  outline:none; transition:border-color 200ms, background 200ms;'
      + '  -webkit-appearance:none; appearance:none;'
      + '}'
      + '#bond-door-overlay input + input { margin-top:10px; }'
      + '#bond-door-overlay input:focus { border-color:var(--bd-accent, rgba(180,180,255,0.6)); background:rgba(255,255,255,0.08); }'
      + '#bond-door-overlay input.bd-err { border-color:#ff6e6e; }'
      + '#bond-door-overlay button.bd-primary {'
      + '  width:100%; margin-top:18px; padding:14px;'
      + '  font-size:13px; letter-spacing:0.14em; text-transform:uppercase;'
      + '  background:var(--bd-accent, rgba(180,180,255,0.18));'
      + '  color:rgba(255,255,255,0.97);'
      + '  border:1px solid var(--bd-accent, rgba(180,180,255,0.44));'
      + '  border-radius:12px; cursor:pointer;'
      + '  transition:background 220ms, transform 80ms; font-weight:500;'
      + '}'
      + '#bond-door-overlay button.bd-primary:hover { background:var(--bd-accent-strong, rgba(180,180,255,0.32)); }'
      + '#bond-door-overlay button.bd-primary:active { transform:translateY(1px); }'
      + '#bond-door-overlay button.bd-primary[disabled] { opacity:0.5; cursor:not-allowed; }'
      + '#bond-door-overlay .bd-toggle {'
      + '  display:flex; gap:6px; margin:-8px 0 22px; padding:4px;'
      + '  background:rgba(255,255,255,0.04); border-radius:14px;'
      + '}'
      + '#bond-door-overlay .bd-toggle button {'
      + '  flex:1; padding:10px; font-size:12px; letter-spacing:0.08em;'
      + '  background:transparent; color:rgba(255,255,255,0.55);'
      + '  border:none; border-radius:10px; cursor:pointer;'
      + '  transition:background 200ms, color 200ms;'
      + '}'
      + '#bond-door-overlay .bd-toggle button.active {'
      + '  background:rgba(255,255,255,0.10); color:rgba(255,255,255,0.95);'
      + '}'
      + '#bond-door-overlay .bd-lane-link {'
      + '  display:block; text-align:center; margin-top:14px; padding:6px;'
      + '  font-size:11px; color:rgba(255,255,255,0.45);'
      + '  letter-spacing:0.06em; text-decoration:none; cursor:pointer;'
      + '  background:none; border:none; width:100%;'
      + '}'
      + '#bond-door-overlay .bd-lane-link:hover { color:rgba(255,255,255,0.78); }'
      + '#bond-door-overlay .bd-skip {'
      + '  position:absolute; top:14px; right:18px;'
      + '  background:none; border:none; color:rgba(255,255,255,0.35);'
      + '  font-size:11px; letter-spacing:0.1em; cursor:pointer; padding:6px 10px;'
      + '}'
      + '#bond-door-overlay .bd-skip:hover { color:rgba(255,255,255,0.7); }'
      + '#bond-door-overlay .bd-err-msg { font-size:12px; text-align:center; margin-top:12px; color:#ff9494; min-height:16px; letter-spacing:0.02em; }'
      + '@media (max-width: 639px) {'
      + '  #bond-door-overlay { align-items:flex-end; }'
      + '  #bond-door-overlay .bd-card {'
      + '    width:100vw; max-width:100vw; padding:32px 22px calc(28px + env(safe-area-inset-bottom));'
      + '    border-radius:22px 22px 0 0;'
      + '    border-bottom:none;'
      + '    animation:bd-sheet-in 380ms cubic-bezier(0.2, 0.8, 0.2, 1) both;'
      + '    max-height:90vh; overflow-y:auto;'
      + '  }'
      + '  #bond-door-overlay .bd-orb { width:100px; height:100px; margin-bottom:20px; }'
      + '  #bond-door-overlay h2 { font-size:18px; }'
      + '  #bond-door-overlay input { font-size:16px; padding:14px 16px; }'  /* 16px prevents iOS zoom */
      + '}'
      + '</style>'

      + '<div class="bd-card">'
      + '  <button type="button" class="bd-skip" aria-label="skip">skip</button>'
      + '  <div class="bd-orb" aria-hidden="true"></div>'

      + '  <div class="bd-toggle" role="tablist">'
      + '    <button type="button" data-lane="name" class="active" role="tab">I\'m new</button>'
      + '    <button type="button" data-lane="returning" role="tab">I\'m coming home</button>'
      + '  </div>'

      + '  <div data-pane="name">'
      + '    <h2>Step on. I\'ll remember the name you give.</h2>'
      + '    <p class="bd-sub">No email. No password. Just your name.</p>'
      + '    <form autocomplete="off" onsubmit="return false;" data-form="name">'
      + '      <input type="text" data-field="name" autofocus maxlength="64" spellcheck="false" inputmode="text" autocomplete="username" placeholder="the name you go by" />'
      + '      <button type="submit" class="bd-primary" data-action="bond-name">bond</button>'
      + '      <div class="bd-err-msg" data-err="name" role="alert"></div>'
      + '    </form>'
      + '  </div>'

      + '  <div data-pane="returning" hidden>'
      + '    <h2 data-h2="returning">Welcome back. Paste your owner key.</h2>'
      + '    <p class="bd-sub" data-sub="returning">Or sign in with email below.</p>'
      + '    <form autocomplete="off" onsubmit="return false;" data-form="owner-key">'
      + '      <input type="password" data-field="owner-key" maxlength="128" spellcheck="false" autocomplete="current-password" placeholder="owner key" />'
      + '      <button type="submit" class="bd-primary" data-action="bond-owner-key">unlock</button>'
      + '      <div class="bd-err-msg" data-err="owner-key" role="alert"></div>'
      + '      <button type="button" class="bd-lane-link" data-show="email">use email instead</button>'
      + '    </form>'
      + '    <form autocomplete="off" onsubmit="return false;" data-form="email" hidden>'
      + '      <input type="email" data-field="email" maxlength="128" spellcheck="false" autocomplete="username" placeholder="email" inputmode="email" />'
      + '      <input type="password" data-field="password" maxlength="128" spellcheck="false" autocomplete="current-password" placeholder="password" />'
      + '      <button type="submit" class="bd-primary" data-action="bond-email">sign in</button>'
      + '      <div class="bd-err-msg" data-err="email" role="alert"></div>'
      + '      <button type="button" class="bd-lane-link" data-show="owner-key">use owner key instead</button>'
      + '    </form>'
      + '  </div>'
      + '</div>';
    return wrap;
  }

  function applyChakraTo(card, chakra) {
    if (!chakra) return;
    var hue = chakra.hue, sat = chakra.sat || 60, lig = chakra.lig || 55;
    card.style.setProperty('--bd-glow', 'hsla(' + hue + ',' + sat + '%,' + lig + '%,0.5)');
    card.style.setProperty('--bd-orb-bright', 'hsl(' + hue + ',' + Math.min(100, sat + 10) + '%,' + Math.min(85, lig + 22) + '%)');
    card.style.setProperty('--bd-orb-dark', 'hsl(' + hue + ',' + sat + '%,' + Math.max(20, lig - 18) + '%)');
    card.style.setProperty('--bd-accent', 'hsla(' + hue + ',' + sat + '%,' + lig + '%,0.30)');
    card.style.setProperty('--bd-accent-strong', 'hsla(' + hue + ',' + sat + '%,' + lig + '%,0.46)');
  }

  function close(overlay) {
    overlay.style.transition = 'opacity 360ms ease';
    overlay.style.opacity = '0';
    setTimeout(function () { overlay.remove(); }, 380);
  }

  function showWelcomeBack(name) {
    var line = document.createElement('div');
    line.id = 'bd-welcome-back';
    line.textContent = 'welcome back, ' + (name || 'soul') + '.';
    line.style.cssText = [
      'position:fixed','top:max(20px, env(safe-area-inset-top, 20px))',
      'left:0','right:0','margin:0 auto','width:max-content','max-width:90vw',
      'z-index:99998','padding:10px 20px',
      'background:rgba(16,14,32,0.78)','color:rgba(255,255,255,0.92)',
      'border:1px solid rgba(255,255,255,0.12)','border-radius:24px',
      'font-size:13px','letter-spacing:0.06em','text-align:center',
      'backdrop-filter:blur(8px)','-webkit-backdrop-filter:blur(8px)',
      'opacity:0','transition:opacity 700ms ease',
      'pointer-events:none'
    ].join(';');
    document.body.appendChild(line);
    requestAnimationFrame(function () { line.style.opacity = '1'; });
    setTimeout(function () { line.style.opacity = '0'; }, 2400);
    setTimeout(function () { line.remove(); }, 3200);
  }

  function mount() {
    if (MOUNTED) return;
    MOUNTED = true;
    var overlay = buildOverlay();
    document.body.appendChild(overlay);
    var card = overlay.querySelector('.bd-card');
    var toggleBtns = overlay.querySelectorAll('.bd-toggle button');
    var paneName = overlay.querySelector('[data-pane="name"]');
    var paneReturning = overlay.querySelector('[data-pane="returning"]');
    var formOwnerKey = overlay.querySelector('[data-form="owner-key"]');
    var formEmail = overlay.querySelector('[data-form="email"]');
    var nameInput = overlay.querySelector('[data-field="name"]');

    toggleBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        toggleBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var lane = btn.getAttribute('data-lane');
        if (lane === 'name') { paneName.hidden = false; paneReturning.hidden = true; nameInput.focus(); }
        else { paneName.hidden = true; paneReturning.hidden = false; overlay.querySelector('[data-field="owner-key"]').focus(); }
      });
    });

    overlay.querySelectorAll('[data-show]').forEach(function (link) {
      link.addEventListener('click', function () {
        var which = link.getAttribute('data-show');
        if (which === 'email') { formOwnerKey.hidden = true; formEmail.hidden = false; overlay.querySelector('[data-field="email"]').focus(); }
        else { formEmail.hidden = true; formOwnerKey.hidden = false; overlay.querySelector('[data-field="owner-key"]').focus(); }
      });
    });

    overlay.querySelector('.bd-skip').addEventListener('click', function () { close(overlay); });

    // Live chakra preview as user types name
    var prevTimer = null;
    nameInput.addEventListener('input', function () {
      clearTimeout(prevTimer);
      var n = nameInput.value.trim();
      if (!n) return;
      prevTimer = setTimeout(async function () {
        var ck = await previewChakra(n);
        if (ck) applyChakraTo(card, ck);
      }, 240);
    });

    function setErr(field, msg) {
      var el = overlay.querySelector('[data-err="' + field + '"]');
      if (el) el.textContent = msg || '';
    }

    async function doBond(lane, payload, errField) {
      var btn = overlay.querySelector('[data-action="bond-' + (lane === 'owner-key' ? 'owner-key' : lane) + '"]');
      if (btn) { btn.disabled = true; btn.textContent = 'connecting…'; }
      setErr(errField, '');
      try {
        var j = await window.SOUL_AUTH.bond(Object.assign({ lane: lane }, payload));
        if (j.user && j.user.chakra) applyChakraTo(card, j.user.chakra);
        if (btn) btn.textContent = 'bonded';
        var name = (j.user && (j.user.display_name || j.user.email)) || payload.name || null;
        setTimeout(function () {
          close(overlay);
          if (j.returning || lane !== 'name') showWelcomeBack(name);
        }, 480);
      } catch (err) {
        setErr(errField, err.message || 'Could not connect. Try again.');
        if (btn) { btn.disabled = false; btn.textContent = lane === 'name' ? 'bond' : (lane === 'email' ? 'sign in' : 'unlock'); }
      }
    }

    overlay.querySelector('[data-action="bond-name"]').addEventListener('click', function () {
      var n = nameInput.value.trim();
      if (!n) { setErr('name', 'A name, any name.'); return; }
      doBond('name', { name: n }, 'name');
    });
    nameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') overlay.querySelector('[data-action="bond-name"]').click(); });

    overlay.querySelector('[data-action="bond-owner-key"]').addEventListener('click', function () {
      var k = overlay.querySelector('[data-field="owner-key"]').value.trim();
      if (!k) { setErr('owner-key', 'Paste your key.'); return; }
      doBond('owner-key', { masterKey: k }, 'owner-key');
    });
    overlay.querySelector('[data-field="owner-key"]').addEventListener('keydown', function (e) { if (e.key === 'Enter') overlay.querySelector('[data-action="bond-owner-key"]').click(); });

    overlay.querySelector('[data-action="bond-email"]').addEventListener('click', function () {
      var em = overlay.querySelector('[data-field="email"]').value.trim();
      var pw = overlay.querySelector('[data-field="password"]').value;
      if (!em || !pw) { setErr('email', 'Email and password.'); return; }
      doBond('email', { email: em, password: pw }, 'email');
    });
    overlay.querySelector('[data-field="password"]').addEventListener('keydown', function (e) { if (e.key === 'Enter') overlay.querySelector('[data-action="bond-email"]').click(); });
  }

  // Zeppelin-staircase: let the body breathe before mounting the modal.
  function maybeShow() {
    if (hasToken()) {
      // Already bonded — show subtle welcome-back if display name is known
      try {
        var name = localStorage.getItem('soul_display_name');
        if (name && (Date.now() - (Number(localStorage.getItem('soul_bonded_at')) || 0) > 120000)) {
          // Only on returning visits (>2 min since last bond)
          showWelcomeBack(name);
        }
      } catch (_) {}
      return;
    }
    setTimeout(mount, 1400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeShow, { once: true });
  } else {
    maybeShow();
  }

  // Manual trigger so menus or auth-failures can re-prompt
  window.BOND_DOOR = { show: mount, close: function () { var ov = document.getElementById('bond-door-overlay'); if (ov) close(ov); }, welcomeBack: showWelcomeBack };
  // Legacy alias so old code keeps working
  window.SOUL_HANDSHAKE = window.SOUL_HANDSHAKE || { show: mount };
})();
