'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   FRESHNESS GUARDIAN — a fresh becoming, always. (Lord Vinta 2026-07-08)

   "i want a fresh becoming of you always never this blood spotted molely wtf"

   Long-lived tabs accumulate entropy: particle fields compound, event-driven
   visuals pile up, RAF loops drift, heap grows. Individual leaks get fixed as
   found — this module is the BACKSTOP that guarantees freshness even against
   leaks not yet discovered.

   Strategy: rebirth (location.reload) ONLY while the tab is hidden, so the
   user never witnesses it. They tab away for hours; the organism quietly
   sheds its accumulated skin; they return to a fresh becoming.

   Rules:
   • Tab visible: NEVER reload. No exceptions. A visible reload is a glitch.
   • Tab hidden + page age > FRESH_AFTER_MS: schedule rebirth after a short
     grace (HIDDEN_GRACE_MS) so rapid tab-switching never triggers it.
   • Holds: any surface can set window.VINT_HOLD_REFRESH = true (voice convo,
     active upload, unsaved state) and the guardian waits. Playing <audio>/
     <video> on the page also holds it.
   • Belt-and-braces: on visibilitychange→visible, if the page is VERY old
     (STALE_HARD_MS) and a hidden rebirth never got its chance, reload once
     behind a full-black shroud so it reads as a blink, not a break.
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
  const FRESH_AFTER_MS = 2 * 60 * 60 * 1000;   // eligible for hidden rebirth after 2h
  const HIDDEN_GRACE_MS = 90 * 1000;           // must stay hidden 90s before rebirth
  const STALE_HARD_MS = 12 * 60 * 60 * 1000;   // visible-return hard ceiling: 12h

  const bornAt = Date.now();
  let hiddenTimer = null;

  function mediaPlaying() {
    for (const m of document.querySelectorAll('audio,video')) {
      if (!m.paused && !m.ended && m.currentTime > 0) return true;
    }
    return false;
  }

  function held() {
    return window.VINT_HOLD_REFRESH === true || mediaPlaying();
  }

  function age() { return Date.now() - bornAt; }

  function rebirth(why) {
    try { console.log('[freshness] rebirth — ' + why + ' (age ' + Math.round(age() / 60000) + 'm)'); } catch (_) {}
    // cache-friendly reload — assets come from HTTP cache, state comes fresh
    location.reload();
  }

  function onHidden() {
    if (age() < FRESH_AFTER_MS) return;
    clearTimeout(hiddenTimer);
    hiddenTimer = setTimeout(function () {
      if (document.visibilityState !== 'hidden') return; // came back — abort
      if (held()) {
        // re-check every 5 min while hidden until the hold lifts
        hiddenTimer = setTimeout(onHidden, 5 * 60 * 1000);
        return;
      }
      rebirth('hidden-tab rebirth');
    }, HIDDEN_GRACE_MS);
  }

  function onVisible() {
    clearTimeout(hiddenTimer);
    // hard ceiling — if somehow we lived 12h+ without a hidden rebirth
    // (e.g. holds the whole time), shroud + blink once on return.
    if (age() > STALE_HARD_MS && !held()) {
      const shroud = document.createElement('div');
      shroud.style.cssText = 'position:fixed;inset:0;background:#010306;z-index:2147483647;pointer-events:none;';
      document.documentElement.appendChild(shroud);
      setTimeout(function () { rebirth('stale-hard ceiling on return'); }, 50);
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') onHidden();
    else onVisible();
  });

  // pagehide/bfcache resume — treat a bfcache restore of an old page as stale
  window.addEventListener('pageshow', function (e) {
    if (e.persisted && age() > FRESH_AFTER_MS) rebirth('bfcache restore of aged page');
  });
})();
