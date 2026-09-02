RPBusinessDeliveriesConfig = {
  debug = false,
  useOxmysql = true,
  staffAce = 'rp_business.admin',
  interactionDistance = 3.0,
  deliveryStartDistance = 4.0,
  bankDropDistance = 4.0,
  contractCooldownSeconds = 45,
  deliveryTimeoutSeconds = 900,
  protectTimeoutSeconds = 1200,
  maxActiveContractsPerPlayer = 1,
  minPoliceOnline = 0,
  payoutCleanPercent = 0.72,
  reputationLossOnFail = 4,
  loyaltyLossOnFail = 2,
  protectionRepRequired = 25,
  protectionLoyaltyRequired = 15,
  protectionHoldSeconds = 300,
  protectRewardMultiplier = 0.35,
  randomSeedSalt = 'change-me-per-server',

  Banks = {
    { id = 'legion_bank', label = 'Legion Square Bank', coords = vector3(149.78, -1040.74, 29.37) },
    { id = 'hawick_bank', label = 'Hawick Bank', coords = vector3(-351.63, -49.95, 49.04) },
    { id = 'sandy_bank', label = 'Sandy Shores Bank', coords = vector3(1175.05, 2706.91, 38.09) }
  },

  Businesses = {
    {
      id = 'vespucci_liquor',
      label = 'Vespucci Liquor',
      building = 'liquor_store',
      coords = vector3(-1222.37, -907.16, 12.33),
      bankId = 'legion_bank',
      risk = 2,
      basePayout = 650,
      baseReputation = 5,
      baseLoyalty = 3
    },
    {
      id = 'mirror_auto',
      label = 'Mirror Park Auto',
      building = 'garage',
      coords = vector3(1137.58, -776.82, 57.61),
      bankId = 'hawick_bank',
      risk = 3,
      basePayout = 900,
      baseReputation = 7,
      baseLoyalty = 4
    },
    {
      id = 'sandy_hardware',
      label = 'Sandy Hardware',
      building = 'hardware',
      coords = vector3(1961.37, 3740.74, 32.34),
      bankId = 'sandy_bank',
      risk = 4,
      basePayout = 1250,
      baseReputation = 9,
      baseLoyalty = 5
    }
  },

  Money = {
    addClean = function(source, amount, reason)
      -- Wire this to your framework or banking export, for example:
      -- exports.my_economy:AddMoney(source, 'cash', amount, reason)
      print(('[rp_business_deliveries] payout source=%s amount=%d reason=%s'):format(source, amount, reason))
      return true
    end,
    addDirty = function(source, amount, reason)
      -- Optional hook for servers that want part of the delivery to be dirty money.
      print(('[rp_business_deliveries] dirty payout source=%s amount=%d reason=%s'):format(source, amount, reason))
      return true
    end
  },

  PoliceCount = function()
    -- Replace with a job count export if protection/delivery gates should require police online.
    return 0
  end
}
