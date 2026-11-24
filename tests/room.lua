package.path = "src/?.lua;" .. package.path

local bot = require("autopets.bot")
local data = require("autopets.data")
local room = require("autopets.room")
local shop = require("autopets.shop")
local versus = require("autopets.versus")

local function assert_same(first, second, path)
    path = path or "state"
    if type(first) ~= "table" or type(second) ~= "table" then
        assert(first == second, path .. " differs")
        return
    end
    for key, value in pairs(first) do
        assert_same(value, second[key], path .. "." .. key)
    end
    for key in pairs(second) do
        assert(first[key] ~= nil, path .. " gained " .. key)
    end
end

local function envelope(match, player, action, command)
    local state = assert(match:snapshot(player))
    return {round = state.round, sequence = state.next_sequence, action = action, command = command}
end

local function send(match, player, now, action, command)
    local request = envelope(match, player, action, command)
    assert(match:request(player, request, now))
    return request
end

local function denied(match, player, request, now, expected)
    local before = match:public_snapshot()
    local old_private = match:snapshot(player)
    local accepted, err = match:request(player, request, now)
    assert(not accepted and err == expected, "expected " .. expected .. ", got " .. tostring(err))
    assert_same(before, match:public_snapshot())
    assert_same(old_private, match:snapshot(player))
end

local function assert_final(state)
    assert(state.phase == "ended" and state.alive_count == 1 and state.deadline == nil)
    local places = {}
    for _, seat in ipairs(state.seats) do
        assert(seat.place >= 1 and seat.place <= 8 and not places[seat.place])
        places[seat.place] = seat
        assert(seat.active == (seat.seat == state.winner))
    end
    assert(places[1].seat == state.winner and places[8])
end

local function assert_pairing(state)
    local byes = 0
    for _, seat in ipairs(state.seats) do
        if seat.active and seat.pairing == "battle" then
            local other = state.seats[seat.opponent]
            assert(other.active and other.seat ~= seat.seat and other.opponent == seat.seat)
        elseif seat.active then
            assert(seat.pairing == "bye" and not seat.opponent)
            byes = byes + 1
        end
    end
    assert(byes == state.alive_count % 2)
end

local waiting = room.new(12, {now = 100, wait_ms = 10})
assert(waiting:public_snapshot().phase == "lobby" and not waiting:public_snapshot().deadline)
assert(waiting:tick(101) and waiting:join("first", 105) == 1)
assert(waiting:join("second", 106) == 2 and waiting:join("second", 106) == 2)
assert(waiting:leave("first", 107) and waiting:join("replacement", 109) == 1)
assert(waiting:public_snapshot().deadline == 115)
assert(waiting:leave("second", 109) and waiting:leave("replacement", 109))
assert(not waiting:public_snapshot().deadline and waiting:tick(200))
assert(waiting:join("first", 201) == 1 and waiting:join("second", 210) == 2)
local seat, error_code = waiting:join("too late", 211)
assert(not seat and error_code == "room_started")
assert(waiting:join("second", 211) == 2, "known identity can refresh its snapshot")
local started = waiting:public_snapshot()
assert(started.phase == "preparation" and started.round == 1 and started.alive_count == 8)
assert(started.human_count == 2 and started.bot_count == 6)
assert(not waiting:tick(210))
assert(not waiting:join("", 211))
assert(not waiting:snapshot("too late"))
assert_pairing(started)

