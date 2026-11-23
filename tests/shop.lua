package.path = "src/?.lua;" .. package.path

local data = require("autopets.data")
local shop = require("autopets.shop")
local rules = data.rules

local function equal(left, right)
    if type(left) ~= "table" or type(right) ~= "table" then
        return left == right
    end
    for key, value in pairs(left) do
        if not equal(value, right[key]) then
            return false
        end
    end
    for key in pairs(right) do
        if left[key] == nil then
            return false
        end
    end
    return true
end

local function reject(store, expected, action, ...)
    local before = store:snapshot()
    local ok, reason = store[action](store, ...)
    assert(not ok and reason == expected, action .. " rejected with " .. tostring(reason))
    assert(equal(store:snapshot(), before), action .. " should leave state unchanged")
end

local market = shop.new(7)
local opening = market:snapshot()
assert(opening.round == 1 and opening.gold == rules.gold_per_round and opening.tier == 1)
assert(#opening.pets == rules.pet_shop_slots and #opening.foods == rules.food_shop_slots)
assert(opening.pets[1].id ~= opening.pets[2].id)
reject(market, "invalid_position", "buy", 1, false)
assert(market:buy(1))
assert(market:buy(2, 1))
assert(market:snapshot().team[1].id == opening.pets[2].id)
assert(market:move(2, 1))
local formation = market:snapshot()
assert(formation.team[1].id == opening.pets[1].id and formation.team[2].id == opening.pets[2].id)
assert(formation.pets[1] == false and formation.pets[2] == false)
local food = data.food_by_id[opening.foods[1].id]
assert(market:feed(1, 2))
local fed = market:snapshot()
assert(fed.team[2].attack == formation.team[2].attack + food.attack)
assert(fed.team[2].health == formation.team[2].health + food.health)
assert(fed.foods[1] == false and fed.gold == rules.gold_per_round - 2 * rules.pet_cost - rules.food_cost)
reject(market, "insufficient_gold", "buy", 3)
assert(market:sell(1))
assert(market:snapshot().team[1].id == formation.team[2].id)
assert(market:snapshot().gold == fed.gold + rules.sell_gold_per_level)
local detached = market:snapshot()
detached.team[1].health = 999
detached.foods[2].frozen = true
assert(market:snapshot().team[1].health == fed.team[2].health)
assert(not market:snapshot().foods[2].frozen)

local function frozen_shop(seed)
    local store = shop.new(seed)
    for position = 1, rules.pet_shop_slots do
        assert(store:freeze("pet", position))
    end
    for position = 1, rules.food_shop_slots do
        assert(store:freeze("food", position))
    end
    return store
end

local frozen, reference = frozen_shop(17), frozen_shop(17)
local held = frozen:snapshot()
reject(frozen, "all_frozen", "reroll")
reject(frozen, "invalid_offer_type", "freeze", "reward", 1)
reject(frozen, "missing_offer", "freeze", "food", 3)
reject(frozen, "missing_offer", "buy", 0)
reject(frozen, "invalid_position", "feed", 1, 1)
assert(frozen:freeze("pet", 2))
assert(reference:freeze("pet", 2))
assert(frozen:reroll())
assert(reference:reroll())
assert(equal(frozen:snapshot(), reference:snapshot()), "rejected actions must preserve future offers")
assert(frozen:snapshot().gold == held.gold - rules.reroll_cost)
for round = 2, rules.tier_unlock_rounds[rules.max_tier] do
    frozen:advance_round()
    local state = frozen:snapshot()
    assert(state.round == round and state.tier == data.tier_for_round(round))
    assert(state.gold == rules.gold_per_round)
    assert(equal(state.pets[1], held.pets[1]) and equal(state.foods[2], held.foods[2]))
    assert(data.pet_by_id[state.pets[2].id].tier <= state.tier)
end
assert(frozen:buy(1))
assert(frozen:snapshot().pets[1] == false)
assert(frozen:reroll())
assert(frozen:snapshot().pets[1] and not frozen:snapshot().pets[1].frozen)

local growing = shop.new(6)
local pet = data.pet_by_id[growing:snapshot().pets[1].id]
assert(growing:buy(1))
assert(growing:buy(2))
reject(growing, "same_position", "merge", 1, 1)
assert(growing:merge(2, 1))
local pair = growing:snapshot()
assert(#pair.team == 1 and pair.team[1].xp == 1 and pair.team[1].level == 1)
assert(pair.team[1].attack == pet.attack + rules.merge_attack)
assert(pair.team[1].health == pet.health + rules.merge_health and #pair.rewards == 0)
assert(growing:freeze("pet", 3))
growing:advance_round()
assert(growing:combine(3, 1))
local upgraded = growing:snapshot()
assert(upgraded.team[1].xp == rules.level_xp[2] and upgraded.team[1].level == 2)
assert(upgraded.team[1].attack == pet.attack + 2 * rules.merge_attack)
assert(#upgraded.rewards == 1)
local reward = data.pet_by_id[upgraded.rewards[1].id]
assert(reward.tier == upgraded.tier + rules.level_reward_tier_offset)
assert(growing:reroll())
assert(equal(growing:snapshot().rewards, upgraded.rewards))
assert(growing:buy(1, 1, true))
assert(growing:snapshot().team[1].id == reward.id and #growing:snapshot().rewards == 0)
assert(growing:snapshot().gold == rules.gold_per_round - 2 * rules.pet_cost - rules.reroll_cost)
reject(growing, "different_pet", "merge", 1, 2)
assert(growing:sell(1))

local function find_offer(store, id)
    for index, offer in ipairs(store:snapshot().pets) do
        if offer and offer.id == id then
            return index
        end
    end
end

for _ = 1, 3 do
    growing:advance_round()
    local index = find_offer(growing, pet.id)
    while not index do
        assert(growing:snapshot().gold > rules.pet_cost, "fixture must offer a merge within budget")
        assert(growing:reroll())
        index = find_offer(growing, pet.id)
    end
    assert(growing:combine(index, 1))
end
local maxed = growing:snapshot()
assert(maxed.team[1].level == rules.max_level and maxed.team[1].xp == rules.level_xp[rules.max_level])
assert(#maxed.rewards == 1 and data.pet_by_id[maxed.rewards[1].id].tier == rules.max_tier)
growing:advance_round()
assert(#growing:snapshot().rewards == 0)
local matching = find_offer(growing, pet.id)
while not matching do
    assert(growing:snapshot().gold > rules.pet_cost, "fixture must offer a merge within budget")
    assert(growing:reroll())
    matching = find_offer(growing, pet.id)
end
reject(growing, "max_level", "combine", matching, 1)
local balance = growing:snapshot().gold
assert(growing:sell(1))
assert(growing:snapshot().gold == balance + rules.max_level * rules.sell_gold_per_level)

local full = shop.new(7)
for position = 1, 3 do
    assert(full:buy(position))
end
full:advance_round()
assert(full:buy(1) and full:buy(2))
assert(#full:snapshot().team == rules.team_size)
reject(full, "team_full", "buy", 3)
local offer = full:snapshot().pets[3]
for position, unit in ipairs(full:snapshot().team) do
    if unit.id == offer.id then
        assert(full:combine(3, position))
        break
    end
end
assert(full:snapshot().pets[3] == false and #full:snapshot().team == rules.team_size)

local broke, control = shop.new(29), shop.new(29)
for _ = 1, rules.gold_per_round do
    assert(broke:reroll() and control:reroll())
end
reject(broke, "insufficient_gold", "reroll")
reject(broke, "insufficient_gold", "buy", 3)
broke:advance_round()
control:advance_round()
assert(equal(broke:snapshot(), control:snapshot()), "insufficient gold must preserve the RNG")

print("shop tests passed")
