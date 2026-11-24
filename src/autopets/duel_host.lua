local duel = require("autopets.duel")

local host = {}
host.__index = host

function host.new(seed, player_one, player_two, options)
    options = options or {}
    local reconnect_ms = options.reconnect_ms or 15000
    assert(math.type(reconnect_ms) == "integer" and reconnect_ms > 0, "invalid recovery window")
    return setmetatable({
        match = duel.new(seed, player_one, player_two, options),
        seats = {{player = player_one}, {player = player_two}},
        by_player = {[player_one] = 1, [player_two] = 2},
        by_connection = {},
        reconnect_ms = reconnect_ms,
        revision = 0,
    }, host)
end

local function recovery_deadline(self)
    local first, second = self.seats[1].expires, self.seats[2].expires
    if first and second then
        return math.min(first, second)
    end
    return first or second
end

local function update(self, now)
    if math.type(now) ~= "integer" or now < self.match.clock then
        return nil, "invalid_clock"
    end
    local old_revision = self.match.revision
    local expires = recovery_deadline(self)
    if expires and expires <= now and self.match.phase ~= "ended" then
        assert(self.match:tick(expires))
        if self.match.phase ~= "ended" then
            local first, second = self.seats[1], self.seats[2]
            if first.expires == second.expires then
                assert(self.match:abandon(expires))
            else
                local expired = first.expires == expires and first or second
                local state = assert(self.match:snapshot(expired.player))
                assert(self.match:request(expired.player, {
                    action = "forfeit", round = state.round, sequence = state.next_sequence,
                }, expires))
            end
        end
    end
    assert(self.match:tick(now))
    if self.match.phase == "ended" then
        for _, seat in ipairs(self.seats) do
            seat.expires = nil
        end
    end
    return true, self.match.revision ~= old_revision
end

local function frames(self, changed, recipient)
    local updates = {}
    if changed then
        self.revision = self.revision + 1
    end
    for index, seat in ipairs(self.seats) do
        if seat.connection and (changed or index == recipient) then
            local state = assert(self.match:snapshot(seat.player))
            state.opponent_connected = self.seats[3 - index].connection ~= nil
            state.host_revision = self.revision
            updates[#updates + 1] = {connection = seat.connection, state = state}
        end
    end
    return updates
end

-- Only the transport may connect an identity it already verified. Each call
-- creates a fresh opaque capability and revokes any earlier connection.
function host:connect(player, now)
    local index = self.by_player[player]
    if not index then
        return nil, "unknown_player"
    end
    local ok, changed = update(self, now)
    if not ok then
        return nil, changed
    end
    local seat = self.seats[index]
    if seat.connection then
        self.by_connection[seat.connection] = nil
    end
    seat.connection = {}
    seat.expires = nil
    self.by_connection[seat.connection] = index
    return seat.connection, frames(self, true)
end

function host:disconnect(connection, now)
    local index = self.by_connection[connection]
    if not index then
        return nil, "unknown_connection"
    end
    local ok, changed = update(self, now)
    if not ok then
        return nil, changed
    end
    local seat = self.seats[index]
    self.by_connection[connection] = nil
    seat.connection = nil
    if self.match.deadline then
        seat.expires = now + math.min(self.reconnect_ms, self.match.match_deadline - now)
    end
    return true, frames(self, true)
end

function host:request(connection, request, now)
    local index = self.by_connection[connection]
    if not index then
        return nil, "unknown_connection"
    end
    local valid, changed = update(self, now)
    if not valid then
        return nil, changed
    end
    local accepted, err = self.match:request(self.seats[index].player, request, now)
    -- An acknowledgement includes the actor's current sequence even when its
    -- request was rejected. Other connections receive only changed state.
    return accepted, err, frames(self, changed or accepted, index)
end

function host:tick(now)
    local ok, changed = update(self, now)
    if not ok then
        return nil, changed
    end
    return true, frames(self, changed)
end

function host:next_deadline()
    local phase = self.match.deadline
    if not phase then
        return nil
    end
    return math.min(phase, recovery_deadline(self) or phase)
end

return host
