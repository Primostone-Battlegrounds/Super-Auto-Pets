package.path = "src/?.lua;" .. package.path

local data = require("autopets.data")
local duel = require("autopets.duel")
local rules = data.rules
local first, second = "one", "two"

local function assert_same(left, right, path)
    path = path or "snapshot"
    if type(left) ~= "table" or type(right) ~= "table" then
        assert(left == right, path .. " differs")
        return
    end
    for key, value in pairs(left) do
        assert_same(value, right[key], path .. "." .. key)
    end
    for key in pairs(right) do
        assert(left[key] ~= nil, path .. " gained " .. key)
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
    local left, right = assert(match:snapshot(first)), assert(match:snapshot(second))
    local ok, code = match:request(player, request, now)
    assert(not ok and code == expected, "expected " .. expected .. ", got " .. tostring(code))
    assert_same(left, assert(match:snapshot(first)))
    assert_same(right, assert(match:snapshot(second)))
end

local function assert_private(state)
    assert(state.seed == nil and state.opponent_shop == nil)
    assert(state.shop.rng_state == nil and state.shop.next_uid == nil)
    if state.battle then
        assert(state.battle.seed == nil and state.battle.rng_state == nil)
        assert(state.battle.events[1].type == "start" and state.battle.events[1].seed == nil)
    end
end

local function turtle_offer(state)
    for index, offer in ipairs(state.shop.pets) do
        if offer and offer.id == "reed_turtle" then return index end
    end
end

local match_options = {now = 100, starting_lives = 2, preparation_ms = 100, settlement_ms = 50}

local function opening()
    for seed = 1, 64 do
        local match = duel.new(seed, first, second, match_options)
        local left = turtle_offer(assert(match:snapshot(first)))
        local right = turtle_offer(assert(match:snapshot(second)))
        if left and right then return match, left, right, seed end
    end
    error("fixture needs a first-tier draw lineup")
end

