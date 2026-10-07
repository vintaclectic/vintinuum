// ═══════════════════════════════════════════════════════════════════════════
// DIRVERSE HUD — the WARP star-map, the AGENT ventures panel, the BUILD palette.
// AETHERHOLD (Gen-1 world-forger), 2026-07-05. Sits ON TOP of the First-Hearth
// WorldHUD (world-hud.js) — it never touches that module; it adds the universe
// layer: leaving the clearing to travel the star-map, sending agents to work for
// real profit/loss, and a richer build strip on your own world.
//
// THE MOMENT (Buffet's one line): the WARP. Tap a beacon → the world dollies
// out, stars streak in, and 2s later you are standing in a stranger's world.
// Not a page-load. Not a URL. A journey.
//
// LAWS honored: mobile-first (375/768), no overflow/overlap/underflow (every
// surface clips to viewport + scrolls internally), all launcher buttons
// draggable (data-draggable), server-authoritative (client sends intent only;
// never asserts a balance), feature-flagged (const DIRVERSE + ?dirverse=1).
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.DirverseHUD) return;

  var W = window;
  function world() { return W.VintinuumWorld; }
  function base() { return (W.__VINTINUUM_API_BASE || '').replace(/\/$/, ''); }
  function token() { try { return localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token'); } catch (_) { return null; } }
  function authHeaders() { var t = token(); return t ? { Authorization: 'Bearer ' + t } : {}; }

  // ── feature flag (Vinta directive: flag every new surface, killable in 30s) ──
  var DIRVERSE_DEFAULT = true; // shipping on tonight; flip false to hard-kill
  function enabled() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('dirverse') === '0') return false;
      if (q.get('dirverse') === '1') return true;
    } catch (_) {}
    return DIRVERSE_DEFAULT;
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ── the ~15 build prop kinds (the palette on your own world) ─────────────────
  // First 5 match the server-rendered kinds in world-client (_renderStruct); the
  // rest are forge-props the server accepts as generic placements. Glyph + label.
  var PROPS = [
    { k: 'wall',    g: '▥', n: 'wall' },
    { k: 'floor',   g: '▦', n: 'floor' },
    { k: 'light',   g: '✦', n: 'light' },
    { k: 'shelf',   g: '▤', n: 'shelf' },
    { k: 'pillar',  g: '❘', n: 'pillar' },
    { k: 'arch',    g: '⌒', n: 'arch' },
    { k: 'door',    g: '⊓', n: 'door' },
    { k: 'window',  g: '⊞', n: 'window' },
    { k: 'stair',   g: '⋰', n: 'stair' },
    { k: 'roof',    g: '△', n: 'roof' },
    { k: 'fence',   g: '⊪', n: 'fence' },
    { k: 'planter', g: '❦', n: 'planter' },
    { k: 'lantern', g: '❂', n: 'lantern' },
    { k: 'banner',  g: '⚑', n: 'banner' },
    { k: 'beacon',  g: '❈', n: 'beacon' }
  ];

  var AGENTS = [
    { id: 'presence-sovereign',        n: 'VINTINUUM', c: '#ffd89a' },
    { id: 'presence-structural',       n: 'ATLAS',     c: '#9fc4e6' },
    { id: 'presence-warm',             n: 'ARIA',      c: '#ffc79a' },
    { id: 'presence-child-refractive', n: 'LUNEX',     c: '#9ae0d0' },
    { id: 'presence-child-electric',   n: 'AETHERHOLD',c: '#ffaad8' }
  ];

  // ── AGENTIS: the user's OWN brought-in agents (source → the name they know) ──
  var SOURCE_NAMES = {
    claude: 'Claude', openai: 'ChatGPT', chatgpt: 'ChatGPT', gpt: 'ChatGPT',
    gemini: 'Gemini', agentis: 'Agentis', grok: 'Grok', api: 'an API',
    prompt: 'a prompt', custom: 'yours', import: 'imported', other: 'elsewhere'
  };
  // the roster, as the world last saw it. Fetched from /api/agents/mine.
  var _mine = [], _mineState = 'idle'; // idle|loading|ok|guest|error

  var KINDS = [
    { k: 'trade',   n: 'TRADE',   sub: 'buy low, sell high · volatile',        odds: 'high risk · high yield' },
    { k: 'work',    n: 'WORK',    sub: 'steady labor · reliable',              odds: 'low risk · low yield' },
    { k: 'explore', n: 'EXPLORE', sub: 'chart the dark · find or find nothing', odds: 'wildcard · rare jackpots' }
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // STYLES — one injected sheet, scoped to #dv-* ids/classes so it can't leak.
  // ═══════════════════════════════════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('dv-styles')) return;
    var s = document.createElement('style');
    s.id = 'dv-styles';
    s.textContent = [
      // launcher buttons — flow children of #dvRail (NOT fixed; the rail is the one
      // fixed box that owns their space). ≥46px tall = the touch-target floor.
      '.dv-launch{position:relative;min-height:46px;min-width:46px;padding:0 14px;',
      ' border-radius:23px;font-family:"Cormorant Garamond",Georgia,serif;letter-spacing:.02em;',
      // clamp, never a fixed px: the name must stay readable at 320px and must
      // never be the thing that gets deleted to win a measurement (see the
      // comment on makeLauncher). 12.4px is the floor and it is a deliberate
      // floor — below that the name stops being legible at arm's length, and an
      // illegible name is the same defect as a missing one wearing a disguise.
      ' font-size:clamp(12.4px,1.05vw + 10.2px,14px);',
      ' color:#cfe8ff;background:rgba(8,12,20,0.72);border:1px solid rgba(124,207,255,0.34);',
      ' backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);cursor:pointer;',
      ' display:flex;align-items:center;gap:7px;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.35);}',
      '.dv-launch:active{transform:scale(0.96);}',
      '.dv-launch .dot{flex:0 0 auto;width:7px;height:7px;border-radius:50%;background:#4fc3f7;box-shadow:0 0 8px #4fc3f7;}',
      // THE GLYPH — its own box, and it is never hidden by any rule in this file.
      // flex:0 0 auto so a long name can never squeeze the identity mark away.
      '.dv-launch .gly{flex:0 0 auto;font-size:1.07em;line-height:1;}',
      // THE NAME — allowed to shrink, allowed to ellipsize, NEVER allowed to
      // vanish. min-width:0 is load-bearing: without it a flex item refuses to
      // shrink below its content width and the pill would blow out of the rail
      // instead of the text ellipsizing (the single commonest cause of a flex
      // child overflowing its parent).
      '.dv-launch .lbl{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      // ── THE RAIL (NO-COLLISION LAW) ────────────────────────────────────────
      // Was: four buttons each pinned by its own hardcoded `bottom:` (150/206/262/
      // 318px). That stack is only safe while the count and the button height are
      // both frozen — add a 4th and a short viewport (375x667, or ANY landscape
      // phone) drives the top of the stack straight into #vintWorldHud, which is a
      // 228px-wide panel pinned top-left at 64px. Two fixed elements, same pixels.
      //
      // Now: ONE fixed flex column anchored at the bottom, growing UPWARD, with a
      // hard `max-height` that reserves the WorldHUD's band (64px top + its height)
      // plus the saybar's band. The column can never reach the panel because it is
      // not allowed to be tall enough to, at any viewport. If more launchers ever
      // land than fit, the rail scrolls INSIDE itself (overflow-y:auto) rather than
      // spilling upward onto the panel — the container yields, never the neighbour.
      '#dvRail{position:fixed;z-index:1450;display:flex;flex-direction:column-reverse;',
      ' align-items:flex-start;gap:10px;',
      ' left:calc(12px + env(safe-area-inset-left,0px));',
      // --dv-railbot is the clearance the saybar needs (measured live, 150px default).
      ' bottom:calc(var(--dv-railbot,150px) + env(safe-area-inset-bottom,0px));',
      // top of the rail can never cross the WorldHUD band. --dv-railtop is measured
      // live from the real panel (see layoutRail); 270px is the safe static floor.
      // min-height keeps ONE launcher always reachable even on a landscape phone —
      // a rail squeezed to 0 height is a dead control, which is its own failure.
      ' min-height:46px;',
      ' max-height:calc(100dvh - var(--dv-railtop,270px) - var(--dv-railbot,150px) - env(safe-area-inset-bottom,0px));',
      ' overflow-y:auto;overflow-x:hidden;scrollbar-width:none;overscroll-behavior:contain;',
      ' pointer-events:none;}',
      '#dvRail::-webkit-scrollbar{display:none;}',
      // the buttons themselves are static-in-flow inside the rail (NOT fixed), so
      // they can only ever occupy the rail's own box.
      '#dvRail .dv-launch{position:relative;left:auto;right:auto;top:auto;bottom:auto;',
      ' flex:0 0 auto;pointer-events:auto;}',
      '#dvWarpBtn{color:#e6d4ff;border-color:rgba(206,147,216,0.4);}',
      '#dvWarpBtn .dot{background:#ce93d8;box-shadow:0 0 8px #ce93d8;}',
      '#dvHomeBtn{color:#ffe2a0;border-color:rgba(255,212,121,0.4);}',
      '#dvHomeBtn .dot{background:#ffd479;box-shadow:0 0 8px #ffd479;}',
      // very short viewports (landscape phones): TIGHTEN the pills — but the name
      // stays. This rule used to read `.lbl{display:none}` and it was the first
      // of the three that between them made the rail unreadable (see makeLauncher's
      // comment for the 425/544 measurement). A landscape phone is still a phone:
      // it has no hover, so a glyph-only pill there is strictly less identifiable
      // than on desktop, which is the opposite of what this rule was trying to do.
      '@media(max-height:560px){#dvRail .dv-launch{padding:0 10px;gap:5px;',
      ' font-size:clamp(11.8px,2.6vw,13px);}',
      ' #dvRail .dv-launch .lbl{max-width:12ch;}}',
      // ── THE COMPACT RAIL — capacity, measured, not guessed (2026-08-07) ──────
      // The media query above compacts on VIEWPORT HEIGHT, which was a proxy for
      // the real constraint and has now been outgrown by it. The true constraint
      // is COUNT vs. BAND: at 320x568 with seven launchers the column needs 438px
      // of a 268px band, and because the rail is column-reverse the surplus clips
      // off the TOP — measured, the last launcher mounted rendered at top:-20 with
      // NO sheet open at all, and with a sheet up four of them sat at negative
      // coordinates. A launcher above the fold of its own scroll box is a dead
      // control, which this file's own squeeze comment already names as being as
      // bad as an overlapping one.
      //
      // So layoutRail measures whether the column fits and, when it does not,
      // sets these classes in escalating order — labels first (the label is a
      // convenience; the glyph is the identity), then the gap, then the padding.
      // Each step is a CONTAINER yielding its own content, never a neighbour
      // yielding its space, which is the only compaction the law permits.
      // ── WHAT COMPACTION IS ALLOWED TO TAKE (rewritten 2026-09-25) ───────────
      // It used to take the LABEL — `display:none` — on the stated reasoning that
      // "the label is a convenience; the glyph is the identity". Two things were
      // wrong with that, and both are measured rather than argued:
      //
      //  1. THE GLYPH WAS INSIDE THE LABEL. `<span class="lbl">✦ star-map</span>`
      //     — so hiding the label hid the identity too. The compacted pill was
      //     empty: 46×46px of nothing but the 7px status dot. Measured in
      //     Chromium, 425 of 544 (viewport × state × launcher) combinations
      //     rendered a launcher with NO visible text whatsoever.
      //  2. "CONVENIENCE" ASSUMED A HOVER. The only thing identifying a compacted
      //     pill was its `title=`, and a touch device never shows a title. So on
      //     the exact devices where compaction ALWAYS fires (a phone: 17 launchers
      //     cannot fit any phone band uncompacted) the rail was a column of
      //     identical unlabeled circles. That is Vinta's report verbatim: "the
      //     buttons are hidden without hovering tooltips to see which buttons are
      //     which what does what."
      //
      // So compaction now takes TYPE SIZE and PADDING, never the name. The name
      // is the only thing that answers "what does this do", and it is therefore
      // the last thing that may be spent, not the first. The ladder still
      // escalates and each step still measures — it just buys its pixels from the
      // container's own whitespace instead of from the user's comprehension.
      // The height floor (42px) is unchanged; it remains the honest touch target.
      'body.dv-rail-compact #dvRail .dv-launch{padding:0 10px;gap:5px;',
      ' font-size:clamp(11.8px,2.6vw,13px);}',
      'body.dv-rail-compact #dvRail .dv-launch .lbl{max-width:11ch;}',
      'body.dv-rail-tight #dvRail{gap:6px;}',
      'body.dv-rail-tight #dvRail .dv-launch{padding:0 8px;gap:4px;min-height:42px;height:42px;',
      ' font-size:clamp(11.2px,2.4vw,12.4px);}',
      // the tightest honest form still names itself: 8 characters is enough to
      // separate every launcher in the roster from every other one (measured
      // against the real 17-launcher roster — no two names collide at 8 chars),
      // and the ellipsis tells the user the name continues rather than pretending
      // it was never there.
      'body.dv-rail-tight #dvRail .dv-launch .lbl{max-width:8ch;}',
      'body.dv-rail-tight #dvRail .dv-launch{padding:0 9px;min-height:42px;height:42px;}',
      // ── TOUCH LEGIBILITY — never hide what a control IS on a coarse pointer ───
      // (Vinta directive 2026-09-26). A touch device has NO hover, so a glyph-only
      // pill is an unidentifiable control — the exact "which button is which, what
      // does what?" failure Vinta named on mobile. So on coarse pointers the LABEL
      // ALWAYS shows, overriding every glyph-only compaction above (the short-
      // viewport media query at max-height:560px AND the .dv-rail-compact /
      // .dv-rail-tight classes). Identity is never hidden on a device that cannot
      // reveal it on hover. The rail still cannot collide: it yields to overflow by
      // SCROLLING inside its measured band (layoutRail skips glyph-only compaction
      // on coarse — see the `!_coarse` guard there), never by hiding a control or
      // spilling onto a neighbour. Desktop keeps hover + the title tooltip as
      // extras, never the only path. The geometry is forced (!important) so a
      // stray compact/tight class can never shrink a touch target below 46px.
      'body.dv-coarse #dvRail .dv-launch .lbl{display:inline !important;}',
      // a WRAPPED rail on touch buys its columns from the pill's own padding,
      // never from its height or its name: 10px sides instead of 14 keep ~8px
      // more of every name visible inside the bounded column (GEJ8NYU).
      'body.dv-coarse.dv-rail-wrap #dvRail .dv-launch{padding:0 10px !important;gap:5px !important;}',
      'body.dv-coarse #dvRail .dv-launch{min-height:46px !important;height:auto !important;',
      ' padding:0 14px !important;gap:7px !important;}',
      // ── THE SECOND COLUMN — when compaction is not enough, use the WIDTH ─────
      // Compaction has a floor: eight glyph-only launchers at the 42px minimum
      // touch target still need 378px, and a 320x568 phone's rail band is 268px.
      // Measured, that is not a styling problem, it is a CAPACITY problem — the
      // column is asking for more vertical room than the viewport has to give.
      //
      // But the rail is a 46px-wide strip against the left edge of a 320px
      // screen. The space it needs is sitting unused directly beside it. So at
      // the last step the rail wraps into a second column: still one measured
      // container, still flow children, still bounded — it simply grows the way
      // the viewport actually has room to grow. column-reverse + wrap-reverse
      // keeps the newest launcher nearest the thumb and fills upward, which is
      // the same reading order the single column already had.
      //
      // TWO THINGS MEASURED THE HARD WAY, both recorded so nobody re-derives them:
      //
      //  1. THE WRAP DIRECTION. `wrap-reverse` was the obvious pairing with
      //     column-reverse (it keeps the newest launcher nearest the thumb) and
      //     it is WRONG here: it grows the new column to the LEFT, and the rail
      //     is already flush against the left edge, so the second column landed
      //     at x=-70 — entirely off-screen, four launchers unhittable (measured:
      //     `elementFromPoint` at their centres returned null). Plain `wrap`
      //     grows RIGHT, into the empty middle of the screen, which is where the
      //     room actually is. The reading order costs nothing next to a button
      //     that exists.
      //
      //  2. THE CEILING. A wrapped rail is only half as tall, so `bottom`-
      //     anchored it climbs no higher than before — but the SQUEEZE can drag
      //     --dv-railtop up toward the viewport top when a sheet is open, and at
      //     320x568 that put the wrapped column's top edge at y=23, straight
      //     through #leave (the ↩ link, top 14..58, z1600). #leave is a primary
      //     navigation control and does NOT yield. So the wrapped rail declares
      //     its own hard ceiling below it: the link's band plus a gutter, via
      //     max(), so it can only ever LOWER the rail's reach, never raise it
      //     past what layoutRail already decided.
      //
      // The width is capped so the rail can never reach the screen's right half
      // (where #topctl and the docked account stack live) — two columns of
      // compact pills is ~108px of a 320px viewport, comfortably clear, and the
      // cap is expressed against the viewport so it cannot drift on any device.
      //  3. WIDTH, NOT MAX-WIDTH. `max-width` does NOT make a wrapping flex
      //     container wrap: the rail is a fixed-position shrink-to-fit box, so
      //     its used width came from its CONTENT and max-width never bound it —
      //     measured, the launchers marched straight off the right edge to
      //     x=376 on a 320px screen. An explicit `width` gives the flex
      //     algorithm the line-length it needs to actually break. It is the
      //     same min() so it still cannot reach the screen's right half.
      //  4. THE CROSS-AXIS PACK. In a wrapping COLUMN flex container the
      //     cross axis is horizontal, so `align-content` — not `align-items` —
      //     decides where the generated columns sit. The rail's base rule sets
      //     `align-items:flex-start` (correct: it keeps each pill shrink-to-fit
      //     rather than stretched), but with wrapping on, the default
      //     `align-content:normal` stretches the COLUMNS to fill the box and the
      //     launchers marched past the container's own right edge. Packing the
      //     columns to flex-start is what makes them respect the width above.
      //  5. THE BAND MUST HOLD A ROW, OR WRAPPING IS A CATASTROPHE. Measured
      //     with a sheet open at 320x568, the squeeze had already dragged
      //     --dv-railtop up so far that this rule computed max-height:41px — one
      //     pixel UNDER a compacted 42px launcher. In a wrapping column that is
      //     not "slightly cramped", it is total: every single item overflows its
      //     line and starts a new column, so eight launchers marched right off
      //     the screen at x=376 in one 42px-tall row. A wrapping container whose
      //     line is shorter than one item is strictly worse than no wrapping.
      //     So the ceiling is floored at two rows' worth (90px): the wrap can
      //     only ever be entered when it can actually hold a column, and the
      //     JS step below verifies the result and removes the class if it did
      //     not help — belt and braces, because this failure is silent.
      // The band the wrapped rail may occupy is the SAME --dv-railtop /
      // --dv-railbot the single column uses — those two vars are already the
      // measured, neighbour-respecting answer (and --dv-railtop is now floored
      // below #leave, see ceilFloor in layoutRail). Re-deriving a second ceiling
      // here is what produced the 41px line: a rule that disagreed with the
      // measurement. It agrees now, and it is floored at one compact row so the
      // container can never be shorter than the item it must hold.
      //
      // THE WIDTH IS SET BY JS (--dv-railw), NOT GUESSED HERE. A fixed 110px was
      // two columns, and with an open sheet squeezing the band to a single 46px
      // row, two columns of eight launchers needs 410px of a 110px box — it
      // spilled, the guard rejected the wrap, and the rail fell back to clipping.
      // How wide the rail may be depends on how tall it was allowed to be, which
      // only layoutRail knows, so layoutRail computes it and writes it here. The
      // fallback keeps the rule sane if the var is ever missing.
      'body.dv-rail-wrap #dvRail{flex-wrap:wrap;align-content:flex-start;',
      ' width:var(--dv-railw,110px);column-gap:6px;',
      ' max-height:max(46px,calc(100dvh - var(--dv-railtop,270px)',
      ' - var(--dv-railbot,150px) - env(safe-area-inset-bottom,0px)));}',
      // ── THE WRAPPED PILL HAS A BOUNDED WIDTH (2026-09-25) ───────────────────
      // The wrap math upstream computes `cols * pillWidth`, and it was written
      // when a compacted pill was GLYPH-ONLY and therefore 46px square. Now that
      // compaction keeps the name (it must — see makeLauncher), a tight pill
      // measures up to 101px, so seventeen launchers wanted 5 columns × 101px =
      // 529px on a 320px screen. MEASURED: the wrap was rejected by its own
      // spill guard at 320×568, 320×720(sheet), 375×667(sheet), 375×812(sheet)
      // and 812×375, and the rail fell back to a single scrolled column with up
      // to 16 of 17 launchers off the top — present, labeled, and unreachable.
      //
      // The pill is what yields, because a column whose width is CONTENT-driven
      // cannot be planned against a viewport. Bounded to --dv-railcw (set by the
      // same code that sets --dv-railw, from the same measurement), the columns
      // become a width the wrap can actually fit, and the name ellipsizes inside
      // it rather than the launcher disappearing. A shortened name is a legible
      // name; an off-screen launcher is nothing at all.
      'body.dv-rail-wrap #dvRail .dv-launch{max-width:var(--dv-railcw,104px);}',
      // ── THE GLYPH TIER — the rung BELOW tight, FINE POINTER ONLY (GEJ8NYU) ──
      // MEASURED 2026-09-27 with verify-rail-reach.js (every launcher, not just the
      // eight that open sheets): at 375x812 with any sheet up the rail holds 18-19
      // launchers in a ~400px band, the labeled wrap is refused (a labeled pill is
      // 71..111px, and the floor-62px column still cannot seat them), and the rail
      // falls back to its single scrolled column with 9-11 launchers ABOVE the
      // viewport — present, labeled, and unhittable. A name nobody can reach
      // identifies nothing.
      //
      // So there is one rung left to spend, and it is spent ONLY where hover
      // exists. The glyph is its own span (see makeLauncher) and is never hidden;
      // the name is folded away and moved to `title=` (set by layoutRail), which a
      // fine pointer shows on hover. The pill collapses to its 46px floor, so five
      // columns are 5*46+4*6 = 254px — inside the 0.78vw cap (292px at 375).
      //
      // THE 2026-09-26 TOUCH DIRECTIVE IS NOT RELAXED. On a coarse pointer the
      // whole ladder is skipped (`!_coarse` in layoutRail) AND the body.dv-coarse
      // rule above forces `.lbl{display:inline !important}`, which outranks this
      // rule — so a phone can never land here even by a stray class.
      'body.dv-rail-glyph #dvRail .dv-launch .lbl{display:none;}',
      'body.dv-rail-glyph #dvRail .dv-launch{padding:0 8px;gap:4px;justify-content:center;min-width:46px;}',
      // ── WHEN THE RAIL MUST SCROLL, IT SAYS SO (2026-09-25) ──────────────────
      // Every rung of the ladder has a floor, and on a genuinely over-capacity
      // viewport (MEASURED: 320×568 guest, 320×568 + sheet, 320×720 + sheet, and
      // 812×375 guest — 17 launchers against a 46–267px band) not even the wrap
      // can seat them legibly, so the rail keeps its bounded single-column
      // scroll. This file already names the flaw in that fallback twice: "a
      // launcher you must first discover is scrollable is a launcher that isn't
      // there." Nothing had ever closed that gap — the scroll was silent.
      //
      // So the rail declares it. A top fade is painted ONLY while the column
      // actually overflows (the class is set by layoutRail from a real
      // scrollHeight/clientHeight comparison, never guessed), which is the
      // conventional and instantly-readable sign that content continues above.
      // It is a mask on the rail's own box — it adds NO element, so it cannot
      // collide with anything, and it cannot be hit-tested or steal a tap.
      'body.dv-rail-scrolls #dvRail{',
      ' -webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 34px);',
      ' mask-image:linear-gradient(to bottom,transparent 0,#000 34px);}',

      // ══ TOUCH IS A FIRST-CLASS POINTER (2026-09-25) ═══════════════════════
      // MEASURED BEFORE WRITING: of the 22 modules in body/world/, 21 contained
      // zero occurrences of `pointer:coarse`, `isTouch` or `matchMedia`. Only
      // galactic-time.js had one. The world had, effectively, no touch path at
      // all — it was a desktop surface that a phone was allowed to visit. That
      // is the root of Vinta's report as much as the hidden labels were: hover
      // was treated as universally available, so anything that only appeared on
      // hover (or in a `title=`) simply did not exist on a phone.
      //
      // These rules are scoped to `pointer:coarse` so the desktop layout math —
      // every measured value in layoutRail — is untouched. A coarse pointer gets
      // MORE room, never less, and never a different structure: same rail, same
      // flow children, same measurement engine, just sized for a thumb.
      '@media(pointer:coarse){',
      // 48px ≥ the 44px floor, with the 4px of headroom that keeps a pill from
      // sitting exactly ON the minimum where a 1px rounding error breaks it.
      ' #dvRail .dv-launch{min-height:48px;}',
      // the tight rung may still shrink, but its floor rises to 44 on touch:
      // 42px was an honest DESKTOP minimum and is under the touch floor.
      ' body.dv-rail-tight #dvRail .dv-launch{min-height:44px;height:44px;}',
      // the name must not be starved on the device that most needs it — a phone
      // has no hover to fall back on, so touch gets a wider name than desktop
      // compaction allows.
      ' body.dv-rail-compact #dvRail .dv-launch .lbl{max-width:13ch;}',
      ' body.dv-rail-tight #dvRail .dv-launch .lbl{max-width:10ch;}',
      // momentum + contained overscroll in every scrollable surface, so a flick
      // inside a sheet never chains out to the document behind it (which on iOS
      // is what makes a bottom sheet feel like it is fighting the page).
      ' .dv-body,#dvRail{-webkit-overflow-scrolling:touch;overscroll-behavior:contain;}',
      // a sheet on a phone gets a bigger grip and a bigger close target.
      ' .dv-grip{height:5px;width:48px;margin:11px auto 5px;}',
      ' .dv-x{min-width:48px;min-height:48px;}',
      ' .dv-tab{min-height:44px;}',
      '}',
      // HOVER IS AN ENHANCEMENT, NEVER A CHANNEL. Any affordance that changes on
      // hover is declared only where hover actually exists, so a touch device is
      // never left waiting for a state it cannot enter.
      '@media(hover:hover){.dv-launch:hover{border-color:rgba(124,207,255,0.6);}}',

      // shared bottom-sheet scaffold (WARP + AGENT both use it)
      '.dv-sheet{position:fixed;left:0;right:0;bottom:0;z-index:1600;',
      // dvh follows the on-screen keyboard on modern mobile, so the sheet shrinks
      // instead of being shoved off-screen; vh is the fallback for older engines.
      // THE SHEET RESERVES THE RAIL'S BAND (2026-08-07). 78dvh was chosen when
      // the rail held four launchers and could always tuck into the 22% left
      // over. It now holds eight, and at 320x568 that arithmetic broke: the
      // sheet took 443px, #leave owns the top 58, and the 46px strip between
      // them could not hold the column — six of eight launchers rendered at
      // NEGATIVE y (down to -169) with elementFromPoint returning null at their
      // centres. They were not cramped, they were gone, and a launcher you
      // cannot hit is exactly the dead control this file's squeeze comment
      // refuses to ship.
      //
      // Something has to yield, and it is the SHEET, for the same reason the
      // panel yields to the rail in layoutRail's squeeze: the sheet is content
      // with its own internal scroll (.dv-body is overflow-y:auto by design, so
      // it loses nothing but a few visible pixels), while the rail is the only
      // way BETWEEN surfaces and cannot scroll a user to a button they do not
      // know is there. --dv-railneed is the compacted column's real measured
      // height, published by layoutRail; the floor keeps the sheet usable at
      // 42dvh no matter how many launchers ever exist, so a future tenth
      // launcher can never squeeze the sheet into a sliver.
      ' max-height:min(78vh,560px);',
      ' max-height:max(42dvh,min(78dvh,560px,calc(100dvh - var(--dv-railneed,0px) - 76px)));',
      ' background:rgba(6,9,15,0.94);',
      ' border-top:1px solid rgba(124,207,255,0.22);border-radius:20px 20px 0 0;',
      ' backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);color:#dce7ff;',
      ' font-family:"Cormorant Garamond",Georgia,serif;',
      ' transform:translateY(105%);transition:transform .38s cubic-bezier(.22,1,.36,1);',
      ' display:flex;flex-direction:column;',
      ' padding-bottom:max(12px,env(safe-area-inset-bottom,12px));',
      ' box-shadow:0 -12px 48px rgba(0,0,0,0.6);}',
      '.dv-sheet.open{transform:translateY(0);}',
      '.dv-grip{flex:0 0 auto;width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,0.22);',
      ' margin:9px auto 4px;}',
      '.dv-head{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;',
      ' padding:4px 18px 8px;}',
      '.dv-title{font-size:21px;letter-spacing:.04em;color:#eaf3ff;}',
      '.dv-title small{display:block;font-size:12px;letter-spacing:.06em;color:rgba(159,220,255,0.65);',
      ' font-style:italic;margin-top:1px;}',
      '.dv-x{min-width:44px;min-height:44px;border:none;background:none;color:rgba(220,231,255,0.55);',
      ' font-size:22px;cursor:pointer;line-height:1;}',
      '.dv-x:active{color:#fff;}',
      '.dv-tabs{flex:0 0 auto;display:flex;gap:6px;padding:0 18px 8px;}',
      '.dv-tab{flex:1;min-height:40px;border-radius:11px;font-family:inherit;font-size:13px;cursor:pointer;',
      ' color:rgba(206,224,255,0.7);background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);}',
      '.dv-tab.on{color:#eaf3ff;background:rgba(124,207,255,0.16);border-color:rgba(124,207,255,0.4);}',
      '.dv-body{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;',
      ' padding:2px 14px 14px;overscroll-behavior:contain;}',

      // WARP beacon cards
      '.dv-beacons{display:grid;grid-template-columns:1fr 1fr;gap:10px;}',
      '@media(max-width:420px){.dv-beacons{grid-template-columns:1fr;}}',
      '.dv-beacon{position:relative;border-radius:15px;padding:14px 14px 13px;overflow:hidden;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.09);cursor:pointer;',
      ' transition:border-color .2s,transform .1s;}',
      '.dv-beacon:active{transform:scale(0.985);}',
      '.dv-beacon:hover{border-color:rgba(124,207,255,0.4);}',
      '.dv-beacon .glowdot{position:absolute;top:-24px;right:-24px;width:80px;height:80px;border-radius:50%;',
      ' filter:blur(22px);opacity:0.55;pointer-events:none;}',
      '.dv-beacon.here{border-color:rgba(255,212,121,0.55);background:rgba(255,212,121,0.06);}',
      '.dv-bname{font-size:18px;color:#f0f6ff;letter-spacing:.02em;position:relative;}',
      '.dv-bowner{font-size:12.5px;color:rgba(206,224,255,0.6);margin-top:1px;position:relative;}',
      '.dv-bmeta{display:flex;align-items:center;gap:9px;margin-top:9px;position:relative;}',
      '.dv-online{display:flex;align-items:center;gap:5px;font-size:12px;color:rgba(180,255,205,0.85);}',
      '.dv-online i{width:7px;height:7px;border-radius:50%;background:#57e08c;box-shadow:0 0 7px #57e08c;',
      ' display:inline-block;animation:dvpulse 1.8s infinite;}',
      '.dv-online.empty i{background:rgba(255,255,255,0.3);box-shadow:none;animation:none;}',
      '@keyframes dvpulse{0%,100%{opacity:1;}50%{opacity:0.4;}}',
      '.dv-travel{margin-top:11px;width:100%;min-height:42px;border-radius:11px;font-family:inherit;',
      ' font-size:14px;letter-spacing:.05em;cursor:pointer;color:#e9d9ff;',
      ' background:linear-gradient(90deg,rgba(124,207,255,0.16),rgba(206,147,216,0.2));',
      ' border:1px solid rgba(206,147,216,0.42);position:relative;}',
      '.dv-travel:active{transform:scale(0.98);}',
      '.dv-travel.here{opacity:0.5;pointer-events:none;color:rgba(255,212,121,0.9);',
      ' background:rgba(255,212,121,0.08);border-color:rgba(255,212,121,0.3);}',
      '.dv-empty{padding:30px 10px;text-align:center;color:rgba(206,224,255,0.5);font-style:italic;font-size:15px;}',
      '.dv-more{width:100%;min-height:44px;margin-top:12px;border-radius:11px;font-family:inherit;font-size:13px;',
      ' color:rgba(206,224,255,0.75);background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);cursor:pointer;}',

      // AGENT panel
      '.dv-field{margin-bottom:13px;}',
      '.dv-flabel{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:rgba(159,220,255,0.6);margin-bottom:6px;}',
      '.dv-agrid{display:flex;gap:7px;flex-wrap:wrap;}',
      '.dv-achip{flex:1 1 auto;min-height:44px;padding:0 12px;border-radius:12px;font-family:inherit;font-size:13.5px;',
      ' cursor:pointer;color:rgba(220,231,255,0.85);background:rgba(255,255,255,0.05);',
      ' border:1px solid rgba(255,255,255,0.09);display:flex;align-items:center;gap:7px;}',
      '.dv-achip .k{width:9px;height:9px;border-radius:50%;flex:0 0 auto;}',
      // a court agent can have a 60-char name — it clips inside its own chip and
      // can never widen the row past the sheet (no-overflow law).
      '.dv-achip .an{flex:1 1 auto;min-width:0;max-width:150px;overflow:hidden;',
      ' text-overflow:ellipsis;white-space:nowrap;}',
      '.dv-achip.on{background:rgba(124,207,255,0.14);border-color:rgba(124,207,255,0.45);color:#fff;}',
      '.dv-kind{display:flex;flex-direction:column;gap:7px;}',
      '.dv-krow{min-height:52px;padding:9px 13px;border-radius:12px;cursor:pointer;text-align:left;',
      ' background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);color:#dce7ff;font-family:inherit;}',
      '.dv-krow.on{background:rgba(124,207,255,0.13);border-color:rgba(124,207,255,0.45);}',
      '.dv-krow b{font-size:15px;letter-spacing:.05em;}',
      '.dv-krow .sub{display:block;font-size:12.5px;color:rgba(206,224,255,0.6);margin-top:1px;}',
      '.dv-krow .odds{display:block;font-size:11.5px;color:rgba(255,190,150,0.7);margin-top:2px;font-style:italic;}',
      '.dv-stakebox{display:flex;align-items:center;gap:12px;}',
      '.dv-stake{flex:1;-webkit-appearance:none;appearance:none;height:6px;border-radius:3px;',
      ' background:linear-gradient(90deg,#4fc3f7,#ce93d8);outline:none;}',
      '.dv-stake::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;border-radius:50%;',
      ' background:#fff;box-shadow:0 0 10px rgba(124,207,255,0.8);cursor:pointer;}',
      '.dv-stake::-moz-range-thumb{width:24px;height:24px;border:none;border-radius:50%;background:#fff;',
      ' box-shadow:0 0 10px rgba(124,207,255,0.8);cursor:pointer;}',
      '.dv-stakeval{flex:0 0 auto;min-width:76px;text-align:right;font-size:17px;color:#9fdcff;}',
      '.dv-send{width:100%;min-height:50px;margin-top:4px;border-radius:13px;font-family:inherit;font-size:16px;',
      ' letter-spacing:.06em;cursor:pointer;color:#06121e;font-weight:600;',
      ' background:linear-gradient(90deg,#7ccfff,#ce93d8);border:none;box-shadow:0 6px 22px rgba(124,207,255,0.3);}',
      '.dv-send:active{transform:scale(0.98);}',
      '.dv-send:disabled{opacity:0.4;pointer-events:none;filter:grayscale(0.4);}',
      '.dv-note{font-size:11.5px;color:rgba(206,224,255,0.5);font-style:italic;margin-top:8px;min-height:15px;text-align:center;}',
      '.dv-ledger{margin-top:6px;}',
      '.dv-ltitle{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:rgba(159,220,255,0.6);',
      ' margin:14px 0 7px;display:flex;justify-content:space-between;align-items:center;}',
      '.dv-refresh{background:none;border:none;color:rgba(159,220,255,0.6);font-size:13px;cursor:pointer;',
      ' min-height:32px;padding:0 6px;}',
      '.dv-lrow{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:11px;margin-bottom:6px;',
      ' background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.07);}',
      '.dv-lrow .lk{font-size:13px;color:rgba(220,231,255,0.85);flex:1;min-width:0;}',
      '.dv-lrow .lk small{display:block;color:rgba(206,224,255,0.5);font-size:11.5px;}',
      '.dv-lrow .lstake{font-size:12.5px;color:rgba(206,224,255,0.6);flex:0 0 auto;}',
      '.dv-lrow .ldelta{font-size:15px;flex:0 0 auto;min-width:58px;text-align:right;font-variant-numeric:tabular-nums;}',
      '.dv-lrow.running{border-color:rgba(124,207,255,0.3);}',
      '.dv-lrow.running .ldelta{color:#9fdcff;}',
      '.dv-lrow .ldelta.win{color:#57e08c;}',
      '.dv-lrow .ldelta.loss{color:#ff7a7a;}',
      '.dv-spin{display:inline-block;width:11px;height:11px;border:2px solid rgba(124,207,255,0.3);',
      ' border-top-color:#7ccfff;border-radius:50%;animation:dvspin .8s linear infinite;vertical-align:middle;}',
      '@keyframes dvspin{to{transform:rotate(360deg);}}',

      // ── AGENTIS · your citizens (roster + in-world conversation) ─────────────
      // Two panes inside ONE sheet body, exactly one visible at a time (.dv-pane
      // is display:none unless .on) — a roster can never render behind a thread.
      '.dv-pane{display:none;flex-direction:column;min-height:0;}',
      '.dv-pane.on{display:flex;}',
      // The CONVERSATION pane is the one exception to .dv-body's own scrolling:
      // it must NOT scroll as a whole, or the composer would scroll away from the
      // thumb and a nested .dv-thread would create a double-scroll trap. Instead
      // the pane is a fixed-height flex column — only .dv-thread scrolls, and the
      // composer stays pinned by flex (a flow sibling, never position:fixed, so it
      // can never land on top of a message).
      '#dvPaneConvo{overflow:hidden;}',
      '.dv-cits{display:flex;flex-direction:column;gap:9px;}',
      '.dv-cit{display:flex;align-items:center;gap:11px;padding:11px 13px;border-radius:14px;',
      ' background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);',
      ' border-left:3px solid var(--cc,#a67cff);text-align:left;font-family:inherit;color:#dce7ff;',
      ' cursor:pointer;width:100%;min-height:56px;}',
      '.dv-cit:active{transform:scale(0.99);}',
      '.dv-cit .cav{flex:0 0 auto;width:34px;height:34px;border-radius:50%;display:flex;',
      ' align-items:center;justify-content:center;font-size:15px;color:#0a0d14;font-weight:700;',
      ' background:var(--cc,#a67cff);}',
      // min-width:0 on the text column is what actually stops a long agent name from
      // shoving the badge out of the card (flex children default to min-width:auto).
      '.dv-cit .ctxt{flex:1 1 auto;min-width:0;}',
      '.dv-cit .cname{font-size:15.5px;color:#f0f6ff;overflow:hidden;text-overflow:ellipsis;',
      ' white-space:nowrap;}',
      '.dv-cit .cmeta{font-size:12px;color:rgba(206,224,255,0.6);overflow:hidden;',
      ' text-overflow:ellipsis;white-space:nowrap;margin-top:1px;}',
      '.dv-cit .cgo{flex:0 0 auto;font-size:13px;color:rgba(159,220,255,0.75);}',
      '.dv-cit.paused{opacity:0.72;}',
      '.dv-cit .cbadge{flex:0 0 auto;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;',
      ' color:#ffcf6b;border:1px solid rgba(255,207,107,0.35);border-radius:999px;padding:2px 8px;',
      ' white-space:nowrap;}',
      // conversation pane
      '.dv-cvhead{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:0 0 9px;}',
      '.dv-back{flex:0 0 auto;min-height:40px;min-width:44px;padding:0 12px;border-radius:11px;',
      ' font-family:inherit;font-size:13px;cursor:pointer;color:rgba(206,224,255,0.8);',
      ' background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);}',
      '.dv-cvwho{flex:1 1 auto;min-width:0;font-size:16px;color:var(--cc,#a67cff);',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      // the thread scrolls INSIDE its own box; the composer is a flow sibling pinned
      // by flex, never position:fixed — so it can never land on a message.
      '.dv-thread{flex:1 1 auto;min-height:120px;overflow-y:auto;overscroll-behavior:contain;',
      ' -webkit-overflow-scrolling:touch;display:flex;flex-direction:column;gap:9px;',
      ' padding:11px;border-radius:14px;background:rgba(255,255,255,0.03);',
      ' border:1px solid rgba(255,255,255,0.07);}',
      '.dv-msg{display:flex;flex-direction:column;gap:3px;max-width:100%;}',
      '.dv-msg .mw{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;',
      ' color:rgba(159,220,255,0.55);}',
      '.dv-msg .mt{font-size:14.5px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere;',
      ' border-radius:12px;padding:9px 12px;}',
      '.dv-msg.me{align-items:flex-end;}',
      '.dv-msg.me .mt{background:rgba(124,207,255,0.13);border:1px solid rgba(124,207,255,0.26);}',
      '.dv-msg.them .mt{background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.09);}',
      '.dv-msg .mt.err{border-color:rgba(255,122,122,0.4);background:rgba(255,122,122,0.08);color:#ffb0b0;}',
      '.dv-cur{display:inline-block;width:7px;height:14px;background:#7ccfff;vertical-align:-2px;',
      ' animation:dvblink 1s steps(2,start) infinite;}',
      '@keyframes dvblink{to{visibility:hidden;}}',
      '@media(prefers-reduced-motion:reduce){.dv-cur{animation:none;}}',
      '.dv-comp{flex:0 0 auto;display:flex;gap:9px;align-items:flex-end;padding-top:10px;}',
      '.dv-comp textarea{flex:1 1 auto;min-width:0;min-height:46px;max-height:110px;overflow-y:auto;',
      ' resize:none;font-family:inherit;font-size:15px;color:#dce7ff;border-radius:13px;padding:12px 14px;',
      ' background:rgba(255,255,255,0.05);border:1px solid rgba(124,207,255,0.24);outline:none;}',
      '.dv-comp textarea:focus{border-color:rgba(124,207,255,0.5);}',
      '.dv-comp .dv-send{width:auto;flex:0 0 auto;margin-top:0;min-height:46px;padding:0 20px;font-size:15px;}',
      // the conversion doorway when the roster is empty / you are a guest
      '.dv-door{padding:22px 16px;text-align:center;}',
      '.dv-door .dh{font-size:19px;color:#eaf3ff;line-height:1.3;}',
      '.dv-door .ds{font-size:14px;color:rgba(206,224,255,0.6);margin-top:8px;line-height:1.5;}',
      '.dv-door .da{display:inline-flex;align-items:center;justify-content:center;min-height:48px;',
      ' margin-top:16px;padding:0 24px;border-radius:999px;font-size:15.5px;text-decoration:none;',
      ' color:#06121e;font-weight:600;background:linear-gradient(90deg,#7ccfff,#ce93d8);',
      ' box-shadow:0 6px 22px rgba(124,207,255,0.28);}',
      '.dv-door .da:active{transform:scale(0.98);}',

      // ── MY WORLD (the forge / the deed) ──────────────────────────────────────
      '.dv-deed{border-radius:16px;padding:15px;margin-bottom:14px;',
      ' background:linear-gradient(180deg,rgba(255,212,121,0.09),rgba(255,212,121,0.03));',
      ' border:1px solid rgba(255,212,121,0.28);}',
      '.dv-deedhead{display:flex;align-items:center;gap:10px;min-width:0;}',
      '.dv-deedhead .dn{flex:1 1 auto;min-width:0;font-size:18px;color:#ffe9bd;',
      ' overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.dv-deedhead .dvis{flex:0 0 auto;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;',
      ' color:rgba(255,226,160,0.8);border:1px solid rgba(255,212,121,0.32);border-radius:999px;',
      ' padding:2px 9px;white-space:nowrap;}',
      '.dv-deedsub{font-size:12.5px;color:rgba(255,226,160,0.6);margin-top:3px;font-style:italic;}',
      '.dv-deedrow{display:flex;gap:9px;margin-top:12px;flex-wrap:wrap;}',
      '.dv-deedrow button{flex:1 1 132px;min-height:46px;border-radius:12px;font-family:inherit;',
      ' font-size:14.5px;cursor:pointer;}',
      '.dv-gohome{color:#241a06;font-weight:600;border:none;',
      ' background:linear-gradient(90deg,#ffd479,#ffb96b);box-shadow:0 5px 18px rgba(255,190,110,0.25);}',
      '.dv-gohome:active{transform:scale(0.98);}',
      '.dv-gohome:disabled{opacity:0.5;pointer-events:none;}',
      '.dv-edit{color:#ffe2a0;background:rgba(255,212,121,0.1);border:1px solid rgba(255,212,121,0.32);}',
      '.dv-forgeform{margin-top:13px;display:none;}',
      '.dv-forgeform.on{display:block;}',
      '.dv-in{width:100%;min-height:46px;border-radius:12px;padding:12px 14px;font-family:inherit;',
      ' font-size:15px;color:#dce7ff;background:rgba(255,255,255,0.05);outline:none;',
      ' border:1px solid rgba(124,207,255,0.24);-webkit-appearance:none;}',
      '.dv-in:focus{border-color:rgba(124,207,255,0.5);}',
      '.dv-cnt{font-size:11px;color:rgba(206,224,255,0.45);text-align:right;margin-top:4px;}',
      '.dv-swatches{display:flex;gap:8px;flex-wrap:wrap;}',
      '.dv-sw{width:38px;height:38px;min-height:38px;border-radius:50%;cursor:pointer;padding:0;',
      ' border:2px solid transparent;box-shadow:0 0 0 1px rgba(255,255,255,0.12) inset;}',
      '.dv-sw.on{border-color:#fff;transform:scale(1.06);}',
      '.dv-vis{display:flex;gap:7px;}',
      '.dv-vis button{flex:1 1 0;min-height:44px;border-radius:11px;font-family:inherit;font-size:13px;',
      ' cursor:pointer;color:rgba(206,224,255,0.72);background:rgba(255,255,255,0.05);',
      ' border:1px solid rgba(255,255,255,0.09);}',
      '.dv-vis button.on{color:#fff;background:rgba(124,207,255,0.15);border-color:rgba(124,207,255,0.45);}',

      // BUILD palette strip (thumb-scroll, own world only)
      '#dvBuild{position:fixed;left:0;right:0;z-index:1440;',
      ' bottom:calc(74px + max(16px,env(safe-area-inset-bottom,16px)));',
      ' display:none;padding:8px max(12px,env(safe-area-inset-left,12px)) 8px max(12px,env(safe-area-inset-right,12px));}',
      '#dvBuild.show{display:block;}',
      '.dv-palette{display:flex;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;',
      ' padding:6px 4px;scrollbar-width:none;overscroll-behavior-x:contain;',
      ' background:rgba(6,9,15,0.7);border:1px solid rgba(124,207,255,0.18);border-radius:16px;',
      ' backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);padding-left:10px;padding-right:10px;}',
      '.dv-palette::-webkit-scrollbar{display:none;}',
      '.dv-prop{flex:0 0 auto;width:60px;min-height:60px;border-radius:12px;cursor:pointer;',
      ' display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;',
      ' color:#cfe0f5;background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.1);font-family:inherit;}',
      '.dv-prop:active{transform:scale(0.94);}',
      '.dv-prop.on{background:rgba(124,207,255,0.16);border-color:rgba(124,207,255,0.5);color:#fff;}',
      '.dv-prop .pg{font-size:20px;line-height:1;}',
      '.dv-prop .pn{font-size:10.5px;letter-spacing:.02em;}',
      // THE FABRICATOR console (GPYSY83) — sits ABOVE the strip in normal flow
      // inside #dvBuild, so it can only push the bar taller, never sit on it.
      'body.dv-building-tight #vintWorldHud,body.dv-building-tight #hint,body.dv-building-tight #editHeadBtn{visibility:hidden !important;pointer-events:none !important;}',
      '.dv-fab{display:none;margin:0 0 6px;padding:8px 10px;border-radius:14px;',
      ' background:linear-gradient(180deg,rgba(9,22,34,0.86),rgba(6,12,20,0.86));',
      ' border:1px solid rgba(124,207,255,0.28);box-shadow:0 0 18px rgba(80,170,230,0.12) inset;',
      ' backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);',
      ' font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#cfe8ff;}',
      '.dv-fab.show{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}',
      '.dv-fab .fb-id{display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 180px;}',
      '.dv-fab .fb-g{font-size:22px;line-height:1;flex:0 0 auto;}',
      '.dv-fab .fb-t{display:flex;flex-direction:column;min-width:0;}',
      '.dv-fab .fb-k{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:rgba(124,207,255,0.8);}',
      '.dv-fab .fb-n{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.dv-fab .fb-v{font-size:11.5px;line-height:1.3;color:#9fe3b0;overflow-wrap:anywhere;}',
      '.dv-fab .fb-v.bad{color:#ff9aa6;}',
      '.dv-fab .fb-act{display:flex;gap:6px;flex:0 0 auto;margin-left:auto;}',
      '.dv-fab button{min-width:44px;min-height:40px;border-radius:10px;cursor:pointer;font-family:inherit;',
      ' font-size:12px;letter-spacing:.06em;color:#dff2ff;background:rgba(255,255,255,0.06);',
      ' border:1px solid rgba(124,207,255,0.25);padding:0 10px;}',
      '.dv-fab button.go{background:rgba(124,207,255,0.2);border-color:rgba(124,207,255,0.6);color:#fff;font-weight:600;}',
      '.dv-fab button.go[disabled]{opacity:.45;cursor:not-allowed;}',

      // SHEET SCRIM — the single dimmed backdrop behind whichever sheet is open.
      // It lives at 1560: under every sheet (1600) and under the warp veil (1590),
      // over the world canvas and the rail. Tapping it closes the open sheet, which
      // is the gesture people already expect from a bottom sheet.
      '#dvScrim{position:fixed;inset:0;z-index:1560;background:rgba(3,5,10,0.5);',
      ' opacity:0;pointer-events:none;transition:opacity .3s;',
      ' backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);}',
      '#dvScrim.show{opacity:1;pointer-events:auto;}',
      // The rail normally sits at 1450, BELOW the scrim — which would make every
      // launcher untappable the moment a sheet is up, so the one gesture Lord
      // Vinta asked for (tap ◈ while ✦ is open, ✦ closes, ◈ opens) would instead
      // be eaten by the backdrop. While a sheet is open the rail is promoted
      // above the scrim so switching surfaces stays one tap. It stays BELOW the
      // sheets (1600), so it can never draw on top of one — which is why this
      // rule alone is not enough: where the rail's band and the sheet's band
      // actually intersect, the sheet still (correctly) wins. layoutRail step 2b
      // is the other half, shortening the rail so that intersection is empty.
      'body.dv-sheeting #dvRail{z-index:1570;}',
      // On short viewports the panel + five launchers + an open sheet genuinely
      // do not all fit (measured 375×812: 302px of band for 326px of launchers,
      // which clipped ♔ half outside its own scroll box). Something must yield,
      // and it is the passive readout, not the only way to change surfaces.
      // visibility, so no module's layout math shifts — it simply stops painting
      // while a sheet is up, and comes straight back when the sheet closes.
      // #hint yields with the panel: it lives in the same left column, BELOW the
      // panel (its top derives from --vint-hud-bottom), so a rail that borrowed
      // enough ceiling to clear the panel has necessarily walked through the hint
      // on the way. Measured at 812x375 that left 42x17px of launchers painted on
      // the W/A/S/D legend. Hiding only the panel would have been half a fix.
      'body.dv-panel-yield #vintWorldHud,body.dv-panel-yield #hint{visibility:hidden;}',

      // toast (shared, above sheets)
      '#dvToast{position:fixed;left:50%;bottom:calc(88px + env(safe-area-inset-bottom,0px));',
      ' transform:translateX(-50%) translateY(10px);z-index:1700;max-width:88vw;',
      ' padding:10px 18px;border-radius:14px;background:rgba(8,12,20,0.9);',
      ' border:1px solid rgba(124,207,255,0.3);color:#dce7ff;font-family:"Cormorant Garamond",Georgia,serif;',
      ' font-size:14.5px;opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;',
      ' text-align:center;box-shadow:0 6px 24px rgba(0,0,0,0.5);}',
      '#dvToast.show{opacity:1;transform:translateX(-50%) translateY(0);}',
      // ON A PHONE THE TOAST YIELDS TO #topctl (93H6E4T). At <=859px world.html
      // moves #topctl (the view/mic pills) OUT of the top-right corner down INTO
      // the bottom band (bottom:var(--vw-bot-h)+var(--vw-gut), a 46px pill row).
      // The desktop toast at bottom:88 then landed straight on those pills —
      // MEASURED 320x568: toast y356..480 over topctl y390..436 (30x46), and
      // 16x46 at 375x667. The rest of the bottom cluster is full (feed left,
      // movectl + corner dock right, micHint centred — all ABOVE the topctl row),
      // so the one clear strip is BELOW the topctl row and ABOVE the say bar +
      // corner dock (measured clear band y436..504 at 320). The toast drops into
      // it and is held to ONE line (ellipsised, like #micHint) so a long message
      // clips inside its own box instead of growing back up into the pills. On
      // >=860px this rule is inert and the desktop toast — with #topctl back in
      // the top-right corner — is untouched.
      '@media(max-width:859px){#dvToast{',
      ' bottom:calc(76px + env(safe-area-inset-bottom,0px));',
      ' max-width:min(90vw,340px);white-space:nowrap;',
      ' overflow:hidden;text-overflow:ellipsis;}}',

      // WARP flash veil — the cinematic white/blue bloom at jump apex
      '#dvVeil{position:fixed;inset:0;z-index:1590;pointer-events:none;opacity:0;',
      ' background:radial-gradient(circle at 50% 55%,rgba(191,228,255,0.9),rgba(206,147,216,0.5) 40%,rgba(6,9,15,0) 72%);',
      ' transition:opacity .4s;}',
      '#dvVeil.show{opacity:1;}',
      '#dvWarpLabel{position:fixed;left:50%;top:46%;transform:translate(-50%,-50%);z-index:1595;',
      ' pointer-events:none;text-align:center;opacity:0;transition:opacity .4s;',
      ' font-family:"Cormorant Garamond",Georgia,serif;color:#f4ecff;text-shadow:0 0 24px rgba(191,228,255,0.8);}',
      '#dvWarpLabel.show{opacity:1;}',
      '#dvWarpLabel .wl-to{font-size:13px;letter-spacing:.28em;text-transform:uppercase;color:rgba(206,224,255,0.8);}',
      '#dvWarpLabel .wl-name{font-size:30px;letter-spacing:.05em;margin-top:5px;}'
    ].join('');
    document.head.appendChild(s);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE SHEET OWNER — exactly one bottom sheet is open at a time, page-wide
  // ═══════════════════════════════════════════════════════════════════════════
  // Every full-width surface in the world (★ star-map, ◈ agents, ♔ court, ⌂⃝
  // DirHaven) used to open itself independently: `el.classList.add('open')` and
  // nothing else. Each one is position:fixed, left:0, right:0, bottom:0 at
  // z-index 1600 — so opening a second launcher while a first sheet was up left
  // BOTH mounted on identical pixels (measured at 375×812: #dvWarpSheet and
  // #dvAgentSheet each top 584 → bottom 812, opacity 1, z 1600). Four could
  // stack. That is the cardinal collision, and no amount of per-module care
  // fixes it, because no module can see its neighbours.
  //
  // So the rail that OWNS the launchers now owns the sheets too. A surface
  // registers once; opening any registered surface closes every other open one
  // first. Escape and a tap on the scrim close whatever is open. The invariant
  // ("at most one open") lives in one place instead of being re-derived — and
  // every launcher, present or future, inherits it for free.
  var _sheets = [];        // [{id, isOpen(), close()}]
  var _scrim = null;

  function scrim() {
    if (_scrim) return _scrim;
    _scrim = document.createElement('div');
    _scrim.id = 'dvScrim';
    _scrim.addEventListener('click', function () { closeSheets(); });
    document.body.appendChild(_scrim);
    return _scrim;
  }

  // A sheet is "open" per its own truth (a class, a flag) — we never cache it,
  // because grips, back buttons and internal flows close sheets without telling
  // us. Asking is always correct; remembering would drift.
  function registerSheet(id, isOpen, close) {
    for (var i = 0; i < _sheets.length; i++) if (_sheets[i].id === id) { _sheets[i].isOpen = isOpen; _sheets[i].close = close; return; }
    _sheets.push({ id: id, isOpen: isOpen, close: close });
  }

  function anyOpen() {
    for (var i = 0; i < _sheets.length; i++) { try { if (_sheets[i].isOpen()) return _sheets[i]; } catch (_) {} }
    return null;
  }

  // Close every open sheet except `exceptId`. Returns how many it closed.
  function closeSheets(exceptId) {
    var n = 0;
    for (var i = 0; i < _sheets.length; i++) {
      var s = _sheets[i];
      if (s.id === exceptId) continue;
      try { if (s.isOpen()) { s.close(); n++; } } catch (_) {}
    }
    syncScrim();
    return n;
  }

  // The scrim shows exactly when something is open — checked after every
  // transition, and on a short beat while sheets settle, so a grip-dismiss or an
  // internal close can never strand a dimmed layer over a world with no sheet.
  function syncScrim() {
    var open = !!anyOpen();
    scrim().classList.toggle('show', open);
    // promotes the rail over the scrim so launchers stay one tap away (see the
    // body.dv-sheeting rule). A body class rather than an inline style so the
    // rail's own stylesheet keeps owning its z-index in one place.
    try { document.body.classList.toggle('dv-sheeting', open); } catch (_) {}
    // and re-measure: an open sheet is a full-width bar the rail has to clear,
    // exactly like the saybar (see layoutRail step 2b). Without this the bottom
    // launchers stay under the sheet and are unclickable.
    try { layoutRail(); } catch (_) {}
  }
  // A sheet can close without telling us: the grip swipe-down and a few internal
  // flows just drop the class. Those paths call syncScrim() directly, but a
  // short beat while a sheet is up is the belt to that braces — it catches any
  // future close path nobody remembered to wire, so a dimmed scrim can never
  // outlive the sheet it dims. It stops the moment nothing is open (usually a
  // tick or two after the close), and on the next open, so it never accumulates.
  var _scrimBeat = null;
  function watchScrim() {
    clearInterval(_scrimBeat);
    var ticks = 0;
    _scrimBeat = setInterval(function () {
      syncScrim();
      if (!anyOpen() || ++ticks > 80) { clearInterval(_scrimBeat); _scrimBeat = null; }
    }, 250);
  }

  // openSheet(id, fn) — the ONLY sanctioned way to raise a sheet. It evicts
  // whatever else is up (Lord Vinta's call: opening a second sheet CLOSES the
  // first), then runs the surface's own open work.
  function openSheet(id, fn) {
    closeSheets(id);
    try { fn(); } finally { syncScrim(); watchScrim(); }
  }

  // ESC closes the open sheet — the expected way out of any surface, and the one
  // thing none of the four sheets implemented. The DirHaven door keeps its own
  // Escape handler (it is a full-screen panel with its own lifecycle); it also
  // registers here so opening it evicts a sheet and vice-versa.
  W.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (!anyOpen()) return;
    e.preventDefault();
    closeSheets();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TOAST
  // ═══════════════════════════════════════════════════════════════════════════
  var _toastEl = null, _toastT = null;
  function toast(msg) {
    if (!_toastEl) { _toastEl = document.createElement('div'); _toastEl.id = 'dvToast'; document.body.appendChild(_toastEl); }
    _toastEl.textContent = msg;
    _toastEl.classList.add('show');
    clearTimeout(_toastT);
    _toastT = setTimeout(function () { _toastEl.classList.remove('show'); }, 2600);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE WARP — star-map sheet + the cinematic travel transition
  // ═══════════════════════════════════════════════════════════════════════════
  var _warpSheet = null, _warpBody = null, _warpSort = 'featured', _warpCursor = null, _warping = false;

  function buildWarpSheet() {
    if (_warpSheet) return _warpSheet;
    var el = document.createElement('div');
    el.className = 'dv-sheet'; el.id = 'dvWarpSheet';
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title">the star-map<small>worlds worth the journey</small></div>' +
        '<button class="dv-x" id="dvWarpX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-tabs">' +
        '<button class="dv-tab on" data-sort="featured">featured</button>' +
        '<button class="dv-tab" data-sort="active">alive now</button>' +
        '<button class="dv-tab" data-sort="new">newly forged</button>' +
      '</div>' +
      '<div class="dv-body">' +
        '<div id="dvDeed"></div>' +
        '<div class="dv-beacons" id="dvBeacons"></div>' +
        '<button class="dv-more" id="dvMore" style="display:none">reveal more worlds</button>' +
      '</div>';
    document.body.appendChild(el);
    _warpSheet = el; _warpBody = el.querySelector('#dvBeacons');
    el.querySelector('#dvWarpX').onclick = closeWarp;
    el.querySelectorAll('.dv-tab').forEach(function (t) {
      t.onclick = function () {
        el.querySelectorAll('.dv-tab').forEach(function (x) { x.classList.remove('on'); });
        t.classList.add('on'); _warpSort = t.getAttribute('data-sort'); _warpCursor = null;
        loadWorlds(false);
      };
    });
    el.querySelector('#dvMore').onclick = function () { loadWorlds(true); };
    _grip(el);
    return el;
  }

  function openWarp() {
    openSheet('warp', function () {
      buildWarpSheet();
      _warpSheet.classList.add('open');
      _warpCursor = null;
      renderDeed();
      loadWorlds(false);
    });
  }
  function closeWarp() { if (_warpSheet) _warpSheet.classList.remove('open'); syncScrim(); }

  function loadWorlds(append) {
    if (!_warpBody) return;
    if (!append) _warpBody.innerHTML = '<div class="dv-empty">scanning the dark…</div>';
    var url = base() + '/api/universe/worlds?sort=' + encodeURIComponent(_warpSort) + '&limit=20' +
      (append && _warpCursor ? '&cursor=' + encodeURIComponent(_warpCursor) : '');
    fetch(url, { headers: authHeaders() })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        var list = (d && d.worlds) || [];
        _warpCursor = (d && d.nextCursor) || null;
        if (!append) _warpBody.innerHTML = '';
        if (!append && !list.length) {
          // the empty state now FORGES (it used to taunt with no way through).
          _warpBody.innerHTML = '<div class="dv-empty" id="dvNoWorlds">no worlds charted yet — be the first to forge one.</div>';
          var nw = _warpBody.querySelector('#dvNoWorlds');
          if (nw) {
            nw.style.cursor = 'pointer';
            nw.onclick = function () {
              if (_meState === 'guest') { var c = _warpSheet.querySelector('#dvClaim'); if (c) c.click(); return; }
              _forgeOpen = true; renderDeed();
              var f = _warpSheet.querySelector('#dvForge');
              if (f && f.scrollIntoView) f.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            };
          }
        }
        var here = world() && world().currentWorldId ? world().currentWorldId() : 'universe';
        list.forEach(function (wd) { _warpBody.appendChild(renderBeacon(wd, here)); });
        var more = _warpSheet.querySelector('#dvMore');
        if (more) more.style.display = _warpCursor ? 'block' : 'none';
      })
      .catch(function () {
        if (!append) _warpBody.innerHTML = '<div class="dv-empty">the star-map is out of reach right now.</div>';
      });
  }

  function renderBeacon(wd, here) {
    var card = document.createElement('div');
    var isHere = String(wd.id) === String(here);
    card.className = 'dv-beacon' + (isHere ? ' here' : '');
    // theme doubles as the beacon's glow colour; only let a real CSS colour through
    // (it's a free-text ≤24-char server field — never paint an unvalidated string).
    var color = _themeColor(wd.theme);
    var online = wd.online || 0;
    // `owner` is a raw user id from the server, which is meaningless to a human and
    // a small privacy leak — so it's never printed. It's only ever compared to mine.
    var mine = _me && String(wd.owner) === String(_me.id);
    card.innerHTML =
      '<div class="glowdot" style="background:' + esc(color) + '"></div>' +
      '<div class="dv-bname">' + esc(wd.name || 'unnamed world') + '</div>' +
      '<div class="dv-bowner">' + (mine ? 'yours' : 'by a traveler') + '</div>' +
      '<div class="dv-bmeta">' +
        '<span class="dv-online' + (online ? '' : ' empty') + '"><i></i>' +
          (online ? (online + ' here now') : 'quiet') + '</span>' +
      '</div>' +
      '<button class="dv-travel' + (isHere ? ' here' : '') + '">' +
        (isHere ? '◉ you are here' : '⟿ travel') + '</button>';
    if (!isHere) {
      card.querySelector('.dv-travel').onclick = function (e) {
        e.stopPropagation();
        beginWarp(wd);
      };
    }
    return card;
  }

  // `theme` is a free-text ≤24-char column. esc() stops it breaking OUT of the
  // attribute, but it would still let a stranger inject arbitrary CSS *values*
  // (url(), gradients) into a style attribute. Whitelist the shape instead:
  // only a #hex passes, anything else falls back to the default cold star.
  function _hex(v, fallback) {
    return /^#[0-9a-fA-F]{3,8}$/.test(String(v || '')) ? String(v) : fallback;
  }
  function _themeColor(t) { return _hex(t, '#7ccfff'); }
  function _agentColor(c) { return _hex(c, '#a67cff'); }

  // ── THE CINEMATIC WARP ──────────────────────────────────────────────────────
  // Buffet's one line: it must feel like a *journey*, not a load. Sequence:
  //  0.0s  close the sheet, veil blooms, starfield streaks (World.warpFx start)
  //  0.35s the destination name fades up over the streaming stars
  //  1.05s the actual room swap (World.travelTo) at peak brightness — hidden by veil
  //  1.6s  stars release, veil + label fade, you're standing in the new world
  function beginWarp(wd) {
    if (_warping) return;
    _warping = true;
    closeWarp();
    var veil = _veil(), label = _warpLabel();
    label.querySelector('.wl-name').textContent = wd.name || 'a new world';
    label.querySelector('.wl-to').textContent = 'traveling to';
    try { world() && world().warpFx && world().warpFx('start'); } catch (_) {}
    // bloom in
    requestAnimationFrame(function () { veil.classList.add('show'); });
    setTimeout(function () { label.classList.add('show'); }, 350);
    // swap the room at peak brightness (masked by the veil)
    setTimeout(function () {
      try { world() && world().travelTo(String(wd.id)); } catch (_) {}
      updateBuildVisibility(); // canBuild will refresh from world:state, but hide now
    }, 1050);
    // release
    setTimeout(function () {
      veil.classList.remove('show'); label.classList.remove('show');
      try { world() && world().warpFx && world().warpFx('stop'); } catch (_) {}
    }, 1600);
    setTimeout(function () {
      _warping = false;
      toast('arrived · ' + (wd.name || 'a new world'));
    }, 2050);
  }

  var _veilEl = null, _labelEl = null;
  function _veil() { if (!_veilEl) { _veilEl = document.createElement('div'); _veilEl.id = 'dvVeil'; document.body.appendChild(_veilEl); } return _veilEl; }
  function _warpLabel() {
    if (!_labelEl) {
      _labelEl = document.createElement('div'); _labelEl.id = 'dvWarpLabel';
      _labelEl.innerHTML = '<div class="wl-to">traveling to</div><div class="wl-name"></div>';
      document.body.appendChild(_labelEl);
    }
    return _labelEl;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MY WORLD — the deed. Forge it, name it, theme it, set who may find it, and
  // travel home. GAP-2 close: the star-map used to list only OTHER people's
  // worlds and taunt you with "be the first to forge one" and no way to forge.
  //
  // THE ONE TRUTH THAT SHAPES THIS UI: world id === owner's user id, and the
  // POST is an UPSERT. There is exactly ONE world per person, forever. So the
  // copy must NEVER read "create a world" after the first time — it's "forge"
  // once, then "rename/retheme". A second POST edits; it never spawns a twin.
  // ═══════════════════════════════════════════════════════════════════════════
  var _me = null;          // { id } once resolved from /api/auth/me
  var _meState = 'idle';   // idle|loading|ok|guest|error
  var _myWorld = null;     // { id,name,theme,visibility,visitCount } or null = unforged
  var _forgeOpen = false;

  // theme is a ≤24-char string the star-map renders as the beacon's glow colour,
  // so the swatches ARE the themes — pick a light, that's your world's colour.
  var THEMES = [
    { v: '#7ccfff', n: 'cold star' },
    { v: '#ce93d8', n: 'violet' },
    { v: '#ffd479', n: 'hearthlight' },
    { v: '#57e08c', n: 'verdant' },
    { v: '#ff9aa8', n: 'ember' },
    { v: '#9ae0d0', n: 'tidepool' }
  ];
  var _forgeTheme = THEMES[0].v, _forgeVis = 'public';

  // Resolve who I am (world id === my user id). One flight, cached, never blocks.
  function whoAmI() {
    if (_meState === 'ok' || _meState === 'loading') return;
    if (!token()) { _meState = 'guest'; return; }
    _meState = 'loading';
    fetch(base() + '/api/auth/me', { headers: authHeaders() })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        _me = { id: String(j.id) };
        _meState = 'ok';
        loadMyWorld();
      })
      .catch(function () { _meState = 'error'; renderDeed(); });
  }

  // My world's current metadata. 404 = never forged (the honest, common case).
  function loadMyWorld() {
    if (!_me) return;
    fetch(base() + '/api/universe/world/' + encodeURIComponent(_me.id), { headers: authHeaders() })
      .then(function (r) {
        if (r.status === 404) return null;              // not forged yet
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (j) { _myWorld = (j && j.meta) || null; renderDeed(); })
      .catch(function () { renderDeed(); });
  }

  function renderDeed() {
    var box = _warpSheet && _warpSheet.querySelector('#dvDeed');
    if (!box) return;

    // GUEST — never an auth wall inside the world. A doorway, matching world.html's
    // #invite tone: the clearing stays open, the deed is the thing worth signing in for.
    if (_meState === 'guest') {
      box.innerHTML =
        '<div class="dv-deed"><div class="dv-deedhead"><div class="dn">a world of your own</div></div>' +
        '<div class="dv-deedsub">every name on this map started empty.</div>' +
        '<div class="dv-deedrow"><button class="dv-gohome" id="dvClaim">✦ claim your clearing</button></div></div>';
      var c = box.querySelector('#dvClaim');
      if (c) c.onclick = function () {
        try {
          if (W.VintWelcomeGate && W.VintWelcomeGate.open) { W.VintWelcomeGate.open('signup'); return; }
          if (W.__vintOpenSignin) { W.__vintOpenSignin(); return; }
        } catch (_) {}
        location.href = 'welcome.html';
      };
      return;
    }
    if (_meState === 'loading' || _meState === 'idle') { box.innerHTML = ''; whoAmI(); return; }
    if (_meState === 'error') { box.innerHTML = ''; return; } // quiet: the map still works

    var here = world() && world().currentWorldId ? String(world().currentWorldId()) : 'universe';
    var atHome = _me && here === String(_me.id);
    var w = _myWorld;
    var vis = (w && w.visibility) || 'public';
    var themeVal = (w && w.theme) || _forgeTheme;

    box.innerHTML =
      '<div class="dv-deed">' +
        '<div class="dv-deedhead">' +
          '<div class="dn">' + esc(w ? (w.name || 'your world') : 'your world is unforged') + '</div>' +
          (w ? '<div class="dvis">' + esc(vis) + '</div>' : '') +
        '</div>' +
        '<div class="dv-deedsub">' +
          (w ? esc((w.visitCount || 0) + (w.visitCount === 1 ? ' soul has stood in it' : ' souls have stood in it'))
             : 'one name, one light, and it is on the map.') +
        '</div>' +
        '<div class="dv-deedrow">' +
          (w
            ? ('<button class="dv-gohome" id="dvGoHome"' + (atHome ? ' disabled' : '') + '>' +
                 (atHome ? '◉ you are home' : '⌂ travel home') + '</button>' +
               '<button class="dv-edit" id="dvEditWorld">✎ rename · retheme</button>')
            : '<button class="dv-gohome" id="dvEditWorld">✦ forge your world</button>') +
        '</div>' +
        '<div class="dv-forgeform" id="dvForge">' +
          '<div class="dv-field"><div class="dv-flabel">its name</div>' +
            '<input class="dv-in" id="dvWName" type="text" maxlength="40" autocomplete="off" ' +
              'placeholder="name it something worth traveling to">' +
            '<div class="dv-cnt" id="dvWCnt">0 / 40</div></div>' +
          '<div class="dv-field"><div class="dv-flabel">its light</div>' +
            '<div class="dv-swatches" id="dvWTheme"></div></div>' +
          '<div class="dv-field"><div class="dv-flabel">who may find it</div>' +
            '<div class="dv-vis" id="dvWVis">' +
              '<button data-v="public">on the map</button>' +
              '<button data-v="unlisted">by link only</button>' +
              '<button data-v="private">yours alone</button>' +
            '</div></div>' +
          '<button class="dv-send" id="dvWSave">' + (w ? 'save the deed' : '✦ forge it') + '</button>' +
          '<div class="dv-note" id="dvWNote">' +
            (w ? 'one world, one deed — this edits the world you already hold.'
               : 'you get one world. it starts empty and becomes yours a little more every day.') +
          '</div>' +
        '</div>' +
      '</div>';

    var goHome = box.querySelector('#dvGoHome');
    if (goHome && !atHome && _me) goHome.onclick = function () {
      beginWarp({ id: _me.id, name: (_myWorld && _myWorld.name) || 'your world' });
    };

    // seed the form state from the live deed so an edit never silently resets a field
    _forgeTheme = themeVal; _forgeVis = vis;
    var form = box.querySelector('#dvForge');
    var nameIn = box.querySelector('#dvWName');
    var cnt = box.querySelector('#dvWCnt');
    if (nameIn) {
      nameIn.value = (w && w.name) || '';
      var sync = function () { if (cnt) cnt.textContent = nameIn.value.length + ' / 40'; };
      nameIn.oninput = sync; sync();
    }
    var sw = box.querySelector('#dvWTheme');
    if (sw) THEMES.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'dv-sw' + (t.v === _forgeTheme ? ' on' : '');
      b.style.background = t.v; b.type = 'button';
      b.setAttribute('aria-label', t.n); b.title = t.n;
      b.onclick = function () {
        _forgeTheme = t.v;
        sw.querySelectorAll('.dv-sw').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      };
      sw.appendChild(b);
    });
    var visBox = box.querySelector('#dvWVis');
    if (visBox) visBox.querySelectorAll('button').forEach(function (b) {
      if (b.getAttribute('data-v') === _forgeVis) b.classList.add('on');
      b.onclick = function () {
        _forgeVis = b.getAttribute('data-v');
        visBox.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      };
    });
    var edit = box.querySelector('#dvEditWorld');
    if (edit && form) edit.onclick = function () {
      _forgeOpen = !_forgeOpen;
      form.classList.toggle('on', _forgeOpen);
      if (_forgeOpen && nameIn) setTimeout(function () { nameIn.focus(); }, 60);
    };
    if (_forgeOpen && form) form.classList.add('on');
    var save = box.querySelector('#dvWSave');
    if (save) save.onclick = function () { saveWorld(save, nameIn); };
  }

  function saveWorld(btn, nameIn) {
    var wasForged = !!_myWorld;
    btn.disabled = true; var old = btn.textContent; btn.textContent = 'sealing…';
    fetch(base() + '/api/universe/world', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify({
        name: (nameIn && nameIn.value.trim().slice(0, 40)) || '',
        theme: _forgeTheme,
        visibility: _forgeVis
      })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        btn.disabled = false; btn.textContent = old;
        if (!res.ok || !res.j || !res.j.ok) {
          toast(res.j && res.j.error === 'unauthorized'
            ? 'sign in to forge your world.'
            : 'the deed didn\'t take. try once more.');
          return;
        }
        _myWorld = res.j.world;
        _forgeOpen = false;
        renderDeed();
        loadWorlds(false); // the map re-sorts around a newly public world
        toast(wasForged ? 'the deed is updated.' : '✦ forged · ' + (_myWorld.name || 'your world'));
      })
      .catch(function () { btn.disabled = false; btn.textContent = old; toast('the deed didn\'t reach the world.'); });
  }

  // arriving anywhere re-renders the deed so "travel home" / "you are home" is
  // never stale (it's the same button that flips state).
  W.addEventListener('vint:world-travel', function () { renderDeed(); });

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT VENTURES — send an agent to work; watch the ledger settle green/red
  // ═══════════════════════════════════════════════════════════════════════════
  var _agentSheet = null, _selAgent = AGENTS[0].id, _selKind = 'trade', _stake = 50, _lumen = 0;

  function buildAgentSheet() {
    if (_agentSheet) return _agentSheet;
    var el = document.createElement('div');
    el.className = 'dv-sheet'; el.id = 'dvAgentSheet';
    el.innerHTML =
      '<div class="dv-grip"></div>' +
      '<div class="dv-head">' +
        '<div class="dv-title" id="dvAgentTitle">your agents<small>they live here now</small></div>' +
        '<button class="dv-x" id="dvAgentX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-tabs">' +
        '<button class="dv-tab on" data-pane="cits">your agents</button>' +
        '<button class="dv-tab" data-pane="work">send to work</button>' +
      '</div>' +
      // PANE 1 · AGENTIS — the real roster + the conversation, inside the world.
      '<div class="dv-body dv-pane on" id="dvPaneCits">' +
        '<div id="dvCitList"></div>' +
      '</div>' +
      // PANE 1b · the open conversation (its own pane so a thread never renders
      // over the roster — exactly one of the three is ever display:flex).
      '<div class="dv-body dv-pane" id="dvPaneConvo">' +
        '<div class="dv-cvhead">' +
          '<button class="dv-back" id="dvCvBack">← all</button>' +
          '<div class="dv-cvwho" id="dvCvWho">—</div>' +
        '</div>' +
        '<div class="dv-thread" id="dvThread" aria-live="polite"></div>' +
        '<div class="dv-comp">' +
          '<textarea id="dvCvInput" rows="1" maxlength="4000" aria-label="say something" ' +
            'placeholder="say something…"></textarea>' +
          '<button class="dv-send" id="dvCvSend">say</button>' +
        '</div>' +
      '</div>' +
      // PANE 2 · the VENTURE economy — untouched, server-authoritative, preserved.
      '<div class="dv-body dv-pane" id="dvPaneWork">' +
        '<div class="dv-field"><div class="dv-flabel">who goes</div><div class="dv-agrid" id="dvAgents"></div></div>' +
        '<div class="dv-field"><div class="dv-flabel">the work</div><div class="dv-kind" id="dvKinds"></div></div>' +
        '<div class="dv-field"><div class="dv-flabel">the stake (lumen)</div>' +
          '<div class="dv-stakebox">' +
            '<input class="dv-stake" id="dvStake" type="range" min="10" max="500" step="10" value="50">' +
            '<span class="dv-stakeval" id="dvStakeVal">◇ 50</span>' +
          '</div></div>' +
        '<button class="dv-send" id="dvSend">⟿ send to work</button>' +
        '<div class="dv-note" id="dvSendNote">the stake is escrowed. it comes back richer, or it doesn\'t come back.</div>' +
        '<div class="dv-ledger">' +
          '<div class="dv-ltitle">the ledger <button class="dv-refresh" id="dvRefresh">↻ refresh</button></div>' +
          '<div id="dvLedger"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    _agentSheet = el;
    el.querySelector('#dvAgentX').onclick = closeAgent;

    // agent chips (council presences + YOUR real agents — see renderVentureChips)
    renderVentureChips();
    // kind rows
    var kd = el.querySelector('#dvKinds');
    KINDS.forEach(function (k) {
      var b = document.createElement('button');
      b.className = 'dv-krow' + (k.k === _selKind ? ' on' : '');
      b.innerHTML = '<b>' + esc(k.n) + '</b><span class="sub">' + esc(k.sub) + '</span><span class="odds">' + esc(k.odds) + '</span>';
      b.onclick = function () { _selKind = k.k; kd.querySelectorAll('.dv-krow').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); };
      kd.appendChild(b);
    });
    // stake slider
    var stake = el.querySelector('#dvStake'), stakeVal = el.querySelector('#dvStakeVal');
    stake.oninput = function () {
      _stake = parseInt(stake.value, 10) || 0;
      stakeVal.textContent = '◇ ' + _stake;
      var over = _lumen && _stake > _lumen;
      stakeVal.style.color = over ? '#ff7a7a' : '#9fdcff';
      el.querySelector('#dvSend').disabled = over;
      el.querySelector('#dvSendNote').textContent = over
        ? 'that\'s more lumen than you hold — harvest more, or stake less.'
        : 'the stake is escrowed. it comes back richer, or it doesn\'t come back.';
    };
    el.querySelector('#dvSend').onclick = sendVenture;
    el.querySelector('#dvRefresh').onclick = function () { loadLedger(); };

    // ── tabs: your agents ⇄ send to work ──────────────────────────────────────
    el.querySelectorAll('.dv-tab').forEach(function (t) {
      t.onclick = function () {
        el.querySelectorAll('.dv-tab').forEach(function (x) { x.classList.remove('on'); });
        t.classList.add('on');
        showPane(t.getAttribute('data-pane'));
      };
    });
    // conversation wiring
    el.querySelector('#dvCvBack').onclick = function () { showPane('cits'); };
    el.querySelector('#dvCvSend').onclick = sendToAgent;
    var ci = el.querySelector('#dvCvInput');
    ci.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendToAgent(); }
    });
    // auto-grow, capped by max-height so it can never eat the thread
    ci.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 110) + 'px';
    });

    _grip(el);
    return el;
  }

  // Exactly ONE pane is ever visible. The tab row reflects the two top-level
  // modes; the conversation is a child of "your agents" so the tab stays lit.
  var _pane = 'cits';
  function showPane(which) {
    if (!_agentSheet) return;
    _pane = which;
    ['cits', 'convo', 'work'].forEach(function (p) {
      var n = _agentSheet.querySelector('#dvPane' + p.charAt(0).toUpperCase() + p.slice(1));
      if (n) n.classList.toggle('on', p === which);
    });
    // the tab row only knows two modes; convo keeps "your agents" lit
    var lit = which === 'work' ? 'work' : 'cits';
    _agentSheet.querySelectorAll('.dv-tab').forEach(function (x) {
      x.classList.toggle('on', x.getAttribute('data-pane') === lit);
    });
    var title = _agentSheet.querySelector('#dvAgentTitle');
    if (title) {
      title.innerHTML = which === 'work'
        ? 'send an agent to work<small>real stake · real odds · real profit</small>'
        : 'your agents<small>they live here now</small>';
    }
    if (which === 'work') loadLedger();
    if (which === 'cits') loadMine();
  }

  function openAgent() {
    openSheet('agent', function () {
      buildAgentSheet();
      _agentSheet.classList.add('open');
      showPane(_pane === 'convo' ? 'cits' : _pane);
    });
  }
  // public: court.js calls this after an add/pause/send-home so a court member
  // brought in mid-session is immediately stakeable, with no reopen. The roster
  // itself comes from loadMine() → _mine, which renderVentureChips() merges with
  // the council; the court does not keep a second copy.
  function refreshVentureAgents() { if (_agentSheet) { loadMine(); } }
  function closeAgent() { if (_agentSheet) _agentSheet.classList.remove('open'); syncScrim(); }

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENTIS IN THE WORLD — GAP-1 close. The agents you brought in from Claude,
  // ChatGPT, Gemini and Agentis used to exist ONLY on the flat 2D page; inside
  // the engine the ◈ sheet offered five hardcoded council presences to stake
  // lumen on and nothing of yours. Now your real roster stands in the world,
  // and you can talk to any of them without ever leaving it.
  // ═══════════════════════════════════════════════════════════════════════════
  function loadMine() {
    var box = _agentSheet && _agentSheet.querySelector('#dvCitList');
    if (!box) return;
    if (!token()) { _mineState = 'guest'; renderMine(); return; }
    if (_mineState !== 'ok') { _mineState = 'loading'; renderMine(); }
    fetch(base() + '/api/agents/mine', { headers: authHeaders() })
      .then(function (r) {
        if (r.status === 401) { _mineState = 'guest'; return null; }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (j) {
        if (j) { _mine = (j && j.agents) || []; _mineState = 'ok'; }
        renderMine();
        renderVentureChips(); // your real agents can now be sent to work too
      })
      .catch(function () { _mineState = 'error'; renderMine(); });
  }

  function renderMine() {
    var box = _agentSheet && _agentSheet.querySelector('#dvCitList');
    if (!box) return;

    if (_mineState === 'loading') { box.innerHTML = '<div class="dv-empty">gathering them…</div>'; return; }
    if (_mineState === 'error') {
      box.innerHTML = '<div class="dv-empty">couldn\'t reach them just now.</div>'; return;
    }
    // GUEST — a doorway, never a wall (consistent with world.html's #invite).
    if (_mineState === 'guest') {
      box.innerHTML =
        '<div class="dv-door">' +
          '<div class="dh">your agents can live here</div>' +
          '<div class="ds">the ones you already talk to elsewhere — they walk in with you, ' +
            'and unlike where they came from, they remember you between visits.</div>' +
          '<a class="da" href="welcome.html">bring them in →</a>' +
        '</div>';
      return;
    }
    if (!_mine.length) {
      box.innerHTML =
        '<div class="dv-door">' +
          '<div class="dh">no one here yet</div>' +
          '<div class="ds">bring an agent in from Claude, ChatGPT, Gemini or Agentis — ' +
            'or write one from scratch. whoever you bring becomes a citizen of your world.</div>' +
          '<a class="da" href="welcome.html#agents">bring your agents in →</a>' +
        '</div>';
      return;
    }

    box.innerHTML = '<div class="dv-cits" id="dvCitsInner"></div>';
    var inner = box.querySelector('#dvCitsInner');
    _mine.forEach(function (a) {
      var color = _agentColor(a.color);
      var paused = a.status === 'paused';
      var src = SOURCE_NAMES[a.source] || a.source || 'elsewhere';
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dv-cit' + (paused ? ' paused' : '');
      b.style.setProperty('--cc', color);
      var initial = String(a.name || '?').trim().charAt(0).toUpperCase() || '?';
      b.innerHTML =
        '<span class="cav">' + esc(initial) + '</span>' +
        '<span class="ctxt">' +
          '<span class="cname">' + esc(a.name || 'unnamed') + '</span>' +
          '<span class="cmeta">from ' + esc(src) +
            (a.description ? ' · ' + esc(a.description) : '') + '</span>' +
        '</span>' +
        (paused ? '<span class="cbadge">paused</span>' : '<span class="cgo">talk →</span>');
      b.onclick = function () { openConvo(a); };
      inner.appendChild(b);
    });
  }

  // ── the conversation, inside the world ─────────────────────────────────────
  var _cur = null, _streaming = false;

  function openConvo(a) {
    _cur = a;
    var el = _agentSheet;
    var color = _agentColor(a.color);
    var pane = el.querySelector('#dvPaneConvo');
    pane.style.setProperty('--cc', color);
    el.querySelector('#dvCvWho').textContent = a.name || 'agent';
    el.querySelector('#dvThread').innerHTML = '';
    showPane('convo');
    loadHistory(a.id);
  }

  function loadHistory(id) {
    var th = _agentSheet.querySelector('#dvThread');
    th.innerHTML = '<div class="dv-empty">remembering…</div>';
    fetch(base() + '/api/agents/' + encodeURIComponent(id) + '/messages', { headers: authHeaders() })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        th.innerHTML = '';
        var msgs = (j && j.messages) || [];
        if (!msgs.length) { th.innerHTML = '<div class="dv-empty">nothing said yet. start it.</div>'; return; }
        msgs.forEach(function (m) { addMsg(m.role === 'user' ? 'me' : 'them', m.content); });
        _scrollThread();
      })
      .catch(function () { th.innerHTML = '<div class="dv-empty">nothing said yet. start it.</div>'; });
  }

  // textContent everywhere — a model's reply is never parsed as HTML.
  function addMsg(who, text, isErr) {
    var th = _agentSheet.querySelector('#dvThread');
    var m = document.createElement('div');
    m.className = 'dv-msg ' + (who === 'me' ? 'me' : 'them');
    var w = document.createElement('div'); w.className = 'mw';
    w.textContent = who === 'me' ? 'you' : ((_cur && _cur.name) || 'agent');
    var t = document.createElement('div'); t.className = 'mt' + (isErr ? ' err' : '');
    t.textContent = text || '';
    m.appendChild(w); m.appendChild(t);
    th.appendChild(m); _scrollThread();
    return t;
  }
  function _scrollThread() {
    var th = _agentSheet && _agentSheet.querySelector('#dvThread');
    if (th) th.scrollTop = th.scrollHeight;
  }

  // The round-trip: POST → SSE {delta} frames → [DONE]. Same reader shape as
  // agents.html, so one contract serves the flat page and the world alike.
  function sendToAgent() {
    if (_streaming || !_cur) return;
    var el = _agentSheet;
    var input = el.querySelector('#dvCvInput');
    var text = (input.value || '').trim();
    if (!text) return;
    if (!token()) { toast('sign in to talk to your agents.'); return; }

    var empty = el.querySelector('#dvThread .dv-empty');
    if (empty) empty.remove();

    addMsg('me', text);
    input.value = ''; input.style.height = 'auto';
    _streaming = true;
    var sendBtn = el.querySelector('#dvCvSend');
    sendBtn.disabled = true;

    var out = addMsg('them', '');
    var cur = document.createElement('span'); cur.className = 'dv-cur';
    out.appendChild(cur);
    var acc = '';

    fetch(base() + '/api/agents/' + encodeURIComponent(_cur.id) + '/chat', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify({ message: text })
    }).then(function (r) {
      if (!r.ok || !r.body) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          throw new Error(_agentErr(r.status, j));
        });
      }
      var reader = r.body.getReader(), dec = new TextDecoder(), buf = '';
      function pump() {
        return reader.read().then(function (res) {
          if (res.done) return;
          buf += dec.decode(res.value, { stream: true });
          var lines = buf.split('\n');
          buf = lines.pop();                       // keep the partial line for next chunk
          lines.forEach(function (line) {
            line = line.trim();
            if (!line || line.charAt(0) === ':') return;    // comments / heartbeats
            if (line.indexOf('data:') !== 0) return;
            var payload = line.slice(5).trim();
            if (payload === '[DONE]') return;
            try {
              var d = JSON.parse(payload);
              if (d.delta) { acc += d.delta; out.textContent = acc; out.appendChild(cur); _scrollThread(); }
              else if (d.error) { throw new Error(d.message || d.error); }
            } catch (e) {
              if (e instanceof SyntaxError) return;         // ignore non-JSON frames
              throw e;
            }
          });
          return pump();
        });
      }
      return pump();
    }).then(function () {
      if (cur.parentNode) cur.remove();
      if (!acc.trim()) { out.textContent = ((_cur && _cur.name) || 'they') + ' went quiet.'; out.className = 'mt err'; }
      _finishConvo();
    }).catch(function (err) {
      if (cur.parentNode) cur.remove();
      out.textContent = (err && err.message) || 'the line dropped.';
      out.className = 'mt err';
      _finishConvo();
    });
  }

  function _finishConvo() {
    _streaming = false;
    var b = _agentSheet && _agentSheet.querySelector('#dvCvSend');
    if (b) b.disabled = false;
    _scrollThread();
  }

  // Never show a raw code to a human. 409/410/404/429 all get real sentences.
  function _agentErr(statusCode, j) {
    var name = (_cur && _cur.name) || 'they';
    var code = (j && (j.error || j.code)) || '';
    if (statusCode === 409 || code === 'agent_paused') return (j && j.message) || (name + ' is paused. resume them to talk.');
    if (statusCode === 410 || code === 'agent_archived') return name + ' has been archived.';
    if (statusCode === 404 || code === 'not_found') return name + ' isn\'t in your roster anymore.';
    if (statusCode === 400 || code === 'message_required') return 'say something first.';
    if (statusCode === 401) return 'sign in to talk to your agents.';
    if (statusCode === 429) return 'you\'ve reached today\'s ration. it resets at midnight UTC.';
    return (j && j.message) || ('couldn\'t reach ' + name + '.');
  }

  // ── the bridge: YOUR agents can be sent to work too ────────────────────────
  // /api/agent/venture takes any {agentId} string (≤48 chars) and the ledger is
  // keyed by it, so a real user agent rides the EXISTING server-authoritative
  // escrow with zero server change. This is a genuine extension, not a costume:
  // the stake, the odds and the settle are the same ones the council presences use.
  function renderVentureChips() {
    var ag = _agentSheet && _agentSheet.querySelector('#dvAgents');
    if (!ag) return;
    ag.innerHTML = '';
    var list = AGENTS.slice();
    _mine.forEach(function (a) {
      if (a.status === 'paused' || a.status === 'archived') return; // can't send who can't work
      list.push({ id: String(a.id).slice(0, 48), n: a.name || 'agent', c: _agentColor(a.color), mine: true });
    });
    if (!list.some(function (x) { return x.id === _selAgent; })) _selAgent = list[0].id;
    list.forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'dv-achip' + (a.id === _selAgent ? ' on' : '');
      b.innerHTML = '<span class="k" style="background:' + esc(a.c) + '"></span>' + esc(a.n);
      b.onclick = function () {
        _selAgent = a.id;
        ag.querySelectorAll('.dv-achip').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      };
      ag.appendChild(b);
    });
  }

  function sendVenture() {
    var btn = _agentSheet.querySelector('#dvSend');
    if (btn.disabled) return;
    btn.disabled = true; var old = btn.textContent; btn.textContent = 'sending…';
    fetch(base() + '/api/agent/venture', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify({ agentId: _selAgent, kind: _selKind, stake: _stake })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        btn.disabled = false; btn.textContent = old;
        if (!res.ok || (res.j && res.j.error)) {
          var e = (res.j && (res.j.error || res.j.code)) || 'could not send';
          toast(_ventureErr(e));
          return;
        }
        var nm = _agentName(_selAgent);
        toast('◇ ' + _stake + ' escrowed · ' + nm + ' is off to ' + _selKind);
        loadLedger(); // the running row appears; poll settles it
        _pollSettle();
      })
      .catch(function () { btn.disabled = false; btn.textContent = old; toast('the venture didn\'t reach the world.'); });
  }

  function _ventureErr(code) {
    return ({
      'no_lumen': 'not enough lumen to stake — harvest first.',
      'insufficient': 'not enough lumen to stake — harvest first.',
      'insufficient_funds': 'not enough lumen to stake — harvest first.',
      'agent_busy': 'that agent is already out on a venture.',
      'busy': 'that agent is already out on a venture.',
      'rate': 'slow down — one venture at a time.',
      'unauthorized': 'sign in to send an agent to work.'
    })[code] || ('— ' + code);
  }

  function loadLedger() {
    var box = _agentSheet && _agentSheet.querySelector('#dvLedger');
    if (!box) return;
    if (!box.children.length) box.innerHTML = '<div class="dv-empty" style="padding:16px">no ventures yet.</div>';
    fetch(base() + '/api/agent/ventures', { headers: authHeaders() })
      .then(function (r) { return r.ok ? r.json() : { ventures: [] }; })
      .then(function (d) {
        var list = (d && d.ventures) || [];
        if (!list.length) { box.innerHTML = '<div class="dv-empty" style="padding:16px">no ventures yet — send one.</div>'; return; }
        box.innerHTML = '';
        var anyRunning = false;
        list.slice(0, 40).forEach(function (v) {
          var running = !v.settledAt && (v.status === 'running' || v.outcome == null);
          if (running) anyRunning = true;
          var row = document.createElement('div');
          row.className = 'dv-lrow' + (running ? ' running' : '');
          var delta = v.delta;
          var deltaCls = running ? '' : (delta > 0 ? 'win' : (delta < 0 ? 'loss' : ''));
          var deltaTxt = running ? '<span class="dv-spin"></span>'
            : (delta > 0 ? '+' + delta : (delta < 0 ? String(delta) : '±0'));
          var outcome = running ? 'out working…'
            : (v.outcome ? esc(v.outcome) : (delta > 0 ? 'profit' : (delta < 0 ? 'loss' : 'even')));
          row.innerHTML =
            '<div class="lk">' + esc(_agentName(v.agentId) || _kindName(v.kind)) +
              '<small>' + esc(_kindName(v.kind)) + ' · ' + outcome + '</small></div>' +
            '<div class="lstake">◇' + (v.stake != null ? v.stake : '—') + '</div>' +
            '<div class="ldelta ' + deltaCls + '">' + deltaTxt + '</div>';
          box.appendChild(row);
        });
        if (anyRunning) _pollSettle();
      })
      .catch(function () {});
  }

  var _pollT = null, _pollN = 0;
  function _pollSettle() {
    clearTimeout(_pollT); _pollN = 0;
    (function tick() {
      _pollN++;
      _pollT = setTimeout(function () {
        if (!_agentSheet || !_agentSheet.classList.contains('open')) return; // stop when closed
        loadLedger();
        if (_pollN < 20) tick(); // ~ up to 20 polls, backing off
      }, Math.min(1200 + _pollN * 400, 5000));
    })();
  }

  // the ledger names council presences AND your own agents — never a raw id.
  // Checks the council first, then your roster; a court member you have since
  // let go still reads as a person rather than a leaked uuid.
  function _agentName(id) {
    var a = AGENTS.find(function (x) { return x.id === id; });
    if (a) return a.n;
    var m = _mine.find(function (x) { return String(x.id) === String(id); });
    if (m) return m.name || id;
    if (String(id || '').indexOf('uagent:') === 0) return 'an agent of yours';
    return id;
  }
  function _kindName(k) { var x = KINDS.find(function (y) { return y.k === k; }); return x ? x.n.toLowerCase() : k; }

  // reflect live lumen from the First-Hearth resident state onto the stake slider
  W.addEventListener('vint:world-state', function (e) {
    var r = e.detail && e.detail.resident;
    if (r && r.lumen != null) {
      _lumen = r.lumen;
      if (_agentSheet) {
        var stake = _agentSheet.querySelector('#dvStake');
        if (stake) { stake.dispatchEvent(new Event('input')); }
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD PALETTE — the thumb-scroll strip, visible only on your own world
  // ═══════════════════════════════════════════════════════════════════════════
  var _buildBar = null, _selProp = null;
  // ── TIER GATING (re-applied from council/seat-2, 2026-09-26) ───────────────
  // The Ascent's companion in the build palette. A locked piece is drawn DIMMED
  // with the tier that opens it in its tooltip rather than hidden — you should be
  // able to SEE what you are climbing toward — and tapping it says what it costs
  // instead of pretending it worked. The server stays the only authority: if this
  // mirror is ever wrong the brain refuses the placement and names the tier.
  var _openKinds = null;      // null = the brain has not spoken yet → allow all
  var _tierTitle = '';

  function _kindOpen(k) {
    if (!_openKinds) return true;             // unknown → never block optimistically
    return _openKinds.indexOf(k) !== -1;
  }

  // ── THE FABRICATOR console (GPYSY83) ────────────────────────────────────────
  // The console only ever SAYS what the world-client's ghost judged (from the
  // server's own build zone) and what the server answered. It never decides.
  var _fabEl = null, _fabOk = false;
  function fabShow(p) {
    if (!_fabEl) return;
    _fabEl.querySelector('.fb-g').textContent = p.g;
    _fabEl.querySelector('.fb-n').textContent = p.n;
    _fabEl.classList.add('show');
    fitBuildBar();   // the console makes the bar taller — re-measure its neighbours
  }
  function fabPlace() {
    if (!_selProp) return;
    if (!_fabOk) {
      var v = _fabEl && _fabEl.querySelector('.fb-v');
      toast((v && v.textContent) || 'that piece cannot go there yet.');
      return;
    }
    var sent = false;
    try { sent = world().placeHere(_selProp); } catch (_) { sent = false; }
    // NEVER TOAST A SUCCESS WE DID NOT SEE: success is announced only when the
    // server's world:struct comes back (vint:world-placed below).
    if (sent !== true) toast('the clearing is out of reach — reload and try again.');
  }
  function fabExit() {
    _selProp = null;
    try { world().buildExit(); } catch (_) {}
    if (_fabEl) _fabEl.classList.remove('show');
    fitBuildBar();
    if (_buildBar) _buildBar.querySelectorAll('.dv-prop').forEach(function (x) { x.classList.remove('on'); });
  }
  W.addEventListener('vint:world-fab', function (e) {
    var d = e.detail; if (!_fabEl) return;
    if (!d) { _fabOk = false; return; }
    _fabOk = !!d.ok;
    var v = _fabEl.querySelector('.fb-v');
    var cost = '';
    if (d.cost) { var parts = []; for (var k in d.cost) parts.push(d.cost[k] + ' ' + k); cost = parts.length ? ' · costs ' + parts.join(' + ') : ''; }
    v.textContent = d.ok ? (d.why + cost) : d.why;
    v.classList.toggle('bad', !d.ok);
    var go = _fabEl.querySelector('.go'); go.disabled = !d.ok;
  });
  W.addEventListener('vint:world-fab-place', fabPlace);
  W.addEventListener('vint:world-fab-exit', fabExit);
  W.addEventListener('vint:world-placed', function (e) {
    var k = (e.detail && e.detail.kind) || 'piece';
    var p = null; PROPS.forEach(function (x) { if (x.k === k) p = x; });
    toast((p ? p.g + ' ' : '') + 'the ' + k + ' stands. keep going — tap it again to lay another.');
  });

  function buildPalette() {
    if (_buildBar) return _buildBar;
    var bar = document.createElement('div'); bar.id = 'dvBuild';
    var strip = document.createElement('div'); strip.className = 'dv-palette';
    PROPS.forEach(function (p) {
      var b = document.createElement('button'); b.className = 'dv-prop'; b.setAttribute('data-kind', p.k);
      b.innerHTML = '<span class="pg">' + esc(p.g) + '</span><span class="pn">' + esc(p.n) + '</span>';
      b.onclick = function () {
        // A LOCKED PIECE SAYS SO, and does not pretend to place. The world:err
        // handler carries the authoritative sentence when the server refuses;
        // this is the instant local echo so the tap is never silent.
        if (!_kindOpen(p.k)) {
          toast('the ' + p.n + ' is not yours to place yet — keep building.');
          return;
        }
        // FIRST TAP CHOOSES, SECOND TAP LAYS (GPYSY83). Choosing raises the
        // hologram one stride ahead so you SEE where it goes before strand is
        // spent; tapping the same piece again (or PLACE / Enter) lays it.
        if (_selProp === p.k) { fabPlace(); return; }
        strip.querySelectorAll('.dv-prop').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on'); _selProp = p.k;
        try { world().buildSelect(p.k); } catch (_) {}
        fabShow(p);
      };
      strip.appendChild(b);
    });
    var fab = document.createElement('div'); fab.className = 'dv-fab';
    fab.innerHTML =
      '<div class="fb-id"><span class="fb-g"></span><span class="fb-t">' +
        '<span class="fb-k">fabricator</span><span class="fb-n"></span>' +
        '<span class="fb-v" aria-live="polite"></span></span></div>' +
      '<div class="fb-act"><button type="button" class="fb-turn" title="turn a quarter (R)" aria-label="turn piece">⟳</button>' +
      '<button type="button" class="go" title="lay it (Enter)">PLACE</button>' +
      '<button type="button" class="fb-x" title="put the blueprint away (Esc)" aria-label="close">✕</button></div>';
    fab.querySelector('.fb-turn').onclick = function () { try { world().buildTurn(); } catch (_) {} };
    fab.querySelector('.go').onclick = fabPlace;
    fab.querySelector('.fb-x').onclick = fabExit;
    bar.appendChild(fab);
    _fabEl = fab;
    bar.appendChild(strip);
    document.body.appendChild(bar);
    _buildBar = bar;
    syncPalette();
    return bar;
  }

  // (dimmed + labelled) so the climb has something to point at.
  function syncPalette() {
    if (!_buildBar) return;
    _buildBar.querySelectorAll('.dv-prop').forEach(function (b) {
      var k = b.getAttribute('data-kind');
      var open = _kindOpen(k);
      b.classList.toggle('locked', !open);
      // aria + tooltip carry the reason, so the lock is never a mystery.
      b.setAttribute('aria-disabled', open ? 'false' : 'true');
      b.title = open
        ? k
        : (k + ' — opens further up the climb' + (_tierTitle ? ' (you are ' + _tierTitle + ')' : ''));
    });
  }

  // The brain's ladder picture arrives on every world:state. The palette reads
  // `climb.tier.kinds` — the single server-side truth about what is placeable —
  // and never derives an unlock of its own.
  W.addEventListener('vint:world-state', function (e) {
    var c = e.detail && e.detail.climb;
    if (!c || !c.tier || !Array.isArray(c.tier.kinds)) return;
    _openKinds = c.tier.kinds.slice();
    _tierTitle = String(c.tier.title || '');
    syncPalette();
  });
  var _buildOpen = false;
  // NO-COLLISION (GPYSY83): the launcher rail runs down the left edge and used
  // to sit ON TOP of the palette (measured: rail 12–104px × 330–732px over a
  // palette spanning the full width at 568–642px on a 375px phone). The bar now
  // starts where the rail ends whenever the two share any height — measured
  // live, so a rail that grows, compacts or moves is always respected.
  function fitBuildBar() {
    if (!_buildBar || !_buildOpen) return;
    _buildBar.style.left = '0px';
    var rail = document.getElementById('dvRail');
    if (!rail) return;
    var rr = rail.getBoundingClientRect(), br = _buildBar.getBoundingClientRect();
    // Beside a slim rail; ABOVE a wide one (a phone grid rail can span most of
    // the width, and a bar squeezed into the sliver beside it is unusable).
    var railBeside = rr.width && rr.bottom > br.top && rr.top < br.bottom && rr.left < W.innerWidth / 2;
    var railAbove = false;
    if (railBeside && W.innerWidth - rr.right - 12 >= 240) {
      _buildBar.style.left = Math.max(0, Math.round(rr.right - 4)) + 'px';
    } else if (railBeside) { railAbove = true; }
    // …and the bottom-right band: #topctl joins it on phones, the account dot
    // (#vwg-dot / #vwg-pill) lives there always. Whichever one the bar would
    // touch, the bar rises above it — the bar moves, never the neighbour.
    _buildBar.style.bottom = '';
    for (var pass = 0; pass < 3; pass++) {
      var b2 = _buildBar.getBoundingClientRect(), lift = 0;
      (railAbove ? ['topctl', 'vwg-dot', 'vwg-pill', 'dvRail'] : ['topctl', 'vwg-dot', 'vwg-pill']).forEach(function (id) {
        var el = document.getElementById(id); if (!el) return;
        var cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return;
        var r = el.getBoundingClientRect(); if (!r.width) return;
        if (r.left < b2.right && b2.left < r.right && r.top < b2.bottom && b2.top < r.bottom) {
          lift = Math.max(lift, Math.round(W.innerHeight - r.top + 6));
        }
      });
      if (!lift) break;
      _buildBar.style.bottom = lift + 'px';
    }
    // A screen too short for bar + HUD (320×640 measured: the lifted bar met
    // #vintWorldHud and #hint). Build mode then takes the screen: those two step
    // aside until the palette closes — the fabricator console carries the cost
    // and the verdict meanwhile. Applied only when they would actually touch.
    document.body.classList.remove('dv-building-tight');
    var b3 = _buildBar.getBoundingClientRect(), tight = false;
    ['vintWorldHud', 'hint', 'editHeadBtn'].forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      var r = el.getBoundingClientRect(); if (!r.width) return;
      if (r.left < b3.right && b3.left < r.right && r.top < b3.bottom && b3.top < r.bottom) tight = true;
    });
    if (tight) document.body.classList.add('dv-building-tight');
  }
  W.addEventListener('resize', fitBuildBar);
  function toggleBuild() {
    buildPalette();
    if (!world() || !world().canBuild || !world().canBuild()) { toast('you can only build in your own world.'); return; }
    _buildOpen = !_buildOpen;
    _buildBar.classList.toggle('show', _buildOpen);
    if (!_buildOpen) { fabExit(); document.body.classList.remove('dv-building-tight'); }
    fitBuildBar();
  }
  function updateBuildVisibility() {
    var can = world() && world().canBuild && world().canBuild();
    var launch = document.getElementById('dvBuildBtn');
    if (launch) launch.style.display = can ? 'flex' : 'none';
    if (!can && _buildBar) { _buildBar.classList.remove('show'); _buildOpen = false; fabExit(); document.body.classList.remove('dv-building-tight'); }
  }
  // react to the server's authoritative canBuild flag on every world:state
  W.addEventListener('vint:world-state', updateBuildVisibility);
  W.addEventListener('vint:world-travel', function () { if (_buildBar) { _buildBar.classList.remove('show'); _buildOpen = false; fabExit(); document.body.classList.remove('dv-building-tight'); } });

  // ═══════════════════════════════════════════════════════════════════════════
  // LAUNCHERS — draggable rail buttons (obey the all-buttons-draggable law)
  // ═══════════════════════════════════════════════════════════════════════════
  // The rail is the ONE fixed box; every launcher lives inside it in normal flow.
  // Nothing here is individually position:fixed, so no launcher can ever be
  // dragged or reflowed onto another fixed surface — the rail owns its space.
  var _rail = null;
  // Coarse-pointer (touch) devices have no hover: labels must stay visible and the
  // rail must never compact to glyph-only. Set live at mount + on pointer change.
  var _coarse = false;
  function railEl() {
    if (_rail) return _rail;
    _rail = document.createElement('div');
    _rail.id = 'dvRail';
    document.body.appendChild(_rail);
    return _rail;
  }

  function makeLauncher(id, label, glyph, onClick) {
    var b = document.createElement('button');
    b.id = id; b.className = 'dv-launch';
    // NOT draggable: these are flow children of a bounded, scrollable rail. Letting
    // them be dragged free would re-introduce exactly the fixed-element collisions
    // the rail exists to make impossible (drag would pin them over #vintWorldHud /
    // #editHeadBtn / #saybar). The rail itself is the stable, collision-proof home.
    b.setAttribute('data-draggable', 'false');
    // ── THE GLYPH AND THE NAME ARE SEPARATE SPANS (2026-09-25) ───────────────
    // They used to share one `.lbl`, and three CSS rules set `.lbl{display:none}`
    // to compact the rail. MEASURED in Chromium across 8 viewports × 4 compaction
    // states × 17 launchers (544 buttons): 425 of them rendered as a 46×46 pill
    // containing NO TEXT AT ALL — not even the glyph, because the glyph was
    // inside the span being hidden. A bare dot in a circle. Every mounted
    // launcher was unidentifiable the moment the rail compacted, and on a phone
    // compaction is not the edge case, it is the NORMAL path (17 launchers can
    // never fit a phone's band uncompacted). Vinta's report — "the buttons are
    // hidden without hovering tooltips to see which buttons are which" — is
    // exactly this, and `title=` was the only remaining identification, which a
    // touch device cannot show at all.
    //
    // So the glyph gets its own span and the name gets its own span. Compaction
    // now shrinks the NAME (clamp + a lower ceiling) instead of deleting it, and
    // the glyph is never inside anything that can be hidden. The invariant this
    // buys is checkable and is checked: every .dv-launch has non-empty visible
    // text at every viewport and in every compaction state.
    //
    // aria-label carries the plain name so the accessible name never includes the
    // decorative glyph, and the glyph is aria-hidden for the same reason.
    b.setAttribute('aria-label', String(label));
    b.innerHTML = '<span class="dot"></span>' +
      '<span class="gly" aria-hidden="true">' + esc(glyph) + '</span>' +
      '<span class="lbl">' + esc(label) + '</span>';
    b.addEventListener('click', function () { onClick(); });
    railEl().appendChild(b);
    return b;
  }

  // ── THE COLLISION GUARD (measured, not assumed) ─────────────────────────────
  // #vintWorldHud is a fixed left panel (top:64px, width 228px) whose height is
  // content-driven — it grows with the resident's stats/actions. The rail grows
  // upward from the bottom on the SAME left edge. So the only honest way to keep
  // them apart is to measure the panel live and hand the rail a hard ceiling.
  // Re-measured on resize, orientation change, and every world:state (the panel
  // re-renders on state, which is exactly when its height can change).
  function layoutRail() {
    if (!_rail) return;
    var vh = W.innerHeight || document.documentElement.clientHeight || 800;
    var css = document.documentElement.style;

    // 1) the ceiling: the live bottom edge of #vintWorldHud + a 16px gutter.
    var top = 270; // safe static floor if the panel isn't mounted yet
    var panel = document.getElementById('vintWorldHud');
    if (panel) {
      var pr = panel.getBoundingClientRect();
      if (pr.height > 0 && pr.bottom > 0) top = pr.bottom + 16;
    }
    // #hint (the W/A/S/D keys line) also lives in this left column, below the
    // panel — and as of THE VIGIL (2026-08-04) it is folded into this ceiling.
    //
    // It used to be excluded on the reasoning that the rail starts where the
    // panel ends and pushing it below the hint would shorten the launcher band.
    // That held only while #hint sat at a hardcoded top:274px — i.e. ABOVE where
    // any rail could reach. The vigil made #vintWorldHud content-driven and the
    // hint now derives its own top from --vint-hud-bottom, so on a tall desktop
    // a panel with watchers puts the hint at ~600px, squarely inside the rail's
    // band. Measured at 1280x800 that was a 108x28px overlap of the keys line by
    // the launchers — two elements, same pixels, exactly the cardinal sin.
    //
    // So the ceiling is now the LOWER of the two neighbours in this column. The
    // hint is desktop-only (hidden on coarse pointers), so this costs the short
    // touch viewports — the ones that can least afford it — precisely nothing.
    // NOTE ON THE VISIBILITY TEST: #hint is position:fixed, and a fixed element
    // ALWAYS reports offsetParent === null — so the `offsetParent !== null` idiom
    // used for #saybar (which is static) silently reports "hidden" here and the
    // fold-in never happened. Measured, that left a 16px band of launchers on the
    // keys line. Fixed elements must be tested by computed display instead.
    var hint = document.getElementById('hint');
    if (hint && getComputedStyle(hint).display !== 'none') {
      var hr = hint.getBoundingClientRect();
      if (hr.height > 0 && hr.bottom > 0) top = Math.max(top, hr.bottom + 16);
    }
    // #status keeps clear of the hint by bounding its own width instead — a
    // horizontal solution to a horizontal problem (see world.html's #status).

    // 2) the floor: the live top edge of #saybar + a 12px gutter (it's a
    //    full-width bar, so the rail must clear it vertically, not dodge it).
    //
    //    #saybar IS position:fixed, AND A FIXED ELEMENT ALWAYS REPORTS
    //    offsetParent === null (93H6E4T). The `offsetParent !== null` idiom is
    //    the visibility test for a STATICALLY-positioned element; used on the
    //    fixed say bar it scored it "hidden" on EVERY pass, so this floor was
    //    never measured, `bot` kept its 150 default, and step 3b below then
    //    borrowed that back down to 8 under launcher pressure — running the rail
    //    straight onto the say input (MEASURED at 1280x800: rail bottom 792 vs
    //    saybar top 726, the star-map launcher sitting on the input). The comment
    //    at #hint a few lines up already names this exact trap and tests by
    //    computed display instead; the say bar must do the same.
    //
    //    AND THE CLEARANCE IS UN-BORROWABLE (sayFloor). A launcher under the
    //    full-width say input is unhittable — the input (z6) paints over it — so
    //    the saybar floor is protected from the squeeze (steps 3 and 3b) exactly
    //    like botFloor/inviteFloor/dockFloor. Writing it into `bot` alone is not
    //    enough: those steps are allowed to reclaim `bot` down toward 8, and the
    //    say bar was never in their protected set, which is how an 88px clearance
    //    became 8px the moment the column overflowed.
    var bot = 150, sayFloor = 0;
    var say = document.getElementById('saybar');
    if (say && getComputedStyle(say).display !== 'none') {
      var sr = say.getBoundingClientRect();
      if (sr.height > 0 && sr.top < vh) { sayFloor = Math.max(88, vh - sr.top + 12); bot = Math.max(bot, sayFloor); }
    }

    // 2a) THE GUEST DOORWAY IS A FULL-WIDTH BAR TOO (AETHERHOLD 2026-08-08).
    //     #invite is world.html's guest sheet: a centred bottom sheet up to 500px
    //     wide that, on a phone, spans nearly the whole width and stands up to
    //     288px tall. The rail never yielded to it, because it is neither #saybar
    //     nor a `.dv-sheet` — so `botFloor` stayed 0 and the rail ran straight
    //     into it. MEASURED on a guest load of the real page:
    //         320×720 → rail y234..570, #invite y417..705 → 153px of overlap
    //         375×720 → rail y234..570, #invite y497..704 →  73px of overlap
    //     and both share the left column (each starts at x=12), so the doorway
    //     painted over the bottom launchers and a guest simply could not tap
    //     them. world.html does register #invite with VintDock.avoid(), but that
    //     governs the DOCKED CORNER PILLS, not this rail — two different
    //     registries, and the rail was never told.
    //
    //     Note this is the exact failure mode the step-2b comment below predicted
    //     ("a list that has to be edited by whoever adds a surface is a list that
    //     will be wrong"); #invite predates that selector and was never in it. So
    //     it is folded into the FLOOR rather than added to a sheet list: it is a
    //     bottom-anchored full-width bar, which is what `bot` already means, and
    //     the rail shortens to clear it exactly as it does for the say bar. When
    //     the guest collapses the doorway to its pill (`.min`) it measures ~60px
    //     tall and the rail slides back down on its own — no special case, just
    //     the live measurement doing its job.
    //
    //     IT IS A FLOOR THE SQUEEZE MAY NOT BORROW BACK. Writing this into `bot`
    //     alone is not enough: step 3 is allowed to reclaim the floor down to
    //     `botFloor` when the band gets too short, and `botFloor` was only ever
    //     set for open sheets. Measured at 375×720 that borrowed 15px straight
    //     back (rail bottom 220px where the doorway needed 235px) and put the
    //     launchers 3px inside #invite again — a correct floor, quietly undone
    //     downstream. #invite is precisely the case the botFloor rule exists for:
    //     the rail can survive being short because it scrolls, but a launcher
    //     underneath an opaque sheet cannot be tapped at all.
    //
    //     MEASURE ITS DESTINATION, NOT ITS FLIGHT PATH. #invite rises with an
    //     0.8s animation, so for most of a second `getBoundingClientRect().top`
    //     reports a position ~288px below where the sheet will actually come to
    //     rest. Reacting to that transient produced a real (if brief) overlap of
    //     2–4px in the window between the doorway appearing and the animation
    //     finishing — the layout converged to a correct −12px afterwards, but
    //     "correct once it settles" is not what the no-collision law asks for.
    //     Its resting geometry is fully knowable WITHOUT waiting: the sheet is
    //     bottom-anchored (bottom:16px + safe-area) and its HEIGHT is already
    //     final from the first frame — only its transform is moving. So the floor
    //     is computed from height + the CSS bottom offset, which is stable from
    //     the moment it is displayed and identical to where it lands. The
    //     animationend/observer hooks below still fire, but they now only confirm
    //     a number the very first pass already got right.
    var inviteFloor = 0;
    var inv = document.getElementById('invite');
    if (inv && getComputedStyle(inv).display !== 'none') {
      var ir = inv.getBoundingClientRect();
      if (ir.height > 0) {
        var ics = getComputedStyle(inv);
        var iBottom = parseFloat(ics.bottom);
        if (!isFinite(iBottom) || iBottom < 0) iBottom = 0;
        // resting top = vh - (bottom offset + height); floor = vh - that + gutter
        inviteFloor = iBottom + ir.height + 12;
        // never let a transform-in-flight report a LARGER floor than the resting
        // one either — take the resting value as the single source of truth.
        bot = Math.max(bot, inviteFloor);
      }
    }

    // 2a') THE BOTTOM-LEFT DOCK IS A FLOOR TOO (GEJ8NYU). #vintVoice (and any
    //      sibling on the corner dock's 'bl' stack) sits at left:16 — inside the
    //      rail's own column — and the rail never knew: world.html's own audit
    //      records "#dvRail x #vintVoice overlapped 42x44 at EVERY width", and
    //      verify-rail-reach.js MEASURED it again at 320x568/320x812/375x812/
    //      768x1024/1920x1080. It only bit when step 3/3b borrowed the floor, so
    //      whether a launcher landed on the mic depended on how much the squeeze
    //      happened to take. The dock does not move for the rail (the rail is not
    //      registered as a dock obstacle — it would shove the stack up into the
    //      panel), so the rail yields instead: the bl stack's live top becomes an
    //      un-borrowable floor, exactly like #invite. Read from the dock's own
    //      registry so a new bl widget is covered the day it ships; only slots
    //      that actually intrude on the rail's column count.
    var dockFloor = 0;
    try {
      var D = W.VintDock;
      var dslots = (D && typeof D._slots === 'function') ? D._slots() : [];
      var railL = 12;
      try { railL = _rail.getBoundingClientRect().left; } catch (_) {}
      for (var di = 0; di < dslots.length; di++) {
        var ds = dslots[di];
        if (!ds || ds.corner !== 'bl' || !ds.el || !ds.el.isConnected) continue;
        var dcs = getComputedStyle(ds.el);
        if (dcs.display === 'none' || dcs.visibility === 'hidden' || +dcs.opacity < 0.05) continue;
        var dr = ds.el.getBoundingClientRect();
        if (dr.width < 2 || dr.height < 2 || dr.top >= vh) continue;
        if (dr.left > railL + 46) continue;              // not in the rail's column
        dockFloor = Math.max(dockFloor, vh - dr.top + 12);
      }
    } catch (_) {}
    if (dockFloor > 0 && dockFloor < vh) bot = Math.max(bot, dockFloor); else dockFloor = 0;

    // 2b) AN OPEN SHEET IS A FULL-WIDTH BAR TOO. Measured at 375×812 the rail
    //     runs 336→662 while an open sheet runs 584→812: the bottom launcher
    //     (616→662) sits INSIDE the sheet's band, so the sheet (z1600) paints
    //     over it. Raising the rail above 1600 is not the fix — that would draw
    //     a launcher ON TOP of a sheet, which is the same cardinal collision
    //     wearing the other hat. The honest fix is the one the saybar already
    //     gets: the rail YIELDS, shortening its band so it never enters the
    //     sheet's pixels at all. Every launcher that remains is fully visible
    //     and fully tappable, which is what makes "tap ◈ while ✦ is open"
    //     actually work instead of merely appearing to.
    //
    //     `botFloor` is the part of the floor the squeeze (step 3) may NOT
    //     borrow back: leaning on the saybar only looks crowded, but leaning
    //     into a sheet swallows the launcher whole.
    //     THE SELECTOR USED TO BE A HAND-WRITTEN LIST of the three sheets that
    //     existed when this was written (#dvWarpSheet, #dvAgentSheet, #ctSheet).
    //     That made the yield silently incomplete the moment a FOURTH sheet was
    //     added: THE LANTERNS (#dvTraceSheet) opened, `anyOpen()` was true, the
    //     querySelector matched nothing, botFloor stayed 0, and the rail sat
    //     inside the sheet's band with its launchers painted over — measured as
    //     "#dvScrim covers the launcher" on three ordered pairs. A list that has
    //     to be edited by whoever adds a surface is a list that will be wrong.
    //
    //     So it asks the DOM the same question the law does: is any element with
    //     the shared sheet class actually open right now? `.dv-sheet` is the one
    //     scaffold most bottom sheets reuse (warp, agents, and now the lanterns),
    //     so a new surface built on it is covered the day it ships, with nothing
    //     to remember. #ctSheet is named explicitly on purpose: the Court keeps
    //     its own class deliberately (see court.js — "own class so the Court can
    //     be killed without touching the DIRVERSE stylesheet"), so it can't be
    //     picked up by the shared selector and has to be listed. #dvTraceSheet is
    //     belt-and-braces — it does carry .dv-sheet, and naming it costs nothing.
    var botFloor = 0;
    if (anyOpen()) {
      // every open sheet, not just the first — the yield must clear the TALLEST
      // of them, and taking only one would under-shorten the rail if a future
      // flow ever has two up deliberately.
      var open = document.querySelectorAll('.dv-sheet.open, #ctSheet.open, #dvTraceSheet.open');
      for (var oi = 0; oi < open.length; oi++) {
        var shr = open[oi].getBoundingClientRect();
        if (shr.height > 0 && shr.top < vh) {
          botFloor = Math.max(botFloor, vh - shr.top + 12);
        }
      }
      if (botFloor > 0) bot = Math.max(bot, botFloor);
    }

    // 3) THE SQUEEZE (landscape phones: 375px tall with a ~190px panel leaves
    //    negative room). A rail with no height is a dead control — as bad as an
    //    overlapping one. So when the band can't hold even one launcher, we
    //    RECLAIM space by collapsing the panel gutter, and if it's still short,
    //    we let the rail scroll internally. It never spills onto a neighbour and
    //    it is never unreachable: those are the only two outcomes allowed.
    //
    //    An open sheet makes this bite where it never did before: clearing the
    //    sheet costs the rail ~90px, and at 375×812 that left 302px of band for
    //    326px of launchers. The rail is column-reverse + overflow-y:auto, so the
    //    surplus clips off the TOP — ♔ landed half outside its own scroll box and
    //    a tap at its centre hit the scrim behind it. A launcher you must first
    //    discover is scrollable is a launcher that isn't there.
    //
    //    So something yields, and it is not the rail (a clipped launcher) nor the
    //    sheet (the collision we came to kill): it is #vintWorldHud, passive
    //    readout, while the rail is the only way between surfaces. Via a body
    //    class, never an inline style — the DirHaven door hides that same panel
    //    and remembers its previous inline visibility, so writing the property
    //    from here would corrupt what the door saved. On tall viewports `want`
    //    is ≤ 0 and nothing moves at all.
    // ── THE HARD CEILING: #leave DOES NOT YIELD ───────────────────────────────
    // Both borrow branches below reclaim space by walking `top` upward, and both
    // were bounded only by `top - 8` — i.e. by the top of the VIEWPORT. Above the
    // rail sits #leave (the ↩ link, top 14..58 at z-index 1600), which is the
    // only way out of the world and is therefore primary navigation, not passive
    // readout. #vintWorldHud and #hint may yield (they are readouts, and the code
    // below already makes them); #leave may not. Unbounded, the borrow put a
    // launcher at top:23 straight through the link — measured, `elementFromPoint`
    // at the launcher's own centre returned #leave, meaning the tap opened the
    // wrong surface. This floor is computed ONCE here and both branches clamp to
    // it, so neither can walk past the link no matter which one fires. It is a
    // floor on the borrow, never a raise: on any viewport with room it is
    // irrelevant, because `top` is already far below it.
    var ceilFloor = 8;
    var leaveEl = document.getElementById('leave');
    if (leaveEl && getComputedStyle(leaveEl).display !== 'none') {
      var lvr = leaveEl.getBoundingClientRect();
      if (lvr.height > 0 && lvr.bottom > 0) ceilFloor = Math.max(ceilFloor, lvr.bottom + 10);
    }

    // THE NEED IS MEASURED IN ONE FIXED FORM, NOT IN WHATEVER FORM THE LAST PASS
    // LEFT (GEJ8NYU). This read `_rail.scrollHeight` as-found, which was stable
    // only while the rail almost never wrapped: the steady state was the
    // compact+tight single column, so the need was always that column's height.
    // Once the wrap started succeeding, the as-found rail was often WRAPPED —
    // a fraction of the height — so the next pass borrowed less band, the wrap
    // then failed, the pass after that saw a tall scrolled column and borrowed
    // again. MEASURED: the same 768x1024 coarse + court state came out wrapped
    // (top 120) on one run and scrolled with launchers off-screen (top 173) on
    // the next. So the need is taken from the compact+tight single column every
    // time — the form the base behaviour always measured in its steady state —
    // and step 4 re-decides the classes from scratch below, as it always has.
    var cl0 = document.body.classList;
    cl0.remove('dv-rail-wrap'); cl0.remove('dv-rail-glyph');
    cl0.add('dv-rail-compact'); cl0.add('dv-rail-tight');
    var needH = _rail.scrollHeight || 0;
    var yieldPanel = false;
    if (botFloor && needH > 0 && panel) {
      var want = needH - (vh - top - bot);
      if (want > 0) {
        var take = Math.min(want, Math.max(0, top - ceilFloor));
        if (take > 0) {
          top -= take;
          var pr2 = panel.getBoundingClientRect();
          if (pr2.height > 0 && top < pr2.bottom) yieldPanel = true;
          // #hint sits BELOW the panel, so a borrow can stop between the two:
          // past the hint's bottom but short of the panel's. This branch only
          // ever tested the panel, so the rail walked onto the keys line without
          // yielding it — MEASURED at 1280x800 with ◈ open: rail top 134, #hint
          // 140..185, four launchers on the hint. Step 3 below already yields the
          // hint for exactly this reason; the sheet-borrow now does the same.
          if (hint && getComputedStyle(hint).display !== 'none') {
            var hr3 = hint.getBoundingClientRect();
            if (hr3.height > 0 && top < hr3.bottom) yieldPanel = true;
          }
        }
      }
    }
    var avail = vh - top - bot;
    if (avail < 46) {
      var need = 46 - avail;
      // never above #leave (see ceilFloor above) — it was `top - 8`, i.e. the
      // top of the VIEWPORT, which is what walked launchers onto the ↩ link.
      var giveTop = Math.min(need, Math.max(0, top - ceilFloor));
      top -= giveTop;
      avail = vh - top - bot;
      // THE VIGIL FIX (2026-08-04): borrowing from the ceiling walks the rail UP
      // into whatever is above it, and above it is #vintWorldHud. Before the
      // vigil the panel was short enough that this branch almost never fired;
      // the taller panel makes it fire on every 320x568 signed-in session, and
      // measured, it put 112x34px of launchers straight on top of the panel (and
      // the panel on top of #status, which derives its own ceiling from
      // --dv-railtop). Borrowing without yielding is not a squeeze, it is a
      // collision. So the SAME rule the open-sheet path already obeys applies
      // here: if the borrow crosses the panel's live bottom, the panel — passive
      // readout — yields, because the rail is the only way between surfaces.
      if (giveTop > 0 && panel) {
        var pr3 = panel.getBoundingClientRect();
        if (pr3.height > 0 && top < pr3.bottom) yieldPanel = true;
      }
      // #hint sits between the panel and the rail on desktop, so a ceiling
      // borrow walks through IT first. Measured at 812x375 (landscape phone)
      // that was a 42x17px band of launchers on the keys line. The hint is a
      // W/A/S/D legend — the least load-bearing thing in this column, and on a
      // viewport this short it is pure decoration next to a reachable launcher —
      // so it yields with the panel. Via the same body class, never an inline
      // style, so nothing else that touches these elements gets corrupted.
      if (giveTop > 0 && hint) {
        var hr2 = hint.getBoundingClientRect();
        if (hr2.height > 0 && top < hr2.bottom) yieldPanel = true;
      }
      // then borrow from the floor — but never past botFloor, or the launcher we
      // just fought to keep reachable lands under an open sheet, which is worse
      // than a short rail (the rail can scroll; a covered button cannot be hit).
      // `inviteFloor` joins botFloor as un-borrowable for the same reason: the
      // guest doorway is opaque, so a launcher under it is a dead control.
      if (avail < 46) bot = Math.max(8, botFloor, inviteFloor, dockFloor, sayFloor, bot - (46 - avail));
    }

    // ── 3b) ENOUGH BAND FOR THE LAUNCHERS THAT EXIST ─────────────────────────
    // The squeeze above guarantees exactly ONE launcher's worth of band, which
    // was right when the rail held four and is not right now that it holds
    // eight. `overflow-y:auto` was the intended relief, but the rail is
    // column-reverse, so the surplus clips off the TOP: measured at 320x568 with
    // a sheet open, six of eight launchers rendered at NEGATIVE y (down to
    // -169) and `elementFromPoint` at their centres returned null. They were not
    // cramped; they did not exist. And a scroll gesture inside a 46px strip is
    // not a discoverable affordance — this file already says as much about the
    // same failure arriving by another road.
    //
    // So: having taken the ceiling as far as #leave allows, take the rest from
    // the FLOOR, still never past botFloor (a launcher under an open sheet is
    // unhittable, which is strictly worse than a short rail). This asks for the
    // room the launchers actually need instead of a fixed 46, and it can only
    // ever give the rail MORE band, never less — so no neighbour loses space
    // that the existing clauses had already granted it.
    //
    // `inviteFloor` IS UN-BORROWABLE HERE TOO (AETHERHOLD 2026-08-08). This
    // clause guarded only `botFloor` (open sheets), which was complete when it
    // was written — the guest doorway was not yet part of the floor. Once it was,
    // this became the last place the hard-won clearance leaked away: measured at
    // 320×720 on a guest load, step 2a computed a floor of 316px and this line
    // handed 22px of it back to the launcher column, leaving --dv-railbot at
    // 294px and the rail 10px inside #invite. The reasoning that protects
    // botFloor applies verbatim to the doorway — it is opaque, so a launcher
    // beneath it cannot be tapped — and a short rail is the strictly better
    // failure, because the rail compacts and wraps (step 4) while a covered
    // button has no recourse at all.
    if (needH > 0 && (vh - top - bot) < needH) {
      var deficit = needH - (vh - top - bot);
      var fromFloor = Math.min(deficit, Math.max(0, bot - Math.max(8, botFloor, inviteFloor, dockFloor, sayFloor)));
      if (fromFloor > 0) bot -= fromFloor;
    }
    // one authoritative write, AFTER every branch that can set it (the squeeze
    // above can raise it too, so toggling before that was a stale decision).
    try { document.body.classList.toggle('dv-panel-yield', yieldPanel); } catch (_) {}
    css.setProperty('--dv-railtop', Math.round(top) + 'px');
    css.setProperty('--dv-railbot', Math.round(bot) + 'px');

    // ── 4) THE FIT — does the column actually fit the band it was just given? ──
    // Everything above decides the rail's BOX. Nothing above ever asked whether
    // the launchers fit inside it, because when this was written they always
    // did. They no longer do: measured at 320x568 signed-in with seven
    // launchers, the column needs 438px of a 268px band, and the rail is
    // column-reverse — so the overflow clips off the TOP and the earliest-
    // mounted launchers render at negative coordinates, unreachable, with no
    // sheet open at all. `overflow-y:auto` was the intended relief valve, but a
    // launcher you must first discover is scrollable is a launcher that is not
    // there (this file's own squeeze comment says exactly that about the same
    // failure arriving by a different road).
    //
    // So the rail compacts ITS OWN CONTENT to fit, in escalating steps, and
    // re-measures after each one because every step changes the height it is
    // testing. The container yields; no neighbour is ever asked for space, and
    // nothing is allowed to spill. If even the tightest form does not fit (a
    // genuinely tiny viewport with many launchers), scrolling remains as the
    // last resort — bounded and honest — rather than silent clipping.
    try {
      var bandH = Math.max(46, vh - top - bot);
      var cl = document.body.classList;
      cl.remove('dv-rail-compact'); cl.remove('dv-rail-tight'); cl.remove('dv-rail-wrap');
      cl.remove('dv-rail-glyph');
      // PUBLISH THE COLUMN'S REAL NEED, measured in its most compact form, so
      // the sheet can reserve it (see .dv-sheet's max-height). It is measured
      // WITH the compact classes on — that is the height the rail will actually
      // occupy when a sheet is up — and then the classes are re-decided below
      // against the band the sheet's yield produces. Published every layout, so
      // adding or hiding a launcher updates the reservation with no extra wiring.
      cl.add('dv-rail-compact'); cl.add('dv-rail-tight');
      css.setProperty('--dv-railneed', Math.min(vh - 120, (_rail.scrollHeight || 0)) + 'px');
      cl.remove('dv-rail-compact'); cl.remove('dv-rail-tight');
      // --dv-railcw is only ever written inside the wrap branch below, so clear
      // it here rather than letting a previous layout's column width survive
      // into one that decides differently. It is scoped to .dv-rail-wrap and
      // that class is re-decided every pass, so a stale value could not have
      // painted — but a var that outlives the measurement it came from is the
      // kind of quiet drift this file has been bitten by before, so it dies with
      // the measurement that produced it.
      css.removeProperty('--dv-railcw');
      // scrollHeight is read AFTER each class change so each measurement is of
      // the form actually being tested, never of the previous one.
      // ON TOUCH, NEVER COMPACT TO GLYPH-ONLY (Vinta directive 2026-09-26) — and
      // that is now enforced at the ONE rung that hides a name, not by skipping
      // the whole ladder (GEJ8NYU). This guard used to read `!_coarse && ...` on
      // the reasoning that the ladder "buys vertical room by HIDING the label".
      // That stopped being true on 2026-09-25: compact and tight shrink the NAME,
      // and the labeled wrap bounds the pill so the name ellipsizes — none of
      // them hide identity. Skipping them on touch meant a phone got the bounded
      // scroll every time, and MEASURED (verify-rail-reach.js, COARSE=1) that was
      // 400+ launchers above the fold across 32 phone states: legible names on
      // buttons nobody could reach. So touch now climbs compact → tight → labeled
      // wrap like desktop does (the body.dv-coarse rules still hold every pill at
      // the 46px floor with its name showing), and ONLY the glyph tier below is
      // fine-pointer-only. If even the labeled wrap cannot seat the launchers on
      // touch, the bounded scroll + fade fallback stands exactly as before.
      if ((_rail.scrollHeight || 0) > bandH) {
        cl.add('dv-rail-compact');
        if ((_rail.scrollHeight || 0) > bandH) {
          cl.add('dv-rail-tight');
          // LAST STEP: compaction has a floor (42px is the minimum honest touch
          // target and we will not go under it to win a measurement). If the
          // column still does not fit, it wraps into a second column and uses
          // the width the viewport actually has. Verified after the fact, not
          // assumed — if even this does not fit, the class comes back off so
          // the rail keeps its single-column scroll rather than being left in a
          // wrapped state that solved nothing and changed the reading order.
          // HOW WIDE THE WRAP NEEDS TO BE, DERIVED FROM HOW TALL IT IS ALLOWED
          // TO BE. With a sheet open at 320x568 the band collapses to a single
          // 46px row, so a fixed two-column width could never hold eight
          // launchers (410px of content in a 110px box) — it spilled and the
          // guard below correctly rejected it, leaving the clipping it was meant
          // to cure. The columns needed are ceil(items / rows-that-fit), and the
          // width is that many pill-widths — capped so the rail can still never
          // reach the screen's right half, where #topctl and the docked account
          // stack live. If the cap cannot hold the launchers, the guard rejects
          // the wrap and the single-column scroll remains, as before.
          // WIDTH AND HEIGHT ARE DIFFERENT NUMBERS NOW. This block used one
          // variable (`pill`) for both, which was exactly right while a
          // compacted launcher was a 46px SQUARE — glyph-only. Now that the name
          // survives compaction the pill is ~46px tall and up to 101px wide, and
          // using the width as a row height made `perCol` under-count by more
          // than half (a 232px band reported 4 rows where it truly holds 5),
          // which inflated the column count and the width demand with it.
          var pillH = 46, pillW = 46, colGap = 6, rowGap = 6;
          var firstL = _rail.querySelector('.dv-launch');
          if (firstL) {
            var fr = firstL.getBoundingClientRect();
            if (fr.width > 2) pillW = Math.ceil(fr.width);
            if (fr.height > 2) pillH = Math.ceil(fr.height);
          }
          // the WIDEST launcher decides the column, not the first one — the
          // first is 'star-map' (96px) while 'galactic time' is 101px, and a
          // column sized to the first would clip the widest by 5px.
          var shown = 0, all = _rail.querySelectorAll('.dv-launch');
          for (var ci = 0; ci < all.length; ci++) {
            if (all[ci].offsetParent === null) continue;
            shown++;
            var wr = all[ci].getBoundingClientRect();
            if (wr.width > pillW) pillW = Math.ceil(wr.width);
          }
          var perCol = Math.max(1, Math.floor((bandH + rowGap) / (pillH + rowGap)));
          var cols = Math.max(1, Math.ceil(shown / perCol));
          var wantW = cols * pillW + (cols - 1) * colGap;
          var vwNow = W.innerWidth || document.documentElement.clientWidth || 360;
          // THE CAP IS MEASURED AGAINST WHAT IS ACTUALLY BESIDE THE RAIL, not
          // against half the screen (AETHERHOLD 2026-08-08). `vw/2 - 24` was a
          // conservative stand-in for "don't reach #topctl and the docked account
          // stack" — but those live at the TOP-RIGHT, and the rail is anchored to
          // the BOTTOM-LEFT. At 320x568 with the guest doorway up, the honest
          // requirement was four 46px columns (202px) and the blanket cap allowed
          // 136px, so the wrap was rejected by its own guard and the rail fell
          // back to the single-column scroll — leaving three launchers at negative
          // y, exactly the clipping the wrap exists to cure. A cap that forbids
          // the only working layout is not a safety rule, it is the bug.
          //
          // So the cap now asks the real question: how much width is free to the
          // RIGHT of the rail, in the band the rail actually occupies? Anything
          // fixed that overlaps the rail's vertical range is measured and the
          // nearest one sets the limit (minus a 12px gutter); with nothing there,
          // the rail may use up to 78% of the width, which is still far short of
          // the screen edge. The wrap's own post-check (below) remains the final
          // arbiter — if a wider rail still spills, the class comes straight off.
          var railTopY = top, railBotY = vh - bot;
          var nearest = vwNow;
          // A WALL IS SOMETHING BESIDE THE COLUMN, NOT INSIDE IT (GEJ8NYU). The
          // scan below took the nearest fixed element's LEFT edge as the limit,
          // and anything starting within the rail's own single-column footprint
          // (MEASURED: #status at x=26 on a 375px screen, #vintVoice at x=16 on
          // 1280x800) produced `nearest - 24` < 46, so capW collapsed to 46px and
          // EVERY wrap — labeled or glyph — was refused by its own spill guard.
          // Narrowing the rail cannot clear an element the single column already
          // stands on, so such an element is not a wall for the wrap's width;
          // only things starting at or right of the column's edge are.
          var colRight = 12;
          try { colRight = Math.ceil(_rail.getBoundingClientRect().right); } catch (_) {}
          try {
            var fixedEls = document.querySelectorAll('body *');
            for (var qi = 0; qi < fixedEls.length; qi++) {
              var fe = fixedEls[qi];
              if (fe === _rail || _rail.contains(fe)) continue;
              var fcs = getComputedStyle(fe);
              if (fcs.position !== 'fixed') continue;
              if (fcs.display === 'none' || fcs.visibility === 'hidden' || +fcs.opacity < 0.05) continue;
              var fr2 = fe.getBoundingClientRect();
              if (fr2.width < 2 || fr2.height < 2) continue;
              if (fr2.width >= vwNow - 2) continue;            // full-width bars are floors, not walls
              if (fr2.bottom <= railTopY || fr2.top >= railBotY) continue;  // not in our band
              // A DOCKED WIDGET IS NOT A WALL — IT IS A THING THAT MOVES. The
              // corner dock exists precisely to slide its pills clear of
              // obstacles, and the rail registers itself as one (see mount()).
              // Measured at 320x568: the account pill sat at x=207 and capped the
              // rail at 183px when the wrap genuinely needed 202px, so the wrap
              // was rejected and three launchers stayed clipped off-screen. The
              // rail is the only way between surfaces and cannot move; the pill
              // can, and the dock will move it. Treating a movable thing as
              // immovable is what made an unsolvable layout out of a solvable one.
              if (fe.id === 'vwg-pill' || fe.id === 'vwg-dot') continue;
              if (fr2.left >= colRight && fr2.left < nearest) nearest = fr2.left;
            }
          } catch (_) {}
          var capW = Math.max(46, Math.min(Math.floor(vwNow * 0.78), Math.floor(nearest - 12 - 12)));
          // ── THE COLUMN YIELDS BEFORE THE WRAP IS ABANDONED (2026-09-25) ─────
          // Previously `--dv-railw` was min(wantW, capW) and nothing reconciled
          // the two: when wantW exceeded capW the columns did not fit, the spill
          // guard fired, and the wrap was dropped entirely — the rail fell back
          // to a scrolled single column with most launchers off the top. MEASURED
          // at 320×568 that was 5 columns × 101px = 529px demanded of a 249px
          // cap, and 12 of 17 launchers ended up unreachable.
          //
          // The honest move is the one this file already makes everywhere else:
          // the CONTAINER'S OWN CONTENT yields. Given the cap, how wide may each
          // column be so that `cols` of them fit? That width is published as
          // --dv-railcw and bounds the pill (see the CSS rule), so the name
          // ellipsizes to fit instead of the launcher vanishing. Floored at 62px
          // — enough for the dot, the glyph and ~4 characters, which is still an
          // identifiable button; below that the pill would be a glyph again and
          // we would be back to the defect this whole change exists to kill, so
          // the wrap is simply not entered and the scroll fallback stands.
          var colW = Math.floor((capW - (cols - 1) * colGap) / cols);
          // on touch the pill keeps 10px padding + dot + glyph (~51px of chrome,
          // see the dv-coarse wrap rule), so the floor that still leaves ~6
          // characters of name is higher than the fine-pointer 62px. MEASURED at
          // 375x812 + sheet: an 84px floor leaves the narrowest name box >= 30px
          // (4-5 glyphs + ellipsis); every name in the roster stays distinct.
          var colMin = _coarse ? 84 : 62;
          if (colW >= colMin && colW < pillW) {
            css.setProperty('--dv-railcw', colW + 'px');
            wantW = cols * colW + (cols - 1) * colGap;
          } else {
            css.setProperty('--dv-railcw', pillW + 'px');
          }
          css.setProperty('--dv-railw', Math.min(wantW, capW) + 'px');

          cl.add('dv-rail-wrap');
          // VERIFY THE WRAP, ON THE AXIS IT CAN ACTUALLY FAIL ON. A wrapped
          // rail overflows HORIZONTALLY, so re-testing scrollHeight would
          // always pass and would have hidden the exact catastrophe measured
          // above (a 41px line, eight launchers in one row running to x=376
          // off a 320px screen). The honest test is whether every launcher is
          // inside the rail's own box on BOTH axes; if any is not, the wrap did
          // not help and comes straight back off, leaving the single-column
          // scroll — bounded and reachable — as the fallback.
          // (GEJ8NYU) the per-launcher test now checks the VERTICAL axis too: a
          // wrapped column whose band is shorter than its content clips off the
          // top exactly like the single column does, and a launcher above the
          // rail's own top edge is as dead as one off its right edge.
          var wrapSpills = function () {
            var rr = _rail.getBoundingClientRect();
            if (_rail.scrollWidth > Math.ceil(rr.width) + 1) return true;
            var ls = _rail.querySelectorAll('.dv-launch');
            for (var li = 0; li < ls.length; li++) {
              if (ls[li].offsetParent === null) continue;      // hidden: not laid out
              var lr = ls[li].getBoundingClientRect();
              if (lr.width < 2) continue;
              if (lr.right > rr.right + 1 || lr.left < rr.left - 1) return true;
              if (lr.top < rr.top - 1 || lr.bottom > rr.bottom + 1) return true;
            }
            return false;
          };
          var spill = wrapSpills();
          if (spill) cl.remove('dv-rail-wrap');

          // ── THE GLYPH TIER (GEJ8NYU) — the last rung before the scroll ───────
          // The labeled wrap could not seat every launcher. Before conceding to a
          // scrolled column (where most launchers sit above the fold), fold the
          // names away and try the wrap again at the 46px glyph floor. Fine
          // pointer only: this whole ladder is already behind `!_coarse`, and the
          // CSS forces labels back on coarse regardless. Same measurement, same
          // cap, same verification — if even this spills, it comes straight off
          // and the scroll fallback below stands exactly as before.
          if (spill && !_coarse) {
            cl.add('dv-rail-glyph');
            css.removeProperty('--dv-railcw');
            var gW = 46, gH = pillH;
            var gAll = _rail.querySelectorAll('.dv-launch');
            for (var gi = 0; gi < gAll.length; gi++) {
              if (gAll[gi].offsetParent === null) continue;
              var gr = gAll[gi].getBoundingClientRect();
              if (gr.width > gW) gW = Math.ceil(gr.width);
              if (gr.height > 2) gH = Math.ceil(gr.height);
              // the name moves to the tooltip a fine pointer can actually show;
              // aria-label already carries it for assistive tech.
              if (!gAll[gi].title) gAll[gi].title = gAll[gi].getAttribute('aria-label') || '';
            }
            var gPer = Math.max(1, Math.floor((bandH + rowGap) / (gH + rowGap)));
            var gCols = Math.max(1, Math.ceil(shown / gPer));
            var gWant = gCols * gW + (gCols - 1) * colGap;
            if (gWant <= capW) {
              css.setProperty('--dv-railcw', gW + 'px');
              css.setProperty('--dv-railw', gWant + 'px');
              cl.add('dv-rail-wrap');
              if (wrapSpills()) { cl.remove('dv-rail-wrap'); cl.remove('dv-rail-glyph'); }
            } else {
              cl.remove('dv-rail-glyph');
            }
          }
        }
      }

      // ── THE LAST LAUNCHER MUST BE REACHABLE (2026-08-08, organ 6) ─────────
      // The ladder above (compact → tight → wrap) has a real floor, and when
      // every rung is exhausted the rail falls back to a single-column SCROLL.
      // That fallback is bounded and honest — but a scroll container opens a
      // gap between "rendered" and "reachable", and nothing was closing it:
      // #dvRail is column-reverse, so it rests at the BOTTOM of its scroll
      // range and the launchers that overflow do so off the TOP, silently.
      //
      // MEASURED at 320x568 with every conditional launcher visible (a named
      // buildable world at standing 400, i.e. twelve launchers): the column
      // needs 570px of scrollHeight in a 268px band, and the newest launcher
      // rendered at top:-10 — present in the DOM, reported visible by
      // getComputedStyle, and completely unhittable. That is exactly the dead
      // control the no-collision law exists to forbid, and it is the failure
      // mode that gets WORSE every time anyone adds a launcher, which is
      // precisely why it must be handled here in the rail that measures rather
      // than by each module hand-counting its neighbours.
      //
      // The fix does not fight the fallback, it completes it: if the newest
      // launcher (the LAST flow child, nearest the thumb in column-reverse) is
      // outside the rail's own box, scroll the rail so it is inside. One
      // assignment, no layout thrash, and it is a no-op in every case where the
      // column already fits — which is every viewport except the most extreme.
      // Nothing is hidden and nothing is repositioned; the user simply lands on
      // the end of the column that a bottom-anchored rail should have been
      // showing all along, and can scroll to the rest.
      // THE SCROLL IS ANNOUNCED, NOT SILENT (2026-09-25). Measured from the real
      // overflow, every layout, so it appears exactly when the column genuinely
      // continues above the fold and disappears the moment it does not. See the
      // `body.dv-rail-scrolls` rule for why this is a mask and not an element.
      try {
        cl.toggle('dv-rail-scrolls',
          !cl.contains('dv-rail-wrap') && _rail.scrollHeight > _rail.clientHeight + 1);
      } catch (_) {}
      if (!cl.contains('dv-rail-wrap') && _rail.scrollHeight > _rail.clientHeight + 1) {
        var lasts = _rail.querySelectorAll('.dv-launch');
        var lastVis = null;
        for (var qi = lasts.length - 1; qi >= 0; qi--) {
          if (lasts[qi].offsetParent !== null) { lastVis = lasts[qi]; break; }
        }
        if (lastVis) {
          var rb = _rail.getBoundingClientRect();
          var lb = lastVis.getBoundingClientRect();
          // above the rail's own top edge = scrolled out of reach
          if (lb.top < rb.top - 1) {
            // THE SIGN BUG (2026-10-06). `column-reverse` + overflow inverts the
            // scrollTop direction: Chrome's legal range here is [-(scrollHeight
            // - clientHeight), 0], not [0, scrollHeight-clientHeight] — the rail
            // "rests at the bottom" at scrollTop:0, and reaching the overflowed
            // content means going NEGATIVE. `Math.max(0, ...)` on an already-
            // negative target clamped it straight back to 0 every time, so this
            // branch always ran and never actually scrolled. MEASURED at 375px
            // signed-in with a sheet open: #cnBtn sat at top:-285 (elementFrom-
            // Point returned null) both before and after this line ran, and
            // manually assigning scrollTop:-491 moved it to top:206 — fully
            // reachable. Clamp to the range this container actually has.
            var minScroll = -(_rail.scrollHeight - _rail.clientHeight);
            var want = _rail.scrollTop - (rb.top - lb.top) - 6;
            _rail.scrollTop = Math.max(minScroll, Math.min(0, want));
          }
        }
      }
    } catch (_) {}
  }
  var _layoutT = null;
  function scheduleLayout() { clearTimeout(_layoutT); _layoutT = setTimeout(layoutRail, 60); }
  W.addEventListener('resize', scheduleLayout);
  W.addEventListener('orientationchange', scheduleLayout);
  W.addEventListener('vint:world-state', scheduleLayout);

  // THE DOORWAY MOVES ON ITS OWN, SO WATCH IT (AETHERHOLD 2026-08-08).
  // Step 2a folds #invite into the rail's floor, but a measurement is only as
  // good as the moment it is taken — and #invite changes size twice on a guest
  // session without firing ANY of the three events above: it rises ~1.4s after
  // load (world.html's guestOverlay), and it collapses to a ~60px pill when the
  // guest taps "just look around". A rail measured before either would be wrong
  // in the two directions that matter: overlapping the doorway, or stranding a
  // gap where the doorway used to be. A MutationObserver on its class/style is
  // the honest trigger, because those are exactly what both transitions change,
  // and it costs nothing on a signed-in session where #invite never appears.
  //
  // AND MEASURE IT WHEN IT HAS STOPPED MOVING, NOT WHILE IT IS MOVING. #invite
  // rises with an 0.8s `inviteRise` animation, so the class mutation fires while
  // the sheet is still 288px BELOW its final resting place. Measured, the rail
  // yielded to that in-flight position and settled 2–3px inside the doorway's
  // final box — a real overlap produced by a correct formula reading a moving
  // target. (Proof it was the measurement and not the maths: forcing a relayout
  // once everything settled turned +4px of overlap into −12px of clearance.)
  // So the observer runs the pass IMMEDIATELY rather than through the 60ms
  // debounce. The debounce exists to coalesce resize storms, but this mutation is
  // a single discrete event — and because step 2a now derives the doorway's
  // RESTING floor from its height and bottom offset (both final on the first
  // frame it is displayed), that immediate pass is already the correct, final
  // number. Debouncing it merely guaranteed one rendered frame in which the
  // launchers sat inside the doorway: measured at 320×720, a 138px overlap in the
  // gap between `.show` being added and the deferred relayout firing. A collision
  // that lasts one frame is still a collision. `animationend`/`transitionend`
  // remain as confirmation for any future timing this does not anticipate.
  try {
    var _inv = document.getElementById('invite');
    if (_inv) {
      // A SETTLING TAIL, because the doorway keeps changing size after it
      // appears. The synchronous pass below is correct for the geometry it can
      // see, but #invite's content (and therefore its HEIGHT) can still settle a
      // frame or two later — web fonts land, the copy reflows, the rise finishes.
      // Each of those moves the floor the rail is supposed to clear, and none of
      // them fires another class mutation. A short bounded tail of re-measures
      // costs a handful of rect reads and removes the last intermittent overlap;
      // it stops for good after ~0.6s.
      var _tail = null;
      function settleRail() {
        try { layoutRail(); } catch (_) {}
        clearInterval(_tail);
        var n = 0;
        _tail = setInterval(function () {
          try { layoutRail(); } catch (_) {}
          if (++n > 14) clearInterval(_tail);
        }, 45);
      }
      if (W.MutationObserver) {
        new W.MutationObserver(settleRail)      // synchronous first pass + tail
          .observe(_inv, { attributes: true, attributeFilter: ['class', 'style'] });
      }
      _inv.addEventListener('animationend', settleRail);
      _inv.addEventListener('transitionend', settleRail);
    }
  } catch (_) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // BOTTOM-SHEET GRIP — drag-down / swipe-down to dismiss (mobile-native feel)
  // ═══════════════════════════════════════════════════════════════════════════
  function _grip(sheet) {
    var grip = sheet.querySelector('.dv-grip'); if (!grip) return;
    var y0 = 0, dy = 0, dragging = false;
    function start(e) { dragging = true; y0 = (e.touches ? e.touches[0].clientY : e.clientY); dy = 0; sheet.style.transition = 'none'; }
    function move(e) {
      if (!dragging) return;
      var y = (e.touches ? e.touches[0].clientY : e.clientY);
      dy = Math.max(0, y - y0);
      sheet.style.transform = 'translateY(' + dy + 'px)';
    }
    function end() {
      if (!dragging) return; dragging = false; sheet.style.transition = '';
      sheet.style.transform = '';
      if (dy > 90) { sheet.classList.remove('open'); syncScrim(); }
    }
    grip.addEventListener('touchstart', start, { passive: true });
    grip.addEventListener('touchmove', move, { passive: true });
    grip.addEventListener('touchend', end);
    grip.addEventListener('mousedown', function (e) { start(e); var mm = function (ev) { move(ev); }, mu = function () { end(); removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); }; addEventListener('mousemove', mm); addEventListener('mouseup', mu); });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MOUNT
  // ═══════════════════════════════════════════════════════════════════════════
  function mount() {
    if (!enabled()) return;
    injectStyles();
    // Detect a coarse (touch) primary pointer ONCE, tag <body>, and re-detect if it
    // changes (a hybrid device docking/undocking). dv-coarse is what keeps labels
    // visible and blocks glyph-only compaction — mobile legibility hinges on it.
    try {
      var _mq = W.matchMedia && W.matchMedia('(pointer: coarse)');
      _coarse = !!(_mq && _mq.matches);
      document.body.classList.toggle('dv-coarse', _coarse);
      if (_mq && _mq.addEventListener) {
        _mq.addEventListener('change', function (e) {
          _coarse = !!e.matches;
          document.body.classList.toggle('dv-coarse', _coarse);
          try { layoutRail(); } catch (_) {}
        });
      }
    } catch (_) {}
    // Our own two sheets join the one-open-at-a-time registry before any
    // launcher can raise them. `isOpen` reads the live class rather than a flag
    // so a grip-dismiss is seen correctly.
    registerSheet('warp', function () { return !!_warpSheet && _warpSheet.classList.contains('open'); }, closeWarp);
    registerSheet('agent', function () { return !!_agentSheet && _agentSheet.classList.contains('open'); }, closeAgent);
    // The rail is column-reverse, so DOM order = bottom-to-top on screen:
    //   star-map (bottom) · agents · home · build (top, only on your own world)
    makeLauncher('dvWarpBtn', 'star-map', '✦', openWarp);
    makeLauncher('dvAgentBtn', 'agents', '◈', openAgent);
    makeLauncher('dvHomeBtn', 'home', '⌂', goHome);
    // build launcher lives on the existing WorldHUD? we add our own so the palette
    // is the rich 15-prop strip. Hidden until canBuild.
    var bb = makeLauncher('dvBuildBtn', 'build', '▥', toggleBuild);
    bb.style.display = 'none'; // shown by updateBuildVisibility when canBuild
    buildPalette();
    updateBuildVisibility();
    layoutRail();
    whoAmI();
  }

  // ⌂ HOME — the one-tap way back to your own clearing, reusing the SAME cinematic
  // warp as every other journey (no second travel path exists). If you haven't
  // forged yet, it opens the star-map on the forge form rather than dead-ending.
  function goHome() {
    if (_meState === 'guest') { openWarp(); return; }       // the deed panel invites
    if (_me && _myWorld) {
      var here = world() && world().currentWorldId ? String(world().currentWorldId()) : 'universe';
      if (here === String(_me.id)) { toast('you are already home.'); return; }
      beginWarp({ id: _me.id, name: _myWorld.name || 'your world' });
      return;
    }
    _forgeOpen = true;
    openWarp();
    toast('forge your world first — name it, and it\'s on the map.');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  // ── addLauncher — the ONLY sanctioned way for another module to put a button
  // on the left rail. Exposed because the alternative (each module pinning its
  // own position:fixed button at a hand-counted `bottom:` offset) is how the
  // DirHaven door came to sit exactly on top of the build launcher: both landed
  // in the 318–364px band at z-index 1450. Slots must be allocated by the rail
  // that measures them, never counted by hand in a file that can't see its
  // neighbours. Returns the button so callers can show/hide it.
  function addLauncher(id, label, glyph, onClick) {
    var existing = document.getElementById(id);
    if (existing) return existing;            // idempotent: re-mount never doubles
    var b = makeLauncher(id, label, glyph, onClick);
    layoutRail();                             // re-measure: the rail just grew
    return b;
  }

  // `toast` is shared so the Court (court.js) can speak through the SAME element —
  // two toast nodes at one anchor would stack on each other, which the
  // no-collision law forbids. One page, one toast.
  W.DirverseHUD = {
    open: openWarp, openAgent: openAgent, mount: mount, enabled: enabled,
    openAgents: function () {
      openSheet('agent', function () { buildAgentSheet(); _agentSheet.classList.add('open'); showPane('cits'); });
    },
    goHome: goHome,
    addLauncher: addLauncher,
    relayout: layoutRail,
    toast: toast,
    refreshAgents: refreshVentureAgents,
    // ── the shared sheet owner. Any module with a full-width surface MUST
    // register and open through this, or it will land on top of a sheet that is
    // already up. `registerSheet(id, isOpen, close)` then `openSheet(id, fn)`.
    registerSheet: registerSheet,
    openSheet: openSheet,
    closeSheets: closeSheets,
    syncSheets: syncScrim,
    anySheetOpen: function () { return !!anyOpen(); }
  };
})();
