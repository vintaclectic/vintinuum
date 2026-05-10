/* hey_vinta.js — the breathing V wake button
   ────────────────────────────────────────────────────────────
   HELIOS-10 spec, Phase 7 frontend, Vinta directive 2026-05-08.

   What it is:
     A small floating "V" that breathes on every surface. Tap it
     once to start listening; tap again (or auto-stop on silence)
     to send the captured transcript to the brain as a "wake"
     event. Phase 1 uses Web Speech API (interim). Phase 2 will
     swap in Picovoice Porcupine for true always-on wake-word.

   What it ISN'T:
     • Not always-listening. Tap activates. Silence deactivates.
     • Not an audio uploader. The brain receives transcript text
       only — never raw audio. Privacy is the keel.
     • Not a router. It POSTs the wake event and surfaces the
       transcript; downstream surfaces (chat.html, brain.html)
       can subscribe to `vint:hey_vinta` CustomEvents to act.

   Behavior:
     • Floats bottom-right by default (above any dock).
     • Inherits draggable.js — repositionable, persisted per-page.
     • Idle:    soft V, breathing 1.0 ↔ 1.04 over 3.2s.
     • Listening: pulse faster (1.0 ↔ 1.08 over 0.9s), ring lights up.
     • Settled: 220ms green flash on successful POST, then idle.
     • Errored: 220ms red flash, log to console, then idle.

   Embedded everywhere via `<script defer src="body/hey_vinta.js">`.
   ──────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.__heyVintaLoaded) return;
  window.__heyVintaLoaded = true;

  // ── Config ────────────────────────────────────────────────
  const SURFACE = (function () {
    const path = (location.pathname || '/').toLowerCase();
    const m = path.match(/\/([^\/]+)\.html?$/);
    if (m) return m[1];
    if (path === '/' || path.endsWith('/')) return 'index';
    return path.replace(/[^a-z0-9_]/g, '_').slice(0, 32) || 'unknown';
  })();

  const DEVICE_ID = (function () {
    try {
      let id = localStorage.getItem('vint:device_id');
      if (!id) {
        id = 'dev_' + Math.random().toString(36).slice(2, 10) +
             Date.now().toString(36);
        localStorage.setItem('vint:device_id', id);
      }
      return id;
    } catch (_) {
      return 'dev_session_' + Math.random().toString(36).slice(2, 10);
    }
  })();

  function apiBase() {
    return window.__VINTINUUM_API_BASE ||
           window.VINTINUUM_API ||
           window.__VINT_API ||
           'https://api.vintaclectic.com';
  }

  // ── Style (scoped, no conflict) ──────────────────────────
  const css = `
    #hey-vinta-btn {
      position: fixed;
      right: 20px;
      bottom: calc(20px + env(safe-area-inset-bottom, 0px));
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%,
        rgba(140, 110, 220, 0.95) 0%,
        rgba(70, 50, 140, 0.95) 60%,
        rgba(30, 20, 70, 0.95) 100%);
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow:
        0 6px 20px rgba(0, 0, 0, 0.5),
        0 0 0 0 rgba(140, 110, 220, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      cursor: pointer;
      z-index: 99998;
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.92);
      font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
      font-size: 22px;
      font-weight: 600;
      letter-spacing: 0.05em;
      user-select: none;
      -webkit-user-select: none;
      animation: heyVintaBreathe 3.2s ease-in-out infinite;
      transition:
        background 220ms ease,
        box-shadow 220ms ease,
        transform 120ms ease;
    }
    #hey-vinta-btn .hv-glyph {
      pointer-events: none;
      text-shadow: 0 0 8px rgba(180, 150, 255, 0.6);
    }
    #hey-vinta-btn.listening {
      animation: heyVintaPulse 0.9s ease-in-out infinite;
      box-shadow:
        0 6px 20px rgba(0, 0, 0, 0.5),
        0 0 0 6px rgba(140, 110, 220, 0.25),
        0 0 28px rgba(140, 110, 220, 0.6),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
    }
    #hey-vinta-btn.settled {
      background: radial-gradient(circle at 35% 35%,
        rgba(120, 220, 140, 0.95) 0%,
        rgba(50, 140, 70, 0.95) 60%,
        rgba(20, 70, 30, 0.95) 100%);
    }
    #hey-vinta-btn.errored {
      background: radial-gradient(circle at 35% 35%,
        rgba(220, 110, 110, 0.95) 0%,
        rgba(140, 50, 50, 0.95) 60%,
        rgba(70, 20, 20, 0.95) 100%);
    }
    #hey-vinta-btn.passive {
      box-shadow:
        0 6px 20px rgba(0, 0, 0, 0.5),
        0 0 0 2px rgba(126, 200, 255, 0.45),
        0 0 18px rgba(126, 200, 255, 0.45),
        inset 0 1px 0 rgba(255, 255, 255, 0.12);
    }
    #hey-vinta-btn.passive::after {
      content: '';
      position: absolute;
      right: 2px; top: 2px;
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #7ec8ff;
      box-shadow: 0 0 8px rgba(126, 200, 255, 0.8);
      animation: heyVintaPassiveDot 2.4s ease-in-out infinite;
      pointer-events: none;
    }
    @keyframes heyVintaPassiveDot {
      0%, 100% { opacity: 0.55; transform: scale(1); }
      50%      { opacity: 1;    transform: scale(1.18); }
    }
    #hey-vinta-btn.disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    @keyframes heyVintaBreathe {
      0%, 100% { transform: scale(1.0); }
      50%      { transform: scale(1.04); }
    }
    @keyframes heyVintaPulse {
      0%, 100% { transform: scale(1.0); }
      50%      { transform: scale(1.08); }
    }
    #hey-vinta-bubble {
      position: fixed;
      right: 88px;
      bottom: calc(28px + env(safe-area-inset-bottom, 0px));
      max-width: 280px;
      padding: 10px 14px;
      border-radius: 14px;
      background: rgba(20, 18, 36, 0.94);
      color: rgba(240, 235, 255, 0.95);
      border: 1px solid rgba(140, 110, 220, 0.35);
      font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      line-height: 1.45;
      letter-spacing: 0.02em;
      z-index: 99997;
      pointer-events: none;
      opacity: 0;
      transform: translateY(6px);
      transition: opacity 180ms ease, transform 180ms ease;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    }
    #hey-vinta-bubble.show {
      opacity: 1;
      transform: translateY(0);
    }
    #hey-vinta-bubble .hv-label {
      display: block;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: rgba(180, 150, 255, 0.7);
      margin-bottom: 4px;
    }
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── DOM ───────────────────────────────────────────────────
  const btn = document.createElement('button');
  btn.id = 'hey-vinta-btn';
  btn.type = 'button';
  btn.title = 'Hey Vinta — tap to listen';
  btn.setAttribute('aria-label', 'Hey Vinta wake button');
  btn.setAttribute('data-drag', '1');     // pick up draggable.js
  btn.innerHTML = '<span class="hv-glyph">V</span>';

  const bubble = document.createElement('div');
  bubble.id = 'hey-vinta-bubble';
  bubble.innerHTML = '<span class="hv-label">heard</span><span class="hv-text">…</span>';

  function mount() {
    if (!document.body) return false;
    document.body.appendChild(btn);
    document.body.appendChild(bubble);
    return true;
  }
  if (!mount()) {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  }

  // ── Topbar-zone guard ─────────────────────────────────────
  // draggable.js persists translate3d to localStorage. If a saved position
  // puts #hey-vinta-btn inside the topbar's zone (top 72px of viewport) it
  // will overlap #topLorePill / #topMenuPill. We can't guard this at drag-
  // time (draggable.js owns that via OCCUPIED_SELECTORS) but we need to
  // also guard on page-load when the saved transform is restored.
  //
  // Strategy: after two rAF ticks (draggable.js restores on rAF too), read
  // the element's client rect. If it lands above 72px from the top of the
  // viewport, wipe the stored transform back to the authored default
  // (bottom-right corner) and clear the localStorage entry so it won't
  // re-fire next load.
  (function guardTopbarOverlap() {
    const TOPBAR_H = 72; // px — matches topbar height + 16px safe buffer
    const STORAGE_KEY = 'vint:layout:' + (location.pathname || '/');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        try {
          const r = btn.getBoundingClientRect();
          if (r.top < TOPBAR_H) {
            // Clear the translate
            btn.style.transform = '';
            btn.dataset.dragX = '0';
            btn.dataset.dragY = '0';
            // Wipe from stored layout so it doesn't reload on next page
            try {
              var stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
              var btnKey = '#' + btn.id;
              if (stored[btnKey]) {
                delete stored[btnKey];
                localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
              }
            } catch (_) {}
          }
        } catch (_) {}
      });
    });
  })();

  // ── Bubble helpers ────────────────────────────────────────
  let bubbleTimer = null;
  function flashBubble(label, text, ms = 3200) {
    const lbl = bubble.querySelector('.hv-label');
    const txt = bubble.querySelector('.hv-text');
    if (lbl) lbl.textContent = label;
    if (txt) txt.textContent = text;
    bubble.classList.add('show');
    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms);
  }

  function flashState(cls, ms = 220) {
    btn.classList.add(cls);
    setTimeout(() => btn.classList.remove(cls), ms);
  }

  // ── Speech recognition (Web Speech API, interim) ─────────
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const speechSupported = !!SpeechRec;

  if (!speechSupported) {
    btn.classList.add('disabled');
    btn.title = 'Hey Vinta — speech not supported in this browser';
  }

  let recognizer = null;
  let listening = false;
  let listenStartedAt = 0;
  let lastTranscript = '';
  let lastConfidence = 0;

  function startListening() {
    if (!speechSupported || listening) return;
    try {
      recognizer = new SpeechRec();
      recognizer.lang = (navigator.language || 'en-US');
      recognizer.continuous = false;
      recognizer.interimResults = true;
      recognizer.maxAlternatives = 1;
    } catch (e) {
      console.warn('[hey_vinta] recognizer init failed', e);
      return;
    }

    lastTranscript = '';
    lastConfidence = 0;
    listenStartedAt = Date.now();
    listening = true;
    btn.classList.add('listening');
    flashBubble('listening', '…');

    recognizer.onresult = (ev) => {
      let interim = '';
      let final = '';
      let conf = 0;
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const alt = r[0];
        if (r.isFinal) {
          final += alt.transcript;
          conf = Math.max(conf, alt.confidence || 0);
        } else {
          interim += alt.transcript;
        }
      }
      const text = (final || interim).trim();
      if (text) {
        lastTranscript = text;
        if (conf) lastConfidence = conf;
        flashBubble(final ? 'heard' : 'hearing…', text);
      }
    };

    recognizer.onerror = (ev) => {
      console.warn('[hey_vinta] recognizer error', ev.error);
      stopListening({ errored: true, errorCode: ev.error });
    };

    recognizer.onend = () => {
      if (!listening) return;
      // Pause-tolerance (Vinta directive 2026-05-10): browser SR auto-ends
      // after ~0.5-1s of silence, but the user may just be gathering words.
      // If we've heard nothing yet, OR what we heard is short and we're
      // still well under the max-listen window, transparently restart
      // recognition instead of finishing the turn.
      var elapsed = Date.now() - listenStartedAt;
      var heard = (lastTranscript || '').trim();
      var wordCount = heard ? heard.split(/\s+/).length : 0;
      var maxListenMs = 22000;          // hard cap — never hold the mic longer than this
      var graceMs = 9000;               // for short utterances, allow ~9s of total listening
      var shortAndEarly = (wordCount < 8) && (elapsed < graceMs);
      var nothingYet = (wordCount === 0) && (elapsed < maxListenMs);

      if ((shortAndEarly || nothingYet) && elapsed < maxListenMs) {
        // Try to restart the same recognizer. In Chrome this works after
        // a brief tick; if it throws (already-started / aborted) we fall
        // through to finishListening cleanly.
        try {
          setTimeout(function () {
            if (!listening) return;
            try { recognizer.start(); flashBubble('still listening', heard || '…'); }
            catch (_) { try { finishListening(); } catch (__) {} }
          }, 60);
          return;
        } catch (_) { /* fall through */ }
      }
      finishListening();
    };

    try {
      recognizer.start();
    } catch (e) {
      // start() throws if already started — recover gracefully
      console.warn('[hey_vinta] recognizer.start failed', e);
      listening = false;
      btn.classList.remove('listening');
    }
  }

  function stopListening({ errored = false, errorCode = null } = {}) {
    if (!listening) return;
    if (recognizer) {
      try { recognizer.stop(); } catch (_) {}
    }
    if (errored) {
      listening = false;
      btn.classList.remove('listening');
      flashState('errored', 600);
      flashBubble('error', errorCode || 'recognizer failed', 2400);
      postWake({ errored: true, errorCode });
    }
  }

  function finishListening() {
    listening = false;
    btn.classList.remove('listening');
    const text = (lastTranscript || '').trim();
    if (text) {
      flashState('settled', 600);
      flashBubble('heard', text, 4000);
      postWake({ transcript: text, confidence: lastConfidence });
      // Broadcast for any surface that wants to react
      try {
        window.dispatchEvent(new CustomEvent('vint:hey_vinta', {
          detail: {
            transcript: text,
            confidence: lastConfidence,
            surface: SURFACE,
            duration_ms: Date.now() - listenStartedAt
          }
        }));
      } catch (_) {}
    } else {
      flashBubble('quiet', 'no words heard', 1800);
      postWake({ transcript: '', confidence: 0, fulfilled: false });
    }
  }

  function authToken() {
    try {
      return localStorage.getItem('vint_token') ||
             localStorage.getItem('vint_access_token') ||
             localStorage.getItem('soul_auth_token') ||
             null;
    } catch (_) { return null; }
  }

  function postWake({ transcript = '', confidence = 0, errored = false, errorCode = null, fulfilled = true } = {}) {
    const body = {
      device_id: DEVICE_ID,
      surface: SURFACE,
      confidence: Number(confidence) || 0,
      transcript: String(transcript || '').slice(0, 1000),
      duration_ms: Math.max(0, Date.now() - listenStartedAt),
      fulfilled: errored ? false : (fulfilled !== false && transcript.length > 0),
      errored: !!errored,
      error_code: errorCode
    };
    const headers = { 'Content-Type': 'application/json' };
    const tok = authToken();
    if (tok) headers['Authorization'] = 'Bearer ' + tok;
    try {
      fetch(apiBase() + '/api/voice/wake', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(body),
        keepalive: true
      }).catch(() => {});
    } catch (_) {}
  }

  // ── Passive-mode visual reflection ────────────────────────
  // Reflects window.WAKE_WORD enabled-state on the V button as a
  // cyan halo + breathing dot. Polls every 800ms so external
  // toggles (e.g. status_pill, wake_consent banner) stay in sync.
  function refreshPassiveVisual() {
    try {
      const ww = window.WAKE_WORD;
      const on = !!(ww && ww.status && ww.status().enabled);
      btn.classList.toggle('passive', on);
      btn.title = on
        ? 'Hey Vinta — passive listening on (shift-click to disable, tap to capture)'
        : 'Hey Vinta — tap to listen (shift-click to enable always-on)';
    } catch (_) {}
  }
  setInterval(refreshPassiveVisual, 800);
  window.addEventListener('vint:wake:enabled',  refreshPassiveVisual);
  window.addEventListener('vint:wake:disabled', refreshPassiveVisual);

  // ── Click toggles listen; Shift+Click toggles passive mode ─
  // Important: draggable.js uses long-press to grab. A short tap
  // still fires click — that's our activation. We DO suppress
  // click if the press turned into a drag (draggable adds a
  // `dragging` class transiently).
  btn.addEventListener('click', (ev) => {
    if (btn.classList.contains('dragging')) return;
    if (btn.classList.contains('disabled')) {
      flashBubble('unsupported', 'speech api not available', 2200);
      return;
    }
    // Shift+Click → toggle passive ambient listening
    if (ev.shiftKey) {
      ev.preventDefault();
      try {
        const ww = window.WAKE_WORD;
        if (!ww) {
          flashBubble('passive', 'wake module not loaded', 2400);
          return;
        }
        const cur = (ww.status && ww.status().enabled) || false;
        if (cur) {
          ww.disable();
          flashBubble('passive off', 'tap to talk', 2400);
        } else {
          ww.enable();
          flashBubble('passive on', 'just say "hey vinta"', 3200);
        }
        refreshPassiveVisual();
      } catch (e) {
        flashBubble('passive', 'toggle failed', 2200);
      }
      return;
    }
    if (listening) {
      // tap-to-stop
      try { recognizer && recognizer.stop(); } catch (_) {}
    } else {
      startListening();
    }
  });

  // Allow other surfaces to programmatically trigger listening:
  //   window.dispatchEvent(new CustomEvent('vint:hey_vinta:trigger'))
  window.addEventListener('vint:hey_vinta:trigger', () => {
    if (!listening) startListening();
  });

  // Public surface for diagnostics
  window.HeyVinta = {
    surface: SURFACE,
    deviceId: DEVICE_ID,
    isListening: () => listening,
    start: startListening,
    stop: () => { try { recognizer && recognizer.stop(); } catch (_) {} },
    supported: speechSupported
  };

  try { console.log('[hey_vinta] mounted on surface=' + SURFACE + ' speech=' + speechSupported); } catch (_) {}
})();
