/* ═══════════════════════════════════════════════════════════════════════════
   VINTINUUM TRADE TOOLTIP  —  body/trade-tooltip.js
   ───────────────────────────────────────────────────────────────────────────
   Phase 2 of Mercatus: the pre-trade blindness killer.

   Lord Vinta's complaint (verbatim): "i tried to do anything and it just made
   me do a sell at .35 for something i have no idea about — any trade i manually
   do i want complete tooltips as to wtf the risks are, profits are, potentials
   are, losses potential are, etc — everything that could happen going through
   with any trade manually."

   This module answers that. Before ANY manual trade fires, the human sees
   exactly what could happen: exposure, max loss, max gain, R:R, volatility,
   brain state, position size, history — every number REAL or honestly labelled
   "unavailable". No fabricated numbers, ever. (No-Guessing Law.)

   Public API (window.TradeTooltip):
     attach(el, {symbol, action, qty})    — compact tooltip on hover/tap/long-press
     openModal(symbol, {action, qty})     — deep-analysis modal
     confirm({symbol,action,qty,price,mode}) -> Promise<boolean>  — the gate

   HOUSE LAWS honoured:
     • NO-COLLISION: tooltip is viewport-clamped, flips at edges, never covers
       its anchor; modal is the ONE allowed overlay (centred card over dimmed
       backdrop), taller content scrolls INSIDE the card.
     • MOBILE-FIRST: clamp() type, 44px tap targets, safe-area insets,
       long-press to summon on touch, one-handed.
     • DRAGGABLE: modal card + confirm card carry data-draggable="true".
     • HONESTY / RETENTION: uncertainty shown plainly; every panel says why.

   Self-contained IIFE. All CSS classes prefixed `tt-`.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.TradeTooltip) return;

  // ── API base ──────────────────────────────────────────────────────────────
  // Same-origin in prod; localhost brain in dev. Matches the repo pattern.
  var API = (location.origin.indexOf('localhost') >= 0 || location.origin.indexOf('127.0.0.1') >= 0)
    ? 'http://localhost:8767'
    : '';

  var Z = {
    tooltip:  500,   // popover ladder — above content, below modal
    backdrop: 690,
    modal:    700,
    confirm:  710,
  };

  // ── tiny helpers ────────────────────────────────────────────────────────────
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function isTouch() {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function money(v) {
    if (!isNum(v)) return '—';
    var sign = v < 0 ? '-' : '';
    var a = Math.abs(v);
    return sign + '$' + a.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function pct(v, digits) {
    if (!isNum(v)) return '—';
    return v.toFixed(digits == null ? 2 : digits) + '%';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ── resilient fetch — never throws to a blank screen ────────────────────────
  async function getJSON(path, opts) {
    try {
      var r = await fetch(API + path, Object.assign({
        headers: { 'Accept': 'application/json' },
        credentials: 'same-origin',
      }, opts || {}));
      var text = await r.text();
      var data = null;
      try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
      return { ok: r.ok, status: r.status, data: data, raw: text };
    } catch (err) {
      return { ok: false, status: 0, data: null, error: err && err.message ? err.message : 'network error' };
    }
  }
  async function postJSON(path, body) {
    return getJSON(path, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
  }

  // ── data loaders (each honest, each degradable) ─────────────────────────────
  function analyze(symbol) { return postJSON('/api/trading/analyze', { symbol: symbol }); }
  function tradeState()    { return getJSON('/api/trading/state'); }
  function portfolio()     { return getJSON('/api/trading/portfolio'); }
  function accounting()    { return getJSON('/api/trading/accounting'); }
  function history(limit)  { return getJSON('/api/trading/history?limit=' + (limit || 100)); }
  function bodyState()     { return getJSON('/api/body-state'); }
  function sentiment(symbol) { return getJSON('/api/trading/sentiment?symbol=' + encodeURIComponent(symbol)); }

  // ── compute the seven fields from REAL data only ────────────────────────────
  // action: 'buy' | 'sell'. For a SELL (short-side exit/short) the protective
  // stop sits ABOVE and the target BELOW — the ATR geometry is mirrored so the
  // risk/reward reads honestly for the direction actually taken.
  function computeRisk(price, atr, action, qty) {
    var out = {
      price: isNum(price) ? price : null,
      atr: isNum(atr) ? atr : null,
      exposure: (isNum(price) && isNum(qty)) ? +(price * qty).toFixed(2) : null,
      stop: null, target: null, riskPerShare: null, rewardPerShare: null,
      rr: null, maxLoss: null, maxGain: null, volPct: null,
    };
    if (isNum(price) && isNum(atr) && atr > 0) {
      out.volPct = +(atr / price * 100).toFixed(2);
      var stopDist = 1.5 * atr;
      var targDist = 2.0 * atr;
      if (action === 'sell') {
        out.stop = +(price + stopDist).toFixed(2);
        out.target = +(price - targDist).toFixed(2);
      } else {
        out.stop = +(price - stopDist).toFixed(2);
        out.target = +(price + targDist).toFixed(2);
      }
      out.riskPerShare = +stopDist.toFixed(2);
      out.rewardPerShare = +targDist.toFixed(2);
      out.rr = +(targDist / stopDist).toFixed(2);
      if (isNum(qty)) {
        out.maxLoss = +(stopDist * qty).toFixed(2);
        out.maxGain = +(targDist * qty).toFixed(2);
      }
    }
    return out;
  }

  // Buying power is read defensively — the broker payload shape varies, so we
  // probe the known Robinhood keys and honestly return null if none are present.
  function extractBuyingPower(pf, acct) {
    var candidates = [];
    if (pf && typeof pf === 'object') {
      candidates.push(pf.buying_power, pf.buyingPower, pf.cash, pf.cash_available_for_withdrawal,
        pf.portfolio_cash, pf.crypto_buying_power, pf.equity);
      if (pf.account && typeof pf.account === 'object') {
        candidates.push(pf.account.buying_power, pf.account.buyingPower, pf.account.cash);
      }
    }
    if (acct && typeof acct === 'object' && acct.account && typeof acct.account === 'object') {
      candidates.push(acct.account.buying_power, acct.account.cash);
    }
    for (var i = 0; i < candidates.length; i++) {
      var v = Number(candidates[i]);
      if (isNum(v) && v > 0) return v;
    }
    return null;
  }

  // Historical accuracy: the decision journal records no realized P&L per trade
  // (verified: getHistory concatenates decision + order journals; entries carry
  // action/symbol/status/timestamp but no per-trade outcome). So a true win-rate
  // is NOT computable yet. We report what IS honest: how many prior decisions on
  // this symbol (and overall) are on record, and say the win-rate isn't tracked.
  function summariseHistory(hist, symbol) {
    if (!Array.isArray(hist)) return { available: false, note: 'History unavailable.' };
    if (hist.length === 0) return { available: true, total: 0, forSymbol: 0, note: 'No trade history yet.' };
    var forSym = 0;
    for (var i = 0; i < hist.length; i++) {
      var h = hist[i] || {};
      var s = (h.symbol || (h.decision && h.decision.symbol) || '').toString().toUpperCase();
      if (s === symbol) forSym++;
    }
    return {
      available: true,
      total: hist.length,
      forSymbol: forSym,
      note: 'Realized win-rate not tracked in the decision journal yet — no per-trade P&L is recorded.',
    };
  }

  function readBrainState(bs) {
    if (!bs || typeof bs !== 'object' || bs.degraded) {
      return { ok: false, label: 'Brain state quiet — not reporting right now.' };
    }
    var d = bs.derived || {};
    var valence = isNum(d.valence) ? d.valence : (isNum(bs.valence) ? (bs.valence - 50) / 50 : null);
    var energy = isNum(d.energy) ? d.energy : null;
    var hr = isNum(d.heartRate) ? d.heartRate : null;
    var mood = valence == null ? null : (valence > 0.15 ? 'warm' : (valence < -0.15 ? 'tense' : 'even'));
    return {
      ok: true, mood: mood, energy: energy, heartRate: hr,
      label: (mood ? ('mood ' + mood) : 'mood —')
        + (energy != null ? (' · energy ' + Math.round(energy * 100) + '%') : '')
        + (hr != null ? (' · ~' + hr + ' bpm') : ''),
    };
  }

  // quote change shown ONLY if the broker gave us a previous close; never faked.
  function quoteChange(quote) {
    if (!quote || typeof quote !== 'object') return null;
    var price = Number(quote.price);
    var prev = Number(quote.previous_close != null ? quote.previous_close : quote.adjusted_previous_close);
    if (!isNum(price) || !isNum(prev) || prev <= 0) return null;
    var abs = +(price - prev).toFixed(2);
    var pc = +((price - prev) / prev * 100).toFixed(2);
    return { abs: abs, pct: pc };
  }

  // ── scoped styles ───────────────────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById('tt-styles')) return;
    var css = [
      /* palette pulled from brain.html for house continuity */
      ':root{',
      '  --tt-bg:#070b14;--tt-panel:rgba(10,16,28,0.97);--tt-border:rgba(255,255,255,0.10);',
      '  --tt-text:rgba(222,232,255,0.94);--tt-dim:rgba(150,175,215,0.62);',
      '  --tt-blue:#4fc3f7;--tt-gold:#ffd54f;--tt-red:#ef5350;--tt-green:#66bb6a;',
      '  --tt-purple:#ce93d8;--tt-cyan:#80deea;--tt-orange:#ffa726;',
      '}',
      '.tt-pop,.tt-modal,.tt-modal *,.tt-pop *{box-sizing:border-box;font-family:"Space Mono",ui-monospace,monospace;}',

      /* ── compact tooltip ── */
      '.tt-pop{position:fixed;z-index:' + Z.tooltip + ';max-width:min(300px,calc(100vw - 20px));',
      '  background:var(--tt-panel);border:1px solid var(--tt-border);border-radius:12px;',
      '  padding:12px 13px;color:var(--tt-text);box-shadow:0 14px 46px rgba(0,0,0,0.6);',
      '  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);',
      '  font-size:clamp(0.66rem,2.2vw,0.76rem);line-height:1.45;pointer-events:auto;',
      '  opacity:0;transform:translateY(4px);transition:opacity .13s ease,transform .13s ease;}',
      '.tt-pop.tt-in{opacity:1;transform:translateY(0);}',
      '.tt-pop-hd{display:flex;align-items:baseline;gap:8px;justify-content:space-between;margin-bottom:8px;}',
      '.tt-pop-sym{font-weight:700;letter-spacing:.06em;font-size:clamp(0.82rem,3vw,0.94rem);}',
      '.tt-badge{font-size:.6rem;font-weight:700;letter-spacing:.08em;padding:3px 8px;border-radius:999px;text-transform:uppercase;white-space:nowrap;}',
      '.tt-badge.buy{background:rgba(102,187,106,0.16);color:var(--tt-green);border:1px solid rgba(102,187,106,0.4);}',
      '.tt-badge.sell{background:rgba(239,83,80,0.16);color:var(--tt-red);border:1px solid rgba(239,83,80,0.4);}',
      '.tt-row{display:flex;justify-content:space-between;gap:12px;padding:3px 0;}',
      '.tt-row .k{color:var(--tt-dim);white-space:nowrap;}',
      '.tt-row .v{text-align:right;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}',
      '.tt-v-green{color:var(--tt-green);}.tt-v-red{color:var(--tt-red);}.tt-v-gold{color:var(--tt-gold);}',
      '.tt-note{margin-top:8px;padding-top:8px;border-top:1px solid var(--tt-border);color:var(--tt-dim);font-size:.62rem;line-height:1.4;}',
      '.tt-more{margin-top:9px;width:100%;min-height:40px;border-radius:9px;border:1px solid var(--tt-border);',
      '  background:rgba(79,195,247,0.10);color:var(--tt-cyan);font-weight:700;letter-spacing:.05em;cursor:pointer;font-size:.66rem;}',
      '.tt-more:active{transform:scale(.98);}',
      '.tt-load{color:var(--tt-dim);font-style:italic;}',

      /* ── backdrop + modal ── */
      '.tt-backdrop{position:fixed;inset:0;z-index:' + Z.backdrop + ';background:rgba(2,4,9,0.72);',
      '  backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);opacity:0;transition:opacity .18s ease;',
      '  display:flex;align-items:center;justify-content:center;padding:max(14px,env(safe-area-inset-top)) 14px max(14px,env(safe-area-inset-bottom));}',
      '.tt-backdrop.tt-in{opacity:1;}',
      '.tt-modal{position:relative;z-index:' + Z.modal + ';width:min(560px,100%);max-height:min(88svh,88vh);',
      '  display:flex;flex-direction:column;min-height:0;background:var(--tt-panel);border:1px solid var(--tt-border);',
      '  border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,0.7);color:var(--tt-text);overflow:hidden;',
      '  transform:translateY(10px) scale(.99);opacity:0;transition:transform .2s ease,opacity .2s ease;}',
      '.tt-backdrop.tt-in .tt-modal{transform:translateY(0) scale(1);opacity:1;}',
      '.tt-m-hd{flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:15px 16px;border-bottom:1px solid var(--tt-border);cursor:grab;}',
      '.tt-m-hd:active{cursor:grabbing;}',
      '.tt-m-sym{font-weight:700;letter-spacing:.06em;font-size:clamp(1.05rem,4.4vw,1.4rem);}',
      '.tt-m-hd .tt-spacer{flex:1 1 auto;}',
      '.tt-x{flex:0 0 auto;width:38px;height:38px;min-width:38px;border-radius:10px;border:1px solid var(--tt-border);',
      '  background:transparent;color:var(--tt-dim);font-size:1.2rem;line-height:1;cursor:pointer;}',
      '.tt-x:active{transform:scale(.94);}',
      '.tt-m-body{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;',
      '  -webkit-overflow-scrolling:touch;padding:14px 16px 18px;}',
      '.tt-verdict{border-radius:13px;padding:14px;margin-bottom:14px;border:1px solid;}',
      '.tt-verdict.buy{background:rgba(102,187,106,0.08);border-color:rgba(102,187,106,0.34);}',
      '.tt-verdict.sell{background:rgba(239,83,80,0.08);border-color:rgba(239,83,80,0.34);}',
      '.tt-verdict h4{font-size:clamp(0.74rem,2.8vw,0.86rem);letter-spacing:.09em;text-transform:uppercase;margin:0 0 10px;color:var(--tt-gold);}',
      '.tt-vgrid{display:grid;grid-template-columns:1fr 1fr;gap:9px 14px;}',
      '@media(max-width:360px){.tt-vgrid{grid-template-columns:1fr;}}',
      '.tt-vcell .k{display:block;color:var(--tt-dim);font-size:.62rem;letter-spacing:.05em;margin-bottom:2px;}',
      '.tt-vcell .v{font-size:clamp(0.86rem,3.4vw,1.02rem);font-weight:700;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}',
      '.tt-sec{margin-top:16px;}',
      '.tt-sec h5{font-size:.64rem;letter-spacing:.13em;text-transform:uppercase;color:var(--tt-cyan);margin:0 0 8px;font-weight:700;}',
      '.tt-line{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:clamp(0.68rem,2.5vw,0.78rem);}',
      '.tt-line:last-child{border-bottom:0;}',
      '.tt-line .k{color:var(--tt-dim);overflow-wrap:anywhere;}',
      '.tt-line .v{text-align:right;font-variant-numeric:tabular-nums;overflow-wrap:anywhere;font-weight:700;}',
      '.tt-chip{display:inline-block;font-size:.62rem;padding:3px 9px;border-radius:999px;border:1px solid var(--tt-border);color:var(--tt-dim);background:rgba(255,255,255,0.03);}',
      '.tt-chip.warn{color:var(--tt-orange);border-color:rgba(255,167,38,0.4);background:rgba(255,167,38,0.08);}',
      '.tt-help{cursor:help;color:var(--tt-dim);border-bottom:1px dotted var(--tt-dim);}',
      '.tt-mode{font-weight:700;letter-spacing:.08em;}',
      '.tt-mode.paper{color:var(--tt-cyan);}.tt-mode.live{color:var(--tt-orange);}',
      '.tt-m-ft{flex:0 0 auto;display:flex;gap:10px;padding:12px 16px calc(12px + env(safe-area-inset-bottom));border-top:1px solid var(--tt-border);background:rgba(6,10,18,0.6);}',
      '.tt-btn{flex:1 1 0;min-height:46px;border-radius:11px;font-weight:700;letter-spacing:.05em;cursor:pointer;font-size:clamp(0.72rem,2.8vw,0.82rem);border:1px solid var(--tt-border);}',
      '.tt-btn.ghost{background:transparent;color:var(--tt-dim);}',
      '.tt-btn.buy{background:var(--tt-green);color:#04140a;border-color:var(--tt-green);}',
      '.tt-btn.sell{background:var(--tt-red);color:#1a0505;border-color:var(--tt-red);}',
      '.tt-btn:active{transform:scale(.98);}',
      '.tt-btn:disabled{opacity:.5;cursor:not-allowed;}',
      '.tt-halt{color:var(--tt-orange);font-size:.66rem;text-align:center;padding:8px 4px 0;letter-spacing:.04em;}',

      /* ── confirm dialog ── */
      '.tt-cf{width:min(420px,100%);z-index:' + Z.confirm + ';}',
      '.tt-cf .tt-m-body{padding:16px;}',
      '.tt-cf-warn{font-size:clamp(0.72rem,2.8vw,0.82rem);line-height:1.5;color:var(--tt-text);margin-bottom:12px;}',
      '.tt-cf-ta{width:100%;min-height:60px;margin-top:6px;background:rgba(2,5,10,0.6);border:1px solid var(--tt-border);',
      '  border-radius:9px;color:var(--tt-text);font-family:inherit;font-size:.74rem;padding:8px 10px;resize:vertical;}',
      '.tt-result{margin-top:12px;padding:10px 12px;border-radius:9px;font-size:.7rem;line-height:1.5;overflow-wrap:anywhere;white-space:pre-wrap;}',
      '.tt-result.ok{background:rgba(102,187,106,0.10);border:1px solid rgba(102,187,106,0.4);color:var(--tt-green);}',
      '.tt-result.err{background:rgba(239,83,80,0.10);border:1px solid rgba(239,83,80,0.4);color:var(--tt-red);}',

      '@media (prefers-reduced-motion: reduce){',
      '  .tt-pop,.tt-backdrop,.tt-modal{transition:none !important;}',
      '}',
    ].join('\n');
    var style = el('style');
    style.id = 'tt-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPACT TOOLTIP
  // ═══════════════════════════════════════════════════════════════════════════
  var activePop = null;
  function dismissPop() {
    if (activePop && activePop.parentNode) activePop.parentNode.removeChild(activePop);
    activePop = null;
    document.removeEventListener('scroll', dismissPop, true);
  }

  function positionPop(pop, anchor) {
    // Never cover the anchor. Prefer above; flip below if no room; clamp X.
    var m = 8;
    var ar = anchor.getBoundingClientRect();
    var pw = pop.offsetWidth, ph = pop.offsetHeight;
    var vw = window.innerWidth, vh = window.innerHeight;

    var top = ar.top - ph - m;
    if (top < m) {
      top = ar.bottom + m;                       // flip below
      if (top + ph > vh - m) top = Math.max(m, vh - ph - m);
    }
    var left = ar.left + ar.width / 2 - pw / 2;  // centre on anchor
    left = Math.max(m, Math.min(vw - pw - m, left));
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  function renderPopLoading(pop, symbol, action) {
    pop.innerHTML = '';
    var hd = el('div', 'tt-pop-hd');
    hd.appendChild(el('span', 'tt-pop-sym', symbol));
    hd.appendChild(el('span', 'tt-badge ' + action, action));
    pop.appendChild(hd);
    pop.appendChild(el('div', 'tt-load', 'Reading the tape…'));
  }

  function popRow(k, v, cls) {
    var row = el('div', 'tt-row');
    row.appendChild(el('span', 'k', k));
    var vn = el('span', 'v' + (cls ? ' ' + cls : ''), v);
    row.appendChild(vn);
    return row;
  }

  async function fillPop(pop, symbol, action, qty) {
    var res = await analyze(symbol);
    if (activePop !== pop) return; // dismissed while loading
    pop.innerHTML = '';
    var hd = el('div', 'tt-pop-hd');
    hd.appendChild(el('span', 'tt-pop-sym', symbol));
    hd.appendChild(el('span', 'tt-badge ' + action, action));
    pop.appendChild(hd);

    var a = res.data;
    if (!res.ok || !a || (a.error && !a.quote)) {
      pop.appendChild(popRow('Data', 'unavailable', 'tt-v-red'));
      pop.appendChild(el('div', 'tt-note', a && a.error ? esc(a.error) : 'Analysis endpoint did not respond. No numbers to show — nothing fabricated.'));
      requestAnimationFrame(function () { positionPop(pop, pop._anchor); });
      return;
    }
    var quote = a.quote || null;
    var tech = a.technicals || null;
    var price = quote && isNum(Number(quote.price)) ? Number(quote.price) : null;
    var atr = tech && tech.atr && isNum(Number(tech.atr.current)) ? Number(tech.atr.current) : null;
    var risk = computeRisk(price, atr, action, isNum(qty) ? qty : 1);
    var chg = quoteChange(quote);

    pop.appendChild(popRow('Price', price != null ? money(price) : 'unavailable',
      price == null ? 'tt-v-red' : ''));
    if (chg) {
      pop.appendChild(popRow('Change', (chg.abs >= 0 ? '+' : '') + money(chg.abs) + ' (' + (chg.pct >= 0 ? '+' : '') + pct(chg.pct) + ')',
        chg.abs >= 0 ? 'tt-v-green' : 'tt-v-red'));
    }
    pop.appendChild(popRow('Volatility (ATR)', risk.volPct != null ? pct(risk.volPct) : 'unavailable', 'tt-v-gold'));
    pop.appendChild(popRow('Exposure (×' + (isNum(qty) ? qty : 1) + ')', risk.exposure != null ? money(risk.exposure) : '—'));
    pop.appendChild(popRow('Max loss', risk.maxLoss != null ? money(-risk.maxLoss) : '—', 'tt-v-red'));
    pop.appendChild(popRow('Max gain', risk.maxGain != null ? money(risk.maxGain) : '—', 'tt-v-green'));
    pop.appendChild(popRow('R : R', risk.rr != null ? ('1 : ' + risk.rr) : '—'));

    var note = el('div', 'tt-note',
      'Stop/target are suggested, ATR-derived (1.5×/2× ATR) — not orders. Tap for full analysis.');
    pop.appendChild(note);

    var more = el('button', 'tt-more', 'DEEP ANALYSIS →');
    more.setAttribute('data-draggable', 'false');
    more.addEventListener('click', function (e) {
      e.stopPropagation();
      dismissPop();
      openModal(symbol, { action: action, qty: qty });
    });
    pop.appendChild(more);

    requestAnimationFrame(function () { positionPop(pop, pop._anchor); });
  }

  function showPop(anchor, opts) {
    dismissPop();
    injectCSS();
    var symbol = String(opts.symbol || '').toUpperCase();
    var action = opts.action === 'sell' ? 'sell' : 'buy';
    var qty = isNum(Number(opts.qty)) ? Number(opts.qty) : 1;

    var pop = el('div', 'tt-pop');
    pop._anchor = anchor;
    document.body.appendChild(pop);
    activePop = pop;
    renderPopLoading(pop, symbol, action);
    requestAnimationFrame(function () {
      positionPop(pop, anchor);
      pop.classList.add('tt-in');
    });
    // dismiss on scroll or outside tap
    document.addEventListener('scroll', dismissPop, true);
    setTimeout(function () {
      document.addEventListener('pointerdown', function onDoc(e) {
        if (activePop === pop && !pop.contains(e.target) && e.target !== anchor) {
          dismissPop();
          document.removeEventListener('pointerdown', onDoc, true);
        }
      }, true);
    }, 0);
    fillPop(pop, symbol, action, qty);
  }

  function attach(elm, opts) {
    if (!elm || !opts || !opts.symbol) return;
    injectCSS();
    if (isTouch()) {
      // long-press to summon; short tap still fires the element's own click
      var timer = null, moved = false, sx = 0, sy = 0;
      elm.addEventListener('touchstart', function (e) {
        moved = false;
        if (e.touches && e.touches[0]) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }
        timer = setTimeout(function () { if (!moved) showPop(elm, opts); }, 420);
      }, { passive: true });
      elm.addEventListener('touchmove', function (e) {
        if (e.touches && e.touches[0]) {
          if (Math.abs(e.touches[0].clientX - sx) > 8 || Math.abs(e.touches[0].clientY - sy) > 8) {
            moved = true; clearTimeout(timer);
          }
        }
      }, { passive: true });
      elm.addEventListener('touchend', function () { clearTimeout(timer); }, { passive: true });
      elm.addEventListener('touchcancel', function () { clearTimeout(timer); }, { passive: true });
    } else {
      var hoverT = null;
      elm.addEventListener('mouseenter', function () {
        hoverT = setTimeout(function () { showPop(elm, opts); }, 160);
      });
      elm.addEventListener('mouseleave', function () {
        clearTimeout(hoverT);
        // small grace so the pointer can travel into the pop to click "DEEP ANALYSIS"
        setTimeout(function () {
          if (activePop && !activePop.matches(':hover') && !elm.matches(':hover')) dismissPop();
        }, 120);
      });
      elm.addEventListener('focus', function () { showPop(elm, opts); });
      elm.addEventListener('blur', function () {
        setTimeout(function () { if (activePop && !activePop.matches(':hover')) dismissPop(); }, 120);
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DEEP-ANALYSIS MODAL
  // ═══════════════════════════════════════════════════════════════════════════
  var activeModal = null;
  function closeModal() {
    if (!activeModal) return;
    var bd = activeModal;
    bd.classList.remove('tt-in');
    setTimeout(function () { if (bd.parentNode) bd.parentNode.removeChild(bd); }, 200);
    document.removeEventListener('keydown', onModalKey, true);
    activeModal = null;
  }
  function onModalKey(e) { if (e.key === 'Escape') closeModal(); }

  function line(k, v, cls) {
    var l = el('div', 'tt-line');
    var kk = el('span', 'k'); kk.innerHTML = k;
    var vv = el('span', 'v' + (cls ? ' ' + cls : '')); vv.innerHTML = v;
    l.appendChild(kk); l.appendChild(vv);
    return l;
  }
  function vcell(k, v, cls) {
    var c = el('div', 'tt-vcell');
    c.appendChild(el('span', 'k', k));
    var vv = el('span', 'v' + (cls ? ' ' + cls : '')); vv.innerHTML = v;
    c.appendChild(vv);
    return c;
  }

  async function openModal(symbol, opts) {
    injectCSS();
    closeModal();
    symbol = String(symbol || '').toUpperCase();
    opts = opts || {};
    var action = opts.action === 'sell' ? 'sell' : 'buy';
    var qty = isNum(Number(opts.qty)) ? Number(opts.qty) : 1;

    var backdrop = el('div', 'tt-backdrop');
    var modal = el('div', 'tt-modal');
    modal.setAttribute('data-draggable', 'true');
    modal.setAttribute('data-draggable-handle', '.tt-m-hd');
    modal.id = 'tt-modal-' + symbol;

    var hd = el('div', 'tt-m-hd');
    hd.appendChild(el('span', 'tt-m-sym', symbol));
    var badge = el('span', 'tt-badge ' + action, action); hd.appendChild(badge);
    hd.appendChild(el('span', 'tt-spacer'));
    var x = el('button', 'tt-x', '×');
    x.setAttribute('data-draggable', 'false');
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', closeModal);
    hd.appendChild(x);
    modal.appendChild(hd);

    var body = el('div', 'tt-m-body');
    body.appendChild(el('div', 'tt-load', 'Gathering everything that could happen…'));
    modal.appendChild(body);

    var ft = el('div', 'tt-m-ft');
    var cancel = el('button', 'tt-btn ghost', 'CLOSE');
    cancel.setAttribute('data-draggable', 'false');
    cancel.addEventListener('click', closeModal);
    var go = el('button', 'tt-btn ' + action, (action === 'sell' ? 'SELL ' : 'BUY ') + symbol);
    go.setAttribute('data-draggable', 'false');
    go.disabled = true;
    ft.appendChild(cancel);
    ft.appendChild(go);
    modal.appendChild(ft);

    backdrop.appendChild(modal);
    backdrop.addEventListener('pointerdown', function (e) { if (e.target === backdrop) closeModal(); });
    document.body.appendChild(backdrop);
    activeModal = backdrop;
    document.addEventListener('keydown', onModalKey, true);
    requestAnimationFrame(function () { backdrop.classList.add('tt-in'); });

    // ── gather everything in parallel ──
    var results = await Promise.all([
      analyze(symbol), tradeState(), portfolio(), accounting(), history(150), bodyState(), sentiment(symbol),
    ]);
    if (activeModal !== backdrop) return; // closed while loading
    var aRes = results[0], sRes = results[1], pRes = results[2], acRes = results[3],
        hRes = results[4], bRes = results[5], senRes = results[6];

    var a = aRes.data || {};
    var quote = a.quote || null;
    var tech = a.technicals || null;
    var price = quote && isNum(Number(quote.price)) ? Number(quote.price) : null;
    var atr = tech && tech.atr && isNum(Number(tech.atr.current)) ? Number(tech.atr.current) : null;
    var risk = computeRisk(price, atr, action, qty);
    var chg = quoteChange(quote);

    var st = sRes.ok ? sRes.data : null;
    var mode = st && st.mode ? String(st.mode) : 'unknown';
    var halted = st ? !!st.halted : false;

    var bp = extractBuyingPower(pRes.ok ? pRes.data : null, acRes.ok ? acRes.data : null);
    var pctOfBP = (isNum(bp) && risk.exposure != null && bp > 0) ? +(risk.exposure / bp * 100).toFixed(1) : null;

    var histSum = summariseHistory(hRes.ok && hRes.data ? hRes.data.history : null, symbol);
    var brain = readBrainState(bRes.ok ? bRes.data : null);

    // ── render ──
    body.innerHTML = '';

    // THE VERDICT — the answer to Vinta's exact complaint
    var verdict = el('div', 'tt-verdict ' + action);
    verdict.appendChild(el('h4', null, 'IF YOU GO THROUGH WITH THIS TRADE'));
    var vg = el('div', 'tt-vgrid');
    vg.appendChild(vcell('Action', esc(action.toUpperCase()) + ' × ' + qty, action === 'sell' ? 'tt-v-red' : 'tt-v-green'));
    vg.appendChild(vcell('Exposure', risk.exposure != null ? money(risk.exposure) : '—'));
    vg.appendChild(vcell('Max loss (to stop)', risk.maxLoss != null ? money(-risk.maxLoss) : '—', 'tt-v-red'));
    vg.appendChild(vcell('Max gain (to target)', risk.maxGain != null ? money(risk.maxGain) : '—', 'tt-v-green'));
    vg.appendChild(vcell('R : R', risk.rr != null ? ('1 : ' + risk.rr) : '—', 'tt-v-gold'));
    vg.appendChild(vcell('% of buying power', pctOfBP != null ? pct(pctOfBP, 1) : 'unknown'));
    verdict.appendChild(vg);
    var modeChip = el('div');
    modeChip.style.marginTop = '11px';
    modeChip.innerHTML = 'Server mode: <span class="tt-mode ' + (mode === 'live' ? 'live' : 'paper') + '">'
      + esc(mode.toUpperCase()) + '</span>'
      + (halted ? ' &nbsp;<span class="tt-chip warn">TRADING HALTED</span>' : '');
    verdict.appendChild(modeChip);
    body.appendChild(verdict);

    // 1. PRICE
    var secP = el('div', 'tt-sec');
    secP.appendChild(el('h5', null, 'Price'));
    secP.appendChild(line('Live price', price != null ? money(price) : '<span class="tt-chip warn">unavailable</span>',
      price == null ? 'tt-v-red' : ''));
    if (chg) {
      secP.appendChild(line('Change vs prev close',
        (chg.abs >= 0 ? '+' : '') + money(chg.abs) + ' (' + (chg.pct >= 0 ? '+' : '') + pct(chg.pct) + ')',
        chg.abs >= 0 ? 'tt-v-green' : 'tt-v-red'));
    }
    if (tech && tech.asOf) secP.appendChild(line('Technicals as of', esc(String(tech.asOf))));
    body.appendChild(secP);

    // 2. VOLATILITY
    var secV = el('div', 'tt-sec');
    secV.appendChild(el('h5', null, 'Volatility'));
    secV.appendChild(line('Volatility (ATR-based) <span class="tt-help" title="True options implied volatility (IV) is not wired yet. This is realized volatility derived from ATR / price — a different, honest measure.">?</span>',
      risk.volPct != null ? pct(risk.volPct) : '<span class="tt-chip warn">unavailable</span>', 'tt-v-gold'));
    if (atr != null) secV.appendChild(line('ATR (current)', money(atr)));
    if (tech && tech.atr && isNum(Number(tech.atr.avg))) secV.appendChild(line('ATR (avg)', money(Number(tech.atr.avg))));
    if (tech && isNum(Number(tech.rsi))) secV.appendChild(line('RSI', Number(tech.rsi).toFixed(1)));
    secV.appendChild(el('div', 'tt-note', ''));
    var ivNote = el('div'); ivNote.style.marginTop = '4px';
    ivNote.innerHTML = '<span class="tt-chip">Options IV not wired — ATR realized-vol shown instead</span>';
    secV.appendChild(ivNote);
    body.appendChild(secV);

    // 3. NEWS SENTIMENT
    var secS = el('div', 'tt-sec');
    secS.appendChild(el('h5', null, 'News sentiment'));
    if (senRes.ok && senRes.data && (isNum(Number(senRes.data.score)) || senRes.data.label)) {
      var sc = isNum(Number(senRes.data.score)) ? Number(senRes.data.score) : null;
      secS.appendChild(line('Sentiment', esc(senRes.data.label || '') + (sc != null ? (' (' + sc + ')') : '')));
    } else {
      var chip = el('div');
      chip.innerHTML = '<span class="tt-chip warn">Sentiment engine coming online — not yet tracked</span>';
      secS.appendChild(chip);
    }
    body.appendChild(secS);

    // 4. RISK / REWARD (suggested, ATR-derived)
    var secR = el('div', 'tt-sec');
    secR.appendChild(el('h5', null, 'Risk / Reward — suggested, ATR-derived'));
    secR.appendChild(line('Entry (limit = live)', price != null ? money(price) : '—'));
    secR.appendChild(line('Suggested stop (1.5× ATR)', risk.stop != null ? money(risk.stop) : '—', 'tt-v-red'));
    secR.appendChild(line('Suggested target (2× ATR)', risk.target != null ? money(risk.target) : '—', 'tt-v-green'));
    secR.appendChild(line('Risk / share', risk.riskPerShare != null ? money(risk.riskPerShare) : '—'));
    secR.appendChild(line('Reward / share', risk.rewardPerShare != null ? money(risk.rewardPerShare) : '—'));
    secR.appendChild(line('Max loss @ ' + qty, risk.maxLoss != null ? money(-risk.maxLoss) : '—', 'tt-v-red'));
    secR.appendChild(line('Max gain @ ' + qty, risk.maxGain != null ? money(risk.maxGain) : '—', 'tt-v-green'));
    body.appendChild(secR);

    // 5. BRAIN STATE
    var secB = el('div', 'tt-sec');
    secB.appendChild(el('h5', null, 'Vintinuum brain state'));
    secB.appendChild(line('Right now', esc(brain.label)));
    body.appendChild(secB);

    // 6. POSITION SIZE
    var secPos = el('div', 'tt-sec');
    secPos.appendChild(el('h5', null, 'Position size'));
    secPos.appendChild(line('Exposure', risk.exposure != null ? money(risk.exposure) : '—'));
    secPos.appendChild(line('Buying power', isNum(bp) ? money(bp) : '<span class="tt-chip warn">unknown — broker did not report it</span>'));
    secPos.appendChild(line('% of buying power', pctOfBP != null ? pct(pctOfBP, 1) : '—'));
    body.appendChild(secPos);

    // 7. HISTORICAL ACCURACY
    var secH = el('div', 'tt-sec');
    secH.appendChild(el('h5', null, 'Historical accuracy'));
    if (!histSum.available) {
      secH.appendChild(line('History', '<span class="tt-chip warn">unavailable</span>'));
    } else if (histSum.total === 0) {
      secH.appendChild(line('History', 'No trade history yet.'));
    } else {
      secH.appendChild(line('Prior decisions on ' + symbol, String(histSum.forSymbol)));
      secH.appendChild(line('Prior decisions (all)', String(histSum.total)));
    }
    if (histSum.note) secH.appendChild(el('div', 'tt-note', histSum.note));
    body.appendChild(secH);

    // why am I seeing this (transparency)
    var why = el('div', 'tt-sec');
    var whyNote = el('div', 'tt-note',
      'Every number here is live from the trading brain or honestly marked unavailable — nothing is invented. This screen exists so no trade fires blind.');
    why.appendChild(whyNote);
    body.appendChild(why);

    // enable / gate the action button
    if (halted) {
      go.disabled = true;
      go.textContent = 'HALTED';
      var haltMsg = el('div', 'tt-halt', 'Trading is halted (kill switch). No orders can be placed.');
      body.appendChild(haltMsg);
    } else if (price == null) {
      go.disabled = true;
      go.textContent = 'NO PRICE';
    } else {
      go.disabled = false;
      go.addEventListener('click', async function () {
        var ok = await TradeTooltip.confirm({ symbol: symbol, action: action, qty: qty, price: price, mode: mode });
        if (ok) closeModal();
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIRM DIALOG  →  Promise<boolean>
  // Fixes the blind $0.35 sell: echoes exact exposure + true server mode, and
  // requires an explicit click. Submits to /api/trading/decide with the exact
  // confirmMode/confirmExposure contract the server enforces (409 on mismatch).
  // ═══════════════════════════════════════════════════════════════════════════
  function confirm(opts) {
    injectCSS();
    return new Promise(function (resolve) {
      opts = opts || {};
      var symbol = String(opts.symbol || '').toUpperCase();
      var action = opts.action === 'sell' ? 'sell' : 'buy';
      var qty = isNum(Number(opts.qty)) ? Number(opts.qty) : 1;
      var price = Number(opts.price);
      var exposure = (isNum(price) && isNum(qty)) ? +(price * qty).toFixed(2) : null;

      var backdrop = el('div', 'tt-backdrop');
      var modal = el('div', 'tt-modal tt-cf');
      modal.setAttribute('data-draggable', 'true');
      modal.setAttribute('data-draggable-handle', '.tt-m-hd');

      var hd = el('div', 'tt-m-hd');
      hd.appendChild(el('span', 'tt-m-sym', 'Confirm'));
      hd.appendChild(el('span', 'tt-badge ' + action, action + ' ' + symbol));
      hd.appendChild(el('span', 'tt-spacer'));
      var x = el('button', 'tt-x', '×');
      x.setAttribute('data-draggable', 'false');
      hd.appendChild(x);
      modal.appendChild(hd);

      var body = el('div', 'tt-m-body');
      var warn = el('div', 'tt-cf-warn');
      warn.innerHTML = 'You are about to <b>' + esc(action.toUpperCase()) + ' ' + qty + ' ' + esc(symbol)
        + '</b> at a limit of <b>' + (isNum(price) ? money(price) : '—') + '</b>.';
      body.appendChild(warn);

      body.appendChild(line('Exposure', exposure != null ? money(exposure) : '—', 'tt-v-gold'));
      body.appendChild(line('Server mode',
        '<span class="tt-mode ' + (opts.mode === 'live' ? 'live' : 'paper') + '">' + esc(String(opts.mode || 'unknown').toUpperCase()) + '</span>'));
      if (opts.mode === 'paper') {
        var pn = el('div'); pn.style.marginTop = '8px';
        pn.innerHTML = '<span class="tt-chip">PAPER — logged only, no real execution</span>';
        body.appendChild(pn);
      } else if (opts.mode === 'live') {
        var ln = el('div'); ln.style.marginTop = '8px';
        ln.innerHTML = '<span class="tt-chip warn">LIVE — this queues a REAL order for owner approval</span>';
        body.appendChild(ln);
      }

      var reasonWrap = el('div'); reasonWrap.style.marginTop = '12px';
      reasonWrap.appendChild(el('h5', null, 'Reasoning (required by the brain)'));
      var ta = el('textarea', 'tt-cf-ta');
      ta.placeholder = 'Why this trade? (the /decide endpoint rejects an empty reasoning)';
      ta.value = 'Manual trade via Mercatus tooltip surface.';
      reasonWrap.appendChild(ta);
      body.appendChild(reasonWrap);

      var resultBox = el('div');
      body.appendChild(resultBox);
      modal.appendChild(body);

      var ft = el('div', 'tt-m-ft');
      var no = el('button', 'tt-btn ghost', 'CANCEL');
      no.setAttribute('data-draggable', 'false');
      var yes = el('button', 'tt-btn ' + action, 'SUBMIT ' + action.toUpperCase());
      yes.setAttribute('data-draggable', 'false');
      ft.appendChild(no);
      ft.appendChild(yes);
      modal.appendChild(ft);

      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);
      requestAnimationFrame(function () { backdrop.classList.add('tt-in'); });

      var settled = false;
      function finish(val) {
        if (settled) return;
        settled = true;
        backdrop.classList.remove('tt-in');
        setTimeout(function () { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); }, 200);
        document.removeEventListener('keydown', onKey, true);
        resolve(val);
      }
      function onKey(e) { if (e.key === 'Escape') finish(false); }
      document.addEventListener('keydown', onKey, true);

      x.addEventListener('click', function () { finish(false); });
      no.addEventListener('click', function () { finish(false); });
      backdrop.addEventListener('pointerdown', function (e) { if (e.target === backdrop) finish(false); });

      yes.addEventListener('click', async function () {
        if (exposure == null || !isNum(price)) {
          resultBox.innerHTML = '';
          var r0 = el('div', 'tt-result err', 'No live price — cannot submit a limit order safely.');
          resultBox.appendChild(r0);
          return;
        }
        var reasoning = (ta.value || '').trim();
        if (!reasoning) {
          resultBox.innerHTML = '';
          resultBox.appendChild(el('div', 'tt-result err', 'Reasoning is required — the brain rejects an empty note.'));
          return;
        }
        yes.disabled = true; no.disabled = true;
        yes.textContent = 'SUBMITTING…';
        var res = await postJSON('/api/trading/decide', {
          action: action,
          symbol: symbol,
          quantity: qty,
          price: price,
          reasoning: reasoning,
          source: 'panel',
          confirmMode: opts.mode,
          confirmExposure: exposure,
        });
        resultBox.innerHTML = '';
        var d = res.data || {};
        if (res.ok) {
          var okBox = el('div', 'tt-result ok');
          okBox.textContent = 'Server accepted (' + res.status + '): status=' + (d.status || '?')
            + (d.message ? ('\n' + d.message) : '')
            + (d.mode ? ('\nmode: ' + d.mode) : '')
            + (isNum(d.exposure) ? ('\nexposure: ' + money(d.exposure)) : '');
          resultBox.appendChild(okBox);
          setTimeout(function () { finish(true); }, 1400);
        } else {
          var errBox = el('div', 'tt-result err');
          var msg = (d && (d.error || d.reason)) ? (d.error || d.reason)
            : (res.error ? res.error : ('HTTP ' + res.status));
          errBox.textContent = 'Rejected (' + res.status + '): ' + msg
            + (isNum(d.exposure) ? ('\nserver exposure: ' + money(d.exposure)) : '')
            + (d.mode ? ('\nserver mode: ' + d.mode) : '');
          resultBox.appendChild(errBox);
          yes.disabled = false; no.disabled = false;
          yes.textContent = 'RETRY SUBMIT';
        }
      });
    });
  }

  // ── public surface ──────────────────────────────────────────────────────────
  window.TradeTooltip = {
    attach: attach,
    openModal: openModal,
    confirm: confirm,
    _version: '2.0-mercatus-phase2',
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCSS);
  } else {
    injectCSS();
  }
})();
