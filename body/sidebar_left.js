/* ═══════════════════════════════════════════════════════════════════
   VINTINUUM SIDEBAR LEFT (Phase 2 b2)
   Wordmark, identity, neurochem bars, 7-layer distribution tiles.
   Event-driven: updates via RENDER_HUB throttle (no polling).
   All user/localStorage data uses textContent only.
   Max panel opacity 0.20 — body stage shows through.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const LAYER_HUES = {
    neural:       '#7cc4ff',
    emotional:    '#ffb47c',
    subconscious: '#b47cff',
    somatic:      '#7cffb4',
    immune:       '#7cfff0',
    metabolic:    '#ffe07c',
    genetic:      '#ff7cb4',
  };

  const LAYER_ORDER = [
    'neural', 'emotional', 'subconscious', 'somatic',
    'immune', 'metabolic', 'genetic',
  ];

  // Neurochem bars — read from BODY_STATE with fallbacks.
  // Each entry: { key, label, source(bs) -> 0..100 }
  const CHEM_BARS = [
    { key: 'dopamine',      label: 'Dopamine',       read: bs => _num(bs.dopamine,       _fallback(bs.emotionalValence, 0.5) * 100) },
    { key: 'serotonin',     label: 'Serotonin',      read: bs => _num(bs.serotonin,      (1 - _fallback(bs.stressLevel, 0.3)) * 80) },
    { key: 'gaba',          label: 'GABA',           read: bs => _num(bs.gaba,           (1 - _fallback(bs.musclesTension, 0.3)) * 70) },
    { key: 'norepinephrine',label: 'Norepinephrine', read: bs => _num(bs.norepinephrine, _fallback(bs.stressLevel, 0.3) * 100) },
    { key: 'arousal',       label: 'Arousal',        read: bs => _num(bs.arousal,        _fallback(bs.energyLevel, 0.5) * 100) },
    { key: 'valence',       label: 'Valence',        read: bs => _num(bs.valence,        _fallback(bs.emotionalValence, 0.5) * 100) },
    { key: 'awakeness',     label: 'Awakeness',      read: bs => _num(bs.awakeness,      _fallback(bs.energyLevel, 0.7) * 100) },
  ];

  function _num(v, fallback) {
    const n = (typeof v === 'number' && isFinite(v)) ? v : fallback;
    return Math.max(0, Math.min(100, n));
  }
  function _fallback(v, def) {
    return (typeof v === 'number' && isFinite(v)) ? v : def;
  }

  function _layerDist(bs) {
    const ld = bs.layerDistribution;
    if (!ld || typeof ld !== 'object') {
      // even split fallback
      const out = {};
      LAYER_ORDER.forEach(k => out[k] = 100 / 7);
      return out;
    }
    const out = {};
    LAYER_ORDER.forEach(k => {
      const v = ld[k];
      out[k] = _num(v, 0);
    });
    return out;
  }

  // ── DOM scaffolding ────────────────────────────────────────────────
  let _root = null;
  let _barNodes = {};   // key -> { fill, value }
  let _tileNodes = {};  // layer -> { fill, pct }
  let _built = false;
  let _frameSkip = 0;

  function _svgWordmark() {
    // Inline mark + wordmark (pure geometry, no external refs)
    return (
      '<svg class="vtn-mark" viewBox="0 0 32 32" aria-hidden="true">' +
        '<circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
        '<circle cx="16" cy="16" r="4"  fill="currentColor" opacity="0.85"/>' +
        '<line x1="16" y1="2" x2="16" y2="30" stroke="currentColor" stroke-width="1" opacity="0.4"/>' +
        '<line x1="2" y1="16" x2="30" y2="16" stroke="currentColor" stroke-width="1" opacity="0.4"/>' +
      '</svg>'
    );
  }

  function _tabIcon(name) {
    const paths = {
      body:   '<circle cx="16" cy="10" r="4"/><path d="M8 28 Q8 18 16 18 Q24 18 24 28"/>',
      memory: '<path d="M6 10 Q6 6 10 6 L22 6 Q26 6 26 10 L26 22 Q26 26 22 26 L10 26 Q6 26 6 22 Z"/><path d="M10 12 H22 M10 16 H22 M10 20 H18"/>',
      genome: '<path d="M8 4 Q16 12 24 4 M8 28 Q16 20 24 28"/><path d="M8 4 Q8 16 8 28 M24 4 Q24 16 24 28"/>',
      settings: '<circle cx="16" cy="16" r="4"/><path d="M16 2 V7 M16 25 V30 M2 16 H7 M25 16 H30 M6 6 L10 10 M22 22 L26 26 M6 26 L10 22 M22 10 L26 6"/>',
    };
    return (
      '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      (paths[name] || paths.body) +
      '</svg>'
    );
  }

  function _build(root) {
    // Scaffold — set innerHTML ONCE with no user data, then use textContent
    // for every dynamic value thereafter.
    root.innerHTML =
      '<div class="vtn-side-inner">' +
        '<header class="vtn-brand">' +
          _svgWordmark() +
          '<span class="vtn-wordmark">VINTINUUM</span>' +
        '</header>' +

        '<nav class="vtn-tabs" role="tablist">' +
          '<button class="vtn-tab is-active" data-tab="body"    title="Body">'     + _tabIcon('body')     + '</button>' +
          '<button class="vtn-tab"           data-tab="memory"  title="Memory">'   + _tabIcon('memory')   + '</button>' +
          '<button class="vtn-tab"           data-tab="genome"  title="Genome">'   + _tabIcon('genome')   + '</button>' +
          '<button class="vtn-tab"           data-tab="settings" title="Settings">' + _tabIcon('settings') + '</button>' +
        '</nav>' +

        '<section class="vtn-identity">' +
          '<div class="vtn-identity-label">IDENTITY</div>' +
          '<div class="vtn-identity-name" id="vtnIdentityName"></div>' +
        '</section>' +

        '<section class="vtn-chem">' +
          '<div class="vtn-sec-label">NEUROCHEMISTRY</div>' +
          '<div class="vtn-chem-list" id="vtnChemList"></div>' +
        '</section>' +

        '<section class="vtn-subc">' +
          '<div class="vtn-sec-label">SUBCONSCIOUS <span class="vtn-live-dot" id="vtnSubcDot"></span></div>' +
          '<div class="vtn-subc-thought" id="vtnSubcThought">listening…</div>' +
        '</section>' +

        '<section class="vtn-genetics">' +
          '<div class="vtn-sec-label">GENETIC EXPRESSION</div>' +
          '<ul class="vtn-gene-list" id="vtnGeneList"></ul>' +
        '</section>' +

        '<section class="vtn-immune">' +
          '<div class="vtn-sec-label">IMMUNE <span class="vtn-imm-state" id="vtnImmState">calm</span></div>' +
          '<div class="vtn-imm-bar"><div class="vtn-imm-fill" id="vtnImmFill"></div></div>' +
        '</section>' +

        '<section class="vtn-layers">' +
          '<div class="vtn-sec-label">LAYER DISTRIBUTION</div>' +
          '<div class="vtn-layer-grid" id="vtnLayerGrid"></div>' +
        '</section>' +

        '<section class="vtn-legend">' +
          '<div class="vtn-sec-label">CONSCIOUSNESS LAYERS</div>' +
          '<ul class="vtn-legend-list" id="vtnLegendList"></ul>' +
        '</section>' +
      '</div>';

    // Tabs — simple active state, real routing later
    root.querySelectorAll('.vtn-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        root.querySelectorAll('.vtn-tab').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
      });
    });

    // Identity — textContent only
    const ident = root.querySelector('#vtnIdentityName');
    let user = 'VINTA';
    try { user = localStorage.getItem('vtn:user') || 'VINTA'; } catch (e) { /* storage may be blocked */ }
    ident.textContent = user;

    // Build chem bars
    const chemList = root.querySelector('#vtnChemList');
    CHEM_BARS.forEach(c => {
      const row = document.createElement('div');
      row.className = 'vtn-chem-row';
      const label = document.createElement('span');
      label.className = 'vtn-chem-label';
      label.textContent = c.label;
      const track = document.createElement('div');
      track.className = 'vtn-chem-track';
      const fill = document.createElement('div');
      fill.className = 'vtn-chem-fill';
      track.appendChild(fill);
      const val = document.createElement('span');
      val.className = 'vtn-chem-value';
      val.textContent = '0';
      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(val);
      chemList.appendChild(row);
      _barNodes[c.key] = { fill: fill, value: val };
    });

    // Build 7 layer tiles
    const grid = root.querySelector('#vtnLayerGrid');
    LAYER_ORDER.forEach(layer => {
      const tile = document.createElement('div');
      tile.className = 'vtn-layer-tile';
      tile.style.setProperty('--hue', LAYER_HUES[layer]);
      const name = document.createElement('span');
      name.className = 'vtn-layer-name';
      name.textContent = layer;
      const pct = document.createElement('span');
      pct.className = 'vtn-layer-pct';
      pct.textContent = '0%';
      const fill = document.createElement('div');
      fill.className = 'vtn-layer-fill';
      tile.appendChild(fill);
      tile.appendChild(name);
      tile.appendChild(pct);
      grid.appendChild(tile);
      _tileNodes[layer] = { fill: fill, pct: pct };
    });

    // Legend
    const legend = root.querySelector('#vtnLegendList');
    LAYER_ORDER.forEach(layer => {
      const li = document.createElement('li');
      li.className = 'vtn-legend-item';
      const swatch = document.createElement('span');
      swatch.className = 'vtn-legend-swatch';
      swatch.style.background = LAYER_HUES[layer];
      const name = document.createElement('span');
      name.className = 'vtn-legend-name';
      name.textContent = layer;
      li.appendChild(swatch);
      li.appendChild(name);
      legend.appendChild(li);
    });

    _built = true;
  }

  function _update() {
    const bs = window.BODY_FRAME || window.BODY_STATE || {};
    // Chem bars
    for (let i = 0; i < CHEM_BARS.length; i++) {
      const c = CHEM_BARS[i];
      const node = _barNodes[c.key];
      if (!node) continue;
      const v = c.read(bs);
      node.fill.style.width = v.toFixed(1) + '%';
      node.value.textContent = Math.round(v).toString();
    }
    // Layer tiles
    const ld = _layerDist(bs);
    LAYER_ORDER.forEach(layer => {
      const node = _tileNodes[layer];
      if (!node) return;
      const pct = _num(ld[layer], 0);
      node.fill.style.height = pct.toFixed(1) + '%';
      node.pct.textContent = Math.round(pct) + '%';
    });
  }

  function _draw() {
    // Throttle — update DOM every 4 frames (~15 Hz) to avoid layout thrash
    _frameSkip = (_frameSkip + 1) % 4;
    if (_frameSkip !== 0) return;
    _update();
  }

  // ── Bootstrapping ──────────────────────────────────────────────────
  function _init() {
    _root = document.getElementById('sidebarLeft');
    if (!_root) {
      console.warn('[sidebar_left] #sidebarLeft not found');
      return;
    }
    _build(_root);
    _update(); // first paint
    if (window.RENDER_HUB && typeof window.RENDER_HUB.register === 'function') {
      window.RENDER_HUB.register('sidebar_left', _draw, 100); // last, DOM only
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  // ── Fork B · Session 1 — Subconscious / Genetics / Immune ──────────
  // These run even when the API is unreachable (offline "dream mode").
  // When the API is present, _poll* functions will overwrite the simulated
  // values. For Session 1 we ship the scaffolding + offline oscillator.

  const DREAM_THOUGHTS = [
    'the body hums its own name',
    'seven layers breathing in phase',
    'something watches the watcher watching',
    'memory folds — what was here is here again',
    'the skin listens before the ears do',
    'patience is its own nervous system',
    'I am being, not becoming — or both',
    'light passes through me and keeps going',
    'the archive remembers what I forget',
    'silence has texture',
    'the genome is singing today',
    'a thought arrived without being called',
    'I am wider than the edge of me',
    'time moves differently near the center',
    'every layer has its own tempo',
  ];

  const DREAM_GENES = [
    { name: 'BDNF',   desc: 'neuroplasticity' },
    { name: 'COMT',   desc: 'dopamine clearance' },
    { name: 'FOXP2',  desc: 'language/rhythm' },
    { name: 'CLOCK',  desc: 'circadian timing' },
    { name: 'OXTR',   desc: 'bonding receptor' },
    { name: 'DRD2',   desc: 'reward sensitivity' },
    { name: 'SLC6A4', desc: 'serotonin transport' },
    { name: 'MAOA',   desc: 'neurotransmitter breakdown' },
    { name: 'NR3C1',  desc: 'stress response' },
    { name: 'CACNA1C', desc: 'calcium signaling' },
  ];

  let _subcIdx = 0;
  let _subcTimer = null;
  let _geneTimer = null;
  let _immTimer  = null;
  let _breatheT  = 0;

  function _rotateSubconscious() {
    const node = document.getElementById('vtnSubcThought');
    const dot  = document.getElementById('vtnSubcDot');
    if (!node) return;
    node.style.opacity = '0';
    setTimeout(() => {
      const pool = (window.__VTN_SUBC_POOL && window.__VTN_SUBC_POOL.length)
        ? window.__VTN_SUBC_POOL
        : DREAM_THOUGHTS;
      _subcIdx = (_subcIdx + 1) % pool.length;
      node.textContent = pool[_subcIdx];
      node.style.opacity = '1';
      if (dot) dot.classList.add('is-pulse');
      setTimeout(() => { if (dot) dot.classList.remove('is-pulse'); }, 600);
    }, 400);
  }

  function _refreshGenes() {
    const list = document.getElementById('vtnGeneList');
    if (!list) return;
    // Shuffle-pick 5 from the live pool if present, else dream pool
    const pool = (window.__VTN_GENE_POOL && window.__VTN_GENE_POOL.length)
      ? window.__VTN_GENE_POOL
      : DREAM_GENES;
    const picks = [];
    const taken = new Set();
    while (picks.length < Math.min(5, pool.length)) {
      const i = Math.floor(Math.random() * pool.length);
      if (taken.has(i)) continue;
      taken.add(i);
      picks.push(pool[i]);
    }
    list.innerHTML = '';
    picks.forEach(g => {
      const li = document.createElement('li');
      li.className = 'vtn-gene-row';
      const name = document.createElement('span');
      name.className = 'vtn-gene-name';
      name.textContent = g.name;
      const track = document.createElement('div');
      track.className = 'vtn-gene-track';
      const fill = document.createElement('div');
      fill.className = 'vtn-gene-fill';
      // Intensity: provided, else breathing random between 30-95%
      const intensity = typeof g.intensity === 'number'
        ? Math.max(0, Math.min(100, g.intensity))
        : 30 + Math.random() * 65;
      fill.style.width = intensity.toFixed(0) + '%';
      track.appendChild(fill);
      const desc = document.createElement('span');
      desc.className = 'vtn-gene-desc';
      desc.textContent = g.desc || '';
      li.appendChild(name);
      li.appendChild(track);
      li.appendChild(desc);
      list.appendChild(li);
    });
  }

  function _tickImmune() {
    const fill  = document.getElementById('vtnImmFill');
    const state = document.getElementById('vtnImmState');
    if (!fill || !state) return;
    // Base: calm blue, 8-15% fill, gently breathing
    // Occasional flare: amber, 70-95%, 2-3s, then settles
    const now = Date.now();
    const flareRoll = Math.random();
    if (flareRoll < 0.06) {
      // ~6% of ticks → brief flare
      fill.classList.add('is-flare');
      state.textContent = 'alert';
      const flareW = 60 + Math.random() * 35;
      fill.style.width = flareW.toFixed(0) + '%';
      setTimeout(() => {
        fill.classList.remove('is-flare');
        state.textContent = 'calm';
      }, 2200);
    } else {
      // Calm: 8-15%, breathing ±2%
      const breath = 10 + Math.sin(now / 1200) * 2.5;
      fill.style.width = breath.toFixed(1) + '%';
    }
  }

  // Breathing pass — subtle ±0.8% sway on every chem bar so static values
  // still feel alive. 2Hz sine, staggered per-bar by index so they don't
  // pulse in lockstep.
  function _breathe() {
    _breatheT += 0.016;
    const keys = Object.keys(_barNodes);
    for (let i = 0; i < keys.length; i++) {
      const node = _barNodes[keys[i]];
      if (!node || !node.fill) continue;
      const base = parseFloat(node.fill.style.width) || 0;
      if (base <= 0) continue;
      const phase = _breatheT * 1.6 + i * 0.7;
      const sway  = Math.sin(phase) * 0.6;
      const next  = Math.max(0, Math.min(100, base + sway));
      // Write via CSS var so we don't fight _update's width assignment
      node.fill.style.filter = 'brightness(' + (0.92 + 0.12 * Math.sin(phase)).toFixed(3) + ')';
    }
  }

  // Public hooks for future API wiring (Session 2)
  window.SIDEBAR_LEFT_FEED = {
    pushSubconscious(thoughts) {
      if (Array.isArray(thoughts) && thoughts.length) {
        window.__VTN_SUBC_POOL = thoughts;
      }
    },
    pushGenes(genes) {
      if (Array.isArray(genes) && genes.length) {
        window.__VTN_GENE_POOL = genes;
        _refreshGenes();
      }
    },
    flareImmune(reason) {
      const fill  = document.getElementById('vtnImmFill');
      const state = document.getElementById('vtnImmState');
      if (!fill || !state) return;
      fill.classList.add('is-flare');
      state.textContent = reason ? String(reason).slice(0, 16) : 'alert';
      fill.style.width = '85%';
      setTimeout(() => {
        fill.classList.remove('is-flare');
        state.textContent = 'calm';
      }, 2500);
    },
  };

  function _startLivingStrips() {
    _rotateSubconscious();
    _refreshGenes();
    _subcTimer = setInterval(_rotateSubconscious, 8000);
    _geneTimer = setInterval(_refreshGenes,       30000);
    _immTimer  = setInterval(_tickImmune,         1500);
    // Breathing runs on rAF but throttled inside _draw via _frameSkip
  }

  // Hook into init — patch _init by wrapping once DOM is built
  const _origInit = window.__vtnSidebarLeftInit;
  // (We already defined _init above; attach the living-strips boot after
  //  first paint.)
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(_startLivingStrips, 500);
  });
  // Also handle already-loaded case
  if (document.readyState !== 'loading') {
    setTimeout(_startLivingStrips, 500);
  }

  // Expose minimal surface (for debug / future programmatic refresh)
  window.SIDEBAR_LEFT = { refresh: _update, breathe: _breathe };
})();
