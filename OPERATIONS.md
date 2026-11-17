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
- Site:    https://vintinuum.com/
- Brain:   https://api.vintaclectic.com  (port 8767 behind named tunnel)
- Tunnel id: `<tunnel-id — see .env>`

### Cloudflare tunnels — ONE TUNNEL PER ACCOUNT (the 1033 law)

**A tunnel can only serve a zone that lives in the SAME Cloudflare account.**
Cloudflare refuses a cross-account tunnel CNAME with **error 1033** (HTTP 530),
and a cross-account proxied CNAME with **1014**. This bites twice now, and both
times the DNS record and the ingress rule looked *perfectly correct* — the
tunnel OWNER was the wrong thing. If you see 1033, do not debug DNS or ingress:
compare the tunnel's `AccountTag` to the zone's account id.

Three separate tunnels, three configs, three pm2 processes — a `cloudflared`
process is bound to exactly one tunnel's credentials, so accounts cannot share
a daemon:

| Config | pm2 process | Account | Serves |
|---|---|---|---|
| `~/.cloudflared/config.yml` | `vintinuum-named-tunnel` | vintaclectic (`a500348d…`) | `api.` / `board.` / `dirmegle.vintaclectic.com` |
| `~/.cloudflared/dirmegle.yml` | `dirmegle-tunnel` | DirMegle (`0cbb17c0…`) | `dirmegle.com`, `www.dirmegle.com` |
| `~/.cloudflared/dirhaven.yml` | `dirhaven-tunnel` | DirHaven (`8faedb3a…`) | `app.dirhaven.com` → `localhost:5175` |

All three force `protocol: http2` — cloudflared's QUIC path drops the WebSocket
Upgrade header in transit, which breaks sockets while every health check stays
green. Never add a hostname to a config whose account doesn't own that zone;
that's dead config that quietly shadows the truth.

**Verify a hostname the right way.** Vinta's Spectrum router runs a CUJO filter
that SNI-hijacks some hostnames, producing a bogus "SSL wrong version number"
that looks exactly like a cert fault. Always confirm against the edge IP
directly, which bypasses it:
`curl -sI --resolve app.dirhaven.com:443:104.21.1.142 https://app.dirhaven.com/`

Note: the `dirhaven.com` **apex has no A/AAAA/CNAME record** — it does not
resolve by design as of 2026-08-07 (`www` CNAMEs to the empty apex, so it is
dead too). Only `app.dirhaven.com` is live. That is not a regression.

### VPS STANDBY — brain cutover RETIRED HERE; transfer continues in another session (98MRP8C → DKZR8WD, closed 2026-11-17)

**⛔ DO NOT FLIP DNS FROM THIS DOC.** An earlier revision of this section told
you the flip was *"the next safe step — not a question, a scheduled action."*
**That instruction was wrong and is revoked.** Lord Vinta ruled on 2026-11-17
that the brain transfer is being handled **in a different session**, and card
DKZR8WD was archived/completed on his word. Nothing in this file authorises
`cloudflared tunnel route dns vintinuum-vps api.vintaclectic.com`.

Three measured reasons the flip is not a scheduled action (DKZR8WD, 2026-11-17):

1. **The standby is schema-incompatible, so the flip breaks `world.html`
   outright.** VPS git HEAD `debea06` (2026-10-27) vs the PC's `3ccd88d`;
   209 DB tables vs the PC's 238, with `world_clock`, `events`, `agents`,
   `memories` and `orders` ALL ABSENT. `GET /api/world/state` answers
   `Cannot GET /api/world/state` on the VPS while the PC serves the live tick.
2. **The flip is NOT reversible on the data axis.** `route dns` undoes
   *routing* instantly, but the brain is not stateless — it runs the world tick
   engine against its own DB, so any overlap advances **two divergent worlds**
   and no DNS command merges them.
3. **The fault that justified the migration was fixed in place.** The move
   existed because "the PC tunnel drops 10 of 40 public requests". Task
   5PFGZE7 (2026-11-14) root-caused that to the brain origin's missing
   `keepAliveTimeout` (node's 5s default vs cloudflared's 1h30m pool → RST on
   every pooled reuse) and fixed it on the PC. Re-measured 2026-11-17:
   **40/40 sustained public requests returned 200, 0 failures**, shaped as
   bursts with 20–45s idle gaps so pooled reuse after idle is actually exercised.

