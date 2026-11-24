package.path = "src/?.lua;" .. package.path

local data = require("autopets.data")
local host = require("autopets.room_host")

local function frame(updates, connection)
    for _, update in ipairs(updates) do
        if update.connection == connection then
            return update.state
        end
    end
    error("no frame for expected connection")
end

local function command(state, action, shop_command)
    return {round = state.round, sequence = state.next_sequence, action = action, command = shop_command}
end

local function denied(match, connection, request, now, code)
    local ok, err, updates = match:request(connection, request, now)
    assert(not ok and err == code)
    return updates
end

local function verify_privacy(state)
    assert(state.shop.rng_state == nil and state.shop.next_uid == nil)
    for _, public in ipairs(state.seats) do
        assert(public.player == nil and public.shop == nil and public.battle == nil)
    end
end

local waiting = host.new(17, {wait_ms = 10, preparation_ms = 20, settlement_ms = 5, reconnect_ms = 8})
local a, lobby = waiting:connect("a", 0)
assert(a and #lobby == 1 and frame(lobby, a).phase == "lobby")
assert(denied(waiting, {}, nil, 0, "unknown_connection") == nil)
local expired_lobby = assert(waiting:connect("lobby-exit", 0))
local done, remaining = waiting:disconnect(expired_lobby, 3)
assert(done and #remaining == 1 and frame(remaining, a).human_count == 1)
assert(waiting:next_deadline() == 10)
assert(denied(waiting, expired_lobby, nil, 3, "unknown_connection") == nil)
local b = assert(waiting:connect("b", 4))
assert(waiting:next_deadline() == 10)
local started, opened = waiting:tick(10)
assert(started and #opened == 2 and frame(opened, b).seat == 2)
local a_open = frame(opened, a)
local b_open = frame(opened, b)
assert(a_open.human_count == 2 and a_open.bot_count == 6)
assert(a_open.seats[1].connected and a_open.seats[2].connected and a_open.seats[3].connected == nil)
verify_privacy(a_open)
verify_privacy(b_open)
assert(waiting:next_deadline() == 30)

local purchase_a = command(a_open, "shop", {action = "buy", offer = 1})
purchase_a.connection = b
local accepted, err, purchase_ack = waiting:request(a, purchase_a, 11)
assert(accepted and not err and #purchase_ack == 1)
local a_bought = frame(purchase_ack, a)
assert(a_bought.shop.gold == data.rules.gold_per_round - data.rules.pet_cost)
local duplicate_ack = denied(waiting, a, purchase_a, 11, "duplicate_request")
assert(#duplicate_ack == 1 and frame(duplicate_ack, a).next_sequence == a_bought.next_sequence)
assert(frame(duplicate_ack, a).host_revision > a_bought.host_revision)
verify_privacy(frame(duplicate_ack, a))

local purchase_b = command(b_open, "shop", {action = "buy", offer = 1})
local got_b, no_error, b_purchase_ack = waiting:request(b, purchase_b, 12)
assert(got_b and not no_error and #b_purchase_ack == 1)
local b_bought = frame(b_purchase_ack, b)
assert(b_bought.shop.team[1].id == b_open.shop.pets[1].id)
assert(b_bought.shop.gold == data.rules.gold_per_round - data.rules.pet_cost)

local disconnected, public = waiting:disconnect(b, 13)
assert(disconnected and #public == 1)
assert(not frame(public, a).seats[2].connected and frame(public, a).seats[2].active)
assert(waiting:next_deadline() == 21 and denied(waiting, b, purchase_b, 13, "unknown_connection") == nil)
local late, late_error = waiting:connect("other", 14)
assert(not late and late_error == "room_started")
local resumed_b, restored = waiting:connect("b", 14)
assert(resumed_b and resumed_b ~= b and #restored == 2)
local recovered = frame(restored, resumed_b)
assert(recovered.shop.gold == b_bought.shop.gold and recovered.shop.team[1].id == b_bought.shop.team[1].id)
assert(recovered.next_sequence == b_bought.next_sequence and recovered.seats[2].connected)
assert(waiting:next_deadline() == 30)
assert(denied(waiting, resumed_b, purchase_b, 14, "duplicate_request"))
assert(denied(waiting, b, purchase_b, 14, "unknown_connection") == nil)
local a_ready, _, ready_update = waiting:request(a, command(frame(restored, a), "ready"), 15)
assert(a_ready and #ready_update == 2 and frame(ready_update, resumed_b).seats[1].ready)
local b_ready, _, result = waiting:request(resumed_b, command(frame(ready_update, resumed_b), "ready"), 16)
assert(b_ready and #result == 2 and frame(result, a).phase == "settlement")
assert(frame(result, a).battle and frame(result, resumed_b).battle)
assert(waiting:next_deadline() == 21)
local left, after_leave = waiting:leave(resumed_b, 17)
assert(left and #after_leave == 1)
local absent = frame(after_leave, a).seats[2]
assert(not absent.active and not absent.connected and absent.place == 8 and absent.elimination_reason == "forfeit")
assert(denied(waiting, resumed_b, nil, 17, "unknown_connection") == nil)

-- Preserve simultaneous standings even if connection notifications arrive in a
-- different order. No expired participant enters a newly repaired pairing.
local function expire_many(reverse, count, grace)
    local group = host.new(19, {wait_ms = 8, preparation_ms = 10, reconnect_ms = grace})
    local handles, last = {}, nil
    for player = 1, 8 do
        handles[player], last = group:connect(player, 0)
        assert(handles[player])
    end
    for offset = 1, count do
        local player = reverse and count - offset + 1 or offset
        assert(group:disconnect(handles[player], 1))
    end
    for player = count + 1, 8 do
        local request = command(frame(last, handles[player]), "shop", {action = "buy", offer = 1})
        local ok, _, buy = group:request(handles[player], request, 1)
        assert(ok and #buy == 1)
        local ready = command(frame(buy, handles[player]), "ready")
        assert(group:request(handles[player], ready, 1))
    end
    local expires = 1 + grace
    assert(group:next_deadline() == expires)
    local ok, updated = group:tick(expires)
    assert(ok and #updated == 8 - count)
    local new_handle, reconnect = group:connect(1, expires)
    assert(new_handle and new_handle ~= handles[1])
    local observed = frame(reconnect, new_handle)
    assert(denied(group, handles[1], nil, expires, "unknown_connection") == nil)
    if count == 8 then
        assert(observed.phase == "ended" and observed.alive_count == 1 and observed.reason == "all_forfeit")
        assert(not group:next_deadline())
    else
        assert(observed.phase == "settlement" and observed.alive_count == 8 - count)
        assert(not observed.active and not observed.battle)
        assert(observed.lives == data.rules.start_lives)
        for index = 1, count do
            assert(observed.seats[index].place > 8 - count and observed.seats[index].elimination_reason == "forfeit")
        end
    end
    local standings = {}
    for index = 1, count do standings[index] = observed.seats[index].place end
    return table.concat(standings, ",")
end

assert(expire_many(false, 2, 3) == expire_many(true, 2, 3))
assert(expire_many(false, 8, 3) == expire_many(true, 8, 3))
assert(expire_many(false, 2, 9) == expire_many(true, 2, 9), "expiry precedes same-time preparation deadline")

local function test_late_expiry(grace, due, expected_shop_round)
    local match = host.new(13, {wait_ms = 4, preparation_ms = 10, settlement_ms = 5, reconnect_ms = grace})
    local a = assert(match:connect("a", 0))
    local b = assert(match:connect("b", 0))
    assert(match:tick(4))
    assert(match:disconnect(a, 5))
    assert(match:tick(due))
    local reconnected, rank_update = match:connect("a", due)
    assert(reconnected and reconnected ~= a)
    local out = frame(rank_update, reconnected)
    assert(out.lives == data.rules.start_lives - 1, "earlier preparation satisfies the scheduled battle")
    assert((out.battle and out.battle.round or 2) == expected_shop_round)
    assert(out.round == 2 and not out.active and out.shop.round == expected_shop_round)
    assert(frame(rank_update, b).shop.round == 2)
end

test_late_expiry(14, 19, 1) -- Expiry precedes same-time shop opening.
test_late_expiry(15, 21, 2) -- An earlier shop opening is applied before expiry.

local capped = host.new(21, {wait_ms = 8, preparation_ms = 100, match_ms = 10, reconnect_ms = 9})
local handles, before_cap = {}, nil
for player = 1, 8 do handles[player], before_cap = capped:connect(player, 0) end
assert(capped:disconnect(handles[1], 1))
for player = 2, 8 do
    local purchase = command(frame(before_cap, handles[player]), "shop", {action = "buy", offer = 1})
    local ok, _, ack = capped:request(handles[player], purchase, 1)
    assert(ok and capped:request(handles[player], command(frame(ack, handles[player]), "ready"), 1))
end
assert(capped:next_deadline() == 10)
local capped_ok, final = capped:tick(10)
assert(capped_ok and #final == 7 and not capped:next_deadline())
for _, update in ipairs(final) do
    local state = update.state
    assert(state.phase == "ended" and state.reason == "match_timeout")
    assert(state.round == 1 and not state.battle and state.lives == data.rules.start_lives)
end

-- A host that wakes late handles distinct expirations in chronological order.
local delayed = host.new(9, {wait_ms = 6, preparation_ms = 60, reconnect_ms = 5})
local first = assert(delayed:connect("first", 0))
local second = assert(delayed:connect("second", 0))
assert(delayed:tick(6))
assert(delayed:disconnect(first, 7))
assert(delayed:disconnect(second, 8))
assert(delayed:next_deadline() == 12)
local ticked, nobody = delayed:tick(18)
assert(ticked and #nobody == 0)
local observer, replayed = delayed:connect("first", 18)
assert(observer and #replayed == 1)
local expired = frame(replayed, observer)
assert(expired.seats[1].place == 8 and expired.seats[2].place == 7 and expired.alive_count == 6)
assert(expired.phase == "settlement" and expired.battle == nil)
local invalid_tick, clock_error = delayed:tick(17)
assert(not invalid_tick and clock_error == "invalid_clock")

print("Room host tests passed: private routing, session revocation, grace, simultaneous expiry and live bot continuation")
