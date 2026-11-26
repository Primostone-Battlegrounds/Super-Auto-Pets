local battle = require("autopets.battle")
local data = require("autopets.data")
local rng = require("autopets.rng")
local shop = require("autopets.shop")

local bot = {}
local compatibility_policy = "shared-shop-v2"
local release_policy = "shared-shop-six-tier-v1"
local wider_pool_policy = "shared-shop-wide-pool-v1"
local max_actions_per_turn = 20
local default_budget = 32
local styles = {"guardian", "striker", "swarm"}
local weights = {
    guardian = {attack = 7, health = 10},
    striker = {attack = 10, health = 7},
    swarm = {attack = 8, health = 8},
}

local function policy_version(catalog)
    if catalog == data then return compatibility_policy end
    local rules = catalog.rules
    -- Use a distinct replay policy when the average tier is wider than the shelf.
    if #catalog.pets > rules.max_tier * rules.pet_shop_slots then return wider_pool_policy end
    return release_policy
end

function bot.style_weights()
    local result = {}
    for index, style in ipairs(styles) do
        local weight = weights[style]
        result[index] = {style = style, attack = weight.attack, health = weight.health}
    end
    return result
end

-- Use one signed coefficient per shop code in the bounded native controller.
function bot.native_front_affinity(ability)
    local effect, power = ability.effect, ability.power
    if effect == "rally_summon" then return -12 * power end
    if effect == "splash" then return 6 * power end
    if effect == "shield_next" then return 4 * power end
    if effect == "summon" then return 8 + 6 * power end
    return ability.trigger == "faint" and 8 or 0
end

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

local native_pack = math.maxinteger > 2147483647 and string.pack
local word = 4294967296.0

local function hash_bytes(hash, bytes)
    if not native_pack then
        for index = 1, #bytes do
            local byte = math.floor(hash.low % 256)
            local low = hash.low - byte + (byte ~ bytes:byte(index))
            -- FNV-1a prime = 256 * 2^32 + 435. All limb products fit in a Lua double exactly.
            local product = low * 435
            hash.high = (hash.high * 435 + low * 256 + math.floor(product / word)) % word
            hash.low = product % word
        end
        return hash
    end
    for index = 1, #bytes do
        hash = (hash ~ bytes:byte(index)) * 0x100000001b3
    end
    return hash
end

local function pack_integer(tag, number, size)
    if native_pack then return native_pack(size == 4 and "<c1I4" or "<c1i8", tag, number) end
    local bytes = {tag}
    for index = 1, size do
        bytes[index + 1] = string.char(number % 256)
        number = number // 256
    end
    return table.concat(bytes)
end

local function hex_word(value)
    return string.format("%02x%02x%02x%02x", math.floor(value / 16777216), math.floor(value / 65536) % 256,
        math.floor(value / 256) % 256, math.floor(value) % 256)
end

