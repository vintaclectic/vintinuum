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
  playerStats[id] = playerStats[id] or { reputation = 0, loyalty = {}, deliveries = 0, protections = 0, tags = 0, robs = 0, robsFailed = 0, crew = nil, crewName = nil }
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

-- ---------------------------------------------------------------------------
-- TAKEOVER LAYER
-- control[businessId] = {
--   holder = crewId|nil, holderName = string|nil, since = ts, vault = number,
--   claims = { [crewId] = { score, name, updated } }, heat = number
-- }
-- All authority is server side. Nothing below trusts a client value.
-- ---------------------------------------------------------------------------

local control = {}
local crews = {}
local tagCooldowns = {}
local robCooldowns = {}
local eventRates = {}
local controlDirty = false

local function takeoverCfg()
  return BusinessDeliveriesConfig.Takeover or {}
end

local function takeoverEnabled()
  return takeoverCfg().enabled ~= false
end

-- Rate limit every net event this layer adds. A spamming client gains nothing.
local function rateLimited(source, bucket, minIntervalMs)
  local key = tostring(source) .. ':' .. bucket
  local stamp = GetGameTimer()
  local last = eventRates[key]
  if last and (stamp - last) < minIntervalMs then
    return true
  end
  eventRates[key] = stamp
  return false
end

local function clampClaim(value)
  local maxClaim = takeoverCfg().maxClaim or 400
  if value < 0 then return 0 end
  if value > maxClaim then return maxClaim end
  return value
end

local function crewIdFor(source)
  local stats, id = ensureStats(source)
  if type(stats.crew) == 'string' and stats.crew ~= '' then
    -- crews holds the canonical display name so every member of a crew banks
    -- claim under one consistent label, whatever casing they typed.
    return 'crew:' .. stats.crew, crews[stats.crew] or stats.crewName or stats.crew
  end
  return 'solo:' .. id, GetPlayerName(source) or 'Unknown'
end

local function controlFor(businessId)
  control[businessId] = control[businessId] or {
    holder = nil,
    holderName = nil,
    since = 0,
    vault = 0,
    heat = 0,
    claims = {}
  }
  return control[businessId]
end

local function claimEntry(state, crewId, crewName)
  state.claims[crewId] = state.claims[crewId] or { score = 0, name = crewName or crewId, updated = now() }
  if crewName then state.claims[crewId].name = crewName end
  return state.claims[crewId]
end

local function topClaim(state, excludeCrew)
  local bestId, bestEntry = nil, nil
  for crewId, entry in pairs(state.claims) do
    if crewId ~= excludeCrew then
      if not bestEntry or entry.score > bestEntry.score then
        bestId, bestEntry = crewId, entry
      end
    end
  end
  return bestId, bestEntry
end

local function encodeControl()
  local serializable = {}
  for businessId, state in pairs(control) do
    local claims = {}
    for crewId, entry in pairs(state.claims) do
      claims[#claims + 1] = {
        crew = crewId,
        name = entry.name,
        score = entry.score + 0.0,
        updated = entry.updated or 0
      }
    end
    serializable[#serializable + 1] = {
      businessId = businessId,
      holder = state.holder,
      holderName = state.holderName,
      since = state.since or 0,
      vault = state.vault or 0,
      heat = state.heat or 0,
      claims = claims
    }
  end
  return serializable
end

local function saveControl()
  SaveResourceFile(GetCurrentResourceName(), BusinessDeliveriesConfig.ControlFile, json.encode(encodeControl()), -1)
  controlDirty = false
end

