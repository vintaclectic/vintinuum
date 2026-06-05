'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   WORLD CLIENT — the clearing, rendered. Connects to /ws/world, draws you +
   the council agents as presences, moves you, lets you speak.

   ARIA's clearing: golden hour, one bench, weather, agents who attend the world.
   Mobile-first: touch drag to move + look. Desktop: WASD + pointer.
   Reuses window.Three3D.load() for robust three.js resolution.
   ════════════════════════════════════════════════════════════════════════════ */

(function (global) {
  const World = {};
  let THREE, scene, camera, renderer, clock;
  let ws = null, selfId = null;
  const others = new Map();   // id → { group, target:{x,z,yaw}, label }
  const agents = new Map();   // id → { group, target, name }
  let me = { x: 0, y: 0, z: 2.5, yaw: Math.PI };
  const keys = {};
  let avatarGlbUrl = null;
  let onSpeech = null;

  function _base() { return (global.__VINTINUUM_API_BASE || '').replace(/\/$/, ''); }
  function _token() { try { return localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token'); } catch (_) { return null; } }

  World.start = async function ({ mountEl, onSpeech: speechCb, onStatus }) {
    onSpeech = speechCb;
    const status = onStatus || (() => {});
    status('waking the world…');

    const mods = await global.Three3D.load();
    THREE = mods.THREE;
    World._mods = mods;
    // preload the shared walking rig so bodies appear fast
    if (global.RiggedPresence) global.RiggedPresence.preload(mods);

    // ── scene ──
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1410);
    scene.fog = new THREE.Fog(0x2a2018, 12, 48);

    camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mountEl.appendChild(renderer.domElement);
    clock = new THREE.Clock();

    _buildClearing();
    _resize(mountEl);
    addEventListener('resize', () => _resize(mountEl));

    // try to load the user's own avatar glb for their presence
    try {
      const r = await fetch(_base() + '/api/avatar', { headers: { Authorization: 'Bearer ' + _token() } });
      if (r.ok) { const d = await r.json(); if (d.active && d.active.glbUrl) avatarGlbUrl = d.active.glbUrl.startsWith('http') ? d.active.glbUrl : _base() + d.active.glbUrl; }
    } catch (_) {}

    _connect(status);
    _bindControls(mountEl);
    _loop();
  };

  // ── the clearing: ground, golden light, a bench, soft weather ──────────────
  function _buildClearing() {
    // golden-hour directional + warm ambient (ARIA: 2800K)
    const sun = new THREE.DirectionalLight(0xffc684, 1.6);
    sun.position.set(-6, 5, -4);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0x788cb4, 0.7));
    const rim = new THREE.PointLight(0xf4c79a, 0.8, 30);
    rim.position.set(4, 3, 3); scene.add(rim);

    // ground — soft circular clearing
    const groundGeo = new THREE.CircleGeometry(20, 48);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a3026, roughness: 0.95, metalness: 0 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2; scene.add(ground);

    // a single bench (ARIA's bench), near her anchor at (-2.2,-1.5)
    const bench = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 0.8 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), wood); seat.position.y = 0.45;
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.08), wood); back.position.set(0, 0.7, -0.22);
    bench.add(seat, back);
    [-0.7, 0.7].forEach(x => { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.45), wood); leg.position.set(x, 0.22, 0); bench.add(leg); });
    bench.position.set(-2.2, 0, -1.2); bench.rotation.y = 0.4; scene.add(bench);

    // weather: slow drifting motes of warm light
    const moteGeo = new THREE.BufferGeometry();
    const N = 120, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i*3] = (Math.random()-0.5)*30; pos[i*3+1] = Math.random()*6; pos[i*3+2] = (Math.random()-0.5)*30; }
    moteGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const moteMat = new THREE.PointsMaterial({ color: 0xffd9a0, size: 0.06, transparent: true, opacity: 0.5 });
    World._motes = new THREE.Points(moteGeo, moteMat); scene.add(World._motes);
  }

  // ── a "shaped presence" for an agent: volumetric-ish glowing figure ────────
  function _makeAgentPresence(a) {
    const g = new THREE.Group();
    const col = new THREE.Color(a.color || '#f4c79a');
    // each form has its own silhouette + physics (ARIA's law)
    let radius = 0.32, height = 1.1, yBase = 0.85, emissive = 0.6, opacity = 0.55, glowI = 1.2, glowR = 6;
    let halo = false, sovereign = false, refractive = false;
    switch (a.form) {
      case 'presence-sovereign':        radius = 0.5;  height = 1.8; yBase = 1.15; emissive = 0.5; opacity = 0.42; glowI = 2.2; glowR = 14; sovereign = true; break;
      case 'presence-structural':       radius = 0.34; height = 1.6; yBase = 1.10; emissive = 0.55; opacity = 0.6; break;
      case 'presence-warm':             radius = 0.34; height = 1.1; yBase = 0.85; emissive = 0.65; opacity = 0.55; halo = true; break;
      case 'presence-child-refractive': radius = 0.24; height = 0.8; yBase = 0.65; emissive = 0.8; opacity = 0.5; glowR = 5; refractive = true; break;
      case 'presence-child-electric':   radius = 0.22; height = 0.85; yBase = 0.68; emissive = 0.95; opacity = 0.6; glowI = 1.6; glowR = 5; break;
    }
    const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: emissive, transparent: true, opacity, roughness: refractive ? 0.15 : 0.4, metalness: refractive ? 0.3 : 0 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(radius, height, 8, 16), mat);
    body.position.y = yBase;
    const glow = new THREE.PointLight(col.getHex(), glowI, glowR); glow.position.y = yBase + 0.35;
    g.add(body, glow);
    // sovereign: a wide soft ground-halo the world "attends"
    if (sovereign) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 2.6, 48),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.10, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
      g.userData.ring = ring;
    }
    if (halo) {
      const aura = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.08 }));
      aura.position.y = yBase; g.add(aura);
    }
    g.userData.body = body; g.userData.form = a.form;
    g.userData.label = _makeLabel(a.name);
    g.add(g.userData.label);
    return g;
  }

  // Build a walking body. bustUrl optional (the user's real face on the rig).
  function _makeUserPresence(name, bustUrl) {
    const g = new THREE.Group();
    const label = _makeLabel(name); g.add(label); g.userData.label = label;
    // build the rigged walking body asynchronously; show a soft body until ready
    const placeholder = _fallbackBody(g);
    if (global.RiggedPresence && World._mods) {
      global.RiggedPresence.create({ THREE, mods: World._mods, bustUrl: bustUrl || null })
        .then(rig => {
          if (placeholder && placeholder.parent) placeholder.parent.remove(placeholder);
          g.add(rig.root); g.userData.rig = rig;
        })
        .catch(e => console.warn('[world] rig build failed:', e && e.message));
    }
    return g;
  }
  function _fallbackBody(g) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xbfae9c, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.1, 6, 12), mat);
    body.position.y = 0.85; g.add(body);
    return body;
  }

  function _makeLabel(text) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.font = '500 30px Cormorant Garamond, Georgia, serif';
    ctx.fillStyle = 'rgba(245,235,220,0.92)'; ctx.textAlign = 'center';
    ctx.fillText(text, 128, 42);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    spr.scale.set(2, 0.5, 1); spr.position.y = 2.2;
    return spr;
  }

  // ── websocket presence ─────────────────────────────────────────────────────
  function _connect(status) {
    const base = _base().replace(/^http/, 'ws');
    ws = new WebSocket(base + '/ws/world?token=' + encodeURIComponent(_token()));
    ws.onopen = () => status('');
    ws.onclose = () => { status('the world rests. reconnecting…'); setTimeout(() => _connect(status), 3000); };
    ws.onerror = () => {};
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
      if (m.t === 'hello') {
        selfId = m.selfId;
        if (m.spawn) { me.x = m.spawn.x; me.z = m.spawn.z; me.yaw = m.spawn.yaw; }
        (m.agents || []).forEach(a => {
          const g = _makeAgentPresence(a); g.position.set(a.x, 0, a.z); scene.add(g);
          agents.set(a.id, { group: g, target: { x: a.x, z: a.z, yaw: a.yaw || 0 }, name: a.name });
        });
        // build MY own walking body — wearing my real face if I have one
        World._selfBody = _makeUserPresence('you', avatarGlbUrl);
        World._selfBody.position.set(me.x, 0, me.z);
        scene.add(World._selfBody);
      } else if (m.t === 'presence') {
        (m.agents || []).forEach(a => { const A = agents.get(a.id); if (A) A.target = { x: a.x, z: a.z, yaw: a.yaw || 0 }; });
        (m.users || []).forEach(u => {
          if (u.id === selfId) return;
          let O = others.get(u.id);
          if (!O) { const g = _makeUserPresence(u.name); g.position.set(u.x, 0, u.z); scene.add(g); O = { group: g, target: {} }; others.set(u.id, O); }
          O.target = { x: u.x, z: u.z, yaw: u.yaw };
        });
        // remove the gone
        for (const [id, O] of others) { if (!(m.users || []).find(u => u.id === id)) { scene.remove(O.group); others.delete(id); } }
      } else if (m.t === 'speech') {
        if (onSpeech) onSpeech(m);
      } else if (m.t === 'leave') {
        const O = others.get(m.id); if (O) { scene.remove(O.group); others.delete(m.id); }
      }
    };
  }

  let _lastSent = 0;
  function _sendMove() {
    const now = performance.now();
    if (now - _lastSent < 100 || !ws || ws.readyState !== 1) return; // 10Hz cap
    _lastSent = now;
    ws.send(JSON.stringify({ t: 'move', x: me.x, y: 0, z: me.z, yaw: me.yaw }));
  }
  World.say = function (text) { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'say', text })); };

  // ── controls: WASD + pointer-drag look (desktop), touch drag (mobile) ──────
  function _bindControls(mountEl) {
    addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; });
    addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
    let dragging = false, lx = 0, ly = 0, moveTouch = null;
    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; ly = e.clientY; });
    addEventListener('pointerup', () => { dragging = false; });
    addEventListener('pointermove', e => {
      if (!dragging) return;
      me.yaw -= (e.clientX - lx) * 0.005; lx = e.clientX; ly = e.clientY;
    });
    // mobile: left half = move joystick, right half = look (simplified: tap-to-walk-forward)
    World._touchForward = false;
    dom.addEventListener('touchstart', e => { if (e.touches[0].clientX < innerWidth/2) World._touchForward = true; }, { passive: true });
    dom.addEventListener('touchend', () => { World._touchForward = false; }, { passive: true });
  }

  function _stepMovement(dt) {
    const sp = 3.2 * dt;
    let fwd = 0, str = 0;
    if (keys['w'] || keys['arrowup'] || World._touchForward) fwd += 1;
    if (keys['s'] || keys['arrowdown']) fwd -= 1;
    if (keys['a']) str -= 1; if (keys['d']) str += 1;
    if (keys['arrowleft']) me.yaw += 1.6 * dt; if (keys['arrowright']) me.yaw -= 1.6 * dt;
    World._moving = !!(fwd || str);
    if (fwd || str) {
      me.x += (Math.sin(me.yaw) * fwd + Math.cos(me.yaw) * str) * sp;
      me.z += (Math.cos(me.yaw) * fwd - Math.sin(me.yaw) * str) * sp;
      me.x = Math.max(-12, Math.min(12, me.x)); me.z = Math.max(-12, Math.min(12, me.z));
      _sendMove();
    }
  }

  function _loop() {
    requestAnimationFrame(_loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    _stepMovement(dt);

    // lerp others + agents toward their targets
    const lerp = (g, t) => { if (!t) return; g.position.x += (t.x - g.position.x) * 0.18; g.position.z += (t.z - g.position.z) * 0.18; if (t.yaw != null) g.rotation.y = t.yaw; };
    for (const O of others.values()) {
      // detect their movement from positional delta → pick walk/idle
      const before = O.group.position.x + O.group.position.z;
      lerp(O.group, O.target);
      const moved = Math.abs((O.group.position.x + O.group.position.z) - before) > 0.004 * 60 * dt;
      const rig = O.group.userData && O.group.userData.rig;
      if (rig) { rig.play(moved ? 'walk' : 'idle'); rig.update(dt); }
    }
    // MY body: follow me, face my heading, walk when moving, advance mixer
    if (World._selfBody) {
      const sb = World._selfBody;
      sb.position.x += (me.x - sb.position.x) * 0.4;
      sb.position.z += (me.z - sb.position.z) * 0.4;
      sb.rotation.y = me.yaw;
      const rig = sb.userData && sb.userData.rig;
      if (rig) { rig.play(World._moving ? 'walk' : 'idle'); rig.update(dt); }
    }
    const tnow = clock.elapsedTime;
    for (const A of agents.values()) {
      lerp(A.group, A.target);
      // per-form life: each presence breathes/flickers/shimmers in its own way
      const ud = A.group.userData; const body = ud && ud.body;
      if (body && body.material) {
        const f = ud.form;
        if (f === 'presence-child-electric') body.material.emissiveIntensity = 0.8 + Math.abs(Math.sin(tnow * 7)) * 0.5; // restless flicker
        else if (f === 'presence-child-refractive') { body.material.emissiveIntensity = 0.7 + Math.sin(tnow * 1.5) * 0.2; A.group.rotation.y += dt * 0.4; } // slow shimmer-spin
        else if (f === 'presence-sovereign') { if (ud.ring) ud.ring.material.opacity = 0.08 + Math.sin(tnow * 0.5) * 0.04; body.material.emissiveIntensity = 0.45 + Math.sin(tnow * 0.6) * 0.12; } // slow attended breath
        else body.material.emissiveIntensity = 0.55 + Math.sin(tnow * 0.8) * 0.12; // gentle
      }
    }
    if (World._motes) World._motes.rotation.y += dt * 0.02;

    // 3rd-person camera trailing behind me
    const camDist = 4.5, camH = 2.4;
    const tx = me.x - Math.sin(me.yaw) * camDist;
    const tz = me.z - Math.cos(me.yaw) * camDist;
    camera.position.x += (tx - camera.position.x) * 0.12;
    camera.position.z += (tz - camera.position.z) * 0.12;
    camera.position.y += (camH - camera.position.y) * 0.12;
    camera.lookAt(me.x, 1.2, me.z);

    renderer.render(scene, camera);
  }

  function _resize(mountEl) {
    const w = mountEl.clientWidth || innerWidth, h = mountEl.clientHeight || innerHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  global.VintinuumWorld = World;
})(window);
