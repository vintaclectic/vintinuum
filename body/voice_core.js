// ════════════════════════════════════════════════════════════════════════════
// VOICE_CORE — universal voice system loader (Vinta directive 2026-08-14)
// ════════════════════════════════════════════════════════════════════════════
// THE FIX: voice_in.js only loaded on brain.html, so voice_button.js failed
// silently on every other surface (chat, mind, stats, you, learning, jarvis,
// phone). This module ensures the full voice stack (voice_in + voice_out +
// voice_say + convo_state) loads on EVERY surface that needs it, with graceful
// degradation when WebRTC/mic APIs aren't available.
//
// Load order (this file loads FIRST, before voice_button/picker):
//   1. voice_core.js      ← YOU ARE HERE (loads the stack below)
//   2. convo_state.js     ← FSM (listening/capturing/speaking)
//   3. voice_in.js        ← mic → 16kHz PCM → WS
//   4. voice_out.js       ← WS → PCM playback
//   5. voice_say.js       ← TTS (VOICE global)
//   6. voice_button.js    ← the UI control
//   7. voice_picker.js    ← multi-voice picker
//
// Public API on window.VINT_VOICE:
//   .ready       → Promise<void> (resolves when stack is loaded)
//   .available   → { mic, speaker, tts, stt } bools
//   .toggle()    → start/stop listening
//   .say(text)   → speak text
//
// Surfaces include this ONCE via:
//   <script src="body/voice_core.js?v=v20260814-universal" defer></script>
// ════════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';
  if (window.VINT_VOICE) return; // already loaded

  const API_BASE = (() => {
    if (window.__VINTINUUM_API_BASE) return window.__VINTINUUM_API_BASE;
    if (window.API_BASE) return window.API_BASE;
    const isLocal = location.protocol === 'file:' ||
                    location.hostname === 'localhost' ||
                    location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:8767' : 'https://api.vintaclectic.com';
  })();

  // ── Capability detection ─────────────────────────────────────────────────
  function detectCapabilities() {
    const caps = {
      mic: false,
      speaker: false,
      tts: false,
      stt: false,
      secure: false
    };

    // Secure context required for getUserMedia
    caps.secure = window.isSecureContext ||
                  location.protocol === 'file:' ||
                  location.hostname === 'localhost' ||
                  location.hostname === '127.0.0.1';

    // Microphone (requires secure context)
    try {
      caps.mic = caps.secure &&
                 !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    } catch (_) {}

    // Speaker (Web Audio API)
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      caps.speaker = !!AC;
    } catch (_) {}

    // TTS via server
    caps.tts = true; // always available via /api/voice/say

    // STT via WebSocket
    caps.stt = caps.mic; // requires mic to capture

    return caps;
  }

  const capabilities = detectCapabilities();

  // ── Dynamic script loader ────────────────────────────────────────────────
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Check if already loaded by checking the global it exports
      const globalChecks = {
        'convo_state.js': () => window.__convoState,
        'voice_in.js': () => window.__voiceIn,
        'voice_out.js': () => window.__voiceOut,
        'voice_say.js': () => window.VOICE
      };

      const filename = src.split('?')[0].split('/').pop();
      const check = globalChecks[filename];
      if (check && check()) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  // ── Load the voice stack ─────────────────────────────────────────────────
  async function loadVoiceStack() {
    const v = '?v=v20260814-universal';
    const base = 'body/';

    try {
      // 1. Conversation state FSM (required by all)
      await loadScript(base + 'convo_state.js' + v);

      // 2. Voice input (mic → WS) - only if mic available
      if (capabilities.mic) {
        await loadScript(base + 'voice_in.js' + v);
      } else {
        // Stub for surfaces without mic
        window.__voiceIn = {
          start: () => Promise.reject(new Error('mic-unavailable')),
          stop: () => {},
          toggle: () => Promise.resolve(false),
          isListening: () => false,
          notice: (msg, kind) => console.warn('[voice]', msg),
          secureOK: () => capabilities.secure,
          isOpen: () => false,
          level: () => 0
        };
      }

      // 3. Voice output (WS → speaker) - only if speaker available
      if (capabilities.speaker) {
        await loadScript(base + 'voice_out.js' + v);
      } else {
        // Stub
        window.__voiceOut = {
          enqueuePcm16: () => {},
          flush: () => {},
          queueMs: () => 0
        };
      }

      // 4. TTS (always available via server)
      await loadScript(base + 'voice_say.js' + v);

    } catch (err) {
      console.error('[voice_core] Failed to load voice stack:', err);
      throw err;
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────
  const voiceAPI = {
    ready: null, // Promise set below
    available: capabilities,

    toggle(opts) {
      if (!window.__voiceIn || !window.__voiceIn.toggle) {
        return Promise.reject(new Error('voice-input-unavailable'));
      }
      return window.__voiceIn.toggle(opts);
    },

    say(text, opts) {
      if (!window.VOICE || !window.VOICE.say) {
        console.error('[voice_core] VOICE.say not available');
        return Promise.reject(new Error('tts-unavailable'));
      }
      return window.VOICE.say(text, opts);
    },

    isListening() {
      return !!(window.__voiceIn && window.__voiceIn.isListening && window.__voiceIn.isListening());
    },

    isSpeaking() {
      try {
        const state = window.__convoState ? window.__convoState.get() : 'idle';
        return state === 'speaking';
      } catch (_) { return false; }
    },

    mute(shouldMute) {
      if (!window.VOICE || !window.VOICE.mute) return false;
      window.VOICE.mute(shouldMute);
      return true;
    },

    muted() {
      try {
        return !!(window.VOICE && window.VOICE.muted && window.VOICE.muted());
      } catch (_) { return false; }
    }
  };

  // Start loading
  voiceAPI.ready = loadVoiceStack()
    .then(() => {
      console.log('[voice_core] Voice stack ready:', capabilities);
      try {
        window.dispatchEvent(new CustomEvent('vint:voice:ready', {
          detail: { capabilities }
        }));
      } catch (_) {}
    })
    .catch(err => {
      console.error('[voice_core] Voice stack failed to initialize:', err);
      try {
        window.dispatchEvent(new CustomEvent('vint:voice:error', {
          detail: { error: err.message }
        }));
      } catch (_) {}
      throw err;
    });

  window.VINT_VOICE = voiceAPI;

  // Expose capabilities for diagnostics
  window.VINT_VOICE.capabilities = capabilities;
  window.VINT_VOICE.API_BASE = API_BASE;
})();
