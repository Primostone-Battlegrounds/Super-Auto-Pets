local battle = require("autopets.battle")
local data = require("autopets.data")
local rng = require("autopets.rng")
local shop = require("autopets.shop")
local versus = require("autopets.versus")

local duel = {}
duel.__index = duel

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
    local result = battle.resolve(first, second, match.battle_random:next(), match.catalog)
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
    assert(versus.player_id(player_one) and versus.player_id(player_two) and player_one ~= player_two,
        "duel needs two distinct player IDs")
    options = options or {}
    local catalog = options.catalog or data
    local preparation_ms = options.preparation_ms or 60000
    local settlement_ms = options.settlement_ms or 10000
    local match_ms = options.match_ms or 2700000
    local lives = options.starting_lives or catalog.rules.start_lives
    local now = options.now or 0
    assert(versus.positive_integer(preparation_ms) and versus.positive_integer(settlement_ms)
        and versus.positive_integer(match_ms) and versus.positive_integer(lives),
        "duel configuration must use positive integers")
    assert(math.type(now) == "integer" and now >= 0 and now <= math.maxinteger - match_ms, "invalid duel clock")

    local seats = {}
    for index = 1, 2 do
        seats[index] = {
            shop = shop.new(versus.stream_seed(seed, 0x53484f50 + index), catalog), -- SHOP
            lives = lives,
            sequence = 0,
            ready = false,
            continued = false,
        }
    end
    return setmetatable({
        seats = seats,
        catalog = catalog,
        seat_by_player = {[player_one] = 1, [player_two] = 2},
        battle_random = rng.new(versus.stream_seed(seed, 0x4649474854)), -- FIGHT
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

function duel:request(player, request, now)
    local seat, index_or_error = versus.accept(self, player, request, now)
    if not seat then
        return nil, index_or_error
    end
    if request.action == "forfeit" then
        end_match(self, 3 - index_or_error, "forfeit")
    elseif self.phase == "preparation" and self.seats[1].ready and self.seats[2].ready then
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
    return {
        seat = index,
        phase = self.phase,
        round = self.round,
        revision = self.revision,
        deadline = self.deadline,
        next_sequence = seat.sequence + 1,
        shop = versus.private_shop(seat.shop),
        lives = seat.lives,
        opponent_lives = opponent.lives,
        ready = seat.ready,
        opponent_ready = opponent.ready,
        continued = seat.continued,
        opponent_continued = opponent.continued,
        battle = versus.copy(self.battle),
        battle_error = self.battle_error,
        outcome = seat.outcome,
        winner = self.winner,
        reason = self.reason,
    }
end

return duel
