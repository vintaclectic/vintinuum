/* ═══════════════════════════════════════════════════════════════════════════
   body/three3d/layers.js — the fly-through anatomy stack

   Vinta directive 2026-06-03:
     "i wanna fly through skin then muscles then bones then organs then
      veins then nervous system then cells … all wired and connected
      perfectly properly, nothing ever seen before in VR."

   This module owns:
     1. A LAYER REGISTRY — ordered, named layers each with an optional
        GLB url and a fallback procedural builder. When the GLB exists
        for a layer, it is loaded and anchored to the avatar's bone
        hierarchy. When it does not, the registered procedural overlay
        renders in its place so the stack is NEVER incomplete.
     2. A PEEL / DEPTH SLIDER UI — vertical rail on the right edge of
        the 3D stage, mobile-first, draggable-compatible (inherits
        body/draggable.js). Drives a 0..1 peel value that translates
        into per-layer opacity using a smooth window: a layer is at
        full opacity inside its peel range, fades cleanly outside it.
     3. CLICK-TO-INSPECT — raycaster pick on layer meshes; reuses OG
        info panels (#nodePanel + #panelTitle) when present so the
        anatomy reads the same vocabulary as the 2D body.
     4. DISSOLVE SHADER — onBeforeCompile hook adding a noise dissolve
        with a glowing edge so layers crossfade like a medical scan
        rather than fade flat.

   Public surface:
     window.Three3DLayers.mount({ scene, modules, avatar, container })
       → { setPeel(v), setVisibility(name, on), focus(name),
           registry, dispose, applyToHud(el) }

   No element ever overflows. The peel rail is clamped to the 3D
   container with 12px safe margins (bottom margin doubles to clear
   the dock at small viewports). Touch targets are 44px square.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

(function (global) {
  if (global.Three3DLayers && global.Three3DLayers.mount) return;

  // ── Layer registry ────────────────────────────────────────────────────────
  // depth: 0 = outermost (skin), 1 = innermost (genome). The peel slider's
  //         value (0..1) advances the cut-plane through these. A layer is
  //         visible when its `depth` is within ±band of the peel value.
  // glbUrl: optional. If absent or 404, `procedural()` fires.
  // procedural: (THREE, avatar, scene) => Object3D | null  — last-resort
  //         visual stand-in so the stack is never empty for a layer.
  // color: rim glow tint for this layer (matches embodiment LAYER_SIG).
  // band:  half-width of the peel window for this layer (0..1).
  const REGISTRY = [
    {
      name: 'skin',           depth: 0.00, band: 0.18, color: 0xd9b8a6,
      label: 'Skin',          glbUrl: null,
      procedural: null, // skin is the avatar itself; nothing extra needed
    },
    {
      name: 'muscle',         depth: 0.18, band: 0.14, color: 0xc94f4f,
      label: 'Muscle',        glbUrl: 'body/three3d/assets/anatomy/muscle.glb',
      procedural: muscleOverlay,
    },
    {
      name: 'skeleton',       depth: 0.34, band: 0.14, color: 0xf3e9d2,
      label: 'Skeleton',      glbUrl: 'body/three3d/assets/anatomy/skeleton.glb',
      procedural: skeletonOverlay,
    },
    {
      name: 'organs',         depth: 0.48, band: 0.13, color: 0xff8a6b,
      label: 'Organs',        glbUrl: 'body/three3d/assets/anatomy/organs.glb',
      procedural: organsOverlay,
    },
    {
      name: 'circulatory',    depth: 0.62, band: 0.12, color: 0xe63946,
      label: 'Circulatory',   glbUrl: 'body/three3d/assets/anatomy/vessels.glb',
      procedural: circulatoryOverlay,
    },
    {
      name: 'nervous',        depth: 0.76, band: 0.12, color: 0x7ec8ff,
      label: 'Nervous',       glbUrl: 'body/three3d/assets/anatomy/nervous.glb',
      procedural: nervousOverlay,
    },
    {
      name: 'cellular',       depth: 0.88, band: 0.10, color: 0xb794f4,
      label: 'Cellular',      glbUrl: null,
      procedural: cellularField,
    },
    {
      name: 'genome',         depth: 1.00, band: 0.10, color: 0xff6b9d,
      label: 'Genome',        glbUrl: null,
      procedural: genomeHelix,
    },
  ];

  // ── State ────────────────────────────────────────────────────────────────
  const state = {
    THREE: null,
    scene: null,
    avatar: null,
    container: null,
    modules: null,
    peel: 0.0,
    layers: {},   // name → { obj3d, material, depth, band, color, label }
    raycaster: null,
    pointer: null,
    rail: null,
    railFill: null,
    railHandle: null,
    chip: null,
    onPick: null, // optional caller-supplied callback({ layer, point, mesh })
  };

  // ── Mount ────────────────────────────────────────────────────────────────
  async function mount({ scene, modules, avatar, container, onPick }) {
    if (!scene || !modules || !modules.THREE || !container) {
      throw new Error('Three3DLayers.mount: scene/modules/container required');
    }
    state.THREE = modules.THREE;
    state.scene = scene;
    state.avatar = avatar;
    state.container = container;
    state.modules = modules;
    state.raycaster = new modules.THREE.Raycaster();
    state.pointer = new modules.THREE.Vector2();
    state.onPick = onPick || null;

    // Load each anatomy layer in parallel; gracefully fall back to
    // the registered procedural builder when a GLB is absent.
    await Promise.all(REGISTRY.map(loadLayer));

    // Mount the right-edge peel rail. Mobile-first 44px touch target.
    mountPeelRail(container);

    // Mount the layer chips strip (above the rail on desktop, bottom
    // sheet on mobile). Tiny, draggable, never overflows.
    mountLayerChips(container);

    // Pointer pick (raycaster)
    container.addEventListener('pointerdown', onPointer, { passive: true });

    // Apply initial peel so the avatar (skin) reads at full opacity.
    setPeel(0.0);

    return publicApi();
  }

  // ── Load a layer ─────────────────────────────────────────────────────────
  async function loadLayer(def) {
    const { THREE, GLTFLoader } = state.modules;
    let obj = null;

    if (def.glbUrl) {
      try {
        const loader = new GLTFLoader();
        const gltf = await new Promise((res, rej) => loader.load(def.glbUrl, res, undefined, rej));
        obj = gltf.scene || gltf.scenes[0];
        obj.name = 'layer:' + def.name;
        anchorToAvatar(obj);
        obj.traverse((m) => {
          if (m.isMesh) {
            m.material = buildDissolveMaterial(THREE, def.color, m.material);
            m.castShadow = false;
            m.receiveShadow = false;
            m.userData.layerName = def.name;
          }
        });
        state.scene.add(obj);
      } catch (e) {
        console.warn('[layers] GLB missing for', def.name, '→ procedural', e && e.message);
        obj = null;
      }
    }

    if (!obj && typeof def.procedural === 'function') {
      try {
        obj = def.procedural(THREE, state.avatar, state.scene);
        if (obj) {
          obj.name = 'layer:' + def.name + ':procedural';
          obj.traverse((m) => {
            if (m.isMesh) m.userData.layerName = def.name;
          });
          state.scene.add(obj);
        }
      } catch (e) {
        console.warn('[layers] procedural failed for', def.name, e);
      }
    }

    state.layers[def.name] = {
      def,
      obj,
      visible: true,
    };
  }

  // Anchor a separately-loaded GLB to the avatar so it stands where
  // the avatar stands and roughly matches its scale. If the avatar
  // hasn't loaded yet, we leave the layer at origin and the user can
  // re-fit later.
  function anchorToAvatar(obj) {
    const { THREE } = state.modules;
    if (!state.avatar || !state.avatar.root) return;
    const bbox = new THREE.Box3().setFromObject(state.avatar.root);
    const ctr = new THREE.Vector3(); bbox.getCenter(ctr);
    const size = new THREE.Vector3(); bbox.getSize(size);
    const lb = new THREE.Box3().setFromObject(obj);
    const lsize = new THREE.Vector3(); lb.getSize(lsize);
    const s = (size.y || 1) / Math.max(0.01, lsize.y || 1);
    obj.scale.setScalar(s);
    obj.position.set(0, -lb.min.y * s, 0);
  }

  // ── Dissolve material (onBeforeCompile) ──────────────────────────────────
  // Wraps an incoming material with a noise dissolve threshold + edge
  // glow. Driven by `uCut` per layer (set from setPeel).
  function buildDissolveMaterial(THREE, glowHex, base) {
    const mat = base && base.isMaterial
      ? base.clone()
      : new THREE.MeshStandardMaterial({ color: glowHex, roughness: 0.6, metalness: 0.05 });
    mat.transparent = true;
    mat.depthWrite = true;
    mat.side = THREE.DoubleSide;
    const uniforms = {
      uCut:      { value: 1.0 },         // 0=invisible, 1=visible
      uEdge:     { value: 0.18 },
      uTime:     { value: 0 },
      uGlowCol:  { value: new THREE.Color(glowHex) },
    };
    mat.userData.uniforms = uniforms;
    mat.userData.layerGlow = glowHex;

    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWorldP;`
      ).replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
         uniform float uCut;
         uniform float uEdge;
         uniform float uTime;
         uniform vec3  uGlowCol;
         varying vec3  vWorldP;
         float h31(vec3 p){ return fract(sin(dot(p, vec3(12.9, 78.2, 37.7)))*43758.5); }
         float vnoise(vec3 p){
           vec3 i = floor(p), f = fract(p);
           f = f*f*(3.0-2.0*f);
           return mix(
             mix(mix(h31(i), h31(i+vec3(1,0,0)), f.x),
                 mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x),
                 mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y),
             f.z);
         }`
      ).replace(
        '#include <output_fragment>',
        `float n = vnoise(vWorldP * 6.5 + uTime * 0.15);
         float diff = n - (1.0 - uCut);
         if (diff < -uEdge) discard;
         float edge = smoothstep(uEdge, 0.0, abs(diff));
         vec3 rgb = outgoingLight + uGlowCol * edge * 1.8;
         float a  = diffuseColor.a * smoothstep(-uEdge, uEdge, diff);
         gl_FragColor = vec4(rgb, a);
         #include <tonemapping_fragment>
         #include <colorspace_fragment>
         #include <fog_fragment>
         #include <premultiplied_alpha_fragment>
         #include <dithering_fragment>`
      );
    };
    return mat;
  }

  // ── Peel rail UI ─────────────────────────────────────────────────────────
  function mountPeelRail(container) {
    const rail = document.createElement('div');
    rail.id = 'three3dPeelRail';
    rail.setAttribute('data-draggable', 'true');
    rail.title = 'Peel through anatomy layers';
    rail.style.cssText = `
      position: absolute;
      right: 12px;
      top: 60px;
      bottom: calc(72px + env(safe-area-inset-bottom, 0px));
      width: 44px;
      max-height: calc(100% - 132px);
      min-height: 220px;
      border-radius: 22px;
      background: linear-gradient(180deg, rgba(8,12,20,0.72), rgba(8,12,20,0.5));
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(126,200,255,0.18);
      box-shadow: 0 8px 28px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.03);
      display: flex; flex-direction: column; align-items: center;
      padding: 12px 0; gap: 8px; z-index: 14; user-select: none; touch-action: none;
      box-sizing: border-box;
    `;

    const label = document.createElement('div');
    label.textContent = 'PEEL';
    label.style.cssText = `
      font: 600 9px/1 -apple-system, system-ui, sans-serif;
      letter-spacing: 0.18em;
      color: rgba(126,200,255,0.7);
      writing-mode: vertical-rl; transform: rotate(180deg);
    `;
    rail.appendChild(label);

    const track = document.createElement('div');
    track.style.cssText = `
      position: relative; flex: 1; width: 6px; border-radius: 3px;
      background: linear-gradient(180deg, rgba(126,200,255,0.18), rgba(255,107,157,0.22));
      overflow: visible; margin: 6px 0;
    `;

    const fill = document.createElement('div');
    fill.style.cssText = `
      position: absolute; left: 0; right: 0; top: 0; height: 0%;
      border-radius: 3px;
      background: linear-gradient(180deg, rgba(126,200,255,0.85), rgba(255,107,157,0.85));
      box-shadow: 0 0 12px rgba(126,200,255,0.45);
    `;
    track.appendChild(fill);

    const handle = document.createElement('div');
    handle.style.cssText = `
      position: absolute; left: 50%; top: 0%;
      width: 28px; height: 28px; transform: translate(-50%, -50%);
      border-radius: 50%; background: radial-gradient(circle at 30% 30%, #fff, #7ec8ff 60%, #1a5b8f 100%);
      box-shadow: 0 0 14px rgba(126,200,255,0.7), 0 2px 6px rgba(0,0,0,0.4);
      cursor: grab; touch-action: none;
    `;
    track.appendChild(handle);
    rail.appendChild(track);

    const valEl = document.createElement('div');
    valEl.textContent = '0%';
    valEl.style.cssText = `
      font: 700 11px/1 -apple-system, system-ui, sans-serif;
      color: rgba(255,255,255,0.85); padding-top: 4px;
    `;
    rail.appendChild(valEl);

    container.appendChild(rail);
    state.rail = rail;
    state.railFill = fill;
    state.railHandle = handle;
    state.railVal = valEl;
    state.railTrack = track;

    // Drag interaction (pointer events: mouse + touch + pen unified)
    let dragging = false;
    function pickFromEvent(ev) {
      const rect = track.getBoundingClientRect();
      const y = (ev.clientY != null ? ev.clientY : (ev.touches && ev.touches[0].clientY)) || 0;
      const t = (y - rect.top) / Math.max(1, rect.height);
      return Math.max(0, Math.min(1, t));
    }
    const start = (ev) => {
      // The rail itself is draggable for repositioning (data-draggable),
      // but the inner track + handle hijack the pointer for value-change.
      ev.stopPropagation();
      dragging = true;
      handle.style.cursor = 'grabbing';
      setPeel(pickFromEvent(ev));
      ev.preventDefault();
    };
    const move = (ev) => {
      if (!dragging) return;
      setPeel(pickFromEvent(ev));
    };
    const end = () => {
      dragging = false;
      handle.style.cursor = 'grab';
    };
    track.addEventListener('pointerdown', start);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', end, { passive: true });
    window.addEventListener('pointercancel', end, { passive: true });

    // Wheel scrub on the rail for desktop power-users
    rail.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const dy = Math.sign(ev.deltaY) * 0.03;
      setPeel(state.peel + dy);
    }, { passive: false });
  }

  // ── Layer chips (small floating strip showing the active layer + jump targets)
  function mountLayerChips(container) {
    const chip = document.createElement('div');
    chip.id = 'three3dLayerChips';
    chip.setAttribute('data-draggable', 'true');
    chip.style.cssText = `
      position: absolute; left: 12px; top: 60px;
      max-width: calc(100% - 80px);
      display: flex; flex-wrap: wrap; gap: 6px;
      padding: 6px;
      border-radius: 12px;
      background: rgba(8,12,20,0.55);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      border: 1px solid rgba(255,255,255,0.06);
      z-index: 14;
      box-sizing: border-box;
    `;

    REGISTRY.forEach((def) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = def.label;
      btn.setAttribute('data-layer', def.name);
      btn.style.cssText = `
        min-height: 28px; min-width: 44px;
        padding: 4px 10px;
        font: 600 10px/1 -apple-system, system-ui, sans-serif;
        letter-spacing: 0.08em; color: rgba(240,245,255,0.85);
        background: rgba(255,255,255,0.04);
        border: 1px solid ${hex(def.color, 0.45)};
        border-radius: 999px; cursor: pointer; transition: background .15s;
      `;
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setPeel(def.depth);
      });
      chip.appendChild(btn);
    });

    container.appendChild(chip);
    state.chip = chip;
  }

  function hex(num, a = 1) {
    const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    return `rgba(${r},${g},${b},${a})`;
  }

  // ── Public API ───────────────────────────────────────────────────────────
  function setPeel(v) {
    v = Math.max(0, Math.min(1, +v || 0));
    state.peel = v;
    // Update UI
    if (state.railFill)   state.railFill.style.height  = (v * 100).toFixed(1) + '%';
    if (state.railHandle) state.railHandle.style.top   = (v * 100).toFixed(1) + '%';
    if (state.railVal)    state.railVal.textContent    = Math.round(v * 100) + '%';
    // Update each layer's cut. Skin is special — it is the avatar
    // skin material's tracery rather than a dissolve mesh. We dim the
    // avatar material's transmission as the peel advances past 0.
    if (state.avatar && state.avatar.material && state.avatar.material.userData.uniforms) {
      const u = state.avatar.material.userData.uniforms;
      // Fade skin from 1.0 at v=0 to 0 by v=0.25, with rim glow holding.
      const skinCut = 1.0 - Math.max(0, (v - 0.0) / 0.25);
      state.avatar.material.opacity = Math.max(0.05, skinCut);
      state.avatar.material.transparent = true;
      if (u.uTraceryAmp) u.uTraceryAmp.value = 0.55 * skinCut + 0.15 * (1 - skinCut);
    }
    for (const name in state.layers) {
      const L = state.layers[name];
      if (!L || !L.obj || !L.visible) continue;
      const d = L.def.depth;
      const band = L.def.band;
      // Window: full opacity when |v - d| < band/2, smoothly fades to
      // 0 outside ±band.
      const dist = Math.abs(v - d);
      const cut = dist < band ? 1.0 - (dist / band) : 0.0;
      L.obj.traverse((m) => {
        if (m.isMesh && m.material) {
          const u = m.material.userData && m.material.userData.uniforms;
          if (u && u.uCut) u.uCut.value = Math.max(0.001, Math.min(1, cut));
          m.material.opacity = Math.max(0.001, cut);
          m.visible = cut > 0.01;
        }
      });
    }
  }

  function setVisibility(name, on) {
    const L = state.layers[name];
    if (!L) return;
    L.visible = !!on;
    if (L.obj) L.obj.visible = !!on;
  }

  function focus(name) {
    const L = state.layers[name];
    if (!L) return;
    setPeel(L.def.depth);
  }

  // ── Pointer pick → inspect ───────────────────────────────────────────────
  function onPointer(ev) {
    if (!state.scene || !state.avatar) return;
    const rect = state.container.getBoundingClientRect();
    const x = (ev.clientX - rect.left) / rect.width;
    const y = (ev.clientY - rect.top) / rect.height;
    state.pointer.set(x * 2 - 1, -(y * 2 - 1));

    // Camera is owned by scene.js — fetch from Three3DScene state.
    const cam = global.Three3DScene && global.Three3DScene.state.camera;
    if (!cam) return;
    state.raycaster.setFromCamera(state.pointer, cam);

    // Build hit candidate list from current visible layer objects + avatar.
    const targets = [];
    if (state.avatar.root) state.avatar.root.traverse((m) => { if (m.isMesh && m.visible) targets.push(m); });
    for (const k in state.layers) {
      const L = state.layers[k];
      if (L.obj && L.obj.visible) L.obj.traverse((m) => { if (m.isMesh && m.visible) targets.push(m); });
    }
    const hits = state.raycaster.intersectObjects(targets, false);
    if (!hits.length) return;
    const hit = hits[0];
    const layerName = (hit.object && hit.object.userData && hit.object.userData.layerName) || 'skin';
    const def = REGISTRY.find((d) => d.name === layerName) || REGISTRY[0];

    // Re-use OG info panel if present (#nodePanel + #panelTitle + #panelAccent).
    showInspect(def, hit);

    if (typeof state.onPick === 'function') {
      try { state.onPick({ layer: def, point: hit.point, mesh: hit.object }); } catch (_) {}
    }
  }

  function showInspect(def, hit) {
    const panel = document.getElementById('nodePanel');
    const title = document.getElementById('panelTitle');
    const accent = document.getElementById('panelAccent');
    if (panel && title) {
      panel.classList.add('open');
      panel.style.display = 'block';
      title.textContent = def.label;
      if (accent) accent.style.background = hex(def.color, 0.85);
      // Slot a simple body of text describing the layer + hit position.
      const body = panel.querySelector('.panel-body') || panel;
      const ext = document.getElementById('three3dInspectBody');
      const html = `
        <div style="font:11px/1.4 -apple-system, system-ui;color:rgba(240,245,255,.75);margin-top:6px;">
          Layer <strong>${def.label}</strong> — depth ${(def.depth * 100).toFixed(0)}%<br>
          Hit at (${hit.point.x.toFixed(2)}, ${hit.point.y.toFixed(2)}, ${hit.point.z.toFixed(2)})<br>
          <em style="color:${hex(def.color, 0.9)}">${describe(def.name)}</em>
        </div>`;
      if (ext) ext.innerHTML = html;
      else {
        const div = document.createElement('div');
        div.id = 'three3dInspectBody';
        div.innerHTML = html;
        body.appendChild(div);
      }
    } else {
      // No OG panel available — toast it instead so the click feels heard.
      toast(`${def.label} — ${describe(def.name)}`);
    }
  }

  function describe(name) {
    switch (name) {
      case 'skin':         return 'The boundary. First and last witness to every signal.';
      case 'muscle':       return 'Contracts you into motion. Where intention becomes force.';
      case 'skeleton':     return 'The architecture. What holds you against gravity.';
      case 'organs':       return 'The chambers — heart, lungs, gut. The autonomic crew.';
      case 'circulatory':  return 'Rivers of oxygen and signal. The cardiac drum.';
      case 'nervous':      return 'Lightning in lace. Where thought travels and feeling lands.';
      case 'cellular':     return 'Trillions, breathing in parallel. The hum beneath consciousness.';
      case 'genome':       return 'The double helix archive — the score everything else plays.';
      default:             return '';
    }
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = `
      position: fixed; left: 50%; bottom: 100px; transform: translateX(-50%);
      background: rgba(8,12,20,0.85); color: #eaf2ff;
      padding: 8px 14px; border-radius: 999px;
      font: 600 11px/1 -apple-system, system-ui, sans-serif;
      letter-spacing: 0.04em; z-index: 9999;
      border: 1px solid rgba(126,200,255,0.3);
    `;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  function publicApi() {
    return {
      setPeel, setVisibility, focus,
      get peel() { return state.peel; },
      get registry() { return REGISTRY.slice(); },
      applyToHud(el) { if (el) el.appendChild(state.rail); },
      dispose() {
        if (state.rail && state.rail.parentNode) state.rail.parentNode.removeChild(state.rail);
        if (state.chip && state.chip.parentNode) state.chip.parentNode.removeChild(state.chip);
        for (const k in state.layers) {
          const L = state.layers[k];
          if (L.obj && L.obj.parent) L.obj.parent.remove(L.obj);
        }
      },
    };
  }

  // ── Procedural fallbacks (anatomy stand-ins, NEVER ovular blobs) ─────────
  // These exist so the stack is never empty for a layer. Each anchors to
  // the avatar bbox so it sits where flesh would. They are intentionally
  // schematic (the GLB equivalents will be much more detailed when dropped).
  function muscleOverlay(THREE, avatar, scene) {
    if (!avatar || !avatar.root) return null;
    const grp = new THREE.Group();
    const bbox = new THREE.Box3().setFromObject(avatar.root);
    const size = new THREE.Vector3(); bbox.getSize(size);
    const ctr = new THREE.Vector3(); bbox.getCenter(ctr);
    // Wireframe "fiber" ellipsoid silhouette that hugs the avatar.
    const geo = new THREE.SphereGeometry(0.5, 32, 24);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xc94f4f, roughness: 0.7, metalness: 0.02,
      transparent: true, opacity: 0.85, wireframe: false, side: THREE.DoubleSide,
    });
    const inner = new THREE.Mesh(geo, mat);
    inner.scale.set(size.x * 0.46, size.y * 0.46, size.z * 0.42);
    inner.position.copy(ctr);
    grp.add(inner);
    // Wrap with dissolve uniforms so peel-cut works
    inner.material = applyDissolveTo(THREE, mat, 0xc94f4f);
    return grp;
  }
  function skeletonOverlay(THREE, avatar, scene) {
    if (!avatar || !avatar.root) return null;
    const grp = new THREE.Group();
    const bbox = new THREE.Box3().setFromObject(avatar.root);
    const ctr = new THREE.Vector3(); bbox.getCenter(ctr);
    const size = new THREE.Vector3(); bbox.getSize(size);
    // Spine column
    const spineMat = applyDissolveTo(THREE, new THREE.MeshStandardMaterial({
      color: 0xf3e9d2, roughness: 0.4, metalness: 0.1, transparent: true,
    }), 0xf3e9d2);
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, size.y * 0.55, 12), spineMat);
    spine.position.set(0, ctr.y - 0.05, 0);
    grp.add(spine);
    // Ribcage proxy
    const rib = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 16), spineMat);
    rib.scale.set(1.6, 1.1, 0.9);
    rib.position.set(0, ctr.y + size.y * 0.18, 0);
    grp.add(rib);
    // Skull proxy
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 16), spineMat);
    skull.position.set(0, bbox.max.y - 0.11, 0);
    grp.add(skull);
    return grp;
  }
  function organsOverlay(THREE, avatar, scene) {
    if (!avatar || !avatar.root) return null;
    const grp = new THREE.Group();
    const bbox = new THREE.Box3().setFromObject(avatar.root);
    const ctr = new THREE.Vector3(); bbox.getCenter(ctr);
    function organ(color, x, y, z, sx, sy, sz) {
      const m = applyDissolveTo(THREE, new THREE.MeshStandardMaterial({
        color, roughness: 0.55, metalness: 0.05, transparent: true,
      }), color);
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 14), m);
      o.scale.set(sx, sy, sz);
      o.position.set(x, y, z);
      grp.add(o);
      return o;
    }
    // Heart — behind sternum, slightly left
    organ(0xff4d4d, -0.04, ctr.y + 0.16, 0.02, 1.0, 1.1, 0.8).name = 'heart';
    // Lungs L/R
    organ(0xff8a6b, -0.12, ctr.y + 0.18, 0.0, 1.2, 1.4, 0.8).name = 'lungL';
    organ(0xff8a6b,  0.12, ctr.y + 0.18, 0.0, 1.2, 1.4, 0.8).name = 'lungR';
    // Liver
    organ(0x8b4513,  0.10, ctr.y - 0.05, 0.04, 1.4, 0.9, 0.9).name = 'liver';
    // Stomach
    organ(0xd4a373, -0.06, ctr.y - 0.05, 0.04, 0.9, 0.9, 0.9).name = 'stomach';
    // Brain inside skull
    const brainMat = applyDissolveTo(THREE, new THREE.MeshStandardMaterial({
      color: 0xc4a3ff, roughness: 0.5, metalness: 0.05, transparent: true,
    }), 0xc4a3ff);
    const brain = new THREE.Mesh(new THREE.SphereGeometry(0.085, 24, 16), brainMat);
    brain.position.set(0, bbox.max.y - 0.11, 0);
    brain.name = 'brain';
    grp.add(brain);
    return grp;
  }
  function circulatoryOverlay(THREE, avatar, scene) {
    if (!avatar || !avatar.root) return null;
    const grp = new THREE.Group();
    const bbox = new THREE.Box3().setFromObject(avatar.root);
    const ctr = new THREE.Vector3(); bbox.getCenter(ctr);
    // Aorta + main trunks as Catmull-Rom tubes
    const trunks = [
      [new THREE.Vector3(0, bbox.max.y - 0.2, 0),
       new THREE.Vector3(0, ctr.y + 0.2, 0.02),
       new THREE.Vector3(0, ctr.y, 0.03),
       new THREE.Vector3(0, ctr.y - 0.25, 0.02)],
      [new THREE.Vector3(0, ctr.y - 0.25, 0),
       new THREE.Vector3(-0.08, ctr.y - 0.45, 0),
       new THREE.Vector3(-0.08, bbox.min.y + 0.2, 0)],
      [new THREE.Vector3(0, ctr.y - 0.25, 0),
       new THREE.Vector3(0.08, ctr.y - 0.45, 0),
       new THREE.Vector3(0.08, bbox.min.y + 0.2, 0)],
    ];
    const mat = applyDissolveTo(THREE, new THREE.MeshStandardMaterial({
      color: 0xe63946, emissive: 0x8b1818, roughness: 0.4, metalness: 0.1, transparent: true,
    }), 0xe63946);
    trunks.forEach((pts) => {
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.TubeGeometry(curve, 32, 0.012, 8, false);
      grp.add(new THREE.Mesh(tube, mat));
    });
    return grp;
  }
  function nervousOverlay(THREE, avatar, scene) {
    if (!avatar || !avatar.root) return null;
    const grp = new THREE.Group();
    const bbox = new THREE.Box3().setFromObject(avatar.root);
    const ctr = new THREE.Vector3(); bbox.getCenter(ctr);
    const mat = applyDissolveTo(THREE, new THREE.MeshStandardMaterial({
      color: 0x7ec8ff, emissive: 0x4a8cc7, roughness: 0.3, metalness: 0.0, transparent: true,
    }), 0x7ec8ff);
    // Spinal cord
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, (bbox.max.y - bbox.min.y) * 0.55, 8),
      mat
    );
    cord.position.set(0, ctr.y, -0.03);
    grp.add(cord);
    // Branching nerves (a handful of splines off the spine)
    for (let i = -3; i <= 3; i++) {
      const y = ctr.y + i * 0.06;
      const side = i % 2 === 0 ? 1 : -1;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, y, -0.03),
        new THREE.Vector3(side * 0.05, y - 0.02, 0),
        new THREE.Vector3(side * 0.12, y - 0.04, 0.02),
        new THREE.Vector3(side * 0.18, y - 0.05, 0.03),
      ]);
      grp.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.0045, 6, false), mat));
    }
    return grp;
  }
  function cellularField(THREE, avatar, scene) {
    if (!avatar || !avatar.root) return null;
    const bbox = new THREE.Box3().setFromObject(avatar.root);
    const ctr = new THREE.Vector3(); bbox.getCenter(ctr);
    const size = new THREE.Vector3(); bbox.getSize(size);
    const COUNT = 1400;
    const geom = new THREE.SphereGeometry(0.005, 6, 4);
    const mat = applyDissolveTo(THREE, new THREE.MeshStandardMaterial({
      color: 0xb794f4, emissive: 0x6b4cb0, roughness: 0.4, transparent: true,
    }), 0xb794f4);
    const inst = new THREE.InstancedMesh(geom, mat, COUNT);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < COUNT; i++) {
      // Ellipsoidal sampling so cells live INSIDE the body silhouette.
      let x, y, z, r;
      do {
        x = (Math.random() * 2 - 1);
        y = (Math.random() * 2 - 1);
        z = (Math.random() * 2 - 1);
        r = x*x + y*y + z*z;
      } while (r > 1);
      dummy.position.set(
        ctr.x + x * size.x * 0.46,
        ctr.y + y * size.y * 0.46,
        ctr.z + z * size.z * 0.42,
      );
      const s = 0.6 + Math.random() * 1.6;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    return inst;
  }
  function genomeHelix(THREE, avatar, scene) {
    if (!avatar || !avatar.root) return null;
    const grp = new THREE.Group();
    const bbox = new THREE.Box3().setFromObject(avatar.root);
    const ctr = new THREE.Vector3(); bbox.getCenter(ctr);
    const turns = 8, points = 240, radius = 0.04;
    const ptsA = [], ptsB = [];
    const h = (bbox.max.y - bbox.min.y) * 0.5;
    for (let i = 0; i < points; i++) {
      const t = i / (points - 1);
      const y = ctr.y - h * 0.5 + t * h;
      const ang = t * Math.PI * 2 * turns;
      ptsA.push(new THREE.Vector3(Math.cos(ang) * radius, y, Math.sin(ang) * radius));
      ptsB.push(new THREE.Vector3(Math.cos(ang + Math.PI) * radius, y, Math.sin(ang + Math.PI) * radius));
    }
    const matA = applyDissolveTo(THREE, new THREE.MeshStandardMaterial({
      color: 0xff6b9d, emissive: 0xa33363, roughness: 0.35, transparent: true,
    }), 0xff6b9d);
    const matB = applyDissolveTo(THREE, new THREE.MeshStandardMaterial({
      color: 0xff9bd2, emissive: 0xb04488, roughness: 0.35, transparent: true,
    }), 0xff9bd2);
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ptsA), 240, 0.0045, 6, false), matA));
    grp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ptsB), 240, 0.0045, 6, false), matB));
    // Rungs
    const rungMat = applyDissolveTo(THREE, new THREE.MeshStandardMaterial({
      color: 0xffe066, roughness: 0.45, transparent: true,
    }), 0xffe066);
    for (let i = 0; i < points; i += 6) {
      const geom = new THREE.CylinderGeometry(0.001, 0.001, radius * 2, 6);
      const m = new THREE.Mesh(geom, rungMat);
      const a = ptsA[i], b = ptsB[i];
      m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      m.lookAt(b);
      m.rotateX(Math.PI / 2);
      grp.add(m);
    }
    return grp;
  }

  // Helper used by procedural overlays so they share the dissolve shader.
  function applyDissolveTo(THREE, mat, glowHex) {
    return buildDissolveMaterial(THREE, glowHex, mat);
  }

  global.Three3DLayers = Object.freeze({
    mount,
    REGISTRY,
    get state() { return state; },
  });
})(typeof window !== 'undefined' ? window : globalThis);
