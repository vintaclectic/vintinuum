#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CTB_ROOT="${CTB_ROOT:-$HOME/.claude/council-loop}"
RUNTIME="${CTB_EVOLUTION_RUNTIME:-$CTB_ROOT/state/skill-evolution/runtime}"
LOG_DIR="$CTB_ROOT/logs"
CRON_TAG="# ctb-skill-evolution"

mkdir -p "$RUNTIME" "$LOG_DIR"
install -m 0755 "$SOURCE_DIR/engine.js" "$RUNTIME/engine.js"
install -m 0755 "$SOURCE_DIR/verify.js" "$RUNTIME/verify.js"

# Verify the exact runtime artifact before scheduling it. The verifier uses only
# throwaway fixture state and cannot touch the live queue.
node "$RUNTIME/verify.js"

CRON_LINE="*/20 * * * * CTB_ROOT='$CTB_ROOT' /usr/bin/node '$RUNTIME/engine.js' sweep >> '$LOG_DIR/skill-evolution.log' 2>&1 $CRON_TAG"
CURRENT="$(crontab -l 2>/dev/null || true)"
FILTERED="$(printf '%s\n' "$CURRENT" | grep -Fv "$CRON_TAG" || true)"
{
  printf '%s\n' "$FILTERED"
  printf '%s\n' "$CRON_LINE"
} | awk 'NF && !seen[$0]++' | crontab -

echo "installed: $RUNTIME/engine.js"
echo "scheduled: every 20 minutes"
echo "verify: node $RUNTIME/verify.js"
echo "preview: node $RUNTIME/engine.js sweep --dry-run"
echo "status: node $RUNTIME/engine.js status"

