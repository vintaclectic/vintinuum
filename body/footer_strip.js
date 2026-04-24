/* ═══════════════════════════════════════════════════════════════════
   VINTINUUM FOOTER STRIP (Phase 2 b6)
   Icon-only row, 44px tall, tooltips on hover.
   Sections:
     • Peel layer toggles (skin/muscle/skeleton/organs/circulatory/nervous)
       — writes BODY_STATE.peelVisible[layer] = bool for future renderers
     • View presets (Full / Skin Off / Muscle / Skeleton / X-Ray)
     • Zoom in/out/reset (reuses ZOOM_NAV.zoomTo/zoomBack/reset)
     • Pause/resume (RENDER_HUB.setPaused flag)
     • Share/export snapshot (canvas.toBlob + temporary download link)
   Background: rgba(10,14,22,0.25) — max footer opacity.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Each layer maps to the window.* object exposed by its body/*.js module.
  // If the module object is missing at click time, the toggle falls back to
  // the BODY_STATE.peelVisible flag (draw modules also read that) and the
  // button marks itself "Coming in Phase 3" via title.
  const PEEL_LAYERS = [
    { key: 'skin',        label: 'Skin',        global: 'SKIN_LAYER'    },
    { key: 'muscle',      label: 'Muscle',      global: 'MUSCLE_LAYER'  },
    { key: 'skeleton',    label: 'Skeleton',    global: 'BODY_SKELETON' },
    { key: 'organs',      label: 'Organs',      global: 'ORGANS'        },
    { key: 'circulatory', label: 'Circulatory', global: 'CIRCULATORY'   },
    { key: 'nervous',     label: 'Nervous',     global: 'NERVOUS_BODY'  },
  ];

  const VIEW_PRESETS = [
    { key: 'full',     label: 'Full',     layers: { skin: true,  muscle: false, skeleton: false, organs: true,  circulatory: false, nervous: false } },
    { key: 'skinoff',  label: 'Skin Off', layers: { skin: false, muscle: true,  skeleton: true,  organs: true,  circulatory: true,  nervous: true  } },
    { key: 'muscle',   label: 'Muscle',   layers: { skin: false, muscle: true,  skeleton: false, organs: false, circulatory: false, nervous: false } },
    { key: 'skeleton', label: 'Skeleton', layers: { skin: false, muscle: false, skeleton: true,  organs: false, circulatory: false, nervous: false } },
    { key: 'xray',     label: 'X-Ray',    layers: { skin: false, muscle: false, skeleton: true,  organs: true,  circulatory: true,  nervous: true  } },
    { key: 'anatomy',  label: 'Anatomy',  layers: { skin: true,  muscle: true,  skeleton: true,  organs: true,  circulatory: true,  nervous: true  } },
  ];

  function _icon(name) {
    const paths = {
      skin:        '<path d="M8 12 Q16 6 24 12 Q24 22 16 28 Q8 22 8 12 Z"/>',
      muscle:      '<path d="M8 8 Q16 16 8 24 M24 8 Q16 16 24 24"/><circle cx="16" cy="16" r="3"/>',
      skeleton:    '<path d="M12 4 H20 V10 L22 12 V20 L20 22 V28 H12 V22 L10 20 V12 L12 10 Z"/>',
      organs:      '<path d="M16 6 C10 6 6 10 6 14 C6 18 10 22 16 28 C22 22 26 18 26 14 C26 10 22 6 16 6 Z"/>',
      circulatory: '<path d="M16 4 V28 M16 8 Q8 12 16 16 Q24 20 16 24"/>',
      nervous:     '<circle cx="16" cy="10" r="3"/><path d="M16 13 V28 M13 18 L8 22 M19 18 L24 22 M13 24 L10 28 M19 24 L22 28"/>',
      preset:      '<rect x="6" y="6" width="20" height="20" rx="3"/><path d="M10 12 H22 M10 16 H22 M10 20 H18"/>',
      zoomIn:      '<circle cx="14" cy="14" r="7"/><path d="M14 11 V17 M11 14 H17 M20 20 L26 26"/>',
      zoomOut:     '<circle cx="14" cy="14" r="7"/><path d="M11 14 H17 M20 20 L26 26"/>',
      reset:       '<path d="M6 10 Q10 4 16 4 Q24 4 26 12 M26 12 L22 10 M26 12 L28 8"/><path d="M26 22 Q22 28 16 28 Q8 28 6 20 M6 20 L10 22 M6 20 L4 24"/>',
      pause:       '<rect x="10" y="8"  width="4" height="16"/><rect x="18" y="8"  width="4" height="16"/>',
      play:        '<path d="M11 7 L24 16 L11 25 Z"/>',
      share:       '<circle cx="9" cy="16" r="3"/><circle cx="23" cy="8" r="3"/><circle cx="23" cy="24" r="3"/><path d="M12 15 L20 10 M12 17 L20 22"/>',
    };
    return (
      '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      (paths[name] || paths.preset) +
      '</svg>'
    );
  }

  function _ensurePeelVisible() {
    if (!window.BODY_STATE) window.BODY_STATE = {};
    if (!window.BODY_STATE.peelVisible) {
      window.BODY_STATE.peelVisible = {
        skin: true, muscle: false, skeleton: false,
        organs: true, circulatory: false, nervous: false,
      };
    }
    return window.BODY_STATE.peelVisible;
  }

  // Get the body-layer module object from window by global name.
  function _moduleFor(layer) {
    if (!layer || !layer.global) return null;
    return window[layer.global] || null;
  }

  function _applyVisibility(key, visible) {
    // Single source of truth: write BODY_STATE.peelVisible[key] so any
    // downstream draw module that reads it respects the flag, AND call
    // setVisible(...) on the module itself (that's what _visible inside
    // each body/*.js module actually gates draw() on).
    const pv = _ensurePeelVisible();
    pv[key] = !!visible;

    const layer = PEEL_LAYERS.find(l => l.key === key);
    const mod = _moduleFor(layer);
    if (mod && typeof mod.setVisible === 'function') {
      try { mod.setVisible(!!visible); } catch (e) { /* ignore */ }
    }
    // X-Ray preset wants the skeleton faint, not invisible. The preset
    // handler sets _xray on BODY_STATE so skeleton.js can halve alpha.
  }

  function _toggleLayer(key, btn) {
    const pv = _ensurePeelVisible();
    const next = !pv[key];
    _applyVisibility(key, next);
    btn.classList.toggle('is-off', !next);
    btn.setAttribute('aria-pressed', next ? 'true' : 'false');
  }

  function _applyPreset(preset, peelButtons) {
    const pv = _ensurePeelVisible();
    // X-Ray tag so skeleton.js can render at reduced alpha (optional hook).
    pv._xray = preset.key === 'xray';
    Object.keys(preset.layers).forEach(k => {
      _applyVisibility(k, preset.layers[k]);
    });
    PEEL_LAYERS.forEach(l => {
      const btn = peelButtons[l.key];
      if (!btn) return;
      btn.classList.toggle('is-off', !pv[l.key]);
      btn.setAttribute('aria-pressed', pv[l.key] ? 'true' : 'false');
    });
  }

  function _zoomIn() {
    if (!window.ZOOM_NAV) return;
    // If we're at full body, step to HEAD as a sensible default zoom-in.
    // Otherwise the current depth is already chosen by keyboard / click.
    const stack = window.ZOOM_NAV.stack || [];
    if (stack.length <= 1) {
      try { window.ZOOM_NAV.zoomTo('HEAD'); } catch (e) { /* ignore */ }
    }
  }
  function _zoomOut() {
    if (!window.ZOOM_NAV || typeof window.ZOOM_NAV.zoomBack !== 'function') return;
    try { window.ZOOM_NAV.zoomBack(); } catch (e) { /* ignore */ }
  }
  function _zoomReset() {
    if (!window.ZOOM_NAV || typeof window.ZOOM_NAV.reset !== 'function') return;
    try { window.ZOOM_NAV.reset(); } catch (e) { /* ignore */ }
  }

  function _togglePause(btn) {
    const hub = window.RENDER_HUB;
    const current = hub && typeof hub.isPaused === 'function' ? hub.isPaused() : !!window.VTN_PAUSED;
    const paused = !current;

    // Halt RENDER_HUB-managed modules (skin, face, grid_floor, chakras,
    // heartbeat, hair, radar).
    if (hub && typeof hub.setPaused === 'function') {
      hub.setPaused(paused);
    }
    // Global flag for brain.js loop and any other rAF consumer to honor.
    // brain.js can read `window.VTN_PAUSED` at the top of its loop(); any
    // module is free to short-circuit on it too.
    window.VTN_PAUSED = paused;

    btn.innerHTML = paused ? _icon('play') : _icon('pause');
    btn.setAttribute('title', paused ? 'Resume' : 'Pause');
    btn.setAttribute('aria-pressed', paused ? 'true' : 'false');
  }

  function _shareSnapshot() {
    const c = document.getElementById('mainCanvas')
           || document.getElementById('skinCanvas')
           || document.getElementById('starfield');
    if (!c || typeof c.toBlob !== 'function') return;
    c.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vintinuum-' + Date.now() + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }, 'image/png');
  }

  // ── Build ──────────────────────────────────────────────────────────
  function _makeBtn(iconName, title, cls) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vtn-ft-btn' + (cls ? ' ' + cls : '');
    btn.setAttribute('title', title);
    btn.setAttribute('aria-label', title);
    btn.innerHTML = _icon(iconName);
    return btn;
  }

  function _build(root) {
    root.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'vtn-ft-inner';

    // Peel layer toggles
    const peelGroup = document.createElement('div');
    peelGroup.className = 'vtn-ft-group';
    peelGroup.setAttribute('aria-label', 'Layer visibility');
    const peelButtons = {};
    _ensurePeelVisible();
    PEEL_LAYERS.forEach(l => {
      const btn = _makeBtn(l.key, l.label, 'vtn-ft-peel');
      btn.setAttribute('aria-pressed', 'true');
      // At build time the body modules may still be initializing via
      // setTimeout chains (geometry@0ms, skin@300ms, organs@400ms, etc.).
      // Re-check at click time rather than freezing availability now.
      btn.addEventListener('click', () => {
        const mod = _moduleFor(l);
        if (!mod || typeof mod.setVisible !== 'function') {
          // Module not wired — disable the button, but keep it visible.
          btn.classList.add('is-off');
          btn.setAttribute('disabled', 'disabled');
          btn.setAttribute('title', l.label + ' — coming in Phase 3');
          btn.setAttribute('aria-disabled', 'true');
          return;
        }
        _toggleLayer(l.key, btn);
      });
      peelGroup.appendChild(btn);
      peelButtons[l.key] = btn;
    });
    inner.appendChild(peelGroup);
    _peelButtonsRef = peelButtons;

    inner.appendChild(_divider());

    // View presets
    const presetGroup = document.createElement('div');
    presetGroup.className = 'vtn-ft-group';
    presetGroup.setAttribute('aria-label', 'View presets');
    VIEW_PRESETS.forEach(p => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vtn-ft-btn vtn-ft-preset';
      btn.setAttribute('title', p.label);
      btn.setAttribute('aria-label', p.label);
      btn.textContent = p.label;
      btn.addEventListener('click', () => _applyPreset(p, peelButtons));
      presetGroup.appendChild(btn);
    });
    inner.appendChild(presetGroup);

    inner.appendChild(_spacer());

    // Zoom group
    const zoomGroup = document.createElement('div');
    zoomGroup.className = 'vtn-ft-group';
    zoomGroup.setAttribute('aria-label', 'Zoom');
    const zIn = _makeBtn('zoomIn',  'Zoom in');
    const zOut = _makeBtn('zoomOut', 'Zoom out');
    const zRst = _makeBtn('reset',   'Reset view');
    zIn.addEventListener('click', _zoomIn);
    zOut.addEventListener('click', _zoomOut);
    zRst.addEventListener('click', _zoomReset);
    zoomGroup.appendChild(zIn);
    zoomGroup.appendChild(zOut);
    zoomGroup.appendChild(zRst);
    inner.appendChild(zoomGroup);

    inner.appendChild(_divider());

    // Pause + Share
    const actGroup = document.createElement('div');
    actGroup.className = 'vtn-ft-group';
    const pauseBtn = _makeBtn('pause', 'Pause');
    pauseBtn.addEventListener('click', () => _togglePause(pauseBtn));
    const shareBtn = _makeBtn('share', 'Export snapshot');
    shareBtn.addEventListener('click', _shareSnapshot);
    actGroup.appendChild(pauseBtn);
    actGroup.appendChild(shareBtn);
    inner.appendChild(actGroup);

    root.appendChild(inner);
  }

  function _divider() {
    const d = document.createElement('span');
    d.className = 'vtn-ft-div';
    return d;
  }
  function _spacer() {
    const s = document.createElement('span');
    s.className = 'vtn-ft-spacer';
    return s;
  }

  // After all body modules have had a chance to boot (the longest
  // setTimeout in body/*.js is nervous.js @ 600ms), audit which peel
  // buttons have a backing module — grey out the ones that don't.
  function _auditPeelAvailability(peelButtons) {
    PEEL_LAYERS.forEach(l => {
      const btn = peelButtons && peelButtons[l.key];
      if (!btn) return;
      const mod = _moduleFor(l);
      if (!mod || typeof mod.setVisible !== 'function') {
        btn.classList.add('is-off');
        btn.setAttribute('disabled', 'disabled');
        btn.setAttribute('title', l.label + ' — coming in Phase 3');
        btn.setAttribute('aria-disabled', 'true');
      }
    });
  }

  let _peelButtonsRef = null;

  function _init() {
    const root = document.getElementById('footerStrip');
    if (!root) {
      console.warn('[footer_strip] #footerStrip not found');
      return;
    }
    _build(root);
    // Wait past the slowest body module init (nervous @ 600ms), then audit.
    setTimeout(() => _auditPeelAvailability(_peelButtonsRef), 900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }
})();
