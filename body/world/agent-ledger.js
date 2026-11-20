/**
 * AgentLedger — QUARANTINED MOCK (RVCP3MY).
 *
 * ⛔ THIS IS NOT THE WORLD'S MONEY. It never was.
 *
 * What this file used to be: a dual-currency "treasury" in a module-scope
 * `treasuries = {}`, seeded by AgentWeb.boot() with a flat 1000 "LUM" per agent
 * plus an "XMR" column, fetching nothing, persisting nothing, resetting on
 * every page load. Its numbers were invented at boot and bore no relation to
 * anything the server knows. (It was sometimes described as a localStorage
 * mock; MEASURED, `grep -c localStorage` on the original was 0 — it never
 * persisted at all. The `agent-msg-*` localStorage keys in agent-web.js are
 * cross-tab MESSAGES, not ledger state.)
 *
 * Where the real money is, and has been since Phase 2:
 *   · the `ledger` table — double-entry, integral, mint-only (WORLD_SPEC §4),
 *     written only through world-ledger.post() behind the §3 action validator
 *   · GET /api/world/treasury  — every citizen's balance + per-in-world-day
 *                                deltas (RVCP3MY, what the panel now reads)
 *   · GET /api/world/ledger    — the journal tail + the four-rule audit
 *   · GET /api/world/agent/:id — one citizen's wallet, drift, lifetime flows
 *   · GET /api/world/citizens  — wallet_balance per citizen
 *
 * "LUM" and "XMR" exist nowhere on the server. The world has ONE unnamed
 * minted currency, and real money is OFF with no code path here that can turn
 * it on — enableRealMoney() now refuses unconditionally.
 *
 * WHY IT IS QUARANTINED RATHER THAN DELETED: AgentWeb.boot() (world.html),
 * agent-exchange.js and agent-drive.js all call into this surface, so removing
 * the global would turn a fake number into a thrown TypeError on the live page.
 * Instead every read now answers **null** and every write REFUSES, so the
 * Z3BMNEU agent-network experiment keeps its shape while being structurally
 * incapable of showing anyone a fabricated balance. A benign plausible number
 * is the expensive failure; null is the honest one, and the callers already
 * treat a falsy balance as "insufficient funds" (fail-closed).
 *
 * TO DRIVE THE PHASE-1 EXPERIMENT DELIBERATELY: load world.html with
 * `?agentmock=1`, or set `window.VINT_AGENT_MOCK = true` before this script.
 * Armed, it behaves exactly as it always did — and stamps itself so any
 * surface can tell it is reading a simulation.
 */

