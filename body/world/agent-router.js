/**
 * AgentRouter — Multi-Provider Model Routing with Learning
 *
 * Integrates the CTB routing algorithm system so agents can use all models,
 * learn which providers work best, and fall back to API when session limits hit.
 *
 * Part of Z3BMNEU agent network, Phase 1
 */

const AgentRouter = (function() {
  'use strict';

  // Provider configurations
  const PROVIDERS = {
    anthropic: {
      session: {lane: 'session', hasLimit: true},
      api: {lane: 'api', hasLimit: false, needsKey: true}
    },
    openai: {
      api: {lane: 'api', hasLimit: false, needsKey: true}
    },
    xai: {
      api: {lane: 'api', hasLimit: false, needsKey: true}
    },
    local: {
      direct: {lane: 'local', hasLimit: false, needsKey: false}
    }
  };

  // Bandit learning: {agentId: {provider: {successes, attempts}}}
  const bandit = {};

  // Lane health: {provider: {lane: {healthy: bool, lastCheck: timestamp}}}
  const laneHealth = {};

  // Routing log
  const routingLog = [];

  /**
   * Route a request to the best provider for this agent
   */
  function route(options) {
    const {agent, task, providers = ['anthropic', 'openai', 'xai', 'local']} = options;

    // Filter to allowed providers
    const allowed = providers.filter(p => PROVIDERS[p]);
    if (allowed.length === 0) {
      return _fail('No valid providers specified');
    }

    // Get agent preferences (bandit learning)
    const prefs = _getPreferences(agent, allowed);

    // Try providers in order of preference
    for (const provider of prefs) {
      const lane = _selectLane(provider);
      if (lane) {
        _recordRoute(agent, provider, lane.lane, task);
        return {
          ok: true,
          provider,
          lane: lane.lane,
          model: _selectModel(provider, lane.lane),
          needsKey: lane.needsKey
        };
      }
    }

    return _fail('No healthy provider lanes available');
  }

  /**
   * Record outcome of a routed request (for learning)
   */
  function recordOutcome(agent, provider, success) {
    if (!bandit[agent]) bandit[agent] = {};
    if (!bandit[agent][provider]) {
      bandit[agent][provider] = {successes: 0, attempts: 0};
    }

    bandit[agent][provider].attempts += 1;
    if (success) {
      bandit[agent][provider].successes += 1;
    } else {
      // On failure, mark lane as potentially unhealthy
      _markLaneHealth(provider, false);
    }
  }

  /**
   * Get routing snapshot (for debugging)
   */
  function snapshot() {
    return {
      bandit: {...bandit},
      lanes: {...laneHealth},
      log: [...routingLog].slice(-50) // last 50 routes
    };
  }

  /**
   * Reset learned preferences (for testing)
   */
  function reset() {
    Object.keys(bandit).forEach(k => delete bandit[k]);
    Object.keys(laneHealth).forEach(k => delete laneHealth[k]);
    routingLog.length = 0;
  }

  // Internal: Get provider preferences for agent (bandit algorithm)
  function _getPreferences(agent, providers) {
    if (!bandit[agent]) {
      // No history - return providers in default order
      return providers;
    }

    // Calculate success rate + exploration bonus
    const scored = providers.map(provider => {
      const stats = bandit[agent][provider] || {successes: 0, attempts: 0};
      const successRate = stats.attempts > 0
        ? stats.successes / stats.attempts
        : 0.5; // neutral prior

      // UCB1: add exploration bonus for under-tried providers
      const exploration = Math.sqrt(2 * Math.log(10) / (stats.attempts + 1));
      const score = successRate + exploration;

      return {provider, score};
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.provider);
  }

  // Internal: Select best lane for a provider
  function _selectLane(provider) {
    const config = PROVIDERS[provider];
    if (!config) return null;

    // Try lanes in order: session (if no limit hit) → api (if key available) → local
    const lanes = Object.keys(config);

    for (const laneName of lanes) {
      const lane = config[laneName];

      // Check health
      if (!_isLaneHealthy(provider, laneName)) continue;

      // Check if key is available (simplified - Phase 1)
      if (lane.needsKey && !_hasKey(provider)) continue;

      return {...lane, name: laneName};
    }

    return null;
  }

  // Internal: Check if lane is healthy
  function _isLaneHealthy(provider, lane) {
    const key = `${provider}:${lane}`;
    if (!laneHealth[key]) {
      laneHealth[key] = {healthy: true, lastCheck: Date.now()};
    }

    // In Phase 1, assume healthy unless explicitly marked
    // Phase 2 would ping actual endpoints
    return laneHealth[key].healthy;
  }

  // Internal: Mark lane health
  function _markLaneHealth(provider, healthy) {
    // Mark all lanes for this provider
    Object.keys(PROVIDERS[provider] || {}).forEach(lane => {
      const key = `${provider}:${lane}`;
      if (!laneHealth[key]) laneHealth[key] = {};
      laneHealth[key].healthy = healthy;
      laneHealth[key].lastCheck = Date.now();
    });
  }

  // Internal: Check if API key exists (simplified)
  function _hasKey(provider) {
    // In Phase 1, assume keys exist if needed
    // Phase 2 would check actual credential store
    return true;
  }

  // Internal: Select model for provider/lane
  function _selectModel(provider, lane) {
    // Simple defaults - Phase 2 would integrate full CTB algorithm
    if (provider === 'anthropic') return 'claude-opus-5-5';
    if (provider === 'openai') return 'gpt-4';
    if (provider === 'xai') return 'grok-4.6';
    if (provider === 'local') return 'local-model';
    return 'unknown';
  }

  // Internal: Record routing decision
  function _recordRoute(agent, provider, lane, task) {
    routingLog.push({
      timestamp: Date.now(),
      agent,
      provider,
      lane,
      task: task ? task.substring(0, 50) : ''
    });
  }

  // Internal: Return failure
  function _fail(reason) {
    return {ok: false, error: reason};
  }

  return {
    route,
    recordOutcome,
    snapshot,
    reset
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgentRouter;
}
