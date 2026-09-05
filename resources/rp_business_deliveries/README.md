# RP Business Deliveries

Standalone FiveM resource for turning available buildings into businesses, running money deliveries from those businesses to banks, and growing player reputation plus per-business loyalty until protection work unlocks.

## Install

1. Copy `resources/rp_business_deliveries` into any FXServer resources folder.
2. Add this to `server.cfg`:

```cfg
ensure rp_business_deliveries
add_ace group.admin businessdeliveries.admin allow
```

3. Set `BusinessDeliveriesConfig.Framework` in `config.lua` to `standalone`, `qbcore`, `esx`, or wire a custom `BusinessDeliveriesConfig.AddMoney` function.

## Admin Commands

`/bizadd <name>` creates a business at your current position.

`/bizbank <business_id>` sets that business bank dropoff to your current position.

`/biztoggle <business_id>` enables or disables a business.

`/bizstats` prints your current reputation, delivery count, and protection count.

Businesses are saved to `data/businesses.json`, so admins can create them in-game without editing Lua.

## Player Loop

Players walk to a business marker, press `E`, and get a bank dropoff route. Depositing at the bank pays cash or dirty money, grants global reputation, and grants loyalty for that business. When both reputation and loyalty cross the configured thresholds, protection work unlocks at the business with `G`.

All payouts, progression, cooldowns, distance checks, and protection unlocks are server-side. The client only displays markers and requests actions.

## Adapter Notes

The default standalone adapter only prints the payout to the player. Production servers should wire `BusinessDeliveriesConfig.AddMoney` into their economy, inventory, or dirty-money system.

The included QBCore and ESX branches are intentionally small. If a server uses different account names or inventory items, edit only the adapter function in `config.lua`.
