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
      ' border-radius:23px;font-family:"Cormorant Garamond",Georgia,serif;font-size:14px;letter-spacing:.02em;',
      ' color:#cfe8ff;background:rgba(8,12,20,0.72);border:1px solid rgba(124,207,255,0.34);',
      ' backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);cursor:pointer;',
      ' display:flex;align-items:center;gap:7px;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.35);}',
      '.dv-launch:active{transform:scale(0.96);}',
      '.dv-launch .dot{width:7px;height:7px;border-radius:50%;background:#4fc3f7;box-shadow:0 0 8px #4fc3f7;}',
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
      // very short viewports (landscape phones): drop the labels to glyph-only pills
      // so four launchers still fit the reserved band without ever scrolling.
      '@media(max-height:560px){#dvRail .dv-launch .lbl{display:none;}',
      ' #dvRail .dv-launch{padding:0 12px;gap:0;}}',

      // shared bottom-sheet scaffold (WARP + AGENT both use it)
      '.dv-sheet{position:fixed;left:0;right:0;bottom:0;z-index:1600;',
      // dvh follows the on-screen keyboard on modern mobile, so the sheet shrinks
      // instead of being shoved off-screen; vh is the fallback for older engines.
      ' max-height:min(78vh,560px);max-height:min(78dvh,560px);background:rgba(6,9,15,0.94);',
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

      // toast (shared, above sheets)
      '#dvToast{position:fixed;left:50%;bottom:calc(88px + env(safe-area-inset-bottom,0px));',
      ' transform:translateX(-50%) translateY(10px);z-index:1700;max-width:88vw;',
      ' padding:10px 18px;border-radius:14px;background:rgba(8,12,20,0.9);',
      ' border:1px solid rgba(124,207,255,0.3);color:#dce7ff;font-family:"Cormorant Garamond",Georgia,serif;',
      ' font-size:14.5px;opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;',
      ' text-align:center;box-shadow:0 6px 24px rgba(0,0,0,0.5);}',
      '#dvToast.show{opacity:1;transform:translateX(-50%) translateY(0);}',

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
    buildWarpSheet();
    _warpSheet.classList.add('open');
    _warpCursor = null;
    renderDeed();
    loadWorlds(false);
  }
  function closeWarp() { if (_warpSheet) _warpSheet.classList.remove('open'); }

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
    buildAgentSheet();
    _agentSheet.classList.add('open');
    showPane(_pane === 'convo' ? 'cits' : _pane);
  }
  function closeAgent() { if (_agentSheet) _agentSheet.classList.remove('open'); }

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

  // the ledger names council presences AND your own agents — never a raw id
  function _agentName(id) {
    var a = AGENTS.find(function (x) { return x.id === id; });
    if (a) return a.n;
    var m = _mine.find(function (x) { return String(x.id) === String(id); });
    return m ? (m.name || id) : id;
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
  function buildPalette() {
    if (_buildBar) return _buildBar;
    var bar = document.createElement('div'); bar.id = 'dvBuild';
    var strip = document.createElement('div'); strip.className = 'dv-palette';
    PROPS.forEach(function (p) {
      var b = document.createElement('button'); b.className = 'dv-prop'; b.setAttribute('data-kind', p.k);
      b.innerHTML = '<span class="pg">' + esc(p.g) + '</span><span class="pn">' + esc(p.n) + '</span>';
      b.onclick = function () {
        strip.querySelectorAll('.dv-prop').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on'); _selProp = p.k;
        try { world().placeHere(p.k); } catch (_) {}
        toast('placed a ' + p.n + ' where you stand');
      };
      strip.appendChild(b);
    });
    bar.appendChild(strip);
    document.body.appendChild(bar);
    _buildBar = bar;
    return bar;
  }
  var _buildOpen = false;
  function toggleBuild() {
    buildPalette();
    if (!world() || !world().canBuild || !world().canBuild()) { toast('you can only build in your own world.'); return; }
    _buildOpen = !_buildOpen;
    _buildBar.classList.toggle('show', _buildOpen);
  }
  function updateBuildVisibility() {
    var can = world() && world().canBuild && world().canBuild();
    var launch = document.getElementById('dvBuildBtn');
    if (launch) launch.style.display = can ? 'flex' : 'none';
    if (!can && _buildBar) { _buildBar.classList.remove('show'); _buildOpen = false; }
  }
  // react to the server's authoritative canBuild flag on every world:state
  W.addEventListener('vint:world-state', updateBuildVisibility);
  W.addEventListener('vint:world-travel', function () { if (_buildBar) { _buildBar.classList.remove('show'); _buildOpen = false; } });

  // ═══════════════════════════════════════════════════════════════════════════
  // LAUNCHERS — draggable rail buttons (obey the all-buttons-draggable law)
  // ═══════════════════════════════════════════════════════════════════════════
  // The rail is the ONE fixed box; every launcher lives inside it in normal flow.
  // Nothing here is individually position:fixed, so no launcher can ever be
  // dragged or reflowed onto another fixed surface — the rail owns its space.
  var _rail = null;
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
    b.innerHTML = '<span class="dot"></span><span class="lbl">' + esc(glyph) + ' ' + esc(label) + '</span>';
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

    // 2) the floor: the live top edge of #saybar + a 12px gutter (it's a
    //    full-width bar, so the rail must clear it vertically, not dodge it).
    var bot = 150;
    var say = document.getElementById('saybar');
    if (say && say.offsetParent !== null) {
      var sr = say.getBoundingClientRect();
      if (sr.height > 0) bot = Math.max(88, vh - sr.top + 12);
    }

    // 3) THE SQUEEZE (landscape phones: 375px tall with a ~190px panel leaves
    //    negative room). A rail with no height is a dead control — as bad as an
    //    overlapping one. So when the band can't hold even one launcher, we
    //    RECLAIM space by collapsing the panel gutter, and if it's still short,
    //    we let the rail scroll internally. It never spills onto a neighbour and
    //    it is never unreachable: those are the only two outcomes allowed.
    var avail = vh - top - bot;
    if (avail < 46) {
      var need = 46 - avail;
      var giveTop = Math.min(need, Math.max(0, top - 8)); // never above the viewport
      top -= giveTop;
      avail = vh - top - bot;
      if (avail < 46) bot = Math.max(8, bot - (46 - avail)); // then borrow from the floor
    }
    css.setProperty('--dv-railtop', Math.round(top) + 'px');
    css.setProperty('--dv-railbot', Math.round(bot) + 'px');
  }
  var _layoutT = null;
  function scheduleLayout() { clearTimeout(_layoutT); _layoutT = setTimeout(layoutRail, 60); }
  W.addEventListener('resize', scheduleLayout);
  W.addEventListener('orientationchange', scheduleLayout);
  W.addEventListener('vint:world-state', scheduleLayout);

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
      if (dy > 90) sheet.classList.remove('open');
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

  W.DirverseHUD = {
    open: openWarp, openAgent: openAgent, mount: mount, enabled: enabled,
    openAgents: function () { buildAgentSheet(); _agentSheet.classList.add('open'); showPane('cits'); },
    goHome: goHome,
    addLauncher: addLauncher,
    relayout: layoutRail
  };
})();
