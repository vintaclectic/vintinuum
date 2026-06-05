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
    // body: a soft capsule of colored light
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.32, a.form === 'presence-structural' ? 1.5 : 1.1, 8, 16),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, transparent: true, opacity: 0.55, roughness: 0.4 })
    );
    body.position.y = a.form === 'presence-structural' ? 1.05 : 0.85;
    const glow = new THREE.PointLight(col.getHex(), 1.2, 6); glow.position.y = 1.2;
    g.add(body, glow);
    g.userData.label = _makeLabel(a.name);
    g.add(g.userData.label);
    return g;
  }

  function _makeUserPresence(name) {
    const g = new THREE.Group();
    if (avatarGlbUrl && global.Three3D) {
      // load the real avatar mesh asynchronously
      global.Three3D.load().then(m => {
        const loader = new m.GLTFLoader();
        loader.load(avatarGlbUrl, (gltf) => {
          const root = gltf.scene; root.scale.setScalar(1.0);
          // Hunyuan bust → place at head height, sitting on shoulders
          root.position.y = 0; g.add(root);
        }, undefined, () => _fallbackBody(g));
      }).catch(() => _fallbackBody(g));
    } else { _fallbackBody(g); }
    const label = _makeLabel(name); g.add(label); g.userData.label = label;
    return g;
  }
  function _fallbackBody(g) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xbfae9c, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.1, 6, 12), mat);
    body.position.y = 0.85; g.add(body);
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
    for (const O of others.values()) lerp(O.group, O.target);
    for (const A of agents.values()) lerp(A.group, A.target);
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
