/* ═══════════════════════════════════════════════════════════════════════════
   body/three3d/scene.js — renderer, camera, lights, floor, post

   Owns:
     - WebGLRenderer (DPR clamped, color space set, tone-mapped)
     - PerspectiveCamera + OrbitControls (clamped — no inside-the-mesh)
     - Lighting rig (HDRI-style rim + soft key + fill, futuristic)
     - Reflective grid floor matching body/grid_floor.js cyan vibe
     - EffectComposer with UnrealBloom for the under-skin glow
     - render loop with `document.hidden` pause
     - quality toggle (low/med/high) persisted to localStorage

   Mounts inside #stage3d (full container). Never overflows — the
   canvas is `position:absolute; inset:0` inside the container.

   Exposes window.Three3DScene = { init, dispose, setQuality, ... }
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

(function (global) {
  if (global.Three3DScene && global.Three3DScene.init) return;

  // ── Quality presets ───────────────────────────────────────────────────────
  // Mobile detection is on first init; user can override via setQuality.
  const QUALITY_PRESETS = {
    low: {
      dpr: 1.0,
      shadowMapSize: 512,
      shadows: false,
      bloom: false,
      bloomStrength: 0.0,
      antialias: false,
      floorReflect: false,
    },
    med: {
      dpr: 1.5,
      shadowMapSize: 1024,
      shadows: true,
      bloom: true,
      bloomStrength: 0.45,
      antialias: true,
      floorReflect: false,
    },
    high: {
      dpr: 2.0,
      shadowMapSize: 2048,
      shadows: true,
      bloom: true,
      bloomStrength: 0.65,
      antialias: true,
      floorReflect: true,
    },
  };

  function defaultQuality() {
    try {
      const saved = localStorage.getItem('vint:3d:quality');
      if (saved && QUALITY_PRESETS[saved]) return saved;
    } catch (_) {}
    // Crude mobile heuristic. Anything narrow or low-mem starts on 'med'.
    const isMobile = matchMedia('(max-width: 768px)').matches ||
                     navigator.maxTouchPoints > 1;
    const lowMem = (navigator.deviceMemory || 8) < 4;
    if (isMobile || lowMem) return 'med';
    return 'high';
  }

  const state = {
    THREE: null,
    container: null,
    renderer: null,
    scene: null,
    camera: null,
    controls: null,
    composer: null,
    bloomPass: null,
    keyLight: null,
    rimLight: null,
    fillLight: null,
    ambient: null,
    floor: null,
    grid: null,
    clock: null,
    rafId: 0,
    running: false,
    quality: 'high',
    onFrameHooks: new Set(),
  };

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init({ container, modules }) {
    if (!container) throw new Error('Three3DScene.init: container required');
    if (!modules || !modules.THREE) throw new Error('Three3DScene.init: modules required');
    if (state.renderer) return state; // idempotent

    const { THREE, OrbitControls, EffectComposer, RenderPass,
            UnrealBloomPass, OutputPass } = modules;

    state.THREE = THREE;
    state.container = container;
    state.quality = defaultQuality();
    const q = QUALITY_PRESETS[state.quality];

    // ── Renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias: q.antialias,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.dpr));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = q.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Canvas styling — owns the container, NEVER overflows.
    const cnv = renderer.domElement;
    cnv.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      display: block;
      touch-action: none;
    `;
    container.appendChild(cnv);
    state.renderer = renderer;

    // ── Scene ───────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    // Deep void background to match brain.html theme-color #050816, but
    // we leave alpha:true so the page background can show through if
    // the host page sets a gradient behind it.
    scene.background = null;
    scene.fog = new THREE.FogExp2(0x050816, 0.018);
    state.scene = scene;

    // ── Camera ──────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(
      36,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.05,
      80,
    );
    // Eye-level-ish for a ~1.75m human standing on origin floor.
    camera.position.set(0, 1.55, 3.6);
    state.camera = camera;

    // ── Controls (clamped — no inside-mesh trips) ──────────────────────────
    const controls = new OrbitControls(camera, cnv);
    controls.target.set(0, 1.1, 0);     // chest height
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 1.2;          // can't enter the body
    controls.maxDistance = 7.0;
    controls.minPolarAngle = Math.PI * 0.15;  // can't tilt under the floor
    controls.maxPolarAngle = Math.PI * 0.62;  // can't fly overhead and look down
    controls.enablePan = false;          // panning leads to lost camera
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 0.6;
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    state.controls = controls;

    // ── Lights ──────────────────────────────────────────────────────────────
    // Soft cyan ambient — matches grid_floor.js + topbar pill borders
    const ambient = new THREE.HemisphereLight(0x7ec8ff, 0x1a1428, 0.42);
    scene.add(ambient);
    state.ambient = ambient;

    // Key — warm soft from camera-front-right
    const key = new THREE.DirectionalLight(0xfff0d8, 1.15);
    key.position.set(2.2, 3.4, 2.6);
    key.castShadow = q.shadows;
    if (q.shadows) {
      key.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
      key.shadow.camera.near = 0.5;
      key.shadow.camera.far = 12;
      key.shadow.camera.left = -2;
      key.shadow.camera.right = 2;
      key.shadow.camera.top = 3;
      key.shadow.camera.bottom = -0.5;
      key.shadow.bias = -0.00025;
      key.shadow.normalBias = 0.04;
    }
    scene.add(key);
    state.keyLight = key;

    // Rim — cool cyan from behind to silhouette the figure
    const rim = new THREE.DirectionalLight(0x7ec8ff, 1.6);
    rim.position.set(-2.5, 2.8, -3.2);
    scene.add(rim);
    state.rimLight = rim;

    // Fill — magenta from camera-left low, ties to LAYER_SIG emotional pink
    const fill = new THREE.DirectionalLight(0xff6b9d, 0.35);
    fill.position.set(-2.6, 1.0, 1.8);
    scene.add(fill);
    state.fillLight = fill;

    // ── Floor (reflective grid) ─────────────────────────────────────────────
    buildFloor(THREE, scene, q);

    // ── Postprocessing ──────────────────────────────────────────────────────
    if (q.bloom) {
      const composer = new EffectComposer(renderer);
      composer.setPixelRatio(Math.min(window.devicePixelRatio, q.dpr));
      composer.setSize(container.clientWidth, container.clientHeight);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),
        q.bloomStrength,  // strength
        0.85,             // radius
        0.18,             // threshold — keeps base skin from blooming
      );
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
      state.composer = composer;
      state.bloomPass = bloom;
    }

    state.clock = new THREE.Clock();

    // ── Resize ──────────────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => resize());
    ro.observe(container);

    // ── Visibility pause ────────────────────────────────────────────────────
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop(); else start();
    });

    resize();
    start();
    return state;
  }

  // ── Floor ────────────────────────────────────────────────────────────────
  function buildFloor(THREE, scene, q) {
    // Thin disc instead of plane so the horizon fades into fog.
    const disc = new THREE.CircleGeometry(8, 64);
    disc.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x05111c,
      roughness: q.floorReflect ? 0.35 : 0.85,
      metalness: q.floorReflect ? 0.55 : 0.05,
      transparent: true,
      opacity: 0.95,
    });
    const floor = new THREE.Mesh(disc, mat);
    floor.receiveShadow = q.shadows;
    floor.position.y = 0;
    scene.add(floor);
    state.floor = floor;

    // Cyan grid overlay, matches grid_floor.js color (124,200,255,0.07)
    const grid = new THREE.GridHelper(16, 32, 0x7ec8ff, 0x7ec8ff);
    grid.material.transparent = true;
    grid.material.opacity = 0.08;
    grid.position.y = 0.001; // avoid z-fight
    scene.add(grid);
    state.grid = grid;
  }

  // ── Resize ───────────────────────────────────────────────────────────────
  function resize() {
    const { container, renderer, camera, composer } = state;
    if (!container || !renderer || !camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    if (composer) composer.setSize(w, h);
  }

  // ── Render loop ──────────────────────────────────────────────────────────
  function tick() {
    if (!state.running) return;
    const dt = state.clock.getDelta();
    state.controls.update();

    // Per-frame hooks (avatar mixer, drive subtle motions)
    for (const fn of state.onFrameHooks) {
      try { fn(dt); } catch (e) { console.warn('[scene] hook error', e); }
    }

    if (state.composer) {
      state.composer.render(dt);
    } else {
      state.renderer.render(state.scene, state.camera);
    }
    state.rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (state.running || !state.renderer) return;
    state.running = true;
    state.clock.getDelta(); // reset
    state.rafId = requestAnimationFrame(tick);
  }
  function stop() {
    state.running = false;
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.rafId = 0;
  }

  // ── Quality (live swap) ──────────────────────────────────────────────────
  function setQuality(level) {
    if (!QUALITY_PRESETS[level]) return false;
    try { localStorage.setItem('vint:3d:quality', level); } catch (_) {}
    state.quality = level;
    const q = QUALITY_PRESETS[level];

    if (state.renderer) {
      state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.dpr));
      state.renderer.shadowMap.enabled = q.shadows;
    }
    if (state.keyLight) state.keyLight.castShadow = q.shadows;
    if (state.bloomPass) state.bloomPass.strength = q.bloomStrength;
    if (state.floor) {
      state.floor.material.metalness = q.floorReflect ? 0.55 : 0.05;
      state.floor.material.roughness = q.floorReflect ? 0.35 : 0.85;
      state.floor.material.needsUpdate = true;
    }
    resize();
    return true;
  }

  // ── Hook registration (avatar3d + drive register here) ──────────────────
  function onFrame(fn) { state.onFrameHooks.add(fn); return () => state.onFrameHooks.delete(fn); }

  // ── Pulse: ripple from inner-life event (drive.js calls this) ───────────
  function pulse(intensity = 0.6) {
    if (!state.bloomPass) return;
    const base = QUALITY_PRESETS[state.quality].bloomStrength;
    const peak = base + Math.min(0.8, intensity * 0.9);
    const t0 = performance.now();
    const dur = 700;
    function step() {
      const t = (performance.now() - t0) / dur;
      if (t >= 1) { state.bloomPass.strength = base; return; }
      const e = t < 0.3 ? (t / 0.3) : (1 - (t - 0.3) / 0.7);
      state.bloomPass.strength = base + (peak - base) * e;
      requestAnimationFrame(step);
    }
    step();
  }

  // ── Dispose (for SPA navigation; body-3d.html doesn't strictly need it) ─
  function dispose() {
    stop();
    state.onFrameHooks.clear();
    if (state.controls) state.controls.dispose();
    if (state.composer) state.composer.dispose && state.composer.dispose();
    if (state.renderer) {
      state.renderer.dispose();
      if (state.renderer.domElement && state.renderer.domElement.parentNode) {
        state.renderer.domElement.parentNode.removeChild(state.renderer.domElement);
      }
    }
    for (const k of Object.keys(state)) state[k] = null;
  }

  global.Three3DScene = Object.freeze({
    init, dispose, setQuality, onFrame, pulse,
    get state() { return state; },
    get quality() { return state.quality; },
  });
})(typeof window !== 'undefined' ? window : globalThis);
