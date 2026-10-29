# World Council brief

The world is a persistent, closed society. The server owns state; `world.html`
is a read-only viewer. One economy tick is one in-world hour and defaults to
one real minute. Needs drain on each tick. Land is a deterministic 64 × 64 grid
with flat, fertile, forest, ore, and water terrain. Daily SQLite snapshots keep
the latest 14 days. The Phase 2 API surface is `/api/world/health`,
`/api/world/economy`, and `/api/world/parcels`.
