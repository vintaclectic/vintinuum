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
  var _repeatState = Object.create(null);
  var _recentUtterances = [];
  var _seenEventIds = [];
  var _recentPayloads = [];
  var _lastPayloadKey = '', _lastPayloadAt = 0;
  var STORAGE_PREFIX = 'vint:kick-tts:';
  var UTTERANCE_STORE = STORAGE_PREFIX + 'utterances:v2';
  var EVENT_STORE = STORAGE_PREFIX + 'event-ids:v1';
  var PAYLOAD_STORE = STORAGE_PREFIX + 'payloads:v1';
  var REPEAT_SPOKEN_LIMIT = 1;
  var REPEAT_RESET_MS = 24 * 60 * 60 * 1000;
  var REPEAT_SUPPRESS_MS = 24 * 60 * 60 * 1000;
  var REPEAT_MAX_KEYS = 240;
  var RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
  var RECENT_MAX = 120;
  var EVENT_ID_MAX = 240;
  var PAYLOAD_MAX = 120;
  var PAYLOAD_DUP_MS = 2 * 60 * 1000;
  var SIMILARITY_LIMIT = 0.58;
  var CONTAINMENT_LIMIT = 0.82;
  var MIN_SIMILAR_CHARS = 12;

  function readStore(key, fallback) {
    try {
      var raw = window.localStorage && window.localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      if (window.localStorage) window.localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function loadPersistedState() {
    var now = Date.now();
    _recentUtterances = readStore(UTTERANCE_STORE, []).filter(function (item) {
      return item && item.key && now - item.at <= RECENT_WINDOW_MS;
    }).slice(-RECENT_MAX);
    _seenEventIds = readStore(EVENT_STORE, []).filter(Boolean).slice(-EVENT_ID_MAX);
    _recentPayloads = readStore(PAYLOAD_STORE, []).filter(function (item) {
      return item && item.key && now - item.at <= PAYLOAD_DUP_MS;
    }).slice(-PAYLOAD_MAX);
  }

  function normalizeRepeatText(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[@#]/g, '')
      .replace(/\b(hi|hey|hello|yo)\b[:,\s-]*/g, '')
      .replace(/\b(vinta|vintinuum|vintaclectic|vintaclecticai|vintaai|kickbot|bot)\b[:,\s-]*/g, '')
      .replace(/\b(lol|lmao|haha|bro|chat|fr|ngl|lets go|let s go)\b/g, '')
      .replace(/\b(i mean|like|okay|ok|yeah|yep|yup)\b[:,\s-]*/g, '')
      .replace(/(.)\1{2,}/g, '$1$1')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);
  }

  function wordsFor(text) {
    var seen = Object.create(null);
    return normalizeRepeatText(text).split(' ').filter(function (w) {
      if (w.length < 3 || seen[w]) return false;
      seen[w] = true;
      return true;
    });
  }

  function fingerprint(text) {
    return wordsFor(text).sort().join(' ');
  }

  function similarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    var aw = Object.create(null), bw = Object.create(null), inter = 0, union = 0, ac = 0, bc = 0;
    wordsFor(a).forEach(function (w) { aw[w] = true; ac += 1; });
    wordsFor(b).forEach(function (w) { bw[w] = true; bc += 1; });
    Object.keys(aw).forEach(function (w) { if (bw[w]) inter += 1; union += 1; });
    Object.keys(bw).forEach(function (w) { if (!aw[w]) union += 1; });
    if (!union) return 0;
    if (Math.min(ac, bc) >= 3 && inter / Math.min(ac, bc) >= CONTAINMENT_LIMIT) return 1;
    return inter / union;
  }

  function rememberUtterance(key, now) {
    _recentUtterances.push({ key: key, fp: fingerprint(key), at: now });
    if (_recentUtterances.length > RECENT_MAX) {
      _recentUtterances.splice(0, _recentUtterances.length - RECENT_MAX);
    }
    writeStore(UTTERANCE_STORE, _recentUtterances);
  }

  function pruneRecentUtterances(now) {
    _recentUtterances = _recentUtterances.filter(function (item) {
      return item && now - item.at <= RECENT_WINDOW_MS;
    });
    writeStore(UTTERANCE_STORE, _recentUtterances);
  }

  function shouldSuppressRepeat(text) {
    loadPersistedState();
    var key = normalizeRepeatText(text);
    if (!key) return false;
    var now = Date.now();
    pruneRecentUtterances(now);
    var state = _repeatState[key];
    if (!state || now - state.lastAt > REPEAT_RESET_MS) {
      state = _repeatState[key] = { count: 0, lastAt: 0, suppressedUntil: 0 };
    }
    state.count += 1;
    state.lastAt = now;
    if (state.suppressedUntil > now) return true;
    if (state.count > REPEAT_SPOKEN_LIMIT) {
      state.suppressedUntil = now + REPEAT_SUPPRESS_MS;
      return true;
    }
    var fp = fingerprint(key);
    for (var i = _recentUtterances.length - 1; i >= 0; i -= 1) {
      if (_recentUtterances[i].key === key || (fp && _recentUtterances[i].fp === fp)) {
        state.suppressedUntil = now + REPEAT_SUPPRESS_MS;
        return true;
      }
      if (key.length >= MIN_SIMILAR_CHARS && similarity(key, _recentUtterances[i].key) >= SIMILARITY_LIMIT) {
        state.suppressedUntil = now + REPEAT_SUPPRESS_MS;
        return true;
      }
    }
    rememberUtterance(key, now);
    return false;
  }

  function pruneRepeatState() {
    var now = Date.now();
    Object.keys(_repeatState).forEach(function (key) {
      var state = _repeatState[key];
      if (!state || (now - state.lastAt > REPEAT_RESET_MS && state.suppressedUntil <= now)) {
        delete _repeatState[key];
      }
    });
    var keys = Object.keys(_repeatState);
    if (keys.length <= REPEAT_MAX_KEYS) return;
    keys.sort(function (a, b) {
      return (_repeatState[a].lastAt || 0) - (_repeatState[b].lastAt || 0);
    }).slice(0, keys.length - REPEAT_MAX_KEYS).forEach(function (key) {
      delete _repeatState[key];
    });
  }

  function actorFor(data) {
    return String(data && (data.user || data.username || data.author || data.sender || '') || '')
      .toLowerCase()
      .replace(/[^a-z0-9_ -]/g, '')
      .trim();
  }

  function rememberPayload(key, actor, now) {
    _recentPayloads.push({ key: key, actor: actor, at: now });
    if (_recentPayloads.length > PAYLOAD_MAX) {
      _recentPayloads.splice(0, _recentPayloads.length - PAYLOAD_MAX);
    }
    writeStore(PAYLOAD_STORE, _recentPayloads);
  }

  function prunePayloads(now) {
    _recentPayloads = _recentPayloads.filter(function (item) {
      return item && now - item.at <= PAYLOAD_DUP_MS;
    });
    writeStore(PAYLOAD_STORE, _recentPayloads);
  }

  function shouldSuppressEvent(ev, data) {
    loadPersistedState();
    var id = (data && (data.id || data.event_id || data.message_id)) || (ev && ev.lastEventId) || '';
    if (id) {
      id = String(id);
      if (_seenEventIds.indexOf(id) !== -1) return true;
      _seenEventIds.push(id);
      if (_seenEventIds.length > EVENT_ID_MAX) {
        _seenEventIds.splice(0, _seenEventIds.length - EVENT_ID_MAX);
      }
      writeStore(EVENT_STORE, _seenEventIds);
    }
    var textKey = normalizeRepeatText(data && data.text);
    var actor = actorFor(data);
    var payloadKey = [textKey, actor].join('|');
    var now = Date.now();
    prunePayloads(now);
    for (var i = _recentPayloads.length - 1; i >= 0; i -= 1) {
      var seen = _recentPayloads[i];
      if (seen.actor === actor && (seen.key === textKey || similarity(seen.key, textKey) >= SIMILARITY_LIMIT)) return true;
    }
    if (payloadKey && payloadKey === _lastPayloadKey && now - _lastPayloadAt <= PAYLOAD_DUP_MS) return true;
    _lastPayloadKey = payloadKey;
    _lastPayloadAt = now;
    if (textKey) rememberPayload(textKey, actor, now);
    return false;
  }

  function speak(text) {
    if (!_on || !text) return;
    pruneRepeatState();
    if (shouldSuppressRepeat(text)) {
      try { window.dispatchEvent(new CustomEvent('vint:kick-tts-suppressed', { detail: { text: text, reason: 'repeat' } })); } catch (_) {}
      return;
    }
    try {
      if (window.VOICE && typeof window.VOICE.speak === 'function') {
        window.VOICE.speak(String(text).slice(0, 600), 'now'); // honors mute + voice
      }
    } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('vint:kick-spoke', { detail: { text: text } })); } catch (_) {}
  }

  function handleTtsEvent(ev) {
    try {
      var d = JSON.parse(ev.data);
      if (d && d.text && !shouldSuppressEvent(ev, d)) speak(d.text);
    } catch (_) {}
  }

  function connect() {
    if (_es) { try { _es.close(); } catch (_) {} _es = null; }
    var url = apiBase() + '/api/kick/tts/stream';
    try { _es = new EventSource(url); } catch (_) { _scheduleReconnect(); return; }

    _es.addEventListener('tts', handleTtsEvent);
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
    repeatState: function () { return { exact: JSON.parse(JSON.stringify(_repeatState)), recent: _recentUtterances.slice(), payloads: _recentPayloads.slice() }; },
    resetRepeats: function () { _repeatState = Object.create(null); _recentUtterances = []; _recentPayloads = []; _seenEventIds = []; _lastPayloadKey = ''; _lastPayloadAt = 0; writeStore(UTTERANCE_STORE, []); writeStore(PAYLOAD_STORE, []); writeStore(EVENT_STORE, []); },
    _debugRepeat: function (text) { return { key: normalizeRepeatText(text), suppressed: shouldSuppressRepeat(text) }; },
    _debugEvent: function (data) { return shouldSuppressEvent(null, data || {}); },
  };

  // auto-start after VOICE is likely available
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(connect, 800); }, { once: true });
  else setTimeout(connect, 800);
})();
