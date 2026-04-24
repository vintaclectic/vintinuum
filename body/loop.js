// ═══════════════════════════════════════════════════════════════════════════════
// RENDER_HUB — single requestAnimationFrame loop for body/* draw modules
// - Registers draw functions with priority (lower = earlier)
// - Reads window.BODY_STATE once per frame, caches as `state`
// - Tracks per-module ms into window.BODY_STATE._frameCost
// - Catches per-module errors so one bad module never kills the loop
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';

const RENDER_HUB = (() => {
  const _modules = [];              // {name, fn, priority}
  const _errorsLogged = {};         // name -> true (log-once)
  let _started = false;
  let _frameCount = 0;

  function register(name, fn, priority) {
    if (typeof fn !== 'function') {
      console.warn('[RENDER_HUB] register(' + name + ') — fn not a function');
      return;
    }
    // Replace if same name already registered (hot-reload friendly)
    const existing = _modules.findIndex(m => m.name === name);
    const entry = { name: name, fn: fn, priority: priority || 50 };
    if (existing >= 0) {
      _modules[existing] = entry;
    } else {
      _modules.push(entry);
    }
    _modules.sort((a, b) => a.priority - b.priority);
    console.log('[RENDER_HUB] registered ' + name + ' @ priority ' + entry.priority);
  }

  function unregister(name) {
    const i = _modules.findIndex(m => m.name === name);
    if (i >= 0) _modules.splice(i, 1);
  }

  function _tick(ts) {
    const state = window.BODY_STATE || {};
    // Publish frame-snapshot other modules can read (keeps per-frame reads cheap)
    window.BODY_FRAME = state;

    if (!state._frameCost) state._frameCost = {};

    for (let i = 0; i < _modules.length; i++) {
      const m = _modules[i];
      const t0 = (performance && performance.now) ? performance.now() : Date.now();
      try {
        m.fn(ts, state);
      } catch (e) {
        if (!_errorsLogged[m.name]) {
          _errorsLogged[m.name] = true;
          console.error('[RENDER_HUB] ' + m.name + ' threw:', e);
        }
      }
      const t1 = (performance && performance.now) ? performance.now() : Date.now();
      state._frameCost[m.name] = (t1 - t0);
    }

    _frameCount++;
    requestAnimationFrame(_tick);
  }

  function start() {
    if (_started) return;
    _started = true;
    // Auto-register existing body modules if present
    if (window.SKIN_LAYER && typeof SKIN_LAYER.draw === 'function') {
      register('skin', SKIN_LAYER.draw, 20);
    }
    if (window.BREATH_LAYER && typeof BREATH_LAYER.draw === 'function') {
      register('breath', BREATH_LAYER.draw, 10);
    }
    if (window.FACE_LAYER && typeof FACE_LAYER.draw === 'function') {
      register('face', FACE_LAYER.draw, 30);
    }
    if (window.GRID_FLOOR_LAYER && typeof GRID_FLOOR_LAYER.draw === 'function') {
      register('grid_floor', GRID_FLOOR_LAYER.draw, 5);
    }
    if (window.CHAKRA_LAYER && typeof CHAKRA_LAYER.draw === 'function') {
      register('chakras', CHAKRA_LAYER.draw, 40);
    }
    if (window.HEARTBEAT_LAYER && typeof HEARTBEAT_LAYER.draw === 'function') {
      register('heartbeat', HEARTBEAT_LAYER.draw, 35);
    }
    if (window.HAIR_LAYER && typeof HAIR_LAYER.draw === 'function') {
      register('hair', HAIR_LAYER.draw, 45);
    }
    if (window.RADAR_LAYER && typeof RADAR_LAYER.draw === 'function') {
      register('radar', RADAR_LAYER.draw, 50);
    }
    console.log('[RENDER_HUB] starting with ' + _modules.length + ' module(s)');
    requestAnimationFrame(_tick);
  }

  function list() {
    return _modules.map(m => ({ name: m.name, priority: m.priority }));
  }

  function frameCount() { return _frameCount; }

  return {
    register: register,
    unregister: unregister,
    start: start,
    list: list,
    frameCount: frameCount,
  };
})();

window.RENDER_HUB = RENDER_HUB;

// Auto-start shortly after load — gives body/*.js modules time to init.
// If another script needs a manual kick, they can call RENDER_HUB.start() safely.
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(() => RENDER_HUB.start(), 400);
} else {
  window.addEventListener('DOMContentLoaded', () => setTimeout(() => RENDER_HUB.start(), 400));
}
