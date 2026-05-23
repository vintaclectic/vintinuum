/* ──────────────────────────────────────────────────────────────────────────
   relay-scheduler-widget.js — HELIOS-FUSION-20, 2026-05-22
   ──────────────────────────────────────────────────────────────────────────
   Companion to browser-relay-widget.js. That widget surfaces "is the relay
   alive right now?"; this one answers "when should it become alive?".

   Surfaces:
     • a small draggable pill ("relay schedule") that opens a modal panel
     • current schedule + next fire time
     • mode picker: Manual | On a schedule | Keepalive
     • cron preset dropdown + custom cron field (with human-readable preview)
     • Windows start.bat path field (sanitised server-side too)
     • Save / Start Now buttons
     • status block: relay connected? last started? last error?

   Rules honoured:
     • no overflow — modal max-height = calc(100svh - 120px), scrolls inside
     • no overlap — pill clamped to viewport, modal anchored over a backdrop
     • draggable by default (data-draggable="true")
     • mobile-first — clamp() sizing, 44px touch targets, bottom-sheet on
       narrow viewports
     • Space Mono, dark glass, monochrome (no emojis)
   ────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.__vintRelaySchedulerLoaded) return;
  window.__vintRelaySchedulerLoaded = true;

  // ── API base ─────────────────────────────────────────────────────────────
  function apiBase() {
    return (
      window.__VINTINUUM_API_BASE ||
      window.VINTINUUM_API ||
      window.__VINT_API ||
      'https://api.vintaclectic.com'
    );
  }

  function authHeaders() {
    const h = { 'Content-Type': 'application/json' };
    const t =
      window.__VINT_TOKEN ||
      (window.localStorage && (localStorage.getItem('vint_token') || localStorage.getItem('token')));
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  }

  async function api(path, opts = {}) {
    const r = await fetch(apiBase() + path, {
      method: opts.method || 'GET',
      headers: authHeaders(),
      credentials: 'include',
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await r.text();
    let json = null;
    try { json = text ? JSON.parse(text) : {}; } catch (_) { json = { raw: text }; }
    if (!r.ok) {
      const err = new Error((json && json.error) || `HTTP ${r.status}`);
      err.status = r.status; err.json = json;
      throw err;
    }
    return json;
  }

  // ── State ───────────────────────────────────────────────────────────────
  const state = {
    schedule: null,
    presets: [],
    defaultPath: 'C:\\Users\\VINTA\\vintinuum-browser-relay\\start.bat',
    nextRunAt: null,
    cronDescription: null,
    relayConnected: false,
    modalOpen: false,
    saving: false,
    starting: false,
    statusMsg: null,
    pollHandle: null,
  };

  // ── Styles ──────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('vint-relay-scheduler-css')) return;
    const css = `
      #relay-scheduler-pill {
        position: fixed;
        top: calc(72px + env(safe-area-inset-top, 0px));
        right: clamp(12px, 2vw, 24px);
        transform: translateY(48px);
        z-index: 998;
        display: inline-flex; align-items: center; gap: 8px;
        min-height: 36px; padding: 8px 14px;
        background: rgba(12, 14, 20, 0.82);
        backdrop-filter: blur(14px) saturate(140%);
        -webkit-backdrop-filter: blur(14px) saturate(140%);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 999px;
        color: rgba(230,234,240,0.92);
        font: 11px/1 'Space Mono', ui-monospace, monospace;
        letter-spacing: 0.04em; text-transform: uppercase;
        cursor: pointer; user-select: none;
        box-shadow: 0 8px 24px rgba(0,0,0,0.35);
        transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
      }
      #relay-scheduler-pill:hover {
        background: rgba(20, 24, 32, 0.92);
        border-color: rgba(255,255,255,0.18);
      }
      #relay-scheduler-pill .rs-dot {
        width: 8px; height: 8px; border-radius: 50%;
        background: rgba(120,128,140,0.6);
        box-shadow: 0 0 0 0 rgba(255,255,255,0);
        transition: background 200ms ease, box-shadow 200ms ease;
      }
      #relay-scheduler-pill.is-enabled .rs-dot {
        background: #6fe3a1; box-shadow: 0 0 10px rgba(111,227,161,0.45);
      }
      #relay-scheduler-pill.is-keepalive .rs-dot {
        background: #ffd166; box-shadow: 0 0 10px rgba(255,209,102,0.40);
      }

      #relay-scheduler-backdrop {
        position: fixed; inset: 0; z-index: 1099;
        background: rgba(2,4,8,0.55);
        backdrop-filter: blur(2px);
        opacity: 0; pointer-events: none;
        transition: opacity 160ms ease;
      }
      #relay-scheduler-backdrop.is-open { opacity: 1; pointer-events: auto; }

      #relay-scheduler-modal {
        position: fixed; z-index: 1100;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%) scale(0.96);
        width: min(540px, calc(100vw - 32px));
        max-height: calc(100svh - 120px);
        background: rgba(10, 12, 18, 0.96);
        backdrop-filter: blur(20px) saturate(160%);
        -webkit-backdrop-filter: blur(20px) saturate(160%);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 14px;
        box-shadow: 0 24px 64px rgba(0,0,0,0.55);
        color: rgba(232,236,242,0.95);
        font-family: 'Space Mono', ui-monospace, monospace;
        opacity: 0; pointer-events: none;
        transition: opacity 160ms ease, transform 160ms ease;
        display: flex; flex-direction: column;
        overflow: hidden;
      }
      #relay-scheduler-modal.is-open {
        opacity: 1; pointer-events: auto;
        transform: translate(-50%, -50%) scale(1);
      }
      .rs-header {
        flex: 0 0 auto;
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 18px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .rs-header h3 {
        margin: 0; font: 12px/1.1 'Space Mono', monospace;
        letter-spacing: 0.10em; text-transform: uppercase;
        color: rgba(232,236,242,0.92);
      }
      .rs-header .rs-close {
        min-width: 44px; min-height: 44px;
        background: transparent; border: none;
        color: rgba(232,236,242,0.7); cursor: pointer;
        font: 16px/1 'Space Mono', monospace;
      }
      .rs-body {
        flex: 1 1 auto;
        overflow-y: auto;
        padding: 16px 18px 18px;
        font-size: 12px; line-height: 1.5;
        scrollbar-width: thin;
        scrollbar-color: rgba(255,255,255,0.18) transparent;
      }
      .rs-body::-webkit-scrollbar { width: 8px; }
      .rs-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 4px; }

      .rs-section { margin-bottom: 18px; }
      .rs-section:last-child { margin-bottom: 0; }
      .rs-label {
        display: block; margin-bottom: 6px;
        font-size: 10px; letter-spacing: 0.10em;
        text-transform: uppercase;
        color: rgba(180,188,200,0.75);
      }

      .rs-status {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 12px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 8px;
      }
      .rs-status .rs-stat {
        display: flex; flex-direction: column; gap: 4px;
        min-width: 0;
      }
      .rs-status .rs-stat .v {
        font-size: 12px; color: rgba(232,236,242,0.95);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .rs-status .rs-stat .v.ok    { color: #6fe3a1; }
      .rs-status .rs-stat .v.warn  { color: #ffd166; }
      .rs-status .rs-stat .v.err   { color: #ff6b88; }

      .rs-modes {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
      }
      .rs-mode-btn {
        min-height: 44px; padding: 8px 6px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        color: rgba(180,188,200,0.85);
        font: 11px/1.2 'Space Mono', monospace;
        letter-spacing: 0.06em; text-transform: uppercase;
        cursor: pointer; user-select: none;
        transition: all 120ms ease;
      }
      .rs-mode-btn:hover { border-color: rgba(255,255,255,0.18); color: rgba(232,236,242,0.95); }
      .rs-mode-btn.is-active {
        background: rgba(111,227,161,0.10);
        border-color: rgba(111,227,161,0.45);
        color: #b8f1d1;
      }

      .rs-input, .rs-select {
        width: 100%; min-height: 44px;
        padding: 10px 12px;
        background: rgba(0,0,0,0.30);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 8px;
        color: rgba(232,236,242,0.95);
        font: 12px/1.4 'Space Mono', monospace;
        box-sizing: border-box;
      }
      .rs-input:focus, .rs-select:focus {
        outline: none;
        border-color: rgba(111,227,161,0.55);
        box-shadow: 0 0 0 3px rgba(111,227,161,0.10);
      }
      .rs-help {
        margin-top: 6px;
        font-size: 11px;
        color: rgba(170,178,190,0.75);
      }
      .rs-help.err   { color: #ff8aa0; }
      .rs-help.warn  { color: #ffd166; }
      .rs-help.ok    { color: #8fe8b8; }

      .rs-toggle {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 12px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px;
        cursor: pointer; user-select: none;
        min-height: 44px;
      }
      .rs-toggle input { width: 18px; height: 18px; accent-color: #6fe3a1; }
      .rs-toggle span { font-size: 12px; color: rgba(232,236,242,0.92); }

      .rs-actions {
        flex: 0 0 auto;
        display: flex; gap: 8px;
        padding: 12px 18px;
        border-top: 1px solid rgba(255,255,255,0.08);
        background: rgba(0,0,0,0.20);
      }
      .rs-btn {
        flex: 1 1 0;
        min-height: 44px; padding: 10px 14px;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 8px;
        color: rgba(232,236,242,0.95);
        font: 11px/1 'Space Mono', monospace;
        letter-spacing: 0.10em; text-transform: uppercase;
        cursor: pointer; user-select: none;
        transition: all 120ms ease;
      }
      .rs-btn:hover { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.22); }
      .rs-btn.primary {
        background: rgba(111,227,161,0.16);
        border-color: rgba(111,227,161,0.55);
        color: #c4f5d8;
      }
      .rs-btn.primary:hover { background: rgba(111,227,161,0.24); }
      .rs-btn[disabled] { opacity: 0.5; cursor: not-allowed; }

      /* mobile: bottom-sheet form for narrow viewports */
      @media (max-width: 520px) {
        #relay-scheduler-modal {
          top: auto; bottom: 0; left: 0;
          transform: translateY(100%);
          width: 100vw;
          max-width: 100vw;
          max-height: 86svh;
          border-radius: 14px 14px 0 0;
        }
        #relay-scheduler-modal.is-open {
          transform: translateY(0);
        }
        .rs-modes { grid-template-columns: 1fr; }
        .rs-status { grid-template-columns: 1fr; }
      }
    `;
    const tag = document.createElement('style');
    tag.id = 'vint-relay-scheduler-css';
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  // ── DOM construction ────────────────────────────────────────────────────
  function buildPill() {
    if (document.getElementById('relay-scheduler-pill')) return;
    const pill = document.createElement('button');
    pill.id = 'relay-scheduler-pill';
    pill.type = 'button';
    pill.setAttribute('data-draggable', 'true');
    pill.setAttribute('aria-label', 'Open relay scheduler settings');
    pill.innerHTML = `<span class="rs-dot"></span><span class="rs-label-text">relay schedule</span>`;
    pill.addEventListener('click', (e) => {
      // draggable.js suppresses click if a real drag happened
      if (e.defaultPrevented) return;
      openModal();
    });
    document.body.appendChild(pill);
  }

  function buildModal() {
    if (document.getElementById('relay-scheduler-modal')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'relay-scheduler-backdrop';
    backdrop.addEventListener('click', closeModal);
    document.body.appendChild(backdrop);

    const modal = document.createElement('div');
    modal.id = 'relay-scheduler-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Relay scheduler settings');
    modal.innerHTML = `
      <div class="rs-header">
        <h3>Browser Relay Scheduler</h3>
        <button class="rs-close" type="button" aria-label="Close" data-draggable="false">×</button>
      </div>
      <div class="rs-body" id="rs-body">
        <div style="opacity:0.6;font-size:12px">loading…</div>
      </div>
      <div class="rs-actions">
        <button class="rs-btn" type="button" id="rs-start-now" data-draggable="true">Start Now</button>
        <button class="rs-btn primary" type="button" id="rs-save" data-draggable="true">Save Schedule</button>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.rs-close').addEventListener('click', closeModal);
    modal.querySelector('#rs-start-now').addEventListener('click', onStartNow);
    modal.querySelector('#rs-save').addEventListener('click', onSave);
  }

  // ── Render ──────────────────────────────────────────────────────────────
  function renderPill() {
    const pill = document.getElementById('relay-scheduler-pill');
    if (!pill) return;
    const label = pill.querySelector('.rs-label-text');
    pill.classList.remove('is-enabled', 'is-keepalive');
    if (state.schedule && state.schedule.enabled) {
      if (state.schedule.mode === 'keepalive') {
        pill.classList.add('is-keepalive');
        label.textContent = 'keepalive · 5m';
      } else if (state.schedule.mode === 'cron') {
        pill.classList.add('is-enabled');
        label.textContent = state.cronDescription
          ? state.cronDescription.toLowerCase().slice(0, 28)
          : 'scheduled';
      } else {
        label.textContent = 'relay schedule';
      }
    } else {
      label.textContent = 'relay schedule';
    }
  }

  function renderModal() {
    const body = document.getElementById('rs-body');
    if (!body) return;
    const s = state.schedule || {
      enabled: false, mode: 'manual', cronExpr: '0 8 * * *',
      windowsStartPath: state.defaultPath, lastFired: null,
    };

    const isCustomCron = s.mode === 'cron' && !state.presets.some(
      p => p.cronExpr && p.cronExpr === s.cronExpr
    );

    const lastFired = s.lastFired ? formatRelative(s.lastFired.at) : '—';
    const lastFiredCls = !s.lastFired ? '' : (s.lastFired.ok ? 'ok' : 'err');
    const connectedCls = state.relayConnected ? 'ok' : 'warn';
    const connectedTxt = state.relayConnected ? 'connected' : 'not connected';

    const cronPresetOpts = state.presets
      .filter(p => p.cronExpr !== null) // exclude keepalive marker
      .map(p => {
        const sel = (p.cronExpr === s.cronExpr) ? 'selected' : '';
        return `<option value="${escapeAttr(p.cronExpr)}" ${sel}>${escapeHTML(p.label)}</option>`;
      }).join('');

    body.innerHTML = `
      <div class="rs-section rs-status">
        <div class="rs-stat">
          <span class="rs-label">Relay</span>
          <span class="v ${connectedCls}">${connectedTxt}</span>
        </div>
        <div class="rs-stat">
          <span class="rs-label">Next run</span>
          <span class="v">${state.nextRunAt ? formatLocal(state.nextRunAt) : '—'}</span>
        </div>
        <div class="rs-stat">
          <span class="rs-label">Last fired</span>
          <span class="v ${lastFiredCls}">${lastFired}</span>
        </div>
        <div class="rs-stat">
          <span class="rs-label">Mode</span>
          <span class="v">${s.enabled ? s.mode : 'disabled'}</span>
        </div>
      </div>

      <div class="rs-section">
        <label class="rs-toggle" for="rs-enabled">
          <input type="checkbox" id="rs-enabled" ${s.enabled ? 'checked' : ''}>
          <span>Enable auto-start scheduling</span>
        </label>
      </div>

      <div class="rs-section">
        <span class="rs-label">Mode</span>
        <div class="rs-modes" role="radiogroup" aria-label="Schedule mode">
          <button type="button" class="rs-mode-btn ${s.mode==='manual'?'is-active':''}" data-mode="manual" data-draggable="true">Manual</button>
          <button type="button" class="rs-mode-btn ${s.mode==='cron'?'is-active':''}" data-mode="cron" data-draggable="true">Schedule</button>
          <button type="button" class="rs-mode-btn ${s.mode==='keepalive'?'is-active':''}" data-mode="keepalive" data-draggable="true">Keepalive</button>
        </div>
        <div class="rs-help" id="rs-mode-help">${modeHelp(s.mode)}</div>
      </div>

      <div class="rs-section" id="rs-cron-block" style="${s.mode==='cron' ? '' : 'display:none'}">
        <span class="rs-label">Preset</span>
        <select class="rs-select" id="rs-preset">
          ${cronPresetOpts}
          <option value="__custom__" ${isCustomCron ? 'selected' : ''}>Custom…</option>
        </select>

        <div style="height:10px"></div>
        <span class="rs-label">Cron expression (5 fields)</span>
        <input class="rs-input" id="rs-cron" type="text"
               value="${escapeAttr(s.cronExpr || '')}"
               placeholder="0 8 * * *"
               autocomplete="off" spellcheck="false">
        <div class="rs-help" id="rs-cron-preview">${state.cronDescription ? escapeHTML(state.cronDescription) : ''}</div>
      </div>

      <div class="rs-section">
        <span class="rs-label">Windows start path</span>
        <input class="rs-input" id="rs-path" type="text"
               value="${escapeAttr(s.windowsStartPath || state.defaultPath)}"
               placeholder="${escapeAttr(state.defaultPath)}"
               autocomplete="off" spellcheck="false">
        <div class="rs-help">Must end in .bat, .cmd, or .exe. Path is sanitised server-side.</div>
      </div>

      ${state.statusMsg ? `<div class="rs-section"><div class="rs-help ${state.statusMsg.cls || ''}">${escapeHTML(state.statusMsg.text)}</div></div>` : ''}
    `;

    // wire mode buttons
    body.querySelectorAll('.rs-mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (e.defaultPrevented) return;
        state.schedule = state.schedule || s;
        state.schedule.mode = btn.dataset.mode;
        renderModal();
      });
    });

    // wire preset
    const presetEl = body.querySelector('#rs-preset');
    if (presetEl) {
      presetEl.addEventListener('change', () => {
        const v = presetEl.value;
        if (v === '__custom__') return;
        const cronInput = body.querySelector('#rs-cron');
        if (cronInput) {
          cronInput.value = v;
          updateCronPreview(v);
        }
      });
    }

    const cronInput = body.querySelector('#rs-cron');
    if (cronInput) {
      cronInput.addEventListener('input', () => updateCronPreview(cronInput.value));
    }

    const enabledEl = body.querySelector('#rs-enabled');
    if (enabledEl) {
      enabledEl.addEventListener('change', () => {
        if (state.schedule) state.schedule.enabled = enabledEl.checked;
      });
    }
  }

  function modeHelp(mode) {
    if (mode === 'manual')    return 'Brain never starts the relay on its own. You start it with the button above (or by double-clicking start.bat).';
    if (mode === 'cron')      return 'Brain fires start.bat on the cron schedule below.';
    if (mode === 'keepalive') return 'Every 5 minutes the brain checks if the relay is connected. If not, it fires start.bat.';
    return '';
  }

  // Local, client-side cron-to-English (mirrors the server's describeCron).
  function describeCronClient(expr) {
    if (!expr) return '';
    const map = {
      '0 8 * * *':       'Every day at 8:00 AM',
      '0 9 * * 1-5':     'Weekdays at 9:00 AM',
      '0 9-17 * * 1-5':  'Every hour, weekdays 9 AM – 5 PM',
      '0 * * * *':       'Every hour, on the hour',
      '*/5 * * * *':     'Every 5 minutes',
      '*/15 * * * *':    'Every 15 minutes',
      '*/30 * * * *':    'Every 30 minutes',
      '0 0 * * *':       'Every day at midnight',
      '0 12 * * *':      'Every day at noon',
    };
    if (map[expr]) return map[expr];
    const f = expr.trim().split(/\s+/);
    if (f.length !== 5) return 'Needs 5 fields: minute hour day month weekday';
    const [m, h, dom, mon, dow] = f;
    if (m === '0' && /^\d+$/.test(h) && dom === '*' && mon === '*' && dow === '*') {
      const hh = parseInt(h, 10);
      const ampm = hh >= 12 ? 'PM' : 'AM';
      const hr12 = ((hh + 11) % 12) + 1;
      return `Every day at ${hr12}:00 ${ampm}`;
    }
    return `Cron: ${expr}`;
  }

  function updateCronPreview(expr) {
    const el = document.getElementById('rs-cron-preview');
    if (!el) return;
    const desc = describeCronClient(expr);
    el.textContent = desc;
    el.className = 'rs-help' + (desc.startsWith('Needs') ? ' err' : '');
  }

  function formatLocal(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    } catch (_) { return iso; }
  }

  function formatRelative(iso) {
    try {
      const d = new Date(iso).getTime();
      const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
      if (s < 60)      return `${s}s ago`;
      if (s < 3600)    return `${Math.floor(s/60)}m ago`;
      if (s < 86400)   return `${Math.floor(s/3600)}h ago`;
      return `${Math.floor(s/86400)}d ago`;
    } catch (_) { return iso; }
  }

  function escapeHTML(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }
  function escapeAttr(s) { return escapeHTML(s); }

  // ── Modal open/close ────────────────────────────────────────────────────
  async function openModal() {
    buildModal();
    state.modalOpen = true;
    document.getElementById('relay-scheduler-backdrop').classList.add('is-open');
    document.getElementById('relay-scheduler-modal').classList.add('is-open');
    await refresh();
    startPolling();
  }

  function closeModal() {
    state.modalOpen = false;
    const bd = document.getElementById('relay-scheduler-backdrop');
    const md = document.getElementById('relay-scheduler-modal');
    if (bd) bd.classList.remove('is-open');
    if (md) md.classList.remove('is-open');
    stopPolling();
  }

  function startPolling() {
    if (state.pollHandle) return;
    state.pollHandle = setInterval(refreshRelayStatus, 8000);
  }
  function stopPolling() {
    if (state.pollHandle) { clearInterval(state.pollHandle); state.pollHandle = null; }
  }

  // ── Data ────────────────────────────────────────────────────────────────
  async function refresh() {
    try {
      const [presets, sched] = await Promise.all([
        state.presets.length ? Promise.resolve({ presets: state.presets, defaultPath: state.defaultPath }) :
          api('/api/browser/relay/schedule/presets'),
        api('/api/browser/relay/schedule'),
      ]);
      state.presets     = presets.presets || [];
      state.defaultPath = presets.defaultPath || state.defaultPath;
      state.schedule       = sched.schedule;
      state.nextRunAt      = sched.nextRunAt;
      state.cronDescription = sched.cronDescription;
      state.relayConnected  = !!sched.relayConnected;
      state.statusMsg = null;
      renderPill(); renderModal();
    } catch (e) {
      state.statusMsg = { cls: 'err', text: `Load failed: ${e.message}` };
      renderModal();
    }
  }

  async function refreshRelayStatus() {
    try {
      const r = await api('/api/browser/relay/status');
      state.relayConnected = !!r.connected;
      // patch only the status node so we don't blow away in-progress edits
      const el = document.querySelector('#rs-body .rs-status .rs-stat:first-child .v');
      if (el) {
        el.textContent = state.relayConnected ? 'connected' : 'not connected';
        el.className = 'v ' + (state.relayConnected ? 'ok' : 'warn');
      }
    } catch (_) {}
  }

  async function onSave() {
    if (state.saving) return;
    const body = document.getElementById('rs-body');
    if (!body) return;
    const enabled = body.querySelector('#rs-enabled').checked;
    const mode = (body.querySelector('.rs-mode-btn.is-active') || {}).dataset?.mode || 'manual';
    const cronExpr = (body.querySelector('#rs-cron') || {}).value || '';
    const path = (body.querySelector('#rs-path') || {}).value || state.defaultPath;

    state.saving = true;
    state.statusMsg = { cls: '', text: 'saving…' };
    renderModal();
    try {
      const r = await api('/api/browser/relay/schedule', {
        method: 'POST',
        body: { enabled, mode, cronExpr, windowsStartPath: path },
      });
      state.schedule        = r.schedule;
      state.nextRunAt       = r.nextRunAt;
      state.cronDescription = r.cronDescription;
      state.statusMsg = { cls: 'ok', text: 'saved' };
      renderPill(); renderModal();
    } catch (e) {
      state.statusMsg = { cls: 'err', text: `Save failed: ${e.message}` };
      renderModal();
    } finally {
      state.saving = false;
    }
  }

  async function onStartNow() {
    if (state.starting) return;
    const body = document.getElementById('rs-body');
    const path = body ? (body.querySelector('#rs-path') || {}).value : null;
    state.starting = true;
    state.statusMsg = { cls: '', text: 'firing start.bat on Windows…' };
    renderModal();
    try {
      const r = await api('/api/browser/relay/start-now', {
        method: 'POST',
        body: path ? { windowsStartPath: path } : {},
      });
      if (r.ok) {
        state.statusMsg = { cls: 'ok', text: `dispatched at ${formatLocal(r.dispatchedAt || new Date().toISOString())}` };
      } else {
        state.statusMsg = { cls: 'err', text: `start failed: ${r.error || 'unknown'}` };
      }
      // refresh relay status soon — relay takes a few seconds to come up
      setTimeout(refreshRelayStatus, 4000);
      setTimeout(refreshRelayStatus, 9000);
    } catch (e) {
      state.statusMsg = { cls: 'err', text: `start failed: ${e.message}` };
    } finally {
      state.starting = false;
      renderModal();
    }
  }

  // ── Optional: mount inline into a host element ──────────────────────────
  function mountInline(host) {
    if (!host) return;
    host.innerHTML = '<div id="rs-body" style="font-family:Space Mono,monospace"></div><div class="rs-actions"><button class="rs-btn" id="rs-start-now" data-draggable="true">Start Now</button><button class="rs-btn primary" id="rs-save" data-draggable="true">Save Schedule</button></div>';
    host.querySelector('#rs-start-now').addEventListener('click', onStartNow);
    host.querySelector('#rs-save').addEventListener('click', onSave);
    refresh();
  }

  // ── Boot ────────────────────────────────────────────────────────────────
  function boot() {
    injectStyles();
    buildPill();
    const inlineHost = document.getElementById('relay-scheduler-settings');
    if (inlineHost) mountInline(inlineHost);
    // load schedule once at boot so the pill reflects current state
    refresh().catch(() => {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // expose for debugging
  window.__vintRelayScheduler = { state, openModal, closeModal, refresh };
})();
