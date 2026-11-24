local battle = require("autopets.battle")
local data = require("autopets.data")
local rng = require("autopets.rng")
local shop = require("autopets.shop")

local duel = {}
duel.__index = duel

local function positive_integer(value)
    return math.type(value) == "integer" and value > 0
end

local function player_id(value)
    return (type(value) == "string" and value ~= "") or positive_integer(value)
end

-- Use the SplitMix64 finalizer before reducing each domain to the shop RNG's
-- range. Successive Park–Miller states would create shifted shop streams.
local function stream_seed(seed, domain)
    local mixed = seed ~ domain
    mixed = (mixed ~ (mixed >> 30)) * 0xbf58476d1ce4e5b9
    mixed = (mixed ~ (mixed >> 27)) * 0x94d049bb133111eb
    return mixed ~ (mixed >> 31)
end

local function copy(value)
    if type(value) ~= "table" then
        return value
    end
    local result = {}
    for key, field in pairs(value) do
        result[key] = copy(field)
    end
    return result
end

local function end_match(match, winner, reason)
    match.phase = "ended"
    match.winner = winner
    match.reason = reason
    match.deadline = nil
end

local function phase_deadline(match, duration)
    return match.clock + math.min(duration, match.match_deadline - match.clock)
end

local function open_next_round(match)
    for _, seat in ipairs(match.seats) do
        assert(seat.shop:advance_round())
        seat.sequence = 0
        seat.ready = false
        seat.continued = false
        seat.outcome = nil
    end
    match.round = match.round + 1
    match.phase = "preparation"
    match.deadline = phase_deadline(match, match.preparation_ms)
    match.battle = nil
end

local function resolve_round(match)
    local left, right = match.seats[1], match.seats[2]
    local first = assert(left.shop:finish_turn())
    local second = assert(right.shop:finish_turn())
    local result = battle.resolve(first, second, match.battle_random:next())
    if result.status == "strike_limit" then
        assert(left.shop:abort_turn(result, "player"))
        assert(right.shop:abort_turn(result, "enemy"))
        left.ready = false
        right.ready = false
        match.battle_error = result.status
        match.deadline = phase_deadline(match, match.preparation_ms)
        return
    end

    assert(left.shop:record_battle(result, "player"))
    assert(right.shop:record_battle(result, "enemy"))
    left.outcome = left.shop.last_outcome
    right.outcome = right.shop.last_outcome
    -- Replay the resolved events on both clients. Keep future random draws private.
    match.battle = {round = match.round, events = result.events}
    match.battle.events[1].seed = nil
    match.battle_error = nil

    for index, seat in ipairs(match.seats) do
        if seat.outcome == "loss" then
            seat.lives = seat.lives - 1
            if seat.lives == 0 then
                end_match(match, 3 - index, "lives_depleted")
                return
            end
        end
    end
    match.phase = "settlement"
    match.deadline = phase_deadline(match, match.settlement_ms)
end

-- The room adapter supplies authenticated participant IDs and a monotonic
-- server clock in integer milliseconds. Configuration is chosen by the host.
function duel.new(seed, player_one, player_two, options)
    assert(math.type(seed) == "integer", "seed must be a Lua integer")
    assert(player_id(player_one) and player_id(player_two) and player_one ~= player_two,
        "duel needs two distinct player IDs")
    options = options or {}
    local preparation_ms = options.preparation_ms or 60000
    local settlement_ms = options.settlement_ms or 10000
    local match_ms = options.match_ms or 2700000
    local lives = options.starting_lives or data.rules.start_lives
    local now = options.now or 0
    assert(positive_integer(preparation_ms) and positive_integer(settlement_ms)
        and positive_integer(match_ms) and positive_integer(lives),
        "duel configuration must use positive integers")
    assert(math.type(now) == "integer" and now >= 0 and now <= math.maxinteger - match_ms, "invalid duel clock")

    local seats = {}
    for index = 1, 2 do
        seats[index] = {
            shop = shop.new(stream_seed(seed, 0x53484f50 + index)), -- SHOP
            lives = lives,
            sequence = 0,
            ready = false,
            continued = false,
        }
    end
    return setmetatable({
        seats = seats,
        seat_by_player = {[player_one] = 1, [player_two] = 2},
        battle_random = rng.new(stream_seed(seed, 0x4649474854)), -- FIGHT
        phase = "preparation",
        round = 1,
        revision = 0,
        clock = now,
        preparation_ms = preparation_ms,
        settlement_ms = settlement_ms,
        match_deadline = now + match_ms,
        deadline = now + math.min(preparation_ms, match_ms),
    }, duel)
