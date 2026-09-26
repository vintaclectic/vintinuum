local Config = {
  vendor = GetConvar('dirzombie_anticheat_vendor', 'fiveguard'),
  resource = GetConvar('dirzombie_anticheat_resource', 'fiveguard'),
  staffAce = GetConvar('dirzombie_anticheat_staff_ace', 'dirzombie.anticheat.staff'),
  stagingMode = GetConvar('dirzombie_anticheat_staging_mode', 'false') == 'true'
}

local function consoleOrAceAllowed(source)
  return source == 0 or IsPlayerAceAllowed(source, Config.staffAce)
end

local function deny(source)
  if source == 0 then
    print('[dirzombie_anticheat] denied: console should not be denied; check ACE config')
  else
    TriggerClientEvent('chat:addMessage', source, {
      args = { 'DirZombie AC', 'You are not allowed to use this command.' }
    })
  end
end

local function reply(source, message)
  if source == 0 then
    print(('[dirzombie_anticheat] %s'):format(message))
  else
    TriggerClientEvent('chat:addMessage', source, {
      args = { 'DirZombie AC', message }
    })
  end
end

local function joinArgs(args, startIndex)
  local out = {}
  for i = startIndex, #args do
    out[#out + 1] = args[i]
  end
  return table.concat(out, ' ')
end

local function vendorExport()
  local resourceState = GetResourceState(Config.resource)
  if resourceState ~= 'started' then
    return nil, ('%s resource is %s, expected started'):format(Config.resource, resourceState)
  end

  return exports[Config.resource], nil
end

local function recordFalsePositiveReview(banId, outcome, notes, reviewer)
  print(('[dirzombie_anticheat] false-positive review banId=%s outcome=%s reviewer=%s notes=%s'):format(
    tostring(banId),
    tostring(outcome),
    tostring(reviewer),
    tostring(notes)
  ))
end

RegisterCommand('dzac_ban', function(source, args)
  if not consoleOrAceAllowed(source) then return deny(source) end

  local target = tonumber(args[1] or '')
  local reason = joinArgs(args, 2)
  if not target or reason == '' then
    return reply(source, 'usage: dzac_ban <playerId> <reason>')
  end

  local ac, err = vendorExport()
  if not ac then return reply(source, err) end

  ac:fg_BanPlayer(target, ('DirZombie staff ban: %s'):format(reason), true)
  reply(source, ('ban sent to %s for player %d'):format(Config.vendor, target))
end, false)

RegisterCommand('dzac_unban', function(source, args)
  if not consoleOrAceAllowed(source) then return deny(source) end

  local banId = tonumber(args[1] or '')
  local reason = joinArgs(args, 2)
  if not banId or reason == '' then
    return reply(source, 'usage: dzac_unban <banId> <reason>')
  end

  local ac, err = vendorExport()
  if not ac then return reply(source, err) end

  local result = ac:UnbanId(banId)
  if result then
    reply(source, ('unbanned banId %d: %s'):format(banId, reason))
  else
    reply(source, ('unban failed or banId not found: %d'):format(banId))
  end
end, false)

RegisterCommand('dzac_check', function(source, args)
  if not consoleOrAceAllowed(source) then return deny(source) end

  local banId = tonumber(args[1] or '')
  if not banId then
    return reply(source, 'usage: dzac_check <banId>')
  end

  local ac, err = vendorExport()
  if not ac then return reply(source, err) end

  local info = ac:GetBanInfoId(banId)
  if info then
    reply(source, ('banId %d exists in %s; inspect FiveGuard panel/logs for full evidence'):format(banId, Config.vendor))
  else
    reply(source, ('banId %d not found in %s'):format(banId, Config.vendor))
  end
end, false)

RegisterCommand('dzac_fp', function(source, args)
  if not consoleOrAceAllowed(source) then return deny(source) end

  local banId = tonumber(args[1] or '')
  local outcome = args[2]
  local notes = joinArgs(args, 3)
  local allowed = outcome == 'uphold' or outcome == 'lift' or outcome == 'watch'
  if not banId or not allowed or notes == '' then
    return reply(source, 'usage: dzac_fp <banId> <uphold|lift|watch> <notes>')
  end

  recordFalsePositiveReview(banId, outcome, notes, source == 0 and 'console' or GetPlayerName(source))
  reply(source, ('false-positive review recorded for banId %d as %s'):format(banId, outcome))
end, false)

RegisterCommand('dzac_testban', function(source, args)
  if not consoleOrAceAllowed(source) then return deny(source) end
  if not Config.stagingMode then
    return reply(source, 'dzac_testban is disabled unless dirzombie_anticheat_staging_mode=true')
  end

  local target = tonumber(args[1] or '')
  if not target then
    return reply(source, 'usage: dzac_testban <playerId>')
  end

  local ac, err = vendorExport()
  if not ac then return reply(source, err) end

  ac:fg_BanPlayer(target, 'DirZombie staging anticheat test ban', true)
  reply(source, ('staging test ban sent to %s for player %d'):format(Config.vendor, target))
end, false)
