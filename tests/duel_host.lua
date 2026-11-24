package.path = "src/?.lua;" .. package.path

local host = require("autopets.duel_host")
local data = require("autopets.data")

local function same(left, right)
    if type(left) ~= "table" or type(right) ~= "table" then
        assert(left == right, tostring(left) .. " differs from " .. tostring(right))
        return
    end
    for key, value in pairs(left) do
        same(value, right[key])
    end
    for key in pairs(right) do
        assert(left[key] ~= nil, "unexpected field " .. key)
    end
end

local views = {}
local function deliver(updates)
    local unique = {}
    for _, update in ipairs(updates) do
        local connection, state = update.connection, update.state
        local previous = views[connection]
        assert(not unique[connection] and (not previous or state.host_revision >= previous.host_revision))
        assert(not state.shop.rng_state and not state.shop.next_uid and not state.opponent_shop)
        views[connection] = state
        unique[connection] = true
    end
    return #updates
end

local function connect(room, player, now)
    local connection, updates = room:connect(player, now)
    assert(connection, updates)
    deliver(updates)
    return connection
end

local function request_for(connection, action, command)
    local state = assert(views[connection])
    return {round = state.round, sequence = state.next_sequence, action = action, command = command}
end

local function send(room, connection, now, action, command)
    local request = request_for(connection, action, command)
    local accepted, err, updates = room:request(connection, request, now)
    assert(accepted, err)
    deliver(updates)
    return request
end

local function denied(room, connection, request, now, code, recipients)
    local accepted, err, updates = room:request(connection, request, now)
    assert(not accepted and err == code, tostring(err))
    assert(deliver(updates or {}) == recipients)
end

local function shopping(room, connection, now, command)
    return send(room, connection, now, "shop", command)
end

local function tick(room, now)
    local ok, updates = room:tick(now)
    assert(ok, updates)
    return deliver(updates)
end

local function drop(room, connection, now)
    local ok, updates = room:disconnect(connection, now)
    assert(ok, updates)
    deliver(updates)
end

local function find_offer(connection, id)
    for index, offer in ipairs(views[connection].shop.pets) do
        if offer and offer.id == id then return index end
    end
end

-- Both draw and life-depletion battles go through the transport boundary.
local room, left, right, left_offer, right_offer
for seed = 1, 64 do
    room = host.new(seed, "a", "b", {
        preparation_ms = 20, settlement_ms = 5, reconnect_ms = 8, starting_lives = 1,
    })
    left = connect(room, "a", 0)
    assert(not views[left].opponent_connected)
    right = connect(room, "b", 0)
    left_offer = find_offer(left, "reed_turtle")
    right_offer = find_offer(right, "reed_turtle")
    if left_offer and right_offer then break end
end
assert(left_offer and right_offer and room:next_deadline() == 20)
assert(views[left].opponent_connected and views[right].opponent_connected)
local missing, reason = room:connect("stranger", 20)
assert(not missing and reason == "unknown_player" and room:next_deadline() == 20)
denied(room, {}, request_for(left, "ready"), 20, "unknown_connection", 0)

local right_open = views[right].shop
local first_purchase = request_for(left, "shop", {action = "buy", offer = left_offer})
first_purchase.player = "b" -- Client claims are ignored. Only the capability routes.
local accepted, err, updates = room:request(left, first_purchase, 1)
assert(accepted, err)
assert(deliver(updates) == 2)
same(right_open, views[right].shop)
denied(room, left, first_purchase, 1, "duplicate_request", 1)
denied(room, right, {round = 1, sequence = 2, action = "ready"}, 1, "sequence_gap", 1)
local frozen_slot = left_offer == 1 and 2 or 1
shopping(room, left, 2, {action = "freeze", kind = "pet", offer = frozen_slot})
local frozen = views[left].shop.pets[frozen_slot]
assert(frozen.frozen)
shopping(room, right, 2, {action = "buy", offer = right_offer})
send(room, left, 3, "ready")
denied(room, left, request_for(left, "shop", {action = "reroll"}), 3, "already_ready", 1)
local previous_right = right
drop(room, right, 4)
assert(not views[left].opponent_connected and room:next_deadline() == 12)
denied(room, right, request_for(right, "ready"), 5, "unknown_connection", 0)
assert(tick(room, 6) == 0)
right = connect(room, "b", 7)
assert(right ~= previous_right and views[left].opponent_connected)
assert(views[right].next_sequence == 2 and views[right].shop.gold == data.rules.gold_per_round - data.rules.pet_cost)
same(views[right].shop, views[previous_right].shop)
missing, reason = room:disconnect(previous_right, 7)
assert(not missing and reason == "unknown_connection")

