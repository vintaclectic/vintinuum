# Multi-Step Routing (DHUKV9E)

## Overview

Multi-step routing allows tasks to break their work into steps, where each step can be routed to the **cheapest model that can handle it**, instead of using a single expensive model for the entire task.

**Example Problem (Before):**
- Task: "Lookup reference + analyze + format output"
- Old behavior: Route entire task to Claude Opus 5 ($15/Mtok)
- Cost: High, even though lookup and formatting are simple

**Example Solution (After):**
- Step 1 (lookup): Route to Claude Sonnet ($3/Mtok) — L1 tier
- Step 2 (analyze): Route to Claude Opus 5 ($15/Mtok) — L3 tier
- Step 3 (format): Route to Claude Sonnet ($3/Mtok) — L2 tier
- Cost: Much lower, right-brain-for-task principle enforced

## Usage

### Define Steps in a Task

Add a `steps` array to a task object:

```json
{
  "title": "Multi-step analysis",
  "detail": "Look up reference, analyze findings, write report",
  "steps": [
    { "name": "lookup", "kind": "bulk", "tier": "L1" },
    { "name": "analyze", "kind": "reasoning", "tier": "L3" },
    { "name": "write", "kind": "ui", "tier": "L2" }
  ]
}
```

### Field Reference

**Step fields:**
- `name` (required): Human-readable step identifier (e.g., "lookup", "analyze")
- `kind` (optional): Task affinity kind (bulk, code, ui, reasoning, security, general, etc.)
  - If omitted, the router classifies the step from its context
- `tier` (optional): Explicit tier for this step (L0, L1, L2, L3, L4)
  - If omitted, the router determines tier from affinity kind

### CLI Testing

Use the `plan-steps` command to preview multi-step routing:

```bash
node llm-router.js plan-steps \
  --title "Analysis task" \
  --steps '[{"name":"lookup","kind":"bulk","tier":"L1"},{"name":"analyze","kind":"reasoning","tier":"L3"}]'
```

Output shows each step's selected model and estimated cost.

### JSON Output

For programmatic use, request JSON:

```bash
node llm-router.js plan-steps \
  --title "Task" \
  --steps '[...]' \
  --json
```

Returns:

```json
{
  "kind": "multi-step",
  "steps": [
    {
      "name": "lookup",
      "kind": "bulk",
      "tier": "L1",
      "plan": { ... },
      "cost_estimate": 36
    },
    { ... }
  ],
  "total_cost_estimate": 252
}
```

## Router Behavior

When `task.steps` is defined:

1. **Independent routing per step** — Each step is routed separately using `route(stepTask, opts)`
2. **Step overrides** — `kind` and `tier` fields override task-level equivalents for that step
3. **Cost estimation** — Each step's estimated cost is calculated (first rung only)
4. **Ladder preservation** — Full failover ladder is available per step, not just the top rung

When `task.steps` is NOT defined:

- Falls back to traditional single-task routing
- Backward compatible — existing code unchanged

## Cost Savings Example

A task with three steps, estimated tokens per step:

```
lookup (5K in, 1K out):   $0.05
analyze (10K in, 5K out): $0.15  
write (10K in, 10K out):  $0.10
```

**With multi-step routing:**
- Lookup → Sonnet L1:     $0.005
- Analyze → Opus 5 L3:    $0.15
- Write → Sonnet L2:      $0.01
- **Total: ~$0.17** (vs ~$0.30 if all steps used Opus 5)

## Implementation Details

- **Function:** `routeSteps(task, opts)` in `lib/llm-router.js`
- **Exported:** Yes, available to council agents
- **Backward compatible:** Yes, single-task routing unchanged
- **Cost tracking:** Per-step cost estimates available in output
- **Ladder building:** Each step gets full failover ladder per affinity/tier

## Future Enhancements

1. **Step dependencies** — Mark steps as blocking/parallel
2. **Context passing** — Share outputs between steps
3. **Dynamic step routing** — Adjust tier based on prior step success
4. **Batch optimization** — Route similar steps together