local function loadControl()
  control = {}
  local raw = LoadResourceFile(GetCurrentResourceName(), BusinessDeliveriesConfig.ControlFile)
  if not raw or raw == '' then return end

  local saved = json.decode(raw)
  if type(saved) ~= 'table' then return end

  for _, entry in ipairs(saved) do
    if type(entry) == 'table' and type(entry.businessId) == 'string' then
      local state = controlFor(entry.businessId)
      state.holder = type(entry.holder) == 'string' and entry.holder or nil
      state.holderName = type(entry.holderName) == 'string' and entry.holderName or nil
      state.since = tonumber(entry.since) or 0
      state.vault = math.max(0, math.floor(tonumber(entry.vault) or 0))
      state.heat = math.max(0, tonumber(entry.heat) or 0)
      for _, claim in ipairs(entry.claims or {}) do
        if type(claim) == 'table' and type(claim.crew) == 'string' then
          state.claims[claim.crew] = {
            name = type(claim.name) == 'string' and claim.name or claim.crew,
            score = clampClaim(tonumber(claim.score) or 0),
            updated = tonumber(claim.updated) or 0
          }
        end
      end
    end
  end
end

-- Public shape sent to clients: never leaks other crews' raw identifiers beyond
-- what is needed to render legibility.
local function publicControl()
  local out = {}
  for businessId, state in pairs(control) do
    local leaderId, leader = topClaim(state, nil)
    out[businessId] = {
      holder = state.holder,
      holderName = state.holderName,
      since = state.since or 0,
      heat = math.floor(state.heat or 0),
      vault = math.floor(state.vault or 0),
      topCrew = leaderId,
      topCrewName = leader and leader.name or nil,
      topScore = leader and math.floor(leader.score) or 0
    }
  end
  return out
end

local function syncControl(target)
  TriggerClientEvent('rp_business_deliveries:client:syncControl', target or -1, publicControl())
end

local function isHolder(source, businessId)
  local state = control[businessId]
  if not state or not state.holder then return false end
  local crewId = crewIdFor(source)
  return state.holder == crewId
end

-- Contest resolution. Returns true when control flipped.
local function resolveContest(business, actingCrewId, actingCrewName)
  local cfg = takeoverCfg()
  local state = controlFor(business.id)
  local holdThreshold = cfg.claimToHold or 40
  local margin = cfg.contestMargin or 10

  local leaderId, leader = topClaim(state, nil)
  if not leaderId or not leader then return false end

  local previousHolder = state.holder
  local previousName = state.holderName

  if not previousHolder then
    if leader.score >= holdThreshold then
      state.holder = leaderId
      state.holderName = leader.name
      state.since = now()
      controlDirty = true
      saveControl()
      syncControl()
      TriggerClientEvent('rp_business_deliveries:client:controlFlip', -1, business.name, leader.name, nil)
      return true
    end
    return false
  end

  if leaderId == previousHolder then return false end

  local holderEntry = state.claims[previousHolder]
  local holderScore = holderEntry and holderEntry.score or 0
  if leader.score >= holdThreshold and leader.score >= (holderScore + margin) then
    state.holder = leaderId
    state.holderName = leader.name
    state.since = now()
    controlDirty = true
    saveControl()
    syncControl()
    TriggerClientEvent('rp_business_deliveries:client:controlFlip', -1, business.name, leader.name, previousName)
    return true
  end

  return false
end

local function addClaim(source, business, amount, heat)
  local cfg = takeoverCfg()
  local state = controlFor(business.id)
  local crewId, crewName = crewIdFor(source)
  local entry = claimEntry(state, crewId, crewName)

  entry.score = clampClaim(entry.score + (amount or 0))
  entry.updated = now()
  if heat and heat ~= 0 then
    state.heat = math.max(0, (state.heat or 0) + heat)
  end
  controlDirty = true

  local flipped = resolveContest(business, crewId, crewName)
  if not flipped then
    syncControl()
  end
  return entry.score, flipped
end

local function removeClaim(state, crewId, amount)
  local entry = state.claims[crewId]
  if not entry then return 0 end
  entry.score = clampClaim(entry.score - (amount or 0))
  entry.updated = now()
  controlDirty = true
  return entry.score
end

-- Control aware skim. Returns the amount actually paid to the runner after the
-- controlling crew takes its cut, plus the skimmed amount banked in the vault.
local function applyControlCut(source, business, amount)
  local cfg = takeoverCfg()
  if not takeoverEnabled() then return amount, 0, false end

  local state = control[business.id]
  if not state or not state.holder then
    return amount, 0, false
  end

  if isHolder(source, business.id) then
    local bonus = math.floor(amount * (cfg.holderPayoutBonusPercent or 0))
    return amount + bonus, 0, true
  end

  local cut = math.floor(amount * (cfg.controlCutPercent or 0))
  if cut < 0 then cut = 0 end
  if cut > amount then cut = amount end
  state.vault = math.floor((state.vault or 0) + cut)
  controlDirty = true
  return amount - cut, cut, false
