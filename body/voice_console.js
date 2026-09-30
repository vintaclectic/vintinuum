/* voice_console.js — THE ONE VOICE (Vinta directive 2026-09-30).
   ────────────────────────────────────────────────────────────────────────────
   WHAT THIS IS

   ONE unified, self-injecting à-la-carte voice console for every Vintinuum
   surface. A single mic FAB in the bottom-left corner (below the "listening /
   stay awake" status pill) opens ONE place where you can:

     • pick WHICH agent answers — Brain (vintinuum), atlas, aria, or any born
       council child — from a live chip row (GET /api/personas);
     • talk to them by VOICE (Web Speech API → live interim → send) OR by TEXT;
     • see the running exchange as chat bubbles that scroll INTERNALLY;
     • HEAR the reply — the endpoint returns a TTS url we autoplay.

   The send path is identical for voice and text:
       POST {apiBase}/api/voice/reply  { transcript, persona, userId }
       → { ok, reply, ttsUrl }
   which races cloud vs. local so an answer ALWAYS comes back fast, and now
   honours `persona` (server fix, same directive) so each agent speaks in its
   OWN voice.

   WHAT IT KILLS

   The old "circle V" (hey_vinta.js → #hey-vinta-btn / #hey-vinta-bubble) — a
   fire-and-forget wake orb that never answered on most pages. We set its load
   flag early so it can't render, and defensively reap any orb that slipped in.

   NO-COLLISION LAW

   The FAB does NOT hardcode a corner coordinate — it REGISTERS with VintDock
   (corner 'bl', priority 15) so the dock stacks it cleanly BELOW the status pill
   (priority 20) and clear of the mobile nav, forever. The panel opens ABOVE the
   whole bottom stack (using the dock's published --vint-dock-height-bottom) on
   desktop, and becomes a dimmed bottom-sheet modal on mobile. Nothing overlaps
   anything it wasn't designed to.

   Embedded on every surface that loads body/api_base.js via
       <script defer src="body/voice_console.js?v=v20260930-voice"></script>
   ──────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.__voiceConsoleLoaded) return;
  window.__voiceConsoleLoaded = true;

  // ── KILL THE CIRCLE V ─────────────────────────────────────────────────────
  // Set hey_vinta's load-guard BEFORE it can run, so it self-aborts. Then reap
  // any orb/bubble that mounted from a cached copy. Bounded sweeps + a short
  // MutationObserver — never a busy loop.
  try { window.__heyVintaLoaded = true; } catch (_) {}
  (function killHeyVinta() {
    function reap() {
      ['hey-vinta-btn', 'hey-vinta-bubble'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) { try { el.remove(); } catch (_) { el.style.display = 'none'; } }
      });
    }
    reap();
    var tries = 0;
    var iv = setInterval(function () { reap(); if (++tries >= 6) clearInterval(iv); }, 500);
    try {
      if (window.MutationObserver && document.documentElement) {
        var mo = new MutationObserver(function () { reap(); });
        mo.observe(document.documentElement, { childList: true, subtree: true });
        setTimeout(function () { try { mo.disconnect(); } catch (_) {} }, 6000);
      }
    } catch (_) {}
  })();

  // ── API base (canonical resolver, identical to sibling modules) ────────────
  function apiBase() {
    return window.__VINTINUUM_API_BASE ||
           window.VINTINUUM_API ||
           window.__VINT_API ||
           'https://api.vintaclectic.com';
  }

  function resolveUserId() {
    try {
      var u = window.VINTINUUM_IDENTITY && window.VINTINUUM_IDENTITY.user;
      if (u && u.id != null && !Number.isNaN(Number(u.id))) return Number(u.id);
    } catch (_) {}
    try {
      var raw = localStorage.getItem('vint_user');
      if (raw) { var j = JSON.parse(raw); if (j && j.id != null && !Number.isNaN(Number(j.id))) return Number(j.id); }
    } catch (_) {}
    return null;
  }

  function authToken() {
    try {
      return localStorage.getItem('vint_token') ||
             localStorage.getItem('vint_access_token') ||
             localStorage.getItem('soul_auth_token') || null;
    } catch (_) { return null; }
  }

  var LS_PERSONA = 'vint:voice:persona';
  function savedPersona() { try { return localStorage.getItem(LS_PERSONA) || 'vintinuum'; } catch (_) { return 'vintinuum'; } }
  function savePersona(id) { try { localStorage.setItem(LS_PERSONA, id); } catch (_) {} }

  // ── Styles (scoped, glassy dark, cyan/teal accents) ────────────────────────
  var ACCENT = '#00ffc8';
  var css = [
    ':root{--vc-accent:' + ACCENT + ';--vc-accent-soft:#5eead4;}',
    // ── FAB ──
    '.vc-fab{',
    '  position:fixed;left:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));',
    '  width:56px;height:56px;border-radius:50%;z-index:480;',
    '  display:flex;align-items:center;justify-content:center;',
    '  background:radial-gradient(circle at 34% 30%,rgba(0,255,200,.28),rgba(8,14,18,.96) 68%);',
    '  border:1px solid rgba(0,255,200,.42);color:#dffdf5;cursor:pointer;',
    '  box-shadow:0 8px 26px rgba(0,0,0,.55),0 0 0 0 rgba(0,255,200,.4),inset 0 1px 0 rgba(255,255,255,.08);',
    '  -webkit-user-select:none;user-select:none;touch-action:manipulation;',
    '  transition:transform 140ms ease,box-shadow 220ms ease,border-color 220ms ease;',
    '}',
    '.vc-fab:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(0,0,0,.6),0 0 22px rgba(0,255,200,.35);}',
    '.vc-fab:active{transform:scale(.94);}',
    '.vc-fab svg{width:24px;height:24px;pointer-events:none;filter:drop-shadow(0 0 6px rgba(0,255,200,.5));}',
    '.vc-fab.vc-live{border-color:rgba(94,234,212,.9);animation:vcFabPulse 1.05s ease-in-out infinite;}',
    '.vc-fab.vc-open{border-color:rgba(0,255,200,.85);box-shadow:0 12px 30px rgba(0,0,0,.6),0 0 26px rgba(0,255,200,.5);}',
    '@keyframes vcFabPulse{0%,100%{box-shadow:0 8px 26px rgba(0,0,0,.55),0 0 0 0 rgba(94,234,212,.5);}50%{box-shadow:0 8px 26px rgba(0,0,0,.55),0 0 0 9px rgba(94,234,212,0);}}',
    // ── Backdrop (dimmed on mobile; transparent catch on desktop) ──
    '.vc-backdrop{position:fixed;inset:0;z-index:479;background:transparent;opacity:0;pointer-events:none;transition:opacity 200ms ease;}',
    '.vc-backdrop.vc-show{opacity:1;pointer-events:auto;}',
    // ── Panel ──
    '.vc-panel{',
    '  position:fixed;left:14px;z-index:491;',
    '  bottom:calc(var(--vint-dock-height-bottom,110px) + env(safe-area-inset-bottom,0px) + 14px);',
    '  width:min(384px,calc(100vw - 28px));',
    '  max-height:min(560px,calc(100vh - var(--vint-dock-height-bottom,110px) - 96px));',
    '  display:flex;flex-direction:column;overflow:hidden;',
    '  background:linear-gradient(180deg,rgba(12,16,20,.96),rgba(8,11,14,.97));',
    '  border:1px solid rgba(0,255,200,.20);border-radius:18px;',
    '  box-shadow:0 24px 60px rgba(0,0,0,.6),0 0 0 1px rgba(0,0,0,.4);',
    '  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
    '  color:#e8fdf6;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
    '  opacity:0;transform:translateY(12px) scale(.98);pointer-events:none;',
    '  transition:opacity 200ms ease,transform 200ms cubic-bezier(.2,.9,.3,1);',
    '}',
    '.vc-panel.vc-show{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}',
    // ── Header ──
    '.vc-head{display:flex;align-items:center;gap:8px;padding:12px 14px 8px;border-bottom:1px solid rgba(0,255,200,.10);}',
    '.vc-title{font-family:Cormorant,Georgia,"Times New Roman",serif;font-size:19px;font-weight:600;letter-spacing:.02em;color:#eafff9;flex:1;}',
    '.vc-title small{display:block;font-family:ui-monospace,Menlo,monospace;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:rgba(94,234,212,.62);margin-top:1px;font-weight:500;}',
    '.vc-close{width:30px;height:30px;flex:none;border-radius:9px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.03);color:#bfe9df;cursor:pointer;font-size:17px;line-height:1;display:flex;align-items:center;justify-content:center;transition:background 160ms ease;}',
    '.vc-close:hover{background:rgba(255,255,255,.09);}',
    // ── Agent picker ──
    '.vc-agents{display:flex;gap:7px;overflow-x:auto;padding:10px 14px;scrollbar-width:thin;-webkit-overflow-scrolling:touch;}',
    '.vc-agents::-webkit-scrollbar{height:5px;}',
    '.vc-agents::-webkit-scrollbar-thumb{background:rgba(0,255,200,.22);border-radius:9px;}',
    '.vc-chip{flex:none;display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;cursor:pointer;',
    '  border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);color:#cfe9e2;',
    '  font-size:12.5px;font-weight:600;white-space:nowrap;transition:border-color 160ms ease,background 160ms ease,transform 120ms ease;}',
    '.vc-chip:hover{transform:translateY(-1px);}',
    '.vc-chip .vc-sigil{font-size:14px;line-height:1;}',
    '.vc-chip.vc-active{background:rgba(0,255,200,.10);}',
    // ── Transcript ──
    '.vc-log{flex:1 1 auto;min-height:96px;overflow-y:auto;padding:6px 14px 10px;display:flex;flex-direction:column;gap:9px;scrollbar-width:thin;}',
    '.vc-log::-webkit-scrollbar{width:6px;}',
    '.vc-log::-webkit-scrollbar-thumb{background:rgba(0,255,200,.20);border-radius:9px;}',
    '.vc-empty{margin:auto;text-align:center;color:rgba(180,214,206,.5);font-size:12.5px;line-height:1.6;padding:14px;}',
    '.vc-empty b{color:rgba(94,234,212,.8);font-weight:600;}',
    '.vc-row{display:flex;flex-direction:column;max-width:88%;}',
    '.vc-row.vc-me{align-self:flex-end;align-items:flex-end;}',
    '.vc-row.vc-them{align-self:flex-start;align-items:flex-start;}',
    '.vc-who{font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;opacity:.6;margin:0 4px 3px;}',
    '.vc-bubble{padding:9px 12px;border-radius:14px;font-size:13.5px;line-height:1.45;word-break:break-word;}',
    '.vc-me .vc-bubble{background:rgba(0,255,200,.13);border:1px solid rgba(0,255,200,.22);color:#eafff9;border-bottom-right-radius:5px;}',
    '.vc-them .vc-bubble{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);color:#e9f4f1;border-bottom-left-radius:5px;}',
    '.vc-bubble.vc-err{background:rgba(255,80,110,.12);border-color:rgba(255,80,110,.4);color:#ffd9e1;}',
    '.vc-think{display:inline-flex;gap:4px;align-items:center;}',
    '.vc-think i{width:6px;height:6px;border-radius:50%;background:var(--vc-accent-soft);display:inline-block;animation:vcBlink 1.1s infinite;}',
    '.vc-think i:nth-child(2){animation-delay:.18s;}.vc-think i:nth-child(3){animation-delay:.36s;}',
    '@keyframes vcBlink{0%,100%{opacity:.28;transform:translateY(0);}50%{opacity:1;transform:translateY(-2px);}}',
    // ── Input row ──
    '.vc-input{display:flex;align-items:flex-end;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid rgba(0,255,200,.10);background:rgba(6,9,11,.5);}',
    '.vc-ta{flex:1;resize:none;max-height:96px;min-height:42px;padding:11px 12px;border-radius:12px;',
    '  border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#eafff9;',
    '  font-size:14px;line-height:1.4;font-family:inherit;outline:none;transition:border-color 160ms ease;}',
    '.vc-ta:focus{border-color:rgba(0,255,200,.5);}',
    '.vc-ta::placeholder{color:rgba(180,214,206,.42);}',
    '.vc-btn{flex:none;width:44px;height:44px;border-radius:12px;border:1px solid rgba(0,255,200,.30);cursor:pointer;',
    '  display:flex;align-items:center;justify-content:center;color:#0a0f0d;transition:transform 120ms ease,filter 160ms ease,opacity 160ms ease;}',
    '.vc-btn svg{width:20px;height:20px;}',
    '.vc-mic{background:rgba(255,255,255,.05);color:#5eead4;border-color:rgba(94,234,212,.35);}',
    '.vc-mic.vc-live{background:rgba(94,234,212,.16);color:#eafff9;animation:vcFabPulse 1.05s ease-in-out infinite;}',
    '.vc-mic:disabled{opacity:.35;cursor:not-allowed;}',
    '.vc-send{background:linear-gradient(180deg,#00ffc8,#12c9a2);}',
    '.vc-send:hover{transform:translateY(-1px);filter:brightness(1.06);}',
    '.vc-send:disabled{opacity:.4;cursor:not-allowed;transform:none;}',
    '.vc-btn:active{transform:scale(.92);}',
    '.vc-hint{padding:0 14px 9px;font-size:11px;color:rgba(180,214,206,.5);}',
    // ── Mobile: bottom sheet ──
    '@media (max-width:640px){',
    '  .vc-panel{left:0;right:0;bottom:0;width:100%;max-width:100%;max-height:84vh;',
    '     border-radius:20px 20px 0 0;border-left:none;border-right:none;border-bottom:none;',
    '     transform:translateY(100%);}',
    '  .vc-panel.vc-show{transform:translateY(0);}',
    '  .vc-backdrop.vc-show{background:rgba(0,0,0,.5);}',
    '  .vc-log{min-height:120px;}',
    '}',
    '@media (prefers-reduced-motion:reduce){',
    '  .vc-fab.vc-live,.vc-mic.vc-live{animation:none!important;}',
    '  .vc-think i{animation:none!important;opacity:.7;}',
    '}'
  ].join('\n');

  var styleEl = document.createElement('style');
  styleEl.id = 'vc-styles';
  styleEl.textContent = css;
  (document.head || document.documentElement).appendChild(styleEl);

  // ── SVG glyphs ─────────────────────────────────────────────────────────────
  var MIC_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>';
  var SEND_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  // ── Build DOM ──────────────────────────────────────────────────────────────
  var fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'vc-fab';
  fab.id = 'vint-vc-fab';
  fab.title = 'Talk to Vintinuum';
  fab.setAttribute('aria-label', 'Open voice console — talk to Vintinuum or a chosen agent');
  fab.innerHTML = MIC_SVG;

  var backdrop = document.createElement('div');
  backdrop.className = 'vc-backdrop';

  var panel = document.createElement('div');
  panel.className = 'vc-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Voice console');
  panel.innerHTML =
    '<div class="vc-head">' +
      '<div class="vc-title" id="vc-title">Brain<small id="vc-title-sub">talk out loud, or type</small></div>' +
      '<button type="button" class="vc-close" id="vc-close" aria-label="Close">✕</button>' +
    '</div>' +
    '<div class="vc-agents" id="vc-agents"><div class="vc-hint" style="padding:2px 2px;">loading agents…</div></div>' +
    '<div class="vc-log" id="vc-log"><div class="vc-empty">Pick an agent above, then <b>speak</b> or <b>type</b>.<br>You’ll hear the answer out loud.</div></div>' +
    '<div class="vc-input">' +
      '<textarea class="vc-ta" id="vc-ta" rows="1" placeholder="Say something…" aria-label="Message"></textarea>' +
      '<button type="button" class="vc-btn vc-mic" id="vc-mic" title="Hold or tap to speak" aria-label="Speak">' + MIC_SVG + '</button>' +
      '<button type="button" class="vc-btn vc-send" id="vc-send" title="Send" aria-label="Send" disabled>' + SEND_SVG + '</button>' +
    '</div>';

  function mount() {
    if (!document.body) return false;
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    document.body.appendChild(fab);
    // NO-COLLISION LAW: register with the corner dock so the FAB stacks BELOW the
    // status pill (priority 20) and clear of the mobile nav — never hardcoded.
    try {
      if (window.VintDock && window.VintDock.register) {
        window.VintDock.register(fab, { corner: 'bl', priority: 15, id: 'vint-vc-fab' });
      } else {
        // Dock not loaded yet — queue for it, and it drains on load.
        window.VintDock = window.VintDock || { q: [] };
        (window.VintDock.q = window.VintDock.q || []).push([null, fab, { corner: 'bl', priority: 15, id: 'vint-vc-fab' }]);
      }
    } catch (_) {}
    wire();
    loadAgents();
    return true;
  }

  // ── State ──────────────────────────────────────────────────────────────────
  var els = {};
  var activePersona = savedPersona();
  var activeColor = ACCENT;
  var activeName = 'Brain';
  var personaList = [];
  var open = false;
  var sending = false;

  function $(id) { return panel.querySelector(id) || document.getElementById(id.replace('#', '')); }

  // ── Panel open / close ─────────────────────────────────────────────────────
  function openPanel() {
    if (open) return;
    open = true;
    panel.classList.add('vc-show');
    backdrop.classList.add('vc-show');
    fab.classList.add('vc-open');
    setTimeout(function () { try { els.ta && els.ta.focus(); } catch (_) {} }, 60);
    scrollLog();
  }
  function closePanel() {
    if (!open) return;
    open = false;
    panel.classList.remove('vc-show');
    backdrop.classList.remove('vc-show');
    fab.classList.remove('vc-open');
    stopMic(true);
  }
  function togglePanel() { open ? closePanel() : openPanel(); }

  // ── Agent picker ───────────────────────────────────────────────────────────
  function loadAgents() {
    fetch(apiBase() + '/api/personas', { credentials: 'omit', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var list = (j && Array.isArray(j.personas)) ? j.personas : [];
        if (!list.length) throw new Error('no personas');
        personaList = list;
        renderAgents();
      })
      .catch(function () {
        // Never leave it empty — at minimum the Brain answers.
        personaList = [{ id: 'vintinuum', name: 'VINTINUUM', color: ACCENT, sigil: '◉' }];
        renderAgents();
      });
  }

  function renderAgents() {
    var box = els.agents;
    if (!box) return;
    box.innerHTML = '';
    var found = false;
    personaList.forEach(function (p) {
      var id = String(p.id || '').toLowerCase();
      if (!id) return;
      var label = (id === 'vintinuum') ? 'Brain' : (p.name || id);
      var color = p.color || '#a78bfa';
      var sigil = p.sigil || '◆';
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'vc-chip' + (id === activePersona ? ' vc-active' : '');
      chip.style.borderColor = hexA(color, id === activePersona ? .85 : .28);
      chip.style.color = color;
      chip.title = p.desc || label;
      chip.innerHTML = '<span class="vc-sigil" style="color:' + color + '">' + sigil + '</span><span>' + escapeHtml(label) + '</span>';
      chip.addEventListener('click', function () { selectAgent(id, label, color); });
      box.appendChild(chip);
      if (id === activePersona) { found = true; activeColor = color; activeName = label; }
    });
    if (!found) { activePersona = 'vintinuum'; activeName = 'Brain'; activeColor = ACCENT; }
    updateTitle();
    // keep the active chip in view
    var act = box.querySelector('.vc-chip.vc-active');
    if (act && act.scrollIntoView) { try { act.scrollIntoView({ inline: 'nearest', block: 'nearest' }); } catch (_) {} }
  }

  function selectAgent(id, label, color) {
    activePersona = id; activeName = label; activeColor = color;
    savePersona(id);
    renderAgents();
    try { els.ta && els.ta.focus(); } catch (_) {}
  }

  function updateTitle() {
    if (els.title) els.title.childNodes[0].nodeValue = activeName;
    if (els.titleSub) els.titleSub.textContent = (activePersona === 'vintinuum') ? 'talk out loud, or type' : 'speaking as ' + activeName.toLowerCase();
  }

  // ── Transcript ─────────────────────────────────────────────────────────────
  function clearEmpty() { var e = els.log.querySelector('.vc-empty'); if (e) e.remove(); }
  function scrollLog() { try { els.log.scrollTop = els.log.scrollHeight; } catch (_) {} }

  function addBubble(who, text, opts) {
    opts = opts || {};
    clearEmpty();
    var row = document.createElement('div');
    row.className = 'vc-row ' + (who === 'me' ? 'vc-me' : 'vc-them');
    var whoLabel = document.createElement('div');
    whoLabel.className = 'vc-who';
    whoLabel.textContent = who === 'me' ? 'you' : activeName;
    if (who !== 'me') whoLabel.style.color = hexA(activeColor, .8);
    var b = document.createElement('div');
    b.className = 'vc-bubble' + (opts.err ? ' vc-err' : '');
    if (who !== 'me' && !opts.err) b.style.borderColor = hexA(activeColor, .28);
    if (opts.thinking) {
      b.innerHTML = '<span class="vc-think"><i></i><i></i><i></i></span>';
    } else {
      b.textContent = text;
    }
    row.appendChild(whoLabel);
    row.appendChild(b);
    els.log.appendChild(row);
    scrollLog();
    return { row: row, bubble: b };
  }

  // ── Send flow (text OR voice — one path) ───────────────────────────────────
  function send(text) {
    text = String(text || '').trim();
    if (!text || sending) return;
    sending = true;
    els.send.disabled = true;
    addBubble('me', text);
    els.ta.value = '';
    autoGrow();
    var thinking = addBubble('them', '', { thinking: true });
    emit('vint:voice:thinking');

    var body = { transcript: text, persona: activePersona };
    var uid = resolveUserId();
    if (uid != null) body.userId = uid;
    var headers = { 'Content-Type': 'application/json' };
    var tok = authToken();
    if (tok) headers['Authorization'] = 'Bearer ' + tok;

    fetch(apiBase() + '/api/voice/reply', {
      method: 'POST',
      credentials: 'include',
      headers: headers,
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        var j = res.j || {};
        if (!res.ok || !j || !j.reply) {
          replaceThinking(thinking, (j && j.error) ? niceErr(j.error) : 'I could not answer that just now. Try once more.', true);
          emit('vint:voice:idle');
          return;
        }
        replaceThinking(thinking, j.reply, false);
        speak(j.ttsUrl, j.reply);
      })
      .catch(function () {
        replaceThinking(thinking, 'I could not reach the brain. Check your connection and try again.', true);
        emit('vint:voice:idle');
      })
      .finally(function () { sending = false; syncSend(); });
  }

  function replaceThinking(t, text, isErr) {
    if (!t || !t.bubble) return;
    t.bubble.classList.remove('vc-err');
    t.bubble.innerHTML = '';
    if (isErr) t.bubble.classList.add('vc-err');
    else if (activeColor) t.bubble.style.borderColor = hexA(activeColor, .28);
    t.bubble.textContent = text;
    scrollLog();
  }

  function niceErr(code) {
    if (code === 'rate-limited') return 'Easy — too many at once. Give me a breath and try again.';
    if (code === 'transcript-required') return 'Say a little more and I’ll answer.';
    return 'Something hiccuped on my end. Try again.';
  }

  // ── TTS out (autoplay, pill "speaking" reflection) ─────────────────────────
  var audio = null;
  function speak(ttsUrl, reply) {
    var dur = Math.min(11000, 1200 + (reply ? reply.length : 40) * 70);
    emit('vint:voice:speaking', { stickyMs: dur });
    // Also fire she_said so any legacy pill listeners settle correctly.
    emit('vint:she_said', { reply: reply });
    if (!ttsUrl) { setTimeout(function () { emit('vint:voice:idle'); }, dur); return; }
    try {
      if (audio) { try { audio.pause(); } catch (_) {} }
      var src = /^https?:\/\//i.test(ttsUrl) ? ttsUrl : (apiBase() + ttsUrl);
      audio = new Audio(src);
      audio.onended = function () { emit('vint:voice:idle'); };
      audio.onerror = function () { emit('vint:voice:idle'); };
      var pr = audio.play();
      if (pr && pr.catch) pr.catch(function () { /* autoplay blocked — bubble already shows */ });
    } catch (_) { setTimeout(function () { emit('vint:voice:idle'); }, dur); }
  }

  // ── Speech recognition (Web Speech API) ────────────────────────────────────
  var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  var speechOK = !!SpeechRec;
  var recog = null, listening = false, micBase = '';

  function startMic() {
    if (!speechOK) {
      addBubble('them', 'Voice input isn’t supported in this browser — but you can still type to me.', {});
      return;
    }
    if (listening) { stopMic(); return; }
    try {
      recog = new SpeechRec();
      recog.lang = navigator.language || 'en-US';
      recog.continuous = false;
      recog.interimResults = true;
      recog.maxAlternatives = 1;
    } catch (_) { return; }
    micBase = (els.ta.value || '').trim();
    listening = true;
    els.mic.classList.add('vc-live');
    fab.classList.add('vc-live');
    emit('vint:voice:listening');

    recog.onresult = function (ev) {
      var interim = '', final = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var res = ev.results[i];
        if (res.isFinal) final += res[0].transcript; else interim += res[0].transcript;
      }
      var live = (micBase ? micBase + ' ' : '') + (final || interim);
      els.ta.value = live.trim();
      autoGrow(); syncSend();
      if (final) micBase = els.ta.value.trim();
    };
    recog.onerror = function () { stopMic(); };
    recog.onend = function () {
      var wasListening = listening;
      stopMic(true);
      // Auto-send what we heard, so voice is truly one-tap end to end.
      if (wasListening && els.ta.value.trim() && !sending) send(els.ta.value);
    };
    try { recog.start(); } catch (_) { stopMic(true); }
  }

  function stopMic(silent) {
    listening = false;
    els.mic && els.mic.classList.remove('vc-live');
    fab.classList.remove('vc-live');
    if (recog) { try { recog.stop(); } catch (_) {} }
    if (!silent) emit('vint:voice:idle');
  }

  // ── Input helpers ──────────────────────────────────────────────────────────
  function autoGrow() {
    var ta = els.ta; if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(96, ta.scrollHeight) + 'px';
  }
  function syncSend() { if (els.send) els.send.disabled = sending || !els.ta.value.trim(); }

  // ── Wire events ────────────────────────────────────────────────────────────
  function wire() {
    els.agents = $('#vc-agents');
    els.log = $('#vc-log');
    els.ta = $('#vc-ta');
    els.mic = $('#vc-mic');
    els.send = $('#vc-send');
    els.close = $('#vc-close');
    els.title = $('#vc-title');
    els.titleSub = $('#vc-title-sub');

    if (!speechOK && els.mic) { els.mic.disabled = true; els.mic.title = 'Voice input not supported here — type instead'; }

    // FAB: short tap toggles the panel; long-press starts push-to-talk.
    var pressTimer = null, longFired = false;
    fab.addEventListener('pointerdown', function () {
      longFired = false;
      pressTimer = setTimeout(function () {
        longFired = true;
        if (!open) openPanel();
        startMic();
      }, 380);
    });
    var cancelPress = function () { clearTimeout(pressTimer); };
    fab.addEventListener('pointerup', cancelPress);
    fab.addEventListener('pointerleave', cancelPress);
    fab.addEventListener('pointercancel', cancelPress);
    fab.addEventListener('click', function (e) {
      if (longFired) { e.preventDefault(); return; }
      togglePanel();
    });

    els.close.addEventListener('click', closePanel);
    backdrop.addEventListener('click', closePanel);
    els.mic.addEventListener('click', function () { startMic(); });
    els.send.addEventListener('click', function () { send(els.ta.value); });

    els.ta.addEventListener('input', function () { autoGrow(); syncSend(); });
    els.ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(els.ta.value); }
    });

    // Esc closes; outside-click on desktop closes (backdrop handles it visually,
    // but on desktop the backdrop is transparent/click-through-free, so it also
    // catches the click).
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) closePanel(); });
  }

  // ── Utils ──────────────────────────────────────────────────────────────────
  function emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, detail ? { detail: detail } : undefined)); } catch (_) {}
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function hexA(hex, a) {
    // #rrggbb → rgba(). Falls back gracefully for named/short colors.
    try {
      var m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
      if (!m) return hex;
      var n = parseInt(m[1], 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    } catch (_) { return hex; }
  }

  // Public surface for diagnostics / programmatic open.
  window.VoiceConsole = {
    open: openPanel,
    close: closePanel,
    toggle: togglePanel,
    persona: function () { return activePersona; },
    speechSupported: speechOK
  };

  // ── Boot: mount once the body exists (all state + fns are now declared) ─────
  if (!mount()) document.addEventListener('DOMContentLoaded', mount, { once: true });

  try { console.log('[voice_console] mounted — speech=' + speechOK); } catch (_) {}
})();
