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

  // Create a walking presence. If bustUrl is given, mount the bust on the head.
  RP.create = async function ({ THREE, mods, bustUrl }) {
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

    const handle = { root, mixer, actions, _current: null, isRigged: true, bust: null };

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
    handle.update = function (dt) { mixer.update(dt); };
    handle.dispose = function () { mixer.stopAllAction(); };

    // start idle
    handle.play('idle', 0);
    return handle;
  };

  // preload the rig template (call early so first body appears fast)
  RP.preload = async function (mods) { try { await _loadRigTemplate(mods); } catch (_) {} };

  global.RiggedPresence = RP;
})(window);
