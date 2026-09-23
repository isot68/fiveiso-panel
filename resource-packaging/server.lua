local loaded, clientPayload, leaseUntil = false, nil, 0
local sent = {}
AddEventHandler('fiveiso:license:lease', function(seconds)
 leaseUntil = GetGameTimer() + math.max(0, tonumber(seconds) or 0) * 1000
end)
AddEventHandler('fiveiso:license:load', function(raw)
 if loaded or GetGameTimer() >= leaseUntil then return end
 local payload = json.decode(raw)
 loaded = true
 for _, script in ipairs(payload.serverLua) do
  local chunk, err = load(script.code, '@fiveiso/' .. script.name, 't', _ENV)
  if not chunk then StopResource(GetCurrentResourceName()); error(err) end
  local ok, result = pcall(chunk)
  if not ok then StopResource(GetCurrentResourceName()); error(result) end
 end
 clientPayload = json.encode({ lua = payload.clientLua, nui = payload.nui })
end)
RegisterNetEvent('fiveiso:license:client', function()
 local player = source
 if not player or player <= 0 or not GetPlayerName(player) or not clientPayload or GetGameTimer() >= leaseUntil then return end
 local now = GetGameTimer()
 if sent[player] and now - sent[player] < 10000 then return end
 sent[player] = now
 TriggerLatentClientEvent('fiveiso:license:clientPayload', player, 512000, clientPayload)
end)
AddEventHandler('playerDropped', function() sent[source] = nil end)
