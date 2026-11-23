package.path = "src/?.lua;" .. package.path

local battle = require("autopets.battle")

local function pet(id, attack, health, level)
    return {id = id, attack = attack, health = health, level = level or 1}
end

local function equal(first, second)
    if type(first) ~= "table" or type(second) ~= "table" then
        return first == second
    end
    for key, item in pairs(first) do
        if not equal(item, second[key]) then
            return false
        end
    end
    for key in pairs(second) do
        if first[key] == nil then
            return false
        end
    end
    return true
end

local function events_of(result, kind, strike)
    local selected = {}
    for _, event in ipairs(result.events) do
        if event.type == kind and (strike == nil or event.strike == strike) then
            selected[#selected + 1] = event
        end
    end
    return selected
end

local function assert_events(result, ...)
    local expected = {...}
    assert(#result.events == #expected, "unexpected event count")
    for index, kind in ipairs(expected) do
        assert(result.events[index].type == kind, "unexpected event at " .. index)
    end
end

-- Opening damage uses a seeded sample of distinct slots and cancels the knocked-out skills.
local attacker = {pet("sunset_cat", 5, 4)}
local defenders = {pet("ember_swift", 2, 1), pet("maple_fox", 4, 1)}
local opening = battle.resolve(attacker, defenders, 1)
assert(equal(opening, battle.resolve(attacker, defenders, 1)))
assert(equal(attacker, {pet("sunset_cat", 5, 4)}))
assert(equal(defenders, {pet("ember_swift", 2, 1), pet("maple_fox", 4, 1)}))
assert(opening.outcome == "win")
assert_events(opening, "start", "skill", "damage", "damage", "faint", "faint", "result")
assert(opening.events[2].ability == "猫步突袭")
assert(opening.events[3].slot == 2 and opening.events[4].slot == 1)
assert(opening.events[5].slot == 1 and opening.events[6].slot == 2)
local initial = opening.events[1].board
assert(equal(initial.player[1], {id = "sunset_cat", attack = 5, health = 4, max_health = 4, level = 1, shield = 0}))
assert(initial.enemy[1].health == 1 and initial.enemy[2].health == 1)
assert(not opening.events[2].board)
local first_damage, second_damage = opening.events[3].board, opening.events[4].board
assert(first_damage.enemy[1].health == 1 and first_damage.enemy[2].health == 0)
assert(second_damage.enemy[1].health == 0 and second_damage.enemy[2].health == 0)
assert(second_damage.enemy[1].max_health == 1 and second_damage.enemy[2].max_health == 1)
assert(not opening.events[5].board and #opening.events[6].board.enemy == 0)
local victory = opening.events[7].board
assert(#victory.enemy == 0 and equal(victory.player, initial.player))
initial.player[1].health = 99
assert(attacker[1].health == 4 and first_damage.player[1].health == 4 and victory.player[1].health == 4)

-- Positions tie on the seeded priority. Shield absorption can change the outcome.
local turtle = {pet("reed_turtle", 1, 1)}
local swift = {pet("ember_swift", 1, 1)}
local shield_first = battle.resolve(turtle, swift, 1)
local damage_first = battle.resolve(turtle, swift, 2)
assert(shield_first.events[1].first_side == "player" and shield_first.outcome == "draw")
assert(damage_first.events[1].first_side == "enemy" and damage_first.outcome == "loss")
assert(shield_first.events[4].type == "skill" and shield_first.events[4].side == "enemy")
assert(shield_first.events[5].type == "damage" and shield_first.events[5].absorbed == 1)
assert(shield_first.events[5].amount == 0 and shield_first.events[5].health == 1)
local shield = events_of(shield_first, "shield")[1]
assert(shield.board.player[1].shield == 1)
assert(shield_first.events[5].board.player[1].shield == 0 and shield_first.events[5].board.player[1].health == 1)
assert_events(damage_first, "start", "skill", "damage", "faint", "result")

-- Both attacks and both deaths precede either queued faint ability.
local rabbit = pet("cottontail_rabbit", 2, 1)
rabbit.xp = 1
local rabbit_team = {rabbit}
local opposing_team = {pet("river_otter", 2, 1)}
local simultaneous = battle.resolve(rabbit_team, opposing_team, 1)
assert(simultaneous.outcome == "draw")
assert_events(simultaneous, "start", "attack", "attack", "damage", "damage", "faint", "faint",
    "skill", "summon", "skill", "summon", "attack", "attack", "damage", "damage", "faint", "faint", "result")
assert(simultaneous.events[2].target_id == "river_otter")
assert(simultaneous.events[6].side == "player" and simultaneous.events[7].side == "enemy")
assert(simultaneous.events[9].id == "rabbit_kit" and simultaneous.events[9].slot == 1)
assert(simultaneous.events[11].id == "otter_pup" and simultaneous.events[11].slot == 1)
assert(rabbit_team[1] == rabbit and rabbit.health == 1 and rabbit.xp == 1)
assert(not simultaneous.events[2].board and not simultaneous.events[3].board)
local before_faints = simultaneous.events[5].board
assert(before_faints.player[1].health == 0 and before_faints.enemy[1].health == 0)
assert(not simultaneous.events[6].board)
local after_faints = simultaneous.events[7].board
assert(#after_faints.player == 0 and #after_faints.enemy == 0)
local first_replacement, second_replacement = simultaneous.events[9].board, simultaneous.events[11].board
assert(first_replacement.player[1].id == "rabbit_kit" and #first_replacement.enemy == 0)
assert(second_replacement.player[1].id == "rabbit_kit" and second_replacement.enemy[1].id == "otter_pup")
local draw_board = simultaneous.events[18].board
assert(#draw_board.player == 0 and #draw_board.enemy == 0)

local defeated = {pet("alder_marmot", 3, 2)}
local sheep = pet("cloud_sheep", 3, 1, 3)
local ally = pet("alder_marmot", 2, 3)
local crowded = battle.resolve({sheep, ally, ally, ally, ally}, defeated, 1)
local crowded_summons = events_of(crowded, "summon")
assert(crowded.outcome == "win" and #crowded_summons == 1)
assert(crowded_summons[1].id == "lambkin" and crowded_summons[1].attack == 3)
local spacious = battle.resolve({sheep}, defeated, 1)
local spacious_summons = events_of(spacious, "summon")
assert(#spacious_summons == 2)
assert(spacious_summons[1].slot == 1 and spacious_summons[2].slot == 2)
local lambkin = {id = "lambkin", attack = 3, health = 2, max_health = 2, level = 1, shield = 0}
assert(equal(spacious_summons[1].board.player, {lambkin}))
assert(equal(spacious_summons[2].board.player, {lambkin, lambkin}))

-- Death during the opening frees the slot before the opening sequence resumes.
local born_opening = battle.resolve({pet("maple_fox", 2, 3)}, {pet("cottontail_rabbit", 1, 1)}, 1)
local early_summons = events_of(born_opening, "summon", 0)
assert(#early_summons == 1 and early_summons[1].side == "enemy")
assert(events_of(born_opening, "attack", 1)[1].target_id == "rabbit_kit")

-- When slots 1 and 2 both faint, the slot-2 summon still precedes the slot-3 survivor.
local double_faint = battle.resolve(attacker, {
    pet("ember_swift", 2, 1), pet("cottontail_rabbit", 2, 1), ally,
}, 13)
local opening_faints = events_of(double_faint, "faint", 0)
assert(#opening_faints == 2 and opening_faints[1].slot == 1 and opening_faints[2].slot == 2)
local opening_skills = events_of(double_faint, "skill", 0)
assert(opening_skills[2].id == "cottontail_rabbit" and opening_skills[2].slot == 2)
local replacements = events_of(double_faint, "summon", 0)
assert(#replacements == 1 and replacements[1].slot == 1)
assert(events_of(double_faint, "attack", 1)[1].target_id == "rabbit_kit")
assert(#opening_faints[2].board.enemy == 1 and opening_faints[2].board.enemy[1].id == ally.id)
assert(#replacements[1].board.enemy == 2 and replacements[1].board.enemy[1].id == "rabbit_kit")
assert(replacements[1].board.enemy[2].id == ally.id)

local two_summoners = battle.resolve(attacker, {
    pet("cloud_sheep", 4, 1), pet("cottontail_rabbit", 2, 1), ally,
}, 13)
local ordered_summons = events_of(two_summoners, "summon", 0)
assert(#ordered_summons == 3)
assert(ordered_summons[1].id == "lambkin" and ordered_summons[1].slot == 1)
assert(ordered_summons[2].id == "lambkin" and ordered_summons[2].slot == 2)
assert(ordered_summons[3].id == "rabbit_kit" and ordered_summons[3].slot == 3)
for index, event in ipairs(ordered_summons) do
    assert(#event.board.enemy == index + 1 and event.board.enemy[index].id == event.id)
    assert(event.board.enemy[index + 1].id == ally.id)
end

local support = battle.resolve({pet("alder_marmot", 3, 1, 2), ally}, defeated, 1)
local buffs = events_of(support, "buff")
assert(support.outcome == "win")
assert(#buffs == 1 and buffs[1].slot == 1 and buffs[1].health == 7)
local shifted = events_of(support, "faint", 1)[2].board.player[1]
assert(shifted.id == "alder_marmot" and shifted.health == 3 and shifted.max_health == 3)
assert(buffs[1].board.player[1].health == 7 and buffs[1].board.player[1].max_health == 7)
assert(ally.health == 3)

local saturated = battle.resolve({pet("alder_marmot", 3, 1, 2), pet("alder_marmot", 2, math.maxinteger - 1)},
    {pet("sunset_cat", 1, 3)}, 1)
local saturated_buff = events_of(saturated, "buff", 0)[1]
assert(saturated_buff.amount == 3 and saturated_buff.board.player[1].health == math.maxinteger)
assert(saturated_buff.board.player[1].max_health == math.maxinteger)
local saturated_result = saturated.events[#saturated.events].board.player[1]
assert(saturated_result.health == math.maxinteger - 2 and saturated_result.max_health == math.maxinteger)

assert(battle.resolve({}, {}, 42).outcome == "draw")
assert(battle.resolve({ally}, {}, 42).outcome == "win")
assert(battle.resolve({}, {ally}, 42).outcome == "loss")
assert(not pcall(battle.resolve, {ally, ally, ally, ally, ally, ally}, defeated, 1))
assert(not pcall(battle.resolve, {[2] = ally}, defeated, 1))
assert(not pcall(battle.resolve, {pet("unknown", 2, 3)}, defeated, 1))

local sturdy_pet = pet("alder_marmot", 1, math.maxinteger)
local sturdy = {sturdy_pet, sturdy_pet, sturdy_pet, sturdy_pet, sturdy_pet}
local exhausted = battle.resolve(sturdy, sturdy, 1)
local last = exhausted.events[#exhausted.events]
assert(last.type == "result" and last.outcome == "draw" and last.reason == "strike_limit")
assert(last.strike == 256)
assert(#last.board.player == 5 and #last.board.enemy == 5)
assert(last.board.player[1].health == math.maxinteger - 256 and last.board.enemy[1].health == math.maxinteger - 256)
assert(last.board.player[1].max_health == math.maxinteger and last.board.enemy[1].max_health == math.maxinteger)
local frames = 0
for _, event in ipairs(exhausted.events) do
    if event.board then
        frames = frames + 1
    end
end
assert(frames == 2 * last.strike + 2, "only start, damage and result need frames in this battle")

print("battle tests passed")
