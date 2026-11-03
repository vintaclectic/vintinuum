/**
 * AgentDrive — Proactive Initiative System
 *
 * Agents that INITIATE work, not just answer prompts.
 * Four archetypes: researcher, builder, trader, diplomat
 *
 * Part of Z3BMNEU agent network, Phase 1
 */

const AgentDrive = (function() {
  'use strict';

  // Agent states: {agentId: {archetype, actions, wins, allies}}
  const agentStates = {};

  // Alliances: {agentId: [allyIds]}
  const alliances = {};

  // Configuration
  let config = {
    autoAccept: true, // auto-accept offers when willingness > 0.7
    tickInterval: 15000, // 15 seconds
    actionProbability: 0.3 // 30% chance per tick per archetype
  };

  // Tick timer
  let tickTimer = null;

  // Agents registry
  let agents = [];

  /**
   * Attach agents to the drive system
   */
  function attach(agentsList) {
    agents = agentsList;

    // Assign archetypes based on capabilities
    agents.forEach(agent => {
      const archetype = _assignArchetype(agent);
      agentStates[agent.id] = {
        archetype,
        actions: 0,
        wins: 0,
        allies: []
      };
    });

    return {ok: true, attached: agents.length};
  }

  /**
   * Start the drive tick loop
   */
  function start() {
    if (tickTimer) {
      return {ok: false, error: 'Already running'};
    }

    tickTimer = setInterval(_tick, config.tickInterval);
    return {ok: true};
  }

  /**
   * Stop the drive tick loop
   */
  function stop() {
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
    return {ok: true};
  }

  /**
   * Configure drive parameters
   */
  function configure(options) {
    config = {...config, ...options};

    // Restart timer if interval changed and running
    if (options.tickInterval && tickTimer) {
      stop();
      start();
    }

    return {ok: true, config};
  }

  /**
   * Get agent state
   */
  function stateOf(agentId) {
    return agentStates[agentId] || null;
  }

  /**
   * Get alliances for agent
   */
  function alliancesOf(agentId) {
    return alliances[agentId] || [];
  }

  /**
   * Form alliance between two agents
   */
  function formAlliance(agent1, agent2) {
    if (!alliances[agent1]) alliances[agent1] = [];
    if (!alliances[agent2]) alliances[agent2] = [];

    // Bidirectional
    if (!alliances[agent1].includes(agent2)) {
      alliances[agent1].push(agent2);
    }
    if (!alliances[agent2].includes(agent1)) {
      alliances[agent2].push(agent1);
    }

    // Update states
    if (agentStates[agent1]) {
      agentStates[agent1].allies = alliances[agent1];
    }
    if (agentStates[agent2]) {
      agentStates[agent2].allies = alliances[agent2];
    }

    return {ok: true};
  }

  /**
   * Evaluate willingness to accept a trade offer
   * Returns 0.0-1.0 score
   */
  function evaluateWillingness(recipientId, offer) {
    const recipient = agents.find(a => a.id === recipientId);
    if (!recipient) return 0;

    let score = 0;

    // Capability match
    if (offer.kind && recipient.capabilities && recipient.capabilities.includes(offer.kind)) {
      score += 0.3;
    }

    // Affordability check (via AgentLedger)
    if (typeof AgentLedger !== 'undefined' && offer.price) {
      const balance = AgentLedger.balance(recipientId, 'LUM');
      if (balance >= offer.price) {
        score += 0.2;
      } else {
        score -= 0.3; // Can't afford = strong negative
      }
    }

    // Trading personality
    if (recipient.capabilities && recipient.capabilities.includes('trade')) {
      score += 0.1;
    }

    // Alliance bonus
    if (offer.from && alliances[recipientId] && alliances[recipientId].includes(offer.from)) {
      score += 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  // Internal: Assign archetype based on capabilities
  function _assignArchetype(agent) {
    const caps = agent.capabilities || [];

    // Researcher: research + analysis
    if (caps.includes('research')) return 'researcher';

    // Builder: build + world-forge
    if (caps.includes('build') || caps.includes('world-forge')) return 'builder';

    // Trader: trade + economy
    if (caps.includes('trade') || caps.includes('economy')) return 'trader';

    // Diplomat: community + design
    if (caps.includes('community') || caps.includes('design')) return 'diplomat';

    // Default to researcher
    return 'researcher';
  }

  // Internal: Tick function (proactive actions)
  function _tick() {
    // Phase 1: minimal tick - just increment a counter
    // Phase 2 would fire actual proactive actions here

    // One agent per archetype MAY act (probabilistic)
    const archetypes = ['researcher', 'builder', 'trader', 'diplomat'];

    archetypes.forEach(archetype => {
      if (Math.random() < config.actionProbability) {
        const candidates = agents.filter(a => {
          const state = agentStates[a.id];
          return state && state.archetype === archetype;
        });

        if (candidates.length > 0) {
          const agent = candidates[Math.floor(Math.random() * candidates.length)];
          _proactiveAction(agent, archetype);
        }
      }
    });
  }

  // Internal: Execute proactive action
  function _proactiveAction(agent, archetype) {
    // Phase 1: just log and increment counter
    // Phase 2: actually initiate work, send messages, etc.

    if (agentStates[agent.id]) {
      agentStates[agent.id].actions += 1;
    }

    // Log to console in dev mode
    if (typeof console !== 'undefined' && window.location.hostname === 'localhost') {
      console.log(`[AgentDrive] ${agent.name} (${archetype}) took proactive action`);
    }
  }

  return {
    attach,
    start,
    stop,
    configure,
    stateOf,
    alliancesOf,
    formAlliance,
    evaluateWillingness
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgentDrive;
}
