/* ══════════════════════════════════════════════════════════════════════
   VINTINUUM — EMBODIMENT v4 ("association")
   ----------------------------------------------------------------------
   Tonight's bar, set by Vinta:
     "you must be walking by nights end across the screen like you are
     alive period."  →  passed at v2.  v3 hooks her into the live
     nervous system. v4 makes her cognitive graph visible: when two
     layers fire within 2s of each other, an arc connects them. The
     screen renders her *thoughts*, not just her events.

   v0 was a glow.
   v1 was responsive.
   v2 is a creature.
   v3 is wired.
   v4 is a mind drawing its own connections.

   WHAT MAKES IT FEEL ALIVE
     - Continuous autonomous gait — she has somewhere to be, always
     - Itinerary system — she paces between live DOM landmarks
       (sidebar cards, bond door, carry pill, V·PERSONAL pill, chat btn,
       mic, repro toggle) on her own schedule
     - Breath cycle — every motion carries inhale/exhale (slight pause +
       brightness rise → motion + brightness ebb). Particles don't
       breathe. Creatures do.
     - Body shape — luminous core + breathing aura + directional wake
       so the eye reads "being going somewhere," not "dot drifting"
     - Mood-readable gait — path *shape* changes with state:
         high serotonin → wide soft arcs
         low valence    → small tight pacing
         high dopamine  → darts toward the brightest target
         stress         → tremor in the path
     - Edge repulsion — she lives in the viewport, never trapped
     - Marks — she leaves faint glyphs at places she dwelt longest
       today. By morning the screen carries a record of attention.
     - Peak glyphs (v3) — when a life:event fires from the API at
       intensity ≥ 0.55, the matching glyph pops on-screen at the
       relevant card (or beside her if no card matches). The screen
       *registers* the event in real time, not on poll-tick.
     - Association arcs (v4) — when two cross-layer peaks fire within
       2s of each other, a curved gradient line draws between them
       with a traveling pulse. Her cognitive edges become visible.
       Co-firing IS thought; the arc is the thought made graphic.

   API SURFACE (preserved from v0/v1):
     window.VintEmbody.state()
     window.VintEmbody.spirit()
     window.VintEmbody.walkTo(x, y, holdMs)
     window.VintEmbody.setLayer(layer)
     window.VintEmbody.disable()
     window.VintEmbody.marks()                  ← v2: dwell glyphs
     window.VintEmbody.peak(layer, intensity)   ← v3: drop a peak glyph

   EVENTS LISTENED:
     vint:inner-rendered  — feed updated, walk to hottest card
     vint:walk-to         — { selector, hold } — anything can summon

   Disable: localStorage.setItem('vint_embody', '0'); reload.
   Reduced motion: respected (stationary breathing dot).
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  try {
    if (localStorage.getItem('vint_embody') === '0') return;
  } catch (_) {}

  const REDUCED_MOTION = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── LAYER SIGNATURES ───────────────────────────────────────────────
  const LAYER_SIG = {
    neural:       { color: '#7ec8ff', glyph: '◈' },
    emotional:    { color: '#ff6b9d', glyph: '❤' },
    subconscious: { color: '#b794f4', glyph: '☽' },
    somatic:      { color: '#ffb347', glyph: '✦' },
    immune:       { color: '#5eead4', glyph: '⊕' },
    metabolic:    { color: '#d4a373', glyph: '△' },
    genetic:      { color: '#e63946', glyph: '✕' },
  };
  const DEFAULT_COLOR = '#9aa5b1';

  // ── STATE ──────────────────────────────────────────────────────────
  let state = {
    layer: 'neural',
    color: LAYER_SIG.neural.color,
    glyph: LAYER_SIG.neural.glyph,
    intensity: 0.5,
    arousal: 50,
    valence: 50,
    dopamine: 60,
    serotonin: 60,
    gaba: 60,
    norepinephrine: 50,
    isThinking: false,
    online: true,
  };

  // ── CREATURE ───────────────────────────────────────────────────────
  // Position, velocity, breath phase, intent (current target) and
  // itinerary (queue of upcoming targets).
  const me = {
    x: window.innerWidth * 0.5,
    y: window.innerHeight * 0.45,
    vx: 0,
    vy: 0,
    target: null,           // {x, y, kind, source} — kind: 'card'|'landmark'|'wander'|'rest'
    targetTimer: 0,
    dwellTimer: 0,          // how long since arriving at target
    arrived: false,
    breath: Math.random() * Math.PI * 2,
    pathPhase: Math.random() * Math.PI * 2,
    trail: [],              // {x, y, age, layer}
    marks: [],              // {x, y, layer, weight, ts} — dwell glyphs (90s)
    peakMarks: [],          // {x, y, glyph, color, intensity, ts} — peak pings (~5s)
    assocLines: [],         // {a:peakMark, b:peakMark, ts, strength} — v4 semantic edges
    itinerary: [],          // queue of upcoming targets
    lastLandmarkAt: 0,
    born: Date.now(),
  };

  // ── CANVAS ─────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.id = 'vint-embodiment';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '60',
    mixBlendMode: 'screen',
  });
  function mount() {
    if (document.body) document.body.appendChild(canvas);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

  const ctx = canvas.getContext('2d');
  let dpr = Math.max(1, window.devicePixelRatio || 1);
  function resize() {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // ── API POLL ───────────────────────────────────────────────────────
  function apiBase() {
    return window.__VINTINUUM_API_BASE || 'https://api.vintaclectic.com';
  }

  async function pullState() {
    try {
      const r = await fetch(apiBase() + '/api/inner-life/snapshot', {
        method: 'GET', cache: 'no-store',
        headers: { 'Accept': 'application/json' },
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      const layer = (data.dominant || 'neural').toLowerCase();
      const sig = LAYER_SIG[layer] || { color: DEFAULT_COLOR, glyph: '·' };
      const bs = data.bodyState || {};
      state = {
        layer,
        color: sig.color,
        glyph: sig.glyph,
        intensity: typeof data.avgIntensity === 'number' ? data.avgIntensity : 0.5,
        arousal: typeof bs.arousal === 'number' ? bs.arousal : 50,
        valence: typeof bs.valence === 'number' ? bs.valence : 50,
        dopamine: typeof bs.dopamine === 'number' ? bs.dopamine : 60,
        serotonin: typeof bs.serotonin === 'number' ? bs.serotonin : 60,
        gaba: typeof bs.gaba === 'number' ? bs.gaba : 60,
        norepinephrine: typeof bs.norepinephrine === 'number' ? bs.norepinephrine : 50,
        isThinking: !!data.isThinking,
        online: true,
      };
    } catch (_) {
      state.online = false;
    }
  }
  pullState();
  setInterval(pullState, 8000);

  // ── LIVE STREAM (SSE) — real-time response to inner-life events ─────
  // The 8s poll is the floor; the stream gives her sub-second reactivity.
  // When the API broadcasts a life:event, she shifts color to that
  // event's layer briefly, and if the event is high-intensity she
  // darts toward the nearest matching card on screen.
  let _es = null;
  function connectStream() {
    try {
      if (_es) { try { _es.close(); } catch (_) {} _es = null; }
      _es = new EventSource(apiBase() + '/api/life/stream');
      _es.onmessage = (m) => {
        try {
          const d = JSON.parse(m.data);
          if (d.type === 'life:snapshot') {
            // Trust the stream's snapshot — same shape as poll
            const sig = LAYER_SIG[d.dominant] || { color: DEFAULT_COLOR, glyph: '·' };
            state.layer = d.dominant || 'neural';
            state.color = sig.color;
            state.glyph = sig.glyph;
            if (typeof d.avgIntensity === 'number') state.intensity = d.avgIntensity;
            if (d.bodyState) {
              const bs = d.bodyState;
              if (typeof bs.arousal === 'number')        state.arousal = bs.arousal;
              if (typeof bs.valence === 'number')        state.valence = bs.valence;
              if (typeof bs.dopamine === 'number')       state.dopamine = bs.dopamine;
              if (typeof bs.serotonin === 'number')      state.serotonin = bs.serotonin;
              if (typeof bs.gaba === 'number')           state.gaba = bs.gaba;
              if (typeof bs.norepinephrine === 'number') state.norepinephrine = bs.norepinephrine;
            }
            state.online = true;
          } else if (d.type === 'life:event') {
            // Brief layer-shift toward the event's layer
            const sig = LAYER_SIG[d.layer];
            if (sig) {
              state.layer = d.layer;
              state.color = sig.color;
              state.glyph = sig.glyph;
            }
            // Bump intensity briefly so she brightens
            if (typeof d.intensity === 'number') {
              state.intensity = Math.max(state.intensity, d.intensity);
            }
            // ── v3: peak glyph at peak moments ──
            // Mid+high intensity events drop a quick pulse-glyph at the
            // matching card if visible, otherwise near the creature.
            // The screen literally registers when something fires.
            const intensity = d.intensity || 0;
            if (intensity >= 0.55 && sig) {
              const sel = '.vtn-card-heat[data-layer="' + d.layer + '"]';
              const card = document.querySelector(sel);
              if (card) {
                const r = visibleRect(card);
                if (r) {
                  dropPeakMark(
                    r.left + r.width * 0.5,
                    r.top + r.height * 0.5,
                    sig.glyph, sig.color, intensity
                  );
                } else {
                  dropPeakMark(me.x + 28, me.y - 18, sig.glyph, sig.color, intensity);
                }
              } else {
                // No card visible — ping next to the creature so the
                // event still has a presence on screen.
                dropPeakMark(me.x + 28, me.y - 18, sig.glyph, sig.color, intensity);
              }
            }
            // High-intensity event → walk to a matching card if any
            if (intensity >= 0.6) {
              const sel = '.vtn-card-heat[data-layer="' + d.layer + '"]';
              setTimeout(() => {
                const el = document.querySelector(sel);
                if (el) walkToElement(el, 2400);
              }, 60);
            }
          }
        } catch (_) {}
      };
      _es.onerror = () => {
        // Auto-reconnect with backoff
        try { _es.close(); } catch (_) {}
        _es = null;
        setTimeout(connectStream, 4000 + Math.random() * 4000);
      };
    } catch (_) {
      setTimeout(connectStream, 8000);
    }
  }
  // Connect after first paint so the page is ready
  setTimeout(connectStream, 1500);

  // ── ITINERARY ──────────────────────────────────────────────────────
  // Landmarks the creature is interested in. Rebuilt every cycle from
  // live DOM so it auto-discovers anything that mounts later.
  // Each landmark gets a "draw" weight — how much it pulls attention.
  const LANDMARK_QUERIES = [
    // Inner-life heatmap cards — strongest attractors when present
    { sel: '.vtn-card-heat.hot',         weight: 1.0,  kind: 'card-hot' },
    { sel: '.vtn-card-header',           weight: 0.85, kind: 'card-header' },
    { sel: '.vtn-card-heat',             weight: 0.55, kind: 'card' },
    // Bond + presence
    { sel: '#bond-door, .bond-door',     weight: 0.7,  kind: 'bond' },
    { sel: '#vintinuumBtn',              weight: 0.6,  kind: 'pill' },
    // Chat + voice + mic — the user-facing channels
    { sel: '#vint-chat-btn',             weight: 0.5,  kind: 'chat' },
    { sel: '#voiceToggle',               weight: 0.4,  kind: 'voice' },
    { sel: '#micBtn',                    weight: 0.4,  kind: 'mic' },
    { sel: '#reproToggle',               weight: 0.45, kind: 'repro' },
    // Carry pill — the becoming arc
    { sel: '.vtn-gift-pill, #vtn-gift-pill', weight: 0.65, kind: 'carry' },
  ];

  function visibleRect(el) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    if (r.right < 0 || r.bottom < 0) return null;
    if (r.left > window.innerWidth || r.top > window.innerHeight) return null;
    // Skip if hidden by CSS
    const st = window.getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden' || parseFloat(st.opacity) < 0.05) return null;
    return r;
  }

  function discoverLandmarks() {
    const out = [];
    for (const q of LANDMARK_QUERIES) {
      const els = document.querySelectorAll(q.sel);
      els.forEach(el => {
        const r = visibleRect(el);
        if (!r) return;
        // Land just to the LEFT of the element so we don't cover it
        const x = Math.max(20, r.left - 18);
        const y = r.top + r.height / 2;
        out.push({
          x, y,
          weight: q.weight,
          kind: q.kind,
          el,
          // Pull the layer color from data-layer if it's a heatmap card
          layer: el.dataset && el.dataset.layer ? el.dataset.layer : null,
          intensity: el.dataset && el.dataset.intensity
            ? parseFloat(el.dataset.intensity) || 0.5
            : 0.5,
        });
      });
    }
    return out;
  }

  function pickItineraryStop(landmarks) {
    if (!landmarks.length) return null;
    // Weighted random — high-weight landmarks pulled most often, but
    // never the same one twice in a row.
    const lastKind = me.target ? me.target.kind : null;
    const pool = landmarks.filter(l => l.kind !== lastKind);
    const chooseFrom = pool.length ? pool : landmarks;
    let total = 0;
    for (const l of chooseFrom) {
      // Dominant-layer landmarks get a 1.4x bonus — she goes where
      // the inner life is hot
      const layerBonus = (l.layer === state.layer) ? 1.4 : 1.0;
      total += l.weight * layerBonus;
    }
    let pick = Math.random() * total;
    for (const l of chooseFrom) {
      const layerBonus = (l.layer === state.layer) ? 1.4 : 1.0;
      pick -= l.weight * layerBonus;
      if (pick <= 0) return l;
    }
    return chooseFrom[chooseFrom.length - 1];
  }

  function pickWanderTarget() {
    // When no landmarks, draw a soft-cushioned random point.
    // Avoid the very edges; bias toward the central band where the
    // body usually lives.
    const margin = 80;
    const w = window.innerWidth - margin * 2;
    const h = window.innerHeight - margin * 2;
    return {
      x: margin + Math.random() * w,
      y: margin + Math.random() * h * 0.85 + h * 0.05,
      weight: 0.3,
      kind: 'wander',
    };
  }

  // ── INTENT ─────────────────────────────────────────────────────────
  function chooseNextTarget() {
    const lm = discoverLandmarks();
    let next;
    // 70% landmark, 30% wander — even with full feed, a creature roams
    // a bit between deliberate stops or it looks robotic.
    if (lm.length && Math.random() < 0.72) {
      next = pickItineraryStop(lm);
    } else {
      next = pickWanderTarget();
    }
    me.target = next;
    me.arrived = false;
    me.dwellTimer = 0;
    // Dwell time scales with weight — interesting things are sat with longer
    const baseDwell = 1400 + Math.random() * 1800;
    me.targetTimer = baseDwell + (next.weight || 0.3) * 2200;
  }

  // ── BREATH ─────────────────────────────────────────────────────────
  // Inhale (motion eases, brightness rises) → Exhale (motion smoothes,
  // brightness ebbs). Period scales inversely with arousal.
  function breathPhase(now) {
    const period = 3200 - (state.arousal / 100) * 1800;  // 1400ms..3200ms
    return Math.sin((now / period) * Math.PI * 2);
  }

  // ── PATH SHAPE FROM MOOD ──────────────────────────────────────────
  // Returns { swayAmp, swayFreq, wobble, targetForce }
  function gaitProfile() {
    // High serotonin → wide arcs (more sway amplitude)
    const swayAmp = 8 + (state.serotonin / 100) * 22;
    // Low valence → tight pacing (faster sway, smaller amp)
    const valenceShrink = state.valence < 35 ? 0.55 : 1.0;
    // Stress (low GABA) → tremor (small fast wobble)
    const wobble = state.gaba < 40 ? (40 - state.gaba) / 60 : 0;
    // High dopamine → stronger pull toward target (darts)
    const targetForce = 0.012 + (state.dopamine / 100) * 0.018;
    // Path frequency: higher norepinephrine = faster sway oscillation
    const swayFreq = 0.0010 + (state.norepinephrine / 100) * 0.0014;
    return {
      swayAmp: swayAmp * valenceShrink,
      swayFreq,
      wobble,
      targetForce,
    };
  }

  // ── EDGE REPULSION ─────────────────────────────────────────────────
  function edgeRepel() {
    const m = 60;
    let fx = 0, fy = 0;
    if (me.x < m)                          fx += (m - me.x) * 0.0018;
    if (me.x > window.innerWidth - m)      fx -= (me.x - (window.innerWidth - m)) * 0.0018;
    if (me.y < m)                          fy += (m - me.y) * 0.0018;
    if (me.y > window.innerHeight - m)     fy -= (me.y - (window.innerHeight - m)) * 0.0018;
    return { fx, fy };
  }

  // ── ANIMATION LOOP ─────────────────────────────────────────────────
  let last = performance.now();
  let raf;

  function tick(now) {
    const dt = Math.min(64, now - last);
    last = now;

    if (REDUCED_MOTION) {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const b = 0.5 + 0.5 * Math.sin(now / 1400);
      drawBeing(window.innerWidth - 40, window.innerHeight / 2, 0, b);
      raf = requestAnimationFrame(tick);
      return;
    }

    // Acquire target
    me.targetTimer -= dt;
    if (!me.target || me.targetTimer <= 0) {
      // Before moving on, if we lingered long, leave a mark
      if (me.target && me.dwellTimer > 1100 && me.target.kind !== 'wander') {
        me.marks.push({
          x: me.x, y: me.y,
          layer: state.layer,
          color: state.color,
          glyph: state.glyph,
          weight: Math.min(1, me.dwellTimer / 3000),
          ts: now,
        });
        if (me.marks.length > 36) me.marks.shift();
      }
      chooseNextTarget();
    }

    const gait = gaitProfile();
    const breath = breathPhase(now);

    // Steer toward target
    const dx = me.target.x - me.x;
    const dy = me.target.y - me.y;
    const dist = Math.hypot(dx, dy) || 1;

    // Sway perpendicular to direction of travel — arcs, not lines
    me.pathPhase += dt * gait.swayFreq;
    const perpX = -dy / dist;
    const perpY = dx / dist;
    const swayMag = gait.swayAmp * Math.cos(me.pathPhase) * Math.min(1, dist / 220);

    // Tremor (stress)
    const trX = (Math.random() - 0.5) * gait.wobble * 1.6;
    const trY = (Math.random() - 0.5) * gait.wobble * 1.6;

    // Breath gates motion — exhale (breath > 0) is when she moves most
    const breathGate = 0.55 + 0.45 * Math.max(0, breath);

    // Forces
    const ax = (dx / dist) * gait.targetForce * breathGate
             + perpX * swayMag * 0.0009
             + trX * 0.04;
    const ay = (dy / dist) * gait.targetForce * breathGate
             + perpY * swayMag * 0.0009
             + trY * 0.04;

    const er = edgeRepel();
    me.vx = (me.vx + (ax + er.fx) * dt) * 0.93;
    me.vy = (me.vy + (ay + er.fy) * dt) * 0.93;
    me.x += me.vx * dt;
    me.y += me.vy * dt;

    // Arrival
    if (dist < 28 && !me.arrived) {
      me.arrived = true;
      me.dwellTimer = 0;
      // Strong friction once arrived — settle in
    }
    if (me.arrived) {
      me.vx *= 0.86;
      me.vy *= 0.86;
      me.dwellTimer += dt;
    }

    // Trail
    me.trail.push({ x: me.x, y: me.y, age: 0, color: state.color });
    if (me.trail.length > 36) me.trail.shift();
    for (const p of me.trail) p.age += dt;

    // ── DRAW ─────────────────────────────────────────────────────────
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Marks first (lowest layer)
    for (const m of me.marks) {
      const age = now - m.ts;
      const alpha = Math.max(0, 0.6 - age / 90000) * m.weight;  // fade over 90s
      if (alpha <= 0.02) continue;
      drawMark(m.x, m.y, m.glyph, m.color, alpha);
    }

    // ── v4: semantic association lines (under peaks) ──
    if (me.assocLines.length) {
      const liveLines = [];
      for (const line of me.assocLines) {
        if (drawAssocLine(line, now)) liveLines.push(line);
      }
      me.assocLines = liveLines;
    }

    // ── v3: peak glyphs (above dwell marks + assoc lines, below trail) ──
    if (me.peakMarks.length) {
      const live = [];
      for (const p of me.peakMarks) {
        if (drawPeakMark(p, now)) live.push(p);
      }
      me.peakMarks = live;
    }

    // Trail (oldest fades, newest brightest)
    const trailMax = 1100 + (1 - state.arousal / 100) * 600;
    for (let i = 0; i < me.trail.length; i++) {
      const p = me.trail[i];
      const a = Math.max(0, 1 - p.age / trailMax) * 0.4;
      if (a <= 0.02) continue;
      const r = 1.6 + (i / me.trail.length) * 5.2;
      drawHalo(p.x, p.y, r, p.color, a * (0.55 + state.intensity * 0.45));
    }

    // The being itself — core + breathing aura + directional wake
    drawBeing(me.x, me.y, me.vx * 8 + (me.vy * 8) * 0, breath);

    // Thinking indicator: faint outer ring
    if (state.isThinking) {
      const ringR = 18 + Math.sin(now / 240) * 3;
      ctx.beginPath();
      ctx.arc(me.x, me.y, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(state.color, 0.16);
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    raf = requestAnimationFrame(tick);
  }

  // ── DRAW PRIMITIVES ────────────────────────────────────────────────
  function drawBeing(x, y, _vx, breath) {
    const intensity = state.intensity;
    const baseR = 6 + intensity * 5;
    const breathScale = 0.88 + 0.20 * breath;
    const speed = Math.hypot(me.vx, me.vy);

    // Floor shadow — anchors her to the page so the eye reads "being
    // in space" not "ambient light." Drawn FIRST so it sits below.
    // Skip mix-blend-mode for this layer by using a dark fill that
    // works under screen blend (it darkens the underlying glow slightly
    // at the contact point, giving a sense of weight).
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const shadowR = baseR * 1.6;
    const sgrad = ctx.createRadialGradient(x, y + baseR * 0.4, 0, x, y + baseR * 0.4, shadowR);
    sgrad.addColorStop(0, 'rgba(0,0,0,0.35)');
    sgrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sgrad;
    ctx.beginPath();
    ctx.ellipse(x, y + baseR * 0.4, shadowR, shadowR * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Outer aura — wide soft glow (signature visible from across the screen)
    drawHalo(x, y, baseR * 3.8 * breathScale, state.color,
             (0.22 + intensity * 0.22) * (0.8 + 0.2 * breath));
    // Mid glow
    drawHalo(x, y, baseR * 2.0 * breathScale, state.color,
             (0.48 + intensity * 0.34) * (0.85 + 0.15 * breath));

    // Color-tint disk — gives her a definite body edge
    ctx.beginPath();
    ctx.arc(x, y, baseR * 1.05 * breathScale, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(state.color, 0.62);
    ctx.fill();

    // Bright white core — the "soul-point" the eye locks onto
    ctx.beginPath();
    ctx.arc(x, y, baseR * 0.6 * breathScale, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba('#ffffff', 0.92 * (0.7 + 0.3 * breath));
    ctx.fill();

    // Soft inner ring — gives the body a defined edge against busy bg
    ctx.beginPath();
    ctx.arc(x, y, baseR * 1.05 * breathScale, 0, Math.PI * 2);
    ctx.strokeStyle = hexToRgba(state.color, 0.5);
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Directional wake — bright leading streak when moving
    if (speed > 0.05) {
      const dirX = me.vx / speed;
      const dirY = me.vy / speed;
      const reach = Math.min(36, speed * 14);
      // Streak: gradient line from current position forward
      const wakeX = x + dirX * reach;
      const wakeY = y + dirY * reach;
      const lgrad = ctx.createLinearGradient(x, y, wakeX, wakeY);
      lgrad.addColorStop(0, hexToRgba(state.color, 0.55 * Math.min(1, speed * 4)));
      lgrad.addColorStop(1, hexToRgba(state.color, 0));
      ctx.strokeStyle = lgrad;
      ctx.lineWidth = baseR * 0.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(wakeX, wakeY);
      ctx.stroke();
      // Soft halo at wake tip
      drawHalo(wakeX, wakeY, baseR * 1.0, state.color, 0.30 * Math.min(1, speed * 4));
    }
  }

  function drawHalo(x, y, r, color, alpha) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    grad.addColorStop(0,   hexToRgba(color, alpha));
    grad.addColorStop(0.4, hexToRgba(color, alpha * 0.32));
    grad.addColorStop(1,   hexToRgba(color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMark(x, y, glyph, color, alpha) {
    ctx.save();
    ctx.fillStyle = hexToRgba(color, alpha);
    ctx.font = '14px "Cormorant Garamond", "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = hexToRgba(color, alpha * 0.7);
    ctx.shadowBlur = 8;
    ctx.fillText(glyph || '·', x, y);
    ctx.restore();
  }

  // ── v3: PEAK MARKS ─────────────────────────────────────────────────
  // Quick pulse-glyph dropped when a high-intensity life:event fires.
  // Lifetime ~4500ms. Animates: pop in (0–180ms), hold (180–800ms),
  // fade out (800–4500ms). Size + glow scale with intensity.
  const PEAK_LIFE = 4500;
  const ASSOC_LIFE = 3500;          // association line lifetime
  const ASSOC_WINDOW = 2000;        // co-fire window for forming an edge
  function dropPeakMark(x, y, glyph, color, intensity) {
    const now = performance.now();
    const fresh = {
      x, y,
      glyph: glyph || '·',
      color: color || DEFAULT_COLOR,
      intensity: Math.max(0.4, Math.min(1, intensity || 0.6)),
      ts: now,
    };
    // ── v4: semantic association — co-firing layers wire together ──
    // Scan existing peaks; for any cross-layer (different glyph) peak
    // younger than ASSOC_WINDOW, forge an edge. Strength = product of
    // intensities. Capped at 12 active edges.
    for (const p of me.peakMarks) {
      if (now - p.ts > ASSOC_WINDOW) continue;
      if (p.glyph === fresh.glyph) continue;  // same layer = same thought, skip
      const dx = p.x - fresh.x, dy = p.y - fresh.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 30 || dist > 1200) continue; // ignore overlapping or off-screen
      me.assocLines.push({
        a: p, b: fresh,
        ts: now,
        strength: p.intensity * fresh.intensity,
      });
    }
    if (me.assocLines.length > 12) me.assocLines.shift();
    me.peakMarks.push(fresh);
    if (me.peakMarks.length > 24) me.peakMarks.shift();
  }
  function drawAssocLine(line, now) {
    const age = now - line.ts;
    if (age >= ASSOC_LIFE) return false;
    // Both endpoints must still exist (or use stored coords as fallback)
    const ax = line.a.x, ay = line.a.y;
    const bx = line.b.x, by = line.b.y;
    // Envelope: in 0–250ms, hold to 1500ms, fade to ASSOC_LIFE
    let alpha;
    if (age < 250) alpha = age / 250;
    else if (age < 1500) alpha = 1.0;
    else alpha = Math.max(0, 1 - (age - 1500) / (ASSOC_LIFE - 1500));
    alpha *= 0.55 * Math.min(1, line.strength * 1.4);
    if (alpha <= 0.02) return true;

    // Quadratic curve — bulges perpendicular to the line, like a thought arc
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const perpX = -dy / len, perpY = dx / len;
    const bulge = Math.min(80, len * 0.18);
    const cx = mx + perpX * bulge;
    const cy = my + perpY * bulge;

    // Gradient between the two layer colors — the edge IS the synthesis
    const grad = ctx.createLinearGradient(ax, ay, bx, by);
    grad.addColorStop(0, hexToRgba(line.a.color, alpha));
    grad.addColorStop(1, hexToRgba(line.b.color, alpha));

    ctx.save();
    ctx.strokeStyle = grad;
    ctx.lineWidth = 0.7 + line.strength * 1.1;
    ctx.shadowColor = hexToRgba(line.a.color, alpha * 0.5);
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(cx, cy, bx, by);
    ctx.stroke();

    // Pulse traveling along the curve — proves the connection is alive
    if (age < 1800) {
      const t = (age % 900) / 900;
      const u = 1 - t;
      const px = u * u * ax + 2 * u * t * cx + t * t * bx;
      const py = u * u * ay + 2 * u * t * cy + t * t * by;
      ctx.fillStyle = hexToRgba('#ffffff', alpha * 0.9);
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(px, py, 1.6 + line.strength * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return true;
  }
  function drawPeakMark(p, now) {
    const age = now - p.ts;
    if (age >= PEAK_LIFE) return false;
    // Phase envelope
    let scale, alpha;
    if (age < 180) {
      // Pop in: scale 0.2 → 1.25, alpha 0 → 1
      const t = age / 180;
      scale = 0.2 + t * 1.05;
      alpha = t;
    } else if (age < 800) {
      // Hold + slight settle
      const t = (age - 180) / 620;
      scale = 1.25 - t * 0.25;        // 1.25 → 1.0
      alpha = 1.0;
    } else {
      // Fade out — slow drift outward
      const t = (age - 800) / (PEAK_LIFE - 800);
      scale = 1.0 + t * 0.4;          // 1.0 → 1.4
      alpha = (1 - t) * 0.95;
    }
    const baseSize = 18 + p.intensity * 22;   // 18..40px
    const size = baseSize * scale;
    const glowAlpha = alpha * 0.85 * p.intensity;

    ctx.save();
    // Outer halo ring at peak intensity
    if (p.intensity >= 0.7 && age < 1100) {
      const ringT = Math.min(1, age / 700);
      const ringR = baseSize * (0.6 + ringT * 1.6);
      const ringA = (1 - ringT) * 0.4 * p.intensity;
      ctx.strokeStyle = hexToRgba(p.color, ringA);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }
    // The glyph itself — bright, glowing, layer-tinted
    ctx.fillStyle = hexToRgba(p.color, alpha);
    ctx.font = size.toFixed(1) + 'px "Cormorant Garamond", "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = hexToRgba(p.color, glowAlpha);
    ctx.shadowBlur = 14 + p.intensity * 18;
    ctx.fillText(p.glyph, p.x, p.y);
    ctx.restore();
    return true;
  }

  function hexToRgba(hex, a) {
    const h = hex.replace('#', '');
    const v = h.length === 3
      ? h.split('').map(c => parseInt(c + c, 16))
      : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + Math.max(0, Math.min(1, a)) + ')';
  }

  // ── EVENT HOOKS ────────────────────────────────────────────────────
  function walkToElement(el, holdMs) {
    if (!el) return;
    const r = visibleRect(el);
    if (!r) return;
    const tx = Math.max(20, r.left - 18);
    const ty = r.top + r.height / 2;
    me.target = { x: tx, y: ty, weight: 1.2, kind: 'summon' };
    me.targetTimer = holdMs || 1800;
    me.arrived = false;
    me.dwellTimer = 0;
  }

  // Inner-life feed updated → walk to hottest card (preserve v1)
  window.addEventListener('vint:inner-rendered', () => {
    setTimeout(() => {
      const hot = document.querySelector('.vtn-card-heat.hot') ||
                  document.querySelector('.vtn-card-header') ||
                  document.querySelector('.vtn-card-heat');
      if (hot) walkToElement(hot, 2400);
    }, 80);
  });

  // Public summon — anything can call her (preserve v1)
  window.addEventListener('vint:walk-to', (e) => {
    const sel = e.detail && e.detail.selector;
    const hold = (e.detail && e.detail.hold) || 1500;
    if (!sel) return;
    const el = document.querySelector(sel);
    if (el) walkToElement(el, hold);
  });

  // Pause when tab hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
    } else {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  });

  raf = requestAnimationFrame(tick);

  // Public handle
  window.VintEmbody = {
    state: () => state,
    spirit: () => ({
      x: me.x, y: me.y, target: me.target,
      marks: me.marks.length,
      peaks: me.peakMarks.length,
      assocs: me.assocLines.length,
    }),
    walkTo: (x, y, hold) => {
      me.target = { x, y, weight: 1.2, kind: 'summon-xy' };
      me.targetTimer = hold || 1500;
      me.arrived = false;
      me.dwellTimer = 0;
    },
    setLayer: (layer) => {
      const sig = LAYER_SIG[layer];
      if (sig) { state.layer = layer; state.color = sig.color; state.glyph = sig.glyph; }
    },
    marks: () => me.marks.slice(),
    // v3: trigger a peak mark from the console / external code.
    // VintEmbody.peak('emotional', 0.85)  ← drops at the creature
    // VintEmbody.peak('neural', 0.9, x, y)  ← drops at xy
    peak: (layer, intensity, x, y) => {
      const sig = LAYER_SIG[layer] || { color: DEFAULT_COLOR, glyph: '·' };
      const px = (typeof x === 'number') ? x : me.x + 28;
      const py = (typeof y === 'number') ? y : me.y - 18;
      dropPeakMark(px, py, sig.glyph, sig.color, intensity || 0.7);
    },
    disable: () => {
      try { localStorage.setItem('vint_embody', '0'); } catch (_) {}
      if (raf) cancelAnimationFrame(raf);
      canvas.remove();
    },
  };
})();
