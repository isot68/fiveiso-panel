local loaded, nui, ready = false, nil, false
RegisterNUICallback('fiveisoBootReady', function(_, cb)
 ready = true
 if nui then SendNUIMessage({ fiveisoBoot = nui }) end
 cb({ ok = true })
end)
RegisterNetEvent('fiveiso:license:clientPayload', function(raw)
 if source ~= 65535 or loaded or type(raw) ~= 'string' then return end
 local payload = json.decode(raw)
 if type(payload) ~= 'table' or type(payload.lua) ~= 'table' or type(payload.nui) ~= 'string' then return end
 loaded = true
 for _, script in ipairs(payload.lua) do
  local chunk, err = load(script.code, '@fiveiso/' .. script.name, 't', _ENV)
  if not chunk then error(err) end
  chunk()
 end
 nui = payload.nui
 if ready then SendNUIMessage({ fiveisoBoot = nui }) end
end)
CreateThread(function()
 while not loaded do
  TriggerServerEvent('fiveiso:license:client')
  Wait(15000)
 end
end)
