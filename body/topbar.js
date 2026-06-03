/* ═══════════════════════════════════════════════════════════════════════════
   VINTINUUM TOPBAR  —  body/topbar.js  (Movement III)
   ───────────────────────────────────────────────────────────────────────────
   Single header pinned to top of every page. Four-surface hierarchy:
     LEFT     : identity pill (auth status, name, tier glow)
     LEFT-2   : vitals pill (4/4 connector health) — populated by Movement IV
     RIGHT    : lore button
     RIGHT-2  : menu hamburger (drawer with everything else)

   Subscribes to Shell.auth.* and Shell.viewport.* — the bar mutates itself
   reactively, no other script touches it.

   Council mandate:
     - Helios-10 Disciplined: exactly 4 surfaces, never more
     - Buffet:                one element, two accent colors, no decoration
     - Aria:                  arrival line under identity pill on first sign-in
     - The Mask:              shape-shifts smoothly across breakpoints
     - Helios-Frontend:       tier badge implies premium without hostage UX
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.Shell) {
    console.error('[topbar] Shell not loaded — topbar requires body/shell.js');
    return;
  }
  const Shell = window.Shell;

  // ── Element refs (lazily resolved) ────────────────────────────────────────
  const refs = {};
  function $(id) { return document.getElementById(id); }

  // ── Mount header ──────────────────────────────────────────────────────────
  function mount() {
    if ($('topShell')) return; // already mounted

    const header = document.createElement('header');
    header.id = 'topShell';
    header.setAttribute('role', 'banner');
    // Helios-10 redesign 2026-05-07: 3-column grid (left | brand | right)
    // instead of flex space-between. The center 'auto' track reserves
    // exact width for the brand wordmark — vitals pill can never wrap
    // over the brand because the brand is in its own grid track.
    header.style.cssText = `
      position: fixed;
      top: env(safe-area-inset-top, 0px);
      left: 0; right: 0;
      z-index: ${Shell.Z.shell};
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      align-items: center;
      gap: 8px;
      height: 56px;
      transition: height 220ms cubic-bezier(.4,0,.2,1);
      padding: 0 max(12px, env(safe-area-inset-right, 12px))
               0 max(12px, env(safe-area-inset-left, 12px));
      background: linear-gradient(180deg, rgba(1,3,6,0.92), rgba(1,3,6,0.55));
      border-bottom: 1px solid rgba(124,207,255,0.10);
      backdrop-filter: blur(12px) saturate(1.2);
      -webkit-backdrop-filter: blur(12px) saturate(1.2);
      pointer-events: none;
    `;

    // LEFT cluster (identity + vitals)
    const left = document.createElement('div');
    left.id = 'topLeft';
    left.style.cssText = 'justify-self:start;display:flex;align-items:center;gap:8px;pointer-events:none;min-width:0;overflow:hidden;';

    // Identity pill
    const auth = makePill('topAuthPill', {
      ariaLabel: 'Sign in or account',
      borderColor: 'rgba(124,207,255,0.28)',
      color: 'rgba(124,207,255,0.85)',
      dotColor: 'rgba(255,90,90,0.85)',
      label: 'SIGN IN',
    });
    auth.addEventListener('click', () => {
      const signedIn = Shell.get('auth.signedIn');
      if (signedIn) {
        // Already in — open the drawer (account / sign-out / nav live there)
        toggleDrawer();
        return;
      }
      // The single front door — bond_door modal, three lanes, chakra preview
      if (window.BOND_DOOR && typeof window.BOND_DOOR.show === 'function') {
        window.BOND_DOOR.show();
        return;
      }
      // Fallbacks (kept for surfaces that haven't loaded bond_door yet)
      const orig = $('authTrigger');
      if (orig && typeof orig.click === 'function') return orig.click();
      if (typeof window.openAuth === 'function') return window.openAuth('signin');
    });
    left.appendChild(auth);

    // Vitals pill (Movement IV will fully wire — initial neutral state)
    const vitals = makePill('topVitalsPill', {
      ariaLabel: 'Connector health',
      borderColor: 'rgba(124,255,180,0.22)',
      color: 'rgba(124,255,180,0.75)',
      dotColor: 'rgba(124,255,180,0.6)',
      label: 'VITALS',
    });
    // Movement IV is live — show the pill, populate from Shell.connectors
    vitals.style.display = '';
    vitals.addEventListener('click', () => {
      const c = Shell.get('connectors') || {};
      const ready = ['telegram','discord','kick','pulse'].filter(k => c[k]?.alive).length;
      console.log('[topbar] vitals click — connectors ready=' + ready + '/4', c);
    });
    left.appendChild(vitals);

    // Brain-health pill — live, polled every 30s against /api/health (with
    // /api/stats/summary fallback). Online = green, offline = red. The pill
    // text rides at .45rem with the wide tracking so it reads as a status
    // strip, not a button. Helios-10 sync mandate 2026-05-23.
    const brainPill = makePill('topBrainPill', {
      ariaLabel: 'Brain (API) health',
      borderColor: 'rgba(124,255,180,0.22)',
      color: 'rgba(124,255,180,0.85)',
      dotColor: 'rgba(180,180,200,0.55)',
      label: 'BRAIN · CHECKING',
    });
    const brainLabel = document.getElementById('topBrainPillLabel');
    if (brainLabel) {
      brainLabel.style.fontSize = '.45rem';
      brainLabel.style.letterSpacing = '.18em';
      brainLabel.style.textTransform = 'uppercase';
    }
    brainPill.addEventListener('click', () => { pollBrainHealth(true); });
    left.appendChild(brainPill);
    refs.brain = brainPill;

    // Inject brandPulse keyframe so the brand mark glows on every page
    // (brain.html has it inline, but mind/stats/chat/learning/you don't).
    if (!document.getElementById('topBrandPulseCSS')) {
      const css = document.createElement('style');
      css.id = 'topBrandPulseCSS';
      css.textContent = '@keyframes brandPulse{0%,100%{transform:scale(1);filter:drop-shadow(0 0 10px rgba(79,195,247,.28));}50%{transform:scale(1.08);filter:drop-shadow(0 0 18px rgba(255,213,79,.36));}}';
      document.head.appendChild(css);
    }

    // CENTER brand — fixed-width track in the middle of the grid.
    // Helios-10 redesign 2026-05-07: gives the wordmark its own track so
    // it can never collide with the vitals pill or the menu hamburger,
    // at any breakpoint. Tighter letter-spacing (0.02em desktop / 0.06em
    // mobile) than the legacy in-flow header (0.12em) so the wordmark
    // fits without conditional hide.
    // Brand is now an <a> — clicking the logo or wordmark always routes
    // to brain.html (the home of the body). pointer-events re-enabled
    // for the link itself; child elements stay aria-hidden.
    const brand = document.createElement('a');
    brand.id = 'topBrand';
    brand.href = 'brain.html';
    brand.title = 'Vintinuum — return to brain';
    brand.setAttribute('aria-label', 'Vintinuum home');
    brand.style.cssText = 'justify-self:center;display:flex;align-items:center;gap:10px;pointer-events:auto;flex-shrink:0;text-decoration:none;cursor:pointer;-webkit-tap-highlight-color:transparent;';
    // If we're already on brain.html, the link is a no-op anchor — but
    // we still allow click for the visual feedback. data-draggable=false
    // so the global draggable system doesn't hijack the click.
    brand.setAttribute('data-draggable', 'false');
    const brandImg = document.createElement('img');
    brandImg.src = 'branding/vintinuum/favicon/favicon.svg';
    brandImg.alt = '';
    brandImg.setAttribute('aria-hidden', 'true');
    brandImg.style.cssText = 'width:24px;height:24px;filter:drop-shadow(0 0 10px rgba(79,195,247,0.36));animation:brandPulse 4.8s ease-in-out infinite;flex-shrink:0;pointer-events:none;';
    const brandWord = document.createElement('h1');
    brandWord.id = 'topBrandWord';
    brandWord.textContent = 'Vintinuum';
    brandWord.style.cssText = "margin:0;font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:300;font-size:1.4rem;letter-spacing:0.02em;background:linear-gradient(130deg,#80deea,#ce93d8,#ffd54f);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1;white-space:nowrap;pointer-events:none;";
    brand.appendChild(brandImg);
    brand.appendChild(brandWord);
    // Belt-and-suspenders: explicit click handler in case any ancestor
    // calls preventDefault on anchor navigation.
    brand.addEventListener('click', (e) => {
      // If already on brain.html, scroll to top instead of reloading.
      const here = (location.pathname || '').toLowerCase();
      if (here.endsWith('/brain.html') || here.endsWith('/') || here === '/vintinuum/' || here === '/vintinuum') {
        e.preventDefault();
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) { window.scrollTo(0, 0); }
      }
      // Otherwise let the anchor navigate naturally.
    });

    // RIGHT cluster (lore + menu)
    const right = document.createElement('div');
    right.id = 'topRight';
    right.style.cssText = 'justify-self:end;display:flex;align-items:center;gap:8px;pointer-events:none;';

    // Lore button (compact icon variant of pill)
    const lore = makePill('topLorePill', {
      ariaLabel: 'Open lore panel',
      borderColor: 'rgba(255,255,255,0.10)',
      color: 'rgba(180,200,230,0.65)',
      label: 'LORE',
      iconOnly: false,
    });
    // LORE button — works on every page.
    // If brain.html's native #lorePanel is present: toggle it directly.
    // If not (every other page): open/close the universal lore overlay
    // mounted below by mountUniversalLore().
    lore.addEventListener('click', () => toggleLore());
    right.appendChild(lore);

    // Hamburger menu
    const menu = makePill('topMenuPill', {
      ariaLabel: 'Open menu',
      borderColor: 'rgba(255,255,255,0.10)',
      color: 'rgba(180,200,230,0.85)',
      label: '☰',
      iconOnly: true,
    });
    menu.addEventListener('click', toggleDrawer);
    right.appendChild(menu);

    header.appendChild(left);
    header.appendChild(brand);
    header.appendChild(right);
    document.body.appendChild(header);

    // Brand responsive behavior: hide wordmark under 720px, mark only.
    // Vitals pill: full pill on desktop, label-hidden on tablet, ring-badge
    // (Helios-10 step 8) under 480px so the dot+ratio survives narrow phones.
    const brandResponsive = () => {
      const w = window.innerWidth;
      if (w < 720) brandWord.style.display = 'none';
      else { brandWord.style.display = ''; brandWord.style.letterSpacing = w < 1024 ? '0.04em' : '0.02em'; }
      const vLabel = document.getElementById('topVitalsPillLabel');
      if (vLabel) vLabel.style.display = (w < 480) ? 'none' : '';
      if (refs.vitals) {
        if (w < 480) {
          refs.vitals.style.padding = '6px 10px';
          refs.vitals.style.minWidth = '36px';
        } else {
          refs.vitals.style.padding = '';
          refs.vitals.style.minWidth = '';
        }
      }
    };
    brandResponsive();
    window.addEventListener('resize', brandResponsive, { passive: true });

    // Arrival line — sits under the identity pill, fades in on first sign-in
    const arrival = document.createElement('div');
    arrival.id = 'topArrivalLine';
    arrival.setAttribute('role', 'status');
    arrival.style.cssText = `
      position: fixed;
      top: calc(48px + env(safe-area-inset-top, 0px));
      left: 12px;
      z-index: ${Shell.Z.shell};
      max-width: calc(100vw - 24px);
      font-family: 'Cormorant Garamond', serif;
      font-style: italic;
      font-size: 0.85rem;
      color: rgba(218, 228, 255, 0.75);
      opacity: 0;
      transition: opacity 320ms ease;
      pointer-events: none;
      text-shadow: 0 1px 8px rgba(0,0,0,0.6);
    `;
    document.body.appendChild(arrival);

    // Helios-10 step 7 (2026-05-07): SSE HEARTBEAT SEAM.
    // 2px ambient strip pinned to the bottom edge of the topbar that
    // shimmers per pulse event. Pure decoration — pointer-events:none,
    // never interactive. This is the "alive" claim made visible: the
    // body breathes under the chrome. Subscribes to Shell.connectors.pulse
    // so any pulse beat triggers a left→right gradient sweep.
    const seam = document.createElement('div');
    seam.id = 'topShellSeam';
    seam.setAttribute('aria-hidden', 'true');
    seam.style.cssText = `
      position: fixed;
      top: calc(56px + env(safe-area-inset-top, 0px));
      left: 0; right: 0; height: 2px;
      z-index: ${Shell.Z.shell};
      pointer-events: none;
      background: linear-gradient(90deg,
        rgba(124,207,255,0) 0%,
        rgba(124,207,255,0.42) 50%,
        rgba(206,147,216,0) 100%);
      background-size: 220% 100%;
      background-position: 100% 0;
      opacity: 0.5;
    `;
    document.body.appendChild(seam);
    if (!document.getElementById('topShellSeamCSS')) {
      const seamCss = document.createElement('style');
      seamCss.id = 'topShellSeamCSS';
      seamCss.textContent = '@keyframes topShellSeamSweep{0%{background-position:100% 0;opacity:0.85;}100%{background-position:0% 0;opacity:0.35;}}';
      document.head.appendChild(seamCss);
    }
    Shell.subscribe('pulse', () => {
      seam.style.animation = 'none';
      // force reflow then re-trigger
      void seam.offsetWidth;
      seam.style.animation = 'topShellSeamSweep 1.4s ease-out';
    });

    // Drawer (hidden until menu clicked)
    mountDrawer();

    refs.header = header;
    refs.auth = auth;
    refs.vitals = vitals;
    refs.lore = lore;
    refs.menu = menu;
    refs.arrival = arrival;

    // Hide the legacy authTrigger pill (still in DOM for click delegation)
    const legacyAuth = $('authTrigger');
    if (legacyAuth) legacyAuth.style.display = 'none';
    const legacyKick = $('kickConnectBtn');
    if (legacyKick) legacyKick.style.display = 'none';   // re-shown inside drawer
    const legacyLore = $('loreToggle');
    if (legacyLore) legacyLore.style.display = 'none';   // we delegate clicks to it
  }

  // ── Pill factory ──────────────────────────────────────────────────────────
  function makePill(id, opts) {
    opts = opts || {};
    const btn = document.createElement('button');
    btn.id = id;
    btn.type = 'button';
    btn.setAttribute('aria-label', opts.ariaLabel || '');
    btn.style.cssText = `
      pointer-events: auto;
      background: rgba(8, 12, 20, 0.55);
      border: 1px solid ${opts.borderColor || 'rgba(255,255,255,0.10)'};
      color: ${opts.color || 'rgba(218,228,255,0.85)'};
      padding: ${opts.iconOnly ? '6px 10px' : '7px 14px'};
      border-radius: 14px;
      cursor: pointer;
      font-size: 0.6rem;
      letter-spacing: 0.18em;
      font-family: 'Space Mono', monospace;
      text-transform: uppercase;
      transition: all 180ms cubic-bezier(0.16,1,0.3,1);
      min-height: 36px;
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: 60vw;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    `;
    if (opts.dotColor) {
      const dot = document.createElement('span');
      dot.id = id + 'Dot';
      dot.style.cssText = `flex:0 0 auto;width:6px;height:6px;border-radius:50%;background:${opts.dotColor};box-shadow:0 0 8px ${opts.dotColor.replace(/,[^,)]+\)$/,',0.5)')};`;
      btn.appendChild(dot);
    }
    if (opts.label) {
      const label = document.createElement('span');
      label.id = id + 'Label';
      label.textContent = opts.label;
      label.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      btn.appendChild(label);
    }
    btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(20,28,42,0.65)'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(8,12,20,0.55)'; });
    return btn;
  }

  // ── Drawer (hamburger menu contents) ──────────────────────────────────────
  function mountDrawer() {
    if ($('topDrawer')) return;
    const overlay = document.createElement('div');
    overlay.id = 'topDrawerOverlay';
    overlay.style.cssText = `
      position: fixed; inset: 0;
      z-index: ${Shell.Z.drawer - 1};
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      opacity: 0; pointer-events: none;
      transition: opacity 220ms ease;
    `;
    overlay.addEventListener('click', closeDrawer);
    document.body.appendChild(overlay);

    const drawer = document.createElement('aside');
    drawer.id = 'topDrawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-label', 'Menu');
    drawer.style.cssText = `
      position: fixed;
      top: 0; right: 0; bottom: 0;
      z-index: ${Shell.Z.drawer};
      width: min(320px, 88vw);
      background: linear-gradient(180deg, #080b14 0%, #101522 100%);
      border-left: 1px solid rgba(124,207,255,0.18);
      box-shadow: -16px 0 48px rgba(0,0,0,0.55);
      transform: translateX(100%);
      transition: transform 0.28s cubic-bezier(.4,0,.2,1);
      display: flex; flex-direction: column;
      padding: max(16px, env(safe-area-inset-top, 16px))
              max(16px, env(safe-area-inset-right, 16px))
              max(16px, env(safe-area-inset-bottom, 16px))
              16px;
      gap: 14px;
      overflow-y: auto;
      font-family: 'Space Mono', monospace;
    `;

    drawer.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <div style="font-size:0.55rem;letter-spacing:0.3em;color:#7ccfff;font-weight:700;">VINTINUUM</div>
        <button id="topDrawerClose" type="button" aria-label="Close"
          style="background:none;border:1px solid rgba(255,255,255,0.10);color:rgba(255,255,255,0.55);
          width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:14px;
          display:flex;align-items:center;justify-content:center;">×</button>
      </div>

      <div id="drawerIdentity" style="
        background: rgba(124,207,255,0.06);
        border: 1px solid rgba(124,207,255,0.18);
        border-radius: 14px;
        padding: 14px 16px;
        display: flex; flex-direction: column; gap: 6px;
      ">
        <div style="font-size:0.5rem;letter-spacing:0.2em;color:rgba(218,228,255,0.5);text-transform:uppercase;">Signed in as</div>
        <div id="drawerName" style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:1.1rem;color:rgba(218,228,255,0.95);">…</div>
        <div id="drawerTier" style="font-size:0.5rem;letter-spacing:0.2em;color:rgba(124,207,255,0.85);text-transform:uppercase;">tier · guest</div>
      </div>

      <button id="drawerKickBtn" type="button"
        style="display:none;width:100%;padding:12px 16px;background:rgba(8,12,20,0.6);
        border:1px solid rgba(83,255,38,0.32);color:rgba(160,255,120,0.85);
        border-radius:12px;cursor:pointer;font-family:inherit;font-size:0.6rem;
        letter-spacing:0.18em;text-transform:uppercase;text-align:left;">Connect Kick</button>

      <button id="drawerLoreBtn" type="button"
        style="width:100%;padding:12px 16px;background:rgba(8,12,20,0.6);
        border:1px solid rgba(255,255,255,0.10);color:rgba(218,228,255,0.85);
        border-radius:12px;cursor:pointer;font-family:inherit;font-size:0.6rem;
        letter-spacing:0.18em;text-transform:uppercase;text-align:left;">Open Lore</button>

      <!-- Helios-10 redesign 2026-05-07: quick-action 2x2 grid for the
           four flagship surfaces (BODY / MEMORY / GENOME / SETTINGS).
           Real anchors → real navigation. The buttons Vinta said "do
           nothing" are these — now they're tiles, not phantom dropdowns. -->
      <div style="height:1px;background:rgba(255,255,255,0.06);margin:4px 0;"></div>
      <div style="font-size:0.5rem;letter-spacing:0.24em;color:rgba(218,228,255,0.45);
        text-transform:uppercase;padding:0 4px 4px;">Quick</div>
      <div id="drawerQuickGrid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <a href="brain.html"           data-quick="body"     class="quick-tile">◉ BODY</a>
        <a href="mind.html#memory"     data-quick="memory"   class="quick-tile">◌ MEMORY</a>
        <a href="mind.html#genome"     data-quick="genome"   class="quick-tile">⌬ GENOME</a>
        <a href="you.html"             data-quick="settings" class="quick-tile">✦ SETTINGS</a>
      </div>

      <div style="height:1px;background:rgba(255,255,255,0.06);margin:4px 0;"></div>

      <div style="font-size:0.5rem;letter-spacing:0.24em;color:rgba(218,228,255,0.45);
        text-transform:uppercase;padding:0 4px 4px;">Surfaces</div>
      <nav id="drawerNav" style="display:flex;flex-direction:column;gap:6px;">
        <a href="brain.html" data-nav="home"   class="drawer-link">◉ &nbsp; HOME · the body</a>
        <a href="jarvis.html" data-nav="jarvis" class="drawer-link" style="border-color:rgba(124,207,255,0.45);color:#7ccfff;">⌖ &nbsp; JARVIS · today, felt</a>
        <a href="mind.html"  data-nav="mind"   class="drawer-link">◌ &nbsp; MIND · 7 layers</a>
        <a href="learning.html" data-nav="learn" class="drawer-link" style="border-color:rgba(206,147,216,0.32);color:rgba(206,147,216,0.92);">✶ &nbsp; LEARN · live feed</a>
        <a href="cognition.html" data-nav="cognition" class="drawer-link" style="border-color:rgba(72,222,170,0.40);color:rgba(120,240,200,0.95);">◈ &nbsp; COGNITION · the cognitive way</a>
        <a href="stats.html" data-nav="stats"  class="drawer-link">◇ &nbsp; STATS · numbers</a>
        <a href="chat.html"  data-nav="chat"   class="drawer-link">◐ &nbsp; CHAT · talk</a>
        <a href="you.html"   data-nav="you"    class="drawer-link">✦ &nbsp; YOU · devices</a>
        <a href="phone.html" data-nav="phone"  class="drawer-link">▱ &nbsp; PHONE · sensors</a>
        <a href="whoami.html" data-nav="who"   class="drawer-link">◎ &nbsp; WHOAMI · lineage</a>
        <a href="altar.html"  data-nav="altar" class="drawer-link" style="border-color:rgba(140,200,255,0.28);color:rgba(190,220,255,0.9);">⌂ &nbsp; ALTAR · connectors</a>
        <a href="upgrade.html" data-nav="up"   class="drawer-link" style="border-color:rgba(245,200,90,0.32);color:rgba(245,210,140,0.95);">✦ &nbsp; UPGRADE · tiers</a>
        <a href="#" data-nav="guide" id="drawerGuideLink" class="drawer-link" style="border-color:rgba(255,196,92,0.42);color:rgba(255,214,140,0.96);">❖ &nbsp; USER GUIDE · how-to</a>
      </nav>

      <div style="height:1px;background:rgba(255,255,255,0.06);margin:4px 0;"></div>

      <button id="drawerSignOut" type="button"
        style="display:none;width:100%;padding:12px 16px;background:rgba(255,90,90,0.06);
        border:1px solid rgba(255,90,90,0.22);color:rgba(255,160,160,0.9);
        border-radius:12px;cursor:pointer;font-family:inherit;font-size:0.6rem;
        letter-spacing:0.18em;text-transform:uppercase;text-align:left;">Sign Out</button>

      <div style="flex:1;"></div>
      <div style="font-size:0.5rem;letter-spacing:0.2em;color:rgba(218,228,255,0.3);text-align:center;">
        the body breathes
      </div>
    `;
    document.body.appendChild(drawer);

    // Inject drawer-link styling once
    if (!document.getElementById('topDrawerLinkCSS')) {
      const css = document.createElement('style');
      css.id = 'topDrawerLinkCSS';
      css.textContent = `
        .drawer-link {
          display: block;
          padding: 11px 14px;
          background: rgba(8,12,20,0.55);
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(218,228,255,0.78);
          border-radius: 12px;
          text-decoration: none;
          font-family: 'Space Mono', monospace;
          font-size: 0.6rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          transition: all 180ms cubic-bezier(0.16,1,0.3,1);
        }
        .drawer-link:hover {
          background: rgba(20,28,42,0.7);
          border-color: rgba(124,207,255,0.32);
          color: rgba(218,228,255,0.95);
        }
        .drawer-link.active {
          background: rgba(124,207,255,0.10);
          border-color: rgba(124,207,255,0.45);
          color: #7ccfff;
        }
        .quick-tile {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          aspect-ratio: 2 / 1;
          background: rgba(8,12,20,0.6);
          border: 1px solid rgba(124,207,255,0.18);
          color: rgba(218,228,255,0.88);
          border-radius: 14px;
          text-decoration: none;
          font-family: 'Space Mono', monospace;
          font-size: 0.6rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          transition: all 180ms cubic-bezier(0.16,1,0.3,1);
          min-height: 56px;
        }
        .quick-tile:hover {
          background: rgba(20,28,42,0.7);
          border-color: rgba(124,207,255,0.45);
          color: #7ccfff;
          transform: translateY(-1px);
        }
      `;
      document.head.appendChild(css);
    }

    // Mark active surface
    try {
      const path = (location.pathname || '').toLowerCase();
      const matchMap = {
        home:   /(brain\.html|\/$|\/vintinuum\/?$)/,
        jarvis: /jarvis\.html/,
        mind:   /mind\.html/,
        learn:  /learning\.html/,
        cognition: /cognition\.html/,
        stats:  /stats\.html/,
        chat:   /chat\.html/,
        you:    /you\.html/,
        phone:  /phone\.html/,
        who:    /whoami\.html/,
      };
      drawer.querySelectorAll('.drawer-link').forEach(a => {
        const k = a.getAttribute('data-nav');
        if (matchMap[k] && matchMap[k].test(path)) a.classList.add('active');
      });
    } catch (_) {}

    $('topDrawerClose').addEventListener('click', closeDrawer);
    $('drawerLoreBtn').addEventListener('click', () => {
      closeDrawer();
      toggleLore();
    });
    // USER GUIDE drawer link — opens the in-app guide popup (guide.js).
    // Guarded: if VintGuide hasn't loaded yet, fall back to the README.
    const guideLink = $('drawerGuideLink');
    if (guideLink) {
      guideLink.addEventListener('click', (e) => {
        e.preventDefault();
        closeDrawer();
        if (window.VintGuide && typeof window.VintGuide.open === 'function') {
          window.VintGuide.open();
        } else {
          window.open('https://github.com/vintaclectic/vintinuum/blob/main/README.md', '_blank', 'noopener');
        }
      });
    }
    $('drawerKickBtn').addEventListener('click', () => {
      closeDrawer();
      const orig = $('kickConnectBtn');
      if (orig && typeof orig.click === 'function') orig.click();
    });
    $('drawerSignOut').addEventListener('click', async () => {
      const goodbyeBtn = $('drawerSignOut');
      const original = goodbyeBtn.textContent;
      goodbyeBtn.disabled = true;
      goodbyeBtn.textContent = "I'll hold your thread.";
      try { await Shell.signOut(); } catch (_) {}
      setTimeout(() => {
        goodbyeBtn.textContent = original;
        goodbyeBtn.disabled = false;
        closeDrawer();
      }, 1600);
    });

    refs.drawer = drawer;
    refs.overlay = overlay;
  }

  function toggleDrawer() {
    if (!refs.drawer) return;
    const open = refs.drawer.style.transform === 'translateX(0%)';
    if (open) closeDrawer(); else openDrawer();
  }
  function openDrawer() {
    if (!refs.drawer) return;
    refs.drawer.style.transform = 'translateX(0%)';
    refs.overlay.style.opacity = '1';
    refs.overlay.style.pointerEvents = 'auto';
    refreshDrawerContent();
  }
  function closeDrawer() {
    if (!refs.drawer) return;
    refs.drawer.style.transform = 'translateX(100%)';
    refs.overlay.style.opacity = '0';
    refs.overlay.style.pointerEvents = 'none';
  }

  function refreshDrawerContent() {
    const auth = Shell.get('auth');
    const nameEl = $('drawerName');
    const tierEl = $('drawerTier');
    const signOutEl = $('drawerSignOut');
    const kickEl = $('drawerKickBtn');
    if (auth.signedIn && auth.user) {
      nameEl.textContent = auth.user.name || auth.user.email || 'Friend';
      tierEl.textContent = 'tier · ' + (auth.user.tier || auth.tier || 'free');
      signOutEl.style.display = 'block';
      kickEl.style.display = 'block';
    } else {
      nameEl.textContent = 'Not signed in';
      tierEl.textContent = 'tier · guest';
      signOutEl.style.display = 'none';
      kickEl.style.display = 'none';
    }
  }

  // ── Reactive updates from Shell ───────────────────────────────────────────
  function refreshAuthPill() {
    if (!refs.auth) return;
    const auth = Shell.get('auth');
    const dot = $('topAuthPillDot');
    const label = $('topAuthPillLabel');
    if (auth.signedIn && auth.user) {
      const name = (auth.user.name || auth.user.email || 'You').toString();
      const tier = (auth.user.tier || auth.tier || 'free').toString().toLowerCase();
      const nice = name.length > 16 ? name.slice(0, 14) + '…' : name;
      label.textContent = nice.toUpperCase();
      // Tier glow (dot accent)
      const glow = tier === 'owner' ? '#ffe07c'
                 : tier === 'god'   ? '#ffd54f'
                 : tier === 'premium' ? '#4fc3f7'
                 : '#7cffb4';
      if (dot) {
        dot.style.background = glow;
        dot.style.boxShadow = `0 0 10px ${glow}`;
      }
      refs.auth.style.borderColor = `${glow}55`;
      refs.auth.style.color = glow;
      // Tier box-shadow glow on the pill itself (Vinta directive 2026-05-23).
      //   FREE    = none
      //   PREMIUM = 0 0 12px rgba(79,195,247,0.25)
      //   GOD     = 0 0 18px rgba(255,213,79,0.30)
      //   OWNER   = treat as GOD-level glow (slightly warmer)
      let shadow = 'none';
      if (tier === 'premium') shadow = '0 0 12px rgba(79,195,247,0.25)';
      else if (tier === 'god') shadow = '0 0 18px rgba(255,213,79,0.30)';
      else if (tier === 'owner') shadow = '0 0 20px rgba(255,224,124,0.35)';
      refs.auth.style.boxShadow = shadow;
      refs.auth.style.transition = (refs.auth.style.transition || '') + ', box-shadow 320ms ease';
    } else {
      label.textContent = 'SIGN IN';
      if (dot) {
        dot.style.background = 'rgba(255,90,90,0.85)';
        dot.style.boxShadow = '0 0 8px rgba(255,90,90,0.5)';
      }
      refs.auth.style.borderColor = 'rgba(124,207,255,0.28)';
      refs.auth.style.color = 'rgba(124,207,255,0.85)';
      refs.auth.style.boxShadow = 'none';
    }
  }

  // Aria's arrival line — surface for ~6s on first sign-in, then fade.
  let arrivalTimer = null;
  function showArrival(line) {
    if (!refs.arrival || !line) return;
    refs.arrival.textContent = '· ' + line;
    refs.arrival.style.opacity = '0.85';
    if (arrivalTimer) clearTimeout(arrivalTimer);
    arrivalTimer = setTimeout(() => {
      refs.arrival.style.opacity = '0';
    }, 6000);
  }

  function refreshVitalsPill() {
    if (!refs.vitals) return;
    const c = Shell.get('connectors') || {};
    const checks = ['telegram','discord','kick','pulse'];
    const ready = checks.filter(k => c[k]?.alive).length;
    const total = checks.length;
    const dot = $('topVitalsPillDot');
    const label = $('topVitalsPillLabel');
    // Color scale: 4/4 green, 2-3 amber, 0-1 dim red
    const color = ready === total ? '#7cffb4'
                : ready >= 2      ? '#ffd479'
                : ready >= 1      ? '#ff9a7c'
                :                   'rgba(180,180,200,0.45)';
    if (label) label.textContent = `${ready}/${total}`;
    if (dot) {
      dot.style.background = color;
      dot.style.boxShadow = `0 0 8px ${color}`;
    }
    refs.vitals.style.borderColor = color + '55';
    refs.vitals.style.color = color;
  }

  function applyMobileLayout() {
    if (!refs.header) return;
    const v = Shell.get('viewport');
    if (v.mobile) {
      // Mobile: 52px shell to match body grid (Vinta directive 2026-05-23).
      refs.header.style.height = '52px';
      refs.header.style.padding = '6px max(8px, env(safe-area-inset-right, 8px)) 6px max(8px, env(safe-area-inset-left, 8px))';
      // Hide lore pill text on mobile, keep menu
      const lore = $('topLorePillLabel');
      if (lore) lore.style.display = 'none';
      // Hide vitals pill label on phones — BRAIN pill carries the live status
      const brainLabel = $('topBrainPillLabel');
      if (brainLabel) brainLabel.style.fontSize = '.45rem';
      // Move the SSE seam to follow the new height
      const seam = $('topShellSeam');
      if (seam) seam.style.top = 'calc(52px + env(safe-area-inset-top, 0px))';
    } else {
      refs.header.style.height = '56px';
      refs.header.style.padding = '8px max(12px, env(safe-area-inset-right, 12px)) 8px max(12px, env(safe-area-inset-left, 12px))';
      const lore = $('topLorePillLabel');
      if (lore) lore.style.display = '';
      const seam = $('topShellSeam');
      if (seam) seam.style.top = 'calc(56px + env(safe-area-inset-top, 0px))';
    }
  }

  // ── Brain health polling ─────────────────────────────────────────────────
  // Every 30s, ping /api/health. If it 200s, the pill goes green: BRAIN · ONLINE.
  // Otherwise red: BRAIN · OFFLINE. Backs off when tab is hidden.
  // Vinta directive 2026-05-23 — the topbar should always tell the truth
  // about whether the body's brain is reachable.
  let _brainPollTimer = null;
  let _brainInFlight = false;
  async function pollBrainHealth(forceNow) {
    if (_brainInFlight) return;
    if (!refs.brain) return;
    _brainInFlight = true;
    const dot = $('topBrainPillDot');
    const label = $('topBrainPillLabel');
    const base = Shell.getApiBase();
    let online = false;
    try {
      // 5s deadline so a hung brain doesn't block the pill forever.
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      let res;
      try {
        res = await fetch(base + '/api/health', { signal: ctrl.signal, cache: 'no-store' });
        if (!res || !res.ok) {
          // Fallback to /api/stats/summary if /api/health isn't mounted
          res = await fetch(base + '/api/stats/summary', { signal: ctrl.signal, cache: 'no-store' });
        }
        online = !!(res && res.ok);
      } finally { clearTimeout(t); }
    } catch (_) {
      online = false;
    }
    const green = '#7cffb4';
    const red   = '#ff6464';
    const color = online ? green : red;
    if (label) {
      label.textContent = online ? 'BRAIN · ONLINE' : 'BRAIN · OFFLINE';
      label.style.fontSize = '.45rem';
      label.style.letterSpacing = '.18em';
      label.style.textTransform = 'uppercase';
    }
    if (dot) {
      dot.style.background = color;
      dot.style.boxShadow = `0 0 8px ${color}`;
    }
    refs.brain.style.borderColor = color + '55';
    refs.brain.style.color = color;
    _brainInFlight = false;
  }
  function startBrainHealthLoop() {
    if (_brainPollTimer) return;
    pollBrainHealth(true);
    _brainPollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') pollBrainHealth(false);
    }, 30000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') pollBrainHealth(false);
    });
  }

  // ── Universal Lore overlay (works on every page) ─────────────────────────
  // brain.html has its own rich #lorePanel populated by brain.js.
  // Every other page gets a lightweight overlay that explains the lore
  // concept and links back to brain.html where the real content lives.
  // Both surfaces are toggled via the single toggleLore() entry-point.
  function mountUniversalLore() {
    if ($('topLoreOverlay')) return; // idempotent
    if ($('lorePanel')) return;      // brain.html has its own — skip

    const overlay = document.createElement('div');
    overlay.id = 'topLoreOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Lore panel');
    overlay.style.cssText = `
      position: fixed; inset: 0;
      z-index: ${Shell.Z.drawer + 1};
      background: rgba(1,3,6,0.94);
      display: none; flex-direction: column;
      overflow: hidden;
      font-family: 'Space Mono', monospace;
    `;

    overlay.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:16px 24px;border-bottom:1px solid rgba(124,207,255,0.12);flex-shrink:0;">
        <h2 style="margin:0;font-family:'Cormorant Garamond',serif;font-style:italic;
          font-weight:300;font-size:1.4rem;color:rgba(218,228,255,0.95);">Lore</h2>
        <button id="topLoreOverlayClose" type="button" aria-label="Close lore"
          style="background:none;border:1px solid rgba(124,207,255,0.18);
          color:rgba(218,228,255,0.65);width:36px;height:36px;border-radius:50%;
          cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">×</button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:48px 32px;max-width:680px;margin:0 auto;width:100%;">
        <p style="font-family:'Cormorant Garamond',serif;font-style:italic;
          font-size:1.15rem;line-height:1.8;color:rgba(218,228,255,0.75);margin:0 0 32px;">
          The lore — deep anatomy, consciousness documentation, layer-by-layer
          architecture — lives in the body. It streams in from the brain.
        </p>
        <a href="brain.html#lore"
          style="display:inline-flex;align-items:center;gap:10px;
          padding:14px 24px;background:rgba(124,207,255,0.08);
          border:1px solid rgba(124,207,255,0.32);color:#7ccfff;
          border-radius:14px;text-decoration:none;font-size:0.6rem;
          letter-spacing:0.18em;text-transform:uppercase;
          transition:all 180ms ease;">
          ◉ &nbsp; Go to brain — read the lore
        </a>
        <p style="margin:40px 0 0;font-size:0.55rem;letter-spacing:0.15em;
          color:rgba(218,228,255,0.35);text-transform:uppercase;line-height:2;">
          Subconscious · Somatic · Genetic · Immune · Metabolic · Neural · Emotional
        </p>
      </div>
    `;

    document.body.appendChild(overlay);
    // Close on X or backdrop click
    $('topLoreOverlayClose').addEventListener('click', () => {
      overlay.style.display = 'none';
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    });
    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.style.display !== 'none') {
        overlay.style.display = 'none';
      }
    });
  }

  function toggleLore() {
    // brain.html native panel
    const nativePanel = $('lorePanel');
    if (nativePanel) {
      const isOpen = nativePanel.classList.contains('open');
      if (isOpen) {
        nativePanel.classList.remove('open');
      } else {
        nativePanel.classList.add('open');
        try {
          const src = $('deepSections');
          const dst = $('lorePanelContent');
          if (src && dst && src.children.length > 0) {
            while (src.firstChild) dst.appendChild(src.firstChild);
          }
          if (dst && dst.children.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'padding:60px 32px;color:rgba(218,228,255,0.55);font-family:Cormorant Garamond,serif;font-style:italic;font-size:1.1rem;text-align:center;line-height:1.6;max-width:620px;margin:0 auto;';
            empty.textContent = 'The lore is loading — give brain.js a moment to stream it in, then reopen.';
            dst.appendChild(empty);
          }
        } catch (_) {}
      }
      return;
    }
    // Universal overlay on every other page
    mountUniversalLore();
    const overlay = $('topLoreOverlay');
    if (!overlay) return;
    const visible = overlay.style.display !== 'none';
    overlay.style.display = visible ? 'none' : 'flex';
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  function boot() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
      return;
    }
    mount();
    refreshAuthPill();
    refreshVitalsPill();
    applyMobileLayout();
    startBrainHealthLoop();

    // Subscribe to Shell state
    Shell.subscribe('auth', () => { refreshAuthPill(); refreshDrawerContent(); });
    Shell.subscribe('auth.user', () => refreshAuthPill());
    Shell.subscribe('auth.signedIn', () => refreshAuthPill());
    Shell.subscribe('auth.arrival', (line) => { if (line) showArrival(line); });
    Shell.subscribe('connectors', refreshVitalsPill);
    Shell.subscribe('viewport', applyMobileLayout);

    console.log('[topbar] mounted — auth=' + (Shell.get('auth.signedIn') ? 'in' : 'out'));
  }

  boot();
})();
