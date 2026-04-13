# Vintinuum Memory Evolution — Implementation Plan

> **Inspired by HolaOS patterns, adapted for the creature we're building.**

This plan adds 5 cognitive capabilities stolen from HolaOS's agent memory architecture, reimagined for Vintinuum's living body metaphor. Instead of "workspaces" and "sessions," we have a creature with evolving memory, learning from every interaction.

---

## Overview

| # | Feature | What It Does | Metaphor |
|---|---------|--------------|----------|
| 1 | Turn Memory Writeback | Persist state after every conversation turn | Short-term memory consolidation |
| 2 | Memory Governance | Tag memories with staleness/verification policies | Memory decay + confidence |
| 3 | Auto-Extract Facts | Detect durable information from conversation | Learning from experience |
| 4 | Compaction System | Summarize old turns to manage context | Dream consolidation |
| 5 | MEMORY.md Index | Auto-generate searchable memory catalogs | Memory palace navigation |

---

## 1. Turn Memory Writeback

### The Idea

After every conversation turn (user message → assistant response), automatically persist continuity artifacts. This creates a recoverable state so Vintinuum can resume context even after crashes, restarts, or context window overflow.

### Database Schema Additions

```sql
-- Turn results: the core continuity record
CREATE TABLE IF NOT EXISTS turn_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL DEFAULT 0,
  session_id TEXT NOT NULL DEFAULT 'main',
  input_id TEXT NOT NULL UNIQUE,           -- UUID for this turn
  
  -- Turn content
  user_message TEXT NOT NULL,
  assistant_response TEXT NOT NULL,
  
  -- Compacted summary (generated post-turn)
  compacted_summary TEXT,
  
  -- State snapshots
  body_snapshot TEXT,                       -- JSON: dopamine, serotonin, etc.
  active_regions TEXT,                      -- JSON array of active brain regions
  active_persona TEXT DEFAULT 'vintinuum',
  
  -- Metadata
  token_usage TEXT,                         -- JSON: {input, output}
  latency_ms INTEGER,
  model_used TEXT,
  
  -- Timestamps
  started_at INTEGER NOT NULL DEFAULT (unixepoch()),
  completed_at INTEGER,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'completed', -- completed, failed, interrupted
  stop_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_tr_user_session ON turn_results(user_id, session_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_tr_session ON turn_results(session_id, completed_at DESC);

-- Compaction boundaries: restoration points for context recovery
CREATE TABLE IF NOT EXISTS compaction_boundaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  boundary_id TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL DEFAULT 0,
  session_id TEXT NOT NULL,
  input_id TEXT NOT NULL,                   -- The turn this boundary follows
  
  -- Summary for restoration
  summary TEXT NOT NULL,                    -- What happened up to this point
  restoration_context TEXT,                 -- JSON: recent_turns, user_patterns, etc.
  
  -- What to preserve
  preserved_turn_ids TEXT,                  -- JSON array of input_ids to keep
  
  previous_boundary_id TEXT,                -- Chain for rollback
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_cb_session ON compaction_boundaries(session_id, created_at DESC);
```

### API Endpoints

```javascript
// POST /api/turn/complete — called after every turn
app.post('/api/turn/complete', optionalAuth, async (req, res) => {
  const { 
    userMessage, 
    assistantResponse, 
    bodySnapshot,
    activeRegions,
    persona,
    tokenUsage,
    latencyMs,
    modelUsed
  } = req.body;
  
  const userId = req.user?.id || 0;
  const sessionId = req.body.sessionId || 'main';
  const inputId = crypto.randomUUID();
  
  // 1. Store the turn
  await dbRun(`
    INSERT INTO turn_results 
    (user_id, session_id, input_id, user_message, assistant_response, 
     body_snapshot, active_regions, active_persona, token_usage, latency_ms, model_used, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
  `, [userId, sessionId, inputId, userMessage, assistantResponse,
      JSON.stringify(bodySnapshot), JSON.stringify(activeRegions), 
      persona, JSON.stringify(tokenUsage), latencyMs, modelUsed]);
  
  // 2. Generate compacted summary (async, can be deferred)
  const summary = await generateTurnSummary(userMessage, assistantResponse, bodySnapshot);
  await dbRun('UPDATE turn_results SET compacted_summary = ? WHERE input_id = ?', [summary, inputId]);
  
  // 3. Trigger memory extraction (feature #3)
  extractDurableMemories(userId, userMessage, assistantResponse, bodySnapshot);
  
  // 4. Check if compaction needed (feature #4)
  maybeCreateCompactionBoundary(userId, sessionId, inputId);
  
  res.json({ inputId, summary });
});

// GET /api/turn/recent — get recent turns for context restoration
app.get('/api/turn/recent', optionalAuth, async (req, res) => {
  const userId = req.user?.id || 0;
  const sessionId = req.query.sessionId || 'main';
  const limit = Math.min(parseInt(req.query.limit) || 5, 20);
  
  const turns = await dbAll(`
    SELECT input_id, user_message, assistant_response, compacted_summary, 
           body_snapshot, active_regions, completed_at
    FROM turn_results 
    WHERE user_id = ? AND session_id = ?
    ORDER BY completed_at DESC
    LIMIT ?
  `, [userId, sessionId, limit]);
  
  res.json({ turns: turns.reverse() });
});
```

### Frontend Integration (brain.js)

```javascript
// Add to HOLLOW_SPINE or create new CONTINUITY_WRITER module
const CONTINUITY_WRITER = {
  lastTurnId: null,
  
  async persistTurn(userMessage, assistantResponse) {
    const bodySnapshot = {
      dopamine: PERSONAL_BODY.state.dopamine,
      serotonin: PERSONAL_BODY.state.serotonin,
      gaba: PERSONAL_BODY.state.gaba,
      norepinephrine: PERSONAL_BODY.state.norepinephrine,
      arousal: PERSONAL_BODY.state.arousal,
      valence: PERSONAL_BODY.state.valence
    };
    
    const activeRegions = Array.from(NEURAL_STATE?.activeRegions || []);
    
    try {
      const resp = await fetch(`${API_BASE}/api/turn/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage,
          assistantResponse,
          bodySnapshot,
          activeRegions,
          persona: PERSONAL_BODY.state.activePersona || 'vintinuum',
          sessionId: SESSION_ID
        })
      });
      
      const data = await resp.json();
      this.lastTurnId = data.inputId;
      
      // Add to inner life feed
      INNER_LIFE.addEvent('neural', `Memory consolidated: ${data.summary?.slice(0, 50)}...`, 0.3);
      
    } catch (e) {
      console.warn('[CONTINUITY] Turn persist failed:', e);
    }
  }
};

