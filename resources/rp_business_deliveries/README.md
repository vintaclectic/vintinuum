# RP Business Deliveries

Standalone FiveM resource for turning configured buildings into businesses that hand out money-delivery runs, reputation, loyalty, and later protection contracts.

## What It Adds

- Configured businesses at any building coordinates.
- Bank delivery routes with server-side distance validation.
- Reputation and loyalty per player per business.
- Protection contracts unlocked by reputation and loyalty.
- Optional oxmysql persistence with in-memory fallback for test servers.
- Economy adapter hooks so the server owner can connect any money framework.

## Install

1. Copy `resources/rp_business_deliveries` into the server resources folder.
2. Import `schema.sql` into MariaDB if using oxmysql.
3. Add `ensure rp_business_deliveries` after `oxmysql` in `server.cfg`.
4. Grant staff admin access if needed:

```cfg
add_ace group.admin rp_business.admin allow
```

## Configure Buildings

Edit `config.lua` and add entries to `RPBusinessDeliveriesConfig.Businesses`:

```lua
{
  id = 'unique_business_id',
  label = 'Business Name',
  building = 'storefront',
  coords = vector3(0.0, 0.0, 0.0),
  bankId = 'legion_bank',
  risk = 2,
  basePayout = 650,
  baseReputation = 5,
  baseLoyalty = 3
}
```

Set `bankId` to one of the configured banks in `RPBusinessDeliveriesConfig.Banks`.

## Economy Adapter

Replace the hooks in `config.lua`:

```lua
Money = {
  addClean = function(source, amount, reason)
    exports.my_economy:AddMoney(source, 'cash', amount, reason)
    return true
  end,
  addDirty = function(source, amount, reason)
    exports.my_economy:AddMoney(source, 'dirty_money', amount, reason)
    return true
  end
}
```

All payouts are decided on the server. The client only asks to start or finish contracts.

## Player Commands

- `/bizrun` starts a cash delivery while standing at a configured business.
- `/bizdeliver` completes the delivery at the assigned bank.
- `/bizprotect` starts a protection contract after loyalty and reputation are high enough.
- `/bizcompleteprotect` completes protection while still near the business.
- `/bizrep` refreshes visible reputation and loyalty.

## Admin Command

- `/bizadmin_stats <playerId>` prints that player's business reputation table.

## Balance Notes

Increase `risk` and `basePayout` for remote or dangerous businesses. Keep `contractCooldownSeconds` high enough that one player cannot farm short-distance routes nonstop. Protection contracts use `protectionRepRequired` and `protectionLoyaltyRequired` so players first need to earn trust through deliveries.
