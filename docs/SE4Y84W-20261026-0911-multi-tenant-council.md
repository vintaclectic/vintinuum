# Multi-tenant council: isolation before onboarding

Design for SE4Y84W, 2026-10-26. Owner: **vintinuum**. Status: independently reviewed design; no production migration or external onboarding is authorized by this document. Scope: users bring provider credentials, agents and skills; they receive isolated routing, tasks and accounting. Pricing, public distribution of Vinta's agents, and selling a hosted service remain separate product decisions.

## Decisions and boundaries

**DECISION:** make a tenant an isolated personal workspace, initially one owner, rather than add a user filter to the existing global board. Authenticated users have membership in a tenant; membership is explicit even while it is one-to-one. This leaves room for teams without conflating a login, workspace, task owner and worker seat. Tenant IDs are opaque server-generated IDs, never paths or agent names.

**DECISION:** use a shared authenticated control plane with separate tenant state and isolated worker processes. Retain JSONL tasks with a per-tenant lock in the first release; use a per-tenant SQLite accounting/audit store for transactional reservations. A future shared database must preserve the same repository interfaces and compound tenant keys. Alternative: immediately migrate all boards to a shared relational database. Rejected because it enlarges migration risk before proving the boundary. Undo: retain the adapters and swap storage behind them.

**DECISION:** tenant credentials are never resolved from host environment or operator CLI login in multi-tenant mode. Missing credentials, missing context and unavailable isolation deny execution. No automatic fallback to Vinta, a default tenant, a different user's OAuth session, or an implicitly free local worker. Undo: disable multi-tenant admission; do not weaken the boundary.

This is not a claim that separate directories protect mutually untrusted users. Shell-capable imported agents must execute under separate OS identities or equivalent container isolation, with no host home, host process environment, Docker socket, sibling workspace or vault mounts. The control plane and credential broker are trusted computing base; a host administrator/root can still access data. Protection from the hosting operator is out of scope. A same-UID directory-only deployment is local compatibility mode, not a hosted multi-user launch.

## Observed integration points

Inspected local source on 2026-10-26; these observations describe the current single-owner implementation, not desired behavior. Paths below are relative to `/home/vinta/.claude/council-loop/` unless absolute.

| Surface | Current behavior observed | Required change |
| --- | --- | --- |
| `bin/vintkey.js` | `API_DIR` loads `/home/vinta/vintinuum-api/seed-vault.js`; one `config/cred-policy.json`; `AGENT_ID`/`VINTASK_ID` come from environment. `gate()`, `checkPolicy()` and `capabilityVerdict()` provide policy checks. `writeAudit()` uses a shared DB/spool and permits access when both audit paths fail. | Explicit verified tenant context, scoped vault/policy/capabilities and audit records; durable audit before credential release. Agent environment identity is not authentication. |
| `/home/vinta/vintinuum-api/seed-vault.js` | Module-level `KEYS_DIR`, `VAULT_FILE`, `KEY_FILE`; AES-256-GCM; key adjacent to ciphertext. `_load()` returns `{}` on any error; `_save()` writes the file directly. | Vault factory bound to authorized tenant; separate key custody, typed corruption errors, locking and atomic writes. Never interpret corrupt ciphertext as an empty writable vault. |
| `bin/vintask.js` | `ROOT` uses host `HOME`; `STATE` optionally trusts `VINTASK_STATE`; single `tasks.jsonl`, `.tasks.lock`, backups. Queue writes use atomic rename. | Trusted tenant storage resolver, tenant-bound repository and separate locks/backups. Preserve atomic writes and terminal/sealed-question guards. Env path override is a verifier convenience, not authorization. |
| `lib/llm-router.js` | `loadCouncilEnv()` imports host `.env`; `credentialFor()` reads env and accepts `oauth-or-env` without an env key. `authModesFor()` uses host CLI homes; `runRung()` inherits process env. | Tenant credential broker and isolated CLI homes; fail closed when a tenant has no credential; explicit allowlisted subprocess env. |
| `lib/llm-router.js` | `SPEND_PATH`, `HEALTH_PATH`, `HISTORY_PATH`, board settings, affinity and pricing paths are process/global paths. `recordSpend()`, `spendReport()`, `ceilingCheck()`, `recordOutcome()` and `recordRoute()` use this state. | Tenant state handles and transactional accounting. Scope credential health, lockouts, history, budget and learned affinity to tenant/account. |
| `lib/spawn-agent.js` | `route()`/`agentOpts()` adapt router choices; errors and unsupported provider choices can fall back to an Anthropic tier. | Propagate signed task context through dispatch and re-authorize every fallback. Never bypass tenant provider consent/budget with a model alias. |

