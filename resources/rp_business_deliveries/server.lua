local Config = RPBusinessDeliveriesConfig
local activeContracts = {}
local memoryStats = {}
local lastContractAt = {}
local runtimeBusinesses = {}
local runtimeFile = 'businesses.json'

local function logDebug(message)
  if Config.debug then
    print(('[rp_business_deliveries] %s'):format(message))
  end
end

local function notify(source, message)
  TriggerClientEvent('rp_business:client:notify', source, message)
end

local function playerIdentifier(source)
  for _, identifier in ipairs(GetPlayerIdentifiers(source)) do
    if identifier:sub(1, 8) == 'license:' then
      return identifier
    end
  end
  return ('source:%s'):format(source)
end

local function businessById(businessId)
  if type(businessId) ~= 'string' then return nil end
  for _, business in ipairs(Config.Businesses) do
    if business.id == businessId then
      return business
    end
  end
  for _, business in ipairs(runtimeBusinesses) do
    if business.id == businessId then
      return business
    end
  end
  return nil
end

local function allBusinesses()
  local out = {}
  for _, business in ipairs(Config.Businesses) do out[#out + 1] = business end
  for _, business in ipairs(runtimeBusinesses) do out[#out + 1] = business end
  return out
end

local function serializableBusiness(business)
  return {
    id = business.id,
    label = business.label,
    building = business.building,
    bankId = business.bankId,
    risk = business.risk,
    basePayout = business.basePayout,
    baseReputation = business.baseReputation,
    baseLoyalty = business.baseLoyalty,
    coords = { x = business.coords.x, y = business.coords.y, z = business.coords.z }
  }
end

local function clientBusiness(business)
  return {
    id = business.id,
    label = business.label,
    building = business.building,
    bankId = business.bankId,
    risk = business.risk,
    basePayout = business.basePayout,
    baseReputation = business.baseReputation,
    baseLoyalty = business.baseLoyalty,
    coords = { x = business.coords.x, y = business.coords.y, z = business.coords.z }
  }
end

local function syncBusinesses(target)
  local out = {}
  for _, business in ipairs(allBusinesses()) do
    out[#out + 1] = clientBusiness(business)
  end
  TriggerClientEvent('rp_business:client:setBusinesses', target or -1, out)
end

local function loadRuntimeBusinesses()
  local raw = LoadResourceFile(GetCurrentResourceName(), runtimeFile)
  if not raw or raw == '' then return end
  local decoded = json.decode(raw)
  if type(decoded) ~= 'table' then return end
  runtimeBusinesses = {}
  for _, business in ipairs(decoded) do
    if type(business) == 'table' and business.id and business.coords then
      runtimeBusinesses[#runtimeBusinesses + 1] = {
        id = business.id,
        label = business.label or business.id,
        building = business.building or 'runtime',
        bankId = business.bankId,
        risk = tonumber(business.risk) or 1,
        basePayout = tonumber(business.basePayout) or 500,
        baseReputation = tonumber(business.baseReputation) or 5,
        baseLoyalty = tonumber(business.baseLoyalty) or 3,
        coords = vector3(tonumber(business.coords.x) or 0.0, tonumber(business.coords.y) or 0.0, tonumber(business.coords.z) or 0.0)
      }
    end
  end
end

local function saveRuntimeBusinesses()
  local out = {}
  for _, business in ipairs(runtimeBusinesses) do
    out[#out + 1] = serializableBusiness(business)
  end
  SaveResourceFile(GetCurrentResourceName(), runtimeFile, json.encode(out), -1)
end

local function bankById(bankId)
  for _, bank in ipairs(Config.Banks) do
    if bank.id == bankId then return bank end
  end
  return nil
end

local function distanceBetween(source, coords)
  local ped = GetPlayerPed(source)
  if not ped or ped == 0 then return 999999.0 end
  return #(GetEntityCoords(ped) - coords)
end

local function canUseAdmin(source)
  return source == 0 or IsPlayerAceAllowed(source, Config.staffAce)
end

local function contractCountFor(source)
  local count = 0
  for _, contract in pairs(activeContracts) do
    if contract.source == source then
      count = count + 1
    end
  end
  return count
end

local function makeContractId(source, businessId, kind)
  return ('%s:%s:%s:%d:%d'):format(source, businessId, kind, os.time(), math.random(1000, 9999))
end

local function statKey(identifier, businessId)
  return ('%s|%s'):format(identifier, businessId)
end

local function ensureMemoryStats(identifier, businessId)
  local key = statKey(identifier, businessId)
  memoryStats[key] = memoryStats[key] or {
    identifier = identifier,
    business_id = businessId,
    reputation = 0,
    loyalty = 0,
    deliveries = 0,
    protections = 0
  }
  return memoryStats[key]
end

local function ox()
  if Config.useOxmysql and exports.oxmysql then
    return exports.oxmysql
  end
  return nil
end

local function fetchStats(identifier, businessId, callback)
  local db = ox()
  if db then
    db:single('SELECT reputation, loyalty, deliveries, protections FROM rp_business_reputation WHERE identifier = ? AND business_id = ?', {
      identifier,
      businessId
    }, function(row)
      callback(row or { reputation = 0, loyalty = 0, deliveries = 0, protections = 0 })
    end)
    return
  end

  callback(ensureMemoryStats(identifier, businessId))
end

local function fetchAllStats(identifier, callback)
  local db = ox()
  if db then
    db:query('SELECT business_id, reputation, loyalty, deliveries, protections FROM rp_business_reputation WHERE identifier = ?', { identifier }, function(rows)
      local out = {}
      for _, row in ipairs(rows or {}) do
        out[row.business_id] = {
          reputation = tonumber(row.reputation) or 0,
          loyalty = tonumber(row.loyalty) or 0,
          deliveries = tonumber(row.deliveries) or 0,
          protections = tonumber(row.protections) or 0
        }
      end
      callback(out)
    end)
    return
  end

  local out = {}
  for _, business in ipairs(allBusinesses()) do
    local stats = ensureMemoryStats(identifier, business.id)
    out[business.id] = {
      reputation = stats.reputation,
      loyalty = stats.loyalty,
      deliveries = stats.deliveries,
      protections = stats.protections
    }
  end
  callback(out)
end

local function mutateStats(identifier, businessId, repDelta, loyaltyDelta, deliveryDelta, protectionDelta)
  local db = ox()
  if db then
    db:insert([[
      INSERT INTO rp_business_reputation (identifier, business_id, reputation, loyalty, deliveries, protections)
      VALUES (?, ?, GREATEST(0, ?), GREATEST(0, ?), ?, ?)
      ON DUPLICATE KEY UPDATE
        reputation = GREATEST(0, reputation + ?),
        loyalty = GREATEST(0, loyalty + ?),
        deliveries = deliveries + ?,
        protections = protections + ?,
        updated_at = CURRENT_TIMESTAMP
    ]], {
      identifier,
      businessId,
      repDelta,
      loyaltyDelta,
      deliveryDelta,
      protectionDelta,
      repDelta,
      loyaltyDelta,
      deliveryDelta,
      protectionDelta
    })
    return
  end

  local stats = ensureMemoryStats(identifier, businessId)
  stats.reputation = math.max(0, (stats.reputation or 0) + repDelta)
  stats.loyalty = math.max(0, (stats.loyalty or 0) + loyaltyDelta)
  stats.deliveries = (stats.deliveries or 0) + deliveryDelta
  stats.protections = (stats.protections or 0) + protectionDelta
end

local function recordRun(contract, status, payout, repDelta, loyaltyDelta)
  local db = ox()
  if not db then return end
  db:insert([[
    INSERT INTO rp_business_runs
      (contract_id, identifier, business_id, kind, status, payout, reputation_delta, loyalty_delta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ]], {
    contract.contractId,
    contract.identifier,
    contract.businessId,
    contract.kind,
    status,
    payout or 0,
    repDelta or 0,
    loyaltyDelta or 0
  })
end

local function syncStats(source)
  fetchAllStats(playerIdentifier(source), function(stats)
    TriggerClientEvent('rp_business:client:setStats', source, stats)
  end)
end

local function startContract(source, businessId, kind)
  local business = businessById(businessId)
  if not business then
    notify(source, 'That business is not configured.')
    return
  end

  if Config.minPoliceOnline > 0 and Config.PoliceCount() < Config.minPoliceOnline then
    notify(source, 'The city is too quiet for business runs right now.')
    return
  end

  if distanceBetween(source, business.coords) > Config.deliveryStartDistance then
    notify(source, 'Move closer to the business.')
    return
  end

  if contractCountFor(source) >= Config.maxActiveContractsPerPlayer then
    notify(source, 'Finish your active business contract first.')
    return
  end

  local now = os.time()
  if lastContractAt[source] and now - lastContractAt[source] < Config.contractCooldownSeconds then
    notify(source, 'This contact needs a minute before another job.')
    return
  end

  local identifier = playerIdentifier(source)
  fetchStats(identifier, business.id, function(stats)
    if kind == 'protection' then
      if (stats.reputation or 0) < Config.protectionRepRequired or (stats.loyalty or 0) < Config.protectionLoyaltyRequired then
        notify(source, ('Protection requires %d reputation and %d loyalty here.'):format(Config.protectionRepRequired, Config.protectionLoyaltyRequired))
        return
      end
    end

    local bank = bankById(business.bankId)
    if kind == 'delivery' and not bank then
      notify(source, 'This business has no valid bank route configured.')
      return
    end

    local contract = {
      contractId = makeContractId(source, business.id, kind),
      source = source,
      identifier = identifier,
      businessId = business.id,
      businessLabel = business.label,
      bankId = business.bankId,
      kind = kind,
      startedAt = now,
      expiresAt = now + (kind == 'delivery' and Config.deliveryTimeoutSeconds or Config.protectTimeoutSeconds),
      completesAt = kind == 'protection' and (now + Config.protectionHoldSeconds) or nil,
      payout = math.floor((business.basePayout or 500) * (1.0 + ((business.risk or 1) * 0.12))),
      reputation = business.baseReputation or 5,
      loyalty = business.baseLoyalty or 3
    }

    activeContracts[contract.contractId] = contract
    lastContractAt[source] = now
    TriggerClientEvent('rp_business:client:setContract', source, {
      contractId = contract.contractId,
      kind = kind,
      businessId = contract.businessId,
      businessLabel = contract.businessLabel,
      bankId = contract.bankId,
      expiresAt = contract.expiresAt
    })

    if kind == 'delivery' then
      notify(source, ('Pick up complete. Deliver %s cash to %s.'):format(business.label, bank.label))
    else
      notify(source, ('Protection started for %s. Stay alive and present until the contract completes.'):format(business.label))
    end
  end)
end

RegisterNetEvent('rp_business:server:startDelivery', function(businessId)
  startContract(source, businessId, 'delivery')
end)

RegisterNetEvent('rp_business:server:startProtection', function(businessId)
  startContract(source, businessId, 'protection')
end)

RegisterNetEvent('rp_business:server:completeDelivery', function(contractId)
  local source = source
  local contract = activeContracts[contractId]
  if not contract or contract.source ~= source or contract.kind ~= 'delivery' then
    notify(source, 'No matching active delivery found.')
    return
  end

  if os.time() > contract.expiresAt then
    activeContracts[contractId] = nil
    mutateStats(contract.identifier, contract.businessId, -Config.reputationLossOnFail, -Config.loyaltyLossOnFail, 0, 0)
    recordRun(contract, 'expired', 0, -Config.reputationLossOnFail, -Config.loyaltyLossOnFail)
    TriggerClientEvent('rp_business:client:clearContract', source)
    syncStats(source)
    notify(source, 'The delivery expired. Reputation and loyalty dropped.')
    return
  end

  local business = businessById(contract.businessId)
  local bank = business and bankById(business.bankId)
  if not bank or distanceBetween(source, bank.coords) > Config.bankDropDistance then
    notify(source, 'You are not at the assigned bank drop.')
    return
  end

  local clean = math.floor(contract.payout * Config.payoutCleanPercent)
  local dirty = math.max(0, contract.payout - clean)
  local reason = ('business delivery: %s'):format(contract.businessLabel)

  if Config.Money.addClean(source, clean, reason) == false then
    notify(source, 'The bank rejected the payout. Contact staff.')
    return
  end
  if dirty > 0 then
    Config.Money.addDirty(source, dirty, reason)
  end

  activeContracts[contractId] = nil
  mutateStats(contract.identifier, contract.businessId, contract.reputation, contract.loyalty, 1, 0)
  recordRun(contract, 'completed', contract.payout, contract.reputation, contract.loyalty)
  TriggerClientEvent('rp_business:client:clearContract', source)
  syncStats(source)
  notify(source, ('Deposited cash. Paid $%d clean and $%d dirty. Reputation +%d, loyalty +%d.'):format(clean, dirty, contract.reputation, contract.loyalty))
end)

RegisterNetEvent('rp_business:server:requestStats', function()
  syncStats(source)
end)

RegisterNetEvent('rp_business:server:requestBusinesses', function()
  syncBusinesses(source)
end)

RegisterCommand('bizcompleteprotect', function(source)
  if source == 0 then
    print('[rp_business_deliveries] bizcompleteprotect is player-only')
    return
  end

  for contractId, contract in pairs(activeContracts) do
    if contract.source == source and contract.kind == 'protection' then
      local business = businessById(contract.businessId)
      local now = os.time()
      if now < (contract.completesAt or 0) then
        notify(source, ('Hold the business for %d more seconds.'):format((contract.completesAt or now) - now))
        return
      end
      if business and distanceBetween(source, business.coords) <= 45.0 and now <= contract.expiresAt then
        local payout = math.floor(contract.payout * Config.protectRewardMultiplier)
        local rep = math.max(1, math.floor(contract.reputation * 0.6))
        local loyalty = math.max(1, math.floor(contract.loyalty * 0.8))
        Config.Money.addClean(source, payout, ('business protection: %s'):format(contract.businessLabel))
        activeContracts[contractId] = nil
        mutateStats(contract.identifier, contract.businessId, rep, loyalty, 0, 1)
        recordRun(contract, 'protected', payout, rep, loyalty)
        TriggerClientEvent('rp_business:client:clearContract', source)
        syncStats(source)
        notify(source, ('Protection honored. Paid $%d. Reputation +%d, loyalty +%d.'):format(payout, rep, loyalty))
        return
      end
    end
  end

  notify(source, 'No protection contract is ready to complete here.')
end, false)

RegisterCommand('bizadmin_add', function(source, args)
  if not canUseAdmin(source) then
    notify(source, 'You are not allowed to use business admin commands.')
    return
  end

  local id = args[1]
  local bankId = args[2]
  local risk = tonumber(args[3] or '')
  local basePayout = tonumber(args[4] or '')
  local labelParts = {}
  for i = 5, #args do labelParts[#labelParts + 1] = args[i] end
  local label = table.concat(labelParts, ' ')

  if not id or not bankById(bankId) or not risk or not basePayout or label == '' then
    local usage = 'usage: /bizadmin_add <id> <bankId> <risk> <basePayout> <label>'
    if source == 0 then print(('[rp_business_deliveries] %s'):format(usage)) else notify(source, usage) end
    return
  end

  if businessById(id) then
    notify(source, 'A business with that id already exists.')
    return
  end

  local ped = GetPlayerPed(source)
  if source == 0 or not ped or ped == 0 then
    print('[rp_business_deliveries] bizadmin_add must be run in-game so the building coordinates are known')
    return
  end

  local coords = GetEntityCoords(ped)
  local business = {
    id = id,
    label = label,
    building = 'admin_created',
    coords = vector3(coords.x, coords.y, coords.z),
    bankId = bankId,
    risk = math.max(1, math.min(5, math.floor(risk))),
    basePayout = math.max(1, math.floor(basePayout)),
    baseReputation = 5,
    baseLoyalty = 3
  }

  runtimeBusinesses[#runtimeBusinesses + 1] = business
  saveRuntimeBusinesses()
  syncBusinesses(-1)
  notify(source, ('Created business %s at your current building.'):format(label))
end, false)

RegisterCommand('bizadmin_stats', function(source, args)
  if not canUseAdmin(source) then
    notify(source, 'You are not allowed to use business admin commands.')
    return
  end

  local target = tonumber(args[1] or '')
  if not target then
    if source == 0 then
      print('[rp_business_deliveries] usage: bizadmin_stats <playerId>')
    else
      notify(source, 'usage: /bizadmin_stats <playerId>')
    end
    return
  end

  fetchAllStats(playerIdentifier(target), function(stats)
    local encoded = json.encode(stats)
    if source == 0 then
      print(('[rp_business_deliveries] stats %s'):format(encoded))
    else
      notify(source, encoded)
    end
  end)
end, false)

CreateThread(function()
  while true do
    Wait(30000)
    local now = os.time()
    for contractId, contract in pairs(activeContracts) do
      if now > contract.expiresAt then
        activeContracts[contractId] = nil
        mutateStats(contract.identifier, contract.businessId, -Config.reputationLossOnFail, -Config.loyaltyLossOnFail, 0, 0)
        recordRun(contract, 'expired', 0, -Config.reputationLossOnFail, -Config.loyaltyLossOnFail)
        TriggerClientEvent('rp_business:client:clearContract', contract.source)
        syncStats(contract.source)
        notify(contract.source, 'Your business contract expired. Reputation and loyalty dropped.')
      end
    end
  end
end)

AddEventHandler('playerDropped', function()
  local dropped = source
  for contractId, contract in pairs(activeContracts) do
    if contract.source == dropped then
      activeContracts[contractId] = nil
      mutateStats(contract.identifier, contract.businessId, -Config.reputationLossOnFail, -Config.loyaltyLossOnFail, 0, 0)
      recordRun(contract, 'dropped', 0, -Config.reputationLossOnFail, -Config.loyaltyLossOnFail)
      logDebug(('cleared contract %s for dropped player %s'):format(contractId, dropped))
    end
  end
end)

math.randomseed(os.time() + #Config.randomSeedSalt)
loadRuntimeBusinesses()
