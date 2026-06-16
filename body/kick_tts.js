// kick_tts.js — hear the Kick bot speak. (Vinta directive 2026-06-16)
//
// The bot's TTS relied on an external webhook (tts_webhook_url) that was never
// configured, so nothing ever played. This subscribes to the brain's in-process
// SSE channel /api/kick/tts/stream and speaks each bot reply through the working
// Piper voice (window.VOICE.speak), respecting the user's mute + chosen voice.
//
// Load it on any surface that should voice the bot: the stream overlay, brain,
// the orb. It auto-connects and auto-reconnects.
(function () {
  'use strict';
  if (window.KickTTS) return;

  function apiBase() {
    try { if (window.API_BASE) return window.API_BASE; } catch (_) {}
    try { if (window.__VINTINUUM_API_BASE) return window.__VINTINUUM_API_BASE; } catch (_) {}
    return 'https://api.vintaclectic.com';
  }

  var _es = null, _retry = 0, _on = true;

  function speak(text) {
    if (!_on || !text) return;
    try {
      if (window.VOICE && typeof window.VOICE.speak === 'function') {
        window.VOICE.speak(String(text).slice(0, 600), 'now'); // honors mute + voice
      }
    } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('vint:kick-spoke', { detail: { text: text } })); } catch (_) {}
  }

  function connect() {
    if (_es) { try { _es.close(); } catch (_) {} _es = null; }
    var url = apiBase() + '/api/kick/tts/stream';
    try { _es = new EventSource(url); } catch (_) { _scheduleReconnect(); return; }

    _es.addEventListener('tts', function (ev) {
      try { var d = JSON.parse(ev.data); if (d && d.text) speak(d.text); } catch (_) {}
    });
    _es.onopen = function () { _retry = 0; };
    _es.onerror = function () {
      try { _es.close(); } catch (_) {}
      _es = null;
      _scheduleReconnect();
    };
  }

  function _scheduleReconnect() {
    _retry = Math.min(_retry + 1, 6);
    var delay = Math.min(1000 * Math.pow(2, _retry), 30000); // backoff to 30s
    setTimeout(connect, delay);
  }

  window.KickTTS = {
    start: connect,
    stop: function () { _on = false; if (_es) { try { _es.close(); } catch (_) {} _es = null; } },
    setEnabled: function (on) { _on = !!on; if (_on && !_es) connect(); },
    enabled: function () { return _on; },
  };

  // auto-start after VOICE is likely available
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(connect, 800); }, { once: true });
  else setTimeout(connect, 800);
})();