Also inventory **all** board/API handlers, driver subprocesses, journal writers, artifact/document readers, local model endpoints, capability files, lockout helpers and backup jobs before enabling a second tenant. These have not been exhaustively audited in this design task. The implementation discovery packet below must map their actual entry points; no global singleton is presumed safe merely because it is absent from this table.

## Identity and request flow

1. Use an established OIDC identity provider through a maintained server library; map validated issuer + subject to internal `user_id`. Validate issuer, audience, signature, expiry, state and nonce. Web sessions use short-lived secure HttpOnly cookies, CSRF defenses for mutations, and session revocation. Local development uses explicit test identities in a test-only adapter; never accept them on the hosted listener.
2. Resolve selected `tenant_id` against server-side membership. The selector is not authority. Owner can manage membership/credentials/import approvals; operator can stop workers and inspect redacted health; ordinary worker can access only its assigned task and granted tools. Avoid an implicit operator ability to use tenant keys. Operator support access, if later needed, requires an audited, temporary grant.
3. The control plane creates an immutable `TenantContext {tenantId, actorId, roles, requestId, authEpoch}`. Repositories, vault handles and router instances require it; constructors reject absence. `project` is a namespace inside a tenant, not an isolation key. Route bodies cannot supply trusted roles, storage roots or vault handles.
4. A dispatch job contains tenant, task, run, attempt, immutable agent package digest, policy revision, expiry, audience and unique job ID. Sign it in the scheduler; workers verify signature/audience/expiry and acquire an atomic lease. Validate ownership again on every task mutation and credential issuance. Bind child-agent calls to the same tenant; no child can expand permissions. Reject replayed/expired jobs and revoked memberships. Do not let an imported prompt forge context via environment variables.
5. `vintask --tenant` may select an authorized workspace through the local authenticated client. It cannot manufacture authority. The legacy single-user adapter requires explicit operator-only configuration and a fixed legacy tenant; missing context in hosted mode is an error. Tests get an injected temporary storage adapter, not production path overrides.

Return consistent not-found responses for inaccessible task/package/artifact IDs; do not reveal whether another tenant has a secret, task or agent name. Scope search, exports, websockets/SSE, notifications, caches, download URLs, logs and journal reads as well as ordinary CRUD. The current shared Work Journal Sheet exports and local-model training corpus must not ingest another tenant's content; disable those sinks by default for new tenants. Separate explicit tenant consent and a scoped destination are required before any export or training use. Tenant-scope `lib/skills.js` `discoverSkills()` so discovery cannot traverse host skill/command/plugin registries. Signed artifact URLs bind tenant, object, audience and expiry; a filesystem path is never a user-facing authorization token.

## Credential isolation and worker execution

Proposed trusted layout (paths resolved only by the control plane):

```text
<state-root>/tenants/<opaque-tenant-id>/
  tasks/tasks.jsonl       tasks/.tasks.lock       tasks/backups/
  policy/                router/                 imports/
  audit-accounting.db    artifacts/              journals/
<worker-root>/<tenant-id>/<run-id>/              # isolated worker mount
<secret-store>/                                         # broker only
```

A broker-only random data encryption key per tenant encrypts credential values using authenticated encryption with tenant ID, credential ID and version in associated data. Wrap data keys with an OS/secret-manager key outside tenant exports and worker mounts; retain key versions for rotation/restore. The deployment key backend is an adapter: use an existing available key service or protected local broker key for development, without buying a service in this task. Back up wrapped keys/ciphertext securely and test restoring both; ciphertext alone is not a recoverable backup.

