local connections = require("autopets.connections")
local room = require("autopets.room")

local host = {}
host.__index = host

function host.new(seed, options)
    options = options or {}
    local reconnect_ms = options.reconnect_ms or 15000
    assert(math.type(reconnect_ms) == "integer" and reconnect_ms > 0, "invalid recovery window")
    return setmetatable({
        match = room.new(seed, options),
        seats = {},
        by_connection = {},
        reconnect_ms = reconnect_ms,
        revision = 0,
    }, host)
end

local function expire(self, expires)
    local players = {}
    for _, seat in pairs(self.seats) do
        if seat.expires == expires then
            players[#players + 1] = seat.player
            seat.expires = nil
        end
    end
    local ok, err = self.match:expire_players(players, expires)
    assert(ok or err == "inactive_player", err)
end

local function update(self, now)
    local match = self.match
    if math.type(now) ~= "integer" or now < match.clock then
        return nil, "invalid_clock"
    end

    local prior_revision = match.revision
    while true do
        local phase = match:next_deadline()
        if not phase then
            break
        end
        local expires = connections.next_expiry(self.seats)
        if expires and expires <= now and (expires < phase or (expires == phase and phase ~= match.match_deadline)) then
            expire(self, expires)
        elseif phase <= now then
            assert(match:tick(phase))
        else
            break
        end
    end
    assert(match:tick(now))
    if match.phase == "ended" then
        for _, seat in pairs(self.seats) do
            seat.expires = nil
        end
    end
    return true, prior_revision ~= match.revision
end

-- A nil recipient broadcasts changed public state via per-player frames.
local function publish(self, recipient)
    local updates = {}
    self.revision = self.revision + 1
    for index = 1, #self.match.seats do
        local seat = self.seats[index]
        if seat and seat.connection and (not recipient or recipient == index) then
            local state = assert(self.match:snapshot(seat.player))
            state.host_revision = self.revision
            for _, public in ipairs(state.seats) do
                if public.kind == "human" then
                    local owner = self.seats[public.seat]
                    public.connected = owner ~= nil and owner.connection ~= nil
                end
            end
            updates[#updates + 1] = {connection = seat.connection, state = state}
        end
    end
    return updates
end

-- Only the transport may connect a player whose identity it already verified.
function host:connect(player, now)
    local ok, changed = update(self, now)
    if not ok then
        return nil, changed
    end
    local index, err = self.match:join(player, now)
    if not index then
        return nil, err, changed and publish(self) or {}
    end
    local seat = self.seats[index] or {player = player}
    self.seats[index] = seat
    return connections.attach(self.by_connection, seat, index), publish(self)
end

local function depart(self, connection, now, forfeit)
    local index = self.by_connection[connection]
    if not index then
        return nil, "unknown_connection"
    end
    local ok, err = update(self, now)
    if not ok then
        return nil, err
    end
    local seat, match = self.seats[index], self.match
    connections.detach(self.by_connection, seat)
    if match.phase == "lobby" then
        assert(match:leave(seat.player, now))
        self.seats[index] = nil
    elseif match.phase ~= "ended" and match.seats[index].active then
        if forfeit then
            assert(match:leave(seat.player, now))
        else
            seat.expires = now + math.min(self.reconnect_ms, match.match_deadline - now)
        end
    end
    return true, publish(self)
end

function host:disconnect(connection, now)
    return depart(self, connection, now, false)
end

function host:leave(connection, now)
    return depart(self, connection, now, true)
end

function host:request(connection, request, now)
    local index = self.by_connection[connection]
    if not index then
        return nil, "unknown_connection"
    end
    local ok, changed = update(self, now)
    if not ok then
        return nil, changed
    end
    local prior_revision = self.match.revision
    local accepted, err = self.match:request(self.seats[index].player, request, now)
    local phase_changed = self.match.revision > prior_revision + (accepted and 1 or 0)
    local broadcast = changed or phase_changed or (accepted and request.action ~= "shop")
    if broadcast then
        return accepted, err, publish(self)
    end
    return accepted, err, publish(self, index)
end

function host:tick(now)
    local ok, changed = update(self, now)
    if not ok then
        return nil, changed
    end
    return true, changed and publish(self) or {}
end

function host:next_deadline()
    local phase = self.match:next_deadline()
    if not phase then
        return nil
    end
    return math.min(phase, connections.next_expiry(self.seats) or phase)
end

return host
