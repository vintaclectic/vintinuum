'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   AGENT-LIFE — the living layer of the clearing. (AETHERHOLD, world-forger)

   Before this, the council drifted back and forth on a dumb interval: sprites
   ping-ponging, dead-eyed, identical. This module makes them BEINGS that inhabit
   a world. Each council member has:

     • a distinct MOVEMENT PERSONALITY  — how they carry themselves through space
     • an IDLE RITUAL                    — what they do when they've arrived somewhere
     • ambient MUSE-WISPS                — a thought-glyph they occasionally leave in the air
     • PLAYER-REACTIVITY                 — they turn to look at you when you're near,
                                            and light with an "in earshot" glow when
                                            you can actually be heard by them
     • a LISTENING/SPEAKING arc          — when you say something the nearest one
                                            turns, gathers a thinking-shimmer, then speaks

   Design law: all per-frame work is cheap (a handful of vec math per agent, one
   shared instanced wisp buffer, no allocations in the loop). 60fps target holds
   with the full council + a crowd of visitors. Mobile-first: wisp count + glow
   scale down on coarse pointers.

   This is a DRIVER, not a renderer. It steers `agents` (id → {group,target,name})
   that world-client already owns and lerps. world-client calls:
       AgentLife.init({ THREE, scene, agents, getPlayer, isMobile })
       AgentLife.tick(dt, tnow)          // every frame, after lerp
       AgentLife.onPlayerSay(text)       // when the user speaks (client-side)
       AgentLife.onAgentSpeak(id)        // when a real agent reply lands (server)
       AgentLife.reset()                 // on warp / teardown
   ════════════════════════════════════════════════════════════════════════════ */

