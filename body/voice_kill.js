// ════════════════════════════════════════════════════════════════════════════
// VOICE_KILL — global kill switch surface for the voice spine
// ════════════════════════════════════════════════════════════════════════════
// Phase 5 of "Real-time Vintinuum". Two layers of safety:
//
//   1. LOCAL — immediately stop mic capture + flush any playing audio +
//              close the WS. Always available, no network needed.
//              Triggered by:
//                • Esc key (anywhere on the page)
//                • window.__voiceKill.local()
//                • Any UI button calling __voiceKill.local()
//
//   2. SERVER — POST /api/voice/convo/kill with X-Master-Key. Boots every
//              live convo session everywhere (including other tabs / other
//              users) and refuses new upgrades until cleared.
//              Triggered by window.__voiceKill.server({on, reason}).
//
// Local kill never asks the network for permission — it is pure browser-
// side teardown. The server kill is owner-only and intended for emergency
// "stop all voice convos right now" situations.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined') return;
  if (window.__voiceKill) return;

  function _localKill(reason) {
    var hits = [];
    try {
      if (window.__voiceOut && typeof window.__voiceOut.flush === 'function') {
        window.__voiceOut.flush();
        hits.push('voice_out.flush');
      }
    } catch (_) {}
    try {
      if (window.__voiceIn && typeof window.__voiceIn.stop === 'function') {
        window.__voiceIn.stop();
        hits.push('voice_in.stop');
      }
    } catch (_) {}
    try {
      if (window.__voiceAvatar && typeof window.__voiceAvatar.stop === 'function') {
        window.__voiceAvatar.stop();
        hits.push('voice_avatar.stop');
      }
    } catch (_) {}
    try {
      if (window.BODY_STATE) {
        window.BODY_STATE.mouthOpen = 0;
        window.BODY_STATE.speaking = false;
      }
    } catch (_) {}
    try {
      if (window.__convoState && typeof window.__convoState.force === 'function') {
        window.__convoState.force('idle', 'kill:' + (reason || 'local'));
      }
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('voice:killed', { detail: { scope: 'local', reason: reason || 'manual', hits: hits } }));
    } catch (_) {}
    return { ok: true, scope: 'local', reason: reason || 'manual', hits: hits };
  }

  function _apiBase() {
    return (window.__VINTINUUM_API_BASE || window.VINTINUUM_API || '').replace(/\/+$/, '');
  }

  async function _serverKill(opts) {
    opts = opts || {};
    // Local first — never let network latency keep audio alive.
    _localKill('server-cascade');
    var base = _apiBase();
    if (!base) return { ok: false, error: 'no-api-base' };
    var key = (opts.masterKey || _readMasterKey() || '').trim();
    if (!key) return { ok: false, error: 'master-key-required' };
    try {
      var r = await fetch(base + '/api/voice/convo/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': key },
        body: JSON.stringify({ on: opts.on !== false, reason: opts.reason || 'manual-kill' })
      });
      var j = await r.json().catch(function () { return { ok: false, error: 'bad-json' }; });
      try { window.dispatchEvent(new CustomEvent('voice:killed', { detail: { scope: 'server', server: j } })); } catch (_) {}
      return j;
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }

  function _readMasterKey() {
    try {
      return localStorage.getItem('vint_master_key')
          || localStorage.getItem('VINTA_MASTER_KEY')
          || sessionStorage.getItem('vint_master_key')
          || null;
    } catch (_) { return null; }
  }

  // Esc anywhere = local kill.
  function _onKey(ev) {
    if (ev.key !== 'Escape') return;
    // Only fire if some part of the voice spine is alive.
    var alive = false;
    try { if (window.__voiceIn && window.__voiceIn.isOpen()) alive = true; } catch (_) {}
    try { if (window.BODY_STATE && window.BODY_STATE.speaking) alive = true; } catch (_) {}
    if (!alive) return;
    _localKill('esc-key');
  }
  document.addEventListener('keydown', _onKey, true);

  window.__voiceKill = {
    local: _localKill,
    server: _serverKill,
    isArmed: function () {
      var open = false;
      try { open = !!(window.__voiceIn && window.__voiceIn.isOpen()); } catch (_) {}
      var speaking = false;
      try { speaking = !!(window.BODY_STATE && window.BODY_STATE.speaking); } catch (_) {}
      return { ws_open: open, speaking: speaking, master_key_present: !!_readMasterKey() };
    }
  };
})();
