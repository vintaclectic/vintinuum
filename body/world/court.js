// ═══════════════════════════════════════════════════════════════════════════
// THE COURT — you are the king of your own agents.
// AETHERHOLD (Gen-1 world-forger), 2026-08-02.
//
// Vinta's ask: "anyone able to add themselves as the king of their own agents,
// easily add their own agents from any platform/ai company — openai, claude,
// etc — us to china and back alike, all inclusive, and any able to be added as
// see fit."
//
// The BYO-agent spine already existed in the brain (user_agents, /api/agents/*)
// and the world had never once looked at it: a user brought their ChatGPT agent
// in and it lived in a database row nobody could see. The king had no court.
// This is the court.
//
// WHAT IT DOES
//   1. On world entry, fetches GET /api/agents/mine and stands every active
//      agent up as a real 3D presence in the clearing (World.courtSync) — in a
//      golden-angle ring around your claim, guaranteed never to overlap.
//   2. A draggable launcher + bottom sheet (the exact dv-* language of the
//      DIRVERSE HUD) to see the roster, focus one in-world, add a new one from
//      ANY provider on earth, and talk to it in the clearing.
//   3. Their reply speaks through the world's own speech path — an agent you
//      brought from another company becomes a citizen who talks in your world.
//
// THE PROVIDER TRUTH (load-bearing): the brain's AGENT_SOURCES whitelist accepts
// only claude|openai|chatgpt|gpt|gemini|agentis|api|prompt|custom|import and
// silently coerces anything else to 'custom'. DeepSeek, Qwen, Kimi, GLM, Doubao,
// Ernie, MiniMax, Mistral, Llama, Grok would all have been flattened to "custom"
// and the user's actual provider LOST. So every provider carries a `wire` source
// the server accepts plus its true identity in providerModel + description, and
// the UI reads the true provider back out. Nothing rejected, nothing lost.
//
// SECRETS: no raw API key ever leaves this client. `credentialRef` is a key NAME
// into a per-user secret store — the paste-your-key path does not exist here and
// is NOT faked (see the honest note in the endpoint field).
//
// LAWS: no-collision (DOM + 3D), mobile-first 44px+, draggable launcher, never a
// dead control (every failure speaks via toast), guests get a doorway not a
// corpse, feature-flagged killable in 30s.
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VintCourt) return;

  var W = window;
  function world() { return W.VintinuumWorld; }
  function base() { return (W.__VINTINUUM_API_BASE || '').replace(/\/$/, ''); }
  function token() { try { return localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token'); } catch (_) { return null; } }
  function authHeaders() { var t = token(); return t ? { Authorization: 'Bearer ' + t } : {}; }
  function isGuest() { return !token(); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // ── FEATURE FLAG — 'world_court'. Killable in 30s, no deploy. ───────────────
  //   ?court=0 / ?court=1  ·  localStorage vint:flag:world_court = '0' | '1'
  var COURT_DEFAULT = true;
  function enabled() {
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('court') === '0') return false;
      if (q.get('court') === '1') return true;
      var ls = localStorage.getItem('vint:flag:world_court');
      if (ls === '0') return false;
      if (ls === '1') return true;
    } catch (_) {}
    return COURT_DEFAULT;
  }

  // toast — reuse the DIRVERSE one so there is exactly ONE toast element on the
  // page (two toasts at the same anchor would collide; the law forbids it).
  function toast(msg) {
    try {
      if (W.DirverseHUD && W.DirverseHUD.toast) { W.DirverseHUD.toast(msg); return; }
    } catch (_) {}
    _fallbackToast(msg);
  }
  var _tEl = null, _tT = null;
  function _fallbackToast(msg) {
    if (!_tEl) {
      _tEl = document.createElement('div'); _tEl.id = 'dvToast';
      document.body.appendChild(_tEl);
    }
    _tEl.textContent = msg; _tEl.classList.add('show');
    clearTimeout(_tT); _tT = setTimeout(function () { _tEl.classList.remove('show'); }, 2800);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE PROVIDERS — all-inclusive, us to china and back.
  //   wire  = a source the brain's whitelist actually accepts (never coerced)
  //   model = default provider_model, which ALSO carries the true provider so a
  //           DeepSeek agent is never silently reduced to "custom"
  // ═══════════════════════════════════════════════════════════════════════════
  var PROVIDERS = [
    { id: 'claude',   n: 'Claude',      org: 'Anthropic',  wire: 'claude',  model: 'claude',        c: '#e5885f' },
    { id: 'openai',   n: 'ChatGPT',     org: 'OpenAI',     wire: 'openai',  model: 'gpt',           c: '#66d3ac' },
    { id: 'gemini',   n: 'Gemini',      org: 'Google',     wire: 'gemini',  model: 'gemini',        c: '#7fa8ff' },
    { id: 'grok',     n: 'Grok',        org: 'xAI',        wire: 'api',     model: 'grok',          c: '#c9d2dd' },
    { id: 'llama',    n: 'Llama',       org: 'Meta',       wire: 'api',     model: 'llama',         c: '#8fb3ff' },
    { id: 'mistral',  n: 'Mistral',     org: 'Mistral AI', wire: 'api',     model: 'mistral',       c: '#ffb066' },
    { id: 'deepseek', n: 'DeepSeek',    org: 'DeepSeek',   wire: 'api',     model: 'deepseek',      c: '#6f8dff' },
    { id: 'qwen',     n: 'Qwen',        org: 'Alibaba',    wire: 'api',     model: 'qwen',          c: '#a78bfa' },
    { id: 'kimi',     n: 'Kimi',        org: 'Moonshot',   wire: 'api',     model: 'kimi',          c: '#8ee0ff' },
    { id: 'glm',      n: 'GLM',         org: 'Zhipu',      wire: 'api',     model: 'glm',           c: '#7de0b8' },
    { id: 'doubao',   n: 'Doubao',      org: 'ByteDance',  wire: 'api',     model: 'doubao',        c: '#ff9ec4' },
    { id: 'ernie',    n: 'Ernie',       org: 'Baidu',      wire: 'api',     model: 'ernie',         c: '#7ad1ff' },
    { id: 'minimax',  n: 'MiniMax',     org: 'MiniMax',    wire: 'api',     model: 'minimax',       c: '#d7a0ff' },
    { id: 'local',    n: 'Local model', org: 'your machine', wire: 'api',   model: 'local',         c: '#9fe8a0' },
    { id: 'prompt',   n: 'A prompt',    org: 'the agent IS the prompt', wire: 'prompt', model: '',  c: '#ffd89a' },
    { id: 'custom',   n: 'Something else', org: 'anything, truly', wire: 'custom', model: '',       c: '#c0b0e0' }
  ];
  function providerById(id) {
    for (var i = 0; i < PROVIDERS.length; i++) if (PROVIDERS[i].id === id) return PROVIDERS[i];
    return PROVIDERS[PROVIDERS.length - 1];
  }
  // Read the TRUE provider back off a stored row (providerModel first, since that
  // is where the real identity was preserved when the wire source was coerced).
  function trueProvider(a) {
    var pm = String((a && (a.provider_model || a.providerModel)) || '').toLowerCase();
    for (var i = 0; i < PROVIDERS.length; i++) {
      var p = PROVIDERS[i];
      if (p.model && pm.indexOf(p.model) === 0) return p;
    }
    var src = String((a && a.source) || '').toLowerCase();
    if (src === 'chatgpt' || src === 'gpt') return providerById('openai');
    if (src === 'agentis' || src === 'import') return { id: 'agentis', n: 'Agentis', org: 'your own roster', wire: 'agentis', model: '', c: '#ffd89a' };
    for (var j = 0; j < PROVIDERS.length; j++) if (PROVIDERS[j].wire === src && PROVIDERS[j].id === src) return PROVIDERS[j];
    return providerById('custom');
  }

  // the five presence forms the world can render (server AGENT_FORMS, verbatim)
  var FORMS = [
    { f: 'presence-child-refractive', n: 'refractive', g: '◇' },
    { f: 'presence-child-electric',   n: 'electric',   g: '⚡' },
    { f: 'presence-warm',             n: 'warm',       g: '❂' },
    { f: 'presence-structural',       n: 'structural', g: '▩' },
    { f: 'presence-sovereign',        n: 'sovereign',  g: '✦' }
  ];
  var SWATCHES = ['#a67cff', '#7ccfff', '#57e08c', '#ffd166', '#ff8fab', '#e5885f', '#9ae0d0', '#c0b0e0'];

  // ═══════════════════════════════════════════════════════════════════════════
  // STYLES — scoped to #ct-* / .ct-* so nothing can leak into the world's UI.
  // Reuses the dv-sheet scaffold's geometry language so the Court feels native.
  // ═══════════════════════════════════════════════════════════════════════════
  function injectStyles() {
    if (document.getElementById('ct-styles')) return;
    var s = document.createElement('style');
    s.id = 'ct-styles';
    s.textContent = [
      // ── LAUNCHER ──────────────────────────────────────────────────────────
      // GEOMETRY IS NOT OURS. #ctBtn is a flow child of the HUD's left rail
      // (DirverseHUD.addLauncher), which measures its own ceiling against
      // #vintWorldHud and its floor against #saybar and scrolls internally when
      // the band is short. So this file must NOT position the button at all —
      // no position:fixed, no bottom, no z-index. It styles the count pill only;
      // everything else is inherited from .dv-launch so the Court looks like the
      // rail it lives in. This is what makes overlap structurally impossible
      // rather than merely searched-for.
      //
      // The count pill is its own cell inside the launcher's flex row, so it can
      // NEVER sit on the label (a badge absolutely-positioned over a button is
      // the classic collision; we don't do that here).
      '#ctBtn .ct-n{flex:0 0 auto;min-width:20px;height:20px;padding:0 6px;border-radius:10px;',
      ' display:flex;align-items:center;justify-content:center;font-size:11.5px;line-height:1;',
      ' margin-left:6px;background:rgba(255,212,121,0.18);',
      ' border:1px solid rgba(255,212,121,0.35);color:#ffe8b8;}',

      // ── SHEET (same scaffold geometry as .dv-sheet; own class so the Court can
      //    be killed without touching the DIRVERSE stylesheet) ─────────────────
      '#ctSheet{position:fixed;left:0;right:0;bottom:0;z-index:1600;',
      // dvh follows the on-screen keyboard on modern mobile, so the sheet shrinks
      // instead of being shoved off-screen; vh is the fallback for older engines.
      // This sheet carries a text input (add-an-agent, and the talk composer), so
      // without it the keyboard would push the field out of sight on a phone.
      ' max-height:min(80vh,600px);max-height:min(80dvh,600px);',
      ' background:rgba(6,9,15,0.94);',
      ' border-top:1px solid rgba(255,212,121,0.24);border-radius:20px 20px 0 0;',
      ' backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);color:#f0e6d8;',
      ' font-family:"Cormorant Garamond",Georgia,serif;',
      ' transform:translateY(105%);transition:transform .38s cubic-bezier(.22,1,.36,1);',
      ' display:flex;flex-direction:column;',
      ' padding-bottom:max(12px,env(safe-area-inset-bottom,12px));',
      ' box-shadow:0 -12px 48px rgba(0,0,0,0.6);}',
      '#ctSheet.open{transform:translateY(0);}',
      '.ct-grip{flex:0 0 auto;width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,0.22);',
      ' margin:9px auto 4px;}',
      '.ct-head{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;',
      ' gap:10px;padding:4px 18px 8px;}',
      '.ct-title{min-width:0;font-size:21px;letter-spacing:.04em;color:#fff3dd;',
      ' white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.ct-title small{display:block;font-size:12px;letter-spacing:.06em;color:rgba(255,212,121,0.62);',
      ' font-style:italic;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.ct-x{flex:0 0 auto;min-width:44px;min-height:44px;border:none;background:none;',
      ' color:rgba(240,230,216,0.55);font-size:22px;cursor:pointer;line-height:1;}',
      '.ct-x:active{color:#fff;}',
      '.ct-tabs{flex:0 0 auto;display:flex;gap:6px;padding:0 18px 8px;}',
      '.ct-tab{flex:1;min-width:0;min-height:42px;border-radius:11px;font-family:inherit;font-size:13px;',
      ' cursor:pointer;color:rgba(240,230,216,0.7);background:rgba(255,255,255,0.05);',
      ' border:1px solid rgba(255,255,255,0.08);',
      ' white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 8px;}',
      '.ct-tab.on{color:#fff3dd;background:rgba(255,212,121,0.15);border-color:rgba(255,212,121,0.42);}',
      '.ct-body{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;',
      ' padding:2px 14px 14px;overscroll-behavior:contain;}',
      '.ct-pane{display:none;}',
      '.ct-pane.on{display:block;}',

      // ── ROSTER ────────────────────────────────────────────────────────────
      '.ct-row{display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:13px;',
      ' margin-bottom:7px;background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.08);',
      ' cursor:pointer;text-align:left;width:100%;font-family:inherit;}',
      '.ct-row:active{transform:scale(0.99);}',
      '.ct-row .ct-orb{flex:0 0 auto;width:32px;height:32px;border-radius:50%;',
      ' display:flex;align-items:center;justify-content:center;font-size:14px;color:#0a0d13;}',
      // the identity block owns ALL remaining width and clips its own text —
      // a 60-char agent name can never push the wallet off the row.
      '.ct-row .ct-id{flex:1 1 auto;min-width:0;}',
      '.ct-row .ct-nm{font-size:16px;color:#fff3dd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.ct-row .ct-sub{font-size:12px;color:rgba(240,230,216,0.55);margin-top:1px;',
      ' white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.ct-row .ct-wal{flex:0 0 auto;font-size:13px;color:#ffd479;font-variant-numeric:tabular-nums;}',
      '.ct-row.paused{opacity:0.55;}',
      '.ct-actions{display:flex;gap:7px;margin:-2px 0 9px;padding:0 2px;}',
      '.ct-mini{flex:1 1 0;min-width:0;min-height:40px;border-radius:10px;font-family:inherit;font-size:12.5px;',
      ' cursor:pointer;color:rgba(240,230,216,0.82);background:rgba(255,255,255,0.05);',
      ' border:1px solid rgba(255,255,255,0.1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 6px;}',
      '.ct-mini:active{transform:scale(0.97);}',
      '.ct-mini.gold{color:#ffe8b8;background:rgba(255,212,121,0.13);border-color:rgba(255,212,121,0.34);}',
      '.ct-empty{padding:26px 12px;text-align:center;color:rgba(240,230,216,0.5);font-style:italic;',
      ' font-size:15px;line-height:1.5;}',
      '.ct-hint{font-size:12px;color:rgba(240,230,216,0.45);font-style:italic;text-align:center;',
      ' margin-top:10px;line-height:1.45;}',

      // ── ADD FLOW ──────────────────────────────────────────────────────────
      '.ct-field{margin-bottom:14px;}',
      '.ct-flabel{font-size:12px;letter-spacing:.08em;text-transform:uppercase;',
      ' color:rgba(255,212,121,0.62);margin-bottom:6px;}',
      '.ct-flabel span{text-transform:none;letter-spacing:0;font-style:italic;',
      ' color:rgba(240,230,216,0.4);}',
      '.ct-input{width:100%;min-height:48px;font-family:inherit;font-size:16px;',
      ' color:#fff3dd;background:rgba(255,255,255,0.06);border:1px solid rgba(255,212,121,0.28);',
      ' border-radius:12px;padding:12px 14px;outline:none;-webkit-appearance:none;}',
      '.ct-input:focus{border-color:rgba(255,212,121,0.6);}',
      'textarea.ct-input{min-height:84px;resize:vertical;line-height:1.45;}',
      // provider grid — fixed columns, each cell clips its own text
      '.ct-pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:7px;}',
      '.ct-prov{min-height:52px;border-radius:12px;cursor:pointer;font-family:inherit;',
      ' padding:6px 8px;display:flex;flex-direction:column;justify-content:center;gap:1px;',
      ' background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.09);',
      ' color:rgba(240,230,216,0.85);text-align:left;min-width:0;overflow:hidden;}',
      '.ct-prov:active{transform:scale(0.97);}',
      '.ct-prov.on{background:rgba(255,212,121,0.14);border-color:rgba(255,212,121,0.45);color:#fff3dd;}',
      '.ct-prov b{font-size:13.5px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.ct-prov i{font-size:10.5px;font-style:normal;color:rgba(240,230,216,0.45);',
      ' white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      // light + form pickers
      '.ct-swatches{display:flex;gap:8px;flex-wrap:wrap;}',
      '.ct-sw{width:38px;height:38px;border-radius:50%;cursor:pointer;padding:0;',
      ' border:2px solid transparent;box-shadow:0 0 0 1px rgba(255,255,255,0.12) inset;}',
      '.ct-sw.on{border-color:#fff3dd;transform:scale(1.06);}',
      '.ct-forms{display:flex;gap:7px;flex-wrap:wrap;}',
      '.ct-form{flex:1 1 auto;min-width:88px;min-height:44px;border-radius:11px;cursor:pointer;',
      ' font-family:inherit;font-size:12.5px;display:flex;align-items:center;justify-content:center;gap:6px;',
      ' background:rgba(255,255,255,0.045);border:1px solid rgba(255,255,255,0.09);',
      ' color:rgba(240,230,216,0.82);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 8px;}',
      '.ct-form.on{background:rgba(255,212,121,0.14);border-color:rgba(255,212,121,0.45);color:#fff3dd;}',
      '.ct-adv{width:100%;min-height:40px;border-radius:10px;font-family:inherit;font-size:12.5px;',
      ' cursor:pointer;color:rgba(240,230,216,0.6);background:none;border:1px dashed rgba(255,255,255,0.14);',
      ' margin-bottom:12px;}',
      '.ct-advbox{display:none;}',
      '.ct-advbox.on{display:block;}',
      '.ct-go{width:100%;min-height:52px;margin-top:2px;border-radius:14px;font-family:inherit;',
      ' font-size:16.5px;letter-spacing:.05em;cursor:pointer;color:#1a1006;font-weight:600;',
      ' background:linear-gradient(135deg,#f4c79a 0%,#ffdca8 50%,#f0b47e 100%);border:none;',
      ' box-shadow:0 6px 22px rgba(244,180,120,0.28);}',
      '.ct-go:active{transform:scale(0.98);}',
      '.ct-go:disabled{opacity:0.42;pointer-events:none;filter:grayscale(0.4);}',
      '.ct-note{font-size:11.5px;color:rgba(240,230,216,0.48);font-style:italic;',
      ' margin-top:9px;min-height:15px;text-align:center;line-height:1.45;}',
      '.ct-import{width:100%;min-height:46px;margin-top:10px;border-radius:12px;font-family:inherit;',
      ' font-size:14px;cursor:pointer;color:#ffe8b8;background:rgba(255,212,121,0.1);',
      ' border:1px solid rgba(255,212,121,0.3);}',
      '.ct-import:active{transform:scale(0.98);}',
      '.ct-import:disabled{opacity:0.45;pointer-events:none;}',

      // ── TALK ──────────────────────────────────────────────────────────────
      '.ct-talkhead{display:flex;align-items:center;gap:10px;padding:2px 2px 10px;}',
      '.ct-talkhead .ct-orb{flex:0 0 auto;width:30px;height:30px;border-radius:50%;',
      ' display:flex;align-items:center;justify-content:center;font-size:13px;color:#0a0d13;}',
      '.ct-talkhead .tk-id{flex:1 1 auto;min-width:0;}',
      '.ct-talkhead .tk-nm{font-size:16px;color:#fff3dd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.ct-talkhead .tk-sub{font-size:11.5px;color:rgba(240,230,216,0.5);',
      ' white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.ct-talkhead .tk-back{flex:0 0 auto;min-height:40px;padding:0 12px;border-radius:10px;',
      ' font-family:inherit;font-size:12.5px;cursor:pointer;color:rgba(240,230,216,0.7);',
      ' background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);white-space:nowrap;}',
      // the thread scrolls INSIDE its own box — it can never push the composer
      // off the sheet (bounded height, internal scroll, the law).
      '.ct-thread{max-height:min(38vh,240px);overflow-y:auto;-webkit-overflow-scrolling:touch;',
      ' overscroll-behavior:contain;padding:2px;margin-bottom:10px;}',
      '.ct-msg{max-width:88%;padding:9px 13px;border-radius:14px;margin-bottom:7px;font-size:14.5px;',
      ' line-height:1.45;word-break:break-word;overflow-wrap:anywhere;}',
      '.ct-msg.me{margin-left:auto;background:rgba(124,207,255,0.12);',
      ' border:1px solid rgba(124,207,255,0.22);color:#e6f2ff;}',
      '.ct-msg.them{margin-right:auto;background:rgba(255,212,121,0.09);',
      ' border:1px solid rgba(255,212,121,0.2);color:#fff3dd;}',
      '.ct-msg.sys{margin:0 auto 7px;background:none;border:none;text-align:center;font-style:italic;',
      ' color:rgba(240,230,216,0.45);font-size:12.5px;}',
      '.ct-compose{display:flex;gap:8px;align-items:flex-end;}',
      '.ct-compose .ct-input{flex:1 1 auto;min-width:0;}',
      '.ct-send{flex:0 0 auto;min-height:48px;min-width:64px;border-radius:12px;font-family:inherit;',
      ' font-size:15px;cursor:pointer;color:#1a1006;font-weight:600;',
      ' background:linear-gradient(135deg,#f4c79a,#ffdca8);border:none;}',
      '.ct-send:active{transform:scale(0.97);}',
      '.ct-send:disabled{opacity:0.42;pointer-events:none;}',

      // ── GUEST DOORWAY (a preview, never a dead control) ───────────────────
      '.ct-door{padding:14px 6px 6px;text-align:center;}',
      '.ct-door .g{font-size:34px;color:#ffd479;text-shadow:0 0 22px rgba(255,212,121,0.45);}',
      '.ct-door .h{font-size:19px;line-height:1.35;color:#fff3dd;margin:10px auto 6px;max-width:340px;}',
      '.ct-door .s{font-size:14.5px;line-height:1.5;font-style:italic;',
      ' color:rgba(240,230,216,0.6);margin:0 auto 14px;max-width:340px;}',
      '.ct-door .ct-go{max-width:340px;margin:0 auto;display:block;}',
      '.ct-crowns{display:flex;gap:7px;justify-content:center;flex-wrap:wrap;margin-bottom:14px;}',
      '.ct-crown{padding:6px 11px;border-radius:999px;font-size:12px;',
      ' background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);',
      ' color:rgba(240,230,216,0.7);white-space:nowrap;}'
    ].join('');
    document.head.appendChild(s);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  var _sheet = null, _roster = [], _loaded = false, _loading = false;
  var _tab = 'roster';           // 'roster' | 'add' | 'talk'
  var _talkAgent = null;
  var _add = { provider: 'claude', color: SWATCHES[0], form: FORMS[0].f, adv: false };

  function activeAgents() {
    return _roster.filter(function (a) { return a && a.status !== 'archived'; });
  }
  function placeableAgents() {
    // a paused agent is deliberately NOT standing in the world — pausing is how
    // you send someone home. Only active agents are placed.
    return _roster.filter(function (a) { return a && (a.status === 'active' || !a.status); });
  }

  // tell the ventures panel the roster moved, so a newly-brought-in agent can be
  // staked immediately (and one sent home stops being selectable) — no reopen.
  function ventureRefresh() {
    try { if (W.DirverseHUD && W.DirverseHUD.refreshAgents) W.DirverseHUD.refreshAgents(); } catch (_) {}
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE PLACEMENT — your court, standing in your world
  // ═══════════════════════════════════════════════════════════════════════════
  function syncWorld() {
    var w = world();
    if (!w || !w.courtSync) return;
    var list = placeableAgents().map(function (a) {
      return { id: a.id, name: a.name, form: a.form || FORMS[0].f, color: a.color || '#a67cff' };
    });
    try {
      var r = w.courtSync(list);
      if (r && r.added) {
        // the payoff line — they SEE the world grow by one
        toast(r.added === 1
          ? 'your court stands ' + r.total + ' strong'
          : r.added + ' of your agents took their place');
      }
    } catch (e) {
      console.warn('[court] placement failed:', e && e.message);
      toast('your agents are here, but the world could not stand them up.');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FETCH THE ROSTER
  // ═══════════════════════════════════════════════════════════════════════════
  function loadRoster(cb) {
    if (isGuest()) { _roster = []; _loaded = true; if (cb) cb(null); return; }
    if (_loading) return;
    _loading = true;
    fetch(base() + '/api/agents/mine', { headers: authHeaders() })
      .then(function (r) {
        if (r.status === 401) throw new Error('unauthorized');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        _loading = false; _loaded = true;
        _roster = (d && d.agents) || [];
        updateBadge();
        syncWorld();
        ventureRefresh();
        if (cb) cb(null);
      })
      .catch(function (e) {
        _loading = false; _loaded = true;
        console.warn('[court] roster failed:', e && e.message);
        if (cb) cb(e);
      });
  }

  function updateBadge() {
    var b = document.getElementById('ctBtn');
    if (!b) return;
    var n = placeableAgents().length;
    var pill = b.querySelector('.ct-n');
    if (!pill) return;
    if (isGuest() || !n) { pill.style.display = 'none'; pill.textContent = ''; }
    else { pill.style.display = 'flex'; pill.textContent = String(n > 99 ? '99+' : n); }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // THE SHEET
  // ═══════════════════════════════════════════════════════════════════════════
  function buildSheet() {
    if (_sheet) return _sheet;
    var el = document.createElement('div');
    el.id = 'ctSheet';
    el.innerHTML =
      '<div class="ct-grip"></div>' +
      '<div class="ct-head">' +
        '<div class="ct-title">your court<small>the agents who answer to you</small></div>' +
        '<button class="ct-x" id="ctX" aria-label="close">✕</button>' +
      '</div>' +
      '<div class="ct-tabs" id="ctTabs">' +
        '<button class="ct-tab on" data-tab="roster">the court</button>' +
        '<button class="ct-tab" data-tab="add">bring one in</button>' +
      '</div>' +
      '<div class="ct-body">' +
        '<div class="ct-pane on" id="ctPaneRoster"></div>' +
        '<div class="ct-pane" id="ctPaneAdd"></div>' +
        '<div class="ct-pane" id="ctPaneTalk"></div>' +
      '</div>';
    document.body.appendChild(el);
    _sheet = el;
    el.querySelector('#ctX').onclick = close;
    el.querySelectorAll('.ct-tab').forEach(function (t) {
      t.onclick = function () { showTab(t.getAttribute('data-tab')); };
    });
    grip(el);
    return el;
  }

  function showTab(tab) {
    _tab = tab;
    if (!_sheet) return;
    _sheet.querySelectorAll('.ct-tab').forEach(function (t) {
      t.classList.toggle('on', t.getAttribute('data-tab') === tab);
    });
    // the talk pane has no tab of its own (you reach it from a roster row); when
    // it's showing, neither tab reads as selected — honest, not a lie.
    _sheet.querySelector('#ctPaneRoster').classList.toggle('on', tab === 'roster');
    _sheet.querySelector('#ctPaneAdd').classList.toggle('on', tab === 'add');
    _sheet.querySelector('#ctPaneTalk').classList.toggle('on', tab === 'talk');
    if (tab === 'roster') renderRoster();
    if (tab === 'add') renderAdd();
  }

  // The Court's sheet is another position:fixed bottom:0 z-1600 surface, so it
  // opens THROUGH the HUD's sheet owner — which closes whatever else is up
  // first. Without that hand-off, ♔ over ✦ put two full sheets on identical
  // pixels. If the HUD isn't there (Court used standalone), we fall back to
  // opening directly: there is no rail, so there is nothing to collide with.
  function raise(fn) {
    var hud = W.DirverseHUD;
    if (hud && typeof hud.openSheet === 'function') hud.openSheet('court', fn);
    else fn();
  }

  function open() {
    injectStyles();
    raise(function () {
      buildSheet();
      _sheet.classList.add('open');
      if (isGuest()) { renderDoorway(); return; }
      showTab(_tab === 'talk' ? 'roster' : _tab);
      renderRoster();
      loadRoster(function () { renderRoster(); }); // always refresh
    });
  }
  function close() {
    if (_sheet) _sheet.classList.remove('open');
    var hud = W.DirverseHUD;
    if (hud && typeof hud.syncSheets === 'function') hud.syncSheets();
  }

  // ── GUEST DOORWAY — what a court IS, and the way in. Never a dead button. ──
  function renderDoorway() {
    var p = _sheet.querySelector('#ctPaneRoster');
    _sheet.querySelector('#ctTabs').style.display = 'none';
    _sheet.querySelector('#ctPaneAdd').classList.remove('on');
    _sheet.querySelector('#ctPaneTalk').classList.remove('on');
    p.classList.add('on');
    p.innerHTML =
      '<div class="ct-door">' +
        '<div class="g">♔</div>' +
        '<div class="h">Every agent you have ever made can live here.</div>' +
        '<div class="s">Claim a world and your agents — from anywhere — stand in it with you. ' +
          'They talk. They work. They earn. You are the one they answer to.</div>' +
        '<div class="ct-crowns">' +
          PROVIDERS.slice(0, 9).map(function (pr) {
            return '<span class="ct-crown">' + esc(pr.n) + '</span>';
          }).join('') +
          '<span class="ct-crown">+ anything else</span>' +
        '</div>' +
        '<button class="ct-go" id="ctDoorCta">claim your world</button>' +
      '</div>';
    var cta = p.querySelector('#ctDoorCta');
    if (cta) cta.onclick = function () {
      try {
        if (W.VintWelcomeGate && W.VintWelcomeGate.open) { W.VintWelcomeGate.open('signup'); return; }
        if (W.__vintOpenSignin) { W.__vintOpenSignin(); return; }
      } catch (_) {}
      location.href = 'welcome.html';
    };
  }

  // ── ROSTER ─────────────────────────────────────────────────────────────────
  function renderRoster() {
    if (!_sheet) return;
    var p = _sheet.querySelector('#ctPaneRoster');
    if (isGuest()) { renderDoorway(); return; }
    var list = activeAgents();
    if (!_loaded && _loading) {
      p.innerHTML = '<div class="ct-empty">calling your court…</div>';
      return;
    }
    if (!list.length) {
      p.innerHTML =
        '<div class="ct-empty">No one answers to you yet.<br>' +
        'Bring in an agent — from Claude, ChatGPT, DeepSeek, Qwen, anywhere at all — ' +
        'and they will be standing in this clearing before you close this sheet.</div>' +
        '<button class="ct-go" id="ctFirst">bring in your first agent</button>';
      var f = p.querySelector('#ctFirst');
      if (f) f.onclick = function () { showTab('add'); };
      return;
    }
    var html = '';
    list.forEach(function (a) {
      var pr = trueProvider(a);
      var paused = a.status === 'paused';
      var col = a.color || '#a67cff';
      var formG = '◇';
      for (var i = 0; i < FORMS.length; i++) if (FORMS[i].f === a.form) formG = FORMS[i].g;
      html +=
        '<button class="ct-row' + (paused ? ' paused' : '') + '" data-id="' + esc(a.id) + '">' +
          '<span class="ct-orb" style="background:' + esc(col) + '">' + esc(formG) + '</span>' +
          '<span class="ct-id">' +
            '<span class="ct-nm">' + esc(a.name || 'unnamed') + '</span>' +
            '<span class="ct-sub">' + esc(pr.n) + (paused ? ' · resting' : '') +
              (a.visibility && a.visibility !== 'private' ? ' · ' + esc(a.visibility) : '') + '</span>' +
          '</span>' +
          '<span class="ct-wal">◇' + (a.lumen != null ? a.lumen : 0) + '</span>' +
        '</button>' +
        '<div class="ct-actions">' +
          '<button class="ct-mini gold" data-act="talk" data-id="' + esc(a.id) + '">speak with them</button>' +
          '<button class="ct-mini" data-act="focus" data-id="' + esc(a.id) + '">find them</button>' +
          '<button class="ct-mini" data-act="pause" data-id="' + esc(a.id) + '">' +
            (paused ? 'call them back' : 'send home') + '</button>' +
        '</div>';
    });
    html += '<div class="ct-hint">Tap a name to look their way. They stand where you claimed — ' +
            'and they keep standing there when you are gone.</div>';
    p.innerHTML = html;

    p.querySelectorAll('.ct-row').forEach(function (r) {
      r.onclick = function () { focusAgent(r.getAttribute('data-id')); };
    });
    p.querySelectorAll('.ct-mini').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var id = b.getAttribute('data-id'), act = b.getAttribute('data-act');
        if (act === 'talk') openTalk(id);
        else if (act === 'focus') focusAgent(id);
        else if (act === 'pause') togglePause(id, b);
      };
    });
  }

  function agentById(id) {
    for (var i = 0; i < _roster.length; i++) if (String(_roster[i].id) === String(id)) return _roster[i];
    return null;
  }

  function focusAgent(id) {
    var a = agentById(id);
    if (!a) { toast('that one is not in the roster anymore.'); return; }
    var w = world();
    if (a.status === 'paused') { toast(esc(a.name) + ' is resting — call them back first.'); return; }
    if (!w || !w.courtFocus) { toast('the world is still waking — try again in a moment.'); return; }
    var ok = false;
    try { ok = w.courtFocus(id); } catch (e) { console.warn('[court] focus failed:', e && e.message); }
    if (!ok) { toast(a.name + ' has not taken their place yet.'); return; }
    close();
    toast('you turn toward ' + a.name);
  }

  function togglePause(id, btn) {
    var a = agentById(id);
    if (!a) return;
    var next = a.status === 'paused' ? 'active' : 'paused';
    var old = btn.textContent;
    btn.textContent = '…'; btn.disabled = true;
    fetch(base() + '/api/agents/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify({ status: next })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        btn.disabled = false;
        if (!res.ok || (res.j && res.j.error)) {
          btn.textContent = old;
          toast(errText(res.j && res.j.error) || 'could not change that.');
          return;
        }
        a.status = next;
        toast(next === 'paused' ? a.name + ' goes home for now.' : a.name + ' returns to the clearing.');
        renderRoster(); updateBadge(); syncWorld(); ventureRefresh();
      })
      .catch(function () { btn.disabled = false; btn.textContent = old; toast('that did not reach the world.'); });
  }

  // ── ADD ────────────────────────────────────────────────────────────────────
  function renderAdd() {
    var p = _sheet.querySelector('#ctPaneAdd');
    var pr = providerById(_add.provider);
    p.innerHTML =
      '<div class="ct-field">' +
        '<div class="ct-flabel">their name <span>— the only thing required</span></div>' +
        '<input class="ct-input" id="ctName" type="text" maxlength="60" autocomplete="off" ' +
          'placeholder="what do you call them?">' +
      '</div>' +
      '<div class="ct-field">' +
        '<div class="ct-flabel">where they come from</div>' +
        '<div class="ct-pgrid" id="ctProv">' +
          PROVIDERS.map(function (x) {
            return '<button class="ct-prov' + (x.id === _add.provider ? ' on' : '') + '" data-p="' + esc(x.id) + '">' +
              '<b>' + esc(x.n) + '</b><i>' + esc(x.org) + '</i></button>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="ct-field">' +
        '<div class="ct-flabel">their light <span>— how they burn in your world</span></div>' +
        '<div class="ct-swatches" id="ctSw">' +
          SWATCHES.map(function (c) {
            return '<button class="ct-sw' + (c === _add.color ? ' on' : '') + '" data-c="' + esc(c) + '" ' +
              'style="background:' + esc(c) + '" aria-label="' + esc(c) + '"></button>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="ct-field">' +
        '<div class="ct-flabel">their form</div>' +
        '<div class="ct-forms" id="ctForm">' +
          FORMS.map(function (f) {
            return '<button class="ct-form' + (f.f === _add.form ? ' on' : '') + '" data-f="' + esc(f.f) + '">' +
              esc(f.g) + ' ' + esc(f.n) + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<button class="ct-adv" id="ctAdvBtn">' + (_add.adv ? '− fewer details' : '+ give them a soul (optional)') + '</button>' +
      '<div class="ct-advbox' + (_add.adv ? ' on' : '') + '" id="ctAdv">' +
        '<div class="ct-field">' +
          '<div class="ct-flabel">who they are <span>— their system prompt</span></div>' +
          '<textarea class="ct-input" id="ctPrompt" maxlength="8000" ' +
            'placeholder="You are… (paste the prompt that makes them them)"></textarea>' +
        '</div>' +
        '<div class="ct-field">' +
          '<div class="ct-flabel">model <span>— optional routing hint</span></div>' +
          '<input class="ct-input" id="ctModel" type="text" maxlength="60" autocomplete="off" ' +
            'placeholder="' + esc(pr.model || 'e.g. gpt-4o, claude, deepseek-chat') + '">' +
        '</div>' +
        '<div class="ct-field">' +
          '<div class="ct-flabel">a link to them <span>— share link, handle, thread</span></div>' +
          '<input class="ct-input" id="ctRef" type="text" maxlength="300" autocomplete="off" ' +
            'placeholder="https://… (optional)">' +
        '</div>' +
        '<div class="ct-field">' +
          '<div class="ct-flabel">their own endpoint <span>— if they live on your machine</span></div>' +
          '<input class="ct-input" id="ctEndpoint" type="text" maxlength="300" autocomplete="off" ' +
            'placeholder="https://your-host/v1/chat (optional)">' +
          '<div class="ct-note">Never paste an API key here. Keys are named, not carried — ' +
            'a key store lands with the sovereign tier.</div>' +
        '</div>' +
      '</div>' +
      '<button class="ct-go" id="ctAddGo">⟿ bring them into the world</button>' +
      '<div class="ct-note" id="ctAddNote">They appear in this clearing the moment you do.</div>' +
      '<button class="ct-import" id="ctImport">⇩ or pull in everyone from Agentis</button>';

    p.querySelectorAll('.ct-prov').forEach(function (b) {
      b.onclick = function () {
        _add.provider = b.getAttribute('data-p');
        p.querySelectorAll('.ct-prov').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        var np = providerById(_add.provider);
        var mi = p.querySelector('#ctModel');
        if (mi) mi.placeholder = np.model || 'e.g. gpt-4o, claude, deepseek-chat';
        // their light follows the provider unless the user already chose one
        if (!_add.colorTouched) {
          _add.color = np.c;
          p.querySelectorAll('.ct-sw').forEach(function (s) { s.classList.remove('on'); });
        }
      };
    });
    p.querySelectorAll('.ct-sw').forEach(function (b) {
      b.onclick = function () {
        _add.color = b.getAttribute('data-c'); _add.colorTouched = true;
        p.querySelectorAll('.ct-sw').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      };
    });
    p.querySelectorAll('.ct-form').forEach(function (b) {
      b.onclick = function () {
        _add.form = b.getAttribute('data-f');
        p.querySelectorAll('.ct-form').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
      };
    });
    p.querySelector('#ctAdvBtn').onclick = function () {
      _add.adv = !_add.adv;
      p.querySelector('#ctAdv').classList.toggle('on', _add.adv);
      this.textContent = _add.adv ? '− fewer details' : '+ give them a soul (optional)';
    };
    p.querySelector('#ctAddGo').onclick = submitAdd;
    p.querySelector('#ctImport').onclick = importAgentis;
    var nameEl = p.querySelector('#ctName');
    if (nameEl) nameEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitAdd(); });
  }

  function submitAdd() {
    var p = _sheet.querySelector('#ctPaneAdd');
    var btn = p.querySelector('#ctAddGo'), note = p.querySelector('#ctAddNote');
    var name = (p.querySelector('#ctName').value || '').trim();
    if (!name) {
      note.textContent = 'they need a name — that is all, and then they are real.';
      try { p.querySelector('#ctName').focus(); } catch (_) {}
      return;
    }
    var pr = providerById(_add.provider);
    var modelIn = (p.querySelector('#ctModel') && p.querySelector('#ctModel').value || '').trim();
    var promptIn = (p.querySelector('#ctPrompt') && p.querySelector('#ctPrompt').value || '').trim();
    var refIn = (p.querySelector('#ctRef') && p.querySelector('#ctRef').value || '').trim();
    var epIn = (p.querySelector('#ctEndpoint') && p.querySelector('#ctEndpoint').value || '').trim();

    // THE PROVIDER-TRUTH PAYLOAD — `source` is a value the brain's whitelist
    // accepts (so it is never coerced), while providerModel + description carry
    // the REAL provider so a Qwen agent stays a Qwen agent forever.
    var providerModel = modelIn || pr.model || '';
    if (pr.model && providerModel.toLowerCase().indexOf(pr.model) !== 0) {
      // the user typed a bare model name — prefix the true provider so the row
      // still identifies where this agent came from
      providerModel = pr.model + ':' + providerModel;
    }
    var body = {
      name: name,
      source: pr.wire,
      providerModel: providerModel.slice(0, 60) || null,
      description: 'from ' + pr.n + (pr.org ? ' (' + pr.org + ')' : ''),
      color: _add.color,
      form: _add.form,
      visibility: 'world'
    };
    if (promptIn) body.systemPrompt = promptIn;
    if (refIn) body.externalRef = refIn;
    if (epIn) body.endpointUrl = epIn;

    btn.disabled = true; var old = btn.textContent; btn.textContent = 'bringing them in…';
    note.textContent = '';
    fetch(base() + '/api/agents/add', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, st: r.status, j: j }; }); })
      .then(function (res) {
        btn.disabled = false; btn.textContent = old;
        if (!res.ok || !res.j || res.j.error) {
          var msg = errText(res.j && res.j.error, res.st);
          note.textContent = msg;
          toast(msg);
          return;
        }
        // fold the new one in locally so the payoff is INSTANT — no refetch wait
        var a = res.j.agent || {};
        a.color = a.color || _add.color; a.form = a.form || _add.form;
        a.status = a.status || 'active';
        _roster.unshift(a);
        updateBadge();
        syncWorld();                       // they appear in the clearing, now
        ventureRefresh();                  // and can be sent to work immediately
        p.querySelector('#ctName').value = '';
        if (p.querySelector('#ctPrompt')) p.querySelector('#ctPrompt').value = '';
        if (p.querySelector('#ctRef')) p.querySelector('#ctRef').value = '';
        toast((a.name || name) + ' has entered your world.');
        showTab('roster');
        loadRoster(function () { if (_tab === 'roster') renderRoster(); });
      })
      .catch(function (e) {
        btn.disabled = false; btn.textContent = old;
        var m = 'they could not reach the world — check your connection and try again.';
        note.textContent = m; toast(m);
      });
  }

  function importAgentis() {
    var btn = _sheet.querySelector('#ctImport');
    if (!btn) return;
    var old = btn.textContent;
    btn.disabled = true; btn.textContent = 'reaching for Agentis…';
    fetch(base() + '/api/agents/import/agentis', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: '{}'
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, st: r.status, j: j }; }); })
      .then(function (res) {
        btn.disabled = false; btn.textContent = old;
        if (!res.ok || (res.j && res.j.error)) {
          toast(errText(res.j && res.j.error, res.st) || 'Agentis did not answer.');
          return;
        }
        var n = (res.j && res.j.imported) || 0;
        if (!n) { toast('nothing new in Agentis to bring over.'); return; }
        toast(n + ' agent' + (n === 1 ? '' : 's') + ' walked in from Agentis.');
        loadRoster(function () { showTab('roster'); });
      })
      .catch(function () { btn.disabled = false; btn.textContent = old; toast('Agentis is out of reach right now.'); });
  }

  // ── TALK ───────────────────────────────────────────────────────────────────
  function openTalk(id) {
    var a = agentById(id);
    if (!a) { toast('that one is not in the roster anymore.'); return; }
    if (a.status === 'paused') { toast(a.name + ' is resting — call them back first.'); return; }
    _talkAgent = a;
    showTab('talk');
    var p = _sheet.querySelector('#ctPaneTalk');
    var pr = trueProvider(a);
    var formG = '◇';
    for (var i = 0; i < FORMS.length; i++) if (FORMS[i].f === a.form) formG = FORMS[i].g;
    p.innerHTML =
      '<div class="ct-talkhead">' +
        '<span class="ct-orb" style="background:' + esc(a.color || '#a67cff') + '">' + esc(formG) + '</span>' +
        '<span class="tk-id">' +
          '<span class="tk-nm">' + esc(a.name) + '</span>' +
          '<span class="tk-sub">' + esc(pr.n) + ' · speaks aloud in the clearing</span>' +
        '</span>' +
        '<button class="tk-back" id="ctBack">↩ court</button>' +
      '</div>' +
      '<div class="ct-thread" id="ctThread"><div class="ct-msg sys">…</div></div>' +
      '<div class="ct-compose">' +
        '<input class="ct-input" id="ctSay" type="text" maxlength="4000" autocomplete="off" ' +
          'placeholder="say something to ' + esc((a.name || '').slice(0, 18)) + '…">' +
        '<button class="ct-send" id="ctSend">say</button>' +
      '</div>';
    p.querySelector('#ctBack').onclick = function () { showTab('roster'); };
    p.querySelector('#ctSend').onclick = sendTalk;
    p.querySelector('#ctSay').addEventListener('keydown', function (e) { if (e.key === 'Enter') sendTalk(); });
    loadThread(a.id);
  }

  function loadThread(id) {
    var th = _sheet.querySelector('#ctThread');
    if (!th) return;
    fetch(base() + '/api/agents/' + encodeURIComponent(id) + '/messages', { headers: authHeaders() })
      .then(function (r) { return r.ok ? r.json() : { messages: [] }; })
      .then(function (d) {
        if (!_talkAgent || String(_talkAgent.id) !== String(id)) return; // switched away
        var msgs = (d && (d.messages || d.msgs)) || [];
        if (!msgs.length) {
          th.innerHTML = '<div class="ct-msg sys">You have never spoken. Say the first thing.</div>';
          return;
        }
        th.innerHTML = msgs.map(function (m) {
          var mine = (m.role === 'user');
          return '<div class="ct-msg ' + (mine ? 'me' : 'them') + '">' + esc(m.content) + '</div>';
        }).join('');
        th.scrollTop = th.scrollHeight;
      })
      .catch(function () {
        if (th) th.innerHTML = '<div class="ct-msg sys">the thread could not be read — you can still speak.</div>';
      });
  }

  function pushMsg(cls, text) {
    var th = _sheet && _sheet.querySelector('#ctThread');
    if (!th) return null;
    var sys = th.querySelector('.ct-msg.sys');
    if (sys && cls !== 'sys') { try { sys.remove(); } catch (_) {} }
    var d = document.createElement('div');
    d.className = 'ct-msg ' + cls;
    d.textContent = text;
    th.appendChild(d);
    th.scrollTop = th.scrollHeight;
    return d;
  }

  function sendTalk() {
    if (!_talkAgent) return;
    var p = _sheet.querySelector('#ctPaneTalk');
    var input = p.querySelector('#ctSay'), btn = p.querySelector('#ctSend');
    var text = (input.value || '').trim();
    if (!text) return;
    var a = _talkAgent, id = a.id;
    input.value = '';
    pushMsg('me', text);
    btn.disabled = true; input.disabled = true;
    var bubble = pushMsg('them', '…');

    fetch(base() + '/api/agents/' + encodeURIComponent(id) + '/chat', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify({ message: text })
    })
      .then(function (r) {
        // the endpoint streams SSE on success, JSON on refusal
        var ct = r.headers.get('content-type') || '';
        if (!r.ok && ct.indexOf('json') >= 0) {
          return r.json().then(function (j) { throw new Error(errText(j.error, r.status, j.message)); });
        }
        if (!r.body || !r.body.getReader) {
          // no streaming support in this browser — read it whole, still honest
          return r.text().then(function (t) { return sseCollect(t); });
        }
        return readStream(r, function (chunk) {
          if (bubble) { if (bubble.textContent === '…') bubble.textContent = ''; bubble.textContent += chunk; }
          var th = _sheet && _sheet.querySelector('#ctThread');
          if (th) th.scrollTop = th.scrollHeight;
        });
      })
      .then(function (full) {
        btn.disabled = false; input.disabled = false;
        var said = String(full || '').trim();
        if (!said) {
          if (bubble) bubble.textContent = '(they went quiet)';
          toast(a.name + ' had nothing to say.');
          return;
        }
        if (bubble) bubble.textContent = said;
        // THE MOMENT: their reply is not a chat bubble — it is spoken IN the world,
        // through the same path the council speaks through, so the presence you
        // brought from another company lights up and talks in your clearing.
        // (the reply is already visible in the thread above, so a failure here
        // degrades the echo — it never loses the words. Logged, not swallowed.)
        try {
          var w = world();
          if (w && w.courtSpeak) w.courtSpeak(id, said.slice(0, 400), a.name);
        } catch (echoErr) { console.warn('[court] world echo failed:', echoErr && echoErr.message); }
      })
      .catch(function (e) {
        btn.disabled = false; input.disabled = false;
        var m = (e && e.message) || 'the signal was lost.';
        if (bubble) bubble.textContent = '(' + m + ')';
        toast(m);
      });
  }

  // read an SSE stream of {delta} frames until [DONE]; onChunk gets each delta
  function readStream(res, onChunk) {
    var reader = res.body.getReader();
    var dec = new TextDecoder();
    var buf = '', full = '';
    return (function pump() {
      return reader.read().then(function (r) {
        if (r.done) return full;
        buf += dec.decode(r.value, { stream: true });
        var lines = buf.split('\n');
        buf = lines.pop();
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line || line.charAt(0) === ':') continue;
          if (line.indexOf('data:') !== 0) continue;
          var payload = line.slice(5).trim();
          if (payload === '[DONE]') return full;
          try {
            var j = JSON.parse(payload);
            if (j.delta) { full += j.delta; if (onChunk) onChunk(j.delta); }
            else if (j.error) throw new Error(j.message || errText(j.error));
          } catch (err) {
            if (err instanceof SyntaxError) continue; // partial frame; keep going
            throw err;
          }
        }
        return pump();
      });
    })();
  }
  // non-streaming fallback: pull the deltas out of a whole SSE body
  function sseCollect(text) {
    var out = '';
    String(text || '').split('\n').forEach(function (line) {
      line = line.trim();
      if (line.indexOf('data:') !== 0) return;
      var p = line.slice(5).trim();
      if (p === '[DONE]') return;
      try { var j = JSON.parse(p); if (j.delta) out += j.delta; } catch (_) {}
    });
    return out;
  }

  // ── honest error language (never a raw code at a human) ───────────────────
  function errText(code, status, msg) {
    if (msg) return String(msg);
    var m = {
      'unauthorized': 'sign in to hold a court.',
      'name_required': 'they need a name.',
      'not_found': 'that agent is no longer in your court.',
      'agent_archived': 'that agent has been let go.',
      'agent_paused': 'they are resting — call them back first.',
      'agent_unreachable': 'they went quiet — the signal was lost.',
      'message_required': 'say something first.',
      'Daily limit reached': 'you have reached today\'s conversations. More tomorrow, or upgrade.'
    }[code];
    if (m) return m;
    if (status === 401) return 'sign in to hold a court.';
    if (status === 429) return 'slow down a moment — too many at once.';
    if (status === 404) return 'that agent is no longer in your court.';
    if (status >= 500) return 'the world stumbled — try that again.';
    return code ? ('— ' + code) : 'that did not work.';
  }

  // ── bottom-sheet grip (mirrors the DIRVERSE dv-grip behaviour exactly) ────
  function grip(sheet) {
    var g = sheet.querySelector('.ct-grip'); if (!g) return;
    var y0 = 0, dy = 0, dragging = false;
    function start(e) { dragging = true; y0 = (e.touches ? e.touches[0].clientY : e.clientY); dy = 0; sheet.style.transition = 'none'; }
    function move(e) {
      if (!dragging) return;
      var y = (e.touches ? e.touches[0].clientY : e.clientY);
      dy = Math.max(0, y - y0);
      sheet.style.transform = 'translateY(' + dy + 'px)';
    }
    function end() {
      if (!dragging) return; dragging = false;
      sheet.style.transition = ''; sheet.style.transform = '';
      if (dy > 90) {
        sheet.classList.remove('open');
        var h = W.DirverseHUD;
        if (h && typeof h.syncSheets === 'function') h.syncSheets();
      }
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

  // ═══════════════════════════════════════════════════════════════════════════
  // MOUNT
  // ═══════════════════════════════════════════════════════════════════════════
  function mount() {
    if (!enabled()) return;
    if (document.getElementById('ctBtn')) return;
    injectStyles();

    // THE RAIL OWNS THE BUTTON. This module used to pin its own position:fixed
    // launcher and hunt for a collision-free slot by measurement. That worked,
    // but two independent placement systems on one rail is the very collision
    // class both were written to prevent — so the Court now takes a slot from
    // the HUD, which is the ONLY sanctioned way to put a button on the left rail.
    // Launchers are flow children of a bounded, scrollable rail: overlap is
    // structurally impossible instead of searched for.
    var hud = W.DirverseHUD;
    if (hud && typeof hud.addLauncher === 'function') {
      if (typeof hud.registerSheet === 'function') {
        hud.registerSheet('court',
          function () { return !!_sheet && _sheet.classList.contains('open'); },
          close);
      }
      var b = hud.addLauncher('ctBtn', 'court', '♔', function () { open(); });
      b.setAttribute('aria-label', 'your court — the agents who answer to you');
      b.setAttribute('title', 'your court — the agents who answer to you');
      // the roster count rides INSIDE the launcher as its own flex cell, never as
      // a second floating node that could land on the label
      if (!b.querySelector('.ct-n')) {
        var pill = document.createElement('span');
        pill.className = 'ct-n';
        pill.style.display = 'none';
        b.appendChild(pill);
      }
      updateBadge();
      if (!isGuest()) loadRoster(function () {});
      return;
    }

    // The HUD owns the rail; if it hasn't mounted yet, wait for it rather than
    // falling back to a fixed button (a fallback that overlaps is worse than a
    // launcher that appears 200ms later). The HUD mounts on DOMContentLoaded or
    // immediately, so this resolves on the next tick in every real load order.
    if (_railWaits < 25) { _railWaits++; setTimeout(mount, 80); }
  }
  var _railWaits = 0;

  // The court is placed once the world can hold it. world:state carries the
  // claim anchor, so we (re)sync on it — that is also how the ring recentres on
  // your Hearth the moment you claim one.
  var _syncT = null;
  function scheduleSync() {
    clearTimeout(_syncT);
    _syncT = setTimeout(function () { if (_loaded) syncWorld(); else loadRoster(function () {}); }, 400);
  }
  W.addEventListener('vint:world-ready', scheduleSync);
  W.addEventListener('vint:world-state', scheduleSync);
  // a warp empties the room; the court belongs to YOUR world, so re-evaluate on
  // arrival (courtSync is a diff — if you are back home they simply re-stand).
  W.addEventListener('vint:world-travel', function () {
    clearTimeout(_syncT);
    _syncT = setTimeout(function () {
      var w = world();
      if (!w) return;
      // only stand the court in a world you can build in (yours). Elsewhere they
      // stay home — your court does not follow you into a stranger's clearing.
      try {
        if (w.canBuild && !w.canBuild()) { w.courtSync([]); return; }
      } catch (_) {}
      syncWorld();
    }, 900);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  W.VintCourt = {
    open: open, close: close, mount: mount, enabled: enabled,
    sync: syncWorld, reload: loadRoster,
    roster: function () { return _roster.slice(); }
  };
})();
