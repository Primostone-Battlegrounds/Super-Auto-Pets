local battle_receipt = require("autopets.battle_receipt")
local data = require("autopets.data")
local rng = require("autopets.rng")

local battle = {}
local strike_limit = 256

local function copy_team(team, side)
    assert(type(team) == "table", "battle team must be a table")
    local size = #team
    assert(size <= data.rules.team_size, "battle team exceeds five slots")
    for slot in pairs(team) do
        assert(math.type(slot) == "integer" and slot >= 1 and slot <= size, "battle team must be dense")
    end

    local copy, seen_uids = {}, {}
    for slot = 1, size do
        local unit = team[slot]
        assert(type(unit) == "table", "battle team must be dense")
        local definition = data.pet_by_id[unit.id]
        assert(definition, "unknown battle pet")
        assert(math.type(unit.attack) == "integer" and unit.attack >= 1, "invalid battle attack")
        assert(math.type(unit.health) == "integer" and unit.health >= 1, "invalid battle health")
        assert(math.type(unit.level) == "integer" and unit.level >= 1
            and unit.level <= data.rules.max_level, "invalid battle level")
        local uid = side .. ":slot:" .. slot
        if unit.uid ~= nil then
            assert(math.type(unit.uid) == "integer" and unit.uid > 0, "invalid battle pet uid")
            assert(not seen_uids[unit.uid], "duplicate battle pet uid")
            seen_uids[unit.uid] = true
            uid = side .. ":" .. unit.uid
        end
        copy[slot] = {
            side = side,
            uid = uid,
            slot = slot,
            id = unit.id,
            name = definition.name,
            attack = unit.attack,
            health = unit.health,
            max_health = unit.health,
            level = unit.level,
            shield = 0,
            ability = definition.ability,
        }
    end
    return copy
end

local function opposing_side(side)
    return side == "player" and "enemy" or "player"
end

local function snapshot_team(team)
    local snapshot = {}
    for slot, unit in ipairs(team) do
        snapshot[slot] = {
            id = unit.id,
            uid = unit.uid,
            attack = unit.attack,
            health = unit.health,
            max_health = unit.max_health,
            level = unit.level or 1,
            shield = unit.shield,
        }
    end
    return snapshot
end

local function snapshot_board(teams)
    return {player = snapshot_team(teams.player), enemy = snapshot_team(teams.enemy)}
end

local board_events = {start = true, damage = true, shield = true, buff = true, summon = true, result = true}

