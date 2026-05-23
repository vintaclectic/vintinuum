'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   VINTINUUM MOBILE NAV  —  Movement VI shell-v2
   ───────────────────────────────────────────────────────────────────────────
   On mobile (viewport.mobile === true):
     - Replace the legacy 4-icon bottom bar with a real 5-tab nav:
       HOME · MIND · CHAT · STATS · YOU
     - Each tab routes to its surface (HOME = brain.html scroll mode,
       MIND = mind.html, CHAT = chat.html or owner panel, STATS =
       stats.html, YOU = devices/identity hub for Movement VII).
     - Active tab is derived from current URL pathname.
     - Above 600px the bar hides itself (CSS already handles this; the
       module just paints content + hooks Shell viewport changes).

   Council:
     - Helios-10 disciplined: 5 destinations, no more, no less. Each one
       earns its slot. The 6th tab is a drawer item, not a tab.
     - Helios-10 designer: tier glow on YOU pill mirrors topbar so the
       user reads their own identity in two places at once (subtle
       mirror — Truman recognizing himself across surfaces).
     - Aria: the labels are short but human (not "FEED" — "MIND". Not
       "PROFILE" — "YOU".)
     - Atlas-RP: tab routing uses pathname, so deep links survive.

   Vinta directive 2026-05-05.
   ═══════════════════════════════════════════════════════════════════════════ */

