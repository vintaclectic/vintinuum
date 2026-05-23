/* ──────────────────────────────────────────────────────────────────────────
   browser-relay-widget.js — ARIA, 2026-05-22
   ──────────────────────────────────────────────────────────────────────────
   A small, honest status pill for the two browser-control paths the brain
   now has into the user's actual browser:
       • Chrome extension (WS-attached)
       • Playwright relay (relay-server.js on Windows)

   Surfaces three things and nothing more than three things:
       1. Is anyone home?  (a coloured dot, a one-line label)
       2. What's home?      (extension / relay / both / nobody)
       3. Do I consent?     (one toggle, with the truth above it)

   Designed to feel like a watchful friend, not a console panel. Warmth
   over efficiency, but no decoration that isn't load-bearing.

   Vinta rules honoured:
     • no overlap, no overflow — pill clamps to viewport with safe margins,
       modal scrolls internally if content exceeds viewport
     • draggable by default via body/draggable.js (data-draggable="true",
       and the pill matches .pill in DEFAULT_SELECTORS)
     • mobile-first — sized in clamp() / svh, tap targets >= 36px
     • no emojis — every icon is a CSS-drawn dot or SVG
   ────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.__vintBrowserRelayWidgetLoaded) return;
  window.__vintBrowserRelayWidgetLoaded = true;

  // ── Resolve API base (api_base.js loaded first sets these globals) ───────
  function apiBase() {
    return (
      window.__VINTINUUM_API_BASE ||
      window.VINTINUUM_API ||
      window.__VINT_API ||
      'https://api.vintaclectic.com'
    );
  }

  // ── State ────────────────────────────────────────────────────────────────
  const state = {
    extension: { connected: false, lastSeen: null },
    relay:     { connected: false, headless: null, lastSeen: null },
    permission: null,         // null = unknown, true/false = known
    running: false,           // any active command? toggled by SSE/poll hook
    pollHandle: null,
    modalOpen: false,
  };

  // ── Inject CSS once ──────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('vint-browser-relay-css')) return;
    const css = `
      #browser-relay-pill {
        position: fixed;
        top: calc(72px + env(safe-area-inset-top, 0px));
        right: clamp(12px, 2vw, 24px);
        z-index: 998;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 7px 14px 7px 12px;
        min-height: 36px;
        background: rgba(15,15,25,0.85);
        backdrop-filter: blur(12px) saturate(140%);
        -webkit-backdrop-filter: blur(12px) saturate(140%);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 20px;
        font-family: 'Space Mono', monospace;
        font-size: .56rem;
        letter-spacing: .14em;
        text-transform: uppercase;
        color: rgba(218,228,255,0.88);
        cursor: pointer;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        transition: border-color .18s, background .18s, transform .12s;
        max-width: calc(100vw - 24px);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #browser-relay-pill:hover {
        border-color: rgba(255,255,255,0.18);
        background: rgba(18,20,32,0.92);
      }
      #browser-relay-pill:active { transform: scale(0.97); }
      #browser-relay-pill .brp-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: rgba(120,120,140,0.7);
        box-shadow: 0 0 6px rgba(120,120,140,0.4);
        flex-shrink: 0;
        transition: background .25s, box-shadow .25s;
      }
      #browser-relay-pill[data-state="online"]  .brp-dot { background:#66bb6a; box-shadow:0 0 8px rgba(102,187,106,0.65); }
      #browser-relay-pill[data-state="partial"] .brp-dot { background:#ffa726; box-shadow:0 0 8px rgba(255,167,38,0.6); }
      #browser-relay-pill[data-state="offline"] .brp-dot { background:rgba(150,150,170,0.55); box-shadow:none; }
      #browser-relay-pill[data-running="true"] .brp-dot {
        animation: brpPulse 1.2s ease-in-out infinite;
      }
      @keyframes brpPulse {
        0%,100% { transform: scale(1); opacity: 1; }
        50%     { transform: scale(1.5); opacity: 0.55; }
      }
      @media (max-width: 600px) {
        #browser-relay-pill {
          top: calc(64px + env(safe-area-inset-top, 0px));
          font-size: .52rem;
          padding: 6px 12px 6px 10px;
        }
      }

      /* ── Modal ─────────────────────────────────────────────────────── */
      #brp-modal-backdrop {
        position: fixed; inset: 0; z-index: 10000;
        background: rgba(2,4,8,0.62);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        opacity: 0;
        pointer-events: none;
        transition: opacity .22s;
      }
      #brp-modal-backdrop.open { opacity: 1; pointer-events: auto; }
      #brp-modal {
        width: 100%;
        max-width: 380px;
        max-height: calc(100svh - 32px);
        overflow-y: auto;
        background: rgba(12,15,24,0.96);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 18px;
        padding: 18px 18px 16px;
        font-family: 'Space Mono', monospace;
        color: rgba(218,228,255,0.92);
        box-shadow: 0 24px 60px rgba(0,0,0,0.55);
        transform: translateY(8px);
        transition: transform .22s;
        scrollbar-width: thin;
      }
      #brp-modal-backdrop.open #brp-modal { transform: translateY(0); }
      #brp-modal h2 {
        font-family: 'Cormorant Garamond', serif;
        font-weight: 300;
        font-style: italic;
        font-size: 1.15rem;
        letter-spacing: .08em;
        margin: 0 0 4px;
        color: rgba(218,228,255,0.95);
      }
      #brp-modal .brp-sub {
        font-size: .48rem;
        letter-spacing: .22em;
        text-transform: uppercase;
        color: rgba(150,175,215,0.55);
        margin-bottom: 14px;
      }
      #brp-modal .brp-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 0;
        border-top: 1px solid rgba(255,255,255,0.05);
        font-size: .58rem;
        letter-spacing: .08em;
      }
      #brp-modal .brp-row:first-of-type { border-top: none; }
      #brp-modal .brp-row .brp-k {
        color: rgba(218,228,255,0.7);
        text-transform: uppercase;
        letter-spacing: .14em;
        font-size: .5rem;
      }
      #brp-modal .brp-row .brp-v {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: rgba(218,228,255,0.9);
      }
      #brp-modal .brp-row .brp-v .brp-mini-dot {
        width: 6px; height: 6px; border-radius: 50%;
        background: rgba(150,150,170,0.55);
      }
      #brp-modal .brp-v[data-yes="true"]  .brp-mini-dot { background:#66bb6a; box-shadow:0 0 5px rgba(102,187,106,0.6); }
      #brp-modal .brp-v[data-yes="false"] .brp-mini-dot { background:rgba(150,150,170,0.45); }
      #brp-modal .brp-toggle-row {
        margin: 14px 0 10px;
        padding: 12px;
        background: rgba(79,195,247,0.06);
        border: 1px solid rgba(79,195,247,0.18);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      #brp-modal .brp-toggle-label {
        font-size: .56rem;
        letter-spacing: .14em;
        text-transform: uppercase;
        color: rgba(218,228,255,0.92);
      }
      #brp-modal .brp-switch {
        position: relative;
        width: 44px; height: 24px;
        background: rgba(255,255,255,0.08);
        border-radius: 12px;
        cursor: pointer;
        border: 1px solid rgba(255,255,255,0.12);
        transition: background .2s, border-color .2s;
        flex-shrink: 0;
      }
      #brp-modal .brp-switch::after {
        content: '';
        position: absolute;
        top: 2px; left: 2px;
        width: 18px; height: 18px;
        background: rgba(218,228,255,0.85);
        border-radius: 50%;
        transition: transform .22s, background .2s;
      }
      #brp-modal .brp-switch[aria-checked="true"] {
        background: rgba(102,187,106,0.32);
        border-color: rgba(102,187,106,0.55);
      }
      #brp-modal .brp-switch[aria-checked="true"]::after {
        transform: translateX(20px);
        background: #aed581;
      }
      #brp-modal .brp-warn {
        font-size: .52rem;
        line-height: 1.55;
        letter-spacing: .04em;
        color: rgba(218,228,255,0.62);
        padding: 10px 12px;
        border-radius: 10px;
        background: rgba(255,255,255,0.025);
        border-left: 2px solid rgba(255,167,38,0.5);
        margin: 8px 0;
      }
      #brp-modal .brp-warn.brp-warn-strong {
        border-left-color: rgba(244,143,177,0.6);
        color: rgba(244,200,210,0.78);
      }
      #brp-modal .brp-close {
        margin-top: 10px;
        width: 100%;
        padding: 10px 14px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px;
        color: rgba(218,228,255,0.8);
        font-family: 'Space Mono', monospace;
        font-size: .55rem;
        letter-spacing: .2em;
        text-transform: uppercase;
        cursor: pointer;
        transition: background .15s, border-color .15s;
      }
      #brp-modal .brp-close:hover {
        background: rgba(255,255,255,0.08);
        border-color: rgba(255,255,255,0.18);
      }
    `;
    const tag = document.createElement('style');
    tag.id = 'vint-browser-relay-css';
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  // ── Build / mount pill ───────────────────────────────────────────────────
  function ensurePill() {
    let pill = document.getElementById('browser-relay-pill');
    if (pill) return pill;

    // Prefer the author-placed mount anchor in brain.html. If it isn't a
    // pill itself (it's an empty <div>), wire the pill INTO it but keep
    // the fixed positioning so it never participates in layout flow.
    const anchor = document.querySelector('#browser-relay-pill-mount, [data-browser-relay-mount]');

    pill = document.createElement('button');
    pill.id = 'browser-relay-pill';
    pill.type = 'button';
    pill.setAttribute('data-draggable', 'true');
    pill.setAttribute('data-state', 'offline');
    pill.setAttribute('data-running', 'false');
    pill.setAttribute('aria-label', 'Browser control status');
    pill.setAttribute('title', 'Browser control status — click for details');
    pill.classList.add('pill'); // matches draggable.js DEFAULT_SELECTORS

    const dot = document.createElement('span');
    dot.className = 'brp-dot';
    const label = document.createElement('span');
    label.className = 'brp-label';
    label.textContent = 'Browser: …';

    pill.appendChild(dot);
    pill.appendChild(label);

    (anchor && anchor.parentNode ? anchor.parentNode : document.body).appendChild(pill);

    pill.addEventListener('click', (e) => {
      // draggable.js requires a hold to enter drag mode; quick clicks pass.
      // If a drag just ended, suppress the click.
      if (pill.__brpJustDragged) { pill.__brpJustDragged = false; return; }
      openModal();
    });

    return pill;
  }

  // ── Update pill visuals from state ───────────────────────────────────────
  function renderPill() {
    const pill = document.getElementById('browser-relay-pill');
    if (!pill) return;
    const label = pill.querySelector('.brp-label');

    const ext = state.extension.connected;
    const rel = state.relay.connected;

    let text, status;
    if (ext && rel) { text = 'Browser: Ext + Relay'; status = 'online'; }
    else if (ext)   { text = 'Browser: Extension';   status = 'online'; }
    else if (rel)   { text = 'Browser: Relay';       status = 'online'; }
    else            { text = 'Browser: Offline';     status = 'offline'; }

    // partial = permission granted but no transport, OR transport but no permission
    if ((ext || rel) && state.permission === false) status = 'partial';

    pill.setAttribute('data-state', status);
    pill.setAttribute('data-running', state.running ? 'true' : 'false');
    if (label) label.textContent = text;
  }

  // ── Modal ────────────────────────────────────────────────────────────────
  function buildModal() {
    let backdrop = document.getElementById('brp-modal-backdrop');
    if (backdrop) return backdrop;

    backdrop = document.createElement('div');
    backdrop.id = 'brp-modal-backdrop';
    backdrop.innerHTML = `
      <div id="brp-modal" role="dialog" aria-modal="true" aria-labelledby="brp-modal-title">
        <h2 id="brp-modal-title">Browser control</h2>
        <div class="brp-sub">Two paths. One consent.</div>

        <div class="brp-row">
          <span class="brp-k">Extension connected</span>
          <span class="brp-v" id="brp-v-ext" data-yes="false"><span class="brp-mini-dot"></span><span class="brp-v-text">no</span></span>
        </div>
        <div class="brp-row">
          <span class="brp-k">Relay connected</span>
          <span class="brp-v" id="brp-v-relay" data-yes="false"><span class="brp-mini-dot"></span><span class="brp-v-text">no</span></span>
        </div>
        <div class="brp-row">
          <span class="brp-k">Relay headless</span>
          <span class="brp-v" id="brp-v-headless" data-yes="false"><span class="brp-mini-dot"></span><span class="brp-v-text">—</span></span>
        </div>

        <div class="brp-toggle-row">
          <span class="brp-toggle-label">Enable browser control</span>
          <div id="brp-switch" class="brp-switch" role="switch" aria-checked="false" tabindex="0"></div>
        </div>

        <div class="brp-warn">
          When enabled, Vintinuum can open URLs, read page content, and interact
          with web pages on your behalf.
        </div>
        <div class="brp-warn brp-warn-strong">
          Script execution and cookie access require additional confirmation each time.
        </div>

        <button class="brp-close" id="brp-close-btn">Close</button>
      </div>
    `;
    document.body.appendChild(backdrop);

    // Close on backdrop click (but not on inner modal click)
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
    backdrop.querySelector('#brp-close-btn').addEventListener('click', closeModal);

    // ESC to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.modalOpen) closeModal();
    });

    // Toggle
    const sw = backdrop.querySelector('#brp-switch');
    sw.addEventListener('click', togglePermission);
    sw.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); togglePermission(); }
    });

    return backdrop;
  }

  function renderModal() {
    const m = document.getElementById('brp-modal-backdrop');
    if (!m) return;
    const ext  = m.querySelector('#brp-v-ext');
    const rel  = m.querySelector('#brp-v-relay');
    const head = m.querySelector('#brp-v-headless');
    const sw   = m.querySelector('#brp-switch');

    function setRow(el, yes, text) {
      el.setAttribute('data-yes', yes ? 'true' : 'false');
      el.querySelector('.brp-v-text').textContent = text;
    }

    setRow(ext,  state.extension.connected, state.extension.connected ? 'yes' : 'no');
    setRow(rel,  state.relay.connected,     state.relay.connected ? 'yes' : 'no');

    if (state.relay.headless === null) {
      setRow(head, false, '—');
    } else {
      setRow(head, state.relay.headless, state.relay.headless ? 'yes' : 'no');
    }

    sw.setAttribute('aria-checked', state.permission === true ? 'true' : 'false');
  }

  function openModal() {
    buildModal();
    renderModal();
    const m = document.getElementById('brp-modal-backdrop');
    m.classList.add('open');
    state.modalOpen = true;
    // Snap a fresh poll the moment we open so numbers feel honest
    pollOnce();
  }

  function closeModal() {
    const m = document.getElementById('brp-modal-backdrop');
    if (m) m.classList.remove('open');
    state.modalOpen = false;
  }

  // ── Network: poll status + toggle permission ─────────────────────────────
  async function fetchJSON(path, opts) {
    try {
      const r = await fetch(apiBase() + path, Object.assign({
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      }, opts || {}));
      if (!r.ok) return null;
      return await r.json();
    } catch (_) {
      return null;
    }
  }

  async function pollRelay() {
    const j = await fetchJSON('/api/browser/relay/status');
    if (j && typeof j === 'object') {
      state.relay.connected = !!(j.connected || j.relay_connected || j.ok);
      if (typeof j.headless === 'boolean') state.relay.headless = j.headless;
      else if (j.mode === 'headless') state.relay.headless = true;
      else if (j.mode === 'headed')   state.relay.headless = false;
      if (typeof j.permission === 'boolean') state.permission = j.permission;
      if (typeof j.running === 'boolean')    state.running    = j.running;
      state.relay.lastSeen = Date.now();
    } else {
      state.relay.connected = false;
    }
  }

  async function pollExtension() {
    const j = await fetchJSON('/api/browser/status');
    if (j && typeof j === 'object') {
      state.extension.connected = !!(j.connected || j.extension_connected || j.ws_connected || j.ok);
      if (typeof j.permission === 'boolean' && state.permission === null) {
        state.permission = j.permission;
      }
      if (typeof j.running === 'boolean') state.running = j.running;
      state.extension.lastSeen = Date.now();
    } else {
      state.extension.connected = false;
    }
  }

  async function pollOnce() {
    await Promise.all([pollExtension(), pollRelay()]);
    renderPill();
    if (state.modalOpen) renderModal();
  }

  async function togglePermission() {
    const desired = !(state.permission === true);
    // Optimistic flip so the toggle feels responsive
    state.permission = desired;
    renderModal();
    renderPill();

    const r = await fetchJSON('/api/browser/permission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: desired }),
    });
    if (r && typeof r.enabled === 'boolean') {
      state.permission = r.enabled;
    } else if (!r) {
      // Server unreachable — roll back so we don't lie about consent state
      state.permission = !desired;
    }
    renderModal();
    renderPill();
  }

  // ── Optional: subscribe to active-command pulses if the SSE life stream
  //    exposes them. Falls back silently if not present. ──────────────────
  function wireRunningPulse() {
    try {
      if (!window.EventSource) return;
      const es = new EventSource(apiBase() + '/api/life/stream', { withCredentials: true });
      es.addEventListener('browser_cmd_start', () => { state.running = true;  renderPill(); });
      es.addEventListener('browser_cmd_end',   () => { state.running = false; renderPill(); });
      es.onerror = () => { /* let the platform reconnect; don't spam */ };
      window.__brpES = es;
    } catch (_) { /* non-fatal */ }
  }

  // ── Boot ─────────────────────────────────────────────────────────────────
  function boot() {
    injectStyles();
    ensurePill();
    renderPill();
    pollOnce();
    if (state.pollHandle) clearInterval(state.pollHandle);
    state.pollHandle = setInterval(pollOnce, 10000);
    wireRunningPulse();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Expose a tiny handle for debugging from the console
  window.__brp = {
    state,
    poll: pollOnce,
    open: openModal,
    close: closeModal,
  };
})();