local function emit(state, kind, unit, event)
    event = event or {}
    event.type = kind
    event.strike = state.strike
    if unit then
        event.side = unit.side
        event.slot = unit.slot
        event.id = unit.id
        event.uid = unit.uid
        event.name = unit.name
    end
    if board_events[kind] then
        event.board = snapshot_board(state.teams)
    end
    state.events[#state.events + 1] = event
    return event
end

local function damage(state, source, target, amount)
    local absorbed = math.min(amount, target.shield)
    local remaining = amount - absorbed
    target.shield = target.shield - absorbed
    target.health = math.max(0, target.health - remaining)
    emit(state, "damage", target, {
        source_side = source.side,
        source_slot = source.slot,
        source_id = source.id,
        source_uid = source.uid,
        amount = remaining,
        absorbed = absorbed,
        health = target.health,
    })
end

local effects = {}

function effects.shield_front(state, unit, ability)
    local team = state.teams[unit.side]
    local amount = ability.power * unit.level
    for slot = 1, math.min(ability.targets, #team) do
        local target = team[slot]
        target.shield = target.shield + amount
        emit(state, "shield", target, {amount = amount, shield = target.shield})
    end
end

function effects.hit_random(state, unit, ability)
    local team = state.teams[opposing_side(unit.side)]
    local candidates = {table.unpack(team)}
    for _ = 1, math.min(ability.targets, #candidates) do
        local position = state.rng:int(1, #candidates)
        local target = table.remove(candidates, position)
        damage(state, unit, target, ability.power * unit.level)
    end
end

function effects.buff_front(state, unit, ability)
    local target = state.teams[unit.side][1]
    if target then
        local amount = math.min(ability.power * unit.level, math.maxinteger - target.health)
        target.health = target.health + amount
        target.max_health = target.max_health + math.min(amount, math.maxinteger - target.max_health)
        emit(state, "buff", target, {amount = amount, health = target.health})
    end
end

function effects.summon(state, unit, ability, position)
    local team = state.teams[unit.side]
    local token = data.token_by_id[ability.token]
    local count = math.min(ability.power, data.rules.team_size - #team)
    for offset = 0, count - 1 do
        state.summon_count = state.summon_count + 1
        local summon = {
            side = unit.side,
            uid = unit.side .. ":summon:" .. state.summon_count,
            slot = position + offset,
            id = token.id,
            name = token.name,
            attack = token.attack + unit.level - 1,
            health = token.health,
            max_health = token.health,
            shield = 0,
        }
        table.insert(team, summon.slot, summon)
        emit(state, "summon", summon, {attack = summon.attack, health = summon.health})
    end
    for slot = position + count, #team do
        team[slot].slot = slot
    end
    return count
end

local function use_ability(state, unit, summon_position)
    local ability = unit.ability
    emit(state, "skill", unit, {ability = ability.name, trigger = ability.trigger})
    return effects[ability.effect](state, unit, ability, summon_position)
end

-- Remove all casualties from both teams before their queued effects use the free slots.
local function resolve_faints(state)
    local queue = {}
    local last_faint
    for _, side in ipairs(state.order) do
        local team = state.teams[side]
        local remaining = 0
        for _, unit in ipairs(team) do
            if unit.health == 0 then
                last_faint = emit(state, "faint", unit)
                if unit.ability and unit.ability.trigger == "faint" then
                    queue[#queue + 1] = {unit = unit, surviving_before = remaining}
                end
            else
                remaining = remaining + 1
                team[remaining] = unit
                unit.slot = remaining
            end
        end
        for slot = #team, remaining + 1, -1 do
            team[slot] = nil
        end
    end
    if last_faint then
        -- Keep the original faint coordinates, then show both formations compacted together.
        last_faint.board = snapshot_board(state.teams)
    end
    -- In each formation, replacements go after earlier survivors and summons.
    local summoned_before = {player = 0, enemy = 0}
    for _, entry in ipairs(queue) do
        local unit = entry.unit
        local offset = summoned_before[unit.side]
        local summon_position = entry.surviving_before + offset + 1
        local count = use_ability(state, unit, summon_position) or 0
        summoned_before[unit.side] = offset + count
    end
end

local function both_teams_remain(state)
    return #state.teams.player > 0 and #state.teams.enemy > 0
end

local function open_battle(state)
    local queue = {}
    -- Use the original slot order and the seeded side order for tied slots.
    for slot = 1, data.rules.team_size do
        for _, side in ipairs(state.order) do
            local unit = state.teams[side][slot]
            if unit and unit.ability.trigger == "start" then
                queue[#queue + 1] = unit
            end
        end
    end
    for _, unit in ipairs(queue) do
        if not both_teams_remain(state) then
            break
        end
        if unit.health > 0 then
            use_ability(state, unit)
            resolve_faints(state)
        end
    end
end

local function announce_attack(state, unit, target)
    emit(state, "attack", unit, {
        attack = unit.attack,
        target_side = target.side,
        target_slot = target.slot,
        target_id = target.id,
        target_uid = target.uid,
        target_name = target.name,
    })
end

local function collide(state)
    local first = state.teams[state.order[1]][1]
    local second = state.teams[state.order[2]][1]
    -- Both fronts have committed to the strike before either can be removed.
    announce_attack(state, first, second)
    announce_attack(state, second, first)
    damage(state, first, second, first.attack)
    damage(state, second, first, second.attack)
    resolve_faints(state)
end

-- Inputs are dense, front-first teams of pet snapshots. Events are emitted in
-- replay order, with strike 0 reserved for opening effects. Faint slots refer
-- to the formation before the current damage batch is compacted. Board frames
-- show the post-event state. For events without a frame, retain the prior one.
function battle.resolve(player, enemy, seed)
    local generator = rng.new(seed)
    local first = generator:int(1, 2) == 1 and "player" or "enemy"
    local state = {
        teams = {player = copy_team(player, "player"), enemy = copy_team(enemy, "enemy")},
        rng = generator,
        order = {first, opposing_side(first)},
        strike = 0,
        summon_count = 0,
        events = {},
    }
    emit(state, "start", nil, {seed = seed, first_side = first})
    open_battle(state)
    while both_teams_remain(state) and state.strike < strike_limit do
        state.strike = state.strike + 1
        collide(state)
    end

    local player_left = #state.teams.player > 0
    local enemy_left = #state.teams.enemy > 0
    local outcome, reason = "draw", "elimination"
    if player_left and enemy_left then
        reason = "strike_limit"
    elseif player_left then
        outcome = "win"
    elseif enemy_left then
        outcome = "loss"
    end
    emit(state, "result", nil, {outcome = outcome, reason = reason})
    local result = {
        outcome = outcome,
        status = reason == "strike_limit" and reason or "resolved",
        seed = seed,
        rng_state = generator.state,
        events = state.events,
    }
    battle_receipt.register(result, player, enemy)
    return result
end

return battle
