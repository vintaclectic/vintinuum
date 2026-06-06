'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   RIGGED PRESENCE — a walking body for the clearing.

   The bust-on-proxy approach (ATLAS's trick): xbot.glb is a complete Mixamo rig
   with idle/walk/run clips. We clone that rig per presence, HIDE its mesh, and
   mount the user's real bust on the head bone. The rig walks; the real face
   rides. One shared skeleton + motion library; every body inherits it for free.

   For agents (no bust) we keep a soft light-figure instead — they stay as
   shaped presences, not humanoid mannequins (ARIA's law).

   API:
     const p = await RiggedPresence.create({ THREE, mods, bustUrl });
     scene.add(p.root);
     p.play('walk'|'idle'|'run');   // crossfades
     p.update(dt);                  // advance the mixer
   ════════════════════════════════════════════════════════════════════════════ */

(function (global) {
  const RP = {};
  let _rigGltf = null;          // the loaded xbot template (loaded once)
  let _rigPromise = null;

  function _base() { return (global.__VINTINUUM_API_BASE || '').replace(/\/$/, ''); }

  // Load the xbot rig template exactly once.
  async function _loadRigTemplate(mods) {
    if (_rigGltf) return _rigGltf;
    if (_rigPromise) return _rigPromise;
    _rigPromise = new Promise((resolve, reject) => {
      const loader = new mods.GLTFLoader();
      const url = 'body/three3d/assets/xbot.glb';
      loader.load(url, (g) => { _rigGltf = g; resolve(g); }, undefined, reject);
    });
    return _rigPromise;
  }

  // Create a walking presence.
  //   bustUrl   → mount a real face on the head (users)
  //   opts.cloud → render as a particle constellation (council presences):
  //                { color, count, pointSize, motion: 'breath'|'lattice'|'drift'|'orbit'|'spark' }
  RP.create = async function ({ THREE, mods, bustUrl, opts = {} }) {
    const tmpl = await _loadRigTemplate(mods);
    const SkeletonUtils = mods.SkeletonUtils;

    // clone the rig (skeleton + skinned mesh) so each presence has its own
    const root = SkeletonUtils && SkeletonUtils.clone ? SkeletonUtils.clone(tmpl.scene) : tmpl.scene.clone(true);
    root.traverse(o => { if (o.isMesh) { o.frustumCulled = false; } });

    // mixer + clips from the template (clips retarget by bone NAME, shared)
    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    for (const clip of tmpl.animations) actions[clip.name] = mixer.clipAction(clip, root);

    // find the head bone to mount the bust on
    let headBone = null, neckBone = null;
    root.traverse(o => {
      if (o.isBone) {
        if (/Head$/.test(o.name)) headBone = o;
        if (/Neck$/.test(o.name)) neckBone = o;
      }
    });

    const handle = { root, mixer, actions, _current: null, isRigged: true, bust: null, cloud: null, lightMat: null };

    // LIGHT-FIGURE (ATLAS's perf fix + ARIA's 'warm light gathered into a figure'):
    // the council ARE the xbot SkinnedMesh — but rendered with an additive
    // fresnel/emissive material so they read as a glowing body of light, not
    // flesh. GPU-skinned for free by three.js (zero per-frame CPU). Replaces the
    // 6,800-getVertexPosition/frame cloud that made the world sluggish.
    if (opts.cloud) {
      const lightMat = _makeLightFigureMaterial(THREE, opts.cloud);
      root.traverse(o => {
        if (o.isSkinnedMesh) { o.material = lightMat; o.frustumCulled = true; }
        else if (o.isMesh) { o.visible = false; }
      });
      handle.lightMat = lightMat;
    }

    if (bustUrl) {
      // hide the xbot mesh — we only want its skeleton driving motion
      root.traverse(o => { if (o.isMesh || o.isSkinnedMesh) o.visible = false; });
      // mount the bust on the head bone
      try {
        const bustGltf = await new Promise((res, rej) => new mods.GLTFLoader().load(bustUrl, res, undefined, rej));
        const bust = bustGltf.scene;
        // Hunyuan bust is roughly head+shoulders, ~1.5–2 units tall in its own space.
        // Scale + offset so it sits where xbot's head is.
        const mount = headBone || neckBone;
        if (mount) {
          // normalize bust size: measure its bbox height, scale to ~0.45 (head size)
          const box = new THREE.Box3().setFromObject(bust);
          const h = Math.max(0.001, box.max.y - box.min.y);
          const s = 0.5 / h;
          bust.scale.setScalar(s);
          // recenter so the face sits on the neck
          const center = box.getCenter(new THREE.Vector3());
          bust.position.set(-center.x * s, -center.y * s + 0.12, -center.z * s);
          mount.add(bust);
          handle.bust = bust;
        } else {
          // no head bone — just float the bust at head height on the root
          bust.position.y = 1.5; root.add(bust);
          handle.bust = bust;
        }
      } catch (e) {
        console.warn('[rigged-presence] bust load failed, showing rig body:', e && e.message);
        root.traverse(o => { if (o.isMesh || o.isSkinnedMesh) o.visible = true; });
      }
    }

    handle.play = function (name, fade = 0.3) {
      const next = actions[name] || actions.idle;
      if (!next || handle._current === next) return;
      next.reset().fadeIn(fade).play();
      if (handle._current) handle._current.fadeOut(fade);
      handle._current = next;
    };
    handle._t = 0;
    handle.update = function (dt) {
      mixer.update(dt);
      // cheap: just advance the light-figure's breath/spark time uniform (no CPU resample)
      if (handle.lightMat && handle.lightMat.userData.uTime) { handle._t += dt; handle.lightMat.userData.uTime.value = handle._t; }
    };
    handle.dispose = function () { mixer.stopAllAction(); };

    // start idle
    handle.play('idle', 0);
    return handle;
  };

  // ── LIGHT-FIGURE MATERIAL — a body made of light (ATLAS's GPU fix) ───────────
  // A MeshBasicMaterial (which three.js SKINS on the GPU for free) extended via
  // onBeforeCompile to render as additive fresnel glow: bright at silhouette
  // edges, soft in the middle, breathing. Swapped onto the xbot SkinnedMesh so
  // the council are luminous figures that walk/idle for ZERO per-frame CPU cost.
  function _makeLightFigureMaterial(THREE, cfg) {
    const col = new THREE.Color(cfg.color || '#f4c79a');
    const motion = cfg.motion || 'breath';
    const motionId = { breath: 0, lattice: 1, drift: 2, orbit: 3, spark: 4 }[motion] ?? 0;
    const mat = new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    mat.userData.uTime = { value: 0 };
    mat.userData.uMotion = { value: motionId };
    mat.userData.uColor = { value: col };
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = mat.userData.uTime;
      shader.uniforms.uMotion = mat.userData.uMotion;
      shader.uniforms.uColor = mat.userData.uColor;
      // pass view-space normal + position to the fragment shader for fresnel
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n varying vec3 vN; varying vec3 vVP;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\n vN = normalize(normalMatrix * objectNormal);\n vVP = -mvPosition.xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n uniform float uTime; uniform int uMotion; uniform vec3 uColor; varying vec3 vN; varying vec3 vVP;')
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          float fres = pow(1.0 - clamp(dot(normalize(vN), normalize(vVP)), 0.0, 1.0), 2.0);
          float breath = (uMotion == 0) ? (0.8 + 0.25*sin(uTime*1.4)) : 1.0;
          float spark = (uMotion == 4) ? (0.7 + 0.5*abs(sin(uTime*7.0))) : 1.0;
          float glow = (0.35 + 1.15*fres) * breath * spark;
          gl_FragColor = vec4(uColor * glow, clamp(glow, 0.12, 0.95));
        `);
    };
    mat.needsUpdate = true;
    return mat;
  }

  // preload the rig template (call early so first body appears fast)
  RP.preload = async function (mods) { try { await _loadRigTemplate(mods); } catch (_) {} };

  global.RiggedPresence = RP;
})(window);
