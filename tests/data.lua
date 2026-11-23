package.path = "src/?.lua;" .. package.path

local data = require("autopets.data")
local rng = require("autopets.rng")
local rules = data.rules

assert(rules.team_size == 5 and rules.start_lives == 5 and rules.wins_to_win == 10)
assert(rules.gold_per_round == 10 and rules.reroll_cost == 1)
assert(rules.pet_cost == 3 and rules.food_cost == 3)
assert(rules.pet_shop_slots == 3 and rules.food_shop_slots == 2)
assert(rules.max_level == 3 and rules.max_tier == 3)
assert(rules.merge_attack == 1 and rules.merge_health == 1)
assert(rules.sell_gold_per_level == 1 and rules.level_reward_tier_offset == 1)
assert(#rules.level_xp == rules.max_level and table.concat(rules.level_xp, ",") == "0,2,5")
assert(#rules.tier_unlock_rounds == rules.max_tier)
assert(table.concat(rules.tier_unlock_rounds, ",") == "1,3,5")

local ids = {}
local function check_entry(entry)
    assert(entry.id:match("^[a-z][a-z_]+$") and not ids[entry.id], entry.id)
    ids[entry.id] = true
    assert(type(entry.name) == "string" and entry.name ~= "")
    assert(math.type(entry.attack) == "integer" and entry.attack >= 0)
    assert(math.type(entry.health) == "integer" and entry.health >= 0)
end

assert(#data.pets == 9 and #data.foods == 6)
for _, pet in ipairs(data.pets) do
    check_entry(pet)
    assert(pet.attack > 0 and pet.health > 0 and data.pet_by_id[pet.id] == pet)
    local ability = pet.ability
    assert(ability.power > 0 and ability.name ~= "")
    if ability.token then
        assert(data.token_by_id[ability.token], ability.token)
    end
end
for _, food in ipairs(data.foods) do
    check_entry(food)
    assert(food.attack + food.health > 0 and data.food_by_id[food.id] == food)
end
for id, token in pairs(data.token_by_id) do
    check_entry(token)
    assert(id == token.id and token.attack > 0 and token.health > 0)
end

for tier = 1, rules.max_tier do
    local styles = {}
    for _, pet in ipairs(data.pets_at_tier(tier)) do
        assert(pet.tier == tier and not styles[pet.style])
        styles[pet.style] = true
    end
    assert(styles.guardian and styles.striker and styles.swarm)
    local pets = data.pets_for_tier(tier)
    local foods = data.foods_for_tier(tier)
    assert(#pets == tier * 3 and #foods == tier * 2)
    for index, pet in ipairs(pets) do
        assert(pet.tier <= tier and pet == data.pets[index])
    end
    for index, food in ipairs(foods) do
        assert(food.tier <= tier and food == data.foods[index])
    end
    pets[1] = nil
    assert(data.pets_for_tier(tier)[1] == data.pets[1])
end
for round, expected in ipairs({1, 1, 2, 2, 3, 3}) do
    assert(data.tier_for_round(round) == expected)
end

local generator = rng.new(1)
assert(generator:next() == 48271 and generator:next() == 182605794)
assert(rng.new(0):next() == rng.new(1):next())
assert(rng.new(-1):next() == rng.new(2147483646):next())
assert(rng.new(math.mininteger):next() > 0)
assert(rng.new(math.maxinteger):next() > 0)
assert(not pcall(rng.new, 1.5))
local first, second = rng.new(123), rng.new(123)
for _ = 1, 100 do
    local value = first:int(-2, 4)
    assert(value >= -2 and value <= 4 and value == second:int(-2, 4))
end
assert(first:int(3, 3) == 3)
assert(not pcall(first.int, first, 2, 1))
assert(not pcall(first.int, first, -2147483646, 2147483646))

assert(data.rules_hash:match("^sha256:%x+$") and #data.rules_hash == 71)

print("data tests passed")
