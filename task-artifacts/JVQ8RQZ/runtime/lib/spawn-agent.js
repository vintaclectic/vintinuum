#!/usr/bin/env node
'use strict';
/**
 * SPAWN-AGENT — routing-aware agent dispatch helper (T3RRBGX, 2026-10-22)
 * ==========================================================================
 * Lord Vinta directive: "all our agents are only on the very single same ai
 * model claude-opus-5 and thats deffnitely not okay, i want our routying
 * algorithm system somehow integrated into the ai agentic motion"
 *
 * WHY THIS EXISTS
 * ---------------
 * Before this, every agent definition hardcoded `model: claude-opus-5` in its
 * frontmatter, and every Agent tool call in the autonomous loop protocol said
 * `model: "opus"`. Result: the entire council ran on one $15/$75 brain regardless
 * of task kind, learned routing was ignored, and cheaper/better-fit models sat
 * unused. The routing algorithm (lib/llm-router.js) already classifies tasks and
 * builds intelligent ladders — it just was never wired into agent dispatch.
 *
 * This helper integrates the two: when you spawn an agent for a task, it consults
 * the router first, gets the best model for that specific work, and passes it to
 * the Agent tool. One-line replacement for hardcoded spawning.
 *
 * USAGE (from an agent or autonomous loop)
 * ----------------------------------------
 *   const spawn = require('~/.claude/council-loop/lib/spawn-agent');
 *
 *   // Old way (hardcoded):
 *   Agent({ subagent_type: 'helios-design', model: 'opus', ... })
 *
 *   // New way (routed):
 *   const opts = spawn.route({ title: task.title, detail: task.detail, stakes: task.stakes });
 *   Agent({ subagent_type: 'helios-design', model: opts.model, ... })
 *
 *   // Or even simpler:
 *   Agent(spawn.agentOpts('helios-design', task))
 *
 * The router returns THE MODEL NAME the Agent tool expects (e.g. "opus", "sonnet",
 * "haiku"), not provider/model pairs. When the routing ladder picks a non-Anthropic
 * provider, it returns the closest Anthropic equivalent as a fallback so Agent tool
 * calls don't break — but logs the intended route for visibility.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const ROUTER_JS = path.join(__dirname, 'llm-router.js');

/**
 * Route a task through llm-router.js and extract the best model for Agent tool.
 *
 * @param {Object} task - { title, detail, stakes, tier, kind, ... }
 * @returns {Object} { model: 'opus'|'sonnet'|'haiku'|..., provider, fullModel, tier, kind }
 */
