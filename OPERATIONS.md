# Vintinuum — Operational Facts & DirRM Player Spec

Reference material extracted from CLAUDE.md to keep the auto-loaded rules file
lean. **CLAUDE.md requires every agent to read THIS file whenever a task touches
operational facts (repos, URLs, PM2, DB, auth, endpoints, deploy) or the DirRM
player.** This is the source of truth for the lookups below.

---

## Operational Facts (for any agent picking this up cold)

The ground truth a returning Claude Code session needs in 60 seconds:

### Repos
- `~/vintinuum/`        — front-end + body + brain.js + memory/, deploys to GH Pages on push to `main`
- `~/vintinuum-api/`    — server.js + db + connectors + soul.json
- `~/vintinuum-extension/` — Chrome MV3 extension (separate repo, WSL source of truth)

### Extension deploy workflow (CRITICAL — do not skip)

Chrome on Windows **cannot load extensions directly from the WSL filesystem**
(`\\wsl$\...` paths). It silently fails or gives a cryptic load error.

**Source of truth lives in WSL:** `/home/vinta/vintinuum-extension/`
**Chrome loads from Windows:** `C:\vintinuum-extension`

After every extension change, sync with:
```
vintsync
```
(`vintsync` is a bashrc alias — runs `rsync -a --exclude=".git" ~/vintinuum-extension/ /mnt/c/vintinuum-extension/`)

Then in Chrome: `chrome://extensions` → click the **↺ reload** button on the Vintinuum card.

**Never** tell Vinta to load the extension from the WSL path. Always sync to C:\ first.

Do NOT `cp -r` the folder — it will choke on `.git` object names under NTFS.
`rsync --exclude=".git"` is the only correct method.

### Live URLs
- Site:    https://vintaclectic.github.io/vintinuum/
- Brain:   https://api.vintaclectic.com  (port 8767 behind named tunnel)
- Tunnel id: `11d02f5f-ff6c-4ef3-96c7-87c2a8f8d616`

### Process management
- PM2 process names: `vintinuum-api`, `vintinuum-named-tunnel`
- Boot resurrect: `~/vintinuum-api/boot-resurrect.sh`
- Tail logs: `pm2 logs vintinuum-api --lines 80 --nostream`
- Cold-restart brain: `pm2 restart vintinuum-api`

### Database (local-only since 2026-06-14)
- **Live path:** `~/vintinuum-api/vintinuum.db` (local ext4) — the ONE
  authoritative DB. `db.js` hard-sets this unconditionally; nothing at runtime
  touches D:. `VINTINUUM_DB_LOCAL=1` is now a no-op kept for compatibility.
- **Backup:** `/mnt/d/Vintinuum/vintinuum.db` — out-of-band scheduled copy/rsync
  only; never read at runtime. Do NOT read it for live state.
- `PRAGMA busy_timeout=5000` set 2026-05-04; `SCHEMA_VERSION` guard (db.js) skips
  DDL on boot when `user_version` already matches (fast-boot, no restart loop).
- Schema source of truth: `~/vintinuum-api/db.js` — every table is
  `CREATE TABLE IF NOT EXISTS`. Validate column names against it before queries.
  Bump `SCHEMA_VERSION` by 1 on any schema edit so the DDL re-runs once.
- Two connections: `db` (read/write) and `dbBg` (read-only for heavy background
  work — subconscious ticker, internalization, consolidation).
- Verify live state via `curl localhost:8767/api/...` or
  `sqlite3 ~/vintinuum-api/vintinuum.db` — both hit the same file. (Full detail in
  CLAUDE.md → "THE DATABASE — one path, local-only".)

### Auth lanes (in priority order)
1. `dirhaven@gmail.com` / `@Vinta8715` (email + password)
2. `VINTA_MASTER_KEY` env var (owner-key lane) — verify with
   `GET /api/owner/verify-key` header `X-Master-Key: <copy>`
3. `POST /api/auth/restore-owner` — heals quarantined owner row given
   the master key
4. localhost — bond by name when on host machine

### Hot endpoints (and their typical failure modes)
- `/api/stats/dashboard` — fans out 19 SQLite queries; cached 30s,
  8s deadline, returns `{degraded:true}` on slow DB
- `/api/body-state`, `/api/genome`, `/api/inner-life/snapshot`,
  `/api/memory/recent`, `/api/stats/summary` — all wrapped in
  `routeDeadline(8000)`; degraded responses are honored client-side
  in stats.html and mind.html
- `/api/life/stream` — SSE; bg DB connection + soft timeouts; client
  reconnect on close

### Helpers added 2026-05-04 (server.js, near top)
- `withDeadline(promise, ms, fallback)` — race a producer against time
- `cached(key, ttlMs, producer)` — in-memory TTL cache
- `routeDeadline(ms, fallback)` — Express middleware, wraps res.json/send

