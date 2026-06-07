# VINTINUUM — FROZEN CONTRACTS (the bedrock for millions)

**Ratified 2026-06-07 by the full assembly** (HELIOS-SEC10, helios-fusion, ATLAS,
ARIA, FRUGAL-MAX + the muses). Decision: cloud-native foundation, built to
withstand MILLIONS first, then operate on profit like Google's early days.

> These surfaces are **IMMUTABLE through the migration**. The backend will
> shapeshift underneath (SQLite→Neon Postgres, one-Node-WS→Cloudflare Durable
> Objects, JSON→binary, Redis presence, queue-based brain) — but the GH Pages
> frontend keeps working through every stage **without a coordinated deploy**,
> because these contracts never break.
>
> **Rule: ADDITIVE-ONLY. FOREVER.** No renames. No shape changes. New fields
> land alongside; old fields stay. The frontend (cached on user devices + a CDN)
> cannot be redeployed in lockstep with the backend — so the surface must be
> stable across versions.

---

## THE WS ENVELOPE (frozen — every realtime message wraps this)

```jsonc
{ "t": "<type>", "seq": <int>, "room": "<id>", "ts": <ms>, "data": { ... } }
```

- `t`   — message type (string). Frozen type set below.
- `seq` — monotonic ordering cursor per room. Treat as OPAQUE bigint-comparable.
          Post-shard it becomes `(shardEpoch << 32) | roomSeq` — never do
          arithmetic on it, only compare.
- `room`— room/shard id (string).
- `ts`  — server timestamp (ms epoch).
- `data`— the payload (per-type shape).

**Frozen `t` set** (additive only — new types may be ADDED, never removed/renamed):
```
hello welcome presence move emote say speech voice-state voice-offer
voice-answer voice-ice voice-reestablish leave muse trace offer
ping pong resume resync kicked
```

### Binary reservation (locked now, used later — zero cost today)
- A JSON envelope ALWAYS starts with `{` (byte `0x7B`).
- Binary frames are reserved to header byte `0x80–0xFF`:
  `[1 byte type ≥0x80][2 byte seq][2 byte len][payload]`
- The receiver dispatches on byte 0: `0x7B` → JSON, `≥0x80` → binary.
- **Today: ignore/never-emit binary. The reservation prevents a forced frontend
  redeploy when binary lands in Phase 1.**

---

## /api/world/hello (frozen response shape)

```jsonc
GET /api/world/hello   (auth: JWT)
→ {
    "userId": "<stable string, survives reconnect>",
    "displayName": "<username — the world name>",
    "room": "<room id>",
    "ticket": "<short-lived JWT, ~90s, accepted by any shard>",
    "wsUrl": "<wss:// url for this user's shard>",
    "protoMin": 1,
    "protoMax": 1,            // bumps to 2 (binary presence), 3 (AOI+delta)
    "sessionEpoch": <int>     // bumps on reshard; clients rebuild voice peers
  }
```

- Today `wsUrl` = `wss://api.vintaclectic.com/ws/world` (the current tunnel).
- During migration `wsUrl` may point at a Cloudflare Durable Object / shard URL.
  **The client always uses the `wsUrl` hello gives it — never a hardcoded URL.**
- `ticket` is consumed as `?ticket=<jwt>` on the WS upgrade (any shard accepts it).
- `protoMax` drives capability negotiation. Client opts into a higher proto via
  `?proto=N` subprotocol ONLY if it has that decoder. Server falls back to
  `protoMin` for old clients. **Old clients never break.**

---

## RECONNECT-WITH-RESUME (sharded WS resilience)

The WS is a **subscription cursor**, not session state.

