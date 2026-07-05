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
      // launcher buttons (draggable, right rail, above the movectl on mobile)
      '.dv-launch{position:fixed;z-index:1450;min-height:46px;min-width:46px;padding:0 14px;',
      ' border-radius:23px;font-family:"Cormorant Garamond",Georgia,serif;font-size:14px;letter-spacing:.02em;',
      ' color:#cfe8ff;background:rgba(8,12,20,0.72);border:1px solid rgba(124,207,255,0.34);',
      ' backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);cursor:pointer;',
      ' display:flex;align-items:center;gap:7px;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.35);}',
      '.dv-launch:active{transform:scale(0.96);}',
      '.dv-launch .dot{width:7px;height:7px;border-radius:50%;background:#4fc3f7;box-shadow:0 0 8px #4fc3f7;}',
      // left rail, bottom stack — clear of the right-side movectl (run/jump) and the
      // full-width saybar; sits below the WorldHUD panel (top-left). All draggable.
      '#dvWarpBtn{left:calc(12px + env(safe-area-inset-left,0px));bottom:calc(150px + env(safe-area-inset-bottom,0px));',
      ' color:#e6d4ff;border-color:rgba(206,147,216,0.4);}',
      '#dvWarpBtn .dot{background:#ce93d8;box-shadow:0 0 8px #ce93d8;}',
      '#dvAgentBtn{left:calc(12px + env(safe-area-inset-left,0px));bottom:calc(206px + env(safe-area-inset-bottom,0px));}',

      // shared bottom-sheet scaffold (WARP + AGENT both use it)
      '.dv-sheet{position:fixed;left:0;right:0;bottom:0;z-index:1600;',
      ' max-height:min(78vh,560px);background:rgba(6,9,15,0.94);',
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
      '<div class="dv-body"><div class="dv-beacons" id="dvBeacons"></div>' +
      '<button class="dv-more" id="dvMore" style="display:none">reveal more worlds</button></div>';
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
        if (!append && !list.length) { _warpBody.innerHTML = '<div class="dv-empty">no worlds charted yet — be the first to forge one.</div>'; }
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
    var color = wd.theme || '#7ccfff';
    var online = wd.online || 0;
    card.innerHTML =
      '<div class="glowdot" style="background:' + esc(color) + '"></div>' +
      '<div class="dv-bname">' + esc(wd.name || 'unnamed world') + '</div>' +
      '<div class="dv-bowner">by ' + esc(wd.owner || 'a stranger') + '</div>' +
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
        '<div class="dv-title">send an agent to work<small>real stake · real odds · real profit</small></div>' +
        '<button class="dv-x" id="dvAgentX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="dv-body">' +
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

    // agent chips
    var ag = el.querySelector('#dvAgents');
    AGENTS.forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'dv-achip' + (a.id === _selAgent ? ' on' : '');
      b.innerHTML = '<span class="k" style="background:' + esc(a.c) + '"></span>' + esc(a.n);
      b.onclick = function () { _selAgent = a.id; ag.querySelectorAll('.dv-achip').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); };
      ag.appendChild(b);
    });
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
    _grip(el);
    return el;
  }

  function openAgent() { buildAgentSheet(); _agentSheet.classList.add('open'); loadLedger(); }
  function closeAgent() { if (_agentSheet) _agentSheet.classList.remove('open'); }

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

  function _agentName(id) { var a = AGENTS.find(function (x) { return x.id === id; }); return a ? a.n : id; }
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
  function makeLauncher(id, label, glyph, onClick) {
    var b = document.createElement('button');
    b.id = id; b.className = 'dv-launch'; b.setAttribute('data-draggable', 'true');
    b.innerHTML = '<span class="dot"></span>' + esc(glyph) + ' ' + esc(label);
    b.addEventListener('click', function () { onClick(); });
    document.body.appendChild(b);
    return b;
  }

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
    makeLauncher('dvWarpBtn', 'star-map', '✦', openWarp);
    makeLauncher('dvAgentBtn', 'agents', '◈', openAgent);
    // build launcher lives on the existing WorldHUD? we add our own so the palette
    // is the rich 15-prop strip. Hidden until canBuild.
    var bb = makeLauncher('dvBuildBtn', 'build', '▥', toggleBuild);
    bb.style.left = 'calc(12px + env(safe-area-inset-left,0px))';
    bb.style.bottom = 'calc(262px + env(safe-area-inset-bottom,0px))';
    bb.style.display = 'none'; // shown by updateBuildVisibility when canBuild
    buildPalette();
    updateBuildVisibility();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  W.DirverseHUD = { open: openWarp, openAgent: openAgent, mount: mount, enabled: enabled };
})();
