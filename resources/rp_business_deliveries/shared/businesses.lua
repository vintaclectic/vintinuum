BusinessDeliveries = BusinessDeliveries or {}

local function copyVec3(v)
  return { x = v.x + 0.0, y = v.y + 0.0, z = v.z + 0.0 }
end

function BusinessDeliveries.NormalizeBusiness(raw)
  if type(raw) ~= 'table' then return nil end
  if type(raw.id) ~= 'string' or raw.id == '' then return nil end
  if type(raw.name) ~= 'string' or raw.name == '' then return nil end
  if not raw.coords then return nil end

  local bank = raw.bank or BusinessDeliveriesConfig.GlobalBankDropoff
  return {
    id = raw.id,
    name = raw.name,
    coords = copyVec3(raw.coords),
    bank = copyVec3(bank),
    faction = raw.faction or 'independent',
    enabled = raw.enabled ~= false
  }
end

function BusinessDeliveries.GetConfiguredBusinesses()
  local businesses = {}
  for _, business in ipairs(BusinessDeliveriesConfig.Businesses or {}) do
    local normalized = BusinessDeliveries.NormalizeBusiness(business)
    if normalized then
      businesses[#businesses + 1] = normalized
    end
  end
  return businesses
end

function BusinessDeliveries.Slug(value)
  value = tostring(value or ''):lower()
  value = value:gsub('[^%w]+', '_'):gsub('^_+', ''):gsub('_+$', '')
  if value == '' then value = 'business' end
  return value
end
