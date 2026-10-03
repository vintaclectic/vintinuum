// ════════════════════════════════════════════════════════════════════════════
// ★ THE MERCATUS COSMOS — the trading universe rendered as a living galaxy
//   whose only physics is PROFIT.  (task 8589YGC — AETHERHOLD, the world-forger)
// ════════════════════════════════════════════════════════════════════════════
//
// A sibling in soul to the council task-board cosmos (vintask-gui.html), forged
// fresh in its own code and themed entirely around the real Vintinuum trading
// environment (/api/trading/* + /api/sentiment/*).  The map:
//
//   • the TREASURY / account equity  = the GALACTIC CORE (central gravity well).
//   • a WATCHED SYMBOL               = a STAR orbiting the core. hue = sentiment
//       (bull → gold/green, bear → red, neutral → blue); size = conviction
//       (confidence) + its PROFIT CONTRIBUTION, so winners physically shine.
//   • an OPEN POSITION / holding     = a PLANET orbiting its symbol-star. orbit
//       radius ∝ exposure (cost basis); ring thickness ∝ size.
//   • a DECISION / trade in history  = a COMET of light igniting from the star at
//       its timestamp. BUY = inbound toward the star, SELL = outbound. Scrub the
//       TIME CURSOR T and the whole portfolio history re-forms as a time-lapse.
//   • a PENDING APPROVAL             = a PULSING PURPLE body "AWAITING LORD VINTA"
//       (council needs-human purple #8B5CF6) — impossible to miss, because it is
//       the one thing only Vinta can decide.
//   • SENTIMENT lanes (reddit/news/price/brain) = faint constellation threads
//       from each star, so you can see WHY a star is hot.
//   • the STRATEGY circuit breaker OPEN = a red warning aura on the core.
//
// "ANYTHING THAT HAPPENS HAPPENS FOR A PROFIT" is the literal physics here:
// profit is LIGHT. Realized gains tint the core gold and ripple outward; every
// star is weighted by what it makes, so the eye is pulled to the money. Loss
// dims. The whole scene reads as a machine built for one purpose, beautifully.
//
// ── HONESTY (No-Guessing / No-Fabrication) ──────────────────────────────────
// Every /api/trading/* route is OWNER-ONLY and the brain may be offline, in
// paper mode, or Robinhood-unlinked. So:
//   • real endpoints answer → render the REAL galaxy, badged PAPER or LIVE;
//     numbers we cannot derive (equity when the broker shape is unknown,
//     unrealized P&L without a live mark) are shown as "—", never invented.
//   • endpoints fail (403/offline/empty) → render a clearly-labelled DEMO SKY:
//     a seeded, deterministic, gorgeous constellation of the default watchlist
//     with plausible-but-FAKE motion and an unmissable "DEMO SKY" badge. Demo
//     numbers are tagged DEMO and never presented as measured.
//   • lanes degrade independently — a dead lane is dropped, never faked.
//
// ── RETENTION DOCTRINE (seven tests) ─────────────────────────────────────────
//  1 Generous-not-predatory  — the live sky + present P&L are the free hook; no
//    dark pattern, the demo is honest about being a demo.
//  2 Feeds the investment loop — the comet history COMPOUNDS: every trade adds a
//    light to your personal galaxy, raising the cost of ever leaving it.
//  3 Tier-aware — the present moment is FREE (Free hook). Deep scrubbable P&L
//    history + mood-weighted playback is the Companion/Theater depth. We never
//    hard-gate the live now; the ladder lives in this comment, not a paywall.
//  4 Aesthetically dense — one glance tells you what's making money. No filler.
//  5 Open loop of meaning — the time cursor ends at NOW with pending bodies
//    pulsing: what's coming next is always unresolved, always pulling you back.
//  6 Flagged + measured — a single rAF loop, cancellable, DPR-capped; a demo flag
//    the surface wears openly; every number carries its provenance.
//  7 Makes it ALIVE — the galaxy breathes, trades streak, gains ripple; it is a
//    living organism of money, not a dashboard.
//
// ── ENGINEERING LAWS ─────────────────────────────────────────────────────────
//   • ONE requestAnimationFrame loop, cancelled on document.hidden + window blur,
//     resumed on visible/focus. DPR capped at 2. prefers-reduced-motion → a
//     single still composed frame, no animation.
//   • Collision-proof by construction: canvas is the backdrop (an explicit,
//     intended overlay surface, like a modal backdrop); the DOM HUD lives in
//     non-overlapping flex regions that each own their box and scroll internally.
//     Canvas text obeys No-Collision too — see labelPass().
// ════════════════════════════════════════════════════════════════════════════

