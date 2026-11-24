local battle = require("autopets.battle")
local data = require("autopets.data")
local rng = require("autopets.rng")
local shop = require("autopets.shop")

local bot = {}
local rules = data.rules
local policy_version = "shared-shop-v2"
local max_actions_per_turn = 20
local default_budget = 32
local styles = {"guardian", "striker", "swarm"}
local weights = {
    guardian = {attack = 7, health = 10},
    striker = {attack = 10, health = 7},
    swarm = {attack = 8, health = 8},
}

local function copy(value)
    if type(value) ~= "table" then
        return value
    end
    local result = {}
    for key, field in pairs(value) do
        result[key] = copy(field)
    end
    return result
end

local function equal(expected, observed)
    if type(expected) ~= "table" then
        return expected == observed
    end
    if type(observed) ~= "table" then
        return false
    end
    for key, value in pairs(expected) do
        if not equal(value, observed[key]) then
            return false
        end
    end
    for key in pairs(observed) do
        if expected[key] == nil then
            return false
        end
    end
    return true
end

local function hash_bytes(hash, bytes)
    for index = 1, #bytes do
        hash = (hash ~ bytes:byte(index)) * 0x100000001b3
    end
    return hash
end

-- The digest covers ordered events and nested boards. Encode typed lengths and
-- fixed-width integers, sorting field names so Lua table order cannot affect it.
local function hash_value(hash, value)
    local kind = type(value)
    if kind == "string" then
        return hash_bytes(hash_bytes(hash, string.pack("<c1I4", "s", #value)), value)
    elseif kind == "number" then
        assert(math.type(value) == "integer", "non-integer training event")
        return hash_bytes(hash, string.pack("<c1i8", "i", value))
    elseif kind == "boolean" then
        return hash_bytes(hash, value and "t" or "f")
    end
    assert(kind == "table", "unsupported training event value")
    local size = #value
    if size > 0 then
        hash = hash_bytes(hash, string.pack("<c1I4", "a", size))
        for key in pairs(value) do
            assert(math.type(key) == "integer" and key >= 1 and key <= size, "mixed training event table")
        end
        for index = 1, size do
            hash = hash_value(hash, value[index])
        end
        return hash
    end
    local keys = {}
    for key in pairs(value) do
        assert(type(key) == "string", "non-string training event field name")
        keys[#keys + 1] = key
    end
    table.sort(keys)
    hash = hash_bytes(hash, string.pack("<c1I4", "o", #keys))
    for _, key in ipairs(keys) do
        hash = hash_value(hash_value(hash, key), value[key])
    end
    return hash
end

local function summarize_battle(result)
    return {
        seed = result.seed,
        status = result.status,
        outcome = result.outcome,
        rng_state = result.rng_state,
        reason = result.events[#result.events].reason,
        event_count = #result.events,
        event_digest = string.format("%016x", hash_value(0xcbf29ce484222325, result.events)),
    }
end

local function stats(unit, style)
    local weight = weights[style]
    return unit.attack * weight.attack + unit.health * weight.health
end

local function value(unit, style)
    local definition = data.pet_by_id[unit.id]
    local affinity = definition.style == style and 12 or 0
    return stats(unit, style) + affinity + 18 * ((unit.level or 1) - 1) + 3 * (unit.xp or 0)
end

local function front_value(unit, style)
    local ability = data.pet_by_id[unit.id].ability
    local front_bonus = 0
    if ability.trigger == "faint" then
        front_bonus = 8 * unit.level
        if style == "swarm" and ability.effect == "summon" then
            front_bonus = front_bonus + 18
        end
    end
    return stats(unit, style) + front_bonus
end

-- Beginner develops weaker slots and waits for clearer reasons to trade up.
-- Standard uses front-line ability value and invests in a stronger lead unit.
local function choose_action(state, style, actions_taken, beginner)
    if actions_taken >= max_actions_per_turn then
        return nil, "action_limit"
    end

    local action, best_score
    local function consider(score, candidate)
        if not best_score or score > best_score then
            action, best_score = candidate, score
        end
    end

    local room = #state.team < rules.team_size
    local available_pet
    local function recruit(shelf, reward)
        for slot, offer in ipairs(shelf) do
            if offer then
                local definition = data.pet_by_id[offer.id]
                local offer_value = value(definition, style)
                if room then
                    consider(110 + offer_value // 8, {action = "buy", offer = slot, reward = reward})
                elseif not available_pet or offer_value > value(available_pet, style) then
                    available_pet = definition
                end
                for target, unit in ipairs(state.team) do
                    if unit.id == offer.id and unit.level < rules.max_level then
                        local levels_up = unit.xp + 1 >= rules.level_xp[unit.level + 1]
                        local score = 65 + (levels_up and 25 or 0) + (room and 0 or 12)
                        consider(score + unit.xp, {action = "combine", offer = slot, target = target, reward = reward})
                    end
                end
            end
        end
    end
    if state.gold >= rules.pet_cost then
        recruit(state.rewards, true)
        recruit(state.pets, false)
    end

    if state.gold >= rules.food_cost then
        for slot, offer in ipairs(state.foods) do
            if offer then
                local food = data.food_by_id[offer.id]
                for target, unit in ipairs(state.team) do
                    local priority = math.min(20, front_value(unit, style) // 8)
                    if beginner then
                        priority = 20 - math.min(20, stats(unit, style) // 8)
                    end
                    local score = 43 + stats(food, style) + priority
                    consider(score, {action = "feed", offer = slot, target = target})
                end
            end
        end
    end

    if available_pet then
        local recruit_value = value(available_pet, style)
        local trade_gain = beginner and 32 or 12
        for target, unit in ipairs(state.team) do
            local definition = data.pet_by_id[unit.id]
            local gain = recruit_value - value(unit, style)
            local uninvested = unit.level == 1 and unit.xp == 0
                and unit.attack == definition.attack and unit.health == definition.health
            if uninvested and available_pet.tier > definition.tier and gain >= trade_gain then
                consider(62 + gain // 3, {action = "sell", target = target})
            end
            for from, donor in ipairs(state.team) do
                if from ~= target and donor.id == unit.id and unit.level < rules.max_level
                    and unit.xp + donor.xp + 1 >= rules.level_xp[unit.level + 1]
                    and recruit_value > value(donor, style) + 8
                    and (not beginner or available_pet.tier > definition.tier) then
                    consider(74 + (recruit_value - value(donor, style)) // 4,
                        {action = "merge", from = from, to = target})
                end
            end
        end
    end

    if action then
        return action
    end

    if state.gold >= rules.reroll_cost + math.min(rules.pet_cost, rules.food_cost) then
        for _, shelf in ipairs({state.pets, state.foods}) do
            for _, offer in ipairs(shelf) do
                if not offer or not offer.frozen then
                    return {action = "reroll"}
                end
            end
        end
    end

    if state.gold < rules.pet_cost then
        local frozen = 0
        for _, offer in ipairs(state.pets) do
            if offer and offer.frozen then frozen = frozen + 1 end
        end
        if frozen < rules.pet_shop_slots - 1 then
            for slot, offer in ipairs(state.pets) do
                if offer and not offer.frozen then
                    for _, unit in ipairs(state.team) do
                        if offer.id == unit.id and unit.level < rules.max_level
                            and unit.xp + 1 >= rules.level_xp[unit.level + 1] then
                            return {action = "freeze", kind = "pet", offer = slot, frozen = true}
                        end
                    end
                end
            end
        end
    end

    local position_value = beginner and stats or front_value
    local front = 1
    for slot = 2, #state.team do
        if position_value(state.team[slot], style) > position_value(state.team[front], style) then
            front = slot
        end
    end
    if front ~= 1 then
        return {action = "move", from = front, to = 1}
    end
    return nil, "priorities_exhausted"
end

-- Live hosts submit this command through the same shop entry point as players.
function bot.choose_action(snapshot, style, actions_taken, difficulty)
    assert(weights[style], "unknown bot style")
    assert(math.type(actions_taken) == "integer" and actions_taken >= 0, "invalid action count")
    assert(difficulty == nil or difficulty == "standard" or difficulty == "beginner", "unknown bot difficulty")
    if snapshot.phase ~= "preparation" then
        return nil, "wrong_phase"
    end
    return choose_action(snapshot, style, actions_taken, difficulty == "beginner")
end

local function open_turn(pool)
    local round = {round = pool.sessions[1].store:snapshot().round, sessions = {}}
    for index, session in ipairs(pool.sessions) do
        round.sessions[index] = {opened = session.store:snapshot(), commands = {}}
    end
    pool.turn = round
    pool.session_index = 1
    pool.phase = "prepare"
end

function bot.new_pool(seed, requested_style, difficulty)
    assert(math.type(seed) == "integer", "seed must be a Lua integer")
    assert(requested_style == nil or weights[requested_style], "unknown bot style")
    assert(difficulty == nil or difficulty == "standard" or difficulty == "beginner", "unknown bot difficulty")
    local selector = rng.new(seed ~ 0x424f54504f4f4c)
    local selected = selector:int(1, 2)
    local style_index = selector:int(1, #styles)
    local style = requested_style or styles[style_index]
    local pool = {
        seed = seed,
        requested_style = requested_style,
        difficulty = difficulty == "beginner" and difficulty or nil,
        selected = selected,
        battle_random = rng.new(seed ~ 0x545241494e),
        sessions = {},
        history = {},
    }
    for index = 1, 2 do
        local shop_seed = selector:next()
        local session_style = index == selected and style or styles[style_index % #styles + 1]
        pool.sessions[index] = {style = session_style, shop_seed = shop_seed, store = shop.new(shop_seed)}
    end
    open_turn(pool)
    return pool
end

local function prepare_step(pool, expected)
    local index = pool.session_index
    local session, frame = pool.sessions[index], pool.turn.sessions[index]
    local store = session.store
    local state = store:snapshot()
    local command, stop = bot.choose_action(state, session.style, #frame.commands, pool.difficulty)
    if expected then
        local recorded = expected.sessions[index].commands[#frame.commands + 1]
        assert(equal(command, recorded and recorded.command), "command_mismatch")
        command = recorded and recorded.command
    end
    if command then
        assert(store:apply(command))
        frame.commands[#frame.commands + 1] = {
            command = command,
            gold_before = state.gold,
            gold_after = store:snapshot().gold,
        }
        return
    end

    session.battle_team = assert(store:finish_turn())
    frame.finished = store:snapshot()
    frame.stop = stop
    pool.session_index = index + 1
    if pool.session_index <= #pool.sessions then
        return
    end
    local ready = pool.turn.sessions[pool.selected].finished
    pool.latest = {
        round = ready.round,
        tier = ready.tier,
        style = pool.sessions[pool.selected].style,
        team = ready.team,
    }
    pool.latest_turn = pool.turn
    pool.phase = "train"
end

local function train(pool)
    local left, right = pool.sessions[1], pool.sessions[2]
    local result = battle.resolve(left.battle_team, right.battle_team, pool.battle_random:next())
    assert(left.store:record_battle(result, "player"))
    assert(right.store:record_battle(result, "enemy"))
    pool.turn.training = {
        result = summarize_battle(result),
        settled = {left.store:snapshot(), right.store:snapshot()},
    }
    left.battle_team, right.battle_team = nil, nil
    pool.history[#pool.history + 1] = pool.turn
    pool.phase = "advance"
end

local function step(pool, expected)
    if pool.phase == "prepare" then
        prepare_step(pool, expected)
    elseif pool.phase == "train" then
        train(pool)
    else
        for _, session in ipairs(pool.sessions) do
            assert(session.store:advance_round())
        end
        open_turn(pool)
    end
end

function bot.advance_to_round(pool, round, budget)
    assert(math.type(round) == "integer" and round > 0, "round must be a positive integer")
    budget = budget or default_budget
    assert(math.type(budget) == "integer" and budget >= 0, "budget must be a nonnegative integer")
    assert(not pool.latest or round >= pool.latest.round, "cannot rewind the training pool")
    for _ = 1, budget do
        if pool.latest and pool.latest.round == round then
            return true
        end
        step(pool)
    end
    return pool.latest ~= nil and pool.latest.round == round
end

function bot.snapshot(pool)
    return copy(pool.latest)
end

function bot.trace(pool)
    if not pool.latest then
        return nil, "opponent_not_ready"
    end
    local trace = {
        policy_version = policy_version,
        rules_hash = assert(data.rules_hash),
        seed = pool.seed,
        requested_style = pool.requested_style,
        difficulty = pool.difficulty,
        selected = pool.selected,
        sessions = {},
        rounds = {},
    }
    for index, session in ipairs(pool.sessions) do
        trace.sessions[index] = {style = session.style, shop_seed = session.shop_seed}
    end
    for index = 1, pool.latest.round - 1 do
        trace.rounds[index] = copy(pool.history[index])
    end
    local ready = pool.latest_turn
    trace.rounds[ready.round] = {round = ready.round, sessions = copy(ready.sessions)}
    return trace
end

local function replay(trace)
    local pool = bot.new_pool(trace.seed, trace.requested_style, trace.difficulty)
    for index, frame in ipairs(trace.rounds) do
        while pool.phase == "prepare" do
            step(pool, frame)
        end
        if index < #trace.rounds then
            step(pool)
            step(pool)
        end
    end
    assert(equal(bot.trace(pool), trace), "checkpoint_mismatch")
    return bot.snapshot(pool)
end

function bot.replay(trace)
    if type(trace) ~= "table" or trace.rules_hash ~= data.rules_hash or trace.policy_version ~= policy_version then
        return nil, "trace_version_mismatch"
    end
    local ok, opponent = pcall(replay, trace)
    if not ok then
        return nil, "invalid_trace", opponent
    end
    return opponent
end

function bot.generate(round, seed, requested_style, difficulty)
    local pool = bot.new_pool(seed, requested_style, difficulty)
    assert(bot.advance_to_round(pool, round, math.maxinteger))
    return bot.snapshot(pool)
end

return bot