A second, independent copy of `vintinuum-api` is still running as
**STANDBY ONLY, parked and harmless** on a Hetzner VPS (`2.31.76.25`, root,
hostname `ubuntu-4gb-fsn1-1`, cpx22 @ fsn1). DNS for `api.vintaclectic.com`
points at the PC's tunnel — **production traffic has never moved.**

| Thing | PC (primary, live) | VPS (standby, 2.31.76.25) |
|---|---|---|
| vintinuum-api | pm2 `vintinuum-api`, port 8767, online | pm2 `vintinuum-api` (namespace `vintinuum`), port 8767, online since 2026-11-14T11:55:26Z, **restarts=0** |
| `.env` TRADING_MODE | `live` in `.env` | **forced `paper`** — re-verified 2026-11-17 in the LIVE process env (`tr '\0' '\n' < /proc/34684/environ` → `TRADING_MODE=paper`), not just the `.env` file |
| trading automation running? | **NO** — measured 2026-11-17: 13 pm2 apps on the PC, and `mercatus` / `mercatus-reporter` / `vintinuum-scheduler` are **all absent** (this row used to claim "yes"; that is stale) | **NO** — only the `vintinuum-api` app is started there |
| Cloudflare tunnel | `vintinuum-named-tunnel` (id `d911c951…`, pm2-managed) | `vintinuum-vps` (id `1c661ac2…`), managed by **systemd** `cloudflared.service` (active + enabled) — NOT pm2 |
| Tunnel ingress | `api.`/`board.`/`dirmegle.vintaclectic.com` | **`api.vintaclectic.com` only** → `http://127.0.0.1:8767`; everything else falls to `http_status:404`. `protocol: http2` is **load-bearing** — cloudflared's QUIC path drops the WebSocket `Upgrade` header and the brain serves WebSockets |
| DB | live `vintinuum.db` | 20-day-stale standby copy (`VACUUM INTO` via `scripts/backup-db.sh`, never `.backup` — JDK9KKV/2P3YBT7) + its own WAL since start |
| Reboot survival | `boot-resurrect.sh` + pm2-vinta.service | `pm2-root` systemd enabled; `dump.pm2` = `['vintinuum-api']`; `cloudflared.service` enabled |

**A 502 trap was found and defused here (DKZR8WD, 2026-11-17).** The abandoned
2026-11-14 reverse-ssh relay experiment was rolled back on the PC but left
behind on the VPS: `/etc/cloudflared/config.yml` (confirmed as the file the
LIVE `cloudflared` argv reads, not just the unit) still forwarded
api/board/observatory to three ports with **nothing listening**. So the flip
would have taken `api.vintaclectic.com` from 200 to a **502**, not to the VPS
brain. The config was restored to brain-only and re-verified:
`ingress rule https://api.vintaclectic.com/api/health` → `Matched rule #0 →
http://127.0.0.1:8767`; `board.vintaclectic.com` → `Matched rule #1 →
http_status:404`. Backup of the relay config:
`/etc/cloudflared/config.yml.bak-relay-20261116`.

**Verifying which brain is actually serving public traffic — by payload
fingerprint, never by inference.** `/api/health` returns live counters, so the
three instances are distinguishable. Measured 2026-11-17:
PC local `:8767` → `local:17 cloud:6 savedUSD:0.31`; **PUBLIC** api →
`local:17 cloud:6 savedUSD:0.31` (**IDENTICAL** → DNS is on the PC); VPS local
`:8767` → `local:35 cloud:0 savedUSD:0.63` (**DIFFERENT**). A `cf-ray` colo or
a resolved IP does not prove this; the payload does.

Decision brief with the three costed options (A retire / B refresh-then-flip /
C warm read-only standby):
`~/.claude/council-loop/state/docs/DKZR8WD-20261117-0237-brain-cutover-decision.md`.
Original plan: `~/.claude/council-loop/state/docs/98MRP8C-20261027-1110-vps-cutover-next-phase.md`.

### Process management
- PM2 process names: `vintinuum-api`, `vintinuum-named-tunnel`,
  `dirmegle-tunnel`, `dirhaven-tunnel`
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
1. owner email + password (credentials live in `.env` / owner's memory — never in-repo)
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
- Live URL: `https://vintinuum.com/dirrm-player.html`
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
https://vintinuum.com/dirrm-player.html?url=<URL>&title=<TITLE>&type=<TYPE>&mode=<MODE>&autoplay=1
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
