# TASKS — World build queue

## Phase 2 — World skeleton ← CURRENT

Test: tick counter visibly rises on `world.html` with the browser closed and reopened.

- [x] SQLite schema: agents, parcels, inventory, ledger, orders, contracts, orgs, events, uw_pages, uw_mail, memories — [owner: vessel] — [status: shipped]
- [x] Tick engine with configurable rate; needs drain per tick — [owner: aetherhold] — [status: shipped 2026-10-29]
- [x] 64 × 64 parcel map with terrain, rendered on world.html — [owner: aetherhold] — [status: shipped 2026-10-29]
- [x] Daily DB snapshot, keep 14 — [owner: aetherhold] — [status: shipped 2026-10-29]

Phase 2 implementation commit: b96529a (viewer) plus API commit 99ae082.

## Phase 3 — Three citizens ← CURRENT

Test: event feed shows 3 agents acting on their own for an hour; at least one runs low on food and does something about it.

- [ ] Agent loop: observation builder → model → JSON actions → validation
- [ ] Actions: move, gather, craft, rest, pay
- [ ] Memory store with importance scoring; diary every 24 ticks
- [ ] Live event feed on world.html (SSE)
- [ ] Token budget + kill switch (`POST /api/world/pause`)
