# JVQ8RQZ routing recovery — 2026-11-02

Status: prepared patches, not deployed. The task remains incomplete until the
live council-loop is updated and exercised by its driver. This session may write
the assigned Vintinuum worktree, but not `/home/vinta/.claude/council-loop/lib`.
Approval escalation is disabled. Do not use a helper to bypass that boundary.

The old artifact directory in the card no longer exists. The original relay
implementation is present in the live router; these artifacts repair it rather
than replacing the existing classification, provider configuration, or learner.

## Decisions

- A valid handoff takes precedence over earlier triage even if its tier is
  unchanged. Relative handoffs retain the recorded source-tier destination but
  must not reverse direction against the current resolved tier.
- Reasoning `top_brain` floors survive provider lockouts, just as security floors
  do. Explicit high/critical stakes and escalated work also retain their tiers.
  Availability cannot establish that a cheaper model has sufficient quality.
- Delegation instructions must respect the executing tool's accepted model
  names. This host did not expose the requested haiku/sonnet/fable/opus aliases;
  collaborators inherited its model. No cross-model cost saving was measured.
- Export only allowlisted system telemetry into the corpus. Triage advice is
  explicitly advisory, with task outcomes unverified. Retain cloud triage until
  local quality is measured; this change does not invent local quality scores.

All changes are reversible by reversing the patches. No model catalog, prices,
or provider credentials were changed.

## Baseline observations

`timeout 60 node /home/vinta/.claude/council-loop/test/test-driver-integration.js`
returned **27 passed, 5 failed** before patch application:

- One assertion expects literal `plan --taskfile`; the driver now calls
  `plan --agentic --triage --cwd ... --taskfile`.
- Three assertions slice the failover section at the first occurrence of
  `CREDIT-OUTAGE GUARD`, which is a comment before the failover watcher.
  Inspection shows the watcher at lines 2035–2082 includes kill, cancellation,
  and budget checks. This inspection is not an execution test of those stops.
- The explicit `openai/codex` pin assertion fails in the current environment.
  Its cause is unresolved; do not claim the full driver suite is green.

The existing nightly corpus runner calls `corpus/sources-extra.js` and iterates
all `SOURCES`; the corpus patch adds its missing `council_relay` source. Its
fixture runs the real consent/PII gate and makes no live shard writes.

## Remaining acceptance work

Apply the patches from a session authorized to write the live source roots,
run the targeted checks against that revision, resolve the driver-suite failures,
and verify actual checkpoint → next claim → routed continuation behavior. Then
observe provider choice, preserved quality floors, token counts and actual costs
on representative important and mechanical tasks. Synthetic passing tests alone
do not prove live mid-flight switching or permanent optimal model selection.

The board recovery sweep also reopened 9J6NW9W, whose only blocker was a
turn-schema reporting failure. No completion was asserted for that task.