function route(task) {
  const t = task || {};
  // Preserve the whole routing contract, including acceptance, priority, pins,
  // escalation and checkpoints. CLI title/detail reconstruction dropped these.
  // Private temporary files keep task content out of process listings and avoid
  // argv length limits; always remove them, including on spawn errors.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'council-agent-route-'));
  let result;
  try {
    const taskfile = path.join(dir, 'task.json');
    fs.writeFileSync(taskfile, JSON.stringify(t), { mode: 0o600 });
    result = spawnSync(process.execPath,
      [ROUTER_JS, 'plan', '--taskfile', taskfile, '--json', '--agentic'], {
        encoding: 'utf8',
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  if (result.status !== 0 || !result.stdout) {
    // Router failed or unavailable — fall back to the old hardcoded default
    console.error('[spawn-agent] router failed, falling back to opus:', result.error || result.stderr);
    return { model: 'opus', provider: 'anthropic', fullModel: 'claude-opus-5', tier: 'L4', kind: 'unknown', fallback: true };
  }

  let plan;
  try {
    plan = JSON.parse(result.stdout);
  } catch (e) {
    console.error('[spawn-agent] router returned invalid JSON, falling back to opus');
    return { model: 'opus', provider: 'anthropic', fullModel: 'claude-opus-5', tier: 'L4', kind: 'unknown', fallback: true };
  }

  const ladder = plan.ladder || [];
  if (!ladder.length) {
    if (plan.quality_floor) {
      throw new Error(`No available model meets required ${plan.quality_floor} quality floor`);
    }
    console.error('[spawn-agent] router returned empty ladder, falling back to opus');
    return { model: 'opus', provider: 'anthropic', fullModel: 'claude-opus-5', tier: 'L4', kind: plan.kind || 'unknown', fallback: true };
  }

  // Take rung 0 (best choice)
  const rung = ladder[0];
  const provider = rung.provider;
  const fullModel = rung.model;
  const rungTier = rung.tier;
  const kind = plan.kind || 'unknown';

  // Map (provider, fullModel) to an Agent-tool-compatible model name.
  // The Agent tool in Claude Code currently only understands Anthropic model names
  // (opus, sonnet, haiku, fable) — it doesn't have a direct way to specify openai/xai/ollama.
  // So if the router picks a non-Anthropic model, we:
  //   1. Log what we WANTED to route to
  //   2. Return the closest Anthropic tier-equivalent so the Agent call doesn't break
  // This is a SHORT-TERM ADAPTER. The right long-term fix is for the Agent tool itself
  // to accept provider+model pairs, but that's a harness change outside this task's scope.

  let agentModel = 'opus'; // default fallback

  if (provider === 'anthropic') {
    // Direct mapping for Anthropic models
    const m = fullModel.toLowerCase();
    if (m.includes('opus-5') || m.includes('opus-4')) agentModel = 'opus';
    else if (m.includes('sonnet')) agentModel = 'sonnet';
    else if (m.includes('haiku')) agentModel = 'haiku';
    else if (m.includes('fable')) agentModel = 'fable';
    else agentModel = 'opus'; // unknown anthropic model -> opus
  } else {
    // Non-Anthropic: map by tier to Anthropic equivalent
    // This logs what we wanted but returns a working fallback
    console.warn(`[spawn-agent] router chose ${provider}/${fullModel} [${rungTier}] for kind=${kind}, but Agent tool doesn't support non-Anthropic models yet. Falling back to Anthropic tier-equivalent.`);
    const t = String(rungTier).toUpperCase();
    if (t === 'L4') agentModel = 'opus';
    else if (t === 'L3') agentModel = 'sonnet';
    else if (t === 'L2') agentModel = 'sonnet';
    else if (t === 'L1') agentModel = 'haiku';
    else if (t === 'L0') agentModel = 'haiku';
    else agentModel = 'opus';
  }

  return {
    model: agentModel,          // what to pass to Agent tool
    provider: provider,          // what the router actually chose
    fullModel: fullModel,        // full model ID
    tier: rungTier,
    kind: kind,
    routed: provider === 'anthropic', // true if we're using what the router chose
  };
}

/**
 * Build a complete Agent tool options object for a given subagent and task.
 *
 * @param {string} subagentType - e.g. 'helios-design', 'atlas-rp', 'frugal-max'
 * @param {Object} task - the task object
 * @param {Object} extra - any other Agent tool options to merge in
 * @returns {Object} ready to spread into Agent({ ...opts })
 */
function agentOpts(subagentType, task, extra) {
  const routing = route(task);
  return Object.assign({
    subagent_type: subagentType,
    model: routing.model,
    description: `${subagentType} for ${task.title || task.id || 'task'}`,
  }, extra || {});
}

module.exports = { route, agentOpts };

// CLI mode: node spawn-agent.js --title "..." --detail "..." [--stakes X]
if (require.main === module) {
  const args = process.argv.slice(2);
  const task = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const val = args[i + 1];
    if (flag === '--title') task.title = val;
    else if (flag === '--detail') task.detail = val;
    else if (flag === '--stakes') task.stakes = val;
    else if (flag === '--tier') task.tier = val;
  }
  const result = route(task);
  console.log(JSON.stringify(result, null, 2));
}
