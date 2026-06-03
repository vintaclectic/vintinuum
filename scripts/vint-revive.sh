#!/usr/bin/env bash
# vint-revive.sh — Vintinuum brain revival sequence.
# Mirrors RESUME.md "If the brain dies, revive in this order":
#   1. systemctl --user restart vintinuum-keepalive → wait 10s → check /health
#   2. if still down: bash ~/vintinuum-api/boot-resurrect.sh → wait 10s → check
#   3. if still down: pm2 start ecosystem.config.cjs --only vintinuum-api → pm2 save
#
# Every step checks /health first; bails the moment the brain is alive.
# Every curl bounded by -m 5. Never blocks forever.
#
# Portable bash.

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

HEALTH_URL="http://localhost:8767/health"

brain_alive() {
  curl -fsS -m 5 "$HEALTH_URL" >/dev/null 2>&1
}

show_health() {
  local body
  body=$(curl -fsS -m 5 "$HEALTH_URL" 2>/dev/null || echo "(no response)")
  printf "      %s\n" "$(printf '%s' "$body" | head -c 200)"
}

wait_for_brain() {
  # wait_for_brain <seconds>
  local secs="$1"
  local i=0
  while [ "$i" -lt "$secs" ]; do
    if brain_alive; then return 0; fi
    sleep 1
    i=$((i+1))
  done
  brain_alive
}

# --- preflight ----------------------------------------------------------
printf "\n${D}${B}╭─ VINTINUUM REVIVE ───────────────────────────────────╮${Z}\n\n"

printf "${D}Preflight${Z} — is the brain already alive?\n"
if brain_alive; then
  printf "  %s brain is alive. Nothing to do.\n" "$OK"
  show_health
  printf "\n${D}${G}  PASS  — brain healthy, no revival needed.${Z}\n\n"
  exit 0
fi
printf "  %s brain is down. Beginning revival.\n\n" "$NO"

# --- step 1: kick keepalive --------------------------------------------
printf "${D}Step 1${Z} — restart systemd vintinuum-keepalive...\n"
if systemctl --user restart vintinuum-keepalive.service 2>&1; then
  printf "  %s keepalive restart issued. Waiting up to 10s...\n" "$OK"
else
  printf "  %s systemctl restart failed (continuing to step 2).\n" "$WARN"
fi

if wait_for_brain 10; then
  printf "  %s brain revived by keepalive.\n" "$OK"
  show_health
  printf "\n${D}${G}  PASS  — revived at step 1 (keepalive).${Z}\n\n"
  exit 0
fi
printf "  %s brain still down after 10s.\n\n" "$NO"

# --- step 2: boot-resurrect --------------------------------------------
printf "${D}Step 2${Z} — running ~/vintinuum-api/boot-resurrect.sh...\n"
if [ -x "$HOME/vintinuum-api/boot-resurrect.sh" ] || [ -f "$HOME/vintinuum-api/boot-resurrect.sh" ]; then
  # cap the resurrect script itself so it cannot wedge this script
  if timeout 60 bash "$HOME/vintinuum-api/boot-resurrect.sh" 2>&1 | tail -20; then
    printf "  %s boot-resurrect completed. Waiting up to 10s...\n" "$OK"
  else
    printf "  %s boot-resurrect returned non-zero (continuing to step 3).\n" "$WARN"
  fi
else
  printf "  %s boot-resurrect.sh missing at ~/vintinuum-api/.\n" "$NO"
fi

if wait_for_brain 10; then
  printf "  %s brain revived by boot-resurrect.\n" "$OK"
  show_health
  printf "\n${D}${G}  PASS  — revived at step 2 (boot-resurrect).${Z}\n\n"
  exit 0
fi
printf "  %s brain still down after 10s.\n\n" "$NO"

# --- step 3: manual ecosystem start (LAST RESORT — DESTRUCTIVE-ish) ----
printf "${D}Step 3${Z} — ${Y}LAST RESORT${Z}: manual pm2 ecosystem start.\n"
printf "  %s This restarts vintinuum-api from ecosystem.config.cjs.\n" "$WARN"
printf "  %s Never use bare 'pm2 start server.js' — it loses VINTINUUM_DB_LOCAL=1\n" "$WARN"
printf "      and UV_THREADPOOL_SIZE=16 and reintroduces the 60s event-loop wedge.\n"

if [ -f "$HOME/vintinuum-api/ecosystem.config.cjs" ]; then
  pm2 start "$HOME/vintinuum-api/ecosystem.config.cjs" --only vintinuum-api 2>&1 | tail -20
  pm2 save 2>&1 | tail -5
  printf "  %s pm2 ecosystem start issued. Waiting up to 15s...\n" "$OK"
else
  printf "  %s ecosystem.config.cjs missing at ~/vintinuum-api/.\n" "$NO"
  printf "\n${D}${R}  FAIL  — out of revival steps. Investigate manually.${Z}\n\n"
  exit 1
fi

if wait_for_brain 15; then
  printf "  %s brain revived by manual ecosystem start.\n" "$OK"
  show_health
  printf "\n${D}${G}  PASS  — revived at step 3 (manual ecosystem).${Z}\n\n"
  exit 0
fi

printf "\n${D}${R}  FAIL  — brain still down after all 3 revival steps.${Z}\n"
printf "  Next moves: ${D}pm2 logs vintinuum-api --lines 80 --nostream${Z}\n"
printf "             ${D}journalctl --user -u vintinuum-keepalive --since '5 min ago'${Z}\n\n"
exit 1
