# JVQ8RQZ: routing corrections awaiting runtime integration

Status: **staged, not installed; task remains blocked**. The active runtime lives
in `/home/vinta/.claude/council-loop/{lib,bin}`, outside this session's writable
roots. No active router, driver, provider configuration, or model service was
changed. This package is reversible source work for the next authorized runtime
session, not evidence of a completed production rollout.

## Implemented here

- Priority-one, high/critical stakes, reasoning/security, and escalated work retain
  an L4 capability floor through lockouts, pins, and failover. If no eligible
  model exists, the planner holds the task instead of silently lowering quality.
- Both driver plan entry points respect an empty protected ladder, before legacy
  fallback. Agent dispatch respects the same hold.
- Same-tier model selection no longer treats a higher price as proof of higher
  capability. Existing per-model success and efficiency evidence still applies.
- Agent dispatch passes the complete task through a private temporary task file;
  acceptance, priority, escalation, pins, and checkpoints no longer disappear.
- Work-unit planning honors unit kind and scoped text. A reviewed, independent
  unit can use a cheaper model without inheriting the parent's model pin. Other
  units retain parent quality requirements.
- Step estimates use the existing per-million-token pricing calculation.
- `executeSteps(task, ctx)` executes bounded units, passes verified output to the
  next model, persists verified checkpoints and spend, and resumes remaining work.
  It requires host-provided `verifyStep` and durable `saveCheckpoint` functions.
  Tests use deterministic mock executors; no paid calls were made.

## Decisions

DECISION: protect important work through every failover rung; use cheaper models
for explicitly reviewed, independent units. ALT: silently lower capability when
frontier providers are unavailable. UNDO: revert the eventual runtime commit.

DECISION: switch models at verified work-unit boundaries. ALT: kill and replace a
worker during an arbitrary tool action. UNDO: keep the existing single-task
executor; the new API is additive and not yet called by the live driver.

## Verification

Run `bash task-artifacts/JVQ8RQZ/verify.sh` from this worktree. The tests isolate
configuration, provider probes, execution, and queue writes; they do not use live
credentials, call paid models, or mutate the live queue. Driver branch tests
execute the actual staged guard snippets with a fake queue command.

`runtime.patch` applies to the runtime files as observed during this task, which
already included other sessions' uncommitted changes. `manifest.json` records
their source and staged hashes. Preserve those existing changes; never replace
the runtime with an older checkout or apply this patch blindly.

## Remaining work — required before closing the card

1. In a session authorized to edit the runtime, reconcile concurrent changes and
   apply the patch after `git apply --check`. Commit router, adapter, and driver
   together. Coordinate driver restart at an idle boundary; active shell drivers
   retain their loaded code.
2. Wire the work-unit executor into the real driver lifecycle. Define durable
   storage under the task lease, explicit unit acceptance/verifier contracts,
   remaining budget enforcement, and authoritative parent-task completion.
   The current driver still calls the ordinary single-task executor. Adding an
   API alone does **not** satisfy the requested live multi-model orchestration.
3. Preserve full parent requirements in the host's unit prompts/artifacts. Enforce
   parent queue ownership outside the prompt, and prevent two workers resuming
   the same checkpoint. The executor API does not implement process leases or
   sandbox side effects.
4. Run an end-to-end fixture through the installed driver proving frontier
   planning → cheaper bounded execution → frontier review, failure recovery,
   and resume without repeating verified units. Verify measured total spend,
   not just a planner estimate. Budget checks currently operate at boundaries;
   the host must enforce a hard ceiling during execution.
5. Validate model quality metadata against maintained evaluations and actual lane
   availability. Existing catalog tiers are coarse; equal L4 labels are not proof
   that all models have equal ability. This patch does not invent a quality
   ranking or promise that model names, pricing, and availability stay correct
   forever. The Anthropic-only Agent-tool adapter still cannot execute a chosen
   non-Anthropic model directly; use a provider-capable host for mixed providers.

No business, spending, or public-posting decision is requested. The blocker is
runtime write access plus unfinished host integration, not a preference question.
