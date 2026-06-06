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

    const handle = { root, mixer, actions, _current: null, isRigged: true, bust: null, cloud: null };

    // PRESENCE CLOUD (ARIA's spec): the council are warm light gathered into a
    // figure — a particle constellation skinned to the SAME bones as xbot, so it
    // walks/idles/sits because the rig does. No mesh, no uncanny flesh — just
    // light organized in the shape of someone standing next to you.
    if (opts.cloud) {
      const cloud = _buildPresenceCloud(THREE, root, opts.cloud);
      if (cloud) {
        root.traverse(o => { if (o.isMesh || o.isSkinnedMesh) o.visible = false; }); // hide xbot mesh
        root.add(cloud);
        handle.cloud = cloud;
      }
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
      if (handle.cloud) {
        handle._t += dt;
        if (handle.cloud.userData.cloudMat) handle.cloud.userData.cloudMat.uniforms.uTime.value = handle._t;
        if (handle.cloud.userData.resample) handle.cloud.userData.resample();
      }
    };
    handle.dispose = function () { mixer.stopAllAction(); };

    // start idle
    handle.play('idle', 0);
    return handle;
  };

  // ── PRESENCE CLOUD — warm light gathered into a figure (ARIA's spec) ─────────
  // Sample N vertices from the rig's SkinnedMesh. Each frame, recompute their
  // DEFORMED world positions via SkinnedMesh.getVertexPosition (real three.js
  // method — bulletproof across versions) and update an additive Points cloud.
  // The constellation walks/idles/sits because we read the skinned bones.
  function _buildPresenceCloud(THREE, root, cfg) {
    let skinned = null;
    root.traverse(o => { if (o.isSkinnedMesh && !skinned) skinned = o; });
    if (!skinned || !skinned.geometry || !skinned.geometry.attributes.position) return null;
    if (typeof skinned.getVertexPosition !== 'function') return null; // need r150+

    const total = skinned.geometry.attributes.position.count;
    const count = Math.min(cfg.count || 900, total);
    const stride = Math.max(1, Math.floor(total / count));
    const vIndices = [];
    for (let i = 0; i < count; i++) vIndices.push((i * stride) % total);

    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = Math.random();

    const cloudGeo = new THREE.BufferGeometry();
    cloudGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    cloudGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    const col = new THREE.Color(cfg.color || '#f4c79a');
    const motion = cfg.motion || 'breath';
    const motionId = { breath: 0, lattice: 1, drift: 2, orbit: 3, spark: 4 }[motion] ?? 0;

    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: col }, uTime: { value: 0 }, uSize: { value: cfg.pointSize || 7.0 }, uMotion: { value: motionId } },
      vertexShader: `
        attribute float aSeed; uniform float uTime; uniform float uSize; uniform int uMotion;
        varying float vSeed;
        void main(){
          vSeed = aSeed;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float breath = (uMotion == 0) ? (0.85 + 0.25*sin(uTime*1.5)) : 1.0;
          gl_PointSize = clamp(uSize * breath * (90.0 / -mvPosition.z), 1.0, 9.0);
          gl_Position = projectionMatrix * mvPosition;
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uTime; uniform int uMotion; varying float vSeed;
        void main(){
          vec2 uv = gl_PointCoord - 0.5; float d = length(uv);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d);
          float tw = (uMotion == 4) ? (0.55 + 0.45*sin(uTime*8.0 + vSeed*40.0)) : 1.0;
          gl_FragColor = vec4(uColor * (1.0 + 0.6*a), a * 0.9 * tw);
        }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });

    const pts = new THREE.Points(cloudGeo, mat);
    pts.frustumCulled = false;
    // resample deformed positions each frame (CPU skinning read — robust)
    const tmp = new THREE.Vector3();
    pts.userData.cloudMat = mat;
    pts.userData.resample = function () {
      const arr = cloudGeo.attributes.position.array;
      for (let i = 0; i < count; i++) {
        skinned.getVertexPosition(vIndices[i], tmp); // deformed LOCAL position
        arr[i*3] = tmp.x; arr[i*3+1] = tmp.y; arr[i*3+2] = tmp.z;
      }
      cloudGeo.attributes.position.needsUpdate = true;
    };
    return pts;
  }

  // preload the rig template (call early so first body appears fast)
  RP.preload = async function (mods) { try { await _loadRigTemplate(mods); } catch (_) {} };

  global.RiggedPresence = RP;
})(window);
