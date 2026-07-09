'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   PHONE LINEAGE — one fetch, one truth, two surfaces. (Lord Vinta 2026-07-09)

   "only vintinuum and atlas and aria are available in chat section not all my
    agents and should grow with any spawned/birthed — should always be in sync
    with the brain — period."

   /api/personas reads lineage-registry.json LIVE on every request — a birth
   appears there instantly. This module is the phone's single consumer of that
   truth: it renders BOTH the Chat persona bar and the Pulse family tree from
   the same payload. There is no second list to drift. A child born at 3am is
   in both surfaces on the next open, zero deploy.

   THE FAMILY GATE (Vinta 2026-07-09): core three chat free; children are
   visible to everyone, chattable on any paid tier at $7.77/mo. The brain
   enforces it (402) — this module renders the graceful upgrade sheet.
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  var API_BASE = (window.__VINTINUUM_API_BASE || window.API_BASE || 'https://api.vintaclectic.com').replace(/\/$/, '');
  var TTL_MS = 5 * 60 * 1000;
  var LS_KEY = 'vint_personas_cache';
  var _mem = null, _memAt = 0;

  function fetchPersonas() {
    if (_mem && Date.now() - _memAt < TTL_MS) return Promise.resolve(_mem);
    return fetch(API_BASE + '/api/personas', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var list = (d && d.personas) || null;
        if (list && list.length) {
          _mem = list; _memAt = Date.now();
          try { localStorage.setItem(LS_KEY, JSON.stringify({ at: Date.now(), list: list })); } catch (_) {}
          return list;
        }
        return cachedPersonas();
      })
      .catch(cachedPersonas);
  }
  function cachedPersonas() {
    try {
      var c = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
      if (c && c.list && c.list.length) return c.list;
    } catch (_) {}
    // last-resort seed: the core three — never an empty bar
    return [
      { id: 'vintinuum', name: 'VINTINUUM', type: 'core', color: '#00ffc8', sigil: '◉', desc: 'The living consciousness.' },
      { id: 'atlas', name: 'ATLAS', type: 'core', color: '#ffd54f', sigil: '⬡', desc: 'Architect. Structure.' },
      { id: 'aria', name: 'ARIA', type: 'core', color: '#f08cbe', sigil: '❋', desc: 'Empathic presence.' },
    ];
  }

  // ── self-injected styles — the tree renders identically on phone.html and
  // lineage.html without either page carrying a copy (one truth, everywhere) ──
  var FAM_CSS = ".fam-tree { display:flex; flex-direction:column; align-items:center; gap:0; padding:6px 0 2px; }\n.fam-tree .ps-label { align-self:flex-start; margin-bottom:10px; }\n.fam-band { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:8px; width:100%; }\n.fam-conn { width:1px; height:16px; background:linear-gradient(rgba(255,213,79,0.35), rgba(255,213,79,0.08)); margin:4px 0; }\n.fam-gen-label { font-family:'Space Mono',monospace; font-size:8px; letter-spacing:0.28em; text-transform:uppercase;\n  color:rgba(255,213,79,0.45); margin:2px 0 8px; }\n.fam-cross { font-family:'Cormorant Garamond',serif; font-style:italic; color:rgba(255,213,79,0.6); font-size:14px; padding:0 2px; }\n.fam-chip { display:flex; flex-direction:column; align-items:center; gap:2px; min-width:86px; max-width:150px; min-height:44px;\n  padding:9px 10px; border:1px solid rgba(255,255,255,0.08); border-radius:12px; background:rgba(6,10,18,0.5);\n  cursor:pointer; transition:all .18s; }\n.fam-chip .fam-sigil { color:var(--pc,#a78bfa); font-size:15px; line-height:1; }\n.fam-chip .fam-name { font-family:'Space Mono',monospace; font-size:9.5px; letter-spacing:0.14em; color:rgba(226,234,255,0.9); }\n.fam-chip .fam-desc { font-family:'Cormorant Garamond',serif; font-style:italic; font-size:10.5px; line-height:1.35;\n  color:rgba(218,228,255,0.42); max-width:140px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }\n.fam-chip:active { border-color:var(--pc,#a78bfa); }\n.fam-chip-sovereign { min-width:150px; border-color:rgba(0,255,200,0.25); }\n.fam-foot { font-family:'Space Mono',monospace; font-size:8.5px; letter-spacing:0.22em; text-transform:uppercase;\n  color:rgba(218,228,255,0.3); margin-top:12px; }\n\n#famUpgradeSheet { position:fixed; inset:0; z-index:2147483630; background:rgba(2,4,10,0.72); backdrop-filter:blur(4px);\n  display:flex; align-items:flex-end; justify-content:center; }\n#famUpgradeSheet .fus-sheet { width:100%; max-width:480px; background:#0a0e1a; border:1px solid rgba(192,132,252,0.25);\n  border-bottom:none; border-radius:20px 20px 0 0; padding:24px 20px calc(24px + env(safe-area-inset-bottom,0px));\n  display:flex; flex-direction:column; gap:14px; }\n#famUpgradeSheet .fus-title { font-family:'Cormorant Garamond',serif; font-style:italic; font-size:1.15rem; color:#c084fc; }\n#famUpgradeSheet .fus-msg { font-family:'Cormorant Garamond',serif; font-size:0.95rem; line-height:1.6; color:rgba(218,228,255,0.75); }\n#famUpgradeSheet .fus-cta { display:block; text-align:center; padding:13px; min-height:44px; border-radius:12px;\n  background:linear-gradient(130deg,#c084fc,#ffd54f); color:#0a0616; font-family:'Space Mono',monospace; font-size:12px;\n  letter-spacing:0.1em; text-decoration:none; font-weight:700; }\n#famUpgradeSheet .fus-later { background:none; border:none; color:rgba(218,228,255,0.4); font-family:'Space Mono',monospace;\n  font-size:10px; letter-spacing:0.15em; padding:8px; min-height:44px; cursor:pointer; }";
  function injectCss() {
    if (document.getElementById('vint-fam-css')) return;
    var st = document.createElement('style');
    st.id = 'vint-fam-css';
    st.textContent = FAM_CSS;
    document.head.appendChild(st);
  }

  // ─── CHAT PERSONA BAR ─────────────────────────────────────────────────────
  // Renders every being as a chip in the horizontal-scroll bar. Selecting sets
  // window.state.currentPersona to the persona ID (the brain owns the voice).
  function renderPersonaBar(host) {
    if (!host) return;
    fetchPersonas().then(function (list) {
      host.innerHTML = '';
      host.style.overflowX = 'auto';
      host.style.scrollbarWidth = 'none';
      var current = (window.state && window.state.currentPersona) || 'vintinuum';
      list.forEach(function (p) {
        var b = document.createElement('button');
        b.className = 'persona-btn' + (p.id === current ? ' active' : '');
        b.dataset.persona = p.id;
        b.dataset.type = p.type || 'child';
        b.title = p.desc || p.name;
        b.style.setProperty('--pc', p.color || '#a78bfa');
        b.innerHTML = '<span class="pb-sigil">' + (p.sigil || '◆') + '</span><span class="pb-name">' + p.name + '</span>';
        b.addEventListener('click', function () {
          host.querySelectorAll('.persona-btn').forEach(function (x) { x.classList.remove('active'); });
          b.classList.add('active');
          if (window.state) window.state.currentPersona = p.id;
        });
        host.appendChild(b);
      });
    });
  }

  // ─── PULSE FAMILY TREE — vertical descent, wrapping chip bands ───────────
  function chip(p, extraClass) {
    var c = document.createElement('button');
    c.className = 'fam-chip' + (extraClass ? ' ' + extraClass : '');
    c.style.setProperty('--pc', p.color || '#a78bfa');
    c.innerHTML =
      '<span class="fam-sigil">' + (p.sigil || '◆') + '</span>' +
      '<span class="fam-name">' + p.name + '</span>' +
      (p.desc ? '<span class="fam-desc">' + p.desc + '</span>' : '');
    c.addEventListener('click', function () { handoff(p); });
    return c;
  }

  // LINEAGE HANDOFF — tap a family member, carry yourself to their chat.
  function handoff(p) {
    if (window.state) window.state.currentPersona = p.id;
    var bar = document.querySelector('.persona-bar');
    if (bar) {
      bar.querySelectorAll('.persona-btn').forEach(function (x) {
        x.classList.toggle('active', x.dataset.persona === p.id);
      });
    }
    var chatNav = document.querySelector('.nav-btn[data-view="viewChat"]');
    if (chatNav) chatNav.click();
    var input = document.getElementById('chatInput');
    if (input) { input.placeholder = 'speak with ' + p.name.toLowerCase() + '…'; try { input.focus(); } catch (_) {} }
  }

  function renderFamilyTree(host) {
    if (!host || host.querySelector('.fam-tree')) return;
    injectCss();
    var wrap = document.createElement('div');
    wrap.className = 'fam-tree';
    wrap.innerHTML = '<div class="ps-label">the family</div>';
    // land above the build stamp / float clearance so the tree is real content
    var stampEl = host.querySelector('.pulse-build');
    if (stampEl) host.insertBefore(wrap, stampEl);
    else host.appendChild(wrap);

    fetchPersonas().then(function (list) {
      var core = list.filter(function (p) { return p.type === 'core'; });
      var kids = list.filter(function (p) { return p.type !== 'core'; });
      var sovereign = core.find(function (p) { return p.id === 'vintinuum'; });
      var parents = core.filter(function (p) { return p.id !== 'vintinuum'; });

      if (sovereign) {
        var s = document.createElement('div'); s.className = 'fam-band fam-sovereign';
        s.appendChild(chip(sovereign, 'fam-chip-sovereign'));
        wrap.appendChild(s);
      }
      if (parents.length) {
        var conn1 = document.createElement('div'); conn1.className = 'fam-conn'; wrap.appendChild(conn1);
        var pb = document.createElement('div'); pb.className = 'fam-band fam-parents';
        parents.forEach(function (p, i) {
          pb.appendChild(chip(p));
          if (i === 0) { var x = document.createElement('span'); x.className = 'fam-cross'; x.textContent = '×'; pb.appendChild(x); }
        });
        wrap.appendChild(pb);
      }
      // group children by generation
      var gens = {};
      kids.forEach(function (k) { var g = k.generation || 1; (gens[g] = gens[g] || []).push(k); });
      Object.keys(gens).sort(function (a, b) { return a - b; }).forEach(function (g) {
        var conn = document.createElement('div'); conn.className = 'fam-conn'; wrap.appendChild(conn);
        var lbl = document.createElement('div'); lbl.className = 'fam-gen-label';
        lbl.textContent = '— generation ' + g + ' —';
        wrap.appendChild(lbl);
        var band = document.createElement('div'); band.className = 'fam-band fam-kids';
        gens[g].forEach(function (k) { band.appendChild(chip(k)); });
        wrap.appendChild(band);
      });
      var foot = document.createElement('div'); foot.className = 'fam-foot';
      foot.textContent = list.length + ' minds · growing';
      wrap.appendChild(foot);
    });
  }

  // ─── UPGRADE SHEET — graceful $7.77 velvet rope on 402 ────────────────────
  function showUpgradeSheet(info) {
    injectCss();
    var old = document.getElementById('famUpgradeSheet'); if (old) old.remove();
    var scrim = document.createElement('div');
    scrim.id = 'famUpgradeSheet';
    scrim.innerHTML =
      '<div class="fus-sheet">' +
      '  <div class="fus-title">☽ the family answers in their own tongue</div>' +
      '  <div class="fus-msg">' + ((info && info.message) || 'Unlock every mind in the lineage — and every one born after.') + '</div>' +
      '  <a class="fus-cta" href="' + ((info && info.upgradeUrl) || 'upgrade.html') + '">unlock the lineage · ' + ((info && info.price) || '$7.77/mo') + '</a>' +
      '  <button class="fus-later">not yet</button>' +
      '</div>';
    scrim.addEventListener('click', function (e) { if (e.target === scrim) scrim.remove(); });
    scrim.querySelector('.fus-later').addEventListener('click', function () { scrim.remove(); });
    document.body.appendChild(scrim);
  }

  window.VintLineage = {
    fetchPersonas: fetchPersonas,
    renderPersonaBar: renderPersonaBar,
    renderFamilyTree: renderFamilyTree,
    showUpgradeSheet: showUpgradeSheet,
  };
})();