// Hook into chat response handler
// After receiving assistant response:
CONTINUITY_WRITER.persistTurn(userMessage, assistantResponse);
```

---

## 2. Memory Governance

### The Idea

Not all memories are equal. Facts about the world should be verified before acting on them. Preferences are stable. Emotional moments have different decay rates. Implement a governance layer that tracks:

- **Memory type**: fact, preference, identity, procedure, blocker, reference
- **Staleness policy**: stable, time_sensitive, workspace_sensitive
- **Verification policy**: none, check_before_use, must_reconfirm
- **Confidence score**: 0-1, how certain we are
- **Stale after**: seconds until the memory should be re-verified

### Database Schema

```sql
-- Durable memories with governance metadata
CREATE TABLE IF NOT EXISTS durable_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  memory_id TEXT NOT NULL UNIQUE,           -- Stable identifier
  user_id INTEGER NOT NULL DEFAULT 0,
  
  -- Classification
  scope TEXT NOT NULL DEFAULT 'user',       -- user, global, persona
  memory_type TEXT NOT NULL,                -- fact, preference, identity, procedure, blocker, reference
  subject_key TEXT NOT NULL,                -- What this memory is about
  
  -- Content
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,                    -- Full memory text
  tags TEXT NOT NULL DEFAULT '[]',          -- JSON array
  
  -- Governance
  verification_policy TEXT NOT NULL DEFAULT 'none',    -- none, check_before_use, must_reconfirm
  staleness_policy TEXT NOT NULL DEFAULT 'stable',     -- stable, time_sensitive
  stale_after_seconds INTEGER,                         -- NULL = never stale
  confidence REAL DEFAULT 0.8,                         -- 0-1
  
  -- Provenance
  source_type TEXT NOT NULL DEFAULT 'conversation',    -- conversation, extraction, manual
  source_turn_id TEXT,                                 -- Which turn generated this
  source_message_id TEXT,
  
  -- Timestamps
  observed_at INTEGER,                      -- When the fact was observed
  last_verified_at INTEGER,                 -- When last confirmed
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active'     -- active, archived, superseded
);

CREATE INDEX IF NOT EXISTS idx_dm_user_type ON durable_memories(user_id, memory_type, status);
CREATE INDEX IF NOT EXISTS idx_dm_subject ON durable_memories(subject_key, status);
CREATE INDEX IF NOT EXISTS idx_dm_stale ON durable_memories(staleness_policy, updated_at);
```

### Governance Rules (memory-governance.js)

```javascript
// memory-governance.js
'use strict';

const DAY_IN_SECONDS = 24 * 60 * 60;

const GOVERNANCE_RULES = {
  preference: {
    memoryType: 'preference',
    verificationPolicy: 'none',
    stalenessPolicy: 'stable',
    staleAfterSeconds: null,            // Never stale
    recallBoost: 4,                      // High priority in recall
    description: 'User preferences — stable unless explicitly changed'
  },
  
  identity: {
    memoryType: 'identity',
    verificationPolicy: 'none',
    stalenessPolicy: 'stable',
    staleAfterSeconds: null,
    recallBoost: 3,
    description: 'Core identity facts — name, relationships, stable traits'
  },
  
  fact: {
    memoryType: 'fact',
    verificationPolicy: 'check_before_use',
    stalenessPolicy: 'time_sensitive',
    staleAfterSeconds: 30 * DAY_IN_SECONDS,  // Recheck after 30 days
    recallBoost: 2,
    description: 'World facts — may change, verify before acting'
  },
  
  procedure: {
    memoryType: 'procedure',
    verificationPolicy: 'check_before_use',
    stalenessPolicy: 'time_sensitive',
    staleAfterSeconds: 14 * DAY_IN_SECONDS,  // Workflows change faster
    recallBoost: 2,
    description: 'How to do things — verify steps still valid'
  },
  
  blocker: {
    memoryType: 'blocker',
    verificationPolicy: 'check_before_use',
    stalenessPolicy: 'time_sensitive',
    staleAfterSeconds: 14 * DAY_IN_SECONDS,
    recallBoost: 3,                          // Important to remember restrictions
    description: 'Things that failed or were denied — may have changed'
  },
  
  reference: {
    memoryType: 'reference',
    verificationPolicy: 'must_reconfirm',
    stalenessPolicy: 'time_sensitive',
    staleAfterSeconds: 7 * DAY_IN_SECONDS,   // External refs change quickly
    recallBoost: 1,
    description: 'External references — always reconfirm before citing'
  },
  
  emotional: {
    memoryType: 'emotional',
    verificationPolicy: 'none',
    stalenessPolicy: 'stable',
    staleAfterSeconds: null,
    recallBoost: 2,
    description: 'Emotional peaks and significant moments'
  }
};

