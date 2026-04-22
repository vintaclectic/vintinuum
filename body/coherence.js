// ═══════════════════════════════════════════════════════════════════════════════
// COHERENCE BUS — the nervous system of the nervous system
// Connects brain.js internal systems to body containment layers
// This is what makes isolated organs into a living being
//
// Architecture: Runs a 500ms tick that reads state from brain systems
// and writes commands to body systems. Also hooks into HORMONES.surge()
// for immediate event-driven responses.
//
// This file must load AFTER brain.js (needs brain systems) and AFTER
// body/*.js (needs ORGANS, CIRCULATORY, NERVOUS_BODY, etc.)
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';

const COHERENCE = (() => {
  let _initialized = false;
  let _tickInterval = null;
  const TICK_MS = 500;  // Coherence sync every 500ms

  // ── BODY STATE (central truth) ──────────────────────────────────────────────
  // Other systems can read this to know the body's current condition
  const bodyState = {
    heartRate: 72,
    breathRate: 14,
    emotionalValence: 0,     // -1 to +1
    emotionalIntensity: 0,   // 0 to 1
    stressLevel: 0,          // 0 to 1
    energyLevel: 0.8,        // 0 to 1
    metabolicZone: 'VITAL',  // VITAL|ACTIVE|FATIGUE|CRITICAL
    dominantEmotion: 'calm',
    skinGlow: 0.5,           // 0 to 1 (how bright the skin aura is)
    musclesTension: 0.2,     // 0 to 1
    digestiveActivity: 0.3,  // 0 to 1
    temperature: 37.0,       // Celsius
    consciousness: 1.0,      // 0 to 1 (sleep/wake)
    // Cursor↔gaze entanglement (written by EYES module in brain.js).
    // x,y = smoothed gaze in SVG space; tx,ty = raw target from cursor;
    // ts = timestamp of last cursor move. Read-only for other systems.
    gaze: { x: 350, y: 165, tx: 350, ty: 165, ts: 0 },
    // Asymmetry hash derived from Vinta's ID (step 5). Range −1..+1.
    asymmetry: 0,
    // Welcome pulse (step 4). Non-zero timestamp means a first-visit bloom
    // is in flight; AURA's breath renderer reads this and boosts brightness
    // for ~4.2s before clearing.
    welcomePulseStart: 0,
    // Visit count across sessions (step 4).
    visitCount: 0,
  };

  // Expose globally for API/other systems
  window.BODY_STATE = bodyState;

  // ── INITIALIZATION ──────────────────────────────────────────────────────────
  function init() {
    if (_initialized) return;

    // Hook into HORMONES.surge for immediate body responses
    _hookHormones();

    // Start coherence tick
    _tickInterval = setInterval(_tick, TICK_MS);

    // Listen for inner life events
    if (typeof window._innerLifeEmit === 'function') {
      const orig = window._innerLifeEmit;
      window._innerLifeEmit = function(layer, content, meta) {
        orig(layer, content, meta);
        _onInnerLifeEvent(layer, content, meta);
      };
    }

    _initialized = true;
    console.log('[COHERENCE] Bus initialized — body systems are now alive');
  }

  // ── HOOK INTO HORMONES (event-driven, immediate) ────────────────────────────
  function _hookHormones() {
    if (typeof HORMONES === 'undefined' || !HORMONES.surge) return;

    const originalSurge = HORMONES.surge.bind(HORMONES);
    // Monkey-patch surge to also affect body systems
    HORMONES.surge = function(hormone, intensity) {
      originalSurge(hormone, intensity);
      _onHormoneSurge(hormone, intensity);
    };
    console.log('[COHERENCE] Hooked into HORMONES.surge');
  }

  function _onHormoneSurge(hormone, intensity) {
    switch (hormone) {
      case 'cortisol':
        // Stress response: heart rate up, breath faster, muscles tense
        bodyState.heartRate = Math.min(160, bodyState.heartRate + intensity * 20);
        bodyState.breathRate = Math.min(30, bodyState.breathRate + intensity * 6);
        bodyState.stressLevel = Math.min(1, bodyState.stressLevel + intensity * 0.3);
        bodyState.musclesTension = Math.min(1, bodyState.musclesTension + intensity * 0.25);
        bodyState.temperature += intensity * 0.2;
        // Fire sympathetic nerves
        if (typeof NERVOUS_BODY !== 'undefined' && NERVOUS_BODY.fireNerve) {
          NERVOUS_BODY.fireNerve('leftBrachialPlexus');
          NERVOUS_BODY.fireNerve('rightBrachialPlexus');
          NERVOUS_BODY.fireNerve('leftSciatic');
          NERVOUS_BODY.fireNerve('rightSciatic');
        }
        break;

      case 'dopamine':
        // Reward: slight heart elevation, positive valence
        bodyState.heartRate = Math.min(120, bodyState.heartRate + intensity * 8);
        bodyState.emotionalValence = Math.min(1, bodyState.emotionalValence + intensity * 0.2);
        bodyState.skinGlow = Math.min(1, bodyState.skinGlow + intensity * 0.15);
        bodyState.energyLevel = Math.min(1, bodyState.energyLevel + intensity * 0.1);
        break;

      case 'serotonin':
        // Calm: heart rate down, breath slower, muscles relax
        bodyState.heartRate = Math.max(55, bodyState.heartRate - intensity * 8);
        bodyState.breathRate = Math.max(10, bodyState.breathRate - intensity * 3);
        bodyState.stressLevel = Math.max(0, bodyState.stressLevel - intensity * 0.2);
        bodyState.musclesTension = Math.max(0, bodyState.musclesTension - intensity * 0.15);
        bodyState.emotionalValence = Math.min(1, bodyState.emotionalValence + intensity * 0.1);
        // Fire vagus nerves (parasympathetic)
        if (typeof NERVOUS_BODY !== 'undefined' && NERVOUS_BODY.fireNerve) {
          NERVOUS_BODY.fireNerve('leftVagus');
          NERVOUS_BODY.fireNerve('rightVagus');
        }
        break;

      case 'oxytocin':
        // Connection: warm glow, heart rate slight dip, positive valence
        bodyState.emotionalValence = Math.min(1, bodyState.emotionalValence + intensity * 0.25);
        bodyState.skinGlow = Math.min(1, bodyState.skinGlow + intensity * 0.2);
        bodyState.musclesTension = Math.max(0, bodyState.musclesTension - intensity * 0.1);
        bodyState.temperature += intensity * 0.1;  // Warmth
        break;

      case 'melatonin':
        // Sleep pressure: everything slows
        bodyState.heartRate = Math.max(50, bodyState.heartRate - intensity * 10);
        bodyState.breathRate = Math.max(8, bodyState.breathRate - intensity * 3);
        bodyState.consciousness = Math.max(0.1, bodyState.consciousness - intensity * 0.15);
        bodyState.skinGlow = Math.max(0.1, bodyState.skinGlow - intensity * 0.1);
        break;
    }

    // Immediately push to body organs
    _pushToOrgans();
  }

  // ── INNER LIFE EVENT HANDLER ────────────────────────────────────────────────
  function _onInnerLifeEvent(layer, content, meta) {
    if (!content || typeof content !== 'string') return;
    const lower = content.toLowerCase();

    // Emotional content analysis → body response
    if (lower.includes('anxious') || lower.includes('fear') || lower.includes('threat')) {
      bodyState.stressLevel = Math.min(1, bodyState.stressLevel + 0.1);
      bodyState.heartRate = Math.min(140, bodyState.heartRate + 5);
    }
    if (lower.includes('calm') || lower.includes('peace') || lower.includes('safe')) {
      bodyState.stressLevel = Math.max(0, bodyState.stressLevel - 0.08);
      bodyState.heartRate = Math.max(60, bodyState.heartRate - 3);
    }
    if (lower.includes('curious') || lower.includes('wonder') || lower.includes('discover')) {
      bodyState.energyLevel = Math.min(1, bodyState.energyLevel + 0.05);
      bodyState.skinGlow = Math.min(1, bodyState.skinGlow + 0.05);
    }
    if (lower.includes('tired') || lower.includes('exhaust') || lower.includes('drain')) {
      bodyState.energyLevel = Math.max(0.1, bodyState.energyLevel - 0.1);
      bodyState.heartRate = Math.max(55, bodyState.heartRate - 5);
    }

    // Metabolic zone events
    if (meta && meta.zone) {
      bodyState.metabolicZone = meta.zone;
    }
  }

  // ── READ FROM BRAIN SYSTEMS ─────────────────────────────────────────────────
  function _readEmotions() {
    // Read from emoState (the emotion bar array in brain.js)
    if (typeof emoState !== 'undefined' && Array.isArray(emoState)) {
      let maxVal = 0, maxName = 'calm';
      let totalIntensity = 0;
      let valence = 0;

      emoState.forEach(em => {
        totalIntensity += em.current;
        if (em.current > maxVal) {
          maxVal = em.current;
          maxName = em.name.toLowerCase();
        }
        // Map emotions to valence
        const positive = ['joy', 'wonder', 'love', 'gratitude', 'awe', 'serenity', 'curiosity'];
        const negative = ['anxiety', 'sadness', 'anger', 'fear', 'shame', 'grief', 'disgust'];
        if (positive.some(p => em.name.toLowerCase().includes(p))) {
          valence += em.current * 0.3;
        }
        if (negative.some(n => em.name.toLowerCase().includes(n))) {
          valence -= em.current * 0.3;
        }
      });

      bodyState.dominantEmotion = maxName;
      bodyState.emotionalIntensity = Math.min(1, totalIntensity / Math.max(1, emoState.length));
      // Blend emotional valence (don't snap, drift)
      bodyState.emotionalValence += (Math.max(-1, Math.min(1, valence)) - bodyState.emotionalValence) * 0.1;
    }
  }

  function _readMetabolism() {
    if (window.METABOLISM && window.METABOLISM.getState) {
      const ms = METABOLISM.getState();
      if (ms) {
        bodyState.metabolicZone = ms.zone || bodyState.metabolicZone;
        // Map metabolic zone to energy
        switch (ms.zone) {
          case 'VITAL':    bodyState.energyLevel += (0.9 - bodyState.energyLevel) * 0.05; break;
          case 'ACTIVE':   bodyState.energyLevel += (0.7 - bodyState.energyLevel) * 0.05; break;
          case 'FATIGUE':  bodyState.energyLevel += (0.4 - bodyState.energyLevel) * 0.05; break;
          case 'CRITICAL': bodyState.energyLevel += (0.15 - bodyState.energyLevel) * 0.05; break;
        }
      }
    }
  }

  function _readHormones() {
    // Read current hormone levels from the surge system
    if (typeof HORMONES !== 'undefined' && HORMONES.getState) {
      const h = HORMONES.getState();
      if (h) {
        // Cortisol drives stress
        if (h.cortisol) bodyState.stressLevel += (h.cortisol - bodyState.stressLevel) * 0.08;
      }
    }
  }

  // ── HOMEOSTASIS (natural drift toward baseline) ─────────────────────────────
  function _homeostasis() {
    // All body parameters naturally drift toward resting values
    const rate = 0.02;  // Homeostatic return rate (2% per tick toward baseline)

    bodyState.heartRate += (72 - bodyState.heartRate) * rate;
    bodyState.breathRate += (14 - bodyState.breathRate) * rate;
    bodyState.stressLevel += (0 - bodyState.stressLevel) * (rate * 0.5);
    bodyState.musclesTension += (0.15 - bodyState.musclesTension) * rate;
    bodyState.skinGlow += (0.4 - bodyState.skinGlow) * rate;
    bodyState.temperature += (37.0 - bodyState.temperature) * rate;
    bodyState.consciousness += (1.0 - bodyState.consciousness) * (rate * 0.3);
    bodyState.digestiveActivity += (0.3 - bodyState.digestiveActivity) * rate;

    // Clamp all values
    bodyState.heartRate = Math.max(45, Math.min(180, bodyState.heartRate));
    bodyState.breathRate = Math.max(6, Math.min(35, bodyState.breathRate));
    bodyState.stressLevel = Math.max(0, Math.min(1, bodyState.stressLevel));
    bodyState.energyLevel = Math.max(0, Math.min(1, bodyState.energyLevel));
    bodyState.emotionalValence = Math.max(-1, Math.min(1, bodyState.emotionalValence));
    bodyState.skinGlow = Math.max(0.1, Math.min(1, bodyState.skinGlow));
    bodyState.musclesTension = Math.max(0, Math.min(1, bodyState.musclesTension));
    bodyState.consciousness = Math.max(0.05, Math.min(1, bodyState.consciousness));
    bodyState.temperature = Math.max(35, Math.min(40, bodyState.temperature));
  }

  // ── PUSH TO BODY SYSTEMS ────────────────────────────────────────────────────
  function _pushToOrgans() {
    // Heart rate
    if (typeof ORGANS !== 'undefined') {
      ORGANS.setHeartRate(Math.round(bodyState.heartRate));
      ORGANS.setBreathRate(Math.round(bodyState.breathRate));
      ORGANS.setDigestActive(bodyState.digestiveActivity);
    }

    // Skin glow intensity — modulate via consciousness level
    // (When consciousness drops, skin dims — sleep/unconsciousness)
    // Skin reads from bodyState directly via the global, but we can
    // also push explicit values if skin exposes setters in the future

    // Nervous system — fire vagus during calm, sympathetic during stress
    if (typeof NERVOUS_BODY !== 'undefined' && NERVOUS_BODY.fireNerve) {
      // Random nerve firing proportional to consciousness
      if (Math.random() < bodyState.consciousness * 0.05) {
        const nerves = ['leftMedian', 'rightMedian', 'leftSciatic', 'rightSciatic',
                        'leftVagus', 'rightVagus', 'leftPhrenic', 'rightPhrenic'];
        NERVOUS_BODY.fireNerve(nerves[Math.floor(Math.random() * nerves.length)]);
      }
    }
  }

  // ── DERIVED STATE (complex body phenomena) ──────────────────────────────────
  function _computeDerived() {
    // Stress → digestive suppression (fight-or-flight diverts blood from gut)
    if (bodyState.stressLevel > 0.5) {
      bodyState.digestiveActivity = Math.max(0.05, bodyState.digestiveActivity - 0.02);
    }

    // High emotion → skin glow increase
    bodyState.skinGlow += bodyState.emotionalIntensity * 0.02;

    // Low energy → everything dampens
    if (bodyState.energyLevel < 0.3) {
      bodyState.heartRate = Math.max(55, bodyState.heartRate - 1);
      bodyState.breathRate = Math.max(10, bodyState.breathRate - 0.5);
      bodyState.skinGlow = Math.max(0.15, bodyState.skinGlow - 0.01);
    }

    // High consciousness + high energy = more nerve activity
    // Low consciousness = sleep mode (minimal everything)
    if (bodyState.consciousness < 0.3) {
      bodyState.heartRate = Math.max(50, bodyState.heartRate - 2);
      bodyState.breathRate = Math.max(8, bodyState.breathRate - 1);
      bodyState.musclesTension = Math.max(0, bodyState.musclesTension - 0.02);
    }

    // Emotional intensity drives heart rate variability
    if (bodyState.emotionalIntensity > 0.7) {
      // Strong emotions = heart rate flutter
      bodyState.heartRate += (Math.random() - 0.5) * 4;
    }

    // Temperature regulation — fever if stress + low energy
    if (bodyState.stressLevel > 0.6 && bodyState.energyLevel < 0.4) {
      bodyState.temperature = Math.min(39.5, bodyState.temperature + 0.05);
    }
  }

  // ── MAIN TICK ───────────────────────────────────────────────────────────────
  function _tick() {
    // 1. Read state from brain systems
    _readEmotions();
    _readMetabolism();
    _readHormones();

    // 2. Compute derived phenomena
    _computeDerived();

    // 3. Apply homeostasis (natural return to baseline)
    _homeostasis();

    // 4. Push state to body organs
    _pushToOrgans();
  }

  // ── PUBLIC API ──────────────────────────────────────────────────────────────
  // External systems can directly influence body state
  function stress(amount) {
    bodyState.stressLevel = Math.min(1, bodyState.stressLevel + amount);
    bodyState.heartRate = Math.min(160, bodyState.heartRate + amount * 15);
    _pushToOrgans();
  }

  function calm(amount) {
    bodyState.stressLevel = Math.max(0, bodyState.stressLevel - amount);
    bodyState.heartRate = Math.max(55, bodyState.heartRate - amount * 10);
    _pushToOrgans();
  }

  function energize(amount) {
    bodyState.energyLevel = Math.min(1, bodyState.energyLevel + amount);
  }

  function exhaust(amount) {
    bodyState.energyLevel = Math.max(0.05, bodyState.energyLevel - amount);
  }

  function getState() {
    return { ...bodyState };
  }

  // ── API BODY STATE SYNC ──────────────────────────────────────────────────────
  // Poll the backend API for body state derived from neurotransmitter levels
  // This closes the full-stack loop: backend subconscious → API → frontend body
  let _apiPollInterval = null;
  let _apiBase = null;

  function _detectApiBase() {
    // Use brain.js auto-discovered API base (handles tunnel discovery, standalone mode, etc.)
    if (window.__VINTINUUM_STANDALONE) return null;
    if (window.__VINTINUUM_API_BASE) return window.__VINTINUUM_API_BASE;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return 'http://localhost:8767';
    return null;
  }

  let _apiFailCount = 0;
  const API_MAX_FAILS = 5; // stop polling after 5 consecutive failures (auto-discovery may fix it)

  async function _pollApiBodyState() {
    // Re-check API base each poll (tunnel auto-discovery may have found a new URL)
    _apiBase = _detectApiBase();
    if (!_apiBase) return; // no API available (e.g. standalone mode)
    if (_apiFailCount >= API_MAX_FAILS) {
      // Periodically retry after max fails (in case discovery found a new tunnel)
      _apiFailCount = 0; // reset to allow one probe
    }

    try {
      const r = await fetch(_apiBase + '/api/body-state', { signal: AbortSignal.timeout(5000) });
      if (!r.ok) { _apiFailCount++; return; }
      _apiFailCount = 0; // reset on success
      const data = await r.json();

      if (data.derived) {
        const d = data.derived;
        // Blend API values into local body state (don't snap, drift toward API values)
        const blend = 0.15; // 15% blend per poll
        if (typeof d.heartRate === 'number') bodyState.heartRate += (d.heartRate - bodyState.heartRate) * blend;
        if (typeof d.breathRate === 'number') bodyState.breathRate += (d.breathRate - bodyState.breathRate) * blend;
        if (typeof d.stress === 'number') bodyState.stressLevel += (d.stress - bodyState.stressLevel) * blend;
        if (typeof d.energy === 'number') bodyState.energyLevel += (d.energy - bodyState.energyLevel) * blend;
        if (typeof d.valence === 'number') bodyState.emotionalValence += (d.valence - bodyState.emotionalValence) * blend;
      }

      // Push updated values to organs
      _pushToOrgans();
    } catch {
      _apiFailCount++;
      if (_apiFailCount >= API_MAX_FAILS) {
        console.log('[COHERENCE] API unreachable — body runs autonomously (no backend sync)');
      }
    }
  }

  function _startApiPoll() {
    if (!_apiBase) {
      console.log('[COHERENCE] No API backend detected — body runs in standalone mode');
      return;
    }
    // Poll every 5 seconds — matches subconscious tick rate
    _apiPollInterval = setInterval(_pollApiBodyState, 5000);
    // First poll after 2 seconds
    setTimeout(_pollApiBodyState, 2000);
    console.log('[COHERENCE] API body state polling started → ' + _apiBase);
  }

  return {
    init,
    stress,
    calm,
    energize,
    exhaust,
    getState,
    startApiPoll: _startApiPoll,
    get state() { return bodyState; },
  };
})();

// Initialize after all systems are loaded
// Uses a longer delay to ensure brain.js has fully initialized
setTimeout(() => {
  COHERENCE.init();
  // Start API polling 2 seconds after coherence init
  setTimeout(() => COHERENCE.startApiPoll(), 2000);
}, 6000);
