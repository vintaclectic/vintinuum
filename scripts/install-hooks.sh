#!/usr/bin/env bash
# install-hooks.sh — point git at the repo's TRACKED hooks (Vinta 2026-08-02).
#
# .git/hooks/ is not version-controlled, so the no-collision pre-commit guard
# lived only on the machine that happened to create it — a fresh clone (or any
# other council seat) silently had no guard at all. The hooks now live in
# .githooks/ (tracked), and this points git there.
#
#   bash scripts/install-hooks.sh
#
# Idempotent. Run once per clone.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
git -C "$ROOT" config core.hooksPath .githooks
chmod +x "$ROOT"/.githooks/* 2>/dev/null || true
echo "✓ hooks installed — core.hooksPath = .githooks"
echo "  active: $(ls "$ROOT/.githooks" | tr '\n' ' ')"
