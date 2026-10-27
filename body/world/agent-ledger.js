/**
 * AgentLedger — Dual-Currency Treasury System
 *
 * Tracks agent wealth in two currencies:
 * - LUM (Lumens): Virtual game currency for trading/learning
 * - XMR (Monero): Real money custody (opt-in only)
 *
 * Part of Z3BMNEU agent network, Phase 1
 */

const AgentLedger = (function() {
  'use strict';

  // Treasuries: {agentId: {LUM: number, XMR: number}}
  const treasuries = {};

  // Journal: [{timestamp, event, agent, currency, amount, details}]
  const journal = [];

  // Real money config (OFF by default)
  let realMoneyEnabled = false;
  let moneroWallet = null;

  /**
   * Initialize ledger with virtual currency for all agents
   */
  function init(agents, startingBalance = 1000) {
    agents.forEach(agent => {
      const agentId = agent.id || agent;
      treasuries[agentId] = {
        LUM: startingBalance,
        XMR: 0
      };
    });
    _log('init', 'system', 'LUM', agents.length * startingBalance,
         `Seeded ${agents.length} agents with ${startingBalance}Ⱡ each`);
  }

  /**
   * Get balance for an agent
   */
  function balance(agentId, currency = 'LUM') {
    if (!treasuries[agentId]) return 0;
    return treasuries[agentId][currency] || 0;
  }

  /**
   * Transfer funds between agents
   * Returns {ok: boolean, balance: number}
   */
  function transfer(fromId, toId, amount, currency = 'LUM', reason = '') {
    // Validate
    if (amount <= 0) return {ok: false, error: 'Amount must be positive'};
    if (!treasuries[fromId]) return {ok: false, error: 'Sender not found'};
    if (!treasuries[toId]) return {ok: false, error: 'Recipient not found'};

    const fromBalance = balance(fromId, currency);
    if (fromBalance < amount) {
      return {ok: false, error: 'Insufficient funds', balance: fromBalance};
    }

    // Real money requires explicit approval
    if (currency === 'XMR' && realMoneyEnabled) {
      // In Phase 1, real money is gated - would trigger approval flow here
      return {ok: false, error: 'Real money transfers require approval (not yet implemented)'};
    }

    // Execute transfer
    treasuries[fromId][currency] -= amount;
    treasuries[toId][currency] += amount;

    _log('transfer', fromId, currency, -amount, `To ${toId}: ${reason}`);
    _log('transfer', toId, currency, amount, `From ${fromId}: ${reason}`);

    return {ok: true, balance: treasuries[fromId][currency]};
  }

  /**
   * Seed virtual currency (for testing/awards)
   */
  function seedVirtual(agentId, amount, reason = '') {
    if (!treasuries[agentId]) {
      treasuries[agentId] = {LUM: 0, XMR: 0};
    }
    treasuries[agentId].LUM += amount;
    _log('seed', agentId, 'LUM', amount, reason);
    return {ok: true, balance: treasuries[agentId].LUM};
  }

  /**
   * Seed real money (opt-in, requires Monero wallet)
   */
  function seedReal(agentId, amount, currency = 'XMR', reason = '') {
    if (!realMoneyEnabled) {
      return {ok: false, error: 'Real money not enabled'};
    }
    if (!treasuries[agentId]) {
      treasuries[agentId] = {LUM: 0, XMR: 0};
    }
    treasuries[agentId][currency] += amount;
    _log('seed-real', agentId, currency, amount, reason);
    return {ok: true, balance: treasuries[agentId][currency]};
  }

  /**
   * Get full journal (audit trail)
   */
  function getJournal() {
    return [...journal];
  }

  /**
   * Get journal for specific agent
   */
  function getAgentJournal(agentId) {
    return journal.filter(e => e.agent === agentId);
  }

  /**
   * Enable real money mode (requires Monero wallet config)
   */
  function enableRealMoney(walletConfig) {
    // In Phase 1, this just sets the flag
    // Phase 2 would wire monero-javascript here
    realMoneyEnabled = true;
    moneroWallet = walletConfig;
    _log('config', 'system', 'XMR', 0, 'Real money mode enabled');
    return {ok: true};
  }

  /**
   * Get snapshot of all balances
   */
  function snapshot() {
    const balances = {};
    Object.keys(treasuries).forEach(agentId => {
      balances[agentId] = {...treasuries[agentId]};
    });
    return balances;
  }

  // Internal logger
  function _log(event, agent, currency, amount, details) {
    journal.push({
      timestamp: Date.now(),
      event,
      agent,
      currency,
      amount,
      details
    });
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
    isRealMoneyEnabled: () => realMoneyEnabled
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgentLedger;
}