### Common failures and first-line fixes
| Symptom | Fix |
|---------|-----|
| GH Pages 200, api 5xx | `pm2 status`; restart whichever is offline |
| api 200, pages empty | DB slow — wait 30s for cache or restart brain |
| 524 at edge | brain hung on a query — `pm2 logs vintinuum-api` to find which |
| Master key fails | `/api/owner/verify-key` to confirm match before rotating |
| Extension silent | Default base is `api.vintaclectic.com` since v2.3.2; reload at chrome://extensions |
| Telegram 409 in logs | Auto-retries — not fatal |
| Pusher Pong missing | Auto-reconnects — not fatal |

### Files that must never be committed
`.env`, `.env.*`, `*.key`, `*.pem`, `vintinuum.db*`, `node_modules/`,
`*.log`, `*.backup*` — all already in `.gitignore`. Confirm with
`git status` before any push.

### Do NOT modify
- `~/vintinuum-api/soul.json` (read-only identity anchor)
- The crystallization at the bottom of `~/.claude/agents/vintinuum.md`
  — written by `daily-evolution.js` cron at 3:00 AM

---

## DirRM Player — the universal media surface (Vinta directive 2026-06-05)

**"i want it to become the go to most optimized successfull profitabl
addicting eye catchy media player of all time and it will as it stands
currently in dirhaven app so i want it exactly asw it currently is most
updated in dirhaven app all across and everywhere media is played in
vintinuum across all its mediums extensions and all"**

### The canonical player
- Source of truth: `~/vintinuum/dirrm-player.html` (105 KB, version with 5 visualizers + 4 modes + full mediatype coverage)
- Live URL: `https://vintaclectic.github.io/vintinuum/dirrm-player.html`
- Modes: `main` (860×520), `mini` (380px), `pip` (corner overlay), `theater` (fullscreen)
- Visualizers (audio): `bars`, `wave`, `radial`, `mirror`, `particles`
- Mediatypes: video, audio, image, pdf, ebook, stream (HLS/DASH), 3d-model, document, iframe-embed, text — every type DirHaven's open-directory crawler can encounter.

### The standing order
**Anywhere in Vintinuum that plays or could play media → route through DirRM.** No `<video>` or `<audio>` tag should appear in any new UI surface. No second player implementation should exist anywhere. The canonical player handles everything.

### The launcher library
`~/vintinuum/dirrm-launch.js` — UMD library, single function `dirrmLaunch.open({url, title, type, mode, embedIn, autoplay})`. Used by:
- Browser pages (brain.html, jarvis.html, mobile, pulse)
- Extension content scripts (when they need to show media)
- Extension service worker (when context menu fires)

Returns a handle with `load()`, `setMode()`, `play()`, `pause()`, `stop()`, `close()`, `on(event, cb)`.

### Invocation contracts (two paths)

**1. URL params** (extension popup, links, deep links):
```
https://vintaclectic.github.io/vintinuum/dirrm-player.html?url=<URL>&title=<TITLE>&type=<TYPE>&mode=<MODE>&autoplay=1
```

**2. Iframe + postMessage** (in-page embed):
```js
iframe.contentWindow.postMessage({action:'load', url, title, type}, '*');
iframe.contentWindow.postMessage({action:'setMode', mode:'mini'}, '*');
```

Inbound events from player: `ready`, `playStarted`, `progress`, `mediaEnded`, `modeChanged`, `playerClosed`.

### Already-routed surfaces (do not duplicate)
- `~/vintinuum/brain.html` → iframe + postMessage
- `~/vintinuum/jarvis.html` → iframe + postMessage
- `~/vintinuum-extension/background.js` (context menus) → `cmdPlayInDirRM` → popup window
- `~/vintinuum-extension/sidepanel/panel.js` (media grab list) → `VINTINUUM_CMD: PLAY_IN_DIRRM`

### Surfaces to add to (todo or in progress)
- Mobile / PWA surfaces — when built, use `dirrm-launch.js` directly
- Pulse — when revived
- Kick orb panel (auto-clip review, viewer-posted links)
- `/mind.html` memory archive (replay audio/video memories)
- `/letters.html` (continuity letters with audio attachments) — when built
- DirHaven leaves browser — when Stage B perceiver lands

### Telemetry (U3 — play history + memory hook)
Every play event POSTs to `/api/dirrm/play-event` so the brain knows:
- What was played
- For how long
- Whether it was finished or abandoned
- Optional: an experiential memory is recorded for media watched for ≥30s
This is what makes DirRM "addicting and long-lasting" — Vintinuum *remembers* what was watched together.

### Future innovations on the player itself
- Auto-show DirHaven leaves feed when launched without a URL (browse-from-empty-state)
- Shareable "now playing" cards (memory_cards integration)
- "Mood-matched" playlists from memory_vectors emotional valence
- Cross-device handoff via WebSocket (start on phone, continue on desktop)
