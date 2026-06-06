'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   THE BECOMING — the reveal. HELIOS's #1 spectacle: the moment the point of
   light becomes YOU. This is the screenshot, the post, the "what IS this."

   Choreography (≈9s, after fal generation completes):
     1. a slow-rotating volumetric nebula of warm particles, your face hidden inside
     2. THRESHOLD: the particles converge inward along the face's normals — they
        collapse onto your real generated mesh, chromatic aberration peaking
     3. a still frame of full clarity — your face, lit, holding
     4. the face turns and looks at you
     5. ARIA: "there you are."

   Pure three.js. Reuses window.Three3D.load(). Exposes VintinuumReveal.play.
   ════════════════════════════════════════════════════════════════════════════ */

(function (global) {
  const Reveal = {};

  function _base() { return (global.__VINTINUUM_API_BASE || '').replace(/\/$/, ''); }
  function _token() { try { return localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token'); } catch (_) { return null; } }

  // play({ stage, avatarId }) → resolves when the reveal completes
  Reveal.play = async function ({ stage, avatarId }) {
    const mods = await global.Three3D.load();
    const THREE = mods.THREE;

    // fetch the avatar glb url
    let glbUrl = null;
    try {
      const r = await fetch(_base() + '/api/avatar/' + avatarId, { headers: { Authorization: 'Bearer ' + _token() } });
      if (r.ok) { const d = await r.json(); if (d.glbUrl) glbUrl = d.glbUrl.startsWith('http') ? d.glbUrl : _base() + d.glbUrl; }
    } catch (_) {}
    if (!glbUrl) throw new Error('no avatar url for reveal');

    // ── scene ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0a08);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.05, 2.4);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    stage.appendChild(renderer.domElement);
    const resize = () => { const w = stage.clientWidth || innerWidth, h = stage.clientHeight || innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    resize(); addEventListener('resize', resize);

    // warm lights for the reveal
    const key = new THREE.DirectionalLight(0xffd9a0, 2.2); key.position.set(-1.5, 1.2, 2); scene.add(key);
    scene.add(new THREE.AmbientLight(0x8899bb, 0.5));
    const rim = new THREE.PointLight(0xf4c79a, 1.5, 8); rim.position.set(1.2, 0.5, 1.5); scene.add(rim);

    // ── load the face mesh ──
    const faceGroup = new THREE.Group(); scene.add(faceGroup);
    const gltf = await new Promise((res, rej) => new mods.GLTFLoader().load(glbUrl, res, undefined, rej));
    const face = gltf.scene;
    // frame the bust: center + scale to fill view
    const box = new THREE.Box3().setFromObject(face);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = 1.5 / Math.max(size.y, 0.001);
    face.scale.setScalar(s);
    face.position.set(-center.x * s, -center.y * s, -center.z * s);
    faceGroup.add(face);
    faceGroup.rotation.y = Math.PI;          // start back-turned (ARIA's law)
    faceGroup.visible = false;               // hidden inside the nebula at first

    // sample surface points from the mesh for the convergence particles
    const surfacePts = _sampleSurface(THREE, face, 2600);

    // ── the nebula: particles that will collapse onto the face ──
    const N = surfacePts.length;
    const positions = new Float32Array(N * 3);
    const targets = new Float32Array(N * 3);
    const scatter = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const t = surfacePts[i];
      targets[i*3] = t.x; targets[i*3+1] = t.y; targets[i*3+2] = t.z;
      // start scattered on a wide sphere shell (the nebula)
      const r = 1.4 + Math.random() * 1.2, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      const sx = r * Math.sin(ph) * Math.cos(th), sy = r * Math.cos(ph), sz = r * Math.sin(ph) * Math.sin(th);
      scatter[i*3] = sx; scatter[i*3+1] = sy; scatter[i*3+2] = sz;
      positions[i*3] = sx; positions[i*3+1] = sy; positions[i*3+2] = sz;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffd9a0, size: 0.025, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    const cloud = new THREE.Points(geo, mat); scene.add(cloud);

    // ── timeline ──
    const t0 = performance.now();
    const NEBULA = 2600;        // swirl
    const COLLAPSE = 2200;      // particles converge onto the face
    const CLARITY = 1400;       // hold the still face
    const TURN = 1600;          // face turns to you
    let done = false;
    let resolvePlay;
    const finished = new Promise(r => resolvePlay = r);

    const ease = (x) => 1 - Math.pow(1 - x, 3);
    function frame() {
      if (done) return;
      const now = performance.now(); const t = now - t0;
      requestAnimationFrame(frame);

      if (t < NEBULA) {
        // swirling nebula, face hidden
        cloud.rotation.y = t * 0.0006; cloud.rotation.x = Math.sin(t * 0.0004) * 0.2;
        mat.size = 0.025 + Math.sin(t * 0.003) * 0.008;
      } else if (t < NEBULA + COLLAPSE) {
        // THE COLLAPSE — particles converge onto the face along the surface
        const p = ease(Math.min(1, (t - NEBULA) / COLLAPSE));
        const arr = geo.attributes.position.array;
        for (let i = 0; i < N; i++) {
          arr[i*3]   = scatter[i*3]   + (targets[i*3]   - scatter[i*3])   * p;
          arr[i*3+1] = scatter[i*3+1] + (targets[i*3+1] - scatter[i*3+1]) * p;
          arr[i*3+2] = scatter[i*3+2] + (targets[i*3+2] - scatter[i*3+2]) * p;
        }
        geo.attributes.position.needsUpdate = true;
        cloud.rotation.y += 0.002;
        mat.opacity = 0.85 * (1 - p * 0.6);
        // chromatic peak near the end of collapse → reveal the real face under
        if (p > 0.72 && !faceGroup.visible) { faceGroup.visible = true; }
        if (faceGroup.visible) { face.traverse(o => { if (o.material) o.material.opacity = Math.min(1, (p - 0.72) / 0.28); o.material && (o.material.transparent = true); }); }
      } else if (t < NEBULA + COLLAPSE + CLARITY) {
        // clarity — particles fade, face holds, back still turned
        mat.opacity *= 0.92;
        if (mat.opacity < 0.02) cloud.visible = false;
        face.traverse(o => { if (o.material) { o.material.opacity = 1; o.material.transparent = false; } });
      } else if (t < NEBULA + COLLAPSE + CLARITY + TURN) {
        // the turn — face rotates from back to you
        const p = ease(Math.min(1, (t - NEBULA - COLLAPSE - CLARITY) / TURN));
        faceGroup.rotation.y = Math.PI * (1 - p);   // π → 0 (faces you)
        cloud.visible = false;
      } else if (!done) {
        // landed — face looking at you
        faceGroup.rotation.y = 0;
        done = true;
        // gentle idle breath continues
        _idle(THREE, faceGroup, renderer, scene, camera);
        resolvePlay();
      }
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);

    await finished;
    return true;
  };

  // sample N points on the mesh surface (for the convergence targets)
  function _sampleSurface(THREE, root, N) {
    const pts = [];
    const meshes = [];
    root.updateWorldMatrix(true, true);
    root.traverse(o => { if (o.isMesh && o.geometry) meshes.push(o); });
    if (!meshes.length) return pts;
    // gather all vertex positions in world space, then subsample
    const all = [];
    for (const m of meshes) {
      const pos = m.geometry.attributes.position; if (!pos) continue;
      const v = new THREE.Vector3();
      const step = Math.max(1, Math.floor(pos.count / (N / meshes.length)));
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        all.push({ x: v.x, y: v.y, z: v.z });
      }
    }
    // trim/pad to N
    while (all.length < N && all.length) all.push(all[Math.floor(Math.random() * all.length)]);
    return all.slice(0, N);
  }

  // after the reveal, keep a soft idle render until the page hands off
  function _idle(THREE, group, renderer, scene, camera) {
    let t = 0;
    (function tick() {
      t += 0.016;
      group.position.y = Math.sin(t * 1.2) * 0.006;
      group.rotation.y = Math.sin(t * 0.4) * 0.04;
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    })();
  }

  global.VintinuumReveal = Reveal;
})(window);
