# HFUG89N shared queue audit

The requested failover is not complete. Do not enable the replicated-local-lease implementation.

## Observations

- Regression `node scripts/verify-council-partition-HFUG89N.cjs`: 8/8 diagnostic checks reproduce two claims for one task in a minimal local-lock model using the original lease module. `--control`: 4/8, exit 1, one claim. These are vulnerability diagnostics, not feature acceptance.
- Existing `verify-machine-lease-HFUG89N.js` passes 15/15 locally. It models ordered copies; its restart checks reread files rather than restart an authoritative service.
- `machine-lease.js` permits a primary unconditionally and permits a standby when its local copy expires. During a partition both can claim. A copied epoch cannot arbitrate between isolated writers.
- `council-store-sync.sh` treats primary as active writer before considering hand-back, so automatic primary recovery can overwrite VPS progress.
- SSH to `ctb-vps` succeeds; hostname is `ubuntu-4gb-fsn1-1`. The VPS has vintask.js and machine-lease.js, but no state/tasks.jsonl or state/machine-lease.json.
- This assigned git checkout is the Vintinuum site. The actual Council source is `/home/vinta/.claude/council-loop`, outside the session writable roots except for its state directory. Live source changes cannot be applied here under the active permissions.

## Decision and implementation handoff

DECISION: reject replicated local leases as cross-machine arbitration. Use one authoritative queue service on the existing VPS, backed by durable transactions, and make PC/VPS clients fail closed when it is unreachable. This is a technical implementation choice, not a new paid service or board/trading transfer. ALT: copied JSON leases; rejected because a network partition allows two independent writers. UNDO: revert the eventual implementation; this audit changes no production configuration.

Implement in a writable checkout of the Council repository. Preserve the current task schema and CLI interface. Route every queue mutation through authenticated authoritative transactions, including claims, heartbeats, completion, cancellation, and board edits. Fence stale claim holders with server-issued generations. Preserve PC priority with server-observed activity; idle heartbeats must not suppress standby work indefinitely. Never automatically reclaim an expired running task without addressing stale-worker side effects.

Migration must back up and freeze local writes, import once, switch clients atomically, and prevent an old local CLI from continuing to claim. The board process and all trading processes stay on the PC. Do not copy production trading credentials or change DNS.

Verify real PC/VPS test-card completion, competing claims, dropped connections, process restarts, durable acknowledged writes, stale completion rejection, and primary return without lost VPS results. Require a negative control that exits nonzero when arbitration is disabled. No UI changed, so collision checks do not apply. Auth-lane/credit fallback skills do not apply; no provider credentials or fallback logic changed. Prior-log recovery and pass-count/negative-control guidance were useful, but the old 15/15 alone does not establish acceptance.
