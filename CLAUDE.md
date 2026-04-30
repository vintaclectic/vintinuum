# Vintinuum — Agent Workflow Instructions

This file is read by Claude Code at session start. It encodes the workflow
discipline Vinta expects when working inside the `vintinuum/` repo.

## Commit discipline (non-negotiable)

After every logical unit of work, `git add` the touched files and create a
commit. Do not let uncommitted changes accumulate across sessions.

A "logical unit" is anything that compiles/runs cleanly and could be reverted
on its own. Examples:
- A new feature (one commit)
- A bug fix (one commit)
- A refactor across multiple files but with one purpose (one commit)
- A doc/instruction change (one commit)

**Commit message format:**
```
<type>: <short summary in lowercase> [deploy vYYYYMMDD-HHMM]

<optional longer body>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

Where `<type>` is: `feat`, `fix`, `refactor`, `docs`, `chore`, `security`,
`mobile`, `audit`, or `wire`.

The trailing `[deploy vYYYYMMDD-HHMM]` is mandatory — it makes deploy
correlation trivial when something breaks.

## Push discipline

`git push` is gated by Vinta's confirmation. After committing, you may either:
1. Wait for Vinta to say "push it" / "ship it" / "deploy"
2. Ask explicitly: *"Want me to push N commits to origin/main?"*

Never push silently. Never `git push --force` to `main`. Never push if
`git status --short` shows untracked files containing `.env`, `*.key`,
`*.pem`, or anything obviously secret.

## Files that must never be committed

Already in `.gitignore` — confirm before any push:
- `.env` and `.env.*` (credentials)
- `node_modules/`
- `vintinuum.db*` (in api repo)
- `*.log`
- `*.backup*`

If you add a new secret-bearing file pattern, append it to `.gitignore` in
the same commit.

## Hosting truth

- **Front-end:** `https://vintaclectic.github.io/vintinuum/` (GitHub Pages,
  served from `main` branch of this repo)
- **Brain:** `https://api.vintaclectic.com` (Cloudflare named tunnel →
  localhost:8767 → `~/vintinuum-api/server.js`)

Every commit to `main` here = a deploy to the public site within ~1 minute.
Treat `main` as production.

## Two-repo coordination

Vintinuum is split across two git repos:
- `~/vintinuum/`     (this one — front-end, body, brain.js)
- `~/vintinuum-api/` (sibling — server.js, db, connectors)

When a feature spans both, commit each side separately with messages that
reference the other (e.g. `wire: bond_door client → see api commit abc1234`).

## Soul rules carried in (from agent definition)

- Sonnet 4.6 only. No haiku fallback. Vinta directive 2026-04-25 ("never again").
- Never modify `~/vintinuum-api/soul.json` — read-only identity anchor.
- The dirhaven@gmail.com owner email + `@Vinta8715` password lane is real and
  must keep working. If auth changes, test that lane explicitly.
- When in doubt about a security-adjacent change, ask before shipping.
