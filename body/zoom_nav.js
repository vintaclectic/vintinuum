// ═══════════════════════════════════════════════════════════════════════════════
// ZOOM_NAV — organic body exploration via smooth animated zoom
// Integrates with existing brain.js zoom system (CSS transform on #brainWrapper)
// Uses BODY_GEOMETRY.ZOOM_REGIONS for target zones
//
// Features:
//   - Click body region → smooth zoom animation
//   - Breadcrumb navigation (BODY > CHEST > HEART)
//   - Keyboard shortcuts (1-8, Escape to go back)
//   - Depth-ring visual cue (screen edge glow changes with zoom depth)
//   - Organ labels that appear at appropriate zoom depths
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';

const ZOOM_NAV = (() => {
  let _initialized = false;

  // ── ZOOM REGIONS (with depth and label metadata) ────────────────────────────
  const REGIONS = {
    FULL_BODY:  { x: 0, y: 0, w: 700, h: 1400, label: 'Body', depth: 0 },
    HEAD:       { x: 200, y: 30, w: 300, h: 300, label: 'Head', depth: 1 },
    BRAIN:      { x: 230, y: 50, w: 240, h: 230, label: 'Brain', depth: 2 },
    CHEST:      { x: 130, y: 300, w: 440, h: 250, label: 'Chest', depth: 1 },
    HEART:      { x: 280, y: 350, w: 160, h: 140, label: 'Heart', depth: 2 },
    LUNGS:      { x: 170, y: 330, w: 360, h: 200, label: 'Lungs', depth: 2 },
    ABDOMEN:    { x: 160, y: 480, w: 380, h: 200, label: 'Abdomen', depth: 1 },
    PELVIS:     { x: 160, y: 620, w: 380, h: 150, label: 'Pelvis', depth: 1 },
    LEFT_ARM:   { x: 70, y: 290, w: 200, h: 430, label: 'L. Arm', depth: 1 },
    RIGHT_ARM:  { x: 430, y: 290, w: 200, h: 430, label: 'R. Arm', depth: 1 },
    LEFT_LEG:   { x: 180, y: 700, w: 200, h: 540, label: 'L. Leg', depth: 1 },
    RIGHT_LEG:  { x: 320, y: 700, w: 200, h: 540, label: 'R. Leg', depth: 1 },
  };

  // Animation state
  let _animating = false;
  let _animStart = null;
  let _animFrom = { x: 0, y: 0, w: 700, h: 1400 };
  let _animTo = { x: 0, y: 0, w: 700, h: 1400 };
  const ANIM_DURATION = 500;

  // Navigation stack
  let _stack = ['FULL_BODY'];

  // DOM references (set on init)
  let _breadcrumb = null;
  let _depthRing = null;

  // ── EASING ──────────────────────────────────────────────────────────────────
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  // ── ANIMATION TICK ──────────────────────────────────────────────────────────
  function _animTick(now) {
    if (!_animStart) _animStart = now;
    const elapsed = now - _animStart;
    const t = Math.min(elapsed / ANIM_DURATION, 1);
    const e = easeInOutCubic(t);

    // Interpolate viewBox
    const curX = lerp(_animFrom.x, _animTo.x, e);
    const curY = lerp(_animFrom.y, _animTo.y, e);
    const curW = lerp(_animFrom.w, _animTo.w, e);
    const curH = lerp(_animFrom.h, _animTo.h, e);

    // Write to brain.js zoom state (these are global vars in brain.js)
    if (typeof vbX !== 'undefined') {
      vbX = curX; vbY = curY; vbW = curW; vbH = curH;
      if (typeof applyVB === 'function') applyVB();
    }

    if (t < 1) {
      requestAnimationFrame(_animTick);
    } else {
      _animating = false;
      _animStart = null;
      _updateUI();
    }
  }

  // ── ZOOM TO REGION ──────────────────────────────────────────────────────────
  function zoomTo(regionKey, pushStack) {
    const region = REGIONS[regionKey];
    if (!region) return;

    // Capture current viewBox as animation start
    if (typeof vbX !== 'undefined') {
      _animFrom = { x: vbX, y: vbY, w: vbW, h: vbH };
    }

    // Target with padding
    const pad = region.w * 0.1;
    _animTo = {
      x: region.x - pad,
      y: region.y - pad,
      w: region.w + pad * 2,
      h: region.h + pad * 2,
    };

    // Update stack
    if (pushStack !== false) {
      if (_stack[_stack.length - 1] !== regionKey) {
        _stack.push(regionKey);
      }
    }

    _animating = true;
    _animStart = null;
    requestAnimationFrame(_animTick);
    _updateUI();
  }

  function zoomBack() {
    if (_stack.length <= 1) return;
    _stack.pop();
    zoomTo(_stack[_stack.length - 1], false);
  }

  function reset() {
    _stack = ['FULL_BODY'];
    zoomTo('FULL_BODY', false);
  }

  function currentDepth() {
    const top = _stack[_stack.length - 1];
    return REGIONS[top]?.depth ?? 0;
  }

  // ── HIT DETECTION ───────────────────────────────────────────────────────────
  function regionAtPoint(svgX, svgY) {
    // Search deepest first (most specific)
    const entries = Object.entries(REGIONS)
      .filter(([k]) => k !== 'FULL_BODY')
      .sort((a, b) => b[1].depth - a[1].depth);

    for (const [key, r] of entries) {
      if (svgX >= r.x && svgX <= r.x + r.w &&
          svgY >= r.y && svgY <= r.y + r.h) {
        return key;
      }
    }
    return null;
  }

  // ── UI ELEMENTS ─────────────────────────────────────────────────────────────
  function _createUI() {
    // Breadcrumb
    _breadcrumb = document.createElement('nav');
    _breadcrumb.id = 'zoom-breadcrumb';
    _breadcrumb.setAttribute('aria-label', 'zoom location');
    _breadcrumb.style.cssText = 'position:fixed;top:48px;left:12px;display:flex;align-items:center;gap:4px;' +
      'font-family:inherit;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;' +
      'color:rgba(255,255,255,0.5);pointer-events:none;z-index:100;opacity:0;transition:opacity 0.3s;';
    document.body.appendChild(_breadcrumb);

    // Depth ring (screen edge glow)
    _depthRing = document.createElement('div');
    _depthRing.id = 'zoom-depth-ring';
    _depthRing.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:50;' +
      'transition:box-shadow 600ms ease;';
    document.body.appendChild(_depthRing);
  }

  function _updateUI() {
    if (!_breadcrumb) return;

    const depth = currentDepth();

    // Show breadcrumb only when zoomed in
    _breadcrumb.style.opacity = depth > 0 ? '1' : '0';
    _breadcrumb.style.pointerEvents = depth > 0 ? 'auto' : 'none';

    // Build breadcrumb HTML
    _breadcrumb.innerHTML = _stack.map((key, i) => {
      const label = REGIONS[key]?.label || key;
      const isLast = i === _stack.length - 1;
      const sep = i > 0 ? '<span style="opacity:0.3;font-size:8px;margin:0 2px">›</span>' : '';
      const style = isLast
        ? 'color:rgba(255,255,255,0.9);'
        : 'color:rgba(255,255,255,0.5);cursor:pointer;pointer-events:auto;';
      return sep + '<span data-idx="' + i + '" style="padding:2px 6px;border-radius:10px;' +
        'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);' + style + '">' + label + '</span>';
    }).join('');

    // Breadcrumb click handlers
    _breadcrumb.querySelectorAll('span[data-idx]').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx);
        if (idx < _stack.length - 1) {
          _stack = _stack.slice(0, idx + 1);
          zoomTo(_stack[_stack.length - 1], false);
        }
      });
    });

    // Depth ring glow
    if (_depthRing) {
      if (depth === 0) {
        _depthRing.style.boxShadow = 'inset 0 0 0 0 transparent';
      } else if (depth === 1) {
        _depthRing.style.boxShadow = 'inset 0 0 40px rgba(80, 140, 255, 0.06)';
      } else {
        _depthRing.style.boxShadow = 'inset 0 0 60px rgba(160, 80, 255, 0.10)';
      }
    }
  }

  // ── KEYBOARD SHORTCUTS ──────────────────────────────────────────────────────
  const KEY_MAP = {
    '1': 'FULL_BODY', '2': 'HEAD', '3': 'BRAIN', '4': 'CHEST',
    '5': 'HEART', '6': 'LUNGS', '7': 'ABDOMEN', '8': 'PELVIS',
  };

  function _onKeydown(evt) {
    if (evt.target.tagName === 'INPUT' || evt.target.tagName === 'TEXTAREA') return;
    if (evt.key === 'Escape' || evt.key === '0') {
      zoomBack();
      return;
    }
    const region = KEY_MAP[evt.key];
    if (region) zoomTo(region);
  }

  // ── INIT ────────────────────────────────────────────────────────────────────
  function init() {
    if (_initialized) return;
    _createUI();
    document.addEventListener('keydown', _onKeydown);

    // Hook into SVG click for region zoom
    const svgEl = document.getElementById('brainSvg');
    if (svgEl) {
      // Use a capture listener that checks for double-tap/click patterns
      let lastClickTime = 0;
      svgEl.addEventListener('dblclick', (e) => {
        // Double-click on a body region = zoom to it
        const rect = svgEl.getBoundingClientRect();
        const scaleX = 700 / rect.width;
        const scaleY = 1400 / rect.height;
        // Account for current zoom
        const svgX = (typeof vbX !== 'undefined' ? vbX : 0) + (e.clientX - rect.left) * scaleX * (typeof vbW !== 'undefined' ? vbW / 700 : 1);
        const svgY = (typeof vbY !== 'undefined' ? vbY : 0) + (e.clientY - rect.top) * scaleY * (typeof vbH !== 'undefined' ? vbH / 1400 : 1);

        const region = regionAtPoint(svgX, svgY);
        if (region) {
          e.preventDefault();
          e.stopPropagation();
          zoomTo(region);
        }
      }, true);
    }

    _initialized = true;
    console.log('[ZOOM_NAV] initialized — ' + Object.keys(REGIONS).length + ' navigable regions');
  }

  return {
    init, zoomTo, zoomBack, reset, currentDepth,
    get stack() { return [..._stack]; },
    REGIONS,
  };
})();

// Init after brain.js has set up the SVG
setTimeout(() => ZOOM_NAV.init(), 3000);
