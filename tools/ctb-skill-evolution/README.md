# CTB Skill Evolution

This is the autonomous layer missing from CTB's manual `breeder.js`. It learns
from durable task records, creates a skill only after a repeated capability gap,
and routes future matching `todo` cards through the existing `--skill-add` path.

## Decision policy

1. Cluster settled tasks within the same project by observable vocabulary.
2. Require at least three related outcomes and two gap signals, or five related
   successful tasks with at least four recorded proofs/acceptance definitions.
3. Reuse an existing skill when it covers the cluster.
4. Prefer a matching existing agent when successful outcomes show the roster can
   already do the work.
5. Otherwise create a validated `SKILL.md` whose provenance names every source
   task, register it in CTB, and route matching future tasks to it.
6. Record route outcomes. Five observed uses below 40% success quarantine future
   auto-routing; the artifact and audit remain recoverable.

Creation is bounded to two skills per sweep, four per rolling week, with a
six-hour persisted cooldown after a real creation. A first historical scan can
therefore surface candidates without flooding the registry.

The engine never changes `needs-human`, `blocked`, `claimed`, `doing`, or terminal
cards. It only attaches skills to clean `todo` cards through `vintask update`, so
the task lock, skill validation, and sealed-question laws remain authoritative.

## Install

```bash
bash tools/ctb-skill-evolution/install.sh
```

The installer copies the runtime under CTB's durable state directory, runs the
deterministic verifier, and idempotently installs one 20-minute cron entry. The
first live sweep runs on the next cadence; preview it without writes:

```bash
node ~/.claude/council-loop/state/skill-evolution/runtime/engine.js sweep --dry-run
```

State is in `state/skill-evolution/model.json`; the append-only decision trail is
`state/skill-evolution/audit.jsonl`; generated artifacts live under
`state/skill-evolution/generated-skills/<slug>/SKILL.md`.

## Rollback

Remove the tagged cron line and the runtime directory. Generated skills are
ordinary reversible registry entries; remove their `evolved-*` entries from
`state/skills.json` if they should no longer be manually selectable. Quarantining
already stops automatic routing without deleting any evidence.
