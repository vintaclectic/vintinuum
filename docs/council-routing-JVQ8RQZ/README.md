# JVQ8RQZ routing recovery artifacts

These are **prepared patches, not deployed changes**. The live council-loop checkout is outside this session's writable roots. No live files or routing state were changed by this harness.

Decisions:

- Honor a valid handoff ahead of preflight triage even when it leaves the tier unchanged or is refused by a safety rail. Invalid/absent handoffs still permit triage.
- Compute the previous agent's destination from its recorded source tier, normalize case, then prohibit a stale source from reversing direction relative to the current resolved tier. `stronger` cannot downgrade; `cheaper` cannot upgrade. Existing stakes, escalation, security and reasoning floors remain authoritative.
- Preserve `top_brain` as well as `force_min_tier` during provider lockouts. Capability-critical work defers when the available models cannot satisfy its resolved tier; ordinary work remains eligible for cheaper routing.
- Label delegation aliases as host-dependent preferences and require consulting actual tool model enums. When an equivalent supported-model mapping is unknown, inherit the current model and disclose that savings are unestablished.

Undo: reverse the respective patches after application (or revert their deployment commit).

## Verification

From this worktree:

```sh
timeout 30 node docs/council-routing-JVQ8RQZ/verify-routing.cjs
```

Observed: **69/69 checks passed**, including seven baseline negative controls that reproduce the original defects, all 40 source/current tier direction combinations, explicit and refused handoff precedence, invalid/absent handoff triage, case normalization, stakes/escalation/retry protections, lockout deferral and ordinary fallback, and host model guidance. Both patches passed `git apply --check`, and patched modules passed `node --check` in a disposable temporary fixture.

The harness copies current live modules read-only, applies patches only to the temporary copies, evaluates the actual relay module and extracted real router relay/lockout block, and deletes its temporary tree. It makes no model/network calls. It intentionally asserts the baseline defects, so after deployment use an unpatched source snapshot as its optional first argument to reproduce both sides. These scoped tests do not establish production routing end-to-end behavior or measured savings.

For a future session authorized to write the live checkout, run `git apply --check` with both absolute patch paths from that checkout, then apply them, run the router/driver verification suites, and verify a real relay before claiming deployed completion.

Files:

- `relay.js.patch`: handoff direction and provider-aware delegation guidance.
- `llm-router.js.patch`: handoff precedence and top-brain lockout protection.
- `verify-routing.cjs`: isolated baseline-versus-patched regressions.

Corpus: `corpus.patch` adds the missing `council_relay` exporter to the existing
nightly `sources-extra.js` run. It includes only allowlisted system telemetry,
labels predictions advisory and outcomes unverified, and excludes user/task text.
Run `timeout 30 node docs/council-routing-JVQ8RQZ/verify-corpus.js` (observed:
7/7 checks passed). Apply that patch from the API checkout, separately from the
two router patches, only in an authorized session. See `AUDIT.md` for baseline
driver failures and remaining live acceptance checks.
