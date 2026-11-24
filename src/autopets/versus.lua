local versus = {}

function versus.positive_integer(value)
    return math.type(value) == "integer" and value > 0
end

function versus.player_id(value)
    return (type(value) == "string" and value ~= "") or versus.positive_integer(value)
end

-- Mix the domain into the seed before reducing into the Park–Miller range.
-- Adjacent Park–Miller states would create shifted shop streams.
function versus.stream_seed(seed, domain)
    local mixed = seed ~ domain
    mixed = (mixed ~ (mixed >> 30)) * 0xbf58476d1ce4e5b9
    mixed = (mixed ~ (mixed >> 27)) * 0x94d049bb133111eb
    return mixed ~ (mixed >> 31)
end

function versus.copy(value)
    if type(value) ~= "table" then
        return value
    end
    local result = {}
    for key, field in pairs(value) do
        result[key] = versus.copy(field)
    end
    return result
end

function versus.private_shop(store)
    local state = store:snapshot()
    state.rng_state = nil
    state.next_uid = nil
    return state
end

local actions = {}

function actions.shop(match, seat, request)
    if match.phase ~= "preparation" then
        return nil, "wrong_phase"
    end
    if seat.ready then
        return nil, "already_ready"
    end
    return seat.shop:apply(request.command)
end

function actions.ready(match, seat)
    if match.phase ~= "preparation" then
        return nil, "wrong_phase"
    end
    if seat.ready then
        return nil, "already_ready"
    end
    if #seat.shop.team == 0 then
        return nil, "empty_team"
    end
    seat.ready = true
    return true
end

function actions.next(match, seat)
    if match.phase ~= "settlement" then
        return nil, "wrong_phase"
    end
    if seat.continued then
        return nil, "already_continued"
    end
    seat.continued = true
    return true
end

function actions.forfeit()
    return true
end

-- The caller handles the mode's transition after accepting a seat command.
function versus.accept(match, player, request, now)
    local index = match.seat_by_player[player]
    if not index then
        return nil, "unknown_player"
    end
    if type(request) ~= "table" or not versus.positive_integer(request.round)
        or not versus.positive_integer(request.sequence) or not actions[request.action] then
        return nil, "invalid_request"
    end
    local ok, err = match:tick(now)
    if not ok then
        return nil, err
    end
    if match.phase == "lobby" then
        return nil, "wrong_phase"
    end
    if request.round ~= match.round then
        return nil, "stale_round"
    end
    local seat = match.seats[index]
    if request.sequence <= seat.sequence then
        return nil, "duplicate_request"
    end
    if request.sequence ~= seat.sequence + 1 then
        return nil, "sequence_gap"
    end
    if match.phase == "ended" then
        return nil, "wrong_phase"
    end
    if seat.active == false then
        return nil, "inactive_player"
    end

    local accepted, action_error = actions[request.action](match, seat, request)
    if not accepted then
        return nil, action_error
    end
    seat.sequence = request.sequence
    return seat, index
end

return versus
