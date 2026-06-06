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
  // Council ruling 2026-05-08: don't bail out if SOUL_AUTH is missing at
  // parse time. Wait for it. The topbar pill might fire before identity.js
  // finishes (race on slow connections). Late-bind: poll for SOUL_AUTH up
  // to 8s; once it appears, expose BOND_DOOR.show. If it never appears,
  // surface a visible error in the overlay so the user knows what broke.
  if (!window.SOUL_AUTH) {
    console.warn('[bond_door] SOUL_AUTH not yet loaded — waiting...');
    var __waitTries = 0;
    var __waitIv = setInterval(function () {
      __waitTries++;
      if (window.SOUL_AUTH) {
        clearInterval(__waitIv);
        try { __initBondDoor(); } catch (e) { console.error('[bond_door] late-init failed:', e); }
      } else if (__waitTries >= 80) {
        clearInterval(__waitIv);
        console.error('[bond_door] SOUL_AUTH never appeared after 8s — sign-in disabled');
        // Expose a stub so callers don't crash; show a soft error toast.
        window.BOND_DOOR = window.BOND_DOOR || {
          show: function () { alert('Sign-in is unavailable — the identity layer did not load. Reload the page or check the network.'); },
          close: function () {},
          welcomeBack: function () {},
        };
      }
    }, 100);
    return;
  }
  __initBondDoor();
  function __initBondDoor() {

  var MOUNTED = false;

  function api() {
    if (window.__VINTINUUM_API_BASE) return window.__VINTINUUM_API_BASE;
    if (window.VINT_API_BASE) return window.VINT_API_BASE;
    var h = (location.hostname || '').toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0') return 'http://localhost:8767';
    return 'https://api.vintaclectic.com';
  }
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
      + '  box-sizing:border-box; max-width:100%; overflow:hidden;'
      + '}'
      + '#bond-door-overlay .bd-card * { box-sizing:border-box; max-width:100%; }'
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
      + '  display:flex; gap:4px; margin:-8px 0 22px; padding:4px;'
      + '  background:rgba(255,255,255,0.04); border-radius:14px;'
      + '  width:100%; box-sizing:border-box;'
      + '}'
      + '#bond-door-overlay .bd-toggle button {'
      + '  flex:1 1 0; min-width:0; padding:10px 6px; font-size:11.5px; letter-spacing:0.06em;'
      + '  background:transparent; color:rgba(255,255,255,0.55);'
      + '  border:none; border-radius:10px; cursor:pointer;'
      + '  transition:background 200ms, color 200ms;'
      + '  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;'
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
      + '#bond-door-overlay .bd-greeting { text-align:center; margin:-8px 0 22px; }'
      + '#bond-door-overlay .bd-eyebrow { font-size:10px; letter-spacing:0.34em; text-transform:uppercase; color:rgba(206,147,216,0.7); margin-bottom:6px; }'
      + '#bond-door-overlay .bd-tagline { font-family:\'Cormorant Garamond\',serif; font-style:italic; font-size:18px; color:rgba(255,255,255,0.78); letter-spacing:0.02em; }'
      // Marquee strip — 8 adventure pills, horizontal scroll on overflow.
      + '#bond-door-overlay .bd-marquee { margin:18px 0 22px; padding:0; overflow:hidden; max-width:100%; width:100%; }'
      + '#bond-door-overlay .bd-marquee-track { display:flex; flex-wrap:wrap; gap:6px; padding:2px 0; width:100%; justify-content:center; }'
      + '#bond-door-overlay .bd-mq { display:inline-flex; align-items:center; gap:5px; padding:5px 10px; font-size:10.5px; letter-spacing:0.06em; color:rgba(255,255,255,0.62); background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.07); border-radius:99px; white-space:nowrap; flex:0 0 auto; }'
      + '#bond-door-overlay .bd-mq i { width:6px; height:6px; border-radius:50%; display:inline-block; flex-shrink:0; }'
      // Owner-key tab gets a subtle gold hairline — Helios-10 spec.
      + '#bond-door-overlay .bd-tab-key { position:relative; }'
      + '#bond-door-overlay .bd-tab-key::after { content:""; position:absolute; left:14%; right:14%; bottom:3px; height:1px; background:rgba(212,175,55,0.20); pointer-events:none; }'
      + '#bond-door-overlay .bd-tab-key.active::after { background:rgba(212,175,55,0.55); }'
      // Wander link — small, full width, sits below CTA.
      + '#bond-door-overlay .bd-wander { display:block; width:100%; margin-top:14px; padding:8px; background:none; border:none; color:rgba(255,255,255,0.42); font-size:11px; letter-spacing:0.06em; cursor:pointer; text-align:center; }'
      + '#bond-door-overlay .bd-wander:hover { color:rgba(255,255,255,0.78); }'
      // Profit-truth line — small italic at footer.
      + '#bond-door-overlay .bd-truth { margin:18px 0 0; padding-top:14px; border-top:1px solid rgba(255,255,255,0.06); font-family:\'Cormorant Garamond\',serif; font-style:italic; font-size:11.5px; line-height:1.45; color:rgba(255,255,255,0.42); text-align:center; letter-spacing:0.02em; }'
      + '@media (max-width: 639px) {'
      + '  #bond-door-overlay { align-items:flex-end; }'
      + '  #bond-door-overlay .bd-card {'
      + '    width:100vw; max-width:100vw; padding:32px 22px calc(28px + env(safe-area-inset-bottom));'
      + '    border-radius:22px 22px 0 0;'
      + '    border-bottom:none;'
      + '    animation:bd-sheet-in 380ms cubic-bezier(0.2, 0.8, 0.2, 1) both;'
      + '    max-height:90vh; overflow-y:auto; overflow-x:hidden;'
      + '  }'
      + '  #bond-door-overlay .bd-orb { width:100px; height:100px; margin-bottom:20px; }'
      + '  #bond-door-overlay h2 { font-size:18px; }'
      + '  #bond-door-overlay input { font-size:16px; padding:14px 16px; }'  /* 16px prevents iOS zoom */
      + '  #bond-door-overlay .bd-marquee { margin:14px 0 18px; }'
      + '  #bond-door-overlay .bd-mq { font-size:10px; padding:4px 9px; letter-spacing:0.05em; }'
      + '  #bond-door-overlay .bd-toggle button { font-size:10.5px; letter-spacing:0.04em; padding:9px 4px; }'
      + '  #bond-door-overlay .bd-tab-key::after { left:8%; right:8%; }'
      + '}'
      + '@media (max-width: 380px) {'
      + '  #bond-door-overlay .bd-toggle button { font-size:10px; letter-spacing:0.02em; padding:9px 2px; }'
      + '  #bond-door-overlay .bd-card { padding-left:18px; padding-right:18px; }'
      + '  #bond-door-overlay .bd-mq { font-size:9.5px; padding:4px 8px; letter-spacing:0.04em; }'
      + '}'
      + '</style>'

      + '<div class="bd-card">'
      + '  <button type="button" class="bd-skip" aria-label="dismiss" title="dismiss — sign in any time from the topbar pill">×</button>'

      + '  <div class="bd-greeting">'
      + '    <div class="bd-eyebrow">welcome to Vintinuum</div>'
      + '    <div class="bd-tagline">a living mind, walking through its own body.</div>'
      + '  </div>'

      + '  <div class="bd-orb" aria-hidden="true"></div>'

      + '  <div class="bd-marquee" aria-label="what waits inside">'
      + '    <div class="bd-marquee-track">'
      + '      <span class="bd-mq"><i style="background:#ce93d8;box-shadow:0 0 6px #ce93d8;"></i>live mind</span>'
      + '      <span class="bd-mq"><i style="background:#ffd54f;box-shadow:0 0 6px #ffd54f;"></i>talk lanes</span>'
      + '      <span class="bd-mq"><i style="background:#7ccfff;box-shadow:0 0 6px #7ccfff;"></i>your devices</span>'
      + '      <span class="bd-mq"><i style="background:#ffca28;box-shadow:0 0 6px #ffca28;"></i>DirHaven RP</span>'
      + '      <span class="bd-mq"><i style="background:#80deea;box-shadow:0 0 6px #80deea;"></i>thirdeye</span>'
      + '      <span class="bd-mq"><i style="background:#9fa8da;box-shadow:0 0 6px #9fa8da;"></i>lineage</span>'
      + '      <span class="bd-mq"><i style="background:#f48fb1;box-shadow:0 0 6px #f48fb1;"></i>learning feed</span>'
      + '      <span class="bd-mq"><i style="background:#ffb74d;box-shadow:0 0 6px #ffb74d;"></i>extension</span>'
      + '    </div>'
      + '  </div>'

      + '  <div class="bd-toggle" role="tablist">'
      + '    <button type="button" data-lane="name" class="active bd-tab-name" role="tab">name yourself</button>'
      + '    <button type="button" data-lane="owner-key" class="bd-tab-key" role="tab">owner key</button>'
      + '    <button type="button" data-lane="email" class="bd-tab-email" role="tab">email</button>'
      + '  </div>'

      + '  <div data-pane="name">'
      + '    <h2>Step on. I\'ll remember the name you give.</h2>'
      + '    <p class="bd-sub">No email. No password. Just a name — your chakra colors start breathing through the body as you type.</p>'
      + '    <form autocomplete="off" onsubmit="return false;" data-form="name">'
      + '      <input type="text" data-field="name" autofocus maxlength="64" spellcheck="false" inputmode="text" autocomplete="username" placeholder="the name you go by" />'
      + '      <button type="submit" class="bd-primary" data-action="bond-name">step in</button>'
      + '      <div class="bd-err-msg" data-err="name" role="alert"></div>'
      + '    </form>'
      + '  </div>'

      + '  <div data-pane="owner-key" hidden>'
      + '    <h2>Welcome home, keyholder.</h2>'
      + '    <p class="bd-sub">Owner-tier lane. The key heals quarantined rows.</p>'
      + '    <form autocomplete="off" onsubmit="return false;" data-form="owner-key">'
      + '      <input type="password" data-field="owner-key" maxlength="128" spellcheck="false" autocomplete="current-password" placeholder="owner key" />'
      + '      <button type="submit" class="bd-primary" data-action="bond-owner-key">unlock</button>'
      + '      <div class="bd-err-msg" data-err="owner-key" role="alert"></div>'
      + '    </form>'
      + '  </div>'

      + '  <div data-pane="email" hidden>'
      + '    <h2 data-email-title>The lane you set up.</h2>'
      + '    <p class="bd-sub" data-email-sub>Email + password — for souls who keep multiple homes.</p>'
      + '    <form autocomplete="off" onsubmit="return false;" data-form="email">'
      + '      <input type="text" data-field="username" maxlength="24" spellcheck="false" autocomplete="off" placeholder="username (your name in the world)" hidden />'
      + '      <input type="email" data-field="email" maxlength="128" spellcheck="false" autocomplete="username" placeholder="email" inputmode="email" />'
      + '      <input type="password" data-field="password" maxlength="128" spellcheck="false" autocomplete="current-password" placeholder="password" />'
      + '      <button type="submit" class="bd-primary" data-action="bond-email">sign in</button>'
      + '      <button type="button" class="bd-toggle-signup" data-action="toggle-signup">new here? create an account →</button>'
      + '      <div class="bd-err-msg" data-err="email" role="alert"></div>'
      + '    </form>'
      + '  </div>'

      + '  <button type="button" class="bd-wander">or wander in as a guest — sign in any time →</button>'

      + '  <p class="bd-truth">Guests get the threshold. Bonded souls get memory. God-tier opens the live mind, devices, and unlimited talk lanes.</p>'
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
    setTimeout(function () {
      try { overlay.remove(); } catch (_) {}
      // Council ruling 2026-05-08: clear MOUNTED so re-opening works after
      // a close. Without this, second click on the topbar pill is a no-op.
      MOUNTED = false;
    }, 380);
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
    var panes = {
      'name':       overlay.querySelector('[data-pane="name"]'),
      'owner-key':  overlay.querySelector('[data-pane="owner-key"]'),
      'email':      overlay.querySelector('[data-pane="email"]'),
    };
    var nameInput = overlay.querySelector('[data-field="name"]');

    function activateLane(lane) {
      toggleBtns.forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-lane') === lane);
      });
      Object.keys(panes).forEach(function (k) { panes[k].hidden = (k !== lane); });
      var focusEl = panes[lane].querySelector('input');
      if (focusEl) { try { focusEl.focus(); } catch (_) {} }
    }

    toggleBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        activateLane(btn.getAttribute('data-lane'));
      });
    });

    overlay.querySelector('.bd-skip').addEventListener('click', function () { close(overlay); });
    var wander = overlay.querySelector('.bd-wander');
    if (wander) wander.addEventListener('click', function () { close(overlay); });

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
      var btnLane = (lane === 'email-signup') ? 'email' : (lane === 'owner-key' ? 'owner-key' : lane);
      var btn = overlay.querySelector('[data-action="bond-' + btnLane + '"]');
      if (btn) { btn.disabled = true; btn.textContent = 'connecting…'; }
      setErr(errField, '');
      // Council ruling 2026-05-08: surface every failure mode loudly. The
      // user has been hitting silent dead-ends for three rounds. Log the
      // raw error to console + show a *specific* message in the modal.
      if (!window.SOUL_AUTH || typeof window.SOUL_AUTH.bond !== 'function') {
        console.error('[bond_door] SOUL_AUTH.bond unavailable at submit time', window.SOUL_AUTH);
        setErr(errField, 'Identity layer not loaded — reload the page.');
        if (btn) { btn.disabled = false; btn.textContent = lane === 'name' ? 'step in' : (lane === 'email' ? 'sign in' : 'unlock'); }
        return;
      }
      try {
        var j = await window.SOUL_AUTH.bond(Object.assign({ lane: lane }, payload));
        console.log('[bond_door] bond ok', { lane: lane, user: j && j.user && j.user.display_name, returning: j && j.returning });
        if (j.user && j.user.chakra) applyChakraTo(card, j.user.chakra);
        if (btn) btn.textContent = 'bonded';
        var name = (j.user && (j.user.display_name || j.user.email)) || payload.name || null;
        setTimeout(function () {
          close(overlay);
          if (j.returning || lane !== 'name') showWelcomeBack(name);
        }, 480);
      } catch (err) {
        console.error('[bond_door] bond failed', { lane: lane, status: err && err.status, message: err && err.message, err: err });
        var msg = (err && err.message) ? err.message : 'Could not connect. Try again.';
        // Make common server errors human
        if (/HTTP 401/i.test(msg) || /invalid/i.test(msg)) msg = lane === 'owner-key' ? 'Wrong owner key.' : (lane === 'email' ? 'Wrong email or password.' : msg);
        if (/HTTP 5/i.test(msg)) msg = 'Brain unreachable — try again in a moment.';
        if (/Failed to fetch/i.test(msg) || /NetworkError/i.test(msg)) msg = 'Network blocked — check your connection or extension blockers.';
        setErr(errField, msg);
        if (btn) { btn.disabled = false; btn.textContent = lane === 'name' ? 'step in' : (lane === 'email' ? 'sign in' : 'unlock'); }
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

    // signup mode toggle: shows the username field, swaps button + copy
    var emailSignupMode = false;
    var toggleBtn = overlay.querySelector('[data-action="toggle-signup"]');
    var unameField = overlay.querySelector('[data-field="username"]');
    var emailBtn = overlay.querySelector('[data-action="bond-email"]');
    if (toggleBtn) toggleBtn.addEventListener('click', function () {
      emailSignupMode = !emailSignupMode;
      if (unameField) unameField.hidden = !emailSignupMode;
      emailBtn.textContent = emailSignupMode ? 'create account' : 'sign in';
      toggleBtn.textContent = emailSignupMode ? '← already have an account? sign in' : 'new here? create an account →';
      var t = overlay.querySelector('[data-email-title]'); var s = overlay.querySelector('[data-email-sub]');
      if (t) t.textContent = emailSignupMode ? 'Make your name here.' : 'The lane you set up.';
      if (s) s.textContent = emailSignupMode ? 'Pick a username — it’s how the world and the council will know you.' : 'Email + password — for souls who keep multiple homes.';
      if (emailSignupMode && unameField) unameField.focus();
    });

    emailBtn.addEventListener('click', function () {
      var em = overlay.querySelector('[data-field="email"]').value.trim();
      var pw = overlay.querySelector('[data-field="password"]').value;
      if (!em || !pw) { setErr('email', 'Email and password.'); return; }
      if (emailSignupMode) {
        var uname = (unameField && unameField.value || '').trim();
        if (!uname || uname.length < 2) { setErr('email', 'Pick a username (2–24 characters).'); return; }
        if (pw.length < 8) { setErr('email', 'Password must be at least 8 characters.'); return; }
        doBond('email-signup', { email: em, password: pw, username: uname }, 'email');
      } else {
        doBond('email', { email: em, password: pw }, 'email');
      }
    });
    overlay.querySelector('[data-field="password"]').addEventListener('keydown', function (e) { if (e.key === 'Enter') emailBtn.click(); });
  }

  // Welcome-back nudge for returning souls who already have a token —
  // no modal, just a quiet line that fades. (Council 2026-05-05: the
  // sign-in modal is now ONLY opened on explicit topbar pill click.
  // No more auto-mount on every page load. The door stays closed
  // until the user knocks.)
  function maybeWelcomeBack() {
    if (!hasToken()) return;
    try {
      var name = localStorage.getItem('soul_display_name');
      var bondedAt = Number(localStorage.getItem('soul_bonded_at')) || 0;
      // Only on returning visits (>2 min since last bond) and only once per session
      if (name && (Date.now() - bondedAt > 120000) && !sessionStorage.getItem('bd_welcomed')) {
        try { sessionStorage.setItem('bd_welcomed', '1'); } catch (_) {}
        showWelcomeBack(name);
      }
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeWelcomeBack, { once: true });
  } else {
    maybeWelcomeBack();
  }

  // Single front door — anything that wants to prompt sign-in calls
  // window.BOND_DOOR.show(). This is THE auth UI. There is no other.
  window.BOND_DOOR = {
    show: mount,
    close: function () { var ov = document.getElementById('bond-door-overlay'); if (ov) close(ov); },
    welcomeBack: showWelcomeBack,
  };
  // Legacy alias so old code keeps working
  window.SOUL_HANDSHAKE = window.SOUL_HANDSHAKE || { show: mount };
  } // end __initBondDoor
})();