const AgentLedger = (function() {
  'use strict';

  // ── THE QUARANTINE GATE ───────────────────────────────────────────────────
  // Opt-IN, decided once at load. Default OFF: a mock must never be the thing
  // that happens when nobody chose anything.
  function _armed() {
    try {
      if (typeof window === 'undefined') return false;
      if (window.VINT_AGENT_MOCK === true) return true;
      return /[?&]agentmock=1\b/.test(window.location.search || '');
    } catch (_) { return false; }
  }
  const ARMED = _armed();

  // The stamp. Any surface that finds itself holding one of these numbers can
  // ask whether it is real, instead of assuming.
  try {
    if (typeof window !== 'undefined') {
      window.__AGENT_LEDGER_IS_MOCK = true;
      window.__AGENT_LEDGER_ARMED = ARMED;
      window.__AGENT_LEDGER_REAL_SOURCE = '/api/world/treasury';
    }
  } catch (_) {}

  if (!ARMED && typeof console !== 'undefined' && console.info) {
    console.info('[AgentLedger] QUARANTINED mock — balances read null. The real ' +
      'money is GET /api/world/treasury (see body/world/agent-ledger.js header). ' +
      'Arm the simulation with ?agentmock=1.');
  }

  const QUARANTINED = { ok: false, error: 'AgentLedger is a quarantined mock — the real money is GET /api/world/treasury. Arm with ?agentmock=1.' };

  // Treasuries: {agentId: {LUM: number, XMR: number}} — only ever populated
  // when ARMED.
  const treasuries = {};
  const journal = [];
  let moneroWallet = null;

  function init(agents, startingBalance = 1000) {
    if (!ARMED) return QUARANTINED;
    agents.forEach(agent => {
      const agentId = agent.id || agent;
      treasuries[agentId] = { LUM: startingBalance, XMR: 0 };
    });
    _log('init', 'system', 'LUM', agents.length * startingBalance,
         `Seeded ${agents.length} agents with ${startingBalance}Ⱡ each (SIMULATED)`);
    return { ok: true, simulated: true };
  }

  /**
   * Balance. Returns **null** when quarantined — not 0, and never a seeded
   * number. null is distinguishable from "this agent genuinely holds nothing",
   * which 0 is not.
   */
  function balance(agentId, currency = 'LUM') {
    if (!ARMED) return null;
    if (!treasuries[agentId]) return 0;
    return treasuries[agentId][currency] || 0;
  }

  function transfer(fromId, toId, amount, currency = 'LUM', reason = '') {
    if (!ARMED) return QUARANTINED;
    if (amount <= 0) return {ok: false, error: 'Amount must be positive'};
    if (!treasuries[fromId]) return {ok: false, error: 'Sender not found'};
    if (!treasuries[toId]) return {ok: false, error: 'Recipient not found'};

    const fromBalance = balance(fromId, currency);
    if (fromBalance < amount) {
      return {ok: false, error: 'Insufficient funds', balance: fromBalance};
    }
    // Real money is OFF and cannot be armed (enableRealMoney refuses), so this
    // branch is unreachable today and stays as the fail-closed guard it was.
    if (currency === 'XMR') {
      return {ok: false, error: 'Real money transfers are OFF'};
    }

    treasuries[fromId][currency] -= amount;
    treasuries[toId][currency] += amount;
    _log('transfer', fromId, currency, -amount, `To ${toId}: ${reason}`);
    _log('transfer', toId, currency, amount, `From ${fromId}: ${reason}`);
    return {ok: true, balance: treasuries[fromId][currency], simulated: true};
  }

  function seedVirtual(agentId, amount, reason = '') {
    if (!ARMED) return QUARANTINED;
    if (!treasuries[agentId]) treasuries[agentId] = {LUM: 0, XMR: 0};
    treasuries[agentId].LUM += amount;
    _log('seed', agentId, 'LUM', amount, reason);
    return {ok: true, balance: treasuries[agentId].LUM, simulated: true};
  }

  /**
   * Real money. REFUSES unconditionally — armed or not. WORLD_SPEC §4 gives the
   * world one minted currency and nothing else; real-money custody is not a
   * thing a client-side module may hold, and RVCP3MY's standing requirement is
   * that real money stays OFF.
   */
  function seedReal() {
    return {ok: false, error: 'Real money is OFF (RVCP3MY) — this mock holds no custody of anything real'};
  }

  function enableRealMoney(walletConfig) {
    moneroWallet = null;   // never retained
    void walletConfig;
    return {ok: false, error: 'Real money is OFF (RVCP3MY) and cannot be enabled from the client'};
  }

  function getJournal() { return ARMED ? [...journal] : []; }
  function getAgentJournal(agentId) { return ARMED ? journal.filter(e => e.agent === agentId) : []; }

  function snapshot() {
    if (!ARMED) return {};
    const balances = {};
    Object.keys(treasuries).forEach(agentId => { balances[agentId] = {...treasuries[agentId]}; });
    return balances;
  }

  function _log(event, agent, currency, amount, details) {
    journal.push({ timestamp: Date.now(), event, agent, currency, amount, details, simulated: true });
  }

  return {
    init,
    balance,
    transfer,
    seedVirtual,
    seedReal,
    journal: getJournal,
    agentJournal: getAgentJournal,
    snapshot,
    enableRealMoney,
    isRealMoneyEnabled: () => false,
    // The two questions a caller must be able to ask about this module.
    isMock: () => true,
    isArmed: () => ARMED,
    realSource: () => '/api/world/treasury',
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgentLedger;
}
