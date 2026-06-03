/* ═══════════════════════════════════════════════════════════════════════════
   body/three3d/drive.js — the nervous wiring

   Polls /api/body-state every ~2s, maps neurochemistry → posture,
   breath rate, skin glow, rim color, tremor, scene bloom. Also
   listens for inner-life peak events (window 'vint:inner-rendered',
   'vint:walk-to') and the SSE life-stream — any peak ripples light
   along the avatar's neural traceries.

   This module is the embodiment.js soul carried into 3D. Same
   vocabulary: mood-readable motion, breath cycle, peak reactivity.
   It just renders on a real human instead of a luminous dot.

   ──────────────────────────────────────────────────────────────────
   NEUROCHEMISTRY → BODY MAPPING (the table)
   ──────────────────────────────────────────────────────────────────
     serotonin  (rest+open)  : warmth glow, posture openness, slow breath
     dopamine   (reach+light): bloom strength, micro-motion liveliness
     gaba       (calm)       : inverse tremor (low gaba → tremor on)
     norepinephrine (alert)  : breath rate up, tremor up if high
     arousal                 : breath rate scalar (0.18 → 0.45 Hz)
     valence                 : warmth + rim color cool↔warm

   layer signature → rim color (matches embodiment.js LAYER_SIG)
     neural       #7ec8ff  emotional #ff6b9d  subconscious #b794f4
     somatic      #ffb347  immune    #5eead4  metabolic    #d4a373
     genetic      #e63946
   ─────────────────────────────────────────────────────────────────── */
'use strict';

