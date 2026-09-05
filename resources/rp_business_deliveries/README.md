# RP Business Deliveries

Standalone FiveM resource for turning available buildings into businesses, running money deliveries from those businesses to banks, and growing player reputation plus per-business loyalty until protection work unlocks.

## Install

1. Copy `resources/rp_business_deliveries` into any FXServer resources folder.
2. Add this to `server.cfg`:

```cfg
ensure rp_business_deliveries
add_ace group.admin businessdeliveries.admin allow
```

3. Set `BusinessDeliveriesConfig.Framework` in `config.lua` to `standalone`, `qbcore`, `qbox`, `esx`, or wire a custom `BusinessDeliveriesConfig.AddMoney` function.

Qbox is qb-core API compatible. Selecting `qbox` resolves the core through `exports.qbx_core` while `qbcore` keeps using `exports['qb-core']`; both take the same code path afterwards. `standalone` still runs with zero dependencies.

## Admin Commands

`/bizadd <name>` creates a business at your current position.

`/bizbank <business_id>` sets that business bank dropoff to your current position.

`/biztoggle <business_id>` enables or disables a business.

`/bizstats` prints your current reputation, delivery count, protection count, tags, robs, and crew.

`/bizseize <business_id>` (admin) wipes all claims and control on a business.

Businesses are saved to `data/businesses.json`, so admins can create them in-game without editing Lua. Control and claim state is saved alongside it in `data/control.json`.

## Player Loop

Players walk to a business marker, press `E`, and get a bank dropoff route. Depositing at the bank pays cash or dirty money, grants global reputation, and grants loyalty for that business. When both reputation and loyalty cross the configured thresholds, protection work unlocks at the business with `G`.

All payouts, progression, cooldowns, distance checks, and protection unlocks are server-side. The client only displays markers and requests actions.

## Adapter Notes

The default standalone adapter only prints the payout to the player. Production servers should wire `BusinessDeliveriesConfig.AddMoney` into their economy, inventory, or dirty-money system.

The included QBCore and ESX branches are intentionally small. If a server uses different account names or inventory items, edit only the adapter function in `config.lua`.

## Takeover: Claiming a Business

Businesses are not just delivery nodes. Crews fight over who controls them.

### Claim score

Every business tracks a claim score per crew. You raise yours three ways:

- **Tagging** - stand at the business and hold `H` (`Takeover.tagKey`) through a timed action. Walking away cancels it. Grants `tagClaim` and adds heat. Cooldown `tagCooldownSeconds` per player per business.
- **Repping** - simply working the business. Every completed delivery grants `claimPerDelivery` and every protection job grants `claimPerProtection` to your crew's pool at that business.
- **Robbing** - see below. The fastest and loudest route.

When a crew's claim crosses `claimToHold`, they take control of an uncontrolled business. To take a business off an existing holder, a rival must both cross `claimToHold` **and** exceed the current holder's score by `contestMargin`. Control flips are announced server-wide.

### Decay

Every `decayIntervalSeconds`, all claims lose ground (`decayPerInterval`, or the gentler `holderDecayPerInterval` for the current holder) and heat cools by `heatDecayPerInterval`. If the holder's own score falls below `claimToHold`, they lose the business and it returns to uncontrolled. An absent crew cannot hold turf forever.

### Crews

`/bizcrew <name>` puts you in a named crew; every member's claims feed one shared pool. `/bizcrew clear` returns you to solo, where you are simply a crew of one. `/bizcrew` with no arguments reports your current crew.

### Robbery as a takeover vector

Hold `LEFT SHIFT` and press `G` at a business to rob it. Robbery is deliberately high risk:

- Requires `robMinReputation` and is gated by `robCooldownSeconds` per player per business.
- Success odds start at `robBaseSuccess` and **fall as the business gets hotter** (`robSuccessPerHeatPoint`), with a floor of `robSuccessFloor`. Hitting the same business repeatedly makes it progressively harder.
- **Success** pays `robPayoutMin`-`robPayoutMax` in dirty money, grants `robClaimGain` to you, strips `robHolderClaimLoss` from the current holder, and can flip control outright.
- **Failure** costs you `robFailClaimLoss` claim and still spikes heat. You get nothing.

Every rob adds `robHeat` regardless of outcome, so a crew that spams robberies poisons the odds for itself.

### What control is worth

- Outsiders running deliveries at a controlled business lose `controlCutPercent` of the payout, skimmed into the business vault.
- The controlling crew earns `holderPayoutBonusPercent` extra on their own deliveries there.
- The controlling crew earns `holderProtectionBonusPercent` more on protection work; outsiders take an `outsiderProtectionPenaltyPercent` cut, or are blocked entirely if `outsiderProtectionBlocked` is true.
- `/bizvault <business_id>` lets the controlling crew empty the accumulated vault as dirty money, on site.
- `/bizcontrol [business_id]` reports who holds what, the vault, the heat, and the strongest standing claim.

Uncontrolled businesses behave exactly as they did before takeover existed. No holder means no cut, no bonus, no penalty.

### Legibility

Business markers are colour coded: gold for uncontrolled, blue when held, orange when contested. A floating label above each marker names the holder or the leading contester and shows current heat.

## Keys

| Key | Action |
| --- | --- |
| `E` | start a delivery / deposit at the bank |
| `H` | tag the business (timed claim action) |
| `G` | protection work (once unlocked) |
| `LEFT SHIFT` + `G` | rob the business |

The shift modifier is what keeps robbery and protection on the same physical key without ambiguity. Only one help prompt is ever drawn, composed of whichever actions are currently available.

## Anti-cheat

Every takeover event is server-authoritative and re-validates independently of anything the client sends:

- the business exists and is enabled
- the player's real ped is within range of the real business coords
- the per-player per-business cooldown has elapsed
- reputation and control eligibility gates
- a per-source rate limit on every net event

Claim amounts, payouts, rob odds, and control flips are computed entirely server-side. A client spamming `rp_business_deliveries:server:robBusiness` gains nothing but its own cooldown.

## Persistence

Control survives restarts. `data/control.json` is written on every control change, on a `autosaveIntervalSeconds` timer, and on resource stop, then reloaded on start next to `data/businesses.json`.
