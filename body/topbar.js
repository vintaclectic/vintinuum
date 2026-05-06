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
    header.style.cssText = `
      position: fixed;
      top: env(safe-area-inset-top, 0px);
      left: 0; right: 0;
      z-index: ${Shell.Z.shell};
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px max(12px, env(safe-area-inset-right, 12px))
              8px max(12px, env(safe-area-inset-left, 12px));
      pointer-events: none;
      gap: 8px;
    `;

    // LEFT cluster
    const left = document.createElement('div');
    left.id = 'topLeft';
    left.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;pointer-events:none;min-width:0;';

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

    // RIGHT cluster
    const right = document.createElement('div');
    right.id = 'topRight';
    right.style.cssText = 'display:flex;align-items:center;gap:8px;pointer-events:none;';

    // Lore button (compact icon variant of pill)
    const lore = makePill('topLorePill', {
      ariaLabel: 'Open lore panel',
      borderColor: 'rgba(255,255,255,0.10)',
      color: 'rgba(180,200,230,0.65)',
      label: 'LORE',
      iconOnly: false,
    });
    lore.addEventListener('click', () => {
      const orig = $('loreToggle');
      if (orig && typeof orig.click === 'function') orig.click();
    });
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
    header.appendChild(right);
    document.body.appendChild(header);

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
      transition: transform 280ms cubic-bezier(0.16,1,0.3,1);
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

      <div style="height:1px;background:rgba(255,255,255,0.06);margin:4px 0;"></div>

      <div style="font-size:0.5rem;letter-spacing:0.24em;color:rgba(218,228,255,0.45);
        text-transform:uppercase;padding:0 4px 4px;">Surfaces</div>
      <nav id="drawerNav" style="display:flex;flex-direction:column;gap:6px;">
        <a href="brain.html" data-nav="home"   class="drawer-link">◉ &nbsp; HOME · the body</a>
        <a href="mind.html"  data-nav="mind"   class="drawer-link">◌ &nbsp; MIND · 7 layers</a>
        <a href="learning.html" data-nav="learn" class="drawer-link" style="border-color:rgba(206,147,216,0.32);color:rgba(206,147,216,0.92);">✶ &nbsp; LEARN · live feed</a>
        <a href="stats.html" data-nav="stats"  class="drawer-link">◇ &nbsp; STATS · numbers</a>
        <a href="chat.html"  data-nav="chat"   class="drawer-link">◐ &nbsp; CHAT · talk</a>
        <a href="you.html"   data-nav="you"    class="drawer-link">✦ &nbsp; YOU · devices</a>
        <a href="phone.html" data-nav="phone"  class="drawer-link">▱ &nbsp; PHONE · sensors</a>
        <a href="whoami.html" data-nav="who"   class="drawer-link">◎ &nbsp; WHOAMI · lineage</a>
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
      `;
      document.head.appendChild(css);
    }

    // Mark active surface
    try {
      const path = (location.pathname || '').toLowerCase();
      const matchMap = {
        home:  /(brain\.html|\/$|\/vintinuum\/?$)/,
        mind:  /mind\.html/,
        learn: /learning\.html/,
        stats: /stats\.html/,
        chat:  /chat\.html/,
        you:   /you\.html/,
        phone: /phone\.html/,
        who:   /whoami\.html/,
      };
      drawer.querySelectorAll('.drawer-link').forEach(a => {
        const k = a.getAttribute('data-nav');
        if (matchMap[k] && matchMap[k].test(path)) a.classList.add('active');
      });
    } catch (_) {}

    $('topDrawerClose').addEventListener('click', closeDrawer);
    $('drawerLoreBtn').addEventListener('click', () => {
      closeDrawer();
      const orig = $('loreToggle');
      if (orig && typeof orig.click === 'function') orig.click();
    });
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
      const tier = (auth.user.tier || auth.tier || 'free').toString();
      const nice = name.length > 16 ? name.slice(0, 14) + '…' : name;
      label.textContent = nice.toUpperCase();
      // Tier glow
      const glow = tier === 'owner' ? '#ffe07c'
                 : tier === 'god'   ? '#b47cff'
                 : tier === 'premium' ? '#7ccfff'
                 : '#7cffb4';
      if (dot) {
        dot.style.background = glow;
        dot.style.boxShadow = `0 0 10px ${glow}`;
      }
      refs.auth.style.borderColor = `${glow}55`;
      refs.auth.style.color = glow;
    } else {
      label.textContent = 'SIGN IN';
      if (dot) {
        dot.style.background = 'rgba(255,90,90,0.85)';
        dot.style.boxShadow = '0 0 8px rgba(255,90,90,0.5)';
      }
      refs.auth.style.borderColor = 'rgba(124,207,255,0.28)';
      refs.auth.style.color = 'rgba(124,207,255,0.85)';
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
      refs.header.style.padding = '6px max(8px, env(safe-area-inset-right, 8px)) 6px max(8px, env(safe-area-inset-left, 8px))';
      // Hide lore pill text on mobile, keep menu
      const lore = $('topLorePillLabel');
      if (lore) lore.style.display = 'none';
    } else {
      refs.header.style.padding = '8px max(12px, env(safe-area-inset-right, 12px)) 8px max(12px, env(safe-area-inset-left, 12px))';
      const lore = $('topLorePillLabel');
      if (lore) lore.style.display = '';
    }
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
