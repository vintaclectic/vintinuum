/* ═══════════════════════════════════════════════════════════════════════════
   VINTINUUM · USER GUIDE — popup  (body/guide.js)
   ───────────────────────────────────────────────────────────────────────────
   window.VintGuide — vanilla JS, zero deps, offline-capable.

   API:
     VintGuide.open(sectionId?)   open the popup (optionally to an article id)
     VintGuide.close()            close it

   Features:
     - Header: "VINTINUUM · USER GUIDE" + close X (always clickable/tappable)
     - Big search input (autofocus) with debounced fuzzy autocomplete dropdown
       (matches title + tags, max 8, keyboard ↑/↓/Enter/Esc)
     - Left rail of sections grouped by category (desktop) /
       horizontal scrolling chip bar (mobile, <720px)
     - Main pane renders the selected article's HTML
     - Footer: "Open full README on GitHub →"
     - Deep-link: ?guide=<id> opens to that article on load
     - Remembers last article in localStorage "vint:guide:lastSection"

   Search ranking (best → worst):
       title-prefix > title-contains > tag-match > body-contains
   Ties broken by article order in the manifest.

   No-overflow mandate (CLAUDE.md): the popup is a fixed full-viewport scrim
   with an inner card clamped to the viewport (min(...,Npx) + max-height with
   100svh). The card's BODY scrolls internally — content never bleeds out. On
   phones (<720px) the card goes edge-to-edge full-screen. z-index 9999 sits
   above page content but is self-contained; ESC and click-outside always close.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.VintGuide) return; // idempotent

  var README_URL = 'https://github.com/vintaclectic/vintinuum/blob/main/README.md';
  var LS_LAST = 'vint:guide:lastSection';
  var Z = 9999;
  var MOBILE_BP = 720;

  // ── State ──────────────────────────────────────────────────────────────────
  var built = false;
  var els = {};                 // cached element refs
  var currentId = null;
  var searchDebounce = null;
  var acItems = [];             // current autocomplete result list
  var acIndex = -1;             // highlighted autocomplete row
  var escHandler = null;

  function content() {
    return (window.VINT_GUIDE_CONTENT && window.VINT_GUIDE_CONTENT.length)
      ? window.VINT_GUIDE_CONTENT
      : [];
  }
  function byId(id) {
    var list = content();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function isMobile() { return window.innerWidth < MOBILE_BP; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Search ranking ──────────────────────────────────────────────────────────
  // 4 = title prefix, 3 = title contains, 2 = tag match, 1 = body contains, 0 = none
  function score(article, q) {
    if (!q) return 0;
    var t = (article.title || '').toLowerCase();
    if (t.indexOf(q) === 0) return 4;
    if (t.indexOf(q) !== -1) return 3;
    var tags = article.tags || [];
    for (var i = 0; i < tags.length; i++) {
      if (String(tags[i]).toLowerCase().indexOf(q) !== -1) return 2;
    }
    var b = (article.body || '').toLowerCase();
    if (b.indexOf(q) !== -1) return 1;
    return 0;
  }
  function search(query) {
    var q = (query || '').trim().toLowerCase();
    if (!q) return [];
    var list = content();
    var scored = [];
    for (var i = 0; i < list.length; i++) {
      var s = score(list[i], q);
      if (s > 0) scored.push({ a: list[i], s: s, i: i });
    }
    scored.sort(function (x, y) { return (y.s - x.s) || (x.i - y.i); });
    return scored.slice(0, 8).map(function (r) { return r.a; });
  }

  // ── Build DOM (once) ─────────────────────────────────────────────────────────
  function build() {
    if (built) return;
    injectCSS();

    var scrim = document.createElement('div');
    scrim.id = 'vintGuideScrim';
    scrim.setAttribute('role', 'dialog');
    scrim.setAttribute('aria-modal', 'true');
    scrim.setAttribute('aria-label', 'Vintinuum User Guide');
    scrim.className = 'vg-scrim';

    var card = document.createElement('div');
    card.className = 'vg-card';
    card.id = 'vintGuideCard';

    card.innerHTML =
      '<header class="vg-head">' +
        '<div class="vg-title">VINTINUUM · USER GUIDE</div>' +
        '<button type="button" id="vgClose" class="vg-close" aria-label="Close guide" data-draggable="false">×</button>' +
      '</header>' +
      '<div class="vg-searchwrap">' +
        '<input type="text" id="vgSearch" class="vg-search" autocomplete="off" ' +
          'spellcheck="false" placeholder="Search the guide — try “surgery”, “memory”, “voice”…" ' +
          'aria-label="Search the guide" aria-expanded="false" aria-controls="vgAuto" role="combobox" />' +
        '<ul id="vgAuto" class="vg-auto" role="listbox" aria-label="Search results"></ul>' +
      '</div>' +
      '<nav id="vgChips" class="vg-chips" aria-label="Sections"></nav>' +
      '<div class="vg-body">' +
        '<aside id="vgRail" class="vg-rail" aria-label="Guide sections"></aside>' +
        '<main id="vgMain" class="vg-main" tabindex="-1"></main>' +
      '</div>' +
      '<footer class="vg-foot">' +
        '<a href="' + README_URL + '" target="_blank" rel="noopener" class="vg-readme">Open full README on GitHub →</a>' +
      '</footer>';

    scrim.appendChild(card);
    document.body.appendChild(scrim);

    els.scrim  = scrim;
    els.card   = card;
    els.close  = card.querySelector('#vgClose');
    els.search = card.querySelector('#vgSearch');
    els.auto   = card.querySelector('#vgAuto');
    els.chips  = card.querySelector('#vgChips');
    els.rail   = card.querySelector('#vgRail');
    els.main   = card.querySelector('#vgMain');

    // Close interactions
    els.close.addEventListener('click', function (e) { e.preventDefault(); close(); });
    // Click-outside (scrim, not card) closes
    scrim.addEventListener('mousedown', function (e) { if (e.target === scrim) close(); });
    scrim.addEventListener('touchstart', function (e) { if (e.target === scrim) close(); }, { passive: true });

    // Search wiring
    els.search.addEventListener('input', function () {
      if (searchDebounce) clearTimeout(searchDebounce);
      searchDebounce = setTimeout(runSearch, 100);
    });
    els.search.addEventListener('keydown', onSearchKey);
    // Re-show results on focus if there's a query
    els.search.addEventListener('focus', function () {
      if (els.search.value.trim()) runSearch();
    });
    // Hide autocomplete when clicking elsewhere inside the card
    card.addEventListener('mousedown', function (e) {
      if (!els.auto.contains(e.target) && e.target !== els.search) hideAuto();
    });

    built = true;
    renderRail();
    renderChips();
    window.addEventListener('resize', onResize, { passive: true });
  }

  // ── Sections (grouped by manifest order) ─────────────────────────────────────
  function sectionsInOrder() {
    var order = [];
    var seen = {};
    var list = content();
    for (var i = 0; i < list.length; i++) {
      var s = list[i].section || 'Guide';
      if (!seen[s]) { seen[s] = true; order.push(s); }
    }
    return order;
  }
  function articlesIn(section) {
    return content().filter(function (a) { return (a.section || 'Guide') === section; });
  }

  function renderRail() {
    if (!els.rail) return;
    var html = '';
    var secs = sectionsInOrder();
    for (var i = 0; i < secs.length; i++) {
      var sec = secs[i];
      html += '<div class="vg-railsec">' + esc(sec) + '</div>';
      var arts = articlesIn(sec);
      for (var j = 0; j < arts.length; j++) {
        var a = arts[j];
        html += '<button type="button" class="vg-raillink' +
          (a.id === currentId ? ' active' : '') +
          '" data-id="' + esc(a.id) + '">' + esc(a.title) + '</button>';
      }
    }
    els.rail.innerHTML = html;
    els.rail.querySelectorAll('.vg-raillink').forEach(function (b) {
      b.addEventListener('click', function () { selectArticle(b.getAttribute('data-id')); });
    });
  }

  // Mobile chip bar: one chip per section, jumps to that section's first article
  function renderChips() {
    if (!els.chips) return;
    var html = '';
    var secs = sectionsInOrder();
    for (var i = 0; i < secs.length; i++) {
      var arts = articlesIn(secs[i]);
      if (!arts.length) continue;
      var firstId = arts[0].id;
      var activeInSec = arts.some(function (a) { return a.id === currentId; });
      html += '<button type="button" class="vg-chip' + (activeInSec ? ' active' : '') +
        '" data-id="' + esc(firstId) + '">' + esc(secs[i]) + '</button>';
    }
    els.chips.innerHTML = html;
    els.chips.querySelectorAll('.vg-chip').forEach(function (b) {
      b.addEventListener('click', function () { selectArticle(b.getAttribute('data-id')); });
    });
  }

  // ── Render a single article ───────────────────────────────────────────────────
  function selectArticle(id) {
    var a = byId(id);
    if (!a) {
      // fall back to first article
      var list = content();
      if (!list.length) { renderEmpty(); return; }
      a = list[0];
    }
    currentId = a.id;
    try { localStorage.setItem(LS_LAST, a.id); } catch (_) {}

    var pageBtn = a.page
      ? '<a href="' + esc(a.page) + '" class="vg-goto">Go to ' + esc(prettyPage(a.page)) + ' →</a>'
      : '';

    els.main.innerHTML =
      '<div class="vg-article">' +
        '<div class="vg-artsec">' + esc(a.section || '') + '</div>' +
        '<h2 class="vg-arttitle">' + esc(a.title) + '</h2>' +
        '<div class="vg-artbody">' + (a.body || '') + '</div>' +
        pageBtn +
      '</div>';

    els.main.scrollTop = 0;
    // refresh active markers without rebuilding listeners-heavy rail every nav
    els.rail.querySelectorAll('.vg-raillink').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-id') === currentId);
      if (b.classList.contains('active')) {
        try { b.scrollIntoView({ block: 'nearest' }); } catch (_) {}
      }
    });
    renderChips();
    hideAuto();
  }

  function prettyPage(page) {
    if (!page) return '';
    var base = String(page).replace(/\.html.*$/, '').replace(/^.*\//, '');
    if (base.indexOf('#') !== -1) base = base.split('#')[0] || base.split('#')[1];
    return base.toUpperCase();
  }

  function renderEmpty() {
    els.main.innerHTML =
      '<div class="vg-article"><p class="vg-empty">The guide content failed to load. ' +
      'Open the <a href="' + README_URL + '" target="_blank" rel="noopener">README on GitHub</a> instead.</p></div>';
  }

  // ── Autocomplete ───────────────────────────────────────────────────────────────
  function runSearch() {
    var q = els.search.value;
    acItems = search(q);
    acIndex = -1;
    if (!acItems.length) { hideAuto(); return; }
    var html = '';
    for (var i = 0; i < acItems.length; i++) {
      var a = acItems[i];
      html += '<li class="vg-acrow" role="option" data-id="' + esc(a.id) + '" data-idx="' + i + '">' +
        '<span class="vg-actitle">' + esc(a.title) + '</span>' +
        '<span class="vg-acsec">' + esc(a.section || '') + '</span>' +
      '</li>';
    }
    els.auto.innerHTML = html;
    els.auto.style.display = 'block';
    els.search.setAttribute('aria-expanded', 'true');
    els.auto.querySelectorAll('.vg-acrow').forEach(function (row) {
      row.addEventListener('mousedown', function (e) {
        e.preventDefault(); // keep focus, prevent card mousedown close of auto
        selectArticle(row.getAttribute('data-id'));
        els.search.value = '';
      });
      row.addEventListener('mouseenter', function () {
        acIndex = parseInt(row.getAttribute('data-idx'), 10);
        highlightAuto();
      });
    });
  }
  function hideAuto() {
    if (!els.auto) return;
    els.auto.style.display = 'none';
    els.auto.innerHTML = '';
    acItems = [];
    acIndex = -1;
    if (els.search) els.search.setAttribute('aria-expanded', 'false');
  }
  function highlightAuto() {
    var rows = els.auto.querySelectorAll('.vg-acrow');
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.toggle('active', i === acIndex);
    }
  }
  function onSearchKey(e) {
    if (e.key === 'Escape') {
      if (els.auto.style.display === 'block' && acItems.length) {
        e.preventDefault(); e.stopPropagation();
        hideAuto();
        return;
      }
      // otherwise let the global ESC close the popup
      return;
    }
    if (!acItems.length) {
      if (e.key === 'Enter') {
        // run an immediate search on Enter even if debounce hasn't fired
        runSearch();
        if (acItems.length) { acIndex = 0; highlightAuto(); }
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      acIndex = (acIndex + 1) % acItems.length;
      highlightAuto();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      acIndex = (acIndex - 1 + acItems.length) % acItems.length;
      highlightAuto();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      var pick = acIndex >= 0 ? acItems[acIndex] : acItems[0];
      if (pick) { selectArticle(pick.id); els.search.value = ''; }
    }
  }

  // ── Responsive (rail vs chips handled in CSS; just refresh chip active) ────────
  function onResize() { if (built) renderChips(); }

  // ── Open / Close ───────────────────────────────────────────────────────────────
  function open(sectionId) {
    build();
    if (!content().length) renderEmpty();

    // Resolve which article to show:
    //   explicit arg > ?guide= param > last localStorage > first article
    var target = sectionId;
    if (!target) {
      try {
        var p = new URLSearchParams(location.search);
        if (p.get('guide')) target = p.get('guide');
      } catch (_) {}
    }
    if (!target) {
      try { target = localStorage.getItem(LS_LAST); } catch (_) {}
    }
    if (!target || !byId(target)) {
      var list = content();
      target = list.length ? list[0].id : null;
    }
    if (target) selectArticle(target); else renderEmpty();

    els.scrim.classList.add('vg-open');
    document.documentElement.classList.add('vg-lock');

    // ESC closes (capture so it beats page-level handlers)
    escHandler = function (e) {
      if (e.key === 'Escape') {
        // if autocomplete is open, the search keydown already handled it
        if (els.auto && els.auto.style.display === 'block' && acItems.length) return;
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', escHandler, true);

    // Autofocus search (after the fade so it doesn't fight the transition)
    setTimeout(function () { try { els.search.focus(); } catch (_) {} }, 60);
  }

  function close() {
    if (!built || !els.scrim) return;
    els.scrim.classList.remove('vg-open');
    document.documentElement.classList.remove('vg-lock');
    hideAuto();
    if (escHandler) { document.removeEventListener('keydown', escHandler, true); escHandler = null; }
    // strip ?guide= from the URL so a reload doesn't reopen unexpectedly
    try {
      var url = new URL(location.href);
      if (url.searchParams.has('guide')) {
        url.searchParams.delete('guide');
        history.replaceState(null, '', url.pathname + (url.search ? url.search : '') + url.hash);
      }
    } catch (_) {}
  }

  // ── Styles ─────────────────────────────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById('vintGuideCSS')) return;
    var css = document.createElement('style');
    css.id = 'vintGuideCSS';
    css.textContent = [
      // lock page scroll while open
      'html.vg-lock,html.vg-lock body{overflow:hidden!important;}',
      // scrim
      '.vg-scrim{position:fixed;inset:0;z-index:' + Z + ';display:flex;align-items:center;',
        'justify-content:center;padding:max(16px,env(safe-area-inset-top,16px)) 16px ',
        'max(16px,env(safe-area-inset-bottom,16px));',
        'background:rgba(1,3,6,0.74);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);',
        'opacity:0;pointer-events:none;transition:opacity 200ms ease;',
        "font-family:'Space Mono',monospace;}",
      '.vg-scrim.vg-open{opacity:1;pointer-events:auto;}',
      // card — clamped, internal scroll only
      '.vg-card{position:relative;display:flex;flex-direction:column;width:min(960px,100%);',
        'max-height:min(86svh,860px);background:linear-gradient(180deg,#080b14 0%,#101522 100%);',
        'border:1px solid rgba(124,207,255,0.18);border-radius:18px;',
        'box-shadow:0 24px 80px rgba(0,0,0,0.6);overflow:hidden;',
        'transform:translateY(8px) scale(0.99);transition:transform 200ms cubic-bezier(.16,1,.3,1);}',
      '.vg-scrim.vg-open .vg-card{transform:none;}',
      // header
      '.vg-head{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;',
        'gap:12px;padding:14px 18px;border-bottom:1px solid rgba(124,207,255,0.12);}',
      '.vg-title{font-size:0.6rem;letter-spacing:0.18em;text-transform:uppercase;color:#7ccfff;font-weight:700;}',
      '.vg-close{flex:0 0 auto;width:36px;height:36px;min-width:44px;min-height:44px;',
        'display:flex;align-items:center;justify-content:center;background:rgba(8,12,20,0.55);',
        'border:1px solid rgba(255,255,255,0.12);color:rgba(218,228,255,0.7);border-radius:50%;',
        'cursor:pointer;font-size:18px;line-height:1;transition:all 160ms ease;}',
      '.vg-close:hover{background:rgba(20,28,42,0.7);border-color:rgba(124,207,255,0.4);color:#fff;}',
      // search
      '.vg-searchwrap{flex:0 0 auto;position:relative;padding:14px 18px 10px;}',
      '.vg-search{width:100%;box-sizing:border-box;padding:12px 14px;min-height:44px;',
        'background:rgba(8,12,20,0.6);border:1px solid rgba(124,207,255,0.22);border-radius:12px;',
        "color:rgba(232,240,255,0.95);font-family:'Space Mono',monospace;font-size:0.8rem;",
        'letter-spacing:0.02em;outline:none;transition:border-color 160ms ease;}',
      '.vg-search::placeholder{color:rgba(218,228,255,0.38);}',
      '.vg-search:focus{border-color:rgba(124,207,255,0.55);box-shadow:0 0 0 3px rgba(124,207,255,0.12);}',
      // autocomplete
      '.vg-auto{display:none;position:absolute;left:18px;right:18px;top:calc(100% - 4px);',
        'z-index:5;margin:0;padding:6px;list-style:none;max-height:320px;overflow-y:auto;',
        'background:#0c1120;border:1px solid rgba(124,207,255,0.28);border-radius:12px;',
        'box-shadow:0 16px 48px rgba(0,0,0,0.6);}',
      '.vg-acrow{display:flex;align-items:center;justify-content:space-between;gap:10px;',
        'padding:10px 12px;min-height:44px;border-radius:9px;cursor:pointer;}',
      '.vg-acrow.active,.vg-acrow:hover{background:rgba(124,207,255,0.12);}',
      '.vg-actitle{color:rgba(232,240,255,0.95);font-size:0.72rem;letter-spacing:0.02em;}',
      '.vg-acsec{flex:0 0 auto;color:rgba(124,207,255,0.7);font-size:0.5rem;letter-spacing:0.16em;',
        'text-transform:uppercase;}',
      // chips (mobile only)
      '.vg-chips{display:none;flex:0 0 auto;gap:8px;overflow-x:auto;overflow-y:hidden;',
        'padding:4px 18px 12px;-webkit-overflow-scrolling:touch;scrollbar-width:none;}',
      '.vg-chips::-webkit-scrollbar{display:none;}',
      '.vg-chip{flex:0 0 auto;padding:8px 14px;min-height:40px;background:rgba(8,12,20,0.6);',
        'border:1px solid rgba(255,255,255,0.10);color:rgba(218,228,255,0.78);border-radius:999px;',
        "cursor:pointer;font-family:'Space Mono',monospace;font-size:0.52rem;letter-spacing:0.16em;",
        'text-transform:uppercase;white-space:nowrap;transition:all 160ms ease;}',
      '.vg-chip.active{background:rgba(124,207,255,0.12);border-color:rgba(124,207,255,0.45);color:#7ccfff;}',
      // body: rail + main
      '.vg-body{flex:1 1 auto;display:flex;min-height:0;overflow:hidden;}',
      '.vg-rail{flex:0 0 232px;overflow-y:auto;padding:8px 10px 16px;',
        'border-right:1px solid rgba(255,255,255,0.06);scrollbar-width:thin;}',
      '.vg-railsec{padding:14px 10px 6px;font-size:0.5rem;letter-spacing:0.24em;text-transform:uppercase;',
        'color:rgba(218,228,255,0.42);}',
      '.vg-raillink{display:block;width:100%;text-align:left;padding:9px 10px;margin:2px 0;',
        'min-height:38px;background:none;border:1px solid transparent;border-radius:9px;',
        "color:rgba(218,228,255,0.75);font-family:'Space Mono',monospace;font-size:0.62rem;",
        'letter-spacing:0.04em;cursor:pointer;transition:all 150ms ease;line-height:1.35;}',
      '.vg-raillink:hover{background:rgba(20,28,42,0.7);color:rgba(232,240,255,0.95);}',
      '.vg-raillink.active{background:rgba(124,207,255,0.10);border-color:rgba(124,207,255,0.4);color:#7ccfff;}',
      // main pane
      '.vg-main{flex:1 1 auto;min-width:0;overflow-y:auto;padding:24px 30px 32px;',
        'scrollbar-width:thin;outline:none;}',
      '.vg-article{max-width:640px;}',
      '.vg-artsec{font-size:0.5rem;letter-spacing:0.24em;text-transform:uppercase;color:#7ccfff;margin-bottom:8px;}',
      '.vg-arttitle{margin:0 0 16px;font-family:\'Cormorant Garamond\',serif;font-style:italic;',
        'font-weight:300;font-size:1.9rem;line-height:1.15;',
        'background:linear-gradient(130deg,#80deea,#ce93d8,#ffd54f);',
        '-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}',
      '.vg-artbody{color:rgba(218,228,255,0.82);font-size:0.82rem;line-height:1.75;letter-spacing:0.01em;}',
      '.vg-artbody p{margin:0 0 14px;}',
      '.vg-artbody ul,.vg-artbody ol{margin:0 0 14px;padding-left:1.25em;}',
      '.vg-artbody li{margin:0 0 8px;}',
      '.vg-artbody strong{color:rgba(232,240,255,0.96);font-weight:700;}',
      '.vg-artbody em{color:rgba(206,147,216,0.92);font-style:italic;}',
      '.vg-artbody code{font-family:\'Space Mono\',monospace;font-size:0.74rem;',
        'background:rgba(124,207,255,0.1);border:1px solid rgba(124,207,255,0.18);',
        'border-radius:5px;padding:1px 6px;color:#9fd9ff;}',
      '.vg-artbody a{color:#7ccfff;}',
      '.vg-goto{display:inline-flex;align-items:center;margin-top:8px;padding:11px 18px;min-height:44px;',
        'background:rgba(124,207,255,0.08);border:1px solid rgba(124,207,255,0.32);color:#7ccfff;',
        'border-radius:12px;text-decoration:none;font-size:0.55rem;letter-spacing:0.16em;',
        'text-transform:uppercase;transition:all 160ms ease;}',
      '.vg-goto:hover{background:rgba(124,207,255,0.16);border-color:rgba(124,207,255,0.5);}',
      '.vg-empty{color:rgba(218,228,255,0.6);font-size:0.8rem;line-height:1.7;}',
      // footer
      '.vg-foot{flex:0 0 auto;display:flex;align-items:center;justify-content:flex-end;',
        'padding:12px 18px;border-top:1px solid rgba(255,255,255,0.06);}',
      '.vg-readme{color:rgba(218,228,255,0.6);font-size:0.55rem;letter-spacing:0.16em;',
        'text-transform:uppercase;text-decoration:none;transition:color 160ms ease;}',
      '.vg-readme:hover{color:#7ccfff;}',
      // ── Mobile: full-screen, chips instead of rail ──
      '@media (max-width:719px){',
        '.vg-scrim{padding:0;}',
        '.vg-card{width:100%;max-height:100svh;height:100svh;border:none;border-radius:0;}',
        '.vg-head{padding-top:max(14px,env(safe-area-inset-top,14px));}',
        '.vg-searchwrap{position:sticky;top:0;z-index:6;background:#080b14;}',
        '.vg-chips{display:flex;}',
        '.vg-rail{display:none;}',
        '.vg-main{padding:18px 18px max(28px,env(safe-area-inset-bottom,28px));}',
        '.vg-arttitle{font-size:1.6rem;}',
        '.vg-foot{padding-bottom:max(12px,env(safe-area-inset-bottom,12px));}',
      '}'
    ].join('');
    document.head.appendChild(css);
  }

  // ── Deep-link auto-open on load (?guide=<id>) ────────────────────────────────────
  function maybeAutoOpen() {
    try {
      var p = new URLSearchParams(location.search);
      if (p.get('guide')) open(p.get('guide'));
    } catch (_) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeAutoOpen, { once: true });
  } else {
    maybeAutoOpen();
  }

  // ── Export ─────────────────────────────────────────────────────────────────────
  window.VintGuide = { open: open, close: close };
})();