-- The digest covers ordered events and nested boards. Encode typed lengths and
-- fixed-width integers, sorting field names so Lua table order cannot affect it.
local function hash_value(hash, value)
    local kind = type(value)
    if kind == "string" then
        return hash_bytes(hash_bytes(hash, pack_integer("s", #value, 4)), value)
    elseif kind == "number" then
        assert(math.type(value) == "integer", "non-integer training event")
        return hash_bytes(hash, pack_integer("i", value, 8))
    elseif kind == "boolean" then
        return hash_bytes(hash, value and "t" or "f")
    end
    assert(kind == "table", "unsupported training event value")
    local size = #value
    if size > 0 then
        hash = hash_bytes(hash, pack_integer("a", size, 4))
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
    hash = hash_bytes(hash, pack_integer("o", #keys, 4))
    for _, key in ipairs(keys) do
        hash = hash_value(hash_value(hash, key), value[key])
    end
    return hash
end

local function summarize_battle(result)
    local initial_hash = native_pack and 0xcbf29ce484222325 or {high = 3421674724.0, low = 2216829733.0}
    local digest = hash_value(initial_hash, result.events)
    return {
        seed = result.seed,
        status = result.status,
        outcome = result.outcome,
        rng_state = result.rng_state,
        reason = result.events[#result.events].reason,
        event_count = #result.events,
        event_digest = native_pack and string.format("%016x", digest) or hex_word(digest.high) .. hex_word(digest.low),
    }
end

local function stats(unit, style)
    local weight = weights[style]
    return unit.attack * weight.attack + unit.health * weight.health
end

local function value(unit, style, catalog)
    local definition = catalog.pet_by_id[unit.id]
    local affinity = definition.style == style and 12 or 0
    return stats(unit, style) + affinity + 18 * ((unit.level or 1) - 1) + 3 * (unit.xp or 0)
end

local function front_value(unit, style, catalog)
    local ability = catalog.pet_by_id[unit.id].ability
    local front_bonus = 0
    if ability.trigger == "faint" then
        front_bonus = 8 * unit.level
        if style == "swarm" and ability.effect == "summon" then
            front_bonus = front_bonus + 18
        end
    end
    return stats(unit, style) + front_bonus
end

local function recruit_value(state, style, catalog)
    if catalog == data then
        return function(unit) return value(unit, style, catalog) end
    end
    local summoners, supports = 0, 0
    for _, unit in ipairs(state.team) do
        local ability = catalog.pet_by_id[unit.id].ability
        if ability.effect == "summon" then
            summoners = summoners + ability.power
        elseif ability.effect == "rally_summon" then
            supports = supports + unit.level
        end
    end
    return function(unit)
        local definition = catalog.pet_by_id[unit.id]
        local ability = definition.ability
        local level = unit.level or 1
        local affinity = definition.style == style and 10 or 0
        local impact = ability.power * (ability.targets or 1) * level * 3
        if ability.effect == "summon" then
            local token = catalog.token_by_id[ability.token]
            impact = ability.power * (token.attack + token.health + level - 1 + supports * 2) * 3
        elseif ability.effect == "rally_summon" then
            impact = math.min(summoners, 6) * level * 8
        end
        return value(unit, style, catalog) + affinity + impact
    end
end

local function formation_value(team, style, catalog)
    local score = 0
    local size = #team
    for slot, unit in ipairs(team) do
        local ability = catalog.pet_by_id[unit.id].ability
        local ahead = slot - 1
        local behind = size - slot
        local power = ability.power * unit.level
        score = score + (stats(unit, style) // 4) * behind
        if ability.effect == "rally_summon" then
            -- Supporters contribute when still alive as an ally replaces itself.
            for earlier = 1, ahead do
                local ally = catalog.pet_by_id[team[earlier].id].ability
                if ally.effect == "summon" then
                    score = score + unit.level * ally.power * 20
                end
            end
        elseif ability.effect == "summon" then
            local spaces = catalog.rules.team_size - size + slot
            score = score + math.min(ability.power, spaces) * (behind + 2) * 12
        elseif ability.trigger == "faint" or ability.effect == "shield_next" then
            score = score + math.min(ability.targets or 1, behind) * power * (behind + 3)
        elseif ability.trigger == "start" then
            score = score + power * behind * 2
        end
    end
    return score
end

local function choose_formation_move(team, style, catalog)
    if #team < 2 then return nil end
    local candidate = {table.unpack(team)}
    local best = formation_value(candidate, style, catalog)
    local command
    for from = 1, #team do
        local unit = table.remove(candidate, from)
        for to = 1, #team do
            if from ~= to then
                table.insert(candidate, to, unit)
                local score = formation_value(candidate, style, catalog)
                if score > best then
                    best = score
                    command = {action = "move", from = from, to = to}
                end
                table.remove(candidate, to)
            end
        end
        table.insert(candidate, from, unit)
    end
    return command
end

-- Beginner develops weaker slots and waits for clearer reasons to trade up.
-- Standard values level breakpoints, role combinations and stable formations.
local function choose_action(state, style, actions_taken, beginner, catalog, version)
    if actions_taken >= max_actions_per_turn then
        return nil, "action_limit"
    end
    local rules = catalog.rules
    local release = catalog ~= data
    local prioritize_upgrades = not beginner and version == wider_pool_policy
    local rate_pet = recruit_value(state, style, catalog)

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
                local definition = catalog.pet_by_id[offer.id]
                local offer_value = rate_pet(definition)
                if room then
                    consider(110 + offer_value // 8, {action = "buy", offer = slot, reward = reward})
                elseif not available_pet or offer_value > rate_pet(available_pet) then
                    available_pet = definition
                end
                for target, unit in ipairs(state.team) do
                    if unit.id == offer.id and unit.level < rules.max_level then
                        local levels_up = unit.xp + 1 >= rules.level_xp[unit.level + 1]
                        local score = 65 + (levels_up and 25 or 0) + (room and 0 or 12)
                        if prioritize_upgrades then
                            -- When copies are scarce, favor units with XP already invested.
                            score = score + 8 * unit.xp
                        end
                        if release and not beginner and levels_up then
                            local ability = definition.ability
                            score = score + math.min(25, ability.power * (ability.targets or 1) * 3)
                        end
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
                local food = catalog.food_by_id[offer.id]
                for target, unit in ipairs(state.team) do
                    local priority = math.min(20, front_value(unit, style, catalog) // 8)
                    if beginner then
                        priority = 20 - math.min(20, stats(unit, style) // 8)
                    end
                    local score = 43 + stats(food, style) + priority
                    if release and not beginner then
                        local adjacent = (target > 1 and 1 or 0) + (target < #state.team and 1 or 0)
                        local weight = weights[style]
                        local bonus = (food.adjacent_attack or 0) * weight.attack
                            + (food.adjacent_health or 0) * weight.health
                        score = score + adjacent * bonus
                    end
                    consider(score, {action = "feed", offer = slot, target = target})
                end
            end
        end
    end

    if available_pet then
        local available_value = rate_pet(available_pet)
        local trade_gain = beginner and 32 or 12
        for target, unit in ipairs(state.team) do
            local definition = catalog.pet_by_id[unit.id]
            local gain = available_value - rate_pet(unit)
            local uninvested = unit.level == 1 and unit.xp == 0
                and unit.attack == definition.attack and unit.health == definition.health
            local can_trade = uninvested or (release and not beginner and gain >= trade_gain + 40)
            if can_trade and available_pet.tier > definition.tier and gain >= trade_gain then
                consider(62 + gain // 3, {action = "sell", target = target})
            end
            for from, donor in ipairs(state.team) do
                if from ~= target and donor.id == unit.id and unit.level < rules.max_level
                    and unit.xp + donor.xp + 1 >= rules.level_xp[unit.level + 1]
                    and available_value > rate_pet(donor) + 8
                    and (not beginner or available_pet.tier > definition.tier) then
                    consider(74 + (available_value - rate_pet(donor)) // 4,
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

    if release and not beginner then
        local move = choose_formation_move(state.team, style, catalog)
        if move then return move end
    else
        local position_value = beginner and stats or front_value
        local front = 1
        for slot = 2, #state.team do
            if position_value(state.team[slot], style, catalog) > position_value(state.team[front], style, catalog) then
                front = slot
            end
        end
        if front ~= 1 then
            return {action = "move", from = front, to = 1}
        end
    end
    return nil, "priorities_exhausted"
end

-- Live hosts submit this command through the same shop entry point as players.
function bot.choose_action(snapshot, style, actions_taken, difficulty, catalog)
    assert(weights[style], "unknown bot style")
    assert(math.type(actions_taken) == "integer" and actions_taken >= 0, "invalid action count")
    assert(difficulty == nil or difficulty == "standard" or difficulty == "beginner", "unknown bot difficulty")
    if snapshot.phase ~= "preparation" then
        return nil, "wrong_phase"
    end
    catalog = catalog or data
    return choose_action(snapshot, style, actions_taken, difficulty == "beginner", catalog, policy_version(catalog))
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

function bot.new_pool(seed, requested_style, difficulty, catalog)
    assert(math.type(seed) == "integer", "seed must be a Lua integer")
    assert(requested_style == nil or weights[requested_style], "unknown bot style")
    assert(difficulty == nil or difficulty == "standard" or difficulty == "beginner", "unknown bot difficulty")
    catalog = catalog or data
    local selector = rng.salted(seed, 0x424f54, 0x504f4f4c) -- BOTPOOL
    local selected = selector:int(1, 2)
    local style_index = selector:int(1, #styles)
    local style = requested_style or styles[style_index]
    local pool = {
        seed = seed,
        catalog = catalog,
        policy_version = policy_version(catalog),
        requested_style = requested_style,
        difficulty = difficulty == "beginner" and difficulty or nil,
        selected = selected,
        battle_random = rng.salted(seed, 0x54, 0x5241494e), -- TRAIN
        sessions = {},
        history = {},
    }
    for index = 1, 2 do
        local shop_seed = selector:next()
        local session_style = index == selected and style or styles[style_index % #styles + 1]
        pool.sessions[index] = {style = session_style, shop_seed = shop_seed, store = shop.new(shop_seed, pool.catalog)}
    end
    open_turn(pool)
    return pool
end

local function prepare_step(pool, expected)
    local index = pool.session_index
    local session, frame = pool.sessions[index], pool.turn.sessions[index]
    local store = session.store
    local state = store:snapshot()
    local command, stop = choose_action(state, session.style, #frame.commands, pool.difficulty == "beginner",
        pool.catalog, pool.policy_version)
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
    local result = battle.resolve(left.battle_team, right.battle_team, pool.battle_random:next(), pool.catalog)
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
        policy_version = pool.policy_version,
        rules_hash = assert(pool.catalog.rules_hash),
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

local function replay(trace, catalog)
    local pool = bot.new_pool(trace.seed, trace.requested_style, trace.difficulty, catalog)
    pool.policy_version = trace.policy_version
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

function bot.replay(trace, catalog)
    catalog = catalog or data
    if type(trace) ~= "table" or trace.rules_hash ~= catalog.rules_hash then
        return nil, "trace_version_mismatch"
    end
    local version = policy_version(catalog)
    local legacy_wide = version == wider_pool_policy and trace.policy_version == release_policy
    if trace.policy_version ~= version and not legacy_wide then
        return nil, "trace_version_mismatch"
    end
    local ok, opponent = pcall(replay, trace, catalog)
    if not ok then
        return nil, "invalid_trace", opponent
    end
    return opponent
end

function bot.generate(round, seed, requested_style, difficulty, catalog)
    local pool = bot.new_pool(seed, requested_style, difficulty, catalog)
    assert(bot.advance_to_round(pool, round, math.maxinteger))
    return bot.snapshot(pool)
end

return bot