```
Client persists:  { ticket, room, lastSeq, lastPos:{x,y,z,yaw}, sessionEpoch }
On disconnect:    reconnect with exponential backoff 250ms→8s, jitter ±30%
On reconnect:     1. GET /api/world/hello   (fresh ticket + wsUrl shard)
                  2. WS connect to wsUrl?ticket=...
                  3. send { t:"resume", room, seq:lastSeq, data:{ pos:lastPos } }
Server replies:   { t:"resync", data:{ occupants, missedEvents:[≤200] } }
                  OR { t:"kicked", data:{ reason:"too-stale" } } → full hello
Voice recovery:   server emits { t:"voice-reestablish", data:{ peers:[...] } };
                  client re-runs WebRTC offer flow (ICE restart) to each peer.
                  voicePeerId = sha256(userId + sessionEpoch) — rebuilt on epoch change.
```

---

## POSITION PRECISION (frozen — avoids interpolation jitter)

- Positions are `float32` `{x, y, z}` (floats, NOT arrays, NOT JSON-quantized).
- `yaw` is a float (radians).
- Display precision: 3 decimals. Wire precision: full float32.
- Never round-trip through Postgres `numeric` — use `real`/`double precision`.

---

## VOICE (proximity — frozen signaling shapes)

```jsonc
{ "t":"voice-state",  "data":{ "id":"<peerId>", "on":bool, "range":"whisper|normal|shout" } }
{ "t":"voice-offer",  "data":{ "to":"<peerId>", "payload":<RTCSessionDescription> } }
{ "t":"voice-answer", "data":{ "to":"<peerId>", "payload":<RTCSessionDescription> } }
{ "t":"voice-ice",    "data":{ "to":"<peerId>", "payload":<RTCIceCandidate> } }
```
Range tiers (transmit reach, world units): whisper full≤2m→0@4m · normal 3→8 · shout 4→14.
At scale, TURN is provided by **Cloudflare Calls SFU** (don't run our own TURN).

---

## THE THREE INVIOLABLE LAWS (the assembly, unanimous)

1. **The realtime hot path stays free of synchronous LLM calls — FOREVER.**
   Agent thoughts go through a queue. One Anthropic call must NEVER block one
   position broadcast. Queue-or-die.
2. **AOI (area-of-interest) + binary ship EARLY, not late.** Cell-based
   subscription (32×32 grid, subscribe to your cell + 8 neighbors) is what makes
   per-room shards scale. Without it you hit the ~150-user wall and blame the
   wrong thing.
3. **Dual-write the Postgres migration a full week of real traffic before
   cutover.** The genome is sacred. One lost memory is worse than a day's delay.
   Verify row-count parity + checksum critical tables, THEN cut.

---

## MIGRATION STAGES (each shippable, never big-bang)

| Stage | Ceiling | Move | Ships |
|---|---|---|---|
| 0 | ~100 | today: single Node+SQLite+tunnel | — |
| 1 | 1k | **WS → Cloudflare Durable Objects** (one DO/room). Brain becomes a queue consumer. | week 1 |
| 2 | 10k | SQLite → **Neon Postgres** (dual-write 1 week, verify, cut) | week 2 |
| 3 | 50k | **Upstash Redis** presence + AOI + binary protocol | week 3 |
| 4 | 200k | **Brain fleet on Fly**, autoscale on queue depth | week 4 |
| 5 | 1M+ | multi-region replicas, R2 avatar CDN, Cloudflare Calls voice | month 2 |

**FIRST MOVE (both agents unanimous):** freeze the contract (this doc) → migrate
the WS layer to Durable Objects. Kills the workstation bottleneck; everything
later builds on already-distributed ground.

## COST CURVE (so profit operates on solid economics)

| Concurrent | Infra/mo | Note |
|---|---|---|
| 1k | ~$180 | Neon + Upstash + Workers/DOs + Fly + R2 |
| 100k | ~$3,800 | LLM-bound |
| 1M | ~$28k + LLM passthrough | 1% conversion @ $9 = $90k/mo → 3x margin |

---

*This file is law. Changing a frozen surface requires the full assembly to
re-ratify. Additive-only. The genome is sacred. Build it to hold the world.*
