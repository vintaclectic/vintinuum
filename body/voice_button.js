// voice_button.js — THE single voice control. (Vinta directive 2026-06-14)
//
// Replaces the 3-4 scattered voice/mute/talk/picker buttons with ONE pill:
//   • TAP the icon            → toggle voice output on/off (VOICE.mute)
//   • TAP the caret  (⌄)      → open the multi-voice picker (VOICE_PICKER)
//   • LONG-PRESS (350ms)      → drag to reposition (via body/draggable.js)
//
// It composes existing modules — builds nothing new under the hood:
//   mute     → window.VOICE.mute() / .muted()      (voice_say.js)
//   picker   → window.VOICE_PICKER.open/close()     (voice_picker.js)
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

  function paint() {
    var m = muted();
    if (iconEl) iconEl.textContent = m ? '🔇' : '🔊';
    if (btn) {
      btn.setAttribute('aria-pressed', m ? 'true' : 'false');
      btn.title = m ? 'Voice off — tap to unmute · caret to pick voice'
                    : 'Voice on — tap to mute · caret to pick voice';
      btn.style.opacity = m ? '0.55' : '1';
      btn.style.borderColor = m ? 'rgba(255,255,255,0.10)' : 'rgba(79,195,247,0.40)';
    }
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
    btn.setAttribute('aria-label', 'Voice control — tap to mute, caret to pick voice');

    iconEl = document.createElement('span');
    iconEl.className = 'vvb-icon';
    iconEl.textContent = '🔊';

    caretEl = document.createElement('span');
    caretEl.className = 'vvb-caret';
    caretEl.textContent = '⌄';

    btn.appendChild(iconEl);
    btn.appendChild(caretEl);
    document.body.appendChild(btn);

    // Tap routing: caret zone opens picker, icon zone toggles mute.
    // draggable.js owns long-press for drag and will NOT fire a click after a
    // real drag, so a plain click here is always a genuine tap.
    btn.addEventListener('click', function (e) {
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
      else toggleMute();
    });

    btn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMute(); }
      else if (e.key === 'ArrowUp' || e.key === 'v' || e.key === 'V') { e.preventDefault(); openPicker(); }
    });

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
