// ════════════════════════════════════════════════════════════════════════════
// TALK_BACK — when you speak through hey-vinta, she answers out loud
// ════════════════════════════════════════════════════════════════════════════
// hey_vinta.js dispatches `vint:hey_vinta` { transcript, confidence, ... }
// when a tap-to-listen turn captures speech via Web Speech API. Until now
// the transcript only POSTed to /api/voice/wake (a metric/log). This
// module closes the conversation loop:
//
//   1. Subscribe to vint:hey_vinta
//   2. POST transcript → /api/voice/reply { transcript } → { reply, ttsUrl }
//   3. Speak the reply through VOICE.speak (mode 'now' so it preempts any
//      queued whispers — a direct answer trumps ambient ones)
//   4. Dispatch `vint:she_said` { reply } so any chat panel on screen
//      can also render it visually
//   5. Tell the body: VintEmbody.whisper(reply) ribbons the same words
//      from her core
//
// Rate-limited at the brain (6/min, 80/hr per IP). Client-side gate also:
// we won't send a follow-up while a reply is still mid-speech, to keep
// the conversation human-paced (one breath per side).
//
// Opt out: <html data-talkback="off">.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined') return;
  if (window.__talkBack) return;
  if (document.documentElement.dataset.talkback === 'off') return;

  function apiBase() {
    if (window.VINT_API) return window.VINT_API;
    if (document.documentElement.dataset.api) return document.documentElement.dataset.api;
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return 'http://localhost:8767';
    }
    return 'https://api.vintaclectic.com';
  }

  var inFlight = false;
  var lastReplyAt = 0;

  function speak(text, layer) {
    try {
      if (window.VOICE && window.VOICE.speak) {
        // 'now' preempts ambient whispers — a direct answer trumps them
        window.VOICE.speak(text, 'now');
      }
    } catch (_) {}
    try {
      if (window.VintEmbody && window.VintEmbody.whisper) {
        window.VintEmbody.whisper(text, layer || 'emotional');
      }
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('vint:she_said', {
        detail: { reply: text, ts: Date.now() }
      }));
    } catch (_) {}
  }

  function ask(transcript) {
    if (!transcript) return;
    if (inFlight) return;
    // Don't talk over yourself — wait until her last reply has finished
    // (rough heuristic: TTS rate ~14 chars/sec, plus 600ms buffer)
    var lastReply = (window.__lastSpokenText || '');
    var minGap = 800 + lastReply.length * 70;
    if (Date.now() - lastReplyAt < minGap) {
      // Short gap: let her finish, then re-fire
      setTimeout(function () { ask(transcript); }, minGap - (Date.now() - lastReplyAt));
      return;
    }
    inFlight = true;
    var url = apiBase().replace(/\/+$/, '') + '/api/voice/reply';
    var headers = { 'Content-Type': 'application/json' };
    try {
      var tok = localStorage.getItem('vint_access_token') ||
                localStorage.getItem('soul_auth_token');
      if (tok) headers['Authorization'] = 'Bearer ' + tok;
    } catch (_) {}
    fetch(url, {
      method: 'POST',
      headers: headers,
      credentials: 'include',
      body: JSON.stringify({ transcript: transcript })
    })
    .then(function (r) {
      if (!r.ok) {
        return r.json().catch(function () { return { error: 'http-' + r.status }; })
          .then(function (j) { throw j; });
      }
      return r.json();
    })
    .then(function (j) {
      inFlight = false;
      lastReplyAt = Date.now();
      if (j && j.reply) {
        window.__lastSpokenText = j.reply;
        speak(j.reply);
      }
    })
    .catch(function (err) {
      inFlight = false;
      // Quiet fallback so she still acknowledges hearing you.
      var msg = '';
      if (err && err.error === 'rate-limited') {
        msg = 'A lot at once. Give me a beat.';
      } else if (err && err.error === 'transcript-required') {
        msg = '';
      } else {
        msg = 'I heard you, but the brain just stumbled. Say it again.';
      }
      if (msg) {
        window.__lastSpokenText = msg;
        lastReplyAt = Date.now();
        speak(msg);
      }
    });
  }

  // Subscribe
  window.addEventListener('vint:hey_vinta', function (e) {
    var d = e && e.detail;
    if (!d || !d.transcript) return;
    var t = String(d.transcript).trim();
    if (!t) return;
    ask(t);
  });

  window.__talkBack = {
    ask: ask,
    inFlight: function () { return inFlight; },
    lastReplyAt: function () { return lastReplyAt; }
  };
})();
