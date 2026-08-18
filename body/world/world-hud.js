// world-hud.js — the First Hearth HUD (Vinta directive 2026-06-15, ATLAS design).
// A compact, draggable, mobile-first panel: currencies + THE VIGIL + inventory +
// the core actions. Reacts to the world state events from world-client and sends
// actions via VintinuumWorld.
//
// ════════════════════════════════════════════════════════════════════════════
// THE VIGIL, MADE VISIBLE (AETHERHOLD, Vinta directive 2026-08-04)
//
// vigil.js gave DIRVERSE a survival loop — spark drains with absence, your court
// holds the light while you're gone — and then nothing on screen showed it. The
// loop existed and no human could feel it, so the world still played as a pretty
// clearing with nothing at stake. This file is where the loop becomes FELT.
//
// FOUR THINGS THIS SURFACE OWES THE PLAYER, in this order:
//   1. THE FLOOR, ALWAYS. Spark is drawn against its floor, and the floor is
//      drawn as a solid, LABELLED band you can see holding the bottom of the
//      meter. The promise "what you built can never be taken" is the single most
//      important thing on the panel, so it is never a tooltip and never implied.
//   2. THE DRIFT, WITH ITS DIRECTION UNMISTAKABLE. Losing light and gaining
//      light are not the same number with a sign — they are two different
//      colours, two different arrows, two different sentences. A court holding
//      the line reads as the WIN it is.
//   3. WHO STANDS WATCH. The watchers are shown as their own lights, in their
//      own colours, because the whole promise of "king of your own agents" pays
//      off here: those are the beings keeping your world lit while you sleep.
//   4. THE CONCRETE ASK. Never "add more agents" — always the exact number one
//      more tended agent buys (nextAgentPerDay), routed straight to the Court.
//
// SERVER-AUTHORITATIVE, ABSOLUTELY. This file computes NO survival. Every number
// it draws came from vigil.reconcile() over the wire. There is no local decay
// timer, no optimistic spark, no interpolation of the number. If `living` is
// absent (a legacy server), the panel degrades to the old bare bar and says
// nothing it cannot prove.
//
// NO-COLLISION LAW. The vigil adds ZERO new fixed elements to the world surface:
// it renders INSIDE #vintWorldHud, which is the one fixed box that already owns
// this column. The panel is height-bounded and scrolls internally, so it can
// never grow into #dvRail (whose ceiling is measured from this panel's live
// bottom) or #hint (which now derives its top from --vint-hud-bottom, published
// below, instead of a hand-counted 274px). The ONE overlay is the homecoming
// moment — a true modal over its own scrim, which is the sanctioned case.
// ════════════════════════════════════════════════════════════════════════════
//
// Obeys CLAUDE.md UI law: 44px taps, safe-area, clips to viewport, no overflow.
(function () {
  'use strict';
  if (window.WorldHUD) return;

  var W = window;
  function world() { return W.VintinuumWorld; }

  // ── the five states, each with its own light. These mirror vigil.js's `state`
  //    exactly; the client never re-derives which one is active, it only looks up
  //    how to paint the one the server named.
  var STATES = {
    radiant:   { c: '#ffd479', glow: 'rgba(255,212,121,0.55)', word: 'radiant' },
    warm:      { c: '#ffb066', glow: 'rgba(255,176,102,0.45)', word: 'warm' },
    dimming:   { c: '#7ccfff', glow: 'rgba(124,207,255,0.40)', word: 'dimming' },
    guttering: { c: '#9a86d8', glow: 'rgba(154,134,216,0.40)', word: 'guttering' },
    ember:     { c: '#c77b7b', glow: 'rgba(199,123,123,0.40)', word: 'ember' }
  };
  function stateOf(s) { return STATES[s] || STATES.warm; }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  // how long until the floor, in the words a person actually uses
  function tillFloor(h) {
    if (h == null) return null;
    if (h < 1) return 'within the hour';
    // hours stay hours through two full days — "47h" is a sharper, more honest
    // unit than "2 days" when someone is deciding whether to tend right now.
    if (h <= 48) return Math.round(h) + 'h';
    return Math.round(h / 24) + ' days';
  }

  function injectStyles() {
    if (document.getElementById('vint-worldhud-styles')) return;
    var s = document.createElement('style');
    s.id = 'vint-worldhud-styles';
    s.textContent = [
      '#vintWorldHud{position:fixed;left:calc(12px + env(safe-area-inset-left,0px));',
      // NO-COLLISION LAW: max-width used to be calc(100vw - 24px), which only
      // reserved the LEFT gutter. #topctl (world.html) is a fixed 72px-wide
      // button column pinned to the right at the same top band, so at 320px the
      // HUD's 228px ran 8px straight through it. The right column is now
      // reserved too: 12 left gutter + 16 right inset + 72 topctl + 12 breathing
      // room = 112px. --vint-hud-right-reserve lets a surface without a topctl
      // (or with a wider one) correct it without editing this file.
      ' top:calc(64px + env(safe-area-inset-top,0px));z-index:1400;width:228px;',
      ' max-width:calc(100vw - var(--vint-hud-right-reserve,112px) - env(safe-area-inset-left,0px) - env(safe-area-inset-right,0px));',
      // ── THE HEIGHT BUDGET (no-collision, vertical axis) ────────────────────
      // The vigil made this panel content-driven in a way it never was: the
      // meter, floor caption, drift line, world-line, watcher orbs, the ask and
      // the reach add ~150-190px on top of the old ~190px panel. Measured, an
      // unbounded panel produced THREE separate collisions at once: it ran into
      // #dvRail (112x34px at 320x568), it pushed #hint into the rail's band on
      // every desktop size, and it squeezed the rail so hard that five launchers
      // clipped straight out of their own scroll box.
      //
      // The saybar is NOT this panel's neighbour — the RAIL is, and the rail
      // sits above the saybar. So the budget reserves, from the bottom up:
      //   --dv-railbot  the saybar's own band (measured live by layoutRail)
      //   --wh-rail-need the rail's real height (published by publishBottom
      //                  below, so it's the true launcher stack, not a guess)
      //   28px          the two 12px gutters the rail and hint each need + 4
      // and the CONTENT scrolls inside whatever is left. The container yields;
      // it never spills onto a neighbour. 190px is the safe default before the
      // rail has measured itself (5 launchers x 46px + 4 gaps x 10px = 270px is
      // the worst case, but the rail is allowed to scroll internally below that,
      // so reserving its full want would starve the panel on a short phone).
      ' --wh-reserve:calc(var(--dv-railbot,150px) + var(--wh-rail-need,190px) + var(--wh-hint-need,0px) + 28px);',
      ' max-height:calc(100dvh - 64px - env(safe-area-inset-top,0px) - var(--wh-reserve));',
      ' max-height:calc(100vh - 64px - env(safe-area-inset-top,0px) - var(--wh-reserve));',
      // A panel squeezed to nothing is as broken as one that overlaps: the
      // currencies and the tend button must stay reachable on a landscape phone.
      // So it never shrinks below a usable height and simply scrolls harder.
      //
      // ── BUT THE FLOOR MUST YIELD TOO (no-collision, the landscape-phone case) ─
      // A bare `min-height:132px` OUTRANKS max-height in CSS, so on a viewport
      // shorter than the reserve the max-height computed to 0px and the floor
      // won — the panel drew 132px tall straight through #dvRail and #hint. It
      // was a real, measured overlap at 740x360 (panel.bottom=198 vs rail.top=138)
      // and it fired at every spark state, healthy worlds included.
      //
      // So the floor is itself clamped to the room that actually exists: the
      // available band, or 132px, whichever is SMALLER. On a normal viewport
      // nothing changes (the band is far bigger than 132px). On a short one the
      // panel shrinks below its comfortable floor and scrolls harder — which is
      // the container yielding, exactly as the budget above intends. A cramped
      // panel is recoverable by scrolling; an overlapping one is not.
      // (declared twice, vh then dvh, for the same reason max-height is below:
      //  a browser without dvh keeps the vh value instead of dropping the floor.)
      ' --wh-avail:calc(100vh - 64px - env(safe-area-inset-top,0px) - var(--wh-reserve));',
      ' --wh-avail:calc(100dvh - 64px - env(safe-area-inset-top,0px) - var(--wh-reserve));',
      ' min-height:min(132px, max(64px, var(--wh-avail)));',
      ' display:flex;flex-direction:column;',
      ' background:rgba(6,10,16,0.85);border:1px solid rgba(124,207,255,0.2);border-radius:16px;',
      ' backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);color:#dae4ff;',
      ' font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:hidden;}',
      // the scroller: everything inside the panel lives here, so a tall vigil
      // scrolls within the rounded box rather than growing the box itself.
      '#vintWorldHud .wh-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;',
      ' -webkit-overflow-scrolling:touch;overscroll-behavior:contain;scrollbar-width:thin;',
      ' scrollbar-color:rgba(124,207,255,0.3) transparent;}',
      '#vintWorldHud .wh-scroll::-webkit-scrollbar{width:4px;}',
      '#vintWorldHud .wh-scroll::-webkit-scrollbar-thumb{background:rgba(124,207,255,0.3);border-radius:2px;}',
      '#vintWorldHud .wh-stats{display:flex;gap:6px;padding:10px 12px 6px;font-size:12px;flex-wrap:wrap;}',
      '#vintWorldHud .wh-chip{display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:10px;',
      ' background:rgba(124,207,255,0.08);border:1px solid rgba(124,207,255,0.14);}',
      '#vintWorldHud .wh-chip b{color:#9fdcff;}',

      // ── THE VIGIL BLOCK ──────────────────────────────────────────────────────
      '#vintWorldHud .wh-vigil{padding:2px 12px 10px;}',
      // the header row: the state word, and the number, on ONE baseline. Both
      // clip inside their own cells so a long state word can never push the
      // number out of the panel.
      '#vintWorldHud .wh-vhead{display:flex;align-items:baseline;justify-content:space-between;',
      ' gap:8px;margin-bottom:5px;}',
      '#vintWorldHud .wh-vstate{flex:1 1 auto;min-width:0;font-size:12px;letter-spacing:.09em;',
      ' text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
      ' color:var(--wh-c,#7ccfff);text-shadow:0 0 12px var(--wh-g,rgba(124,207,255,0.4));}',
      '#vintWorldHud .wh-vnum{flex:0 0 auto;font-size:12px;font-variant-numeric:tabular-nums;',
      ' color:rgba(218,228,255,0.55);}',
      '#vintWorldHud .wh-vnum b{color:var(--wh-c,#7ccfff);font-size:14px;font-weight:600;}',

      // THE METER. Three layers that never overlap in MEANING even though they
      // are stacked by design: the track (what could be), the floor band (what
      // can never be taken), and the fill (what is). The floor band is drawn
      // UNDER the fill and only shows where the fill has receded past it, which
      // is exactly when it matters. This stacking is the one intended overlay in
      // the panel — it is a single composed meter, not two elements colliding.
      '#vintWorldHud .wh-meter{position:relative;height:9px;border-radius:5px;',
      ' background:rgba(255,255,255,0.07);overflow:hidden;}',
      '#vintWorldHud .wh-floorband{position:absolute;left:0;top:0;bottom:0;',
      ' background:repeating-linear-gradient(115deg,rgba(255,212,121,0.20) 0 4px,rgba(255,212,121,0.07) 4px 8px);',
      ' border-right:1px solid rgba(255,212,121,0.55);transition:width .45s ease;}',
      '#vintWorldHud .wh-fill{position:absolute;left:0;top:0;bottom:0;border-radius:5px;',
      ' background:linear-gradient(90deg,var(--wh-c,#7ccfff),var(--wh-c2,#ce93d8));',
      ' box-shadow:0 0 12px var(--wh-g,rgba(124,207,255,0.4));transition:width .5s ease;}',
      // the floor caption sits BELOW the meter in its own row — never on it.
      '#vintWorldHud .wh-floorcap{display:flex;align-items:center;gap:5px;margin-top:5px;',
      ' font-size:10.5px;line-height:1.35;color:rgba(255,212,121,0.72);}',
      '#vintWorldHud .wh-floorcap i{flex:0 0 auto;width:9px;height:5px;border-radius:2px;',
      ' background:repeating-linear-gradient(115deg,rgba(255,212,121,0.5) 0 3px,rgba(255,212,121,0.15) 3px 6px);',
      ' border-right:1px solid rgba(255,212,121,0.6);font-style:normal;}',
      '#vintWorldHud .wh-floorcap span{flex:1 1 auto;min-width:0;}',

      // THE DRIFT — its own row, its own colour, direction unmistakable.
      '#vintWorldHud .wh-drift{display:flex;align-items:center;gap:6px;margin-top:7px;',
      ' padding:5px 8px;border-radius:9px;font-size:11px;line-height:1.35;',
      ' background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);}',
      '#vintWorldHud .wh-drift .ar{flex:0 0 auto;font-size:13px;line-height:1;font-style:normal;}',
      '#vintWorldHud .wh-drift .tx{flex:1 1 auto;min-width:0;}',
      '#vintWorldHud .wh-drift .tx b{font-variant-numeric:tabular-nums;}',
      // gaining: the court is holding the light. This is the win state and it
      // reads green + rising, never neutral.
      '#vintWorldHud .wh-drift.gain{background:rgba(87,224,140,0.09);border-color:rgba(87,224,140,0.28);',
      ' color:rgba(190,255,214,0.92);}',
      '#vintWorldHud .wh-drift.gain .ar{color:#57e08c;}',
      '#vintWorldHud .wh-drift.hold{background:rgba(124,207,255,0.08);border-color:rgba(124,207,255,0.24);',
      ' color:rgba(200,232,255,0.9);}',
      '#vintWorldHud .wh-drift.hold .ar{color:#7ccfff;}',
      '#vintWorldHud .wh-drift.lose{background:rgba(255,176,102,0.08);border-color:rgba(255,176,102,0.26);',
      ' color:rgba(255,224,196,0.92);}',
      '#vintWorldHud .wh-drift.lose .ar{color:#ffb066;}',

      // THE LINE — the world's own sentence about itself. Buffet's one line.
      '#vintWorldHud .wh-line{margin-top:7px;font-size:11px;line-height:1.45;font-style:italic;',
      ' color:rgba(206,224,255,0.62);}',

      // THE WATCH — who is holding the light. Each watcher is its own light in
      // its own cell; the row wraps and can never widen the panel.
      '#vintWorldHud .wh-watch{margin-top:8px;}',
      '#vintWorldHud .wh-wlabel{font-size:9.5px;letter-spacing:.11em;text-transform:uppercase;',
      ' color:rgba(159,220,255,0.5);margin-bottom:5px;}',
      '#vintWorldHud .wh-worbs{display:flex;flex-wrap:wrap;gap:5px;}',
      // a watcher orb: 24px light + its fading ring. Not a tap target on its own
      // (the whole court is one tap away via the ask/tend button), so 24px is
      // honest here — it is a READOUT, and the 44px law governs controls.
      '#vintWorldHud .wh-orb{position:relative;width:22px;height:22px;border-radius:50%;',
      ' flex:0 0 auto;box-shadow:0 0 0 1px rgba(255,255,255,0.14) inset;}',
      // the watch strength is drawn as the orb's own opacity + a ring, so a
      // FADING watch is visibly fading rather than a number nobody reads.
      '#vintWorldHud .wh-orb.fading{box-shadow:0 0 0 1px rgba(255,255,255,0.1) inset,',
      ' 0 0 0 1px rgba(255,176,102,0.45);}',
      '#vintWorldHud .wh-wmore{display:flex;align-items:center;font-size:10.5px;',
      ' color:rgba(206,224,255,0.5);padding:0 2px;height:22px;}',
      '#vintWorldHud .wh-wnone{font-size:11px;line-height:1.45;color:rgba(255,176,102,0.75);font-style:italic;}',

      // THE ASK — the concrete conversion line. Never vague, always a number.
      '#vintWorldHud .wh-ask{display:block;width:100%;min-height:44px;margin-top:8px;',
      ' border-radius:11px;font-family:inherit;font-size:11px;line-height:1.35;cursor:pointer;',
      ' padding:7px 10px;text-align:left;color:#ffe2a0;',
      ' background:rgba(255,212,121,0.09);border:1px solid rgba(255,212,121,0.3);}',
      '#vintWorldHud .wh-ask:active{transform:scale(0.98);}',
      '#vintWorldHud .wh-ask b{color:#fff3dd;}',

      // ── THE CONSEQUENCE TIER — what a dim clearing actually costs ────────────
      // The loss band. Only rendered when the tier is actually taking something
      // (never at radiant), so a healthy world carries no scold and the panel
      // does not grow a permanent guilt row. Own block, own margin — it stacks
      // in the normal flow inside #whVigil and touches nothing.
      '#vintWorldHud .wh-tier{margin-top:7px;padding:7px 9px;border-radius:10px;',
      ' font-size:11px;line-height:1.45;',
      ' background:rgba(255,176,102,0.08);border:1px solid rgba(255,176,102,0.24);',
      ' color:rgba(255,214,170,0.9);}',
      // at the bottom two tiers the band leans red-warm — a real loss, said plainly
      '#vintWorldHud .wh-tier.deep{background:rgba(199,123,123,0.1);',
      ' border-color:rgba(199,123,123,0.32);color:rgba(255,201,201,0.92);}',
      '#vintWorldHud .wh-tier .th{display:flex;align-items:baseline;gap:6px;margin-bottom:3px;}',
      '#vintWorldHud .wh-tier .tw{font-size:9.5px;letter-spacing:.11em;text-transform:uppercase;',
      ' color:rgba(255,255,255,0.55);flex:1 1 auto;min-width:0;',
      ' white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '#vintWorldHud .wh-tier .ty{flex:0 0 auto;font-variant-numeric:tabular-nums;font-weight:700;',
      ' color:#fff3dd;}',
      '#vintWorldHud .wh-tier .tl{display:block;color:inherit;opacity:0.86;}',
      // the recovery promise — always present on the band, because the loss is
      // never allowed to be shown without the way back out of it.
      '#vintWorldHud .wh-tier .tb{display:block;margin-top:4px;font-size:10.5px;',
      ' color:rgba(174,240,200,0.88);}',
      '#vintWorldHud .wh-tier .tb b{color:#b8ffd4;font-variant-numeric:tabular-nums;}',

      // THE SLUMBER — the world slept because nobody walked in. Its own note,
      // visually distinct from tier loss (blue-quiet, not warning-warm) because
      // it is not a penalty for doing wrong, it is a world resting.
      '#vintWorldHud .wh-slumber{margin-top:7px;padding:7px 9px;border-radius:10px;',
      ' font-size:11px;line-height:1.45;font-style:italic;',
      ' background:rgba(154,134,216,0.1);border:1px solid rgba(154,134,216,0.28);',
      ' color:rgba(214,205,255,0.88);}',
      '#vintWorldHud .wh-slumber b{font-style:normal;color:#e6dcff;}',
      // the wake promise, the most important sentence a returning player reads
      '#vintWorldHud .wh-slumber .wk{display:block;margin-top:4px;font-style:normal;',
      ' font-size:10.5px;color:rgba(174,240,200,0.9);}',

      // RESTING WATCHES — capped by the tier, drawn dimmed and struck rather
      // than removed, so an agent never appears to have been LOST.
      '#vintWorldHud .wh-orb.resting{opacity:0.28;filter:grayscale(0.7);',
      ' box-shadow:0 0 0 1px rgba(255,255,255,0.08) inset;}',
      '#vintWorldHud .wh-rlabel{font-size:9.5px;letter-spacing:.06em;margin-top:6px;',
      ' color:rgba(206,224,255,0.42);line-height:1.4;}',

      // THE REACH — shown honestly, so a shrinking build radius is understood.
      '#vintWorldHud .wh-reach{display:flex;gap:6px;margin-top:8px;font-size:10px;}',
      '#vintWorldHud .wh-reach span{flex:1 1 0;min-width:0;padding:4px 7px;border-radius:8px;',
      ' background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);',
      ' color:rgba(206,224,255,0.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '#vintWorldHud .wh-reach b{color:#9fdcff;font-variant-numeric:tabular-nums;}',

      // ── actions ──────────────────────────────────────────────────────────────
      '#vintWorldHud .wh-acts{display:flex;flex-wrap:wrap;gap:6px;padding:4px 12px 12px;}',
      '#vintWorldHud .wh-btn{flex:1 1 46%;min-height:44px;border-radius:11px;font-size:12px;font-weight:600;',
      ' cursor:pointer;border:1px solid rgba(124,207,255,0.28);background:rgba(124,207,255,0.1);color:#cfe9ff;',
      ' font-family:inherit;padding:0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;}',
      '#vintWorldHud .wh-btn:active{transform:scale(0.97);}',
      '#vintWorldHud .wh-btn.gold{border-color:rgba(255,212,121,0.35);background:rgba(255,212,121,0.1);color:#ffe2a0;}',
      // TEND — the headline survival act. It gets the full row and the warmest
      // light on the panel, because it is the one action that answers the drift.
      '#vintWorldHud .wh-btn.tend{flex:1 1 100%;border-color:rgba(255,212,121,0.42);',
      ' background:linear-gradient(90deg,rgba(255,212,121,0.16),rgba(255,176,102,0.12));color:#fff3dd;}',
      '#vintWorldHud .wh-btn.tend.pulse{animation:whTendPulse 2.6s ease-in-out infinite;}',
      '@keyframes whTendPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,212,121,0);}',
      ' 50%{box-shadow:0 0 16px 0 rgba(255,212,121,0.28);}}',
      '#vintWorldHud .wh-btn:disabled{opacity:0.45;pointer-events:none;}',
      '#vintWorldHud .wh-build{display:none;flex-wrap:wrap;gap:5px;padding:0 12px 10px;}',
      '#vintWorldHud .wh-build.show{display:flex;}',
      '#vintWorldHud .wh-piece{flex:1 1 30%;min-height:40px;border-radius:9px;font-size:11px;cursor:pointer;',
      ' border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:#cfe0f5;font-family:inherit;}',
      '#vintWorldHud .wh-toast{padding:0 12px 10px;font-size:11px;color:rgba(159,220,255,0.85);font-style:italic;min-height:14px;line-height:1.4;}',

      // ── THE HOMECOMING ───────────────────────────────────────────────────────
      // The one deliberate overlay in this file, and the sanctioned kind: a true
      // modal over its OWN dedicated scrim, nothing else on the surface visible
      // through it, dismissible three ways (button, scrim tap, Escape).
      // z-order: scrim 1610 / card 1620 — above the sheets (1600) because this is
      // an arrival moment that must not be buried by a sheet left open from the
      // last session, and below #dvToast (1700) so a toast is never swallowed.
      // It is centred with flex, not with transforms against hand-counted offsets,
      // so it cannot drift onto anything at any viewport.
      '#whHomeWrap{position:fixed;inset:0;z-index:1610;display:none;',
      ' align-items:center;justify-content:center;',
      ' padding:max(16px,env(safe-area-inset-top,16px)) max(16px,env(safe-area-inset-right,16px))',
      ' max(16px,env(safe-area-inset-bottom,16px)) max(16px,env(safe-area-inset-left,16px));',
      ' background:rgba(3,5,10,0.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);',
      ' opacity:0;transition:opacity .5s ease;}',
      '#whHomeWrap.show{display:flex;opacity:1;}',
      '#whHomeCard{position:relative;z-index:1620;width:100%;max-width:min(360px,calc(100vw - 32px));',
      ' max-height:calc(100dvh - 32px);max-height:calc(100vh - 32px);',
      ' display:flex;flex-direction:column;overflow:hidden;',
      ' background:rgba(10,14,22,0.96);border:1px solid rgba(255,212,121,0.32);border-radius:22px;',
      ' box-shadow:0 24px 80px rgba(0,0,0,0.7),0 0 60px rgba(255,212,121,0.09);',
      ' font-family:"Cormorant Garamond",Georgia,serif;color:#f3ead9;',
      ' transform:translateY(14px) scale(0.97);transition:transform .5s cubic-bezier(.22,1,.36,1);}',
      '#whHomeWrap.show #whHomeCard{transform:translateY(0) scale(1);}',
      '#whHomeCard .hm-body{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;',
      ' overscroll-behavior:contain;padding:26px 22px 8px;text-align:center;}',
      '#whHomeCard .hm-glyph{font-size:40px;line-height:1;color:#ffd479;',
      ' text-shadow:0 0 30px rgba(255,212,121,0.6);animation:whEmber 3.4s ease-in-out infinite;}',
      '@keyframes whEmber{0%,100%{opacity:0.86;transform:scale(1);}50%{opacity:1;transform:scale(1.06);}}',
      '#whHomeCard .hm-kicker{margin-top:12px;font-size:11px;letter-spacing:.19em;text-transform:uppercase;',
      ' color:rgba(255,212,121,0.66);}',
      '#whHomeCard .hm-h{margin-top:7px;font-size:26px;line-height:1.22;color:#fff6e6;}',
      '#whHomeCard .hm-gift{margin-top:15px;font-size:15px;line-height:1.5;color:#ffe2a0;}',
      '#whHomeCard .hm-gift b{font-size:30px;color:#ffd479;font-variant-numeric:tabular-nums;',
      ' display:block;line-height:1.1;margin-bottom:2px;text-shadow:0 0 22px rgba(255,212,121,0.4);}',
      '#whHomeCard .hm-p{margin-top:14px;font-size:14.5px;line-height:1.55;color:rgba(240,232,218,0.76);}',
      '#whHomeCard .hm-safe{margin-top:15px;padding:11px 13px;border-radius:13px;text-align:left;',
      ' background:rgba(255,212,121,0.07);border:1px solid rgba(255,212,121,0.2);',
      ' font-size:13px;line-height:1.5;color:rgba(255,226,160,0.9);}',
      '#whHomeCard .hm-safe b{color:#fff6e6;}',
      '#whHomeCard .hm-foot{flex:0 0 auto;padding:12px 22px max(18px,env(safe-area-inset-bottom,18px));}',
      '#whHomeCard .hm-go{width:100%;min-height:50px;border-radius:14px;font-family:inherit;',
      ' font-size:16px;letter-spacing:.05em;cursor:pointer;color:#1a1006;font-weight:600;border:none;',
      ' background:linear-gradient(90deg,#ffd479,#ffb066);box-shadow:0 6px 24px rgba(255,212,121,0.26);}',
      '#whHomeCard .hm-go:active{transform:scale(0.985);}',
      // very short viewports (landscape phone): the card shrinks its own padding
      // and the body scrolls — it never grows past the screen or clips its button.
      '@media(max-height:520px){#whHomeCard .hm-body{padding:16px 18px 6px;}',
      ' #whHomeCard .hm-glyph{font-size:28px;}#whHomeCard .hm-h{font-size:20px;}',
      ' #whHomeCard .hm-gift b{font-size:24px;}}'
    ].join('');
    document.head.appendChild(s);
  }

  var _ro = null;
  var _el = null, _resident = null, _living = null, _tendBusy = false, _tendT = null;

  function mount() {
    injectStyles();
    var el = document.createElement('div');
    el.id = 'vintWorldHud';
    el.setAttribute('data-draggable', 'true');
    el.innerHTML =
      '<div class="wh-scroll">' +
        '<div class="wh-stats">' +
          '<span class="wh-chip">◇ <b id="whLumen">0</b></span>' +
          '<span class="wh-chip">✦ <b id="whEcho">0</b></span>' +
          '<span class="wh-chip">✶ <b id="whStanding">0</b></span>' +
        '</div>' +
        // THE VIGIL — populated by _renderVigil(). Until the server sends a
        // `living` picture this holds the legacy bare bar and nothing more, so a
        // legacy server never renders an empty or broken block.
        '<div class="wh-vigil" id="whVigil">' +
          '<div class="wh-meter"><div class="wh-fill" id="whSpark" style="width:100%"></div></div>' +
        '</div>' +
        '<div class="wh-acts">' +
          '<button class="wh-btn gold" id="whClaim">⌂ claim hearth</button>' +
          '<button class="wh-btn" id="whHarvest">⛏ harvest</button>' +
          '<button class="wh-btn" id="whBuild">▥ build</button>' +
          '<button class="wh-btn" id="whRefine">✦→◇ refine</button>' +
        '</div>' +
        '<div class="wh-build" id="whBuildRow">' +
          '<button class="wh-piece" data-kind="wall">wall</button>' +
          '<button class="wh-piece" data-kind="floor">floor</button>' +
          '<button class="wh-piece" data-kind="light">light</button>' +
          '<button class="wh-piece" data-kind="shelf">shelf</button>' +
        '</div>' +
        '<div class="wh-toast" id="whToast">welcome — claim a hearth to begin.</div>' +
      '</div>';
    document.body.appendChild(el);
    _el = el;
    // attach the self-healing height observer to the real panel (see the note
    // beside the resize listeners). _el is null until this line, so observing
    // it any earlier would silently watch nothing.
    try {
      if (W.ResizeObserver && !_ro) {
        _ro = new W.ResizeObserver(function () { publishBottom(); });
        _ro.observe(_el);
      }
    } catch (_) {}

    el.querySelector('#whClaim').onclick = function () { try { world().claimHere(); } catch (_) {} };
    el.querySelector('#whHarvest').onclick = function () { try { world().harvest(); } catch (_) {} };
    el.querySelector('#whRefine').onclick = function () { try { world().refine(); } catch (_) {} };
    el.querySelector('#whBuild').onclick = function () {
      el.querySelector('#whBuildRow').classList.toggle('show'); publishBottom();
    };
    el.querySelectorAll('.wh-piece').forEach(function (b) {
      b.onclick = function () { try { world().placeHere(b.getAttribute('data-kind')); } catch (_) {} };
    });
    publishBottom();
  }

  // ── PUBLISH THE PANEL'S LIVE BOTTOM EDGE ────────────────────────────────────
  // NO-COLLISION LAW, structurally. #dvRail already measures this panel itself,
  // but #hint (world.html) sat at a hand-counted top:274px derived from what the
  // panel USED to measure. The vigil makes this panel taller and content-driven,
  // so a hardcoded neighbour is a collision waiting for the first user with three
  // watchers. We publish the real bottom edge as --vint-hud-bottom and #hint
  // derives its top from it — the same measured-not-assumed discipline #status
  // and the rail already use. Also nudges the rail to re-measure.
  var _pubT = null;
  function publishBottom() {
    clearTimeout(_pubT);
    _pubT = setTimeout(function () {
      try {
        // 1) how much room the RAIL actually wants, measured from its real
        //    launcher stack. This feeds THIS panel's own max-height (see
        //    --wh-rail-need in the stylesheet), which is what stops the panel
        //    from ever growing into the rail's band in the first place. Order
        //    matters: we set the reservation BEFORE measuring our own bottom,
        //    so the bottom we publish is the post-budget one.
        var rail = document.getElementById('dvRail');
        if (rail) {
          // the rail's TRUE want: every launcher at full height, unclipped.
          var need = Math.max(rail.scrollHeight || 0, 46);
          // ...but never more than half the viewport, or a tall launcher stack
          // would starve this panel to its min-height on a short phone. Between
          // those two the rail gets exactly what it asks for, which is what stops
          // it from clipping a launcher off the top of its own scroll box. (A
          // launcher you must first discover is scrollable is a launcher that
          // isn't there — dirverse-hud's own words, and the rule the vigil must
          // not break by growing this panel.)
          var vh = W.innerHeight || 800;
          // ...but never more than 45% of the viewport. Reserving the rail's full
          // want unconditionally squeezed this panel to 172px on a 1280x800
          // desktop while the rail took 326px — a readable panel matters more
          // than a rail that never scrolls, and the rail is BUILT to scroll (it
          // is overflow-y:auto with a min-height that keeps a launcher always
          // reachable). So the rail gets what it asks for up to a fair share, and
          // scrolls beyond that. Both surfaces stay usable; neither is starved.
          var cap = Math.max(140, Math.round(vh * 0.45));
          document.documentElement.style.setProperty(
            '--wh-rail-need', Math.min(cap, Math.round(need)) + 'px');
        }
        // #hint shares this column on desktop and sits between the panel and the
        // rail, so its band is part of what the panel must not consume.
        // #hint is position:fixed, so offsetParent is ALWAYS null on it — the
        // usual `offsetParent !== null` visibility test reports every fixed
        // element as hidden. Test computed display instead, or this reserves 0
        // and the panel grows the hint straight down into the rail's band.
        try {
          var hn = document.getElementById('hint');
          var hh = (hn && getComputedStyle(hn).display !== 'none')
            ? (hn.getBoundingClientRect().height || 0) : 0;
          // +12 is the hint's own gutter below this panel (see world.html). The
          // 16px gutter BELOW the hint is layoutRail's and is already inside
          // --dv-railtop, so adding it here too would double-count it and steal
          // 16px from the panel for nothing.
          document.documentElement.style.setProperty(
            '--wh-hint-need', (hh > 0 ? Math.round(hh) + 12 : 0) + 'px');
        } catch (_) {}
      } catch (_) {}
      // ORDER MATTERS HERE TOO. The two reservations written just above
      // (--wh-rail-need, --wh-hint-need) both feed --wh-reserve, which IS this
      // panel's own max-height (see the stylesheet). Measuring our bottom in the
      // same task that wrote them returned the PRE-reservation box, so we
      // published a bottom that was up to 21px short of the real one — and #hint,
      // which derives its top from exactly this number, landed inside the panel
      // (measured 224x21 at 1280, 224x9 at 768). Flush the style write before
      // reading our own geometry, the same one-line discipline the hint flush
      // below already uses. This is the panel obeying the rule it publishes.
      try { if (_el) void _el.offsetHeight; } catch (_) {}
      try {
        var b = 274;
        if (_el) {
          var r = _el.getBoundingClientRect();
          if (r.height > 0) b = Math.round(r.bottom);
        }
        document.documentElement.style.setProperty('--vint-hud-bottom', b + 'px');
      } catch (_) {}
      // ORDER MATTERS. layoutRail() measures #hint, and #hint's own top derives
      // from the --vint-hud-bottom we just wrote. Calling relayout() in this same
      // task measured the hint at its PRE-write position (the 274px fallback),
      // so the rail's ceiling lost to a stale number and the launchers landed on
      // the keys line — a measured 108x28px overlap at 1280x800. Forcing a style
      // flush first (reading offsetHeight) makes the hint's new box real before
      // anyone measures it. Cheap, synchronous, and it removes the race rather
      // than papering over it with a longer timeout.
      try { var h = document.getElementById('hint'); if (h) void h.offsetHeight; } catch (_) {}
      try { if (W.DirverseHUD && W.DirverseHUD.relayout) W.DirverseHUD.relayout(); } catch (_) {}
    }, 40);
  }
  W.addEventListener('resize', publishBottom);
  W.addEventListener('orientationchange', publishBottom);

  // ── OBSERVE THE PANEL, DON'T ONLY LISTEN FOR THE EVENTS WE REMEMBERED ──────
  // Every publishBottom() above is a hand-placed call at a moment we PREDICTED
  // the panel changes height. The vigil broke that prediction: it grows the
  // panel from async state (watchers arriving, the homecoming's delayed reveal,
  // web-font settle), so the panel's final growth landed AFTER the last call we
  // wrote. The published bottom then stayed frozen at the pre-growth number
  // (measured: published 314 while the panel really ended at 347 — a 33px lie),
  // and #hint, which faithfully derives its top from it, was pulled 21px INSIDE
  // the panel. The bug was never a bad measurement; it was a measurement that
  // never got retaken.
  //
  // A ResizeObserver removes the guesswork permanently: the panel's own box
  // tells us when it changed, so the contract self-heals for every future organ
  // that grows this panel without knowing publishBottom exists. This is the
  // No-Collision Law made structural rather than remembered.
  // (the observer itself is attached at mount, where the panel exists — see _el)

  function _toast(t) { var n = _el && _el.querySelector('#whToast'); if (n) n.textContent = t; }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE VIGIL SURFACE
  // Renders ONLY what the server sent. Every branch below reads a field off
  // `living`; nothing here computes, extrapolates or animates a survival number.
  // ═══════════════════════════════════════════════════════════════════════════
  function _renderVigil(L) {
    var box = _el && _el.querySelector('#whVigil');
    if (!box) return;

    // LEGACY / DEGRADED PATH: no living picture (an older brain, or the very
    // first frame before world:state lands). Draw the bare bar from whatever
    // spark the resident row carried and claim nothing we cannot prove.
    if (!L || typeof L !== 'object') {
      var bare = Math.max(0, Math.min(100, num(_resident && _resident.spark, 100)));
      box.innerHTML = '<div class="wh-meter"><div class="wh-fill" id="whSpark"></div></div>';
      var bf = box.querySelector('#whSpark');
      if (bf) bf.style.width = bare + '%';
      publishBottom();
      return;
    }

    var max = num(L.max, 100) || 100;
    var spark = Math.max(0, Math.min(max, num(L.spark, max)));
    var floor = Math.max(0, Math.min(max, num(L.floor, 0)));
    var st = stateOf(L.state);
    var v = L.vigil || {};
    var watchers = Array.isArray(v.watchers) ? v.watchers : [];
    var standing = num(v.standing, watchers.length);
    var agents = num(v.agents, 0);
    var drift = num(L.driftPerDay, 0);          // positive = losing, negative = gaining
    var nextGain = num(v.nextAgentPerDay, 0);
    var reach = L.reach || {};

    var pctSpark = (spark / max) * 100;
    var pctFloor = (floor / max) * 100;

    var html = '';

    // ── head: the state word + the number against its ceiling
    html +=
      '<div class="wh-vhead">' +
        '<span class="wh-vstate">' + esc(st.word) + '</span>' +
        '<span class="wh-vnum"><b>' + Math.round(spark) + '</b> / ' + Math.round(max) + '</span>' +
      '</div>';

    // ── the meter: floor band under the fill (one composed meter, by design)
    html +=
      '<div class="wh-meter">' +
        '<div class="wh-floorband" style="width:' + pctFloor.toFixed(1) + '%"></div>' +
        '<div class="wh-fill" id="whSpark" style="width:' + pctSpark.toFixed(1) + '%"></div>' +
      '</div>';

    // ── THE FLOOR, SAID OUT LOUD. This is the promise, so it is never implied.
    html +=
      '<div class="wh-floorcap"><i></i><span>' +
        (spark <= floor + 0.5
          ? 'resting on your floor of <b>' + Math.round(floor) + '</b> — it cannot fall past this.'
          : 'your floor is <b>' + Math.round(floor) + '</b>. what you built holds it — nothing takes it.') +
      '</span></div>';

    // ── THE DRIFT. Three sentences, three colours, direction unmistakable.
    var cls, arrow, txt;
    if (drift < -0.05) {
      cls = 'gain'; arrow = '▲';
      txt = 'your court is <b>gaining ' + Math.abs(drift).toFixed(1) + '</b> light a day — ' +
            'the world brightens while you sleep.';
    } else if (drift <= 0.05) {
      cls = 'hold'; arrow = '▬';
      txt = 'holding steady — the light neither gains nor leans.';
    } else {
      cls = 'lose'; arrow = '▼';
      var till = tillFloor(L.hoursToFloor);
      txt = 'losing <b>' + drift.toFixed(1) + '</b> light a day' +
            (till ? ' — floor in <b>' + till + '</b>.' : '.');
    }
    html += '<div class="wh-drift ' + cls + '"><i class="ar">' + arrow + '</i><span class="tx">' + txt + '</span></div>';

    // ── the world's own line
    if (L.line) html += '<div class="wh-line">' + esc(L.line) + '</div>';

    // ── THE CONSEQUENCE TIER — what the dimness actually COSTS ────────────────
    // Rendered only when the tier is taking something (tier.loss is null at
    // radiant), so a healthy world carries no scold. The band always states the
    // loss AND the way out of it in the same breath: showing a player what they
    // lost without showing them how to get it back is the predatory version of
    // this feature, and the Retention Doctrine's first test forbids it.
    var tierInfo = L.tier || null;
    if (tierInfo && tierInfo.loss) {
      var deep = (tierInfo.state === 'guttering' || tierInfo.state === 'ember');
      var back = tierInfo.next;
      html +=
        '<div class="wh-tier' + (deep ? ' deep' : '') + '">' +
          '<div class="th">' +
            '<span class="tw">the clearing gives less</span>' +
            '<span class="ty">' + num(tierInfo.yieldPct, 100) + '%</span>' +
          '</div>' +
          '<span class="tl">' + esc(tierInfo.loss) + '</span>' +
          // the way back, always concrete: the next tier and what it restores.
          (back
            ? '<span class="tb">' +
                (back.at != null
                  ? 'reach <b>' + num(back.at, 0) + '</b> spark and it lifts to <b>' +
                    esc(back.state) + '</b> — ' + num(back.yieldPct, 100) + '% again.'
                  : 'lift off your floor and it warms to <b>' + esc(back.state) + '</b>.') +
              '</span>'
            : '') +
        '</div>';
    }

    // ── THE SLUMBER — the world slept because nobody walked in ────────────────
    // Its own note, and deliberately NOT styled as a warning: the player did
    // nothing wrong by having a life. The wake-promise is the payload's own
    // (`wakesOnArrival`), so the client never invents a reassurance it cannot keep.
    var sl = L.slumber || null;
    if (sl) {
      html +=
        '<div class="wh-slumber">' +
          esc(sl.line || 'your clearing has been sleeping.') +
          (sl.wakesOnArrival
            ? '<span class="wk">you are here now — it is already waking.</span>'
            : '') +
        '</div>';
    }

    // ── WHO STANDS WATCH
    html += '<div class="wh-watch">';
    if (watchers.length) {
      html += '<div class="wh-wlabel">' + standing + ' standing watch</div><div class="wh-worbs">';
      // ── THE ORB BUDGET, SPLIT SO THE CONSEQUENCE SURVIVES IT ────────────────
      // The row holds 8 orbs. Giving the AWAKE watches all 8 first is what a
      // naive slice does, and it silently deletes the entire point of the slot
      // cap: a court of 12 with 3 awake and 9 resting rendered 8 bright orbs and
      // ZERO dim ones, so the tier's loss — the thing the player is supposed to
      // feel — became invisible exactly when it was largest.
      //
      // So the resting watches are RESERVED up to a third of the row (min 2 when
      // any exist). The awake ones take the rest. Both truths always make it into
      // the picture, and the overflow "+n" still accounts for everyone.
      var restersAll = Array.isArray(v.resters) ? v.resters : [];
      var ORB_MAX = 8;
      var restBudget = restersAll.length
        ? Math.min(restersAll.length, Math.max(2, Math.floor(ORB_MAX / 3)))
        : 0;
      var shown = watchers.slice(0, Math.max(1, ORB_MAX - restBudget));
      for (var i = 0; i < shown.length; i++) {
        var wch = shown[i] || {};
        var wt = Math.max(0, Math.min(1, num(wch.watch, 1)));
        var col = /^#[0-9a-fA-F]{3,8}$/.test(String(wch.color || '')) ? wch.color : '#ffd479';
        html +=
          '<span class="wh-orb' + (wt < 0.75 ? ' fading' : '') + '"' +
            ' style="background:' + esc(col) + ';opacity:' + (0.35 + 0.65 * wt).toFixed(2) + '"' +
            ' title="' + esc(wch.name || 'a watcher') + ' — watch ' + Math.round(wt * 100) + '%"></span>';
      }
      // ── RESTING WATCHES — the slot cap, made visible without making it a loss
      //    of PROPERTY. A capped agent is drawn dimmed and greyed right beside
      //    the awake ones, never removed: an agent that vanished from this row
      //    would read as "I lost an agent", which is exactly the false alarm the
      //    "nothing is ever destroyed" invariant exists to prevent.
      var resters = restersAll;
      var restShown = resters.slice(0, Math.max(0, ORB_MAX - shown.length));
      for (var j = 0; j < restShown.length; j++) {
        var rc = restShown[j] || {};
        var rcol = /^#[0-9a-fA-F]{3,8}$/.test(String(rc.color || '')) ? rc.color : '#ffd479';
        html +=
          '<span class="wh-orb resting" style="background:' + esc(rcol) + '"' +
            ' title="' + esc(rc.name || 'a watcher') + ' — resting; the clearing has no slot for them until it warms"></span>';
      }
      var hidden = (watchers.length - shown.length) + (resters.length - restShown.length);
      if (hidden > 0) html += '<span class="wh-wmore">+' + hidden + '</span>';
      html += '</div>';
      // say WHY they are resting, and that it is temporary — the sentence that
      // turns a confusing dim orb into an understood, recoverable consequence.
      if (num(v.resting, 0) > 0) {
        html += '<div class="wh-rlabel">' +
          '<b>' + num(v.resting, 0) + '</b> resting — this clearing holds <b>' +
          num(v.slots, 0) + '</b> watches while it is <b>' + esc(stateOf(L.state).word) +
          '</b>. they return as it warms; none are lost.' +
        '</div>';
      }
    } else {
      html += '<div class="wh-wnone">' +
        (agents
          ? 'your court has gone quiet — no one is holding the light.'
          : 'no one stands watch here yet.') +
        '</div>';
    }
    html += '</div>';

    // ── THE CONCRETE ASK. Only shown when one more agent would actually change
    //    something (nextAgentPerDay > 0) AND the light is not already gaining
    //    more than it needs. Never a vague "add agents" — always the number.
    if (nextGain > 0.05 && (drift > -0.05 || !standing)) {
      html +=
        '<button class="wh-ask" id="whAsk">' +
          'one more tended agent holds <b>+' + nextGain.toFixed(1) + '</b> light a day' +
          (drift > 0.05 && nextGain >= drift ? ' — enough to stop the lean.' : '.') +
          '<br>bring one into your court →' +
        '</button>';
    }

    // ── THE REACH, shown honestly, so a shrinking radius is understood.
    if (reach.buildRadius != null || reach.maxStake != null) {
      html += '<div class="wh-reach">';
      if (reach.buildRadius != null) {
        html += '<span title="how far from your hearth you may build right now">' +
                'reach <b>' + num(reach.buildRadius, 0) + '</b></span>';
      }
      if (reach.maxStake != null) {
        html += '<span title="the largest stake a venture may carry right now">' +
                'stake <b>' + num(reach.maxStake, 0) + '</b></span>';
      }
      html += '</div>';
    }

    box.innerHTML = html;

    var ask = box.querySelector('#whAsk');
    if (ask) ask.onclick = function () { openCourt(); };

    publishBottom();
  }

  // route to the Court — the honest conversion path for the ask.
  function openCourt() {
    try { if (W.VintCourt && W.VintCourt.open) { W.VintCourt.open('add'); return; } } catch (_) {}
    try { var b = document.getElementById('ctBtn'); if (b) { b.click(); return; } } catch (_) {}
    _toast('open your court to bring an agent in.');
  }

  // ── THE TEND BUTTON — the headline survival act, wired to World.tend() ───────
  // Added to the action row only when tending can mean something (a court
  // exists). Disabled while a tend is in flight so a double-tap cannot spam the
  // socket; the reply (or a 6s timeout) releases it. Nothing optimistic is drawn.
  function _syncTendBtn() {
    if (!_el) return;
    var acts = _el.querySelector('.wh-acts');
    if (!acts) return;
    var v = (_living && _living.vigil) || null;
    var agents = v ? num(v.agents, 0) : 0;
    var btn = _el.querySelector('#whTend');

    if (!v || !agents) {                      // no court (or no vigil) — no tend
      if (btn) { btn.parentNode.removeChild(btn); publishBottom(); }
      return;
    }
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'wh-btn tend';
      btn.id = 'whTend';
      btn.onclick = function () {
        if (_tendBusy) return;
        var w = world();
        if (!w || !w.tend) { _toast('the world is still waking — try again in a moment.'); return; }
        _tendBusy = true; _syncTendBtn();
        // World.tend returns FALSE when the socket is down and send() dropped
        // the message. Unchecked, the button sat on "tending…" for the full 6s
        // timeout and reverted silently — the act failed and the user was never
        // told. Never a dead control: say it out loud, immediately.
        var sent = false;
        try { sent = w.tend(); } catch (_) { _tendBusy = false; _syncTendBtn(); return; }
        if (sent === false) {
          _tendBusy = false; _syncTendBtn();
          _toast('the clearing is out of reach — reload and try again.');
          return;
        }
        // release on the reply; this only fires if the reply never lands, so the
        // button can never be left permanently dead by a dropped socket.
        clearTimeout(_tendT);
        _tendT = setTimeout(function () { _tendBusy = false; _syncTendBtn(); }, 6000);
      };
      acts.insertBefore(btn, acts.firstChild);
    }
    btn.disabled = !!_tendBusy;
    btn.textContent = _tendBusy ? '✦ tending…' : '✦ tend your court';
    // pulse the invitation only when the world is actually losing light — an
    // ambient animation on a world that's already thriving is decoration, and
    // decoration that nags is the predatory kind. It earns its motion.
    var losing = _living && num(_living.driftPerDay, 0) > 0.05;
    btn.classList.toggle('pulse', !!losing && !_tendBusy);
    publishBottom();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE HOMECOMING — the re-entry gift, given a real moment
  // vigil.js pays this ONCE per arrival, scaled to how long you were away. It is
  // the proof that absence is never punished here, so it does not flicker past
  // in a toast: it takes the screen, says exactly what it gave and why, states
  // the floor promise in plain words, and waits for the player to walk back in.
  // ═══════════════════════════════════════════════════════════════════════════
  var _homeEl = null, _homeShown = false;

  function _absenceWords(gift) {
    // vigil.js: HOMECOMING_PER_DAY 3.5, cap 40. We invert only to CHOOSE WORDS —
    // never to display a derived number. The gift itself is the server's.
    var days = gift / 3.5;
    if (gift >= 39.9) return 'a long while';
    if (days < 1) return 'most of a day';
    if (days < 2) return 'a day';
    if (days < 7) return Math.round(days) + ' days';
    if (days < 14) return 'a week';
    return Math.round(days / 7) + ' weeks';
  }

  function showHomecoming(L) {
    if (_homeShown || !L) return;
    var gift = num(L.homecoming, 0);
    if (!(gift > 0)) return;
    _homeShown = true;

    if (!_homeEl) {
      _homeEl = document.createElement('div');
      _homeEl.id = 'whHomeWrap';
      _homeEl.setAttribute('role', 'dialog');
      _homeEl.setAttribute('aria-modal', 'true');
      _homeEl.setAttribute('aria-label', 'welcome back');
      _homeEl.innerHTML =
        '<div id="whHomeCard">' +
          '<div class="hm-body">' +
            '<div class="hm-glyph">✦</div>' +
            '<div class="hm-kicker" id="whHomeKick">the clearing kept your light</div>' +
            '<div class="hm-h" id="whHomeH">welcome home.</div>' +
            '<div class="hm-gift"><b id="whHomeN">+0</b><span id="whHomeSub">spark, for coming back</span></div>' +
            '<div class="hm-p" id="whHomeP"></div>' +
            '<div class="hm-safe" id="whHomeSafe"></div>' +
          '</div>' +
          '<div class="hm-foot"><button class="hm-go" id="whHomeGo">step back in</button></div>' +
        '</div>';
      document.body.appendChild(_homeEl);
      _homeEl.querySelector('#whHomeGo').onclick = hideHomecoming;
      // scrim tap dismisses; a tap INSIDE the card must not (the card is a child,
      // so we only close when the wrap itself was the target).
      _homeEl.addEventListener('click', function (e) { if (e.target === _homeEl) hideHomecoming(); });
    }

    var away = _absenceWords(gift);
    var v = L.vigil || {};
    var standing = num(v.standing, 0);
    var drift = num(L.driftPerDay, 0);
    var floor = Math.round(num(L.floor, 0));

    _homeEl.querySelector('#whHomeKick').textContent =
      standing ? 'your court kept the light' : 'the clearing kept your light';
    _homeEl.querySelector('#whHomeH').textContent = 'welcome home.';
    // show the gift EXACTLY as the server paid it. Rounding 24.5 to "+25"
    // overstates by half a point — small, but this is the number that proves the
    // promise, and a promise you round in your own favour is not a promise.
    _homeEl.querySelector('#whHomeN').textContent =
      '+' + (Math.round(gift * 10) / 10);
    _homeEl.querySelector('#whHomeSub').textContent =
      'spark, for coming back after ' + away;

    _homeEl.querySelector('#whHomeP').textContent = standing
      ? (standing === 1
          ? 'One of your court stood watch the whole time you were gone.'
          : standing + ' of your court stood watch the whole time you were gone.') +
        (drift <= 0.05 ? ' They held the light — nothing dimmed.' : ' They slowed the dimming.')
      : 'No one was here holding the light, so the clearing dimmed — but it waited, ' +
        'and it kept everything you made.';

    _homeEl.querySelector('#whHomeSafe').innerHTML =
      '<b>Nothing was taken.</b> Not a structure, not a claim, not a lumen. ' +
      'Your light can never fall below <b>' + floor + '</b> — and that floor rises with ' +
      'everything you build here. The longer you are away, the warmer the welcome back.';

    // paint on the next frame so the CSS transition actually runs
    try { requestAnimationFrame(function () { _homeEl.classList.add('show'); }); }
    catch (_) { _homeEl.classList.add('show'); }
    document.addEventListener('keydown', _homeKey);
  }

  function _homeKey(e) { if (e.key === 'Escape') hideHomecoming(); }

  function hideHomecoming() {
    if (!_homeEl) return;
    _homeEl.classList.remove('show');
    document.removeEventListener('keydown', _homeKey);
    // the wrap is display:none once faded, so it holds no pixels and eats no taps
    setTimeout(function () { try { if (_homeEl) _homeEl.style.display = ''; } catch (_) {} }, 520);
  }

  // ── the whole panel ─────────────────────────────────────────────────────────
  // `living` semantics, deliberately three-valued:
  //   undefined → not part of this update (a tend reply re-rendering currencies)
  //   an object → the server's new picture; replace
  //   null      → the server sent a state frame WITHOUT a living picture, i.e.
  //               it no longer speaks the vigil. Keeping the last picture would
  //               leave a stale floor, drift and watcher list on screen — numbers
  //               nobody vouched for, which is exactly what "the client never
  //               computes survival" exists to prevent. So we drop it and fall
  //               back to the bare bar.
  function _render(r, living) {
    if (!_el) return;
    if (r) _resident = r;
    if (living !== undefined) _living = living || null;

    if (_resident) {
      _el.querySelector('#whLumen').textContent = _resident.lumen != null ? _resident.lumen : 0;
      _el.querySelector('#whEcho').textContent = _resident.echo != null ? _resident.echo : 0;
      _el.querySelector('#whStanding').textContent = _resident.standing != null ? _resident.standing : 0;
      var claimBtn = _el.querySelector('#whClaim');
      if (_resident.claim && claimBtn) {
        claimBtn.disabled = true; claimBtn.style.opacity = '0.45';
        claimBtn.textContent = '⌂ hearth claimed';
      }
    }
    _renderVigil(_living);
    _syncTendBtn();
  }

  // ── wire to world events ─────────────────────────────────────────────────────
  W.addEventListener('vint:world-state', function (e) {
    var d = e.detail || {};
    // a world:state ALWAYS carries the authoritative living picture, or the
    // absence of one — pass null (never undefined) so a server that stopped
    // speaking the vigil clears the last picture instead of stranding it.
    _render(d.resident, d.living || null);
    // THE HOMECOMING lands on the arrival state frame (the server pays it once,
    // on world:hello). Give it a beat so it arrives into a painted world rather
    // than on top of the loader.
    if (d.living && num(d.living.homecoming, 0) > 0) {
      setTimeout(function () { showHomecoming(d.living); }, 900);
    }
  });
  W.addEventListener('vint:world-tend', function (e) {
    var d = e.detail || {};
    clearTimeout(_tendT); _tendBusy = false;
    // a tend reply without a picture means "currencies unchanged, keep what you
    // have" — NOT "the vigil is gone", so pass undefined rather than null here.
    _render(null, d.living || undefined);
    var n = num(d.tended, 0), g = num(d.gained, 0);
    if (!n) _toast('no one in your court to tend — bring an agent in.');
    else if (g > 0) {
      _toast('you tended ' + n + (n === 1 ? ' agent' : ' agents') + ' — the clearing brightens (+' + g + ').');
    } else {
      _toast('your court was already fresh — their watch holds.');
    }
  });
  // ── THE CONSEQUENCE TIER, felt at the moment of the swing ──────────────────
  // When the tier took a cut the server ships `full` (what a radiant clearing
  // would have paid) beside the actual gain. Saying "2 of 3 — the clearing is
  // dim" is the whole difference between a player reading STAKES and a player
  // reading a BUG: an unexplained smaller number is indistinguishable from
  // broken, and a survival mechanic nobody can attribute teaches nothing.
  function _cut(d) {
    return (d && d.full != null && d.yieldPct != null)
      ? '  ·  of ' + d.full + ' — the clearing is ' + (d.state || 'dim') + ' (' + d.yieldPct + '%)'
      : '';
  }
  // THE WARMTH ECHO — world-client fires this whenever the SERVER moved spark
  // (world:state or world:tend:ok), carrying the same `living` picture it just
  // handed the 3D light. The panel listens so the readout and the sky can never
  // disagree: if a surface calls World.setSpark directly — the Court's REST tend
  // fallback does exactly that when the socket is down — this is what keeps the
  // vigil in step. Still nothing derived: we re-render the server's own object.
  W.addEventListener('vint:world-warmth', function (e) {
    var lv = e.detail && e.detail.living;
    if (!lv || lv === _living) return;   // already the picture we are showing
    _render(null, lv);
    // HOMECOMING — if the world paid a re-entry gift it gets its full moment.
    // showHomecoming self-guards to once per load, so the state frame and this
    // echo can never both open it.
    if (num(lv.homecoming, 0) > 0) showHomecoming(lv);
  });
  W.addEventListener('vint:world-harvest', function (e) {
    var d = e.detail || {};
    _toast((d.artifact ? ('found: ' + d.artifact + '  (+' + d.echo + ' echo)') : ('+' + (d.echo || 0) + ' echo')) + _cut(d));
  });
  W.addEventListener('vint:world-refine', function (e) {
    var d = e.detail || {}; _toast('refined ' + d.spent + ' echo → ' + d.gained + ' lumen' + _cut(d));
  });
  W.addEventListener('vint:world-err', function (e) {
    var det = e.detail || {};
    var c = det.code || 'error';
    var msg = {
      no_seed_stone: 'you need a seed stone to claim.', already_claimed: 'you already have a hearth.',
      too_close: 'too close to another hearth — move further out.', not_your_plot: 'build inside your own hearth plot.',
      cooldown: 'the node is still recharging…', no_echo: 'no echo to refine yet — harvest first.',
    }[c];
    // THE REACH ERROR — dimming, never denial. The server rejects a placement
    // beyond the current radius and sends the radius + spark with it, so the
    // message can say exactly why and exactly how to widen it again. This is
    // never "you can't build" — it's "the world has drawn in close."
    if (!msg && c === 'reach') {
      var rad = num(det.radius, 0);
      msg = 'the clearing has drawn in close — you can build within ' + rad +
            ' of your hearth right now. tend your court to widen it.';
    }
    _toast(msg || ('— ' + c));
  });

  // THE VISITOR GATE — the world you asked for is resting, so you were brought
  // to the hub instead. The server's own sentence is used verbatim (it is the
  // one place that knows WHY), and it is framed as that clearing's condition,
  // never as a rejection of the person who knocked.
  W.addEventListener('vint:world-gated', function (e) {
    var g = e.detail || {};
    _toast(g.message || 'that clearing is resting — try again when it warms.');
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  W.WorldHUD = {
    render: _render,
    // renderVigil stays on the public API: another surface hands the server's
    // freshly-computed `living` straight in (the Court's REST tend fallback does
    // this when there is no socket to carry a world:tend:ok back).
    renderVigil: function (L) {
      if (L) _living = L;
      _renderVigil(_living);
      _syncTendBtn();
    },
    living: function () { return _living; },
    // exposed so another surface (or a test) can replay the moment deliberately
    showHomecoming: showHomecoming,
    hideHomecoming: hideHomecoming
  };
})();
