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
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (innerWidth < 720);
    renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2)); // helios: cap DPR on mobile
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    World._isMobile = isMobile;
    mountEl.appendChild(renderer.domElement);
    // pause rendering when the tab is hidden (zero GPU when not looking)
    document.addEventListener('visibilitychange', () => { World._hidden = (document.visibilityState !== 'visible'); });
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
    // golden-hour, but bright enough to SEE the bodies clearly
    const sun = new THREE.DirectionalLight(0xffe0b0, 3.2);
    sun.position.set(-5, 7, 3);          // front-ish key so faces/bodies are lit
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xa9c0e0, 1.4); // cool fill from the other side
    fill.position.set(5, 3, -4); scene.add(fill);
    scene.add(new THREE.AmbientLight(0x9aa8c0, 1.5));        // lift the shadows
    const rim = new THREE.PointLight(0xffd9a0, 1.6, 40);
    rim.position.set(0, 4, 6); scene.add(rim);               // warm rim toward camera

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

  // ── a shaped PRESENCE for a council agent: a constellation of warm light
  //    skinned to the same rig as bodies, so it stands/walks like a person made
  //    of light (ARIA's spec). Each member differs by color/density/size/motion.
  const PRESENCE_CFG = {
    'presence-sovereign':        { color: '#ffd89a', count: 1800, pointSize: 4.0, motion: 'breath', scale: 1.15, glow: 1.8, glowR: 10, ring: true },
    'presence-structural':       { color: '#9fc4e6', count: 1400, pointSize: 3.2, motion: 'lattice', scale: 1.08, glow: 1.2, glowR: 8 },
    'presence-warm':             { color: '#ffc79a', count: 1500, pointSize: 3.6, motion: 'breath', scale: 1.0, glow: 1.4, glowR: 8, aura: true },
    'presence-child-refractive': { color: '#9ae0d0', count: 1000, pointSize: 2.8, motion: 'orbit', scale: 0.9, glow: 1.0, glowR: 5 },
    'presence-child-electric':   { color: '#ffaad8', count: 1100, pointSize: 2.6, motion: 'spark', scale: 0.9, glow: 1.2, glowR: 5 },
  };

  function _makeAgentPresence(a) {
    const g = new THREE.Group();
    const cfg = PRESENCE_CFG[a.form] || PRESENCE_CFG['presence-warm'];
    const col = new THREE.Color(cfg.color);
    g.scale.setScalar(cfg.scale);

    // a soft glow so the presence lights its surroundings
    const glow = new THREE.PointLight(col.getHex(), cfg.glow, cfg.glowR); glow.position.y = 1.1; g.add(glow);

    // build the light-figure (particle cloud on the rig) asynchronously
    if (global.RiggedPresence && World._mods) {
      global.RiggedPresence.create({ THREE, mods: World._mods, opts: { cloud: cfg } })
        .then(rig => { g.add(rig.root); g.userData.rig = rig; })
        .catch(e => console.warn('[world] presence build failed:', e && e.message));
    }

    // sovereign: a wide soft ground-halo the world attends
    if (cfg.ring) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 2.4, 48),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.10, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
      g.userData.ring = ring;
    }
    if (cfg.aura) {
      const aura = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 16),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false }));
      aura.position.y = 1.0; g.add(aura);
    }

    g.userData.form = a.form;
    g.userData.label = _makeLabel(a.name);
    g.add(g.userData.label);
    return g;
  }

  // Build a walking body. bustUrl optional (the user's real face on the rig).
  function _makeUserPresence(name, bustUrl) {
    const g = new THREE.Group();
    const label = _makeLabel(name); g.add(label); g.userData.label = label;
    const placeholder = _fallbackBody(g);
    g.userData.placeholder = placeholder;
    _attachRig(g, bustUrl, 0);
    return g;
  }

  // attach the rig, retrying if mods/RiggedPresence aren't ready yet (race-proof)
  function _attachRig(g, bustUrl, tries) {
    if (g.userData.rig) return;
    if (!(global.RiggedPresence && World._mods)) {
      if (tries < 40) return void setTimeout(() => _attachRig(g, bustUrl, tries + 1), 150);
      return console.warn('[world] rig deps never ready');
    }
    global.RiggedPresence.create({ THREE, mods: World._mods, bustUrl: bustUrl || null })
      .then(rig => {
        const ph = g.userData.placeholder;
        if (ph && ph.parent) ph.parent.remove(ph);
        g.userData.placeholder = null;
        g.add(rig.root); g.userData.rig = rig;
        console.log('[world] rig attached' + (bustUrl ? ' (with face)' : ''));
      })
      .catch(e => console.warn('[world] rig build failed:', e && (e.message || e)));
  }

  // a small, human-scaled soft body shown only until the rig loads (NOT a giant pill)
  function _fallbackBody(g) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xbfae9c, roughness: 0.7, transparent: true, opacity: 0.6 });
    const grp = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.6, 6, 12), mat); torso.position.y = 1.0;
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), mat); headM.position.y = 1.55;
    grp.add(torso, headM); g.add(grp);
    return grp;
  }

  function _makeLabel(text) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = 512, H = 128;
    const c = document.createElement('canvas'); c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    ctx.font = '600 46px Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // crisp single render: a dark stroke outline (not blur) for legibility, then fill
    const s = String(text || '').toUpperCase();
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineJoin = 'round';
    ctx.strokeText(s, W / 2, H / 2);
    ctx.fillStyle = '#fbf2e4';
    ctx.fillText(s, W / 2, H / 2);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    spr.renderOrder = 999;
    spr.scale.set(1.5, 0.375, 1); spr.position.y = 2.4;
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
        World._selfName = m.selfName || 'you';
        if (m.spawn) { me.x = m.spawn.x; me.z = m.spawn.z; me.yaw = m.spawn.yaw; }
        // idempotent: clear any prior agents/self (reconnect must not duplicate them)
        for (const A of agents.values()) scene.remove(A.group);
        agents.clear();
        if (World._selfBody) { scene.remove(World._selfBody); World._selfBody = null; }
        (m.agents || []).forEach(a => {
          const g = _makeAgentPresence(a); g.position.set(a.x, 0, a.z); scene.add(g);
          agents.set(a.id, { group: g, target: { x: a.x, z: a.z, yaw: a.yaw || 0 }, name: a.name });
        });
        // build MY own walking body — labeled with my real username (DirHaven), not "you"
        World._selfBody = _makeUserPresence(World._selfName, avatarGlbUrl);
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
      } else if (m.t === 'offer') {
        if (World._onOffer) World._onOffer(m);
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
    ws.send(JSON.stringify({ t: 'move', x: me.x, y: (me.y || 0), z: me.z, yaw: me.yaw }));
  }
  World.say = function (text) { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'say', text })); };
  World.onOffer = function (cb) { World._onOffer = cb; };
  // mobile control hooks (run/jump buttons in world.html)
  World.setRun = function (on) { World._touchRun = !!on; };
  World.jump = function () { World._touchJump = true; };

  // ── controls: WASD+QE+Shift+Space + pointer-drag look (desktop), touch (mobile)
  const MOVE_KEYS = { 'w':1,'a':1,'s':1,'d':1,'q':1,'e':1,' ':1,'shift':1,'arrowup':1,'arrowdown':1,'arrowleft':1,'arrowright':1 };
  function _bindControls(mountEl) {
    addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      // don't hijack typing in the say box
      if (document.activeElement && /input|textarea/i.test(document.activeElement.tagName)) return;
      keys[k] = true;
      if (MOVE_KEYS[k]) e.preventDefault(); // stop Space scrolling, arrows panning
    }, { passive: false });
    addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
    let dragging = false, lx = 0;
    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', e => { dragging = true; lx = e.clientX; });
    addEventListener('pointerup', () => { dragging = false; });
    addEventListener('pointermove', e => { if (!dragging) return; me.yaw -= (e.clientX - lx) * 0.005; lx = e.clientX; });

    // mobile: drag the left half to steer+walk; on-screen run/jump buttons (wired in world.html)
    World._touchForward = false; World._touchRun = false; World._touchJump = false;
    let mt = null, mx0 = 0, my0 = 0;
    dom.addEventListener('touchstart', e => {
      const t = e.touches[0];
      if (t.clientX < innerWidth * 0.55) { mt = t.identifier; mx0 = t.clientX; my0 = t.clientY; World._touchForward = true; }
    }, { passive: true });
    dom.addEventListener('touchmove', e => {
      for (const t of e.touches) if (t.identifier === mt) {
        // horizontal drag steers, vertical sets forward/back
        me.yaw -= (t.clientX - mx0) * 0.006; mx0 = t.clientX;
        const dyv = t.clientY - my0;
        World._touchForward = dyv < 20; keys['s'] = dyv > 40 ? true : false;
      }
    }, { passive: true });
    dom.addEventListener('touchend', e => { mt = null; World._touchForward = false; keys['s'] = false; }, { passive: true });
  }

  // ── locomotion physics: momentum, run, jump, speed-matched gait ────────────
  const MOVE = { vx: 0, vz: 0, vy: 0, speed: 0, grounded: true, gait: 'idle', gaitRate: 1 };
  const WALK_SPEED = 2.8, RUN_SPEED = 6.4, ACCEL = 22, FRICTION = 14, TURN_RATE = 2.4;
  const JUMP_V = 5.2, GRAVITY = 16;

  function _stepMovement(dt) {
    let fwd = 0, str = 0;
    if (keys['w'] || keys['arrowup'] || World._touchForward) fwd += 1;
    if (keys['s'] || keys['arrowdown']) fwd -= 1;
    if (keys['a']) str -= 1; if (keys['d']) str += 1;
    // turn with Q/E or arrow-left/right (look-drag also turns yaw)
    if (keys['arrowleft'] || keys['q']) me.yaw += TURN_RATE * dt;
    if (keys['arrowright'] || keys['e']) me.yaw -= TURN_RATE * dt;

    const running = (keys['shift'] || World._touchRun);
    const maxSpeed = running ? RUN_SPEED : WALK_SPEED;

    // desired velocity in world space from input, relative to facing
    let dx = 0, dz = 0;
    if (fwd || str) {
      const len = Math.hypot(fwd, str) || 1;
      const f = fwd / len, s = str / len;
      dx = (Math.sin(me.yaw) * f + Math.cos(me.yaw) * s);
      dz = (Math.cos(me.yaw) * f - Math.sin(me.yaw) * s);
    }
    const targetVx = dx * maxSpeed, targetVz = dz * maxSpeed;
    // accelerate toward target (momentum), friction when no input
    const a = (fwd || str) ? ACCEL : FRICTION;
    MOVE.vx += (targetVx - MOVE.vx) * Math.min(1, a * dt);
    MOVE.vz += (targetVz - MOVE.vz) * Math.min(1, a * dt);

    // jump + gravity (the up/down)
    if ((keys[' '] || keys['spacebar'] || World._touchJump) && MOVE.grounded) { MOVE.vy = JUMP_V; MOVE.grounded = false; World._touchJump = false; }
    if (!MOVE.grounded) { MOVE.vy -= GRAVITY * dt; me.y = (me.y || 0) + MOVE.vy * dt; if (me.y <= 0) { me.y = 0; MOVE.vy = 0; MOVE.grounded = true; } }

    me.x += MOVE.vx * dt; me.z += MOVE.vz * dt;
    me.x = Math.max(-13, Math.min(13, me.x)); me.z = Math.max(-13, Math.min(13, me.z));

    MOVE.speed = Math.hypot(MOVE.vx, MOVE.vz);
    World._moving = MOVE.speed > 0.15;

    // choose gait + animation rate matched to actual speed (no foot-sliding)
    if (!MOVE.grounded) { MOVE.gait = 'run'; MOVE.gaitRate = 1; }
    else if (MOVE.speed > WALK_SPEED + 0.6) { MOVE.gait = 'run'; MOVE.gaitRate = MOVE.speed / RUN_SPEED; }
    else if (MOVE.speed > 0.2) { MOVE.gait = 'walk'; MOVE.gaitRate = Math.max(0.5, MOVE.speed / WALK_SPEED); }
    else { MOVE.gait = 'idle'; MOVE.gaitRate = 1; }

    if (World._moving || !MOVE.grounded || Math.abs(me.yaw - (World._lastYaw||0)) > 0.01) {
      World._lastYaw = me.yaw; _sendMove();
    }
  }

  function _loop() {
    requestAnimationFrame(_loop);
    if (World._hidden) return;                        // zero GPU when tab hidden
    const dt = Math.min(clock.getDelta(), 0.05);
    _stepMovement(dt);
    const camPos = camera.position;

    // lerp others toward their targets (with jump height + smooth facing)
    const lerp = (g, t) => {
      if (!t) return;
      g.position.x += (t.x - g.position.x) * 0.18;
      g.position.z += (t.z - g.position.z) * 0.18;
      if (t.y != null) g.position.y += (t.y - g.position.y) * 0.3;
      if (t.yaw != null) { let d = t.yaw - g.rotation.y; while (d>Math.PI) d-=Math.PI*2; while (d<-Math.PI) d+=Math.PI*2; g.rotation.y += d * Math.min(1, 12*dt); }
    };
    for (const O of others.values()) {
      // estimate their speed from positional delta → walk vs run vs idle
      const px = O.group.position.x, pz = O.group.position.z;
      lerp(O.group, O.target);
      const moved = Math.hypot(O.group.position.x - px, O.group.position.z - pz) / Math.max(dt, 0.001);
      const rig = O.group.userData && O.group.userData.rig;
      if (rig) {
        const gait = moved > 4.5 ? 'run' : (moved > 0.3 ? 'walk' : 'idle');
        rig.play(gait);
        if (rig.setRate) rig.setRate(gait === 'run' ? Math.max(0.6, moved/RUN_SPEED) : (gait === 'walk' ? Math.max(0.5, moved/WALK_SPEED) : 1));
        rig.update(dt);
      }
    }
    // MY body: follow me, smooth-face heading, gait matched to speed, jump height
    if (World._selfBody) {
      const sb = World._selfBody;
      sb.position.x += (me.x - sb.position.x) * 0.5;
      sb.position.z += (me.z - sb.position.z) * 0.5;
      sb.position.y = (me.y || 0);
      // smoothly rotate body toward facing (no snap)
      let dy = me.yaw - sb.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      sb.rotation.y += dy * Math.min(1, 12 * dt);
      const rig = sb.userData && sb.userData.rig;
      if (rig) {
        rig.play(MOVE.gait);
        if (rig.setRate) rig.setRate(MOVE.gaitRate);
        rig.update(dt);
      }
    }
    const tnow = clock.elapsedTime;
    for (const A of agents.values()) {
      lerp(A.group, A.target);
      const ud = A.group.userData;
      // LOD: distant agents update their animation at a lower rate (helios's perf pass)
      const dist = Math.hypot(A.group.position.x - camPos.x, A.group.position.z - camPos.z);
      if (ud && ud.rig) {
        const near = dist < 14;
        // far agents: tick every 3rd frame with scaled dt (still alive, cheaper)
        if (near || (World._frame % 3 === 0)) { ud.rig.play('idle'); ud.rig.update(near ? dt : dt * 3); }
      }
      if (ud && ud.ring) ud.ring.material.opacity = 0.08 + Math.sin(tnow * 0.5) * 0.04;
    }
    World._frame = (World._frame || 0) + 1;
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
