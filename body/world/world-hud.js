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
      ' min-height:132px;',
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

      // ══ THE ASCENT BLOCK ═════════════════════════════════════════════════════
      // NO-COLLISION LAW: this adds ZERO new fixed elements. It renders INSIDE
      // .wh-scroll, the panel's existing internal scroller, so the panel's own
      // height budget absorbs it exactly the way it absorbs the vigil — the
      // container yields and scrolls, it never grows onto #dvRail or #hint. Every
      // row below is a flex row with min-width:0 on its flexible cell and its own
      // clipping, so no string of any length can push a sibling out of its box.
      '#vintWorldHud .wh-asc{padding:8px 12px 2px;}',
      // the rung: the tier name, and where it sits on the whole ladder.
      '#vintWorldHud .wh-rung{display:flex;align-items:baseline;justify-content:space-between;',
      ' gap:8px;margin-bottom:5px;}',
      '#vintWorldHud .wh-rungname{flex:1 1 auto;min-width:0;font-size:12px;letter-spacing:.09em;',
      ' text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
      ' color:#ffd479;text-shadow:0 0 12px rgba(255,212,121,0.35);}',
      '#vintWorldHud .wh-rungn{flex:0 0 auto;font-size:10.5px;font-variant-numeric:tabular-nums;',
      ' color:rgba(218,228,255,0.45);}',
      // THE LADDER — six pips, one per rung. Reached rungs are lit, the one you
      // stand on is ringed. Each pip is its own cell in a flex row with a gap, so
      // they can never touch each other at any width.
      '#vintWorldHud .wh-pips{display:flex;gap:4px;margin-bottom:6px;}',
      '#vintWorldHud .wh-pip{flex:1 1 0;min-width:0;height:4px;border-radius:2px;',
      ' background:rgba(255,255,255,0.09);transition:background .4s ease;}',
      '#vintWorldHud .wh-pip.on{background:rgba(255,212,121,0.62);}',
      '#vintWorldHud .wh-pip.at{background:#ffd479;box-shadow:0 0 8px rgba(255,212,121,0.55);}',
      // THE OBJECTIVE — the named next thing. This is the acceptance criterion on
      // screen, so it is the loudest thing in the block and it is NEVER absent.
      '#vintWorldHud .wh-obj{border-radius:11px;padding:8px 10px;',
      ' background:rgba(255,212,121,0.07);border:1px solid rgba(255,212,121,0.22);}',
      '#vintWorldHud .wh-objlab{font-size:9.5px;letter-spacing:.11em;text-transform:uppercase;',
      ' color:rgba(255,212,121,0.55);margin-bottom:3px;}',
      '#vintWorldHud .wh-objname{font-size:13px;line-height:1.3;color:#fff3dd;margin-bottom:3px;',
      ' overflow-wrap:anywhere;}',
      '#vintWorldHud .wh-objsay{font-size:11px;line-height:1.4;color:rgba(245,235,220,0.72);',
      ' overflow-wrap:anywhere;}',
      // the distance bar + its number, each in its own row — never stacked on
      // each other, never a number floating on a bar.
      '#vintWorldHud .wh-objbar{position:relative;height:5px;border-radius:3px;margin-top:7px;',
      ' background:rgba(255,255,255,0.08);overflow:hidden;}',
      '#vintWorldHud .wh-objfill{position:absolute;left:0;top:0;bottom:0;border-radius:3px;',
      ' background:linear-gradient(90deg,#ffd479,#ffb066);transition:width .5s ease;}',
      '#vintWorldHud .wh-objfar{display:flex;align-items:baseline;justify-content:space-between;',
      ' gap:8px;margin-top:4px;font-size:10px;color:rgba(245,235,220,0.5);}',
      '#vintWorldHud .wh-objfar b{color:#ffd479;font-variant-numeric:tabular-nums;}',
      '#vintWorldHud .wh-objfar .l{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;',
      ' text-overflow:ellipsis;}',
      '#vintWorldHud .wh-objfar .r{flex:0 0 auto;}',
      // what the next rung opens — the want, said plainly.
      '#vintWorldHud .wh-opens{margin-top:6px;font-size:10.5px;line-height:1.4;',
      ' color:rgba(159,220,255,0.62);overflow-wrap:anywhere;}',
      '#vintWorldHud .wh-opens b{color:#9fdcff;}',

      // ── THE LONG WORK — the open loop, given its own quiet box ───────────────
      // Deliberately understated: it is not a quest tracker, it is a stone in the
      // clearing that says a little more each time you climb. It is a BUTTON
      // because it opens the full inscription, and it meets the 44px law.
      '#vintWorldHud .wh-lw{display:block;width:100%;min-height:44px;margin-top:8px;',
      ' text-align:left;font-family:inherit;cursor:pointer;border-radius:11px;padding:7px 10px;',
      ' background:rgba(154,134,216,0.08);border:1px solid rgba(154,134,216,0.26);color:#cbbde8;}',
      '#vintWorldHud .wh-lw:active{transform:scale(0.98);}',
      '#vintWorldHud .wh-lwlab{font-size:9.5px;letter-spacing:.11em;text-transform:uppercase;',
      ' color:rgba(190,170,235,0.6);margin-bottom:3px;}',
      '#vintWorldHud .wh-lwask{font-size:11px;line-height:1.4;font-style:italic;',
      ' color:rgba(203,189,232,0.86);overflow-wrap:anywhere;}',

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
      ' #whHomeCard .hm-gift b{font-size:24px;}}',

      // ══ THE LONG WORK — the stone, read in full ══════════════════════════════
      // The SECOND deliberate overlay in this file, and the same sanctioned kind
      // as the homecoming: a true modal over its OWN dedicated scrim, centred
      // with flex (never transforms against hand-counted offsets), dismissible
      // three ways. It reuses the homecoming's exact z-order neighbourhood —
      // scrim 1610 / card 1620 — and only ONE of the two can ever be open,
      // because openLongWork() closes the homecoming first and vice versa. Two
      // modals sharing a z-index while both visible would be a collision; they
      // are mutually exclusive by construction, which is why they may share it.
      '#whLwWrap{position:fixed;inset:0;z-index:1610;display:none;',
      ' align-items:center;justify-content:center;',
      ' padding:max(16px,env(safe-area-inset-top,16px)) max(16px,env(safe-area-inset-right,16px))',
      ' max(16px,env(safe-area-inset-bottom,16px)) max(16px,env(safe-area-inset-left,16px));',
      ' background:rgba(3,4,9,0.78);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);',
      ' opacity:0;transition:opacity .5s ease;}',
      '#whLwWrap.show{display:flex;opacity:1;}',
      '#whLwCard{position:relative;z-index:1620;width:100%;max-width:min(380px,calc(100vw - 32px));',
      ' max-height:calc(100dvh - 32px);max-height:calc(100vh - 32px);',
      ' display:flex;flex-direction:column;overflow:hidden;',
      ' background:rgba(10,9,18,0.97);border:1px solid rgba(154,134,216,0.34);border-radius:22px;',
      ' box-shadow:0 24px 80px rgba(0,0,0,0.75),0 0 60px rgba(154,134,216,0.1);',
      ' font-family:"Cormorant Garamond",Georgia,serif;color:#e9e3f6;',
      ' transform:translateY(14px) scale(0.97);transition:transform .5s cubic-bezier(.22,1,.36,1);}',
      '#whLwWrap.show #whLwCard{transform:translateY(0) scale(1);}',
      '#whLwCard .lw-body{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;',
      ' overscroll-behavior:contain;padding:24px 22px 8px;}',
      '#whLwCard .lw-glyph{text-align:center;font-size:34px;line-height:1;color:#b9a6e8;',
      ' text-shadow:0 0 30px rgba(154,134,216,0.55);}',
      '#whLwCard .lw-kicker{margin-top:12px;text-align:center;font-size:11px;letter-spacing:.19em;',
      ' text-transform:uppercase;color:rgba(190,170,235,0.6);}',
      '#whLwCard .lw-h{margin-top:6px;text-align:center;font-size:24px;line-height:1.24;color:#f3eeff;}',
      // each stanza is its own block with its own margin — they never touch.
      '#whLwCard .lw-lines{margin-top:16px;display:flex;flex-direction:column;gap:12px;}',
      '#whLwCard .lw-line{padding:11px 13px;border-radius:12px;font-size:15px;line-height:1.5;',
      ' background:rgba(154,134,216,0.07);border-left:2px solid rgba(154,134,216,0.4);',
      ' color:rgba(233,227,246,0.9);overflow-wrap:anywhere;}',
      // the unreadable first stanza reads as unreadable, not as missing.
      '#whLwCard .lw-line.unread{font-style:italic;color:rgba(233,227,246,0.5);',
      ' border-left-color:rgba(154,134,216,0.18);background:rgba(255,255,255,0.03);}',
      // the rungs still sealed — shown as sealed, never as empty space.
      '#whLwCard .lw-sealed{margin-top:12px;padding:11px 13px;border-radius:12px;',
      ' background:rgba(255,255,255,0.03);border:1px dashed rgba(154,134,216,0.24);',
      ' font-size:13px;line-height:1.5;color:rgba(203,189,232,0.55);font-style:italic;}',
      '#whLwCard .lw-ask{margin-top:16px;padding:12px 14px;border-radius:13px;',
      ' background:rgba(154,134,216,0.1);border:1px solid rgba(154,134,216,0.3);',
      ' font-size:14.5px;line-height:1.55;color:rgba(226,216,250,0.94);overflow-wrap:anywhere;}',
      '#whLwCard .lw-foot{flex:0 0 auto;padding:12px 22px max(18px,env(safe-area-inset-bottom,18px));}',
      '#whLwCard .lw-go{width:100%;min-height:48px;border-radius:14px;font-family:inherit;',
      ' font-size:15px;letter-spacing:.04em;cursor:pointer;color:#efe9ff;font-weight:600;',
      ' background:rgba(154,134,216,0.2);border:1px solid rgba(154,134,216,0.45);}',
      '#whLwCard .lw-go:active{transform:scale(0.985);}',
      '@media(max-height:520px){#whLwCard .lw-body{padding:16px 18px 6px;}',
      ' #whLwCard .lw-glyph{font-size:24px;}#whLwCard .lw-h{font-size:19px;}',
      ' #whLwCard .lw-line{font-size:13.5px;padding:9px 11px;}}',

      // ── THE ASCENSION — a rung crossed, given exactly one quiet moment ───────
      // NOT a modal: a rung is a warm confirmation, not an interruption, and a
      // full-screen takeover for "you reached wallwright" would be the predatory
      // kind of celebration. It renders INSIDE the panel's ascent block (so it
      // owns no new fixed space at all) and fades on its own.
      '#vintWorldHud .wh-rose{margin-top:8px;padding:9px 11px;border-radius:11px;',
      ' background:linear-gradient(90deg,rgba(255,212,121,0.18),rgba(255,176,102,0.1));',
      ' border:1px solid rgba(255,212,121,0.42);font-size:11.5px;line-height:1.45;',
      ' color:#fff3dd;animation:whRose .7s cubic-bezier(.22,1,.36,1);overflow-wrap:anywhere;}',
      '#vintWorldHud .wh-rose b{color:#ffd479;}',
      '@keyframes whRose{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:none;}}',
      '@media (prefers-reduced-motion: reduce){#vintWorldHud .wh-rose{animation:none;}}'
    ].join('');
    document.head.appendChild(s);
  }

  var _el = null, _resident = null, _living = null, _tendBusy = false, _tendT = null;
  // THE ASCENT — the server's ladder picture. Same three-valued discipline as
  // `living`: undefined = not part of this update, object = replace, null = the
  // server no longer speaks the ascent, so drop it rather than strand a stale
  // rung on screen. The client computes NO progression, ever.
  var _climb = null;
  // the rung we last DREW, so a promotion is announced exactly once per crossing
  // rather than on every state frame that happens to arrive at the new tier.
  var _drawnTier = null, _roseT = null;

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
        // THE ASCENT — populated by _renderAscent(). Empty until the server sends
        // a `climb` picture, so a legacy brain renders nothing here rather than a
        // broken or fabricated ladder. Sits ABOVE the vigil deliberately: the
        // first thing a player should see is what they are reaching FOR; the
        // vigil below it is what they are holding.
        '<div class="wh-asc" id="whAsc"></div>' +
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

    el.querySelector('#whClaim').onclick = function () { try { world().claimHere(); } catch (_) {} };
    el.querySelector('#whHarvest').onclick = function () { try { world().harvest(); } catch (_) {} };
    el.querySelector('#whRefine').onclick = function () { try { world().refine(); } catch (_) {} };
    el.querySelector('#whBuild').onclick = function () {
      el.querySelector('#whBuildRow').classList.toggle('show'); publishBottom();
    };
    el.querySelectorAll('.wh-piece').forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-kind');
        // mirror the ladder: a locked piece says so instead of firing into a
        // refusal. The server still decides; this is only the instant echo.
        var kinds = (_climb && _climb.tier && Array.isArray(_climb.tier.kinds))
          ? _climb.tier.kinds : null;
        if (kinds && kinds.indexOf(k) === -1) {
          _toast('the ' + k + ' is not yours to place yet — keep building.');
          return;
        }
        var sent = false;
        try { sent = world().placeHere(k); } catch (_) { sent = false; }
        if (sent === false) _toast('the clearing is out of reach — reload and try again.');
      };
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

    // ── WHO STANDS WATCH
    html += '<div class="wh-watch">';
    if (watchers.length) {
      html += '<div class="wh-wlabel">' + standing + ' standing watch</div><div class="wh-worbs">';
      var shown = watchers.slice(0, 8);
      for (var i = 0; i < shown.length; i++) {
        var wch = shown[i] || {};
        var wt = Math.max(0, Math.min(1, num(wch.watch, 1)));
        var col = /^#[0-9a-fA-F]{3,8}$/.test(String(wch.color || '')) ? wch.color : '#ffd479';
        html +=
          '<span class="wh-orb' + (wt < 0.75 ? ' fading' : '') + '"' +
            ' style="background:' + esc(col) + ';opacity:' + (0.35 + 0.65 * wt).toFixed(2) + '"' +
            ' title="' + esc(wch.name || 'a watcher') + ' — watch ' + Math.round(wt * 100) + '%"></span>';
      }
      if (watchers.length > shown.length) {
        html += '<span class="wh-wmore">+' + (watchers.length - shown.length) + '</span>';
      }
      html += '</div>';
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

  // ═══════════════════════════════════════════════════════════════════════════
  // THE ASCENT SURFACE — the ladder, the named objective, and the open loop
  //
  // Renders ONLY what the server sent. Every number below is read off `climb`;
  // nothing here derives a tier, a threshold, an unlock or a distance. If the
  // brain does not speak the ascent (or the flag is off) the block renders
  // EMPTY — never a fabricated ladder, never a half-drawn one.
  //
  // NO-COLLISION: this writes into #whAsc, a flow child of the panel's existing
  // internal scroller. It adds no fixed element and claims no new space; if the
  // content grows, the panel's height budget makes it scroll rather than spill.
  // ═══════════════════════════════════════════════════════════════════════════
  function _renderAscent(C) {
    var box = _el && _el.querySelector('#whAsc');
    if (!box) return;

    // DEGRADED PATH: no ladder picture, or the flag killed it server-side. Draw
    // nothing at all — an empty box holds no pixels and collides with nothing.
    if (!C || typeof C !== 'object' || C.on === false || !C.tier) {
      if (box.innerHTML) { box.innerHTML = ''; publishBottom(); }
      return;
    }

    var t = C.tier || {};
    var o = C.objective || null;
    var lw = C.longWork || null;
    var ladder = Array.isArray(C.ladder) ? C.ladder : [];
    var standing = num(C.standing, 0);

    var html = '';

    // ── the rung you stand on, and where that is on the whole ladder
    html +=
      '<div class="wh-rung">' +
        '<span class="wh-rungname">' + esc(t.title || '—') + '</span>' +
        '<span class="wh-rungn">✶ ' + Math.round(standing) + '</span>' +
      '</div>';

    // ── THE LADDER, as pips. Each pip is its own flex cell with a gap; they can
    //    never touch, at any width, at any count.
    if (ladder.length) {
      html += '<div class="wh-pips">';
      for (var i = 0; i < ladder.length; i++) {
        var r = ladder[i] || {};
        html += '<i class="wh-pip' + (r.reached ? ' on' : '') + (r.at ? ' at' : '') +
                '" title="' + esc(r.title || '') + (r.need ? ' — ' + r.need + ' standing' : '') + '"></i>';
      }
      html += '</div>';
    }

    // ── THE OBJECTIVE. THE ACCEPTANCE CRITERION, ON SCREEN. The server
    //    guarantees this is never null while the ladder is on, but the client
    //    still guards: a missing objective renders the block WITHOUT it rather
    //    than printing "undefined" at anybody.
    if (o) {
      var pct = Math.max(0, Math.min(1, num(o.pct, 0)));
      html +=
        '<div class="wh-obj">' +
          '<div class="wh-objlab">' + (o.terminal ? 'the work that has no end' : 'next') + '</div>' +
          '<div class="wh-objname">' + esc(o.name || '') + '</div>' +
          '<div class="wh-objsay">' + esc(o.say || '') + '</div>' +
          '<div class="wh-objbar"><div class="wh-objfill" style="width:' +
            (pct * 100).toFixed(1) + '%"></div></div>' +
          '<div class="wh-objfar">' +
            '<span class="l">' + esc(o.far || '') + '</span>' +
            '<span class="r"><b>' + Math.round(pct * 100) + '%</b></span>' +
          '</div>' +
          (o.opens ? '<div class="wh-opens">opens: ' + esc(o.opens) + '</div>' : '') +
        '</div>';
    }

    // ── THE ASCENSION. A rung crossed gets exactly one quiet moment, inline,
    //    and only when the tier actually CHANGED since the last draw. On the
    //    very first draw of a session _drawnTier is null, so we record the rung
    //    without announcing it — otherwise every reload would "promote" you.
    var tierN = num(t.n, 0);
    if (_drawnTier !== null && tierN > _drawnTier) {
      html +=
        '<div class="wh-rose">you are <b>' + esc(t.title || '') + '</b> now. ' +
        esc(t.line || '') + '</div>';
      clearTimeout(_roseT);
      _roseT = setTimeout(function () {
        try {
          var n = _el && _el.querySelector('.wh-rose');
          if (n && n.parentNode) { n.parentNode.removeChild(n); publishBottom(); }
        } catch (_) {}
      }, 12000);
    }
    _drawnTier = tierN;

    // ── THE LONG WORK — the open loop. Always present (the stone stands in the
    //    clearing from the first second), always asking something it does not
    //    answer. This is the one thing on the panel that never resolves.
    if (lw && lw.present) {
      html +=
        '<button class="wh-lw" id="whLwBtn">' +
          '<div class="wh-lwlab">the long work · ' +
            num(lw.revealed, 0) + ' of ' + num(lw.total, 0) + ' read</div>' +
          '<div class="wh-lwask">' + esc(lw.ask || '') + '</div>' +
        '</button>';
    }

    box.innerHTML = html;

    var lwb = box.querySelector('#whLwBtn');
    if (lwb) lwb.onclick = function () { showLongWork(_climb); };

    publishBottom();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE LONG WORK, READ IN FULL — the stone's inscription as far as it is yours
  //
  // The second sanctioned modal in this file. Mutually exclusive with the
  // homecoming by construction (each closes the other before opening), which is
  // why they may share a z-index band without ever sharing pixels.
  // ═══════════════════════════════════════════════════════════════════════════
  var _lwEl = null;

  function showLongWork(C) {
    if (!C || !C.longWork) return;
    var lw = C.longWork;
    // never let two modals occupy the screen at once
    try { hideHomecoming(); } catch (_) {}

    if (!_lwEl) {
      _lwEl = document.createElement('div');
      _lwEl.id = 'whLwWrap';
      _lwEl.setAttribute('role', 'dialog');
      _lwEl.setAttribute('aria-modal', 'true');
      _lwEl.setAttribute('aria-label', 'the long work');
      _lwEl.innerHTML =
        '<div id="whLwCard">' +
          '<div class="lw-body">' +
            '<div class="lw-glyph">◈</div>' +
            '<div class="lw-kicker" id="whLwKick">the long work</div>' +
            '<div class="lw-h">the stone in the clearing</div>' +
            '<div class="lw-lines" id="whLwLines"></div>' +
            '<div class="lw-sealed" id="whLwSealed"></div>' +
            '<div class="lw-ask" id="whLwAsk"></div>' +
          '</div>' +
          '<div class="lw-foot"><button class="lw-go" id="whLwGo">step back</button></div>' +
        '</div>';
      document.body.appendChild(_lwEl);
      _lwEl.querySelector('#whLwGo').onclick = hideLongWork;
      _lwEl.addEventListener('click', function (e) { if (e.target === _lwEl) hideLongWork(); });
    }

    var revealed = num(lw.revealed, 0), total = num(lw.total, 0);
    _lwEl.querySelector('#whLwKick').textContent =
      'the long work · ' + revealed + ' of ' + total + ' read';

    // the stanzas earned, each in its own block. The server only ever sends the
    // ones this player may read, so there is nothing here to leak.
    var lines = Array.isArray(lw.lines) ? lw.lines : [];
    var lhtml = '';
    for (var i = 0; i < lines.length; i++) {
      var L = lines[i] || {};
      lhtml += '<div class="lw-line' + (L.read ? '' : ' unread') + '">' + esc(L.line || '') + '</div>';
    }
    _lwEl.querySelector('#whLwLines').innerHTML = lhtml;

    // what is still sealed — shown as sealed, never as absence.
    var sealed = Math.max(0, total - revealed);
    var sn = _lwEl.querySelector('#whLwSealed');
    if (sealed > 0) {
      sn.style.display = '';
      sn.textContent = sealed === 1
        ? 'one more line is cut into the stone. you cannot read it yet.'
        : sealed + ' more lines are cut into the stone. you cannot read them yet.';
    } else {
      // COMPLETE IS NOT ANSWERED. The payload says so and so does this surface.
      sn.style.display = '';
      sn.textContent = 'there is nothing left to uncover. there is still no answer.';
    }

    _lwEl.querySelector('#whLwAsk').textContent = lw.ask || '';

    try { requestAnimationFrame(function () { _lwEl.classList.add('show'); }); }
    catch (_) { _lwEl.classList.add('show'); }
    document.addEventListener('keydown', _lwKey);
  }

  function _lwKey(e) { if (e.key === 'Escape') hideLongWork(); }

  function hideLongWork() {
    if (!_lwEl) return;
    _lwEl.classList.remove('show');
    document.removeEventListener('keydown', _lwKey);
    setTimeout(function () { try { if (_lwEl) _lwEl.style.display = ''; } catch (_) {} }, 520);
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
    // NO-COLLISION: the homecoming and the Long Work share a z-index band, which
    // is only safe because they are mutually exclusive. Each closes the other
    // before it opens, so the two can never occupy the same pixels.
    try { hideLongWork(); } catch (_) {}

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
  function _render(r, living, climb) {
    if (!_el) return;
    if (r) _resident = r;
    if (living !== undefined) _living = living || null;
    // same three-valued contract as `living` — see the note above.
    if (climb !== undefined) _climb = climb || null;

    if (_resident) {
      _el.querySelector('#whLumen').textContent = _resident.lumen != null ? _resident.lumen : 0;
      _el.querySelector('#whEcho').textContent = _resident.echo != null ? _resident.echo : 0;
      // the standing chip prefers the ASCENT's reading over the resident column
      // (they agree by construction; the reading is the truth if they ever don't).
      // num() guarantees a number even when standing is 0, null, or the column is
      // missing entirely on a legacy row — the chip can never print undefined/NaN.
      _el.querySelector('#whStanding').textContent = String(Math.round(
        num(_climb && _climb.standing, num(_resident.standing, 0))));
      var claimBtn = _el.querySelector('#whClaim');
      if (_resident.claim && claimBtn) {
        claimBtn.disabled = true; claimBtn.style.opacity = '0.45';
        claimBtn.textContent = '⌂ hearth claimed';
      }
    }
    // the ascent draws FIRST — it sits above the vigil in the panel, and drawing
    // it first means one publishBottom() at the end measures a settled box.
    _renderAscent(_climb);
    _syncBuildRow();
    _renderVigil(_living);
    _syncTendBtn();
  }

  // ── THE BUILD ROW MIRRORS THE LADDER TOO ────────────────────────────────────
  // This panel's own four buttons are all tier-0 kinds, so they are never locked
  // in practice — but the mirror is wired anyway rather than assumed, because
  // "these four happen to be free today" is exactly the assumption that leaves a
  // dead control behind the next time the tier table moves. The server's
  // `climb.tier.kinds` is the only authority; this reads it and nothing else.
  function _syncBuildRow() {
    if (!_el) return;
    var kinds = (_climb && _climb.tier && Array.isArray(_climb.tier.kinds))
      ? _climb.tier.kinds : null;
    _el.querySelectorAll('.wh-piece').forEach(function (b) {
      var k = b.getAttribute('data-kind');
      // null = the brain has not spoken → never lock optimistically
      var open = !kinds || kinds.indexOf(k) !== -1;
      b.style.opacity = open ? '' : '0.4';
      b.setAttribute('aria-disabled', open ? 'false' : 'true');
      b.title = open ? k : (k + ' — opens further up the climb');
    });
  }

  // ── wire to world events ─────────────────────────────────────────────────────
  W.addEventListener('vint:world-state', function (e) {
    var d = e.detail || {};
    // a world:state ALWAYS carries the authoritative living picture, or the
    // absence of one — pass null (never undefined) so a server that stopped
    // speaking the vigil clears the last picture instead of stranding it.
    // a world:state ALWAYS carries the authoritative ladder picture too, or the
    // absence of one — null (never undefined) so a brain that stopped speaking
    // the ascent clears the last rung instead of stranding it on screen.
    _render(d.resident, d.living || null, d.climb || null);
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
    // a tend reply carries no ladder picture — pass undefined ("not part of this
    // update") so the rung on screen is kept rather than cleared. The world:state
    // frame that follows immediately after carries the freshly-reconciled climb.
    _render(null, d.living || undefined, undefined);
    var n = num(d.tended, 0), g = num(d.gained, 0);
    if (!n) _toast('no one in your court to tend — bring an agent in.');
    else if (g > 0) {
      _toast('you tended ' + n + (n === 1 ? ' agent' : ' agents') + ' — the clearing brightens (+' + g + ').');
    } else {
      _toast('your court was already fresh — their watch holds.');
    }
  });
  // THE WARMTH ECHO — world-client fires this whenever the SERVER moved spark
  // (world:state or world:tend:ok), carrying the same `living` picture it just
  // handed the 3D light. The panel listens so the readout and the sky can never
  // disagree: if a surface calls World.setSpark directly — the Court's REST tend
  // fallback does exactly that when the socket is down — this is what keeps the
  // vigil in step. Still nothing derived: we re-render the server's own object.
  W.addEventListener('vint:world-warmth', function (e) {
    var lv = e.detail && e.detail.living;
    if (!lv || lv === _living) return;   // already the picture we are showing
    // the warmth echo carries spark only, never the ladder — keep the rung.
    _render(null, lv, undefined);
    // HOMECOMING — if the world paid a re-entry gift it gets its full moment.
    // showHomecoming self-guards to once per load, so the state frame and this
    // echo can never both open it.
    if (num(lv.homecoming, 0) > 0) showHomecoming(lv);
  });
  W.addEventListener('vint:world-harvest', function (e) {
    var d = e.detail || {};
    if (!d.artifact) { _toast('+' + num(d.echo, 0) + ' echo'); return; }
    var line = 'found: ' + d.artifact;
    // THE WARDEN UNLOCK, made visible. `artifactDepth` is only present at warden
    // and above — its very absence is the ungated state, so this surface never
    // has to know what tier the player is on. Guarded field-by-field so a partial
    // payload shortens the sentence rather than printing undefined.
    if (d.artifactDepth && typeof d.artifactDepth === 'object') {
      var kind = d.artifactDepth.kind ? String(d.artifactDepth.kind) : '';
      var lv = num(d.artifactDepth.levels, -1);
      var bits = [];
      if (kind) bits.push(kind);
      if (lv >= 0) bits.push(lv + (lv === 1 ? ' shelf deep' : ' shelves deep'));
      if (bits.length) line += '  (' + bits.join(' · ') + ')';
    }
    _toast(line + '  +' + num(d.echo, 0) + ' echo');
  });
  W.addEventListener('vint:world-refine', function (e) {
    var d = e.detail || {}; _toast('refined ' + d.spent + ' echo → ' + d.gained + ' lumen');
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
    // THE ASCENT REFUSAL — a signpost, never a wall. The server sends the tier
    // that opens the piece and the exact gap to it, so the message can always
    // say what to reach for rather than merely "no". Every field is guarded:
    // a partial payload degrades to a shorter sentence, never to "undefined".
    if (!msg && c === 'standing') {
      var kd = det.kind ? esc(det.kind) : 'that piece';
      msg = 'the ' + kd + ' is not yours to place yet';
      if (det.tier) {
        msg += ' — it opens at ' + esc(det.tier);
        if (num(det.gap, 0) > 0) msg += ', ' + Math.round(num(det.gap, 0)) + ' standing away';
      }
      msg += '. keep building.';
    }
    if (!msg && c === 'bad_kind') msg = 'the clearing does not know that shape.';
    _toast(msg || ('— ' + c));
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
    // THE ASCENT — the same contract the vigil has: another surface hands the
    // server's freshly-computed `climb` straight in (the REST /api/world/ascent
    // path does exactly this when there is no socket to carry a state frame).
    renderAscent: function (C) {
      if (C) _climb = C;
      _renderAscent(_climb);
    },
    climb: function () { return _climb; },
    // exposed so another surface (or a test) can replay the moment deliberately
    showHomecoming: showHomecoming,
    hideHomecoming: hideHomecoming,
    showLongWork: function () { showLongWork(_climb); },
    hideLongWork: hideLongWork
  };
})();
