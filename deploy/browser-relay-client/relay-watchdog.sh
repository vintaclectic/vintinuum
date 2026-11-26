#!/usr/bin/env bash
# relay-watchdog.sh — the PC-side self-healing guard for the browser lane.
# Runs from cron every 5 minutes and @reboot (measured 2026-11-26: the
# heartbeat below was 39s old, so cron really is firing this file).
#
# It owns three links of one chain and repairs each in order:
#   1. the Windows Playwright relay  (http://127.0.0.1:9009/health)
#   2. the private SSH channel to brain-srv (browser-relay-tunnel.sh)
#   3. the remote brain's view of the relay (vintbrowse status / resume)
#
# It NEVER starts a local vintinuum-api: since 2026-11-17 the brain lives on
# brain-srv and a PC copy is a duplicate (~/.vintinuum/brain-remote is the switch).
set -uo pipefail
ROOT="${HOME}/.claude/council-loop"
LOG="$ROOT/logs/relay-watchdog.log"
HB="$ROOT/state/.relay-watchdog.heartbeat"
RELAY_COOLDOWN="$ROOT/state/.relay-watchdog.last-relay-launch"
RELAY_HEALTH_URL="http://127.0.0.1:${RELAY_PORT:-9009}/health"
RELAY_START_BAT='C:\Users\Vinta\vintinuum-browser-relay\start.bat'
POWERSHELL='/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe'
RELAY_LAUNCH_COOLDOWN_S=600
mkdir -p "$ROOT/logs" "$ROOT/state"
date +%s > "$HB"
log() { printf '[%s] %s\n' "$(date -Iseconds)" "$*" >> "$LOG"; }
quiet_ok() { (( 10#$(date +%M) < 5 )); }   # keep the "all fine" line hourly

relay_healthy() {
  curl -s -m 6 "$RELAY_HEALTH_URL" 2>/dev/null | grep -q '"ok":true'
}

# The relay is a Windows process; WSL can start it through interop. Task
# Scheduler owns it at logon, but nothing restarts it mid-session, so this does.
launch_relay() {
  [ -x "$POWERSHELL" ] || { log 'windows interop unavailable — cannot start the relay from here'; return 1; }
  local now last=0
  now="$(date +%s)"
  [ -r "$RELAY_COOLDOWN" ] && last="$(cat "$RELAY_COOLDOWN" 2>/dev/null || echo 0)"
  if (( now - last < RELAY_LAUNCH_COOLDOWN_S )); then
    log 'relay down but inside launch cooldown — leaving it to the previous attempt'
    return 1
  fi
  printf '%s\n' "$now" > "$RELAY_COOLDOWN"
  log 'windows relay not answering /health — launching start.bat'
  "$POWERSHELL" -NoProfile -Command \
    "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','$RELAY_START_BAT' -WorkingDirectory 'C:\\Users\\Vinta\\vintinuum-browser-relay' -WindowStyle Hidden" \
    >/dev/null 2>&1
  for _ in 1 2 3 4 5 6 7 8 9 10; do sleep 2; relay_healthy && { log 'windows relay back up'; return 0; }; done
  log 'windows relay still not answering after launch — check the Windows side'
  return 1
}

vb() { timeout 45 node "$ROOT/bin/vintbrowse.js" "$@" 2>/dev/null; }
connected() {
  vb status | node -e '
let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{
try{process.exit(JSON.parse(s).connected===true?0:1)}catch{process.exit(1)}});'
}

rc=0
relay_healthy || launch_relay || rc=1

if ! bash "$ROOT/bin/browser-relay-tunnel.sh" ensure; then
  log 'SSH channel to brain-srv could not be established — browser lane is down'
  exit 1
fi

if connected; then
  quiet_ok && log 'alive — brain reports relay connected'
  exit $rc
fi

# The brain backs off up to 10 minutes between attempts; resume skips the wait.
log 'brain does not see the relay — forcing an owner-authenticated resume'
vb resume >/dev/null
sleep 5
if connected; then
  log 'resume restored the relay'
  exit $rc
fi
# A channel can be half-dead: the -L side answers (so the tunnel looks healthy)
# while the -R side no longer reaches the relay. Rebuild it outright, then ask
# the brain once more.
log 'resume did not take — rebuilding the SSH channel from scratch'
bash "$ROOT/bin/browser-relay-tunnel.sh" start >/dev/null
vb resume >/dev/null
sleep 5
if connected; then
  log 'rebuilt channel restored the relay'
  exit $rc
fi
log "relay still disconnected after a channel rebuild (relay health: $(relay_healthy && echo ok || echo down))"
exit 1
