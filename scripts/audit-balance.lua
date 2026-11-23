-- Run from the repository root. For a playable command transcript, pass a policy and seed.
-- lua scripts/audit-balance.lua role 1 | lua scripts/play.lua 1
package.path = "src/?.lua;" .. package.path

local data = require("autopets.data")
local run = require("autopets.run")
local rules = data.rules
local policies = {"spread", "funded-spread", "carry", "merge", "role"}

local function best_slot(items, score)
    local chosen, best
    for slot, item in ipairs(items) do
        if item then
            local value = score(item, slot)
            if value and (not best or value > best) then
                chosen, best = slot, value
            end
        end
    end
    return chosen
end

local function shelf_order()
    return 0
end

local function stat_score(unit)
    return unit.attack + unit.health
end

local function pet_score(offer)
    return stat_score(data.pet_by_id[offer.id])
end

local function food_score(offer)
    return stat_score(data.food_by_id[offer.id])
end

local function role_score(unit, opponent_style)
    local pet = data.pet_by_id[unit.id]
    local attack_weight = opponent_style == "guardian" and 12 or 10
    local health_weight = (opponent_style == "striker" or opponent_style == "swarm") and 12 or 10
    local shield = pet.ability.effect == "shield_front" and 4 or 0
    return unit.attack * attack_weight + unit.health * health_weight + 4 * (unit.level - 1) + shield
end

local function fill_team(game, action, policy)
    local blind = policy == "spread" or policy == "funded-spread"
    while true do
        local market = game:snapshot().shop
        if #market.team == rules.team_size or market.gold < rules.pet_cost then return end
        if policy == "merge" and market.rewards[1] then
            action("buy", 1, nil, true)
        else
            local offer = best_slot(market.pets, blind and shelf_order or pet_score)
            if not offer then return end
            action("buy", offer)
        end
    end
end

local pet_shelves = {"rewards", "pets"}

local function upgrade(market, action, policy)
    for _, shelf in ipairs(pet_shelves) do
        for slot, offer in ipairs(market[shelf]) do
            if offer then
                local target = best_slot(market.team, function(unit)
                    if unit.id ~= offer.id or unit.level == rules.max_level then return end
                    if policy ~= "role" or unit.xp + 1 >= rules.level_xp[unit.level + 1]
                        or data.pet_by_id[unit.id].tier > 1
                        or (market.round < 5 and market.gold >= rules.pet_cost + rules.food_cost) then
                        return unit.xp + 1
                    end
                end)
                if target then
                    action("combine", slot, target, shelf == "rewards")
                    return true
                end
            end
        end
    end
    local weakest = best_slot(market.team, function(unit)
        local pet = data.pet_by_id[unit.id]
        if unit.level == 1 and unit.xp == 0 and unit.attack == pet.attack and unit.health == pet.health then
            return -stat_score(unit)
        end
    end)
    if not weakest then return false end
    local current = market.team[weakest]
    local current_tier = data.pet_by_id[current.id].tier
    for _, shelf in ipairs(pet_shelves) do
        local slot = best_slot(market[shelf], function(offer)
            if data.pet_by_id[offer.id].tier > current_tier and pet_score(offer) > stat_score(current) then
                return pet_score(offer)
            end
        end)
        if slot then
            action("sell", weakest)
            action("buy", slot, weakest, shelf == "rewards")
            return true
        end
    end
    return false
end

local function food_target(team, fed, policy, position_score)
    if policy == "role" then
        local lead = best_slot(team, position_score)
        if not fed[lead] then return lead end
        local second = best_slot(team, function(unit, slot)
            if slot ~= lead then return position_score(unit) end
        end)
        return second and not fed[second] and second or lead
    end
    if policy == "carry" then return best_slot(team, stat_score) end
    return best_slot(team, function(unit, slot)
        if not fed[slot] then return -stat_score(unit) end
    end)
end

