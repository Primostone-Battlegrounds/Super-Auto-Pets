-- Run from the repository root. For a playable command transcript, pass a policy and seed.
-- lua scripts/audit-balance.lua role 1 | lua scripts/play.lua 1
package.path = "src/?.lua;" .. package.path

local battle = require("autopets.battle")
local bot = require("autopets.bot")
local data = require("autopets.data")
local rng = require("autopets.rng")
local run = require("autopets.run")
local shop = require("autopets.shop")
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

local function prepare_pool(seed, round, style)
    local pool = bot.new_pool(seed, style)
    while not bot.advance_to_round(pool, round, 32) do end
    local trace = bot.trace(pool)
    local replayed, err, detail = bot.replay(trace)
    assert(replayed, tostring(err) .. ": " .. tostring(detail))
    return trace
end

local function json(value)
    if type(value) == "string" then
        return '"' .. value:gsub('[%z\1-\31\\"]', function(character)
            if character == '"' or character == '\\' then return '\\' .. character end
            return string.format("\\u%04x", character:byte())
        end) .. '"'
    end
    if type(value) ~= "table" then
        assert(type(value) == "number" or type(value) == "boolean", "unsupported trace value")
        return tostring(value)
    end
    local values = {}
    local count = #value
    if next(value) == nil or count > 0 then
        for key in pairs(value) do
            assert(math.type(key) == "integer" and key >= 1 and key <= count, "mixed trace table")
        end
        for index = 1, count do values[index] = json(value[index]) end
        return "[" .. table.concat(values, ",") .. "]"
    end
    for key, item in pairs(value) do
        assert(type(key) == "string", "non-string trace record key")
        values[#values + 1] = json(key) .. ":" .. json(item)
    end
    table.sort(values)
    return "{" .. table.concat(values, ",") .. "}"
end

local function size(set)
    local count = 0
    for _ in pairs(set) do count = count + 1 end
    return count
end

local function random_purchases(store, random)
    while true do
        local market = store:snapshot()
        local recruits, purchases = {}, {}
        if market.gold >= rules.pet_cost then
            for _, shelf in ipairs(pet_shelves) do
                for slot, offer in ipairs(market[shelf]) do
                    if offer then
                        local reward = shelf == "rewards"
                        recruits[#recruits + 1] = {action = "buy", offer = slot, reward = reward}
                        for target, unit in ipairs(market.team) do
                            if unit.id == offer.id and unit.level < rules.max_level then
                                purchases[#purchases + 1] = {
                                    action = "combine", offer = slot, target = target, reward = reward,
                                }
                            end
                        end
                    end
                end
            end
        end
        if market.gold >= rules.food_cost then
            for slot, offer in ipairs(market.foods) do
                if offer and #market.team > 0 then
                    purchases[#purchases + 1] = {action = "feed", offer = slot}
                end
            end
        end
        local choices = #market.team < rules.team_size and #recruits > 0 and recruits or purchases
        if #choices > 0 then
            local command = choices[random:int(1, #choices)]
            if command.action == "feed" then
                command.target = random:int(1, #market.team)
            end
            assert(store:apply(command))
        elseif market.gold >= rules.reroll_cost + math.min(rules.pet_cost, rules.food_cost) then
            assert(store:apply({action = "reroll"}))
        else
            return
        end
    end
end

local reverse_outcome = {win = "loss", loss = "win", draw = "draw"}

local function count_both_sides(outcomes, player, opponent, seed)
    local first = battle.resolve(player, opponent, seed)
    local second = battle.resolve(opponent, player, seed)
    assert(first.status == "resolved" and second.status == "resolved")
    outcomes[first.outcome] = outcomes[first.outcome] + 1
    local mirrored = reverse_outcome[second.outcome]
    outcomes[mirrored] = outcomes[mirrored] + 1
    return first
end

local function audit_against_random(sample_size, difficulty)
    local rounds = 12
    local compositions = {}
    if difficulty then print(difficulty .. " versus random purchases") end
    print(string.format("Paired shop seeds 1–%d; %d rounds; both seat orders", sample_size, rounds))
    for _, style in ipairs({"guardian", "striker", "swarm"}) do
        local outcomes = {win = 0, loss = 0, draw = 0}
        local style_compositions = {}
        for seed = 1, sample_size do
            local pool = bot.new_pool(seed, style, difficulty)
            while not bot.advance_to_round(pool, 1, 32) do end
            local trace = assert(bot.trace(pool))
            local baseline = shop.new(trace.sessions[trace.selected].shop_seed)
            local choice_random = rng.new(seed ~ 0x425559) -- BUY
            local battle_random = rng.new(seed ~ 0x424154544c45) -- BATTLE
            for round = 1, rounds do
                while not bot.advance_to_round(pool, round, 32) do end
                local strategic = assert(bot.snapshot(pool)).team
                random_purchases(baseline, choice_random)
                local random_team = assert(baseline:finish_turn())
                local first = count_both_sides(outcomes, strategic, random_team, battle_random:next())
                assert(baseline:record_battle(first, "enemy"))
                assert(baseline:advance_round())
                if round == rounds then
                    local members = {}
                    for slot, unit in ipairs(strategic) do members[slot] = unit.id end
                    table.sort(members)
                    local composition = table.concat(members, "/")
                    style_compositions[composition] = true
                    compositions[composition] = (compositions[composition] or 0) + 1
                end
            end
        end
        print(string.format("%-8s %d wins / %d draws / %d losses, %.1f%% points, %d distinct final compositions",
            style, outcomes.win, outcomes.draw, outcomes.loss,
            100 * (outcomes.win + outcomes.draw / 2) / (2 * sample_size * rounds), size(style_compositions)))
    end
    local top_count = 0
    for _, count in pairs(compositions) do top_count = math.max(top_count, count) end
    print(string.format("Final compositions across styles: %d, most common %d/%d (%.1f%%)",
        size(compositions), top_count, 3 * sample_size, 100 * top_count / (3 * sample_size)))
end

local function audit_difficulties(sample_size)
    local rounds = 12
    print(string.format("Standard versus beginner; paired shop seeds 1–%d; %d rounds; both seat orders",
        sample_size, rounds))
    for _, style in ipairs({"guardian", "striker", "swarm"}) do
        local outcomes = {win = 0, loss = 0, draw = 0}
        for seed = 1, sample_size do
            local standard = bot.new_pool(seed, style, "standard")
            local beginner = bot.new_pool(seed, style, "beginner")
            local battle_random = rng.new(seed ~ 0x424154544c45) -- BATTLE
            for round = 1, rounds do
                while not bot.advance_to_round(standard, round, 32) do end
                while not bot.advance_to_round(beginner, round, 32) do end
                count_both_sides(outcomes, bot.snapshot(standard).team, bot.snapshot(beginner).team, battle_random:next())
            end
        end
        print(string.format("%-8s %d wins / %d draws / %d losses, %.1f%% standard points",
            style, outcomes.win, outcomes.draw, outcomes.loss,
            100 * (outcomes.win + outcomes.draw / 2) / (2 * sample_size * rounds)))
    end
end

local function audit_pool(sample_size)
    local rounds = {1, 3, 6, 12}
    local summaries, styles, actions = {}, {}, {}
    for index in ipairs(rounds) do
        summaries[index] = {lineups = {}, leveled = 0, team_size = 0, min = math.maxinteger, max = 0, total = 0}
    end
    for seed = 1, sample_size do
        local trace = prepare_pool(seed, rounds[#rounds])
        local style = trace.sessions[trace.selected].style
        styles[style] = (styles[style] or 0) + 1
        for index, round in ipairs(rounds) do
            local lineup, stats = {}, 0
            local summary = summaries[index]
            local team = trace.rounds[round].sessions[trace.selected].finished.team
            local leveled = false
            for slot, unit in ipairs(team) do
                lineup[slot] = unit.id
                stats = stats + unit.attack + unit.health
                leveled = leveled or unit.level > 1
            end
            summary.lineups[table.concat(lineup, "/")] = true
            if leveled then summary.leveled = summary.leveled + 1 end
            summary.team_size = summary.team_size + #team
            summary.min = math.min(summary.min, stats)
            summary.max = math.max(summary.max, stats)
            summary.total = summary.total + stats
        end
        for _, frame in ipairs(trace.rounds) do
            for _, session in ipairs(frame.sessions) do
                for _, transition in ipairs(session.commands) do
                    local action = transition.command.action
                    actions[action] = (actions[action] or 0) + 1
                end
            end
        end
    end
    print(string.format("Training replay: %d/%d pools through round %d, %d verified training fights",
        sample_size, sample_size, rounds[#rounds], sample_size * (rounds[#rounds] - 1)))
    print(string.format("Sample by style    guardian=%d striker=%d swarm=%d",
        styles.guardian or 0, styles.striker or 0, styles.swarm or 0))
    for index, round in ipairs(rounds) do
        local summary = summaries[index]
        print(string.format("Round %2d: %2d unique ordered lineups, %2d with level 2+, mean units %.2f, "
            .. "total atk+hp min/mean/max %d/%.2f/%d", round, size(summary.lineups), summary.leveled,
            summary.team_size / sample_size, summary.min, summary.total / sample_size, summary.max))
    end
    local counts = {}
    for action, count in pairs(actions) do counts[#counts + 1] = string.format("%s=%d", action, count) end
    table.sort(counts)
    print("Shared shop actions: " .. table.concat(counts, " "))
end

if #arg > 0 then
    local seed = arg[2] and math.tointeger(tonumber(arg[2]))
    local round = arg[3] and math.tointeger(tonumber(arg[3]))
    if arg[1] == "versus-random" and (#arg == 1 or (#arg == 2 and seed and seed > 0)) then
        audit_against_random(seed or 64)
        return
    end
    if arg[1] == "versus-random" and #arg == 3 and seed and seed > 0 and arg[3] == "beginner" then
        audit_against_random(seed, arg[3])
        return
    end
    if arg[1] == "difficulty" and (#arg == 1 or (#arg == 2 and seed and seed > 0)) then
        audit_difficulties(seed or 64)
        return
    end
    if arg[1] == "trace" and seed and round and round >= 1 and (#arg == 3 or #arg == 4) then
        print(json(prepare_pool(seed, round, arg[4])))
        return
    end
    for _, policy in ipairs(policies) do
        if arg[1] == policy and #arg == 2 and seed then
            play(policy, seed, true)
            return
        end
    end
    io.stderr:write("Usage  lua scripts/audit-balance.lua [spread|funded-spread|carry|merge|role INTEGER_SEED]\n",
        "       lua scripts/audit-balance.lua trace INTEGER_SEED ROUND [guardian|striker|swarm]\n",
        "       lua scripts/audit-balance.lua versus-random [SEED_COUNT [beginner]]\n",
        "       lua scripts/audit-balance.lua difficulty [SEED_COUNT]\n")
    os.exit(1)
end

local sample_size = 64
print("Local opponent audit, fixed seeds 1–64")
for _, policy in ipairs(policies) do
    local wins, perfect, leveled, high_tier = 0, 0, 0, 0
    for seed = 1, sample_size do
        local won, lost_none, reached_level_two, ended_with_high_tier = play(policy, seed)
        if won then wins = wins + 1 end
        if lost_none then perfect = perfect + 1 end
        if reached_level_two then leveled = leveled + 1 end
        if ended_with_high_tier then high_tier = high_tier + 1 end
    end
    print(string.format("%-14s %2d wins  %2d losses  %2d perfect  %2d level 2+  %2d finished with tier %d",
        policy, wins, sample_size - wins, perfect, leveled, high_tier, rules.max_tier))
end
audit_pool(sample_size)
