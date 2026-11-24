package.path = "src/?.lua;" .. package.path

local release = require("autopets.release_data")
local room = require("autopets.room")
local run = require("autopets.run")

local function open_tier_six(catalog)
    local match = room.new(3, {
        catalog = catalog,
        wait_ms = 0,
        starting_lives = 30,
        preparation_ms = 1,
        settlement_ms = 1,
    })
    assert(match:join("human", 0) == 1)
    for _ = 1, 10 do
        assert(match:tick(match:public_snapshot().deadline))
        assert(match:public_snapshot().phase == "settlement")
        assert(match:tick(match:public_snapshot().deadline))
    end
    return match
end

local compatibility = open_tier_six()
assert(compatibility:snapshot("human").shop.tier == 3)

local match = open_tier_six(release)
local state = match:snapshot("human")
assert(state.shop.tier == 6 and state.round == 11 and state.bot_count == 7)
assert(state.shop.pets[1].id == "frost_muskox")
local now = state.deadline - 1
assert(match:request("human", {
    round = state.round,
    sequence = state.next_sequence,
    action = "shop",
    command = {action = "buy", offer = 1},
}, now))
assert(match:snapshot("human").shop.gold == release.rules.gold_per_round - release.rules.pet_cost)
assert(match:request("human", {round = state.round, sequence = state.next_sequence + 1, action = "ready"}, now))
local settled = match:snapshot("human")
assert(settled.battle and settled.phase == "settlement")
local side = settled.battle.left == settled.seat and "player" or "enemy"
local ability_seen = false
for _, event in ipairs(settled.battle.events) do
    if event.type == "skill" and event.side == side and event.id == "frost_muskox" then
        assert(event.trigger == "start" and event.strike == 0)
        ability_seen = true
    end
end
assert(ability_seen, "tier-six purchase must execute its ability in the authoritative room battle")
assert(settled.shop.team[1].health == release.pet_by_id.frost_muskox.health)

local practice = run.new(3, "beginner", release)
assert(practice:opponent_trace().rules_hash == release.rules_hash)
assert(practice:shop_action("buy", 1))
assert(practice:submit() and practice:settle() and practice:advance())
assert(practice:snapshot().round == 2)

print("Room release tests passed: shared profile, tier-six shopping and authoritative opening effect")
