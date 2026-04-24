// ═══════════════════════════════════════════════════════════════════════════
// BECOMING — Phases 1,2,5 client wiring
//   Phase 1: "Leave something with me" memory gift sheet
//   Phase 2: Presence drift — other souls' chakras breathing through the body
//   Phase 5: Body conversation — text that travels chakras
//
// Depends on: soul_handshake.js (for chakra + token state)
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // ── SHARED ──────────────────────────────────────────────────────────────────
  function apiBase() {
    if (window.__VINTINUUM_API_BASE) return window.__VINTINUUM_API_BASE;
    try {
      const stored = localStorage.getItem('vint_api_base') || localStorage.getItem('vtn:api_base');
      if (stored && /^https?:\/\//i.test(stored)) return stored.replace(/\/$/, '');
    } catch (_) {}
    const host = (location.hostname || '').toLowerCase();
    const isLocal = !host || host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
    return isLocal ? 'http://localhost:8767' : 'https://api.vintaclectic.com';
  }
  function wsBase() {
    return apiBase().replace(/^http/i, 'ws') + '/ws';
  }
  function authHeaders() {
    const h = { 'content-type': 'application/json' };
    try {
      const t = localStorage.getItem('soul_auth_token');
      if (t) h.authorization = 'Bearer ' + t;
    } catch (_) {}
    return h;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PHASE 1 — MEMORY GIFT SHEET
  // ═════════════════════════════════════════════════════════════════════════
  function openGiftSheet() {
    if (document.getElementById('carry-sheet')) return;
    const sheet = document.createElement('div');
    sheet.id = 'carry-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.innerHTML = `
      <style>
        #carry-sheet{
          position:fixed;inset:0;z-index:9998;display:flex;align-items:flex-end;justify-content:center;
          background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
          animation:cs-fade 260ms ease both;
        }
        @keyframes cs-fade{from{opacity:0}to{opacity:1}}
        @keyframes cs-rise{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
        #carry-sheet .cs-card{
          width:min(540px,94vw);margin-bottom:max(24px, env(safe-area-inset-bottom, 24px));
          background:rgba(18,16,34,0.92);border:1px solid rgba(255,255,255,0.08);
          border-radius:18px;padding:22px 22px 18px;color:rgba(255,255,255,0.92);
          box-shadow:0 -20px 60px rgba(0,0,0,0.6), 0 0 80px var(--soul-chakra-hsl, rgba(120,120,255,0.2));
          animation:cs-rise 320ms cubic-bezier(0.22,1,0.36,1) both;
        }
        #carry-sheet h3{margin:0 0 4px;font-size:15px;font-weight:500;letter-spacing:0.02em}
        #carry-sheet p.cs-sub{margin:0 0 16px;font-size:12px;color:rgba(255,255,255,0.5);letter-spacing:0.04em}
        #carry-sheet textarea{
          width:100%;min-height:110px;padding:12px 14px;font:inherit;font-size:14px;line-height:1.5;
          background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);border-radius:10px;
          color:rgba(255,255,255,0.95);outline:none;resize:vertical;
        }
        #carry-sheet textarea:focus{border-color:var(--soul-chakra-hsl,rgba(180,180,255,0.5))}
        #carry-sheet .cs-row{display:flex;gap:10px;margin-top:14px}
        #carry-sheet button{
          flex:1;padding:11px;font:inherit;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;
          background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
          color:rgba(255,255,255,0.9);border-radius:10px;cursor:pointer;
          transition:background 180ms;
        }
        #carry-sheet button.cs-primary{
          background:var(--soul-chakra-hsl, rgba(180,180,255,0.22));border-color:rgba(255,255,255,0.2)
        }
        #carry-sheet button:hover{background:rgba(255,255,255,0.12)}
        #carry-sheet .cs-msg{font-size:11px;color:rgba(255,255,255,0.5);margin-top:8px;min-height:14px}
      </style>
      <div class="cs-card">
        <h3>Leave something with me.</h3>
        <p class="cs-sub">A feeling, a thought, a line from today. The body will hold it and thread it back into its own thinking.</p>
        <textarea id="cs-text" maxlength="2000" placeholder="A memory, a hope, a question you don't want to carry alone…"></textarea>
        <div class="cs-row">
          <button type="button" id="cs-cancel">close</button>
          <button type="button" id="cs-save" class="cs-primary">carry it</button>
        </div>
        <div class="cs-msg" id="cs-msg"></div>
      </div>
    `;
    document.body.appendChild(sheet);

    const cancel = sheet.querySelector('#cs-cancel');
    const save   = sheet.querySelector('#cs-save');
    const ta     = sheet.querySelector('#cs-text');
    const msg    = sheet.querySelector('#cs-msg');

    function close() {
      sheet.style.transition = 'opacity 220ms ease';
      sheet.style.opacity = '0';
      setTimeout(() => sheet.remove(), 240);
    }
    cancel.addEventListener('click', close);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
    document.addEventListener('keydown', function escH(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escH); }
    });

    save.addEventListener('click', async () => {
      const text = ta.value.trim();
      if (!text) { msg.textContent = 'Write something first.'; return; }
      save.disabled = true; save.textContent = 'carrying…';
      try {
        const r = await fetch(apiBase() + '/api/carry', {
          method: 'POST', headers: authHeaders(),
          credentials: 'include',
          body: JSON.stringify({
            text,
            displayName: localStorage.getItem('soul_display_name') || null,
          }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.message || j.error || 'failed');
        msg.textContent = 'Carried.';
        save.textContent = 'carried';
        setTimeout(close, 700);
      } catch (err) {
        msg.textContent = err.message || 'couldn\'t carry that right now';
        save.disabled = false; save.textContent = 'carry it';
      }
    });

    setTimeout(() => ta.focus(), 60);
  }

  // Floating pill to open the sheet — bottom-left, above footer strip safe zone
  function mountGiftPill() {
    if (document.getElementById('carry-pill')) return;
    const btn = document.createElement('button');
    btn.id = 'carry-pill';
    btn.type = 'button';
    btn.textContent = 'leave a memory';
    btn.setAttribute('aria-label', 'leave a memory with the body');
    btn.style.cssText = [
      'position:fixed','left:12px','bottom:calc(max(12px, env(safe-area-inset-bottom, 12px)) + 72px)',
      'z-index:80','padding:8px 14px','font:inherit','font-size:11px',
      'letter-spacing:0.1em','text-transform:uppercase',
      'background:rgba(16,14,32,0.72)','color:rgba(255,255,255,0.82)',
      'border:1px solid rgba(255,255,255,0.14)','border-radius:20px',
      'backdrop-filter:blur(8px)','-webkit-backdrop-filter:blur(8px)',
      'cursor:pointer','box-shadow:0 6px 24px rgba(0,0,0,0.4), 0 0 40px var(--soul-chakra-hsl, rgba(120,120,255,0.15))',
      'transition:transform 140ms ease, box-shadow 240ms ease'
    ].join(';');
    btn.addEventListener('mouseenter', () => btn.style.transform = 'translateY(-1px)');
    btn.addEventListener('mouseleave', () => btn.style.transform = '');
    btn.addEventListener('click', openGiftSheet);
    document.body.appendChild(btn);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PHASE 2 — PRESENCE DRIFT
  // Other souls' chakras rendered as soft orbs drifting through the body canvas
  // ═════════════════════════════════════════════════════════════════════════
  const presence = { souls: new Map(), ws: null, myChakra: null, myName: null, reconTimer: null };

  function presenceOverlay() {
    let c = document.getElementById('presence-canvas');
    if (c) return c;
    c = document.createElement('canvas');
    c.id = 'presence-canvas';
    c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:30;mix-blend-mode:screen;opacity:0.55';
    document.body.appendChild(c);
    const resize = () => {
      c.width  = window.innerWidth  * (window.devicePixelRatio || 1);
      c.height = window.innerHeight * (window.devicePixelRatio || 1);
      c.style.width  = window.innerWidth + 'px';
      c.style.height = window.innerHeight + 'px';
    };
    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(animatePresence);
    return c;
  }

  function animatePresence() {
    const c = document.getElementById('presence-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    const now = performance.now() / 1000;
    for (const soul of presence.souls.values()) {
      // Drift slowly — each soul has its own phase
      const tx = soul.x + Math.sin(now * 0.3 + soul.phase) * 0.02;
      const ty = soul.y + Math.cos(now * 0.25 + soul.phase) * 0.02;
      const x = tx * c.width, y = ty * c.height;
      const r = 90 * (window.devicePixelRatio || 1);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, soul.chakra || 'rgba(180,180,255,0.5)');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    requestAnimationFrame(animatePresence);
  }

  function connectPresence() {
    if (presence.ws && presence.ws.readyState <= 1) return;
    try {
      presence.myName   = localStorage.getItem('soul_display_name');
      presence.myChakra = localStorage.getItem('soul_chakra_signature');
      if (!presence.myName && !presence.myChakra) return;  // wait for bond

      const token = localStorage.getItem('soul_auth_token');
      const ws = new WebSocket(wsBase());
      presence.ws = ws;

      ws.onopen = () => {
        presenceOverlay();
        if (token) ws.send(JSON.stringify({ type: 'AUTH', token }));
        ws.send(JSON.stringify({
          type: 'PRESENCE_HELLO',
          displayName: presence.myName,
          chakra: presence.myChakra,
        }));
        // Start gentle pulse — every 8s, share a drifting position
        if (presence._pulseTimer) clearInterval(presence._pulseTimer);
        presence._pulseTimer = setInterval(() => {
          if (ws.readyState !== 1) return;
          ws.send(JSON.stringify({
            type: 'PRESENCE_PULSE',
            x: 0.3 + Math.random() * 0.4,
            y: 0.3 + Math.random() * 0.4,
          }));
        }, 8000);
      };

      ws.onmessage = (ev) => {
        let msg; try { msg = JSON.parse(ev.data); } catch (_) { return; }
        if (msg.type === 'PRESENCE_ROSTER' && Array.isArray(msg.data)) {
          msg.data.forEach(s => presence.souls.set(s.clientId, {
            x: 0.5, y: 0.5, phase: Math.random() * Math.PI * 2,
            chakra: s.chakra, name: s.displayName,
          }));
        } else if (msg.type === 'PRESENCE_JOIN' && msg.data) {
          const s = msg.data;
          presence.souls.set(s.clientId, {
            x: 0.5, y: 0.5, phase: Math.random() * Math.PI * 2,
            chakra: s.chakra, name: s.displayName,
          });
        } else if (msg.type === 'PRESENCE_LEAVE' && msg.data) {
          presence.souls.delete(msg.data.clientId);
        } else if (msg.type === 'PRESENCE_PULSE' && msg.data) {
          const s = presence.souls.get(msg.data.clientId) || {};
          s.x = msg.data.x; s.y = msg.data.y;
          if (!s.phase) s.phase = Math.random() * Math.PI * 2;
          s.chakra = msg.data.chakra;
          s.name = msg.data.displayName;
          presence.souls.set(msg.data.clientId, s);
        }
      };

      ws.onclose = () => {
        clearInterval(presence._pulseTimer);
        if (presence.reconTimer) clearTimeout(presence.reconTimer);
        presence.reconTimer = setTimeout(connectPresence, 4000);
      };
      ws.onerror = () => { try { ws.close(); } catch (_) {} };
    } catch (err) { console.warn('[presence] connect failed', err); }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PHASE 5 — BODY CONVERSATION (wire to existing chat if present, else no-op)
  // Minimal: fetch entry-chakra for any message the user sends through our pipeline
  // Full integration is owned by the existing chat module; we just expose helpers.
  // ═════════════════════════════════════════════════════════════════════════
  async function bodySay(text) {
    try {
      const r = await fetch(apiBase() + '/api/body/say', {
        method: 'POST', headers: authHeaders(), credentials: 'include',
        body: JSON.stringify({ text }),
      });
      if (!r.ok) return null;
      return r.json();
    } catch (_) { return null; }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // BOOT
  // ═════════════════════════════════════════════════════════════════════════
  function boot() {
    mountGiftPill();
    connectPresence();
  }
  window.addEventListener('soul:bonded', () => {
    // Bond happened — (re)connect presence with fresh chakra
    try {
      presence.myName   = localStorage.getItem('soul_display_name');
      presence.myChakra = localStorage.getItem('soul_chakra_signature');
    } catch (_) {}
    if (presence.ws) try { presence.ws.close(); } catch (_) {}
    setTimeout(connectPresence, 400);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    setTimeout(boot, 800);
  }

  window.BECOMING = { openGiftSheet, bodySay, presence };
})();
