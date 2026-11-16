-- One atomic state transition. Redis owns the clock; no client clock decides leases.
local key = KEYS[1]
local op = ARGV[1]
local a = cjson.decode(ARGV[2])
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local s = cjson.decode(redis.call('GET', key) or '{"workers":{},"rooms":{}}')
local function fail(code) return cjson.encode({error=code}) end
local function save(value)
  redis.call('SET', key, cjson.encode(s))
  return cjson.encode(value)
end
-- Reservations have a hard deadline. Active rooms survive brief coordinator loss,
-- but are never reassigned to another process (incarnation fencing).
for code,r in pairs(s.rooms) do
  if (not r.active and r.expires <= now) or (r.retireAt and r.retireAt <= now) then s.rooms[code] = nil end
end
if op == 'heartbeat' then
  local old = s.workers[a.id]
  if old and old.boot ~= a.boot then
    for _,retired in ipairs(old.retired or {}) do if retired == a.boot then return fail('ACTIVE') end end
    if now-old.seen < 15000 then return fail('ACTIVE') end
    old.retired = old.retired or {}
    table.insert(old.retired, old.boot)
    for code,r in pairs(s.rooms) do if r.worker == a.id then r.tombstone = true; r.expires = 0 end end
  end
  s.workers[a.id] = {boot=a.boot, seen=now, capacity=a.capacity, draining=a.draining, load=a.load, retired=old and old.retired or {}}
  local active = {}
  for _,code in ipairs(a.rooms) do active[code] = true end
  for code,r in pairs(s.rooms) do
    if r.worker == a.id and r.boot == a.boot and r.active and not r.tombstone then
      if active[code] then r.expires = now + 45000; r.retireAt = now + 10800000
      elseif now - r.activated > 10000 then r.tombstone = true; r.expires = 0 end
    end
  end
  return save({ok=true})
end
if op == 'reserve' then
  if s.rooms[a.code] then return fail('COLLISION') end
  local selected = nil
  local score = math.huge
  for id,w in pairs(s.workers) do
    local count = 0
    for _,r in pairs(s.rooms) do if r.worker == id and not r.tombstone then count = count + 1 end end
    if now - w.seen < 15000 and not w.draining and w.capacity > count and w.load < 1 then
      local n = count / w.capacity + w.load
      if n < score then selected = id; score = n end
    end
  end
  if not selected then return fail('UNAVAILABLE') end
  local w = s.workers[selected]
  s.rooms[a.code] = {worker=selected, boot=w.boot, token=a.token, expires=now+15000, active=false}
  return save({worker=selected, code=a.code, token=a.token})
end
if op == 'activate' then
  local r = s.rooms[a.code]
  local w = s.workers[a.id]
  if not r or not w or r.worker ~= a.id or r.boot ~= a.boot or r.token ~= a.token or r.active or w.draining or now-w.seen >= 15000 then return fail('UNAVAILABLE') end
  r.active = true; r.retireAt = now+10800000; r.activated = now; r.expires = now+45000; r.token = ''
  return save({ok=true})
end
if op == 'lookup' then
  local r = s.rooms[a.code]
  if not r or not r.active or r.tombstone then return fail('NOT_FOUND') end
  if r.expires <= now then return fail('UNAVAILABLE') end
  local w = s.workers[r.worker]
  if not w or w.boot ~= r.boot or now-w.seen >= 15000 then return fail('UNAVAILABLE') end
  return save({worker=r.worker, code=a.code})
end
return fail('INVALID')
