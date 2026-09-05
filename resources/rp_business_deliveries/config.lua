BusinessDeliveriesConfig = {}

BusinessDeliveriesConfig.Framework = 'standalone' -- standalone, qbcore, esx, or custom
BusinessDeliveriesConfig.AdminAce = 'businessdeliveries.admin'
BusinessDeliveriesConfig.SaveFile = 'data/businesses.json'

BusinessDeliveriesConfig.InteractKey = 38 -- E
BusinessDeliveriesConfig.MarkerDistance = 18.0
BusinessDeliveriesConfig.InteractDistance = 2.0
BusinessDeliveriesConfig.DeliveryVehicleRequired = false
BusinessDeliveriesConfig.DeliveryTimeoutSeconds = 900
BusinessDeliveriesConfig.CooldownSeconds = 300
BusinessDeliveriesConfig.MaxActiveRunsPerPlayer = 1
BusinessDeliveriesConfig.GlobalBankDropoff = vec3(149.86, -1040.73, 29.37)

BusinessDeliveriesConfig.Payout = {
  min = 450,
  max = 950,
  reputationMultiplier = 0.015,
  loyaltyMultiplier = 0.01,
  dirtyMoneyChance = 0.35
}

BusinessDeliveriesConfig.Progression = {
  reputationPerDelivery = 6,
  loyaltyPerDelivery = 4,
  protectionUnlockReputation = 60,
  protectionUnlockLoyalty = 35,
  protectionReward = 350,
  protectionCooldownSeconds = 1200
}

BusinessDeliveriesConfig.Businesses = {
  {
    id = 'vanilla_unicorn',
    name = 'Vanilla Unicorn',
    coords = vec3(129.1, -1299.2, 29.23),
    bank = vec3(149.86, -1040.73, 29.37),
    faction = 'nightlife',
    enabled = true
  },
  {
    id = 'ltd_grove',
    name = 'Grove Street LTD',
    coords = vec3(-47.38, -1758.68, 29.42),
    bank = vec3(-1212.72, -330.79, 37.78),
    faction = 'retail',
    enabled = true
  }
}

BusinessDeliveriesConfig.Notify = function(source, message, kind)
  TriggerClientEvent('rp_business_deliveries:client:notify', source, message, kind or 'info')
end

BusinessDeliveriesConfig.AddMoney = function(source, amount, account)
  account = account or 'cash'

  if BusinessDeliveriesConfig.Framework == 'qbcore' then
    local qb = exports['qb-core']:GetCoreObject()
    local player = qb.Functions.GetPlayer(source)
    if player then
      player.Functions.AddMoney(account == 'dirty_money' and 'markedbills' or 'cash', amount, 'business-delivery')
      return true
    end
  elseif BusinessDeliveriesConfig.Framework == 'esx' then
    local xPlayer = exports.es_extended:getSharedObject().GetPlayerFromId(source)
    if xPlayer then
      if account == 'dirty_money' then
        xPlayer.addAccountMoney('black_money', amount)
      else
        xPlayer.addMoney(amount)
      end
      return true
    end
  end

  TriggerClientEvent('rp_business_deliveries:client:standalonePayout', source, amount, account)
  return true
end
