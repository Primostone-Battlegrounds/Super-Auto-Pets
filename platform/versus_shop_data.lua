package.path = "src/?.lua;" .. package.path

local battle = require("autopets.battle")
local data = require("autopets.data")
local duel = require("autopets.duel")
local rng = require("autopets.rng")
local shop = require("autopets.shop")
local rules = data.rules

local function row(...)
    io.write(table.concat({...}, "\t"), "\n")
end

local function index(catalog)
    local codes, attacks, healths = {}, {0}, {0}
    for position, item in ipairs(catalog) do
        codes[item.id] = position
        attacks[position + 1] = item.attack
        healths[position + 1] = item.health
        assert(position == 1 or catalog[position - 1].tier <= item.tier, "native tier prefix requires sorted catalog")
    end
    return codes, attacks, healths
end

local function tier_limits(catalog)
    local limits, count = {0}, 0
    for tier = 1, rules.max_tier do
        for _, item in ipairs(catalog) do
            if item.tier == tier then count = count + 1 end
        end
        assert(count > limits[tier], "native catalog tiers need at least one item")
        limits[tier + 1] = count
    end
    return limits
end

local pets, pet_attack, pet_health = index(data.pets)
local foods, food_attack, food_health = index(data.foods)

local function packed(store)
    local view = store:snapshot()
    local result = {view.round, view.tier, view.gold, view.rng_state, view.next_uid, #view.team}
    for _, shelf in ipairs({{view.pets, pets}, {view.foods, foods}}) do
        for _, offer in ipairs(shelf[1]) do
            local code = offer and assert(shelf[2][offer.id]) or 0
            result[#result + 1] = offer and offer.frozen and -code or code
        end
    end
    for slot = 1, rules.team_size do
        local pet = view.team[slot]
        if pet then
            result[#result + 1] = assert(pets[pet.id])
            result[#result + 1] = pet.uid
            result[#result + 1] = pet.attack
            result[#result + 1] = pet.health
            result[#result + 1] = pet.level
            result[#result + 1] = pet.xp
        else
            for _ = 1, 6 do result[#result + 1] = 0 end
        end
    end
    for _, offer in ipairs(view.rewards) do
        result[#result + 1] = assert(pets[offer.id])
    end
    return table.concat(result, "\t")
end

if arg[1] == "catalog" then
    local modulus, multiplier = rng.parameters()
    local settings = {
        {"GOLD", rules.gold_per_round}, {"PET_COST", rules.pet_cost}, {"FOOD_COST", rules.food_cost},
        {"REROLL_COST", rules.reroll_cost}, {"SELL_GOLD", rules.sell_gold_per_level}, {"TEAM_SIZE", rules.team_size},
        {"PET_SLOTS", rules.pet_shop_slots}, {"FOOD_SLOTS", rules.food_shop_slots}, {"MAX_LEVEL", rules.max_level},
        {"MAX_TIER", rules.max_tier}, {"MERGE_ATTACK", rules.merge_attack}, {"MERGE_HEALTH", rules.merge_health},
        {"LEVEL_REWARD", rules.level_reward_tier_offset}, {"RANDOM_MODULUS", modulus}, {"RANDOM_MULTIPLIER", multiplier},
        {"RANDOM_QUOTIENT", modulus // multiplier}, {"RANDOM_REMAINDER", modulus % multiplier},
    }
    assert(modulus <= 2147483647 and modulus % multiplier < modulus // multiplier,
        "native random arithmetic requires a signed 32-bit Schrage reduction")
    for _, setting in ipairs(settings) do row("const", table.unpack(setting)) end
    local pet_limits = tier_limits(data.pets)
    local food_limits = tier_limits(data.foods)
    local unlock_rounds, thresholds = {0}, {0}
    for _, round in ipairs(rules.tier_unlock_rounds) do unlock_rounds[#unlock_rounds + 1] = round end
    for _, threshold in ipairs(rules.level_xp) do thresholds[#thresholds + 1] = threshold end
    thresholds[#thresholds + 1] = 0
    local lists = {
        {"PET_LIMITS", pet_limits}, {"FOOD_LIMITS", food_limits}, {"UNLOCK_ROUNDS", unlock_rounds},
        {"LEVEL_THRESHOLDS", thresholds}, {"REWARD_PET_LIMITS", pet_limits},
        {"PET_ATTACK", pet_attack}, {"PET_HEALTH", pet_health}, {"FOOD_ATTACK", food_attack}, {"FOOD_HEALTH", food_health},
    }
    for _, list in ipairs(lists) do row("list", list[1], table.concat(list[2], "\t")) end
    local match = duel.new(1, 1, 2)
    for seat = 1, 2 do row("start", seat, packed(match.seats[seat].shop)) end
    for code, item in ipairs(data.pets) do row("pet", code, item.name, item.attack, item.health) end
    for code, item in ipairs(data.foods) do row("food", code, item.name, item.attack, item.health) end
    return
end

assert(arg[1] == "trace", "usage: lua platform/versus_shop_data.lua catalog|trace")
local commands = {
    [10] = "reroll", [11] = "buy", [12] = "combine", [13] = "sell",
    [14] = "move", [15] = "merge", [16] = "feed", [17] = "freeze",
}

local function turn(reference)
    local formation = assert(reference:finish_turn())
    assert(reference:record_battle(battle.resolve(formation, {}, 1), "player"))
    assert(reference:advance_round())
    row("open", packed(reference))
end

local function apply(reference, action, from, to, flag)
    local name = assert(commands[action])
    local command = {action = name}
    if name == "buy" or name == "combine" then
        command.offer = from
        if to ~= 0 or name == "combine" then command.target = to end
        if flag == 1 then command.reward = true
        elseif flag ~= 0 then command.reward = 42 end
    elseif name == "sell" then
        command.target = to
    elseif name == "move" or name == "merge" then
        command.from, command.to = from, to
    elseif name == "feed" then
        command.offer, command.target = from, to
    elseif name == "freeze" then
        command.offer = from
        command.kind = ({[0] = "pet", "food"})[to]
        if flag == 1 then command.frozen = true
        elseif flag == 2 then command.frozen = false
        elseif flag ~= 0 then command.frozen = 42 end
    end
    local accepted = reference:apply(command) and 1 or 0
    row("apply", action, from, to, flag, accepted, packed(reference))
end

-- Buy two identical pets, merge them, and use the third offer to trigger a reward.
local opening
for seed = 1, 128 do
    local candidate = shop.new(seed)
    if candidate.pets[1].id == candidate.pets[2].id and candidate.pets[2].id == candidate.pets[3].id then
        opening = candidate
        break
    end
end
assert(opening, "expected an opening with triple identical stock")
row("init", packed(opening))
apply(opening, 11, 1, 0, 0)
apply(opening, 11, 2, 0, 0)
apply(opening, 15, 1, 2, 0)
apply(opening, 12, 3, 1, 0)
apply(opening, 11, 1, 0, 1) -- The reward is unaffordable this round.
for _ = 1, 2 do turn(opening) end
apply(opening, 13, 0, 1, 0)

local frozen = shop.new(1)
row("init", packed(frozen))
for offer = 1, rules.pet_shop_slots do apply(frozen, 17, offer, 0, 1) end
for offer = 1, rules.food_shop_slots do apply(frozen, 17, offer, 1, 1) end
apply(frozen, 10, 0, 0, 0) -- Cannot pay to reroll when every offer is frozen.
turn(frozen)
apply(frozen, 17, 1, 0, 2)
apply(frozen, 10, 0, 0, 0)

-- Exercise buying an existing reward and rejecting that same empty slot.
local reward = shop.new(1)
reward.gold = 2 * rules.pet_cost
reward.rewards[1] = {id = data.pets_for_tier(2)[#data.pets_for_tier(2)].id, frozen = false}
row("init", packed(reward))
apply(reward, 11, 1, 0, 1)
apply(reward, 11, 1, 0, 1)
apply(reward, 11, 2147483647, 0, 1)
apply(reward, 15, -2147483648, 2147483647, 0)

for seed = 1, 48 do
    local reference = shop.new(seed * 68473)
    local random = rng.new(seed * 48147)
    row("init", packed(reference))
    for round = 1, 14 do
        for _, action in ipairs({11, 11, 16, 16, 14, 15, 12, 13, 17, 10}) do
            local from = random:int(0, (action == 14 or action == 15) and 6 or 4)
            local to = random:int(0, action == 17 and 2 or 6)
            local flag = (action == 11 or action == 12) and random:int(0, 1)
                or action == 17 and random:int(0, 3) or 0
            apply(reference, action, from, to, flag)
        end
        if round < 14 then turn(reference) end
    end
end
