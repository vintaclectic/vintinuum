local Config = RPBusinessDeliveriesConfig
local activeContract = nil
local playerStats = {}
local businesses = Config.Businesses
local mapBlips = {}

local function notify(message)
  TriggerEvent('chat:addMessage', {
    args = { 'Business Runs', message }
  })
end

local function distanceTo(coords)
  local ped = PlayerPedId()
  return #(GetEntityCoords(ped) - coords)
end

local function normalizeBusiness(business)
  if business and type(business.coords) == 'table' and not business.coords.x then
    business.coords = vector3(business.coords[1] or 0.0, business.coords[2] or 0.0, business.coords[3] or 0.0)
  elseif business and type(business.coords) == 'table' then
    business.coords = vector3(business.coords.x or 0.0, business.coords.y or 0.0, business.coords.z or 0.0)
  end
  return business
end

local function drawMarkerAt(coords, r, g, b)
  DrawMarker(2, coords.x, coords.y, coords.z + 0.15, 0.0, 0.0, 0.0, 0.0, 180.0, 0.0, 0.35, 0.35, 0.35, r, g, b, 180, false, true, 2, false, nil, nil, false)
end

local function drawTextAt(coords, text)
  SetDrawOrigin(coords.x, coords.y, coords.z + 0.8, 0)
  SetTextScale(0.32, 0.32)
  SetTextFont(4)
  SetTextProportional(1)
  SetTextColour(255, 255, 255, 220)
  SetTextCentre(1)
  BeginTextCommandDisplayText('STRING')
  AddTextComponentSubstringPlayerName(text)
  EndTextCommandDisplayText(0.0, 0.0)
  ClearDrawOrigin()
end

local function bankById(bankId)
  for _, bank in ipairs(Config.Banks) do
    if bank.id == bankId then return bank end
  end
  return Config.Banks[1]
end

local function createBlips()
  for _, blip in ipairs(mapBlips) do
    if DoesBlipExist(blip) then RemoveBlip(blip) end
  end
  mapBlips = {}

  for _, business in ipairs(businesses) do
    local blip = AddBlipForCoord(business.coords.x, business.coords.y, business.coords.z)
    SetBlipSprite(blip, 500)
    SetBlipScale(blip, 0.65)
    SetBlipColour(blip, 2)
    SetBlipAsShortRange(blip, true)
    BeginTextCommandSetBlipName('STRING')
    AddTextComponentString(('Business: %s'):format(business.label))
    EndTextCommandSetBlipName(blip)
    mapBlips[#mapBlips + 1] = blip
  end

  for _, bank in ipairs(Config.Banks) do
    local blip = AddBlipForCoord(bank.coords.x, bank.coords.y, bank.coords.z)
    SetBlipSprite(blip, 108)
    SetBlipScale(blip, 0.65)
    SetBlipColour(blip, 3)
    SetBlipAsShortRange(blip, true)
    BeginTextCommandSetBlipName('STRING')
    AddTextComponentString(bank.label)
    EndTextCommandSetBlipName(blip)
    mapBlips[#mapBlips + 1] = blip
  end
end

RegisterNetEvent('rp_business:client:notify', notify)

RegisterNetEvent('rp_business:client:setStats', function(stats)
  playerStats = stats or {}
end)

RegisterNetEvent('rp_business:client:setBusinesses', function(serverBusinesses)
  businesses = {}
  for _, business in ipairs(serverBusinesses or Config.Businesses) do
    businesses[#businesses + 1] = normalizeBusiness(business)
  end
  createBlips()
end)

RegisterNetEvent('rp_business:client:setContract', function(contract)
  activeContract = contract
  if contract then
    local bank = bankById(contract.bankId)
    notify(('Run started: %s to %s. Use /bizdeliver at the bank.'):format(contract.businessLabel, bank.label))
  end
end)

RegisterNetEvent('rp_business:client:clearContract', function()
  activeContract = nil
end)

RegisterCommand('bizrun', function()
  local closest
  local closestDistance = Config.deliveryStartDistance + 0.01

  for _, business in ipairs(businesses) do
    local dist = distanceTo(business.coords)
    if dist < closestDistance then
      closest = business
      closestDistance = dist
    end
  end

  if not closest then
    notify('Stand at a configured business to start a money delivery.')
    return
  end

  TriggerServerEvent('rp_business:server:startDelivery', closest.id)
end, false)

RegisterCommand('bizdeliver', function()
  if not activeContract or activeContract.kind ~= 'delivery' then
    notify('You do not have an active delivery.')
    return
  end

  local bank = bankById(activeContract.bankId)
  if distanceTo(bank.coords) > Config.bankDropDistance then
    notify(('Deliver this cash to %s.'):format(bank.label))
    return
  end

  TriggerServerEvent('rp_business:server:completeDelivery', activeContract.contractId)
end, false)

RegisterCommand('bizprotect', function()
  local closest
  local closestDistance = Config.deliveryStartDistance + 0.01

  for _, business in ipairs(businesses) do
    local dist = distanceTo(business.coords)
    if dist < closestDistance then
      closest = business
      closestDistance = dist
    end
  end

  if not closest then
    notify('Stand at a configured business to offer protection.')
    return
  end

  TriggerServerEvent('rp_business:server:startProtection', closest.id)
end, false)

RegisterCommand('bizrep', function()
  TriggerServerEvent('rp_business:server:requestStats')
end, false)

CreateThread(function()
  Wait(1000)
  TriggerServerEvent('rp_business:server:requestBusinesses')
  createBlips()
  TriggerServerEvent('rp_business:server:requestStats')
end)

CreateThread(function()
  while true do
    local waitMs = 750

    for _, business in ipairs(businesses) do
      local dist = distanceTo(business.coords)
      if dist <= 20.0 then
        waitMs = 0
        drawMarkerAt(business.coords, 45, 185, 90)
        if dist <= Config.interactionDistance then
          local stats = playerStats[business.id] or { reputation = 0, loyalty = 0 }
          drawTextAt(business.coords, ('%s~n~/bizrun cash delivery | /bizprotect~n~Rep %d  Loyalty %d'):format(business.label, stats.reputation or 0, stats.loyalty or 0))
        end
      end
    end

    if activeContract and activeContract.kind == 'delivery' then
      local bank = bankById(activeContract.bankId)
      local dist = distanceTo(bank.coords)
      if dist <= 40.0 then
        waitMs = 0
        drawMarkerAt(bank.coords, 55, 145, 255)
        if dist <= Config.interactionDistance then
          drawTextAt(bank.coords, ('%s~n~/bizdeliver to deposit %s cash'):format(bank.label, activeContract.businessLabel))
        end
      end
    end

    Wait(waitMs)
  end
end)
