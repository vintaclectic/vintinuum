// OWNER ADMIN - hidden oversight console for world.html.
// Intent: Vinta as owner, checking what happened in the world, with a quiet
// operations-console feel. Palette: ember, paper, signal-blue and warning-red
// from the clearing itself. Depth: one measured Dirverse sheet, no extra fixed
// overlay. Surfaces: dark glass layers. Typography: existing world serif.
// Spacing: compact 8px grid for fast scanning.
(function () {
  'use strict';
  if (window.VintOwnerAdmin) return;

  var W = window;
  var MAX_LOG = 80;
  var LOCK_KEY = 'vint:owner-admin:lock';
  var SESSION_KEY = 'vint:owner-admin:session';
  var PANEL_ID = 'oaSheet';
  var BTN_ID = 'oaBtn';
  var logs = [];
  var lastState = null;
  var lastApi = null;
  var selected = 'feed';
  var booted = false;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function now() {
    try { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
    catch (_) { return new Date().toTimeString().slice(0, 8); }
  }

  function base() { return (W.__VINTINUUM_API_BASE || '').replace(/\/$/, ''); }
  function token() {
    try { return localStorage.getItem('vint_access_token') || localStorage.getItem('vint_token') || ''; }
    catch (_) { return ''; }
  }
  function worldId() {
    try { return (W.VintinuumWorld && W.VintinuumWorld.currentWorldId && W.VintinuumWorld.currentWorldId()) || 'universe'; }
    catch (_) { return 'universe'; }
  }
  function session() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null') || null; }
    catch (_) { return null; }
  }
  function setSession(s) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (_) {}
  }
  function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
  }

  function lockState() {
    try {
      var x = JSON.parse(localStorage.getItem(LOCK_KEY) || 'null') || {};
      if (x.until && Date.now() > x.until) x = {};
      return x;
    } catch (_) { return {}; }
  }
  function recordBadAttempt() {
    var x = lockState();
    var n = (x.count || 0) + 1;
    var next = n >= 5 ? { count: n, until: Date.now() + 15 * 60 * 1000 } : { count: n };
    try { localStorage.setItem(LOCK_KEY, JSON.stringify(next)); } catch (_) {}
    return next;
  }
  function resetAttempts() {
    try { localStorage.removeItem(LOCK_KEY); } catch (_) {}
  }
  function lockedMessage() {
    var x = lockState();
    if (!x.until) return '';
    var left = Math.max(1, Math.ceil((x.until - Date.now()) / 60000));
    return 'Too many attempts. Try again in ' + left + 'm.';
  }

  function log(kind, text, data) {
    logs.unshift({ at: Date.now(), time: now(), kind: kind, text: text, data: data || null });
    if (logs.length > MAX_LOG) logs.length = MAX_LOG;
    render();
  }

  function installStyles() {
    if (document.getElementById('oa-styles')) return;
    var s = document.createElement('style');
    s.id = 'oa-styles';
    s.textContent = [
      '#oaSheet{font-family:"Cormorant Garamond",Georgia,serif;color:rgba(246,238,224,.92);}',
      '#oaSheet .oa-wrap{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;padding:16px;}',
      '#oaSheet .oa-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(244,199,154,.16);padding-bottom:12px;}',
      '#oaSheet .oa-kicker{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:rgba(244,199,154,.68);}',
      '#oaSheet h2{font-size:24px;font-weight:500;line-height:1.1;margin-top:3px;color:#fff0d8;}',
      '#oaSheet .oa-close,#oaSheet .oa-chip,#oaSheet button{font:inherit;}',
      '#oaSheet .oa-close{min-width:44px;min-height:44px;border-radius:22px;border:1px solid rgba(244,199,154,.22);background:rgba(255,255,255,.04);color:rgba(246,238,224,.82);cursor:pointer;}',
      '#oaSheet .oa-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}',
      '#oaSheet .oa-stat{min-width:0;padding:10px;border:1px solid rgba(244,199,154,.14);background:rgba(255,255,255,.035);border-radius:8px;}',
      '#oaSheet .oa-stat b{display:block;font-size:20px;font-weight:500;color:#9fdcff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '#oaSheet .oa-stat span{display:block;font-size:12px;color:rgba(246,238,224,.56);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '#oaSheet .oa-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;}',
      '#oaSheet .oa-tab{flex:0 0 auto;min-height:38px;border-radius:19px;border:1px solid rgba(159,220,255,.18);background:rgba(7,12,18,.58);color:rgba(220,238,255,.78);padding:0 12px;cursor:pointer;}',
      '#oaSheet .oa-tab.on{border-color:rgba(159,220,255,.48);background:rgba(54,126,171,.22);color:#dff4ff;}',
      '#oaSheet .oa-pane{border:1px solid rgba(244,199,154,.13);background:rgba(10,12,16,.38);border-radius:8px;min-height:210px;max-height:min(46dvh,390px);overflow:auto;}',
      '#oaSheet .oa-row{display:grid;grid-template-columns:72px 86px minmax(0,1fr);gap:8px;padding:9px 10px;border-bottom:1px solid rgba(244,199,154,.09);font-size:14px;align-items:start;}',
      '#oaSheet .oa-row:last-child{border-bottom:0;}',
      '#oaSheet .oa-time{color:rgba(246,238,224,.48);white-space:nowrap;}',
      '#oaSheet .oa-kind{color:#f4c79a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '#oaSheet .oa-text{min-width:0;overflow-wrap:anywhere;color:rgba(246,238,224,.84);}',
      '#oaSheet .oa-json{display:block;margin-top:4px;color:rgba(159,220,255,.72);font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;}',
      '#oaSheet .oa-form{display:grid;gap:10px;padding:16px;}',
      '#oaSheet label{display:grid;gap:5px;font-size:13px;color:rgba(246,238,224,.64);}',
      '#oaSheet input{width:100%;min-height:44px;border-radius:8px;border:1px solid rgba(244,199,154,.22);background:rgba(0,0,0,.25);color:#fff0d8;padding:0 12px;font:inherit;outline:none;}',
      '#oaSheet input:focus{border-color:rgba(159,220,255,.58);}',
      '#oaSheet .oa-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}',
      '#oaSheet .oa-primary{min-height:44px;border-radius:22px;border:1px solid rgba(159,220,255,.46);background:rgba(54,126,171,.24);color:#dff4ff;padding:0 16px;cursor:pointer;}',
      '#oaSheet .oa-ghost{min-height:44px;border:0;background:transparent;color:rgba(246,238,224,.58);padding:0 8px;cursor:pointer;}',
      '#oaSheet .oa-note{font-size:13px;line-height:1.35;color:rgba(246,238,224,.58);}',
      '#oaSheet .oa-bad{color:#ffb3a5;}',
      '@media(max-width:560px){#oaSheet .oa-grid{grid-template-columns:repeat(2,minmax(0,1fr));}#oaSheet .oa-row{grid-template-columns:62px minmax(0,1fr);}#oaSheet .oa-kind{display:none;}}'
    ].join('');
    document.head.appendChild(s);
  }

  function ensureSheet() {
    installStyles();
    var el = document.getElementById(PANEL_ID);
    if (el) return el;
    el = document.createElement('section');
    el.id = PANEL_ID;
    el.className = 'dv-sheet';
    el.setAttribute('aria-label', 'owner admin');
    document.body.appendChild(el);
    if (W.DirverseHUD && W.DirverseHUD.registerSheet) {
      W.DirverseHUD.registerSheet('owner-admin', isOpen, close);
    }
    return el;
  }

  function open() {
    var el = ensureSheet();
    var show = function () { render(); el.classList.add('open'); startRefresh(); };
    if (W.DirverseHUD && W.DirverseHUD.openSheet) W.DirverseHUD.openSheet('owner-admin', show);
    else show();
  }
  function close() {
    var el = document.getElementById(PANEL_ID);
    if (el) el.classList.remove('open');
    stopRefresh();
    try { if (W.DirverseHUD && W.DirverseHUD.syncSheets) W.DirverseHUD.syncSheets(); } catch (_) {}
  }

  // ── THE LAUNCHER — a flow child of the rail, and it WAITS for the rail ─────
  // This module can load before dirverse-hud.js has published W.DirverseHUD.
  // The first draft gave up permanently in that case, so on a slow load the
  // owner button simply never appeared and the panel was reachable only by the
  // hotkey — a hidden surface that was, at times, too hidden. Every sibling
  // module (arcade.js:909) retries instead, so this one does too: up to 25
  // tries at 90ms, then it stops rather than spinning forever.
  //
  // Guarded by session(): the launcher is only ever mounted AFTER the owner has
  // unlocked. A locked-out visitor sees no button and no hint one exists.
  var _waits = 0;
  function addLauncher() {
    if (!session()) return;
    var h = W.DirverseHUD;
    if (!h || !h.addLauncher) { if (_waits++ < 25) setTimeout(addLauncher, 90); return; }
    var btn = h.addLauncher(BTN_ID, 'owner', 'KEY', open);
    if (btn) {
      btn.setAttribute('aria-label', 'owner admin - oversee every action in this world');
      btn.setAttribute('title', 'owner admin');
    }
    try { if (h.registerSheet) h.registerSheet('owner-admin', isOpen, close); } catch (_) {}
  }
  function isOpen() {
    var el = document.getElementById(PANEL_ID);
    return !!(el && el.classList.contains('open'));
  }

  // ── (C) NO POLLING. THE EVENTS ARE THE OVERSIGHT. ─────────────────────────
  // The first draft polled `/api/owner/world/overview` every 30 seconds. That
  // endpoint does not exist in vintinuum-api — not one reference anywhere — so
  // every tick was a guaranteed 404 that the code then silently swallowed. A
  // request that can only ever fail is not a feature; it is a heartbeat of
  // noise against the brain and a lie in the UI.
  //
  // DECISION: polling is removed outright rather than pointed at a substitute
  // endpoint. The live event observers below ARE the oversight mechanism — they
  // see every world action the moment it happens, which is strictly better than
  // a 30-second snapshot, and they cost nothing. The panel re-renders on each
  // observed act, so it is live without asking the network anything.
  // REVERSIBLE VIA: revert this commit; the old fetch is in git history.
  //
  // If a real owner-overview endpoint is ever built, reintroduce it HERE with a
  // backoff that stops after repeated 404s — never an unbounded retry.
  function startRefresh() { /* event-driven; nothing to poll. */ }
  function stopRefresh() { /* symmetry with startRefresh; nothing to tear down. */ }

  function render() {
    var el = document.getElementById(PANEL_ID);
    if (!el) return;
    var s = session();
    el.innerHTML = s ? renderConsole(s) : renderGate();
    bind(el);
  }

  function renderGate() {
    var locked = lockedMessage();
    return '<div class="oa-wrap"><div class="oa-head"><div><div class="oa-kicker">hidden owner surface</div><h2>World Admin</h2></div><button class="oa-close" data-oa-close type="button">x</button></div>' +
      '<form class="oa-form" data-oa-login>' +
      '<label>Owner username<input name="user" autocomplete="username" required></label>' +
      '<label>Owner key<input name="key" type="password" autocomplete="current-password" required></label>' +
      '<div class="oa-actions"><button class="oa-primary" type="submit"' + (locked ? ' disabled' : '') + '>Unlock panel</button><span class="oa-note oa-bad" data-oa-error>' + esc(locked) + '</span></div>' +
      '<div class="oa-note">Credentials stay in this browser session. The owner key is verified against the brain through X-Master-Key before this console opens; five failed attempts lock this gate for 15 minutes.</div>' +
      '</form></div>';
  }

  function renderConsole(s) {
    var state = lastState || {};
    var api = lastApi || (W.VINTINUUM && W.VINTINUUM.status) || {};
    var living = state.living == null ? '?' : (state.living ? 'live' : 'dim');
    var spark = state.spark == null ? '?' : state.spark;
    var rows = logs.length ? logs.map(renderLog).join('') : '<div class="oa-row"><span class="oa-time">' + now() + '</span><span class="oa-kind">quiet</span><span class="oa-text">No world actions observed in this browser session yet.</span></div>';
    var panes = {
      feed: rows,
      state: renderState(state, api),
      storage: renderStorage(),
      access: renderAccess(s, api)
    };
    return '<div class="oa-wrap"><div class="oa-head"><div><div class="oa-kicker">owner oversight</div><h2>' + esc(worldId()) + '</h2></div><button class="oa-close" data-oa-close type="button">x</button></div>' +
      '<div class="oa-grid">' +
      stat('spark', spark) + stat('state', living) + stat('actions', logs.length) + stat('api', api.reachable === false ? 'down' : (api.origin || base() || '?')) +
      '</div><div class="oa-tabs">' +
      tab('feed', 'Action feed') + tab('state', 'World state') + tab('storage', 'Browser') + tab('access', 'Access') +
      '</div><div class="oa-pane">' + (panes[selected] || panes.feed) + '</div></div>';
  }
  function stat(k, v) { return '<div class="oa-stat"><b>' + esc(v) + '</b><span>' + esc(k) + '</span></div>'; }
  function tab(k, label) { return '<button class="oa-tab ' + (selected === k ? 'on' : '') + '" data-oa-tab="' + k + '" type="button">' + esc(label) + '</button>'; }
  function renderLog(x) {
    var data = x.data ? '<code class="oa-json">' + esc(JSON.stringify(x.data, null, 2).slice(0, 1200)) + '</code>' : '';
    return '<div class="oa-row"><span class="oa-time">' + esc(x.time) + '</span><span class="oa-kind">' + esc(x.kind) + '</span><span class="oa-text">' + esc(x.text) + data + '</span></div>';
  }
  function renderState(state, api) {
    return '<div class="oa-row"><span class="oa-time">world</span><span class="oa-kind">state</span><span class="oa-text"><code class="oa-json">' +
      esc(JSON.stringify({ worldId: worldId(), state: state, api: api }, null, 2)) + '</code></span></div>';
  }
  function renderStorage() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (/^(vint|vwg)/.test(k || '')) out[k] = String(localStorage.getItem(k) || '').slice(0, 180);
      }
    } catch (_) {}
    return '<div class="oa-row"><span class="oa-time">local</span><span class="oa-kind">snapshot</span><span class="oa-text"><code class="oa-json">' + esc(JSON.stringify(out, null, 2)) + '</code></span></div>';
  }
  function renderAccess(s, api) {
    return '<div class="oa-row"><span class="oa-time">session</span><span class="oa-kind">owner</span><span class="oa-text">unlocked as ' + esc(s.user) +
      '<br><button class="oa-ghost" data-oa-lock type="button">lock panel</button><code class="oa-json">' +
      esc(JSON.stringify({ apiBase: base(), apiStatus: api, tokenPresent: !!token() }, null, 2)) + '</code></span></div>';
  }

  function bind(el) {
    var closeBtn = el.querySelector('[data-oa-close]');
    if (closeBtn) closeBtn.onclick = close;
    var lockBtn = el.querySelector('[data-oa-lock]');
    if (lockBtn) lockBtn.onclick = function () { clearSession(); close(); render(); };
    var tabs = el.querySelectorAll('[data-oa-tab]');
    for (var i = 0; i < tabs.length; i++) tabs[i].onclick = function () { selected = this.getAttribute('data-oa-tab') || 'feed'; render(); };
    var form = el.querySelector('[data-oa-login]');
    if (form) form.onsubmit = async function (ev) {
      ev.preventDefault();
      if (lockedMessage()) { render(); return; }
      var user = (form.elements.user && form.elements.user.value || '').trim();
      var key = (form.elements.key && form.elements.key.value || '').trim();
      if (!user || !key) { recordBadAttempt(); render(); return; }
      var btn = form.querySelector('button[type="submit"]');
      var err = form.querySelector('[data-oa-error]');
      if (btn) { btn.disabled = true; btn.textContent = 'Checking key...'; }
      if (err) err.textContent = '';
      try {
        // Both factors are checked, and a failure of EITHER produces the exact
        // same message and the same lockout tick. Saying "bad username" vs
        // "bad key" would hand an attacker a user-enumeration oracle — telling
        // them which half they already got right. They learn nothing here.
        var nameOk = ownerNameOk(user);
        var ok = await verifyOwnerKey(key);
        if (!ok.ok || !nameOk) {
          var x = recordBadAttempt();
          if (err) err.textContent = x.until ? lockedMessage() : 'That owner username and key were not accepted.';
          if (btn) { btn.disabled = !!x.until; btn.textContent = 'Unlock panel'; }
          return;
        }
        resetAttempts();
        setSession({ user: user, key: key, verified: { prefix: ok.prefix, suffix: ok.suffix, length: ok.length }, at: Date.now() });
        log('access', 'owner panel unlocked as ' + user, { key: ok.prefix + '...' + ok.suffix, length: ok.length });
        addLauncher();
        render();
        startRefresh();
      } catch (_) {
        var y = recordBadAttempt();
        if (err) err.textContent = y.until ? lockedMessage() : 'The brain could not verify that key.';
        if (btn) { btn.disabled = !!y.until; btn.textContent = 'Unlock panel'; }
      }
    };
  }

  // ── THE SECOND FACTOR — the owner username ────────────────────────────────
  // Vinta asked for the panel to be held by "my owner key AND user name". The
  // KEY is the real cryptographic gate: it is verified by the brain, which
  // holds the only copy, so a wrong key can never be talked past. The USERNAME
  // is a second, LOCAL factor — it costs an attacker who somehow holds the key
  // one more thing they must also know, and it costs Vinta nothing.
  //
  // It is deliberately NOT a server round-trip: there is no OWNER_USERNAME in
  // the brain to check against, and inventing one would mean shipping a second
  // secret. These are Vinta's public, already-known handles (`vintaclectic` is
  // the verified Kick handle in vintinuum-api/owner-gate.js OWNER_IDS), so
  // nothing secret lives in this static file. The key still does the real work.
  var OWNER_NAMES = ['vintaclectic', 'vinta', 'vintaclectic@gmail.com'];
  function ownerNameOk(user) {
    var u = String(user || '').trim().toLowerCase();
    for (var i = 0; i < OWNER_NAMES.length; i++) if (OWNER_NAMES[i] === u) return true;
    return false;
  }

  async function verifyOwnerKey(key) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { try { ctrl.abort(); } catch (_) {} }, 7000);
    try {
      var r = await fetch(base() + '/api/owner/verify-key', {
        method: 'GET',
        headers: { 'X-Master-Key': key },
        cache: 'no-store',
        signal: ctrl.signal
      });
      var j = {};
      try { j = await r.json(); } catch (_) {}
      return r.ok && j && j.ok ? j : { ok: false, status: r.status };
    } finally {
      clearTimeout(t);
    }
  }

  function installObservers() {
    [
      'vint:world-ready', 'vint:world-fallback', 'vint:world-state', 'vint:world-travel',
      'vint:world-tend', 'vint:world-trace', 'vint:world-trace-ok', 'vint:world-trace-gone',
      'vint:world-struct', 'vint:world-soil', 'vint:world-died', 'vint:world-covenant',
      'vint:world-bank', 'vint:world-strike', 'vint:world-proposals', 'vint:world-law',
      'vint:world-deed', 'vint:world-harvest', 'vint:world-refine', 'vint:world-err',
      // gated/traces/warmth were missing from the first draft. "Oversee ALL
      // actions" has to be literally true, or the feed quietly lies by omission
      // about the exact events an owner most wants to see (a refusal, a sweep).
      'vint:world-gated', 'vint:world-traces', 'vint:world-warmth',
      'vint:recognizance-batch'
    ].forEach(function (name) {
      W.addEventListener(name, function (e) {
        if (name === 'vint:world-state') lastState = (e && e.detail) || {};
        log(name.replace(/^vint:/, ''), eventLine(name, e && e.detail), e && e.detail);
      });
    });
    W.addEventListener('vintinuum:api-status', function (e) {
      lastApi = (e && e.detail) || {};
      log('api', lastApi.reachable ? 'brain reachable via ' + lastApi.origin : 'brain unreachable', lastApi);
    });
    patchSend();
  }

  function eventLine(name, d) {
    d = d || {};
    if (name === 'vint:world-state') return 'world state received';
    if (name === 'vint:world-travel') return 'travelled to ' + (d.worldId || 'unknown');
    if (name === 'vint:world-err') return d.error || d.message || 'world error';
    if (name === 'vint:world-gated') return 'action refused by the gate' + (d.reason ? ': ' + d.reason : '');
    if (name === 'vint:recognizance-batch') return (d.acts || []).length + ' autonomous acts reported';
    return name.replace(/^vint:world-/, 'world ');
  }

  function patchSend() {
    var w = W.VintinuumWorld;
    if (!w || !w.send || w._ownerAdminWrapped) return;
    var raw = w.send;
    w.send = function (m) {
      log('outgoing', (m && m.t) ? m.t : 'world message', m);
      return raw.apply(this, arguments);
    };
    w._ownerAdminWrapped = true;
  }

  function boot() {
    if (booted) return; booted = true;
    ensureSheet();
    installObservers();
    addLauncher();
    W.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.shiftKey && String(e.key || '').toLowerCase() === 'o') {
        e.preventDefault(); open();
      }
    });
    try {
      var q = new URLSearchParams(location.search);
      if (q.get('owner') === '1' || q.get('admin') === '1') setTimeout(open, 800);
    } catch (_) {}
  }

  W.VintOwnerAdmin = { open: open, close: close, log: log };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
