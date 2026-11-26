#!/usr/bin/env bash
# Run on PC host, outside restricted council sandbox, after deploying API audit.
set -euo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEST="${HOME}/.claude/council-loop/bin"
STAMP="$(date +%Y%m%d-%H%M%S)"
node --check "$HERE/vintbrowse.js"
bash -n "$HERE/relay-watchdog.sh"
bash -n "$HERE/browser-relay-tunnel.sh"
for f in vintbrowse.js relay-watchdog.sh browser-relay-tunnel.sh; do
  test -f "$DEST/$f" && cp -p "$DEST/$f" "$DEST/$f.before-2MH3CNU-$STAMP"
  install -m 755 "$HERE/$f" "$DEST/$f"
done
printf 'Installed client + watchdog + tunnel supervisor; backups use .before-2MH3CNU-%s\n' "$STAMP"
# cron already runs relay-watchdog.sh every 5 minutes and @reboot; it now brings
# the SSH channel up itself, so no systemd unit and no sudo are needed.
bash "$DEST/browser-relay-tunnel.sh" ensure && printf 'SSH channel to the remote brain is up\n'
