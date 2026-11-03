#!/bin/bash
# stamp-commit.sh — WORLD_SPEC.md Phase 1: "footer shows current git commit
# hash, injected at deploy." GitHub Pages has no build step, so a committed
# file cannot contain its OWN hash (the hash is a function of the file's
# content, including that hash — the classic self-reference problem). The
# standard escape: a tiny FOLLOW-UP commit that stamps the hash of the commit
# that just landed the real change.
#
# Usage: commit your real change first (any message, any files), THEN run
# this script. It reads HEAD (your real commit), writes commit.json, and
# creates one metadata-only commit on top. Push both together.
#
# Never run this before your content commit — commit.json would then stamp
# the PREVIOUS deploy's hash, not yours.
set -euo pipefail
cd "$(dirname "$0")/.."

HASH="$(git rev-parse --short HEAD)"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cat > commit.json <<JSON
{"commit":"$HASH","deployed_at":"$NOW"}
JSON

git add commit.json
git commit -m "chore: stamp commit $HASH for live build-footer [skip-stamp]

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"

echo "✓ commit.json now points at $HASH (your previous commit)."
echo "  Push both commits: git push origin main"