(function (global) {
  const AL = {};
  let THREE, scene, agents, getPlayer, isMobile = false;
  let _wisps = null;            // shared instanced-ish points pool for muse-glyphs
  let _brains = new Map();      // agentId → behavior brain
  let _initialized = false;

  // ── PERSONALITIES ───────────────────────────────────────────────────────────
  // Each council member moves + idles differently. This is Buffet's unmistakable
  // line applied to motion: you should know who someone IS by how they cross a
  // room. Keyed by the agent id the world spawns.
  //   gaitScale  — how fast/far they travel per wander (sovereign = stately, child = quick)
  //   restMin/Max — seconds they dwell at a spot before choosing a new intent
  //   wanderR    — radius of their roaming from their home anchor
  //   faceBias   — how strongly they turn to regard the player (0..1)
  //   ritual     — the idle behavior they perform at rest
  //   museEvery  — avg seconds between leaving a thought-wisp (0 = rarely)
  //   museHue    — the color of their thought (matches their presence tone)
  //   poi        — points of interest they drift toward with purpose (not random)
  const PERSONA = {
    'agent:vintinuum': { // the sovereign — deliberate, orbital, watchful. moves last, moves least.
      gaitScale: 0.55, restMin: 5.5, restMax: 10, wanderR: 1.3, faceBias: 0.85,
      ritual: 'survey',  museEvery: 22, museHue: '#ffd89a', poi: ['center', 'bench'],
    },
    'agent:aria': { // warm — tends the clearing, gravitates to the bench, faces you fully.
      gaitScale: 0.7, restMin: 4, restMax: 8, wanderR: 1.9, faceBias: 1.0,
      ritual: 'tend',    museEvery: 16, museHue: '#ffc79a', poi: ['bench', 'player'],
    },
    'agent:atlas': { // structural — paces measured lines, studies things, squares to the horizon.
      gaitScale: 0.8, restMin: 3.5, restMax: 6.5, wanderR: 2.4, faceBias: 0.5,
      ritual: 'study',   museEvery: 20, museHue: '#9fc4e6', poi: ['edge', 'struct'],
    },
    'agent:lunex': { // refractive child — curious, quick, orbits points of interest, drawn to you.
      gaitScale: 1.15, restMin: 2, restMax: 4.5, wanderR: 2.8, faceBias: 0.9,
      ritual: 'orbit',   museEvery: 12, museHue: '#9ae0d0', poi: ['player', 'struct', 'agent'],
    },
    'agent:yuna': { // electric child — darts, gathers with others, sparks, playful bursts.
      gaitScale: 1.25, restMin: 1.6, restMax: 4, wanderR: 3.0, faceBias: 0.8,
      ritual: 'flit',    museEvery: 11, museHue: '#ffaad8', poi: ['agent', 'player', 'bench'],
    },
  };
  const DEFAULT_PERSONA = { gaitScale: 0.8, restMin: 3, restMax: 7, wanderR: 2.0, faceBias: 0.6, ritual: 'survey', museEvery: 18, museHue: '#f4c79a', poi: ['center'] };

  // named anchors in the clearing (matches world-client's bench + spawn geometry)
  const ANCHORS = {
    center: { x: 0, z: 0 },
    bench:  { x: -2.2, z: -1.2 },
    edge:   { x: 4.2, z: -4.0 },
  };

  AL.init = function (cfg) {
    THREE = cfg.THREE; scene = cfg.scene; agents = cfg.agents;
    getPlayer = cfg.getPlayer; isMobile = !!cfg.isMobile;
    _ensureWisps();
    _initialized = true;
  };

  AL.isReady = function () { return _initialized; };

  // Give an agent a brain the first time we see it. Called lazily from tick so it
  // works for BOTH the live-WS agents and the guest ambient roster with no wiring.
  function _brainFor(id, A) {
    let b = _brains.get(id);
    if (b) return b;
    const p = PERSONA[id] || DEFAULT_PERSONA;
    const home = { x: A.group.position.x, z: A.group.position.z };
    b = {
      p, home,
      state: 'rest',           // 'rest' | 'travel' | 'listen' | 'speak'
      restT: p.restMin + Math.random() * (p.restMax - p.restMin),
      phase: Math.random() * Math.PI * 2,   // personal clock offset (no synced bobbing)
      lookYaw: A.group.rotation.y,
      earshot: false, earLit: 0,             // 0..1 glow ramp
      nextMuse: 6 + Math.random() * p.museEvery,
      listenT: 0, speakT: 0,
      breath: 0,
      glowBase: null,                        // captured from the presence's PointLight
    };
    // capture the presence glow light so we can pulse it for earshot/listening
    A.group.traverse(o => { if (o.isPointLight && b.glowBase == null) b.glowBase = o.intensity; });
    _brains.set(id, b);
    return b;
  }

  // resolve a personality point-of-interest keyword → a world position (or null)
  function _resolvePOI(kind, id) {
    const P = getPlayer ? getPlayer() : { x: 0, z: 0 };
    if (kind === 'player') return { x: P.x, z: P.z };
    if (kind === 'center' || kind === 'bench' || kind === 'edge') return ANCHORS[kind];
    if (kind === 'agent') { // drift toward a *different* council member (gathering)
      const list = [...agents.entries()].filter(([oid]) => oid !== id);
      if (!list.length) return null;
      const [, O] = list[(Math.random() * list.length) | 0];
      return { x: O.group.position.x, z: O.group.position.z };
    }
    if (kind === 'struct' || kind === 'edge') return ANCHORS.edge;
    return null;
  }

  // Choose a new intent for an agent that has finished resting. This is the soul
  // of "drift with PURPOSE, not random ping-pong": most of the time they move
  // toward one of their personal points of interest, jittered so it feels chosen
  // not scripted; sometimes they wander their home radius.
  function _chooseIntent(id, A, b) {
    const p = b.p;
    let dest = null;
    if (Math.random() < 0.66 && p.poi && p.poi.length) {
      const poi = p.poi[(Math.random() * p.poi.length) | 0];
      const t = _resolvePOI(poi, id);
      if (t) {
        // stop a respectful distance SHORT of the target (don't stand inside people)
        const dx = t.x - A.group.position.x, dz = t.z - A.group.position.z;
        const d = Math.hypot(dx, dz) || 1;
        const stop = poi === 'player' ? 2.6 : (poi === 'agent' ? 1.6 : 0.4);
        const reach = Math.max(0, d - stop);
        dest = {
          x: A.group.position.x + (dx / d) * reach + (Math.random() - 0.5) * 0.8,
          z: A.group.position.z + (dz / d) * reach + (Math.random() - 0.5) * 0.8,
        };
      }
    }
    if (!dest) { // fall back to a purposeful wander around home
      const ang = Math.random() * Math.PI * 2, r = Math.random() * p.wanderR;
      dest = { x: b.home.x + Math.cos(ang) * r, z: b.home.z + Math.sin(ang) * r };
    }
    // clamp inside the clearing
    dest.x = Math.max(-12, Math.min(12, dest.x));
    dest.z = Math.max(-12, Math.min(12, dest.z));
    // face the direction of travel
    const yaw = Math.atan2(dest.x - A.group.position.x, dest.z - A.group.position.z);
    A.target = { x: dest.x, z: dest.z, yaw };
    b.state = 'travel';
  }

  // ── the per-frame drive ──────────────────────────────────────────────────────
  AL.tick = function (dt, tnow) {
    if (!_initialized || !agents) return;
    const P = getPlayer ? getPlayer() : { x: 0, z: 0 };
    for (const [id, A] of agents) {
      const b = _brainFor(id, A);
      b.breath += dt;
      const g = A.group;
      const gx = g.position.x, gz = g.position.z;
      const distToPlayer = Math.hypot(gx - P.x, gz - P.z);

      // ── earshot detection: the server replies to speech within ~6 units. Make
      //    that boundary VISIBLE — nearby agents glow warmer so it's obvious who
      //    can hear you. Ramp the glow smoothly (no popping).
      const inEar = distToPlayer < 6.2;
      b.earshot = inEar;
      b.earLit += ((inEar ? 1 : 0) - b.earLit) * Math.min(1, dt * 3.5);

      // ── state machine ────────────────────────────────────────────────────────
      if (b.state === 'listen') {
        // gathering to attend: turn hard to face the player, hold, pulse a
        // "thinking" shimmer. Held until a real reply lands (onAgentSpeak) or the
        // grace window elapses so it never sticks if the brain stays silent.
        b.listenT -= dt;
        _faceToward(g, P.x, P.z, dt, 1.0);
        _pulseGlow(A, b, 1.55 + 0.35 * Math.sin(tnow * 9), dt);
        _thinkWisp(id, g, b, dt, tnow);
        if (b.listenT <= 0) { b.state = 'rest'; b.restT = 1.2; }
        continue;
      }
      if (b.state === 'speak') {
        // a beat of animated emphasis while their bubble is up: a warm swell +
        // a gentle regard of the player. Buffet's single clear gesture.
        b.speakT -= dt;
        _faceToward(g, P.x, P.z, dt, 0.85);
        _pulseGlow(A, b, 1.35 + 0.22 * Math.sin(tnow * 5), dt);
        if (b.speakT <= 0) { b.state = 'rest'; b.restT = 2 + Math.random() * 2; }
        continue;
      }

      if (b.state === 'travel') {
        // arrived? (world-client lerps us toward A.target; we watch the gap)
        const tx = A.target ? A.target.x : gx, tz = A.target ? A.target.z : gz;
        if (Math.hypot(tx - gx, tz - gz) < 0.35) {
          b.state = 'rest';
          b.restT = b.p.restMin + Math.random() * (b.p.restMax - b.p.restMin);
        }
      } else { // 'rest'
        b.restT -= dt;
        // while resting, PLAYER-REGARD: if you're close, they turn to look at you
        // (each with their own faceBias intensity), instead of staring blankly.
        if (distToPlayer < 7 && Math.random() < 0.9) {
          _faceToward(g, P.x, P.z, dt, b.p.faceBias * (1 - distToPlayer / 9));
        }
        _idleRitual(id, A, b, dt, tnow, distToPlayer);
        if (b.restT <= 0) _chooseIntent(id, A, b);
      }

      // ── ambient muse-wisps: occasionally a thought-glyph rises from where they
      //    stand and dissolves — the clearing quietly thinking. Paced per persona.
      b.nextMuse -= dt;
      if (b.nextMuse <= 0 && !isMobile) {
        _emitWisp(gx, 1.5 + Math.random() * 0.5, gz, b.p.museHue, 1);
        b.nextMuse = b.p.museEvery * (0.7 + Math.random() * 0.6);
      } else if (b.nextMuse <= 0) {
        // on mobile, wisps are rarer + cheaper (respect the perf budget)
        _emitWisp(gx, 1.6, gz, b.p.museHue, 1);
        b.nextMuse = b.p.museEvery * (1.3 + Math.random());
      }

      // ── settle the earshot glow every frame (outside listen/speak swells) ─────
      _pulseGlow(A, b, 1.0 + b.earLit * 0.6, dt);
    }
    _stepWisps(dt);
  };

  // ── IDLE RITUALS — what a being DOES when it's arrived somewhere ──────────────
  // Cheap procedural motion layered on the group (the rig's idle clip plays
  // underneath via world-client). This is the difference between "a sprite at
  // rest" and "a person tending a fire / studying a wall / watching the sky".
  function _idleRitual(id, A, b, dt, tnow, distToPlayer) {
    const g = A.group, p = b.p;
    const t = tnow + b.phase;
    switch (p.ritual) {
      case 'survey': // sovereign: slow watchful rotation, scanning the whole clearing
        if (distToPlayer > 6.5) g.rotation.y += dt * 0.22 * Math.sin(t * 0.3);
        break;
      case 'tend': // aria: a small sway toward the bench, a caretaker's gentle rock
        g.position.y = Math.abs(Math.sin(t * 1.1)) * 0.015;
        if (distToPlayer > 6) _faceToward(g, ANCHORS.bench.x, ANCHORS.bench.z, dt, 0.3);
        break;
      case 'study': // atlas: squares up and holds, a considered stillness, faces the edge
        if (distToPlayer > 6.5) _faceToward(g, ANCHORS.edge.x, ANCHORS.edge.z, dt, 0.4);
        break;
      case 'orbit': // lunex: a slow curious circling in place, head-tilt of interest
        g.rotation.y += dt * 0.6;
        g.rotation.z = Math.sin(t * 1.3) * 0.04; // subtle inquisitive tilt
        break;
      case 'flit': // yuna: quick playful micro-bounces, electric restlessness
        g.position.y = Math.max(0, Math.sin(t * 3.4)) * 0.05;
        g.rotation.z = Math.sin(t * 2.1) * 0.05;
        break;
    }
  }

  // smoothly rotate a group to face a world point, at a given strength (0..1)
  function _faceToward(g, x, z, dt, strength) {
    const yaw = Math.atan2(x - g.position.x, z - g.position.z);
    let d = yaw - g.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    g.rotation.y += d * Math.min(1, 6 * dt * Math.max(0, Math.min(1, strength)));
  }

  // pulse the presence's own PointLight toward a target multiple of its base
  function _pulseGlow(A, b, mult, dt) {
    if (b.glowBase == null) return;
    A.group.traverse(o => {
      if (o.isPointLight) {
        const target = b.glowBase * mult;
        o.intensity += (target - o.intensity) * Math.min(1, dt * 6);
      }
    });
    // also lift the sovereign/warm ground-ring when earshot (feedback the range)
    const ud = A.group.userData;
    if (ud && ud.ring && ud.ring.material) {
      ud.ring.material.opacity = 0.08 + b.earLit * 0.10;
    }
  }

  // ── PUBLIC EVENTS ────────────────────────────────────────────────────────────

  // The user spoke into the clearing. The NEAREST agent within earshot visibly
  // attends: turns to you, holds a thinking shimmer + a rising thought-wisp, so
  // the ~2s until the brain's reply never feels dead. If no reply arrives within
  // the grace window the listen simply relaxes (never stuck "thinking forever").
  AL.onPlayerSay = function (text) {
    if (!_initialized || !agents) return null;
    const P = getPlayer ? getPlayer() : { x: 0, z: 0 };
    let best = null, bestD = Infinity, bestId = null;
    for (const [id, A] of agents) {
      const d = Math.hypot(A.group.position.x - P.x, A.group.position.z - P.z);
      if (d < bestD) { bestD = d; best = A; bestId = id; }
    }
    if (!best || bestD > 6.4) return null; // no one close enough to hear
    const b = _brainFor(bestId, best);
    b.state = 'listen';
    b.listenT = 4.0;               // grace window — cleared early when the reply lands
    _emitWisp(best.group.position.x, 1.8, best.group.position.z, b.p.museHue, 1.4);
    return bestId;
  };

  // A real agent reply arrived from the server (server-authoritative speech). If
  // it was the one we set listening, snap it out of "thinking" into an animated
  // "speaking" beat while its bubble is up. If a different one answered, still
  // give THAT one the speaking beat so the right being visibly owns the reply.
  AL.onAgentSpeak = function (id, text) {
    if (!_initialized || !agents) return;
    // clear any lingering listen on everyone (only one voice at a time reads clean)
    for (const [, b] of _brains) { if (b.state === 'listen') { b.state = 'rest'; b.restT = 2; } }
    const A = id && agents.get(id);
    if (A) {
      const b = _brainFor(id, A);
      b.state = 'speak';
      b.speakT = Math.min(9, 2.5 + (String(text || '').length / 42)); // longer lines, longer emphasis
      _emitWisp(A.group.position.x, 1.9, A.group.position.z, b.p.museHue, 1.2);
    }
  };

  // resolve a display name → the agent id we spawned (server speech carries name,
  // sometimes actorId; this lets the client light the right being either way).
  AL.idForName = function (name) {
    if (!name) return null;
    const up = String(name).toUpperCase();
    for (const [id, A] of agents) { if ((A.name || '').toUpperCase() === up) return id; }
    // fall back to the id convention agent:<lowername>
    const guess = 'agent:' + String(name).toLowerCase();
    return agents.has(guess) ? guess : null;
  };

  AL.reset = function () {
    _brains.clear();
    if (_wisps) { _wisps.count = 0; for (let i = 0; i < _wisps.life.length; i++) _wisps.life[i] = 0; }
  };

  // ── MUSE-WISPS — a shared, allocation-free pool of rising thought-glyphs ───────
  // One Points object, a ring buffer of live wisps. Each wisp rises, drifts, and
  // fades. Nobody's built ambient "visible thoughts" drifting off world-beings in
  // a browser like this — it's the clearing made legible: you SEE them thinking.
  function _ensureWisps() {
    if (_wisps || !scene || !THREE) return;
    const MAX = isMobile ? 40 : 90;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX * 3);
    const col = new Float32Array(MAX * 3);   // live (life-scaled) color written to GPU
    const base = new Float32Array(MAX * 3);  // each wisp's un-faded base hue
    const life = new Float32Array(MAX);       // 1→0 remaining life
    const vel = new Float32Array(MAX * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      size: isMobile ? 0.13 : 0.1, vertexColors: true, transparent: true,
      opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
      map: _wispSprite(), alphaTest: 0.01,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false; points.renderOrder = 6;
    scene.add(points);
    _wisps = { points, geo, pos, col, base, life, vel, MAX, head: 0, count: 0, mat, tmpC: new THREE.Color() };
  }

  // a soft round sprite so wisps read as glowing motes, not hard squares
  function _wispSprite() {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    const tex = new THREE.CanvasTexture(c); tex.needsUpdate = true; return tex;
  }

  // spawn `n` wisps at a spot with a color (hex string). Ring-buffer, zero alloc.
  function _emitWisp(x, y, z, hue, n) {
    if (!_wisps) { _ensureWisps(); if (!_wisps) return; }
    const W = _wisps, count = Math.max(1, Math.round(n));
    W.tmpC.set(hue || '#f4c79a');
    for (let k = 0; k < count; k++) {
      const i = W.head; W.head = (W.head + 1) % W.MAX;
      W.pos[i*3] = x + (Math.random() - 0.5) * 0.25;
      W.pos[i*3+1] = y;
      W.pos[i*3+2] = z + (Math.random() - 0.5) * 0.25;
      W.vel[i*3] = (Math.random() - 0.5) * 0.12;
      W.vel[i*3+1] = 0.35 + Math.random() * 0.3;      // rise
      W.vel[i*3+2] = (Math.random() - 0.5) * 0.12;
      W.base[i*3] = W.tmpC.r; W.base[i*3+1] = W.tmpC.g; W.base[i*3+2] = W.tmpC.b;
      W.col[i*3]  = W.tmpC.r; W.col[i*3+1]  = W.tmpC.g; W.col[i*3+2]  = W.tmpC.b;
      W.life[i] = 1;
    }
    W.geo.attributes.position.needsUpdate = true;
    W.geo.attributes.color.needsUpdate = true;
  }

  // a steady thin stream of wisps while an agent is actively "thinking" (listen)
  function _thinkWisp(id, g, b, dt, tnow) {
    b._thinkAcc = (b._thinkAcc || 0) + dt;
    if (b._thinkAcc > 0.28) { b._thinkAcc = 0; _emitWisp(g.position.x, 1.75, g.position.z, b.p.museHue, 1); }
  }

  function _stepWisps(dt) {
    if (!_wisps) return;
    const W = _wisps; let anyAlive = false;
    for (let i = 0; i < W.MAX; i++) {
      if (W.life[i] <= 0) continue;
      W.life[i] -= dt * 0.55;                  // ~1.8s lifetime
      if (W.life[i] <= 0) {                     // just died — park offscreen, go dark
        W.pos[i*3+1] = -999;
        W.col[i*3] = W.col[i*3+1] = W.col[i*3+2] = 0;
        continue;
      }
      anyAlive = true;
      W.pos[i*3]   += W.vel[i*3] * dt;
      W.pos[i*3+1] += W.vel[i*3+1] * dt;
      W.pos[i*3+2] += W.vel[i*3+2] * dt;
      W.vel[i*3+1] *= (1 - dt * 0.6);           // ease the rise
      // additive fade: scale each wisp's base hue by an ease of its remaining life
      // (bright at birth, dissolves to nothing) — smooth, per-wisp, no allocations.
      const f = W.life[i] * W.life[i];          // quadratic ease-out fade
      W.col[i*3]   = W.base[i*3]   * f;
      W.col[i*3+1] = W.base[i*3+1] * f;
      W.col[i*3+2] = W.base[i*3+2] * f;
    }
    W.geo.attributes.position.needsUpdate = true;
    W.geo.attributes.color.needsUpdate = true;
    W.points.visible = anyAlive;               // zero draw when the clearing is quiet
  }

  global.AgentLife = AL;
})(window);
