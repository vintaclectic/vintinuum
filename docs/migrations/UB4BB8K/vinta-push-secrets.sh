#!/usr/bin/env bash
# Run by Vinta; --check never opens or copies local credential files.
set -euo pipefail
VPS=vinta@2.28.131.70
TUNNEL=1cacfa16-3569-419a-ad5d-52981c6a803f.json
MODE=${1:---check}
case "$MODE" in --check|--push) ;; *) echo 'Usage: bash vinta-push-secrets.sh [--check|--push]' >&2; exit 2;; esac
SSH=(ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10
  -o ServerAliveInterval=15 -o ServerAliveCountMax=2 "$VPS")

# Authentication/host-key failures stop before any secret is opened. No SFTP
# subsystem is required: all checks and writes use the authenticated SSH shell.
"${SSH[@]}" 'bash -s' <<'REMOTE'
set -euo pipefail
test "$(id -un)" = vinta
test -d /home/vinta/dirhaven/server
test -w /home/vinta/dirhaven/server
test -d /home/vinta/.cloudflared
test -w /home/vinta/.cloudflared
echo 'SSH shell and destination directories: OK'
for path in /home/vinta/dirhaven/server/.env /home/vinta/.cloudflared/1cacfa16-3569-419a-ad5d-52981c6a803f.json; do
  if test -s "$path"; then stat -c '%n: %s bytes, mode %a' "$path"; else printf '%s: missing or empty\n' "$path"; fi
done
REMOTE
if [[ "$MODE" == --check ]]; then
  echo 'Check complete; no credentials copied. If both files already exist, investigate VPS application health before overwriting them.'
  exit 0
fi

ENV_FILE=/home/vinta/dirhaven/server/.env
TUN_FILE=/home/vinta/.cloudflared/$TUNNEL
for source in "$ENV_FILE" "$TUN_FILE"; do
  [[ -r "$source" && -s "$source" ]] || { echo "Missing/unreadable/empty source: $source" >&2; exit 1; }
done
push_file() {
  local source=$1 destination=$2 expected
  expected=$(sha256sum -- "$source")
  expected=${expected%% *}
  # Destinations below are fixed paths, not user input. mktemp in the destination
  # directory keeps replacement atomic. A failure leaves the original intact.
  "${SSH[@]}" "bash -c 'set -euo pipefail; umask 077; dest=\"$destination\"; tmp=\$(mktemp \"\${dest}.push.XXXXXX\"); trap '\''rm -f -- \"\$tmp\"'\'' EXIT; cat > \"\$tmp\"; test -s \"\$tmp\"; test \"\$(sha256sum -- \"\$tmp\" | cut -d \" \" -f1)\" = \"$expected\"; chmod 600 \"\$tmp\"; mv -f -- \"\$tmp\" \"\$dest\"; stat -c '\''%n: %s bytes, mode %a'\'' \"\$dest\"'" < "$source"
}
push_file "$ENV_FILE" /home/vinta/dirhaven/server/.env
push_file "$TUN_FILE" "/home/vinta/.cloudflared/$TUNNEL"
echo 'Both transfers completed. No cutover or service restart was performed.'
