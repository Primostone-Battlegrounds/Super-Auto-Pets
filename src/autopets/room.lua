local battle = require("autopets.battle")
local bot = require("autopets.bot")
local data = require("autopets.data")
local rng = require("autopets.rng")
local shop = require("autopets.shop")
local versus = require("autopets.versus")

local room = {}
room.__index = room
local capacity = 8
local bot_styles = {"guardian", "striker", "swarm"}

local function new_seat(player, index)
    return {player = player, index = index, sequence = 0, wins = 0, byes = 0}
end

local function future(clock, duration)
    return clock + math.min(duration, math.maxinteger - clock)
end

local function phase_deadline(match, duration)
    return match.clock + math.min(duration, match.match_deadline - match.clock)
end

local function shuffled(slots, random)
    for index = #slots, 2, -1 do
        local other = random:int(1, index)
        slots[index], slots[other] = slots[other], slots[index]
    end
    return slots
end

local function active_seats(match)
    local active = {}
    for _, seat in ipairs(match.seats) do
        if seat and seat.active then
            active[#active + 1] = seat
        end
    end
    return active
end

local function better_place(first, second)
    if first.lives ~= second.lives then
        return first.lives > second.lives
    end
    if first.wins ~= second.wins then
        return first.wins > second.wins
    end
    return first.tie_break < second.tie_break
end

local function eliminate(seats, first_place, reason)
    table.sort(seats, better_place)
    for index, seat in ipairs(seats) do
        seat.active = false
        seat.place = first_place + index - 1
        seat.elimination_reason = reason
    end
end

local function end_match(match, active, reason)
    table.sort(active, better_place)
    local champion = table.remove(active, 1)
    champion.place = 1
    eliminate(active, 2, reason)
    match.phase = "ended"
    match.deadline = nil
    match.winner = champion.index
    match.reason = reason
end

local function pair_round(match)
    local candidates = {}
    for _, seat in ipairs(match.round_order) do
        if seat.active then
            seat.opponent = nil
            seat.pairing = nil
            candidates[#candidates + 1] = seat
        end
    end
    if #candidates % 2 == 1 then
        local bye_index = 1
        for index = 2, #candidates do
            if candidates[index].byes < candidates[bye_index].byes then
                bye_index = index
            end
        end
        local bye = table.remove(candidates, bye_index)
        bye.pairing = "bye"
    end
    match.pairs = {}
    for index = 1, #candidates, 2 do
        local left, right = candidates[index], candidates[index + 1]
        left.opponent, right.opponent = right.index, left.index
        left.pairing, right.pairing = "battle", "battle"
        match.pairs[#match.pairs + 1] = {left = left, right = right}
    end
end

local function play_bot(match, seat)
    local actions = 0
    while true do
        local command = bot.choose_action(seat.shop:snapshot(), seat.style, actions, match.bot_difficulty)
        if not command then
            break
        end
        assert(seat.shop:apply(command))
        actions = actions + 1
    end
    assert(#seat.shop.team > 0, "bot finished preparation with an empty team")
    seat.ready = true
end

local function open_round(match)
    local active = active_seats(match)
    match.round = match.round + 1
    for _, seat in ipairs(active) do
        if match.round > 1 then
            assert(seat.shop:advance_round())
        end
        seat.sequence = 0
        seat.ready = false
        seat.continued = false
        seat.outcome = nil
        seat.battle = nil
        seat.battle_error = nil
        if not seat.player then
            play_bot(match, seat)
        end
    end
    match.round_order = shuffled(active, match.pairing_random)
    pair_round(match)
    match.phase = "preparation"
    match.deadline = phase_deadline(match, match.preparation_ms)
end

local function start(match)
    local styles = rng.new(versus.stream_seed(match.seed, 0x424f54)) -- BOT
    local style = styles:int(1, #bot_styles)
    for index, seat in ipairs(match.seats) do
        if not seat then
            seat = new_seat(nil, index)
            seat.style = bot_styles[style]
            style = style % #bot_styles + 1
            match.seats[index] = seat
        end
        seat.shop = shop.new(versus.stream_seed(match.seed, 0x53484f50 + index)) -- SHOP
        seat.lives = match.starting_lives
        seat.active = true
    end
    local precedence = shuffled(active_seats(match), rng.new(versus.stream_seed(match.seed, 0x52414e4b))) -- RANK
    for index, seat in ipairs(precedence) do
        seat.tie_break = index
    end
    match.match_deadline = future(match.clock, match.match_ms)
    open_round(match)
end

local function settle_pair(match, left, right)
    local first = assert(left.shop:finish_turn())
    local second = assert(right.shop:finish_turn())
    local result = battle.resolve(first, second, match.battle_random:next())
    if result.status == "strike_limit" then
        -- Only this pair exceeds the engine limit. Preserve both lives and
        -- finish the round without a battle result for either shop.
        assert(left.shop:abort_turn(result, "player"))
        assert(right.shop:abort_turn(result, "enemy"))
        assert(left.shop:skip_battle())
        assert(right.shop:skip_battle())
        left.battle_error, right.battle_error = result.status, result.status
        left.outcome, right.outcome = "draw", "draw"
        return
    end
    assert(left.shop:record_battle(result, "player"))
    assert(right.shop:record_battle(result, "enemy"))
    left.outcome, right.outcome = left.shop.last_outcome, right.shop.last_outcome
    result.events[1].seed = nil
    local replay = {round = match.round, left = left.index, right = right.index, events = result.events}
    left.battle, right.battle = replay, replay
end

local function resolve_round(match)
    local active = active_seats(match)
    for _, pair in ipairs(match.pairs) do
        settle_pair(match, pair.left, pair.right)
    end
    local eliminated = {}
    for _, seat in ipairs(active) do
        seat.ready = true
        seat.continued = not seat.player
        if seat.pairing == "bye" then
            assert(seat.shop:skip_battle())
            seat.outcome = "bye"
            seat.byes = seat.byes + 1
        elseif seat.outcome == "win" then
            seat.wins = seat.wins + 1
        elseif seat.outcome == "loss" then
            seat.lives = seat.lives - 1
            if seat.lives == 0 then
                eliminated[#eliminated + 1] = seat
            end
        end
    end

    local remaining = #active - #eliminated
    eliminate(eliminated, remaining + 1, "lives_depleted")
    if remaining == 1 then
        end_match(match, active_seats(match), "last_player")
    elseif match.round == match.max_rounds then
        end_match(match, active_seats(match), "round_limit")
    else
        match.phase = "settlement"
        match.deadline = phase_deadline(match, match.settlement_ms)
    end
end

local function all_active(match, field)
    for _, seat in ipairs(match.seats) do
        if seat and seat.active and not seat[field] then
            return false
        end
    end
    return true
end

-- Caller supplies authenticated identities and an integer server clock.
function room.new(seed, options)
    assert(math.type(seed) == "integer", "seed must be a Lua integer")
    options = options or {}
    local match = {
        seed = seed,
        phase = "lobby",
        round = 0,
        revision = 0,
        clock = options.now or 0,
        wait_ms = options.wait_ms or 5000,
        preparation_ms = options.preparation_ms or 60000,
        settlement_ms = options.settlement_ms or 10000,
        match_ms = options.match_ms or 2700000,
        max_rounds = options.max_rounds or 40,
        starting_lives = options.starting_lives or data.rules.start_lives,
        bot_difficulty = options.bot_difficulty or "standard",
        seats = {},
        seat_by_player = {},
        pairing_random = rng.new(versus.stream_seed(seed, 0x50414952)), -- PAIR
        battle_random = rng.new(versus.stream_seed(seed, 0x4649474854)), -- FIGHT
    }
    assert(math.type(match.clock) == "integer" and match.clock >= 0, "invalid room clock")
    assert(math.type(match.wait_ms) == "integer" and match.wait_ms >= 0, "invalid room wait")
    assert(versus.positive_integer(match.preparation_ms) and versus.positive_integer(match.settlement_ms)
        and versus.positive_integer(match.match_ms) and versus.positive_integer(match.max_rounds)
        and versus.positive_integer(match.starting_lives), "room limits must use positive integers")
    assert(match.bot_difficulty == "standard" or match.bot_difficulty == "beginner", "unknown bot difficulty")
    for index = 1, capacity do
        match.seats[index] = false
    end
    return setmetatable(match, room)
end

function room:tick(now)
    if math.type(now) ~= "integer" or now < self.clock then
        return nil, "invalid_clock"
    end
    self.clock = now
    if self.phase == "lobby" and self.deadline and now >= self.deadline then
        start(self)
    elseif self.phase ~= "lobby" and self.phase ~= "ended" and now >= self.match_deadline then
        end_match(self, active_seats(self), "match_timeout")
    elseif self.phase == "preparation" and (now >= self.deadline or all_active(self, "ready")) then
        resolve_round(self)
    elseif self.phase == "settlement" and now >= self.deadline then
        open_round(self)
    else
        return true
    end
    self.revision = self.revision + 1
    return true
end

function room:join(player, now)
    if not versus.player_id(player) then
        return nil, "invalid_player"
    end
    local ok, err = self:tick(now)
    if not ok then
        return nil, err
    end
    local prior = self.seat_by_player[player]
    if prior then
        return prior
    end
    if self.phase ~= "lobby" then
        return nil, "room_started"
    end

    local available, spaces
    spaces = 0
    for index, seat in ipairs(self.seats) do
        if not seat then
            available = available or index
            spaces = spaces + 1
        end
    end
    self.seats[available] = new_seat(player, available)
    self.seat_by_player[player] = available
    self.deadline = self.deadline or future(now, self.wait_ms)
    if spaces == 1 or self.wait_ms == 0 then
        start(self)
    end
    self.revision = self.revision + 1
    return available
end

local function forfeit(match, leaving)
    local active = active_seats(match)
    local remaining = #active - #leaving
    if remaining == 0 then
        end_match(match, active, "all_forfeit")
        return
    end
    eliminate(leaving, remaining + 1, "forfeit")
    if remaining == 1 then
        end_match(match, active_seats(match), "last_player")
    elseif match.phase == "preparation" then
        pair_round(match)
        if all_active(match, "ready") then
            resolve_round(match)
        end
    elseif all_active(match, "continued") then
        open_round(match)
    end
end

local function leave_players(match, players, now, scheduled)
    if type(players) ~= "table" then
        return nil, "invalid_players"
    end
    local selected = {}
    local seen = {}
    for _, player in ipairs(players) do
        local index = match.seat_by_player[player]
        if not index then
            return nil, "unknown_player"
        end
        if seen[index] then
            return nil, "duplicate_player"
        end
        seen[index] = true
        selected[#selected + 1] = match.seats[index]
    end
    if #selected == 0 then
        return nil, "unknown_player"
    end
    if scheduled then
        if math.type(now) ~= "integer" or now < match.clock then
            return nil, "invalid_clock"
        end
        local deadline = match:next_deadline()
        if (deadline and now > deadline) or (match.match_deadline and now >= match.match_deadline) then
            return nil, "phase_due"
        end
        match.clock = now
    else
        local ok, err = match:tick(now)
        if not ok then
            return nil, err
        end
    end
    if match.phase == "lobby" then
        for _, seat in ipairs(selected) do
            match.seats[seat.index] = false
            match.seat_by_player[seat.player] = nil
        end
        if next(match.seat_by_player) == nil then
            match.deadline = nil
        end
    elseif match.phase == "ended" then
        return nil, "wrong_phase"
    else
        local leaving = {}
        for _, seat in ipairs(selected) do
            if seat.active then
                leaving[#leaving + 1] = seat
            end
        end
        if #leaving == 0 then
            return nil, "inactive_player"
        end
        forfeit(match, leaving)
    end
    match.revision = match.revision + 1
    return true
end

function room:leave(player, now)
    return leave_players(self, {player}, now, false)
end

-- The host processes earlier phase deadlines before removing due sessions.
-- At the same timestamp, remove the group before any deadline-triggered combat.
function room:expire_players(players, now)
    return leave_players(self, players, now, true)
end

function room:next_deadline()
    if self.phase == "preparation" and all_active(self, "ready") then
        return self.clock
    end
    return self.deadline
end

function room:request(player, request, now)
    local seat, err = versus.accept(self, player, request, now)
    if not seat then
        return nil, err
    end
    if request.action == "forfeit" then
        forfeit(self, {seat})
    elseif self.phase == "preparation" and all_active(self, "ready") then
        resolve_round(self)
    elseif self.phase == "settlement" and all_active(self, "continued") then
        open_round(self)
    end
    self.revision = self.revision + 1
    return true
end

function room:public_snapshot()
    local state = {
        capacity = capacity,
        phase = self.phase,
        round = self.round,
        revision = self.revision,
        deadline = self.deadline,
        alive_count = 0,
        human_count = 0,
        bot_count = 0,
        seats = {},
        winner = self.winner,
        reason = self.reason,
    }
    for index, seat in ipairs(self.seats) do
        if seat then
            state.seats[#state.seats + 1] = {
                seat = index,
                kind = seat.player and "human" or "bot",
                active = seat.active or false,
                lives = seat.lives,
                wins = seat.wins,
                ready = seat.ready or false,
                continued = seat.continued or false,
                place = seat.place,
                opponent = seat.opponent,
                pairing = seat.pairing,
                outcome = seat.outcome,
                elimination_reason = seat.elimination_reason,
            }
            if seat.player then
                state.human_count = state.human_count + 1
            else
                state.bot_count = state.bot_count + 1
            end
            if seat.active then
                state.alive_count = state.alive_count + 1
            end
        end
    end
    return state
end

function room:snapshot(player)
    local index = self.seat_by_player[player]
    if not index then
        return nil, "unknown_player"
    end
    local seat = self.seats[index]
    local state = self:public_snapshot()
    state.seat = index
    state.next_sequence = seat.sequence + 1
    if seat.shop then
        state.shop = versus.private_shop(seat.shop)
    end
    state.lives = seat.lives
    state.ready = seat.ready or false
    state.continued = seat.continued or false
    state.active = seat.active or false
    state.place = seat.place
    state.opponent = seat.opponent
    state.pairing = seat.pairing
    state.outcome = seat.outcome
    state.battle = versus.copy(seat.battle)
    state.battle_error = seat.battle_error
    return state
end

return room
