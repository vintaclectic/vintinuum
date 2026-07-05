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
  World._worldId = 'universe';       // DIRVERSE: which room we're in (room-scoped ws)
  World._canBuild = true;            // set from world:state; false for visitors
  let _wsGen = 0;                    // generation guard — a stale ws from before a warp must not touch scene
  const others = new Map();   // id → { group, target:{x,z,yaw}, label }
  const agents = new Map();   // id → { group, target, name }
  let me = { x: 0, y: 0, z: 2.5, yaw: Math.PI };
  const keys = {};
  let avatarGlbUrl = null;
  let onSpeech = null;

  function _base() { return (global.__VINTINUUM_API_BASE || '').replace(/\/$/, ''); }
  function _token() { try { return localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token'); } catch (_) { return null; } }

  // ── THE VISIBILITY CONTRACT (aetherhold ↔ helios overlay) ───────────────────
  // One deterministic "the world is now painted" signal so the overlay/loader
  // swaps on a real event, never a guess or a timer. Each fires AT MOST ONCE per
  // start(). Two signals, delivered THREE redundant ways (status string, window
  // event, resolved promise) so the overlay can bind to whichever it prefers:
  //   onStatus('__READY__')    → first frame painted (guest OR signed-in). The
  //                              loader may be killed here — the clearing is live.
  //   onStatus('__FALLBACK__') → this session is the reduced (ambient-demo)
  //                              experience: a guest, or a signed-in session whose
  //                              live WS never landed inside the deadline.
  //   window 'vint:world-ready'    detail { guest, worldId }
  //   window 'vint:world-fallback' detail { reason, worldId }
  //   VintinuumWorld.ready()       → Promise that resolves on READY.
  // FALLBACK REFINES ready, never replaces it: a guest gets READY on first paint
  // (kill the loader) then FALLBACK when the ambient-demo owns the scene (show the
  // "quiet clearing" invite copy). Signed-in users who connect never see FALLBACK.
  function _emitReady() {
    if (World._readyFired) return; World._readyFired = true;
    try { clearTimeout(World._readyWatchdog); } catch (_) {}
    try { (World._onStatus || (() => {}))('__READY__'); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('vint:world-ready', { detail: { guest: !!World._guest, worldId: World._worldId } })); } catch (_) {}
    if (World._resolveReady) { const r = World._resolveReady; World._resolveReady = null; try { r(); } catch (_) {} }
  }
  function _emitFallback(reason) {
    if (World._fallbackFired) return; World._fallbackFired = true;
    _emitReady();                     // FALLBACK always implies the scene is visible
    try { (World._onStatus || (() => {}))('__FALLBACK__'); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('vint:world-fallback', { detail: { reason: reason || 'guest', worldId: World._worldId } })); } catch (_) {}
  }
  // public: overlay can await this instead of (or alongside) the status signal.
  World.ready = function () { return World._readyPromise || Promise.resolve(); };

  World.start = async function ({ mountEl, onSpeech: speechCb, onStatus, worldId, guest }) {
    onSpeech = speechCb;
    const status = onStatus || (() => {});
    World._onStatus = status;         // keep a handle so travelTo can reconnect without re-plumbing the UI
    World._mountEl = mountEl;
    World._guest = !!guest || !_token();  // guest = explicit flag OR simply no token in storage
    World._readyFired = false; World._fallbackFired = false;
    World._readyPromise = new Promise(res => { World._resolveReady = res; });
    if (worldId) World._worldId = String(worldId);
    status('waking the world…');
    // WATCHDOG (bounded loading contract, ≤6s): in practice _loop() fires READY on
    // the very first painted frame (<1s). This only trips if WebGL/module load
    // truly hangs — then we still emit a terminal signal so the loader never spins
    // forever, degrading to whatever we managed to show.
    try { clearTimeout(World._readyWatchdog); } catch (_) {}
    World._readyWatchdog = setTimeout(() => { if (!World._readyFired) { _emitReady(); _emitFallback('watchdog'); } }, 6000);

    // ── load three.js. If EVERY CDN + self-host fails, we still owe the visitor a
    //    visible world, so we surface a clear message and rethrow to the caller's
    //    catch — but this is the ONLY thing that can stop a render, and it's rare.
    let mods;
    try {
      mods = await global.Three3D.load();
    } catch (e) {
      // three.js could not stream from ANY source. Dissolve the veil anyway (never
      // leave a visitor frozen behind it) and surface a calm, honest message.
      try { status('__FALLBACK__'); } catch (_) {}
      status('the world needs a moment to stream in — check your connection, then reload.');
      throw e;
    }
    THREE = mods.THREE;
    World._mods = mods;
    World._THREE = THREE;
    World._me = me; // expose for world-mvp placement (claim/place at player pos)
    // preload the shared walking rig so bodies appear fast (never let a preload throw kill start)
    try { if (global.RiggedPresence) global.RiggedPresence.preload(mods); } catch (_) {}

    // ── scene (this block is what makes the clearing VISIBLE; it must never be gated) ──
    scene = new THREE.Scene();
    World._scene = scene;
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

    // From here on, NOTHING may throw past this point and stop the render loop.
    // Each of the remaining wirings (self-body, avatar, WS, voice, controls) is
    // individually guarded so one failure degrades gracefully — the clearing stays up.

    // A guest (no token) has no server body coming, so give them a local presence
    // to see and steer immediately. Signed-in users get theirs from the WS `hello`.
    if (World._guest) {
      try {
        World._selfBody = _makeUserPresence('you', null, null);
        World._selfBody.userData.isSelf = true;
        World._selfBody.position.set(me.x, 0, me.z);
        scene.add(World._selfBody);
      } catch (_) {}
    }

    // try to load the user's own avatar glb for their presence (signed-in only;
    // a Bearer null request is pointless and just noise for a guest)
    if (!World._guest) {
      try {
        const r = await fetch(_base() + '/api/avatar', { headers: { Authorization: 'Bearer ' + _token() } });
        if (r.ok) {
          const d = await r.json();
          if (d.active && d.active.glbUrl) {
            avatarGlbUrl = d.active.glbUrl.startsWith('http') ? d.active.glbUrl : _base() + d.active.glbUrl;
            World._myAvatarId = d.active.avatarId || null;
            World._myHeadAdjust = d.active.headAdjust || null; // saved head-mold edits
          }
        }
      } catch (_) {}
    }

    // Only reach for the living world when we actually hold a ticket. A guest sees
    // the clearing, can look around and move — the WS (others, agents, voice,
    // building) waits behind a gentle sign-in, surfaced by the page, never blocking.
    if (!World._guest && _token()) {
      try { _connect(status); } catch (e) { console.warn('[world] connect failed (world still renders):', e && e.message); }
    } else {
      status(''); // clear "waking…" — the clearing is here; the invite is the page's job
      // AMBIENT-DEMO: a guest doesn't get the living WS, but the clearing must not
      // be an empty static field — it must feel INHABITED. Drift the full council
      // as light-presences and let the clearing SPEAK its real remembered lines
      // (public /api/world/traces). Bounded, zero-write, no auth. This is the
      // "alive, not static" fallback (2b); a real read-only guest socket (2a) can
      // later replace it behind the identical READY/FALLBACK contract.
      try { _startAmbientDemo(); } catch (e) { console.warn('[world] ambient-demo failed (clearing still renders):', e && e.message); }
    }

    try { _bindControls(mountEl); } catch (e) { console.warn('[world] controls bind failed:', e && e.message); }

    // proximity voice — signaling rides the same ws; volume set by distance.
    // Guests have no ws to signal over, so skip init entirely (no mic prompt for a visitor).
    if (!World._guest && global.VintinuumVoice) {
      try {
        global.VintinuumVoice.init({
          sendSignal: (m) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); },
          getMyPos: () => ({ x: me.x, z: me.z }),
          getPeerPos: (id) => { const O = others.get(id); return O ? { x: O.group.position.x, z: O.group.position.z } : null; },
        });
      } catch (e) { console.warn('[world] voice init failed:', e && e.message); }
    }
    _loop();
  };
  // public voice controls for the UI
  World.micPush = function (on) { return global.VintinuumVoice ? global.VintinuumVoice.setMic(on) : false; };
  World.cycleVoiceRange = function () { return global.VintinuumVoice ? global.VintinuumVoice.cycleRange() : 'normal'; };

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
  // headAdjust optional (the user's saved head-mold edits).
  function _makeUserPresence(name, bustUrl, headAdjust) {
    const g = new THREE.Group();
    const label = _makeLabel(name); g.add(label); g.userData.label = label;
    const placeholder = _fallbackBody(g);
    g.userData.placeholder = placeholder;
    _attachRig(g, bustUrl, 0, headAdjust);
    return g;
  }

  // attach the rig, retrying if mods/RiggedPresence aren't ready yet (race-proof)
  function _attachRig(g, bustUrl, tries, headAdjust) {
    if (g.userData.rig) return;
    if (!(global.RiggedPresence && World._mods)) {
      if (tries < 40) return void setTimeout(() => _attachRig(g, bustUrl, tries + 1, headAdjust), 150);
      return console.warn('[world] rig deps never ready');
    }
    global.RiggedPresence.create({ THREE, mods: World._mods, bustUrl: bustUrl || null, headAdjust: headAdjust || null })
      .then(rig => {
        const ph = g.userData.placeholder;
        if (ph && ph.parent) ph.parent.remove(ph);
        g.userData.placeholder = null;
        g.add(rig.root); g.userData.rig = rig;
        if (g.userData.isSelf) World._selfRig = rig; // editor hooks live preview here
        console.log('[world] rig attached' + (bustUrl ? ' (with face)' : ''));
      })
      .catch(e => console.warn('[world] rig build failed:', e && (e.message || e)));
  }

  // a small, human-scaled soft body shown only until the rig loads (NOT a giant pill)
  // A BEAUTIFUL "becoming" placeholder (Vinta 2026-06-15: never an ugly square).
  // Instead of a dead-grey body, a luminous sculpted figure that shimmers like
  // it's forming — reads as "your real self is on its way", not a broken render.
  function _fallbackBody(g) {
    const grp = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x5fb8e8, emissive: 0x2a6a9a, emissiveIntensity: 0.6,
      roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.55,
    });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.6, 8, 16), mat); torso.position.y = 1.0;
    // a sculpted (slightly elongated) head, not a flat sprite — it MOLDS by design
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 20), mat);
    headM.scale.set(0.92, 1.12, 0.95); headM.position.y = 1.55;
    grp.add(torso, headM); g.add(grp);
    // shimmer: gentle breath of opacity + emissive so it feels alive while forming
    grp.userData._t = 0;
    grp.userData._shimmer = (dt) => {
      grp.userData._t += dt;
      const b = 0.5 + 0.18 * Math.sin(grp.userData._t * 2.2);
      mat.opacity = 0.42 + 0.2 * b;
      mat.emissiveIntensity = 0.4 + 0.5 * b;
    };
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

  // ── AMBIENT-DEMO (guest fallback 2b): the clearing, INHABITED without a socket ─
  // A guest holds no WS ticket, but must never meet an empty static field. We
  // spawn the full council as drifting light-presences (identical to the live
  // path — same _makeAgentPresence + the existing _loop() lerp/LOD animates them)
  // and let the clearing SPEAK its real remembered lines, pulled from the PUBLIC
  // GET /api/world/traces (optionalAuth — no token, no writes, no attack surface).
  // Bounded: presences drift on a self-contained target loop; utterances are
  // paced and stop when the tab hides or on teardown. Emits __FALLBACK__ once, so
  // helios's overlay can swap to the "quiet clearing" invite copy. A real
  // read-only guest socket (2a) can later drop in behind this same contract.
  // matches the server's AGENTS forms so PRESENCE_CFG lights each one correctly.
  // Home anchors live in HOMES inside _startAmbientDemo (single source of truth).
  const AMBIENT_ROSTER = [
    { id: 'agent:vintinuum', name: 'VINTINUUM', form: 'presence-sovereign' },
    { id: 'agent:aria',      name: 'ARIA',      form: 'presence-warm' },
    { id: 'agent:atlas',     name: 'ATLAS',     form: 'presence-structural' },
    { id: 'agent:lunex',     name: 'LUNEX',     form: 'presence-child-refractive' },
    { id: 'agent:yuna',      name: 'YUNA',      form: 'presence-child-electric' },
  ];

  let _ambient = null; // { drift:interval, speak:timeout, alive:bool }
  function _startAmbientDemo() {
    if (_ambient || !scene) return;
    _ambient = { drift: null, speak: null, alive: true, homes: new Map() };

    // spawn each council presence at a home anchor near the bench/clearing
    const HOMES = {
      'agent:vintinuum': { x:  0.0, z: -3.6 },
      'agent:aria':      { x: -2.2, z: -1.2 },   // by ARIA's bench
      'agent:atlas':     { x:  3.6, z: -3.2 },   // toward the horizon, still
      'agent:lunex':     { x:  2.2, z:  1.6 },
      'agent:yuna':      { x: -3.2, z:  2.2 },
    };
    for (const a of AMBIENT_ROSTER) {
      if (agents.has(a.id)) continue;
      const home = HOMES[a.id] || { x: 0, z: -3 };
      let g;
      try { g = _makeAgentPresence(a); } catch (_) { continue; }
      g.position.set(home.x, 0, home.z);
      scene.add(g);
      agents.set(a.id, { group: g, target: { x: home.x, z: home.z, yaw: Math.random() * Math.PI * 2 }, name: a.name });
      _ambient.homes.set(a.id, home);
    }

    // this session is now the reduced (ambient) experience — tell the overlay.
    _emitFallback('guest-ambient');

    // DRIFT: retarget each presence to a gentle wander near its home every few
    // seconds. The existing _loop() lerps group→target + plays idle/walk, so this
    // is just a slow target nudge — zero per-frame cost here.
    _ambient.drift = setInterval(() => {
      if (!_ambient || !_ambient.alive) return;
      for (const [id, A] of agents) {
        const home = _ambient.homes.get(id); if (!home) continue; // only nudge OUR presences
        A.target = {
          x: home.x + (Math.random() - 0.5) * 2.2,
          z: home.z + (Math.random() - 0.5) * 2.2,
          yaw: Math.random() * Math.PI * 2,
        };
      }
    }, 4200);

    // VOICE OF THE CLEARING: pull the real remembered lines and let them surface,
    // one at a time, paced, so the clearing feels like it's quietly thinking.
    _ambient.lines = []; _ambient.li = 0;
    _refreshAmbientTraces();
    const speakOne = () => {
      if (!_ambient || !_ambient.alive) return;
      if (!World._hidden && _ambient.lines.length && onSpeech) {
        const t = _ambient.lines[_ambient.li % _ambient.lines.length]; _ambient.li++;
        try {
          onSpeech({
            name: t.who || 'the clearing',
            text: t.text,
            kind: t.kind === 'thought' ? 'muse' : 'ambient',
          });
        } catch (_) {}
        // refresh the pool every full pass so it stays current across a long visit
        if (_ambient.li % Math.max(1, _ambient.lines.length) === 0) _refreshAmbientTraces();
      }
      _ambient.speak = setTimeout(speakOne, 9000 + Math.random() * 7000);
    };
    // first line lands a few seconds in, after the scene has settled
    _ambient.speak = setTimeout(speakOne, 5000);
  }

  async function _refreshAmbientTraces() {
    try {
      const r = await fetch(_base() + '/api/world/traces');
      if (!r.ok) return;
      const d = await r.json();
      const src = Array.isArray(d.traces) ? d.traces : [];
      const lines = [];
      for (const t of src) {
        if (t.kind === 'thought' && t.text) lines.push({ who: t.who, text: String(t.text).slice(0, 180), kind: 'thought' });
        else if (t.kind === 'passed' && t.who) lines.push({ who: 'the clearing', text: `${t.who} passed through here ${t.when || 'not long ago'}.`, kind: 'ambient' });
      }
      if (_ambient) _ambient.lines = lines;
    } catch (_) { /* the clearing simply stays quiet — never an error to the guest */ }
  }

  function _stopAmbientDemo() {
    if (!_ambient) return;
    _ambient.alive = false;
    try { clearInterval(_ambient.drift); } catch (_) {}
    try { clearTimeout(_ambient.speak); } catch (_) {}
    // remove only the presences we spawned (the live path owns its own via `hello`)
    for (const a of AMBIENT_ROSTER) {
      const A = agents.get(a.id);
      if (A) { try { scene.remove(A.group); } catch (_) {} agents.delete(a.id); }
    }
    _ambient = null;
  }

  // ── websocket presence ─────────────────────────────────────────────────────
  // CONTRACTS.md: fetch /api/world/hello to learn WHICH shard (wsUrl) + ticket,
  // so the WS layer can re-platform (→ Cloudflare Durable Objects) without
  // breaking cached frontends. Falls back to the legacy URL if hello is absent.
  async function _connect(status) {
    const gen = _wsGen;                 // capture: if a warp bumps _wsGen, this socket is stale
    let wsUrl = null, ticket = _token();
    try {
      const r = await fetch(_base() + '/api/world/hello', { headers: { Authorization: 'Bearer ' + _token() } });
      if (r.ok) { const h = await r.json(); if (h.wsUrl) wsUrl = h.wsUrl; if (h.ticket) ticket = h.ticket; World._sessionEpoch = h.sessionEpoch; World._protoMax = h.protoMax; }
    } catch (_) {}
    if (gen !== _wsGen) return;         // a warp happened while hello was in flight — abandon this connect
    if (!wsUrl) wsUrl = _base().replace(/^http/, 'ws') + '/ws/world'; // legacy fallback
    // accept both ?ticket= (frozen) and ?token= (legacy) so any shard works
    // DIRVERSE: &world=<worldId> room-scopes presence/voice/speech/build server-side
    ws = new WebSocket(wsUrl + '?ticket=' + encodeURIComponent(ticket) + '&token=' + encodeURIComponent(_token()) + '&proto=1' + '&world=' + encodeURIComponent(World._worldId));
    let _backoff = 250;
    ws.onopen = () => { if (gen !== _wsGen) { try { ws.close(); } catch (_) {} return; } status(''); _backoff = 250; };
    ws.onclose = () => { if (gen !== _wsGen) return; status('the world rests. reconnecting…'); setTimeout(() => { if (gen === _wsGen) _connect(status); }, _backoff); _backoff = Math.min(8000, _backoff * 1.8); };
    ws.onerror = () => {};
    ws.onmessage = (ev) => {
      if (gen !== _wsGen) return;       // ignore any late frame from a socket we've warped away from
      let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
      // envelope or flat — both work (frozen contract: data fields hoisted)
      if (m.data && typeof m.data === 'object') m = Object.assign({}, m.data, { t: m.t, seq: m.seq, room: m.room, ts: m.ts });
      if (m.seq != null) World._lastSeq = m.seq;
      if (m.t === 'hello') {
        selfId = m.selfId;
        World._selfName = m.selfName || 'you';
        if (m.spawn) { me.x = m.spawn.x; me.z = m.spawn.z; me.yaw = m.spawn.yaw; }
        // idempotent: clear any prior agents/self (reconnect must not duplicate them)
        for (const A of agents.values()) scene.remove(A.group);
        agents.clear();
        if (World._selfBody) { scene.remove(World._selfBody); World._selfBody = null; }
        // race-fix: if a presence tick beat hello and built a "other" body with our
        // OWN id, kill it now so we don't end up with two selves
        const dupe = others.get(selfId);
        if (dupe) { scene.remove(dupe.group); others.delete(selfId); }
        (m.agents || []).forEach(a => {
          const g = _makeAgentPresence(a); g.position.set(a.x, 0, a.z); scene.add(g);
          agents.set(a.id, { group: g, target: { x: a.x, z: a.z, yaw: a.yaw || 0 }, name: a.name });
        });
        // build MY own walking body — labeled with my real username (DirHaven), not "you"
        World._selfBody = _makeUserPresence(World._selfName, avatarGlbUrl, World._myHeadAdjust);
        World._selfBody.userData.isSelf = true;
        World._selfBody.position.set(me.x, 0, me.z);
        scene.add(World._selfBody);
      } else if (m.t === 'presence') {
        (m.agents || []).forEach(a => { const A = agents.get(a.id); if (A) A.target = { x: a.x, z: a.z, yaw: a.yaw || 0 }; });
        // selfPrefix kills stale-self bodies: if a prior WS connection of mine
        // (same userId, different counter) is still in the room broadcast, skip it.
        const selfPrefix = selfId ? selfId.split(':').slice(0, 2).join(':') + ':' : null;
        (m.users || []).forEach(u => {
          if (u.id === selfId) return;
          if (selfPrefix && u.id.startsWith(selfPrefix)) return; // stale ghost of me
          let O = others.get(u.id);
          if (!O) { const g = _makeUserPresence(u.name); g.position.set(u.x, 0, u.z); scene.add(g); O = { group: g, target: {} }; others.set(u.id, O); }
          O.target = { x: u.x, y: (u.y||0), z: u.z, yaw: u.yaw };
          O.voiceOn = !!u.voiceOn; O.voiceRange = u.voiceRange || 'normal';
          // connect voice if they (or we) are transmitting
          if (global.VintinuumVoice && (u.voiceOn || global.VintinuumVoice.isOn())) {
            global.VintinuumVoice.onPeerState(u.id, { on: u.voiceOn, range: u.voiceRange }, selfId);
          }
        });
        // remove the gone
        for (const [id, O] of others) { if (!(m.users || []).find(u => u.id === id)) { scene.remove(O.group); others.delete(id); } }
      } else if (m.t === 'speech') {
        if (onSpeech) onSpeech(m);
      } else if (m.t === 'offer') {
        if (World._onOffer) World._onOffer(m);
      } else if (m.t === 'voice-state') {
        if (global.VintinuumVoice) global.VintinuumVoice.onPeerState(m.id, { on: m.on, range: m.range }, selfId);
      } else if (m.t === 'voice-offer' || m.t === 'voice-answer' || m.t === 'voice-ice') {
        if (global.VintinuumVoice) global.VintinuumVoice.onSignal(m, selfId);
      } else if (m.t === 'leave') {
        const O = others.get(m.id); if (O) { scene.remove(O.group); others.delete(m.id); }
        if (global.VintinuumVoice) global.VintinuumVoice.removePeer(m.id);
      } else if (m.t && m.t.indexOf('world:') === 0) {
        _onWorldMsg(m);
      }
    };
    // ask for our world state once connected (starter pack + structures)
    setTimeout(() => { try { World.send({ t: 'world:hello' }); } catch (_) {} }, 600);
  }

  // ── WORLD MVP client: render structures + relay state to the HUD ─────────────
  function _onWorldMsg(m) {
    if (m.t === 'world:state') {
      World._resident = m.resident;
      // DIRVERSE: server tells us which world we landed in + whether we may build here
      if (m.worldId != null) World._worldId = String(m.worldId);
      World._canBuild = (m.canBuild !== false); // default true if omitted (legacy hub)
      if (Array.isArray(m.structures)) { m.structures.forEach(_renderStruct); }
      try { window.dispatchEvent(new CustomEvent('vint:world-state', { detail: m })); } catch (_) {}
    } else if (m.t === 'world:struct') {
      _renderStruct(m.struct);
      try { window.dispatchEvent(new CustomEvent('vint:world-struct', { detail: m.struct })); } catch (_) {}
    } else if (m.t === 'world:harvest:ok') {
      try { window.dispatchEvent(new CustomEvent('vint:world-harvest', { detail: m })); } catch (_) {}
    } else if (m.t === 'world:refine:ok') {
      try { window.dispatchEvent(new CustomEvent('vint:world-refine', { detail: m })); } catch (_) {}
    } else if (m.t === 'world:err') {
      try { window.dispatchEvent(new CustomEvent('vint:world-err', { detail: m })); } catch (_) {}
    }
  }

  const _structMeshes = new Map(); // id → mesh
  function _renderStruct(s) {
    if (!s || _structMeshes.has(s.id) || !World._scene) return;
    const THREE = World._THREE || (window.THREE);
    if (!THREE) return;
    let mesh;
    if (s.kind === 'hearth') {
      // a glowing claimed plot: a soft disc + warm core
      const g = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.05, 28),
        new THREE.MeshStandardMaterial({ color: 0x2a3a4a, emissive: 0x1a4a6a, emissiveIntensity: 0.5, transparent: true, opacity: 0.5 }));
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1),
        new THREE.MeshStandardMaterial({ color: 0xffd479, emissive: 0xff9a3d, emissiveIntensity: 1.2 }));
      core.position.y = 0.4; g.add(disc, core); mesh = g;
    } else if (s.kind === 'wall') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x6fb8e0, emissive: 0x1a3a5a, emissiveIntensity: 0.4, transparent: true, opacity: 0.85 }));
      mesh.position.y = 0.6;
    } else if (s.kind === 'floor') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 1),
        new THREE.MeshStandardMaterial({ color: 0x3a4a5a, emissive: 0x0a2a4a, emissiveIntensity: 0.3 }));
      mesh.position.y = 0.04;
    } else if (s.kind === 'light') {
      const g = new THREE.Group();
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8), new THREE.MeshStandardMaterial({ color: 0x445566 }));
      post.position.y = 0.5;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffd479, emissiveIntensity: 2 }));
      bulb.position.y = 1.05; g.add(post, bulb);
      const pl = new THREE.PointLight(0xffd479, 0.8, 4); pl.position.y = 1.05; g.add(pl); mesh = g;
    } else if (s.kind === 'shelf') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.25),
        new THREE.MeshStandardMaterial({ color: 0x8a7a5a, emissive: 0x2a1a0a, emissiveIntensity: 0.3 }));
      mesh.position.y = 0.6;
    } else { return; }
    mesh.position.x = s.x; mesh.position.z = s.z; if (s.y) mesh.position.y += s.y;
    mesh.rotation.y = s.rot || 0;
    World._scene.add(mesh);
    _structMeshes.set(s.id, mesh);
  }

  // public: send any world message to the server (used by the HUD)
  World.send = function (m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
  World.currentWorldId = function () { return World._worldId; };
  World.canBuild = function () { return World._canBuild !== false; };

  // ── THE WARP ────────────────────────────────────────────────────────────────
  // Travel to another world: tear down the live socket, wipe the old room's
  // presences + structures, reconnect to the new room. The engine, renderer and
  // clearing geometry survive — only the *inhabitants* of the room change.
  // The cinematic (camera dolly + starfield shimmer) lives in the HUD; this is
  // the clean mechanical swap it calls at the apex of the transition.
  World.travelTo = function (worldId) {
    worldId = String(worldId || 'universe');
    if (worldId === World._worldId && ws && ws.readyState === 1) return; // already here
    _wsGen++;                                   // invalidate the current socket + any pending reconnects
    const gone = ws; ws = null;
    if (gone) { try { gone.onclose = null; gone.onmessage = null; gone.close(); } catch (_) {} }
    if (global.VintinuumVoice && global.VintinuumVoice.reset) { try { global.VintinuumVoice.reset(); } catch (_) {} }
    try { _stopAmbientDemo(); } catch (_) {} // clear any guest ambient loop before the room swaps
    _teardownRoom();                            // remove other users, agents, structures of the old world
    World._worldId = worldId;
    World._canBuild = true;                     // optimistic; world:state will correct for visitors
    selfId = null;
    // re-plumb voice to the *new* socket once it exists (getPos closures already reference live `me`).
    // A guest holds no ticket — never reach for the WS (it would 401-loop); re-arm the
    // ambient-demo for the new room instead so travel still lands them in a living clearing.
    if (!World._guest && _token()) {
      _connect(World._onStatus || (() => {}));
      setTimeout(() => { try { World.send({ t: 'world:hello' }); } catch (_) {} }, 600);
    } else {
      try { _startAmbientDemo(); } catch (_) {}
    }
    try { window.dispatchEvent(new CustomEvent('vint:world-travel', { detail: { worldId } })); } catch (_) {}
    return worldId;
  };

  // ── warp starfield: a burst of streaking stars pulled toward the camera at the
  //    apex of a jump. Built lazily, only shown during a warp (zero cost idle).
  let _warp = null; // { points, mat, t, active, vel:Float32Array }
  function _ensureWarp() {
    if (_warp || !scene) return;
    const N = 800;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), vel = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i*3] = (Math.random() - 0.5) * 40;
      pos[i*3+1] = (Math.random() - 0.5) * 40;
      pos[i*3+2] = (Math.random() - 0.5) * 40;
      vel[i] = 6 + Math.random() * 22;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xbfe4ff, size: 0.14, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false; points.renderOrder = 10; points.visible = false;
    scene.add(points);
    _warp = { points, mat, geo, vel, t: 0, active: false };
  }
  // phase: call warpFx('start') at the beginning of the dolly, 'stop' to release.
  World.warpFx = function (phase) {
    _ensureWarp();
    if (!_warp) return;
    if (phase === 'start') { _warp.active = true; _warp.t = 0; _warp.points.visible = true; }
    else if (phase === 'stop') { _warp.active = false; }
  };
  function _stepWarp(dt) {
    if (!_warp) return;
    // ease opacity in while active, out when released
    const target = _warp.active ? 0.9 : 0;
    _warp.mat.opacity += (target - _warp.mat.opacity) * Math.min(1, dt * 6);
    if (!_warp.active && _warp.mat.opacity < 0.02) { _warp.points.visible = false; return; }
    _warp.t += dt;
    // stream stars along -Z toward the camera, recycling those that pass it
    const p = _warp.geo.attributes.position.array, cz = camera.position.z, cx = camera.position.x;
    for (let i = 0; i < _warp.vel.length; i++) {
      p[i*3+2] += _warp.vel[i] * dt * (_warp.active ? 1 : 0.4);
      if (p[i*3+2] > cz + 8) { // recycle far ahead of the camera
        p[i*3]   = cx + (Math.random() - 0.5) * 40;
        p[i*3+1] = (Math.random() - 0.5) * 40;
        p[i*3+2] = cz - 30 - Math.random() * 20;
      }
    }
    _warp.geo.attributes.position.needsUpdate = true;
    // stretch the streaks as speed peaks
    _warp.mat.size = 0.12 + (_warp.active ? 0.10 : 0) * (0.5 + 0.5 * Math.sin(_warp.t * 8));
  }

  // Wipe everything that belongs to the *room* (not the engine/self). Called on warp.
  function _teardownRoom() {
    for (const O of others.values()) { try { scene.remove(O.group); } catch (_) {} }
    others.clear();
    for (const A of agents.values()) { try { scene.remove(A.group); } catch (_) {} }
    agents.clear();
    for (const mesh of _structMeshes.values()) { try { World._scene.remove(mesh); } catch (_) {} }
    _structMeshes.clear();
    if (World._selfBody) { try { scene.remove(World._selfBody); } catch (_) {} World._selfBody = null; }
    // reset self to the spawn ring so we don't arrive standing where we left the last world
    me.x = 0; me.z = 2.5; me.yaw = Math.PI; me.y = 0;
    if (global.VintinuumVoice && global.VintinuumVoice.clearPeers) { try { global.VintinuumVoice.clearPeers(); } catch (_) {} }
  }

  World.claimHere = function () { World.send({ t: 'world:claim', x: World._me ? World._me.x : 0, z: World._me ? World._me.z : 0 }); };
  World.placeHere = function (kind) { const me = World._me || {}; World.send({ t: 'world:place', kind, x: me.x || 0, z: me.z || 0, rot: me.yaw || 0 }); };
  World.harvest = function () { World.send({ t: 'world:harvest' }); };
  World.refine = function (amount) { World.send({ t: 'world:refine', amount: amount || null }); };

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
      if (k === 'v') { World.cycleCamera(); return; }       // V = cycle camera view
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
    try { _frame(); } catch (e) {
      // one bad frame must NEVER stop the world. Log once, keep the RAF chain alive.
      if (!World._loopErrLogged) { console.error('[world] frame error (world keeps rendering):', e); World._loopErrLogged = true; }
    }
  }
  function _frame() {
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
      } else if (sb.userData && sb.userData.placeholder && sb.userData.placeholder.userData._shimmer) {
        sb.userData.placeholder.userData._shimmer(dt); // becoming-shimmer while the real face loads
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
    _stepWarp(dt);

    // camera modes: 0=3rd-person (behind), 1=1st-person (eyes), 2=selfie (front)
    const mode = World._camMode || 0;
    const myY = (me.y || 0);
    let tx, tz, ty, lookX, lookY, lookZ, ease = 0.12;
    if (mode === 1) {
      // first-person: at the head, looking forward
      tx = me.x + Math.sin(me.yaw) * 0.15; tz = me.z + Math.cos(me.yaw) * 0.15; ty = myY + 1.6;
      lookX = me.x + Math.sin(me.yaw) * 4; lookZ = me.z + Math.cos(me.yaw) * 4; lookY = myY + 1.55;
      ease = 0.5;
      if (World._selfBody) World._selfBody.visible = false; // don't render own head in your eyes
    } else if (mode === 2) {
      // selfie: camera in FRONT of you, looking back at your face
      const d = 2.6;
      tx = me.x + Math.sin(me.yaw) * d; tz = me.z + Math.cos(me.yaw) * d; ty = myY + 1.55;
      lookX = me.x; lookZ = me.z; lookY = myY + 1.45;
      if (World._selfBody) World._selfBody.visible = true;
    } else {
      // third-person trailing
      const camDist = 4.5;
      tx = me.x - Math.sin(me.yaw) * camDist; tz = me.z - Math.cos(me.yaw) * camDist; ty = 2.4 + myY * 0.5;
      lookX = me.x; lookZ = me.z; lookY = 1.2 + myY;
      if (World._selfBody) World._selfBody.visible = true;
    }
    camera.position.x += (tx - camera.position.x) * ease;
    camera.position.z += (tz - camera.position.z) * ease;
    camera.position.y += (ty - camera.position.y) * ease;
    camera.lookAt(lookX, lookY, lookZ);

    // proximity voice volumes, recomputed from live positions
    if (global.VintinuumVoice) global.VintinuumVoice.updateSpatial();

    renderer.render(scene, camera);

    // FIRST-PAINT signal → the visibility contract fires the instant the clearing
    // is actually on screen (status string + window event + resolved promise), so
    // the loader/overlay swaps on a REAL event, never a guess. Exactly once.
    if (!World._painted) {
      World._painted = true;
      _emitReady();
      // A guest painted the clearing but will never receive a live WS world — mark
      // this session as the reduced (ambient) experience so the overlay raises the
      // "quiet clearing · sign in to join" invite. The world stays fully visible and
      // explorable; FALLBACK only refines the copy, it never hides the world.
      if (World._guest) { try { _emitFallback('guest'); } catch (_) {} }
    }
  }
  // cycle camera: 3rd → 1st → selfie → 3rd
  World.cycleCamera = function () { World._camMode = ((World._camMode || 0) + 1) % 3; return World._camMode; };

  // Open the head-mold editor on the user's own avatar with live 3D preview.
  World.editHead = function () {
    if (!window.HeadEditor) { console.warn('[world] HeadEditor not loaded'); return; }
    if (!World._myAvatarId) { console.warn('[world] no avatar to edit yet'); return; }
    window.HeadEditor.open({
      avatarId: World._myAvatarId,
      presence: World._selfRig || null,
      adjust: World._myHeadAdjust || null,
      base: _base(),
    });
  };

  function _resize(mountEl) {
    const w = mountEl.clientWidth || innerWidth, h = mountEl.clientHeight || innerHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  global.VintinuumWorld = World;
})(window);
