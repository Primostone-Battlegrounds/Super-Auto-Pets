package.path = "src/?.lua;" .. package.path

local duel = require("autopets.duel")
local release = require("autopets.release_data")

local function equal(a, b)
    if type(a) ~= "table" or type(b) ~= "table" then
        return a == b
    end
    for key, value in pairs(a) do
        if not equal(value, b[key]) then return false end
    end
    for key in pairs(b) do
        if a[key] == nil then return false end
    end
    return true
end

local function play(seed)
    local players = {"a", "b"}
    local match = duel.new(seed, players[1], players[2], {catalog = release, starting_lives = 15})
    local function request(player, action, command)
        local state = assert(match:snapshot(player))
        assert(match:request(player, {
            round = state.round, sequence = state.next_sequence, action = action, command = command,
        }, 0))
    end
    local fought = {}
    local tier_six_skill = false
    for round = 1, 12 do
        for _, player in ipairs(players) do
            local state = assert(match:snapshot(player))
            assert(state.round == round and state.shop.tier == release.tier_for_round(round))
            assert(state.catalog == nil and state.shop.catalog == nil)
            local best_slot, best_tier = 1, 0
            for slot, offer in ipairs(state.shop.pets) do
                local tier = release.pet_by_id[offer.id].tier
                if tier > best_tier then
                    best_slot, best_tier = slot, tier
                end
            end
            local front = state.shop.team[1]
            if not front or best_tier > release.pet_by_id[front.id].tier then
                if front then request(player, "shop", {action = "sell", target = 1}) end
                request(player, "shop", {action = "buy", offer = best_slot, target = 1})
            end
            request(player, "ready")
        end
        local left, right = assert(match:snapshot(players[1])), assert(match:snapshot(players[2]))
        assert(left.phase == "settlement" and equal(left.battle, right.battle))
        fought[round] = left.battle
        for _, event in ipairs(left.battle.events) do
            if event.type == "skill" and release.pet_by_id[event.id].tier == 6 then
                tier_six_skill = true
            end
        end
        for _, player in ipairs(players) do request(player, "next") end
    end
    request(players[2], "forfeit")
    local final = assert(match:snapshot(players[1]))
    assert(final.phase == "ended" and final.winner == 1 and final.reason == "forfeit")
    return fought, tier_six_skill
end

local observed_tier_six = false
for seed = 1, 6 do
    local battles, tier_six_skill = play(seed)
    assert(equal(battles, play(seed)))
    observed_tier_six = observed_tier_six or tier_six_skill
end
assert(observed_tier_six, "seeded full-room test must exercise a tier-six skill")

print("duel release tests passed (shared six-tier shops and replay, 6 deterministic seeds)")