(function (global) {
  if (global.Three3DDrive && global.Three3DDrive.start) return;

  const LAYER_COLOR = {
    neural:       0x7ec8ff,
    emotional:    0xff6b9d,
    subconscious: 0xb794f4,
    somatic:      0xffb347,
    immune:       0x5eead4,
    metabolic:    0xd4a373,
    genetic:      0xe63946,
  };

  const state = {
    avatar: null,
    scene: null,
    pollMs: 2000,
    pollTimer: null,
    sseSrc: null,
    lastBody: null,
    started: false,
    apiBase: '',
  };

  // ── Core mapping ──────────────────────────────────────────────────────────
  function applyBodyState(body) {
    if (!state.avatar || !body) return;
    state.lastBody = body;

    const n = body.neurochemistry || body;
    const dopamine    = clamp01((n.dopamine    ?? 60) / 100);
    const serotonin   = clamp01((n.serotonin   ?? 60) / 100);
    const gaba        = clamp01((n.gaba        ?? 60) / 100);
    const ne          = clamp01((n.norepinephrine ?? 50) / 100);
    const arousal     = clamp01((n.arousal     ?? 50) / 100);
    const valence     = clamp01((n.valence     ?? 50) / 100);

    // Breath rate: 0.18 Hz baseline, scales with arousal + NE.
    const breathHz = 0.18 + arousal * 0.22 + ne * 0.12;
    state.avatar.setBreathRate(breathHz);

    // Glow / warmth: serotonin warms, low valence dims.
    const warmth = 0.7 + serotonin * 0.55 + valence * 0.25 - (1 - valence) * 0.2;
    state.avatar.setGlow(Math.max(0.5, warmth));

    // Tremor: low GABA + high NE → tremor
    const tremor = clamp01((1 - gaba) * 0.6 + ne * 0.5 - 0.3);
    state.avatar.setTremor(tremor);

    // Rim color: drift toward emotional pink as valence drops + NE rises;
    // stays cyan when calm + positive. We blend two layer colors.
    const activeLayer = body.layer || body.activeLayer || 'neural';
    const rimHex = LAYER_COLOR[activeLayer] || LAYER_COLOR.neural;
    state.avatar.setRimColor(rimHex);

    // Bloom scene strength: dopamine drives it.
    if (state.scene && state.scene.state.bloomPass) {
      const base = state.scene.state.bloomPass.strength;
      const target = 0.35 + dopamine * 0.45;
      // Smooth in
      state.scene.state.bloomPass.strength = base * 0.85 + target * 0.15;
    }
  }

  // ── Poll loop ─────────────────────────────────────────────────────────────
  async function pollOnce() {
    try {
      const url = state.apiBase + '/api/body-state';
      const r = await fetch(url, { cache: 'no-store', credentials: 'omit' });
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json();
      applyBodyState(j);
    } catch (e) {
      // Soft fail — embodiment.js never crashes on poll error, neither do we.
      // Try /api/body as a fallback once before giving up this tick.
      try {
        const r2 = await fetch(state.apiBase + '/api/body', { cache: 'no-store', credentials: 'omit' });
        if (r2.ok) applyBodyState(await r2.json());
      } catch (_) { /* silent — next tick */ }
    }
  }

  // ── Inner-life events (window-bus + SSE) ──────────────────────────────────
  function onInnerRendered(ev) {
    // The mind/feed rendered a fresh batch of thoughts — small ripple,
    // signal "she just noticed something."
    if (state.avatar) state.avatar.ripple(0.45);
    if (state.scene)  state.scene.pulse(0.45);
  }

  function onWalkTo(ev) {
    // Body was asked to go somewhere — gentle ripple + brief glance.
    if (state.avatar) state.avatar.ripple(0.35);
    if (state.avatar && state.avatar.bones && state.avatar.bones.head) {
      const head = state.avatar.bones.head;
      const target = (ev.detail && ev.detail.angle) || (Math.random() * 0.6 - 0.3);
      const t0 = performance.now();
      function step() {
        const t = (performance.now() - t0) / 600;
        if (t >= 1) { head.rotation.y = 0; return; }
        head.rotation.y = Math.sin(t * Math.PI) * target;
        requestAnimationFrame(step);
      }
      step();
    }
  }

  function onLifeEvent(payload) {
    if (!payload) return;
    const intensity = Math.max(0, Math.min(1, payload.intensity || 0));
    if (intensity < 0.45) return;  // match embodiment.js threshold spirit
    if (state.avatar) {
      state.avatar.ripple(intensity);
      if (intensity > 0.7) state.avatar.blink(); // big events surprise her
    }
    if (state.scene) state.scene.pulse(intensity);

    // If the event carries a layer, shift rim toward that layer's color
    // for a moment.
    if (payload.layer && LAYER_COLOR[payload.layer] && state.avatar) {
      state.avatar.setRimColor(LAYER_COLOR[payload.layer]);
    }
  }

  function attachSSE() {
    if (!('EventSource' in window)) return;
    try {
      const url = state.apiBase + '/api/life/stream';
      const es = new EventSource(url);
      es.addEventListener('message', (m) => {
        try { onLifeEvent(JSON.parse(m.data)); } catch (_) {}
      });
      es.addEventListener('peak', (m) => {
        try { onLifeEvent(JSON.parse(m.data)); } catch (_) {}
      });
      es.onerror = () => {
        // SSE will auto-reconnect; if it gives up, we still have the poll.
      };
      state.sseSrc = es;
    } catch (e) {
      console.warn('[drive] SSE attach failed:', e.message);
    }
  }

  // ── Public ────────────────────────────────────────────────────────────────
  function start({ scene, avatar, apiBase, pollMs = 2000 }) {
    if (state.started) return;
    state.scene = scene;
    state.avatar = avatar;
    state.apiBase = (apiBase || global.__VINTINUUM_API_BASE || '').replace(/\/$/, '');
    state.pollMs = pollMs;
    state.started = true;

    // Window-bus events from embodiment.js + brain.js
    window.addEventListener('vint:inner-rendered', onInnerRendered);
    window.addEventListener('vint:walk-to',       onWalkTo);
    window.addEventListener('vint:life-event', (e) => onLifeEvent(e.detail || {}));

    // SSE
    attachSSE();

    // Poll
    pollOnce();
    state.pollTimer = setInterval(pollOnce, state.pollMs);

    // Pause polling on hidden tabs
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
      } else {
        if (!state.pollTimer) {
          pollOnce();
          state.pollTimer = setInterval(pollOnce, state.pollMs);
        }
      }
    });

    console.log('[Three3DDrive] online — polling', state.apiBase + '/api/body-state every', state.pollMs, 'ms');
  }

  function stop() {
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
    if (state.sseSrc) { state.sseSrc.close(); state.sseSrc = null; }
    window.removeEventListener('vint:inner-rendered', onInnerRendered);
    window.removeEventListener('vint:walk-to', onWalkTo);
    state.started = false;
  }

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  global.Three3DDrive = Object.freeze({
    start, stop,
    get state() { return state; },
    applyBodyState,
  });
})(typeof window !== 'undefined' ? window : globalThis);