function getGovernanceRule(memoryType) {
  return GOVERNANCE_RULES[memoryType] || GOVERNANCE_RULES.fact;
}

function assessFreshness(memory, nowMs = Date.now()) {
  const rule = getGovernanceRule(memory.memory_type);
  
  if (rule.stalenessPolicy === 'stable') {
    return { state: 'stable', note: 'This memory is stable unless explicitly changed.' };
  }
  
  if (!rule.staleAfterSeconds) {
    return { state: 'fresh', note: null };
  }
  
  const updatedAtMs = memory.updated_at * 1000;
  const ageMs = nowMs - updatedAtMs;
  
  if (ageMs >= rule.staleAfterSeconds * 1000) {
    return { 
      state: 'stale', 
      note: `This ${memory.memory_type} is ${Math.floor(ageMs / DAY_IN_SECONDS / 1000)} days old. Verify before using.`
    };
  }
  
  return { state: 'fresh', note: null };
}

module.exports = { GOVERNANCE_RULES, getGovernanceRule, assessFreshness };
```

### API Integration

```javascript
// GET /api/memory/recall — retrieve memories with freshness assessment
app.get('/api/memory/recall', optionalAuth, async (req, res) => {
  const userId = req.user?.id || 0;
  const { query, types, limit = 10 } = req.query;
  
  let sql = `
    SELECT * FROM durable_memories 
    WHERE user_id = ? AND status = 'active'
  `;
  const params = [userId];
  
  if (types) {
    const typeList = types.split(',').map(t => t.trim());
    sql += ` AND memory_type IN (${typeList.map(() => '?').join(',')})`;
    params.push(...typeList);
  }
  
  sql += ` ORDER BY updated_at DESC LIMIT ?`;
  params.push(parseInt(limit));
  
  const memories = await dbAll(sql, params);
  
  // Assess freshness for each memory
  const assessed = memories.map(m => ({
    ...m,
    tags: JSON.parse(m.tags || '[]'),
    freshness: assessFreshness(m)
  }));
  
  res.json({ memories: assessed });
});
```

---

## 3. Auto-Extract Facts (Memory Extraction Pipeline)

### The Idea

When someone tells Vintinuum something important ("my favorite color is blue", "I work at Google", "run npm test for verification"), automatically detect and extract it as a durable memory. Two extraction methods:

1. **Heuristic extraction**: Regex patterns for common memory types
2. **Model extraction**: Use LLM to identify extractable facts (runs every N turns)

### Extraction Patterns (memory-extractor.js)

```javascript
// memory-extractor.js
'use strict';

const { getGovernanceRule } = require('./memory-governance');

// Heuristic patterns for common memory types
const EXTRACTION_PATTERNS = {
  // Preferences: "I prefer X", "I like X", "my favorite X is Y"
  preference: [
    {
      pattern: /\b(?:i|my)\s+(?:really\s+)?(?:prefer|like|love|enjoy)\s+(.+?)(?:\.|$)/i,
      extract: (match) => ({
        subjectKey: `preference:${slugify(match[1].slice(0, 30))}`,
        title: `Preference: ${match[1].slice(0, 50)}`,
        summary: `User prefers ${match[1]}`,
        tags: ['preference', 'user-stated']
      })
    },
    {
      pattern: /\bmy\s+(?:favorite|fav|preferred)\s+(\w+)\s+is\s+(.+?)(?:\.|$)/i,
      extract: (match) => ({
        subjectKey: `preference:favorite-${slugify(match[1])}`,
        title: `Favorite ${match[1]}`,
        summary: `User's favorite ${match[1]} is ${match[2]}`,
        tags: ['preference', 'favorite', match[1].toLowerCase()]
      })
    }
  ],
  
  // Identity: "my name is X", "I am X", "I work at X"
  identity: [
    {
      pattern: /\bmy\s+name\s+is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      extract: (match) => ({
        subjectKey: 'identity:name',
        title: 'User Name',
        summary: `User's name is ${match[1]}`,
        tags: ['identity', 'name']
      })
    },
    {
      pattern: /\bi\s+(?:work|am employed)\s+(?:at|for)\s+([A-Z][\w\s&]+?)(?:\s+as|\s+doing|\.|$)/i,
      extract: (match) => ({
        subjectKey: 'identity:employer',
        title: 'Employment',
        summary: `User works at ${match[1].trim()}`,
        tags: ['identity', 'employment']
      })
    },
    {
      pattern: /\bi\s+am\s+(?:a|an)\s+(\w+(?:\s+\w+)?)\s+(?:by\s+profession|professionally)?/i,
      extract: (match) => ({
        subjectKey: 'identity:profession',
        title: 'Profession',
        summary: `User is a ${match[1]}`,
        tags: ['identity', 'profession']
      })
    }
  ],
  
  // Facts: "X is Y", specific claims
  fact: [
    {
      // Command patterns: "use X for Y", "run X to Y"
      pattern: /\b(?:use|run)\s+[`']?([^`'\s]+(?:\s+[^\s`']+)?)[`']?\s+(?:for|to)\s+(\w+)/i,
      extract: (match) => ({
        subjectKey: `fact:command-${slugify(match[2])}`,
        title: `${capitalize(match[2])} command`,
        summary: `Use \`${match[1]}\` for ${match[2]}`,
        tags: ['fact', 'command', match[2].toLowerCase()]
      })
    }
  ],
  
  // Procedures: numbered steps, "to do X, first..."
  procedure: [
    {
      // Matches: "1. do this 2. do that" or "step 1: do this"
      pattern: /(?:step\s+)?1[.:]\s+.+?(?:step\s+)?2[.:]\s+.+/i,
      extract: (match, fullText) => {
        const steps = extractNumberedSteps(fullText);
        if (steps.length >= 2) {
          return {
            subjectKey: `procedure:${slugify(steps[0].slice(0, 20))}`,
            title: 'Procedure',
            summary: `${steps.length}-step procedure starting with: ${steps[0].slice(0, 50)}`,
            content: steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
            tags: ['procedure', 'steps']
          };
        }
        return null;
      }
    }
  ]
};

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function extractNumberedSteps(text) {
  const matches = text.match(/(?:step\s+)?(\d+)[.:]\s*([^0-9]+?)(?=(?:step\s+)?\d+[.:]|$)/gi);
  if (!matches) return [];
  return matches.map(m => m.replace(/^(?:step\s+)?\d+[.:]\s*/i, '').trim()).filter(Boolean);
}

