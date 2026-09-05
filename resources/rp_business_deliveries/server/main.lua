local businesses = {}
local playerStats = {}
local activeRuns = {}
local cooldowns = {}
local protectionCooldowns = {}

local function now()
  return os.time()
end

local function identifier(source)
  local license = GetPlayerIdentifierByType(source, 'license')
  return license or ('source:' .. tostring(source))
end

local function notify(source, message, kind)
  BusinessDeliveriesConfig.Notify(source, message, kind)
end

local function ensureStats(source)
  local id = identifier(source)
  playerStats[id] = playerStats[id] or { reputation = 0, loyalty = {}, deliveries = 0, protections = 0 }
  return playerStats[id], id
end

local function encodeVec3(v)
  return { x = v.x + 0.0, y = v.y + 0.0, z = v.z + 0.0 }
end

local function decodeBusiness(raw)
  if not raw then return nil end
  raw.coords = vec3(raw.coords.x + 0.0, raw.coords.y + 0.0, raw.coords.z + 0.0)
  raw.bank = vec3(raw.bank.x + 0.0, raw.bank.y + 0.0, raw.bank.z + 0.0)
  return BusinessDeliveries.NormalizeBusiness(raw)
end

local function saveBusinesses()
  local serializable = {}
  for _, business in pairs(businesses) do
    serializable[#serializable + 1] = {
      id = business.id,
      name = business.name,
      coords = encodeVec3(business.coords),
      bank = encodeVec3(business.bank),
      faction = business.faction,
      enabled = business.enabled
    }
  end
  SaveResourceFile(GetCurrentResourceName(), BusinessDeliveriesConfig.SaveFile, json.encode(serializable), -1)
end

local function syncBusinesses(target)
  TriggerClientEvent('rp_business_deliveries:client:syncBusinesses', target or -1, businesses)
end

local function loadBusinesses()
  businesses = {}
  local raw = LoadResourceFile(GetCurrentResourceName(), BusinessDeliveriesConfig.SaveFile)
  if raw and raw ~= '' then
    local saved = json.decode(raw) or {}
    for _, entry in ipairs(saved) do
      local business = decodeBusiness(entry)
      if business then businesses[business.id] = business end
    end
  end

  for _, business in ipairs(BusinessDeliveries.GetConfiguredBusinesses()) do
    businesses[business.id] = businesses[business.id] or business
  end
  saveBusinesses()
end

local function canAdmin(source)
  if source == 0 then return true end
  return IsPlayerAceAllowed(source, BusinessDeliveriesConfig.AdminAce)
end

local function distance(a, b)
  return #(a - b)
end

local function businessById(id)
  if type(id) ~= 'string' then return nil end
  local business = businesses[id]
  if not business or business.enabled == false then return nil end
  return business
end

local function payoutFor(stats, businessId)
  local cfg = BusinessDeliveriesConfig.Payout
  local base = math.random(cfg.min, cfg.max)
  local loyalty = stats.loyalty[businessId] or 0
  local bonus = math.floor(base * ((stats.reputation * cfg.reputationMultiplier) + (loyalty * cfg.loyaltyMultiplier)))
  local account = math.random() <= cfg.dirtyMoneyChance and 'dirty_money' or 'cash'
  return base + bonus, account
end

RegisterNetEvent('rp_business_deliveries:server:requestSync', function()
  syncBusinesses(source)
end)

RegisterNetEvent('rp_business_deliveries:server:startDelivery', function(businessId)
  local source = source
  local business = businessById(businessId)
  if not business then
    notify(source, 'That business is not available.', 'error')
    return
  end

  if activeRuns[source] then
    notify(source, 'Finish the current delivery first.', 'error')
    return
  end

  local ped = GetPlayerPed(source)
  if not ped or ped == 0 or distance(GetEntityCoords(ped), business.coords) > 8.0 then
    notify(source, 'You are too far from the business.', 'error')
    return
  end

  local key = identifier(source) .. ':' .. business.id
  if cooldowns[key] and cooldowns[key] > now() then
    notify(source, ('This business needs %s more seconds before another run.'):format(cooldowns[key] - now()), 'error')
    return
  end

  activeRuns[source] = {
    businessId = business.id,
    startedAt = now(),
    expiresAt = now() + BusinessDeliveriesConfig.DeliveryTimeoutSeconds
  }
  cooldowns[key] = now() + BusinessDeliveriesConfig.CooldownSeconds

  TriggerClientEvent('rp_business_deliveries:client:startDelivery', source, business)
end)

