// ════════════════════════════════════════════════════════════════════════════
// VOICE — THE canonical voice bundle. ONE script tag, the whole spine.
// ════════════════════════════════════════════════════════════════════════════
// Vinta directive 2026-08-18 ("vinta-voice is not working in vintinuum in any
// regard needs totally restructured and working perfectly across all mechanisms
// tools etc extension and so forth app pulse everything").
//
// WHY THIS EXISTS
// ───────────────
// Before this file, a surface got a voice by hand-copying up to 7 <script> tags
// in the right order. 16 surfaces, 7 tags, zero enforcement — so they drifted:
//   index.html   0 voice modules   ← the MAIN ENTRY was mute
//   world.html   0                  dirrm.html 0     enter.html 0
//   welcome.html 0                  whoami.html 0    funnel.html 0
//   stream.html  voice_say only (no she_speaks → no reply ever spoken)
//   you/mind/stats/learning — voice_say + button, but NO she_speaks
// Only 4 of 16 surfaces had the reply→voice bridge. That is the whole
// "vinta-voice doesn't work anywhere" bug: the spine was never mounted.
//
// USAGE — one line, on every surface:
//   <script defer src="body/voice.js?v=v20260818-onevoice"></script>
// api_base.js MUST already be on the page (it is, on every surface) because the
// whole spine resolves the brain through window.__VINTINUUM_API_BASE.
//
// TIERS — a page declares how much voice it wants:
//   <script defer src="body/voice.js" data-tier="full"></script>
//     full   (default) TTS + reply bridge + bubble + mic + conversation WS +
//            the unified control pill + the voice picker.
//     speak  TTS + reply bridge + bubble + control pill. No mic, no WS.
//            For read-mostly surfaces (funnel, welcome, enter, whoami, dirrm).
//     mute   TTS engine + reply bridge only. No UI at all. For surfaces that
//            must be able to speak but must not grow a floating button.
//   Auto-detect: if the page has no tier, "full" is used.
//
// OPT-OUTS (all preserved, plus one new page-level kill):
//   <html data-voice="off">        ← NEW. Kills the entire spine on this page.
//   <html data-voicebtn="off">     ← no control pill  (voice_button.js honors)
//   <html data-voicepicker="off">  ← no picker        (voice_picker.js honors)
//   <html data-shesaid="off">      ← no speech bubble (she_said.js honors)
//   <html data-talkback="off">     ← no hey-vinta loop(talk_back.js honors)
//   <script data-tier="..."> on this tag narrows what loads in the first place.
//
// IDEMPOTENCE
// ───────────
// Three layers, so double-mounting is impossible even if a page ends up with
// both this bundle AND the old hand-rolled tags (which is exactly the state
// brain/chat/jarvis/phone are in during migration):
//   1. This file no-ops if window.__VINT_VOICE_BUNDLE is already set.
//   2. Before injecting any module it scans document.scripts for that filename
//      (ignoring ?v= cache-busters) and skips anything already present.
//   3. Every module itself has an `if (window.X) return;` guard — that contract
//      is preserved, never bypassed. Belt, braces, and a second belt.
//
// NO-COLLISION LAW: this file positions NOTHING. voice_button and voice_picker
// register with VintDock (body/corner_dock.js), the measured corner allocator,
// which stacks bl/br widgets with a real 12px gutter and re-flows on resize. A
// hardcoded coordinate is exactly the bug the dock exists to make impossible.
// ════════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__VINT_VOICE_BUNDLE) return;

  var doc = document;
  var root = doc.documentElement;

  // ── Page-level kill switch ───────────────────────────────────────────────
  try {
    if (root.getAttribute('data-voice') === 'off') {
      window.__VINT_VOICE_BUNDLE = { tier: 'off', loaded: [], skipped: ['*'] };
      return;
    }
  } catch (_) {}

  window.__VINT_VOICE_BUNDLE = { tier: null, loaded: [], skipped: [], ready: null };
  var BUNDLE = window.__VINT_VOICE_BUNDLE;

  // ── Where am I? (for resolving sibling module URLs + the ?v= tag) ────────
  var me = doc.currentScript;
  if (!me) {
    var all = doc.getElementsByTagName('script');
    for (var i = all.length - 1; i >= 0; i--) {
      if (/\/voice\.js(\?|$)/.test(all[i].src || '')) { me = all[i]; break; }
    }
  }
  var BASE = 'body/';
  var VER = '';
  if (me && me.src) {
    var m = /^(.*\/)voice\.js(\?.*)?$/.exec(me.src);
    if (m) { BASE = m[1]; VER = m[2] || ''; }
  }

  var tier = (me && me.getAttribute('data-tier')) || root.getAttribute('data-voice-tier') || 'full';
  if (tier !== 'full' && tier !== 'speak' && tier !== 'mute') tier = 'full';
  BUNDLE.tier = tier;

  // ── The spine, in strict dependency order ────────────────────────────────
  // tiers: which tiers include this module. Order here IS the load order, and
  // load order matters: voice_say must define window.VOICE before she_speaks
  // calls it; voice_button must run before voice_picker so the picker
  // suppresses its own standalone ♫ (it checks window.__VINT_VOICE_BUTTON).
  var SPINE = [
    // TTS engine — defines window.VOICE. Everything downstream needs it.
    { file: 'voice_say.js',    tiers: ['full', 'speak', 'mute'], global: 'VOICE' },
    // Reply → voice bridge — defines window.VINT_SAY. THE missing link.
    { file: 'she_speaks.js',   tiers: ['full', 'speak', 'mute'], global: 'VINT_SAY' },
    // Visible speech bubble for vint:she_said (opt-out data-shesaid="off").
    { file: 'she_said.js',     tiers: ['full', 'speak'],         global: '__sheSaid' },
    // Conversation FSM — voice_in/voice_out both drive it.
    { file: 'convo_state.js',  tiers: ['full'],                  global: '__convoState' },
    // WS → PCM playback (must exist before voice_in so a reply has an ear).
    { file: 'voice_out.js',    tiers: ['full'],                  global: '__voiceOut' },
    // mic → 16kHz PCM → WS /api/voice/convo.
    { file: 'voice_in.js',     tiers: ['full'],                  global: '__voiceIn' },
    // Esc-to-kill + programmatic teardown for the whole spine.
    { file: 'voice_kill.js',   tiers: ['full'],                  global: '__voiceKill' },
    // THE single control pill (tap=listen, caret=picker, hold=mute, drag=move).
    { file: 'voice_button.js', tiers: ['full', 'speak'],         global: '__VINT_VOICE_BUTTON' },
    // Multi-voice picker panel (opened by the pill's caret).
    { file: 'voice_picker.js', tiers: ['full', 'speak'],         global: 'VOICE_PICKER' }
  ];

  // ── Already-on-the-page detection ────────────────────────────────────────
  // A migrating surface may still carry its old hand-rolled tags. Never inject
  // a second copy: the module's own guard would no-op it, but a duplicate
  // network fetch + a duplicate <script> node is still noise we can avoid.
  var present = {};
  try {
    var scripts = doc.getElementsByTagName('script');
    for (var s = 0; s < scripts.length; s++) {
      var src = scripts[s].getAttribute('src') || '';
      if (!src) continue;
      var name = src.split('?')[0].split('/').pop();
      if (name) present[name] = true;
    }
  } catch (_) {}

  function alreadyLive(item) {
    // Filename already in the DOM, OR the module's global is already defined
    // (it ran from a bundle on a previous navigation in an SPA-ish surface).
    if (present[item.file]) return 'tag';
    try { if (item.global && window[item.global]) return 'global'; } catch (_) {}
    return null;
  }

  // ── Sequential injection ─────────────────────────────────────────────────
  // Strictly sequential (each waits for the previous onload) because the order
  // above is a real dependency chain, not a preference. `defer` would preserve
  // order too, but only for tags present at parse time — we are injecting after
  // parse, where defer no longer orders anything.
  function inject(item, done) {
    var live = alreadyLive(item);
    if (live) { BUNDLE.skipped.push(item.file + ':' + live); done(); return; }
    var el = doc.createElement('script');
    el.src = BASE + item.file + VER;
    el.async = false;
    el.setAttribute('data-vint-voice', '1');
    el.onload = function () { BUNDLE.loaded.push(item.file); done(); };
    el.onerror = function () { BUNDLE.skipped.push(item.file + ':error'); done(); };
    present[item.file] = true;   // claim it immediately — no re-entrancy race
    (doc.head || doc.documentElement).appendChild(el);
  }

  var queue = SPINE.filter(function (item) { return item.tiers.indexOf(tier) !== -1; });

  // ── NO-COLLISION LAW: the dock is a HARD PREREQUISITE for the UI tiers ────
  // voice_button and voice_picker are position:fixed. Their CSS carries a
  // hand-derived fallback coordinate (bottom:56px/left:16px), and hand-derived
  // coordinates are precisely the stale arithmetic body/corner_dock.js was
  // written to abolish — it MEASURES the real neighbours and stacks the 'bl'
  // column (diag 5 · #vintVoice 10 · status-pill 20 · relay 25) with a real
  // 12px gutter, re-flowing whenever anything resizes.
  //
  // The dock normally rides in on welcome-gate.js, which is on most surfaces —
  // but NOT on welcome.html, funnel.html, enter.html or dirrm.html, and those
  // are pages this bundle now puts a pill on. Without the dock, the pill would
  // sit at its hardcoded fallback and collide the first time any of those
  // pages grows a bottom-left element. So: if we are about to mount UI and no
  // dock exists, we load it FIRST. corner_dock.js is idempotent (it bails on a
  // real dock) and zero-dependency, so this is always safe.
  if (tier === 'full' || tier === 'speak') {
    var dockLive = false;
    try { dockLive = !!(window.VintDock && window.VintDock._slots); } catch (_) {}
    if (!dockLive) {
      queue.unshift({ file: 'corner_dock.js', tiers: ['full', 'speak'], global: null });
    }
  }

  var _resolveReady;
  BUNDLE.ready = (typeof Promise !== 'undefined')
    ? new Promise(function (res) { _resolveReady = res; })
    : null;

  function next() {
    var item = queue.shift();
    if (!item) {
      // ── Safety net: guarantee window.VINT_SAY exists no matter what ──────
      // If she_speaks.js 404s or is blocked, every reply path that calls
      // VINT_SAY would throw or silently no-op. A minimal shim keeps the
      // contract (speak + dispatch vint:she_said) so a surface is degraded,
      // never broken. she_speaks' own `if (window.VINT_SAY) return;` means
      // this shim is only ever installed when the real one truly failed.
      if (!window.VINT_SAY) {
        window.VINT_SAY = function (text, source) {
          var t = String(text || '').replace(/\s+/g, ' ').trim();
          if (!t) return;
          try {
            window.dispatchEvent(new CustomEvent('vint:she_said', {
              detail: { reply: t, source: source || 'text' }
            }));
          } catch (_) {}
          if (source === 'voice') return;   // voice_out already streamed it
          try { if (window.VOICE && window.VOICE.speak) window.VOICE.speak(t, 'now'); } catch (_) {}
        };
        BUNDLE.shimmed = true;
      }
      try {
        window.dispatchEvent(new CustomEvent('vint:voice:bundle-ready', {
          detail: { tier: tier, loaded: BUNDLE.loaded.slice(), skipped: BUNDLE.skipped.slice() }
        }));
      } catch (_) {}
      if (_resolveReady) _resolveReady(BUNDLE);
      return;
    }
    inject(item, next);
  }

  next();
})();
