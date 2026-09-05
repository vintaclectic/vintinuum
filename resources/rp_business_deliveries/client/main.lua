local businesses = {}
local activeDelivery = nil
local playerStats = { reputation = 0, loyalty = {}, deliveries = 0, protections = 0 }

local function notify(message, kind)
  BeginTextCommandThefeedPost('STRING')
  AddTextComponentSubstringPlayerName(('[%s] %s'):format(kind or 'info', message))
  EndTextCommandThefeedPostTicker(false, false)
end

local function drawHelp(message)
  BeginTextCommandDisplayHelp('STRING')
  AddTextComponentSubstringPlayerName(message)
  EndTextCommandDisplayHelp(0, false, true, -1)
end

local function asVec3(value)
  return vec3(value.x + 0.0, value.y + 0.0, value.z + 0.0)
end

local function protectionUnlocked(businessId)
  local cfg = BusinessDeliveriesConfig.Progression
  local loyalty = playerStats.loyalty[businessId] or 0
  return playerStats.reputation >= cfg.protectionUnlockReputation and loyalty >= cfg.protectionUnlockLoyalty
end

local function createRouteBlip(coords, label)
  if activeDelivery and activeDelivery.blip then
    RemoveBlip(activeDelivery.blip)
  end

  local blip = AddBlipForCoord(coords.x, coords.y, coords.z)
  SetBlipSprite(blip, 500)
  SetBlipColour(blip, 2)
  SetBlipRoute(blip, true)
  SetBlipRouteColour(blip, 2)
  BeginTextCommandSetBlipName('STRING')
  AddTextComponentString(label)
  EndTextCommandSetBlipName(blip)
  return blip
end

RegisterNetEvent('rp_business_deliveries:client:notify', notify)

RegisterNetEvent('rp_business_deliveries:client:standalonePayout', function(amount, account)
  notify(('Standalone payout recorded: $%s %s. Wire this through Config.AddMoney for production economy.'):format(amount, account), 'success')
end)

RegisterNetEvent('rp_business_deliveries:client:syncBusinesses', function(serverBusinesses)
  businesses = {}
  for id, business in pairs(serverBusinesses or {}) do
    business.coords = asVec3(business.coords)
    business.bank = asVec3(business.bank)
    businesses[id] = business
  end
end)

RegisterNetEvent('rp_business_deliveries:client:updateStats', function(stats)
  playerStats = stats or playerStats
end)

RegisterNetEvent('rp_business_deliveries:client:startDelivery', function(business)
  business.coords = asVec3(business.coords)
  business.bank = asVec3(business.bank)
  activeDelivery = {
    business = business,
    blip = createRouteBlip(business.bank, business.name .. ' bank dropoff')
  }
  notify(('Take %s money to the marked bank.'):format(business.name), 'info')
end)

CreateThread(function()
  Wait(1000)
  TriggerServerEvent('rp_business_deliveries:server:requestSync')
end)

CreateThread(function()
  while true do
    local sleep = 750
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)

    if activeDelivery then
      local bank = activeDelivery.business.bank
      local dist = #(coords - bank)
      if dist < BusinessDeliveriesConfig.MarkerDistance then
        sleep = 0
        DrawMarker(1, bank.x, bank.y, bank.z - 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 2.4, 2.4, 0.65, 40, 220, 120, 150, false, false, 2, false, nil, nil, false)
        if dist < BusinessDeliveriesConfig.InteractDistance then
          drawHelp('Press ~INPUT_CONTEXT~ to deposit business money')
          if IsControlJustPressed(0, BusinessDeliveriesConfig.InteractKey) then
            TriggerServerEvent('rp_business_deliveries:server:finishDelivery', activeDelivery.business.id)
            if activeDelivery.blip then RemoveBlip(activeDelivery.blip) end
            activeDelivery = nil
          end
        end
      end
    else
      for id, business in pairs(businesses) do
        if business.enabled ~= false then
          local dist = #(coords - business.coords)
          if dist < BusinessDeliveriesConfig.MarkerDistance then
            sleep = 0
            DrawMarker(2, business.coords.x, business.coords.y, business.coords.z + 0.15, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.35, 0.35, 0.35, 220, 180, 60, 160, false, true, 2, false, nil, nil, false)
            if dist < BusinessDeliveriesConfig.InteractDistance then
              local prompt = ('Press ~INPUT_CONTEXT~ for %s delivery'):format(business.name)
              if protectionUnlocked(id) then
                prompt = prompt .. ' | Press ~INPUT_DETONATE~ for protection work'
              end
              drawHelp(prompt)
              if IsControlJustPressed(0, BusinessDeliveriesConfig.InteractKey) then
                TriggerServerEvent('rp_business_deliveries:server:startDelivery', id)
              elseif protectionUnlocked(id) and IsControlJustPressed(0, 47) then
                TriggerServerEvent('rp_business_deliveries:server:protectBusiness', id)
              end
            end
          end
        end
      end
    end

    Wait(sleep)
  end
end)