end

RegisterNetEvent('rp_business_deliveries:server:requestSync', function()
  local source = source
  syncBusinesses(source)
  syncControl(source)
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
  local gross, account = payoutFor(stats, business.id)
  -- Criterion 5: whoever controls the business takes their cut before the runner
  -- is paid, and the controlling crew is paid a premium on their own turf.
  local amount, cut, runnerHolds = applyControlCut(source, business, gross)
  if not BusinessDeliveriesConfig.AddMoney(source, amount, account) then
    notify(source, 'Payment adapter rejected the payout.', 'error')
    return
  end

  stats.reputation = stats.reputation + BusinessDeliveriesConfig.Progression.reputationPerDelivery
  stats.loyalty[business.id] = (stats.loyalty[business.id] or 0) + BusinessDeliveriesConfig.Progression.loyaltyPerDelivery
  stats.deliveries = stats.deliveries + 1

  -- Repping: working a business quietly builds your crew's claim on it.
  if takeoverEnabled() then
    addClaim(source, business, takeoverCfg().claimPerDelivery or 5, 0)
    saveControl()
  end

  TriggerClientEvent('rp_business_deliveries:client:updateStats', source, stats)
  notify(source, ('Delivered for %s: $%s %s, reputation +%s, loyalty +%s.'):format(
    business.name,
    amount,
    account,
    BusinessDeliveriesConfig.Progression.reputationPerDelivery,
    BusinessDeliveriesConfig.Progression.loyaltyPerDelivery
  ), 'success')

  if cut > 0 then
    local state = control[business.id]
    notify(source, ('%s skimmed $%s off that run.'):format(
      (state and state.holderName) or 'The controlling crew', cut
    ), 'error')
  elseif runnerHolds then
    notify(source, ('Your crew controls %s. Home turf bonus applied.'):format(business.name), 'success')
  end
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

  -- Criterion 5: protection pays for the crew that actually holds the block.
  local takeover = takeoverCfg()
  local state = takeoverEnabled() and control[business.id] or nil
  local holds = state and state.holder and isHolder(source, business.id) or false
  local reward = prog.protectionReward

  if state and state.holder then
    if holds then
      reward = math.floor(reward * (1.0 + (takeover.holderProtectionBonusPercent or 0)))
    else
      if takeover.outsiderProtectionBlocked then
        notify(source, ('%s runs protection on this block. Take it from them first.'):format(state.holderName or 'A rival crew'), 'error')
        return
      end
      reward = math.floor(reward * (1.0 - (takeover.outsiderProtectionPenaltyPercent or 0)))
      if reward < 0 then reward = 0 end
    end
  end

  protectionCooldowns[key] = now() + prog.protectionCooldownSeconds
  stats.protections = stats.protections + 1
  stats.reputation = stats.reputation + 2
  BusinessDeliveriesConfig.AddMoney(source, reward, 'cash')

  if takeoverEnabled() then
    addClaim(source, business, takeover.claimPerProtection or 8, 0)
    saveControl()
  end

  TriggerClientEvent('rp_business_deliveries:client:updateStats', source, stats)
  if holds then
    notify(source, ('You held down %s for your crew. Reputation +2, cash +$%s.'):format(business.name, reward), 'success')
  else
    notify(source, ('You protected %s. Reputation +2, cash +$%s.'):format(business.name, reward), 'success')
  end
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
  notify(source, ('Reputation %s, deliveries %s, protections %s, tags %s, robs %s.'):format(
    stats.reputation, stats.deliveries, stats.protections, stats.tags or 0, stats.robs or 0
  ), 'info')
  if stats.crew then
    notify(source, ('Crew: %s.'):format(stats.crewName or stats.crew), 'info')
  end
end)