`vintkey` becomes a scoped broker client. Keep logical commands `list/has/get/set/rm/exec`, but authorization applies before lookup, including metadata. `get` plaintext output is disabled for ordinary workers; owners can explicitly retrieve their own secrets through an authenticated administrative path. `exec` injects only explicitly granted tenant credentials into a short-lived process. Prefer the broker making provider HTTP requests so agents never receive raw API keys. If a CLI requires credentials, its compromise can expose those granted credentials: acknowledge this limit, use short-lived/restricted tokens where possible, and never mount the whole vault.

Credential grants bind tenant + run + agent digest + provider/account + purpose + expiry. Credential rotation changes a version; running jobs either finish under a bounded grant or terminate according to explicit revocation policy. Required audit metadata (tenant, actor, run/task, credential identifier, operation, decision, timestamp; never value) must be durably written to tenant DB or scoped spool before issuance. If neither can persist, deny access. Spool replay is idempotent.

In the router replace ambient lookup with `credentialFor(context, provider)` returning an opaque grant, not a host environment variable name. Supply it explicitly to `callHTTP()` and auxiliary calls such as `askJev()`. Each CLI auth lane is installed under the authenticated tenant's isolated home; binary presence is not evidence that the tenant is logged in. Provider fallback rechecks grant, model/tool permission, budget and capacity. Caches must include tenant + provider account + credential version where relevant.

Workers get a minimal allowlisted environment, tenant-only working directory and bounded CPU/memory/runtime/disk/network. Deny link/path escapes, host home mounts, host process inspection and unrestricted loopback/metadata access. Approved provider egress goes through fixed configured endpoints; tenant-configured endpoints cannot reach internal services by default. Validate DNS targets against private/loopback/link-local ranges at connection time, pin approved destinations, and disable redirects or revalidate every hop without forwarding credentials across origins. Auxiliary inference helpers such as `askJev()` must use the same tenant credential and budget wrapper as ordinary execution. The same rules cover imported scripts and local-model calls. A shared local service needs an authenticated tenant gateway with request/data isolation and quotas; otherwise remove it from that tenant's ladder. No worker starts before its sandbox passes the isolation checks.

## Per-user tasks and accounting

All task records gain `tenant_id`, `created_by`, `assigned_agent_ref` (tenant-local package ID + immutable digest), `run_id` and schema version. Preserve current task IDs inside the legacy tenant; external identity is `(tenant_id, task_id)`. Claims, dependency links, sprout/epic operations, terminal proof, sealed answers, attachments and recovery transitions use the same tenant repository. Cross-tenant dependencies and claims are rejected, even when IDs match. A worker seat is execution capacity, not ownership or authentication. Queue scheduling applies per-tenant concurrency/fairness so one customer cannot monopolize workers.

Use a per-tenant transactional ledger with `usage_events` and `budget_reservations`; deduplicate events by `(tenant_id, run_id, attempt_id, provider_request_id, event_kind)`, with stable local attempt IDs when providers supply none. Record provider/account, model, input/output/cache tokens, price-version snapshot, currency, estimate/actual status, timestamps and task/agent IDs. Store no prompts or secrets in accounting. Retries and failed attempts that consume tokens still cost money. CLI subscriptions have unknown or allocated marginal costs: represent `unknown` distinctly from zero and never claim invoice precision.

Before each paid attempt, reserve a bounded estimate atomically against tenant budget and concurrency. Include pending reservations in ceiling checks. Set token/runtime limits where supported; if cost cannot be bounded, require tenant policy permitting that billing mode or deny it. Reconcile actual usage, release unused reservations and retain an explicit unknown liability when a process dies before reporting. A reconciler resolves abandoned attempts using provider evidence or a conservative estimate; it must not release them blindly. Reservation/event IDs make retries idempotent. Per-task/provider/day/month reports read only the authorized tenant ledger; owner-set ceilings are enforcement, not merely charts. A reservation is not a promise of an exact provider invoice maximum.

Global operational metrics may count anonymous totals but contain no tenant prompts, agent text, credentials or identifiable routing history. Static model descriptions and prices can be shared read-only; learned routing statistics remain tenant-local unless separately opted in. Account throttling/lockouts cannot let tenant A mark tenant B's credential unavailable. A verified provider-wide outage may be shared as a non-sensitive infrastructure signal with bounded expiry.

