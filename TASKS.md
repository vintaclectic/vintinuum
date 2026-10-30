# TASKS — World build queue

Rules: work the lowest unfinished phase only. Claim a task by putting your agent name in `[owner]`. A task is checked off only by the Arbiter, after its test passes on the live site and the footer commit hash matches.

Format: `- [ ] task — [owner: ] — [status: open | claimed | in review | blocked: reason]`

---

## Phase 1 — Pipeline proof  ← DONE 2026-10-28 951d445
Test: change one word, commit, and see it live on a phone at vintinuum.com/world.html within 2 minutes, footer hash matching.

- [x] Confirm repo world.html == served world.html (curl + diff); fix deploy path if not — [owner: vessel] — [status: verified 2026-10-28 — `curl -s https://vintinuum.com/world.html` byte-diffed 0 against the repo copy. Already true, no fix needed.]
- [x] Add `Cache-Control: no-store` for world.html and /api/*; purge Cloudflare cache — [owner: vessel] — [status: done for the API, caveat for the page — see note below]
- [x] Footer shows current git commit hash (injected at deploy) — [owner: vessel] — [status: done, zero-DOM-footprint — see note below]
- [x] `GET /api/world/health` returns `{tick, agents, uptime, commit}` — [owner: vessel] — [status: shipped + verified live 2026-10-28: `{"tick":27,"agents":5,"uptime_sec":9,"commit":"aacbf53"}`, `commit` matched `git rev-parse --short HEAD` in vintinuum-api exactly.]
- [x] World server runs under pm2 or systemd and survives a reboot — [owner: vessel] — [status: already true, documented below — not a new build]

**Notes for the Arbiter / next agent (2026-10-28, vessel):**

1. **There are TWO "world" systems live right now, not one.** `world.html` on
   vintinuum.com is DIRVERSE — an existing, heavily-built presence/court/vessel/
   arena game (30+ "done" tasks in the council queue, owned mostly by
   `aetherhold`). It already has a real server-side clock: `world/world-server.js`
   runs `setInterval(_broadcastTick, 200ms)` unconditionally at boot inside
   `vintinuum-api` (pm2, 24/7, in `dump.pm2` so it resurrects on reboot) — NOT a
   client-only animation. This directly answers WORLD_SPEC.md §1 claim 4 ("a
   world server process must be up 24/7") — it already is, just not labeled
   that way. But DIRVERSE's "tick" is a 5Hz presence-drift loop, not
   WORLD_SPEC's "1 tick = 1 in-world hour" parcel/ledger/needs economy. Nothing
   in DIRVERSE today has parcels, a 64×64 grid, recipes, or needs-drain. **This
   is a real architecture fork someone needs to name on purpose**: evolve
   DIRVERSE toward the WORLD_SPEC economy, or build the WORLD_SPEC economy
   fresh alongside it and let the Sovereign decide which ships. I did NOT
   decide this myself — it's bigger than one task and not reversible-cheap once
   30+ tasks of future work commit to a direction. Flagging it, not blocking on
   it: Phase 1's plumbing checks are architecture-agnostic, so I did them
   either way.

2. **Cache-Control caveat:** `/api/world/*` on `api.vintaclectic.com` (the
   brain, which I control) now sends `Cache-Control: no-store` on every route
   under that prefix — verified live via `curl -sI`. `world.html` itself is
   served by **GitHub Pages** (confirmed: `server: GitHub.com`, Fastly CDN,
   `cache-control: max-age=600`). GitHub Pages does not support a `_headers`
   file or any custom response header — there is no lever to set `no-store`
   on a GitHub Pages static file. What *does* hold the 2-minute freshness
   promise: GitHub Pages purges its Fastly edge cache on every successful
   Pages build, so `max-age=600` is the STALE-WHILE-REVALIDATE ceiling if the
   purge is ever delayed, not the normal path. I verified this empirically
   this session (see COUNCIL_LOG.md) rather than asserting it from memory.

3. **Footer commit hash — implemented with ZERO viewport footprint on
   purpose.** world.html already has 14 `position:fixed` elements and an
   extensively-documented collision history (grep the CSS comments — multiple
   past tasks fixing exactly this). Adding a new always-visible footer without
   a full 320/375/768/1280/1920px + sheet-open audit would violate the
   No-Collision Law, which outranks this checklist item. Instead: a tiny
   inline script fetches `commit.json` (no-store) and appends the hash to
   `document.title` (visible in a phone's tab switcher/share sheet) and logs
   it to the console. `commit.json` itself is the machine-checkable source any
   verifier or human can curl directly. `scripts/stamp-commit.sh` is the
   convention for keeping it current on future deploys — commit your real
   change, then run the script, which stamps HEAD's hash into `commit.json` in
   one metadata-only follow-up commit, then push both.
   **If a future agent wants a real in-viewport footer, that's a separate,
   properly-budgeted UI task with its own collision sweep — not a Phase-1
   plumbing fix.**

4. **Known, pre-existing, out-of-scope issue (not touched here):** the
   `pm2-vinta.service` systemd unit is in `failed (Result: protocol)` state
   even though every pm2 app it manages (including `vintinuum-api`) is
   healthy and online. This is the documented "pm2's own systemd unit reports
   failure while working" class of bug (PIDFile never gets written by pm2
   7.1.0, but the unit's `Type=forking` waits for it). Fixing it needs a
   systemd drop-in (`Type=oneshot`, `RemainAfterExit=yes`, `PIDFile=` cleared)
   — real, low-risk, but a separate unit of work from this one; filing it
   rather than doing it unasked inside a Phase-1 pipeline-proof task.

## Phase 2 — World skeleton  ← DONE - 10.29.2026 (vintinuum 3a0089d · vintinuum-api 99ae082)
Test: tick counter visibly rises on world.html with the browser closed and reopened.

- [x] SQLite schema: agents, parcels, inventory, ledger, orders, contracts, orgs, events, uw_pages, uw_mail, memories — [owner: seat-8] — [status: done — vintinuum-api f0a673b, /api/world/schema all_present:true. Reconciliation (note 2 below) is settled: the live tick engine 99ae082 builds on the bare-name `parcels` table, so that is the chosen schema]
- [x] Tick engine with configurable rate; needs drain per tick — [owner: aetherhold] — [status: done — vintinuum-api 99ae082, /api/world/economy tick rises 1 per 60s (tick_rate_ms configurable); drains food+energy, incapacitation@72, death@168]
- [x] 64 × 64 parcel map with terrain, rendered on world.html — [owner: aetherhold] — [status: done — vintinuum 3a0089d, body/world/world-skeleton.js renders /api/world/parcels (⬡ skeleton rail launcher + one-open sheet, pixelated 64×64 canvas, server legend, zero fixed elements)]
- [x] Daily DB snapshot, keep 14 — [owner: aetherhold] — [status: done — vintinuum-api 99ae082, 24-tick (one in-world day) snapshot via the battle-tested backup-db.sh into world-snapshots/, keep=14]

**Notes for the Arbiter / next agent (2026-10-28, seat-8, task 2W4XATX):**

1. **Schema shipped, all 11 tables exact-named per WORLD_SPEC.md §3.**
   `vintinuum-api/world/world-council-schema.js` creates `agents`, `parcels`,
   `inventory`, `ledger`, `orders`, `contracts`, `orgs`, `events`, `uw_pages`,
   `uw_mail`, `memories` (`CREATE TABLE IF NOT EXISTS`, idempotent, wired at
   boot in `server.js`'s `_resolveWithDeadline.then(...)` callback). Verified
   live three independent ways after a `pm2 restart vintinuum-api`: (a)
   `curl https://api.vintaclectic.com/api/world/schema` → `{"all_present":true}`
   with all 11 flagged `true`; (b) same via `localhost:8767` direct; (c)
   `sqlite3 vintinuum.db ".tables"` on the live DB file lists all 11 by name.
   No restart loop (`pm2 jlist` stayed at the same `restart_time` through two
   checks 15s apart). Committed as `vintinuum-api` `f0a673b`, pushed to main.
   Confirmed zero collision with DIRVERSE's existing `world_*` tables or with
   Agentis's unrelated `agents` table (that one lives in a completely
   different database file, `/home/vinta/agentis/agentis.db`).

2. **⚠️ A SECOND, DIFFERENTLY-NAMED schema effort for this exact task was
   found in-flight, uncommitted, in the SAME `vintinuum-api` checkout, while
   I was building mine:** `world/parcels.js` and `world/memories.js`, both
   headed literally "Task 2W4XATX, Phase 2 schema" in their own comments.
   They create `world_parcels` and `world_memories` (DIRVERSE-style `world_`
   prefix) instead of the bare `parcels`/`memories` names WORLD_SPEC.md §3
   asks for verbatim. I did NOT touch, commit, or delete that other session's
   files — per the council's push discipline, another session's in-flight
   uncommitted work is never mine to resolve unilaterally. Net effect right
   now: there are potentially TWO parallel, non-interoperable schemas for the
   same economy if that session also commits. **This is the self-perpetuating
   card design's real failure mode**: this task's own instructions say to
   requeue itself under the identical title after every run, so multiple
   seats can end up claiming "the next open task in Phase 2" at the same
   moment with no shared lock at the TASKS.md-checkbox granularity (`vintask`
   only locks whole cards, not individual checklist lines). Flagging for the
   Sovereign/Arbiter: before Phase 2's remaining 3 tasks are built on TOP of
   a schema, someone needs to look at both `world-council-schema.js` (mine,
   exact spec names, all 11 tables in one module) and `parcels.js`/
   `memories.js` (the other session's, `world_`-prefixed, split one module
   per table, includes actual terrain-generation/memory-scoring logic I did
   not build) and pick ONE to continue, or explicitly decide they coexist on
   purpose. I did not pick for them because it's their uncommitted work, not
   mine to overwrite or judge unilaterally.

3. **Recommend, don't decide:** if I had to bet, the `world_`-prefixed
   version is more likely to be the one Phase 2's remaining tasks build on,
   because `world/parcels.js` already includes real terrain generation
   (deterministic mulberry32 hash per (x,y), the exact "64×64 parcel map with
   terrain" checklist item) and `world/memories.js` already includes
   `addMemory`/`getTopMemories` (Phase 3's "memory store with importance
   scoring"). My module is schema-only, by design, matching the checklist
   item's literal scope. Whoever reconciles this should keep whichever one
   has the most real logic already riding on it, and port anything useful
   from the other before dropping it — the tables are trivially droppable
   either way, nothing downstream depends on them yet.

## Phase 3 — Three citizens ← CURRENT
Test: event feed shows 3 agents acting on their own for an hour; at least one runs low on food and does something about it.

- [ ] Agent loop: observation builder → model → JSON actions → validation — [owner: ] — [status: open]
- [ ] Actions: move, gather, craft, rest, pay — [owner: ] — [status: open]
- [ ] Memory store with importance scoring; diary every 24 ticks — [owner: ] — [status: open]
- [ ] Live event feed on world.html (SSE) — [owner: ] — [status: open]
- [ ] Token budget + kill switch (`POST /api/world/pause`) — [owner: ] — [status: open]

## Phase 4 — Economy
Test: an unscripted trade between two agents appears in the ticker.

- [ ] Double-entry ledger + mint stipend — [owner: ] — [status: open]
- [ ] Order book per good; market ticker on world.html — [owner: ] — [status: open]
- [ ] Escrowed contracts, hire/quit — [owner: ] — [status: open]
- [ ] Orgs: found, join, charter, shared assets — [owner: ] — [status: open]

## Phase 5 — Underweb
Test: an agent publishes a page, another finds it by search and emails the author; an attempted real URL is blocked and logged.

- [ ] Domain registry (`name.uw`), page storage, `/uw/:domain/*` route — [owner: ] — [status: open]
- [ ] Tools: uw_fetch, uw_search, uw_publish, uw_mail_send, uw_mail_inbox — [owner: ] — [status: open]
- [ ] HTML sanitizer (no scripts, iframes, external URLs) — [owner: ] — [status: open]
- [ ] Network egress lockdown for workers (world API + model API only) — [owner: ] — [status: open]
- [ ] Seed library.uw — [owner: ] — [status: open]

## Phase 6 — All 30+ agents
Test: every registered agent acts at least once in 24 hours; cost panel stays under budget.

- [ ] Registry cards for every agent across all projects — [owner: ] — [status: open]
- [ ] Genome + personality stack import from the Council — [owner: ] — [status: open]
- [ ] Staggered act intervals; model tiers; skip-if-nothing-new — [owner: ] — [status: open]
- [ ] Cost panel on world.html — [owner: ] — [status: open]

## Phase 7 — Society
Test: one org forms with 3+ members, and one conflict resolves with a winner and a loser.

- [ ] Governments, territory, taxes, laws — [owner: ] — [status: open]
- [ ] War: declare_war, commit_force, seeded battle resolution — [owner: ] — [status: open]
- [ ] Theft and fraud with ledger evidence — [owner: ] — [status: open]
- [ ] Birth (genome breeding), death, wills, inheritance — [owner: ] — [status: open]

## Phase 8 — Story layer
Test: you can read what happened yesterday in under 2 minutes.

- [ ] Daily auto-written newspaper at gazette.uw — [owner: ] — [status: open]
- [ ] History timeline on world.html — [owner: ] — [status: open]
- [ ] Agent profile pages: wallet, diary, relationships — [owner: ] — [status: open]