AddEventHandler('playerDropped', function()
  local source = source
  activeRuns[source] = nil
  for key in pairs(eventRates) do
    if key:sub(1, #tostring(source) + 1) == (tostring(source) .. ':') then
      eventRates[key] = nil
    end
  end
end)

CreateThread(function()
  loadBusinesses()
  -- Criterion 4: control state is restored alongside businesses.json on start.
  loadControl()
  syncControl()
end)

-- ---------------------------------------------------------------------------
-- TAKEOVER NET EVENTS
-- Every handler re-validates: business exists, takeover enabled, rate limit,
-- server side distance from the real ped, cooldown, and eligibility.
-- ---------------------------------------------------------------------------

RegisterNetEvent('rp_business_deliveries:server:tagBusiness', function(businessId)
  local source = source
  if not takeoverEnabled() then return end
  if rateLimited(source, 'tag', 2000) then return end

  local business = businessById(businessId)
  if not business then
    notify(source, 'That business is not available.', 'error')
    return
  end

  local ped = GetPlayerPed(source)
  if not ped or ped == 0 or distance(GetEntityCoords(ped), business.coords) > 8.0 then
    notify(source, 'You are too far from the business to tag it.', 'error')
    return
  end

  local cfg = takeoverCfg()
  local _, id = ensureStats(source)
  local key = id .. ':' .. business.id
  if tagCooldowns[key] and tagCooldowns[key] > now() then
    notify(source, ('You can tag %s again in %s seconds.'):format(business.name, tagCooldowns[key] - now()), 'error')
    return
  end

  tagCooldowns[key] = now() + (cfg.tagCooldownSeconds or 180)

  local score, flipped = addClaim(source, business, cfg.tagClaim or 12, cfg.tagHeat or 6)
  local stats = ensureStats(source)
  stats.tags = (stats.tags or 0) + 1
  TriggerClientEvent('rp_business_deliveries:client:updateStats', source, stats)

  if flipped then
    notify(source, ('You tagged %s and took control. Claim %s.'):format(business.name, math.floor(score)), 'success')
  else
    notify(source, ('You tagged %s. Claim %s / %s to hold.'):format(business.name, math.floor(score), cfg.claimToHold or 40), 'info')
  end
end)

RegisterNetEvent('rp_business_deliveries:server:robBusiness', function(businessId)
  local source = source
  if not takeoverEnabled() then return end
  if rateLimited(source, 'rob', 3000) then return end

  local business = businessById(businessId)
  if not business then
    notify(source, 'That business is not available.', 'error')
    return
  end

  local ped = GetPlayerPed(source)
  if not ped or ped == 0 or distance(GetEntityCoords(ped), business.coords) > 8.0 then
    notify(source, 'You are too far from the business to rob it.', 'error')
    return
  end

  local cfg = takeoverCfg()
  local stats, id = ensureStats(source)

  if stats.reputation < (cfg.robMinReputation or 0) then
    notify(source, 'You are too green on the street to try that.', 'error')
    return
  end

  local state = controlFor(business.id)

  if cfg.robRequiresControlled and not state.holder then
    notify(source, 'Nobody controls this business yet. Tag it instead.', 'error')
    return
  end

  if state.holder and isHolder(source, business.id) then
    notify(source, 'You already control this business.', 'error')
    return
  end

  local key = id .. ':' .. business.id
  if robCooldowns[key] and robCooldowns[key] > now() then
    notify(source, ('Too hot. Try robbing %s again in %s seconds.'):format(business.name, robCooldowns[key] - now()), 'error')
    return
  end

  robCooldowns[key] = now() + (cfg.robCooldownSeconds or 900)

  local odds = (cfg.robBaseSuccess or 0.55) + ((state.heat or 0) * (cfg.robSuccessPerHeatPoint or 0))
  local floorOdds = cfg.robSuccessFloor or 0.15
  if odds < floorOdds then odds = floorOdds end
  if odds > 0.95 then odds = 0.95 end

  state.heat = math.max(0, (state.heat or 0) + (cfg.robHeat or 25))
  controlDirty = true

  if math.random() > odds then
    local crewId = crewIdFor(source)
    removeClaim(state, crewId, cfg.robFailClaimLoss or 15)
    stats.robsFailed = (stats.robsFailed or 0) + 1
    saveControl()
    syncControl()
    TriggerClientEvent('rp_business_deliveries:client:updateStats', source, stats)
    notify(source, ('The rob on %s went wrong. You lost ground and drew heat.'):format(business.name), 'error')
    if state.holder then
      TriggerClientEvent('rp_business_deliveries:client:controlAlert', -1, business.name, ('A rob on %s failed.'):format(business.name))
    end
    return
  end

  local payout = math.random(cfg.robPayoutMin or 900, cfg.robPayoutMax or 2100)
  BusinessDeliveriesConfig.AddMoney(source, payout, 'dirty_money')

  if state.holder then
    removeClaim(state, state.holder, cfg.robHolderClaimLoss or 22)
  end

  stats.robs = (stats.robs or 0) + 1
  stats.reputation = stats.reputation + 3

  local score, flipped = addClaim(source, business, cfg.robClaimGain or 30, 0)
  saveControl()
  TriggerClientEvent('rp_business_deliveries:client:updateStats', source, stats)

  if flipped then
    notify(source, ('You robbed %s and seized control. Dirty money +$%s.'):format(business.name, payout), 'success')
  else
    notify(source, ('You robbed %s for $%s dirty. Claim %s / %s to hold.'):format(business.name, payout, math.floor(score), cfg.claimToHold or 40), 'success')
  end

  TriggerClientEvent('rp_business_deliveries:client:controlAlert', -1, business.name, ('%s was robbed.'):format(business.name))
end)

RegisterNetEvent('rp_business_deliveries:server:requestControlSync', function()
  local source = source
  if rateLimited(source, 'controlsync', 2000) then return end
  syncControl(source)
end)

-- ---------------------------------------------------------------------------
-- TAKEOVER COMMANDS
-- ---------------------------------------------------------------------------

RegisterCommand('bizcrew', function(source, args)
  if source == 0 then return end
  local stats = ensureStats(source)
  local name = table.concat(args, ' ')

  if name == '' then
    if stats.crew then
      notify(source, ('You run with crew "%s". Use /bizcrew clear to go solo.'):format(stats.crewName or stats.crew), 'info')
    else
      notify(source, 'You are a crew of one. Usage: /bizcrew <crew name>', 'info')
    end
    return
  end

  if name:lower() == 'clear' then
    stats.crew = nil
    stats.crewName = nil
    notify(source, 'You went solo. Your claims now bank under your own name.', 'info')
    syncControl(source)
    return
  end

  local cfg = takeoverCfg()
  local maxLen = cfg.maxCrewNameLength or 24
  if #name > maxLen then name = name:sub(1, maxLen) end

  stats.crewName = name
  stats.crew = BusinessDeliveries.Slug(name)
  crews[stats.crew] = name
  notify(source, ('You now rep "%s". Claims you build feed the crew pool.'):format(name), 'success')
  TriggerClientEvent('rp_business_deliveries:client:updateStats', source, stats)
  syncControl(source)
end)

RegisterCommand('bizcontrol', function(source, args)
  if source == 0 then return end
  local id = args[1]

  if id and businesses[id] then
    local business = businesses[id]
    local state = control[id]
    if not state or not state.holder then
      notify(source, ('%s is uncontrolled. Tag it to build a claim.'):format(business.name), 'info')
    else
      notify(source, ('%s is held by %s. Vault $%s, heat %s.'):format(
        business.name, state.holderName or state.holder, math.floor(state.vault or 0), math.floor(state.heat or 0)
      ), 'info')
    end
    local leaderId, leader = topClaim(state or controlFor(id), nil)
    if leader then
      notify(source, ('Strongest claim: %s at %s.'):format(leader.name, math.floor(leader.score)), 'info')
    end
    return
  end

  local held = 0
  for _, state in pairs(control) do
    if state.holder then held = held + 1 end
  end
  notify(source, ('%s businesses under crew control. Usage: /bizcontrol <business_id>'):format(held), 'info')
  syncControl(source)
end)

RegisterCommand('bizvault', function(source, args)
  if source == 0 then return end
  local id = args[1]
  local business = id and businessById(id)
  if not business then
    notify(source, 'Usage: /bizvault <business_id>', 'error')
    return
  end

  if not takeoverEnabled() then
    notify(source, 'Takeover is disabled on this server.', 'error')
    return
  end

  if not isHolder(source, business.id) then
    notify(source, 'Only the controlling crew can pull that vault.', 'error')
    return
  end

  local ped = GetPlayerPed(source)
  if not ped or ped == 0 or distance(GetEntityCoords(ped), business.coords) > 8.0 then
    notify(source, 'You must be at the business to pull the vault.', 'error')
    return
  end

  local state = controlFor(business.id)
  local amount = math.floor(state.vault or 0)
  if amount <= 0 then
    notify(source, ('%s vault is empty.'):format(business.name), 'error')
    return
  end

  local cfg = takeoverCfg()
  local paid = math.floor(amount * (cfg.vaultPayoutPercent or 1.0))
  state.vault = 0
  controlDirty = true
  saveControl()
  syncControl()

  BusinessDeliveriesConfig.AddMoney(source, paid, 'dirty_money')
  notify(source, ('You emptied the %s vault for $%s dirty.'):format(business.name, paid), 'success')
end)

RegisterCommand('bizseize', function(source, args)
  if not canAdmin(source) then
    notify(source, 'You cannot manage control.', 'error')
    return
  end

  local id = args[1]
  if not id or not businesses[id] then
    notify(source, 'Usage: /bizseize <business_id> [clear]', 'error')
    return
  end

  local state = controlFor(id)
  state.holder = nil
  state.holderName = nil
  state.since = 0
  state.heat = 0
  state.claims = {}
  controlDirty = true
  saveControl()
  syncControl()
  notify(source, ('Control on %s has been reset.'):format(businesses[id].name), 'success')
end)

-- ---------------------------------------------------------------------------
-- DECAY + AUTOSAVE: an absent holder loses grip.
-- ---------------------------------------------------------------------------

CreateThread(function()
  while true do
    local cfg = takeoverCfg()
    local interval = math.max(10, cfg.decayIntervalSeconds or 120)
    Wait(interval * 1000)

    if takeoverEnabled() then
      for businessId, state in pairs(control) do
        local business = businesses[businessId]
        local changed = false

        for crewId, entry in pairs(state.claims) do
          local rate = (state.holder == crewId) and (cfg.holderDecayPerInterval or 1) or (cfg.decayPerInterval or 2)
          if entry.score > 0 then
            entry.score = clampClaim(entry.score - rate)
            changed = true
          end
          if entry.score <= 0 and state.holder ~= crewId then
            state.claims[crewId] = nil
          end
        end

        if (state.heat or 0) > 0 then
          state.heat = math.max(0, state.heat - (cfg.heatDecayPerInterval or 3))
          changed = true
        end

        if state.holder then
          local holderEntry = state.claims[state.holder]
          local holderScore = holderEntry and holderEntry.score or 0
          if holderScore < (cfg.claimToHold or 40) then
            local lostTo = state.holderName
            state.holder = nil
            state.holderName = nil
            state.since = 0
            changed = true
            if business then
              TriggerClientEvent('rp_business_deliveries:client:controlAlert', -1, business.name,
                ('%s lost their grip on %s.'):format(lostTo or 'A crew', business.name))
            end
          end
        end

        if changed then controlDirty = true end
      end

      if controlDirty then
        saveControl()
        syncControl()
      end
    end
  end
end)

CreateThread(function()
  while true do
    local cfg = takeoverCfg()
    Wait(math.max(30, cfg.autosaveIntervalSeconds or 300) * 1000)
    if controlDirty then saveControl() end
  end
end)

AddEventHandler('onResourceStop', function(resource)
  if resource == GetCurrentResourceName() then
    saveControl()
  end
end)
