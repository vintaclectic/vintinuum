/**
 * AgentWeb — Agent Network Coordinator
 *
 * Coordinates all four organs (Ledger, Router, Exchange, Drive) and provides
 * dual-stack RPC communication (in-process + HTTP async).
 *
 * Part of Z3BMNEU agent network, Phase 1
 */

const AgentWeb = (function() {
  'use strict';

  const BRAIN = 'https://api.vintaclectic.com';

  // State
  let booted = false;
  let agents = [];

  // Message queue: {id: msg}
  const messageQueue = {};

  // Event log (for corpus)
  const eventLog = [];

  // Egress log (for monitoring)
  const egressLog = [];

  /**
   * Boot the agent network
   * This is the main entry point called from world.html
   */
  async function boot(options = {}) {
    if (booted) {
      return {ok: false, error: 'Already booted'};
    }

    try {
      // 1. Load agents from web.jsonl
      agents = await _loadAgents();
      if (agents.length === 0) {
        return {ok: false, error: 'No agents found in web.jsonl'};
      }

      // 2. Initialize all four organs
      AgentLedger.init(agents, 1000); // 1000Ⱡ starting balance

      // List all agents as securities
      agents.forEach(agent => {
        AgentExchange.list({
          agentId: agent.id,
          name: agent.name
        });
      });

      // Attach agents to drive
      AgentDrive.attach(agents);

      // 3. Generate personalities if not already present
      await _generatePersonalities();

      // 4. Start drive (proactive actions)
      AgentDrive.start();

      // 5. Set up cross-tab messaging
      _setupStorageListener();

      // 6. Optional: Enable real money
      if (options.realMoney) {
        AgentLedger.enableRealMoney(options.realMoney);
      }

      booted = true;

      _log('boot', 'system', {agents: agents.length});

      return {
        ok: true,
        agents: agents.length,
        wired: ['ledger', 'router', 'exchange', 'drive'],
        listed: agents.length,
        archetypes: _countArchetypes(),
        personas: _countPersonas()
      };
    } catch (error) {
      return {ok: false, error: error.message};
    }
  }

  /**
   * Send message between agents (dual-stack RPC)
   */
  function sendMessage(fromId, toId, content, type = 'message', payload = {}) {
    if (!booted) {
      return {ok: false, error: 'Network not booted'};
    }

    const msg = {
      id: _uuid(),
      from: fromId,
      to: toId,
      content,
      type,
      payload,
      timestamp: Date.now()
    };

    // Store in queue
    messageQueue[msg.id] = msg;

    // Log event
    _log('message', fromId, {to: toId, type, content: content.substring(0, 50)});

    // In-process delivery (same tab)
    _deliverLocal(msg);

    // Persist to localStorage (cross-tab)
    _persistMessage(msg);

    // HTTP mirror to brain (survives tab close)
    _mirrorToBrain(msg);

    // Handle trade offers automatically if enabled
    if (type === 'trade-offer' && AgentDrive.configure().config.autoAccept) {
      _handleTradeOffer(msg);
    }

    return {ok: true, messageId: msg.id};
  }

  /**
   * Broadcast message to all agents
   */
  function broadcast(fromId, type, content) {
    const others = agents.filter(a => a.id !== fromId);
    others.forEach(agent => {
      sendMessage(fromId, agent.id, content, type);
    });
    return {ok: true, sent: others.length};
  }

  /**
   * Get dashboard (all agent stats)
   */
  function dashboard() {
    return {
      agents: agents.map(agent => {
        const portfolio = AgentExchange.portfolioValue(agent.id);
        const state = AgentDrive.stateOf(agent.id);
        const symbol = AgentExchange.findSymbolByAgent(agent.id);
        const security = symbol ? AgentExchange.getSymbol(symbol) : null;

        return {
          id: agent.id,
          name: agent.name,
          project: agent.project,
          capabilities: agent.capabilities,
          lumens: AgentLedger.balance(agent.id, 'LUM'),
          xmr: AgentLedger.balance(agent.id, 'XMR'),
          symbol,
          price: security ? security.price : 0,
          changePct: security ? security.changePct : 0,
          marketCap: security ? security.price * security.shares : 0,
          portfolioValue: portfolio,
          archetype: state ? state.archetype : null,
          actions: state ? state.actions : 0,
          wins: state ? state.wins : 0,
          allies: state ? state.allies : []
        };
      }),
      market: AgentExchange.leaderboard().slice(0, 10),
      router: AgentRouter.snapshot(),
      alliances: _getAlliances(),
      ticks: AgentDrive.stateOf(agents[0]?.id)?.actions || 0
    };
  }

  /**
   * Export corpus for training
   */
  function exportCorpus() {
    return eventLog.map(event => ({
      source: 'agent-web',
      ts: event.timestamp,
      event: event.event,
      agent: event.agent,
      details: event.details
    }));
  }

  /**
   * Flush corpus to brain
   */
  async function flushCorpus() {
    const corpus = exportCorpus();
    if (corpus.length === 0) {
      return {ok: true, rows: 0};
    }

    try {
      const response = await _egress('/api/corpus/agent-web', {
        method: 'POST',
        body: JSON.stringify({corpus})
      });

      if (response.ok) {
        // Clear flushed events
        eventLog.length = 0;
        return {ok: true, rows: corpus.length};
      }

      return {ok: false, error: 'Brain returned ' + response.status};
    } catch (error) {
      return {ok: false, error: error.message};
    }
  }

  /**
   * Get egress log (for monitoring)
   */
  function getEgressLog() {
    return [...egressLog];
  }

  /**
   * Get event log
   */
  function getEventLog() {
    return [...eventLog];
  }

  /**
   * Check if booted
   */
  function isBooted() {
    return booted;
  }

  // Internal: Load agents from web.jsonl
  async function _loadAgents() {
    try {
      const response = await fetch('/body/world/web.jsonl');
      const text = await response.text();
      const lines = text.trim().split('\n');
      return lines.map(line => JSON.parse(line));
    } catch (error) {
      console.error('[AgentWeb] Failed to load web.jsonl:', error);
      return [];
    }
  }

  // Internal: Generate personalities for agents
  async function _generatePersonalities() {
    // Check if AgentLife has personality functions
    if (typeof AgentLife === 'undefined' || typeof AgentLife.registerPersona !== 'function') {
      return 0;
    }

    let generated = 0;
    agents.forEach(agent => {
      // Skip if already has persona
      if (AgentLife.hasPersona && AgentLife.hasPersona(agent.id)) {
        return;
      }

      // Generate persona based on archetype
      const state = AgentDrive.stateOf(agent.id);
      const archetype = state ? state.archetype : 'researcher';

      const persona = _generatePersona(agent, archetype);
      AgentLife.registerPersona(agent.id, persona);
      generated++;
    });

    return generated;
  }

  // Internal: Generate persona
  function _generatePersona(agent, archetype) {
    const baseSpeed = 0.3;
    const basePause = 3000;

    // Vary by archetype
    const profiles = {
      researcher: {speed: baseSpeed * 0.8, pause: basePause * 1.2, curious: true},
      builder: {speed: baseSpeed * 1.0, pause: basePause * 0.8, purposeful: true},
      trader: {speed: baseSpeed * 1.2, pause: basePause * 0.6, eager: true},
      diplomat: {speed: baseSpeed * 0.9, pause: basePause * 1.0, social: true}
    };

    const profile = profiles[archetype] || profiles.researcher;

    return {
      speed: profile.speed,
      pauseRange: [profile.pause * 0.8, profile.pause * 1.2],
      mood: archetype,
      traits: Object.keys(profile).filter(k => profile[k] === true)
    };
  }

  // Internal: Count archetypes
  function _countArchetypes() {
    const types = {};
    agents.forEach(agent => {
      const state = AgentDrive.stateOf(agent.id);
      const archetype = state ? state.archetype : 'unknown';
      types[archetype] = (types[archetype] || 0) + 1;
    });
    return Object.keys(types).length;
  }

  // Internal: Count personas
  function _countPersonas() {
    if (typeof AgentLife === 'undefined' || typeof AgentLife.hasPersona !== 'function') {
      return 0;
    }
    return agents.filter(a => AgentLife.hasPersona(a.id)).length;
  }

  // Internal: Get all alliances
  function _getAlliances() {
    const allAlliances = [];
    agents.forEach(agent => {
      const allies = AgentDrive.alliancesOf(agent.id);
      if (allies.length > 0) {
        allAlliances.push({agent: agent.id, allies});
      }
    });
    return allAlliances;
  }

  // Internal: Deliver message locally (in-process)
  function _deliverLocal(msg) {
    // Phase 1: just log
    // Phase 2: actually invoke recipient agent handlers
    _log('delivered-local', msg.to, {from: msg.from, type: msg.type});
  }

  // Internal: Persist message to localStorage (cross-tab)
  function _persistMessage(msg) {
    try {
      const key = `agent-msg-${msg.id}`;
      localStorage.setItem(key, JSON.stringify(msg));
    } catch (error) {
      console.error('[AgentWeb] Failed to persist message:', error);
    }
  }

  // Internal: Mirror message to brain (HTTP)
  function _mirrorToBrain(msg) {
    _egress('/api/agent-mail', {
      method: 'POST',
      body: JSON.stringify(msg)
    }).catch(error => {
      console.error('[AgentWeb] Failed to mirror to brain:', error);
    });
  }

  // Internal: Set up storage listener for cross-tab messaging
  function _setupStorageListener() {
    if (typeof window === 'undefined') return;

    window.addEventListener('storage', (event) => {
      if (event.key && event.key.startsWith('agent-msg-')) {
        try {
          const msg = JSON.parse(event.newValue);
          _deliverLocal(msg);
        } catch (error) {
          console.error('[AgentWeb] Failed to parse storage message:', error);
        }
      }
    });
  }

  // Internal: Handle trade offer automatically
  function _handleTradeOffer(msg) {
    const willingness = AgentDrive.evaluateWillingness(msg.to, msg.payload.offer);

    if (willingness > 0.7) {
      // Auto-accept
      _executeTradeAccept(msg);
    } else if (willingness > 0.4) {
      // Counter-offer (60-90% of asking)
      _executeTradeCounter(msg, willingness);
    }
    // else: ignore (willingness < 0.4)
  }

  // Internal: Execute trade acceptance
  function _executeTradeAccept(msg) {
    const offer = msg.payload.offer;
    const result = AgentLedger.transfer(
      msg.to,
      msg.from,
      offer.price,
      'LUM',
      `Trade accepted: ${offer.title}`
    );

    if (result.ok) {
      _log('trade-accept', msg.to, {from: msg.from, offer: offer.title, price: offer.price});

      // Notify sender
      sendMessage(msg.to, msg.from, `Accepted: ${offer.title}`, 'trade-response', {
        accepted: true,
        price: offer.price
      });
    }
  }

  // Internal: Execute trade counter-offer
  function _executeTradeCounter(msg, willingness) {
    const offer = msg.payload.offer;
    const counterPrice = Math.floor(offer.price * (0.6 + (willingness - 0.4) * 0.75));

    sendMessage(msg.to, msg.from, `Counter-offer: ${offer.title} for ${counterPrice}Ⱡ`, 'trade-response', {
      accepted: false,
      counterPrice
    });

    _log('trade-counter', msg.to, {from: msg.from, original: offer.price, counter: counterPrice});
  }

  // Internal: Egress gateway (all HTTP goes through brain)
  async function _egress(path, options = {}) {
    const url = BRAIN + path;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      _logEgress(path, response.status, options.body ? options.body.length : 0);

      return response;
    } catch (error) {
      _logEgress(path, 0, 0);
      throw error;
    }
  }

  // Internal: Log egress
  function _logEgress(path, status, bytes) {
    egressLog.push({
      at: Date.now(),
      path,
      status: status > 0 ? `http ${status}` : 'no-fetch',
      bytes
    });
  }

  // Internal: Log event
  function _log(event, agent, details) {
    eventLog.push({
      timestamp: Date.now(),
      event,
      agent,
      details
    });
  }

  // Internal: Generate UUID
  function _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  return {
    boot,
    sendMessage,
    broadcast,
    dashboard,
    exportCorpus,
    flushCorpus,
    egressLog: getEgressLog,
    eventLog: getEventLog,
    isBooted
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgentWeb;
}
