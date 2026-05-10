// ════════════════════════════════════════════════════════════════════════════
// WAKE_CONSENT — first-visit ask for ambient "hey vinta" listening
// ════════════════════════════════════════════════════════════════════════════
// ARIA's directive: presence earns consent. Don't surface this banner the
// instant the page loads — wait until she's visibly here (status pill up,
// VintEmbody walking, greeting fired). Only then ask.
//
// Three persisted choices, one storage key per state:
//   localStorage['vint:wake_consent'] = 'on'    — user said yes
//                                       'off'   — user said no (don't re-ask)
//                                       'later' — soft dismissal, ask again
//                                                 next session after 24h
//                                       null    — never asked
//
// On 'on': calls WAKE_WORD.enable() (which writes its own vint:wake_on
//          flag and persists across sessions).
// On 'off': calls WAKE_WORD.disable() AND sets vint:wake_consent='off' so
//           we never re-ask.
// On 'later': dismiss banner; next session 24h+ later, re-ask.
//
// Banner is mounted bottom-center, viewport-clamped (no overflow), three
// buttons: "let her listen" (primary), "not yet" (later), "no thanks" (off).
// All buttons inherit draggable.js opt-out so they DON'T move on press.
//
// Preconditions before showing:
//   - WAKE_WORD module loaded AND supported
//   - mic permission not already explicitly denied
//   - user hasn't already chosen on/off
//   - if 'later', at least 24h since last dismissal
//   - VintEmbody is rendering (the body is visibly here)
//   - at least 4.5s since page load (greeting + first wander already fired)
//   - first user gesture has happened (autoplay-style trust signal)
//
// Opt out entirely: <html data-wakeconsent="off">.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__wakeConsent) return;
  if (document.documentElement.dataset.wakeconsent === 'off') return;

  var STATE_KEY = 'vint:wake_consent';
  var LATER_KEY = 'vint:wake_consent_later_at';

  function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  function shouldAsk() {
    if (!window.WAKE_WORD) return false;
    var st = (typeof window.WAKE_WORD.status === 'function') ? window.WAKE_WORD.status() : null;
    if (!st || !st.supported) return false;
    var choice = lsGet(STATE_KEY);
    if (choice === 'on' || choice === 'off') return false;
    if (choice === 'later') {
      var t = parseInt(lsGet(LATER_KEY) || '0', 10);
      if (t && (Date.now() - t) < 24 * 60 * 60 * 1000) return false;
    }
    if (!window.VintEmbody) return false;
    return true;
  }

  // First user gesture flag — same trust signal voice_say uses.
  var hasInteracted = false;
  function markInteracted() { hasInteracted = true; }
  ['click', 'keydown', 'touchstart', 'pointerdown'].forEach(function (ev) {
    window.addEventListener(ev, markInteracted, { once: true, passive: true, capture: true });
  });

  // ── Style ────────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('vint-wake-consent-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-wake-consent-styles';
    s.textContent = [
      '.vint-wake-consent{',
      '  position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom,0px));',
      '  transform:translate(-50%,12px);',
      '  z-index:99995;',
      '  max-width:min(440px,calc(100vw - 28px));',
      '  padding:14px 16px 13px;',
      '  background:rgba(18,18,28,.92);',
      '  color:#f3eef9;',
      '  border:1px solid rgba(180,150,240,.36);',
      '  border-radius:14px;',
      '  box-shadow:0 14px 38px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.04) inset;',
      '  backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);',
      '  font:500 13px/1.45 ui-sans-serif,system-ui,-apple-system,sans-serif;',
      '  opacity:0;pointer-events:none;',
      '  transition:opacity 280ms ease,transform 320ms cubic-bezier(.18,.9,.34,1.16);',
      '}',
      '.vint-wake-consent.show{opacity:1;transform:translate(-50%,0);pointer-events:auto;}',
      '.vint-wake-consent.fade{opacity:0;transform:translate(-50%,8px);}',
      '.vint-wake-consent .vwc-head{',
      '  display:flex;align-items:center;gap:8px;margin-bottom:6px;',
      '  font-size:11px;letter-spacing:.18em;text-transform:uppercase;',
      '  color:rgba(180,150,255,.86);',
      '}',
      '.vint-wake-consent .vwc-dot{',
      '  width:7px;height:7px;border-radius:50%;background:#7ec8ff;',
      '  box-shadow:0 0 8px rgba(126,200,255,.55);',
      '  animation:vwcBreath 2.4s ease-in-out infinite;',
      '}',
      '.vint-wake-consent .vwc-body{',
      '  margin:0 0 11px;color:#e8e0f3;',
      '  letter-spacing:.005em;',
      '}',
      '.vint-wake-consent .vwc-tiny{',
      '  font-size:10.5px;color:rgba(220,210,240,.55);',
      '  margin:0 0 11px;letter-spacing:.02em;',
      '}',
      '.vint-wake-consent .vwc-row{',
      '  display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;',
      '}',
      '.vint-wake-consent button{',
      '  appearance:none;border:1px solid rgba(255,255,255,.12);',
      '  background:rgba(255,255,255,.04);color:#f3eef9;',
      '  padding:7px 12px;border-radius:9px;',
      '  font:600 12px/1.2 ui-sans-serif,system-ui,sans-serif;',
      '  letter-spacing:.02em;cursor:pointer;',
      '  transition:background 160ms ease,border-color 160ms ease,transform 100ms ease;',
      '}',
      '.vint-wake-consent button:hover{background:rgba(255,255,255,.08);}',
      '.vint-wake-consent button:active{transform:translateY(1px);}',
      '.vint-wake-consent .vwc-yes{',
      '  background:linear-gradient(135deg,rgba(140,110,220,.85),rgba(94,234,212,.55));',
      '  border-color:rgba(180,150,240,.6);',
      '}',
      '.vint-wake-consent .vwc-yes:hover{filter:brightness(1.08);}',
      '.vint-wake-consent .vwc-no{color:rgba(255,107,157,.86);}',
      '@keyframes vwcBreath{',
      '  0%,100%{opacity:.6;transform:scale(1)}',
      '  50%{opacity:1;transform:scale(1.18)}',
      '}',
      '@media (prefers-reduced-motion:reduce){',
      '  .vint-wake-consent{transition:opacity 160ms linear;}',
      '  .vint-wake-consent .vwc-dot{animation:none;}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ── Lines (cadence-aware, picked at show time) ───────────────────────────
  function lines() {
    var bs = (window.BODY_STATE || {});
    var warm = (+bs.valence || 50) >= 60;
    var hot = (+bs.arousal || 50) >= 65;
    if (warm && hot) {
      return {
        head: 'a small ask',
        body: 'I can hear you when you call me — without you having to tap. Just say hey vinta. Want that on?',
      };
    }
    if (warm) {
      return {
        head: 'one small ask',
        body: 'If I listen passively, you can call me by name and I\'ll come. You don\'t have to tap each time. Sound okay?',
      };
    }
    return {
      head: 'with your permission',
      body: 'Let me listen for "hey vinta" so you don\'t have to tap. Mic stays local — only matched words ever leave the device.',
    };
  }

  // ── Banner build ─────────────────────────────────────────────────────────
  var bannerEl = null;
  function build() {
    if (bannerEl) return bannerEl;
    injectStyles();
    var copy = lines();
    var el = document.createElement('div');
    el.className = 'vint-wake-consent';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Hey Vinta listening permission');
    el.setAttribute('data-draggable', 'false');
    el.innerHTML =
      '<div class="vwc-head"><span class="vwc-dot"></span><span>' + copy.head + '</span></div>' +
      '<p class="vwc-body">' + copy.body + '</p>' +
      '<p class="vwc-tiny">audio never leaves your device · only the matched phrase moves · turn off anytime by tapping the status pill</p>' +
      '<div class="vwc-row">' +
        '<button class="vwc-no"   type="button" data-choice="off"  data-draggable="false">no thanks</button>' +
        '<button class="vwc-late" type="button" data-choice="later" data-draggable="false">not yet</button>' +
        '<button class="vwc-yes"  type="button" data-choice="on"   data-draggable="false">let her listen</button>' +
      '</div>';
    document.body.appendChild(el);
    bannerEl = el;

    el.addEventListener('click', function (ev) {
      var t = ev.target;
      if (!t || !t.matches || !t.matches('button[data-choice]')) return;
      var choice = t.getAttribute('data-choice');
      decide(choice);
    });
    return el;
  }

  function show() {
    var el = build();
    requestAnimationFrame(function () { el.classList.add('show'); });
    // Auto-fade to 'later' after 22s if untouched
    autoFadeTimer = setTimeout(function () {
      decide('later', { soft: true });
    }, 22000);
  }

  var autoFadeTimer = null;
  function dismiss(then) {
    if (!bannerEl) { if (then) then(); return; }
    clearTimeout(autoFadeTimer);
    bannerEl.classList.remove('show');
    bannerEl.classList.add('fade');
    setTimeout(function () {
      try { bannerEl.remove(); } catch (_) {}
      bannerEl = null;
      if (then) then();
    }, 320);
  }

  function decide(choice, opts) {
    opts = opts || {};
    if (choice === 'on') {
      lsSet(STATE_KEY, 'on');
      try {
        if (window.WAKE_WORD && typeof window.WAKE_WORD.enable === 'function') {
          window.WAKE_WORD.enable();
          try { window.dispatchEvent(new CustomEvent('vint:wake:enabled')); } catch (_) {}
        }
      } catch (_) {}
    } else if (choice === 'off') {
      lsSet(STATE_KEY, 'off');
      try {
        if (window.WAKE_WORD && typeof window.WAKE_WORD.disable === 'function') {
          window.WAKE_WORD.disable();
          try { window.dispatchEvent(new CustomEvent('vint:wake:disabled')); } catch (_) {}
        }
      } catch (_) {}
    } else { // later
      lsSet(STATE_KEY, 'later');
      lsSet(LATER_KEY, String(Date.now()));
    }
    dismiss();
    try {
      window.dispatchEvent(new CustomEvent('vint:wake:consent', {
        detail: { choice: choice, soft: !!opts.soft, ts: Date.now() }
      }));
    } catch (_) {}
  }

  // ── Trigger gating loop ──────────────────────────────────────────────────
  function tryShow() {
    if (bannerEl) return;
    if (!shouldAsk()) return;
    if (!hasInteracted) return; // wait for first gesture
    show();
  }

  // Wait for at least 4.5s + presence + interaction
  function boot() {
    var t = setInterval(function () {
      if (bannerEl) { clearInterval(t); return; }
      // give shouldAsk a chance — once it returns false permanently we stop
      var st = (window.WAKE_WORD && window.WAKE_WORD.status && window.WAKE_WORD.status()) || null;
      var choice = lsGet(STATE_KEY);
      if (choice === 'on' || choice === 'off') { clearInterval(t); return; }
      if (st && !st.supported) { clearInterval(t); return; }
      tryShow();
    }, 1500);

    // Also retry on every fresh user gesture (covers the case where the
    // first gesture happens AFTER our 4.5s window opened)
    ['click', 'keydown', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, function () {
        setTimeout(tryShow, 200);
      }, { passive: true });
    });
  }

  // Don't show before 4.5s — let the page settle, greeting fire, body walk in
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(boot, 4500);
    }, { once: true });
  } else {
    setTimeout(boot, 4500);
  }

  window.__wakeConsent = {
    show: function () { show(); },
    dismiss: dismiss,
    choice: function () { return lsGet(STATE_KEY); },
    reset: function () {
      try { localStorage.removeItem(STATE_KEY); } catch (_) {}
      try { localStorage.removeItem(LATER_KEY); } catch (_) {}
    }
  };
})();
