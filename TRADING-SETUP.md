# MERCURIUS — Robinhood Trading Mastermind

**Status:** ✅ READY (Paper mode by default — safe to test)

## What Was Built

1. **mercurius** — Supreme trading intelligence agent (`~/.claude/agents/mercurius.md`)
   - Quantitative + technical analysis (RSI, MACD, Bollinger, multi-timeframe)
   - Market psychology, sentiment, regime detection
   - Risk management, position sizing, portfolio optimization
   - Alpha generation: momentum, mean reversion, volatility arbitrage
   - Pattern recognition, options pricing, order flow analysis
   - Profit maximization with capital protection FIRST

2. **Brain Integration** (`~/vintinuum-api/trading.js`)
   - Two modes: PAPER (default, analysis only) and LIVE (real execution)
   - Safety rails: max position size, daily loss limit, kill switch
   - All decisions logged (append-only JSONL for auditability)
   - Robinhood MCP integration via `robinhood-for-agents` package

3. **MASTERMIND STRATEGY ENGINE** (`~/vintinuum-api/trading-strategy.js`) 🧠
   - **Autonomous market scanning** — monitors watchlist on configurable interval
   - **Market regime detection** — trending_up, trending_down, ranging, volatile, quiet
   - **Multi-strategy signal generation:**
     - Momentum (trend following in trending markets)
     - Mean reversion (oversold/overbought in ranging markets)
     - MACD crossovers (all regimes)
   - **Intelligent position sizing** — risk-adjusted based on volatility + confidence
   - **Automatic stop-loss and take-profit** — 2:1 reward/risk ratio
   - **mercurius consultation** — each signal enhanced with deep analysis
   - **Profit-driven but surgical** — trade probabilities, not certainties

4. **API Endpoints** (`~/vintinuum-api/routes/trading.js`)
   - `/api/trading/state` — current mode, limits, today's stats
   - `/api/trading/portfolio` — live Robinhood portfolio
   - `/api/trading/analyze` — symbol analysis (quotes, fundamentals, technicals)
   - `/api/trading/decide` — submit trading decision
   - `/api/trading/emergency-stop` — kill switch
   - `/api/trading/mcp` — direct MCP tool access
   
   **MASTERMIND CONTROLS:**
   - `/api/trading/strategy/status` — engine status, config, watchlist
   - `/api/trading/strategy/scan` — run one scan cycle NOW
   - `/api/trading/strategy/start` — start autonomous loop
   - `/api/trading/strategy/stop` — stop autonomous loop
   - `/api/trading/strategy/watchlist` — update symbols to monitor

5. **Control Panel UI** (`~/vintinuum/trading.html`)
   - Live state dashboard
   - Symbol analysis
   - Manual decision submission
   - **Mastermind engine controls** (start/stop autonomous loop)
   - **Watchlist editor**
   - **Live signal feed** (what mercurius is seeing)
   - History log
   - Emergency controls

## Setup Steps

### 1. Install Prerequisites

```bash
# Install Bun (required for robinhood-for-agents)
curl -fsSL https://bun.sh/install | bash

# Verify
bun --version  # should be >= 1.3.0
```

### 2. Configure Robinhood MCP

```bash
# Run the installer (detects Claude Code, sets up MCP server)
bunx robinhood-for-agents install

# It will:
# - Register the MCP server in ~/.claude/mcp_config.json
# - Generate a ROBINHOOD_TOKEN_KEY (32-byte encryption key)
# - Copy the trading skill to ~/.claude/skills/
```

### 3. Login to Robinhood

```bash
# Standard mode (official Robinhood Trading MCP)
# - Opens browser for OAuth login
# - Connects to your Agentic Trading account
# - Token stored encrypted locally
```

In any Claude Code session, run:
```
robinhood_official_login
```

Approve once in the browser that opens. The session is cached and renews automatically.

Alternatively, for **web mode** (unofficial API, reaches all brokerage accounts):
```bash
bunx robinhood-for-agents login
# Opens Chrome, log in with credentials + MFA
```

### 4. Set Environment Variables

In `~/vintinuum-api/.env`, add:

```bash
# Trading mode (default: paper)
TRADING_MODE=paper              # or 'live' to enable real execution

# Trading controls
TRADING_ENABLED=true            # kill switch: set to false to stop everything
TRADING_REQUIRE_APPROVAL=true  # every order needs approval (recommended)

# Safety limits (conservative defaults)
TRADING_MAX_POSITION=500        # max $ per position
TRADING_MAX_DAILY_LOSS=100      # max $ daily loss before auto-pause
TRADING_MAX_POSITIONS=3         # max concurrent open positions

# Robinhood config
ROBINHOOD_MODE=standard         # 'standard' (official) or 'web' (unofficial)
ROBINHOOD_ACCOUNT=<your-account-number>  # required for live orders
```

### 5. Restart the Brain

```bash
pm2 restart vintinuum-api
```

### 6. Access the Control Panel

Open: **https://vintinuum.com/trading.html**