end

function duel:tick(now)
    if math.type(now) ~= "integer" or now < self.clock then
        return nil, "invalid_clock"
    end
    self.clock = now
    if not self.deadline or now < self.deadline then
        return true
    end
    if now >= self.match_deadline then
        local first, second = self.seats[1].lives, self.seats[2].lives
        local winner
        if first > second then
            winner = 1
        elseif second > first then
            winner = 2
        end
        end_match(self, winner, "match_timeout")
    elseif self.phase == "preparation" then
        self.seats[1].ready = true
        self.seats[2].ready = true
        resolve_round(self)
    else
        open_next_round(self)
    end
    self.revision = self.revision + 1
    return true
end

-- Both transport sessions reached the same recovery deadline. With neither
-- player available to continue, the host closes the match as a draw.
function duel:abandon(now)
    local ok, err = self:tick(now)
    if not ok then
        return nil, err
    end
    if self.phase == "ended" then
        return nil, "wrong_phase"
    end
    end_match(self, nil, "abandoned")
    self.revision = self.revision + 1
    return true
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

function actions.forfeit(match, _seat, _request, index)
    end_match(match, 3 - index, "forfeit")
    return true
end

function duel:request(player, request, now)
    local index = self.seat_by_player[player]
    if not index then
        return nil, "unknown_player"
    end
    if type(request) ~= "table" or not positive_integer(request.round)
        or not positive_integer(request.sequence) or not actions[request.action] then
        return nil, "invalid_request"
    end
    local clock_ok, clock_error = self:tick(now)
    if not clock_ok then
        return nil, clock_error
    end
    if request.round ~= self.round then
        return nil, "stale_round"
    end
    local seat = self.seats[index]
    if request.sequence <= seat.sequence then
        return nil, "duplicate_request"
    end
    if request.sequence ~= seat.sequence + 1 then
        return nil, "sequence_gap"
    end
    if self.phase == "ended" then
        return nil, "wrong_phase"
    end

    local accepted, err = actions[request.action](self, seat, request, index)
    if not accepted then
        return nil, err
    end
    seat.sequence = request.sequence
    if self.phase == "preparation" and self.seats[1].ready and self.seats[2].ready then
        resolve_round(self)
    elseif self.phase == "settlement" and self.seats[1].continued and self.seats[2].continued then
        open_next_round(self)
    end
    self.revision = self.revision + 1
    return true
end

function duel:snapshot(player)
    local index = self.seat_by_player[player]
    if not index then
        return nil, "unknown_player"
    end
    local seat, opponent = self.seats[index], self.seats[3 - index]
    local private_shop = seat.shop:snapshot()
    private_shop.rng_state = nil
    private_shop.next_uid = nil
    return {
        seat = index,
        phase = self.phase,
        round = self.round,
        revision = self.revision,
        deadline = self.deadline,
        next_sequence = seat.sequence + 1,
        shop = private_shop,
        lives = seat.lives,
        opponent_lives = opponent.lives,
        ready = seat.ready,
        opponent_ready = opponent.ready,
        continued = seat.continued,
        opponent_continued = opponent.continued,
        battle = copy(self.battle),
        battle_error = self.battle_error,
        outcome = seat.outcome,
        winner = self.winner,
        reason = self.reason,
    }
end

return duel
