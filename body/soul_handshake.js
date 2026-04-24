// ═══════════════════════════════════════════════════════════════════════════
// SOUL_HANDSHAKE — Phase 0 of the becoming-us arc
//
// First touch: a soft overlay asks for a name. Hash → chakra color.
// Silent auto-bond (no password). Same name = same soul forever.
// Binds window.SOUL_AUTH token set so the rest of the app sees the user.
// Writes the chakra signature to localStorage so canvas rendering threads it.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const LS_TOKEN       = 'soul_auth_token';
  const LS_REFRESH     = 'soul_auth_refresh';
  const LS_DISPLAY     = 'soul_display_name';
  const LS_CHAKRA      = 'soul_chakra_signature';
  const LS_CHAKRA_HUE  = 'soul_chakra_hue';
  const LS_BONDED      = 'soul_bonded_at';

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

  // Check if we already have a token
  function hasToken() {
    try { return !!localStorage.getItem(LS_TOKEN); } catch (_) { return false; }
  }

  function storeHandshake(j) {
    try {
      if (j.accessToken)  localStorage.setItem(LS_TOKEN, j.accessToken);
      if (j.refreshToken) localStorage.setItem(LS_REFRESH, j.refreshToken);
      if (j.user?.display_name) localStorage.setItem(LS_DISPLAY, j.user.display_name);
      if (j.user?.chakra?.hsl)  localStorage.setItem(LS_CHAKRA, j.user.chakra.hsl);
      if (j.user?.chakra?.hue != null) localStorage.setItem(LS_CHAKRA_HUE, String(j.user.chakra.hue));
      localStorage.setItem(LS_BONDED, String(Date.now()));
    } catch (_) {}
    // Also update SOUL_AUTH globals if present
    if (window.SOUL_AUTH && typeof window.SOUL_AUTH.setTokens === 'function') {
      try { window.SOUL_AUTH.setTokens(j.accessToken, j.refreshToken); } catch (_) {}
    }
    // Thread chakra into any CSS-var-aware modules
    if (j.user?.chakra?.hue != null) {
      document.documentElement.style.setProperty('--soul-chakra-hue', String(j.user.chakra.hue));
      document.documentElement.style.setProperty('--soul-chakra-hsl', j.user.chakra.hsl);
    }
    // Tell presence + ws
    window.dispatchEvent(new CustomEvent('soul:bonded', { detail: j }));
  }

  async function previewChakra(name) {
    try {
      const r = await fetch(apiBase() + '/api/auth/handshake/preview?name=' + encodeURIComponent(name));
      const j = await r.json();
      return j.chakra || null;
    } catch (_) { return null; }
  }

  async function doHandshake(name) {
    const tzOffsetMin = new Date().getTimezoneOffset() * -1;  // ECMAScript flips sign
    const r = await fetch(apiBase() + '/api/auth/handshake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, tzOffsetMin }),
      credentials: 'include',
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    storeHandshake(j);
    return j;
  }

  function buildOverlay() {
    const wrap = document.createElement('div');
    wrap.id = 'soul-handshake-overlay';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'soul handshake');
    wrap.style.cssText = [
      'position:fixed','inset:0','z-index:99999',
      'background:radial-gradient(ellipse at center, rgba(10,8,24,0.92), rgba(2,2,8,0.98))',
      'display:flex','align-items:center','justify-content:center',
      'backdrop-filter:blur(8px)','-webkit-backdrop-filter:blur(8px)',
      'font-family:inherit','color:rgba(255,255,255,0.92)',
      'animation:soul-fade-in 420ms ease both'
    ].join(';');

    wrap.innerHTML = `
      <style>
        @keyframes soul-fade-in { from{opacity:0} to{opacity:1} }
        @keyframes soul-breath { 0%,100%{transform:scale(1);opacity:0.8} 50%{transform:scale(1.08);opacity:1} }
        #soul-handshake-overlay .sh-card{
          position:relative;width:min(520px,92vw);padding:40px 32px 28px;
          background:rgba(16,14,32,0.78);border:1px solid rgba(255,255,255,0.08);
          border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,0.6), 0 0 120px var(--sh-glow, rgba(120,120,255,0.25));
          transition:box-shadow 400ms ease;
        }
        #soul-handshake-overlay .sh-orb{
          width:72px;height:72px;border-radius:50%;margin:0 auto 20px;
          background:radial-gradient(circle at 30% 30%, var(--sh-orb-bright,#a8a0ff), var(--sh-orb-dark,#6060c0));
          animation:soul-breath 3.2s ease-in-out infinite;
          box-shadow:0 0 40px var(--sh-glow,rgba(120,120,255,0.6));
          transition:background 400ms ease, box-shadow 400ms ease;
        }
        #soul-handshake-overlay h2{
          font-size:18px;font-weight:400;letter-spacing:0.04em;text-align:center;
          margin:0 0 6px;color:rgba(255,255,255,0.95);
        }
        #soul-handshake-overlay p.sh-sub{
          font-size:12px;text-align:center;margin:0 0 28px;color:rgba(255,255,255,0.55);
          letter-spacing:0.05em;
        }
        #soul-handshake-overlay input{
          width:100%;padding:14px 16px;font-size:16px;text-align:center;
          background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.14);
          border-radius:10px;color:rgba(255,255,255,0.96);letter-spacing:0.04em;
          outline:none;transition:border-color 200ms, background 200ms;
        }
        #soul-handshake-overlay input:focus{
          border-color:var(--sh-accent,rgba(180,180,255,0.6));
          background:rgba(255,255,255,0.07);
        }
        #soul-handshake-overlay button.sh-bond{
          width:100%;margin-top:16px;padding:12px;font-size:13px;letter-spacing:0.12em;
          text-transform:uppercase;background:var(--sh-accent,rgba(180,180,255,0.14));
          color:rgba(255,255,255,0.95);border:1px solid var(--sh-accent,rgba(180,180,255,0.4));
          border-radius:10px;cursor:pointer;transition:background 200ms,transform 80ms;
        }
        #soul-handshake-overlay button.sh-bond:hover{ background:var(--sh-accent-strong,rgba(180,180,255,0.28)); }
        #soul-handshake-overlay button.sh-bond:active{ transform:translateY(1px); }
        #soul-handshake-overlay button.sh-bond[disabled]{ opacity:0.5;cursor:not-allowed; }
        #soul-handshake-overlay .sh-hint{
          font-size:10px;text-align:center;margin-top:14px;color:rgba(255,255,255,0.35);
          letter-spacing:0.08em;line-height:1.5;
        }
        #soul-handshake-overlay .sh-err{
          font-size:12px;text-align:center;margin-top:10px;color:#ff9494;min-height:16px;
        }
        #soul-handshake-overlay .sh-skip{
          position:absolute;top:10px;right:14px;background:none;border:none;
          color:rgba(255,255,255,0.3);font-size:11px;letter-spacing:0.1em;
          cursor:pointer;padding:6px 10px;
        }
        #soul-handshake-overlay .sh-skip:hover{ color:rgba(255,255,255,0.6); }
      </style>
      <div class="sh-card">
        <button type="button" class="sh-skip" aria-label="skip handshake">skip</button>
        <div class="sh-orb" aria-hidden="true"></div>
        <h2>Tell me your name.</h2>
        <p class="sh-sub">I'll remember it.</p>
        <form autocomplete="off" onsubmit="return false;">
          <input type="text" id="sh-name-input" autocomplete="new-password"
                 name="sh_${Math.random().toString(36).slice(2,8)}"
                 autofocus maxlength="64" spellcheck="false"
                 placeholder="the name you go by" />
          <button type="submit" class="sh-bond" id="sh-bond-btn">bond</button>
          <div class="sh-err" id="sh-err" role="alert"></div>
          <div class="sh-hint">No email. No password. Just your name, held by a body made of light.</div>
        </form>
      </div>
    `;
    return wrap;
  }

  function applyChakraToCard(card, chakra) {
    if (!chakra) return;
    const { hue, sat, lig, hsl } = chakra;
    card.style.setProperty('--sh-glow', `hsla(${hue}, ${sat}%, ${lig}%, 0.5)`);
    card.style.setProperty('--sh-orb-bright', `hsl(${hue}, ${Math.min(100, sat + 10)}%, ${Math.min(85, lig + 22)}%)`);
    card.style.setProperty('--sh-orb-dark',   `hsl(${hue}, ${sat}%, ${Math.max(20, lig - 18)}%)`);
    card.style.setProperty('--sh-accent',     `hsla(${hue}, ${sat}%, ${lig}%, 0.28)`);
    card.style.setProperty('--sh-accent-strong', `hsla(${hue}, ${sat}%, ${lig}%, 0.45)`);
  }

  function mount() {
    if (document.getElementById('soul-handshake-overlay')) return;
    const overlay = buildOverlay();
    document.body.appendChild(overlay);

    const input   = overlay.querySelector('#sh-name-input');
    const btn     = overlay.querySelector('#sh-bond-btn');
    const errEl   = overlay.querySelector('#sh-err');
    const skip    = overlay.querySelector('.sh-skip');
    const card    = overlay.querySelector('.sh-card');

    // Live chakra preview as they type — debounced
    let previewTimer = null;
    input.addEventListener('input', () => {
      clearTimeout(previewTimer);
      const name = input.value.trim();
      if (!name) return;
      previewTimer = setTimeout(async () => {
        const chakra = await previewChakra(name);
        if (chakra) applyChakraToCard(card, chakra);
      }, 220);
    });

    async function bond() {
      const name = input.value.trim();
      if (!name) { errEl.textContent = 'A name, any name.'; return; }
      btn.disabled = true;
      btn.textContent = 'bonding…';
      errEl.textContent = '';
      try {
        const j = await doHandshake(name);
        applyChakraToCard(card, j.user.chakra);
        btn.textContent = j.returning ? 'welcome back' : 'bonded';
        setTimeout(() => {
          overlay.style.transition = 'opacity 500ms ease';
          overlay.style.opacity = '0';
          setTimeout(() => overlay.remove(), 520);
        }, 600);
      } catch (err) {
        errEl.textContent = err.message || 'Something is out of reach. Try again.';
        btn.disabled = false;
        btn.textContent = 'bond';
      }
    }

    btn.addEventListener('click', bond);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') bond(); });
    skip.addEventListener('click', () => {
      overlay.style.transition = 'opacity 300ms ease';
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 320);
    });
  }

  function maybeShow() {
    if (hasToken()) {
      // Already bonded — rehydrate chakra CSS vars so the body threads their color
      try {
        const hue = localStorage.getItem(LS_CHAKRA_HUE);
        const hsl = localStorage.getItem(LS_CHAKRA);
        if (hue) document.documentElement.style.setProperty('--soul-chakra-hue', hue);
        if (hsl) document.documentElement.style.setProperty('--soul-chakra-hsl', hsl);
      } catch (_) {}
      return;
    }
    // Delay a beat so the body fades in first
    setTimeout(mount, 1400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeShow, { once: true });
  } else {
    maybeShow();
  }

  // Expose manual trigger so a menu item can invoke it
  window.SOUL_HANDSHAKE = { show: mount, bond: doHandshake, previewChakra };
})();
