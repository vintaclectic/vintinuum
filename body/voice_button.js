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
  var btn, iconEl, caretEl;

  function muted() {
    try { return !!(window.VOICE && window.VOICE.muted && window.VOICE.muted()); }
    catch (_) { return false; }
  }

  function listening() {
    try { return !!(window.__voiceIn && window.__voiceIn.isListening && window.__voiceIn.isListening()); }
    catch (_) { return false; }
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
      '  bottom:calc(24px + env(safe-area-inset-bottom,0px));',
      '  left:calc(16px + env(safe-area-inset-left,0px));',
      '  z-index:1000;',
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
      '@media (max-width:380px){#' + BTN_ID + '{bottom:calc(18px + env(safe-area-inset-bottom,0px));}}'
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

    btn.appendChild(iconEl);
    btn.appendChild(caretEl);
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
    return true;
  }

  if (!mount()) document.addEventListener('DOMContentLoaded', function () { mount(); }, { once: true });
})();