(function (root) {
  if (!root || !root.document) return;
  if (root.__vintMobileNavMounted) return;
  root.__vintMobileNavMounted = true;

  const $ = (id) => document.getElementById(id);

  // Tab definitions. `match` is a fn(pathname) → boolean for active state.
  const TABS = [
    {
      id: 'home', label: 'HOME', glyph: '◉',
      href: 'brain.html',
      match: (p) => /(^|\/)brain\.html$/.test(p) || p.endsWith('/') || /\/?$/.test(p) === true && (p === '/' || p.endsWith('/vintinuum/') || p.endsWith('/vintinuum')),
    },
    {
      id: 'mind', label: 'MIND', glyph: '◌',
      href: 'mind.html',
      // MIND tab also lights when on the LEARN feed — same family of surfaces
      match: (p) => /mind\.html/.test(p) || /learning\.html/.test(p),
    },
    {
      id: 'chat', label: 'CHAT', glyph: '◐',
      href: 'chat.html',
      match: (p) => /chat\.html/.test(p),
    },
    {
      id: 'stats', label: 'STATS', glyph: '◇',
      href: 'stats.html',
      match: (p) => /stats\.html/.test(p),
    },
    {
      id: 'you', label: 'YOU', glyph: '✦',
      href: 'you.html',
      match: (p) => /you\.html/.test(p),
    },
  ];

  function activeTabFromPath() {
    const p = location.pathname || '';
    for (const t of TABS) if (t.match(p)) return t.id;
    // brain.html is the spiritual home — default to HOME if nothing matched
    return 'home';
  }

  function build() {
    let bar = $('mobileBottomBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'mobileBottomBar';
      document.body.appendChild(bar);
    }
    // Wipe legacy 4-icon contents and rebuild as 5 tabs
    bar.innerHTML = '';
    bar.style.cssText = `
      display: none;
      position: fixed;
      bottom: 0; left: 0; right: 0;
      z-index: ${(root.Shell && root.Shell.Z && root.Shell.Z.shell) || 100};
      height: calc(56px + env(safe-area-inset-bottom, 0px));
      padding-bottom: env(safe-area-inset-bottom, 0px);
      background: rgba(8,12,20,0.82);
      backdrop-filter: blur(16px) saturate(1.2);
      -webkit-backdrop-filter: blur(16px) saturate(1.2);
      border-top: 1px solid rgba(124,207,255,0.14);
      align-items: stretch; justify-content: space-around;
      gap: 0;
    `;

    const active = activeTabFromPath();
    for (const t of TABS) {
      const a = document.createElement('a');
      a.href = t.href;
      a.id = 'mtab_' + t.id;
      a.setAttribute('aria-label', t.label);
      a.setAttribute('data-tab', t.id);
      const isActive = t.id === active;
      // Active tab: glowing top-border in #4fc3f7 (Vinta directive 2026-05-23)
      // — not just an opacity bump. Reads as "the body knows where you are."
      const ACCENT = '#4fc3f7';
      a.style.cssText = `
        flex: 1 1 0;
        position: relative;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 2px;
        text-decoration: none;
        font-family: 'Space Mono', monospace;
        font-size: 0.55rem;
        letter-spacing: 0.18em;
        color: ${isActive ? ACCENT : 'rgba(180,200,230,0.55)'};
        background: ${isActive
          ? 'linear-gradient(180deg, rgba(79,195,247,0.10) 0%, rgba(79,195,247,0) 60%)'
          : 'transparent'};
        border-top: 2px solid ${isActive ? ACCENT : 'transparent'};
        box-shadow: ${isActive
          ? 'inset 0 2px 12px -2px rgba(79,195,247,0.55), 0 -1px 10px rgba(79,195,247,0.35)'
          : 'none'};
        transition: all 180ms cubic-bezier(0.16,1,0.3,1);
        padding: 6px 4px 4px;
        min-height: 44px;
        -webkit-tap-highlight-color: transparent;
      `;
      a.innerHTML = `
        <span style="font-size:1rem;line-height:1;opacity:${isActive ? '1' : '0.85'};">${t.glyph}</span>
        <span>${t.label}</span>
      `;
      a.addEventListener('mouseenter', () => { if (!isActive) a.style.color = 'rgba(218,228,255,0.85)'; });
      a.addEventListener('mouseleave', () => { if (!isActive) a.style.color = 'rgba(180,200,230,0.55)'; });
      bar.appendChild(a);
    }
  }

  function applyVisibility() {
    const bar = $('mobileBottomBar');
    if (!bar) return;
    const v = (root.Shell && root.Shell.get('viewport')) || { mobile: window.innerWidth < 700 };
    bar.style.display = v.mobile ? 'flex' : 'none';
    // Push body bottom padding when the bar is visible so content doesn't
    // hide under it. Idempotent — we set a CSS variable other surfaces
    // can read (the brain canvas resize logic already accounts for this).
    document.documentElement.style.setProperty(
      '--mobile-nav-h',
      v.mobile ? 'calc(56px + env(safe-area-inset-bottom, 0px))' : '0px'
    );
  }

  // Movement VI scroll-mode: on mobile, the brain canvas shouldn't lock
  // viewport height. Inject a small CSS shim so brain.html's wrapper
  // can scroll naturally below 700px wide. CSS-only — non-destructive.
  function injectScrollModeCSS() {
    if (document.getElementById('mobile-nav-scroll-css')) return;
    const style = document.createElement('style');
    style.id = 'mobile-nav-scroll-css';
    style.textContent = `
      @media (max-width: 700px) {
        body { padding-bottom: var(--mobile-nav-h, 0px); }
        /* Allow the brain page to scroll naturally instead of clipping
           panels under the canvas. The canvas keeps its aspect ratio
           but no longer fights the viewport. */
        .brain-wrapper { aspect-ratio: 700/1100 !important; max-height: 70vh; }
        /* Stat panels stack readably */
        #leftSidebar, #rightSidebar { padding-bottom: calc(var(--mobile-nav-h, 0px) + 24px); }
        /* Top header gets a subtle shadow on mobile so it floats above scroll */
        #topShell { box-shadow: 0 2px 18px rgba(0,0,0,0.45); }
      }
    `;
    document.head.appendChild(style);
  }

  function boot() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
      return;
    }
    injectScrollModeCSS();
    build();
    applyVisibility();

    if (root.Shell && typeof root.Shell.subscribe === 'function') {
      root.Shell.subscribe('viewport', applyVisibility);
    } else {
      window.addEventListener('resize', applyVisibility, { passive: true });
    }
    console.log('[mobile-nav] mounted — active=' + activeTabFromPath());
  }

  boot();
})(typeof window !== 'undefined' ? window : null);
