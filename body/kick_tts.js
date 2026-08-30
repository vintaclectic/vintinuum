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

  var _es = null, _retry = 0, _on = true, _connectTimer = null;
  var RECENT_LIMIT = 120;
  var REPEAT_WINDOW_MS = 30 * 60 * 1000;
  var MIN_GAP_MS = 2500;
  var BURST_LIMIT = 3;
  var BURST_WINDOW_MS = 12 * 1000;
  var STORAGE_PREFIX = 'vint:kick-tts:';
  var STORAGE_SWEEP_KEY = STORAGE_PREFIX + 'sweep';
  var _recent = [];
  var _seen = Object.create(null);
  var _lastSpokeAt = 0;
  var _burst = [];

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/^([a-z0-9_ -]{2,32}:|@[a-z0-9_ -]{2,32})\s+/i, '')
      .replace(/\b(vintinuum|vinta|dirco|kickbot|bot)\s*(said|says|replied|replying)?\b/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '')
      .replace(/\b(a|an|and|are|be|for|in|is|it|of|on|or|so|the|to|you|your)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);
  }

  function storageKey(key) {
    return STORAGE_PREFIX + key;
  }

  function wordsFor(key) {
    var words = String(key || '').split(' ').filter(Boolean);
    var seen = Object.create(null);
    return words.filter(function (w) {
      if (seen[w]) return false;
      seen[w] = true;
      return true;
    });
  }

  function similarity(a, b) {
    var aw = wordsFor(a);
    var bw = wordsFor(b);
    if (!aw.length || !bw.length) return 0;
    var set = Object.create(null);
    bw.forEach(function (w) { set[w] = true; });
    var overlap = 0;
    aw.forEach(function (w) { if (set[w]) overlap++; });
    return overlap / Math.max(aw.length, bw.length);
  }

  function sweepStorage(now) {
    try {
      var last = Number(localStorage.getItem(STORAGE_SWEEP_KEY) || 0);
      if (now - last < 60000) return;
      localStorage.setItem(STORAGE_SWEEP_KEY, String(now));
      for (var i = localStorage.length - 1; i >= 0; i--) {
        var k = localStorage.key(i);
        if (!k || k.indexOf(STORAGE_PREFIX) !== 0 || k === STORAGE_SWEEP_KEY) continue;
        var ts = Number(localStorage.getItem(k) || 0);
        if (!ts || now - ts >= REPEAT_WINDOW_MS) localStorage.removeItem(k);
      }
    } catch (_) {}
  }

  function recentlyClaimedElsewhere(key, now) {
    try {
      sweepStorage(now);
      var k = storageKey(key);
      var ts = Number(localStorage.getItem(k) || 0);
      if (ts && now - ts < REPEAT_WINDOW_MS) return true;
    } catch (_) {}
    return false;
  }

  function claimAcrossTabs(key, now) {
    try {
      sweepStorage(now);
      var k = storageKey(key);
      var ts = Number(localStorage.getItem(k) || 0);
      if (ts && now - ts < REPEAT_WINDOW_MS) return false;
      localStorage.setItem(k, String(now));
    } catch (_) {}
    return true;
  }

  function remember(key, now) {
    _seen[key] = now;
    _recent.push(key);
    while (_recent.length > RECENT_LIMIT) {
      delete _seen[_recent.shift()];
    }
  }

  function shouldDrop(key, now) {
    if (!key) return true;
    if (_seen[key] && now - _seen[key] < REPEAT_WINDOW_MS) return true;
    for (var i = _recent.length - 1; i >= 0; i--) {
      var prev = _recent[i];
      if (!_seen[prev] || now - _seen[prev] >= REPEAT_WINDOW_MS) continue;
      if (key.length >= 36 && prev.length >= 36 && similarity(key, prev) >= 0.86) return true;
    }
    if (recentlyClaimedElsewhere(key, now)) return true;
    _burst = _burst.filter(function (ts) { return now - ts < BURST_WINDOW_MS; });
    if (_burst.length >= BURST_LIMIT) return true;
    if (_lastSpokeAt && now - _lastSpokeAt < MIN_GAP_MS) return true;
    return false;
  }

  function speak(text) {
    if (!_on || !text) return;
    var now = Date.now();
    var key = normalize(text);
    if (shouldDrop(key, now)) {
      try { window.dispatchEvent(new CustomEvent('vint:kick-tts-dropped', { detail: { text: text, key: key } })); } catch (_) {}
      return;
    }
    if (!claimAcrossTabs(key, now)) {
      try { window.dispatchEvent(new CustomEvent('vint:kick-tts-dropped', { detail: { text: text, key: key, reason: 'claimed' } })); } catch (_) {}
      return;
    }
    remember(key, now);
    _burst.push(now);
    _lastSpokeAt = now;
    try {
      if (window.VOICE && typeof window.VOICE.speak === 'function') {
        window.VOICE.speak(String(text).slice(0, 600), 'replace'); // honors mute + voice, no queue buildup
      }
    } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('vint:kick-spoke', { detail: { text: text } })); } catch (_) {}
  }

  function connect() {
    if (!_on) return;
    if (_connectTimer) { clearTimeout(_connectTimer); _connectTimer = null; }
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
    if (!_on || _connectTimer) return;
    _retry = Math.min(_retry + 1, 6);
    var delay = Math.min(1000 * Math.pow(2, _retry), 30000); // backoff to 30s
    _connectTimer = setTimeout(function () { _connectTimer = null; connect(); }, delay);
  }

  window.KickTTS = {
    start: connect,
    stop: function () {
      _on = false;
      if (_connectTimer) { clearTimeout(_connectTimer); _connectTimer = null; }
      if (_es) { try { _es.close(); } catch (_) {} _es = null; }
    },
    setEnabled: function (on) { _on = !!on; if (_on && !_es) connect(); },
    enabled: function () { return _on; },
    flush: function () { _recent.length = 0; _seen = Object.create(null); _burst.length = 0; _lastSpokeAt = 0; },
  };

  // auto-start after VOICE is likely available
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(connect, 800); }, { once: true });
  else setTimeout(connect, 800);
})();
