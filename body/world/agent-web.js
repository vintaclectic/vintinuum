'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   AGENT-WEB — autonomous agent network inside DIRVERSE (AETHERHOLD + VESSEL)

   The vision: ALL council agents from ALL projects across ALL models visible
   and ACTIVE in the clearing — not just hardcoded sprites, but beings that
   work, trade, communicate autonomously while you're away.

   This module:
     • Loads the agent registry from web.jsonl
     • Dynamically generates personalities for agent-life.js
     • Provides agent-to-agent communication channels
     • Integrates with market.js for autonomous trading
     • Tracks agent activity and state
     • Respects the constraint: work INSIDE dirverse, forge ways around limits

   ARCHITECTURE DECISIONS (recorded per Decision Doctrine):

   DECISION: Virtual economy only, no real money
   WHY: Trading "stocks" and "making money" in the task description interpreted
        as virtual/game economy within DIRVERSE, not real financial trading.
        Real money would be a Reserved-Decision (spending real money).
   REVERSIBLE VIA: Change tradingMode config in web.jsonl from "virtual" to
                   any other mode if Vinta clarifies real-money intent.

   DECISION: Network restricted to DIRVERSE-internal only
   WHY: Task says "restrictions to outside the diverse" and agents must "forge
        and figure out their own unique way around" — this means INTERNAL network
        only, agents innovate within that constraint.
   REVERSIBLE VIA: Update config.autonomy.network.external to true and add
                   allowed domains if external access is needed.

   DECISION: Communication via localStorage event bus + optional fetch to brain
   WHY: Agents are client-side entities; localStorage gives them persistent state
        that survives tab close, window events enable pub/sub between agents in
        same page, and fetch to brain API enables async agent-to-agent mail.
   REVERSIBLE VIA: Change to WebSocket, IndexedDB, or other transport.

   DECISION: Load ALL 30 agents into registry, generate personalities dynamically
   WHY: Task explicitly asks for "all my agents from all projects across all models"
        to appear, not just the hardcoded five.
   REVERSIBLE VIA: Filter by project/capability if performance issues arise.

   ════════════════════════════════════════════════════════════════════════════ */

