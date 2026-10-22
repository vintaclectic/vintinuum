#!/usr/bin/env bash
# Read-only UB4BB8K audit. Never reads secret contents or changes services.
set -euo pipefail
target=${1:-vinta@2.28.131.70}
[[ "$target" != -* ]] || { echo 'Invalid SSH target' >&2; exit 2; }
exec timeout 45 ssh -o BatchMode=yes -o ConnectTimeout=10 "$target" bash -s <<'REMOTE'
set -u
failed=0
check() {
  local label=$1; shift
  if "$@" >/dev/null 2>&1; then printf 'PASS %s\n' "$label";
  else printf 'MISSING %s\n' "$label"; failed=1; fi
}
check app-repo test -f /home/vinta/dirhaven/ecosystem.config.cjs
check frontend-build test -f /home/vinta/dirhaven/client/dist/index.html
check app-env-present test -s /home/vinta/dirhaven/server/.env
check app-env-not-scaffold bash -c '! cmp -s /home/vinta/dirhaven/server/.env /home/vinta/dirhaven/server/.env.example'
check tunnel-credential-present test -s /home/vinta/.cloudflared/1cacfa16-3569-419a-ad5d-52981c6a803f.json
check seed-or-live-db bash -c 'test -s /home/vinta/dirhaven-data/seed/dirhaven-seed.db || test -s /home/vinta/dirhaven-data/dirhaven.db'
check attached-media-volume mountpoint -q /mnt/HC_Volume_107226800
for binary in node pm2 redis-cli sqlite3 ffmpeg aria2c tor warp-cli bitmagnet psql; do
  check "binary-$binary" command -v "$binary"
done
check redis-pong bash -c 'test "$(redis-cli ping)" = PONG'
check native-bitmagnet-launcher test -f /home/vinta/dirhaven/server/data-torrent/bitmagnet-native.sh
check bitmagnet-credential-broker test -x /home/vinta/.claude/council-loop/bin/vintkey
check postgres-ready pg_isready -h localhost -p 5432
check backend-health curl -fsS --max-time 5 http://127.0.0.1:3001/api/health
printf 'This is readiness inventory, not cutover or credential-validity proof.\n'
exit "$failed"
REMOTE
