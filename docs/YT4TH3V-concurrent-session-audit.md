# YT4TH3V — The Concurrent Sessions, Figured Out One By One

Date: 2026-08-25 · Seat: seat-9 · Agent: helios-sec10

## What "17 concurrent sessions" actually is

Enumerated live, not guessed:

| # | Kind | Count | Tokens burned | Verdict |
|---|---|---|---|---|
| 1-12 | `council-driver.sh` seat drivers (tmux `council` panes 0-11) | 12 | **0 while idle** | **KEEP** |
| 13-14 | Interactive `claude --agent vintinuum` on `pts/0` + `pts/2`, 5.8 days old | 2 | 0 while idle (670MB RSS) | **VINTA'S — left alone** |
| 15 | The failover child of seat-9 running this very task | 1 | live | transient |
| 16-17 | Shell/probe processes counted by a bare `pgrep claude` | 2 | 0 | not sessions |

**Total: 17.** The number was real. What it was *not* is 17 unfinished units of
work — the task queue holds **0 runnable / 0 needs-real-answer** cards.

## The prior audit was wrong on both cause and cure

The earlier pass concluded "drain the fleet to zero seats" (`fleet scale 0`).
That would have destroyed all council capacity while fixing **nothing**, because
idle seats are free. Proven from the seat logs:

```
seat-11: claimed=2 tasks   idle_beats=476
seat-5:  claimed=25 tasks  idle_beats=623
```

An idle driver runs `sleep 15` and re-checks — it never invokes `claude`. The
driver comment says it outright: *"idles cheaply (no tokens burned while
waiting)"*. Seat count was never the exhaustion source.

*(It also reported a read-only-state sandbox blocker. Not reproducible here —
this seat wrote task state, the repo and this file without issue.)*

## The actual cause: nothing enforces a ceiling once work is moving

Two independent brakes both turned out to be non-binding at runtime:

1. **`frugal-guard.sh` is a LAUNCH-time gate only.** It is called from exactly
   one place — `council.sh:39`, on `start`. Once seats exist, nothing re-checks
   the daily ceiling for the entire multi-day life of a driver.
2. **The per-task token budget is advisory-only.** `council-driver.sh:~958`
   logs an overage and *continues*, by deliberate design after an arbitrary cap
   once killed real work 8% over (task 9A85T9G).

With neither brake binding, a single task can burn without limit. Measured today:

- Daily total **11,464,867** tokens against an **8,000,000** ceiling — 143%.
- **HB6H3YW: 4,426,875** tokens (budget 5M) — 39% of the day, one card.
- **FGJ3XMZ: 3,892,248** tokens (budget 4M) — 34% of the day, one card.
- Together **8.3M — 73% of the day's burn from 2 of 11 tasks.**

This card logged the failure mode in its own driver log while diagnosing it:

```
[seat-9] [YT4TH3V] over advisory budget (1348111 > 400000) — CONTINUING
```

**The exhaustion is per-task runaway burn with no runtime ceiling — not seat
count, and not unfinished sessions.**

## The fix (shipped — commit 65b561f)

A **runtime daily-ceiling gate** in `council-driver.sh`, placed in the claim
loop *before* a task is claimed:

- Seats stay **alive** but claim **nothing** while the day's token/$ ceiling is
  breached. Work resumes automatically when the day rolls or the ceiling is
  raised in `state/frugal.conf` — no relaunch needed.
- Placed **before the claim, never during a run** — in-flight work is never
  killed mid-task. We stop *starting* new burn; we never abort *committed* burn.
- **Fails open** if the capacity probe is unreadable, so a broken probe can
  never wedge the whole council.
- Logs once on entry and once on recovery — a held seat cannot spam its log.
- Escape hatch: `COUNCIL_IGNORE_DAILY_CEILING=1`.

Verified: `bash -n` clean; 6/6 branches unit-tested (over, repeat-no-spam,
recovery, steady-state, usd-over-with-tokens-fine, malformed-fails-open).

## Sessions closed / left open, one by one

- **12 seat drivers — LEFT RUNNING.** They cost nothing idle and are the
  council's entire capacity. Closing them was the prior audit's error.
- **2 interactive sessions (pid 369574 `pts/0`, 370977 `pts/2`, 5.8 days old,
  670MB) — LEFT ALONE.** They sit under plain `-bash` on real TTYs, *outside*
  the tmux `council` session, i.e. Vinta's own attached terminals. They burn no
  tokens. Killing a live attached session is destructive and not reversible, so
  it is not the council's call. **If those two panes are finished with, closing
  them reclaims ~670MB** on a box currently at 8.7GB/13.9GB.
- **4 `needs-human` cards — LEFT SEALED.** `HCUN483`, `5H8AM5M`, `4AQEYJG`,
  `DCSUP43` are all Sealed-Question-Law test probes ("probe done", "probe
  cancel", ask: *"which one?"*), not real questions. They are scratch — but the
  Sealed-Question Law forbids any agent closing a sealed card, and "obviously
  scratch" is not an exception. **Only Vinta can clear them** (`vintask answer`
  or `done --force`). Flagged, not touched.
- **1 blocked card — LEFT BLOCKED.** `QB3H9BC` (DirZombie mockup) died with
  *"agent exited without recording a result."* Separate failure, own card.

## What remains open by design

The daily ceiling is currently **breached (11.46M/8M)**, so with this fix live
the seats will hold claims until the day rolls. That is the gate working as
intended, not a fault. To resume sooner, raise `DAILY_TOKEN_CEILING` in
`~/.claude/council-loop/state/frugal.conf`.

**Reversible via:** `git revert 65b561f` in `~/.claude/council-loop`, or set
`COUNCIL_IGNORE_DAILY_CEILING=1`.