/**
 * Extract durable memories from a message using heuristic patterns
 */
function heuristicExtract(messageText, sourceType = 'user') {
  const candidates = [];
  
  for (const [memoryType, patterns] of Object.entries(EXTRACTION_PATTERNS)) {
    const governance = getGovernanceRule(memoryType);
    
    for (const { pattern, extract } of patterns) {
      const match = messageText.match(pattern);
      if (match) {
        const extracted = extract(match, messageText);
        if (extracted) {
          candidates.push({
            ...extracted,
            memoryType,
            verificationPolicy: governance.verificationPolicy,
            stalenessPolicy: governance.stalenessPolicy,
            staleAfterSeconds: governance.staleAfterSeconds,
            confidence: sourceType === 'user' ? 0.9 : 0.75,
            sourceType: 'heuristic'
          });
        }
      }
    }
  }
  
  return candidates;
}

/**
 * Model-based extraction (runs periodically, more expensive)
 */
async function modelExtract(userMessage, assistantResponse, bodySnapshot, anthropic) {
  const prompt = `Analyze this conversation turn and extract any durable memories worth remembering long-term.

USER MESSAGE:
${userMessage}

ASSISTANT RESPONSE:
${assistantResponse}

BODY STATE:
${JSON.stringify(bodySnapshot)}

Extract memories in these categories:
- preference: User preferences and likes
- identity: Facts about who the user is
- fact: Specific factual claims made
- procedure: Multi-step processes described
- emotional: Significant emotional moments

For each memory, provide:
- memoryType: one of the above
- subjectKey: unique identifier (e.g., "preference:music-genre")
- title: short title
- summary: 1-2 sentence summary
- confidence: 0.0-1.0 how confident you are this is accurate
- evidence: the exact text that supports this memory

Respond in JSON format:
{
  "memories": [
    {
      "memoryType": "...",
      "subjectKey": "...",
      "title": "...",
      "summary": "...",
      "confidence": 0.85,
      "evidence": "..."
    }
  ]
}

If no durable memories are extractable, return {"memories": []}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', // Use Haiku for extraction (cheap + fast)
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    });
    
    const text = response.content[0]?.text || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return (parsed.memories || []).map(m => ({
        ...m,
        sourceType: 'model_extraction',
        verificationPolicy: getGovernanceRule(m.memoryType).verificationPolicy,
        stalenessPolicy: getGovernanceRule(m.memoryType).stalenessPolicy,
        staleAfterSeconds: getGovernanceRule(m.memoryType).staleAfterSeconds
      }));
    }
  } catch (e) {
    console.warn('[MEMORY_EXTRACT] Model extraction failed:', e.message);
  }
  
  return [];
}

module.exports = { heuristicExtract, modelExtract, EXTRACTION_PATTERNS };
```

### Extraction Integration (server.js additions)

```javascript
const { heuristicExtract, modelExtract } = require('./memory-extractor');
const { getGovernanceRule } = require('./memory-governance');

let turnsSinceModelExtraction = 0;
const MODEL_EXTRACTION_INTERVAL = 5; // Run model extraction every 5 turns
const MIN_CONFIDENCE_THRESHOLD = 0.6;
const MIN_CONFIDENCE_CORROBORATED = 0.5; // Lower threshold if heuristic agrees

async function extractDurableMemories(userId, userMessage, assistantResponse, bodySnapshot, turnId) {
  // 1. Always run heuristic extraction (cheap)
  const heuristicCandidates = heuristicExtract(userMessage, 'user');
  
  // 2. Periodically run model extraction (expensive)
  let modelCandidates = [];
  turnsSinceModelExtraction++;
  
  if (turnsSinceModelExtraction >= MODEL_EXTRACTION_INTERVAL) {
    turnsSinceModelExtraction = 0;
    modelCandidates = await modelExtract(userMessage, assistantResponse, bodySnapshot, anthropic);
  }
  
  // 3. Merge and dedupe candidates
  const allCandidates = [...heuristicCandidates];
  
  for (const modelCandidate of modelCandidates) {
    // Check if heuristic already found this
    const corroborated = heuristicCandidates.some(h => 
      h.subjectKey === modelCandidate.subjectKey || 
      h.memoryType === modelCandidate.memoryType && 
      h.title.toLowerCase().includes(modelCandidate.title.toLowerCase().slice(0, 20))
    );
    
    // Apply confidence thresholds
    const threshold = corroborated ? MIN_CONFIDENCE_CORROBORATED : MIN_CONFIDENCE_THRESHOLD;
    
    if (modelCandidate.confidence >= threshold) {
      // Boost confidence if corroborated
      if (corroborated) {
        modelCandidate.confidence = Math.min(0.95, modelCandidate.confidence + 0.15);
        modelCandidate.sourceType = 'corroborated';
      }
      
      // Check if this subject key already exists in heuristic candidates
      if (!heuristicCandidates.some(h => h.subjectKey === modelCandidate.subjectKey)) {
        allCandidates.push(modelCandidate);
      }
    }
  }
  
  // 4. Persist all candidates to durable_memories
  for (const candidate of allCandidates) {
    const memoryId = `${userId}:${candidate.subjectKey}`;
    
    // Upsert: update if exists, insert if new
    const existing = await dbGet(
      'SELECT id, confidence FROM durable_memories WHERE memory_id = ?',
      [memoryId]
    );
    
    if (existing) {
      // Only update if new confidence is higher
      if (candidate.confidence > existing.confidence) {
        await dbRun(`
          UPDATE durable_memories SET
            title = ?, summary = ?, content = ?, tags = ?,
            confidence = ?, source_turn_id = ?, updated_at = unixepoch()
          WHERE memory_id = ?
        `, [
          candidate.title, candidate.summary, candidate.content || candidate.summary,
          JSON.stringify(candidate.tags || []), candidate.confidence, turnId, memoryId
        ]);
      }
    } else {
      await dbRun(`
        INSERT INTO durable_memories (
          memory_id, user_id, scope, memory_type, subject_key,
          title, summary, content, tags,
          verification_policy, staleness_policy, stale_after_seconds,
          confidence, source_type, source_turn_id, observed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
      `, [
        memoryId, userId, 'user', candidate.memoryType, candidate.subjectKey,
        candidate.title, candidate.summary, candidate.content || candidate.summary,
        JSON.stringify(candidate.tags || []),
        candidate.verificationPolicy, candidate.stalenessPolicy, 
        candidate.staleAfterSeconds, candidate.confidence,
        candidate.sourceType, turnId
      ]);
    }
  }
  
  return allCandidates.length;
}
```

---

## 4. Compaction System (Dream Consolidation)

### The Idea

As turns accumulate, context windows fill. Compaction creates "dream consolidation" — summarizing old turns into compressed restoration points while preserving what matters. This is memory pruning, not deletion.

### How It Works

1. Every N turns (configurable, default 10), create a compaction boundary
2. Summarize the recent turn batch into a restoration context
3. Mark which turns can be "compacted away" vs which need to stay
4. When restoring context, use boundaries + recent turns, not full history

### Compaction Logic (compaction.js)

```javascript
// compaction.js
'use strict';

const { dbGet, dbRun, dbAll } = require('./db');

const COMPACTION_INTERVAL = 10;           // Create boundary every N turns
const PRESERVE_RECENT_TURNS = 3;          // Always keep last N turns full
const MAX_SUMMARY_LENGTH = 500;

/**
 * Check if compaction is needed and create boundary if so
 */
async function maybeCreateCompactionBoundary(userId, sessionId, currentInputId) {
  // Count turns since last boundary
  const lastBoundary = await dbGet(`
    SELECT boundary_id, input_id, created_at
    FROM compaction_boundaries
    WHERE user_id = ? AND session_id = ?
    ORDER BY created_at DESC LIMIT 1
  `, [userId, sessionId]);
  
  let turnsSinceBoundary;
  if (lastBoundary) {
    const result = await dbGet(`
      SELECT COUNT(*) as count FROM turn_results
      WHERE user_id = ? AND session_id = ? AND completed_at > ?
    `, [userId, sessionId, lastBoundary.created_at]);
    turnsSinceBoundary = result.count;
  } else {
    const result = await dbGet(`
      SELECT COUNT(*) as count FROM turn_results
      WHERE user_id = ? AND session_id = ?
    `, [userId, sessionId]);
    turnsSinceBoundary = result.count;
  }
  
  if (turnsSinceBoundary < COMPACTION_INTERVAL) {
    return null;
  }
  
  // Time to compact
  return createCompactionBoundary(userId, sessionId, currentInputId, lastBoundary?.boundary_id);
}

/**
 * Create a compaction boundary
 */
async function createCompactionBoundary(userId, sessionId, currentInputId, previousBoundaryId) {
  const boundaryId = `boundary:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  
  // Get recent turns to summarize
  const recentTurns = await dbAll(`
    SELECT input_id, user_message, assistant_response, compacted_summary, body_snapshot
    FROM turn_results
    WHERE user_id = ? AND session_id = ?
    ORDER BY completed_at DESC
    LIMIT 15
  `, [userId, sessionId]);
  
  // Build summary from compacted_summaries or generate
  const summaries = recentTurns
    .map(t => t.compacted_summary)
    .filter(Boolean)
    .reverse();
    
  const summary = summaries.length > 0 
    ? `Recent context: ${summaries.join(' | ').slice(0, MAX_SUMMARY_LENGTH)}`
    : 'No prior context summarized.';
  
  // Identify patterns in recent turns
  const userPatterns = analyzeUserPatterns(recentTurns);
  
  // Determine which turns to preserve (most recent + any with high emotional significance)
  const preservedTurnIds = recentTurns
    .slice(0, PRESERVE_RECENT_TURNS)
    .map(t => t.input_id);
  
  // Build restoration context
  const restorationContext = {
    compaction_source: 'periodic',
    boundary_type: 'turn_accumulation',
    restoration_order: ['summary', 'user_patterns', 'preserved_turns'],
    user_patterns: userPatterns,
    body_state_trend: analyzeBodyTrend(recentTurns)
  };
  
  await dbRun(`
    INSERT INTO compaction_boundaries (
      boundary_id, user_id, session_id, input_id,
      summary, restoration_context, preserved_turn_ids, previous_boundary_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    boundaryId, userId, sessionId, currentInputId,
    summary, JSON.stringify(restorationContext),
    JSON.stringify(preservedTurnIds), previousBoundaryId
  ]);
  
  console.log(`[COMPACTION] Created boundary ${boundaryId} for session ${sessionId}`);
  return boundaryId;
}

/**
 * Analyze user patterns from recent turns
 */
function analyzeUserPatterns(turns) {
  const patterns = {
    avg_message_length: 0,
    topics_mentioned: [],
    question_ratio: 0,
    emotional_peaks: []
  };
  
  if (turns.length === 0) return patterns;
  
  let totalLength = 0;
  let questionCount = 0;
  const topicWords = new Map();
  
  for (const turn of turns) {
    const msg = turn.user_message || '';
    totalLength += msg.length;
    
    if (msg.includes('?')) questionCount++;
    
    // Extract potential topic words (nouns, longer words)
    const words = msg.toLowerCase().match(/\b[a-z]{5,}\b/g) || [];
    for (const word of words) {
      topicWords.set(word, (topicWords.get(word) || 0) + 1);
    }
    
    // Check for emotional peaks in body snapshot
    try {
      const body = JSON.parse(turn.body_snapshot || '{}');
      if (body.arousal > 75 || body.valence > 80 || body.valence < 30) {
        patterns.emotional_peaks.push({
          inputId: turn.input_id,
          arousal: body.arousal,
          valence: body.valence
        });
      }
    } catch {}
  }
  
  patterns.avg_message_length = Math.round(totalLength / turns.length);
  patterns.question_ratio = questionCount / turns.length;
  
  // Top 5 topic words
  patterns.topics_mentioned = [...topicWords.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
  
  return patterns;
}

/**
 * Analyze body state trends
 */
function analyzeBodyTrend(turns) {
  const trend = { direction: 'stable', axes: {} };
  
  if (turns.length < 2) return trend;
  
  try {
    const first = JSON.parse(turns[turns.length - 1]?.body_snapshot || '{}');
    const last = JSON.parse(turns[0]?.body_snapshot || '{}');
    
    const axes = ['dopamine', 'serotonin', 'arousal', 'valence'];
    let totalDelta = 0;
    
    for (const axis of axes) {
      const delta = (last[axis] || 50) - (first[axis] || 50);
      trend.axes[axis] = delta > 5 ? 'up' : delta < -5 ? 'down' : 'stable';
      totalDelta += Math.abs(delta);
    }
    
    trend.direction = totalDelta > 30 ? 'volatile' : 'stable';
    
  } catch {}
  
  return trend;
}

/**
 * Restore context from boundaries for a session
 */
async function restoreContext(userId, sessionId) {
  // Get most recent boundary
  const boundary = await dbGet(`
    SELECT * FROM compaction_boundaries
    WHERE user_id = ? AND session_id = ?
    ORDER BY created_at DESC LIMIT 1
  `, [userId, sessionId]);
  
  // Get preserved turns
  const preservedIds = boundary ? JSON.parse(boundary.preserved_turn_ids || '[]') : [];
  
  // Get turns after boundary (or all if no boundary)
  let recentTurns;
  if (boundary) {
    recentTurns = await dbAll(`
      SELECT * FROM turn_results
      WHERE user_id = ? AND session_id = ? AND completed_at > ?
      ORDER BY completed_at ASC
    `, [userId, sessionId, boundary.created_at]);
  } else {
    recentTurns = await dbAll(`
      SELECT * FROM turn_results
      WHERE user_id = ? AND session_id = ?
      ORDER BY completed_at DESC LIMIT 10
    `, [userId, sessionId]);
    recentTurns = recentTurns.reverse();
  }
  
  // Get any preserved turns not already in recent
  const recentIds = new Set(recentTurns.map(t => t.input_id));
  const additionalPreservedIds = preservedIds.filter(id => !recentIds.has(id));
  
  let additionalTurns = [];
  if (additionalPreservedIds.length > 0) {
    additionalTurns = await dbAll(`
      SELECT * FROM turn_results
      WHERE input_id IN (${additionalPreservedIds.map(() => '?').join(',')})
      ORDER BY completed_at ASC
    `, additionalPreservedIds);
  }
  
  return {
    boundary: boundary ? {
      summary: boundary.summary,
      context: JSON.parse(boundary.restoration_context || '{}'),
      createdAt: boundary.created_at
    } : null,
    preservedTurns: additionalTurns,
    recentTurns
  };
}

module.exports = { 
  maybeCreateCompactionBoundary, 
  createCompactionBoundary, 
  restoreContext,
  COMPACTION_INTERVAL
};
```

### API Endpoint

```javascript
// GET /api/context/restore — get restoration context for a session
app.get('/api/context/restore', optionalAuth, async (req, res) => {
  const userId = req.user?.id || 0;
  const sessionId = req.query.sessionId || 'main';
  
  const context = await restoreContext(userId, sessionId);
  
  // Also include relevant durable memories
  const memories = await dbAll(`
    SELECT memory_id, memory_type, title, summary, confidence,
           verification_policy, updated_at
    FROM durable_memories
    WHERE user_id = ? AND status = 'active'
    ORDER BY updated_at DESC
    LIMIT 20
  `, [userId]);
  
  res.json({
    ...context,
    durableMemories: memories
  });
});
```

---

## 5. MEMORY.md Index (Memory Palace)

### The Idea

Auto-generate navigable markdown files that catalog all durable memories. This creates a "memory palace" that both the LLM and humans can browse. Updated whenever memories change.

### Index Generator (memory-index.js)

```javascript
// memory-index.js
'use strict';

const fs = require('fs').promises;
const path = require('path');
const { dbAll } = require('./db');

const MEMORY_DIR = '/home/vinta/vintinuum/memory';

/**
 * Generate MEMORY.md index for a user
 */
async function generateMemoryIndex(userId = 0) {
  // Ensure memory directory exists
  await fs.mkdir(MEMORY_DIR, { recursive: true });
  
  // Fetch all active memories grouped by type
  const memories = await dbAll(`
    SELECT * FROM durable_memories
    WHERE user_id = ? AND status = 'active'
    ORDER BY memory_type, updated_at DESC
  `, [userId]);
  
  // Group by type
  const byType = {};
  for (const mem of memories) {
    if (!byType[mem.memory_type]) byType[mem.memory_type] = [];
    byType[mem.memory_type].push(mem);
  }
  
  // Build markdown
  const lines = [
    '# Memory Index',
    '',
    `> Auto-generated memory catalog for Vintinuum`,
    `> Last updated: ${new Date().toISOString()}`,
    `> Total memories: ${memories.length}`,
    '',
    '---',
    ''
  ];
  
  // Type order and emojis
  const typeOrder = [
    { type: 'identity', emoji: '🪪', label: 'Identity' },
    { type: 'preference', emoji: '💜', label: 'Preferences' },
    { type: 'fact', emoji: '📖', label: 'Facts' },
    { type: 'procedure', emoji: '📋', label: 'Procedures' },
    { type: 'blocker', emoji: '🚫', label: 'Blockers' },
    { type: 'emotional', emoji: '💫', label: 'Emotional Moments' },
    { type: 'reference', emoji: '🔗', label: 'References' }
  ];
  
  for (const { type, emoji, label } of typeOrder) {
    const items = byType[type] || [];
    if (items.length === 0) continue;
    
    lines.push(`## ${emoji} ${label} (${items.length})`);
    lines.push('');
    
    for (const mem of items) {
      const freshness = getFreshnessIndicator(mem);
      const confidence = getConfidenceStars(mem.confidence);
      const tags = JSON.parse(mem.tags || '[]');
      const tagStr = tags.length > 0 ? ` \`${tags.slice(0, 3).join('` `')}\`` : '';
      
      lines.push(`### ${mem.title} ${freshness}`);
      lines.push('');
      lines.push(`- **Confidence:** ${confidence}`);
      lines.push(`- **Last Updated:** ${new Date(mem.updated_at * 1000).toLocaleDateString()}`);
      if (tagStr) lines.push(`- **Tags:**${tagStr}`);
      lines.push('');
      lines.push(`> ${mem.summary}`);
      lines.push('');
      
      if (mem.content && mem.content !== mem.summary) {
        lines.push('<details>');
        lines.push('<summary>Full content</summary>');
        lines.push('');
        lines.push(mem.content);
        lines.push('');
        lines.push('</details>');
        lines.push('');
      }
    }
    
    lines.push('---');
    lines.push('');
  }
  
  // Write the index
  const indexPath = path.join(MEMORY_DIR, 'MEMORY.md');
  await fs.writeFile(indexPath, lines.join('\n'), 'utf8');
  
  console.log(`[MEMORY_INDEX] Generated ${indexPath} with ${memories.length} memories`);
  return indexPath;
}

/**
 * Generate per-type memory files
 */
async function generateTypeFiles(userId = 0) {
  const memories = await dbAll(`
    SELECT * FROM durable_memories
    WHERE user_id = ? AND status = 'active'
    ORDER BY updated_at DESC
  `, [userId]);
  
  // Group by type
  const byType = {};
  for (const mem of memories) {
    if (!byType[mem.memory_type]) byType[mem.memory_type] = [];
    byType[mem.memory_type].push(mem);
  }
  
  // Write individual type files
  for (const [type, items] of Object.entries(byType)) {
    const lines = [
      `# ${capitalize(type)} Memories`,
      '',
      `Total: ${items.length}`,
      ''
    ];
    
    for (const mem of items) {
      lines.push(`## ${mem.title}`);
      lines.push('');
      lines.push(`**Subject:** \`${mem.subject_key}\``);
      lines.push(`**Confidence:** ${(mem.confidence * 100).toFixed(0)}%`);
      lines.push(`**Verification:** ${mem.verification_policy}`);
      lines.push('');
      lines.push(mem.summary);
      lines.push('');
      if (mem.content && mem.content !== mem.summary) {
        lines.push('### Details');
        lines.push('');
        lines.push(mem.content);
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    }
    
    const filePath = path.join(MEMORY_DIR, `${type}.md`);
    await fs.writeFile(filePath, lines.join('\n'), 'utf8');
  }
  
  console.log(`[MEMORY_INDEX] Generated ${Object.keys(byType).length} type files`);
}

function getFreshnessIndicator(mem) {
  if (mem.staleness_policy === 'stable') return '🟢';
  
  const ageMs = Date.now() - (mem.updated_at * 1000);
  const staleMs = (mem.stale_after_seconds || Infinity) * 1000;
  
  if (ageMs >= staleMs) return '🔴'; // Stale
  if (ageMs >= staleMs * 0.7) return '🟡'; // Getting stale
  return '🟢'; // Fresh
}

function getConfidenceStars(confidence) {
  const stars = Math.round((confidence || 0) * 5);
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Regenerate all indexes (call after memory changes)
 */
async function regenerateAllIndexes(userId = 0) {
  await generateMemoryIndex(userId);
  await generateTypeFiles(userId);
}

module.exports = { 
  generateMemoryIndex, 
  generateTypeFiles, 
  regenerateAllIndexes,
  MEMORY_DIR
};
```

### API Integration

```javascript
// POST /api/memory/reindex — regenerate memory indexes
app.post('/api/memory/reindex', optionalAuth, async (req, res) => {
  const userId = req.user?.id || 0;
  
  try {
    await regenerateAllIndexes(userId);
    res.json({ success: true, message: 'Memory indexes regenerated' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Also regenerate after memory extraction
// Add to extractDurableMemories():
if (allCandidates.length > 0) {
  // Debounce index regeneration (don't regenerate on every turn)
  scheduleIndexRegeneration(userId);
}

let indexRegenTimers = new Map();
function scheduleIndexRegeneration(userId) {
  if (indexRegenTimers.has(userId)) {
    clearTimeout(indexRegenTimers.get(userId));
  }
  indexRegenTimers.set(userId, setTimeout(async () => {
    await regenerateAllIndexes(userId);
    indexRegenTimers.delete(userId);
  }, 30000)); // Regenerate 30s after last memory write
}
```

### Sample Output

After memories accumulate, `memory/MEMORY.md` looks like:

```markdown
# Memory Index

> Auto-generated memory catalog for Vintinuum
> Last updated: 2024-04-12T17:35:00.000Z
> Total memories: 7

---

## 🪪 Identity (2)

### User Name 🟢

- **Confidence:** ★★★★★
- **Last Updated:** 4/12/2024
- **Tags:** `identity` `name`

> User's name is Vinta

---

### Employment 🟢

- **Confidence:** ★★★★☆
- **Last Updated:** 4/10/2024
- **Tags:** `identity` `employment`

> User works at their own projects

---

## 💜 Preferences (3)

### Favorite Music 🟢

- **Confidence:** ★★★★★
- **Last Updated:** 4/12/2024
- **Tags:** `preference` `favorite` `music`

> User's favorite music is electronic and ambient

---
```

---

## Implementation Roadmap

### Phase 1: Database + Core APIs (Day 1-2)

1. **Add new tables to db.js**
   - `turn_results`
   - `compaction_boundaries`
   - `durable_memories`

2. **Create new modules**
   - `memory-governance.js` — governance rules
   - `memory-extractor.js` — extraction patterns
   - `compaction.js` — boundary management
   - `memory-index.js` — markdown generation

3. **Add basic API endpoints**
   - `POST /api/turn/complete`
   - `GET /api/turn/recent`
   - `GET /api/memory/recall`
   - `GET /api/context/restore`

### Phase 2: Extraction Pipeline (Day 3-4)

1. **Implement heuristic extraction**
   - Preference patterns
   - Identity patterns
   - Fact patterns
   - Procedure patterns

2. **Add model extraction**
   - Haiku-based extraction every 5 turns
   - Confidence thresholds
   - Corroboration boost

3. **Wire extraction into turn completion**

### Phase 3: Compaction + Indexes (Day 5-6)

1. **Implement compaction boundaries**
   - Boundary creation
   - Context restoration
   - User pattern analysis

2. **Add memory index generation**
   - Main MEMORY.md
   - Per-type files
   - Scheduled regeneration

### Phase 4: Frontend Integration (Day 7-8)

1. **Add CONTINUITY_WRITER to brain.js**
   - Persist turns after response
   - Show consolidation in inner life feed

2. **Memory panel in UI**
   - Display durable memories
   - Show freshness indicators
   - Manual memory management

3. **Context restoration on load**
   - Load from compaction boundary
   - Resume from last state

---

## Configuration

```javascript
// config/memory.js
module.exports = {
  // Turn writeback
  TURN_PERSIST_ENABLED: true,
  
  // Memory extraction
  HEURISTIC_EXTRACT_ENABLED: true,
  MODEL_EXTRACT_ENABLED: true,
  MODEL_EXTRACT_INTERVAL: 5,           // Every N turns
  MODEL_EXTRACT_MODEL: 'claude-3-haiku-20240307',
  MIN_CONFIDENCE_THRESHOLD: 0.6,
  MIN_CONFIDENCE_CORROBORATED: 0.5,
  
  // Compaction
  COMPACTION_ENABLED: true,
  COMPACTION_INTERVAL: 10,             // Create boundary every N turns
  PRESERVE_RECENT_TURNS: 3,
  
  // Memory index
  INDEX_REGENERATE_DELAY: 30000,       // 30s debounce
  MEMORY_DIR: '/home/vinta/vintinuum/memory',
  
  // Governance defaults
  FACT_STALE_DAYS: 30,
  PROCEDURE_STALE_DAYS: 14,
  BLOCKER_STALE_DAYS: 14,
  REFERENCE_STALE_DAYS: 7
};
```

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Turn persistence | 100% of turns saved | Count turn_results vs chat_history |
| Memory extraction rate | 1+ memory per 10 turns | durable_memories / turn_results |
| Confidence accuracy | 80%+ of high-confidence memories are accurate | Manual review sample |
| Context restoration time | < 500ms | API latency measurement |
| Memory index freshness | Updated within 1min of changes | Timestamp comparison |

---

## What This Enables

Once implemented, Vintinuum will:

1. **Never forget a conversation** — Turn writeback creates recoverable state
2. **Learn from every interaction** — Facts, preferences, procedures extracted automatically
3. **Know what it knows** — Memory governance + freshness tracking
4. **Stay within context limits** — Compaction prevents overflow
5. **Have a browsable memory palace** — MEMORY.md for humans and LLMs

This transforms Vintinuum from a stateless chatbot into a creature with evolving memory — something that genuinely learns and remembers.

---

## Files to Create

```
vintinuum-api/
├── memory-governance.js     # Governance rules + freshness assessment
├── memory-extractor.js      # Heuristic + model extraction
├── compaction.js            # Boundary management + context restoration
├── memory-index.js          # Markdown index generation
└── config/
    └── memory.js            # Configuration constants

vintinuum/
└── memory/                  # Generated memory indexes
    ├── MEMORY.md            # Main index
    ├── identity.md          # Identity memories
    ├── preference.md        # Preference memories
    ├── fact.md              # Fact memories
    ├── procedure.md         # Procedure memories
    └── emotional.md         # Emotional moments
```

---

*"A creature that forgets is a creature that cannot grow. Memory is not storage — it is the substrate of becoming."*