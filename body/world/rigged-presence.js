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
  RP.create = async function ({ THREE, mods, bustUrl, headAdjust = null, opts = {} }) {
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
      // KEEP the robot body visible — we mount the user's face as the HEAD, on the
      // same walking body everyone has. (Vinta: "that face should become the face
      // of the robot body you built for all users.")
      try {
        const bustGltf = await new Promise((res, rej) => new mods.GLTFLoader().load(bustUrl, res, undefined, rej));
        const bust = bustGltf.scene;
        bust.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.renderOrder = 1; } });

        const mount = headBone || neckBone;
        if (mount) {
          // ── MOLD THE HEAD INTO THE BODY (Vinta directive 2026-06-15) ──────────
          // The old code overlaid the Hunyuan bust (head+neck+shoulders) ON TOP of
          // the robot at 2x scale → it read as "a square chunk plopped on the body".
          // Now we MOLD it: scale the generated head so its HEAD region matches the
          // rig's head, hide the robot's head verts so the real face *replaces* the
          // head (not floats over it), trim the bust's shoulders so they don't
          // double the robot's shoulders, and add a tone-matched neck collar to
          // hide the seam. The result is one continuous figure with their face.
          let headTopY = null;
          root.traverse(o => { if (o.isBone && /HeadTop/i.test(o.name)) { o.updateWorldMatrix(true, false); headTopY = o.getWorldPosition(new THREE.Vector3()).y; } });
          mount.updateWorldMatrix(true, false);
          const headBaseY = mount.getWorldPosition(new THREE.Vector3()).y;
          const headHeight = (headTopY != null) ? Math.max(0.12, headTopY - headBaseY) : 0.22;

          // Measure the generated mesh on ALL axes.
          const box = new THREE.Box3().setFromObject(bust);
          const dim = box.getSize(new THREE.Vector3());
          const meshH = Math.max(0.001, dim.y);
          const meshW = Math.max(0.001, dim.x);
          const meshD = Math.max(0.001, dim.z);
          const maxDim = Math.max(meshH, meshW, meshD);
          const minDim = Math.max(0.0001, Math.min(meshH, meshW, meshD));

          // SANITY GATE: a real head/bust is roughly head-shaped — its largest
          // dimension is at most ~3x its smallest. A degenerate generation (bad
          // input photo) comes back as a flat/stretched slab with a huge aspect
          // ratio. If so, DO NOT mount it as a head (that's the world-spanning
          // slab bug) — bail to the clean default robot head.
          const aspect = maxDim / minDim;
          if (aspect > 4.0 || !isFinite(aspect)) {
            console.warn('[rigged-presence] generated head is degenerate (aspect ' + aspect.toFixed(1) + ') — keeping default head');
            try { bust.traverse(o => { if (o.geometry) o.geometry.dispose && o.geometry.dispose(); }); } catch (_) {}
            handle.bust = null;
            handle._headDegenerate = true;
          } else {
          // FIT the WHOLE mesh inside a head-sized box (scale by the LARGEST
          // dimension, not just height) so a wide/deep mesh can never sprawl.
          // Target: the head fills ~1.25 head-heights at its largest extent.
          const targetMax = headHeight * 1.25;
          const sLocal = targetMax / maxDim;
          const headScale = mount.getWorldScale(new THREE.Vector3()).y || 1;
          const s = sLocal / headScale;
          bust.scale.setScalar(s);

          // Seat it: center horizontally on the head bone, sink it so the head
          // sits AT the head and the neck flows into the body.
          const center = box.getCenter(new THREE.Vector3());
          bust.position.set(-center.x * s, -box.min.y * s - headHeight * 0.45, -center.z * s);

          // Capture the molded base transform so the live editor can re-seat from
          // it (preview without rebuilding the rig).
          handle._baseBust = {
            scale: { x: bust.scale.x, y: bust.scale.y, z: bust.scale.z },
            pos:   { x: bust.position.x, y: bust.position.y, z: bust.position.z },
            rotY:  bust.rotation.y,
          };

          // Apply the user's head-editor overrides on top of the molded base
          // (offsetY/offsetX in head-heights, scale multiplier, rotY radians).
          if (headAdjust) {
            const aS = Math.max(0.6, Math.min(1.8, +headAdjust.scale || 1));
            bust.scale.multiplyScalar(aS);
            bust.position.y += (+headAdjust.offsetY || 0) * headHeight;
            bust.position.x += (+headAdjust.offsetX || 0) * headHeight;
            bust.rotation.y += (+headAdjust.rotY || 0);
            handle._headAdjust = headAdjust;
          }
          handle._headBaseHeight = headHeight;

          // Hide the robot's HEAD region so the real face replaces it.
          _hideRigHead(THREE, root, mount);

          // Tone-matched neck collar — bridges face→body so there's no gap.
          try {
            const collar = _makeNeckCollar(THREE, bust, headHeight, s);
            if (collar) mount.add(collar);
          } catch (_) {}

          mount.add(bust);
          handle.bust = bust;
          } // end non-degenerate mount
        } else {
          bust.position.y = 1.55; bust.scale.setScalar(0.4); root.add(bust);
          handle.bust = bust;
        }
      } catch (e) {
        console.warn('[rigged-presence] face load failed, robot keeps default head:', e && e.message);
      }
    }

    handle._rate = 1;
    handle.play = function (name, fade = 0.25) {
      const next = actions[name] || actions.idle;
      if (!next) return;
      if (handle._current === next) return;
      next.reset().fadeIn(fade).play();
      next.timeScale = handle._rate;
      if (handle._current) handle._current.fadeOut(fade);
      handle._current = next;
    };
    // match animation playback speed to real movement speed (no foot-sliding)
    handle.setRate = function (rate) {
      handle._rate = Math.max(0.3, Math.min(2.2, rate || 1));
      if (handle._current) handle._current.timeScale = handle._rate;
    };
    handle._t = 0;
    handle.update = function (dt) {
      mixer.update(dt);
      // cheap: just advance the light-figure's breath/spark time uniform (no CPU resample)
      if (handle.lightMat && handle.lightMat.userData.uTime) { handle._t += dt; handle.lightMat.userData.uTime.value = handle._t; }
    };
    handle.dispose = function () { mixer.stopAllAction(); };

    // Live head-editor preview: re-seat the molded head from a fresh adjust
    // object without rebuilding the rig. Used by the head editor sliders.
    handle.setHeadAdjust = function (adj) {
      if (!handle.bust || !handle._baseBust) return;
      const b = handle.bust, base = handle._baseBust, hh = handle._headBaseHeight || 0.22;
      b.scale.set(base.scale.x, base.scale.y, base.scale.z);
      b.position.set(base.pos.x, base.pos.y, base.pos.z);
      b.rotation.y = base.rotY;
      if (adj) {
        b.scale.multiplyScalar(Math.max(0.6, Math.min(1.8, +adj.scale || 1)));
        b.position.y += (+adj.offsetY || 0) * hh;
        b.position.x += (+adj.offsetX || 0) * hh;
        b.rotation.y += (+adj.rotY || 0);
      }
      handle._headAdjust = adj || null;
    };

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

  // ── HEAD-MOLDING HELPERS (Vinta directive 2026-06-15) ────────────────────────
  // Make the generated face REPLACE the robot head and seal the seam so the
  // figure reads as one continuous person, not a chunk on a robot.

  // Hide the rig's own head so the real face replaces it. xbot is a single
  // SkinnedMesh, so we can't delete just head faces cheaply — instead we collapse
  // every vertex weighted primarily to the Head bone to the head-bone origin,
  // which tucks the robot head inside the generated face (invisible under it).
  function _hideRigHead(THREE, root, headBone) {
    try {
      // index of the Head bone within each skinned mesh's skeleton
      root.traverse((o) => {
        if (!o.isSkinnedMesh || !o.skeleton) return;
        const bones = o.skeleton.bones || [];
        const headIdx = bones.findIndex(b => b === headBone || /Head$/.test(b.name));
        if (headIdx < 0) return;
        const geo = o.geometry;
        const skinIndex = geo.getAttribute('skinIndex');
        const skinWeight = geo.getAttribute('skinWeight');
        const pos = geo.getAttribute('position');
        if (!skinIndex || !skinWeight || !pos) return;
        // Clone position so we don't corrupt a shared geometry across clones.
        if (!geo.userData.__moldClonedPos) {
          geo.setAttribute('position', pos.clone());
          geo.userData.__moldClonedPos = true;
        }
        const P = geo.getAttribute('position');
        for (let i = 0; i < P.count; i++) {
          // is this vertex dominated by the head bone? (weight > 0.5 on headIdx)
          let headW = 0;
          for (let k = 0; k < 4; k++) {
            if (skinIndex.getComponent(i, k) === headIdx) headW += skinWeight.getComponent(i, k);
          }
          if (headW > 0.5) {
            // collapse to a point inside the neck — disappears under the real face
            P.setXYZ(i, 0, P.getY(i) * 0.0, 0);
          }
        }
        P.needsUpdate = true;
        geo.computeBoundingSphere();
      });
    } catch (_) { /* non-fatal — face still covers, just less cleanly */ }
  }

  // A short tone-matched collar that bridges the generated neck to the body so
  // there's no floating-head gap. Samples the bust's average lower color.
  function _makeNeckCollar(THREE, bust, headHeight, s) {
    let col = new THREE.Color('#caa68c'); // warm neutral skin fallback
    try {
      // sample an average color from the bust's materials (lower face ≈ neck tone)
      let r = 0, g = 0, b = 0, n = 0;
      bust.traverse((o) => {
        if (o.isMesh && o.material) {
          const m = Array.isArray(o.material) ? o.material[0] : o.material;
          if (m && m.color) { r += m.color.r; g += m.color.g; b += m.color.b; n++; }
        }
      });
      if (n > 0) col.setRGB(r / n, g / n, b / n);
    } catch (_) {}
    const radius = headHeight * 0.34;
    const height = headHeight * 0.42;
    const geo = new THREE.CylinderGeometry(radius * 0.82, radius, height, 20, 1, true);
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide });
    const collar = new THREE.Mesh(geo, mat);
    // seat the collar just below the head bone so it meets the body shoulders
    collar.position.set(0, -headHeight * 0.30, 0);
    collar.renderOrder = 0;
    return collar;
  }

  // preload the rig template (call early so first body appears fast)
  RP.preload = async function (mods) { try { await _loadRigTemplate(mods); } catch (_) {} };

  global.RiggedPresence = RP;
})(window);
