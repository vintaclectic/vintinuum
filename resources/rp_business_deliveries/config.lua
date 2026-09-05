BusinessDeliveriesConfig = {}

BusinessDeliveriesConfig.Framework = 'standalone' -- standalone, qbcore, qbox, esx, or custom
BusinessDeliveriesConfig.AdminAce = 'businessdeliveries.admin'
BusinessDeliveriesConfig.SaveFile = 'data/businesses.json'
BusinessDeliveriesConfig.ControlFile = 'data/control.json'

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

BusinessDeliveriesConfig.Takeover = {
  enabled = true,

  -- tagging: the on-foot claim action
  tagKey = 74, -- H (INPUT_VEH_HEADLIGHT)
  tagDurationMs = 6000,
  tagClaim = 12,
  tagCooldownSeconds = 180,
  tagHeat = 6,

  -- repping: passive claim earned by working the business
  claimPerDelivery = 5,
  claimPerProtection = 8,

  -- robbery: the high risk takeover vector
  robKey = 47, -- G (INPUT_DETONATE), shared with protection but never prompted together
  robKeyModifier = 21, -- LEFT SHIFT, held to disambiguate rob from protection
  robCooldownSeconds = 900,
  robBaseSuccess = 0.55,
  robSuccessPerHeatPoint = -0.004,
  robSuccessFloor = 0.15,
  robClaimGain = 30,
  robHolderClaimLoss = 22,
  robFailClaimLoss = 15,
  robHeat = 25,
  robPayoutMin = 900,
  robPayoutMax = 2100,
  robFailFineMin = 150,
  robFailFineMax = 400,
  robMinReputation = 15,
  robRequiresControlled = false,

  -- contest thresholds
  claimToHold = 40,
  contestMargin = 10,
  maxClaim = 400,

  -- decay: absent holders lose grip
  decayIntervalSeconds = 120,
  decayPerInterval = 2,
  holderDecayPerInterval = 1,
  heatDecayPerInterval = 3,

  -- economy under control
  controlCutPercent = 0.15,
  holderPayoutBonusPercent = 0.10,
  holderProtectionBonusPercent = 0.35,
  outsiderProtectionPenaltyPercent = 0.40,
  outsiderProtectionBlocked = false,
  vaultPayoutPercent = 1.0,

  -- persistence
  autosaveIntervalSeconds = 300,

  -- crews
  maxCrewNameLength = 24
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

  if BusinessDeliveriesConfig.Framework == 'qbcore' or BusinessDeliveriesConfig.Framework == 'qbox' then
    local qb
    if BusinessDeliveriesConfig.Framework == 'qbox' then
      qb = exports.qbx_core:GetCoreObject()
    else
      qb = exports['qb-core']:GetCoreObject()
    end
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