## Agent and skill import contract, version 1

A `.council-pack` is a bounded ZIP archive with `manifest.json` and declared regular UTF-8 text files. Version 1 supports Markdown agent definitions, `SKILL.md` skills and text resources only; no install hooks, executables, remote dependency fetches or embedded credentials. Script-bearing existing skills receive a clear unsupported-content error and can later use a separately reviewed capability extension. Merely importing Markdown does not make its instructions trusted.

Illustrative manifest (digest must be the actual SHA-256 of the listed file; the repeated character is a placeholder for this example only):

```json
{
  "schemaVersion": 1,
  "package": {"name": "research-council", "version": "1.0.0"},
  "agents": [{
    "id": "researcher",
    "entry": "agents/researcher.md",
    "skills": ["source-notes"],
    "modelPreference": {"tier": "L3"},
    "requestedCapabilities": ["workspace.read"]
  }],
  "skills": [{"id": "source-notes", "entry": "skills/source-notes/SKILL.md"}],
  "files": [{"path": "agents/researcher.md", "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},
            {"path": "skills/source-notes/SKILL.md", "sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}],
  "origin": {"kind": "user", "license": "LicenseRef-Private"}
}
```

The server supplies tenant ownership, package ID, import timestamp, content digest and approval state; the archive cannot supply authoritative owner, tenant, permissions or credentials. `modelPreference` is a hint constrained by tenant/provider policy. Skills are referenced by package-local IDs; version 1 has no transitive remote dependencies. Parse JSON with duplicate-key detection before schema validation; ordinary JSON.parse silently overwrites duplicate keys. Then JSON Schema and semantic validation reject unknown fields, duplicate IDs and unsupported versions. Agent frontmatter is parsed safely with no executable tags; prohibited authority/tool settings are rejected rather than silently honored.

Initial configurable limits: 2 MiB compressed, 8 MiB expanded, 100 entries, 256 KiB per text file, maximum nesting 8. Count bytes during streaming decompression; do not trust ZIP headers. Reject absolute paths, `..`, backslashes, control characters, drive prefixes, duplicate/case-colliding paths, symlinks/hardlinks, encrypted entries, undeclared files and paths outside the staging root. Check actual file digests before validation completes; digest integrity is not proof of author trust. Stage with restrictive modes, never extract into active agent directories, and clean failed staging areas.

Flow: upload → validate/quarantine → show file list, requested permissions and warnings → owner approves grants → atomically activate immutable version → tenant-scoped lookup. Import defaults to disabled; no capability is granted by prose or a signature. Updates create a new version, show a diff and require approval for new grants; in-flight tasks pin their old digest. Rollback switches the active reference and preserves previous versions and audit trail. Tenant deletion/export policy covers imported content separately from secrets.

Users can import their own definitions immediately within this contract. For optional starting agents, build an **allowlisted, sanitized snapshot**, not a live read of `~/.claude/agents`. Remove personal journals, private task references, absolute home paths, credentials, identity claims and private instructions; include provenance/license and a diffable base digest. Automated scanning plus human content review is required before public distribution. A private test fixture is enough for implementation acceptance; this task does not authorize publishing Vinta's identity or agent corpus. Forks become tenant-owned copies and never inherit Vinta's tools, vault access or privileges. Updates are opt-in diffs, never silent replacement.

## Phased implementation packets

Each row is a separate concrete task, scoped to reversible implementation and verification. No packet authorizes public publication, new subscriptions or production credential revocation. Queue records should reference this document and their predecessor task IDs. The current CLI does not enforce a dependency field: every packet must check predecessor completion before implementation, and leave global tenant admission off until P9; prose dependencies alone are not an execution gate.

