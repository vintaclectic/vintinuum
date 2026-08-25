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

    // ── AGENT-LIFE: the living layer. Give the council movement personalities,
    //    idle rituals, muse-wisps, player-reactivity + the listen/speak arc. This
    //    is a DRIVER over the same `agents` map world-client already lerps, so it
    //    animates BOTH the guest ambient roster and the live-WS council with no
    //    extra wiring. Guarded — if it fails, the world still renders + moves.
    try {
      if (global.AgentLife) {
        global.AgentLife.init({
          THREE, scene, agents,
          getPlayer: () => ({ x: me.x, z: me.z, yaw: me.yaw }),
          isMobile,
        });
      }
    } catch (e) { console.warn('[world] agent-life init failed (world still lives):', e && e.message); }

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
    const amb = new THREE.AmbientLight(0x9aa8c0, 1.5);       // lift the shadows
    scene.add(amb);
    const rim = new THREE.PointLight(0xffd9a0, 1.6, 40);
    rim.position.set(0, 4, 6); scene.add(rim);               // warm rim toward camera
    // THE VIGIL keeps handles on the lights it dims. Base intensities are stored
    // so warmth is always applied as a RATIO of the authored look — the golden
    // hour is never re-authored, only leaned toward dusk and back.
    World._warmthRig = {
      sun, fill, amb, rim,
      base: { sun: 3.2, fill: 1.4, amb: 1.5, rim: 1.6, fogNear: 12, fogFar: 48, mote: 0.5 },
    };

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
    World._warmthRig.moteMat = moteMat;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // THE VIGIL — spark, made VISIBLE (AETHERHOLD 2026-08-04)
  //
  // A number in a panel is not survival. Survival is walking back into your own
  // clearing and SEEING that it leaned toward dusk while you were gone — the fog
  // drawn in close, the golden hour drained toward blue, the motes thinned to
  // almost nothing — and then watching it come back as you tend your court.
  //
  // Warmth is a pure function of server-authoritative spark. The client computes
  // NO survival; it only renders the number the vigil sent. Every value is a
  // ratio of the authored golden hour (never a re-authoring), and every change
  // is EASED over seconds, so the world breathes rather than snapping.
  //
  // Floor of 0.34: even an ember-state clearing stays legible and beautiful. A
  // dim world must never become an unusable or ugly one — that would be
  // punishment, and the vigil punishes nothing.
  // ══════════════════════════════════════════════════════════════════════════
  World._warmth = 1;          // what is currently rendered (eased)
  World._warmthTarget = 1;    // where spark says it should be

  World.setSpark = function (spark, living) {
    const s = Math.max(0, Math.min(100, Number(spark) || 0));
    // a gentle curve: the top half of spark barely dims (so a healthy world
    // always looks lush), the bottom half is where the loss is really felt.
    const p = s / 100;
    World._warmthTarget = 0.34 + 0.66 * (p * p * 0.55 + p * 0.45);
    World._living = living || World._living || null;
    try { window.dispatchEvent(new CustomEvent('vint:world-warmth', { detail: { spark: s, warmth: World._warmthTarget, living: World._living } })); } catch (_) {}
    return World._warmthTarget;
  };

  function _stepWarmth(dt) {
    const rig = World._warmthRig;
    if (!rig || !THREE) return;
    // ease toward the target (~2.5s to close the gap) — the world never snaps
    const k = Math.min(1, dt * 0.4);
    World._warmth += (World._warmthTarget - World._warmth) * k;
    const w = World._warmth;
    const b = rig.base;
    try {
      rig.sun.intensity = b.sun * (0.42 + 0.58 * w);
      rig.rim.intensity = b.rim * (0.25 + 0.75 * w);
      rig.amb.intensity = b.amb * (0.55 + 0.45 * w);
      // the COOL fill rises as warmth falls — dusk is not just darker, it is
      // colder. This is the single most legible cue that the world is dimming.
      rig.fill.intensity = b.fill * (1.5 - 0.5 * w);
      if (rig.moteMat) rig.moteMat.opacity = b.mote * (0.12 + 0.88 * w);
      // the fog draws IN as the light fails — the world literally closes around
      // you, which is the felt meaning of "my reach is shrinking".
      if (scene && scene.fog) {
        scene.fog.near = b.fogNear * (0.45 + 0.55 * w);
        scene.fog.far = b.fogFar * (0.42 + 0.58 * w);
      }
    } catch (_) {}
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
    // remember whether this being has a generated face — the Being Forge keeps the
    // sculptable placeholder head visible for a FACELESS being (that sculpted head
    // IS its face until they generate one), and hides it once a real face lands.
    g.userData.hasFace = !!bustUrl;
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
        // A FACELESS SELF being keeps its sculpted placeholder head as its face
        // (the Being Forge sculpts + tints it). Perch it on the rig's head bone so
        // it walks WITH the body, and hide the rig's own head so it reads as one
        // continuous figure. A being WITH a real face drops the placeholder as before.
        const faceless = g.userData.isSelf && !bustUrl;
        if (ph && ph.parent && !faceless) { ph.parent.remove(ph); g.userData.placeholder = null; }
        g.add(rig.root); g.userData.rig = rig;
        if (faceless && ph) {
          // A FACELESS being: keep only the SCULPTED HEAD as its face, perched on
          // the rig's head bone so it walks with the body; drop the placeholder
          // torso (the robot body IS the torso). One continuous, forge-able figure.
          try {
            const sculptHead = ph.userData && ph.userData.__forgeHead;
            let headBone = null;
            rig.root.traverse(o => { if (o.isBone && /Head$/.test(o.name)) headBone = o; });
            if (sculptHead && headBone) {
              ph.remove(sculptHead);                 // detach head from the placeholder body
              headBone.add(sculptHead);
              const ws = headBone.getWorldScale(new THREE.Vector3());
              const inv = 1 / (ws.y || 1);
              sculptHead.position.set(0, 0.06 * inv, 0);
              sculptHead.scale.multiplyScalar(inv * 0.9);
              rig._forgeHead = sculptHead;
              g.userData.sculptHead = sculptHead;
            }
            if (ph.parent) ph.parent.remove(ph);      // remove the leftover placeholder torso
            g.userData.placeholder = null;
          } catch (_) {}
        }
        if (g.userData.isSelf) World._selfRig = rig; // editor hooks live preview here
        // re-apply any saved being look (morph + tint) now that the rig exists
        if (g.userData.isSelf) { try { _reapplySavedBeing(); } catch (_) {} }
        console.log('[world] rig attached' + (bustUrl ? ' (with face)' : faceless ? ' (sculpt-head being)' : ''));
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
    // a sculpted (slightly elongated) head, not a flat sprite — it MOLDS by design.
    // This IS the Being-Forge's sculpt target for a being with no generated face:
    // the creator morphs THIS head (width/length/depth) + tints the whole figure.
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 20), mat);
    headM.scale.set(0.92, 1.12, 0.95); headM.position.y = 1.55;
    headM.userData.__forgeBaseScale = { x: 0.92, y: 1.12, z: 0.95 };
    mat.userData = mat.userData || {};
    torso.userData.__forgeTintable = true; headM.userData.__forgeTintable = true;
    grp.userData.__forgeHead = headM; grp.userData.__forgeMat = mat;
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

    // re-apply any saved council tints now that the ambient roster exists (a
    // guest can recolor the council in the Being Forge; the choice survives reloads)
    try { setTimeout(() => { try { _reapplySavedBeing(); } catch (_) {} }, 300); } catch (_) {}

    // this session is now the reduced (ambient) experience — tell the overlay.
    _emitFallback('guest-ambient');

    // MOVEMENT is now owned by AgentLife (personalities, idle rituals, wisps,
    // player-reactivity) — it chooses each presence's intent every frame in the
    // loop. No dumb ping-pong interval. If AgentLife somehow failed to load, we
    // keep a minimal safety-drift so the guest clearing is never frozen.
    if (!global.AgentLife) {
      _ambient.drift = setInterval(() => {
        if (!_ambient || !_ambient.alive) return;
        for (const [id, A] of agents) {
          const home = _ambient.homes.get(id); if (!home) continue;
          A.target = { x: home.x + (Math.random()-0.5)*2.2, z: home.z + (Math.random()-0.5)*2.2, yaw: Math.random()*Math.PI*2 };
        }
      }, 4200);
    }

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

  // ── incoming speech → light the being, then show the bubble ──────────────────
  // CONTRACT with the brain (VINTINUUM's parallel work): the server sends
  //   { t:'speech', actorId, name, text, kind:'agent' }
  // when an agent replies. We (1) resolve WHICH presence spoke — by actorId if
  // present, else by matching the display name to a spawned agent — and give it
  // an animated "speaking" beat (warm swell + regard of the player) synchronized
  // with its bubble, so the reply visibly BELONGS to a being; then (2) render the
  // bubble via the page's onSpeech. User/ambient/muse lines just render.
  function _onAgentSpeech(m) {
    try {
      if (m && m.kind === 'agent' && global.AgentLife && global.AgentLife.isReady && global.AgentLife.isReady()) {
        let id = m.actorId && agents.has(m.actorId) ? m.actorId : null;
        if (!id && m.name) id = global.AgentLife.idForName(m.name);
        if (id) global.AgentLife.onAgentSpeak(id, m.text);
      }
    } catch (_) {}
    if (onSpeech) onSpeech(m);
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
        // PUBLISHED, because identity is not private state. The presence id is
        // `user:<userId>:<n>`, and it is the ONLY place the client is ever told
        // which numeric user it is — the trade table needs that to know which
        // column of an exchange is its own. Kept on World (not just in the
        // closure) so a surface that mounts after `hello` can still ask.
        World._selfId = m.selfId;
        World._selfName = m.selfName || 'you';
        try { window.dispatchEvent(new CustomEvent('vint:world-hello', { detail: m })); } catch (_) {}
        // ── THE VISITOR GATE — you asked for a resting clearing and landed here.
        // The server redirected rather than dropping the socket, so the ONE thing
        // this must never do is leave the player silently somewhere they didn't
        // choose. Announced as a fact about that world, never as a fault of the
        // person who tried to visit it.
        if (m.gated) {
          World._gated = m.gated;
          try { window.dispatchEvent(new CustomEvent('vint:world-gated', { detail: m.gated })); } catch (_) {}
        }
        if (m.spawn) { me.x = m.spawn.x; me.z = m.spawn.z; me.yaw = m.spawn.yaw; }
        // idempotent: clear any prior agents/self (reconnect must not duplicate them)
        try { if (global.AgentLife && global.AgentLife.reset) global.AgentLife.reset(); } catch (_) {}
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
        // re-apply saved council tints for the freshly-spawned live agents
        try { setTimeout(() => { try { _reapplySavedBeing(); } catch (_) {} }, 300); } catch (_) {}
      } else if (m.t === 'presence') {
        // ── THE STANDING COURT, RECEIVED (AETHERHOLD 2026-08-05) ──────────────
        // This loop used to be `get(a.id); if (A) …` — a pure position update
        // that could only move beings hello had already spawned. That was the
        // client half of "nobody else is there": the server can now name the
        // agents standing in the world you walked into (its OWNER's court, not
        // yours), and the client dropped every one of them on the floor because
        // it had never been asked to spawn a presence it didn't already know.
        //
        // So an unknown COURT presence is now stood up on arrival. Two rules
        // keep this from becoming a way for the wire to spawn anything it likes:
        //   · only `court:true` frames may create — a council id the client
        //     doesn't know is still ignored, exactly as before;
        //   · the id is tracked in `visiting` (never in `court`, which means MY
        //     court) so leaving the world tears down precisely what the room
        //     gave us and never touches the player's own agents.
        _syncVisitingCourt(m.agents || []);
        (m.agents || []).forEach(a => { const A = agents.get(a.id); if (A) A.target = { x: a.x, z: a.z, yaw: a.yaw || 0 }; });
        // selfPrefix kills stale-self bodies: if a prior WS connection of mine
        // (same userId, different counter) is still in the room broadcast, skip it.
        const selfPrefix = selfId ? selfId.split(':').slice(0, 2).join(':') + ':' : null;
        (m.users || []).forEach(u => {
          if (u.id === selfId) return;
          if (selfPrefix && u.id.startsWith(selfPrefix)) return; // stale ghost of me
          let O = others.get(u.id);
          if (!O) { const g = _makeUserPresence(u.name); g.position.set(u.x, 0, u.z); scene.add(g); O = { group: g, target: {} }; others.set(u.id, O); }
          // THE NAME IS PART OF THE PRESENCE (2026-08-08). It used to be baked
          // only into the sprite label, which meant the only way to know who a
          // body was, was to read pixels. The Reckoning has to name a person
          // before it will let you touch them ("you are about to kill <name>"),
          // so the name lives on the record itself and is refreshed every tick
          // in case a peer renames mid-session.
          O.name = u.name || O.name || 'someone';
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
        _onAgentSpeech(m);          // light the speaking being (if it's an agent) + show the bubble
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
      // THE LANTERNS — the marks visitors left standing here. Absent on a legacy
      // server, so the loop is guarded rather than assumed.
      World._canTrace = (m.canTrace === true);
      if (Array.isArray(m.traces)) { m.traces.forEach(_renderTrace); }
      // THE VIGIL: the server's spark drives the world's actual light. `living`
      // carries the full picture (floor, drift, watchers, reach); spark alone is
      // the fallback for any older payload that predates the vigil.
      try {
        if (m.living) World.setSpark(m.living.spark, m.living);
        else if (m.resident && m.resident.spark != null) World.setSpark(m.resident.spark, null);
      } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('vint:world-state', { detail: m })); } catch (_) {}
    } else if (m.t === 'world:tend:ok') {
      // tending is a felt moment: the clearing brightens as the watch is set
      try { if (m.living) World.setSpark(m.living.spark, m.living); } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('vint:world-tend', { detail: m })); } catch (_) {}
    } else if (m.t === 'world:traces') {
      if (Array.isArray(m.traces)) m.traces.forEach(_renderTrace);
      try { window.dispatchEvent(new CustomEvent('vint:world-traces', { detail: m })); } catch (_) {}
    } else if (m.t === 'world:trace:new') {
      // someone set a light down while we're standing here — watch it kindle
      _renderTrace(m.trace);
      try { window.dispatchEvent(new CustomEvent('vint:world-trace', { detail: m.trace })); } catch (_) {}
    } else if (m.t === 'world:trace:ok') {
      _renderTrace(m.trace);
      try { window.dispatchEvent(new CustomEvent('vint:world-trace-ok', { detail: m.trace })); } catch (_) {}
    } else if (m.t === 'world:trace:gone') {
      const mesh = _traceMeshes.get(String(m.id));
      if (mesh) { try { World._scene.remove(mesh); } catch (_) {} _traceMeshes.delete(String(m.id)); }
      try { window.dispatchEvent(new CustomEvent('vint:world-trace-gone', { detail: { id: m.id } })); } catch (_) {}
    } else if (m.t === 'world:struct') {
      _renderStruct(m.struct);
      try { window.dispatchEvent(new CustomEvent('vint:world-struct', { detail: m.struct })); } catch (_) {}
    } else if (m.t === 'world:soil:ok') {
      // ── THE COVENANTS: what ground am I on, and what can it cost me ─────────
      // Relayed verbatim. The client NEVER derives soil, violence or risk — the
      // server is the only thing that knows, so the HUD can never tell a player
      // they are safe when the server disagrees. (See body/world/covenants-hud.js)
      World._soil = m;
      try { window.dispatchEvent(new CustomEvent('vint:world-soil', { detail: m })); } catch (_) {}
    } else if (m.t === 'world:died') {
      // Being killed is a MOMENT and it gets words — who, what it cost, and the
      // bounded promise that the world itself is untouched. Never a number that
      // quietly changed.
      try { window.dispatchEvent(new CustomEvent('vint:world-died', { detail: m })); } catch (_) {}
    } else if (m.t === 'world:covenant:ok') {
      try { window.dispatchEvent(new CustomEvent('vint:world-covenant', { detail: m })); } catch (_) {}
    } else if (m.t === 'world:bank:ok') {
      try { window.dispatchEvent(new CustomEvent('vint:world-bank', { detail: m })); } catch (_) {}
    } else if (m.t === 'world:strike:ok') {
      try { window.dispatchEvent(new CustomEvent('vint:world-strike', { detail: m })); } catch (_) {}
    } else if (m.t === 'world:policy:list:ok') {
      // THE ORDER PAPER — the open motions before your covenant. Held for
      // synchronous readers (the Reckoning sheet paints from it on open) and
      // announced, same as soil.
      World._proposals = m;
      try { window.dispatchEvent(new CustomEvent('vint:world-proposals', { detail: m })); } catch (_) {}
    } else if (m.t === 'world:policy:ok' || m.t === 'world:vote:ok' || m.t === 'world:execute:ok') {
      try { window.dispatchEvent(new CustomEvent('vint:world-law', { detail: m })); } catch (_) {}
    } else if (m.t === 'world:deed') {
      // the world's politics, happening near you — a public deed feed
      try { window.dispatchEvent(new CustomEvent('vint:world-deed', { detail: m })); } catch (_) {}
    } else if (m.t === 'world:harvest:ok') {
      try { window.dispatchEvent(new CustomEvent('vint:world-harvest', { detail: m })); } catch (_) {}
    } else if (m.t === 'world:refine:ok') {
      try { window.dispatchEvent(new CustomEvent('vint:world-refine', { detail: m })); } catch (_) {}
    } else if (m.t === 'world:weave:ok' || m.t === 'world:kindle:ok') {
      // ── THE LOOM, REACHED (AETHERHOLD 2026-08-25) ──────────────────────────
      // world-mvp answers world:weave and world:kindle — the ONLY faucet for
      // strand and ember, and therefore the only cure for the famine that made
      // building impossible after three pieces. No client had ever sent either
      // verb or listened for either answer, so the cure existed and no player
      // could reach it. A faucet nobody can turn is not a faucet.
      try { window.dispatchEvent(new CustomEvent('vint:world-' + (m.t === 'world:weave:ok' ? 'weave' : 'kindle'), { detail: m })); } catch (_) {}
    } else if (m.t === 'world:trade' || m.t === 'world:trade:settled' || m.t === 'world:trade:closed') {
      // ── THE TABLE, RELAYED (AETHERHOLD 2026-08-25) ──────────────────────────
      // world-mvp has carried a full escrowed two-party trade protocol —
      // open/offer/ready/cancel, both-sides-confirmed, server-rendered — and
      // NOT ONE CLIENT FRAME EVER REACHED A HUMAN. The server did the work and
      // nobody could tell, which is the invisible-structure bug wearing a
      // different coat. These three frames are the wire; world-hud paints them.
      //
      // Relayed VERBATIM and never re-derived: both parties must read the
      // identical server-rendered table, because a trade UI where one side's
      // client computes what the other side offered is how people get cheated
      // by their own screen.
      try { window.dispatchEvent(new CustomEvent('vint:world-trade', { detail: m })); } catch (_) {}
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
    // ── THE TEN THAT WERE PAID FOR AND NEVER APPEARED (AETHERHOLD 2026-08-25) ──
    // PLACE_COST carries fifteen kinds. This function drew five and `else
    // return`-ed the rest, so ten of them took the player's strand, entered the
    // server's structure table, survived reload, counted toward standing — and
    // rendered NOTHING. The player paid, the world said yes, and the ground
    // stayed empty. That is worse than a refusal: a refusal is honest.
    //
    // Every piece below obeys the same three contracts the original five did,
    // because they are what keep the no-collision law true in 3D:
    //   · FOOTPRINT ≤ 1 unit — the grid cell is the box, so no piece can ever
    //     intrude on its neighbour's cell no matter how they are arranged.
    //   · GROUNDED — local y is set so the piece SITS on y=0 (never sunk under
    //     the floor plate, never floating above it), then `s.y` offsets it.
    //   · EMISSIVE — the world is lit by spark and is often dim; an unlit piece
    //     is invisible in a dim clearing, which is the bug all over again.
    } else if (s.kind === 'pillar') {
      // vertical punctuation — tallest of the tier-1 pieces, reads from range
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.6, 12),
        new THREE.MeshStandardMaterial({ color: 0x7c8fa6, emissive: 0x15304a, emissiveIntensity: 0.35 }));
      shaft.position.y = 0.8;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 12),
        new THREE.MeshStandardMaterial({ color: 0x9fb4cc, emissive: 0x1d3f5e, emissiveIntensity: 0.5 }));
      cap.position.y = 1.66; g.add(shaft, cap); mesh = g;
    } else if (s.kind === 'fence') {
      // low boundary — deliberately half the wall's height so a fenced edge and
      // a walled edge are never confused at a glance
      const g = new THREE.Group();
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1, 0.07, 0.07),
        new THREE.MeshStandardMaterial({ color: 0x8a9aab, emissive: 0x16303f, emissiveIntensity: 0.3 }));
      rail.position.y = 0.52;
      const rail2 = rail.clone(); rail2.position.y = 0.3;
      g.add(rail, rail2);
      [-0.42, 0.42].forEach((x) => {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.62, 0.09),
          new THREE.MeshStandardMaterial({ color: 0x6f7f90, emissive: 0x12283a, emissiveIntensity: 0.3 }));
        p.position.set(x, 0.31, 0); g.add(p);
      });
      mesh = g;
    } else if (s.kind === 'arch') {
      // a doorway you pass THROUGH — the opening is real negative space, built
      // from two legs and a lintel rather than a solid block with a texture
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x8fa8c4, emissive: 0x1b3d5e, emissiveIntensity: 0.45 });
      [-0.4, 0.4].forEach((x) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 0.18), mat);
        leg.position.set(x, 0.75, 0); g.add(leg);
      });
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.18, 0.18), mat);
      lintel.position.y = 1.59; g.add(lintel); mesh = g;
    } else if (s.kind === 'door') {
      // a slab in a frame, canted slightly ajar so it reads as a door and not a
      // wall — the tilt is the whole tell at distance
      const g = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.35, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x5a6b7c, emissive: 0x12283a, emissiveIntensity: 0.3 }));
      frame.position.y = 0.675;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.15, 0.09),
        new THREE.MeshStandardMaterial({ color: 0xb08d5a, emissive: 0x3a2410, emissiveIntensity: 0.45 }));
      slab.position.set(0.1, 0.6, 0.07); slab.rotation.y = -0.35;
      g.add(frame, slab); mesh = g;
    } else if (s.kind === 'window') {
      // wall-height so it lines up with walls, but glazed and lit from within —
      // a lit window is the strongest "someone lives here" signal in the world
      const g = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x5f7185, emissive: 0x14304a, emissiveIntensity: 0.3 }));
      frame.position.y = 0.6;
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.72, 0.14),
        new THREE.MeshStandardMaterial({ color: 0xbfe6ff, emissive: 0x7fc8ff, emissiveIntensity: 1.1, transparent: true, opacity: 0.65 }));
      glass.position.y = 0.72; g.add(frame, glass); mesh = g;
    } else if (s.kind === 'lantern') {
      // hangs from a hook — reads as suspended where `light` reads as planted,
      // which is why both exist
      const g = new THREE.Group();
      const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.25, 6),
        new THREE.MeshStandardMaterial({ color: 0x4a5665 }));
      hook.position.y = 0.625;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x4a5665 }));
      arm.position.set(0.15, 1.24, 0);
      const cage = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0),
        new THREE.MeshStandardMaterial({ color: 0xffe6a8, emissive: 0xffb347, emissiveIntensity: 1.8 }));
      cage.position.set(0.29, 1.05, 0);
      g.add(hook, arm, cage);
      const pl = new THREE.PointLight(0xffb347, 0.7, 3.5); pl.position.set(0.29, 1.05, 0); g.add(pl);
      mesh = g;
    } else if (s.kind === 'planter') {
      // the only living thing a player can place — deliberately organic among
      // all this geometry, so a garden reads instantly as tended
      const g = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.34, 0.8),
        new THREE.MeshStandardMaterial({ color: 0x6b5442, emissive: 0x241a10, emissiveIntensity: 0.25 }));
      box.position.y = 0.17;
      const soil = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.06, 0.68),
        new THREE.MeshStandardMaterial({ color: 0x2e2419 }));
      soil.position.y = 0.35; g.add(box, soil);
      // three fronds, fixed offsets — never random, so a planter looks the same
      // on every client and after every reload
      [[-0.16, 0.1, 0.3], [0.05, -0.14, 0.42], [0.18, 0.16, 0.34]].forEach(([fx, fz, h]) => {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.1, h, 6),
          new THREE.MeshStandardMaterial({ color: 0x6fcf97, emissive: 0x1c4a33, emissiveIntensity: 0.55 }));
        frond.position.set(fx, 0.38 + h / 2, fz); g.add(frond);
      });
      mesh = g;
    } else if (s.kind === 'stair') {
      // four risers climbing exactly one wall-height across one cell, so a stair
      // actually reads as reaching the top of the thing beside it
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x74879b, emissive: 0x15304a, emissiveIntensity: 0.35 });
      for (let i = 0; i < 4; i++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.25), mat);
        step.position.set(0, 0.15 + i * 0.3, 0.375 - i * 0.25);
        g.add(step);
      }
      mesh = g;
    } else if (s.kind === 'roof') {
      // sits at wall-height (1.2) so a roof laid on a walled room caps it
      // exactly, instead of hovering or sinking into the wall tops
      const g = new THREE.Group();
      const prism = new THREE.Mesh(new THREE.ConeGeometry(0.78, 0.5, 4),
        new THREE.MeshStandardMaterial({ color: 0x9a5f4a, emissive: 0x33150c, emissiveIntensity: 0.4 }));
      prism.position.y = 1.45; prism.rotation.y = Math.PI / 4;
      const eave = new THREE.Mesh(new THREE.BoxGeometry(1, 0.09, 1),
        new THREE.MeshStandardMaterial({ color: 0x7a4a38, emissive: 0x2a1108, emissiveIntensity: 0.35 }));
      eave.position.y = 1.2; g.add(eave, prism); mesh = g;
    } else if (s.kind === 'banner') {
      // cloth on a pole, tinted by the owner's covenant when the server sends
      // one — the cheapest way to see whose ground you are standing on
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8),
        new THREE.MeshStandardMaterial({ color: 0x51606f }));
      pole.position.y = 0.9;
      const tint = (typeof s.color === 'number') ? s.color : 0xc44b6a;
      // cloth half-width 0.23 at centre-offset 0.25 reaches exactly 0.48 — inside
      // the 0.5 cell half-width. It was 0.52 and overhung its neighbour's cell by
      // 2cm, which is the no-collision law losing by a rounding error.
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.72),
        new THREE.MeshStandardMaterial({ color: tint, emissive: tint, emissiveIntensity: 0.4, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
      cloth.position.set(0.25, 1.3, 0); g.add(pole, cloth); mesh = g;
    } else if (s.kind === 'beacon') {
      // the lightwarden's piece, and the only one that costs an ember. It is
      // seen from the STAR MAP, so it is the tallest thing a player can place
      // and it carries a real light — this is what makes a world visible from
      // outside itself.
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.44, 0.36, 10),
        new THREE.MeshStandardMaterial({ color: 0x3f4c5c, emissive: 0x122236, emissiveIntensity: 0.4 }));
      base.position.y = 0.18;
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1.9, 10),
        new THREE.MeshStandardMaterial({ color: 0x8fa8c4, emissive: 0x244a6e, emissiveIntensity: 0.6 }));
      column.position.y = 1.25;
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1),
        new THREE.MeshStandardMaterial({ color: 0xfff2c4, emissive: 0xffc14d, emissiveIntensity: 2.4 }));
      crown.position.y = 2.35;
      g.add(base, column, crown);
      const pl = new THREE.PointLight(0xffc14d, 1.4, 9); pl.position.y = 2.35; g.add(pl);
      mesh = g;
    } else {
      // An unknown kind still gets a BODY. A future server that ships a
      // sixteenth piece to an older client must never reproduce this bug —
      // the player paid for something, so something stands there, and it is
      // legible as "this client is out of date" rather than silently absent.
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x7e8a99, emissive: 0x1a2a3a, emissiveIntensity: 0.4, transparent: true, opacity: 0.7 }));
      mesh.position.y = 0.25;
    }
    mesh.position.x = s.x; mesh.position.z = s.z; if (s.y) mesh.position.y += s.y;
    mesh.rotation.y = s.rot || 0;
    World._scene.add(mesh);
    _structMeshes.set(s.id, mesh);
  }

  // ── THE LANTERNS ────────────────────────────────────────────────────────────
  // A visitor's mark, standing where they stood. Small, warm, and unmistakably
  // NOT a structure: a structure is something the owner built, a lantern is
  // something someone else left. It floats and breathes slightly so a clearing
  // with visitors reads as inhabited from across the world, which is the whole
  // point — you should be able to SEE that people have been here before you walk
  // to any one of them.
  //
  // NOTHING TOUCHES ANYTHING (no-collision, in three dimensions): lanterns are
  // planted at the visitor's own standing position, which the server clamps to
  // the same play area as movement, and they float at y=0.55 — above the floor
  // plates and below every presence's head, so a light can never be inside a
  // being or buried in a wall. Two visitors who stood in the same spot get one
  // lantern each at the same place, which is the one honest reading of "we both
  // stood here" and is also impossible to make worse (each is one per person).
  const _traceMeshes = new Map(); // id → mesh
  const _GLYPH_COLOR = {
    lantern: 0xffd479, sigil: 0xa67cff, cairn: 0x9ad0c2,
    bloom: 0xff8fb0, ember: 0xff8a3d, star: 0x9fdcff,
  };
  function _renderTrace(t) {
    if (!t || t.id == null || !World._scene) return;
    const id = String(t.id);
    if (_traceMeshes.has(id)) return;
    const THREE = World._THREE || (window.THREE);
    if (!THREE) return;
    const color = _GLYPH_COLOR[t.glyph] || _GLYPH_COLOR.lantern;
    const g = new THREE.Group();
    // the light itself — a small floating core
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16, 0),
      new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: color, emissiveIntensity: 1.6 })
    );
    core.position.y = 0.55;
    // a soft ring on the ground marking WHERE they stood
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.42, 24),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02;
    g.add(core, ring);
    // a real (cheap, short-range) light so it actually warms the ground near it
    try { const pl = new THREE.PointLight(color, 0.5, 2.6); pl.position.y = 0.55; g.add(pl); } catch (_) {}
    g.position.set(t.x || 0, 0, t.z || 0);
    // carried on the mesh so a click/proximity read can name who left it without
    // a second lookup, and so the HUD can render the words as TEXT (never HTML).
    g.userData.trace = { id: t.id, who: t.who, words: t.words, glyph: t.glyph, at: t.at };
    g.userData.isTrace = true;
    World._scene.add(g);
    _traceMeshes.set(id, g);
  }
  // Lanterns breathe — a slow bob + turn, each on its own phase so a clearing of
  // them never pulses in unison (which would read as a UI element, not a place).
  // Costs one sin/cos per lantern per frame over a set capped at 60 server-side.
  function _stepTraces(tnow) {
    if (!_traceMeshes.size) return;
    let i = 0;
    for (const g of _traceMeshes.values()) {
      const ph = (g.userData.tracePhase != null)
        ? g.userData.tracePhase
        : (g.userData.tracePhase = (i * 1.7) % 6.283);
      const core = g.children[0];
      if (core) { core.position.y = 0.55 + Math.sin(tnow * 0.0011 + ph) * 0.06; core.rotation.y += 0.004; }
      i++;
    }
  }

  // every lantern standing in this world, nearest first — the HUD walks this to
  // render the "who came" list without keeping its own copy of the truth.
  World.traces = function () {
    const out = [];
    for (const g of _traceMeshes.values()) {
      const t = g.userData.trace; if (!t) continue;
      out.push(Object.assign({}, t, { dist: Math.hypot(g.position.x - me.x, g.position.z - me.z) }));
    }
    out.sort((a, b) => a.dist - b.dist);
    return out;
  };
  // may I leave one here? Server-authoritative (set from world:state.canTrace);
  // false in my own world, false on a legacy server, false when signed out.
  World.canTrace = function () { return World._canTrace === true && !World._guest; };
  // Leave a lantern where I'm standing. Position is NOT sent — the server plants
  // it at its own copy of where I am, so a client can never place one somewhere
  // it never stood.
  World.leaveTrace = function (words, glyph) {
    World.send({ t: 'world:trace', words: String(words == null ? '' : words).slice(0, 140), glyph: glyph || 'lantern' });
  };
  // Put one out. Owner-only; the server re-checks, this just asks.
  World.removeTrace = function (id) { World.send({ t: 'world:trace:remove', id: id }); };
  // Turn the player to FACE a lantern (same discipline as courtFocus: we point
  // them at it, we never seize the camera — the camera mode is the player's).
  World.faceTrace = function (id) {
    const g = _traceMeshes.get(String(id));
    if (!g) return false;
    const dx = g.position.x - me.x, dz = g.position.z - me.z;
    if (Math.hypot(dx, dz) < 0.05) return true;
    me.yaw = Math.atan2(dx, dz);
    return true;
  };

  // public: send any world message to the server (used by the HUD)
  World.send = function (m) { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(m)); return true; } return false; };
  // Is the living socket actually up? Callers that need to know whether an
  // action REACHED the server (rather than being silently dropped by send's
  // readyState guard) must ask this before reporting success to a user. The
  // Court's "set the watch" uses it to choose the WS path vs. the REST fallback.
  World.isConnected = function () { return !!(ws && ws.readyState === 1); };
  World.currentWorldId = function () { return World._worldId; };
  World.canBuild = function () { return World._canBuild !== false; };

  // ── WHO ELSE IS STANDING HERE ───────────────────────────────────────────────
  // The `others` map has always held every co-present player, and nothing has
  // ever been able to ASK it. Presence you can see but not address is scenery;
  // this is what turns a body across the clearing into a person you can deal
  // with. Sorted by distance because the person you mean is nearly always the
  // nearest one, and distance is what the server checks for trade range anyway.
  World.peers = function () {
    const me = World._selfBody && World._selfBody.position;
    const out = [];
    for (const [id, O] of others) {
      const p = O.group && O.group.position;
      const dist = (me && p) ? Math.hypot(p.x - me.x, p.z - me.z) : Infinity;
      out.push({ id, name: O.name || 'someone', x: p ? p.x : 0, z: p ? p.z : 0, dist });
    }
    return out.sort((a, b) => a.dist - b.dist);
  };
  World.nearestPeer = function () { return World.peers()[0] || null; };

  // ── THE LOOM VERBS ──────────────────────────────────────────────────────────
  // weave(): no count means "weave everything I can", which is the gesture
  // players actually make; the server clamps to what they hold before a single
  // item moves, so an over-ask is never an error. kindle(): the deterministic
  // ember, expensive in both ledgers — a project, never a purchase.
  World.weave = function (count) {
    return World.send(count != null ? { t: 'world:weave', count: Math.max(1, count | 0) } : { t: 'world:weave' });
  };
  World.kindle = function () { return World.send({ t: 'world:kindle' }); };

  // THE TRADE VERBS. Thin by design — every rule (same room, escrow, one open
  // table per player, who may ready) is enforced server-side in ledger.js, and
  // the client is not permitted a second opinion about any of it. It asks; the
  // server rules; the table comes back as `vint:world-trade`.
  World.trade = {
    open:   function (targetId) { return World.send({ t: 'world:trade:open', target: String(targetId) }); },
    // `count` is ABSOLUTE ("put 3 strand on the table"), never a delta — matches
    // ledger.offer, and is the only reading that survives a double-tap.
    offer:  function (tradeId, item, count) { return World.send({ t: 'world:trade:offer', tradeId: tradeId, item: String(item), count: Math.max(0, count | 0) }); },
    ready:  function (tradeId, on) { return World.send({ t: 'world:trade:ready', tradeId: tradeId, ready: on !== false }); },
    cancel: function (tradeId) { return World.send({ t: 'world:trade:cancel', tradeId: tradeId }); },
  };

  // ── THE RECKONING: who is standing near me ──────────────────────────────────
  // Every OTHER PERSON in this room, nearest first. Same discipline as
  // World.traces(): the HUD walks this instead of keeping its own copy of the
  // truth, so there is exactly one registry of who is here.
  //
  // AGENTS ARE DELIBERATELY EXCLUDED. `others` holds human peers; `agents` holds
  // the council's beings. The knife is only ever offered against a person who
  // can consent to the ground they are standing on — an agent cannot walk into a
  // march of its own will, so it can never be a target. That exclusion is the
  // client half of "consent is geographic"; the server enforces the rest.
  World.nearby = function () {
    const out = [];
    for (const [id, O] of others) {
      if (!O || !O.group) continue;
      out.push({
        id: id,
        name: O.name || 'someone',
        dist: Math.hypot(O.group.position.x - me.x, O.group.position.z - me.z),
      });
    }
    out.sort((a, b) => a.dist - b.dist);
    return out;
  };

  // ── THE COVENANT VERBS ──────────────────────────────────────────────────────
  // Thin, honest askers. NONE of these decides anything: each one states an
  // intent and the server rules on it (factions.js). The client cannot know
  // whether a strike is lawful — soil, grace windows, kill cooldowns, distance
  // and blood all live server-side — so it never pretends to. It asks, and it
  // renders the answer, including the refusal.
  //
  // The victim's POSITION is never sent. The server resolves the target from
  // that peer's own live socket, so a client can't name someone who isn't
  // actually standing beside it in contested ground.
  World.strike = function (targetId) {
    return World.send({ t: 'world:strike', target: String(targetId || '') });
  };
  World.bank = function () { return World.send({ t: 'world:bank' }); };
  World.soil = function () { return World.send({ t: 'world:soil' }); };
  World.joinCovenant = function (key) {
    return World.send({ t: 'world:covenant:join', key: String(key || '') });
  };
  World.propose = function (policy) {
    return World.send({ t: 'world:policy:propose', policy: String(policy || '') });
  };
  // Ask what is currently before the body. The answer arrives as
  // vint:world-proposals (and is cached on World._proposals).
  World.proposals = function () { return World.send({ t: 'world:policy:list' }); };
  // A vote is a VOICE, and abstention is not a no — `inFavour` is explicit so a
  // caller can never accidentally cast the opposite of what a player tapped.
  World.vote = function (proposalId, inFavour) {
    return World.send({ t: 'world:policy:vote', proposalId: proposalId, inFavour: inFavour !== false });
  };
  World.execute = function (targetId, warrantId) {
    return World.send({ t: 'world:execute', target: String(targetId || ''), warrantId: warrantId });
  };

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
    // The presence id is per-SOCKET (the counter increments on every connect),
    // so it is dropped here and the new `hello` republishes both it and
    // World._selfId. The numeric user inside it does not change on a room hop —
    // only the socket does.
    selfId = null;
    World._selfId = null;
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
    try { if (global.AgentLife && global.AgentLife.reset) global.AgentLife.reset(); } catch (_) {}
    for (const O of others.values()) { try { scene.remove(O.group); } catch (_) {} }
    others.clear();
    for (const A of agents.values()) { try { scene.remove(A.group); } catch (_) {} }
    agents.clear();
    // the room's own court went with `agents` — forget the ids too, or the next
    // world's presence frame would think a stranger's agent is already standing.
    visiting.clear();
    for (const mesh of _structMeshes.values()) { try { World._scene.remove(mesh); } catch (_) {} }
    _structMeshes.clear();
    // the lanterns belong to the world we're leaving, not to the engine
    for (const mesh of _traceMeshes.values()) { try { World._scene.remove(mesh); } catch (_) {} }
    _traceMeshes.clear();
    if (World._selfBody) { try { scene.remove(World._selfBody); } catch (_) {} World._selfBody = null; }
    // reset self to the spawn ring so we don't arrive standing where we left the last world
    me.x = 0; me.z = 2.5; me.yaw = Math.PI; me.y = 0;
    if (global.VintinuumVoice && global.VintinuumVoice.clearPeers) { try { global.VintinuumVoice.clearPeers(); } catch (_) {} }
  }

  World.claimHere = function () { World.send({ t: 'world:claim', x: World._me ? World._me.x : 0, z: World._me ? World._me.z : 0 }); };
  World.placeHere = function (kind) { const me = World._me || {}; World.send({ t: 'world:place', kind, x: me.x || 0, z: me.z || 0, rot: me.yaw || 0 }); };
  World.harvest = function () { World.send({ t: 'world:harvest' }); };
  World.refine = function (amount) { World.send({ t: 'world:refine', amount: amount || null }); };
  // THE VIGIL — tend your court. Pass an agentId to set one watch, or nothing to
  // set them all. The server refreshes every watch and kindles the clearing; the
  // reply drives the light. This is the survival loop's headline verb.
  World.tend = function (agentId) { return World.send({ t: 'world:tend', agentId: agentId || null }); };
  World.living = function () { return World._living || null; };

  let _lastSent = 0;
  function _sendMove() {
    const now = performance.now();
    if (now - _lastSent < 100 || !ws || ws.readyState !== 1) return; // 10Hz cap
    _lastSent = now;
    ws.send(JSON.stringify({ t: 'move', x: me.x, y: (me.y || 0), z: me.z, yaw: me.yaw }));
  }
  World.say = function (text) {
    // CLIENT-SIDE REACTIVITY (never dead while the reply generates): the moment
    // you speak, the nearest in-earshot agent visibly attends — turns to you,
    // holds a thinking shimmer + rising thought-wisps — so the ~2s until the
    // brain's reply lands feels ALIVE, not silent. The real reply arrives via the
    // `speech` WS event (server-authoritative) and snaps them into a speaking beat.
    try { if (global.AgentLife && global.AgentLife.isReady && global.AgentLife.isReady()) global.AgentLife.onPlayerSay(text); } catch (_) {}
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'say', text }));
  };
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
      // estimate speed from positional delta so a TRAVELING agent walks and a
      // resting one idles — no more everyone-stuck-on-idle. (agent-life sets the
      // targets; the lerp moves them; we read the motion back into the gait.)
      const apx = A.group.position.x, apz = A.group.position.z;
      lerp(A.group, A.target);
      const amoved = Math.hypot(A.group.position.x - apx, A.group.position.z - apz) / Math.max(dt, 0.001);
      const ud = A.group.userData;
      const dist = Math.hypot(A.group.position.x - camPos.x, A.group.position.z - camPos.z);
      if (ud && ud.rig) {
        const near = dist < 14;
        const gait = amoved > 3.4 ? 'run' : (amoved > 0.28 ? 'walk' : 'idle');
        // far agents: tick every 3rd frame with scaled dt (still alive, cheaper)
        if (near || (World._frame % 3 === 0)) {
          ud.rig.play(gait);
          if (ud.rig.setRate) ud.rig.setRate(gait === 'idle' ? 1 : Math.max(0.5, amoved / (gait === 'run' ? RUN_SPEED : WALK_SPEED)));
          ud.rig.update(near ? dt : dt * 3);
        }
      }
    }
    // drive the living layer AFTER the lerp (personalities, rituals, wisps,
    // player-regard, earshot glow, listen/speak arcs). Cheap; guarded.
    if (global.AgentLife && global.AgentLife.isReady && global.AgentLife.isReady()) {
      try { global.AgentLife.tick(dt, tnow); } catch (_) {}
    }
    World._frame = (World._frame || 0) + 1;
    if (World._motes) World._motes.rotation.y += dt * 0.02;
    _stepWarmth(dt);   // THE VIGIL: spark → light, eased every frame
    _stepWarp(dt);
    _stepTraces(tnow);

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

  // ── THE BEING FORGE ──────────────────────────────────────────────────────────
  // Open the creator. This ALWAYS opens something — the old code bailed silently
  // for anyone without an avatar (i.e. everyone). Now:
  //   • a being WITH a generated face → seat/adjust it (offsetY/X, size, turn)
  //     AND sculpt its head proportions + recolor the figure.
  //   • a fresh being with NO face → still a full creation flow: sculpt the head
  //     (wide/long/round), curate the colors of YOURSELF and each council agent,
  //     live on the 3D presence. "Provide your own face to your being."
  // Returns a live-preview harness so the panel can drive the rig without a rebuild.
  World.editHead = function () {
    if (!window.HeadEditor) { console.warn('[world] HeadEditor not loaded'); return false; }
    // THE MIRROR (2026-07-30): the forge felt dead because the default camera sits
    // BEHIND you — you sculpted the back of your own head. While the forge is open
    // the clearing turns to face you (selfie cam); closing restores your view.
    const prevCam = World._camMode || 0;
    World._camMode = 2;
    window.HeadEditor.open({
      onClose: () => { World._camMode = prevCam; },
      avatarId: World._myAvatarId || null,      // may be null — the forge still opens
      hasFace: !!World._myAvatarId,
      adjust: World._myHeadAdjust || null,
      morph: World._myMorph || null,
      tint: World._myTint || null,
      base: _base(),
      // live-preview harness — the panel drives THESE, we route to the right target
      preview: {
        // seat/adjust the generated face (existing molded-head editor path)
        setHeadAdjust: (adj) => { try { if (World._selfRig && World._selfRig.setHeadAdjust) World._selfRig.setHeadAdjust(adj); } catch (_) {} },
        // sculpt head proportions — rig if faced, else the sculpted placeholder head
        setMorph: (morph) => { World._myMorph = morph; _forgeApplyMorph(morph); },
        // recolor: 'self' tints your figure; an agent id tints that council member
        setTint: (who, tint) => { _forgeApplyTint(who, tint); if (who === 'self') World._myTint = tint; },
      },
      // the council roster the panel offers color-curation for
      agents: [...agents.entries()].map(([id, A]) => ({ id, name: A.name })),
    });
    return true;
  };

  // apply a head morph to the self presence (rig bust if present, else the sculpted
  // head — whether it's still on the placeholder body or perched on the head bone)
  function _forgeApplyMorph(morph) {
    if (!morph) return;
    try {
      if (World._selfRig && World._selfRig.setMorph && World._selfRig.bust) { World._selfRig.setMorph(morph); return; }
      const sb = World._selfBody;
      let head = sb && sb.userData && sb.userData.sculptHead;              // perched on the bone
      if (!head) { const ph = sb && sb.userData && sb.userData.placeholder; head = ph && ph.userData && ph.userData.__forgeHead; }
      if (head) {
        const b = head.userData.__forgeBaseScale || { x: 1, y: 1, z: 1 };
        const boneComp = (head.parent && head.parent.isBone) ? (1 / (head.parent.getWorldScale(new THREE.Vector3()).y || 1)) * 0.9 : 1;
        const wide  = Math.max(0.5, Math.min(1.8, +morph.headWide  || 1));
        const long  = Math.max(0.5, Math.min(1.8, +morph.headLong  || 1));
        const round = Math.max(0.5, Math.min(1.8, +morph.headRound || 1));
        head.scale.set(b.x * wide * boneComp, b.y * long * boneComp, b.z * round * boneComp);
      }
    } catch (_) {}
  }

  // apply a color tint. who='self' → your figure; else an agent id → that presence.
  function _forgeApplyTint(who, tint) {
    try {
      if (who === 'self') {
        if (World._selfRig && World._selfRig.setTint) { World._selfRig.setTint(tint); }
        const sb = World._selfBody;
        // tint the sculpt head's material (perched or on the placeholder body)
        const c = new THREE.Color(tint);
        const head = sb && sb.userData && sb.userData.sculptHead;
        if (head && head.material) { head.material.color.copy(c); if (head.material.emissive) head.material.emissive.copy(c).multiplyScalar(0.45); }
        const ph = sb && sb.userData && sb.userData.placeholder;
        const mat = ph && ph.userData && ph.userData.__forgeMat;
        if (mat) { mat.color.copy(c); if (mat.emissive) mat.emissive.copy(c).multiplyScalar(0.45); }
        return;
      }
      const A = agents.get(who);
      if (A && A.group) {
        const ud = A.group.userData;
        if (ud && ud.rig && ud.rig.setTint) ud.rig.setTint(tint);
        // also retint the presence glow light + ring so the recolor reads instantly
        const c = new THREE.Color(tint);
        A.group.traverse(o => {
          if (o.isPointLight) o.color.copy(c);
          if (o === (ud && ud.ring) && o.material) o.material.color.copy(c);
        });
      }
    } catch (_) {}
  }
  // expose so the head editor's persistence can read/write self morph+tint
  World.myBeing = function () { return { avatarId: World._myAvatarId || null, morph: World._myMorph || null, tint: World._myTint || null }; };

  // restore a saved being look (sculpt morph + self/agent tints) from localStorage,
  // so the being you forged persists across reloads without a server round-trip.
  function _reapplySavedBeing() {
    try {
      const morph = JSON.parse(localStorage.getItem('vint:being:morph') || 'null');
      const tint  = JSON.parse(localStorage.getItem('vint:being:tint') || 'null');
      const aTints = JSON.parse(localStorage.getItem('vint:being:agentTints') || '{}') || {};
      if (morph) { World._myMorph = morph; _forgeApplyMorph(morph); }
      if (tint)  { World._myTint = tint;  _forgeApplyTint('self', tint); }
      for (const aid in aTints) _forgeApplyTint(aid, aTints[aid]);
    } catch (_) {}
  }
  // agents can appear AFTER the self body (via hello/ambient) — re-tint them when they land
  World._reapplySavedBeing = _reapplySavedBeing;

  // ══════════════════════════════════════════════════════════════════════════
  // THE COURT — the user's OWN agents, brought in from any AI company on earth,
  // standing in their world as real presences. AETHERHOLD, 2026-08-02.
  //
  // These ride the SAME `agents` Map the council uses, so everything already
  // built for a presence applies for free: AgentLife lazily brains any id it
  // finds (unknown ids fall to DEFAULT_PERSONA — they drift, rest, regard the
  // player, and muse), _frame() lerps + gaits them, the speech router lights
  // whoever spoke, and _reapplySavedBeing tints them. Zero second animation
  // system — the court is alive the instant it's placed.
  //
  // COURT IDS are namespaced `uagent:<uuid>` (never collides with `agent:*`
  // council ids or `presence-*` forms), so hello/ambient teardown — which only
  // ever removes ITS OWN roster — can't evict them, and courtClear() below is
  // the only thing that does.
  // ══════════════════════════════════════════════════════════════════════════
  const court = new Set();  // ids in `agents` that belong to the user's court

  // NON-COLLIDING PLACEMENT (the No-Collision Law, in 3D). A golden-angle spiral
  // about the anchor: successive members are 137.5° apart with radius growing as
  // sqrt(i), which is the densest arrangement that still guarantees a monotone
  // minimum separation — no two court members can ever occupy the same ground,
  // and none lands inside the COUNCIL_KEEPOUT radius where the council stands.
  // Constants verified by simulation over 200 members (the worst case the API
  // can return, LIMIT 200): minimum court-to-court separation 3.64m, and minimum
  // 5.04m clearance from every council home anchor + the bench/centre/edge POIs
  // that AgentLife walks the council to. Nothing can ever stand on anything.
  const COURT_R0 = 7.5;          // first ring distance — outside the council's ground
  const COURT_STEP = 1.9;        // growth per sqrt(index) — holds ≥3.6m apart at N=200
  const COURT_KEEPOUT = 7.5;     // never spawn inside the council's clearing
  function _courtSlot(i, anchor) {
    const ga = 2.399963229728653;                      // golden angle (radians)
    const r = Math.max(COURT_KEEPOUT, COURT_R0 + COURT_STEP * Math.sqrt(i));
    const th = i * ga;
    return { x: anchor.x + Math.cos(th) * r, z: anchor.z + Math.sin(th) * r, yaw: Math.atan2(anchor.x - Math.cos(th) * r, anchor.z - Math.sin(th) * r) };
  }
  // the anchor is the user's claim if they have one, else where they spawned.
  function _courtAnchor() {
    const r = World._resident;
    if (r && r.claim_x != null && r.claim_z != null) return { x: +r.claim_x || 0, z: +r.claim_z || 0 };
    if (r && r.claimX != null && r.claimZ != null) return { x: +r.claimX || 0, z: +r.claimZ || 0 };
    return { x: 0, z: 0 };
  }

  // Place (or re-place) the whole court. Idempotent and diffing: agents already
  // standing keep their position and their AgentLife brain (so re-syncing the
  // roster never teleports or resets anyone); only new arrivals get spawned and
  // only departed ones get removed.
  //   list: [{ id, name, form, color }]
  World.courtSync = function (list) {
    if (!scene || !THREE) return { added: 0, removed: 0, total: court.size };
    const want = new Map();
    (Array.isArray(list) ? list : []).forEach(a => { if (a && a.id) want.set(String(a.id), a); });
    let added = 0, removed = 0;

    // remove the departed (court-owned ids only — never touch council/ambient)
    for (const id of [...court]) {
      if (want.has(id)) continue;
      const A = agents.get(id);
      if (A) { try { scene.remove(A.group); } catch (_) {} agents.delete(id); }
      try { if (global.AgentLife && global.AgentLife.forget) global.AgentLife.forget(id); } catch (_) {}
      court.delete(id);
      removed++;
    }

    // place the arrived, into free golden-angle slots (skipping taken indices so
    // an add never lands on someone already standing)
    const anchor = _courtAnchor();
    let slot = 0;
    const taken = new Set();
    for (const id of court) { const A = agents.get(id); if (A && A.slotIdx != null) taken.add(A.slotIdx); }
    for (const [id, a] of want) {
      if (agents.has(id)) continue;                    // already standing — leave them be
      while (taken.has(slot)) slot++;
      taken.add(slot);
      const p = _courtSlot(slot, anchor);
      let g;
      try { g = _makeAgentPresence({ id, name: a.name || 'agent', form: a.form || 'presence-child-refractive' }); }
      catch (e) { console.warn('[world] court presence failed:', id, e && e.message); continue; }
      g.position.set(p.x, 0, p.z);
      g.rotation.y = p.yaw;
      scene.add(g);
      agents.set(id, { group: g, target: { x: p.x, z: p.z, yaw: p.yaw }, name: a.name || 'agent', slotIdx: slot });
      court.add(id);
      // their chosen light — tint immediately so the payoff is instant
      if (a.color) { try { _forgeApplyTint(id, a.color); } catch (_) {} }
      added++;
    }
    return { added, removed, total: court.size };
  };

  // ── THE VISITED COURT ───────────────────────────────────────────────────────
  // The agents the SERVER says are standing in the world we're currently in. In
  // your own world that is your court (already placed by courtSync, so this is a
  // no-op — `agents.has(id)` skips them). In someone else's, it is THEIRS, and
  // this is the only path that can ever put them on screen: they are not in this
  // browser's roster and never will be.
  //
  // Kept in its own set so the two populations can never be confused. `court` is
  // MY court, placed from /api/agents/mine and owned by court.js; `visiting` is
  // whatever room we're standing in, owned entirely by the wire. On travel,
  // _teardownRoom clears `agents` wholesale and this set with it — you never
  // carry a stranger's court home.
  const visiting = new Set();
  function _syncVisitingCourt(list) {
    if (!scene || !THREE) return;
    const seen = new Set();
    for (const a of (Array.isArray(list) ? list : [])) {
      // ONLY court frames may spawn. A council presence the client hasn't been
      // introduced to by `hello` is still ignored — that stays a closed set.
      if (!a || !a.id || !a.court) continue;
      const id = String(a.id);
      seen.add(id);
      if (agents.has(id)) continue;            // already standing (mine, or spawned last tick)
      let g;
      try { g = _makeAgentPresence({ id, name: a.name || 'agent', form: a.form || 'presence-child-refractive' }); }
      catch (e) { continue; }                   // a presence that won't build is simply absent, never a throw
      g.position.set(a.x || 0, 0, a.z || 0);
      g.rotation.y = a.yaw || 0;
      // A RESTING WATCH stands dimmed, never missing. The consequence tier
      // already made this promise on the owner's own HUD ("nothing is ever
      // lost, a dim world just can't keep them all awake") and a visitor must
      // see the same world the keeper does, or the tier is a lie told to one
      // person. Opacity only — the being is fully there, just asleep.
      if (a.resting) { try { _dimPresence(g, 0.3); } catch (_) {} }
      scene.add(g);
      agents.set(id, { group: g, target: { x: a.x || 0, z: a.z || 0, yaw: a.yaw || 0 }, name: a.name || 'agent' });
      visiting.add(id);
      if (a.color) { try { _forgeApplyTint(id, a.color); } catch (_) {} }
    }
    // Remove the departed — but ONLY ones this path spawned. An agent that left
    // the owner's court (paused, archived) stops being broadcast and stops
    // standing; my own court and the council are untouched by construction.
    for (const id of [...visiting]) {
      if (seen.has(id)) continue;
      const A = agents.get(id);
      if (A) { try { scene.remove(A.group); } catch (_) {} agents.delete(id); }
      try { if (global.AgentLife && global.AgentLife.forget) global.AgentLife.forget(id); } catch (_) {}
      visiting.delete(id);
    }
  }
  // Dim a whole presence group in place (a resting watch). Materials are cloned
  // by _makeAgentPresence per-instance, so this can never bleed onto another being.
  function _dimPresence(group, opacity) {
    group.traverse(o => {
      if (!o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(mt => { if (!mt) return; mt.transparent = true; mt.opacity = Math.min(mt.opacity == null ? 1 : mt.opacity, opacity); });
    });
  }
  // how many beings are standing in this world that aren't mine (HUD copy)
  World.visitingCount = function () { return visiting.size; };

  // Where does this court member stand right now? (null if not placed.)
  World.courtPos = function (id) {
    const A = agents.get(String(id));
    if (!A || !A.group) return null;
    return { x: A.group.position.x, z: A.group.position.z };
  };
  World.courtIds = function () { return [...court]; };

  // FOCUS — walk the player's gaze to a court member. We don't seize the camera
  // (that would fight the camera-mode contract and could strand a user looking at
  // nothing); we turn the player to FACE them and pull them into third-person, so
  // the existing trailing camera does the framing. Reversible, never a hijack.
  World.courtFocus = function (id) {
    const p = World.courtPos(id);
    if (!p) return false;
    const dx = p.x - me.x, dz = p.z - me.z;
    if (Math.hypot(dx, dz) < 0.05) return true;
    me.yaw = Math.atan2(dx, dz);
    World._camMode = 0;                    // third-person frames another being best
    if (World._selfBody) World._selfBody.visible = true;
    return true;
  };

  // Make a court member SPEAK in the clearing — the reply from their own model,
  // routed through the same speech path the council uses, so it lights the right
  // presence and lands in the page's feed as a citizen's line, not a chat bubble.
  World.courtSpeak = function (id, text, name) {
    if (!text) return;
    try { _onAgentSpeech({ t: 'speech', actorId: String(id), name: name || (agents.get(String(id)) || {}).name || 'agent', text: String(text), kind: 'agent' }); }
    catch (e) { console.warn('[world] court speech failed:', e && e.message); }
  };

  function _resize(mountEl) {
    const w = mountEl.clientWidth || innerWidth, h = mountEl.clientHeight || innerHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }

  global.VintinuumWorld = World;
})(window);
