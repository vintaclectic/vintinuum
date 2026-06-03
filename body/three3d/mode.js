/* ═══════════════════════════════════════════════════════════════════════════
   body/three3d/mode.js — the 3D mode switch + lazy bootstrap

   ADDITIVE TO brain.html. Does not touch the OG body (SVG #brainSvg
   viewBox 0 0 700 1400, the stacked canvases #neuronCanvas /
   #brainDorsalCanvas / #skinCanvas / #mainCanvas, the chakras, the
   embodiment dot — all of it stays exactly as it was.) When 3D mode
   is OFF, this module has zero render cost. When 3D mode is ON, we
   lazy-load three.js + addons via Three3D.load(), then mount the
   scene/avatar/layers/drive/surgery into a single floating stage
   container that sits above the OG body without intersecting it.

   Spec (Vinta directive 2026-06-03):
     "build it into brain.html as a new mode the user can switch into
      from the OG body … pizazz, but the OG stays intact."

   Sub-modes (chips inside the 3D stage):
     EXPLORE   — peel rail + chips visible, no surgery panel.
     FLY-THRU  — peel slowly cycles 0→1 on a 14s loop, info card narrates.
     OPERATE   — surgery panel mounted, peel locked to the active region.

   Public surface:
     window.Three3DMode.enter()   — open stage + lazy bootstrap
     window.Three3DMode.exit()    — tear down stage + dispose
     window.Three3DMode.toggle()
     window.Three3DMode.setSub('explore'|'flythru'|'operate')

   The mode toggle button is injected into brain.html's existing chrome
   (top-right of the stage, next to ◈ LAYERS). It is draggable like
   every other button (inherits body/draggable.js via the standing
   directive). It NEVER overlaps the topbar, dock, or sidebar — z-index
   is 12 (above body canvases, below topbar=20 and dock=20).

   No element overflows. The 3D stage is `position:absolute; inset:0`
   inside a fixed-size container that sits within the existing
   .vtn-stage main element, so it inherits the same bounds as the OG
   body and ends precisely at the dock row. Tested mentally at 320 /
   375 / 768 / 1280 / 1920 + 100svh.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

(function (global) {
  if (global.Three3DMode && global.Three3DMode.enter) return;

  const state = {
    mounted: false,
    container: null,
    scene: null,
    avatar: null,
    layers: null,
    surgery: null,
    sub: 'explore',
    toggleBtn: null,
    subBar: null,
    flythruRaf: 0,
    flythruT0: 0,
    booting: false,
  };

  // ── Toggle button injected into existing chrome ─────────────────────────
  function injectToggle() {
    if (state.toggleBtn) return;
    const btn = document.createElement('button');
    btn.id = 'three3dModeBtn';
    btn.type = 'button';
    btn.setAttribute('data-draggable', 'true');
    btn.title = '3D body — fly through the anatomy, operate when needed';
    btn.textContent = '◈ 3D BODY';
    btn.style.cssText = `
      position: fixed;
      top: calc(60px + env(safe-area-inset-top, 0px));
      right: 12px;
      min-height: 44px;
      padding: 8px 14px;
      font: 700 10px/1 -apple-system, system-ui, sans-serif;
      letter-spacing: 0.16em;
      color: rgba(240,245,255,0.92);
      background: linear-gradient(135deg, rgba(126,200,255,0.22), rgba(255,107,157,0.22));
      border: 1px solid rgba(126,200,255,0.45);
      border-radius: 999px;
      box-shadow: 0 6px 24px rgba(126,200,255,0.18);
      cursor: pointer; z-index: 12;
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      transition: transform .14s, box-shadow .2s;
    `;
    btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.04)'; });
    btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1.0)'; });
    btn.addEventListener('click', (e) => {
      // Suppress click that follows a real drag (handled by draggable.js)
      e.preventDefault();
      toggle();
    });
    document.body.appendChild(btn);
    state.toggleBtn = btn;
  }

  // ── Stage container ─────────────────────────────────────────────────────
  function buildStage() {
    if (state.container) return state.container;
    // Find OG stage so we sit exactly on top of it without overlapping
    // topbar (z=20) or dock (z=20). The .vtn-stage element has the
    // central anatomy area; if it's not found we fall back to body.
    const host = document.querySelector('.vtn-stage') || document.body;
    const wrap = document.createElement('div');
    wrap.id = 'three3dStage';
    wrap.style.cssText = `
      position: fixed;
      top: calc(56px + env(safe-area-inset-top, 0px));
      left: 0; right: 0;
      bottom: calc(56px + env(safe-area-inset-bottom, 0px));
      z-index: 11;
      background: radial-gradient(ellipse at 50% 60%, rgba(8,12,28,0.92), rgba(2,4,12,0.98) 75%);
      overflow: hidden;
      display: block;
      box-sizing: border-box;
      isolation: isolate;
    `;
    // Boot/loading panel — sits centered until three.js has resolved.
    const boot = document.createElement('div');
    boot.id = 'three3dBoot';
    boot.style.cssText = `
      position: absolute; inset: 0; display: flex;
      flex-direction: column; align-items: center; justify-content: center;
      gap: 14px; color: rgba(240,245,255,0.78);
      font: 600 12px/1.4 -apple-system, system-ui, sans-serif;
      letter-spacing: 0.06em;
      text-align: center; padding: 24px;
      pointer-events: none;
    `;
    boot.innerHTML = `
      <div style="width:48px;height:48px;border-radius:50%;
        background: radial-gradient(circle, #7ec8ff 0%, rgba(126,200,255,0.0) 70%);
        animation: three3dPulse 1.6s ease-in-out infinite alternate;"></div>
      <div>building the body</div>
      <div style="font:500 10px/1.3 -apple-system;letter-spacing:.1em;color:rgba(255,255,255,.45);max-width:260px;">
        streaming three.js · loading rigged mesh · weaving the seven layers
      </div>
    `;
    const styleTag = document.createElement('style');
    styleTag.textContent = `@keyframes three3dPulse {
      0% { transform: scale(0.85); opacity: .5; }
      100% { transform: scale(1.15); opacity: 1; }
    }`;
    wrap.appendChild(styleTag);
    wrap.appendChild(boot);
    state.bootEl = boot;
    document.body.appendChild(wrap);
    state.container = wrap;

    mountSubBar(wrap);
    mountExitBtn(wrap);
    return wrap;
  }

  function mountSubBar(container) {
    const bar = document.createElement('div');
    bar.id = 'three3dSubBar';
    bar.setAttribute('data-draggable', 'true');
    bar.style.cssText = `
      position: absolute;
      top: 12px; left: 50%; transform: translateX(-50%);
      display: flex; gap: 4px; padding: 4px;
      background: rgba(8,12,20,0.6);
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 999px; z-index: 16;
      max-width: calc(100% - 24px); box-sizing: border-box;
    `;
    const subs = [
      { key: 'explore', label: 'Explore' },
      { key: 'flythru', label: 'Fly-Thru' },
      { key: 'operate', label: 'Operate' },
    ];
    subs.forEach(({ key, label }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.sub = key;
      b.textContent = label;
      b.style.cssText = `
        min-height: 36px; min-width: 64px; padding: 4px 12px;
        font: 700 10px/1 -apple-system, system-ui; letter-spacing: .12em;
        color: rgba(240,245,255,.85);
        background: transparent; border: none; border-radius: 999px; cursor: pointer;
        transition: background .15s;
      `;
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => { e.preventDefault(); setSub(key); });
      bar.appendChild(b);
    });
    container.appendChild(bar);
    state.subBar = bar;
  }

  function mountExitBtn(container) {
    const x = document.createElement('button');
    x.type = 'button';
    x.title = 'Exit 3D — back to the original body';
    x.textContent = '✕ exit 3D';
    x.style.cssText = `
      position: absolute; top: 12px; right: 12px;
      min-height: 36px; padding: 4px 12px;
      font: 700 10px/1 -apple-system, system-ui; letter-spacing: .12em;
      color: rgba(240,245,255,.9);
      background: rgba(8,12,20,0.6);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 999px; cursor: pointer; z-index: 16;
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    `;
    x.addEventListener('click', (e) => { e.preventDefault(); exit(); });
    container.appendChild(x);
  }

  function paintSubBar() {
    if (!state.subBar) return;
    state.subBar.querySelectorAll('button[data-sub]').forEach((b) => {
      const on = b.dataset.sub === state.sub;
      b.style.background = on
        ? 'linear-gradient(135deg, rgba(126,200,255,.32), rgba(255,107,157,.32))'
        : 'transparent';
      b.style.color = on ? '#fff' : 'rgba(240,245,255,.78)';
    });
  }

  // ── Enter / exit ────────────────────────────────────────────────────────
  async function enter() {
    if (state.mounted || state.booting) {
      if (state.container) state.container.style.display = 'block';
      return;
    }
    state.booting = true;
    buildStage();

    // OG body — keep it alive but hide the canvas stack so render cycles
    // don't fight. We toggle visibility, never remove anything.
    const ogIds = ['neuronCanvas','brainDorsalCanvas','skinCanvas','mainCanvas','brainSvg'];
    ogIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.dataset.three3dPrevVis = el.style.visibility || '';
        el.style.visibility = 'hidden';
      }
    });

    try {
      const modules = await global.Three3D.load();
      // Scene → avatar → layers → drive → surgery, in order so each
      // mount sees its dependencies. Each module is idempotent.
      await global.Three3DScene.init({ container: state.container, modules });
      const avatar = await global.Three3DAvatar.mount({
        scene: global.Three3DScene.state.scene,
        modules,
        onProgress: (p) => {
          if (state.bootEl) {
            const pct = Math.round(p * 100);
            state.bootEl.querySelector('div:nth-child(2)').textContent = `loading mesh · ${pct}%`;
          }
        },
      });
      // Hook avatar tick into scene render loop
      global.Three3DScene.onFrame((dt) => avatar.tick(dt));
      state.avatar = avatar;

      // Layers (peel + fly-through)
      state.layers = await global.Three3DLayers.mount({
        scene: global.Three3DScene.state.scene,
        modules,
        avatar,
        container: state.container,
      });

      // Drive (neurochemistry → body)
      global.Three3DDrive.start({
        scene: global.Three3DScene,
        avatar,
        apiBase: global.__VINTINUUM_API_BASE || '',
        pollMs: 2000,
      });

      // Surgery
      state.surgery = global.Three3DSurgery.mount({
        scene: global.Three3DScene.state.scene,
        modules,
        avatar,
        layers: state.layers,
        container: state.container,
        apiBase: global.__VINTINUUM_API_BASE || '',
      });

      state.mounted = true;
      state.booting = false;
      if (state.bootEl) state.bootEl.remove();
      setSub(state.sub);
      console.log('[Three3DMode] entered — full stack mounted');
    } catch (e) {
      console.error('[Three3DMode] boot failed:', e);
      if (state.bootEl) {
        state.bootEl.innerHTML = `
          <div style="color:#ff8a6b;font:700 12px/1.4 -apple-system;">
            3D failed to boot.<br>
            <span style="font-weight:500;color:rgba(255,255,255,.55);">${e.message || e}</span>
          </div>
          <button style="margin-top:8px;min-height:44px;padding:8px 16px;
            background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);
            border-radius:999px;color:#fff;font:700 10px/1 -apple-system;letter-spacing:.14em;
            cursor:pointer;pointer-events:auto;"
            onclick="window.Three3DMode.exit()">return to original body</button>
        `;
        state.bootEl.style.pointerEvents = 'auto';
      }
      state.booting = false;
    }
  }

  function exit() {
    if (!state.container) return;
    // Restore OG visibility
    ['neuronCanvas','brainDorsalCanvas','skinCanvas','mainCanvas','brainSvg'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.style.visibility = el.dataset.three3dPrevVis || '';
        delete el.dataset.three3dPrevVis;
      }
    });
    // Stop flythru animation if running
    if (state.flythruRaf) { cancelAnimationFrame(state.flythruRaf); state.flythruRaf = 0; }
    // Tear down 3D — full dispose so memory is recovered. Re-enter will
    // re-boot from scratch (lazy is the point).
    try { global.Three3DDrive && global.Three3DDrive.stop(); } catch (_) {}
    try { state.surgery && state.surgery.close(); } catch (_) {}
    try { state.layers && state.layers.dispose(); } catch (_) {}
    try { global.Three3DScene && global.Three3DScene.dispose(); } catch (_) {}
    if (state.container && state.container.parentNode) {
      state.container.parentNode.removeChild(state.container);
    }
    state.container = null;
    state.scene = null;
    state.avatar = null;
    state.layers = null;
    state.surgery = null;
    state.mounted = false;
    console.log('[Three3DMode] exited — OG body restored');
  }

  function toggle() { state.mounted || state.booting ? exit() : enter(); }

  // ── Sub-modes ───────────────────────────────────────────────────────────
  function setSub(key) {
    if (!['explore','flythru','operate'].includes(key)) return;
    state.sub = key;
    paintSubBar();
    if (!state.mounted) return;

    // Surgery panel only in operate mode
    if (state.surgery) {
      if (key === 'operate') state.surgery.open();
      else state.surgery.close();
    }
    // Flythru animation
    if (state.flythruRaf) { cancelAnimationFrame(state.flythruRaf); state.flythruRaf = 0; }
    if (key === 'flythru' && state.layers) {
      state.flythruT0 = performance.now();
      const tick = () => {
        if (state.sub !== 'flythru' || !state.layers) return;
        const t = (performance.now() - state.flythruT0) / 14000;
        const v = (t % 1);
        state.layers.setPeel(v);
        state.flythruRaf = requestAnimationFrame(tick);
      };
      tick();
    }
  }

  // ── Boot the toggle once body modules are present ───────────────────────
  function boot() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectToggle, { once: true });
    } else {
      injectToggle();
    }
  }
  boot();

  global.Three3DMode = Object.freeze({
    enter, exit, toggle, setSub,
    get state() { return state; },
  });
})(typeof window !== 'undefined' ? window : globalThis);