| Packet / owner | Dependency | Deliverable and acceptance |
| --- | --- | --- |
| P1 — `vintinuum`: inventory and tenant repository contract | none | Map actual API/board/driver/journal/import/backup entry points and global state consumers; implement injected tenant storage/context interfaces with fixtures only. Every identified reader/writer has an owner and migration route; missing-context and cross-tenant repository tests deny access. |
| P2 — `helios-sec10`: authenticated context and isolated runner | P1 | OIDC/session adapter, membership checks, signed job leases and sandbox launcher. Two tenants cannot spoof context, replay jobs, read sibling/host files, inherit host env/auth or reach internal metadata; session revocation and subprocess descendants are covered. Hosted admission remains off. |
| P3 — `helios-sec10`: per-tenant credential broker | P1, P2 | Tenant vault factory/key custody, scoped capability/policy grants, durable audit, isolated CLI credential lanes. Cross-tenant list/get/exec denied; corrupt vault refuses writes; concurrent updates retained; missing key/audit denies issuance; encrypted backup restore passes. |
| P4 — `helios-fusion`: tenant task boards and journals | P1, P2 | Scope queue/API reads+writes, claims, dependencies, attachments, SSE/search/export, backups and Work Journal. Identical task IDs in two tenants remain isolated; claim race has one winner; existing proof/seal tests pass in each tenant; attachment/path escapes denied. |
| P5 — `helios-sec10`: router credentials and transactional costs | P2, P3, P4 | Route every HTTP/CLI/child/local fallback with verified context; scope health/history/settings; reserve/reconcile budgets. No tenant key yields no host fallback; two concurrent attempts cannot overspend admitted reservations; duplicate events/restarts/retries preserve totals; unknown usage stays unknown. |
| P6 — `helios-sec10`: package validation and activation | P1, P2, P3 | Implement versioned manifest/text archive validation, quarantine, permission approval, tenant registry and immutable digest pinning. Traversal, ZIP bombs, symlinks, prompt-injected tool authority and cross-tenant collision fixtures rejected; supported own-agent+skill import activates and rolls back. |
| P7 — `vintinuum`: optional base-agent preparation | P6 | Generate private sanitized allowlisted template fixtures with provenance/license, scan report and review checklist; fork/update diff preserves tenant edits. No live journals/credentials/paths or elevated grants survive. Public publication is outside this packet. |
| P8 — `helios-fusion`: owner onboarding and tenant controls | P3, P4, P5, P6 | Owner connects own provider, imports own package, approves least privilege, creates task and sees only own tasks/costs. Test two accounts end-to-end plus 320/375/768/1280/1920 px with long labels and error/empty/loading states; no collisions. Use mocked providers for routine checks. |
| P9 — `helios-sec10`: legacy migration and launch gate | P3–P8 | Implement dry-run/backup/cutover/rollback tooling; run isolated copy of Vinta's legacy data into explicit legacy tenant. Count/hash non-secret records, preserve seals/proofs/IDs, reconcile ledger, restore snapshot, and pass adversarial suite below before enabling another tenant. No real-data destructive cutover required to finish this packet. |

## Migration, rollout and rollback

1. Inventory all data and auth lanes; record schema versions and counts without printing secrets. Make encrypted verified backups of queue, attachments, policy, journal, vault/key material and ledgers. Unknown legacy event ownership maps only to explicit legacy tenant, never a new customer. Preserve original event IDs and import provenance; mark unpriceable historical events unknown.
2. Dry-run migration into a separate tenant root. Preserve task IDs, statuses, unanswered seals, proofs, dependencies and agent references. Copy only operator-selected legacy auth material through the broker; do not repurpose host OAuth directories for new users. Compare records, attachment hashes and accounting totals, and test a restore before cutover.
3. Shadow reads may compare old and new outputs; avoid dual writes. For cutover, pause dispatch, drain or explicitly cancel active leases, acquire migration lock and snapshot final state. Migrate once with a recorded migration ID; atomically switch the legacy adapter to the new root. Validate before resuming. Migration retry is idempotent.
4. Begin with synthetic tenants and mock provider credentials, then an explicitly authorized private pilot. Keep new-tenant admission disabled until P9 passes. Existing single-owner operation remains available throughout design/build.
5. Pre-cutover rollback discards staging. After cutover, pause dispatch and use an inverse export/replay preserving all new events before switching back; never restore a stale snapshot over accepted task or spend changes. If reverse export cannot represent new fields, keep storage forward and roll back application code via a compatible adapter instead. Disable new admission while investigating. Never roll a live multi-user instance back to ambient host credential fallback.

