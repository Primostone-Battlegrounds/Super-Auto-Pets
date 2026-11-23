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
local attacker = {pet("aurora_tern", 5, 4)}
local defenders = {pet("ember_swift", 2, 1), pet("copper_kestrel", 4, 1)}
local opening = battle.resolve(attacker, defenders, 1)
assert(equal(opening, battle.resolve(attacker, defenders, 1)))
assert(equal(attacker, {pet("aurora_tern", 5, 4)}))
assert(equal(defenders, {pet("ember_swift", 2, 1), pet("copper_kestrel", 4, 1)}))
assert(opening.outcome == "win")
assert_events(opening, "start", "skill", "damage", "damage", "faint", "faint", "result")
assert(opening.events[2].ability == "霞羽")
assert(opening.events[3].slot == 2 and opening.events[4].slot == 1)
assert(opening.events[5].slot == 1 and opening.events[6].slot == 2)

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
assert_events(damage_first, "start", "skill", "damage", "faint", "result")

-- Both attacks and both deaths precede either queued faint ability.
local moth = pet("lantern_moth", 2, 1)
moth.xp = 1
local moth_team = {moth}
local opposing_team = {pet("drift_crayfish", 2, 1)}
local simultaneous = battle.resolve(moth_team, opposing_team, 1)
assert(simultaneous.outcome == "draw")
assert_events(simultaneous, "start", "attack", "attack", "damage", "damage", "faint", "faint",
    "skill", "summon", "skill", "summon", "attack", "attack", "damage", "damage", "faint", "faint", "result")
assert(simultaneous.events[2].target_id == "drift_crayfish")
assert(simultaneous.events[6].side == "player" and simultaneous.events[7].side == "enemy")
assert(simultaneous.events[9].id == "mothling" and simultaneous.events[9].slot == 1)
assert(simultaneous.events[11].id == "crayling" and simultaneous.events[11].slot == 1)
assert(moth_team[1] == moth and moth.health == 1 and moth.xp == 1)

local defeated = {pet("alder_marmot", 3, 2)}
local cloud = pet("cloud_ostrich", 3, 1, 3)
local ally = pet("alder_marmot", 2, 3)
local crowded = battle.resolve({cloud, ally, ally, ally, ally}, defeated, 1)
local crowded_summons = events_of(crowded, "summon")
assert(crowded.outcome == "win" and #crowded_summons == 1)
assert(crowded_summons[1].id == "cloud_chick" and crowded_summons[1].attack == 3)
local spacious = battle.resolve({cloud}, defeated, 1)
local spacious_summons = events_of(spacious, "summon")
assert(#spacious_summons == 2)
assert(spacious_summons[1].slot == 1 and spacious_summons[2].slot == 2)

-- Death during the opening frees the slot before the opening sequence resumes.
local born_opening = battle.resolve({pet("copper_kestrel", 2, 3)}, {pet("lantern_moth", 1, 1)}, 1)
local early_summons = events_of(born_opening, "summon", 0)
assert(#early_summons == 1 and early_summons[1].side == "enemy")
assert(events_of(born_opening, "attack", 1)[1].target_id == "mothling")

-- When slots 1 and 2 both faint, the slot-2 summon still precedes the slot-3 survivor.
local double_faint = battle.resolve(attacker, {
    pet("ember_swift", 2, 1), pet("lantern_moth", 2, 1), ally,
}, 13)
local opening_faints = events_of(double_faint, "faint", 0)
assert(#opening_faints == 2 and opening_faints[1].slot == 1 and opening_faints[2].slot == 2)
local opening_skills = events_of(double_faint, "skill", 0)
assert(opening_skills[2].id == "lantern_moth" and opening_skills[2].slot == 2)
local replacements = events_of(double_faint, "summon", 0)
assert(#replacements == 1 and replacements[1].slot == 1)
assert(events_of(double_faint, "attack", 1)[1].target_id == "mothling")

local two_summoners = battle.resolve(attacker, {
    pet("cloud_ostrich", 4, 1), pet("lantern_moth", 2, 1), ally,
}, 13)
local ordered_summons = events_of(two_summoners, "summon", 0)
assert(#ordered_summons == 3)
assert(ordered_summons[1].id == "cloud_chick" and ordered_summons[1].slot == 1)
assert(ordered_summons[2].id == "cloud_chick" and ordered_summons[2].slot == 2)
assert(ordered_summons[3].id == "mothling" and ordered_summons[3].slot == 3)

local support = battle.resolve({pet("alder_marmot", 3, 1, 2), ally}, defeated, 1)
local buffs = events_of(support, "buff")
assert(support.outcome == "win")
assert(#buffs == 1 and buffs[1].slot == 1 and buffs[1].health == 7)
assert(ally.health == 3)

assert(battle.resolve({}, {}, 42).outcome == "draw")
assert(battle.resolve({ally}, {}, 42).outcome == "win")
assert(battle.resolve({}, {ally}, 42).outcome == "loss")
assert(not pcall(battle.resolve, {ally, ally, ally, ally, ally, ally}, defeated, 1))
assert(not pcall(battle.resolve, {[2] = ally}, defeated, 1))
assert(not pcall(battle.resolve, {pet("unknown", 2, 3)}, defeated, 1))

local sturdy = {pet("alder_marmot", 1, math.maxinteger)}
local exhausted = battle.resolve(sturdy, sturdy, 1)
local last = exhausted.events[#exhausted.events]
assert(last.type == "result" and last.outcome == "draw" and last.reason == "strike_limit")
assert(last.strike == 256)

print("battle tests passed")
