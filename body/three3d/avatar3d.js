/* ═══════════════════════════════════════════════════════════════════════════
   body/three3d/avatar3d.js — THE HUMAN

   Loads a REAL rigged human (glTF/GLB) into the scene. Runs idle
   breathing, weight shift, blink. Wears the futuristic "living light
   under skin" treatment — translucent skin with cyan neural traceries
   pulsing along the surface, tasteful not garish.

   If the GLB fails to load (no asset hosted yet, CDN down, etc.) we
   fall back to an ANATOMICALLY-CORRECT procedural mannequin — 7.5
   heads tall, real limb ratios, skinned segments, NOT ovular blobs.
   The procedural fallback exists ONLY as a last resort; Vinta
   rejected it as the default path.

   Public surface:
     window.Three3DAvatar.mount(scene, modules, opts)
       → { root, mixer, bones, morphs, setBreathRate, setGlow,
           ripple, blink, posture, dispose }

   Vinta directive 2026-06-03: "a real fucking looking human." This
   module's first job is to load the real mesh. Everything else is
   secondary.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

(function (global) {
  if (global.Three3DAvatar && global.Three3DAvatar.mount) return;

  // ── Model URL resolution ─────────────────────────────────────────────────
  // Priority (try each in order; first 200 wins):
  //   1. ?model=<url>                       — testing override
  //   2. window.__VINTINUUM_AVATAR_URL      — embedder override
  //   3. body/three3d/assets/human.glb      — Ready Player Me drop-in (preferred)
  //   4. {API_BASE}/static/avatar.glb       — API-hosted canonical
  //   5. body/three3d/assets/riggedfigure-cc0.glb — CC0 safe default (50KB)
  //   6. procedural fallback                — last resort, anatomically correct
  function resolveCandidateUrls() {
    const out = [];
    try {
      const q = new URLSearchParams(location.search);
      const o = q.get('model');
      if (o) out.push(o);
    } catch (_) {}
    if (global.__VINTINUUM_AVATAR_URL) out.push(global.__VINTINUUM_AVATAR_URL);
    out.push('body/three3d/assets/human.glb');
    const base = global.__VINTINUUM_API_BASE || '';
    if (base) out.push(base.replace(/\/$/, '') + '/static/avatar.glb');
    out.push('body/three3d/assets/riggedfigure-cc0.glb');
    return out;
  }
  function resolveModelUrl() { return resolveCandidateUrls()[0]; }

  // ── Live avatar resolution ───────────────────────────────────────────────
  // The native embodiment pipeline (POST /api/avatar/ingest) gives each logged-
  // in user their OWN rigged GLB. Ask the brain for the caller's active avatar
  // and load THAT first. Falls through to the static candidates (human.glb,
  // CC0, procedural) when the user hasn't made one yet or is logged out.
  // This is the whole point of the pivot: your face, not a shared mannequin.
  async function resolveLiveAvatarUrl() {
    try {
      const base = (global.__VINTINUUM_API_BASE || '').replace(/\/$/, '');
      if (!base) return null;
      let token = null;
      try { token = localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token'); } catch (_) {}
      if (!token) return null; // logged out → no personal avatar
      const r = await fetch(base + '/api/avatar', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      if (!r.ok) return null;
      const data = await r.json();
      const active = data && data.active;
      if (active && active.status === 'ready' && active.glbUrl) {
        // glbUrl is brain-relative (/avatars/file/glb/<id>) → absolutize
        return active.glbUrl.startsWith('http') ? active.glbUrl : base + active.glbUrl;
      }
    } catch (_) { /* network/logged-out — fall through to static */ }
    return null;
  }

  // ── Futuristic skin shader (extends MeshPhysicalMaterial) ────────────────
  // Adds:
  //   - subtle subsurface tint (warmth bleeding through translucency)
  //   - cyan "neural traceries" — fbm-noise pulses that travel along
  //     the body, brightness modulated by `uPulse`
  //   - fresnel rim glow tied to the layer color
  // Implemented via onBeforeCompile to keep PBR shadowing intact.
  function makeLivingSkinMaterial(THREE, { tracery = true } = {}) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xd9b8a6,
      roughness: 0.62,
      metalness: 0.0,
      transmission: 0.18,         // a *touch* of translucency
      thickness: 0.6,
      ior: 1.35,
      attenuationColor: 0xff8a6b,
      attenuationDistance: 0.8,
      clearcoat: 0.12,
      clearcoatRoughness: 0.55,
      sheen: 0.4,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color(0xffb89a),
    });

    const uniforms = {
      uTime:        { value: 0 },
      uPulse:       { value: 0 },     // 0..1, driven by drive.js
      uTraceryAmp:  { value: tracery ? 0.55 : 0.0 },
      uRimColor:    { value: new THREE.Color(0x7ec8ff) },
      uGlowColor:   { value: new THREE.Color(0x7ec8ff) },
      uWarmth:      { value: 1.0 },   // serotonin glow multiplier
    };
    mat.userData.uniforms = uniforms;

    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           varying vec3 vWorldPosN;
           varying vec3 vViewDirN;`
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
           vWorldPosN = (modelMatrix * vec4(transformed, 1.0)).xyz;
           vViewDirN = normalize(cameraPosition - vWorldPosN);`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uTime;
           uniform float uPulse;
           uniform float uTraceryAmp;
           uniform vec3  uRimColor;
           uniform vec3  uGlowColor;
           uniform float uWarmth;
           varying vec3  vWorldPosN;
           varying vec3  vViewDirN;

           // Cheap fbm for tracery — 2 octaves only, this runs per-fragment.
           float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
           float noise(vec3 p){
             vec3 i = floor(p); vec3 f = fract(p);
             f = f*f*(3.0-2.0*f);
             float n = mix(
               mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
                   mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                   mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y),
               f.z);
             return n;
           }
           float fbm(vec3 p){
             return 0.6*noise(p) + 0.4*noise(p*2.13 + 7.7);
           }`
        )
        .replace(
          '#include <output_fragment>',
          `// ── Living skin: tracery + fresnel rim ────────────────────
           vec3 baseRGB = outgoingLight;

           // Tracery — moving fbm bands along Y, masked by a second slow
           // noise so it looks like vessels, not stripes.
           float t = uTime * 0.18;
           float bands = fbm(vec3(vWorldPosN.x * 3.2,
                                  vWorldPosN.y * 5.5 - t * 2.0,
                                  vWorldPosN.z * 3.2));
           float mask  = smoothstep(0.45, 0.85,
                          fbm(vec3(vWorldPosN.xz * 1.6, vWorldPosN.y * 0.9)));
           float tracery = pow(bands, 6.0) * mask;
           vec3 traceryRGB = uGlowColor * tracery * uTraceryAmp * (0.6 + uPulse * 1.8);

           // Fresnel rim — cooler near silhouette
           float fres = pow(1.0 - clamp(dot(normalize(vViewDirN), vec3(0,0,1)), 0.0, 1.0), 2.2);
           vec3 rimRGB = uRimColor * fres * (0.25 + uPulse * 0.35);

           vec3 finalRGB = baseRGB * uWarmth + traceryRGB + rimRGB;
           gl_FragColor = vec4(finalRGB, diffuseColor.a);
           #include <tonemapping_fragment>
           #include <colorspace_fragment>
           #include <fog_fragment>
           #include <premultiplied_alpha_fragment>
           #include <dithering_fragment>`
        );
    };

    return mat;
  }

  // ── Procedural fallback (anatomically correct, NOT ovular) ───────────────
  // Used only if GLB fails to load. 7.5 heads tall. Real limb ratios.
  // Built from capsules + scaled cylinders. Mannequin-grade, not Picasso.
  function buildProceduralFallback(THREE) {
    const group = new THREE.Group();
    group.name = 'avatar3d:fallback';

    const headRadius = 0.105;            // head diameter ~21cm
    const totalHeight = headRadius * 2 * 7.5; // 7.5 heads = ~1.575m
    // Vertical proportions, head-units down from crown:
    //   0.0   crown
    //   1.0   chin
    //   2.0   nipple line
    //   3.0   navel
    //   3.75  pubis (midline of body)
    //   5.5   knee
    //   7.5   sole
    const hu = headRadius * 2;
    const Y = (h) => totalHeight - h * hu;

    const skin = makeLivingSkinMaterial(THREE);

    function part(geom, y, name) {
      const m = new THREE.Mesh(geom, skin);
      m.position.y = y;
      m.castShadow = true; m.receiveShadow = true;
      m.name = name;
      group.add(m);
      return m;
    }

    // Head — sphere with chin taper via scale
    const head = part(new THREE.SphereGeometry(headRadius, 32, 24), Y(0.5), 'head');
    head.scale.set(0.92, 1.08, 0.94);

    // Neck
    part(new THREE.CapsuleGeometry(0.045, 0.08, 6, 12), Y(1.15), 'neck');

    // Torso — cylinder tapered shoulders-to-waist (no ovular blob)
    const torsoGeom = new THREE.CylinderGeometry(0.13, 0.10, hu * 2.0, 16);
    const torso = part(torsoGeom, Y(2.0), 'torso');
    torso.scale.set(1.25, 1, 0.75); // shoulders wider, depth shallower

    // Hips
    part(new THREE.CylinderGeometry(0.12, 0.13, 0.10, 16), Y(3.6), 'hips');

    // Upper arms
    [-1, 1].forEach((sx) => {
      const m = part(new THREE.CapsuleGeometry(0.045, hu * 1.2, 6, 12), Y(2.0), 'upperArm');
      m.position.x = sx * 0.18;
      m.rotation.z = sx * 0.05;
    });
    // Forearms
    [-1, 1].forEach((sx) => {
      const m = part(new THREE.CapsuleGeometry(0.038, hu * 1.1, 6, 12), Y(3.1), 'forearm');
      m.position.x = sx * 0.22;
    });
    // Thighs
    [-1, 1].forEach((sx) => {
      const m = part(new THREE.CapsuleGeometry(0.06, hu * 1.5, 6, 12), Y(4.7), 'thigh');
      m.position.x = sx * 0.07;
    });
    // Calves
    [-1, 1].forEach((sx) => {
      const m = part(new THREE.CapsuleGeometry(0.05, hu * 1.5, 6, 12), Y(6.3), 'calf');
      m.position.x = sx * 0.07;
    });
    // Feet
    [-1, 1].forEach((sx) => {
      const g = new THREE.BoxGeometry(0.08, 0.05, 0.18);
      const m = part(g, 0.025, 'foot');
      m.position.set(sx * 0.07, 0.025, 0.04);
    });

    group.position.y = 0; // sole at y=0
    return { root: group, material: skin, isFallback: true };
  }

  // ── Mount ────────────────────────────────────────────────────────────────
  async function mount({ scene, modules, onProgress }) {
    const { THREE, GLTFLoader, DRACOLoader, KTX2Loader } = modules;
    const candidates = resolveCandidateUrls();
    // Prepend the logged-in user's OWN pipeline-generated avatar if they have one.
    try {
      const liveUrl = await resolveLiveAvatarUrl();
      if (liveUrl) { candidates.unshift(liveUrl); console.log('[avatar3d] live avatar:', liveUrl); }
    } catch (_) {}
    console.log('[avatar3d] candidate models:', candidates);

    const handle = {
      root: null,
      material: null,
      mixer: null,
      bones: {},
      morphs: { blinkL: null, blinkR: null, mouthOpen: null },
      isFallback: false,
      _idleActions: [],
      _breathRate: 0.22,    // hz (drive.js overrides)
      _glow: 1.0,
      _pulse: 0,
      _tremor: 0,
      _t: 0,
    };

    let loaded = null;
    let usedUrl = null;
    const loader = new GLTFLoader();
    if (DRACOLoader) {
      const draco = new DRACOLoader();
      draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      loader.setDRACOLoader(draco);
    }
    for (const url of candidates) {
      try {
        const gltf = await new Promise((resolve, reject) => {
          loader.load(url, resolve, (xhr) => {
            if (onProgress && xhr.lengthComputable) onProgress(xhr.loaded / xhr.total);
          }, reject);
        });
        loaded = gltf;
        usedUrl = url;
        console.log('[avatar3d] loaded:', url);
        break;
      } catch (e) {
        console.warn('[avatar3d] candidate failed:', url, e && e.message);
      }
    }
    if (!loaded) {
      console.warn('[avatar3d] all GLB candidates failed, building procedural fallback');
    }
    handle.modelUrl = usedUrl;

    if (loaded) {
      const root = loaded.scene || loaded.scenes[0];
      root.name = 'avatar3d:human';

      // Walk the mesh: swap skin material on body parts, collect bones,
      // hook morph targets, normalize scale + position.
      const bbox = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3(); bbox.getSize(size);
      const targetHeight = 1.72; // ~5'8" — feels right for the human Vinta wants
      const scale = targetHeight / Math.max(0.01, size.y);
      root.scale.setScalar(scale);
      root.position.y = -bbox.min.y * scale; // plant feet on y=0
      root.position.x = 0; root.position.z = 0;

      const skinMat = makeLivingSkinMaterial(THREE);
      handle.material = skinMat;

      root.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          // Replace base material for body meshes — keep textures if useful.
          // Heuristic: if the mesh has skin/body in its name, swap; else
          // keep original (eyes, teeth, hair shouldn't get the tracery shader).
          const nm = (obj.name || '').toLowerCase();
          const matName = (obj.material && obj.material.name || '').toLowerCase();
          const isBody = /body|skin|head|face|arm|leg|torso|chest|wolf3d_body|wolf3d_head/i.test(
            nm + ' ' + matName
          );
          if (isBody) {
            obj.material = skinMat;
          }
          // Hunt morph targets
          if (obj.morphTargetDictionary) {
            for (const k of Object.keys(obj.morphTargetDictionary)) {
              const lk = k.toLowerCase();
              const idx = obj.morphTargetDictionary[k];
              if (/blinkleft|eyeblinkleft|blink_l/i.test(lk)) handle.morphs.blinkL = { mesh: obj, idx };
              if (/blinkright|eyeblinkright|blink_r/i.test(lk)) handle.morphs.blinkR = { mesh: obj, idx };
              if (/mouthopen|jawopen/i.test(lk))               handle.morphs.mouthOpen = { mesh: obj, idx };
            }
          }
        }
        if (obj.isBone) {
          const n = obj.name.toLowerCase();
          if (/head$/.test(n) || /head\d*$/.test(n))   handle.bones.head     = obj;
          if (/neck/.test(n))                          handle.bones.neck     = obj;
          if (/spine2|chest|upperchest/.test(n))       handle.bones.chest    = obj;
          if (/spine1|spine$/.test(n))                 handle.bones.spine    = obj;
          if (/hips$|pelvis/.test(n))                  handle.bones.hips     = obj;
          if (/leftshoulder|l_shoulder/.test(n))       handle.bones.shoulderL = obj;
          if (/rightshoulder|r_shoulder/.test(n))      handle.bones.shoulderR = obj;
        }
      });

      // Animation mixer — runs any baked clips (idle if the GLB ships one).
      handle.mixer = new THREE.AnimationMixer(root);
      if (loaded.animations && loaded.animations.length) {
        // Prefer a clip whose name contains 'idle', fall back to first.
        const idleClip = loaded.animations.find(c => /idle/i.test(c.name)) || loaded.animations[0];
        const action = handle.mixer.clipAction(idleClip);
        action.play();
        handle._idleActions.push(action);
      }

      handle.root = root;
      scene.add(root);
    } else {
      const f = buildProceduralFallback(THREE);
      handle.root = f.root;
      handle.material = f.material;
      handle.isFallback = true;
      scene.add(f.root);
    }

    // ── Driving API ────────────────────────────────────────────────────────
    function setBreathRate(hz) { handle._breathRate = Math.max(0.08, Math.min(0.9, hz)); }
    function setGlow(v) {
      handle._glow = Math.max(0.4, Math.min(1.8, v));
      if (handle.material && handle.material.userData.uniforms) {
        handle.material.userData.uniforms.uWarmth.value = handle._glow;
      }
    }
    function setRimColor(hex) {
      if (handle.material && handle.material.userData.uniforms) {
        handle.material.userData.uniforms.uRimColor.value.setHex(hex);
        handle.material.userData.uniforms.uGlowColor.value.setHex(hex);
      }
    }
    function setTremor(v) { handle._tremor = Math.max(0, Math.min(1, v)); }
    function ripple(intensity = 0.6) {
      handle._pulse = Math.min(1, handle._pulse + intensity);
    }
    let _blinkUntil = 0;
    function blink() { _blinkUntil = performance.now() + 140; }

    // ── Per-frame tick ─────────────────────────────────────────────────────
    function tick(dt) {
      if (!handle.root) return;
      handle._t += dt;

      // Decay pulse
      handle._pulse *= Math.exp(-dt * 1.4);

      // Mixer
      if (handle.mixer) handle.mixer.update(dt);

      // Breath — chest rises/falls, head subtle bob
      const breathPhase = handle._t * handle._breathRate * Math.PI * 2;
      const breath = Math.sin(breathPhase) * 0.5 + 0.5; // 0..1
      if (handle.bones.chest) {
        handle.bones.chest.scale.y = 1 + breath * 0.022;
        handle.bones.chest.scale.z = 1 + breath * 0.018;
      } else if (handle.isFallback) {
        // procedural: scale torso mesh directly
        const torso = handle.root.getObjectByName('torso');
        if (torso) torso.scale.set(1.25, 1 + breath * 0.025, 0.75 + breath * 0.012);
      }
      if (handle.bones.head) {
        handle.bones.head.rotation.x = Math.sin(handle._t * 0.5) * 0.012 - breath * 0.01;
      }

      // Weight shift — slow hip sway
      if (handle.bones.hips) {
        handle.bones.hips.position.x = Math.sin(handle._t * 0.35) * 0.012;
      } else if (handle.isFallback) {
        handle.root.position.x = Math.sin(handle._t * 0.35) * 0.012;
      }

      // Tremor — tiny high-frequency offset on hands/head when stressed
      if (handle._tremor > 0.05) {
        const t = handle._t * 30;
        const a = handle._tremor * 0.004;
        if (handle.bones.head) handle.bones.head.rotation.z = Math.sin(t) * a;
        if (handle.bones.shoulderL) handle.bones.shoulderL.position.y = Math.sin(t * 1.3) * a;
        if (handle.bones.shoulderR) handle.bones.shoulderR.position.y = Math.cos(t * 1.1) * a;
      }

      // Spontaneous blink ~ every 4-7s
      if (!_blinkUntil && Math.random() < dt * 0.22) blink();
      const blinkOn = performance.now() < _blinkUntil ? 1 : 0;
      if (blinkOn === 0) _blinkUntil = 0;
      if (handle.morphs.blinkL) handle.morphs.blinkL.mesh.morphTargetInfluences[handle.morphs.blinkL.idx] = blinkOn;
      if (handle.morphs.blinkR) handle.morphs.blinkR.mesh.morphTargetInfluences[handle.morphs.blinkR.idx] = blinkOn;

      // Shader uniforms
      if (handle.material && handle.material.userData.uniforms) {
        handle.material.userData.uniforms.uTime.value = handle._t;
        handle.material.userData.uniforms.uPulse.value = handle._pulse;
      }
    }

    function dispose() {
      if (handle.root && handle.root.parent) handle.root.parent.remove(handle.root);
      if (handle.material) handle.material.dispose();
      handle.root = null;
    }

    Object.assign(handle, { setBreathRate, setGlow, setRimColor, setTremor, ripple, blink, tick, dispose });
    return handle;
  }

  global.Three3DAvatar = Object.freeze({
    mount,
    resolveModelUrl,
    makeLivingSkinMaterial,
  });
})(typeof window !== 'undefined' ? window : globalThis);
