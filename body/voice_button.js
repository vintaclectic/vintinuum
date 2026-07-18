// voice_button.js — THE single voice control. (Vinta directive 2026-06-14)
// Mic-listen rewire (Vinta directive 2026-07-06): the PRIMARY tap must make it
// LISTEN, not just mute the output. Lord Vinta tapped this on his phone and it
// toggled TTS mute instead of opening the microphone.
//
// ONE pill, three gestures:
//   • TAP the icon            → START/STOP listening (window.__voiceIn.toggle)
//   • TAP the caret  (⌄)      → open the multi-voice picker (VOICE_PICKER)
//   • LONG-PRESS the icon     → toggle voice OUTPUT mute (VOICE.mute)
//   • DRAG (via draggable.js) → reposition
//
// It composes existing modules — builds nothing new under the hood:
//   listen   → window.__voiceIn.toggle() / .isListening()  (voice_in.js)
//   mute     → window.VOICE.mute() / .muted()              (voice_say.js)
//   picker   → window.VOICE_PICKER.open/close()            (voice_picker.js)
// The picker's own standalone ♫ button suppresses itself when this loads
// (it checks window.__VINT_VOICE_BUTTON), so there is exactly ONE control.
//
// Compliance: 44px+ tap target, safe-area insets, no overflow/overlap (picker
// panel clips to viewport with internal scroll), draggable + per-button persist.
(function () {
  'use strict';
  if (window.__VINT_VOICE_BUTTON) return;
  window.__VINT_VOICE_BUTTON = true;

  // Opt-out: <html data-voicebtn="off">
  try {
    if (document.documentElement.getAttribute('data-voicebtn') === 'off') return;
  } catch (_) {}

  var BTN_ID = 'vintVoice';
  var btn, iconEl, caretEl, dotEl;
  // VintaBox health (the box owns TTS+STT; the face reports what the box says).
  var boxHealth = { ok: true, ear: true, mouth: true, checked: false };

  function muted() {
    try { return !!(window.VOICE && window.VOICE.muted && window.VOICE.muted()); }
    catch (_) { return false; }
  }

  function listening() {
    try { return !!(window.__voiceIn && window.__voiceIn.isListening && window.__voiceIn.isListening()); }
    catch (_) { return false; }
  }

  // ── VintaBox health poll ────────────────────────────────────────────────
  // The box owns TTS+STT and exposes /api/voice/status ({ ok, mouth, ear }).
  // If the ear (local Whisper) is down, tapping the mic would fall back to
  // browser Web Speech or silently fail — so the face wears an honest amber
  // ring + corner dot instead of pretending the mic is fully live.
  function apiBase() {
    try { if (window.API_BASE) return String(window.API_BASE).replace(/\/+$/, ''); } catch (_) {}
    return '';
  }

  function applyHealth() {
    if (!btn) return;
    // Ear down = the meaningful signal for a mic control. Mouth-down is shown
    // by voice_say's own muted glyph, so we key the amber state to the ear.
    var earDown = boxHealth.checked && !boxHealth.ear;
    btn.classList.toggle('vvb-earless', earDown);
  }

  function checkBoxHealth() {
    var url = apiBase() + '/api/voice/status';
    var done = false;
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var to = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (_) {} }, 4000);
    try {
      fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .then(function (j) {
          done = true; clearTimeout(to);
          if (j && typeof j === 'object') {
            boxHealth = {
              ok: !!j.ok, ear: (j.ear !== false), mouth: (j.mouth !== false),
              checked: true
            };
          } else {
            // Endpoint unreachable ≠ ear broken; don't cry wolf. Mark checked
            // but leave ear "up" so we never show a false amber on a flaky net.
            boxHealth.checked = true;
          }
          applyHealth();
        })
        .catch(function () { done = true; clearTimeout(to); boxHealth.checked = true; applyHealth(); });
    } catch (_) { clearTimeout(to); boxHealth.checked = true; applyHealth(); }
  }

  function paint() {
    var lis = listening();
    var m = muted();
    // Icon priority: listening state wins (that's the primary action). The
    // muted-output condition is shown via a subtle slash on the mic glyph.
    if (iconEl) iconEl.textContent = lis ? '🔴' : (m ? '🎙️' : '🎤');
    if (btn) {
      btn.setAttribute('aria-pressed', lis ? 'true' : 'false');
      btn.classList.toggle('vvb-listening', lis);
      btn.title = lis
        ? 'Listening… tap to stop · long-press to mute her voice · caret to pick voice'
        : (m ? 'Tap to talk (her voice is muted) · long-press to unmute · caret to pick voice'
             : 'Tap to talk · long-press to mute her voice · caret to pick voice');
      btn.style.opacity = '1';
      btn.style.borderColor = lis
        ? 'rgba(255,90,90,0.85)'
        : (m ? 'rgba(255,255,255,0.14)' : 'rgba(79,195,247,0.40)');
    }
  }

  function toggleListen() {
    try {
      if (window.__voiceIn && window.__voiceIn.toggle) {
        window.__voiceIn.toggle({ surface: 'chat' }).then(paint).catch(function () { paint(); });
        // Immediate optimistic repaint; the promise repaints again on resolve.
        paint();
        // A tap is the moment truth matters most — verify the ear is really up.
        checkBoxHealth();
        return;
      }
    } catch (_) {}
    // voice_in not present → tell the user rather than silently do nothing.
    try {
      if (window.__voiceIn && window.__voiceIn.notice) {
        window.__voiceIn.notice('Voice engine not loaded on this page.', 'error');
      }
    } catch (_) {}
  }

  function toggleMute() {
    try { if (window.VOICE && window.VOICE.mute) window.VOICE.mute(!muted()); } catch (_) {}
    paint();
  }

  function openPicker() {
    try {
      if (window.VOICE_PICKER && window.VOICE_PICKER.open) window.VOICE_PICKER.open();
    } catch (_) {}
  }

  function injectStyles() {
    if (document.getElementById('vint-voice-button-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-voice-button-styles';
    s.textContent = [
      '#' + BTN_ID + '{',
      '  position:fixed;',
      // ── NO-COLLISION LAW (Vinta 2026-07-06) — this corner is CROWDED. ──────
      // Three neighbours share the bottom edge and NONE may be touched:
      //   • mobile_nav.js  — full-width bottom bar, 56px + safe-area, <=700px
      //   • diag.js        — .vint-diag-pill at left:14px bottom:14px (z 99996)
      //   • hey_vinta.js   — 56px orb at right:20px bottom:20px
      // We sit on the LEFT, lifted clear of the diag pill, and (on mobile) fully
      // ABOVE the nav bar. Desktop keeps the low resting spot since no nav bar
      // exists there. Numbers are derived from the neighbours, not guessed:
      //   diag pill = font 11px/1.3 + 7px×2 pad + 1px×2 border ≈ 30px tall,
      //   anchored bottom:14px → occupies 14..44px. Button at 56px → 56..100px.
      //   GAP = 12px. Nothing touches anything, at any content length.
      '  bottom:calc(56px + env(safe-area-inset-bottom,0px));',
      '  left:calc(16px + env(safe-area-inset-left,0px));',
      // Above content, BELOW Shell.Z.shell(100)+ chrome? No — the control must
      // stay tappable over content, so it rides just under the drawer/modal
      // layer and above the shell bar it now clears geometrically anyway.
      '  z-index:150;',
      '  display:flex;align-items:center;justify-content:center;gap:2px;',
      '  height:44px;min-width:44px;padding:0 8px;',
      '  border-radius:22px;',
      '  background:rgba(8,12,20,0.55);',
      '  border:1px solid rgba(79,195,247,0.40);',
      '  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);',
      '  cursor:pointer;color:rgba(218,228,255,0.92);',
      '  transition:opacity .2s,border-color .2s,transform .12s;',
      '  user-select:none;-webkit-user-select:none;touch-action:none;',
      '}',
      '#' + BTN_ID + ':hover{transform:scale(1.04);}',
      '#' + BTN_ID + ' .vvb-icon{font-size:1.05rem;line-height:1;pointer-events:none;}',
      '#' + BTN_ID + ' .vvb-caret{font-size:0.72rem;opacity:0.7;line-height:1;width:12px;text-align:center;pointer-events:none;}',
      // Listening state: red ring pulse so it is unmistakable the mic is live.
      '#' + BTN_ID + '.vvb-listening{background:rgba(40,10,14,0.62);box-shadow:0 0 0 0 rgba(255,70,70,0.55);animation:vvbPulse 1.6s ease-out infinite;}',
      '@keyframes vvbPulse{0%{box-shadow:0 0 0 0 rgba(255,70,70,0.55);}70%{box-shadow:0 0 0 12px rgba(255,70,70,0);}100%{box-shadow:0 0 0 0 rgba(255,70,70,0);}}',
      '@media (prefers-reduced-motion:reduce){#' + BTN_ID + '.vvb-listening{animation:none;box-shadow:0 0 0 3px rgba(255,70,70,0.35);}}',
      // ── Mobile: clear the bottom nav ENTIRELY. mobile_nav.js renders a
      // full-width 56px bar (+safe-area) at bottom:0 for viewports <=700px.
      // The old rule here dropped the button to 18px — INSIDE that bar, so the
      // control sat on/behind the nav on every phone. It now sits fully above
      // it: 56px bar + 12px breathing gap. Nothing touches anything.
      '@media (max-width:700px){#' + BTN_ID + '{bottom:calc(68px + env(safe-area-inset-bottom,0px));}}',
      // Very small phones: same clearance, tighter gap so it never crowds chat.
      '@media (max-width:380px){#' + BTN_ID + '{bottom:calc(64px + env(safe-area-inset-bottom,0px));}}',
      // ── VintaBox health: when the ear is down, the mic is honest about it ──
      '#' + BTN_ID + '.vvb-earless{border-color:rgba(255,180,60,0.55)!important;}',
      '#' + BTN_ID + ' .vvb-dot{position:absolute;top:-2px;right:-2px;width:8px;height:8px;',
      '  border-radius:50%;background:#ffb43c;box-shadow:0 0 0 2px rgba(8,12,20,0.9);',
      '  display:none;pointer-events:none;}',
      '#' + BTN_ID + '.vvb-earless .vvb-dot{display:block;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function removeLegacyControls() {
    // Defensive: if the picker's standalone ♫ button or the old orphaned
    // #voiceToggle already rendered (load-order race), remove them so only the
    // unified control remains.
    try {
      var orphan = document.getElementById('voiceToggle');
      if (orphan) orphan.remove();
      var picks = document.querySelectorAll('.vint-vp-btn');
      for (var i = 0; i < picks.length; i++) picks[i].style.display = 'none';
    } catch (_) {}
  }

  function mount() {
    if (!document.body) return false;
    if (document.getElementById(BTN_ID)) return true;
    injectStyles();
    removeLegacyControls();

    btn = document.createElement('div');
    btn.id = BTN_ID;
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('data-draggable', 'true');
    btn.setAttribute('aria-label', 'Voice control — tap to talk, long-press to mute her voice, caret to pick voice');

    iconEl = document.createElement('span');
    iconEl.className = 'vvb-icon';
    iconEl.textContent = '🎤'; // paint() corrects to listening/muted glyph immediately

    caretEl = document.createElement('span');
    caretEl.className = 'vvb-caret';
    caretEl.textContent = '⌄';

    // VintaBox health dot — rides INSIDE the pill's own box (the pill is
    // position:fixed, so it is the containing block). It never overlaps a
    // neighbour; it only marks this control's own corner.
    dotEl = document.createElement('span');
    dotEl.className = 'vvb-dot';
    dotEl.setAttribute('aria-hidden', 'true');

    btn.appendChild(iconEl);
    btn.appendChild(caretEl);
    btn.appendChild(dotEl);
    document.body.appendChild(btn);

    // ── Long-press → toggle OUTPUT mute ──────────────────────────────────────
    // draggable.js owns a long-press for repositioning, but only fires it once
    // the pointer actually MOVES past a threshold. A stationary long-press (no
    // drag) is ours: it toggles her voice output mute. We track pointer down/up
    // and, if the press was long AND stationary AND not a drag, we mute-toggle
    // and suppress the subsequent click.
    var MUTE_HOLD_MS = 500;
    var pressTimer = null, pressStart = null, didMute = false, moved = false;

    function clearPress() {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    }

    btn.addEventListener('pointerdown', function (e) {
      didMute = false; moved = false;
      pressStart = { x: e.clientX, y: e.clientY };
      clearPress();
      pressTimer = setTimeout(function () {
        if (!moved) { didMute = true; toggleMute(); }
      }, MUTE_HOLD_MS);
    });
    btn.addEventListener('pointermove', function (e) {
      if (!pressStart) return;
      var dx = (e.clientX || 0) - pressStart.x;
      var dy = (e.clientY || 0) - pressStart.y;
      if ((dx * dx + dy * dy) > 100) { moved = true; clearPress(); } // >10px = a drag
    });
    btn.addEventListener('pointerup', clearPress);
    btn.addEventListener('pointercancel', clearPress);

    // Tap routing: caret zone opens picker, icon zone toggles LISTENING.
    // draggable.js will NOT fire a click after a real drag, so a plain click
    // here is always a genuine tap. A long-press that muted also swallows it.
    btn.addEventListener('click', function (e) {
      if (didMute) { didMute = false; return; } // long-press already handled it
      if (moved) { moved = false; return; }     // it was a drag
      // If the user tapped on the caret glyph (right side), open the picker.
      var tappedCaret = (e.target === caretEl);
      if (!tappedCaret) {
        // Also treat the rightmost ~16px of the pill as the caret zone.
        try {
          var r = btn.getBoundingClientRect();
          if (e.clientX && (r.right - e.clientX) <= 16) tappedCaret = true;
        } catch (_) {}
      }
      if (tappedCaret) openPicker();
      else toggleListen();
    });

    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleListen(); }
      else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleMute(); }
      else if (e.key === 'ArrowUp' || e.key === 'v' || e.key === 'V') { e.preventDefault(); openPicker(); }
    });

    // Repaint the button whenever the conversation FSM changes (listening starts
    // via wake-word/hey-vinta too, not only our tap) so the red pulse is honest.
    window.addEventListener('convo:state', paint);

    // Keep the icon in sync if mute changes elsewhere (other tab / picker / API).
    window.addEventListener('storage', function (e) {
      if (e && e.key === 'vint_voice_muted') paint();
    });
    window.addEventListener('vint:voice:muted', paint);
    window.addEventListener('vint:voice:unmuted', paint);

    paint();
    // Picker may mount on an 800ms timeout (after us) and re-create its ♫.
    // Sweep legacy controls again shortly after to guarantee a single control.
    setTimeout(removeLegacyControls, 1200);

    // ── VintaBox health: poll the box so the mic never lies about the ear ────
    // First check after a short settle (let the API/tunnel wake), then a slow
    // heartbeat. Server-side is cached 10s, so a 60s client poll is featherweight.
    setTimeout(checkBoxHealth, 2500);
    setInterval(checkBoxHealth, 60000);
    // Re-check when the tab returns to foreground (laptop woke, phone unlocked).
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) checkBoxHealth();
    });
    return true;
  }

  if (!mount()) document.addEventListener('DOMContentLoaded', function () { mount(); }, { once: true });
})();