send(room, right, 8, "ready")
assert(views[left].outcome == "draw" and views[right].outcome == "draw")
same(views[left].battle, views[right].battle)
assert(views[left].battle ~= views[right].battle and not views[right].battle.events[1].seed)
local released_battle = views[left].battle
released_battle.events[1].type = "edited in transit"
local right_mid = right
right = connect(room, "b", 8)
same(views[left].battle, views[right].battle)
assert(views[left].battle.events[1].type == "start")
denied(room, right_mid, request_for(right_mid, "next"), 8, "unknown_connection", 0)
send(room, right, 9, "next")
assert(tick(room, 12) == 0)
assert(tick(room, 13) == 2) -- Unconfirmed settlement auto-advances.
assert(views[left].round == 2 and views[right].round == 2 and not views[left].battle)
assert(views[left].next_sequence == 1 and views[right].next_sequence == 1)
same(views[left].shop.pets[frozen_slot], frozen)
denied(room, left, first_purchase, 13, "stale_round", 1)

shopping(room, left, 14, {action = "feed", offer = 1, target = 1})
shopping(room, left, 14, {action = "feed", offer = 2, target = 1})
send(room, left, 15, "ready")
local timed_out = request_for(right, "shop", {action = "buy", offer = 1})
denied(room, right, timed_out, 33, "wrong_phase", 2) -- Resolve before accepting a mutation on the deadline.
local winner, loser = views[left], views[right]
assert(winner.phase == "ended" and winner.winner == 1 and loser.winner == 1)
assert(winner.reason == "lives_depleted" and winner.lives == 1 and loser.lives == 0)
assert(winner.outcome == "win" and loser.outcome == "loss" and room:next_deadline() == nil)
same(winner.battle, loser.battle)
assert(tick(room, 999) == 0)

local market = host.new(1, "a", "b")
left = connect(market, "a", 0)
right = connect(market, "b", 0)
local market_before = views[right].shop
local opening = views[left].shop.pets
assert(opening[1].id == opening[3].id and opening[1].id ~= opening[2].id)
shopping(market, left, 1, {action = "buy", offer = 1})
shopping(market, left, 1, {action = "buy", offer = 2})
shopping(market, left, 1, {action = "combine", offer = 3, target = 1})
local uid = views[left].shop.team[1].uid
assert(views[left].shop.team[1].xp == 1)
shopping(market, left, 1, {action = "move", from = 1, to = 2})
assert(views[left].shop.team[2].uid == uid)
shopping(market, left, 1, {action = "sell", target = 1})
assert(views[left].shop.team[1].uid == uid and views[left].shop.gold == 2)
local food = views[left].shop.foods[1].id
shopping(market, left, 1, {action = "freeze", kind = "food", offer = 1})
shopping(market, left, 1, {action = "reroll"})
assert(views[left].shop.foods[1].id == food and views[left].shop.foods[1].frozen and views[left].shop.gold == 1)
same(market_before, views[right].shop)

-- Disconnected sessions cannot act or evict their replacements. A late
-- reconnection can only see the already-resolved recovery outcome.
local recovery = host.new(1, "a", "b", {reconnect_ms = 9})
left = connect(recovery, "a", 0)
right = connect(recovery, "b", 0)
drop(recovery, left, 1)
assert(recovery:next_deadline() == 10)
missing, reason = recovery:tick(0)
assert(not missing and reason == "invalid_clock")
left = connect(recovery, "a", 10)
assert(views[left].phase == "ended" and views[left].winner == 2 and views[left].reason == "forfeit")
assert(views[right].winner == 2 and recovery:next_deadline() == nil)

local abandoned = host.new(1, "a", "b", {reconnect_ms = 9})
left = connect(abandoned, "a", 0)
right = connect(abandoned, "b", 0)
drop(abandoned, left, 1)
drop(abandoned, right, 1)
assert(tick(abandoned, 10) == 0)
left = connect(abandoned, "a", 10)
assert(views[left].phase == "ended" and not views[left].winner and views[left].reason == "abandoned")

local earlier = host.new(1, "a", "b", {preparation_ms = 3, settlement_ms = 500, reconnect_ms = 6})
left = connect(earlier, "a", 0)
right = connect(earlier, "b", 0)
drop(earlier, left, 1)
assert(tick(earlier, 3) == 1 and views[right].phase == "settlement")
assert(tick(earlier, 7) == 1 and views[right].winner == 2 and views[right].battle)

local last = host.new(1, "a", "b", {now = math.maxinteger - 2, match_ms = 2})
left = connect(last, "a", math.maxinteger - 2)
right = connect(last, "b", math.maxinteger - 2)
drop(last, left, math.maxinteger - 1)
assert(last:next_deadline() == math.maxinteger)
assert(tick(last, math.maxinteger) == 1 and views[right].reason == "match_timeout")

print("Duel host tests passed: private routing, command retries, deadline, replay, recovery, terminal")
