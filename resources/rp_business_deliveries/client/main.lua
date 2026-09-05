local businesses = {}
local activeDelivery = nil
local playerStats = { reputation = 0, loyalty = {}, deliveries = 0, protections = 0, tags = 0, robs = 0 }
local controlState = {}
local tagging = nil

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

-- Control legibility. Drawn in world space directly above the business marker so
-- it occupies its own airspace and can never collide with the single help prompt,
-- which lives in the engine's fixed help-text slot at the top left.
local function drawControlLabel(coords, lines)
  local onScreen, sx, sy = World3dToScreen2d(coords.x, coords.y, coords.z + 1.35)
  if not onScreen then return end

  local widest = 0
  for _, line in ipairs(lines) do
    if #line > widest then widest = #line end
  end

  local lineHeight = 0.022
  local boxHeight = (lineHeight * #lines) + 0.008
  local boxWidth = (widest * 0.0058) + 0.016
  local boxTop = sy - 0.004

  DrawRect(sx, boxTop + (boxHeight / 2.0) - 0.002, boxWidth, boxHeight, 0, 0, 0, 150)

  for index, line in ipairs(lines) do
    SetTextFont(4)
    SetTextScale(0.0, 0.30)
    SetTextcolour(235, 235, 235, 230)
    SetTextCentre(true)
    SetTextEntry('STRING')
    AddTextComponentSubstringPlayerName(line)
    DrawText(sx, boxTop + ((index - 1) * lineHeight))
  end
end

local function controlLinesFor(id, business)
  local state = controlState[id]
  local lines = { business.name }
  if not state then
    lines[#lines + 1] = 'Uncontrolled'
    return lines
  end

  if state.holder and state.holderName then
    lines[#lines + 1] = ('Held by %s'):format(state.holderName)
  elseif state.topCrewName and (state.topScore or 0) > 0 then
    lines[#lines + 1] = ('Contested - %s %s'):format(state.topCrewName, state.topScore)
  else
    lines[#lines + 1] = 'Uncontrolled'
  end

  if (state.heat or 0) > 0 then
    lines[#lines + 1] = ('Heat %s'):format(state.heat)
  end
  return lines
end

-- The tag progress bar owns its own reserved strip at the bottom of the screen.
-- Nothing else in this resource draws below y=0.86, so it cannot overlap.
local function drawTagProgress(label, progress)
  DrawRect(0.5, 0.900, 0.262, 0.052, 0, 0, 0, 170)
  DrawRect(0.5, 0.918, 0.250, 0.012, 60, 60, 60, 200)
  local width = 0.250 * progress
  DrawRect(0.5 - (0.250 - width) / 2.0, 0.918, width, 0.012, 220, 180, 60, 235)

  SetTextFont(4)
  SetTextScale(0.0, 0.34)
  SetTextcolour(235, 235, 235, 235)
  SetTextCentre(true)
  SetTextEntry('STRING')
  AddTextComponentSubstringPlayerName(label)
  DrawText(0.5, 0.884)
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

RegisterNetEvent('rp_business_deliveries:client:syncControl', function(serverControl)
  controlState = serverControl or {}
end)

RegisterNetEvent('rp_business_deliveries:client:controlFlip', function(businessName, newHolder, oldHolder)
  if oldHolder then
    notify(('%s took %s from %s.'):format(newHolder, businessName, oldHolder), 'success')
  else
    notify(('%s claimed %s.'):format(newHolder, businessName), 'success')
  end
end)

RegisterNetEvent('rp_business_deliveries:client:controlAlert', function(_, message)
  notify(message, 'info')
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
  TriggerServerEvent('rp_business_deliveries:server:requestControlSync')
end)

-- Tagging is a timed on-foot action. The server is the only authority on whether
-- the claim lands; this loop is purely the local performance of it.
local function runTag(business)
  if tagging then return end
  local cfg = BusinessDeliveriesConfig.Takeover or {}
  local duration = cfg.tagDurationMs or 6000
  tagging = { id = business.id, startedAt = GetGameTimer() }

  CreateThread(function()
    local ped = PlayerPedId()
    RequestAnimDict('anim@amb@business@bgen@bgen_no_work@')
    local waited = 0
    while not HasAnimDictLoaded('anim@amb@business@bgen@bgen_no_work@') and waited < 1000 do
      Wait(50)
      waited = waited + 50
    end
    if HasAnimDictLoaded('anim@amb@business@bgen@bgen_no_work@') then
      TaskPlayAnim(ped, 'anim@amb@business@bgen@bgen_no_work@', 'idle_a', 4.0, -4.0, -1, 49, 0.0, false, false, false)
    end

    local cancelled = false
    while tagging do
      local elapsed = GetGameTimer() - tagging.startedAt
      local progress = elapsed / duration
      if progress >= 1.0 then break end

      local coords = GetEntityCoords(PlayerPedId())
      if #(coords - business.coords) > BusinessDeliveriesConfig.InteractDistance + 1.5 then
        cancelled = true
        break
      end

      DisableControlAction(0, 24, true)
      DisableControlAction(0, 25, true)
      drawTagProgress(('Tagging %s'):format(business.name), progress)
      Wait(0)
    end

    ClearPedTasks(PlayerPedId())
    tagging = nil

    if cancelled then
      notify('You broke off the tag.', 'error')
      return
    end

    TriggerServerEvent('rp_business_deliveries:server:tagBusiness', business.id)
  end)
end

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

            local state = controlState[id]
            local r, g, b = 220, 180, 60
            if state and state.holder then
              r, g, b = 90, 170, 235
            elseif state and (state.topScore or 0) > 0 then
              r, g, b = 235, 120, 90
            end
            DrawMarker(2, business.coords.x, business.coords.y, business.coords.z + 0.15, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.35, 0.35, 0.35, r, g, b, 160, false, true, 2, false, nil, nil, false)

            -- Control legibility sits in world space above the marker. It never
            -- shares pixels with the help prompt or the tag bar.
            drawControlLabel(business.coords, controlLinesFor(id, business))

            if dist < BusinessDeliveriesConfig.InteractDistance and not tagging then
              local takeover = BusinessDeliveriesConfig.Takeover or {}
              local canTakeover = takeover.enabled ~= false
              local canProtect = protectionUnlocked(id)

              -- NO-COLLISION: exactly one help string is ever composed and drawn.
              -- Actions are joined into that single string, never drawn separately.
              local actions = { ('~INPUT_CONTEXT~ %s delivery'):format(business.name) }
              if canTakeover then
                actions[#actions + 1] = '~INPUT_VEH_HEADLIGHT~ tag turf'
              end
              if canProtect then
                actions[#actions + 1] = '~INPUT_DETONATE~ protection'
              end
              if canTakeover then
                actions[#actions + 1] = '~INPUT_SPRINT~ + ~INPUT_DETONATE~ rob'
              end
              drawHelp('Press ' .. table.concat(actions, '  |  '))

              local robModifier = takeover.robKeyModifier or 21
              local robKey = takeover.robKey or 47
              local tagKey = takeover.tagKey or 74

              if IsControlJustPressed(0, BusinessDeliveriesConfig.InteractKey) then
                TriggerServerEvent('rp_business_deliveries:server:startDelivery', id)
              elseif canTakeover and IsControlJustPressed(0, tagKey) then
                runTag(business)
              elseif canTakeover and IsControlPressed(0, robModifier) and IsControlJustPressed(0, robKey) then
                -- Shift held disambiguates rob from protection on the shared key.
                TriggerServerEvent('rp_business_deliveries:server:robBusiness', id)
              elseif canProtect and IsControlJustPressed(0, robKey) then
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
