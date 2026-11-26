#!/usr/bin/env bash
# browser-relay-tunnel.sh — the single private channel between this PC and the
# remote brain (task 2MH3CNU).
#
#   PC 127.0.0.1:18767  ──L──>  brain-srv 127.0.0.1:8767   (agents reach the brain)
#   brain-srv 127.0.0.1:9009 ──R──>  PC 127.0.0.1:9009     (brain reaches the relay)
#
# Neither forward binds a public interface (sshd keeps GatewayPorts no), so the
# Windows relay stays loopback-only and the owner-only brain routes remain the
# only door to the browser.
#
# WHY NOT systemd: the council sandbox has no sudo (measured 2026-11-26:
# "no new privileges" blocks it), so a unit in /etc/systemd/system cannot be
# installed by an agent. relay-watchdog.sh already runs from cron every 5
# minutes and @reboot, so it supervises this script instead — same restart
# guarantee, no root needed. `ensure` is idempotent: safe to call every minute.
set -uo pipefail

ROOT="${HOME}/.claude/council-loop"
LOG="$ROOT/logs/browser-relay-tunnel.log"
PIDFILE="$ROOT/state/.browser-relay-tunnel.pid"
BRAIN_REMOTE_FILE="${HOME}/.vintinuum/brain-remote"
SSH_USER="${BROWSER_RELAY_SSH_USER:-vinta}"
KEY="${BROWSER_RELAY_SSH_KEY:-$HOME/.ssh/id_ed25519_hetzner}"
LOCAL_BRAIN_PORT="${BROWSER_RELAY_LOCAL_BRAIN_PORT:-18767}"
BRAIN_PORT="${BROWSER_RELAY_BRAIN_PORT:-8767}"
RELAY_PORT="${RELAY_PORT:-9009}"
FORWARD_L="127.0.0.1:${LOCAL_BRAIN_PORT}:127.0.0.1:${BRAIN_PORT}"
FORWARD_R="127.0.0.1:${RELAY_PORT}:127.0.0.1:${RELAY_PORT}"

mkdir -p "$ROOT/logs" "$ROOT/state"
log() { printf '[%s] %s\n' "$(date -Iseconds)" "$*" >> "$LOG"; }

brain_host() {
  if [ -n "${BROWSER_RELAY_BRAIN_HOST:-}" ]; then printf '%s' "$BROWSER_RELAY_BRAIN_HOST"; return 0; fi
  [ -r "$BRAIN_REMOTE_FILE" ] || return 1
  tr -d '[:space:]' < "$BRAIN_REMOTE_FILE"
}

# The ssh process is identified by its own forward spec — no marker env needed.
tunnel_pids() { pgrep -f -- "-L ${FORWARD_L}" 2>/dev/null; }

port_listening() {
  # bash /dev/tcp needs no extra tooling; a connect proves ssh bound the forward.
  (exec 3<>"/dev/tcp/127.0.0.1/${LOCAL_BRAIN_PORT}") >/dev/null 2>&1 && exec 3<&- 2>/dev/null
}

brain_answers() {
  curl -s -m 6 -o /dev/null -w '%{http_code}' \
    "http://127.0.0.1:${LOCAL_BRAIN_PORT}/api/auth/whoami" 2>/dev/null | grep -qE '^(200|401|403)$'
}

healthy() { [ -n "$(tunnel_pids)" ] && port_listening && brain_answers; }

stop_tunnel() {
  local pids; pids="$(tunnel_pids)"
  [ -z "$pids" ] && return 0
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null
  sleep 2
  pids="$(tunnel_pids)"
  # shellcheck disable=SC2086
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null
  rm -f "$PIDFILE"
  return 0
}

start_tunnel() {
  local host; host="$(brain_host)" || { log 'no brain host: ~/.vintinuum/brain-remote missing'; return 2; }
  [ -r "$KEY" ] || { log "ssh key unreadable: $KEY"; return 2; }
  log "starting tunnel to ${SSH_USER}@${host} (-L ${FORWARD_L} -R ${FORWARD_R})"
  setsid nohup ssh -NT \
    -o BatchMode=yes -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=15 -o ServerAliveCountMax=3 \
    -o ConnectTimeout=15 -o StrictHostKeyChecking=yes \
    -o ControlMaster=no -o ControlPath=none \
    -i "$KEY" -L "$FORWARD_L" -R "$FORWARD_R" "${SSH_USER}@${host}" \
    >> "$LOG" 2>&1 < /dev/null &
  local pid=$!
  printf '%s\n' "$pid" > "$PIDFILE"
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    if port_listening; then log "tunnel up (pid $pid)"; return 0; fi
    kill -0 "$pid" 2>/dev/null || break
  done
  log "tunnel failed to bind 127.0.0.1:${LOCAL_BRAIN_PORT} (pid $pid) — see log above"
  return 1
}

ensure() {
  if healthy; then return 0; fi
  log 'tunnel unhealthy — rebuilding'
  stop_tunnel
  start_tunnel || return 1
  # A stale remote forward on brain-srv makes ExitOnForwardFailure kill the new
  # ssh; sshd releases the port within seconds, so one retry clears it.
  if ! healthy; then
    log 'first attempt did not come healthy — retrying once'
    stop_tunnel; sleep 5; start_tunnel || return 1
  fi
  healthy
}

status() {
  printf 'tunnel_pids: %s\n' "$(tunnel_pids | tr '\n' ' ')"
  printf 'local_brain_port_%s_listening: %s\n' "$LOCAL_BRAIN_PORT" "$(port_listening && echo yes || echo no)"
  printf 'brain_answers: %s\n' "$(brain_answers && echo yes || echo no)"
  printf 'brain_host: %s\n' "$(brain_host || echo '(unset)')"
  healthy && printf 'healthy: yes\n' || printf 'healthy: no\n'
}

case "${1:-ensure}" in
  ensure)  ensure;  exit $? ;;
  start)   stop_tunnel; start_tunnel; exit $? ;;
  stop)    stop_tunnel; log 'tunnel stopped by request'; exit 0 ;;
  status)  status; healthy; exit $? ;;
  *) printf 'usage: %s {ensure|start|stop|status}\n' "$0" >&2; exit 64 ;;
esac