RegisterNetEvent('rp_business_deliveries:server:finishDelivery', function(businessId)
  local source = source
  local run = activeRuns[source]
  local business = businessById(businessId)
  if not run or not business or run.businessId ~= business.id then
    notify(source, 'No matching delivery is active.', 'error')
    return
  end

  activeRuns[source] = nil
  if run.expiresAt < now() then
    notify(source, 'The delivery window expired.', 'error')
    return
  end

  local ped = GetPlayerPed(source)
  if not ped or ped == 0 or distance(GetEntityCoords(ped), business.bank) > 8.0 then
    notify(source, 'You are not at the bank dropoff.', 'error')
    return
  end

  local stats = ensureStats(source)
  local amount, account = payoutFor(stats, business.id)
  if not BusinessDeliveriesConfig.AddMoney(source, amount, account) then
    notify(source, 'Payment adapter rejected the payout.', 'error')
    return
  end

  stats.reputation = stats.reputation + BusinessDeliveriesConfig.Progression.reputationPerDelivery
  stats.loyalty[business.id] = (stats.loyalty[business.id] or 0) + BusinessDeliveriesConfig.Progression.loyaltyPerDelivery
  stats.deliveries = stats.deliveries + 1

  TriggerClientEvent('rp_business_deliveries:client:updateStats', source, stats)
  notify(source, ('Delivered for %s: $%s %s, reputation +%s, loyalty +%s.'):format(
    business.name,
    amount,
    account,
    BusinessDeliveriesConfig.Progression.reputationPerDelivery,
    BusinessDeliveriesConfig.Progression.loyaltyPerDelivery
  ), 'success')
end)

RegisterNetEvent('rp_business_deliveries:server:protectBusiness', function(businessId)
  local source = source
  local business = businessById(businessId)
  if not business then return end

  local stats, id = ensureStats(source)
  local loyalty = stats.loyalty[business.id] or 0
  local prog = BusinessDeliveriesConfig.Progression
  if stats.reputation < prog.protectionUnlockReputation or loyalty < prog.protectionUnlockLoyalty then
    notify(source, 'This business does not trust you enough for protection work.', 'error')
    return
  end

  local key = id .. ':' .. business.id
  if protectionCooldowns[key] and protectionCooldowns[key] > now() then
    notify(source, ('Protection work unlocks again in %s seconds.'):format(protectionCooldowns[key] - now()), 'error')
    return
  end

  protectionCooldowns[key] = now() + prog.protectionCooldownSeconds
  stats.protections = stats.protections + 1
  stats.reputation = stats.reputation + 2
  BusinessDeliveriesConfig.AddMoney(source, prog.protectionReward, 'cash')
  TriggerClientEvent('rp_business_deliveries:client:updateStats', source, stats)
  notify(source, ('You protected %s. Reputation +2, cash +$%s.'):format(business.name, prog.protectionReward), 'success')
end)

RegisterCommand('bizadd', function(source, args)
  if not canAdmin(source) then
    notify(source, 'You cannot manage businesses.', 'error')
    return
  end

  local name = table.concat(args, ' ')
  if name == '' then
    notify(source, 'Usage: /bizadd business name', 'error')
    return
  end

  local ped = GetPlayerPed(source)
  if not ped or ped == 0 then return end

  local id = BusinessDeliveries.Slug(name)
  businesses[id] = {
    id = id,
    name = name,
    coords = GetEntityCoords(ped),
    bank = BusinessDeliveriesConfig.GlobalBankDropoff,
    faction = 'independent',
    enabled = true
  }
  saveBusinesses()
  syncBusinesses()
  notify(source, ('Business added: %s.'):format(name), 'success')
end)

RegisterCommand('bizbank', function(source, args)
  if not canAdmin(source) then return end
  local id = args[1]
  if not id or not businesses[id] then
    notify(source, 'Usage: /bizbank business_id', 'error')
    return
  end

  local ped = GetPlayerPed(source)
  if not ped or ped == 0 then return end
  businesses[id].bank = GetEntityCoords(ped)
  saveBusinesses()
  syncBusinesses()
  notify(source, ('Bank dropoff updated for %s.'):format(businesses[id].name), 'success')
end)

RegisterCommand('biztoggle', function(source, args)
  if not canAdmin(source) then return end
  local id = args[1]
  if not id or not businesses[id] then
    notify(source, 'Usage: /biztoggle business_id', 'error')
    return
  end
  businesses[id].enabled = not businesses[id].enabled
  saveBusinesses()
  syncBusinesses()
  notify(source, ('%s is now %s.'):format(businesses[id].name, businesses[id].enabled and 'enabled' or 'disabled'), 'success')
end)

RegisterCommand('bizstats', function(source)
  local stats = ensureStats(source)
  TriggerClientEvent('rp_business_deliveries:client:updateStats', source, stats)
  notify(source, ('Reputation %s, deliveries %s, protections %s.'):format(stats.reputation, stats.deliveries, stats.protections), 'info')
end)

AddEventHandler('playerDropped', function()
  activeRuns[source] = nil
end)

CreateThread(function()
  loadBusinesses()
end)
