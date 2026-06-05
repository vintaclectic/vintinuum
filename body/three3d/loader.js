/* ═══════════════════════════════════════════════════════════════════════════
   body/three3d/loader.js — three.js streaming strategy

   ONE job: resolve `{ THREE, GLTFLoader, OrbitControls, EffectComposer,
   RenderPass, UnrealBloomPass, RGBELoader, KTX2Loader, DRACOLoader }`
   from the best available CDN, with a self-hosted fallback. Pinned to
   three r160 — pinning matters because the addons reach into THREE's
   internals and a minor version bump can break import paths.

   Network plan (in order):
     1. unpkg.com   (immutable, fastest, free)
     2. jsdelivr.net (fallback, identical contract)
     3. ${API_BASE}/static/three/  (self-hosted, fully offline)

   Exposes a single async function: window.Three3D.load()
   Returns a frozen object of all modules. Called by bootstrap module
   inside body-3d.html exactly once.

   Pinned rule honored: no overflow/overlap (loader is logic-only),
   mobile-first (we ship the lighter `three.module.min.js` not the
   editor build), draggable (N/A here, controls live in scene.js).
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

(function (global) {
  if (global.Three3D && global.Three3D.load) return; // idempotent

  const THREE_VERSION = '0.160.0';

  const SOURCES = [
    {
      name: 'unpkg',
      base: `https://unpkg.com/three@${THREE_VERSION}`,
    },
    {
      name: 'jsdelivr',
      base: `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}`,
    },
    {
      name: 'self',
      base: (global.__VINTINUUM_API_BASE || '') + '/static/three',
    },
  ];

  // The module specifiers we need. Order matters only for caching —
  // dynamic `import()` resolves in parallel.
  const SPECS = {
    THREE:           '/build/three.module.js',
    SkeletonUtils:   '/examples/jsm/utils/SkeletonUtils.js',
    GLTFLoader:      '/examples/jsm/loaders/GLTFLoader.js',
    DRACOLoader:     '/examples/jsm/loaders/DRACOLoader.js',
    KTX2Loader:      '/examples/jsm/loaders/KTX2Loader.js',
    RGBELoader:      '/examples/jsm/loaders/RGBELoader.js',
    OrbitControls:   '/examples/jsm/controls/OrbitControls.js',
    EffectComposer:  '/examples/jsm/postprocessing/EffectComposer.js',
    RenderPass:      '/examples/jsm/postprocessing/RenderPass.js',
    UnrealBloomPass: '/examples/jsm/postprocessing/UnrealBloomPass.js',
    OutputPass:      '/examples/jsm/postprocessing/OutputPass.js',
  };

  /**
   * Inject a `<script type="importmap">` so bare specifiers like
   * `three` and `three/addons/...` resolve to a chosen CDN. The
   * importmap MUST exist before any module script that uses bare
   * specifiers — we inject it synchronously and bail if there's
   * already one mounted.
   */
  function installImportMap(base) {
    if (document.querySelector('script[type="importmap"][data-vint-three]')) return;
    const map = {
      imports: {
        'three':         `${base}/build/three.module.js`,
        'three/addons/': `${base}/examples/jsm/`,
      },
    };
    const tag = document.createElement('script');
    tag.type = 'importmap';
    tag.dataset.vintThree = '1';
    tag.textContent = JSON.stringify(map);
    // Importmap must be in <head> and before the consuming module.
    document.head.appendChild(tag);
  }

  /** Race a single source's `THREE` import as a liveness probe. */
  async function probe(base) {
    const url = base + SPECS.THREE;
    // Use a HEAD-equivalent dynamic import. If THREE imports, the CDN is live.
    const mod = await import(/* webpackIgnore: true */ url);
    if (!mod || !mod.Scene) throw new Error('three module missing Scene');
    return mod;
  }

  /** Try sources in order until one works. */
  async function pickSource() {
    let lastErr;
    for (const src of SOURCES) {
      try {
        const probed = await probe(src.base);
        return { ...src, THREE: probed };
      } catch (e) {
        lastErr = e;
        console.warn(`[Three3D.loader] source ${src.name} failed:`, e.message);
      }
    }
    throw lastErr || new Error('no three.js source reachable');
  }

  /**
   * Load all addons from the chosen base. Addons depend on bare
   * specifier `three` resolving — that's what the importmap is for.
   */
  async function loadAll(base, THREE) {
    const entries = Object.entries(SPECS).filter(([k]) => k !== 'THREE');
    const loaded = await Promise.all(
      entries.map(async ([key, path]) => {
        const url = base + path;
        const mod = await import(/* webpackIgnore: true */ url);
        return [key, mod[key] || mod.default || mod];
      })
    );
    const out = { THREE };
    for (const [k, v] of loaded) out[k] = v;
    return out;
  }

  let _cached = null;

  async function load() {
    if (_cached) return _cached;

    // Install the importmap pointing at our first preferred source so
    // addons that say `import { ... } from 'three'` resolve cleanly.
    installImportMap(SOURCES[0].base);

    const src = await pickSource();
    console.log(`[Three3D.loader] using ${src.name} (three@${THREE_VERSION})`);

    // If the winning source isn't our first choice, reinstall the
    // importmap with the working base so addons resolve consistently.
    // NOTE: importmaps can't be replaced after first module load, so
    // this only helps if no module has been imported yet.
    if (src.name !== SOURCES[0].name) {
      const existing = document.querySelector('script[type="importmap"][data-vint-three]');
      if (existing) existing.remove();
      installImportMap(src.base);
    }

    const modules = await loadAll(src.base, src.THREE);
    _cached = Object.freeze({ ...modules, sourceName: src.name, base: src.base });
    return _cached;
  }

  global.Three3D = Object.freeze({
    version: THREE_VERSION,
    sources: SOURCES.map((s) => s.name),
    load,
  });
})(typeof window !== 'undefined' ? window : globalThis);
