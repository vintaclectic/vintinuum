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

  // Expose minimal surface (for debug / future programmatic refresh)
  window.SIDEBAR_LEFT = { refresh: _update };
})();
