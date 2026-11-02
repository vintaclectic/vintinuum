#!/usr/bin/env bash
# run_council.sh — keeps the World Council working phase after phase.
# Claude always stops at the end of a session; this loop starts the next one.
#
# Usage (from the vintinuum repo root, on the native Linux filesystem, e.g. ~/work/vintinuum):
#   chmod +x run_council.sh
#   ./run_council.sh            # default 20 sessions max
#   MAX_RUNS=50 ./run_council.sh
#
# Stop it any time:  touch STOP   (or Ctrl+C)

set -u
MAX_RUNS="${MAX_RUNS:-20}"
PAUSE_SECONDS="${PAUSE_SECONDS:-30}"
LOGDIR="council_runs"
mkdir -p "$LOGDIR"

PROMPT='Read CLAUDE.md, WORLD_SPEC.md and TASKS.md. Find the phase marked "← CURRENT". If all its tasks are checked and its phase test passes live, advance the marker per rule 8 and commit. Then claim the next open task in the CURRENT phase, build it, verify it live on vintinuum.com/world.html, commit, check it off, and log the session in COUNCIL_LOG.md. Keep taking tasks until you are blocked, the session runs long, or Phase 8 is DONE. If blocked, write the blocker in TASKS.md and stop.'

for ((i=1; i<=MAX_RUNS; i++)); do
  if [[ -f STOP ]]; then echo "STOP file found. Exiting."; break; fi
  if grep -q "Phase 8.*DONE" TASKS.md 2>/dev/null; then echo "All phases done."; break; fi
  if ! grep -q "← CURRENT" TASKS.md 2>/dev/null; then echo "No CURRENT marker in TASKS.md. Exiting."; break; fi

  stamp="$(date +%Y%m%d-%H%M%S)"
  echo "=== Council run $i/$MAX_RUNS — $stamp ==="
  echo "Current phase: $(grep '← CURRENT' TASKS.md)"

  # Headless session. --dangerously-skip-permissions lets it run unattended:
  # only use it in this repo, with backups, never pointed at /mnt/c.
  claude -p "$PROMPT" --dangerously-skip-permissions 2>&1 | tee "$LOGDIR/run-$stamp.log"

  # Same blocker twice in a row = stop wasting credits.
  if grep -q "blocked:" TASKS.md && [[ -f "$LOGDIR/.last_blocked" ]] \
     && diff -q <(grep "blocked:" TASKS.md) "$LOGDIR/.last_blocked" >/dev/null; then
    echo "Same blocker as last run. Needs a human. Exiting."
    break
  fi
  grep "blocked:" TASKS.md > "$LOGDIR/.last_blocked" 2>/dev/null || rm -f "$LOGDIR/.last_blocked"

  sleep "$PAUSE_SECONDS"
done