local function assert_both_battles(match, left_outcome, right_outcome)
    local left, right = assert(match:snapshot(first)), assert(match:snapshot(second))
    assert(left.revision == right.revision and left.round == right.round and left.phase == right.phase)
    assert(left.outcome == left_outcome and right.outcome == right_outcome)
    assert(left.shop.last_outcome == left_outcome and right.shop.last_outcome == right_outcome)
    assert(left.opponent_lives == right.lives and right.opponent_lives == left.lives)
    assert_private(left)
    assert_private(right)
    assert(left.battle.events[#left.battle.events].outcome == left_outcome)
    assert_same(left.battle, right.battle, "shared canonical replay")
    return left, right
end

local match, left_slot, right_slot, seed = opening()
local left_start, right_start = assert(match:snapshot(first)), assert(match:snapshot(second))
assert(left_start.seat == 1 and right_start.seat == 2 and left_start.phase == "preparation")
assert(left_start.round == 1 and right_start.round == 1 and left_start.deadline == 200)
assert(left_start.lives == 2 and left_start.opponent_lives == 2 and not left_start.battle and not left_start.winner)
assert(left_start.next_sequence == 1 and right_start.next_sequence == 1)
assert_private(left_start)
assert_private(right_start)
assert_same(left_start, assert(duel.new(seed, first, second, match_options):snapshot(first)))

local unseen, unknown = match:snapshot("spectator")
assert(not unseen and unknown == "unknown_player")
denied(match, "spectator", {round = 1, sequence = 1, action = "ready"}, 100, "unknown_player")
denied(match, first, envelope(match, first, "ready"), 100, "empty_team")
denied(match, first, {round = 1, sequence = 2, action = "ready"}, 100, "sequence_gap")
denied(match, first, {round = "1", sequence = 1, action = "ready"}, 100, "invalid_request")
denied(match, first, envelope(match, first, "shop", {action = "buy", offer = 999}), 100, "missing_offer")

local queued_right = envelope(match, second, "shop", {action = "buy", offer = right_slot})
local purchased = send(match, first, 101, "shop", {action = "buy", offer = left_slot})
local left_bought = assert(match:snapshot(first))
assert(left_bought.shop.gold == rules.gold_per_round - rules.pet_cost and #left_bought.shop.team == 1)
assert(left_bought.next_sequence == 2 and left_bought.revision > left_start.revision)
assert_same(right_start.shop, assert(match:snapshot(second)).shop, "opponent's shop after purchase")
denied(match, first, purchased, 101, "duplicate_request")
assert(match:request(second, queued_right, 102))
assert_same(left_bought.shop, assert(match:snapshot(first)).shop, "own shop after opposing purchase")

local frozen_slot = left_slot == 1 and 2 or 1
send(match, first, 103, "shop", {action = "freeze", kind = "pet", offer = frozen_slot, frozen = true})
local previous = assert(match:snapshot(first))
assert(previous.shop.pets[frozen_slot].frozen)
local mutated = assert(match:snapshot(first))
mutated.shop.team[1].health = -42
mutated.shop.pets[frozen_slot].frozen = false
assert_same(previous, assert(match:snapshot(first)), "shop copy")

local ready = send(match, first, 104, "ready")
assert(assert(match:snapshot(second)).opponent_ready and not assert(match:snapshot(second)).battle)
denied(match, first, ready, 104, "duplicate_request")
denied(match, first, envelope(match, first, "shop", {action = "reroll"}), 104, "already_ready")
local other_ready = send(match, second, 105, "ready")
local left_draw, right_draw = assert_both_battles(match, "draw", "draw")
assert(left_draw.phase == "settlement" and left_draw.deadline == 155 and left_draw.lives == 2 and right_draw.lives == 2)
denied(match, second, other_ready, 105, "duplicate_request")
mutated = assert(match:snapshot(first))
mutated.battle.events[1].type = "altered"
assert_same(left_draw, assert(match:snapshot(first)), "replay copy")
assert_same(right_draw, assert(match:snapshot(second)), "opponent replay copy")

send(match, first, 106, "next")
assert(assert(match:snapshot(second)).opponent_continued and assert(match:snapshot(first)).round == 1)
denied(match, first, envelope(match, first, "next"), 106, "already_continued")
local previous_round = send(match, second, 107, "next")
local second_round = assert(match:snapshot(first))
assert(second_round.phase == "preparation" and second_round.round == 2 and second_round.deadline == 207)
assert(second_round.next_sequence == 1 and not second_round.ready and not second_round.continued and not second_round.battle)
assert(second_round.shop.gold == rules.gold_per_round)
assert_same(previous.shop.pets[frozen_slot], second_round.shop.pets[frozen_slot], "frozen offer across rounds")
assert_same(previous.shop.team, second_round.shop.team, "permanent team across rounds")
denied(match, second, previous_round, 107, "stale_round")

for round = 2, 3 do
    local now = 110 + round * 10
    send(match, first, now, "shop", {action = "feed", offer = 1, target = 1})
    send(match, first, now, "shop", {action = "feed", offer = 2, target = 1})
    send(match, second, now, "ready")
    send(match, first, now, "ready")
    local left, right = assert_both_battles(match, "win", "loss")
    assert(left.round == round and left.lives == 2 and right.lives == 3 - round)
    if round == 2 then
        assert(left.phase == "settlement" and not left.winner)
        send(match, second, now + 1, "next")
        send(match, first, now + 1, "next")
    else
        assert(left.phase == "ended" and left.winner == 1 and right.winner == 1)
        assert(left.reason == "lives_depleted" and right.reason == "lives_depleted" and not left.deadline)
        denied(match, first, envelope(match, first, "shop", {action = "reroll"}), now, "wrong_phase")
    end
end

local timed = duel.new(11, first, second, {starting_lives = 2, preparation_ms = 10, settlement_ms = 5})
send(timed, first, 1, "shop", {action = "buy", offer = 1})
local invalid, clock_error = timed:tick(0)
assert(not invalid and clock_error == "invalid_clock")
assert(timed:tick(9))
assert(assert(timed:snapshot(first)).phase == "preparation")
local late = envelope(timed, second, "shop", {action = "buy", offer = 1})
local accepted, late_reason = timed:request(second, late, 10)
assert(not accepted and late_reason == "wrong_phase")
local timed_left, timed_right = assert_both_battles(timed, "win", "loss")
assert(timed_left.deadline == 15 and timed_right.lives == 1 and #timed_right.shop.team == 0)
assert(timed:tick(14))
assert_same(timed_left, assert(timed:snapshot(first)), "settlement wait")
assert(timed:tick(15))
local timed_next = assert(timed:snapshot(first))
assert(timed_next.round == 2 and timed_next.deadline == 25 and timed_next.phase == "preparation")
denied(timed, second, late, 15, "stale_round")

local vacant = duel.new(11, first, second, {starting_lives = 2, preparation_ms = 10, settlement_ms = 5})
assert(vacant:tick(12))
local vacant_left, vacant_right = assert_both_battles(vacant, "draw", "draw")
assert(vacant_left.lives == 2 and vacant_right.lives == 2 and vacant_left.deadline == 17)

local surrendered = duel.new(11, first, second, match_options)
local forfeit = send(surrendered, second, 100, "forfeit")
local winner = assert(surrendered:snapshot(first))
assert(winner.phase == "ended" and winner.winner == 1 and winner.reason == "forfeit")
denied(surrendered, second, forfeit, 100, "duplicate_request")

local limited, limited_left, limited_right = opening()
send(limited, first, 100, "shop", {action = "buy", offer = limited_left})
send(limited, second, 100, "shop", {action = "buy", offer = limited_right})
-- A fixture for the resolver's strike-limit branch avoids hundreds of growth turns.
limited.seats[1].shop.team[1].health = 1000
limited.seats[2].shop.team[1].health = 1000
send(limited, first, 101, "ready")
local failed = send(limited, second, 102, "ready")
for _, player in ipairs({first, second}) do
    local state = assert(limited:snapshot(player))
    assert(state.phase == "preparation" and state.battle_error == "strike_limit" and not state.battle)
    assert(state.lives == 2 and not state.ready and state.deadline == 202 and state.shop.phase == "preparation")
end
denied(limited, second, failed, 102, "duplicate_request")
send(limited, first, 103, "shop", {action = "sell", target = 1})
assert(limited:tick(202))
local recovered = assert(limited:snapshot(first))
assert(recovered.phase == "settlement" and recovered.lives == 1 and recovered.battle_error == nil)

print("Duel tests passed: private shops, draw, terminal, idempotency, timeouts, and battle recovery")
