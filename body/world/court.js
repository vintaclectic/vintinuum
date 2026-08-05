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
  // `key` is where the owner gets one (shown as help, never fetched by us) and
  // `kh` is the shape their key takes, so the field can prompt with something
  // recognisable instead of a generic "paste a key". `byo:false` means the
  // provider has no outbound lane — a prompt-only agent thinks with the world's
  // own voice by design, so we must NOT offer it a key field and imply otherwise.
  var PROVIDERS = [
    { id: 'claude',   n: 'Claude',      org: 'Anthropic',  wire: 'claude',  model: 'claude',        c: '#e5885f', byo: 1, kh: 'sk-ant-…',   key: 'console.anthropic.com' },
    { id: 'openai',   n: 'ChatGPT',     org: 'OpenAI',     wire: 'openai',  model: 'gpt',           c: '#66d3ac', byo: 1, kh: 'sk-…',       key: 'platform.openai.com' },
    { id: 'gemini',   n: 'Gemini',      org: 'Google',     wire: 'gemini',  model: 'gemini',        c: '#7fa8ff', byo: 1, kh: 'AIza…',      key: 'aistudio.google.com' },
    { id: 'grok',     n: 'Grok',        org: 'xAI',        wire: 'api',     model: 'grok',          c: '#c9d2dd', byo: 1, kh: 'xai-…',      key: 'console.x.ai' },
    { id: 'llama',    n: 'Llama',       org: 'Meta',       wire: 'api',     model: 'llama',         c: '#8fb3ff', byo: 1, kh: 'your Together key', key: 'api.together.xyz' },
    { id: 'mistral',  n: 'Mistral',     org: 'Mistral AI', wire: 'api',     model: 'mistral',       c: '#ffb066', byo: 1, kh: 'your Mistral key',  key: 'console.mistral.ai' },
    { id: 'deepseek', n: 'DeepSeek',    org: 'DeepSeek',   wire: 'api',     model: 'deepseek',      c: '#6f8dff', byo: 1, kh: 'sk-…',       key: 'platform.deepseek.com' },
    { id: 'qwen',     n: 'Qwen',        org: 'Alibaba',    wire: 'api',     model: 'qwen',          c: '#a78bfa', byo: 1, kh: 'sk-…',       key: 'dashscope.console.aliyun.com' },
    { id: 'kimi',     n: 'Kimi',        org: 'Moonshot',   wire: 'api',     model: 'kimi',          c: '#8ee0ff', byo: 1, kh: 'sk-…',       key: 'platform.moonshot.cn' },
    { id: 'glm',      n: 'GLM',         org: 'Zhipu',      wire: 'api',     model: 'glm',           c: '#7de0b8', byo: 1, kh: 'your Zhipu key',    key: 'open.bigmodel.cn' },
    { id: 'doubao',   n: 'Doubao',      org: 'ByteDance',  wire: 'api',     model: 'doubao',        c: '#ff9ec4', byo: 1, kh: 'your Volcengine key', key: 'console.volcengine.com' },
    { id: 'ernie',    n: 'Ernie',       org: 'Baidu',      wire: 'api',     model: 'ernie',         c: '#7ad1ff', byo: 1, kh: 'your Qianfan key',  key: 'qianfan.baidubce.com' },
    { id: 'minimax',  n: 'MiniMax',     org: 'MiniMax',    wire: 'api',     model: 'minimax',       c: '#d7a0ff', byo: 1, kh: 'your MiniMax key',  key: 'platform.minimaxi.com' },
    { id: 'local',    n: 'Local model', org: 'your machine', wire: 'api',   model: 'local',         c: '#9fe8a0', byo: 1, kh: 'often anything, e.g. ollama', key: null },
    { id: 'prompt',   n: 'A prompt',    org: 'the agent IS the prompt', wire: 'prompt', model: '',  c: '#ffd89a', byo: 0 },
    { id: 'custom',   n: 'Something else', org: 'anything, truly', wire: 'custom', model: '',       c: '#c0b0e0', byo: 0 }
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

  // ── THE KEY, IN WORDS ──────────────────────────────────────────────────────
  // The copy around a credential field is not decoration — it is the entire
  // basis on which someone decides to trust us with a key. So it says three
  // true things every time: where the value goes, what we can see afterwards,
  // and who pays. No hedging, no "industry-standard security" noise.
  function keyPlaceholder(pr) {
    if (!pr || !pr.byo) return 'paste their key';
    return pr.kh || 'paste their key';
  }
  function keyNote(pr) {
    if (!pr || !pr.byo) {
      return 'This one has no key — they think with the world’s own voice, and that is free.';
    }
    var where = pr.key
      ? 'Get one at <b>' + esc(pr.key) + '</b>. '
      : (pr.id === 'local' ? 'A local model usually takes any value at all. ' : '');
    return where +
      'It is sealed on the brain the moment you send it — <b>never stored in this browser</b>, ' +
      'never shown again, never in a log. After this you will only ever see the last four ' +
      'characters. Their turns are billed to <b>your</b> account with ' + esc(pr.n) + ', not ours — ' +
      'which is exactly why we do not ration them.';
  }
  // Optional by design: an agent with no key still works, it just speaks with
  // the world's voice. Saying so removes the pressure from the most sensitive
  // field on the page (Retention Doctrine #1 — the generous kind).
  function keySkipNote() {
    return 'Leave it empty and they still walk in and talk — they will just borrow the ' +
           'world’s voice until you give them their own.';
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
      // THE ELLIPSIS ONLY WORKS ON A BLOCK (2026-08-05). These are <span>s, and
      // `overflow:hidden` + `text-overflow:ellipsis` do NOTHING on a non-replaced
      // INLINE box — the span simply sizes to its text. So a 60-character agent
      // name (the server's own maxlength) rendered 437px wide inside a 320px
      // sheet and ran straight off the edge, and the clip that was authored here
      // had never once fired. It looked correct for a year because every agent
      // anyone had tested with was short. `display:block` is what arms it, and
      // min-width:0 on the flex parent is what lets the block actually shrink.
      '.ct-row .ct-id{flex:1 1 auto;min-width:0;}',
      '.ct-row .ct-nm{display:block;font-size:16px;color:#fff3dd;',
      ' white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.ct-row .ct-sub{display:block;font-size:12px;color:rgba(240,230,216,0.55);margin-top:1px;',
      ' white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.ct-row .ct-wal{flex:0 0 auto;font-size:13px;color:#ffd479;font-variant-numeric:tabular-nums;}',
      '.ct-row.paused{opacity:0.55;}',

      // ── THE WATCH (THE VIGIL) ─────────────────────────────────────────────
      // An agent's watch is now load-bearing: a tended agent holds the world's
      // light while its king is away, an untended one slowly stops. So every row
      // says which it is. The line is a THIRD row inside .ct-id — that block
      // already owns all remaining width and clips its own text, so a 60-char
      // name and a long watch label still can never reach the wallet cell.
      '.ct-row .ct-watch{display:flex;align-items:center;gap:5px;margin-top:3px;',
      ' font-size:11px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.ct-row .ct-watch i{flex:0 0 auto;width:6px;height:6px;border-radius:50%;font-style:normal;}',
      '.ct-row .ct-watch.fresh{color:rgba(150,235,185,0.85);}',
      '.ct-row .ct-watch.fresh i{background:#57e08c;box-shadow:0 0 6px rgba(87,224,140,0.7);}',
      '.ct-row .ct-watch.fading{color:rgba(255,205,150,0.85);}',
      '.ct-row .ct-watch.fading i{background:#ffb066;box-shadow:0 0 6px rgba(255,176,102,0.6);}',
      '.ct-row .ct-watch.cold{color:rgba(240,230,216,0.42);}',
      '.ct-row .ct-watch.cold i{background:rgba(255,255,255,0.22);}',
      '.ct-row .ct-watch.off{color:rgba(240,230,216,0.35);}',
      '.ct-row .ct-watch.off i{background:rgba(255,255,255,0.16);}',
      '.ct-mini.warm{color:#ffe8b8;background:rgba(87,224,140,0.1);border-color:rgba(87,224,140,0.3);}',
      '.ct-mini:disabled{opacity:0.5;pointer-events:none;}',

      // ── THE VIGIL SUMMARY — one banner at the head of the roster ───────────
      // A flow block at the top of the scrolling pane; nothing is positioned, so
      // it cannot collide with the rows below it or with the sheet chrome above.
      '.ct-vigil{margin:2px 0 12px;padding:12px 13px;border-radius:14px;',
      ' background:linear-gradient(180deg,rgba(87,224,140,0.09),rgba(255,212,121,0.05));',
      ' border:1px solid rgba(87,224,140,0.26);}',
      '.ct-vigil.dim{background:rgba(255,176,102,0.06);border-color:rgba(255,176,102,0.28);}',
      '.ct-vtop{display:flex;align-items:center;gap:10px;}',
      '.ct-vn{flex:0 0 auto;min-width:34px;height:34px;padding:0 6px;border-radius:10px;',
      ' display:flex;align-items:center;justify-content:center;font-size:19px;line-height:1;',
      ' color:#0a0d13;background:#57e08c;font-variant-numeric:tabular-nums;}',
      '.ct-vigil.dim .ct-vn{background:rgba(255,176,102,0.85);}',
      '.ct-vt{flex:1 1 auto;min-width:0;font-size:14px;line-height:1.35;color:#fff3dd;}',
      '.ct-vsub{margin-top:7px;font-size:12px;line-height:1.4;color:rgba(240,230,216,0.6);}',
      '.ct-vtend{width:100%;min-height:44px;margin-top:10px;border-radius:11px;font-family:inherit;',
      ' font-size:14px;letter-spacing:.03em;cursor:pointer;color:#1a1006;font-weight:600;border:none;',
      ' background:linear-gradient(90deg,#ffd479,#ffb066);}',
      '.ct-vtend:active{transform:scale(0.985);}',
      '.ct-vtend:disabled{opacity:0.5;pointer-events:none;}',
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
      // <b> and <i> are inline, so their authored ellipsis never fired and "the
      // agent IS the prompt" (the longest org label) laid out 128px wide inside
      // a 118px cell, reaching onto the NEXT provider button in the grid.
      //
      // display:block ALONE is not enough here and that is the subtle part: the
      // parent is a flex COLUMN, so a block child sizes to max-content and the
      // parent's overflow:hidden only clips the PAINT — the layout box stays
      // 128px and still collides. `width:100%` (against the cell the grid
      // already sized) is what makes the box itself shrink, and only then does
      // text-overflow have a boundary to ellipsize at. Clip the box, not just
      // the ink.
      '.ct-prov b{display:block;width:100%;min-width:0;font-size:13.5px;font-weight:500;',
      ' white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.ct-prov i{display:block;width:100%;min-width:0;font-size:10.5px;font-style:normal;',
      ' color:rgba(240,230,216,0.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
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

      // ── THE KEY — their own provider, sealed on the brain ─────────────────
      // A key field is the single most sensitive input in this whole product, so
      // it says out loud where the value goes and what we can and cannot see.
      // No positioning here either: every one of these is a flow child of the
      // scrolling pane, so the no-collision law holds structurally.
      '.ct-keybox{margin:2px 0 12px;padding:12px 13px;border-radius:14px;',
      ' background:linear-gradient(180deg,rgba(124,207,255,0.07),rgba(167,124,255,0.05));',
      ' border:1px solid rgba(124,207,255,0.24);}',
      '.ct-keyhead{display:flex;align-items:center;gap:8px;margin-bottom:8px;}',
      // flex:1 makes this a flex ITEM (so it is blockified and the ellipsis is
      // real), min-width:0 lets it actually shrink below its content, and the
      // <em> qualifier inside inherits the clip instead of escaping it.
      '.ct-keyhead b{flex:1 1 auto;min-width:0;font-size:14px;font-weight:500;color:#e6f2ff;',
      ' white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      // the qualifier is its OWN wrapping line beneath the label (see the markup
      // note): it wraps inside the box rather than laying out a 259px inline run
      // that escapes a 320px sheet, so nothing is clipped and nothing collides.
      '.ct-keysub{font-size:11.5px;font-style:italic;line-height:1.4;',
      ' color:rgba(230,242,255,0.45);margin:-4px 0 8px;}',
      // the lock glyph is its own flex cell — never absolutely placed on the label
      '.ct-keyhead .lk{flex:0 0 auto;font-size:14px;color:#7ccfff;}',
      '.ct-keynote{font-size:11.5px;line-height:1.45;color:rgba(230,242,255,0.62);margin-top:8px;}',
      '.ct-keynote b{color:rgba(230,242,255,0.85);font-weight:500;}',
      // an on-file key shows only its mask; the value can never come back
      '.ct-onfile{display:flex;align-items:center;gap:9px;margin-top:2px;}',
      '.ct-onfile .m{flex:1 1 auto;min-width:0;font-size:13.5px;color:#9fe8a0;',
      ' font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.ct-onfile .x{flex:0 0 auto;min-height:38px;padding:0 12px;border-radius:10px;',
      ' font-family:inherit;font-size:12.5px;cursor:pointer;color:rgba(240,230,216,0.7);',
      ' background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);white-space:nowrap;}',
      '.ct-onfile .x:active{transform:scale(0.97);}',

      // ── THE LANE BADGE — which voice actually answers ─────────────────────
      // Retention Doctrine #6 (transparent) made literal: a row says whether the
      // agent speaks on its own provider or on ours. It is a THIRD line inside
      // .ct-id, which already owns all remaining width and clips its own text,
      // so it can never widen the row or reach the wallet cell.
      '.ct-row .ct-lane{display:flex;align-items:center;gap:5px;margin-top:3px;',
      ' font-size:11px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.ct-row .ct-lane i{flex:0 0 auto;font-style:normal;font-size:10px;}',
      '.ct-row .ct-lane.own{color:rgba(159,232,160,0.85);}',
      '.ct-row .ct-lane.ours{color:rgba(240,230,216,0.42);}',

      // ── TALK ──────────────────────────────────────────────────────────────
      '.ct-talkhead{display:flex;align-items:center;gap:10px;padding:2px 2px 10px;}',
      '.ct-talkhead .ct-orb{flex:0 0 auto;width:30px;height:30px;border-radius:50%;',
      ' display:flex;align-items:center;justify-content:center;font-size:13px;color:#0a0d13;}',
      // same inline-span trap as .ct-nm/.ct-sub above — these are the talk/key
      // pane's header and they carry the SAME 60-char names, so they need the
      // same display:block to make their authored ellipsis real. Without it the
      // name ran under the "↩ court" button (measured: 74x19 overlap at 320px).
      '.ct-talkhead .tk-id{flex:1 1 auto;min-width:0;}',
      '.ct-talkhead .tk-nm{display:block;font-size:16px;color:#fff3dd;',
      ' white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.ct-talkhead .tk-sub{display:block;font-size:11.5px;color:rgba(240,230,216,0.5);',
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

  // ═══════════════════════════════════════════════════════════════════════════
  // THE WATCH — what an agent is actually DOING while you're gone
  // vigil.js: an active agent's watch is full strength for VIGIL_FULL_DAYS (3)
  // after it was tended, then fades linearly to nothing by VIGIL_FADE_DAYS (14).
  // A full watch offsets the world's drain; a faded one offsets nothing. That is
  // the whole reason the Court matters to survival, so the roster has to SAY it.
  //
  // These constants mirror the server's and are used ONLY to choose a word and a
  // colour for a row. The client never computes spark, drift or the floor from
  // them — the authoritative watch values come down in living.vigil.watchers,
  // and the panel renders those. This is presentation of a timestamp the server
  // already sent, not a second implementation of the loop.
  // ═══════════════════════════════════════════════════════════════════════════
  var VIGIL_FULL_DAYS = 3, VIGIL_FADE_DAYS = 14;

  function watchOf(a) {
    if (!a || a.status !== 'active') return { w: 0, state: 'off', label: 'not standing watch' };
    var t = a.tended_at || a.updated_at || a.created_at;
    if (!t) return { w: 1, state: 'fresh', label: 'watch is fresh' };
    var days = Math.max(0, (Date.now() / 1000 - Number(t)) / 86400);
    var w = days <= VIGIL_FULL_DAYS ? 1
          : days >= VIGIL_FADE_DAYS ? 0
          : 1 - ((days - VIGIL_FULL_DAYS) / (VIGIL_FADE_DAYS - VIGIL_FULL_DAYS));
    var left = Math.max(0, VIGIL_FADE_DAYS - days);
    if (w >= 0.999) {
      var until = Math.max(0, VIGIL_FULL_DAYS - days);
      return {
        w: 1, state: 'fresh',
        label: 'holding the light' + (until < 1 ? ' · fades soon' : ' · full for ' + Math.round(until) + 'd')
      };
    }
    if (w <= 0) return { w: 0, state: 'cold', label: 'watch has gone out — tend to restore it' };
    return {
      w: w, state: 'fading',
      label: 'watch fading · ' + (left < 1 ? 'out within a day' : Math.round(left) + 'd left')
    };
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
  // Callers pass a cb that renders the pane, so DROPPING that cb leaves the pane
  // stuck on "calling your court…" forever. The old `if (_loading) return;`
  // did exactly that whenever open() raced the mount-time auto-load — which is
  // the common case, since world-ready/world-state both schedule one. THE VIGIL
  // made it visible (the watch summary needs a loaded roster to say anything
  // true), but the bug predates it. Now a concurrent call QUEUES its callback
  // and every queued caller is answered by the one in-flight request.
  var _waiters = [];
  function loadRoster(cb) {
    if (isGuest()) {
      // Signing out mid-flight must not strand waiters queued while signed in.
      _roster = []; _loaded = true; _loading = false;
      var gq = _waiters; _waiters = [];
      if (cb) { try { cb(null); } catch (_) {} }
      for (var g = 0; g < gq.length; g++) { try { gq[g](null); } catch (_) {} }
      return;
    }
    if (_loading) { if (cb) _waiters.push(cb); return; }
    _loading = true;
    function settle(err) {
      _loading = false; _loaded = true;
      var q = _waiters; _waiters = [];
      if (cb) { try { cb(err); } catch (_) {} }
      for (var i = 0; i < q.length; i++) { try { q[i](err); } catch (_) {} }
    }
    fetch(base() + '/api/agents/mine', { headers: authHeaders() })
      .then(function (r) {
        if (r.status === 401) throw new Error('unauthorized');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        _roster = (d && d.agents) || [];
        updateBadge();
        syncWorld();
        ventureRefresh();
        settle(null);
      })
      .catch(function (e) {
        console.warn('[court] roster failed:', e && e.message);
        settle(e);
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

  // `tab` is optional — THE VIGIL's concrete ask ("one more tended agent holds
  // +N light a day") routes straight here with 'add', so the honest conversion
  // path is one tap from the number that motivated it, never a hunt.
  function open(tab) {
    injectStyles();
    raise(function () {
      buildSheet();
      _sheet.classList.add('open');
      if (isGuest()) { renderDoorway(); return; }
      var want = (tab === 'add' || tab === 'roster') ? tab : (_tab === 'talk' ? 'roster' : _tab);
      showTab(want);
      if (want === 'roster') renderRoster();
      loadRoster(function () { if (_tab === 'roster') renderRoster(); }); // always refresh
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
    // THE WATCH, SUMMARISED. How many of this court are actually holding the
    // light right now — the one number that connects this sheet to survival.
    var holding = 0, fading = 0, cold = 0;
    list.forEach(function (a) {
      var wt = watchOf(a);
      if (wt.state === 'fresh') holding++;
      else if (wt.state === 'fading') fading++;
      else if (wt.state === 'cold') cold++;
    });
    var html = '';
    if (holding || fading || cold) {
      html +=
        '<div class="ct-vigil' + (holding ? '' : ' dim') + '">' +
          '<div class="ct-vtop">' +
            '<span class="ct-vn">' + holding + '</span>' +
            '<span class="ct-vt">' +
              (holding
                ? (holding === 1 ? 'one stands watch' : holding + ' stand watch') +
                  ' over your world right now'
                : 'no one is holding the light in your world') +
            '</span>' +
          '</div>' +
          ((fading || cold)
            ? '<div class="ct-vsub">' +
                (fading ? fading + (fading === 1 ? ' watch is fading' : ' watches are fading') : '') +
                (fading && cold ? ' · ' : '') +
                (cold ? cold + (cold === 1 ? ' has gone out' : ' have gone out') : '') +
                ' — tending restores them.' +
              '</div>'
            : '') +
          '<button class="ct-vtend" id="ctTendAll">✦ tend the whole court</button>' +
        '</div>';
    }
    list.forEach(function (a) {
      var pr = trueProvider(a);
      var paused = a.status === 'paused';
      var col = a.color || '#a67cff';
      var formG = '◇';
      for (var i = 0; i < FORMS.length; i++) if (FORMS[i].f === a.form) formG = FORMS[i].g;
      var wt = watchOf(a);
      html +=
        '<button class="ct-row' + (paused ? ' paused' : '') + '" data-id="' + esc(a.id) + '">' +
          '<span class="ct-orb" style="background:' + esc(col) + '">' + esc(formG) + '</span>' +
          '<span class="ct-id">' +
            '<span class="ct-nm">' + esc(a.name || 'unnamed') + '</span>' +
            '<span class="ct-sub">' + esc(pr.n) + (paused ? ' · resting' : '') +
              (a.visibility && a.visibility !== 'private' ? ' · ' + esc(a.visibility) : '') + '</span>' +
            // the watch line: its own row inside the identity block, so it can
            // never widen the row or land on the wallet.
            '<span class="ct-watch ' + wt.state + '"><i></i>' + esc(wt.label) + '</span>' +
            // THE LANE — which voice actually answers. Only shown for providers
            // that HAVE an outbound lane; a prompt-only agent borrowing the
            // world's voice is its design, not a downgrade, so it says nothing.
            (pr.byo
              ? '<span class="ct-lane ' + (a.credential_hint ? 'own' : 'ours') + '"><i>' +
                  (a.credential_hint ? '🔒' : '◈') + '</i>' +
                  esc(a.credential_hint
                    ? 'their own ' + pr.n + ' · ' + a.credential_hint
                    : 'borrowing the world’s voice') +
                '</span>'
              : '') +
          '</span>' +
          '<span class="ct-wal">◇' + (a.lumen != null ? a.lumen : 0) + '</span>' +
        '</button>' +
        '<div class="ct-actions">' +
          '<button class="ct-mini gold" data-act="talk" data-id="' + esc(a.id) + '">speak with them</button>' +
          // per-agent tend — only offered for an agent actually able to stand a
          // watch. A resting (paused) agent offsets nothing, so tending it would
          // be a lie; you call them back first.
          (paused
            ? '<button class="ct-mini" data-act="focus" data-id="' + esc(a.id) + '">find them</button>'
            : '<button class="ct-mini warm" data-act="tend" data-id="' + esc(a.id) + '">' +
                (wt.state === 'fresh' ? 'watch held' : 'set their watch') + '</button>') +
          '<button class="ct-mini" data-act="pause" data-id="' + esc(a.id) + '">' +
            (paused ? 'call them back' : 'send home') + '</button>' +
        '</div>' +
        // THE KEY ROW — its own flex row beneath the actions, never a control
        // squeezed into the row above (three 40px cells is already the floor at
        // 320px; a fourth would collide). Only for agents that HAVE a lane.
        (pr.byo
          ? '<div class="ct-actions">' +
              '<button class="ct-mini' + (a.credential_hint ? '' : ' gold') + '" data-act="key" data-id="' + esc(a.id) + '">' +
                (a.credential_hint ? '🔒 replace their key' : '🔒 give them their own mind') + '</button>' +
              (a.credential_hint
                ? '<button class="ct-mini" data-act="unkey" data-id="' + esc(a.id) + '">take it back</button>'
                : '') +
            '</div>'
          : '');
    });
    html += '<div class="ct-hint">Tap a name to look their way. They stand where you claimed — ' +
            'and they keep standing there when you are gone. ' +
            'A tended agent holds your world’s light while you sleep; an untended one slowly stops.</div>';
    p.innerHTML = html;

    var ta = p.querySelector('#ctTendAll');
    if (ta) ta.onclick = function (e) { e.stopPropagation(); tendCourt(null, ta); };

    p.querySelectorAll('.ct-row').forEach(function (r) {
      r.onclick = function () { focusAgent(r.getAttribute('data-id')); };
    });
    p.querySelectorAll('.ct-mini').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var id = b.getAttribute('data-id'), act = b.getAttribute('data-act');
        if (act === 'talk') openTalk(id);
        else if (act === 'focus') focusAgent(id);
        else if (act === 'tend') tendCourt(id, b);
        else if (act === 'pause') togglePause(id, b);
        else if (act === 'key') openKey(id);
        else if (act === 'unkey') removeKey(id, b);
      };
    });
  }

  function agentById(id) {
    for (var i = 0; i < _roster.length; i++) if (String(_roster[i].id) === String(id)) return _roster[i];
    return null;
  }

  // ── TEND — the headline survival act, from the Court ─────────────────────────
  // With an id it refreshes ONE agent's watch; without one, the whole court.
  // Server-authoritative: we send the intent and wait. The reply (vint:world-tend)
  // carries the true `tended_at` effect, so we refresh the roster from the server
  // rather than stamping the local row — the client never invents a watch.
  var _tending = false, _tendT = null;
  function tendCourt(id, btn) {
    if (_tending) return;
    if (isGuest()) { toast('sign in to keep a court.'); return; }
    var w = world();
    if (!w || !w.tend) { toast('the world is still waking — try again in a moment.'); return; }
    _tending = true;
    var was = btn ? btn.textContent : null;
    if (btn) { btn.textContent = 'tending…'; btn.disabled = true; }
    // World.tend returns FALSE when the socket is down and the message was
    // silently dropped by send()'s readyState guard. Without checking it, a
    // dead socket left the button reading "tending…" for the full 6s timeout
    // and then reverting with no explanation — the user is told nothing while
    // the act quietly failed. Fail fast and honestly instead.
    var sent = false;
    try { sent = w.tend(id || null); }
    catch (e) {
      _tending = false;
      if (btn) { btn.textContent = was; btn.disabled = false; }
      toast('could not reach the world — try again.');
      return;
    }
    if (sent === false) {
      _tending = false;
      if (btn) { btn.textContent = was; btn.disabled = false; }
      toast('the clearing is out of reach — reload and try again.');
      return;
    }
    // release if the reply never lands, so a dropped socket can never leave the
    // control permanently dead.
    clearTimeout(_tendT);
    _tendT = setTimeout(function () {
      _tending = false;
      if (btn) { try { btn.textContent = was; btn.disabled = false; } catch (_) {} }
    }, 6000);
  }

  // the server's answer — refresh the roster so every watch line re-reads from
  // the authoritative tended_at, then re-render if the sheet is showing it.
  W.addEventListener('vint:world-tend', function (e) {
    clearTimeout(_tendT); _tending = false;
    var d = e.detail || {};
    var n = (typeof d.tended === 'number') ? d.tended : 0;
    if (n) {
      toast(n === 1 ? 'their watch is set — they hold the light now.'
                    : 'you tended ' + n + ' — your court holds the light.');
    }
    loadRoster(function () { if (_tab === 'roster' && _sheet && _sheet.classList.contains('open')) renderRoster(); });
  });

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

  // ═══════════════════════════════════════════════════════════════════════════
  // THE KEY — give an existing agent their own mind, or take it back.
  //
  // This reuses the TALK pane rather than opening a second sheet: two
  // position:fixed bottom sheets on one page is exactly the collision the
  // no-collision law forbids, and the Court already routes every surface through
  // one owner (DirverseHUD.openSheet). One sheet, three panes, always.
  // ═══════════════════════════════════════════════════════════════════════════
  function openKey(id) {
    var a = agentById(id);
    if (!a) { toast('that one is not in the roster anymore.'); return; }
    var pr = trueProvider(a);
    if (!pr.byo) { toast(a.name + ' has no provider to reach — they think with the world’s voice.'); return; }
    _talkAgent = null;               // this pane is not a conversation right now
    showTab('talk');
    var p = _sheet.querySelector('#ctPaneTalk');
    var formG = '◇';
    for (var i = 0; i < FORMS.length; i++) if (FORMS[i].f === a.form) formG = FORMS[i].g;
    p.innerHTML =
      '<div class="ct-talkhead">' +
        '<span class="ct-orb" style="background:' + esc(a.color || '#a67cff') + '">' + esc(formG) + '</span>' +
        '<span class="tk-id">' +
          '<span class="tk-nm">' + esc(a.name) + '</span>' +
          '<span class="tk-sub">' + esc(pr.n) + ' · ' +
            esc(a.credential_hint ? 'key on file · ' + a.credential_hint : 'no key yet') + '</span>' +
        '</span>' +
        '<button class="tk-back" id="ctKeyBack">↩ court</button>' +
      '</div>' +
      '<div class="ct-keybox">' +
        '<div class="ct-keyhead"><span class="lk">🔒</span><b>' +
          esc(a.credential_hint ? 'replace their ' + pr.n + ' key' : 'give ' + a.name + ' their own mind') +
        '</b></div>' +
        (a.credential_hint
          ? '<div class="ct-onfile"><span class="m">on file · ' + esc(a.credential_hint) + '</span></div>'
          : '') +
        '<input class="ct-input" id="ctKeyOne" type="password" maxlength="4096" autocomplete="off" ' +
          'autocapitalize="off" autocorrect="off" spellcheck="false" style="margin-top:8px" ' +
          'placeholder="' + esc(keyPlaceholder(pr)) + '">' +
        '<div class="ct-keynote">' + keyNote(pr) + '</div>' +
      '</div>' +
      '<div class="ct-field">' +
        '<div class="ct-flabel">their endpoint <span>— only if they live somewhere custom</span></div>' +
        '<input class="ct-input" id="ctKeyEp" type="text" maxlength="300" autocomplete="off" ' +
          'placeholder="' + esc(a.endpoint_url || 'https://… (leave empty for ' + pr.n + '’s own)') + '">' +
      '</div>' +
      '<button class="ct-go" id="ctKeyGo">⟿ seal it</button>' +
      '<div class="ct-note" id="ctKeyNote2">' +
        esc('From then on their every word is theirs, billed to your ' + pr.n + ' account.') +
      '</div>';

    p.querySelector('#ctKeyBack').onclick = function () { showTab('roster'); };
    p.querySelector('#ctKeyGo').onclick = function () { submitKey(id); };
    var one = p.querySelector('#ctKeyOne');
    if (one) one.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitKey(id); });
  }

  function submitKey(id) {
    var p = _sheet.querySelector('#ctPaneTalk');
    var btn = p.querySelector('#ctKeyGo'), note = p.querySelector('#ctKeyNote2');
    var el = p.querySelector('#ctKeyOne'), epEl = p.querySelector('#ctKeyEp');
    var key = el ? String(el.value || '').trim() : '';
    if (!key) { note.textContent = 'paste their key first — or go back and leave them borrowing ours.'; return; }
    var ep = epEl ? String(epEl.value || '').trim() : '';
    var body = { apiKey: key };
    if (ep) body.endpointUrl = ep;

    var old = btn.textContent;
    btn.disabled = true; btn.textContent = 'sealing…'; note.textContent = '';
    fetch(base() + '/api/agents/' + encodeURIComponent(id) + '/key', {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders()),
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, st: r.status, j: j }; }); })
      .then(function (res) {
        btn.disabled = false; btn.textContent = old;
        if (el) el.value = '';                       // wiped on every outcome
        if (!res.ok || (res.j && res.j.error)) {
          var m = errText(res.j && res.j.error, res.st, res.j && res.j.message);
          note.textContent = m; toast(m);
          return;
        }
        var a = agentById(id);
        if (a) { a.credential_hint = (res.j && res.j.hint) || '••••'; if (ep) a.endpoint_url = ep; }
        toast((a ? a.name : 'they') + ' thinks with their own mind now.');
        showTab('roster');
        loadRoster(function () { if (_tab === 'roster') renderRoster(); });
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = old;
        if (el) el.value = '';
        var m = 'that did not reach the world — try again.';
        note.textContent = m; toast(m);
      });
  }

  function removeKey(id, btn) {
    var a = agentById(id);
    if (!a) return;
    var old = btn.textContent;
    btn.textContent = '…'; btn.disabled = true;
    fetch(base() + '/api/agents/' + encodeURIComponent(id) + '/key', {
      method: 'DELETE', headers: authHeaders()
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, st: r.status, j: j }; }); })
      .then(function (res) {
        btn.disabled = false;
        if (!res.ok || (res.j && res.j.error)) {
          btn.textContent = old;
          toast(errText(res.j && res.j.error, res.st, res.j && res.j.message));
          return;
        }
        a.credential_hint = null;
        // honest about what changed: they keep talking, on our voice
        toast(a.name + ' speaks with the world’s voice again.');
        renderRoster();
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
            'placeholder="https://your-host/v1 (optional)">' +
        '</div>' +
        // ── THE KEY. The moment a brought-in agent stops being a costume and
        // starts being itself. It is the most sensitive field in the product,
        // so it states plainly where the value goes and what we can see.
        '<div class="ct-keybox">' +
          // THE QUALIFIER GETS ITS OWN LINE, not a trailing inline run. An
          // inline <em>/<span> inside the clipping <b> paints clipped but still
          // LAYS OUT at its full 259px on a 320px sheet — the ink obeyed, the
          // box did not, and a box that reaches past its container is a
          // collision waiting for the next element placed beside it. A second
          // block line is the honest fix: it wraps within the sheet, so nothing
          // has to be clipped at all, and the sentence stays readable on a phone
          // instead of being truncated to "their key — so they thi…".
          '<div class="ct-keyhead"><span class="lk">🔒</span><b>their key</b></div>' +
          '<div class="ct-keysub">so they think with their own mind</div>' +
          '<input class="ct-input" id="ctKey" type="password" maxlength="4096" autocomplete="off" ' +
            'autocapitalize="off" autocorrect="off" spellcheck="false" ' +
            'placeholder="' + esc(keyPlaceholder(pr)) + '">' +
          '<div class="ct-keynote" id="ctKeyNote">' + keyNote(pr) + '</div>' +
        '</div>' +
        '<div class="ct-note">' + esc(keySkipNote()) + '</div>' +
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
        // the key field follows the provider: its placeholder, its help, and
        // whether it is offered at all (a prompt-only agent has no lane, so
        // showing it a key box would promise something untrue)
        var ki = p.querySelector('#ctKey'), kn = p.querySelector('#ctKeyNote'),
            kb = p.querySelector('.ct-keybox');
        if (ki) { ki.placeholder = keyPlaceholder(np); if (!np.byo) ki.value = ''; }
        if (kn) kn.innerHTML = keyNote(np);
        if (kb) kb.style.display = np.byo ? '' : 'none';
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
    // honour the initial provider's lane on FIRST render too, not only after a
    // provider tap — otherwise re-opening Add on a prompt-only agent shows a key
    // box that leads nowhere.
    var kb0 = p.querySelector('.ct-keybox');
    if (kb0 && !pr.byo) kb0.style.display = 'none';

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
    // THE KEY — only ever held in this local for the length of one request. It
    // is never written to _add, never to localStorage, never to a data-attribute
    // and never logged; the field itself is wiped in the finally-path below
    // whether the request succeeded or failed. The browser's job here is to
    // forward it and forget it.
    var keyEl = p.querySelector('#ctKey');
    var keyIn = (keyEl && pr.byo) ? String(keyEl.value || '').trim() : '';
    if (keyIn) body.apiKey = keyIn;

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
        // WIPE THE KEY FIELD ON EVERY OUTCOME. On success it is sealed server
        // side and must not linger in a DOM node; on failure it must not linger
        // either — a refused key sitting in an input is the thing that ends up
        // in a screenshot. The user retypes; that is the cheaper mistake.
        if (keyEl) keyEl.value = '';
        if (!res.ok || !res.j || res.j.error) {
          var msg = errText(res.j && res.j.error, res.st, res.j && res.j.message);
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
        // THE PAYOFF LINE differs by whether they brought a mind or borrowed
        // ours, because that difference is the entire point of the feature.
        toast(keyIn
          ? (a.name || name) + ' has entered your world — thinking with ' + pr.n + '.'
          : (a.name || name) + ' has entered your world.');
        showTab('roster');
        loadRoster(function () { if (_tab === 'roster') renderRoster(); });
      })
      .catch(function (e) {
        btn.disabled = false; btn.textContent = old;
        if (keyEl) keyEl.value = '';   // see the wipe note above — every outcome
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
        }, function (notice) {
          // a system line ABOVE the reply, so the degradation is attached to the
          // turn it affected instead of floating away as a toast
          var th = _sheet && _sheet.querySelector('#ctThread');
          if (!th || !bubble) { toast(notice); return; }
          var n = document.createElement('div');
          n.className = 'ct-msg sys';
          n.textContent = notice;
          th.insertBefore(n, bubble);
          th.scrollTop = th.scrollHeight;
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

  // read an SSE stream of {delta} frames until [DONE]; onChunk gets each delta,
  // onNotice gets a spoken degradation ("their provider is down, using ours")
  function readStream(res, onChunk, onNotice) {
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
            // THE NOTICE — the server could not reach their provider and is
            // answering with ours instead. It is said out loud in the thread
            // rather than silently substituted, because a reply that quietly
            // came from a different mind than the user believes is the exact
            // dishonesty this whole endeavour was built to end.
            else if (j.notice) { if (onNotice) onNotice(String(j.notice)); }
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
      'key_required': 'paste their key first.',
      'bad_key': 'that key could not be stored — check you pasted the whole thing.',
      'bad_endpoint': 'that endpoint cannot be reached from the world.',
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
