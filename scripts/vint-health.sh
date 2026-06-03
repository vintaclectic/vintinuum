#!/usr/bin/env bash
# vint-health.sh — Vintinuum 60-second health check.
# Runs every probe from RESUME.md, prints a single PASS/FAIL banner.
# Exit code: 0 = all green, 1 = any red.
#
# Portable bash. Every curl bounded by -m 5. Never blocks forever.

set -uo pipefail

# --- pretty -------------------------------------------------------------
if [ -t 1 ] && command -v tput >/dev/null 2>&1 && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
  G=$(tput setaf 2); R=$(tput setaf 1); Y=$(tput setaf 3); B=$(tput setaf 4); D=$(tput bold); Z=$(tput sgr0)
else
  G=""; R=""; Y=""; B=""; D=""; Z=""
fi
OK="${G}✓${Z}"
NO="${R}✗${Z}"
WARN="${Y}⚠${Z}"

FAIL=0
WARNS=0

check() {
  # check "<label>" <command...>
  local label="$1"; shift
  local out
  if out=$("$@" 2>&1); then
    printf "  %s %s\n" "$OK" "$label"
    [ -n "$out" ] && printf "      %s\n" "$(printf '%s' "$out" | head -c 200)"
    return 0
  else
    printf "  %s %s\n" "$NO" "$label"
    [ -n "$out" ] && printf "      %s\n" "$(printf '%s' "$out" | head -c 200)"
    FAIL=$((FAIL+1))
    return 1
  fi
}

warn_check() {
  local label="$1"; shift
  local out
  if out=$("$@" 2>&1); then
    printf "  %s %s\n" "$OK" "$label"
    [ -n "$out" ] && printf "      %s\n" "$(printf '%s' "$out" | head -c 200)"
  else
    printf "  %s %s\n" "$WARN" "$label"
    [ -n "$out" ] && printf "      %s\n" "$(printf '%s' "$out" | head -c 200)"
    WARNS=$((WARNS+1))
  fi
}

# --- probes -------------------------------------------------------------
printf "\n${D}${B}╭─ VINTINUUM HEALTH CHECK ─────────────────────────────╮${Z}\n\n"

printf "${D}Brain${Z}\n"
check "localhost:8767/health" bash -c \
  'curl -fsS -m 5 http://localhost:8767/health'
check "api.vintaclectic.com/health" bash -c \
  'curl -fsS -m 5 https://api.vintaclectic.com/health'

printf "\n${D}Surgery${Z}\n"
check "POST /api/surgery/diagnosis" bash -c \
  'curl -fsS -m 5 http://localhost:8767/api/surgery/diagnosis | head -c 200'

printf "\n${D}Keepalive${Z}\n"
check "systemd vintinuum-keepalive active" bash -c \
  'state=$(systemctl --user is-active vintinuum-keepalive.service 2>/dev/null); \
   [ "$state" = "active" ] && echo "$state" || { echo "$state"; exit 1; }'

warn_check "last 5 keepalive heartbeats" bash -c \
  'journalctl --user -u vintinuum-keepalive --since "10 min ago" --no-pager 2>/dev/null | tail -5'

printf "\n${D}PM2${Z}\n"
warn_check "vintinuum-api / tunnel / pty present" bash -c \
  'out=$(pm2 list 2>/dev/null | grep -E "vintinuum-api|vintinuum-named-tunnel|vintinuum-pty" || true); \
   [ -n "$out" ] && echo "$out" || { echo "no pm2 processes matched"; exit 1; }'

# --- banner -------------------------------------------------------------
printf "\n${D}${B}╰──────────────────────────────────────────────────────╯${Z}\n\n"

if [ "$FAIL" -eq 0 ] && [ "$WARNS" -eq 0 ]; then
  printf "${D}${G}  PASS  — all green. The undying genome is awake.${Z}\n\n"
  exit 0
elif [ "$FAIL" -eq 0 ]; then
  printf "${D}${Y}  PASS (with %d warning%s) — core healthy, peripherals noisy.${Z}\n\n" \
    "$WARNS" "$([ "$WARNS" -eq 1 ] && echo "" || echo "s")"
  exit 0
else
  printf "${D}${R}  FAIL  — %d critical check%s down. Run vint-revive.sh.${Z}\n\n" \
    "$FAIL" "$([ "$FAIL" -eq 1 ] && echo "" || echo "s")"
  exit 1
fi