- View current state (mode, limits, P&L)
- Analyze symbols
- Test decisions in paper mode
- Emergency stop

## Modes Explained

### PAPER MODE (Default — SAFE)
- All analysis runs normally
- Decisions are logged but NOT executed
- Zero risk, perfect for testing strategies
- mercatus can practice, learn patterns, refine logic

**To enable paper mode:**
```bash
# In ~/vintinuum-api/.env
TRADING_MODE=paper
```

### LIVE MODE (Real Money — DANGEROUS)
- Decisions become real orders on Robinhood
- Requires explicit opt-in via env flag
- Approval gate on by default (every order needs Vinta's yes)
- All safety limits enforced

**To enable live mode:**
```bash
# In ~/vintinuum-api/.env
TRADING_MODE=live
ROBINHOOD_ACCOUNT=<your-account-number>
```

## Safety Rails (Non-Negotiable)

1. **Paper mode by default** — live requires explicit env flag
2. **Max position size** — no single trade exceeds configured limit
3. **Daily loss limit** — trading auto-pauses if breached
4. **Max open positions** — caps concurrent holdings
5. **Approval gate** — every order surfaces to Vinta (configurable)
6. **Kill switch** — `TRADING_ENABLED=false` stops everything instantly
7. **Complete audit trail** — every decision/order logged (JSONL, append-only)

## Logs & Monitoring

- **Decisions log:** `~/vintinuum-api/logs/trading/decisions.jsonl`
- **Orders log:** `~/vintinuum-api/logs/trading/orders.jsonl`

Each line is a JSON event:
```json
{
  "timestamp": "2026-09-27T02:30:00.000Z",
  "type": "decision_submitted",
  "mode": "paper",
  "action": "buy",
  "symbol": "AAPL",
  "quantity": 10,
  "reasoning": "...",
  "confidence": 75
}
```

## Using mercatus Agent

The mercatus agent can call the trading brain via brain API:

```javascript
// From mercatus agent context
const state = await fetch('https://api.vintaclectic.com/api/trading/state').then(r => r.json());
const analysis = await fetch('https://api.vintaclectic.com/api/trading/analyze', {
  method: 'POST',
  body: JSON.stringify({ symbol: 'AAPL' }),
}).then(r => r.json());

// Submit a decision
const decision = {
  action: 'buy',
  symbol: 'AAPL',
  quantity: 10,
  price: 150.00,
  reasoning: 'Technical breakout + volume surge',
  confidence: 85,
};
const result = await fetch('https://api.vintaclectic.com/api/trading/decide', {
  method: 'POST',
  body: JSON.stringify(decision),
}).then(r => r.json());
```

## Architecture

```
┌─────────────────────────────────────────┐
│  mercatus Agent (AI Trading Brain)     │
│  - Analyzes markets                     │
│  - Finds opportunities                  │
│  - Makes trading decisions              │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  vintinuum-api/trading.js               │
│  - Mode control (paper/live)            │
│  - Safety checks (limits, pause)        │
│  - Logging (audit trail)                │
│  - Robinhood MCP interface              │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  robinhood-for-agents (MCP)             │
│  - Standard mode: official Trading MCP  │
│  - 82 tools (quotes, fundamentals,      │
│    technicals, orders, portfolio)       │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  Robinhood Agentic Trading Account      │
│  - Separate from main brokerage         │
│  - Only funds deposited here            │
│  - Push notifications on every trade    │
└─────────────────────────────────────────┘
```

## Next Steps (RESERVED-DECISIONS — Vinta Only)

This infrastructure is COMPLETE and WORKING in paper mode. The following decisions are yours:

1. **Enable live trading?**
   - Set `TRADING_MODE=live` in .env
   - Provide `ROBINHOOD_ACCOUNT` number
   - Decide initial limits (position size, daily loss, max positions)

2. **Risk parameters**
   - How aggressive should mercatus be?
   - What strategies to enable first?
   - What confidence threshold to require?

3. **Approval vs. autonomous**
   - Keep `TRADING_REQUIRE_APPROVAL=true` (you approve every order)
   - Or set `false` (mercatus executes within limits, you monitor)

4. **When to go live**
   - Paper trade for days/weeks first?
   - What performance metrics to require before live?
   - Start with tiny limits, scale up slowly?

## Current State

✅ **READY TO USE IN PAPER MODE**
- mercatus can analyze markets
- Test decisions with zero risk
- Learn patterns, refine strategies
- Control panel accessible at trading.html

⚠️ **LIVE MODE REQUIRES YOUR EXPLICIT APPROVAL**
- Set env flags
- Define risk limits
- Connect Robinhood account
- Monitor first trades closely

---

**Built:** 2026-09-27 (task QVBFSYC)
**Agent:** mercatus (Gen 1 ATLAS×ARIA)
**Integration:** robinhood-for-agents v5.0.0
**Documentation:** [robinhood-for-agents README](https://github.com/kevin1chun/robinhood-for-agents)