-- Policies use the player's shop and team. The role policy also uses the terminal's opponent style label.
local function prepare(game, policy, action, opponent_style)
    fill_team(game, action, policy)
    local position_score = stat_score
    if policy == "role" then
        position_score = function(unit) return role_score(unit, opponent_style) end
    end
    local fed = {}
    while true do
        local market = game:snapshot().shop
        if market.gold < rules.food_cost then break end
        local upgrade_first = (policy == "merge" or policy == "role") and market.gold >= rules.pet_cost
        if not upgrade_first or not upgrade(market, action, policy) then
            local food = best_slot(market.foods, policy == "spread" and shelf_order or food_score)
            if food then
                local target = food_target(market.team, fed, policy, position_score)
                if not target then break end
                action("feed", food, target)
                fed[target] = true
            elseif policy ~= "spread" and market.gold >= rules.reroll_cost + rules.food_cost then
                action("reroll")
            else
                break
            end
        end
    end
    if policy ~= "spread" and policy ~= "funded-spread" then
        local strongest = best_slot(game:snapshot().shop.team, position_score)
        if strongest ~= 1 then action("move", strongest, 1) end
    end
end

local costs = {buy = rules.pet_cost, combine = rules.pet_cost, feed = rules.food_cost, reroll = rules.reroll_cost}
local normal_commands = {feed = "food"}
local reward_commands = {buy = "reward", combine = "reward-merge"}

local function play(policy, seed, transcript)
    local game = run.new(seed)
    local wins, losses, peak_level = 0, 0, 1
    while true do
        local start = game:snapshot()
        assert(start.phase == "preparation" and start.shop.gold == rules.gold_per_round)
        assert(start.round < 40, "run exceeded the audit round limit")
        local function action(name, ...)
            local slot, target, reward = ...
            local prior = game:snapshot().shop
            local change = -(costs[name] or 0)
            if name == "sell" then change = prior.team[slot].level * rules.sell_gold_per_level end
            assert(game:shop_action(name, ...), name)
            local gold = game:snapshot().shop.gold
            assert(gold >= 0 and gold == prior.gold + change, "incorrect gold movement")
            if transcript then
                local command = reward and reward_commands[name] or normal_commands[name] or name
                print(command .. (slot and " " .. slot or "") .. (target and " " .. target or ""))
            end
        end
        prepare(game, policy, action, start.opponent.style)
        local has_high_tier = false
        for _, unit in ipairs(game:snapshot().shop.team) do
            peak_level = math.max(peak_level, unit.level)
            has_high_tier = has_high_tier or data.pet_by_id[unit.id].tier == rules.max_tier
        end
        if transcript then print("battle\nsettle") end
        assert(game:submit() and game:settle())
        local result = game:snapshot()
        if result.battle.outcome == "win" then wins = wins + 1 end
        if result.battle.outcome == "loss" then losses = losses + 1 end
        assert(result.wins == wins and result.lives == rules.start_lives - losses)
        if result.phase == "ended" then
            local won = wins == rules.wins_to_win
            assert(won or losses == rules.start_lives)
            assert(result.final == (won and "win" or "loss"))
            if transcript then print("quit") end
            return won, losses == 0, peak_level >= 2, has_high_tier
        end
        assert(game:advance())
        if transcript then print("next") end
    end
end

if #arg > 0 then
    local seed = arg[2] and math.tointeger(tonumber(arg[2]))
    for _, policy in ipairs(policies) do
        if arg[1] == policy and #arg == 2 and seed then
            play(policy, seed, true)
            return
        end
    end
    io.stderr:write("Usage  lua scripts/audit-balance.lua [spread|funded-spread|carry|merge|role INTEGER_SEED]\n")
    os.exit(1)
end

print("Local opponent audit, fixed seeds 1–64")
for _, policy in ipairs(policies) do
    local wins, perfect, leveled, high_tier = 0, 0, 0, 0
    for seed = 1, 64 do
        local won, lost_none, reached_level_two, ended_with_high_tier = play(policy, seed)
        if won then wins = wins + 1 end
        if lost_none then perfect = perfect + 1 end
        if reached_level_two then leveled = leveled + 1 end
        if ended_with_high_tier then high_tier = high_tier + 1 end
    end
    print(string.format("%-14s %2d wins  %2d losses  %2d perfect  %2d level 2+  %2d finished with tier %d",
        policy, wins, 64 - wins, perfect, leveled, high_tier, rules.max_tier))
end
