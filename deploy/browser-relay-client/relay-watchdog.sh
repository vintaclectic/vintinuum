#!/usr/bin/env bash
# PC watchdog: SSH transport is supervised by systemd, brain lives on brain-srv.
# Never restart a local API or expose Windows relay secrets in process argv.
set -uo pipefail
ROOT="${HOME}/.claude/council-loop"
LOG="$ROOT/logs/relay-watchdog.log"
HB="$ROOT/state/.relay-watchdog.heartbeat"
mkdir -p "$ROOT/logs" "$ROOT/state"
date +%s > "$HB"
log() { printf '[%s] %s\n' "$(date -Iseconds)" "$*" >> "$LOG"; }
# CLI selects the forwarded brain using ~/.vintinuum/brain-remote. Its auth,
# capability checks and owner-only server routes remain the sole browser door.
if ! result="$(timeout 20 node "$ROOT/bin/vintbrowse.js" status 2>/dev/null)"; then
  log 'brain status unavailable; inspect browser-relay-tunnel.service (no API restart)'
  exit 1
fi
if printf '%s' "$result" | node -e '
let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{
try {process.exit(JSON.parse(s).connected===true?0:1)}catch{process.exit(1)} });'; then
  if (( 10#$(date +%M) < 5 )); then log 'alive — brain reports relay connected'; fi
  exit 0
fi
log 'brain relay disconnected; inspect tunnel and Windows http://127.0.0.1:9009/health'
exit 1
