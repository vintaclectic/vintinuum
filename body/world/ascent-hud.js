// ═══════════════════════════════════════════════════════════════════════════
// THE ASCENT, MADE VISIBLE — the climb surface (AETHERHOLD, 2026-08-05)
//
// world/ascent.js gave DIRVERSE a LADDER: six named tiers, a standing derived
// from every deed the world can count, a next objective that is never null, and
// the Long Work — an inscription that reveals one line per rung and never
// answers itself. GET /api/world/ascent returned all of it, whole and correct,
// and NOTHING IN THE BROWSER RENDERED A SINGLE FIELD OF IT.
//
// So the acceptance criterion — "a new player has a named next objective at
// every point in their first three sessions, and can see how far they are from
// it" — was true on the server and false to the human, which is the same as
// false. This file is the other half: where the ladder becomes SEEN.
//
// FIVE THINGS THIS SURFACE OWES THE PLAYER, in this order:
//   1. WHERE YOU STAND, NAMED. The tier's title and the world's own line about
//      it. Not a level number — a name you can say out loud. "you are a
//      lampwright" is an identity; "level 3" is a receipt.
//   2. THE NAMED NEXT THING, AND EXACTLY HOW FAR. The objective's sentence, its
//      have/want, its `far` phrasing, and a rung bar. This is the acceptance
//      criterion, and it is the largest, warmest thing on the surface.
//   3. WHAT IT OPENS. Never "+1 tier" — the actual pieces, reach and verbs that
//      were shut and will not be. A promise you can want.
//   4. THE LADDER ITSELF. All six rungs, so the climb has a shape and the player
//      can see both what they crossed and what is still above them.
//   5. THE LONG WORK. Every line earned, and the question this rung leaves
//      hanging. It is rendered as an inscription being uncovered, never as a
//      completion meter — because the reward for climbing is a better question.
//
// SERVER-AUTHORITATIVE, ABSOLUTELY. This file computes NO progression. It does
// not derive a tier from a standing, does not know a threshold, does not hold a
// copy of the tier table, and never re-implements `objective()`. Every name,
// number, sentence and unlock came from the brain's `climb` object over the
// wire. If the endpoint is unreachable the surface says so plainly and claims
// nothing. (The same discipline world-hud.js holds for the vigil.)
//
// NO-COLLISION LAW — how this surface is structurally incapable of colliding:
//   · It adds ZERO new position:fixed elements to the world. Not one.
//   · Its LAUNCHER is a flow child of #dvRail (via DirverseHUD.addLauncher) —
//     the one fixed box that owns that column, measures its own ceiling against
//     #vintWorldHud and #hint, its floor against #saybar and any open sheet, and
//     scrolls internally when the band is short. This file sets no position, no
//     top/bottom/left/right, and no z-index on the launcher. Geometry is the
//     rail's, never ours.
//   · Its SHEET is registered with the HUD's one-sheet-at-a-time owner
//     (registerSheet/openSheet), so raising it CLOSES the star-map, the agents
//     panel and the court first. Four full-width sheets can never stack.
//   · The sheet is bounded (max-height:min(82dvh,620px)) and its body scrolls
//     internally, so no amount of content — six ladder rungs, six Long Work
//     lines, a 60-char tier name — can grow it past its own box.
//   · The ONE intended overlay is the sheet over the shared #dvScrim, which is
//     the sanctioned modal case Vinta already approved for every other sheet.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintAscent) return;

  var W = window;
  function base() { return (W.__VINTINUUM_API_BASE || '').replace(/\/$/, ''); }
  function token() {
    try { return localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token'); }
    catch (_) { return null; }
  }
  function authHeaders() { var t = token(); return t ? { Authorization: 'Bearer ' + t } : {}; }
  function isGuest() { return !token(); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

  // ── THE FLAG (every hook killable in 30s, no deploy) ────────────────────────
  // ?ascent=0 hard-kills the surface: no launcher, no sheet, nothing mounted.
  // The server's own ASCENT=0 flag is honoured separately and independently —
  // when the brain sends `climb.on === false` the surface renders the world
  // without a ladder rather than an empty or broken panel.
  function enabled() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('ascent') === '0') return false;
      if (q.get('ascent') === '1') return true;
    } catch (_) {}
    return true;
  }

  // ── the six rungs, each with its own light ──────────────────────────────────
  // Mirrors the vigil HUD's STATES idiom exactly: the client never derives WHICH
  // tier is active (the server names it), it only looks up how to PAINT the one
  // the server named. An unknown key falls back to the ember light, so a tier
  // added server-side renders correctly before this file has ever heard of it.
  var RUNGS = {
    'ember-bearer': { c: '#c77b7b', glow: 'rgba(199,123,123,0.40)', g: '·' },
    'hearthkeeper': { c: '#ffb066', glow: 'rgba(255,176,102,0.45)', g: '⌂' },
    'wallwright':   { c: '#ffd479', glow: 'rgba(255,212,121,0.50)', g: '▥' },
    'lampwright':   { c: '#7ccfff', glow: 'rgba(124,207,255,0.45)', g: '❂' },
    'warden':       { c: '#9a86d8', glow: 'rgba(154,134,216,0.45)', g: '◈' },
    'lightwarden':  { c: '#e9d5ff', glow: 'rgba(233,213,255,0.55)', g: '❈' }
  };
  function rungOf(k) { return RUNGS[k] || RUNGS['ember-bearer']; }

  function injectStyles() {
    if (document.getElementById('asc-styles')) return;
    var s = document.createElement('style');
    s.id = 'asc-styles';
    s.textContent = [
      // ── LAUNCHER ────────────────────────────────────────────────────────────
      // GEOMETRY IS NOT OURS (the Court's rule, and it is the right one). #ascBtn
      // is a flow child of #dvRail. This file styles the tier pill INSIDE the
      // button and nothing else — no position, no z-index, no offsets. The pill
      // is its own flex cell in the launcher's row, never absolutely positioned
      // over the label, because a badge floated on a button is the classic
      // collision and we do not ship it.
      '#ascBtn{border-color:rgba(255,212,121,0.34);color:#ffe2a0;}',
      '#ascBtn .dot{background:#ffd479;box-shadow:0 0 8px #ffd479;}',
      '#ascBtn .asc-pill{flex:0 0 auto;max-width:96px;height:20px;padding:0 8px;border-radius:10px;',
      ' display:flex;align-items:center;justify-content:center;font-size:11px;line-height:1;',
      ' margin-left:6px;background:rgba(255,212,121,0.16);border:1px solid rgba(255,212,121,0.32);',
      ' color:#ffe8b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      // on a landscape phone the rail drops launcher labels to glyph-only; the
      // pill goes with them, or a 96px pill would be most of a label-less button.
      '@media(max-height:560px){#ascBtn .asc-pill{display:none;}}',

      // ── SHEET (the dv-sheet scaffold's geometry language, own id so the
      //    ascent can be killed without touching the DIRVERSE stylesheet) ──────
      '#ascSheet{position:fixed;left:0;right:0;bottom:0;z-index:1600;',
      // dvh follows the on-screen keyboard on modern mobile; vh is the fallback.
      // No input lives in this sheet, but the unit is kept consistent with its
      // siblings so all four sheets breathe identically on a phone.
      ' max-height:min(82vh,620px);max-height:min(82dvh,620px);',
      ' background:rgba(6,9,15,0.94);',
      ' border-top:1px solid rgba(255,212,121,0.24);border-radius:20px 20px 0 0;',
      ' backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);color:#f0e6d8;',
      ' font-family:"Cormorant Garamond",Georgia,serif;',
      ' transform:translateY(105%);transition:transform .38s cubic-bezier(.22,1,.36,1);',
      ' display:flex;flex-direction:column;',
      ' padding-bottom:max(12px,env(safe-area-inset-bottom,12px));',
      ' box-shadow:0 -12px 48px rgba(0,0,0,0.6);}',
      '#ascSheet.open{transform:translateY(0);}',
      '@media(prefers-reduced-motion:reduce){#ascSheet{transition:none;}}',
      '.asc-grip{flex:0 0 auto;width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,0.22);',
      ' margin:9px auto 4px;}',
      // the head clips its own text: a long tier title can never push ✕ off-screen
      '.asc-head{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;',
      ' gap:10px;padding:4px 18px 8px;}',
      '.asc-title{min-width:0;font-size:21px;letter-spacing:.04em;color:#fff3dd;',
      ' white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.asc-title small{display:block;font-size:12px;letter-spacing:.06em;color:rgba(255,212,121,0.62);',
      ' font-style:italic;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.asc-x{flex:0 0 auto;min-width:44px;min-height:44px;border:none;background:none;',
      ' color:rgba(240,230,216,0.55);font-size:22px;cursor:pointer;line-height:1;}',
      '.asc-x:active{color:#fff;}',
      '.asc-body{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;',
      ' padding:2px 14px 16px;overscroll-behavior:contain;scrollbar-width:thin;',
      ' scrollbar-color:rgba(255,212,121,0.3) transparent;}',
      '.asc-body::-webkit-scrollbar{width:4px;}',
      '.asc-body::-webkit-scrollbar-thumb{background:rgba(255,212,121,0.3);border-radius:2px;}',

      // ── WHERE YOU STAND ─────────────────────────────────────────────────────
      // The glyph and the name share one row; the name owns all remaining width
      // and clips itself, so the glyph can never be shoved out of the card.
      '.asc-standing{border-radius:16px;padding:15px 15px 14px;margin-bottom:12px;',
      ' background:linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02));',
      ' border:1px solid var(--asc-b,rgba(255,212,121,0.28));}',
      '.asc-srow{display:flex;align-items:center;gap:12px;min-width:0;}',
      '.asc-glyph{flex:0 0 auto;width:44px;height:44px;border-radius:50%;display:flex;',
      ' align-items:center;justify-content:center;font-size:21px;color:var(--asc-c,#ffd479);',
      ' background:rgba(255,255,255,0.05);border:1px solid var(--asc-b,rgba(255,212,121,0.3));',
      ' text-shadow:0 0 16px var(--asc-g,rgba(255,212,121,0.5));}',
      '.asc-sid{flex:1 1 auto;min-width:0;}',
      '.asc-skick{font-size:10px;letter-spacing:.16em;text-transform:uppercase;',
      ' color:rgba(240,230,216,0.45);}',
      '.asc-sname{font-size:22px;line-height:1.15;color:var(--asc-c,#ffd479);margin-top:2px;',
      ' text-shadow:0 0 22px var(--asc-g,rgba(255,212,121,0.35));',
      ' white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      // the number is its own cell on the same baseline — never over the name
      '.asc-snum{flex:0 0 auto;text-align:right;font-size:12px;color:rgba(240,230,216,0.5);}',
      '.asc-snum b{display:block;font-size:20px;color:#fff3dd;font-variant-numeric:tabular-nums;',
      ' line-height:1.1;}',
      // the world's own sentence about this rung. Buffet's one line.
      '.asc-sline{margin-top:11px;font-size:13.5px;line-height:1.5;font-style:italic;',
      ' color:rgba(240,230,216,0.7);}',
      // PERMANENT — the counterpart to the vigil's floor promise, said out loud.
      '.asc-perm{display:flex;align-items:center;gap:6px;margin-top:10px;font-size:11px;',
      ' line-height:1.4;color:rgba(255,212,121,0.66);}',
      '.asc-perm i{flex:0 0 auto;font-style:normal;font-size:11px;}',
      '.asc-perm span{flex:1 1 auto;min-width:0;}',

      // ── THE NEXT THING (the acceptance criterion, and the biggest thing here)
      '.asc-next{border-radius:16px;padding:14px 15px 15px;margin-bottom:12px;',
      ' background:linear-gradient(180deg,rgba(255,212,121,0.10),rgba(255,212,121,0.035));',
      ' border:1px solid rgba(255,212,121,0.3);}',
      '.asc-nkick{font-size:10px;letter-spacing:.16em;text-transform:uppercase;',
      ' color:rgba(255,212,121,0.7);}',
      // the ask itself — the named next thing, in the world's voice
      '.asc-nsay{margin-top:6px;font-size:17px;line-height:1.4;color:#fff6e6;}',
      // the distance. Its own row, tabular, never inside the sentence.
      '.asc-nfar{display:flex;align-items:baseline;justify-content:space-between;gap:10px;',
      ' margin-top:10px;font-size:12px;color:rgba(240,230,216,0.6);}',
      '.asc-nfar .fl{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;',
      ' text-overflow:ellipsis;}',
      '.asc-nfar .fr{flex:0 0 auto;font-variant-numeric:tabular-nums;color:rgba(255,212,121,0.85);}',
      // THE RUNG BAR. Two readings stacked in ONE composed meter (the vigil's
      // precedent): the thin `climbed` line under the thick `pct` fill. This is
      // the single intended overlay inside the surface — one meter, two layers,
      // by design, exactly like wh-meter's floor band.
      '.asc-bar{position:relative;height:9px;border-radius:5px;margin-top:8px;',
      ' background:rgba(255,255,255,0.07);overflow:hidden;}',
      '.asc-barfill{position:absolute;left:0;top:0;bottom:0;border-radius:5px;',
      ' background:linear-gradient(90deg,#ffd479,#ffb066);',
      ' box-shadow:0 0 12px rgba(255,212,121,0.4);transition:width .5s ease;}',
      '@media(prefers-reduced-motion:reduce){.asc-barfill{transition:none;}}',
      // what the next rung opens — its own boxed row, wraps freely, never clipped
      '.asc-opens{margin-top:11px;padding:10px 12px;border-radius:12px;',
      ' background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.08);',
      ' font-size:12.5px;line-height:1.5;color:rgba(240,230,216,0.72);',
      ' overflow-wrap:anywhere;}',
      '.asc-opens b{color:#ffe2a0;font-weight:400;}',
      // the act button — routes to the surface where the named deed is done
      '.asc-act{display:block;width:100%;min-height:46px;margin-top:11px;border-radius:12px;',
      ' font-family:inherit;font-size:15px;letter-spacing:.03em;cursor:pointer;',
      ' color:#241a06;font-weight:600;border:none;',
      ' background:linear-gradient(90deg,#ffd479,#ffb066);',
      ' box-shadow:0 5px 18px rgba(255,190,110,0.24);}',
      '.asc-act:active{transform:scale(0.985);}',

      // ── THE LADDER ──────────────────────────────────────────────────────────
      '.asc-sec{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;',
      ' color:rgba(255,212,121,0.55);margin:16px 0 8px;}',
      '.asc-ladder{display:flex;flex-direction:column;gap:6px;}',
      // one rung = one row. The name owns the middle and clips; the threshold is
      // its own right-hand cell. Nothing floats, nothing overlaps.
      '.asc-rung{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:12px;',
      ' background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);}',
      '.asc-rung .rg{flex:0 0 auto;width:26px;height:26px;border-radius:50%;display:flex;',
      ' align-items:center;justify-content:center;font-size:13px;',
      ' background:rgba(255,255,255,0.05);color:rgba(240,230,216,0.35);',
      ' border:1px solid rgba(255,255,255,0.09);}',
      '.asc-rung .rn{flex:1 1 auto;min-width:0;font-size:14.5px;color:rgba(240,230,216,0.5);',
      ' white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.asc-rung .rv{flex:0 0 auto;font-size:11.5px;color:rgba(240,230,216,0.35);',
      ' font-variant-numeric:tabular-nums;}',
      // reached: you stood here. at: you are here now.
      '.asc-rung.reached .rn{color:rgba(240,230,216,0.78);}',
      '.asc-rung.reached .rg{color:var(--rc,#ffd479);border-color:rgba(255,212,121,0.3);',
      ' background:rgba(255,212,121,0.08);}',
      '.asc-rung.reached .rv{color:rgba(255,212,121,0.5);}',
      '.asc-rung.at{background:rgba(255,212,121,0.09);border-color:rgba(255,212,121,0.35);}',
      '.asc-rung.at .rn{color:#fff3dd;}',
      '.asc-rung.at .rv{color:#ffd479;}',
      // an unreached rung keeps its NAME (the climb should be visible), and says
      // what it costs. It is dimmed, never hidden — a ladder you cannot see the
      // top of is not a ladder.
      '.asc-rung.locked .rg{color:rgba(240,230,216,0.22);}',

      // ── THE LONG WORK — the open loop, rendered as an inscription ────────────
      // Deliberately NOT a progress meter. No "4/6", no bar, no percentage: this
      // is a stone being uncovered, and the last thing it must ever read as is a
      // completion checklist. The unread lines are shown as the marks you cannot
      // read yet, which is the honest picture and also the hook.
      '.asc-stone{border-radius:16px;padding:14px 15px;margin-top:4px;',
      ' background:linear-gradient(180deg,rgba(154,134,216,0.10),rgba(154,134,216,0.03));',
      ' border:1px solid rgba(154,134,216,0.26);}',
      '.asc-stonek{font-size:10px;letter-spacing:.16em;text-transform:uppercase;',
      ' color:rgba(200,180,255,0.6);}',
      '.asc-lines{display:flex;flex-direction:column;gap:9px;margin-top:10px;}',
      // each line is its own block; long lines wrap inside it and never spill
      '.asc-ln{font-size:14px;line-height:1.55;color:rgba(235,225,255,0.86);',
      ' padding-left:11px;border-left:2px solid rgba(154,134,216,0.4);',
      ' overflow-wrap:anywhere;}',
      // the first, unreadable line — the stone before it is yours
      '.asc-ln.unread{color:rgba(200,180,255,0.5);font-style:italic;',
      ' border-left-color:rgba(154,134,216,0.2);}',
      // the marks still illegible: never a count, never a lock icon. Just the
      // truth that there is more on the stone.
      '.asc-more{margin-top:11px;font-size:12.5px;line-height:1.5;font-style:italic;',
      ' color:rgba(200,180,255,0.55);}',
      // THE ASK — the question this rung leaves hanging, at every rung including
      // the last. This is the open loop and it gets the warmest treatment here.
      '.asc-ask{margin-top:12px;padding:11px 13px;border-radius:12px;',
      ' background:rgba(154,134,216,0.10);border:1px solid rgba(154,134,216,0.24);',
      ' font-size:13.5px;line-height:1.55;color:rgba(226,214,255,0.92);',
      ' overflow-wrap:anywhere;}',

      // ── states: loading, error, guest ───────────────────────────────────────
      '.asc-msg{padding:30px 14px;text-align:center;font-size:15px;line-height:1.55;',
      ' color:rgba(240,230,216,0.55);font-style:italic;}',
      '.asc-door{padding:22px 14px;text-align:center;}',
      '.asc-door .dh{font-size:19px;line-height:1.35;color:#fff3dd;}',
      '.asc-door .ds{margin-top:9px;font-size:14px;line-height:1.55;color:rgba(240,230,216,0.6);}',
      '.asc-door .da{display:inline-flex;align-items:center;justify-content:center;min-height:48px;',
      ' margin-top:16px;padding:0 24px;border-radius:999px;font-size:15.5px;text-decoration:none;',
      ' color:#241a06;font-weight:600;background:linear-gradient(90deg,#ffd479,#ffb066);',
      ' box-shadow:0 6px 22px rgba(255,190,110,0.26);border:none;font-family:inherit;cursor:pointer;}',
      '.asc-door .da:active{transform:scale(0.98);}',

      // ── THE ASCENSION — the moment a rung is crossed ────────────────────────
      // The one deliberate overlay in this file, and the sanctioned kind: a true
      // modal over its OWN dedicated scrim, dismissible three ways (button, scrim
      // tap, Escape). z-order: 1610/1620 — the same band world-hud's homecoming
      // uses, above the sheets (1600) so an open sheet cannot bury the moment,
      // and below #dvToast (1700) so a toast is never swallowed. Centred with
      // flex, never with transforms against hand-counted offsets, so it cannot
      // drift onto anything at any viewport.
      //
      // These two moments are mutually exclusive by construction — see _rose()'s
      // note: the homecoming is an ARRIVAL and the ascension is an ACT, so they
      // cannot both be raised by the same frame. The ascension additionally
      // defers while #whHomeWrap is up, so two cards can never share the screen.
      '#ascRoseWrap{position:fixed;inset:0;z-index:1610;display:none;',
      ' align-items:center;justify-content:center;',
      ' padding:max(16px,env(safe-area-inset-top,16px)) max(16px,env(safe-area-inset-right,16px))',
      ' max(16px,env(safe-area-inset-bottom,16px)) max(16px,env(safe-area-inset-left,16px));',
      ' background:rgba(3,5,10,0.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);',
      ' opacity:0;transition:opacity .5s ease;}',
      '#ascRoseWrap.show{display:flex;opacity:1;}',
      '#ascRoseCard{position:relative;z-index:1620;width:100%;max-width:min(360px,calc(100vw - 32px));',
      ' max-height:calc(100dvh - 32px);max-height:calc(100vh - 32px);',
      ' display:flex;flex-direction:column;overflow:hidden;',
      ' background:rgba(10,14,22,0.96);border:1px solid var(--asc-b,rgba(255,212,121,0.32));',
      ' border-radius:22px;box-shadow:0 24px 80px rgba(0,0,0,0.7),0 0 60px var(--asc-g,rgba(255,212,121,0.1));',
      ' font-family:"Cormorant Garamond",Georgia,serif;color:#f3ead9;',
      ' transform:translateY(14px) scale(0.97);transition:transform .5s cubic-bezier(.22,1,.36,1);}',
      '#ascRoseWrap.show #ascRoseCard{transform:translateY(0) scale(1);}',
      '@media(prefers-reduced-motion:reduce){#ascRoseWrap,#ascRoseCard{transition:none;}}',
      '#ascRoseCard .rb{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;',
      ' overscroll-behavior:contain;padding:26px 22px 8px;text-align:center;}',
      '#ascRoseCard .rglyph{font-size:40px;line-height:1;color:var(--asc-c,#ffd479);',
      ' text-shadow:0 0 30px var(--asc-g,rgba(255,212,121,0.6));animation:ascPulse 3.4s ease-in-out infinite;}',
      '@keyframes ascPulse{0%,100%{opacity:0.86;transform:scale(1);}50%{opacity:1;transform:scale(1.06);}}',
      '@media(prefers-reduced-motion:reduce){#ascRoseCard .rglyph{animation:none;}}',
      '#ascRoseCard .rkick{margin-top:12px;font-size:11px;letter-spacing:.19em;text-transform:uppercase;',
      ' color:rgba(255,212,121,0.66);}',
      '#ascRoseCard .rname{margin-top:7px;font-size:28px;line-height:1.2;color:var(--asc-c,#fff6e6);',
      ' overflow-wrap:anywhere;}',
      '#ascRoseCard .rline{margin-top:13px;font-size:15px;line-height:1.55;font-style:italic;',
      ' color:rgba(240,232,218,0.78);}',
      '#ascRoseCard .ropen{margin-top:15px;padding:11px 13px;border-radius:13px;text-align:left;',
      ' background:rgba(255,212,121,0.07);border:1px solid rgba(255,212,121,0.2);',
      ' font-size:13.5px;line-height:1.5;color:rgba(255,226,160,0.9);overflow-wrap:anywhere;}',
      '#ascRoseCard .ropen b{color:#fff6e6;font-weight:400;}',
      // the new line of the stone, revealed in the same breath as the rung
      '#ascRoseCard .rstone{margin-top:13px;padding:11px 13px;border-radius:13px;text-align:left;',
      ' background:rgba(154,134,216,0.10);border:1px solid rgba(154,134,216,0.26);',
      ' font-size:13.5px;line-height:1.55;color:rgba(226,214,255,0.9);overflow-wrap:anywhere;}',
      '#ascRoseCard .rstone i{display:block;font-size:10px;letter-spacing:.16em;text-transform:uppercase;',
      ' color:rgba(200,180,255,0.6);font-style:normal;margin-bottom:5px;}',
      '#ascRoseCard .rfoot{flex:0 0 auto;padding:12px 22px max(18px,env(safe-area-inset-bottom,18px));}',
      '#ascRoseCard .rgo{width:100%;min-height:50px;border-radius:14px;font-family:inherit;',
      ' font-size:16px;letter-spacing:.05em;cursor:pointer;color:#1a1006;font-weight:600;border:none;',
      ' background:linear-gradient(90deg,#ffd479,#ffb066);box-shadow:0 6px 24px rgba(255,212,121,0.26);}',
      '#ascRoseCard .rgo:active{transform:scale(0.985);}',
      // very short viewports (landscape phone): the card shrinks its own padding
      // and the body scrolls — it never grows past the screen or clips its button.
      '@media(max-height:520px){#ascRoseCard .rb{padding:16px 18px 6px;}',
      ' #ascRoseCard .rglyph{font-size:28px;}#ascRoseCard .rname{font-size:21px;}',
      ' #ascRoseCard .rline{font-size:13.5px;margin-top:9px;}}'
    ].join('');
    document.head.appendChild(s);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE — the server's climb object, and nothing derived from it
  // ═══════════════════════════════════════════════════════════════════════════
  var _sheet = null, _btn = null;
  var _climb = null;            // the last `climb` the brain sent, verbatim
  var _state = 'idle';          // idle|loading|ok|guest|error
  var _inflight = false;
  var _lastTier = null;         // to detect a crossing between reads
  var _seenRose = false;        // the ascension card is shown once per load

  // ── THE READ ────────────────────────────────────────────────────────────────
  // One flight at a time, ever. `fresh` bypasses the server's 20s memo — used
  // only after an ACT (a deed just happened, the number must be true now), never
  // for idle refreshes, so a chatty client can't turn the ladder into six
  // queries per keystroke.
  function load(fresh, then) {
    if (isGuest()) { _state = 'guest'; render(); if (then) then(); return; }
    if (_inflight) return;
    _inflight = true;
    if (_state !== 'ok') { _state = 'loading'; render(); }
    fetch(base() + '/api/world/ascent' + (fresh ? '?fresh=1' : ''), { headers: authHeaders() })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) { _state = 'guest'; return null; }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (j) {
        _inflight = false;
        if (_state === 'guest') { render(); if (then) then(); return; }
        if (!j || !j.ok || !j.climb) throw new Error('bad payload');
        applyClimb(j.climb);
        if (then) then();
      })
      .catch(function () {
        _inflight = false;
        // never wipe a good picture on a transient failure — a stale-but-true
        // ladder beats an error card. Only a cold failure shows the error state.
        if (!_climb) _state = 'error';
        render();
        if (then) then();
      });
  }

  // Adopt the server's picture. This is the ONLY place _climb is ever written.
  function applyClimb(c) {
    var prevTier = _lastTier;
    _climb = c;
    _state = 'ok';
    var idx = c.tier ? num(c.tier.n, 0) : 0;

    // THE CROSSING. Two independent signals, because neither alone is complete:
    //   · `climb.rose` — the server saw the rung cross during ITS reconcile. The
    //     authoritative signal, but it only fires on the ONE read that crossed.
    //   · a tier index higher than the last one this client saw — catches the
    //     case where the crossing reconcile happened on a request this surface
    //     did not make (a place, a tend), so `rose` was consumed elsewhere.
    // Either one raises the moment; `_seenRose` keeps it to once per load so
    // they can never both fire it.
    var crossed = !!c.rose || (prevTier != null && idx > prevTier);
    _lastTier = idx;
    render();
    if (crossed) showRose(c);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE LAUNCHER PILL — the tier, always visible without opening anything
  // ═══════════════════════════════════════════════════════════════════════════
  // The rail button carries the tier NAME (not a number) so the climb is present
  // on the world surface at a glance, and the sheet is where the detail lives.
  function syncPill() {
    if (!_btn) return;
    var pill = _btn.querySelector('.asc-pill');
    if (!pill) return;
    // A guest has no standing, and a killed ladder (server ASCENT=0) has no tier
    // to name — in both cases the pill says nothing rather than lying.
    var off = isGuest() || !_climb || _climb.on === false || !_climb.tier;
    if (off) { pill.style.display = 'none'; pill.textContent = ''; return; }
    pill.style.display = 'flex';
    pill.textContent = String(_climb.tier.title || _climb.tier.key || '');
    // the launcher's light follows the rung you stand on
    var r = rungOf(_climb.tier.key);
    try {
      _btn.style.borderColor = r.c.replace(/^#/, 'rgba(').length ? _rgba(r.c, 0.34) : '';
      var dot = _btn.querySelector('.dot');
      if (dot) { dot.style.background = r.c; dot.style.boxShadow = '0 0 8px ' + r.c; }
    } catch (_) {}
    // the pill just changed width — the rail measures its own launchers, so ask
    // it to re-measure rather than assuming the band still fits.
    try { if (W.DirverseHUD && W.DirverseHUD.relayout) W.DirverseHUD.relayout(); } catch (_) {}
  }

  // #rrggbb → rgba(r,g,b,a). Only ever called with our own RUNGS colours.
  function _rgba(hex, a) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h.slice(0, 6), 16);
    if (!isFinite(n)) return 'rgba(255,212,121,' + a + ')';
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE SHEET
  // ═══════════════════════════════════════════════════════════════════════════
  function buildSheet() {
    if (_sheet) return _sheet;
    var el = document.createElement('div');
    el.id = 'ascSheet';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'the ascent');
    el.innerHTML =
      '<div class="asc-grip"></div>' +
      '<div class="asc-head">' +
        '<div class="asc-title">the ascent<small>what this world remembers you doing</small></div>' +
        '<button class="asc-x" id="ascX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="asc-body" id="ascBody"></div>';
    document.body.appendChild(el);
    _sheet = el;
    el.querySelector('#ascX').onclick = close;
    grip(el);
    return el;
  }

  // ── the drag-down-to-dismiss grip (matches the dv-sheet gesture exactly) ────
  function grip(sheet) {
    var g = sheet.querySelector('.asc-grip'); if (!g) return;
    var y0 = 0, dy = 0, dragging = false;
    function start(e) {
      dragging = true; y0 = (e.touches ? e.touches[0].clientY : e.clientY); dy = 0;
      sheet.style.transition = 'none';
    }
    function move(e) {
      if (!dragging) return;
      var y = (e.touches ? e.touches[0].clientY : e.clientY);
      dy = Math.max(0, y - y0);
      sheet.style.transform = 'translateY(' + dy + 'px)';
    }
    function end() {
      if (!dragging) return;
      dragging = false; sheet.style.transition = ''; sheet.style.transform = '';
      if (dy > 90) close();
    }
    g.addEventListener('touchstart', start, { passive: true });
    g.addEventListener('touchmove', move, { passive: true });
    g.addEventListener('touchend', end);
    g.addEventListener('mousedown', function (e) {
      start(e);
      var mm = function (ev) { move(ev); };
      var mu = function () { end(); removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); };
      addEventListener('mousemove', mm); addEventListener('mouseup', mu);
    });
  }

  // The ascent's sheet is another position:fixed bottom:0 z-1600 surface, so it
  // opens THROUGH the HUD's sheet owner — which closes whatever else is up
  // first. Without that hand-off, ✶ over ♔ would put two full sheets on
  // identical pixels. If the HUD isn't there (used standalone), open directly:
  // there is no rail and no sibling sheet, so there is nothing to collide with.
  function raise(fn) {
    var hud = W.DirverseHUD;
    if (hud && typeof hud.openSheet === 'function') hud.openSheet('ascent', fn);
    else fn();
  }

  function open() {
    injectStyles();
    raise(function () {
      buildSheet();
      _sheet.classList.add('open');
      render();
      // always refresh on open: this is the surface whose whole job is being
      // TRUE, and the player opened it to see where they actually stand.
      load(true);
    });
  }

  function close() {
    if (_sheet) _sheet.classList.remove('open');
    var hud = W.DirverseHUD;
    if (hud && typeof hud.syncSheets === 'function') hud.syncSheets();
  }

  function isOpen() { return !!_sheet && _sheet.classList.contains('open'); }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — every field read off the server's object, nothing derived
  // ═══════════════════════════════════════════════════════════════════════════
  function render() {
    syncPill();
    var body = _sheet && _sheet.querySelector('#ascBody');
    if (!body) return;

    if (_state === 'guest') { body.innerHTML = doorwayHTML(); wireDoorway(body); return; }
    if (_state === 'loading' && !_climb) {
      body.innerHTML = '<div class="asc-msg">reading what the world remembers…</div>';
      return;
    }
    if (_state === 'error' && !_climb) {
      body.innerHTML = '<div class="asc-msg">the world cannot recall your standing right now.<br>' +
        'nothing is lost — it will remember when it reaches you again.</div>';
      return;
    }
    if (!_climb) { body.innerHTML = '<div class="asc-msg">reading what the world remembers…</div>'; return; }

    // THE LADDER IS OFF (server ASCENT=0). Say it plainly, claim nothing, and
    // never render a dead ask — the kill switch must leave a coherent surface.
    if (_climb.on === false) {
      body.innerHTML = '<div class="asc-msg">the clearing is not keeping count right now.<br>' +
        'build anyway — everything you do here is still remembered.</div>';
      return;
    }

    var t = _climb.tier || {};
    var o = _climb.objective || null;
    var nx = _climb.next || null;
    var lw = _climb.longWork || null;
    var r = rungOf(t.key);

    var html = '';

    // ── WHERE YOU STAND ──────────────────────────────────────────────────────
    html +=
      '<div class="asc-standing" style="--asc-c:' + esc(r.c) + ';--asc-g:' + esc(r.glow) +
        ';--asc-b:' + esc(_rgba(r.c, 0.3)) + '">' +
        '<div class="asc-srow">' +
          '<div class="asc-glyph">' + esc(r.g) + '</div>' +
          '<div class="asc-sid">' +
            '<div class="asc-skick">you stand as</div>' +
            '<div class="asc-sname">' + esc(t.title || t.key || 'a traveler') + '</div>' +
          '</div>' +
          '<div class="asc-snum"><b>' + num(_climb.standing, 0) + '</b>standing</div>' +
        '</div>' +
        (t.line ? '<div class="asc-sline">' + esc(t.line) + '</div>' : '') +
        // THE PERMANENCE PROMISE — the ascent's counterpart to the vigil's floor.
        // The two systems compose, and the player should be told so in one line:
        // your light can dim, your standing cannot.
        (_climb.permanent
          ? '<div class="asc-perm"><i>✧</i><span>this is permanent. the light in your clearing ' +
            'rises and dims — what you have done here never does.</span></div>'
          : '') +
      '</div>';

    // ── THE NEXT THING (the acceptance criterion) ────────────────────────────
    // `objective` is guaranteed non-null by the server while the ladder is on, at
    // every standing including minute zero. We still guard, because a surface
    // that trusts a promise it cannot enforce is a surface that renders blank.
    if (o) {
      var terminal = !!o.terminal;
      var pct = Math.max(0, Math.min(1, num(o.pct, 0)));
      html +=
        '<div class="asc-next">' +
          '<div class="asc-nkick">' + (terminal ? 'the work that does not end' : 'your next rung') + '</div>' +
          '<div class="asc-nsay">' + esc(o.say || o.name || '') + '</div>';

      // THE DISTANCE. Named on the left, counted on the right, never merged into
      // the sentence — "how far am I" must be answerable at a glance.
      if (!terminal) {
        html +=
          '<div class="asc-nfar">' +
            '<span class="fl">' + esc(o.name || 'the next rung') + '</span>' +
            '<span class="fr">' + esc(o.far || '') + '</span>' +
          '</div>' +
          '<div class="asc-bar"><div class="asc-barfill" style="width:' +
            (pct * 100).toFixed(1) + '%"></div></div>' +
          // have/want, stated exactly as the server counts it
          '<div class="asc-nfar"><span class="fl">' +
            esc(num(o.have, 0) + ' of ' + num(o.want, 0) + ' ' + (o.unit || 'standing')) +
          '</span><span class="fr">' + Math.round(pct * 100) + '%</span></div>';
      } else {
        html += '<div class="asc-nfar"><span class="fl">' + esc(o.far || '') + '</span></div>';
      }

      // WHAT IT OPENS — the promise, in the world's own words.
      if (!terminal && nx && nx.opens) {
        html += '<div class="asc-opens"><b>' + esc(nx.title || 'the next rung') + '</b> opens ' +
          esc(nx.opens) + '</div>';
      }

      // THE ACT — one tap to the surface where the named deed is actually done.
      // Only rendered when we can route the act honestly; a button that goes
      // nowhere is worse than no button.
      var route = actRoute(o.act);
      if (route) {
        html += '<button class="asc-act" id="ascAct">' + esc(route.label) + '</button>';
      }
      html += '</div>';
    }

    // ── THE LADDER ───────────────────────────────────────────────────────────
    if (Array.isArray(_climb.ladder) && _climb.ladder.length) {
      html += '<div class="asc-sec">the climb</div><div class="asc-ladder">';
      for (var i = 0; i < _climb.ladder.length; i++) {
        var rg = _climb.ladder[i] || {};
        var rr = rungOf(rg.key);
        var cls = rg.at ? 'asc-rung at reached' : (rg.reached ? 'asc-rung reached' : 'asc-rung locked');
        html +=
          '<div class="' + cls + '" style="--rc:' + esc(rr.c) + '">' +
            '<span class="rg">' + esc(rr.g) + '</span>' +
            '<span class="rn">' + esc(rg.title || rg.key || '') + '</span>' +
            '<span class="rv">' + (rg.at ? 'you are here'
              : (rg.reached ? 'stood' : num(rg.need, 0) + ' standing')) + '</span>' +
          '</div>';
      }
      html += '</div>';
    }

    // ── THE LONG WORK ────────────────────────────────────────────────────────
    // Rendered as an inscription being uncovered. Never a completion meter: no
    // "4 of 6", no bar, no percentage — because the moment this reads as a
    // checklist, the open loop closes and the whole point of it dies.
    if (lw && lw.present) {
      var lines = Array.isArray(lw.lines) ? lw.lines : [];
      var revealed = num(lw.revealed, lines.length);
      var total = num(lw.total, lines.length);
      var left = Math.max(0, total - revealed);
      html +=
        '<div class="asc-sec">the stone in your clearing</div>' +
        '<div class="asc-stone">' +
          '<div class="asc-stonek">the long work</div>' +
          '<div class="asc-lines">';
      for (var k = 0; k < lines.length; k++) {
        var ln = lines[k] || {};
        html += '<div class="asc-ln' + (ln.read ? '' : ' unread') + '">' + esc(ln.line || '') + '</div>';
      }
      html += '</div>';
      // what is still illegible — said as marks on a stone, never as a count of
      // rewards outstanding.
      if (left > 0) {
        html += '<div class="asc-more">' +
          (left === 1
            ? 'one more line runs beneath these. the marks are there; you cannot read them yet.'
            : 'more lines run beneath these — the marks are there, and they are not yet in a hand you know.') +
          '</div>';
      }
      // THE ASK — the question this rung leaves hanging. There is one at every
      // rung including the last, which is the whole design.
      if (lw.ask) html += '<div class="asc-ask">' + esc(lw.ask) + '</div>';
      html += '</div>';
    }

    body.innerHTML = html;

    var act = body.querySelector('#ascAct');
    if (act && o) {
      var rt = actRoute(o.act);
      if (rt) act.onclick = function () { rt.go(); };
    }
  }

  // ── THE ACT ROUTES ──────────────────────────────────────────────────────────
  // `objective.act` names the VERB the server chose; this maps it to the surface
  // where that verb actually happens. Every route is checked for existence at
  // click time (not at render), so a module that hasn't mounted yet never
  // produces a dead button — it produces an honest toast instead.
  function actRoute(act) {
    switch (act) {
      case 'claim':
        return { label: '⌂ claim your hearth', go: function () {
          close();
          try { if (W.VintinuumWorld && W.VintinuumWorld.claimHere) { W.VintinuumWorld.claimHere(); return; } } catch (_) {}
          say('walk to where you want to live, then claim your hearth.');
        } };
      case 'place':
        return { label: '▥ open the build palette', go: function () {
          close();
          try { var b = document.getElementById('dvBuildBtn');
            if (b && b.style.display !== 'none') { b.click(); return; } } catch (_) {}
          try { var wb = document.getElementById('whBuild'); if (wb) { wb.click(); return; } } catch (_) {}
          say('stand in your own clearing to build.');
        } };
      case 'tend':
        return { label: '✦ tend your court', go: function () {
          close();
          try { var t = document.getElementById('whTend'); if (t) { t.click(); return; } } catch (_) {}
          try { if (W.VintCourt && W.VintCourt.open) { W.VintCourt.open('roster'); return; } } catch (_) {}
          say('bring an agent into your court first.');
        } };
      case 'court':
        return { label: '♔ bring an agent into your court', go: function () {
          close();
          try { if (W.VintCourt && W.VintCourt.open) { W.VintCourt.open('add'); return; } } catch (_) {}
          try { var c = document.getElementById('ctBtn'); if (c) { c.click(); return; } } catch (_) {}
          say('your court is not open yet.');
        } };
      case 'travel':
        return { label: '✦ open the star-map', go: function () {
          close();
          try { if (W.DirverseHUD && W.DirverseHUD.open) { W.DirverseHUD.open(); return; } } catch (_) {}
          say('the star-map is out of reach right now.');
        } };
      case 'refine':
        return { label: '✦→◇ refine your echo', go: function () {
          close();
          try { if (W.VintinuumWorld && W.VintinuumWorld.refine) { W.VintinuumWorld.refine(); return; } } catch (_) {}
          say('harvest some echo first.');
        } };
      // `share` (hosting a visitor) has NO route on purpose: the player cannot
      // make a stranger walk in. Rendering a button for it would be a button
      // that does nothing, which is a lie in a surface built on honesty. The
      // objective still NAMES it — the sentence is the whole ask.
      default: return null;
    }
  }

  // speak through the ONE shared toast (two toast nodes at one anchor would
  // stack on each other — the no-collision law forbids it).
  function say(msg) {
    try { if (W.DirverseHUD && W.DirverseHUD.toast) { W.DirverseHUD.toast(msg); return; } } catch (_) {}
    try { console.info('[ascent]', msg); } catch (_) {}
  }

  // ── THE GUEST DOORWAY — what standing IS, and the way in. Never a wall. ─────
  function doorwayHTML() {
    return '<div class="asc-door">' +
      '<div class="dh">the world remembers what you build in it.</div>' +
      '<div class="ds">every hearth set, every wall raised, every clearing you walk ' +
        'into — the world keeps count, and it never forgets. claim a clearing and it ' +
        'starts keeping yours.</div>' +
      '<button class="da" id="ascDoor">✦ claim your clearing</button>' +
      '</div>';
  }
  function wireDoorway(body) {
    var b = body.querySelector('#ascDoor');
    if (!b) return;
    b.onclick = function () {
      try {
        if (W.VintWelcomeGate && W.VintWelcomeGate.open) { W.VintWelcomeGate.open('signup'); return; }
        if (W.__vintOpenSignin) { W.__vintOpenSignin(); return; }
      } catch (_) {}
      location.href = 'welcome.html';
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE ASCENSION — the moment a rung is crossed, given its own beat
  // ═══════════════════════════════════════════════════════════════════════════
  // Standing is permanent and rungs are rare (a retuned ladder promotes four
  // times across three sessions and then goes quiet for weeks), so a crossing is
  // never a toast. It takes the screen, names what you became, says what opened,
  // and reveals the new line of the stone in the same breath — then gets out of
  // the way. Once per load, always dismissible three ways.
  var _roseEl = null;

  function showRose(c) {
    if (_seenRose || !c || !c.tier) return;
    // NEVER two cards at once. world-hud's homecoming is also a 1610 modal, and
    // an arrival frame can carry both (you came back AND the reconcile crossed a
    // rung). The homecoming is the arrival's moment and owns the screen first;
    // we wait for it and take our turn after. Polled rather than evented because
    // the homecoming is another module's lifecycle and we do not reach into it.
    try {
      var hw = document.getElementById('whHomeWrap');
      if (hw && hw.classList.contains('show')) {
        setTimeout(function () { showRose(c); }, 900);
        return;
      }
    } catch (_) {}
    _seenRose = true;

    var t = c.tier, r = rungOf(t.key);
    if (!_roseEl) {
      _roseEl = document.createElement('div');
      _roseEl.id = 'ascRoseWrap';
      _roseEl.setAttribute('role', 'dialog');
      _roseEl.setAttribute('aria-modal', 'true');
      _roseEl.setAttribute('aria-label', 'you have risen');
      _roseEl.innerHTML =
        '<div id="ascRoseCard">' +
          '<div class="rb">' +
            '<div class="rglyph" id="ascRoseG">✦</div>' +
            '<div class="rkick">the clearing knows you differently now</div>' +
            '<div class="rname" id="ascRoseN"></div>' +
            '<div class="rline" id="ascRoseL"></div>' +
            '<div class="ropen" id="ascRoseO"></div>' +
            '<div class="rstone" id="ascRoseS"></div>' +
          '</div>' +
          '<div class="rfoot"><button class="rgo" id="ascRoseGo">stand up</button></div>' +
        '</div>';
      document.body.appendChild(_roseEl);
      _roseEl.querySelector('#ascRoseGo').onclick = hideRose;
      // scrim tap dismisses; a tap INSIDE the card must not (the card is a child,
      // so we only close when the wrap itself was the target).
      _roseEl.addEventListener('click', function (e) { if (e.target === _roseEl) hideRose(); });
    }

    var card = _roseEl.querySelector('#ascRoseCard');
    card.style.setProperty('--asc-c', r.c);
    card.style.setProperty('--asc-g', r.glow);
    card.style.setProperty('--asc-b', _rgba(r.c, 0.32));
    _roseEl.querySelector('#ascRoseG').textContent = r.g;
    _roseEl.querySelector('#ascRoseN').textContent = t.title || t.key || '';
    _roseEl.querySelector('#ascRoseL').textContent = t.line || '';

    // WHAT OPENED. The tier's `verb` is the door this rung unlocked, said in the
    // world's own words. We deliberately do NOT list piece kinds here: `tier.kinds`
    // is CUMULATIVE (everything you can place, not what just arrived), so printing
    // it at a crossing would claim you just earned the wall you have had since
    // minute one. The sheet's `next.kinds` is the non-cumulative list and that is
    // where the promise belongs; the moment itself gets the verb or nothing.
    // Hidden entirely when a tier grants no new verb — never an empty box.
    var ob = _roseEl.querySelector('#ascRoseO');
    if (t.verb) {
      ob.innerHTML = '<b>opened:</b> ' + esc(t.verb);
      ob.style.display = '';
    } else {
      ob.style.display = 'none';
    }

    // THE NEW LINE OF THE STONE — the open loop, revealed in the same breath.
    var sb = _roseEl.querySelector('#ascRoseS');
    var lw = c.longWork || {};
    var lines = Array.isArray(lw.lines) ? lw.lines : [];
    var newest = null;
    for (var i = lines.length - 1; i >= 0; i--) { if (lines[i] && lines[i].read) { newest = lines[i]; break; } }
    if (newest) {
      sb.innerHTML = '<i>another line comes clear</i>' + esc(newest.line || '');
      sb.style.display = '';
    } else {
      sb.style.display = 'none';
    }

    try { requestAnimationFrame(function () { _roseEl.classList.add('show'); }); }
    catch (_) { _roseEl.classList.add('show'); }
    document.addEventListener('keydown', _roseKey);
  }

  function _roseKey(e) { if (e.key === 'Escape') hideRose(); }

  function hideRose() {
    if (!_roseEl) return;
    _roseEl.classList.remove('show');
    document.removeEventListener('keydown', _roseKey);
    // display:none once faded, so it holds no pixels and eats no taps
    setTimeout(function () { try { if (_roseEl) _roseEl.style.display = ''; } catch (_) {} }, 520);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WIRING — refresh off the SAME signals the vigil HUD already uses
  // ═══════════════════════════════════════════════════════════════════════════
  // No polling loop. Standing only changes when a DEED happens, and every deed
  // already fires a world event that world-hud.js listens to. We ride the same
  // rails: a deed lands → re-read (fresh, because the server's memo was just
  // invalidated by the same act). Coalesced so a burst of placements is one read.
  var _refreshT = null;
  function refreshSoon(fresh) {
    clearTimeout(_refreshT);
    _refreshT = setTimeout(function () { load(fresh !== false); }, 700);
  }

  // the deed events. Each of these is a thing the ascent counts, so each one can
  // move the number: a structure placed, a court tended, echo refined, a world
  // entered, the arrival frame itself (which reconciles a legacy resident).
  W.addEventListener('vint:world-struct', function () { refreshSoon(true); });
  W.addEventListener('vint:world-tend', function () { refreshSoon(true); });
  W.addEventListener('vint:world-refine', function () { refreshSoon(true); });
  W.addEventListener('vint:world-travel', function () { refreshSoon(true); });
  // the arrival frame: read once, unfresh (the server just reconciled on hello,
  // so its memo is warm and correct — asking fresh would be a wasted round trip).
  W.addEventListener('vint:world-state', function () {
    if (_state === 'idle') load(false);
    else refreshSoon(false);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MOUNT
  // ═══════════════════════════════════════════════════════════════════════════
  function mount() {
    if (!enabled()) return;
    injectStyles();

    var hud = W.DirverseHUD;
    // THE RAIL OWNS THE GEOMETRY. addLauncher is the ONLY sanctioned way to put
    // a button in that column — it allocates the slot and re-measures the band.
    // Without the HUD there is no rail to join, and we do NOT invent a fixed
    // button of our own (that is exactly how the DirHaven door once landed on
    // top of the build launcher). No rail, no launcher; the sheet is still fully
    // reachable through the public API.
    if (hud && typeof hud.addLauncher === 'function') {
      if (typeof hud.registerSheet === 'function') {
        hud.registerSheet('ascent', isOpen, close);
      }
      _btn = hud.addLauncher('ascBtn', 'ascent', '✶', function () { open(); });
      if (_btn && !_btn.querySelector('.asc-pill')) {
        var pill = document.createElement('span');
        pill.className = 'asc-pill';
        pill.style.display = 'none';
        _btn.appendChild(pill);
      }
    }

    // a first read so the launcher's pill is true before anything is opened
    load(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  W.VintAscent = {
    open: open,
    close: close,
    isOpen: isOpen,
    mount: mount,
    refresh: function (fresh) { load(fresh !== false); },
    // the last picture the brain sent, for another surface that wants to read
    // the tier without making its own request
    climb: function () { return _climb; },
    // exposed so the moment can be replayed deliberately (or tested)
    showRose: showRose,
    hideRose: hideRose
  };
})();
