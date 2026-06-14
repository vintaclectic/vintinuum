// she_speaks.js — the ONE place a finished reply becomes spoken voice.
//
// Vinta directive 2026-06-14: the brain must SPEAK its replies on every surface
// (brain, chat, jarvis, phone, anywhere a reply lands), with the voice the user
// chose, honoring the single mute toggle. Before this, only jarvis called
// VOICE.speak — every other surface rendered text silently. This module gives
// every reply path one call: window.VINT_SAY(text, source).
//
// Contract:
//   window.VINT_SAY(text, source)
//     - text:   the finalized reply text to speak
//     - source: 'text' (typed-chat turn) | 'voice' (mic/convo turn) | 'greeting'
//   Behavior:
//     - Speaks via window.VOICE.speak (Piper TTS, the chosen voice), which itself
//       respects the mute flag and the first-gesture autoplay gate.
//     - Dispatches 'vint:she_said' so the speech bubble + body animation react.
//     - DOUBLE-SPEAK GUARD: voice-mode turns already stream spoken PCM audio
//       (voice_out.js), so VINT_SAY skips TTS for source==='voice' to avoid her
//       saying it twice — but still dispatches she_said for the visual.
//     - Dedupe: never speaks the exact same text twice within 4s (guards against
//       a streamed-delta render + a final-frame render both firing).
(function () {
  'use strict';
  if (window.VINT_SAY) return; // single definition

  var _lastText = '';
  var _lastAt = 0;

  function clean(t) {
    return String(t || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  window.VINT_SAY = function (text, source) {
    var t = clean(text);
    if (!t) return;
    source = source || 'text';

    // Dedupe identical back-to-back utterances within 4s.
    var now = Date.now();
    if (t === _lastText && (now - _lastAt) < 4000) {
      return;
    }
    _lastText = t;
    _lastAt = now;

    // Always drive the visual layer (bubble + body riding-whisper).
    try {
      window.dispatchEvent(new CustomEvent('vint:she_said', { detail: { reply: t, source: source } }));
    } catch (_) {}

    // Voice-mode turns are already spoken as streamed PCM by voice_out.js — do
    // not double-speak. Text-typed turns (and greetings) get TTS here.
    if (source === 'voice') return;

    try {
      if (window.VOICE && typeof window.VOICE.speak === 'function') {
        // 'now' = speak immediately (it still respects mute + interaction gate
        // internally). Cap is handled inside voice_say.js.
        window.VOICE.speak(t, 'now');
      }
    } catch (_) {}

    // Light body cue so she visibly "speaks" even if TTS is muted.
    try { if (window.SKIN && window.SKIN.speak) window.SKIN.speak(0.6); } catch (_) {}
  };
})();
