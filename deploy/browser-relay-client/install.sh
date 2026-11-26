#!/usr/bin/env bash
# Run on PC host, outside restricted council sandbox, after deploying API audit.
set -euo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEST="${HOME}/.claude/council-loop/bin"
STAMP="$(date +%Y%m%d-%H%M%S)"
node --check "$HERE/vintbrowse.js"
bash -n "$HERE/relay-watchdog.sh"
for f in vintbrowse.js relay-watchdog.sh; do
  test -f "$DEST/$f" && cp -p "$DEST/$f" "$DEST/$f.before-2MH3CNU-$STAMP"
  install -m 755 "$HERE/$f" "$DEST/$f"
done
printf 'Installed client + watchdog; backups use .before-2MH3CNU-%s\n' "$STAMP"