local first_shop = assert(waiting:snapshot("first")).shop
local second_shop = assert(waiting:snapshot("second")).shop
assert(#first_shop.team == 0 and #second_shop.team == 0)
assert(not first_shop.rng_state and not first_shop.next_uid)
for _, public in ipairs(started.seats) do
    assert(public.shop == nil and public.player == nil and public.battle == nil)
end
denied(waiting, "intruder", envelope(waiting, "first", "ready"), 211, "unknown_player")
denied(waiting, "first", {round = 1, sequence = 2, action = "ready"}, 211, "sequence_gap")
denied(waiting, "first", {round = 1, sequence = 1, action = false}, 211, "invalid_request")
denied(waiting, "first", envelope(waiting, "first", "ready"), 211, "empty_team")
denied(waiting, "first", envelope(waiting, "first", "shop", {action = "buy", offer = 10}), 211, "missing_offer")
local buy = envelope(waiting, "first", "shop", {action = "buy", offer = 1})
buy.player = "second"
assert(waiting:request("first", buy, 211))
assert_same(second_shop, assert(waiting:snapshot("second")).shop, "unaffected opponent's shop")
assert(assert(waiting:snapshot("first")).shop.gold == data.rules.gold_per_round - data.rules.pet_cost)
denied(waiting, "first", buy, 211, "duplicate_request")
local ready = send(waiting, "first", 211, "ready")
denied(waiting, "first", ready, 211, "duplicate_request")
denied(waiting, "first", envelope(waiting, "first", "shop", {action = "reroll"}), 211, "already_ready")
local mutated = assert(waiting:snapshot("first"))
mutated.shop.team[1].health = -99
mutated.seats[1].lives = -99
assert(assert(waiting:snapshot("first")).shop.team[1].health > 0)
assert(waiting:public_snapshot().seats[1].lives > 0)
assert(waiting:leave("second", 212))
local after_leave = waiting:public_snapshot()
assert(after_leave.alive_count == 7 and after_leave.seats[2].place == 8)
assert(after_leave.seats[2].elimination_reason == "forfeit")
assert(after_leave.phase == "settlement", "the final waiting human left, so ready seats resolved")
denied(waiting, "second", envelope(waiting, "second", "next"), 212, "inactive_player")
local confirm = send(waiting, "first", 212, "next")
assert(waiting:public_snapshot().phase == "preparation" and waiting:public_snapshot().round == 2)
assert(waiting:snapshot("first").next_sequence == 1)
denied(waiting, "first", confirm, 212, "stale_round")

-- Each live AI opens the same empty-team shop as a human and applies the same
-- validated actions. Bots use the match result as their own shop settlement.
local automate = room.new(29, {wait_ms = 0, preparation_ms = 10})
assert(automate:join(1, 0) == 1)
local expected = {}
for index = 2, 8 do
    local seat = automate.seats[index]
    local store = shop.new(versus.stream_seed(29, 0x53484f50 + index))
    assert(#store.team == 0 and store.gold == data.rules.gold_per_round)
    local actions = 0
    while true do
        local command = bot.choose_action(store:snapshot(), seat.style, actions)
        if not command then
            break
        end
        assert(store:apply(command))
        actions = actions + 1
    end
    assert(actions > 0)
    expected[index] = store:snapshot()
    assert_same(seat.shop:snapshot(), expected[index])
end
assert(automate:tick(10))
local bot_battles = 0
for _, pair in ipairs(automate.pairs) do
    local left, right = pair.left, pair.right
    assert(left.battle == right.battle and left.battle.events[1].seed == nil)
    if not left.player and not right.player then
        bot_battles = bot_battles + 1
        local result = left.battle.events[#left.battle.events]
        assert(result.type == "result" and left.shop.last_outcome == result.outcome)
        assert(left.shop.phase == "settlement" and right.shop.phase == "settlement")
    end
end
assert(bot_battles == 3)
for index = 2, 8 do
    local store = automate.seats[index].shop
    assert_same(expected[index].team, store:snapshot().team, "battle mutations remain temporary")
end

-- Four different opponents lose in the same deadline-triggered battle phase.
local grouped = room.new(55, {wait_ms = 40, starting_lives = 1, preparation_ms = 10, settlement_ms = 5})
for player = 1, 8 do
    assert(grouped:join(player, 1) == player)
end
local opening = grouped:public_snapshot()
assert(opening.phase == "preparation" and opening.deadline == 11)
assert_pairing(opening)
for _, public in ipairs(opening.seats) do
    if public.seat < public.opponent then
        send(grouped, public.seat, 2, "shop", {action = "buy", offer = 1})
        send(grouped, public.seat, 2, "ready")
    end
end
assert(grouped:tick(11))
local settled = grouped:public_snapshot()
assert(settled.phase == "settlement" and settled.alive_count == 4)
local places = {}
local winner_to_leave
for _, public in ipairs(settled.seats) do
    local player = assert(grouped:snapshot(public.seat))
    local opponent = assert(grouped:snapshot(public.opponent))
    assert_same(player.battle, opponent.battle, "either side receives the same replay")
    assert(player.battle.events[1].seed == nil and player.battle.events[1].type == "start")
    player.battle.events[1].type = "tampered"
    assert(grouped:snapshot(public.seat).battle.events[1].type == "start")
    if public.active then
        assert(public.lives == 1 and public.wins == 1 and public.outcome == "win")
        winner_to_leave = public.seat
    else
        assert(public.lives == 0 and public.outcome == "loss" and public.elimination_reason == "lives_depleted")
        assert(not places[public.place] and public.place >= 5 and public.place <= 8)
        places[public.place] = true
    end
end
local quit = send(grouped, winner_to_leave, 12, "forfeit")
denied(grouped, winner_to_leave, quit, 12, "duplicate_request")
assert(grouped:snapshot(winner_to_leave).place == 4)
assert(grouped:tick(16))
local odd = grouped:public_snapshot()
assert(odd.round == 2 and odd.alive_count == 3 and odd.phase == "preparation")
assert_pairing(odd)
local bye
for _, public in ipairs(odd.seats) do
    if public.active and public.pairing == "bye" then
        bye = public.seat
    end
end
assert(bye)
denied(grouped, bye, {round = 1, sequence = 1, action = "ready"}, 16, "stale_round")
assert(grouped:tick(26))
local rest = assert(grouped:snapshot(bye))
assert(rest.outcome == "bye" and not rest.battle and not rest.opponent)
assert(rest.shop.phase == "settlement" and not rest.shop.last_outcome and rest.lives == 1)
assert(rest.seats[bye].wins == 1, "a bye does not award a win")

local limit = room.new(33, {wait_ms = 20, preparation_ms = 10, settlement_ms = 5, match_ms = 3})
assert(limit:join("first", 0) and limit:tick(20))
assert(limit:public_snapshot().deadline == 23 and limit:tick(23))
assert_final(limit:public_snapshot())
assert(limit:public_snapshot().reason == "match_timeout")

local cap = room.new(4, {wait_ms = 20, preparation_ms = 10, settlement_ms = 5, max_rounds = 1})
for player = 1, 8 do assert(cap:join(player, 0)) end
local opponent = assert(cap:snapshot(1)).opponent
for _, player in ipairs({1, opponent}) do
    send(cap, player, 1, "shop", {action = "buy", offer = 1})
    cap.seats[player].shop.team[1].health = 100000
end
assert(cap:tick(10))
assert_final(cap:public_snapshot())
assert(cap:public_snapshot().reason == "round_limit")
for _, player in ipairs({1, opponent}) do
    local state = assert(cap:snapshot(player))
    assert(state.battle_error == "strike_limit" and not state.battle)
    assert(state.shop.phase == "settlement" and state.lives == data.rules.start_lives)
    assert(state.outcome == "draw" and not state.shop.last_outcome)
end

local function play_complete(humans, seed)
    local deadline = 20
    local match = room.new(seed, {wait_ms = deadline, preparation_ms = 20, settlement_ms = 10, starting_lives = 2})
    for player = 1, humans do
        assert(match:join(player, 0) == player)
    end
    local clock = humans < 8 and deadline or 0
    assert(match:tick(clock))
    local trace = {}
    while match.phase ~= "ended" do
        local opened = match:public_snapshot()
        assert(opened.human_count == humans and opened.bot_count == 8 - humans)
        assert(opened.phase == "preparation")
        assert_pairing(opened)
        for player = 1, humans do
            if opened.seats[player].active then
                local style = ({"guardian", "striker", "swarm"})[(player - 1) % 3 + 1]
                local actions = 0
                while true do
                    local state = assert(match:snapshot(player))
                    local command = bot.choose_action(state.shop, style, actions)
                    if not command then break end
                    send(match, player, clock, "shop", command)
                    actions = actions + 1
                end
                send(match, player, clock, "ready")
            end
        end
        assert(match:tick(clock))
        local settled = match:public_snapshot()
        assert(settled.phase == "settlement" or settled.phase == "ended")
        trace[#trace + 1] = settled
        trace[#trace + 1] = assert(match:snapshot(1))
        if settled.phase == "settlement" then
            clock = assert(settled.deadline)
            assert(match:tick(clock))
        end
    end
    local final = match:public_snapshot()
    assert_final(final)
    assert(final.reason == "last_player", "this seed must end by elimination, got " .. final.reason)
    return trace
end

for humans = 1, 8 do
    local first = play_complete(humans, 14)
    assert_same(first, play_complete(humans, 14), "full room trace with " .. humans .. " humans")
end

print("Room tests passed: all eight human counts, legal bots, timeouts, odd pairs, simultaneous elimination and deterministic terminal ranks")