(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  // ── palette ────────────────────────────────────────────────────────────────
  const PAL = {
    gold: '#FFD700', amber: '#F5A623',
    gain: '#22C55E', gainDeep: '#14B8A6',
    loss: '#DC2626', lossDeep: '#B91C1C',
    bull: '#FCD34D', bear: '#F87171', neutral: '#60A5FA',
    pending: '#8B5CF6', pendingSoft: 'rgba(139,92,246,',
    coreHot: '#FFF6D8', ink: '#07060a',
    goldRGB: 'rgba(255,215,0,', amberRGB: 'rgba(245,166,35,',
    gainRGB: 'rgba(34,197,94,', lossRGB: 'rgba(220,38,38,',
    neutralRGB: 'rgba(96,165,250,',
  };
  const DEFAULT_WATCHLIST = ['SPY', 'QQQ', 'AAPL', 'NVDA', 'TSLA', 'AMD', 'MSFT'];
  const GOLDEN = 2.399963229728653;
  const TAU = 6.283185307179586;

  // ── module state ─────────────────────────────────────────────────────────────
  const MX = {
    canvas: null, ctx: null, dpr: 1, W: 0, H: 0,
    raf: 0, running: false, reduced: false, last: 0, tick: 0,
    view: { x: 0, y: 0, k: 1, tx: 0, ty: 0, tk: 1 }, // current + target (eased)
    model: null, nebulae: [], stars: [], // decorative starfield
    hover: null, sel: null, web: new Set(), webNodes: new Set(),
    T: 1, playing: false, dur: 26000, // ms to replay whole history
    nodes: [], // hit-testable: suns, planets, pending, core
    pulses: [], // profit ripples
    pointer: { down: false, moved: false, x: 0, y: 0, lx: 0, ly: 0, id: null },
    pinch: { active: false, d0: 0, k0: 1 },
    loaded: false, loading: false, err: null,
    dom: {},
  };
  window.MERCATUS = MX;

  // ── small math ────────────────────────────────────────────────────────────────
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmtUSD = (v, signed) => {
    if (v == null || !isFinite(v)) return '—';
    const s = (signed && v > 0 ? '+' : '') + '$' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    return v < 0 ? '-' + s.replace('$', '$') : s;
  };
  const fmtPct = (v) => (v == null || !isFinite(v)) ? '—' : (v).toFixed(1) + '%';

  // deterministic hash → stable layout/colour per id across reloads
  function hash(str) {
    let h = 2166136261 >>> 0; const s = String(str || '');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  const rnd = (id, salt) => (hash(id + '|' + salt) % 100000) / 100000;

  // ══════════════════════════════════════════════════════════════════════════
  // API — owner-only, auth-attached, timeout-bounded, degrade-friendly
  // ══════════════════════════════════════════════════════════════════════════
  function apiBase() {
    return window.__VINTINUUM_API_BASE || window.VINTINUUM_API || window.__VINT_API ||
      (location.hostname && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1'
        ? 'https://api.vintaclectic.com' : 'http://localhost:8767');
  }
  function token() {
    try {
      if (window.SOUL_AUTH && typeof window.SOUL_AUTH.token === 'function') {
        const t = window.SOUL_AUTH.token(); if (t) return t;
      }
    } catch (_) {}
    const keys = ['soul_auth_token', 'vint_access_token', 'vint_token', 'access_token', 'token', 'vint:token'];
    for (const k of keys) { try { const v = localStorage.getItem(k); if (v) return v; } catch (_) {} }
    return null;
  }
  async function api(path) {
    const headers = { 'Accept': 'application/json' };
    const t = token(); if (t) headers['Authorization'] = 'Bearer ' + t;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 9000);
    try {
      const r = await fetch(apiBase() + path, { headers, signal: ctrl.signal, credentials: 'omit' });
      clearTimeout(to);
      if (!r.ok) return { __err: r.status };
      return await r.json();
    } catch (_) { clearTimeout(to); return { __err: 'network' }; }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DATA LAYER — fetch the real universe, or seed a demo sky
  // ══════════════════════════════════════════════════════════════════════════
  async function loadUniverse() {
    MX.loading = true;
    const [state, accounting, analytics, pending, strat, signals, portfolio, history] = await Promise.all([
      api('/api/trading/state'),
      api('/api/trading/accounting'),
      api('/api/trading/analytics'),
      api('/api/trading/pending'),
      api('/api/trading/strategy/status'),
      api('/api/sentiment/trading-signals'),
      api('/api/trading/portfolio'),
      api('/api/trading/history?limit=200'),
    ]);
    MX.loading = false;

    // If /state itself failed, the surface is gated/offline → an honest DEMO SKY.
    if (!state || state.__err) {
      const reason = !state ? 'offline' : (state.__err === 403 ? 'owner-only' : state.__err);
      return buildModel(seedDemo(reason));
    }
    return buildModel(normalizeReal({ state, accounting, analytics, pending, strat, signals, portfolio, history }));
  }

  // defensively pull an equity-ish number out of the raw broker portfolio shape
  function parseEquity(pf) {
    if (!pf || pf.__err || pf.error || typeof pf !== 'object') return null;
    const keys = ['extended_hours_equity', 'equity', 'total_equity', 'portfolio_value',
      'market_value', 'total_market_value', 'equity_value', 'total_value'];
    for (const k of keys) {
      const v = Number(pf[k]);
      if (isFinite(v) && v !== 0) return v;
    }
    return null;
  }
  function parseBuyingPower(pf) {
    if (!pf || pf.__err || pf.error || typeof pf !== 'object') return null;
    for (const k of ['buying_power', 'buyingPower', 'cash', 'withdrawable_amount']) {
      const v = Number(pf[k]); if (isFinite(v)) return v;
    }
    return null;
  }

  function normalizeReal(d) {
    const s = d.state || {};
    const mode = (s.mode === 'live') ? 'live' : 'paper';
    const circuitOpen = !!(s.circuit && (s.circuit.state === 'open' || s.circuit.open)) ||
      !!(d.strat && d.strat.circuit && (d.strat.circuit.state === 'open' || d.strat.circuit.open));

    const watchlist = (d.strat && !d.strat.__err && d.strat.config && Array.isArray(d.strat.config.watchlist) && d.strat.config.watchlist.length)
      ? d.strat.config.watchlist.slice() : DEFAULT_WATCHLIST.slice();

    // sentiment signals → map
    const sigMap = {};
    if (d.signals && !d.signals.__err && Array.isArray(d.signals.signals)) {
      for (const sg of d.signals.signals) {
        if (!sg || !sg.symbol) continue;
        const c = sg.components || {};
        sigMap[sg.symbol] = {
          action: sg.action || 'HOLD', score: num(sg.score), conf: num(sg.confidence),
          lanes: {
            reddit: c.sentiment && c.sentiment.reddit ? num(c.sentiment.reddit.score) : null,
            news: c.sentiment && c.sentiment.news ? num(c.sentiment.news.score) : null,
            price: c.price ? num(c.price.score) : null,
            brain: c.brain ? num(c.brain.score) : null,
          },
          reasons: Array.isArray(sg.reasons) ? sg.reasons.slice(0, 3) : [],
        };
      }
    }

    // positions (real, broker-verified: {symbol, quantity, avgPrice})
    let positions = [];
    if (d.accounting && !d.accounting.__err && d.accounting.tracked && d.accounting.openPositions) {
      positions = (d.accounting.openPositions.items || []).map((p) => ({
        sym: p.symbol, qty: num(p.quantity), avgPrice: num(p.avgPrice),
        exposure: (isFinite(p.quantity) && isFinite(p.avgPrice)) ? p.quantity * p.avgPrice : null,
        unrealized: null, // no live mark available from this shape — honestly unknown
      })).filter((p) => p.sym);
    }

    // pending approvals
    let pending = [];
    if (d.pending && !d.pending.__err && Array.isArray(d.pending.pending)) {
      pending = d.pending.pending.map((it) => {
        const dc = it.decision || {};
        return {
          id: it.id, action: (dc.action || '').toUpperCase() || '?', sym: dc.symbol || '?',
          qty: num(dc.quantity), price: num(dc.price), exposure: num(it.exposure),
          reasoning: dc.reasoning || '', createdAt: it.createdAt || null,
          ts: it.createdAt ? Date.parse(it.createdAt) : Date.now(),
        };
      }).filter((p) => p.sym);
    }

    // history → comets
    let comets = [];
    if (Array.isArray(d.history)) {
      for (const h of d.history) {
        if (!h) continue;
        const dc = h.decision || h;
        const act = String(h.action || dc.action || h.side || '').toLowerCase();
        const sym = (h.symbol || dc.symbol || '').toUpperCase();
        const ts = h.timestamp ? Date.parse(h.timestamp) : (h.at ? Number(h.at) : NaN);
        if (!sym || !isFinite(ts)) continue;
        const dir = act.indexOf('sell') >= 0 ? 'out' : 'in';
        comets.push({ sym, dir, ts, exposure: num(h.exposure || dc.exposure), status: h.status || h.type || '' });
      }
    }

    // profit readout — only real fields, else null (shown as "—")
    const an = (d.analytics && !d.analytics.__err) ? d.analytics : null;
    const acc = (d.accounting && !d.accounting.__err && d.accounting.tracked) ? d.accounting : null;
    const profit = {
      realizedToday: acc ? num(acc.realizedPnlToday) : null,
      realizedTodayTracked: !!acc,
      strategyRealized: an ? num(an.totalPnL) : null,
      winRate: an ? num(an.winRate) : null,
      totalTrades: an ? num(an.totalTrades) : null,
      wins: an ? num(an.wins) : null, losses: an ? num(an.losses) : null,
      equity: parseEquity(d.portfolio),
      buyingPower: parseBuyingPower(d.portfolio),
      unrealized: null, // not derivable honestly from available shapes
    };

    const symbols = unique([].concat(watchlist, positions.map((p) => p.sym), Object.keys(sigMap),
      comets.map((c) => c.sym), pending.map((p) => p.sym)));

    return {
      demo: false, demoReason: null, mode, circuitOpen,
      symbols, sigMap, positions, pending, comets, profit,
      engineRunning: !!(d.strat && d.strat.running),
      scanInterval: (d.strat && d.strat.config && d.strat.config.scanInterval) || null,
      sources: buildSources(d),
      accountConfigured: !!s.accountConfigured,
      linked: !!(s.link && s.link.linked),
    };
  }

  function buildSources(d) {
    const out = {};
    const put = (name, resp) => { out[name] = (!resp || resp.__err) ? { ok: false, why: resp && resp.__err } : { ok: true }; };
    put('state', d.state); put('accounting', d.accounting); put('analytics', d.analytics);
    put('pending', d.pending); put('strategy', d.strat); put('sentiment', d.signals);
    put('portfolio', d.portfolio);
    return out;
  }

  // ── DEMO SKY — seeded, deterministic, beautiful, HONEST about being fake ──────
  function seedDemo(reason) {
    const sigMap = {}, positions = [], comets = [];
    const actByIdx = ['BUY', 'BUY', 'HOLD', 'BUY', 'SELL', 'HOLD', 'BUY'];
    const now = Date.now();
    DEFAULT_WATCHLIST.forEach((sym, i) => {
      const a = actByIdx[i % actByIdx.length];
      const base = (rnd(sym, 'score') * 2 - 1);
      const score = a === 'BUY' ? Math.abs(base) * 0.8 + 0.08 : a === 'SELL' ? -(Math.abs(base) * 0.8 + 0.08) : base * 0.2;
      sigMap[sym] = {
        action: a, score: round(score, 3), conf: round(0.45 + rnd(sym, 'conf') * 0.5, 3),
        lanes: {
          reddit: round((rnd(sym, 'r') * 2 - 1) * 0.8, 3),
          news: round((rnd(sym, 'n') * 2 - 1) * 0.7, 3),
          price: round((rnd(sym, 'p') * 2 - 1) * 0.9, 3),
          brain: round((rnd(sym, 'b') * 2 - 1) * 0.6, 3),
        },
        reasons: ['demo signal — seeded, not live'],
      };
      // ~half the sky holds a position
      if (rnd(sym, 'pos') > 0.45) {
        const qty = 1 + Math.floor(rnd(sym, 'q') * 40);
        const avg = 20 + Math.floor(rnd(sym, 'a') * 480);
        const up = (rnd(sym, 'u') * 2 - 1) * avg * qty * 0.12; // DEMO unrealized
        positions.push({ sym, qty, avgPrice: avg, exposure: qty * avg, unrealized: round(up, 2) });
      }
      // a scatter of historical comets across ~20 days
      const n = 2 + Math.floor(rnd(sym, 'cN') * 5);
      for (let j = 0; j < n; j++) {
        const t = now - rnd(sym, 'ct' + j) * 20 * 86400000;
        comets.push({ sym, dir: rnd(sym, 'cd' + j) > 0.55 ? 'out' : 'in', ts: t, exposure: Math.floor(100 + rnd(sym, 'ce' + j) * 4000), status: 'demo' });
      }
    });
    // one unmissable pending
    const psym = 'NVDA';
    const pending = [{
      id: 'demo_p1', action: 'BUY', sym: psym, qty: 3, price: 118.40, exposure: 355.20,
      reasoning: 'DEMO — seeded pending so you can see the AWAITING LORD VINTA body',
      createdAt: new Date(now - 420000).toISOString(), ts: now - 420000,
    }];

    const profit = {
      realizedToday: null, realizedTodayTracked: false,
      strategyRealized: null, winRate: null, totalTrades: null, wins: null, losses: null,
      equity: null, buyingPower: null, unrealized: null,
      demoEquity: 25000, demoRealizedToday: 184.52, demoWinRate: 61.4, demoTrades: 57,
    };

    return {
      demo: true, demoReason: reason, mode: 'demo', circuitOpen: false,
      symbols: DEFAULT_WATCHLIST.slice(), sigMap, positions, pending, comets, profit,
      engineRunning: false, scanInterval: 5, sources: {}, accountConfigured: false, linked: false,
    };
  }

  const num = (v) => { const n = Number(v); return isFinite(n) ? n : null; };
  const round = (v, d) => { const p = Math.pow(10, d || 0); return Math.round(v * p) / p; };
  const unique = (arr) => Array.from(new Set(arr.filter(Boolean)));

  // ══════════════════════════════════════════════════════════════════════════
  // BUILD — turn the normalized universe into a galaxy of nodes
  // ══════════════════════════════════════════════════════════════════════════
  function sentimentHue(action, score) {
    if (action === 'SELL') return PAL.bear;
    if (action === 'BUY') return (score != null && score > 0.4) ? PAL.gain : PAL.bull;
    return PAL.neutral;
  }

  function buildModel(u) {
    MX.model = u;
    MX.nodes = [];
    MX.pulses = [];
    const stars = [];
    const core = { kind: 'core', x: 0, y: 0, r: 46, label: 'TREASURY', u };
    MX.nodes.push(core);

    // profit contribution weight per symbol (drives brightness/size).
    // Real: strategy realized P&L is portfolio-wide, not per-symbol, so per-star
    // weight uses sentiment conviction (what the engine BELIEVES will profit) +
    // exposure. Demo: seeded unrealized. Both are honest about their source.
    const expBySym = {};
    u.positions.forEach((p) => { expBySym[p.sym] = (expBySym[p.sym] || 0) + (p.exposure || 0); });
    const maxExp = Math.max(1, ...Object.values(expBySym));

    const syms = u.symbols.slice(0, 24); // keep the sky composed, cap the hairball
    syms.forEach((sym, i) => {
      const ang = i * GOLDEN + rnd(sym, 'a') * 0.4;
      const ring = 220 + i * 46 + rnd(sym, 'rr') * 24;
      const x = Math.cos(ang) * ring, y = Math.sin(ang) * ring;
      const sig = u.sigMap[sym] || { action: 'HOLD', score: null, conf: null, lanes: {}, reasons: [] };
      const conv = (sig.conf != null ? sig.conf : 0.4);
      const profitW = clamp(0.35 + conv * 0.65 + (expBySym[sym] ? (expBySym[sym] / maxExp) * 0.5 : 0), 0.2, 1.6);
      const star = {
        kind: 'star', sym, x, y, ang, ring,
        radius: 9 + profitW * 11,
        hue: sentimentHue(sig.action, sig.score),
        action: sig.action, score: sig.score, conf: sig.conf, lanes: sig.lanes, reasons: sig.reasons,
        profitW, born: 0, planets: [], twinkle: rnd(sym, 'tw') * TAU,
      };
      stars.push(star); MX.nodes.push(star);
    });
    const starBy = {}; stars.forEach((s) => (starBy[s.sym] = s));

    // planets = positions
    u.positions.forEach((p, idx) => {
      const star = starBy[p.sym]; if (!star) return;
      const slot = star.planets.length;
      const orad = star.radius + 26 + slot * 20 + clamp((p.exposure || 0) / 2000, 0, 60);
      const planet = {
        kind: 'planet', sym: p.sym, star, orad,
        oang: rnd(p.sym + idx, 'po') * TAU, ospeed: (0.00018 + rnd(p.sym + idx, 'ps') * 0.0003) * (rnd(p.sym, 'dir') > 0.5 ? 1 : -1),
        r: 3.4 + clamp((p.exposure || 0) / 1500, 0, 7),
        qty: p.qty, avgPrice: p.avgPrice, exposure: p.exposure, unrealized: p.unrealized,
        x: 0, y: 0, born: 0,
      };
      star.planets.push(planet); MX.nodes.push(planet);
    });

    // pending = pulsing purple bodies in a prominent inner ring around the core
    u.pending.forEach((p, i) => {
      const ang = (i / Math.max(1, u.pending.length)) * TAU + 0.3;
      const rad = 120 + (i % 2) * 34;
      const body = {
        kind: 'pending', ...p, x: Math.cos(ang) * rad, y: Math.sin(ang) * rad,
        baseAng: ang, baseRad: rad, r: 11, born: 0,
      };
      MX.nodes.push(body);
    });
    u.pendingBodies = MX.nodes.filter((n) => n.kind === 'pending');

    // comets = history, bound to their star, igniting by timestamp
    const cs = u.comets.filter((c) => starBy[c.sym]);
    let tMin = Infinity, tMax = -Infinity;
    cs.forEach((c) => { if (c.ts < tMin) tMin = c.ts; if (c.ts > tMax) tMax = c.ts; });
    u.pending.forEach((p) => { if (p.ts < tMin) tMin = p.ts; });
    if (!isFinite(tMin)) { tMin = Date.now() - 86400000; }
    tMax = Date.now();
    u.tRange = [tMin, tMax];
    u.cometList = cs.map((c, i) => {
      const star = starBy[c.sym];
      const ang = rnd(c.sym + i, 'ca') * TAU;
      const far = star.radius + 140 + rnd(c.sym + i, 'cf') * 120;
      return { ...c, star, ang, far, key: i };
    });

    MX.stars2 = stars;
    MX.starBy = starBy;

    // decorative starfield + nebulae (seeded once, independent of data)
    if (!MX.nebulae.length) seedBackdrop();

    MX.loaded = true;
    bindHUD();
    fitView(true);
    return u;
  }

  function seedBackdrop() {
    MX.nebulae = [];
    for (let i = 0; i < 6; i++) {
      MX.nebulae.push({
        x: (rnd('neb', i + 'x') * 2 - 1) * 900, y: (rnd('neb', i + 'y') * 2 - 1) * 700,
        r: 300 + rnd('neb', i + 'r') * 520, h: [45, 42, 265, 160, 48, 280][i] || 48,
        a: 0.03 + rnd('neb', i + 'a') * 0.05, z: 0.3 + rnd('neb', i + 'z') * 0.4,
      });
    }
    MX.stars = [];
    for (let i = 0; i < 260; i++) {
      MX.stars.push({
        x: (rnd('bg', i + 'x') * 2 - 1) * 2200, y: (rnd('bg', i + 'y') * 2 - 1) * 1700,
        r: 0.4 + rnd('bg', i + 'r') * 1.3, h: rnd('bg', i + 'h') > 0.85 ? 45 : 210,
        z: 0.2 + rnd('bg', i + 'z') * 0.7, tw: rnd('bg', i + 't') * TAU,
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW — pan / zoom with eased camera
  // ══════════════════════════════════════════════════════════════════════════
  function fitView(instant) {
    let ext = 300;
    MX.nodes.forEach((n) => { if (n.kind === 'star') ext = Math.max(ext, Math.hypot(n.x, n.y) + n.orad2 || Math.hypot(n.x, n.y) + 80); });
    MX.stars2 && MX.stars2.forEach((s) => {
      ext = Math.max(ext, s.ring + 90);
      s.planets.forEach((p) => { ext = Math.max(ext, s.ring + p.orad); });
    });
    const pad = 1.18;
    const k = clamp(Math.min(MX.W, MX.H) / (2 * ext * pad), 0.08, 2.2);
    MX.view.tx = 0; MX.view.ty = 0; MX.view.tk = k;
    if (instant) { MX.view.x = 0; MX.view.y = 0; MX.view.k = k; }
  }
  const toScreen = (x, y) => ({ x: (x - MX.view.x) * MX.view.k + MX.W / 2, y: (y - MX.view.y) * MX.view.k + MX.H / 2 });
  const toWorld = (sx, sy) => ({ x: (sx - MX.W / 2) / MX.view.k + MX.view.x, y: (sy - MX.H / 2) / MX.view.k + MX.view.y });

  // ══════════════════════════════════════════════════════════════════════════
  // TIME — the galaxy is a function of T
  // ══════════════════════════════════════════════════════════════════════════
  function nowT() {
    if (!MX.model || !MX.model.tRange) return Date.now();
    const [a, b] = MX.model.tRange;
    return a + (b - a) * MX.T;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // POSITIONS — advance planet / pending orbits
  // ══════════════════════════════════════════════════════════════════════════
  function advance(dt) {
    const sp = MX.reduced ? 0 : dt;
    MX.stars2 && MX.stars2.forEach((s) => {
      s.planets.forEach((p) => {
        p.oang += p.ospeed * sp;
        p.x = s.x + Math.cos(p.oang) * p.orad;
        p.y = s.y + Math.sin(p.oang) * p.orad;
      });
    });
    if (MX.model && MX.model.pendingBodies) {
      MX.model.pendingBodies.forEach((b, i) => {
        const wob = MX.reduced ? 0 : Math.sin(MX.tick * 0.0012 + i) * 10;
        b.x = Math.cos(b.baseAng) * (b.baseRad + wob);
        b.y = Math.sin(b.baseAng) * (b.baseRad + wob);
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DRAW
  // ══════════════════════════════════════════════════════════════════════════
  function draw(dt) {
    const ctx = MX.ctx; if (!ctx) return;
    const W = MX.W, H = MX.H, k = MX.view.k;
    MX.tick += MX.reduced ? 0 : dt;
    const tk = MX.tick;

    // ease camera toward target
    MX.view.x = lerp(MX.view.x, MX.view.tx, 0.12);
    MX.view.y = lerp(MX.view.y, MX.view.ty, 0.12);
    MX.view.k = lerp(MX.view.k, MX.view.tk, 0.12);

    advance(dt);
    const T = nowT();
    const u = MX.model;

    // background void
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = PAL.ink; ctx.fillRect(0, 0, W, H);

    // nebulae
    ctx.globalCompositeOperation = 'lighter';
    for (const n of MX.nebulae) {
      const p = toScreen(n.x * 1, n.y * 1);
      const rr = n.r * k * n.z;
      if (p.x + rr < 0 || p.x - rr > W || p.y + rr < 0 || p.y - rr > H) continue;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
      g.addColorStop(0, 'hsla(' + n.h + ',70%,55%,' + n.a + ')');
      g.addColorStop(1, 'hsla(' + n.h + ',70%,45%,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.fill();
    }
    // parallax starfield
    for (const s of MX.stars) {
      const p = toScreen(s.x * s.z, s.y * s.z);
      if (p.x < -4 || p.x > W + 4 || p.y < -4 || p.y > H + 4) continue;
      const tw = MX.reduced ? 0.7 : (0.55 + 0.45 * Math.sin(tk * 0.0011 + s.tw));
      ctx.fillStyle = 'hsla(' + s.h + ',80%,' + (s.h === 45 ? 78 : 82) + '%,' + (tw * 0.6 * s.z + 0.07) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, s.r * clamp(k, 0.6, 1.6), 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    const dimmed = !!(MX.sel || MX.hover);
    const focus = MX.sel || MX.hover;

    drawCore(ctx, dt, dimmed, focus);
    drawOrbitRings(ctx, k, dimmed);
    drawProfitThreads(ctx, tk, dimmed, focus);
    if (focus && focus.kind === 'star') drawSentimentLanes(ctx, focus, tk);
    drawComets(ctx, tk, T, dimmed, focus);
    drawPulses(ctx, dt);

    // collision-safe canvas labels: collect, place, then paint
    const labels = [];
    const occupied = [];

    drawStars(ctx, k, tk, dimmed, focus, labels, occupied);
    drawPlanets(ctx, k, tk, dimmed, focus, labels, occupied);
    drawPending(ctx, k, tk, dimmed, focus, labels, occupied);

    labelPass(ctx, labels, occupied);
  }

  function coreTint(u) {
    const rt = u.demo ? (u.profit.demoRealizedToday) : u.profit.realizedToday;
    if (rt == null) return { rgb: PAL.goldRGB, sign: 0 };
    if (rt > 0) return { rgb: PAL.gainRGB, sign: 1 };
    if (rt < 0) return { rgb: PAL.lossRGB, sign: -1 };
    return { rgb: PAL.goldRGB, sign: 0 };
  }

  function drawCore(ctx, dt, dimmed, focus) {
    const u = MX.model; const p = toScreen(0, 0); const k = MX.view.k;
    const tint = coreTint(u);
    const pulse = MX.reduced ? 1 : (1 + 0.05 * Math.sin(MX.tick * 0.0014));
    const rr = Math.max(22, 46 * k) * pulse;
    // circuit-open red warning aura
    if (u.circuitOpen) {
      const a = 0.18 + (MX.reduced ? 0.08 : 0.1 * (0.5 + 0.5 * Math.sin(MX.tick * 0.004)));
      const g0 = ctx.createRadialGradient(p.x, p.y, rr, p.x, p.y, rr * 3.4);
      g0.addColorStop(0, PAL.lossRGB + a + ')'); g0.addColorStop(1, PAL.lossRGB + '0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g0; ctx.beginPath(); ctx.arc(p.x, p.y, rr * 3.4, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr * 5 * pulse);
    const on = !dimmed || (focus && focus.kind === 'core');
    g.addColorStop(0, tint.rgb + (on ? 0.95 : 0.4) + ')');
    g.addColorStop(0.3, PAL.amberRGB + (on ? 0.4 : 0.14) + ')');
    g.addColorStop(1, PAL.amberRGB + '0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rr * 5 * pulse, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = on ? PAL.coreHot : 'rgba(255,246,216,.4)';
    ctx.beginPath(); ctx.arc(p.x, p.y, rr * 0.5, 0, TAU); ctx.fill();
    const core = MX.nodes[0]; core.sx = p.x; core.sy = p.y; core.sr = rr * 0.6;
  }

  function drawOrbitRings(ctx, k, dimmed) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1;
    (MX.stars2 || []).forEach((s) => {
      const c = toScreen(0, 0);
      const rr = s.ring * k;
      if (rr > Math.max(MX.W, MX.H) * 1.4) return;
      ctx.strokeStyle = PAL.amberRGB + (dimmed ? 0.02 : 0.04) + ')';
      ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, TAU); ctx.stroke();
      // planet orbit rings
      s.planets.forEach((p) => {
        const sc = toScreen(s.x, s.y); const pr = p.orad * k;
        ctx.strokeStyle = PAL.goldRGB + (dimmed ? 0.02 : 0.05) + ')';
        ctx.beginPath(); ctx.arc(sc.x, sc.y, pr, 0, TAU); ctx.stroke();
      });
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  // star → core "profit threads": brighter the more a star is weighted to profit
  function drawProfitThreads(ctx, tk, dimmed, focus) {
    ctx.globalCompositeOperation = 'lighter';
    const c = toScreen(0, 0);
    (MX.stars2 || []).forEach((s) => {
      const p = toScreen(s.x, s.y);
      const onWeb = focus ? MX.webNodes.has(s) : false;
      let a = 0.05 + s.profitW * 0.07;
      if (dimmed) a *= onWeb ? 3.2 : 0.18;
      const col = s.action === 'SELL' ? PAL.lossRGB : (s.action === 'BUY' ? PAL.gainRGB : PAL.neutralRGB);
      ctx.strokeStyle = col + clamp(a, 0, 0.6) + ')';
      ctx.lineWidth = clamp(0.6 + s.profitW * 1.2, 0.6, 2.4) * clamp(MX.view.k, 0.6, 1.5);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      // profit beads flowing OUTWARD from the core (money radiating)
      if (!MX.reduced && (!dimmed || onWeb) && s.action !== 'SELL') {
        const u = ((tk * (0.00022 + s.profitW * 0.0002)) + s.ang * 0.21) % 1;
        const bx = lerp(c.x, p.x, u), by = lerp(c.y, p.y, u);
        const fade = Math.sin(u * Math.PI);
        const pr = (1.6 + s.profitW) * clamp(MX.view.k, 0.6, 1.5);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, pr * 3);
        g.addColorStop(0, PAL.goldRGB + clamp(0.7 * fade * (dimmed && !onWeb ? 0.2 : 1), 0, 1) + ')');
        g.addColorStop(1, PAL.goldRGB + '0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, pr * 3, 0, TAU); ctx.fill();
      }
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawSentimentLanes(ctx, star, tk) {
    const lanes = star.lanes || {};
    const names = [['reddit', 20], ['news', 110], ['price', 200], ['brain', 290]];
    const sc = toScreen(star.x, star.y);
    ctx.globalCompositeOperation = 'lighter';
    names.forEach(([nm, deg]) => {
      const v = lanes[nm];
      if (v == null) return; // dead lane dropped, never faked
      const ang = (deg * Math.PI) / 180 + Math.sin(tk * 0.0006 + deg) * 0.05;
      const len = (star.radius + 34 + Math.abs(v) * 60) * 1;
      const ex = star.x + Math.cos(ang) * len, ey = star.y + Math.sin(ang) * len;
      const e = toScreen(ex, ey);
      const col = v > 0 ? PAL.gainRGB : (v < 0 ? PAL.lossRGB : PAL.neutralRGB);
      ctx.strokeStyle = col + clamp(0.18 + Math.abs(v) * 0.5, 0, 0.8) + ')';
      ctx.lineWidth = 1 + Math.abs(v) * 2;
      ctx.beginPath(); ctx.moveTo(sc.x, sc.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      ctx.fillStyle = col + '0.9)';
      ctx.beginPath(); ctx.arc(e.x, e.y, 2.2 + Math.abs(v) * 2.4, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(220,214,200,0.55)';
      ctx.font = '9px ui-sans-serif,system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(nm, e.x, e.y + 13);
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawComets(ctx, tk, T, dimmed, focus) {
    const u = MX.model; if (!u || !u.cometList) return;
    ctx.globalCompositeOperation = 'lighter';
    const c = toScreen(0, 0);
    for (const cm of u.cometList) {
      if (cm.ts > T) continue; // not yet happened at the scrub time
      const age = T - cm.ts;
      const life = clamp(1 - age / (3 * 86400000), 0, 1); // fade over ~3 days of scrub
      if (life <= 0.01 && MX.T >= 0.999) { /* keep faint trace at NOW */ }
      const s = cm.star;
      const onWeb = focus ? MX.webNodes.has(s) : false;
      const sc = toScreen(s.x, s.y);
      const fx = s.x + Math.cos(cm.ang) * cm.far, fy = s.y + Math.sin(cm.ang) * cm.far;
      const fp = toScreen(fx, fy);
      // progress of the comet travelling: in = far→star, out = star→far
      let prog = MX.reduced ? 1 : clamp(0.2 + ((tk * 0.00035 + cm.key * 0.17) % 1), 0, 1);
      if (MX.T < 0.999) prog = clamp(1 - age / (1.2 * 86400000), 0, 1);
      const a0 = cm.dir === 'in' ? fp : sc, a1 = cm.dir === 'in' ? sc : fp;
      const hx = lerp(a0.x, a1.x, prog), hy = lerp(a0.y, a1.y, prog);
      const col = cm.dir === 'out' ? PAL.lossRGB : PAL.gainRGB;
      let alpha = (0.18 + life * 0.5);
      if (dimmed) alpha *= onWeb ? 2.4 : 0.18;
      // tail
      ctx.strokeStyle = col + clamp(alpha * 0.6, 0, 0.8) + ')';
      ctx.lineWidth = 1.2 * clamp(MX.view.k, 0.5, 1.4);
      ctx.beginPath(); ctx.moveTo(lerp(a0.x, a1.x, clamp(prog - 0.16, 0, 1)), lerp(a0.y, a1.y, clamp(prog - 0.16, 0, 1)));
      ctx.lineTo(hx, hy); ctx.stroke();
      // head
      const pr = 2.4 * clamp(MX.view.k, 0.5, 1.4);
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, pr * 3);
      g.addColorStop(0, col + clamp(alpha, 0, 1) + ')'); g.addColorStop(1, col + '0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, pr * 3, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawStars(ctx, k, tk, dimmed, focus, labels, occupied) {
    (MX.stars2 || []).forEach((s) => {
      const p = toScreen(s.x, s.y);
      const rr = Math.max(3, s.radius * k);
      if (p.x + rr * 6 < 0 || p.x - rr * 6 > MX.W || p.y + rr * 6 < 0 || p.y - rr * 6 > MX.H) { s.sx = p.x; s.sy = p.y; s.sr = rr; return; }
      const on = !dimmed || (focus && MX.webNodes.has(s));
      const pulse = MX.reduced ? 1 : (1 + 0.05 * Math.sin(tk * 0.0013 + s.twinkle));
      const rgb = hexToRGB(s.hue);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr * 5.5 * pulse);
      g.addColorStop(0, 'rgba(' + rgb + ',' + (on ? 0.85 : 0.2) + ')');
      g.addColorStop(0.3, 'rgba(' + rgb + ',' + (on ? 0.32 : 0.08) + ')');
      g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rr * 5.5 * pulse, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = on ? '#fff' : 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.fill();
      // selection ring
      if (MX.sel === s) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, rr + 6, 0, TAU); ctx.stroke(); }
      s.sx = p.x; s.sy = p.y; s.sr = rr;
      if (on) {
        occupied.push({ l: p.x - rr, r: p.x + rr, t: p.y - rr, b: p.y + rr });
        const txt = s.sym + (s.action && s.action !== 'HOLD' ? '  ' + s.action : '');
        labels.push({ text: txt, x: p.x, y: p.y - rr - 7, w: txt.length * 6.6 + 8, h: 14, color: on ? '#fff6d8' : 'rgba(255,246,216,.4)', font: '700 11px ui-sans-serif,system-ui,sans-serif', prio: 2 + s.profitW });
      }
    });
  }

  function drawPlanets(ctx, k, tk, dimmed, focus, labels, occupied) {
    (MX.stars2 || []).forEach((s) => {
      s.planets.forEach((p) => {
        const sp = toScreen(p.x, p.y);
        const rr = Math.max(2, p.r * k);
        if (sp.x < -20 || sp.x > MX.W + 20 || sp.y < -20 || sp.y > MX.H + 20) { p.sx = sp.x; p.sy = sp.y; p.sr = rr; return; }
        const on = !dimmed || (focus && MX.webNodes.has(p));
        // hue by unrealized P&L if known, else neutral gold-amber (honest: unknown)
        let rgb;
        if (p.unrealized != null) rgb = p.unrealized > 0 ? '34,197,94' : (p.unrealized < 0 ? '220,38,38' : '245,166,35');
        else rgb = '245,166,35';
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, rr * 4);
        g.addColorStop(0, 'rgba(' + rgb + ',' + (on ? 0.8 : 0.22) + ')');
        g.addColorStop(1, 'rgba(' + rgb + ',0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sp.x, sp.y, rr * 4, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = on ? 'rgba(' + rgb + ',1)' : 'rgba(' + rgb + ',0.4)';
        ctx.beginPath(); ctx.arc(sp.x, sp.y, rr, 0, TAU); ctx.fill();
        // exposure ring
        ctx.strokeStyle = 'rgba(' + rgb + ',' + (on ? 0.6 : 0.2) + ')';
        ctx.lineWidth = clamp(rr * 0.5, 1, 4);
        ctx.beginPath(); ctx.arc(sp.x, sp.y, rr + 2, 0, TAU); ctx.stroke();
        if (MX.sel === p) { ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sp.x, sp.y, rr + 7, 0, TAU); ctx.stroke(); }
        p.sx = sp.x; p.sy = sp.y; p.sr = rr;
      });
    });
  }

  function drawPending(ctx, k, tk, dimmed, focus, labels, occupied) {
    const u = MX.model; if (!u || !u.pendingBodies) return;
    u.pendingBodies.forEach((b) => {
      const p = toScreen(b.x, b.y);
      const pulse = MX.reduced ? 1 : (0.7 + 0.3 * Math.sin(tk * 0.005));
      const rr = Math.max(7, b.r * k) * (1 + 0.25 * pulse);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr * 4.5);
      g.addColorStop(0, PAL.pendingSoft + (0.6 + 0.35 * pulse) + ')');
      g.addColorStop(0.4, PAL.pendingSoft + '0.3)');
      g.addColorStop(1, PAL.pendingSoft + '0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rr * 4.5, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = PAL.pending; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, rr + 4 + 3 * pulse, 0, TAU); ctx.stroke();
      if (MX.sel === b) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, rr + 10, 0, TAU); ctx.stroke(); }
      b.sx = p.x; b.sy = p.y; b.sr = rr;
      occupied.push({ l: p.x - rr, r: p.x + rr, t: p.y - rr, b: p.y + rr });
      const txt = '⏳ AWAITING LORD VINTA';
      labels.push({ text: txt, x: p.x, y: p.y - rr - 9, w: txt.length * 6.2 + 10, h: 15, color: '#D8C9FF', font: '700 10px ui-sans-serif,system-ui,sans-serif', prio: 100 });
      const sub = b.action + ' ' + b.sym + '  ' + fmtUSD(b.exposure);
      labels.push({ text: sub, x: p.x, y: p.y + rr + 15, w: sub.length * 5.6 + 8, h: 13, color: 'rgba(216,201,255,.8)', font: '600 9px ui-sans-serif,system-ui,sans-serif', prio: 99 });
    });
  }

  // profit pulse ripples from the core
  function drawPulses(ctx, dt) {
    ctx.globalCompositeOperation = 'lighter';
    const c = toScreen(0, 0);
    for (let i = MX.pulses.length - 1; i >= 0; i--) {
      const pu = MX.pulses[i];
      pu.r += dt * 0.12; pu.a -= dt * 0.0006;
      if (pu.a <= 0) { MX.pulses.splice(i, 1); continue; }
      ctx.strokeStyle = (pu.sign < 0 ? PAL.lossRGB : PAL.goldRGB) + clamp(pu.a, 0, 0.6) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, pu.r * MX.view.k, 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ── collision-safe label placement (canvas text obeys No-Collision too) ──────
  function labelPass(ctx, labels, occupied) {
    labels.sort((a, b) => b.prio - a.prio);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const placed = occupied.slice();
    for (const L of labels) {
      let box = { l: L.x - L.w / 2, r: L.x + L.w / 2, t: L.y - L.h / 2, b: L.y + L.h / 2 };
      let tries = 0; let ok = false; let y = L.y;
      while (tries < 4) {
        box = { l: L.x - L.w / 2, r: L.x + L.w / 2, t: y - L.h / 2, b: y + L.h / 2 };
        if (!placed.some((o) => !(box.r < o.l || box.l > o.r || box.b < o.t || box.t > o.b))) { ok = true; break; }
        y -= (L.h + 3); tries++; // nudge up and retry
      }
      if (!ok) continue; // give up rather than overlap — a dropped label beats a collision
      placed.push(box);
      ctx.font = L.font;
      // subtle shadow for legibility over the galaxy
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(L.text, L.x + 0.6, y + 0.8);
      ctx.fillStyle = L.color;
      ctx.fillText(L.text, L.x, y);
    }
  }

  function hexToRGB(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FOCUS WEB — selecting/hovering a node dims everything off its web
  // ══════════════════════════════════════════════════════════════════════════
  function computeWeb(node) {
    MX.webNodes = new Set();
    if (!node) return;
    MX.webNodes.add(node);
    if (node.kind === 'star') { node.planets.forEach((p) => MX.webNodes.add(p)); }
    else if (node.kind === 'planet') { MX.webNodes.add(node.star); }
    else if (node.kind === 'core') { (MX.stars2 || []).forEach((s) => MX.webNodes.add(s)); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HIT TESTING
  // ══════════════════════════════════════════════════════════════════════════
  function pick(sx, sy) {
    let best = null, bestD = Infinity;
    for (const n of MX.nodes) {
      if (n.sx == null) continue;
      const rr = Math.max(10, (n.sr || 6) + 8);
      const d = Math.hypot(sx - n.sx, sy - n.sy);
      if (d < rr && d < bestD) { best = n; bestD = d; }
    }
    return best;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER LOOP — single rAF, cancelled on hidden/blur, DPR capped, reduced OK
  // ══════════════════════════════════════════════════════════════════════════
  function frame(ts) {
    if (!MX.running) return;
    const dt = MX.last ? Math.min(64, ts - MX.last) : 16;
    MX.last = ts;
    if (MX.playing && !MX.reduced) {
      MX.T = clamp(MX.T + dt / MX.dur, 0, 1);
      if (MX.dom.cursor) MX.dom.cursor.value = String(Math.round(MX.T * 1000));
      updateTimeLabel();
      if (MX.T >= 1) { MX.playing = false; if (MX.dom.play) MX.dom.play.textContent = '▶'; }
    }
    draw(dt);
    if (MX.running && !MX.reduced) MX.raf = requestAnimationFrame(frame);
  }
  function start() {
    if (MX.running) return;
    if (document.hidden) return;
    MX.running = true; MX.last = 0;
    if (MX.reduced) { draw(0); MX.running = false; return; } // still frame, no loop
    MX.raf = requestAnimationFrame(frame);
  }
  function stop() {
    MX.running = false;
    if (MX.raf) { cancelAnimationFrame(MX.raf); MX.raf = 0; }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RESIZE
  // ══════════════════════════════════════════════════════════════════════════
  function resize() {
    const cv = MX.canvas; if (!cv) return;
    const rect = cv.getBoundingClientRect();
    MX.dpr = Math.min(2, window.devicePixelRatio || 1);
    MX.W = Math.max(1, Math.round(rect.width));
    MX.H = Math.max(1, Math.round(rect.height));
    cv.width = Math.round(MX.W * MX.dpr);
    cv.height = Math.round(MX.H * MX.dpr);
    MX.ctx.setTransform(MX.dpr, 0, 0, MX.dpr, 0, 0);
    if (MX.loaded) { if (!MX._fit) fitView(true); if (MX.reduced) draw(0); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // INTERACTION — mouse + touch pan / zoom / select
  // ══════════════════════════════════════════════════════════════════════════
  function wireInteraction() {
    const cv = MX.canvas;
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
      MX.pointer.down = true; MX.pointer.moved = false;
      MX.pointer.x = MX.pointer.lx = e.clientX; MX.pointer.y = MX.pointer.ly = e.clientY;
    });
    cv.addEventListener('pointermove', (e) => {
      const rect = cv.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      if (MX.pointer.down) {
        const dx = e.clientX - MX.pointer.lx, dy = e.clientY - MX.pointer.ly;
        if (Math.abs(e.clientX - MX.pointer.x) + Math.abs(e.clientY - MX.pointer.y) > 5) MX.pointer.moved = true;
        MX.view.tx -= dx / MX.view.k; MX.view.ty -= dy / MX.view.k;
        MX.view.x -= dx / MX.view.k; MX.view.y -= dy / MX.view.k;
        MX.pointer.lx = e.clientX; MX.pointer.ly = e.clientY;
        MX._fit = true;
        if (MX.reduced) draw(0);
      } else if (e.pointerType !== 'touch') {
        const hit = pick(sx, sy);
        if (hit !== MX.hover) { MX.hover = hit; if (!MX.sel) { computeWeb(hit); renderDetail(hit); } if (MX.reduced) draw(0); }
        cv.style.cursor = hit ? 'pointer' : 'grab';
      }
    });
    cv.addEventListener('pointerup', (e) => {
      MX.pointer.down = false;
      if (!MX.pointer.moved) {
        const rect = cv.getBoundingClientRect();
        const hit = pick(e.clientX - rect.left, e.clientY - rect.top);
        MX.sel = (hit === MX.sel) ? null : hit;
        computeWeb(MX.sel || MX.hover);
        renderDetail(MX.sel || MX.hover);
        if (MX.reduced) draw(0);
      }
    });
    cv.addEventListener('pointercancel', () => { MX.pointer.down = false; });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      zoomAt(sx, sy, Math.pow(1.0015, -e.deltaY));
    }, { passive: false });

    // touch pinch
    const touches = new Map();
    cv.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) touches.set(t.identifier, t);
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        MX.pinch.active = true; MX.pinch.d0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); MX.pinch.k0 = MX.view.tk;
      }
    }, { passive: true });
    cv.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (touches.has(t.identifier)) touches.set(t.identifier, t);
      if (MX.pinch.active && touches.size >= 2) {
        const [a, b] = [...touches.values()];
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const rect = cv.getBoundingClientRect();
        const cx = (a.clientX + b.clientX) / 2 - rect.left, cy = (a.clientY + b.clientY) / 2 - rect.top;
        setZoomAt(cx, cy, clamp(MX.pinch.k0 * (d / Math.max(1, MX.pinch.d0)), 0.08, 2.4));
      }
    }, { passive: true });
    cv.addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) touches.delete(t.identifier);
      if (touches.size < 2) MX.pinch.active = false;
    }, { passive: true });
  }
  function zoomAt(sx, sy, factor) { setZoomAt(sx, sy, clamp(MX.view.tk * factor, 0.08, 2.4)); }
  function setZoomAt(sx, sy, nk) {
    const w = toWorld(sx, sy);
    MX.view.tk = nk;
    // keep the point under the cursor fixed
    MX.view.tx = w.x - (sx - MX.W / 2) / nk;
    MX.view.ty = w.y - (sy - MX.H / 2) / nk;
    MX._fit = true;
    if (MX.reduced) { MX.view.k = MX.view.tk; MX.view.x = MX.view.tx; MX.view.y = MX.view.ty; draw(0); }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HUD BINDING
  // ══════════════════════════════════════════════════════════════════════════
  function el(id) { return document.getElementById(id); }
  function bindHUD() {
    MX.dom = {
      modeBadge: el('mx-mode'), demoBanner: el('mx-demo'),
      pRealized: el('mx-realized'), pUnrealized: el('mx-unrealized'), pToday: el('mx-today'),
      pWin: el('mx-winrate'), pEquity: el('mx-equity'), pTrades: el('mx-trades'),
      pending: el('mx-pending-list'), pendingCount: el('mx-pending-count'),
      detail: el('mx-detail'), legend: el('mx-legend'),
      cursor: el('mx-cursor'), play: el('mx-play'), timeLabel: el('mx-time'),
      sources: el('mx-sources'),
      sToday: el('mx-strip-today'), sReal: el('mx-strip-realized'), sWin: el('mx-strip-win'), sEquity: el('mx-strip-equity'),
      dockPending: el('mx-dock-pending'),
    };
    renderReadout();
    renderPending();
    renderLegend();
    updateTimeLabel();
    renderSources();
  }

  function renderReadout() {
    const u = MX.model, d = MX.dom, p = u.profit;
    if (d.modeBadge) {
      const mode = u.demo ? 'DEMO SKY' : (u.mode === 'live' ? 'LIVE' : 'PAPER');
      d.modeBadge.textContent = mode;
      d.modeBadge.className = 'mx-badge ' + (u.demo ? 'mx-badge-demo' : (u.mode === 'live' ? 'mx-badge-live' : 'mx-badge-paper'));
    }
    if (d.demoBanner) {
      if (u.demo) {
        d.demoBanner.hidden = false;
        d.demoBanner.textContent = 'DEMO SKY — not live data (' + (u.demoReason === 'owner-only' ? 'owner sign-in required' : u.demoReason === 'offline' ? 'brain offline' : 'unavailable') + '). Sign in as owner / start the brain to go live.';
      } else d.demoBanner.hidden = true;
    }
    const tag = (real) => real ? '' : ' <span class="mx-demo-tag">DEMO</span>';
    const set = (node, val, real, signed) => {
      if (!node) return;
      node.innerHTML = (val == null ? '—' : esc(val)) + (val != null ? tag(real) : '');
      node.classList.remove('mx-pos', 'mx-neg');
      if (signed && typeof val === 'string') { if (val.indexOf('+') === 0 || (!/^-/.test(val) && val !== '$0.00')) node.classList.add('mx-pos'); if (/^-/.test(val)) node.classList.add('mx-neg'); }
    };
    if (u.demo) {
      set(d.pRealized, fmtUSD(p.demoRealizedToday, true), false, true);
      set(d.pUnrealized, '—', false);
      set(d.pToday, fmtUSD(p.demoRealizedToday, true), false, true);
      set(d.pWin, fmtPct(p.demoWinRate), false);
      set(d.pEquity, fmtUSD(p.demoEquity), false);
      set(d.pTrades, String(p.demoTrades), false);
    } else {
      set(d.pRealized, p.strategyRealized != null ? fmtUSD(p.strategyRealized, true) : '—', true, true);
      set(d.pUnrealized, p.unrealized != null ? fmtUSD(p.unrealized, true) : '—', true, true);
      set(d.pToday, p.realizedTodayTracked ? fmtUSD(p.realizedToday, true) : '—', true, true);
      set(d.pWin, p.winRate != null ? fmtPct(p.winRate) : '—', true);
      set(d.pEquity, p.equity != null ? fmtUSD(p.equity) : '—', true);
      set(d.pTrades, p.totalTrades != null ? String(p.totalTrades) : '—', true);
    }
    // mobile strip mirrors the same numbers (one source of truth — set here)
    const stripSet = (node, val, pos) => {
      if (!node) return;
      node.textContent = (val == null ? '—' : val);
      node.classList.remove('mx-pos', 'mx-neg');
      if (val != null && typeof val === 'string') { if (/^\+/.test(val)) node.classList.add('mx-pos'); if (/^-/.test(val)) node.classList.add('mx-neg'); }
    };
    if (u.demo) {
      stripSet(d.sToday, fmtUSD(p.demoRealizedToday, true));
      stripSet(d.sReal, fmtUSD(p.demoRealizedToday, true));
      stripSet(d.sWin, fmtPct(p.demoWinRate));
      stripSet(d.sEquity, fmtUSD(p.demoEquity));
    } else {
      stripSet(d.sToday, p.realizedTodayTracked ? fmtUSD(p.realizedToday, true) : '—');
      stripSet(d.sReal, p.strategyRealized != null ? fmtUSD(p.strategyRealized, true) : '—');
      stripSet(d.sWin, p.winRate != null ? fmtPct(p.winRate) : '—');
      stripSet(d.sEquity, p.equity != null ? fmtUSD(p.equity) : '—');
    }

    // fire a profit pulse if today's realized is positive
    const rt = u.demo ? p.demoRealizedToday : p.realizedToday;
    if (rt != null && rt !== 0 && !MX._pulsed) { MX.pulses.push({ r: 46, a: 0.5, sign: rt < 0 ? -1 : 1 }); MX._pulsed = true; }
  }

  function renderPending() {
    const u = MX.model, d = MX.dom; if (!d.pending) return;
    const list = u.pending || [];
    if (d.pendingCount) d.pendingCount.textContent = String(list.length);
    if (d.dockPending) d.dockPending.textContent = String(list.length);
    if (!list.length) {
      d.pending.innerHTML = '<div class="mx-empty">No orders awaiting Lord Vinta. The machine is idle — or everything already shipped.</div>';
      return;
    }
    d.pending.innerHTML = list.map((p) => (
      '<button class="mx-pend" data-pid="' + esc(p.id) + '" data-draggable="false">' +
      '<span class="mx-pend-act mx-pend-' + (p.action === 'SELL' ? 'sell' : 'buy') + '">' + esc(p.action) + '</span>' +
      '<span class="mx-pend-sym">' + esc(p.sym) + '</span>' +
      '<span class="mx-pend-qty">' + esc(p.qty != null ? p.qty : '?') + ' @ ' + esc(p.price != null ? '$' + p.price : '—') + '</span>' +
      '<span class="mx-pend-exp">' + esc(fmtUSD(p.exposure)) + '</span>' +
      '</button>'
    )).join('');
    d.pending.querySelectorAll('.mx-pend').forEach((b) => b.addEventListener('click', () => {
      const node = (u.pendingBodies || []).find((x) => x.id === b.getAttribute('data-pid'));
      if (node) { MX.sel = node; computeWeb(node); renderDetail(node); focusNode(node); if (MX.reduced) draw(0); }
    }));
  }

  function renderDetail(node) {
    const d = MX.dom; if (!d.detail) return;
    if (!node || node.kind === 'core') {
      const u = MX.model;
      d.detail.innerHTML = '<div class="mx-det-title">TREASURY CORE</div>' +
        '<div class="mx-det-row"><span>Equity</span><b>' + esc(u.demo ? fmtUSD(u.profit.demoEquity) + ' (DEMO)' : (u.profit.equity != null ? fmtUSD(u.profit.equity) : '—')) + '</b></div>' +
        '<div class="mx-det-row"><span>Buying power</span><b>' + esc(u.profit.buyingPower != null ? fmtUSD(u.profit.buyingPower) : '—') + '</b></div>' +
        '<div class="mx-det-row"><span>Circuit</span><b>' + (u.circuitOpen ? '<span class="mx-neg">OPEN ⚠</span>' : 'closed') + '</b></div>' +
        '<div class="mx-det-hint">Hover a star to read its signal. Tap to lock focus.</div>';
      d.detail.classList.remove('mx-det-pending');
      return;
    }
    if (node.kind === 'star') {
      const lanes = node.lanes || {};
      const laneRow = (nm) => lanes[nm] == null ? '' : '<div class="mx-det-row"><span>' + nm + '</span><b class="' + (lanes[nm] > 0 ? 'mx-pos' : lanes[nm] < 0 ? 'mx-neg' : '') + '">' + lanes[nm].toFixed(2) + '</b></div>';
      d.detail.innerHTML = '<div class="mx-det-title">' + esc(node.sym) + ' <span class="mx-det-act mx-pend-' + (node.action === 'SELL' ? 'sell' : node.action === 'BUY' ? 'buy' : 'hold') + '">' + esc(node.action || 'HOLD') + '</span></div>' +
        '<div class="mx-det-row"><span>Composite</span><b>' + esc(node.score != null ? node.score.toFixed(2) : '—') + '</b></div>' +
        '<div class="mx-det-row"><span>Confidence</span><b>' + esc(node.conf != null ? Math.round(node.conf * 100) + '%' : '—') + '</b></div>' +
        laneRow('reddit') + laneRow('news') + laneRow('price') + laneRow('brain') +
        (node.reasons && node.reasons.length ? '<div class="mx-det-hint">' + esc(node.reasons[0]) + '</div>' : '') +
        (node.planets.length ? '<div class="mx-det-hint">' + node.planets.length + ' open position' + (node.planets.length > 1 ? 's' : '') + ' orbiting.</div>' : '');
      d.detail.classList.remove('mx-det-pending');
      return;
    }
    if (node.kind === 'planet') {
      d.detail.innerHTML = '<div class="mx-det-title">' + esc(node.sym) + ' · position</div>' +
        '<div class="mx-det-row"><span>Shares</span><b>' + esc(node.qty != null ? node.qty : '—') + '</b></div>' +
        '<div class="mx-det-row"><span>Avg price</span><b>' + esc(node.avgPrice != null ? '$' + node.avgPrice.toFixed(2) : '—') + '</b></div>' +
        '<div class="mx-det-row"><span>Cost basis</span><b>' + esc(node.exposure != null ? fmtUSD(node.exposure) : '—') + '</b></div>' +
        '<div class="mx-det-row"><span>Unrealized</span><b class="' + (node.unrealized > 0 ? 'mx-pos' : node.unrealized < 0 ? 'mx-neg' : '') + '">' + esc(node.unrealized != null ? fmtUSD(node.unrealized, true) + (MX.model.demo ? ' (DEMO)' : '') : 'mark unavailable') + '</b></div>';
      d.detail.classList.remove('mx-det-pending');
      return;
    }
    if (node.kind === 'pending') {
      d.detail.innerHTML = '<div class="mx-det-title">⏳ AWAITING LORD VINTA</div>' +
        '<div class="mx-det-row"><span>Order</span><b>' + esc(node.action + ' ' + node.sym) + '</b></div>' +
        '<div class="mx-det-row"><span>Qty</span><b>' + esc(node.qty != null ? node.qty : '?') + '</b></div>' +
        '<div class="mx-det-row"><span>Limit</span><b>' + esc(node.price != null ? '$' + node.price : '—') + '</b></div>' +
        '<div class="mx-det-row"><span>Exposure</span><b>' + esc(fmtUSD(node.exposure)) + '</b></div>' +
        (node.reasoning ? '<div class="mx-det-hint">' + esc(node.reasoning) + '</div>' : '') +
        '<div class="mx-det-hint mx-det-seal">Only Lord Vinta can approve this. Review & approve in the War Room — never auto-fired.</div>';
      d.detail.classList.add('mx-det-pending');
      return;
    }
  }

  function focusNode(node) {
    if (!node || node.x == null) return;
    MX.view.tx = node.x; MX.view.ty = node.y;
    MX.view.tk = clamp(Math.max(MX.view.tk, 0.6), 0.08, 2.0);
    MX._fit = true;
  }

  function renderLegend() {
    const d = MX.dom; if (!d.legend) return;
    d.legend.innerHTML = [
      ['core', 'Treasury core = equity'],
      ['star', 'Star = watched symbol'],
      ['planet', 'Planet = open position'],
      ['comet', 'Comet = a trade (buy in / sell out)'],
      ['pending', 'Purple = awaiting Lord Vinta'],
    ].map(([c, t]) => '<span class="mx-leg"><i class="mx-dot mx-dot-' + c + '"></i>' + esc(t) + '</span>').join('');
  }

  function renderSources() {
    const d = MX.dom; if (!d.sources) return;
    const u = MX.model;
    if (u.demo) { d.sources.innerHTML = '<span class="mx-src mx-src-demo">seeded demo — no live lanes</span>'; return; }
    d.sources.innerHTML = Object.entries(u.sources).map(([k, v]) =>
      '<span class="mx-src ' + (v.ok ? 'mx-src-ok' : 'mx-src-off') + '">' + esc(k) + (v.ok ? '' : ' ·' + (v.why || 'off')) + '</span>').join('');
  }

  function updateTimeLabel() {
    const d = MX.dom; if (!d.timeLabel || !MX.model || !MX.model.tRange) return;
    const t = nowT();
    const atNow = MX.T >= 0.999;
    d.timeLabel.textContent = atNow ? 'NOW' : new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    d.timeLabel.classList.toggle('mx-time-now', atNow);
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ══════════════════════════════════════════════════════════════════════════
  // CONTROLS WIRING
  // ══════════════════════════════════════════════════════════════════════════
  function wireControls() {
    const cursor = el('mx-cursor'), play = el('mx-play'), refit = el('mx-refit'), reload = el('mx-reload');
    if (cursor) {
      cursor.addEventListener('input', () => {
        MX.T = clamp(Number(cursor.value) / 1000, 0, 1);
        MX.playing = false; if (play) play.textContent = '▶';
        updateTimeLabel(); if (MX.reduced) draw(0);
      });
    }
    if (play) play.addEventListener('click', () => {
      if (MX.reduced) return;
      if (MX.T >= 0.999) MX.T = 0;
      MX.playing = !MX.playing; play.textContent = MX.playing ? '❚❚' : '▶';
    });
    if (refit) refit.addEventListener('click', () => { MX._fit = false; fitView(false); MX.sel = null; MX.hover = null; MX.webNodes = new Set(); renderDetail(null); if (MX.reduced) draw(0); });
    if (reload) reload.addEventListener('click', async () => { reload.disabled = true; await loadUniverse(); renderReadout(); renderPending(); renderSources(); reload.disabled = false; if (MX.reduced) draw(0); });

    // mobile sheet toggles (each opens one sheet; only one open at a time)
    document.querySelectorAll('[data-mx-sheet]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-mx-sheet');
        const open = document.body.getAttribute('data-mx-open') === target;
        document.body.setAttribute('data-mx-open', open ? '' : target);
        document.querySelectorAll('[data-mx-sheet]').forEach((b) => b.classList.toggle('mx-dock-on', !open && b === btn));
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ══════════════════════════════════════════════════════════════════════════
  async function init() {
    const cv = el('mx-canvas'); if (!cv) { console.warn('[mercatus] no #mx-canvas'); return; }
    MX.canvas = cv; MX.ctx = cv.getContext('2d', { alpha: false });
    MX.reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    resize();
    wireInteraction();
    wireControls();

    // loading shimmer
    MX.ctx.fillStyle = PAL.ink; MX.ctx.fillRect(0, 0, MX.W, MX.H);
    MX.ctx.fillStyle = 'rgba(255,215,0,0.8)'; MX.ctx.font = '600 14px ui-sans-serif,system-ui,sans-serif';
    MX.ctx.textAlign = 'center';
    MX.ctx.fillText('charting the mercatus cosmos…', MX.W / 2, MX.H / 2);

    await loadUniverse();
    start();

    // lifecycle hooks — single loop, cancelled on hidden/blur, resumed on return
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
    window.addEventListener('blur', stop);
    window.addEventListener('focus', start);
    window.addEventListener('resize', () => { resize(); });
    if (window.ResizeObserver) { try { new ResizeObserver(() => resize()).observe(cv); } catch (_) {} }

    // honour a late reduced-motion change
    if (window.matchMedia) {
      try {
        window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
          MX.reduced = e.matches; if (MX.reduced) { stop(); draw(0); } else start();
        });
      } catch (_) {}
    }

    // periodic honest refresh of live lanes (not while scrubbing history)
    setInterval(async () => {
      if (document.hidden || MX.playing || MX.T < 0.999) return;
      await loadUniverse(); renderReadout(); renderPending(); renderSources();
      if (MX.reduced) draw(0);
    }, 60000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