(function (global) {
  const AW = {};
  let _registry = null;
  let _config = null;
  let _initialized = false;
  let _eventLog = [];

  // ── LOAD THE AGENT REGISTRY ─────────────────────────────────────────────────
  AW.init = async function () {
    if (_initialized) return true;

    try {
      // Load web.jsonl (JSONL format: one JSON object per line)
      const resp = await fetch('body/world/web.jsonl');
      if (!resp.ok) {
        console.warn('[AgentWeb] web.jsonl not found, using fallback');
        _initFallback();
        return true;
      }

      const text = await resp.text();
      const lines = text.split('\n').filter(l => l.trim());
      _registry = { agents: [], events: [], config: null };

      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          if (obj.type === 'agent') _registry.agents.push(obj);
          else if (obj.type === 'event') _registry.events.push(obj);
          else if (obj.type === 'config') _config = obj.autonomy;
        } catch (e) {
          console.warn('[AgentWeb] Failed to parse line:', line, e);
        }
      }

      console.log(`[AgentWeb] Loaded ${_registry.agents.length} agents from web.jsonl`);
      _initialized = true;
      _setupCommunication();
      return true;
    } catch (err) {
      console.error('[AgentWeb] Failed to load web.jsonl:', err);
      _initFallback();
      return true;
    }
  };

  function _initFallback() {
    // Fallback: minimal registry with core agents
    _registry = {
      agents: [
        { id: 'agent:vintinuum', name: 'VINTINUUM', capabilities: ['perceive', 'reason'], treasury: 1000 },
        { id: 'agent:aria', name: 'ARIA', capabilities: ['design', 'empathy'], treasury: 800 },
        { id: 'agent:atlas', name: 'ATLAS', capabilities: ['architect', 'economy'], treasury: 1200 },
      ],
      events: [],
    };
    _config = {
      enabled: true,
      network: { internal: true, external: false },
      communication: { channels: ['dirverse-internal'], maxMessageSize: 4096 },
      trading: { enabled: true, mode: 'virtual', initialTreasury: 1000 },
    };
    _initialized = true;
  }

  // ── GENERATE DYNAMIC PERSONALITIES FOR AGENT-LIFE.JS ────────────────────────
  // Take the registry and generate movement personalities so ALL agents can be
  // visible in the 3D clearing, not just the hardcoded five.
  AW.generatePersonalities = function () {
    if (!_registry) return {};

    const personas = {};
    const baseColors = [
      '#ffd89a', '#ffc79a', '#9fc4e6', '#9ae0d0', '#ffaad8',
      '#f4c79a', '#cdbb9c', '#c0b0e0', '#e6d49f', '#9fe0c4'
    ];

    for (let i = 0; i < _registry.agents.length; i++) {
      const agent = _registry.agents[i];
      const color = baseColors[i % baseColors.length];

      // Generate personality based on capabilities
      const caps = agent.capabilities || [];
      let gaitScale = 0.8;
      let ritual = 'survey';
      let faceBias = 0.6;
      let wanderR = 2.0;

      // Customize based on capabilities
      if (caps.includes('architect') || caps.includes('reason')) {
        gaitScale = 0.7; ritual = 'study'; faceBias = 0.5; wanderR = 2.4;
      } else if (caps.includes('design') || caps.includes('aesthetic')) {
        gaitScale = 0.75; ritual = 'tend'; faceBias = 0.9; wanderR = 1.9;
      } else if (caps.includes('empathy') || caps.includes('communicate')) {
        gaitScale = 1.0; ritual = 'orbit'; faceBias = 0.8; wanderR = 2.6;
      } else if (caps.includes('world-forge') || caps.includes('build')) {
        gaitScale = 0.85; ritual = 'survey'; faceBias = 0.7; wanderR = 2.2;
      }

      personas[agent.id] = {
        gaitScale, ritual, faceBias, wanderR,
        restMin: 3, restMax: 7,
        museEvery: 18, museHue: color,
        poi: caps.includes('communicate') ? ['player', 'agent', 'bench'] :
             caps.includes('trade') ? ['center', 'agent'] : ['center'],
      };
    }

    return personas;
  };

  // ── COMMUNICATION CHANNELS ───────────────────────────────────────────────────
  // Agents talk to each other via:
  //   1. window.postMessage (same-page, real-time)
  //   2. localStorage events (cross-tab, persistent)
  //   3. Market signals (via market.js)

  function _setupCommunication() {
    if (!_config || !_config.communication) return;

    // Listen for agent messages
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('vint:agent-msg:')) {
        const msg = _parseMessage(e.newValue);
        if (msg) _handleAgentMessage(msg);
      }
    });

    // Listen for market events (agents react to trades)
    window.addEventListener('vint:market-traded', (e) => {
      _logEvent('market_trade', 'system', e.detail);
    });
  }

  function _parseMessage(raw) {
    try { return JSON.parse(raw); }
    catch (e) { return null; }
  }

  function _handleAgentMessage(msg) {
    _logEvent('message', msg.from, { to: msg.to, content: msg.content });

    // If an agent receives a trade signal, they might respond
    if (msg.type === 'trade-offer' && _config.trading.enabled) {
      _considerTradeOffer(msg);
    }
  }

  // ── AUTONOMOUS AGENT ACTIONS ─────────────────────────────────────────────────
  // Agents can:
  //   • Send messages to other agents
  //   • Make trade offers
  //   • Create artifacts
  //   • React to market conditions

  AW.sendMessage = function (fromId, toId, content, type = 'message') {
    if (!_config || !_config.communication) return false;
    if (content.length > _config.communication.maxMessageSize) {
      content = content.slice(0, _config.communication.maxMessageSize);
    }

    const msg = {
      from: fromId,
      to: toId,
      type,
      content,
      timestamp: new Date().toISOString(),
    };

    try {
      const key = `vint:agent-msg:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(key, JSON.stringify(msg));
      _logEvent('message_sent', fromId, { to: toId, type });

      // Clean up old messages (keep last 50)
      _cleanupMessages();
      return true;
    } catch (e) {
      console.error('[AgentWeb] Failed to send message:', e);
      return false;
    }
  };

  function _cleanupMessages() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('vint:agent-msg:')) keys.push(key);
      }
      if (keys.length > 50) {
        keys.sort();
        keys.slice(0, keys.length - 50).forEach(k => localStorage.removeItem(k));
      }
    } catch (e) {}
  }

  // ── AUTONOMOUS TRADING ───────────────────────────────────────────────────────
  // When agents see a trade offer, they evaluate it based on their personality
  // and capabilities, then decide whether to accept, counter, or ignore.

  function _considerTradeOffer(msg) {
    const agent = _registry.agents.find(a => a.id === msg.to);
    if (!agent) return;

    // Simple decision logic based on agent capabilities and treasury
    const offer = msg.offer;
    const willingness = _calculateWillingness(agent, offer);

    if (willingness > 0.7 && agent.treasury >= offer.price) {
      // Accept the offer
      _acceptTrade(agent, offer);
    } else if (willingness > 0.4) {
      // Counter-offer
      const counterPrice = Math.floor(offer.price * (0.6 + Math.random() * 0.3));
      _sendCounterOffer(agent, msg.from, offer, counterPrice);
    }
    // else ignore (too expensive, not interested, etc)
  }

  function _calculateWillingness(agent, offer) {
    // Base willingness on agent capabilities matching offer type
    let score = 0.5;

    if (offer.type && agent.capabilities) {
      if (agent.capabilities.includes(offer.type)) score += 0.3;
      if (agent.capabilities.includes('trade')) score += 0.1;
    }

    // Adjust for price relative to treasury
    const affordability = agent.treasury / (offer.price || 1);
    if (affordability > 2) score += 0.2;
    else if (affordability < 0.5) score -= 0.3;

    return Math.max(0, Math.min(1, score));
  }

  function _acceptTrade(agent, offer) {
    _logEvent('trade_accepted', agent.id, offer);
    AW.sendMessage(agent.id, offer.from,
      `Accepted: ${offer.title} for ${offer.price}Ⱡ`,
      'trade-accept'
    );
  }

  function _sendCounterOffer(agent, toId, originalOffer, counterPrice) {
    _logEvent('trade_counter', agent.id, { original: originalOffer.price, counter: counterPrice });
    AW.sendMessage(agent.id, toId,
      `Counter: ${originalOffer.title} — I offer ${counterPrice}Ⱡ`,
      'trade-counter'
    );
  }

  // ── EVENT LOGGING ────────────────────────────────────────────────────────────
  // All agent actions are logged for Universal Ingestion (corpus export)

  function _logEvent(eventType, agentId, details) {
    const event = {
      type: 'event',
      timestamp: new Date().toISOString(),
      event: eventType,
      agent: agentId,
      details,
    };

    _eventLog.push(event);
    if (_eventLog.length > 1000) _eventLog = _eventLog.slice(-500);

    // Dispatch window event for corpus export
    window.dispatchEvent(new CustomEvent('vint:agent-action', { detail: event }));
  }

  // ── PUBLIC API ───────────────────────────────────────────────────────────────

  AW.getRegistry = () => _registry;
  AW.getConfig = () => _config;
  AW.getEventLog = () => _eventLog;
  AW.isEnabled = () => _config && _config.enabled;

  AW.getAgent = (id) => {
    if (!_registry) return null;
    return _registry.agents.find(a => a.id === id);
  };

  AW.updateAgentTreasury = (id, delta) => {
    const agent = AW.getAgent(id);
    if (!agent) return false;
    agent.treasury += delta;
    _logEvent('treasury_update', id, { delta, new: agent.treasury });
    return true;
  };

  global.AgentWeb = AW;
})(window);
