# BJDSVWE: measured transport prerequisite, not production isolation

The live mind is still in `/home/vinta/vintinuum-api/world/world-citizens.js`.
No scheduler, backend route, PM2 configuration or live process uses this module.
Do not close BJDSVWE on this harness: it proves the jail/bridge boundary using a
fixture worker, not migration of the citizen turn loop.

Run `timeout 25 node bin/world-worker/verify.cjs`. Negative control:
`timeout 25 node bin/world-worker/verify.cjs --no-jail` must exit 1 at the direct
socket assertion (`connected`), with exactly the same third endpoint reachable
in the positive outside-namespace control. The normal run prints the two actual
allowlisted host:ports. All upstream servers in this test are ephemeral fixtures;
no model charge, production write or credential is involved.

`transport.cjs` creates a per-citizen Unix HTTP broker and launches a single-file
worker inside bubblewrap user/PID/network/mount namespaces. The new network
namespace has no external network interfaces. The only host socket mounted is
that citizen's broker. The broker permits exactly:

- GET `/api/agent/<assigned-id>/observation` on the configured world origin.
- POST `/api/agent/<assigned-id>/actions` on that world origin.
- POST `/model/generate`, translated to `/api/generate` on the model origin.

The host broker holds any model authorization header; it never puts it in the
worker environment or prompt. Request headers are not forwarded. Paths, methods,
origin credentials, redirects, CONNECT and upgrades are restricted. One request
may be active per broker, with a four-connection server limit, bounded bodies and
an absolute request deadline. The worker has only its script, system runtime,
private `/tmp`, proc/dev and the broker socket; it cannot read the host home/DB.
The launcher has its own hard lifetime bound. Production integration must account
for HTTP 429/504 as failed attempts, not successful actions.

## Remaining integration work

1. Move **all citizen policy**, not only `_defaultModelFn`, behind the external
   observation/action contract. Current source directly requires DB at line 117,
   calls `buildObservation` at 686 and `applyActions` at 710, 1079, 1218, 1365,
   1485, 1685, 2041 and 2085. `runCitizenTick` at 2392 loops policy and diaries
   in the brain process. These line numbers describe the source read on
   2026-11-14 and may shift.
2. Inventory needed bounded observation fields for market/hire/civic/fiscal/
   sovereign/scribe/kinship intents. They currently read domain modules or SQL.
   Preserve existing visibility rules while expressing needed data through
   `world-observation`; do not mount DB files or expose a generic SQL proxy.
3. Retain world mutation and validation in `applyActions`. Diary, feedback,
   signature and last-acted bookkeeping need an explicit server-owned lifecycle;
   the worker must not gain a second writer or a general-purpose admin endpoint.
4. Integrate a bounded scheduler queue without overlapping turns, replaying
   actions after ambiguous HTTP failures or blocking the world's clock. The
   existing actions route is not an idempotency guarantee. Measure tick sequence
   continuity and worker timeout/crash behavior against the actual integrated
   runtime before claiming no skipped/stalled ticks.
5. Re-run Underweb JWN3HRG baseline (latest observed by parent: 293/293), policy
   regression fixtures, credential-canary and real integrated network controls.
   Deploy only after the concurrent production incident investigation finishes.

Decision: land this reversible, inactive prerequisite as a checkpoint. An
out-of-process model call alone would leave the citizen policy in-process and
does not satisfy the combined task. Undo by reverting the prerequisite commit.
