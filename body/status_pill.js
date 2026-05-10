// ════════════════════════════════════════════════════════════════════════════
// STATUS_PILL — visible state machine for VINTINUUM's voice presence
// ════════════════════════════════════════════════════════════════════════════
// One small pill, top-right of the viewport, that reflects the current
// state of the body's voice loop. Subscribes to every event the existing
// modules already dispatch (no new protocol invented here):
//
//   listening  — wake_word matched OR hey_vinta started capturing
//   thinking   — talk_back POSTed /api/voice/reply (waiting on Claude)
//   speaking   — VOICE.speak fired OR she_said bubble shown
//   muted      — VOICE.mute(true) flipped on
//   wake-off   — WAKE_WORD disabled (default state on first visit)
//   wake-on    — WAKE_WORD enabled and ambient
//   idle       — none of the above; she's just being
//
// The pill is the contract for Phase 2-5 of the WS streaming spine —
// when ws-convo emits state transitions, they feed the same pill.
// Building the receiver before the sender means the streaming work just
// has to dispatch the right events; the UI is already waiting.
//
// Click the pill → toggles WAKE_WORD on/off (with the same persisted
// localStorage flag wake_word.js reads). Long-press → toggles VOICE mute.
// Drag → repositionable per CLAUDE.md "all buttons draggable" rule
// (uses data-drag="1" to inherit body/draggable.js if it's loaded).
//
// Opt out: <html data-statuspill="off">.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__statusPill) return;
  if (document.documentElement.dataset.statuspill === 'off') return;

  // ── Style ────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('vint-status-pill-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-status-pill-styles';
    s.textContent = [
      '.vint-status-pill{',
      '  position:fixed;top:12px;right:14px;z-index:99997;',
      '  display:flex;align-items:center;gap:8px;',
      '  padding:6px 11px 6px 9px;border-radius:999px;',
      '  background:rgba(18,18,28,.78);',
      '  color:#f3eef9;',
      '  font:600 11.5px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;',
      '  letter-spacing:.06em;text-transform:lowercase;',
      '  border:1px solid rgba(180,150,240,.30);',
      '  box-shadow:0 4px 14px rgba(0,0,0,.35);',
      '  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);',
      '  cursor:pointer;user-select:none;-webkit-user-select:none;',
      '  transition:background 220ms ease,border-color 220ms ease,transform 120ms ease;',
      '  pointer-events:auto;',
      '}',
      '.vint-status-pill:hover{transform:translateY(-1px)}',
      '.vint-status-pill .vsp-dot{',
      '  width:8px;height:8px;border-radius:50%;',
      '  background:#7ec8ff;flex:none;',
      '  box-shadow:0 0 0 0 rgba(126,200,255,.45);',
      '  transition:background 200ms ease,box-shadow 200ms ease;',
      '}',
      '.vint-status-pill .vsp-text{white-space:nowrap}',
      // States
      '.vint-status-pill.s-idle      .vsp-dot{background:#9aa5b1}',
      '.vint-status-pill.s-listening .vsp-dot{background:#5eead4;animation:vspPulse 1.2s ease-in-out infinite}',
      '.vint-status-pill.s-thinking  .vsp-dot{background:#b794f4;animation:vspPulse .7s ease-in-out infinite}',
      '.vint-status-pill.s-speaking  .vsp-dot{background:#ffb347;animation:vspPulse .55s ease-in-out infinite}',
      '.vint-status-pill.s-muted     .vsp-dot{background:#ff6b9d}',
      '.vint-status-pill.s-wakeoff   .vsp-dot{background:#5b6470}',
      '.vint-status-pill.s-wakeon    .vsp-dot{background:#7ec8ff;animation:vspBreath 3s ease-in-out infinite}',
      '.vint-status-pill.s-thinking{border-color:rgba(183,148,244,.55)}',
      '.vint-status-pill.s-speaking{border-color:rgba(255,179,71,.55)}',
      '.vint-status-pill.s-listening{border-color:rgba(94,234,212,.55)}',
      '.vint-status-pill.s-muted{border-color:rgba(255,107,157,.55)}',
      '@keyframes vspPulse{',
      '  0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,.0)}',
      '  50%{box-shadow:0 0 0 5px rgba(255,255,255,.18)}',
      '}',
      '@keyframes vspBreath{',
      '  0%,100%{opacity:.7}',
      '  50%{opacity:1}',
      '}',
      '@media (prefers-reduced-motion:reduce){',
      '  .vint-status-pill .vsp-dot{animation:none!important}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── DOM ──────────────────────────────────────────────────────────────────
  var pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'vint-status-pill s-idle';
  pill.setAttribute('aria-label', 'Vintinuum voice status');
  pill.setAttribute('data-drag', '1');
  pill.innerHTML = '<span class="vsp-dot" aria-hidden="true"></span><span class="vsp-text">idle</span>';

  function mount() {
    if (!document.body) return false;
    injectStyles();
    document.body.appendChild(pill);
    return true;
  }
  if (!mount()) document.addEventListener('DOMContentLoaded', mount, { once: true });

  // ── State ────────────────────────────────────────────────────────────────
  var STATE = 'idle';      // idle | listening | thinking | speaking | muted | wakeoff | wakeon
  var stickyUntil = 0;     // states like 'speaking' linger past their event
  var thinkingTimer = null;

  function setState(next, opts) {
    opts = opts || {};
    var now = Date.now();
    // Sticky states win unless override=true
    if (!opts.override && now < stickyUntil && STATE !== next) return;
    STATE = next;
    pill.classList.remove('s-idle', 's-listening', 's-thinking', 's-speaking',
                          's-muted', 's-wakeoff', 's-wakeon');
    pill.classList.add('s-' + next.replace('-', ''));
    var label = ({
      idle:      'idle',
      listening: 'listening',
      thinking:  'thinking',
      speaking:  'speaking',
      muted:     'muted',
      wakeoff:   'tap to wake',
      wakeon:    'always on'
    })[next] || next;
    var t = pill.querySelector('.vsp-text');
    if (t) t.textContent = label;
    if (opts.stickyMs) stickyUntil = now + opts.stickyMs;
    try {
      window.dispatchEvent(new CustomEvent('vint:pill', { detail: { state: next, ts: now } }));
    } catch (_) {}
  }

  // Compute the resting label: muted > wake state > idle
  function settle() {
    try {
      if (window.VOICE && typeof window.VOICE.muted === 'function' && window.VOICE.muted()) {
        return setState('muted', { override: true });
      }
    } catch (_) {}
    try {
      if (window.WAKE_WORD && typeof window.WAKE_WORD.status === 'function') {
        var st = window.WAKE_WORD.status();
        if (st && st.enabled && st.supported) return setState('wakeon', { override: true });
      }
    } catch (_) {}
    setState('wakeoff', { override: true });
  }

  // ── Event subscriptions ──────────────────────────────────────────────────
  // listening — hey_vinta started OR wake_word fired
  window.addEventListener('vint:hey_vinta:trigger', function () {
    setState('listening', { override: true });
  });
  // hey_vinta dispatches vint:hey_vinta on success — that means transcript
  // captured, talk_back is about to POST → thinking
  window.addEventListener('vint:hey_vinta', function () {
    setState('thinking', { override: true });
    clearTimeout(thinkingTimer);
    // safety: if no reply lands in 14s, drift back to settle
    thinkingTimer = setTimeout(function () {
      if (STATE === 'thinking') settle();
    }, 14000);
  });

  // speaking — she_said bubble shown OR VOICE actively speaking
  window.addEventListener('vint:she_said', function (e) {
    var d = e && e.detail;
    var text = (d && (d.reply || d.text)) || '';
    var dur = Math.min(11000, 1200 + text.length * 70);
    clearTimeout(thinkingTimer);
    setState('speaking', { override: true, stickyMs: dur });
    setTimeout(settle, dur + 200);
  });

  // Any explicit pill events the WS streaming spine will emit later
  // (Phase 2-5). Already wired so the senders just have to fire.
  window.addEventListener('vint:voice:listening', function () { setState('listening', { override: true }); });
  window.addEventListener('vint:voice:thinking',  function () { setState('thinking',  { override: true }); });
  window.addEventListener('vint:voice:speaking',  function (e) {
    var d = e && e.detail;
    var sticky = (d && d.stickyMs) || 1500;
    setState('speaking', { override: true, stickyMs: sticky });
    setTimeout(settle, sticky + 200);
  });
  window.addEventListener('vint:voice:idle',      function () { settle(); });

  // VOICE mute toggle
  window.addEventListener('vint:voice:mute', function (e) {
    var on = !!(e && e.detail && e.detail.on);
    if (on) setState('muted', { override: true });
    else settle();
  });

  // WAKE_WORD enable/disable (we listen for the event AND poll lightly)
  window.addEventListener('vint:wake:enabled',  function () { settle(); });
  window.addEventListener('vint:wake:disabled', function () { settle(); });

  // ── Click & long-press interactions ──────────────────────────────────────
  var pressedAt = 0;
  var longPressFired = false;
  var longPressTimer = null;
  pill.addEventListener('pointerdown', function (e) {
    pressedAt = Date.now();
    longPressFired = false;
    longPressTimer = setTimeout(function () {
      longPressFired = true;
      // Long-press → toggle mute
      try {
        if (window.VOICE && typeof window.VOICE.mute === 'function') {
          var nowMuted = (typeof window.VOICE.muted === 'function') ? window.VOICE.muted() : false;
          window.VOICE.mute(!nowMuted);
          try {
            window.dispatchEvent(new CustomEvent('vint:voice:mute', { detail: { on: !nowMuted } }));
          } catch (_) {}
        }
      } catch (_) {}
      settle();
    }, 700);
  });
  pill.addEventListener('pointerup', function () {
    clearTimeout(longPressTimer);
  });
  pill.addEventListener('pointerleave', function () {
    clearTimeout(longPressTimer);
  });

  pill.addEventListener('click', function (e) {
    if (longPressFired) { e.preventDefault(); return; }
    if (pill.classList.contains('dragging')) return;
    // Click → toggle WAKE_WORD
    try {
      if (window.WAKE_WORD) {
        var st = (typeof window.WAKE_WORD.status === 'function') ? window.WAKE_WORD.status() : null;
        if (st && st.enabled) {
          window.WAKE_WORD.disable();
          try { window.dispatchEvent(new CustomEvent('vint:wake:disabled')); } catch (_) {}
        } else if (st && st.supported) {
          window.WAKE_WORD.enable();
          try { window.dispatchEvent(new CustomEvent('vint:wake:enabled')); } catch (_) {}
        }
      }
    } catch (_) {}
    settle();
  });

  // Soft poll (1.5s) so external state changes (mute via console, wake via
  // another tab) reflect even without an event dispatch.
  setInterval(function () {
    if (STATE === 'listening' || STATE === 'thinking' || STATE === 'speaking') return;
    settle();
  }, 1500);

  // Initial settle once everything has had a tick to load
  setTimeout(settle, 600);

  window.__statusPill = {
    state: function () { return STATE; },
    set: function (s, opts) { setState(s, opts || { override: true }); },
    settle: settle
  };
})();
