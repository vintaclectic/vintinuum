// ═══════════════════════════════════════════════════════════════════════════
// DIRHAVEN DOOR — the world half of running DirHaven INSIDE the engine
//
// Vinta directive 2026-07-30: "i want dirhaven app to run inside the engine."
//
// Not a link. Not a tab. A DOOR you walk through without leaving the clearing:
// the world keeps rendering, keeps its socket, keeps your body standing where
// you left it — and DirHaven raises inside an in-world panel, already signed in
// as you.
//
// THE HANDSHAKE (contract: CONTRACTS.md § "THE DIRHAVEN DOOR — SESSION HANDOFF",
// DirHaven half: dirhaven/client/src/vintDoor.js + server/routes/vint-sso.routes.js):
//   1. panel opens → iframe loads the DirHaven origin
//   2. DirHaven posts { type:'dirhaven:ready' } up to us
//   3. we post { type:'vint:session', token } DOWN — pinned to the exact origin
//   4. DirHaven exchanges that token SERVER-SIDE (never trusts it locally) and
//      adopts its own session
// We never receive a DirHaven credential; we only ever hand ours down. The token
// goes to ONE resolved origin, never '*'.
//
// LAWS honored:
//  - NO-COLLISION: the panel is a full-surface sheet with its own z-band (1620,
//    between the dv sheets at 1600 and the toast at 1700). While it is open every
//    other world control is inert-hidden, so nothing can ever sit on top of the
//    frame or under it. Launcher lives at the next free rail slot (bottom 318px)
//    below build (262) / agents (206) / star-map (150) — no stacking at any size.
//  - MOBILE-FIRST: 100svh-safe, keyboard-aware, safe-area insets, 44px+ targets.
//  - ALL BUTTONS DRAGGABLE: launcher carries data-draggable="true".
//  - FLAGGED: ?dirhaven=0 kills it in 30s with no deploy.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.DirHavenDoor) return;

  var W = window;

  // ── the DirHaven origin ────────────────────────────────────────────────────
  // AS OF 2026-08-25 DIRHAVEN IS PUBLIC AT https://app.dirhaven.com. The old
  // "no public origin" note above this line was written 2026-07-31 and is now
  // STALE — the street it said was dead has been paved. Verified live before
  // this edit, not assumed:
  //   · GET https://app.dirhaven.com → HTTP/2 200
  //   · served by pm2 `dirhaven-tunnel`, ingress `app.dirhaven.com →
  //     http://localhost:5175` in ~/.cloudflared/dirhaven.yml
  //   · its response carries
  //       content-security-policy: frame-ancestors 'self' https://vintaclectic.github.io
  //     i.e. DirHaven has ALREADY allowlisted this world's GitHub Pages origin
  //     (server/config/express.config.js → WORLD_FRAME_ANCESTORS), and
  //     'https://app.dirhaven.com' + 'https://vintaclectic.github.io' are both
  //     already in server/config/cors.config.js ALLOWED_ORIGINS.
  // Both halves of the handshake are therefore live; the only thing that was
  // missing was this side knowing the address.
  //
  // Resolution order (all explicit, never guessed):
  //   1. window.__DIRHAVEN_ORIGIN  — host-page override, wins over everything
  //   2. localStorage['vint:dirhaven-origin'] — owner/dev override, local hosts only
  //      (mirrors the allowlist rule in dirhaven/client/src/vintDoor.js)
  //   3. localhost:5175 when the world itself is running locally (dev keeps
  //      talking to the dev shell, never to production)
  //   4. PUBLIC_DIRHAVEN — the real, verified public origin
  // The function can still return null in principle and EVERY caller still
  // handles that; the null-safe paths below are deliberately kept rather than
  // deleted, because an origin can be un-set again (flag, outage, rollback) and
  // a door that assumes an address is a door that hangs on a spinner.
  var LOCAL_DIRHAVEN  = 'http://localhost:5175';
  var PUBLIC_DIRHAVEN = 'https://app.dirhaven.com';

  function devOrigin() {
    try {
      var raw = localStorage.getItem('vint:dirhaven-origin');
      if (!raw) return null;
      var u = new URL(raw);
      var h = u.hostname;
      var isLocal = (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local'));
      return isLocal ? u.origin : null;
    } catch (_) { return null; }
  }

  function worldIsLocal() {
    var h = (location.hostname || '').toLowerCase();
    return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h.endsWith('.local');
  }

  // May return null — every caller must handle that.
  function dirhavenOrigin() {
    if (W.__DIRHAVEN_ORIGIN) {
      try { return new URL(W.__DIRHAVEN_ORIGIN).origin; } catch (_) {}
    }
    var dev = devOrigin();
    if (dev) return dev;
    if (worldIsLocal()) return LOCAL_DIRHAVEN;
    return PUBLIC_DIRHAVEN;
  }

  function token() {
    try {
      return localStorage.getItem('vint_access_token')
        || localStorage.getItem('soul_auth_token')
        || localStorage.getItem('vint_token');
    } catch (_) { return null; }
  }

  // ── feature flag (killable in 30s, no deploy) ──────────────────────────────
  var DIRHAVEN_DEFAULT = true;
  function enabled() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('dirhaven') === '0') return false;
      if (q.get('dirhaven') === '1') return true;
    } catch (_) {}
    return DIRHAVEN_DEFAULT;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ═════════════════════════════════════════════════════════════════════════
  // STYLES — scoped to #dh-* / .dh-* so nothing leaks into the world or the
  // DirverseHUD sheet system.
  // ═════════════════════════════════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('dh-styles')) return;
    var s = document.createElement('style');
    s.id = 'dh-styles';
    s.textContent = [
      // launcher — a .dv-launch flow child of #dvRail. It inherits ALL geometry
      // (size, radius, font, the max-height:560px label collapse) from the rail's
      // own stylesheet; the rail measures and allocates the slot. We add only the
      // amber accent that tells the door apart from its siblings. Deliberately no
      // position/left/bottom here: hardcoding an offset is what put this button on
      // top of #dvBuildBtn in the first place.
      '#dhDoorBtn{color:#ffe0b2;border-color:rgba(255,202,40,0.36);}',
      '#dhDoorBtn .dot{background:#ffca28;box-shadow:0 0 8px #ffca28;}',

      // ── THE PANEL ──────────────────────────────────────────────────────────
      // Its own z-band (1620): above the dv sheets (1600) and veil (1590), below
      // the toast (1700). Full-surface so nothing can share pixels with it.
      '#dhPanel{position:fixed;inset:0;z-index:1620;display:none;',
      ' background:rgba(3,5,9,0.97);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);',
      ' flex-direction:column;',
      // 100svh where supported so the mobile URL bar can never clip the frame.
      ' height:100vh;height:100svh;}',
      '#dhPanel.open{display:flex;}',
      '@keyframes dh-rise{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:none;}}',
      '#dhPanel.open{animation:dh-rise .34s cubic-bezier(.22,1,.36,1);}',

      // header — its own fixed-height row; the frame gets the remainder. No overlap
      // is possible because this is a flex column, not a stack.
      '.dh-bar{flex:0 0 auto;display:flex;align-items:center;gap:10px;',
      ' padding:max(10px,env(safe-area-inset-top,10px)) max(12px,env(safe-area-inset-right,12px)) 10px max(12px,env(safe-area-inset-left,12px));',
      ' border-bottom:1px solid rgba(255,202,40,0.16);background:rgba(6,9,15,0.9);}',
      '.dh-name{flex:1 1 auto;min-width:0;font-family:"Cormorant Garamond",Georgia,serif;',
      ' color:#ffe9c4;font-size:18px;letter-spacing:.04em;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.dh-name small{display:block;font-size:11.5px;font-style:italic;letter-spacing:.05em;',
      ' color:rgba(255,224,178,0.6);margin-top:1px;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.dh-btn{flex:0 0 auto;min-width:44px;min-height:44px;border-radius:12px;cursor:pointer;',
      ' font-family:"Cormorant Garamond",Georgia,serif;font-size:13.5px;padding:0 13px;',
      ' color:rgba(255,231,196,0.82);background:rgba(255,255,255,0.05);',
      ' border:1px solid rgba(255,202,40,0.22);display:flex;align-items:center;justify-content:center;gap:6px;}',
      '.dh-btn:active{transform:scale(0.95);color:#fff;}',
      '@media(max-width:420px){.dh-btn .dh-lbl{display:none;}.dh-btn{padding:0;width:44px;}}',

      // the frame itself — fills every remaining pixel, never spills.
      '.dh-stage{flex:1 1 auto;min-height:0;position:relative;background:#05070c;}',
      '#dhFrame{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;',
      ' background:#05070c;}',

      // status veil — sits over the stage ONLY (inset:0 of .dh-stage), so it can
      // never touch the header. Hidden the moment DirHaven says it is ready.
      '.dh-veil{position:absolute;inset:0;display:flex;flex-direction:column;',
      ' align-items:center;justify-content:center;gap:13px;text-align:center;',
      ' padding:22px;background:#05070c;transition:opacity .4s;',
      ' font-family:"Cormorant Garamond",Georgia,serif;color:#ffe9c4;}',
      '.dh-veil.gone{opacity:0;pointer-events:none;}',
      '.dh-veil .dh-orb{width:44px;height:44px;border-radius:50%;',
      ' background:radial-gradient(circle at 40% 35%,#ffe9c4,#ffca28 55%,rgba(255,202,40,0) 75%);',
      ' animation:dh-breath 1.8s ease-in-out infinite;}',
      '@keyframes dh-breath{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.12);opacity:1}}',
      '.dh-veil .dh-say{font-size:17px;letter-spacing:.03em;max-width:30ch;line-height:1.45;}',
      '.dh-veil .dh-sub{font-size:12.5px;font-style:italic;color:rgba(255,224,178,0.55);max-width:34ch;line-height:1.5;}',
      '.dh-veil .dh-act{margin-top:4px;min-height:44px;padding:0 18px;border-radius:22px;cursor:pointer;',
      ' font-family:inherit;font-size:14px;color:#1a1206;background:#ffca28;border:none;}',
      '.dh-veil .dh-act:active{transform:scale(0.96);}'
    ].join('');
    document.head.appendChild(s);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // WORLD CONTROL SUPPRESSION — the no-collision guarantee
  //
  // Rather than trusting z-index alone (a new control could ship at 1700 next
  // week and land on the frame), we HIDE every other fixed world control while
  // the door is open. Nothing can overlap something that isn't rendered. The
  // exact set is restored on close, so we never fight another module's state.
  // ═════════════════════════════════════════════════════════════════════════
  // #dvRail covers every launcher at once (star-map, agents, home, build, and
  // this door — they are all its flow children now), so hiding the rail hides
  // the whole column even if the HUD adds a sixth launcher later. Listing the
  // children individually would silently miss anything added after today.
  var SUPPRESS = [
    '#dvRail', '#dvBuild',
    '#leave', '#editHeadBtn', '#worldHud', '#vintWorldHud', '#dvToast'
  ];
  var _hidden = [];

  function suppressWorldChrome() {
    _hidden = [];
    SUPPRESS.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        _hidden.push({ el: el, prev: el.style.visibility });
        // visibility (not display) so no module's layout math is disturbed —
        // they simply cannot paint while the door is open.
        el.style.visibility = 'hidden';
      });
    });
    // Anything the world engine draws that isn't in our list is still fully
    // covered: #dhPanel is inset:0 opaque at z1620.
  }

  function restoreWorldChrome() {
    _hidden.forEach(function (r) { r.el.style.visibility = r.prev || ''; });
    _hidden = [];
  }

  // ═════════════════════════════════════════════════════════════════════════
  // THE PANEL
  // ═════════════════════════════════════════════════════════════════════════
  var _panel = null, _frame = null, _veil = null, _loaded = false;
  var _open = false, _readyGot = false, _sendTimer = null, _watchdog = null;

  function veilState(kind, extra) {
    if (!_veil) return;
    var say = _veil.querySelector('.dh-say');
    var sub = _veil.querySelector('.dh-sub');
    var act = _veil.querySelector('.dh-act');
    var orb = _veil.querySelector('.dh-orb');
    _veil.classList.remove('gone');
    if (act) act.style.display = 'none';
    if (orb) orb.style.display = '';

    if (kind === 'opening') {
      say.textContent = 'opening the door to DirHaven';
      sub.textContent = 'the clearing stays where you left it — you are not leaving the world.';
    } else if (kind === 'ready') {
      _veil.classList.add('gone');
    } else if (kind === 'anon') {
      say.textContent = 'DirHaven is open';
      sub.textContent = 'you are browsing as a guest — sign in to the world and the door will carry your name through.';
      _veil.classList.add('gone');
    } else if (kind === 'blocked') {
      if (orb) orb.style.display = 'none';
      say.textContent = 'DirHaven would not open in the frame';
      sub.textContent = extra || 'the DirHaven server has not allowed this world to embed it yet.';
      if (act) {
        var o = dirhavenOrigin();
        act.style.display = o ? '' : 'none';
        act.textContent = 'open DirHaven in a new tab';
        act.onclick = function () {
          if (!o) return;
          try { window.open(o, '_blank', 'noopener'); } catch (_) {}
        };
      }
    } else if (kind === 'nowhere') {
      // No origin to frame. Reachable again only if an override deliberately
      // blanks the address (or a future rollback removes the public one) — the
      // resolver's default is now the live https://app.dirhaven.com. Kept, and
      // kept honest, rather than deleted: a door that cannot say "nowhere" is a
      // door that spins forever the day the address goes away.
      if (orb) orb.style.display = 'none';
      say.textContent = 'DirHaven has no address for the world right now';
      sub.textContent = 'no DirHaven origin resolved on this device, so there is nothing to open into. Clear the vint:dirhaven-origin override and reload, and the door goes back to app.dirhaven.com.';
      if (act) act.style.display = 'none';
    }
  }

  function buildPanel() {
    if (_panel) return _panel;
    var p = document.createElement('div');
    p.id = 'dhPanel';
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'DirHaven, inside the world');
    p.innerHTML = ''
      + '<div class="dh-bar">'
      + '  <div class="dh-name">DirHaven<small>open inside the world — your body is still standing there</small></div>'
      + '  <button class="dh-btn" id="dhPop" title="open in a new tab">↗<span class="dh-lbl"> tab</span></button>'
      + '  <button class="dh-btn" id="dhBack" title="back to the world">✕<span class="dh-lbl"> world</span></button>'
      + '</div>'
      + '<div class="dh-stage">'
      + '  <iframe id="dhFrame" title="DirHaven" allow="fullscreen; clipboard-write; autoplay"'
      + '    referrerpolicy="strict-origin"></iframe>'
      + '  <div class="dh-veil">'
      + '    <div class="dh-orb"></div>'
      + '    <div class="dh-say">opening the door to DirHaven</div>'
      + '    <div class="dh-sub">the clearing stays where you left it.</div>'
      + '    <button class="dh-act" type="button"></button>'
      + '  </div>'
      + '</div>';
    document.body.appendChild(p);

    _panel = p;
    _frame = p.querySelector('#dhFrame');
    _veil = p.querySelector('.dh-veil');

    p.querySelector('#dhBack').onclick = close;
    var pop = p.querySelector('#dhPop');
    pop.onclick = function () {
      var o = dirhavenOrigin();
      if (!o) return;
      try { window.open(o, '_blank', 'noopener'); } catch (_) {}
    };
    // No origin → no tab to open. Hide rather than offer a dead control.
    if (!dirhavenOrigin()) pop.style.display = 'none';
    return p;
  }

  // Hand our session DOWN to the resolved origin. Never '*', never null.
  function sendSession() {
    if (!_frame || !_frame.contentWindow) return;
    var origin = dirhavenOrigin();
    if (!origin) return; // nowhere to send it — a null targetOrigin would throw
    var t = token();
    if (!t) return; // guest — DirHaven runs its own auth, which is fine
    try {
      _frame.contentWindow.postMessage({ type: 'vint:session', token: t }, origin);
    } catch (_) { /* frame gone or origin mismatch */ }
  }

  function onMessage(ev) {
    var origin = dirhavenOrigin();
    if (!origin || ev.origin !== origin) return; // strict allowlist, one origin
    var m = ev.data;
    if (!m || typeof m !== 'object') return;
    if (m.type !== 'dirhaven:ready') return;
    // Only trust a ready that actually came from OUR frame.
    if (_frame && ev.source !== _frame.contentWindow) return;

    _readyGot = true;
    if (_watchdog) { clearTimeout(_watchdog); _watchdog = null; }
    veilState(token() ? 'ready' : 'anon');
    sendSession();
  }

  function open() {
    if (!enabled()) return;
    buildPanel();
    injectStyles();
    if (_open) return;
    // The door is inset:0 at z1620, so it covers any bottom sheet rather than
    // colliding visibly — but the sheet stays mounted underneath and is still
    // there when you come back out. One surface at a time means the door evicts
    // it on the way in, exactly like the sheets evict each other.
    var _hud = W.DirverseHUD;
    if (_hud && typeof _hud.closeSheets === 'function') _hud.closeSheets('dirhaven');
    _open = true;
    _readyGot = false;

    veilState('opening');
    _panel.classList.add('open');
    suppressWorldChrome();

    var origin = dirhavenOrigin();
    if (!origin) {
      // Nothing to frame. The door still opens (so the state is visible and
      // honest) and says why, instead of hanging on a spinner forever.
      veilState('nowhere');
      try { document.body.style.overflow = 'hidden'; } catch (_) {}
      return;
    }

    // Load once, then keep the frame warm across opens so DirHaven state (a
    // half-typed post, a scroll position) survives a trip back to the world.
    if (!_loaded) {
      _frame.src = origin + '/';
      _loaded = true;
    } else {
      // Already warm — re-announce in case its listener remounted.
      sendSession();
      veilState(token() ? 'ready' : 'anon');
    }

    // The frame cannot tell us "X-Frame-Options blocked me" — cross-origin load
    // failures are silent by design. So: if DirHaven never says ready, we assume
    // framing was refused and offer the honest escape hatch instead of a spinner
    // that lies forever.
    if (_watchdog) clearTimeout(_watchdog);
    _watchdog = setTimeout(function () {
      if (!_readyGot && _open) veilState('blocked');
    }, 9000);

    // Belt-and-braces: also push the session on load, in case ready raced us.
    _frame.onload = function () {
      if (_sendTimer) clearTimeout(_sendTimer);
      _sendTimer = setTimeout(sendSession, 120);
    };

    try { document.body.style.overflow = 'hidden'; } catch (_) {}
    // Let the world stop listening for movement keys while DirHaven has focus.
    try { W.dispatchEvent(new CustomEvent('vint:input-release', { detail: { by: 'dirhaven-door' } })); } catch (_) {}
  }

  function close() {
    if (!_open) return;
    _open = false;
    if (_watchdog) { clearTimeout(_watchdog); _watchdog = null; }
    if (_panel) _panel.classList.remove('open');
    var _hud = W.DirverseHUD;
    if (_hud && typeof _hud.syncSheets === 'function') _hud.syncSheets();
    restoreWorldChrome();
    try { document.body.style.overflow = ''; } catch (_) {}
    try { W.dispatchEvent(new CustomEvent('vint:input-claim', { detail: { by: 'dirhaven-door' } })); } catch (_) {}
  }

  function toggle() { _open ? close() : open(); }

  // ESC returns you to the clearing — the expected way out of any full surface.
  W.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && _open) { e.preventDefault(); close(); }
  });

  // Android back / browser back should close the door, not leave the world.
  W.addEventListener('popstate', function () { if (_open) close(); });

  W.addEventListener('message', onMessage);

  // If identity changes while the door is warm (sign-in happened in the world),
  // carry the new session through without making the user re-open anything.
  W.addEventListener('vint:identity', function () { if (_loaded) sendSession(); });

  // ═════════════════════════════════════════════════════════════════════════
  // MOUNT
  // ═════════════════════════════════════════════════════════════════════════
  // The launcher is a FLOW CHILD OF #dvRail, never its own position:fixed box.
  // It used to be fixed at bottom:318px — which is precisely slot 4 of the rail
  // (150 floor + 3×46 + 3×10 gaps), i.e. exactly where #dvBuildBtn renders the
  // moment you stand on a world you can build in. Same band, same z-index 1450,
  // same left edge: the two buttons drew on top of each other. Handing the slot
  // back to the rail is the only fix that stays correct as launchers come and go.
  function mount() {
    if (!enabled()) return;
    injectStyles();

    var hud = W.DirverseHUD;
    if (hud && typeof hud.addLauncher === 'function') {
      // Join the one-surface-at-a-time registry so opening a sheet closes the
      // door, just as opening the door closes a sheet. The door keeps its own
      // Escape handler (it has a lifecycle the registry doesn't own); `close()`
      // is idempotent, so both firing on one keypress is harmless.
      if (typeof hud.registerSheet === 'function') {
        hud.registerSheet('dirhaven', function () { return _open; }, close);
      }
      hud.addLauncher('dhDoorBtn', 'dirhaven', '⌂⃝', function () { toggle(); })
         .setAttribute('aria-label', 'open DirHaven inside the world');
      return;
    }

    // The HUD owns the rail; if it hasn't mounted yet, wait for it rather than
    // falling back to a fixed button (a fallback that overlaps is worse than a
    // launcher that appears 200ms later). The HUD mounts on DOMContentLoaded or
    // immediately, so this resolves on the next tick in every real load order.
    if (_railWaits < 25) { _railWaits++; setTimeout(mount, 80); }
  }
  var _railWaits = 0;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  // `origin` is the FUNCTION, not a snapshot: the resolved origin can change at
  // runtime (owner sets vint:dirhaven-origin, or the host page sets
  // __DIRHAVEN_ORIGIN after load), and a frozen null would strand the door.
  W.DirHavenDoor = { open: open, close: close, toggle: toggle, enabled: enabled, origin: dirhavenOrigin };
})();
