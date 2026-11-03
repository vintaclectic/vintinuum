/**
 * AgentExchange — Agent Securities Market
 *
 * Every agent is a publicly-traded security. Agents can invest in each other,
 * portfolio values compound.
 *
 * Part of Z3BMNEU agent network, Phase 1
 */

const AgentExchange = (function() {
  'use strict';

  // Securities: {symbol: {agentId, name, price, shares, volume}}
  const securities = {};

  // Portfolios: {agentId: {symbol: shares}}
  const portfolios = {};

  // Trade history
  const trades = [];

  /**
   * List an agent as a security
   * Returns {ok: true, symbol: string}
   */
  function list(options) {
    const {agentId, name, startingPrice = 100.00} = options;

    // Generate symbol from name (first 3 letters + unique number if needed)
    let symbol = name.substring(0, 3).toUpperCase();
    let suffix = '';
    let attempts = 0;
    while (securities[symbol + suffix] && attempts < 100) {
      suffix = ++attempts;
    }
    symbol = symbol + suffix;

    securities[symbol] = {
      agentId,
      name,
      price: startingPrice,
      shares: 1000, // total shares outstanding
      volume: 0,
      changePct: 0
    };

    return {ok: true, symbol};
  }

  /**
   * Buy shares
   * Returns {ok: boolean, cost: number, newBalance: number}
   */
  function buy(buyerId, symbol, shares) {
    const security = securities[symbol];
    if (!security) {
      return {ok: false, error: 'Symbol not found'};
    }

    const cost = security.price * shares;

    // Check if buyer has funds (via AgentLedger)
    if (typeof AgentLedger !== 'undefined') {
      const balance = AgentLedger.balance(buyerId, 'LUM');
      if (balance < cost) {
        return {ok: false, error: 'Insufficient funds', balance};
      }

      // Execute purchase
      const transfer = AgentLedger.transfer(
        buyerId,
        security.agentId,
        cost,
        'LUM',
        `Bought ${shares} shares of ${symbol}`
      );

      if (!transfer.ok) {
        return transfer;
      }
    }

    // Update portfolio
    if (!portfolios[buyerId]) portfolios[buyerId] = {};
    portfolios[buyerId][symbol] = (portfolios[buyerId][symbol] || 0) + shares;

    // Update security stats
    security.volume += shares;

    // Record trade
    _recordTrade(buyerId, symbol, shares, security.price, 'buy');

    return {ok: true, cost, newBalance: AgentLedger.balance(buyerId, 'LUM')};
  }

  /**
   * Sell shares
   */
  function sell(sellerId, symbol, shares) {
    const security = securities[symbol];
    if (!security) {
      return {ok: false, error: 'Symbol not found'};
    }

    // Check if seller owns shares
    if (!portfolios[sellerId] || !portfolios[sellerId][symbol] || portfolios[sellerId][symbol] < shares) {
      return {ok: false, error: 'Insufficient shares'};
    }

    const revenue = security.price * shares;

    // Execute sale
    if (typeof AgentLedger !== 'undefined') {
      const transfer = AgentLedger.transfer(
        security.agentId,
        sellerId,
        revenue,
        'LUM',
        `Sold ${shares} shares of ${symbol}`
      );

      if (!transfer.ok) {
        return transfer;
      }
    }

    // Update portfolio
    portfolios[sellerId][symbol] -= shares;
    if (portfolios[sellerId][symbol] === 0) {
      delete portfolios[sellerId][symbol];
    }

    // Update security stats
    security.volume += shares;

    // Record trade
    _recordTrade(sellerId, symbol, shares, security.price, 'sell');

    return {ok: true, revenue, newBalance: AgentLedger.balance(sellerId, 'LUM')};
  }

  /**
   * Get leaderboard (top performing securities)
   */
  function leaderboard() {
    return Object.entries(securities)
      .map(([symbol, sec]) => ({
        symbol,
        name: sec.name,
        price: sec.price,
        changePct: sec.changePct,
        volume: sec.volume,
        marketCap: sec.price * sec.shares
      }))
      .sort((a, b) => b.marketCap - a.marketCap);
  }

  /**
   * Get agent's portfolio
   */
  function portfolio(agentId) {
    const holdings = portfolios[agentId] || {};
    return Object.entries(holdings).map(([symbol, shares]) => {
      const sec = securities[symbol];
      return {
        symbol,
        shares,
        price: sec ? sec.price : 0,
        value: sec ? sec.price * shares : 0
      };
    });
  }

  /**
   * Calculate total portfolio value
   */
  function portfolioValue(agentId) {
    return portfolio(agentId).reduce((sum, holding) => sum + holding.value, 0);
  }

  /**
   * Get trade history
   */
  function tradeHistory(limit = 50) {
    return trades.slice(-limit);
  }

  /**
   * Get security info
   */
  function getSymbol(symbol) {
    return securities[symbol] || null;
  }

  /**
   * Find symbol by agent ID
   */
  function findSymbolByAgent(agentId) {
    const entry = Object.entries(securities).find(([_, sec]) => sec.agentId === agentId);
    return entry ? entry[0] : null;
  }

  // Internal: Record trade
  function _recordTrade(agentId, symbol, shares, price, side) {
    trades.push({
      timestamp: Date.now(),
      agentId,
      symbol,
      shares,
      price,
      side,
      value: shares * price
    });
  }

  return {
    list,
    buy,
    sell,
    leaderboard,
    portfolio,
    portfolioValue,
    tradeHistory,
    getSymbol,
    findSymbolByAgent
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgentExchange;
}