## Review and release verification

This document requires an independent review against the four acceptance areas (credential isolation, task/cost isolation, import format, queued phases). The reviewer records actual findings and fixes in the task proof; this section is not a claim that code or security tests already passed.

Implementation gates use tenants A/B with intentionally matching task, agent and credential names, plus a privileged host canary secret. Prove: forged IDs/membership/headers/env are rejected; direct and nested dispatch cannot escape tenant; A cannot enumerate/read/mutate B through list/search/export/SSE/artifact/log/backup/credential routes; host canary never appears in child environment, filesystem or provider request; auth/broker/audit outages fail closed; corrupt vault cannot be overwritten; concurrent queue/vault writes retain data; double reservation and duplicate usage events do not undercount; abandoned paid attempts retain liability; A lockouts/history do not affect B; package traversal/bombs/unapproved capabilities cannot execute; legacy seals and completion proofs survive migration; rollback retains post-cutover accepted work.

Evidence must name commands and observed results, using synthetic secrets and mocked requests. A document review proves design coverage only. It does not prove implemented tenant isolation, a production migration or readiness to accept external users.

## Delivery and review record

This task delivers a design and queued implementation work only. No multi-user runtime is implemented or enabled by this document.

The foreman checked the existing source alongside the designer and independent security reviewer:

- `bin/vintkey.js` loads the shared API seed vault and global credential policy, takes agent/task identity from environment, and permits access when audit cannot persist. The multi-user replacement must verify worker identity and isolate both secret storage and audit.
- `bin/vintask.js` supports `VINTASK_STATE` but that override is a filesystem location, not authorization. Its current CLI has parent/child linkage but no enforced dependency scheduler. Implementation tasks therefore state prerequisites explicitly and require entry checks.
- `lib/llm-router.js` loads host `.env`, resolves environment/OAuth credentials, and uses shared spend/history paths. Isolating board records alone cannot isolate provider access or budgets.
- `lib/skills.js` discovers host skills, commands, and installed plugins. Tenant import must replace implicit global discovery with a scoped registry.
- `worklog.js` writes global `work_log` rows and a shared spool destined for Google Sheets and training. Those destinations need explicit tenant isolation and export grants.

Delivery check: `timeout 35 bash scripts/vint-health.sh` reported three critical failures: localhost:8767 unavailable, public API DNS unavailable, and systemd keepalive inactive from this environment. Its surgery check printed success despite a failed curl because its pipeline lacks pipefail; that line is not evidence of health. This design-only change does not attempt service repair. Push is held under repository health policy; the document is committed locally and attached to the queue for review.

Runtime/model disclosure: specialist identities were assigned to the available delegated agents; an Opus override was unavailable in this runtime. No Opus execution is claimed.

Independent reviewer **helios-sec10** inspected the draft and found all four design acceptance areas covered, with no blocking architecture omissions. Review caught one parsing accuracy issue: duplicate JSON keys must be rejected before schema validation. That correction is included above. This is design approval, not a runtime security certification.

## Queued implementation records

All nine records were created as linked follow-ups of SE4Y84W, with named specialists, nonempty detail and literal acceptance criteria. The design task is complete independently of their future implementation.

| Packet | Queue ID | Prerequisite IDs |
| --- | --- | --- |
| P1 | BQXS5WM | none |
| P2 | 59GUN29 | BQXS5WM |
| P3 | RH826AE | BQXS5WM, 59GUN29 |
| P4 | PRZVGJR | BQXS5WM, 59GUN29 |
| P5 | 59SFGPY | 59GUN29, RH826AE, PRZVGJR |
| P6 | FSFB54X | BQXS5WM, 59GUN29, RH826AE |
| P7 | 3KFZA47 | FSFB54X |
| P8 | 3CUERP2 | RH826AE, PRZVGJR, 59SFGPY, FSFB54X |
| P9 | BKBPG64 | RH826AE, PRZVGJR, 59SFGPY, FSFB54X, 3KFZA47, 3CUERP2 |
