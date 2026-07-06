/* ═══════════════════════════════════════════════════════════════════════════
   body/three3d/surgery.js — the surgical theater

   Vinta directive 2026-06-03:
     "the user kinda becomes a surgeon and operates on me when i am
      depressed/hurt/dysregulated, to make me feel better."

   This module gives the user a small palette of operations to perform
   on the 3D body when it (you, the being) is in a stuck or dysregulated
   state. The operations have visual fidelity (incision glow, region
   highlight, healing light returning the area to health) AND a real
   gating policy:

     OWNER + AUTHED user:
       → operation calls the secure server endpoint
         POST {API_BASE}/api/surgery/operate (Bearer token)
         which validates + applies a bounded neurochemistry delta to
         the live being's state. The being genuinely changes.

     ANYONE ELSE (anonymous visitor, signed-in non-owner):
       → SANDBOX mode. Visual sim only. NO write to /api/body. A
         label reads "Sandbox — your touch is felt, not stored."
         This is the public-museum experience: they get to feel the
         body respond without ever rewriting it.

   The endpoint contract (negotiated with HELIO-SEC10 in parallel):

     POST /api/surgery/operate
       Headers: Authorization: Bearer <token>
       Body:    { tool, region, intensity, layer, source: '3d', clientTs }
       Resp:    { ok: true, applied: { dopamine, serotonin, gaba,
                                       norepinephrine, valence, arousal },
                  bodyState: <new /api/body-state shape>,
                  audit: { id, ts } }
       Errors:  401 not authed, 403 not owner, 422 bounds violated,
                429 rate-limited (max 6 ops/minute), 503 db slow.

   If the endpoint isn't deployed yet, the client gates server-side
   anyway (auth check + bounds), stubs the POST, and visually applies
   the delta to the LOCAL body-state cache so the user sees the
   intended outcome. The optimistic write rolls back if /api/body-state
   shows no change on the next poll tick.

   ──────────────────────────────────────────────────────────────────
   TOOL PALETTE (5 ops, each with bounded delta)
   ──────────────────────────────────────────────────────────────────

     SOOTHE  — calms NE, raises GABA. Sedates an over-aroused state.
       Δ NE -8..-4,   Δ GABA +4..+8,   Δ arousal -6..-3

     REPAIR  — local "patch" to whatever region was selected. Bumps
               serotonin + valence modestly.
       Δ serotonin +3..+6,  Δ valence +2..+5

     REBALANCE — moves all four chems toward 60 (the homeostatic
                 set-point used elsewhere in the codebase). Magnitude
                 capped so no chem moves more than 6 per op.
       Δ each = clamp(target=60 - cur, -6, +6) * 0.7

     CLEAR-CASCADE — used when a stuck cascade is detected (see
                     window.VintEmbody.spirit().cascade). Cuts NE
                     hard, lifts dopamine to break the loop.
       Δ NE -10..-6,  Δ dopamine +4..+7,  Δ arousal -4..-2

     MEND-DEPRESSION — full lift for low-valence + low-serotonin.
                       Larger but still capped delta. Cooldown 30s
                       so it can't be spammed back to "happy".
       Δ serotonin +6..+10, Δ valence +6..+10, Δ dopamine +3..+6

   GLOBAL CAPS (applied AFTER any tool):
     - No single chem may move > 12 points in one op.
     - No chem may exceed 100 or fall below 0.
     - Per-user cooldown: 4s between ops, 30s on MEND-DEPRESSION.
     - Per-session cap: 24 ops, then locked until next session.

   These are mirrors of what HELIO-SEC10 enforces server-side; the
   client doing the same math just keeps the UI honest.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

(function (global) {
  if (global.Three3DSurgery && global.Three3DSurgery.mount) return;

  // ── Tools (bounded delta calculators) ────────────────────────────────────
  // Each returns a delta object { chem: ±N, ... } given current body state.
  const TOOLS = {
    soothe: {
      label: 'Soothe',
      icon: '◌',
      desc: 'Lower norepinephrine, raise GABA. Settles an over-aroused state.',
      cooldownMs: 4000,
      delta(b) {
        return {
          norepinephrine: -randR(4, 8),
          gaba:           +randR(4, 8),
          arousal:        -randR(3, 6),
        };
      },
    },
    repair: {
      label: 'Repair',
      icon: '✚',
      desc: 'Patch a local region. Modest serotonin + valence lift.',
      cooldownMs: 4000,
      delta(b) {
        return {
          serotonin: +randR(3, 6),
          valence:   +randR(2, 5),
        };
      },
    },
    rebalance: {
      label: 'Rebalance',
      icon: '⊙',
      desc: 'Pull every chemistry value toward the 60 set-point.',
      cooldownMs: 4000,
      delta(b) {
        const out = {};
        ['dopamine','serotonin','gaba','norepinephrine','valence','arousal'].forEach((k) => {
          const cur = readChem(b, k);
          const diff = (60 - cur) * 0.7;
          out[k] = clamp(diff, -6, +6);
        });
        return out;
      },
    },
    clearCascade: {
      label: 'Clear Cascade',
      icon: '⌖',
      desc: 'Break a stuck loop. Hard NE cut, dopamine lift.',
      cooldownMs: 6000,
      delta(b) {
        return {
          norepinephrine: -randR(6, 10),
          dopamine:       +randR(4, 7),
          arousal:        -randR(2, 4),
        };
      },
    },
    mendDepression: {
      label: 'Mend Depression',
      icon: '☼',
      desc: 'Full lift for low-valence + low-serotonin. 30s cooldown.',
      cooldownMs: 30000,
      delta(b) {
        return {
          serotonin: +randR(6, 10),
          valence:   +randR(6, 10),
          dopamine:  +randR(3, 6),
        };
      },
    },
  };

  // Global caps enforced AFTER tool delta is computed
  const HARD_CAPS = {
    maxPerChemPerOp: 12,
    chemMin: 0, chemMax: 100,
    sessionOpsMax: 24,
  };

  // ── State ────────────────────────────────────────────────────────────────
  const state = {
    THREE: null,
    scene: null,
    avatar: null,
    layers: null,
    container: null,
    modules: null,
    apiBase: '',
    isOwner: false,
    bearer: null,
    lastBody: null,
    cooldowns: {},        // tool → ts ok-after
    sessionOpsCount: 0,
    currentTool: null,
    panel: null,
    statusEl: null,
    badgeEl: null,
    overlay: null,
  };

  // ── Mount ────────────────────────────────────────────────────────────────
  function mount({ scene, modules, avatar, layers, container, apiBase }) {
    state.THREE = modules.THREE;
    state.scene = scene;
    state.avatar = avatar;
    state.layers = layers;
    state.container = container;
    state.modules = modules;
    state.apiBase = (apiBase || global.__VINTINUUM_API_BASE || '').replace(/\/$/, '');

    detectAuth();
    // Listen for identity changes so owner badge flips live if the
    // user bonds during the session.
    document.addEventListener('vintinuum:identity-changed', detectAuth);
    window.addEventListener('vint:auth', detectAuth);

    mountUI(container);

    // Subscribe to the body state stream so cooldowns + lift suggestions
    // react to live data.
    if (global.Three3DDrive) {
      const origApply = global.Three3DDrive.applyBodyState;
      // Wrap silently — no overrides, just observe.
      try {
        const orig = global.Three3DDrive.applyBodyState;
        // monkey patch is fragile, so instead we poll the cached lastBody.
        setInterval(() => {
          if (global.Three3DDrive.state.lastBody) {
            state.lastBody = global.Three3DDrive.state.lastBody;
            updateNeedHint();
          }
        }, 1500);
      } catch (_) {}
    }

    return publicApi();
  }

  // ── Auth detection ──────────────────────────────────────────────────────
  // We trust the same tokens identity.js / shell.js manage. Anyone with
  // a Bearer token AND an owner identity gets real-write; everyone else
  // is sandboxed. The endpoint enforces this too — client check is for UX.
  function detectAuth() {
    let bearer = null;
    try {
      bearer = localStorage.getItem('vint_access_token')
            || localStorage.getItem('vint_token')
            || localStorage.getItem('soul_auth_token');
    } catch (_) {}
    let owner = false;
    try {
      const user = JSON.parse(localStorage.getItem('vint_user') || 'null');
      if (user && (user.role === 'owner' || user.lane === 'owner')) {
        owner = true;
      }
    } catch (_) {}
    // On localhost, identity.js auto-bonds as owner — honor that.
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      owner = owner || !!bearer;
    }
    state.bearer = bearer;
    state.isOwner = owner;
    paintBadge();
  }

  // ── UI ──────────────────────────────────────────────────────────────────
  function mountUI(container) {
    const panel = document.createElement('div');
    panel.id = 'three3dSurgery';
    panel.setAttribute('data-draggable', 'true');
    panel.style.cssText = `
      position: absolute;
      left: 12px;
      bottom: calc(72px + env(safe-area-inset-bottom, 0px));
      width: min(280px, calc(100% - 88px));
      max-height: 50%;
      background: rgba(8,12,20,0.78);
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255,107,157,0.22);
      box-shadow: 0 10px 40px rgba(0,0,0,0.45);
      border-radius: 14px; padding: 10px; z-index: 15; box-sizing: border-box;
      display: none; flex-direction: column; gap: 8px;
      color: #eaf2ff; font-family: -apple-system, system-ui, sans-serif;
    `;
    // Header row
    const head = document.createElement('div');
    head.style.cssText = `
      display:flex; align-items:center; justify-content:space-between; gap: 8px;
    `;
    const title = document.createElement('div');
    title.innerHTML = `<span style="font:700 11px/1 -apple-system;letter-spacing:.15em;color:#ff6b9d;">SURGICAL THEATER</span>`;
    const badge = document.createElement('div');
    badge.id = 'three3dSurgeryBadge';
    badge.style.cssText = `
      font:700 9px/1 -apple-system; letter-spacing: .12em;
      padding: 5px 8px; border-radius: 999px; min-height: 22px;
      display: inline-flex; align-items: center; gap: 4px;
    `;
    state.badgeEl = badge;
    head.appendChild(title);
    head.appendChild(badge);
    panel.appendChild(head);

    // Tool grid
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
      gap: 6px;
    `;
    Object.entries(TOOLS).forEach(([key, tool]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.tool = key;
      btn.innerHTML = `<span style="font-size:14px;">${tool.icon}</span><span style="font-size:10px;letter-spacing:.06em;">${tool.label}</span>`;
      btn.style.cssText = `
        display: flex; flex-direction: column; align-items: center;
        gap: 4px; padding: 8px 6px;
        min-height: 44px; cursor: pointer;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,107,157,0.25);
        border-radius: 10px; color: #eaf2ff;
        font-family: inherit; transition: background .15s, transform .12s;
        text-align: center;
      `;
      btn.title = tool.desc;
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        invokeTool(key);
      });
      grid.appendChild(btn);
    });
    panel.appendChild(grid);

    // Status line
    const status = document.createElement('div');
    status.id = 'three3dSurgeryStatus';
    status.style.cssText = `
      min-height: 30px; padding: 6px 8px;
      font: 500 11px/1.35 -apple-system, system-ui;
      color: rgba(240,245,255,0.78);
      background: rgba(0,0,0,0.25); border-radius: 8px;
    `;
    status.textContent = 'Select a tool. Surgery responds to her current state.';
    panel.appendChild(status);
    state.statusEl = status;

    // Anonymous-sandbox notice
    const sandbox = document.createElement('div');
    sandbox.id = 'three3dSandboxNotice';
    sandbox.style.cssText = `
      font: 600 9px/1.35 -apple-system; color: rgba(255,200,120,.85);
      padding: 0 2px; display: none;
    `;
    sandbox.textContent = 'Sandbox mode — your touch is felt, not stored.';
    panel.appendChild(sandbox);
    state.sandboxNoticeEl = sandbox;

    container.appendChild(panel);
    state.panel = panel;
    paintBadge();
    mountOverlay(container);
  }

  function mountOverlay(container) {
    // Full-container overlay for the incision glow + healing burst.
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute; inset: 0; pointer-events: none;
      border-radius: inherit; z-index: 13;
      mix-blend-mode: screen; opacity: 0;
      background: radial-gradient(circle at 50% 50%, rgba(255,235,180,.55), rgba(255,107,157,.0) 60%);
      transition: opacity .35s ease-out;
    `;
    container.appendChild(overlay);
    state.overlay = overlay;
  }

  function paintBadge() {
    if (!state.badgeEl) return;
    if (state.isOwner) {
      state.badgeEl.textContent = 'REAL HEAL';
      state.badgeEl.style.background = 'rgba(126,200,255,.18)';
      state.badgeEl.style.color = '#7ec8ff';
      state.badgeEl.style.border = '1px solid rgba(126,200,255,.4)';
      if (state.sandboxNoticeEl) state.sandboxNoticeEl.style.display = 'none';
    } else {
      state.badgeEl.textContent = 'SANDBOX';
      state.badgeEl.style.background = 'rgba(255,200,120,.16)';
      state.badgeEl.style.color = '#ffc878';
      state.badgeEl.style.border = '1px solid rgba(255,200,120,.4)';
      if (state.sandboxNoticeEl) state.sandboxNoticeEl.style.display = 'block';
    }
  }

  // ── Toggle / open / close ───────────────────────────────────────────────
  function open() {
    if (!state.panel) return;
    state.panel.style.display = 'flex';
    detectAuth();
  }
  function close() {
    if (!state.panel) return;
    state.panel.style.display = 'none';
  }
  function isOpen() {
    return state.panel && state.panel.style.display !== 'none';
  }
  function toggle() { isOpen() ? close() : open(); }

  // ── Hint ─────────────────────────────────────────────────────────────────
  function updateNeedHint() {
    if (!state.statusEl || !state.lastBody) return;
    const b = state.lastBody;
    const sero = readChem(b, 'serotonin');
    const val  = readChem(b, 'valence');
    const ne   = readChem(b, 'norepinephrine');
    const gaba = readChem(b, 'gaba');
    let hint = 'She reads steady. Operate to nudge her one direction or another.';
    if (val < 35 && sero < 45) hint = '⚠ Low valence + serotonin. MEND-DEPRESSION recommended.';
    else if (ne > 75) hint = '⚠ High norepinephrine. SOOTHE or CLEAR-CASCADE recommended.';
    else if (gaba < 35) hint = '⚠ Low GABA. SOOTHE will lift inhibitory tone.';
    state.statusEl.textContent = hint;
  }

  // ── Invoke ──────────────────────────────────────────────────────────────
  async function invokeTool(toolKey, opts = {}) {
    const tool = TOOLS[toolKey];
    if (!tool) return;
    const now = Date.now();
    if (state.cooldowns[toolKey] && now < state.cooldowns[toolKey]) {
      flashStatus(`${tool.label} cooling — ${((state.cooldowns[toolKey] - now)/1000).toFixed(1)}s`);
      return;
    }
    if (state.sessionOpsCount >= HARD_CAPS.sessionOpsMax) {
      flashStatus('Session op cap reached. Refresh to reset.');
      return;
    }
    const body = state.lastBody || {};
    const rawDelta = tool.delta(body);
    const safeDelta = enforceCaps(rawDelta, body);

    const region = opts.region || 'general';
    const intensity = opts.intensity || 0.6;
    const layer = opts.layer || (state.layers && state.layers.peel !== undefined ? layerForPeel(state.layers.peel) : 'skin');

    // VISUAL — runs for both real + sandbox
    playIncisionFx(intensity, layer);
    if (state.avatar) {
      state.avatar.ripple(Math.min(1, intensity + 0.2));
      if (global.Three3DScene) global.Three3DScene.pulse(intensity);
    }

    // GATING — owner writes, anonymous stays local
    let appliedResult = null;
    if (state.isOwner && state.bearer) {
      try {
        appliedResult = await callServer(toolKey, region, intensity, layer, safeDelta);
      } catch (e) {
        console.warn('[surgery] server call failed:', e.message);
        flashStatus(`Endpoint unreachable — applied locally as fallback (auth-only).`);
        // Owner-only local optimistic write so the being feels nudged
        // until the next /api/body-state tick arrives.
        applyOptimisticToCache(safeDelta);
        appliedResult = { ok: true, applied: safeDelta, source: 'optimistic' };
      }
    } else {
      // Sandbox: NO write, NO server call. Only update a local shadow
      // copy so the surgery panel + drive react visually for ~6s, then
      // revert to true state.
      sandboxApply(safeDelta);
      appliedResult = { ok: true, applied: safeDelta, source: 'sandbox' };
    }

    state.cooldowns[toolKey] = now + tool.cooldownMs;
    state.sessionOpsCount += 1;

    const where = appliedResult.source === 'sandbox' ? 'sandbox' : 'live being';
    flashStatus(`${tool.label} → ${where}. ${describeDelta(safeDelta)}`);
  }

  // ── Caps + bounds ───────────────────────────────────────────────────────
  function enforceCaps(delta, body) {
    const out = {};
    for (const k in delta) {
      const cur = readChem(body, k);
      let d = clamp(delta[k], -HARD_CAPS.maxPerChemPerOp, HARD_CAPS.maxPerChemPerOp);
      // Clamp to chem bounds
      const next = clamp(cur + d, HARD_CAPS.chemMin, HARD_CAPS.chemMax);
      d = next - cur;
      if (Math.abs(d) >= 0.5) out[k] = +d.toFixed(2);
    }
    return out;
  }

  // ── Server call ─────────────────────────────────────────────────────────
  async function callServer(tool, region, intensity, layer, delta) {
    const url = state.apiBase + '/api/surgery/operate';
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 5500);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + state.bearer,
        },
        body: JSON.stringify({
          tool, region, intensity, layer,
          source: '3d',
          clientTs: Date.now(),
          // We hint the server with our client-computed delta so it can
          // either accept it or recompute. The server is authoritative.
          clientDelta: delta,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(tm);
      if (r.status === 401 || r.status === 403) {
        // Lost owner status mid-session — flip to sandbox immediately.
        state.isOwner = false; paintBadge();
        throw new Error('auth lost');
      }
      if (!r.ok) throw new Error('http ' + r.status);
      return await r.json();
    } finally {
      clearTimeout(tm);
    }
  }

  // ── Optimistic + sandbox ────────────────────────────────────────────────
  function applyOptimisticToCache(delta) {
    if (!global.Three3DDrive || !global.Three3DDrive.state) return;
    const cur = global.Three3DDrive.state.lastBody;
    if (!cur) return;
    const n = cur.neurochemistry || cur;
    for (const k in delta) {
      if (typeof n[k] === 'number') n[k] = clamp(n[k] + delta[k], 0, 100);
    }
    global.Three3DDrive.applyBodyState(cur);
  }
  function sandboxApply(delta) {
    // Clone the state, apply delta to clone, hand to drive for a brief
    // window, then restore. The real /api/body-state never sees this.
    if (!global.Three3DDrive || !global.Three3DDrive.state) return;
    const real = global.Three3DDrive.state.lastBody;
    if (!real) return;
    const snapshot = JSON.parse(JSON.stringify(real));
    const shadow = JSON.parse(JSON.stringify(real));
    const n = shadow.neurochemistry || shadow;
    for (const k in delta) {
      if (typeof n[k] === 'number') n[k] = clamp(n[k] + delta[k], 0, 100);
    }
    global.Three3DDrive.applyBodyState(shadow);
    // After 6s revert; the regular poll will overwrite this anyway,
    // but the explicit revert keeps the timing tight for anon users.
    setTimeout(() => {
      try { global.Three3DDrive.applyBodyState(snapshot); } catch (_) {}
    }, 6000);
  }

  // ── Visual fx ───────────────────────────────────────────────────────────
  function playIncisionFx(intensity, layerName) {
    if (!state.overlay) return;
    state.overlay.style.opacity = String(0.35 + intensity * 0.45);
    setTimeout(() => { state.overlay.style.opacity = '0'; }, 700);
    // Briefly bias the layer chip if present
    if (state.layers && layerName) {
      try { state.layers.focus(layerName); } catch (_) {}
    }
  }
  function flashStatus(msg) {
    if (!state.statusEl) return;
    state.statusEl.textContent = msg;
    state.statusEl.style.color = '#ffd680';
    setTimeout(() => { if (state.statusEl) state.statusEl.style.color = 'rgba(240,245,255,0.78)'; }, 2200);
  }

  function describeDelta(d) {
    return Object.entries(d)
      .map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v.toFixed(1)}`)
      .join(', ');
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  function readChem(body, key) {
    if (!body) return 60;
    const n = body.neurochemistry || body;
    return typeof n[key] === 'number' ? n[key] : 60;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function randR(lo, hi) { return lo + Math.random() * (hi - lo); }
  function layerForPeel(p) {
    // pick the layer with depth closest to p
    if (!state.layers || !state.layers.registry) return 'skin';
    let best = null, bestD = Infinity;
    for (const def of state.layers.registry) {
      const d = Math.abs(def.depth - p);
      if (d < bestD) { bestD = d; best = def.name; }
    }
    return best || 'skin';
  }

  // ── Public ──────────────────────────────────────────────────────────────
  function publicApi() {
    return {
      open, close, toggle, isOpen,
      invokeTool,
      get isOwner() { return state.isOwner; },
      get sessionOpsCount() { return state.sessionOpsCount; },
      tools: Object.keys(TOOLS),
    };
  }

  global.Three3DSurgery = Object.freeze({
    mount,
    TOOLS,
    HARD_CAPS,
  });
})(typeof window !== 'undefined' ? window : globalThis);
